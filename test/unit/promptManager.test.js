/**
 * Unit Tests for Prompt Manager
 * Tests all prompt template functionality
 */

const { PromptManager, PROMPT_CATEGORIES, PROMPT_VARIABLES, DEFAULT_TEMPLATES } = require('../../src/prompt/promptManager');

// Mock Chrome storage API
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Mock console to avoid noise in tests
console.log = jest.fn();
console.error = jest.fn();

describe('PromptManager', () => {
    let promptManager;
    
    beforeEach(() => {
        promptManager = new PromptManager();
        jest.clearAllMocks();
        
        // Mock successful storage operations
        chrome.storage.local.get.mockResolvedValue({});
        chrome.storage.local.set.mockResolvedValue();
    });

    describe('Initialization', () => {
        test('should initialize with default templates', () => {
            expect(promptManager.getAllTemplates()).toHaveLength(3);
            expect(promptManager.getTemplate(PROMPT_CATEGORIES.GENERAL)).toBeTruthy();
            expect(promptManager.getTemplate(PROMPT_CATEGORIES.ACTION_ITEMS)).toBeTruthy();
            expect(promptManager.getTemplate(PROMPT_CATEGORIES.TECHNICAL)).toBeTruthy();
        });

        test('should set general as current template by default', () => {
            const current = promptManager.getCurrentTemplate();
            expect(current.id).toBe(PROMPT_CATEGORIES.GENERAL);
        });

        test('should have proper default template structure', () => {
            const generalTemplate = promptManager.getTemplate(PROMPT_CATEGORIES.GENERAL);
            
            expect(generalTemplate).toHaveProperty('id');
            expect(generalTemplate).toHaveProperty('name');
            expect(generalTemplate).toHaveProperty('description');
            expect(generalTemplate).toHaveProperty('category');
            expect(generalTemplate).toHaveProperty('prompt');
            expect(generalTemplate).toHaveProperty('variables');
            expect(generalTemplate).toHaveProperty('isBuiltIn', true);
            expect(generalTemplate).toHaveProperty('createdAt');
            expect(generalTemplate).toHaveProperty('updatedAt');
        });
    });

    describe('Template Retrieval', () => {
        test('should get all templates sorted properly', () => {
            const templates = promptManager.getAllTemplates();
            
            // Built-in templates should come first
            expect(templates[0].isBuiltIn).toBe(true);
            expect(templates[1].isBuiltIn).toBe(true);
            expect(templates[2].isBuiltIn).toBe(true);
        });

        test('should get templates by category', () => {
            const generalTemplates = promptManager.getTemplatesByCategory(PROMPT_CATEGORIES.GENERAL);
            const technicalTemplates = promptManager.getTemplatesByCategory(PROMPT_CATEGORIES.TECHNICAL);
            
            expect(generalTemplates).toHaveLength(1);
            expect(technicalTemplates).toHaveLength(1);
            expect(generalTemplates[0].category).toBe(PROMPT_CATEGORIES.GENERAL);
            expect(technicalTemplates[0].category).toBe(PROMPT_CATEGORIES.TECHNICAL);
        });

        test('should return null for non-existent template', () => {
            const template = promptManager.getTemplate('non-existent');
            expect(template).toBeNull();
        });

        test('should get current template', () => {
            const current = promptManager.getCurrentTemplate();
            expect(current).toBeTruthy();
            expect(current.id).toBe(PROMPT_CATEGORIES.GENERAL);
        });
    });

    describe('Template Management', () => {
        test('should set current template', async () => {
            await promptManager.setCurrentTemplate(PROMPT_CATEGORIES.TECHNICAL);
            
            const current = promptManager.getCurrentTemplate();
            expect(current.id).toBe(PROMPT_CATEGORIES.TECHNICAL);
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        test('should throw error when setting non-existent template', async () => {
            await expect(promptManager.setCurrentTemplate('non-existent'))
                .rejects.toThrow('Template not found: non-existent');
        });

        test('should create new custom template', async () => {
            const templateData = {
                name: 'Test Template',
                description: 'Test description',
                category: PROMPT_CATEGORIES.CUSTOM,
                prompt: 'This is a test prompt with {language} variable.'
            };

            const templateId = await promptManager.createTemplate(templateData);
            
            expect(templateId).toBe('test-template');
            
            const template = promptManager.getTemplate(templateId);
            expect(template.name).toBe('Test Template');
            expect(template.isBuiltIn).toBe(false);
            expect(template.variables).toContain('{language}');
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        test('should update existing custom template', async () => {
            // First create a template
            const templateId = await promptManager.createTemplate({
                name: 'Test Template',
                prompt: 'Original prompt'
            });

            // Then update it
            await promptManager.updateTemplate(templateId, {
                name: 'Updated Template',
                prompt: 'Updated prompt with {participants}'
            });

            const template = promptManager.getTemplate(templateId);
            expect(template.name).toBe('Updated Template');
            expect(template.prompt).toBe('Updated prompt with {participants}');
            expect(template.variables).toContain('{participants}');
        });

        test('should not allow updating built-in templates', async () => {
            await expect(promptManager.updateTemplate(PROMPT_CATEGORIES.GENERAL, {
                name: 'Modified General'
            })).rejects.toThrow('Cannot modify built-in templates');
        });

        test('should delete custom template', async () => {
            // Create a template first
            const templateId = await promptManager.createTemplate({
                name: 'Delete Me',
                prompt: 'This will be deleted'
            });

            expect(promptManager.getTemplate(templateId)).toBeTruthy();

            // Delete it
            await promptManager.deleteTemplate(templateId);
            
            expect(promptManager.getTemplate(templateId)).toBeNull();
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        test('should not allow deleting built-in templates', async () => {
            await expect(promptManager.deleteTemplate(PROMPT_CATEGORIES.GENERAL))
                .rejects.toThrow('Cannot delete built-in templates');
        });

        test('should switch to default when deleting current template', async () => {
            // Create and set as current
            const templateId = await promptManager.createTemplate({
                name: 'Current Template',
                prompt: 'Current prompt'
            });
            await promptManager.setCurrentTemplate(templateId);

            // Delete it
            await promptManager.deleteTemplate(templateId);

            // Should fall back to general
            expect(promptManager.getCurrentTemplate().id).toBe(PROMPT_CATEGORIES.GENERAL);
        });
    });

    describe('Template Processing', () => {
        test('should process template with variables', () => {
            const template = promptManager.getTemplate(PROMPT_CATEGORIES.GENERAL);
            const variables = {
                language: 'English',
                participants: 'John, Sarah, Mike',
                duration: '01:30:00',
                meetingTitle: 'Test Meeting',
                date: '2024-01-15'
            };

            const processed = promptManager.processTemplate(template, variables);

            expect(processed).toContain('English');
            expect(processed).toContain('John, Sarah, Mike');
            expect(processed).toContain('01:30:00');
            expect(processed).toContain('Test Meeting');
            expect(processed).toContain('2024-01-15');
            expect(processed).not.toContain('{language}');
        });

        test('should handle missing variables gracefully', () => {
            const template = promptManager.getTemplate(PROMPT_CATEGORIES.GENERAL);
            const variables = {
                language: 'English'
                // Missing other variables
            };

            const processed = promptManager.processTemplate(template, variables);

            expect(processed).toContain('English');
            expect(processed).toContain('[participants not provided]');
            expect(processed).toContain('[duration not provided]');
        });

        test('should process template by ID', () => {
            const processed = promptManager.processTemplate(PROMPT_CATEGORIES.TECHNICAL, {
                language: 'Japanese'
            });

            expect(processed).toContain('Japanese');
            expect(processed).toContain('Technical Decisions');
        });

        test('should throw error for non-existent template', () => {
            expect(() => {
                promptManager.processTemplate('non-existent', {});
            }).toThrow('Template not found');
        });
    });

    describe('Template Validation', () => {
        test('should validate required fields', () => {
            expect(() => {
                promptManager.validateTemplate({});
            }).toThrow('Missing required fields: id, name, prompt');
        });

        test('should validate name length', () => {
            expect(() => {
                promptManager.validateTemplate({
                    id: 'test',
                    name: 'ab', // Too short
                    prompt: 'Valid prompt'
                });
            }).toThrow('Template name must be at least 3 characters');
        });

        test('should validate prompt length', () => {
            expect(() => {
                promptManager.validateTemplate({
                    id: 'test',
                    name: 'Valid Name',
                    prompt: 'short' // Too short
                });
            }).toThrow('Template prompt must be at least 10 characters');
        });

        test('should pass validation for valid template', () => {
            expect(() => {
                promptManager.validateTemplate({
                    id: 'test',
                    name: 'Valid Name',
                    prompt: 'This is a valid prompt with sufficient length'
                });
            }).not.toThrow();
        });
    });

    describe('Import/Export Functionality', () => {
        test('should export templates to JSON', () => {
            // Create a custom template first
            const customTemplate = {
                id: 'custom-test',
                name: 'Custom Test',
                description: 'Test description',
                category: PROMPT_CATEGORIES.CUSTOM,
                prompt: 'Custom prompt',
                variables: [],
                isBuiltIn: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            promptManager.templates.set('custom-test', customTemplate);

            const exported = promptManager.exportTemplates();
            const exportData = JSON.parse(exported);

            expect(exportData).toHaveProperty('version', '1.0');
            expect(exportData).toHaveProperty('exportedAt');
            expect(exportData).toHaveProperty('templates');
            expect(exportData.templates).toHaveLength(1); // Only custom templates
            expect(exportData.templates[0].name).toBe('Custom Test');
        });

        test('should export specific templates', () => {
            const exported = promptManager.exportTemplates([PROMPT_CATEGORIES.GENERAL]);
            const exportData = JSON.parse(exported);

            expect(exportData.templates).toHaveLength(1);
            expect(exportData.templates[0].id).toBe(PROMPT_CATEGORIES.GENERAL);
        });

        test('should import templates from JSON', async () => {
            const importData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                templates: [{
                    id: 'imported-template',
                    name: 'Imported Template',
                    description: 'Imported description',
                    category: PROMPT_CATEGORIES.CUSTOM,
                    prompt: 'Imported prompt with {language}',
                    variables: ['{language}'],
                    isBuiltIn: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }]
            };

            const importedIds = await promptManager.importTemplates(JSON.stringify(importData));

            expect(importedIds).toHaveLength(1);
            expect(importedIds[0]).toBe('imported-template');
            
            const imported = promptManager.getTemplate('imported-template');
            expect(imported.name).toBe('Imported Template');
            expect(imported.isBuiltIn).toBe(false);
        });

        test('should handle ID conflicts during import', async () => {
            // Import a template with conflicting ID
            const importData = {
                templates: [{
                    id: PROMPT_CATEGORIES.GENERAL, // Conflicts with built-in
                    name: 'Conflicting Template',
                    prompt: 'This conflicts with built-in template'
                }]
            };

            const importedIds = await promptManager.importTemplates(
                JSON.stringify(importData), 
                { prefix: 'imported' }
            );

            expect(importedIds).toHaveLength(1);
            expect(importedIds[0]).toBe('imported-general');
        });

        test('should handle invalid import data', async () => {
            await expect(promptManager.importTemplates('invalid json'))
                .rejects.toThrow('Failed to import templates');

            await expect(promptManager.importTemplates('{}'))
                .rejects.toThrow('Invalid import format: missing templates array');
        });
    });

    describe('Helper Methods', () => {
        test('should generate template ID from name', () => {
            expect(promptManager.generateTemplateId('Test Template')).toBe('test-template');
            expect(promptManager.generateTemplateId('Test!@#$%^&*()Template')).toBe('testtemplate');
            expect(promptManager.generateTemplateId('   Multiple   Spaces   ')).toBe('multiple-spaces');
        });

        test('should generate unique IDs', () => {
            // Add a template with base ID
            promptManager.templates.set('test-id', { id: 'test-id' });
            
            const uniqueId = promptManager.generateUniqueId('test-id');
            expect(uniqueId).toBe('test-id-1');
            
            // Add another and test again
            promptManager.templates.set('test-id-1', { id: 'test-id-1' });
            const uniqueId2 = promptManager.generateUniqueId('test-id');
            expect(uniqueId2).toBe('test-id-2');
        });

        test('should extract variables from prompt', () => {
            const prompt = 'This is a {language} prompt with {participants} and {date}';
            const variables = promptManager.extractVariables(prompt);
            
            expect(variables).toHaveLength(3);
            expect(variables).toContain('{language}');
            expect(variables).toContain('{participants}');
            expect(variables).toContain('{date}');
        });

        test('should handle prompts without variables', () => {
            const prompt = 'This prompt has no variables';
            const variables = promptManager.extractVariables(prompt);
            
            expect(variables).toHaveLength(0);
        });

        test('should get available variables info', () => {
            const variables = promptManager.getAvailableVariables();
            
            expect(variables).toHaveProperty('language');
            expect(variables).toHaveProperty('participants');
            expect(variables).toHaveProperty('duration');
            expect(variables.language).toHaveProperty('variable', PROMPT_VARIABLES.LANGUAGE);
            expect(variables.language).toHaveProperty('description');
            expect(variables.language).toHaveProperty('example');
        });

        test('should get statistics', () => {
            const stats = promptManager.getStatistics();
            
            expect(stats).toHaveProperty('total', 3);
            expect(stats).toHaveProperty('builtIn', 3);
            expect(stats).toHaveProperty('custom', 0);
            expect(stats).toHaveProperty('categories');
            expect(stats).toHaveProperty('currentTemplate', PROMPT_CATEGORIES.GENERAL);
            expect(stats.categories[PROMPT_CATEGORIES.GENERAL]).toBe(1);
        });
    });

    describe('Storage Operations', () => {
        test('should load templates from storage', async () => {
            const storedTemplates = [{
                id: 'stored-template',
                name: 'Stored Template',
                prompt: 'Stored prompt',
                isBuiltIn: false
            }];

            const storedSettings = {
                currentTemplate: PROMPT_CATEGORIES.TECHNICAL
            };

            chrome.storage.local.get.mockResolvedValueOnce({
                promptTemplates: JSON.stringify(storedTemplates),
                promptSettings: JSON.stringify(storedSettings)
            });

            await promptManager.loadFromStorage();

            expect(promptManager.getTemplate('stored-template')).toBeTruthy();
            expect(promptManager.getCurrentTemplate().id).toBe(PROMPT_CATEGORIES.TECHNICAL);
        });

        test('should handle storage errors gracefully', async () => {
            chrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));

            await promptManager.loadFromStorage();

            // Should still have default templates
            expect(promptManager.getAllTemplates()).toHaveLength(3);
            expect(promptManager.getCurrentTemplate().id).toBe(PROMPT_CATEGORIES.GENERAL);
        });

        test('should save templates to storage', async () => {
            // Create a custom template
            await promptManager.createTemplate({
                name: 'Save Test',
                prompt: 'Test prompt'
            });

            // Should save to storage
            expect(chrome.storage.local.set).toHaveBeenCalled();
            
            const lastCall = chrome.storage.local.set.mock.calls[chrome.storage.local.set.mock.calls.length - 1];
            const savedData = lastCall[0];
            
            expect(savedData).toHaveProperty('promptTemplates');
            expect(savedData).toHaveProperty('promptSettings');
        });

        test('should handle save errors', async () => {
            chrome.storage.local.set.mockRejectedValueOnce(new Error('Save error'));

            await expect(promptManager.saveToStorage())
                .rejects.toThrow('Failed to save prompt templates: Save error');
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty template name', async () => {
            await expect(promptManager.createTemplate({
                name: '',
                prompt: 'Valid prompt content'
            })).rejects.toThrow('Missing required fields');
        });

        test('should handle very long template names', async () => {
            const longName = 'A'.repeat(100);
            const templateId = await promptManager.createTemplate({
                name: longName,
                prompt: 'Valid prompt content'
            });

            // ID should be truncated
            expect(templateId.length).toBeLessThanOrEqual(50);
        });

        test('should handle unicode characters in names', async () => {
            const templateId = await promptManager.createTemplate({
                name: '會議摘要模板',
                prompt: 'Unicode template prompt'
            });

            expect(templateId).toBe('template'); // Falls back to 'template' for non-ASCII
            
            // Should still create template with generated ID
            const templates = promptManager.getAllTemplates();
            const customTemplates = templates.filter(t => !t.isBuiltIn);
            expect(customTemplates).toHaveLength(1);
            expect(customTemplates[0].name).toBe('會議摘要模板');
        });

        test('should handle multiple variable occurrences', () => {
            const template = {
                prompt: 'Language is {language}. Please use {language} for output. The {language} should be consistent.'
            };
            
            const processed = promptManager.processTemplate(template, { language: 'Spanish' });
            
            expect(processed).toBe('Language is Spanish. Please use Spanish for output. The Spanish should be consistent.');
        });
    });
});