/**
 * Unit tests for StorageManager
 * Tests secure storage of API keys and settings management
 */

// Mock Chrome APIs
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            clear: jest.fn(),
            getBytesInUse: jest.fn(() => Promise.resolve(1024)),
            QUOTA_BYTES: 5242880 // 5MB
        }
    }
};

// Import the StorageManager
const { StorageManager } = require('../../src/storage/storageManager');

describe('StorageManager', () => {
    let storageManager;
    
    beforeEach(() => {
        storageManager = new StorageManager();
        jest.clearAllMocks();
        
        // Create a mock storage state
        const mockStorage = {};
        
        // Reset Chrome storage mock to return promises (Chrome MV3 style)
        global.chrome.storage.local.get.mockImplementation((keys) => {
            if (typeof keys === 'string') {
                keys = [keys];
            }
            
            const result = {};
            if (Array.isArray(keys)) {
                keys.forEach(key => {
                    if (mockStorage[key] !== undefined) {
                        result[key] = mockStorage[key];
                    }
                });
            } else if (keys === null || keys === undefined) {
                Object.assign(result, mockStorage);
            }
            
            return Promise.resolve(result);
        });
        
        global.chrome.storage.local.set.mockImplementation((data) => {
            Object.assign(mockStorage, data);
            return Promise.resolve();
        });
        
        global.chrome.storage.local.clear.mockImplementation(() => {
            Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
            return Promise.resolve();
        });
    });
    
    describe('Initialization', () => {
        test('should initialize successfully', async () => {
            await storageManager.initialize();
            expect(storageManager.initialized).toBe(true);
        });
        
        test('should setup encryption key on first run', async () => {
            await storageManager.initialize();
            expect(storageManager.encryptionKey).toBeTruthy();
            expect(storageManager.encryptionKey.length).toBe(32);
        });
        
        test('should reuse existing encryption key', async () => {
            const existingKey = 'existing-key-12345678901234567890';
            global.chrome.storage.local.get.mockResolvedValueOnce({ encryption_key: existingKey });
            
            await storageManager.initialize();
            expect(storageManager.encryptionKey).toBe(existingKey);
        });
    });
    
    describe('Encryption/Decryption', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should encrypt and decrypt text correctly', () => {
            const originalText = 'sk-test-api-key-1234567890';
            const encrypted = storageManager.encrypt(originalText);
            const decrypted = storageManager.decrypt(encrypted);
            
            expect(encrypted).not.toBe(originalText);
            expect(decrypted).toBe(originalText);
        });
        
        test('should handle empty text', () => {
            expect(storageManager.encrypt('')).toBe('');
            expect(storageManager.decrypt('')).toBe('');
        });
        
        test('should handle null/undefined', () => {
            expect(storageManager.encrypt(null)).toBeNull();
            expect(storageManager.decrypt(null)).toBeNull();
            expect(storageManager.encrypt(undefined)).toBeUndefined();
            expect(storageManager.decrypt(undefined)).toBeUndefined();
        });
    });
    
    describe('API Key Management', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should save and retrieve API key', async () => {
            const provider = 'openai';
            const apiKey = 'sk-test1234567890abcdef';
            
            await storageManager.saveApiKey(provider, apiKey);
            const retrievedKey = await storageManager.getApiKey(provider);
            
            expect(retrievedKey).toBe(apiKey);
            expect(global.chrome.storage.local.set).toHaveBeenCalled();
        });
        
        test('should return null for non-existent API key', async () => {
            const result = await storageManager.getApiKey('nonexistent');
            expect(result).toBeNull();
        });
        
        test('should get API key info without exposing key', async () => {
            const provider = 'openai';
            const apiKey = 'sk-test1234567890abcdef';
            
            global.chrome.storage.local.get.mockResolvedValue({
                api_keys: {
                    [provider]: {
                        key: storageManager.encrypt(apiKey),
                        lastUpdated: '2025-01-15T10:00:00.000Z',
                        keyPrefix: 'sk-test1...'
                    }
                }
            });
            
            const info = await storageManager.getApiKeyInfo(provider);
            
            expect(info).toEqual({
                hasKey: true,
                lastUpdated: '2025-01-15T10:00:00.000Z',
                keyPrefix: 'sk-test1...'
            });
        });
        
        test('should delete API key', async () => {
            const provider = 'openai';
            
            global.chrome.storage.local.get.mockResolvedValue({
                api_keys: {
                    [provider]: { key: 'encrypted-key' },
                    'other-provider': { key: 'other-key' }
                }
            });
            
            await storageManager.deleteApiKey(provider);
            
            expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
                api_keys: {
                    'other-provider': { key: 'other-key' }
                }
            });
        });
    });
    
    describe('API Key Validation', () => {
        test('should validate OpenAI API key format', () => {
            const validKey = 'sk-test1234567890abcdef';
            const invalidKey = 'invalid-key';
            
            expect(storageManager.validateApiKey('openai', validKey).valid).toBe(true);
            expect(storageManager.validateApiKey('openai', invalidKey).valid).toBe(false);
            expect(storageManager.validateApiKey('openai', '').valid).toBe(false);
        });
        
        test('should validate Anthropic API key format', () => {
            const validKey = 'sk-ant-1234567890abcdef1234567890';
            const invalidKey = 'sk-wrong-format';
            
            expect(storageManager.validateApiKey('anthropic', validKey).valid).toBe(true);
            expect(storageManager.validateApiKey('anthropic', invalidKey).valid).toBe(false);
            expect(storageManager.validateApiKey('anthropic', '').valid).toBe(false);
        });
        
        test('should reject unknown providers', () => {
            const result = storageManager.validateApiKey('unknown', 'any-key');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Unknown provider');
        });
    });
    
    describe('Settings Management', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should save and load settings', async () => {
            const settings = {
                provider: 'openai',
                language: 'zh-TW',
                prompt: 'custom prompt',
                preferences: {
                    autoExtract: true,
                    showNotifications: false
                }
            };
            
            global.chrome.storage.local.get.mockImplementation((keys) => {
                if (keys.includes('extension_settings')) {
                    return Promise.resolve({ extension_settings: settings });
                } else {
                    return Promise.resolve({});
                }
            });
            
            await storageManager.saveSettings(settings);
            const loadedSettings = await storageManager.loadSettings();
            
            expect(loadedSettings.provider).toBe('openai');
            expect(loadedSettings.language).toBe('zh-TW');
            expect(loadedSettings.preferences.autoExtract).toBe(true);
        });
        
        test('should return default settings if none exist', async () => {
            const settings = await storageManager.loadSettings();
            
            expect(settings.provider).toBe('openai');
            expect(settings.language).toBe('en');
            expect(settings.prompt).toBe('default');
        });
        
        test('should merge with default settings', async () => {
            const partialSettings = {
                provider: 'anthropic',
                language: 'ja'
            };
            
            await storageManager.saveSettings(partialSettings);
            
            // Find the settings call among all mock calls
            const settingsCalls = global.chrome.storage.local.set.mock.calls.filter(call => 
                call[0].extension_settings !== undefined
            );
            const savedSettings = settingsCalls[0][0];
            expect(savedSettings.extension_settings.provider).toBe('anthropic');
            expect(savedSettings.extension_settings.language).toBe('ja');
            expect(savedSettings.extension_settings.prompt).toBe('default'); // Default value
        });
    });
    
    describe('Prompt Template Management', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should save and load prompt templates', async () => {
            const templateName = 'technical-meeting';
            const templateContent = 'Focus on technical decisions and architecture';
            
            global.chrome.storage.local.get.mockImplementation((keys) => {
                if (keys.includes('prompt_templates')) {
                    return Promise.resolve({
                        prompt_templates: {
                            [templateName]: {
                                content: templateContent,
                                created: '2025-01-15T10:00:00.000Z',
                                lastUsed: '2025-01-15T10:00:00.000Z'
                            }
                        }
                    });
                } else {
                    return Promise.resolve({});
                }
            });
            
            await storageManager.savePromptTemplate(templateName, templateContent);
            const templates = await storageManager.loadPromptTemplates();
            
            expect(templates[templateName].content).toBe(templateContent);
            expect(templates[templateName].created).toBeTruthy();
        });
        
        test('should delete prompt template', async () => {
            const templateName = 'to-delete';
            
            global.chrome.storage.local.get.mockResolvedValue({
                prompt_templates: {
                    [templateName]: { content: 'template content' },
                    'other-template': { content: 'other content' }
                }
            });
            
            await storageManager.deletePromptTemplate(templateName);
            
            expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
                prompt_templates: {
                    'other-template': { content: 'other content' }
                }
            });
        });
    });
    
    describe('Data Export/Import', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should export data without API keys', async () => {
            const mockSettings = { provider: 'openai', language: 'en' };
            const mockTemplates = { 'template1': { content: 'test' } };
            
            global.chrome.storage.local.get.mockImplementation((keys) => {
                if (keys.includes('extension_settings')) {
                    return Promise.resolve({ extension_settings: mockSettings });
                } else if (keys.includes('prompt_templates')) {
                    return Promise.resolve({ prompt_templates: mockTemplates });
                } else {
                    return Promise.resolve({});
                }
            });
            
            const exportData = await storageManager.exportData();
            
            expect(exportData.settings).toEqual(mockSettings);
            expect(exportData.promptTemplates).toEqual(mockTemplates);
            expect(exportData.exportDate).toBeTruthy();
            expect(exportData.version).toBe(1);
            expect(exportData).not.toHaveProperty('apiKeys'); // Should not include API keys
        });
        
        test('should import data successfully', async () => {
            const importData = {
                settings: { provider: 'anthropic', language: 'ja' },
                promptTemplates: { 'imported': { content: 'imported template' } },
                version: 1
            };
            
            await storageManager.importData(importData);
            
            // Check that settings were merged with defaults and saved
            const settingsCalls = global.chrome.storage.local.set.mock.calls.filter(call => 
                call[0].extension_settings !== undefined
            );
            expect(settingsCalls.length).toBeGreaterThan(0);
            expect(settingsCalls[0][0].extension_settings.provider).toBe('anthropic');
            expect(settingsCalls[0][0].extension_settings.language).toBe('ja');
            
            // Check that prompt templates were saved
            expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
                prompt_templates: importData.promptTemplates
            });
        });
    });
    
    describe('Storage Statistics', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should get storage usage statistics', async () => {
            global.chrome.storage.local.getBytesInUse.mockResolvedValue(1024);
            
            const stats = await storageManager.getStorageStats();
            
            expect(stats.bytesUsed).toBe(1024);
            expect(stats.totalQuota).toBe(5242880);
            expect(stats.percentageUsed).toBe(0); // 1024/5242880 rounds to 0%
            expect(stats.remainingBytes).toBe(5241856);
        });
    });
    
    describe('Data Cleanup', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should clear all data', async () => {
            await storageManager.clearAllData();
            
            expect(global.chrome.storage.local.clear).toHaveBeenCalled();
            expect(storageManager.initialized).toBe(false);
        });
    });
    
    describe('Migration System', () => {
        test('should run migrations on initialization', async () => {
            // Mock no existing migration version
            global.chrome.storage.local.get.mockImplementation((keys) => {
                if (keys.includes('migration_version')) {
                    return Promise.resolve({ migration_version: 0 });
                } else {
                    return Promise.resolve({});
                }
            });
            
            await storageManager.initialize();
            
            expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
                migration_version: 1
            });
        });
        
        test('should skip migrations if already current', async () => {
            // Mock current migration version
            global.chrome.storage.local.get.mockImplementation((keys) => {
                if (keys.includes('migration_version')) {
                    return Promise.resolve({ migration_version: 1 });
                } else {
                    return Promise.resolve({});
                }
            });
            
            await storageManager.initialize();
            
            // Should not set migration version again
            const migrationCalls = global.chrome.storage.local.set.mock.calls
                .filter(call => call[0].migration_version !== undefined);
            expect(migrationCalls).toHaveLength(0);
        });
    });
    
    describe('Error Handling', () => {
        beforeEach(async () => {
            await storageManager.initialize();
        });
        
        test('should handle storage errors gracefully', async () => {
            global.chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
            
            await expect(storageManager.loadSettings()).resolves.toEqual({
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
            }); // Should return defaults
        });
        
        test('should handle encryption errors gracefully', () => {
            const invalidEncryptedText = 'invalid-base64!@#';
            const result = storageManager.decrypt(invalidEncryptedText);
            expect(result).toBe(invalidEncryptedText); // Should return as-is
        });
    });
    
    describe('Key Prefix Generation', () => {
        test('should generate safe key prefixes', () => {
            expect(storageManager.getKeyPrefix('sk-test1234567890')).toBe('sk-test1...');
            expect(storageManager.getKeyPrefix('sk-ant-test1234567890')).toBe('sk-ant-t...');
            expect(storageManager.getKeyPrefix('short')).toBe('');
            expect(storageManager.getKeyPrefix('regularkey123')).toBe('regula...');
        });
    });
});