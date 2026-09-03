/**
 * SearchResultsTable – Premium interactive result rows
 */

import { buttonClasses } from './Button.js';

export class SearchResultsTable {
    constructor(containerId, onRowClick = null, onMetadataUpdate = null) {
        this.containerId = containerId;
        this.onRowClick = onRowClick;
        this.onMetadataUpdate = onMetadataUpdate;
        this.results = [];
        this.selectedIndex = 0;
        this.displayedResults = [];
    }

    render(results) {
        this.results = results;
        this.selectedIndex = 0;
        this.displayedResults = [...results];

        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="search-results-card">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <div class="empty-state-text">No results found.</div>
                    </div>
                </div>
            `;
            return;
        }

        const topResults = results.slice(0, 5);
        this.displayedResults = topResults;

        container.innerHTML = `
            <div class="search-results-card">
                <div class="search-results-header">
                    <span class="search-results-title">Search Results</span>
                    <span class="search-results-count">${topResults.length} results</span>
                </div>
                <div class="search-results-list">
                    ${topResults.map((result, index) => this._renderRow(result, index)).join('')}
                </div>
            </div>
        `;

        this._attachEventListeners();
    }

    _renderRow(result, visibleIndex) {
        const rank = visibleIndex + 1;
        const isTop = rank === 1;
        const pathParts = result.filename.replace(/\\/g, '/').split('/');
        const modelName = pathParts[pathParts.length - 1];

        return `
            <div class="result-row-item ${isTop ? 'top-rank' : ''} ${visibleIndex === 0 ? 'selected' : ''}" data-index="${visibleIndex}">
                <div class="rank-number">${rank}</div>
                <div class="model-filename" title="${this._escapeHtml(result.filename)}">${this._escapeHtml(modelName)}</div>
                <button class="${buttonClasses({ variant: 'secondary', size: 'sm', extra: 'btn-icon' })}" title="Download" data-filename="${this._escapeHtml(result.filename)}" type="button" aria-label="Download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
            </div>
        `;
    }

    _attachEventListeners() {
        const rows = document.querySelectorAll(`#${this.containerId} .result-row-item`);
        rows.forEach((row) => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-icon')) return;
                const index = parseInt(row.getAttribute('data-index'));
                this._selectRow(index);
                if (this.onRowClick) {
                    this.onRowClick(this.displayedResults[index], index);
                }
                if (this.onMetadataUpdate) {
                    this.onMetadataUpdate(this.displayedResults[index]);
                }
            });
        });

        const downloadBtns = document.querySelectorAll(`#${this.containerId} .result-row-item .btn-icon`);
        downloadBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = btn.getAttribute('data-filename');
                if (window.app && window.app.downloadResult) {
                    window.app.downloadResult(filename);
                }
            });
        });
    }

    _selectRow(index) {
        const container = document.getElementById(this.containerId);
        const rows = container.querySelectorAll('.result-row-item');
        rows.forEach((row) => {
            const rowIndex = parseInt(row.getAttribute('data-index'));
            row.classList.toggle('selected', rowIndex === index);
        });
        this.selectedIndex = index;
    }

    getSelected() {
        return this.displayedResults[this.selectedIndex];
    }

    _escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}
