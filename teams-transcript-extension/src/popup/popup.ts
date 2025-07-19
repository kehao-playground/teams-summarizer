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
    await this.loadSettings();
    this.setupEventListeners();
    this.checkCurrentTab();
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    if (this.isSharePointStreamPage(tab.url)) {
      const response = await chrome.tabs.sendMessage(tab.id!, { action: 'getMeetingInfo' });
      if (response?.meetingInfo) {
        this.meetingInfo = response.meetingInfo;
        this.updateMeetingInfo();
      }
    }
  }

  isSharePointStreamPage(url: string): boolean {
    return url.includes('_layouts/15/stream.aspx');
  }

  updateMeetingInfo() {
    if (!this.meetingInfo) return;
    
    const titleEl = document.getElementById('meeting-title');
    const durationEl = document.getElementById('meeting-duration');
    
    if (titleEl) titleEl.textContent = this.meetingInfo.title || 'Untitled Meeting';
    if (durationEl) durationEl.textContent = `Duration: ${this.meetingInfo.duration || '--'}`;
  }

  async extractTranscript() {
    if (!this.meetingInfo) return;

    this.showLoading('Extracting transcript...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'extractTranscript',
        meetingInfo: this.meetingInfo
      });

      if (response.error) {
        this.showError(response.error);
      } else {
        this.transcript = response.transcript;
        this.showTranscriptPreview();
      }
    } catch (error) {
      this.showError('Failed to extract transcript: ' + (error as Error).message);
    } finally {
      this.hideLoading();
    }
  }

  async generateSummary() {
    if (!this.transcript) return;

    this.showLoading('Generating summary...');
    
    try {
      const settings = await chrome.storage.local.get([
        'provider', 'apiKey', 'language', 'promptTemplate', 'customPrompt'
      ]);

      const response = await chrome.runtime.sendMessage({
        action: 'generateSummary',
        transcript: this.transcript,
        settings
      });

      if (response.error) {
        this.showError(response.error);
      } else {
        this.summary = response.summary;
        this.showSummary();
      }
    } catch (error) {
      this.showError('Failed to generate summary: ' + (error as Error).message);
    } finally {
      this.hideLoading();
    }
  }

  showTranscriptPreview() {
    const preview = document.getElementById('transcript-preview');
    const content = document.getElementById('transcript-content');
    const generateBtn = document.getElementById('generate-summary');
    
    if (preview && content && this.transcript) {
      const entries = this.transcript.entries || [];
      const previewText = entries.slice(0, 5).map((entry: any) => 
        `[${entry.startOffset}] ${entry.speakerDisplayName}: ${entry.text}`
      ).join('\n');
      
      content.textContent = previewText + (entries.length > 5 ? '\n...' : '');
      preview.style.display = 'block';
      generateBtn!.style.display = 'block';
    }
  }

  showSummary() {
    const summaryView = document.getElementById('summary-view');
    const content = document.getElementById('summary-content');
    
    if (summaryView && content && this.summary) {
      content.textContent = this.summary.markdown || this.summary.fullSummary;
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
    const template = (document.getElementById('prompt-template') as HTMLSelectElement).value;
    const section = document.getElementById('custom-prompt-section');
    if (section) {
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
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});