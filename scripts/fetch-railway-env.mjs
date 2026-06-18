/**
 * Railway dan env o'zgaruvchilarni .env ga yozadi (secret chiqarmaydi).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TOKEN = (process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || "").trim();
const API = "https://backboard.railway.com/graphql/v2";

const PROJECT = {
  projectId: "5034d01f-656a-4fa0-b9c3-400cb702a992",
  environmentId: "bad3f0da-ce42-4eb0-a580-cb5f929d548e",
  serviceId: "318828b9-6ee0-4893-b09b-abac0e534166",
};

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors.map((e) => e.message).join("; "));
  return data.data;
}

function writeEnv(target, vars) {
  const lines = Object.entries(vars)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(target, lines.join("\n") + "\n");
}

async function main() {
  if (!TOKEN) {
    console.error("RAILWAY_TOKEN kerak");
    process.exit(1);
  }

  const q = `query($p:String!,$e:String!,$s:String!){
    variables(projectId:$p, environmentId:$e, serviceId:$s)
  }`;
  const data = await gql(q, {
    p: PROJECT.projectId,
    e: PROJECT.environmentId,
    s: PROJECT.serviceId,
  });
  const vars = data.variables || {};
  const keys = Object.keys(vars).length;
  if (!keys) {
    console.error("Railway variables topilmadi");
    process.exit(1);
  }

  const bridgeEnv = path.join(ROOT, ".env");
  writeEnv(bridgeEnv, vars);

  const aqlliEnv = path.join(ROOT, "..", "aqlli-kuz", ".env");
  const aqlliVars = {
    TZ: vars.TZ || "Asia/Tashkent",
    EZVIZ_APP_KEY: vars.EZVIZ_APP_KEY,
    EZVIZ_APP_SECRET: vars.EZVIZ_APP_SECRET,
    EZVIZ_API_BASE: vars.EZVIZ_API_BASE || "https://isgpopen.ezvizlife.com/api/lapp",
    EVENT_API_PORT: "8788",
    EVENT_API_SECRET: vars.BRIDGE_SECRET || vars.EVENT_API_SECRET,
    EVENT_API_URL: "http://127.0.0.1:8788",
    DATA_DIR: "./data",
    BRIDGE_SECRET: vars.BRIDGE_SECRET,
  };
  fs.mkdirSync(path.dirname(aqlliEnv), { recursive: true });
  writeEnv(aqlliEnv, aqlliVars);

  for (const [k, v] of Object.entries(vars)) {
    if (v != null && String(v).trim() !== "") process.env[k] = String(v).trim();
  }

  console.log(`Railway env: ${keys} ta o'zgaruvchi → .env`);
  console.log(`EZVIZ: ${vars.EZVIZ_APP_KEY ? "OK" : "yo'q"}`);
  console.log(`BOT: ${vars.BOT_TOKEN ? "OK" : "yo'q"}`);
}

main().catch((e) => {
  console.error("fetch-env:", e.message);
  process.exit(1);
});
