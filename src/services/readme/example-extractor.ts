import { logger } from '../../utils/logger.js';
import { UsageExample } from '../../types/index.js';
import { README_CONFIG } from '../../config/constants.js';

export class ExampleExtractor {
  /**
   * Extracts usage examples from README content
   */
  extractUsageExamples(readmeContent: string): UsageExample[] {
    try {
      const blockExamples = this.extractBlockExamples(readmeContent);
      const inlineExamples = this.extractInlineExamples(readmeContent);
      
      const allExamples = [...blockExamples, ...inlineExamples];
      logger.debug(`Extracted ${allExamples.length} raw examples from README`);
      
      return allExamples.slice(0, README_CONFIG.MAX_EXAMPLES);
      
    } catch (error) {
      logger.error('Failed to extract usage examples from README', { error });
      return [];
    }
  }

  /**
   * Extracts code block examples from README content
   */
  private extractBlockExamples(readmeContent: string): UsageExample[] {
    const examples: UsageExample[] = [];
    const lines = readmeContent.split('\n');
    
    let currentSection = '';
    let inCodeBlock = false;
    let currentCodeBlock = '';
    let currentLanguage = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Detect section headers
      if (trimmedLine.match(/^#+\s/)) {
        currentSection = trimmedLine.replace(/^#+\s*/, '').toLowerCase();
      }
      
      // Detect code block start/end
      if (trimmedLine.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting a code block
          inCodeBlock = true;
          currentCodeBlock = '';
          currentLanguage = this.extractLanguage(trimmedLine);
        } else {
          // Ending a code block
          inCodeBlock = false;
          
          if (this.isLikelyUsageExample(currentCodeBlock, currentLanguage, currentSection)) {
            examples.push({
              title: this.formatTitle(currentSection) || 'Code Example',
              code: currentCodeBlock.trim(),
              language: currentLanguage || 'python',
            });
          }
          currentCodeBlock = '';
        }
      } else if (inCodeBlock) {
        currentCodeBlock += line + '\n';
      }
    }
    
    return examples;
  }

  /**
   * Extracts inline code examples
   */
  private extractInlineExamples(content: string): UsageExample[] {
    const examples: UsageExample[] = [];
    
    // Find inline code that looks like imports or simple usage
    const inlineCodeRegex = /`([^`]+)`/g;
    let match;
    
    while ((match = inlineCodeRegex.exec(content)) !== null) {
      const code = match[1].trim();
      
      if (this.isSimpleUsageExample(code)) {
        examples.push({
          title: 'Quick Example',
          code,
          language: 'python',
        });
      }
    }
    
    return examples;
  }

  private extractLanguage(codeFenceLine: string): string {
    const match = codeFenceLine.match(/^```(\w+)/);
    return match ? match[1].toLowerCase() : 'python';
  }

  private isUsageSection(sectionName: string): boolean {
    const usageKeywords = ['usage', 'example', 'quickstart', 'getting started', 'how to', 'tutorial'];
    return usageKeywords.some(keyword => sectionName.includes(keyword));
  }

  private isLikelyUsageExample(code: string, language: string, section: string): boolean {
    const trimmedCode = code.trim();
    
    if (trimmedCode.length < README_CONFIG.MIN_CODE_BLOCK_LENGTH || 
        trimmedCode.length > README_CONFIG.MAX_CODE_BLOCK_LENGTH) {
      return false;
    }
    
    if (language && !this.isRelevantLanguage(language)) {
      return false;
    }
    
    if (this.isOutputOnly(trimmedCode)) {
      return false;
    }
    
    return this.hasUsageIndicators(trimmedCode, language, section);
  }

  private isRelevantLanguage(language: string): boolean {
    const relevantLanguages = ['python', 'py', 'bash', 'shell', 'sh', 'text', ''];
    return relevantLanguages.includes(language.toLowerCase());
  }

  private isOutputOnly(code: string): boolean {
    // Check if it's likely output (no Python keywords, just results)
    const pythonKeywords = ['import', 'from', 'def', 'class', 'if', 'for', 'while', 'try', 'with', '='];
    return !pythonKeywords.some(keyword => code.includes(keyword));
  }

  private hasUsageIndicators(code: string, language: string, section: string): boolean {
    // Check for import statements
    if (code.includes('import ') || code.includes('from ')) {
      return true;
    }
    
    // Check if in usage section
    if (this.isUsageSection(section)) {
      return true;
    }
    
    // Check for assignment or function calls
    if (code.includes('=') && !code.includes('==')) {
      return true;
    }
    
    return false;
  }

  private isSimpleUsageExample(code: string): boolean {
    return code.includes('import ') || 
           (code.includes('=') && !code.includes('==')) ||
           Boolean(code.match(/^\w+\.\w+\(/));
  }

  private formatTitle(section: string): string {
    return section
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}