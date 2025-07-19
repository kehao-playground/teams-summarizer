// TypeScript type definitions for the Teams Transcript Extension

// Microsoft Stream API Response Types
export interface StreamTranscript {
  $schema: string;
  version: string;
  type: "Transcript";
  entries: TranscriptEntry[];
  events: TranscriptEvent[];
}

export interface TranscriptEntry {
  id: string;
  speechServiceResultId: string;
  text: string;
  speakerId: string;
  speakerDisplayName: string;
  confidence: number;
  startOffset: string;
  endOffset: string;
  hasBeenEdited: boolean;
  roomId: string | null;
  spokenLanguageTag: string;
}

export interface TranscriptEvent {
  id: string;
  eventType: "CallStarted" | "TranscriptStarted" | "TranscriptPublished" | "TranscriptStopped";
  userId: string;
  userDisplayName: string;
  startOffset: string;
}

// Extension Data Models
export interface MeetingInfo {
  url: string;
  title: string;
  duration: string;
  siteUrl: string;
  driveId: string;
  itemId: string;
  transcriptId: string;
  meetingPath: string;
}

export interface ExtensionSettings {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  language: string;
  promptTemplate: string;
  customPrompt?: string;
}

export interface AIProviderSettings {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SummaryRequest {
  transcript: StreamTranscript;
  settings: ExtensionSettings;
  language: string;
}

export interface GeneratedSummary {
  title: string;
  date: string;
  duration: string;
  participants: string[];
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  fullSummary: string;
  markdown: string;
  html: string;
}

export interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
}

// API Response Types
export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// Chrome Extension Message Types
export interface ExtensionMessage {
  action: 'getMeetingInfo' | 'extractTranscript' | 'generateSummary' | 'getSessionData';
  meetingInfo?: MeetingInfo;
  transcript?: StreamTranscript;
  settings?: ExtensionSettings;
}

export interface SessionData {
  authToken: string;
  cookies: string;
  timestamp: number;
}

// Error Types
export interface ExtensionError {
  code: string;
  message: string;
  details?: any;
}

export type TranscriptErrorCode = 
  | 'NO_TRANSCRIPT'
  | 'AUTH_FAILED'
  | 'API_ERROR'
  | 'INVALID_FORMAT'
  | 'NETWORK_ERROR';

export type SummaryErrorCode = 
  | 'API_KEY_MISSING'
  | 'API_ERROR'
  | 'TOKEN_LIMIT_EXCEEDED'
  | 'INVALID_RESPONSE';

// Utility Types
export type LanguageCode = 'en' | 'zh-TW' | 'zh-CN' | 'ja';

export type PromptTemplate = 'default' | 'action-items' | 'technical' | 'custom';

export interface ExportFormat {
  format: 'markdown' | 'html' | 'plain';
  content: string;
  filename: string;
}

// Page Context Types
export interface PageContext {
  url: string;
  title: string;
  meetingInfo?: MeetingInfo;
  pageContext: {
    siteUrl?: string;
    webUrl?: string;
    userLogin?: string;
  };
}

// Network Request Types
export interface APIRequestHeaders {
  'Authorization': string;
  'Cookie': string;
  'Accept': string;
  'X-MS-Client-Request-Id': string;
  'Application': string;
  'Scenario': string;
  'Type': string;
}

// Configuration Types
export interface ExtensionConfig {
  apiEndpoints: {
    openai: string;
    anthropic: string;
  };
  models: {
    openai: string;
    anthropic: string;
  };
  timeouts: {
    api: number;
    session: number;
  };
}

// Storage Types
export interface StorageKeys {
  provider: string;
  apiKey: string;
  language: string;
  promptTemplate: string;
  customPrompt: string;
  lastUsed: string;
  usageStats: string;
}