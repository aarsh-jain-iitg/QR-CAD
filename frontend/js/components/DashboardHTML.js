/**
 * DashboardHTML.js - HTML Template for Comparison Dashboard
 * Clean, commercial-grade layout
 */

export const DashboardHTML = () => `
    <div class="dashboard-container">
        <!-- Header -->
        <div class="dashboard-header">
            <div class="dashboard-logo">
                <div class="logo-text">QR-CAD</div>
                <div class="logo-subtitle">3D CAD Retrieval System</div>
            </div>
            <div class="dashboard-actions">
                <button id="resetBtn" class="btn-header" title="Reset All">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                        <path d="M21 3v5h-5"></path>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                        <path d="M3 21v-5h5"></path>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Main Content -->
        <div class="dashboard-main">
            <!-- Upload Section -->
            <div class="upload-section">
                <div class="card">
                    <div class="card-title">Upload Query Model</div>
                    <div class="upload-zone" id="uploadZone">
                        <input type="file" id="fileInput" accept=".stl,.STL" style="display: none;">
                        <div class="upload-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 2v20M2 12h20"></path>
                            </svg>
                        </div>
                        <div class="upload-text">Drag & Drop STL File or Click to Browse</div>
                        <div class="upload-hint">Supported Format: .STL (Binary or ASCII)</div>
                    </div>
                    <button id="searchBtn" class="btn-primary btn-large" disabled style="width: 100%; margin-top: 16px;">
                        <span id="searchBtnText">Run Similarity Search</span>
                        <span class="spinner hidden" id="searchSpinner" style="margin-left: 8px;"></span>
                    </button>
                </div>
            </div>

            <!-- Viewers Section -->
            <div class="viewers-section">
                <div class="viewer-wrapper">
                    <div class="stl-viewer-container" id="viewer-query">
                        <div class="stl-viewer-header">
                            <div class="stl-viewer-title">
                                <div class="stl-viewer-title-main">Uploaded Model</div>
                                <div class="stl-viewer-title-sub">No file</div>
                            </div>
                            <div class="stl-viewer-controls">
                                <button class="stl-viewer-control-btn" title="Fit to view">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="stl-viewer-canvas"></div>
                    </div>
                </div>

                <div class="viewer-wrapper">
                    <div class="stl-viewer-container" id="viewer-match">
                        <div class="stl-viewer-header">
                            <div class="stl-viewer-title">
                                <div class="stl-viewer-title-main">Best Match</div>
                                <div class="stl-viewer-title-sub">No match</div>
                            </div>
                            <div class="stl-viewer-controls">
                                <button class="stl-viewer-control-btn" title="Fit to view">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="stl-viewer-canvas"></div>
                    </div>
                </div>
            </div>

            <!-- Results Section -->
            <div class="results-section">
                <div class="card">
                    <div class="card-title">Search Results</div>
                    <div id="results-table"></div>
                </div>
            </div>
        </div>
    </div>
`;

export const DashboardStyles = () => `
    .dashboard-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: var(--page-bg, #F8FAFC);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    }

    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        background: white;
        border-bottom: 1px solid var(--border-color, #E5E7EB);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .dashboard-logo {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .logo-text {
        font-size: 18px;
        font-weight: 700;
        color: var(--primary-color, #4F46E5);
        letter-spacing: -0.5px;
    }

    .logo-subtitle {
        font-size: 11px;
        color: var(--text-secondary, #6B7280);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .dashboard-actions {
        display: flex;
        gap: 8px;
    }

    .btn-header {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: 1px solid var(--border-color, #E5E7EB);
        background: white;
        cursor: pointer;
        color: var(--text-secondary, #6B7280);
        transition: all 0.2s ease;
    }

    .btn-header:hover {
        background: var(--hover-bg, #EEF2FF);
        color: var(--primary-color, #4F46E5);
        border-color: var(--primary-color, #4F46E5);
    }

    .btn-header svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
        fill: none;
    }

    .dashboard-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: auto;
        padding: 24px;
        gap: 24px;
    }

    .upload-section {
        flex-shrink: 0;
    }

    .card {
        background: white;
        border: 1px solid var(--border-color, #E5E7EB);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .card-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #111827);
        margin-bottom: 12px;
    }

    .upload-zone {
        border: 2px dashed var(--border-color, #E5E7EB);
        border-radius: 8px;
        padding: 32px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--page-bg, #F8FAFC);
    }

    .upload-zone:hover {
        border-color: var(--primary-color, #4F46E5);
        background: var(--hover-bg, #EEF2FF);
    }

    .upload-zone.drag-over {
        border-color: var(--success-color, #22C55E);
        background: var(--success-bg, #F0FDF4);
    }

    .upload-icon {
        width: 56px;
        height: 56px;
        margin: 0 auto 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary, #6B7280);
    }

    .upload-icon svg {
        width: 100%;
        height: 100%;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.5;
    }

    .upload-text {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary, #111827);
        margin-bottom: 4px;
    }

    .upload-hint {
        font-size: 12px;
        color: var(--text-secondary, #6B7280);
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        background: var(--primary-color, #4F46E5);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary:not(:disabled):hover {
        background: #4338CA;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        transform: translateY(-1px);
    }

    .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-large {
        padding: 12px 20px;
        font-size: 14px;
    }

    .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .viewers-section {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        min-height: 500px;
    }

    .viewer-wrapper {
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .stl-viewer-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: white;
        border: 1px solid var(--border-color, #E5E7EB);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .stl-viewer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color, #E5E7EB);
        background: #FAFBFC;
        flex-shrink: 0;
    }

    .stl-viewer-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .stl-viewer-title-main {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #111827);
    }

    .stl-viewer-title-sub {
        font-size: 11px;
        color: var(--text-secondary, #6B7280);
    }

    .stl-viewer-controls {
        display: flex;
        gap: 6px;
    }

    .stl-viewer-control-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        border: 1px solid var(--border-color, #E5E7EB);
        background: white;
        cursor: pointer;
        color: var(--text-secondary, #6B7280);
        transition: all 0.2s ease;
    }

    .stl-viewer-control-btn:hover {
        background: var(--hover-bg, #EEF2FF);
        color: var(--primary-color, #4F46E5);
        border-color: var(--primary-color, #4F46E5);
    }

    .stl-viewer-control-btn svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
    }

    .stl-viewer-canvas {
        flex: 1;
        position: relative;
        background: white;
        width: 100%;
    }

    .results-section {
        flex-shrink: 0;
        max-height: 400px;
        overflow: auto;
    }

    /* Responsive */
    @media (max-width: 1280px) {
        .viewers-section {
            grid-template-columns: 1fr;
            min-height: 400px;
        }
    }

    @media (max-width: 768px) {
        .dashboard-main {
            padding: 12px;
            gap: 12px;
        }

        .upload-zone {
            padding: 20px;
        }

        .viewers-section {
            gap: 12px;
        }

        .stl-viewer-header {
            padding: 8px 12px;
        }
    }

    .hidden {
        display: none !important;
    }
`;
