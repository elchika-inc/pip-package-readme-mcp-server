import { logger } from '../utils/logger.js';
import { validatePackageName } from '../utils/validators.js';
import { cache, createCacheKey } from '../services/cache.js';
import { pypiClient } from '../services/pypi-api.js';
import {
  GetPackageInfoParams,
  PackageInfoResponse,
  RepositoryInfo,
  AuthorInfo,
} from '../types/index.js';

export async function getPackageInfo(params: GetPackageInfoParams): Promise<PackageInfoResponse> {
  const { 
    package_name, 
    include_dependencies = true, 
    include_dev_dependencies = false 
  } = params;

  logger.info(`Fetching package info: ${package_name}`);

  // Validate inputs
  validatePackageName(package_name);

  // Check cache first
  const cacheKey = createCacheKey.packageInfo(package_name, 'latest');
  const cached = cache.get<PackageInfoResponse>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for package info: ${package_name}`);
    return cached;
  }

  try {
    // Get package info from PyPI
    const packageInfo = await pypiClient.getPackageInfo(package_name);
    
    // Extract download statistics from the package info
    const downloadStats = packageInfo.info.downloads || {
      last_day: 0,
      last_week: 0,
      last_month: 0,
    };

    // Extract author information
    let authorString = 'Unknown';
    if (packageInfo.info.author) {
      authorString = packageInfo.info.author;
      if (packageInfo.info.author_email) {
        authorString += ` <${packageInfo.info.author_email}>`;
      }
    }

    // Extract maintainer information
    let maintainerString: string | undefined;
    if (packageInfo.info.maintainer) {
      maintainerString = packageInfo.info.maintainer;
      if (packageInfo.info.maintainer_email) {
        maintainerString += ` <${packageInfo.info.maintainer_email}>`;
      }
    }

    // Extract repository information
    let repository: RepositoryInfo | undefined;
    if (packageInfo.info.project_urls) {
      // Look for repository-related URLs
      const repoKeys = ['Repository', 'Source', 'Source Code', 'Code', 'GitHub', 'GitLab', 'Bitbucket'];
      for (const key of repoKeys) {
        if (packageInfo.info.project_urls[key]) {
          repository = {
            type: 'git',
            url: packageInfo.info.project_urls[key],
          };
          break;
        }
      }
    }

    // If no repository found in project_urls, try home_page
    if (!repository && packageInfo.info.home_page) {
      const homePageUrl = packageInfo.info.home_page;
      if (homePageUrl.includes('github.com') || 
          homePageUrl.includes('gitlab.com') || 
          homePageUrl.includes('bitbucket.org')) {
        repository = {
          type: 'git',
          url: homePageUrl,
        };
      }
    }

    // Extract dependencies (PyPI doesn't provide direct dependency lists like npm)
    let dependencies: string[] | undefined;
    let devDependencies: string[] | undefined;

    if (include_dependencies && packageInfo.info.requires_dist) {
      // Parse requires_dist to extract dependencies
      dependencies = packageInfo.info.requires_dist
        .filter(req => typeof req === 'string' && !req.includes('extra =='))  // Filter out extra dependencies
        .map(req => typeof req === 'string' ? req.split(';')[0].trim() : '')       // Remove condition markers
        .filter(req => req.length > 0)
        .slice(0, 20); // Limit to first 20 dependencies
    }

    // PyPI doesn't have a clear distinction between regular and dev dependencies
    // Dev dependencies are typically specified as extras
    if (include_dev_dependencies && packageInfo.info.requires_dist) {
      devDependencies = packageInfo.info.requires_dist
        .filter(req => typeof req === 'string' && req.includes('extra =='))
        .map(req => typeof req === 'string' ? req.split(';')[0].trim() : '')
        .filter(req => req.length > 0)
        .slice(0, 10); // Limit to first 10 dev dependencies
    }

    // Extract keywords from keywords string or classifiers
    let keywords: string[] = [];
    if (packageInfo.info.keywords && typeof packageInfo.info.keywords === 'string') {
      keywords = packageInfo.info.keywords
        .split(/[,\s]+/)
        .filter(k => typeof k === 'string' && k.trim().length > 0)
        .slice(0, 10); // Limit to 10 keywords
    }

    // Create response
    const response: PackageInfoResponse = {
      package_name,
      latest_version: packageInfo.info.version,
      description: packageInfo.info.summary || packageInfo.info.description || 'No description available',
      author: authorString,
      maintainer: maintainerString || undefined,
      license: packageInfo.info.license || undefined,
      keywords: keywords,
      classifiers: packageInfo.info.classifiers || [],
      requires_python: packageInfo.info.requires_python || undefined,
      dependencies: dependencies || undefined,
      dev_dependencies: devDependencies || undefined,
      download_stats: downloadStats,
      repository: repository || undefined,
    };

    // Cache the response
    cache.set(cacheKey, response);

    logger.info(`Successfully fetched package info: ${package_name}@${packageInfo.info.version}`);
    return response;

  } catch (error) {
    logger.error(`Failed to fetch package info: ${package_name}`, { error });
    throw error;
  }
}