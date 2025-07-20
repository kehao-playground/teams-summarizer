/**
 * Memory Optimizer for Teams Transcript Extension Background Script
 * 
 * Manages memory usage, prevents memory leaks, and optimizes resource allocation
 * in the Chrome Extension service worker environment.
 */

class MemoryOptimizer {
  constructor() {
    this.memoryTracker = new Map();
    this.activeConnections = new Map();
    this.dataBuffers = new Map();
    this.timers = new Map();
    this.eventListeners = new Map();
    
    this.config = {
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB limit
      gcThreshold: 40 * 1024 * 1024,    // 40MB trigger GC
      bufferTimeout: 5 * 60 * 1000,      // 5 minutes
      connectionTimeout: 10 * 60 * 1000, // 10 minutes
      monitoringInterval: 30 * 1000,     // 30 seconds
      maxConcurrentOperations: 3
    };
    
    this.activeOperations = 0;
    this.lastCleanup = Date.now();
    
    this.initializeOptimizer();
  }

  async initializeOptimizer() {
    try {
      // Start memory monitoring
      this.startMemoryMonitoring();
      
      // Setup periodic cleanup
      this.schedulePeriodicCleanup();
      
      // Setup connection management
      this.setupConnectionManagement();
      
      // Register service worker lifecycle handlers
      this.registerLifecycleHandlers();
      
      console.log('MemoryOptimizer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MemoryOptimizer:', error);
    }
  }

  /**
   * Track memory usage for operations
   */
  trackOperation(operationId, data, metadata = {}) {
    try {
      const memoryUsage = this.calculateMemoryUsage(data);
      
      this.memoryTracker.set(operationId, {
        size: memoryUsage,
        timestamp: Date.now(),
        type: metadata.type || 'unknown',
        description: metadata.description || '',
        data: metadata.keepData ? data : null // Only keep data if specifically requested
      });
      
      console.log(`Tracking operation ${operationId}: ${this.formatBytes(memoryUsage)}`);
      
      // Check if we're approaching memory limits
      this.checkMemoryLimits();
    } catch (error) {
      console.error('Failed to track operation:', error);
    }
  }

  /**
   * Release tracked operation from memory
   */
  releaseOperation(operationId) {
    try {
      const tracked = this.memoryTracker.get(operationId);
      if (tracked) {
        this.memoryTracker.delete(operationId);
        console.log(`Released operation ${operationId}: ${this.formatBytes(tracked.size)}`);
        
        // Clear associated data
        if (tracked.data) {
          tracked.data = null;
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to release operation:', error);
      return false;
    }
  }

  /**
   * Optimize transcript data for memory efficiency
   */
  optimizeTranscriptData(transcript) {
    try {
      if (!transcript || !transcript.entries) {
        return transcript;
      }

      const optimized = {
        ...transcript,
        entries: transcript.entries.map(entry => ({
          // Keep only essential fields
          text: entry.text,
          speakerDisplayName: entry.speakerDisplayName,
          startOffset: entry.startOffset,
          endOffset: entry.endOffset,
          confidence: entry.confidence > 0.8 ? entry.confidence : undefined // Remove low confidence scores
        })).filter(entry => entry.text && entry.text.trim().length > 0) // Remove empty entries
      };

      // Remove redundant metadata if not needed
      delete optimized.$schema;
      delete optimized.version;
      
      // Compress consecutive entries from same speaker
      optimized.entries = this.compressConsecutiveEntries(optimized.entries);
      
      const originalSize = this.calculateMemoryUsage(transcript);
      const optimizedSize = this.calculateMemoryUsage(optimized);
      
      console.log(`Transcript optimization: ${this.formatBytes(originalSize)} → ${this.formatBytes(optimizedSize)} (${((1 - optimizedSize/originalSize) * 100).toFixed(1)}% reduction)`);
      
      return optimized;
    } catch (error) {
      console.error('Failed to optimize transcript data:', error);
      return transcript;
    }
  }

  /**
   * Compress consecutive entries from the same speaker
   */
  compressConsecutiveEntries(entries) {
    if (!entries || entries.length === 0) return entries;
    
    const compressed = [];
    let currentEntry = { ...entries[0] };
    
    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i];
      
      // If same speaker and within 5 seconds, merge entries
      if (entry.speakerDisplayName === currentEntry.speakerDisplayName &&
          this.getTimeDifference(currentEntry.endOffset, entry.startOffset) < 5000) {
        
        currentEntry.text += ' ' + entry.text;
        currentEntry.endOffset = entry.endOffset;
        currentEntry.confidence = Math.min(currentEntry.confidence || 1, entry.confidence || 1);
      } else {
        compressed.push(currentEntry);
        currentEntry = { ...entry };
      }
    }
    
    compressed.push(currentEntry);
    return compressed;
  }

