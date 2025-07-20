/**
 * Test Suite for Chunking Strategy Module
 * Covers all chunking strategies and edge cases
 */

// Import dependencies
const { ChunkingStrategy, chunkingStrategy, CHUNKING_STRATEGIES } = require('../../src/utils/chunkingStrategy.js');

// Mock data for testing
const mockTranscriptSmall = {
    metadata: {
        participants: ['Alice', 'Bob'],
        duration: '00:15:30',
        language: 'en',
        totalEntries: 50,
        startTime: '00:00:00',
        endTime: '00:15:30'
    },
    content: 'Mock content for small transcript that should not need chunking.',
    sections: [
        {
            speaker: 'Alice',
            startTime: '00:00:00',
            endTime: '00:02:00',
            text: 'Welcome everyone to today\'s meeting. Let\'s start with the project update.',
            confidence: 0.95
        },
        {
            speaker: 'Bob',
            startTime: '00:02:01',
            endTime: '00:05:00',
            text: 'Thank you Alice. The development is progressing well. We completed the authentication module.',
            confidence: 0.92
        }
    ]
};

const mockTranscriptLarge = {
    metadata: {
        participants: ['Alice', 'Bob', 'Charlie', 'Diana'],
        duration: '02:30:45',
        language: 'zh-tw',
        totalEntries: 500,
        startTime: '00:00:00',
        endTime: '02:30:45'
    },
    content: 'A'.repeat(500000), // Large content that will definitely need chunking for Claude
    sections: generateMockSections(100) // 100 sections for testing
};

