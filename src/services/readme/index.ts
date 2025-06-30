export { ReadmeContentCleaner } from './readme-content-cleaner.js';
export { ExampleExtractor } from './example-extractor.js';
export { ExampleProcessor } from './example-processor.js';

// Convenience class that combines all README processing functionality
import { ReadmeContentCleaner } from './readme-content-cleaner.js';
import { ExampleExtractor } from './example-extractor.js';
import { ExampleProcessor } from './example-processor.js';
import { UsageExample } from '../../types/index.js';

export class ReadmeService {
  private contentCleaner = new ReadmeContentCleaner();
  private exampleExtractor = new ExampleExtractor();
  private exampleProcessor = new ExampleProcessor();

  /**
   * Clean README content
   */
  cleanReadmeContent(content: string): string {
    return this.contentCleaner.cleanReadmeContent(content);
  }

  /**
   * Extract and process usage examples from README content
   */
  extractUsageExamples(readmeContent: string): UsageExample[] {
    const rawExamples = this.exampleExtractor.extractUsageExamples(readmeContent);
    const uniqueExamples = this.exampleProcessor.deduplicateExamples(rawExamples);
    return this.exampleProcessor.sortExamplesByRelevance(uniqueExamples);
  }
}