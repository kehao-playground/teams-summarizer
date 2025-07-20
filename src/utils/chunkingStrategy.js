/**
 * Advanced Chunking Strategy Module for Teams Transcript Extension
 * 
 * Handles intelligent chunking of large transcripts that exceed AI model context limits.
 * Features:
 * - Smart chunking by speaker turns and semantic breaks
 * - Context-aware overlap to maintain conversation flow
 * - Section-based summarization and combination
 * - Progress tracking for multi-chunk processing
 * - Optimized for both GPT 4.1 (1M+ tokens) and Claude Sonnet 4 (200k tokens)
 */

// Import transcript formatter functions (try different approaches for compatibility)
let chunkTranscript, formatTranscriptForAI;
try {
    // Try CommonJS require first
    const transcriptFormatter = require('./transcriptFormatter.js');
    chunkTranscript = transcriptFormatter.chunkTranscript;
    formatTranscriptForAI = transcriptFormatter.formatTranscriptForAI;
} catch (error) {
    try {
        // Try TypeScript version
        const transcriptFormatter = require('./transcriptFormatter.ts');
        chunkTranscript = transcriptFormatter.chunkTranscript;
        formatTranscriptForAI = transcriptFormatter.formatTranscriptForAI;
    } catch (tsError) {
        console.warn('[ChunkingStrategy] Transcript formatter not available, using fallback functions');
        // Provide fallback functions
        chunkTranscript = function(transcript, maxTokens) {
            return [transcript]; // Simple fallback
        };
        formatTranscriptForAI = function(transcript) {
            return transcript;
        };
    }
}

// Token limits for different providers (conservative estimates)
const PROVIDER_LIMITS = {
    'openai': {
        'gpt-4.1': 1000000,      // 1M+ context window, use 900k for safety
        'gpt-4': 120000,         // 128k context, use 110k for safety
        'gpt-3.5-turbo': 15000   // 16k context, use 15k for safety
    },
    'anthropic': {
        'claude-3-5-sonnet-20241022': 180000,  // 200k context, use 180k for safety
        'claude-3-opus-20240229': 180000,      // 200k context, use 180k for safety
        'claude-3-haiku-20240307': 180000      // 200k context, use 180k for safety
    }
};

// Chunking strategies
const CHUNKING_STRATEGIES = {
    SPEAKER_TURNS: 'speaker_turns',
    TIME_BASED: 'time_based',
    SEMANTIC_BREAKS: 'semantic_breaks',
    HYBRID: 'hybrid'
};

// Overlap percentage for context preservation
const CONTEXT_OVERLAP_PERCENTAGE = 0.15; // 15% overlap between chunks

/**
 * Advanced Chunking Strategy class
 */
class ChunkingStrategy {
    constructor() {
        this.defaultStrategy = CHUNKING_STRATEGIES.HYBRID;
    }

    /**
     * Check if transcript needs chunking and determine optimal strategy
     * @param {Object} formattedTranscript - Formatted transcript
     * @param {string} provider - AI provider (openai/anthropic)
     * @param {string} model - Specific model name
     * @param {Object} options - Additional options for analysis
     * @returns {Object} Chunking analysis result
     */
    analyzeChunkingNeeds(formattedTranscript, provider, model, options = {}) {
        const tokenCount = this.estimateTokenCount(formattedTranscript.content);
        const contextLimit = this.getContextLimit(provider, model);
        const safeLimit = Math.floor(contextLimit * 0.8); // 80% safety margin
        
        // If maxTokensPerChunk is specified and smaller than estimated need, force chunking
        const maxTokensPerChunk = options.maxTokensPerChunk;
        const forceChunking = maxTokensPerChunk && tokenCount > maxTokensPerChunk;

        const analysis = {
            tokenCount,
            contextLimit,
            safeLimit,
            needsChunking: forceChunking || tokenCount > safeLimit,
            recommendedStrategy: this.getRecommendedStrategy(formattedTranscript),
            estimatedChunks: forceChunking 
                ? Math.ceil(tokenCount / maxTokensPerChunk)
                : (tokenCount > safeLimit ? Math.ceil(tokenCount / safeLimit) : 1),
            complexity: this.assessComplexity(formattedTranscript),
            forcedChunking: forceChunking
        };

        console.log('[ChunkingStrategy] Analysis:', analysis);
        return analysis;
    }

