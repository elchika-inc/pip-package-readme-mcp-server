import { logger } from '../utils/logger.js';
import { validatePackageName, validateVersion } from '../utils/validators-simple.js';
import { PackageReadmeService } from '../services/package-readme/index.js';
import {
  GetPackageReadmeParams,
  PackageReadmeResponse,
} from '../types/index.js';

const packageReadmeService = new PackageReadmeService();

export async function getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
  const { 
    package_name, 
    version = 'latest',
    include_examples = true 
  } = params;

  // Validate inputs
  validatePackageName(package_name);
  if (version !== 'latest') {
    validateVersion(version);
  }

  // Delegate to service
  return await packageReadmeService.getPackageReadme(params);
}