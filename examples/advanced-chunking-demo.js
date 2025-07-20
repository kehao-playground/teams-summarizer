/**
 * Advanced Chunking Demo with Forced Large Transcript
 * 
 * This demo creates a truly large transcript that will trigger chunking
 * to demonstrate the advanced chunking strategy in action.
 */

const { ChunkingStrategy, CHUNKING_STRATEGIES } = require('../src/utils/chunkingStrategy.js');

// Create a massive transcript that will definitely need chunking
function createMassiveTranscript() {
    const speakers = ['Alice技術長', 'Bob專案經理', 'Charlie開發', 'Diana設計', 'Eve測試', 'Frank行銷'];
    const sections = [];
    
    const topics = [
        '系統架構設計討論',
        '後端API開發進度報告',
        '前端介面設計評估',
        '資料庫效能優化',
        '使用者體驗測試結果',
        '市場推廣策略規劃',
        '安全性檢查報告',
        '專案時程調整討論',
        '跨部門協作流程',
        '技術債務處理計畫'
    ];
    
    // Create 500 sections with substantial content
    for (let i = 0; i < 500; i++) {
        const speaker = speakers[i % speakers.length];
        const topic = topics[i % topics.length];
        const minutes = Math.floor(i * 0.5);
        const seconds = (i * 30) % 60;
        const startTime = `${Math.floor(minutes/60).toString().padStart(2, '0')}:${(minutes%60).toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const endTime = `${Math.floor((minutes+1)/60).toString().padStart(2, '0')}:${((minutes+1)%60).toString().padStart(2, '0')}:${((seconds+30)%60).toString().padStart(2, '0')}`;
        
        // Generate substantial content for each section
        const baseContent = `關於${topic}，我想分享以下幾個重點：`;
        const detailedContent = `
首先，從技術角度來看，我們需要考慮的因素包括系統的可擴展性、維護性和安全性。這些因素會直接影響到我們的開發效率和產品品質。

其次，我們必須評估當前的資源配置是否足夠支持這個計畫。包括人力資源、技術資源、時間資源等各個方面的考量都非常重要。

第三，我建議我們採用敏捷開發的方法，透過短期迭代來快速驗證我們的假設和方案。這樣可以降低風險，同時提高交付品質。

另外，跨部門的溝通協調也是成功的關鍵因素。我們需要建立有效的溝通機制，確保資訊透明，避免重複工作。

最後，關於時程安排，我認為我們應該要保留一定的緩衝時間，以應對可能出現的技術困難或需求變更。同時也要定期檢視進度，必要時調整策略。

以上是我對${topic}的初步想法，歡迎大家提出意見和建議。我們可以進一步討論具體的實施細節和分工安排。
        `.repeat(3); // Repeat to make it really large
        
        sections.push({
            speaker,
            startTime,
            endTime,
            text: baseContent + detailedContent,
            confidence: 0.85 + Math.random() * 0.15
        });
    }
    
    const content = sections.map(section => 
        `[${section.startTime}] ${section.speaker}: ${section.text}`
    ).join('\n');
    
    return {
        metadata: {
            participants: speakers,
            duration: '04:10:00',
            language: 'zh-tw',
            totalEntries: sections.length,
            startTime: sections[0].startTime,
            endTime: sections[sections.length - 1].endTime
        },
        content,
        sections
    };
}

// Mock AI function that simulates processing
async function mockAIProcessor(transcript, options = {}) {
    const delay = 200 + Math.random() * 300; // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const isChunk = options.isChunk;
    const isCombinung = options.isCombinung;
    const chunkIndex = options.chunkIndex || 0;
    
    if (isCombinung) {
        return {
            summary: `## 綜合會議摘要\n\n本次會議總共處理了${options.totalSections}個討論段落，涵蓋了技術開發、專案管理、設計優化等多個面向。\n\n## 主要成果\n- 確立了系統架構方向\n- 優化了開發流程\n- 強化了跨部門協作\n\n## 後續行動\n- 技術實作推進\n- 品質管控加強\n- 時程監控調整`,
            metadata: {
                generatedAt: new Date().toISOString(),
                model: options.model || 'gpt-4.1',
                processingTime: delay,
                usage: { total_tokens: 2000 + Math.floor(Math.random() * 500) }
            }
        };
    }
    
    if (isChunk) {
        return {
            summary: `## 會議段落 ${chunkIndex + 1} 摘要\n\n此段落主要討論了${transcript.metadata.participants.slice(0,3).join('、')}等參與者提出的重要議題。\n\n### 討論重點\n- 技術方案評估\n- 進度狀況回報\n- 問題解決方案\n\n### 決策事項\n- 確認技術方向\n- 調整資源配置\n- 優化流程方法\n\n### 後續追蹤\n- 實作細節確認\n- 時程安排調整\n- 品質標準制定`,
            metadata: {
                generatedAt: new Date().toISOString(),
                model: options.model || 'gpt-4.1',
                processingTime: delay,
                usage: { total_tokens: 800 + Math.floor(Math.random() * 200) },
                chunkInfo: {
                    chunkIndex,
                    totalChunks: options.totalChunks,
                    timeRange: `${transcript.metadata.startTime} - ${transcript.metadata.endTime}`
                }
            }
        };
    }
    
    // Regular summary
    return {
        summary: `## 完整會議摘要\n\n這場長時間的會議涵蓋了多個重要議題，參與者包括${transcript.metadata.participants.join('、')}等資深同事。\n\n## 主要討論內容\n- 系統架構設計與優化\n- 開發進度與品質控管\n- 跨部門協作機制\n- 市場推廣策略\n\n## 重要決策\n- 採用新的技術架構\n- 調整專案時程\n- 強化品質檢查流程\n\n## 行動計畫\n- 技術實作加速推進\n- 定期進度檢視\n- 跨部門溝通強化`,
        metadata: {
            generatedAt: new Date().toISOString(),
            model: options.model || 'gpt-4.1',
            processingTime: delay,
            usage: { total_tokens: 1200 + Math.floor(Math.random() * 300) }
        }
    };
}

