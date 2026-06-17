# EZVIZ Camera Bot — Railway

Alohida bot. Face ID / yordamchi ichiga qo'shilmagan.

## 1. EZVIZ Open Platform

1. [open.ys7.com](https://open.ys7.com) — ro'yxatdan o'ting
2. **Console → Application** — yangi ilova, `AppKey` + `AppSecret` oling
3. EZVIZ mobil ilovadagi kamera hisobingiz bilan bog'langan bo'lishi kerak
4. Kamera serial: `BA3648571` (C1C)

## 2. GitHub

Repo: `davlatbekkhasanov-spec/ezviz-camera-bot`

**Live:** https://ezviz-camera-bot-production.up.railway.app/health

## 3. Railway env

| O'zgaruvchi | Qiymat |
|-------------|--------|
| `BOT_TOKEN` | `@qora_koz_bot` token (Railway Secrets — repoga yozmang) |
| `ADMIN_IDS` | `1432810519` |
| `NOTIFY_CHAT_ID` | Xabarlar qayerga |
| `EZVIZ_APP_KEY` | Open Platform |
| `EZVIZ_APP_SECRET` | Open Platform |
| `BRIDGE_SECRET` | `dalion_ezviz_2026_kuchli_kalit` (yoki o'zingizniki) |
| `TZ` | `Asia/Tashkent` |

## 4. Face ID ulanish (ixtiyoriy)

Face ID Railway env:

```
EZVIZ_BRIDGE_URL=https://SIZNING-RAILWAY-URL
EZVIZ_BRIDGE_SECRET=...
EZVIZ_DEFAULT_ZONE=sklad3
```

## 5. Telegram buyruqlar

- `/snap` — test kadr
- `/status` — holat
- `/event Ism zona` — test hodisa
