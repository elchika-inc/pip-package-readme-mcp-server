import { logger } from '../../utils/logger.js';
import { cache, createCacheKey } from '../cache.js';
import { pypiClient } from '../pypi-api.js';
import { ReadmeService } from '../readme/index.js';
import { PackageInfoBuilder } from './package-info-builder.js';
import { InstallationInfoBuilder } from './installation-info-builder.js';
import {
  GetPackageReadmeParams,
  PackageReadmeResponse,
  PyPIPackageInfo,
} from '../../types/index.js';

export class PackageReadmeService {
  private readmeService = new ReadmeService();
  private packageInfoBuilder = new PackageInfoBuilder();
  private installationInfoBuilder = new InstallationInfoBuilder();

  async getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
    const { 
      package_name, 
      version = 'latest',
      include_examples = true 
    } = params;

    logger.info(`Fetching package README: ${package_name}@${version}`);

    // Check cache first
    const cacheKey = createCacheKey.packageReadme(package_name, version);
    const cached = cache.get<PackageReadmeResponse>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for package README: ${package_name}@${version}`);
      return cached;
    }

    try {
      // Get package info
      const packageInfo = await this.getPackageInfo(package_name, version);
      
      if (!packageInfo) {
        return this.createNotFoundResponse(package_name, version);
      }

      // Get README content
      const readmeContent = this.extractReadmeContent(packageInfo);
      const cleanedContent = this.readmeService.cleanReadmeContent(readmeContent);
      
      // Extract usage examples if requested
      const usageExamples = include_examples && cleanedContent 
        ? this.readmeService.extractUsageExamples(cleanedContent)
        : [];

      // Build response
      const response: PackageReadmeResponse = {
        package_name,
        version: packageInfo.info.version,
        description: packageInfo.info.summary || '',
        readme_content: cleanedContent,
        usage_examples: usageExamples,
        installation: this.installationInfoBuilder.build(packageInfo),
        basic_info: this.packageInfoBuilder.build(packageInfo),
        exists: true,
      };

      // Cache the response
      cache.set(cacheKey, response);
      logger.info(`Successfully fetched README for ${package_name}@${packageInfo.info.version}`);

      return response;

    } catch (error) {
      logger.error(`Failed to fetch package README: ${package_name}@${version}`, { error });
      return this.createNotFoundResponse(package_name, version);
    }
  }

  private async getPackageInfo(packageName: string, version: string): Promise<PyPIPackageInfo | null> {
    try {
      logger.debug(`Getting package info for: ${packageName}@${version}`);
      return version === 'latest' 
        ? await pypiClient.getPackageInfo(packageName)
        : await pypiClient.getVersionInfo(packageName, version);
    } catch (error) {
      logger.debug(`Package not found: ${packageName}`, { error });
      return null;
    }
  }

  private extractReadmeContent(packageInfo: PyPIPackageInfo): string {
    // Try to get README from PyPI description
    if (packageInfo.info.description && packageInfo.info.description_content_type) {
      const contentType = packageInfo.info.description_content_type.toLowerCase();
      if (contentType.includes('markdown') || contentType.includes('md')) {
        logger.debug(`Using README from PyPI description`);
        return packageInfo.info.description;
      }
    }

    // Fallback to summary or description
    return packageInfo.info.summary || 
           packageInfo.info.description || 
           'No README available for this package.';
  }

  private createNotFoundResponse(packageName: string, version: string): PackageReadmeResponse {
    return {
      package_name: packageName,
      version: version || 'latest',
      description: 'Package not found',
      readme_content: '',
      usage_examples: [],
      installation: {
        pip: `pip install ${packageName}`,
        conda: `conda install ${packageName}`,
        pipx: `pipx install ${packageName}`,
      },
      basic_info: {
        name: packageName,
        version: version || 'latest',
        description: 'Package not found',
        author: 'Unknown',
        maintainer: undefined,
        keywords: [],
        classifiers: [],
        requires_python: undefined,
      },
      exists: false,
    };
  }
}