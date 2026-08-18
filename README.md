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

## Setup

### 1. Create the Telegram bot
1. Message **@BotFather** on Telegram → `/newbot` → follow prompts → copy the **bot token**.
2. Add the bot to your study group chat.
3. Get the chat ID: add **@userinfobot** or **@RawDataBot** to the group temporarily, or send
   any message in the group then hit `https://api.telegram.org/bot<TOKEN>/getUpdates` and read
   `result[0].message.chat.id` (group IDs are negative numbers, e.g. `-1001234567890`).
4. Remove the helper bot once you have the chat ID.

### 2. Get a Gemini API key
Go to https://aistudio.google.com/apikey and create a key.

### 3. Configure secrets
Copy `.env.example` to `.env` locally for testing:
```bash
cp .env.example .env
```
Fill in `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GEMINI_API_KEY`.

### 4. Install & test locally
```bash
npm install
node src/sendDailyFact.js
```
This should post one fact to your group immediately — use it to sanity-check formatting
before you wire up the schedule.

### 5. Deploy

**If you don't need `/getfact`:** use the GitHub Actions path from before —
1. Push this repo to GitHub (private).
2. Add repo secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GEMINI_API_KEY`.
3. `.github/workflows/daily-fact.yml` is already set to run at `01:00 UTC` (09:00 SGT) and
   supports manual triggering from the Actions tab for testing.
4. Commit `data/history.json` starting as `[]` — the workflow commits updates to it after
   each run so topics don't repeat.

**If you want `/getfact`:** you need `src/bot.js` running continuously somewhere, since it has
to stay connected to Telegram to hear commands. **Don't also enable the GitHub Actions workflow
in this case** — disable/delete it, or you'll get two daily posts (one from each path).

Cheapest options for an always-on Node process:
- **Railway / Render (background worker, not a web service)** — connect the repo, set the
  three env vars in their dashboard, set start command to `npm run bot`. Both have free/low-cost
  tiers sufficient for this.
- **Fly.io** — similar, via `fly launch` + `fly secrets set`.
- **Existing VPS/Raspberry Pi** — run with `pm2 start src/bot.js --name quiz-bot` (auto-restarts
  on crash) or as a `systemd` service, so it survives reboots.

Test locally first:
```bash
npm run bot
```
Then in the Telegram group, send `/getfact` — you should get an immediate reply. `/getfact`
also works in a **direct message** to the bot (e.g. for someone quizzing themselves solo) —
anyone who finds the bot on Telegram can DM it and use the command. There's a 60-second
cooldown **per chat** (see `COOLDOWN_MS` in `src/bot.js`), so no single chat can hammer your
Gemini quota, but note this does mean quota usage now scales with however many people
discover and DM the bot, not just your study group. Every trigger is logged with the chat ID,
chat type, and username, so you can see who's using it if you want to keep an eye on volume.

## Optional: human-in-the-loop review
For a study group you probably want high trust. Two easy upgrades if you want them later:
- **Preview mode**: set `PREVIEW_CHAT_ID` to your own DM with the bot; the script posts there
  first, and only posts to the group after you `/approve` it (would need a small addition — ask
  and I'll wire this up).
- **Curated bank fallback**: keep a `data/verified-facts.json` of facts you or the group have
  hand-checked; have the script prefer those on days Gemini grounding comes back thin.

## Cost
Gemini API with grounding: low — a few thousand tokens/day, well within free-tier limits for a
single daily call. Telegram Bot API: free. GitHub Actions: free for this usage level.
