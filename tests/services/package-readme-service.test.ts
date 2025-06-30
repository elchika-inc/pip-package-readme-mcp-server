import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PackageReadmeService } from '../../src/services/package-readme/package-readme-service.js';
import { ReadmeService } from '../../src/services/readme/index.js';
import { PackageInfoBuilder } from '../../src/services/package-readme/package-info-builder.js';
import { InstallationInfoBuilder } from '../../src/services/package-readme/installation-info-builder.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/services/cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
  createCacheKey: {
    packageReadme: vi.fn((name, version) => `readme:${name}:${version}`),
  },
}));

vi.mock('../../src/services/pypi-api.js', () => ({
  pypiClient: {
    getPackageInfo: vi.fn(),
    getVersionInfo: vi.fn(),
  },
}));

vi.mock('../../src/services/readme/index.js', () => {
  return {
    ReadmeService: vi.fn().mockImplementation(() => ({
      cleanReadmeContent: vi.fn(),
      extractUsageExamples: vi.fn(),
    })),
  };
});

vi.mock('../../src/services/package-readme/package-info-builder.js', () => {
  return {
    PackageInfoBuilder: vi.fn().mockImplementation(() => ({
      build: vi.fn(),
    })),
  };
});

vi.mock('../../src/services/package-readme/installation-info-builder.js', () => {
  return {
    InstallationInfoBuilder: vi.fn().mockImplementation(() => ({
      build: vi.fn(),
    })),
  };
});

