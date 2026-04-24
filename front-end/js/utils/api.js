/* ═══════════════════════════════════════════
   api.js — API entry point

   Two-line switch to go live:
     1. Set USE_MOCK = false
     2. Set BASE_URL to your Flask server origin

   Pages always import from this file only.
═══════════════════════════════════════════ */

import MOCK from './mockapi.js';

const USE_MOCK = true;   // ← flip to false when Flask is live
const BASE_URL = '';     // ← e.g. 'http://localhost:5000'

/* ── Real fetch helpers ────────────────── */
async function request(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed (${res.status})`);
  }
  return res.json();
}

async function nullable(fn) {
  try { return await fn(); } catch { return null; }
}

/* ── Real API (Flask backend) ──────────── */
const REAL = {

  /* ════════════════════════════════════════
     AUTH
  ════════════════════════════════════════ */

  async login(email, password) {
    return nullable(() =>
      request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
        .then(d => d.user)
    );
  },

  async loginDemo() {
    return this.login('21000001@student.uwa.edu.au', 'demo1234');
  },

  async register({ name, studentNumber, email, password }) {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, studentNumber, email, password }),
    });
    return data.user;
  },

  async logout() {
    return request('/api/auth/logout', { method: 'POST' });
  },

  async changePassword({ currentPassword, newPassword }) {
    return request('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  /* ════════════════════════════════════════
     PROFILE
  ════════════════════════════════════════ */

  async getProfile() {
    const data = await request('/api/profile');
    return data.user;
  },

  async updateProfile({ name, studentNumber }) {
    const data = await request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, studentNumber }),
    });
    return data.user;
  },

  /* ════════════════════════════════════════
     COURSES
  ════════════════════════════════════════ */

  async getCourses() {
    return request('/api/courses');
  },

  async getCourse(code) {
    return request(`/api/courses/${code}`);
  },

  /* ════════════════════════════════════════
     TIMETABLE
  ════════════════════════════════════════ */

  async getTimetable() {
    return request('/api/timetable');
  },

  async saveTimetable({ selected, semester, name, isPublic }) {
    return request('/api/timetable', {
      method: 'POST',
      body: JSON.stringify({ selected, semester, name, isPublic }),
    });
  },

  /* ════════════════════════════════════════
     SCHEDULING
  ════════════════════════════════════════ */

  async detectConflicts(selected) {
    return request('/api/timetable/conflicts', {
      method: 'POST',
      body: JSON.stringify({ selected }),
    });
  },

  async autoSchedule({ selected, preferences }) {
    return request('/api/timetable/auto-schedule', {
      method: 'POST',
      body: JSON.stringify({ selected, preferences }),
    });
  },

  /* ════════════════════════════════════════
     FRIENDS
  ════════════════════════════════════════ */

  async getFriends() {
    return request('/api/friends');
  },

  async removeFriend(studentNumber) {
    return request(`/api/friends/${studentNumber}`, { method: 'DELETE' });
  },

  async sendFriendRequest(studentNumber) {
    return request('/api/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ studentNumber }),
    });
  },

  async getSentRequests() {
    return request('/api/friends/requests/sent');
  },

  async cancelFriendRequest(studentNumber) {
    return request(`/api/friends/requests/sent/${studentNumber}`, { method: 'DELETE' });
  },

  async getPendingRequests() {
    return request('/api/friends/requests/pending');
  },

  async acceptFriendRequest(studentNumber) {
    return request(`/api/friends/requests/${studentNumber}/accept`, { method: 'PUT' });
  },

  async declineFriendRequest(studentNumber) {
    return request(`/api/friends/requests/${studentNumber}`, { method: 'DELETE' });
  },

  async getFriendTimetable(studentNumber) {
    return nullable(() => request(`/api/friends/${studentNumber}/timetable`));
  },

  /* ════════════════════════════════════════
     USERS
  ════════════════════════════════════════ */

  async lookupUser(studentNumber) {
    return nullable(() => request(`/api/users/${studentNumber}`));
  },

  seedDemoData() {},

};

export default USE_MOCK ? MOCK : REAL;
