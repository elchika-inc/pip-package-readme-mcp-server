# pip-package-readme-mcp-server

[![npm version](https://img.shields.io/npm/v/pip-package-readme-mcp-server)](https://www.npmjs.com/package/pip-package-readme-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/pip-package-readme-mcp-server)](https://www.npmjs.com/package/pip-package-readme-mcp-server)
[![GitHub stars](https://img.shields.io/github/stars/naoto24kawa/package-readme-mcp-servers)](https://github.com/naoto24kawa/package-readme-mcp-servers)
[![GitHub issues](https://img.shields.io/github/issues/naoto24kawa/package-readme-mcp-servers)](https://github.com/naoto24kawa/package-readme-mcp-servers/issues)
[![license](https://img.shields.io/npm/l/pip-package-readme-mcp-server)](https://github.com/naoto24kawa/package-readme-mcp-servers/blob/main/LICENSE)

MCP server for fetching Python package README and usage information from PyPI.

## Features

- **Package README Retrieval**: Get comprehensive README content with usage examples from PyPI packages
- **Package Information**: Fetch detailed package metadata including dependencies, author, license, and statistics
- **Package Search**: Search for Python packages with quality and popularity filtering
- **GitHub Integration**: Fallback to GitHub repositories for README content when not available in PyPI
- **Smart Caching**: Intelligent caching system to improve performance and reduce API calls
- **Usage Example Extraction**: Automatically extract and categorize code examples from README files

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

## Usage

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Available Tools

#### 1. get_package_readme

Retrieves comprehensive README content and usage examples for a Python package.

**Parameters:**
- `package_name` (string, required): Name of the Python package
- `version` (string, optional): Package version (default: "latest") 
- `include_examples` (boolean, optional): Whether to extract usage examples (default: true)

**Example:**
```json
{
  "package_name": "requests",
  "version": "latest",
  "include_examples": true
}
```

#### 2. get_package_info

Fetches detailed package information including metadata and dependencies.

**Parameters:**
- `package_name` (string, required): Name of the Python package
- `include_dependencies` (boolean, optional): Include dependencies list (default: true)
- `include_dev_dependencies` (boolean, optional): Include dev dependencies (default: false)

**Example:**
```json
{
  "package_name": "django",
  "include_dependencies": true,
  "include_dev_dependencies": false
}
```

#### 3. search_packages

Search for Python packages with optional quality and popularity filtering.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Maximum results to return (default: 20, max: 250)
- `quality` (number, optional): Minimum quality score 0-1
- `popularity` (number, optional): Minimum popularity score 0-1

**Example:**
```json
{
  "query": "web framework",
  "limit": 10,
  "quality": 0.7,
  "popularity": 0.5
}
```

## Configuration

### Environment Variables

```bash
# Optional: GitHub token for enhanced README retrieval
GITHUB_TOKEN=your_github_token_here

# Optional: Cache configuration
CACHE_TTL=3600000          # Cache TTL in milliseconds (default: 1 hour)
CACHE_MAX_SIZE=104857600   # Max cache size in bytes (default: 100MB)

# Optional: Logging
LOG_LEVEL=info             # Log level: debug, info, warn, error

# Optional: Request timeout
REQUEST_TIMEOUT=30000      # Request timeout in milliseconds
```

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "pip-package-readme": {
      "command": "node",
      "args": ["/path/to/pip-package-readme-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

## API Integration

### PyPI Integration

The server integrates with:
- **PyPI JSON API**: `https://pypi.org/pypi/{package}/json` for package metadata
- **PyPI Simple API**: `https://pypi.org/simple/{package}/` for version information
- **GitHub API**: Fallback for README content when not available in PyPI

### Data Sources

1. **Primary**: PyPI official API for package information
2. **Fallback**: GitHub repositories for README content
3. **Search**: Mock implementation (PyPI search API was deprecated)

## Architecture

### Directory Structure

```
src/
├── index.ts              # Entry point
├── server.ts            # MCP server implementation
├── tools/               # Tool implementations
│   ├── get-package-readme.ts
│   ├── get-package-info.ts
│   └── search-packages.ts
├── services/            # External API clients
│   ├── pypi-api.ts      # PyPI API client
│   ├── github-api.ts    # GitHub API client
│   ├── cache.ts         # Caching system
│   └── readme-parser.ts # README parsing logic
├── utils/               # Utility functions
│   ├── logger.ts        # Logging system
│   ├── error-handler.ts # Error handling
│   └── validators.ts    # Input validation
└── types/               # TypeScript type definitions
    └── index.ts
```

### Key Components

- **PyPI Client**: Handles communication with PyPI APIs
- **GitHub Client**: Fetches README content from GitHub repositories
- **README Parser**: Extracts and categorizes usage examples from markdown
- **Cache System**: LRU cache with TTL for improved performance
- **Error Handler**: Robust error handling with retry logic
- **Validator**: Input validation for all parameters

## Development

### Scripts

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm run test

# Lint code
npm run lint

# Type checking
npm run typecheck
```

### Testing

Run the test suite:

```bash
npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Limitations

### Search Functionality

The PyPI search API was deprecated in 2018. The current search implementation is a simplified workaround. For production use, consider:

1. Using libraries.io API for comprehensive search
2. Implementing Elasticsearch with PyPI data
3. Using BigQuery public datasets
4. Building a custom search index

### Download Statistics

PyPI doesn't provide download statistics through their API. The current implementation returns zeros. For actual statistics, consider:

1. Using pypistats library
2. Querying BigQuery public datasets
3. Using third-party services like libraries.io

## License

MIT License - see LICENSE file for details.

## Related Projects

- [npm-package-readme-mcp-server](../npm-package-readme-mcp-server) - Similar server for npm packages
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Model Context Protocol SDK

## Support

For issues and questions:
1. Check the [issues](../../issues) page
2. Create a new issue with detailed information
3. Include error logs and reproduction steps