  /**
   * Manage data buffers with automatic cleanup
   */
  bufferData(bufferId, data, timeout = null) {
    try {
      // Clear existing buffer if present
      this.clearBuffer(bufferId);
      
      const bufferTimeout = timeout || this.config.bufferTimeout;
      const memoryUsage = this.calculateMemoryUsage(data);
      
      const buffer = {
        data,
        timestamp: Date.now(),
        size: memoryUsage,
        timeout: setTimeout(() => {
          this.clearBuffer(bufferId);
        }, bufferTimeout)
      };
      
      this.dataBuffers.set(bufferId, buffer);
      
      console.log(`Buffered data ${bufferId}: ${this.formatBytes(memoryUsage)}`);
      
      return bufferId;
    } catch (error) {
      console.error('Failed to buffer data:', error);
      return null;
    }
  }

  /**
   * Retrieve data from buffer
   */
  getBufferedData(bufferId) {
    const buffer = this.dataBuffers.get(bufferId);
    if (buffer) {
      // Update access time
      buffer.lastAccessed = Date.now();
      return buffer.data;
    }
    return null;
  }

  /**
   * Clear specific buffer
   */
  clearBuffer(bufferId) {
    const buffer = this.dataBuffers.get(bufferId);
    if (buffer) {
      if (buffer.timeout) {
        clearTimeout(buffer.timeout);
      }
      this.dataBuffers.delete(bufferId);
      console.log(`Cleared buffer ${bufferId}`);
      return true;
    }
    return false;
  }

