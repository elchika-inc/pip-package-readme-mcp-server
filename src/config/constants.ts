export const API_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  BASE_RETRY_DELAY: 1000, // 1 second
  USER_AGENT: 'pip-package-readme-mcp-server/1.0.0',
} as const;

export const CACHE_CONFIG = {
  DEFAULT_MAX_SIZE: 100 * 1024 * 1024, // 100MB
  DEFAULT_TTL: 3600000, // 1 hour
  SEARCH_RESULTS_TTL: 300000, // 5 minutes
  MIN_SIZE: 1024 * 1024, // 1MB minimum
  MIN_TTL: 60000, // 1 minute minimum
} as const;

export const VALIDATION_LIMITS = {
  MAX_PACKAGE_NAME_LENGTH: 214,
  MAX_SEARCH_QUERY_LENGTH: 200,
  MAX_SEARCH_LIMIT: 250,
  MIN_SEARCH_LIMIT: 1,
  DEFAULT_SEARCH_LIMIT: 20,
} as const;

export const README_CONFIG = {
  MIN_CODE_BLOCK_LENGTH: 10,
  MAX_CODE_BLOCK_LENGTH: 5000,
  IDEAL_EXAMPLE_LENGTH: 200,
  MAX_EXAMPLES: 20,
  MAX_KEYWORDS: 10,
} as const;

export const PYPI_CONFIG = {
  BASE_URL: 'https://pypi.org/pypi',
  JSON_ENDPOINT_SUFFIX: '/json',
  DEFAULT_VERSION: 'latest',
} as const;

export const LIBRARIES_IO_CONFIG = {
  BASE_URL: 'https://libraries.io/api',
  SEARCH_ENDPOINT: '/search',
  PLATFORM: 'Pypi',
} as const;