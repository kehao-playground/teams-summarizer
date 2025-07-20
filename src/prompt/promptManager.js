/**
 * Prompt Template Manager for Teams Transcript Chrome Extension
 * Manages customizable prompts for different meeting types and scenarios
 */

// Default prompt template categories
const PROMPT_CATEGORIES = {
    GENERAL: 'general',
    ACTION_ITEMS: 'action-items',
    TECHNICAL: 'technical',
    CUSTOM: 'custom'
};

// Supported prompt variables
const PROMPT_VARIABLES = {
    LANGUAGE: '{language}',
    PARTICIPANTS: '{participants}',
    DURATION: '{duration}',
    MEETING_TITLE: '{meetingTitle}',
    DATE: '{date}',
    FOCUS_AREAS: '{focusAreas}'
};

/**
 * Default prompt templates
 */
const DEFAULT_TEMPLATES = {
    [PROMPT_CATEGORIES.GENERAL]: {
        id: PROMPT_CATEGORIES.GENERAL,
        name: 'General Meeting Summary',
        description: 'Comprehensive summary suitable for most meetings',
        category: PROMPT_CATEGORIES.GENERAL,
        prompt: `You are an AI assistant that creates comprehensive meeting summaries. Please analyze the following meeting transcript and generate a structured summary in {language}.

Meeting Information:
- Title: {meetingTitle}
- Duration: {duration}
- Participants: {participants}
- Date: {date}

Please provide a summary with the following sections:

## Executive Summary
Brief overview of the meeting's main purpose and outcomes.

## Key Discussion Points
List the main topics discussed with bullet points for each major theme.

## Decisions Made
Clear list of all decisions reached during the meeting.

## Action Items
For each action item, include:
- Task description
- Assigned person (if mentioned)
- Deadline (if specified)
- Priority level

## Follow-up Required
Items that need further discussion or clarification.

## Next Steps
Clear next actions and upcoming meetings or milestones.

Please maintain professional tone and ensure accuracy. If any information is unclear or missing, note it appropriately.`,
        variables: [
            PROMPT_VARIABLES.LANGUAGE,
            PROMPT_VARIABLES.PARTICIPANTS,
            PROMPT_VARIABLES.DURATION,
            PROMPT_VARIABLES.MEETING_TITLE,
            PROMPT_VARIABLES.DATE
        ],
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },

    [PROMPT_CATEGORIES.ACTION_ITEMS]: {
        id: PROMPT_CATEGORIES.ACTION_ITEMS,
        name: 'Action Items Focus',
        description: 'Emphasizes action items, deadlines, and accountability',
        category: PROMPT_CATEGORIES.ACTION_ITEMS,
        prompt: `You are an AI assistant specialized in extracting actionable items from meeting transcripts. Please analyze the following meeting transcript and create an action-oriented summary in {language}.

Meeting Information:
- Title: {meetingTitle}
- Duration: {duration}
- Participants: {participants}
- Date: {date}

Please provide a summary with strong emphasis on actionable outcomes:

## 🎯 Action Items Summary
For each action item, provide:
- **Task**: Clear description of what needs to be done
- **Owner**: Person responsible (if mentioned)
- **Deadline**: When it should be completed
- **Priority**: High/Medium/Low based on discussion urgency
- **Dependencies**: What this task depends on
- **Success Criteria**: How to measure completion

## 📋 Quick Actions (Next 24-48 hours)
Immediate tasks that should be started right away.

## 📅 Upcoming Deadlines
Tasks organized by their due dates.

## ⚠️ Blockers and Risks
Items that might prevent action items from being completed.

## 🔄 Follow-up Meetings Required
Meetings that need to be scheduled to track progress.

## 📊 Accountability Matrix
Who is responsible for what, with clear ownership.

Focus on extracting specific, measurable, and time-bound action items. If deadlines or owners are not explicitly mentioned, note this as "TBD" or "To be assigned".`,
        variables: [
            PROMPT_VARIABLES.LANGUAGE,
            PROMPT_VARIABLES.PARTICIPANTS,
            PROMPT_VARIABLES.DURATION,
            PROMPT_VARIABLES.MEETING_TITLE,
            PROMPT_VARIABLES.DATE
        ],
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },

    [PROMPT_CATEGORIES.TECHNICAL]: {
        id: PROMPT_CATEGORIES.TECHNICAL,
        name: 'Technical Meeting',
        description: 'Focused on technical discussions, architecture, and implementation details',
        category: PROMPT_CATEGORIES.TECHNICAL,
        prompt: `You are an AI assistant specialized in technical meeting analysis. Please analyze the following technical meeting transcript and create a comprehensive summary in {language}.

Meeting Information:
- Title: {meetingTitle}
- Duration: {duration}
- Participants: {participants}
- Date: {date}
- Focus Areas: {focusAreas}

Please provide a technically-focused summary:

## 🏗️ Technical Decisions
- **Architecture Decisions**: Major structural choices made
- **Technology Stack**: Tools, frameworks, libraries discussed
- **Implementation Approach**: How solutions will be built
- **Design Patterns**: Patterns and practices agreed upon

## 🔧 Technical Issues Discussed
- **Current Problems**: Issues identified and their impact
- **Root Causes**: Technical reasons behind problems
- **Proposed Solutions**: Technical approaches considered
- **Trade-offs**: Pros and cons of different approaches

## 📋 Technical Action Items
For each technical task:
- **Implementation Task**: What needs to be built/fixed
- **Technical Requirements**: Specifications and constraints
- **Dependencies**: Technical prerequisites
- **Assigned Developer**: Who will implement (if mentioned)
- **Estimated Effort**: Time estimates if discussed
- **Testing Requirements**: How to validate the solution

## 🔍 Technical Risks and Concerns
- **Potential Issues**: Technical risks identified
- **Mitigation Strategies**: How to address risks
- **Performance Considerations**: Scalability and performance impacts
- **Security Implications**: Security aspects discussed

## 📊 System Architecture
- **Components Affected**: Which parts of the system are involved
- **Integration Points**: How components interact
- **Data Flow**: How information moves through the system
- **APIs and Interfaces**: External dependencies and contracts

## 🚀 Implementation Plan
- **Development Phases**: How work will be broken down
- **Milestones**: Key technical deliverables
- **Testing Strategy**: Unit, integration, and system testing
- **Deployment Approach**: How changes will be released

Focus on technical details, implementation specifics, and architectural implications. Preserve technical terminology and provide clear technical context.`,
        variables: [
            PROMPT_VARIABLES.LANGUAGE,
            PROMPT_VARIABLES.PARTICIPANTS,
            PROMPT_VARIABLES.DURATION,
            PROMPT_VARIABLES.MEETING_TITLE,
            PROMPT_VARIABLES.DATE,
            PROMPT_VARIABLES.FOCUS_AREAS
        ],
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
};

/**
 * Prompt Template Manager class
 */
class PromptManager {
    constructor() {
        this.templates = new Map();
        this.currentTemplate = PROMPT_CATEGORIES.GENERAL;
        this.storageKey = 'promptTemplates';
        this.settingsKey = 'promptSettings';
        
        // Initialize with default templates
        this.initializeDefaultTemplates();
    }

    /**
     * Initialize default templates
     */
    initializeDefaultTemplates() {
        Object.values(DEFAULT_TEMPLATES).forEach(template => {
            this.templates.set(template.id, template);
        });
    }

    /**
     * Load templates from Chrome storage
     * @returns {Promise<void>}
     */
    async loadFromStorage() {
        try {
            const result = await chrome.storage.local.get([this.storageKey, this.settingsKey]);
            
            // Load custom templates
            if (result[this.storageKey]) {
                const storedTemplates = JSON.parse(result[this.storageKey]);
                storedTemplates.forEach(template => {
                    this.templates.set(template.id, template);
                });
            }

            // Load settings
            if (result[this.settingsKey]) {
                const settings = JSON.parse(result[this.settingsKey]);
                this.currentTemplate = settings.currentTemplate || PROMPT_CATEGORIES.GENERAL;
            }

            console.log('[PromptManager] Loaded templates from storage:', this.templates.size);
        } catch (error) {
            console.error('[PromptManager] Failed to load from storage:', error);
            // Fallback to defaults
            this.initializeDefaultTemplates();
        }
    }

    /**
     * Save templates to Chrome storage
     * @returns {Promise<void>}
     */
    async saveToStorage() {
        try {
            // Save only custom templates (built-in ones are always available)
            const customTemplates = Array.from(this.templates.values())
                .filter(template => !template.isBuiltIn);

            const settings = {
                currentTemplate: this.currentTemplate
            };

            await chrome.storage.local.set({
                [this.storageKey]: JSON.stringify(customTemplates),
                [this.settingsKey]: JSON.stringify(settings)
            });

            console.log('[PromptManager] Saved templates to storage');
        } catch (error) {
            console.error('[PromptManager] Failed to save to storage:', error);
            throw new Error(`Failed to save prompt templates: ${error.message}`);
        }
    }

    /**
     * Get all available templates
     * @returns {Array<Object>} Array of template objects
     */
    getAllTemplates() {
        return Array.from(this.templates.values()).sort((a, b) => {
            // Sort built-in templates first, then by name
            if (a.isBuiltIn && !b.isBuiltIn) return -1;
            if (!a.isBuiltIn && b.isBuiltIn) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * Get templates by category
     * @param {string} category - Template category
     * @returns {Array<Object>} Filtered templates
     */
    getTemplatesByCategory(category) {
        return Array.from(this.templates.values())
            .filter(template => template.category === category);
    }

    /**
     * Get template by ID
     * @param {string} templateId - Template ID
     * @returns {Object|null} Template object or null if not found
     */
    getTemplate(templateId) {
        return this.templates.get(templateId) || null;
    }

    /**
     * Get current active template
     * @returns {Object} Current template
     */
    getCurrentTemplate() {
        return this.getTemplate(this.currentTemplate) || this.getTemplate(PROMPT_CATEGORIES.GENERAL);
    }

    /**
     * Set current active template
     * @param {string} templateId - Template ID to set as current
     * @returns {Promise<boolean>} Success status
     */
    async setCurrentTemplate(templateId) {
        if (!this.templates.has(templateId)) {
            throw new Error(`Template not found: ${templateId}`);
        }

        this.currentTemplate = templateId;
        await this.saveToStorage();
        
        console.log('[PromptManager] Set current template:', templateId);
        return true;
    }

    /**
     * Create new custom template
     * @param {Object} templateData - Template data
     * @returns {Promise<string>} Created template ID
     */
    async createTemplate(templateData) {
        const template = {
            id: this.generateTemplateId(templateData.name),
            name: templateData.name,
            description: templateData.description || '',
            category: templateData.category || PROMPT_CATEGORIES.CUSTOM,
            prompt: templateData.prompt,
            variables: this.extractVariables(templateData.prompt),
            isBuiltIn: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Validate template
        this.validateTemplate(template);

        this.templates.set(template.id, template);
        await this.saveToStorage();

        console.log('[PromptManager] Created template:', template.id);
        return template.id;
    }

    /**
     * Update existing template
     * @param {string} templateId - Template ID to update
     * @param {Object} updates - Template updates
     * @returns {Promise<boolean>} Success status
     */
    async updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        if (template.isBuiltIn) {
            throw new Error('Cannot modify built-in templates');
        }

        const updatedTemplate = {
            ...template,
            ...updates,
            id: templateId, // Preserve ID
            isBuiltIn: false, // Ensure custom templates remain custom
            updatedAt: new Date().toISOString()
        };

        // Re-extract variables if prompt changed
        if (updates.prompt) {
            updatedTemplate.variables = this.extractVariables(updates.prompt);
        }

        // Validate updated template
        this.validateTemplate(updatedTemplate);

        this.templates.set(templateId, updatedTemplate);
        await this.saveToStorage();

        console.log('[PromptManager] Updated template:', templateId);
        return true;
    }

    /**
     * Delete template
     * @param {string} templateId - Template ID to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        if (template.isBuiltIn) {
            throw new Error('Cannot delete built-in templates');
        }

        this.templates.delete(templateId);

        // If this was the current template, switch to default
        if (this.currentTemplate === templateId) {
            this.currentTemplate = PROMPT_CATEGORIES.GENERAL;
        }

        await this.saveToStorage();

        console.log('[PromptManager] Deleted template:', templateId);
        return true;
    }

    /**
     * Process template with variables
     * @param {string|Object} template - Template ID or template object
     * @param {Object} variables - Variable values
     * @returns {string} Processed prompt text
     */
    processTemplate(template, variables = {}) {
        const templateObj = typeof template === 'string' ? this.getTemplate(template) : template;
        if (!templateObj) {
            throw new Error('Template not found');
        }

        let processedPrompt = templateObj.prompt;

        // Replace variables
        Object.entries(variables).forEach(([key, value]) => {
            const variable = `{${key}}`;
            const replacement = value || `[${key} not provided]`;
            processedPrompt = processedPrompt.replace(new RegExp(variable, 'g'), replacement);
        });

        // Handle any remaining unreplaced variables
        const remainingVariables = processedPrompt.match(/\{([^}]+)\}/g);
        if (remainingVariables) {
            remainingVariables.forEach(variable => {
                const varName = variable.slice(1, -1); // Remove braces
                processedPrompt = processedPrompt.replace(variable, `[${varName} not provided]`);
            });
        }

        return processedPrompt;
    }

    /**
     * Export templates to JSON
     * @param {Array<string>} templateIds - Template IDs to export (optional, exports all if not provided)
     * @returns {string} JSON string
     */
    exportTemplates(templateIds = null) {
        let templatesToExport;

        if (templateIds) {
            templatesToExport = templateIds.map(id => this.getTemplate(id)).filter(Boolean);
        } else {
            // Export only custom templates by default
            templatesToExport = Array.from(this.templates.values()).filter(t => !t.isBuiltIn);
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            templates: templatesToExport
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import templates from JSON
     * @param {string} jsonData - JSON string containing templates
     * @param {Object} options - Import options
     * @returns {Promise<Array<string>>} Array of imported template IDs
     */
    async importTemplates(jsonData, options = {}) {
        try {
            const importData = JSON.parse(jsonData);
            
            if (!importData.templates || !Array.isArray(importData.templates)) {
                throw new Error('Invalid import format: missing templates array');
            }

            const { overwrite = false, prefix = '' } = options;
            const importedIds = [];

            for (const templateData of importData.templates) {
                try {
                    // Validate template structure
                    this.validateTemplate(templateData);

                    let templateId = templateData.id;
                    
                    // Handle ID conflicts
                    if (this.templates.has(templateId)) {
                        if (!overwrite) {
                            templateId = this.generateUniqueId(templateId, prefix);
                        }
                    }

                    const template = {
                        ...templateData,
                        id: templateId,
                        isBuiltIn: false, // Imported templates are always custom
                        createdAt: templateData.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    this.templates.set(templateId, template);
                    importedIds.push(templateId);

                } catch (error) {
                    console.error('[PromptManager] Failed to import template:', templateData.name, error);
                    // Continue with other templates
                }
            }

            if (importedIds.length > 0) {
                await this.saveToStorage();
                console.log('[PromptManager] Imported templates:', importedIds);
            }

            return importedIds;

        } catch (error) {
            console.error('[PromptManager] Import failed:', error);
            throw new Error(`Failed to import templates: ${error.message}`);
        }
    }

    /**
     * Get available prompt variables
     * @returns {Object} Available variables with descriptions
     */
    getAvailableVariables() {
        return {
            language: {
                variable: PROMPT_VARIABLES.LANGUAGE,
                description: 'Output language for the summary',
                example: 'English, 繁體中文, 日本語'
            },
            participants: {
                variable: PROMPT_VARIABLES.PARTICIPANTS,
                description: 'List of meeting participants',
                example: 'John Smith, Sarah Johnson, Mike Chen'
            },
            duration: {
                variable: PROMPT_VARIABLES.DURATION,
                description: 'Meeting duration',
                example: '01:30:00'
            },
            meetingTitle: {
                variable: PROMPT_VARIABLES.MEETING_TITLE,
                description: 'Title of the meeting',
                example: 'Q2 Planning Meeting'
            },
            date: {
                variable: PROMPT_VARIABLES.DATE,
                description: 'Meeting date',
                example: '2024-01-15'
            },
            focusAreas: {
                variable: PROMPT_VARIABLES.FOCUS_AREAS,
                description: 'Specific areas to focus on in the summary',
                example: 'technical decisions, action items, budget'
            }
        };
    }

    // Helper methods

    /**
     * Generate template ID from name
     * @param {string} name - Template name
     * @returns {string} Generated ID
     */
    generateTemplateId(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
            .substring(0, 50) || 'template'; // Fallback for empty results
    }

    /**
     * Generate unique ID to avoid conflicts
     * @param {string} baseId - Base ID
     * @param {string} prefix - Optional prefix
     * @returns {string} Unique ID
     */
    generateUniqueId(baseId, prefix = '') {
        let counter = 1;
        let newId = prefix ? `${prefix}-${baseId}` : baseId;
        
        while (this.templates.has(newId)) {
            newId = prefix ? `${prefix}-${baseId}-${counter}` : `${baseId}-${counter}`;
            counter++;
        }
        
        return newId;
    }

    /**
     * Extract variables from prompt text
     * @param {string} prompt - Prompt text
     * @returns {Array<string>} Array of variable names
     */
    extractVariables(prompt) {
        const matches = prompt.match(/\{([^}]+)\}/g);
        return matches ? [...new Set(matches)] : [];
    }

    /**
     * Validate template structure
     * @param {Object} template - Template object
     * @throws {Error} If template is invalid
     */
    validateTemplate(template) {
        const required = ['id', 'name', 'prompt'];
        const missing = required.filter(field => !template[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        if (template.name.length < 3) {
            throw new Error('Template name must be at least 3 characters');
        }

        if (template.prompt.length < 10) {
            throw new Error('Template prompt must be at least 10 characters');
        }
    }

    /**
     * Get template usage statistics
     * @returns {Object} Usage statistics
     */
    getStatistics() {
        const templates = Array.from(this.templates.values());
        return {
            total: templates.length,
            builtIn: templates.filter(t => t.isBuiltIn).length,
            custom: templates.filter(t => !t.isBuiltIn).length,
            categories: Object.values(PROMPT_CATEGORIES).reduce((acc, category) => {
                acc[category] = templates.filter(t => t.category === category).length;
                return acc;
            }, {}),
            currentTemplate: this.currentTemplate
        };
    }
}

// Create singleton instance
const promptManager = new PromptManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        PromptManager, 
        promptManager, 
        PROMPT_CATEGORIES, 
        PROMPT_VARIABLES,
        DEFAULT_TEMPLATES
    };
} else {
    // Browser environment - attach to window
    window.PromptManager = PromptManager;
    window.promptManager = promptManager;
    window.PROMPT_CATEGORIES = PROMPT_CATEGORIES;
    window.PROMPT_VARIABLES = PROMPT_VARIABLES;
    window.DEFAULT_TEMPLATES = DEFAULT_TEMPLATES;
}