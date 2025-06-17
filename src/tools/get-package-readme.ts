import { logger } from '../utils/logger.js';
import { validatePackageName, validateVersion } from '../utils/validators.js';
import { cache, createCacheKey } from '../services/cache.js';
import { pypiClient } from '../services/pypi-api.js';
import { githubApi } from '../services/github-api.js';
import { readmeParser } from '../services/readme-parser.js';
import {
  GetPackageReadmeParams,
  PackageReadmeResponse,
  InstallationInfo,
  PackageBasicInfo,
  RepositoryInfo,
  UsageExample,
} from '../types/index.js';

export async function getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
  const { 
    package_name, 
    version = 'latest',
    include_examples = true 
  } = params;

  logger.info(`Fetching package README: ${package_name}@${version}`);

  // Validate inputs
  validatePackageName(package_name);
  if (version !== 'latest') {
    validateVersion(version);
  }

  // Check cache first
  const cacheKey = createCacheKey.packageReadme(package_name, version);
  const cached = cache.get<PackageReadmeResponse>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for package README: ${package_name}@${version}`);
    return cached;
  }

  try {
    // Get package info directly from PyPI
    logger.debug(`Fetching package info: ${package_name}@${version}`);
    const packageInfo = version === 'latest' 
      ? await pypiClient.getPackageInfo(package_name)
      : await pypiClient.getVersionInfo(package_name, version);
    
    logger.debug(`Package found: ${package_name}@${packageInfo.info.version}`);

    const actualVersion = packageInfo.info.version;

    // Try to get README content
    let readmeContent = '';
    let usageExamples: UsageExample[] = [];

    // First, try to get README from PyPI (if available in description)
    if (packageInfo.info.description && packageInfo.info.description_content_type) {
      const contentType = packageInfo.info.description_content_type.toLowerCase();
      if (contentType.includes('markdown') || contentType.includes('md')) {
        readmeContent = packageInfo.info.description;
        logger.debug(`Using README from PyPI description for ${package_name}`);
      }
    }

    // If no README from PyPI, try GitHub fallback
    if (!readmeContent) {
      readmeContent = await tryGetReadmeFromGitHub(packageInfo, package_name);
    }

    // If still no README, use the summary/description
    if (!readmeContent) {
      readmeContent = packageInfo.info.summary || packageInfo.info.description || 'No README available for this package.';
      logger.debug(`Using summary as README for ${package_name}`);
    }

    // Clean and parse README content
    const cleanedContent = readmeParser.cleanReadmeContent(readmeContent);
    
    // Extract usage examples if requested
    if (include_examples && cleanedContent.length > 50) {
      usageExamples = readmeParser.extractUsageExamples(cleanedContent);
    }

    // Create installation info
    const installation: InstallationInfo = {
      pip: `pip install ${package_name}`,
    };

    // Add alternative installation methods
    if (packageInfo.info.name) {
      installation.conda = `conda install -c conda-forge ${package_name}`;
      installation.pipx = `pipx install ${package_name}`;
    }

    // Extract author information
    let authorInfo: string | any = 'Unknown';
    if (packageInfo.info.author) {
      if (packageInfo.info.author_email) {
        authorInfo = {
          name: packageInfo.info.author,
          email: packageInfo.info.author_email,
        };
      } else {
        authorInfo = packageInfo.info.author;
      }
    }

    // Extract repository information
    let repository: RepositoryInfo | undefined;
    if (packageInfo.info.project_urls) {
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

    // Create basic info
    const basicInfo: PackageBasicInfo = {
      name: packageInfo.info.name,
      version: actualVersion,
      description: packageInfo.info.description || packageInfo.info.summary || 'No description available',
      summary: packageInfo.info.summary || undefined,
      homepage: packageInfo.info.home_page || undefined,
      package_url: packageInfo.info.package_url || undefined,
      project_urls: packageInfo.info.project_urls || undefined,
      license: packageInfo.info.license || undefined,
      author: authorInfo,
      maintainer: packageInfo.info.maintainer || undefined,
      keywords: packageInfo.info.keywords ? 
        packageInfo.info.keywords.split(/[,\s]+/).filter(k => k.trim().length > 0) : [],
      classifiers: packageInfo.info.classifiers || [],
      requires_python: packageInfo.info.requires_python || undefined,
    };

    // Create response
    const response: PackageReadmeResponse = {
      package_name,
      version: actualVersion,
      description: packageInfo.info.summary || packageInfo.info.description || 'No description available',
      readme_content: cleanedContent,
      usage_examples: usageExamples,
      installation: installation,
      basic_info: basicInfo,
      repository: repository || undefined,
    };

    // Cache the response
    cache.set(cacheKey, response);

    logger.info(`Successfully fetched package README: ${package_name}@${actualVersion}`);
    return response;

  } catch (error) {
    logger.error(`Failed to fetch package README: ${package_name}@${version}`, { error });
    throw error;
  }
}

async function tryGetReadmeFromGitHub(packageInfo: any, packageName: string): Promise<string> {
  try {
    let repoUrl: string | undefined;

    // Try to find repository URL
    if (packageInfo.info.project_urls) {
      const repoKeys = ['Repository', 'Source', 'Source Code', 'Code', 'GitHub'];
      for (const key of repoKeys) {
        if (packageInfo.info.project_urls[key]) {
          repoUrl = packageInfo.info.project_urls[key];
          break;
        }
      }
    }

    // Fallback to home_page if it looks like a repository
    if (!repoUrl && packageInfo.info.home_page) {
      const homePageUrl = packageInfo.info.home_page;
      if (homePageUrl.includes('github.com') || 
          homePageUrl.includes('gitlab.com') || 
          homePageUrl.includes('bitbucket.org')) {
        repoUrl = homePageUrl;
      }
    }

    if (!repoUrl) {
      logger.debug(`No repository URL found for ${packageName}`);
      return '';
    }

    // Only handle GitHub for now
    if (!repoUrl.includes('github.com')) {
      logger.debug(`Repository is not on GitHub for ${packageName}: ${repoUrl}`);
      return '';
    }

    const readmeContent = await githubApi.getReadmeFromUrl(repoUrl);
    if (readmeContent) {
      logger.debug(`Successfully fetched README from GitHub for ${packageName}`);
      return readmeContent;
    }

    return '';
  } catch (error) {
    logger.warn(`Failed to fetch README from GitHub for ${packageName}`, { error });
    return '';
  }
}