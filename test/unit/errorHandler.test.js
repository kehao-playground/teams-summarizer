/**
 * Test Suite for Error Handler Module
 * Covers all error types, retry mechanisms, and user feedback scenarios
 */

const { ErrorHandler, errorHandler, TeamsTranscriptError, ERROR_TYPES, ERROR_CATEGORIES } = require('../../src/utils/errorHandler.js');

// Mock Chrome APIs
global.chrome = {
    runtime: {
        getManifest: () => ({ version: '1.0.0' }),
        openOptionsPage: jest.fn(),
        getURL: (path) => `chrome-extension://test-id/${path}`
    },
    tabs: {
        create: jest.fn()
    }
};

global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn()
};

global.fetch = jest.fn();

describe('TeamsTranscriptError', () => {
    test('should create error with all properties', () => {
        const error = new TeamsTranscriptError(
            ERROR_TYPES.API_KEY_INVALID,
            'Invalid API key',
            ERROR_CATEGORIES.API,
            new Error('Original error'),
            { apiProvider: 'openai' }
        );

        expect(error.name).toBe('TeamsTranscriptError');
        expect(error.type).toBe(ERROR_TYPES.API_KEY_INVALID);
        expect(error.category).toBe(ERROR_CATEGORIES.API);
        expect(error.message).toBe('Invalid API key');
        expect(error.context.apiProvider).toBe('openai');
        expect(error.timestamp).toBeDefined();
        expect(error.isRetryable).toBe(false);
        expect(error.severity).toBe('critical');
    });

    test('should auto-determine category from error type', () => {
        const authError = new TeamsTranscriptError(ERROR_TYPES.AUTH_EXPIRED, 'Auth expired');
        expect(authError.category).toBe(ERROR_CATEGORIES.AUTHENTICATION);

        const apiError = new TeamsTranscriptError(ERROR_TYPES.API_RATE_LIMITED, 'Rate limited');
        expect(apiError.category).toBe(ERROR_CATEGORIES.API);

        const networkError = new TeamsTranscriptError(ERROR_TYPES.NETWORK_TIMEOUT, 'Timeout');
        expect(networkError.category).toBe(ERROR_CATEGORIES.NETWORK);
    });

    test('should correctly determine retryability', () => {
        const retryableError = new TeamsTranscriptError(ERROR_TYPES.API_RATE_LIMITED, 'Rate limited');
        expect(retryableError.isRetryable).toBe(true);

        const nonRetryableError = new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid key');
        expect(nonRetryableError.isRetryable).toBe(false);
    });

    test('should correctly determine severity', () => {
        const criticalError = new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid key');
        expect(criticalError.severity).toBe('critical');

        const authError = new TeamsTranscriptError(ERROR_TYPES.AUTH_EXPIRED, 'Auth expired');
        expect(authError.severity).toBe('critical');

        const warningError = new TeamsTranscriptError(ERROR_TYPES.API_RATE_LIMITED, 'Rate limited');
        expect(warningError.severity).toBe('warning');

        const normalError = new TeamsTranscriptError(ERROR_TYPES.JSON_PARSE_ERROR, 'Parse error');
        expect(normalError.severity).toBe('error');
    });
});

