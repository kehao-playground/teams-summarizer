/**
 * Popup UI Controller for Teams Transcript Chrome Extension
 * Handles view management, state handling, and user interactions
 */

// Constants
const VIEWS = {
    SETUP: 'setup-view',
    MAIN: 'main-view',
    SETTINGS: 'settings-view'
};

const STATUS = {
    READY: 'ready',
    WARNING: 'warning',
    ERROR: 'error',
    INACTIVE: 'inactive'
};

const PROVIDERS = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic'
};

const PROMPT_TEMPLATES = {
    default: `Summarize this meeting transcript in a clear, structured format. Include:
1. Main discussion topics
2. Key decisions made
3. Action items with owners
4. Next steps

Format the output with clear headings and bullet points.`,
    
    'action-items': `Focus on action items and decisions from this meeting transcript. For each action item, identify:
- What needs to be done
- Who is responsible (if mentioned)
- When it should be completed (if mentioned)
- Any dependencies or prerequisites

Also include key decisions made during the meeting.`,
    
    technical: `Summarize this technical meeting transcript with focus on:
1. Technical decisions and architecture choices
2. Technical challenges discussed
3. Solutions proposed or implemented
4. Technical action items and next steps
5. Performance, security, or scalability considerations mentioned

Use technical terminology appropriately and highlight any specific technologies, frameworks, or methodologies discussed.`
};

// Global state
let currentState = {
    view: VIEWS.SETUP,
    settings: null,
    meetingInfo: null,
    transcript: null,
    summary: null,
    isLoading: false
};

// UI Elements
const elements = {};

/**
 * Initialize popup when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Popup] Initializing popup UI');
    
    // Cache DOM elements
    cacheElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load settings and determine initial view
    await initializeState();
    
    // Show appropriate view
    showView(currentState.view);
    
    // Update status
    await updateStatus();
    
    // Check for meeting info if on main view
    if (currentState.view === VIEWS.MAIN) {
        await checkMeetingInfo();
    }
});

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
    // Views
    elements.setupView = document.getElementById('setup-view');
    elements.mainView = document.getElementById('main-view');
    elements.settingsView = document.getElementById('settings-view');
    
    // Status
    elements.statusDot = document.getElementById('status-dot');
    elements.statusText = document.getElementById('status-text');
    
    // Setup form
    elements.setupForm = document.getElementById('setup-form');
    elements.providerSelect = document.getElementById('provider-select');
    elements.apiKeyInput = document.getElementById('api-key');
    elements.toggleKeyVisibility = document.getElementById('toggle-key-visibility');
    elements.languageSelect = document.getElementById('language-select');
    elements.saveSettingsBtn = document.getElementById('save-settings');
    elements.apiHelpText = document.getElementById('api-help-text');
    
    // Main view
    elements.meetingTitle = document.getElementById('meeting-title');
    elements.meetingDuration = document.getElementById('meeting-duration');
    elements.meetingUrl = document.getElementById('meeting-url');
    elements.extractTranscriptBtn = document.getElementById('extract-transcript');
    elements.transcriptPreview = document.getElementById('transcript-preview');
    elements.transcriptContent = document.getElementById('transcript-content');
    elements.transcriptEntries = document.getElementById('transcript-entries');
    elements.transcriptParticipants = document.getElementById('transcript-participants');
    elements.generateSummaryBtn = document.getElementById('generate-summary');
    elements.summaryView = document.getElementById('summary-view');
    elements.summaryFormat = document.getElementById('summary-format');
    elements.summaryContent = document.getElementById('summary-content');
    
    // Export buttons
    elements.downloadMdBtn = document.getElementById('download-md');
    elements.copySummaryBtn = document.getElementById('copy-summary');
    elements.regenerateSummaryBtn = document.getElementById('regenerate-summary');
    
    // Settings
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.backToMainBtn = document.getElementById('back-to-main');
    elements.currentProvider = document.getElementById('current-provider');
    elements.changeProviderBtn = document.getElementById('change-provider');
    elements.promptSelect = document.getElementById('prompt-select');
    elements.customPromptGroup = document.getElementById('custom-prompt-group');
    elements.customPrompt = document.getElementById('custom-prompt');
    elements.outputLanguage = document.getElementById('output-language');
    elements.savePromptSettingsBtn = document.getElementById('save-prompt-settings');
    elements.resetSettingsBtn = document.getElementById('reset-settings');
    
    // Loading and notifications
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.loadingText = document.getElementById('loading-text');
    elements.toastContainer = document.getElementById('toast-container');
}

/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners() {
    // Setup form
    elements.setupForm.addEventListener('submit', handleSetupSubmit);
    elements.providerSelect.addEventListener('change', updateApiHelp);
    elements.toggleKeyVisibility.addEventListener('click', toggleApiKeyVisibility);
    
    // Main view actions
    elements.extractTranscriptBtn.addEventListener('click', handleExtractTranscript);
    elements.generateSummaryBtn.addEventListener('click', handleGenerateSummary);
    elements.summaryFormat.addEventListener('change', handleSummaryFormatChange);
    
    // Export actions
    elements.downloadMdBtn.addEventListener('click', handleDownloadMarkdown);
    elements.copySummaryBtn.addEventListener('click', handleCopySummary);
    elements.regenerateSummaryBtn.addEventListener('click', handleRegenerateSummary);
    
    // Navigation
    elements.settingsBtn.addEventListener('click', () => showView(VIEWS.SETTINGS));
    elements.backToMainBtn.addEventListener('click', () => showView(VIEWS.MAIN));
    
    // Settings
    elements.changeProviderBtn.addEventListener('click', () => showView(VIEWS.SETUP));
    elements.promptSelect.addEventListener('change', handlePromptTemplateChange);
    elements.savePromptSettingsBtn.addEventListener('click', handleSavePromptSettings);
    elements.resetSettingsBtn.addEventListener('click', handleResetSettings);
}

/**
 * Initialize application state
 */
