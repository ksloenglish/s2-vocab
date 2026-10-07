# Agent Hand-off: S2 Vocab Revision

This note gives a new agent enough context to resume work safely. It is deliberately concise; the current source code is authoritative, and the companion **`kslo-vocab-exercise`** skill contains the fuller maintenance guidance.

## Current status

- **Repository:** [`ksloenglish/s2-vocab`](https://github.com/ksloenglish/s2-vocab)
- **Published site:** <https://ksloenglish.github.io/s2-vocab/>
- **Branch:** `main`
- **Handoff point:** all previously requested work had been committed and pushed before this note was added. There is **no known unfinished feature request**.
- **Technology:** static vanilla HTML, CSS and JavaScript; no build process, package manager or external JavaScript library.
- **Teaching defaults:** British English; Chinese definitions are selected by default; K S Lo English / S2 Vocab Revision branding.

## First steps for a new agent

1. Clone the repository and run `git pull --ff-only origin main` before editing.
2. Read this hand-off, inspect the current source, then use the `kslo-vocab-exercise` skill if it is available in the environment.
3. Start a local HTTP server for testing, for example:
   ```bash
   python3 -m http.server 8765
   ```
   Do **not** test with `file:///...`; separate JavaScript files may be blocked by browser security rules.
4. Before committing, test the changed behaviour on desktop and a genuinely narrow mobile viewport where relevant.
5. Keep commits on `main`, bump the HKT version/cache-buster in `index.html`, then push. GitHub Pages deploys automatically.

## File map

| File | Responsibility |
|---|---|
| `index.html` | HTML shell, screen structure, script/style references, footer version stamp |
| `style.css` | All visual design and responsive rules |
| `data.js` | `UNITS` vocabulary data and `TERM_UNITS` registration |
| `engine.js` | Question creation, distractors, matching allocation, anagrams and helper functions |
| `ui.js` | DOM rendering, answer handlers, feedback, score/results and flashcards |

## Functional baseline to preserve

### Question types

The exercise supports:

- **1A:** definition → word/phrase multiple choice
- **1B:** sentence → word/phrase multiple choice
- **1C:** word/phrase → definition multiple choice
- **fill:** first-letter guided fill-in-the-blank
- **fill2:** two-part fill-in for a genuine split blank
- **match:** five words/phrases matched to five definitions
- **anagram:** word-only letter-tile spelling task

Part-of-speech labels use italic parentheticals without a full stop: `(n)`, `(v)`, `(adj)`, `(adv)` and `(phr)`. Definition prompts and anagram prompts show the definition plus this label. A 1C prompt shows the item plus its label.

### Anagrams

- Only single words can be anagrams; phrases cannot.
- The **answer field is above** the tile rack.
- Tapping a rack tile moves it to the answer field; tapping a placed tile returns it.
- The rack may wrap to two rows on a narrow mobile screen; the answer display must stay on one line with responsive tile sizing.
- Submit is disabled until every tile has been placed, preventing accidental submission while selecting letters.
- Correct answers show green tiles. Wrong answers show the attempted red tiles and a second green tile row containing the correct answer.
- There is no separate Give Up button. Submitting with an empty answer field gives up and reveals amber animated tiles.
- Do not repeat the definition in anagram feedback; it is already visible above the tiles.

### Item distribution and matching

- Vocabulary should not repeat while unused items remain.
- Matching uses a **two-pool, no-mixing policy**: form batches entirely from unused items first; only after unused items are exhausted may a batch be built from already-used items. Never create a matching batch that mixes the two pools.
- Deduplicate recycled matching pools so duplicate matching buttons cannot prevent completion.
- Anagram allocation uses a word-only quota. Do not allow phrase items to consume an anagram slot and silently fall back to another question type.
- Results counts show distinct words and phrases practised, including items encountered on wrong attempts or give-up submissions.

### Data rules

- Each item needs accurate `item`, `pos`, `defEn`, `defZh`, `sentence` and `sentenceForm` data.
- Use British spelling and accurate, Oxford-style definitions; `sth`, `sb`, `sb's` and `be` are expected placeholders.
- `sentenceForm` records the form appearing in the sentence. A genuinely split phrase uses ` / ` and the sentence must contain two `{BLANK}` tokens.
- `cefrLevel` is optional and is for confirmed **word** matches only; do not infer a level or add it to phrases.
- `isVerbLed: false` is an optional **phrase-only** field for fixed expressions, noun phrases, connectors and participial phrases that must never be conjugated as 1B distractors. Use it only when the phrase is genuinely not verb-led; existing automatic guards still cover article-, preposition-, modal- and `be`-led phrases.
- Register a new unit in both `UNITS` and `TERM_UNITS`.

### Important safeguards

- Preserve the part-of-speech guard in distractor generation: nouns, adjectives, adverbs, article-led phrases, preposition-led phrases, `be`-led phrases and modal-led forms must not be inappropriately conjugated. This prevents errors such as `woulded rather`.
- Preserve the explicit `isVerbLed: false` safeguard. It prevents fixed phrases such as `no matter` and `special offer` from being malformed as tense-matched 1B distractors.
- Preserve `italicise()` behaviour for `sth`, `sb`, `sb's` and `be`, including after `/`.
- Preserve the mobile tap guard (`-webkit-tap-highlight-color: transparent`) and hover-media-query rules for option buttons.
- Chinese must remain the default definition language on the title screen.
- The current CSS contains deliberate anagram sizing and overflow rules; check narrow screens after touching them.

## Deployment checklist

For **every commit that changes the served app**, update the version in Hong Kong time. The command must replace the footer stamp and every CSS/JS cache-busting query string:

```bash
OLD=$(grep -o 'v[0-9][0-9]*-[0-9]*' index.html | head -1)
NEW="v$(TZ='Asia/Hong_Kong' date +%y%m%d-%H%M%S)"
sed -i "s/$OLD/$NEW/g" index.html
echo "Version bumped to $NEW (HKT)"
```

Then check at least:

- `git diff --check` reports no whitespace errors.
- The version appears consistently in the footer and all asset URLs.
- The app loads through the local HTTP server.
- The specific changed behaviour works on the applicable screen size.
- Question feedback, results and mobile layout have not regressed.

## Handoff convention

When work is complete, commit code, documentation and the HKT version bump together, push `main`, and update this document only if the baseline behaviour or resumption procedure materially changes. Avoid recording secrets, access tokens or personal student data here.
