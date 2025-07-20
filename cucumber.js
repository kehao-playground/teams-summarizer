/**
 * Cucumber.js Configuration for Teams Transcript Extension BDD Tests
 * 
 * Configures Cucumber.js for testing Chrome extension functionality
 * with Puppeteer for browser automation and extension testing.
 */

module.exports = {
  default: {
    // Feature files location
    require: [
      'test/bdd/step_definitions/**/*.js',
      'test/bdd/support/world.js'
    ],
    
    // Feature files pattern
    paths: ['test/bdd/features/**/*.feature'],
    
    // Output format
    format: [
      'progress-bar',
      'json:test/bdd/reports/cucumber-report.json',
      'html:test/bdd/reports/cucumber-report.html'
    ],
    
    // Parallel execution
    parallel: 1,
    
    // Timeout for steps (in milliseconds)
    timeout: 30000,
    
    // Retry failed scenarios
    retry: 1,
    
    // Exit on first failure
    failFast: false,
    
    // Strict mode - fail on undefined steps
    strict: true,
    
    // Publish test results
    publish: false
  },
  
  // Chrome extension specific profile
  chrome: {
    require: [
      'test/bdd/step_definitions/**/*.js',
      'test/bdd/support/world.js'
    ],
    paths: ['test/bdd/features/**/*.feature'],
    tags: '@chrome',
    format: ['progress-bar'],
    timeout: 60000, // Longer timeout for browser operations
    parallel: 1 // No parallel execution for extension tests
  },
  
  // Fast smoke tests
  smoke: {
    require: [
      'test/bdd/step_definitions/**/*.js',
      'test/bdd/support/world.js'
    ],
    paths: ['test/bdd/features/**/*.feature'],
    tags: '@smoke',
    format: ['progress-bar'],
    timeout: 15000,
    parallel: 2
  }
};