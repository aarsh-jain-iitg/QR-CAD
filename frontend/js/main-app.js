/**
 * QRCAD v2.0 - Main Application Controller
 * Coordinates all modules, navigation, and state management
 * NEW: Database-first workflow with cache validation and progress dialogs
 */

import { DatabaseManager } from './database-manager.js';
import { SearchHistory } from './search-history.js';
import { Views } from './views.js';
import { ComparisonViewer } from './comparison-3d.js';
import { SearchResultsTable } from './components/SearchResultsTable.js';
import { MetadataPanel } from './components/MetadataPanel.js';
import { buttonClasses } from './components/Button.js';

const BACKEND = "http://127.0.0.1:5000";
const RECENT_KEY = "qrcad_recent_databases";

class QRCADApp {
    constructor() {
        // Core modules
        this.dbManager = new DatabaseManager();
        this.searchHistory = new SearchHistory();
        this.comparisonViewer = null;
        this.searchResultsTable = null;
        this.metadataPanel = null;
        
        // State
        this.currentView = 'dashboard';
        this.currentQueryFile = null;
        this.currentSearchResults = null;
        this.currentQueryFileName = null;
        this.batchSearchFiles = [];
        this.batchSearchResults = {};
        this.batchFailedIndices = [];
        this.buildProgressInterval = null;
        
        // Track active builds per database to prevent concurrent builds
        this.activeBuildIds = new Map(); // dbId -> intervalId
        this.lastProgressValues = new Map(); // dbId -> lastValue (for monotonic checking)
        
        // **7C: Track active notifications for stacking**
        this.activeNotifications = [];
        
        // DOM references
        this.viewContainer = document.getElementById('viewContainer');
        this.infoPanel = document.getElementById('infoPanel');
        this.infoPanelContent = document.getElementById('infoPanelContent');
        this.activeDatabaseName = document.getElementById('activeDatabaseName');
        this.cacheStatusBadge = document.getElementById('cacheStatusBadge');
        this.cacheStatusText = document.getElementById('cacheStatusText');
        
        // Setup
        this.init();
    }
    
