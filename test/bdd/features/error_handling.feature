@chrome @error-handling
Feature: Error Handling and Edge Cases
  As a user of the extension
  I want comprehensive error handling
  So that I can understand and resolve issues quickly

  Background:
    Given I have the extension installed
    And I am on a SharePoint Stream page

  @authentication-errors
  Scenario: Handle various authentication scenarios
    Given my authentication status is "<auth_status>"
    When I try to extract a transcript
    Then I should see the appropriate error message:
      | Auth Status       | Error Message                      | Recovery Action      |
      | expired           | Session Expired                    | Refresh Page         |
      | invalid           | Authentication Failed              | Refresh Page         |
      | missing           | Please log into Teams              | Login Help           |
      | permission_denied | Access Denied                      | Contact Organizer    |

  @network-errors
  Scenario: Handle network connectivity issues
    Given I start extracting a transcript
    When I encounter a "<network_error>" error
    Then I should see appropriate error handling:
      | Network Error     | Error Message       | Recovery Options            |
      | connection_failed | Connection Error    | Try Again, Check Connection |
      | timeout           | Request Timed Out   | Try Again                   |
      | dns_failure       | Cannot Reach Server | Check Connection            |
      | offline           | You Are Offline     | Check Connection            |

  @api-errors
  Scenario: Handle AI provider API errors
    Given I have configured an AI provider
    When I encounter an "<api_error>" during summary generation
    Then I should see appropriate error handling:
      | API Error         | Error Message              | Recovery Actions        |
      | invalid_key       | Invalid API Key            | Check API Key           |
      | quota_exceeded    | Quota Exceeded             | Check Account           |
      | rate_limited      | Rate Limited               | Wait and Retry          |
      | service_down      | Service Unavailable        | Try Again Later         |
      | context_too_long  | Transcript Too Large       | Process in Sections     |

  @data-corruption
  Scenario: Handle corrupted or malformed data
    Given I encounter corrupted data during processing
    When the transcript data is "<corruption_type>"
    Then the system should handle it gracefully:
      | Corruption Type   | System Behavior                        | User Message                |
      | invalid_json      | Parse error recovery                   | Data format error           |
      | missing_speakers  | Use placeholder names                  | Speaker names unavailable   |
      | malformed_times   | Skip invalid timestamps                | Some timestamps missing     |
      | empty_transcript  | Show empty state                       | No transcript content       |

  @retry-mechanisms
  Scenario: Test automatic retry logic
    Given I have a transient failure during "<operation>"
    When the operation fails initially
    Then the system should automatically retry:
      | Operation            | Max Retries | Retry Delay | Success Criteria        |
      | transcript_fetch     | 3           | 1s, 2s, 4s  | Valid transcript data   |
      | ai_summary           | 3           | 5s, 10s, 20s| Generated summary       |
      | authentication      | 1           | 2s          | Valid auth token        |
    And I should see retry progress indicators
    And retries should use exponential backoff

  @edge-cases
  Scenario: Handle unusual meeting scenarios
    Given I have a meeting with "<unusual_scenario>"
    When I process the transcript
    Then the system should handle it appropriately:
      | Unusual Scenario        | Expected Behavior                    |
      | no_speakers            | Use generic speaker labels           |
      | single_speaker         | Process as monologue                 |
      | overlapping_speech     | Preserve all speech segments         |
      | very_short_meeting     | Generate brief summary               |
      | meeting_with_gaps      | Handle discontinuous timestamps      |
      | multiple_languages     | Detect and preserve language info    |

  @resource-limits
  Scenario: Handle browser resource constraints
    Given the browser is under resource pressure
    When I process a large transcript
    Then the system should:
      | Resource Constraint | System Response                      |
      | low_memory         | Process in smaller chunks            |
      | slow_cpu           | Show extended progress indicators    |
      | storage_full       | Clear temporary data automatically   |
      | tab_backgrounded   | Continue processing with lower priority |

  @concurrent-operations
  Scenario: Handle multiple simultaneous operations
    Given I start multiple operations simultaneously
    When I try to:
      | Operation 1         | Operation 2         | Expected Behavior           |
      | Extract transcript  | Open settings       | Queue second operation      |
      | Generate summary    | Extract new transcript | Show conflict warning    |
      | Export summary      | Change AI provider  | Complete export first       |
    Then operations should be properly queued or managed
    And I should receive appropriate user feedback

  @data-validation
  Scenario: Validate all user inputs
    Given I am entering data in the extension
    When I provide "<input_type>" input
    Then the system should validate appropriately:
      | Input Type        | Invalid Examples              | Validation Message        |
      | api_key          | empty, too_short, invalid_format | Please enter valid API key |
      | custom_prompt    | empty, too_long               | Prompt length invalid      |
      | meeting_url      | malformed, unsupported_domain | Invalid meeting URL        |
      | export_filename  | illegal_chars, too_long       | Invalid filename           |

  @browser-compatibility
  Scenario: Handle different browser states
    Given I am using Chrome with "<browser_state>"
    When I use the extension
    Then it should work correctly:
      | Browser State          | Expected Behavior                    |
      | incognito_mode        | Function with privacy limitations    |
      | multiple_profiles     | Isolate settings per profile        |
      | extensions_disabled   | Show appropriate error message       |
      | popup_blocked         | Handle popup blocking gracefully    |

  @recovery-procedures
  Scenario: Test error recovery workflows
    Given I encounter an error during "<failed_operation>"
    When I follow the recovery procedure
    Then I should be able to:
      | Failed Operation     | Recovery Steps                        | Expected Outcome       |
      | transcript_extraction| Refresh → Retry                      | Successful extraction  |
      | summary_generation   | Check API key → Retry                | Generated summary      |
      | export_failure       | Clear cache → Retry export           | Successful export      |
      | settings_corruption  | Reset to defaults → Reconfigure      | Working configuration  |

  @error-reporting
  Scenario: Generate useful error reports
    Given an error occurs during operation
    When the error is logged
    Then the error report should include:
      | Information Type    | Details                              |
      | error_id           | Unique identifier for tracking       |
      | timestamp          | When the error occurred              |
      | operation_context  | What the user was trying to do       |
      | browser_info       | Chrome version and extension version |
      | sanitized_stack    | Technical details without sensitive data |
    And sensitive information should be redacted
    And the report should be useful for troubleshooting