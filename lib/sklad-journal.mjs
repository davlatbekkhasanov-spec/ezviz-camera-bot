import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "sklad-journal.json");

function loadRaw() {
  try {
    if (!fs.existsSync(FILE)) return { events: [] };
    return { events: [], ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { events: [] };
  }
}

function saveRaw(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function dayKey(date = new Date()) {
  const tz = process.env.TZ || "Asia/Tashkent";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function clockLabel(iso) {
  const tz = process.env.TZ || "Asia/Tashkent";
  try {
    return new Intl.DateTimeFormat("uz-UZ", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso?.slice(11, 16) || "";
  }
}

export function logEvent({
  type,
  who = "",
  what = "",
  zone = "",
  source = "manual",
  at = new Date().toISOString(),
  note = "",
}) {
  const data = loadRaw();
  const ev = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    dayKey: dayKey(new Date(at)),
    type,
    who: String(who || "").trim(),
    what: String(what || "").trim(),
    zone: String(zone || "").trim(),
    source,
    note: String(note || "").trim(),
  };
  data.events.push(ev);
  if (data.events.length > 5000) data.events = data.events.slice(-5000);
  saveRaw(data);
  return ev;
}

export function eventsForDay(dk = dayKey(), { zone = "" } = {}) {
  const z = zone.trim().toLowerCase();
  return loadRaw().events.filter((e) => {
    if (e.dayKey !== dk) return false;
    if (z && !(e.zone || "").toLowerCase().includes(z)) return false;
    return true;
  });
}

export function journalContext(dk = dayKey(), zone = "") {
  const list = eventsForDay(dk, { zone });
  if (!list.length) return `Bugun (${dk}) jurnalda yozuv yo'q.`;
  return list
    .slice(-30)
    .map((e) => {
      const t = clockLabel(e.at);
      const w = e.what ? ` · ${e.what}` : "";
      const z = e.zone ? ` · ${e.zone}` : "";
      return `${t} | ${e.type} | ${e.who || "—"}${w}${z}`;
    })
    .join("\n");
}

function norm(text) {
  return String(text || "").toLowerCase();
}

export function wantsJournalQuery(text) {
  const t = norm(text);
  return /kim\s+kirdi|kim\s+keldi|kim\s+chiq|kim\s+ketdi|kirdi\s+kim|chiqdi\s+kim|nima\s+oldi|kim\s+oldi|bugun\s+kim|jurnal|kirim|chiqim|ketdi|keldi|rimlar|rim\b|disk|shina/u.test(
    t
  );
}

/** Usta o'rgatadi: "Akmal 5 ta rim oldi" */
export function tryLearnFromMaster(text, zoneHint = "") {
  const raw = String(text || "").trim();
  const t = norm(raw);

  let m = t.match(
    /([a-zа-яё'\-]+(?:\s+[a-zа-яё'\-]+)?)\s+(\d+\s*ta\s+)?([a-zа-яё'\-]+)\s+(oldi|olib ketdi|ketdi|chiqardi)/u
  );
  if (m) {
    const who = raw.match(/^[\p{L}\s'-]+/u)?.[0]?.trim() || m[1];
    const what = `${m[2] || ""}${m[3]}`.trim();
    return logEvent({
      type: "took",
      who,
      what,
      zone: zoneHint,
      source: "usta",
      note: raw,
    });
  }

  m = t.match(/([a-zа-яё'\-]+)\s+(kirdi|keldi|chiqdi|ketdi)/u);
  if (m && !/kim|nima|bugun/u.test(t)) {
    const who = m[1];
    const type = /chiq|ket/u.test(m[2]) ? "out" : "in";
    return logEvent({
      type,
      who,
      zone: zoneHint,
      source: "usta",
      note: raw,
    });
  }

  return null;
}

export function answerJournalQuery(text, zoneHint = "") {
  const t = norm(text);
  const dk = dayKey();
  const zone = zoneHint || "";
  const events = eventsForDay(dk, { zone });
  const label = zone ? ` (${zone})` : "";

  if (!events.length) {
    return (
      `Bugun${label} jurnalda yozuv yo'q. ` +
      `Face ID keldi/ketdi yoki menga «Akmal 3 ta rim oldi» deb ayting — eslab qolaman.`
    );
  }

  if (/nima\s+oldi|kim\s+oldi|rim|disk|shina|mahsulot/u.test(t)) {
    const took = events.filter((e) => e.type === "took");
    if (!took.length) {
      return `Bugun${label} nima olingani yozilmagan. Kim nima olganini ayting — eslab qolaman.`;
    }
    return (
      `Bugun olinganlar${label}:\n` +
      took
        .map((e) => `• ${clockLabel(e.at)} — ${e.who}: ${e.what || "noma'lum"}`)
        .join("\n")
    );
  }

  if (/chiq|ketdi|ketgan/u.test(t)) {
    const outs = events.filter((e) => e.type === "out");
    if (!outs.length) return `Bugun${label} hech kim ketmagan deb yozilmagan.`;
    return (
      `Bugun ketganlar${label}:\n` +
      outs.map((e) => `• ${clockLabel(e.at)} — ${e.who}`).join("\n")
    );
  }

  if (/kirdi|keldi|kirgan/u.test(t)) {
    const ins = events.filter((e) => e.type === "in" || e.type === "return");
    if (!ins.length) return `Bugun${label} hech kim kirmagan deb yozilmagan.`;
    return (
      `Bugun kelganlar${label}:\n` +
      ins.map((e) => `• ${clockLabel(e.at)} — ${e.who}`).join("\n")
    );
  }

  const ins = events.filter((e) => e.type === "in" || e.type === "return");
  const outs = events.filter((e) => e.type === "out");
  const took = events.filter((e) => e.type === "took");
  return (
    `Bugun${label} jurnal:\n` +
    `Keldi: ${ins.length ? ins.map((e) => `${e.who}(${clockLabel(e.at)})`).join(", ") : "—"}\n` +
    `Ketdi: ${outs.length ? outs.map((e) => `${e.who}(${clockLabel(e.at)})`).join(", ") : "—"}\n` +
    `Olindi: ${took.length ? took.map((e) => `${e.who} — ${e.what}`).join("; ") : "—"}`
  );
}

export function faceKindToType(kind) {
  if (kind === "arrived") return "in";
  if (kind === "returned") return "return";
  if (kind === "left") return "out";
  return "note";
}
