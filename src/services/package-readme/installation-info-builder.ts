import { InstallationInfo, PyPIPackageInfo } from '../../types/index.js';

export class InstallationInfoBuilder {
  build(packageInfo: PyPIPackageInfo): InstallationInfo {
    const packageName = packageInfo.info.name;
    
    return {
      pip: `pip install ${packageName}`,
      conda: this.buildCondaCommand(packageName),
      pipx: this.buildPipxCommand(packageName, packageInfo),
    };
  }

  private buildCondaCommand(packageName: string): string {
    // Most packages on PyPI are also available on conda-forge
    return `conda install -c conda-forge ${packageName}`;
  }

  private buildPipxCommand(packageName: string, packageInfo: PyPIPackageInfo): string {
    // Check if this package provides console scripts (CLI tools)
    const hasConsoleScripts = this.hasConsoleScripts(packageInfo);
    
    if (hasConsoleScripts) {
      return `pipx install ${packageName}`;
    } else {
      return `# pipx is for CLI applications only - use pip instead`;
    }
  }

  private hasConsoleScripts(packageInfo: PyPIPackageInfo): boolean {
    // Check classifiers for application indicators
    const classifiers = packageInfo.info.classifiers || [];
    
    const isApplication = classifiers.some(classifier => 
      classifier.includes('Environment :: Console') ||
      classifier.includes('Intended Audience :: End Users') ||
      classifier.includes('Topic :: System :: Systems Administration') ||
      classifier.includes('Topic :: Utilities')
    );
    
    // Check if package name suggests it's a CLI tool
    const cliKeywords = ['cli', 'command', 'tool', 'utility', 'script'];
    const packageName = packageInfo.info.name.toLowerCase();
    const hasCliKeyword = cliKeywords.some(keyword => packageName.includes(keyword));
    
    return isApplication || hasCliKeyword;
  }
}