async function initializeState() {
    try {
        // Load settings from storage
        currentState.settings = await loadSettings();
        
        // Determine initial view
        if (!currentState.settings || !currentState.settings.apiKey) {
            currentState.view = VIEWS.SETUP;
        } else {
            currentState.view = VIEWS.MAIN;
            await populateSettingsView();
        }
        
    } catch (error) {
        console.error('[Popup] Error initializing state:', error);
        showToast('Failed to load settings', 'error');
        currentState.view = VIEWS.SETUP;
    }
}

/**
 * Show specified view and hide others
 */
function showView(viewId) {
    // Hide all views
    Object.values(VIEWS).forEach(view => {
        const element = document.getElementById(view);
        if (element) {
            element.classList.add('hidden');
        }
    });
    
    // Show target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('fade-in');
    }
    
    currentState.view = viewId;
    
    // Update view-specific content
    if (viewId === VIEWS.SETUP) {
        updateApiHelp();
    } else if (viewId === VIEWS.SETTINGS) {
        populateSettingsView();
    }
}

/**
 * Update status indicator
 */
async function updateStatus() {
    try {
        // Check extension status
        const response = await sendMessageToBackground({ action: 'getSessionStatus' });
        
        if (response.success && response.data.isValid) {
            setStatus(STATUS.READY, 'Ready');
        } else {
            setStatus(STATUS.WARNING, 'Session needed');
        }
        
    } catch (error) {
        console.error('[Popup] Error checking status:', error);
        setStatus(STATUS.ERROR, 'Error');
    }
}

/**
 * Set status indicator
 */
function setStatus(status, text) {
    elements.statusDot.className = `status-dot ${status}`;
    elements.statusText.textContent = text;
}

/**
 * Check for meeting information on current tab
 */
async function checkMeetingInfo() {
    try {
        const response = await sendMessageToBackground({ action: 'getMeetingInfo' });
        
        if (response.success && response.data) {
            currentState.meetingInfo = response.data;
            displayMeetingInfo(response.data);
            elements.extractTranscriptBtn.disabled = false;
        } else {
            displayNoMeetingInfo();
            elements.extractTranscriptBtn.disabled = true;
        }
        
    } catch (error) {
        console.error('[Popup] Error checking meeting info:', error);
        displayNoMeetingInfo();
        elements.extractTranscriptBtn.disabled = true;
    }
}

/**
 * Display meeting information
 */
