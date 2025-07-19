/**
 * Background Service Worker for Teams Transcript Chrome Extension
 * Handles session interception, API calls, and extension coordination
 */

// Constants
const SHAREPOINT_DOMAIN_PATTERN = '*.sharepoint.com';
const STREAM_API_PATTERN = '*://*.sharepoint.com/*/_api/v2.1/drives/*/items/*/media/*';
const AUTH_HEADER_NAME = 'authorization';
const BEARER_TOKEN_PREFIX = 'Bearer ';

// In-memory session storage (non-persistent)
let sessionData = {
    bearerToken: null,
    cookies: null,
    lastUpdated: null,
    isValid: false
};

// Meeting info cache
let currentMeetingInfo = null;

/**
 * Initialize background service worker
 */
function init() {
    console.log('[Teams Summarizer] Background service worker initialized');
    
    // Setup web request interceptor
    setupWebRequestInterceptor();
    
    // Setup message handling
    setupMessageHandling();
    
    // Setup context menu (optional)
    setupContextMenu();
    
    // Cleanup on extension startup
    clearSessionData();
}

/**
 * Setup web request interceptor to capture authentication
 */
function setupWebRequestInterceptor() {
    // Intercept requests to SharePoint Stream API
    chrome.webRequest.onBeforeSendHeaders.addListener(
        (details) => {
            try {
                console.log('[Teams Summarizer] Intercepting request:', details.url);
                
                // Extract Bearer token from headers
                if (details.requestHeaders) {
                    extractAuthFromHeaders(details.requestHeaders);
                }
                
                // Extract cookies for the domain
                extractCookiesForDomain(details.url);
                
            } catch (error) {
                console.error('[Teams Summarizer] Error intercepting request:', error);
            }
        },
        {
            urls: [STREAM_API_PATTERN, '*://*.sharepoint.com/*'],
            types: ['xmlhttprequest', 'main_frame', 'sub_frame']
        },
        ['requestHeaders', 'extraHeaders']
    );
    
    // Also intercept responses to validate session
    chrome.webRequest.onHeadersReceived.addListener(
        (details) => {
            try {
                // Check for authentication errors
                if (details.statusCode === 401 || details.statusCode === 403) {
                    console.log('[Teams Summarizer] Authentication error detected, clearing session');
                    clearSessionData();
                }
            } catch (error) {
                console.error('[Teams Summarizer] Error processing response:', error);
            }
        },
        {
            urls: [STREAM_API_PATTERN]
        },
        ['responseHeaders']
    );
}

/**
 * Extract Bearer token from request headers
 * @param {Array} requestHeaders - Chrome request headers array
 */
function extractAuthFromHeaders(requestHeaders) {
    for (const header of requestHeaders) {
        if (header.name.toLowerCase() === AUTH_HEADER_NAME) {
            const authValue = header.value;
            
            if (authValue && authValue.startsWith(BEARER_TOKEN_PREFIX)) {
                const bearerToken = authValue.substring(BEARER_TOKEN_PREFIX.length);
                
                if (bearerToken && bearerToken !== sessionData.bearerToken) {
                    console.log('[Teams Summarizer] New Bearer token captured');
                    updateSessionData({ bearerToken });
                }
            }
            break;
        }
    }
}

/**
 * Extract cookies for SharePoint domain
 * @param {string} url - Request URL to extract domain from
 */
async function extractCookiesForDomain(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Only process SharePoint domains
        if (!domain.includes('sharepoint.com')) {
            return;
        }
        
        // Get all cookies for the SharePoint domain
        const cookies = await chrome.cookies.getAll({
            domain: domain
        });
        
        if (cookies && cookies.length > 0) {
            // Filter relevant cookies (authentication-related)
            const relevantCookies = cookies.filter(cookie => {
                const name = cookie.name.toLowerCase();
                return name.includes('auth') || 
                       name.includes('session') || 
                       name.includes('token') ||
                       name.includes('fedauth') ||
                       name.includes('rtfa') ||
                       name.includes('sharepointsession');
            });
            
            if (relevantCookies.length > 0) {
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                updateSessionData({ cookies: cookieString, domain });
            }
        }
    } catch (error) {
        console.error('[Teams Summarizer] Error extracting cookies:', error);
    }
}

/**
 * Update session data in memory
 * @param {Object} newData - New session data to merge
 */
function updateSessionData(newData) {
    sessionData = {
        ...sessionData,
        ...newData,
        lastUpdated: new Date().toISOString(),
        isValid: true
    };
    
    console.log('[Teams Summarizer] Session data updated:', {
        hasBearerToken: !!sessionData.bearerToken,
        hasCookies: !!sessionData.cookies,
        lastUpdated: sessionData.lastUpdated
    });
}

/**
 * Clear session data from memory
 */
function clearSessionData() {
    sessionData = {
        bearerToken: null,
        cookies: null,
        lastUpdated: null,
        isValid: false
    };
    console.log('[Teams Summarizer] Session data cleared');
}

/**
 * Get current authentication headers for API calls
 * @returns {Object} Headers object for authenticated requests
 */
function getAuthHeaders() {
    if (!sessionData.isValid || !sessionData.bearerToken) {
        throw new Error('No valid authentication session available');
    }
    
    const headers = {
        'Authorization': `Bearer ${sessionData.bearerToken}`,
        'Accept': '*/*',
        'X-MS-Client-Request-Id': generateUUID(),
        'Application': 'OnePlayer',
        'Scenario': 'LoadPlayer',
        'Type': 'AUO'
    };
    
    if (sessionData.cookies) {
        headers['Cookie'] = sessionData.cookies;
    }
    
    return headers;
}

