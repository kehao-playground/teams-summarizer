/**
 * Export Manager for Teams Transcript Chrome Extension
 * Handles multiple export formats for generated summaries
 */

// Export format constants
const EXPORT_FORMATS = {
    MARKDOWN: 'markdown',
    HTML: 'html',
    TEXT: 'text'
};

// File extensions mapping
const FILE_EXTENSIONS = {
    [EXPORT_FORMATS.MARKDOWN]: '.md',
    [EXPORT_FORMATS.HTML]: '.html',
    [EXPORT_FORMATS.TEXT]: '.txt'
};

// MIME types for download
const MIME_TYPES = {
    [EXPORT_FORMATS.MARKDOWN]: 'text/markdown',
    [EXPORT_FORMATS.HTML]: 'text/html',
    [EXPORT_FORMATS.TEXT]: 'text/plain'
};

/**
 * Export Manager class
 */
class ExportManager {
    constructor() {
        this.supportedFormats = Object.values(EXPORT_FORMATS);
    }

    /**
     * Export summary in specified format
     * @param {Object} summaryData - Generated summary with metadata
     * @param {string} format - Export format (markdown, html, text)
     * @param {Object} options - Export options
     * @returns {Promise<Object>} Export result with content and metadata
     */
    async exportSummary(summaryData, format = EXPORT_FORMATS.MARKDOWN, options = {}) {
        if (!this.isValidFormat(format)) {
            throw new Error(`Unsupported export format: ${format}. Supported formats: ${this.supportedFormats.join(', ')}`);
        }

        if (!summaryData || typeof summaryData.summary === 'undefined') {
            throw new Error('Invalid summary data: missing summary content');
        }

        console.log('[ExportManager] Exporting summary in format:', format);

        const exportOptions = {
            includeMetadata: true,
            includeBranding: true,
            timestampFormat: 'iso',
            ...options
        };

        let content;
        let contentType;

        switch (format) {
            case EXPORT_FORMATS.MARKDOWN:
                content = this.generateMarkdown(summaryData, exportOptions);
                contentType = MIME_TYPES[EXPORT_FORMATS.MARKDOWN];
                break;
            case EXPORT_FORMATS.HTML:
                content = this.generateHTML(summaryData, exportOptions);
                contentType = MIME_TYPES[EXPORT_FORMATS.HTML];
                break;
            case EXPORT_FORMATS.TEXT:
                content = this.generateText(summaryData, exportOptions);
                contentType = MIME_TYPES[EXPORT_FORMATS.TEXT];
                break;
            default:
                throw new Error(`Format handler not implemented: ${format}`);
        }

        const filename = this.generateFilename(summaryData, format, exportOptions);

        return {
            content,
            contentType,
            filename,
            format,
            size: content.length,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Generate Markdown format
     * @param {Object} summaryData - Summary data
     * @param {Object} options - Export options
     * @returns {string} Markdown content
     */
    generateMarkdown(summaryData, options) {
        const { summary, metadata } = summaryData;
        let markdown = '';

        // Header
        const meetingTitle = this.extractMeetingTitle(metadata) || 'Meeting Summary';
        markdown += `# ${meetingTitle}\n\n`;

        // Meeting metadata
        if (options.includeMetadata && metadata) {
            markdown += '## Meeting Information\n\n';
            
            if (metadata.duration) {
                markdown += `**Duration:** ${metadata.duration}\n\n`;
            }
            
            if (metadata.participants && metadata.participants.length > 0) {
                markdown += `**Participants:** ${metadata.participants.join(', ')}\n\n`;
            }
            
            if (metadata.language) {
                markdown += `**Language:** ${metadata.language}\n\n`;
            }
            
            if (metadata.generatedAt) {
                const date = new Date(metadata.generatedAt);
                markdown += `**Summary Generated:** ${this.formatTimestamp(date, options.timestampFormat)}\n\n`;
            }

            if (metadata.model) {
                markdown += `**AI Model:** ${metadata.model}\n\n`;
            }
        }

        // Summary content
        markdown += '## Summary\n\n';
        markdown += summary;

        // Processing information
        if (options.includeMetadata && metadata.usage) {
            markdown += '\n\n---\n\n';
            markdown += '## Processing Information\n\n';
            
            if (metadata.usage.total_tokens || metadata.usage.input_tokens) {
                const totalTokens = metadata.usage.total_tokens || 
                    (metadata.usage.input_tokens + (metadata.usage.output_tokens || 0));
                markdown += `**Tokens Used:** ${totalTokens.toLocaleString()}\n\n`;
            }
            
            if (metadata.processingTime) {
                markdown += `**Processing Time:** ${metadata.processingTime}ms\n\n`;
            }
        }

        // Branding footer
        if (options.includeBranding) {
            markdown += '\n\n---\n\n';
            markdown += '*Generated by Teams Transcript Extension*\n';
        }

        return markdown;
    }

    /**
     * Generate HTML format
     * @param {Object} summaryData - Summary data
     * @param {Object} options - Export options
     * @returns {string} HTML content
     */
    generateHTML(summaryData, options) {
        const { summary, metadata } = summaryData;
        const meetingTitle = this.extractMeetingTitle(metadata) || 'Meeting Summary';
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(meetingTitle)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
        }
        .header {
            border-bottom: 2px solid #e1e5e9;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h1 {
            color: #0078d4;
            margin: 0 0 10px 0;
            font-size: 2.2rem;
        }
        h2 {
            color: #323130;
            margin: 30px 0 15px 0;
            font-size: 1.5rem;
            border-bottom: 1px solid #edebe9;
            padding-bottom: 5px;
        }
        .metadata {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .metadata-item {
            margin: 8px 0;
        }
        .metadata-label {
            font-weight: 600;
            color: #323130;
        }
        .summary-content {
            background-color: #ffffff;
            padding: 25px;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            margin: 20px 0;
        }
        .processing-info {
            background-color: #fff4ce;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 0.9rem;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #edebe9;
            color: #605e5c;
            font-size: 0.85rem;
        }
        ul, ol {
            padding-left: 25px;
        }
        li {
            margin: 5px 0;
        }
        .highlight {
            background-color: #fff4ce;
            padding: 2px 4px;
            border-radius: 3px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .footer { page-break-inside: avoid; }
        }
    </style>
</head>
<body>`;

        // Header
        html += `
    <div class="header">
        <h1>${this.escapeHtml(meetingTitle)}</h1>
    </div>`;

        // Meeting metadata
        if (options.includeMetadata && metadata) {
            html += `
    <div class="metadata">
        <h2>Meeting Information</h2>`;
            
            if (metadata.duration) {
                html += `
        <div class="metadata-item">
            <span class="metadata-label">Duration:</span> ${this.escapeHtml(metadata.duration)}
        </div>`;
            }
            
            if (metadata.participants && metadata.participants.length > 0) {
                html += `
        <div class="metadata-item">
            <span class="metadata-label">Participants:</span> ${this.escapeHtml(metadata.participants.join(', '))}
        </div>`;
            }
            
            if (metadata.language) {
                html += `
        <div class="metadata-item">
            <span class="metadata-label">Language:</span> ${this.escapeHtml(metadata.language)}
        </div>`;
            }
            
            if (metadata.generatedAt) {
                const date = new Date(metadata.generatedAt);
                html += `
        <div class="metadata-item">
            <span class="metadata-label">Summary Generated:</span> ${this.escapeHtml(this.formatTimestamp(date, options.timestampFormat))}
        </div>`;
            }

            if (metadata.model) {
                html += `
        <div class="metadata-item">
            <span class="metadata-label">AI Model:</span> ${this.escapeHtml(metadata.model)}
        </div>`;
            }

            html += `
    </div>`;
        }

        // Summary content
        html += `
    <div class="summary-content">
        <h2>Summary</h2>
        ${this.formatHtmlContent(summary)}
    </div>`;

        // Processing information
        if (options.includeMetadata && metadata.usage) {
            html += `
    <div class="processing-info">
        <h2>Processing Information</h2>`;
            
            if (metadata.usage.total_tokens || metadata.usage.input_tokens) {
                const totalTokens = metadata.usage.total_tokens || 
                    (metadata.usage.input_tokens + (metadata.usage.output_tokens || 0));
                html += `
        <div class="metadata-item">
            <span class="metadata-label">Tokens Used:</span> ${totalTokens.toLocaleString()}
        </div>`;
            }
            
            if (metadata.processingTime) {
                html += `
        <div class="metadata-item">
            <span class="metadata-label">Processing Time:</span> ${metadata.processingTime}ms
        </div>`;
            }

            html += `
    </div>`;
        }

        // Branding footer
        if (options.includeBranding) {
            html += `
    <div class="footer">
        <p><em>Generated by Teams Transcript Extension</em></p>
    </div>`;
        }

        html += `
</body>
</html>`;

        return html;
    }

    /**
     * Generate plain text format
     * @param {Object} summaryData - Summary data
     * @param {Object} options - Export options
     * @returns {string} Plain text content
     */
    generateText(summaryData, options) {
        const { summary, metadata } = summaryData;
        let text = '';
        const separator = '=' .repeat(60);
        const divider = '-'.repeat(40);

        // Header
        const meetingTitle = this.extractMeetingTitle(metadata) || 'MEETING SUMMARY';
        text += `${separator}\n`;
        text += `${meetingTitle.toUpperCase()}\n`;
        text += `${separator}\n\n`;

        // Meeting metadata
        if (options.includeMetadata && metadata) {
            text += 'MEETING INFORMATION\n';
            text += `${divider}\n`;
            
            if (metadata.duration) {
                text += `Duration: ${metadata.duration}\n`;
            }
            
            if (metadata.participants && metadata.participants.length > 0) {
                text += `Participants: ${metadata.participants.join(', ')}\n`;
            }
            
            if (metadata.language) {
                text += `Language: ${metadata.language}\n`;
            }
            
            if (metadata.generatedAt) {
                const date = new Date(metadata.generatedAt);
                text += `Summary Generated: ${this.formatTimestamp(date, options.timestampFormat)}\n`;
            }

            if (metadata.model) {
                text += `AI Model: ${metadata.model}\n`;
            }

            text += '\n';
        }

        // Summary content
        text += 'SUMMARY\n';
        text += `${divider}\n`;
        text += this.formatTextContent(summary);
        text += '\n\n';

        // Processing information
        if (options.includeMetadata && metadata.usage) {
            text += 'PROCESSING INFORMATION\n';
            text += `${divider}\n`;
            
            if (metadata.usage.total_tokens || metadata.usage.input_tokens) {
                const totalTokens = metadata.usage.total_tokens || 
                    (metadata.usage.input_tokens + (metadata.usage.output_tokens || 0));
                text += `Tokens Used: ${totalTokens.toLocaleString()}\n`;
            }
            
            if (metadata.processingTime) {
                text += `Processing Time: ${metadata.processingTime}ms\n`;
            }

            text += '\n';
        }

        // Branding footer
        if (options.includeBranding) {
            text += `${separator}\n`;
            text += 'Generated by Teams Transcript Extension\n';
            text += `${separator}\n`;
        }

        return text;
    }

    /**
     * Generate filename for export
     * @param {Object} summaryData - Summary data
     * @param {string} format - Export format
     * @param {Object} options - Export options
     * @returns {string} Generated filename
     */
    generateFilename(summaryData, format, options) {
        const { metadata } = summaryData;
        const extension = FILE_EXTENSIONS[format] || '.txt';
        
        // Extract meeting title and clean it
        let baseFilename = this.extractMeetingTitle(metadata) || 'meeting-summary';
        baseFilename = this.sanitizeFilename(baseFilename);
        
        // Add date if available
        let dateString = '';
        if (metadata.generatedAt) {
            const date = new Date(metadata.generatedAt);
            dateString = `_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else {
            const now = new Date();
            dateString = `_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        
        // Add timestamp if needed to avoid conflicts
        const timeString = options.includeTimestamp ? 
            `_${String(new Date().getHours()).padStart(2, '0')}${String(new Date().getMinutes()).padStart(2, '0')}` : '';
        
        return `${baseFilename}${dateString}${timeString}${extension}`;
    }

    /**
     * Copy content to clipboard
     * @param {string} content - Content to copy
     * @param {string} format - Content format for proper mime type
     * @returns {Promise<boolean>} Success status
     */
    async copyToClipboard(content, format = EXPORT_FORMATS.TEXT) {
        try {
            if (!navigator.clipboard) {
                throw new Error('Clipboard API not available');
            }

            await navigator.clipboard.writeText(content);
            console.log('[ExportManager] Content copied to clipboard');
            return true;
        } catch (error) {
            console.error('[ExportManager] Failed to copy to clipboard:', error);
            
            // Fallback for older browsers
            return this.fallbackCopyToClipboard(content);
        }
    }

    /**
     * Download content as file
     * @param {string} content - Content to download
     * @param {string} filename - Filename for download
     * @param {string} contentType - MIME type
     */
    downloadFile(content, filename, contentType) {
        try {
            const blob = new Blob([content], { type: contentType });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the blob URL
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log('[ExportManager] File download initiated:', filename);
        } catch (error) {
            console.error('[ExportManager] Failed to download file:', error);
            throw new Error(`Failed to download file: ${error.message}`);
        }
    }

    /**
     * Get all supported export formats
     * @returns {Array<Object>} Available formats with metadata
     */
    getSupportedFormats() {
        return [
            {
                id: EXPORT_FORMATS.MARKDOWN,
                name: 'Markdown',
                description: 'Markdown format for documentation',
                extension: FILE_EXTENSIONS[EXPORT_FORMATS.MARKDOWN],
                mimeType: MIME_TYPES[EXPORT_FORMATS.MARKDOWN]
            },
            {
                id: EXPORT_FORMATS.HTML,
                name: 'HTML',
                description: 'Web page format with styling',
                extension: FILE_EXTENSIONS[EXPORT_FORMATS.HTML],
                mimeType: MIME_TYPES[EXPORT_FORMATS.HTML]
            },
            {
                id: EXPORT_FORMATS.TEXT,
                name: 'Plain Text',
                description: 'Simple text format',
                extension: FILE_EXTENSIONS[EXPORT_FORMATS.TEXT],
                mimeType: MIME_TYPES[EXPORT_FORMATS.TEXT]
            }
        ];
    }

    // Helper methods

    /**
     * Check if format is valid
     * @param {string} format - Format to validate
     * @returns {boolean} Validation result
     */
    isValidFormat(format) {
        return this.supportedFormats.includes(format);
    }

    /**
     * Extract meeting title from metadata
     * @param {Object} metadata - Meeting metadata
     * @returns {string|null} Meeting title
     */
    extractMeetingTitle(metadata) {
        if (!metadata) return null;
        
        // Try various possible title fields
        return metadata.title || 
               metadata.meetingTitle || 
               metadata.subject ||
               metadata.name ||
               null;
    }

    /**
     * Sanitize filename for safe file system usage
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*&]/g, '_') // Replace invalid characters including &
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_+/g, '_') // Collapse multiple underscores
            .replace(/^_|_$/g, '') // Remove leading/trailing underscores
            .substring(0, 50) // Limit length
            .toLowerCase();
    }

    /**
     * Format timestamp based on specified format
     * @param {Date} date - Date object
     * @param {string} format - Format type (iso, local, short)
     * @returns {string} Formatted timestamp
     */
    formatTimestamp(date, format = 'iso') {
        switch (format) {
            case 'iso':
                return date.toISOString();
            case 'local':
                return date.toLocaleString();
            case 'short':
                return date.toLocaleDateString();
            default:
                return date.toISOString();
        }
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Format content for HTML output
     * @param {string} content - Raw content
     * @returns {string} Formatted HTML content
     */
    formatHtmlContent(content) {
        if (!content) return '';
        
        // Convert markdown-style formatting to HTML
        let html = this.escapeHtml(content);
        
        // Convert markdown headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Convert markdown lists
        html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
        html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
        
        // Wrap consecutive list items in ul tags
        html = html.replace(/(<li>.*<\/li>\s*)+/g, '<ul>$&</ul>');
        
        // Convert line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        // Wrap in paragraphs
        html = `<p>${html}</p>`;
        
        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        
        return html;
    }

    /**
     * Format content for plain text output
     * @param {string} content - Raw content
     * @returns {string} Formatted text content
     */
    formatTextContent(content) {
        if (!content) return '';
        
        // Remove markdown formatting while preserving structure
        let text = content
            .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`(.*?)`/g, '$1') // Remove code formatting
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
            .replace(/^\s*[-*+]\s+/gm, '• ') // Convert list markers to bullets
            .trim();
        
        return text;
    }

    /**
     * Fallback clipboard copy for older browsers
     * @param {string} content - Content to copy
     * @returns {boolean} Success status
     */
    fallbackCopyToClipboard(content) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = content;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                console.log('[ExportManager] Content copied to clipboard via fallback');
                return true;
            } else {
                throw new Error('execCommand copy failed');
            }
        } catch (error) {
            console.error('[ExportManager] Fallback clipboard copy failed:', error);
            return false;
        }
    }
}

// Create singleton instance
const exportManager = new ExportManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportManager, exportManager, EXPORT_FORMATS };
} else {
    // Browser environment - attach to window
    window.ExportManager = ExportManager;
    window.exportManager = exportManager;
    window.EXPORT_FORMATS = EXPORT_FORMATS;
}