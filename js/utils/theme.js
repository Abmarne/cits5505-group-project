/* ═══════════════════════════════════════════
   theme.js — Dark / light theme management
   
   Call Theme.init() as early as possible
   (before DOMContentLoaded) to prevent flash.
═══════════════════════════════════════════ */

const Theme = {
  _key: 'uwa_theme',

  /** Get current theme ('dark' | 'light') */
  get() {
    return localStorage.getItem(this._key) || 'dark';
  },

  /** Set theme and persist */
  set(theme) {
    localStorage.setItem(this._key, theme);
    document.documentElement.setAttribute('data-theme', theme);
    this._syncButton(theme);
  },

  /** Toggle between dark and light */
  toggle() {
    this.set(this.get() === 'dark' ? 'light' : 'dark');
  },

  /**
   * Apply saved theme immediately to <html> to prevent
   * a white flash before CSS loads.
   * Call this before DOMContentLoaded.
   */
  init() {
    const theme = this.get();
    document.documentElement.setAttribute('data-theme', theme);
    // Update button icon once the DOM exists
    document.addEventListener('DOMContentLoaded', () => this._syncButton(theme));
  },

  /** Update the toggle button icon and aria-label */
  _syncButton(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    btn.setAttribute('aria-label', btn.title);
  },
};

// Apply theme immediately — before first paint
Theme.init();
