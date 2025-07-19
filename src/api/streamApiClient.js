/**
 * Microsoft Stream API Client for Teams Transcript Chrome Extension
 * Handles authentication and transcript fetching from SharePoint Stream API
 */

// Constants
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 8000; // 8 seconds

/**
 * Microsoft Stream API Client class
 */
class StreamApiClient {
    constructor() {
        this.retryCount = 0;
        this.authHeaders = null;
    }

    /**
     * Fetch transcript data from Microsoft Stream API
     * @param {Object} meetingInfo - Meeting metadata from content script
     * @returns {Promise<Object>} Transcript data or error
     */
    async fetchTranscript(meetingInfo) {
        if (!meetingInfo || !meetingInfo.isValid) {
            throw new Error('Invalid meeting information provided');
        }

        const { siteUrl, driveId, itemId, transcriptId } = meetingInfo;

        if (!driveId || !itemId) {
            throw new Error('Missing required IDs (driveId, itemId) for API call');
        }

        // Get fresh authentication headers
        this.authHeaders = await this.getAuthHeaders();

        // Construct API endpoint
        const apiUrl = this.buildApiUrl(siteUrl, driveId, itemId, transcriptId);
        
        console.log('[StreamApiClient] Attempting to fetch transcript from:', apiUrl);

        try {
            const transcript = await this.fetchWithRetry(apiUrl);
            return this.parseTranscriptResponse(transcript, meetingInfo);
        } catch (error) {
            console.error('[StreamApiClient] Failed to fetch transcript:', error);
            throw this.createDetailedError(error);
        }
    }

    /**
     * Build Microsoft Stream API URL
     * @param {string} siteUrl - SharePoint site URL
     * @param {string} driveId - Drive ID
     * @param {string} itemId - Item ID
     * @param {string} transcriptId - Transcript ID (optional)
     * @returns {string} Complete API URL
     */
    buildApiUrl(siteUrl, driveId, itemId, transcriptId) {
        // Clean site URL
        const cleanSiteUrl = siteUrl.replace(/\/$/, '');
        
        let apiPath;
        if (transcriptId) {
            // Direct transcript access
            apiPath = `/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcriptId}/streamContent`;
        } else {
            // List all transcripts for the item
            apiPath = `/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`;
        }

        return `${cleanSiteUrl}${apiPath}?format=json`;
    }