function generateMockSections(count) {
    const speakers = ['Alice', 'Bob', 'Charlie', 'Diana'];
    const sections = [];
    
    for (let i = 0; i < count; i++) {
        const minutes = Math.floor(i * 1.5);
        const seconds = (i * 30) % 60;
        const startTime = `00:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const endTime = `00:${minutes.toString().padStart(2, '0')}:${(seconds + 30).toString().padStart(2, '0')}`;
        
        sections.push({
            speaker: speakers[i % speakers.length],
            startTime,
            endTime,
            text: `This is section ${i + 1} with some content that varies in length. `.repeat(Math.floor(Math.random() * 50) + 100), // Make it much larger
            confidence: 0.8 + Math.random() * 0.2
        });
    }
    
    return sections;
}

// Test Suite
describe('ChunkingStrategy', () => {
    let strategy;
    
    beforeEach(() => {
        strategy = new ChunkingStrategy();
    });

    describe('Token Estimation', () => {
        test('should estimate token count correctly for English text', () => {
            const text = 'This is a test sentence with about twenty words that should be estimated correctly.';
            const tokens = strategy.estimateTokenCount(text);
            expect(tokens).toBeGreaterThan(15);
            expect(tokens).toBeLessThan(30);
        });

        test('should estimate token count correctly for Chinese text', () => {
            const text = '這是一個測試句子，包含大約二十個中文字符，應該被正確估算。';
            const tokens = strategy.estimateTokenCount(text);
            expect(tokens).toBeGreaterThan(10);
            expect(tokens).toBeLessThan(25);
        });

        test('should handle empty text', () => {
            expect(strategy.estimateTokenCount('')).toBe(0);
        });
    });

    describe('Chunking Need Analysis', () => {
        test('should detect that small transcript does not need chunking', () => {
            const analysis = strategy.analyzeChunkingNeeds(mockTranscriptSmall, 'openai', 'gpt-4.1');
            
            expect(analysis.needsChunking).toBe(false);
            expect(analysis.estimatedChunks).toBe(1);
            expect(analysis.complexity).toBe('low');
        });

        test('should detect that large transcript needs chunking', () => {
            // Test with forced chunking using maxTokensPerChunk
            const analysis = strategy.analyzeChunkingNeeds(
                mockTranscriptLarge, 
                'anthropic', 
                'claude-3-5-sonnet-20241022', 
                { maxTokensPerChunk: 5000 }
            );
            
            expect(analysis.needsChunking).toBe(true);
            expect(analysis.estimatedChunks).toBeGreaterThan(1);
            expect(analysis.complexity).toBeTruthy();
        });

        test('should recommend appropriate strategy based on transcript characteristics', () => {
            const analysis = strategy.analyzeChunkingNeeds(mockTranscriptLarge, 'openai', 'gpt-4.1');
            
            expect(Object.values(CHUNKING_STRATEGIES)).toContain(analysis.recommendedStrategy);
        });

        test('should handle different AI providers and models', () => {
            const analysisOpenAI = strategy.analyzeChunkingNeeds(mockTranscriptLarge, 'openai', 'gpt-4.1');
            const analysisClaude = strategy.analyzeChunkingNeeds(
                mockTranscriptLarge, 
                'anthropic', 
                'claude-3-5-sonnet-20241022',
                { maxTokensPerChunk: 5000 } // Force chunking for this test
            );
            
            expect(analysisOpenAI.contextLimit).toBeGreaterThan(analysisClaude.contextLimit);
            expect(analysisClaude.needsChunking).toBe(true);
        });
    });

    describe('Speaker Turn Chunking', () => {
        test('should chunk by speaker turns while respecting token limits', () => {
            const chunks = strategy.chunkBySpeakerTurns(mockTranscriptLarge, 5000); // Small limit to force chunking
            
            expect(chunks.length).toBeGreaterThan(1);
            chunks.forEach(chunk => {
                expect(chunk.sections).toBeDefined();
                expect(chunk.metadata).toBeDefined();
                expect(chunk.content).toBeDefined();
            });
        });

        test('should handle single speaker sections', () => {
            const singleSpeakerTranscript = {
                ...mockTranscriptLarge,
                sections: mockTranscriptLarge.sections.map(s => ({ ...s, speaker: 'Alice' }))
            };
            
            const chunks = strategy.chunkBySpeakerTurns(singleSpeakerTranscript, 50000);
            expect(chunks.length).toBeGreaterThan(0);
        });

        test('should split very large sections', () => {
            const largeSectionTranscript = {
                ...mockTranscriptSmall,
                sections: [{
                    speaker: 'Alice',
                    startTime: '00:00:00',
                    endTime: '01:00:00',
                    text: 'Very long content. '.repeat(5000), // Very large section
                    confidence: 0.9
                }]
            };
            
            const chunks = strategy.chunkBySpeakerTurns(largeSectionTranscript, 10000);
            expect(chunks.length).toBeGreaterThan(1);
        });
    });

    describe('Time-Based Chunking', () => {
        test('should chunk by time intervals', () => {
            const chunks = strategy.chunkByTimeIntervals(mockTranscriptLarge, 5000); // Small limit to force chunking
            
            expect(chunks.length).toBeGreaterThan(1);
            
            // Verify time-based distribution
            chunks.forEach((chunk, index) => {
                expect(chunk.metadata).toBeDefined();
                expect(chunk.metadata.startTime).toBeDefined();
                expect(chunk.metadata.endTime).toBeDefined();
            });
        });

        test('should handle short meetings', () => {
            const chunks = strategy.chunkByTimeIntervals(mockTranscriptSmall, 50000);
            expect(chunks.length).toBe(1);
        });
    });

    describe('Semantic Break Detection', () => {
        test('should detect topic change indicators', () => {
            const mockSections = [
                {
                    speaker: 'Alice',
                    startTime: '00:00:00',
                    endTime: '00:01:00',
                    text: 'Let\'s discuss the budget.',
                    confidence: 0.9
                },
                {
                    speaker: 'Bob',
                    startTime: '00:01:01',
                    endTime: '00:02:00',
                    text: 'Now let\'s move on to the technical requirements.',
                    confidence: 0.9
                }
            ];
            
            const isSemanticBreak = strategy.detectSemanticBreak(
                mockSections[1], 
                mockSections[0], 
                null
            );
            
            expect(isSemanticBreak).toBe(true);
        });

        test('should detect long pauses', () => {
            const mockSections = [
                {
                    speaker: 'Alice',
                    startTime: '00:00:00',
                    endTime: '00:01:00',
                    text: 'First topic.',
                    confidence: 0.9
                },
                {
                    speaker: 'Bob',
                    startTime: '00:02:00', // 1 minute gap
                    endTime: '00:03:00',
                    text: 'Second topic.',
                    confidence: 0.9
                }
            ];
            
            const isSemanticBreak = strategy.detectSemanticBreak(
                mockSections[1], 
                mockSections[0], 
                null
            );
            
            expect(isSemanticBreak).toBe(true);
        });

        test('should chunk by semantic breaks', () => {
            const chunks = strategy.chunkBySemanticBreaks(mockTranscriptLarge, 5000); // Small limit to force chunking
            
            expect(chunks.length).toBeGreaterThan(0);
            chunks.forEach(chunk => {
                expect(chunk.sections.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Hybrid Strategy', () => {
        test('should use hybrid approach combining multiple factors', () => {
            const chunks = strategy.chunkWithHybridStrategy(mockTranscriptLarge, 5000); // Small limit to force chunking
            
            expect(chunks.length).toBeGreaterThan(1);
            
            // Verify hybrid characteristics
            chunks.forEach(chunk => {
                expect(chunk.sections).toBeDefined();
                expect(chunk.metadata.participants).toBeDefined();
                expect(chunk.metadata.startTime).toBeDefined();
            });
        });

        test('should handle edge cases gracefully', () => {
            const emptyTranscript = {
                ...mockTranscriptSmall,
                sections: []
            };
            
            const chunks = strategy.chunkWithHybridStrategy(emptyTranscript, 50000);
            expect(chunks.length).toBe(0);
        });
    });

    describe('Context Overlap', () => {
        test('should add context overlap between chunks', () => {
            const chunks = strategy.chunkBySpeakerTurns(mockTranscriptLarge, 30000);
            const overlappedChunks = strategy.addContextOverlap(chunks, mockTranscriptLarge);
            
            if (overlappedChunks.length > 1) {
                // Check that later chunks have overlap
                for (let i = 1; i < overlappedChunks.length; i++) {
                    const chunk = overlappedChunks[i];
                    const hasOverlap = chunk.sections.some(section => section.isOverlap);
                    if (hasOverlap) {
                        expect(chunk.metadata.hasOverlap).toBe(true);
                        expect(chunk.metadata.overlapSections).toBeGreaterThan(0);
                    }
                }
            }
        });

        test('should not add overlap to single chunk', () => {
            const singleChunk = [strategy.createChunk(mockTranscriptSmall.sections, mockTranscriptSmall.metadata)];
            const result = strategy.addContextOverlap(singleChunk, mockTranscriptSmall);
            
            expect(result.length).toBe(1);
            expect(result[0].metadata.hasOverlap).toBeUndefined();
        });
    });

    describe('Chunk Metadata Enrichment', () => {
        test('should enrich chunks with comprehensive metadata', () => {
            const chunks = strategy.chunkBySpeakerTurns(mockTranscriptLarge, 50000);
            const enrichedChunks = strategy.enrichChunkMetadata(chunks, mockTranscriptLarge, CHUNKING_STRATEGIES.SPEAKER_TURNS);
            
            enrichedChunks.forEach((chunk, index) => {
                expect(chunk.metadata.chunkIndex).toBe(index);
                expect(chunk.metadata.totalChunks).toBe(enrichedChunks.length);
                expect(chunk.metadata.chunkingStrategy).toBe(CHUNKING_STRATEGIES.SPEAKER_TURNS);
                expect(chunk.metadata.tokenCount).toBeGreaterThan(0);
                expect(chunk.metadata.speakers).toBeDefined();
                expect(chunk.metadata.timeRange).toBeDefined();
                expect(chunk.metadata.originalTranscriptId).toBeDefined();
            });
        });
    });

    describe('Large Transcript Processing', () => {
        test('should process large transcript with progress tracking', async () => {
            const mockAiFunction = jest.fn().mockResolvedValue({
                summary: 'Mock summary',
                metadata: { generatedAt: new Date().toISOString() }
            });

            const progressUpdates = [];
            const progressCallback = (update) => {
                progressUpdates.push(update);
            };

            const options = {
                provider: 'anthropic', // Use Claude to force chunking
                model: 'claude-3-5-sonnet-20241022',
                strategy: CHUNKING_STRATEGIES.HYBRID,
                maxTokensPerChunk: 5000 // Force chunking with small limit
            };

            const result = await strategy.processLargeTranscript(
                mockTranscriptLarge,
                mockAiFunction,
                options,
                progressCallback
            );

            // Verify progress tracking
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates.some(update => update.stage === 'chunking')).toBe(true);
            expect(progressUpdates.some(update => update.stage === 'complete')).toBe(true);

            // Verify result structure
            expect(result).toBeDefined();
            expect(result.metadata.processingMethod).toBe('large_transcript_chunked');
            expect(result.metadata.chunksProcessed).toBeGreaterThan(0);
            expect(result.chunkDetails).toBeDefined();
        });


        test('should not chunk small transcripts', async () => {
            const mockAiFunction = jest.fn().mockResolvedValue({
                summary: 'Mock summary for small transcript'
            });

            const result = await strategy.processLargeTranscript(
                mockTranscriptSmall,
                mockAiFunction,
                { provider: 'openai', model: 'gpt-4.1' }
            );

            // Should call AI function once directly without chunking
            expect(mockAiFunction).toHaveBeenCalledTimes(1);
            expect(mockAiFunction).toHaveBeenCalledWith(
                mockTranscriptSmall,
                expect.objectContaining({ provider: 'openai', model: 'gpt-4.1' })
            );
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle empty transcript sections', () => {
            const emptyTranscript = {
                ...mockTranscriptSmall,
                sections: []
            };

            const chunks = strategy.chunkTranscript(emptyTranscript);
            expect(chunks.length).toBe(0);
        });

        test('should handle invalid token limits', () => {
            // Very small token limit
            const chunks = strategy.chunkBySpeakerTurns(mockTranscriptSmall, 1);
            expect(chunks.length).toBeGreaterThan(0);
        });

        test('should handle malformed timestamps', () => {
            const malformedTranscript = {
                ...mockTranscriptSmall,
                sections: [{
                    speaker: 'Alice',
                    startTime: 'invalid',
                    endTime: 'invalid',
                    text: 'Test content',
                    confidence: 0.9
                }]
            };

            expect(() => {
                strategy.chunkTranscript(malformedTranscript);
            }).not.toThrow();
        });

        test('should handle unknown provider/model combinations', () => {
            const analysis = strategy.analyzeChunkingNeeds(
                mockTranscriptLarge, 
                'unknown-provider', 
                'unknown-model'
            );

            expect(analysis.contextLimit).toBeGreaterThan(0); // Should fallback to default
        });
    });

    describe('Performance Optimizations', () => {
        test('should handle very large transcripts efficiently', () => {
            const veryLargeTranscript = {
                ...mockTranscriptLarge,
                content: 'A'.repeat(1000000), // 1M characters
                sections: generateMockSections(1000) // 1000 sections
            };

            const startTime = Date.now();
            const chunks = strategy.chunkTranscript(veryLargeTranscript, {
                provider: 'openai',
                model: 'gpt-4.1'
            });
            const endTime = Date.now();

            // Should complete within reasonable time (< 5 seconds)
            expect(endTime - startTime).toBeLessThan(5000);
            expect(chunks.length).toBeGreaterThan(0);
        });

        test('should properly estimate complexity for different transcript sizes', () => {
            const smallComplexity = strategy.assessComplexity(mockTranscriptSmall);
            const largeComplexity = strategy.assessComplexity(mockTranscriptLarge);

            expect(['low', 'medium', 'high']).toContain(smallComplexity);
            expect(['low', 'medium', 'high']).toContain(largeComplexity);
        });
    });
});

// Integration tests
describe('ChunkingStrategy Integration', () => {
    test('should integrate with existing transcript formatter', () => {
        // This would test integration with the actual transcriptFormatter module
        // For now, we'll test the interface compatibility
        const strategy = new ChunkingStrategy();
        
        expect(typeof strategy.chunkTranscript).toBe('function');
        expect(typeof strategy.analyzeChunkingNeeds).toBe('function');
        expect(typeof strategy.processLargeTranscript).toBe('function');
    });

    test('should work with realistic transcript data', () => {
        // Test with realistic Chinese transcript data
        const realisticTranscript = {
            metadata: {
                participants: ['王小明', '李小華', '張經理'],
                duration: '01:45:30',
                language: 'zh-tw',
                totalEntries: 150,
                startTime: '00:00:00',
                endTime: '01:45:30'
            },
            content: '我們今天要討論的主要議題包括產品開發進度和市場策略。'.repeat(1000),
            sections: [
                {
                    speaker: '王小明',
                    startTime: '00:00:00',
                    endTime: '00:05:30',
                    text: '各位早安，今天的會議主要討論Q2的產品開發計畫。我們需要確認各個模組的開發進度，以及接下來的里程碑設定。',
                    confidence: 0.94
                },
                {
                    speaker: '李小華',
                    startTime: '00:05:31',
                    endTime: '00:12:15',
                    text: '感謝小明的開場。關於後端API的部分，我們已經完成了用戶認證和資料管理模組。接下來會專注在性能優化和安全性強化。',
                    confidence: 0.91
                }
            ]
        };

        const strategy = new ChunkingStrategy();
        const analysis = strategy.analyzeChunkingNeeds(realisticTranscript, 'openai', 'gpt-4.1');
        
        expect(analysis).toBeDefined();
        expect(analysis.tokenCount).toBeGreaterThan(0);
        expect(analysis.recommendedStrategy).toBeTruthy();
    });
});

module.exports = {
    mockTranscriptSmall,
    mockTranscriptLarge,
    generateMockSections
};