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
            return await this.parseTranscriptResponse(transcript, meetingInfo);
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
        // Extract personal site path from the current URL
        const currentUrl = window.location.href;
        const personalMatch = currentUrl.match(/\/personal\/([^\/]+)\//);
        const personalPath = personalMatch ? `/personal/${personalMatch[1]}` : '';
        
        // Clean site URL and add personal path
        const cleanSiteUrl = siteUrl.replace(/\/$/, '');
        const baseUrl = `${cleanSiteUrl}${personalPath}`;
        
        let apiPath;
        if (transcriptId) {
            // Direct transcript access with proper query parameters
            apiPath = `/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcriptId}/streamContent`;
            return `${baseUrl}${apiPath}?applyhighlights=false&applymediaedits=false`;
        } else {
            // List all transcripts for the item
            apiPath = `/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts`;
            return `${baseUrl}${apiPath}`;
        }
    }

    /**
     * Get authentication headers - extracts Bearer token from page
     * @returns {Promise<Object>} Authentication headers
     */
    async getAuthHeaders() {
        console.log('[StreamApiClient] Extracting authentication from page');
        
        const headers = {};
        
        // Try to extract Bearer token from page
        const bearerToken = await this.extractBearerToken();
        if (bearerToken) {
            headers['Authorization'] = `Bearer ${bearerToken}`;
            console.log('[StreamApiClient] Bearer token extracted successfully');
        } else {
            console.warn('[StreamApiClient] No Bearer token found, will rely on cookies');
        }
        
        // Get the request digest from the page if available
        let requestDigest = null;
        try {
            // Try to get the request digest from SharePoint page context
            if (window.__REQUESTDIGEST) {
                requestDigest = window.__REQUESTDIGEST;
            } else if (document.getElementById('__REQUESTDIGEST')) {
                requestDigest = document.getElementById('__REQUESTDIGEST').value;
            }
        } catch (e) {
            console.warn('[StreamApiClient] Could not get request digest:', e);
        }
        
        // Add request digest if available
        if (requestDigest) {
            headers['X-RequestDigest'] = requestDigest;
        }
        
        return headers;
    }

    /**
     * Extract Bearer token from the page
     * @returns {Promise<string|null>} Bearer token or null
     */
    async extractBearerToken() {
        try {
            // Method 1: Check for token in window object
            if (window._spPageContextInfo && window._spPageContextInfo.formDigestValue) {
                const token = window._spPageContextInfo.formDigestValue;
                if (token && token.startsWith('v1.')) {
                    return token;
                }
            }

            // Method 2: Look for token in script tags
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.textContent || '';
                // Look for Bearer token pattern
                const tokenMatch = content.match(/Bearer\s+(v1\.[A-Za-z0-9\-._~+\/]+=*)/);
                if (tokenMatch) {
                    return tokenMatch[1];
                }
                // Look for authorization token pattern
                const authMatch = content.match(/"authorization":\s*"Bearer\s+(v1\.[^"]+)"/);
                if (authMatch) {
                    return authMatch[1];
                }
            }

            // Method 3: Check localStorage/sessionStorage
            const storageKeys = ['ms-stream-auth', 'stream-auth-token', 'bearer-token'];
            for (const key of storageKeys) {
                const token = localStorage.getItem(key) || sessionStorage.getItem(key);
                if (token && token.startsWith('v1.')) {
                    return token;
                }
            }

            // Method 4: Try to intercept from network requests
            // This would require more complex implementation
            
            return null;
        } catch (error) {
            console.error('[StreamApiClient] Error extracting Bearer token:', error);
            return null;
        }
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
                    'Accept': '*/*',
                    'Accept-Language': 'en,zh-TW;q=0.9,zh;q=0.8,en-US;q=0.7',
                    'Application': 'OnePlayer',
                    'Scenario': 'LoadPlayer',
                    'Type': 'AUO',
                    'Priority': 'u=1, i',
                    'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"macOS"',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'X-Ms-Client-Request-Id': this.generateUUID(),
                    'X-Requeststats': `psi:${this.generateUUID()}`
                },
                credentials: 'include', // Include all cookies
                mode: 'cors',
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
     * @returns {Promise<Object>} Parsed transcript object
     */
    async parseTranscriptResponse(transcriptData, meetingInfo) {
        if (!transcriptData) {
            throw new Error('Empty transcript response received');
        }

        console.log('[StreamApiClient] Raw transcript response:', transcriptData);
        console.log('[StreamApiClient] Response type:', typeof transcriptData);
        console.log('[StreamApiClient] Response keys:', Object.keys(transcriptData));

        // Handle different response formats
        let transcript = transcriptData;
        
        // If response contains a value property (OData format) - this is transcript metadata
        if (transcriptData.value && Array.isArray(transcriptData.value)) {
            console.log('[StreamApiClient] Found transcript metadata array');
            if (transcriptData.value.length > 0) {
                const transcriptMeta = transcriptData.value[0];
                console.log('[StreamApiClient] Transcript metadata:', transcriptMeta);
                
                // Check if we have a temporaryDownloadUrl
                if (transcriptMeta.temporaryDownloadUrl) {
                    console.log('[StreamApiClient] Found temporaryDownloadUrl, fetching actual transcript content');
                    
                    // Add format=json parameter to the URL
                    const contentUrl = new URL(transcriptMeta.temporaryDownloadUrl);
                    contentUrl.searchParams.set('format', 'json');
                    contentUrl.searchParams.set('applyhighlights', 'false');
                    contentUrl.searchParams.set('applymediaedits', 'false');
                    
                    console.log('[StreamApiClient] Fetching transcript content from:', contentUrl.toString());
                    
                    try {
                        // Fetch the actual transcript content
                        const contentResponse = await this.makeApiRequest(contentUrl.toString());
                        console.log('[StreamApiClient] Transcript content response:', contentResponse);
                        
                        // The content response should contain the actual transcript
                        transcript = contentResponse;
                    } catch (error) {
                        console.error('[StreamApiClient] Failed to fetch transcript content:', error);
                        throw new Error('Failed to fetch transcript content from download URL');
                    }
                } else {
                    throw new Error('No download URL found in transcript metadata');
                }
            } else if (typeof transcriptData.value === 'string') {
                // The transcript might be returned as a string (WebVTT or plain text)
                console.log('[StreamApiClient] Value is a string, creating simple transcript structure');
                return this.createSimpleTranscript(transcriptData.value, meetingInfo);
            } else {
                throw new Error('No transcript data found in response');
            }
        }

        // Check if the response is a string (WebVTT or plain text)
        if (typeof transcript === 'string') {
            console.log('[StreamApiClient] Transcript is a string, creating simple structure');
            return this.createSimpleTranscript(transcript, meetingInfo);
        }

        // Check for alternative transcript formats
        if (transcript.content || transcript.text || transcript.captions || transcript.webvtt) {
            const textContent = transcript.content || transcript.text || transcript.captions || transcript.webvtt;
            console.log('[StreamApiClient] Found text content in alternative format');
            return this.createSimpleTranscript(textContent, meetingInfo);
        }

        // Validate transcript structure - but be more flexible
        if (!transcript.entries || !Array.isArray(transcript.entries)) {
            console.warn('[StreamApiClient] No entries array found, checking for other properties');
            
            // Log all properties to understand the structure
            console.log('[StreamApiClient] Transcript properties:', Object.keys(transcript));
            
            // If we can't find a standard format, create a simple transcript with raw data
            return {
                raw: transcriptData,
                meetingInfo: {
                    title: meetingInfo.title || 'Untitled Meeting',
                    url: meetingInfo.url,
                    siteUrl: meetingInfo.siteUrl,
                    extractedAt: new Date().toISOString()
                },
                metadata: {
                    version: '1.0',
                    type: 'RawTranscript',
                    participants: [],
                    duration: '00:00:00',
                    language: 'unknown',
                    entryCount: 0,
                    hasEvents: false
                },
                entries: [],
                events: [],
                rawData: transcript
            };
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
     * Create a simple transcript structure from text content
     * @param {string} textContent - Raw text content (WebVTT or plain text)
     * @param {Object} meetingInfo - Meeting metadata
     * @returns {Object} Formatted transcript object
     */
    createSimpleTranscript(textContent, meetingInfo) {
        console.log('[StreamApiClient] Creating simple transcript from text content');
        
        // Try to parse WebVTT format if present
        const entries = [];
        if (textContent.includes('WEBVTT') || textContent.includes('-->')) {
            console.log('[StreamApiClient] Detected WebVTT format');
            const lines = textContent.split('\n');
            let currentEntry = null;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Skip empty lines and WEBVTT header
                if (!line || line === 'WEBVTT') continue;
                
                // Check for timestamp line (e.g., "00:00:00.000 --> 00:00:05.000")
                if (line.includes('-->')) {
                    const [start, end] = line.split('-->').map(t => t.trim());
                    currentEntry = {
                        startTime: start,
                        endTime: end,
                        text: '',
                        speaker: 'Unknown Speaker'
                    };
                } else if (currentEntry && line) {
                    // This is caption text
                    // Check if line contains speaker info (e.g., "John Doe: Hello")
                    const speakerMatch = line.match(/^([^:]+):\s*(.+)$/);
                    if (speakerMatch) {
                        currentEntry.speaker = speakerMatch[1].trim();
                        currentEntry.text = speakerMatch[2].trim();
                    } else {
                        currentEntry.text += (currentEntry.text ? ' ' : '') + line;
                    }
                    
                    // If next line is empty or timestamp, save current entry
                    if (i + 1 >= lines.length || !lines[i + 1].trim() || lines[i + 1].includes('-->')) {
                        entries.push({
                            id: entries.length + 1,
                            text: currentEntry.text,
                            speaker: currentEntry.speaker,
                            speakerId: currentEntry.speaker.toLowerCase().replace(/\s+/g, '_'),
                            startTime: currentEntry.startTime,
                            endTime: currentEntry.endTime,
                            confidence: 1,
                            language: 'unknown',
                            isEdited: false
                        });
                        currentEntry = null;
                    }
                }
            }
        }
        
        return {
            raw: textContent,
            meetingInfo: {
                title: meetingInfo.title || 'Untitled Meeting',
                url: meetingInfo.url,
                siteUrl: meetingInfo.siteUrl,
                extractedAt: new Date().toISOString()
            },
            metadata: {
                version: '1.0',
                type: 'WebVTT',
                participants: [...new Set(entries.map(e => e.speaker))],
                duration: entries.length > 0 ? entries[entries.length - 1].endTime : '00:00:00',
                language: 'unknown',
                entryCount: entries.length,
                hasEvents: false
            },
            entries: entries,
            events: [],
            rawText: textContent
        };
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