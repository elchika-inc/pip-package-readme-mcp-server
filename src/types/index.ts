export interface UsageExample {
  title: string;
  description?: string | undefined;
  code: string;
  language: string; // 'python', 'bash', 'yaml', etc.
}

export interface InstallationInfo {
  pip: string;      // "pip install package-name"
  conda?: string;   // "conda install package-name"
  pipx?: string;    // "pipx install package-name"
}

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface RepositoryInfo {
  type: string;
  url: string;
  directory?: string | undefined;
}

export interface PackageBasicInfo {
  name: string;
  version: string;
  description: string;
  summary?: string | undefined;
  homepage?: string | undefined;
  package_url?: string | undefined;
  project_urls?: Record<string, string> | undefined;
  license?: string | undefined;
  author: string | AuthorInfo;
  maintainer?: string | AuthorInfo | undefined;
  keywords: string[];
  classifiers: string[];
  requires_python?: string | undefined;
}

export interface DownloadStats {
  last_day: number;
  last_week: number;
  last_month: number;
}

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  summary: string;
  keywords: string[];
  author: string;
  maintainer: string;
  classifiers: string[];
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
}

// Tool Parameters
export interface GetPackageReadmeParams {
  package_name: string;    // Package name (required)
  version?: string;        // Version specification (optional, default: "latest")
  include_examples?: boolean; // Whether to include examples (optional, default: true)
}

export interface GetPackageInfoParams {
  package_name: string;
  include_dependencies?: boolean; // Whether to include dependencies (default: true)
  include_dev_dependencies?: boolean; // Whether to include dev dependencies (default: false)
}

export interface SearchPackagesParams {
  query: string;          // Search query
  limit?: number;         // Maximum number of results (default: 20)
  quality?: number;       // Minimum quality score (0-1)
  popularity?: number;    // Minimum popularity score (0-1)
}

// Tool Responses
export interface PackageReadmeResponse {
  package_name: string;
  version: string;
  description: string;
  readme_content: string;
  usage_examples: UsageExample[];
  installation: InstallationInfo;
  basic_info: PackageBasicInfo;
  repository?: RepositoryInfo | undefined;
}

export interface PackageInfoResponse {
  package_name: string;
  latest_version: string;
  description: string;
  author: string;
  maintainer?: string | undefined;
  license?: string | undefined;
  keywords: string[];
  classifiers: string[];
  requires_python?: string | undefined;
  dependencies?: string[] | undefined;
  dev_dependencies?: string[] | undefined;
  download_stats: DownloadStats;
  repository?: RepositoryInfo | undefined;
}

export interface SearchPackagesResponse {
  query: string;
  total: number;
  packages: PackageSearchResult[];
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// PyPI API Types
export interface PyPIPackageInfo {
  info: {
    author: string;
    author_email?: string;
    bugtrack_url?: string;
    classifiers: string[];
    description: string;
    description_content_type?: string;
    docs_url?: string;
    download_url?: string;
    downloads: {
      last_day: number;
      last_week: number;
      last_month: number;
    };
    home_page?: string;
    keywords?: string;
    license?: string;
    maintainer?: string;
    maintainer_email?: string;
    name: string;
    package_url: string;
    platform?: string;
    project_url: string;
    project_urls?: Record<string, string>;
    release_url: string;
    requires_dist?: string[];
    requires_python?: string;
    summary: string;
    version: string;
    yanked: boolean;
    yanked_reason?: string;
  };
  last_serial: number;
  releases: Record<string, PyPIReleaseInfo[]>;
  urls: PyPIReleaseInfo[];
  vulnerabilities: any[];
}

export interface PyPIReleaseInfo {
  comment_text?: string;
  digests: {
    blake2b_256?: string;
    md5?: string;
    sha256: string;
  };
  downloads: number;
  filename: string;
  has_sig: boolean;
  md5_digest?: string;
  packagetype: string;
  python_version: string;
  requires_python?: string;
  size: number;
  upload_time: string;
  upload_time_iso_8601: string;
  url: string;
  yanked: boolean;
  yanked_reason?: string;
}

export interface PyPISearchResponse {
  info: {
    page: number;
    pages: number;
    per_page: number;
    total: number;
  };
  results: {
    name: string;
    version: string;
    description: string;
    summary: string;
    keywords: string;
    author: string;
    author_email?: string;
    maintainer?: string;
    maintainer_email?: string;
    home_page?: string;
    package_url: string;
    project_url: string;
    project_urls?: Record<string, string>;
    release_url: string;
    requires_python?: string;
    yanked: boolean;
    yanked_reason?: string;
  }[];
}

// Simple API for package search from PyPI simple API
export interface PyPISimpleResponse {
  files: {
    filename: string;
    url: string;
    hashes?: Record<string, string>;
    requires_python?: string;
    yanked?: boolean;
    yanked_reason?: string;
  }[];
  meta: {
    api_version: string;
  };
  name: string;
  versions?: string[];
}

// GitHub API Types (same as npm version for fallback README)
export interface GitHubReadmeResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

// Error Types
export class PackageReadmeMcpError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PackageReadmeMcpError';
  }
}

export class PackageNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string) {
    super(`Package '${packageName}' not found`, 'PACKAGE_NOT_FOUND', 404);
  }
}

export class VersionNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string, version: string) {
    super(`Version '${version}' of package '${packageName}' not found`, 'VERSION_NOT_FOUND', 404);
  }
}

export class RateLimitError extends PackageReadmeMcpError {
  constructor(service: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${service}`, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}

export class NetworkError extends PackageReadmeMcpError {
  constructor(message: string, originalError?: Error) {
    super(`Network error: ${message}`, 'NETWORK_ERROR', undefined, originalError);
  }
}