describe('ErrorHandler', () => {
    let handler;
    let mockFeedback;

    beforeEach(() => {
        handler = new ErrorHandler();
        mockFeedback = jest.fn();
        jest.clearAllMocks();
    });

    describe('Error Detection and Normalization', () => {
        test('should detect authentication errors', () => {
            const error401 = new Error('Unauthorized');
            error401.status = 401;
            
            const normalized = handler.normalizeError(error401);
            expect(normalized.type).toBe(ERROR_TYPES.AUTH_EXPIRED);
            expect(normalized.category).toBe(ERROR_CATEGORIES.AUTHENTICATION);
        });

        test('should detect API rate limiting', () => {
            const rateLimitError = new Error('Too many requests');
            rateLimitError.status = 429;
            
            const normalized = handler.normalizeError(rateLimitError);
            expect(normalized.type).toBe(ERROR_TYPES.API_RATE_LIMITED);
            expect(normalized.isRetryable).toBe(true);
        });

        test('should detect transcript not found', () => {
            const notFoundError = new Error('Transcript not found');
            notFoundError.status = 404;
            
            const normalized = handler.normalizeError(notFoundError);
            expect(normalized.type).toBe(ERROR_TYPES.TRANSCRIPT_NOT_FOUND);
        });

        test('should detect network errors', () => {
            const networkError = new Error('Failed to fetch');
            
            const normalized = handler.normalizeError(networkError);
            expect(normalized.type).toBe(ERROR_TYPES.NETWORK_CONNECTION);
            expect(normalized.isRetryable).toBe(true);
        });

        test('should detect API key errors', () => {
            const apiKeyError = new Error('Invalid API key provided');
            
            const normalized = handler.normalizeError(apiKeyError);
            expect(normalized.type).toBe(ERROR_TYPES.API_KEY_INVALID);
            expect(normalized.isRetryable).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle error and provide user feedback', async () => {
            const error = new Error('API key invalid');
            
            const result = await handler.handleError(error, { language: 'en' }, mockFeedback);
            
            expect(result.error).toBeInstanceOf(TeamsTranscriptError);
            expect(result.userMessage.title).toContain('Invalid API Key');
            expect(result.actions.length).toBeGreaterThan(0);
            expect(mockFeedback).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'critical',
                    message: expect.stringContaining('Invalid API Key'),
                    actions: expect.any(Array)
                })
            );
        });

        test('should provide Chinese error messages', async () => {
            const error = new TeamsTranscriptError(ERROR_TYPES.AUTH_EXPIRED, 'Session expired');
            
            const result = await handler.handleError(error, { language: 'zh-TW' });
            
            expect(result.userMessage.title).toBe('登入已過期');
            expect(result.userMessage.description).toContain('Microsoft Teams');
        });

        test('should sanitize sensitive data in error messages', () => {
            const sensitiveMessage = 'Error with Bearer abc123token and api_key sk-1234567890';
            const sanitized = handler.sanitizeMessage(sensitiveMessage);
            
            expect(sanitized).not.toContain('abc123token');
            expect(sanitized).not.toContain('sk-1234567890');
            expect(sanitized).toContain('[REDACTED]');
        });
    });

    describe('Recovery Actions', () => {
        test('should provide refresh action for auth errors', async () => {
            const authError = new TeamsTranscriptError(ERROR_TYPES.AUTH_EXPIRED, 'Session expired');
            
            const result = await handler.handleError(authError);
            
            const refreshAction = result.actions.find(action => action.type === 'refresh');
            expect(refreshAction).toBeDefined();
            expect(refreshAction.label).toBe('Refresh Page');
            expect(refreshAction.primary).toBe(true);
        });

        test('should provide settings action for API key errors', async () => {
            const apiError = new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid API key');
            
            const result = await handler.handleError(apiError);
            
            const settingsAction = result.actions.find(action => action.type === 'settings');
            expect(settingsAction).toBeDefined();
            expect(settingsAction.label).toBe('Check API Key');
        });

        test('should provide wait action for transcript processing', async () => {
            const processingError = new TeamsTranscriptError(ERROR_TYPES.TRANSCRIPT_NOT_FOUND, 'Not found');
            
            const result = await handler.handleError(processingError, { operation: jest.fn() });
            
            const waitAction = result.actions.find(action => action.type === 'wait');
            expect(waitAction).toBeDefined();
            expect(waitAction.label).toBe('Check Later');
        });

        test('should provide chunking action for large transcripts', async () => {
            const largeError = new TeamsTranscriptError(ERROR_TYPES.TRANSCRIPT_TOO_LARGE, 'Too large');
            
            const result = await handler.handleError(largeError);
            
            const chunkAction = result.actions.find(action => action.type === 'chunk');
            expect(chunkAction).toBeDefined();
            expect(chunkAction.label).toBe('Process in Sections');
        });
    });

    describe('Retry Mechanism', () => {
        test('should retry operation with exponential backoff', async () => {
            let attempts = 0;
            const operation = jest.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 3) {
                    const error = new Error('Temporary failure');
                    error.status = 503;
                    throw error;
                }
                return 'success';
            });

            const progressCallback = jest.fn();
            
            const result = await handler.withRetry(operation, {
                maxRetries: 3,
                initialDelay: 100,
                maxDelay: 1000
            }, progressCallback);

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(3);
            expect(progressCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'retry',
                    attempt: 2
                })
            );
        });

        test('should not retry non-retryable errors', async () => {
            const operation = jest.fn().mockImplementation(() => {
                throw new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid key');
            });

            await expect(handler.withRetry(operation, { maxRetries: 3 })).rejects.toThrow();
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('should calculate correct retry delays', () => {
            const delay1 = handler.calculateRetryDelay(1000, 0, 2, 10000, false);
            expect(delay1).toBe(1000);

            const delay2 = handler.calculateRetryDelay(1000, 1, 2, 10000, false);
            expect(delay2).toBe(2000);

            const delay3 = handler.calculateRetryDelay(1000, 2, 2, 10000, false);
            expect(delay3).toBe(4000);

            // Test max delay
            const delayMax = handler.calculateRetryDelay(1000, 10, 2, 5000, false);
            expect(delayMax).toBe(5000);
        });

        test('should add jitter when requested', () => {
            const delays = [];
            for (let i = 0; i < 10; i++) {
                delays.push(handler.calculateRetryDelay(1000, 1, 2, 10000, true));
            }
            
            // Check that delays vary (jitter is working)
            const uniqueDelays = new Set(delays);
            expect(uniqueDelays.size).toBeGreaterThan(5); // Should have varied delays
        });
    });

    describe('Error Metrics', () => {
        test('should track error statistics', async () => {
            await handler.handleError(new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid'));
            await handler.handleError(new TeamsTranscriptError(ERROR_TYPES.API_RATE_LIMITED, 'Rate limited'));
            await handler.handleError(new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid again'));

            const stats = handler.getErrorStatistics();
            
            expect(stats.totalErrors).toBe(3);
            expect(stats.errorsByType[ERROR_TYPES.API_KEY_INVALID]).toBe(2);
            expect(stats.errorsByType[ERROR_TYPES.API_RATE_LIMITED]).toBe(1);
            expect(stats.errorsByCategory[ERROR_CATEGORIES.API]).toBe(3);
        });

        test('should track retry statistics', async () => {
            let attempts = 0;
            const operation = jest.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 2) {
                    throw new TeamsTranscriptError(ERROR_TYPES.API_RATE_LIMITED, 'Rate limited');
                }
                return 'success';
            });

            await handler.withRetry(operation, { maxRetries: 3 });
            
            const stats = handler.getErrorStatistics();
            expect(stats.retriesSuccessful).toBe(1);
        });

        test('should clear statistics', () => {
            handler.updateMetrics(new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid'));
            handler.clearStatistics();
            
            const stats = handler.getErrorStatistics();
            expect(stats.totalErrors).toBe(0);
            expect(Object.keys(stats.errorsByType)).toHaveLength(0);
        });
    });

    describe('Error ID Generation', () => {
        test('should generate unique error IDs', () => {
            const error1 = new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid');
            const error2 = new TeamsTranscriptError(ERROR_TYPES.API_RATE_LIMITED, 'Rate limited');
            
            const id1 = handler.generateErrorId(error1);
            const id2 = handler.generateErrorId(error2);
            
            expect(id1).toMatch(/^err_[a-z0-9]{8}$/);
            expect(id2).toMatch(/^err_[a-z0-9]{8}$/);
            expect(id1).not.toBe(id2);
        });

        test('should generate consistent IDs for same error', () => {
            const error = new TeamsTranscriptError(ERROR_TYPES.API_KEY_INVALID, 'Invalid');
            error.timestamp = '2025-01-01T00:00:00.000Z'; // Fix timestamp
            
            const id1 = handler.generateErrorId(error);
            const id2 = handler.generateErrorId(error);
            
            expect(id1).toBe(id2);
        });
    });

    describe('Helper Methods', () => {
        test('should test network connection', async () => {
            global.fetch.mockResolvedValueOnce({ ok: true });
            
            const isOnline = await handler.testNetworkConnection();
            expect(isOnline).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://www.google.com/favicon.ico',
                expect.objectContaining({ method: 'HEAD' })
            );
        });

        test('should detect offline status', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
            
            const isOnline = await handler.testNetworkConnection();
            expect(isOnline).toBe(false);
        });

        test('should open settings correctly', () => {
            handler.openSettings();
            expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
        });

        test('should schedule retry operations', () => {
            jest.useFakeTimers();
            const operation = jest.fn();
            
            handler.scheduleRetry(operation, 1000);
            
            expect(operation).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1000);
            expect(operation).toHaveBeenCalled();
            
            jest.useRealTimers();
        });
    });

    describe('Context Sanitization', () => {
        test('should sanitize sensitive context data', () => {
            const context = {
                apiKey: 'sk-1234567890',
                token: 'bearer-token-123',
                userEmail: 'user@example.com',
                normalData: 'safe-value'
            };
            
            const sanitized = handler.sanitizeContext(context);
            
            expect(sanitized.apiKey).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
            expect(sanitized.userEmail).toBe('user@example.com'); // Email is not in sensitive keys
            expect(sanitized.normalData).toBe('safe-value');
        });

        test('should sanitize stack traces', () => {
            const longStack = `Error: Test error
    at Object.test (chrome-extension://abcdef123456/popup.js:123:45)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
    at async Promise.all (index 0)
    at async main (chrome-extension://abcdef123456/background.js:67:8)
    at async run (chrome-extension://abcdef123456/utils.js:234:1)
    at async deep (chrome-extension://abcdef123456/deep.js:123:4)`;
            
            const sanitized = handler.sanitizeStackTrace(longStack);
            
            expect(sanitized).toContain('chrome-extension://[ID]');
            expect(sanitized).not.toContain('abcdef123456');
            expect(sanitized.split('\n')).toHaveLength(5); // Limited to 5 lines
        });
    });

    describe('Integration with Error Types', () => {
        test('should handle all defined error types', () => {
            Object.values(ERROR_TYPES).forEach(errorType => {
                const error = new TeamsTranscriptError(errorType, `Test ${errorType}`);
                expect(error.type).toBe(errorType);
                expect(error.category).toBeDefined();
                expect(typeof error.isRetryable).toBe('boolean');
                expect(['critical', 'warning', 'error']).toContain(error.severity);
            });
        });

        test('should provide user messages for all error types', () => {
            Object.values(ERROR_TYPES).forEach(errorType => {
                const error = new TeamsTranscriptError(errorType, `Test ${errorType}`);
                const userMessage = handler.getUserMessage(error, 'en');
                
                expect(userMessage.title).toBeDefined();
                expect(userMessage.description).toBeDefined();
                expect(userMessage.title.length).toBeGreaterThan(0);
                expect(userMessage.description.length).toBeGreaterThan(0);
            });
        });

        test('should provide recovery actions for all error types', () => {
            Object.values(ERROR_TYPES).forEach(errorType => {
                const error = new TeamsTranscriptError(errorType, `Test ${errorType}`);
                const actions = handler.getRecoveryActions(error, {});
                
                expect(Array.isArray(actions)).toBe(true);
                expect(actions.length).toBeGreaterThan(0);
                
                actions.forEach(action => {
                    expect(action.type).toBeDefined();
                    expect(action.label).toBeDefined();
                    expect(typeof action.action).toBe('function');
                    expect(typeof action.primary).toBe('boolean');
                });
            });
        });
    });
});

