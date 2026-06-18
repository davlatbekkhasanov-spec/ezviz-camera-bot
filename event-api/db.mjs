import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function dayKey(date = new Date()) {
  const tz = process.env.TZ || "Asia/Tashkent";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function newId(prefix = "ev") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

let db;

export function getDb() {
  if (db) return db;
  const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "aqlli-kuz.db");
  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  console.log("DB:", file);
  return db;
}

export function logPersonEvent(row) {
  const d = getDb();
  const at = row.at || new Date().toISOString();
  const id = row.id || newId("pe");
  d.prepare(
    `INSERT INTO person_events (id, at, day_key, type, who, zone, source, camera_id, note, confidence)
     VALUES (@id, @at, @day_key, @type, @who, @zone, @source, @camera_id, @note, @confidence)`
  ).run({
    id,
    at,
    day_key: row.dayKey || dayKey(new Date(at)),
    type: row.type,
    who: row.who || "",
    zone: row.zone || "",
    source: row.source || "manual",
    camera_id: row.cameraId || "",
    note: row.note || "",
    confidence: row.confidence ?? null,
  });
  return { id, at };
}

export function logObjectTake(row) {
  const d = getDb();
  const at = row.at || new Date().toISOString();
  const id = row.id || newId("ot");
  d.prepare(
    `INSERT INTO object_take_events (id, at, day_key, who, what, zone, camera_id, source, note)
     VALUES (@id, @at, @day_key, @who, @what, @zone, @camera_id, @source, @note)`
  ).run({
    id,
    at,
    day_key: row.dayKey || dayKey(new Date(at)),
    who: row.who,
    what: row.what,
    zone: row.zone || "",
    camera_id: row.cameraId || "",
    source: row.source || "manual",
    note: row.note || "",
  });
  return { id, at };
}

export function logFaceMatch(row) {
  const d = getDb();
  const at = row.at || new Date().toISOString();
  const id = row.id || newId("fm");
  d.prepare(
    `INSERT INTO face_matches (id, at, day_key, staff_key, staff_name, camera_id, zone, confidence, clip_path, source)
     VALUES (@id, @at, @day_key, @staff_key, @staff_name, @camera_id, @zone, @confidence, @clip_path, @source)`
  ).run({
    id,
    at,
    day_key: row.dayKey || dayKey(new Date(at)),
    staff_key: row.staffKey,
    staff_name: row.staffName,
    camera_id: row.cameraId || "",
    zone: row.zone || "",
    confidence: row.confidence,
    clip_path: row.clipPath || "",
    source: row.source || "face_rec",
  });
  return { id, at };
}

export function logClip(row) {
  const d = getDb();
  const at = row.at || new Date().toISOString();
  const id = row.id || newId("cl");
  d.prepare(
    `INSERT INTO clips (id, at, day_key, camera_id, zone, path, duration_sec, event_type, note)
     VALUES (@id, @at, @day_key, @camera_id, @zone, @path, @duration_sec, @event_type, @note)`
  ).run({
    id,
    at,
    day_key: row.dayKey || dayKey(new Date(at)),
    camera_id: row.cameraId,
    zone: row.zone || "",
    path: row.path,
    duration_sec: row.durationSec ?? null,
    event_type: row.eventType || "",
    note: row.note || "",
  });
  return { id, at };
}

export function queryDaySummary(dk = dayKey(), zone = "") {
  const d = getDb();
  const z = zone ? " AND zone = @zone" : "";
  const params = zone ? { dk, zone } : { dk };

  const ins = d
    .prepare(
      `SELECT who, at, type, zone, source FROM person_events
       WHERE day_key = @dk AND type IN ('in','return')${z} ORDER BY at`
    )
    .all(params);
  const outs = d
    .prepare(
      `SELECT who, at, zone, source FROM person_events
       WHERE day_key = @dk AND type = 'out'${z} ORDER BY at`
    )
    .all(params);
  const took = d
    .prepare(
      `SELECT who, what, at, zone FROM object_take_events
       WHERE day_key = @dk${z} ORDER BY at`
    )
    .all(params);
  const faces = d
    .prepare(
      `SELECT staff_name, confidence, at, zone, camera_id FROM face_matches
       WHERE day_key = @dk${z} ORDER BY at`
    )
    .all(params);

  return { dayKey: dk, zone: zone || null, ins, outs, took, faces };
}

export function formatSummaryText(summary) {
  const z = summary.zone ? ` (${summary.zone})` : "";
  const lines = [`Bugun${z} jurnal:`];
  lines.push(
    `Keldi: ${
      summary.ins.length
        ? summary.ins.map((e) => `${e.who} ${e.at.slice(11, 16)}`).join(", ")
        : "—"
    }`
  );
  lines.push(
    `Ketdi: ${
      summary.outs.length
        ? summary.outs.map((e) => `${e.who} ${e.at.slice(11, 16)}`).join(", ")
        : "—"
    }`
  );
  lines.push(
    `Olindi: ${
      summary.took.length
        ? summary.took.map((e) => `${e.who}: ${e.what}`).join("; ")
        : "—"
    }`
  );
  if (summary.faces.length) {
    lines.push(
      `Yuz tanish: ${summary.faces.map((f) => `${f.staff_name}(${Math.round(f.confidence * 100)}%)`).join(", ")}`
    );
  }
  return lines.join("\n");
}

export function searchPersonEvents({ dayKey: dk, zone = "", who = "", type = "", limit = 100 }) {
  const d = getDb();
  const clauses = [];
  const params = { limit };
  if (dk) {
    clauses.push("day_key = @dk");
    params.dk = dk;
  }
  if (zone) {
    clauses.push("zone = @zone");
    params.zone = zone;
  }
  if (who) {
    clauses.push("who LIKE @who");
    params.who = `%${who}%`;
  }
  if (type) {
    clauses.push("type = @type");
    params.type = type;
  }
  const where = clauses.length ? clauses.join(" AND ") : "1=1";
  return d
    .prepare(
      `SELECT id, at, type, who, zone, source, camera_id, note, confidence
       FROM person_events WHERE ${where}
       ORDER BY at DESC LIMIT @limit`
    )
    .all(params);
}

export function searchClips({ dayKey: dk, zone = "", cameraId = "", limit = 20 }) {
  const d = getDb();
  const clauses = ["day_key = @dk"];
  const params = { dk, limit };
  if (zone) {
    clauses.push("zone = @zone");
    params.zone = zone;
  }
  if (cameraId) {
    clauses.push("camera_id = @cameraId");
    params.cameraId = cameraId;
  }
  return d
    .prepare(
      `SELECT id, at, camera_id, zone, path, duration_sec, event_type, note
       FROM clips WHERE ${clauses.join(" AND ")}
       ORDER BY at DESC LIMIT @limit`
    )
    .all(params);
}

export function migrateFromJsonJournal(jsonPath) {
  if (!fs.existsSync(jsonPath)) return 0;
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  let n = 0;
  for (const e of raw.events || []) {
    if (e.type === "took") {
      logObjectTake({
        who: e.who,
        what: e.what,
        zone: e.zone,
        source: e.source,
        at: e.at,
        note: e.note,
      });
    } else {
      logPersonEvent({
        type: e.type,
        who: e.who,
        zone: e.zone,
        source: e.source,
        at: e.at,
        note: e.note,
      });
    }
    n++;
  }
  return n;
}
