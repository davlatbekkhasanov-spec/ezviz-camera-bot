/** Barcha kameralardan snapshot — EZVIZ tarif limitini hurmat qiladi */
import { captureDevice, listAllDevices } from "./ezviz-cloud.mjs";
import { sendMessage, sendPhoto } from "./notify.mjs";

const DELAY_MS = Number(process.env.SNAP_ALL_DELAY_MS || 5000);
const DEFAULT_LIMIT = Number(process.env.SNAP_ALL_LIMIT || 5);

function isOnline(dev) {
  const s = dev.status ?? dev.deviceStatus;
  return s === 1 || s === "1" || s === true;
}

function isPackageLimit(msg) {
  return /personal package limit|exceeds the personal|package limit/i.test(String(msg || ""));
}

function friendlyError(msg) {
  if (isPackageLimit(msg)) {
    return (
      "EZVIZ tarif limiti tugadi — bir so'rovda ko'p kamera snapshot olish mumkin emas. " +
      "5–10 daqiqadan keyin /snapall yoki alohida /snap ishlating."
    );
  }
  return String(msg || "xato");
}

export async function snapAllCameras(botToken, chatId, { limit, offset = 0, onlineOnly = true } = {}) {
  const max = Math.min(Number(limit || DEFAULT_LIMIT), 10);
  const devices = await listAllDevices();
  let list = devices;
  if (onlineOnly) list = devices.filter(isOnline);
  const total = list.length;
  const batch = list.slice(offset, offset + max);

  if (!batch.length) {
    await sendMessage(botToken, chatId, "❌ Onlayn kamera topilmadi.");
    return { ok: 0, fail: 0, total: 0, stopped: false };
  }

  await sendMessage(
    botToken,
    chatId,
    `📷 <b>${batch.length}</b> ta kamera (EZVIZ limiti: max ${max} ta, ${DELAY_MS / 1000}s oralik)\n` +
      `Jami onlayn: ${total}. Stiker rasmi shart emas — akkauntingizdagi kameralar.`
  );

  let ok = 0;
  let fail = 0;
  let stopped = false;
  const errors = [];

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
      if (isPackageLimit(e.message)) {
        stopped = true;
        errors.push(friendlyError(e.message));
        break;
      }
      errors.push(`${label}: ${e.message}`);
    }
    if (i < batch.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  let summary = `✅ ${ok} ta rasm`;
  if (fail) summary += `, ${fail} ta xato`;
  if (stopped) {
    summary += `\n\n⛔ ${friendlyError("personal package limit")}`;
    summary += `\n10 daqiqadan keyin: <code>/snapall ${offset + ok}</code>`;
  } else if (offset + batch.length < total) {
    summary += `\nDavom: <code>/snapall ${offset + batch.length}</code> (${total - offset - batch.length} ta qoldi)`;
  }

  if (errors.length && !stopped) {
    summary += `\n\n${errors.slice(0, 3).join("\n")}`;
    if (errors.length > 3) summary += `\n…va yana ${errors.length - 3} ta`;
  }

  await sendMessage(botToken, chatId, summary);
  return { ok, fail, total, stopped };
}
