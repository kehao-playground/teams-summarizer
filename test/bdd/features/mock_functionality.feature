@smoke @standalone
Feature: Basic Extension Functionality (Mock Tests)
  As a developer
  I want to verify the extension's core functionality
  So that I can ensure the BDD testing framework works

  Background:
    Given the extension is loaded in mock mode
    And all mock data is initialized

  @core-functionality
  Scenario: Mock transcript processing
    Given I have mock transcript data
    When I process the transcript
    Then the transcript should be formatted correctly
    And the processing should complete successfully

  @export-functionality  
  Scenario: Mock summary export
    Given I have a generated summary
    When I export it in markdown format
    Then a markdown file should be created
    And the content should be properly formatted

  @ai-integration
  Scenario: Mock AI summary generation
    Given I have transcript data
    When I generate a summary using mock AI
    Then the summary should contain key sections
    And the response should include metadata

  @error-handling
  Scenario: Mock error handling
    Given I have invalid input data
    When I try to process it
    Then an appropriate error should be shown
    And recovery options should be available