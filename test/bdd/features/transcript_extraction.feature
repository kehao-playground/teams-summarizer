@chrome @transcript
Feature: Extract Teams Meeting Transcript
  As a meeting participant
  I want to extract transcripts from Teams recordings
  So that I can generate summaries without manual work

  Background:
    Given I am logged into SharePoint with an active session
    And I have the extension installed
    And the extension has necessary permissions

  @smoke
  Scenario: Successfully extract transcript from SharePoint Stream page
    Given I am on a SharePoint Stream page "https://cht365-my.sharepoint.com/personal/day_cht_com_tw/_layouts/15/stream.aspx?id=/personal/day_cht_com_tw/Documents/錄製/meeting.mp4"
    And the meeting has a transcript available
    When I click the extension icon
    And I click "Extract Transcript"
    Then I should see a progress indicator
    And the transcript should be extracted successfully
    And the transcript should show:
      | Field              | Example Value           |
      | Speaker Name       | 王小明                  |
      | Timestamp Format   | 00:00:08               |
      | Text Content       | 我們來討論下一季的計畫   |
      | Language Tag       | zh-tw                  |

  @error-handling
  Scenario: Handle authentication failure
    Given I am on a SharePoint Stream page
    But my session has expired
    When I click the extension icon
    And I click "Extract Transcript"
    Then I should see an error message "Session Expired"
    And I should see a "Refresh Page" button
    And the error should be categorized as "critical"

  @error-handling
  Scenario: Handle missing transcript
    Given I am on a SharePoint Stream page without transcript
    When I click the extension icon
    And I click "Extract Transcript"
    Then I should see an error message "Transcript Not Available"
    And I should see a suggestion "No transcript found for this meeting"

  @chinese-support
  Scenario: Extract transcript with Chinese file path
    Given I am on a SharePoint Stream page with Chinese characters in URL
    And the URL contains "/Documents/錄製/"
    When I extract the transcript
    Then the meeting path should be properly decoded
    And Chinese characters should display correctly

  @large-transcript
  Scenario: Handle large meeting transcript
    Given I am on a SharePoint Stream page with a large meeting
    When I click "Extract Transcript"
    Then I should see "Processing large transcript..."
    And the transcript should be extracted successfully
    And all content should be preserved

  @network-resilience
  Scenario: Handle network errors
    Given I am on a SharePoint Stream page
    When I encounter a network error during extraction
    Then I should see an appropriate error message
    And I should have the option to retry

  @permission-errors
  Scenario: Handle insufficient permissions
    Given I am on a SharePoint Stream page
    But I don't have access to the transcript
    When I click "Extract Transcript"
    Then I should see "Access Denied" error
    And I should see "You don't have permission to access this transcript"
    And I should see "Please check with the meeting organizer"

  @api-validation
  Scenario: Validate transcript data structure
    Given I have successfully extracted a transcript
    Then the transcript data should contain:
      | Field        | Type     | Required |
      | entries      | Array    | Yes      |
      | events       | Array    | Yes      |
      | version      | String   | Yes      |
      | type         | String   | Yes      |
    And each entry should have:
      | Field               | Type    | Required |
      | text                | String  | Yes      |
      | speakerDisplayName  | String  | Yes      |
      | startOffset         | String  | Yes      |
      | endOffset           | String  | Yes      |
      | confidence          | Number  | Yes      |
      | spokenLanguageTag   | String  | Yes      |