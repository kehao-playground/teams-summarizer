/**
 * Transcript Formatter Module
 * 
 * Transforms Microsoft Stream API transcript responses into AI-ready format.
 * Features:
 * - Speaker grouping for better context
 * - Timestamp conversion to readable format
 * - Participant extraction and duration calculation
 * - Multi-language support (especially Chinese zh-tw)
 * - Confidence score preservation
 */

/**
 * Format a Stream API transcript for AI processing
 * @param {StreamTranscript} transcript - Raw transcript from Stream API
 * @returns {FormattedTranscript} AI-ready transcript with metadata
 */
function formatTranscriptForAI(transcript) {
  if (!transcript || !transcript.entries || transcript.entries.length === 0) {
    throw new Error('Invalid transcript: no entries found');
  }

  // Extract unique participants
  const participants = extractParticipants(transcript.entries);
  
  // Calculate meeting duration
  const duration = calculateDuration(transcript.entries);
  
  // Get start and end times
  const startTime = formatTimestamp(transcript.entries[0].startOffset);
  const endTime = formatTimestamp(transcript.entries[transcript.entries.length - 1].endOffset);
  
  // Get primary language
  const language = transcript.entries[0]?.spokenLanguageTag || 'zh-tw';
  
  // Group entries by speaker for better context
  const sections = groupBySpeaker(transcript.entries);
  
  // Create formatted content for AI
  const content = generateFormattedContent(sections);
  
  return {
    metadata: {
      participants,
      duration,
      language,
      totalEntries: transcript.entries.length,
      startTime,
      endTime
    },
    content,
    sections
  };
}

/**
 * Extract unique participants from transcript entries
 * @param {TranscriptEntry[]} entries - Transcript entries
 * @returns {string[]} Array of unique speaker names
 */
function extractParticipants(entries) {
  const speakerNames = new Set();
  
  entries.forEach(entry => {
    if (entry.speakerDisplayName && entry.speakerDisplayName.trim()) {
      speakerNames.add(entry.speakerDisplayName.trim());
    }
  });
  
  return Array.from(speakerNames).sort();
}

/**
 * Calculate meeting duration from first to last entry
 * @param {TranscriptEntry[]} entries - Transcript entries
 * @returns {string} Duration in HH:MM:SS format
 */
function calculateDuration(entries) {
  if (entries.length === 0) return '00:00:00';
  
  const startOffset = entries[0].startOffset;
  const endOffset = entries[entries.length - 1].endOffset;
  
  const startSeconds = parseTimestampToSeconds(startOffset);
  const endSeconds = parseTimestampToSeconds(endOffset);
  
  const durationSeconds = endSeconds - startSeconds;
  
  return formatSecondsToTimestamp(durationSeconds);
}

/**
 * Parse timestamp string to total seconds
 * @param {string} timestamp - Format: "HH:MM:SS.fffffff"
 * @returns {number} Total seconds
 */
