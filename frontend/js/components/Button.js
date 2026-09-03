/**
 * QRCAD – Shared Button component
 * Use createButton() for programmatic buttons, or buttonClasses() in HTML templates.
 */

const VARIANTS = new Set(['primary', 'secondary', 'destructive', 'ghost']);
const SIZES = new Set(['sm', 'md', 'lg']);

/**
 * @param {{ variant?: string, size?: string, block?: boolean, wide?: boolean, extra?: string }} opts
 * @returns {string}
 */
export function buttonClasses({ variant = 'secondary', size = 'md', block = false, wide = false, extra = '' } = {}) {
    const v = VARIANTS.has(variant) ? variant : 'secondary';
    const classes = ['btn', `btn-${v}`];
    if (size === 'sm') classes.push('btn-sm');
    if (size === 'lg') classes.push('btn-lg');
    if (block) classes.push('btn-block');
    if (wide) classes.push('btn-wide');
    if (extra) classes.push(extra);
    return classes.join(' ');
}

/**
 * @param {{
 *   label?: string,
 *   html?: string,
 *   variant?: string,
 *   size?: string,
 *   type?: string,
 *   disabled?: boolean,
 *   onClick?: (e: Event) => void,
 *   title?: string,
 *   className?: string,
 *   block?: boolean,
 *   wide?: boolean,
 *   id?: string,
 *   attrs?: Record<string, string>,
 * }} opts
 * @returns {HTMLButtonElement}
 */
export function createButton({
    label = '',
    html,
    variant = 'secondary',
    size = 'md',
    type = 'button',
    disabled = false,
    onClick,
    title,
    className,
    block = false,
    wide = false,
    id,
    attrs = {},
} = {}) {
    const btn = document.createElement('button');
    btn.type = type;
    btn.className = buttonClasses({ variant, size, block, wide, extra: className });
    if (id) btn.id = id;
    if (title) btn.title = title;
    if (disabled) btn.disabled = true;
    btn.innerHTML = html ?? escapeHtml(label);
    if (onClick) btn.addEventListener('click', onClick);
    for (const [key, value] of Object.entries(attrs)) {
        btn.setAttribute(key, value);
    }
    return btn;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
