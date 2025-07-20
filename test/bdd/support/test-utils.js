/**
 * BDD Test Utilities
 * 
 * Utility functions for BDD tests including mock API responses,
 * data validation, and test helpers.
 */

const testFixtures = require('../fixtures/test-fixtures');

/**
 * API Mock Response Generator
 */
class MockAPIResponseGenerator {
  static generateStreamAPIResponse(transcriptType = 'productMeeting') {
    const transcript = testFixtures.transcripts[transcriptType];
    
    return {
      status: 200,
      headers: {
        'content-type': 'application/json;charset=utf-8',
        'x-ms-request-id': 'mock-request-id-12345'
      },
      body: JSON.stringify(transcript)
    };
  }

  static generateAuthErrorResponse(errorType = 'expired') {
    const errorConfig = testFixtures.errorScenarios.authenticationErrors
      .find(error => error.type === errorType);
    
    return {
      status: errorConfig.status,
      headers: {
        'content-type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify({
        error: {
          code: errorConfig.type,
          message: errorConfig.message
        }
      })
    };
  }

  static generateNetworkError(errorType = 'connection_failed') {
    const errorConfig = testFixtures.errorScenarios.networkErrors
      .find(error => error.type === errorType);
    
    // For network errors, we throw instead of returning a response
    throw new Error(errorConfig.message);
  }

  static generateAIProviderResponse(provider = 'openai', responseType = 'success') {
    const responseKey = `${provider}${responseType.charAt(0).toUpperCase() + responseType.slice(1)}`;
    return testFixtures.aiResponses[responseKey];
  }
}

/**
 * Data Validation Utilities
 */
