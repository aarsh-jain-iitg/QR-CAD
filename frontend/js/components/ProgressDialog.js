/**
 * QRCAD v2.0 - Progress Dialog Component
 * Reusable progress dialog for long-running operations (indexing, batch search, etc.)
 * Features:
 * - Shows progress bar and overall percentage
 * - Dismiss-proof while operation is running (no cancel, no close)
 * - Minimal, professional styling
 * - Generic enough for multiple operations
 */

import { buttonClasses } from './Button.js';

export class ProgressDialog {
    constructor(options = {}) {
        this.message = options.message || "Processing...";
        this.title = options.title || "Please wait";
        this.autoCloseOnComplete = options.autoCloseOnComplete !== false;
        this.onCancelled = options.onCancelled || null;
        
        this.progress = 0;
        this.isRunning = false;
        this.dialogElement = null;
        this.progressBarFill = null;
        this.progressText = null;
        this.messageElement = null;
    }

    /**
     * Create and show the progress dialog
     */
    show() {
        this.isRunning = true;   // MUST be first line
        this.progress = 0;
        this.currentCount = null;
        this.totalCount = null;
        
        if (this.dialogElement) {
            this.dialogElement.style.display = 'flex';
            this.updateProgressBar();
            return;
        }

        // Create dialog HTML
        const dialogHTML = `
            <div class="progress-dialog-overlay">
                <div class="progress-dialog">
                    <div class="progress-dialog-header">
                        <h2 class="progress-dialog-title">${this.escapeHtml(this.title)}</h2>
                    </div>
                    <div class="progress-dialog-content">
                        <p class="progress-message" id="progressMessage">${this.escapeHtml(this.message)}</p>
                        <div class="progress-bar-container">
                            <svg width="120" height="120" viewBox="0 0 120 120" style="display:block;">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="#F3F4F6" stroke-width="8"/>
                                <circle id="progressCircleFill" cx="60" cy="60" r="50" fill="none" stroke="#E11D48" stroke-width="8"
                                    stroke-dasharray="314.16" stroke-dashoffset="314.16"
                                    stroke-linecap="round"
                                    transform="rotate(-90 60 60)"
                                    style="transition: stroke-dashoffset 0.35s cubic-bezier(0.4,0,0.2,1);"/>
                            </svg>
                            <div class="progress-count-overlay" id="progressCountText">0 / 0</div>
                        </div>
                        <p class="progress-details" id="progressDetails">
                            <span id="progressDetail">Initializing...</span>
                        </p>
                        <button id="progressDialogCloseBtn" class="${buttonClasses({ variant: 'ghost', size: 'sm' })} progress-dialog-close" type="button">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Create wrapper div
        this.dialogElement = document.createElement('div');
        this.dialogElement.innerHTML = dialogHTML;
        document.body.appendChild(this.dialogElement);

        // Cache element references
        this.progressCircleFill = this.dialogElement.querySelector('#progressCircleFill');
        this.progressCountText = this.dialogElement.querySelector('#progressCountText');
        this.messageElement = this.dialogElement.querySelector('#progressMessage');
        this.detailElement = this.dialogElement.querySelector('#progressDetail');
        this.closeBtn = this.dialogElement.querySelector('#progressDialogCloseBtn');

        // Setup close button (only visible after completion)
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.dispose());
        }

        this.updateProgressBar();
    }

    /**
     * Hide the progress dialog
     */
    hide() {
        if (this.dialogElement) {
            this.dialogElement.style.display = 'none';
        }
        this.isRunning = false;
    }

    /**
     * Remove the progress dialog from DOM
     */
    dispose() {
        if (this.dialogElement) {
            this.dialogElement.remove();
            this.dialogElement = null;
        }
        this.isRunning = false;
    }

    /**
     * Update progress (0-100) or with counts
     */
    setProgress(percentage, detail = null, current = null, total = null) {
        this.progress = Math.max(this.progress, Math.max(0, Math.min(100, percentage)));
        this.currentCount = current;
        this.totalCount = total;
        this.updateProgressBar();
        
        if (detail && this.detailElement) {
            this.detailElement.textContent = detail;
        }
    }

    /**
     * Update the message displayed in the dialog
     */
    setMessage(message) {
        this.message = message;
        if (this.messageElement) {
            this.messageElement.textContent = this.escapeHtml(message);
        }
    }

    /**
     * Update the title
     */
    setTitle(title) {
        this.title = title;
        const titleEl = this.dialogElement?.querySelector('.progress-dialog-title');
        if (titleEl) {
            titleEl.textContent = this.escapeHtml(title);
        }
    }

    /**
     * Mark operation as complete
     */
    markComplete() {
        this.progress = 100;
        this.updateProgressBar();
        this.isRunning = false;
        
        // Show close button
        if (this.closeBtn) {
            this.closeBtn.style.opacity = '1';
            this.closeBtn.style.pointerEvents = 'auto';
        }
        
        if (this.autoCloseOnComplete) {
            setTimeout(() => {
                this.dispose();
            }, 300);
        } else {
            // Still need to hide the modal but keep it in DOM for manual close
            setTimeout(() => {
                this.hide();
            }, 500);
        }
    }

    /**
     * Internal: update progress bar visuals
     */
    updateProgressBar() {
        if (this.progressCircleFill) {
            const circumference = 2 * Math.PI * 50; // radius is 50
            const offset = circumference - (this.progress / 100) * circumference;
            this.progressCircleFill.style.strokeDashoffset = offset;
            this.progressCircleFill.setAttribute('stroke-dasharray', circumference);
        }
        
        if (this.progressCountText) {
            if (this.currentCount !== null && this.totalCount !== null && this.totalCount > 0) {
                this.progressCountText.textContent = `${this.currentCount} / ${this.totalCount}`;
            } else {
                this.progressCountText.textContent = `${Math.round(this.progress)}%`;
            }
        }
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Poll backend for progress (generic polling helper)
     */
    async pollProgress(pollFn, interval = 500, maxDuration = 3600000) {
        const startTime = Date.now();
        
        const poll = () => {
            if (!this.isRunning) return;
            
            const elapsed = Date.now() - startTime;
            if (elapsed > maxDuration) {
                console.warn('[ProgressDialog] Poll timeout exceeded');
                this.markComplete();
                return;
            }
            
            try {
                pollFn().then(result => {
                    if (!this.isRunning) return;
                    
                    if (result) {
                        const { progress, detail, current, total, complete } = result;
                        
                        if (progress !== undefined) {
                            this.setProgress(progress, detail, current, total);
                        }
                        
                        if (complete) {
                            this.markComplete();
                            return;
                        }
                    }
                    
                    // Schedule next poll
                    if (this.isRunning) {
                        setTimeout(poll, interval);
                    }
                }).catch(err => {
                    console.error('[ProgressDialog] Poll error:', err);
                    if (this.isRunning) {
                        setTimeout(poll, interval);
                    }
                });
            } catch (err) {
                console.error('[ProgressDialog] Poll error:', err);
                if (this.isRunning) {
                    setTimeout(poll, interval);
                }
            }
        };
        
        // Start polling immediately — no await
        poll();
    }
}

/**
 * CSS for progress dialog (to be injected into page or CSS file)
 */
export const PROGRESS_DIALOG_CSS = `
.progress-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
}

.progress-dialog {
    background: white;
    border-radius: 16px;
    width: 360px;
    max-width: 90vw;
    padding: 28px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.18);
}

.progress-dialog-header {
    text-align: center;
    margin-bottom: 6px;
    border-bottom: none;
    padding: 0;
}

.progress-dialog-title {
    font-size: 17px;
    font-weight: 600;
    color: #111827;
    margin: 0;
    font-family: Inter, sans-serif;
}

.progress-dialog-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    padding: 0;
}

.progress-message {
    font-size: 13px;
    color: #6B7280;
    margin: 10px 0 20px;
    text-align: center;
    font-family: Inter, sans-serif;
    line-height: 1.5;
}

.progress-bar-container {
    position: relative;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
}

.progress-count-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    font-family: Inter, sans-serif;
    white-space: nowrap;
    pointer-events: none;
}

.progress-details {
    font-size: 12px;
    color: #9CA3AF;
    text-align: center;
    font-family: Inter, sans-serif;
    min-height: 16px;
    margin: 0;
}

.progress-dialog-close {
    margin-top: 16px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
}
`;