  /**
   * Stream large data processing to avoid memory spikes
   */
  async processLargeData(data, processor, chunkSize = 1000) {
    try {
      if (!Array.isArray(data)) {
        return await processor(data);
      }

      const results = [];
      const totalChunks = Math.ceil(data.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, data.length);
        const chunk = data.slice(start, end);
        
        // Process chunk and wait for next tick to prevent blocking
        const chunkResult = await processor(chunk, i, totalChunks);
        results.push(chunkResult);
        
        // Yield control to allow garbage collection
        await this.yield();
        
        // Check memory pressure
        if (await this.isMemoryPressureHigh()) {
          console.log('High memory pressure detected, triggering cleanup');
          await this.forceCleanup();
        }
      }
      
      return results.flat();
    } catch (error) {
      console.error('Failed to process large data:', error);
      throw error;
    }
  }

  /**
   * Throttle concurrent operations to prevent memory overload
   */
  async throttleOperation(operation, operationId = null) {
    try {
      // Wait if too many operations are running
      while (this.activeOperations >= this.config.maxConcurrentOperations) {
        await this.sleep(100);
      }
      
      this.activeOperations++;
      const id = operationId || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const result = await operation();
        return result;
      } finally {
        this.activeOperations--;
      }
    } catch (error) {
      this.activeOperations--;
      throw error;
    }
  }

  /**
   * Monitor memory usage and trigger cleanup when needed
   */
  startMemoryMonitoring() {
    const monitor = () => {
      try {
        const memoryInfo = this.getCurrentMemoryUsage();
        
        if (memoryInfo.total > this.config.gcThreshold) {
          console.log(`Memory usage high (${this.formatBytes(memoryInfo.total)}), triggering cleanup`);
          this.forceCleanup();
        }
        
        // Log memory stats periodically
        if (Date.now() - this.lastCleanup > 5 * 60 * 1000) { // Every 5 minutes
          console.log('Memory stats:', {
            total: this.formatBytes(memoryInfo.total),
            tracked: memoryInfo.tracked,
            buffers: this.dataBuffers.size,
            connections: this.activeConnections.size
          });
        }
      } catch (error) {
        console.error('Memory monitoring error:', error);
      }
    };

    // Use timer reference for cleanup
    const timerId = setInterval(monitor, this.config.monitoringInterval);
    this.timers.set('memory_monitor', timerId);
  }

  /**
   * Force cleanup of memory
   */
  async forceCleanup() {
    try {
      console.log('Starting forced memory cleanup...');
      
      // Clear expired buffers
      const now = Date.now();
      const expiredBuffers = [];
      
      this.dataBuffers.forEach((buffer, id) => {
        if (now - buffer.timestamp > this.config.bufferTimeout) {
          expiredBuffers.push(id);
        }
      });
      
      expiredBuffers.forEach(id => this.clearBuffer(id));
      
      // Clear old tracking data
      const expiredOperations = [];
      this.memoryTracker.forEach((operation, id) => {
        if (now - operation.timestamp > this.config.bufferTimeout) {
          expiredOperations.push(id);
        }
      });
      
      expiredOperations.forEach(id => this.releaseOperation(id));
      
      // Clear inactive connections
      this.cleanupInactiveConnections();
      
      // Suggest garbage collection
      if (typeof globalThis.gc === 'function') {
        globalThis.gc();
      }
      
      this.lastCleanup = now;
      
      console.log(`Cleanup completed: removed ${expiredBuffers.length} buffers, ${expiredOperations.length} operations`);
    } catch (error) {
      console.error('Failed to force cleanup:', error);
    }
  }

  /**
   * Setup periodic cleanup
   */
  schedulePeriodicCleanup() {
    const cleanup = () => {
      if (Date.now() - this.lastCleanup > 10 * 60 * 1000) { // Every 10 minutes
        this.forceCleanup();
      }
    };

    const timerId = setInterval(cleanup, 5 * 60 * 1000); // Check every 5 minutes
    this.timers.set('periodic_cleanup', timerId);
  }

  /**
   * Manage Chrome runtime connections
   */
  setupConnectionManagement() {
    const originalConnect = chrome.runtime.onConnect;
    if (originalConnect) {
      originalConnect.addListener((port) => {
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.activeConnections.set(connectionId, {
          port,
          timestamp: Date.now(),
          lastActivity: Date.now()
        });
        
        port.onMessage.addListener(() => {
          const connection = this.activeConnections.get(connectionId);
          if (connection) {
            connection.lastActivity = Date.now();
          }
        });
        
        port.onDisconnect.addListener(() => {
          this.activeConnections.delete(connectionId);
        });
        
        console.log(`New connection registered: ${connectionId}`);
      });
    }
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveConnections = [];
    
    this.activeConnections.forEach((connection, id) => {
      if (now - connection.lastActivity > this.config.connectionTimeout) {
        inactiveConnections.push(id);
      }
    });
    
    inactiveConnections.forEach(id => {
      const connection = this.activeConnections.get(id);
      if (connection && connection.port) {
        try {
          connection.port.disconnect();
        } catch (error) {
          // Connection might already be closed
        }
      }
      this.activeConnections.delete(id);
    });
    
    if (inactiveConnections.length > 0) {
      console.log(`Cleaned up ${inactiveConnections.length} inactive connections`);
    }
  }

  /**
   * Register service worker lifecycle handlers
   */
  registerLifecycleHandlers() {
    // Handle service worker suspension
    if (typeof self !== 'undefined' && self.addEventListener) {
      self.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Check current memory usage
   */
  getCurrentMemoryUsage() {
    let totalTracked = 0;
    let totalBuffered = 0;
    
    this.memoryTracker.forEach(operation => {
      totalTracked += operation.size || 0;
    });
    
    this.dataBuffers.forEach(buffer => {
      totalBuffered += buffer.size || 0;
    });
    
    return {
      total: totalTracked + totalBuffered,
      tracked: totalTracked,
      buffered: totalBuffered,
      operations: this.memoryTracker.size,
      buffers: this.dataBuffers.size
    };
  }

  /**
   * Check if memory pressure is high
   */
  async isMemoryPressureHigh() {
    const memoryInfo = this.getCurrentMemoryUsage();
    return memoryInfo.total > this.config.gcThreshold;
  }

  /**
   * Check memory limits and trigger cleanup if needed
   */
  checkMemoryLimits() {
    const memoryInfo = this.getCurrentMemoryUsage();
    
    if (memoryInfo.total > this.config.maxMemoryUsage) {
      console.warn(`Memory limit exceeded: ${this.formatBytes(memoryInfo.total)}`);
      this.forceCleanup();
    }
  }

  /**
   * Calculate memory usage of data
   */
  calculateMemoryUsage(data) {
    try {
      if (data === null || data === undefined) return 0;
      
      if (typeof data === 'string') {
        return data.length * 2; // Unicode characters are 2 bytes
      }
      
      if (typeof data === 'object') {
        return new Blob([JSON.stringify(data)]).size;
      }
      
      return JSON.stringify(data).length * 2;
    } catch (error) {
      console.error('Failed to calculate memory usage:', error);
      return 0;
    }
  }

  /**
   * Get time difference between two timestamp strings
   */
  getTimeDifference(time1, time2) {
    try {
      const parseTime = (timeStr) => {
        const parts = timeStr.split(':');
        const seconds = parts[2] ? parseFloat(parts[2]) : 0;
        return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + seconds) * 1000;
      };
      
      return Math.abs(parseTime(time2) - parseTime(time1));
    } catch (error) {
      return 0;
    }
  }

  /**
   * Utility methods
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async yield() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    try {
      console.log('Cleaning up MemoryOptimizer...');
      
      // Clear all timers
      this.timers.forEach((timerId, name) => {
        clearInterval(timerId);
        console.log(`Cleared timer: ${name}`);
      });
      this.timers.clear();
      
      // Clear all buffers
      this.dataBuffers.forEach((buffer, id) => {
        if (buffer.timeout) {
          clearTimeout(buffer.timeout);
        }
      });
      this.dataBuffers.clear();
      
      // Clear tracking data
      this.memoryTracker.clear();
      
      // Clear connections
      this.activeConnections.clear();
      
      console.log('MemoryOptimizer cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup MemoryOptimizer:', error);
    }
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const memoryInfo = this.getCurrentMemoryUsage();
    
    return {
      memory: memoryInfo,
      limits: this.config,
      activeOperations: this.activeOperations,
      connections: this.activeConnections.size,
      lastCleanup: this.lastCleanup,
      timers: this.timers.size
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoryOptimizer;
} else if (typeof window !== 'undefined') {
  window.MemoryOptimizer = MemoryOptimizer;
} else if (typeof self !== 'undefined') {
  self.MemoryOptimizer = MemoryOptimizer;
}