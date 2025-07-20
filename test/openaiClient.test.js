/**
 * Unit Tests for OpenAI Client
 * 
 * Tests all functionality of the OpenAI integration module including
 * API calls, error handling, rate limiting, and response processing.
 */

const { OpenAIClient, OpenAIError } = require('../src/openaiClient');

// Mock fetch for testing
global.fetch = jest.fn();

describe('OpenAIClient', () => {
  let client;
  const mockApiKey = 'sk-test-key-1234567890';
  
  beforeEach(() => {
    client = new OpenAIClient();
    fetch.mockClear();
    // Reset rate limiting
    client.lastRequestTime = 0;
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default options', () => {
      expect(client.baseUrl).toBe('https://api.openai.com/v1');
      expect(client.model).toBe('gpt-4.1');
      expect(client.maxTokens).toBe(32768);
      expect(client.temperature).toBe(0.3);
      expect(client.contextWindow).toBe(1047576);
    });

    test('should accept custom options', () => {
      const customClient = new OpenAIClient({
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 16384
      });

      expect(customClient.model).toBe('gpt-4');
      expect(customClient.temperature).toBe(0.5);
      expect(customClient.maxTokens).toBe(16384);
    });
  });

  describe('API Request Handling', () => {
    test('should make successful API request', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test summary response'
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const payload = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'test' }]
      };

      const result = await client.makeApiRequest(payload, mockApiKey);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Teams-Transcript-Extension/1.0'
          }),
          body: JSON.stringify(payload)
        })
      );

      expect(result).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid API key'
          }
        })
      });

      const payload = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'test' }]
      };

      await expect(client.makeApiRequest(payload, mockApiKey))
        .rejects.toThrow(OpenAIError);
    });

    test('should retry on rate limit errors', async () => {
      // First call fails with rate limit
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit exceeded'
          }
        })
      });

      // Second call succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success after retry' } }]
        })
      });

      const payload = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'test' }]
      };

      const result = await client.makeApiRequest(payload, mockApiKey);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.choices[0].message.content).toBe('Success after retry');
    });

    test('should respect rate limiting', async () => {
      const startTime = Date.now();
      client.lastRequestTime = startTime;
      client.minRequestInterval = 100; // 100ms for testing

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'test' } }]
        })
      });

      await client.makeApiRequest({ messages: [] }, mockApiKey);

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow small margin
    });
  });

  describe('Summary Generation', () => {
    const mockTranscript = {
      content: '[00:01:30] John Doe: Let us discuss the Q2 roadmap.\n[00:02:15] Jane Smith: I agree, we need to prioritize feature X.',
      metadata: {
        participants: ['John Doe', 'Jane Smith'],
        duration: '00:15:30',
        language: 'en'
      }
    };

    test('should generate summary successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: `# Meeting Summary

## Key Points
- Q2 roadmap discussion
- Feature X prioritization

## Action Items
- Review current priorities
- Plan feature development

## Decisions
- Feature X will be prioritized for Q2`
            }
          }
        ],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 100,
          total_tokens: 300
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const settings = {
        apiKey: mockApiKey,
        language: 'en'
      };

      const result = await client.generateSummary(mockTranscript, settings);

      expect(result).toHaveProperty('fullSummary');
      expect(result).toHaveProperty('keyPoints');
      expect(result).toHaveProperty('actionItems');
      expect(result).toHaveProperty('decisions');
      expect(result).toHaveProperty('markdown');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('metadata');
    });

    test('should handle different languages', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '會議摘要\n\n主要重點：討論Q2路線圖' } }]
        })
      });

      const settings = {
        apiKey: mockApiKey,
        language: 'zh-TW'
      };

      await client.generateSummary(mockTranscript, settings);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('請用繁體中文回答')
        })
      );
    });

    test('should use custom prompts', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Custom prompt response' } }]
        })
      });

      const customPrompt = 'Focus only on technical decisions.';
      const settings = {
        apiKey: mockApiKey,
        customPrompt
      };

      await client.generateSummary(mockTranscript, settings);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(customPrompt)
        })
      );
    });

    test('should throw error for missing API key', async () => {
      const settings = {};

      await expect(client.generateSummary(mockTranscript, settings))
        .rejects.toThrow('OpenAI API key is required');
    });

    test('should throw error for invalid transcript', async () => {
      const settings = { apiKey: mockApiKey };

      await expect(client.generateSummary(null, settings))
        .rejects.toThrow('Invalid transcript format');

      await expect(client.generateSummary({}, settings))
        .rejects.toThrow('Invalid transcript format');
    });
  });

  describe('Large Transcript Handling', () => {
    test('should chunk large transcripts', async () => {
      // Mock a large transcript that exceeds context window
      const largeTranscript = {
        content: 'A'.repeat(1000000), // 1M characters
        metadata: {
          participants: ['User1', 'User2'],
          duration: '03:00:00'
        }
      };

      // Mock response for chunk processing
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Chunk summary' } }]
        })
      });

      const settings = {
        apiKey: mockApiKey,
        language: 'en'
      };

      // This should trigger chunking
      const result = await client.generateSummary(largeTranscript, settings);

      expect(result).toHaveProperty('fullSummary');
      expect(fetch).toHaveBeenCalled();
    });

    test('should handle chunking errors gracefully', async () => {
      const largeTranscript = {
        content: 'A'.repeat(1000000),
        metadata: {
          participants: ['User1'],
          duration: '02:00:00'
        }
      };

      // Mock API failure
      fetch.mockRejectedValue(new Error('API Error'));

      const settings = {
        apiKey: mockApiKey
      };

      await expect(client.generateSummary(largeTranscript, settings))
        .rejects.toThrow(OpenAIError);
    });
  });

  describe('Connection Testing', () => {
    test('should test valid API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OK' } }]
        })
      });

      const result = await client.testConnection(mockApiKey);

      expect(result.success).toBe(true);
      expect(result.model).toBe('gpt-4.1');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('Test message for API key validation')
        })
      );
    });

    test('should test invalid API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' }
        })
      });

      const result = await client.testConnection('invalid-key');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });
  });

  describe('Prompt Management', () => {
    test('should provide default prompts', () => {
      const generalPrompt = client.getDefaultPrompt('general');
      expect(generalPrompt).toContain('Key Points');
      expect(generalPrompt).toContain('Action Items');
      expect(generalPrompt).toContain('Decisions');

      const technicalPrompt = client.getDefaultPrompt('technical');
      expect(technicalPrompt).toContain('Technical Decisions');
      expect(technicalPrompt).toContain('Technical Issues');

      const actionPrompt = client.getDefaultPrompt('actionItems');
      expect(actionPrompt).toContain('Specific tasks');
      expect(actionPrompt).toContain('Follow-ups');
    });

    test('should build messages correctly', () => {
      const transcript = {
        content: 'Test meeting content',
        metadata: {
          participants: ['User1', 'User2'],
          duration: '01:00:00'
        }
      };

      const messages = client.buildMessages(transcript, 'Test prompt', 'en');

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[0].content).toContain('Test prompt');
      expect(messages[0].content).toContain('Please respond in English');
      expect(messages[1].content).toContain('Test meeting content');
      expect(messages[1].content).toContain('User1, User2');
    });

    test('should format transcript for prompt correctly', () => {
      const transcript = {
        content: 'Meeting discussion content',
        metadata: {
          participants: ['Alice', 'Bob'],
          duration: '00:45:00',
          language: 'en'
        }
      };

      const formatted = client.formatTranscriptForPrompt(transcript);

      expect(formatted).toContain('Meeting Transcript:');
      expect(formatted).toContain('Participants: Alice, Bob');
      expect(formatted).toContain('Duration: 00:45:00');
      expect(formatted).toContain('Language: en');
      expect(formatted).toContain('Meeting discussion content');
    });
  });

  describe('Response Processing', () => {
    test('should parse structured summary', () => {
      const content = `Meeting Summary

Key Points:
- Point 1
- Point 2

Action Items:
- Task 1
- Task 2

Decisions:
- Decision 1
- Decision 2`;

      const summary = client.parseStructuredSummary(content);

      expect(summary.keyPoints.length).toBeGreaterThan(0);
      expect(summary.actionItems.length).toBeGreaterThan(0);
      expect(summary.decisions.length).toBeGreaterThan(0);
      expect(summary.markdown).toContain('Meeting Summary');
      expect(summary.html).toContain('meeting-summary');
    });

    test('should handle Chinese content parsing', () => {
      const content = `會議摘要

主要重點:
- 重點一
- 重點二

行動項目:
- 任務一
- 任務二`;

      const summary = client.parseStructuredSummary(content);

      expect(summary.fullSummary).toBe(content);
      expect(summary.markdown).toContain('Meeting Summary');
      expect(summary.html).toContain('meeting-summary');
    });

    test('should generate proper markdown', () => {
      const summary = {
        keyPoints: ['Point 1', 'Point 2'],
        actionItems: ['Task 1', 'Task 2'],
        decisions: ['Decision 1'],
        metadata: {
          generatedAt: '2024-01-15T10:00:00Z',
          duration: '01:30:00',
          participants: ['Alice', 'Bob']
        }
      };

      const markdown = client.generateMarkdown(summary);

      expect(markdown).toContain('# Meeting Summary');
      expect(markdown).toContain('**Duration:** 01:30:00');
      expect(markdown).toContain('**Participants:** Alice, Bob');
      expect(markdown).toContain('## Key Points');
      expect(markdown).toContain('- Point 1');
      expect(markdown).toContain('## Action Items');
      expect(markdown).toContain('- [ ] Task 1');
      expect(markdown).toContain('## Decisions');
      expect(markdown).toContain('- Decision 1');
    });

    test('should generate proper HTML', () => {
      const summary = {
        keyPoints: ['Point 1 <script>alert("xss")</script>'],
        actionItems: ['Task 1 & Task 2'],
        decisions: ['Decision "final"'],
        metadata: {
          generatedAt: '2024-01-15T10:00:00Z',
          duration: '01:30:00',
          participants: ['Alice', 'Bob']
        }
      };

      const html = client.generateHTML(summary);

      expect(html).toContain('<div class="meeting-summary">');
      expect(html).toContain('<h1>Meeting Summary</h1>');
      expect(html).toContain('<strong>Duration:</strong> 01:30:00');
      expect(html).toContain('<h2>Key Points</h2>');
      
      // Test XSS protection
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
      
      // Test HTML escaping
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
    });
  });

  describe('Utility Functions', () => {
    test('should estimate token count', () => {
      const englishText = 'This is a test sentence.';
      const chineseText = '這是一個測試句子。';

      const englishTokens = client.estimateTokenCount(englishText);
      const chineseTokens = client.estimateTokenCount(chineseText);

      expect(englishTokens).toBeGreaterThan(0);
      expect(chineseTokens).toBeGreaterThan(0);
      
      // Chinese should have more tokens per character
      expect(chineseTokens / chineseText.length).toBeGreaterThan(englishTokens / englishText.length);
    });

    test('should perform simple chunking', () => {
      const transcript = {
        content: Array(100).fill('[00:01:00] Speaker: This is a line of transcript.').join('\n'),
        metadata: { participants: ['Speaker'] }
      };

      const chunks = client.simpleChunk(transcript, 1000);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('metadata');
        expect(chunk.metadata).toEqual(transcript.metadata);
      });
    });

    test('should determine retry eligibility', () => {
      expect(client.shouldRetry(new OpenAIError(429, 'Rate limit'))).toBe(true);
      expect(client.shouldRetry(new OpenAIError(500, 'Server error'))).toBe(true);
      expect(client.shouldRetry(new OpenAIError(503, 'Service unavailable'))).toBe(true);
      expect(client.shouldRetry(new OpenAIError(401, 'Unauthorized'))).toBe(false);
      expect(client.shouldRetry(new OpenAIError(400, 'Bad request'))).toBe(false);
      
      const networkError = new TypeError('fetch failed');
      expect(client.shouldRetry(networkError)).toBe(true);
    });

    test('should calculate retry delay with exponential backoff', () => {
      const delay0 = client.calculateRetryDelay(0);
      const delay1 = client.calculateRetryDelay(1);
      const delay2 = client.calculateRetryDelay(2);

      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay2).toBeLessThanOrEqual(61000); // Max delay + jitter
    });

    test('should get language instructions', () => {
      expect(client.getLanguageInstruction('en')).toContain('English');
      expect(client.getLanguageInstruction('zh-TW')).toContain('繁體中文');
      expect(client.getLanguageInstruction('zh-CN')).toContain('简体中文');
      expect(client.getLanguageInstruction('ja')).toContain('日本語');
      expect(client.getLanguageInstruction('unknown')).toContain('English'); // fallback
    });

    test('should escape HTML correctly', () => {
      const escaped = client.escapeHtml('Test & <script>alert("xss")</script>');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&quot;');
    });
  });

  describe('Error Handling', () => {
    test('should handle OpenAI errors correctly', () => {
      const openaiError = new OpenAIError(401, 'Invalid API key', { type: 'invalid_request_error' });
      const handledError = client.handleError(openaiError);

      expect(handledError).toBe(openaiError);
      expect(handledError.status).toBe(401);
      expect(handledError.message).toBe('Invalid API key');
    });

    test('should handle network errors', () => {
      const networkError = new TypeError('fetch failed');
      const handledError = client.handleError(networkError);

      expect(handledError).toBeInstanceOf(OpenAIError);
      expect(handledError.message).toContain('Network error');
      expect(handledError.details.originalError).toBe(networkError);
    });

    test('should handle unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      const handledError = client.handleError(unknownError);

      expect(handledError).toBeInstanceOf(OpenAIError);
      expect(handledError.message).toBe('Something went wrong');
      expect(handledError.details.originalError).toBe(unknownError);
    });
  });
});

describe('OpenAIError', () => {
  test('should create error with correct properties', () => {
    const error = new OpenAIError(429, 'Rate limit exceeded', { type: 'rate_limit_error' });

    expect(error.name).toBe('OpenAIError');
    expect(error.status).toBe(429);
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.details.type).toBe('rate_limit_error');
  });

  test('should have proper toString method', () => {
    const error = new OpenAIError(401, 'Invalid API key');
    expect(error.toString()).toBe('OpenAIError (401): Invalid API key');
  });

  test('should inherit from Error', () => {
    const error = new OpenAIError(500, 'Server error');
    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toBeDefined();
  });
});

// Integration tests with real API calls (when API key is available)
describe('OpenAI Integration Tests', () => {
  const realApiKey = process.env.OPENAI_TEST_API_KEY;
  
  // Skip these tests if no real API key is provided
  const testCondition = realApiKey ? test : test.skip;

  testCondition('should make real API call', async () => {
    const client = new OpenAIClient();
    const transcript = {
      content: '[00:01:00] John: Hello everyone, let us start the meeting.\n[00:01:30] Jane: Great, I have the agenda ready.',
      metadata: {
        participants: ['John', 'Jane'],
        duration: '00:10:00',
        language: 'en'
      }
    };

    const settings = {
      apiKey: realApiKey,
      language: 'en'
    };

    const result = await client.generateSummary(transcript, settings);

    expect(result).toHaveProperty('fullSummary');
    expect(result).toHaveProperty('keyPoints');
    expect(result).toHaveProperty('metadata');
    expect(result.metadata.usage.totalTokens).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for real API calls

  testCondition('should test real connection', async () => {
    const client = new OpenAIClient();
    const result = await client.testConnection(realApiKey);

    expect(result.success).toBe(true);
    expect(result.model).toBe('gpt-4.1');
  }, 10000);
});