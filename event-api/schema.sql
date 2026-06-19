-- Aqlli Kuz event journal (SQLite)

CREATE TABLE IF NOT EXISTS person_events (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  day_key TEXT NOT NULL,
  type TEXT NOT NULL,
  who TEXT NOT NULL DEFAULT '',
  zone TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  camera_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_person_events_day ON person_events(day_key);
CREATE INDEX IF NOT EXISTS idx_person_events_who ON person_events(who);
CREATE INDEX IF NOT EXISTS idx_person_events_zone ON person_events(zone);
CREATE INDEX IF NOT EXISTS idx_person_events_type ON person_events(type);

CREATE TABLE IF NOT EXISTS face_matches (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  day_key TEXT NOT NULL,
  staff_key TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  camera_id TEXT NOT NULL DEFAULT '',
  zone TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL,
  clip_path TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'face_rec',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_face_matches_day ON face_matches(day_key);
CREATE INDEX IF NOT EXISTS idx_face_matches_staff ON face_matches(staff_key);

CREATE TABLE IF NOT EXISTS object_take_events (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  day_key TEXT NOT NULL,
  who TEXT NOT NULL,
  what TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT '',
  camera_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_object_take_day ON object_take_events(day_key);
CREATE INDEX IF NOT EXISTS idx_object_take_who ON object_take_events(who);

CREATE TABLE IF NOT EXISTS zone_presence (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  day_key TEXT NOT NULL,
  zone TEXT NOT NULL,
  camera_id TEXT NOT NULL DEFAULT '',
  person_count INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  day_key TEXT NOT NULL,
  camera_id TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL,
  duration_sec REAL,
  event_type TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clips_day ON clips(day_key);
CREATE INDEX IF NOT EXISTS idx_clips_camera ON clips(camera_id);

CREATE TABLE IF NOT EXISTS manual_corrections (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  event_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  by_user TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_faces (
  staff_key TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  embedding_path TEXT NOT NULL DEFAULT '',
  photo_path TEXT NOT NULL DEFAULT '',
  enrolled_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pending_strangers (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT '',
  camera_id TEXT NOT NULL DEFAULT '',
  photo_path TEXT NOT NULL DEFAULT '',
  face_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  staff_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pending_strangers_status ON pending_strangers(status);
