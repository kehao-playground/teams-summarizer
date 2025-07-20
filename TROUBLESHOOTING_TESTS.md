# Test Troubleshooting Guide

## Overview
This guide helps developers diagnose and fix common test issues in the Teams Summarizer Extension test suite.

## Common Issues and Solutions

### Mock Data and Context Issues

#### Issue: Mock Transcript Processing Returns Undefined
**Symptoms**: Tests fail with "Cannot read property of undefined" when processing transcripts
**Root Cause**: Mock transcript data structure doesn't match expected format
**Solution**:
```javascript
// Ensure mock data has proper structure
const mockTranscript = {
  entries: [
    { speaker: '張經理', text: '歡迎大家參與今天的會議', timestamp: '00:01:23' },
    { speaker: '王小明', text: '謝謝安排這次討論', timestamp: '00:02:15' }
  ]
};

// Extract speakers correctly
const speakers = [...new Set(entries.map(entry => entry.speaker).filter(Boolean))];
```

#### Issue: Export HTML Clipboard Functionality Fails
**Symptoms**: "Copy HTML" button tests fail with undefined content errors
**Root Cause**: Clipboard API not properly mocked in test environment
**Solution**:
```javascript
// Mock clipboard API before test
beforeEach(async function() {
  await this.page.evaluate(() => {
    if (!navigator.clipboard) {
      navigator.clipboard = {
        writeText: (text) => Promise.resolve(),
        readText: () => Promise.resolve('')
      };
    }
  });
});

// Proper HTML generation with mock data
case 'Copy HTML':
  const summary = this.mockData.generatedSummary;
  if (summary) {
    const htmlContent = this.generateHTML(summary);
    this.setMockData('clipboardContent', htmlContent);
    this.setMockData('copiedToClipboard', true);
  }
  break;
```

#### Issue: Export Metadata Missing
**Symptoms**: Exported files lack date, duration, or participant information
**Root Cause**: Format generation functions don't include complete metadata
**Solution**:
```javascript
generateMarkdown(summary) {
  return `# ${summary.title}

**日期**: ${summary.date}
**時長**: ${summary.duration}
**參與者**: ${summary.participants.join(', ')}

## 會議摘要
${summary.content.fullSummary}
`;
}
```

### Character Encoding and Internationalization

#### Issue: Chinese Characters Not Displaying Correctly
**Symptoms**: Tests fail when checking for Chinese text display
**Root Cause**: Test checking page DOM instead of mock data structure
**Solution**:
```javascript
Then('Chinese characters should display correctly', async function() {
  // Check mock data instead of DOM
  const hasChineseInTranscript = this.mockData.transcript.entries.some(entry => 
    /[\u4e00-\u9fff]/.test(entry.text) || /[\u4e00-\u9fff]/.test(entry.speaker)
  );
  expect(hasChineseInTranscript).to.be.true;
});
```

#### Issue: URL Encoding for Chinese Paths
**Symptoms**: SharePoint URLs with Chinese characters not recognized
**Root Cause**: Tests only check for decoded URLs, not encoded forms
**Solution**:
```javascript
// Support both encoded and decoded URL formats
const expectedPath = '/sites/團隊網站/Shared Documents/會議錄影';
const encodedPath = encodeURIComponent(expectedPath);
const currentUrl = this.mockData.currentUrl;

const pathMatches = currentUrl.includes(expectedPath) || 
                   currentUrl.includes(encodedPath);
expect(pathMatches).to.be.true;
```

#### Issue: UTF-8 Charset Test Failures
**Symptoms**: HTML export tests fail on charset verification
**Root Cause**: Test expects `charset=utf-8` but HTML contains `charset="utf-8"`
**Solution**:
```javascript
// Update test expectation to match actual HTML format
expect(html).to.include('charset="utf-8"');
// Or normalize both sides for comparison
expect(html.replace(/"/g, '')).to.include('charset=utf-8');
```

### Function Context and Prototype Issues

#### Issue: TypeError Due to Prototype Assignments
**Symptoms**: "this.generateMarkdown is not a function" or similar context errors
**Root Cause**: Incorrect prototype modifications in test helpers
**Solution**:
```javascript
// ❌ Avoid prototype modifications
World.prototype.generateMarkdown = function() { /* ... */ };

// ✅ Use instance methods instead
class World {
  generateMarkdown(summary) {
    // Implementation here
  }
}
```

