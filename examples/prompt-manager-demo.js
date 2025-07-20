/**
 * Prompt Manager Demo
 * 
 * Demonstrates the prompt template management functionality.
 * Shows how different prompt templates work and their customization features.
 * 
 * Usage:
 *   node examples/prompt-manager-demo.js
 */

const { PromptManager, PROMPT_CATEGORIES, PROMPT_VARIABLES } = require('../src/prompt/promptManager');

// Mock Chrome storage for demo
global.chrome = {
    storage: {
        local: {
            get: async () => ({}),
            set: async () => {}
        }
    }
};

// Sample meeting data for template processing
const sampleMeetingData = {
    language: 'English',
    participants: 'John Smith, Sarah Johnson, Mike Chen, Lisa Wong',
    duration: '01:45:30',
    meetingTitle: 'Q2 Product Planning Meeting',
    date: '2024-01-15',
    focusAreas: 'technical decisions, action items, budget allocation'
};

const chineseMeetingData = {
    language: '繁體中文',
    participants: '王小明, 李小華, 陳大偉, 黃美玲',
    duration: '01:30:00',
    meetingTitle: 'Q2產品規劃會議',
    date: '2024-01-15',
    focusAreas: '技術決策, 行動項目, 預算分配'
};

// Demo functions
async function demonstratePromptManager() {
    console.log('📝 Prompt Manager Demo');
    console.log('=====================\n');

    const promptManager = new PromptManager();
    await promptManager.loadFromStorage();

    console.log('1️⃣ Available Default Templates:\n');
    const templates = promptManager.getAllTemplates();
    templates.forEach(template => {
        console.log(`   📋 ${template.name} (${template.id})`);
        console.log(`      Category: ${template.category}`);
        console.log(`      Description: ${template.description}`);
        console.log(`      Variables: ${template.variables.length} (${template.variables.slice(0, 3).join(', ')}${template.variables.length > 3 ? '...' : ''})`);
        console.log(`      Built-in: ${template.isBuiltIn ? 'Yes' : 'No'}`);
        console.log('');
    });

    return promptManager;
}

async function demonstrateTemplateProcessing() {
    console.log('⚙️ Template Processing Demo');
    console.log('===========================\n');

    const promptManager = new PromptManager();

    console.log('1️⃣ Processing General Template with English Data:\n');
    
    const generalPrompt = promptManager.processTemplate(PROMPT_CATEGORIES.GENERAL, sampleMeetingData);
    console.log('📄 Processed General Template:');
    console.log('─'.repeat(50));
    console.log(generalPrompt.substring(0, 300) + '...\n');

    console.log('2️⃣ Processing Action Items Template:\n');
    
    const actionPrompt = promptManager.processTemplate(PROMPT_CATEGORIES.ACTION_ITEMS, sampleMeetingData);
    console.log('📋 Processed Action Items Template:');
    console.log('─'.repeat(50));
    console.log(actionPrompt.substring(0, 300) + '...\n');

    console.log('3️⃣ Processing Technical Template with Focus Areas:\n');
    
    const technicalPrompt = promptManager.processTemplate(PROMPT_CATEGORIES.TECHNICAL, sampleMeetingData);
    console.log('🔧 Processed Technical Template:');
    console.log('─'.repeat(50));
    console.log(technicalPrompt.substring(0, 300) + '...\n');

    console.log('4️⃣ Processing with Chinese Data:\n');
    
    const chinesePrompt = promptManager.processTemplate(PROMPT_CATEGORIES.GENERAL, chineseMeetingData);
    console.log('🇹🇼 Processed Chinese Template:');
    console.log('─'.repeat(50));
    console.log(chinesePrompt.substring(0, 300) + '...\n');
}

async function demonstrateCustomTemplates() {
    console.log('🛠️ Custom Template Management Demo');
    console.log('==================================\n');

    const promptManager = new PromptManager();

    console.log('1️⃣ Creating Custom Templates:\n');

    // Create a custom standup template
    const standupTemplateId = await promptManager.createTemplate({
        name: 'Daily Standup',
        description: 'Template for daily standup meetings',
        category: 'custom',
        prompt: `Please create a standup summary for {meetingTitle} on {date} in {language}.

Participants: {participants}
Duration: {duration}

Focus on:
## What was accomplished
- Key work completed since last standup

## Current priorities  
- What team members are working on today

## Blockers and impediments
- Issues that need resolution or support

## Action items
- Specific next steps and commitments

Keep the summary concise and actionable for a development team.`
    });

    console.log(`✅ Created custom template: ${standupTemplateId}`);

    // Create a retrospective template
    const retroTemplateId = await promptManager.createTemplate({
        name: 'Sprint Retrospective',
        description: 'Template for sprint retrospective meetings',
        category: 'custom',
        prompt: `Analyze this sprint retrospective meeting transcript and create a structured summary in {language}.

Meeting: {meetingTitle}
Date: {date}
Team: {participants}
Duration: {duration}

## What went well this sprint
- Successes and positive outcomes
- Team achievements and good practices

## What could be improved  
- Areas for enhancement
- Process issues and challenges

## Action items for next sprint
- Specific improvements to implement
- Process changes to try
- Who will champion each change

## Key insights and learnings
- Important discoveries about team or process
- Patterns or trends observed

Focus on actionable insights for continuous improvement.`
    });

    console.log(`✅ Created custom template: ${retroTemplateId}`);

    console.log('\n2️⃣ Processing Custom Templates:\n');

    const standupData = {
        ...sampleMeetingData,
        meetingTitle: 'Daily Development Standup',
        duration: '00:15:00'
    };

    const processedStandup = promptManager.processTemplate(standupTemplateId, standupData);
    console.log('📅 Processed Standup Template:');
    console.log('─'.repeat(50));
    console.log(processedStandup.substring(0, 250) + '...\n');

    console.log('3️⃣ Template Statistics:\n');
    const stats = promptManager.getStatistics();
    console.log(`   Total templates: ${stats.total}`);
    console.log(`   Built-in: ${stats.builtIn}`);
    console.log(`   Custom: ${stats.custom}`);
    console.log(`   Current template: ${stats.currentTemplate}`);
    console.log('');

    return { standupTemplateId, retroTemplateId };
}

