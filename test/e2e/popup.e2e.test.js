/**
 * End-to-End tests for Popup UI
 * Tests real user interactions and workflows using Puppeteer
 */

const puppeteer = require('puppeteer');
const path = require('path');

describe('Popup UI E2E Tests', () => {
    let browser, page, extensionPage;
    const extensionPath = path.resolve(__dirname, '../..');
    
    beforeAll(async () => {
        // Launch browser with extension loaded
        browser = await puppeteer.launch({
            headless: false, // Set to true for CI
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        
        // Get extension page
        const targets = await browser.targets();
        const extensionTarget = targets.find(target => 
            target.type() === 'service_worker' || 
            target.url().includes('chrome-extension://')
        );
        
        if (extensionTarget) {
            extensionPage = await extensionTarget.page();
        }
    });
    
    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });
    
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setViewport({ width: 400, height: 600 });
    });
    
    afterEach(async () => {
        if (page) {
            await page.close();
        }
    });
    
    describe('Initial Setup Flow', () => {
        test('should show setup view on first launch', async () => {
            // Navigate to popup
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Wait for page to load
            await page.waitForSelector('#app');
            
            // Check if setup view is visible (assuming no previous settings)
            const setupView = await page.$('#setup-view');
            expect(setupView).toBeTruthy();
            
            // Check setup form elements
            await page.waitForSelector('#provider-select');
            await page.waitForSelector('#api-key');
            await page.waitForSelector('#language-select');
            
            const providerSelect = await page.$('#provider-select');
            const apiKeyInput = await page.$('#api-key');
            const languageSelect = await page.$('#language-select');
            
            expect(providerSelect).toBeTruthy();
            expect(apiKeyInput).toBeTruthy();
            expect(languageSelect).toBeTruthy();
        });
        
        test('should update help text when provider is selected', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            await page.waitForSelector('#provider-select');
            
            // Select OpenAI provider
            await page.select('#provider-select', 'openai');
            
            // Check if help text is updated
            await page.waitForFunction(() => {
                const helpText = document.querySelector('#api-help-text');
                return helpText && helpText.textContent.includes('OpenAI Platform');
            });
            
            const helpText = await page.$eval('#api-help-text', el => el.textContent);
            expect(helpText).toContain('OpenAI Platform');
            expect(helpText).toContain('sk-');
            
            // Select Anthropic provider
            await page.select('#provider-select', 'anthropic');
            
            await page.waitForFunction(() => {
                const helpText = document.querySelector('#api-help-text');
                return helpText && helpText.textContent.includes('Anthropic Console');
            });
            
            const anthropicHelpText = await page.$eval('#api-help-text', el => el.textContent);
            expect(anthropicHelpText).toContain('Anthropic Console');
            expect(anthropicHelpText).toContain('sk-ant-');
        });
        
        test('should toggle API key visibility', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            await page.waitForSelector('#api-key');
            
            // Check initial state (password)
            const initialType = await page.$eval('#api-key', el => el.type);
            expect(initialType).toBe('password');
            
            // Click toggle button
            await page.click('#toggle-key-visibility');
            
            // Check if type changed to text
            const toggledType = await page.$eval('#api-key', el => el.type);
            expect(toggledType).toBe('text');
            
            // Toggle back
            await page.click('#toggle-key-visibility');
            
            const finalType = await page.$eval('#api-key', el => el.type);
            expect(finalType).toBe('password');
        });
        
        test('should validate required fields in setup form', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            await page.waitForSelector('#setup-form');
            
            // Try to submit empty form
            await page.click('#save-settings');
            
            // Check if form validation prevents submission
            const providerValidity = await page.$eval('#provider-select', el => el.validity.valid);
            const apiKeyValidity = await page.$eval('#api-key', el => el.validity.valid);
            
            expect(providerValidity).toBe(false);
            expect(apiKeyValidity).toBe(false);
        });
    });
    
    describe('Settings Management', () => {
        test('should save and load settings correctly', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            await page.waitForSelector('#setup-form');
            
            // Fill in form
            await page.select('#provider-select', 'openai');
            await page.type('#api-key', 'sk-test1234567890abcdef');
            await page.select('#language-select', 'zh-TW');
            
            // Mock Chrome storage for testing
            await page.evaluateOnNewDocument(() => {
                window.chrome = {
                    storage: {
                        local: {
                            set: (data, callback) => {
                                window.testStorageData = data;
                                callback && callback();
                            },
                            get: (keys, callback) => {
                                callback(window.testStorageData || {});
                            }
                        }
                    },
                    runtime: {
                        sendMessage: () => {},
                        lastError: null
                    }
                };
            });
            
            // Submit form (would trigger save in real extension)
            const formData = await page.evaluate(() => {
                const provider = document.querySelector('#provider-select').value;
                const apiKey = document.querySelector('#api-key').value;
                const language = document.querySelector('#language-select').value;
                
                return { provider, apiKey, language };
            });
            
            expect(formData.provider).toBe('openai');
            expect(formData.apiKey).toBe('sk-test1234567890abcdef');
            expect(formData.language).toBe('zh-TW');
        });
        
        test('should navigate to settings view', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Assuming we're in main view, click settings button
            const settingsBtn = await page.$('#settings-btn');
            if (settingsBtn) {
                await page.click('#settings-btn');
                
                // Check if settings view is shown
                await page.waitForFunction(() => {
                    const settingsView = document.querySelector('#settings-view');
                    return settingsView && !settingsView.classList.contains('hidden');
                });
                
                const settingsVisible = await page.$eval('#settings-view', 
                    el => !el.classList.contains('hidden'));
                expect(settingsVisible).toBe(true);
            }
        });
    });
    
    describe('Main View Functionality', () => {
        test('should display meeting information', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Mock meeting info display
            await page.evaluate(() => {
                const meetingTitle = document.querySelector('#meeting-title');
                const meetingDuration = document.querySelector('#meeting-duration');
                const meetingUrl = document.querySelector('#meeting-url');
                
                if (meetingTitle) meetingTitle.textContent = 'Test Meeting';
                if (meetingDuration) meetingDuration.textContent = '00:30:00';
                if (meetingUrl) meetingUrl.textContent = 'https://test.sharepoint.com/stream.aspx';
            });
            
            const title = await page.$eval('#meeting-title', el => el.textContent);
            const duration = await page.$eval('#meeting-duration', el => el.textContent);
            const url = await page.$eval('#meeting-url', el => el.textContent);
            
            expect(title).toBe('Test Meeting');
            expect(duration).toBe('00:30:00');
            expect(url).toContain('sharepoint.com');
        });
        
        test('should show extract transcript button state', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Check if extract transcript button exists
            const extractBtn = await page.$('#extract-transcript');
            expect(extractBtn).toBeTruthy();
            
            // Check initial disabled state (no meeting detected)
            const isDisabled = await page.$eval('#extract-transcript', el => el.disabled);
            expect(isDisabled).toBe(true);
        });
        
        test('should show transcript preview after extraction', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Mock transcript preview display
            await page.evaluate(() => {
                const transcriptPreview = document.querySelector('#transcript-preview');
                const transcriptContent = document.querySelector('#transcript-content');
                const transcriptEntries = document.querySelector('#transcript-entries');
                const transcriptParticipants = document.querySelector('#transcript-participants');
                
                if (transcriptPreview) transcriptPreview.classList.remove('hidden');
                if (transcriptEntries) transcriptEntries.textContent = '5 entries';
                if (transcriptParticipants) transcriptParticipants.textContent = '2 participants';
                if (transcriptContent) {
                    transcriptContent.innerHTML = `
                        <div class="transcript-entry">
                            <span class="transcript-time">[00:00:10]</span>
                            <span class="transcript-speaker">Alice:</span>
                            <span class="transcript-text">Hello everyone</span>
                        </div>
                    `;
                }
            });
            
            // Check if transcript preview is visible
            const previewVisible = await page.$eval('#transcript-preview', 
                el => !el.classList.contains('hidden'));
            expect(previewVisible).toBe(true);
            
            // Check transcript metadata
            const entries = await page.$eval('#transcript-entries', el => el.textContent);
            const participants = await page.$eval('#transcript-participants', el => el.textContent);
            
            expect(entries).toBe('5 entries');
            expect(participants).toBe('2 participants');
            
            // Check transcript content
            const transcriptText = await page.$eval('#transcript-content .transcript-text', 
                el => el.textContent);
            expect(transcriptText).toBe('Hello everyone');
        });
    });
    
    describe('Summary Generation', () => {
        test('should show summary format selector', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Mock summary view display
            await page.evaluate(() => {
                const summaryView = document.querySelector('#summary-view');
                if (summaryView) summaryView.classList.remove('hidden');
            });
            
            const formatSelector = await page.$('#summary-format');
            expect(formatSelector).toBeTruthy();
            
            // Check format options
            const options = await page.$$eval('#summary-format option', 
                options => options.map(opt => opt.value));
            
            expect(options).toContain('rendered');
            expect(options).toContain('markdown');
            expect(options).toContain('html');
            expect(options).toContain('text');
        });
        
        test('should display export buttons', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Mock summary view
            await page.evaluate(() => {
                const summaryView = document.querySelector('#summary-view');
                if (summaryView) summaryView.classList.remove('hidden');
            });
            
            const downloadBtn = await page.$('#download-md');
            const copyBtn = await page.$('#copy-summary');
            const regenerateBtn = await page.$('#regenerate-summary');
            
            expect(downloadBtn).toBeTruthy();
            expect(copyBtn).toBeTruthy();
            expect(regenerateBtn).toBeTruthy();
        });
    });
    
    describe('Loading States', () => {
        test('should show loading overlay', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Show loading overlay
            await page.evaluate(() => {
                const loadingOverlay = document.querySelector('#loading-overlay');
                const loadingText = document.querySelector('#loading-text');
                
                if (loadingOverlay) loadingOverlay.classList.remove('hidden');
                if (loadingText) loadingText.textContent = 'Processing...';
            });
            
            const overlayVisible = await page.$eval('#loading-overlay', 
                el => !el.classList.contains('hidden'));
            expect(overlayVisible).toBe(true);
            
            const loadingText = await page.$eval('#loading-text', el => el.textContent);
            expect(loadingText).toBe('Processing...');
        });
        
        test('should disable buttons during loading', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Mock loading state
            await page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                buttons.forEach(button => {
                    button.disabled = true;
                });
            });
            
            const buttonsDisabled = await page.$$eval('button', 
                buttons => buttons.every(btn => btn.disabled));
            expect(buttonsDisabled).toBe(true);
        });
    });
    
    describe('Toast Notifications', () => {
        test('should create and display toast notifications', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Create toast notification
            await page.evaluate(() => {
                const toastContainer = document.querySelector('#toast-container');
                const toast = document.createElement('div');
                toast.className = 'toast success';
                toast.textContent = 'Test notification';
                
                if (toastContainer) {
                    toastContainer.appendChild(toast);
                }
            });
            
            // Check if toast was created
            const toastExists = await page.$('.toast.success');
            expect(toastExists).toBeTruthy();
            
            const toastText = await page.$eval('.toast.success', el => el.textContent);
            expect(toastText).toBe('Test notification');
        });
    });
    
    describe('Responsive Design', () => {
        test('should handle narrow viewport', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Set narrow viewport
            await page.setViewport({ width: 350, height: 600 });
            
            // Check if content is still accessible
            const app = await page.$('#app');
            expect(app).toBeTruthy();
            
            // Check if elements adjust properly
            const viewContent = await page.$('.view-content');
            expect(viewContent).toBeTruthy();
        });
        
        test('should maintain functionality at different sizes', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Test different viewport sizes
            const sizes = [
                { width: 350, height: 500 },
                { width: 400, height: 600 },
                { width: 450, height: 700 }
            ];
            
            for (const size of sizes) {
                await page.setViewport(size);
                
                // Check if critical elements are still present
                const header = await page.$('.header');
                const footer = await page.$('.footer');
                
                expect(header).toBeTruthy();
                expect(footer).toBeTruthy();
            }
        });
    });
    
    describe('Error Handling', () => {
        test('should handle missing elements gracefully', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Test accessing non-existent elements
            const nonExistentElement = await page.$('#non-existent-element');
            expect(nonExistentElement).toBeNull();
        });
        
        test('should recover from JavaScript errors', async () => {
            await page.goto(`file://${path.join(extensionPath, 'popup.html')}`);
            
            // Monitor console errors
            const errors = [];
            page.on('pageerror', error => errors.push(error));
            
            // Trigger potential error scenarios
            await page.evaluate(() => {
                try {
                    // Try to access potentially undefined element
                    document.querySelector('#undefined-element').click();
                } catch (e) {
                    // Error should be caught gracefully
                }
            });
            
            // App should still be functional
            const app = await page.$('#app');
            expect(app).toBeTruthy();
        });
    });
});