    init() {
        console.log('[QRCAD] Initializing application...');
        
        // Set up database change callback
        this.dbManager.onDatabaseChange = (db) => this.onDatabaseChanged(db);
        
        // Setup navigation
        this.setupNavigation();
        
        // Setup topbar buttons
        document.getElementById('settingsBtn').addEventListener('click', () => {
            window.electronAPI.openLogsFolder();
        });
        
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showHelpModal();
        });
        
        // **PERSISTENCE**: Validate all cached databases on startup
        this.validateAllCachesOnStartup();
        
        // Try to auto-load last active database
        const lastActiveDb = this.dbManager.getActiveDatabase();
        if (lastActiveDb) {
            console.log('[QRCAD] Auto-loading last active database:', lastActiveDb.name);
            // Cache status should already be validated from startup validation
            this.updateCacheStatus();
        }
        
        // Load initial view
        this.loadView('dashboard');
        
        // Check backend status
        this.checkBackendStatus();
        setInterval(() => this.checkBackendStatus(), 15000);
        
        // Setup metadata panel close button
        this.setupMetadataPanelClose();
        
        // Update database display
        this.updateActiveDatabaseDisplay(lastActiveDb);
        
        console.log('[QRCAD] Application initialized');
    }
    
    /**
     * PERSISTENCE: On app startup, validate all databases' cache status against actual files on disk
     * This ensures localStorage state is synchronized with reality
     */
    async validateAllCachesOnStartup() {
        const databases = this.dbManager.getAllDatabases();
        if (databases.length === 0) return;
        
        console.log('[App] Validating cache status for all databases on startup...');
        
        const validationPromises = databases.map(async (db) => {
            try {
                await this.dbManager.validateCacheStatus(db);
                console.log(`[App] Cache validation for "${db.name}": ${db.cacheValid ? 'valid' : 'invalid'}`);
            } catch (err) {
                console.error(`[App] Error validating cache for "${db.name}":`, err);
            }
        });
        
        await Promise.all(validationPromises);
        
        // Save updated cache states to localStorage
        this.dbManager.saveDatabases();
        
        console.log('[App] Cache validation complete');
    }
    
    setupNavigation() {
        const navButtons = document.querySelectorAll('.sidebar-nav-item');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                if (view) {
                    // Update active state
                    navButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Load view
                    this.loadView(view);
                }
            });
        });
    }
    
    updateSidebarActive(viewName) {
        const navMap = {
            'dashboard': 'dashboard',
            'database-manager': 'database-manager',
            'query-search': 'query-search',
            'search-mode-selection': 'query-search',
            'single-search': 'query-search',
            'batch-search': 'batch-search',
            'search-history': 'search-history',
            'cache-dashboard': 'database-manager'
        };
        const navView = navMap[viewName] || viewName;
        document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === navView);
        });
    }

    loadView(viewName) {
        // **CLEANUP: Clear any active build intervals when changing views**
        this.activeBuildIds.forEach((intervalId, dbId) => {
            console.warn(`[App] Clearing orphaned build interval for ${dbId}`);
            clearInterval(intervalId);
        });
        this.activeBuildIds.clear();
        this.lastProgressValues.clear();
        console.log(`[QRCAD] Loading view: ${viewName}`);
        this.currentView = viewName;
        this.updateSidebarActive(viewName);
        
        // Dispose 3D viewer when leaving single-search view
        if (viewName !== 'single-search' && this.comparisonViewer) {
            this.comparisonViewer.dispose();
            this.comparisonViewer = null;
        }
        
        // Get view HTML
        let html = '';
        switch (viewName) {
            case 'dashboard':
                html = Views.dashboard();
                break;
            case 'database-manager':
                html = Views.databaseManager();
                break;
            case 'query-search':
                // Smart routing: if database loaded, go to search mode selection; otherwise show empty state
                const db = this.dbManager.getActiveDatabase();
                if (db) {
                    html = Views.searchModeSelection();
                } else {
                    html = Views.querySearchEmptyState();
                }
                break;
            case 'search-mode-selection':
                html = Views.searchModeSelection();
                break;
            case 'single-search':
                html = Views.singleSearch();
                break;
            case 'batch-search':
                html = Views.batchSearch();
                break;
            case 'search-history':
                html = Views.searchHistory();
                break;
            case 'cache-dashboard':
                html = Views.cacheDashboard();
                break;
            default:
                html = '<p>View not found</p>';
        }
        
        this.viewContainer.innerHTML = html;
        
        // Initialize view-specific logic
        this.initializeView(viewName);
    }
    
    initializeView(viewName) {
        switch (viewName) {
            case 'dashboard':
                this.initDashboard();
                break;
            case 'database-manager':
                this.initDatabaseManager();
                break;
            case 'query-search':
                // Smart routing initialization
                const db = this.dbManager.getActiveDatabase();
                if (db) {
                    this.initSearchModeSelection();
                } else {
                    this.initQuerySearchEmptyState();
                }
                break;
            case 'search-mode-selection':
                this.initSearchModeSelection();
                break;
            case 'single-search':
                this.initSingleSearch();
                break;
            case 'batch-search':
                this.initBatchSearch();
                break;
            case 'search-history':
                this.initSearchHistory();
                break;
            case 'cache-dashboard':
                this.initCacheDashboard();
                break;
        }
    }
    
    // ============================================================
    // DASHBOARD
    // ============================================================

    initDashboard() {
        this.renderDashboardCurrentDb();
        this.renderDashboardRecent();
        this.renderDashboardStatus();
    }

    async renderDashboardStatus() {
        const backendEl = document.getElementById('dashboardBackendStatus');
        const cacheEl = document.getElementById('dashboardCacheStatus');
        const activeEl = document.getElementById('dashboardActiveDbName');

        if (activeEl) {
            const db = this.dbManager.getActiveDatabase();
            activeEl.textContent = db ? db.name : 'None';
            activeEl.style.color = db ? 'var(--success)' : 'var(--text-muted)';
        }

        if (cacheEl) {
            const db = this.dbManager.getActiveDatabase();
            if (!db) {
                cacheEl.textContent = 'No database';
            } else {
                const status = await this.dbManager.getCacheStatus(db.path);
                cacheEl.textContent = status.exists ? 'Ready' : 'Not built';
                cacheEl.style.color = status.exists ? 'var(--success)' : 'var(--warning)';
            }
        }

        if (backendEl) {
            try {
                const res = await fetch(`${BACKEND}/`);
                backendEl.textContent = res.ok ? 'Online' : 'Offline';
                backendEl.style.color = res.ok ? 'var(--success)' : 'var(--error)';
            } catch {
                backendEl.textContent = 'Offline';
                backendEl.style.color = 'var(--error)';
            }
        }
    }

    renderDashboardCurrentDb() {
        const container = document.getElementById('dashboardCurrentDb');
        if (!container) return;

        const db = this.dbManager.getActiveDatabase();
        if (!db) return;

        const cacheReady = db.cacheExists && db.cacheValid;
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">${this.escapeHtml(db.name)}</div>
                <div style="font-size: 13px; color: var(--text-muted); font-family: monospace;">${this.escapeHtml(db.path)}</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <span class="badge ${cacheReady ? 'badge-success' : 'badge-warning'}">${cacheReady ? 'Cache Ready' : 'Cache Missing'}</span>
                    <span class="badge">${db.modelCount || 0} models</span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="app.loadView('database-manager')" style="align-self: flex-start; margin-top: 4px;">Manage</button>
            </div>
        `;
    }

    renderDashboardRecent() {
        const container = document.getElementById('dashboardRecentList');
        const card = document.getElementById('dashboardRecentCard');
        if (!container) return;

        const recent = this.dbManager.getRecentDatabases();
        if (recent.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding: 24px;"><div class="empty-state-text">No recent databases</div></div>`;
            return;
        }

        container.innerHTML = recent.slice(0, 5).map(entry => `
            <div class="recent-db-item">
                <div class="recent-db-info">
                    <div class="recent-db-name">${this.escapeHtml(entry.name)}</div>
                    <div class="recent-db-path" title="${this.escapeHtml(entry.path)}">${this.escapeHtml(entry.path)}</div>
                </div>
                <div class="recent-db-meta">
                    <div class="recent-db-time">${this.formatTimeSince(entry.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    navigateFromDashboard(mode) {
        const db = this.dbManager.getActiveDatabase();
        if (!db) {
            this.showNotification('Please select a database first', 'warning');
            this.loadView('database-manager');
            return;
        }
        if (mode === 'single') {
            this.loadView('single-search');
        } else if (mode === 'batch') {
            this.loadView('batch-search');
        }
    }

    // ============================================================
    // DATABASE MANAGER
    // ============================================================
    
    initDatabaseManager() {
        // Render database list
        this.renderDatabaseList();
        
        // Render recent databases
        this.renderRecentDatabasesQuickSelect();
        
        // Setup floating help button
        const helpBtn = document.getElementById('floatingHelpBtn');
        const helpTooltip = document.getElementById('helpTooltip');
        if (helpBtn && helpTooltip) {
            helpBtn.addEventListener('click', () => {
                helpTooltip.classList.toggle('hidden');
            });
        }
        
        // Create new database button
        const createBtn = document.getElementById('createDatabaseBtn');
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                const folder = await window.electronAPI.selectFolder();
                if (folder) {
                    // Show inline progress notification
                    this.showNotification('Scanning folder...', 'info');
                    
                    const db = await this.dbManager.addDatabase(folder);
                    await this.dbManager.updateModelCount(db);
                    
                    this.renderDatabaseList();
                    this.showNotification(`Database added: ${db.modelCount} model(s) found`, 'success');
                }
            });
        }
        
        // Clear cache button
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                if (confirm('Clear all caches for all databases? This cannot be undone.')) {
                    const databases = this.dbManager.getAllDatabases();
                    databases.forEach(db => {
                        this.deleteDatabaseCache(db.id);
                    });
                    this.renderDatabaseList();
                    this.showNotification('All caches cleared', 'success');
                }
            });
        }
        
        // Clear database log button
        const clearLogBtn = document.getElementById('clearDatabaseLogBtn');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => {
                this.clearAllRecentDatabases();
            });
        }
    }
    
    populateDatabaseSelect() {
        const selectEl = document.getElementById('databaseSelect');
        if (!selectEl) return;
        
        const databases = this.dbManager.getAllDatabases();
        const currentValue = selectEl.value;
        
        selectEl.innerHTML = '<option value="">-- Select a database --</option>';
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db.id;
            option.textContent = db.name;
            selectEl.appendChild(option);
        });
        
        selectEl.value = currentValue;
    }
    
    showDatabaseInfo(dbId) {
        const db = this.dbManager.getAllDatabases().find(d => d.id === dbId);
        if (!db) return;
        
        const infoBlock = document.getElementById('databaseInfoBlock');
        const statusDisplay = document.getElementById('cacheStatusDisplay');
        const actionButtons = document.getElementById('databaseActionButtons');
        
        if (infoBlock) {
            document.getElementById('activeDatabaseName').textContent = db.name;
            document.getElementById('activeDatabaseModelCount').textContent = `${db.modelCount || '—'} models`;
            infoBlock.style.display = 'block';
        }
        
        if (statusDisplay) {
            statusDisplay.style.display = 'block';
            this.updateCacheStatus(db);
        }
        
        if (actionButtons) {
            this.updateActionButtons(db);
        }
    }
    
    /**
     * THREE-BUTTON STATE MACHINE
     * Button 1 (Check Cache): Verify cache exists & is valid for current path
     * Button 2 (Build Cache): Build cache (with confirmation if cache already exists)
     * Button 3 (Select): Enable only if cache is found & valid
     */
    updateActionButtons(db) {
        const checkBtn = document.getElementById('checkCacheBtn');
        const buildBtn = document.getElementById('buildCacheBtn');
        const selectBtn = document.getElementById('selectDatabaseBtn');
        
        const cacheReady = db.cacheExists && db.cacheValid;
        
        // BUTTON 1: "Check Cache" - always visible, verifies on-disk cache for this path
        if (checkBtn) {
            checkBtn.style.display = 'inline-flex';
            checkBtn.disabled = false;
            checkBtn.onclick = () => this.checkCacheForDb(db.id);
            checkBtn.setAttribute('title', 'Verify if a valid cache exists for this database path');
        }
        
        // BUTTON 2: "Build Cache" - primary when no cache, secondary when cache exists
        if (buildBtn) {
            buildBtn.style.display = 'inline-flex';
            buildBtn.disabled = false;
            // Visual styling: highlight if no cache, muted if cache exists
            buildBtn.className = cacheReady 
                ? 'btn btn-secondary' 
                : 'btn btn-primary';
            buildBtn.textContent = cacheReady ? 'Rebuild Cache (optional)' : 'Build Cache';
            buildBtn.onclick = () => this.buildDatabaseCache(db.id);
            buildBtn.setAttribute('title', 
                cacheReady 
                    ? 'Rebuild cache for this database (cache already exists)'
                    : 'Build cache for this database (no cache yet)'
            );
        }
        
        // BUTTON 3: "Select" - ONLY enabled when cache is valid
        if (selectBtn) {
            selectBtn.style.display = 'inline-flex';
            selectBtn.disabled = !cacheReady;
            selectBtn.className = cacheReady 
                ? 'btn btn-primary' 
                : 'btn btn-primary disabled';
            selectBtn.onclick = cacheReady ? () => this.selectDatabase(db.id) : null;
            selectBtn.setAttribute('title', 
                cacheReady 
                    ? 'Confirm this database and proceed to search mode'
                    : 'Build a cache first to enable selection'
            );
        }
    }
    
    /**
     * BUTTON 1: Check Cache - Verifies if a valid cache exists on disk for the current path
     * Updates the cache status and the UI
     */
    async checkCacheForDb(dbId) {
        const db = this.dbManager.getAllDatabases().find(d => d.id === dbId);
        if (!db) return;
        
        // Show progress indicator
        this.showNotification('Checking cache status...', 'info');
        
        try {
            // Validate cache against actual files on disk
            await this.dbManager.validateCacheStatus(db);
            
            const cacheStatus = db.cacheExists && db.cacheValid 
                ? `✓ Cache Found (${db.modelCount} models, built ${new Date(db.lastBuild).toLocaleDateString()})`
                : `✗ No Cache`;
            
            this.showNotification(cacheStatus, db.cacheExists && db.cacheValid ? 'success' : 'warning');
            
            // Update UI
            this.updateActionButtons(db);
        } catch (err) {
            console.error('[App] Check cache error:', err);
            this.showNotification(`Cache check failed: ${err.message}`, 'error');
        }
    }
    
    renderDatabaseList() {
        const container = document.getElementById('databaseListContainer');
        if (!container) return;
        
        const databases = this.dbManager.getAllDatabases();
        const activeDb = this.dbManager.getActiveDatabase();
        
        if (databases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">No databases yet</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
                        Click "+ New Database" to get started
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = databases.map(db => {
            const isActive = activeDb && activeDb.id === db.id;
            const cacheExists = db.cacheExists && db.cacheValid;
            // **BUG 4 FIX**: Use formatLastBuildDate for consistent date/time formatting
            const lastBuild = this.dbManager.formatLastBuildDate(db.lastBuild) || 'Never';
            
            // Cache status badge styling
            const cacheStatusColor = cacheExists ? 'var(--success-color)' : 'var(--warning-color)';
            const cacheStatusText = cacheExists ? `✓ Cache Found (${db.modelCount} models)` : '✗ No Cache';
            
            return `
                <div class="db-item-row ${isActive ? 'active-db' : ''}" data-db-id="${db.id}">
                    <div class="db-item-info">
                        <div class="db-item-name">${this.escapeHtml(db.name)}</div>
                        <div class="db-item-path">${this.escapeHtml(db.path)}</div>
                    </div>
                    
                    <div class="db-item-stats">
                        <div class="db-stat">
                            <div class="db-stat-label">Cache Status</div>
                            <div class="db-stat-value" id="cacheStatusDisplay-${db.id}" style="color: ${cacheStatusColor}; font-weight: 500;">
                                ${cacheStatusText}
                            </div>
                        </div>
                        <div class="db-stat">
                            <div class="db-stat-label">Last Build</div>
                            <div class="db-stat-value" style="font-size: 12px; white-space: pre-line;">${this.escapeHtml(lastBuild)}</div>
                        </div>
                    </div>
                    
                    <div class="db-item-actions">
                        <!-- THREE-BUTTON STATE MACHINE -->
                        
                        <!-- Button 1: Check Cache -->
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); app.checkCacheForDb('${db.id}')" title="Verify if a valid cache exists for this database">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="6" cy="6" r="5"></circle>
                                <path d="M6 4v4M4 6h4"></path>
                            </svg>
                            Check Cache
                        </button>
                        
                        <!-- Button 2: Build Cache (hidden if cache exists, primary if no cache) -->
                        <button class="btn ${cacheExists ? 'btn-secondary' : 'btn-primary'} btn-sm" 
                                onclick="event.stopPropagation(); app.buildDatabaseCache('${db.id}')" 
                                title="${cacheExists ? 'Rebuild cache (cache already exists)' : 'Build cache for this database'}">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="6" cy="6" r="1"></circle>
                                <path d="M6 1v4m0 4v4M2.11 2.11l2.12 2.12m2.54 2.54l2.12 2.12M1 6h4m4 0h4M2.11 9.89l2.12-2.12m2.54-2.54l2.12-2.12"></path>
                            </svg>
                            ${cacheExists ? 'Rebuild Cache' : 'Build Cache'}
                        </button>
                        
                        <!-- Button 3: Select (enabled only if cache exists) -->
                        <button class="btn btn-primary btn-sm" 
                                id="selectDatabaseBtn-${db.id}"
                                onclick="event.stopPropagation(); app.selectDatabase('${db.id}')" 
                                ${!cacheExists ? 'disabled' : ''}
                                title="${cacheExists ? 'Confirm and use this database' : 'Build a cache first'}">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 6L9 17l-5-5"></path>
                            </svg>
                            ${isActive ? 'Active' : 'Select'}
                        </button>
                        
                        <!-- Delete button -->
                        <button class="btn btn-destructive btn-sm" onclick="event.stopPropagation(); app.deleteDatabase('${db.id}')">
                            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h10l-1 9H4L3 6zM5 6V4a1 1 0 011-1h4a1 1 0 011 1v2"></path>
                            </svg>
                            Remove
                        </button>
                    </div>
                    
                    <!-- Progress bar placeholder (hidden until build starts) -->
                    <div class="db-item-progress hidden" id="dbProgress-${db.id}">
                        <div class="db-progress-text" id="dbProgressText-${db.id}">Indexing models...</div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="dbProgressFill-${db.id}" style="width: 0%;"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // **7A: Auto-check cache for all databases on render**
        this.autoCheckCachesForAllDatabases();
    }
    
    /**
     * **7A: Run automatic cache checks for all databases when list renders
     * This ensures all cache statuses are current before user interacts
     */
    async autoCheckCachesForAllDatabases() {
        const databases = this.dbManager.getAllDatabases();
        
        // Run validations in parallel, but don't block rendering
        databases.forEach(async (db) => {
            try {
                await this.dbManager.validateCacheStatus(db);
                
                // Update this specific database row's UI
                const statusDisplay = document.getElementById(`cacheStatusDisplay-${db.id}`);
                const selectBtn = document.getElementById(`selectDatabaseBtn-${db.id}`);
                
                if (statusDisplay) {
                    const cacheExists = db.cacheExists && db.cacheValid;
                    const cacheStatusColor = cacheExists ? 'var(--success-color)' : 'var(--warning-color)';
                    const cacheStatusText = cacheExists ? `✓ Cache Found (${db.modelCount} models)` : '✗ No Cache';
                    
                    statusDisplay.style.color = cacheStatusColor;
                    statusDisplay.textContent = cacheStatusText;
                }
                
                // **7B: Update Select button state immediately after validation completes**
                if (selectBtn) {
                    const cacheReady = db.cacheExists && db.cacheValid;
                    selectBtn.disabled = !cacheReady;
                    selectBtn.className = cacheReady ? 'btn btn-primary btn-sm' : 'btn btn-primary btn-sm disabled';
                    selectBtn.setAttribute('title', 
                        cacheReady 
                            ? 'Confirm and use this database'
                            : 'Build a cache first'
                    );
                }
            } catch (err) {
                console.error(`[App] Auto-check cache error for ${db.name}:`, err);
            }
        });
    }
    
    /**
     * BUTTON 3: Select - Main action to confirm selection of a database and proceed to search
     */
    async selectDatabase(id) {
        const db = this.dbManager.getAllDatabases().find(d => d.id === id);
        if (!db) return;
        
        // CRITICAL: Always verify cache exists on disk, not just from localStorage
        await this.dbManager.validateCacheStatus(db);
        
        if (!db.cacheValid || !db.cacheExists) {
            // Cache missing or invalid, show prompt to rebuild
            const shouldRebuild = confirm(
                `Database cache for "${db.name}" is not ready.\n\n` +
                `Would you like to build the cache now? (This may take several minutes)`
            );
            
            if (shouldRebuild) {
                await this.buildDatabaseCache(id);
            } else {
                this.showNotification('Cache is required for searching. Please build it first.', 'warning');
                return;
            }
        } else {
            // Cache exists and is valid, proceed
            this.showNotification('Database loaded from cache', 'success');
        }
        
        // Update model count
        await this.dbManager.updateModelCount(db);
        
        // **8A FIX: Set as active BEFORE re-rendering to ensure state is updated**
        this.dbManager.setActiveDatabase(id);
        
        // **8A FIX: Force full re-render to update ALL rows' active state**
        this.renderDatabaseList();
        this.updateCacheStatus();
        
        // Update the active database display in the header
        this.updateActiveDatabaseDisplay(db);
        
        console.log(`[App] Database selected: ${db.name} (ID: ${id})`);
        
        // **BUG 1 FIX: Removed unnecessary 1-second delay. Navigate immediately.**
        // The active state is already set correctly and will persist properly.
        this.loadView('search-mode-selection');
    }
    
    async ensureCacheLoaded(db) {
        console.log('[App] Checking cache for database:', db.name);
        
        try {
            // Check if cache exists and is valid
            const validation = await this.dbManager.validateCacheStatus(db);
            
            if (validation && validation.valid) {
                // Cache exists and is valid
                console.log('[App] Cache is valid for database:', db.name);
                this.showNotification('Database loaded from cache', 'success');
                return true;
            } else {
                console.log('[App] Cache not valid:', validation?.reason || 'Unknown reason');
                return false;
            }
        } catch (err) {
            console.error('[App] Error checking cache:', err);
            return false;
        }
    }
    
    /**
     * BUTTON 2: Build Cache
     * If cache already exists → ask for confirmation before rebuild
     * If no cache exists → proceed directly with indexing
     */
    async buildDatabaseCache(id) {
        const db = this.dbManager.getAllDatabases().find(d => d.id === id);
        if (!db) return;
        
        // **DEBOUNCE: Prevent concurrent builds on same database**
        if (this.activeBuildIds.has(id)) {
            this.showNotification('Build already in progress for this database', 'warning');
            return;
        }
        
        // Check if cache already exists - if so, ask for confirmation
        if (db.cacheExists && db.cacheValid) {
            const lastBuildDate = db.lastBuild 
                ? new Date(db.lastBuild).toLocaleDateString()
                : 'unknown date';
            
            const confirm = await this.showRebuildConfirmDialog(
                db.name,
                db.modelCount,
                lastBuildDate
            );
            
            if (!confirm) {
                return; // User cancelled rebuild
            }
        }
        
        // Proceed with build
        await this._performBuildCache(db);
    }
    
    /**
     * Show rebuild confirmation dialog
     * Returns: true if user confirms rebuild, false if cancelled
     */
    async showRebuildConfirmDialog(dbName, modelCount, lastBuildDate) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'modal-overlay';
            dialog.innerHTML = `
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2>Rebuild Cache?</h2>
                        <button class="modal-close" type="button">✕</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <p style="margin: 0 0 12px 0; color: var(--text-primary);">
                            A cache already exists for <strong>${this.escapeHtml(dbName)}</strong>:
                        </p>
                        <div style="background: var(--bg-secondary); border-radius: 6px; padding: 12px; margin: 12px 0; font-size: 13px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <span style="color: var(--text-secondary);">Models:</span>
                                <span style="font-weight: 500; color: var(--text-primary);">${modelCount} models</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-secondary);">Built:</span>
                                <span style="font-weight: 500; color: var(--text-primary);">${lastBuildDate}</span>
                            </div>
                        </div>
                        <p style="margin: 12px 0; color: var(--text-secondary); font-size: 13px;">
                            Rebuilding will re-index all models in this database. This may take several minutes.
                        </p>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 10px; padding: 16px; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-secondary" id="cancelRebuild" type="button">Cancel</button>
                        <button class="btn btn-destructive" id="confirmRebuild" type="button">Rebuild anyway</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            const closeBtn = dialog.querySelector('.modal-close');
            const cancelBtn = dialog.querySelector('#cancelRebuild');
            const confirmBtn = dialog.querySelector('#confirmRebuild');
            
            const cleanup = () => {
                dialog.remove();
            };
            
            closeBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
            
            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
            
            confirmBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
        });
    }
    
    /**
     * Internal: Perform the actual cache build (after confirmation check)
     */
    async _performBuildCache(db) {
        // Show inline progress bar for this specific database row
        const progressBlock = document.getElementById(`dbProgress-${db.id}`);
        const progressText = document.getElementById(`dbProgressText-${db.id}`);
        const progressFill = document.getElementById(`dbProgressFill-${db.id}`);
        const rebuildBtn = document.querySelector(`[onclick*="buildDatabaseCache('${db.id}')"]`);
        
        if (progressBlock) {
            progressBlock.classList.remove('hidden');
        }
        
        // Disable the rebuild button while building
        if (rebuildBtn) rebuildBtn.disabled = true;
        
        // Initialize last progress value for monotonic checking
        this.lastProgressValues.set(db.id, 0);
        
        try {
            // Start build
            const buildPromise = this.dbManager.buildCache(db);
            
            // Poll progress with database scoping
            const progressInterval = setInterval(async () => {
                try {
                    // Include database ID in progress query (for future backend scoping)
                    const res = await fetch(`${BACKEND}/build-progress`);
                    const progress = await res.json();
                    
                    if (progress.error) {
                        clearInterval(progressInterval);
                        return;
                    }
                    
                    const filesCompleted = Math.max(0, progress.files_completed || 0);
                    const totalFiles = Math.max(1, progress.total_files || 1);
                    
                    // **MONOTONIC CHECK: Ensure progress only increases**
                    const lastValue = this.lastProgressValues.get(db.id) || 0;
                    if (filesCompleted < lastValue) {
                        console.warn(`[App] Progress decreased for ${db.id}: ${lastValue} → ${filesCompleted}, ignoring`);
                        return; // Ignore erratic decreases
                    }
                    this.lastProgressValues.set(db.id, filesCompleted);
                    
                    const percentComplete = Math.min(100, Math.round((filesCompleted / totalFiles) * 100));
                    const displayCurrent = Math.min(filesCompleted, totalFiles);
                    const displayTotal = totalFiles;
                    
                    if (progressText) {
                        progressText.textContent = `Indexing models... ${displayCurrent} of ${displayTotal} processed`;
                    }
                    
                    if (progressFill) {
                        progressFill.style.width = `${percentComplete}%`;
                    }
                    
                    if (progress.status === 'done') {
                        clearInterval(progressInterval);
                    }
                } catch (err) {
                    console.error('[App] Progress poll error:', err);
                }
            }, 500);
            
            // **INTERVAL TRACKING: Store interval for cleanup**
            this.activeBuildIds.set(db.id, progressInterval);
            
            const result = await buildPromise;
            
            // **CLEANUP: Clear interval and remove from active builds**
            clearInterval(progressInterval);
            this.activeBuildIds.delete(db.id);
            this.lastProgressValues.delete(db.id);
            
            if (result.success) {
                // Update progress to 100%
                if (progressFill) progressFill.style.width = '100%';
                if (progressText) progressText.textContent = `✓ Cache built: ${result.models} models indexed`;
                
                // **BUG 5 FIX: Re-fetch cache status from backend after build completes**
                // This ensures the UI shows the accurate model count, build date, and cache status
                await this.dbManager.validateCacheStatus(db);
                
                // Update the UI immediately with fresh data
                this.updateCacheStatus(db);
                this.renderDatabaseList();
                
                // If this is the active database, also refresh its info panel
                const activeDb = this.dbManager.getActiveDatabase();
                if (activeDb && activeDb.id === db.id) {
                    this.updateActiveDatabaseDisplay(db);
                }
                
                this.showNotification(`Cache rebuilt: ${db.modelCount} models indexed`, 'success');
                
                // Hide progress after 2 seconds
                setTimeout(() => {
                    if (progressBlock) progressBlock.classList.add('hidden');
                }, 2000);
            } else {
                throw new Error(result.error || 'Build failed');
            }
        } catch (err) {
            console.error('[App] Build error:', err);
            
            // **CLEANUP: Clear interval on error**
            const intervalId = this.activeBuildIds.get(db.id);
            if (intervalId) {
                clearInterval(intervalId);
                this.activeBuildIds.delete(db.id);
                this.lastProgressValues.delete(db.id);
            }
            
            if (progressText) progressText.textContent = `❌ Build failed: ${err.message}`;
            this.showNotification(`Build failed: ${err.message}`, 'error');
            
            // Hide progress after 3 seconds
            setTimeout(() => {
                if (progressBlock) progressBlock.classList.add('hidden');
            }, 3000);
        } finally {
            // Re-enable the rebuild button
            if (rebuildBtn) rebuildBtn.disabled = false;
        }
    }
    
    async deleteDatabase(id) {
        const db = this.dbManager.getAllDatabases().find(d => d.id === id);
        if (!db) return;
        
        const shouldDelete = confirm(
            `Remove database "${db.name}"?\n\n` +
            `This will remove the database from QRCAD. The original STL files will NOT be affected.`
        );
        
        if (!shouldDelete) return;
        
        try {
            // Delete cache if it exists
            if (db.cacheExists) {
                await this.deleteDatabaseCache(id);
            }
            
            // Remove from database manager
            this.dbManager.deleteDatabase(id, false);
            
            // Re-render list
            this.renderDatabaseList();
            this.renderRecentDatabasesQuickSelect();
            
            this.showNotification(`Database "${db.name}" removed`, 'success');
        } catch (err) {
            console.error('[App] Error deleting database:', err);
            this.showNotification(`Failed to remove database: ${err.message}`, 'error');
        }
    }
    
    removeFromRecentDatabases(id) {
        const recent = this.dbManager.getRecentDatabases();
        const filtered = recent.filter(db => db.id !== id);
        localStorage.setItem(RECENT_KEY, JSON.stringify(filtered));
        this.renderRecentDatabasesQuickSelect();
        this.showNotification('Removed from recent databases', 'success');
    }
    
    clearAllRecentDatabases() {
        const confirmed = confirm('Clear all recent database history?');
        if (confirmed) {
            localStorage.setItem(RECENT_KEY, JSON.stringify([]));
            this.renderRecentDatabasesQuickSelect();
            this.showNotification('Recent database history cleared', 'success');
        }
    }
    
    clearDatabaseLog() {
        const confirmed = confirm('Clear all recent database history?');
        if (confirmed) {
            localStorage.setItem(RECENT_KEY, JSON.stringify([]));
            this.renderRecentDatabasesQuickSelect();
            this.showNotification('Recent database history cleared', 'success');
        }
    }
    
    renderRecentDatabasesQuickSelect() {
        const container = document.getElementById('recentDatabasesContainer');
        const card = document.getElementById('recentDatabasesCard');
        if (!container || !card) return;
        
        const recentDatabases = this.dbManager.getRecentDatabases();
        
        if (recentDatabases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🕒</div>
                    <div class="empty-state-text">No recent databases</div>
                </div>
            `;
            card.style.display = 'none';
            return;
        }
        
        card.style.display = 'block';
        
        container.innerHTML = recentDatabases.map(entry => {
            const timeSince = this.formatTimeSince(entry.timestamp);
            return `
                <div class="recent-db-item">
                    <div class="recent-db-info">
                        <div class="recent-db-name">${this.escapeHtml(entry.name)}</div>
                        <div class="recent-db-path" title="${this.escapeHtml(entry.path)}">${this.escapeHtml(entry.path)}</div>
                    </div>
                    <div class="recent-db-meta">
                        <div class="recent-db-time">${timeSince}</div>
                        <button class="recent-db-remove" onclick="app.removeFromRecentDatabases('${entry.id}')" title="Remove from recent" type="button" aria-label="Remove from recent">
                            ✕
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async loadDatabaseFromEmpty() {
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
            const db = await this.dbManager.addDatabase(folder);
            await this.selectDatabase(db.id);
        }
    }
    
    initQuerySearchEmptyState() {
        // Button handlers are inline in the template
        // No additional initialization needed
    }
    
    formatTimeSince(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return new Date(timestamp).toLocaleDateString();
    }
    
    // ============================================================
    // SEARCH MODE SELECTION
    // ============================================================
    
    initSearchModeSelection() {
        document.getElementById('singleSearchCard').addEventListener('click', () => {
            this.selectSearchMode('single');
        });
        
        document.getElementById('batchSearchCard').addEventListener('click', () => {
            this.selectSearchMode('batch');
        });
    }
    
    selectSearchMode(mode) {
        if (mode === 'single') {
            this.loadView('single-search');
        } else if (mode === 'batch') {
            this.loadView('batch-search');
        }
    }
    
    backToSearchMode() {
        // Dispose viewers and clear state when going back
        if (this.comparisonViewer) {
            this.comparisonViewer.dispose();
            this.comparisonViewer = null;
        }
        this.currentQueryFile = null;
        this.currentSearchResults = null;
        this.batchSearchFiles = null;
        this.loadView('search-mode-selection');
    }
    
    // ============================================================
    // SINGLE SEARCH
    // ============================================================
    
    initSingleSearch() {
        const dropZone = document.getElementById('queryDropZone');
        const fileInput = document.getElementById('queryFileInput');
        const runSearchBtn = document.getElementById('runSearchBtn');
        
        // Initialize metadata panel
        if (!this.metadataPanel) {
            this.metadataPanel = new MetadataPanel('infoPanel');
        }
        
        // Click to browse
        dropZone.addEventListener('click', () => fileInput.click());
        
        // File input change
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                this.currentQueryFile = fileInput.files[0];
                this.updateQueryFileDisplay(fileInput.files[0].name);
            }
        });
        
        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].name.toLowerCase().endsWith('.stl')) {
                const dt = new DataTransfer();
                dt.items.add(files[0]);
                fileInput.files = dt.files;
                this.currentQueryFile = files[0];
                this.updateQueryFileDisplay(files[0].name);
            } else {
                this.showNotification('Please drop a valid .STL file', 'error');
            }
        });
        
        // Run search button
        runSearchBtn.addEventListener('click', () => this.runSingleSearch());
        
        // Export buttons
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportSingleSearchResults('csv'));
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportSingleSearchResults('pdf'));
    }
    updateQueryFileDisplay(filename) {
        const dropZone = document.getElementById('queryDropZone');
        const filenameEl = document.getElementById('queryFilename');
        const runSearchBtn = document.getElementById('runSearchBtn');
        
        dropZone.classList.add('has-file');
        filenameEl.textContent = filename;
        filenameEl.classList.remove('hidden');
        
        const hasDatabase = this.dbManager.getActiveDatabase() !== null;
        runSearchBtn.disabled = !hasDatabase;
        
        if (!hasDatabase) {
            this.showNotification('Please select a database first', 'warning');
        }
        
        // Load query into viewer immediately (in-memory)
        this.loadQueryPreview();
    }
    
    async loadQueryPreview() {
        if (!this.currentQueryFile) {
            console.log('[App] No query file to preview');
            return;
        }
        
        const comparisonViewerCard = document.getElementById('comparisonViewerCard');
        
        // Initialize viewer if needed
        if (!this.comparisonViewer) {
            comparisonViewerCard.classList.remove('hidden');
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            
            this.comparisonViewer = new ComparisonViewer();
            const initialized = await this.comparisonViewer.init(null);
            
            if (!initialized) {
                console.error('[App] Failed to initialize comparison viewer');
                return;
            }
        } else {
            comparisonViewerCard.classList.remove('hidden');
        }
        
        // Load query from File object (in-memory, no disk write)
        try {
            const success = await this.comparisonViewer.loadQueryFromFile(this.currentQueryFile);
            if (success) {
                console.log('[App] Query preview loaded successfully');
            } else {
                console.warn('[App] Query preview failed to load');
            }
        } catch (err) {
            console.error('[App] Error loading query preview:', err);
        }
    }
    
    
    async runSingleSearch() {
        if (!this.currentQueryFile) {
            this.showNotification('Please select a query file', 'error');
            return;
        }
        
        const db = this.dbManager.getActiveDatabase();
        if (!db) {
            this.showNotification('Please select a database first', 'error');
            return;
        }
        
        // Dispose existing viewer before starting new search
        if (this.comparisonViewer) {
            this.comparisonViewer.dispose();
            this.comparisonViewer = null;
        }
        
        // UI updates
        const searchBtn = document.getElementById('runSearchBtn');
        const searchBtnText = document.getElementById('searchBtnText');
        const searchSpinner = document.getElementById('searchSpinner');
        
        searchBtn.disabled = true;
        searchBtnText.textContent = 'Searching...';
        searchSpinner.classList.remove('hidden');
        
        try {
            const formData = new FormData();
            formData.append('file', this.currentQueryFile);
            formData.append('dataset_path', db.path);
            formData.append('top_k', '5');
            
            const res = await fetch(`${BACKEND}/search`, {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            console.log('[Search] Response received:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (!data.results) {
                throw new Error('Invalid response: missing results');
            }
            
            this.currentSearchResults = data.results;
            this.currentQueryFileName = data.query_file;
            
            // Update UI
            this.displaySearchStats(data.stats, data.query_metadata);
            this.displaySingleSearchResults(data.results);
            
            // Add to history with extended metadata
            this.searchHistory.addSearch({
                queryFile: this.currentQueryFile.name,
                queryFilePath: this.currentQueryFile.path || null,  // Store full path for restore
                dataset: db.path,
                databaseName: db.name,
                timestamp: new Date().toISOString(),
                topMatch: data.results[0]?.filename || null,
                topSimilarity: data.results[0]?.similarity || null,
                allResults: data.results || [],  // Store all results for replay
                retrievalSettings: { top_k: this.currentSearchSettings?.top_k || 5 }
            });
            
        } catch (err) {
            console.error('[Search] Error:', err);
            this.showNotification(`Search failed: ${err.message}`, 'error');
        } finally {
            searchBtn.disabled = false;
            searchBtnText.textContent = 'Run Similarity Search';
            searchSpinner.classList.add('hidden');
        }
    }
    
    displaySearchStats(stats, queryMetadata) {
        const statsCard = document.getElementById('searchStatsCard');
        statsCard.classList.remove('hidden');
        
        // Defensive: handle missing or undefined stats object
        if (!stats) {
            console.warn('[Search] Stats object is undefined or null');
            stats = {};
        }
        
        document.getElementById('statTotalTime').textContent = stats.total_time || '--';
        document.getElementById('statExtractionTime').textContent = stats.feature_extraction_time || '--';
        document.getElementById('statRetrievalTime').textContent = stats.retrieval_time || '--';
        document.getElementById('statModelsCompared').textContent = stats.models_compared || '--';
        document.getElementById('statFeatureDim').textContent = stats.feature_dimension || '--';
        
        // Database size (get from cache status)
        const db = this.dbManager.getActiveDatabase();
        document.getElementById('statDatabaseSize').textContent = db?.modelCount || '--';
    }
    
    displaySingleSearchResults(results) {
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const exportPdfBtn = document.getElementById('exportPdfBtn');
        const viewersCard = document.getElementById('viewersCard');
        
        console.log('[displaySingleSearchResults] Rendering results:', results);
        
        if (!results || results.length === 0) {
            console.warn('[displaySingleSearchResults] No results to display');
            const container = document.getElementById('resultsContainer');
            if (container) {
                container.innerHTML = `
                    <div class="results-empty">
                        <div class="empty-state-icon">📭</div>
                        <div class="empty-state-text">No results found. Try a different query.</div>
                    </div>
                `;
            }
            if (exportCsvBtn) exportCsvBtn.disabled = true;
            if (exportPdfBtn) exportPdfBtn.disabled = true;
            if (viewersCard) viewersCard.classList.add('hidden');
            return;
        }
        
        console.log(`[displaySingleSearchResults] Displaying ${results.length} results`);
        
        // Initialize or update the search results table component
        if (!this.searchResultsTable) {
            this.searchResultsTable = new SearchResultsTable(
                'resultsContainer',
                (result, index) => this.loadComparisonModelForSingleSearch(index),
                (result) => {
                    if (this.metadataPanel) {
                        this.metadataPanel.updateMetadata(result);
                    }
                }
            );
        }
        
        // Render all results in one table, in original rank order
        this.searchResultsTable.render(results, true);
        
        // Enable export buttons
        if (exportCsvBtn) exportCsvBtn.disabled = false;
        if (exportPdfBtn) exportPdfBtn.disabled = false;
        if (viewersCard) viewersCard.classList.remove('hidden');
        
        console.log('[displaySingleSearchResults] Initializing 3D viewers');
        
        // Initialize 3D viewers for top results
        this.initSingleSearchViewers(results);
    }
    
    
    async initSingleSearchViewers(results) {
        const viewersCard = document.getElementById('viewersCard');
        const db = this.dbManager.getActiveDatabase();
        
        if (!db || !results || results.length === 0) {
            viewersCard.classList.add('hidden');
            return;
        }

        viewersCard.classList.remove('hidden');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        try {
            if (!this.comparisonViewer) {
                this.comparisonViewer = new ComparisonViewer();
                const initialized = await this.comparisonViewer.init(db.path);
                
                if (!initialized) {
                    console.error('[App] Failed to initialize viewers');
                    return;
                }
                
                // Load query
                if (this.currentQueryFile) {
                    await this.comparisonViewer.loadQueryFromFile(this.currentQueryFile);
                }
            } else {
                this.comparisonViewer.datasetPath = db.path;
            }
        } catch (err) {
            console.error('[App] Error initializing viewers:', err);
            viewersCard.classList.add('hidden');
            return;
        }
        
        // Load best match and update display
        if (results.length > 0) {
            this.loadComparisonModelForSingleSearch(0);
        }
    }
    
    async loadComparisonModelForSingleSearch(index) {
        if (!this.comparisonViewer || !this.currentSearchResults) return;
        
        const result = this.currentSearchResults[index];
        if (!result) return;
        
        try {
            await this.comparisonViewer.loadBestMatch(result.filename);
            
            const pathParts = result.filename.replace(/\\/g, '/').split('/');
            const modelName = pathParts[pathParts.length - 1];
            document.getElementById('currentlyViewingFilename').textContent = modelName;
        } catch (err) {
            console.error('[App] Error loading match:', err);
        }
    }
    
    // ============================================================
    // BATCH SEARCH
    // ============================================================
    
    initBatchSearch() {
        this.batchSearchFiles = [];
        this.batchSearchResults = {};
        this.batchFailedIndices = [];
        
        const dropZone = document.getElementById('batchDropZone');
        const fileInput = document.getElementById('batchFolderInput');
        const runBatchBtn = document.getElementById('runBatchSearchBtn');
        
        // Click to browse
        dropZone.addEventListener('click', () => fileInput.click());
        
        // File input change
        fileInput.addEventListener('change', () => {
            this.processBatchFiles(fileInput.files);
        });
        
        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.processBatchFiles(e.dataTransfer.files);
        });
        
        // Run batch search button
        runBatchBtn.addEventListener('click', () => this.runBatchSearch());
        
        // Export buttons
        document.getElementById('exportBatchCsvBtn').addEventListener('click', () => this.exportBatchResults('csv'));
        document.getElementById('exportBatchPdfBtn').addEventListener('click', () => this.exportBatchResults('pdf'));
        
        // Retry failed button
        document.getElementById('retryFailedBtn').addEventListener('click', () => this.retryFailedBatchItems());
    }
    
    processBatchFiles(fileList) {
        this.batchSearchFiles = [];
        
        for (let file of fileList) {
            if (file.name.toLowerCase().endsWith('.stl')) {
                this.batchSearchFiles.push(file);
            }
        }
        
        const dropZone = document.getElementById('batchDropZone');
        const fileCountEl = document.getElementById('batchFileCount');
        const runBatchBtn = document.getElementById('runBatchSearchBtn');
        
        if (this.batchSearchFiles.length > 0) {
            dropZone.classList.add('has-file');
            fileCountEl.textContent = `${this.batchSearchFiles.length} STL file(s) selected`;
            fileCountEl.classList.remove('hidden');
            runBatchBtn.disabled = false;
        } else {
            dropZone.classList.remove('has-file');
            fileCountEl.classList.add('hidden');
            runBatchBtn.disabled = true;
            this.showNotification('No .STL files found in selection', 'warning');
        }
    }
    
    async runBatchSearch() {
        if (this.batchSearchFiles.length === 0) {
            this.showNotification('Please select STL files first', 'error');
            return;
        }
        
        const db = this.dbManager.getActiveDatabase();
        if (!db) {
            this.showNotification('Please select a database first', 'error');
            return;
        }
        
        // Show progress dialog
        // Show inline progress bar
        const progressContainer = document.getElementById('batchSearchProgressContainer');
        const progressBar = document.getElementById('batchSearchProgressBar');
        const progressText = document.getElementById('batchSearchProgressText');
        
        const runBatchBtn = document.getElementById('runBatchSearchBtn');
        if (runBatchBtn) runBatchBtn.disabled = true;
        
        this.batchSearchResults = {};
        this.batchFailedIndices = [];
        
        try {
            // Create progress container if it doesn't exist
            let container = progressContainer;
            if (!container) {
                const card = document.getElementById('batchSearchCard');
                if (card) {
                    container = document.createElement('div');
                    container.id = 'batchSearchProgressContainer';
                    container.style.marginTop = '16px';
                    container.style.padding = '12px';
                    container.style.background = 'rgba(255,255,255,0.7)';
                    container.style.borderRadius = 'var(--radius-md)';
                    container.style.border = '1px solid rgba(0,0,0,0.08)';
                    card.appendChild(container);
                    
                    const label = document.createElement('div');
                    label.style.fontSize = '12px';
                    label.style.fontWeight = '600';
                    label.style.textTransform = 'uppercase';
                    label.style.letterSpacing = '0.5px';
                    label.style.color = '#9CA3AF';
                    label.style.marginBottom = '8px';
                    label.textContent = 'Batch Search Progress';
                    container.appendChild(label);
                    
                    const textDiv = document.createElement('div');
                    textDiv.id = 'batchSearchProgressText';
                    textDiv.style.fontSize = '13px';
                    textDiv.style.color = '#333';
                    textDiv.style.marginBottom = '8px';
                    textDiv.textContent = 'Starting search...';
                    container.appendChild(textDiv);
                    
                    const barContainer = document.createElement('div');
                    barContainer.className = 'progress-bar';
                    const bar = document.createElement('div');
                    bar.id = 'batchSearchProgressBar';
                    bar.className = 'progress-fill';
                    bar.style.width = '0%';
                    barContainer.appendChild(bar);
                    container.appendChild(barContainer);
                }
            }
            
            for (let i = 0; i < this.batchSearchFiles.length; i++) {
                const file = this.batchSearchFiles[i];
                const percent = Math.round(((i + 1) / this.batchSearchFiles.length) * 100);
                
                if (progressText) {
                    progressText.textContent = `Searching... ${i + 1} of ${this.batchSearchFiles.length} processed`;
                }
                if (progressBar) {
                    progressBar.style.width = `${percent}%`;
                }
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('dataset_path', db.path);
                    formData.append('top_k', '5');
                    
                    const res = await fetch(`${BACKEND}/search`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await res.json();
                    
                    if (data.error || !data.results) {
                        this.batchSearchResults[file.name] = {
                            status: 'failed',
                            error: data.error || 'Invalid response',
                            results: []
                        };
                        this.batchFailedIndices.push(i);
                    } else {
                        this.batchSearchResults[file.name] = {
                            status: 'success',
                            results: data.results,
                            filename: file.name
                        };
                    }
                } catch (err) {
                    this.batchSearchResults[file.name] = {
                        status: 'failed',
                        error: err.message,
                        results: []
                    };
                    this.batchFailedIndices.push(i);
                }
            }
            
            // Complete
            if (progressText) progressText.textContent = `✓ Search complete: ${Object.keys(this.batchSearchResults).length} results`;
            if (progressBar) progressBar.style.width = '100%';
            
            // Hide progress after 1 second and display results
            setTimeout(() => {
                if (progressContainer && progressContainer.parentNode) {
                    progressContainer.parentNode.removeChild(progressContainer);
                }
                this.displayBatchSearchResults();
            }, 1000);
            
        } catch (err) {
            console.error('[Batch] Error:', err);
            if (progressText) progressText.textContent = `✗ Search failed: ${err.message}`;
            this.showNotification(`Batch search failed: ${err.message}`, 'error');
        } finally {
            if (runBatchBtn) runBatchBtn.disabled = false;
        }
    }
    
    displayBatchSearchResults() {
        const batchResultsCard = document.getElementById('batchResultsCard');
        const resultsList = document.getElementById('batchResultsList');
        const retryBtn = document.getElementById('retryFailedBtn');
        const exportCsvBtn = document.getElementById('exportBatchCsvBtn');
        const exportPdfBtn = document.getElementById('exportBatchPdfBtn');

        batchResultsCard.classList.remove('hidden');

        if (Object.keys(this.batchSearchResults).length === 0) {
            resultsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">No results yet</div>
                </div>
            `;
            return;
        }

        let rowCount = 0;
        resultsList.innerHTML = Object.entries(this.batchSearchResults).map(([filename, result], index) => {
            rowCount++;
            const bestMatch = result.results && result.results.length > 0 ? result.results[0] : null;
            const bestMatchName = bestMatch ? bestMatch.filename.split('/').pop().split('\\').pop() : '—';
            const statusClass = result.status === 'success' ? 'status-success' : 'status-failed';
            const statusText = result.status === 'success' ? 'Success' : 'Failed';
            const escapedFilename = this.escapeHtml(filename);
            const escapedBest = this.escapeHtml(bestMatchName);
            const escapedMatchPath = bestMatch ? this.escapeHtml(bestMatch.filename) : '';

            return `
                <div class="batch-result-card" data-index="${index}">
                    <div class="batch-result-header" onclick="app.toggleBatchResult(${index})">
                        <div class="batch-result-expand">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="batch-result-query">${escapedFilename}</div>
                            <div class="batch-result-match">Best match: ${escapedBest}</div>
                        </div>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                        ${result.status === 'success' && bestMatch ? `
                            <button class="${buttonClasses({ variant: 'secondary', size: 'sm', extra: 'btn-icon' })}" onclick="event.stopPropagation(); app.downloadResult('${escapedMatchPath}')" title="Download" type="button" aria-label="Download">
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            </button>
                        ` : ''}
                    </div>
                    <div class="batch-result-body">
                        ${result.status === 'failed' ? `<p style="color: var(--error); font-size: 14px; margin-bottom: 8px;">${this.escapeHtml(result.error || 'Unknown error')}</p>` : ''}
                        ${bestMatch ? `<p style="color: var(--text-secondary); font-size: 14px;">Full path: ${escapedMatchPath}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        retryBtn.disabled = this.batchFailedIndices.length === 0;
        exportCsvBtn.disabled = false;
        exportPdfBtn.disabled = false;

        if (this.batchFailedIndices.length > 0) {
            this.showNotification(`${this.batchFailedIndices.length} item(s) failed. Use "Retry Failed" to try again.`, 'warning');
        }
    }

    toggleBatchResult(index) {
        const cards = document.querySelectorAll('.batch-result-card');
        cards.forEach((card, i) => {
            if (parseInt(card.getAttribute('data-index')) === index) {
                card.classList.toggle('expanded');
            }
        });
    }

    async retryFailedBatchItems() {
        if (this.batchFailedIndices.length === 0) {
            this.showNotification('No failed items to retry', 'info');
            return;
        }
        
        const db = this.dbManager.getActiveDatabase();
        if (!db) return;
        
        // Show inline progress bar
        let progressContainer = document.getElementById('batchSearchProgressContainer');
        if (!progressContainer) {
            const card = document.getElementById('batchResultsCard');
            if (card) {
                progressContainer = document.createElement('div');
                progressContainer.id = 'batchSearchProgressContainer';
                progressContainer.style.marginTop = '16px';
                progressContainer.style.padding = '12px';
                progressContainer.style.background = 'rgba(255,255,255,0.7)';
                progressContainer.style.borderRadius = 'var(--radius-md)';
                progressContainer.style.border = '1px solid rgba(0,0,0,0.08)';
                card.insertBefore(progressContainer, card.firstChild);
                
                const label = document.createElement('div');
                label.style.fontSize = '12px';
                label.style.fontWeight = '600';
                label.style.textTransform = 'uppercase';
                label.style.letterSpacing = '0.5px';
                label.style.color = '#9CA3AF';
                label.style.marginBottom = '8px';
                label.textContent = 'Retry Progress';
                progressContainer.appendChild(label);
                
                const textDiv = document.createElement('div');
                textDiv.id = 'batchSearchProgressText';
                textDiv.style.fontSize = '13px';
                textDiv.style.color = '#333';
                textDiv.style.marginBottom = '8px';
                textDiv.textContent = 'Starting retry...';
                progressContainer.appendChild(textDiv);
                
                const barContainer = document.createElement('div');
                barContainer.className = 'progress-bar';
                const bar = document.createElement('div');
                bar.id = 'batchSearchProgressBar';
                bar.className = 'progress-fill';
                bar.style.width = '0%';
                barContainer.appendChild(bar);
                progressContainer.appendChild(barContainer);
            }
        }
        
        const progressText = document.getElementById('batchSearchProgressText');
        const progressBar = document.getElementById('batchSearchProgressBar');
        const retryBtn = document.getElementById('retryFailedBtn');
        if (retryBtn) retryBtn.disabled = true;
        
        const retryIndices = [...this.batchFailedIndices];
        this.batchFailedIndices = [];
        
        try {
            for (let i = 0; i < retryIndices.length; i++) {
                const idx = retryIndices[i];
                const file = this.batchSearchFiles[idx];
                
                const percent = Math.round(((i + 1) / retryIndices.length) * 100);
                
                if (progressText) {
                    progressText.textContent = `Retrying... ${i + 1} of ${retryIndices.length} processed`;
                }
                if (progressBar) {
                    progressBar.style.width = `${percent}%`;
                }
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('dataset_path', db.path);
                    formData.append('top_k', '5');
                    
                    const res = await fetch(`${BACKEND}/search`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await res.json();
                    
                    if (data.error || !data.results) {
                        this.batchSearchResults[file.name] = {
                            status: 'failed',
                            error: data.error || 'Invalid response',
                            results: []
                        };
                        this.batchFailedIndices.push(idx);
                    } else {
                        this.batchSearchResults[file.name] = {
                            status: 'success',
                            results: data.results,
                            filename: file.name
                        };
                    }
                } catch (err) {
                    this.batchSearchResults[file.name] = {
                        status: 'failed',
                        error: err.message,
                        results: []
                    };
                    this.batchFailedIndices.push(idx);
                }
            }
            
            // Complete
            if (progressText) progressText.textContent = `✓ Retry complete: ${retryIndices.length - this.batchFailedIndices.length} recovered`;
            if (progressBar) progressBar.style.width = '100%';
            
            // Hide progress and refresh results
            setTimeout(() => {
                if (progressContainer && progressContainer.parentNode) {
                    progressContainer.parentNode.removeChild(progressContainer);
                }
                this.displayBatchSearchResults();
            }, 1000);
            
        } catch (err) {
            console.error('[Batch] Retry error:', err);
            if (progressText) progressText.textContent = `✗ Retry failed: ${err.message}`;
            this.showNotification(`Retry failed: ${err.message}`, 'error');
        } finally {
            if (retryBtn) retryBtn.disabled = false;
        }
    }

    async downloadResult(filename) {
        const db = this.dbManager.getActiveDatabase();
        if (!db) return;
        
        const fullPath = [db.path, filename].join('/').replace(/\\/g, '/');
        
        try {
            const savedPath = await window.electronAPI.saveFile(fullPath, filename);
            if (savedPath) {
                this.showNotification(`File saved: ${savedPath}`, 'success');
            }
        } catch (err) {
            this.showNotification(`Download failed: ${err.message}`, 'error');
        }
    }
    

    async exportSingleSearchResults(format) {
        if (!this.currentSearchResults || this.currentSearchResults.length === 0) {
            this.showNotification('No results to export', 'error');
            return;
        }
        
        const payload = {
            query_filename: this.currentQueryFile.name,
            results: this.currentSearchResults,
            format: format,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            batch: false
        };
        
        try {
            const res = await fetch(`${BACKEND}/export-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error('Export failed');
            
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qrcad_report_${this.currentQueryFile.name.replace('.stl', '')}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification(`Report exported as ${format.toUpperCase()}`, 'success');
        } catch (err) {
            this.showNotification(`Export failed: ${err.message}`, 'error');
        }
    }
    
    async exportBatchResults(format) {
        if (Object.keys(this.batchSearchResults).length === 0) {
            this.showNotification('No results to export', 'error');
            return;
        }
        
        // Transform results to backend batch_data format
        const batchData = Object.entries(this.batchSearchResults).map(([filename, result]) => ({
            query_filename: filename,
            results: result.results || [],
            status: result.status,
            error: result.error
        }));
        
        const payload = {
            batch_data: batchData,
            format: format,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            batch: true
        };
        
        try {
            const res = await fetch(`${BACKEND}/export-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Export failed (${res.status})`);
            }
            
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qrcad_batch_report_${new Date().getTime()}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification(`Batch report exported as ${format.toUpperCase()}`, 'success');
        } catch (err) {
            console.error('[Export] Batch export error:', err);
            this.showNotification(`Export failed: ${err.message}`, 'error');
        }
    }
    
    // ============================================================
    // SEARCH HISTORY
    // ============================================================
    
    initSearchHistory() {
        this.renderSearchHistory();
        
        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            if (confirm('Clear all search history?')) {
                this.searchHistory.clear();
                this.renderSearchHistory();
                this.showNotification('Search history cleared', 'success');
            }
        });
    }
    
    renderSearchHistory() {
        const container = document.getElementById('historyList');
        const history = this.searchHistory.getRecent(20);
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="48" height="48"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                    </div>
                    <div class="empty-state-text">No search history yet</div>
                    <div class="empty-state-desc">Run a search to start building your history</div>
                </div>
            `;
            return;
        }

        container.innerHTML = history.map(entry => `
            <div class="history-entry">
                <div class="history-entry-time">${this.searchHistory.formatTimestamp(entry.timestamp)}</div>
                <div class="history-entry-query">${this.escapeHtml(entry.queryFile)}</div>
                <div class="history-entry-meta">
                    Top match: ${entry.topMatch ? this.escapeHtml(entry.topMatch) : 'N/A'}
                    ${entry.databaseName ? ` · ${this.escapeHtml(entry.databaseName)}` : ''}
                </div>
                <div class="history-entry-actions">
                    <button class="${buttonClasses({ variant: 'destructive', size: 'sm' })}" onclick="app.deleteHistoryEntry('${entry.id}')" type="button">Delete</button>
                </div>
            </div>
        `).join('');
    }
    
    deleteHistoryEntry(id) {
        this.searchHistory.remove(id);
        this.renderSearchHistory();
    }
    
    async updateBuildProgress(dbId) {
        try {
            const res = await fetch(`${BACKEND}/build-progress`);
            const progress = await res.json();
            
            if (progress.error) {
                console.error('Failed to get build progress:', progress.error);
                return;
            }
            
            // Find progress display element (if it exists)
            const progressEl = document.getElementById(`build-progress-${dbId}`);
            if (!progressEl) return;
            
            if (progress.status === 'building') {
                const percent = progress.total_files > 0 
                    ? Math.round((progress.files_completed / progress.total_files) * 100) 
                    : 0;
                
                progressEl.innerHTML = `
                    <div class="alert alert-info" style="margin-top: 12px;">
                        <strong>Building Cache...</strong><br>
                        ${progress.files_completed} of ${progress.total_files} models processed
                        <div class="progress-bar" style="margin-top: 8px;">
                            <div class="progress-fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            } else if (progress.status === 'done') {
                progressEl.innerHTML = `
                    <div class="alert alert-success" style="margin-top: 12px;">
                        <strong>Build Complete!</strong> Processed ${progress.files_completed} models
                    </div>
                `;
                
                // Stop polling after a short delay
                setTimeout(() => {
                    if (this.buildProgressInterval) {
                        clearInterval(this.buildProgressInterval);
                        this.buildProgressInterval = null;
                    }
                    this.renderDatabaseList(); // Refresh list
                }, 2000);
            }
        } catch (err) {
            console.error('Error fetching build progress:', err);
        }
    }
    
    formatTime(seconds) {
        if (!seconds || seconds < 0) return '0s';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    }
    
    // ============================================================
    // CACHE DASHBOARD
    // ============================================================
    
    initCacheDashboard() {
        this.renderCacheDashboard();
        
        const rebuildBtn = document.getElementById('rebuildCacheBtn');
        const deleteBtn = document.getElementById('deleteCacheBtn');
        
        const db = this.dbManager.getActiveDatabase();
        
        if (db) {
            rebuildBtn.disabled = false;
            deleteBtn.disabled = !db.cacheExists;
            
            rebuildBtn.addEventListener('click', () => this.buildDatabaseCache(db.id));
            deleteBtn.addEventListener('click', () => this.deleteDatabaseCache(db.id));
        }
    }
    
    async renderCacheDashboard() {
        const container = document.getElementById('cacheStatusContent');
        const db = this.dbManager.getActiveDatabase();
        
        if (!db) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">Select a database to view cache information</div>
                </div>
            `;
            return;
        }
        
        const status = await this.dbManager.getCacheStatus(db.path);
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Status</div>
                    <div class="stat-value">
                        <span class="badge ${status.exists ? 'badge-success' : 'badge-error'}">
                            ${status.exists ? 'Ready' : 'Missing'}
                        </span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Models Indexed</div>
                    <div class="stat-value">${status.models || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Cache Size</div>
                    <div class="stat-value">
                        ${status.cache_size_bytes ? (status.cache_size_bytes / (1024 * 1024)).toFixed(2) : '--'}
                        <span class="stat-unit">MB</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Last Updated</div>
                    <div class="stat-value" style="font-size: 14px;">
                        ${status.last_modified ? new Date(status.last_modified * 1000).toLocaleString() : 'Never'}
                    </div>
                </div>
            </div>
            
            ${status.needs_rebuild ? `
                <div class="alert alert-warning" style="margin-top: 16px;">
                    <strong>Cache Update Available:</strong> This cache uses an older format. Rebuild to enable metadata features.
                </div>
            ` : ''}
        `;
    }
    
    async deleteDatabaseCache(id) {
        if (!confirm('Delete cache? You can rebuild it later.')) return;
        
        const db = this.dbManager.getAllDatabases().find(d => d.id === id);
        if (!db) return;
        
        const result = await this.dbManager.deleteCache(db.path);
        
        if (result.success) {
            this.showNotification('Cache deleted', 'success');
            this.renderCacheDashboard();
            this.updateCacheStatus();
        } else {
            this.showNotification('Cache deletion failed', 'error');
        }
    }
    
    // ============================================================
    // UTILITIES
    // ============================================================
    
    onDatabaseChanged(db) {
        if (!db) {
            if (this.activeDatabaseName) {
                this.activeDatabaseName.textContent = 'No database selected';
            }
            this.updateActiveDatabaseDisplay(null);
        } else {
            // Show database name with model count
            const modelCountText = db.modelCount ? ` · ${db.modelCount.toLocaleString()} models` : '';
            if (this.activeDatabaseName) {
                this.activeDatabaseName.textContent = db.name + modelCountText;
            }
            this.updateActiveDatabaseDisplay(db);
        }
        this.updateCacheStatus();
    }
    
    async updateCacheStatus(db = null) {
        const database = db || this.dbManager.getActiveDatabase();
        
        if (!database) {
            this.cacheStatusBadge.className = 'cache-status-badge missing';
            this.cacheStatusText.textContent = 'No Database';
            return;
        }
        
        const status = await this.dbManager.getCacheStatus(database.path);
        
        if (status.exists) {
            this.cacheStatusBadge.className = 'cache-status-badge ready';
            this.cacheStatusText.textContent = 'Cache Ready';
        } else {
            this.cacheStatusBadge.className = 'cache-status-badge missing';
            this.cacheStatusText.textContent = 'No Cache';
        }
    }
    
    async checkBackendStatus() {
        try {
            const res = await fetch(`${BACKEND}/`);
            if (res.ok) {
                console.log('[QRCAD] Backend online');
            }
        } catch (e) {
            console.error('[QRCAD] Backend offline:', e);
            this.showNotification('Backend connection lost', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);

        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-accent"></div>
            <div class="toast-body">${this.escapeHtml(message)}</div>
            <button class="toast-close" aria-label="Dismiss">×</button>
        `;

        const dismiss = () => {
            toast.classList.add('toast-exit');
            setTimeout(() => {
                toast.remove();
                const idx = this.activeNotifications.findIndex(n => n.element === toast);
                if (idx !== -1) this.activeNotifications.splice(idx, 1);
            }, 200);
        };

        toast.querySelector('.toast-close').addEventListener('click', dismiss);
        container.appendChild(toast);

        const notificationObj = { element: toast, timeout: setTimeout(dismiss, 4000) };
        this.activeNotifications.push(notificationObj);
    }
    
    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    setupMetadataPanelClose() {
        const closeBtn = document.getElementById('closeInfoPanel');
        const infoPanel = document.getElementById('infoPanel');
        const overlay = document.getElementById('infoPanelOverlay');

        const close = () => {
            if (this.metadataPanel) {
                this.metadataPanel.hide();
            } else if (infoPanel) {
                infoPanel.classList.remove('open');
                if (overlay) overlay.classList.remove('open');
                setTimeout(() => infoPanel.classList.add('hidden'), 300);
            }
        };

        if (closeBtn) closeBtn.addEventListener('click', close);
        if (overlay) overlay.addEventListener('click', close);
    }
    
    showHelpModal() {
        // Create modal overlay
        let modal = document.getElementById('helpModal');
        if (modal) {
            modal.classList.remove('hidden');
            return;
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'helpModal';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(10, 14, 39, 0.5);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 16px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            background: linear-gradient(135deg, rgba(91, 127, 255, 0.05), rgba(74, 110, 232, 0.02));
        `;
        
        const title = document.createElement('h2');
        title.style.cssText = 'margin: 0; font-size: 20px; font-weight: 600; color: #111827;';
        title.textContent = 'How to Use QRCAD';
        header.appendChild(title);
        
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            color: #9CA3AF;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: all 0.2s;
        `;
        closeBtn.textContent = '✕';
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'rgba(0, 0, 0, 0.08)';
            closeBtn.style.color = '#111827';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'none';
            closeBtn.style.color = '#9CA3AF';
        };
        closeBtn.addEventListener('click', () => overlay.remove());
        header.appendChild(closeBtn);
        
        panel.appendChild(header);
        
        const content = document.createElement('div');
        content.style.cssText = 'padding: 24px; color: #111827; font-size: 14px; line-height: 1.6;';
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">1. Select or Create a Database</h3>
                    <p style="margin: 0; color: #6B7280;">
                        From the Databases view, select an existing database from the list or click "+ New Database" to add a folder containing your STL 3D model files. The app will automatically scan the folder and count the models.
                    </p>
                </div>
                
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">2. Build the Cache (Index)</h3>
                    <p style="margin: 0; color: #6B7280;">
                        Click "Rebuild Index" next to your database. This creates a searchable index of all models using shape feature analysis. You'll see a progress bar showing the indexing status. This step is one-time only per database.
                    </p>
                </div>
                
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">3. Select the Database & Run a Search</h3>
                    <p style="margin: 0; color: #6B7280;">
                        Click the "Select" button to activate a database for searching. Then choose your search mode:
                    </p>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #6B7280;">
                        <li><strong>Single Search:</strong> Upload one STL file to find similar models in the database. View ranked results with 3D comparison viewer.</li>
                        <li><strong>Batch Search:</strong> Upload multiple STL files at once to search them all together.</li>
                    </ul>
                </div>
                
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">4. Review Results & Export</h3>
                    <p style="margin: 0; color: #6B7280;">
                        Results are ranked by similarity. For single searches, view 3D comparisons by clicking any result row. Export your results as CSV or PDF for reports and documentation.
                    </p>
                </div>
                
                <div style="padding: 12px; background: rgba(91, 127, 255, 0.05); border-left: 3px solid #5B7FFF; border-radius: 6px;">
                    <p style="margin: 0; font-size: 13px; color: #5B7FFF; font-weight: 500;">
                        💡 <strong>Tip:</strong> Cache building and searching work best with databases of 500–50,000 models. For very large databases (100K+ models), consider splitting into smaller focused datasets.
                    </p>
                </div>
            </div>
        `;
        
        panel.appendChild(content);
        overlay.appendChild(panel);
        
        // Close on background click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        
        document.body.appendChild(overlay);
    }
    
    updateActiveDatabaseDisplay(db) {
        const displayContainer = document.getElementById('activeDatabaseDisplay');
        const nameEl = document.getElementById('activeDatabaseName');
        
        // **Defensive null checks: these elements may not exist in current layout**
        if (!displayContainer || !nameEl) return;
        
        if (db && db.name) {
            nameEl.textContent = db.name;
            displayContainer.style.display = 'flex';
            displayContainer.removeAttribute('data-empty');
        } else {
            nameEl.textContent = '';
            displayContainer.style.display = 'none';
            displayContainer.setAttribute('data-empty', 'true');
        }
    }
}

// Initialize app
const app = new QRCADApp();

// Make app globally accessible for onclick handlers
window.app = app;

console.log('[QRCAD] Application loaded');