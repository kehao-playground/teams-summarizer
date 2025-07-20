/**
 * OpenAI Client Demo
 * 
 * Demonstrates the OpenAI client functionality with sample transcript data.
 * This shows how the client integrates with the transcript formatter output.
 * 
 * Usage:
 *   node examples/openai-client-demo.js
 * 
 * Note: Requires valid OpenAI API key in environment variable OPENAI_API_KEY
 */

const { OpenAIClient, DEFAULT_PROMPTS } = require('../src/api/openaiClient');

// Sample formatted transcript (output from transcriptFormatter)
const sampleFormattedTranscript = {
  metadata: {
    participants: ['王小明', '李小華', '張經理'],
    duration: '01:15:30',
    language: 'zh-tw',
    totalEntries: 234,
    startTime: '00:00:00',
    endTime: '01:15:30'
  },
  content: `[00:05:00] 王小明: 我們來討論這個季度的產品開發計畫。根據市場調研，我們需要專注在用戶體驗的改善上。

[00:05:30] 李小華: 我同意王小明的看法。特別是在移動端的使用體驗，我們收到很多用戶反饋說介面不夠直觀。

[00:06:15] 張經理: 很好的觀點。那麼我們來制定具體的行動計畫。首先，我建議我們在下週完成用戶研究報告。

[00:07:00] 王小明: 好的，我可以負責用戶研究這部分。預計需要一週時間來收集數據和分析。

[00:07:30] 李小華: 我來負責技術方案的評估。我們需要評估現有架構是否能支持新的用戶體驗改善。

[00:08:00] 張經理: 很好。那麼時程安排是：王小明負責用戶研究（一週），李小華負責技術評估（兩週），然後我們在月底前制定最終實施計畫。

[00:08:45] 王小明: 關於預算方面，我們預估需要額外投入大約20萬台幣在用戶體驗顧問和工具上。

[00:09:15] 張經理: 預算看起來合理。我會向上級申請批准。大家還有其他問題嗎？

[00:09:45] 李小華: 我想確認一下，新的用戶體驗改善是否包括無障礙功能的優化？

[00:10:00] 張經理: 非常好的問題。是的，無障礙功能應該是我們用戶體驗改善的重要組成部分。請在技術評估中一併考慮。

[00:10:30] 王小明: 了解。那我們下週三再開會檢視進度如何？

[00:10:45] 張經理: 好的，就定下週三下午2點。今天的會議就到這裡，謝謝大家。`,
  sections: [
    {
      content: '[00:05:00] 王小明: 我們來討論這個季度的產品開發計畫。根據市場調研，我們需要專注在用戶體驗的改善上。\n[00:05:30] 李小華: 我同意王小明的看法。特別是在移動端的使用體驗，我們收到很多用戶反饋說介面不夠直觀。'
    },
    {
      content: '[00:06:15] 張經理: 很好的觀點。那麼我們來制定具體的行動計畫。首先，我建議我們在下週完成用戶研究報告。\n[00:07:00] 王小明: 好的，我可以負責用戶研究這部分。預計需要一週時間來收集數據和分析。'
    },
    {
      content: '[00:07:30] 李小華: 我來負責技術方案的評估。我們需要評估現有架構是否能支持新的用戶體驗改善。\n[00:08:00] 張經理: 很好。那麼時程安排是：王小明負責用戶研究（一週），李小華負責技術評估（兩週），然後我們在月底前制定最終實施計畫。'
    }
  ]
};

