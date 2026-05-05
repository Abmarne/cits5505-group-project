"""
api.py — Authenticated API routes

  /api/profile          GET PUT
  /api/users/<sn>       GET
  /api/timetables       GET POST
  /api/timetables/<id>  GET PUT DELETE  + /conflicts  /auto-schedule
  /api/friends          GET DELETE
  /api/friends/requests GET POST PUT DELETE
  /api/friends/<sn>/timetables  GET
  /api/courses          GET
  /api/courses/<code>   GET
  /api/courses/custom   GET POST DELETE
"""

import json as _json
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from models import db, User, Timetable, TimetableEntry, Friendship, FriendRequest, CustomCourse
from utils import ok, err, current_user, user_dict, get_initials, load_courses

api_bp = Blueprint('api', __name__)


# ════════════════════════════════════════
# USERS  /api/profile  /api/users
# ════════════════════════════════════════

@api_bp.get('/api/profile')
@jwt_required()
def get_profile():
    return jsonify({'user': user_dict(current_user())})


@api_bp.put('/api/profile')
@jwt_required()
def update_profile():
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = (data.get('name')          or '').strip()
    sn   = (data.get('studentNumber') or '').strip()

    if name:
        user.name     = name
        user.initials = get_initials(name)
    if sn and sn != user.student_number:
        if User.query.filter_by(student_number=sn).first():
            return err('Student number already in use', 409)
        user.student_number = sn

    db.session.commit()
    return jsonify({'user': user_dict(user)})


@api_bp.get('/api/users/<student_number>')
@jwt_required()
def lookup_user(student_number):
    user = User.query.filter_by(student_number=student_number).first()
    if not user:
        return err('User not found', 404)
    return jsonify(user_dict(user))


# ════════════════════════════════════════
# SCHEDULING HELPERS
# ════════════════════════════════════════

def get_active_sessions(course: dict, alt_idx: int) -> list:
    base = list(course.get('sessions', []))
    alts = course.get('alternatives', [])
    if alt_idx == 0 or not alts:
        return base
    alt = alts[alt_idx - 1] if alt_idx - 1 < len(alts) else []
    if alt:
        alt_type = alt[0]['type']
        base = [s for s in base if s['type'] != alt_type]
    return base + alt


def detect_conflicts(selected: list, courses: list) -> set:
    slots = []
    for entry in selected:
        course = next((c for c in courses if c['code'] == entry.get('code')), None)
        if not course:
            continue
        for s in get_active_sessions(course, entry.get('altIdx', 0)):
            slots.append((s['day'], s['hour'], s['hour'] + s['duration'], entry['code']))

    conflicts = set()
    for i in range(len(slots)):
        for j in range(i + 1, len(slots)):
            a, b = slots[i], slots[j]
            if a[0] == b[0] and a[1] < b[2] and b[1] < a[2]:
                conflicts.add(a[3])
                conflicts.add(b[3])
    return conflicts


def run_auto_schedule(selected: list, courses: list, prefs: dict) -> list:
    avoid_8am    = prefs.get('avoid8am', False)
    compact_days = prefs.get('compactDays', False)
    free_fridays = prefs.get('freeFridays', False)
    result = [dict(e) for e in selected]

    for i, entry in enumerate(result):
        course = next((c for c in courses if c['code'] == entry['code']), None)
        if not course or not course.get('alternatives'):
            continue

        best_alt, best_score = entry.get('altIdx', 0), float('inf')

        for alt in range(len(course['alternatives']) + 1):
            test = [dict(e) for e in result]
            test[i]['altIdx'] = alt
            n_clash    = len(detect_conflicts(test, courses))
            sessions   = get_active_sessions(course, alt)
            pen_8am    = 10 if avoid_8am    and any(s['hour'] == 8 for s in sessions) else 0
            pen_fri    = 10 if free_fridays and any(s['day']  == 4 for s in sessions) else 0
            pen_spread = len({s['day'] for s in sessions}) if compact_days else 0
            score      = n_clash * 100 + pen_8am + pen_fri + pen_spread

            if score < best_score:
                best_score, best_alt = score, alt

        result[i]['altIdx'] = best_alt
    return result


def replace_entries(tt: Timetable, selected: list) -> None:
    TimetableEntry.query.filter_by(timetable_id=tt.id).delete()
    for pos, item in enumerate(selected):
        db.session.add(TimetableEntry(
            timetable_id = tt.id,
            unit_code    = item['code'],
            alt_idx      = item.get('altIdx', 0),
            position     = pos,
        ))


def get_tt_or_404(user: User, tt_id: int):
    tt = db.session.get(Timetable, tt_id)
    if not tt or tt.user_id != user.id:
        return None
    return tt


