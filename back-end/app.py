"""
app.py — UWA Planner Flask backend

Route modules:
  auth.py       /api/auth/*  /api/health
  users.py      /api/profile  /api/users/*
  scheduling.py /api/timetables  /api/friends  /api/courses

Run:
    pip install -r requirements.txt
    python app.py
"""

import os
from datetime import timedelta
from flask import Flask, request, make_response
from flask_jwt_extended import JWTManager
from models import db, User, Timetable, TimetableEntry, Friendship, FriendRequest, CustomCourse
from utils import err, get_initials
from auth import auth_bp
from users import users_bp
from scheduling import scheduling_bp

# ── App & config ──────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config.update(
    SECRET_KEY                     = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production'),
    SQLALCHEMY_DATABASE_URI        = f'sqlite:///{os.path.join(BASE_DIR, "planner.db")}',
    SQLALCHEMY_TRACK_MODIFICATIONS = False,
    JWT_SECRET_KEY                 = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production'),
    JWT_ACCESS_TOKEN_EXPIRES       = timedelta(days=7),
)

db.init_app(app)
jwt = JWTManager(app)
app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(scheduling_bp)

# ── CORS ──────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS = {
    'http://localhost:5500', 'http://127.0.0.1:5500',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:8080', 'http://127.0.0.1:8080',
}

@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        return make_response('', 204)

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin', '')
    if origin in _ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin']      = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers']     = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods']     = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Max-Age']           = '86400'
        response.headers['Access-Control-Expose-Headers']    = 'Authorization'
    return response

# ── Error handlers ────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(_):
    return err('Not found', 404)

@app.errorhandler(405)
def method_not_allowed(_):
    return err('Method not allowed', 405)

@app.errorhandler(500)
def internal_error(e):
    db.session.rollback()
    app.logger.error(str(e))
    return err('Internal server error', 500)

@jwt.unauthorized_loader
def missing_token(_):
    return err('Not authenticated', 401)

@jwt.invalid_token_loader
def invalid_token(_):
    return err('Invalid token', 401)

@jwt.expired_token_loader
def expired_token(*_):
    return err('Token expired — please log in again', 401)

# ════════════════════════════════════════
# SEED & STARTUP
# ════════════════════════════════════════

# (name, student_number, password)
DEMO_USERS = [
    ('Hung Nguyen',  '21000001', 'demo1234'),
    ('Alex Smith',   '21234567', 'demo1234'),
    ('Jordan Lee',   '21345678', 'demo1234'),
    ('Riley Morgan', '21456789', 'demo1234'),
    ('Casey Park',   '21567890', 'demo1234'),
]

def _add_tt(user, name, semester, is_public, units):
    """Create a timetable with entries if it doesn't already exist."""
    if any(t.name == name for t in user.timetables):
        return
    tt = Timetable(user_id=user.id, name=name, semester=semester, is_public=is_public)
    db.session.add(tt)
    db.session.flush()
    for pos, (code, alt) in enumerate(units):
        db.session.add(TimetableEntry(timetable_id=tt.id, unit_code=code, alt_idx=alt, position=pos))

def _add_friendship(a, b):
    """Add bidirectional friendship if not already present."""
    if not Friendship.query.filter_by(user_id=a.id, friend_id=b.id).first():
        for row in Friendship.make(a.id, b.id):
            db.session.add(row)

def _add_request(sender, recipient):
    """Add friend request if not already present."""
    if not FriendRequest.query.filter_by(sender_id=sender.id, recipient_id=recipient.id).first():
        db.session.add(FriendRequest(sender_id=sender.id, recipient_id=recipient.id))

def seed():
    # ── 1. Users ──────────────────────────────────────────────────────
    for name, sn, pw in DEMO_USERS:
        if not User.query.filter_by(student_number=sn).first():
            u = User(name=name, initials=get_initials(name),
                     email=f'{sn}@student.uwa.edu.au', student_number=sn)
            u.set_password(pw)
            db.session.add(u)
    db.session.flush()

    hung  = User.query.filter_by(student_number='21000001').first()
    alex  = User.query.filter_by(student_number='21234567').first()
    jordan = User.query.filter_by(student_number='21345678').first()
    riley = User.query.filter_by(student_number='21456789').first()
    casey = User.query.filter_by(student_number='21567890').first()

    # ── 2. Timetables ─────────────────────────────────────────────────
    # Hung — two timetables: one public (S1), one private (S2)
    _add_tt(hung, 'Semester 1 Plan', 'S1', True, [
        ('CITS1401', 0), ('CITS1003', 0), ('MATH1001', 0),
    ])
    _add_tt(hung, 'Semester 2 Plan', 'S2', False, [
        ('CITS1402', 0), ('CITS2401', 0),
    ])

    # Alex — two timetables: private default + public CS focus
    _add_tt(alex, 'My Timetable', 'S1', False, [
        ('CITS1401', 0), ('CITS1402', 0),
    ])
    _add_tt(alex, 'CS Focus', 'S1', True, [
        ('CITS2200', 0), ('CITS3002', 0), ('CITS3003', 0),
    ])

    # Jordan — one public timetable (S2)
    _add_tt(jordan, 'My Timetable', 'S2', True, [
        ('CITS3001', 0), ('CITS3007', 0), ('CITS3200', 0),
    ])

    # Riley and Casey — empty default timetables
    for u in (riley, casey):
        if not u.timetables:
            db.session.add(Timetable(user_id=u.id, name='My Timetable'))

    db.session.flush()

    # ── 3. Custom course for Hung ──────────────────────────────────────
    import json as _json
    if not CustomCourse.query.filter_by(user_id=hung.id, code='PROJ9999').first():
        db.session.add(CustomCourse(
            user_id  = hung.id,
            code     = 'PROJ9999',
            name     = 'Research Project',
            sems     = _json.dumps(['S1', 'S2']),
            sessions = _json.dumps([{'type': 'LEC', 'day': 2, 'hour': 14, 'duration': 2}]),
        ))

    # ── 4. Friendships ────────────────────────────────────────────────
    # Hung ↔ Alex (friends — can view each other's public timetables)
    _add_friendship(hung, alex)
    # Hung ↔ Jordan (friends)
    _add_friendship(hung, jordan)

    db.session.flush()

    # ── 5. Friend requests ────────────────────────────────────────────
    # Riley → Hung  (Hung has an incoming request to accept or decline)
    _add_request(riley, hung)
    # Hung → Casey  (Hung has a sent/pending request to cancel)
    _add_request(hung, casey)

    db.session.commit()


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed()
        print('[ok] Database ready')
        print('[ok] Demo users seeded  (password: demo1234)')
        print('[ok] Running on http://localhost:5000')
    app.run(debug=True, port=5000)
