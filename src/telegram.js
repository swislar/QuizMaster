import fetch from "node-fetch";

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatMessage({ categoryLabel, fact, sourceUrl, listenPreferred, imageSourcePreferred, imageUrl }) {
  const linkLabel = listenPreferred ? "🎧 Listen" : imageSourcePreferred ? "🖼️ View Image" : "🔗 Source";
  const imageEmbed = imageUrl ? `<a href="${escapeHTML(imageUrl)}">&#8205;</a>` : "";
  return (
    `📚 Category: ${escapeHTML(categoryLabel)}\n\n` +
    `${escapeHTML(fact)}\n\n` +
    imageEmbed +
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
    throw new Error(`Telegram API error (sendMessage): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function editTelegramMessage(chatId, messageId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (editMessageText): ${JSON.stringify(data)}`);
  }
  return data;
}

