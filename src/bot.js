// Persistent process. Use this INSTEAD OF the GitHub Actions workflow if you want the
// interactive /getfact command — GitHub Actions can't stay running to listen for messages,
// so command support requires an always-on host (VPS, Railway, Render background worker,
// Fly.io, etc). Run with `npm run bot`, ideally under pm2 or a systemd service so it restarts
// if it crashes.
//
// Do NOT also enable the GitHub Actions daily-fact.yml workflow while running this — both
// would post the daily fact independently and your group gets it twice.
import "dotenv/config";
process.env.TZ = "Asia/Singapore";
import fetch from "node-fetch";
import cron from "node-cron";
import { pickAndSendFact } from "./factService.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_IDS = String(process.env.TELEGRAM_CHAT_ID).split(",").map(id => id.trim()).filter(Boolean);
const TIMEZONE = "Asia/Singapore";
const COOLDOWN_MS = 10_000; // guard against /getfact spam burning your Gemini quota

if (!TOKEN || !process.env.TELEGRAM_CHAT_ID || !process.env.GEMINI_API_KEY) {
  console.error("Missing required env vars. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const lastManualTrigger = new Map(); // chatId -> timestamp, so DMs and the group cool down independently
let offset = 0; // Telegram update_id cursor for long polling

async function setBotCommands() {
  const url = `${API}/setMyCommands`;
  const commands = [
    { command: "getfact", description: "Get a random trivia fact right now" },
    { command: "getquote", description: "Get a quote from a famous person or world leader" },
    { command: "getfirsts", description: "Get a notable 'first' in history" },
    { command: "getmusic", description: "Get a music or musical theatre fact" },
    { command: "getpicture", description: "Get a fact about a brand or celebrity" },
    { command: "getknowledge", description: "Get general knowledge or Singapore facts" }
  ];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Failed to set bot commands:", data);
    } else {
      console.log("Bot commands set successfully.");
    }
  } catch (err) {
    console.error("Error setting bot commands:", err);
  }
}

async function getUpdates() {
  const url = `${API}/getUpdates?timeout=30&offset=${offset}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) {
    console.error("getUpdates failed:", data);
    return [];
  }
  return data.result;
}

async function handleGetFact(chatId, allowedTopicIds = null) {
  const now = Date.now();
  const msSinceLast = now - (lastManualTrigger.get(chatId) || 0);
  if (msSinceLast < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - msSinceLast) / 1000);
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⏳ Hold on — a fact was just sent here. Try again in ${waitSec}s.`,
      }),
    });
    return;
  }
  lastManualTrigger.set(chatId, now);

  const showTyping = () =>
    fetch(`${API}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    }).catch(() => { });

  await showTyping();
  // Telegram's "typing..." indicator only lasts ~5s; a rate-limit backoff can take much
  // longer than that, so keep refreshing it while we wait rather than let it go stale.
  const typingInterval = setInterval(showTyping, 4000);

  try {
    await pickAndSendFact(chatId, allowedTopicIds);
  } catch (err) {
    console.error("Error handling /getfact:", err);
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: err.message?.includes("429") || err.message?.includes("attempts across topics")
          ? "⚠️ Gemini's rate limit is being hit right now — I backed off but still couldn't get a verified fact. Try again in a minute or two."
          : "⚠️ Couldn't generate a verified fact just now — try again in a bit.",
      }),
    });
  } finally {
    clearInterval(typingInterval);
  }
}

async function pollLoop() {
  console.log("Bot listening for commands (long polling)...");
  while (true) {
    let updates = [];
    try {
      updates = await getUpdates();
    } catch (err) {
      console.error("Poll error:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      const text = update.message?.text?.trim();
      const chatId = update.message?.chat?.id;
      if (!text || !chatId) continue;

      // Any chat can trigger this now (group or DM) — see COOLDOWN_MS above for the
      // per-chat spam/quota guard. Logged here so you have an audit trail of who's using it.
      const commandMap = {
        "/getfact": null,
        "/getquote": ["quotes-famous", "quotes-world-leaders"],
        "/getfirsts": ["firsts"],
        "/getmusic": ["music-decade", "musicals"],
        "/getpicture": ["picture-round-brands", "picture-round-celebrities"],
        "/getknowledge": ["singapore", "general-knowledge"]
      };

      const textLower = text.toLowerCase();
      let matchedCommand = null;
      for (const cmd in commandMap) {
        if (textLower === cmd || textLower.startsWith(cmd + "@")) {
          matchedCommand = cmd;
          break;
        }
      }

      if (matchedCommand) {
        const from = update.message?.from;
        console.log(
          `${matchedCommand} triggered in chat ${chatId} (type: ${update.message.chat.type}) ` +
          `by ${from?.username || from?.first_name || "unknown"}`
        );
        handleGetFact(chatId, commandMap[matchedCommand]); // fire and forget, don't block the poll loop
      }
    }
  }
}

function startDailySchedule() {
  cron.schedule(
    "0 9 * * *",
    () => {
      console.log(`[${new Date().toISOString()}] Running scheduled daily send...`);
      pickAndSendFact(GROUP_CHAT_IDS).catch((err) => console.error("Daily send failed:", err));
    },
    { timezone: TIMEZONE }
  );
  console.log(`Daily schedule armed: 09:00 ${TIMEZONE}.`);
}

startDailySchedule();
setBotCommands();
pollLoop();
