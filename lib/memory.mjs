import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "brain-memory.json");

const DEFAULT = {
  facts: [],
  lessons: [],
  updatedAt: null,
};

function loadRaw() {
  try {
    if (!fs.existsSync(FILE)) return { ...DEFAULT, facts: [], lessons: [] };
    return { ...DEFAULT, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { ...DEFAULT, facts: [], lessons: [] };
  }
}

export function loadMemory() {
  return loadRaw();
}

export function saveMemory(patch) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const cur = loadRaw();
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

export function addFact(text) {
  const t = String(text || "").trim();
  if (!t) return loadMemory();
  const mem = loadRaw();
  if (!mem.facts.includes(t)) mem.facts.push(t);
  if (mem.facts.length > 500) mem.facts = mem.facts.slice(-500);
  return saveMemory({ facts: mem.facts });
}

export function addLesson(text) {
  const t = String(text || "").trim();
  if (!t) return loadMemory();
  const mem = loadRaw();
  mem.lessons.push({ at: new Date().toISOString(), text: t });
  if (mem.lessons.length > 200) mem.lessons = mem.lessons.slice(-200);
  return saveMemory({ lessons: mem.lessons });
}

export function memoryContext() {
  const mem = loadRaw();
  const facts = mem.facts.slice(-40);
  if (!facts.length) return "Hozircha xotira bo'sh — ustadan o'rganadi.";
  return facts.map((f, i) => `${i + 1}. ${f}`).join("\n");
}
