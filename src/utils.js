// Utility functions for the ChatBot SDK

/**
 * Debounce function to limit the rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Whether to execute immediately
 * @returns {Function} Debounced function
 */
export function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * Throttle function to limit the rate of function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format timestamp to readable string
 * @param {Date|string|number} timestamp - Timestamp to format
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Sanitize HTML content to prevent XSS
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * Check if the current environment supports the required features
 * @returns {Object} Support status object
 */
export function checkSupport() {
    return {
        fetch: typeof fetch !== 'undefined',
        customElements: typeof customElements !== 'undefined',
        shadowDOM: typeof ShadowRoot !== 'undefined',
        es6: typeof Symbol !== 'undefined',
        localStorage: (() => {
            try {
                const test = '__test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        })()
    };
}

/**
 * Get viewport dimensions
 * @returns {Object} Viewport width and height
 */
export function getViewport() {
    return {
        width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
        height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
    };
}

/**
 * Check if device is mobile
 * @returns {boolean} True if mobile device
 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Create a simple event emitter
 * @returns {Object} Event emitter with on, off, and emit methods
 */
export function createEventEmitter() {
    const events = {};
    
    return {
        on(event, callback) {
            if (!events[event]) {
                events[event] = [];
            }
            events[event].push(callback);
        },
        
        off(event, callback) {
            if (events[event]) {
                events[event] = events[event].filter(cb => cb !== callback);
            }
        },
        
        emit(event, ...args) {
            if (events[event]) {
                events[event].forEach(callback => callback(...args));
            }
        }
    };
}

/**
 * Simple storage wrapper with fallback
 * @param {string} key - Storage key
 * @param {any} value - Value to store (optional)
 * @returns {any} Stored value or undefined
 */
export function storage(key, value) {
    try {
        if (value !== undefined) {
            localStorage.setItem(`chatbot_${key}`, JSON.stringify(value));
            return value;
        } else {
            const stored = localStorage.getItem(`chatbot_${key}`);
            return stored ? JSON.parse(stored) : undefined;
        }
    } catch (e) {
        console.warn('Storage not available:', e);
        return undefined;
    }
}

/**
 * Remove storage item
 * @param {string} key - Storage key to remove
 */
export function removeStorage(key) {
    try {
        localStorage.removeItem(`chatbot_${key}`);
    } catch (e) {
        console.warn('Storage not available:', e);
    }
}

/**
 * Simple HTTP client with error handling
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise} Response promise
 */
export async function httpClient(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error) {
        console.error('HTTP request failed:', error);
        throw error;
    }
}