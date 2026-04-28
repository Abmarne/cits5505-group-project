/* ═══════════════════════════════════════════
   mockapi.js — Mock API (no backend required)

   Implements the same interface as api.js.
   All data lives in an internal localStorage
   DB keyed per student number — simulates a
   real server with persistent user records.

   Swap every import to api.js when Flask is live.
═══════════════════════════════════════════ */

import State from "./state.js";
import { detectConflicts, getActiveSessions } from "./schedule-utils.js";

/* ── Helpers ───────────────────────────────── */
function stripPassword({ password: _, ...u }) {
  return u;
}
function getInitials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ── Internal DB (simulates server storage) ── */
const DB_KEY = "uwa_mock_db";

function loadDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || {};
  } catch {
    return {};
  }
}
function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function defaultUser(sn) {
  return {
    timetable: {
      selected: [],
      semester: "S1",
      name: "My Timetable",
      isPublic: false,
    },
    friends: [],
    pending: [],
    sent: [],
  };
}

function userDB(db, studentNumber) {
  const k = studentNumber || State.getUser()?.studentNumber;
  if (!k) return defaultUser();
  if (!db[k]) db[k] = defaultUser(k);
  return db[k];
}

/* ── Mock users ────────────────────────────── */
const MOCK_USERS = [
  {
    id: 1,
    name: "Hung Nguyen",
    initials: "HN",
    email: "21000001@student.uwa.edu.au",
    studentNumber: "21000001",
    password: "demo1234",
  },
  {
    id: 2,
    name: "Alex Smith",
    initials: "AS",
    email: "21234567@student.uwa.edu.au",
    studentNumber: "21234567",
    password: "demo1234",
  },
  {
    id: 3,
    name: "Jordan Lee",
    initials: "JL",
    email: "21345678@student.uwa.edu.au",
    studentNumber: "21345678",
    password: "demo1234",
  },
  {
    id: 4,
    name: "Riley Morgan",
    initials: "RM",
    email: "21456789@student.uwa.edu.au",
    studentNumber: "21456789",
    password: "demo1234",
  },
  {
    id: 5,
    name: "Casey Park",
    initials: "CP",
    email: "21567890@student.uwa.edu.au",
    studentNumber: "21567890",
    password: "demo1234",
  },
];

