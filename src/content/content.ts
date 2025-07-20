// Content script for detecting SharePoint Stream pages and extracting meeting metadata

// Production-safe logging helper
const contentLog = {
  info: (message: string, ...args: any[]) => {
    // Logging disabled in production
    void message; void args;
  },
  error: (message: string, ...args: any[]) => {
    console.error('[TEAMS-SUMMARIZER]', message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    // Warning logging disabled in production
    void message; void args;
  }
};

interface MeetingInfo {
  url: string;
  title: string;
  duration: string;
  siteUrl: string;
  driveId: string;
  itemId: string;
  transcriptId: string;
  meetingPath: string;
}

class StreamPageDetector {
  private isStreamPage: boolean = false;
  private meetingInfo: MeetingInfo | null = null;

  constructor() {
    this.initialize();
  }

  initialize() {
    if (this.isSharePointStreamPage()) {
      this.isStreamPage = true;
      this.extractMeetingInfo();
      this.setupMessageListener();
    }
  }

  isSharePointStreamPage(): boolean {
    const url = window.location.href;
    return url.includes('_layouts/15/stream.aspx') || url.includes('/stream.aspx');
  }

  extractMeetingInfo(): MeetingInfo | null {
    try {
      const url = new URL(window.location.href);
      const meetingPath = url.searchParams.get('id');
      
      if (!meetingPath) {
        contentLog.warn('No meeting path found in URL');
        return null;
      }

      // Extract from SharePoint page context
      const spContext = (window as any)._spPageContextInfo || {};
      const siteUrl = spContext.siteAbsoluteUrl || window.location.origin;

      // Get meeting title and duration from DOM
      const title = this.extractTitle();
      const duration = this.extractDuration();

      // Extract IDs from video player or network calls
      const videoData = this.extractVideoData();

      this.meetingInfo = {
        url: window.location.href,
        title: title || 'Untitled Meeting',
        duration: duration || '--',
        siteUrl,
        driveId: videoData.driveId || '',
        itemId: videoData.itemId || '',
        transcriptId: videoData.transcriptId || '',
        meetingPath: decodeURIComponent(meetingPath)
      };

      contentLog.info('Extracted meeting info:', this.meetingInfo);
      return this.meetingInfo;

    } catch (error) {
      contentLog.error('Error extracting meeting info:', error);
      return null;
    }
  }

  extractTitle(): string | null {
    // Try multiple selectors for video title
    const selectors = [
      '[data-automation-id="video-title"]',
      '.video-title',
      'h1[data-testid="video-title"]',
      '.title-text',
      // SharePoint Stream specific selectors
      '[data-automation-id="pageTitle"]',
      '.ms-Stream-title',
      '.od-StreamWebApp-title',
      'h1.ms-font-xxl',
      'h1.ms-font-xl',
      '[role="heading"][aria-level="1"]',
      '.ms-Stream-header-title',
      // Generic title selectors
      'h1',
      'title'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        const title = element.textContent.trim();
        // Skip if it's just "Stream" or similar generic titles
        if (title && title.length > 3 && !title.toLowerCase().includes('stream')) {
          return title;
        }
      }
    }

    // Fallback: try to extract from document title
    const docTitle = document.title;
    if (docTitle && !docTitle.toLowerCase().includes('stream')) {
      // Remove common suffixes
      return docTitle.replace(/ - (Microsoft Stream|SharePoint|Stream).*$/i, '').trim();
    }

    return null;
  }

  extractDuration(): string | null {
    const selectors = [
      '[data-automation-id="video-duration"]',
      '.video-duration',
      '[data-testid="video-duration"]',
      '.duration'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  extractVideoData(): { driveId?: string; itemId?: string; transcriptId?: string } {
    const result: { driveId?: string; itemId?: string; transcriptId?: string } = {};

    try {
      // Method 1: Try to extract from SharePoint page context
      const spContext = (window as any)._spPageContextInfo;
      if (spContext) {
        contentLog.info('SharePoint context available:', spContext);
      }

      // Method 2: Try to extract from video player configuration
      const videoPlayer = document.querySelector('video-player') as any;
      if (videoPlayer?.config) {
        result.driveId = videoPlayer.config.driveId;
        result.itemId = videoPlayer.config.itemId;
        result.transcriptId = videoPlayer.config.transcriptId;
      }

      // Method 3: Try to extract from Stream player data
      const streamPlayer = document.querySelector('[data-stream-player]') as any;
      if (streamPlayer) {
        const playerData = streamPlayer.dataset;
        if (playerData.driveId) result.driveId = playerData.driveId;
        if (playerData.itemId) result.itemId = playerData.itemId;
        if (playerData.transcriptId) result.transcriptId = playerData.transcriptId;
      }

      // Method 4: Try to extract from script tags containing video configuration
      const scripts = document.querySelectorAll('script');
      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        const content = script.textContent || '';
        
        // Look for drive ID pattern (b!...)
        const driveMatch = content.match(/["']driveId["']\s*:\s*["'](b![^"']+)["']/);
        if (driveMatch) {
          result.driveId = driveMatch[1];
        }
        
        // Look for item ID pattern
        const itemMatch = content.match(/["']itemId["']\s*:\s*["']([A-Z0-9]+)["']/);
        if (itemMatch) {
          result.itemId = itemMatch[1];
        }
        
        // Look for transcript ID pattern (UUID format)
        const transcriptMatch = content.match(/["']transcriptId["']\s*:\s*["']([a-f0-9\-]{36})["']/);
        if (transcriptMatch) {
          result.transcriptId = transcriptMatch[1];
        }

        // Also look for these in URL patterns within scripts
        const urlMatch = content.match(/drives\/(b![^\/]+)\/items\/([A-Z0-9]+)(?:\/media\/transcripts\/([a-f0-9\-]{36}))?/);
        if (urlMatch) {
          if (!result.driveId && urlMatch[1]) result.driveId = urlMatch[1];
          if (!result.itemId && urlMatch[2]) result.itemId = urlMatch[2];
          if (!result.transcriptId && urlMatch[3]) result.transcriptId = urlMatch[3];
        }
      }

      // Method 5: Try to intercept from network requests or global objects
      if (window.performance) {
        const entries = performance.getEntriesByType('resource');
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.name.includes('/_api/v2.1/drives/')) {
            const urlMatch = entry.name.match(/drives\/(b![^\/]+)\/items\/([A-Z0-9]+)/);
            if (urlMatch) {
              if (!result.driveId) result.driveId = urlMatch[1];
              if (!result.itemId) result.itemId = urlMatch[2];
            }
          }
        }
      }

      // Method 6: Check for global variables that might contain the data
      const globalKeys = Object.keys(window);
      for (let i = 0; i < globalKeys.length; i++) {
        const key = globalKeys[i];
        if (key.toLowerCase().includes('stream') || key.toLowerCase().includes('video')) {
          const value = (window as any)[key];
          if (value && typeof value === 'object') {
            if (value.driveId && value.driveId.startsWith('b!')) result.driveId = value.driveId;
            if (value.itemId) result.itemId = value.itemId;
            if (value.transcriptId) result.transcriptId = value.transcriptId;
          }
        }
      }

      // If we still don't have the IDs, try to extract from the current page URL
      // This is a fallback and may not work for all cases
      if (!result.driveId || !result.itemId) {
        contentLog.warn('Could not extract video IDs from page, using fallback method');
        const videoUrl = window.location.href;
        const urlMatch = videoUrl.match(/id=([^&]+)/);
        if (urlMatch) {
          const path = decodeURIComponent(urlMatch[1]);
          // These methods need to be updated to handle the actual ID formats
          result.driveId = result.driveId || this.extractDriveId(path);
          result.itemId = result.itemId || this.extractItemId(path);
        }
      }

    } catch (error) {
      contentLog.error('Error extracting video data:', error);
    }

    contentLog.info('Extracted video data:', result);
    return result;
  }

  extractDriveId(path: string): string {
    // This is a fallback method - actual drive IDs should be extracted from the page
    contentLog.warn('Using fallback drive ID extraction from path:', path);
    
    // SharePoint drive IDs typically start with "b!" followed by base64 encoded data
    // Since we can't generate the actual ID from the path, we'll return empty
    // The actual ID should be extracted from the page data
    return '';
  }

  extractItemId(path: string): string {
    // This is a fallback method - actual item IDs should be extracted from the page
    contentLog.warn('Using fallback item ID extraction from path:', path);
    
    // SharePoint item IDs are typically uppercase alphanumeric strings
    // Since we can't generate the actual ID from the path, we'll return empty
    // The actual ID should be extracted from the page data
    return '';
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      try {
        contentLog.info('Content script received message:', request);
        
        if (request.action === 'getMeetingInfo') {
          contentLog.info('Returning meeting info:', this.meetingInfo);
          sendResponse({ meetingInfo: this.meetingInfo });
        } else if (request.action === 'extractTranscript') {
          contentLog.info('Extract transcript requested');
          this.handleExtractTranscript(sendResponse);
          return true; // Keep message channel open for async response
        }
      } catch (error) {
        contentLog.error('Content script message handler error:', error);
        sendResponse({ error: error instanceof Error ? error.message : String(error) });
      }
      return true; // Keep message channel open
    });
  }

  async handleExtractTranscript(sendResponse: (response: any) => void) {
    try {
      contentLog.info('Starting transcript extraction...');
      
      if (!this.meetingInfo) {
        contentLog.warn('No meeting info available for transcript extraction');
        sendResponse({ error: 'No meeting information available' });
        return;
      }

      // Check if StreamApiClient is available
      const streamApiClient = (window as any).StreamApiClient;
      contentLog.info('StreamApiClient type:', typeof streamApiClient);
      contentLog.info('StreamApiClient value:', streamApiClient);
      contentLog.info('Window keys containing "Stream":', Object.keys(window).filter(key => key.toLowerCase().includes('stream')));
      
      if (typeof streamApiClient === 'undefined') {
        contentLog.error('StreamApiClient not loaded - attempting to wait and retry');
        
        // Try to wait a bit and check again
        setTimeout(() => {
          const retryClient = (window as any).StreamApiClient;
          contentLog.info('Retry - StreamApiClient type:', typeof retryClient);
          if (typeof retryClient === 'undefined') {
            contentLog.error('StreamApiClient still not available after retry');
            sendResponse({ error: 'StreamApiClient not available after retry' });
          } else {
            contentLog.info('StreamApiClient available after retry, attempting extraction');
            // Proceed with extraction using the retry client
            try {
              const streamApi = new retryClient();
              contentLog.info('StreamApiClient initialized after retry');
              
              // Extract transcript using the meeting info - use fetchTranscript method
              streamApi.fetchTranscript({
                url: this.meetingInfo!.url,
                siteUrl: this.meetingInfo!.siteUrl,
                driveId: this.meetingInfo!.driveId,
                itemId: this.meetingInfo!.itemId,
                transcriptId: this.meetingInfo!.transcriptId,
                isValid: true // Required by the API
              }).then((transcriptResult: any) => {
                contentLog.info('Transcript extraction result:', transcriptResult);
                sendResponse({ success: true, transcript: transcriptResult });
              }).catch((error: any) => {
                contentLog.error('Error extracting transcript after retry:', error);
                sendResponse({ error: error instanceof Error ? error.message : String(error) });
              });
            } catch (error) {
              contentLog.error('Error initializing StreamApiClient after retry:', error);
              sendResponse({ error: error instanceof Error ? error.message : String(error) });
            }
          }
        }, 1000);
        return;
      }

      const streamApi = new (window as any).StreamApiClient();
      contentLog.info('StreamApiClient initialized');

      // Extract transcript using the meeting info - use fetchTranscript method
      const transcriptResult = await streamApi.fetchTranscript({
        url: this.meetingInfo.url,
        siteUrl: this.meetingInfo.siteUrl,
        driveId: this.meetingInfo.driveId,
        itemId: this.meetingInfo.itemId,
        transcriptId: this.meetingInfo.transcriptId,
        isValid: true // Required by the API
      });

      contentLog.info('Transcript extraction result:', transcriptResult);
      sendResponse({ success: true, transcript: transcriptResult });

    } catch (error) {
      contentLog.error('Error extracting transcript:', error);
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Monitor for dynamic content changes
  monitorPageChanges() {
    if (!this.isStreamPage) return;

    const observer = new MutationObserver(() => {
      // Re-extract info if page content changes
      const newInfo = this.extractMeetingInfo();
      if (newInfo) {
        this.meetingInfo = newInfo;
        
        // Notify background script of updated info
        chrome.runtime.sendMessage({
          action: 'meetingInfoUpdated',
          meetingInfo: this.meetingInfo
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Helper method to get all available data
  getAllPageData() {
    return {
      url: window.location.href,
      title: document.title,
      meetingInfo: this.meetingInfo,
      pageContext: {
        siteUrl: (window as any)._spPageContextInfo?.siteAbsoluteUrl,
        webUrl: (window as any)._spPageContextInfo?.webAbsoluteUrl,
        userLogin: (window as any)._spPageContextInfo?.userLoginName
      }
    };
  }
}

// Initialize content script with error handling
let detector: StreamPageDetector | null = null;

function initializeContentScript() {
  if (!chrome.runtime?.id) {
    contentLog.warn('Extension context not available');
    return;
  }
  
  try {
    detector = new StreamPageDetector();
    detector.monitorPageChanges();
  } catch (error) {
    contentLog.warn('Failed to initialize content script:', error);
  }
}

// Handle extension reload/updates
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'contentScript') {
    port.onDisconnect.addListener(() => {
      contentLog.info('Extension disconnected, cleaning up...');
      if (detector) {
        detector = null;
      }
    });
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Handle extension context invalidation
window.addEventListener('beforeunload', () => {
  if (detector) {
    detector = null;
  }
});

// Export for testing
(window as any).__StreamPageDetector = StreamPageDetector;