function parseTimestampToSeconds(timestamp) {
  const parts = timestamp.split(':');
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseFloat(parts[2]) || 0;
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds back to timestamp string
 * @param {number} totalSeconds - Total seconds
 * @returns {string} Formatted timestamp HH:MM:SS
 */
function formatSecondsToTimestamp(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp for display (remove milliseconds)
 * @param {string} timestamp - Format: "HH:MM:SS.fffffff"
 * @returns {string} Clean timestamp "HH:MM:SS"
 */
function formatTimestamp(timestamp) {
  return timestamp.split('.')[0];
}

/**
 * Group consecutive entries by speaker
 * @param {TranscriptEntry[]} entries - Transcript entries
 * @returns {TranscriptSection[]} Grouped sections
 */
function groupBySpeaker(entries) {
  const sections = [];
  let currentSection = null;
  
  entries.forEach(entry => {
    const speaker = entry.speakerDisplayName || 'Unknown';
    const startTime = formatTimestamp(entry.startOffset);
    const endTime = formatTimestamp(entry.endOffset);
    
    // If same speaker continues, merge text
    if (currentSection && currentSection.speaker === speaker) {
      currentSection.text += ' ' + entry.text;
      currentSection.endTime = endTime;
      
      // Update confidence to average of entries
      currentSection.confidence = (currentSection.confidence + entry.confidence) / 2;
    } else {
      // New speaker, create new section
      if (currentSection) {
        sections.push(currentSection);
      }
      
      currentSection = {
        speaker,
        startTime,
        endTime,
        text: entry.text,
        confidence: entry.confidence
      };
    }
  });
  
  // Add the last section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Generate formatted content string for AI consumption
 * @param {TranscriptSection[]} sections - Grouped transcript sections
 * @returns {string} Formatted content for AI
 */
function generateFormattedContent(sections) {
  const lines = sections.map(section => {
    // Format: [HH:MM:SS] Speaker Name: Text content
    return `[${section.startTime}] ${section.speaker}: ${section.text}`;
  });
  
  return lines.join('\n');
}

/**
 * Create a summary preview of the transcript
 * @param {FormattedTranscript} formattedTranscript - Formatted transcript
 * @param {number} maxLines - Maximum lines for preview (default: 10)
 * @returns {string} Preview text
 */
function createPreview(formattedTranscript, maxLines = 10) {
  const lines = formattedTranscript.content.split('\n');
  const preview = lines.slice(0, maxLines).join('\n');
  
  if (lines.length > maxLines) {
    return preview + `\n... (${lines.length - maxLines} more lines)`;
  }
  
  return preview;
}

/**
 * Get transcript statistics
 * @param {FormattedTranscript} formattedTranscript - Formatted transcript
 * @returns {Object} Statistics object
 */
function getTranscriptStats(formattedTranscript) {
  const sections = formattedTranscript.sections;
  const wordCount = formattedTranscript.content.split(/\s+/).length;
  
  // Calculate speaking time per participant
  const speakingTime = {};
  sections.forEach(section => {
    const startSeconds = parseTimestampToSeconds(section.startTime + '.0');
    const endSeconds = parseTimestampToSeconds(section.endTime + '.0');
    const duration = endSeconds - startSeconds;
    
    if (!speakingTime[section.speaker]) {
      speakingTime[section.speaker] = 0;
    }
    speakingTime[section.speaker] += duration;
  });
  
  // Convert back to readable format
  Object.keys(speakingTime).forEach(speaker => {
    speakingTime[speaker] = formatSecondsToTimestamp(speakingTime[speaker]);
  });
  
  // Calculate average confidence
  const totalConfidence = sections.reduce((sum, section) => sum + section.confidence, 0);
  const averageConfidence = sections.length > 0 ? totalConfidence / sections.length : 0;
  
  return {
    totalSections: sections.length,
    totalParticipants: formattedTranscript.metadata.participants.length,
    wordCount,
    averageConfidence: Math.round(averageConfidence * 100) / 100,
    speakingTime,
    duration: formattedTranscript.metadata.duration
  };
}

/**
 * Validate transcript format
 * @param {StreamTranscript} transcript - Raw transcript to validate
 * @returns {Object} Validation result
 */
function validateTranscript(transcript) {
  const errors = [];
  const warnings = [];
  
  // Check basic structure
  if (!transcript) {
    errors.push('Transcript is null or undefined');
    return { isValid: false, errors, warnings };
  }
  
  if (!transcript.entries || !Array.isArray(transcript.entries)) {
    errors.push('Missing or invalid entries array');
  } else if (transcript.entries.length === 0) {
    warnings.push('Transcript contains no entries');
  }
  
  // Check entry structure
  transcript.entries?.forEach((entry, index) => {
    if (!entry.text || entry.text.trim() === '') {
      warnings.push(`Entry ${index} has empty text`);
    }
    
    if (!entry.speakerDisplayName) {
      warnings.push(`Entry ${index} missing speaker name`);
    }
    
    if (!entry.startOffset || !entry.endOffset) {
      errors.push(`Entry ${index} missing timestamp information`);
    }
    
    if (entry.confidence < 0.5) {
      warnings.push(`Entry ${index} has low confidence (${entry.confidence})`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Split large transcripts into chunks for AI processing
 * @param {FormattedTranscript} formattedTranscript - Formatted transcript
 * @param {number} maxTokens - Maximum tokens per chunk (approximate)
 * @returns {FormattedTranscript[]} Array of transcript chunks
 */
function chunkTranscript(formattedTranscript, maxTokens = 4000) {
  const sections = formattedTranscript.sections;
  const chunks = [];
  let currentChunk = [];
  let currentTokens = 0;
  
  // Rough estimation: 1 token ≈ 4 characters for Chinese text
  const estimateTokens = (text) => Math.ceil(text.length / 4);
  
  sections.forEach(section => {
    const sectionTokens = estimateTokens(section.text);
    
    // If adding this section would exceed limit, start new chunk
    if (currentTokens + sectionTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(createChunk(currentChunk, formattedTranscript.metadata));
      currentChunk = [];
      currentTokens = 0;
    }
    
    currentChunk.push(section);
    currentTokens += sectionTokens;
  });
  
  // Add the last chunk
  if (currentChunk.length > 0) {
    chunks.push(createChunk(currentChunk, formattedTranscript.metadata));
  }
  
  return chunks;
}

/**
 * Create a chunk from sections
 * @param {TranscriptSection[]} sections - Sections for this chunk
 * @param {Object} originalMetadata - Original transcript metadata
 * @returns {FormattedTranscript} Chunk as formatted transcript
 */
function createChunk(sections, originalMetadata) {
  const chunkContent = generateFormattedContent(sections);
  const chunkParticipants = [...new Set(sections.map(s => s.speaker))];
  
  return {
    metadata: {
      ...originalMetadata,
      participants: chunkParticipants,
      totalEntries: sections.length,
      startTime: sections[0].startTime,
      endTime: sections[sections.length - 1].endTime,
      isChunk: true
    },
    content: chunkContent,
    sections
  };
}

// CommonJS exports for Node.js/Jest compatibility
module.exports = {
  formatTranscriptForAI,
  createPreview,
  getTranscriptStats,
  validateTranscript,
  chunkTranscript
};