def _sorted_timetables(user: User) -> list:
    return sorted(user.timetables, key=lambda t: t.updated_at or datetime.min, reverse=True)


# ════════════════════════════════════════
# TIMETABLES  /api/timetables
# ════════════════════════════════════════

@api_bp.get('/api/timetables')
@jwt_required()
def list_timetables():
    user = current_user()
    if not user.timetables:
        tt = Timetable(user_id=user.id, name='My Timetable')
        db.session.add(tt)
        db.session.commit()
    return jsonify([tt.to_summary() for tt in _sorted_timetables(user)])


@api_bp.post('/api/timetables')
@jwt_required()
def create_timetable():
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip() or 'New Timetable'
    tt   = Timetable(user_id=user.id, name=name, semester=data.get('semester', 'S1'))
    db.session.add(tt)
    db.session.commit()
    return jsonify(tt.to_dict()), 201


@api_bp.get('/api/timetables/<int:tt_id>')
@jwt_required()
def get_timetable(tt_id):
    tt = get_tt_or_404(current_user(), tt_id)
    if not tt:
        return err('Timetable not found', 404)
    return jsonify(tt.to_dict())


@api_bp.put('/api/timetables/<int:tt_id>')
@jwt_required()
def update_timetable(tt_id):
    user = current_user()
    tt   = get_tt_or_404(user, tt_id)
    if not tt:
        return err('Timetable not found', 404)
    data = request.get_json(silent=True) or {}
    if data.get('name') is not None:
        tt.name = data['name'].strip() or tt.name
    if data.get('isPublic') is not None:
        tt.is_public = bool(data['isPublic'])
    if data.get('semester') is not None:
        tt.semester = data['semester']
    if data.get('selected') is not None:
        replace_entries(tt, data['selected'])
    tt.updated_at = datetime.utcnow()
    db.session.commit()
    return ok()


@api_bp.delete('/api/timetables/<int:tt_id>')
@jwt_required()
def delete_timetable(tt_id):
    tt = get_tt_or_404(current_user(), tt_id)
    if not tt:
        return err('Timetable not found', 404)
    db.session.delete(tt)
    db.session.commit()
    return ok()


@api_bp.post('/api/timetables/<int:tt_id>/conflicts')
@jwt_required()
def timetable_conflicts(tt_id):
    user     = current_user()
    tt       = get_tt_or_404(user, tt_id)
    if not tt:
        return err('Timetable not found', 404)
    data     = request.get_json(silent=True) or {}
    selected = data.get('selected', [e.to_dict() for e in tt.entries])
    courses  = load_courses() + [r.to_dict() for r in CustomCourse.query.filter_by(user_id=user.id).all()]
    return jsonify({'conflicts': list(detect_conflicts(selected, courses))})


@api_bp.post('/api/timetables/<int:tt_id>/auto-schedule')
@jwt_required()
def timetable_auto_schedule(tt_id):
    user     = current_user()
    tt       = get_tt_or_404(user, tt_id)
    if not tt:
        return err('Timetable not found', 404)
    data     = request.get_json(silent=True) or {}
    selected = data.get('selected', [e.to_dict() for e in tt.entries])
    prefs    = data.get('preferences', {})
    courses  = load_courses() + [r.to_dict() for r in CustomCourse.query.filter_by(user_id=user.id).all()]
    return jsonify({'selected': run_auto_schedule(selected, courses, prefs)})


# ════════════════════════════════════════
# FRIENDS  /api/friends
# ════════════════════════════════════════

@api_bp.get('/api/friends')
@jwt_required()
def get_friends():
    user = current_user()
    return jsonify([
        {**user_dict(fs.friend), 'addedAt': fs.created_at.isoformat() + 'Z'}
        for fs in user.friendships
    ])


@api_bp.delete('/api/friends/<student_number>')
@jwt_required()
def remove_friend(student_number):
    user   = current_user()
    friend = User.query.filter_by(student_number=student_number).first()
    if friend:
        Friendship.query.filter(
            ((Friendship.user_id   == user.id)   & (Friendship.friend_id == friend.id)) |
            ((Friendship.user_id   == friend.id) & (Friendship.friend_id == user.id))
        ).delete(synchronize_session=False)
        db.session.commit()
    return ok()


@api_bp.post('/api/friends/requests')
@jwt_required()
def send_friend_request():
    user      = current_user()
    data      = request.get_json(silent=True) or {}
    recipient = User.query.filter_by(student_number=data.get('studentNumber', '')).first()
    if not recipient:
        return err('User not found', 404)
    if recipient.id == user.id:
        return err('Cannot send a request to yourself', 422)
    if Friendship.query.filter_by(user_id=user.id, friend_id=recipient.id).first():
        return err('Already friends', 409)
    if not FriendRequest.query.filter_by(sender_id=user.id, recipient_id=recipient.id).first():
        db.session.add(FriendRequest(sender_id=user.id, recipient_id=recipient.id))
        db.session.commit()
    return ok()