const API = {
  /* ════════════════════════════════════════
     AUTH
  ════════════════════════════════════════ */

  async login(email, password) {
    const match = MOCK_USERS.find(
      (u) => u.email === email && u.password === password,
    );
    return match ? stripPassword(match) : null;
  },

  async loginDemo() {
    return stripPassword(MOCK_USERS[0]);
  },

  async register({ name, studentNumber, email, password }) {
    if (!email.endsWith("@student.uwa.edu.au"))
      throw new Error("Must use a UWA student email");
    if (!/^2\d{7}$/.test(studentNumber))
      throw new Error("Invalid student number");
    if (password.length < 8)
      throw new Error("Password must be at least 8 characters");
    return {
      id: Date.now(),
      name,
      initials: getInitials(name),
      email,
      studentNumber,
    };
  },

  async logout() {
    return { ok: true };
  },

  async changePassword({ currentPassword, newPassword }) {
    if (!currentPassword || newPassword.length < 8)
      throw new Error("Invalid password");
    return { ok: true };
  },

  /* ════════════════════════════════════════
     PROFILE
  ════════════════════════════════════════ */

  async getProfile() {
    return State.getUser();
  },

  async updateProfile({ name, studentNumber }) {
    const updated = {
      ...State.getUser(),
      name,
      initials: getInitials(name),
      studentNumber,
    };
    State.setUser(updated);
    return updated;
  },

  /* ════════════════════════════════════════
     COURSES
  ════════════════════════════════════════ */

  async getCourses() {
    const res = await fetch("./data/courses.json");
    if (!res.ok) throw new Error(`Failed to load courses (${res.status})`);
    return res.json();
  },

  async getCourse(code) {
    const courses = await this.getCourses();
    return courses.find((c) => c.code === code) ?? null;
  },

  /* ════════════════════════════════════════
     TIMETABLE
  ════════════════════════════════════════ */

  async getTimetable() {
    const db = loadDB();
    return { ...userDB(db).timetable };
  },

  async saveTimetable({ selected, semester, name, isPublic }) {
    const db = loadDB();
    const u = userDB(db);
    if (selected !== undefined) u.timetable.selected = selected;
    if (semester !== undefined) u.timetable.semester = semester;
    if (name !== undefined) u.timetable.name = name;
    if (isPublic !== undefined) u.timetable.isPublic = isPublic;
    saveDB(db);
    return { ok: true };
  },

  /* ════════════════════════════════════════
     SCHEDULING  (runs locally in mock)
  ════════════════════════════════════════ */

  async detectConflicts(selected) {
    const courses = await this.getCourses();
    return { conflicts: [...detectConflicts(selected, courses)] };
  },

  async autoSchedule({ selected, preferences = {} }) {
    const courses = await this.getCourses();
    const {
      avoid8am = false,
      compactDays = false,
      freeFridays = false,
    } = preferences;
    const result = selected.map((s) => ({ ...s }));

    for (let i = 0; i < result.length; i++) {
      const course = courses.find((c) => c.code === result[i].code);
      if (!course?.alternatives?.length) continue;

      let bestAlt = result[i].altIdx;
      let bestScore = Infinity;

      for (let alt = 0; alt <= course.alternatives.length; alt++) {
        const test = result.map((s, j) =>
          j === i ? { ...s, altIdx: alt } : s,
        );
        const nClash = detectConflicts(test, courses).size;
        const sessions = getActiveSessions(course, alt);
        const pen8am = avoid8am && sessions.some((s) => s.hour === 8) ? 10 : 0;
        const penFri =
          freeFridays && sessions.some((s) => s.day === 4) ? 10 : 0;
        const penSpread = compactDays
          ? new Set(sessions.map((s) => s.day)).size
          : 0;
        const score = nClash * 100 + pen8am + penFri + penSpread;

        if (score < bestScore) {
          bestScore = score;
          bestAlt = alt;
        }
      }
      result[i] = { ...result[i], altIdx: bestAlt };
    }
    return { selected: result };
  },

  /* ════════════════════════════════════════
     FRIENDS
  ════════════════════════════════════════ */

  async getFriends() {
    const db = loadDB();
    return userDB(db).friends;
  },

  async removeFriend(studentNumber) {
    const db = loadDB();
    const u = userDB(db);
    u.friends = u.friends.filter((f) => f.studentNumber !== studentNumber);
    saveDB(db);
    return { ok: true };
  },

  async sendFriendRequest(studentNumber) {
    const target = await this.lookupUser(studentNumber);
    const me = State.getUser();
    const db = loadDB();
    const myData = userDB(db);

    if (!myData.sent.find((r) => r.studentNumber === studentNumber)) {
      myData.sent.push({ ...target, sentAt: new Date().toISOString() });
    }
    // Simulate server delivering to recipient's pending inbox
    if (me) {
      const theirData = userDB(db, studentNumber);
      if (
        !theirData.pending.find((r) => r.studentNumber === me.studentNumber)
      ) {
        theirData.pending.push({
          ...me,
          requestedAt: new Date().toISOString(),
        });
      }
    }
    saveDB(db);
    return { ok: true };
  },

  async getSentRequests() {
    const db = loadDB();
    return userDB(db).sent;
  },

  async cancelFriendRequest(studentNumber) {
    const db = loadDB();
    const myData = userDB(db);
    const me = State.getUser();

    myData.sent = myData.sent.filter((r) => r.studentNumber !== studentNumber);
    if (me) {
      const theirData = userDB(db, studentNumber);
      theirData.pending = theirData.pending.filter(
        (r) => r.studentNumber !== me.studentNumber,
      );
    }
    saveDB(db);
    return { ok: true };
  },

  async getPendingRequests() {
    const db = loadDB();
    return userDB(db).pending;
  },

  async acceptFriendRequest(studentNumber) {
    const db = loadDB();
    const myData = userDB(db);
    const me = State.getUser();
    const req = myData.pending.find((r) => r.studentNumber === studentNumber);
    if (!req) return { ok: true };

    myData.pending = myData.pending.filter(
      (r) => r.studentNumber !== studentNumber,
    );
    if (!myData.friends.find((f) => f.studentNumber === studentNumber)) {
      myData.friends.push({ ...req, addedAt: new Date().toISOString() });
    }
    // Add bidirectional — also add me to their friends list
    if (me) {
      const theirData = userDB(db, studentNumber);
      if (
        !theirData.friends.find((f) => f.studentNumber === me.studentNumber)
      ) {
        theirData.friends.push({ ...me, addedAt: new Date().toISOString() });
      }
      theirData.sent = theirData.sent.filter(
        (r) => r.studentNumber !== me.studentNumber,
      );
    }
    saveDB(db);
    return { ok: true };
  },

  async declineFriendRequest(studentNumber) {
    const db = loadDB();
    const myData = userDB(db);
    myData.pending = myData.pending.filter(
      (r) => r.studentNumber !== studentNumber,
    );
    saveDB(db);
    return { ok: true };
  },

  async getFriendTimetable(studentNumber) {
    const db = loadDB();
    const theirData = userDB(db, studentNumber);
    if (!theirData.timetable.isPublic) return null;

    const match = MOCK_USERS.find((u) => u.studentNumber === studentNumber);
    const owner = match
      ? stripPassword(match)
      : {
          name: `Student ${studentNumber}`,
          initials: getInitials(`Student ${studentNumber}`),
          studentNumber,
        };

    return {
      ...theirData.timetable,
      timetableName: theirData.timetable.name,
      owner: { name: owner.name, initials: owner.initials, studentNumber },
    };
  },

  /* ════════════════════════════════════════
     USERS
  ════════════════════════════════════════ */

  async lookupUser(studentNumber) {
    const match = MOCK_USERS.find((u) => u.studentNumber === studentNumber);
    if (match) return stripPassword(match);
    return {
      id: Date.now(),
      name: `Student ${studentNumber}`,
      initials: getInitials(`Student ${studentNumber}`),
      email: `${studentNumber}@student.uwa.edu.au`,
      studentNumber,
    };
  },

  /* ════════════════════════════════════════
     DEMO SEED  (mock-only)
  ════════════════════════════════════════ */

  seedDemoData() {
    const db = loadDB();
    const alexData = userDB(db, "21234567");
    if (!alexData.timetable.isPublic) {
      alexData.timetable = {
        selected: [
          { code: "CITS1001", altIdx: 0 },
          { code: "MATH1001", altIdx: 0 },
        ],
        semester: "S1",
        name: "Semester 1 Plan",
        isPublic: true,
      };
      saveDB(db);
    }
  },
};

export default API;
