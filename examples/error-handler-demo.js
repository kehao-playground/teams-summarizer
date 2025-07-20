/**
 * Error Handler Demo - Teams Transcript Extension
 * 
 * Demonstrates the comprehensive error handling and user feedback system
 * in various real-world scenarios that the extension might encounter.
 */

const { ErrorHandler, errorHandler, TeamsTranscriptError, ERROR_TYPES } = require('../src/utils/errorHandler.js');
const { UserFeedbackUI, userFeedbackUI } = require('../src/ui/userFeedbackUI.js');

// Mock DOM elements for browser environment simulation
if (typeof document === 'undefined') {
    global.document = {
        createElement: () => ({ 
            className: '', 
            id: '', 
            style: {}, 
            appendChild: () => {},
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => []
        }),
        head: { appendChild: () => {} },
        body: { appendChild: () => {} },
        getElementById: () => null,
        readyState: 'complete'
    };
    global.window = {
        location: { reload: () => {} }
    };
}

async function demonstrateErrorHandling() {
    console.log('🔧 Error Handling and User Feedback System Demo\n');
    console.log('=' * 60);
    
    const handler = new ErrorHandler();
    
    // Create feedback callback that logs instead of showing UI
    const demoFeedbackCallback = (feedback) => {
        console.log(`\n📱 User Feedback:
  Type: ${feedback.type}
  Title: ${feedback.message}
  Details: ${feedback.details}
  Actions: ${feedback.actions.map(a => a.label).join(', ')}`);
    };

    console.log('\n🎯 Scenario 1: SharePoint Authentication Failure');
    console.log('---------------------------------------------------');
    
    try {
        const authError = new Error('Unauthorized: Bearer token expired');
        authError.status = 401;
        
        const result = await handler.handleError(authError, {
            operation: 'transcript_extraction',
            language: 'en'
        }, demoFeedbackCallback);
        
        console.log(`Error Type: ${result.error.type}`);
        console.log(`Severity: ${result.error.severity}`);
        console.log(`Retryable: ${result.isRetryable}`);
        console.log(`Recovery Actions: ${result.actions.length} available`);
        
    } catch (error) {
        console.log(`Expected error: ${error.message}`);
    }

    console.log('\n🎯 Scenario 2: OpenAI API Key Error (Chinese)');
    console.log('----------------------------------------------');
    
    try {
        const apiError = new Error('Invalid API key provided');
        
        const result = await handler.handleError(apiError, {
            operation: 'ai_summary_generation',
            language: 'zh-TW',
            provider: 'openai'
        }, demoFeedbackCallback);
        
        console.log(`Error Type: ${result.error.type}`);
        console.log(`User Message (Chinese): ${result.userMessage.title}`);
        console.log(`Actions Available: ${result.actions.map(a => a.label).join(', ')}`);
        
    } catch (error) {
        console.log(`Expected error: ${error.message}`);
    }

    console.log('\n🎯 Scenario 3: Network Error with Retry');
    console.log('---------------------------------------');
    
    let networkAttempts = 0;
    const networkOperation = async () => {
        networkAttempts++;
        console.log(`  Attempt ${networkAttempts}: Network request...`);
        
        if (networkAttempts < 3) {
            const error = new Error('Failed to fetch');
            throw error;
        }
        
        return { success: true, data: 'Network response' };
    };

    const progressCallback = (update) => {
        console.log(`  Progress: ${update.type} - ${update.message}`);
    };

    try {
        const result = await handler.withRetry(networkOperation, {
            maxRetries: 3,
            initialDelay: 100,
            context: {
                operation: 'network_request',
                language: 'en'
            }
        }, progressCallback);
        
        console.log(`✅ Success after ${networkAttempts} attempts: ${result.data}`);
        
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
    }

    console.log('\n🎯 Scenario 4: Rate Limiting with Exponential Backoff');
    console.log('----------------------------------------------------');
    
    let rateLimitAttempts = 0;
    const rateLimitedOperation = async () => {
        rateLimitAttempts++;
        console.log(`  API Call Attempt ${rateLimitAttempts}`);
        
        if (rateLimitAttempts < 4) {
            const error = new Error('Rate limit exceeded. Try again later.');
            error.status = 429;
            throw error;
        }
        
        return { summary: 'Generated summary', tokens: 1500 };
    };

    const rateLimitProgressCallback = (update) => {
        if (update.type === 'wait') {
            console.log(`  ⏳ Waiting ${Math.round(update.delay/1000)}s before retry...`);
        } else if (update.type === 'retry') {
            console.log(`  🔄 Retry ${update.attempt}/${update.maxRetries}`);
        }
    };

    try {
        const startTime = Date.now();
        const result = await handler.withRetry(rateLimitedOperation, {
            maxRetries: 5,
            initialDelay: 500,
            maxDelay: 5000,
            backoffMultiplier: 2,
            jitter: false // Disable for predictable demo
        }, rateLimitProgressCallback);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Success: ${result.summary} (${duration}ms total)`);
        
    } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
    }

    console.log('\n🎯 Scenario 5: Large Transcript Processing Error');
    console.log('-----------------------------------------------');
    
    try {
        const transcriptError = new TeamsTranscriptError(
            ERROR_TYPES.TRANSCRIPT_TOO_LARGE,
            'Transcript exceeds token limit',
            null,
            null,
            {
                tokenCount: 250000,
                contextLimit: 200000,
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022'
            }
        );
        
        const result = await handler.handleError(transcriptError, {
            operation: 'large_transcript_processing',
            language: 'en',
            enableChunking: (enabled) => {
                console.log(`  📊 Chunking ${enabled ? 'enabled' : 'disabled'}`);
            }
        }, demoFeedbackCallback);
        
        console.log(`Error Category: ${result.error.category}`);
        console.log(`Context: ${JSON.stringify(result.error.context, null, 2)}`);
        
    } catch (error) {
        console.log(`Expected error: ${error.message}`);
    }

    console.log('\n🎯 Scenario 6: Multiple Error Types - Statistics');
    console.log('----------------------------------------------');
    
    // Generate multiple errors to show statistics
    const errorTypes = [
        ERROR_TYPES.API_RATE_LIMITED,
        ERROR_TYPES.NETWORK_CONNECTION,
        ERROR_TYPES.API_KEY_INVALID,
        ERROR_TYPES.TRANSCRIPT_NOT_FOUND,
        ERROR_TYPES.API_RATE_LIMITED  // Duplicate to show counting
    ];

    for (const errorType of errorTypes) {
        const error = new TeamsTranscriptError(errorType, `Test ${errorType}`);
        await handler.handleError(error, {}, () => {}); // Silent feedback
    }

    const stats = handler.getErrorStatistics();
    console.log(`\n📊 Error Statistics:
  Total Errors: ${stats.totalErrors}
  Rate Limited: ${stats.errorsByType[ERROR_TYPES.API_RATE_LIMITED] || 0}
  Network Issues: ${stats.errorsByType[ERROR_TYPES.NETWORK_CONNECTION] || 0}
  API Category: ${stats.errorsByCategory.api || 0}
  Successful Retries: ${stats.retriesSuccessful}
  Failed Retries: ${stats.retriesFailed}`);

    console.log('\n🎯 Scenario 7: Data Sanitization');
    console.log('---------------------------------');
    
    const sensitiveError = new Error('Authentication failed with API key sk-abc123 and Bearer token xyz789');
    const normalizedError = handler.normalizeError(sensitiveError, {
        apiKey: 'sk-sensitive-key-12345',
        userToken: 'bearer-token-abcdef',
        userEmail: 'user@company.com',
        operation: 'api_call'
    });

    console.log('Original message:', sensitiveError.message);
    console.log('Sanitized message:', handler.sanitizeMessage(sensitiveError.message));
    console.log('Sanitized context:', JSON.stringify(handler.sanitizeContext(normalizedError.context), null, 2));

    console.log('\n🎯 Scenario 8: Language Support');
    console.log('-------------------------------');
    
    const multiLangError = new TeamsTranscriptError(ERROR_TYPES.AUTH_EXPIRED, 'Session expired');
    
    const englishMessage = handler.getUserMessage(multiLangError, 'en');
    console.log(`English: ${englishMessage.title} - ${englishMessage.description}`);
    
    const chineseMessage = handler.getUserMessage(multiLangError, 'zh-TW');
    console.log(`Chinese: ${chineseMessage.title} - ${chineseMessage.description}`);

    console.log('\n✨ Demo Complete!');
    console.log('\nKey Features Demonstrated:');
    console.log('✓ Intelligent error type detection from status codes and messages');
    console.log('✓ User-friendly error messages in multiple languages');
    console.log('✓ Automatic retry with exponential backoff and jitter');
    console.log('✓ Contextual recovery actions for each error type');
    console.log('✓ Safe logging with sensitive data sanitization');
    console.log('✓ Error statistics and metrics tracking');
    console.log('✓ Progress tracking for long-running operations');
    console.log('✓ Comprehensive error categorization and severity levels');
    console.log('✓ Integration-ready with existing extension modules');
}

// Helper function to simulate realistic error scenarios
function createRealisticErrors() {
    return [
        // SharePoint API errors
        {
            message: 'Failed to fetch transcript: 401 Unauthorized',
            status: 401,
            scenario: 'User session expired while viewing meeting'
        },
        
        // OpenAI API errors
        {
            message: 'Invalid API key. Please check your API key and try again.',
            scenario: 'User entered incorrect OpenAI API key'
        },
        
        // Anthropic API errors  
        {
            message: 'Rate limit exceeded. Please try again in 60 seconds.',
            status: 429,
            scenario: 'Too many summary requests in short time'
        },
        
        // Network errors
        {
            message: 'NetworkError: Failed to fetch',
            scenario: 'User lost internet connection during operation'
        },
        
        // Transcript processing errors
        {
            message: 'Transcript not found for this meeting',
            status: 404,
            scenario: 'Meeting recording has no transcript yet'
        },
        
        // Large transcript errors
        {
            message: 'Transcript too large: 300,000 tokens exceeds 200,000 limit',
            scenario: 'Very long meeting with Claude Sonnet 4'
        }
    ];
}

// Run demonstration if called directly
if (require.main === module) {
    demonstrateErrorHandling().catch(console.error);
}

module.exports = {
    demonstrateErrorHandling,
    createRealisticErrors
};