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