/**
 * Setup message handling for communication with content script and popup
 */
function setupMessageHandling() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[Teams Summarizer] Background received message:', request);
        
        switch (request.action) {
            case 'meetingDetected':
                handleMeetingDetected(request.data, sender, sendResponse);
                break;
                
            case 'getSessionStatus':
                handleGetSessionStatus(sendResponse);
                break;
                
            case 'getMeetingInfo':
                handleGetMeetingInfo(sendResponse);
                break;
                
            case 'clearSession':
                handleClearSession(sendResponse);
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
        
        // Return true to indicate async response
        return true;
    });
}

/**
 * Handle meeting detected message from content script
 * @param {Object} meetingData - Meeting information from content script
 * @param {Object} sender - Message sender info
 * @param {Function} sendResponse - Response callback
 */
function handleMeetingDetected(meetingData, sender, sendResponse) {
    try {
        console.log('[Teams Summarizer] Meeting detected:', meetingData);
        
        // Store meeting info
        currentMeetingInfo = {
            ...meetingData,
            tabId: sender.tab?.id,
            detected: new Date().toISOString()
        };
        
        // Update extension badge
        updateExtensionBadge(sender.tab?.id);
        
        sendResponse({ 
            success: true, 
            message: 'Meeting info stored',
            sessionValid: sessionData.isValid
        });
    } catch (error) {
        console.error('[Teams Summarizer] Error handling meeting detection:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Handle session status request
 * @param {Function} sendResponse - Response callback
 */
function handleGetSessionStatus(sendResponse) {
    try {
        sendResponse({
            success: true,
            data: {
                isValid: sessionData.isValid,
                lastUpdated: sessionData.lastUpdated,
                hasBearerToken: !!sessionData.bearerToken,
                hasCookies: !!sessionData.cookies
            }
        });
    } catch (error) {
        console.error('[Teams Summarizer] Error getting session status:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Handle meeting info request
 * @param {Function} sendResponse - Response callback
 */
function handleGetMeetingInfo(sendResponse) {
    try {
        sendResponse({
            success: true,
            data: currentMeetingInfo
        });
    } catch (error) {
        console.error('[Teams Summarizer] Error getting meeting info:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Handle clear session request
 * @param {Function} sendResponse - Response callback
 */
function handleClearSession(sendResponse) {
    try {
        clearSessionData();
        currentMeetingInfo = null;
        sendResponse({ success: true, message: 'Session cleared' });
    } catch (error) {
        console.error('[Teams Summarizer] Error clearing session:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Setup context menu for right-click actions
 */
function setupContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'teams-summarizer-extract',
            title: 'Extract Teams Transcript',
            contexts: ['page'],
            documentUrlPatterns: ['*://*.sharepoint.com/*/_layouts/15/stream.aspx*']
        });
    });
    
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'teams-summarizer-extract') {
            // Send message to content script to extract meeting info
            chrome.tabs.sendMessage(tab.id, { action: 'getMeetingInfo' });
        }
    });
}

/**
 * Update extension badge based on current state
 * @param {number} tabId - Tab ID to update badge for
 */
function updateExtensionBadge(tabId) {
    if (!tabId) return;
    
    try {
        if (currentMeetingInfo && sessionData.isValid) {
            chrome.action.setBadgeText({ text: '●', tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId }); // Green
            chrome.action.setTitle({ 
                title: 'Teams Summarizer - Ready to extract transcript', 
                tabId 
            });
        } else if (currentMeetingInfo) {
            chrome.action.setBadgeText({ text: '!', tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#FF9800', tabId }); // Orange
            chrome.action.setTitle({ 
                title: 'Teams Summarizer - Meeting detected, waiting for session', 
                tabId 
            });
        } else {
            chrome.action.setBadgeText({ text: '', tabId });
            chrome.action.setTitle({ 
                title: 'Teams Summarizer', 
                tabId 
            });
        }
    } catch (error) {
        console.error('[Teams Summarizer] Error updating badge:', error);
    }
}

/**
 * Generate UUID for request IDs
 * @returns {string} UUID string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Handle tab updates to clear state when navigating away
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if we navigated away from a Stream page
        if (currentMeetingInfo && currentMeetingInfo.tabId === tabId) {
            if (!tab.url.includes('/_layouts/15/stream.aspx')) {
                console.log('[Teams Summarizer] Navigated away from Stream page, clearing meeting info');
                currentMeetingInfo = null;
                updateExtensionBadge(tabId);
            }
        }
    }
});

/**
 * Handle extension install/update
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Teams Summarizer] Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        console.log('[Teams Summarizer] First time installation');
        // Could show welcome page or setup instructions
    } else if (details.reason === 'update') {
        console.log('[Teams Summarizer] Extension updated to version:', chrome.runtime.getManifest().version);
    }
    
    // Clear any existing session data on install/update
    clearSessionData();
});

/**
 * Handle service worker startup
 */
chrome.runtime.onStartup.addListener(() => {
    console.log('[Teams Summarizer] Service worker started');
    clearSessionData();
});

// Initialize the background service worker
init();

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getAuthHeaders,
        clearSessionData,
        updateSessionData,
        generateUUID
    };
}