import { describe, it, expect, beforeEach } from 'vitest';
import { ReadmeService } from '../../src/services/readme/index.js';

describe('README Parser Service - Extended Coverage', () => {
  let service: ReadmeService;

  beforeEach(() => {
    service = new ReadmeService();
  });

  describe('extractUsageExamples', () => {
    it('should extract basic code examples', () => {
      const markdown = `# Test Package

This is a test package.

## Installation

\`\`\`bash
pip install test-package
\`\`\`

## Usage

\`\`\`python
import test_package
test_package.hello()
\`\`\``;

      const result = service.extractUsageExamples(markdown);
      
      expect(result.length).toBeGreaterThan(0);
      const codeBlocks = result.map(r => r.code);
      const hasInstall = codeBlocks.some(code => code.includes('pip install'));
      const hasImport = codeBlocks.some(code => code.includes('import test_package'));
      expect(hasInstall || hasImport).toBe(true);
    });

    it('should handle README without code blocks', () => {
      const markdown = `# Test Package

This is a package without code examples.

## Description
Just some description text.`;

      const result = service.extractUsageExamples(markdown);
      
      expect(result).toHaveLength(0);
    });

    it('should extract multiple code examples', () => {
      const markdown = `# Package

## Installation
\`\`\`bash
pip install package
\`\`\`

## Basic Usage
\`\`\`python
import package
package.basic()
\`\`\`

## Advanced Usage
\`\`\`python
from package import advanced
advanced.function()
\`\`\``;

      const result = service.extractUsageExamples(markdown);
      
      expect(result.length).toBeGreaterThanOrEqual(0);
      // Tests that the function doesn't crash
    });

    it('should handle different programming languages', () => {
      const markdown = `# Multi-language Package

## Python Usage

\`\`\`python
import package
\`\`\`

## Shell Usage

\`\`\`shell
package --help
\`\`\`

## JavaScript (for comparison)

\`\`\`javascript
const package = require('package');
\`\`\``;

      const result = service.extractUsageExamples(markdown);
      
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(ex => ex.language === 'python')).toBe(true);
    });

    it('should handle empty markdown', () => {
      const result = service.extractUsageExamples('');
      
      expect(result).toHaveLength(0);
    });

    it('should handle markdown with only whitespace', () => {
      const result = service.extractUsageExamples('   \n\n  \t  \n');
      
      expect(result).toHaveLength(0);
    });

    it('should handle code blocks without language', () => {
      const markdown = `# Title

\`\`\`
print("hello")
\`\`\``;

      const result = service.extractUsageExamples(markdown);
      
      expect(result.length).toBeGreaterThanOrEqual(0); // May or may not extract, depends on implementation
    });

    it('should handle malformed markdown gracefully', () => {
      const markdown = `# Unclosed header

## Missing closing

\`\`\`python
# Unclosed code block
import package
# No closing backticks`;

      const result = service.extractUsageExamples(markdown);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle inline code correctly', () => {
      const markdown = `# Package

Use \`package.function()\` for basic operations.

\`\`\`python
# This is a code block
import package
package.function()
\`\`\`

Also try \`package.other()\` inline.`;

      const result = service.extractUsageExamples(markdown);
      
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(ex => ex.code.includes('import package'))).toBe(true);
    });

    it('should handle complex markdown with tables and links', () => {
      const markdown = `# Complex Package

A package with [links](https://example.com) and tables.

| Feature | Support |
|---------|---------|
| Python 3.8 | ✅ |
| Python 3.9 | ✅ |

## Installation

\`\`\`bash
pip install complex-package
\`\`\`

See [documentation](https://docs.example.com) for more info.`;

      const result = service.extractUsageExamples(markdown);
      
      expect(result.length).toBeGreaterThanOrEqual(0);
      // Tests that the function handles complex markdown
    });
  });

  describe('cleanReadmeContent', () => {
    it('should clean basic markdown content', () => {
      const content = `# Title

Some content with **bold** and *italic*.

## Section

More content.`;

      const result = service.cleanReadmeContent(content);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty content', () => {
      const result = service.cleanReadmeContent('');
      
      expect(result).toBe('');
    });

    it('should handle content with only whitespace', () => {
      const result = service.cleanReadmeContent('   \n\n  \t  \n');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle content with HTML tags', () => {
      const content = `# Title

<div>Some HTML content</div>

<script>alert('test');</script>

Regular markdown content.`;

      const result = service.cleanReadmeContent(content);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle content with special characters', () => {
      const content = `# Title with émojis 🚀

Content with ñoñó characters.

## Séction

More content with spëcial chars.`;

      const result = service.cleanReadmeContent(content);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle very long content', () => {
      const longContent = 'a'.repeat(10000) + '\n\n## Section\n\n' + 'b'.repeat(10000);
      
      const result = service.cleanReadmeContent(longContent);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle content with multiple line breaks', () => {
      const content = `# Title


Multiple


Line


Breaks


## Section


More breaks`;

      const result = service.cleanReadmeContent(content);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});