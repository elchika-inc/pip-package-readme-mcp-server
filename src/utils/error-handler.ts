import { logger } from './logger.js';
import { 
  PackageReadmeMcpError, 
  PackageNotFoundError, 
  RateLimitError, 
  NetworkError 
} from '../types/index.js';

export function handleHttpError(
  status: number, 
  response: Response, 
  context: string
): never {
  logger.error(`HTTP error ${status} from ${context}`, { 
    status, 
    statusText: response.statusText, 
    url: response.url 
  });

  switch (status) {
    case 404:
      throw new PackageNotFoundError(context);
    case 429:
      const retryAfter = response.headers.get('retry-after');
      throw new RateLimitError(context, retryAfter ? parseInt(retryAfter) : undefined);
    case 500:
    case 502:
    case 503:
    case 504:
      throw new NetworkError(`Server error ${status} from ${context}`);
    default:
      throw new PackageReadmeMcpError(
        `HTTP error ${status} from ${context}`,
        'HTTP_ERROR',
        status
      );
  }
}

export function handleApiError(error: unknown, context: string): never {
  logger.error(`API error from ${context}`, { error });

  if (error instanceof PackageReadmeMcpError) {
    throw error;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    throw new NetworkError(`Network error from ${context}`, error as Error);
  }

  if (error instanceof Error) {
    throw new PackageReadmeMcpError(
      `API error from ${context}: ${error.message}`,
      'API_ERROR',
      undefined,
      error
    );
  }

  throw new PackageReadmeMcpError(
    `Unknown error from ${context}`,
    'UNKNOWN_ERROR',
    undefined,
    error
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Attempting ${context} (attempt ${attempt}/${maxRetries})`);
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`${context} succeeded on attempt ${attempt}/${maxRetries}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof PackageNotFoundError || 
          error instanceof PackageReadmeMcpError && error.statusCode === 404) {
        logger.debug(`Not retrying ${context} due to 404 error`);
        throw error;
      }

      // Don't retry on client errors (4xx except 429)
      if (error instanceof PackageReadmeMcpError && 
          error.statusCode && 
          error.statusCode >= 400 && 
          error.statusCode < 500 && 
          error.statusCode !== 429) {
        logger.debug(`Not retrying ${context} due to client error ${error.statusCode}`);
        throw error;
      }

      if (attempt === maxRetries) {
        logger.error(`${context} failed after ${maxRetries} attempts`, { error });
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      logger.debug(`${context} failed on attempt ${attempt}, retrying in ${delay}ms`, { error });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}