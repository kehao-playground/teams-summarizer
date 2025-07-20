/**
 * Error Handling and User Feedback System for Teams Transcript Extension
 * 
 * Provides comprehensive error handling with user-friendly messages,
 * retry mechanisms, and fallback options for all error scenarios.
 * 
 * Features:
 * - User-friendly error messages with actionable guidance
 * - Automatic retry mechanisms with exponential backoff
 * - Fallback options for each error type
 * - Safe error logging without exposing sensitive data
 * - Recovery suggestions and user guidance
 * - Multi-language error message support
 */

// Error categories and types
const ERROR_CATEGORIES = {
    AUTHENTICATION: 'authentication',
    API: 'api',
    NETWORK: 'network',
    PARSING: 'parsing',
    VALIDATION: 'validation',
    QUOTA: 'quota',
    SYSTEM: 'system',
    USER_INPUT: 'user_input'
};

const ERROR_TYPES = {
    // Authentication errors
    AUTH_EXPIRED: 'auth_expired',
    AUTH_INVALID: 'auth_invalid',
    AUTH_MISSING: 'auth_missing',
    PERMISSION_DENIED: 'permission_denied',
    
    // API errors
    API_KEY_INVALID: 'api_key_invalid',
    API_KEY_MISSING: 'api_key_missing',
    API_RATE_LIMITED: 'api_rate_limited',
    API_QUOTA_EXCEEDED: 'api_quota_exceeded',
    API_SERVICE_UNAVAILABLE: 'api_service_unavailable',
    API_TIMEOUT: 'api_timeout',
    
    // Network errors
    NETWORK_OFFLINE: 'network_offline',
    NETWORK_TIMEOUT: 'network_timeout',
    NETWORK_CONNECTION: 'network_connection',
    
    // Data errors
    TRANSCRIPT_NOT_FOUND: 'transcript_not_found',
    TRANSCRIPT_PROCESSING: 'transcript_processing',
    TRANSCRIPT_CORRUPTED: 'transcript_corrupted',
    TRANSCRIPT_TOO_LARGE: 'transcript_too_large',
    
    // Parsing errors
    JSON_PARSE_ERROR: 'json_parse_error',
    INVALID_RESPONSE: 'invalid_response',
    FORMAT_ERROR: 'format_error',
    
    // Validation errors
    INVALID_URL: 'invalid_url',
    INVALID_CONFIG: 'invalid_config',
    MISSING_REQUIRED_FIELD: 'missing_required_field',
    
    // System errors
    CHROME_EXTENSION_ERROR: 'chrome_extension_error',
    STORAGE_ERROR: 'storage_error',
    MEMORY_ERROR: 'memory_error'
};

// Retry configurations
const RETRY_CONFIG = {
    DEFAULT: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true
    },
    AUTHENTICATION: {
        maxRetries: 1,
        initialDelay: 2000,
        maxDelay: 2000,
        backoffMultiplier: 1,
        jitter: false
    },
    RATE_LIMIT: {
        maxRetries: 3,
        initialDelay: 5000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true
    },
    NETWORK: {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 16000,
        backoffMultiplier: 2,
        jitter: true
    },
    NO_RETRY: {
        maxRetries: 0,
        initialDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 1,
        jitter: false
    }
};

/**
 * Custom error class for Teams Transcript Extension
 */
class TeamsTranscriptError extends Error {
    constructor(type, message, category = null, originalError = null, context = {}) {
        super(message);
        this.name = 'TeamsTranscriptError';
        this.type = type;
        this.category = category || this.getCategoryForType(type);
        this.originalError = originalError;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.isRetryable = this.determineRetryability();
        this.severity = this.determineSeverity();
    }

    getCategoryForType(type) {
        if (type.startsWith('auth_') || type === 'permission_denied') {
            return ERROR_CATEGORIES.AUTHENTICATION;
        }
        if (type.startsWith('api_')) {
            return ERROR_CATEGORIES.API;
        }
        if (type.startsWith('network_')) {
            return ERROR_CATEGORIES.NETWORK;
        }
        if (type.includes('transcript_')) {
            return ERROR_CATEGORIES.PARSING;
        }
        if (type.includes('invalid_') || type.includes('missing_')) {
            return ERROR_CATEGORIES.VALIDATION;
        }
        return ERROR_CATEGORIES.SYSTEM;
    }

