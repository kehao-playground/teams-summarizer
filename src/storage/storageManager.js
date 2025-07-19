/**
 * Storage Manager for Teams Transcript Chrome Extension
 * Handles secure storage of API keys and user preferences
 */

// Constants
const STORAGE_KEYS = {
    SETTINGS: 'extension_settings',
    API_KEYS: 'api_keys',
    PROMPT_TEMPLATES: 'prompt_templates',
    USER_PREFERENCES: 'user_preferences',
    MIGRATION_VERSION: 'migration_version'
};

const CURRENT_VERSION = 1;

const DEFAULT_SETTINGS = {
    provider: 'openai',
    language: 'en',
    prompt: 'default',
    customPrompts: {},
    preferences: {
        autoExtract: false,
        showNotifications: true,
        cacheTranscripts: true,
        defaultExportFormat: 'markdown'
    }
};

/**
 * Storage Manager Class
 * Provides encrypted storage for API keys and secure storage for settings
 */
class StorageManager {
    constructor() {
        this.encryptionKey = null;
        this.initialized = false;
    }

    /**
     * Initialize the storage manager
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Generate or retrieve encryption key
            await this.setupEncryption();
            
            // Run migrations if needed
            await this.runMigrations();
            
            this.initialized = true;
            console.log('[StorageManager] Initialized successfully');
        } catch (error) {
            console.error('[StorageManager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup encryption for API keys
     */
    async setupEncryption() {
        try {
            // Check if encryption key exists
            const result = await chrome.storage.local.get(['encryption_key']);
            
            if (result.encryption_key) {
                this.encryptionKey = result.encryption_key;
            } else {
                // Generate new encryption key
                this.encryptionKey = this.generateEncryptionKey();
                await chrome.storage.local.set({ 
                    encryption_key: this.encryptionKey 
                });
            }
        } catch (error) {
            console.error('[StorageManager] Encryption setup failed:', error);
            throw new Error('Failed to setup encryption');
        }
    }

