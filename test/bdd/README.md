# BDD Testing Documentation - Teams Transcript Extension

This document describes the Behavior-Driven Development (BDD) testing framework for the Teams Transcript Chrome Extension, implemented using Cucumber.js and Puppeteer.

## Overview

The BDD test suite provides comprehensive end-to-end testing for all major user journeys and scenarios, using Gherkin feature files to describe expected behavior in natural language.

## Test Structure

```
test/bdd/
├── features/                 # Gherkin feature files
│   ├── transcript_extraction.feature
│   ├── ai_summary_generation.feature
│   ├── export_and_settings.feature
│   └── error_handling.feature
├── step_definitions/         # JavaScript step implementations
│   ├── transcript_steps.js
│   ├── ai_summary_steps.js
│   └── export_settings_steps.js
├── support/                  # Test utilities and setup
│   ├── world.js             # Cucumber World configuration
│   └── test-utils.js        # Helper utilities
├── fixtures/                 # Test data and mocks
│   └── test-fixtures.js     # Mock data for different scenarios
├── reports/                  # Generated test reports
│   ├── cucumber-report.html
│   ├── cucumber-report.json
│   └── screenshots/
└── test-runner.js           # Main test execution script
```

## Features Covered

### 1. Transcript Extraction (`transcript_extraction.feature`)
- Successfully extract transcripts from SharePoint Stream pages
- Handle authentication failures and session expiration
- Process large transcripts (3+ hour meetings)
- Support Chinese characters in URLs and content
- Network resilience and error recovery
- API validation and data structure verification

### 2. AI Summary Generation (`ai_summary_generation.feature`)
- Generate summaries with GPT 4.1 and Claude Sonnet 4
- Switch between AI providers
- Handle custom prompt templates
- Process large transcripts with chunking
- Multi-language output support
- API error handling and retry mechanisms

### 3. Export and Settings (`export_and_settings.feature`)
- Export summaries in multiple formats (Markdown, HTML, Plain Text)
- Settings management and configuration
- First-time setup wizard
- API key management and validation
- Prompt template import/export
- Privacy and backup settings

### 4. Error Handling (`error_handling.feature`)
- Comprehensive error scenarios and edge cases
- Authentication, network, and API errors
- Data corruption and malformed responses
- Resource constraints and performance limits
- Recovery procedures and user guidance

## Test Profiles

### Smoke Tests (`@smoke`)
Quick validation of core functionality:
```bash
npm run test:bdd:smoke
```

### Chrome Extension Tests (`@chrome`)
Tests specific to Chrome extension functionality:
```bash
npm run test:bdd:chrome
```

### Regression Tests
Full test suite excluding work-in-progress scenarios:
```bash
npm run test:bdd:regression
```

### CI/CD Tests
Optimized for continuous integration:
```bash
npm run test:bdd:ci
```

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

### Local Development
```bash
# Run all BDD tests
npm run test:bdd

# Run smoke tests only
npm run test:bdd:smoke

# Debug mode (visible browser, slow motion)
npm run test:bdd:debug

# Run specific feature
npx cucumber-js test/bdd/features/transcript_extraction.feature
```

### Environment Variables
- `HEADLESS=false` - Run with visible browser (default: true)
- `SLOW_MO=250` - Add delay between actions (milliseconds)
- `TEST_TIMEOUT=30000` - Test timeout (milliseconds)
- `PARALLEL_TESTS=2` - Number of parallel test workers
- `BASE_URL` - Base URL for SharePoint (for integration tests)

### CI/CD Integration
The test suite integrates with GitHub Actions for continuous testing:

```yaml
# .github/workflows/bdd-tests.yml
- Matrix testing across Node.js versions
- Multiple test profiles (smoke, regression)
- Security scanning and dependency checks
- Performance testing with metrics
- Cross-platform compatibility (Ubuntu, Windows, macOS)
```

## Test Data and Fixtures

### Mock Transcripts (`test-fixtures.js`)
- **Product Meeting**: Standard Chinese business meeting
- **Technical Meeting**: English technical discussion
- **Large Meeting**: 3-hour meeting with 800+ entries
- **Mixed Language**: Multi-language meeting content
- **Corrupted Data**: Malformed transcript for error testing
- **Empty Transcript**: Edge case with no content

### Mock API Responses
- SharePoint Stream API responses
- OpenAI GPT 4.1 successful responses
- Claude Sonnet 4 successful responses
- Various error scenarios (authentication, rate limiting, etc.)

### Test Utilities
- Mock API response generators
- Data validation utilities
- Performance monitoring tools
- Extension testing helpers
- File download and clipboard mocking

