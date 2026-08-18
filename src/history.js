import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const HISTORY_PATH = new URL("../data/history.json", import.meta.url);
const MAX_HISTORY = 60; // ~2 months of daily facts

export async function loadHistory() {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function saveHistoryEntry(entry) {
  const history = await loadHistory();
  history.push({ ...entry, sentAt: new Date().toISOString() });
  const trimmed = history.slice(-MAX_HISTORY);
  await mkdir(dirname(new URL(HISTORY_PATH).pathname), { recursive: true }).catch(() => {});
  await writeFile(HISTORY_PATH, JSON.stringify(trimmed, null, 2), "utf-8");
}

export function recentTopicIds(history, lookback = 4) {
  return history.slice(-lookback).map((h) => h.topicId);
}

export function recentFactSummaries(history, lookback = 15) {
  return history.slice(-lookback).map((h) => h.factSummary).filter(Boolean);
}
