#!/usr/bin/env node

import { logger } from './utils/logger.js';
import PackageReadmeMcpServer from './server.js';

async function main() {
  try {
    logger.info('Starting pip-package-readme-mcp server...');
    
    const server = new PackageReadmeMcpServer();
    
    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        logger.info('Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });

    // Start the server
    await server.run();
    logger.info('pip-package-readme-mcp server started successfully');
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});