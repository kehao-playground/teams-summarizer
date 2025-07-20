# Manual Testing Guide

This guide provides instructions for manually testing the test cases that are skipped in automated testing, including E2E tests and API integration tests.

## Table of Contents

- [E2E Tests (18 cases)](#e2e-tests-18-cases)
- [API Integration Tests (2 cases)](#api-integration-tests-2-cases)
- [Test Environment Setup](#test-environment-setup)
- [Test Results Recording](#test-results-recording)

---

## Test Environment Setup

### Basic Requirements
```bash
# 1. Install all dependencies
npm install

# 2. Build the extension
npm run build

# 3. Ensure Chrome browser is installed
```

### API Keys Setup (for API integration tests)
```bash
# Set environment variables (optional)
export OPENAI_TEST_API_KEY="sk-your-actual-openai-api-key"
export ANTHROPIC_TEST_API_KEY="sk-ant-your-actual-anthropic-api-key"
```

---

## E2E Tests (18 cases)

These tests verify the complete functionality of the Chrome extension in a real browser environment.

### Test File Location
- Main test file: `test/e2e/popup.e2e.test.js`
- Test scenarios: From initial setup to complete workflow

### Manual Testing Steps

#### 1. Load Extension into Chrome

```bash
# 1. Open Chrome extension management page
chrome://extensions/

# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select project root directory: /Users/kehao/projects/teams-summarizer
```

#### 2. Initial Setup Flow Testing

**Test Case: First Time Setup Wizard**

1. **Open Extension Popup**
   - Click the extension icon in Chrome toolbar
   - Verify: Should display first-time setup wizard

2. **API Provider Selection**
   - Select "OpenAI" or "Anthropic"
   - Verify: Should show corresponding API key input field

3. **API Key Input**
   ```
   OpenAI format: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
   Anthropic format: sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
   ```
   - Enter a valid API key
   - Verify: Key format validation should work correctly

4. **Language Selection**
   - Choose output language: English, 繁體中文, 简体中文, 日本語
   - Verify: Language options should display correctly

5. **Complete Setup**
   - Click "Save Settings"
   - Verify: Should navigate to main interface after successful setup

#### 3. Core Functionality Testing

**Test Case: Transcript Extraction**

1. **Navigate to Teams Meeting Page**
   ```
   Example test URL:
   https://your-company.sharepoint.com/sites/xxx/_layouts/15/stream.aspx?id=xxx
   ```

2. **Execute Extraction**
   - Click extension icon on Teams page
   - Click "Extract Transcript" button
   - Verify: Should show extraction progress

3. **Check Extraction Results**
   - Verify: Transcript content should display correctly
   - Check: Participant list, timestamps, language detection

**Test Case: AI Summary Generation**

1. **Select AI Model**
   - OpenAI: GPT-4.1
   - Anthropic: Claude Sonnet 4

2. **Choose Prompt Template**
   - Default summary
   - Technical meeting
   - Business meeting
   - Custom prompt

3. **Generate Summary**
   - Click "Generate Summary"
   - Verify: Should show generation progress
   - Check: Summary quality and format

4. **Multi-language Testing**
   ```
   Test languages:
   - English (English summary)
   - 繁體中文 (Traditional Chinese summary)
   - 简体中文 (Simplified Chinese summary)
   - 日本語 (Japanese summary)
   ```

**Test Case: Export Functionality**

1. **Markdown Export**
   - Click "Export as Markdown"
   - Verify: Downloaded .md file format is correct

2. **HTML Export**
   - Click "Export as HTML"
   - Verify: HTML file displays correctly in browser

3. **Text Export**
   - Click "Export as Text"
   - Verify: .txt file content is complete

#### 4. Settings Management Testing

**Test Case: Settings Management**

1. **Open Settings Page**
   - Click "Settings" button in extension
   - Verify: Settings interface displays correctly

2. **API Key Management**
   - Change API provider
   - Update API key
   - Verify: Key is securely stored and loaded

3. **Preference Settings**
   - Change default language
   - Adjust export format preferences
   - Set auto-extraction options

4. **Prompt Template Management**
   - Add custom prompt template
   - Edit existing templates
   - Delete templates

#### 5. Error Handling Testing

**Test Case: Error Scenarios**

1. **Invalid API Key**
   - Enter invalid API key
   - Verify: Should display error message

2. **Network Errors**
   - Disconnect network connection
   - Try to generate summary
   - Verify: Error handling and retry mechanism

3. **Large Transcript Processing**
   - Test with very long meeting transcripts
   - Verify: Chunking functionality works

### E2E Testing Checklist

- [ ] **First Time Setup Wizard**
  - [ ] API provider selection interface
  - [ ] API key format validation
  - [ ] Language selection functionality
  - [ ] Settings save confirmation

- [ ] **Transcript Extraction**
  - [ ] SharePoint Stream page detection
  - [ ] Transcript content extraction
  - [ ] Participant and timestamp parsing
  - [ ] Automatic language detection

- [ ] **AI Summary Generation**
  - [ ] OpenAI GPT-4.1 integration
  - [ ] Anthropic Claude integration
  - [ ] Multi-language summary output
  - [ ] Custom prompt application

- [ ] **Export Features**
  - [ ] Markdown format export
  - [ ] HTML format export
  - [ ] Plain text export
  - [ ] File download mechanism

- [ ] **Settings Management**
  - [ ] Settings interface navigation
  - [ ] Secure API key storage
  - [ ] User preference saving
  - [ ] Prompt template management

- [ ] **Error Handling**
  - [ ] API error display
  - [ ] Network error handling
  - [ ] Input validation
  - [ ] Retry mechanisms

---

## API Integration Tests (2 cases)

These tests verify integration with real AI APIs.

### Test File Location
- Test file: `test/openaiClient.test.js`
- Related code: `src/openaiClient.js`

### Manual Testing Steps

#### 1. Prepare API Keys

```bash
# Set OpenAI API key
export OPENAI_TEST_API_KEY="sk-proj-your-actual-openai-key"

# Run tests with API key
npm test test/openaiClient.test.js
```

#### 2. Real API Call Testing

**Test Case: Real OpenAI API Call**

1. **Prepare Test Data**
   ```javascript
   // Test transcript data
   const testTranscript = {
     content: '[00:01:00] John: Hello everyone, let us start the meeting.\n[00:01:30] Jane: Great, I have the agenda ready.',
     metadata: {
       participants: 'John, Jane',
       duration: '30 minutes',
       language: 'English'
     }
   };
   ```

2. **Execute API Call**
   - Use real API key
   - Send test transcript to OpenAI
   - Verify: Returns valid summary

3. **Verify Response Format**
   ```javascript
   // Expected response format
   {
     summary: "Meeting summary content...",
     keyPoints: ["Point 1", "Point 2"],
     actionItems: ["Action item 1"],
     metadata: {
       generatedAt: "2025-01-15T10:00:00Z",
       model: "gpt-4.1",
       tokensUsed: 1234
     }
   }
   ```

**Test Case: Rate Limiting and Error Handling**

1. **Rate Limiting Test**
   - Send multiple requests quickly
   - Verify: Rate limiting mechanism works properly

2. **Error Handling Test**
   - Use invalid API key
   - Send oversized request
   - Verify: Errors are properly caught and handled

### API Integration Testing Checklist

- [ ] **OpenAI API Integration**
  - [ ] Successful API calls
  - [ ] Correct request format
  - [ ] Valid response parsing
  - [ ] Token usage statistics

- [ ] **Error Handling**
  - [ ] Invalid API key handling
  - [ ] Rate limit handling
  - [ ] Network error handling
  - [ ] Timeout error handling

---

## Testing Best Practices

### Principles Applied
1. **Focus on User Behavior**: Test what users experience, not implementation details
2. **Avoid Flaky Tests**: Remove environment-dependent assertions (timing, specific counts)
3. **Consolidate Similar Scenarios**: Reduce redundancy by merging similar test cases
4. **Testability First**: Remove scenarios that cannot be reliably automated
5. **Clear Step Definitions**: Each Gherkin step has exactly one matching definition

### Common Pitfalls to Avoid
- Overly strict timing constraints ("within 15 seconds" → "successfully")
- Testing specific token counts instead of "small/medium/large" transcripts
- Redundant network error scenarios
- Browser state tests that can't be automated
- Complex scenarios that combine multiple unrelated features

### Test Design Guidelines
- Write tests that describe user intent, not implementation
- Use success/failure assertions instead of time-based ones
- Keep steps generic and reusable across scenarios
- Test critical user journeys with edge cases handled by unit tests
- Mock external dependencies to ensure test isolation

## Chinese Language Testing

### Character Encoding Tests
- Verify UTF-8 BOM for text file downloads
- Test Chinese characters in filenames and URLs
- Validate URL encoding for Chinese paths (encoded and decoded forms)
- Ensure proper display of Chinese speakers and content

### Multi-language Summary Tests
```
Test languages and expected output:
- English → English summary
- 繁體中文 → Traditional Chinese summary  
- 简体中文 → Simplified Chinese summary
- 日本語 → Japanese summary
```

### Chinese-specific Test Cases
1. **Chinese Speaker Names**: Test extraction of names like '張經理', '王小明'
2. **Chinese Meeting Content**: Verify proper processing of Chinese transcript text
3. **Chinese File Paths**: Test SharePoint paths like '/sites/團隊網站/Shared Documents/會議錄影'
4. **Export with Chinese**: Ensure all export formats handle Chinese characters correctly

## Manual Execution Commands

### Running Specific Tests

```bash
# Run all tests (including skipped ones)
npm test

# Run E2E tests (requires manually removing .skip)
# Edit test/e2e/popup.e2e.test.js, change describe.skip to describe
npm test test/e2e/popup.e2e.test.js

# Run API integration tests (requires API key)
OPENAI_TEST_API_KEY="your-key" npm test test/openaiClient.test.js
```

### Running BDD Tests

```bash
# Run Cucumber BDD tests
npm run test:bdd

# View test reports
open test/bdd/reports/cucumber-report.html
```

---

## Test Results Recording

### Test Execution Log

| Test Type | Test Case | Status | Date | Notes |
|-----------|-----------|--------|------|-------|
| E2E | First Time Setup Wizard | ⏳ Pending | | |
| E2E | Transcript Extraction | ⏳ Pending | | |
| E2E | AI Summary Generation | ⏳ Pending | | |
| E2E | Export Features | ⏳ Pending | | |
| E2E | Settings Management | ⏳ Pending | | |
| E2E | Error Handling | ⏳ Pending | | |
| API | OpenAI Integration | ⏳ Pending | | Requires API key |
| API | Error Handling | ⏳ Pending | | Requires API key |

### Issue Tracking

If you encounter issues during testing, please record:

1. **Issue Description**: 
2. **Steps to Reproduce**: 
3. **Expected Behavior**: 
4. **Actual Behavior**: 
5. **Browser Version**: 
6. **Operating System**: 
7. **Screenshots**: 

---

## Important Notes

1. **API Costs**: Real API testing will incur charges, use carefully
2. **Test Environment**: Ensure testing in safe environment
3. **Data Privacy**: Don't use real meeting data for testing
4. **Browser Version**: Recommend using latest Chrome version
5. **Network**: Some tests require stable internet connection

---

## Automation Alternatives

To automate these tests in the future, consider:

1. **E2E Tests**: Set up GitHub Actions with Chrome headless
2. **API Tests**: Use dedicated test API keys with usage limits
3. **Mock Services**: Create API mock services for CI/CD

---

## Why These Tests Are Skipped

### E2E Tests (18 cases)
- **Infrastructure Dependencies**: Require real browser and Chrome extension loading
- **Environment Complexity**: Puppeteer setup can fail in different environments
- **CI/CD Reliability**: Browser automation is prone to timeouts and flaky behavior

### API Integration Tests (2 cases)
- **Cost Concerns**: Real API calls incur charges
- **Security**: Requires real API keys in test environment
- **External Dependencies**: Dependent on external API service availability

These skipped tests represent **integration and system-level testing** that should be performed manually or in dedicated testing environments, while the **352 passing automated tests** cover all core business logic and unit functionality.

---

*Last updated: 2025-01-20*