/**
 * Unit Tests for Anthropic Claude Client
 * Tests the Anthropic API integration for meeting summary generation
 */

const { AnthropicClient, DEFAULT_PROMPTS } = require('../../src/api/anthropicClient');

// Mock fetch for testing
global.fetch = jest.fn();

// Mock console to avoid noise in tests
console.log = jest.fn();
console.error = jest.fn();

describe('AnthropicClient', () => {
    let client;
    const validApiKey = 'sk-ant-api03-test1234567890abcdef1234567890abcdef123456';
    const invalidApiKey = 'invalid-key';

    beforeEach(() => {
        client = new AnthropicClient();
        fetch.mockClear();
        console.log.mockClear();
        console.error.mockClear();
    });

    describe('Initialization', () => {
        test('should validate API key format', () => {
            expect(client.validateApiKey(validApiKey)).toBe(true);
            expect(client.validateApiKey(invalidApiKey)).toBe(false);
            expect(client.validateApiKey('')).toBe(false);
            expect(client.validateApiKey(null)).toBe(false);
        });

        test('should initialize with valid API key', async () => {
            // Mock successful API test
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    content: [{ text: 'Test response' }],
                    model: 'claude-3-5-sonnet-20241022',
                    usage: { input_tokens: 10, output_tokens: 5 }
                })
            });

            await client.initialize(validApiKey);
            expect(client.apiKey).toBe(validApiKey);
        });

        test('should reject invalid API key during initialization', async () => {
            await expect(client.initialize(invalidApiKey))
                .rejects.toThrow('Invalid Anthropic API key format');
        });

        test('should test API connection during initialization', async () => {
            // Mock failed API test
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            });

            await expect(client.initialize(validApiKey))
                .rejects.toThrow('Anthropic API connection failed');
        });
    });

    describe('Token Estimation', () => {
        test('should estimate token count correctly', () => {
            const shortText = 'Hello world';
            const longText = 'This is a much longer text that should have more tokens estimated for it.';
            
            expect(client.estimateTokenCount(shortText)).toBeGreaterThan(0);
            expect(client.estimateTokenCount(longText)).toBeGreaterThan(client.estimateTokenCount(shortText));
        });

        test('should determine chunking needs based on token limits', async () => {
            const shortTranscript = { content: 'Short meeting transcript' };
            const longTranscript = { content: 'A'.repeat(800000) }; // Very long transcript (800k chars, ~200k tokens)
            
            expect(await client.checkTokenLimits(shortTranscript, 'claude-3-5-sonnet-20241022')).toBe(false);
            expect(await client.checkTokenLimits(longTranscript, 'claude-3-5-sonnet-20241022')).toBe(true);
        });
    });

    describe('Prompt Building', () => {
        test('should build system prompt with default template', () => {
            const prompt = client.buildSystemPrompt('default', null, 'en');
            expect(prompt).toContain('meeting summarizer');
            expect(prompt).toContain('Please provide the summary in English');
        });

        test('should build system prompt with custom template', () => {
            const customPrompt = 'Custom prompt template';
            const prompt = client.buildSystemPrompt('default', customPrompt, 'zh-TW');
            expect(prompt).toContain('Custom prompt template');
            expect(prompt).toContain('請用繁體中文提供摘要');
        });

        test('should build user message with transcript metadata', () => {
            const mockTranscript = {
                metadata: {
                    duration: '01:30:00',
                    participants: ['Alice', 'Bob'],
                    language: 'en',
                    totalEntries: 150
                },
                content: 'Meeting transcript content here...'
            };

            const message = client.buildUserMessage(mockTranscript);
            expect(message).toContain('Duration: 01:30:00');
            expect(message).toContain('Participants: Alice, Bob');
            expect(message).toContain('Meeting transcript content here...');
        });
    });

    describe('Language Support', () => {
        test('should provide language instructions for supported languages', () => {
            expect(client.getLanguageInstruction('en')).toContain('English');
            expect(client.getLanguageInstruction('zh-TW')).toContain('繁體中文');
            expect(client.getLanguageInstruction('zh-CN')).toContain('简体中文');
            expect(client.getLanguageInstruction('ja')).toContain('日本語');
            expect(client.getLanguageInstruction('unsupported')).toContain('English'); // fallback
        });
    });

    describe('Error Handling', () => {
        test('should identify non-retryable errors', () => {
            const authError = new Error('401 Unauthorized');
            const serverError = new Error('500 Internal Server Error');
            const quotaError = new Error('Quota exceeded');
            
            expect(client.shouldNotRetry(authError)).toBe(true);
            expect(client.shouldNotRetry(serverError)).toBe(false);
            expect(client.shouldNotRetry(quotaError)).toBe(true);
        });

        test('should create detailed error objects', () => {
            const originalError = new Error('Test error');
            const detailedError = client.createDetailedError(originalError);
            
            expect(detailedError.name).toBe('AnthropicClientError');
            expect(detailedError.originalError).toBe(originalError);
            expect(detailedError.timestamp).toBeDefined();
        });
    });

    describe('Chunking Strategy', () => {
        test('should create basic chunks for large transcripts', () => {
            const mockTranscript = {
                metadata: { participants: ['Alice', 'Bob'] },
                sections: [
                    { content: 'Section 1 content' },
                    { content: 'Section 2 content' },
                    { content: 'Section 3 content' },
                    { content: 'Section 4 content' },
                    { content: 'Section 5 content' },
                    { content: 'Section 6 content' }
                ]
            };

            const chunks = client.createBasicChunks(mockTranscript);
            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks[0].metadata.chunkIndex).toBe(0);
            expect(chunks[0].content).toContain('Section 1 content');
        });
    });

    describe('API Integration', () => {
        beforeEach(async () => {
            // Initialize client for API tests
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    content: [{ text: 'Test response' }],
                    model: 'claude-3-5-sonnet-20241022',
                    usage: { input_tokens: 10, output_tokens: 5 }
                })
            });
            await client.initialize(validApiKey);
        });

        test('should make successful API call', async () => {
            const mockResponse = {
                content: [
                    {
                        text: 'Generated summary content'
                    }
                ],
                model: 'claude-3-5-sonnet-20241022',
                usage: {
                    input_tokens: 100,
                    output_tokens: 200
                }
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const messages = [
                { role: 'user', content: 'Test prompt with test content' }
            ];

            const result = await client.makeApiCall('claude-3-5-sonnet-20241022', messages, {});
            expect(result).toEqual(mockResponse);
        });

        test('should handle rate limiting', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: {
                    get: (header) => header === 'retry-after' ? '60' : null
                }
            });

            const messages = [
                { role: 'user', content: 'Test content' }
            ];

            await expect(client.makeApiCall('claude-3-5-sonnet-20241022', messages, {}))
                .rejects.toThrow('Rate limit exceeded');
        });

        test('should generate summary for formatted transcript', async () => {
            const mockTranscript = {
                metadata: {
                    duration: '00:30:00',
                    participants: ['Alice', 'Bob'],
                    language: 'en',
                    totalEntries: 50
                },
                content: '[00:05:00] Alice: Let\'s discuss the project timeline.\n[00:05:30] Bob: I think we need two more weeks.',
                sections: [
                    { content: '[00:05:00] Alice: Let\'s discuss the project timeline.' },
                    { content: '[00:05:30] Bob: I think we need two more weeks.' }
                ]
            };

            const mockApiResponse = {
                content: [{
                    text: '## Meeting Summary\nDiscussed project timeline with 2-week extension needed.'
                }],
                model: 'claude-3-5-sonnet-20241022',
                usage: {
                    input_tokens: 150,
                    output_tokens: 100
                }
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockApiResponse)
            });

            const result = await client.generateSummary(mockTranscript, {
                promptType: 'default',
                language: 'en'
            });

            expect(result.summary).toContain('Meeting Summary');
            expect(result.metadata.model).toBe('claude-3-5-sonnet-20241022');
            expect(result.metadata.usage).toBeDefined();
        });
    });

    describe('Default Prompts', () => {
        test('should include all required prompt types', () => {
            expect(DEFAULT_PROMPTS.default).toBeDefined();
            expect(DEFAULT_PROMPTS.actionItems).toBeDefined();
            expect(DEFAULT_PROMPTS.technical).toBeDefined();
            
            expect(DEFAULT_PROMPTS.default).toContain('Meeting Summary');
            expect(DEFAULT_PROMPTS.actionItems).toContain('Action Items');
            expect(DEFAULT_PROMPTS.technical).toContain('Technical Summary');
        });
    });

    describe('Rate Limiting', () => {
        test('should respect rate limit reset time', async () => {
            client.rateLimitReset = Date.now() + 1000; // 1 second in future
            
            const startTime = Date.now();
            await client.checkRateLimit();
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeGreaterThanOrEqual(900); // Allow some tolerance
        });
    });

    describe('Model Selection', () => {
        test('should handle different model context limits', async () => {
            const shortText = { content: 'Short text' };
            const longText = { content: 'A'.repeat(800000) }; // 800k chars for 200k+ tokens to trigger chunking
            
            // Claude models should handle larger context
            expect(await client.checkTokenLimits(shortText, 'claude-3-5-sonnet-20241022')).toBe(false);
            expect(await client.checkTokenLimits(longText, 'claude-3-5-sonnet-20241022')).toBe(true);
        });

        test('should return available models', async () => {
            const models = await client.getAvailableModels();
            expect(models).toBeInstanceOf(Array);
            expect(models.length).toBeGreaterThan(0);
            expect(models[0]).toHaveProperty('id');
            expect(models[0]).toHaveProperty('contextWindow');
        });
    });

    describe('Feature Parity with OpenAI Client', () => {
        test('should have same public interface methods', () => {
            const methods = [
                'initialize',
                'generateSummary',
                'validateApiKey',
                'estimateTokenCount',
                'checkTokenLimits',
                'buildSystemPrompt',
                'buildUserMessage',
                'getLanguageInstruction',
                'createDetailedError',
                'getAvailableModels'
            ];

            methods.forEach(method => {
                expect(typeof client[method]).toBe('function');
            });
        });

        test('should have same configuration options', () => {
            const options = {
                promptType: 'technical',
                customPrompt: 'Custom prompt',
                language: 'zh-TW',
                temperature: 0.5,
                maxTokens: 4096
            };

            // Should not throw errors with same options as OpenAI client
            expect(() => {
                client.buildSystemPrompt(options.promptType, options.customPrompt, options.language);
            }).not.toThrow();
        });

        test('should return compatible response format', async () => {
            // Initialize client
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    content: [{ text: 'Test response' }],
                    model: 'claude-3-5-sonnet-20241022'
                })
            });
            await client.initialize(validApiKey);

            const mockTranscript = {
                metadata: {
                    duration: '00:30:00',
                    participants: ['Alice', 'Bob'],
                    language: 'en',
                    totalEntries: 50
                },
                content: 'Test transcript content',
                sections: [{ content: 'Test section' }]
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    content: [{ text: 'Summary content' }],
                    model: 'claude-3-5-sonnet-20241022',
                    usage: { input_tokens: 100, output_tokens: 50 }
                })
            });

            const result = await client.generateSummary(mockTranscript);

            // Should have same structure as OpenAI client response
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('metadata');
            expect(result).toHaveProperty('raw');
            expect(result.metadata).toHaveProperty('generatedAt');
            expect(result.metadata).toHaveProperty('model');
            expect(result.metadata).toHaveProperty('usage');
            expect(result.metadata).toHaveProperty('processingTime');
        });
    });
});

