// detectionService.js - Service for handling detection API calls and storage

class DetectionService {
    constructor() {
        this.API_BASE = '/api';
        this.STORAGE_KEY = 'detectionHistory';
    }

    // Get authentication token
    getAuthToken() {
        return localStorage.getItem('token');
    }

    // Get auth headers
    getAuthHeaders() {
        const token = this.getAuthToken();
        return {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        };
    }

    // Predict spam for a message
    async predictSpam(message, type = 'email') {
        const token = this.getAuthToken();
        const endpoint = token ? `${this.API_BASE}/predict` : `${this.API_BASE}/test-predict`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ message, type })
            });

            if (!response.ok) {
                if (response.status === 401 && token) {
                    // Token expired, remove it
                    localStorage.removeItem('token');
                    throw new Error('Authentication expired. Please log in again.');
                }
                throw new Error(`API request failed: ${response.status}`);
            }

            const result = await response.json();

            // Add metadata
            return {
                ...result,
                timestamp: new Date().toISOString(),
                originalMessage: message,
                type: type,
                id: result.id || `local_${Date.now()}`,
                source: result.saved_to_db ? 'api' : 'local'
            };
        } catch (error) {
            console.error('Prediction error:', error);

            // Fallback to local prediction
            return this.fallbackPrediction(message, type, error.message);
        }
    }

    // Fallback prediction when API is unavailable
    fallbackPrediction(message, type, errorMessage) {
        const spamKeywords = [
            'free', 'win', 'winner', 'cash', 'prize', 'urgent', 'offer',
            'limited', 'click', 'call now', 'guarantee', 'discount',
            'congratulation', 'lucky', 'selected', 'money', 'loan',
            'বিনামূল্যে', 'ফ্রি', 'জিতুন', 'পুরস্কার', 'টাকা', 'অফার',
            'gratis', 'ganar', 'dinero', 'premio', 'urgente', 'oferta'
        ];

        let spamScore = 0;
        const messageLC = message.toLowerCase();

        // Check for spam keywords
        spamKeywords.forEach(keyword => {
            if (messageLC.includes(keyword.toLowerCase())) {
                spamScore += 1;
            }
        });

        // Check for phone numbers
        if (/\b\d{3,}\b/.test(message)) {
            spamScore += 1;
        }

        // Check for URLs
        if (/http[s]?:\/\//.test(message)) {
            spamScore += 1;
        }

        const isSpam = spamScore >= 2;
        const confidence = isSpam ? 0.7 : 0.8;

        return {
            isSpam,
            confidence,
            message: isSpam ? 'Spam detected (offline mode)' : 'Not spam (offline mode)',
            language: 'unknown',
            indicators: {
                spam_keywords: spamScore,
                offline_mode: true,
                error: errorMessage
            },
            type,
            timestamp: new Date().toISOString(),
            originalMessage: message,
            id: `local_${Date.now()}`,
            source: 'local'
        };
    }

    // Get detection history from API
    async getDetectionHistory(limit = 50, offset = 0, spamOnly = null) {
        const token = this.getAuthToken();
        if (!token) {
            return { history: [], total: 0 };
        }

        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString()
            });

            if (spamOnly !== null) {
                params.append('spam_only', spamOnly.toString());
            }

            const response = await fetch(`${this.API_BASE}/messages/history?${params}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    throw new Error('Authentication expired');
                }
                throw new Error(`Failed to fetch history: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching history:', error);
            return { history: [], total: 0, error: error.message };
        }
    }

    // Get detection statistics from API
    async getDetectionStats() {
        const token = this.getAuthToken();
        if (!token) {
            return null;
        }

        try {
            const response = await fetch(`${this.API_BASE}/messages/stats`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    throw new Error('Authentication expired');
                }
                throw new Error(`Failed to fetch stats: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            return null;
        }
    }

    // Local storage operations
    saveToLocalStorage(detectionResult) {
        try {
            const history = this.getFromLocalStorage();
            const updatedHistory = [detectionResult, ...history].slice(0, 100); // Keep last 100
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedHistory));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    getFromLocalStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return [];
        }
    }

    clearLocalStorage() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }

    // Merge local and API history
    mergeHistory(apiHistory, localHistory) {
        const merged = [...apiHistory];

        // Add local items that aren't in API history
        localHistory.forEach(localItem => {
            const exists = apiHistory.some(apiItem => {
                // Check if it's the same message within a reasonable time window
                const timeDiff = Math.abs(
                    new Date(apiItem.timestamp) - new Date(localItem.timestamp)
                );
                return apiItem.message === localItem.originalMessage && timeDiff < 60000; // 1 minute window
            });

            if (!exists) {
                merged.push({
                    ...localItem,
                    source: 'local'
                });
            }
        });

        // Sort by timestamp (newest first) and limit
        return merged
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 100);
    }

    // Load complete history (merge API and local)
    async loadCompleteHistory() {
        try {
            const localHistory = this.getFromLocalStorage();
            const apiResult = await this.getDetectionHistory();

            if (apiResult.history && apiResult.history.length > 0) {
                const mergedHistory = this.mergeHistory(apiResult.history, localHistory);
                // Update localStorage with merged data
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mergedHistory));
                return mergedHistory;
            }

            return localHistory;
        } catch (error) {
            console.error('Error loading complete history:', error);
            return this.getFromLocalStorage();
        }
    }

    // Check API health
    async checkApiHealth() {
        try {
            const response = await fetch(`${this.API_BASE}/health`);
            if (response.ok) {
                return await response.json();
            }
            return { status: 'unhealthy', error: `HTTP ${response.status}` };
        } catch (error) {
            return { status: 'unavailable', error: error.message };
        }
    }

    // Utility to format confidence percentage
    formatConfidence(confidence) {
        return Math.round((confidence || 0) * 100);
    }

    // Utility to format timestamp
    formatTimestamp(timestamp, format = 'time') {
        try {
            const date = new Date(timestamp);
            switch (format) {
                case 'time':
                    return date.toLocaleTimeString();
                case 'date':
                    return date.toLocaleDateString();
                case 'datetime':
                    return date.toLocaleString();
                case 'relative':
                    return this.getRelativeTime(date);
                default:
                    return date.toLocaleTimeString();
            }
            // eslint-disable-next-line no-unused-vars
        } catch (error) {
            return 'Unknown';
        }
    }

    // Get relative time (e.g., "2 hours ago")
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    }

    // Generate statistics from history data
    generateStats(history) {
        if (!history || history.length === 0) {
            return null;
        }

        const totalScans = history.length;
        const totalSpam = history.filter(item => item.isSpam).length;
        const totalNonSpam = totalScans - totalSpam;

        const byPlatform = history.reduce((acc, item) => {
            const platform = item.type || 'email';
            if (!acc[platform]) {
                acc[platform] = { total: 0, spam: 0 };
            }
            acc[platform].total++;
            if (item.isSpam) {
                acc[platform].spam++;
            }
            return acc;
        }, {});

        const byLanguage = history.reduce((acc, item) => {
            const lang = item.language || 'unknown';
            if (!acc[lang]) {
                acc[lang] = { total: 0, spam: 0 };
            }
            acc[lang].total++;
            if (item.isSpam) {
                acc[lang].spam++;
            }
            return acc;
        }, {});

        return {
            totalScans,
            totalSpam,
            totalNonSpam,
            spamRate: totalScans > 0 ? ((totalSpam / totalScans) * 100).toFixed(1) : 0,
            byPlatform,
            byLanguage,
            avgConfidence: {
                spam: this.calculateAvgConfidence(history.filter(item => item.isSpam)),
                ham: this.calculateAvgConfidence(history.filter(item => !item.isSpam))
            }
        };
    }

    calculateAvgConfidence(items) {
        if (items.length === 0) return 0;
        const sum = items.reduce((acc, item) => acc + (item.confidence || 0), 0);
        return (sum / items.length).toFixed(2);
    }
}

// Create and export a singleton instance
const detectionService = new DetectionService();
export default detectionService;

// Usage example:
/*
import detectionService from './detectionService';

// Predict spam
const result = await detectionService.predictSpam("Free money!", "sms");

// Save to localStorage
detectionService.saveToLocalStorage(result);

// Load complete history
const history = await detectionService.loadCompleteHistory();

// Generate statistics
const stats = detectionService.generateStats(history);
*/