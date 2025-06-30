import { PackageBasicInfo, PyPIPackageInfo } from '../../types/index.js';

export class PackageInfoBuilder {
  build(packageInfo: PyPIPackageInfo): PackageBasicInfo {
    const info = packageInfo.info;
    
    return {
      name: info.name,
      version: info.version,
      description: info.summary || info.description || '',
      author: this.extractAuthor(info),
      maintainer: this.extractMaintainer(info),
      keywords: this.extractKeywords(info),
      classifiers: info.classifiers || [],
      requires_python: info.requires_python || undefined,
    };
  }

  private extractAuthor(info: any): string {
    if (info.author) {
      return info.author_email 
        ? `${info.author} <${info.author_email}>`
        : info.author;
    }
    
    if (info.author_email) {
      return info.author_email;
    }
    
    return 'Unknown';
  }

  private extractMaintainer(info: any): string | undefined {
    if (info.maintainer) {
      return info.maintainer_email 
        ? `${info.maintainer} <${info.maintainer_email}>`
        : info.maintainer;
    }
    
    if (info.maintainer_email) {
      return info.maintainer_email;
    }
    
    return undefined;
  }

  private extractKeywords(info: any): string[] {
    if (Array.isArray(info.keywords)) {
      return info.keywords;
    }
    
    if (typeof info.keywords === 'string') {
      return info.keywords
        .split(/[,\s]+/)
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);
    }
    
    return [];
  }
}