const pending = new Map();
let seq = 1;

export function masterChatId() {
  const raw = (process.env.MASTER_CHAT_ID || process.env.ADMIN_IDS || "").trim();
  const first = raw.split(/[,\s]+/).map((s) => s.trim()).find(Boolean);
  return first || "";
}

export function isMaster(chatId) {
  const master = masterChatId();
  if (!master) return true;
  return String(chatId) === master;
}

export function queueGuestRequest({ chatId, name, text }) {
  const id = String(seq++);
  pending.set(id, {
    id,
    chatId: String(chatId),
    name: name || "Mehmon",
    text,
    at: Date.now(),
  });
  if (pending.size > 50) {
    const oldest = [...pending.keys()][0];
    pending.delete(oldest);
  }
  return pending.get(id);
}

export function takeGuestRequest(id) {
  const hit = pending.get(String(id));
  if (hit) pending.delete(String(id));
  return hit;
}

export function listPending() {
  return [...pending.values()].sort((a, b) => b.at - a.at);
}
