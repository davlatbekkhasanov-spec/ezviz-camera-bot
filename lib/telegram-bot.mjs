import fs from "fs";
import { pickCamera } from "./cameras.mjs";
import { ezvizCloudConfigured } from "./ezviz-cloud.mjs";
import {
  guestBlockedReply,
  masterApprovalPrompt,
  think,
} from "./brain.mjs";
import { captureCamera, handleFaceEvent } from "./handle-event.mjs";
import {
  needsLiveCamera,
  parseZoneHint,
  personCheckPrompt,
  movementCheckPrompt,
  wantsAllCameras,
  wantsMovementCheck,
  wantsPersonCheck,
} from "./intent.mjs";
import { snapAllCameras } from "./snap-all.mjs";
import { answerArchiveQuery, findArchiveAtIso } from "./archive.mjs";
import {
  tryLearnFromMaster,
  wantsJournalQuery,
  answerJournalQuery,
} from "./sklad-journal.mjs";
import {
  wantsPersonHistory,
  wantsHistoryPhoto,
  isPersonLookup,
  parsePersonName,
  findLastPersonEvent,
  formatPersonHistory,
  formatPersonNotFound,
} from "./person-search.mjs";
import {
  downloadTelegramFile,
  sendAudio,
  sendMessage,
  sendPhoto,
} from "./notify.mjs";
import {
  isMaster,
  masterChatId,
  queueGuestRequest,
  takeGuestRequest,
} from "./permissions.mjs";
import { speakText, transcribeAudio } from "./voice.mjs";

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

async function replyVoice(botToken, chatId, text) {
  const say = String(text || "").trim();
  if (!say) return;
  await sendMessage(botToken, chatId, `🤖 ${say}`);
  try {
    const audio = await speakText(say);
    await sendAudio(botToken, chatId, audio, say.slice(0, 200));
  } catch (e) {
    console.warn("tts:", e.message);
  }
}

async function snapForBrain(botToken, chatId, cameraCfg, zoneHint) {
  const cam = pickCamera(
    cameraCfg.zones,
    cameraCfg.defaultId,
    zoneHint || ""
  );
  if (!cam?.deviceSerial) throw new Error("Kamera topilmadi");
  await sendMessage(botToken, chatId, `⏳ ${cam.label} — tekshiryapman…`);
  const jpeg = await captureCamera(cam);
  await sendPhoto(botToken, chatId, jpeg, `📷 <b>${cam.label}</b>`);
  return { jpeg, cam };
}

