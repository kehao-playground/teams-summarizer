/**
 * Content Script for Teams Transcript Chrome Extension
 * Detects SharePoint Stream pages and extracts meeting metadata
 * Matches URL pattern: /_layouts/15/stream.aspx?id=
 */

// Constants
const STREAM_PAGE_PATTERN = /\/_layouts\/15\/stream\.aspx\?id=/;
const MEETING_INFO_CHECK_INTERVAL = 2000; // Check every 2 seconds
const MAX_RETRIES = 10; // Maximum attempts to extract meeting info

// Global state
let meetingInfoExtracted = false;
let retryCount = 0;

// Initialize content script
function init() {
    console.log('[Teams Summarizer] Content script loaded');
    
    // Check if we're on a Stream page
    if (!STREAM_PAGE_PATTERN.test(window.location.href)) {
        console.log('[Teams Summarizer] Not a Stream page, exiting');
        return;
    }
    
    console.log('[Teams Summarizer] Stream page detected:', window.location.href);
    
    // Start monitoring for meeting info
    startMeetingInfoExtraction();
}

/**
 * Start the meeting info extraction process
 * Uses polling to wait for page elements to load
 */
function startMeetingInfoExtraction() {
    const extractionInterval = setInterval(() => {
        if (meetingInfoExtracted || retryCount >= MAX_RETRIES) {
            clearInterval(extractionInterval);
            return;
        }
        
        retryCount++;
        console.log(`[Teams Summarizer] Attempting to extract meeting info (attempt ${retryCount}/${MAX_RETRIES})`);
        
        const meetingInfo = extractMeetingInfo();
        
        if (meetingInfo && meetingInfo.isValid) {
            meetingInfoExtracted = true;
            clearInterval(extractionInterval);
            console.log('[Teams Summarizer] Meeting info extracted successfully:', meetingInfo);
            
            // Send to background script
            sendMeetingInfoToBackground(meetingInfo);
        } else {
            console.log('[Teams Summarizer] Meeting info not ready yet, retrying...');
        }
    }, MEETING_INFO_CHECK_INTERVAL);
}

/**
 * Extract meeting metadata from SharePoint Stream page
 * @returns {Object|null} Meeting information object
 */
function extractMeetingInfo() {
    try {
        // Extract URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const meetingPath = urlParams.get('id');
        
        if (!meetingPath) {
            console.log('[Teams Summarizer] No meeting ID in URL');
            return null;
        }
        
        // Get SharePoint context
        const spContext = window._spPageContextInfo || {};
        const siteUrl = spContext.siteAbsoluteUrl || window.location.origin;
        
        // Extract meeting title and duration from DOM
        const meetingTitle = extractMeetingTitle();
        const meetingDuration = extractMeetingDuration();
        
        // Extract IDs from various sources
        const ids = extractMeetingIds();
        
        const meetingInfo = {
            url: window.location.href,
            meetingPath: decodeURIComponent(meetingPath),
            title: meetingTitle,
            duration: meetingDuration,
            siteUrl: siteUrl,
            driveId: ids.driveId,
            itemId: ids.itemId,
            transcriptId: ids.transcriptId,
            timestamp: new Date().toISOString(),
            isValid: Boolean(meetingPath && (ids.driveId || ids.itemId))
        };
        
        return meetingInfo;
    } catch (error) {
        console.error('[Teams Summarizer] Error extracting meeting info:', error);
        return null;
    }
}

/**
 * Extract meeting title from various DOM sources
 * @returns {string|null} Meeting title
 */
function extractMeetingTitle() {
    // Try multiple selectors for meeting title
    const titleSelectors = [
        '[data-automation-id="video-title"]',
        '.od-ItemContent-title',
        '.ms-DetailsList-cell[role="gridcell"] span',
        'h1[class*="title"]',
        '.od-TopBar-title',
        'title'
    ];
    
    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim()) {
            const title = element.textContent.trim();
            // Filter out generic titles
            if (!title.includes('Stream') && !title.includes('SharePoint') && title.length > 3) {
                console.log(`[Teams Summarizer] Found title using selector "${selector}": ${title}`);
                return title;
            }
        }
    }
    
    // Fallback: extract from page title
    const pageTitle = document.title;
    if (pageTitle && !pageTitle.includes('Stream') && !pageTitle.includes('SharePoint')) {
        return pageTitle.split(' - ')[0]; // Remove site name suffix
    }
    
    console.log('[Teams Summarizer] Could not extract meeting title');
    return null;
}

/**
 * Extract meeting duration from DOM
 * @returns {string|null} Meeting duration
 */
