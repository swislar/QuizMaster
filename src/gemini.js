import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Per-model throttle tracking. Google AI Studio enforces 15 RPM (4.0s minimum interval)
// separately for each distinct model (e.g. text generation on gemini-3.5-flash-lite vs search/verification on gemini-2.5-flash).
// Tracking timestamps per-model achieves the theoretical maximum speed by allowing parallel model buckets,
// while strictly guaranteeing neither model ever exceeds 15 RPM.
const MODEL_INTERVAL_MS = 4000;
const lastCallAtByModel = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(modelName) {
  const lastCallAt = lastCallAtByModel.get(modelName) || 0;
  const waitMs = MODEL_INTERVAL_MS - (Date.now() - lastCallAt);
  if (waitMs > 0) {
    console.log(`[Throttling] Model "${modelName}" waiting ${Math.ceil(waitMs / 1000)}s for 15 RPM limit...`);
    await sleep(waitMs);
  }
  lastCallAtByModel.set(modelName, Date.now());
}

/**
 * Asks Gemini for one trivia fact, grounded in real Google Search results.
 * Returns null if the model didn't produce a usable, grounded fact (caller should
 * retry with a different topic rather than send an unverified fact).
 * Throws an Error with a `.retryAfterMs` property on 429 so callers can back off properly
 * instead of hammering the API again immediately.
 */
export const GROUNDING_VERIFICATION_PROMPT = `
You are a strict fact-checker for a trivia app. You will be given:
1. A CLAIM — a specific trivia fact, including any names, dates, numbers, quotes, or attributions.
2. SEARCH RESULTS — snippets or pages retrieved to verify the claim.

Your job is NOT to check whether the search results are "about the same topic."
Your job is to check whether the search results EXPLICITLY STATE or DIRECTLY 
SUPPORT the exact specific details in the claim.

Break the claim into its checkable sub-parts before deciding. For example:
- A quote claim has 3 parts: (a) the exact wording, (b) who said it, (c) the 
  context/date. All three must be supported.
- A "first" claim has 2 parts: (a) the specific achievement, (b) that no earlier 
  instance is documented in the sources. If sources don't address whether it was 
  truly first, treat as UNVERIFIED, not confirmed.
- A numeric/date claim (chart position, sales figures, founding year) must match 
  the source number/date exactly or be flagged as a mismatch.

Respond ONLY in this JSON format, with no other text:

{
  "verdict": "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "CONTRADICTED",
  "subClaims": [
    { "claim": "...", "status": "supported" | "unsupported" | "contradicted", "sourceEvidence": "..." }
  ],
  "correctedFact": "string or null — if a sub-claim is contradicted but the rest holds, provide a corrected version of the fact using only what the sources confirm. Otherwise null.",
  "reason": "one sentence explaining the verdict"
}

Rules:
- VERIFIED: every sub-claim is explicitly supported by the search results.
- PARTIALLY_VERIFIED: the core fact is supported but a minor detail (e.g. exact date, exact number) is unsupported or slightly off — only use this if you also populate correctedFact.
- UNVERIFIED: the search results don't contain enough information to confirm or deny the claim. This is common and OK — it means "try a different fact," not "assume it's true."
- CONTRADICTED: the search results directly disagree with the claim (e.g. a different person said the quote, a different year, a different "first").
- Do not use outside knowledge. Only use what is in the provided search results.
- Do not be lenient because the claim "sounds right" or is commonly repeated — common misattributions and urban legends are exactly what this check exists to catch.
- If the claim contains a superlative ("first," "only," "longest," "best-selling") and the sources don't explicitly support the superlative itself (not just the underlying fact), mark that sub-claim as unsupported.
`;

