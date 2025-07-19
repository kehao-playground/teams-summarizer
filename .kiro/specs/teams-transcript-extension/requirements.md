# Requirements - Teams Transcript Chrome Extension (MVP)

## Overview
A Chrome Extension that extracts Microsoft Teams meeting transcripts from SharePoint Stream pages (e.g., `/_layouts/15/stream.aspx`) using the user's authenticated session via Microsoft Stream API, then generates AI-powered summaries with customizable prompts and multi-language support. The extension operates entirely client-side without backend dependencies, using user-provided AI API keys (default: OpenAI GPT 4.1, alternative: Claude Sonnet 4).

## User Stories

### 1. Post-Meeting Transcript Extraction
**As a** user viewing a Teams meeting recording
**I want** to extract the complete transcript with one click
**So that** I can generate summaries without manual copy-paste

#### Acceptance Criteria (EARS format)
- When viewing a SharePoint Stream page (URL pattern: `/_layouts/15/stream.aspx?id=`), the system shall detect the meeting and transcript availability
- When the extract button is clicked, the system shall use the user's current session (Bearer token + cookies) to call Microsoft Stream API endpoint: `/_api/v2.1/drives/{driveId}/items/{itemId}/media/transcripts/{transcriptId}/streamContent?format=json`
- If the transcript contains multiple entries, then the system shall preserve all speaker information, timestamps, and confidence scores
- Where API access fails, the system shall provide clear error messages about permissions or availability

### 2. AI-Powered Summary Generation
**As a** user with extracted transcript data
**I want** to generate structured meeting summaries using AI
**So that** I can quickly understand key points and action items

#### Acceptance Criteria (EARS format)
- When a transcript is extracted, the system shall offer summary generation options
- When generating a summary, the system shall use customizable prompts for different summary styles
- If the transcript exceeds token limits, then the system shall intelligently chunk and summarize sections
- Where API errors occur, the system shall provide fallback options and preserve transcript data

### 3. Multi-Language Summary Support
**As a** user working in multiple languages
**I want** to generate summaries in different languages
**So that** I can share meeting notes with diverse teams

#### Acceptance Criteria (EARS format)
- When generating a summary, the system shall offer language selection for output
- When a non-English language is selected, the system shall translate the summary accordingly
- If translation fails, then the system shall fallback to English summary
- Where specialized terminology is used, the system shall maintain accuracy in translation

### 4. Flexible Export Options
**As a** user with generated summaries
**I want** multiple export formats and destinations
**So that** I can integrate summaries into my workflow

#### Acceptance Criteria (EARS format)
- When a summary is generated, the system shall offer export in Markdown, HTML, and plain text formats
- When exporting, the system shall include meeting metadata (title, date, participants, duration)
- If the user has configured integrations, then the system shall offer direct export to those services
- Where export fails, the system shall maintain local copies and retry options

### 5. API Key and Provider Management
**As a** privacy-conscious user
**I want** secure local storage of my API credentials and provider selection
**So that** I maintain control over my data and costs

#### Acceptance Criteria (EARS format)
- When first using AI features, the system shall prompt for API key configuration
- When storing API keys, the system shall use Chrome's secure storage mechanisms
- If multiple AI providers are configured, then the system shall allow easy switching between them
- Where API quota is exceeded, the system shall notify the user with usage statistics

### 6. Prompt Customization
**As a** user with specific summary needs
**I want** to customize AI prompts for different meeting types
**So that** I can get summaries tailored to my requirements

#### Acceptance Criteria (EARS format)
- When configuring the extension, the system shall allow custom prompt templates
- When generating summaries, the system shall offer selection from saved prompts
- If a prompt produces poor results, then the system shall allow immediate editing and retry
- Where prompts are shared, the system shall support import/export of prompt templates

### 7. Seamless User Experience
**As a** non-technical user
**I want** a simple, intuitive interface
**So that** I can use the tool without technical knowledge

#### Acceptance Criteria (EARS format)
- When the extension is active on Teams recording pages, the system shall show clear visual indicators
- When performing any operation, the system shall provide progress feedback
- If an operation takes more than 3 seconds, then the system shall show estimated completion time
- Where user action is required, the system shall provide clear instructions and examples

## Success Metrics
- **Extraction Success Rate**: 95%+ of transcripts extracted without data loss
- **Processing Time**: Summary generation completes within 15 seconds for typical meetings
- **User Satisfaction**: 90%+ rate the one-click workflow as "easy to use"
- **Data Accuracy**: 100% preservation of speaker attribution and timestamps
- **Setup Time**: New users operational within 2 minutes of installation

## Technical Approach
- **Target Pages**: SharePoint Stream pages hosting Teams recordings (e.g., `https://{tenant}.sharepoint.com/personal/{user}/_layouts/15/stream.aspx`)
- **Transcript Access**: Microsoft Stream API using user's existing Bearer token and session cookies
- **Data Format**: JSON response with entries containing text, speaker info, timestamps in "HH:MM:SS.fffffff" format
- **No DOM Scraping**: Direct API calls for cleaner, more reliable data extraction
- **Session Reuse**: Chrome Extension intercepts authentication headers from user's active session
- **AI Models**: Default GPT 4.1 (1,047,576 token context), Alternative Claude Sonnet 4 (200,000 token context)

## Constraints
- **Technical**: Chrome Manifest V3 limitations, Microsoft Stream API rate limits
- **API Limits**: Token limits vary by provider (e.g., 1M+ for GPT 4.1, 200k for Claude Sonnet 4)
- **Performance**: API calls must complete within reasonable timeframes
- **Storage**: Chrome extension storage limits (5MB local, 100MB if unlimitedStorage permission)
- **Transcript Source**: Only works with existing Teams transcripts via Stream API
- **Session Dependency**: Requires active Teams session in browser

## Out of Scope
- Real-time transcript capture during live meetings
- Real-time collaboration features
- Video/audio recording or transcription processing
- Custom OAuth implementation (uses existing user session instead)
- Automated meeting joining or scheduling
- Transcript generation (only uses existing Teams transcripts)
- Custom AI model training or fine-tuning
- Backend infrastructure or user accounts (MVP phase)
- Billing or subscription management (MVP phase)
- Mobile app versions
- DOM scraping (using API instead)