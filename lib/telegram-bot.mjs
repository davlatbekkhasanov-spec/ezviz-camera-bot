import { pickCamera } from "./cameras.mjs";
import { ezvizCloudConfigured } from "./ezviz-cloud.mjs";
import { captureCamera, handleFaceEvent } from "./handle-event.mjs";
import { sendMessage, sendPhoto } from "./notify.mjs";

function parseAdminIds() {
  const raw = (process.env.ADMIN_IDS || process.env.NOTIFY_CHAT_ID || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isAdmin(chatId) {
  const admins = parseAdminIds();
  if (!admins.size) return true;
  return admins.has(String(chatId));
}

async function tgApi(botToken, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || method);
  return data.result;
}

export function startTelegramBot(cameraCfg) {
  const botToken = (process.env.BOT_TOKEN || "").trim();
  if (!botToken) {
    console.warn("BOT_TOKEN yo'q — Telegram buyruqlar o'chiq");
    return;
  }

  let offset = 0;
  console.log("Telegram bot: yoqildi");

  (async function loop() {
    for (;;) {
      try {
        const updates = await tgApi(botToken, "getUpdates", {
          offset,
          timeout: 30,
          allowed_updates: ["message"],
        });
        for (const u of updates) {
          offset = u.update_id + 1;
          const msg = u.message;
          if (!msg?.text) continue;

          const chatId = msg.chat.id;
          const text = msg.text.trim();
          const cmd = text.split(/\s+/)[0].split("@")[0].toLowerCase();

          if (cmd === "/start" || cmd === "/help") {
            await sendMessage(
              botToken,
              chatId,
              "📷 <b>EZVIZ Camera Bot</b>\n\n" +
                "/snap — hozirgi kadr\n" +
                "/snap zona — boshqa zona\n" +
                "/status — holat\n\n" +
                "Bulut API (Railway). LAN kerak emas."
            );
            continue;
          }

          if (!isAdmin(chatId)) {
            await sendMessage(botToken, chatId, "⛔ Ruxsat yo'q.");
            continue;
          }

          if (cmd === "/status") {
            const zones = Object.keys(cameraCfg.zones);
            await sendMessage(
              botToken,
              chatId,
              `✅ <b>Holat</b>\n` +
                `Kameralar: ${zones.length || 0}\n` +
                `EZVIZ Cloud: ${ezvizCloudConfigured() ? "✓" : "✗"}\n` +
                `Vision: ${process.env.VISION_ENABLED === "1" ? "✓" : "—"}\n` +
                `Zonalar: ${zones.join(", ") || "—"}`
            );
            continue;
          }

          if (cmd === "/snap") {
            const zoneArg = text.split(/\s+/)[1]?.trim() || "";
            const cam = pickCamera(cameraCfg.zones, cameraCfg.defaultId, zoneArg);
            if (!cam?.deviceSerial) {
              await sendMessage(botToken, chatId, "❌ Kamera topilmadi.");
              continue;
            }
            await sendMessage(botToken, chatId, `⏳ ${cam.label}…`);
            try {
              const jpeg = await captureCamera(cam);
              await sendPhoto(
                botToken,
                chatId,
                jpeg,
                `📷 <b>${cam.label}</b> · test kadr`
              );
            } catch (e) {
              await sendMessage(botToken, chatId, `❌ ${e.message}`);
            }
            continue;
          }

          if (cmd === "/event") {
            const parts = text.split(/\s+/).slice(1);
            const name = parts[0] || "Test";
            const zone = parts[1] || "";
            try {
              const out = await handleFaceEvent(
                { kind: "manual", employeeName: name, zone },
                cameraCfg
              );
              await sendMessage(
                botToken,
                chatId,
                out.sent
                  ? `✅ Yuborildi · ${out.camera} · ${out.snapshotBytes} bayt`
                  : `⚠️ ${JSON.stringify(out)}`
              );
            } catch (e) {
              await sendMessage(botToken, chatId, `❌ ${e.message}`);
            }
          }
        }
      } catch (e) {
        console.warn("telegram poll:", e.message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  })();
}