// Integration tests for real-world error scenarios
describe('Error Handler Integration', () => {
    let handler;

    beforeEach(() => {
        handler = new ErrorHandler();
    });

    test('should handle SharePoint authentication failure scenario', async () => {
        const authError = new Error('Request failed with status 401');
        authError.status = 401;
        
        const mockFeedback = jest.fn();
        const result = await handler.handleError(authError, {
            operation: jest.fn(),
            language: 'en'
        }, mockFeedback);

        expect(result.error.type).toBe(ERROR_TYPES.AUTH_EXPIRED);
        expect(result.actions).toContainEqual(
            expect.objectContaining({
                type: 'refresh',
                label: 'Refresh Page',
                primary: true
            })
        );
        expect(mockFeedback).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'critical', // Auth errors are critical
                message: 'Session Expired'
            })
        );
    });

    test('should handle OpenAI API key error scenario', async () => {
        const apiError = new Error('Invalid API key provided');
        // Don't set status since the API key detection should work from message
        
        const result = await handler.handleError(apiError, { language: 'zh-TW' });

        expect(result.error.type).toBe(ERROR_TYPES.API_KEY_INVALID);
        expect(result.userMessage.title).toBe('API 金鑰無效');
        expect(result.actions).toContainEqual(
            expect.objectContaining({
                type: 'settings',
                label: 'Check API Key'
            })
        );
    });

    test('should handle transcript processing with retry scenario', async () => {
        let attempts = 0;
        const transcriptOperation = jest.fn().mockImplementation(() => {
            attempts++;
            if (attempts < 3) {
                const error = new Error('Transcript not ready');
                error.status = 503; // Server error to make it retryable
                throw error;
            }
            return { transcript: 'success' };
        });

        const progressCallback = jest.fn();
        
        const result = await handler.withRetry(transcriptOperation, {
            maxRetries: 5,
            initialDelay: 100
        }, progressCallback);

        expect(result.transcript).toBe('success');
        expect(attempts).toBe(3);
        expect(progressCallback).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'retry'
            })
        );
    });
});

module.exports = {
    // Export test helpers for other test files
    createMockError: (type, message, status) => {
        const error = new Error(message);
        if (status) error.status = status;
        return error;
    },
    
    createMockFeedback: () => jest.fn(),
    
    waitForRetry: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};