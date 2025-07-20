/**
 * OpenAI API Client for Teams Transcript Chrome Extension
 * Handles GPT 4.1 integration for meeting summary generation
 */

// Constants
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL_GPT_4_1 = 'gpt-4.1';
const MAX_TOKENS_OUTPUT = 32768;
const API_TIMEOUT = 60000; // 60 seconds for AI processing
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 16000; // 16 seconds

// Token limits and context windows
const CONTEXT_LIMITS = {
  'gpt-4.1': 1047576, // 1M+ tokens context window
  'gpt-4': 128000,    // Fallback model
  'gpt-3.5-turbo': 16385 // Emergency fallback
};

// Default prompts for different summary types
const DEFAULT_PROMPTS = {
  default: `You are an expert meeting summarizer. Please analyze the provided meeting transcript and generate a comprehensive summary.

Structure your response as follows:

## Meeting Summary
[Brief overview of the meeting purpose and outcome]

## Key Discussion Points
- [Main topics discussed with context]

## Decisions Made
- [Important decisions reached during the meeting]

## Action Items
- [Specific tasks assigned with responsible parties if mentioned]

## Follow-up Required
- [Items that need future attention]

Please maintain the original context and speaker attributions where relevant. Be concise but comprehensive.`,

  actionItems: `You are a meeting action item specialist. Focus specifically on extracting and organizing actionable tasks from this meeting transcript.

Structure your response as follows:

## Action Items Summary
[Total number of action items identified]

## Immediate Actions (Next 1-7 days)
- [Task] - [Responsible person if mentioned] - [Deadline if mentioned]

## Medium-term Actions (1-4 weeks)
- [Task] - [Responsible person if mentioned] - [Deadline if mentioned]

## Long-term Actions (1+ months)
- [Task] - [Responsible person if mentioned] - [Deadline if mentioned]

## Decisions That Enable Actions
- [Key decisions that impact the action items]

Focus on concrete, actionable tasks. If no clear owner is mentioned, note "Owner TBD".`,

  technical: `You are a technical meeting specialist. Focus on technical discussions, architecture decisions, and implementation details.

Structure your response as follows:

## Technical Summary
[Overview of technical scope and objectives]

## Architecture & Design Decisions
- [Technical decisions made with rationale]

## Technical Issues Discussed
- [Problems identified and solutions proposed]

## Implementation Details
- [Specific technical requirements or specifications]

## Technical Dependencies
- [Dependencies, integrations, or blockers identified]

## Next Technical Steps
- [Immediate technical actions required]

Use technical terminology appropriately and preserve technical context from the discussion.`,

  section: `You are a meeting section summarizer. Please analyze this portion of a meeting transcript and provide a focused summary for this section.

Structure your response as follows:

## Section Summary
[Brief overview of what was discussed in this section]

## Key Points
- [Main topics covered in this section]

## Decisions or Outcomes
- [Any decisions made or conclusions reached in this section]

## Action Items
- [Tasks or follow-ups identified in this section]

## Context for Next Section
- [Important context that carries forward]

This is part of a larger meeting, so focus on this section while maintaining continuity.`,

  combine: `You are a meeting summary combiner. Please analyze the provided section summaries and create a cohesive final meeting summary.

Structure your response as follows:

## Executive Summary
[High-level overview of the entire meeting]

## Key Discussion Points
- [Main topics discussed across all sections]

## Major Decisions
- [Important decisions reached during the meeting]

## Action Items
- [All actionable tasks identified with responsible parties]

## Follow-up Required
- [Items that need future attention]

## Meeting Outcomes
- [Overall results and next steps]

Ensure the final summary flows naturally and avoids repetition while capturing all important information from the section summaries.`
};

/**
 * OpenAI API Client class
 */
class OpenAIClient {
    constructor() {
        this.apiKey = null;
        this.retryCount = 0;
        this.lastRequestTime = 0;
        this.rateLimitReset = 0;
    }

    /**
     * Initialize the client with API key
     * @param {string} apiKey - OpenAI API key
     */
    async initialize(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }

        if (!this.validateApiKey(apiKey)) {
            throw new Error('Invalid OpenAI API key format');
        }

        this.apiKey = apiKey;
        console.log('[OpenAIClient] Initialized with API key');
        
