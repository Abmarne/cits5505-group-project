# Backend Developer Guide — UWA Timetable Planner

## Overview

The frontend is fully working with mock data. Your job is to build a Flask + SQLite backend that exposes the API the frontend already calls. When you're ready, the frontend switches over by changing two lines in `front-end/js/utils/api.js`:

```js
const USE_MOCK = false;              // was true
const BASE_URL = 'http://localhost:5000';
```

That's the only frontend change needed. Every API shape is locked — do not deviate from the response formats described here.

---

## Tech Stack

```
Flask              — web framework
Flask-SQLAlchemy   — ORM
Flask-Login        — session-based auth
Werkzeug           — password hashing (already in Flask)
Flask-CORS         — allow frontend origin during dev
SQLite             — database (single .db file)
```

Install:
```bash
pip install flask flask-sqlalchemy flask-login flask-cors
```

---

## Recommended Project Structure

```
back-end/
├── app.py              ← Flask app factory + run entry point
├── models.py           ← SQLAlchemy models (already written)
├── routes/
│   ├── auth.py         ← /api/auth/*
│   ├── profile.py      ← /api/profile
│   ├── courses.py      ← /api/courses
│   ├── timetable.py    ← /api/timetable
│   └── friends.py      ← /api/friends, /api/users
├── seed.py             ← populate DB with demo users + courses
└── instance/
    └── planner.db      ← SQLite file (git-ignored)
```

---

## Database Models

Already written in `back-end/models.py`. Summary:

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | VARCHAR(100) | display name |
| initials | VARCHAR(4) | derived from name, used in avatar |
| email | VARCHAR(120) UNIQUE | must end in `@student.uwa.edu.au` |
| student_number | VARCHAR(8) UNIQUE | 8-digit, starts with 2 |
| password_hash | VARCHAR(256) | Werkzeug hash |
| created_at | DATETIME | UTC |

### `timetables`

One timetable per user (one-to-one).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| user_id | INTEGER FK → users.id | UNIQUE |
| name | VARCHAR(100) | default `'My Timetable'` |
| semester | VARCHAR(4) | `'S1'` \| `'S2'` \| `'SUM'` |
| is_public | BOOLEAN | whether friends can see it |
| updated_at | DATETIME | auto-updated |

### `timetable_entries`

Each row = one unit in a timetable.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| timetable_id | INTEGER FK → timetables.id | |
| unit_code | VARCHAR(12) | e.g. `'CITS1003'` |
| alt_idx | INTEGER | 0 = default slot, 1+ = alternatives[alt_idx-1] |
| position | INTEGER | display order in frontend |

### `friendships`

Stored **bidirectionally** (two rows per friendship). Use `Friendship.make(a, b)` which creates both rows atomically.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| user_id | INTEGER FK → users.id | |
| friend_id | INTEGER FK → users.id | |
| created_at | DATETIME | |
| UNIQUE(user_id, friend_id) | | |

### `friend_requests`

Pending requests only. Delete the row when accepted or declined.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| sender_id | INTEGER FK → users.id | |
| recipient_id | INTEGER FK → users.id | |
| sent_at | DATETIME | |
| UNIQUE(sender_id, recipient_id) | | |

---

## Authentication

The frontend sends `credentials: 'include'` on every request — meaning it relies on **Flask session cookies**. Use `Flask-Login`.

```python
# app.py
from flask_login import LoginManager
login_manager = LoginManager()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
```

All protected routes use `@login_required`. Return `401` for unauthenticated access:

```python
@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'message': 'Not authenticated'}), 401
```

**CORS — required for local dev:**
```python
from flask_cors import CORS
CORS(app, supports_credentials=True, origins=['http://localhost:5500', 'http://127.0.0.1:5500'])
```

Adjust the origin to wherever the frontend is served (Live Server default is 5500).

---

## Error Response Format

Every error must return JSON in this shape so the frontend can display the message:

```json
{ "message": "Human-readable error description" }
```

```python
def err(msg, status=400):
    return jsonify({'message': msg}), status
```

---

## API Endpoints

### AUTH

---

#### `POST /api/auth/login`

**Request body:**
```json
{ "email": "21000001@student.uwa.edu.au", "password": "demo1234" }
```

