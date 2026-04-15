/* ═══════════════════════════════════════════
   selected.js — My Selection page
   Depends on: state.js, api.js, schedule-utils.js,
               toast.js, nav.js
═══════════════════════════════════════════ */

let allCourses = [];

document.addEventListener('DOMContentLoaded', async () => {
  updateNavBadge();
  renderNavUser();
  markActiveLink();
  try {
    allCourses = await API.getCourses();
  } catch {
    toast('Could not load unit data', 'error');
  }
  renderPage();
});

/* ── Full page render ────────────────────── */
function renderPage() {
  const { selected } = State.get();
  const conflicts    = detectConflicts(selected, allCourses);
  renderSummaryBar(selected, conflicts);
  renderConflictAlert(conflicts);
  renderGrid(selected, conflicts);
}

/* ── Summary stats bar ───────────────────── */
function renderSummaryBar(selected, conflicts) {
  const el = document.getElementById('summaryBar');
  if (!el) return;

  if (!selected.length) { el.style.display = 'none'; return; }
  el.style.display = '';

  const cp   = getTotalCp(selected, allCourses);
  const days = getDaysUsed(selected, allCourses);

  el.innerHTML = `
    <div class="summary-stat">
      <div class="summary-num">${selected.length}</div>
      <div class="summary-label">Units</div>
    </div>
    <div class="summary-stat">
      <div class="summary-num">${cp}</div>
      <div class="summary-label">Credit points</div>
    </div>
    <div class="summary-stat">
      <div class="summary-num">${days}</div>
      <div class="summary-label">Days on campus</div>
    </div>
    <div class="summary-stat">
      <div class="summary-num" style="color:${conflicts.size ? 'var(--red)' : 'var(--green)'}">
        ${conflicts.size ? '⚠' : '✓'}
      </div>
      <div class="summary-label">${conflicts.size ? 'Clashes' : 'No conflicts'}</div>
    </div>`;
}

/* ── Conflict alert banner ───────────────── */
function renderConflictAlert(conflicts) {
  const el = document.getElementById('conflictAlert');
  if (el) el.style.display = conflicts.size ? 'flex' : 'none';
}

/* ── Unit cards grid ─────────────────────── */
function renderGrid(selected, conflicts) {
  const grid  = document.getElementById('unitsGrid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;

  if (!selected.length) {
    grid.style.display          = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }
  grid.style.display          = '';
  if (empty) empty.style.display = 'none';

  grid.innerHTML = selected.map(({ code, altIdx }, i) => {
    const course     = allCourses.find(c => c.code === code);
    const col        = getColor(i);
    const isConflict = conflicts.has(code);
    return course
      ? buildUnitCard(course, altIdx, col, isConflict)
      : buildUnknownCard(code, col);
  }).join('');

  grid.querySelectorAll('.remove-unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      State.removeCourse(btn.dataset.code);
      updateNavBadge();
      toast(`${btn.dataset.code} removed`);
      renderPage();
    });
  });
}

/* ── Unit card HTML builder ──────────────── */
function buildUnitCard(course, altIdx, col, isConflict) {
  const sessions    = getActiveSessions(course, altIdx);
  const sessionHTML = sessions.map(s => {
    const typeClass = s.type.toLowerCase();
    const hasAlts   = course.alternatives?.length && s.type !== 'LEC';
    return `<div class="session-row">
      <span class="session-type ${typeClass}">${s.type}</span>
      <span class="session-time">${DAYS[s.day]} ${s.hour}:00 – ${s.hour + s.duration}:00</span>
      ${hasAlts ? `<a href="schedule.html" class="session-swap">swap →</a>` : ''}
    </div>`;
  }).join('');

  const tagHTML = [
    `<span class="unit-tag">${course.cp} cp</span>`,
    ...course.sems.map(s => `<span class="unit-tag">${s}</span>`),
    `<span class="unit-tag">${course.faculty}</span>`,
    isConflict ? `<span class="unit-tag conflict-tag">Conflict</span>` : '',
  ].join('');

  return `<div class="unit-card${isConflict ? ' has-conflict' : ''}">
    <div class="unit-card-top">
      <div class="unit-color-bar" style="background:${col.border}"></div>
      <div class="unit-meta">
        <div class="unit-code">${course.code}</div>
        <div class="unit-name">${course.name}</div>
      </div>
      <div class="unit-actions">
        <button class="btn btn-sm btn-danger remove-unit-btn" data-code="${course.code}">Remove</button>
      </div>
    </div>
    <div class="unit-card-body">
      <div class="unit-sessions">${sessionHTML}</div>
      <div class="unit-tags">${tagHTML}</div>
    </div>
  </div>`;
}

function buildUnknownCard(code, col) {
  return `<div class="unit-card">
    <div class="unit-card-top">
      <div class="unit-color-bar" style="background:${col.border}"></div>
      <div class="unit-meta">
        <div class="unit-code">${code}</div>
        <div class="unit-name" style="color:var(--text2)">Custom / unknown unit</div>
      </div>
      <div class="unit-actions">
        <button class="btn btn-sm btn-danger remove-unit-btn" data-code="${code}">Remove</button>
      </div>
    </div>
  </div>`;
}