describe('PackageReadmeService', () => {
  let service: PackageReadmeService;
  let mockReadmeService: any;
  let mockPackageInfoBuilder: any;
  let mockInstallationInfoBuilder: any;
  let mockCache: any;
  let mockPypiClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    service = new PackageReadmeService();
    
    // Get mocked instances - use latest mock result
    const readmeServiceMock = vi.mocked(ReadmeService);
    const packageInfoBuilderMock = vi.mocked(PackageInfoBuilder);
    const installationInfoBuilderMock = vi.mocked(InstallationInfoBuilder);
    
    mockReadmeService = readmeServiceMock.mock.instances[readmeServiceMock.mock.instances.length - 1];
    mockPackageInfoBuilder = packageInfoBuilderMock.mock.instances[packageInfoBuilderMock.mock.instances.length - 1];
    mockInstallationInfoBuilder = installationInfoBuilderMock.mock.instances[installationInfoBuilderMock.mock.instances.length - 1];
    
    const { cache } = require('../../src/services/cache.js');
    const { pypiClient } = require('../../src/services/pypi-api.js');
    mockCache = cache;
    mockPypiClient = pypiClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPackageReadme', () => {
    const mockPackageInfo = {
      info: {
        name: 'requests',
        version: '2.28.1',
        summary: 'Python HTTP for Humans.',
        description: '# Requests\n\nPython HTTP library',
        description_content_type: 'text/markdown',
        author: 'Kenneth Reitz',
        maintainer: 'Python Software Foundation',
        keywords: 'http,requests',
        classifiers: ['Programming Language :: Python :: 3'],
        requires_python: '>=3.7',
      },
    };

    const mockBuiltPackageInfo = {
      name: 'requests',
      version: '2.28.1',
      description: 'Python HTTP for Humans.',
      author: 'Kenneth Reitz',
      maintainer: 'Python Software Foundation',
      keywords: ['http', 'requests'],
      classifiers: ['Programming Language :: Python :: 3'],
      requires_python: '>=3.7',
    };

    const mockInstallationInfo = {
      pip: 'pip install requests',
      conda: 'conda install requests',
      pipx: 'pipx install requests',
    };

    beforeEach(() => {
      mockPackageInfoBuilder.build.mockReturnValue(mockBuiltPackageInfo);
      mockInstallationInfoBuilder.build.mockReturnValue(mockInstallationInfo);
      mockReadmeService.cleanReadmeContent.mockImplementation((content: string) => content);
      mockReadmeService.extractUsageExamples.mockReturnValue(['import requests']);
    });

    it('should return cached response if available', async () => {
      const cachedResponse = {
        package_name: 'requests',
        version: '2.28.1',
        exists: true,
      };
      mockCache.get.mockReturnValue(cachedResponse);

      const result = await service.getPackageReadme({ package_name: 'requests' });

      expect(result).toBe(cachedResponse);
      expect(mockCache.get).toHaveBeenCalledWith('readme:requests:latest');
      expect(mockPypiClient.getPackageInfo).not.toHaveBeenCalled();
    });

    it('should fetch package info and build response for latest version', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);

      const result = await service.getPackageReadme({ package_name: 'requests' });

      expect(mockPypiClient.getPackageInfo).toHaveBeenCalledWith('requests');
      expect(result).toEqual({
        package_name: 'requests',
        version: '2.28.1',
        description: 'Python HTTP for Humans.',
        readme_content: '# Requests\n\nPython HTTP library',
        usage_examples: ['import requests'],
        installation: mockInstallationInfo,
        basic_info: mockBuiltPackageInfo,
        exists: true,
      });
      expect(mockCache.set).toHaveBeenCalledWith('readme:requests:latest', result);
    });

    it('should fetch specific version when provided', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getVersionInfo.mockResolvedValue(mockPackageInfo);

      const result = await service.getPackageReadme({ 
        package_name: 'requests', 
        version: '2.27.1' 
      });

      expect(mockPypiClient.getVersionInfo).toHaveBeenCalledWith('requests', '2.27.1');
      expect(result.exists).toBe(true);
    });

    it('should exclude usage examples when include_examples is false', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);

      const result = await service.getPackageReadme({ 
        package_name: 'requests',
        include_examples: false 
      });

      expect(result.usage_examples).toEqual([]);
      expect(mockReadmeService.extractUsageExamples).not.toHaveBeenCalled();
    });

    it('should exclude usage examples when no content available', async () => {
      const packageInfoWithoutDescription = {
        ...mockPackageInfo,
        info: {
          ...mockPackageInfo.info,
          description: '',
        },
      };
      
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(packageInfoWithoutDescription);
      mockReadmeService.cleanReadmeContent.mockReturnValue('');

      const result = await service.getPackageReadme({ 
        package_name: 'requests',
        include_examples: true 
      });

      expect(result.usage_examples).toEqual([]);
      expect(mockReadmeService.extractUsageExamples).not.toHaveBeenCalled();
    });

    it('should handle package not found', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockRejectedValue(new Error('Package not found'));

      const result = await service.getPackageReadme({ package_name: 'nonexistent' });

      expect(result).toEqual({
        package_name: 'nonexistent',
        version: 'latest',
        description: 'Package not found',
        readme_content: '',
        usage_examples: [],
        installation: {
          pip: 'pip install nonexistent',
          conda: 'conda install nonexistent',
          pipx: 'pipx install nonexistent',
        },
        basic_info: {
          name: 'nonexistent',
          version: 'latest',
          description: 'Package not found',
          author: 'Unknown',
          maintainer: undefined,
          keywords: [],
          classifiers: [],
          requires_python: undefined,
        },
        exists: false,
      });
    });

    it('should handle null package info', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(null);

      const result = await service.getPackageReadme({ package_name: 'test' });

      expect(result.exists).toBe(false);
      expect(result.package_name).toBe('test');
    });

    it('should use markdown description when available', async () => {
      const packageWithMarkdown = {
        ...mockPackageInfo,
        info: {
          ...mockPackageInfo.info,
          description: '# Test Package\n\nThis is markdown content',
          description_content_type: 'text/markdown',
        },
      };
      
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(packageWithMarkdown);

      const result = await service.getPackageReadme({ package_name: 'test' });

      expect(result.readme_content).toBe('# Test Package\n\nThis is markdown content');
    });

    it('should fallback to summary when description is not markdown', async () => {
      const packageWithTextDescription = {
        ...mockPackageInfo,
        info: {
          ...mockPackageInfo.info,
          description: 'Plain text description',
          description_content_type: 'text/plain',
          summary: 'Short summary',
        },
      };
      
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(packageWithTextDescription);

      const result = await service.getPackageReadme({ package_name: 'test' });

      expect(result.readme_content).toBe('Short summary');
    });

    it('should fallback to description when no content type specified', async () => {
      const packageWithoutContentType = {
        ...mockPackageInfo,
        info: {
          ...mockPackageInfo.info,
          description: 'Some description',
          description_content_type: undefined,
          summary: 'Short summary',
        },
      };
      
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(packageWithoutContentType);

      const result = await service.getPackageReadme({ package_name: 'test' });

      expect(result.readme_content).toBe('Short summary');
    });

    it('should use default message when no content available', async () => {
      const packageWithoutContent = {
        ...mockPackageInfo,
        info: {
          ...mockPackageInfo.info,
          description: undefined,
          summary: undefined,
        },
      };
      
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(packageWithoutContent);

      const result = await service.getPackageReadme({ package_name: 'test' });

      expect(result.readme_content).toBe('No README available for this package.');
    });

    it('should handle various markdown content types', async () => {
      const testCases = [
        'text/markdown',
        'text/markdown; charset=UTF-8',
        'text/x-markdown',
        'application/markdown',
        'TEXT/MARKDOWN', // case insensitive
      ];

      for (const contentType of testCases) {
        mockCache.get.mockReturnValue(null);
        const packageInfo = {
          ...mockPackageInfo,
          info: {
            ...mockPackageInfo.info,
            description_content_type: contentType,
          },
        };
        mockPypiClient.getPackageInfo.mockResolvedValue(packageInfo);

        const result = await service.getPackageReadme({ package_name: 'test' });

        expect(result.readme_content).toBe(packageInfo.info.description);
        vi.clearAllMocks();
      }
    });

    it('should call builders with correct package info', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);

      await service.getPackageReadme({ package_name: 'requests' });

      expect(mockPackageInfoBuilder.build).toHaveBeenCalledWith(mockPackageInfo);
      expect(mockInstallationInfoBuilder.build).toHaveBeenCalledWith(mockPackageInfo);
    });

    it('should clean README content', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);

      await service.getPackageReadme({ package_name: 'requests' });

      expect(mockReadmeService.cleanReadmeContent).toHaveBeenCalledWith(
        mockPackageInfo.info.description
      );
    });

    it('should handle errors during package info building', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);
      mockPackageInfoBuilder.build.mockImplementation(() => {
        throw new Error('Builder error');
      });

      const result = await service.getPackageReadme({ package_name: 'requests' });

      expect(result.exists).toBe(false);
    });

    it('should handle errors during installation info building', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);
      mockInstallationInfoBuilder.build.mockImplementation(() => {
        throw new Error('Builder error');
      });

      const result = await service.getPackageReadme({ package_name: 'requests' });

      expect(result.exists).toBe(false);
    });

    it('should handle errors during README cleaning', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);
      mockReadmeService.cleanReadmeContent.mockImplementation(() => {
        throw new Error('Cleaning error');
      });

      const result = await service.getPackageReadme({ package_name: 'requests' });

      expect(result.exists).toBe(false);
    });

    it('should handle errors during usage examples extraction', async () => {
      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);
      mockReadmeService.extractUsageExamples.mockImplementation(() => {
        throw new Error('Examples extraction error');
      });

      const result = await service.getPackageReadme({ 
        package_name: 'requests',
        include_examples: true 
      });

      expect(result.exists).toBe(false);
    });
  });

  describe('createNotFoundResponse', () => {
    it('should create proper not found response with version', () => {
      const result = (service as any).createNotFoundResponse('test-package', '1.0.0');

      expect(result).toEqual({
        package_name: 'test-package',
        version: '1.0.0',
        description: 'Package not found',
        readme_content: '',
        usage_examples: [],
        installation: {
          pip: 'pip install test-package',
          conda: 'conda install test-package',
          pipx: 'pipx install test-package',
        },
        basic_info: {
          name: 'test-package',
          version: '1.0.0',
          description: 'Package not found',
          author: 'Unknown',
          maintainer: undefined,
          keywords: [],
          classifiers: [],
          requires_python: undefined,
        },
        exists: false,
      });
    });

    it('should handle null version', () => {
      const result = (service as any).createNotFoundResponse('test-package', null);

      expect(result.version).toBe('latest');
      expect(result.basic_info.version).toBe('latest');
    });

    it('should handle undefined version', () => {
      const result = (service as any).createNotFoundResponse('test-package', undefined);

      expect(result.version).toBe('latest');
      expect(result.basic_info.version).toBe('latest');
    });
  });

  describe('extractReadmeContent', () => {
    it('should extract markdown content when available', () => {
      const packageInfo = {
        info: {
          description: '# Test README\n\nContent here',
          description_content_type: 'text/markdown',
          summary: 'Short summary',
        },
      };

      const result = (service as any).extractReadmeContent(packageInfo);

      expect(result).toBe('# Test README\n\nContent here');
    });

    it('should detect markdown content with MD suffix', () => {
      const packageInfo = {
        info: {
          description: '# Test README\n\nContent here',
          description_content_type: 'text/md',
          summary: 'Short summary',
        },
      };

      const result = (service as any).extractReadmeContent(packageInfo);

      expect(result).toBe('# Test README\n\nContent here');
    });

    it('should fallback to summary when description is not markdown', () => {
      const packageInfo = {
        info: {
          description: 'Plain text description',
          description_content_type: 'text/plain',
          summary: 'Short summary',
        },
      };

      const result = (service as any).extractReadmeContent(packageInfo);

      expect(result).toBe('Short summary');
    });

    it('should fallback to description when no content type', () => {
      const packageInfo = {
        info: {
          description: 'Some description',
          summary: 'Short summary',
        },
      };

      const result = (service as any).extractReadmeContent(packageInfo);

      expect(result).toBe('Short summary');
    });

    it('should use default message when no content available', () => {
      const packageInfo = {
        info: {},
      };

      const result = (service as any).extractReadmeContent(packageInfo);

      expect(result).toBe('No README available for this package.');
    });

    it('should prefer summary over empty description', () => {
      const packageInfo = {
        info: {
          description: '',
          summary: 'Short summary',
        },
      };

      const result = (service as any).extractReadmeContent(packageInfo);

      expect(result).toBe('Short summary');
    });
  });

  describe('getPackageInfo', () => {
    it('should get latest package info', async () => {
      const mockPackageInfo = { info: { name: 'test' } };
      mockPypiClient.getPackageInfo.mockResolvedValue(mockPackageInfo);

      const result = await (service as any).getPackageInfo('test', 'latest');

      expect(result).toBe(mockPackageInfo);
      expect(mockPypiClient.getPackageInfo).toHaveBeenCalledWith('test');
    });

    it('should get specific version info', async () => {
      const mockPackageInfo = { info: { name: 'test', version: '1.0.0' } };
      mockPypiClient.getVersionInfo.mockResolvedValue(mockPackageInfo);

      const result = await (service as any).getPackageInfo('test', '1.0.0');

      expect(result).toBe(mockPackageInfo);
      expect(mockPypiClient.getVersionInfo).toHaveBeenCalledWith('test', '1.0.0');
    });

    it('should return null when package not found', async () => {
      mockPypiClient.getPackageInfo.mockRejectedValue(new Error('Not found'));

      const result = await (service as any).getPackageInfo('nonexistent', 'latest');

      expect(result).toBeNull();
    });

    it('should return null when version not found', async () => {
      mockPypiClient.getVersionInfo.mockRejectedValue(new Error('Version not found'));

      const result = await (service as any).getPackageInfo('test', '999.999.999');

      expect(result).toBeNull();
    });
  });

  describe('edge cases and integration', () => {
    it('should handle package with very long content', async () => {
      const longContent = 'x'.repeat(100000);
      const packageInfo = {
        info: {
          name: 'long-package',
          version: '1.0.0',
          description: longContent,
          description_content_type: 'text/markdown',
          summary: 'Short summary',
        },
      };

      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(packageInfo);

      const result = await service.getPackageReadme({ package_name: 'long-package' });

      expect(result.exists).toBe(true);
      expect(result.readme_content).toBe(longContent);
    });

    it('should handle package with special characters', async () => {
      const packageName = 'special-chars-ñ_üöä';
      const packageInfo = {
        info: {
          name: packageName,
          version: '1.0.0',
          description: '# Special chars: ñ üöä 🚀',
          description_content_type: 'text/markdown',
          summary: 'Package with special characters',
        },
      };

      mockCache.get.mockReturnValue(null);
      mockPypiClient.getPackageInfo.mockResolvedValue(packageInfo);

      const result = await service.getPackageReadme({ package_name: packageName });

      expect(result.exists).toBe(true);
      expect(result.package_name).toBe(packageName);
      expect(result.readme_content).toBe('# Special chars: ñ üöä 🚀');
    });

    it('should handle concurrent requests for same package', async () => {
      mockCache.get.mockReturnValue(null);
      const packageInfo = { info: { name: 'test', version: '1.0.0', summary: 'Test' } };
      mockPypiClient.getPackageInfo.mockResolvedValue(packageInfo);

      const promises = Array.from({ length: 5 }, () => 
        service.getPackageReadme({ package_name: 'test' })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.exists).toBe(true);
        expect(result.package_name).toBe('test');
      });
    });
  });
});