**Response `200`:**
```json
{
  "user": {
    "id": 1,
    "name": "Hung Nguyen",
    "initials": "HN",
    "email": "21000001@student.uwa.edu.au",
    "studentNumber": "21000001"
  }
}
```

**Errors:** `400` missing fields · `401` wrong credentials

**Notes:**
- Call `flask_login.login_user(user)` to set the session cookie
- Return the `User.to_dict()` shape — note camelCase `studentNumber`

---

#### `POST /api/auth/register`

**Request body:**
```json
{
  "name": "Hung Nguyen",
  "studentNumber": "21000001",
  "email": "21000001@student.uwa.edu.au",
  "password": "demo1234"
}
```

**Response `201`:**
```json
{
  "user": {
    "id": 1,
    "name": "Hung Nguyen",
    "initials": "HN",
    "email": "21000001@student.uwa.edu.au",
    "studentNumber": "21000001"
  }
}
```

**Validation errors `400`:**
- Email does not end with `@student.uwa.edu.au`
- Student number does not match `^2\d{7}$`
- Password shorter than 8 characters
- Email or student number already exists

**Notes:**
- Derive `initials` as first letters of each word in name, max 2 chars, uppercase: `'Hung Nguyen'` → `'HN'`
- Call `user.set_password(password)` (already on the model)
- Create an empty `Timetable` for the user at the same time
- Call `login_user(user)` — user is immediately logged in after registration

```python
initials = ''.join(w[0] for w in name.split())[:2].upper()
```

---

#### `POST /api/auth/logout`

No body required.

**Response `200`:** `{ "ok": true }`

Call `flask_login.logout_user()`.

---

#### `PUT /api/auth/password`

Requires login.

**Request body:**
```json
{ "currentPassword": "old1234", "newPassword": "new5678" }
```

**Response `200`:** `{ "ok": true }`

**Errors:** `400` new password shorter than 8 chars · `401` current password wrong

```python
if not current_user.check_password(data['currentPassword']):
    return err('Current password is incorrect', 401)
current_user.set_password(data['newPassword'])
db.session.commit()
```

---

### PROFILE

---

#### `GET /api/profile`

Requires login.

**Response `200`:**
```json
{
  "user": {
    "id": 1,
    "name": "Hung Nguyen",
    "initials": "HN",
    "email": "21000001@student.uwa.edu.au",
    "studentNumber": "21000001"
  }
}
```

```python
return jsonify({'user': current_user.to_dict()})
```

---

#### `PUT /api/profile`

Requires login.

**Request body:**
```json
{ "name": "Hung Nguyen", "studentNumber": "21000001" }
```

**Response `200`:**
```json
{ "user": { ...updated user... } }
```

**Errors:** `400` invalid student number format · `409` student number already taken

---

### COURSES

The courses data lives in `front-end/data/courses.json`. Two options:

**Option A (simple):** Serve the JSON file directly.

```python
import json, os

@bp.route('/api/courses')
def get_courses():
    path = os.path.join(os.path.dirname(__file__), '../../front-end/data/courses.json')
    with open(path) as f:
        return jsonify(json.load(f))
```

**Option B (proper):** Seed courses into SQLite on startup and serve from DB. Use Option A unless you have extra time — the frontend only reads courses, never writes them.

---

#### `GET /api/courses`

No auth required.

**Response `200`:** Array of Course objects.

---

#### `GET /api/courses/<code>`

No auth required.

**Response `200`:** Single Course object · `404` if not found.

---

**Course object shape** (must match exactly):

```json
{
  "code": "CITS1003",
  "name": "Introduction to Cybersecurity",
  "cp": 6,
  "faculty": "CSSE",
  "sems": ["S1"],
  "sessions": [
    { "type": "LEC", "day": 0, "hour": 9,  "duration": 2 },
    { "type": "LAB", "day": 2, "hour": 14, "duration": 2 }
  ],
  "alternatives": [
    [{ "type": "LAB", "day": 3, "hour": 10, "duration": 2 }],
    [{ "type": "LAB", "day": 4, "hour": 14, "duration": 2 }]
  ]
}
```

**Day reference:** `0=Mon  1=Tue  2=Wed  3=Thu  4=Fri`

**Session types:** `"LEC"` `"LAB"` `"TUT"`

**altIdx mapping:** `0` = use base `sessions`, `1` = use `alternatives[0]`, `2` = use `alternatives[1]`, etc.

---

### TIMETABLE

