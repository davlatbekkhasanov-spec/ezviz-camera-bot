import { journalContext } from "./sklad-journal.mjs";
import { addFact, addLesson, memoryContext } from "./memory.mjs";

function openaiKey() {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY yo'q");
  return key;
}

function masterName() {
  return (process.env.MASTER_NAME || "Davlat aka").trim();
}

function systemPrompt({ isMasterUser, mode = "default" }) {
  const name = masterName();
  const mem = memoryContext();
  const journal = journalContext();
  return (
    `Sen sklad yordamchisan. Jonli, aqlli, qisqa va o'zbekcha gapirasan (lotin).\n` +
    `Usta (boshliq): ${name}. Faqat u senga qoida o'rgatadi.\n` +
    `Qoidalar:\n` +
    `- HECH QACHON «javob bera olmayman» dema — mavjud ma'lumotni ayt, yetmasa bitta savol ber.\n` +
    `- Tushunmasang taxmin qilma — bitta aniq savol ber.\n` +
    `- Usta aytganda yangi fakt bo'lsa, oxirida [ESLATMA: ...] yoz (qisqa).\n` +
    `- Ortiqcha gapirma, robotdek ro'yxat yozma.\n` +
    `- Sklad, polka, kamera, narsa joylashuvi haqida gapirganda xotiradan foydalan.\n` +
    `- Kim keldi/ketdi/nima oldi savollarida avval JURNAL ma'lumotidan javob ber.\n` +
    (mode === "person_check"
      ? `- MUHIM: Javob formati: «Ha, odam bor.» yoki «Yo'q, odam yo'q.» + 1 qisqa izoh.\n`
      : "") +
    (mode === "movement"
      ? `- Kadrdan ko'rinadiganini ayt. Sonni bilmaysan — «jurnalda yozilmagan» deb ayt.\n`
      : "") +
    (isMasterUser
      ? `- Hozir USTA gapirmoqda — to'liq itoat va o'rganish.\n`
      : `- Hozir boshqa odam gapirmoqda — faqat ruxsat bo'lsa yordam ber.\n`) +
    `\nXotira:\n${mem}\n\nBugungi jurnal:\n${journal}`
  );
}

function extractMemories(reply) {
  const facts = [];
  const re = /\[ESLATMA:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(reply))) {
    facts.push(m[1].trim());
  }
  const clean = reply.replace(re, "").trim();
  return { clean, facts };
}

export async function think({
  text,
  isMasterUser,
  imageBase64 = null,
  userQuestion = "",
  mode = "default",
}) {
  const key = openaiKey();
  const userText = String(text || "").trim();
  if (!userText) return { reply: "Eshitmadim. Qayta ayting.", facts: [] };

  const content = [{ type: "text", text: userText }];
  if (userQuestion && userQuestion !== userText) {
    content.unshift({
      type: "text",
      text: `Usta savoli: ${userQuestion}`,
    });
  }
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: imageBase64 ? "gpt-4o-mini" : "gpt-4o-mini",
      max_tokens: 220,
      messages: [
        { role: "system", content: systemPrompt({ isMasterUser, mode }) },
        { role: "user", content },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI xato");

  const raw = (data.choices?.[0]?.message?.content || "").trim();
  const { clean, facts } = extractMemories(raw);

  if (isMasterUser && mode !== "person_check") {
    for (const f of facts) addFact(f);
    addLesson(`Usta: ${userText.slice(0, 120)} → ${clean.slice(0, 120)}`);
  }

  return { reply: clean || "Tushundim.", facts };
}

export function guestBlockedReply(guestName, question) {
  return (
    `Men faqat ${masterName()} buyruqlariga itoat qilaman. ` +
    `Sizning so'rovingiz ustaga yuborildi. Ruxsat bersa javob beraman.`
  );
}

export function masterApprovalPrompt(req) {
  return (
    `🔔 <b>Ruxsat so'rovi #${req.id}</b>\n` +
    `👤 ${req.name}\n` +
    `💬 ${req.text}\n\n` +
    `/ha ${req.id} — yordam ber\n` +
    `/yoq ${req.id} — rad et`
  );
}
