/**
 * Provider Comparison Integration Tests
 * Tests switching between OpenAI and Anthropic providers
 */

const { OpenAIClient } = require('../../src/api/openaiClient');
const { AnthropicClient } = require('../../src/api/anthropicClient');

// Mock fetch for testing
global.fetch = jest.fn();

// Mock console to avoid noise in tests
console.log = jest.fn();
console.error = jest.fn();

describe('Provider Comparison', () => {
    let openaiClient;
    let anthropicClient;
    
    const mockTranscript = {
        metadata: {
            participants: ['Alice', 'Bob'],
            duration: '00:30:00',
            language: 'en',
            totalEntries: 50
        },
        content: '[00:05:00] Alice: Let\'s discuss the project.\n[00:05:30] Bob: I agree with the proposal.',
        sections: [
            { content: '[00:05:00] Alice: Let\'s discuss the project.' },
            { content: '[00:05:30] Bob: I agree with the proposal.' }
        ]
    };

    beforeEach(() => {
        openaiClient = new OpenAIClient();
        anthropicClient = new AnthropicClient();
        fetch.mockClear();
        console.log.mockClear();
        console.error.mockClear();
    });

    describe('Feature Parity', () => {
        test('should have identical public API methods', () => {
            const requiredMethods = [
                'initialize',
                'generateSummary',
                'validateApiKey',
                'estimateTokenCount',
                'checkTokenLimits',
                'buildSystemPrompt',
                'buildUserMessage',
                'getLanguageInstruction',
                'createDetailedError'
            ];

            requiredMethods.forEach(method => {
                expect(typeof openaiClient[method]).toBe('function');
                expect(typeof anthropicClient[method]).toBe('function');
            });
        });

        test('should handle same configuration options', () => {
            const options = {
                promptType: 'technical',
                customPrompt: 'Custom meeting analysis prompt',
                language: 'zh-TW',
                temperature: 0.5,
                maxTokens: 4096
            };

            // Both clients should handle same options without errors
            expect(() => {
                openaiClient.buildSystemPrompt(options.promptType, options.customPrompt, options.language);
                anthropicClient.buildSystemPrompt(options.promptType, options.customPrompt, options.language);
            }).not.toThrow();
        });

        test('should return compatible response formats', async () => {
            // Initialize OpenAI client
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ id: 'gpt-4.1' }]
                })
            });
            await openaiClient.initialize('sk-test1234567890abcdef1234567890abcdef123456');

            // Initialize Anthropic client
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    content: [{ text: 'Test response' }],
                    model: 'claude-3-5-sonnet-20241022'
                })
            });
            await anthropicClient.initialize('sk-ant-api03-test1234567890abcdef1234567890abcdef123456');

            // Mock OpenAI response
            const openaiResponse = {
                choices: [{
                    message: { content: 'OpenAI summary content' }
                }],
                model: 'gpt-4.1',
                usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
            };

            // Mock Anthropic response
            const anthropicResponse = {
                content: [{ text: 'Anthropic summary content' }],
                model: 'claude-3-5-sonnet-20241022',
                usage: { input_tokens: 100, output_tokens: 50 }
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(openaiResponse)
            });

            const openaiResult = await openaiClient.generateSummary(mockTranscript);

            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(anthropicResponse)
            });

            const anthropicResult = await anthropicClient.generateSummary(mockTranscript);

            // Both should have same structure
            const expectedProperties = ['summary', 'metadata', 'raw'];
            expectedProperties.forEach(prop => {
                expect(openaiResult).toHaveProperty(prop);
                expect(anthropicResult).toHaveProperty(prop);
            });

            // Metadata should have same structure
            const expectedMetadata = ['generatedAt', 'model', 'usage', 'processingTime'];
            expectedMetadata.forEach(prop => {
                expect(openaiResult.metadata).toHaveProperty(prop);
                expect(anthropicResult.metadata).toHaveProperty(prop);
            });
        });
    });

    describe('API Key Validation', () => {
        test('should validate correct formats for each provider', () => {
            const openaiKey = 'sk-test1234567890abcdef1234567890abcdef123456';
            const anthropicKey = 'sk-ant-api03-test1234567890abcdef1234567890abcdef123456';

            expect(openaiClient.validateApiKey(openaiKey)).toBe(true);
            expect(openaiClient.validateApiKey(anthropicKey)).toBe(false);

            expect(anthropicClient.validateApiKey(anthropicKey)).toBe(true);
            expect(anthropicClient.validateApiKey(openaiKey)).toBe(false);
        });
    });

    describe('Language Support', () => {
        test('should provide same language instructions', () => {
            const languages = ['en', 'zh-TW', 'zh-CN', 'ja', 'ko'];

            languages.forEach(lang => {
                const openaiInstruction = openaiClient.getLanguageInstruction(lang);
                const anthropicInstruction = anthropicClient.getLanguageInstruction(lang);

                expect(openaiInstruction).toBe(anthropicInstruction);
            });
        });
    });

    describe('Token Estimation', () => {
        test('should use same token estimation algorithm', () => {
            const testTexts = [
                'Short text',
                'Medium length text with more words',
                mockTranscript.content
            ];

            testTexts.forEach(text => {
                const openaiTokens = openaiClient.estimateTokenCount(text);
                const anthropicTokens = anthropicClient.estimateTokenCount(text);

                expect(openaiTokens).toBe(anthropicTokens);
            });
        });
    });

    describe('Chunking Strategy', () => {
        test('should use same chunking logic', () => {
            const largeTranscript = {
                ...mockTranscript,
                sections: Array(10).fill(0).map((_, i) => ({
                    content: `Section ${i + 1} content`
                }))
            };

            const openaiChunks = openaiClient.createBasicChunks(largeTranscript);
            const anthropicChunks = anthropicClient.createBasicChunks(largeTranscript);

            expect(openaiChunks.length).toBe(anthropicChunks.length);
            expect(openaiChunks[0].content).toBe(anthropicChunks[0].content);
        });
    });

    describe('Error Handling', () => {
        test('should classify errors consistently', () => {
            const testErrors = [
                new Error('401 Unauthorized'),
                new Error('403 Forbidden'),
                new Error('429 Rate limit exceeded'),
                new Error('500 Internal Server Error'),
                new Error('Network error')
            ];

            testErrors.forEach(error => {
                const openaiShouldRetry = !openaiClient.shouldNotRetry(error);
                const anthropicShouldRetry = !anthropicClient.shouldNotRetry(error);

                expect(openaiShouldRetry).toBe(anthropicShouldRetry);
            });
        });

        test('should create compatible detailed errors', () => {
            const originalError = new Error('Test error');

            const openaiError = openaiClient.createDetailedError(originalError);
            const anthropicError = anthropicClient.createDetailedError(originalError);

            expect(openaiError.message).toBe(anthropicError.message);
            expect(openaiError.originalError).toBe(anthropicError.originalError);
            expect(typeof openaiError.timestamp).toBe(typeof anthropicError.timestamp);
        });
    });

    describe('Provider Switching Simulation', () => {
        test('should switch providers seamlessly', async () => {
            const settings = {
                promptType: 'default',
                language: 'en',
                temperature: 0.3
            };

            // Test switching from OpenAI to Anthropic
            let currentProvider = 'openai';
            let client = openaiClient;

            // Initialize first provider
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [{ id: 'gpt-4.1' }]
                })
            });
            await client.initialize('sk-test1234567890abcdef1234567890abcdef123456');

            // Generate summary with first provider
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: 'OpenAI summary' } }],
                    model: 'gpt-4.1',
                    usage: { total_tokens: 150 }
                })
            });

            const firstResult = await client.generateSummary(mockTranscript, settings);
            expect(firstResult.summary).toBe('OpenAI summary');

            // Switch to second provider
            currentProvider = 'anthropic';
            client = anthropicClient;

            // Initialize second provider
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    content: [{ text: 'Test response' }],
                    model: 'claude-3-5-sonnet-20241022'
                })
            });
            await client.initialize('sk-ant-api03-test1234567890abcdef1234567890abcdef123456');

            // Generate summary with second provider
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    content: [{ text: 'Anthropic summary' }],
                    model: 'claude-3-5-sonnet-20241022',
                    usage: { input_tokens: 100, output_tokens: 50 }
                })
            });

            const secondResult = await client.generateSummary(mockTranscript, settings);
            expect(secondResult.summary).toBe('Anthropic summary');

            // Both results should have compatible structure
            expect(firstResult).toHaveProperty('summary');
            expect(firstResult).toHaveProperty('metadata');
            expect(secondResult).toHaveProperty('summary');
            expect(secondResult).toHaveProperty('metadata');
        });
    });

    describe('Context Window Differences', () => {
        test('should handle different context windows appropriately', async () => {
            const largeText = 'A'.repeat(600000); // 600k characters
            const largeTranscript = { content: largeText };

            // GPT 4.1 with 1M+ context should not need chunking
            const openaiNeedsChunking = await openaiClient.checkTokenLimits(largeTranscript, 'gpt-4.1');
            expect(openaiNeedsChunking).toBe(false);

            // Claude with 200k context should need chunking
            const anthropicNeedsChunking = await anthropicClient.checkTokenLimits(largeTranscript, 'claude-3-5-sonnet-20241022');
            expect(anthropicNeedsChunking).toBe(true);
        });
    });
});