import ChatBot from './ChatBot.js';

// Auto-initialization function
function initializeChatBot() {
    // Find the script tag that loaded this SDK
    const scripts = document.querySelectorAll('script[data-api-key]');
    const currentScript = scripts[scripts.length - 1]; // Get the last script with data-api-key
    
    if (!currentScript) {
        console.error('ChatBot SDK: No script tag found with data-api-key attribute');
        return;
    }
    
    const apiKey = currentScript.getAttribute('data-api-key');
    
    if (!apiKey) {
        console.error('ChatBot SDK: API key is required. Add data-api-key="YOUR_API_KEY" to the script tag.');
        return;
    }
    
    console.log('🔧 Initializing ChatBot SDK with API-only configuration...');
    
    // Only get baseUrl from data attributes - everything else comes from API
    const config = {
        baseUrl: currentScript.getAttribute('data-base-url') || undefined
    };
    
    // Initialize the chatbot
    try {
        const chatbot = new ChatBot(apiKey, config);
        
        // Make chatbot globally accessible
        window.ChatFlowAI = chatbot;
        
        // Dispatch ready event
        const event = new CustomEvent('chatflow-ready', {
            detail: { chatbot }
        });
        document.dispatchEvent(event);
        
        console.log('ChatFlow AI SDK initialized successfully - all settings loaded from API');
    } catch (error) {
        console.error('ChatBot SDK: Failed to initialize:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChatBot);
} else {
    // DOM is already ready
    initializeChatBot();
}

// Export for manual initialization if needed
export { ChatBot, initializeChatBot };
export default ChatBot;

// Log initialization method
console.log('📦 ChatFlow AI SDK loaded - Configuration will be fetched from API');