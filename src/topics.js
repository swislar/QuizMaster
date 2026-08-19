// Round categories modeled on Quizmaster SG session topics.
// Each entry has:
//   - id: stable key used for history de-duplication
//   - label: shown in the Telegram message as "CATEGORY:"
//   - guidance: steers Gemini toward the *style* of fact this round tests,
//               without hardcoding specific answers (Gemini + grounding finds those)
export const TOPICS = [
  {
    id: "quotes-famous",
    label: "Quotes from Famous People",
    guidance:
      "A well-known quote from a famous person (politician, author, celebrity, or historical " +
      "figure) and who said it, with brief context of when/why it was said.",
  },
  {
    id: "quotes-world-leaders",
    label: "Quotes from World Leaders",
    guidance:
      "A notable, verifiable quote from a world leader or major political figure — include who " +
      "said it and the context.",
  },
  {
    id: "firsts",
    label: "Firsts",
    guidance:
      "A person, place, or thing that was the first to achieve something notable (first person " +
      "to do X, first country to do Y, first company to launch Z), with the date.",
  },
  {
    id: "music-decade",
    label: "Music Through the Decades",
    guidance:
      "A notable song, artist, or chart milestone from the 70s, 80s, 90s, or 2000s — e.g. a " +
      "number-one hit, a band's breakout single, or an iconic album, with the year.",
  },
  {
    id: "musicals",
    label: "Musical Theatre: Name That Tune",
    guidance:
      "Pick ONE well-known, widely popular song from a famous stage musical — prioritize songs " +
      "that even non-theatre-fans would likely recognize over obscure deep cuts. State the song title " +
      "and which musical it's from as the core fact, phrased like a reveal (e.g. \"'Defying " +
      "Gravity' is from Wicked, first performed on Broadway in 2003\"). End the fact by " +
      "inviting the reader to go listen to it now so they can recognize it if it's played in a " +
      "picture/audio round.",
    listenPreferred: true,
  },
  {
    id: "picture-round-brands",
    label: "Picture Round: Brands & Logos",
    guidance:
      "A distinctive fact about a well-known brand or logo's design or history that would help " +
      "someone recognize it in a picture round (e.g. what a logo represents, when it was " +
      "redesigned, founding story).",
    imageSourcePreferred: true,
  },
  {
    id: "picture-round-celebrities",
    label: "Picture Round: Celebrities",
    guidance:
      "A distinctive, well-known identifying fact about a globally recognizable celebrity " +
      "— career milestone, defining trait, or well-known biographical fact that helps someone identify or recall them.",
    imageSourcePreferred: true,
  },
  {
    id: "singapore",
    label: "Singapore Knowledge",
    guidance:
      "A fact about Singapore history, infrastructure, or culture — e.g. the MRT system, " +
      "national landmarks, founding milestones, or well-known local history.",
  },
  {
    id: "general-knowledge",
    label: "General Knowledge",
    guidance:
      "A broadly useful pub-quiz general knowledge fact — geography, science, history, pop " +
      "culture, or language/wordplay (e.g. longest words, unique spelling patterns) — of the " +
      "kind commonly asked in trivia nights.",
  },
];

export function pickTopic(recentTopicIds, allowedTopicIds = null) {
  const recentSet = new Set(recentTopicIds);
  let available = TOPICS;
  if (allowedTopicIds) {
    const allowedSet = new Set(allowedTopicIds);
    available = available.filter(t => allowedSet.has(t.id));
  }
  const fresh = available.filter((t) => !recentSet.has(t.id));
  const pool = fresh.length > 0 ? fresh : available; // if we've cycled through all, reset
  return pool[Math.floor(Math.random() * pool.length)];
}
