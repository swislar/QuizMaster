import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Global throttle across ALL callers (cron, /getfact from the group, /getfact from a DM,
// and retries within a single call) so we never burst multiple requests at once — that's
// what was tripping the per-minute rate limit even though daily quota was fine. Free-tier
// Gemini Flash is commonly ~10 requests/minute; 7s spacing keeps us comfortably under that
// with margin. Adjust if your project's actual RPM (check aistudio.google.com) differs.
const MIN_INTERVAL_MS = 7000;
let lastCallAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle() {
  const waitMs = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (waitMs > 0) {
    console.log(`Throttling: waiting ${Math.ceil(waitMs / 1000)}s before next Gemini call...`);
    await sleep(waitMs);
  }
  lastCallAt = Date.now();
}

/**
 * Asks Gemini for one trivia fact, grounded in real Google Search results.
 * Returns null if the model didn't produce a usable, grounded fact (caller should
 * retry with a different topic rather than send an unverified fact).
 * Throws an Error with a `.retryAfterMs` property on 429 so callers can back off properly
 * instead of hammering the API again immediately.
 */
export async function generateGroundedFact({ topic, avoidSummaries }) {
  await throttle();

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const avoidBlock =
    avoidSummaries && avoidSummaries.length > 0
      ? `Avoid repeating these facts already sent recently:\n- ${avoidSummaries.join("\n- ")}\n`
      : "";

  const prompt = `You are writing ONE trivia study fact for a pub quiz study group preparing for
a Singapore-based pub quiz/trivia night (Quizmaster SG style).

Round category: "${topic.label}"
What this round tests: ${topic.guidance}

${avoidBlock}
Requirements:
- The fact MUST be something you can verify using the Google Search tool available to you.
  Do not state anything you cannot ground in an actual search result.
- Write 1-3 sentences. Specific, memorable, and quiz-relevant (names, dates, numbers where
  relevant). Avoid vague trivia ("many people believe...").
- Keep it concise enough to read in a Telegram message.
- Do NOT include any URL in your answer text — sources are attached separately.${
    topic.listenPreferred
      ? "\n- When you search to ground this, specifically look for the song's official YouTube " +
        "upload or Spotify listing so a listenable link is available among your sources."
      : ""
  }

Respond in EXACTLY this format, nothing else:
FACT: <the 1-3 sentence fact>
SUMMARY: <a 5-8 word unique summary of this specific fact, for dedup purposes>`;

  let data;
  try {
    data = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.9,
      }
    });
  } catch (e) {
    if (e.status === 429 || (e.message && e.message.includes("429"))) {
      const err = new Error(`Gemini API error 429 (rate limited): ${e.message}`);
      err.status = 429;
      // We can't reliably read the retry-after header from the SDK wrapper error yet,
      // so we use a safe default 30s.
      err.retryAfterMs = 30_000; 
      throw err;
    }
    throw e;
  }
  const candidate = data.candidates?.[0];
  if (!candidate) return null;

  const text = candidate.content?.parts?.map((p) => p.text || "").join("\n") || "";
  const factMatch = text.match(/FACT:\s*([\s\S]*?)\nSUMMARY:/i);
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*)/i);

  const fact = factMatch?.[1]?.trim();
  const summary = summaryMatch?.[1]?.trim();
  if (!fact) return null;

  // Pull the real, grounded source URL(s) out of groundingMetadata.
  // groundingChunks[].web.uri are the actual pages Gemini's search grounding used.
  const groundingMetadata = candidate.groundingMetadata;
  const chunks = groundingMetadata?.groundingChunks || [];
  const sourceUrls = chunks
    .map((c) => c.web?.uri)
    .filter(Boolean);

  if (sourceUrls.length === 0) {
    // No grounded source came back — do not trust this fact, caller should retry/skip.
    return null;
  }

  // For "listen now" categories (currently just musicals), prefer a link you can actually
  // press play on over e.g. a Wikipedia page — falls back to the first grounded source if
  // no listenable link was among the search results Gemini grounded on.
  const isListenable = (u) => /youtube\.com|youtu\.be|open\.spotify\.com/i.test(u);
  const preferredUrl = topic.listenPreferred
    ? sourceUrls.find(isListenable) || sourceUrls[0]
    : sourceUrls[0];

  return {
    fact,
    summary: summary || fact.slice(0, 60),
    sourceUrl: preferredUrl,
    allSourceUrls: sourceUrls,
  };
}

// NOTE on source URLs: Gemini's search-grounding API has historically returned URIs under
// `groundingChunks[].web.uri` that are sometimes Google redirect links rather than the raw
// publisher URL (they resolve correctly in a browser, but look odd pasted raw). Google has
// changed this behavior across API versions before. Run `node src/sendDailyFact.js` once and
// actually click the link it sends before trusting this in production — if it's a redirect
// and you want the raw domain, log `groundingMetadata` in full and check for `web.title`
// (site name) to at least show alongside the link, or switch to resolving the redirect with
// a HEAD request before sending.