    determineRetryability() {
        const retryableTypes = [
            ERROR_TYPES.API_RATE_LIMITED,
            ERROR_TYPES.API_SERVICE_UNAVAILABLE,
            ERROR_TYPES.API_TIMEOUT,
            ERROR_TYPES.NETWORK_TIMEOUT,
            ERROR_TYPES.NETWORK_CONNECTION,
            ERROR_TYPES.TRANSCRIPT_PROCESSING
        ];
        return retryableTypes.includes(this.type);
    }

    determineSeverity() {
        const criticalTypes = [
            ERROR_TYPES.API_KEY_INVALID,
            ERROR_TYPES.PERMISSION_DENIED,
            ERROR_TYPES.TRANSCRIPT_CORRUPTED
        ];
        
        const warningTypes = [
            ERROR_TYPES.API_RATE_LIMITED,
            ERROR_TYPES.NETWORK_TIMEOUT,
            ERROR_TYPES.TRANSCRIPT_PROCESSING
        ];

        // Auth errors are typically critical for user experience but can be resolved
        const authTypes = [
            ERROR_TYPES.AUTH_EXPIRED,
            ERROR_TYPES.AUTH_INVALID
        ];

        if (criticalTypes.includes(this.type)) return 'critical';
        if (authTypes.includes(this.type)) return 'critical';
        if (warningTypes.includes(this.type)) return 'warning';
        return 'error';
    }
}

/**
 * Main Error Handler class
 */
