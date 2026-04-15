# CITS5505 Group Project — Pre-Meeting Plan
**Application: UWA Timetable Planner**
Branch: `hung` | Last updated: 2026-04-16

---

## 1. Application Description

**UWA Timetable Planner** is a web application that lets UWA students browse real unit offerings, build a conflict-free weekly timetable, swap between alternative lab/tutorial slots, and share their schedule with classmates — all before enrolment day.

Key value propositions (from the live front-end):
- Search 250+ units by code, name, faculty, credit points, and semester
- Instant clash detection when adding units
- Auto-scheduler that picks the best slot combination based on user preferences
- Shareable timetable link (view-only, expires in 30 days)
- Export timetable as PNG or to calendar

---

## 2. User Stories

| # | As a… | I want to… | So that… |
|---|--------|------------|----------|
| 1 | UWA student | browse all available units filtered by semester (S1 / S2 / Summer) | I can see what's on offer before I commit to anything |
| 2 | UWA student | search units by code, name, or faculty | I can quickly find a specific unit without scrolling the whole catalogue |
| 3 | UWA student | add a unit to my selection with one click | I can build my semester basket without leaving the browse page |
| 4 | UWA student | see an instant warning when two of my units clash in time | I know about conflicts before I head to enrolment |
| 5 | UWA student | swap between alternative lab/tutorial times for a unit | I can resolve clashes without dropping the unit entirely |
| 6 | UWA student | use the Auto-schedule button with preferences (avoid 8am, free Fridays, compact days) | I get a suggested conflict-free timetable without manually trying every combination |
| 7 | UWA student | generate a shareable link to my timetable | I can send it to friends so we can coordinate overlapping units |
| 8 | UWA student | export my final timetable as a PNG image | I have an offline copy to reference during orientation week |
| 9 | UWA student | create an account and log in with my @student.uwa.edu.au email | my saved timetables persist across devices and sessions |
| 10 | UWA student | save multiple named timetables (e.g. "Plan A", "Plan B") | I can compare different unit combinations before making a final decision |
| 11 | UWA student | view a shared timetable link sent by a classmate without needing to log in | I can check if our schedules overlap without creating an account |
| 12 | UWA student | manually add a unit code that is not yet in the database | I'm not blocked if a new unit hasn't been scraped yet |

---

## 3. Main Pages

| Page | File | Purpose |
|------|------|---------|
| **Home / Landing** | `index.html` | Marketing hero, feature highlights, entry points to browse and sign up |
| **Browse Units** | `courses.html` | Search and filter unit catalogue; add units to selection basket |
| **My Selection** | `selected.html` | Review selected units, see conflict warnings, remove units |
| **Schedule Generator** | `schedule.html` | Interactive weekly timetable grid; auto-schedule; slot alternatives; share/export |
| **Login / Sign up** | `auth.html` | Tabbed auth card with email/password forms + Google/GitHub OAuth buttons |
| **Shared Timetable** *(planned)* | `shared.html` | Read-only view of another user's timetable via share code (no login required) |

---

## 4. CSS Framework

**Custom CSS (no third-party framework)**

The project uses a hand-rolled design system located in [css/](css/):

| File | Responsibility |
|------|---------------|
| `css/base/tokens.css` | Design tokens — colours, spacing, radius, shadows |
| `css/base/reset.css` | Normalise browser defaults |
| `css/base/theme.css` | Dark / light mode via `data-theme` attribute |
| `css/base/animations.css` | Page-enter and micro-interaction keyframes |
| `css/base/buttons.css` | `.btn`, `.btn-primary`, `.btn-sm`, `.btn-ghost` variants |
| `css/base/forms.css` | Inputs, labels, error states, strength bar |
| `css/base/nav.css` | Sticky top nav, logo, badge, avatar |
| `css/base/components.css` | Shared panel, card, toast, modal, overlay |
| `css/global.css` | Imports all base files + page-shell layout |
| `css/home.css` | Hero, features grid, stats, footer |
| `css/courses.css` | Two-column layout, table, filter chips, basket |
| `css/schedule.css` | Timetable grid, control card, legend, share modal |
| `css/selected.css` | Unit cards grid, summary bar, conflict alert |
| `css/auth.css` | Centred auth card, tabs, OAuth buttons, strength bar |

**Google Fonts used:**
- `Syne` (700/800) — headings and logo
- `Instrument Sans` (300–500, italic) — body text
- `JetBrains Mono` (400/500) — code labels (unit codes, times, CP counts)

> **Rationale for no framework:** A custom token-based system keeps the bundle minimal, makes dark-mode trivial via a single attribute swap, and avoids Bootstrap/Tailwind class-name noise in the HTML — important for a code-reviewed student project.

---

## 5. Current Progress (branch `hung`)

All front-end static pages have been sketched:

- [x] `index.html` — Home page with hero, 6-feature grid, stats, footer
- [x] `auth.html` — Login + Sign up tabs, Google/GitHub OAuth placeholders, password strength bar
- [x] `courses.html` — Unit table with filters, search, basket sidebar, manual-add panel
- [x] `selected.html` — Unit cards, conflict alert banner, empty state
- [x] `schedule.html` — Weekly timetable grid, auto-schedule button, preferences panel, slot alternatives drawer, share modal
- [x] `data/data-model.json` — Full API contract (schemas + endpoints) agreed between front-end and Flask back-end
- [x] `data/courses.json` — Sample unit data for front-end development
- [x] JS utility modules (`state.js`, `api.js`, `schedule-utils.js`, `theme.js`, `toast.js`, `nav.js`)
- [ ] Flask back-end (not started — intentionally waiting until after mid-semester break)
- [ ] `shared.html` — Shared timetable view (planned)
- [ ] PNG export (UI wired, logic pending)
- [ ] OAuth integration (buttons present, wired after back-end)

---

*This document covers the pre-meeting deliverables for CITS5505 Group Project.*
