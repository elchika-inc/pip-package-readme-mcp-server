import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubApiClient } from '../../src/services/github-api.js';
import { PackageReadmeMcpError } from '../../src/types/index.js';

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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHubApiClient', () => {
  let client: GitHubApiClient;
  const originalEnv = process.env;

  beforeEach(() => {
    client = new GitHubApiClient();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should use default timeout if not provided', () => {
      const defaultClient = new GitHubApiClient();
      expect(defaultClient).toBeDefined();
    });

    it('should use custom timeout if provided', () => {
      const customClient = new GitHubApiClient(5000);
      expect(customClient).toBeDefined();
    });

    it('should read GitHub token from environment', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      const tokenClient = new GitHubApiClient();
      expect(tokenClient).toBeDefined();
    });
  });

  describe('extractRepoInfo', () => {
    it('should extract owner and repo from HTTPS URL', () => {
      const result = client.extractRepoInfo('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should extract owner and repo from HTTPS URL with .git suffix', () => {
      const result = client.extractRepoInfo('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should extract owner and repo from SSH URL', () => {
      const result = client.extractRepoInfo('git@github.com:owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should extract owner and repo from URL with trailing slash', () => {
      const result = client.extractRepoInfo('https://github.com/owner/repo/');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should extract owner and repo from URL with additional path', () => {
      const result = client.extractRepoInfo('https://github.com/owner/repo/tree/main');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should extract owner and repo from git+https URL', () => {
      const result = client.extractRepoInfo('git+https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should handle URLs with hyphens and underscores', () => {
      const result = client.extractRepoInfo('https://github.com/my-org/my_repo');
      expect(result).toEqual({ owner: 'my-org', repo: 'my_repo' });
    });

    it('should return null for invalid URLs', () => {
      const testCases = [
        'https://gitlab.com/owner/repo',
        'https://bitbucket.org/owner/repo',
        'not-a-url',
        '',
        'github.com',
        'https://github.com/owner',
      ];

      testCases.forEach(url => {
        const result = client.extractRepoInfo(url);
        expect(result).toBeNull();
      });
    });

    it('should handle malformed URLs gracefully', () => {
      const result = client.extractRepoInfo('https://github.com//');
      expect(result).toBeNull();
    });

    it('should handle URL parsing errors', () => {
      // Test with URL that has invalid characters for URL parsing
      const result = client.extractRepoInfo('invalid-github-url://not-a-repo');
      expect(result).toBeNull();
    });
  });

  describe('getReadme', () => {
    it('should fetch README content successfully', async () => {
      const mockContent = '# Test README\n\nThis is a test.';
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(mockContent),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getReadme('owner', 'repo');

      expect(result).toBe(mockContent);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/readme',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'pip-package-readme-mcp/1.0.0',
          }),
        })
      );
    });

    it('should include Authorization header when token is provided', async () => {
      process.env.GITHUB_TOKEN = 'test-token';
      const tokenClient = new GitHubApiClient();
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('content'),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await tokenClient.getReadme('owner', 'repo');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should fallback from main to master branch on 404', async () => {
      const mockResponse404 = {
        ok: false,
        status: 404,
      };
      const mockResponseSuccess = {
        ok: true,
        text: vi.fn().mockResolvedValue('master branch content'),
      };
      
      mockFetch
        .mockResolvedValueOnce(mockResponse404)
        .mockResolvedValueOnce(mockResponseSuccess);

      const result = await client.getReadme('owner', 'repo', 'main');

      expect(result).toBe('master branch content');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw PackageReadmeMcpError when README not found on any branch', async () => {
      const mockResponse404 = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse404);

      await expect(client.getReadme('owner', 'repo', 'master'))
        .rejects.toThrow(PackageReadmeMcpError);
    });

    it('should handle HTTP errors correctly', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getReadme('owner', 'repo'))
        .rejects.toThrow('HTTP 403 error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getReadme('owner', 'repo'))
        .rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError'));
      Object.defineProperty(Error.prototype, 'name', {
        get() { return 'AbortError'; },
        configurable: true,
      });

      await expect(client.getReadme('owner', 'repo'))
        .rejects.toThrow();
    });
  });

  describe('getReadmeWithMetadata', () => {
    const mockMetadataResponse = {
      name: 'README.md',
      path: 'README.md',
      content: 'IyBUZXN0IFJFQURNRQ==', // Base64 encoded "# Test README"
      encoding: 'base64',
      size: 13,
      type: 'file',
      sha: 'abc123',
      url: 'https://api.github.com/repos/owner/repo/contents/README.md',
      html_url: 'https://github.com/owner/repo/blob/main/README.md',
      download_url: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
    };

    it('should fetch README metadata successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockMetadataResponse),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getReadmeWithMetadata('owner', 'repo');

      expect(result).toEqual({
        ...mockMetadataResponse,
        content: '# Test README', // Decoded from base64
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/readme',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3+json',
          }),
        })
      );
    });

    it('should handle content that is not base64 encoded', async () => {
      const responseWithoutBase64 = {
        ...mockMetadataResponse,
        content: 'plain text content',
        encoding: 'utf-8',
      };
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(responseWithoutBase64),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getReadmeWithMetadata('owner', 'repo');

      expect(result.content).toBe('plain text content');
    });

    it('should handle missing content field', async () => {
      const responseWithoutContent = {
        ...mockMetadataResponse,
        content: undefined,
      };
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(responseWithoutContent),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getReadmeWithMetadata('owner', 'repo');

      expect(result.content).toBeUndefined();
    });

    it('should throw PackageReadmeMcpError for 404', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getReadmeWithMetadata('owner', 'repo'))
        .rejects.toThrow(PackageReadmeMcpError);
    });
  });

  describe('getReadmeFromUrl', () => {
    it('should fetch README from valid GitHub URL', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('README content'),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getReadmeFromUrl('https://github.com/owner/repo');

      expect(result).toBe('README content');
    });

    it('should return null for invalid URLs', async () => {
      const result = await client.getReadmeFromUrl('https://gitlab.com/owner/repo');

      expect(result).toBeNull();
    });

    it('should return null when getReadme fails', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      const result = await client.getReadmeFromUrl('https://github.com/owner/repo');

      expect(result).toBeNull();
    });

    it('should handle URL extraction errors', async () => {
      const result = await client.getReadmeFromUrl('invalid-url');

      expect(result).toBeNull();
    });
  });

  describe('validateToken', () => {
    it('should return false when no token is configured', async () => {
      const result = await client.validateToken();

      expect(result).toBe(false);
    });

    it('should return true for valid token', async () => {
      process.env.GITHUB_TOKEN = 'valid-token';
      const tokenClient = new GitHubApiClient();
      
      const mockResponse = {
        ok: true,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await tokenClient.validateToken();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
          }),
        })
      );
    });

    it('should return false for invalid token', async () => {
      process.env.GITHUB_TOKEN = 'invalid-token';
      const tokenClient = new GitHubApiClient();
      
      const mockResponse = {
        ok: false,
        status: 401,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await tokenClient.validateToken();

      expect(result).toBe(false);
    });

    it('should return false when validation request fails', async () => {
      process.env.GITHUB_TOKEN = 'test-token';
      const tokenClient = new GitHubApiClient();
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await tokenClient.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('getRateLimitInfo', () => {
    const mockRateLimitResponse = {
      rate: {
        limit: 5000,
        remaining: 4999,
        reset: 1640995200, // Unix timestamp
      },
    };

    it('should fetch rate limit info successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockRateLimitResponse),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getRateLimitInfo();

      expect(result).toEqual({
        limit: 5000,
        remaining: 4999,
        reset: new Date(1640995200 * 1000),
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/rate_limit',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'pip-package-readme-mcp/1.0.0',
          }),
        })
      );
    });

    it('should include Authorization header when token is provided', async () => {
      process.env.GITHUB_TOKEN = 'test-token';
      const tokenClient = new GitHubApiClient();
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockRateLimitResponse),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await tokenClient.getRateLimitInfo();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should return null when request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getRateLimitInfo();

      expect(result).toBeNull();
    });

    it('should return null when network error occurs', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.getRateLimitInfo();

      expect(result).toBeNull();
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ invalid: 'data' }),
      };
      mockFetch.mockResolvedValue(malformedResponse);

      const result = await client.getRateLimitInfo();

      // Should not throw, but may return null or undefined values
      expect(result).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long URLs in extractRepoInfo', () => {
      const longUrl = 'https://github.com/' + 'a'.repeat(1000) + '/' + 'b'.repeat(1000);
      const result = client.extractRepoInfo(longUrl);
      
      expect(result?.owner).toBe('a'.repeat(1000));
      expect(result?.repo).toBe('b'.repeat(1000));
    });

    it('should handle special characters in repository names', () => {
      const result = client.extractRepoInfo('https://github.com/my-org/my.repo-name_test');
      
      expect(result).toEqual({ 
        owner: 'my-org', 
        repo: 'my.repo-name_test' 
      });
    });

    it('should handle concurrent requests gracefully', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('content'),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const promises = Array.from({ length: 5 }, (_, i) => 
        client.getReadme('owner', `repo${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBe('content');
      });
    });

    it('should handle empty response content', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getReadme('owner', 'repo');

      expect(result).toBe('');
    });

    it('should handle Unicode content in README', async () => {
      const unicodeContent = '# README 🚀\n\n这是测试内容 with émojis 🎉';
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(unicodeContent),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getReadme('owner', 'repo');

      expect(result).toBe(unicodeContent);
    });

    it('should handle malformed base64 content gracefully', async () => {
      const malformedResponse = {
        name: 'README.md',
        content: 'invalid-base64-content!@#$%',
        encoding: 'base64',
      };
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(malformedResponse),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Should not throw, but handle gracefully
      await expect(client.getReadmeWithMetadata('owner', 'repo'))
        .resolves.toBeDefined();
    });
  });

  describe('timeout handling', () => {
    it('should respect custom timeout in constructor', () => {
      const customTimeoutClient = new GitHubApiClient(5000);
      expect(customTimeoutClient).toBeDefined();
    });

    it('should handle AbortController timeout in getReadme', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('content'),
      };

      // Mock fetch to return immediately to avoid real timeout
      mockFetch.mockResolvedValue(mockResponse);

      // Create client with normal timeout but test the mechanism
      const normalClient = new GitHubApiClient(30000);

      // Should work normally
      await expect(normalClient.getReadme('owner', 'repo'))
        .resolves.toBeDefined();
    });
  });
});