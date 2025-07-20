/**
 * Chunking Strategy Demonstration
 * 
 * This demo shows how the advanced chunking strategy handles large transcripts
 * with different scenarios and providers.
 */

// Import the chunking strategy
const { ChunkingStrategy, CHUNKING_STRATEGIES, PROVIDER_LIMITS } = require('../src/utils/chunkingStrategy.js');

// Create demo transcript data
function createDemoTranscript(sizeCategory = 'large') {
    const baseSections = [
        {
            speaker: '王經理',
            startTime: '00:00:00',
            endTime: '00:03:15',
            text: '大家早安，歡迎參加今天的產品規劃會議。今天我們要討論Q2的產品開發策略，包括新功能的優先級排序、技術架構決策，以及市場推廣計畫。首先請各部門報告目前的進度狀況。',
            confidence: 0.95
        },
        {
            speaker: '張開發',
            startTime: '00:03:16',
            endTime: '00:08:45',
            text: '謝謝經理。開發部這邊的進度報告如下：用戶認證系統已經完成並通過測試，目前正在進行API安全性強化。資料庫優化的部分，我們採用了新的索引策略，查詢效能提升了約40%。接下來會專注在前端介面的重構和移動端適配。',
            confidence: 0.92
        },
        {
            speaker: '李設計',
            startTime: '00:08:46',
            endTime: '00:13:20',
            text: '設計團隊這邊已經完成了新版UI設計稿，使用者體驗測試結果很正面。我們重新設計了導航結構，簡化了操作流程，預計可以提升30%的用戶留存率。另外，我們也完成了深色模式的設計，符合現代用戶的使用習慣。',
            confidence: 0.89
        },
        {
            speaker: '陳測試',
            startTime: '00:13:21',
            endTime: '00:18:10',
            text: '測試部門的報告：我們已經建立了自動化測試流程，包括單元測試、整合測試和端對端測試。測試覆蓋率達到85%，符合公司標準。目前正在進行性能測試，發現幾個瓶頸點，已經與開發團隊協調解決方案。',
            confidence: 0.91
        },
        {
            speaker: '黃行銷',
            startTime: '00:18:11',
            endTime: '00:24:30',
            text: '行銷團隊的市場分析顯示，我們的目標客群對新功能需求很高，特別是社交分享和個性化推薦功能。競品分析也完成了，我們在技術創新方面有明顯優勢。建議加快產品上市時程，搶佔市場先機。',
            confidence: 0.88
        }
    ];

    // Extend for different sizes
    let sections = [...baseSections];
    let duration = '00:24:30';
    let totalEntries = baseSections.length;

    if (sizeCategory === 'medium') {
        // Duplicate sections with time adjustments for medium size
        const additionalSections = baseSections.map((section, index) => ({
            ...section,
            startTime: addTimeToTimestamp(section.startTime, 25 * 60), // Add 25 minutes
            endTime: addTimeToTimestamp(section.endTime, 25 * 60),
            text: section.text + ' 接下來我們深入討論技術細節和實作方案。' + section.text.substring(0, 100) + '...'
        }));
        sections = [...sections, ...additionalSections];
        duration = '00:49:00';
        totalEntries = sections.length;
    } else if (sizeCategory === 'large') {
        // Create many sections for large transcript
        for (let i = 0; i < 20; i++) {
            const cycleStartMin = (i + 1) * 25;
            const cycleSections = baseSections.map((section, sIndex) => ({
                ...section,
                speaker: `${section.speaker}_${i + 1}`,
                startTime: addTimeToTimestamp(section.startTime, cycleStartMin * 60),
                endTime: addTimeToTimestamp(section.endTime, cycleStartMin * 60),
                text: `[第${i + 1}輪討論] ${section.text} 在這個階段，我們需要更深入地分析各種可能的解決方案，考慮技術可行性、成本效益、時程安排等因素。` + 'A'.repeat(500 + Math.random() * 1000)
            }));
            sections = [...sections, ...cycleSections];
        }
        duration = '08:45:30';
        totalEntries = sections.length;
    }

    const content = sections.map(section => 
        `[${section.startTime}] ${section.speaker}: ${section.text}`
    ).join('\n');

    return {
        metadata: {
            participants: [...new Set(sections.map(s => s.speaker))],
            duration,
            language: 'zh-tw',
            totalEntries,
            startTime: sections[0].startTime,
            endTime: sections[sections.length - 1].endTime
        },
        content,
        sections
    };
}