## Writing New Tests

### 1. Add Feature File
Create a new `.feature` file in `test/bdd/features/`:

```gherkin
@new-feature
Feature: New Functionality
  As a user
  I want new functionality
  So that I can achieve my goal

  @smoke
  Scenario: Basic functionality works
    Given I have the required setup
    When I perform the action
    Then I should see the expected result
```

### 2. Implement Step Definitions
Add corresponding steps in `test/bdd/step_definitions/`:

```javascript
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

Given('I have the required setup', async function() {
  // Setup code
});

When('I perform the action', async function() {
  // Action code
});

Then('I should see the expected result', async function() {
  // Assertion code
});
```

### 3. Add Test Data
Include necessary fixtures in `test-fixtures.js`:

```javascript
newFeatureData: {
  // Mock data for new feature
}
```

## Test Reports

### Cucumber HTML Report
Generated at `test/bdd/reports/cucumber-report.html` with:
- Feature and scenario results
- Step-by-step execution details
- Screenshots for failed scenarios
- Execution timing and statistics

### JSON Report
Machine-readable results at `test/bdd/reports/cucumber-report.json` for:
- CI/CD integration
- Custom reporting tools
- Test metrics analysis

### Test Summary
Aggregated metrics in `test/bdd/reports/test-summary.json`:
```json
{
  "totalScenarios": 45,
  "passedScenarios": 43,
  "failedScenarios": 2,
  "successRate": "95.56%",
  "duration": 125000,
  "features": [...]
}
```

## Debugging Tests

### Visual Debugging
```bash
# Run with visible browser and slow motion
HEADLESS=false SLOW_MO=500 npm run test:bdd:smoke
```

### Screenshots
Failed scenarios automatically capture screenshots in `test/bdd/reports/screenshots/`

### Console Logs
Use console.log in step definitions for debugging:
```javascript
Then('I should see the result', async function() {
  const result = await this.page.evaluate(() => document.body.textContent);
  console.log('Page content:', result);
  expect(result).to.include('expected text');
});
```

### Breakpoints
Add debugger statements and run with Node.js inspector:
```bash
node --inspect-brk test/bdd/test-runner.js smoke
```

## Performance Testing

### Performance Scenarios
Tagged with `@performance` for specific performance validation:
- Large transcript processing time
- Memory usage monitoring
- API response times
- UI responsiveness

### Metrics Collection
```javascript
const monitor = PerformanceTestUtils.createPerformanceMonitor();
monitor.start();
// ... test operations
monitor.stop();
const metrics = monitor.getMetrics();
```

## Best Practices

### Test Design
1. **Keep scenarios focused** - One scenario per behavior
2. **Use descriptive names** - Clear intent in feature/scenario names
3. **Avoid implementation details** - Focus on user behavior
4. **Make scenarios independent** - No dependencies between scenarios

### Step Definitions
1. **Reuse common steps** - Share steps across features
2. **Use proper wait strategies** - Wait for elements/conditions
3. **Clean up after tests** - Reset state between scenarios
4. **Handle async operations** - Proper Promise handling

### Mock Data
1. **Realistic test data** - Mirror real-world scenarios
2. **Edge cases covered** - Include boundary conditions
3. **Internationalization** - Test with Chinese/English content
4. **Error scenarios** - Comprehensive error condition coverage

## Troubleshooting

### Common Issues

#### Extension Not Loading
```bash
# Verify extension build
npm run build
ls -la dist/manifest.json
```

#### Browser Launch Failures
```bash
# Install browser dependencies
npx puppeteer browsers install chrome
```

#### Step Definition Not Found
```bash
# Check require paths in cucumber.js
# Verify step definitions are properly exported
```

#### Test Timeouts
```bash
# Increase timeout for slow operations
export TEST_TIMEOUT=60000
npm run test:bdd:smoke
```

### Getting Help
1. Check test reports in `test/bdd/reports/`
2. Review screenshots for visual debugging
3. Enable debug mode with `HEADLESS=false`
4. Check GitHub Actions logs for CI failures

## Integration with Development Workflow

### Pre-commit Hooks
```bash
# Add to .husky/pre-commit
npm run test:bdd:smoke
```

### Pull Request Validation
GitHub Actions automatically runs:
- Smoke tests for quick validation
- Full regression suite for comprehensive coverage
- Security and performance scans

### Release Testing
Before releases, run full test suite:
```bash
npm run test:all
npm run test:bdd:regression
```

This BDD testing framework ensures comprehensive coverage of user scenarios while maintaining maintainable and readable test specifications.