// Demo functions
async function demonstrateOpenAIClient() {
  console.log('🤖 OpenAI Client Demo');
  console.log('====================\n');

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ Missing OpenAI API key');
    console.log('Please set OPENAI_API_KEY environment variable');
    console.log('Example: export OPENAI_API_KEY=sk-your-key-here\n');
    
    // Continue with offline demo
    demonstrateOfflineFeatures();
    return;
  }

  try {
    const client = new OpenAIClient();
    
    console.log('1️⃣ Initializing OpenAI Client...');
    await client.initialize(apiKey);
    console.log('✅ Client initialized successfully\n');

    console.log('2️⃣ Testing API connection...');
    const models = await client.getAvailableModels();
    console.log(`✅ Found ${models.length} available models`);
    console.log('Available models:', models.slice(0, 5).map(m => m.id).join(', '), '...\n');

    console.log('3️⃣ Analyzing sample transcript...');
    console.log('📊 Transcript metadata:');
    console.log(`   - Participants: ${sampleFormattedTranscript.metadata.participants.join(', ')}`);
    console.log(`   - Duration: ${sampleFormattedTranscript.metadata.duration}`);
    console.log(`   - Language: ${sampleFormattedTranscript.metadata.language}`);
    console.log(`   - Total entries: ${sampleFormattedTranscript.metadata.totalEntries}\n`);

    // Test token estimation
    const estimatedTokens = client.estimateTokenCount(sampleFormattedTranscript.content);
    console.log(`📏 Estimated tokens: ${estimatedTokens}`);
    console.log(`🔍 Needs chunking: ${await client.checkTokenLimits(sampleFormattedTranscript, 'gpt-4.1')}\n`);

    console.log('4️⃣ Generating summaries with different prompts...\n');

    // Test different prompt types
    const promptTypes = ['default', 'actionItems', 'technical'];
    
    for (const promptType of promptTypes) {
      console.log(`🎯 Generating ${promptType} summary...`);
      
      try {
        const summary = await client.generateSummary(sampleFormattedTranscript, {
          promptType: promptType,
          language: 'zh-TW',
          temperature: 0.3
        });

        console.log(`✅ Summary generated (${summary.metadata.usage?.total_tokens || 'unknown'} tokens)`);
        console.log(`📝 Processing time: ${summary.metadata.processingTime}ms`);
        console.log('📄 Summary preview:');
        console.log('   ', summary.summary.split('\n')[0].substring(0, 100) + '...\n');
        
      } catch (error) {
        console.log(`❌ Failed to generate ${promptType} summary:`, error.message, '\n');
      }
    }

    console.log('5️⃣ Testing multi-language support...');
    
    const languages = ['en', 'zh-TW', 'ja'];
    for (const lang of languages) {
      console.log(`🌍 Testing language: ${lang}`);
      const instruction = client.getLanguageInstruction(lang);
      console.log(`   Instruction: ${instruction}\n`);
    }

    console.log('🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Full error:', error);
  }
}

function demonstrateOfflineFeatures() {
  console.log('🔧 Offline Feature Demo');
  console.log('======================\n');

  const client = new OpenAIClient();

  console.log('1️⃣ Testing API key validation...');
  const validKey = 'sk-test1234567890abcdef1234567890abcdef123456';
  const invalidKey = 'invalid-key';
  
  console.log(`✅ Valid key format: ${client.validateApiKey(validKey)}`);
  console.log(`❌ Invalid key format: ${client.validateApiKey(invalidKey)}\n`);

  console.log('2️⃣ Testing token estimation...');
  const shortText = 'Hello world';
  const longText = sampleFormattedTranscript.content;
  
  console.log(`📏 Short text tokens: ${client.estimateTokenCount(shortText)}`);
  console.log(`📏 Long text tokens: ${client.estimateTokenCount(longText)}\n`);

  console.log('3️⃣ Testing prompt building...');
  const systemPrompt = client.buildSystemPrompt('default', null, 'zh-TW');
  console.log('🎯 System prompt preview:');
  console.log('   ', systemPrompt.split('\n')[0].substring(0, 80) + '...\n');

  console.log('4️⃣ Testing user message building...');
  const userMessage = client.buildUserMessage(sampleFormattedTranscript);
  console.log('📝 User message preview:');
  console.log('   ', userMessage.split('\n')[0] + '...\n');

  console.log('5️⃣ Testing chunking strategy...');
  const chunks = client.createBasicChunks(sampleFormattedTranscript);
  console.log(`🔪 Created ${chunks.length} chunks`);
  console.log(`📦 First chunk preview: ${chunks[0].content.substring(0, 50)}...\n`);

  console.log('6️⃣ Available prompts:');
  Object.keys(DEFAULT_PROMPTS).forEach(key => {
    console.log(`   - ${key}: ${DEFAULT_PROMPTS[key].split('\n')[0]}`);
  });

  console.log('\n🎉 Offline demo completed!');
}