    /**
     * Perform intelligent chunking of large transcripts
     * @param {Object} formattedTranscript - Formatted transcript
     * @param {Object} options - Chunking options
     * @returns {Array} Array of transcript chunks
     */
    chunkTranscript(formattedTranscript, options = {}) {
        const {
            provider = 'openai',
            model = 'gpt-4.1',
            strategy = this.defaultStrategy,
            maxTokensPerChunk = null,
            preserveContext = true
        } = options;

        console.log('[ChunkingStrategy] Starting chunking with strategy:', strategy);

        // Determine max tokens per chunk
        const maxTokens = maxTokensPerChunk || this.getOptimalChunkSize(provider, model);

        // Apply selected chunking strategy
        let chunks = [];
        switch (strategy) {
            case CHUNKING_STRATEGIES.SPEAKER_TURNS:
                chunks = this.chunkBySpeakerTurns(formattedTranscript, maxTokens);
                break;
            case CHUNKING_STRATEGIES.TIME_BASED:
                chunks = this.chunkByTimeIntervals(formattedTranscript, maxTokens);
                break;
            case CHUNKING_STRATEGIES.SEMANTIC_BREAKS:
                chunks = this.chunkBySemanticBreaks(formattedTranscript, maxTokens);
                break;
            case CHUNKING_STRATEGIES.HYBRID:
            default:
                chunks = this.chunkWithHybridStrategy(formattedTranscript, maxTokens);
                break;
        }

        // Add context overlap if requested
        if (preserveContext && chunks.length > 1) {
            chunks = this.addContextOverlap(chunks, formattedTranscript);
        }

        // Add chunk metadata
        chunks = this.enrichChunkMetadata(chunks, formattedTranscript, strategy);

        console.log(`[ChunkingStrategy] Created ${chunks.length} chunks with strategy: ${strategy}`);
        return chunks;
    }

    /**
     * Chunk by speaker turns to maintain conversation flow
     */
    chunkBySpeakerTurns(formattedTranscript, maxTokens) {
        const sections = formattedTranscript.sections;
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;

        for (const section of sections) {
            const sectionTokens = this.estimateTokenCount(section.text);
            
            // If this section alone exceeds limit, split it
            if (sectionTokens > maxTokens) {
                // Save current chunk if not empty
                if (currentChunk.length > 0) {
                    chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
                    currentChunk = [];
                    currentTokens = 0;
                }
                
                // Split the large section
                const splitSections = this.splitLargeSection(section, maxTokens);
                chunks.push(...splitSections.map(s => this.createChunk([s], formattedTranscript.metadata)));
                continue;
            }

            // Check if adding this section would exceed limit
            if (currentTokens + sectionTokens > maxTokens && currentChunk.length > 0) {
                // Look for speaker change as natural break point
                const lastSpeaker = currentChunk[currentChunk.length - 1].speaker;
                if (section.speaker !== lastSpeaker) {
                    // Natural speaker change - create chunk
                    chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
                    currentChunk = [];
                    currentTokens = 0;
                } else {
                    // Same speaker continuing - split anyway to avoid overflow
                    chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
                    currentChunk = [];
                    currentTokens = 0;
                }
            }

            currentChunk.push(section);
            currentTokens += sectionTokens;
        }

        // Add final chunk
        if (currentChunk.length > 0) {
            chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
        }

        return chunks;
    }

    /**
     * Chunk by time intervals for consistent duration
     */
    chunkByTimeIntervals(formattedTranscript, maxTokens) {
        const sections = formattedTranscript.sections;
        const totalDurationMs = this.parseDurationToMs(formattedTranscript.metadata.duration);
        const estimatedChunks = Math.ceil(this.estimateTokenCount(formattedTranscript.content) / maxTokens);
        const intervalMs = totalDurationMs / estimatedChunks;

        console.log(`[ChunkingStrategy] Time-based chunking: ${estimatedChunks} intervals of ${Math.round(intervalMs/1000/60)}min each`);

        const chunks = [];
        let currentChunk = [];
        let currentIntervalStart = 0;

        for (const section of sections) {
            const sectionStartMs = this.parseTimestampToMs(section.startTime);
            
            // Check if we should start a new chunk based on time interval
            if (sectionStartMs >= currentIntervalStart + intervalMs && currentChunk.length > 0) {
                chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
                currentChunk = [];
                currentIntervalStart = sectionStartMs;
            }

            currentChunk.push(section);
        }

        // Add final chunk
        if (currentChunk.length > 0) {
            chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
        }

        return chunks;
    }

