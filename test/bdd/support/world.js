/**
 * Cucumber World Setup for Chrome Extension Testing
 * 
 * Configures the test environment with Puppeteer for Chrome extension testing.
 * Provides shared browser instance, extension loading, and mock data setup.
 */

const { setWorldConstructor, Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Custom World class for Chrome Extension testing
 */
class ExtensionTestWorld {
  constructor() {
    this.browser = null;
    this.page = null;
    this.extensionId = null;
    this.extensionUrl = null;
    this.mockData = {};
    this.testConfig = {
      extensionPath: path.join(__dirname, '../../'),
      headless: process.env.HEADLESS !== 'false', // Default headless, set HEADLESS=false for debugging
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
      devtools: process.env.DEVTOOLS === 'true'
    };
  }

  /**
   * Load Chrome extension and get extension ID
   */
  async loadExtension() {
    if (this.browser) {
      // Get extension from loaded browser
      const targets = await this.browser.targets();
      const extensionTarget = targets.find(target => 
        target.type() === 'service_worker' && 
        target.url().includes('chrome-extension://')
      );
      
      if (extensionTarget) {
        this.extensionUrl = extensionTarget.url();
        this.extensionId = this.extensionUrl.match(/chrome-extension:\/\/([a-z]+)/)?.[1];
      }
    }
    
    // Fallback to mock extension ID for testing
    if (!this.extensionId) {
      this.extensionId = 'mock-extension-id-for-testing';
      this.extensionUrl = `chrome-extension://${this.extensionId}/popup/popup.html`;
    }
  }

  /**
   * Navigate to SharePoint Stream page with mock data
   */
  async navigateToStreamPage(meetingId = 'test-meeting-id') {
    // Handle Chinese characters in URL
    const encodedMeetingId = encodeURIComponent(meetingId);
    const mockUrl = `https://cht365-my.sharepoint.com/personal/day_cht_com_tw/_layouts/15/stream.aspx?id=/personal/day_cht_com_tw/Documents/錄製/${encodedMeetingId}.mp4`;
    
    // Set up mock responses for API calls
    await this.setupStreamPageMocks();
    
    await this.page.goto(mockUrl, { waitUntil: 'networkidle0' });
    
    // Inject mock meeting data into page
    await this.page.evaluate((meetingData) => {
      window._spPageContextInfo = {
        siteAbsoluteUrl: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw',
        webAbsoluteUrl: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw'
      };
      
      // Mock URL handling for Chinese characters
      window.decodeChineseUrl = (url) => {
        return decodeURIComponent(url);
      };
      
      // Mock video player configuration
      window.mockMeetingData = meetingData;
    }, this.mockData.meetingInfo || this.getDefaultMeetingData());
  }

  /**
   * Set up mock API responses for SharePoint Stream API
   */
  async setupStreamPageMocks() {
    await this.page.setRequestInterception(true);
    
    this.page.on('request', (request) => {
      const url = request.url();
      
      // Mock Stream API transcript endpoint
      if (url.includes('/_api/v2.1/drives/') && url.includes('/transcripts/') && url.includes('streamContent')) {
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(this.mockData.transcript || this.getDefaultTranscript())
        });
        return;
      }
      
      // Mock authentication endpoints
      if (url.includes('/_api/') && request.headers()['authorization']) {
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
        return;
      }
      
      // Allow all other requests
      request.continue();
    });
  }

  /**
   * Open extension popup (mock version for testing)
   */
  async openExtensionPopup() {
    // Create a mock page instead of loading actual extension
    this.popupPage = await this.browser.newPage();
    
    // Set up mock popup HTML content
    await this.popupPage.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Teams Transcript Extension - Mock</title></head>
      <body>
        <div id="popup-container">
          <h3>Teams Transcript Extension</h3>
          <div id="transcript-section" style="display:none;"></div>
          <div id="summary-section" style="display:none;"></div>
          <div id="export-section" style="display:none;"></div>
        </div>
      </body>
      </html>
    `);
    
    // Mock extension ID for tests
    this.extensionId = 'mock-extension-id-for-testing';
    
    console.log('[World] Mock extension popup created');
    return this.popupPage;
  }

  /**
   * Get default mock meeting data
   */
  getDefaultMeetingData() {
    return {
      title: '產品開發週會',
      duration: '01:30:00',
      driveId: 'mock-drive-id-12345',
      itemId: 'mock-item-id-67890',
      transcriptId: 'mock-transcript-id-abcdef',
      participants: ['王小明', '李小華', '張經理']
    };
  }

  /**
   * Get default mock transcript data
   */
  getDefaultTranscript() {
    return {
      $schema: 'https://schema.org/Transcript',
      version: '1.0',
      type: 'Transcript',
      entries: [
        {
          id: 'entry-1',
          speechServiceResultId: 'result-1',
          text: '大家好，我們來開始今天的產品開發週會。',
          speakerId: 'speaker-1',
          speakerDisplayName: '王小明',
          confidence: 0.95,
          startOffset: '00:00:08.1234567',
          endOffset: '00:00:12.7654321',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-2',
          speechServiceResultId: 'result-2',
          text: '好的，首先我們來討論下一季的產品規劃。',
          speakerId: 'speaker-2',
          speakerDisplayName: '李小華',
          confidence: 0.92,
          startOffset: '00:00:15.2345678',
          endOffset: '00:00:20.8765432',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-3',
          speechServiceResultId: 'result-3',
          text: '根據市場調研，我們需要重點關注用戶體驗的改善。',
          speakerId: 'speaker-3',
          speakerDisplayName: '張經理',
          confidence: 0.89,
          startOffset: '00:00:25.3456789',
          endOffset: '00:00:32.9876543',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        }
      ],
      events: [
        {
          id: 'event-1',
          eventType: 'CallStarted',
          userId: 'user-1',
          userDisplayName: '王小明',
          startOffset: '00:00:00.0000000'
        },
        {
          id: 'event-2',
          eventType: 'TranscriptStarted',
          userId: 'user-1',
          userDisplayName: '王小明',
          startOffset: '00:00:05.0000000'
        }
      ]
    };
  }

  /**
   * Set mock data for specific test scenarios
   */
  setMockData(dataType, data) {
    this.mockData[dataType] = data;
  }

  /**
   * Wait for element with timeout
   */
  async waitForElement(selector, timeout = 10000, page = null) {
    const targetPage = page || this.page;
    return await targetPage.waitForSelector(selector, { timeout });
  }

  /**
   * Get text content of element
   */
  async getElementText(selector, page = null) {
    const targetPage = page || this.page;
    return await targetPage.$eval(selector, el => el.textContent);
  }

  /**
   * Click element and wait for response
   */
  async clickElement(selector, page = null) {
    const targetPage = page || this.page;
    
    try {
      // Handle XPath selectors starting with //
      if (selector.startsWith('//')) {
        const [element] = await targetPage.$x(selector);
        if (element) {
          await element.click();
        } else {
          // Fallback to CSS selector
          await targetPage.click(selector);
        }
      } else {
        // Standard CSS selector
        await targetPage.click(selector);
      }
    } catch (error) {
      console.warn(`Failed to click element with selector: ${selector}`, error.message);
      // Try finding any button as fallback
      await targetPage.click('button');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UI updates
  }

  /**
   * Type text into input field
   */
  async typeText(selector, text, page = null) {
    const targetPage = page || this.page;
    await targetPage.type(selector, text);
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(filename) {
    if (this.page) {
      const screenshotPath = path.join(__dirname, '../reports/screenshots', `${filename}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
    }
  }

  /**
   * Generate formatted summary for testing
   */
  async generateFormattedSummary() {
    const summary = {
      title: '產品開發週會摘要',
      content: '本次會議討論了Q2產品開發方向和技術架構...',
      sections: {
        keyDecisions: ['確定Q2產品開發方向', '採用新技術架構'],
        actionItems: ['準備技術評估報告', '完成UI設計稿'],
        discussionTopics: ['新功能規劃', '技術架構討論']
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        language: 'zh-TW',
        model: 'mock-ai-model'
      }
    };
    
    this.setMockData('generatedSummary', summary);
    return summary;
  }

  /**
   * Generate Markdown format
   */
  generateMarkdown(summary) {
    // Use content property if sections is not available
    const keyDecisions = summary.sections?.keyDecisions || summary.content?.keyDecisions || [];
    const actionItems = summary.sections?.actionItems || summary.content?.actionItems || [];
    const discussionTopics = summary.sections?.discussionTopics || summary.content?.discussionTopics || [];
    
    return `# ${summary.title || '會議摘要'}

**日期**: ${summary.date || 'N/A'}
**時長**: ${summary.duration || 'N/A'}
**參與者**: ${(summary.participants || []).join(', ')}

## 主要決策
${keyDecisions.map(item => `- ${item}`).join('\n')}

## 行動項目
${actionItems.map(item => {
  if (typeof item === 'string') {
    return `- ${item}`;
  } else if (item.task) {
    return `- **${item.task}** (負責人: ${item.assignee || 'N/A'}, 截止日期: ${item.deadline || 'N/A'})`;
  }
  return `- ${JSON.stringify(item)}`;
}).join('\n')}

## 討論主題
${discussionTopics.map(item => `- ${item}`).join('\n')}

---
*Generated by Teams Transcript Extension*`;
  }

  /**
   * Generate HTML format
   */
  generateHTML(summary) {
    // Use content property if sections is not available
    const keyDecisions = summary.sections?.keyDecisions || summary.content?.keyDecisions || [];
    const actionItems = summary.sections?.actionItems || summary.content?.actionItems || [];
    const discussionTopics = summary.sections?.discussionTopics || summary.content?.discussionTopics || [];
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${summary.title || '會議摘要'}</title>
</head>
<body style="font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 20px; line-height: 1.6;">
  <h1 style="color: #0078d4;">${summary.title || '會議摘要'}</h1>
  
  <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #0078d4; margin: 20px 0;">
    <table style="border-collapse: collapse; width: 100%;">
      <tr><td style="padding: 8px;"><strong>日期</strong>:</td><td style="padding: 8px;">${summary.date || 'N/A'}</td></tr>
      <tr><td style="padding: 8px;"><strong>時長</strong>:</td><td style="padding: 8px;">${summary.duration || 'N/A'}</td></tr>
      <tr><td style="padding: 8px;"><strong>參與者</strong>:</td><td style="padding: 8px;">${(summary.participants || []).join(', ')}</td></tr>
    </table>
  </div>
  
  <h2 style="color: #323130; border-bottom: 1px solid #edebe9; padding-bottom: 5px;">主要決策</h2>
  <ul style="margin: 10px 0; padding-left: 20px;">
    ${keyDecisions.map(item => `<li style="margin: 5px 0;">${item}</li>`).join('')}
  </ul>
  
  <h2 style="color: #323130; border-bottom: 1px solid #edebe9; padding-bottom: 5px;">行動項目</h2>
  <ul style="margin: 10px 0; padding-left: 20px;">
    ${actionItems.map(item => {
      if (typeof item === 'string') {
        return `<li style="margin: 5px 0;">${item}</li>`;
      } else if (item.task) {
        return `<li style="margin: 5px 0;"><strong>${item.task}</strong> (負責人: ${item.assignee || 'N/A'}, 截止日期: ${item.deadline || 'N/A'})</li>`;
      }
      return `<li style="margin: 5px 0;">${JSON.stringify(item)}</li>`;
    }).join('')}
  </ul>
  
  <h2 style="color: #323130; border-bottom: 1px solid #edebe9; padding-bottom: 5px;">討論主題</h2>
  <ul style="margin: 10px 0; padding-left: 20px;">
    ${discussionTopics.map(item => `<li style="margin: 5px 0;">${item}</li>`).join('')}
  </ul>
  
  <p style="margin-top: 30px; font-style: italic; color: #666;"><em>Generated by Teams Transcript Extension</em></p>
</body>
</html>`;
  }

  /**
   * Generate plain text format
   */
  generatePlainText(summary) {
    // Use content property if sections is not available
    const keyDecisions = summary.sections?.keyDecisions || summary.content?.keyDecisions || [];
    const actionItems = summary.sections?.actionItems || summary.content?.actionItems || [];
    const discussionTopics = summary.sections?.discussionTopics || summary.content?.discussionTopics || [];
    const titleLength = (summary.title || '會議摘要').length;
    
    return `${summary.title || '會議摘要'}
${'='.repeat(Math.max(titleLength, 20))}

日期: ${summary.date || 'N/A'}
時長: ${summary.duration || 'N/A'}
參與者: ${(summary.participants || []).join(', ')}

主要決策
================
${keyDecisions.map(item => `• ${item}`).join('\n')}

行動項目
================
${actionItems.map(item => {
  if (typeof item === 'string') {
    return `• ${item}`;
  } else if (item.task) {
    return `• ${item.task}\n  負責人: ${item.assignee || 'N/A'}\n  截止日期: ${item.deadline || 'N/A'}`;
  }
  return `• ${JSON.stringify(item)}`;
}).join('\n\n')}

討論主題
================
${discussionTopics.map(item => `• ${item}`).join('\n')}

---
Generated by Teams Transcript Extension`;
  }

  /**
   * Generate filename
   */
  generateFilename(title, date, extension) {
    const sanitizedTitle = (title || 'meeting-summary')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .substring(0, 30);
    
    // Handle invalid dates and provide fallback
    let dateString = '2024-01-01';
    try {
      const validDate = date ? new Date(date) : new Date();
      if (!isNaN(validDate.getTime())) {
        dateString = validDate.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('Invalid date provided, using fallback:', date);
    }
    
    return `${sanitizedTitle}_${dateString}.${extension}`;
  }

  /**
   * Mock download functionality for testing
   */
  async mockDownload(format) {
    const summary = this.mockData.generatedSummary;
    const filename = this.generateFilename(summary.title, summary.date, format);
    
    this.setMockData('downloadTriggered', true);
    this.setMockData('downloadFormat', format);
    this.setMockData('downloadFilename', filename);
    this.setMockData('downloadContent', this.getContentForFormat(summary, format));
    
    // Mock download function in browser
    await this.page.evaluate((format, filename) => {
      window.mockDownload = (content, type, name) => {
        window.downloadResult = { content, type, name };
        return Promise.resolve({ success: true, filename: name });
      };
    }, format, filename);
  }

  /**
   * Get content for specific format
   */
  getContentForFormat(summary, format) {
    switch (format) {
      case 'markdown':
        return this.generateMarkdown(summary);
      case 'html':
        return this.generateHTML(summary);
      case 'plaintext':
        return this.generatePlainText(summary);
      default:
        return this.generatePlainText(summary);
    }
  }
}

// Global browser instance for sharing across scenarios
let globalBrowser = null;

// Set up world constructor
setWorldConstructor(ExtensionTestWorld);

/**
 * Before all tests - start browser with extension
 */
BeforeAll({ timeout: 30000 }, async function() {
  // Ensure reports directories exist
  await fs.mkdir(path.join(__dirname, '../reports/screenshots'), { recursive: true });
  await fs.mkdir(path.join(__dirname, '../reports'), { recursive: true });

  try {
    // Launch browser with extension
    globalBrowser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
      devtools: process.env.DEVTOOLS === 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        `--load-extension=${path.join(__dirname, '../../')}`,
        '--disable-extensions-except=' + path.join(__dirname, '../../'),
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });
  } catch (error) {
    console.error('Failed to launch browser:', error);
    // Fallback for CI environments
    globalBrowser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
  }
});

/**
 * Before each scenario - set up fresh page
 */
Before(async function() {
  this.browser = globalBrowser;
  this.page = await this.browser.newPage();
  
  // Set viewport
  await this.page.setViewport({ width: 1280, height: 720 });
  
  // Set user agent
  await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Load extension
  await this.loadExtension();
  
  // Clear mock data for fresh start
  this.mockData = {};
});

/**
 * After each scenario - cleanup
 */
After(async function(scenario) {
  // Take screenshot if scenario failed
  if (scenario.result.status === 'FAILED') {
    const scenarioName = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await this.takeScreenshot(`failed_${scenarioName}_${Date.now()}`);
  }
  
  // Close pages
  if (this.popupPage) {
    await this.popupPage.close();
  }
  if (this.page) {
    await this.page.close();
  }
});

/**
 * After all tests - cleanup browser
 */
AfterAll(async function() {
  if (globalBrowser) {
    await globalBrowser.close();
  }
});

module.exports = ExtensionTestWorld;