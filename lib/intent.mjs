/** Sklad savollari — lotin + kirill */

export function needsLiveCamera(text) {
  const t = String(text || "").toLowerCase();
  return (
    /odam|адам|человек|kim|кім|borimi|борми|bormi|бormi|bor\b|бор\b|hozir|хозир|hozır|склад|sklad|kamer|kadr|ko['']r|qara|kur|nima bor|kim bor|tekshir|текшир|qarab|rasm|snap|полка|polka|joyda|жойда/u.test(
      t
    ) || /sklad[\s-]*3|склад[\s-]*3/u.test(t)
  );
}

export function wantsPersonCheck(text) {
  const t = String(text || "").toLowerCase();
  return /odam|адам|человек|kim bor|кім бар|borimi|борми|bormi|bor\b|бор\b/u.test(t);
}

export function parseZoneHint(text, zoneKeys = []) {
  const t = String(text || "").toLowerCase();
  for (const z of zoneKeys) {
    if (t.includes(z.toLowerCase())) return z;
  }
  const m = t.match(/sklad[\s-]*(\d+)|склад[\s-]*(\d+)/u);
  if (m) {
    const n = m[1] || m[2];
    const hit = zoneKeys.find((z) => z.replace(/\W/g, "").includes(n));
    if (hit) return hit;
    return `sklad${n}`;
  }
  return "";
}

export function personCheckPrompt() {
  return (
    "Bu kamera kadri. Faqat bitta savolga javob: HOZIR odam ko'rinadimi? " +
    "Javob formati: «Ha, odam bor» yoki «Yo'q, odam yo'q» — keyin 1 gap izoh."
  );
}
