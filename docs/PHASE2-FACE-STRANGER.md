# Faza 2 — Kamera + yuz tanish + begona shaxs

## Maqsad

- 48 kamera 24/7 kuzatuv
- Xodimlar yuzi Face ID dan olinadi (avtomatik enroll)
- Begona odam → **avtomatik kiritilmaydi** — admin tasdiqlaydi
- Online AI (OpenAI Vision) harakatni tushuntiradi

---

## Begona shaxs oqimi (siz aytgandek)

```
Kamera → yuz topildi → xodimlar bazasi bilan solishtirish
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ≥72% tanildi    55–72% ehtimol   <55% BEGONA
              │               │               │
         jurnalga yoz    admin tasdiq    Telegram admin:
         avtomatik       so'rash         📷 rasm + "Begona shaxs
                                              aniqlandi. Kim bu?
                                              Ro'yxatga kiritilsinmi?"
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                              "Ha, ism:"        "Mehmon"         "Rad etish"
                              → enroll          vaqtinchalik      → ignore
                              → keyingi safar   eslab qolmaydi
                                taniydi
```

**Muhim qoida:** begona yuz **hech qachon** avtomatik `staff_faces` ga kirmaydi — faqat admin **ism yozgandan keyin**.

---

## Bosqichlar

| # | Vazifa | Holat |
|---|--------|-------|
| 1 | Face ID `employees.json` → `staff_faces` | Tayyor (`enroll.mjs`) |
| 2 | InsightFace worker (yuz embedding) | Keyingi |
| 3 | Pilot 5–8 kirish kamerasi + inventar 48 | Davom |
| 4 | `stranger-alert.mjs` + Telegram tasdiq | Boshlandi |
| 5 | Cloud-watch barcha pilot kameralar | Serverda |
| 6 | OpenAI Vision (`VISION_ENABLED=1`) | `.env` da yoqish |

---

## Telegram admin javoblari

Begona alert kelganda:
- **Ha, kiritish** → bot: "Ismini yozing (masalan: Sindor)"
- Ism kelganda → `staff_faces` ga qo'shiladi, rasm saqlanadi
- **Mehmon** → faqat jurnalga "mehmon · vaqt"
- **Rad** → 24 soat eskormaslik (takror spam yo'q)

---

## Serverda ishga tushirish

```powershell
# 1. Xodimlar yuzini import
node C:\sklad-server\aqlli-kuz\services\face-recognition\enroll.mjs

# 2. Bot (allaqachon)
C:\sklad-server\server-run.bat

# 3. Vision yoqish (.env)
OPENAI_API_KEY=sk-...
VISION_ENABLED=1
```
