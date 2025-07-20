/**
 * Test Fixtures for BDD Testing
 * 
 * Provides realistic mock data for different meeting scenarios,
 * transcript types, and edge cases for comprehensive testing.
 */

const testFixtures = {
  // Standard meeting transcripts
  transcripts: {
    // Short product meeting in Chinese
    productMeeting: {
      $schema: 'https://schema.org/Transcript',
      version: '1.0',
      type: 'Transcript',
      entries: [
        {
          id: 'entry-1',
          speechServiceResultId: 'result-1',
          text: '大家好，我們來開始今天的產品開發週會。',
          speakerId: 'speaker-wang',
          speakerDisplayName: '王小明',
          confidence: 0.95,
          startOffset: '00:00:08.1234567',
          endOffset: '00:00:12.7654321',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-2',
          speechServiceResultId: 'result-2',
          text: '好的，首先我們來討論下一季的產品規劃。根據市場調研，用戶最關心的是性能和易用性。',
          speakerId: 'speaker-li',
          speakerDisplayName: '李小華',
          confidence: 0.92,
          startOffset: '00:00:15.2345678',
          endOffset: '00:00:25.8765432',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-3',
          speechServiceResultId: 'result-3',
          text: '我同意小華的觀點。我們需要重點關注用戶體驗的改善，特別是響應速度的優化。',
          speakerId: 'speaker-zhang',
          speakerDisplayName: '張經理',
          confidence: 0.89,
          startOffset: '00:00:28.3456789',
          endOffset: '00:00:36.9876543',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-4',
          speechServiceResultId: 'result-4',
          text: '關於技術架構，我建議我們採用微服務的方式來重構現有系統。這樣可以提高系統的可擴展性。',
          speakerId: 'speaker-wang',
          speakerDisplayName: '王小明',
          confidence: 0.94,
          startOffset: '00:00:40.1111111',
          endOffset: '00:00:50.2222222',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-5',
          speechServiceResultId: 'result-5',
          text: '那我們需要制定一個詳細的時間表。我建議張經理負責技術評估，預計月底前完成。',
          speakerId: 'speaker-li',
          speakerDisplayName: '李小華',
          confidence: 0.96,
          startOffset: '00:00:55.3333333',
          endOffset: '00:01:05.4444444',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        }
      ],
      events: [
        {
          id: 'event-1',
          eventType: 'CallStarted',
          userId: 'user-wang',
          userDisplayName: '王小明',
          startOffset: '00:00:00.0000000'
        },
        {
          id: 'event-2',
          eventType: 'TranscriptStarted',
          userId: 'user-system',
          userDisplayName: 'System',
          startOffset: '00:00:05.0000000'
        }
      ]
    },

    // Technical meeting in English
    technicalMeeting: {
      $schema: 'https://schema.org/Transcript',
      version: '1.0',
      type: 'Transcript',
      entries: [
        {
          id: 'entry-1',
          speechServiceResultId: 'result-1',
          text: 'Let\\'s start our technical architecture review. Today we\\'ll discuss the microservices migration plan.',
          speakerId: 'speaker-john',
          speakerDisplayName: 'John Smith',
          confidence: 0.98,
          startOffset: '00:00:05.0000000',
          endOffset: '00:00:10.5000000',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'en-us'
        },
        {
          id: 'entry-2',
          speechServiceResultId: 'result-2',
          text: 'I\\'ve prepared the analysis for breaking down the monolith. We should start with the user authentication service.',
          speakerId: 'speaker-sarah',
          speakerDisplayName: 'Sarah Johnson',
          confidence: 0.94,
          startOffset: '00:00:12.0000000',
          endOffset: '00:00:18.5000000',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'en-us'
        },
        {
          id: 'entry-3',
          speechServiceResultId: 'result-3',
          text: 'Good point. We also need to consider the database sharding strategy. The current PostgreSQL setup won\\'t scale beyond 10K concurrent users.',
          speakerId: 'speaker-mike',
          speakerDisplayName: 'Mike Chen',
          confidence: 0.91,
          startOffset: '00:00:20.0000000',
          endOffset: '00:00:28.0000000',
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'en-us'
        }
      ],
      events: [
        {
          id: 'event-1',
          eventType: 'CallStarted',
          userId: 'user-john',
          userDisplayName: 'John Smith',
          startOffset: '00:00:00.0000000'
        }
      ]
    },

    // Large 3-hour meeting transcript
    largeMeeting: (() => {
      const baseTranscript = {
        $schema: 'https://schema.org/Transcript',
        version: '1.0',
        type: 'Transcript',
        entries: [],
        events: [
          {
            id: 'event-1',
            eventType: 'CallStarted',
            userId: 'user-host',
            userDisplayName: '會議主持人',
            startOffset: '00:00:00.0000000'
          },
          {
            id: 'event-2',
            eventType: 'TranscriptStarted',
            userId: 'user-system',
            userDisplayName: 'System',
            startOffset: '00:00:05.0000000'
          }
        ]
      };

      // Generate 800 entries for a 3-hour meeting
      const speakers = ['王經理', '李總監', '張工程師', '陳設計師', '劉產品經理', '黃測試工程師'];
      const topics = [
        '產品規劃討論', '技術架構設計', '用戶體驗優化', '性能測試結果',
        '市場競爭分析', '預算分配計劃', '時程安排討論', '風險評估報告'
      ];

      for (let i = 0; i < 800; i++) {
        const speaker = speakers[i % speakers.length];
        const topic = topics[Math.floor(i / 100)];
        const minutes = Math.floor(i / 10);
        const seconds = (i % 10) * 6;
        
        baseTranscript.entries.push({
          id: `entry-${i + 1}`,
          speechServiceResultId: `result-${i + 1}`,
          text: `關於${topic}，我們需要考慮第${i + 1}個要點，這對整體項目的成功非常重要。`,
          speakerId: `speaker-${i % speakers.length}`,
          speakerDisplayName: speaker,
          confidence: 0.80 + Math.random() * 0.19, // Random confidence 0.8-0.99
          startOffset: `00:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${(i % 10).toString().padStart(7, '0')}`,
          endOffset: `00:${minutes.toString().padStart(2, '0')}:${(seconds + 5).toString().padStart(2, '0')}.${((i % 10) + 5).toString().padStart(7, '0')}`,
          hasBeenEdited: false,
          roomId: null,
          spokenLanguageTag: 'zh-tw'
        });
      }

      return baseTranscript;
    })(),

    // Mixed language meeting
    mixedLanguageMeeting: {
      $schema: 'https://schema.org/Transcript',
      version: '1.0',
      type: 'Transcript',
      entries: [
        {
          id: 'entry-1',
          text: '歡迎大家參加今天的國際合作會議。',
          speakerDisplayName: '王經理',
          confidence: 0.95,
          startOffset: '00:00:05.0000000',
          endOffset: '00:00:09.0000000',
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-2',
          text: 'Thank you for having us. We\\'re excited about this partnership opportunity.',
          speakerDisplayName: 'John Miller',
          confidence: 0.97,
          startOffset: '00:00:12.0000000',
          endOffset: '00:00:16.0000000',
          spokenLanguageTag: 'en-us'
        },
        {
          id: 'entry-3',
          text: 'ありがとうございます。この協力関係を楽しみにしています。',
          speakerDisplayName: '田中さん',
          confidence: 0.93,
          startOffset: '00:00:18.0000000',
          endOffset: '00:00:22.0000000',
          spokenLanguageTag: 'ja-jp'
        }
      ],
      events: []
    },

    // Corrupted transcript data
    corruptedTranscript: {
      $schema: 'https://schema.org/Transcript',
      version: '1.0',
      type: 'Transcript',
      entries: [
        {
          id: 'entry-1',
          text: '', // Empty text
          speakerDisplayName: null, // Missing speaker
          confidence: 'invalid', // Invalid confidence type
          startOffset: 'malformed-timestamp',
          endOffset: '00:00:10.0000000',
          spokenLanguageTag: 'zh-tw'
        },
        {
          id: 'entry-2',
          text: '正常的發言內容',
          speakerDisplayName: '正常發言者',
          confidence: 0.95,
          startOffset: '00:00:15.0000000',
          endOffset: '00:00:20.0000000',
          spokenLanguageTag: 'zh-tw'
        }
      ],
      events: []
    },

    // Empty transcript
    emptyTranscript: {
      $schema: 'https://schema.org/Transcript',
      version: '1.0',
      type: 'Transcript',
      entries: [],
      events: [
        {
          id: 'event-1',
          eventType: 'CallStarted',
          userId: 'user-host',
          userDisplayName: '主持人',
          startOffset: '00:00:00.0000000'
        }
      ]
    }
  },

  // Meeting information fixtures
  meetingInfo: {
    standard: {
      url: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw/_layouts/15/stream.aspx?id=/personal/day_cht_com_tw/Documents/錄製/product_meeting.mp4',
      title: '產品開發週會',
      duration: '01:30:00',
      siteUrl: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw',
      driveId: 'mock-drive-id-12345',
      itemId: 'mock-item-id-67890',
      transcriptId: 'mock-transcript-id-abcdef',
      participants: ['王小明', '李小華', '張經理']
    },

    technical: {
      url: 'https://contoso.sharepoint.com/sites/engineering/_layouts/15/stream.aspx?id=/sites/engineering/Documents/Recordings/tech_review.mp4',
      title: 'Technical Architecture Review',
      duration: '02:00:00',
      siteUrl: 'https://contoso.sharepoint.com/sites/engineering',
      driveId: 'tech-drive-id-67890',
      itemId: 'tech-item-id-12345',
      transcriptId: 'tech-transcript-id-fedcba',
      participants: ['John Smith', 'Sarah Johnson', 'Mike Chen']
    },

    longMeeting: {
      url: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw/_layouts/15/stream.aspx?id=/personal/day_cht_com_tw/Documents/錄製/quarterly_planning.mp4',
      title: '季度規劃會議',
      duration: '03:15:00',
      siteUrl: 'https://cht365-my.sharepoint.com/personal/day_cht_com_tw',
      driveId: 'long-drive-id-99999',
      itemId: 'long-item-id-88888',
      transcriptId: 'long-transcript-id-77777',
      participants: ['王經理', '李總監', '張工程師', '陳設計師', '劉產品經理', '黃測試工程師']
    }
  },

  // AI response fixtures
  aiResponses: {
    openaiSuccess: {
      id: 'chatcmpl-mock123',
      object: 'chat.completion',
      created: 1704067200,
      model: 'gpt-4.1',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `# 產品開發週會摘要

## 會議資訊
- **日期**: 2025年1月15日
- **時長**: 1小時30分鐘
- **參與者**: 王小明、李小華、張經理

## 主要決策
1. **確定Q2產品開發重點**: 專注於用戶體驗改善和性能優化
2. **技術架構決策**: 採用微服務架構重構現有系統
3. **團隊分工**: 張經理負責技術評估，李小華負責市場調研

## 行動項目
- **張經理**: 完成技術評估報告（截止日期：月底前）
- **李小華**: 完成市場調研分析（截止日期：下週五前）
- **王小明**: 制定詳細的系統重構計劃（截止日期：下月中旬）

## 討論重點
- 用戶體驗改善策略，特別是響應速度優化
- 微服務架構的可行性和實施方案
- 市場競爭分析和產品定位策略

## 後續安排
下次會議將在兩週後舉行，主要討論技術評估結果和實施計劃的細節。`
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 2500,
        completion_tokens: 350,
        total_tokens: 2850
      }
    },

    claudeSuccess: {
      id: 'msg_mock456',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `# 產品開發週會摘要

## 會議概況
本次產品開發週會聚焦於Q2規劃，團隊就用戶體驗改善和技術架構升級達成重要共識。

## 關鍵決策
### 1. 產品發展方向
- 將用戶體驗改善列為Q2最高優先級
- 重點關注系統響應速度和易用性提升

### 2. 技術架構選擇
- 決定採用微服務架構重構現有系統
- 提高系統可擴展性和維護性

### 3. 資源配置
- 張經理主導技術評估工作
- 李小華負責深度市場調研
- 王小明統籌整體架構設計

## 執行計劃
| 任務 | 負責人 | 完成時間 | 備註 |
|------|--------|----------|------|
| 技術評估報告 | 張經理 | 月底前 | 包含風險分析 |
| 市場調研報告 | 李小華 | 下週五 | 重點分析競品 |
| 架構設計方案 | 王小明 | 下月中 | 分階段實施 |

## 風險提醒
- 微服務改造需要充分評估現有系統依賴關係
- 市場調研需要及時跟進競爭對手動態
- 團隊需要適當的技術培訓和知識轉移

## 下步行動
兩週後召開進度檢討會議，評估各項任務完成情況並調整後續計劃。`
        }
      ],
      model: 'claude-sonnet-4',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 2200,
        output_tokens: 420
      }
    },

    apiKeyError: {
      error: {
        message: 'Invalid API key provided',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key'
      }
    },

    rateLimitError: {
      error: {
        message: 'Rate limit reached for requests',
        type: 'rate_limit_error',
        param: null,
        code: 'rate_limit_exceeded'
      }
    },

    contextTooLongError: {
      error: {
        message: 'This model\\'s maximum context length is 200000 tokens. However, your messages resulted in 250000 tokens.',
        type: 'invalid_request_error',
        param: 'messages',
        code: 'context_length_exceeded'
      }
    }
  },

  // Error scenarios
  errorScenarios: {
    authenticationErrors: [
      {
        type: 'expired',
        status: 401,
        message: 'Unauthorized: Token has expired',
        expectedUserMessage: 'Session Expired',
        expectedAction: 'Refresh Page'
      },
      {
        type: 'invalid',
        status: 401,
        message: 'Unauthorized: Invalid credentials',
        expectedUserMessage: 'Authentication Failed',
        expectedAction: 'Refresh Page'
      },
      {
        type: 'permission_denied',
        status: 403,
        message: 'Forbidden: Access denied',
        expectedUserMessage: 'Access Denied',
        expectedAction: 'Contact Organizer'
      }
    ],

    networkErrors: [
      {
        type: 'connection_failed',
        message: 'NetworkError: Failed to fetch',
        expectedUserMessage: 'Connection Error',
        expectedActions: ['Try Again', 'Check Connection']
      },
      {
        type: 'timeout',
        message: 'Request timeout',
        expectedUserMessage: 'Request Timed Out',
        expectedActions: ['Try Again']
      },
      {
        type: 'offline',
        message: 'Network request failed',
        expectedUserMessage: 'You Are Offline',
        expectedActions: ['Check Connection']
      }
    ],

    transcriptErrors: [
      {
        type: 'not_found',
        status: 404,
        message: 'Transcript not found',
        expectedUserMessage: 'Transcript Not Available',
        expectedSuggestion: 'No transcript found for this meeting'
      },
      {
        type: 'processing',
        status: 202,
        message: 'Transcript is still being processed',
        expectedUserMessage: 'Transcript Processing',
        expectedSuggestion: 'Please wait a few minutes'
      },
      {
        type: 'corrupted',
        status: 200,
        data: 'invalid-json-response',
        expectedUserMessage: 'Data format error',
        expectedBehavior: 'Parse error recovery'
      }
    ]
  },

  // Test settings and configurations
  testSettings: {
    defaultAiSettings: {
      provider: 'openai',
      apiKey: 'sk-test-key-12345',
      model: 'gpt-4.1',
      language: 'zh-TW',
      prompts: {
        default: '請為這個會議生成結構化摘要，包含主要決策、行動項目和討論主題。',
        technical: '請專注於技術決策和架構討論，生成技術會議摘要。',
        actionItems: '請重點提取會議中的行動項目，包括負責人和截止日期。'
      }
    },

    multiProviderSettings: {
      openai: {
        apiKey: 'sk-openai-test-12345',
        model: 'gpt-4.1',
        contextLimit: 1047576,
        isValid: true
      },
      anthropic: {
        apiKey: 'sk-ant-test-67890',
        model: 'claude-sonnet-4',
        contextLimit: 200000,
        isValid: true
      }
    },

    privacySettings: {
      storeTranscripts: true,
      debugLogging: false,
      shareAnalytics: false,
      logSensitiveData: false
    },

    languageSettings: {
      outputLanguage: 'zh-TW',
      fallbackLanguage: 'en',
      supportedLanguages: ['zh-TW', 'zh-CN', 'en', 'ja']
    }
  }
};

module.exports = testFixtures;