        // Test the API key
        await this.testConnection();
    }

    /**
     * Test API connection and key validity
     */
    async testConnection() {
        try {
            console.log('[OpenAIClient] Testing API connection...');
            
            const response = await fetch(`${OPENAI_API_BASE}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API test failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const availableModels = data.data.map(model => model.id);
            
            console.log('[OpenAIClient] API connection successful. Available models:', availableModels.slice(0, 5));
            return true;
        } catch (error) {
            console.error('[OpenAIClient] API connection test failed:', error);
            throw new Error(`OpenAI API connection failed: ${error.message}`);
        }
    }

    /**
     * Generate meeting summary from formatted transcript
     * @param {Object} formattedTranscript - Transcript from transcriptFormatter
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated summary
     */
    async generateSummary(formattedTranscript, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenAI client not initialized. Please provide API key.');
        }

        const {
            promptType = 'default',
            customPrompt = null,
            language = 'en',
            model = MODEL_GPT_4_1,
            temperature = 0.3,
            maxTokens = MAX_TOKENS_OUTPUT
        } = options;

        console.log('[OpenAIClient] Generating summary with options:', {
            promptType,
            language,
            model,
            participantCount: formattedTranscript.metadata.participants.length,
            duration: formattedTranscript.metadata.duration
        });

        try {
            // Check if we need to chunk the transcript
            const shouldChunk = await this.checkTokenLimits(formattedTranscript, model);
            
            if (shouldChunk) {
                return await this.generateChunkedSummary(formattedTranscript, options);
            } else {
                return await this.generateSingleSummary(formattedTranscript, options);
            }
        } catch (error) {
            console.error('[OpenAIClient] Summary generation failed:', error);
            throw this.createDetailedError(error);
        }
    }

    /**
     * Generate summary for single (non-chunked) transcript
     */
    async generateSingleSummary(formattedTranscript, options) {
        const {
            promptType = 'default',
            customPrompt = null,
            language = 'en',
            model = MODEL_GPT_4_1,
            temperature = 0.3,
            maxTokens = MAX_TOKENS_OUTPUT
        } = options;

        // Prepare the prompt
        const systemPrompt = this.buildSystemPrompt(promptType, customPrompt, language);
        const userMessage = this.buildUserMessage(formattedTranscript);

        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userMessage
            }
        ];

        // Make API call with retry logic
        const response = await this.callWithRetry(model, messages, {
            temperature,
            max_tokens: maxTokens
        });

        // Parse and format the response
        return this.formatSummaryResponse(response, formattedTranscript.metadata);
    }

    /**
     * Generate summary for large transcript using advanced chunking strategy
     */
    async generateChunkedSummary(formattedTranscript, options) {
        console.log('[OpenAIClient] Large transcript detected, using advanced chunking strategy');
        
        // Import chunking strategy (dynamic import for browser compatibility)
        let chunkingStrategy;
        try {
            if (typeof window !== 'undefined' && window.chunkingStrategy) {
                chunkingStrategy = window.chunkingStrategy;
            } else {
                const { chunkingStrategy: cs } = require('../utils/chunkingStrategy.js');
                chunkingStrategy = cs;
            }
        } catch (error) {
            console.warn('[OpenAIClient] Advanced chunking not available, falling back to basic chunking');
            return await this.generateBasicChunkedSummary(formattedTranscript, options);
        }

        // Use advanced chunking strategy with progress tracking
        const progressCallback = options.progressCallback || ((update) => {
            console.log(`[OpenAIClient] ${update.stage}: ${update.message} (${update.current}/${update.total})`);
        });

        const chunkingOptions = {
            provider: 'openai',
            model: options.model || MODEL_GPT_4_1,
            strategy: options.chunkingStrategy || 'hybrid',
            language: options.language || 'en'
        };

        // Bind generateSingleSummary to use with chunking strategy
        const boundGenerateSummary = async (transcript, summaryOptions) => {
            return await this.generateSingleSummary(transcript, {
                ...options,
                ...summaryOptions,
                promptType: summaryOptions.isChunk ? 'section' : 
                           summaryOptions.isCombinung ? 'combine' : 
                           options.promptType || 'default'
            });
        };

        return await chunkingStrategy.processLargeTranscript(
            formattedTranscript,
            boundGenerateSummary,
            chunkingOptions,
            progressCallback
        );
    }

    /**
     * Fallback basic chunking for compatibility
     */
    async generateBasicChunkedSummary(formattedTranscript, options) {
        console.log('[OpenAIClient] Using basic chunking fallback');
        
        const chunks = this.createBasicChunks(formattedTranscript);
        const summaries = [];

        for (let i = 0; i < chunks.length; i++) {
            console.log(`[OpenAIClient] Processing chunk ${i + 1}/${chunks.length}`);
            
            const chunkSummary = await this.generateSingleSummary(chunks[i], {
                ...options,
                promptType: 'section' // Use section-specific prompt for chunks
            });
            
            summaries.push({
                chunkIndex: i,
                summary: chunkSummary
            });
        }

        // Combine chunk summaries into final summary
        return await this.combineSummaries(summaries, formattedTranscript.metadata, options);
    }

    /**
     * Make API call with retry logic and rate limiting
     */
    async callWithRetry(model, messages, parameters) {
        let lastError = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[OpenAIClient] API call attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
                
                // Check rate limits
                await this.checkRateLimit();
                
                const response = await this.makeApiCall(model, messages, parameters);
                
                // Success - reset retry count
                this.retryCount = 0;
                return response;

            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (this.shouldNotRetry(error)) {
                    throw error;
                }

                // Calculate retry delay with exponential backoff
                if (attempt < MAX_RETRIES) {
                    const delay = Math.min(
                        INITIAL_RETRY_DELAY * Math.pow(2, attempt),
                        MAX_RETRY_DELAY
                    );
                    
                    console.log(`[OpenAIClient] Request failed, retrying in ${delay}ms...`, error.message);
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted
        throw lastError;
    }

    /**
     * Make the actual API call to OpenAI
     */
    async makeApiCall(model, messages, parameters) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        try {
            this.lastRequestTime = Date.now();

            const requestBody = {
                model: model,
                messages: messages,
                temperature: parameters.temperature || 0.3,
                max_tokens: parameters.max_tokens || MAX_TOKENS_OUTPUT,
                stream: false,
                user: 'teams-transcript-extension'
            };

            console.log('[OpenAIClient] Making API request to OpenAI');

            const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Teams-Transcript-Extension/1.0'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                this.rateLimitReset = Date.now() + (parseInt(retryAfter) * 1000);
                throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
            }

            if (!response.ok) {
                await this.handleHttpError(response);
            }

            const data = await response.json();
            
            console.log('[OpenAIClient] API call successful', {
                usage: data.usage,
                model: data.model
            });

            return data;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${API_TIMEOUT}ms`);
            }
            
            throw error;
        }
    }

    /**
     * Build system prompt based on type and language
     */
    buildSystemPrompt(promptType, customPrompt, language) {
        let basePrompt = customPrompt || DEFAULT_PROMPTS[promptType] || DEFAULT_PROMPTS.default;
        
        // Add language instruction
        const languageInstruction = this.getLanguageInstruction(language);
        if (languageInstruction) {
            basePrompt += '\n\n' + languageInstruction;
        }

        return basePrompt;
    }

    /**
     * Build user message with transcript content
     */
    buildUserMessage(formattedTranscript) {
        const { metadata, content } = formattedTranscript;
        
        let message = `Meeting Information:
- Duration: ${metadata.duration}
- Participants: ${metadata.participants.join(', ')}
- Language: ${metadata.language}
- Total Entries: ${metadata.totalEntries}

Transcript Content:
${content}`;

        return message;
    }

    /**
     * Get language-specific instruction
     */
    getLanguageInstruction(language) {
        const instructions = {
            'en': 'Please provide the summary in English.',
            'zh-TW': '請用繁體中文提供摘要。',
            'zh-CN': '请用简体中文提供摘要。',
            'ja': '日本語で要約を提供してください。',
            'ko': '한국어로 요약을 제공해 주세요.',
            'es': 'Por favor, proporciona el resumen en español.',
            'fr': 'Veuillez fournir le résumé en français.',
            'de': 'Bitte stellen Sie die Zusammenfassung auf Deutsch zur Verfügung.'
        };

        return instructions[language] || instructions['en'];
    }

    /**
     * Format the API response into structured summary
     */
    formatSummaryResponse(apiResponse, metadata) {
        const content = apiResponse.choices[0]?.message?.content || '';
        
        return {
            summary: content,
            metadata: {
                ...metadata,
                generatedAt: new Date().toISOString(),
                model: apiResponse.model,
                usage: apiResponse.usage,
                processingTime: Date.now() - this.lastRequestTime
            },
            raw: apiResponse
        };
    }

    /**
     * Check if transcript needs chunking based on token limits
     */
    async checkTokenLimits(formattedTranscript, model) {
        const contextLimit = CONTEXT_LIMITS[model] || CONTEXT_LIMITS['gpt-4'];
        const estimatedTokens = this.estimateTokenCount(formattedTranscript.content);
        
        console.log('[OpenAIClient] Token estimation:', {
            estimated: estimatedTokens,
            contextLimit: contextLimit,
            needsChunking: estimatedTokens > (contextLimit * 0.8) // Use 80% of limit for safety
        });

        // Use 80% of context limit for safety (leaving room for prompt and response)
        return estimatedTokens > (contextLimit * 0.8);
    }

    /**
     * Estimate token count (rough approximation)
     */
    estimateTokenCount(text) {
        // Rough estimation: 1 token ≈ 4 characters for English, 2-3 for Chinese
        const avgCharsPerToken = 3.5;
        return Math.ceil(text.length / avgCharsPerToken);
    }

    /**
     * Create basic chunks for large transcripts
     */
    createBasicChunks(formattedTranscript) {
        // Basic chunking implementation for Task 8
        // More sophisticated chunking will be in Task 13
        const sections = formattedTranscript.sections;
        const chunkSize = Math.ceil(sections.length / 3); // Split into 3 chunks max
        
        const chunks = [];
        for (let i = 0; i < sections.length; i += chunkSize) {
            const chunkSections = sections.slice(i, i + chunkSize);
            const chunkContent = chunkSections.map(section => section.content).join('\n\n');
            
            chunks.push({
                metadata: {
                    ...formattedTranscript.metadata,
                    chunkIndex: chunks.length,
                    totalChunks: Math.ceil(sections.length / chunkSize)
                },
                content: chunkContent,
                sections: chunkSections
            });
        }
        
        return chunks;
    }

    /**
     * Combine multiple chunk summaries into final summary
     */
    async combineSummaries(summaries, originalMetadata, options) {
        const combinedContent = summaries.map((s, i) => 
            `## Section ${i + 1}\n${s.summary.summary}`
        ).join('\n\n');

        const combinePrompt = `Please combine these section summaries into a cohesive final summary:

${combinedContent}

Create a unified summary that captures the key points from all sections while avoiding repetition.`;

        const messages = [
            {
                role: 'system', 
                content: this.buildSystemPrompt(options.promptType, null, options.language)
            },
            {
                role: 'user',
                content: combinePrompt
            }
        ];

        const response = await this.callWithRetry(options.model || MODEL_GPT_4_1, messages, {
            temperature: options.temperature || 0.3,
            max_tokens: MAX_TOKENS_OUTPUT
        });

        return this.formatSummaryResponse(response, originalMetadata);
    }

    /**
     * Check rate limiting before making requests
     */
    async checkRateLimit() {
        if (this.rateLimitReset > Date.now()) {
            const waitTime = this.rateLimitReset - Date.now();
            console.log(`[OpenAIClient] Rate limit active, waiting ${waitTime}ms`);
            await this.sleep(waitTime);
        }
    }

    /**
     * Handle HTTP error responses
     */
    async handleHttpError(response) {
        const status = response.status;
        let errorMessage = `HTTP ${status}`;

        try {
            const errorData = await response.json();
            if (errorData.error && errorData.error.message) {
                errorMessage += `: ${errorData.error.message}`;
            }
        } catch (e) {
            // Ignore JSON parse errors for error responses
        }

        switch (status) {
            case 401:
                throw new Error(`Invalid API key (${status}). Please check your OpenAI API key.`);
            case 403:
                throw new Error(`Access forbidden (${status}). Your API key may not have the required permissions.`);
            case 429:
                throw new Error(`Rate limit exceeded (${status}). Please try again later.`);
            case 500:
            case 502:
            case 503:
            case 504:
                throw new Error(`OpenAI server error (${status}). Please try again later.`);
            default:
                throw new Error(errorMessage);
        }
    }

    /**
     * Check if error should not be retried
     */
    shouldNotRetry(error) {
        const message = error.message.toLowerCase();
        
        // Don't retry on authentication errors
        if (message.includes('401') || message.includes('403')) {
            return true;
        }
        
        // Don't retry on invalid request errors
        if (message.includes('400')) {
            return true;
        }

        // Don't retry on quota exceeded
        if (message.includes('quota')) {
            return true;
        }

        return false;
    }

    /**
     * Validate OpenAI API key format
     */
    validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        // OpenAI keys start with 'sk-' but not 'sk-ant-'
        return apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-') && apiKey.length >= 20;
    }

    /**
     * Create detailed error with context
     */
    createDetailedError(originalError) {
        const error = new Error(originalError.message);
        error.name = 'OpenAIClientError';
        error.originalError = originalError;
        error.timestamp = new Date().toISOString();
        error.retryCount = this.retryCount;
        
        return error;
    }

    /**
     * Sleep for specified duration
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get available models (for debugging/validation)
     */
    async getAvailableModels() {
        if (!this.apiKey) {
            throw new Error('API key required');
        }

        const response = await fetch(`${OPENAI_API_BASE}/models`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();
        return data.data.map(model => ({
            id: model.id,
            created: new Date(model.created * 1000).toISOString()
        }));
    }
}

// Create singleton instance
const openaiClient = new OpenAIClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OpenAIClient, openaiClient, DEFAULT_PROMPTS };
} else {
    // Browser environment - attach to window
    window.OpenAIClient = OpenAIClient;
    window.openaiClient = openaiClient;
    window.OPENAI_DEFAULT_PROMPTS = DEFAULT_PROMPTS;
}