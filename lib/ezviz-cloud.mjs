/** EZVIZ Open Platform — bulut orqali snapshot (LAN/RTSP shart emas). */

const API = "https://open.ys7.com/api/lapp";

let cached = { token: "", expire: 0 };

function requireCreds() {
  const appKey = (process.env.EZVIZ_APP_KEY || "").trim();
  const appSecret = (process.env.EZVIZ_APP_SECRET || "").trim();
  if (!appKey || !appSecret) {
    throw new Error("EZVIZ_APP_KEY va EZVIZ_APP_SECRET Railway env da kerak");
  }
  return { appKey, appSecret };
}

async function postForm(path, fields) {
  const body = new URLSearchParams(fields);
  const res = await fetch(`${API}${path}`, { method: "POST", body });
  const data = await res.json();
  return data;
}

export async function getAccessToken() {
  const now = Date.now();
  if (cached.token && cached.expire > now + 60_000) return cached.token;

  const { appKey, appSecret } = requireCreds();
  const data = await postForm("/token/get", { appKey, appSecret });
  if (data.code !== "200") {
    throw new Error(data.msg || `token: ${data.code}`);
  }
  cached = {
    token: data.data.accessToken,
    expire: Number(data.data.expireTime) || now + 3_600_000,
  };
  return cached.token;
}

export async function captureDevice(deviceSerial, channelNo = 1) {
  const serial = String(deviceSerial || "").trim().toUpperCase();
  if (!serial) throw new Error("deviceSerial yo'q");

  const token = await getAccessToken();
  const data = await postForm("/device/capture", {
    accessToken: token,
    deviceSerial: serial,
    channelNo: String(channelNo || 1),
  });
  if (data.code !== "200") {
    throw new Error(data.msg || `capture: ${data.code}`);
  }

  const picUrl = data.data?.picUrl;
  if (!picUrl) throw new Error("picUrl yo'q");

  const imgRes = await fetch(picUrl);
  if (!imgRes.ok) throw new Error(`rasm yuklanmadi: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

export function ezvizCloudConfigured() {
  return Boolean(
    (process.env.EZVIZ_APP_KEY || "").trim() &&
      (process.env.EZVIZ_APP_SECRET || "").trim()
  );
}
