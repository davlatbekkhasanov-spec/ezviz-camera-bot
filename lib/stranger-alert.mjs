/**
 * Begona shaxs — admin tasdiqlash oqimi.
 * Avtomatik enroll YO'Q; faqat admin ism bergandan keyin staff_faces ga qo'shiladi.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PENDING_TTL_MS = Number(process.env.STRANGER_PENDING_TTL_MS || 86_400_000);
const COOLDOWN_MS = Number(process.env.STRANGER_COOLDOWN_MS || 300_000);
const FACE_HIGH = Number(process.env.FACE_CONF_HIGH || 0.72);
const FACE_MID = Number(process.env.FACE_CONF_MID || 0.55);

function confidenceAction(confidence) {
  if (confidence >= FACE_HIGH) return { action: "auto", label: "tanildi" };
  if (confidence >= FACE_MID) return { action: "confirm", label: "ehtimol" };
  return { action: "unknown", label: "noma'lum" };
}

/** @type {Map<string, { at: number, faceHash: string }>} */
const recentAlerts = new Map();
/** @type {Map<string, object>} chatId → pending enroll */
const pendingEnroll = new Map();

function dataDir() {
  return process.env.DATA_DIR || path.join(__dirname, "..", "data");
}

function faceHash(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function pendingPath(id) {
  return path.join(dataDir(), "pending_strangers", `${id}.json`);
}

/**
 * Yuz tanish natijasidan begona ekanini aniqlash.
 * @param {{ staff_key?: string, staff_name?: string, confidence: number }} match
 */
export function isStrangerMatch(match) {
  if (!match || match.confidence == null) return true;
  const { action } = confidenceAction(match.confidence);
  return action === "unknown";
}

/**
 * Begona alert yuborish kerakmi (spam oldini olish).
 */
export function shouldAlertStranger(zone, jpegBuf) {
  const h = faceHash(jpegBuf);
  const key = `${zone}:${h}`;
  const prev = recentAlerts.get(key);
  const now = Date.now();
  if (prev && now - prev.at < COOLDOWN_MS) return false;
  recentAlerts.set(key, { at: now, faceHash: h });
  return true;
}

/**
 * Pending begona saqlash — admin tasdiqlashini kutadi.
 */
export function savePendingStranger({ zone, cameraId, jpegBuf, note = "" }) {
  const id = crypto.randomUUID();
  const dir = path.join(dataDir(), "pending_strangers");
  fs.mkdirSync(dir, { recursive: true });
  const photoPath = path.join(dir, `${id}.jpg`);
  fs.writeFileSync(photoPath, jpegBuf);
  const rec = {
    id,
    at: new Date().toISOString(),
    zone,
    cameraId,
    photoPath,
    faceHash: faceHash(jpegBuf),
    note,
    status: "pending",
  };
  fs.writeFileSync(pendingPath(id), JSON.stringify(rec, null, 2));
  return rec;
}

export function formatStrangerAlert(rec, camLabel = "") {
  const when = new Date(rec.at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
  return (
    `⚠️ <b>Begona shaxs aniqlandi</b>\n` +
    `📍 ${camLabel || rec.zone || "kamera"}\n` +
    `🕐 ${when}\n\n` +
    `Kim bu? Ro'yxatga kiritilsinmi?\n` +
    `Javob: <code>/begona_ha Ism Familiya</code> yoki <code>/begona_yo</code>`
  );
}

/** Admin "Ha, Ism" deb yozganda — enroll kutish rejimi. */
export function startEnrollFromReply(chatId, pendingId, name) {
  pendingEnroll.set(String(chatId), { pendingId, name: name.trim(), at: Date.now() });
}

export function takePendingEnroll(chatId) {
  const k = String(chatId);
  const p = pendingEnroll.get(k);
  if (!p) return null;
  if (Date.now() - p.at > PENDING_TTL_MS) {
    pendingEnroll.delete(k);
    return null;
  }
  pendingEnroll.delete(k);
  return p;
}

export function loadPendingStranger(id) {
  const f = pendingPath(id);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

/** Admin tasdiqlagach — staff_faces ga qo'shish (keyingi bosqich: DB + embedding). */
export function confirmStrangerEnroll(pendingId, staffName) {
  const rec = loadPendingStranger(pendingId);
  if (!rec) return { ok: false, error: "pending topilmadi" };
  rec.status = "confirmed";
  rec.staffName = staffName;
  rec.confirmedAt = new Date().toISOString();
  fs.writeFileSync(pendingPath(pendingId), JSON.stringify(rec, null, 2));
  // InsightFace worker keyingi commitda embedding hisoblaydi
  return { ok: true, rec, message: `${staffName} ro'yxatga qo'shildi (embedding navbatda)` };
}

export function rejectStranger(pendingId) {
  const rec = loadPendingStranger(pendingId);
  if (!rec) return { ok: false };
  rec.status = "rejected";
  fs.writeFileSync(pendingPath(pendingId), JSON.stringify(rec, null, 2));
  return { ok: true };
}

function adminChatIds() {
  const raw = (process.env.ADMIN_IDS || process.env.NOTIFY_CHAT_ID || "").trim();
  if (!raw) return [];
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Adminlarga begona alert (rasm + tasdiq buyruqlari).
 */
export async function notifyAdminsStranger(botToken, rec, camLabel = "") {
  const { sendPhoto, sendMessage } = await import("./notify.mjs");
  const jpeg = fs.readFileSync(rec.photoPath);
  const caption = formatStrangerAlert(rec, camLabel);
  const ids = adminChatIds();
  if (!ids.length) {
    console.warn("stranger-alert: ADMIN_IDS yo'q");
    return;
  }
  for (const chatId of ids) {
    await sendPhoto(botToken, chatId, jpeg, caption);
    await sendMessage(
      botToken,
      chatId,
      `ID: <code>${rec.id}</code>\n` +
        `<code>/begona_ha ${rec.id} Ism Familiya</code> — kiritish\n` +
        `<code>/begona_yo ${rec.id}</code> — rad etish`
    );
  }
}

/** Harakat + yuz tanilmagan (yoki hali worker yo'q) — alert yuborish. */
export async function maybeAlertStranger({ botToken, cam, jpegBuf, match, note = "" }) {
  if (process.env.STRANGER_ALERT_ENABLED === "0") return null;
  if (match && !isStrangerMatch(match)) return null;
  const zone = cam.zone || cam.label || "";
  if (!shouldAlertStranger(zone, jpegBuf)) return null;
  const rec = savePendingStranger({
    zone,
    cameraId: cam.deviceSerial || "",
    jpegBuf,
    note,
  });
  if (botToken) {
    await notifyAdminsStranger(botToken, rec, cam.label).catch((e) =>
      console.warn("stranger notify:", e.message)
    );
  }
  return rec;
}
