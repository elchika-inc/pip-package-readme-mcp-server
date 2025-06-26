import { validatePackageName } from '../src/utils/validators.js';
import { PackageReadmeMcpError } from '../src/types/index.js';

describe('PyPI Package Validation Tests', () => {
  describe('validatePackageName', () => {
    test('valid package names should pass', () => {
      const validNames = [
        'requests',
        'Django',
        'django-rest-framework',
        'Django-Rest-Framework',
        'my_package',
        'MyPackage',
        'numpy',
        'scipy',
        'matplotlib',
        'package123',
        'package_name',
        'package-name',
        'Package.Name',
        'a',
        'A',
        'valid_package_name',
        'valid-package-name',
        'valid.package.name',
        'Package_With_Underscores',
        'Package-With-Hyphens',
        'Package.With.Dots',
        'MixedCase123Package'
      ];

      validNames.forEach(name => {
        expect(() => validatePackageName(name)).not.toThrow();
      });
    });

    describe('invalid package names should fail with specific errors', () => {
      test('requests should pass (valid)', () => {
        expect(() => validatePackageName('requests')).not.toThrow();
      });

      test('Django-Rest-Framework should pass (valid - mixed case, hyphens)', () => {
        expect(() => validatePackageName('Django-Rest-Framework')).not.toThrow();
      });

      test('my_package should pass (valid)', () => {
        expect(() => validatePackageName('my_package')).not.toThrow();
      });

      test('123invalid should pass (valid - can start with number)', () => {
        expect(() => validatePackageName('123invalid')).not.toThrow();
      });

      test('package- should fail (invalid - ends with hyphen)', () => {
        expect(() => validatePackageName('package-')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('package-');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('must end with a letter or number');
          expect(error.message).toContain('package');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('package_ should fail (invalid - ends with underscore)', () => {
        expect(() => validatePackageName('package_')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('package_');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('must end with a letter or number');
          expect(error.message).toContain('package');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('.package should fail (invalid - starts with dot)', () => {
        expect(() => validatePackageName('.package')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('.package');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('must start with a letter or number');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('package. should fail (invalid - ends with dot)', () => {
        expect(() => validatePackageName('package.')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('package.');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('must end with a letter or number');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('-package should fail (invalid - starts with hyphen)', () => {
        expect(() => validatePackageName('-package')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('-package');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('must start with a letter or number');
          expect(error.message).toContain('package');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('_package should fail (invalid - starts with underscore)', () => {
        expect(() => validatePackageName('_package')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('_package');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('must start with a letter or number');
          expect(error.message).toContain('package');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('package..name should fail (invalid - consecutive dots)', () => {
        expect(() => validatePackageName('package..name')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('package..name');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('cannot contain consecutive dots');
          expect(error.message).toContain('package.name');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('package--name should fail (invalid - consecutive hyphens)', () => {
        expect(() => validatePackageName('package--name')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('package--name');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('cannot contain consecutive hyphens');
          expect(error.message).toContain('package-name');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('package__name should fail (invalid - consecutive underscores)', () => {
        expect(() => validatePackageName('package__name')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('package__name');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('cannot contain consecutive underscores');
          expect(error.message).toContain('package_name');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('empty string should fail', () => {
        expect(() => validatePackageName('')).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName('');
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('Package name is required');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('reserved names should fail', () => {
        const reservedNames = ['pip', 'setuptools', 'wheel', 'distutils', 'python', 'stdlib'];
        
        reservedNames.forEach(name => {
          expect(() => validatePackageName(name)).toThrow(PackageReadmeMcpError);
          try {
            validatePackageName(name);
          } catch (error) {
            expect(error).toBeInstanceOf(PackageReadmeMcpError);
            expect(error.message).toContain('is reserved by PyPI');
            expect(error.code).toBe('INVALID_PACKAGE_NAME');
          }
        });
      });

      test('package names with invalid characters should fail', () => {
        const invalidNames = [
          'package!name',
          'package@name',
          'package#name',
          'package$name',
          'package%name',
          'package&name',
          'package*name',
          'package+name',
          'package=name',
          'package?name',
          'package[name]',
          'package{name}',
          'package|name',
          'package\\name',
          'package"name',
          "package'name",
          'package name', // spaces
          'package/name', // slashes
          'package<name>',
          'package;name',
          'package:name'
        ];

        invalidNames.forEach(name => {
          expect(() => validatePackageName(name)).toThrow(PackageReadmeMcpError);
          try {
            validatePackageName(name);
          } catch (error) {
            expect(error).toBeInstanceOf(PackageReadmeMcpError);
            // Different names fail at different validation steps
            expect(error.message).toMatch(/contains invalid characters|must end with a letter or number|must start with a letter or number/);
            expect(error.code).toBe('INVALID_PACKAGE_NAME');
          }
        });
      });

      test('excessively long package names should fail', () => {
        const longName = 'a'.repeat(215);
        expect(() => validatePackageName(longName)).toThrow(PackageReadmeMcpError);
        try {
          validatePackageName(longName);
        } catch (error) {
          expect(error).toBeInstanceOf(PackageReadmeMcpError);
          expect(error.message).toContain('too long');
          expect(error.message).toContain('214 characters or fewer');
          expect(error.code).toBe('INVALID_PACKAGE_NAME');
        }
      });

      test('non-string input should fail', () => {
        expect(() => validatePackageName(123)).toThrow(PackageReadmeMcpError);
        expect(() => validatePackageName(null)).toThrow(PackageReadmeMcpError);
        expect(() => validatePackageName(undefined)).toThrow(PackageReadmeMcpError);
        expect(() => validatePackageName({})).toThrow(PackageReadmeMcpError);
      });
    });

    test('package names with whitespace should be trimmed and validated', () => {
      // Valid names should pass after trimming
      expect(() => validatePackageName('  requests  ')).not.toThrow();
      expect(() => validatePackageName('\tdjango\n')).not.toThrow();
      expect(() => validatePackageName('  123invalid  ')).not.toThrow(); // starts with number is valid
      
      // Invalid names should still fail even after trimming
      expect(() => validatePackageName('  package-  ')).toThrow(); // still ends with hyphen after trimming
      expect(() => validatePackageName('  -package  ')).toThrow(); // still starts with hyphen after trimming
    });

    test('edge cases should be handled correctly', () => {
      // Single character names
      expect(() => validatePackageName('a')).not.toThrow();
      expect(() => validatePackageName('A')).not.toThrow();
      expect(() => validatePackageName('1')).not.toThrow();
      
      // Exactly at length limit
      const exactly214 = 'a'.repeat(214);
      expect(() => validatePackageName(exactly214)).not.toThrow();
      
      // Just over length limit
      const exactly215 = 'a'.repeat(215);
      expect(() => validatePackageName(exactly215)).toThrow();
    });
  });
});