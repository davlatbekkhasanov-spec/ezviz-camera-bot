import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim();
  }
}

process.env.EZVIZ_API_BASE ??= "https://isgpopen.ezvizlife.com/api/lapp";
const eventPort = process.env.EVENT_API_PORT || "8788";
process.env.EVENT_API_URL ??= `http://127.0.0.1:${eventPort}`;
await import("./event-api/index.mjs");
await import("./index.mjs");
