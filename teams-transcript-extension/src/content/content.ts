// Content script for detecting SharePoint Stream pages and extracting meeting metadata

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
    return url.includes('_layouts/15/stream.aspx');
  }

  extractMeetingInfo(): MeetingInfo | null {
    try {
      const url = new URL(window.location.href);
      const meetingPath = url.searchParams.get('id');
      
      if (!meetingPath) {
        console.warn('No meeting path found in URL');
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

      console.log('Extracted meeting info:', this.meetingInfo);
      return this.meetingInfo;

    } catch (error) {
      console.error('Error extracting meeting info:', error);
      return null;
    }
  }

  extractTitle(): string | null {
    // Try multiple selectors for video title
    const selectors = [
      '[data-automation-id="video-title"]',
      '.video-title',
      'h1[data-testid="video-title"]',
      '.title-text'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element.textContent.trim();
      }
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
      // Try to extract from video player configuration
      const videoPlayer = document.querySelector('video-player') as any;
      if (videoPlayer?.config) {
        result.driveId = videoPlayer.config.driveId;
        result.itemId = videoPlayer.config.itemId;
        result.transcriptId = videoPlayer.config.transcriptId;
      }

      // Try to extract from page data attributes
      const videoContainer = document.querySelector('[data-video-id]') as HTMLElement;
      if (videoContainer) {
        result.itemId = videoContainer.dataset.videoId;
        result.driveId = videoContainer.dataset.driveId;
      }

      // Extract from URL patterns if available
      const videoUrl = window.location.href;
      const urlMatch = videoUrl.match(/id=([^&]+)/);
      if (urlMatch) {
        const path = decodeURIComponent(urlMatch[1]);
        const pathParts = path.split('/');
        if (pathParts.length >= 2) {
          result.driveId = this.extractDriveId(path);
          result.itemId = this.extractItemId(path);
        }
      }

    } catch (error) {
      console.error('Error extracting video data:', error);
    }

    return result;
  }

  extractDriveId(path: string): string {
    // Extract drive ID from SharePoint path
    // Path format: "/personal/{user}/Documents/錄製/{filename}"
    const parts = path.split('/');
    if (parts[1] === 'personal' && parts[2]) {
      const user = parts[2];
      const siteUrl = new URL(window.location.href);
      const tenant = siteUrl.hostname.split('.')[0];
      return `${tenant}!${user}`;
    }
    return '';
  }

  extractItemId(path: string): string {
    // Extract unique item ID from path
    const filename = decodeURIComponent(path.split('/').pop() || '');
    return filename.replace(/\.[^/.]+$/, ''); // Remove extension
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      try {
        if (request.action === 'getMeetingInfo') {
          sendResponse({ meetingInfo: this.meetingInfo });
        }
      } catch (error) {
        console.warn('Content script message handler error:', error);
      }
      return true; // Keep message channel open
    });
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
    console.warn('Extension context not available');
    return;
  }
  
  try {
    detector = new StreamPageDetector();
    detector.monitorPageChanges();
  } catch (error) {
    console.warn('Failed to initialize content script:', error);
  }
}

// Handle extension reload/updates
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'contentScript') {
    port.onDisconnect.addListener(() => {
      console.log('Extension disconnected, cleaning up...');
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