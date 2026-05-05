# UWA Timetable Planner

A web application that helps University of Western Australia students plan their semester timetable, resolve scheduling conflicts, and share schedules with friends.

**Features**
- Browse and search UWA units by semester, faculty, or code
- Build a weekly timetable across multiple saved plans
- Click session blocks to preview and swap alternative time slots
- Auto-schedule to minimise conflicts based on preferences (avoid 8am, compact days, free Fridays)
- Share timetables with friends — toggle visibility per plan
- Add custom units with your own session times
- Register with a UWA student email, manage profile and password

**Stack** — Flask + SQLite + JWT (backend) · Static HTML/CSS/JS with Tailwind (frontend)

---

## Group members

| UWA ID | Name | GitHub username |
|--------|------|-----------------|
| 23456789 | Student One | github-username-1 |
| 23456790 | Student Two | github-username-2 |
| 23456791 | Student Three | github-username-3 |
| 23456792 | Student Four | github-username-4 |

---

## Project structure

```
cits5505-group-project/
├── back-end/
│   ├── app.py          # Flask app, CORS, error handlers, startup
│   ├── auth.py         # /api/auth/*  /api/health
│   ├── api.py          # /api/profile  /api/timetables  /api/friends  /api/courses
│   ├── models.py       # SQLAlchemy models
│   ├── utils.py        # Shared helpers
│   ├── seed.py         # Demo data (auto-runs on startup)
│   └── requirements.txt
└── front-end/
    ├── index.html      # Landing page
    ├── auth.html       # Login / register
    ├── courses.html    # Browse units
    ├── schedule.html   # My schedule
    ├── friends.html    # Friends
    ├── profile.html    # Account settings
    ├── css/
    │   ├── tokens.css          # Design tokens (colours, spacing)
    │   ├── custom.css          # Component styles
    │   └── tailwind-built.css  # Compiled Tailwind (git-ignored)
    ├── js/
    │   ├── courses.js
    │   ├── schedule.js
    │   ├── friends.js
    │   ├── profile.js
    │   └── utils/
    │       ├── api.js           # All API calls
    │       ├── state.js         # Auth state + localStorage
    │       ├── nav.js           # Nav injection + badges
    │       ├── components.js    # Shared components
    │       ├── schedule-utils.js
    │       └── toast.js
    └── data/
        └── courses.json        # Unit catalogue
```

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.11 |
| Node.js | 18 |

---

## Setup and launch

You need **two terminals** running simultaneously — one for the backend, one for the frontend.

### Windows

**Terminal 1 — Backend**

```cmd
cd back-end

:: Create virtual environment (first time only)
python -m venv venv
venv\Scripts\activate

:: Install dependencies (first time only)
pip install -r requirements.txt

:: Start the server (creates DB and seeds demo data automatically)
python app.py
```

**Terminal 2 — Frontend**

```cmd
cd front-end

:: Install Tailwind and build CSS (first time only)
npm install
npm run build

:: Serve the frontend
python -m http.server 5500
```

### macOS / Linux

**Terminal 1 — Backend**

```bash
cd back-end

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the server (creates DB and seeds demo data automatically)
python app.py
```

**Terminal 2 — Frontend**

```bash
cd front-end

# Install Tailwind and build CSS (first time only)
npm install
npm run build

# Serve the frontend
python3 -m http.server 5500
```

Then open **http://localhost:5500** in your browser.

> **Use `python -m http.server`, not VS Code Live Server.**
> Live Server reloads the page every time Flask writes to the database.

---

## Demo accounts

All demo accounts use password `demo1234`.

| Name | Student number | Notes |
|------|---------------|-------|
| Hung Nguyen | 21000001 | 2 timetables (S1 public, S2 private), friend with Alex and Jordan |
| Alex Smith | 21234567 | 1 public timetable (CS Focus) |
| Jordan Lee | 21345678 | 2 public timetables |
| Sam Chen | 21111111 | 2 private timetables, friend with Hung |
| Riley Morgan | 21456789 | Pending request to Hung |
| Casey Park | 21567890 | Pending request from Hung |

---

## Rebuilding CSS

The compiled Tailwind file (`front-end/css/tailwind-built.css`) is not tracked in git. Run after cloning or when adding new Tailwind classes:

```bash
cd front-end
npm run build     # one-off build
npm run watch     # watch mode while developing
```

---

## Running the tests

```bash
cd back-end
python -m pytest
```