    /**
     * Chunk by semantic breaks (topic changes, long pauses)
     */
    chunkBySemanticBreaks(formattedTranscript, maxTokens) {
        const sections = formattedTranscript.sections;
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sectionTokens = this.estimateTokenCount(section.text);
            
            // Check for semantic break indicators
            const isSemanticBreak = this.detectSemanticBreak(section, sections[i - 1], sections[i + 1]);
            
            // If we're at a semantic break and near token limit
            if (isSemanticBreak && currentTokens + sectionTokens > maxTokens * 0.7 && currentChunk.length > 0) {
                chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
                currentChunk = [];
                currentTokens = 0;
            }
            
            // Force split if token limit reached
            if (currentTokens + sectionTokens > maxTokens && currentChunk.length > 0) {
                chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
                currentChunk = [];
                currentTokens = 0;
            }

            currentChunk.push(section);
            currentTokens += sectionTokens;
        }

        // Add final chunk
        if (currentChunk.length > 0) {
            chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
        }

        return chunks;
    }

    /**
     * Hybrid strategy combining multiple approaches
     */
    chunkWithHybridStrategy(formattedTranscript, maxTokens) {
        const sections = formattedTranscript.sections;
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sectionTokens = this.estimateTokenCount(section.text);
            
            // Check various break conditions
            const isNaturalBreak = this.isNaturalBreak(section, sections[i - 1], sections[i + 1]);
            const nearTokenLimit = currentTokens + sectionTokens > maxTokens * 0.8;
            const atTokenLimit = currentTokens + sectionTokens > maxTokens;

            // Decide whether to create new chunk
            if (currentChunk.length > 0 && (atTokenLimit || (nearTokenLimit && isNaturalBreak))) {
                chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
                currentChunk = [];
                currentTokens = 0;
            }

            currentChunk.push(section);
            currentTokens += sectionTokens;
        }

        // Add final chunk
        if (currentChunk.length > 0) {
            chunks.push(this.createChunk(currentChunk, formattedTranscript.metadata));
        }

        return chunks;
    }

    /**
     * Add context overlap between chunks for better continuity
     */
    addContextOverlap(chunks, originalTranscript) {
        if (chunks.length <= 1) return chunks;

        const overlapChunks = [...chunks];
        
        for (let i = 1; i < overlapChunks.length; i++) {
            const previousChunk = chunks[i - 1];
            const currentChunk = overlapChunks[i];
            
            // Calculate overlap size
            const overlapSize = Math.floor(previousChunk.sections.length * CONTEXT_OVERLAP_PERCENTAGE);
            
            if (overlapSize > 0) {
                // Take last sections from previous chunk
                const overlapSections = previousChunk.sections.slice(-overlapSize);
                
                // Prepend to current chunk with overlap marker
                const markedOverlapSections = overlapSections.map(section => ({
                    ...section,
                    isOverlap: true,
                    text: `[Context from previous section] ${section.text}`
                }));
                
                overlapChunks[i] = {
                    ...currentChunk,
                    sections: [...markedOverlapSections, ...currentChunk.sections],
                    content: this.regenerateContent([...markedOverlapSections, ...currentChunk.sections]),
                    metadata: {
                        ...currentChunk.metadata,
                        hasOverlap: true,
                        overlapSections: overlapSize
                    }
                };
            }
        }

        return overlapChunks;
    }

    /**
     * Enrich chunks with comprehensive metadata
     */
    enrichChunkMetadata(chunks, originalTranscript, strategy) {
        return chunks.map((chunk, index) => ({
            ...chunk,
            metadata: {
                ...chunk.metadata,
                chunkIndex: index,
                totalChunks: chunks.length,
                chunkingStrategy: strategy,
                originalTranscriptId: this.generateTranscriptId(originalTranscript),
                tokenCount: this.estimateTokenCount(chunk.content),
                speakers: [...new Set(chunk.sections.map(s => s.speaker))],
                timeRange: {
                    start: chunk.sections[0]?.startTime,
                    end: chunk.sections[chunk.sections.length - 1]?.endTime,
                    duration: this.calculateChunkDuration(chunk.sections)
                }
            }
        }));
    }

    /**
     * Process large transcript with progress tracking
     * @param {Object} formattedTranscript - Formatted transcript
     * @param {Function} aiSummaryFunction - Function to generate summaries
     * @param {Object} options - Processing options
     * @param {Function} progressCallback - Progress tracking callback
     * @returns {Object} Combined summary result
     */
    async processLargeTranscript(formattedTranscript, aiSummaryFunction, options = {}, progressCallback = null) {
        const analysis = this.analyzeChunkingNeeds(formattedTranscript, options.provider, options.model, options);
        
        if (!analysis.needsChunking) {
            console.log('[ChunkingStrategy] No chunking needed, processing as single transcript');
            return await aiSummaryFunction(formattedTranscript, options);
        }

        // Create chunks
        const chunks = this.chunkTranscript(formattedTranscript, options);
        console.log(`[ChunkingStrategy] Processing ${chunks.length} chunks with ${analysis.complexity} complexity`);

        const chunkSummaries = [];
        const totalChunks = chunks.length;

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Update progress
            if (progressCallback) {
                progressCallback({
                    stage: 'chunking',
                    current: i + 1,
                    total: totalChunks,
                    message: `Processing chunk ${i + 1} of ${totalChunks}`,
                    chunkInfo: {
                        timeRange: chunk.metadata.timeRange,
                        speakers: chunk.metadata.speakers,
                        tokenCount: chunk.metadata.tokenCount
                    }
                });
            }

            try {
                console.log(`[ChunkingStrategy] Processing chunk ${i + 1}/${totalChunks}`);
                
                // Adjust options for section processing
                const chunkOptions = {
                    ...options,
                    promptType: 'section', // Use section-specific prompts
                    isChunk: true,
                    chunkIndex: i,
                    totalChunks
                };

                const chunkSummary = await aiSummaryFunction(chunk, chunkOptions);
                
                chunkSummaries.push({
                    chunkIndex: i,
                    timeRange: chunk.metadata.timeRange,
                    speakers: chunk.metadata.speakers,
                    summary: chunkSummary,
                    tokenCount: chunk.metadata.tokenCount
                });

            } catch (error) {
                console.error(`[ChunkingStrategy] Error processing chunk ${i + 1}:`, error);
                
                // Add error placeholder to maintain sequence
                chunkSummaries.push({
                    chunkIndex: i,
                    timeRange: chunk.metadata.timeRange,
                    speakers: chunk.metadata.speakers,
                    summary: { error: error.message },
                    tokenCount: chunk.metadata.tokenCount
                });
            }
        }

        // Combine summaries
        if (progressCallback) {
            progressCallback({
                stage: 'combining',
                current: totalChunks,
                total: totalChunks,
                message: 'Combining section summaries into final summary...'
            });
        }

        const combinedSummary = await this.combineSectionSummaries(
            chunkSummaries,
            formattedTranscript.metadata,
            aiSummaryFunction,
            options
        );

        // Final progress update
        if (progressCallback) {
            progressCallback({
                stage: 'complete',
                current: totalChunks,
                total: totalChunks,
                message: 'Large transcript processing complete',
                result: combinedSummary
            });
        }

        return combinedSummary;
    }

    /**
     * Combine section summaries into cohesive final summary
     */
    async combineSectionSummaries(chunkSummaries, originalMetadata, aiSummaryFunction, options) {
        // Filter out error summaries
        const validSummaries = chunkSummaries.filter(cs => cs.summary && !cs.summary.error);
        
        if (validSummaries.length === 0) {
            throw new Error('All chunk processing failed - cannot generate combined summary');
        }

        // Create combined content for final summarization
        const sectionContents = validSummaries.map((cs, index) => {
            const timeInfo = `${cs.timeRange.start} - ${cs.timeRange.end}`;
            const speakerInfo = cs.speakers.join(', ');
            return `## Section ${index + 1} (${timeInfo}, Speakers: ${speakerInfo})\n${cs.summary.summary || cs.summary}`;
        }).join('\n\n');

        // Create meta-transcript for combining
        const combiningTranscript = {
            metadata: {
                ...originalMetadata,
                chunkCount: validSummaries.length,
                processingMethod: 'chunked_combination'
            },
            content: sectionContents,
            sections: []
        };

        // Final summarization
        const finalSummaryOptions = {
            ...options,
            promptType: 'combine',
            isCombinung: true,
            totalSections: validSummaries.length
        };

        const finalSummary = await aiSummaryFunction(combiningTranscript, finalSummaryOptions);

        // Enhance with chunking metadata
        return {
            ...(finalSummary || {}),
            metadata: {
                ...((finalSummary && finalSummary.metadata) || {}),
                processingMethod: 'large_transcript_chunked',
                chunksProcessed: validSummaries.length,
                chunksFailed: chunkSummaries.length - validSummaries.length,
                chunkingSummary: {
                    strategy: options.strategy || this.defaultStrategy,
                    totalTokens: chunkSummaries.reduce((sum, cs) => sum + cs.tokenCount, 0),
                    avgChunkSize: Math.round(chunkSummaries.reduce((sum, cs) => sum + cs.tokenCount, 0) / chunkSummaries.length)
                }
            },
            chunkDetails: chunkSummaries.map(cs => ({
                index: cs.chunkIndex,
                timeRange: cs.timeRange,
                speakers: cs.speakers,
                tokenCount: cs.tokenCount,
                success: !(cs.summary && cs.summary.error)
            }))
        };
    }

    // Helper methods

    estimateTokenCount(text) {
        // More sophisticated token counting
        // Account for different languages and formatting
        const avgCharsPerToken = text.match(/[\u4e00-\u9fff]/) ? 2.5 : 3.5; // Adjust for Chinese
        return Math.ceil(text.length / avgCharsPerToken);
    }

    getContextLimit(provider, model) {
        return PROVIDER_LIMITS[provider]?.[model] || 
               PROVIDER_LIMITS[provider]?.['gpt-4'] || 
               PROVIDER_LIMITS['openai']['gpt-4'];
    }

    getOptimalChunkSize(provider, model) {
        const contextLimit = this.getContextLimit(provider, model);
        return Math.floor(contextLimit * 0.75); // 75% of context limit for chunk size
    }

    getRecommendedStrategy(formattedTranscript) {
        const speakerCount = formattedTranscript.metadata.participants.length;
        const sectionCount = formattedTranscript.sections.length;
        const avgSectionLength = this.estimateTokenCount(formattedTranscript.content) / sectionCount;

        // Simple heuristics for strategy recommendation
        if (speakerCount <= 2 && avgSectionLength > 100) {
            return CHUNKING_STRATEGIES.SPEAKER_TURNS;
        } else if (sectionCount > 100) {
            return CHUNKING_STRATEGIES.TIME_BASED;
        } else {
            return CHUNKING_STRATEGIES.HYBRID;
        }
    }

    assessComplexity(formattedTranscript) {
        const speakerCount = formattedTranscript.metadata.participants.length;
        const tokenCount = this.estimateTokenCount(formattedTranscript.content);
        const sectionCount = formattedTranscript.sections.length;

        if (speakerCount > 5 || tokenCount > 100000 || sectionCount > 200) {
            return 'high';
        } else if (speakerCount > 2 || tokenCount > 50000 || sectionCount > 100) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    detectSemanticBreak(currentSection, previousSection, nextSection) {
        if (!previousSection) return false;

        // Look for topic change indicators
        const topicWords = ['next', 'now', 'moving on', 'let\'s discuss', 'switching to', '下一個', '接下來', '現在討論'];
        const hasTopicChange = topicWords.some(word => 
            currentSection.text.toLowerCase().includes(word)
        );

        // Look for long pause (time gap)
        const previousEndMs = this.parseTimestampToMs(previousSection.endTime);
        const currentStartMs = this.parseTimestampToMs(currentSection.startTime);
        const pauseMs = currentStartMs - previousEndMs;
        const hasLongPause = pauseMs > 30000; // 30 second pause

        // Speaker change after long monologue
        const speakerChange = currentSection.speaker !== previousSection.speaker;
        const longPreviousSection = this.estimateTokenCount(previousSection.text) > 200;

        return hasTopicChange || hasLongPause || (speakerChange && longPreviousSection);
    }

    isNaturalBreak(currentSection, previousSection, nextSection) {
        // Combine multiple break detection methods
        const isSemanticBreak = this.detectSemanticBreak(currentSection, previousSection, nextSection);
        const isSpeakerChange = previousSection && currentSection.speaker !== previousSection.speaker;
        const isTimeGap = previousSection && 
            (this.parseTimestampToMs(currentSection.startTime) - this.parseTimestampToMs(previousSection.endTime)) > 10000;

        return isSemanticBreak || isSpeakerChange || isTimeGap;
    }

    splitLargeSection(section, maxTokens) {
        // Split very large sections by sentence boundaries
        const sentences = section.text.split(/[.!?]+/).filter(s => s.trim());
        const subsections = [];
        let currentText = '';
        let currentTokens = 0;

        for (const sentence of sentences) {
            const sentenceTokens = this.estimateTokenCount(sentence);
            
            if (currentTokens + sentenceTokens > maxTokens && currentText) {
                // Create subsection
                subsections.push({
                    ...section,
                    text: currentText.trim(),
                    isSplit: true
                });
                currentText = sentence;
                currentTokens = sentenceTokens;
            } else {
                currentText += (currentText ? '. ' : '') + sentence;
                currentTokens += sentenceTokens;
            }
        }

        // Add final subsection
        if (currentText) {
            subsections.push({
                ...section,
                text: currentText.trim(),
                isSplit: true
            });
        }

        return subsections;
    }

    createChunk(sections, originalMetadata) {
        const chunkContent = sections.map(section => 
            `[${section.startTime}] ${section.speaker}: ${section.text}`
        ).join('\n');

        const chunkParticipants = [...new Set(sections.map(s => s.speaker))];

        return {
            metadata: {
                ...originalMetadata,
                participants: chunkParticipants,
                totalEntries: sections.length,
                startTime: sections[0].startTime,
                endTime: sections[sections.length - 1].endTime
            },
            content: chunkContent,
            sections
        };
    }

    regenerateContent(sections) {
        return sections.map(section => 
            `[${section.startTime}] ${section.speaker}: ${section.text}`
        ).join('\n');
    }

    parseTimestampToMs(timestamp) {
        const parts = timestamp.split(':');
        return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 1000;
    }

    parseDurationToMs(duration) {
        return this.parseTimestampToMs(duration);
    }

    calculateChunkDuration(sections) {
        if (sections.length === 0) return '00:00:00';
        
        const startMs = this.parseTimestampToMs(sections[0].startTime);
        const endMs = this.parseTimestampToMs(sections[sections.length - 1].endTime);
        const durationMs = endMs - startMs;
        
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    generateTranscriptId(transcript) {
        // Simple hash based on content and metadata
        const hashContent = transcript.content.substring(0, 100) + transcript.metadata.duration;
        
        // Use Buffer for Node.js or btoa for browser
        try {
            if (typeof btoa !== 'undefined') {
                return btoa(hashContent).substring(0, 16);
            } else {
                // Node.js environment
                return Buffer.from(hashContent).toString('base64').substring(0, 16);
            }
        } catch (error) {
            // Fallback to simple string hash
            let hash = 0;
            for (let i = 0; i < hashContent.length; i++) {
                const char = hashContent.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(36).substring(0, 16);
        }
    }
}

// Create singleton instance
const chunkingStrategy = new ChunkingStrategy();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ChunkingStrategy, 
        chunkingStrategy, 
        CHUNKING_STRATEGIES,
        PROVIDER_LIMITS
    };
} else {
    // Browser environment - attach to window
    window.ChunkingStrategy = ChunkingStrategy;
    window.chunkingStrategy = chunkingStrategy;
    window.CHUNKING_STRATEGIES = CHUNKING_STRATEGIES;
}