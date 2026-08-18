import { pickTopic } from "./topics.js";
import { generateGroundedFact } from "./gemini.js";
import { formatMessage, sendTelegramMessage } from "./telegram.js";
import { loadHistory, saveHistoryEntry, recentTopicIds, recentFactSummaries } from "./history.js";

const MAX_ATTEMPTS = 4; // across possibly different topics, to avoid an ungrounded fact

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Picks a topic, generates a grounded fact, sends it to the given chat, and records it
 * in history. Throws if it can't produce a grounded fact after MAX_ATTEMPTS — callers
 * decide how to surface that (exit code for the daily script, a chat reply for /getfact).
 */
export async function pickAndSendFact(chatIds, allowedTopicIds = null) {
  const ids = Array.isArray(chatIds) ? chatIds : [chatIds];
  const history = await loadHistory();
  const avoidTopicIds = recentTopicIds(history, 4);
  const avoidSummaries = recentFactSummaries(history, 15);

  const attempted = new Set();
  let result = null;
  let usedTopic = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const topic = pickTopic([...avoidTopicIds, ...attempted], allowedTopicIds);
    attempted.add(topic.id);
    console.log(`Attempt ${attempt + 1}: trying topic "${topic.label}"...`);

    try {
      const fact = await generateGroundedFact({ topic, avoidSummaries });
      if (fact) {
        result = fact;
        usedTopic = topic;
        break;
      }
      console.warn(`No grounded source returned for "${topic.label}", retrying with a new topic.`);
    } catch (err) {
      console.error(`Error generating fact for "${topic.label}":`, err.message);
      if (err.status === 429 && err.retryAfterMs) {
        // Don't hammer straight back in — this is what was causing the request burst.
        // The module-level throttle in gemini.js already spaces out the *next* call,
        // but a 429 means we should wait longer than the default spacing specifically.
        console.log(`Rate limited — waiting ${Math.ceil(err.retryAfterMs / 1000)}s before retrying...`);
        await sleep(err.retryAfterMs);
      }
    }
  }

  if (!result) {
    throw new Error(
      `Failed to produce a grounded fact after ${MAX_ATTEMPTS} attempts across topics: ` +
        `${[...attempted].join(", ")}. Not sending anything to avoid posting an unverified fact.`
    );
  }

  const message = formatMessage({
    categoryLabel: usedTopic.label,
    fact: result.fact,
    sourceUrl: result.sourceUrl,
    listenPreferred: usedTopic.listenPreferred,
    imageSourcePreferred: usedTopic.imageSourcePreferred,
  });

  for (const id of ids) {
    console.log(`Sending message to ${id}:\n` + message);
    try {
      await sendTelegramMessage(id, message);
    } catch (err) {
      console.error(`Failed to send to chat ${id}:`, err.message);
    }
  }

  await saveHistoryEntry({
    topicId: usedTopic.id,
    factSummary: result.summary,
    sourceUrl: result.sourceUrl,
  });

  return { topic: usedTopic, ...result };
}
