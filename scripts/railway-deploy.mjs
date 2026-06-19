/**
 * Railway deploy: yangi servis yoki mavjud servisga env + deploy.
 * Ishlatish: RAILWAY_TOKEN=... node scripts/railway-deploy.mjs
 */

const TOKEN = (process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || "").trim();
if (!TOKEN) {
  console.error("RAILWAY_TOKEN yo'q");
  process.exit(1);
}

const API = "https://backboard.railway.com/graphql/v2";

const FACE_PROJECT = {
  projectId: "5034d01f-656a-4fa0-b9c3-400cb702a992",
  environmentId: "bad3f0da-ce42-4eb0-a580-cb5f929d548e",
};

const BOT_TOKEN = (process.env.BOT_TOKEN || "").trim();
const BRIDGE_SECRET = (process.env.BRIDGE_SECRET || "dalion_ezviz_2026_kuchli_kalit").trim();
const ADMIN_IDS = (process.env.ADMIN_IDS || "1432810519").trim();
const NOTIFY_CHAT_ID = (process.env.NOTIFY_CHAT_ID || ADMIN_IDS).trim();
const SERVICE_NAME = (process.env.RAILWAY_SERVICE_NAME || "ezviz-camera-bot").trim();

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
  if (data.errors?.length) {
    throw new Error(data.errors.map((e) => e.message).join("; "));
  }
  return data.data;
}

async function findService(projectId, name) {
  const q = `query($projectId: String!) {
    project(id: $projectId) {
      services { edges { node { id name } } }
    }
  }`;
  const data = await gql(q, { projectId });
  const services = data.project?.services?.edges || [];
  const hit = services.find((e) => e.node.name === name);
  return hit?.node?.id || null;
}

async function createService(projectId, name) {
  const q = `mutation($input: ServiceCreateInput!) {
    serviceCreate(input: $input) { id name }
  }`;
  const data = await gql(q, {
    input: { projectId, name, source: { repo: "davlatbekkhasanov-spec/ezviz-camera-bot" } },
  });
  return data.serviceCreate;
}

async function upsertVariables({ projectId, environmentId, serviceId, variables }) {
  const q = `mutation($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`;
  await gql(q, {
    input: { projectId, environmentId, serviceId, variables, replace: false },
  });
}

async function deploy({ environmentId, serviceId }) {
  const q = `mutation($serviceId: String!, $environmentId: String!, $latestCommit: Boolean) {
    serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId, latestCommit: $latestCommit)
  }`;
  await gql(q, { environmentId, serviceId, latestCommit: true });
}

async function generateDomain({ environmentId, serviceId }) {
  const q = `mutation($environmentId: String!, $serviceId: String!) {
    serviceDomainCreate(input: { environmentId: $environmentId, serviceId: $serviceId })
  }`;
  try {
    const data = await gql(q, { environmentId, serviceId });
    return data.serviceDomainCreate?.domain || null;
  } catch {
    return null;
  }
}

async function main() {
  const deployOnly = process.argv.includes("--deploy-only");
  if (!deployOnly && !BOT_TOKEN) {
    throw new Error("BOT_TOKEN yo'q (deploy uchun env da bering yoki --deploy-only)");
  }

  try {
    const me = await gql("{ me { email } }");
    console.log("Railway:", me.me?.email || "OK");
  } catch {
    console.log("Railway token OK");
  }

  const { projectId, environmentId } = FACE_PROJECT;
  let serviceId = await findService(projectId, SERVICE_NAME);

  if (!serviceId) {
    console.log("Yangi servis:", SERVICE_NAME);
    try {
      const svc = await createService(projectId, SERVICE_NAME);
      serviceId = svc.id;
      console.log("serviceCreate:", serviceId);
    } catch (e) {
      console.warn("repo bilan yaratilmadi, bo'sh servis:", e.message);
      const q = `mutation($input: ServiceCreateInput!) {
        serviceCreate(input: $input) { id name }
      }`;
      const data = await gql(q, { input: { projectId, name: SERVICE_NAME } });
      serviceId = data.serviceCreate.id;
    }
  } else {
    console.log("Mavjud servis:", serviceId);
  }

  const vars = {
    BOT_TOKEN,
    ADMIN_IDS,
    NOTIFY_CHAT_ID,
    BRIDGE_SECRET,
    TZ: "Asia/Tashkent",
    CAMERAS_JSON: "config/cameras.json",
    VISION_ENABLED: "1",
    MASTER_NAME: (process.env.MASTER_NAME || "Davlat aka").trim(),
    MASTER_CHAT_ID: (process.env.MASTER_CHAT_ID || ADMIN_IDS).trim(),
    TTS_VOICE: (process.env.TTS_VOICE || "nova").trim(),
    DATA_DIR: "/app/data",
    SNAP_ALL_LIMIT: "5",
    SNAP_ALL_DELAY_MS: "5000",
    EVENT_API_PORT: "8788",
    EVENT_API_URL: "http://127.0.0.1:8788",
    EVENT_API_AUTO_MIGRATE: "1",
    EVENT_API_SECRET: BRIDGE_SECRET,
    CLOUD_WATCH_ENABLED: "1",
    CLOUD_WATCH_INTERVAL_MS: "30000",
    CLOUD_WATCH_ARCHIVE: "1",
    STRANGER_ALERT_ENABLED: "1",
  };
  if ((process.env.OPENAI_API_KEY || "").trim()) {
    vars.OPENAI_API_KEY = process.env.OPENAI_API_KEY.trim();
  }
  if ((process.env.EZVIZ_APP_KEY || "").trim()) {
    vars.EZVIZ_APP_KEY = process.env.EZVIZ_APP_KEY.trim();
  }
  if ((process.env.EZVIZ_APP_SECRET || "").trim()) {
    vars.EZVIZ_APP_SECRET = process.env.EZVIZ_APP_SECRET.trim();
  }
  vars.EZVIZ_API_BASE =
    (process.env.EZVIZ_API_BASE || "https://isgpopen.ezvizlife.com/api/lapp").trim();

  if (!deployOnly) {
    await upsertVariables({ projectId, environmentId, serviceId, variables: vars });
    console.log("Env yangilandi");
  } else {
    console.log("Deploy-only: env o'zgartirilmadi");
  }

  await deploy({ environmentId, serviceId });
  console.log("Deploy boshlandi");

  const domain = await generateDomain({ environmentId, serviceId });
  if (domain) console.log("Domain:", `https://${domain}`);
}

main().catch((e) => {
  console.error("deploy failed:", e.message);
  process.exit(1);
});
