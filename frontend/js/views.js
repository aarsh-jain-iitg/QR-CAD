/**
 * QRCAD v2.0 - View Templates
 * HTML templates for different views
 */

export const Views = {

    /**
     * Dashboard – Application Home
     */
    dashboard: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Dashboard</h1>
            <p class="workspace-subtitle">Your CAD retrieval command center</p>
        </div>

        <div class="dashboard-grid">
            <div class="dashboard-welcome">
                <h2 id="dashboardWelcomeText">Welcome to QRCAD</h2>
                <p id="dashboardWelcomeSub">Premium 3D shape retrieval for mechanical engineering workflows</p>
            </div>

            <div class="card dashboard-current-db">
                <div class="card-title">Current Database</div>
                <div id="dashboardCurrentDb">
                    <div class="empty-state" style="padding: 24px;">
                        <div class="empty-state-text">No database selected</div>
                        <div class="empty-state-desc">Create or select a database to begin searching</div>
                        <button class="btn btn-primary" style="margin-top: 16px;" onclick="app.loadView('database-manager')">Open Database Manager</button>
                    </div>
                </div>
            </div>

            <div class="card dashboard-status">
                <div class="card-title">Application Status</div>
                <div class="status-list" id="dashboardStatusList">
                    <div class="status-item">
                        <span class="status-item-label">Backend</span>
                        <span class="status-item-value" id="dashboardBackendStatus">Checking...</span>
                    </div>
                    <div class="status-item">
                        <span class="status-item-label">Cache</span>
                        <span class="status-item-value" id="dashboardCacheStatus">—</span>
                    </div>
                    <div class="status-item">
                        <span class="status-item-label">Active Database</span>
                        <span class="status-item-value" id="dashboardActiveDbName">None</span>
                    </div>
                </div>
            </div>

            <div class="dashboard-quick-actions">
                <div class="card-title" style="margin-bottom: 16px;">Quick Actions</div>
                <div class="quick-actions-grid">
                    <div class="quick-action-card" onclick="app.navigateFromDashboard('single')">
                        <div class="quick-action-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
                        </div>
                        <div class="quick-action-title">Single Search</div>
                        <div class="quick-action-desc">Upload one STL and find similar shapes with 3D preview</div>
                    </div>
                    <div class="quick-action-card" onclick="app.navigateFromDashboard('batch')">
                        <div class="quick-action-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                        </div>
                        <div class="quick-action-title">Batch Search</div>
                        <div class="quick-action-desc">Process an entire folder of models at once</div>
                    </div>
                    <div class="quick-action-card" onclick="app.loadView('database-manager')">
                        <div class="quick-action-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path></svg>
                        </div>
                        <div class="quick-action-title">Database Manager</div>
                        <div class="quick-action-desc">Create, index, and manage your model libraries</div>
                    </div>
                    <div class="quick-action-card" onclick="app.loadView('search-history')">
                        <div class="quick-action-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                        </div>
                        <div class="quick-action-title">History</div>
                        <div class="quick-action-desc">Review and reopen your recent searches</div>
                    </div>
                </div>
            </div>

            <div class="card dashboard-recent" id="dashboardRecentCard">
                <div class="card-header">
                    <div class="card-title">Recent Databases</div>
                </div>
                <div id="dashboardRecentList" class="recent-db-container">
                    <div class="empty-state" style="padding: 24px;">
                        <div class="empty-state-text">No recent databases</div>
                    </div>
                </div>
            </div>
        </div>
    `,

    searchModeSelection: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Choose Search Mode</h1>
            <p class="workspace-subtitle">Select how you want to search for 3D models</p>
        </div>
        
        <div class="search-mode-container">
            <div class="search-mode-card" id="singleSearchCard">
                <div class="search-mode-icon">
                    <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="16" cy="16" r="11"></circle><path d="m27 27-5-5"></path></svg>
                </div>
                <div class="search-mode-title">Single Search</div>
                <div class="search-mode-description">Upload one 3D model to find similar shapes in the database</div>
                <div class="search-mode-features">
                    <div class="feature">3D preview of query and results</div>
                    <div class="feature">Detailed match ranking</div>
                    <div class="feature">Download matched models</div>
                    <div class="feature">Export search report</div>
                </div>
                <button class="btn btn-primary btn-block" onclick="app.selectSearchMode('single')">
                    Start Single Search
                </button>
            </div>
            
            <div class="search-mode-card" id="batchSearchCard">
                <div class="search-mode-icon">
                    <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M28 22V12a2 2 0 0 0-1-1.73l-9-5.2a2 2 0 0 0-2 0l-9 5.2A2 2 0 0 0 6 12v10a2 2 0 0 0 1 1.73l9 5.2a2 2 0 0 0 2 0l9-5.2A2 2 0 0 0 28 22z"></path></svg>
                </div>
                <div class="search-mode-title">Batch Search</div>
                <div class="search-mode-description">Upload a folder of models to search them all at once</div>
                <div class="search-mode-features">
                    <div class="feature">Process multiple models</div>
                    <div class="feature">Expandable result cards</div>
                    <div class="feature">Retry failed searches</div>
                    <div class="feature">Export batch report</div>
                </div>
                <button class="btn btn-primary btn-block" onclick="app.selectSearchMode('batch')">
                    Start Batch Search
                </button>
            </div>
        </div>
    `,
    
    /**
     * Single Search View
     */
    singleSearch: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Single Search</h1>
            <p class="workspace-subtitle">Upload a 3D model to find similar shapes</p>
            <button class="btn btn-secondary btn-sm" onclick="app.backToSearchMode()">
                ← Back to Mode Selection
            </button>
        </div>
        
        <div class="card">
            <div class="card-title">Upload Query Model</div>
            
            <div class="upload-zone" id="queryDropZone">
                <input type="file" id="queryFileInput" accept=".stl" style="display: none;">
                <div class="upload-icon-large">
                    <svg width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                </div>
                <div class="upload-text-large">Upload an STL model</div>
                <div class="upload-hint">Drag & Drop or Click to Browse</div>
                <div class="upload-hint-small">Supported: .STL files</div>
                <div class="upload-filename hidden" id="queryFilename"></div>
            </div>
            
            <div class="btn-group" style="margin-top: 16px;">
                <button class="btn btn-primary btn-wide" id="runSearchBtn" disabled>
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="8" cy="8" r="6"></circle>
                        <path d="M14 14l-3-3"></path>
                    </svg>
                    <span id="searchBtnText">Run Similarity Search</span>
                    <span class="spinner hidden" id="searchSpinner"></span>
                </button>
            </div>
        </div>
        
        <!-- Search Statistics -->
        <div class="card hidden" id="searchStatsCard">
            <div class="card-title">Search Statistics</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Total Time</div>
                    <div class="stat-value"><span id="statTotalTime">--</span><span class="stat-unit">s</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Feature Extraction</div>
                    <div class="stat-value"><span id="statExtractionTime">--</span><span class="stat-unit">s</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Retrieval Time</div>
                    <div class="stat-value"><span id="statRetrievalTime">--</span><span class="stat-unit">s</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Models Compared</div>
                    <div class="stat-value" id="statModelsCompared">--</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Feature Dimension</div>
                    <div class="stat-value" id="statFeatureDim">--</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Database Size</div>
                    <div class="stat-value" id="statDatabaseSize">--</div>
                </div>
            </div>
        </div>
        
        <!-- 3D Model Viewers (Independent Renderers) -->
        <div class="card hidden" id="viewersCard">
            <div class="card-title">3D Model Comparison</div>
            
            <p class="viewer-hint" style="margin-bottom: 16px; margin-top: 0;">
                Click any search result below to preview the matched CAD model
            </p>
            
            <div class="viewers-grid">
                <div class="viewer-panel">
                    <div class="viewer-label viewer-label--query">
                        <span class="viewer-label-accent" aria-hidden="true"></span>
                        Query Model
                    </div>
                    <div id="viewer-query" class="viewer-container"></div>
                </div>
                <div class="viewer-panel">
                    <div class="viewer-label viewer-label--match">
                        <span class="viewer-label-accent" aria-hidden="true"></span>
                        Best Match
                    </div>
                    <div id="viewer-match" class="viewer-container"></div>
                </div>
            </div>
            
            <div class="viewer-filename-bar">
                <div class="viewer-filename-label">Currently Viewing</div>
                <div class="viewer-filename-value" id="currentlyViewingFilename">—</div>
            </div>
            
            <div class="viewer-hint">
                <strong>Controls:</strong> Drag to rotate · Scroll to zoom · Right-click drag to pan · Each viewer has independent camera
            </div>
        </div>
        
        <!-- Results Container (for new enhanced table component) -->
        <div id="resultsContainer" style="margin-top: 0;"></div>
        
        <!-- Export Buttons (for compatibility, can be hidden) -->
        <div class="card hidden" id="exportButtonsCard">
            <div class="btn-group">
                <button class="btn btn-secondary" id="exportCsvBtn" disabled>
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2H4a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z"></path>
                    </svg>
                    Export CSV
                </button>
                <button class="btn btn-secondary" id="exportPdfBtn" disabled>
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 2v4l4 4-4 4v-4H2V6h8V2z"></path>
                    </svg>
                    Export PDF
                </button>
            </div>
        </div>
    `,
    
    /**
     * Batch Search View
     */
    batchSearch: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Batch Search</h1>
            <p class="workspace-subtitle">Upload a folder of 3D models to search them all at once</p>
            <button class="btn btn-secondary btn-sm" onclick="app.backToSearchMode()">
                ← Back to Mode Selection
            </button>
        </div>
        
        <div class="card">
            <div class="card-title">Upload Folder</div>
            
            <div class="upload-zone" id="batchDropZone">
                <input type="file" id="batchFolderInput" multiple accept=".stl" style="display: none;">
                <div class="upload-icon-large">
                    <svg width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                        <polyline points="9 22 9 12"></polyline>
                    </svg>
                </div>
                <div class="upload-text-large">Upload a folder of STL models</div>
                <div class="upload-hint">Select a folder or drag files here</div>
                <div class="upload-hint-small">All .STL files will be processed</div>
                <div class="upload-count hidden" id="batchFileCount"></div>
            </div>
            
            <div class="btn-group" style="margin-top: 16px;">
                <button class="btn btn-primary btn-wide" id="runBatchSearchBtn" disabled>
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="8" cy="8" r="6"></circle>
                        <path d="M14 14l-3-3"></path>
                    </svg>
                    <span id="batchSearchBtnText">Run Batch Search</span>
                    <span class="spinner hidden" id="batchSearchSpinner"></span>
                </button>
            </div>
        </div>
        
        <!-- Batch Results -->
        <div class="card hidden" id="batchResultsCard">
            <div class="card-header">
                <div class="card-title">Batch Results</div>
                <div class="btn-group">
                    <button class="btn btn-secondary btn-sm" id="retryFailedBtn" disabled>
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                        Retry Failed
                    </button>
                    <button class="btn btn-secondary btn-sm" id="exportBatchCsvBtn" disabled>CSV</button>
                    <button class="btn btn-secondary btn-sm" id="exportBatchPdfBtn" disabled>PDF</button>
                </div>
            </div>
            
            <div id="batchResultsList" class="batch-results-list">
                <div class="empty-state">
                    <div class="empty-state-text">Run a batch search to see results</div>
                </div>
            </div>
        </div>
    `,
    
    /**
     * Database Manager View – Full-width card layout
     */
    databaseManager: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Databases</h1>
            <p class="workspace-subtitle">Select or create a database to begin searching</p>
        </div>
        
        <button id="floatingHelpBtn" class="floating-help-btn" title="Help">
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>
        </button>
        
        <!-- Help Tooltip/Overlay -->
        <div id="helpTooltip" class="help-tooltip hidden">
            <div class="help-tooltip-header">
                <h3>Getting Started with QRCAD</h3>
                <button class="help-tooltip-close" onclick="document.getElementById('helpTooltip').classList.add('hidden')">✕</button>
            </div>
            <div class="help-tooltip-content">
                <div class="help-section">
                    <h4>📦 Step 1: Create or Select a Database</h4>
                    <p>Click "+ New Database" to add a folder containing your 3D models (STL files). Or select an existing database from the list.</p>
                </div>
                <div class="help-section">
                    <h4>⚙️ Step 2: Build Index</h4>
                    <p>Click "Rebuild Index" to index all models. This creates a searchable cache that enables fast similarity matching. (One-time operation)</p>
                </div>
                <div class="help-section">
                    <h4>✓ Step 3: Select Database</h4>
                    <p>Click "Select" or "✓ Active" to make a database active for searching.</p>
                </div>
                <div class="help-section">
                    <h4>🔍 Step 4: Search for Models</h4>
                    <p><strong>Single Search:</strong> Upload one STL model to find similar shapes in your database. Get a ranked list of matches and 3D preview.</p>
                    <p><strong>Batch Search:</strong> Upload a folder of models to search them all at once. Great for comparing multiple designs.</p>
                </div>
                <div class="help-section">
                    <h4>📊 Search Results</h4>
                    <p>Results show the top matches for your query model.</p>
                </div>
                <div class="help-section">
                    <h4>💾 Downloads & Exports</h4>
                    <p>Download individual models directly from results. Export full search reports as CSV or PDF for documentation.</p>
                </div>
            </div>
        </div>
        
        <!-- Main Databases Card -->
        <div class="card db-manager-card">
            <div class="db-manager-header">
                <div class="db-manager-header-left">
                    <div class="db-manager-title">Databases</div>
                    <div class="db-manager-subtitle">Select or create a database to begin searching</div>
                </div>
                <div class="db-manager-header-right">
                    <button class="btn btn-secondary" id="clearCacheBtn">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h12l-1.5 9H4.5L3 6zM5 6V4a2 2 0 012-2h0a2 2 0 012 2v2M7 9v4M9 9v4"></path>
                        </svg>
                        Clear Cache
                    </button>
                    <button class="btn btn-primary" id="createDatabaseBtn">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"></path>
                        </svg>
                        New Database
                    </button>
                </div>
            </div>
            
            <!-- Database List Container -->
            <div id="databaseListContainer" class="db-list-container">
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">No databases yet</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
                        Click "+ New Database" to get started
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Recent Databases Card -->
        <div class="card recent-db-card" id="recentDatabasesCard">
            <div class="card-header">
                <div class="card-title">Recent Databases</div>
            </div>
            <div id="recentDatabasesContainer" class="recent-db-container">
                <div class="empty-state">
                    <div class="empty-state-icon">🕒</div>
                    <div class="empty-state-text">No recent databases</div>
                </div>
            </div>
            <div style="text-align: center; padding: 12px; border-top: 1px solid rgba(0,0,0,0.06);">
                <button class="btn btn-ghost btn-sm" id="clearDatabaseLogBtn">Clear Database Log</button>
            </div>
        </div>
    `,
    
    /**
     * Query Search Empty State (no database selected)
     */
    querySearchEmptyState: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Query Search</h1>
            <p class="workspace-subtitle">Search for similar 3D models</p>
        </div>
        
        <div class="card">
            <div style="text-align: center; padding: 64px 32px;">
                <div style="margin-bottom: 24px; opacity: 0.3;">
                    <svg width="80" height="80" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="40" cy="40" r="30"></circle>
                        <path d="M65 65l-10-10"></path>
                        <path d="M40 28v24M28 40h24"></path>
                    </svg>
                </div>
                
                <h2 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">
                    No Database Selected
                </h2>
                
                <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 32px; max-width: 480px; margin-left: auto; margin-right: auto;">
                    To search for 3D models, you first need to create or load a database containing your STL files.
                </p>
                
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn btn-primary" onclick="app.loadView('database-manager')">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3v10M3 8h10"></path>
                        </svg>
                        Create Database
                    </button>
                    <button class="btn btn-secondary" onclick="app.loadDatabaseFromEmpty()">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                        </svg>
                        Load Existing Database
                    </button>
                </div>
            </div>
        </div>
    `,

    
    /**
     * Search History View
     */
    searchHistory: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Search History</h1>
            <p class="workspace-subtitle">View your recent searches</p>
        </div>
        
        <div class="card">
            <div class="card-header">
                <div class="card-title">Recent Searches</div>
                <button class="btn btn-secondary btn-sm" id="clearHistoryBtn">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h12l-1.5 9H4.5L3 6zM5 6V4a2 2 0 012-2h0a2 2 0 012 2v2M7 9v4M9 9v4"></path>
                    </svg>
                    Clear All
                </button>
            </div>
            
            <div id="historyList" class="history-timeline">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;">
                            <circle cx="24" cy="24" r="18"></circle>
                            <path d="M24 12v12l6 3"></path>
                        </svg>
                    </div>
                    <div class="empty-state-text">No search history yet</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
                        Run a search to start building your history
                    </div>
                </div>
            </div>
        </div>
    `,
    
    /**
     * Cache Dashboard View
     */
    cacheDashboard: () => `
        <div class="workspace-header">
            <h1 class="workspace-title">Cache Dashboard</h1>
            <p class="workspace-subtitle">Monitor cache status and performance</p>
        </div>
        
        <div class="card" id="cacheStatusCard">
            <div class="card-title">Cache Status</div>
            <div id="cacheStatusContent">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;">
                            <rect x="6" y="6" width="36" height="36" rx="4"></rect>
                            <path d="M18 24h12M18 30h8"></path>
                        </svg>
                    </div>
                    <div class="empty-state-text">No database selected</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
                        Select a database to view cache information
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-title">Cache Management</div>
            <div class="btn-group">
                <button class="btn btn-primary" id="rebuildCacheBtn" disabled>
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 8A6 6 0 102 8a6 6 0 0012 0zM8 4v4l2 2"></path>
                    </svg>
                    Rebuild Cache
                </button>
                <button class="btn btn-destructive" id="deleteCacheBtn" disabled>
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h10l-1 9H4L3 6zM5 6V4a1 1 0 011-1h4a1 1 0 011 1v2"></path>
                    </svg>
                    Delete Cache
                </button>
            </div>
            
            <div class="alert alert-info" style="margin-top: 16px;">
                <strong>Note:</strong> Rebuilding the cache may take several minutes depending on the dataset size.
            </div>
        </div>
    `
};