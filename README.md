# Quiz Prep Fact Bot (Telegram)

Sends a daily trivia fact to your study group's Telegram chat at **09:00 Asia/Singapore**,
modeled on Quizmaster SG round categories (quotes, "firsts", music decades, picture rounds,
Singapore knowledge, world leader quotes, celebrity recognition, etc). Also supports an
on-demand **`/getfact`** command for an immediate fact outside the daily schedule.

## Why this is built the way it is

The one real engineering risk in "LLM writes trivia facts" is **hallucination** — a model
will confidently invent a fact *and* a fake-but-real-looking source URL. For a bot whose
whole job is "learners should trust this is true," that's a dealbreaker. So instead of a bare
prompt-completion call, this uses **Gemini's Search Grounding tool**: the model must ground
its answer in actual Google Search results, and the API returns the real source URLs it used
(`groundingMetadata`). If Gemini can't ground a claim, the bot **refuses to send that fact**
and retries with a different topic rather than shipping an unverified one.

This is not 100% hallucination-proof — no LLM pipeline is — but it's a meaningfully different
risk profile than "ask Gemini for a fact and a link" (which will fabricate ~10-20% of the time
in practice). Treat this as a strong mitigation, not a guarantee. See "Optional: human review"
below if you want zero tolerance for errors.

## Architecture

There are **two ways to run this**, and which one you pick depends on whether you want the
`/getfact` command:

**Option A — scheduled only, no `/getfact` (simplest, free, nothing to host)**
```
GitHub Actions (cron, 01:00 UTC = 09:00 SGT)
        │
        ▼
  src/sendDailyFact.js   (single-shot script, exits when done)
```

**Option B — scheduled + `/getfact` on demand (requires an always-on host)**
```
Always-on process: src/bot.js
        │
        ├── long-polls Telegram getUpdates() → sees "/getfact" → sends a fact immediately
        └── node-cron, 09:00 Asia/Singapore → sends the daily fact automatically
```
`/getfact` only works with Option B, because responding to a message requires a process that's
listening continuously. GitHub Actions wakes up once a day and exits — it can't hear commands.
**Run only one of these two options**, not both, or the group gets the daily fact twice.

Both options call into the same shared logic:
```
src/factService.js  → src/gemini.js  (Gemini + Search Grounding, picks topic, verifies fact)
                     → src/telegram.js (formats + sends the message)
                     → src/history.js  (avoids repeating topics/facts)
```

## Message format

```
📚 CATEGORY: Firsts

Singapore's first MRT line, the North South Line, began passenger
service on 7 November 1987, running between Yio Chu Kang and Toa Payoh.

🔗 Source: https://www.lta.gov.sg/... 
```