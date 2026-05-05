# UWA Timetable Planner

## Purpose

UWA Timetable Planner is a web application that helps University of Western Australia students plan their semester. Students can browse available units, build a conflict-free weekly timetable, and share their schedule with friends.

Key features:
- **Browse units** — search and filter UWA units by semester, faculty, or code
- **Build a schedule** — swap alternative time slots, auto-schedule to minimise conflicts
- **Friend system** — send friend requests, view friends' timetables, and compare schedules
- **Custom units** — add units not in the system with your own session times
- **Account management** — register with a UWA student number, update profile, change password

The frontend is a static multi-page app (HTML/CSS/JS) served by Python's built-in HTTP server. The backend is a Flask REST API with SQLite for storage and JWT for authentication.

---

## Group members

| UWA ID | Name | GitHub username |
|--------|------|-----------------|
| 23456789 | Student One | github-username-1 |
| 23456790 | Student Two | github-username-2 |
| 23456791 | Student Three | github-username-3 |
| 23456792 | Student Four | github-username-4 |

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.11+ | https://www.python.org/downloads/ |
| Node.js | 18+ | https://nodejs.org/ |

---

## Setup & launch

You need **two terminals** running simultaneously — one for the backend, one for the frontend.

### Windows

**Terminal 1 — Backend**

```cmd
cd back-end

:: Create and activate a virtual environment (first time only)
python -m venv venv
venv\Scripts\activate

:: Install dependencies (first time only)
python -m pip install -r requirements.txt

:: Start the Flask server
python app.py
```

**Terminal 2 — Frontend**

```cmd
cd front-end

:: Install and build Tailwind CSS (first time only)
npm install
npm run build

:: Serve the frontend
python -m http.server 5500
```

---

### macOS / Linux

**Terminal 1 — Backend**

```bash
cd back-end

# Create and activate a virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the Flask server
python app.py
```

**Terminal 2 — Frontend**

```bash
cd front-end

# Install and build Tailwind CSS (first time only)
npm install
npm run build

# Serve the frontend
python3 -m http.server 5500
```

---

Open **http://localhost:5500** in your browser. The Flask API runs at **http://localhost:5000** and the database (`planner.db`) is created automatically on first run.

> **Use Python's built-in HTTP server, not VS Code Live Server.** Live Server watches all files and triggers a page reload every time Flask writes to the database.

---

## Rebuilding CSS

The compiled Tailwind CSS file is not tracked in git. After cloning, or whenever you add new Tailwind classes, regenerate it:

```bash
cd front-end
npm run build      # one-off build
npm run watch      # rebuild automatically while developing
```

---

## Running the tests

*Coming soon.*