async function handleBrainMessage(botToken, msg, cameraCfg, text) {
  const chatId = msg.chat.id;
  const name =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
    msg.from?.username ||
    "Mehmon";
  const master = isMaster(chatId);

  if (!master) {
    const req = queueGuestRequest({ chatId, name, text });
    await sendMessage(botToken, chatId, guestBlockedReply(name, text));
    const masterId = masterChatId();
    if (masterId) {
      await sendMessage(botToken, masterId, masterApprovalPrompt(req));
    }
    return;
  }

  const zoneKeys = Object.keys(cameraCfg.zones);
  const zoneHint = parseZoneHint(text, zoneKeys);

  if (wantsAllCameras(text) && ezvizCloudConfigured()) {
    await sendMessage(
      botToken,
      chatId,
      "⏳ Onlayn kameralardan rasm (EZVIZ limiti: bir vaqtda 5 ta). Stiker rasmi kerak emas."
    );
    await snapAllCameras(botToken, chatId);
    return;
  }

  const learned = tryLearnFromMaster(text, zoneHint);
  if (learned) {
    const msg =
      learned.type === "took"
        ? `Eslab qoldim: ${learned.who} — ${learned.what} oldi.`
        : `Eslab qoldim: ${learned.who} ${learned.type === "out" ? "ketdi" : "keldi"}.`;
    await replyVoice(botToken, chatId, msg);
    return;
  }

  if (isPersonLookup(text) || wantsHistoryPhoto(text)) {
    await sendMessage(botToken, chatId, "⏳ Jurnalda qidiryapman…");
    const hit = await findLastPersonEvent(text);
    if (!hit) {
      const name = parsePersonName(text) || "Bu odam";
      await replyVoice(botToken, chatId, formatPersonNotFound(name));
      return;
    }
    const msg = formatPersonHistory(hit);
    const arch = findArchiveAtIso(hit.zone, hit.at);
    if (arch?.path && fs.existsSync(arch.path)) {
      await sendPhoto(
        botToken,
        chatId,
        fs.readFileSync(arch.path),
        `📷 ${hit.zone} · ${hit.whenLabel}`
      );
      await replyVoice(
        botToken,
        chatId,
        `${msg}\n\nYuqoridagi rasm — jurnal vaqtidagi arxiv kadri (jonli emas).`
      );
    } else {
      const extra = wantsHistoryPhoto(text)
        ? "\n\n⚠️ O'sha vaqt uchun arxiv kadri topilmadi — faqat jurnal yozuvi bor."
        : "";
      await replyVoice(botToken, chatId, msg + extra);
    }
    return;
  }

  if (/video|arxiv|kadr|playback|soat\s+\d{1,2}:\d{2}/iu.test(text) && /sklad|kecha|bugun/u.test(text)) {
    const ans = answerArchiveQuery(text);
    if (typeof ans === "object" && ans?.path && fs.existsSync(ans.path)) {
      await sendPhoto(botToken, chatId, fs.readFileSync(ans.path), `📼 ${ans.text}`);
    } else {
      await replyVoice(botToken, chatId, typeof ans === "string" ? ans : "Arxiv topilmadi.");
    }
    return;
  }

  if (wantsJournalQuery(text)) {
    const journalAnswer = await answerJournalQuery(text, zoneHint);
    let imageB64 = null;
    let extra = "";
    if (wantsMovementCheck(text) && ezvizCloudConfigured()) {
      try {
        const { jpeg } = await snapForBrain(botToken, chatId, cameraCfg, zoneHint);
        imageB64 = jpeg.toString("base64");
        const { reply } = await think({
          text: movementCheckPrompt(text),
          isMasterUser: true,
          imageBase64: imageB64,
          userQuestion: text,
          mode: "movement",
        });
        extra = reply;
      } catch (e) {
        console.warn("movement snap:", e.message);
      }
    }
    const finalReply = extra
      ? `${journalAnswer}\n\nKamera: ${extra}`
      : journalAnswer;
    await replyVoice(botToken, chatId, finalReply);
    return;
  }

  let imageB64 = null;
  let askText = text;
  const useCam = needsLiveCamera(text) && ezvizCloudConfigured();

  if (useCam) {
    try {
      const { jpeg } = await snapForBrain(botToken, chatId, cameraCfg, zoneHint);
      imageB64 = jpeg.toString("base64");
      if (wantsPersonCheck(text)) {
        askText = personCheckPrompt();
      } else if (wantsMovementCheck(text)) {
        askText = movementCheckPrompt(text);
      }
    } catch (e) {
      console.warn("brain snap:", e.message);
      await sendMessage(botToken, chatId, `⚠️ Kamera: ${e.message}`);
    }
  } else if (wantsPersonCheck(text)) {
    await sendMessage(
      botToken,
      chatId,
      "⏳ Kameraga ulanib, odam bormi tekshiraman…"
    );
    try {
      const { jpeg } = await snapForBrain(botToken, chatId, cameraCfg, zoneHint);
      imageB64 = jpeg.toString("base64");
      askText = personCheckPrompt();
    } catch (e) {
      await sendMessage(botToken, chatId, `❌ ${e.message}`);
      return;
    }
  }

  const personCheck = wantsPersonCheck(text);
  const { reply } = await think({
    text: askText,
    isMasterUser: true,
    imageBase64: imageB64,
    userQuestion: text,
    mode: personCheck ? "person_check" : "default",
  });
  let finalReply = reply;
  if (personCheck) {
    const r = reply.toLowerCase();
    if (/\b(yo'q|yoq|нет|no)\b/u.test(r)) {
      finalReply = "Yo'q, odam yo'q.";
    } else if (/\b(ha|bor|есть|да|yes)\b/u.test(r)) {
      finalReply = "Ha, odam bor.";
    } else {
      finalReply = "Aniq ko'rinmadi, kamerani sal yaqinroq buring yoki qayta kadr yuboring.";
    }
  }
  await replyVoice(botToken, chatId, finalReply);
}

async function handleVoiceMessage(botToken, msg, cameraCfg) {
  const voice = msg.voice || msg.audio;
  if (!voice?.file_id) return;
  const buf = await downloadTelegramFile(botToken, voice.file_id);
  const mime = msg.audio ? "audio/mpeg" : "audio/ogg";
  const text = await transcribeAudio(buf, { mime });
  if (!text) {
    await sendMessage(botToken, msg.chat.id, "Eshitmadim. Qayta ayting.");
    return;
  }
  await handleBrainMessage(botToken, msg, cameraCfg, text);
}

export function startTelegramBot(cameraCfg) {
  const botToken = (process.env.BOT_TOKEN || "").trim();
  if (!botToken) {
    console.warn("BOT_TOKEN yo'q — Telegram buyruqlar o'chiq");
    return;
  }

  let offset = 0;
  console.log("Telegram bot: yoqildi (ovoz + miya)");

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
          if (!msg) continue;

          const chatId = msg.chat.id;
          const text = (msg.text || msg.caption || "").trim();

          if (msg.voice || (msg.audio && !text)) {
            try {
              await sendMessage(botToken, chatId, "⏳ Eshityapman…");
              if (!isMaster(chatId) && !isAdmin(chatId)) {
                const voice = msg.voice || msg.audio;
                const buf = await downloadTelegramFile(botToken, voice.file_id);
                const mime = msg.audio ? "audio/mpeg" : "audio/ogg";
                const heard = await transcribeAudio(buf, { mime });
                await handleBrainMessage(botToken, msg, cameraCfg, heard || "(ovoz)");
                continue;
              }
              await handleVoiceMessage(botToken, msg, cameraCfg);
            } catch (e) {
              await sendMessage(botToken, chatId, `❌ ${e.message}`);
            }
            continue;
          }

          if (!text) continue;

          const cmd = text.split(/\s+/)[0].split("@")[0].toLowerCase();

          if (cmd === "/start" || cmd === "/help") {
            await sendMessage(
              botToken,
              chatId,
              "📷 <b>QORA KO'Z</b>\n\n" +
                "Ovozli xabar yuboring — javob ovozda.\n\n" +
                "/snap — kamera kadri\n" +
                "/snapall — onlayn kameralar (5 ta, EZVIZ limiti)\n" +
                "/jurnal — bugungi keldi/ketdi/olindi\n" +
                "/status — holat\n" +
                "/ha ID — mehmon so'roviga ruxsat\n" +
                "/yoq ID — rad"
            );
            continue;
          }

          if (cmd === "/ha" || cmd === "/yoq") {
            if (!isMaster(chatId)) {
              await sendMessage(botToken, chatId, "⛔ Faqat usta.");
              continue;
            }
            const id = text.split(/\s+/)[1];
            const req = takeGuestRequest(id);
            if (!req) {
              await sendMessage(botToken, chatId, "So'rov topilmadi.");
              continue;
            }
            if (cmd === "/yoq") {
              await sendMessage(botToken, req.chatId, "Usta ruxsat bermadi.");
              await sendMessage(botToken, chatId, `#${id} rad etildi.`);
              continue;
            }
            try {
              const { reply } = await think({
                text: req.text,
                isMasterUser: false,
              });
              await replyVoice(botToken, req.chatId, reply);
              await sendMessage(
                botToken,
                chatId,
                `✅ #${id} — javob yuborildi.`
              );
            } catch (e) {
              await sendMessage(botToken, chatId, `❌ ${e.message}`);
            }
            continue;
          }

          if (!isAdmin(chatId) && !isMaster(chatId)) {
            if (text.length > 2 && !text.startsWith("/")) {
              await handleBrainMessage(botToken, msg, cameraCfg, text);
              continue;
            }
            await sendMessage(botToken, chatId, "⛔ Ruxsat yo'q.");
            continue;
          }

          if (cmd === "/jurnal" || cmd === "/journal") {
            const zoneArg = text.split(/\s+/)[1]?.trim() || "";
            const ans = await answerJournalQuery("bugun kim keldi ketdi nima oldi", zoneArg);
            await sendMessage(botToken, chatId, `📒 <b>Jurnal</b>\n${ans}`);
            continue;
          }

          if (cmd === "/status") {
            const zones = Object.keys(cameraCfg.zones);
            await sendMessage(
              botToken,
              chatId,
              `✅ <b>Holat</b>\n` +
                `Kameralar: ${zones.length || 0}\n` +
                `EZVIZ: ${ezvizCloudConfigured() ? "✓" : "✗"}\n` +
                `Miya: ${(process.env.OPENAI_API_KEY || "").trim() ? "✓" : "✗"}\n` +
                `Vision: ${process.env.VISION_ENABLED === "1" ? "✓" : "—"}\n` +
                `Cloud-watch: ${process.env.CLOUD_WATCH_ENABLED !== "0" ? "✓ 24/7" : "—"}\n` +
                `Usta: ${masterChatId() || "—"}`
            );
            continue;
          }

          if (cmd === "/snapall" || cmd === "/hamma") {
            const offset = Number(text.split(/\s+/)[1] || 0) || 0;
            try {
              await snapAllCameras(botToken, chatId, { offset });
            } catch (e) {
              await sendMessage(botToken, chatId, `❌ ${e.message}`);
            }
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
                `📷 <b>${cam.label}</b>`
              );
              if ((process.env.VISION_ENABLED || "") === "1") {
                const { reply } = await think({
                  text: "Bu kadrda nima ko'rinadi? Qisqa ayt.",
                  isMasterUser: true,
                  imageBase64: jpeg.toString("base64"),
                });
                await replyVoice(botToken, chatId, reply);
              }
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
                  ? `✅ Yuborildi · ${out.snapshotBytes} bayt`
                  : `⚠️ ${JSON.stringify(out)}`
              );
            } catch (e) {
              await sendMessage(botToken, chatId, `❌ ${e.message}`);
            }
            continue;
          }

          if (!text.startsWith("/")) {
            try {
              if ((needsLiveCamera(text) || wantsPersonCheck(text)) && !isPersonLookup(text)) {
                await sendMessage(botToken, chatId, "⏳ Tushundim, tekshiryapman…");
              }
              await handleBrainMessage(botToken, msg, cameraCfg, text);
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