function extractMeetingDuration() {
    const durationSelectors = [
        '[data-automation-id="video-duration"]',
        '.od-ItemContent-metadata [class*="duration"]',
        '.ms-DetailsList-cell[data-automation-id="FieldText-Duration"]',
        '[aria-label*="duration"]'
    ];
    
    for (const selector of durationSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
            const duration = element.textContent.trim();
            // Validate duration format (should contain numbers and colons)
            if (/\d+:\d+/.test(duration)) {
                console.log(`[Teams Summarizer] Found duration using selector "${selector}": ${duration}`);
                return duration;
            }
        }
    }
    
    console.log('[Teams Summarizer] Could not extract meeting duration');
    return null;
}

/**
 * Extract meeting IDs from various sources
 * @returns {Object} Object containing driveId, itemId, transcriptId
 */
function extractMeetingIds() {
    const ids = {
        driveId: null,
        itemId: null,
        transcriptId: null
    };
    
    // Method 1: From video player configuration
    const videoPlayer = document.querySelector('video-player');
    if (videoPlayer && videoPlayer.config) {
        ids.driveId = videoPlayer.config.driveId;
        ids.itemId = videoPlayer.config.itemId;
        ids.transcriptId = videoPlayer.config.transcriptId;
    }
    
    // Method 2: From window global variables
    if (window.g_streamConfig) {
        ids.driveId = ids.driveId || window.g_streamConfig.driveId;
        ids.itemId = ids.itemId || window.g_streamConfig.itemId;
        ids.transcriptId = ids.transcriptId || window.g_streamConfig.transcriptId;
    }
    
    // Method 3: From SharePoint page context
    if (window._spPageContextInfo && window._spPageContextInfo.streamConfig) {
        const streamConfig = window._spPageContextInfo.streamConfig;
        ids.driveId = ids.driveId || streamConfig.driveId;
        ids.itemId = ids.itemId || streamConfig.itemId;
        ids.transcriptId = ids.transcriptId || streamConfig.transcriptId;
    }
    
    // Method 4: From network requests (monitor fetch/XHR)
    const networkIds = extractIdsFromNetworkCalls();
    ids.driveId = ids.driveId || networkIds.driveId;
    ids.itemId = ids.itemId || networkIds.itemId;
    ids.transcriptId = ids.transcriptId || networkIds.transcriptId;
    
    console.log('[Teams Summarizer] Extracted IDs:', ids);
    return ids;
}

/**
 * Monitor network requests to extract IDs from API URLs
 * @returns {Object} Object containing extracted IDs
 */
function extractIdsFromNetworkCalls() {
    const ids = {
        driveId: null,
        itemId: null,
        transcriptId: null
    };
    
    // This is a placeholder for network monitoring
    // In a real implementation, we would intercept fetch/XHR calls
    // and parse URLs like: /_api/v2.1/drives/{driveId}/items/{itemId}/media/transcripts/{transcriptId}
    
    // For now, we'll try to extract from any existing API URLs in the page
    const apiUrlPattern = /_api\/v2\.1\/drives\/([^\/]+)\/items\/([^\/]+)\/media\/transcripts\/([^\/\?]+)/;
    
    // Check script tags for API URLs
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
        if (script.textContent) {
            const match = script.textContent.match(apiUrlPattern);
            if (match) {
                ids.driveId = match[1];
                ids.itemId = match[2];
                ids.transcriptId = match[3];
                console.log('[Teams Summarizer] Found IDs in script tag:', ids);
                break;
            }
        }
    }
    
    return ids;
}

/**
 * Send extracted meeting info to background script
 * @param {Object} meetingInfo - The extracted meeting information
 */
function sendMeetingInfoToBackground(meetingInfo) {
    try {
        chrome.runtime.sendMessage({
            action: 'meetingDetected',
            data: meetingInfo
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Teams Summarizer] Error sending message to background:', chrome.runtime.lastError);
            } else {
                console.log('[Teams Summarizer] Meeting info sent to background script:', response);
            }
        });
    } catch (error) {
        console.error('[Teams Summarizer] Error sending message to background:', error);
    }
}

/**
 * Listen for messages from popup or background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Teams Summarizer] Content script received message:', request);
    
    switch (request.action) {
        case 'getMeetingInfo':
            // Re-extract meeting info if requested
            const currentMeetingInfo = extractMeetingInfo();
            sendResponse({
                success: true,
                data: currentMeetingInfo
            });
            break;
            
        case 'checkPageStatus':
            sendResponse({
                success: true,
                data: {
                    isStreamPage: STREAM_PAGE_PATTERN.test(window.location.href),
                    meetingInfoExtracted: meetingInfoExtracted,
                    url: window.location.href
                }
            });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Also initialize on page changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        meetingInfoExtracted = false;
        retryCount = 0;
        console.log('[Teams Summarizer] Page navigation detected, reinitializing');
        init();
    }
}).observe(document, { subtree: true, childList: true });