    /**
     * Generate a simple encryption key for basic obfuscation
     * Note: This is basic obfuscation, not cryptographic security
     */
    generateEncryptionKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Simple encrypt function for API keys
     * Uses basic XOR cipher for obfuscation
     */
    encrypt(text) {
        if (!this.encryptionKey || !text) return text;
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
            const textChar = text.charCodeAt(i);
            result += String.fromCharCode(textChar ^ keyChar);
        }
        return btoa(result); // Base64 encode
    }

    /**
     * Simple decrypt function for API keys
     */
    decrypt(encryptedText) {
        if (!this.encryptionKey || !encryptedText) return encryptedText;
        
        try {
            const decodedText = atob(encryptedText); // Base64 decode
            let result = '';
            for (let i = 0; i < decodedText.length; i++) {
                const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
                const encryptedChar = decodedText.charCodeAt(i);
                result += String.fromCharCode(encryptedChar ^ keyChar);
            }
            return result;
        } catch (error) {
            console.error('[StorageManager] Decryption failed:', error);
            return encryptedText; // Return as-is if decryption fails
        }
    }

    /**
     * Save API key securely
     */
    async saveApiKey(provider, apiKey) {
        if (!this.initialized) await this.initialize();
        
        try {
            const encryptedKey = this.encrypt(apiKey);
            const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEYS]);
            const apiKeys = result[STORAGE_KEYS.API_KEYS] || {};
            
            apiKeys[provider] = {
                key: encryptedKey,
                lastUpdated: new Date().toISOString(),
                keyPrefix: this.getKeyPrefix(apiKey)
            };
            
            await chrome.storage.local.set({
                [STORAGE_KEYS.API_KEYS]: apiKeys
            });
            
            console.log(`[StorageManager] API key saved for provider: ${provider}`);
            return true;
        } catch (error) {
            console.error('[StorageManager] Failed to save API key:', error);
            throw new Error('Failed to save API key');
        }
    }

    /**
     * Get API key securely
     */
    async getApiKey(provider) {
        if (!this.initialized) await this.initialize();
        
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEYS]);
            const apiKeys = result[STORAGE_KEYS.API_KEYS] || {};
            
            if (!apiKeys[provider]) {
                return null;
            }
            
            return this.decrypt(apiKeys[provider].key);
        } catch (error) {
            console.error('[StorageManager] Failed to get API key:', error);
            return null;
        }
    }

    /**
     * Get API key info (without the actual key)
     */
    async getApiKeyInfo(provider) {
        if (!this.initialized) await this.initialize();
        
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEYS]);
            const apiKeys = result[STORAGE_KEYS.API_KEYS] || {};
            
            if (!apiKeys[provider]) {
                return null;
            }
            
            return {
                hasKey: true,
                lastUpdated: apiKeys[provider].lastUpdated,
                keyPrefix: apiKeys[provider].keyPrefix
            };
        } catch (error) {
            console.error('[StorageManager] Failed to get API key info:', error);
            return null;
        }
    }

    /**
     * Delete API key
     */
    async deleteApiKey(provider) {
        if (!this.initialized) await this.initialize();
        
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.API_KEYS]);
            const apiKeys = result[STORAGE_KEYS.API_KEYS] || {};
            
            if (apiKeys[provider]) {
                delete apiKeys[provider];
                await chrome.storage.local.set({
                    [STORAGE_KEYS.API_KEYS]: apiKeys
                });
            }
            
            console.log(`[StorageManager] API key deleted for provider: ${provider}`);
            return true;
        } catch (error) {
            console.error('[StorageManager] Failed to delete API key:', error);
            throw new Error('Failed to delete API key');
        }
    }

    /**
     * Save user settings
     */
    async saveSettings(settings) {
        if (!this.initialized) await this.initialize();
        
        try {
            const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
            
            await chrome.storage.local.set({
                [STORAGE_KEYS.SETTINGS]: mergedSettings
            });
            
            console.log('[StorageManager] Settings saved successfully');
            return true;
        } catch (error) {
            console.error('[StorageManager] Failed to save settings:', error);
            throw new Error('Failed to save settings');
        }
    }

    /**
     * Load user settings
     */
    async loadSettings() {
        if (!this.initialized) await this.initialize();
        
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
            return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
        } catch (error) {
            console.error('[StorageManager] Failed to load settings:', error);
            return DEFAULT_SETTINGS;
        }
    }

    /**
     * Save custom prompt template
     */
    async savePromptTemplate(name, template) {
        if (!this.initialized) await this.initialize();
        
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.PROMPT_TEMPLATES]);
            const templates = result[STORAGE_KEYS.PROMPT_TEMPLATES] || {};
            
            templates[name] = {
                content: template,
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };
            
            await chrome.storage.local.set({
                [STORAGE_KEYS.PROMPT_TEMPLATES]: templates
            });
            
            console.log(`[StorageManager] Prompt template saved: ${name}`);
            return true;
        } catch (error) {
            console.error('[StorageManager] Failed to save prompt template:', error);
            throw new Error('Failed to save prompt template');
        }
    }

    /**
     * Load prompt templates
     */
    async loadPromptTemplates() {
        if (!this.initialized) await this.initialize();
        
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.PROMPT_TEMPLATES]);
            return result[STORAGE_KEYS.PROMPT_TEMPLATES] || {};
        } catch (error) {
            console.error('[StorageManager] Failed to load prompt templates:', error);
            return {};
        }
    }

    /**
     * Delete prompt template
     */
    async deletePromptTemplate(name) {
        if (!this.initialized) await this.initialize();
        
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.PROMPT_TEMPLATES]);
            const templates = result[STORAGE_KEYS.PROMPT_TEMPLATES] || {};
            
            if (templates[name]) {
                delete templates[name];
                await chrome.storage.local.set({
                    [STORAGE_KEYS.PROMPT_TEMPLATES]: templates
                });
            }
            
            console.log(`[StorageManager] Prompt template deleted: ${name}`);
            return true;
        } catch (error) {
            console.error('[StorageManager] Failed to delete prompt template:', error);
            throw new Error('Failed to delete prompt template');
        }
    }

    /**
     * Export all data (for backup/migration)
     */
    async exportData() {
        if (!this.initialized) await this.initialize();
        
        try {
            const settings = await this.loadSettings();
            const promptTemplates = await this.loadPromptTemplates();
            
            // Note: API keys are not included in export for security
            return {
                settings,
                promptTemplates,
                exportDate: new Date().toISOString(),
                version: CURRENT_VERSION
            };
        } catch (error) {
            console.error('[StorageManager] Failed to export data:', error);
            throw new Error('Failed to export data');
        }
    }

    /**
     * Import data (from backup)
     */
    async importData(data) {
        if (!this.initialized) await this.initialize();
        
        try {
            if (data.settings) {
                await this.saveSettings(data.settings);
            }
            
            if (data.promptTemplates) {
                await chrome.storage.local.set({
                    [STORAGE_KEYS.PROMPT_TEMPLATES]: data.promptTemplates
                });
            }
            
            console.log('[StorageManager] Data imported successfully');
            return true;
        } catch (error) {
            console.error('[StorageManager] Failed to import data:', error);
            throw new Error('Failed to import data');
        }
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        try {
            await chrome.storage.local.clear();
            this.initialized = false;
            console.log('[StorageManager] All data cleared');
            return true;
        } catch (error) {
            console.error('[StorageManager] Failed to clear data:', error);
            throw new Error('Failed to clear data');
        }
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats() {
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse();
            const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
            
            return {
                bytesUsed: bytesInUse,
                totalQuota: quota,
                percentageUsed: Math.round((bytesInUse / quota) * 100),
                remainingBytes: quota - bytesInUse
            };
        } catch (error) {
            console.error('[StorageManager] Failed to get storage stats:', error);
            return null;
        }
    }

    /**
     * Run data migrations for version updates
     */
    async runMigrations() {
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.MIGRATION_VERSION]);
            const currentMigrationVersion = result[STORAGE_KEYS.MIGRATION_VERSION] || 0;
            
            if (currentMigrationVersion < CURRENT_VERSION) {
                console.log(`[StorageManager] Running migrations from version ${currentMigrationVersion} to ${CURRENT_VERSION}`);
                
                // Add migration logic here for future versions
                // Example: if (currentMigrationVersion < 2) { /* migration code */ }
                
                await chrome.storage.local.set({
                    [STORAGE_KEYS.MIGRATION_VERSION]: CURRENT_VERSION
                });
                
                console.log('[StorageManager] Migrations completed');
            }
        } catch (error) {
            console.error('[StorageManager] Migration failed:', error);
            throw new Error('Migration failed');
        }
    }

    /**
     * Get safe prefix of API key for display purposes
     */
    getKeyPrefix(apiKey) {
        if (!apiKey || apiKey.length < 8) return '';
        
        if (apiKey.startsWith('sk-')) {
            return apiKey.substring(0, 8) + '...';
        } else if (apiKey.startsWith('sk-ant-')) {
            return apiKey.substring(0, 12) + '...';
        } else {
            return apiKey.substring(0, 6) + '...';
        }
    }

    /**
     * Validate API key format
     */
    validateApiKey(provider, apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return { valid: false, error: 'API key is required' };
        }

        switch (provider) {
            case 'openai':
                if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
                    return { 
                        valid: false, 
                        error: 'OpenAI API key should start with "sk-" and be at least 20 characters long' 
                    };
                }
                break;
            
            case 'anthropic':
                if (!apiKey.startsWith('sk-ant-') || apiKey.length < 30) {
                    return { 
                        valid: false, 
                        error: 'Anthropic API key should start with "sk-ant-" and be at least 30 characters long' 
                    };
                }
                break;
            
            default:
                return { valid: false, error: 'Unknown provider' };
        }

        return { valid: true };
    }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager, storageManager };
} else {
    window.StorageManager = StorageManager;
    window.storageManager = storageManager;
}