/** Arxiv rasmlar — bulut kuzatuv playback */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function zoneArchiveKey(zone) {
  const z = String(zone || "").toLowerCase();
  const m = z.match(/sklad[\s_-]*(\d+)/);
  if (m) return `sklad${m[1]}`;
  if (/^[a-z0-9]+$/i.test(z) && z.length <= 16) return z;
  return "sklad3";
}

export function listArchive(zone, dayKey = "") {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const day = dayKey || new Date().toISOString().slice(0, 10);
  const dir = path.join(dataDir, "archive", zoneArchiveKey(zone), day);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => ({
      file: f,
      path: path.join(dir, f),
      time: f.replace(".jpg", "").replace(/-/g, ":"),
    }));
}

export function findArchiveNear(zone, hhmm, dayKey = "") {
  const items = listArchive(zone, dayKey);
  if (!items.length) return null;
  const target = hhmm.replace(".", ":");
  let best = items[0];
  let bestDiff = Infinity;
  for (const it of items) {
    const t = it.time.slice(0, 5);
    const diff = Math.abs(
      parseInt(t.replace(":", ""), 10) - parseInt(target.replace(":", ""), 10)
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = it;
    }
  }
  return best;
}

export function findArchiveAtIso(zone, iso) {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const day = at.toISOString().slice(0, 10);
  const hhmm = at.toISOString().slice(11, 16);
  return findArchiveNear(zone, hhmm, day);
}

export function answerArchiveQuery(text) {
  const t = String(text || "").toLowerCase();
  const zoneM = t.match(/sklad\s*[-_]?\s*(\d+)/);
  const zone = zoneM ? `sklad${zoneM[1]}` : "sklad3";
  const timeM = t.match(/(\d{1,2})[:\s](\d{2})/);
  const day = /kecha|yesterday/.test(t)
    ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  if (timeM) {
    const hhmm = `${timeM[1].padStart(2, "0")}:${timeM[2]}`;
    const hit = findArchiveNear(zone, hhmm, day);
    if (!hit) {
      return `${day} ${zone} da ${hhmm} atrofida arxiv topilmadi. Kuzatuv ishlayotganda to'ldiriladi.`;
    }
    return { text: `${day} ${zone} · ${hit.time} atrofida arxiv bor`, path: hit.path, zone };
  }

  const items = listArchive(zone, day);
  if (!items.length) {
    return `Bugun ${zone} arxivida hali rasm yo'q. Cloud-watch 24/7 yozmoqda.`;
  }
  return `Bugun ${zone}: ${items.length} ta kadr (${items[0].time} — ${items[items.length - 1].time})`;
}
