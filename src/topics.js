// Round categories modeled on Quizmaster SG session topics.
// Each entry has:
//   - id: stable key used for history de-duplication
//   - label: shown in the Telegram message as "CATEGORY:"
//   - guidance: steers Gemini toward the *style* of fact this round tests,
//               without hardcoding specific answers (Gemini + grounding finds those)
export const TOPICS = [
  {
    id: "quotes",
    label: "Famous Quotes & Movie Lines",
    guidance:
      "A verified, authentic quote from a famous person (politician, author, celebrity, world leader, or historical " +
      "figure) or an iconic line from a famous movie. Strictly avoid apocryphal or commonly misattributed quotes " +
      "(e.g., lines wrongly credited to Einstein, Twain, or Churchill). State the exact wording, who genuinely said or wrote it, " +
      "and the documented context or year.",
  },
  {
    id: "famous-firsts",
    label: "Famous Firsts",
    guidance:
      "A person, place, or thing that was the first to achieve something notable (first person to do X, first country to do Y, " +
      "first company to launch Z) with the exact verifiable date/year. Only use well-documented firsts with broad historical " +
      "consensus — avoid contested or obscure 'first' claims.",
  },
  {
    id: "music-decade",
    label: "Music Through the Decades",
    guidance:
      "A notable, verifiable song, artist, or chart milestone from the 70s, 80s, 90s, or 2000s (e.g., official #1 single, breakout hit, " +
      "or landmark album) with the release year. Avoid disputed sales figures or unconfirmed superlatives.",
  },
  {
    id: "musicals",
    label: "Name That Tune",
    guidance:
      "Pick ONE well-known, widely popular song from a famous stage musical — prioritize songs that even non-theatre-fans would likely recognize. " +
      "State the song title, the musical it is from, and its premiere year as confirmed facts. End the fact by inviting the reader to listen to it.",
    listenPreferred: true,
  },
  {
    id: "picture-round-brands",
    label: "Brands & Logos",
    guidance:
      "A distinctive, verifiable fact about a well-known brand or logo's design, origin story, or name etymology that would help someone " +
      "recognize it in a picture round. Avoid corporate folklore or unverified marketing myths.",
    imageSourcePreferred: true,
  },
  {
    id: "picture-round-celebrities",
    label: "Celebrities",
    guidance:
      "A distinctive, well-documented identifying fact about a globally recognizable celebrity — verified career milestone, defining trademark, " +
      "or verifiable biographical trivia that helps someone identify them.",
    imageSourcePreferred: true,
  },
  {
    id: "singapore",
    label: "Singapore Knowledge",
    guidance:
      "A verifiable fact about Singapore history, infrastructure, landmarks, or culture (e.g., MRT network milestones, national monuments, " +
      "founding history, or heritage) with accurate dates and details.",
  },
  {
    id: "general-knowledge",
    label: "General Knowledge",
    guidance:
      "A broadly useful, verified pub-quiz general knowledge fact spanning geography, science, history, or nature. " +
      "Avoid unproven wordplay myths, false etymologies, or contested superlatives.",
  },
];

