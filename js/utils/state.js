/* ═══════════════════════════════════════════
   state.js — Global application state
   
   Persists to localStorage so selections
   survive page-to-page navigation.
   Shape: { selected: [{code, altIdx}], semester, user }
═══════════════════════════════════════════ */

const State = {
  _key: 'uwa_planner_state',

  /* ── Defaults ───────────────────────── */
  _defaults() {
    return {
      selected: [],     // [{ code: string, altIdx: number }]
      semester: 'S1',   // active semester filter
      user: null,       // { name, initials, email } | null
    };
  },

  /* ── Core read / write ──────────────── */
  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? { ...this._defaults(), ...JSON.parse(raw) } : this._defaults();
    } catch {
      return this._defaults();
    }
  },

  _save(state) {
    localStorage.setItem(this._key, JSON.stringify(state));
  },

  /** Read the full state object */
  get() { return this._load(); },

  /** Shallow-merge a patch into state */
  set(patch) {
    this._save({ ...this._load(), ...patch });
  },

  /* ── Course selection helpers ───────── */
  addCourse(code) {
    const s = this._load();
    if (!s.selected.find(x => x.code === code)) {
      s.selected.push({ code, altIdx: 0 });
      this._save(s);
    }
  },

  removeCourse(code) {
    const s = this._load();
    s.selected = s.selected.filter(x => x.code !== code);
    this._save(s);
  },

  setAlt(code, altIdx) {
    const s = this._load();
    const entry = s.selected.find(x => x.code === code);
    if (entry) {
      entry.altIdx = altIdx;
      this._save(s);
    }
  },

  hasCourse(code) {
    return !!this._load().selected.find(x => x.code === code);
  },

  clearAll() {
    const s = this._load();
    s.selected = [];
    this._save(s);
  },
};
