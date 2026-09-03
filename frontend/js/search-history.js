/**
 * QRCAD v2.0 - Search History Module
 * Tracks and manages search history with local storage
 */

const HISTORY_KEY = 'qrcad_search_history';
const MAX_HISTORY = 50; // Keep last 50 searches

export class SearchHistory {
    constructor() {
        this.history = this.loadHistory();
    }

    /**
     * Load search history from localStorage
     */
    loadHistory() {
        try {
            const stored = localStorage.getItem(HISTORY_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to load search history:', e);
            return [];
        }
    }

    /**
     * Save search history to localStorage
     */
    saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
        } catch (e) {
            console.error('Failed to save search history:', e);
        }
    }

    /**
     * Add a search to history
     * BUG 2 FIX: Store complete search metadata for "Open Again" functionality
     * @param {Object} search - { 
     *   queryFile, dataset, databaseName, timestamp, 
     *   topMatch, topSimilarity, allResults, retrievalSettings,
     *   queryFilePath (optional, for session restore)
     * }
     */
    addSearch(search) {
        const entry = {
            id: Date.now().toString(),
            queryFile: search.queryFile,                          // Filename only
            queryFilePath: search.queryFilePath || null,          // Full path for restore (session-only)
            dataset: search.dataset,                              // Database path
            databaseName: search.databaseName || null,            // Database display name
            timestamp: search.timestamp || new Date().toISOString(),
            topMatch: search.topMatch || null,                    // Top result filename
            topSimilarity: search.topSimilarity || null,          // Top result similarity score
            allResults: search.allResults || [],                  // All results for replay
            retrievalSettings: search.retrievalSettings || { top_k: 5 }  // Search parameters
        };

        // Add to beginning of array
        this.history.unshift(entry);

        // Keep only last MAX_HISTORY entries
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(0, MAX_HISTORY);
        }

        this.saveHistory();
        return entry;
    }

    /**
     * Get all history entries
     */
    getAll() {
        return this.history;
    }

    /**
     * Get recent history (last N entries)
     */
    getRecent(count = 10) {
        return this.history.slice(0, count);
    }

    /**
     * Clear all history
     */
    clear() {
        this.history = [];
        this.saveHistory();
    }

    /**
     * Remove a specific entry by ID
     */
    remove(id) {
        this.history = this.history.filter(entry => entry.id !== id);
        this.saveHistory();
    }

    /**
     * Search history by query filename
     */
    searchByFilename(filename) {
        return this.history.filter(entry => 
            entry.queryFile.toLowerCase().includes(filename.toLowerCase())
        );
    }

    /**
     * Get history for specific dataset
     */
    getByDataset(datasetPath) {
        return this.history.filter(entry => entry.dataset === datasetPath);
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
}
