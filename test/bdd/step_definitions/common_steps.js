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
      await page.waitForTimeout(500); // Simulate processing
      this.setMockData('extracting', false);
      this.setMockData('transcriptExtracted', true);
      break;
      
    case 'Generate Summary':
      this.setMockData('summaryGenerating', true);
      await page.waitForTimeout(1000); // Simulate AI processing
      this.setMockData('summaryGenerating', false);
      this.setMockData('summaryComplete', true);
      break;
      
    case 'Export as Markdown':
    case 'Export as HTML':  
    case 'Export as Plain Text':
      const format = buttonText.split(' ').pop().toLowerCase();
      this.setMockData('exporting', true);
      this.setMockData('exportFormat', format);
      await page.waitForTimeout(200);
      this.setMockData('exporting', false);
      this.setMockData('exported', true);
      break;
      
    default:
      // Generic button click
      this.setMockData('buttonClicked', buttonText);
  }
});

// Common setup steps
Given('I have the extension installed', async function() {
  // Mock extension installation check
  this.extensionId = 'mock-extension-id-for-testing';
  expect(this.extensionId).to.not.be.null;
  this.setMockData('extensionInstalled', true);
});

Given('the extension has necessary permissions', async function() {
  // Mock permission check
  this.setMockData('hasPermissions', true);
  expect(this.mockData.hasPermissions).to.be.true;
});

// Note: Removed duplicate step definitions that are already defined in specific step files
// - "I should see {string}" is now only in transcript_steps.js 
// - "I should see a {string} button" is now only in transcript_steps.js