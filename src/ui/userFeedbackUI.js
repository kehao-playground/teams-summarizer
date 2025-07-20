/**
 * User Feedback UI Component for Teams Transcript Extension
 * 
 * Provides visual feedback for errors, progress, and user notifications
 * Integrates with the error handler to display user-friendly messages
 */

/**
 * UserFeedbackUI class for managing user interface feedback
 */
class UserFeedbackUI {
    constructor() {
        // Check if we're in a browser environment
        this.isBrowser = typeof document !== 'undefined' && typeof window !== 'undefined';
        
        this.activeNotifications = new Map();
        this.notificationContainer = null;
        this.progressContainer = null;
        
        if (this.isBrowser) {
            this.setupStyles();
            this.createContainers();
        }
    }

    /**
     * Setup CSS styles for feedback components
     */
    setupStyles() {
        if (!this.isBrowser) return;
        
        if (document.getElementById('teams-transcript-feedback-styles')) {
            return; // Styles already loaded
        }

        const styles = `
            .teams-feedback-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .teams-notification {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                margin-bottom: 12px;
                padding: 16px;
                border-left: 4px solid #0078d4;
                animation: slideIn 0.3s ease-out;
                max-width: 380px;
                word-wrap: break-word;
            }

            .teams-notification.error {
                border-left-color: #d83b01;
                background: #fef6f6;
            }

            .teams-notification.warning {
                border-left-color: #ffb900;
                background: #fffcf1;
            }

            .teams-notification.success {
                border-left-color: #107c10;
                background: #f3f9f1;
            }

            .teams-notification.critical {
                border-left-color: #d83b01;
                background: #fef6f6;
                border: 2px solid #d83b01;
            }

            .notification-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
            }

            .notification-title {
                font-weight: 600;
                font-size: 14px;
                color: #323130;
                margin: 0;
                flex: 1;
            }

            .notification-close {
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                padding: 0;
                margin-left: 8px;
                color: #605e5c;
                line-height: 1;
            }

            .notification-close:hover {
                color: #323130;
            }

            .notification-description {
                font-size: 13px;
                color: #605e5c;
                margin: 0 0 12px 0;
                line-height: 1.4;
            }

            .notification-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .notification-action {
                background: #0078d4;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-size: 12px;
                cursor: pointer;
                font-weight: 500;
                transition: background-color 0.2s;
            }

            .notification-action:hover {
                background: #106ebe;
            }

            .notification-action.secondary {
                background: transparent;
                color: #0078d4;
                border: 1px solid #0078d4;
            }

            .notification-action.secondary:hover {
                background: #f3f9ff;
            }

            .notification-technical {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #edebe9;
                font-size: 11px;
                color: #605e5c;
                font-family: 'Courier New', monospace;
                background: #faf9f8;
                padding: 8px;
                border-radius: 4px;
                word-break: break-all;
            }

            .progress-container {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10001;
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                padding: 24px;
                min-width: 300px;
                text-align: center;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.3);
                z-index: 10000;
            }

            .progress-title {
                font-size: 16px;
                font-weight: 600;
                color: #323130;
                margin: 0 0 8px 0;
            }

            .progress-message {
                font-size: 14px;
                color: #605e5c;
                margin: 0 0 16px 0;
            }

            .progress-bar {
                width: 100%;
                height: 8px;
                background: #edebe9;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 12px;
            }

            .progress-fill {
                height: 100%;
                background: #0078d4;
                transition: width 0.3s ease;
                border-radius: 4px;
            }

            .progress-details {
                font-size: 12px;
                color: #605e5c;
                margin-top: 8px;
            }

            .spinner {
                border: 3px solid #edebe9;
                border-top: 3px solid #0078d4;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px auto;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            .notification-slide-out {
                animation: slideOut 0.3s ease-in forwards;
            }

            .teams-notification .error-icon::before {
                content: "⚠️";
                margin-right: 8px;
            }

            .teams-notification.warning .error-icon::before {
                content: "⚠️";
                margin-right: 8px;
            }

            .teams-notification.success .error-icon::before {
                content: "✅";
                margin-right: 8px;
            }

            .teams-notification.critical .error-icon::before {
                content: "🚨";
                margin-right: 8px;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = 'teams-transcript-feedback-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * Create notification and progress containers
     */
    createContainers() {
        if (!this.isBrowser) return;
        
        // Create notification container
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'teams-feedback-container';
        this.notificationContainer.id = 'teams-notification-container';
        document.body.appendChild(this.notificationContainer);
    }

    /**
     * Show error notification from error handler result
     * @param {Object} errorResult - Result from errorHandler.handleError()
     * @param {Object} options - Display options
     */
    showErrorNotification(errorResult, options = {}) {
        const {
            autoClose = true,
            closeDelay = 10000,
            showTechnicalDetails = false
        } = options;

        const { error, userMessage, actions } = errorResult;

        const notification = {
            id: errorResult.errorId || this.generateId(),
            type: error.severity,
            title: userMessage.title,
            description: userMessage.description,
            actions: actions,
            technicalDetails: showTechnicalDetails ? userMessage.technicalDetails : null,
            autoClose,
            closeDelay
        };

        this.showNotification(notification);
    }

    /**
     * Show custom notification
     * @param {Object} notification - Notification configuration
     */
    showNotification(notification) {
        if (!this.isBrowser) {
            // In Node.js environment, just log the notification
            console.log(`[UserFeedbackUI] ${notification.type}: ${notification.title} - ${notification.description}`);
            return this.generateId();
        }
        
        const {
            id = this.generateId(),
            type = 'info',
            title,
            description,
            actions = [],
            technicalDetails = null,
            autoClose = true,
            closeDelay = 5000
        } = notification;

        // Remove existing notification with same ID
        this.hideNotification(id);

        const notificationElement = this.createNotificationElement({
            id,
            type,
            title,
            description,
            actions,
            technicalDetails
        });

        this.notificationContainer.appendChild(notificationElement);
        this.activeNotifications.set(id, notificationElement);

        // Auto-close if requested
        if (autoClose) {
            setTimeout(() => {
                this.hideNotification(id);
            }, closeDelay);
        }

        return id;
    }

    /**
     * Create notification DOM element
     */
    createNotificationElement(config) {
        const { id, type, title, description, actions, technicalDetails } = config;

        const notification = document.createElement('div');
        notification.className = `teams-notification ${type}`;
        notification.setAttribute('data-notification-id', id);

        // Header with title and close button
        const header = document.createElement('div');
        header.className = 'notification-header';

        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        titleElement.innerHTML = `<span class="error-icon"></span>${title}`;

        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.hideNotification(id);

        header.appendChild(titleElement);
        header.appendChild(closeButton);

        // Description
        const descriptionElement = document.createElement('div');
        descriptionElement.className = 'notification-description';
        descriptionElement.textContent = description;

        // Actions
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'notification-actions';

        actions.forEach(action => {
            const button = document.createElement('button');
            button.className = `notification-action ${action.primary ? 'primary' : 'secondary'}`;
            button.textContent = action.label;
            button.onclick = () => {
                try {
                    action.action();
                } catch (error) {
                    console.error('Error executing action:', error);
                }
            };
            actionsContainer.appendChild(button);
        });

        // Technical details (if enabled)
        let technicalElement = null;
        if (technicalDetails) {
            technicalElement = document.createElement('div');
            technicalElement.className = 'notification-technical';
            technicalElement.textContent = technicalDetails;
        }

        // Assemble notification
        notification.appendChild(header);
        notification.appendChild(descriptionElement);
        if (actions.length > 0) {
            notification.appendChild(actionsContainer);
        }
        if (technicalElement) {
            notification.appendChild(technicalElement);
        }

        return notification;
    }

    /**
     * Hide notification by ID
     */
    hideNotification(id) {
        const notification = this.activeNotifications.get(id);
        if (notification) {
            notification.classList.add('notification-slide-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.activeNotifications.delete(id);
            }, 300);
        }
    }

    /**
     * Clear all notifications
     */
    clearAllNotifications() {
        this.activeNotifications.forEach((notification, id) => {
            this.hideNotification(id);
        });
    }

    /**
     * Show progress dialog
     * @param {Object} config - Progress configuration
     */
    showProgress(config = {}) {
        if (!this.isBrowser) {
            // In Node.js environment, just log progress
            console.log(`[UserFeedbackUI] Progress: ${config.title || 'Processing...'} - ${config.message || 'Please wait...'}`);
            return;
        }
        
        const {
            title = 'Processing...',
            message = 'Please wait...',
            progress = null, // 0-100 or null for indeterminate
            details = null,
            cancellable = false,
            onCancel = null
        } = config;

        // Remove existing progress
        this.hideProgress();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'progress-overlay';
        overlay.id = 'teams-progress-overlay';

        // Create progress container
        const container = document.createElement('div');
        container.className = 'progress-container';
        container.id = 'teams-progress-container';

        // Spinner or progress bar
        if (progress === null) {
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            container.appendChild(spinner);
        } else {
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
            
            progressBar.appendChild(progressFill);
            container.appendChild(progressBar);
        }

        // Title
        const titleElement = document.createElement('div');
        titleElement.className = 'progress-title';
        titleElement.textContent = title;
        container.appendChild(titleElement);

        // Message
        const messageElement = document.createElement('div');
        messageElement.className = 'progress-message';
        messageElement.textContent = message;
        container.appendChild(messageElement);

        // Details
        if (details) {
            const detailsElement = document.createElement('div');
            detailsElement.className = 'progress-details';
            detailsElement.textContent = details;
            container.appendChild(detailsElement);
        }

        // Cancel button
        if (cancellable && onCancel) {
            const cancelButton = document.createElement('button');
            cancelButton.className = 'notification-action secondary';
            cancelButton.textContent = 'Cancel';
            cancelButton.onclick = () => {
                this.hideProgress();
                onCancel();
            };
            container.appendChild(cancelButton);
        }

        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this.progressContainer = overlay;
    }

    /**
     * Update progress dialog
     */
    updateProgress(updates = {}) {
        const container = document.getElementById('teams-progress-container');
        if (!container) return;

        if (updates.title) {
            const titleElement = container.querySelector('.progress-title');
            if (titleElement) titleElement.textContent = updates.title;
        }

        if (updates.message) {
            const messageElement = container.querySelector('.progress-message');
            if (messageElement) messageElement.textContent = updates.message;
        }

        if (updates.details) {
            let detailsElement = container.querySelector('.progress-details');
            if (!detailsElement) {
                detailsElement = document.createElement('div');
                detailsElement.className = 'progress-details';
                container.appendChild(detailsElement);
            }
            detailsElement.textContent = updates.details;
        }

        if (typeof updates.progress === 'number') {
            const progressFill = container.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = `${Math.max(0, Math.min(100, updates.progress))}%`;
            }
        }
    }

    /**
     * Hide progress dialog
     */
    hideProgress() {
        if (this.progressContainer) {
            this.progressContainer.remove();
            this.progressContainer = null;
        }
    }

    /**
     * Show success message
     */
    showSuccess(title, description, actions = []) {
        return this.showNotification({
            type: 'success',
            title,
            description,
            actions,
            autoClose: true,
            closeDelay: 3000
        });
    }

    /**
     * Show warning message
     */
    showWarning(title, description, actions = []) {
        return this.showNotification({
            type: 'warning',
            title,
            description,
            actions,
            autoClose: true,
            closeDelay: 5000
        });
    }

    /**
     * Show info message
     */
    showInfo(title, description, actions = []) {
        return this.showNotification({
            type: 'info',
            title,
            description,
            actions,
            autoClose: true,
            closeDelay: 4000
        });
    }

    /**
     * Create feedback callback for error handler
     */
    createErrorFeedbackCallback() {
        return (errorFeedback) => {
            this.showErrorNotification({
                errorId: errorFeedback.errorId,
                error: { severity: errorFeedback.type },
                userMessage: {
                    title: errorFeedback.message,
                    description: errorFeedback.details,
                    technicalDetails: errorFeedback.technicalDetails
                },
                actions: errorFeedback.actions
            }, {
                showTechnicalDetails: this.shouldShowTechnicalDetails()
            });
        };
    }

    /**
     * Create progress callback for operations
     */
    createProgressCallback() {
        let progressId = null;

        return (update) => {
            if (update.stage === 'complete') {
                this.hideProgress();
                return;
            }

            const config = {
                title: this.getProgressTitle(update.stage),
                message: update.message || 'Processing...',
                progress: update.total ? (update.current / update.total) * 100 : null,
                details: this.getProgressDetails(update)
            };

            if (progressId === null) {
                this.showProgress(config);
                progressId = 'active';
            } else {
                this.updateProgress(config);
            }
        };
    }

    /**
     * Get progress title based on stage
     */
    getProgressTitle(stage) {
        const titles = {
            'chunking': 'Processing Transcript',
            'combining': 'Combining Summaries',
            'generating': 'Generating Summary',
            'extracting': 'Extracting Transcript',
            'retry': 'Retrying Operation',
            'wait': 'Waiting...'
        };
        return titles[stage] || 'Processing...';
    }

    /**
     * Get progress details
     */
    getProgressDetails(update) {
        if (update.chunkInfo) {
            const { timeRange, speakers, tokenCount } = update.chunkInfo;
            return `Time: ${timeRange}, Speakers: ${speakers.length}, Tokens: ${tokenCount.toLocaleString()}`;
        }
        
        if (update.current && update.total) {
            return `${update.current} of ${update.total}`;
        }

        return null;
    }

    /**
     * Check if technical details should be shown
     */
    shouldShowTechnicalDetails() {
        return localStorage.getItem('debugMode') === 'true' ||
               chrome?.runtime?.getManifest?.()?.version?.includes('dev');
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return 'notification_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.clearAllNotifications();
        this.hideProgress();
        
        if (this.notificationContainer) {
            this.notificationContainer.remove();
        }
        
        const styles = document.getElementById('teams-transcript-feedback-styles');
        if (styles) {
            styles.remove();
        }
    }
}

// Create singleton instance
const userFeedbackUI = new UserFeedbackUI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UserFeedbackUI, userFeedbackUI };
} else {
    // Browser environment - attach to window
    window.UserFeedbackUI = UserFeedbackUI;
    window.userFeedbackUI = userFeedbackUI;
}