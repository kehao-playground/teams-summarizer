@chrome @ai-summary
Feature: Generate AI Meeting Summary
  As a user with extracted transcript
  I want to generate structured summaries
  So that I can quickly understand meeting outcomes

  Background:
    Given I have successfully extracted a transcript
    And I have configured my AI provider settings

  @smoke @openai
  Scenario: Generate summary with GPT 4.1 in Chinese
    Given I have selected "OpenAI" as my AI provider
    And I have entered a valid GPT 4.1 API key
    And I have selected "繁體中文" as output language
    And the transcript is in Chinese (zh-tw)
    When I click "Generate Summary"
    Then I should see a progress indicator "Generating summary with GPT 4.1..."
    And the summary should be generated successfully
    And the summary should contain sections:
      | Section       | Content Example                           |
      | 主要決策      | 確定Q2產品開發方向                        |
      | 行動項目      | - 張經理: 準備技術評估報告 (月底前)        |
      | 討論主題      | 新功能規劃、技術架構討論                   |
    And the summary should be in Traditional Chinese

  @provider-switching @anthropic
  Scenario: Switch between AI providers
    Given I have configured both OpenAI and Anthropic API keys
    And I have generated a summary with OpenAI
    When I switch to "Claude Sonnet 4" provider
    And I click "Regenerate Summary"
    Then I should see "Generating summary with Claude Sonnet 4..."
    And a new summary should be generated
    And I should be able to compare both summaries
    And both summaries should contain similar key information

  @error-handling @api-errors
  Scenario: Handle API key errors
    Given I have entered an invalid API key
    When I click "Generate Summary"
    Then I should see an error "Invalid API Key"
    And I should see "Your AI provider API key is invalid"
    And the transcript should remain available
    And I should see a "Check API Key" button

  @custom-prompts
  Scenario: Use custom prompt template
    Given I have created a custom prompt template for "Technical Meetings"
    And the prompt includes "Focus on technical decisions and architecture"
    When I select the custom template
    And I generate a summary
    Then the summary should emphasize technical aspects
    And architecture decisions should be highlighted
    And technical terminology should be preserved

  @large-context @openai
  Scenario: Handle large transcript with GPT 4.1
    Given I have a large meeting transcript
    When I click "Generate Summary"
    Then the system should process the entire transcript
    And I should see "Processing large transcript..."
    And the summary should maintain context across the entire meeting

  @chunking @claude
  Scenario: Handle transcript chunking with Claude
    Given I have a very large meeting transcript
    And I'm using Claude Sonnet 4
    When I click "Generate Summary"
    Then the system should handle the transcript appropriately
    And I should see "Processing transcript..."
    And the final summary should be complete and coherent

  @multilingual
  Scenario: Generate summary in multiple languages
    Given I have a transcript in Chinese
    When I select "English" as output language
    And I generate a summary
    Then the summary should be in English
    When I switch to "日本語" as output language
    And I regenerate the summary
    Then the summary should be in Japanese
    And technical terms should be appropriately translated

  @api-resilience
  Scenario: Handle API errors gracefully
    Given I have a valid API key
    But the API service encounters an error
    When I click "Generate Summary"
    Then I should see an appropriate error message
    And I should have the option to retry
    And the transcript data should be preserved

  @summary-quality
  Scenario: Validate summary content quality
    Given I have generated a summary from a product planning meeting
    Then the summary should contain:
      | Section           | Required Elements                    |
      | Meeting Overview  | Title, date, duration, participants |
      | Key Decisions     | At least 2 decision items           |
      | Action Items      | Assignee and deadline information   |
      | Discussion Topics | Main topics covered                 |
    And action items should be clearly structured
    And decisions should be distinguished from discussions
    And participant names should be preserved correctly

  @cost-awareness
  Scenario: Track API usage costs
    Given I have a transcript to summarize
    When I generate a summary
    Then the system should log token usage
    And provide cost estimates when available