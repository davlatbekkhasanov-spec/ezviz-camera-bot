/** Odam bo'yicha jurnal qidiruv — yolg'on javob bermaslik */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { eventApiConfigured, searchEvents, searchFaceMatches } from "./event-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "sklad-journal.json");

const SKIP = new Set([
  "kim", "qaysi", "kamera", "oxirgi", "marta", "kurinish", "ko'rinish",
  "rasm", "kerak", "bugun", "qachon", "qayer", "da", "ni", "ning",
  "bergan", "ko'rdi", "korindi", "odam", "sklad", "video", "arxiv",
  "камера", "когда", "где", "последний", "раз", "hotira", "xotira",
  "yuz", "tanish", "usul", "bil", "topa", "olmaydimi", "oladi", "ayta",
]);

function norm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/қ/g, "q")
    .replace(/ғ/g, "g")
    .replace(/ў/g, "o")
    .replace(/ҳ/g, "h")
    .replace(/ъ/g, "'")
    .replace(/о/g, "o")
    .replace(/а/g, "a")
    .replace(/и/g, "i")
    .replace(/е/g, "e")
    .replace(/у/g, "u")
    .replace(/с/g, "s")
    .replace(/н/g, "n")
    .replace(/д/g, "d")
    .replace(/р/g, "r");
}

export function parsePersonName(text) {
  const raw = String(text || "").trim();
  const t = norm(raw);
  const known = [
    { re: /sindor|sidor|синдор|сидор/u, name: "Sindor" },
    { re: /akmal/u, name: "Akmal" },
  ];
  for (const k of known) {
    if (k.re.test(t) || k.re.test(raw)) return k.name;
  }
  const words = raw.match(/[\p{L}][\p{L}'-]*/gu) || [];
  for (const w of words) {
    const n = norm(w);
    if (n.length >= 3 && !SKIP.has(n)) return w;
  }
  return "";
}

export function isPersonLookup(text) {
  if (wantsPersonHistory(text)) return true;
  const name = parsePersonName(text);
  if (!name) return false;
  const t = norm(text);
  return /qayer|qachon|kamera|oxirgi|marta|kor|kur|ko['']?r|top|qidir|bil|ayta|bulgan|edi|где|когда|камер|hotira|xotira|yuz|tanish/u.test(
    t
  );
}

export function wantsPersonHistory(text) {
  const t = norm(text);
  const name = parsePersonName(text);
  if (
    /oxirgi\s+marta|qaysi\s+kamera|ko['']?rinish|kurinish|ko['']?ringan|korilgan|qachon\s+ko['']?r|qayerda\s+ko['']?r|oxirgi\s+qayer|qayerda\s+bo['']?l|qayerda\s+edi/u.test(
      t
    )
  ) {
    return true;
  }
  if (name && /qayer|qachon|kamera|oxirgi|marta|top|qidir|hotira|xotira|yuz|tanish/u.test(t)) {
    return true;
  }
  return Boolean(name && /kamera|ko['']?r|kur|qayer|qachon|oxirgi|marta|rasm/u.test(t));
}

export function wantsHistoryPhoto(text) {
  const t = norm(text);
  return /rasm|surat|foto|kadr|ko['']?rsat/u.test(t) && /kerak|yubor|shu|usha|o'sha/u.test(t);
}

function loadAllEvents() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, "utf8")).events || [];
  } catch {
    return [];
  }
}

function nameMatch(who, needle) {
  const a = norm(who);
  const b = norm(needle);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function formatWhen(iso) {
  const tz = process.env.TZ || "Asia/Tashkent";
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("uz-UZ", {
      timeZone: tz,
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
    const time = new Intl.DateTimeFormat("uz-UZ", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
    return `${date}, ${time}`;
  } catch {
    return iso || "";
  }
}

function typeLabel(type) {
  if (type === "in" || type === "return") return "keldi";
  if (type === "out") return "ketdi";
  if (type === "presence") return "ko'rindi";
  if (type === "took") return "oldi";
  return type || "hodisa";
}

export async function findLastPersonEvent(personName) {
  const name = parsePersonName(personName) || personName;
  if (!name) return null;

  let hits = loadAllEvents().filter((e) => nameMatch(e.who, name));

  if (eventApiConfigured()) {
    try {
      const r = await searchEvents({ who: name, limit: "50" });
      for (const e of r?.events || []) {
        hits.push({
          who: e.who,
          at: e.at,
          zone: e.zone,
          type: e.type,
          source: e.source,
          cameraId: e.camera_id,
        });
      }
      const faces = await searchFaceMatches({ who: name, limit: "50" });
      for (const f of faces?.matches || []) {
        hits.push({
          who: f.staff_name,
          at: f.at,
          zone: f.zone,
          type: "presence",
          source: f.source || "face_rec",
          cameraId: f.camera_id,
          confidence: f.confidence,
        });
      }
    } catch (e) {
      console.warn("person search api:", e.message);
    }
  }

  if (!hits.length) return null;

  hits.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const last = hits[0];
  return {
    who: last.who,
    at: last.at,
    zone: last.zone || last.cameraId || "",
    type: last.type,
    source: last.source || "jurnal",
    whenLabel: formatWhen(last.at),
  };
}

export function answerPersonHistory(text) {
  const name = parsePersonName(text);
  if (!name) {
    return "Kimga qarab? Ismni aniq yozing — masalan: «Sindor oxirgi marta qayerda ko'rindi?»";
  }
  return { needsLookup: true, name };
}

export function formatPersonHistory(hit) {
  if (!hit) return null;
  const zone = hit.zone || "noma'lum zona";
  const src =
    hit.source === "face_rec" || hit.source === "face_id"
      ? "Face ID / yuz tanish"
      : hit.source === "cloud_watch"
        ? "kamera kuzatuv"
        : hit.source === "usta"
          ? "siz aytdingiz"
          : hit.source || "jurnal";
  return (
    `${hit.who} oxirgi marta <b>${hit.whenLabel}</b> da ` +
    `<b>${zone}</b> da ${typeLabel(hit.type)} (${src}).`
  );
}

export function formatPersonNotFound(name) {
  return (
    `<b>${name}</b> jurnalda va yuz tanish bazasida topilmadi.\n\n` +
    `Hozir men faqat <b>yozilgan</b> hodisalarni bilaman — tasodifiy kadr yubormayman.\n\n` +
    `<b>Yuz tanish</b> (48 kamera bo'ylab qidirish) keyingi bosqich — xodim rasmlari + local AI kerak.\n` +
    `Hozir ishlaydi:\n` +
    `• Face ID skaner → avtomatik jurnal\n` +
    `• «${name} keldi» deb ayting — eslab qolaman\n` +
    `• Pilot kirish kamerasida yuz tanish yoqilganda bu yerda ko'rinadi`
  );
}
