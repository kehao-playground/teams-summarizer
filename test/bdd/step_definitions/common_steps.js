/**
 * Common Step Definitions
 * 
 * Shared step definitions used across multiple feature files.
 * This prevents duplication and conflicts between step files.
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

// Common click action
When('I click {string}', async function(buttonText) {
  const page = this.popupPage || this.page;
  
  console.log(`[CommonSteps] Clicking button: ${buttonText}`);
  
  // Mock different button interactions based on text
  switch (buttonText) {
    case 'Extract Transcript':
      this.setMockData('extracting', true);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
      this.setMockData('extracting', false);
      this.setMockData('transcriptExtracted', true);
      break;
      
    case 'Generate Summary':
      this.setMockData('summaryGenerating', true);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate AI processing
      this.setMockData('summaryGenerating', false);
      this.setMockData('summaryComplete', true);
      
      // Create mock summary if it doesn't exist
      if (!this.mockData.generatedSummary) {
        this.setMockData('generatedSummary', {
          title: '產品開發週會',
          date: '2025-01-15',
          duration: '01:30:00',
          participants: ['王小明', '李小華', '張經理'],
          content: {
            keyDecisions: ['確定Q2產品開發方向', '採用新技術架構'],
            actionItems: [
              { task: '準備技術評估報告', assignee: '張經理', deadline: '月底前' },
              { task: '完成市場調研', assignee: '李小華', deadline: '下週五' }
            ],
            discussionTopics: ['新功能規劃', '技術架構討論', '用戶體驗改善'],
            fullSummary: `本次產品開發週會主要討論了Q2的產品規劃方向。

主要決策：
- 確定Q2產品開發重點為用戶體驗改善
- 採用新的微服務技術架構

行動項目：
- 張經理: 準備技術評估報告 (月底前)
- 李小華: 完成市場調研 (下週五)

討論主題：
- 新功能規劃和用戶需求分析
- 技術架構討論和選型
- 用戶體驗改善方案`
          },
          generatedAt: new Date().toISOString()
        });
      }
      break;
      
    case 'Export as Markdown':
    case 'Export as HTML':  
    case 'Export as Plain Text':
      const format = buttonText.split(' ').pop().toLowerCase();
      this.setMockData('exporting', true);
      this.setMockData('exportFormat', format);
      await new Promise(resolve => setTimeout(resolve, 200));
      this.setMockData('exporting', false);
      this.setMockData('exported', true);
      break;
      
    case 'Copy HTML':
      // Generate HTML content and copy to clipboard
      const summary = this.mockData.generatedSummary;
      if (summary) {
        const htmlContent = this.generateHTML(summary);
        this.clipboardContent = htmlContent;
        this.setMockData('clipboardContent', htmlContent);
        this.setMockData('clipboardCopied', true);
        this.setMockData('copiedToClipboard', true);
        this.setMockData('clipboardFormat', 'html');
      }
      break;
      
    case 'Copy Plain Text':
      // Generate plain text content and copy to clipboard
      const summaryText = this.mockData.generatedSummary;
      if (summaryText) {
        const plainTextContent = this.generatePlainText(summaryText);
        this.clipboardContent = plainTextContent;
        this.setMockData('copiedToClipboard', true);
        this.setMockData('clipboardFormat', 'text');
      }
      break;
      
    case 'Download .md':
      // Generate markdown content for download
      const summaryMd = this.mockData.generatedSummary;
      if (summaryMd) {
        const markdownContent = this.generateMarkdown(summaryMd);
        this.downloadContent = markdownContent;
        this.downloadFilename = this.generateFilename(summaryMd.title, summaryMd.date, 'md');
        this.setMockData('downloaded', true);
        this.setMockData('downloadFormat', 'md');
      }
      break;
      
    case 'Download .txt':
      // Generate plain text content for download
      const summaryTxt = this.mockData.generatedSummary;
      if (summaryTxt) {
        const textContent = this.generatePlainText(summaryTxt);
        this.downloadContent = textContent;
        this.downloadFilename = this.generateFilename(summaryTxt.title, summaryTxt.date, 'txt');
        this.setMockData('downloaded', true);
        this.setMockData('downloadFormat', 'txt');
      }
      break;
      
    case 'Export All Formats':
      // Export all formats at once
      const summaryAll = this.mockData.generatedSummary;
      if (summaryAll) {
        this.setMockData('exportingAll', true);
        await new Promise(resolve => setTimeout(resolve, 300));
        this.setMockData('exportingAll', false);
        this.setMockData('exportedAll', true);
      }
      break;
      
    default:
      // Generic button click
      this.setMockData('buttonClicked', buttonText);
  }
});

// Note: Removed duplicate step definitions that are already defined in specific step files
// - "I have the extension installed" is now only in transcript_steps.js
// - "the extension has necessary permissions" is now only in transcript_steps.js

// Note: Removed duplicate step definitions that are already defined in specific step files
// - "I should see {string}" is now only in transcript_steps.js 
// - "I should see a {string} button" is now only in transcript_steps.js