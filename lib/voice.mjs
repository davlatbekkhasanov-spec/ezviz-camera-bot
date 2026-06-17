function openaiKey() {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY yo'q");
  return key;
}

export async function transcribeAudio(audioBuf, { mime = "audio/ogg" } = {}) {
  const key = openaiKey();
  const ext = mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "ogg";
  const form = new FormData();
  form.append("file", new Blob([audioBuf], { type: mime }), `voice.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "uz");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Whisper xato");
  return (data.text || "").trim();
}

export async function speakText(text) {
  const key = openaiKey();
  const input = String(text || "").trim().slice(0, 800);
  if (!input) throw new Error("Matn yo'q");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: process.env.TTS_VOICE || "nova",
      input,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `TTS xato: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