function displayMeetingInfo(meetingInfo) {
    elements.meetingTitle.textContent = meetingInfo.title || 'Meeting Recording';
    elements.meetingDuration.textContent = meetingInfo.duration || '';
    elements.meetingUrl.textContent = meetingInfo.url || '';
    elements.meetingUrl.title = meetingInfo.url || '';
}

/**
 * Display no meeting info state
 */
function displayNoMeetingInfo() {
    elements.meetingTitle.textContent = 'No meeting detected';
    elements.meetingDuration.textContent = '';
    elements.meetingUrl.textContent = 'Please navigate to a Teams recording page';
}

/**
 * Handle setup form submission
 */
async function handleSetupSubmit(event) {
    event.preventDefault();
    
    const provider = elements.providerSelect.value;
    const apiKey = elements.apiKeyInput.value.trim();
    const language = elements.languageSelect.value;
    
    if (!provider || !apiKey) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    setLoading(true, 'Saving settings...');
    
    try {
        // Test API key
        await testApiKey(provider, apiKey);
        
        // Save settings
        const settings = {
            provider,
            apiKey,
            language,
            prompt: PROMPT_TEMPLATES.default,
            customPrompts: {}
        };
        
        await saveSettings(settings);
        currentState.settings = settings;
        
        showToast('Settings saved successfully!', 'success');
        
        // Navigate to main view
        setTimeout(() => {
            showView(VIEWS.MAIN);
            checkMeetingInfo();
        }, 1000);
        
    } catch (error) {
        console.error('[Popup] Error saving settings:', error);
        showToast(`Failed to save settings: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Handle extract transcript action
 */
async function handleExtractTranscript() {
    if (!currentState.meetingInfo) {
        showToast('No meeting information available', 'error');
        return;
    }
    
    setLoading(true, 'Extracting transcript...');
    
    try {
        // Send message to content script to extract transcript
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'extractTranscript' 
        });
        
        if (response.success) {
            currentState.transcript = response.data.transcript;
            displayTranscriptPreview(response.data.transcript);
            showToast('Transcript extracted successfully!', 'success');
        } else {
            throw new Error(response.error || 'Failed to extract transcript');
        }
        
    } catch (error) {
        console.error('[Popup] Error extracting transcript:', error);
        showToast(`Failed to extract transcript: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Display transcript preview
 */
function displayTranscriptPreview(transcript) {
    elements.transcriptEntries.textContent = `${transcript.metadata.entryCount} entries`;
    elements.transcriptParticipants.textContent = `${transcript.metadata.participants.length} participants`;
    
    // Show preview of transcript entries
    const previewEntries = transcript.entries.slice(0, 5); // Show first 5 entries
    const previewHtml = previewEntries.map(entry => `
        <div class="transcript-entry">
            <span class="transcript-time">[${entry.startTime}]</span>
            <span class="transcript-speaker">${entry.speaker}:</span>
            <span class="transcript-text">${entry.text}</span>
        </div>
    `).join('');
    
    elements.transcriptContent.innerHTML = previewHtml;
    
    // Show transcript preview section
    elements.transcriptPreview.classList.remove('hidden');
    elements.generateSummaryBtn.disabled = false;
}

/**
 * Handle generate summary action
 */
async function handleGenerateSummary() {
    if (!currentState.transcript || !currentState.settings) {
        showToast('Missing transcript or settings', 'error');
        return;
    }
    
    setLoading(true, 'Generating summary...');
    
    try {
        // Format transcript for AI
        const formattedTranscript = formatTranscriptForAI(currentState.transcript);
        
        // Generate summary using AI
        const summary = await generateSummaryWithAI(
            formattedTranscript,
            currentState.settings
        );
        
        currentState.summary = summary;
        displaySummary(summary);
        showToast('Summary generated successfully!', 'success');
        
    } catch (error) {
        console.error('[Popup] Error generating summary:', error);
        showToast(`Failed to generate summary: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Format transcript for AI processing
 */
function formatTranscriptForAI(transcript) {
    const participants = transcript.metadata.participants.join(', ');
    const duration = transcript.metadata.duration;
    const language = transcript.metadata.language;
    
    const formattedEntries = transcript.entries.map(entry => {
        const time = entry.startTime.split('.')[0]; // Remove fractional seconds
        return `[${time}] ${entry.speaker}: ${entry.text}`;
    }).join('\n');
    
    return {
        metadata: {
            participants,
            duration,
            language,
            entryCount: transcript.entries.length
        },
        content: formattedEntries
    };
}

/**
 * Generate summary using AI provider
 */
async function generateSummaryWithAI(transcript, settings) {
    const { provider, apiKey, language, prompt } = settings;
    
    const fullPrompt = `${prompt}\n\nOutput language: ${language}`;
    const content = `Meeting transcript:\n${transcript.content}\n\nParticipants: ${transcript.metadata.participants}\nDuration: ${transcript.metadata.duration}`;
    
    if (provider === PROVIDERS.OPENAI) {
        return await callOpenAI(apiKey, fullPrompt, content);
    } else if (provider === PROVIDERS.ANTHROPIC) {
        return await callAnthropic(apiKey, fullPrompt, content);
    } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(apiKey, prompt, content) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: content }
            ],
            temperature: 0.3,
            max_tokens: 4000
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Call Anthropic API
 */
async function callAnthropic(apiKey, prompt, content) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 4000,
            temperature: 0.3,
            messages: [{
                role: 'user',
                content: `${prompt}\n\n${content}`
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
}

/**
 * Display generated summary
 */
function displaySummary(summary) {
    currentState.summary = summary;
    
    // Default to rendered view
    elements.summaryFormat.value = 'rendered';
    renderSummaryContent(summary, 'rendered');
    
    // Show summary section
    elements.summaryView.classList.remove('hidden');
}

/**
 * Handle summary format change
 */
function handleSummaryFormatChange() {
    if (currentState.summary) {
        const format = elements.summaryFormat.value;
        renderSummaryContent(currentState.summary, format);
    }
}

/**
 * Render summary content in specified format
 */
function renderSummaryContent(summary, format) {
    let content = '';
    
    switch (format) {
        case 'rendered':
            // Convert markdown to HTML for display
            content = convertMarkdownToHtml(summary);
            break;
        case 'markdown':
            content = `<pre><code>${escapeHtml(summary)}</code></pre>`;
            break;
        case 'html':
            content = `<pre><code>${escapeHtml(convertMarkdownToHtml(summary))}</code></pre>`;
            break;
        case 'text':
            const plainText = summary.replace(/[#*_`\[\]]/g, '');
            content = `<pre>${escapeHtml(plainText)}</pre>`;
            break;
    }
    
    elements.summaryContent.innerHTML = content;
}

/**
 * Simple markdown to HTML converter
 */
function convertMarkdownToHtml(markdown) {
    return markdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle download markdown
 */
function handleDownloadMarkdown() {
    if (!currentState.summary) return;
    
    const meetingTitle = currentState.meetingInfo?.title || 'Meeting Summary';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${meetingTitle}_${date}.md`;
    
    downloadFile(currentState.summary, filename, 'text/markdown');
    showToast('Markdown file downloaded!', 'success');
}

/**
 * Handle copy summary
 */
async function handleCopySummary() {
    if (!currentState.summary) return;
    
    try {
        await navigator.clipboard.writeText(currentState.summary);
        showToast('Summary copied to clipboard!', 'success');
    } catch (error) {
        console.error('[Popup] Error copying to clipboard:', error);
        showToast('Failed to copy to clipboard', 'error');
    }
}

/**
 * Handle regenerate summary
 */
function handleRegenerateSummary() {
    elements.summaryView.classList.add('hidden');
    currentState.summary = null;
    handleGenerateSummary();
}

/**
 * Update API help text based on selected provider
 */
function updateApiHelp() {
    const provider = elements.providerSelect.value;
    
    switch (provider) {
        case PROVIDERS.OPENAI:
            elements.apiHelpText.innerHTML = `
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a>. 
                Starts with "sk-".
            `;
            break;
        case PROVIDERS.ANTHROPIC:
            elements.apiHelpText.innerHTML = `
                Get your API key from <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>. 
                Starts with "sk-ant-".
            `;
            break;
        default:
            elements.apiHelpText.textContent = 'Select a provider to see instructions';
    }
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
    const input = elements.apiKeyInput;
    const button = elements.toggleKeyVisibility;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

/**
 * Handle prompt template change
 */
function handlePromptTemplateChange() {
    const selectedTemplate = elements.promptSelect.value;
    
    if (selectedTemplate === 'custom') {
        elements.customPromptGroup.classList.remove('hidden');
    } else {
        elements.customPromptGroup.classList.add('hidden');
        if (PROMPT_TEMPLATES[selectedTemplate]) {
            elements.customPrompt.value = PROMPT_TEMPLATES[selectedTemplate];
        }
    }
}

/**
 * Handle save prompt settings
 */
async function handleSavePromptSettings() {
    if (!currentState.settings) return;
    
    const promptTemplate = elements.promptSelect.value;
    const customPrompt = elements.customPrompt.value;
    const outputLanguage = elements.outputLanguage.value;
    
    let prompt = PROMPT_TEMPLATES[promptTemplate] || PROMPT_TEMPLATES.default;
    if (promptTemplate === 'custom' && customPrompt.trim()) {
        prompt = customPrompt.trim();
    }
    
    currentState.settings.prompt = prompt;
    currentState.settings.language = outputLanguage;
    
    try {
        await saveSettings(currentState.settings);
        showToast('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('[Popup] Error saving prompt settings:', error);
        showToast('Failed to save settings', 'error');
    }
}

/**
 * Handle reset settings
 */
async function handleResetSettings() {
    if (!confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
        return;
    }
    
    try {
        await chrome.storage.local.clear();
        currentState.settings = null;
        showToast('Settings reset successfully!', 'success');
        setTimeout(() => {
            showView(VIEWS.SETUP);
        }, 1000);
    } catch (error) {
        console.error('[Popup] Error resetting settings:', error);
        showToast('Failed to reset settings', 'error');
    }
}

/**
 * Populate settings view with current settings
 */
function populateSettingsView() {
    if (!currentState.settings) return;
    
    const { provider, language, prompt } = currentState.settings;
    
    // Update provider info
    const providerNames = {
        [PROVIDERS.OPENAI]: 'OpenAI (GPT 4)',
        [PROVIDERS.ANTHROPIC]: 'Anthropic (Claude)'
    };
    
    elements.currentProvider.querySelector('.provider-name').textContent = 
        providerNames[provider] || 'Unknown';
    elements.currentProvider.querySelector('.provider-status').textContent = 
        'API key configured';
    
    // Update language selection
    elements.outputLanguage.value = language || 'en';
    
    // Find matching prompt template
    let selectedTemplate = 'custom';
    for (const [key, template] of Object.entries(PROMPT_TEMPLATES)) {
        if (template === prompt) {
            selectedTemplate = key;
            break;
        }
    }
    
    elements.promptSelect.value = selectedTemplate;
    elements.customPrompt.value = prompt;
    
    // Show/hide custom prompt
    if (selectedTemplate === 'custom') {
        elements.customPromptGroup.classList.remove('hidden');
    } else {
        elements.customPromptGroup.classList.add('hidden');
    }
}

/**
 * Test API key validity
 */
async function testApiKey(provider, apiKey) {
    // Simple test with minimal content
    const testContent = 'Test message';
    
    if (provider === PROVIDERS.OPENAI) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: testContent }],
                max_tokens: 5
            })
        });
        
        if (!response.ok) {
            throw new Error('Invalid OpenAI API key');
        }
    } else if (provider === PROVIDERS.ANTHROPIC) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 5,
                messages: [{ role: 'user', content: testContent }]
            })
        });
        
        if (!response.ok) {
            throw new Error('Invalid Anthropic API key');
        }
    }
}

/**
 * Load settings from Chrome storage
 */
async function loadSettings() {
    const result = await chrome.storage.local.get(['settings']);
    return result.settings || null;
}

/**
 * Save settings to Chrome storage
 */
async function saveSettings(settings) {
    await chrome.storage.local.set({ settings });
}

/**
 * Send message to background script
 */
function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Set loading state
 */
function setLoading(isLoading, text = 'Loading...') {
    currentState.isLoading = isLoading;
    
    if (isLoading) {
        elements.loadingText.textContent = text;
        elements.loadingOverlay.classList.remove('hidden');
    } else {
        elements.loadingOverlay.classList.add('hidden');
    }
    
    // Disable/enable buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = isLoading;
    });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

/**
 * Download file utility
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}