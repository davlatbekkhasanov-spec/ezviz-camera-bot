export async function sendMessage(botToken, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(chatId),
      text: text.slice(0, 4090),
      parse_mode: "HTML",
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "sendMessage xato");
  return data.result;
}

export async function sendAudio(botToken, chatId, audioBuf, caption = "") {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption.slice(0, 1020));
  form.append("audio", new Blob([audioBuf], { type: "audio/mpeg" }), "javob.mp3");
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "sendAudio xato");
  return data.result;
}

export async function downloadTelegramFile(botToken, fileId) {
  const meta = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  ).then((r) => r.json());
  if (!meta.ok) throw new Error(meta.description || "getFile xato");
  const url = `https://api.telegram.org/file/bot${botToken}/${meta.result.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fayl yuklanmadi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function sendPhoto(botToken, chatId, jpegBuf, caption) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption.slice(0, 1020));
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([jpegBuf], { type: "image/jpeg" }), "ezviz.jpg");
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "sendPhoto xato");
  return data.result;
}