class DataValidator {
  static validateTranscriptStructure(transcript) {
    const errors = [];
    
    // Check required top-level fields
    if (!transcript.$schema) errors.push('Missing $schema field');
    if (!transcript.version) errors.push('Missing version field');
    if (!transcript.type) errors.push('Missing type field');
    if (!Array.isArray(transcript.entries)) errors.push('entries must be an array');
    if (!Array.isArray(transcript.events)) errors.push('events must be an array');
    
    // Validate each entry
    transcript.entries?.forEach((entry, index) => {
      if (!entry.id) errors.push(`Entry ${index}: Missing id`);
      if (!entry.text) errors.push(`Entry ${index}: Missing text`);
      if (!entry.speakerDisplayName) errors.push(`Entry ${index}: Missing speakerDisplayName`);
      if (!entry.startOffset) errors.push(`Entry ${index}: Missing startOffset`);
      if (!entry.endOffset) errors.push(`Entry ${index}: Missing endOffset`);
      if (typeof entry.confidence !== 'number') errors.push(`Entry ${index}: confidence must be a number`);
      if (!entry.spokenLanguageTag) errors.push(`Entry ${index}: Missing spokenLanguageTag`);
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateSummaryStructure(summary) {
    const errors = [];
    
    if (!summary.content) errors.push('Missing content field');
    if (!Array.isArray(summary.content.keyDecisions)) errors.push('keyDecisions must be an array');
    if (!Array.isArray(summary.content.actionItems)) errors.push('actionItems must be an array');
    if (!summary.content.fullSummary) errors.push('Missing fullSummary field');
    
    // Validate action items structure
    summary.content.actionItems?.forEach((item, index) => {
      if (!item.task) errors.push(`Action item ${index}: Missing task`);
      if (!item.assignee) errors.push(`Action item ${index}: Missing assignee`);
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateExportFormat(content, format) {
    const errors = [];
    
    switch (format.toLowerCase()) {
      case 'markdown':
        if (!content.includes('#')) errors.push('Missing markdown headers');
        if (!content.includes('**')) errors.push('Missing markdown bold formatting');
        break;
      case 'html':
        if (!content.includes('<html>')) errors.push('Missing HTML structure');
        if (!content.includes('<head>')) errors.push('Missing HTML head');
        if (!content.includes('<body>')) errors.push('Missing HTML body');
        break;
      case 'plaintext':
        if (content.includes('<') || content.includes('#') || content.includes('**')) {
          errors.push('Plain text should not contain formatting characters');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Test Helper Functions
 */
class TestHelpers {
  static generateUniqueId() {
    return 'test_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  static createMockMeetingURL(meetingId = 'test-meeting') {
    return `https://cht365-my.sharepoint.com/personal/day_cht_com_tw/_layouts/15/stream.aspx?id=/personal/day_cht_com_tw/Documents/錄製/${meetingId}.mp4`;
  }

  static sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  static formatTimestamp(timestamp) {
    // Convert "HH:MM:SS.fffffff" to "HH:MM:SS"
    return timestamp.split('.')[0];
  }

  static calculateTokenCount(text) {
    // Rough estimation: 1 token ≈ 4 characters for Chinese, 4 characters for English
    return Math.ceil(text.length / 4);
  }

  static generateLargeTranscript(entryCount = 1000) {
    const baseEntry = testFixtures.transcripts.productMeeting.entries[0];
    const entries = [];
    
    for (let i = 0; i < entryCount; i++) {
      const minutes = Math.floor(i / 10);
      const seconds = (i % 10) * 6;
      
      entries.push({
        ...baseEntry,
        id: `entry-${i + 1}`,
        text: `這是第${i + 1}個發言內容，討論會議的重要議題。`,
        startOffset: `00:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.0000000`,
        endOffset: `00:${minutes.toString().padStart(2, '0')}:${(seconds + 5).toString().padStart(2, '0')}.0000000`
      });
    }
    
    return {
      ...testFixtures.transcripts.productMeeting,
      entries
    };
  }

  static async waitForCondition(conditionFn, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await conditionFn()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static createProgressCallback() {
    const updates = [];
    
    return {
      callback: (update) => updates.push(update),
      getUpdates: () => updates,
      getLastUpdate: () => updates[updates.length - 1],
      clear: () => updates.length = 0
    };
  }

  static mockElementActions() {
    return {
      click: async (selector) => {
        console.log(`Mock: Clicking element ${selector}`);
        return true;
      },
      type: async (selector, text) => {
        console.log(`Mock: Typing "${text}" into ${selector}`);
        return true;
      },
      select: async (selector, value) => {
        console.log(`Mock: Selecting "${value}" in ${selector}`);
        return true;
      },
      waitFor: async (selector, timeout = 5000) => {
        console.log(`Mock: Waiting for element ${selector}`);
        return true;
      }
    };
  }

  static createDownloadMock() {
    const downloads = [];
    
    return {
      triggerDownload: (filename, content, mimeType) => {
        downloads.push({ filename, content, mimeType, timestamp: new Date() });
      },
      getDownloads: () => downloads,
      getLastDownload: () => downloads[downloads.length - 1],
      clearDownloads: () => downloads.length = 0
    };
  }

  static createClipboardMock() {
    let clipboardContent = '';
    
    return {
      writeText: (text) => {
        clipboardContent = text;
        return Promise.resolve();
      },
      readText: () => Promise.resolve(clipboardContent),
      clear: () => {
        clipboardContent = '';
      }
    };
  }
}

/**
 * Browser Extension Test Utilities
 */
class ExtensionTestUtils {
  static mockExtensionAPIs() {
    return {
      chrome: {
        runtime: {
          sendMessage: (message, callback) => {
            // Mock message passing
            setTimeout(() => {
              if (callback) callback({ success: true, data: message });
            }, 10);
          },
          getURL: (path) => `chrome-extension://mock-extension-id/${path}`,
          id: 'mock-extension-id'
        },
        storage: {
          local: {
            get: (keys, callback) => {
              const mockData = testFixtures.testSettings.defaultAiSettings;
              callback(mockData);
            },
            set: (data, callback) => {
              if (callback) callback();
            }
          }
        },
        tabs: {
          create: (options, callback) => {
            console.log(`Mock: Creating tab with URL ${options.url}`);
            if (callback) callback({ id: 'mock-tab-id' });
          }
        }
      }
    };
  }

  static injectMockAPIs(page) {
    return page.evaluateOnNewDocument(() => {
      // Mock Chrome extension APIs
      window.chrome = window.chrome || {
        runtime: {
          sendMessage: (message, callback) => {
            setTimeout(() => {
              if (callback) callback({ success: true });
            }, 10);
          },
          getURL: (path) => `chrome-extension://mock-extension/${path}`
        },
        storage: {
          local: {
            get: (keys, callback) => callback({}),
            set: (data, callback) => callback && callback()
          }
        }
      };

      // Mock fetch for API calls
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        if (url.includes('/_api/v2.1/drives/')) {
          // Mock SharePoint API
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(window.mockTranscriptData || {})
          });
        }
        
        if (url.includes('api.openai.com') || url.includes('api.anthropic.com')) {
          // Mock AI provider APIs
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(window.mockAIResponse || {})
          });
        }
        
        return originalFetch.call(this, url, options);
      };
    });
  }

  static setupMockResponses(page, responses) {
    return page.evaluate((mockResponses) => {
      window.mockTranscriptData = mockResponses.transcript;
      window.mockAIResponse = mockResponses.aiResponse;
    }, responses);
  }
}

/**
 * Performance Testing Utilities
 */
class PerformanceTestUtils {
  static createPerformanceMonitor() {
    const metrics = {
      startTime: null,
      endTime: null,
      duration: null,
      memoryUsage: [],
      networkRequests: []
    };

    return {
      start: () => {
        metrics.startTime = performance.now();
      },
      stop: () => {
        metrics.endTime = performance.now();
        metrics.duration = metrics.endTime - metrics.startTime;
      },
      recordMemoryUsage: () => {
        if (performance.memory) {
          metrics.memoryUsage.push({
            timestamp: performance.now(),
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize
          });
        }
      },
      recordNetworkRequest: (url, method, duration) => {
        metrics.networkRequests.push({
          url, method, duration, timestamp: performance.now()
        });
      },
      getMetrics: () => metrics,
      getDuration: () => metrics.duration,
      getAverageMemoryUsage: () => {
        if (metrics.memoryUsage.length === 0) return 0;
        const total = metrics.memoryUsage.reduce((sum, m) => sum + m.used, 0);
        return total / metrics.memoryUsage.length;
      }
    };
  }

  static async measureOperationTime(operation) {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    
    return {
      result,
      duration: end - start
    };
  }
}

module.exports = {
  MockAPIResponseGenerator,
  DataValidator,
  TestHelpers,
  ExtensionTestUtils,
  PerformanceTestUtils,
  testFixtures
};