class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.retryAttempts = new Map();
        this.lastErrors = new Map();
        this.errorMetrics = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByCategory: new Map(),
            retriesSuccessful: 0,
            retriesFailed: 0
        };
    }

    /**
     * Handle any error and provide user feedback
     * @param {Error|TeamsTranscriptError} error - The error to handle
     * @param {Object} context - Additional context for error handling
     * @param {Function} feedbackCallback - Callback for user feedback
     * @returns {Object} Error handling result with user message and actions
     */
    async handleError(error, context = {}, feedbackCallback = null) {
        // Normalize error to TeamsTranscriptError
        const normalizedError = this.normalizeError(error, context);
        
        // Log error for debugging (without sensitive data)
        this.logError(normalizedError);
        
        // Update error metrics
        this.updateMetrics(normalizedError);
        
        // Get user-friendly message and actions
        const userMessage = this.getUserMessage(normalizedError, context.language || 'en');
        const actions = this.getRecoveryActions(normalizedError, context);
        
        // Provide feedback to user if callback provided
        if (feedbackCallback) {
            feedbackCallback({
                type: normalizedError.severity,
                message: userMessage.title,
                details: userMessage.description,
                actions: actions,
                errorId: this.generateErrorId(normalizedError)
            });
        }
        
        return {
            error: normalizedError,
            userMessage,
            actions,
            isRetryable: normalizedError.isRetryable,
            retryConfig: this.getRetryConfig(normalizedError.type)
        };
    }

    /**
     * Attempt operation with automatic retry logic
     * @param {Function} operation - The operation to attempt
     * @param {Object} options - Retry options
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise} Result of successful operation
     */
    async withRetry(operation, options = {}, progressCallback = null) {
        const {
            errorType = null,
            context = {},
            maxRetries = RETRY_CONFIG.DEFAULT.maxRetries,
            initialDelay = RETRY_CONFIG.DEFAULT.initialDelay,
            maxDelay = RETRY_CONFIG.DEFAULT.maxDelay,
            backoffMultiplier = RETRY_CONFIG.DEFAULT.backoffMultiplier,
            jitter = RETRY_CONFIG.DEFAULT.jitter
        } = options;

        let lastError = null;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                if (progressCallback && attempt > 0) {
                    progressCallback({
                        type: 'retry',
                        attempt,
                        maxRetries,
                        message: `Retrying operation (attempt ${attempt}/${maxRetries})...`
                    });
                }

                const result = await operation();
                
                // Success - record metrics and return
                if (attempt > 0) {
                    this.errorMetrics.retriesSuccessful++;
                }
                
                return result;

            } catch (error) {
                lastError = this.normalizeError(error, context);
                attempt++;

                // Check if we should retry this error type
                if (!lastError.isRetryable || attempt > maxRetries) {
                    this.errorMetrics.retriesFailed++;
                    break;
                }

                // Calculate delay with exponential backoff and jitter
                const delay = this.calculateRetryDelay(
                    initialDelay, 
                    attempt - 1, 
                    backoffMultiplier, 
                    maxDelay, 
                    jitter
                );

                if (progressCallback) {
                    progressCallback({
                        type: 'wait',
                        delay,
                        attempt: attempt + 1,
                        maxRetries,
                        message: `Waiting ${Math.round(delay/1000)}s before retry...`
                    });
                }

                await this.sleep(delay);
            }
        }

        // All retries exhausted
        throw lastError;
    }

    /**
     * Normalize any error to TeamsTranscriptError
     */
    normalizeError(error, context = {}) {
        if (error instanceof TeamsTranscriptError) {
            return error;
        }

        // Detect error type from error message and status
        const errorType = this.detectErrorType(error);
        const errorMessage = this.extractErrorMessage(error);
        
        return new TeamsTranscriptError(
            errorType,
            errorMessage,
            null, // category will be auto-determined
            error,
            context
        );
    }

    /**
     * Detect error type from error object
     */
    detectErrorType(error) {
        const message = error.message?.toLowerCase() || '';
        const status = error.status || error.response?.status;

        // Authentication errors
        if (status === 401 || message.includes('unauthorized') || message.includes('invalid token')) {
            return ERROR_TYPES.AUTH_EXPIRED;
        }
        if (status === 403 || message.includes('forbidden') || message.includes('permission')) {
            return ERROR_TYPES.PERMISSION_DENIED;
        }

        // API key errors - check before other API errors
        if (message.includes('api key') && (message.includes('invalid') || message.includes('provided'))) {
            return ERROR_TYPES.API_KEY_INVALID;
        }

        // API errors
        if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
            return ERROR_TYPES.API_RATE_LIMITED;
        }
        if (message.includes('quota') || message.includes('usage limit')) {
            return ERROR_TYPES.API_QUOTA_EXCEEDED;
        }
        if (status >= 500 || message.includes('server error') || message.includes('service unavailable')) {
            return ERROR_TYPES.API_SERVICE_UNAVAILABLE;
        }

        // Network errors
        if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
            return ERROR_TYPES.NETWORK_CONNECTION;
        }
        if (message.includes('timeout')) {
            return ERROR_TYPES.NETWORK_TIMEOUT;
        }

        // Transcript errors
        if (status === 404 || message.includes('not found') || message.includes('transcript')) {
            return ERROR_TYPES.TRANSCRIPT_NOT_FOUND;
        }

        // Parsing errors
        if (message.includes('json') || message.includes('parse')) {
            return ERROR_TYPES.JSON_PARSE_ERROR;
        }

        // Default to system error
        return ERROR_TYPES.CHROME_EXTENSION_ERROR;
    }

    /**
     * Extract meaningful error message
     */
    extractErrorMessage(error) {
        if (error.message) return error.message;
        if (error.error?.message) return error.error.message;
        if (error.statusText) return error.statusText;
        return 'An unknown error occurred';
    }

    /**
     * Get user-friendly message for error
     */
    getUserMessage(error, language = 'en') {
        const messages = this.getErrorMessages(language);
        const errorTypeMessages = messages[error.type] || messages.default;

        return {
            title: errorTypeMessages.title,
            description: errorTypeMessages.description,
            technicalDetails: this.shouldShowTechnicalDetails() ? error.message : null
        };
    }

    /**
     * Get recovery actions for error
     */
    getRecoveryActions(error, context = {}) {
        const actions = [];

        switch (error.type) {
            case ERROR_TYPES.AUTH_EXPIRED:
            case ERROR_TYPES.AUTH_INVALID:
                actions.push({
                    type: 'refresh',
                    label: 'Refresh Page',
                    action: () => window.location.reload(),
                    primary: true
                });
                actions.push({
                    type: 'help',
                    label: 'Login Help',
                    action: () => window.open('https://login.microsoftonline.com'),
                    primary: false
                });
                break;

            case ERROR_TYPES.API_KEY_INVALID:
            case ERROR_TYPES.API_KEY_MISSING:
                actions.push({
                    type: 'settings',
                    label: 'Check API Key',
                    action: () => this.openSettings(),
                    primary: true
                });
                actions.push({
                    type: 'help',
                    label: 'API Key Help',
                    action: () => this.showApiKeyHelp(),
                    primary: false
                });
                break;

            case ERROR_TYPES.TRANSCRIPT_NOT_FOUND:
                actions.push({
                    type: 'wait',
                    label: 'Check Later',
                    action: () => this.scheduleRetry(context.operation, 5 * 60 * 1000), // 5 minutes
                    primary: true
                });
                actions.push({
                    type: 'help',
                    label: 'Transcript Help',
                    action: () => this.showTranscriptHelp(),
                    primary: false
                });
                break;

            case ERROR_TYPES.API_RATE_LIMITED:
                actions.push({
                    type: 'wait',
                    label: 'Wait and Retry',
                    action: () => this.scheduleRetry(context.operation, 60 * 1000), // 1 minute
                    primary: true
                });
                break;

            case ERROR_TYPES.NETWORK_CONNECTION:
            case ERROR_TYPES.NETWORK_TIMEOUT:
                actions.push({
                    type: 'retry',
                    label: 'Try Again',
                    action: () => context.operation?.(),
                    primary: true
                });
                actions.push({
                    type: 'check',
                    label: 'Check Connection',
                    action: () => this.testNetworkConnection(),
                    primary: false
                });
                break;

            case ERROR_TYPES.TRANSCRIPT_TOO_LARGE:
                actions.push({
                    type: 'chunk',
                    label: 'Process in Sections',
                    action: () => this.enableChunking(context),
                    primary: true
                });
                break;

            default:
                if (error.isRetryable) {
                    actions.push({
                        type: 'retry',
                        label: 'Try Again',
                        action: () => context.operation?.(),
                        primary: true
                    });
                }
                actions.push({
                    type: 'report',
                    label: 'Report Issue',
                    action: () => this.reportError(error),
                    primary: false
                });
                break;
        }

        return actions;
    }

    /**
     * Get retry configuration for error type
     */
    getRetryConfig(errorType) {
        switch (errorType) {
            case ERROR_TYPES.AUTH_EXPIRED:
            case ERROR_TYPES.AUTH_INVALID:
            case ERROR_TYPES.API_KEY_INVALID:
                return RETRY_CONFIG.AUTHENTICATION;
            
            case ERROR_TYPES.API_RATE_LIMITED:
                return RETRY_CONFIG.RATE_LIMIT;
            
            case ERROR_TYPES.NETWORK_CONNECTION:
            case ERROR_TYPES.NETWORK_TIMEOUT:
                return RETRY_CONFIG.NETWORK;
            
            case ERROR_TYPES.TRANSCRIPT_CORRUPTED:
            case ERROR_TYPES.JSON_PARSE_ERROR:
                return RETRY_CONFIG.NO_RETRY;
            
            default:
                return RETRY_CONFIG.DEFAULT;
        }
    }

    /**
     * Calculate retry delay with exponential backoff and jitter
     */
    calculateRetryDelay(initialDelay, attempt, multiplier, maxDelay, addJitter) {
        let delay = initialDelay * Math.pow(multiplier, attempt);
        delay = Math.min(delay, maxDelay);
        
        if (addJitter) {
            // Add ±25% jitter
            const jitter = delay * 0.25 * (Math.random() * 2 - 1);
            delay += jitter;
        }
        
        return Math.max(delay, 0);
    }

    /**
     * Log error for debugging without exposing sensitive data
     */
    logError(error) {
        const sanitizedError = {
            type: error.type,
            category: error.category,
            severity: error.severity,
            timestamp: error.timestamp,
            isRetryable: error.isRetryable,
            message: this.sanitizeMessage(error.message),
            context: this.sanitizeContext(error.context),
            stack: error.originalError?.stack ? 
                this.sanitizeStackTrace(error.originalError.stack) : null
        };

        const logLevel = error.severity === 'critical' ? 'error' : 'warn';
        console[logLevel]('[TeamsTranscriptExtension] Error:', sanitizedError);
    }

    /**
     * Sanitize error message to remove sensitive data
     */
    sanitizeMessage(message) {
        return message
            .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]')
            .replace(/api[_-]?key["\s:=]+[A-Za-z0-9\-._~+/]+=*/gi, 'api_key: [REDACTED]')
            .replace(/sk-[A-Za-z0-9]+/g, 'sk-[REDACTED]')
            .replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]')
            .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');
    }

    /**
     * Sanitize context object
     */
    sanitizeContext(context) {
        const sanitized = { ...context };
        const sensitiveKeys = ['apikey', 'api_key', 'token', 'password', 'secret', 'auth', 'bearer'];
        
        Object.keys(sanitized).forEach(key => {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    /**
     * Sanitize stack trace
     */
    sanitizeStackTrace(stack) {
        return stack
            .split('\n')
            .slice(0, 5) // Limit stack trace depth
            .map(line => line.replace(/chrome-extension:\/\/[a-z]+/g, 'chrome-extension://[ID]'))
            .join('\n');
    }

    /**
     * Update error metrics
     */
    updateMetrics(error) {
        this.errorMetrics.totalErrors++;
        
        const typeCount = this.errorMetrics.errorsByType.get(error.type) || 0;
        this.errorMetrics.errorsByType.set(error.type, typeCount + 1);
        
        const categoryCount = this.errorMetrics.errorsByCategory.get(error.category) || 0;
        this.errorMetrics.errorsByCategory.set(error.category, categoryCount + 1);
    }

    /**
     * Generate unique error ID for tracking
     */
    generateErrorId(error) {
        const timestamp = Date.now();
        const hash = this.simpleHash(error.type + error.message + timestamp);
        const id = hash.toString(36).padStart(8, '0').substring(0, 8);
        return `err_${id}`;
    }

    /**
     * Simple hash function for error IDs
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Check if technical details should be shown (debug mode)
     */
    shouldShowTechnicalDetails() {
        // Check if extension is in debug mode
        if (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest?.()) {
            return chrome.runtime.getManifest().version?.includes('dev');
        }
        
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('debugMode') === 'true';
        }
        
        // Default to false in Node.js environment
        return false;
    }

    /**
     * Get error messages in specified language
     */
    getErrorMessages(language) {
        const messages = ERROR_MESSAGES[language] || ERROR_MESSAGES.en;
        return messages;
    }

    /**
     * Helper methods for recovery actions
     */
    openSettings() {
        // Open extension settings
        if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        } else {
            console.log('[ErrorHandler] Settings would open in browser environment');
        }
    }

    showApiKeyHelp() {
        const helpUrl = 'https://platform.openai.com/account/api-keys';
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            chrome.tabs.create({ url: helpUrl });
        } else {
            console.log(`[ErrorHandler] API key help: ${helpUrl}`);
        }
    }

    showTranscriptHelp() {
        console.log('Transcript help: Please wait a few minutes for transcript processing to complete');
    }

    async testNetworkConnection() {
        try {
            await fetch('https://www.google.com/favicon.ico', { 
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    scheduleRetry(operation, delay) {
        if (operation) {
            setTimeout(() => operation(), delay);
        }
    }

    enableChunking(context) {
        if (context.enableChunking) {
            context.enableChunking(true);
        }
    }

    reportError(error) {
        const errorReport = {
            id: this.generateErrorId(error),
            type: error.type,
            timestamp: error.timestamp,
            userAgent: navigator.userAgent,
            version: chrome.runtime.getManifest().version
        };
        
        console.log('Error report prepared:', errorReport);
        // In a real implementation, this could send to a bug tracking system
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get error statistics
     */
    getErrorStatistics() {
        return {
            ...this.errorMetrics,
            errorsByType: Object.fromEntries(this.errorMetrics.errorsByType),
            errorsByCategory: Object.fromEntries(this.errorMetrics.errorsByCategory)
        };
    }

    /**
     * Clear error statistics
     */
    clearStatistics() {
        this.errorMetrics = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByCategory: new Map(),
            retriesSuccessful: 0,
            retriesFailed: 0
        };
    }
}

// Error messages in multiple languages
const ERROR_MESSAGES = {
    en: {
        [ERROR_TYPES.AUTH_EXPIRED]: {
            title: 'Session Expired',
            description: 'Your Microsoft Teams session has expired. Please refresh the page to log in again.'
        },
        [ERROR_TYPES.AUTH_INVALID]: {
            title: 'Authentication Failed',
            description: 'Unable to authenticate with Microsoft Teams. Please ensure you are logged in.'
        },
        [ERROR_TYPES.PERMISSION_DENIED]: {
            title: 'Access Denied',
            description: 'You don\'t have permission to access this transcript. Please check with the meeting organizer.'
        },
        [ERROR_TYPES.API_KEY_INVALID]: {
            title: 'Invalid API Key',
            description: 'Your AI provider API key is invalid. Please check your settings and update your API key.'
        },
        [ERROR_TYPES.API_KEY_MISSING]: {
            title: 'API Key Required',
            description: 'Please configure your AI provider API key in the extension settings.'
        },
        [ERROR_TYPES.API_RATE_LIMITED]: {
            title: 'Rate Limited',
            description: 'Too many requests to the AI service. Please wait a moment and try again.'
        },
        [ERROR_TYPES.API_QUOTA_EXCEEDED]: {
            title: 'Quota Exceeded',
            description: 'Your AI service quota has been exceeded. Please check your account or try again later.'
        },
        [ERROR_TYPES.TRANSCRIPT_NOT_FOUND]: {
            title: 'Transcript Not Available',
            description: 'No transcript found for this meeting. Transcripts may take a few minutes to generate after recording.'
        },
        [ERROR_TYPES.TRANSCRIPT_PROCESSING]: {
            title: 'Transcript Processing',
            description: 'The transcript is still being processed. Please wait a few minutes and try again.'
        },
        [ERROR_TYPES.NETWORK_CONNECTION]: {
            title: 'Connection Error',
            description: 'Unable to connect to the service. Please check your internet connection and try again.'
        },
        [ERROR_TYPES.TRANSCRIPT_TOO_LARGE]: {
            title: 'Large Transcript',
            description: 'This transcript is very large. It will be processed in sections for better results.'
        },
        default: {
            title: 'Something Went Wrong',
            description: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
        }
    },
    'zh-TW': {
        [ERROR_TYPES.AUTH_EXPIRED]: {
            title: '登入已過期',
            description: '您的 Microsoft Teams 登入已過期，請重新整理頁面以重新登入。'
        },
        [ERROR_TYPES.AUTH_INVALID]: {
            title: '驗證失敗',
            description: '無法驗證 Microsoft Teams 身份，請確認您已正確登入。'
        },
        [ERROR_TYPES.PERMISSION_DENIED]: {
            title: '存取被拒絕',
            description: '您沒有存取此會議記錄的權限，請聯絡會議主辦人。'
        },
        [ERROR_TYPES.API_KEY_INVALID]: {
            title: 'API 金鑰無效',
            description: '您的 AI 服務 API 金鑰無效，請檢查設定並更新 API 金鑰。'
        },
        [ERROR_TYPES.API_KEY_MISSING]: {
            title: '需要 API 金鑰',
            description: '請在擴充功能設定中配置您的 AI 服務 API 金鑰。'
        },
        [ERROR_TYPES.API_RATE_LIMITED]: {
            title: '請求頻率限制',
            description: '對 AI 服務的請求過於頻繁，請稍候再試。'
        },
        [ERROR_TYPES.TRANSCRIPT_NOT_FOUND]: {
            title: '找不到會議記錄',
            description: '找不到此會議的逐字稿，會議記錄可能需要錄製後幾分鐘才會產生。'
        },
        [ERROR_TYPES.NETWORK_CONNECTION]: {
            title: '連線錯誤',
            description: '無法連線到服務，請檢查網路連線並重試。'
        },
        [ERROR_TYPES.TRANSCRIPT_TOO_LARGE]: {
            title: '會議記錄過大',
            description: '此會議記錄很大，將分段處理以獲得更好的結果。'
        },
        default: {
            title: '發生錯誤',
            description: '發生未預期的錯誤，請重試或聯絡支援服務。'
        }
    }
};

// Create singleton instance
const errorHandler = new ErrorHandler();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ErrorHandler, 
        errorHandler, 
        TeamsTranscriptError,
        ERROR_CATEGORIES,
        ERROR_TYPES,
        RETRY_CONFIG 
    };
} else {
    // Browser environment - attach to window
    window.ErrorHandler = ErrorHandler;
    window.errorHandler = errorHandler;
    window.TeamsTranscriptError = TeamsTranscriptError;
    window.ERROR_TYPES = ERROR_TYPES;
}