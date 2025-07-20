/**
 * Export Manager Demo
 * 
 * Demonstrates the export functionality with sample summary data.
 * Shows how different export formats work and their features.
 * 
 * Usage:
 *   node examples/export-manager-demo.js
 */

const { ExportManager, EXPORT_FORMATS } = require('../src/export/exportManager');

// Sample summary data (output from AI clients)
const sampleSummaryData = {
  summary: `# Meeting Summary

## Key Discussion Points
- **Product Roadmap Q2**: Discussed upcoming features and prioritization
- **Budget Allocation**: Reviewed Q2 budget and approved additional $50K for development
- **Team Expansion**: Agreed to hire 2 new developers by end of March
- **Performance Metrics**: Current user engagement up 25% from last quarter

## Decisions Made
- ✅ Approved Q2 budget increase of $50,000
- ✅ Extended mobile app development timeline by 3 weeks
- ✅ Implemented new code review process
- ✅ Scheduled weekly stakeholder updates

## Action Items
- **John Smith**: Update project timeline and share with team (Due: Friday)
- **Sarah Johnson**: Prepare detailed budget breakdown (Due: Monday)
- **Mike Chen**: Research new development tools (Due: Next Friday)
- **Lisa Wong**: Schedule follow-up meeting with stakeholders (Due: Tomorrow)

## Follow-up Required
- Review competitor analysis findings
- Finalize Q2 OKRs with leadership team
- Assess impact of timeline changes on Q3 planning`,

  metadata: {
    title: 'Q2 Product Planning Meeting',
    participants: ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Wong', 'David Park'],
    duration: '01:45:30',
    language: 'en',
    totalEntries: 234,
    generatedAt: '2024-01-15T14:30:00.000Z',
    model: 'gpt-4.1',
    usage: {
      total_tokens: 3250,
      prompt_tokens: 2800,
      completion_tokens: 450
    },
    processingTime: 4200
  }
};

// Chinese meeting sample
const chineseSummaryData = {
  summary: `# 會議摘要

## 主要討論要點
- **產品開發進度**: 討論了Q2的功能開發計畫和優先級
- **預算分配**: 審查了Q2預算並批准額外的50萬台幣開發費用
- **團隊擴編**: 同意在3月底前招聘2名新開發人員
- **績效指標**: 當前用戶參與度比上季度增長25%

## 已做決定
- ✅ 批准Q2預算增加50萬台幣
- ✅ 行動應用開發時程延長3週
- ✅ 實施新的代碼審查流程
- ✅ 安排每週利害關係人更新會議

## 行動項目
- **王小明**: 更新專案時程並與團隊分享 (截止日期：週五)
- **李小華**: 準備詳細預算明細 (截止日期：週一)
- **陳大偉**: 研究新開發工具 (截止日期：下週五)
- **黃美玲**: 安排與利害關係人的後續會議 (截止日期：明天)

## 需要後續追蹤
- 審查競爭對手分析結果
- 與領導團隊確定Q2 OKR
- 評估時程變更對Q3規劃的影響`,

  metadata: {
    title: 'Q2產品規劃會議',
    participants: ['王小明', '李小華', '陳大偉', '黃美玲', '林志強'],
    duration: '01:45:30',
    language: 'zh-TW',
    totalEntries: 234,
    generatedAt: '2024-01-15T14:30:00.000Z',
    model: 'claude-3-5-sonnet-20241022',
    usage: {
      input_tokens: 2800,
      output_tokens: 450
    },
    processingTime: 3800
  }
};

