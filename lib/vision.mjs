/** OpenAI Vision — ixtiyoriy, VISION_ENABLED=1 */

export function visionEnabled() {
  return (
    process.env.VISION_ENABLED === "1" &&
    Boolean((process.env.OPENAI_API_KEY || "").trim())
  );
}

export async function analyzeSnapshot(jpegBuf, { employeeName, zoneLabel }) {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) return null;

  const b64 = jpegBuf.toString("base64");
  const prompt =
    `Ombor kuzatuvi. Xodim: ${employeeName || "noma'lum"}. Zona: ${zoneLabel || "—"}. ` +
    `Qisqa o'zbekcha (1-2 gap): odam ko'rinadimi, ish joyidami, aniq harakat bormi? ` +
    `Agar shubhali bo'lsa «tekshiring» deb yoz.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${b64}` },
            },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI xato");
  return (data.choices?.[0]?.message?.content || "").trim();
}
