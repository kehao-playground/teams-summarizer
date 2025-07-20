// Background service worker for handling API calls and session management

// Production-safe logging helper
const backgroundLog = {
  info: (message: string, ...args: any[]) => {
    // Logging disabled in production for performance and compliance
    void message; void args;
  },
  error: (message: string, ...args: any[]) => {
    // Error logging disabled in production for security
    void message; void args;
  },
  warn: (message: string, ...args: any[]) => {
    // Warning logging disabled in production
    void message; void args;
  }
};

interface MeetingInfo {
  url: string;
  title: string;
  duration: string;
  siteUrl: string;
  driveId: string;
  itemId: string;
  transcriptId: string;
  meetingPath: string;
}

interface SessionData {
  authToken: string;
  cookies: string;
  timestamp: number;
}

class BackgroundService {
  private sessionData: SessionData | null = null;
  private isProcessing = false;

  constructor() {
    this.initialize();
  }

  initialize() {
    // Setup message listeners
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Setup webRequest listeners for session management
    this.setupWebRequestListeners();
    
    // Clean up old session data periodically
    this.startSessionCleanup();
  }

  setupWebRequestListeners() {
    // Listen for SharePoint API calls to capture authentication
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        if (details.url.includes('sharepoint.com') && details.requestHeaders) {
          const authHeader = details.requestHeaders.find(h => 
            h.name.toLowerCase() === 'authorization'
          );
          
          if (authHeader && authHeader.value?.startsWith('Bearer ')) {
            this.captureSession(authHeader.value);
          }
        }
      },
      { urls: ['https://*.sharepoint.com/*'] },
      ['requestHeaders']
    );
  }

  async captureSession(authToken: string) {
    try {
      const cookies = await chrome.cookies.getAll({
        domain: '.sharepoint.com'
      });

      const cookieString = cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

      this.sessionData = {
        authToken,
        cookies: cookieString,
        timestamp: Date.now()
      };

      backgroundLog.info('Session captured successfully');
    } catch (error) {
      backgroundLog.error('Error capturing session:', error);
    }
  }

  async handleMessage(request: any, _sender: any, sendResponse: any) {
    switch (request.action) {
      case 'extractTranscript':
        await this.extractTranscript(request.meetingInfo, sendResponse);
        break;
      case 'generateSummary':
        await this.generateSummary(request.transcript, request.settings, sendResponse);
        break;
      case 'getSessionData':
        sendResponse({ sessionData: this.sessionData });
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true; // Keep message channel open for async response
  }

  async extractTranscript(meetingInfo: MeetingInfo, sendResponse: any) {
    if (this.isProcessing) {
      sendResponse({ error: 'Already processing a request' });
      return;
    }

    this.isProcessing = true;

    try {
      if (!this.sessionData || this.isSessionExpired()) {
        sendResponse({ error: 'No active session. Please refresh the Teams page and try again.' });
        return;
      }

      const transcript = await this.fetchTranscriptFromAPI(meetingInfo);
      sendResponse({ transcript });

    } catch (error) {
      backgroundLog.error('Error extracting transcript:', error);
      sendResponse({ error: this.getErrorMessage(error) });
    } finally {
      this.isProcessing = false;
    }
  }

  async fetchTranscriptFromAPI(meetingInfo: MeetingInfo) {
    const { siteUrl, driveId, itemId, transcriptId } = meetingInfo;
    
    if (!driveId || !itemId || !transcriptId) {
      throw new Error('Missing required meeting information');
    }

    const apiUrl = `${siteUrl}/_api/v2.1/drives/${driveId}/items/${itemId}/media/transcripts/${transcriptId}/streamContent?format=json`;

    const headers = {
      'Authorization': this.sessionData!.authToken,
      'Cookie': this.sessionData!.cookies,
      'Accept': 'application/json',
      'X-MS-Client-Request-Id': this.generateUUID(),
      'Application': 'OnePlayer',
      'Scenario': 'LoadPlayer',
      'Type': 'AUO'
    };

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    const transcript = await response.json();
    return this.validateTranscript(transcript);
  }

  validateTranscript(transcript: any) {
    if (!transcript || !transcript.entries || !Array.isArray(transcript.entries)) {
      throw new Error('Invalid transcript format received');
    }

    if (transcript.entries.length === 0) {
      throw new Error('No transcript entries found');
    }

    return transcript;
  }

  async generateSummary(transcript: any, settings: any, sendResponse: any) {
    if (this.isProcessing) {
      sendResponse({ error: 'Already processing a request' });
      return;
    }

    this.isProcessing = true;

    try {
      const formattedTranscript = this.formatTranscriptForAI(transcript);
      const summary = await this.callAIProvider(formattedTranscript, settings);
      sendResponse({ summary });

    } catch (error) {
      backgroundLog.error('Error generating summary:', error);
      sendResponse({ error: this.getErrorMessage(error) });
    } finally {
      this.isProcessing = false;
    }
  }

  formatTranscriptForAI(transcript: any) {
    const entries = transcript.entries || [];
    
    // Group by speaker for better context - kept for future reference
    // const _speakerGroups = entries.reduce((groups: any, entry: any) => {
    //   const speaker = entry.speakerDisplayName || 'Unknown Speaker';
    //   if (!groups[speaker]) {
    //     groups[speaker] = [];
    //   }
    //   groups[speaker].push(entry);
    //   return groups;
    // }, {});

    // Format entries with timestamps
    const formattedEntries = entries.map((entry: any) => {
      const time = entry.startOffset?.split('.')[0] || '00:00:00';
      return `[${time}] ${entry.speakerDisplayName || 'Speaker'}: ${entry.text}`;
    });

    // Extract metadata
    const participants = [...new Set(entries.map((e: any) => e.speakerDisplayName).filter(Boolean))];
    const duration = this.calculateDuration(entries);
    const language = entries[0]?.spokenLanguageTag || 'zh-tw';

    return {
      metadata: {
        participants,
        duration,
        language,
        totalEntries: entries.length
      },
      content: formattedEntries.join('\n')
    };
  }

  calculateDuration(entries: any[]): string {
    if (!entries || entries.length === 0) return '00:00:00';
    
    const startTimes = entries.map(e => e.startOffset || '00:00:00');
    const endTimes = entries.map(e => e.endOffset || '00:00:00');
    
    // Find first and last timestamps
    const firstTime = startTimes[0];
    const lastTime = endTimes[endTimes.length - 1];
    
    // Calculate duration (simplified - would need proper time parsing)
    return this.parseDuration(firstTime, lastTime);
  }

  parseDuration(_start: string, end: string): string {
    // Simplified duration calculation
    return end || '01:00:00';
  }

  async callAIProvider(formattedTranscript: any, settings: any) {
    const { provider, apiKey, language, promptTemplate, customPrompt } = settings;
    
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const prompt = customPrompt || this.getDefaultPrompt(promptTemplate, language);
    
    switch (provider) {
      case 'openai':
        return await this.callOpenAI(apiKey, prompt, formattedTranscript, language);
      case 'anthropic':
        return await this.callAnthropic(apiKey, prompt, formattedTranscript, language);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  async callOpenAI(apiKey: string, prompt: string, transcript: any, language: string) {
    const messages = [
      {
        role: 'system',
        content: `${prompt}\nOutput language: ${language}`
      },
      {
        role: 'user',
        content: `Meeting transcript:\n${transcript.content}\n\nParticipants: ${transcript.metadata.participants.join(', ')}`
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages,
        temperature: 0.3,
        max_tokens: 32768
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    return this.formatSummary(data.choices[0]?.message?.content || '');
  }

  async callAnthropic(apiKey: string, prompt: string, transcript: any, language: string) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-0',
        max_tokens: 8192,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `${prompt}\nOutput language: ${language}\n\nMeeting transcript:\n${transcript.content}\n\nParticipants: ${transcript.metadata.participants.join(', ')}`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API Error: ${response.status}`);
    }

    const data = await response.json();
    return this.formatSummary(data.content[0]?.text || '');
  }

  formatSummary(content: string) {
    // Parse the AI response into structured format
    const sections = this.parseSummarySections(content);
    
    return {
      title: sections.title || 'Meeting Summary',
      date: new Date().toISOString().split('T')[0],
      duration: '--',
      participants: [],
      keyPoints: sections.keyPoints || [],
      actionItems: sections.actionItems || [],
      decisions: sections.decisions || [],
      fullSummary: content,
      markdown: this.generateMarkdown(sections),
      html: this.generateHTML(sections)
    };
  }

  parseSummarySections(content: string) {
    // Basic parsing - could be enhanced with more sophisticated parsing
    const lines = content.split('\n');
    return {
      title: lines.find(l => l.startsWith('# '))?.replace('# ', '') || 'Meeting Summary',
      keyPoints: lines.filter(l => l.startsWith('- ')).slice(0, 5),
      actionItems: lines.filter(l => l.toLowerCase().includes('action') || l.includes('todo')),
      decisions: lines.filter(l => l.toLowerCase().includes('decision') || l.includes('agreed'))
    };
  }

  generateMarkdown(sections: any) {
    return `# ${sections.title}

## Key Points
${sections.keyPoints.map((p: string) => p).join('\n')}

## Action Items
${sections.actionItems.map((item: string) => item).join('\n')}

## Decisions
${sections.decisions.map((d: string) => d).join('\n')}

---
*Generated by Teams Meeting Summarizer* ${new Date().toLocaleDateString()}`;
  }

  generateHTML(sections: any) {
    return `
      <h1>${sections.title}</h1>
      <h2>Key Points</h2>
      <ul>${sections.keyPoints.map((p: string) => `<li>${p.replace('- ', '')}</li>`).join('')}</ul>
      <h2>Action Items</h2>
      <ul>${sections.actionItems.map((item: string) => `<li>${item.replace('- ', '')}</li>`).join('')}</ul>
      <h2>Decisions</h2>
      <ul>${sections.decisions.map((d: string) => `<li>${d.replace('- ', '')}</li>`).join('')}</ul>
    `;
  }

  getDefaultPrompt(template: string, language: string): string {
    const prompts = {
      default: `You are a meeting summarizer. Create a concise summary of this meeting transcript in ${language}. Include key decisions, action items, and main discussion points. Format the response with clear sections.`,
      'action-items': `Focus on extracting action items and next steps from this meeting transcript in ${language}. List each action item with responsible person and deadline if mentioned.`,
      technical: `Create a technical meeting summary in ${language}. Focus on technical decisions, architecture discussions, implementation details, and technical action items.`,
      custom: `Create a meeting summary in ${language} based on the provided transcript.`
    };

    return prompts[template as keyof typeof prompts] || prompts.default;
  }

  getErrorMessage(error: any): string {
    if (error.message?.includes('401')) {
      return 'Authentication failed. Please refresh your Teams page and try again.';
    }
    if (error.message?.includes('404')) {
      return 'Transcript not found. Make sure transcription is enabled for this meeting.';
    }
    if (error.message?.includes('429')) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    return error.message || 'An unexpected error occurred';
  }

  isSessionExpired(): boolean {
    if (!this.sessionData) return true;
    
    // Session expires after 1 hour
    const oneHour = 60 * 60 * 1000;
    return Date.now() - this.sessionData.timestamp > oneHour;
  }

  startSessionCleanup() {
    // Clean up expired session data every 30 minutes
    setInterval(() => {
      if (this.sessionData && this.isSessionExpired()) {
        this.sessionData = null;
        backgroundLog.info('Expired session data cleaned up');
      }
    }, 30 * 60 * 1000);
  }

  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Initialize background service

function initializeBackground() {
  try {
    new BackgroundService();
  } catch (error) {
    backgroundLog.error('Failed to initialize background service:', error);
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    backgroundLog.info('Teams Meeting Summarizer installed');
  }
});

// Initialize on startup
initializeBackground();