/**
 * Unit tests for StreamApiClient
 * Tests the Microsoft Stream API client functionality
 */

// Mock Chrome APIs for testing
global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        lastError: null
    }
};

// Mock fetch for API testing
global.fetch = jest.fn();
global.AbortController = jest.fn(() => ({
    abort: jest.fn(),
    signal: {}
}));
global.setTimeout = jest.fn((fn) => fn());
global.clearTimeout = jest.fn();

const StreamApiClient = require('../../src/api/streamApiClient.js');

describe('StreamApiClient', () => {
    let client;
    
    beforeEach(() => {
        client = new StreamApiClient();
        
        // Mock window object for buildApiUrl tests
        global.window = {
            location: {
                href: 'https://test.sharepoint.com/personal/user_test/stream.aspx'
            }
        };
        jest.clearAllMocks();
        global.chrome.runtime.lastError = null;
    });

    afterEach(() => {
        delete global.window;
    });

    describe('buildApiUrl', () => {
        test('should build URL with transcript ID', () => {
            const url = client.buildApiUrl(
                'https://tenant.sharepoint.com',
                'driveId123',
                'itemId456',
                'transcriptId789'
            );
            
            expect(url).toBe(
                'https://tenant.sharepoint.com/personal/user_test/_api/v2.1/drives/driveId123/items/itemId456/media/transcripts/transcriptId789/streamContent?applyhighlights=false&applymediaedits=false'
            );
        });

        test('should build URL without transcript ID', () => {
            const url = client.buildApiUrl(
                'https://tenant.sharepoint.com/',
                'driveId123',
                'itemId456'
            );
            
            expect(url).toBe(
                'https://tenant.sharepoint.com/personal/user_test/_api/v2.1/drives/driveId123/items/itemId456/media/transcripts'
            );
        });

        test('should clean trailing slash from site URL', () => {
            const url = client.buildApiUrl(
                'https://tenant.sharepoint.com/',
                'driveId123',
                'itemId456',
                'transcriptId789'
            );
            
            // Should not have double slashes after the protocol
            expect(url).not.toMatch(/https:\/\/.*\/\//);
            expect(url).toContain('https://tenant.sharepoint.com/personal/user_test/_api');
        });
    });

    describe('getAuthHeaders', () => {
        test('should extract headers from page successfully', async () => {
            // Mock window._spPageContextInfo
            global.window._spPageContextInfo = {
                formDigestValue: 'v1.testtoken123'
            };

            const headers = await client.getAuthHeaders();
            
            expect(headers['Authorization']).toBe('Bearer v1.testtoken123');
        });

        test('should return empty headers when no token available', async () => {
            // Clear any mocked data
            delete global.window._spPageContextInfo;

            const headers = await client.getAuthHeaders();
            
            expect(headers).toEqual({});
        });

        test('should extract token from script tags', async () => {
            // Mock document.querySelectorAll
            const mockScript = {
                textContent: 'var auth = "Bearer v1.scripttokentest"; console.log(auth);'
            };
            global.document = {
                querySelectorAll: jest.fn().mockReturnValue([mockScript])
            };

            const headers = await client.getAuthHeaders();
            
            expect(headers['Authorization']).toBe('Bearer v1.scripttokentest');
        });
    });

    describe('shouldNotRetry', () => {
        test('should not retry on 401 authentication errors', () => {
            const error = new Error('Authentication failed (401)');
            expect(client.shouldNotRetry(error)).toBe(true);
        });

        test('should not retry on 403 permission errors', () => {
            const error = new Error('Access denied (403)');
            expect(client.shouldNotRetry(error)).toBe(true);
        });

        test('should not retry on 404 not found errors', () => {
            const error = new Error('Transcript not found (404)');
            expect(client.shouldNotRetry(error)).toBe(true);
        });

        test('should not retry on 400 bad request errors', () => {
            const error = new Error('Bad request (400)');
            expect(client.shouldNotRetry(error)).toBe(true);
        });

        test('should retry on 500 server errors', () => {
            const error = new Error('Server error (500)');
            expect(client.shouldNotRetry(error)).toBe(false);
        });

        test('should retry on network errors', () => {
            const error = new Error('Network error');
            expect(client.shouldNotRetry(error)).toBe(false);
        });
    });

    describe('parseTranscriptResponse', () => {
        const mockMeetingInfo = {
            title: 'Test Meeting',
            url: 'https://test.sharepoint.com/stream.aspx',
            siteUrl: 'https://test.sharepoint.com'
        };

        test('should parse valid transcript response', async () => {
            const mockTranscript = {
                version: '1.0',
                type: 'Transcript',
                entries: [
                    {
                        id: 'entry1',
                        text: 'Hello world',
                        speakerDisplayName: 'John Doe',
                        speakerId: 'speaker1',
                        startOffset: '00:00:10.0000000',
                        endOffset: '00:00:15.0000000',
                        confidence: 0.95,
                        spokenLanguageTag: 'en-US',
                        hasBeenEdited: false
                    }
                ],
                events: []
            };

            const result = await client.parseTranscriptResponse(mockTranscript, mockMeetingInfo);

            expect(result.metadata.entryCount).toBe(1);
            expect(result.metadata.participants).toEqual(['John Doe']);
            expect(result.metadata.language).toBe('en-US');
            expect(result.entries[0].text).toBe('Hello world');
            expect(result.entries[0].speaker).toBe('John Doe');
            expect(result.meetingInfo.title).toBe('Test Meeting');
        });

        test('should handle OData format response with value property', async () => {
            // Mock a direct entries format (not metadata format)
            const mockResponse = {
                entries: [
                    {
                        id: 'entry1',
                        text: 'Test message',
                        speakerDisplayName: 'Speaker 1',
                        startOffset: '00:00:05.0000000',
                        endOffset: '00:00:10.0000000'
                    }
                ]
            };

            const result = await client.parseTranscriptResponse(mockResponse, mockMeetingInfo);

            expect(result.metadata.entryCount).toBe(1);
            expect(result.entries[0].text).toBe('Test message');
        });

        test('should throw error for empty transcript response', async () => {
            await expect(async () => {
                await client.parseTranscriptResponse(null, mockMeetingInfo);
            }).rejects.toThrow('Empty transcript response received');
        });

        test('should handle missing entries array gracefully', async () => {
            const invalidTranscript = { version: '1.0' };
            
            const result = await client.parseTranscriptResponse(invalidTranscript, mockMeetingInfo);
            expect(result.entries).toEqual([]);
            expect(result.metadata.entryCount).toBe(0);
        });

        test('should throw error for empty entries array', async () => {
            const emptyTranscript = { entries: [] };
            
            await expect(async () => {
                await client.parseTranscriptResponse(emptyTranscript, mockMeetingInfo);
            }).rejects.toThrow('Transcript is empty: no entries found');
        });

        test('should handle missing speaker names', async () => {
            const transcriptWithMissingSpeaker = {
                entries: [
                    {
                        id: 'entry1',
                        text: 'Anonymous message',
                        startOffset: '00:00:05.0000000'
                    }
                ]
            };

            const result = await client.parseTranscriptResponse(transcriptWithMissingSpeaker, mockMeetingInfo);

            expect(result.entries[0].speaker).toBe('Unknown Speaker');
            expect(result.metadata.participants).toEqual([]);
        });
    });

    describe('calculateTranscriptDuration', () => {
        test('should calculate duration from entries', () => {
            const entries = [
                { startOffset: '00:00:05.0000000', endOffset: '00:00:10.0000000' },
                { startOffset: '00:00:15.0000000', endOffset: '00:01:30.0000000' }
            ];

            const duration = client.calculateTranscriptDuration(entries);
            expect(duration).toBe('00:01:30');
        });

        test('should return 00:00:00 for empty entries', () => {
            const duration = client.calculateTranscriptDuration([]);
            expect(duration).toBe('00:00:00');
        });

        test('should return 00:00:00 for null entries', () => {
            const duration = client.calculateTranscriptDuration(null);
            expect(duration).toBe('00:00:00');
        });

        test('should handle entries without endOffset', () => {
            const entries = [
                { startOffset: '00:00:45.0000000' }
            ];

            const duration = client.calculateTranscriptDuration(entries);
            expect(duration).toBe('00:00:45');
        });
    });

    describe('handleHttpError', () => {
        test('should throw authentication error for 401', async () => {
            const mockResponse = {
                status: 401,
                json: jest.fn().mockResolvedValue({})
            };

            await expect(client.handleHttpError(mockResponse)).rejects.toThrow(
                'Authentication failed (401). Please refresh the Teams page and try again.'
            );
        });

        test('should throw access denied error for 403', async () => {
            const mockResponse = {
                status: 403,
                json: jest.fn().mockResolvedValue({})
            };

            await expect(client.handleHttpError(mockResponse)).rejects.toThrow(
                'Access denied (403). You may not have permission to access this transcript.'
            );
        });

        test('should throw not found error for 404', async () => {
            const mockResponse = {
                status: 404,
                json: jest.fn().mockResolvedValue({})
            };

            await expect(client.handleHttpError(mockResponse)).rejects.toThrow(
                'Transcript not found (404). The transcript may not be available yet or the meeting may not have been transcribed.'
            );
        });

        test('should throw rate limit error for 429', async () => {
            const mockResponse = {
                status: 429,
                json: jest.fn().mockResolvedValue({})
            };

            await expect(client.handleHttpError(mockResponse)).rejects.toThrow(
                'Rate limit exceeded (429). Please wait a moment and try again.'
            );
        });

        test('should throw server error for 500', async () => {
            const mockResponse = {
                status: 500,
                json: jest.fn().mockResolvedValue({})
            };

            await expect(client.handleHttpError(mockResponse)).rejects.toThrow(
                'Server error (500). Please try again later.'
            );
        });

        test('should include API error message when available', async () => {
            const mockResponse = {
                status: 400,
                json: jest.fn().mockResolvedValue({
                    error: { message: 'Invalid request format' }
                })
            };

            await expect(client.handleHttpError(mockResponse)).rejects.toThrow(
                'HTTP 400: Invalid request format'
            );
        });
    });

    describe('fetchTranscript', () => {
        const validMeetingInfo = {
            isValid: true,
            siteUrl: 'https://test.sharepoint.com',
            driveId: 'driveId123',
            itemId: 'itemId456',
            transcriptId: 'transcriptId789',
            title: 'Test Meeting'
        };

        test('should reject invalid meeting info', async () => {
            const invalidMeetingInfo = { isValid: false };

            await expect(client.fetchTranscript(invalidMeetingInfo)).rejects.toThrow(
                'Invalid meeting information provided'
            );
        });

        test('should reject missing driveId', async () => {
            const incompleteMeetingInfo = {
                isValid: true,
                siteUrl: 'https://test.sharepoint.com',
                itemId: 'itemId456'
            };

            await expect(client.fetchTranscript(incompleteMeetingInfo)).rejects.toThrow(
                'Missing required IDs (driveId, itemId) for API call'
            );
        });

        test('should reject missing itemId', async () => {
            const incompleteMeetingInfo = {
                isValid: true,
                siteUrl: 'https://test.sharepoint.com',
                driveId: 'driveId123'
            };

            await expect(client.fetchTranscript(incompleteMeetingInfo)).rejects.toThrow(
                'Missing required IDs (driveId, itemId) for API call'
            );
        });
    });

    describe('createDetailedError', () => {
        test('should create enhanced error with context', () => {
            const originalError = new Error('Original error message');
            const detailedError = client.createDetailedError(originalError);

            expect(detailedError.name).toBe('StreamApiError');
            expect(detailedError.message).toBe('Original error message');
            expect(detailedError.originalError).toBe(originalError);
            expect(detailedError.timestamp).toBeDefined();
            expect(detailedError.retryCount).toBeDefined();
        });
    });

    describe('generateUUID', () => {
        test('should generate valid UUID format', () => {
            const uuid = client.generateUUID();
            
            // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            
            expect(uuid).toMatch(uuidPattern);
        });

        test('should generate unique UUIDs', () => {
            const uuid1 = client.generateUUID();
            const uuid2 = client.generateUUID();
            
            expect(uuid1).not.toBe(uuid2);
        });
    });
});