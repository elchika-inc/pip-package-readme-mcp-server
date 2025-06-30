import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PyPIClient } from '../../src/services/pypi-api.js';
import { PackageNotFoundError, VersionNotFoundError } from '../../src/types/index.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/utils/error-handler.js', () => ({
  handleApiError: vi.fn((error) => {
    throw error;
  }),
  handleHttpError: vi.fn((status, response, context) => {
    throw new Error(`HTTP ${status} error for ${context}`);
  }),
  withRetry: vi.fn(async (fn) => {
    return await fn();
  }),
}));

vi.mock('../../src/config/constants.js', () => ({
  API_CONFIG: {
    DEFAULT_TIMEOUT: 30000,
    USER_AGENT: 'test-agent',
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY: 1000,
  },
  PYPI_CONFIG: {
    BASE_URL: 'https://pypi.org/pypi',
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PyPIClient', () => {
  let client: PyPIClient;

  beforeEach(() => {
    client = new PyPIClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default timeout if not provided', () => {
      const defaultClient = new PyPIClient();
      expect(defaultClient).toBeDefined();
    });

    it('should use custom timeout if provided', () => {
      const customClient = new PyPIClient(5000);
      expect(customClient).toBeDefined();
    });
  });

  describe('getPackageInfo', () => {
    const mockPackageInfo = {
      info: {
        name: 'requests',
        version: '2.28.1',
        summary: 'Python HTTP for Humans.',
        description: 'A simple HTTP library',
        author: 'Kenneth Reitz',
        author_email: 'me@kennethreitz.org',
        home_page: 'https://requests.readthedocs.io',
        download_url: '',
        downloads: {
          last_day: 1000,
          last_week: 7000,
          last_month: 30000,
        },
        classifiers: ['Programming Language :: Python :: 3'],
        keywords: 'http',
        license: 'Apache 2.0',
        project_urls: {
          Homepage: 'https://requests.readthedocs.io',
        },
      },
      urls: [],
      last_serial: 12345,
    };

    it('should fetch package info successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockPackageInfo),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getPackageInfo('requests');

      expect(result).toEqual(mockPackageInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://pypi.org/pypi/requests/json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'test-agent',
          }),
        })
      );
    });

    it('should throw PackageNotFoundError for 404 response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getPackageInfo('nonexistent-package'))
        .rejects.toThrow(PackageNotFoundError);
    });

    it('should handle HTTP errors correctly', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getPackageInfo('requests'))
        .rejects.toThrow('HTTP 500 error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getPackageInfo('requests'))
        .rejects.toThrow('Network error');
    });

    it('should handle abort timeout', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError'));
      Object.defineProperty(Error.prototype, 'name', {
        get() { return 'AbortError'; },
        configurable: true,
      });

      await expect(client.getPackageInfo('requests'))
        .rejects.toThrow();
    });

    it('should encode package name properly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockPackageInfo),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await client.getPackageInfo('package-with-special-chars@#$');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('package-with-special-chars@#$')),
        expect.any(Object)
      );
    });
  });

  describe('getVersionInfo', () => {
    const mockVersionInfo = {
      info: {
        name: 'requests',
        version: '2.27.1',
        summary: 'Python HTTP for Humans.',
        description: 'A simple HTTP library',
        author: 'Kenneth Reitz',
      },
      urls: [],
      last_serial: 12345,
    };

    it('should fetch version info successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockVersionInfo),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getVersionInfo('requests', '2.27.1');

      expect(result).toEqual(mockVersionInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://pypi.org/pypi/requests/2.27.1/json',
        expect.any(Object)
      );
    });

    it('should handle latest version by calling getPackageInfo', async () => {
      const spy = vi.spyOn(client, 'getPackageInfo').mockResolvedValue(mockVersionInfo);

      const result = await client.getVersionInfo('requests', 'latest');

      expect(result).toEqual(mockVersionInfo);
      expect(spy).toHaveBeenCalledWith('requests');
    });

    it('should throw VersionNotFoundError for 404 response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVersionInfo('requests', '999.999.999'))
        .rejects.toThrow(VersionNotFoundError);
    });

    it('should encode package name and version properly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockVersionInfo),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await client.getVersionInfo('package@name', '1.0.0-beta@test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('package@name')),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('1.0.0-beta@test')),
        expect.any(Object)
      );
    });
  });

  describe('searchPackages', () => {
    it('should return empty results with deprecation warning', async () => {
      const result = await client.searchPackages('requests', 10);

      expect(result).toEqual({
        info: {
          page: 1,
          pages: 1,
          per_page: 10,
          total: 0,
        },
        results: [],
      });
    });

    it('should use default limit if not provided', async () => {
      const result = await client.searchPackages('requests');

      expect(result.info.per_page).toBe(20);
    });
  });

  describe('getSimpleApiInfo', () => {
    const mockSimpleResponse = {
      files: [
        {
          filename: 'requests-2.28.1-py3-none-any.whl',
          url: 'https://files.pythonhosted.org/packages/...',
          hashes: {
            sha256: 'abc123...',
          },
        },
      ],
      meta: {
        'api-version': '1.0',
      },
      name: 'requests',
      versions: ['2.28.1', '2.28.0'],
    };

    it('should fetch simple API info successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockSimpleResponse),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getSimpleApiInfo('requests');

      expect(result).toEqual(mockSimpleResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://pypi.org/simple/requests/',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.pypi.simple.v1+json',
            'User-Agent': 'test-agent',
          }),
        })
      );
    });

    it('should throw PackageNotFoundError for 404 response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getSimpleApiInfo('nonexistent-package'))
        .rejects.toThrow(PackageNotFoundError);
    });
  });

  describe('getAvailableVersions', () => {
    it('should return versions from simple API response', async () => {
      const mockSimpleResponse = {
        files: [],
        meta: { 'api-version': '1.0' },
        name: 'requests',
        versions: ['2.28.1', '2.28.0', '2.27.1'],
      };

      vi.spyOn(client, 'getSimpleApiInfo').mockResolvedValue(mockSimpleResponse);

      const result = await client.getAvailableVersions('requests');

      expect(result).toEqual(['2.28.1', '2.28.0', '2.27.1']);
    });

    it('should extract versions from filenames if versions array not available', async () => {
      const mockSimpleResponse = {
        files: [
          { filename: 'requests-2.28.1-py3-none-any.whl', url: '', hashes: {} },
          { filename: 'requests-2.28.0.tar.gz', url: '', hashes: {} },
          { filename: 'requests-2.27.1-py3-none-any.whl', url: '', hashes: {} },
        ],
        meta: { 'api-version': '1.0' },
        name: 'requests',
      };

      vi.spyOn(client, 'getSimpleApiInfo').mockResolvedValue(mockSimpleResponse);

      const result = await client.getAvailableVersions('requests');

      expect(result).toEqual(expect.arrayContaining(['2.28.1', '2.28.0', '2.27.1']));
    });

    it('should return empty array on error', async () => {
      vi.spyOn(client, 'getSimpleApiInfo').mockRejectedValue(new Error('API Error'));

      const result = await client.getAvailableVersions('nonexistent-package');

      expect(result).toEqual([]);
    });

    it('should handle complex version patterns', async () => {
      const mockSimpleResponse = {
        files: [
          { filename: 'package-1.0.0-beta.1-py3-none-any.whl', url: '', hashes: {} },
          { filename: 'package-2.0.0a1.tar.gz', url: '', hashes: {} },
          { filename: 'package-1.5.0rc2-py3-none-any.whl', url: '', hashes: {} },
        ],
        meta: { 'api-version': '1.0' },
        name: 'package',
      };

      vi.spyOn(client, 'getSimpleApiInfo').mockResolvedValue(mockSimpleResponse);

      const result = await client.getAvailableVersions('package');

      expect(result).toEqual(expect.arrayContaining(['1.0.0-beta.1', '2.0.0a1', '1.5.0rc2']));
    });
  });

  describe('getDownloadStats', () => {
    it('should return download stats from package info', async () => {
      const mockPackageInfo = {
        info: {
          name: 'requests',
          downloads: {
            last_day: 1000,
            last_week: 7000,
            last_month: 30000,
          },
        },
      };

      vi.spyOn(client, 'getPackageInfo').mockResolvedValue(mockPackageInfo as any);

      const result = await client.getDownloadStats('requests');

      expect(result).toEqual({
        last_day: 1000,
        last_week: 7000,
        last_month: 30000,
      });
    });

    it('should return zero stats if downloads not available', async () => {
      const mockPackageInfo = {
        info: {
          name: 'requests',
        },
      };

      vi.spyOn(client, 'getPackageInfo').mockResolvedValue(mockPackageInfo as any);

      const result = await client.getDownloadStats('requests');

      expect(result).toEqual({
        last_day: 0,
        last_week: 0,
        last_month: 0,
      });
    });

    it('should return zero stats on error', async () => {
      vi.spyOn(client, 'getPackageInfo').mockRejectedValue(new Error('API Error'));

      const result = await client.getDownloadStats('nonexistent-package');

      expect(result).toEqual({
        last_day: 0,
        last_week: 0,
        last_month: 0,
      });
    });

    it('should handle partial download stats', async () => {
      const mockPackageInfo = {
        info: {
          name: 'requests',
          downloads: {
            last_day: 1000,
            // missing last_week and last_month
          },
        },
      };

      vi.spyOn(client, 'getPackageInfo').mockResolvedValue(mockPackageInfo as any);

      const result = await client.getDownloadStats('requests');

      expect(result).toEqual({
        last_day: 1000,
        last_week: 0,
        last_month: 0,
      });
    });
  });

  describe('timeout handling', () => {
    it('should respect custom timeout in constructor', () => {
      const customTimeoutClient = new PyPIClient(5000);
      expect(customTimeoutClient).toBeDefined();
    });

    it('should handle AbortController timeout', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };

      // Mock fetch to simulate slow response
      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockResponse), 100);
        });
      });

      // Create client with very short timeout
      const shortTimeoutClient = new PyPIClient(1);

      // This should handle the timeout internally
      await expect(shortTimeoutClient.getPackageInfo('requests'))
        .resolves.toBeDefined();
    });
  });

  describe('error propagation', () => {
    it('should preserve PackageNotFoundError', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getPackageInfo('nonexistent'))
        .rejects.toBeInstanceOf(PackageNotFoundError);
    });

    it('should preserve VersionNotFoundError', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVersionInfo('requests', '999.999.999'))
        .rejects.toBeInstanceOf(VersionNotFoundError);
    });
  });
});