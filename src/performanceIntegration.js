/**
 * Performance Integration Module for Teams Transcript Extension
 * 
 * Orchestrates all performance optimization modules and provides
 * a unified interface for performance management.
 */

class PerformanceIntegration {
  constructor(options = {}) {
    this.options = {
      enableCaching: true,
      enableMemoryOptimization: true,
      enablePerformanceMonitoring: true,
      enableLazyLoading: true,
      ...options
    };
    
    this.modules = {};
    this.initialized = false;
  }

  /**
   * Initialize all performance modules
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Performance Integration...');
      
      // Initialize Cache Manager
      if (this.options.enableCaching) {
        const CacheManager = this.loadModule('CacheManager');
        if (CacheManager) {
          this.modules.cache = new CacheManager();
          console.log('✅ Cache Manager initialized');
        }
      }
      
      // Initialize Memory Optimizer
      if (this.options.enableMemoryOptimization) {
        const MemoryOptimizer = this.loadModule('MemoryOptimizer');
        if (MemoryOptimizer) {
          this.modules.memory = new MemoryOptimizer();
          console.log('✅ Memory Optimizer initialized');
        }
      }
      
      // Initialize Performance Monitor
      if (this.options.enablePerformanceMonitoring) {
        const PerformanceMonitor = this.loadModule('PerformanceMonitor');
        if (PerformanceMonitor) {
          this.modules.performance = new PerformanceMonitor();
          console.log('✅ Performance Monitor initialized');
        }
      }
      
      // Initialize UI Component Loader (for popup environment)
      if (this.options.enableLazyLoading && typeof document !== 'undefined') {
        const UIComponentLoader = this.loadModule('UIComponentLoader');
        if (UIComponentLoader) {
          this.modules.uiLoader = new UIComponentLoader();
          console.log('✅ UI Component Loader initialized');
        }
      }
      
      this.initialized = true;
      console.log('🎯 Performance Integration initialized successfully');
      
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Performance Integration:', error);
      throw error;
    }
  }

  /**
   * Enhanced API call wrapper with caching and monitoring
   */
  async apiCall(apiName, apiFunction, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      cacheKey = null,
      cacheTTL = 60 * 60 * 1000, // 1 hour default
      enableCaching = true,
      enableMonitoring = true,
      enableMemoryOptimization = true,
      metadata = {}
    } = options;

