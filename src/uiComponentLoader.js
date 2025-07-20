/**
 * UI Component Lazy Loader for Teams Transcript Extension
 * 
 * Provides lazy loading functionality for UI components to improve
 * initial popup load time and reduce memory usage.
 */

class UIComponentLoader {
  constructor() {
    this.loadedComponents = new Set();
    this.componentDefinitions = new Map();
    this.observers = new Map();
    this.loadingStates = new Map();
    
    this.initializeComponentDefinitions();
    this.setupIntersectionObserver();
  }

  /**
   * Define all lazy-loadable components
   */
  initializeComponentDefinitions() {
    // Settings panel component
    this.defineComponent('settings-panel', {
      selector: '#settings-view',
      loadTrigger: 'click:#settings-button',
      dependencies: ['prompt-editor', 'api-key-manager'],
      template: 'templates/settings-panel.html',
      script: 'components/settings-panel.js',
      styles: 'components/settings-panel.css',
      critical: false
    });

    // Transcript preview component
    this.defineComponent('transcript-preview', {
      selector: '#transcript-preview',
      loadTrigger: 'data-loaded:transcript',
      dependencies: ['syntax-highlighter'],
      template: 'templates/transcript-preview.html',
      script: 'components/transcript-preview.js',
      styles: 'components/transcript-preview.css',
      critical: true
    });

    // Summary export component
    this.defineComponent('summary-export', {
      selector: '#export-buttons',
      loadTrigger: 'data-loaded:summary',
      dependencies: ['file-saver', 'clipboard-manager'],
      template: 'templates/summary-export.html',
      script: 'components/summary-export.js',
      styles: 'components/summary-export.css',
      critical: false
    });

    // Advanced settings component
    this.defineComponent('advanced-settings', {
      selector: '#advanced-settings',
      loadTrigger: 'click:#advanced-toggle',
      dependencies: ['json-editor'],
      template: 'templates/advanced-settings.html',
      script: 'components/advanced-settings.js',
      styles: 'components/advanced-settings.css',
      critical: false
    });

    // Progress indicator component
    this.defineComponent('progress-indicator', {
      selector: '.progress-container',
      loadTrigger: 'immediate',
      dependencies: [],
      template: 'templates/progress-indicator.html',
      script: 'components/progress-indicator.js',
      styles: 'components/progress-indicator.css',
      critical: true
    });

    // AI provider switcher
    this.defineComponent('ai-provider-switcher', {
      selector: '#provider-switcher',
      loadTrigger: 'click:#provider-select',
      dependencies: ['provider-configs'],
      template: 'templates/ai-provider-switcher.html',
      script: 'components/ai-provider-switcher.js',
      styles: 'components/ai-provider-switcher.css',
      critical: false
    });
  }

  /**
   * Define a lazy-loadable component
   */
  defineComponent(name, config) {
    this.componentDefinitions.set(name, {
      ...config,
      loaded: false,
      loading: false,
      error: null
    });
  }

  /**
   * Initialize the popup with critical components only
   */
  async initializePopup() {
    try {
      console.log('Initializing popup with lazy loading...');
      
      // Load critical components immediately
      const criticalComponents = Array.from(this.componentDefinitions.entries())
        .filter(([, config]) => config.critical)
        .map(([name]) => name);

      await this.loadComponents(criticalComponents);

      // Setup lazy loading triggers for non-critical components
      this.setupLazyLoadingTriggers();

      // Load components that should be loaded immediately
      const immediateComponents = Array.from(this.componentDefinitions.entries())
        .filter(([, config]) => config.loadTrigger === 'immediate')
        .map(([name]) => name);

      await this.loadComponents(immediateComponents);

      console.log('Popup initialization completed');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      // Fallback to loading all components
      await this.loadAllComponents();
    }
  }