    /**
     * Get authentication headers from background script
     * @returns {Promise<Object>} Authentication headers
     */
    async getAuthHeaders() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'getSessionStatus' },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(`Failed to get auth headers: ${chrome.runtime.lastError.message}`));
                        return;
                    }

                    if (!response.success || !response.data.isValid) {
                        reject(new Error('No valid authentication session available'));
                        return;
                    }

                    // Get headers from background script
                    chrome.runtime.sendMessage(
                        { action: 'getAuthHeaders' },
                        (headerResponse) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(`Failed to get headers: ${chrome.runtime.lastError.message}`));
                                return;
                            }

                            if (!headerResponse.success) {
                                reject(new Error(headerResponse.error || 'Failed to get authentication headers'));
                                return;
                            }

                            resolve(headerResponse.data);
                        }
                    );
                }
            );
        });
    }

    /**
     * Fetch with retry logic and exponential backoff
     * @param {string} url - API URL to fetch
     * @returns {Promise<Object>} API response
     */
    async fetchWithRetry(url) {
        let lastError = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[StreamApiClient] Attempt ${attempt + 1}/${MAX_RETRIES + 1} to fetch transcript`);
                
                const response = await this.makeApiRequest(url);
                
                // Success - reset retry count and return
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
                    
                    console.log(`[StreamApiClient] Request failed, retrying in ${delay}ms...`, error.message);
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted
        throw lastError;
    }

    /**
     * Make actual API request to Microsoft Stream
     * @param {string} url - API URL
     * @returns {Promise<Object>} API response
     */
    async makeApiRequest(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...this.authHeaders,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Application': 'OnePlayer',
                    'Scenario': 'LoadPlayer',
                    'Type': 'AUO'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                await this.handleHttpError(response);
            }

            const data = await response.json();
            console.log('[StreamApiClient] Successfully fetched transcript data');
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
     * Handle HTTP error responses
     * @param {Response} response - Fetch response object
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
                throw new Error(`Authentication failed (${status}). Please refresh the Teams page and try again.`);
            case 403:
                throw new Error(`Access denied (${status}). You may not have permission to access this transcript.`);
            case 404:
                throw new Error(`Transcript not found (${status}). The transcript may not be available yet or the meeting may not have been transcribed.`);
            case 429:
                throw new Error(`Rate limit exceeded (${status}). Please wait a moment and try again.`);
            case 500:
            case 502:
            case 503:
            case 504:
                throw new Error(`Server error (${status}). Please try again later.`);
            default:
                throw new Error(errorMessage);
        }
    }

    /**
     * Check if error should not be retried
     * @param {Error} error - Error object
     * @returns {boolean} True if should not retry
     */
    shouldNotRetry(error) {
        const message = error.message.toLowerCase();
        
        // Don't retry on authentication or permission errors
        if (message.includes('401') || message.includes('403')) {
            return true;
        }
        
        // Don't retry on not found errors
        if (message.includes('404')) {
            return true;
        }
        
        // Don't retry on bad request errors
        if (message.includes('400')) {
            return true;
        }

        return false;
    }

    /**
     * Parse and validate transcript response
     * @param {Object} transcriptData - Raw API response
     * @param {Object} meetingInfo - Original meeting metadata
     * @returns {Object} Parsed transcript object
     */
    parseTranscriptResponse(transcriptData, meetingInfo) {
        if (!transcriptData) {
            throw new Error('Empty transcript response received');
        }

        // Handle different response formats
        let transcript = transcriptData;
        
        // If response contains a value property (OData format)
        if (transcriptData.value) {
            if (Array.isArray(transcriptData.value) && transcriptData.value.length > 0) {
                transcript = transcriptData.value[0];
            } else {
                throw new Error('No transcript data found in response');
            }
        }

        // Validate transcript structure
        if (!transcript.entries || !Array.isArray(transcript.entries)) {
            throw new Error('Invalid transcript format: missing entries array');
        }

        if (transcript.entries.length === 0) {
            throw new Error('Transcript is empty: no entries found');
        }

        // Extract metadata from transcript
        const participants = [...new Set(
            transcript.entries
                .map(entry => entry.speakerDisplayName)
                .filter(name => name && name.trim())
        )];

        const duration = this.calculateTranscriptDuration(transcript.entries);
        const language = transcript.entries[0]?.spokenLanguageTag || 'unknown';

        // Format the transcript for consumption
        const formattedTranscript = {
            // Original data
            raw: transcript,
            
            // Meeting metadata
            meetingInfo: {
                title: meetingInfo.title || 'Untitled Meeting',
                url: meetingInfo.url,
                siteUrl: meetingInfo.siteUrl,
                extractedAt: new Date().toISOString()
            },
            
            // Transcript metadata
            metadata: {
                version: transcript.version || '1.0',
                type: transcript.type || 'Transcript',
                participants: participants,
                duration: duration,
                language: language,
                entryCount: transcript.entries.length,
                hasEvents: transcript.events && transcript.events.length > 0
            },
            
            // Processed entries
            entries: transcript.entries.map(entry => ({
                id: entry.id,
                text: entry.text || '',
                speaker: entry.speakerDisplayName || 'Unknown Speaker',
                speakerId: entry.speakerId,
                startTime: entry.startOffset,
                endTime: entry.endOffset,
                confidence: entry.confidence || 0,
                language: entry.spokenLanguageTag || language,
                isEdited: entry.hasBeenEdited || false
            })),
            
            // Events (if available)
            events: transcript.events || []
        };

        console.log('[StreamApiClient] Transcript parsed successfully:', {
            entryCount: formattedTranscript.entries.length,
            participants: participants.length,
            duration: duration,
            language: language
        });

        return formattedTranscript;
    }

    /**
     * Calculate total duration from transcript entries
     * @param {Array} entries - Transcript entries
     * @returns {string} Duration in HH:MM:SS format
     */
    calculateTranscriptDuration(entries) {
        if (!entries || entries.length === 0) {
            return '00:00:00';
        }

        try {
            // Get the last entry's end time
            const lastEntry = entries[entries.length - 1];
            const endTime = lastEntry.endOffset || lastEntry.startOffset;
            
            if (!endTime) {
                return '00:00:00';
            }

            // Parse time format "HH:MM:SS.fffffff" or "HH:MM:SS"
            const timeParts = endTime.split('.')[0]; // Remove fractional seconds
            return timeParts;
            
        } catch (error) {
            console.warn('[StreamApiClient] Could not calculate duration:', error);
            return '00:00:00';
        }
    }

    /**
     * Create detailed error with context
     * @param {Error} originalError - Original error
     * @returns {Error} Enhanced error with context
     */
    createDetailedError(originalError) {
        const error = new Error(originalError.message);
        error.name = 'StreamApiError';
        error.originalError = originalError;
        error.timestamp = new Date().toISOString();
        error.retryCount = this.retryCount;
        
        return error;
    }

    /**
     * Sleep for specified duration
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate UUID for request tracking
     * @returns {string} UUID string
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Create singleton instance
const streamApiClient = new StreamApiClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamApiClient;
} else {
    // Browser environment - attach to window
    window.StreamApiClient = StreamApiClient;
    window.streamApiClient = streamApiClient;
}