export const FALLBACK_FACTS = {
  quotes: [
    {
      fact: "In the 1939 film 'The Wizard of Oz', Dorothy Gale (played by Judy Garland) famously tells her dog, 'Toto, I've a feeling we're not in Kansas anymore' shortly after arriving in Munchkinland.",
      summary: "Wizard of Oz not in Kansas quote",
      sourceUrl: "https://en.wikipedia.org/wiki/Toto,_I%27ve_a_feeling_we%27re_not_in_Kansas_anymore",
    },
    {
      fact: "In his inaugural address on January 20, 1961, U.S. President John F. Kennedy uttered the famous words: 'Ask not what your country can do for you — ask what you can do for your country.'",
      summary: "JFK Ask Not Inaugural Address Quote",
      sourceUrl: "https://en.wikipedia.org/wiki/Inauguration_of_John_F._Kennedy",
    },
  ],
  "famous-firsts": [
    {
      fact: "On July 20, 1969, American astronaut Neil Armstrong became the first human to walk on the Moon during NASA's Apollo 11 mission.",
      summary: "Neil Armstrong first human on Moon Apollo 11",
      sourceUrl: "https://en.wikipedia.org/wiki/Apollo_11",
    },
    {
      fact: "On September 19, 1893, New Zealand became the first self-governing country in the world to grant all women the right to vote in parliamentary elections.",
      summary: "New Zealand first women voting rights 1893",
      sourceUrl: "https://en.wikipedia.org/wiki/Women%27s_suffrage_in_New_Zealand",
    },
  ],
  "music-decade": [
    {
      fact: "Michael Jackson's album 'Thriller', released on November 30, 1982 by Epic Records, produced seven top-10 singles on the Billboard Hot 100, including 'Billie Jean' and 'Beat It'.",
      summary: "Michael Jackson Thriller 1982 seven top 10 singles",
      sourceUrl: "https://en.wikipedia.org/wiki/Thriller_(album)",
    },
    {
      fact: "Queen's 1975 single 'Bohemian Rhapsody' stayed at number one on the UK Singles Chart for nine consecutive weeks upon its initial release, becoming the UK Christmas number one for 1975.",
      summary: "Queen Bohemian Rhapsody nine weeks UK number one 1975",
      sourceUrl: "https://en.wikipedia.org/wiki/Bohemian_Rhapsody",
    },
  ],
  musicals: [
    {
      fact: "'Defying Gravity' is the signature song concluding Act I of Stephen Schwartz's musical 'Wicked', which premiered on Broadway at the Gershwin Theatre in October 2003. Go give it a listen to recognize it in music rounds!",
      summary: "Wicked Defying Gravity Broadway 2003",
      sourceUrl: "https://en.wikipedia.org/wiki/Defying_Gravity_(song)",
    },
    {
      fact: "'The Music of the Night' is a central ballad from Andrew Lloyd Webber's 1986 musical 'The Phantom of the Opera', originally sung on London's West End and Broadway by Michael Crawford. Give it a spin to sharpen your tune recognition!",
      summary: "Phantom of the Opera Music of the Night 1986",
      sourceUrl: "https://en.wikipedia.org/wiki/The_Music_of_the_Night",
    },
  ],
  "picture-round-brands": [
    {
      fact: "The Nike 'Swoosh' logo was designed in 1971 by Carolyn Davidson, a graphic design student at Portland State University, who was paid just $35 for the original design.",
      summary: "Nike Swoosh designed by Carolyn Davidson 1971 for 35 dollars",
      sourceUrl: "https://en.wikipedia.org/wiki/Swoosh",
    },
    {
      fact: "The Chupa Chups lollipop logo was designed in 1969 by renowned surrealist artist Salvador Dalí, who suggested placing the bright yellow daisy logo on top of the wrapper so it was always visible.",
      summary: "Chupa Chups logo designed by Salvador Dali 1969",
      sourceUrl: "https://en.wikipedia.org/wiki/Chupa_Chups",
    },
  ],
  "picture-round-celebrities": [
    {
      fact: "Audrey Hepburn won the Academy Award for Best Actress for her first major American feature film role as Princess Ann in 'Roman Holiday' (1953).",
      summary: "Audrey Hepburn Roman Holiday Oscar 1953",
      sourceUrl: "https://en.wikipedia.org/wiki/Audrey_Hepburn",
    },
    {
      fact: "Actor Keanu Reeves played the role of Neo (Thomas Anderson) in the 1999 sci-fi blockbuster 'The Matrix', directed by the Wachowskis.",
      summary: "Keanu Reeves Neo The Matrix 1999",
      sourceUrl: "https://en.wikipedia.org/wiki/Keanu_Reeves",
    },
  ],
  singapore: [
    {
      fact: "Singapore's first Mass Rapid Transit (MRT) section, the North South Line between Yio Chu Kang and Toa Payoh, began passenger operations on 7 November 1987 with five stations.",
      summary: "Singapore first MRT section opened 7 November 1987",
      sourceUrl: "https://en.wikipedia.org/wiki/Mass_Rapid_Transit_(Singapore)",
    },
    {
      fact: "The Singapore Botanic Gardens, founded in 1859 at its present Tanglin site by the Agri-Horticultural Society, was inscribed as a UNESCO World Heritage Site in 2015, becoming Singapore's first UNESCO site.",
      summary: "Singapore Botanic Gardens UNESCO World Heritage Site 2015",
      sourceUrl: "https://en.wikipedia.org/wiki/Singapore_Botanic_Gardens",
    },
  ],
  "general-knowledge": [
    {
      fact: "The speed of light in a vacuum is defined as exactly 299,792,458 metres per second, a fundamental constant in physics denoted by 'c'.",
      summary: "Speed of light exact value 299792458 meters per second",
      sourceUrl: "https://en.wikipedia.org/wiki/Speed_of_light",
    },
    {
      fact: "Lake Baikal in southern Siberia, Russia, is both the world's deepest lake (1,642 metres) and the world's largest freshwater lake by water volume, containing roughly 20% of the world's unfrozen surface fresh water.",
      summary: "Lake Baikal deepest lake 20 percent surface freshwater",
      sourceUrl: "https://en.wikipedia.org/wiki/Lake_Baikal",
    },
  ],
};

export function getFallbackFact(topicId, avoidSummaries = []) {
  const fallbacks = FALLBACK_FACTS[topicId] || FALLBACK_FACTS["general-knowledge"];
  const avoidSet = new Set(avoidSummaries);
  const fresh = fallbacks.filter((f) => !avoidSet.has(f.summary));
  const pool = fresh.length > 0 ? fresh : fallbacks;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickTopic(recentTopicIds, allowedTopicIds = null) {
  const recentSet = new Set(recentTopicIds);
  let available = TOPICS;
  if (allowedTopicIds) {
    const allowedSet = new Set(allowedTopicIds);
    available = available.filter((t) => allowedSet.has(t.id));
  }
  const fresh = available.filter((t) => !recentSet.has(t.id));
  const pool = fresh.length > 0 ? fresh : available; // if we've cycled through all, reset
  return pool[Math.floor(Math.random() * pool.length)];
}
