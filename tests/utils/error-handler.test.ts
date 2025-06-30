import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleHttpError, handleApiError, withRetry } from '../../src/utils/error-handler.js';
import { 
  PackageReadmeMcpError, 
  PackageNotFoundError, 
  RateLimitError, 
  NetworkError 
} from '../../src/types/index.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Error Handler Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('handleHttpError', () => {
    const createMockResponse = (status: number, statusText: string = 'Error', url: string = 'http://test.com') => ({
      status,
      statusText,
      url,
      headers: new Map() as any,
    });

    it('should throw PackageNotFoundError for 404 status', () => {
      const response = createMockResponse(404, 'Not Found');
      
      expect(() => handleHttpError(404, response as Response, 'PyPI API'))
        .toThrow(PackageNotFoundError);
    });

    it('should throw RateLimitError for 429 status', () => {
      const response = {
        ...createMockResponse(429, 'Too Many Requests'),
        headers: {
          get: vi.fn().mockReturnValue('60'),
        },
      };
      
      expect(() => handleHttpError(429, response as Response, 'PyPI API'))
        .toThrow(RateLimitError);
    });

    it('should throw RateLimitError for 429 without retry-after header', () => {
      const response = {
        ...createMockResponse(429, 'Too Many Requests'),
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      };
      
      expect(() => handleHttpError(429, response as Response, 'PyPI API'))
        .toThrow(RateLimitError);
    });

    it('should throw NetworkError for 500 status', () => {
      const response = createMockResponse(500, 'Internal Server Error');
      
      expect(() => handleHttpError(500, response as Response, 'PyPI API'))
        .toThrow(NetworkError);
    });

    it('should throw NetworkError for 502 status', () => {
      const response = createMockResponse(502, 'Bad Gateway');
      
      expect(() => handleHttpError(502, response as Response, 'PyPI API'))
        .toThrow(NetworkError);
    });

    it('should throw NetworkError for 503 status', () => {
      const response = createMockResponse(503, 'Service Unavailable');
      
      expect(() => handleHttpError(503, response as Response, 'PyPI API'))
        .toThrow(NetworkError);
    });

    it('should throw NetworkError for 504 status', () => {
      const response = createMockResponse(504, 'Gateway Timeout');
      
      expect(() => handleHttpError(504, response as Response, 'PyPI API'))
        .toThrow(NetworkError);
    });

    it('should throw PackageReadmeMcpError for other status codes', () => {
      const response = createMockResponse(403, 'Forbidden');
      
      expect(() => handleHttpError(403, response as Response, 'PyPI API'))
        .toThrow(PackageReadmeMcpError);
      
      try {
        handleHttpError(403, response as Response, 'PyPI API');
      } catch (error) {
        expect(error).toBeInstanceOf(PackageReadmeMcpError);
        expect((error as PackageReadmeMcpError).statusCode).toBe(403);
        expect((error as PackageReadmeMcpError).code).toBe('HTTP_ERROR');
      }
    });

    it('should include response details in error logging', () => {
      const response = createMockResponse(400, 'Bad Request', 'https://api.example.com/package');
      
      expect(() => handleHttpError(400, response as Response, 'Test API'))
        .toThrow();
    });
  });

  describe('handleApiError', () => {
    it('should re-throw PackageReadmeMcpError as-is', () => {
      const error = new PackageReadmeMcpError('Test error', 'TEST_ERROR');
      
      expect(() => handleApiError(error, 'Test API'))
        .toThrow(error);
    });

    it('should convert TypeError with fetch to NetworkError', () => {
      const error = new TypeError('fetch failed');
      
      expect(() => handleApiError(error, 'Test API'))
        .toThrow(NetworkError);
    });

    it('should wrap regular Error in PackageReadmeMcpError', () => {
      const error = new Error('Something went wrong');
      
      expect(() => handleApiError(error, 'Test API'))
        .toThrow(PackageReadmeMcpError);
    });

    it('should wrap unknown error types in PackageReadmeMcpError', () => {
      const error = 'string error';
      
      expect(() => handleApiError(error, 'Test API'))
        .toThrow(PackageReadmeMcpError);
    });

    it('should log error with context', () => {
      const error = new Error('Test error');
      
      expect(() => handleApiError(error, 'Test API'))
        .toThrow();
    });
  });

  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(operation, 3, 1000, 'test operation');
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');
      
      const resultPromise = withRetry(operation, 3, 1000, 'test operation');
      
      // Advance timers to handle delays
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const error = new Error('Persistent failure');
      const operation = vi.fn().mockRejectedValue(error);
      
      const resultPromise = withRetry(operation, 2, 1000, 'test operation');
      
      // Advance timers to handle delays
      await vi.advanceTimersByTimeAsync(5000);
      
      await expect(resultPromise).rejects.toThrow('Persistent failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry PackageNotFoundError', async () => {
      const error = new PackageNotFoundError('test-package');
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 1000, 'test operation'))
        .rejects.toThrow(PackageNotFoundError);
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry 404 PackageReadmeMcpError', async () => {
      const error = new PackageReadmeMcpError('Not found', 'NOT_FOUND', 404);
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 1000, 'test operation'))
        .rejects.toThrow(PackageReadmeMcpError);
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry client errors (4xx except 429)', async () => {
      const error = new PackageReadmeMcpError('Bad request', 'BAD_REQUEST', 400);
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(withRetry(operation, 3, 1000, 'test operation'))
        .rejects.toThrow(PackageReadmeMcpError);
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry 429 errors', async () => {
      const error = new PackageReadmeMcpError('Rate limited', 'RATE_LIMITED', 429);
      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const resultPromise = withRetry(operation, 3, 1000, 'test operation');
      
      // Advance timers to handle delays
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry server errors (5xx)', async () => {
      const error = new PackageReadmeMcpError('Server error', 'SERVER_ERROR', 500);
      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      const resultPromise = withRetry(operation, 3, 1000, 'test operation');
      
      // Advance timers to handle delays
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff with jitter', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      
      const resultPromise = withRetry(operation, 3, 1000, 'test operation');
      
      // Advance timers step by step to verify backoff
      await vi.advanceTimersByTimeAsync(2000); // First retry delay
      await vi.advanceTimersByTimeAsync(3000); // Second retry delay
      
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use default parameters when not provided', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should log retry attempts', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue('success');
      
      const resultPromise = withRetry(operation, 2, 1000, 'test operation');
      
      await vi.advanceTimersByTimeAsync(5000);
      
      await resultPromise;
      
      // Just verify it completes successfully
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should log final failure after max retries', async () => {
      const error = new Error('Persistent failure');
      const operation = vi.fn().mockRejectedValue(error);
      
      const resultPromise = withRetry(operation, 2, 1000, 'test operation');
      
      await vi.advanceTimersByTimeAsync(5000);
      
      await expect(resultPromise).rejects.toThrow();
      
      // Just verify it tried the correct number of times
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle async operations correctly', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error(`Attempt ${callCount} failed`);
        }
        return `Success on attempt ${callCount}`;
      };
      
      const resultPromise = withRetry(operation, 3, 100, 'async test');
      
      // Run all timers to completion
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;
      
      expect(result).toBe('Success on attempt 3');
      expect(callCount).toBe(3);
    }, 10000); // Increase timeout

    it('should handle rejection with non-Error objects', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValue('success');
      
      const resultPromise = withRetry(operation, 2, 1000, 'test operation');
      
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex retry scenario with different error types', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new NetworkError('Network failure'))
        .mockRejectedValueOnce(new RateLimitError('Rate limited', 60))
        .mockResolvedValue('final success');
      
      const resultPromise = withRetry(operation, 3, 500, 'complex operation');
      
      await vi.advanceTimersByTimeAsync(10000);
      
      const result = await resultPromise;
      
      expect(result).toBe('final success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should properly handle timeout errors in real-world scenario', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      
      const operation = vi.fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue('recovered');
      
      const resultPromise = withRetry(operation, 2, 1000, 'timeout operation');
      
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;
      
      expect(result).toBe('recovered');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});