// Demo functions
async function demonstrateExportManager() {
  console.log('📄 Export Manager Demo');
  console.log('=====================\n');

  const exportManager = new ExportManager();

  console.log('1️⃣ Available Export Formats:');
  const formats = exportManager.getSupportedFormats();
  formats.forEach(format => {
    console.log(`   - ${format.name} (${format.id}): ${format.description}`);
    console.log(`     Extension: ${format.extension}, MIME: ${format.mimeType}`);
  });
  console.log('');

  console.log('2️⃣ Testing Export Formats:\n');

  // Test all formats with English content
  for (const format of [EXPORT_FORMATS.MARKDOWN, EXPORT_FORMATS.HTML, EXPORT_FORMATS.TEXT]) {
    console.log(`🔄 Exporting in ${format.toUpperCase()} format...`);
    
    try {
      const result = await exportManager.exportSummary(sampleSummaryData, format, {
        includeMetadata: true,
        includeBranding: true,
        timestampFormat: 'local'
      });

      console.log(`✅ Export successful:`);
      console.log(`   📝 Filename: ${result.filename}`);
      console.log(`   📊 Content size: ${result.size.toLocaleString()} characters`);
      console.log(`   🕒 Generated at: ${result.generatedAt}`);
      console.log(`   📄 Content preview:`);
      
      // Show first 150 characters
      const preview = result.content.substring(0, 150).replace(/\n/g, '\\n');
      console.log(`      ${preview}...`);
      console.log('');

    } catch (error) {
      console.log(`❌ Export failed: ${error.message}\n`);
    }
  }
}

async function demonstrateCustomOptions() {
  console.log('⚙️ Custom Export Options Demo');
  console.log('=============================\n');

  const exportManager = new ExportManager();

  console.log('1️⃣ Testing different metadata options:\n');

  const testOptions = [
    { name: 'Full metadata', options: { includeMetadata: true, includeBranding: true } },
    { name: 'No metadata', options: { includeMetadata: false, includeBranding: true } },
    { name: 'No branding', options: { includeMetadata: true, includeBranding: false } },
    { name: 'Minimal export', options: { includeMetadata: false, includeBranding: false } }
  ];

  for (const test of testOptions) {
    console.log(`🧪 Testing: ${test.name}`);
    
    const result = await exportManager.exportSummary(
      sampleSummaryData, 
      EXPORT_FORMATS.MARKDOWN, 
      test.options
    );
    
    console.log(`   Size: ${result.size} characters`);
    console.log(`   Contains metadata: ${result.content.includes('Meeting Information')}`);
    console.log(`   Contains branding: ${result.content.includes('Teams Transcript Extension')}`);
    console.log('');
  }

  console.log('2️⃣ Testing timestamp formats:\n');

  const timestampFormats = ['iso', 'local', 'short'];
  for (const format of timestampFormats) {
    console.log(`📅 Testing timestamp format: ${format}`);
    
    const result = await exportManager.exportSummary(
      sampleSummaryData, 
      EXPORT_FORMATS.MARKDOWN, 
      { timestampFormat: format }
    );
    
    const timestampMatch = result.content.match(/Summary Generated:\*\* (.+)/);
    if (timestampMatch) {
      console.log(`   Result: ${timestampMatch[1]}`);
    }
    console.log('');
  }
}

async function demonstrateMultiLanguage() {
  console.log('🌍 Multi-Language Export Demo');
  console.log('=============================\n');

  const exportManager = new ExportManager();

  console.log('1️⃣ English Meeting Export:\n');
  
  const englishResult = await exportManager.exportSummary(
    sampleSummaryData, 
    EXPORT_FORMATS.HTML, 
    { includeMetadata: true }
  );
  
  console.log(`📝 Filename: ${englishResult.filename}`);
  console.log(`🔤 Language: ${sampleSummaryData.metadata.language}`);
  console.log(`👥 Participants: ${sampleSummaryData.metadata.participants.join(', ')}`);
  console.log(`📊 Size: ${englishResult.size.toLocaleString()} characters\n`);

  console.log('2️⃣ Chinese Meeting Export:\n');
  
  const chineseResult = await exportManager.exportSummary(
    chineseSummaryData, 
    EXPORT_FORMATS.HTML, 
    { includeMetadata: true }
  );
  
  console.log(`📝 Filename: ${chineseResult.filename}`);
  console.log(`🔤 Language: ${chineseSummaryData.metadata.language}`);
  console.log(`👥 Participants: ${chineseSummaryData.metadata.participants.join(', ')}`);
  console.log(`📊 Size: ${chineseResult.size.toLocaleString()} characters`);
  
  // Show Chinese content preview
  const chinesePreview = chineseResult.content.substring(0, 200);
  console.log(`📄 Content preview:\n${chinesePreview}...\n`);
}