describe('Integration with Storage and Formatter', () => {
    test('should work with transcript formatter output', () => {
        // Mock output from transcriptFormatter
        const formattedTranscript = {
            metadata: {
                participants: ['王小明', '李小華'],
                duration: '01:15:30',
                language: 'zh-tw',
                totalEntries: 234
            },
            content: '[00:05:00] 王小明: 我們來討論這個季度的目標\n[00:05:30] 李小華: 我覺得我們需要專注在用戶體驗上',
            sections: [
                { content: '[00:05:00] 王小明: 我們來討論這個季度的目標' },
                { content: '[00:05:30] 李小華: 我覺得我們需要專注在用戶體驗上' }
            ]
        };

        const client = new AnthropicClient();
        const userMessage = client.buildUserMessage(formattedTranscript);
        
        expect(userMessage).toContain('王小明, 李小華');
        expect(userMessage).toContain('zh-tw');
        expect(userMessage).toContain('我們來討論這個季度的目標');
    });

    test('should generate Chinese language prompts', () => {
        const client = new AnthropicClient();
        const prompt = client.buildSystemPrompt('default', null, 'zh-TW');
        
        expect(prompt).toContain('請用繁體中文提供摘要');
    });
});

describe('Claude-specific Features', () => {
    test('should handle Claude message format correctly', () => {
        const client = new AnthropicClient();
        const mockTranscript = {
            metadata: {
                duration: '00:30:00',
                participants: ['Alice', 'Bob'],
                language: 'en',
                totalEntries: 50
            },
            content: 'Meeting content'
        };

        const systemPrompt = client.buildSystemPrompt('default', null, 'en');
        const userMessage = client.buildUserMessage(mockTranscript);

        // Claude combines system and user messages differently than OpenAI
        const combinedContent = `${systemPrompt}\n\n${userMessage}`;
        expect(combinedContent).toContain('Meeting Summary');
        expect(combinedContent).toContain('Meeting Information:');
    });

    test('should validate Claude API key format specifically', () => {
        const client = new AnthropicClient();
        
        expect(client.validateApiKey('sk-ant-api03-test123')).toBe(true);
        expect(client.validateApiKey('sk-test123')).toBe(false); // OpenAI format
        expect(client.validateApiKey('invalid')).toBe(false);
    });
});