Each user has exactly one timetable (created at registration).

---

#### `GET /api/timetable`

Requires login.

**Response `200`:**
```json
{
  "selected": [
    { "code": "CITS1003", "altIdx": 1 },
    { "code": "MATH1001", "altIdx": 0 }
  ],
  "semester": "S1",
  "name": "My Timetable",
  "isPublic": false
}
```

```python
tt = current_user.timetable
return jsonify({
    'selected':  [{'code': e.unit_code, 'altIdx': e.alt_idx} for e in tt.entries],
    'semester':  tt.semester,
    'name':      tt.name,
    'isPublic':  tt.is_public,
})
```

---

#### `POST /api/timetable`

Requires login. Replaces timetable state. Only update fields present in the body.

**Request body** (all fields optional):
```json
{
  "selected":  [{ "code": "CITS1003", "altIdx": 1 }],
  "semester":  "S1",
  "name":      "My Timetable",
  "isPublic":  true
}
```

**Response `200`:** `{ "ok": true }`

**Notes:**
- When `selected` is present: delete all existing `TimetableEntry` rows, insert the new ones with `position` = array index
- When `isPublic` changes: just update the column — friends query the DB directly

```python
tt = current_user.timetable
if 'selected' in data:
    TimetableEntry.query.filter_by(timetable_id=tt.id).delete()
    for i, entry in enumerate(data['selected']):
        db.session.add(TimetableEntry(
            timetable_id=tt.id,
            unit_code=entry['code'],
            alt_idx=entry.get('altIdx', 0),
            position=i
        ))
if 'semester' in data: tt.semester  = data['semester']
if 'name'     in data: tt.name      = data['name']
if 'isPublic' in data: tt.is_public = data['isPublic']
db.session.commit()
```

---

#### `POST /api/timetable/conflicts`

Requires login. Returns unit codes that have time clashes.

**Request body:**
```json
{
  "selected": [
    { "code": "CITS1003", "altIdx": 1 },
    { "code": "CITS1401", "altIdx": 0 }
  ]
}
```

**Response `200`:**
```json
{ "conflicts": ["CITS1003", "CITS1401"] }
```

**Conflict detection algorithm:**

```python
def get_active_sessions(course, alt_idx):
    sessions = list(course['sessions'])
    if alt_idx > 0 and course.get('alternatives'):
        alt       = course['alternatives'][alt_idx - 1]
        alt_types = {s['type'] for s in alt}
        sessions  = [s for s in sessions if s['type'] not in alt_types]
        sessions.extend(alt)
    return sessions

def sessions_overlap(a, b):
    if a['day'] != b['day']:
        return False
    return a['hour'] < b['hour'] + b['duration'] and b['hour'] < a['hour'] + a['duration']

def detect_conflicts(selected, courses_dict):
    """courses_dict: { code: course_object }"""
    conflicts = set()
    active    = []  # list of (code, session)

    for entry in selected:
        course = courses_dict.get(entry['code'])
        if not course:
            continue
        for sess in get_active_sessions(course, entry['altIdx']):
            active.append((entry['code'], sess))

    for i in range(len(active)):
        for j in range(i + 1, len(active)):
            code_a, sess_a = active[i]
            code_b, sess_b = active[j]
            if code_a != code_b and sessions_overlap(sess_a, sess_b):
                conflicts.add(code_a)
                conflicts.add(code_b)

    return conflicts
```

---

#### `POST /api/timetable/auto-schedule`

Requires login. Greedy conflict-minimiser with preference penalties.

**Request body:**
```json
{
  "selected": [{ "code": "CITS1003", "altIdx": 0 }],
  "preferences": {
    "avoid8am":    false,
    "compactDays": false,
    "freeFridays": false
  }
}
```

**Response `200`:**
```json
{ "selected": [{ "code": "CITS1003", "altIdx": 2 }] }
```

**Auto-schedule algorithm:**