async function demonstrateImportExport() {
    console.log('📤 Import/Export Demo');
    console.log('=====================\n');

    const promptManager = new PromptManager();

    // Create some custom templates first
    await promptManager.createTemplate({
        name: 'Client Meeting',
        description: 'Template for client meetings',
        prompt: 'Summarize this client meeting for {meetingTitle} in {language}...'
    });

    await promptManager.createTemplate({
        name: 'Executive Review',
        description: 'Template for executive reviews',
        prompt: 'Create an executive summary for {meetingTitle} covering key decisions...'
    });

    console.log('1️⃣ Exporting Templates:\n');

    const exported = promptManager.exportTemplates();
    const exportData = JSON.parse(exported);
    
    console.log(`📦 Export Data:`);
    console.log(`   Version: ${exportData.version}`);
    console.log(`   Exported at: ${exportData.exportedAt}`);
    console.log(`   Templates count: ${exportData.templates.length}`);
    
    exportData.templates.forEach(template => {
        console.log(`   - ${template.name} (${template.id})`);
    });
    console.log('');

    console.log('2️⃣ Import Simulation:\n');

    // Simulate importing to a new prompt manager
    const newPromptManager = new PromptManager();
    const importedIds = await newPromptManager.importTemplates(exported);

    console.log(`✅ Imported ${importedIds.length} templates:`);
    importedIds.forEach(id => {
        const template = newPromptManager.getTemplate(id);
        console.log(`   - ${template.name} (${id})`);
    });
    console.log('');

    console.log('3️⃣ Export with Specific Templates:\n');

    const specificExport = promptManager.exportTemplates(['client-meeting']);
    const specificData = JSON.parse(specificExport);
    
    console.log(`📋 Specific Export:`);
    console.log(`   Templates: ${specificData.templates.length}`);
    console.log(`   Template: ${specificData.templates[0].name}`);
    console.log('');
}

async function demonstrateVariables() {
    console.log('🔧 Variable System Demo');
    console.log('=======================\n');

    const promptManager = new PromptManager();

    console.log('1️⃣ Available Variables:\n');

    const variables = promptManager.getAvailableVariables();
    Object.entries(variables).forEach(([key, info]) => {
        console.log(`   ${info.variable}`);
        console.log(`      Description: ${info.description}`);
        console.log(`      Example: ${info.example}`);
        console.log('');
    });

    console.log('2️⃣ Variable Extraction:\n');

    const customPrompt = `Create a {language} summary for {meetingTitle}.
    
Participants: {participants}
Date: {date}
Duration: {duration}
Focus areas: {focusAreas}

Additional custom variable: {customVar}`;

    const extractedVars = promptManager.extractVariables(customPrompt);
    console.log('🔍 Extracted Variables:');
    extractedVars.forEach(variable => {
        console.log(`   - ${variable}`);
    });
    console.log('');

    console.log('3️⃣ Variable Processing with Missing Data:\n');

    const partialData = {
        language: 'Japanese',
        meetingTitle: 'Product Strategy Meeting',
        // Missing: participants, date, duration, focusAreas, customVar
    };

    const template = { prompt: customPrompt };
    const processed = promptManager.processTemplate(template, partialData);
    
    console.log('📄 Processed with partial data:');
    console.log('─'.repeat(50));
    console.log(processed.substring(0, 400) + '...\n');
}

