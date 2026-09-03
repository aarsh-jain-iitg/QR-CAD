/**
 * new-dashboard.js - Main Application Entry Point
 * Integrates all components: STLViewer, SearchResultsTable, CameraSync, ComparisonDashboard
 * 
 * This file replaces the broken viewer implementation with a clean, commercial-grade rebuild
 */

import { getDashboard } from './components/ComparisonDashboard.js';
import { DashboardHTML, DashboardStyles } from './components/DashboardHTML.js';

const BACKEND = 'http://127.0.0.1:5000';

class QRCADApplication {
    constructor() {
        this.dashboard = null;
        this.currentDatabase = null;
        this.currentQueryFile = null;
        this.isSearching = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('[QRCADApplication] Initializing...');

        // Setup HTML
        this._setupHTML();

        // Initialize dashboard
        this.dashboard = getDashboard();
        const success = await this.dashboard.init();

        if (!success) {
            console.error('[QRCADApplication] Dashboard initialization failed');
            return;
        }

        // Attach event listeners
        this._attachEventListeners();

        console.log('[QRCADApplication] Ready');
    }

    /**
     * Setup HTML and styles
     */
    _setupHTML() {
        const container = document.getElementById('viewContainer');
        if (!container) {
            console.error('[QRCADApplication] Container not found');
            return;
        }

        // Inject HTML
        container.innerHTML = DashboardHTML();

        // Inject styles
        const style = document.createElement('style');
        style.textContent = DashboardStyles();
        document.head.appendChild(style);

        // Import component styles
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/stl-viewer.css';
        document.head.appendChild(link);
    }

    /**
     * Attach event listeners
     */
    _attachEventListeners() {
        // Upload zone
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');

        if (uploadZone) {
            uploadZone.addEventListener('click', () => fileInput.click());

            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('drag-over');
            });

            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('drag-over');
            });

            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('drag-over');

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });
        }

        // File input
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }

        // Search button
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.runSearch());
        }

        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
    }

    /**
     * Handle file upload
     */
    async handleFileUpload(file) {
        console.log('[QRCADApplication] File uploaded:', file.name);

        // Validate
        if (!file.name.toLowerCase().endsWith('.stl')) {
            alert('Please upload a .STL file');
            return;
        }

        // Store file
        this.currentQueryFile = file;

        // Load in viewer (immediately, no search needed)
        const success = await this.dashboard.loadQueryFile(file);

        if (success) {
            // Enable search button
            const searchBtn = document.getElementById('searchBtn');
            if (searchBtn) {
                searchBtn.disabled = !this.currentDatabase;
            }

            console.log('[QRCADApplication] Query file loaded successfully');
        }
    }

    /**
     * Run similarity search
     */
    async runSearch() {
        if (!this.currentQueryFile) {
            alert('Please upload a query model first');
            return;
        }

        if (!this.currentDatabase) {
            alert('Please select a database first');
            return;
        }

        if (this.isSearching) return;

        this.isSearching = true;

        try {
            const searchBtn = document.getElementById('searchBtn');
            const searchBtnText = document.getElementById('searchBtnText');
            const searchSpinner = document.getElementById('searchSpinner');

            if (searchBtn) searchBtn.disabled = true;
            if (searchBtnText) searchBtnText.textContent = 'Searching...';
            if (searchSpinner) searchSpinner.classList.remove('hidden');

            // Prepare form data
            const formData = new FormData();
            formData.append('file', this.currentQueryFile);
            formData.append('dataset_path', this.currentDatabase);
            formData.append('top_k', '5');

            // Send search request
            const response = await fetch(`${BACKEND}/search`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Display results
            console.log('[QRCADApplication] Results received:', data.results.length);
            this.dashboard.displayResults(data.results);

        } catch (error) {
            console.error('[QRCADApplication] Search error:', error);
            alert(`Search failed: ${error.message}`);
        } finally {
            this.isSearching = false;

            const searchBtn = document.getElementById('searchBtn');
            const searchBtnText = document.getElementById('searchBtnText');
            const searchSpinner = document.getElementById('searchSpinner');

            if (searchBtn) searchBtn.disabled = false;
            if (searchBtnText) searchBtnText.textContent = 'Run Similarity Search';
            if (searchSpinner) searchSpinner.classList.add('hidden');
        }
    }

    /**
     * Set database
     */
    setDatabase(databasePath) {
        this.currentDatabase = databasePath;
        this.dashboard.setDatabase(databasePath);

        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.disabled = !this.currentQueryFile;
        }

        console.log('[QRCADApplication] Database selected:', databasePath);
    }

    /**
     * Reset everything
     */
    reset() {
        console.log('[QRCADApplication] Resetting...');

        this.currentQueryFile = null;
        this.dashboard.reset();

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }

        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.disabled = true;
        }
    }

    /**
     * Download result
     */
    downloadResult(filename) {
        if (!this.currentDatabase) return;

        const fullPath = `${this.currentDatabase}/${filename}`;
        console.log('[QRCADApplication] Downloading:', fullPath);

        if (window.electronAPI && window.electronAPI.saveFile) {
            window.electronAPI.saveFile(fullPath, filename)
                .then((savedPath) => {
                    if (savedPath) {
                        console.log('[QRCADApplication] File saved:', savedPath);
                    }
                })
                .catch((err) => {
                    console.error('[QRCADApplication] Download error:', err);
                });
        }
    }

    /**
     * Cleanup on page unload
     */
    dispose() {
        if (this.dashboard) {
            this.dashboard.dispose();
        }
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    const app = new QRCADApplication();
    window.app = app; // Global reference for debugging

    await app.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.dispose();
    }
});

export { QRCADApplication };