// Error handling demo
function demonstrateErrorHandling() {
  console.log('\n🚨 Error Handling Demo');
  console.log('=====================\n');

  const client = new OpenAIClient();

  // Test error classification
  const errors = [
    new Error('401 Unauthorized'),
    new Error('429 Rate limit exceeded'),
    new Error('500 Internal Server Error'),
    new Error('Quota exceeded for current month')
  ];

  errors.forEach(error => {
    const shouldRetry = !client.shouldNotRetry(error);
    console.log(`🔍 Error: ${error.message}`);
    console.log(`   Should retry: ${shouldRetry ? '✅' : '❌'}\n`);
  });

  // Test detailed error creation
  const originalError = new Error('Sample error');
  const detailedError = client.createDetailedError(originalError);
  console.log('📋 Detailed error structure:');
  console.log(`   Name: ${detailedError.name}`);
  console.log(`   Message: ${detailedError.message}`);
  console.log(`   Timestamp: ${detailedError.timestamp}`);
  console.log(`   Has original error: ${!!detailedError.originalError}\n`);
}

// Integration demo
function demonstrateIntegration() {
  console.log('\n🔗 Integration Demo');
  console.log('==================\n');

  console.log('📋 This demo shows how OpenAI Client integrates with:');
  console.log('   - Transcript Formatter (provides formatted input)');
  console.log('   - Storage Manager (provides API keys)');
  console.log('   - Popup UI (receives summary output)');
  console.log('   - Background Service Worker (orchestrates the flow)\n');

  console.log('🔄 Typical workflow:');
  console.log('   1. User clicks "Generate Summary" in popup');
  console.log('   2. Popup requests API key from Storage Manager');
  console.log('   3. Background worker initializes OpenAI Client');
  console.log('   4. Client receives formatted transcript');
  console.log('   5. Client calls OpenAI API with appropriate prompt');
  console.log('   6. Generated summary returned to popup for display\n');

  console.log('⚙️ Configuration options:');
  console.log('   - Prompt type: default, actionItems, technical, custom');
  console.log('   - Output language: en, zh-TW, zh-CN, ja, ko, es, fr, de');
  console.log('   - Model: gpt-4.1 (default), gpt-4, gpt-3.5-turbo');
  console.log('   - Temperature: 0.0-1.0 (default: 0.3)');
  console.log('   - Max tokens: up to 32,768 for output\n');
}

// Performance testing demo
async function demonstratePerformance() {
  console.log('\n⚡ Performance Demo');
  console.log('==================\n');

  const client = new OpenAIClient();

  console.log('📊 Context window comparison:');
  console.log('   - GPT-4.1: 1,047,576 tokens (1M+)');
  console.log('   - GPT-4: 128,000 tokens');
  console.log('   - GPT-3.5-turbo: 16,385 tokens\n');

  console.log('🔍 Chunking analysis for sample transcript:');
  const estimatedTokens = client.estimateTokenCount(sampleFormattedTranscript.content);
  console.log(`   Estimated tokens: ${estimatedTokens}`);
  
  const models = ['gpt-4.1', 'gpt-4', 'gpt-3.5-turbo'];
  for (const model of models) {
    const needsChunking = await client.checkTokenLimits(sampleFormattedTranscript, model);
    console.log(`   ${model}: ${needsChunking ? 'Needs chunking' : 'Single request'}`);
  }

  console.log('\n⏱️ Rate limiting:');
  console.log('   - Exponential backoff on failures');
  console.log('   - Respects rate limit headers');
  console.log('   - Maximum 3 retries per request');
  console.log('   - 60 second timeout per request\n');
}

// Main demo runner
async function runDemo() {
  console.clear();
  console.log('🚀 Teams Transcript Extension - OpenAI Client Demo\n');

  await demonstrateOpenAIClient();
  demonstrateOfflineFeatures();
  demonstrateErrorHandling();
  demonstrateIntegration();
  await demonstratePerformance();

  console.log('\n📚 Next steps:');
  console.log('   - Run unit tests: npm test -- openaiClient.test.js');
  console.log('   - Set OPENAI_API_KEY to test live API calls');
  console.log('   - Check Task 9 for Claude integration');
  console.log('   - See design.md for full integration details\n');
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = {
  demonstrateOpenAIClient,
  demonstrateOfflineFeatures,
  sampleFormattedTranscript
};