    try {
      // Check cache first
      if (enableCaching && cacheKey && this.modules.cache) {
        const cached = await this.modules.cache.getCachedSummary(
          cacheKey, 
          metadata.provider || 'unknown',
          metadata.promptHash || 'default'
        );
        
        if (cached) {
          if (this.modules.performance) {
            this.modules.performance.incrementCounter(`api_cache_hit_${apiName}`);
          }
          console.log(`🎯 Cache hit for ${apiName}`);
          return cached;
        }
      }

      // Track API call performance
      let result;
      if (enableMonitoring && this.modules.performance) {
        result = await this.modules.performance.trackApiCall(apiName, apiFunction, metadata);
      } else {
        result = await apiFunction();
      }

      // Cache the result
      if (enableCaching && cacheKey && this.modules.cache && result) {
        await this.modules.cache.cacheSummary(
          cacheKey,
          metadata.provider || 'unknown',
          metadata.promptHash || 'default',
          result,
          {
            ...metadata,
            processingTime: Date.now()
          }
        );
      }

      // Memory optimization
      if (enableMemoryOptimization && this.modules.memory) {
        const operationId = `api_${apiName}_${Date.now()}`;
        this.modules.memory.trackOperation(operationId, result, {
          type: 'api_response',
          api: apiName,
          description: `API response for ${apiName}`
        });
        
        // Schedule cleanup after some time
        setTimeout(() => {
          this.modules.memory.releaseOperation(operationId);
        }, 5 * 60 * 1000); // 5 minutes
      }

      return result;
    } catch (error) {
      if (this.modules.performance) {
        this.modules.performance.recordMetric('error', `api_${apiName}`, {
          error: error.message,
          metadata
        });
      }
      throw error;
    }
  }

  /**
   * Enhanced transcript processing with optimization
   */
  async processTranscript(transcriptData, meetingInfo = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const meetingId = this.generateMeetingId(meetingInfo);
      
      // Check cache first
      if (this.modules.cache) {
        const cached = await this.modules.cache.getCachedTranscript(meetingId);
        if (cached) {
          console.log(`🎯 Using cached transcript for ${meetingId}`);
          return cached;
        }
      }

      // Memory optimization for transcript data
      let optimizedTranscript = transcriptData;
      if (this.modules.memory) {
        optimizedTranscript = this.modules.memory.optimizeTranscriptData(transcriptData);
        
        // Track memory usage
        const operationId = `transcript_${meetingId}`;
        this.modules.memory.trackOperation(operationId, optimizedTranscript, {
          type: 'transcript_data',
          meetingId,
          description: `Transcript data for meeting ${meetingInfo.title || 'Unknown'}`
        });
      }

      // Cache the optimized transcript
      if (this.modules.cache) {
        await this.modules.cache.cacheTranscript(meetingId, optimizedTranscript, meetingInfo);
      }

      // Performance monitoring
      if (this.modules.performance) {
        this.modules.performance.recordMetric('transcript_processed', meetingId, {
          originalSize: this.calculateDataSize(transcriptData),
          optimizedSize: this.calculateDataSize(optimizedTranscript),
          meetingInfo
        });
      }

      return optimizedTranscript;
    } catch (error) {
      console.error('Failed to process transcript:', error);
      if (this.modules.performance) {
        this.modules.performance.recordMetric('error', 'transcript_processing', {
          error: error.message,
          meetingInfo
        });
      }
      throw error;
    }
  }

  /**
   * Enhanced UI interaction tracking
   */
  async trackUIInteraction(interactionName, action, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.modules.performance) {
      return await this.modules.performance.trackUserInteraction(interactionName, action, metadata);
    } else {
      return await action();
    }
  }

  /**
   * Large data processing with memory optimization
   */
  async processLargeData(data, processor, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      chunkSize = 1000,
      enableMemoryOptimization = true
    } = options;

    if (enableMemoryOptimization && this.modules.memory) {
      return await this.modules.memory.processLargeData(data, processor, chunkSize);
    } else {
      return await processor(data);
    }
  }

  /**
   * Throttle operations to prevent resource exhaustion
   */
  async throttleOperation(operation, operationId = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.modules.memory) {
      return await this.modules.memory.throttleOperation(operation, operationId);
    } else {
      return await operation();
    }
  }

  /**
   * Initialize lazy-loaded UI components
   */
  async initializeUI() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.modules.uiLoader) {
      return await this.modules.uiLoader.initializePopup();
    }
  }

  /**
   * Load UI component on demand
   */
  async loadComponent(componentName) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.modules.uiLoader) {
      return await this.modules.uiLoader.loadComponent(componentName);
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  async getPerformanceStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    const stats = {
      timestamp: Date.now(),
      modules: {}
    };

    if (this.modules.cache) {
      stats.modules.cache = await this.modules.cache.getCacheStats();
    }

    if (this.modules.memory) {
      stats.modules.memory = this.modules.memory.getStats();
    }

    if (this.modules.performance) {
      stats.modules.performance = {
        timing: this.modules.performance.getPerformanceStats(),
        counters: this.modules.performance.getCounterStats(),
        alerts: this.modules.performance.getRecentAlerts(5)
      };
    }

    if (this.modules.uiLoader) {
      stats.modules.uiLoader = this.modules.uiLoader.getLoadingStats();
    }

    return stats;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport() {
    if (!this.initialized) {
      await this.initialize();
    }

    const stats = await this.getPerformanceStats();
    
    if (this.modules.performance) {
      const detailedReport = this.modules.performance.generatePerformanceReport();
      return {
        ...detailedReport,
        integration: stats
      };
    }

    return { integration: stats };
  }

  /**
   * Cleanup all modules
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up Performance Integration...');
      
      if (this.modules.cache) {
        // No explicit cleanup needed for cache manager
      }
      
      if (this.modules.memory) {
        this.modules.memory.cleanup();
      }
      
      if (this.modules.performance) {
        this.modules.performance.cleanup();
      }
      
      if (this.modules.uiLoader) {
        this.modules.uiLoader.cleanup();
      }
      
      this.modules = {};
      this.initialized = false;
      
      console.log('✅ Performance Integration cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup Performance Integration:', error);
    }
  }

  /**
   * Utility methods
   */
  loadModule(moduleName) {
    try {
      // Try to load from global scope first (browser environment)
      if (typeof window !== 'undefined' && window[moduleName]) {
        return window[moduleName];
      }
      
      // Try to load from self scope (service worker environment)
      if (typeof self !== 'undefined' && self[moduleName]) {
        return self[moduleName];
      }
      
      // Try to require (Node.js environment)
      if (typeof require !== 'undefined') {
        try {
          return require(`./${moduleName.toLowerCase()}`);
        } catch (error) {
          // Module not found via require
        }
      }
      
      console.warn(`Module ${moduleName} not found`);
      return null;
    } catch (error) {
      console.error(`Failed to load module ${moduleName}:`, error);
      return null;
    }
  }

  generateMeetingId(meetingInfo) {
    const idParts = [
      meetingInfo.siteUrl || '',
      meetingInfo.driveId || '',
      meetingInfo.itemId || '',
      meetingInfo.title || '',
      meetingInfo.duration || ''
    ].filter(part => part);
    
    return this.simpleHash(idParts.join('|'));
  }

  calculateDataSize(data) {
    try {
      if (data === null || data === undefined) return 0;
      
      if (typeof data === 'string') {
        return data.length * 2; // Unicode characters
      }
      
      return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
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
}

// Create global instance
const performanceIntegration = new PerformanceIntegration();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceIntegration, performanceIntegration };
} else if (typeof window !== 'undefined') {
  window.PerformanceIntegration = PerformanceIntegration;
  window.performanceIntegration = performanceIntegration;
} else if (typeof self !== 'undefined') {
  self.PerformanceIntegration = PerformanceIntegration;
  self.performanceIntegration = performanceIntegration;
}