/**
 * QRCAD – Shared 3D viewer floating toolbar (Lucide icons)
 */

const ICONS = {
    reset: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    fit: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>`,
    zoomOut: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>`,
    wireframe: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>`,
};

const TOOLBAR_ACTIONS = [
    { action: 'reset', icon: 'reset', title: 'Reset view' },
    { action: 'fit', icon: 'fit', title: 'Zoom to fit' },
    { action: 'zoom-in', icon: 'zoomIn', title: 'Zoom in' },
    { action: 'zoom-out', icon: 'zoomOut', title: 'Zoom out' },
    { action: 'wireframe', icon: 'wireframe', title: 'Toggle wireframe', toggle: true },
];

/**
 * @param {HTMLElement} container
 * @param {{ onAction: (action: string, btn: HTMLButtonElement) => void, isActive?: (action: string) => boolean }} handlers
 */
export function createViewerToolbar(container, { onAction, isActive }) {
    if (container.querySelector('.viewer-toolbar')) return container.querySelector('.viewer-toolbar');

    const toolbar = document.createElement('div');
    toolbar.className = 'viewer-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', '3D viewer controls');

    for (const item of TOOLBAR_ACTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'viewer-toolbar-btn';
        btn.dataset.action = item.action;
        btn.title = item.title;
        btn.setAttribute('aria-label', item.title);
        btn.innerHTML = ICONS[item.icon];
        if (item.toggle && isActive?.(item.action)) {
            btn.classList.add('is-active');
        }
        toolbar.appendChild(btn);
    }

    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        onAction(action, btn);
        if (btn.dataset.action === 'wireframe' && isActive) {
            btn.classList.toggle('is-active', isActive('wireframe'));
        }
    });

    container.appendChild(toolbar);
    return toolbar;
}

export function syncViewerToolbarActive(toolbar, isActive) {
    if (!toolbar || !isActive) return;
    toolbar.querySelectorAll('[data-action="wireframe"]').forEach((btn) => {
        btn.classList.toggle('is-active', isActive('wireframe'));
    });
}
