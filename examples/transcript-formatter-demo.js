/**
 * Demo script to test the transcript formatter with real Stream Content.json data
 */

const fs = require('fs');
const path = require('path');
const { 
  formatTranscriptForAI, 
  createPreview, 
  getTranscriptStats, 
  validateTranscript,
  chunkTranscript
} = require('../src/utils/transcriptFormatter.js');

function main() {
  console.log('🚀 Testing Transcript Formatter with anonymized sample data\n');

  try {
    // Load the anonymized test transcript data
    const transcriptPath = path.join(__dirname, '../test/fixtures/sample-transcript.json');
    const rawData = fs.readFileSync(transcriptPath, 'utf8');
    const transcript = JSON.parse(rawData);

    console.log('📄 Loaded anonymized transcript from:', transcriptPath);
    console.log('📊 Raw entries count:', transcript.entries.length);
    console.log('👥 Raw events count:', transcript.events.length);
    console.log();

    // Validate the transcript
    console.log('🔍 Validating transcript...');
    const validation = validateTranscript(transcript);
    console.log('✅ Valid:', validation.isValid);
    if (validation.warnings.length > 0) {
      console.log('⚠️  Warnings:', validation.warnings);
    }
    if (validation.errors.length > 0) {
      console.log('❌ Errors:', validation.errors);
    }
    console.log();

    // Format for AI
    console.log('🔄 Formatting transcript for AI...');
    const formatted = formatTranscriptForAI(transcript);
    
    console.log('📋 Formatted Metadata:');
    console.log('  Participants:', formatted.metadata.participants);
    console.log('  Duration:', formatted.metadata.duration);
    console.log('  Language:', formatted.metadata.language);
    console.log('  Total Entries:', formatted.metadata.totalEntries);
    console.log('  Start Time:', formatted.metadata.startTime);
    console.log('  End Time:', formatted.metadata.endTime);
    console.log('  Sections Count:', formatted.sections.length);
    console.log();

    // Show preview
    console.log('👀 Content Preview (first 5 lines):');
    const preview = createPreview(formatted, 5);
    console.log(preview);
    console.log();

    // Get statistics
    console.log('📈 Transcript Statistics:');
    const stats = getTranscriptStats(formatted);
    console.log('  Total Sections:', stats.totalSections);
    console.log('  Total Participants:', stats.totalParticipants);
    console.log('  Word Count:', stats.wordCount);
    console.log('  Average Confidence:', stats.averageConfidence);
    console.log('  Speaking Time per Participant:');
    Object.entries(stats.speakingTime).forEach(([speaker, time]) => {
      console.log(`    ${speaker}: ${time}`);
    });
    console.log();

    // Test chunking with different sizes
    console.log('✂️  Testing chunking capabilities:');
    const smallChunks = chunkTranscript(formatted, 1000);
    const mediumChunks = chunkTranscript(formatted, 4000);
    const largeChunks = chunkTranscript(formatted, 10000);
    
    console.log(`  Small chunks (1000 tokens): ${smallChunks.length} chunks`);
    console.log(`  Medium chunks (4000 tokens): ${mediumChunks.length} chunks`);
    console.log(`  Large chunks (10000 tokens): ${largeChunks.length} chunks`);
    console.log();

    // Show first chunk details if multiple chunks
    if (smallChunks.length > 1) {
      console.log('📄 First small chunk metadata:');
      console.log('  Participants:', smallChunks[0].metadata.participants);
      console.log('  Start Time:', smallChunks[0].metadata.startTime);
      console.log('  End Time:', smallChunks[0].metadata.endTime);
      console.log('  Sections:', smallChunks[0].sections.length);
      console.log();
    }

    // Export formatted content for inspection
    const outputPath = path.join(__dirname, 'formatted-transcript.txt');
    fs.writeFileSync(outputPath, formatted.content, 'utf8');
    console.log('💾 Formatted content saved to:', outputPath);

    // Export metadata as JSON
    const metadataPath = path.join(__dirname, 'transcript-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify({
      metadata: formatted.metadata,
      stats: stats,
      chunkSizes: {
        small: smallChunks.length,
        medium: mediumChunks.length, 
        large: largeChunks.length
      }
    }, null, 2), 'utf8');
    console.log('📊 Metadata saved to:', metadataPath);

    console.log('\n✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error running demo:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}