/** 24/7 bulut kuzatuv — snapshot + harakat + arxiv (RTSP/Docker shart emas). */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { captureDevice } from "./ezviz-cloud.mjs";
import { postPersonEvent } from "./event-client.mjs";
import { analyzeSnapshot, visionEnabled } from "./vision.mjs";
import { maybeAlertStranger } from "./stranger-alert.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTERVAL = Number(process.env.CLOUD_WATCH_INTERVAL_MS || 30_000);
const ARCHIVE = process.env.CLOUD_WATCH_ARCHIVE !== "0";
const VISION_ON_MOTION = process.env.CLOUD_WATCH_VISION !== "0";

const state = new Map();

function loadWatchCameras() {
  const fromEnv = (process.env.CLOUD_WATCH_SERIALS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (fromEnv.length) {
    return fromEnv.map((serial) => ({
      deviceSerial: serial,
      channelNo: 1,
      zone: serial === "BA3648571" ? "sklad3" : serial.toLowerCase(),
      label: serial,
    }));
  }

  const cfgPath = path.join(__dirname, "..", "config", "watch-cameras.json");
  if (fs.existsSync(cfgPath)) {
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return (raw.cameras || []).filter((c) => c.deviceSerial);
  }

  return [
    {
      deviceSerial: "BA3648571",
      channelNo: 1,
      zone: "sklad3",
      label: "Sklad-3 (C1C)",
    },
  ];
}

function archivePath(cam, at = new Date()) {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const day = at.toISOString().slice(0, 10);
  const file = `${at.toISOString().slice(11, 19).replace(/:/g, "-")}.jpg`;
  return path.join(dataDir, "archive", cam.zone || cam.deviceSerial, day, file);
}

function hashBuf(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

function motionDetected(camKey, buf) {
  const h = hashBuf(buf);
  const prev = state.get(camKey);
  state.set(camKey, { hash: h, at: Date.now(), size: buf.length });
  if (!prev) return false;
  if (prev.hash === h) return false;
  const sizeDelta = Math.abs(prev.size - buf.length) / Math.max(prev.size, 1);
  return sizeDelta > 0.02 || prev.hash.slice(0, 8) !== h.slice(0, 8);
}

async function watchOnce(cam) {
  const key = cam.deviceSerial;
  try {
    const jpeg = await captureDevice(cam.deviceSerial, cam.channelNo || 1);
    const moved = motionDetected(key, jpeg);

    if (ARCHIVE) {
      const p = archivePath(cam);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, jpeg);
    }

    if (moved) {
      let note = `harakat aniqlandi · ${jpeg.length} bayt`;
      if (VISION_ON_MOTION && visionEnabled()) {
        try {
          const ai = await analyzeSnapshot(jpeg, { zoneLabel: cam.label || cam.zone });
          if (ai) note += ` · ${ai}`;
        } catch {
          /* vision ixtiyoriy */
        }
      }

      await postPersonEvent({
        type: "presence",
        who: "noma'lum",
        zone: cam.zone || "",
        source: "cloud_watch",
        cameraId: cam.deviceSerial,
        note,
        at: new Date().toISOString(),
      }).catch((e) => console.warn("cloud-watch event:", e.message));

      const botToken = (process.env.BOT_TOKEN || "").trim();
      if (botToken && botToken !== "OFF") {
        await maybeAlertStranger({
          botToken,
          cam,
          jpegBuf: jpeg,
          match: null,
          note,
        }).catch((e) => console.warn("stranger-alert:", e.message));
      }

      console.log(`cloud-watch: ${cam.zone || key} harakat`);
    }
  } catch (e) {
    console.warn(`cloud-watch ${key}:`, e.message);
  }
}

async function loop(cameras) {
  for (const cam of cameras) {
    await watchOnce(cam);
    await new Promise((r) => setTimeout(r, 1200));
  }
}

export function startCloudWatch() {
  if (process.env.CLOUD_WATCH_ENABLED === "0") return;
  const cameras = loadWatchCameras();
  if (!cameras.length) return;

  console.log(
    `cloud-watch: ${cameras.length} kamera, har ${INTERVAL / 1000}s (arxiv: ${ARCHIVE ? "ha" : "yo'q"})`
  );

  const tick = async () => {
    try {
      await loop(cameras);
    } catch (e) {
      console.warn("cloud-watch loop:", e.message);
    }
  };

  tick();
  setInterval(tick, INTERVAL);
}