async function demonstrateLargeTranscriptChunking() {
    console.log('🚀 Advanced Chunking Strategy - Large Transcript Demo\n');
    console.log('=' * 60);
    
    const strategy = new ChunkingStrategy();
    const massiveTranscript = createMassiveTranscript();
    
    console.log('\n📊 Massive Transcript Statistics:');
    console.log(`Duration: ${massiveTranscript.metadata.duration}`);
    console.log(`Participants: ${massiveTranscript.metadata.participants.length}`);
    console.log(`Sections: ${massiveTranscript.sections.length}`);
    console.log(`Content size: ${massiveTranscript.content.length.toLocaleString()} characters`);
    
    // Force chunking by using a very small token limit
    const smallTokenLimit = 15000; // Force chunking
    
    console.log('\n🔍 Chunking Analysis:');
    
    const providers = [
        { name: 'OpenAI GPT-4.1', provider: 'openai', model: 'gpt-4.1' },
        { name: 'Claude Sonnet 4', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }
    ];
    
    for (const config of providers) {
        console.log(`\n  ${config.name}:`);
        
        const analysis = strategy.analyzeChunkingNeeds(massiveTranscript, config.provider, config.model);
        console.log(`    Token estimate: ${analysis.tokenCount.toLocaleString()}`);
        console.log(`    Context limit: ${analysis.contextLimit.toLocaleString()}`);
        console.log(`    Needs chunking: ${analysis.needsChunking}`);
        console.log(`    Estimated chunks: ${analysis.estimatedChunks}`);
        console.log(`    Complexity: ${analysis.complexity}`);
        
        // Force chunking with small limit
        const chunks = strategy.chunkTranscript(massiveTranscript, {
            provider: config.provider,
            model: config.model,
            maxTokensPerChunk: smallTokenLimit,
            strategy: CHUNKING_STRATEGIES.HYBRID
        });
        
        console.log(`    Forced chunks (${smallTokenLimit.toLocaleString()} tokens limit): ${chunks.length}`);
        console.log(`    Avg chunk size: ${Math.round(chunks.reduce((sum, c) => sum + strategy.estimateTokenCount(c.content), 0) / chunks.length).toLocaleString()} tokens`);
        
        if (chunks.length > 0) {
            console.log(`    First chunk time: ${chunks[0].metadata.timeRange.start} - ${chunks[0].metadata.timeRange.end}`);
            console.log(`    Last chunk time: ${chunks[chunks.length-1].metadata.timeRange.start} - ${chunks[chunks.length-1].metadata.timeRange.end}`);
        }
    }
    
    // Demonstrate full processing with chunking
    console.log('\n🔄 Full Processing with Chunking (OpenAI GPT-4.1):');
    console.log(`Forcing chunking with ${smallTokenLimit.toLocaleString()} token limit per chunk...\n`);
    
    let progressCount = 0;
    const progressCallback = (update) => {
        progressCount++;
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${update.stage.toUpperCase()}: ${update.message}`);
        
        if (update.chunkInfo) {
            console.log(`  └─ Time: ${update.chunkInfo.timeRange}, Speakers: ${update.chunkInfo.speakers.length}, Tokens: ${update.chunkInfo.tokenCount.toLocaleString()}`);
        }
    };
    
    try {
        const startTime = Date.now();
        
        const result = await strategy.processLargeTranscript(
            massiveTranscript,
            mockAIProcessor,
            {
                provider: 'openai',
                model: 'gpt-4.1',
                strategy: CHUNKING_STRATEGIES.HYBRID,
                language: 'zh-TW',
                maxTokensPerChunk: smallTokenLimit
            },
            progressCallback
        );
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        console.log('\n✅ Processing Complete!');
        console.log(`Total processing time: ${totalTime}ms`);
        console.log(`Progress updates: ${progressCount}`);
        console.log(`Processing method: ${result.metadata.processingMethod}`);
        console.log(`Chunks processed: ${result.metadata.chunksProcessed}`);
        console.log(`Chunks failed: ${result.metadata.chunksFailed}`);
        
        if (result.metadata.chunkingSummary) {
            console.log(`Chunking strategy: ${result.metadata.chunkingSummary.strategy || 'Not specified'}`);
            console.log(`Total tokens processed: ${result.metadata.chunkingSummary.totalTokens?.toLocaleString() || 'Unknown'}`);
            console.log(`Average chunk size: ${result.metadata.chunkingSummary.avgChunkSize?.toLocaleString() || 'Unknown'} tokens`);
        }
        
        console.log('\n📄 Final Summary (first 500 chars):');
        console.log(result.summary.substring(0, 500) + '...');
        
        console.log('\n📊 Chunk Processing Details:');
        if (result.chunkDetails) {
            result.chunkDetails.forEach((detail, index) => {
                const status = detail.success ? '✅' : '❌';
                console.log(`  ${status} Chunk ${index + 1}: ${detail.timeRange.start}-${detail.timeRange.end} (${detail.tokenCount.toLocaleString()} tokens)`);
            });
        }
        
        console.log('\n🎯 Performance Metrics:');
        console.log(`Average processing time per chunk: ${Math.round(totalTime / (result.metadata.chunksProcessed || 1))}ms`);
        console.log(`Tokens per second: ${Math.round((result.metadata.chunkingSummary?.totalTokens || 0) * 1000 / totalTime).toLocaleString()}`);
        
    } catch (error) {
        console.error('\n❌ Processing failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
    
    console.log('\n🏁 Advanced Chunking Demo Complete!');
    console.log('\nAdvanced Features Demonstrated:');
    console.log('✓ Large transcript handling (500 sections, 100k+ characters)');
    console.log('✓ Intelligent chunking with multiple strategies');
    console.log('✓ Context overlap for conversation continuity');
    console.log('✓ Real-time progress tracking');
    console.log('✓ Multi-provider optimization (OpenAI vs Claude)');
    console.log('✓ Error handling and recovery');
    console.log('✓ Performance monitoring and metrics');
    console.log('✓ Comprehensive metadata enrichment');
    console.log('✓ Chinese language support');
}

// Run the demonstration
if (require.main === module) {
    demonstrateLargeTranscriptChunking().catch(console.error);
}

module.exports = {
    createMassiveTranscript,
    mockAIProcessor,
    demonstrateLargeTranscriptChunking
};