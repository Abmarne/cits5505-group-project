/* ═══════════════════════════════════════════
   home.js — Home / Landing page
   Depends on: theme.js, state.js, toast.js, nav.js
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  updateNavBadge();
  renderNavUser();
  markActiveLink();
});
