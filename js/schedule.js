/* ═══════════════════════════════════════════
   schedule.js — Schedule Generator page
   Depends on: state.js, api.js, schedule-utils.js,
               toast.js, nav.js
═══════════════════════════════════════════ */

const SLOT_H  = 52;   // px per 1-hour row
const START_H = 8;    // grid starts 08:00
const TOTAL_H = 12;   // rows: 08:00 → 20:00

let allCourses       = [];
let activeDrawerCode = null;

document.addEventListener('DOMContentLoaded', async () => {
  updateNavBadge();
  renderNavUser();
  markActiveLink();
  initShareModal();

  try {
    allCourses = await API.getCourses();
  } catch {
    toast('Could not load unit data', 'error');
  }

  renderSchedulePage();
  bindControls();
});

/* ── Full page render ────────────────────── */
function renderSchedulePage() {
  renderLegend();
  renderVariantButtons();
  renderGrid();
}

/* ── Control panel bindings ──────────────── */
function bindControls() {
  ['prefNo8', 'prefCompact', 'prefFri'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderSchedulePage);
  });

  document.getElementById('startRange')?.addEventListener('input', function () {
    document.getElementById('startVal').textContent = this.value + ':00';
  });

  document.getElementById('autoBtn')?.addEventListener('click', autoSchedule);
  document.getElementById('shareBtn')?.addEventListener('click', openShare);
  document.getElementById('copyBtn')?.addEventListener('click', copyShareLink);
}

/* ── Unit legend ─────────────────────────── */
function renderLegend() {
  const el = document.getElementById('legendList');
  if (!el) return;
  const { selected } = State.get();
  if (!selected.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3)">No units selected</div>';
    return;
  }
  el.innerHTML = selected.map(({ code }, i) => {
    const col    = getColor(i);
    const course = allCourses.find(c => c.code === code);
    return `<div class="legend-item">
      <div class="legend-swatch" style="background:${col.border}"></div>
      <span class="legend-code">${code}</span>
      <span class="legend-name">${course?.name || 'Unknown unit'}</span>
    </div>`;
  }).join('');
}

/* ── Variant slot buttons ────────────────── */
function renderVariantButtons() {
  const el = document.getElementById('variantList');
  if (!el) return;
  const { selected } = State.get();

  const withAlts = selected.filter(({ code }) => {
    const c = allCourses.find(x => x.code === code);
    return c?.alternatives?.length;
  });

  if (!withAlts.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3)">No alternatives available</div>';
    return;
  }

  el.innerHTML = withAlts.map(({ code, altIdx }) =>
    `<button class="variant-btn active" data-code="${code}">
      <div class="variant-dot"></div>
      ${code} — ${altIdx === 0 ? 'default' : 'option ' + altIdx}
    </button>`
  ).join('');

  el.querySelectorAll('.variant-btn').forEach(btn => {
    btn.addEventListener('click', () => showAltDrawer(btn.dataset.code));
  });
}

/* ── Status bar ──────────────────────────── */
function renderStatusBar(conflicts) {
  const bar  = document.getElementById('statusBar');
  const text = document.getElementById('statusText');
  if (!bar || !text) return;

  const { selected } = State.get();
  if (!selected.length) { bar.className = 'status-bar'; return; }

  if (conflicts.size) {
    bar.className    = 'status-bar conflict';
    text.textContent = `${conflicts.size} unit${conflicts.size > 1 ? 's' : ''} in conflict — try auto-schedule`;
  } else {
    bar.className    = 'status-bar clear';
    text.textContent = 'No conflicts — looking good!';
  }
}

