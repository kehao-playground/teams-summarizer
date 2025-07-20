/**
 * Cache Manager for Teams Transcript Extension
 * 
 * Provides intelligent caching of transcripts, summaries, and API responses
 * to improve performance and reduce unnecessary API calls.
 */

class CacheManager {
  constructor() {
    this.CACHE_VERSION = '1.0.0';
    this.CACHE_KEYS = {
      TRANSCRIPTS: 'cached_transcripts',
      SUMMARIES: 'cached_summaries',
      METADATA: 'cache_metadata',
      PERFORMANCE: 'performance_metrics'
    };
    
    // Cache configuration
    this.config = {
      transcriptTTL: 60 * 60 * 1000, // 1 hour
      summaryTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 100,
      cleanupInterval: 60 * 60 * 1000 // 1 hour
    };
    
    this.initializeCache();
  }

  async initializeCache() {
    try {
      // Check cache version and migrate if needed
      const metadata = await this.getCacheMetadata();
      if (metadata.version !== this.CACHE_VERSION) {
        await this.migrateCache(metadata.version);
      }
      
      // Schedule periodic cleanup
      this.scheduleCleanup();
      
      console.log('CacheManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    }
  }

  /**
   * Get transcript from cache or return null if not found/expired
   */
  async getCachedTranscript(meetingId) {
    try {
      const transcriptCache = await this.getStorageItem(this.CACHE_KEYS.TRANSCRIPTS) || {};
      const cached = transcriptCache[meetingId];
      
      if (!cached) {
        return null;
      }
      
      // Check if expired
      if (Date.now() - cached.timestamp > this.config.transcriptTTL) {
        await this.removeCachedTranscript(meetingId);
        return null;
      }
      
      // Update access time for LRU
      cached.lastAccessed = Date.now();
      transcriptCache[meetingId] = cached;
      await this.setStorageItem(this.CACHE_KEYS.TRANSCRIPTS, transcriptCache);
      
      console.log(`Cache hit for transcript: ${meetingId}`);
      return cached.data;
    } catch (error) {
      console.error('Failed to get cached transcript:', error);
      return null;
    }
  }

  /**
   * Cache transcript with metadata
   */
  async cacheTranscript(meetingId, transcript, meetingInfo = {}) {
    try {
      const transcriptCache = await this.getStorageItem(this.CACHE_KEYS.TRANSCRIPTS) || {};
      
      // Check cache size limits
      await this.enforceStorageLimits(this.CACHE_KEYS.TRANSCRIPTS);
      
      const cacheEntry = {
        data: transcript,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        meetingInfo: {
          title: meetingInfo.title || 'Unknown Meeting',
          duration: meetingInfo.duration || '00:00:00',
          participants: meetingInfo.participants || [],
          siteUrl: meetingInfo.siteUrl || ''
        },
        size: this.calculateDataSize(transcript),
        version: this.CACHE_VERSION
      };
      
      transcriptCache[meetingId] = cacheEntry;
      await this.setStorageItem(this.CACHE_KEYS.TRANSCRIPTS, transcriptCache);
      
      // Update cache statistics
      await this.updateCacheStats('transcript_cached');
      
      console.log(`Cached transcript for meeting: ${meetingId}`);
    } catch (error) {
      console.error('Failed to cache transcript:', error);
    }
  }

  /**
   * Get cached summary
   */
  async getCachedSummary(transcriptHash, provider, promptHash) {
    try {
      const summaryCache = await this.getStorageItem(this.CACHE_KEYS.SUMMARIES) || {};
      const cacheKey = `${transcriptHash}_${provider}_${promptHash}`;
      const cached = summaryCache[cacheKey];
      
      if (!cached) {
        return null;
      }
      
      // Check if expired
      if (Date.now() - cached.timestamp > this.config.summaryTTL) {
        await this.removeCachedSummary(cacheKey);
        return null;
      }
      
      // Update access time
      cached.lastAccessed = Date.now();
      summaryCache[cacheKey] = cached;
      await this.setStorageItem(this.CACHE_KEYS.SUMMARIES, summaryCache);
      
      console.log(`Cache hit for summary: ${cacheKey}`);
      return cached.data;
    } catch (error) {
      console.error('Failed to get cached summary:', error);
      return null;
    }
  }

  /**
   * Cache generated summary
   */
  async cacheSummary(transcriptHash, provider, promptHash, summary, metadata = {}) {
    try {
      const summaryCache = await this.getStorageItem(this.CACHE_KEYS.SUMMARIES) || {};
      const cacheKey = `${transcriptHash}_${provider}_${promptHash}`;
      
      // Check cache size limits
      await this.enforceStorageLimits(this.CACHE_KEYS.SUMMARIES);
      
      const cacheEntry = {
        data: summary,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        metadata: {
          provider,
          model: metadata.model || 'unknown',
          language: metadata.language || 'en',
          promptType: metadata.promptType || 'default',
          processingTime: metadata.processingTime || 0
        },
        size: this.calculateDataSize(summary),
        version: this.CACHE_VERSION
      };
      
      summaryCache[cacheKey] = cacheEntry;
      await this.setStorageItem(this.CACHE_KEYS.SUMMARIES, summaryCache);
      
      // Update cache statistics
      await this.updateCacheStats('summary_cached');
      
      console.log(`Cached summary: ${cacheKey}`);
    } catch (error) {
      console.error('Failed to cache summary:', error);
    }
  }

  /**
   * Generate hash for transcript to use as cache key
   */
  generateTranscriptHash(transcript) {
    const content = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
    return this.simpleHash(content);
  }

  /**
   * Generate hash for prompt configuration
   */
  generatePromptHash(prompt, language = 'en', customSettings = {}) {
    const promptData = {
      prompt: prompt || '',
      language,
      settings: customSettings
    };
    return this.simpleHash(JSON.stringify(promptData));
  }

  /**
   * Remove expired cache entries
   */
  async cleanupExpiredEntries() {
    try {
      console.log('Starting cache cleanup...');
      
      // Cleanup transcripts
      const transcriptCache = await this.getStorageItem(this.CACHE_KEYS.TRANSCRIPTS) || {};
      let cleanedTranscripts = 0;
      
      for (const [key, entry] of Object.entries(transcriptCache)) {
        if (Date.now() - entry.timestamp > this.config.transcriptTTL) {
          delete transcriptCache[key];
          cleanedTranscripts++;
        }
      }
      
      if (cleanedTranscripts > 0) {
        await this.setStorageItem(this.CACHE_KEYS.TRANSCRIPTS, transcriptCache);
        console.log(`Cleaned up ${cleanedTranscripts} expired transcripts`);
      }
      
      // Cleanup summaries
      const summaryCache = await this.getStorageItem(this.CACHE_KEYS.SUMMARIES) || {};
      let cleanedSummaries = 0;
      
      for (const [key, entry] of Object.entries(summaryCache)) {
        if (Date.now() - entry.timestamp > this.config.summaryTTL) {
          delete summaryCache[key];
          cleanedSummaries++;
        }
      }
      
      if (cleanedSummaries > 0) {
        await this.setStorageItem(this.CACHE_KEYS.SUMMARIES, summaryCache);
        console.log(`Cleaned up ${cleanedSummaries} expired summaries`);
      }
      
      // Update statistics
      await this.updateCacheStats('cleanup_completed', {
        transcriptsRemoved: cleanedTranscripts,
        summariesRemoved: cleanedSummaries
      });
      
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  /**
   * Enforce storage size limits using LRU eviction
   */
  async enforceStorageLimits(cacheKey) {
    try {
      const cache = await this.getStorageItem(cacheKey) || {};
      const entries = Object.entries(cache);
      
      // Check total size
      const totalSize = entries.reduce((sum, [, entry]) => sum + (entry.size || 0), 0);
      
      if (totalSize > this.config.maxCacheSize || entries.length > this.config.maxEntries) {
        // Sort by last accessed time (LRU)
        entries.sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));
        
        // Remove oldest entries until within limits
        const targetSize = this.config.maxCacheSize * 0.8; // Leave 20% buffer
        const targetEntries = Math.floor(this.config.maxEntries * 0.8);
        
        let currentSize = totalSize;
        let currentEntries = entries.length;
        let removedCount = 0;
        
        while ((currentSize > targetSize || currentEntries > targetEntries) && entries.length > 0) {
          const [key, entry] = entries.shift();
          currentSize -= (entry.size || 0);
          currentEntries--;
          removedCount++;
          delete cache[key];
        }
        
        if (removedCount > 0) {
          await this.setStorageItem(cacheKey, cache);
          console.log(`Evicted ${removedCount} cache entries to enforce limits`);
        }
      }
    } catch (error) {
      console.error('Failed to enforce storage limits:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const [transcripts, summaries, metadata] = await Promise.all([
        this.getStorageItem(this.CACHE_KEYS.TRANSCRIPTS) || {},
        this.getStorageItem(this.CACHE_KEYS.SUMMARIES) || {},
        this.getCacheMetadata()
      ]);
      
      const transcriptEntries = Object.entries(transcripts);
      const summaryEntries = Object.entries(summaries);
      
      return {
        transcripts: {
          count: transcriptEntries.length,
          totalSize: transcriptEntries.reduce((sum, [, entry]) => sum + (entry.size || 0), 0),
          oldestEntry: transcriptEntries.reduce((oldest, [, entry]) => 
            (!oldest || entry.timestamp < oldest) ? entry.timestamp : oldest, null),
          newestEntry: transcriptEntries.reduce((newest, [, entry]) => 
            (!newest || entry.timestamp > newest) ? entry.timestamp : newest, null)
        },
        summaries: {
          count: summaryEntries.length,
          totalSize: summaryEntries.reduce((sum, [, entry]) => sum + (entry.size || 0), 0),
          oldestEntry: summaryEntries.reduce((oldest, [, entry]) => 
            (!oldest || entry.timestamp < oldest) ? entry.timestamp : oldest, null),
          newestEntry: summaryEntries.reduce((newest, [, entry]) => 
            (!newest || entry.timestamp > newest) ? entry.timestamp : newest, null)
        },
        metadata,
        limits: this.config
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }

  /**
   * Clear all cache data
   */
  async clearCache() {
    try {
      await Promise.all([
        this.removeStorageItem(this.CACHE_KEYS.TRANSCRIPTS),
        this.removeStorageItem(this.CACHE_KEYS.SUMMARIES)
      ]);
      
      await this.updateCacheStats('cache_cleared');
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Helper methods
   */
  async getCacheMetadata() {
    const metadata = await this.getStorageItem(this.CACHE_KEYS.METADATA) || {};
    return {
      version: metadata.version || '0.0.0',
      created: metadata.created || Date.now(),
      lastCleanup: metadata.lastCleanup || 0,
      statistics: metadata.statistics || {
        transcriptsCached: 0,
        summariesCached: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cleanupRuns: 0
      }
    };
  }

  async updateCacheStats(event, data = {}) {
    try {
      const metadata = await this.getCacheMetadata();
      
      switch (event) {
        case 'transcript_cached':
          metadata.statistics.transcriptsCached++;
          break;
        case 'summary_cached':
          metadata.statistics.summariesCached++;
          break;
        case 'cache_hit':
          metadata.statistics.cacheHits++;
          break;
        case 'cache_miss':
          metadata.statistics.cacheMisses++;
          break;
        case 'cleanup_completed':
          metadata.statistics.cleanupRuns++;
          metadata.lastCleanup = Date.now();
          break;
        case 'cache_cleared':
          metadata.statistics.transcriptsCached = 0;
          metadata.statistics.summariesCached = 0;
          break;
      }
      
      await this.setStorageItem(this.CACHE_KEYS.METADATA, metadata);
    } catch (error) {
      console.error('Failed to update cache stats:', error);
    }
  }

  async removeCachedTranscript(meetingId) {
    try {
      const transcriptCache = await this.getStorageItem(this.CACHE_KEYS.TRANSCRIPTS) || {};
      delete transcriptCache[meetingId];
      await this.setStorageItem(this.CACHE_KEYS.TRANSCRIPTS, transcriptCache);
    } catch (error) {
      console.error('Failed to remove cached transcript:', error);
    }
  }

  async removeCachedSummary(cacheKey) {
    try {
      const summaryCache = await this.getStorageItem(this.CACHE_KEYS.SUMMARIES) || {};
      delete summaryCache[cacheKey];
      await this.setStorageItem(this.CACHE_KEYS.SUMMARIES, summaryCache);
    } catch (error) {
      console.error('Failed to remove cached summary:', error);
    }
  }

  scheduleCleanup() {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  async migrateCache(oldVersion) {
    console.log(`Migrating cache from version ${oldVersion} to ${this.CACHE_VERSION}`);
    
    // For now, just clear the cache on version change
    // Future versions can implement proper migration logic
    await this.clearCache();
    
    const metadata = await this.getCacheMetadata();
    metadata.version = this.CACHE_VERSION;
    await this.setStorageItem(this.CACHE_KEYS.METADATA, metadata);
  }

  calculateDataSize(data) {
    try {
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch (error) {
      console.error('Failed to calculate data size:', error);
      return 0;
    }
  }

  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  // Chrome Storage API wrappers
  async getStorageItem(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result[key]);
        }
      });
    });
  }

  async setStorageItem(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async removeStorageItem(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CacheManager;
} else if (typeof window !== 'undefined') {
  window.CacheManager = CacheManager;
}