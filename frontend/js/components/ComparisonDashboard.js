/**
 * ComparisonDashboard.js - Main Dashboard Component
 * Orchestrates STLViewers, SearchResultsTable, and CameraSync
 */

import { STLViewer } from './STLViewer.js';
import { SearchResultsTable } from './SearchResultsTable.js';
import { getCameraSync } from './CameraSync.js';

export class ComparisonDashboard {
    constructor() {
        this.queryViewer = null;
        this.matchViewer = null;
        this.resultsTable = null;
        this.cameraSync = getCameraSync();
        
        this.currentQueryFile = null;
        this.currentDatabase = null;
        this.lastResults = null;
        this.isSearching = false;
    }

    /**
     * Initialize dashboard (call once at page load)
     */
    async init() {
        console.log('[ComparisonDashboard] Initializing...');

        // Create viewer instances with camera sync
        this.queryViewer = new STLViewer('viewer-query', 'Uploaded Model', this.cameraSync);
        this.matchViewer = new STLViewer('viewer-match', 'Best Match', this.cameraSync);
        this.resultsTable = new SearchResultsTable('results-table', (result, index) => this.onResultSelected(result, index));

        // Initialize viewers
        const queryInit = await this.queryViewer.init();
        const matchInit = await this.matchViewer.init();

        if (!queryInit || !matchInit) {
            console.error('[ComparisonDashboard] Viewer initialization failed');
            return false;
        }

        // Subscribe to camera changes to keep viewers in sync
        this.cameraSync.onStateChange((state) => {
            this.matchViewer.applyCamera(state);
            this.queryViewer.applyCamera(state);
        });

        console.log('[ComparisonDashboard] Initialization complete');
        return true;
    }

    /**
     * Load query model from file (called on upload)
     */
    async loadQueryFile(file) {
        console.log('[ComparisonDashboard] Loading query file:', file.name);

        this.currentQueryFile = file;

        const success = await this.queryViewer.loadFromFile(file);

        if (success) {
            this._updateQueryHeader(file.name);
        }

        return success;
    }

    /**
     * Set active database (called when user selects database)
     */
    setDatabase(databasePath) {
        this.currentDatabase = databasePath;
        console.log('[ComparisonDashboard] Database set:', databasePath);
    }

    /**
     * Display search results
     */
    displayResults(results) {
        console.log('[ComparisonDashboard] Displaying results:', results.length);

        this.lastResults = results;

        // Render table
        this.resultsTable.render(results);

        // Load best match (first result)
        if (results.length > 0) {
            this.loadBestMatch(results[0]);
        }
    }

    /**
     * Load result as best match
     */
    async loadBestMatch(result) {
        if (!result || !this.currentDatabase) {
            console.warn('[ComparisonDashboard] Cannot load best match: missing result or database');
            return;
        }

        const filepath = `${this.currentDatabase}/${result.filename}`.replace(/\\/g, '/');
        console.log('[ComparisonDashboard] Loading best match:', filepath);

        const success = await this.matchViewer.loadModel(filepath);

        if (success) {
            this._updateMatchHeader(result.filename, result);
        }

        return success;
    }

    /**
     * Handle result row selection
     */
    async onResultSelected(result, index) {
        console.log('[ComparisonDashboard] Result selected:', index, result.filename);
        await this.loadBestMatch(result);
    }

    /**
     * Clear everything (reset button)
     */
    reset() {
        console.log('[ComparisonDashboard] Resetting...');

        this.queryViewer.clear();
        this.matchViewer.clear();
        this.resultsTable.render([]);
        this.currentQueryFile = null;
        this.lastResults = null;

        this._updateQueryHeader('No file');
        this._updateMatchHeader('No file');

        this.cameraSync.reset();
    }

    /**
     * Update query header with filename
     */
    _updateQueryHeader(filename) {
        const header = document.querySelector('#viewer-query .stl-viewer-title-sub');
        if (header) {
            const name = filename.split('/').pop();
            header.textContent = name;
        }
    }

    /**
     * Update match header with filename and similarity
     */
    _updateMatchHeader(filename, result) {
        const header = document.querySelector('#viewer-match .stl-viewer-title-sub');
        if (header) {
            const name = filename.split('/').pop();
            const similarity = result ? `(${(result.similarity * 100).toFixed(1)}%)` : '';
            header.textContent = `${name} ${similarity}`.trim();
        }
    }

    /**
     * Dispose all resources
     */
    dispose() {
        console.log('[ComparisonDashboard] Disposing...');

        if (this.queryViewer) this.queryViewer.dispose();
        if (this.matchViewer) this.matchViewer.dispose();

        this.queryViewer = null;
        this.matchViewer = null;
        this.resultsTable = null;
    }
}

// Export as singleton
let dashboard = null;

export function getDashboard() {
    if (!dashboard) {
        dashboard = new ComparisonDashboard();
    }
    return dashboard;
}
