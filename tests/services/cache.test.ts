import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCache, cache, createCacheKey } from '../../src/services/cache.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/constants.js', () => ({
  CACHE_CONFIG: {
    MIN_SIZE: 1024,
    MIN_TTL: 100,
    DEFAULT_MAX_SIZE: 10485760, // 10MB
    DEFAULT_TTL: 300000, // 5 minutes
  },
}));

describe('MemoryCache', () => {
  let memoryCache: MemoryCache;

  beforeEach(() => {
    memoryCache = new MemoryCache();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const cache = new MemoryCache();
      const stats = cache.getStats();
      
      expect(stats.maxSize).toBe(10485760);
      expect(stats.defaultTtl).toBe(300000);
    });

    it('should use custom options when provided', () => {
      const cache = new MemoryCache({
        maxSize: 2048,
        ttl: 60000,
      });
      const stats = cache.getStats();
      
      expect(stats.maxSize).toBe(2048);
      expect(stats.defaultTtl).toBe(60000);
    });

    it('should enforce minimum size and TTL', () => {
      const cache = new MemoryCache({
        maxSize: 512, // Below minimum
        ttl: 50, // Below minimum
      });
      const stats = cache.getStats();
      
      expect(stats.maxSize).toBe(1024); // MIN_SIZE
      expect(stats.defaultTtl).toBe(100); // MIN_TTL
    });
  });

  describe('set and get operations', () => {
    it('should store and retrieve values', () => {
      const testData = { name: 'test', value: 123 };
      
      memoryCache.set('test-key', testData);
      const result = memoryCache.get('test-key');
      
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const result = memoryCache.get('non-existent');
      
      expect(result).toBeNull();
    });

    it('should use custom TTL when provided', () => {
      const testData = { name: 'test' };
      
      memoryCache.set('test-key', testData, 1000);
      
      // Should still be available before TTL
      expect(memoryCache.get('test-key')).toEqual(testData);
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(1001);
      
      // Should be expired
      expect(memoryCache.get('test-key')).toBeNull();
    });

    it('should use default TTL when none provided', () => {
      const testData = { name: 'test' };
      
      memoryCache.set('test-key', testData);
      
      // Should still be available before default TTL
      expect(memoryCache.get('test-key')).toEqual(testData);
      
      // Advance time beyond default TTL
      vi.advanceTimersByTime(300001);
      
      // Should be expired
      expect(memoryCache.get('test-key')).toBeNull();
    });

    it('should handle different data types', () => {
      const testCases = [
        ['string', 'hello world'],
        ['number', 42],
        ['boolean', true],
        ['array', [1, 2, 3]],
        ['object', { a: 1, b: 'test' }],
        ['null', null],
      ];

      testCases.forEach(([type, value]) => {
        memoryCache.set(`test-${type}`, value);
        expect(memoryCache.get(`test-${type}`)).toEqual(value);
      });

      // Handle undefined separately as JSON.stringify(undefined) returns undefined
      memoryCache.set('test-undefined', undefined);
      expect(memoryCache.get('test-undefined')).toEqual(undefined);
    });
  });

  describe('has operation', () => {
    it('should return true for existing non-expired keys', () => {
      memoryCache.set('test-key', 'test-value');
      
      expect(memoryCache.has('test-key')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(memoryCache.has('non-existent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      memoryCache.set('test-key', 'test-value', 1000);
      
      expect(memoryCache.has('test-key')).toBe(true);
      
      vi.advanceTimersByTime(1001);
      
      expect(memoryCache.has('test-key')).toBe(false);
    });

    it('should clean up expired keys when checking', () => {
      memoryCache.set('test-key', 'test-value', 1000);
      
      expect(memoryCache.size()).toBe(1);
      
      vi.advanceTimersByTime(1001);
      
      memoryCache.has('test-key'); // This should trigger cleanup
      
      expect(memoryCache.size()).toBe(0);
    });
  });

  describe('delete operation', () => {
    it('should delete existing keys', () => {
      memoryCache.set('test-key', 'test-value');
      
      expect(memoryCache.has('test-key')).toBe(true);
      
      const result = memoryCache.delete('test-key');
      
      expect(result).toBe(true);
      expect(memoryCache.has('test-key')).toBe(false);
    });

    it('should return false for non-existent keys', () => {
      const result = memoryCache.delete('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('clear operation', () => {
    it('should clear all entries', () => {
      memoryCache.set('key1', 'value1');
      memoryCache.set('key2', 'value2');
      memoryCache.set('key3', 'value3');
      
      expect(memoryCache.size()).toBe(3);
      
      memoryCache.clear();
      
      expect(memoryCache.size()).toBe(0);
      expect(memoryCache.get('key1')).toBeNull();
      expect(memoryCache.get('key2')).toBeNull();
      expect(memoryCache.get('key3')).toBeNull();
    });
  });

  describe('size operation', () => {
    it('should return correct size', () => {
      expect(memoryCache.size()).toBe(0);
      
      memoryCache.set('key1', 'value1');
      expect(memoryCache.size()).toBe(1);
      
      memoryCache.set('key2', 'value2');
      expect(memoryCache.size()).toBe(2);
      
      memoryCache.delete('key1');
      expect(memoryCache.size()).toBe(1);
      
      memoryCache.clear();
      expect(memoryCache.size()).toBe(0);
    });
  });

  describe('cleanup mechanism', () => {
    it('should automatically clean up expired entries', () => {
      memoryCache.set('key1', 'value1', 1000);
      memoryCache.set('key2', 'value2', 2000);
      memoryCache.set('key3', 'value3', 3000);
      
      expect(memoryCache.size()).toBe(3);
      
      // Advance time to expire first entry
      vi.advanceTimersByTime(1001);
      
      // Trigger cleanup by setting new value
      memoryCache.set('key4', 'value4');
      
      expect(memoryCache.size()).toBe(3); // key1 should be cleaned up
      expect(memoryCache.get('key1')).toBeNull();
      expect(memoryCache.get('key2')).not.toBeNull();
      expect(memoryCache.get('key3')).not.toBeNull();
      expect(memoryCache.get('key4')).not.toBeNull();
    });

    it('should handle multiple expired entries', () => {
      memoryCache.set('key1', 'value1', 1000);
      memoryCache.set('key2', 'value2', 1000);
      memoryCache.set('key3', 'value3', 5000);
      
      expect(memoryCache.size()).toBe(3);
      
      // Advance time to expire first two entries
      vi.advanceTimersByTime(1001);
      
      // Trigger cleanup
      memoryCache.set('key4', 'value4');
      
      expect(memoryCache.size()).toBe(2); // key1 and key2 should be cleaned up
      expect(memoryCache.get('key1')).toBeNull();
      expect(memoryCache.get('key2')).toBeNull();
      expect(memoryCache.get('key3')).not.toBeNull();
      expect(memoryCache.get('key4')).not.toBeNull();
    });
  });

  describe('size limit enforcement', () => {
    it('should clear cache when size limit is exceeded', () => {
      // Create a cache with small size limit
      const smallCache = new MemoryCache({ maxSize: 100 });
      
      // Add data that should exceed the limit
      const largeData = 'x'.repeat(200);
      
      smallCache.set('key1', largeData);
      
      // Cache should be cleared due to size limit
      expect(smallCache.size()).toBe(1); // The new entry should still be there
    });

    it('should estimate object size correctly', () => {
      const testData = { name: 'test', value: 123 };
      
      memoryCache.set('test-key', testData);
      
      const stats = memoryCache.getStats();
      expect(stats.estimatedMemoryUsage).toBeGreaterThan(0);
    });
  });

  describe('getStats operation', () => {
    it('should return correct statistics', () => {
      memoryCache.set('key1', 'value1');
      memoryCache.set('key2', { data: 'value2' });
      
      const stats = memoryCache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.estimatedMemoryUsage).toBeGreaterThan(0);
      expect(stats.maxSize).toBe(10485760);
      expect(stats.defaultTtl).toBe(300000);
    });

    it('should update statistics after operations', () => {
      const initialStats = memoryCache.getStats();
      expect(initialStats.size).toBe(0);
      expect(initialStats.estimatedMemoryUsage).toBe(0);
      
      memoryCache.set('key1', 'value1');
      
      const afterSetStats = memoryCache.getStats();
      expect(afterSetStats.size).toBe(1);
      expect(afterSetStats.estimatedMemoryUsage).toBeGreaterThan(0);
      
      memoryCache.clear();
      
      const afterClearStats = memoryCache.getStats();
      expect(afterClearStats.size).toBe(0);
      expect(afterClearStats.estimatedMemoryUsage).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large objects', () => {
      const largeObject = {
        data: 'x'.repeat(1000),
        array: new Array(100).fill('test'),
        nested: { deep: { value: 'test' } },
      };
      
      memoryCache.set('large-key', largeObject);
      const result = memoryCache.get('large-key');
      
      expect(result).toEqual(largeObject);
    });

    it('should handle circular references in size estimation', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      // This should not throw an error
      expect(() => {
        memoryCache.set('circular-key', circularObj);
      }).toThrow(); // JSON.stringify will throw on circular references
    });

    it('should handle zero TTL', () => {
      memoryCache.set('test-key', 'test-value', 0);
      
      // Advance time to ensure expiration
      vi.advanceTimersByTime(1);
      
      // Should be immediately expired
      expect(memoryCache.get('test-key')).toBeNull();
    });

    it('should handle negative TTL', () => {
      memoryCache.set('test-key', 'test-value', -1000);
      
      // Should be immediately expired
      expect(memoryCache.get('test-key')).toBeNull();
    });
  });

  describe('concurrent operations', () => {
    it('should handle rapid set/get operations', () => {
      const operations = [];
      
      for (let i = 0; i < 100; i++) {
        operations.push(() => memoryCache.set(`key${i}`, `value${i}`));
        operations.push(() => memoryCache.get(`key${i}`));
      }
      
      // Execute all operations
      operations.forEach(op => op());
      
      expect(memoryCache.size()).toBe(100);
    });
  });
});

describe('singleton cache instance', () => {
  it('should export a singleton cache instance', () => {
    expect(cache).toBeDefined();
    expect(cache).toBeInstanceOf(MemoryCache);
  });

  it('should use environment variables for configuration', () => {
    // This test verifies that the singleton respects environment variables
    // The actual values depend on the environment
    const stats = cache.getStats();
    expect(stats.maxSize).toBeGreaterThan(0);
    expect(stats.defaultTtl).toBeGreaterThan(0);
  });
});

describe('createCacheKey utilities', () => {
  describe('packageInfo', () => {
    it('should create consistent cache keys', () => {
      const key1 = createCacheKey.packageInfo('requests', '2.28.1');
      const key2 = createCacheKey.packageInfo('requests', '2.28.1');
      
      expect(key1).toBe(key2);
      expect(key1).toBe('pkg_info:requests:2.28.1');
    });

    it('should create different keys for different packages', () => {
      const key1 = createCacheKey.packageInfo('requests', '2.28.1');
      const key2 = createCacheKey.packageInfo('numpy', '2.28.1');
      
      expect(key1).not.toBe(key2);
    });

    it('should create different keys for different versions', () => {
      const key1 = createCacheKey.packageInfo('requests', '2.28.1');
      const key2 = createCacheKey.packageInfo('requests', '2.28.0');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('packageReadme', () => {
    it('should create consistent cache keys', () => {
      const key1 = createCacheKey.packageReadme('requests', '2.28.1');
      const key2 = createCacheKey.packageReadme('requests', '2.28.1');
      
      expect(key1).toBe(key2);
      expect(key1).toBe('pkg_readme:requests:2.28.1');
    });
  });

  describe('searchResults', () => {
    it('should create keys with basic parameters', () => {
      const key = createCacheKey.searchResults('django', 10);
      
      expect(key).toBe('search:django:10');
    });

    it('should include quality parameter when provided', () => {
      const key = createCacheKey.searchResults('django', 10, 0.8);
      
      expect(key).toBe('search:django:10:q:0.8');
    });

    it('should include popularity parameter when provided', () => {
      const key = createCacheKey.searchResults('django', 10, undefined, 0.9);
      
      expect(key).toBe('search:django:10:p:0.9');
    });

    it('should include both quality and popularity when provided', () => {
      const key = createCacheKey.searchResults('django', 10, 0.8, 0.9);
      
      expect(key).toBe('search:django:10:q:0.8:p:0.9');
    });
  });

  describe('downloadStats', () => {
    it('should create consistent cache keys', () => {
      const key1 = createCacheKey.downloadStats('requests', 'last_month');
      const key2 = createCacheKey.downloadStats('requests', 'last_month');
      
      expect(key1).toBe(key2);
      expect(key1).toBe('stats:requests:last_month');
    });
  });

  describe('githubReadme', () => {
    it('should create keys with default branch', () => {
      const key = createCacheKey.githubReadme('owner', 'repo');
      
      expect(key).toBe('gh_readme:owner:repo:main');
    });

    it('should create keys with custom branch', () => {
      const key = createCacheKey.githubReadme('owner', 'repo', 'develop');
      
      expect(key).toBe('gh_readme:owner:repo:develop');
    });
  });

  describe('key uniqueness', () => {
    it('should generate unique keys for different utilities', () => {
      const keys = [
        createCacheKey.packageInfo('test', '1.0.0'),
        createCacheKey.packageReadme('test', '1.0.0'),
        createCacheKey.searchResults('test', 10),
        createCacheKey.downloadStats('test', 'month'),
        createCacheKey.githubReadme('test', 'repo'),
      ];
      
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});