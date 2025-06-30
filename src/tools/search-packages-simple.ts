import { logger } from '../utils/logger.js';
import { validateSearchQuery, validateSearchLimit } from '../utils/validators-simple.js';
import { cache, createCacheKey } from '../services/cache.js';
import { CACHE_CONFIG, VALIDATION_LIMITS } from '../config/constants.js';
import {
  SearchPackagesParams,
  SearchPackagesResponse,
  PackageSearchResult,
} from '../types/index.js';

export async function searchPackages(params: SearchPackagesParams): Promise<SearchPackagesResponse> {
  const { 
    query, 
    limit = VALIDATION_LIMITS.DEFAULT_SEARCH_LIMIT,
  } = params;

  logger.info(`Searching packages: ${query} (limit: ${limit})`);

  // Validate inputs
  validateSearchQuery(query);
  validateSearchLimit(limit);

  // Check cache first
  const cacheKey = createCacheKey.searchResults(query, limit);
  const cached = cache.get<SearchPackagesResponse>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for search: ${query}`);
    return cached;
  }

  try {
    // Use libraries.io API as the primary search method
    const results = await searchWithLibrariesIO(query, limit);
    
    const response: SearchPackagesResponse = {
      query,
      total: results.length,
      packages: results,
    };

    // Cache the response with shorter TTL for search results
    cache.set(cacheKey, response, CACHE_CONFIG.SEARCH_RESULTS_TTL);
    
    logger.info(`Search completed: ${query} (${results.length} results)`);
    return response;

  } catch (error) {
    logger.error(`Search failed: ${query}`, { error });
    
    // Return empty results on failure
    return {
      query,
      total: 0,
      packages: [],
    };
  }
}

async function searchWithLibrariesIO(query: string, limit: number): Promise<PackageSearchResult[]> {
  const url = `https://libraries.io/api/search?q=${encodeURIComponent(query)}&platforms=Pypi&per_page=${limit}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'pip-package-readme-mcp-server/1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Libraries.io API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((pkg: any): PackageSearchResult => ({
      name: pkg.name,
      version: pkg.latest_stable_release?.number || pkg.latest_release_number || '0.0.0',
      description: pkg.description || '',
      summary: pkg.description || '',
      keywords: pkg.keywords || [],
      author: extractAuthor(pkg),
      maintainer: extractMaintainer(pkg),
      classifiers: [],
      score: {
        final: calculateSimpleScore(pkg),
        detail: {
          quality: 0.5,
          popularity: normalizeStars(pkg.stars),
          maintenance: normalizeActivity(pkg.latest_release_published_at),
        },
      },
      searchScore: calculateSimpleScore(pkg),
    }));

  } catch (error) {
    logger.warn('Libraries.io search failed', { error });
    throw error;
  }
}

function extractAuthor(pkg: any): string {
  return pkg.repository?.owner?.login || 'Unknown';
}

function extractMaintainer(pkg: any): string {
  return pkg.repository?.owner?.login || 'Unknown';
}

function calculateSimpleScore(pkg: any): number {
  let score = 0.5; // Base score
  
  // Add points for stars
  if (pkg.stars > 0) {
    score += Math.min(pkg.stars / 1000, 0.3); // Max 0.3 points for stars
  }
  
  // Add points for recent activity
  if (pkg.latest_release_published_at) {
    const releaseDate = new Date(pkg.latest_release_published_at);
    const daysSinceRelease = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceRelease < 365) {
      score += 0.2; // Recently updated
    }
  }
  
  return Math.min(score, 1.0);
}

function normalizeStars(stars: number): number {
  if (!stars) return 0;
  return Math.min(stars / 1000, 1.0);
}

function normalizeActivity(lastReleaseDate: string): number {
  if (!lastReleaseDate) return 0;
  
  const releaseDate = new Date(lastReleaseDate);
  const daysSinceRelease = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceRelease < 30) return 1.0;
  if (daysSinceRelease < 90) return 0.8;
  if (daysSinceRelease < 365) return 0.6;
  if (daysSinceRelease < 730) return 0.4;
  return 0.2;
}