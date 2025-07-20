# Development Testing Guidelines

## Overview
This document provides guidelines for developers working on the Teams Summarizer Extension to maintain high test quality and ensure reliable test execution.

## Core Testing Principles

### 1. User-Centric Testing
- **Focus on User Experience**: Test what users see and experience, not internal implementation details
- **Business Language**: Use business terminology in test descriptions that stakeholders can understand
- **User Workflows**: Structure tests around complete user journeys from start to finish

**Example**:
```gherkin
# ✅ Good - User-focused
Scenario: User generates meeting summary
  Given I have extracted a meeting transcript
  When I click "Generate Summary"
  Then I should see a successful summary

# ❌ Bad - Implementation-focused  
Scenario: AI service processes transcript tokens
  Given I have a transcript with 1,000 tokens
  When I call the OpenAI API with specific parameters
  Then the API should return a 200 status code
```

### 2. Reliability Over Coverage
- **Stable Tests**: Prefer fewer stable tests over many flaky tests
- **Deterministic Outcomes**: Tests should have predictable results regardless of environment
- **Environment Independence**: Tests should not depend on external factors like network speed or system load

### 3. Fast Feedback Loop
- **Quick Execution**: Unit tests should run in under 30 seconds
- **Parallel Execution**: Design tests to run independently and in parallel
- **Immediate Results**: Developers should get test results quickly after making changes

## Before Making Changes

### Pre-Development Checklist
1. **Run Existing Tests**: Ensure all tests pass before starting development
   ```bash
   npm test              # Run unit tests
   npm run test:bdd      # Run BDD scenarios
   npm run lint          # Check code quality
   npm run type-check    # Verify TypeScript types
   ```

2. **Understand Test Coverage**: Review which areas are covered by existing tests
   ```bash
   npm run test:coverage  # Generate coverage report
   ```

3. **Review Related Tests**: Examine tests for code you'll be modifying

### Impact Assessment
- **Identify Affected Tests**: Determine which tests might be impacted by your changes
- **Consider Test Data**: Check if your changes affect mock data or test fixtures
- **Plan Test Updates**: Anticipate what test modifications might be needed

## Writing New Tests

### Test Design Guidelines

#### 1. Descriptive Test Names
```javascript
// ✅ Good - Clear intent
describe('Chinese character handling in exports', () => {
  it('should preserve Chinese characters in markdown export', () => {});
  it('should encode Chinese filenames correctly', () => {});
});

// ❌ Bad - Unclear purpose
describe('Export tests', () => {
  it('should work', () => {});
  it('should handle edge case', () => {});
});
```

#### 2. AAA Pattern (Arrange, Act, Assert)
```javascript
it('should generate summary with Chinese content', async () => {
  // Arrange - Set up test data
  const chineseTranscript = {
    entries: [
      { speaker: '張經理', text: '歡迎大家參與會議' }
    ]
  };
  
  // Act - Perform the action
  const summary = await generateSummary(chineseTranscript);
  
  // Assert - Verify the outcome
  expect(summary.content).toContain('張經理');
  expect(summary.language).toBe('zh-tw');
});
```

#### 3. Test One Thing at a Time
```javascript
// ✅ Good - Single responsibility
it('should preserve speaker names in summary', () => {
  // Test only speaker name preservation
});

it('should maintain timestamp format', () => {
  // Test only timestamp formatting
});

// ❌ Bad - Multiple responsibilities
it('should handle all transcript data correctly', () => {
  // Tests speakers, timestamps, content, formatting, etc.
});
```

### BDD Scenario Writing

#### 1. Focus on User Intent
```gherkin
# ✅ Good - Clear user goal
Scenario: Generate summary for team meeting
  Given I have a meeting transcript with multiple speakers
  When I generate a summary with the default template
  Then I should see a structured summary with key decisions

# ❌ Bad - Technical implementation
Scenario: API call returns JSON response
  Given I have 1,000 tokens of transcript data
  When I POST to /api/summarize with specific headers
  Then I should receive a 200 response with JSON body
```

