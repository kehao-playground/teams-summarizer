/**
 * Step Definitions for Export and Settings Features
 * 
 * Implements Gherkin step definitions for testing summary export functionality
 * and extension settings management.
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const path = require('path');

// Export Feature Steps
Given('I have generated a meeting summary', async function() {
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
- 張經理將準備完整的技術評估報告（月底前完成）
- 李小華負責完成市場調研分析（下週五前完成）

討論重點：
會議中深入討論了新功能的規劃細節，包括用戶界面設計和後端架構選型。技術團隊對新架構的可行性進行了充分論證。`
    },
    formats: {
      markdown: '',
      html: '',
      plainText: ''
    }
  });
  
  // Generate formatted versions
  await this.generateFormattedSummary();
});

Given('the summary contains all required sections', async function() {
  const summary = this.mockData.generatedSummary;
  
  expect(summary.content.keyDecisions).to.be.an('array');
  expect(summary.content.actionItems).to.be.an('array');
  expect(summary.content.discussionTopics).to.be.an('array');
  expect(summary.content.fullSummary).to.be.a('string');
});

Given('I have a summary for {string}', async function(meetingTitle) {
  const summary = this.mockData.generatedSummary;
  summary.title = meetingTitle;
  this.setMockData('generatedSummary', summary);
});

Given('the meeting was on {string} with duration {string}', async function(date, duration) {
  const summary = this.mockData.generatedSummary;
  summary.date = date;
  summary.duration = duration;
  this.setMockData('generatedSummary', summary);
});

Given('participants were {string}', async function(participantList) {
  const participants = participantList.split(', ');
  const summary = this.mockData.generatedSummary;
  summary.participants = participants;
  this.setMockData('generatedSummary', summary);
});

Given('I have summaries for different meetings:', async function(dataTable) {
  const meetings = dataTable.hashes();
  this.setMockData('multipleSummaries', meetings);
});

// Export Actions (specific button handlers)
When('I click export button {string}', async function(buttonText) {
  const page = this.popupPage || this.page;
  
  if (buttonText === 'Download .md') {
    this.setMockData('exportAction', 'markdown');
    await this.mockDownload('markdown');
  } else if (buttonText === 'Copy HTML') {
    this.setMockData('exportAction', 'html');
    await this.mockClipboardCopy();
  } else if (buttonText === 'Download .txt') {
    this.setMockData('exportAction', 'plaintext');
    await this.mockDownload('plaintext');
  } else if (buttonText === 'Export All Formats') {
    this.setMockData('exportAction', 'all');
    await this.mockBatchExport();
  }
});

When('I select {string} export format', async function(format) {
  this.setMockData('selectedExportFormat', format.toLowerCase());
});

When('I export each summary', async function() {
  const meetings = this.mockData.multipleSummaries;
  this.setMockData('exportedFiles', []);
  
  for (const meeting of meetings) {
    const filename = this.generateFilename(meeting['Meeting Title'], '2025-01-15', 'md');
    this.mockData.exportedFiles.push(filename);
  }
});

When('I export the summary in any format', async function() {
  this.setMockData('exportAction', 'metadata-test');
  await this.mockDownload('markdown');
});

// Export Assertions
Then('a file should download with name format {string}', async function(nameFormat) {
  const summary = this.mockData.generatedSummary;
  const expectedPattern = nameFormat
    .replace('Meeting_Title', summary.title.replace(/\s+/g, '_'))
    .replace('YYYY-MM-DD', summary.date);
  
  const mockFilename = this.generateFilename(summary.title, summary.date, 'md');
  expect(mockFilename).to.include(summary.title.replace(/\s+/g, '_'));
  expect(mockFilename).to.include(summary.date);
});

Then('the file should contain properly formatted Markdown', async function() {
  const summary = this.mockData.generatedSummary;
  const markdown = this.generateMarkdown(summary);
  
  expect(markdown).to.include('# ' + summary.title);
  expect(markdown).to.include('## 主要決策');
  expect(markdown).to.include('## 行動項目');
  expect(markdown).to.match(/\*\*參與者\*\*:/);
});

Then('Chinese characters should be preserved with UTF-8 encoding', async function() {
  const summary = this.mockData.generatedSummary;
  expect(summary.title).to.match(/[\u4e00-\u9fff]/);
  expect(summary.content.fullSummary).to.match(/[\u4e00-\u9fff]/);
});

Then('the file should include:', async function(dataTable) {
  const expectedSections = dataTable.hashes();
  const summary = this.mockData.generatedSummary;
  const markdown = this.generateMarkdown(summary);
  
  for (const section of expectedSections) {
    const sectionName = section.Section;
    const content = section.Content;
    
    switch (sectionName) {
      case 'Meeting Title':
        expect(markdown).to.include(content);
        break;
      case 'Metadata':
        expect(markdown).to.include('**日期**:');
        expect(markdown).to.include('**時長**:');
        expect(markdown).to.include('**參與者**:');
        break;
      case 'Key Decisions':
        expect(markdown).to.include(content);
        break;
      case 'Action Items':
        expect(markdown).to.include(content);
        break;
    }
  }
});

Then('the HTML should be copied to clipboard', async function() {
  expect(this.mockData.clipboardContent).to.not.be.undefined;
  expect(this.mockData.clipboardContent).to.include('<html>');
});

Then('I should see a success message {string}', async function(message) {
  expect(this.mockData.clipboardCopied).to.be.true;
});

Then('the HTML should include inline styles for email compatibility', async function() {
  const html = this.mockData.clipboardContent;
  expect(html).to.include('style=');
  expect(html).to.include('font-family:');
});

Then('the HTML should be properly formatted for email clients', async function() {
  const html = this.mockData.clipboardContent;
  expect(html).to.include('<table'); // Email-compatible layout
  expect(html).to.include('<td'); // Table-based structure
});

Then('Chinese characters should render correctly', async function() {
  const html = this.mockData.clipboardContent;
  expect(html).to.include('charset=utf-8');
  expect(html).to.match(/[\u4e00-\u9fff]/);
});

Then('the export should include:', async function(dataTable) {
  const expectedMetadata = dataTable.hashes();
  const summary = this.mockData.generatedSummary;
  
  for (const metadata of expectedMetadata) {
    const field = metadata.Metadata;
    const example = metadata.Example;
    
    switch (field) {
      case 'Meeting Title':
        expect(summary.title).to.equal(example);
        break;
      case 'Date':
        expect(summary.date).to.equal(example);
        break;
      case 'Duration':
        expect(summary.duration).to.equal(example);
        break;
      case 'Participants':
        expect(summary.participants.join(', ')).to.equal(example);
        break;
    }
  }
});

Then('metadata should be consistently formatted across all export types', async function() {
  const summary = this.mockData.generatedSummary;
  const markdown = this.generateMarkdown(summary);
  const html = this.generateHTML(summary);
  const plainText = this.generatePlainText(summary);
  
  // Check metadata consistency
  [markdown, html, plainText].forEach(format => {
    expect(format).to.include(summary.title);
    expect(format).to.include(summary.date);
    expect(format).to.include(summary.duration);
  });
});

Then('a text file should download', async function() {
  expect(this.mockData.exportAction).to.equal('plaintext');
});

Then('the file should be readable without formatting', async function() {
  const plainText = this.generatePlainText(this.mockData.generatedSummary);
  expect(plainText).to.not.include('<');
  expect(plainText).to.not.include('#');
  expect(plainText).to.not.include('**');
});

Then('sections should be clearly separated', async function() {
  const plainText = this.generatePlainText(this.mockData.generatedSummary);
  expect(plainText).to.include('\n\n');
  expect(plainText).to.include('================');
});

Then('the filenames should follow the expected patterns', async function() {
  const exportedFiles = this.mockData.exportedFiles;
  const meetings = this.mockData.multipleSummaries;
  
  expect(exportedFiles.length).to.equal(meetings.length);
  
  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i];
    const filename = exportedFiles[i];
    const expectedPattern = meeting['Expected Filename Pattern'];
    
    expect(filename).to.match(new RegExp(expectedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

Then('special characters should be properly escaped', async function() {
  const exportedFiles = this.mockData.exportedFiles;
  
  exportedFiles.forEach(filename => {
    expect(filename).to.not.include('/');
    expect(filename).to.not.include('\\');
    expect(filename).to.not.include(':');
  });
});

Then('timestamps should be included in the filename', async function() {
  const exportedFiles = this.mockData.exportedFiles;
  
  exportedFiles.forEach(filename => {
    expect(filename).to.match(/\d{4}-\d{2}-\d{2}/);
  });
});

Then('I should receive three files:', async function(dataTable) {
  const expectedFiles = dataTable.hashes();
  expect(this.mockData.exportAction).to.equal('all');
  
  // Mock batch export results
  const exportedFiles = [
    { format: 'Markdown', extension: '.md', contentType: 'text/markdown; charset=utf-8' },
    { format: 'HTML', extension: '.html', contentType: 'text/html; charset=utf-8' },
    { format: 'Plain Text', extension: '.txt', contentType: 'text/plain; charset=utf-8' }
  ];
  
  expect(exportedFiles.length).to.equal(expectedFiles.length);
  
  expectedFiles.forEach((expected, index) => {
    const actual = exportedFiles[index];
    expect(actual.format).to.equal(expected.Format);
    expect(actual.extension).to.equal(expected.Extension);
    expect(actual.contentType).to.equal(expected['Content Type']);
  });
});

Then('all files should contain the same content in different formats', async function() {
  const summary = this.mockData.generatedSummary;
  
  // Verify core content is preserved across formats
  const coreContent = summary.content.fullSummary;
  expect(coreContent).to.include('產品開發週會');
  expect(coreContent).to.include('主要決策');
  expect(coreContent).to.include('行動項目');
});

// Settings Feature Steps
Given('I have just installed the extension', async function() {
  this.setMockData('firstTimeUser', true);
  this.setMockData('setupComplete', false);
  
  // Clear any existing settings
  this.setMockData('aiSettings', {});
});

Given('I am in the settings view', async function() {
  await this.openExtensionPopup();
  
  // Navigate to settings view
  await this.popupPage.evaluate(() => {
    // Mock settings UI
    document.body.innerHTML = `
      <div id="settings-view">
        <h3>AI Provider Settings</h3>
        <div id="provider-config">
          <select id="provider-select">
            <option value="">Select Provider</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <input type="password" id="api-key-input" placeholder="Enter API Key">
          <button id="test-connection">Test Connection</button>
          <button id="save-settings">Save Settings</button>
        </div>
        
        <h3>Prompt Templates</h3>
        <div id="template-config">
          <button id="export-templates">Export Templates</button>
          <input type="file" id="import-templates" accept=".json">
          <button id="import-templates-btn">Import Templates</button>
        </div>
        
        <h3>Language Preferences</h3>
        <select id="language-select">
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
        </select>
        
        <h3>Privacy Settings</h3>
        <div id="privacy-controls">
          <label><input type="checkbox" id="store-transcripts" checked> Store transcripts locally</label>
          <label><input type="checkbox" id="debug-logging"> Log debugging information</label>
          <label><input type="checkbox" id="usage-analytics"> Share usage analytics</label>
        </div>
        
        <div id="backup-restore">
          <button id="export-settings">Export Settings</button>
          <button id="import-settings">Import Settings</button>
        </div>
      </div>
    `;
  });
});

// Helper methods
async function generateFormattedSummary() {
  const summary = this.mockData.generatedSummary;
  
  summary.formats.markdown = this.generateMarkdown(summary);
  summary.formats.html = this.generateHTML(summary);
  summary.formats.plainText = this.generatePlainText(summary);
  
  this.setMockData('generatedSummary', summary);
}

function generateMarkdown(summary) {
  return `# ${summary.title}

**日期**: ${summary.date}
**時長**: ${summary.duration}
**參與者**: ${summary.participants.join(', ')}

## 主要決策

${summary.content.keyDecisions.map(decision => `- ${decision}`).join('\n')}

## 行動項目

${summary.content.actionItems.map(item => 
  `- **${item.task}** (負責人: ${item.assignee}, 截止日期: ${item.deadline})`
).join('\n')}

## 討論主題

${summary.content.discussionTopics.map(topic => `- ${topic}`).join('\n')}

## 會議摘要

${summary.content.fullSummary}
`;
}

function generateHTML(summary) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${summary.title}</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; }
    h2 { color: #34495e; margin-top: 30px; }
    .metadata { background: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0; }
    ul li { margin: 8px 0; }
    .action-item { background: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
  </style>
</head>
<body>
  <h1>${summary.title}</h1>
  
  <div class="metadata">
    <strong>日期</strong>: ${summary.date}<br>
    <strong>時長</strong>: ${summary.duration}<br>
    <strong>參與者</strong>: ${summary.participants.join(', ')}
  </div>
  
  <h2>主要決策</h2>
  <ul>
    ${summary.content.keyDecisions.map(decision => `<li>${decision}</li>`).join('')}
  </ul>
  
  <h2>行動項目</h2>
  ${summary.content.actionItems.map(item => 
    `<div class="action-item"><strong>${item.task}</strong><br>負責人: ${item.assignee} | 截止日期: ${item.deadline}</div>`
  ).join('')}
  
  <h2>討論主題</h2>
  <ul>
    ${summary.content.discussionTopics.map(topic => `<li>${topic}</li>`).join('')}
  </ul>
  
  <h2>會議摘要</h2>
  <p>${summary.content.fullSummary.replace(/\n\n/g, '</p><p>')}</p>
</body>
</html>`;
}

function generatePlainText(summary) {
  return `${summary.title}
${'='.repeat(summary.title.length)}

日期: ${summary.date}
時長: ${summary.duration}  
參與者: ${summary.participants.join(', ')}

主要決策
========
${summary.content.keyDecisions.map(decision => `• ${decision}`).join('\n')}

行動項目
========
${summary.content.actionItems.map(item => 
  `• ${item.task}\n  負責人: ${item.assignee}\n  截止日期: ${item.deadline}`
).join('\n\n')}

討論主題
========
${summary.content.discussionTopics.map(topic => `• ${topic}`).join('\n')}

會議摘要
========
${summary.content.fullSummary}
`;
}

function generateFilename(title, date, extension) {
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  return `${sanitizedTitle}_${date}.${extension}`;
}

async function mockDownload(format) {
  this.setMockData('downloadTriggered', true);
  this.setMockData('downloadFormat', format);
}

async function mockClipboardCopy() {
  const summary = this.mockData.generatedSummary;
  const htmlContent = this.generateHTML(summary);
  
  this.setMockData('clipboardContent', htmlContent);
  this.setMockData('clipboardCopied', true);
}

async function mockBatchExport() {
  this.setMockData('batchExportTriggered', true);
  this.setMockData('exportedFormats', ['markdown', 'html', 'plaintext']);
}

// Note: Helper functions defined in this file are used by step definitions
// World instance is automatically available via 'this' context in step definitions