@api_bp.get('/api/friends/requests/sent')
@jwt_required()
def get_sent_requests():
    user = current_user()
    return jsonify([
        {**user_dict(r.recipient), 'sentAt': r.sent_at.isoformat() + 'Z'}
        for r in user.sent_requests
    ])


@api_bp.delete('/api/friends/requests/sent/<student_number>')
@jwt_required()
def cancel_friend_request(student_number):
    user      = current_user()
    recipient = User.query.filter_by(student_number=student_number).first()
    if recipient:
        FriendRequest.query.filter_by(sender_id=user.id, recipient_id=recipient.id).delete()
        db.session.commit()
    return ok()


@api_bp.get('/api/friends/requests/pending')
@jwt_required()
def get_pending_requests():
    user = current_user()
    return jsonify([
        {**user_dict(r.sender), 'requestedAt': r.sent_at.isoformat() + 'Z'}
        for r in user.recv_requests
    ])


@api_bp.put('/api/friends/requests/<student_number>/accept')
@jwt_required()
def accept_friend_request(student_number):
    user   = current_user()
    sender = User.query.filter_by(student_number=student_number).first()
    if not sender:
        return err('User not found', 404)
    req = FriendRequest.query.filter_by(sender_id=sender.id, recipient_id=user.id).first()
    if not req:
        return ok()
    db.session.delete(req)
    for row in Friendship.make(user.id, sender.id):
        if not Friendship.query.filter_by(user_id=row.user_id, friend_id=row.friend_id).first():
            db.session.add(row)
    db.session.commit()
    return ok()


@api_bp.delete('/api/friends/requests/<student_number>')
@jwt_required()
def decline_friend_request(student_number):
    user   = current_user()
    sender = User.query.filter_by(student_number=student_number).first()
    if sender:
        FriendRequest.query.filter_by(sender_id=sender.id, recipient_id=user.id).delete()
        db.session.commit()
    return ok()


@api_bp.get('/api/friends/<student_number>/timetables')
@jwt_required()
def get_friend_timetables(student_number):
    me     = current_user()
    friend = User.query.filter_by(student_number=student_number).first()
    if not friend:
        current_app.logger.info(f'[timetables] {student_number} not found')
        return err('User not found', 404)
    is_friend = Friendship.query.filter_by(user_id=me.id, friend_id=friend.id).first()
    current_app.logger.info(
        f'[timetables] me={me.student_number} friend={student_number} '
        f'is_friend={bool(is_friend)} '
        f'tts={[(tt.name, tt.is_public) for tt in friend.timetables]}'
    )
    if not is_friend:
        return err('Not friends', 403)
    result = []
    for tt in friend.timetables:
        if tt.is_public:
            d = tt.to_dict()
            d['owner'] = {
                'name':          friend.name,
                'initials':      friend.initials,
                'studentNumber': friend.student_number,
            }
            result.append(d)
    return jsonify(result)


# ════════════════════════════════════════
# COURSES  /api/courses
# ════════════════════════════════════════

@api_bp.get('/api/courses')
def get_courses():
    return jsonify(load_courses())


@api_bp.get('/api/courses/<code>')
def get_course(code):
    course = next((c for c in load_courses() if c['code'] == code.upper()), None)
    if not course:
        return err('Course not found', 404)
    return jsonify(course)


@api_bp.get('/api/courses/custom')
@jwt_required()
def get_custom_courses():
    user = current_user()
    return jsonify([r.to_dict() for r in CustomCourse.query.filter_by(user_id=user.id).all()])


@api_bp.post('/api/courses/custom')
@jwt_required()
def save_custom_course():
    user = current_user()
    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip().upper()
    name = (data.get('name') or '').strip() or code
    if not code:
        return err('Unit code is required')
    row = CustomCourse.query.filter_by(user_id=user.id, code=code).first()
    if row:
        row.name     = name
        row.sems     = _json.dumps(data.get('sems', ['S1']))
        row.sessions = _json.dumps(data.get('sessions', []))
    else:
        db.session.add(CustomCourse(
            user_id  = user.id,
            code     = code,
            name     = name,
            sems     = _json.dumps(data.get('sems', ['S1'])),
            sessions = _json.dumps(data.get('sessions', [])),
        ))
    db.session.commit()
    return ok()


@api_bp.delete('/api/courses/custom/<code>')
@jwt_required()
def delete_custom_course(code):
    user = current_user()
    CustomCourse.query.filter_by(user_id=user.id, code=code.upper()).delete()
    db.session.commit()
    return ok()
