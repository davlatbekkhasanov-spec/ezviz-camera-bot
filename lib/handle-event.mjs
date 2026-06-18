import { pickCamera } from "./cameras.mjs";
import { captureDevice } from "./ezviz-cloud.mjs";
import { faceKindToType, logEvent } from "./sklad-journal.mjs";
import { sendPhoto } from "./notify.mjs";
import { analyzeSnapshot, visionEnabled } from "./vision.mjs";

export async function captureCamera(cam) {
  return captureDevice(cam.deviceSerial, cam.channelNo || 1);
}

export async function handleFaceEvent(payload, cameraCfg) {
  const name = (payload.employeeName || payload.name || "Xodim").trim();
  const kind = (payload.kind || "arrived").trim();
  const zone = (payload.zone || "").trim();

  if (kind !== "arrived" && kind !== "returned" && kind !== "left" && kind !== "manual") {
    return { ok: true, skipped: "kind" };
  }

  logEvent({
    type: faceKindToType(kind),
    who: name,
    zone: zone || payload.zone || "",
    source: "face_id",
    at: payload.at || new Date().toISOString(),
    note: payload.clock || payload.time || "",
  });

  const cam = pickCamera(cameraCfg.zones, cameraCfg.defaultId, zone);
  if (!cam?.deviceSerial) {
    return { ok: false, error: "kamera topilmadi" };
  }

  const jpeg = await captureCamera(cam);
  let ai = "";
  if (visionEnabled()) {
    try {
      ai = (await analyzeSnapshot(jpeg, { employeeName: name, zoneLabel: cam.label })) || "";
    } catch (e) {
      ai = `(AI: ${e.message})`;
    }
  }

  const botToken = (process.env.BOT_TOKEN || "").trim();
  const chatId = (process.env.NOTIFY_CHAT_ID || "").trim();
  if (!botToken || !chatId) {
    return { ok: true, snapshotBytes: jpeg.length, ai, sent: false };
  }

  const when = payload.clock || payload.time || "";
  const kindLabel =
    kind === "left"
      ? "ketdi"
      : kind === "returned"
        ? "qaytish"
        : kind === "manual"
          ? "qo'lda"
          : "keldi";
  let cap =
    `📷 <b>EZVIZ</b> · ${cam.label}\n` +
    `👤 ${name} · ${kindLabel}${when ? ` · ${when}` : ""}`;
  if (ai) cap += `\n\n🤖 ${ai}`;

  await sendPhoto(botToken, chatId, jpeg, cap);
  return { ok: true, camera: cam.id, snapshotBytes: jpeg.length, ai: ai || null, sent: true };
}
