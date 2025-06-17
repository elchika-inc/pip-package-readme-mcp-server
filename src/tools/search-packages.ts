import { logger } from '../utils/logger.js';
import { validateSearchQuery, validateLimit, validateScore } from '../utils/validators.js';
import { cache, createCacheKey } from '../services/cache.js';
import { pypiClient } from '../services/pypi-api.js';
import {
  SearchPackagesParams,
  SearchPackagesResponse,
  PackageSearchResult,
} from '../types/index.js';

export async function searchPackages(params: SearchPackagesParams): Promise<SearchPackagesResponse> {
  const { 
    query, 
    limit = 20,
    quality,
    popularity
  } = params;

  logger.info(`Searching packages: ${query} (limit: ${limit})`);

  // Validate inputs
  validateSearchQuery(query);
  validateLimit(limit);
  
  if (quality !== undefined) {
    validateScore(quality, 'Quality');
  }
  
  if (popularity !== undefined) {
    validateScore(popularity, 'Popularity');
  }

  // Check cache first
  const cacheKey = createCacheKey.searchResults(query, limit, quality, popularity);
  const cached = cache.get<SearchPackagesResponse>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for search: ${query}`);
    return cached;
  }

  try {
    // PyPI's search API is deprecated, so we'll implement a workaround
    // This is a simplified implementation that would need to be enhanced
    // with a proper search service in production
    
    const searchResponse = await searchPackagesWorkaround(query, limit, quality, popularity);

    // Cache the response (shorter TTL for search results)
    cache.set(cacheKey, searchResponse, 300000); // 5 minutes

    logger.info(`Successfully searched packages: ${query}, found ${searchResponse.total} results`);
    return searchResponse;

  } catch (error) {
    logger.error(`Failed to search packages: ${query}`, { error });
    throw error;
  }
}

/**
 * Search packages using libraries.io API as primary source
 * Falls back to mock search if libraries.io is unavailable
 */
async function searchPackagesWorkaround(
  query: string,
  limit: number,
  quality?: number,
  popularity?: number
): Promise<SearchPackagesResponse> {
  
  logger.info(`Searching packages using libraries.io API: ${query}`);
  
  try {
    // Try libraries.io API first
    const librariesResults = await searchWithLibrariesIO(query, limit);
    
    // Apply quality and popularity filters if specified
    let filteredResults = librariesResults;
    
    if (quality !== undefined) {
      filteredResults = filteredResults.filter(pkg => pkg.score.detail.quality >= quality);
    }
    
    if (popularity !== undefined) {
      filteredResults = filteredResults.filter(pkg => pkg.score.detail.popularity >= popularity);
    }
    
    // Sort by search score
    filteredResults.sort((a, b) => b.searchScore - a.searchScore);
    
    // Limit results
    filteredResults = filteredResults.slice(0, limit);

    return {
      query,
      total: filteredResults.length,
      packages: filteredResults,
    };
  } catch (error) {
    logger.warn('Libraries.io API failed, falling back to mock search', { error });
    
    // Fallback to mock search
    const mockResults = await getMockSearchResults(query, limit);
    
    // Apply filters
    let filteredResults = mockResults;
    
    if (quality !== undefined) {
      filteredResults = filteredResults.filter(pkg => pkg.score.detail.quality >= quality);
    }
    
    if (popularity !== undefined) {
      filteredResults = filteredResults.filter(pkg => pkg.score.detail.popularity >= popularity);
    }
    
    filteredResults.sort((a, b) => b.searchScore - a.searchScore);
    filteredResults = filteredResults.slice(0, limit);

    return {
      query,
      total: filteredResults.length,
      packages: filteredResults,
    };
  }
}

/**
 * Search packages using libraries.io API
 */
async function searchWithLibrariesIO(query: string, limit: number): Promise<PackageSearchResult[]> {
  const url = `https://libraries.io/api/search?q=${encodeURIComponent(query)}&platforms=pypi&per_page=${Math.min(limit, 100)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'pip-package-readme-mcp/1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Libraries.io API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format from libraries.io');
    }

    const results: PackageSearchResult[] = [];
    
    for (const pkg of data) {
      // Calculate quality score based on various factors
      const qualityScore = calculateQualityScore(pkg);
      const popularityScore = calculatePopularityScore(pkg);
      const maintenanceScore = calculateMaintenanceScore(pkg);
      
      results.push({
        name: pkg.name || 'unknown',
        version: pkg.latest_stable_release_number || pkg.latest_release_number || '0.0.0',
        description: pkg.description || '',
        summary: pkg.description || '',
        keywords: pkg.keywords || [],
        author: pkg.latest_stable_release?.original_author || 'Unknown',
        maintainer: pkg.latest_stable_release?.original_author || 'Unknown',
        classifiers: [],
        score: {
          final: (qualityScore + popularityScore + maintenanceScore) / 3,
          detail: {
            quality: qualityScore,
            popularity: popularityScore,
            maintenance: maintenanceScore,
          },
        },
        searchScore: calculateLibrariesIOSearchScore(pkg, query),
      });
    }
    
    return results;
  } catch (error) {
    logger.error('Failed to search with libraries.io API', { error });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function calculateQualityScore(pkg: any): number {
  let score = 0.5; // Base score
  
  // Has description
  if (pkg.description && pkg.description.length > 10) {
    score += 0.1;
  }
  
  // Has recent release
  if (pkg.latest_release_published_at) {
    const lastRelease = new Date(pkg.latest_release_published_at);
    const monthsAgo = (Date.now() - lastRelease.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < 6) score += 0.2;
    else if (monthsAgo < 12) score += 0.1;
  }
  
  // Has homepage or repository
  if (pkg.homepage || pkg.repository_url) {
    score += 0.1;
  }
  
  // Has license
  if (pkg.normalized_licenses && pkg.normalized_licenses.length > 0) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

function calculatePopularityScore(pkg: any): number {
  let score = 0.3; // Base score
  
  // GitHub stars
  if (pkg.stars) {
    if (pkg.stars > 10000) score += 0.4;
    else if (pkg.stars > 1000) score += 0.3;
    else if (pkg.stars > 100) score += 0.2;
    else if (pkg.stars > 10) score += 0.1;
  }
  
  // Forks
  if (pkg.forks) {
    if (pkg.forks > 1000) score += 0.2;
    else if (pkg.forks > 100) score += 0.1;
    else if (pkg.forks > 10) score += 0.05;
  }
  
  return Math.min(score, 1.0);
}

function calculateMaintenanceScore(pkg: any): number {
  let score = 0.4; // Base score
  
  // Recent activity
  if (pkg.latest_release_published_at) {
    const lastRelease = new Date(pkg.latest_release_published_at);
    const monthsAgo = (Date.now() - lastRelease.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < 3) score += 0.3;
    else if (monthsAgo < 6) score += 0.2;
    else if (monthsAgo < 12) score += 0.1;
  }
  
  // Has multiple versions
  if (pkg.versions && pkg.versions.length > 1) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

function calculateLibrariesIOSearchScore(pkg: any, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  
  // Exact name match
  if (pkg.name && pkg.name.toLowerCase() === queryLower) {
    score += 100;
  } else if (pkg.name && pkg.name.toLowerCase().includes(queryLower)) {
    score += 50;
  }
  
  // Description match
  if (pkg.description && pkg.description.toLowerCase().includes(queryLower)) {
    score += 20;
  }
  
  // Keywords match
  if (pkg.keywords && Array.isArray(pkg.keywords)) {
    for (const keyword of pkg.keywords) {
      if (typeof keyword === 'string' && keyword.toLowerCase().includes(queryLower)) {
        score += 30;
      }
    }
  }
  
  // Popularity boost
  if (pkg.stars) {
    score += Math.log10(pkg.stars + 1) * 5;
  }
  
  return score;
}

/**
 * Generate mock search results for demonstration
 * Used as fallback when libraries.io API is unavailable
 */
async function getMockSearchResults(query: string, limit: number): Promise<PackageSearchResult[]> {
  const results: PackageSearchResult[] = [];
  
  // For demonstration, we'll create some mock results based on common patterns
  const commonPackages = [
    // Web frameworks
    { name: 'django', keywords: ['web', 'framework', 'mvc'], description: 'A high-level Python Web framework' },
    { name: 'flask', keywords: ['web', 'framework', 'micro'], description: 'A simple framework for building complex web applications' },
    { name: 'fastapi', keywords: ['web', 'api', 'async'], description: 'FastAPI framework, high performance, easy to learn' },
    
    // Data science
    { name: 'pandas', keywords: ['data', 'analysis', 'dataframe'], description: 'Powerful data structures for data analysis' },
    { name: 'numpy', keywords: ['numerical', 'array', 'scientific'], description: 'Fundamental package for array computing' },
    { name: 'scikit-learn', keywords: ['machine', 'learning', 'ml'], description: 'Machine learning library for Python' },
    
    // HTTP and networking
    { name: 'requests', keywords: ['http', 'client', 'api'], description: 'Python HTTP for Humans' },
    { name: 'httpx', keywords: ['http', 'async', 'client'], description: 'The next generation HTTP client for Python' },
    
    // Testing
    { name: 'pytest', keywords: ['testing', 'test', 'framework'], description: 'pytest: simple powerful testing with Python' },
    { name: 'unittest', keywords: ['testing', 'test', 'unit'], description: 'Unit testing framework for Python' },
    
    // Utilities
    { name: 'click', keywords: ['cli', 'command', 'line'], description: 'Composable command line interface toolkit' },
    { name: 'pydantic', keywords: ['validation', 'data', 'parsing'], description: 'Data validation and settings management' },
  ];
  
  // Filter packages that match the query
  const queryLower = query.toLowerCase();
  const matchingPackages = commonPackages.filter(pkg => 
    pkg.name.toLowerCase().includes(queryLower) ||
    pkg.description.toLowerCase().includes(queryLower) ||
    pkg.keywords.some(keyword => keyword.toLowerCase().includes(queryLower))
  );
  
  // Convert to search results format
  for (const pkg of matchingPackages.slice(0, limit)) {
    const searchScore = calculateSearchScore(pkg, queryLower);
    
    results.push({
      name: pkg.name,
      version: '1.0.0', // Mock version
      description: pkg.description,
      summary: pkg.description,
      keywords: pkg.keywords,
      author: 'Unknown Author',
      maintainer: 'Unknown Maintainer',
      classifiers: [
        'Development Status :: 5 - Production/Stable',
        'Programming Language :: Python :: 3',
      ],
      score: {
        final: Math.random() * 0.3 + 0.7, // Mock score between 0.7-1.0
        detail: {
          quality: Math.random() * 0.3 + 0.7,
          popularity: Math.random() * 0.3 + 0.6,
          maintenance: Math.random() * 0.3 + 0.8,
        },
      },
      searchScore: searchScore,
    });
  }
  
  return results;
}

function calculateSearchScore(pkg: any, query: string): number {
  let score = 0;
  
  // Exact name match gets highest score
  if (pkg.name.toLowerCase() === query) {
    score += 100;
  } else if (pkg.name.toLowerCase().includes(query)) {
    score += 50;
  }
  
  // Description match
  if (pkg.description.toLowerCase().includes(query)) {
    score += 20;
  }
  
  // Keyword match
  for (const keyword of pkg.keywords) {
    if (keyword.toLowerCase().includes(query)) {
      score += 30;
    }
  }
  
  // Add some randomness
  score += Math.random() * 10;
  
  return score;
}

// Note: In a production implementation, you would want to implement one of these approaches:
//
// 1. Use libraries.io API:
//    - Endpoint: https://libraries.io/api/search?q={query}&platforms=pypi
//    - Provides comprehensive package search with quality metrics
//
// 2. Use PyPI warehouse source code:
//    - Implement search using PostgreSQL full-text search
//    - Mirror PyPI's own search functionality
//
// 3. Use BigQuery public dataset:
//    - Query PyPI download statistics and package metadata
//    - Implement custom scoring based on downloads and metadata
//
// 4. Implement Elasticsearch/OpenSearch:
//    - Index PyPI package metadata
//    - Provide fast, relevant search results
//
// 5. Use third-party services:
//    - Algolia DocSearch
//    - Swiftype
//    - Custom search APIs