```python
def auto_schedule(selected, preferences, courses_dict):
    avoid_8am    = preferences.get('avoid8am',    False)
    compact_days = preferences.get('compactDays', False)
    free_fridays = preferences.get('freeFridays', False)

    result = [dict(s) for s in selected]

    for i, entry in enumerate(result):
        course = courses_dict.get(entry['code'])
        if not course or not course.get('alternatives'):
            continue

        best_alt   = entry['altIdx']
        best_score = float('inf')
        num_alts   = len(course['alternatives'])

        for alt in range(num_alts + 1):   # 0 = default, 1..N = alternatives
            test         = [dict(s) for s in result]
            test[i]['altIdx'] = alt

            n_clash  = len(detect_conflicts(test, courses_dict))
            sessions = get_active_sessions(course, alt)

            pen_8am    = 10 if avoid_8am    and any(s['hour'] == 8 for s in sessions) else 0
            pen_fri    = 10 if free_fridays and any(s['day']  == 4 for s in sessions) else 0
            pen_spread = len({s['day'] for s in sessions}) if compact_days else 0

            score = n_clash * 100 + pen_8am + pen_fri + pen_spread
            if score < best_score:
                best_score = score
                best_alt   = alt

        result[i]['altIdx'] = best_alt

    return result
```

---

### FRIENDS

---

#### `GET /api/friends`

Requires login. Returns the current user's friend list.

**Response `200`:** `User[]`

```python
friendships = Friendship.query.filter_by(user_id=current_user.id).all()
return jsonify([f.friend.to_dict() for f in friendships])
```

---

#### `DELETE /api/friends/<student_number>`

Requires login. Removes both directions of the friendship.

**Response `200`:** `{ "ok": true }`

```python
friend = User.query.filter_by(student_number=student_number).first_or_404()
Friendship.query.filter(
    ((Friendship.user_id == current_user.id) & (Friendship.friend_id == friend.id)) |
    ((Friendship.user_id == friend.id)       & (Friendship.friend_id == current_user.id))
).delete()
db.session.commit()
```

---

#### `POST /api/friends/requests`

Requires login. Send a friend request.

**Request body:** `{ "studentNumber": "21234567" }`

**Response `200`:** `{ "ok": true }`

**Errors:** `404` recipient not found · `409` request already sent or already friends

```python
recipient = User.query.filter_by(student_number=data['studentNumber']).first_or_404()
existing  = FriendRequest.query.filter_by(
    sender_id=current_user.id, recipient_id=recipient.id
).first()
if existing:
    return err('Request already sent', 409)
db.session.add(FriendRequest(sender_id=current_user.id, recipient_id=recipient.id))
db.session.commit()
```

---

#### `GET /api/friends/requests/sent`

Requires login.

**Response `200`:** `User[]` — users you have sent requests to (still pending)

```python
reqs = FriendRequest.query.filter_by(sender_id=current_user.id).all()
return jsonify([r.recipient.to_dict() for r in reqs])
```

---

#### `DELETE /api/friends/requests/sent/<student_number>`

Requires login. Cancel a sent request.

**Response `200`:** `{ "ok": true }`

---

#### `GET /api/friends/requests/pending`

Requires login.

**Response `200`:** `User[]` — users who have sent you a request

```python
reqs = FriendRequest.query.filter_by(recipient_id=current_user.id).all()
return jsonify([r.sender.to_dict() for r in reqs])
```

---

#### `PUT /api/friends/requests/<student_number>/accept`

Requires login. Accept a pending friend request. Creates the friendship (both rows) and deletes the request row.

**Response `200`:** `{ "ok": true }`

```python
sender = User.query.filter_by(student_number=student_number).first_or_404()
req    = FriendRequest.query.filter_by(
    sender_id=sender.id, recipient_id=current_user.id
).first_or_404()
db.session.delete(req)
for row in Friendship.make(current_user.id, sender.id):
    db.session.add(row)
db.session.commit()
```

---

#### `DELETE /api/friends/requests/<student_number>`

Requires login. Decline a pending request (deletes the request row, no friendship created).

**Response `200`:** `{ "ok": true }`

---

#### `GET /api/friends/<student_number>/timetable`

Requires login. Returns a friend's timetable only if `is_public = true` AND they are actually your friend.

**Response `200`:**
```json
{
  "selected":      [{ "code": "CITS1001", "altIdx": 0 }],
  "semester":      "S1",
  "name":          "Semester 1 Plan",
  "isPublic":      true,
  "timetableName": "Semester 1 Plan",
  "owner": {
    "name":          "Alex Smith",
    "initials":      "AS",
    "studentNumber": "21234567"
  }
}
```

**Response `404`:** not a friend, timetable is private, or friend doesn't exist

