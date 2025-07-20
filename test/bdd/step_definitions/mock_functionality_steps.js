/**
 * Mock Functionality Step Definitions
 * 
 * Simple, standalone tests that don't depend on Chrome extension loading.
 * These tests verify the BDD framework works correctly.
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

// Background steps
Given('the extension is loaded in mock mode', async function() {
  this.extensionId = 'mock-extension-id';
  this.setMockData('mockMode', true);
  console.log('[MockTest] Extension loaded in mock mode');
});

Given('all mock data is initialized', async function() {
  this.setMockData('initialized', true);
  this.setMockData('transcript', {
    entries: [
      { text: '大家好，我們來開始今天的產品開發週會', speaker: '張經理', timestamp: '00:00:10' },
      { text: '今天的主要議題是討論Q2的開發方向', speaker: '李工程師', timestamp: '00:01:15' }
    ],
    metadata: { duration: '01:30:00', language: 'zh-TW' }
  });
  console.log('[MockTest] Mock data initialized');
});

// Core functionality tests
Given('I have mock transcript data', async function() {
  const transcript = this.mockData.transcript;
  expect(transcript).to.not.be.undefined;
  expect(transcript.entries.length).to.be.above(0);
});

// Note: Duplicate step definition removed - using the one in transcript_steps.js
// The processing logic has been moved to transcript_steps.js for consistency

Then('the transcript should be formatted correctly', async function() {
  const processed = this.mockData.processedTranscript;
  
  expect(processed).to.not.be.undefined;
  expect(processed.entryCount).to.equal(2);
  expect(processed.speakers).to.include('張經理');
  expect(processed.language).to.equal('zh-TW');
});

Then('the processing should complete successfully', async function() {
  const processed = this.mockData.processedTranscript;
  expect(processed.processedAt).to.not.be.undefined;
  console.log('[MockTest] Processing completed successfully');
});

// Export functionality tests
Given('I have a generated summary', async function() {
  const summary = {
    title: '產品開發週會摘要',
    content: '本次會議討論了Q2產品開發方向',
    sections: {
      keyDecisions: ['確定Q2產品開發方向'],
      actionItems: ['準備技術評估報告']
    },
    generatedAt: new Date().toISOString()
  };
  
  this.setMockData('generatedSummary', summary);
});

When('I export it in markdown format', async function() {
  const summary = this.mockData.generatedSummary;
  
  // Mock export logic
  const markdown = this.generateMarkdown(summary);
  const filename = this.generateFilename(summary.title, summary.generatedAt, 'md');
  
  this.setMockData('exportedMarkdown', {
    content: markdown,
    filename: filename,
    format: 'markdown',
    exportedAt: new Date().toISOString()
  });
  
  console.log('[MockTest] Exported to markdown');
});

Then('a markdown file should be created', async function() {
  const exported = this.mockData.exportedMarkdown;
  
  expect(exported).to.not.be.undefined;
  expect(exported.filename).to.include('.md');
  expect(exported.format).to.equal('markdown');
});

Then('the content should be properly formatted', async function() {
  const exported = this.mockData.exportedMarkdown;
  
  expect(exported.content).to.include('# 產品開發週會摘要');
  expect(exported.content).to.include('## 主要決策');
  expect(exported.content).to.include('Teams Transcript Extension');
});

// AI integration tests
Given('I have transcript data', async function() {
  const transcript = this.mockData.transcript;
  expect(transcript).to.not.be.undefined;
  expect(transcript.entries.length).to.be.above(0);
});

When('I generate a summary using mock AI', async function() {
  const transcript = this.mockData.transcript;
  
  // Mock AI processing
  const aiSummary = {
    provider: 'mock-ai',
    model: 'mock-gpt-4',
    summary: '本次產品開發週會的主要討論重點包括Q2開發方向的確定',
    keyDecisions: ['確定Q2產品開發方向'],
    actionItems: ['準備技術評估報告', '完成UI設計稿'],
    confidence: 0.95,
    tokensUsed: 1500,
    processingTime: 2.5
  };
  
  this.setMockData('aiSummary', aiSummary);
  console.log('[MockTest] AI summary generated');
});

Then('the summary should contain key sections', async function() {
  const aiSummary = this.mockData.aiSummary;
  
  expect(aiSummary.summary).to.not.be.empty;
  expect(aiSummary.keyDecisions).to.be.an('array');
  expect(aiSummary.actionItems).to.be.an('array');
  expect(aiSummary.keyDecisions.length).to.be.above(0);
});

Then('the response should include metadata', async function() {
  const aiSummary = this.mockData.aiSummary;
  
  expect(aiSummary.provider).to.equal('mock-ai');
  expect(aiSummary.model).to.equal('mock-gpt-4');
  expect(aiSummary.confidence).to.be.above(0.8);
  expect(aiSummary.tokensUsed).to.be.above(0);
});

// Error handling tests
Given('I have invalid input data', async function() {
  this.setMockData('invalidInput', {
    transcript: null,
    apiKey: '',
    format: 'invalid'
  });
});

When('I try to process it', async function() {
  const invalidInput = this.mockData.invalidInput;
  
  // Mock error processing
  const error = {
    type: 'validation_error',
    message: 'Invalid input data provided',
    code: 400,
    recoverable: true,
    suggestions: ['Check your API key', 'Verify transcript data']
  };
  
  this.setMockData('processingError', error);
  console.log('[MockTest] Error processing completed');
});

Then('an appropriate error should be shown', async function() {
  const error = this.mockData.processingError;
  
  expect(error).to.not.be.undefined;
  expect(error.type).to.equal('validation_error');
  expect(error.message).to.include('Invalid input');
});

Then('recovery options should be available', async function() {
  const error = this.mockData.processingError;
  
  expect(error.recoverable).to.be.true;
  expect(error.suggestions).to.be.an('array');
  expect(error.suggestions.length).to.be.above(0);
});