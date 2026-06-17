import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadCameras } from "../lib/cameras.mjs";
import { captureDevice } from "../lib/ezviz-cloud.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim();
  }
}

const cfg = loadCameras();
const zoneId = process.argv[2] || cfg.defaultId;
const cam = cfg.zones[zoneId];
if (!cam?.deviceSerial) {
  console.error("Zona topilmadi:", zoneId);
  process.exit(1);
}

console.log("Capture:", cam.label, cam.deviceSerial);
const buf = await captureDevice(cam.deviceSerial, cam.channelNo || 1);
const out = path.join(__dirname, "..", `test-${zoneId}.jpg`);
fs.writeFileSync(out, buf);
console.log("OK:", out, buf.length, "bayt");
