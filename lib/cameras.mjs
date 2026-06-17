import fs from "fs";
import path from "path";

export function loadCameras() {
  const file = (process.env.CAMERAS_JSON || "config/cameras.json").trim();
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (fs.existsSync(abs)) {
    const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
    return {
      defaultId: raw.default || Object.keys(raw.zones || {})[0] || "sklad3",
      zones: raw.zones || {},
    };
  }

  const serial = (process.env.EZVIZ_DEVICE_SERIAL || "").trim().toUpperCase();
  const id = (process.env.EZVIZ_CAMERA_ID || "sklad3").trim();
  if (!serial) return { defaultId: id, zones: {} };
  return {
    defaultId: id,
    zones: {
      [id]: {
        label: id,
        deviceSerial: serial,
        channelNo: Number(process.env.EZVIZ_CHANNEL_NO || 1),
      },
    },
  };
}

export function pickCamera(zones, defaultId, zoneId) {
  const key = (zoneId || defaultId || "").trim() || defaultId;
  const cam = zones[key];
  if (cam?.deviceSerial) return { id: key, ...cam };
  const first = Object.entries(zones).find(([, v]) => v?.deviceSerial);
  if (first) return { id: first[0], ...first[1] };
  return null;
}
