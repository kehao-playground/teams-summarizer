@chrome @export
Feature: Export Meeting Summary
  As a user with a generated summary
  I want to export it in various formats
  So that I can share it with my team

  Background:
    Given I have generated a meeting summary
    And the summary contains all required sections

  @smoke @markdown
  Scenario: Export summary as Markdown
    Given I have a summary for "產品開發週會"
    When I click "Download .md"
    Then a file should download with name format "Meeting_Title_YYYY-MM-DD.md"
    And the file should contain properly formatted Markdown
    And Chinese characters should be preserved with UTF-8 encoding
    And the file should include:
      | Section          | Content                             |
      | Meeting Title    | # 產品開發週會                      |
      | Metadata         | Date, Duration, Participants       |
      | Key Decisions    | ## 主要決策                         |
      | Action Items     | ## 行動項目                         |

  @html-export
  Scenario: Copy HTML for email
    Given I have generated a meeting summary
    When I click "Copy HTML"
    Then the HTML should be copied to clipboard
    And I should see a success message "Copied to clipboard!"
    And the HTML should include inline styles for email compatibility
    And the HTML should be properly formatted for email clients
    And Chinese characters should render correctly

  @metadata-preservation
  Scenario: Export with complete meeting metadata
    Given I have a summary for "產品開發週會"
    And the meeting was on "2025-01-15" with duration "01:30:00"
    And participants were "王小明, 李小華, 張經理"
    When I export the summary in any format
    Then the export should include:
      | Metadata      | Example                    |
      | Meeting Title | 產品開發週會               |
      | Date          | 2025-01-15                |
      | Duration      | 01:30:00                  |
      | Participants  | 王小明, 李小華, 張經理      |
    And metadata should be consistently formatted across all export types

  @plain-text
  Scenario: Export as plain text
    Given I have generated a meeting summary
    When I select "Plain Text" export format
    And I click "Download .txt"
    Then a text file should download
    And the file should be readable without formatting
    And sections should be clearly separated
    And Chinese characters should be preserved

  @filename-generation
  Scenario: Generate proper filenames for different meeting types
    Given I have summaries for different meetings:
      | Meeting Title          | Expected Filename Pattern               |
      | 產品開發週會           | 產品開發週會_2025-01-15.md             |
      | Technical Review       | Technical_Review_2025-01-15.md         |
      | Q1 Planning Session    | Q1_Planning_Session_2025-01-15.md      |
    When I export each summary
    Then the filenames should follow the expected patterns
    And special characters should be properly escaped
    And timestamps should be included in the filename

  @batch-export
  Scenario: Export multiple formats at once
    Given I have generated a meeting summary
    When I click "Export All Formats"
    Then I should receive three files:
      | Format      | Extension | Content Type                    |
      | Markdown    | .md       | text/markdown; charset=utf-8    |
      | HTML        | .html     | text/html; charset=utf-8        |
      | Plain Text  | .txt      | text/plain; charset=utf-8       |
    And all files should contain the same content in different formats

@chrome @settings
Feature: Configure Extension Settings
  As a user
  I want to manage my API keys and preferences
  So that I can customize the extension behavior

  @smoke @first-setup
  Scenario: First-time setup wizard
    Given I have just installed the extension
    When I click the extension icon for the first time
    Then I should see a setup wizard
    And the wizard should guide me through:
      | Step | Action                           |
      | 1    | Choose AI provider (OpenAI/Claude) |
      | 2    | Enter API key                     |
      | 3    | Select default language           |
      | 4    | Test connection                   |
    And I should be able to complete setup within 2 minutes

  @api-key-management
  Scenario: Manage multiple API keys
    Given I am in the settings view
    When I add both OpenAI and Anthropic API keys
    Then both providers should be available in the dropdown
    And I should be able to set a default provider
    And API keys should be masked in the UI
    And keys should be stored securely in Chrome storage

  @prompt-templates
  Scenario: Import/Export prompt templates
    Given I have created custom prompt templates:
      | Template Name     | Focus Area                           |
      | Technical Meeting | Architecture and technical decisions |
      | Action Items      | Tasks and assignees                  |
      | Executive Summary | High-level outcomes                  |
    When I click "Export Templates"
    Then a JSON file should download with all my templates
    When I click "Import Templates" on another device
    And I select the exported JSON file
    Then all templates should be restored
    And I should be able to use them immediately

  @language-preferences
  Scenario: Configure language preferences
    Given I am in the settings view
    When I set my preferred output language to "繁體中文"
    And I set my fallback language to "English"
    Then these preferences should be saved
    And future summaries should default to Traditional Chinese
    And if translation fails, English should be used as fallback

  @validation-and-testing
  Scenario: Test API key validation
    Given I am in the settings view
    When I enter an invalid OpenAI API key
    And I click "Test Connection"
    Then I should see "Invalid API key" error
    When I enter a valid API key
    And I click "Test Connection"
    Then I should see "Connection successful"
    And the key should be saved automatically

  @privacy-controls
  Scenario: Manage privacy and data settings
    Given I am in the settings view
    Then I should see privacy controls for:
      | Setting                    | Default | Description                        |
      | Store transcripts locally  | Yes     | Cache extracted transcripts        |
      | Log debugging information  | No      | Help troubleshoot issues           |
      | Share usage analytics      | No      | Anonymous usage statistics         |
    And I should be able to toggle each setting
    And changes should take effect immediately

  @backup-restore
  Scenario: Backup and restore all settings
    Given I have configured:
      | Setting Type      | Configuration                |
      | API Keys          | OpenAI and Claude keys       |
      | Prompt Templates  | 5 custom templates           |
      | Language Prefs    | Traditional Chinese default  |
      | Privacy Settings  | Custom privacy configuration |
    When I click "Export Settings"
    Then a backup file should be created
    When I restore settings on a new installation
    Then all configurations should be restored exactly
    And the extension should work identically to the original setup