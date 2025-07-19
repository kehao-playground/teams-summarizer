/**
 * Jest test setup file
 * Configures global mocks and utilities for Chrome Extension testing
 */

// Mock Chrome APIs globally
global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        },
        lastError: null,
        getManifest: jest.fn(() => ({ version: '1.0.0' })),
        onInstalled: {
            addListener: jest.fn()
        },
        onStartup: {
            addListener: jest.fn()
        }
    },
    tabs: {
        sendMessage: jest.fn(),
        onUpdated: {
            addListener: jest.fn()
        }
    },
    webRequest: {
        onBeforeSendHeaders: {
            addListener: jest.fn()
        },
        onHeadersReceived: {
            addListener: jest.fn()
        }
    },
    cookies: {
        getAll: jest.fn()
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
        }
    },
    action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
        setTitle: jest.fn()
    },
    contextMenus: {
        create: jest.fn(),
        removeAll: jest.fn(),
        onClicked: {
            addListener: jest.fn()
        }
    }
};

// Mock DOM APIs
global.fetch = jest.fn();
global.AbortController = jest.fn(() => ({
    abort: jest.fn(),
    signal: {}
}));

// Mock console to reduce noise in tests
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// Setup before each test
beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.runtime.lastError = null;
});

// Utility functions for tests
global.createMockResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data))
});

global.createMockMeetingInfo = (overrides = {}) => ({
    isValid: true,
    url: 'https://test.sharepoint.com/_layouts/15/stream.aspx?id=test',
    siteUrl: 'https://test.sharepoint.com',
    driveId: 'test-drive-id',
    itemId: 'test-item-id',
    transcriptId: 'test-transcript-id',
    title: 'Test Meeting',
    duration: '00:30:00',
    timestamp: new Date().toISOString(),
    ...overrides
});

global.createMockTranscript = (overrides = {}) => ({
    version: '1.0',
    type: 'Transcript',
    entries: [
        {
            id: 'entry1',
            text: 'Hello, this is a test transcript.',
            speakerDisplayName: 'Test Speaker',
            speakerId: 'speaker-1',
            startOffset: '00:00:10.0000000',
            endOffset: '00:00:15.0000000',
            confidence: 0.95,
            spokenLanguageTag: 'en-US',
            hasBeenEdited: false
        }
    ],
    events: [],
    ...overrides
});