/* ── Timetable grid ──────────────────────── */
function renderGrid() {
  const body = document.getElementById('ttBody');
  if (!body) return;

  const { selected } = State.get();
  const conflicts    = detectConflicts(selected, allCourses);
  renderStatusBar(conflicts);

  // Build time-label column + empty day cells
  let html = '';
  for (let r = 0; r < TOTAL_H; r++) {
    html += `<div class="tt-time">${START_H + r}:00</div>`;
    for (let d = 0; d < 5; d++) {
      html += `<div class="tt-cell" data-row="${r}" data-day="${d}"></div>`;
    }
  }
  body.innerHTML = html;

  if (!selected.length) return;

  // Place class pills inside the correct cells
  selected.forEach(({ code, altIdx }, ci) => {
    const course     = allCourses.find(c => c.code === code);
    if (!course) return;
    const col        = getColor(ci);
    const isConflict = conflicts.has(code);

    getActiveSessions(course, altIdx).forEach(sess => {
      const row  = sess.hour - START_H;
      const cell = body.querySelector(`[data-row="${row}"][data-day="${sess.day}"]`);
      if (!cell) return;

      const pill = document.createElement('div');
      pill.className = 'class-pill' + (isConflict ? ' conflict' : '');
      pill.style.cssText = `
        top: 3px;
        height: ${sess.duration * SLOT_H - 6}px;
        background: ${isConflict ? 'rgba(247,111,111,.18)' : col.bg};
        border-left-color: ${isConflict ? '#f76f6f' : col.border};
        color: ${isConflict ? '#fca5a5' : col.text};
      `;
      pill.innerHTML = `
        <div class="pill-code">${code}</div>
        <div class="pill-type">${sess.type}</div>
        <div class="pill-name">${course.name}</div>
      `;
      pill.addEventListener('click', () => showAltDrawer(code));
      cell.appendChild(pill);
    });
  });
}

/* ── Alternative slot drawer ─────────────── */
function showAltDrawer(code) {
  const course = allCourses.find(c => c.code === code);
  if (!course) return;
  activeDrawerCode = code;

  const { selected }  = State.get();
  const entry         = selected.find(s => s.code === code);
  const alts          = course.alternatives || [];

  const opts = [
    { label: 'Default (original)', idx: 0 },
    ...alts.map((a, i) => ({
      label: `Option ${i + 1}: ${a.map(s => DAYS[s.day].slice(0, 3) + ' ' + s.hour + ':00 ' + s.type).join(', ')}`,
      idx: i + 1,
    })),
  ];

  const drawer = document.getElementById('altDrawer');
  drawer.style.display = '';
  drawer.innerHTML = `
    <div class="alt-drawer">
      <div class="alt-drawer-header">
        <div class="alt-drawer-title">${code} — choose a time slot</div>
        <button class="btn btn-sm btn-ghost" id="closeDrawerBtn">Close</button>
      </div>
      <div class="alt-chips">
        ${opts.map(o =>
          `<div class="alt-chip ${entry?.altIdx === o.idx ? 'chosen' : ''}" data-idx="${o.idx}">
            ${o.label}
          </div>`
        ).join('')}
      </div>
    </div>`;

  drawer.querySelectorAll('.alt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      State.setAlt(code, parseInt(chip.dataset.idx));
      renderSchedulePage();
      drawer.querySelectorAll('.alt-chip').forEach(c => c.classList.remove('chosen'));
      chip.classList.add('chosen');
    });
  });

  document.getElementById('closeDrawerBtn')?.addEventListener('click', () => {
    drawer.style.display = 'none';
    activeDrawerCode     = null;
  });
}

/* ── Auto-schedule ───────────────────────── */
function autoSchedule() {
  const { selected } = State.get();
  if (!selected.length) { toast('Add some units first!'); return; }

  // Simple random selection from alternatives
  // TODO: replace with smarter conflict-minimising algorithm
  selected.forEach(({ code }) => {
    const c = allCourses.find(x => x.code === code);
    if (c?.alternatives?.length) {
      State.setAlt(code, Math.floor(Math.random() * (c.alternatives.length + 1)));
    }
  });

  renderSchedulePage();
  const drawer = document.getElementById('altDrawer');
  if (drawer) drawer.style.display = 'none';
  toast('Schedule generated!', 'success');
}
