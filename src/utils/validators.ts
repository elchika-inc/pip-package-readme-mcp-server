import { PackageReadmeMcpError } from '../types/index.js';

/**
 * Validates a Python package name according to PEP 508 naming conventions
 * https://peps.python.org/pep-0508/#names
 */
export function validatePackageName(packageName: string): void {
  if (!packageName || typeof packageName !== 'string') {
    throw new PackageReadmeMcpError(
      'Package name is required and must be a string',
      'INVALID_PACKAGE_NAME'
    );
  }

  // Trim whitespace
  const trimmed = packageName.trim();
  if (trimmed.length === 0) {
    throw new PackageReadmeMcpError(
      'Package name cannot be empty',
      'INVALID_PACKAGE_NAME'
    );
  }

  // Check length (PyPI has a practical limit)
  if (trimmed.length > 214) {
    throw new PackageReadmeMcpError(
      'Package name is too long (max 214 characters)',
      'INVALID_PACKAGE_NAME'
    );
  }

  // Python package names should match this pattern:
  // - Start with letter or number
  // - Can contain letters, numbers, hyphens, underscores, and dots
  // - Case insensitive
  // - No consecutive special characters
  const validNamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
  
  if (!validNamePattern.test(trimmed)) {
    throw new PackageReadmeMcpError(
      'Invalid package name format. Package names must start and end with alphanumeric characters and can contain letters, numbers, hyphens, underscores, and dots.',
      'INVALID_PACKAGE_NAME'
    );
  }

  // Check for reserved names
  const reservedNames = ['pip', 'setuptools', 'wheel', 'distutils'];
  if (reservedNames.includes(trimmed.toLowerCase())) {
    throw new PackageReadmeMcpError(
      `Package name '${trimmed}' is reserved`,
      'INVALID_PACKAGE_NAME'
    );
  }

  // Check for problematic patterns
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    throw new PackageReadmeMcpError(
      'Package name cannot start or end with a dot',
      'INVALID_PACKAGE_NAME'
    );
  }

  if (trimmed.includes('..') || trimmed.includes('--') || trimmed.includes('__')) {
    throw new PackageReadmeMcpError(
      'Package name cannot contain consecutive special characters',
      'INVALID_PACKAGE_NAME'
    );
  }
}

/**
 * Validates a version string
 */
export function validateVersion(version: string): void {
  if (!version || typeof version !== 'string') {
    throw new PackageReadmeMcpError(
      'Version must be a string',
      'INVALID_VERSION'
    );
  }

  const trimmed = version.trim();
  if (trimmed.length === 0) {
    throw new PackageReadmeMcpError(
      'Version cannot be empty',
      'INVALID_VERSION'
    );
  }

  // Allow 'latest' as a special case
  if (trimmed === 'latest') {
    return;
  }

  // Basic PEP 440 version validation
  // This is a simplified version - full PEP 440 is quite complex
  const versionPattern = /^([0-9]+!)?([0-9]+(\.[0-9]+)*)((a|b|rc)[0-9]+)?(\.post[0-9]+)?(\.dev[0-9]+)?$/;
  
  if (!versionPattern.test(trimmed)) {
    throw new PackageReadmeMcpError(
      'Invalid version format. Must follow PEP 440 versioning scheme.',
      'INVALID_VERSION'
    );
  }
}

/**
 * Validates a search query
 */
export function validateSearchQuery(query: string): void {
  if (!query || typeof query !== 'string') {
    throw new PackageReadmeMcpError(
      'Search query is required and must be a string',
      'INVALID_SEARCH_QUERY'
    );
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new PackageReadmeMcpError(
      'Search query cannot be empty',
      'INVALID_SEARCH_QUERY'
    );
  }

  if (trimmed.length > 200) {
    throw new PackageReadmeMcpError(
      'Search query is too long (max 200 characters)',
      'INVALID_SEARCH_QUERY'
    );
  }

  // Check for suspicious patterns
  if (trimmed.includes('<script') || trimmed.includes('javascript:')) {
    throw new PackageReadmeMcpError(
      'Invalid characters in search query',
      'INVALID_SEARCH_QUERY'
    );
  }
}

/**
 * Validates a limit parameter
 */
export function validateLimit(limit: number): void {
  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    throw new PackageReadmeMcpError(
      'Limit must be an integer',
      'INVALID_LIMIT'
    );
  }

  if (limit < 1) {
    throw new PackageReadmeMcpError(
      'Limit must be at least 1',
      'INVALID_LIMIT'
    );
  }

  if (limit > 250) {
    throw new PackageReadmeMcpError(
      'Limit cannot exceed 250',
      'INVALID_LIMIT'
    );
  }
}

/**
 * Validates a score parameter (quality or popularity)
 */
export function validateScore(score: number, name: string): void {
  if (typeof score !== 'number') {
    throw new PackageReadmeMcpError(
      `${name} must be a number`,
      'INVALID_SCORE'
    );
  }

  if (score < 0 || score > 1) {
    throw new PackageReadmeMcpError(
      `${name} must be between 0 and 1`,
      'INVALID_SCORE'
    );
  }
}

/**
 * Normalizes a package name for consistent comparison
 */
export function normalizePackageName(packageName: string): string {
  // PyPI treats package names case-insensitively and treats _ and - as equivalent
  return packageName.toLowerCase().replace(/[-_.]+/g, '-');
}