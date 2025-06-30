import { logger } from '../../utils/logger.js';

export class ReadmeContentCleaner {
  /**
   * Cleans and normalizes README content
   */
  cleanReadmeContent(content: string): string {
    try {
      if (!content || typeof content !== 'string') {
        return '';
      }

      let cleaned = content;

      // Remove excessive whitespace
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      
      // Remove trailing whitespace from lines
      cleaned = cleaned.replace(/[ \t]+$/gm, '');
      
      // Normalize line endings
      cleaned = cleaned.replace(/\r\n/g, '\n');
      
      // Remove HTML comments
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
      
      // Clean up markdown artifacts
      cleaned = this.cleanMarkdownArtifacts(cleaned);
      
      logger.debug('README content cleaned successfully');
      return cleaned.trim();
      
    } catch (error) {
      logger.error('Failed to clean README content', { error });
      return content || '';
    }
  }

  private cleanMarkdownArtifacts(content: string): string {
    // Remove excessive horizontal rules
    let cleaned = content.replace(/^\s*[-*_]{3,}\s*$/gm, '---');
    
    // Clean up table formatting
    cleaned = cleaned.replace(/\|[\s\-:|]+\|/g, (match) => {
      return match.replace(/\s+/g, ' ');
    });
    
    // Remove empty links
    cleaned = cleaned.replace(/\[([^\]]*)\]\(\s*\)/g, '$1');
    
    return cleaned;
  }
}