/** Event API client — aqlli-kuz jurnal DB */

const BASE = (process.env.EVENT_API_URL || "").trim().replace(/\/$/, "");
const SECRET = (process.env.EVENT_API_SECRET || process.env.BRIDGE_SECRET || "").trim();

export function eventApiConfigured() {
  return Boolean(BASE);
}

function headers() {
  const h = { "Content-Type": "application/json" };
  if (SECRET) h["x-bridge-secret"] = SECRET;
  return h;
}

export async function postPersonEvent(row) {
  if (!BASE) return null;
  const res = await fetch(`${BASE}/events/person`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`event-api person: ${res.status}`);
  return res.json();
}

export async function postObjectTake(row) {
  if (!BASE) return null;
  const res = await fetch(`${BASE}/events/object-take`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`event-api object: ${res.status}`);
  return res.json();
}

export async function postFaceMatch(row) {
  if (!BASE) return null;
  const res = await fetch(`${BASE}/events/face-match`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`event-api face: ${res.status}`);
  return res.json();
}

export async function fetchJournalSummary(day = "", zone = "") {
  if (!BASE) return null;
  const q = new URLSearchParams();
  if (day) q.set("day", day);
  if (zone) q.set("zone", zone);
  const res = await fetch(`${BASE}/journal/summary?${q}`, { headers: headers() });
  if (!res.ok) throw new Error(`event-api summary: ${res.status}`);
  return res.json();
}

export async function searchEvents({ day = "", who = "", zone = "", type = "", limit = 100 } = {}) {
  if (!BASE) return null;
  const q = new URLSearchParams();
  if (day) q.set("day", day);
  if (who) q.set("who", who);
  if (zone) q.set("zone", zone);
  if (type) q.set("type", type);
  if (limit) q.set("limit", String(limit));
  const res = await fetch(`${BASE}/events/search?${q}`, { headers: headers() });
  if (!res.ok) throw new Error(`event-api search: ${res.status}`);
  return res.json();
}

export async function searchFaceMatches({ who = "", limit = 50 } = {}) {
  if (!BASE) return null;
  const q = new URLSearchParams();
  if (who) q.set("who", who);
  if (limit) q.set("limit", String(limit));
  const res = await fetch(`${BASE}/faces/search?${q}`, { headers: headers() });
  if (!res.ok) throw new Error(`event-api faces: ${res.status}`);
  return res.json();
}
