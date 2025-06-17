import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import { 
  PyPIPackageInfo, 
  PyPISearchResponse,
  PyPISimpleResponse,
  VersionNotFoundError,
  PackageNotFoundError,
} from '../types/index.js';

export class PyPIClient {
  private readonly jsonApiUrl = 'https://pypi.org/pypi';
  private readonly simpleApiUrl = 'https://pypi.org/simple';
  private readonly timeout: number;

  constructor(timeout?: number) {
    this.timeout = timeout || 30000;
  }

  async getPackageInfo(packageName: string): Promise<PyPIPackageInfo> {
    const url = `${this.jsonApiUrl}/${encodeURIComponent(packageName)}/json`;
    
    return withRetry(async () => {
      logger.debug(`Fetching package info: ${packageName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'pip-package-readme-mcp/1.0.0',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new PackageNotFoundError(packageName);
          }
          handleHttpError(response.status, response, `PyPI for package ${packageName}`);
        }

        const data = await response.json() as PyPIPackageInfo;
        logger.debug(`Successfully fetched package info: ${packageName}`);
        return data;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `PyPI for package ${packageName}`);
        }
        if (error instanceof PackageNotFoundError) {
          throw error;
        }
        handleApiError(error, `PyPI for package ${packageName}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `PyPI getPackageInfo(${packageName})`);
  }

  async getVersionInfo(packageName: string, version: string): Promise<PyPIPackageInfo> {
    // For specific version, we can use the version-specific endpoint
    if (version === 'latest') {
      return this.getPackageInfo(packageName);
    }

    const url = `${this.jsonApiUrl}/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/json`;
    
    return withRetry(async () => {
      logger.debug(`Fetching version info: ${packageName}@${version}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'pip-package-readme-mcp/1.0.0',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new VersionNotFoundError(packageName, version);
          }
          handleHttpError(response.status, response, `PyPI for package ${packageName}@${version}`);
        }

        const data = await response.json() as PyPIPackageInfo;
        logger.debug(`Successfully fetched version info: ${packageName}@${version}`);
        return data;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `PyPI for package ${packageName}@${version}`);
        }
        if (error instanceof VersionNotFoundError) {
          throw error;
        }
        handleApiError(error, `PyPI for package ${packageName}@${version}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `PyPI getVersionInfo(${packageName}@${version})`);
  }

  async searchPackages(
    query: string,
    limit: number = 20
  ): Promise<PyPISearchResponse> {
    // Note: PyPI deprecated the search endpoint in 2018, but we'll implement a fallback
    // using the XML-RPC API or alternative methods
    // For now, we'll use a simple approach with the available data
    
    logger.warn('PyPI search API is deprecated. Using alternative search method.');
    
    // Try to search using a workaround approach
    // This is a simplified implementation - in reality, you might want to use
    // external services like libraries.io or implement a custom search
    return this.searchPackagesWorkaround(query, limit);
  }

  private async searchPackagesWorkaround(
    query: string,
    limit: number
  ): Promise<PyPISearchResponse> {
    // This is a placeholder implementation
    // In a real implementation, you might:
    // 1. Use libraries.io API
    // 2. Use GitHub search for Python packages
    // 3. Maintain your own search index
    // 4. Use third-party PyPI search services
    
    logger.debug(`Attempting package search workaround for: ${query}`);
    
    // For demonstration, we'll return an empty result
    // This would need to be replaced with a real search implementation
    return {
      info: {
        page: 1,
        pages: 1,
        per_page: limit,
        total: 0,
      },
      results: [],
    };
  }

  async getSimpleApiInfo(packageName: string): Promise<PyPISimpleResponse> {
    const url = `${this.simpleApiUrl}/${encodeURIComponent(packageName)}/`;
    
    return withRetry(async () => {
      logger.debug(`Fetching simple API info: ${packageName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/vnd.pypi.simple.v1+json',
            'User-Agent': 'pip-package-readme-mcp/1.0.0',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new PackageNotFoundError(packageName);
          }
          handleHttpError(response.status, response, `PyPI Simple API for package ${packageName}`);
        }

        const data = await response.json() as PyPISimpleResponse;
        logger.debug(`Successfully fetched simple API info: ${packageName}`);
        return data;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `PyPI Simple API for package ${packageName}`);
        }
        if (error instanceof PackageNotFoundError) {
          throw error;
        }
        handleApiError(error, `PyPI Simple API for package ${packageName}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `PyPI getSimpleApiInfo(${packageName})`);
  }

  // Helper method to get available versions from simple API
  async getAvailableVersions(packageName: string): Promise<string[]> {
    try {
      const simpleInfo = await this.getSimpleApiInfo(packageName);
      
      if (simpleInfo.versions) {
        return simpleInfo.versions;
      }

      // Extract versions from filenames if versions array is not available
      const versions = new Set<string>();
      for (const file of simpleInfo.files) {
        // Extract version from filename (simplified approach)
        const match = file.filename.match(/-([0-9]+(?:\.[0-9]+)*(?:[a-zA-Z0-9\-\.]*)?)\./);
        if (match) {
          versions.add(match[1]);
        }
      }

      return Array.from(versions).sort();
    } catch (error) {
      logger.warn(`Failed to get available versions for ${packageName}`, { error });
      return [];
    }
  }

  // Get download statistics from PyPI JSON API
  async getDownloadStats(packageName: string): Promise<{
    last_day: number;
    last_week: number;
    last_month: number;
  }> {
    try {
      // Get package info which includes download stats
      const packageInfo = await this.getPackageInfo(packageName);
      
      // Extract download statistics from the package info
      if (packageInfo.info.downloads) {
        logger.debug(`Found download stats for ${packageName}`, packageInfo.info.downloads);
        return {
          last_day: packageInfo.info.downloads.last_day || 0,
          last_week: packageInfo.info.downloads.last_week || 0,
          last_month: packageInfo.info.downloads.last_month || 0,
        };
      }
      
      logger.debug(`No download stats available for ${packageName}`);
      return {
        last_day: 0,
        last_week: 0,
        last_month: 0,
      };
    } catch (error) {
      logger.warn(`Failed to get download stats for ${packageName}`, { error });
      return {
        last_day: 0,
        last_week: 0,
        last_month: 0,
      };
    }
  }
}

export const pypiClient = new PyPIClient();