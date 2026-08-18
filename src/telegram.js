import fetch from "node-fetch";

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatMessage({ categoryLabel, fact, sourceUrl, listenPreferred, imageSourcePreferred }) {
  const linkLabel = listenPreferred ? "🎧 Listen" : imageSourcePreferred ? "🖼️ View Image" : "🔗 Source";
  return (
    `📚 CATEGORY: ${escapeHTML(categoryLabel)}\n\n` +
    `${escapeHTML(fact)}\n\n` +
    `<a href="${escapeHTML(sourceUrl)}">${escapeHTML(linkLabel)}</a>`
  );
}

export async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }
  return data;
}
