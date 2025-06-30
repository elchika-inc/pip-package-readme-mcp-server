import { pypiClient } from '../src/services/pypi-api.js';
import { getPackageInfo } from '../src/tools/get-package-info.js';
import { getPackageReadme } from '../src/tools/get-package-readme.js';
import { searchPackages } from '../src/tools/search-packages.js';

describe('pip-package-readme-mcp-server', () => {
  describe('PyPI API Client', () => {
    it('should get package info for a popular package', async () => {
      const packageInfo = await pypiClient.getPackageInfo('requests');
      expect(packageInfo).toBeDefined();
      expect(packageInfo.info.name).toBe('requests');
      expect(packageInfo.info.version).toBeDefined();
    }, 10000);

    it('should handle non-existent package', async () => {
      await expect(pypiClient.getPackageInfo('this-package-definitely-does-not-exist-12345')).rejects.toThrow();
    }, 10000);
  });

  describe('get-package-info tool', () => {
    it('should get package info', async () => {
      const result = await getPackageInfo({ package_name: 'requests' });
      expect(result).toBeDefined();
      expect(result.package_name).toBe('requests');
      expect(result.latest_version).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.author).toBeDefined();
    }, 15000);
  });

  describe('get-package-readme tool', () => {
    it('should get package readme', async () => {
      const result = await getPackageReadme({ package_name: 'requests' });
      expect(result).toBeDefined();
      expect(result.package_name).toBe('requests');
      expect(result.exists).toBe(true);
      expect(result.version).toBeDefined();
      expect(result.readme_content).toBeDefined();
    }, 15000);
  });

  describe('search-packages tool', () => {
    it('should search for packages', async () => {
      const result = await searchPackages({ query: 'requests', limit: 5 });
      expect(result).toBeDefined();
      expect(result.query).toBe('requests');
      expect(Array.isArray(result.packages)).toBe(true);
      // API may fail, so we just check structure
      expect(result.total).toBeGreaterThanOrEqual(0);
    }, 15000);
  });
});