#### 2. Use Business Language
```gherkin
# ✅ Good - Business terminology
Given I am viewing a recorded Teams meeting
When I extract the transcript
Then I should see speaker names and conversation content

# ❌ Bad - Technical jargon  
Given I am on a SharePoint Stream page with valid DOM elements
When I execute the transcript extraction algorithm
Then the parser should return structured data objects
```

#### 3. Keep Steps Generic and Reusable
```gherkin
# ✅ Good - Reusable steps
When I click "Generate Summary"
Then I should see a success message
And the summary should be displayed

# ❌ Bad - Overly specific
When I click the blue button with id "generate-btn" at coordinates (100,200)
Then I should see exactly "Summary generation completed in 2.3 seconds"
```

### Mock Data Best Practices

#### 1. Realistic Test Data
```javascript
// ✅ Good - Realistic meeting content
const mockTranscript = {
  title: "產品開發週會",
  date: "2025-01-20",
  participants: ["張經理", "王工程師", "李設計師"],
  entries: [
    { speaker: "張經理", text: "今天討論新功能的開發進度", timestamp: "00:01:23" },
    { speaker: "王工程師", text: "API整合已經完成80%", timestamp: "00:02:15" }
  ]
};

// ❌ Bad - Unrealistic or minimal data
const mockTranscript = {
  title: "Test Meeting",
  entries: [{ speaker: "User1", text: "Hello" }]
};
```

#### 2. Edge Case Coverage
```javascript
const testCases = [
  { name: "Normal meeting", data: normalMeetingData },
  { name: "Long meeting", data: longMeetingData },
  { name: "Chinese content", data: chineseMeetingData },
  { name: "Single speaker", data: monologueData },
  { name: "No speakers", data: noSpeakerData }
];
```

#### 3. Consistent Data Structure
```javascript
// Define standard structure and stick to it
interface MockTranscript {
  title: string;
  date: string;
  duration: string;
  participants: string[];
  entries: TranscriptEntry[];
}
```

## Code Quality Standards

### 1. TypeScript Usage
- **Strict Types**: Use strict TypeScript configuration
- **Interface Definitions**: Define interfaces for all test data structures
- **Type Safety**: Avoid `any` types in test code

```typescript
// ✅ Good - Proper typing
interface TestSummary {
  title: string;
  content: {
    fullSummary: string;
    keyDecisions: string[];
    actionItems: string[];
  };
  metadata: {
    date: string;
    participants: string[];
  };
}

// ❌ Bad - Loose typing
const summary: any = { /* ... */ };
```

### 2. Error Handling in Tests
```javascript
// ✅ Good - Explicit error testing
it('should handle invalid API key gracefully', async () => {
  const invalidKey = 'invalid-key';
  
  await expect(generateSummary(transcript, invalidKey))
    .rejects
    .toThrow('Invalid API key');
});

// ❌ Bad - Implicit error handling
it('should work with API key', async () => {
  const result = await generateSummary(transcript, 'some-key');
  expect(result).toBeTruthy(); // Doesn't test error cases
});
```

### 3. Test Organization
```javascript
// ✅ Good - Logical grouping
describe('Summary Generation', () => {
  describe('with valid inputs', () => {
    // Happy path tests
  });
  
  describe('with invalid inputs', () => {
    // Error handling tests
  });
  
  describe('with Chinese content', () => {
    // Internationalization tests
  });
});
```

## Common Anti-Patterns to Avoid

### 1. Timing Dependencies
```javascript
// ❌ Bad - Timing dependent
it('should generate summary quickly', async () => {
  const start = Date.now();
  await generateSummary(transcript);
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(5000); // Flaky!
});

// ✅ Good - Outcome focused
it('should generate summary successfully', async () => {
  const summary = await generateSummary(transcript);
  expect(summary.content).toBeDefined();
  expect(summary.title).toBeTruthy();
});
```