export async function verifyFact({ claim, searchResultsText }) {
  const verifyModel = "gemini-2.5-flash";
  await throttle(verifyModel);

  const contents = `${GROUNDING_VERIFICATION_PROMPT}

CLAIM TO VERIFY:
${claim}

SEARCH RESULTS / RETRIEVED SOURCES:
${searchResultsText}

Respond ONLY with valid JSON.`;

  try {
    const res = await ai.models.generateContent({
      model: verifyModel,
      contents,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    if (err.status === 429 || (err.message && err.message.includes("429"))) {
      const e = new Error(`Gemini API error 429 (rate limited on verification): ${err.message}`);
      e.status = 429;
      e.retryAfterMs = 3_000;
      throw e;
    }
    console.warn("Error running entailment verification pass:", err.message);
    return { verdict: "UNVERIFIED", reason: `Verification error: ${err.message}` };
  }
}

/**
 * Generates a trivia fact and validates it through a Retrieve -> Generate -> Verify pipeline.
 * Performs strict entailment checking against retrieved Google Search sources.
 * Returns null if the fact is UNVERIFIED or CONTRADICTED (caller should retry or fall back).
 */
export async function generateGroundedFact({ topic, avoidSummaries }) {
  const searchModel = "gemini-2.5-flash";
  const mainModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  // Step 1: Constrained fact generation
  await throttle(mainModel);

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
- Only state specific, verifiable, consensus-backed facts (exact names, dates, quotes, numbers).
- Avoid unverified superlatives ("first", "longest", "only") unless you are certain they have broad consensus.
- Write 1-3 concise, memorable sentences suitable for Telegram.
- Do NOT include any URLs in your answer text.

Respond in EXACTLY this format, nothing else:
FACT: <the 1-3 sentence fact>
SUMMARY: <a 5-8 word unique summary of this specific fact, for dedup purposes>${topic.imageSourcePreferred
      ? "\nIMAGE: <a direct URL starting with http to a public .jpg or .png image of the subject's face/logo, if you know of one>"
      : ""
    }`;

  let data;
  try {
    data = await ai.models.generateContent({
      model: mainModel,
      contents: prompt,
      config: {
        temperature: 0.5,
      },
    });
  } catch (e) {
    if (e.status === 429 || (e.message && e.message.includes("429"))) {
      const err = new Error(`Gemini API error 429 (rate limited on generation): ${e.message}`);
      err.status = 429;
      err.retryAfterMs = 3_000;
      throw err;
    }
    throw e;
  }
  const candidate = data.candidates?.[0];
  if (!candidate) return null;

  const text = candidate.content?.parts?.map((p) => p.text || "").join("\n") || "";
  const factMatch = text.match(/FACT:\s*([\s\S]*?)\nSUMMARY:/i);
  const summaryMatch = text.match(/SUMMARY:\s*([^\n]+)/i);
  const imageMatch = text.match(/IMAGE:\s*([^\n]+)/i);

  const draftFact = factMatch?.[1]?.trim();
  const summary = summaryMatch?.[1]?.trim();
  const imageUrl = imageMatch?.[1]?.trim();
  if (!draftFact) return null;

  // Step 2: Targeted retrieval via Google Search grounding
  await throttle(searchModel);

  const searchPrompt = `Please search and verify the following specific trivia claim:
"${draftFact}"

Category: "${topic.label}"

Use the Google Search tool to find reliable sources that explicitly mention the specific entities, quotes, dates, or claims in this fact.${topic.listenPreferred
      ? "\nSpecifically look for the song's official YouTube upload or Spotify listing so a listenable link is available among your sources."
      : ""
    }
Return a detailed verification summary of the facts found in the search results.`;

  let searchData;
  try {
    searchData = await ai.models.generateContent({
      model: searchModel,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });
  } catch (e) {
    if (e.status === 429 || (e.message && e.message.includes("429"))) {
      const err = new Error(`Gemini API error 429 (rate limited on search): ${e.message}`);
      err.status = 429;
      err.retryAfterMs = 3_000;
      throw err;
    }
    throw e;
  }

  const searchCandidate = searchData.candidates?.[0];
  if (!searchCandidate) return null;

  const searchSummaryText = searchCandidate.content?.parts?.map((p) => p.text || "").join("\n") || "";
  const groundingMetadata = searchCandidate.groundingMetadata;
  const chunks = groundingMetadata?.groundingChunks || [];
  const sourceUrls = chunks
    .map((c) => c.web?.uri)
    .filter(Boolean);

  if (sourceUrls.length === 0 && !searchSummaryText) {
    console.warn(`[Search] No grounded search results found for claim: "${draftFact}"`);
    return null;
  }

  // Step 3: Entailment Verification Pass
  const verification = await verifyFact({
    claim: draftFact,
    searchResultsText: searchSummaryText + (chunks.length > 0 ? `\n\nSources / Chunks:\n` + JSON.stringify(chunks) : ""),
  });

  console.log(`[Verifier] Claim: "${draftFact.slice(0, 60)}..." -> Verdict: ${verification.verdict} (${verification.reason || "no reason"})`);

  let finalFact = draftFact;

  if (verification.verdict === "VERIFIED") {
    finalFact = draftFact;
  } else if (verification.verdict === "PARTIALLY_VERIFIED" && verification.correctedFact) {
    console.log(`[Verifier] Using auto-corrected fact: "${verification.correctedFact}"`);
    finalFact = verification.correctedFact;
  } else {
    // UNVERIFIED or CONTRADICTED — reject and let caller retry
    console.warn(`[Verifier] Rejected unconfirmed claim (${verification.verdict}): ${verification.reason}`);
    return null;
  }

  // For "listen now" categories, prefer a link you can actually press play on
  const isListenable = (u) => /youtube\.com|youtu\.be|open\.spotify\.com/i.test(u);

  const preferredUrl = topic.listenPreferred
    ? sourceUrls.find(isListenable) || sourceUrls[0] || "https://en.wikipedia.org"
    : sourceUrls[0] || "https://en.wikipedia.org";

  return {
    fact: finalFact,
    summary: summary || finalFact.slice(0, 60),
    sourceUrl: preferredUrl,
    imageUrl: imageUrl || null,
    allSourceUrls: sourceUrls,
    verified: true,
    verificationVerdict: verification.verdict,
  };
}

// NOTE on source URLs: Gemini's search-grounding API has historically returned URIs under
// `groundingChunks[].web.uri` that are sometimes Google redirect links rather than the raw
// publisher URL (they resolve correctly in a browser, but look odd pasted raw). Google has
// changed this behavior across API versions before. Test the bot once and
// actually click the link it sends before trusting this in production — if it's a redirect
// and you want the raw domain, log `groundingMetadata` in full and check for `web.title`
// (site name) to at least show alongside the link, or switch to resolving the redirect with
// a HEAD request before sending.
