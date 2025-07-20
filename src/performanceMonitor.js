/**
 * Performance Monitor for Teams Transcript Extension
 * 
 * Tracks performance metrics, API response times, user interactions,
 * and provides insights for optimization opportunities.
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.counters = new Map();
    this.thresholds = new Map();
    this.alerts = [];
    
    this.config = {
      maxMetricAge: 24 * 60 * 60 * 1000, // 24 hours
      maxAlerts: 100,
      samplingRate: 1.0, // 100% sampling by default
      enableDetailedTracking: true,
      enableUserTiming: true,
      enableResourceTiming: true
    };
    
    this.initializeMonitor();
  }

  async initializeMonitor() {
    try {
      // Setup performance thresholds
      this.setupPerformanceThresholds();
      
      // Initialize performance observers if available
      this.setupPerformanceObservers();
      
      // Setup periodic reporting
      this.schedulePerformanceReporting();
      
      // Load existing metrics
      await this.loadStoredMetrics();
      
      console.log('PerformanceMonitor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PerformanceMonitor:', error);
    }
  }

  /**
   * Setup performance thresholds for different operations
   */
  setupPerformanceThresholds() {
    this.thresholds.set('api_call', {
      warning: 5000,   // 5 seconds
      critical: 15000  // 15 seconds
    });
    
    this.thresholds.set('transcript_extraction', {
      warning: 10000,  // 10 seconds
      critical: 30000  // 30 seconds
    });
    
    this.thresholds.set('summary_generation', {
      warning: 15000,  // 15 seconds
      critical: 60000  // 60 seconds
    });
    
    this.thresholds.set('ui_interaction', {
      warning: 500,    // 500ms
      critical: 2000   // 2 seconds
    });
    
    this.thresholds.set('memory_usage', {
      warning: 40 * 1024 * 1024,  // 40MB
      critical: 50 * 1024 * 1024  // 50MB
    });
  }

  /**
   * Setup performance observers for browser APIs
   */
  setupPerformanceObservers() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        // Monitor navigation timing
        const navigationObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.recordMetric('navigation', entry.name, {
              duration: entry.duration,
              loadEventEnd: entry.loadEventEnd,
              domContentLoadedEventEnd: entry.domContentLoadedEventEnd
            });
          });
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        
        // Monitor resource timing
        if (this.config.enableResourceTiming) {
          const resourceObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
              if (entry.name.includes('chrome-extension://')) {
                this.recordMetric('resource', entry.name, {
                  duration: entry.duration,
                  transferSize: entry.transferSize,
                  encodedBodySize: entry.encodedBodySize
                });
              }
            });
          });
          resourceObserver.observe({ entryTypes: ['resource'] });
        }
        
        // Monitor user timing
        if (this.config.enableUserTiming) {
          const userTimingObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
              this.recordMetric('user_timing', entry.name, {
                duration: entry.duration,
                detail: entry.detail
              });
            });
          });
          userTimingObserver.observe({ entryTypes: ['measure'] });
        }
      } catch (error) {
        console.warn('Performance observers not available:', error);
      }
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId, metadata = {}) {
    try {
      if (!this.shouldSample()) return null;
      
      const timer = {
        id: operationId,
        startTime: performance.now(),
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          extension: 'teams-transcript-extension'
        }
      };
      
      this.timers.set(operationId, timer);
      
      // Add user timing mark if enabled
      if (this.config.enableUserTiming && typeof performance.mark === 'function') {
        performance.mark(`${operationId}-start`);
      }
      
      return operationId;
    } catch (error) {
      console.error('Failed to start timer:', error);
      return null;
    }
  }

  /**
   * End timing an operation and record metrics
   */
  endTimer(operationId, additionalData = {}) {
    try {
      const timer = this.timers.get(operationId);
      if (!timer) {
        console.warn(`Timer ${operationId} not found`);
        return null;
      }
      
      const endTime = performance.now();
      const duration = endTime - timer.startTime;
      
      // Add user timing measure if enabled
      if (this.config.enableUserTiming && typeof performance.measure === 'function') {
        performance.measure(operationId, `${operationId}-start`);
      }
      
      const metric = {
        operation: operationId,
        duration,
        startTime: timer.startTime,
        endTime,
        timestamp: timer.timestamp,
        metadata: {
          ...timer.metadata,
          ...additionalData
        }
      };
      
      // Record the metric
      this.recordMetric('timing', operationId, metric);
      
      // Check thresholds
      this.checkThresholds(operationId, duration, metric);
      
      // Cleanup timer
      this.timers.delete(operationId);
      
      console.log(`Operation ${operationId} completed in ${duration.toFixed(2)}ms`);
      
      return metric;
    } catch (error) {
      console.error('Failed to end timer:', error);
      return null;
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(category, name, data = {}) {
    try {
      if (!this.shouldSample()) return;
      
      const metricKey = `${category}:${name}`;
      const timestamp = Date.now();
      
      if (!this.metrics.has(metricKey)) {
        this.metrics.set(metricKey, []);
      }
      
      const metric = {
        timestamp,
        category,
        name,
        data: {
          ...data,
          sessionId: this.getSessionId()
        }
      };
      
      this.metrics.get(metricKey).push(metric);
      
      // Cleanup old metrics
      this.cleanupOldMetrics(metricKey);
      
      // Store metrics periodically
      this.scheduleMetricStorage();
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, value = 1, metadata = {}) {
    try {
      if (!this.counters.has(name)) {
        this.counters.set(name, {
          count: 0,
          lastUpdated: Date.now(),
          metadata
        });
      }
      
      const counter = this.counters.get(name);
      counter.count += value;
      counter.lastUpdated = Date.now();
      
      // Record counter update as metric
      this.recordMetric('counter', name, {
        count: counter.count,
        increment: value,
        metadata
      });
    } catch (error) {
      console.error('Failed to increment counter:', error);
    }
  }

  /**
   * Track API call performance
   */
  async trackApiCall(apiName, apiCall, metadata = {}) {
    const timerId = this.startTimer(`api_call_${apiName}`, {
      type: 'api_call',
      api: apiName,
      ...metadata
    });
    
    try {
      const startTime = Date.now();
      const result = await apiCall();
      const duration = Date.now() - startTime;
      
      this.endTimer(timerId, {
        success: true,
        duration,
        responseSize: this.calculateResponseSize(result)
      });
      
      this.incrementCounter(`api_calls_${apiName}_success`);
      
      return result;
    } catch (error) {
      this.endTimer(timerId, {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      });
      
      this.incrementCounter(`api_calls_${apiName}_error`);
      
      // Record error details
      this.recordMetric('error', `api_call_${apiName}`, {
        error: error.message,
        stack: error.stack,
        metadata
      });
      
      throw error;
    }
  }

  /**
   * Track user interaction performance
   */
  trackUserInteraction(interactionName, action, metadata = {}) {
    const timerId = this.startTimer(`ui_${interactionName}`, {
      type: 'user_interaction',
      interaction: interactionName,
      ...metadata
    });
    
    try {
      const result = action();
      
      if (result && typeof result.then === 'function') {
        // Handle async actions
        return result.then(
          (res) => {
            this.endTimer(timerId, { success: true });
            this.incrementCounter(`ui_interactions_${interactionName}_success`);
            return res;
          },
          (error) => {
            this.endTimer(timerId, { success: false, error: error.message });
            this.incrementCounter(`ui_interactions_${interactionName}_error`);
            throw error;
          }
        );
      } else {
        // Handle sync actions
        this.endTimer(timerId, { success: true });
        this.incrementCounter(`ui_interactions_${interactionName}_success`);
        return result;
      }
    } catch (error) {
      this.endTimer(timerId, { success: false, error: error.message });
      this.incrementCounter(`ui_interactions_${interactionName}_error`);
      throw error;
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  checkThresholds(operationId, duration, metric) {
    try {
      const category = metric.metadata?.type || 'unknown';
      const threshold = this.thresholds.get(category);
      
      if (!threshold) return;
      
      let alertLevel = null;
      if (duration > threshold.critical) {
        alertLevel = 'critical';
      } else if (duration > threshold.warning) {
        alertLevel = 'warning';
      }
      
      if (alertLevel) {
        this.createAlert(alertLevel, 'performance_threshold', {
          operation: operationId,
          duration,
          threshold: threshold[alertLevel],
          category,
          metric
        });
      }
    } catch (error) {
      console.error('Failed to check thresholds:', error);
    }
  }

  /**
   * Create performance alert
   */
  createAlert(level, type, data) {
    try {
      const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        level,
        type,
        timestamp: Date.now(),
        data
      };
      
      this.alerts.push(alert);
      
      // Limit alert storage
      if (this.alerts.length > this.config.maxAlerts) {
        this.alerts = this.alerts.slice(-this.config.maxAlerts);
      }
      
      console.warn(`Performance Alert [${level}]:`, data);
      
      // Store alerts
      this.storeAlerts();
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(category = null, name = null) {
    try {
      const stats = {};
      
      this.metrics.forEach((metricList, key) => {
        const [metricCategory, metricName] = key.split(':');
        
        if (category && metricCategory !== category) return;
        if (name && metricName !== name) return;
        
        const durations = metricList
          .filter(m => m.data.duration !== undefined)
          .map(m => m.data.duration);
        
        if (durations.length > 0) {
          stats[key] = {
            count: durations.length,
            avg: durations.reduce((a, b) => a + b, 0) / durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            p50: this.percentile(durations, 0.5),
            p95: this.percentile(durations, 0.95),
            p99: this.percentile(durations, 0.99)
          };
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Failed to get performance stats:', error);
      return {};
    }
  }

  /**
   * Get counter statistics
   */
  getCounterStats() {
    const stats = {};
    
    this.counters.forEach((counter, name) => {
      stats[name] = {
        count: counter.count,
        lastUpdated: counter.lastUpdated,
        metadata: counter.metadata
      };
    });
    
    return stats;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 10) {
    return this.alerts
      .slice(-limit)
      .reverse();
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    try {
      const report = {
        timestamp: Date.now(),
        sessionId: this.getSessionId(),
        extension: 'teams-transcript-extension',
        timeframe: {
          start: Date.now() - this.config.maxMetricAge,
          end: Date.now()
        },
        performance: this.getPerformanceStats(),
        counters: this.getCounterStats(),
        alerts: this.getRecentAlerts(20),
        thresholds: Object.fromEntries(this.thresholds),
        config: this.config,
        browser: {
          userAgent: navigator.userAgent,
          memory: performance.memory ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          } : null
        }
      };
      
      return report;
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      return null;
    }
  }

  /**
   * Schedule periodic performance reporting
   */
  schedulePerformanceReporting() {
    setInterval(() => {
      try {
        const report = this.generatePerformanceReport();
        if (report) {
          console.log('Performance Report:', {
            operations: Object.keys(report.performance).length,
            counters: Object.keys(report.counters).length,
            alerts: report.alerts.length,
            memoryUsage: report.browser.memory?.usedJSHeapSize || 'unknown'
          });
          
          // Store report for later analysis
          this.storePerformanceReport(report);
        }
      } catch (error) {
        console.error('Failed to generate periodic report:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Utility methods
   */
  shouldSample() {
    return Math.random() < this.config.samplingRate;
  }

  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.sessionId;
  }

  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  calculateResponseSize(response) {
    try {
      if (typeof response === 'string') {
        return response.length;
      }
      return JSON.stringify(response).length;
    } catch (error) {
      return 0;
    }
  }

  cleanupOldMetrics(metricKey) {
    const metrics = this.metrics.get(metricKey);
    if (!metrics) return;
    
    const cutoff = Date.now() - this.config.maxMetricAge;
    const filtered = metrics.filter(m => m.timestamp > cutoff);
    
    if (filtered.length !== metrics.length) {
      this.metrics.set(metricKey, filtered);
    }
  }

  scheduleMetricStorage() {
    if (this.storageTimeout) return;
    
    this.storageTimeout = setTimeout(() => {
      this.storeMetrics();
      this.storageTimeout = null;
    }, 30000); // Store every 30 seconds
  }

  /**
   * Storage methods (Chrome Extension storage)
   */
  async storeMetrics() {
    try {
      const metricsData = Object.fromEntries(this.metrics);
      await this.setStorageItem('performance_metrics', metricsData);
    } catch (error) {
      console.error('Failed to store metrics:', error);
    }
  }

  async loadStoredMetrics() {
    try {
      const stored = await this.getStorageItem('performance_metrics');
      if (stored) {
        this.metrics = new Map(Object.entries(stored));
        console.log('Loaded stored performance metrics');
      }
    } catch (error) {
      console.error('Failed to load stored metrics:', error);
    }
  }

  async storeAlerts() {
    try {
      await this.setStorageItem('performance_alerts', this.alerts);
    } catch (error) {
      console.error('Failed to store alerts:', error);
    }
  }

  async storePerformanceReport(report) {
    try {
      const reports = await this.getStorageItem('performance_reports') || [];
      reports.push(report);
      
      // Keep only last 10 reports
      if (reports.length > 10) {
        reports.splice(0, reports.length - 10);
      }
      
      await this.setStorageItem('performance_reports', reports);
    } catch (error) {
      console.error('Failed to store performance report:', error);
    }
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

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      console.log('Cleaning up PerformanceMonitor...');
      
      // Store final metrics
      this.storeMetrics();
      this.storeAlerts();
      
      // Clear timers
      this.timers.clear();
      
      if (this.storageTimeout) {
        clearTimeout(this.storageTimeout);
      }
      
      console.log('PerformanceMonitor cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup PerformanceMonitor:', error);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
} else if (typeof window !== 'undefined') {
  window.PerformanceMonitor = PerformanceMonitor;
} else if (typeof self !== 'undefined') {
  self.PerformanceMonitor = PerformanceMonitor;
}