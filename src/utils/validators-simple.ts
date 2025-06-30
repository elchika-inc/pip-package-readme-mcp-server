import { PackageReadmeMcpError } from '../types/index.js';

/**
 * Simplified package name validation
 * Validates Python package names according to basic PyPI requirements
 */
export function validatePackageName(packageName: any): void {
  if (!packageName || typeof packageName !== 'string' || !packageName.trim()) {
    throw new PackageReadmeMcpError('Package name is required', 'INVALID_PACKAGE_NAME');
  }
  
  const trimmed = packageName.trim();
  
  // Basic format validation - allows letters, numbers, hyphens, underscores, and dots
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(trimmed) && trimmed.length > 1) {
    throw new PackageReadmeMcpError('Invalid package name format', 'INVALID_PACKAGE_NAME');
  }
  
  // Single character packages (just letters/numbers)
  if (trimmed.length === 1 && !/^[a-zA-Z0-9]$/.test(trimmed)) {
    throw new PackageReadmeMcpError('Invalid package name format', 'INVALID_PACKAGE_NAME');
  }
}

/**
 * Validates search query parameters
 */
export function validateSearchQuery(query: any): void {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new PackageReadmeMcpError('Search query is required', 'VALIDATION_ERROR');
  }
}

/**
 * Validates search limit parameter
 */
export function validateSearchLimit(limit: number): void {
  if (limit < 1 || limit > 250) {
    throw new PackageReadmeMcpError('Search limit must be between 1 and 250', 'VALIDATION_ERROR');
  }
}

/**
 * Validates version string
 */
export function validateVersion(version: string): void {
  if (!version?.trim()) {
    throw new PackageReadmeMcpError('Version is required', 'VALIDATION_ERROR');
  }
}