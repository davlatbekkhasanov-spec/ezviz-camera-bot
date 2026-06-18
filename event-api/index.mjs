import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  dayKey,
  formatSummaryText,
  getDb,
  logClip,
  logFaceMatch,
  logObjectTake,
  logPersonEvent,
  migrateFromJsonJournal,
  queryDaySummary,
  searchClips,
  searchPersonEvents,
} from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.EVENT_API_PORT || 8788);
const SECRET = (process.env.EVENT_API_SECRET || process.env.BRIDGE_SECRET || "").trim();

function authOk(req) {
  if (!SECRET) return true;
  const h = req.headers["x-bridge-secret"] || req.headers.authorization || "";
  if (h === SECRET) return true;
  if (h.startsWith("Bearer ") && h.slice(7) === SECRET) return true;
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function journalPath() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dataDir, "sklad-journal.json");
}

function maybeAutoMigrate() {
  if (process.env.EVENT_API_AUTO_MIGRATE !== "1") return;
  const p = journalPath();
  if (!fs.existsSync(p)) return;
  const n = migrateFromJsonJournal(p);
  if (n > 0) console.log(`event-api: JSON jurnaldan ${n} ta yozuv import qilindi`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, service: "aqlli-kuz-event-api" });
  }

  if (!authOk(req) && url.pathname !== "/health") {
    return send(res, 401, { ok: false, error: "unauthorized" });
  }

  if (req.method === "POST" && url.pathname === "/events/person") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = logPersonEvent(body);
      return send(res, 200, { ok: true, ...out });
    } catch (e) {
      return send(res, 400, { ok: false, error: e.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/events/object-take") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = logObjectTake(body);
      return send(res, 200, { ok: true, ...out });
    } catch (e) {
      return send(res, 400, { ok: false, error: e.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/events/face-match") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = logFaceMatch(body);
      return send(res, 200, { ok: true, ...out });
    } catch (e) {
      return send(res, 400, { ok: false, error: e.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/events/clip") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      const out = logClip(body);
      return send(res, 200, { ok: true, ...out });
    } catch (e) {
      return send(res, 400, { ok: false, error: e.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/journal/summary") {
    const dk = url.searchParams.get("day") || dayKey();
    const zone = url.searchParams.get("zone") || "";
    const summary = queryDaySummary(dk, zone);
    return send(res, 200, {
      ok: true,
      summary,
      text: formatSummaryText(summary),
    });
  }

  if (req.method === "GET" && url.pathname === "/events/search") {
    const dk = url.searchParams.get("day") || dayKey();
    const zone = url.searchParams.get("zone") || "";
    const who = url.searchParams.get("who") || "";
    const type = url.searchParams.get("type") || "";
    const limit = Number(url.searchParams.get("limit") || 100);
    const events = searchPersonEvents({ dayKey: dk, zone, who, type, limit });
    return send(res, 200, { ok: true, day: dk, events });
  }

  if (req.method === "GET" && url.pathname === "/clips/search") {
    const dk = url.searchParams.get("day") || dayKey();
    const zone = url.searchParams.get("zone") || "";
    const cameraId = url.searchParams.get("cameraId") || "";
    const limit = Number(url.searchParams.get("limit") || 20);
    const clips = searchClips({ dayKey: dk, zone, cameraId, limit });
    return send(res, 200, { ok: true, day: dk, clips });
  }

  if (req.method === "POST" && url.pathname === "/migrate/json-journal") {
    const p = url.searchParams.get("path") || journalPath();
    const n = migrateFromJsonJournal(p);
    return send(res, 200, { ok: true, migrated: n });
  }

  if (req.method === "GET" && url.pathname.startsWith("/clips/")) {
    const rel = url.pathname.slice("/clips/".length);
    const base = process.env.CLIPS_DIR || path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "clips");
    const file = path.join(base, rel);
    if (!file.startsWith(path.resolve(base)) || !fs.existsSync(file)) {
      return send(res, 404, { ok: false, error: "clip topilmadi" });
    }
    res.writeHead(200, { "Content-Type": "video/mp4" });
    fs.createReadStream(file).pipe(res);
    return;
  }

  send(res, 404, { ok: false });
});

getDb();
maybeAutoMigrate();
server.listen(PORT, () => {
  console.log(`event-api :${PORT}`);
});
