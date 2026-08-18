import "dotenv/config";
process.env.TZ = "Asia/Singapore";
import { pickAndSendFact } from "./factService.js";

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return val;
}

async function main() {
  requireEnv("TELEGRAM_BOT_TOKEN");
  requireEnv("TELEGRAM_CHAT_ID");
  requireEnv("GEMINI_API_KEY");

  const chatIdStr = process.env.PREVIEW_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  const chatIds = chatIdStr.split(",").map(id => id.trim()).filter(Boolean);
  await pickAndSendFact(chatIds);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