```python
friend    = User.query.filter_by(student_number=student_number).first_or_404()
is_friend = Friendship.query.filter_by(
    user_id=current_user.id, friend_id=friend.id
).first()
if not is_friend:
    return err('Not a friend', 404)
tt = friend.timetable
if not tt or not tt.is_public:
    return err('Timetable is private', 404)
return jsonify({
    'selected':      [{'code': e.unit_code, 'altIdx': e.alt_idx} for e in tt.entries],
    'semester':      tt.semester,
    'name':          tt.name,
    'isPublic':      True,
    'timetableName': tt.name,
    'owner': {
        'name':          friend.name,
        'initials':      friend.initials,
        'studentNumber': friend.student_number,
    },
})
```

---

### USERS

---

#### `GET /api/users/<student_number>`

No auth required. Used for the "add friend by student number" lookup.

**Response `200`:** `User` object · `404` if not found

---

## Seed Data

Create `seed.py` to populate demo users so the frontend's "Demo Login" button works:

```python
from app import create_app
from models import db, User, Timetable, TimetableEntry

DEMO_USERS = [
    ('Hung Nguyen',  'HN', '21000001@student.uwa.edu.au', '21000001', 'demo1234'),
    ('Alex Smith',   'AS', '21234567@student.uwa.edu.au', '21234567', 'demo1234'),
    ('Jordan Lee',   'JL', '21345678@student.uwa.edu.au', '21345678', 'demo1234'),
    ('Riley Morgan', 'RM', '21456789@student.uwa.edu.au', '21456789', 'demo1234'),
    ('Casey Park',   'CP', '21567890@student.uwa.edu.au', '21567890', 'demo1234'),
]

app = create_app()
with app.app_context():
    db.create_all()
    for name, initials, email, sn, pw in DEMO_USERS:
        if not User.query.filter_by(student_number=sn).first():
            u = User(name=name, initials=initials, email=email, student_number=sn)
            u.set_password(pw)
            db.session.add(u)
            db.session.flush()
            db.session.add(Timetable(user_id=u.id))

    # Give Alex a public timetable for demo
    alex = User.query.filter_by(student_number='21234567').first()
    if alex and alex.timetable:
        alex.timetable.is_public = True
        alex.timetable.name      = 'Semester 1 Plan'
        alex.timetable.semester  = 'S1'
        TimetableEntry.query.filter_by(timetable_id=alex.timetable.id).delete()
        for i, (code, alt) in enumerate([('CITS1001', 0), ('MATH1001', 0)]):
            db.session.add(TimetableEntry(
                timetable_id=alex.timetable.id,
                unit_code=code,
                alt_idx=alt,
                position=i
            ))

    db.session.commit()
    print('Seeded successfully.')
```

Run with: `python seed.py`

---

## Minimal `app.py`

```python
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS
from models import db, User

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY']              = 'change-me-in-production'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///planner.db'

    db.init_app(app)
    CORS(app, supports_credentials=True,
         origins=['http://localhost:5500', 'http://127.0.0.1:5500'])

    login_manager = LoginManager(app)

    @login_manager.user_loader
    def load_user(uid):
        return User.query.get(int(uid))

    @login_manager.unauthorized_handler
    def unauth():
        return {'message': 'Not authenticated'}, 401

    from routes.auth      import bp as auth_bp
    from routes.profile   import bp as profile_bp
    from routes.courses   import bp as courses_bp
    from routes.timetable import bp as timetable_bp
    from routes.friends   import bp as friends_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(courses_bp)
    app.register_blueprint(timetable_bp)
    app.register_blueprint(friends_bp)

    return app

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
```

---

## Quick Reference

| What | Value |
|------|-------|
| Demo login email | `21000001@student.uwa.edu.au` |
| Demo password | `demo1234` |
| All demo passwords | `demo1234` |
| Frontend dev port | `5500` (VS Code Live Server) |
| Flask port | `5000` |
| Auth mechanism | Session cookie (`credentials: 'include'`) |
| Error body | `{ "message": "..." }` |
| Success body | `{ "ok": true }` or the resource |
| JSON key style | camelCase for all keys sent to frontend |

---

## Switching the Frontend to Live Backend

Open `front-end/js/utils/api.js` and change:

```js
const USE_MOCK = false;
const BASE_URL = 'http://localhost:5000';
```

Save and refresh. The frontend will now talk to your Flask server with no other changes needed.
