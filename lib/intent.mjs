/** Sklad savollari — lotin + kirill */
import { wantsPersonHistory, isPersonLookup } from "./person-search.mjs";

function norm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/қ/g, "q")
    .replace(/ғ/g, "g")
    .replace(/ў/g, "o")
    .replace(/ҳ/g, "h")
    .replace(/ъ/g, "'")
    .replace(/а/g, "a")
    .replace(/б/g, "b")
    .replace(/в/g, "v")
    .replace(/г/g, "g")
    .replace(/д/g, "d")
    .replace(/е/g, "e")
    .replace(/ё/g, "yo")
    .replace(/ж/g, "j")
    .replace(/з/g, "z")
    .replace(/и/g, "i")
    .replace(/й/g, "y")
    .replace(/к/g, "k")
    .replace(/л/g, "l")
    .replace(/м/g, "m")
    .replace(/н/g, "n")
    .replace(/о/g, "o")
    .replace(/п/g, "p")
    .replace(/р/g, "r")
    .replace(/с/g, "s")
    .replace(/т/g, "t")
    .replace(/у/g, "u")
    .replace(/ф/g, "f")
    .replace(/х/g, "x")
    .replace(/ц/g, "ts")
    .replace(/ч/g, "ch")
    .replace(/ш/g, "sh")
    .replace(/щ/g, "sch")
    .replace(/ы/g, "i")
    .replace(/э/g, "e")
    .replace(/ю/g, "yu")
    .replace(/я/g, "ya");
}

export function wantsAllCameras(text) {
  const t = norm(text);
  return (
    /hamma|barcha|xamma|все|всех|all\b/u.test(t) &&
    /kamera|rasm|snap|фото|photo/u.test(t)
  );
}

export function needsLiveCamera(text) {
  if (wantsPersonHistory(text) || isPersonLookup(text)) return false;
  const t = norm(text);
  return (
    /odam|человек|kim|borimi|bormi|bor\b|hozir|sklad|склад|kamer|kadr|ko'r|qara|kur|nima bor|kim bor|tekshir|qarab|rasm|snap|polka|joyda|rim|disk|shina|mahsulot|kirim|chiqim|kirdi|chiqdi|bugun|kir|chiq/u.test(
      t
    ) || /sklad[\s-]*\d|склад[\s-]*\d/u.test(t)
  );
}
export function wantsPersonCheck(text) {
  const t = norm(text);
  return /odam|человек|kim bor|borimi|bormi|bor\b/u.test(t);
}

export function wantsMovementCheck(text) {
  const t = norm(text);
  if (wantsPersonCheck(text)) return false;
  return /rim|disk|shina|mahsulot|kirim|chiqim|kirdi|chiqdi|kir\b|chiq\b|bugun|ombor|qoldiq|soni|nechta/u.test(
    t
  );
}
export function personCheckPrompt() {
  return (
    "Bu kamera kadri. Faqat bitta savolga javob: HOZIR odam ko'rinadimi? " +
    "Javob formati: «Ha, odam bor» yoki «Yo'q, odam yo'q» — keyin 1 gap izoh."
  );
}

export function parseZoneHint(text, zoneKeys = []) {
  const t = norm(text);
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

export function movementCheckPrompt(userQuestion = "") {
  return (
    `Bu sklad kamera kadri. Usta savoli: ${userQuestion}\n` +
    `Kadrdan ko'rinadigan mahsulotlar va odamlar haqida qisqa javob ber. ` +
    `Aniq son bilmaysan — taxmin qilma. ` +
    `Kadr vaqtini odam ko'rinishi deb aytma. ` +
    `Agar bugungi kirim-chiqim soni kerak bo'lsa, jurnalda yozilganini ayt.`
  );
}

export { wantsPersonHistory, wantsHistoryPhoto, parsePersonName, isPersonLookup } from "./person-search.mjs";
