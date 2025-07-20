/**
 * Error Handler Integration Examples
 * 
 * Demonstrates how to integrate the error handler with existing modules
 * in the Teams Transcript Extension for comprehensive error handling.
 */

// Example 1: Integration with Stream API Client
async function enhancedFetchTranscript(meetingInfo, errorHandler, userFeedbackUI) {
    const progressCallback = userFeedbackUI.createProgressCallback();
    const feedbackCallback = userFeedbackUI.createErrorFeedbackCallback();

    try {
        progressCallback({
            stage: 'extracting',
            current: 1,
            total: 3,
            message: 'Connecting to Microsoft Stream API...'
        });

        const result = await errorHandler.withRetry(
            async () => {
                const { siteUrl, driveId, itemId, transcriptId } = meetingInfo;
                
                // Get authentication headers
                const headers = await getAuthHeaders();
                
                const apiUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcriptId}/streamContent?format=json`;
                
                progressCallback({
                    stage: 'extracting',
                    current: 2,
                    total: 3,
                    message: 'Fetching transcript data...'
                });

                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        ...headers,
                        'Application': 'OnePlayer',
                        'Scenario': 'LoadPlayer',
                        'Type': 'AUO'
                    }
                });

                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }

                const transcript = await response.json();
                
                progressCallback({
                    stage: 'extracting',
                    current: 3,
                    total: 3,
                    message: 'Processing transcript data...'
                });

                return transcript;
            },
            {
                context: {
                    operation: 'transcript_extraction',
                    meetingInfo,
                    language: 'en'
                },
                maxRetries: 3
            },
            progressCallback
        );

        progressCallback({ stage: 'complete' });
        
        userFeedbackUI.showSuccess(
            'Transcript Extracted',
            'Meeting transcript has been successfully extracted and is ready for summarization.'
        );

        return result;

    } catch (error) {
        progressCallback({ stage: 'complete' });
        
        await errorHandler.handleError(error, {
            operation: () => enhancedFetchTranscript(meetingInfo, errorHandler, userFeedbackUI),
            language: 'en',
            context: { 
                meetingInfo,
                operation: 'transcript_extraction'
            }
        }, feedbackCallback);
        
        throw error;
    }
}

// Example 2: Integration with OpenAI Client
async function enhancedGenerateSummary(formattedTranscript, options, errorHandler, userFeedbackUI) {
    const { apiKey, model = 'gpt-4.1', language = 'en' } = options;
    const progressCallback = userFeedbackUI.createProgressCallback();
    const feedbackCallback = userFeedbackUI.createErrorFeedbackCallback();

    try {
        progressCallback({
            stage: 'generating',
            current: 1,
            total: 2,
            message: 'Preparing summary request...'
        });

        const result = await errorHandler.withRetry(
            async () => {
                const messages = [
                    {
                        role: 'system',
                        content: `You are an expert meeting summarizer. Please provide a comprehensive summary in ${language}.`
                    },
                    {
                        role: 'user',
                        content: `Meeting transcript:\n${formattedTranscript.content}\n\nParticipants: ${formattedTranscript.metadata.participants.join(', ')}`
                    }
                ];

                progressCallback({
                    stage: 'generating',
                    current: 2,
                    total: 2,
                    message: 'Generating AI summary...'
                });

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        temperature: 0.3,
                        max_tokens: 8192
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
                    error.status = response.status;
                    error.response = { status: response.status };
                    throw error;
                }

                return await response.json();
            },
            {
                context: {
                    operation: 'ai_summary_generation',
                    provider: 'openai',
                    model,
                    language,
                    participantCount: formattedTranscript.metadata.participants.length
                },
                maxRetries: 3
            },
            progressCallback
        );

        progressCallback({ stage: 'complete' });
        
        userFeedbackUI.showSuccess(
            'Summary Generated',
            'AI-powered meeting summary has been successfully generated.',
            [{
                type: 'view',
                label: 'View Summary',
                action: () => showSummaryView(result),
                primary: true
            }]
        );

        return result;

    } catch (error) {
        progressCallback({ stage: 'complete' });
        
        await errorHandler.handleError(error, {
            operation: () => enhancedGenerateSummary(formattedTranscript, options, errorHandler, userFeedbackUI),
            language,
            context: {
                provider: 'openai',
                model,
                operation: 'ai_summary_generation'
            }
        }, feedbackCallback);
        
        throw error;
    }
}

// Example 3: Integration with Chrome Storage
async function enhancedSaveSettings(settings, errorHandler, userFeedbackUI) {
    const feedbackCallback = userFeedbackUI.createErrorFeedbackCallback();

    try {
        await errorHandler.withRetry(
            async () => {
                // Validate settings before saving
                if (!settings.apiKey) {
                    throw new Error('API key is required');
                }

                if (!settings.provider) {
                    throw new Error('AI provider is required');
                }

                // Encrypt sensitive data
                const encryptedSettings = {
                    ...settings,
                    apiKey: await encryptApiKey(settings.apiKey)
                };

                return new Promise((resolve, reject) => {
                    chrome.storage.local.set({ 
                        userSettings: encryptedSettings 
                    }, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                });
            },
            {
                context: {
                    operation: 'settings_save',
                    provider: settings.provider,
                    language: 'en'
                },
                maxRetries: 2
            }
        );

        userFeedbackUI.showSuccess(
            'Settings Saved',
            'Your extension settings have been saved successfully.'
        );

    } catch (error) {
        await errorHandler.handleError(error, {
            operation: () => enhancedSaveSettings(settings, errorHandler, userFeedbackUI),
            language: 'en',
            context: {
                operation: 'settings_save'
            }
        }, feedbackCallback);
        
        throw error;
    }
}

// Example 4: Integration with Large Transcript Processing
async function enhancedProcessLargeTranscript(formattedTranscript, aiFunction, options, errorHandler, userFeedbackUI) {
    const progressCallback = userFeedbackUI.createProgressCallback();
    const feedbackCallback = userFeedbackUI.createErrorFeedbackCallback();

    try {
        // First check if chunking is needed
        progressCallback({
            stage: 'chunking',
            current: 1,
            total: 1,
            message: 'Analyzing transcript size...'
        });

        const { chunkingStrategy } = require('../utils/chunkingStrategy.js');
        const analysis = chunkingStrategy.analyzeChunkingNeeds(
            formattedTranscript, 
            options.provider, 
            options.model,
            options
        );

        if (analysis.needsChunking) {
            userFeedbackUI.showInfo(
                'Large Transcript Detected',
                `This transcript is large (${analysis.tokenCount.toLocaleString()} tokens) and will be processed in ${analysis.estimatedChunks} sections for better results.`
            );
        }

        // Enhanced progress tracking
        const enhancedProgressCallback = (update) => {
            progressCallback({
                ...update,
                details: update.chunkInfo ? 
                    `Processing chunk ${update.current}/${update.total} - ${update.chunkInfo.timeRange.start} to ${update.chunkInfo.timeRange.end}` :
                    null
            });
        };

        const result = await errorHandler.withRetry(
            async () => {
                return await chunkingStrategy.processLargeTranscript(
                    formattedTranscript,
                    aiFunction,
                    options,
                    enhancedProgressCallback
                );
            },
            {
                context: {
                    operation: 'large_transcript_processing',
                    provider: options.provider,
                    model: options.model,
                    language: options.language || 'en',
                    complexity: analysis.complexity,
                    enableChunking: (enabled) => {
                        if (enabled) {
                            userFeedbackUI.showInfo(
                                'Chunking Enabled',
                                'Large transcript processing will use intelligent chunking for better results.'
                            );
                        }
                    }
                },
                maxRetries: 2
            },
            enhancedProgressCallback
        );

        progressCallback({ stage: 'complete' });

        const processingDetails = result.metadata.processingMethod === 'large_transcript_chunked' ?
            `Processed ${result.metadata.chunksProcessed} sections with ${result.metadata.chunkingSummary.strategy} strategy.` :
            'Processed as single transcript.';

        userFeedbackUI.showSuccess(
            'Processing Complete',
            `Large transcript has been successfully processed. ${processingDetails}`,
            [{
                type: 'view',
                label: 'View Summary',
                action: () => showSummaryView(result),
                primary: true
            }, {
                type: 'details',
                label: 'View Details',
                action: () => showProcessingDetails(result),
                primary: false
            }]
        );

        return result;

    } catch (error) {
        progressCallback({ stage: 'complete' });
        
        await errorHandler.handleError(error, {
            operation: () => enhancedProcessLargeTranscript(formattedTranscript, aiFunction, options, errorHandler, userFeedbackUI),
            language: options.language || 'en',
            context: {
                operation: 'large_transcript_processing',
                provider: options.provider,
                complexity: analysis?.complexity
            }
        }, feedbackCallback);
        
        throw error;
    }
}

// Example 5: Background Script Integration
class EnhancedBackgroundScript {
    constructor() {
        // Import error handling modules
        this.errorHandler = require('../utils/errorHandler.js').errorHandler;
        this.userFeedbackUI = require('../ui/userFeedbackUI.js').userFeedbackUI;
        
        this.setupMessageHandlers();
        this.setupErrorHandling();
    }

    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
    }

    setupErrorHandling() {
        // Global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            
            this.errorHandler.handleError(event.reason, {
                operation: 'background_script',
                language: 'en'
            }, this.userFeedbackUI.createErrorFeedbackCallback());
            
            event.preventDefault();
        });

        // Global error handler for uncaught exceptions
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
            
            this.errorHandler.handleError(event.error, {
                operation: 'background_script',
                language: 'en'
            }, this.userFeedbackUI.createErrorFeedbackCallback());
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'extractTranscript':
                    const transcript = await enhancedFetchTranscript(
                        message.data,
                        this.errorHandler,
                        this.userFeedbackUI
                    );
                    sendResponse({ success: true, data: transcript });
                    break;

                case 'generateSummary':
                    const summary = await enhancedGenerateSummary(
                        message.transcript,
                        message.options,
                        this.errorHandler,
                        this.userFeedbackUI
                    );
                    sendResponse({ success: true, data: summary });
                    break;

                case 'saveSettings':
                    await enhancedSaveSettings(
                        message.settings,
                        this.errorHandler,
                        this.userFeedbackUI
                    );
                    sendResponse({ success: true });
                    break;

                case 'processLargeTranscript':
                    const result = await enhancedProcessLargeTranscript(
                        message.transcript,
                        this.createAIFunction(message.options),
                        message.options,
                        this.errorHandler,
                        this.userFeedbackUI
                    );
                    sendResponse({ success: true, data: result });
                    break;

                default:
                    sendResponse({ 
                        success: false, 
                        error: 'Unknown action: ' + message.action 
                    });
            }
        } catch (error) {
            const errorResult = await this.errorHandler.handleError(error, {
                operation: `message_handler_${message.action}`,
                language: 'en'
            }, this.userFeedbackUI.createErrorFeedbackCallback());

            sendResponse({ 
                success: false, 
                error: error.message,
                errorId: errorResult.errorId
            });
        }
    }

    createAIFunction(options) {
        return async (transcript, summaryOptions) => {
            return await enhancedGenerateSummary(
                transcript,
                { ...options, ...summaryOptions },
                this.errorHandler,
                this.userFeedbackUI
            );
        };
    }
}

// Example 6: Popup Integration
class EnhancedPopup {
    constructor() {
        this.errorHandler = window.errorHandler;
        this.userFeedbackUI = window.userFeedbackUI;
        this.currentLanguage = 'en';
        
        this.setupEventListeners();
        this.initializeUI();
    }

    setupEventListeners() {
        document.getElementById('extract-transcript')?.addEventListener('click', () => {
            this.handleExtractTranscript();
        });

        document.getElementById('generate-summary')?.addEventListener('click', () => {
            this.handleGenerateSummary();
        });

        document.getElementById('save-settings')?.addEventListener('click', () => {
            this.handleSaveSettings();
        });
    }

    async initializeUI() {
        try {
            // Load saved settings with error handling
            const settings = await this.errorHandler.withRetry(
                () => this.loadSettings(),
                {
                    context: {
                        operation: 'load_settings',
                        language: this.currentLanguage
                    },
                    maxRetries: 2
                }
            );

            this.populateUI(settings);
            
        } catch (error) {
            await this.errorHandler.handleError(error, {
                operation: () => this.initializeUI(),
                language: this.currentLanguage,
                context: { operation: 'popup_initialization' }
            }, this.userFeedbackUI.createErrorFeedbackCallback());
        }
    }

    async handleExtractTranscript() {
        try {
            const meetingInfo = await this.getMeetingInfo();
            
            const transcript = await chrome.runtime.sendMessage({
                action: 'extractTranscript',
                data: meetingInfo
            });

            if (transcript.success) {
                this.displayTranscript(transcript.data);
            } else {
                throw new Error(transcript.error);
            }

        } catch (error) {
            await this.errorHandler.handleError(error, {
                operation: () => this.handleExtractTranscript(),
                language: this.currentLanguage,
                context: { operation: 'extract_transcript_popup' }
            }, this.userFeedbackUI.createErrorFeedbackCallback());
        }
    }

    async handleGenerateSummary() {
        try {
            const transcript = this.getCurrentTranscript();
            const options = this.getSummaryOptions();

            const summary = await chrome.runtime.sendMessage({
                action: 'generateSummary',
                transcript,
                options
            });

            if (summary.success) {
                this.displaySummary(summary.data);
            } else {
                throw new Error(summary.error);
            }

        } catch (error) {
            await this.errorHandler.handleError(error, {
                operation: () => this.handleGenerateSummary(),
                language: this.currentLanguage,
                context: { operation: 'generate_summary_popup' }
            }, this.userFeedbackUI.createErrorFeedbackCallback());
        }
    }

    // Helper methods
    async loadSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['userSettings'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result.userSettings || {});
                }
            });
        });
    }

    async getMeetingInfo() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const result = await chrome.tabs.sendMessage(tab.id, {
            action: 'getMeetingInfo'
        });

        if (!result || !result.success) {
            throw new Error('Unable to extract meeting information from current page');
        }

        return result.data;
    }

    getCurrentTranscript() {
        const transcriptElement = document.getElementById('transcript-content');
        if (!transcriptElement || !transcriptElement.dataset.transcript) {
            throw new Error('No transcript available. Please extract transcript first.');
        }
        return JSON.parse(transcriptElement.dataset.transcript);
    }

    getSummaryOptions() {
        return {
            provider: document.getElementById('provider-select')?.value || 'openai',
            apiKey: document.getElementById('api-key')?.value,
            language: document.getElementById('language-select')?.value || 'en',
            promptType: document.getElementById('prompt-select')?.value || 'default'
        };
    }

    displayTranscript(transcript) {
        const element = document.getElementById('transcript-content');
        if (element) {
            element.textContent = transcript.content.substring(0, 500) + '...';
            element.dataset.transcript = JSON.stringify(transcript);
            document.getElementById('transcript-preview')?.classList.remove('hidden');
        }
    }

    displaySummary(summary) {
        const element = document.getElementById('summary-content');
        if (element) {
            element.innerHTML = summary.summary;
            document.getElementById('summary-view')?.classList.remove('hidden');
        }
    }

    populateUI(settings) {
        if (settings.provider) {
            const providerSelect = document.getElementById('provider-select');
            if (providerSelect) providerSelect.value = settings.provider;
        }

        if (settings.language) {
            const languageSelect = document.getElementById('language-select');
            if (languageSelect) languageSelect.value = settings.language;
            this.currentLanguage = settings.language;
        }
    }
}

// Helper functions
async function encryptApiKey(apiKey) {
    // Simple base64 encoding for demonstration
    // In production, use proper encryption
    return btoa(apiKey);
}

function showSummaryView(summary) {
    console.log('Showing summary view:', summary);
    // Implementation would show summary in UI
}

function showProcessingDetails(result) {
    console.log('Showing processing details:', result.chunkDetails);
    // Implementation would show detailed processing information
}

// Initialize enhanced background script
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest.background) {
        new EnhancedBackgroundScript();
    }
}

// Initialize enhanced popup
if (typeof document !== 'undefined' && document.readyState !== 'loading') {
    new EnhancedPopup();
} else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new EnhancedPopup();
    });
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        enhancedFetchTranscript,
        enhancedGenerateSummary,
        enhancedSaveSettings,
        enhancedProcessLargeTranscript,
        EnhancedBackgroundScript,
        EnhancedPopup
    };
}