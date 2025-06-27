import { 
  BasePackageServer, 
  ToolDefinition, 
  PackageReadmeMcpError, 
  PackageValidator,
  GetPackageReadmeParams,
  GetPackageInfoParams,
  SearchPackagesParams,
} from '@elchika-inc/package-readme-shared';
import { getPackageReadme } from './tools/get-package-readme.js';
import { getPackageInfo } from './tools/get-package-info.js';
import { searchPackages } from './tools/search-packages.js';

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_readme_from_pip: {
    name: 'get_readme_from_pip',
    description: 'Get package README and usage examples from PyPI registry',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the Python package',
        },
        version: {
          type: 'string',
          description: 'The version of the package (default: "latest")',
          default: 'latest',
        },
        include_examples: {
          type: 'boolean',
          description: 'Whether to include usage examples (default: true)',
          default: true,
        }
      },
      required: ['package_name'],
    },
  },
  get_package_info_from_pip: {
    name: 'get_package_info_from_pip',
    description: 'Get package basic information and dependencies from PyPI registry',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the Python package',
        },
        include_dependencies: {
          type: 'boolean',
          description: 'Whether to include dependencies (default: true)',
          default: true,
        },
        include_dev_dependencies: {
          type: 'boolean',
          description: 'Whether to include development dependencies (default: false)',
          default: false,
        }
      },
      required: ['package_name'],
    },
  },
  search_packages_from_pip: {
    name: 'search_packages_from_pip',
    description: 'Search for packages in PyPI registry',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
          default: 20,
          minimum: 1,
          maximum: 250,
        },
        quality: {
          type: 'number',
          description: 'Minimum quality score (0-1)',
          minimum: 0,
          maximum: 1,
        },
        popularity: {
          type: 'number',
          description: 'Minimum popularity score (0-1)',
          minimum: 0,
          maximum: 1,
        }
      },
      required: ['query'],
    },
  },
} as const;

export class PackageReadmeMcpServer extends BasePackageServer {
  constructor() {
    super({
      name: 'pip-package-readme-mcp',
      version: '1.0.0',
    });
  }

  protected getToolDefinitions(): Record<string, ToolDefinition> {
    return TOOL_DEFINITIONS;
  }

  protected async handleToolCall(name: string, args: unknown): Promise<unknown> {
    // Validate that args is an object
    if (!args || typeof args !== 'object') {
      throw new PackageReadmeMcpError(
        'Tool arguments must be an object',
        'VALIDATION_ERROR'
      );
    }

    switch (name) {
      case 'get_readme_from_pip':
        return await this.handleGetPackageReadme(PackageValidator.validateGetPackageReadmeParams(args, 'pip'));
      
      case 'get_package_info_from_pip':
        return await this.handleGetPackageInfo(PackageValidator.validateGetPackageInfoParams(args, 'pip'));
      
      case 'search_packages_from_pip':
        return await this.handleSearchPackages(PackageValidator.validateSearchPackagesParams(args, 'pip'));
      
      default:
        throw new PackageReadmeMcpError(
          `Unknown tool: ${name}`,
          'VALIDATION_ERROR'
        );
    }
  }

  private async handleGetPackageReadme(params: GetPackageReadmeParams) {
    return await getPackageReadme(params);
  }

  private async handleGetPackageInfo(params: GetPackageInfoParams) {
    return await getPackageInfo(params);
  }

  private async handleSearchPackages(params: SearchPackagesParams) {
    return await searchPackages(params);
  }

}

export default PackageReadmeMcpServer;