### 2. Environment-Specific Tests
```javascript
// ❌ Bad - Environment dependent
it('should work on Windows', () => {
  if (process.platform === 'win32') {
    // Windows-specific test
  }
});

// ✅ Good - Environment agnostic
it('should handle file paths correctly', () => {
  const filePath = path.join('folder', 'file.txt');
  expect(isValidPath(filePath)).toBe(true);
});
```

### 3. Overly Complex Scenarios
```javascript
// ❌ Bad - Too complex
it('should handle user registration, login, meeting creation, transcript extraction, summary generation, and export', () => {
  // Tests too many things at once
});

// ✅ Good - Single responsibility
it('should extract transcript from meeting page', () => {
  // Tests only transcript extraction
});
```

### 4. Implementation Testing
```javascript
// ❌ Bad - Testing implementation
it('should call OpenAI API with correct parameters', () => {
  const spy = jest.spyOn(api, 'call');
  generateSummary(transcript);
  expect(spy).toHaveBeenCalledWith(expectedParams);
});

// ✅ Good - Testing behavior
it('should generate meaningful summary', () => {
  const summary = generateSummary(transcript);
  expect(summary.content).toContain('key decisions');
  expect(summary.actionItems.length).toBeGreaterThan(0);
});
```

## Maintenance Guidelines

### Regular Maintenance Tasks

#### 1. Weekly Reviews
- **Test Failures**: Review and fix any failing tests
- **Flaky Tests**: Identify and stabilize inconsistent tests
- **Performance**: Monitor test execution time

#### 2. Monthly Updates
- **Test Data**: Update mock data to reflect current use patterns
- **Scenarios**: Review BDD scenarios for relevance and clarity
- **Coverage**: Assess test coverage and identify gaps

#### 3. Quarterly Assessments
- **Test Architecture**: Review overall test structure and organization
- **Tool Updates**: Evaluate and update testing tools and frameworks
- **Best Practices**: Review and update testing guidelines

### Test Evolution Principles

#### 1. Backward Compatibility
```javascript
// When updating test interfaces, maintain backward compatibility
interface LegacyTestData {
  title: string;
  content: string;
}

interface ModernTestData extends LegacyTestData {
  metadata: {
    date: string;
    participants: string[];
  };
}
```

#### 2. Incremental Improvement
- **Small Changes**: Make small, incremental improvements rather than major rewrites
- **Gradual Migration**: Migrate old test patterns gradually
- **Documentation**: Document changes and rationale

#### 3. Knowledge Sharing
- **Code Reviews**: Include test code in all code reviews
- **Team Training**: Regular sessions on testing best practices
- **Documentation**: Keep testing documentation current

## Integration with Development Workflow

### Git Workflow Integration
```bash
# Pre-commit hooks
npm run test              # Run tests before commit
npm run lint             # Ensure code quality
npm run type-check       # Verify TypeScript

# Pre-push hooks
npm run test:bdd         # Run integration tests
npm run build            # Ensure build works
```

### Continuous Integration
- **Automated Testing**: All tests run on every pull request
- **Quality Gates**: Tests must pass before merge
- **Coverage Reports**: Monitor test coverage trends

### Local Development
```bash
# Quick feedback during development
npm run test:watch       # Watch mode for unit tests
npm run test:debug       # Debug failing tests
npm run test:single test/path/to/specific.test.js
```

## Performance Guidelines

### Test Performance Targets
- **Unit Tests**: Complete in under 30 seconds
- **BDD Tests**: Complete in under 60 seconds
- **Full Test Suite**: Complete in under 2 minutes

### Optimization Strategies
- **Parallel Execution**: Run independent tests in parallel
- **Smart Mocking**: Mock expensive operations
- **Selective Testing**: Run only affected tests during development
- **Resource Management**: Clean up resources after tests

---

*This document is a living guide. Update it as testing practices evolve and new patterns emerge.*

*Last updated: 2025-01-20*