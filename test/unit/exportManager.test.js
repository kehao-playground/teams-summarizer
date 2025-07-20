/**
 * Unit Tests for Export Manager
 * Tests all export formats and functionality
 */

const { ExportManager, EXPORT_FORMATS } = require('../../src/export/exportManager');

// Mock DOM elements for browser-specific tests
global.document = {
    createElement: jest.fn().mockReturnValue({
        href: '',
        download: '',
        style: { display: '' },
        click: jest.fn(),
        focus: jest.fn(),
        select: jest.fn()
    }),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    },
    execCommand: jest.fn().mockReturnValue(true)
};

global.URL = {
    createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: jest.fn()
};

global.Blob = jest.fn().mockImplementation((content, options) => ({
    content,
    options
}));

// Mock navigator for clipboard tests
global.navigator = {
    clipboard: {
        writeText: jest.fn().mockResolvedValue()
    }
};

// Mock console to avoid noise in tests
console.log = jest.fn();
console.error = jest.fn();

describe('ExportManager', () => {
    let exportManager;
    
    const mockSummaryData = {
        summary: `# Meeting Summary
        
## Key Discussion Points
- Project timeline discussion
- Budget allocation review
- Resource planning

## Decisions Made
- Approved Q2 budget increase
- Extended project deadline by 2 weeks

## Action Items
- John: Update project timeline (Due: Friday)
- Sarah: Prepare budget report (Due: Monday)`,
        metadata: {
            title: 'Q2 Planning Meeting',
            participants: ['John Smith', 'Sarah Johnson', 'Mike Chen'],
            duration: '01:30:00',
            language: 'en',
            totalEntries: 156,
            generatedAt: '2024-01-15T14:30:00.000Z',
            model: 'gpt-4.1',
            usage: {
                total_tokens: 2450,
                prompt_tokens: 2000,
                completion_tokens: 450
            },
            processingTime: 3500
        }
    };

    beforeEach(() => {
        exportManager = new ExportManager();
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('should initialize with supported formats', () => {
            expect(exportManager.supportedFormats).toContain(EXPORT_FORMATS.MARKDOWN);
            expect(exportManager.supportedFormats).toContain(EXPORT_FORMATS.HTML);
            expect(exportManager.supportedFormats).toContain(EXPORT_FORMATS.TEXT);
        });

        test('should provide supported formats metadata', () => {
            const formats = exportManager.getSupportedFormats();
            expect(formats).toHaveLength(3);
            expect(formats[0]).toHaveProperty('id');
            expect(formats[0]).toHaveProperty('name');
            expect(formats[0]).toHaveProperty('extension');
            expect(formats[0]).toHaveProperty('mimeType');
        });
    });

    describe('Format Validation', () => {
        test('should validate supported formats', () => {
            expect(exportManager.isValidFormat(EXPORT_FORMATS.MARKDOWN)).toBe(true);
            expect(exportManager.isValidFormat(EXPORT_FORMATS.HTML)).toBe(true);
            expect(exportManager.isValidFormat(EXPORT_FORMATS.TEXT)).toBe(true);
        });

        test('should reject invalid formats', () => {
            expect(exportManager.isValidFormat('invalid')).toBe(false);
            expect(exportManager.isValidFormat('')).toBe(false);
            expect(exportManager.isValidFormat(null)).toBe(false);
        });
    });

    describe('Export Summary', () => {
        test('should export summary in markdown format', async () => {
            const result = await exportManager.exportSummary(mockSummaryData, EXPORT_FORMATS.MARKDOWN);
            
            expect(result.format).toBe(EXPORT_FORMATS.MARKDOWN);
            expect(result.contentType).toBe('text/markdown');
            expect(result.filename).toContain('.md');
            expect(result.content).toContain('# Q2 Planning Meeting');
            expect(result.content).toContain('**Duration:** 01:30:00');
            expect(result.content).toContain('**Participants:** John Smith, Sarah Johnson, Mike Chen');
            expect(result.content).toContain('Meeting Summary');
        });

        test('should export summary in HTML format', async () => {
            const result = await exportManager.exportSummary(mockSummaryData, EXPORT_FORMATS.HTML);
            
            expect(result.format).toBe(EXPORT_FORMATS.HTML);
            expect(result.contentType).toBe('text/html');
            expect(result.filename).toContain('.html');
            expect(result.content).toContain('<!DOCTYPE html>');
            expect(result.content).toContain('<title>Q2 Planning Meeting</title>');
            expect(result.content).toContain('<h1>Q2 Planning Meeting</h1>');
            expect(result.content).toContain('font-family:');
        });

        test('should export summary in text format', async () => {
            const result = await exportManager.exportSummary(mockSummaryData, EXPORT_FORMATS.TEXT);
            
            expect(result.format).toBe(EXPORT_FORMATS.TEXT);
            expect(result.contentType).toBe('text/plain');
            expect(result.filename).toContain('.txt');
            expect(result.content).toContain('Q2 PLANNING MEETING');
            expect(result.content).toContain('MEETING INFORMATION');
            expect(result.content).toContain('Duration: 01:30:00');
            expect(result.content).toContain('Participants: John Smith, Sarah Johnson, Mike Chen');
        });

        test('should handle missing optional data gracefully', async () => {
            const minimalData = {
                summary: 'Basic meeting summary',
                metadata: {}
            };

            const result = await exportManager.exportSummary(minimalData, EXPORT_FORMATS.MARKDOWN);
            expect(result.content).toContain('Meeting Summary');
            expect(result.content).toContain('Basic meeting summary');
        });

        test('should throw error for invalid format', async () => {
            await expect(exportManager.exportSummary(mockSummaryData, 'invalid'))
                .rejects.toThrow('Unsupported export format');
        });

        test('should throw error for missing summary data', async () => {
            await expect(exportManager.exportSummary(null))
                .rejects.toThrow('Invalid summary data');
                
            await expect(exportManager.exportSummary({}))
                .rejects.toThrow('Invalid summary data');
        });
    });

    describe('Markdown Generation', () => {
        test('should generate complete markdown with all metadata', () => {
            const options = { includeMetadata: true, includeBranding: true };
            const markdown = exportManager.generateMarkdown(mockSummaryData, options);
            
            expect(markdown).toContain('# Q2 Planning Meeting');
            expect(markdown).toContain('## Meeting Information');
            expect(markdown).toContain('**Duration:** 01:30:00');
            expect(markdown).toContain('**Participants:** John Smith, Sarah Johnson, Mike Chen');
            expect(markdown).toContain('**Language:** en');
            expect(markdown).toContain('**AI Model:** gpt-4.1');
            expect(markdown).toContain('## Processing Information');
            expect(markdown).toContain('**Tokens Used:** 2,450');
            expect(markdown).toContain('**Processing Time:** 3500ms');
            expect(markdown).toContain('*Generated by Teams Transcript Extension*');
        });

        test('should generate minimal markdown without metadata', () => {
            const options = { includeMetadata: false, includeBranding: false };
            const markdown = exportManager.generateMarkdown(mockSummaryData, options);
            
            expect(markdown).toContain('# Q2 Planning Meeting');
            expect(markdown).toContain('## Summary');
            expect(markdown).not.toContain('## Meeting Information');
            expect(markdown).not.toContain('## Processing Information');
            expect(markdown).not.toContain('*Generated by Teams Transcript Extension*');
        });
    });

    describe('HTML Generation', () => {
        test('should generate valid HTML with styling', () => {
            const options = { includeMetadata: true, includeBranding: true };
            const html = exportManager.generateHTML(mockSummaryData, options);
            
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html lang="en">');
            expect(html).toContain('<title>Q2 Planning Meeting</title>');
            expect(html).toContain('<style>');
            expect(html).toContain('font-family:');
            expect(html).toContain('<h1>Q2 Planning Meeting</h1>');
            expect(html).toContain('<div class="metadata">');
            expect(html).toContain('<span class="metadata-label">Duration:</span>');
            expect(html).toContain('</html>');
        });

        test('should escape HTML special characters', () => {
            const dataWithSpecialChars = {
                summary: 'Meeting with <script>alert("test")</script> & other content',
                metadata: {
                    title: 'Meeting <Title> & More'
                }
            };
            
            const html = exportManager.generateHTML(dataWithSpecialChars, {});
            
            expect(html).toContain('&lt;script&gt;');
            expect(html).toContain('&amp;');
            expect(html).not.toContain('<script>');
        });
    });

    describe('Text Generation', () => {
        test('should generate properly formatted plain text', () => {
            const options = { includeMetadata: true, includeBranding: true };
            const text = exportManager.generateText(mockSummaryData, options);
            
            expect(text).toContain('Q2 PLANNING MEETING');
            expect(text).toContain('MEETING INFORMATION');
            expect(text).toContain('Duration: 01:30:00');
            expect(text).toContain('SUMMARY');
            expect(text).toContain('PROCESSING INFORMATION');
            expect(text).toContain('Generated by Teams Transcript Extension');
            expect(text).toContain('='.repeat(60));
        });

        test('should format content properly', () => {
            const text = exportManager.generateText(mockSummaryData, {});
            
            // Should remove markdown formatting
            expect(text).not.toContain('##');
            expect(text).not.toContain('**');
            expect(text).toContain('• '); // Bullet points
        });
    });

    describe('Filename Generation', () => {
        test('should generate filename with title and date', () => {
            const filename = exportManager.generateFilename(mockSummaryData, EXPORT_FORMATS.MARKDOWN, {});
            
            expect(filename).toContain('q2_planning_meeting');
            expect(filename).toContain('2024-01-15');
            expect(filename).toContain('.md');
        });

        test('should sanitize invalid filename characters', () => {
            const dataWithInvalidChars = {
                metadata: {
                    title: 'Meeting <Title>: Q2/Q3 "Planning" & Review*'
                }
            };
            
            const filename = exportManager.generateFilename(dataWithInvalidChars, EXPORT_FORMATS.HTML, {});
            
            expect(filename).not.toContain('<');
            expect(filename).not.toContain('>');
            expect(filename).not.toContain(':');
            expect(filename).not.toContain('/');
            expect(filename).not.toContain('"');
            expect(filename).not.toContain('*');
            expect(filename).toContain('_');
        });

        test('should handle missing title gracefully', () => {
            const dataWithoutTitle = {
                metadata: {
                    generatedAt: '2024-01-15T14:30:00.000Z'
                }
            };
            
            const filename = exportManager.generateFilename(dataWithoutTitle, EXPORT_FORMATS.TEXT, {});
            
            expect(filename).toContain('meeting-summary');
            expect(filename).toContain('2024-01-15');
            expect(filename).toContain('.txt');
        });

        test('should include timestamp when requested', () => {
            const filename = exportManager.generateFilename(
                mockSummaryData, 
                EXPORT_FORMATS.MARKDOWN, 
                { includeTimestamp: true }
            );
            
            expect(filename).toMatch(/_\d{4}\.md$/);
        });
    });

    describe('Clipboard Functionality', () => {
        test('should copy content to clipboard successfully', async () => {
            const content = 'Test content for clipboard';
            const result = await exportManager.copyToClipboard(content);
            
            expect(result).toBe(true);
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);
        });

        test('should handle clipboard API failure with fallback', async () => {
            navigator.clipboard.writeText.mockRejectedValueOnce(new Error('API not available'));
            
            const content = 'Test content for fallback';
            const result = await exportManager.copyToClipboard(content);
            
            expect(result).toBe(true);
            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });

        test('should handle complete clipboard failure', async () => {
            navigator.clipboard.writeText.mockRejectedValueOnce(new Error('API not available'));
            document.execCommand.mockReturnValueOnce(false);
            
            const content = 'Test content for failure';
            const result = await exportManager.copyToClipboard(content);
            
            expect(result).toBe(false);
        });
    });

    describe('File Download', () => {
        test('should create download link correctly', () => {
            const content = 'Test file content';
            const filename = 'test-file.txt';
            const contentType = 'text/plain';
            
            exportManager.downloadFile(content, filename, contentType);
            
            expect(global.Blob).toHaveBeenCalledWith([content], { type: contentType });
            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(document.createElement).toHaveBeenCalledWith('a');
        });

        test('should handle download errors gracefully', () => {
            global.Blob.mockImplementationOnce(() => {
                throw new Error('Blob creation failed');
            });
            
            expect(() => {
                exportManager.downloadFile('content', 'file.txt', 'text/plain');
            }).toThrow('Failed to download file');
        });
    });

    describe('Helper Methods', () => {
        test('should extract meeting title from various metadata fields', () => {
            const testCases = [
                { metadata: { title: 'Title Field' }, expected: 'Title Field' },
                { metadata: { meetingTitle: 'Meeting Title Field' }, expected: 'Meeting Title Field' },
                { metadata: { subject: 'Subject Field' }, expected: 'Subject Field' },
                { metadata: { name: 'Name Field' }, expected: 'Name Field' },
                { metadata: {}, expected: null },
                { metadata: null, expected: null }
            ];
            
            testCases.forEach(({ metadata, expected }) => {
                expect(exportManager.extractMeetingTitle(metadata)).toBe(expected);
            });
        });

        test('should sanitize filenames properly', () => {
            const testCases = [
                { input: 'Normal Filename', expected: 'normal_filename' },
                { input: 'File<>:|?*Name', expected: 'file_name' },
                { input: '   Multiple   Spaces   ', expected: 'multiple_spaces' },
                { input: 'Very Long Filename That Exceeds The Character Limit For Safe File System Usage', expected: 'very_long_filename_that_exceeds_the_character_limi' }
            ];
            
            testCases.forEach(({ input, expected }) => {
                expect(exportManager.sanitizeFilename(input)).toBe(expected);
            });
        });

        test('should format timestamps correctly', () => {
            const date = new Date('2024-01-15T14:30:00.000Z');
            
            expect(exportManager.formatTimestamp(date, 'iso')).toBe('2024-01-15T14:30:00.000Z');
            expect(exportManager.formatTimestamp(date, 'local')).toContain('2024');
            expect(exportManager.formatTimestamp(date, 'short')).toContain('/15/2024');
        });

        test('should escape HTML characters correctly', () => {
            const input = '<script>alert("test")</script> & more';
            const expected = '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt; &amp; more';
            
            expect(exportManager.escapeHtml(input)).toBe(expected);
            expect(exportManager.escapeHtml('')).toBe('');
            expect(exportManager.escapeHtml(null)).toBe('');
        });

        test('should format HTML content correctly', () => {
            const input = '## Header\n\n- List item 1\n- List item 2\n\nParagraph text';
            const html = exportManager.formatHtmlContent(input);
            
            expect(html).toContain('<h2>Header</h2>');
            expect(html).toContain('<ul>');
            expect(html).toContain('<li>List item 1</li>');
            expect(html).toContain('<p>');
        });

        test('should format text content correctly', () => {
            const input = '## Header\n\n**Bold text** and *italic*\n\n- List item';
            const text = exportManager.formatTextContent(input);
            
            expect(text).not.toContain('##');
            expect(text).not.toContain('**');
            expect(text).not.toContain('*');
            expect(text).toContain('Bold text');
            expect(text).toContain('• ');
        });
    });

    describe('Export Options', () => {
        test('should respect includeMetadata option', async () => {
            const resultWithMetadata = await exportManager.exportSummary(
                mockSummaryData, 
                EXPORT_FORMATS.MARKDOWN, 
                { includeMetadata: true }
            );
            
            const resultWithoutMetadata = await exportManager.exportSummary(
                mockSummaryData, 
                EXPORT_FORMATS.MARKDOWN, 
                { includeMetadata: false }
            );
            
            expect(resultWithMetadata.content).toContain('## Meeting Information');
            expect(resultWithoutMetadata.content).not.toContain('## Meeting Information');
        });

        test('should respect includeBranding option', async () => {
            const resultWithBranding = await exportManager.exportSummary(
                mockSummaryData, 
                EXPORT_FORMATS.MARKDOWN, 
                { includeBranding: true }
            );
            
            const resultWithoutBranding = await exportManager.exportSummary(
                mockSummaryData, 
                EXPORT_FORMATS.MARKDOWN, 
                { includeBranding: false }
            );
            
            expect(resultWithBranding.content).toContain('Generated by Teams Transcript Extension');
            expect(resultWithoutBranding.content).not.toContain('Generated by Teams Transcript Extension');
        });

        test('should apply custom timestamp format', async () => {
            const result = await exportManager.exportSummary(
                mockSummaryData, 
                EXPORT_FORMATS.MARKDOWN, 
                { timestampFormat: 'local' }
            );
            
            expect(result.content).not.toContain('2024-01-15T14:30:00.000Z');
            expect(result.content).toContain('2024');
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty summary content', async () => {
            const emptyData = {
                summary: '',
                metadata: { title: 'Empty Meeting' }
            };
            
            const result = await exportManager.exportSummary(emptyData, EXPORT_FORMATS.MARKDOWN);
            expect(result.content).toContain('# Empty Meeting');
            expect(result.content).toContain('## Summary');
        });

        test('should handle very long content', async () => {
            const longData = {
                summary: 'Very long summary content. '.repeat(1000),
                metadata: { title: 'Long Meeting' }
            };
            
            const result = await exportManager.exportSummary(longData, EXPORT_FORMATS.HTML);
            expect(result.size).toBeGreaterThan(10000);
            expect(result.content).toContain('Very long summary content');
        });

        test('should handle non-English content', async () => {
            const chineseData = {
                summary: '會議摘要：討論項目進度和預算分配',
                metadata: {
                    title: '第二季規劃會議',
                    participants: ['王小明', '李小華'],
                    language: 'zh-TW'
                }
            };
            
            const result = await exportManager.exportSummary(chineseData, EXPORT_FORMATS.MARKDOWN);
            expect(result.content).toContain('第二季規劃會議');
            expect(result.content).toContain('會議摘要');
            expect(result.content).toContain('王小明, 李小華');
        });
    });
});