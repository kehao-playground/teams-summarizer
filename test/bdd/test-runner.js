/**
 * BDD Test Runner Script
 * 
 * Main script for running BDD tests with different configurations
 * and environments. Supports local development and CI/CD integration.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class BDDTestRunner {
  constructor() {
    this.config = {
      projectRoot: path.join(__dirname, '../../'),
      reportsDir: path.join(__dirname, '../reports'),
      screenshotsDir: path.join(__dirname, '../reports/screenshots'),
      baseUrl: process.env.BASE_URL || 'https://cht365-my.sharepoint.com',
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(process.env.SLOW_MO) || 0,
      timeout: parseInt(process.env.TEST_TIMEOUT) || 30000,
      retries: parseInt(process.env.TEST_RETRIES) || 1,
      parallel: parseInt(process.env.PARALLEL_TESTS) || 1
    };
  }

  async setup() {
    console.log('🔧 Setting up BDD test environment...');
    
    // Create required directories
    await this.createDirectories();
    
    // Build extension if needed
    if (process.env.BUILD_EXTENSION !== 'false') {
      await this.buildExtension();
    }
    
    // Install browser if needed
    if (process.env.INSTALL_BROWSER === 'true') {
      await this.installBrowser();
    }
    
    console.log('✅ BDD test environment ready');
  }

  async createDirectories() {
    const dirs = [
      this.config.reportsDir,
      this.config.screenshotsDir,
      path.join(this.config.reportsDir, 'cucumber'),
      path.join(this.config.reportsDir, 'coverage')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.error(`❌ Failed to create directory ${dir}:`, error.message);
        }
      }
    }
  }

  async buildExtension() {
    console.log('🔨 Building Chrome extension...');
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build:dev'], {
        cwd: this.config.projectRoot,
        stdio: 'inherit',
        shell: true
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Extension build completed');
          resolve();
        } else {
          reject(new Error(`Extension build failed with code ${code}`));
        }
      });
    });
  }

  async installBrowser() {
    console.log('🌐 Installing browser dependencies...');
    
    return new Promise((resolve, reject) => {
      const installProcess = spawn('npx', ['puppeteer', 'browsers', 'install', 'chrome'], {
        cwd: this.config.projectRoot,
        stdio: 'inherit',
        shell: true
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Browser installation completed');
          resolve();
        } else {
          reject(new Error(`Browser installation failed with code ${code}`));
        }
      });
    });
  }

  async runTests(profile = 'default', tags = null) {
    console.log(`🧪 Running BDD tests with profile: ${profile}`);
    
    const cucumberArgs = this.buildCucumberArgs(profile, tags);
    
    return new Promise((resolve, reject) => {
      const testProcess = spawn('npx', ['cucumber-js', ...cucumberArgs], {
        cwd: this.config.projectRoot,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          HEADLESS: this.config.headless.toString(),
          SLOW_MO: this.config.slowMo.toString(),
          TEST_TIMEOUT: this.config.timeout.toString(),
          BASE_URL: this.config.baseUrl
        }
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ All tests passed');
          resolve({ success: true, exitCode: code });
        } else {
          console.log(`❌ Tests failed with exit code: ${code}`);
          resolve({ success: false, exitCode: code });
        }
      });

      testProcess.on('error', (error) => {
        console.error('❌ Test execution error:', error.message);
        reject(error);
      });
    });
  }

  buildCucumberArgs(profile, tags) {
    const args = [
      '--require', 'test/bdd/step_definitions/',
      '--require', 'test/bdd/support/world.js',
      '--format', 'progress-bar',
      '--format', 'json:test/bdd/reports/cucumber-report.json',
      '--format', 'html:test/bdd/reports/cucumber-report.html',
      '--parallel', this.config.parallel.toString(),
      '--retry', this.config.retries.toString()
    ];

    // Add profile-specific configuration
    switch (profile) {
      case 'smoke':
        args.push('--tags', '@smoke');
        break;
      case 'chrome':
        args.push('--tags', '@chrome');
        break;
      case 'regression':
        // Run all available tests
        break;
      case 'ci':
        args.push('--fail-fast');
        break;
    }

    // Add custom tags if provided
    if (tags) {
      args.push('--tags', tags);
    }

    // Add feature files
    args.push('test/bdd/features/*.feature');

    return args;
  }

  async generateReport() {
    console.log('📊 Generating test reports...');
    
    try {
      // Read cucumber JSON report
      const reportPath = path.join(this.config.reportsDir, 'cucumber-report.json');
      const reportData = await fs.readFile(reportPath, 'utf8');
      const results = JSON.parse(reportData);
      
      // Generate summary
      const summary = this.generateTestSummary(results);
      
      // Write summary to file
      const summaryPath = path.join(this.config.reportsDir, 'test-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      
      console.log('📈 Test summary:', summary);
      
      return summary;
    } catch (error) {
      console.error('❌ Failed to generate report:', error.message);
      return null;
    }
  }

  generateTestSummary(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      totalFeatures: results.length,
      totalScenarios: 0,
      passedScenarios: 0,
      failedScenarios: 0,
      skippedScenarios: 0,
      totalSteps: 0,
      passedSteps: 0,
      failedSteps: 0,
      duration: 0,
      features: []
    };

    results.forEach(feature => {
      const featureSummary = {
        name: feature.name,
        scenarios: feature.elements?.length || 0,
        passed: 0,
        failed: 0,
        skipped: 0
      };

      feature.elements?.forEach(scenario => {
        summary.totalScenarios++;
        
        const scenarioStatus = this.getScenarioStatus(scenario);
        if (scenarioStatus === 'passed') {
          summary.passedScenarios++;
          featureSummary.passed++;
        } else if (scenarioStatus === 'failed') {
          summary.failedScenarios++;
          featureSummary.failed++;
        } else {
          summary.skippedScenarios++;
          featureSummary.skipped++;
        }

        scenario.steps?.forEach(step => {
          summary.totalSteps++;
          if (step.result?.status === 'passed') {
            summary.passedSteps++;
          } else if (step.result?.status === 'failed') {
            summary.failedSteps++;
          }
          
          if (step.result?.duration) {
            summary.duration += step.result.duration;
          }
        });
      });

      summary.features.push(featureSummary);
    });

    summary.successRate = summary.totalScenarios > 0 
      ? (summary.passedScenarios / summary.totalScenarios * 100).toFixed(2)
      : 0;

    return summary;
  }

  getScenarioStatus(scenario) {
    const steps = scenario.steps || [];
    
    if (steps.some(step => step.result?.status === 'failed')) {
      return 'failed';
    }
    
    if (steps.every(step => step.result?.status === 'passed')) {
      return 'passed';
    }
    
    return 'skipped';
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Clean up screenshots older than 7 days
    try {
      const files = await fs.readdir(this.config.screenshotsDir);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(this.config.screenshotsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < sevenDaysAgo) {
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted old screenshot: ${file}`);
        }
      }
    } catch (error) {
      console.error('⚠️ Cleanup warning:', error.message);
    }
    
    console.log('✅ Cleanup completed');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const profile = args[0] || 'default';
  const tags = args[1] || null;
  
  const runner = new BDDTestRunner();
  
  try {
    await runner.setup();
    const result = await runner.runTests(profile, tags);
    const summary = await runner.generateReport();
    await runner.cleanup();
    
    // Exit with appropriate code
    process.exit(result.exitCode);
    
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = { BDDTestRunner };

// Run if called directly
if (require.main === module) {
  main();
}