async function demonstrateTemplateCategories() {
    console.log('📂 Template Categories Demo');
    console.log('===========================\n');

    const promptManager = new PromptManager();

    console.log('1️⃣ Templates by Category:\n');

    Object.values(PROMPT_CATEGORIES).forEach(category => {
        const categoryTemplates = promptManager.getTemplatesByCategory(category);
        console.log(`📁 ${category.toUpperCase()} (${categoryTemplates.length} templates):`);
        
        categoryTemplates.forEach(template => {
            console.log(`   - ${template.name}`);
            console.log(`     Variables: ${template.variables.length}`);
        });
        console.log('');
    });

    console.log('2️⃣ Template Switching:\n');

    console.log(`Current template: ${promptManager.getCurrentTemplate().name}`);

    await promptManager.setCurrentTemplate(PROMPT_CATEGORIES.TECHNICAL);
    console.log(`Switched to: ${promptManager.getCurrentTemplate().name}`);

    await promptManager.setCurrentTemplate(PROMPT_CATEGORIES.ACTION_ITEMS);
    console.log(`Switched to: ${promptManager.getCurrentTemplate().name}`);

    // Switch back to default
    await promptManager.setCurrentTemplate(PROMPT_CATEGORIES.GENERAL);
    console.log(`Back to: ${promptManager.getCurrentTemplate().name}\n`);
}

async function demonstrateErrorHandling() {
    console.log('🚨 Error Handling Demo');
    console.log('======================\n');

    const promptManager = new PromptManager();

    console.log('1️⃣ Testing Invalid Operations:\n');

    // Test invalid template ID
    try {
        await promptManager.setCurrentTemplate('non-existent');
    } catch (error) {
        console.log(`✅ Caught expected error: ${error.message}`);
    }

    // Test invalid template creation
    try {
        await promptManager.createTemplate({
            name: 'ab', // Too short
            prompt: 'short' // Too short
        });
    } catch (error) {
        console.log(`✅ Caught validation error: ${error.message}`);
    }

    // Test modifying built-in template
    try {
        await promptManager.updateTemplate(PROMPT_CATEGORIES.GENERAL, {
            name: 'Modified General'
        });
    } catch (error) {
        console.log(`✅ Caught protection error: ${error.message}`);
    }

    // Test deleting built-in template
    try {
        await promptManager.deleteTemplate(PROMPT_CATEGORIES.GENERAL);
    } catch (error) {
        console.log(`✅ Caught protection error: ${error.message}`);
    }

    console.log('\n2️⃣ Testing Edge Cases:\n');

    // Test unicode handling
    const unicodeId = await promptManager.createTemplate({
        name: '日本語テンプレート',
        prompt: 'This is a Japanese template with unicode characters'
    });
    console.log(`✅ Created template with unicode name: ${unicodeId}`);

    // Test very long name
    const longName = 'A'.repeat(100);
    const longId = await promptManager.createTemplate({
        name: longName,
        prompt: 'Template with very long name'
    });
    console.log(`✅ Created template with long name (ID length: ${longId.length})`);

    console.log('');
}

async function demonstrateIntegration() {
    console.log('🔗 Integration Scenarios Demo');
    console.log('=============================\n');

    console.log('📋 Prompt Manager Integration Points:');
    console.log('   - Works with AI clients (OpenAI, Anthropic) for summary generation');
    console.log('   - Integrates with Chrome storage for persistent template management');
    console.log('   - Supports popup UI for template selection and editing');
    console.log('   - Handles variable substitution for meeting metadata');
    console.log('   - Provides import/export for template sharing\n');

    console.log('🔄 Typical Prompt Template Workflow:');
    console.log('   1. User selects template category (General, Action Items, Technical)');
    console.log('   2. System loads template and extracts required variables');
    console.log('   3. Meeting metadata populates template variables');
    console.log('   4. Processed prompt sent to AI service');
    console.log('   5. Generated summary returned to user');
    console.log('   6. Template usage tracked for statistics\n');

    console.log('⚙️ Template Configuration Options:');
    console.log('   - Template Category: General, Action Items, Technical, Custom');
    console.log('   - Variable Support: Language, Participants, Duration, etc.');
    console.log('   - Custom Templates: User-created with full editing capabilities');
    console.log('   - Import/Export: JSON-based template sharing');
    console.log('   - Validation: Automatic template structure validation\n');

    console.log('📊 Template Selection Criteria:');
    console.log('   - Meeting Type: Technical meetings → Technical template');
    console.log('   - Output Focus: Action-oriented → Action Items template');
    console.log('   - General Purpose: Most meetings → General template');
    console.log('   - Specialized Needs: Custom templates for specific workflows\n');
}

// Main demo runner
async function runDemo() {
    console.clear();
    console.log('🚀 Teams Transcript Extension - Prompt Manager Demo\n');

    try {
        await demonstratePromptManager();
        await demonstrateTemplateProcessing();
        await demonstrateCustomTemplates();
        await demonstrateImportExport();
        await demonstrateVariables();
        await demonstrateTemplateCategories();
        await demonstrateErrorHandling();
        await demonstrateIntegration();

        console.log('📚 Next Steps:');
        console.log('   - Run unit tests: npm test -- promptManager.test.js');
        console.log('   - Integrate with popup UI for template selection');
        console.log('   - Connect with AI clients for summary generation');
        console.log('   - Add template editor interface in settings');
        console.log('   - See Task 12 for multi-language summary support\n');

        console.log('🎉 Demo completed successfully!');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error('Full error:', error);
    }
}

// Export for use in other demos
if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = {
    demonstratePromptManager,
    demonstrateTemplateProcessing,
    demonstrateCustomTemplates,
    sampleMeetingData,
    chineseMeetingData
};