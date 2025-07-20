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
  }

  /**
   * Navigate to SharePoint Stream page with mock data
   */
  async navigateToStreamPage(meetingId = 'test-meeting-id') {
    const mockUrl = `https://cht365-my.sharepoint.com/personal/day_cht_com_tw/_layouts/15/stream.aspx?id=/personal/day_cht_com_tw/Documents/錄製/${meetingId}.mp4`;
    
    // Set up mock responses for API calls
    await this.setupStreamPageMocks();
    
    await this.page.goto(mockUrl, { waitUntil: 'networkidle0' });
    
    // Inject mock meeting data into page
    await this.page.evaluate((meetingData) => {
      window._spPageContextInfo = {
        siteAbsoluteUrl: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw',
        webAbsoluteUrl: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw'
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
   * Open extension popup
   */
  async openExtensionPopup() {
    if (!this.extensionId) {
      await this.loadExtension();
    }
    
    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    
    // Create new page for popup
    this.popupPage = await this.browser.newPage();
    await this.popupPage.goto(popupUrl, { waitUntil: 'networkidle0' });
    
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
    await targetPage.click(selector);
    await targetPage.waitForTimeout(500); // Small delay for UI updates
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
}

// Global browser instance for sharing across scenarios
let globalBrowser = null;

// Set up world constructor
setWorldConstructor(ExtensionTestWorld);

/**
 * Before all tests - start browser with extension
 */
BeforeAll(async function() {
  // Ensure reports directories exist
  await fs.mkdir(path.join(__dirname, '../reports/screenshots'), { recursive: true });
  await fs.mkdir(path.join(__dirname, '../reports'), { recursive: true });

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