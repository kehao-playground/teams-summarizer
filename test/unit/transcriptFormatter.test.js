/**
 * Test suite for transcriptFormatter.js
 */

const { 
  formatTranscriptForAI, 
  createPreview, 
  getTranscriptStats, 
  validateTranscript,
  chunkTranscript
} = require('../../src/utils/transcriptFormatter.js');

// Mock transcript data with anonymized test data
const mockTranscript = {
  "$schema": "http://stream.office.com/schemas/transcript.json",
  "version": "1.0.0",
  "type": "Transcript",
  "entries": [
    {
      "id": "1",
      "speechServiceResultId": "test1",
      "text": "大家好，歡迎參加今天的產品會議。",
      "speakerId": "speaker1",
      "speakerDisplayName": "Alice 王",
      "confidence": 0.8641199,
      "startOffset": "00:00:08.8273871",
      "endOffset": "00:00:11.2673871",
      "hasBeenEdited": false,
      "roomId": null,
      "spokenLanguageTag": "zh-tw"
    },
    {
      "id": "2", 
      "speechServiceResultId": "test2",
      "text": "我們今天要討論新功能的開發進度。",
      "speakerId": "speaker1",
      "speakerDisplayName": "Alice 王",
      "confidence": 0.8828849,
      "startOffset": "00:00:12.0773871",
      "endOffset": "00:00:42.0773871",
      "hasBeenEdited": false,
      "roomId": null,
      "spokenLanguageTag": "zh-tw"
    },
    {
      "id": "3",
      "speechServiceResultId": "test3", 
      "text": "好的，我們來討論一下技術架構。",
      "speakerId": "speaker2",
      "speakerDisplayName": "Bob 李",
      "confidence": 0.9123456,
      "startOffset": "00:00:43.0000000",
      "endOffset": "00:00:48.0000000",
      "hasBeenEdited": false,
      "roomId": null,
      "spokenLanguageTag": "zh-tw"
    },
    {
      "id": "4",
      "speechServiceResultId": "test4",
      "text": "那我們先確認一下時程規劃。",
      "speakerId": "speaker2", 
      "speakerDisplayName": "Bob 李",
      "confidence": 0.8945678,
      "startOffset": "00:00:49.0000000",
      "endOffset": "00:00:52.0000000",
      "hasBeenEdited": false,
      "roomId": null,
      "spokenLanguageTag": "zh-tw"
    }
  ],
  "events": [
    {
      "id": "event1",
      "eventType": "CallStarted",
      "userId": "user1",
      "userDisplayName": "Bob 李",
      "startOffset": "00:00:03.1802775"
    }
  ]
};

const emptyTranscript = {
  "$schema": "http://stream.office.com/schemas/transcript.json",
  "version": "1.0.0", 
  "type": "Transcript",
  "entries": [],
  "events": []
};

