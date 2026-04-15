/* ═══════════════════════════════════════════
   nav.js — Navigation helpers
   Badge count, user avatar, active link,
   share modal wiring.
═══════════════════════════════════════════ */

/* ── Badge ──────────────────────────────── */
function updateNavBadge() {
  const badge = document.getElementById('selBadge');
  if (!badge) return;
  const count = State.get().selected.length;
  badge.textContent   = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

/* ── User avatar / auth links ───────────── */
function renderNavUser() {
  const right = document.getElementById('navRight');
  if (!right) return;

  const { user } = State.get();
  if (user) {
    right.innerHTML = `
      <div class="nav-user">
        <div class="nav-avatar">${user.initials}</div>
        <span>${user.name}</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="themeToggle" title="Switch theme" aria-label="Switch theme">☀️</button>
      <a href="index.html" class="btn btn-ghost btn-sm" id="logoutBtn">Log out</a>`;

    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      State.set({ user: null });
      window.location.href = 'index.html';
    });
  } else {
    right.innerHTML = `
      <button class="theme-toggle" id="themeToggle" title="Switch theme" aria-label="Switch theme">☀️</button>
      <a href="auth.html" class="btn">Log in</a>
      <a href="auth.html" class="btn btn-primary">Sign up</a>`;
  }

  // Re-wire theme toggle (it was just recreated in the DOM)
  document.getElementById('themeToggle')?.addEventListener('click', () => Theme.toggle());
  Theme._syncButton(Theme.get());
}

/* ── Active nav link ────────────────────── */
function markActiveLink() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    link.classList.toggle('active', href === page);
  });
}

/* ── Share modal ────────────────────────── */
function initShareModal() {
  const overlay = document.getElementById('shareOverlay');
  if (!overlay) return;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeShare();
  });
}

function openShare()  { document.getElementById('shareOverlay')?.classList.add('open'); }
function closeShare() { document.getElementById('shareOverlay')?.classList.remove('open'); }

function copyShareLink() {
  const input = document.getElementById('shareUrl');
  const btn   = document.getElementById('copyBtn');
  if (!input || !btn) return;
  navigator.clipboard.writeText(input.value).catch(() => {});
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
}

function doShare(type) {
  closeShare();
  const messages = {
    Email:   'Opening email…',
    Discord: 'Copied to clipboard!',
    PNG:     'Exporting image…',
  };
  toast(messages[type] || 'Done!', 'success');
}
