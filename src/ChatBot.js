class ChatBot {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        // Auto-detect environment for baseUrl
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('127.0.0.1');

        const defaultBaseUrl = isLocalhost ?
            'http://localhost:3000/api/scrape' :
            'https://chat-backend-12wo.onrender.com/api/scrape';

        this.baseUrl = options.baseUrl || defaultBaseUrl;
        this.isOpen = false;
        this.currentFileId = null;
        this.chatHistory = [];
        this.selectedFileId = null;
        this.selectedSiteName = null;
        this.websiteTheme = null;

        // Configuration options - will be loaded from API
        this.options = {
            position: 'bottom-right', // Default, will be overridden by API
            theme: 'default',
            themeStyle: 'auto', // Will be determined by API
            title: 'ChatFlow AI Assistant',
            placeholder: 'Ask me anything about this website...',
            preselectedSite: null,
            ...options
        };

        this.init();

        // Set up periodic refresh to check for configuration changes
        this.setupConfigRefresh();

        // Add global method for manual refresh
        window.ChatFlowRefresh = () => {
            console.log('🔄 Manual refresh triggered');
            this.refreshConfiguration();
        };
    }

    setupConfigRefresh() {
        // Check for configuration updates every 2 seconds for faster response
        this.configRefreshInterval = setInterval(async () => {
            try {
                await this.refreshConfiguration();
            } catch (error) {
                console.warn('Config refresh failed:', error);
            }
        }, 2000);

        // Also refresh when page becomes visible (user switches back to tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('🔄 Page visible, checking for config updates...');
                this.refreshConfiguration();
            }
        });

        // Refresh when window gains focus
        window.addEventListener('focus', () => {
            console.log('🔄 Window focused, checking for config updates...');
            this.refreshConfiguration();
        });
    }

    async refreshConfiguration() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`${this.baseUrl}/sdk-config?t=${timestamp}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            const data = await response.json();

            if (data.success && data.data) {
                const newConfig = data.data;

                // Check if configuration has changed
                const configChanged = this.hasConfigurationChanged(newConfig);

                if (configChanged) {
                    console.log('⚡ Configuration changed, updating chatbot immediately...');
                    await this.applyNewConfiguration(newConfig);

                    // Show brief notification to user
                    this.showUpdateNotification();
                }
            }
        } catch (error) {
            // Silently fail refresh attempts to avoid spam
            console.debug('Config refresh error:', error);
        }
    }

    hasConfigurationChanged(newConfig) {
        if (!this.sdkConfig) return true;

        // Check if selected website changed
        const oldWebsiteId = this.sdkConfig.selectedWebsite?.id;
        const newWebsiteId = newConfig.selectedWebsite?.id;

        if (oldWebsiteId !== newWebsiteId) {
            console.log('📝 Selected website changed:', oldWebsiteId, '->', newWebsiteId);
            return true;
        }

        // Check if theme choice changed
        const oldThemeChoice = this.sdkConfig.integration?.themeChoice;
        const newThemeChoice = newConfig.integration?.themeChoice;

        if (oldThemeChoice !== newThemeChoice) {
            console.log('🎨 Theme choice changed:', oldThemeChoice, '->', newThemeChoice);
            return true;
        }

        // Check if theme data changed (for website themes)
        if (newThemeChoice === 'website') {
            const oldThemeData = JSON.stringify(this.sdkConfig.themeData || {});
            const newThemeData = JSON.stringify(newConfig.themeData || {});

            if (oldThemeData !== newThemeData) {
                console.log('🎨 Theme data changed');
                return true;
            }
        }

        return false;
    }

    async applyNewConfiguration(newConfig) {
        // Store new configuration
        this.sdkConfig = newConfig;

        // Update all settings from new configuration
        if (newConfig.integration.customizations) {
            const customizations = newConfig.integration.customizations;

            // Update position if changed
            if (customizations.position && customizations.position !== this.options.position) {
                this.options.position = customizations.position;
                // Update widget position class
                this.widget.className = `chatbot-widget ${this.options.position}`;
                console.log('📍 Position updated to:', this.options.position);
            }

            // Update title if changed
            if (customizations.title && customizations.title !== this.options.title) {
                this.options.title = customizations.title;
                const titleElement = this.widget.querySelector('.chatbot-title');
                if (titleElement) {
                    titleElement.textContent = customizations.title;
                }
                console.log('📝 Title updated to:', this.options.title);
            }

            // Update placeholder if changed
            if (customizations.placeholder && customizations.placeholder !== this.options.placeholder) {
                this.options.placeholder = customizations.placeholder;
                const inputElement = this.widget.querySelector('#chatbot-input');
                if (inputElement && !inputElement.disabled) {
                    inputElement.placeholder = customizations.placeholder;
                }
                console.log('💬 Placeholder updated to:', this.options.placeholder);
            }
        }

        // Update theme settings
        if (newConfig.integration.themeChoice === 'website' && newConfig.themeData) {
            this.options.themeStyle = 'website';
            this.websiteTheme = newConfig.themeData;
        } else {
            this.options.themeStyle = 'default';
            this.websiteTheme = null;
        }

        // Update selected website
        if (newConfig.selectedWebsite) {
            this.currentFileId = newConfig.selectedWebsite.id;
            this.enableInput();
            this.clearChat();
            this.updateChatHeader(
                newConfig.selectedWebsite.displayName || newConfig.selectedWebsite.fileName,
                newConfig.selectedWebsite.url
            );
        } else if (newConfig.availableWebsites.length > 0) {
            const firstSite = newConfig.availableWebsites[0];
            this.currentFileId = firstSite.id;
            this.enableInput();
            this.clearChat();
            this.updateChatHeader(firstSite.displayName || firstSite.fileName, firstSite.url);
        } else {
            this.showNoSitesMessage();
        }

        // Re-apply styles with new theme
        this.createStyles();

        console.log('✅ Configuration updated successfully');
    }

    showUpdateNotification() {
        // Notification removed - silent updates
    }

    async init() {
        this.createStyles();
        this.createChatWidget();
        this.bindEvents();

        // Validate API key and load SDK configuration
        const isValidKey = await this.validateApiKey();
        if (isValidKey) {
            // Load complete SDK configuration from API
            await this.loadSdkConfiguration();
        } else {
            this.showApiKeyError();
        }
    }

    async validateApiKey() {
        try {
            const response = await fetch(`${this.baseUrl.replace('/scrape', '')}/auth/validate-api-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error validating API key:', error);
            return false;
        }
    }

    showApiKeyError() {
        const messages = this.widget.querySelector('#chatbot-messages');
        messages.innerHTML = `
            <div class="chatbot-message bot" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;">
                <strong>Invalid API Key</strong><br>
                The provided API key is invalid or has been revoked. Please check your integration settings and ensure you're using a valid API key.
            </div>
        `;

        // Disable input
        const input = this.widget.querySelector('#chatbot-input');
        const send = this.widget.querySelector('#chatbot-send');
        input.disabled = true;
        send.disabled = true;
        input.placeholder = 'Invalid API key - chatbot disabled';

        // Hide site selector
        const selector = this.widget.querySelector('#chatbot-site-selector');
        selector.style.display = 'none';
    }

    createStyles() {
        // Create CSS custom properties for theming
        const themeColors = this.getThemeColors();
        console.log('🎨 Creating styles with theme colors:', themeColors);

        const styles = `
            :root {
                --chatbot-primary: ${themeColors.primary};
                --chatbot-primary-dark: ${themeColors.primaryDark};
                --chatbot-primary-light: ${themeColors.primaryLight || themeColors.primary};
                --chatbot-secondary: ${themeColors.secondary};
                --chatbot-background: ${themeColors.background};
                --chatbot-text: ${themeColors.text};
                --chatbot-border: ${themeColors.border};
                --chatbot-button: ${themeColors.button || themeColors.primary};
                --chatbot-link: ${themeColors.link || themeColors.primary};
                --chatbot-accent: ${themeColors.accent || themeColors.primary};
                --chatbot-user-bg: ${themeColors.userBg};
                --chatbot-bot-bg: ${themeColors.botBg};
                --chatbot-header-bg: ${themeColors.headerBg || themeColors.primary};
                --chatbot-header-text: ${themeColors.headerText || '#ffffff'};
            }
            
            .chatbot-widget {
                position: fixed;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            }
            
            .chatbot-widget.bottom-right {
                bottom: 24px;
                right: 24px;
            }
            
            .chatbot-widget.bottom-left {
                bottom: 24px;
                left: 24px;
            }
            
            .chatbot-widget.top-right {
                top: 24px;
                right: 24px;
            }
            
            .chatbot-widget.top-left {
                top: 24px;
                left: 24px;
            }
            
            .chatbot-toggle {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--chatbot-primary) 0%, var(--chatbot-primary-dark) 100%);
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .chatbot-toggle:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            
            .chatbot-toggle svg {
                width: 24px;
                height: 24px;
                fill: white;
            }
            
            /* Hide toggle when chatbot is open */
            .chatbot-widget .chatbot-container.open ~ .chatbot-toggle {
                opacity: 0;
                visibility: hidden;
                transform: scale(0.8);
                pointer-events: none;
            }
            
            .chatbot-container {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 380px;
                height: 550px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                display: flex;
                flex-direction: column;
                opacity: 0;
                visibility: hidden;
                transform: translateY(20px);
                transition: all 0.3s ease;
                overflow: hidden;
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .chatbot-container.open {
                opacity: 1;
                visibility: visible;
                transform: translateY(0) scale(1);
            }
            
            .chatbot-header {
                background: linear-gradient(135deg, var(--chatbot-header-bg) 0%, var(--chatbot-primary-dark) 100%);
                color: var(--chatbot-header-text);
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 16px 16px 0 0;
                position: relative;
            }
            
            .chatbot-title {
                font-weight: 600;
                font-size: 16px;
                color: var(--chatbot-header-text);
                text-align: center;
                flex: 1;
            }
            
            .chatbot-close {
                background: none;
                border: none;
                color: var(--chatbot-header-text);
                cursor: pointer;
                padding: 8px;
                border-radius: 6px;
                opacity: 0.9;
                transition: all 0.2s ease;
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
            }
            
            .chatbot-close:hover {
                background: rgba(255,255,255,0.2);
                opacity: 1;
                transform: translateY(-50%) scale(1.1);
            }
            
            .chatbot-messages {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #f8f9fa;
            }
            
            .chatbot-messages::-webkit-scrollbar {
                width: 6px;
            }
            
            .chatbot-messages::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .chatbot-messages::-webkit-scrollbar-thumb {
                background: #cbd5e0;
                border-radius: 3px;
            }
            
            .chatbot-messages::-webkit-scrollbar-thumb:hover {
                background: #a0aec0;
            }
            
            .chatbot-message {
                max-width: 75%;
                padding: 12px 16px;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.5;
                margin-bottom: 8px;
                position: relative;
            }
            
            .chatbot-message.user {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                align-self: flex-end;
                border-bottom-right-radius: 4px;
            }
            
            .chatbot-message.bot {
                background: white;
                color: #2d3748;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            }
            
            .bot-message-content {
                line-height: 1.5;
            }
            
            .bot-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--chatbot-text);
                margin: 8px 0 12px 0;
                padding-bottom: 6px;
                border-bottom: 2px solid var(--chatbot-primary);
            }
            
            .bot-header {
                font-size: 14px;
                font-weight: 600;
                color: var(--chatbot-text);
                margin: 12px 0 8px 0;
            }
            
            .bot-bullet {
                margin: 4px 0;
                padding-left: 8px;
                color: var(--chatbot-text);
            }
            
            .bot-numbered {
                margin: 4px 0;
                padding-left: 8px;
                color: var(--chatbot-text);
                font-weight: 500;
            }
            
            .bot-message-content strong {
                color: var(--chatbot-text);
                font-weight: 600;
            }
            
            .bot-message-content br {
                line-height: 1.8;
            }
            
            .chatbot-input-container {
                padding: 16px;
                border-top: 1px solid var(--chatbot-border);
                display: flex;
                gap: 8px;
                background: white;
            }
            
            .chatbot-input {
                flex: 1;
                padding: 12px 16px;
                border: 1px solid #e2e8f0;
                border-radius: 24px;
                outline: none;
                font-size: 14px;
                background: white;
                color: #2d3748;
                resize: none;
                height: 20px;
                min-height: 20px;
                max-height: 20px;
                line-height: 1.2;
                font-family: inherit;
                overflow-y: auto;
                overflow-x: hidden;
                transition: all 0.3s ease;
            }
            
            .chatbot-input:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .chatbot-input:disabled {
                background: #f7fafc;
                cursor: not-allowed;
            }
            
            .chatbot-send {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .chatbot-send:hover:not(:disabled) {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            .chatbot-send:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .chatbot-send svg {
                width: 20px;
                height: 20px;
                fill: white;
            }
            
            .chatbot-loading-inline {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--chatbot-text);
                font-size: 14px;
                opacity: 0.8;
            }
            
            .chatbot-loading-dots {
                display: flex;
                gap: 4px;
            }
            
            .chatbot-loading-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #cbd5e0;
                animation: typing 1.4s infinite;
            }
            
            .chatbot-loading-dot:nth-child(1) { animation-delay: 0s; }
            .chatbot-loading-dot:nth-child(2) { animation-delay: 0.2s; }
            .chatbot-loading-dot:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                }
                30% {
                    transform: translateY(-10px);
                }
            }
            
            .chatbot-status {
                padding: 8px 16px;
                background: #e3f2fd;
                color: #1976d2;
                font-size: 12px;
                text-align: center;
            }
            
            .chatbot-website-info {
                padding: 12px 16px;
                background: white;
                border-bottom: 1px solid var(--chatbot-border);
                font-size: 12px;
            }
            
            .website-link-container {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .website-label {
                color: var(--chatbot-text);
                opacity: 0.7;
                font-weight: 500;
            }
            
            .website-link {
                color: var(--chatbot-primary);
                text-decoration: none;
                font-weight: 500;
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .website-link:hover {
                text-decoration: underline;
            }
            
            .chatbot-site-subtitle {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.9);
                margin-top: 2px;
                font-weight: 400;
            }
            
            /* Responsive Design */
            @media (max-width: 480px) {
                .chatbot-container {
                    width: calc(100vw - 32px);
                    height: calc(100vh - 140px);
                    right: 16px;
                    bottom: 90px;
                }
                
                .chatbot-toggle {
                    right: 16px;
                    bottom: 16px;
                }
            }
        `;

        // Remove existing chatbot styles
        const existingStyles = document.getElementById('chatbot-styles');
        if (existingStyles) {
            existingStyles.remove();
        }

        const styleSheet = document.createElement('style');
        styleSheet.id = 'chatbot-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        console.log('✅ Styles applied successfully');
    }

    updateStyles() {
        // Update styles with current theme
        console.log('🔄 Updating styles with new theme...');
        this.createStyles();
    }

    createChatWidget() {
        const widget = document.createElement('div');
        widget.className = `chatbot-widget ${this.options.position}`;
        widget.innerHTML = `
            <button class="chatbot-toggle" id="chatbot-toggle">
                <svg viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
            </button>
            
            <div class="chatbot-container" id="chatbot-container">
                <div class="chatbot-header">
                    <div class="chatbot-title">${this.options.title}</div>
                    <button class="chatbot-close" id="chatbot-close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                
                <div class="chatbot-website-info" id="chatbot-website-info">
                    <div class="website-link-container">
                        <span class="website-label">Chatting with:</span>
                        <a href="#" class="website-link" id="website-link" target="_blank">No website selected</a>
                    </div>
                </div>
                
                <div class="chatbot-messages" id="chatbot-messages">
                    <div class="chatbot-message bot">
                        Hi! I'm your AI assistant. I'll help you with information from your scraped websites.
                    </div>
                </div>
                
                <div class="chatbot-input-container">
                    <textarea class="chatbot-input" id="chatbot-input" placeholder="${this.options.placeholder}" disabled rows="1"></textarea>
                    <button class="chatbot-send" id="chatbot-send" disabled>
                        <svg viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(widget);
        this.widget = widget;
    }

    bindEvents() {
        const toggle = this.widget.querySelector('#chatbot-toggle');
        const close = this.widget.querySelector('#chatbot-close');
        const input = this.widget.querySelector('#chatbot-input');
        const send = this.widget.querySelector('#chatbot-send');

        toggle.addEventListener('click', () => this.toggleChat());
        close.addEventListener('click', () => this.closeChat());
        send.addEventListener('click', () => this.sendMessage());

        // Remove auto-resize - keep fixed height with scroll

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const container = this.widget.querySelector('#chatbot-container');
        container.classList.toggle('open', this.isOpen);
    }

    closeChat() {
        this.isOpen = false;
        const container = this.widget.querySelector('#chatbot-container');
        container.classList.remove('open');
    }





    enableInput() {
        const input = this.widget.querySelector('#chatbot-input');
        const send = this.widget.querySelector('#chatbot-send');

        input.disabled = false;
        send.disabled = false;
        input.placeholder = this.options.placeholder || 'Ask me anything about this website...';
        input.focus();
    }

    async sendMessage() {
        const input = this.widget.querySelector('#chatbot-input');
        const message = input.value.trim();

        if (!message || !this.currentFileId) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        input.value = '';

        // Keep fixed height - no resizing

        // Show loading
        this.showLoading();

        try {
            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({
                    fileId: this.currentFileId,
                    message: message
                })
            });

            const data = await response.json();

            this.hideLoading();

            if (data.success) {
                this.addMessage(data.data.response, 'bot');
            } else {
                this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideLoading();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
    }

    addMessage(text, sender) {
        const messages = this.widget.querySelector('#chatbot-messages');
        const message = document.createElement('div');
        message.className = `chatbot-message ${sender}`;

        if (sender === 'bot') {
            // Format bot messages with better styling
            message.innerHTML = this.formatBotMessage(text);
        } else {
            // User messages remain as plain text
            message.textContent = text;
        }

        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;

        this.chatHistory.push({ text, sender, timestamp: new Date() });
    }

    formatBotMessage(text) {
        // Clean up the text and format it properly
        let formattedText = text
            // Remove excessive whitespace and line breaks
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // Format headers (process before bold to avoid conflicts)
            .replace(/^## (.+)$/gm, '<div class="bot-header">$1</div>')
            .replace(/^# (.+)$/gm, '<div class="bot-title">$1</div>')
            // Format bold text (process before bullet points to avoid ** being caught as bullets)
            .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
            // Format bullet points (only match single * at start of line)
            .replace(/^\* (.+)$/gm, '<div class="bot-bullet">• $1</div>')
            // Format numbered lists
            .replace(/^(\d+)\. (.+)$/gm, '<div class="bot-numbered">$1. $2</div>')
            // Convert line breaks to proper spacing
            .replace(/\n/g, '<br>');

        // Wrap in a container for better styling
        return `<div class="bot-message-content">${formattedText}</div>`;
    }

    showLoading() {
        const messages = this.widget.querySelector('#chatbot-messages');
        const loading = document.createElement('div');
        loading.className = 'chatbot-message bot';
        loading.id = 'chatbot-loading';
        loading.innerHTML = `
            <div class="bot-message-content">
                <div class="chatbot-loading-inline">
                    <span>AI is thinking</span>
                    <div class="chatbot-loading-dots">
                        <div class="chatbot-loading-dot"></div>
                        <div class="chatbot-loading-dot"></div>
                        <div class="chatbot-loading-dot"></div>
                    </div>
                </div>
            </div>
        `;

        messages.appendChild(loading);
        messages.scrollTop = messages.scrollHeight;
    }

    hideLoading() {
        const loading = this.widget.querySelector('#chatbot-loading');
        if (loading) {
            loading.remove();
        }
    }

    async loadScrapedSites() {
        try {
            const response = await fetch(`${this.baseUrl.replace('/scrape', '')}/scrape/files`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            const data = await response.json();

            if (data.success && data.data.length > 0) {
                // Store all available sites
                this.availableSites = data.data;

                let selectedSite = null;

                // Check if a preselected site is specified
                if (this.options.preselectedSite) {
                    // Try to find the site by URL first
                    selectedSite = data.data.find(site =>
                        site.url === this.options.preselectedSite ||
                        site.id === this.options.preselectedSite ||
                        site.fileName.includes(this.options.preselectedSite)
                    );

                    if (selectedSite) {
                        console.log('Found preselected site:', selectedSite.displayName || selectedSite.fileName);
                    } else {
                        console.warn('Preselected site not found:', this.options.preselectedSite);
                    }
                }

                // If no preselected site found, use the first available site
                if (!selectedSite) {
                    selectedSite = data.data[0];
                    console.log('Using first available site:', selectedSite.displayName || selectedSite.fileName);
                }

                // Select the determined site
                await this.selectSite(selectedSite.id, selectedSite.displayName || selectedSite.fileName, selectedSite.url);

            } else {
                // No sites available - show error message
                this.showNoSitesMessage();
            }
        } catch (error) {
            console.error('Error loading scraped sites:', error);
            this.showNoSitesMessage();
        }
    }

    showNoSitesMessage() {
        // Display simple error message in chat area
        const messagesContainer = this.widget.querySelector('#chatbot-messages');
        messagesContainer.innerHTML = `
            <div class="chatbot-message bot">
                <div class="bot-message-content">
                    <div class="bot-title">No websites available</div>
                    <p>No scraped websites found for this API key. Please scrape some websites first using the dashboard.</p>
                </div>
            </div>
        `;

        // Disable chat input
        const input = this.widget.querySelector('#chatbot-input');
        const sendButton = this.widget.querySelector('#chatbot-send');
        if (input) {
            input.disabled = true;
            input.placeholder = 'No websites available for chat';
        }
        if (sendButton) {
            sendButton.disabled = true;
        }
    }



    async selectSite(fileId, siteName, siteUrl) {
        // Directly apply site selection without any UI interactions
        console.log('🎯 Selecting site:', siteName, 'with fileId:', fileId);
        this.currentFileId = fileId;
        this.enableInput();

        // Clear chat history when switching sites
        this.clearChat();

        // Update header to show selected site
        this.updateChatHeader(siteName, siteUrl);

        // Auto-detect and load theme
        console.log('🔄 Starting theme auto-detection...');
        await this.autoDetectAndLoadTheme(fileId);
        console.log('✅ Theme auto-detection completed');
    }

    updateChatHeader(siteName, siteUrl) {
        // Update the website info section to show which site is being used
        const websiteLink = this.widget.querySelector('#website-link');
        if (websiteLink) {
            websiteLink.textContent = siteUrl || siteName;
            websiteLink.href = siteUrl || '#';
        }
    }

    clearChat() {
        const messages = this.widget.querySelector('#chatbot-messages');
        const welcomeMessage = this.currentFileId ?
            "Hi! I'm ready to answer questions about the selected website. How can I help you?" :
            "Hi! I'm your AI assistant. Please select a website from the dropdown above to start chatting about its content.";

        messages.innerHTML = `
            <div class="chatbot-message bot">
                ${welcomeMessage}
            </div>
        `;
        this.chatHistory = [];
    }

    // Public API methods
    open() {
        this.isOpen = true;
        const container = this.widget.querySelector('#chatbot-container');
        container.classList.add('open');
    }

    close() {
        this.closeChat();
    }

    destroy() {
        // Clear refresh interval
        if (this.configRefreshInterval) {
            clearInterval(this.configRefreshInterval);
        }

        if (this.widget) {
            this.widget.remove();
        }
    }

    // Load complete SDK configuration from API
    async loadSdkConfiguration() {
        try {
            console.log('🔧 Loading SDK configuration from API...');

            // Add cache-busting timestamp to ensure fresh data
            const timestamp = new Date().getTime();
            const response = await fetch(`${this.baseUrl}/sdk-config?t=${timestamp}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            const data = await response.json();
            console.log('📊 SDK Config Response:', data);

            if (data.success && data.data) {
                const config = data.data;

                // Store configuration
                this.sdkConfig = config;

                // Apply all settings from API configuration
                console.log('🔧 Applying configuration from API...');

                // Set position from API integration settings
                if (config.integration.customizations && config.integration.customizations.position) {
                    this.options.position = config.integration.customizations.position;
                    console.log('📍 Position set from API:', this.options.position);
                }

                // Set title from API integration settings
                if (config.integration.customizations && config.integration.customizations.title) {
                    this.options.title = config.integration.customizations.title;
                    console.log('📝 Title set from API:', this.options.title);
                }

                // Set placeholder from API integration settings
                if (config.integration.customizations && config.integration.customizations.placeholder) {
                    this.options.placeholder = config.integration.customizations.placeholder;
                    console.log('💬 Placeholder set from API:', this.options.placeholder);
                }

                // Set theme based on API configuration
                if (config.integration.themeChoice === 'website' && config.themeData) {
                    console.log('✅ Using website theme from API');
                    this.options.themeStyle = 'website';
                    this.websiteTheme = config.themeData;
                } else {
                    console.log('🎨 Using default theme from API');
                    this.options.themeStyle = 'default';
                }

                // Set selected website
                if (config.selectedWebsite) {
                    console.log('🎯 User selected website:', config.selectedWebsite.displayName || config.selectedWebsite.fileName);
                    this.currentFileId = config.selectedWebsite.id;
                    this.enableInput();
                    this.clearChat();
                    this.updateChatHeader(config.selectedWebsite.displayName || config.selectedWebsite.fileName, config.selectedWebsite.url);
                } else if (config.availableWebsites.length > 0) {
                    console.log('📝 No website selected, using first available');
                    const firstSite = config.availableWebsites[0];
                    this.currentFileId = firstSite.id;
                    this.enableInput();
                    this.clearChat();
                    this.updateChatHeader(firstSite.displayName || firstSite.fileName, firstSite.url);
                } else {
                    console.log('⚠️ No websites available');
                    this.showNoSitesMessage();
                }

                // Apply theme styles
                this.createStyles();

            } else {
                console.error('❌ Failed to load SDK configuration');
                this.showNoSitesMessage();
            }

        } catch (error) {
            console.error('❌ Error loading SDK configuration:', error);
            this.showNoSitesMessage();
        }
    }

    // Theme management methods
    getThemeColors() {
        // If website theme is loaded and available, use it
        if (this.options.themeStyle === 'website' && this.websiteTheme && this.websiteTheme.colors) {
            console.log('🎨 Applying website theme colors:', this.websiteTheme.colors);

            const colors = this.websiteTheme.colors;

            // Validate that we have a meaningful primary color
            const hasValidPrimary = colors.primary && this.isWebsiteSpecificColor(colors.primary);

            if (!hasValidPrimary) {
                console.warn('⚠️ Website theme has invalid primary color, falling back to default');
                return this.getDefaultThemeColors();
            }

            // Build comprehensive theme from extracted colors
            const themeColors = {
                // Primary colors from website
                primary: colors.primary,
                primaryDark: this.darkenColor(colors.primary, 20),
                primaryLight: this.lightenColor(colors.primary, 20),

                // Secondary colors - use extracted or derive from primary
                secondary: colors.secondary || this.adjustColorBrightness(colors.primary, -15),

                // Background and text colors
                background: colors.background || '#ffffff',
                text: colors.text || this.getContrastingTextColor(colors.background || '#ffffff'),

                // UI element colors
                border: colors.border || this.adjustColorBrightness(colors.background || '#ffffff', -8),
                button: colors.button || colors.primary,
                link: colors.link || colors.primary,
                accent: colors.accent || colors.primary,

                // Chat-specific colors
                userBg: colors.primary,
                botBg: this.generateBotBackgroundColor(colors),
                headerBg: colors.primary,
                headerText: this.getContrastingTextColor(colors.primary)
            };

            console.log('🎯 Generated theme colors:', themeColors);

            // Apply accessibility enhancements
            return this.ensureAccessibleColors(themeColors);
        }

        // Default theme colors
        return this.getDefaultThemeColors();
    }

    getDefaultThemeColors() {
        console.log('🎨 Using default gradient theme colors');
        return {
            primary: '#667eea',
            primaryDark: '#764ba2',
            primaryLight: '#7c8bf0',
            secondary: '#f093fb',
            background: '#f8f9fa',
            text: '#2d3748',
            border: '#e2e8f0',
            button: '#667eea',
            link: '#667eea',
            accent: '#764ba2',
            userBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            botBg: '#ffffff',
            headerBg: '#667eea',
            headerText: '#ffffff'
        };
    }

    isWebsiteSpecificColor(color) {
        if (!color) return false;

        const normalizedColor = color.toLowerCase().trim();

        // List of generic/default colors that shouldn't be used as brand colors
        const genericColors = [
            '#ffffff', '#fff', 'white',
            '#000000', '#000', 'black',
            '#333333', '#333',
            '#666666', '#666',
            '#999999', '#999',
            '#cccccc', '#ccc',
            '#f0f0f0', '#f5f5f5', '#fafafa',
            '#007bff', '#0056b3', '#0d6efd', // Bootstrap blues
            '#dc3545', '#28a745', '#ffc107', // Bootstrap semantic colors
            '#17a2b8', '#6c757d', '#343a40', // Bootstrap grays
            '#667eea', '#764ba2' // Common gradient colors
        ];

        // Check if it's a generic color
        if (genericColors.includes(normalizedColor)) {
            return false;
        }

        // Check if it's too light or too dark
        if (this.isColorTooLight(normalizedColor) || this.isColorTooDark(normalizedColor)) {
            return false;
        }

        // Check if it has sufficient saturation (not grayscale)
        return this.hasGoodSaturation(normalizedColor);
    }

    isColorTooLight(color) {
        const hex = color.replace('#', '');
        if (hex.length !== 6) return false;

        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.9; // Too light if luminance > 90%
    }

    isColorTooDark(color) {
        const hex = color.replace('#', '');
        if (hex.length !== 6) return false;

        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.1; // Too dark if luminance < 10%
    }

    hasGoodSaturation(color) {
        const hex = color.replace('#', '');
        if (hex.length !== 6) return false;

        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Calculate saturation
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;

        return saturation > 0.15; // Good saturation if > 15%
    }

    generateBotBackgroundColor(colors) {
        // Create a subtle bot background based on the website's colors
        if (colors.secondary && colors.secondary !== colors.primary) {
            // Use secondary color if available and different
            return this.lightenColor(colors.secondary, 60);
        } else if (colors.primary) {
            // Create a very light version of primary color
            return this.lightenColor(colors.primary, 75);
        }
        return '#f1f3f5'; // Default light gray
    }

    getContrastingTextColor(backgroundColor) {
        // Determine if white or dark text should be used on the background
        return this.isLightColor(backgroundColor) ? '#ffffff' : '#2d3748';
    }

    // Ensure color combinations meet accessibility standards
    ensureAccessibleColors(colors) {
        // Check contrast between background and text
        if (this.isLightColor(colors.background) && this.isLightColor(colors.text)) {
            colors.text = '#2d3748'; // Dark text for light background
        } else if (this.isDarkColor(colors.background) && this.isDarkColor(colors.text)) {
            colors.text = '#f7fafc'; // Light text for dark background
        }

        // Ensure bot background has sufficient contrast with text
        if (this.isLightColor(colors.botBg) && this.isLightColor(colors.text)) {
            colors.botBg = '#f8f9fa'; // Light gray for better contrast
        } else if (this.isDarkColor(colors.botBg) && this.isDarkColor(colors.text)) {
            colors.botBg = '#e2e8f0'; // Light gray for better contrast
        }

        // Ensure primary color is not too similar to background
        if (this.isColorTooSimilar(colors.primary, colors.background)) {
            colors.primary = this.isLightColor(colors.background) ? '#4299e1' : '#63b3ed';
        }

        return colors;
    }

    isLightColor(color) {
        if (!color || color === 'transparent') return true;

        // Simple brightness check based on hex color
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 155;
        }

        return true; // Default to light if can't determine
    }

    isDarkColor(color) {
        return !this.isLightColor(color);
    }

    isColorTooSimilar(color1, color2) {
        // Simple similarity check - in production, you'd use more sophisticated color difference algorithms
        if (!color1 || !color2 || !color1.startsWith('#') || !color2.startsWith('#')) {
            return false;
        }

        const hex1 = color1.slice(1);
        const hex2 = color2.slice(1);

        const r1 = parseInt(hex1.substr(0, 2), 16);
        const g1 = parseInt(hex1.substr(2, 2), 16);
        const b1 = parseInt(hex1.substr(4, 2), 16);

        const r2 = parseInt(hex2.substr(0, 2), 16);
        const g2 = parseInt(hex2.substr(2, 2), 16);
        const b2 = parseInt(hex2.substr(4, 2), 16);

        const distance = Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2));
        return distance < 100; // Colors are too similar if distance is less than 100
    }

    async autoDetectAndLoadTheme(fileId) {
        try {
            console.log('🔄 Auto-detecting and loading theme for fileId:', fileId);

            // Only attempt theme loading if themeStyle is set to 'website' or 'auto'
            if (this.options.themeStyle === 'default') {
                console.log('🎯 Theme style is set to default, skipping auto-detection');
                return false;
            }

            // Attempt to load website theme
            const themeLoaded = await this.loadWebsiteTheme(fileId);

            if (themeLoaded) {
                console.log('✅ Website theme auto-detected and applied successfully');
                this.options.themeStyle = 'website'; // Update to reflect successful theme loading
                return true;
            } else {
                console.log('⚠️ Website theme auto-detection failed, falling back to default');
                this.options.themeStyle = 'default'; // Fallback to default
                this.websiteTheme = null;
                this.createStyles(); // Re-apply styles with default theme
                return false;
            }
        } catch (error) {
            console.error('❌ Error in auto-detect theme:', error);
            this.options.themeStyle = 'default';
            this.websiteTheme = null;
            this.createStyles();
            return false;
        }
    }

    async loadWebsiteTheme(fileId) {
        try {
            console.log('🌐 Fetching theme data from API for fileId:', fileId);
            console.log('🔗 API URL:', `${this.baseUrl}/theme/${fileId}`);

            // Add cache-busting timestamp for fresh theme data
            const timestamp = new Date().getTime();
            const response = await fetch(`${this.baseUrl}/theme/${fileId}?t=${timestamp}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            console.log('📡 API Response status:', response.status);

            const data = await response.json();
            console.log('📊 API Response data:', data);

            if (data.success && data.data && data.data.colors) {
                // Always use theme data if available - remove strict validation
                this.websiteTheme = data.data;
                console.log('✅ Website theme loaded successfully:', this.websiteTheme);
                console.log('🎨 Extracted colors:', this.websiteTheme.colors);

                // Re-apply styles with new theme
                this.createStyles();
                return true;
            } else {
                console.warn('⚠️ No theme data available in API response');
                console.log('📋 Response details:', { success: data.success, hasData: !!data.data, hasColors: !!(data.data && data.data.colors) });
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading website theme:', error);
            return false;
        }
    }

    darkenColor(color, percent) {
        if (!color || !color.startsWith('#')) return color;

        const hex = color.slice(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        const factor = (100 - percent) / 100;
        const newR = Math.round(r * factor);
        const newG = Math.round(g * factor);
        const newB = Math.round(b * factor);

        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    lightenColor(color, percent) {
        if (!color || !color.startsWith('#')) return color;

        const hex = color.slice(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        const factor = percent / 100;
        const newR = Math.round(r + (255 - r) * factor);
        const newG = Math.round(g + (255 - g) * factor);
        const newB = Math.round(b + (255 - b) * factor);

        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }

    adjustColorBrightness(hex, percent) {
        if (!hex || !hex.startsWith('#')) return hex;

        // Remove # if present
        hex = hex.replace('#', '');

        // Parse r, g, b values
        const num = parseInt(hex, 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;

        return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
    }


}

export default ChatBot;