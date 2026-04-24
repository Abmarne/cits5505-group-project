/* ═══════════════════════════════════════════
   schedule.js — Schedule Generator page
═══════════════════════════════════════════ */

import State from './utils/state.js';
import API from './utils/api.js';
import toast from './utils/toast.js';
import { DAYS, getColor, getActiveSessions, detectConflicts } from './utils/schedule-utils.js';
import './utils/components.js';

const SLOT_H  = 52;
const START_H = 8;
const TOTAL_H = 12;

let allCourses       = [];
let selected         = [];
let isPublic         = false;
let timetableName    = '';
let activeDrawerCode = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    [allCourses, { selected, isPublic, name: timetableName }] = await Promise.all([
      API.getCourses(),
      API.getTimetable(),
    ]);
    selected      = selected      || [];
    timetableName = timetableName || '';
  } catch {
    toast('Could not load data', 'error');
  }

  renderSchedulePage();
  bindControls();
  bindPublicToggle();
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
}

/* ── Unit legend ─────────────────────────── */
function renderLegend() {
  const el = document.getElementById('legendList');
  if (!el) return;
  if (!selected.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3)">No units selected</div>';
    return;
  }
  el.innerHTML = selected.map(({ code }, i) => {
    const col    = getColor(i);
    const course = allCourses.find(c => c.code === code);
    return `<div class="flex items-center gap-2.5">
      <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${col.border}"></div>
      <span class="font-mono text-[11px] font-medium text-[var(--text)]">${code}</span>
      <span class="text-[12px] text-[var(--text2)] truncate">${course?.name || 'Unknown unit'}</span>
    </div>`;
  }).join('');
}

/* ── Variant slot buttons ────────────────── */
function renderVariantButtons() {
  const el = document.getElementById('variantList');
  if (!el) return;

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

  const conflicts = detectConflicts(selected, allCourses);
  renderStatusBar(conflicts);

  let html = '';
  for (let r = 0; r < TOTAL_H; r++) {
    html += `<div class="tt-time">${START_H + r}:00</div>`;
    for (let d = 0; d < 5; d++) {
      html += `<div class="tt-cell" data-row="${r}" data-day="${d}"></div>`;
    }
  }
  body.innerHTML = html;

  if (!selected.length) return;

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

  const entry = selected.find(s => s.code === code);
  const alts  = course.alternatives || [];

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
    chip.addEventListener('click', async () => {
      const idx = parseInt(chip.dataset.idx);
      selected  = selected.map(s => s.code === code ? { ...s, altIdx: idx } : s);
      await API.saveTimetable({ selected });
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

/* ── Public / share-with-friends toggle ──── */
function bindPublicToggle() {
  const toggle  = document.getElementById('publicToggle');
  const nameIn  = document.getElementById('timetableNameInput');
  const saveBtn = document.getElementById('saveNameBtn');
  if (!toggle) return;

  toggle.checked = isPublic;
  if (nameIn) nameIn.value = timetableName;
  syncPublicUI(isPublic);

  toggle.addEventListener('change', async () => {
    if (!State.getUser() && toggle.checked) {
      toggle.checked = false;
      toast('Log in to share your timetable with friends', 'error');
      return;
    }
    isPublic = toggle.checked;
    await API.saveTimetable({ isPublic });
    syncPublicUI(isPublic);
    toast(isPublic ? 'Timetable shared with friends' : 'Timetable set to private', isPublic ? 'success' : '');
  });

  saveBtn?.addEventListener('click', async () => {
    const name = nameIn?.value.trim();
    if (!name) return;
    timetableName = name;
    await API.saveTimetable({ name, isPublic });
    toast('Timetable name saved', 'success');
  });
}

function syncPublicUI(isPublic) {
  document.getElementById('publicStatus')?.classList.toggle('hidden', !isPublic);
  document.getElementById('publicNameRow')?.classList.toggle('hidden', !isPublic);
}

/* ── Auto-schedule ───────────────────────── */
async function autoSchedule() {
  if (!selected.length) { toast('Add some units first!'); return; }

  const preferences = {
    avoid8am:    document.getElementById('prefNo8')?.checked    || false,
    compactDays: document.getElementById('prefCompact')?.checked || false,
    freeFridays: document.getElementById('prefFri')?.checked    || false,
  };

  try {
    const result = await API.autoSchedule({ selected, preferences });
    selected     = result.selected;
    await API.saveTimetable({ selected });
    renderSchedulePage();
    const drawer = document.getElementById('altDrawer');
    if (drawer) drawer.style.display = 'none';
    toast('Schedule optimised!', 'success');
  } catch {
    toast('Auto-schedule failed', 'error');
  }
}
