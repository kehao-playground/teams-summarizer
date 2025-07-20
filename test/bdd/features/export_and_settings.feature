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

  @settings-management
  Scenario: Configure basic settings
    Given I am in the settings view
    When I configure my API key and language preferences
    Then the settings should be saved
    And applied to future operations

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
  Scenario: Manage privacy settings
    Given I am in the settings view
    When I configure privacy preferences
    Then I should be able to control data storage
    And the settings should be respected