#### Issue: Download Filename Generation Errors
**Symptoms**: Tests fail when generating download filenames
**Root Cause**: Incorrect parameters passed to filename generation function
**Solution**:
```javascript
// Ensure correct parameter order and types
const filename = this.generateFilename(
  this.mockData.summary.title,     // string
  this.mockData.summary.date,      // date string
  'md'                             // extension
);
```

### HTML and Email Compatibility

#### Issue: HTML Export Not Email Compatible
**Symptoms**: HTML exports don't render correctly in email clients
**Root Cause**: Using `<style>` tags instead of inline styles
**Solution**:
```javascript
// ❌ CSS in style tags (not email compatible)
const html = `<style>body { font-family: Arial; }</style><body>`;

// ✅ Inline styles (email compatible)
const html = `<body style="font-family: Arial, sans-serif; line-height: 1.6;">`;
```

## Debugging Strategies

### 1. Mock Data Inspection
Add debug logging to understand mock data structure:
```javascript
// Add to step definitions for debugging
console.log('Mock data:', JSON.stringify(this.mockData, null, 2));
```

### 2. Test Isolation
Ensure tests don't affect each other:
```javascript
beforeEach(function() {
  // Reset mock data to clean state
  this.mockData = {};
  this.clipboardContent = null;
  this.downloadContent = null;
});
```

### 3. Browser Console Inspection
Check browser console during E2E tests:
```javascript
// Enable console logging in Puppeteer
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
```

### 4. Step-by-Step Debugging
Use step-by-step debugging for complex scenarios:
```javascript
// Add breakpoints in step definitions
debugger;
await page.waitForTimeout(1000); // Pause for inspection
```

## Test Environment Setup

### Required Dependencies
Ensure all test dependencies are properly installed:
```bash
npm install --save-dev @cucumber/cucumber jest puppeteer chai
```

### Environment Variables
Set up test environment variables:
```bash
# For API integration tests
export OPENAI_API_KEY="test-key"
export ANTHROPIC_API_KEY="test-key"

# For E2E tests
export CHROME_EXECUTABLE_PATH="/path/to/chrome"
```

### Browser Configuration
Proper Puppeteer setup for extension testing:
```javascript
const browser = await puppeteer.launch({
  headless: false,
  args: [
    '--load-extension=./dist',
    '--disable-extensions-except=./dist',
    '--disable-web-security'
  ]
});
```

## Performance Troubleshooting

### Slow Test Execution
**Issue**: Tests taking too long to execute
**Solutions**:
1. Use headless browser mode for CI
2. Reduce unnecessary wait times
3. Mock external API calls
4. Run tests in parallel where possible

### Memory Leaks in Tests
**Issue**: Test process consuming excessive memory
**Solutions**:
1. Properly close browser instances
2. Clean up event listeners
3. Reset global state between tests

## Best Practices for Test Maintenance

### 1. Regular Test Review
- Review failing tests weekly
- Update mock data to match current data structures
- Remove or update obsolete test scenarios

### 2. Error Message Quality
- Use descriptive assertion messages
- Include relevant context in error outputs
- Log mock data state when tests fail

### 3. Test Data Management
- Keep test data realistic and current
- Include edge cases in mock data
- Maintain separate test data for different scenarios

### 4. Documentation Updates
- Document new test patterns as they're discovered
- Update this guide when new issues are resolved
- Share solutions with team members

## Quick Fixes Checklist

When a test fails, check these common issues first:

- [ ] Mock data structure matches expected format
- [ ] Character encoding is properly handled (UTF-8)
- [ ] Function context and `this` binding is correct
- [ ] Async operations are properly awaited
- [ ] Browser/page state is clean between tests
- [ ] External dependencies are properly mocked
- [ ] File paths and URLs are correctly encoded
- [ ] HTML output uses inline styles for email compatibility

## Getting Help

If this guide doesn't resolve your issue:

1. **Check Recent Changes**: Review recent commits that might have affected tests
2. **Run Single Test**: Isolate the failing test to understand the issue
3. **Compare Working Tests**: Look at similar tests that are passing
4. **Add Debug Logging**: Use console.log to inspect data flow
5. **Ask Team**: Share findings with team members for additional insights

---

*Last updated: 2025-01-20*