function addTimeToTimestamp(timestamp, secondsToAdd) {
    const parts = timestamp.split(':');
    const totalSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + secondsToAdd;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Mock AI function for demonstration
async function mockAIFunction(transcript, options = {}) {
    const delay = Math.random() * 1000 + 500; // Random delay 0.5-1.5s
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const isChunk = options.isChunk;
    const chunkIndex = options.chunkIndex || 0;
    
    if (options.isCombinung) {
        return {
            summary: `## 會議總結\n\n這是一個${options.totalSections}個段落的綜合會議摘要。會議涵蓋了產品開發、設計、測試和行銷等多個面向的討論。\n\n## 主要決策\n- 加快產品開發進度\n- 強化用戶體驗設計\n- 提升測試覆蓋率\n\n## 後續行動\n- 技術架構優化\n- 市場推廣準備\n- 跨部門協作強化`,
            metadata: {
                generatedAt: new Date().toISOString(),
                model: options.model || 'gpt-4.1',
                processingTime: delay,
                usage: { total_tokens: 1500 + Math.floor(Math.random() * 500) }
            }
        };
    }
    
    const summaryContent = isChunk 
        ? `## 會議段落 ${chunkIndex + 1} 摘要\n\n此段落討論了${transcript.metadata.participants.join('、')}等參與者的報告內容。主要涵蓋了技術開發進度、設計優化方案以及市場策略調整等議題。\n\n### 關鍵要點\n- 開發進度符合預期\n- 設計改善獲得正面反饋\n- 市場機會值得把握\n\n### 後續追蹤\n- 技術細節確認\n- 時程安排調整\n- 資源配置優化`
        : `## 完整會議摘要\n\n這場會議討論了Q2產品開發的各個面向，包括技術實作、設計優化、測試流程和市場策略。各部門都提出了具體的進度報告和改善建議。\n\n### 主要成果\n- 用戶認證系統完成\n- UI設計獲得正面評價\n- 測試覆蓋率達標\n- 市場分析完整\n\n### 決策事項\n- 加快開發時程\n- 優化用戶體驗\n- 強化市場推廣\n\n### 行動計畫\n- 技術優化持續進行\n- 設計細節最終確認\n- 測試流程完善\n- 行銷策略執行`;

    return {
        summary: summaryContent,
        metadata: {
            generatedAt: new Date().toISOString(),
            model: options.model || 'gpt-4.1',
            processingTime: delay,
            usage: { total_tokens: 800 + Math.floor(Math.random() * 400) },
            chunkInfo: isChunk ? {
                chunkIndex,
                totalChunks: options.totalChunks,
                timeRange: transcript.metadata.startTime + ' - ' + transcript.metadata.endTime
            } : undefined
        }
    };
}

// Demonstration scenarios
async function runDemonstrations() {
    console.log('🚀 Teams Transcript Chunking Strategy Demonstration\n');
    console.log('=' * 60);

    const strategy = new ChunkingStrategy();

    // Scenario 1: Small transcript (no chunking needed)
    console.log('\n📋 Scenario 1: Small Transcript Analysis');
    console.log('-' * 40);
    
    const smallTranscript = createDemoTranscript('small');
    console.log(`Transcript size: ${smallTranscript.metadata.duration}`);
    console.log(`Participants: ${smallTranscript.metadata.participants.length}`);
    console.log(`Content length: ${smallTranscript.content.length} characters`);
    
    const smallAnalysis = strategy.analyzeChunkingNeeds(smallTranscript, 'openai', 'gpt-4.1');
    console.log(`Token estimate: ${smallAnalysis.tokenCount}`);
    console.log(`Needs chunking: ${smallAnalysis.needsChunking}`);
    console.log(`Complexity: ${smallAnalysis.complexity}`);
    console.log(`Recommended strategy: ${smallAnalysis.recommendedStrategy}`);

    // Scenario 2: Large transcript with different strategies
    console.log('\n📋 Scenario 2: Large Transcript with Multiple Strategies');
    console.log('-' * 40);
    
    const largeTranscript = createDemoTranscript('large');
    console.log(`Transcript size: ${largeTranscript.metadata.duration}`);
    console.log(`Participants: ${largeTranscript.metadata.participants.length}`);
    console.log(`Content length: ${largeTranscript.content.length} characters`);
    console.log(`Sections: ${largeTranscript.sections.length}`);
    
    const largeAnalysis = strategy.analyzeChunkingNeeds(largeTranscript, 'openai', 'gpt-4.1');
    console.log(`Token estimate: ${largeAnalysis.tokenCount}`);
    console.log(`Context limit: ${largeAnalysis.contextLimit}`);
    console.log(`Needs chunking: ${largeAnalysis.needsChunking}`);
    console.log(`Estimated chunks: ${largeAnalysis.estimatedChunks}`);
    console.log(`Complexity: ${largeAnalysis.complexity}`);

    // Test different chunking strategies
    console.log('\n🔧 Testing Different Chunking Strategies:');
    
    for (const [strategyName, strategyValue] of Object.entries(CHUNKING_STRATEGIES)) {
        console.log(`\n  ${strategyName}: `, );
        const chunks = strategy.chunkTranscript(largeTranscript, {
            strategy: strategyValue,
            provider: 'openai',
            model: 'gpt-4.1'
        });
        
        console.log(`    Chunks created: ${chunks.length}`);
        console.log(`    Avg chunk size: ${Math.round(chunks.reduce((sum, c) => sum + strategy.estimateTokenCount(c.content), 0) / chunks.length)} tokens`);
        console.log(`    Time ranges: ${chunks[0]?.metadata?.timeRange?.start} → ${chunks[chunks.length-1]?.metadata?.timeRange?.end}`);
    }

    // Scenario 3: Provider comparison
    console.log('\n📋 Scenario 3: Provider Comparison');
    console.log('-' * 40);
    
    const providers = [
        { name: 'OpenAI GPT-4.1', provider: 'openai', model: 'gpt-4.1' },
        { name: 'Claude Sonnet 4', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }
    ];
    
    providers.forEach(config => {
        const analysis = strategy.analyzeChunkingNeeds(largeTranscript, config.provider, config.model);
        console.log(`\n  ${config.name}:`);
        console.log(`    Context limit: ${analysis.contextLimit.toLocaleString()} tokens`);
        console.log(`    Safe limit: ${analysis.safeLimit.toLocaleString()} tokens`);
        console.log(`    Needs chunking: ${analysis.needsChunking}`);
        console.log(`    Estimated chunks: ${analysis.estimatedChunks}`);
    });

    // Scenario 4: Full processing with progress tracking
    console.log('\n📋 Scenario 4: Full Processing with Progress Tracking');
    console.log('-' * 40);
    
    console.log('Processing large transcript with hybrid strategy...');
    
    const progressUpdates = [];
    const progressCallback = (update) => {
        progressUpdates.push(update);
        const percent = Math.round((update.current / update.total) * 100);
        console.log(`  [${percent}%] ${update.stage}: ${update.message}`);
        
        if (update.chunkInfo) {
            console.log(`    └─ Chunk: ${update.chunkInfo.timeRange}, Speakers: ${update.chunkInfo.speakers.join(', ')}, Tokens: ${update.chunkInfo.tokenCount}`);
        }
    };

    try {
        const result = await strategy.processLargeTranscript(
            largeTranscript,
            mockAIFunction,
            {
                provider: 'openai',
                model: 'gpt-4.1',
                strategy: CHUNKING_STRATEGIES.HYBRID,
                language: 'zh-TW'
            },
            progressCallback
        );

        console.log('\n✅ Processing Complete!');
        console.log(`Processing method: ${result.metadata.processingMethod}`);
        console.log(`Chunks processed: ${result.metadata.chunksProcessed}`);
        console.log(`Chunks failed: ${result.metadata.chunksFailed}`);
        console.log(`Total tokens: ${result.metadata.chunkingSummary.totalTokens.toLocaleString()}`);
        console.log(`Average chunk size: ${result.metadata.chunkingSummary.avgChunkSize} tokens`);
        
        console.log('\n📄 Final Summary Preview:');
        console.log(result.summary.substring(0, 300) + '...');
        
        console.log('\n📊 Chunk Details:');
        result.chunkDetails.forEach((detail, index) => {
            console.log(`  Chunk ${index + 1}: ${detail.timeRange.start}-${detail.timeRange.end}, ${detail.tokenCount} tokens, Success: ${detail.success}`);
        });

    } catch (error) {
        console.error('❌ Processing failed:', error.message);
    }

    // Scenario 5: Performance characteristics
    console.log('\n📋 Scenario 5: Performance Characteristics');
    console.log('-' * 40);
    
    console.log('Testing performance with different transcript sizes...');
    
    const sizes = ['small', 'medium', 'large'];
    for (const size of sizes) {
        const transcript = createDemoTranscript(size);
        const startTime = Date.now();
        
        const analysis = strategy.analyzeChunkingNeeds(transcript, 'openai', 'gpt-4.1');
        if (analysis.needsChunking) {
            strategy.chunkTranscript(transcript, {
                provider: 'openai',
                model: 'gpt-4.1',
                strategy: CHUNKING_STRATEGIES.HYBRID
            });
        }
        
        const endTime = Date.now();
        console.log(`  ${size.padEnd(6)}: ${transcript.content.length.toString().padStart(8)} chars, ${(endTime - startTime).toString().padStart(4)}ms`);
    }

    console.log('\n🎉 Demonstration Complete!');
    console.log('\nKey Features Demonstrated:');
    console.log('• Intelligent chunking need detection');
    console.log('• Multiple chunking strategies (speaker turns, time-based, semantic, hybrid)');
    console.log('• Provider-specific optimizations (OpenAI vs Claude)');
    console.log('• Context overlap for better continuity');
    console.log('• Progress tracking for large transcripts');
    console.log('• Error handling and recovery');
    console.log('• Performance optimization');
    console.log('• Comprehensive metadata enrichment');
}

// Run the demonstration
if (require.main === module) {
    runDemonstrations().catch(console.error);
}

module.exports = {
    createDemoTranscript,
    mockAIFunction,
    runDemonstrations
};