describe('TranscriptFormatter', () => {
  
  describe('formatTranscriptForAI', () => {
    test('should format a valid transcript correctly', () => {
      const result = formatTranscriptForAI(mockTranscript);
      
      // Check metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.participants).toEqual(['Alice 王', 'Bob 李']);
      expect(result.metadata.language).toBe('zh-tw');
      expect(result.metadata.totalEntries).toBe(4);
      expect(result.metadata.startTime).toBe('00:00:08');
      expect(result.metadata.endTime).toBe('00:00:52');
      expect(result.metadata.duration).toBe('00:00:43'); // 52 - 8.8273871 ≈ 43 seconds
      
      // Check content format
      expect(result.content).toContain('[00:00:08] Alice 王: 大家好，歡迎參加今天的產品會議。 我們今天要討論新功能的開發進度。');
      expect(result.content).toContain('[00:00:43] Bob 李: 好的，我們來討論一下技術架構。 那我們先確認一下時程規劃。');
      
      // Check sections grouping
      expect(result.sections).toHaveLength(2); // Two speakers
      expect(result.sections[0].speaker).toBe('Alice 王');
      expect(result.sections[1].speaker).toBe('Bob 李');
    });
    
    test('should handle single speaker transcript', () => {
      const singleSpeakerTranscript = {
        ...mockTranscript,
        entries: [mockTranscript.entries[0]]
      };
      
      const result = formatTranscriptForAI(singleSpeakerTranscript);
      
      expect(result.metadata.participants).toEqual(['Alice 王']);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].speaker).toBe('Alice 王');
    });
    
    test('should throw error for empty transcript', () => {
      expect(() => formatTranscriptForAI(emptyTranscript)).toThrow('Invalid transcript: no entries found');
    });
    
    test('should throw error for null transcript', () => {
      expect(() => formatTranscriptForAI(null)).toThrow('Invalid transcript: no entries found');
    });
    
    test('should handle missing speaker names gracefully', () => {
      const transcriptWithMissingSpeaker = {
        ...mockTranscript,
        entries: [{
          ...mockTranscript.entries[0],
          speakerDisplayName: ''
        }]
      };
      
      const result = formatTranscriptForAI(transcriptWithMissingSpeaker);
      expect(result.sections[0].speaker).toBe('Unknown');
    });
  });

  describe('createPreview', () => {
    test('should create preview with default line limit', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      const preview = createPreview(formatted);
      
      const lines = preview.split('\n');
      expect(lines.length).toBeLessThanOrEqual(10);
      expect(preview).toContain('[00:00:08] Alice 王:');
    });
    
    test('should create preview with custom line limit', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      const preview = createPreview(formatted, 1);
      
      const lines = preview.split('\n');
      expect(lines.length).toBe(2); // 1 line + "... more lines"
      expect(preview).toContain('... (1 more lines)');
    });
    
    test('should handle short transcripts without truncation', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      const preview = createPreview(formatted, 100);
      
      expect(preview).not.toContain('... more lines');
    });
  });

  describe('getTranscriptStats', () => {
    test('should calculate correct statistics', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      const stats = getTranscriptStats(formatted);
      
      expect(stats.totalSections).toBe(2);
      expect(stats.totalParticipants).toBe(2);
      expect(stats.wordCount).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeCloseTo(0.89, 2);
      expect(stats.speakingTime).toHaveProperty('Alice 王');
      expect(stats.speakingTime).toHaveProperty('Bob 李');
      expect(stats.duration).toBe('00:00:43');
    });
    
    test('should handle empty sections', () => {
      const emptyFormatted = {
        metadata: { participants: [], duration: '00:00:00' },
        content: '',
        sections: []
      };
      
      const stats = getTranscriptStats(emptyFormatted);
      expect(stats.totalSections).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });

  describe('validateTranscript', () => {
    test('should validate correct transcript', () => {
      const result = validateTranscript(mockTranscript);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should detect null transcript', () => {
      const result = validateTranscript(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transcript is null or undefined');
    });
    
    test('should detect missing entries', () => {
      const result = validateTranscript({ entries: [] });
      
      expect(result.isValid).toBe(true); // Empty is not invalid, just warning
      expect(result.warnings).toContain('Transcript contains no entries');
    });
    
    test('should detect entry validation issues', () => {
      const badTranscript = {
        entries: [
          {
            text: '',
            speakerDisplayName: '',
            startOffset: '',
            endOffset: '',
            confidence: 0.3
          }
        ]
      };
      
      const result = validateTranscript(badTranscript);
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Entry 0 has empty text');
      expect(result.warnings).toContain('Entry 0 missing speaker name'); 
      expect(result.warnings).toContain('Entry 0 has low confidence (0.3)');
      expect(result.errors).toContain('Entry 0 missing timestamp information');
    });
  });

  describe('chunkTranscript', () => {
    test('should chunk large transcript correctly', () => {
      // Create a large transcript by repeating entries with very long text
      const longText = '這是很長的會議內容，包含大量的中文文字來確保超過token限制。'.repeat(50); // Much longer text
      const largeTranscript = {
        ...mockTranscript,
        entries: Array(20).fill(null).map((_, i) => ({
          ...mockTranscript.entries[0],
          id: `entry-${i}`,
          text: longText + `第${i}段會議記錄。`,
          speakerDisplayName: i % 2 === 0 ? 'Alice 王' : 'Bob 李',
          startOffset: `00:${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}.0000000`,
          endOffset: `00:${Math.floor((i + 1) / 60).toString().padStart(2, '0')}:${((i + 1) % 60).toString().padStart(2, '0')}.0000000`
        }))
      };
      
      const formatted = formatTranscriptForAI(largeTranscript);
      const chunks = chunkTranscript(formatted, 500); // Very small chunk size to force splitting
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should be a valid formatted transcript
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('metadata');
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('sections');
        expect(chunk.metadata.isChunk).toBe(true);
      });
    });
    
    test('should not chunk small transcript', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      const chunks = chunkTranscript(formatted, 10000); // Large chunk size
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(formatted.content);
    });
    
    test('should handle empty transcript', () => {
      const emptyFormatted = {
        metadata: { participants: [], duration: '00:00:00' },
        content: '',
        sections: []
      };
      
      const chunks = chunkTranscript(emptyFormatted);
      expect(chunks).toHaveLength(0);
    });
  });

  describe('Speaker grouping', () => {
    test('should group consecutive entries from same speaker', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      
      // Should have 2 sections: Alice 王 (entries 1-2) and Bob 李 (entries 3-4)
      expect(formatted.sections).toHaveLength(2);
      
      const firstSection = formatted.sections[0];
      expect(firstSection.speaker).toBe('Alice 王');
      expect(firstSection.text).toContain('大家好，歡迎參加今天的產品會議。 我們今天要討論新功能的開發進度。');
      
      const secondSection = formatted.sections[1]; 
      expect(secondSection.speaker).toBe('Bob 李');
      expect(secondSection.text).toContain('好的，我們來討論一下技術架構。 那我們先確認一下時程規劃。');
    });
    
    test('should calculate average confidence for grouped sections', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      
      const firstSection = formatted.sections[0];
      // Average of 0.8641199 and 0.8828849
      expect(firstSection.confidence).toBeCloseTo(0.8735024, 5);
      
      const secondSection = formatted.sections[1];
      // Average of 0.9123456 and 0.8945678  
      expect(secondSection.confidence).toBeCloseTo(0.9034567, 5);
    });
  });

  describe('Timestamp handling', () => {
    test('should format timestamps correctly', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      
      expect(formatted.metadata.startTime).toBe('00:00:08');
      expect(formatted.metadata.endTime).toBe('00:00:52');
      expect(formatted.metadata.duration).toBe('00:00:43');
    });
    
    test('should handle timestamps across hours', () => {
      const longTranscript = {
        ...mockTranscript,
        entries: [
          {
            ...mockTranscript.entries[0],
            startOffset: "01:23:45.0000000",
            endOffset: "01:23:50.0000000"
          },
          {
            ...mockTranscript.entries[1], 
            startOffset: "02:30:15.0000000",
            endOffset: "02:30:20.0000000"
          }
        ]
      };
      
      const formatted = formatTranscriptForAI(longTranscript);
      expect(formatted.metadata.startTime).toBe('01:23:45');
      expect(formatted.metadata.endTime).toBe('02:30:20');
      expect(formatted.metadata.duration).toBe('01:06:35'); // Duration calculation
    });
  });

  describe('Chinese language support', () => {
    test('should preserve Chinese characters correctly', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      
      expect(formatted.content).toContain('大家好，歡迎參加今天的產品會議');
      expect(formatted.content).toContain('我們今天要討論新功能的開發進度');
      expect(formatted.content).toContain('好的，我們來討論一下技術架構');
      
      expect(formatted.metadata.participants).toContain('Alice 王');
      expect(formatted.metadata.participants).toContain('Bob 李');
    });
    
    test('should detect Chinese language tag', () => {
      const formatted = formatTranscriptForAI(mockTranscript);
      expect(formatted.metadata.language).toBe('zh-tw');
    });
  });
});