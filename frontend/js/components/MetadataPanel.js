/**
 * MetadataPanel – Slide-over drawer for model details
 */

import { buttonClasses } from './Button.js';

export class MetadataPanel {
    constructor(panelId) {
        this.panelId = panelId;
        this.currentResult = null;
        this.overlay = document.getElementById('infoPanelOverlay');
    }

    _openPanel(panel) {
        panel.classList.remove('hidden');
        requestAnimationFrame(() => {
            panel.classList.add('open');
            if (this.overlay) this.overlay.classList.add('open');
        });
    }

    _closePanel(panel) {
        panel.classList.remove('open');
        if (this.overlay) this.overlay.classList.remove('open');
        setTimeout(() => {
            if (!panel.classList.contains('open')) {
                panel.classList.add('hidden');
            }
        }, 300);
    }

    updateMetadata(result) {
        this.currentResult = result;
        const panel = document.getElementById(this.panelId);
        if (!panel) return;

        if (!result) {
            this._showEmpty(panel);
            return;
        }

        const html = this._generateMetadataHTML(result);
        const content = panel.querySelector('.info-panel-content');
        if (content) {
            content.innerHTML = html;
            this._attachEventListeners(panel, result);
        }
        this._openPanel(panel);
    }

    _generateMetadataHTML(result) {
        const pathParts = result.filename.replace(/\\/g, '/').split('/');
        const modelName = pathParts[pathParts.length - 1];

        const metadata = result.metadata || {};
        const fileSizeBytes = metadata.file_size_bytes;
        const fileSize = fileSizeBytes ? this._formatFileSize(fileSizeBytes) : '—';

        const modifiedDateStr = metadata.date_modified;
        const modifiedDate = modifiedDateStr
            ? new Date(modifiedDateStr).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
              })
            : '—';

        const databaseName = (window.app && window.app.dbManager && window.app.dbManager.getActiveDatabase)
            ? window.app.dbManager.getActiveDatabase()?.name || '—'
            : '—';

        return `
            <div class="metadata-container">
                <div class="metadata-section">
                    <div class="metadata-filename">${this._escapeHtml(modelName)}</div>
                </div>
                <div class="metadata-divider"></div>
                <div class="metadata-section">
                    <div class="metadata-grid">
                        <div class="metadata-item">
                            <div class="metadata-label">File Size</div>
                            <div class="metadata-value">${this._escapeHtml(fileSize)}</div>
                        </div>
                        <div class="metadata-item">
                            <div class="metadata-label">Modified</div>
                            <div class="metadata-value">${this._escapeHtml(modifiedDate)}</div>
                        </div>
                    </div>
                </div>
                <div class="metadata-divider"></div>
                <div class="metadata-section">
                    <div class="metadata-label">Database</div>
                    <div class="metadata-value">${this._escapeHtml(databaseName)}</div>
                </div>
                <div class="metadata-divider"></div>
                <div class="metadata-section">
                    <button class="${buttonClasses({ variant: 'primary', block: true, extra: 'btn-metadata-action' })}" data-action="download" type="button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download Model
                    </button>
                </div>
            </div>
        `;
    }

    _showEmpty(panel) {
        this._closePanel(panel);
    }

    _attachEventListeners(panel, result) {
        const downloadBtn = panel.querySelector('[data-action="download"]');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (window.app && window.app.downloadResult) {
                    window.app.downloadResult(result.filename);
                }
            });
        }
    }

    _formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    _escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    hide() {
        const panel = document.getElementById(this.panelId);
        if (panel) this._closePanel(panel);
    }
}
