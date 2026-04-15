/* ═══════════════════════════════════════════
   auth.js — Login / Signup page
   Depends on: theme.js, state.js, toast.js, nav.js
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  updateNavBadge();
  renderNavUser();
  markActiveLink();

  // If already logged in, skip straight to courses
  if (State.get().user) {
    window.location.href = 'courses.html';
    return;
  }

  bindAuthTabs();
  bindPasswordToggles();
  bindStrengthMeter();
  bindForms();
});

/* ── Tab switching ───────────────────────── */
function bindAuthTabs() {
  document.getElementById('loginTab')?.addEventListener('click',  () => switchTab('login'));
  document.getElementById('signupTab')?.addEventListener('click', () => switchTab('signup'));

  // Support ?tab=signup in URL
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'signup') switchTab('signup');
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginTab').classList.toggle('active', isLogin);
  document.getElementById('signupTab').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').style.display  = isLogin ? '' : 'none';
  document.getElementById('signupForm').style.display = isLogin ? 'none' : '';
  document.getElementById('authFooter').innerHTML = isLogin
    ? `Don't have an account? <a onclick="switchTab('signup')" style="color:var(--accent);cursor:pointer">Sign up free</a>`
    : `Already have an account? <a onclick="switchTab('login')" style="color:var(--accent);cursor:pointer">Log in</a>`;
}

/* ── Password visibility ─────────────────── */
function bindPasswordToggles() {
  document.querySelectorAll('.input-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.type      = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });
}

/* ── Password strength ───────────────────── */
function bindStrengthMeter() {
  document.getElementById('signPass')?.addEventListener('input', function () {
    const pw    = this.value;
    const score = [
      pw.length >= 8,
      /[A-Z]/.test(pw),
      /[0-9]/.test(pw),
      /[^a-zA-Z0-9]/.test(pw),
    ].filter(Boolean).length;

    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');

    const widths = ['0%', '25%', '50%', '75%', '100%'];
    const colors = ['', '#f76f6f', '#f5a623', '#fbbf24', '#2dd4a0'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

    fill.style.width      = widths[score];
    fill.style.background = colors[score];
    if (label) label.textContent = labels[score] || '';
  });
}

/* ── Form submission ─────────────────────── */
function bindForms() {
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('signupBtn')?.addEventListener('click', handleSignup);

  document.getElementById('loginPass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('signPass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignup();
  });
}

function handleLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const pass     = document.getElementById('loginPass').value;
  const emailErr = document.getElementById('loginEmailErr');

  let valid = true;
  if (!email.includes('@')) {
    emailErr.classList.add('show'); valid = false;
  } else {
    emailErr.classList.remove('show');
  }
  if (!pass) { toast('Please enter your password', 'error'); valid = false; }
  if (!valid) return;

  // TODO: replace with real API call  POST /api/auth/login
  const name     = email.split('@')[0];
  const initials = name[0].toUpperCase();
  State.set({ user: { name, initials, email } });
  toast('Welcome back! 👋', 'success');
  setTimeout(() => { window.location.href = 'courses.html'; }, 600);
}

function handleSignup() {
  const first    = document.getElementById('signFirst').value.trim();
  const stu      = document.getElementById('signStu').value.trim();
  const email    = document.getElementById('signEmail').value.trim();
  const pass     = document.getElementById('signPass').value;
  const agree    = document.getElementById('agreeCheck').checked;
  const stuErr   = document.getElementById('stuErr');
  const emailErr = document.getElementById('emailErr');

  let valid = true;
  if (!stu.match(/^2\d{7}$/)) { stuErr.classList.add('show'); valid = false; }
  else stuErr.classList.remove('show');

  if (!email.endsWith('@student.uwa.edu.au')) { emailErr.classList.add('show'); valid = false; }
  else emailErr.classList.remove('show');

  if (pass.length < 8) { toast('Password must be at least 8 characters', 'error'); valid = false; }
  if (!agree) { toast('Please agree to the terms of service', 'error'); valid = false; }
  if (!valid) return;

  // TODO: replace with real API call  POST /api/auth/register
  const name     = (first || 'Student').trim();
  const initials = name[0].toUpperCase();
  State.set({ user: { name, initials, email, studentNumber: stu } });
  toast('Account created! Welcome aboard 🎉', 'success');
  setTimeout(() => { window.location.href = 'courses.html'; }, 600);
}
