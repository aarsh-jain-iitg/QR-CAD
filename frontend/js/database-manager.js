/**
 * QRCAD v2.0 - Database Manager
 * Handles database CRUD operations, cache validation, and recent database tracking.
 * Uses localStorage for persistence across sessions.
 */

const BACKEND = "http://127.0.0.1:5000";
const STORAGE_KEY = "qrcad_databases";
const RECENT_KEY = "qrcad_recent_databases";

export class DatabaseManager {
    constructor() {
        this.databases = this.loadDatabases();
        this.activeDatabase = this.loadActiveDatabase();
    }

    /**
     * Load databases from localStorage
     */
    loadDatabases() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Save databases to localStorage
     */
    saveDatabases() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.databases));
    }

    /**
     * Load the currently active database ID
     */
    loadActiveDatabase() {
        const stored = localStorage.getItem("qrcad_active_database");
        if (stored) {
            const db = this.databases.find(d => d.id === stored);
            return db || null;
        }
        return null;
    }

    /**
     * Set the active database
     */
    setActiveDatabase(id) {
        const db = this.databases.find(d => d.id === id);
        if (db) {
            this.activeDatabase = db;
            localStorage.setItem("qrcad_active_database", id);
            this.addToRecent(db);
            
            // Trigger callback if defined
            if (this.onDatabaseChange) {
                this.onDatabaseChange(db);
            }
        }
    }

    /**
     * Get the currently active database
     */
    getActiveDatabase() {
        return this.activeDatabase;
    }

    /**
     * Get all databases
     */
    getAllDatabases() {
        return this.databases;
    }

    /**
     * Get recent databases (last 5, most-recent-first)
     */
    getRecentDatabases() {
        const stored = localStorage.getItem(RECENT_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Add database to recent list (max 5)
     */
    addToRecent(db) {
        let recent = this.getRecentDatabases();
        
        // Remove if already exists
        recent = recent.filter(r => r.id !== db.id);
        
        // Add to front
        recent.unshift({
            id: db.id,
            name: db.name,
            path: db.path,
            timestamp: Date.now()
        });
        
        // Keep only 5
        recent = recent.slice(0, 5);
        
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    }

    /**
     * Add a new database from a folder path
     * Creates a persistent record with cache mapping
     */
    async addDatabase(folderPath) {
        const id = this.generateId();
        const name = this.extractFolderName(folderPath);
        
        const db = {
            id,
            name,
            path: folderPath,
            cacheExists: false,
            cacheValid: false,
            modelCount: 0,
            lastBuild: null,
            cacheFilePath: null,
            cachePathMapping: folderPath, // **PERSISTENCE: Map path to cache location for fast lookups**
            createdAt: Date.now()
        };
        
        this.databases.push(db);
        this.saveDatabases();
        
        // Validate cache immediately (synchronize with disk)
        await this.validateCacheStatus(db);
        this.saveDatabases();
        
        return db;
    }

    /**
     * Rename a database
     */
    renameDatabase(id, newName) {
        const db = this.databases.find(d => d.id === id);
        if (db) {
            db.name = newName;
            this.saveDatabases();
            return true;
        }
        return false;
    }

    /**
     * Delete a database (only removes from list, optionally deletes cache)
     */
    deleteDatabase(id, deleteCache = true) {
        const index = this.databases.findIndex(d => d.id === id);
        if (index !== -1) {
            if (deleteCache && this.databases[index].path) {
                this.deleteCache(this.databases[index].path);
            }
            
            this.databases.splice(index, 1);
            this.saveDatabases();
            
            // Clear active if it was the deleted one
            if (this.activeDatabase && this.activeDatabase.id === id) {
                this.activeDatabase = null;
                localStorage.removeItem("qrcad_active_database");
            }
            
            return true;
        }
        return false;
    }

    /**
     * Single source of truth: verify if cache is actually valid
     * This function ALWAYS checks the backend to ensure we're not relying on stale localStorage state
     */
    async _isCacheValidOnDisk(db) {
        try {
            const res = await fetch(`${BACKEND}/validate-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_path: db.path })
            });
            
            const data = await res.json();
            return data.valid === true;
        } catch (err) {
            console.error('[DatabaseManager] Cache disk validation error:', err);
            return false;
        }
    }

    /**
     * **7D: Lightweight validity check for cached databases
     * On app startup or when a database is selected, verify the cache still exists without full re-indexing
     * Returns true if cache files are found and match expectations
     */
    async _lightweightCacheValidityCheck(db) {
        try {
            const res = await fetch(`${BACKEND}/validate-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_path: db.path })
            });
            
            const data = await res.json();
            
            if (data.valid === true) {
                console.log(
                    `[DatabaseManager] Lightweight cache check for "${db.name}": ✓ PASS ` +
                    `(${data.model_count} models, last_indexed: ${data.last_indexed})`
                );
                return true;
            } else {
                console.log(
                    `[DatabaseManager] Lightweight cache check for "${db.name}": ✗ FAIL ` +
                    `(reason: ${data.reason || 'unknown'})`
                );
                return false;
            }
        } catch (err) {
            console.error('[DatabaseManager] Lightweight cache check error:', err);
            return false;
        }
    }

    /**
     * Validate cache status for a database
     * **Single source of truth**: Always checks backend to verify cache against actual files on disk
     * Returns validation result with complete metadata
     */
    async validateCacheStatus(db) {
        try {
            const res = await fetch(`${BACKEND}/validate-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_path: db.path })
            });
            
            const data = await res.json();
            
            // SINGLE SOURCE OF TRUTH: use backend response directly
            db.cacheValid = data.valid === true;
            db.cacheExists = data.valid === true; // Only true if valid (not just if last_indexed exists)
            db.modelCount = data.model_count || 0;
            // **BUG 4 FIX**: Ensure lastBuild is stored as ISO string for consistent formatting
            db.lastBuild = data.last_indexed ? new Date(parseInt(data.last_indexed)).toISOString() : null;
            db.cacheInvalidReason = data.reason;
            db.cacheFilePath = data.cache_file_path || null;
            
            // **PERSISTENCE**: Map the path to this cache for fast future lookups
            db.cachePathMapping = db.path;
            
            // Save updated state to localStorage immediately
            this.saveDatabases();
            
            console.log(
                `[DatabaseManager] Cache validation for "${db.name}": ${db.cacheValid ? '✓ valid' : '✗ invalid'} ` +
                `(${db.modelCount} models, path: ${db.path})`
            );
            
            return data;
        } catch (err) {
            console.error('[DatabaseManager] Cache validation error:', err);
            
            // Fallback: try basic cache status check
            try {
                const res = await fetch(`${BACKEND}/cache-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataset_path: db.path })
                });
                
                const status = await res.json();
                db.cacheExists = status.exists || false;
                db.modelCount = status.models || 0;
                db.cacheFilePath = status.cache_file_path || null;
                db.cacheValid = db.cacheExists; // Assume valid if it exists
                
                this.saveDatabases();
            } catch (e) {
                console.error('[DatabaseManager] Cache status fallback error:', e);
            }
            
            return null;
        }
    }

    /**
     * Update model count for a database
     */
    async updateModelCount(db) {
        try {
            const res = await fetch(`${BACKEND}/count-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_path: db.path })
            });
            
            const data = await res.json();
            db.modelCount = data.count || 0;
            this.saveDatabases();
            
            return db.modelCount;
        } catch (err) {
            console.error('[DatabaseManager] Model count error:', err);
            return db.modelCount || 0;
        }
    }

    /**
     * **BUG 4 FIX**: Format a timestamp for display
     * Expected input: ISO string or milliseconds timestamp
     * Returns: Formatted string like "28 Jun 2026\n4:31 PM"
     */
    formatLastBuildDate(timestamp) {
        if (!timestamp) return 'Never';
        
        try {
            // Handle both ISO strings and millisecond timestamps
            let date;
            if (typeof timestamp === 'string') {
                date = new Date(timestamp);
            } else if (typeof timestamp === 'number') {
                // Assume milliseconds if > 1e10, else seconds
                date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000);
            } else {
                return 'Never';
            }
            
            if (isNaN(date.getTime())) return 'Never';
            
            // Format: "28 Jun 2026" on first line, "4:31 PM" on second line
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[date.getMonth()];
            const day = date.getDate();
            const year = date.getFullYear();
            
            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            
            return `${day} ${month} ${year}\n${hours}:${minutes} ${ampm}`;
        } catch (e) {
            console.error('Date format error:', e);
            return 'Error';
        }
    }

    /**
     * Get cache status for a database path
     */
    async getCacheStatus(folderPath) {
        try {
            const res = await fetch(`${BACKEND}/cache-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_path: folderPath })
            });
            
            return await res.json();
        } catch (err) {
            console.error('[DatabaseManager] Cache status error:', err);
            return { exists: false, models: 0 };
        }
    }

    /**
     * Delete cache for a database
     */
    async deleteCache(folderPath) {
        try {
            const res = await fetch(`${BACKEND}/delete-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_path: folderPath })
            });
            
            const data = await res.json();
            return { success: data.success === true };
        } catch (err) {
            console.error('[DatabaseManager] Delete cache error:', err);
            return { success: false };
        }
    }

    /**
     * Clear database cache for a database by resetting its state
     */
    async clearDatabaseCache(id) {
        const db = this.databases.find(d => d.id === id);
        if (db) {
            // Reset cache-related fields
            db.cacheExists = false;
            db.cacheValid = false;
            db.modelCount = 0;
            db.lastBuild = null;
            db.cacheInvalidReason = null;
            
            // Optionally call backend to clear physical cache files
            if (db.path) {
                try {
                    await this.deleteCache(db.path);
                } catch (err) {
                    console.error('[DatabaseManager] Error clearing backend cache:', err);
                }
            }
            
            this.saveDatabases();
            return true;
        }
        return false;
    }

    /**
     * Build cache for a database
     */
    async buildCache(db) {
        try {
            const res = await fetch(`${BACKEND}/build-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_path: db.path })
            });
            
            const result = await res.json();
            
            if (result.error) {
                return { success: false, error: result.error };
            }
            
            // Update database info and persist to localStorage
            db.cacheExists = true;
            db.cacheValid = true;
            db.modelCount = result.models || result.valid_files || 0;
            db.lastBuild = new Date().toISOString();
            db.cacheFilePath = result.cache_file_path || null;
            
            this.saveDatabases();
            
            return {
                success: true,
                models: result.models,
                duration: result.build_duration
            };
        } catch (err) {
            console.error('[DatabaseManager] Build cache error:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Generate a unique database ID
     */
    generateId() {
        return `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Extract folder name from path
     */
    extractFolderName(folderPath) {
        const parts = folderPath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || 'Database';
    }
}
