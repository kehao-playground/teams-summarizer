@chrome @error-handling
Feature: Error Handling and Edge Cases
  As a user of the extension
  I want comprehensive error handling
  So that I can understand and resolve issues quickly

  Background:
    Given I have the extension installed
    And I am on a SharePoint Stream page

  @authentication-errors
  Scenario Outline: Handle various authentication scenarios
    Given my authentication status is "<auth_status>"
    When I try to extract a transcript
    Then I should see the error message "<error_message>"
    And I should see a "<recovery_action>" button
    
    Examples:
      | auth_status       | error_message         | recovery_action   |
      | expired           | Session Expired       | Refresh Page      |
      | invalid           | Authentication Failed | Refresh Page      |
      | missing           | Please log into Teams | Login Help        |
      | permission_denied | Access Denied         | Contact Organizer |

  @network-errors
  Scenario Outline: Handle network connectivity issues
    Given I start extracting a transcript
    When I encounter a "<network_error>" error
    Then I should see the error message "<error_message>"
    And I should see recovery options "<recovery_options>"
    
    Examples:
      | network_error     | error_message       | recovery_options            |
      | network_error     | Connection Error    | Try Again, Check Connection |
      | offline           | You Are Offline     | Check Connection            |

  @api-errors
  Scenario Outline: Handle AI provider API errors
    Given I have configured an AI provider
    When I encounter an "<api_error>" during summary generation
    Then I should see the error message "<error_message>"
    And I should see recovery actions "<recovery_actions>"
    
    Examples:
      | api_error         | error_message              | recovery_actions        |
      | invalid_key       | Invalid API Key            | Check API Key           |
      | quota_exceeded    | Quota Exceeded             | Check Account           |
      | rate_limited      | Rate Limited               | Wait and Retry          |
      | service_down      | Service Unavailable        | Try Again Later         |
      | context_too_long  | Transcript Too Large       | Process in Sections     |

  @data-corruption
  Scenario Outline: Handle corrupted or malformed data
    Given I encounter corrupted data during processing
    When the transcript data is "<corruption_type>"
    Then the system should show "<system_behavior>"
    And I should see the user message "<user_message>"
    
    Examples:
      | corruption_type   | system_behavior            | user_message              |
      | invalid_json      | Parse error recovery       | Data format error         |
      | missing_speakers  | Use placeholder names      | Speaker names unavailable |
      | malformed_times   | Skip invalid timestamps    | Some timestamps missing   |
      | empty_transcript  | Show empty state           | No transcript content     |

  @retry-mechanisms
  Scenario: Test automatic retry logic
    Given I have a transient failure during an operation
    When the operation fails initially
    Then the system should retry appropriately
    And I should see retry progress indicators
    And the operation should eventually succeed or fail gracefully

  @edge-cases
  Scenario Outline: Handle unusual meeting scenarios
    Given I have a meeting with "<unusual_scenario>"
    When I process the transcript
    Then the system should show "<expected_behavior>"
    
    Examples:
      | unusual_scenario    | expected_behavior                    |
      | no_speakers        | Use generic speaker labels           |
      | single_speaker     | Process as monologue                 |
      | overlapping_speech | Preserve all speech segments         |
      | very_short_meeting | Generate brief summary               |
      | meeting_with_gaps  | Handle discontinuous timestamps      |
      | multiple_languages | Detect and preserve language info    |

  @resource-limits
  Scenario Outline: Handle browser resource constraints
    Given the browser is under resource pressure
    When I process a large transcript with "<constraint>"
    Then the system should "<response>"
    
    Examples:
      | constraint       | response                                |
      | low_memory      | Process in smaller chunks               |
      | slow_cpu        | Show extended progress indicators       |
      | storage_full    | Clear temporary data automatically      |
      | tab_backgrounded| Continue processing with lower priority |

  @data-validation
  Scenario: Validate critical user inputs
    Given I am entering data in the extension
    When I provide invalid API key
    Then the system should show appropriate validation message
    And prevent submission until corrected

  @error-reporting
  Scenario: Generate useful error reports
    Given an error occurs during operation
    When the error is logged
    Then the error report should include helpful information
    And sensitive data should be protected