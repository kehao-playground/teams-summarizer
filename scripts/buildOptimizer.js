/**
 * Build Optimizer for Teams Transcript Extension
 * 
 * Analyzes and optimizes the extension package size, provides recommendations
 * for further size reductions, and generates build reports.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

class BuildOptimizer {
  constructor(options = {}) {
    this.distPath = options.distPath || path.join(process.cwd(), 'dist');
    this.srcPath = options.srcPath || path.join(process.cwd(), 'src');
    this.config = {
      targetSize: 1024 * 1024, // 1MB target
      warningSize: 2 * 1024 * 1024, // 2MB warning
      maxFileSize: 512 * 1024, // 512KB per file
      compressionLevel: 9,
      minificationTargets: ['.js', '.css', '.html', '.json'],
      imageOptimizationTargets: ['.png', '.jpg', '.jpeg', '.svg'],
      excludeFromAnalysis: ['node_modules', '.git', 'test', 'docs']
    };
    
    this.analysis = {
      files: [],
      totalSize: 0,
      compressedSize: 0,
      recommendations: [],
      warnings: []
    };
  }

  /**
   * Run complete build optimization analysis
   */
  async optimize() {
    try {
      console.log('🔧 Starting build optimization analysis...');
      
      // Analyze current build
      await this.analyzeBuildSize();
      
      // Check for optimization opportunities
      await this.findOptimizationOpportunities();
      
      // Generate compression analysis
      await this.analyzeCompression();
      
      // Check asset optimization
      await this.analyzeAssets();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Create optimization report
      const report = await this.generateReport();
      
      // Save report
      await this.saveReport(report);
      
      console.log('✅ Build optimization analysis completed');
      return report;
    } catch (error) {
      console.error('❌ Build optimization failed:', error);
      throw error;
    }
  }

  /**
   * Analyze current build size
   */
  async analyzeBuildSize() {
    try {
      const files = await this.getAllFiles(this.distPath);
      
      for (const file of files) {
        const stats = await fs.stat(file);
        const relativePath = path.relative(this.distPath, file);
        const ext = path.extname(file);
        
        const fileInfo = {
          path: relativePath,
          fullPath: file,
          size: stats.size,
          ext,
          type: this.getFileType(ext),
          lastModified: stats.mtime
        };
        
        // Calculate compressed size
        if (stats.size > 0) {
          try {
            const content = await fs.readFile(file);
            const compressed = zlib.gzipSync(content, { level: this.config.compressionLevel });
            fileInfo.compressedSize = compressed.length;
            fileInfo.compressionRatio = (1 - compressed.length / stats.size) * 100;
          } catch (error) {
            fileInfo.compressedSize = stats.size;
            fileInfo.compressionRatio = 0;
          }
        } else {
          fileInfo.compressedSize = 0;
          fileInfo.compressionRatio = 0;
        }
        
        this.analysis.files.push(fileInfo);
        this.analysis.totalSize += stats.size;
        this.analysis.compressedSize += fileInfo.compressedSize;
      }
      
      console.log(`📊 Analyzed ${files.length} files`);
      console.log(`📦 Total size: ${this.formatBytes(this.analysis.totalSize)}`);
      console.log(`🗜️ Compressed size: ${this.formatBytes(this.analysis.compressedSize)}`);
    } catch (error) {
      console.error('Failed to analyze build size:', error);
      throw error;
    }
  }

  /**
   * Find optimization opportunities
   */
  async findOptimizationOpportunities() {
    try {
      console.log('🔍 Looking for optimization opportunities...');
      
      // Check file sizes
      const largeFiles = this.analysis.files.filter(file => 
        file.size > this.config.maxFileSize
      );
      
      if (largeFiles.length > 0) {
        this.analysis.warnings.push({
          type: 'large_files',
          message: `${largeFiles.length} files exceed ${this.formatBytes(this.config.maxFileSize)}`,
          files: largeFiles.map(f => ({ path: f.path, size: this.formatBytes(f.size) })),
          priority: 'high'
        });
      }
      
      // Check for unoptimized assets
      const unoptimizedImages = this.analysis.files.filter(file => 
        this.config.imageOptimizationTargets.includes(file.ext) &&
        file.compressionRatio < 20 // Less than 20% compression suggests unoptimized
      );
      
      if (unoptimizedImages.length > 0) {
        this.analysis.warnings.push({
          type: 'unoptimized_images',
          message: `${unoptimizedImages.length} images may benefit from optimization`,
          files: unoptimizedImages.map(f => ({ 
            path: f.path, 
            size: this.formatBytes(f.size),
            compressionRatio: `${f.compressionRatio.toFixed(1)}%`
          })),
          priority: 'medium'
        });
      }
      
      // Check for duplicate files
      const duplicates = this.findDuplicateFiles();
      if (duplicates.length > 0) {
        this.analysis.warnings.push({
          type: 'duplicate_files',
          message: `${duplicates.length} potential duplicate files found`,
          files: duplicates,
          priority: 'medium'
        });
      }
      
      // Check manifest.json optimization
      await this.checkManifestOptimization();
      
      // Check for unused files
      await this.checkUnusedFiles();
      
    } catch (error) {
      console.error('Failed to find optimization opportunities:', error);
    }
  }

  /**
   * Analyze compression effectiveness
   */
  async analyzeCompression() {
    try {
      const compressionAnalysis = {
        byType: {},
        bestCandidates: [],
        poorCandidates: []
      };
      
      // Group by file type
      this.analysis.files.forEach(file => {
        if (!compressionAnalysis.byType[file.type]) {
          compressionAnalysis.byType[file.type] = {
            count: 0,
            totalSize: 0,
            totalCompressed: 0,
            avgRatio: 0
          };
        }
        
        const typeData = compressionAnalysis.byType[file.type];
        typeData.count++;
        typeData.totalSize += file.size;
        typeData.totalCompressed += file.compressedSize;
      });
      
      // Calculate averages
      Object.values(compressionAnalysis.byType).forEach(typeData => {
        typeData.avgRatio = typeData.totalSize > 0 
          ? (1 - typeData.totalCompressed / typeData.totalSize) * 100 
          : 0;
      });
      
      // Find best compression candidates (large files with poor compression)
      compressionAnalysis.bestCandidates = this.analysis.files
        .filter(file => file.size > 10 * 1024 && file.compressionRatio < 30)
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);
      
      // Find files with excellent compression (might indicate already optimized)
      compressionAnalysis.poorCandidates = this.analysis.files
        .filter(file => file.size > 5 * 1024 && file.compressionRatio > 80)
        .sort((a, b) => b.compressionRatio - a.compressionRatio)
        .slice(0, 5);
      
      this.analysis.compression = compressionAnalysis;
      
    } catch (error) {
      console.error('Failed to analyze compression:', error);
    }
  }

  /**
   * Analyze assets for optimization
   */
  async analyzeAssets() {
    try {
      const assetAnalysis = {
        images: [],
        fonts: [],
        scripts: [],
        styles: []
      };
      
      this.analysis.files.forEach(file => {
        switch (file.type) {
          case 'image':
            assetAnalysis.images.push({
              path: file.path,
              size: file.size,
              format: file.ext,
              compressionPotential: this.calculateImageCompressionPotential(file)
            });
            break;
          case 'font':
            assetAnalysis.fonts.push({
              path: file.path,
              size: file.size,
              format: file.ext
            });
            break;
          case 'script':
            assetAnalysis.scripts.push({
              path: file.path,
              size: file.size,
              minified: this.isMinified(file)
            });
            break;
          case 'style':
            assetAnalysis.styles.push({
              path: file.path,
              size: file.size,
              minified: this.isMinified(file)
            });
            break;
        }
      });
      
      this.analysis.assets = assetAnalysis;
      
    } catch (error) {
      console.error('Failed to analyze assets:', error);
    }
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Size-based recommendations
    if (this.analysis.totalSize > this.config.warningSize) {
      recommendations.push({
        type: 'size_warning',
        priority: 'high',
        title: 'Extension Size Warning',
        description: `Total size (${this.formatBytes(this.analysis.totalSize)}) exceeds recommended limit`,
        actions: [
          'Enable code splitting in webpack configuration',
          'Remove unused dependencies',
          'Implement lazy loading for non-critical components',
          'Optimize images and assets'
        ]
      });
    }
    
    // Compression recommendations
    const avgCompression = this.analysis.totalSize > 0 
      ? (1 - this.analysis.compressedSize / this.analysis.totalSize) * 100 
      : 0;
    
    if (avgCompression < 40) {
      recommendations.push({
        type: 'compression',
        priority: 'medium',
        title: 'Improve Compression',
        description: `Average compression ratio (${avgCompression.toFixed(1)}%) can be improved`,
        actions: [
          'Enable terser minification in production',
          'Use CSS minification',
          'Optimize image formats (WebP, AVIF)',
          'Remove comments and whitespace'
        ]
      });
    }
    
    // Asset optimization recommendations
    if (this.analysis.assets) {
      const largeImages = this.analysis.assets.images.filter(img => img.size > 100 * 1024);
      if (largeImages.length > 0) {
        recommendations.push({
          type: 'image_optimization',
          priority: 'medium',
          title: 'Optimize Large Images',
          description: `${largeImages.length} images larger than 100KB found`,
          actions: [
            'Convert images to WebP format',
            'Use appropriate image dimensions',
            'Implement progressive JPEG',
            'Consider using CSS sprites for small icons'
          ]
        });
      }
      
      const unminifiedScripts = this.analysis.assets.scripts.filter(script => !script.minified);
      if (unminifiedScripts.length > 0) {
        recommendations.push({
          type: 'script_minification',
          priority: 'high',
          title: 'Minify JavaScript Files',
          description: `${unminifiedScripts.length} unminified scripts found`,
          actions: [
            'Enable Terser plugin in webpack',
            'Remove console.log statements in production',
            'Use shorter variable names',
            'Remove dead code'
          ]
        });
      }
    }
    
    // Performance recommendations
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      title: 'Performance Optimizations',
      description: 'Additional optimizations for better performance',
      actions: [
        'Implement caching strategies',
        'Use lazy loading for UI components',
        'Optimize memory usage in background scripts',
        'Add performance monitoring'
      ]
    });
    
    this.analysis.recommendations = recommendations;
  }

  /**
   * Check manifest.json optimization
   */
  async checkManifestOptimization() {
    try {
      const manifestPath = path.join(this.distPath, 'manifest.json');
      const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false);
      
      if (manifestExists) {
        const content = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(content);
        
        // Check for development-only permissions
        const devPermissions = ['debugger', 'management', 'devtools'];
        const hasDevPermissions = manifest.permissions?.some(perm => 
          devPermissions.includes(perm)
        );
        
        if (hasDevPermissions) {
          this.analysis.warnings.push({
            type: 'manifest_dev_permissions',
            message: 'Manifest contains development-only permissions',
            priority: 'medium'
          });
        }
        
        // Check for excessive permissions
        if (manifest.permissions && manifest.permissions.length > 10) {
          this.analysis.warnings.push({
            type: 'manifest_permissions',
            message: `Manifest has ${manifest.permissions.length} permissions (consider reducing)`,
            priority: 'low'
          });
        }
      }
    } catch (error) {
      console.error('Failed to check manifest optimization:', error);
    }
  }

  /**
   * Check for unused files
   */
  async checkUnusedFiles() {
    try {
      // This is a simplified check - in practice, you'd want to do static analysis
      const potentiallyUnused = this.analysis.files.filter(file => {
        // Files that might be unused
        return file.path.includes('.map') || // Source maps
               file.path.includes('test') || // Test files
               file.path.includes('spec') || // Spec files
               file.ext === '.md'; // Documentation
      });
      
      if (potentiallyUnused.length > 0) {
        this.analysis.warnings.push({
          type: 'potentially_unused',
          message: `${potentiallyUnused.length} potentially unused files found`,
          files: potentiallyUnused.map(f => f.path),
          priority: 'low'
        });
      }
    } catch (error) {
      console.error('Failed to check unused files:', error);
    }
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.analysis.files.length,
        totalSize: this.analysis.totalSize,
        compressedSize: this.analysis.compressedSize,
        compressionRatio: this.analysis.totalSize > 0 
          ? (1 - this.analysis.compressedSize / this.analysis.totalSize) * 100 
          : 0,
        sizeStatus: this.getSizeStatus()
      },
      breakdown: {
        byType: this.getFilesBreakdownByType(),
        bySize: this.getFilesBreakdownBySize(),
        largest: this.analysis.files
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)
          .map(f => ({
            path: f.path,
            size: this.formatBytes(f.size),
            type: f.type
          }))
      },
      compression: this.analysis.compression,
      assets: this.analysis.assets,
      warnings: this.analysis.warnings,
      recommendations: this.analysis.recommendations,
      optimizationScore: this.calculateOptimizationScore()
    };
    
    return report;
  }

  /**
   * Save report to file
   */
  async saveReport(report) {
    try {
      const reportPath = path.join(this.distPath, 'build-optimization-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Also create a human-readable summary
      const summaryPath = path.join(this.distPath, 'build-summary.txt');
      const summary = this.generateTextSummary(report);
      await fs.writeFile(summaryPath, summary);
      
      console.log(`📄 Report saved to: ${reportPath}`);
      console.log(`📄 Summary saved to: ${summaryPath}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }

  /**
   * Generate text summary
   */
  generateTextSummary(report) {
    let summary = `# Build Optimization Report\n`;
    summary += `Generated: ${report.timestamp}\n\n`;
    
    summary += `## Summary\n`;
    summary += `- Total Files: ${report.summary.totalFiles}\n`;
    summary += `- Total Size: ${this.formatBytes(report.summary.totalSize)}\n`;
    summary += `- Compressed Size: ${this.formatBytes(report.summary.compressedSize)}\n`;
    summary += `- Compression Ratio: ${report.summary.compressionRatio.toFixed(1)}%\n`;
    summary += `- Size Status: ${report.summary.sizeStatus}\n`;
    summary += `- Optimization Score: ${report.optimizationScore}/100\n\n`;
    
    if (report.warnings.length > 0) {
      summary += `## Warnings (${report.warnings.length})\n`;
      report.warnings.forEach((warning, index) => {
        summary += `${index + 1}. [${warning.priority.toUpperCase()}] ${warning.message}\n`;
      });
      summary += `\n`;
    }
    
    if (report.recommendations.length > 0) {
      summary += `## Recommendations (${report.recommendations.length})\n`;
      report.recommendations.forEach((rec, index) => {
        summary += `${index + 1}. ${rec.title}\n`;
        summary += `   ${rec.description}\n`;
        rec.actions.forEach(action => {
          summary += `   - ${action}\n`;
        });
        summary += `\n`;
      });
    }
    
    summary += `## Largest Files\n`;
    report.breakdown.largest.forEach((file, index) => {
      summary += `${index + 1}. ${file.path} (${file.size})\n`;
    });
    
    return summary;
  }

  /**
   * Utility methods
   */
  async getAllFiles(dir, files = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await this.getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  getFileType(ext) {
    const typeMap = {
      '.js': 'script',
      '.ts': 'script',
      '.css': 'style',
      '.scss': 'style',
      '.html': 'markup',
      '.json': 'data',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.woff': 'font',
      '.woff2': 'font',
      '.ttf': 'font',
      '.eot': 'font'
    };
    
    return typeMap[ext.toLowerCase()] || 'other';
  }

  getFilesBreakdownByType() {
    const breakdown = {};
    
    this.analysis.files.forEach(file => {
      if (!breakdown[file.type]) {
        breakdown[file.type] = {
          count: 0,
          totalSize: 0,
          percentage: 0
        };
      }
      
      breakdown[file.type].count++;
      breakdown[file.type].totalSize += file.size;
    });
    
    // Calculate percentages
    Object.values(breakdown).forEach(type => {
      type.percentage = this.analysis.totalSize > 0 
        ? (type.totalSize / this.analysis.totalSize) * 100 
        : 0;
      type.totalSize = this.formatBytes(type.totalSize);
    });
    
    return breakdown;
  }

  getFilesBreakdownBySize() {
    const ranges = [
      { name: 'Tiny (<1KB)', min: 0, max: 1024 },
      { name: 'Small (1-10KB)', min: 1024, max: 10 * 1024 },
      { name: 'Medium (10-100KB)', min: 10 * 1024, max: 100 * 1024 },
      { name: 'Large (100KB-1MB)', min: 100 * 1024, max: 1024 * 1024 },
      { name: 'Very Large (>1MB)', min: 1024 * 1024, max: Infinity }
    ];
    
    const breakdown = {};
    
    ranges.forEach(range => {
      const files = this.analysis.files.filter(file => 
        file.size >= range.min && file.size < range.max
      );
      
      breakdown[range.name] = {
        count: files.length,
        totalSize: this.formatBytes(files.reduce((sum, f) => sum + f.size, 0))
      };
    });
    
    return breakdown;
  }

  getSizeStatus() {
    if (this.analysis.totalSize > this.config.warningSize) {
      return 'WARNING - Exceeds recommended size';
    } else if (this.analysis.totalSize > this.config.targetSize) {
      return 'CAUTION - Above target size';
    } else {
      return 'OK - Within target size';
    }
  }

  calculateOptimizationScore() {
    let score = 100;
    
    // Deduct points for size issues
    if (this.analysis.totalSize > this.config.warningSize) {
      score -= 30;
    } else if (this.analysis.totalSize > this.config.targetSize) {
      score -= 15;
    }
    
    // Deduct points for poor compression
    const avgCompression = this.analysis.totalSize > 0 
      ? (1 - this.analysis.compressedSize / this.analysis.totalSize) * 100 
      : 0;
    
    if (avgCompression < 30) {
      score -= 20;
    } else if (avgCompression < 50) {
      score -= 10;
    }
    
    // Deduct points for warnings
    this.analysis.warnings.forEach(warning => {
      switch (warning.priority) {
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    });
    
    return Math.max(0, score);
  }

  findDuplicateFiles() {
    const duplicates = [];
    const sizeGroups = new Map();
    
    // Group files by size (potential duplicates)
    this.analysis.files.forEach(file => {
      if (!sizeGroups.has(file.size)) {
        sizeGroups.set(file.size, []);
      }
      sizeGroups.get(file.size).push(file);
    });
    
    // Find groups with multiple files
    sizeGroups.forEach(files => {
      if (files.length > 1 && files[0].size > 1024) { // Only check files > 1KB
        duplicates.push({
          size: this.formatBytes(files[0].size),
          files: files.map(f => f.path)
        });
      }
    });
    
    return duplicates;
  }

  calculateImageCompressionPotential(file) {
    // Simplified heuristic for image compression potential
    if (file.compressionRatio < 20) {
      return 'High';
    } else if (file.compressionRatio < 50) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  isMinified(file) {
    // Simple heuristic: if compression ratio is high, it's likely already minified
    return file.compressionRatio < 20;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = BuildOptimizer;

// CLI usage
if (require.main === module) {
  const optimizer = new BuildOptimizer();
  optimizer.optimize()
    .then(report => {
      console.log('\n📊 Optimization Complete!');
      console.log(`Total Size: ${optimizer.formatBytes(report.summary.totalSize)}`);
      console.log(`Optimization Score: ${report.optimizationScore}/100`);
      
      if (report.warnings.length > 0) {
        console.log(`\n⚠️ ${report.warnings.length} warnings found`);
      }
      
      if (report.recommendations.length > 0) {
        console.log(`💡 ${report.recommendations.length} optimization recommendations available`);
      }
    })
    .catch(error => {
      console.error('Optimization failed:', error);
      process.exit(1);
    });
}