/**
 * EZVIZ Camera Bot — faqat Railway + EZVIZ Cloud API.
 * Face ID (ixtiyoriy) → POST /event → bulut snapshot → Telegram.
 */
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { loadCameras } from "./lib/cameras.mjs";
import { ezvizCloudConfigured } from "./lib/ezviz-cloud.mjs";
import { handleFaceEvent } from "./lib/handle-event.mjs";
import { startTelegramBot } from "./lib/telegram-bot.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim();
  }
}

const PORT = Number(process.env.PORT || 8080);
const SECRET = (process.env.BRIDGE_SECRET || "").trim();
const cameraCfg = loadCameras();
const cloudReady = ezvizCloudConfigured();

if (!cloudReady) {
  console.warn("EZVIZ_APP_KEY/SECRET yo'q — /snap ishlamaydi, bot kutmoqda");
}

function authOk(req) {
  if (!SECRET) return true;
  const h = req.headers["x-bridge-secret"] || req.headers.authorization || "";
  if (h === SECRET) return true;
  if (h.startsWith("Bearer ") && h.slice(7) === SECRET) return true;
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    const zones = Object.keys(cameraCfg.zones);
    return send(200, {
      ok: true,
      service: "ezviz-camera-bot",
      cloud: cloudReady,
      cameras: zones.length,
      vision: process.env.VISION_ENABLED === "1",
    });
  }

  if (req.method === "POST" && req.url === "/event") {
    if (!authOk(req)) return send(401, { ok: false, error: "unauthorized" });
    let payload = {};
    try {
      payload = JSON.parse((await readBody(req)) || "{}");
    } catch {
      return send(400, { ok: false, error: "json" });
    }
    try {
      const out = await handleFaceEvent(payload, cameraCfg);
      return send(200, out);
    } catch (e) {
      console.error("event xato:", e.message);
      return send(500, { ok: false, error: e.message });
    }
  }

  if (req.method === "POST" && req.url === "/snapshot") {
    if (!authOk(req)) return send(401, { ok: false, error: "unauthorized" });
    let payload = {};
    try {
      payload = JSON.parse((await readBody(req)) || "{}");
    } catch {
      payload = {};
    }
    try {
      const out = await handleFaceEvent(
        { ...payload, kind: "manual", employeeName: payload.employeeName || "Test" },
        cameraCfg
      );
      return send(200, out);
    } catch (e) {
      return send(500, { ok: false, error: e.message });
    }
  }

  send(404, { ok: false });
});

server.listen(PORT, () => {
  const zones = Object.keys(cameraCfg.zones).join(", ") || "—";
  console.log(`ezviz-camera-bot :${PORT} · zonalar: ${zones}`);
  startTelegramBot(cameraCfg);
});