async function demonstrateFilenameGeneration() {
  console.log('📁 Filename Generation Demo');
  console.log('===========================\n');

  const exportManager = new ExportManager();

  const testCases = [
    {
      name: 'Normal meeting title',
      data: { metadata: { title: 'Weekly Team Standup' } }
    },
    {
      name: 'Title with special characters',
      data: { metadata: { title: 'Q2 Planning: Budget & Timeline Review!' } }
    },
    {
      name: 'Very long title',
      data: { metadata: { title: 'Very Long Meeting Title That Exceeds Normal Length Limits For File Systems' } }
    },
    {
      name: 'Missing title',
      data: { metadata: {} }
    },
    {
      name: 'Chinese title',
      data: { metadata: { title: '第二季產品規劃會議：預算與時程檢討' } }
    }
  ];

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name}`);
    
    for (const format of Object.values(EXPORT_FORMATS)) {
      const filename = exportManager.generateFilename(testCase.data, format, {});
      console.log(`   ${format}: ${filename}`);
    }
    
    // Test with timestamp
    const filenameWithTimestamp = exportManager.generateFilename(
      testCase.data, 
      EXPORT_FORMATS.MARKDOWN, 
      { includeTimestamp: true }
    );
    console.log(`   with timestamp: ${filenameWithTimestamp}`);
    console.log('');
  }
}

async function demonstrateErrorHandling() {
  console.log('🚨 Error Handling Demo');
  console.log('======================\n');

  const exportManager = new ExportManager();

  console.log('1️⃣ Testing invalid format:\n');
  try {
    await exportManager.exportSummary(sampleSummaryData, 'invalid-format');
  } catch (error) {
    console.log(`✅ Caught expected error: ${error.message}\n`);
  }

  console.log('2️⃣ Testing missing summary data:\n');
  try {
    await exportManager.exportSummary(null);
  } catch (error) {
    console.log(`✅ Caught expected error: ${error.message}\n`);
  }

  console.log('3️⃣ Testing invalid summary structure:\n');
  try {
    await exportManager.exportSummary({ metadata: {} }); // Missing summary
  } catch (error) {
    console.log(`✅ Caught expected error: ${error.message}\n`);
  }

  console.log('4️⃣ Testing edge case - empty summary:\n');
  try {
    const result = await exportManager.exportSummary({
      summary: '',
      metadata: { title: 'Empty Meeting' }
    });
    console.log(`✅ Handled gracefully: filename = ${result.filename}, size = ${result.size}\n`);
  } catch (error) {
    console.log(`❌ Unexpected error: ${error.message}\n`);
  }
}

async function demonstrateHelperMethods() {
  console.log('🔧 Helper Methods Demo');
  console.log('======================\n');

  const exportManager = new ExportManager();

  console.log('1️⃣ Testing filename sanitization:\n');
  const testFilenames = [
    'Normal Meeting Name',
    'Meeting <Title>: Q2/Q3 "Planning" & Review*',
    '   Spaces   Everywhere   ',
    'Very Long Meeting Title That Should Be Truncated Because It Exceeds Length Limits'
  ];

  testFilenames.forEach(filename => {
    const sanitized = exportManager.sanitizeFilename(filename);
    console.log(`   "${filename}" → "${sanitized}"`);
  });
  console.log('');

  console.log('2️⃣ Testing HTML escaping:\n');
  const testHtml = [
    'Normal text',
    '<script>alert("xss")</script>',
    'Text with & ampersands',
    'Quotes "double" and \'single\''
  ];

  testHtml.forEach(text => {
    const escaped = exportManager.escapeHtml(text);
    console.log(`   "${text}" → "${escaped}"`);
  });
  console.log('');

  console.log('3️⃣ Testing meeting title extraction:\n');
  const testMetadata = [
    { title: 'Direct title field' },
    { meetingTitle: 'Meeting title field' },
    { subject: 'Subject field' },
    { name: 'Name field' },
    {}
  ];

  testMetadata.forEach((metadata, index) => {
    const title = exportManager.extractMeetingTitle(metadata);
    console.log(`   Case ${index + 1}: ${JSON.stringify(metadata)} → "${title}"`);
  });
  console.log('');
}

async function demonstrateIntegration() {
  console.log('🔗 Integration Demo');
  console.log('==================\n');

  console.log('📋 Export Manager Integration Points:');
  console.log('   - Receives summary data from OpenAI/Anthropic clients');
  console.log('   - Integrates with popup UI for download/copy actions');
  console.log('   - Works with Chrome storage for export preferences');
  console.log('   - Supports different languages from transcript formatter\n');

  console.log('🔄 Typical Export Workflow:');
  console.log('   1. AI client generates summary with metadata');
  console.log('   2. User selects export format in popup UI');
  console.log('   3. Export manager processes summary data');
  console.log('   4. User downloads file or copies to clipboard');
  console.log('   5. Export preferences saved for next time\n');

  console.log('⚙️ Export Configuration Options:');
  console.log('   - Format: Markdown, HTML, Plain Text');
  console.log('   - Metadata inclusion: Full, Partial, None');
  console.log('   - Branding: Include/exclude extension branding');
  console.log('   - Timestamp format: ISO, Local, Short');
  console.log('   - Filename options: Auto-generated or custom\n');
}

async function demonstratePerformance() {
  console.log('⚡ Performance Demo');
  console.log('==================\n');

  const exportManager = new ExportManager();

  console.log('📊 Performance Testing with Different Content Sizes:\n');

  const contentSizes = [
    { name: 'Small', content: 'Short meeting summary. '.repeat(10) },
    { name: 'Medium', content: 'Medium length meeting summary with more details. '.repeat(100) },
    { name: 'Large', content: 'Very detailed meeting summary with extensive content. '.repeat(1000) }
  ];

  for (const size of contentSizes) {
    const testData = {
      summary: size.content,
      metadata: sampleSummaryData.metadata
    };

    console.log(`🧪 Testing ${size.name} content (${size.content.length} chars):`);

    const startTime = Date.now();
    const results = await Promise.all([
      exportManager.exportSummary(testData, EXPORT_FORMATS.MARKDOWN),
      exportManager.exportSummary(testData, EXPORT_FORMATS.HTML),
      exportManager.exportSummary(testData, EXPORT_FORMATS.TEXT)
    ]);
    const endTime = Date.now();

    console.log(`   Processing time: ${endTime - startTime}ms`);
    console.log(`   Output sizes: MD=${results[0].size}, HTML=${results[1].size}, TXT=${results[2].size}`);
    console.log('');
  }

  console.log('💾 Memory Usage Considerations:');
  console.log('   - All export formats generated in memory');
  console.log('   - Large meetings (>1MB) may need chunking');
  console.log('   - HTML format typically 2-3x larger than Markdown');
  console.log('   - Text format most compact but less structured\n');
}

// Main demo runner
async function runDemo() {
  console.clear();
  console.log('🚀 Teams Transcript Extension - Export Manager Demo\n');

  try {
    await demonstrateExportManager();
    await demonstrateCustomOptions();
    await demonstrateMultiLanguage();
    await demonstrateFilenameGeneration();
    await demonstrateErrorHandling();
    await demonstrateHelperMethods();
    await demonstrateIntegration();
    await demonstratePerformance();

    console.log('📚 Next Steps:');
    console.log('   - Run unit tests: npm test -- exportManager.test.js');
    console.log('   - Test with real summary data from AI clients');
    console.log('   - Integrate with popup UI for user interactions');
    console.log('   - Configure export preferences in settings');
    console.log('   - See Task 11 for prompt template system\n');

    console.log('🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Full error:', error);
  }
}

// Export for use in other demos
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = {
  demonstrateExportManager,
  demonstrateCustomOptions,
  demonstrateMultiLanguage,
  sampleSummaryData,
  chineseSummaryData
};