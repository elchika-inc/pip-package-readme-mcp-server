import { logger } from '../../utils/logger.js';
import { UsageExample } from '../../types/index.js';
import { README_CONFIG } from '../../config/constants.js';

export class ExampleProcessor {
  /**
   * Removes duplicate examples based on code similarity
   */
  deduplicateExamples(examples: UsageExample[]): UsageExample[] {
    const unique: UsageExample[] = [];
    const seenCodes = new Set<string>();
    
    for (const example of examples) {
      const normalizedCode = this.normalizeCode(example.code);
      
      if (!seenCodes.has(normalizedCode)) {
        seenCodes.add(normalizedCode);
        unique.push(example);
      }
    }
    
    logger.debug(`Deduplicated examples: ${examples.length} → ${unique.length}`);
    return unique;
  }

  /**
   * Sorts examples by relevance and quality
   */
  sortExamplesByRelevance(examples: UsageExample[]): UsageExample[] {
    return examples
      .map(example => ({
        ...example,
        _score: this.calculateRelevanceScore(example)
      }))
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...example }) => example);
  }

  private normalizeCode(code: string): string {
    return code
      .replace(/\s+/g, ' ')
      .replace(/['"]/g, '"')
      .trim()
      .toLowerCase();
  }

  private calculateRelevanceScore(example: UsageExample): number {
    let score = 0;
    
    // Prefer examples with imports
    if (example.code.includes('import ')) score += 50;
    if (example.code.includes('from ')) score += 45;
    
    // Prefer examples with usage patterns
    if (example.code.includes('=') && !example.code.includes('==')) score += 30;
    if (example.code.match(/\w+\.\w+\(/)) score += 25;
    
    // Prefer examples with good titles
    if (example.title && this.isGoodTitle(example.title)) score += 20;
    
    // Prefer examples with descriptions
    if (example.description) score += 15;
    
    // Prefer moderate length examples
    const length = example.code.length;
    if (length >= 50 && length <= README_CONFIG.IDEAL_EXAMPLE_LENGTH) {
      score += 10;
    } else if (length > README_CONFIG.IDEAL_EXAMPLE_LENGTH) {
      score -= Math.floor((length - README_CONFIG.IDEAL_EXAMPLE_LENGTH) / 100);
    }
    
    return score;
  }

  private isGoodTitle(title: string): boolean {
    const goodTitleKeywords = ['usage', 'example', 'quickstart', 'basic', 'simple', 'getting started'];
    return goodTitleKeywords.some(keyword => 
      title.toLowerCase().includes(keyword)
    );
  }
}