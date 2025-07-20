/**
 * OpenAI Client for Teams Transcript Extension
 * 
 * Integrates with OpenAI's GPT 4.1 API to generate meeting summaries
 * from extracted Microsoft Teams transcripts.
 */

class OpenAIClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.model = options.model || 'gpt-4.1';
    this.maxTokens = options.maxTokens || 32768;
    this.temperature = options.temperature || 0.3;
    this.contextWindow = 1047576; // GPT 4.1's context window
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
  }

  /**
   * Generate summary from formatted transcript
   */
  async generateSummary(transcript, settings = {}) {
    try {
      const {
        apiKey,
        prompt = this.getDefaultPrompt(),
        language = 'en',
        customPrompt = null,
        includeMetadata = true
      } = settings;

      if (!apiKey) {
        throw new Error('OpenAI API key is required');
      }

      // Validate transcript
      if (!transcript || !transcript.content) {
        throw new Error('Invalid transcript format');
      }

      // Check token limits and chunk if necessary
      const tokenCount = this.estimateTokenCount(transcript.content, prompt);
      if (tokenCount > this.contextWindow * 0.8) { // Use 80% of context window for safety
        return await this.generateChunkedSummary(transcript, settings);
      }

      // Build messages for chat completion
      const messages = this.buildMessages(transcript, prompt, language, customPrompt);

      // Make API request with retry logic
      const response = await this.makeApiRequest({
        model: this.model,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      }, apiKey);

      // Process and format response
      const summary = this.processResponse(response, transcript, includeMetadata);
      
      return summary;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate summary for large transcripts using chunking
   */
  async generateChunkedSummary(transcript, settings) {
    try {
      const { chunkingStrategy = 'intelligent' } = settings;
      
      // Load chunking strategy if available
      let chunks;
      if (typeof window !== 'undefined' && window.ChunkingStrategy) {
        const chunker = new window.ChunkingStrategy({
          provider: 'openai',
          contextLimit: this.contextWindow
        });
        chunks = await chunker.chunkTranscript(transcript, chunkingStrategy);
      } else {
        // Fallback to simple chunking
        chunks = this.simpleChunk(transcript);
      }

      const chunkSummaries = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkSettings = {
          ...settings,
          prompt: this.getChunkPrompt(i + 1, chunks.length)
        };
        
        const chunkSummary = await this.generateSummary(chunk, chunkSettings);
        chunkSummaries.push(chunkSummary);
        
        // Rate limiting between chunks
        await this.sleep(this.minRequestInterval);
      }

      // Combine chunk summaries
      return await this.combineSummaries(chunkSummaries, transcript, settings);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Test API connection and key validity
   */
  async testConnection(apiKey) {
    try {
      const testResponse = await this.makeApiRequest({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Test message for API key validation. Please respond with "OK".'
          }
        ],
        max_tokens: 10,
        temperature: 0
      }, apiKey);

      return {
        success: true,
        model: this.model,
        response: testResponse.choices[0]?.message?.content || 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error).message
      };
    }
  }

  /**
   * Make API request with retry logic and rate limiting
   */
  async makeApiRequest(payload, apiKey, retryCount = 0) {
    try {
      // Rate limiting
      await this.enforceRateLimit();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Teams-Transcript-Extension/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OpenAIError(response.status, errorData.error?.message || 'API request failed', errorData);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid API response format');
      }

      return data;
    } catch (error) {
      // Retry logic for rate limits and temporary errors
      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        return this.makeApiRequest(payload, apiKey, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Build messages array for chat completion
   */
  buildMessages(transcript, prompt, language, customPrompt) {
    const systemPrompt = customPrompt || this.getSystemPrompt(prompt, language);
    const userContent = this.formatTranscriptForPrompt(transcript);

    return [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userContent
      }
    ];
  }

  /**
   * Get system prompt with language specification
   */
  getSystemPrompt(basePrompt, language) {
    const languageInstruction = this.getLanguageInstruction(language);
    return `${basePrompt}\n\n${languageInstruction}\n\nPlease format your response as a structured summary with clear sections.`;
  }

  /**
   * Get language-specific instructions
   */
  getLanguageInstruction(language) {
    const instructions = {
      'en': 'Please respond in English.',
      'zh-TW': '請用繁體中文回答。',
      'zh-CN': '请用简体中文回答。',
      'ja': '日本語で回答してください。',
      'ko': '한국어로 답변해 주세요.',
      'es': 'Por favor responde en español.',
      'fr': 'Veuillez répondre en français.',
      'de': 'Bitte antworten Sie auf Deutsch.',
      'it': 'Si prega di rispondere in italiano.',
      'pt': 'Por favor, responda em português.'
    };

    return instructions[language] || instructions['en'];
  }

  /**
   * Format transcript for prompt
   */
  formatTranscriptForPrompt(transcript) {
    const { metadata, content } = transcript;
    
    let formatted = 'Meeting Transcript:\n\n';
    
    if (metadata) {
      formatted += `Participants: ${metadata.participants ? metadata.participants.join(', ') : 'Unknown'}\n`;
      formatted += `Duration: ${metadata.duration || 'Unknown'}\n`;
      formatted += `Language: ${metadata.language || 'Unknown'}\n\n`;
    }
    
    formatted += content;
    
    return formatted;
  }

  /**
   * Process API response and format summary
   */
  processResponse(response, transcript, includeMetadata) {
    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new Error('Invalid API response structure');
    }

    const content = choice.message.content;
    const usage = response.usage || {};

    // Extract structured summary sections
    const summary = this.parseStructuredSummary(content);

    // Add metadata if requested
    if (includeMetadata && transcript.metadata) {
      summary.metadata = {
        ...transcript.metadata,
        generatedAt: new Date().toISOString(),
        model: this.model,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        }
      };
    }

    return summary;
  }

  /**
   * Parse structured summary from AI response
   */
  parseStructuredSummary(content) {
    const summary = {
      fullSummary: content,
      keyPoints: [],
      actionItems: [],
      decisions: [],
      topics: [],
      participants: []
    };

    try {
      // Extract sections using regex patterns
      const sections = {
        keyPoints: /(?:key points?|main points?|主要重點|要點)[:\s]*\n(.*?)(?=\n(?:[a-z\u4e00-\u9fa5].*?:|$))/gis,
        actionItems: /(?:action items?|tasks?|行動項目|待辦事項)[:\s]*\n(.*?)(?=\n(?:[a-z\u4e00-\u9fa5].*?:|$))/gis,
        decisions: /(?:decisions?|conclusions?|決議|結論)[:\s]*\n(.*?)(?=\n(?:[a-z\u4e00-\u9fa5].*?:|$))/gis,
        topics: /(?:topics?|subjects?|討論主題|議題)[:\s]*\n(.*?)(?=\n(?:[a-z\u4e00-\u9fa5].*?:|$))/gis
      };

      Object.entries(sections).forEach(([key, regex]) => {
        const matches = [...content.matchAll(regex)];
        if (matches.length > 0) {
          const items = matches[0][1]
            .split(/\n[-•*]\s*/)
            .filter(item => item.trim())
            .map(item => item.trim().replace(/^[-•*]\s*/, ''));
          summary[key] = items;
        }
      });

      // Alternative parsing for bullet points with section boundaries
      if (summary.keyPoints.length === 0) {
        const keyPointsMatch = content.match(/(?:key points?|main points?)[:\s]*\n((?:[-•*]\s*.*\n?)*)(?=\n##|\n(?:action|task|decision)|$)/gis);
        if (keyPointsMatch) {
          summary.keyPoints = keyPointsMatch[0]
            .split('\n')
            .filter(line => line.match(/^[-•*]\s*/))
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(item => item);
        }
      }

      if (summary.actionItems.length === 0) {
        const actionMatch = content.match(/(?:action items?|tasks?)[:\s]*\n((?:[-•*]\s*.*\n?)*)(?=\n##|\n(?:key|decision)|$)/gis);
        if (actionMatch) {
          summary.actionItems = actionMatch[0]
            .split('\n')
            .filter(line => line.match(/^[-•*]\s*/))
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(item => item);
        }
      }

      if (summary.decisions.length === 0) {
        const decisionsMatch = content.match(/(?:decisions?|conclusions?)[:\s]*\n((?:[-•*]\s*.*\n?)*)(?=\n##|\n(?:key|action|task)|$)/gis);
        if (decisionsMatch) {
          summary.decisions = decisionsMatch[0]
            .split('\n')
            .filter(line => line.match(/^[-•*]\s*/))
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(item => item);
        }
      }

      // Generate markdown and HTML versions
      summary.markdown = this.generateMarkdown(summary);
      summary.html = this.generateHTML(summary);

    } catch (error) {
      console.warn('Failed to parse structured summary:', error);
      // Fallback to simple format
      summary.keyPoints = [content];
      summary.markdown = this.generateMarkdown(summary);
      summary.html = this.generateHTML(summary);
    }

    return summary;
  }

  /**
   * Generate Markdown format
   */
  generateMarkdown(summary) {
    let markdown = `# Meeting Summary\n\n`;
    
    if (summary.metadata) {
      markdown += `**Date:** ${new Date(summary.metadata.generatedAt).toLocaleDateString()}\n`;
      markdown += `**Duration:** ${summary.metadata.duration}\n`;
      markdown += `**Participants:** ${summary.metadata.participants?.join(', ') || 'Unknown'}\n\n`;
    }

    if (summary.keyPoints.length > 0) {
      markdown += `## Key Points\n\n`;
      summary.keyPoints.forEach(point => {
        markdown += `- ${point}\n`;
      });
      markdown += '\n';
    }

    if (summary.actionItems.length > 0) {
      markdown += `## Action Items\n\n`;
      summary.actionItems.forEach(item => {
        markdown += `- [ ] ${item}\n`;
      });
      markdown += '\n';
    }

    if (summary.decisions.length > 0) {
      markdown += `## Decisions\n\n`;
      summary.decisions.forEach(decision => {
        markdown += `- ${decision}\n`;
      });
      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Generate HTML format
   */
  generateHTML(summary) {
    let html = `<div class="meeting-summary">\n`;
    html += `<h1>Meeting Summary</h1>\n`;

    if (summary.metadata) {
      html += `<div class="metadata">\n`;
      html += `<p><strong>Date:</strong> ${new Date(summary.metadata.generatedAt).toLocaleDateString()}</p>\n`;
      html += `<p><strong>Duration:</strong> ${summary.metadata.duration}</p>\n`;
      html += `<p><strong>Participants:</strong> ${summary.metadata.participants?.join(', ') || 'Unknown'}</p>\n`;
      html += `</div>\n`;
    }

    if (summary.keyPoints.length > 0) {
      html += `<h2>Key Points</h2>\n<ul>\n`;
      summary.keyPoints.forEach(point => {
        html += `<li>${this.escapeHtml(point)}</li>\n`;
      });
      html += `</ul>\n`;
    }

    if (summary.actionItems.length > 0) {
      html += `<h2>Action Items</h2>\n<ul>\n`;
      summary.actionItems.forEach(item => {
        html += `<li>${this.escapeHtml(item)}</li>\n`;
      });
      html += `</ul>\n`;
    }

    if (summary.decisions.length > 0) {
      html += `<h2>Decisions</h2>\n<ul>\n`;
      summary.decisions.forEach(decision => {
        html += `<li>${this.escapeHtml(decision)}</li>\n`;
      });
      html += `</ul>\n`;
    }

    html += `</div>`;
    return html;
  }

  /**
   * Default prompts for different summary types
   */
  getDefaultPrompt(type = 'general') {
    const prompts = {
      general: `You are an AI assistant that creates concise, well-structured meeting summaries. 

Please analyze the following meeting transcript and provide a comprehensive summary with these sections:

1. **Key Points**: Main topics and important information discussed
2. **Action Items**: Specific tasks, assignments, and follow-ups mentioned
3. **Decisions**: Concrete decisions made during the meeting
4. **Topics Discussed**: Brief overview of discussion areas

Focus on extracting actionable information and maintaining the context of the conversation. Preserve important details while being concise.`,

      actionItems: `You are an AI assistant specialized in extracting actionable items from meeting transcripts.

Please analyze the following meeting transcript and focus on:

1. **Action Items**: Specific tasks with owners and deadlines if mentioned
2. **Follow-ups**: Items that need further discussion or investigation
3. **Decisions**: Concrete decisions that require implementation
4. **Next Steps**: Planned activities and timeline

Be very specific about who is responsible for what, and include any mentioned deadlines or timelines.`,

      technical: `You are an AI assistant that specializes in technical meeting summaries.

Please analyze the following technical meeting transcript and provide:

1. **Technical Decisions**: Architecture choices, technology selections, implementation decisions
2. **Technical Issues**: Problems discussed and proposed solutions
3. **Action Items**: Technical tasks, development work, and investigations
4. **Requirements**: New requirements or changes to existing ones
5. **Timeline**: Development milestones and delivery dates

Focus on technical accuracy and preserve specific technical terms and details.`,

      executive: `You are an AI assistant that creates executive-level meeting summaries.

Please analyze the following meeting transcript and provide a high-level summary with:

1. **Strategic Decisions**: High-level decisions that impact business direction
2. **Key Outcomes**: Important results and conclusions
3. **Resource Allocation**: Budget, personnel, or resource decisions
4. **Next Steps**: Major initiatives and timeline
5. **Risks and Issues**: Potential challenges and mitigation strategies

Keep the language professional and focus on business impact.`
    };

    return prompts[type] || prompts.general;
  }

  /**
   * Get chunk-specific prompt
   */
  getChunkPrompt(chunkNumber, totalChunks) {
    return `You are analyzing part ${chunkNumber} of ${totalChunks} of a meeting transcript. 

Please provide a summary of this section focusing on:
- Key points discussed in this segment
- Any action items or decisions mentioned
- Important topics covered

This is a partial analysis that will be combined with other sections, so focus on the content of this specific segment.`;
  }

  /**
   * Combine chunk summaries into final summary
   */
  async combineSummaries(chunkSummaries, originalTranscript, settings) {
    const combinedContent = chunkSummaries
      .map((summary, index) => `### Section ${index + 1}\n${summary.fullSummary}`)
      .join('\n\n');

    const combinePrompt = `You are combining multiple section summaries from a long meeting into a final comprehensive summary.

Please analyze the following section summaries and create a unified meeting summary with:

1. **Key Points**: Consolidate the main topics from all sections
2. **Action Items**: Collect all tasks and assignments
3. **Decisions**: Gather all decisions made throughout the meeting
4. **Overall Summary**: Provide a cohesive overview of the entire meeting

Section summaries:
${combinedContent}`;

    // Create a combined transcript for final processing
    const combinedTranscript = {
      content: combinedContent,
      metadata: originalTranscript.metadata
    };

    return await this.generateSummary(combinedTranscript, {
      ...settings,
      customPrompt: combinePrompt
    });
  }

  /**
   * Simple chunking fallback when ChunkingStrategy is not available
   */
  simpleChunk(transcript, maxTokens = 30000) {
    const lines = transcript.content.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.estimateTokenCount(line);
      
      if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join('\n'),
          metadata: transcript.metadata
        });
        currentChunk = [line];
        currentTokens = lineTokens;
      } else {
        currentChunk.push(line);
        currentTokens += lineTokens;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        metadata: transcript.metadata
      });
    }

    return chunks;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokenCount(text, additionalText = '') {
    const combined = text + additionalText;
    // Rough estimate: 1 token ≈ 4 characters for English, 1 token ≈ 2 characters for Chinese
    const avgCharsPerToken = /[\u4e00-\u9fa5]/.test(combined) ? 2 : 4;
    return Math.ceil(combined.length / avgCharsPerToken);
  }

  /**
   * Rate limiting enforcement
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine if error should trigger retry
   */
  shouldRetry(error) {
    if (error instanceof OpenAIError) {
      // Retry on rate limits and temporary server errors
      return error.status === 429 || (error.status >= 500 && error.status < 600);
    }
    
    // Retry on network errors
    return error.name === 'TypeError' && error.message.includes('fetch');
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount) {
    const baseDelay = this.retryDelay;
    const maxDelay = 60000; // 1 minute max
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    // Add jitter
    return delay + Math.random() * 1000;
  }

  /**
   * Handle and normalize errors
   */
  handleError(error) {
    if (error instanceof OpenAIError) {
      return error;
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new OpenAIError(0, 'Network error. Please check your internet connection.', { originalError: error });
    }

    return new OpenAIError(0, error.message || 'Unknown error occurred', { originalError: error });
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    // Check if we're in a browser environment
    if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    } else {
      // Node.js environment fallback
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }
}

/**
 * Custom error class for OpenAI API errors
 */
class OpenAIError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'OpenAIError';
    this.status = status;
    this.details = details;
  }

  toString() {
    return `OpenAIError (${this.status}): ${this.message}`;
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OpenAIClient, OpenAIError };
} else if (typeof window !== 'undefined') {
  window.OpenAIClient = OpenAIClient;
  window.OpenAIError = OpenAIError;
} else if (typeof self !== 'undefined') {
  self.OpenAIClient = OpenAIClient;
  self.OpenAIError = OpenAIError;
}