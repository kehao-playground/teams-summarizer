/**
 * Transcript Formatter Module (TypeScript)
 * 
 * Transforms Microsoft Stream API transcript responses into AI-ready format.
 * Features:
 * - Speaker grouping for better context
 * - Timestamp conversion to readable format
 * - Participant extraction and duration calculation
 * - Multi-language support (especially Chinese zh-tw)
 * - Confidence score preservation
 */

import { StreamTranscript, TranscriptEntry, FormattedTranscript, TranscriptSection } from './types';

/**
 * Format a Stream API transcript for AI processing
 * @param transcript - Raw transcript from Stream API
 * @returns AI-ready transcript with metadata
 */
export function formatTranscriptForAI(transcript: StreamTranscript): FormattedTranscript {
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
 * @param entries - Transcript entries
 * @returns Array of unique speaker names
 */
function extractParticipants(entries: TranscriptEntry[]): string[] {
  const speakerNames = new Set<string>();
  
  entries.forEach(entry => {
    if (entry.speakerDisplayName && entry.speakerDisplayName.trim()) {
      speakerNames.add(entry.speakerDisplayName.trim());
    }
  });
  
  return Array.from(speakerNames).sort();
}

/**
 * Calculate meeting duration from first to last entry
 * @param entries - Transcript entries
 * @returns Duration in HH:MM:SS format
 */
function calculateDuration(entries: TranscriptEntry[]): string {
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
 * @param timestamp - Format: "HH:MM:SS.fffffff"
 * @returns Total seconds
 */
function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':');
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseFloat(parts[2]) || 0;
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds back to timestamp string
 * @param totalSeconds - Total seconds
 * @returns Formatted timestamp HH:MM:SS
 */
function formatSecondsToTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp for display (remove milliseconds)
 * @param timestamp - Format: "HH:MM:SS.fffffff"
 * @returns Clean timestamp "HH:MM:SS"
 */
function formatTimestamp(timestamp: string): string {
  return timestamp.split('.')[0];
}

/**
 * Group consecutive entries by speaker
 * @param entries - Transcript entries
 * @returns Grouped sections
 */
function groupBySpeaker(entries: TranscriptEntry[]): TranscriptSection[] {
  const sections: TranscriptSection[] = [];
  let currentSection: TranscriptSection | null = null;
  
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
 * @param sections - Grouped transcript sections
 * @returns Formatted content for AI
 */
function generateFormattedContent(sections: TranscriptSection[]): string {
  const lines = sections.map(section => {
    // Format: [HH:MM:SS] Speaker Name: Text content
    return `[${section.startTime}] ${section.speaker}: ${section.text}`;
  });
  
  return lines.join('\n');
}

/**
 * Create a summary preview of the transcript
 * @param formattedTranscript - Formatted transcript
 * @param maxLines - Maximum lines for preview (default: 10)
 * @returns Preview text
 */
export function createPreview(formattedTranscript: FormattedTranscript, maxLines: number = 10): string {
  const lines = formattedTranscript.content.split('\n');
  const preview = lines.slice(0, maxLines).join('\n');
  
  if (lines.length > maxLines) {
    return preview + `\n... (${lines.length - maxLines} more lines)`;
  }
  
  return preview;
}

/**
 * Transcript statistics interface
 */
export interface TranscriptStats {
  totalSections: number;
  totalParticipants: number;
  wordCount: number;
  averageConfidence: number;
  speakingTime: Record<string, string>;
  duration: string;
}

/**
 * Get transcript statistics
 * @param formattedTranscript - Formatted transcript
 * @returns Statistics object
 */
export function getTranscriptStats(formattedTranscript: FormattedTranscript): TranscriptStats {
  const sections = formattedTranscript.sections;
  const wordCount = formattedTranscript.content.split(/\s+/).length;
  
  // Calculate speaking time per participant
  const speakingTime: Record<string, number> = {};
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
  const formattedSpeakingTime: Record<string, string> = {};
  Object.keys(speakingTime).forEach(speaker => {
    formattedSpeakingTime[speaker] = formatSecondsToTimestamp(speakingTime[speaker]);
  });
  
  // Calculate average confidence
  const totalConfidence = sections.reduce((sum, section) => sum + section.confidence, 0);
  const averageConfidence = sections.length > 0 ? totalConfidence / sections.length : 0;
  
  return {
    totalSections: sections.length,
    totalParticipants: formattedTranscript.metadata.participants.length,
    wordCount,
    averageConfidence: Math.round(averageConfidence * 100) / 100,
    speakingTime: formattedSpeakingTime,
    duration: formattedTranscript.metadata.duration
  };
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate transcript format
 * @param transcript - Raw transcript to validate
 * @returns Validation result
 */
export function validateTranscript(transcript: StreamTranscript | null): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
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
 * @param formattedTranscript - Formatted transcript
 * @param maxTokens - Maximum tokens per chunk (approximate)
 * @returns Array of transcript chunks
 */
export function chunkTranscript(formattedTranscript: FormattedTranscript, maxTokens: number = 4000): FormattedTranscript[] {
  const sections = formattedTranscript.sections;
  const chunks: FormattedTranscript[] = [];
  let currentChunk: TranscriptSection[] = [];
  let currentTokens = 0;
  
  // Rough estimation: 1 token ≈ 4 characters for Chinese text
  const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
  
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
 * @param sections - Sections for this chunk
 * @param originalMetadata - Original transcript metadata
 * @returns Chunk as formatted transcript
 */
function createChunk(sections: TranscriptSection[], originalMetadata: FormattedTranscript['metadata']): FormattedTranscript {
  const chunkContent = generateFormattedContent(sections);
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