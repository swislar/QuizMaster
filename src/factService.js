import { pickTopic, getFallbackFact, TOPICS } from "./topics.js";
import { generateGroundedFact } from "./gemini.js";
import { formatMessage, sendTelegramMessage, editTelegramMessage } from "./telegram.js";
import { loadHistory, saveHistoryEntry, recentTopicIds, recentFactSummaries } from "./history.js";

const MAX_ATTEMPTS = 4; // across possibly different topics, to avoid an ungrounded fact

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Picks a topic, generates a verified grounded fact, sends/edits it for the given chat(s),
 * and records it in history.
 * targetMessageIds can be a single message_id (if chatIds is a single chat) or a map of { [chatId]: message_id }.
 */
export async function pickAndSendFact(chatIds, allowedTopicIds = null, targetMessageIds = null) {
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
    console.log(`[Pipeline] Attempt ${attempt + 1}/${MAX_ATTEMPTS}: generating & verifying for "${topic.label}"...`);

    try {
      const fact = await generateGroundedFact({ topic, avoidSummaries });
      if (fact) {
        result = fact;
        usedTopic = topic;
        console.log(`[Pipeline] Successfully verified fact for category "${topic.label}".`);
        break;
      }
      console.warn(`[Pipeline] Verification failed for topic "${topic.label}", retrying next candidate...`);
    } catch (err) {
      console.error(`[Pipeline] Error generating fact for "${topic.label}":`, err.message);
      if (err.status === 429 && err.retryAfterMs) {
        console.log(`Rate limited — waiting ${Math.ceil(err.retryAfterMs / 1000)}s before retrying...`);
        await sleep(err.retryAfterMs);
      }
    }
  }

  // If dynamic generation & verification failed across all attempts, use curated fallback
  if (!result) {
    console.warn(`[Pipeline] All ${MAX_ATTEMPTS} dynamic attempts failed verification. Falling back to curated fact bank.`);
    const fallbackTopic = (allowedTopicIds && allowedTopicIds.length > 0)
      ? TOPICS.find((t) => allowedTopicIds.includes(t.id)) || TOPICS[0]
      : pickTopic(avoidTopicIds);

    const fallback = getFallbackFact(fallbackTopic.id, avoidSummaries);
    usedTopic = fallbackTopic;
    result = {
      fact: fallback.fact,
      summary: fallback.summary,
      sourceUrl: fallback.sourceUrl,
      imageUrl: fallback.imageUrl || null,
      verified: true,
      isFallback: true,
    };
  }

  const message = formatMessage({
    categoryLabel: usedTopic.label,
    fact: result.fact,
    sourceUrl: result.sourceUrl,
    listenPreferred: usedTopic.listenPreferred,
    imageSourcePreferred: usedTopic.imageSourcePreferred,
    imageUrl: result.imageUrl,
  });

  for (const id of ids) {
    const targetMsgId =
      typeof targetMessageIds === "object" && targetMessageIds !== null
        ? targetMessageIds[id]
        : targetMessageIds;

    if (targetMsgId) {
      console.log(`Editing message ${targetMsgId} in chat ${id}:\n` + message);
      try {
        await editTelegramMessage(id, targetMsgId, message);
        continue;
      } catch (err) {
        console.warn(`Failed to edit message ${targetMsgId} in chat ${id}, falling back to sendMessage:`, err.message);
      }
    }

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
