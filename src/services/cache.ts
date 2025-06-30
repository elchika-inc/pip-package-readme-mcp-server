import { logger } from '../utils/logger.js';
import { CacheEntry, CacheOptions } from '../types/index.js';
import { CACHE_CONFIG } from '../config/constants.js';

export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = Math.max(CACHE_CONFIG.MIN_SIZE, options.maxSize || CACHE_CONFIG.DEFAULT_MAX_SIZE);
    this.defaultTtl = Math.max(CACHE_CONFIG.MIN_TTL, options.ttl || CACHE_CONFIG.DEFAULT_TTL);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const actualTtl = ttl || this.defaultTtl;
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: actualTtl,
    };

    // Remove expired entries and check size
    this.cleanup();
    
    // Estimate size (rough approximation)
    const estimatedSize = this.estimateSize(value);
    const currentSize = this.getCurrentSize();
    
    if (currentSize + estimatedSize > this.maxSize) {
      logger.warn(`Cache size limit exceeded, clearing cache`, {
        currentSize,
        estimatedSize,
        maxSize: this.maxSize,
      });
      this.clear();
    }

    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key} (TTL: ${actualTtl}ms)`);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      logger.debug(`Cache expired: ${key}`);
      this.cache.delete(key);
      return null;
    }

    logger.debug(`Cache hit: ${key}`);
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      logger.debug(`Cache deleted: ${key}`);
    }
    return result;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`Cache cleared: ${size} entries removed`);
  }

  size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug(`Cache cleanup: ${removedCount} expired entries removed`);
    }
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += this.estimateSize(entry.data);
    }
    return totalSize;
  }

  private estimateSize(value: any): number {
    // Rough estimation of object size in bytes
    const json = JSON.stringify(value);
    return json.length * 2; // Approximate for UTF-16 encoding
  }

  // Get cache statistics
  getStats(): {
    size: number;
    estimatedMemoryUsage: number;
    maxSize: number;
    defaultTtl: number;
  } {
    return {
      size: this.cache.size,
      estimatedMemoryUsage: this.getCurrentSize(),
      maxSize: this.maxSize,
      defaultTtl: this.defaultTtl,
    };
  }
}

// Singleton cache instance
export const cache = new MemoryCache({
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || CACHE_CONFIG.DEFAULT_MAX_SIZE.toString()),
  ttl: parseInt(process.env.CACHE_TTL || CACHE_CONFIG.DEFAULT_TTL.toString()),
});

// Cache key utilities
export const createCacheKey = {
  packageInfo: (packageName: string, version: string): string => 
    `pkg_info:${packageName}:${version}`,
  
  packageReadme: (packageName: string, version: string): string => 
    `pkg_readme:${packageName}:${version}`,
  
  searchResults: (query: string, limit: number, quality?: number, popularity?: number): string => {
    const params = [query, limit.toString()];
    if (quality !== undefined) params.push(`q:${quality}`);
    if (popularity !== undefined) params.push(`p:${popularity}`);
    return `search:${params.join(':')}`;
  },
  
  downloadStats: (packageName: string, period: string): string => 
    `stats:${packageName}:${period}`,
  
  githubReadme: (owner: string, repo: string, branch?: string): string => 
    `gh_readme:${owner}:${repo}:${branch || 'main'}`,
};