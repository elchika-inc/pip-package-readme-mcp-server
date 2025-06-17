import { logger } from '../utils/logger.js';
import { UsageExample } from '../types/index.js';

export class ReadmeParser {
  /**
   * Extracts usage examples from README content
   */
  extractUsageExamples(readmeContent: string): UsageExample[] {
    const examples: UsageExample[] = [];
    
    try {
      // Split content into lines for processing
      const lines = readmeContent.split('\n');
      let currentSection = '';
      let inCodeBlock = false;
      let currentCodeBlock = '';
      let currentLanguage = '';
      let currentTitle = '';
      let currentDescription = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Detect section headers
        if (trimmedLine.match(/^#+\s/)) {
          currentSection = trimmedLine.replace(/^#+\s*/, '').toLowerCase();
          
          // Check if this is a usage-related section
          if (this.isUsageSection(currentSection)) {
            currentTitle = currentSection;
            currentDescription = '';
          }
        }
        
        // Detect code block start/end
        if (trimmedLine.startsWith('```')) {
          if (!inCodeBlock) {
            // Starting a code block
            inCodeBlock = true;
            currentCodeBlock = '';
            currentLanguage = this.extractLanguage(trimmedLine);
            
            // Use section title if we don't have a specific title
            if (!currentTitle && currentSection) {
              currentTitle = this.formatTitle(currentSection);
            }
          } else {
            // Ending a code block
            inCodeBlock = false;
            
            // Only add if it's likely a usage example
            if (this.isLikelyUsageExample(currentCodeBlock, currentLanguage, currentTitle)) {
              examples.push({
                title: currentTitle || 'Code Example',
                description: currentDescription || undefined,
                code: currentCodeBlock.trim(),
                language: currentLanguage || 'python',
              });
            }
            
            // Reset for next code block
            currentCodeBlock = '';
            currentTitle = '';
            currentDescription = '';
          }
        } else if (inCodeBlock) {
          // Inside a code block
          currentCodeBlock += line + '\n';
        } else if (this.isUsageSection(currentSection) && trimmedLine && !trimmedLine.startsWith('#')) {
          // Collect description text in usage sections
          if (currentDescription) {
            currentDescription += ' ';
          }
          currentDescription += trimmedLine;
        }
      }
      
      // Also look for inline code examples
      examples.push(...this.extractInlineExamples(readmeContent));
      
      // Deduplicate and sort by relevance
      const uniqueExamples = this.deduplicateExamples(examples);
      const sortedExamples = this.sortExamplesByRelevance(uniqueExamples);
      
      logger.debug(`Extracted ${sortedExamples.length} usage examples from README`);
      return sortedExamples;
      
    } catch (error) {
      logger.error('Failed to extract usage examples from README', { error });
      return [];
    }
  }

  private isUsageSection(sectionName: string): boolean {
    const usageSections = [
      'usage',
      'examples',
      'example',
      'quick start',
      'quickstart',
      'getting started',
      'tutorial',
      'how to use',
      'basic usage',
      'installation and usage',
      'api usage',
      'code example',
      'sample code',
      'demo',
    ];
    
    return usageSections.some(section => 
      sectionName.includes(section) || section.includes(sectionName)
    );
  }

  private extractLanguage(codeBlockLine: string): string {
    const match = codeBlockLine.match(/^```(\w+)/);
    if (match) {
      const lang = match[1].toLowerCase();
      // Map common language aliases to standard names
      const languageMap: Record<string, string> = {
        'py': 'python',
        'python3': 'python',
        'bash': 'bash',
        'shell': 'bash',
        'sh': 'bash',
        'console': 'bash',
        'terminal': 'bash',
        'cmd': 'bash',
        'yaml': 'yaml',
        'yml': 'yaml',
        'json': 'json',
        'toml': 'toml',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'ini',
      };
      return languageMap[lang] || lang;
    }
    return 'python'; // Default to Python for Python packages
  }

  private formatTitle(section: string): string {
    return section
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isLikelyUsageExample(code: string, language: string, title: string): boolean {
    // Skip if code is too short or too long
    if (code.trim().length < 10 || code.trim().length > 5000) {
      return false;
    }
    
    // Skip if it's not a relevant language
    const relevantLanguages = ['python', 'bash', 'yaml', 'json', 'toml', 'ini'];
    if (language && !relevantLanguages.includes(language)) {
      return false;
    }
    
    // Skip output-only blocks
    if (this.isOutputOnly(code)) {
      return false;
    }
    
    // Prefer Python code for Python packages
    if (language === 'python') {
      return true;
    }
    
    // Check for installation commands
    if (language === 'bash' && (code.includes('pip install') || code.includes('pipx install'))) {
      return true;
    }
    
    // Check for configuration files
    if (['yaml', 'json', 'toml', 'ini'].includes(language)) {
      return true;
    }
    
    // Check title for usage indicators
    if (title && this.isUsageSection(title.toLowerCase())) {
      return true;
    }
    
    return false;
  }

  private isOutputOnly(code: string): boolean {
    const lines = code.trim().split('\n');
    
    // Check if all lines look like output (no commands or imports)
    const outputPatterns = [
      /^[>\s]*\d+/,  // Line numbers
      /^[>\s]*\w+:/, // Key-value pairs
      /^[>\s]*\|/,   // Table borders
      /^[>\s]*\+/,   // Table corners
      /^[>\s]*=/,    // Separators
      /^[>\s]*-/,    // Dashes
    ];
    
    const codePatterns = [
      /^(import|from)\s+\w+/,  // Python imports
      /^def\s+\w+/,            // Python functions
      /^class\s+\w+/,          // Python classes
      /^pip\s+install/,        // pip commands
      /^python\s+/,            // Python execution
      /^\w+\s*=/,              // Variable assignments
    ];
    
    let outputLines = 0;
    let codeLines = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (outputPatterns.some(pattern => pattern.test(trimmed))) {
        outputLines++;
      } else if (codePatterns.some(pattern => pattern.test(trimmed))) {
        codeLines++;
      }
    }
    
    // If most lines look like output and no code patterns, it's probably output
    return outputLines > codeLines && outputLines > lines.length * 0.6;
  }

  private extractInlineExamples(content: string): UsageExample[] {
    const examples: UsageExample[] = [];
    
    // Look for Python import statements as basic usage
    const importMatch = content.match(/^(?:from\s+\w+\s+)?import\s+[\w\s,]+$/gm);
    if (importMatch && importMatch.length > 0) {
      const imports = importMatch.slice(0, 3).join('\n'); // Take first 3 imports
      examples.push({
        title: 'Basic Import',
        code: imports,
        language: 'python',
      });
    }
    
    // Look for simple one-liner examples in backticks
    const inlineCodeRegex = /`([^`]+)`/g;
    const inlineMatches = Array.from(content.matchAll(inlineCodeRegex));
    
    for (const match of inlineMatches) {
      const code = match[1];
      if (code.length > 10 && code.length < 200 && 
          (code.includes('import') || code.includes('=') || code.includes('('))) {
        examples.push({
          title: 'Inline Example',
          code: code,
          language: 'python',
        });
      }
    }
    
    return examples;
  }

  private deduplicateExamples(examples: UsageExample[]): UsageExample[] {
    const seen = new Set<string>();
    const unique: UsageExample[] = [];
    
    for (const example of examples) {
      const key = `${example.title}:${example.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(example);
      }
    }
    
    return unique;
  }

  private sortExamplesByRelevance(examples: UsageExample[]): UsageExample[] {
    return examples.sort((a, b) => {
      // Prioritize by title relevance
      const aScore = this.getRelevanceScore(a);
      const bScore = this.getRelevanceScore(b);
      
      if (aScore !== bScore) {
        return bScore - aScore; // Higher score first
      }
      
      // Then by code length (prefer medium-length examples)
      const aLength = a.code.length;
      const bLength = b.code.length;
      const idealLength = 200;
      
      const aLengthScore = Math.abs(aLength - idealLength);
      const bLengthScore = Math.abs(bLength - idealLength);
      
      return aLengthScore - bLengthScore; // Closer to ideal length first
    });
  }

  private getRelevanceScore(example: UsageExample): number {
    let score = 0;
    const title = example.title.toLowerCase();
    const code = example.code.toLowerCase();
    
    // Title scoring
    if (title.includes('basic') || title.includes('simple') || title.includes('quick start')) {
      score += 10;
    }
    if (title.includes('usage') || title.includes('example')) {
      score += 8;
    }
    if (title.includes('getting started') || title.includes('tutorial')) {
      score += 7;
    }
    if (title.includes('advanced')) {
      score += 5;
    }
    
    // Language scoring
    if (example.language === 'python') {
      score += 10;
    } else if (example.language === 'bash') {
      score += 5;
    }
    
    // Code content scoring
    if (code.includes('import')) {
      score += 5;
    }
    if (code.includes('pip install')) {
      score += 3;
    }
    if (code.includes('def ') || code.includes('class ')) {
      score += 2;
    }
    
    return score;
  }

  /**
   * Cleans up README content by removing badges, HTML, and other noise
   */
  cleanReadmeContent(content: string): string {
    let cleaned = content;
    
    try {
      // Remove HTML tags
      cleaned = cleaned.replace(/<[^>]*>/g, '');
      
      // Remove badges (markdown image syntax with shields.io, travis-ci, etc.)
      cleaned = cleaned.replace(/!\[.*?\]\(https?:\/\/.*?(?:shields\.io|travis-ci|badge|status).*?\)/g, '');
      
      // Remove excessive newlines
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      
      // Remove leading/trailing whitespace
      cleaned = cleaned.trim();
      
      logger.debug('Cleaned README content');
      return cleaned;
      
    } catch (error) {
      logger.error('Failed to clean README content', { error });
      return content; // Return original if cleaning fails
    }
  }
}

export const readmeParser = new ReadmeParser();