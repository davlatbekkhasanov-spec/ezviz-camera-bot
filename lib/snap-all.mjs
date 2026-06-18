/** Barcha kameralardan snapshot */
import { captureDevice, listAllDevices } from "./ezviz-cloud.mjs";
import { sendMessage, sendPhoto } from "./notify.mjs";

const DELAY_MS = Number(process.env.SNAP_ALL_DELAY_MS || 1200);

function isOnline(dev) {
  const s = dev.status ?? dev.deviceStatus;
  return s === 1 || s === "1" || s === true;
}

export async function snapAllCameras(botToken, chatId, { limit, offset = 0, onlineOnly = true } = {}) {
  const max = Number(limit || process.env.SNAP_ALL_LIMIT || 20);
  const devices = await listAllDevices();
  let list = devices;
  if (onlineOnly) list = devices.filter(isOnline);
  const total = list.length;
  const batch = list.slice(offset, offset + max);

  if (!batch.length) {
    await sendMessage(botToken, chatId, "❌ Onlayn kamera topilmadi.");
    return { ok: 0, fail: 0, total: 0 };
  }

  await sendMessage(
    botToken,
    chatId,
    `📷 <b>${batch.length}</b> ta kameradan rasm yuborilmoqda` +
      (total > max ? ` (jami onlayn: ${total}, limit: ${max})` : ` (jami: ${total})`) +
      "…"
  );

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const dev = batch[i];
    const serial = String(dev.deviceSerial || "").trim().toUpperCase();
    const label = String(dev.deviceName || dev.name || serial);
    try {
      const jpeg = await captureDevice(serial, Number(dev.channelNo || 1));
      await sendPhoto(
        botToken,
        chatId,
        jpeg,
        `📷 <b>${i + 1}/${batch.length}</b> · ${label}\n<code>${serial}</code>`
      );
      ok++;
    } catch (e) {
      fail++;
      await sendMessage(
        botToken,
        chatId,
        `⚠️ ${label} (${serial}): ${e.message}`
      );
    }
    if (i < batch.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const tail =
    offset + batch.length < total
      ? `\nDavom: <code>/snapall ${offset + batch.length}</code> (${total - offset - batch.length} ta qoldi)`
      : "";
  await sendMessage(
    botToken,
    chatId,
    `✅ Tayyor: ${ok} ta rasm, ${fail} ta xato.${tail}`
  );
  return { ok, fail, total };
}