  /**
   * Setup lazy loading triggers
   */
  setupLazyLoadingTriggers() {
    this.componentDefinitions.forEach((config, name) => {
      if (config.loaded || config.critical || config.loadTrigger === 'immediate') {
        return;
      }

      const trigger = config.loadTrigger;

      if (trigger.startsWith('click:')) {
        const selector = trigger.substring(6);
        this.setupClickTrigger(name, selector);
      } else if (trigger.startsWith('data-loaded:')) {
        const eventType = trigger.substring(12);
        this.setupDataLoadedTrigger(name, eventType);
      } else if (trigger.startsWith('visible:')) {
        const selector = trigger.substring(8);
        this.setupVisibilityTrigger(name, selector);
      }
    });
  }

  /**
   * Setup click-based lazy loading
   */
  setupClickTrigger(componentName, selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.addEventListener('click', async (event) => {
        event.preventDefault();
        await this.loadComponent(componentName);
        
        // Re-trigger the click after component is loaded
        setTimeout(() => {
          element.click();
        }, 100);
      }, { once: true });
    }
  }

  /**
   * Setup data-loaded event triggers
   */
  setupDataLoadedTrigger(componentName, eventType) {
    document.addEventListener(`data-loaded-${eventType}`, async () => {
      await this.loadComponent(componentName);
    });
  }

  /**
   * Setup visibility-based triggers using Intersection Observer
   */
  setupVisibilityTrigger(componentName, selector) {
    const element = document.querySelector(selector);
    if (element && this.observers.has('visibility')) {
      this.observers.get('visibility').observe(element);
      element.dataset.lazyComponent = componentName;
    }
  }

  /**
   * Setup intersection observer for visibility-based loading
   */
  setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting && entry.target.dataset.lazyComponent) {
          const componentName = entry.target.dataset.lazyComponent;
          await this.loadComponent(componentName);
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '50px',
      threshold: 0.1
    });

    this.observers.set('visibility', observer);
  }

  /**
   * Load a single component
   */
  async loadComponent(name) {
    const config = this.componentDefinitions.get(name);
    if (!config) {
      console.warn(`Component ${name} not defined`);
      return false;
    }

    if (config.loaded) {
      return true;
    }

    if (config.loading) {
      // Wait for existing load to complete
      return this.waitForLoad(name);
    }

    try {
      config.loading = true;
      this.loadingStates.set(name, 'loading');
      
      console.log(`Loading component: ${name}`);

      // Load dependencies first
      if (config.dependencies && config.dependencies.length > 0) {
        await this.loadComponents(config.dependencies);
      }

      // Load component resources in parallel
      const loadPromises = [];

      if (config.template) {
        loadPromises.push(this.loadTemplate(name, config.template));
      }

      if (config.script) {
        loadPromises.push(this.loadScript(name, config.script));
      }

      if (config.styles) {
        loadPromises.push(this.loadStyles(name, config.styles));
      }

      await Promise.all(loadPromises);

      // Initialize component if it has an init method
      await this.initializeComponent(name, config);

      config.loaded = true;
      config.loading = false;
      this.loadingStates.set(name, 'loaded');
      this.loadedComponents.add(name);

      console.log(`Component ${name} loaded successfully`);
      
      // Dispatch loaded event
      document.dispatchEvent(new CustomEvent(`component-loaded-${name}`));
      
      return true;
    } catch (error) {
      console.error(`Failed to load component ${name}:`, error);
      config.loading = false;
      config.error = error;
      this.loadingStates.set(name, 'error');
      return false;
    }
  }

  /**
   * Load multiple components
   */
  async loadComponents(componentNames) {
    const loadPromises = componentNames.map(name => this.loadComponent(name));
    const results = await Promise.allSettled(loadPromises);
    
    const failed = results
      .map((result, index) => ({ result, name: componentNames[index] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ name }) => name);

    if (failed.length > 0) {
      console.warn(`Failed to load components: ${failed.join(', ')}`);
    }

    return results.every(result => result.status === 'fulfilled');
  }

  /**
   * Load component template
   */
  async loadTemplate(componentName, templatePath) {
    try {
      const response = await fetch(chrome.runtime.getURL(templatePath));
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status}`);
      }
      
      const html = await response.text();
      const config = this.componentDefinitions.get(componentName);
      
      if (config.selector) {
        const container = document.querySelector(config.selector);
        if (container) {
          container.innerHTML = html;
        }
      }
      
      console.log(`Template loaded for ${componentName}`);
    } catch (error) {
      console.error(`Failed to load template for ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Load component script
   */
  async loadScript(componentName, scriptPath) {
    try {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(scriptPath);
        script.onload = () => {
          console.log(`Script loaded for ${componentName}`);
          resolve();
        };
        script.onerror = () => {
          reject(new Error(`Failed to load script: ${scriptPath}`));
        };
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error(`Failed to load script for ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Load component styles
   */
  async loadStyles(componentName, stylesPath) {
    try {
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL(stylesPath);
        link.onload = () => {
          console.log(`Styles loaded for ${componentName}`);
          resolve();
        };
        link.onerror = () => {
          reject(new Error(`Failed to load styles: ${stylesPath}`));
        };
        document.head.appendChild(link);
      });
    } catch (error) {
      console.error(`Failed to load styles for ${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Initialize component after loading
   */
  async initializeComponent(name, config) {
    try {
      // Look for component class or init function
      const componentClass = window[this.getComponentClassName(name)];
      if (componentClass && typeof componentClass === 'function') {
        // Instantiate component class
        const instance = new componentClass(config.selector);
        if (instance.init && typeof instance.init === 'function') {
          await instance.init();
        }
      } else {
        // Look for init function
        const initFunction = window[`init${this.capitalizeFirst(name)}`];
        if (initFunction && typeof initFunction === 'function') {
          await initFunction(config.selector);
        }
      }
    } catch (error) {
      console.error(`Failed to initialize component ${name}:`, error);
      // Don't throw, as the component might still be functional
    }
  }

  /**
   * Wait for a component to finish loading
   */
  async waitForLoad(componentName, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkLoad = () => {
        const config = this.componentDefinitions.get(componentName);
        
        if (config.loaded) {
          resolve(true);
        } else if (config.error) {
          reject(config.error);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Component ${componentName} load timeout`));
        } else {
          setTimeout(checkLoad, 100);
        }
      };
      
      checkLoad();
    });
  }

  /**
   * Load all components (fallback method)
   */
  async loadAllComponents() {
    console.log('Loading all components as fallback...');
    const allComponents = Array.from(this.componentDefinitions.keys());
    return this.loadComponents(allComponents);
  }

  /**
   * Get loading statistics
   */
  getLoadingStats() {
    const total = this.componentDefinitions.size;
    const loaded = this.loadedComponents.size;
    const loading = Array.from(this.loadingStates.values())
      .filter(state => state === 'loading').length;
    const failed = Array.from(this.loadingStates.values())
      .filter(state => state === 'error').length;

    return {
      total,
      loaded,
      loading,
      failed,
      percentage: total > 0 ? (loaded / total * 100).toFixed(1) : 0
    };
  }

  /**
   * Preload components for better UX
   */
  async preloadComponents(componentNames, delay = 1000) {
    // Wait for initial load to complete
    setTimeout(async () => {
      console.log('Preloading components:', componentNames);
      await this.loadComponents(componentNames);
    }, delay);
  }

  /**
   * Helper methods
   */
  getComponentClassName(name) {
    return name.split('-')
      .map(part => this.capitalizeFirst(part))
      .join('') + 'Component';
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Cleanup method
   */
  cleanup() {
    // Clear observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    // Clear loading states
    this.loadingStates.clear();
    this.loadedComponents.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponentLoader;
} else if (typeof window !== 'undefined') {
  window.UIComponentLoader = UIComponentLoader;
}