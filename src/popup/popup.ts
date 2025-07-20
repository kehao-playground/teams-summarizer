import '../popup/popup.css';

interface MeetingInfo {
  url: string;
  title: string;
  duration: string;
  siteUrl: string;
  driveId: string;
  itemId: string;
  transcriptId: string;
}

interface ExtensionSettings {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  language: string;
  promptTemplate: string;
  customPrompt?: string;
}

class PopupManager {
  // private _currentView: string = 'setup-view';
  private meetingInfo: MeetingInfo | null = null;
  private transcript: any = null;
  private summary: any = null;

  constructor() {
    this.initializePopup();
  }

  async initializePopup() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      await this.restoreState();
      await this.checkCurrentTab();
    } catch (error) {
      console.error('[POPUP] Error during initialization:', error);
    }
  }

  async loadSettings() {
    const result = await chrome.storage.local.get([
      'provider', 
      'apiKey', 
      'language', 
      'promptTemplate', 
      'customPrompt'
    ]);

    const settings: ExtensionSettings = {
      provider: result.provider || 'openai',
      apiKey: result.apiKey || '',
      language: result.language || 'zh-TW',
      promptTemplate: result.promptTemplate || 'default',
      customPrompt: result.customPrompt
    };

    if (result.apiKey) {
      this.showView('main-view');
      this.populateSettings(settings);
    } else {
      this.showView('setup-view');
    }
  }

  populateSettings(settings: ExtensionSettings) {
    const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
    const settingsProvider = document.getElementById('settings-provider') as HTMLSelectElement;
    const settingsApiKey = document.getElementById('settings-api-key') as HTMLInputElement;
    const settingsLanguage = document.getElementById('settings-language') as HTMLSelectElement;
    const promptTemplate = document.getElementById('prompt-template') as HTMLSelectElement;

    if (providerSelect) providerSelect.value = settings.provider;
    if (settingsProvider) settingsProvider.value = settings.provider;
    if (settingsApiKey) settingsApiKey.value = settings.apiKey;
    if (settingsLanguage) settingsLanguage.value = settings.language;
    if (promptTemplate) promptTemplate.value = settings.promptTemplate;
  }

  setupEventListeners() {
    // Setup view
    document.getElementById('save-settings')?.addEventListener('click', this.saveSettings.bind(this));
    
    // Main view
    document.getElementById('extract-transcript')?.addEventListener('click', this.extractTranscript.bind(this));
    document.getElementById('generate-summary')?.addEventListener('click', this.generateSummary.bind(this));
    document.getElementById('download-transcript')?.addEventListener('click', this.downloadTranscript.bind(this));
    
    // Settings button - this was missing!
    document.getElementById('settings-btn')?.addEventListener('click', () => this.showView('settings-view'));
    
    // Settings view
    document.getElementById('save-updated-settings')?.addEventListener('click', this.saveUpdatedSettings.bind(this));
    document.getElementById('back-to-main')?.addEventListener('click', () => this.showView('main-view'));
    
    // Export buttons
    document.getElementById('download-md')?.addEventListener('click', this.downloadMarkdown.bind(this));
    document.getElementById('copy-html')?.addEventListener('click', this.copyHtml.bind(this));
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const format = target.dataset['format'] as string;
        this.switchTab(format);
      });
    });

    // Settings toggle
    document.getElementById('settings-provider')?.addEventListener('change', this.toggleCustomPrompt.bind(this));
    document.getElementById('prompt-template')?.addEventListener('change', this.toggleCustomPrompt.bind(this));
  }

  async saveSettings() {
    const provider = (document.getElementById('provider-select') as HTMLSelectElement).value as 'openai' | 'anthropic';
    const apiKey = (document.getElementById('api-key') as HTMLInputElement).value;
    
    if (!apiKey.trim()) {
      this.showError('Please enter an API key');
      return;
    }

    const settings: ExtensionSettings = {
      provider,
      apiKey,
      language: 'zh-TW',
      promptTemplate: 'default'
    };

    await chrome.storage.local.set(settings);
    this.showView('main-view');
    this.populateSettings(settings);
  }

  async saveUpdatedSettings() {
    const settings: ExtensionSettings = {
      provider: (document.getElementById('settings-provider') as HTMLSelectElement).value as 'openai' | 'anthropic',
      apiKey: (document.getElementById('settings-api-key') as HTMLInputElement).value,
      language: (document.getElementById('settings-language') as HTMLSelectElement).value,
      promptTemplate: (document.getElementById('prompt-template') as HTMLSelectElement).value,
      customPrompt: (document.getElementById('custom-prompt') as HTMLTextAreaElement).value
    };

    await chrome.storage.local.set(settings);
    this.showView('main-view');
  }

  async checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      if (this.isSharePointStreamPage(tab.url)) {
        // Wrap sendMessage in try-catch to handle connection errors
        try {
          const response = await chrome.tabs.sendMessage(tab.id!, { action: 'getMeetingInfo' });
          if (response?.meetingInfo) {
            this.meetingInfo = response.meetingInfo;
            this.updateMeetingInfo();
          }
        } catch (error) {
          console.log('[POPUP] Content script not ready or not available:', error);
          // This is expected if content script hasn't loaded yet
        }
      }
    } catch (error) {
      console.error('[POPUP] Error checking current tab:', error);
    }
  }

  isSharePointStreamPage(url: string): boolean {
    return url.includes('_layouts/15/stream.aspx') || url.includes('/stream.aspx');
  }

  updateMeetingInfo() {
    if (!this.meetingInfo) return;
    
    const titleEl = document.getElementById('meeting-title');
    const durationEl = document.getElementById('meeting-duration');
    const extractBtn = document.getElementById('extract-transcript') as HTMLButtonElement;
    
    if (titleEl) titleEl.textContent = this.meetingInfo.title || 'Untitled Meeting';
    
    // Only show duration if it's available
    if (durationEl) {
      if (this.meetingInfo.duration && this.meetingInfo.duration !== '--') {
        durationEl.textContent = `Duration: ${this.meetingInfo.duration}`;
        durationEl.style.display = 'block';
      } else {
        // Hide duration element if no duration is available
        durationEl.style.display = 'none';
      }
    }
    
    // Enable the extract transcript button when meeting info is available
    if (extractBtn) {
      extractBtn.disabled = false;
    }
  }

  async extractTranscript() {
    if (!this.meetingInfo) {
      return;
    }

    this.showLoading('Extracting transcript...');
    
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        this.showError('No active tab found');
        return;
      }
      
      // Send message to content script, not background script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractTranscript',
        meetingInfo: this.meetingInfo
      });

      if (response.error) {
        this.showError(response.error);
      } else {
        this.transcript = response.transcript;
        this.showTranscriptPreview();
        
        // Save state after successful transcript extraction
        await this.saveState();
      }
    } catch (error) {
      this.showError('Failed to extract transcript: ' + (error as Error).message);
    } finally {
      this.hideLoading();
      
      // Re-enable the generate summary button
      const generateBtn = document.getElementById('generate-summary') as HTMLButtonElement;
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = '✨ 產生摘要';
      }
    }
  }

  async generateSummary() {
    if (!this.transcript) return;

    console.log('[SUMMARY DEBUG] Starting summary generation...');
    console.log('[SUMMARY DEBUG] Transcript available:', this.transcript);

    // Show loading with specific message for summary generation
    this.showLoading('正在產生摘要，請稍候...');
    
    // Disable the generate summary button to prevent multiple clicks
    const generateBtn = document.getElementById('generate-summary') as HTMLButtonElement;
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = '⏳ 產生中...';
    }
    
    try {
      const settings = await chrome.storage.local.get([
        'provider', 'apiKey', 'language', 'promptTemplate', 'customPrompt'
      ]);

      console.log('[SUMMARY DEBUG] Settings loaded:', {
        provider: settings.provider,
        hasApiKey: !!settings.apiKey,
        language: settings.language,
        promptTemplate: settings.promptTemplate,
        hasCustomPrompt: !!settings.customPrompt
      });

      // Check if we have runtime available
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome runtime not available');
      }

      // First, ping the background script to ensure it's alive
      console.log('[SUMMARY DEBUG] Pinging background script...');
      try {
        await this.pingBackgroundScript();
        console.log('[SUMMARY DEBUG] Background script is responsive');
      } catch (pingError) {
        console.error('[SUMMARY DEBUG] Background script not responding to ping:', pingError);
        throw new Error('Background service is not responding. Please reload the extension.');
      }

      console.log('[SUMMARY DEBUG] Sending generateSummary message to background...');
      
      // Use Promise with timeout to handle port closing issues
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Request timeout - background script may not be responding'));
        }, 60000); // 60 second timeout for AI calls

        try {
          chrome.runtime.sendMessage({
            action: 'generateSummary',
            transcript: this.transcript,
            settings
          }, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              console.error('[SUMMARY DEBUG] Chrome runtime error:', chrome.runtime.lastError);
              // Check for specific error messages
              if (chrome.runtime.lastError.message?.includes('message port closed')) {
                reject(new Error('Connection lost. Please try again.'));
              } else if (chrome.runtime.lastError.message?.includes('Receiving end does not exist')) {
                reject(new Error('Background service not available. Please reload the extension.'));
              } else {
                reject(new Error(chrome.runtime.lastError.message));
              }
            } else if (!response) {
              reject(new Error('No response from background script'));
            } else {
              resolve(response);
            }
          });
        } catch (sendError) {
          clearTimeout(timeout);
          console.error('[SUMMARY DEBUG] Error sending message:', sendError);
          reject(sendError);
        }
      });

      console.log('[SUMMARY DEBUG] Response received:', response);

      if (response && (response as any).error) {
        console.log('[SUMMARY DEBUG] Error in response:', (response as any).error);
        this.showError((response as any).error);
      } else if (response && (response as any).summary) {
        console.log('[SUMMARY DEBUG] Summary received successfully');
        this.summary = (response as any).summary;
        this.showSummary();
        
        // Save state after successful summary generation
        await this.saveState();
      } else {
        console.log('[SUMMARY DEBUG] No valid response received:', response);
        this.showError('Invalid response from summary generation');
      }
    } catch (error) {
      console.error('[SUMMARY DEBUG] Exception caught:', error);
      console.error('[SUMMARY DEBUG] Error stack:', (error as Error).stack);
      
      // Provide more user-friendly error messages
      let errorMessage = 'Failed to generate summary: ';
      if ((error as Error).message.includes('Connection lost')) {
        errorMessage += 'Connection to background service lost. Please close and reopen the extension.';
      } else if ((error as Error).message.includes('timeout')) {
        errorMessage += 'Request timed out. The AI service may be slow or unavailable.';
      } else if ((error as Error).message.includes('not responding')) {
        errorMessage += (error as Error).message;
      } else {
        errorMessage += (error as Error).message;
      }
      
      this.showError(errorMessage);
    } finally {
      this.hideLoading();
      
      // Reset the generate summary button text and state
      const generateBtn = document.getElementById('generate-summary') as HTMLButtonElement;
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = '✨ 產生摘要';
      }
    }
  }

  // Helper method to ping background script
  async pingBackgroundScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Background script ping timeout'));
      }, 5000);

      chrome.runtime.sendMessage({ action: 'ping' }, () => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  showTranscriptPreview() {
    const preview = document.getElementById('transcript-preview');
    const content = document.getElementById('transcript-content');
    const generateBtn = document.getElementById('generate-summary');
    
    if (preview && content && this.transcript) {
      // Update duration if available from transcript metadata
      const duration = this.transcript.duration || this.transcript.metadata?.duration;
      if (duration) {
        const durationEl = document.getElementById('meeting-duration');
        if (durationEl) {
          durationEl.textContent = `Duration: ${duration}`;
          durationEl.style.display = 'block';
        }
        
        // Also update meetingInfo with duration
        if (this.meetingInfo) {
          this.meetingInfo.duration = duration;
        }
      }
      
      const entries = this.transcript.entries || [];
      let previewText = '';
      
      if (entries.length > 0) {
        // Handle different entry formats
        previewText = entries.slice(0, 5).map((entry: any) => {
          const time = entry.startTime || entry.startOffset || '00:00';
          const speaker = entry.speaker || entry.speakerDisplayName || 'Unknown Speaker';
          const text = entry.text || '';
          return `[${time}] ${speaker}: ${text}`;
        }).join('\n\n');
        
        if (entries.length > 5) {
          previewText += `\n\n... (${entries.length - 5} more entries)`;
        }
      } else if (this.transcript.rawText) {
        // If no entries but we have raw text, show that
        previewText = this.transcript.rawText.substring(0, 500);
        if (this.transcript.rawText.length > 500) {
          previewText += '...';
        }
      } else {
        previewText = 'No transcript content available';
      }
      
      content.textContent = previewText;
      preview.style.display = 'block';
      
      // Only show generate button if we have actual content
      if (entries.length > 0 || this.transcript.rawText) {
        generateBtn!.style.display = 'block';
      }
    }
  }

  showSummary() {
    const summaryView = document.getElementById('summary-view');
    const content = document.getElementById('summary-content');
    
    if (summaryView && content && this.summary) {
      // Use innerHTML to render markdown as HTML for better formatting
      const markdownContent = this.summary.markdown || this.summary.fullSummary || '';
      
      // Simple markdown to HTML conversion for basic formatting
      let htmlContent = markdownContent
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      
      // Wrap list items in ul tags
      htmlContent = htmlContent.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
      
      // Wrap content in paragraphs if not already wrapped
      if (!htmlContent.startsWith('<h') && !htmlContent.startsWith('<ul')) {
        htmlContent = '<p>' + htmlContent + '</p>';
      }
      
      content.innerHTML = htmlContent;
      summaryView.style.display = 'block';
    }
  }

  switchTab(format: string) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-format="${format}"]`)?.classList.add('active');
    
    const content = document.getElementById('summary-content');
    if (content && this.summary) {
      switch (format) {
        case 'rendered':
          content.innerHTML = this.summary.html || this.summary.markdown;
          break;
        case 'markdown':
          content.textContent = this.summary.markdown;
          break;
        case 'html':
          content.textContent = this.summary.html;
          break;
      }
    }
  }

  downloadMarkdown() {
    if (!this.summary) return;
    
    const blob = new Blob([this.summary.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.meetingInfo?.title || 'meeting'}_summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async copyHtml() {
    if (!this.summary) return;
    
    try {
      await navigator.clipboard.writeText(this.summary.html);
      this.showMessage('Copied to clipboard!');
    } catch (error) {
      this.showError('Failed to copy to clipboard');
    }
  }

  toggleCustomPrompt() {
    const template = (document.getElementById('prompt-template') as HTMLSelectElement)?.value;
    const section = document.getElementById('custom-prompt-section');
    if (section && template) {
      section.style.display = template === 'custom' ? 'block' : 'none';
    }
  }

  showView(viewId: string) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    // this._currentView = viewId;
  }

  showLoading(text: string) {
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    if (loading && loadingText) {
      loading.style.display = 'flex';
      loadingText.textContent = text;
    }
  }

  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }

  showError(message: string) {
    const error = document.getElementById('error-message');
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
      setTimeout(() => error.style.display = 'none', 5000);
    }
  }

  showMessage(message: string) {
    // Simple message display - could be enhanced with toast notifications
    this.showError(message);
  }

  // State persistence methods
  async saveState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      const stateKey = `popup_state_${tab.url}`;
      const state = {
        meetingInfo: this.meetingInfo,
        transcript: this.transcript,
        summary: this.summary,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ [stateKey]: state });
    } catch (error) {
      console.error('[POPUP] Error saving state:', error);
    }
  }

  async restoreState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      const stateKey = `popup_state_${tab.url}`;
      const result = await chrome.storage.local.get([stateKey]);
      const state = result[stateKey];

      if (state && state.timestamp) {
        // Only restore state if it's less than 1 hour old
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - state.timestamp < oneHour) {
          this.meetingInfo = state.meetingInfo;
          this.transcript = state.transcript;
          this.summary = state.summary;

          // Restore UI state
          if (this.meetingInfo) {
            this.updateMeetingInfo();
          }
          if (this.transcript) {
            this.showTranscriptPreview();
          }
          if (this.summary) {
            this.showSummary();
          }
        }
      }
    } catch (error) {
      console.error('[POPUP] Error restoring state:', error);
    }
  }

  // Download transcript functionality
  downloadTranscript() {
    if (!this.transcript) return;

    let content = '';
    const entries = this.transcript.entries || [];
    
    if (entries.length > 0) {
      // Format as readable transcript
      content = `# ${this.meetingInfo?.title || '會議逐字稿'}\n\n`;
      content += `**時間**: ${new Date().toLocaleString('zh-TW')}\n`;
      if (this.transcript.metadata?.duration) {
        content += `**時長**: ${this.transcript.metadata.duration}\n`;
      }
      if (this.transcript.metadata?.participants?.length > 0) {
        content += `**參與者**: ${this.transcript.metadata.participants.join(', ')}\n`;
      }
      content += '\n---\n\n';

      entries.forEach((entry: any) => {
        const time = entry.startTime || entry.startOffset || '00:00';
        const speaker = entry.speaker || entry.speakerDisplayName || 'Unknown Speaker';
        const text = entry.text || '';
        content += `**[${time}] ${speaker}**: ${text}\n\n`;
      });
    } else if (this.transcript.rawText) {
      content = this.transcript.rawText;
    } else {
      content = '無法取得逐字稿內容';
    }

    const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.meetingInfo?.title || 'meeting'}_transcript.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    new PopupManager();
  } catch (error) {
    console.error('[POPUP] Failed to initialize PopupManager:', error);
  }
});

// Global error handler to catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[POPUP] Unhandled promise rejection:', event.reason);
  // Prevent the default behavior (which would pause in debugger)
  event.preventDefault();
});

// Global error handler for regular errors
window.addEventListener('error', (event) => {
  console.error('[POPUP] Global error:', event.error);
  // Prevent the default behavior
  event.preventDefault();
});