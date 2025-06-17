import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import { GitHubReadmeResponse, PackageReadmeMcpError } from '../types/index.js';

export class GitHubApiClient {
  private readonly baseUrl = 'https://api.github.com';
  private readonly timeout: number;
  private readonly token?: string;

  constructor(timeout?: number) {
    this.timeout = timeout || 30000;
    this.token = process.env.GITHUB_TOKEN;
  }

  /**
   * Extract GitHub repository information from various URL formats
   */
  extractRepoInfo(repoUrl: string): { owner: string; repo: string } | null {
    try {
      // Handle different GitHub URL formats
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?(?:\/.*)?$/,
        /git@github\.com:([^\/]+)\/([^\/]+)(?:\.git)?$/,
        /github\.com\/([^\/]+)\/([^\/]+)$/,
      ];

      let cleanUrl = repoUrl;
      
      // Remove protocol and clean up URL
      cleanUrl = cleanUrl.replace(/^https?:\/\//, '');
      cleanUrl = cleanUrl.replace(/^git\+https?:\/\//, '');
      cleanUrl = cleanUrl.replace(/\.git$/, '');
      cleanUrl = cleanUrl.replace(/\/$/, '');

      for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2],
          };
        }
      }

      logger.warn(`Could not extract repo info from URL: ${repoUrl}`);
      return null;
    } catch (error) {
      logger.error(`Error extracting repo info from URL: ${repoUrl}`, { error });
      return null;
    }
  }

  /**
   * Fetch README content from GitHub repository
   */
  async getReadme(owner: string, repo: string, branch: string = 'main'): Promise<string> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/readme`;
    
    return withRetry(async () => {
      logger.debug(`Fetching README from GitHub: ${owner}/${repo}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'pip-package-readme-mcp/1.0.0',
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
          signal: controller.signal,
          headers,
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Try alternative branch names
            if (branch === 'main') {
              logger.debug(`README not found on main branch, trying master`);
              return this.getReadme(owner, repo, 'master');
            }
            throw new PackageReadmeMcpError(
              `README not found in repository ${owner}/${repo}`,
              'README_NOT_FOUND',
              404
            );
          }
          handleHttpError(response.status, response, `GitHub API for ${owner}/${repo}`);
        }

        const content = await response.text();
        logger.debug(`Successfully fetched README from GitHub: ${owner}/${repo}`);
        return content;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `GitHub API for ${owner}/${repo}`);
        }
        if (error instanceof PackageReadmeMcpError) {
          throw error;
        }
        handleApiError(error, `GitHub API for ${owner}/${repo}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `GitHub getReadme(${owner}/${repo})`);
  }

  /**
   * Get README with metadata (including encoding information)
   */
  async getReadmeWithMetadata(owner: string, repo: string): Promise<GitHubReadmeResponse> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/readme`;
    
    return withRetry(async () => {
      logger.debug(`Fetching README metadata from GitHub: ${owner}/${repo}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'pip-package-readme-mcp/1.0.0',
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
          signal: controller.signal,
          headers,
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new PackageReadmeMcpError(
              `README not found in repository ${owner}/${repo}`,
              'README_NOT_FOUND',
              404
            );
          }
          handleHttpError(response.status, response, `GitHub API for ${owner}/${repo}`);
        }

        const data = await response.json() as GitHubReadmeResponse;
        
        // Decode base64 content if present
        if (data.content && data.encoding === 'base64') {
          data.content = Buffer.from(data.content, 'base64').toString('utf-8');
        }
        
        logger.debug(`Successfully fetched README metadata from GitHub: ${owner}/${repo}`);
        return data;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `GitHub API for ${owner}/${repo}`);
        }
        if (error instanceof PackageReadmeMcpError) {
          throw error;
        }
        handleApiError(error, `GitHub API for ${owner}/${repo}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `GitHub getReadmeWithMetadata(${owner}/${repo})`);
  }

  /**
   * Get README content from repository URL
   */
  async getReadmeFromUrl(repoUrl: string): Promise<string | null> {
    try {
      const repoInfo = this.extractRepoInfo(repoUrl);
      if (!repoInfo) {
        logger.warn(`Could not extract repository info from URL: ${repoUrl}`);
        return null;
      }

      return await this.getReadme(repoInfo.owner, repoInfo.repo);
    } catch (error) {
      logger.error(`Failed to fetch README from URL: ${repoUrl}`, { error });
      return null;
    }
  }

  /**
   * Check if GitHub token is configured and valid
   */
  async validateToken(): Promise<boolean> {
    if (!this.token) {
      logger.debug('No GitHub token configured');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'User-Agent': 'pip-package-readme-mcp/1.0.0',
        },
      });

      if (response.ok) {
        logger.debug('GitHub token is valid');
        return true;
      } else {
        logger.warn('GitHub token appears to be invalid', { status: response.status });
        return false;
      }
    } catch (error) {
      logger.error('Error validating GitHub token', { error });
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  } | null> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'pip-package-readme-mcp/1.0.0',
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseUrl}/rate_limit`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json() as any;
        return {
          limit: data.rate.limit,
          remaining: data.rate.remaining,
          reset: new Date(data.rate.reset * 1000),
        };
      }
    } catch (error) {
      logger.error('Error fetching rate limit info', { error });
    }

    return null;
  }
}

export const githubApi = new GitHubApiClient();