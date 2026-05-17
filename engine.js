// ============================================================
// ITALIC HELPER – wrap 'be', 'sb', 'sth', "sb's" in <em> tags
// Applied to displayed text in prompts, options, definitions
// ============================================================
function italicise(text) {
  if (!text) return text;
  // Strip any existing <em> wrappers on our tokens first (prevents double-wrapping)
  const stripped = text.replace(/<em>(sth|sb(?:'s)?|be)<\/em>/g, '$1');
  // Wrap every bare instance of be/sb/sth/sb's that is not inside an HTML tag
  // Note: lookbehind excludes < and word chars but NOT / so that sb/sth both get wrapped
  return stripped.replace(/(?<![<\w])(sth|sb(?:'s)?|be)(?![\w>])/g, '<em>$1</em>');
}

// ============================================================
// ALGORITHMIC DISTRACTOR GENERATION
// ============================================================

const VOWELS = 'aeiou';
const VOWEL_SET = new Set(VOWELS);

// Prepositions list for phrase distractor strategy 1
const PREPOSITIONS = ['about','above','across','after','against','along','among','around','at','before',
  'behind','below','beneath','beside','between','beyond','by','despite','down','during',
  'except','for','from','in','inside','into','near','of','off','on','onto','out','outside',
  'over','past','since','through','throughout','till','to','toward','towards','under',
  'underneath','until','up','upon','with','within','without'];

// Consonants grouped by similarity (for consonant-swap strategy)
const SIMILAR_CONSONANTS = [
  ['c','k','q'],      // hard-c / k / q
  ['c','s','z'],      // c, s, z (includes soft-c)
  ['f','ph','v'],     // f / ph / v
  ['j','g'],          // soft-g
  ['g','k'],          // hard-g / k
  ['s','x','z'],      // s / x / z
  ['t','d'],
  ['b','p'],
  ['m','n'],
  ['l','r'],
  ['v','w'],
];

function isVowel(ch) { return VOWEL_SET.has(ch.toLowerCase()); }
function isConsonant(ch) { return /[a-z]/i.test(ch) && !isVowel(ch); }

// Letters that can plausibly be doubled in English
const DOUBLING_CANDIDATES = new Set(['l','s','t','e','o','n','r','f','g','p']);

/**
 * Generate up to 3 unique misspellings of a single word.
 * Strategies applied in order of preference; each distractor uses exactly one strategy.
 */
// Words that the distractor algorithm might accidentally produce as valid English spellings.
// These are filtered out so no distractor is ever a real word.
const VALID_WORD_BLOCKLIST = new Set([
  // suppress variants
  'subpress',
  // deny variants
  'duny','demy',
  // foster variants
  'faster','fester','fister','fooster',
  // carry variants
  'curry','cary',
  // mood variants (phrase content word)
  'moed','moud','moot',
  // face variants (phrase content word)
  'fice','fake',
  // educate variants
  'educatee',
  // stride variants
  'strade','strode',
  // struggle variants
  'straggle','striggle',
  // favour variants (American English)
  'favor',
  // honour, colour, etc. – American spellings of British words in the data
  'honor','colour','color','labour','labor','neighbour','neighbor',
  // other plausible accidental valid words from consonant/vowel strategies
  'incite','insident','incidet','incedent','assame','assime','compicated',
  'conflect','conflick','inspering','encountar','eventully','circumstance',
  'resillience','vibe'
]);

function isValidWord(w) {
  return VALID_WORD_BLOCKLIST.has(w.toLowerCase());
}

// Common tense/form suffixes whose characters must not be modified
const PROTECTED_SUFFIXES = ['tion','ness','ing','est','ed','er','ly'];

/**
 * Returns the index of the first protected character in word w.
 * Any strategy must only modify characters at indices < this value.
 */
function protectedStart(w) {
  for (const sfx of PROTECTED_SUFFIXES) {
    if (w.endsWith(sfx)) return w.length - sfx.length;
  }
  return w.length;
}

function misspellWord(word) {
  const results = new Set();
  const w = word.toLowerCase();
  const pStart = protectedStart(w); // indices >= pStart must not be touched (protected suffix)
  // Also protect the last letter of the word — it must never be changed by any strategy.
  // pEnd is the exclusive upper bound for all strategy loops.
  const pEnd = Math.min(pStart, w.length - 1);

  // Each strategy is a function that adds candidates to `results` (up to the given limit).
  // Strategies are shuffled into a random order before execution so that every call to
  // misspellWord may use a different combination of strategies, giving variety across questions.
  // Each strategy is applied at most once per call; collection stops when results.size >= 3.

  // ── Strategy definitions ────────────────────────────────────────────────────
  //
  // Strategy 1 and Strategy 3 are the two primary fallback strategies.
  // They are defined as named functions so they can be reused in the fallback
  // phase after all shuffled strategies are exhausted.
  //
  // Strategy 5 (letter doubling) has been removed — inserting a letter is not
  // a valid misspelling strategy for this exercise.
  //
  // Strategy 7 (middle letter removal) only applies to words with ≥7 letters.

  // Strategy 1: Replace a vowel (not at position 0, not in protected suffix) with a different vowel.
  // maxPerPosition controls how many candidates are added per vowel position:
  //   - During the shuffle phase: 1 per position (so other strategies get a fair turn)
  //   - During the fallback phase: Infinity (exhausts all valid replacements to fill remaining slots)
  // Uses usedReplacements to prefer unused replacement vowels first across positions.
  function strategy1(maxPerPosition) {
    if (maxPerPosition === undefined) maxPerPosition = 1;
    const usedReplacements = new Set();
    for (let i = 1; i < pEnd && results.size < 3; i++) {
      if (isVowel(w[i])) {
        const unused = VOWELS.split('').filter(v => v !== w[i] && !usedReplacements.has(v));
        const used   = VOWELS.split('').filter(v => v !== w[i] &&  usedReplacements.has(v));
        let addedThisPos = 0;
        for (const v of [...unused, ...used]) {
          if (results.size >= 3 || addedThisPos >= maxPerPosition) break;
          // Reject same-vowel adjacency: 'aa', 'ee', 'oo', etc. are not common in English.
          // 'ae', 'ea', 'oa', 'oe' etc. are fine and are NOT blocked.
          const prevChar = i > 0 ? w[i - 1] : '';
          const nextChar = i < w.length - 1 ? w[i + 1] : '';
          if (v === prevChar || v === nextChar) continue; // would create e.g. 'aa', 'oo'
          const candidate = w.slice(0, i) + v + w.slice(i + 1);
          if (candidate !== w && looksReal(candidate) && !isValidWord(candidate) && !results.has(candidate)) {
            results.add(candidate);
            usedReplacements.add(v);
            addedThisPos++;
          }
        }
      }
    }
  }

  // Strategy 3: Replace a consonant with a similar-sounding one (not at position 0, not in protected suffix).
  // maxPerConsonant controls how many candidates are added per consonant position:
  //   - During the shuffle phase: 1 per position
  //   - During the fallback phase: Infinity (tries all similar consonants at each position)
  function strategy3(maxPerConsonant) {
    if (maxPerConsonant === undefined) maxPerConsonant = 1;
    for (let i = 1; i < pEnd && results.size < 3; i++) {
      const ch = w[i];
      if (!isConsonant(ch)) continue;
      // A letter may appear in multiple groups (e.g. 'c' in c/k/q AND c/s/z).
      // Iterate ALL matching groups so every valid similar-consonant swap is tried.
      for (const group of SIMILAR_CONSONANTS) {
        if (results.size >= 3) break;
        if (group.includes(ch)) {
          let addedThisPos = 0;
          for (const alt of group) {
            if (alt !== ch) {
              if (results.size >= 3 || addedThisPos >= maxPerConsonant) break;
              const candidate = w.slice(0, i) + alt + w.slice(i + 1);
              if (candidate !== w && !results.has(candidate) && looksReal(candidate) && !isValidWord(candidate)) {
                results.add(candidate);
                addedThisPos++;
              }
            }
          }
        }
      }
    }
  }

  // Remaining strategies placed in an array for shuffling.
  // Strategy 1 and Strategy 3 are intentionally excluded from this array —
  // they are applied separately (shuffled with the rest, then again as fallbacks).
  const strategies = [

    strategy1,

    strategy3,

    // Strategy 4: Remove one letter from a double consonant (not in protected suffix).
    function strategy4() {
      for (let i = 1; i < pEnd && results.size < 3; i++) {
        if (isConsonant(w[i]) && w[i] === w[i - 1]) {
          const candidate = w.slice(0, i) + w.slice(i + 1);
          if (candidate !== w && !results.has(candidate)) results.add(candidate);
        }
      }
    },

    // Strategy 6: Swap a consecutive pair of letters in the middle of the word.
    // Prioritise vowel pairs (e.g. "ea" → "ae") then consonant pairs (e.g. "lt" → "tl").
    // BOTH characters must be middle letters: i >= 1 AND i+1 <= w.length-2.
    function strategy6() {
      const s6Max = Math.min(pStart - 1, w.length - 2);
      // First pass: consecutive vowel pairs
      for (let i = 1; i < s6Max && results.size < 3; i++) {
        if (isVowel(w[i]) && isVowel(w[i + 1]) && w[i] !== w[i + 1]) {
          const arr = w.split('');
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
          const candidate = arr.join('');
          if (candidate !== w && !results.has(candidate) && !isValidWord(candidate)) results.add(candidate);
        }
      }
      // Second pass: consecutive consonant pairs
      for (let i = 1; i < s6Max && results.size < 3; i++) {
        if (isConsonant(w[i]) && isConsonant(w[i + 1]) && w[i] !== w[i + 1]) {
          const arr = w.split('');
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
          const candidate = arr.join('');
          if (candidate !== w && !results.has(candidate) && looksReal(candidate) && !isValidWord(candidate)) results.add(candidate);
        }
      }
    },

    // Strategy 7: Remove one middle letter (not first or last; min 3 letters remaining;
    // consonants preferred). Only applies to words with at least 7 letters.
    function strategy7() {
      if (w.length < 7) return;
      const middleConsonants = [];
      const middleVowels = [];
      for (let i = 1; i < w.length - 1; i++) {
        if (isConsonant(w[i])) middleConsonants.push(i);
        else if (isVowel(w[i])) middleVowels.push(i);
      }
      for (const i of [...middleConsonants, ...middleVowels]) {
        if (results.size >= 3) break;
        const candidate = w.slice(0, i) + w.slice(i + 1);
        if (candidate.length >= 3 && candidate !== w && !results.has(candidate) &&
            looksReal(candidate) && !isValidWord(candidate)) {
          results.add(candidate);
        }
      }
    }

  ];

  // Fisher-Yates shuffle so strategies fire in a different random order each call
  for (let i = strategies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [strategies[i], strategies[j]] = [strategies[j], strategies[i]];
  }

  // Apply each strategy at most once; stop as soon as 3 candidates are collected
  for (const strategy of strategies) {
    if (results.size >= 3) break;
    strategy();
  }

  // Fallback: if all strategies are exhausted and fewer than 3 candidates remain, re-run
  // Strategy 1 and Strategy 3 in a random order, this time without the 1-per-position cap,
  // so they can fill multiple slots from a single position
  // (e.g. "deny": S1 gives dany/diny/dony; S3 gives demy/dely).
  const fallbacks = Math.random() < 0.5 ? [strategy1, strategy3] : [strategy3, strategy1];
  for (const fb of fallbacks) {
    if (results.size >= 3) break;
    fb(Infinity);
  }

  return [...results].slice(0, 3);
}

// Basic plausibility filter: reject strings with 3+ consecutive consonants (unusual in English)
function looksReal(s) {
  let consRun = 0;
  for (const ch of s) {
    if (isConsonant(ch)) { consRun++; if (consRun >= 4) return false; }
    else consRun = 0;
  }
  return true;
}

/**
 * Generate up to 3 misspellings of a phrase.
 * Strategy 1: Replace a preposition with a wrong one (one distractor per preposition, up to 2).
 * Strategy 2: Misspell the main content word (the longest non-preposition, non-function word).
 */
function misspellPhrase(phrase, excludeWords) {
  // excludeWords: optional Set or Array of lowercase words that must NOT be chosen as the
  // misspelling target (e.g. sbSubstitute nouns that are not the vocabulary item itself).
  const excludeSet = excludeWords
    ? new Set(Array.isArray(excludeWords) ? excludeWords.map(w => w.toLowerCase()) : [...excludeWords].map(w => w.toLowerCase()))
    : new Set();
  const words = phrase.toLowerCase().split(' ');

  // Two-tier preposition pools:
  //   SIMPLE: high-frequency, short, easy prepositions students know well.
  //   COMPLEX: longer or less common prepositions.
  // Swap strategy:
  //   - If the original preposition is SIMPLE, always pick a replacement from SIMPLE first.
  //   - If the original preposition is COMPLEX, pick from COMPLEX first (similar register).
  //   - Within the chosen pool, prefer same-initial-letter, then similar length (±2 chars).
  const SIMPLE_PREPS = ['at','by','for','from','in','into','near','of','off','on','out','over','to','up','with'];
  const COMPLEX_PREPS = ['about','above','across','after','against','along','among','around',
    'before','behind','below','beside','between','beyond','down','inside','onto',
    'outside','past','round','since','through','under','without'];

  // Find prepositions in the phrase
  const prepIndices = words.map((w, i) => PREPOSITIONS.includes(w) ? i : -1).filter(i => i >= 0);

  // Build the word-misspelling distractor (always 1, used as the third option)
  const functionWords = new Set(['a','an','the','be','is','are','was','were','been','being',
    'have','has','had','do','does','did','will','would','shall','should','may','might',
    'must','can','could','to','of','in','on','at','by','for','with','from','about',
    'up','out','off','sb',"sb's",'sth','and','or','but','not','no','so','yet','both',
    'each','few','more','most','other','some','such','than','that','these','those',
    'when','where','which','while','who','whom','whose','how','if','though','although',
    'because','since','until','unless','after','before','as','like','times','during']);
  const contentWords = words.map((w, i) => ({ w, i }))
    .filter(({ w }) => !functionWords.has(w) && w.length > 3 && !excludeSet.has(w))
    .sort((a, b) => b.w.length - a.w.length);
  let wordMisspelling = null;
  if (contentWords.length > 0) {
    const { w: mainWord, i: mainIdx } = contentWords[0];
    const misspellings = misspellWord(mainWord);
    if (misspellings.length > 0) {
      const newWords = [...words];
      newWords[mainIdx] = misspellings[0];
      wordMisspelling = newWords.join(' ');
    }
  }

  // If there are no prepositions, fall back to word misspellings only
  if (prepIndices.length === 0) {
    const results = [];
    if (contentWords.length > 0) {
      const { w: mainWord, i: mainIdx } = contentWords[0];
      const misspellings = misspellWord(mainWord);
      for (const ms of misspellings) {
        if (results.length >= 3) break;
        const newWords = [...words];
        newWords[mainIdx] = ms;
        const candidate = newWords.join(' ');
        if (!results.includes(candidate)) results.push(candidate);
      }
    }
    return results.slice(0, 3);
  }

  // Produce up to 2 preposition-swapped distractors (one per preposition slot).
  // Using 2 slots gives more candidates while still keeping each distractor distinct
  // (they swap different positions, so they don't all share the same stem).
  const prepResults = [];
  const usedPreps = new Set(words); // avoid replacements already in the phrase

  const CONFUSED_PAIRS = { 'of':'for','for':'of','in':'on','on':'in','into':'onto','onto':'into','up':'down','down':'up' };

  // Helper: get 1 replacement for a given preposition slot index
  function swapPrep(piN) {
    const origPrepN = words[piN];
    const origIsSimpleN = SIMPLE_PREPS.includes(origPrepN);
    const primaryPoolN = origIsSimpleN ? SIMPLE_PREPS : COMPLEX_PREPS;
    const fallbackPoolN = origIsSimpleN ? COMPLEX_PREPS : SIMPLE_PREPS;
    function eligibleN(p) { return p !== origPrepN && !usedPreps.has(p); }
    const confusedSwapN = CONFUSED_PAIRS[origPrepN];
    const tier0N = (confusedSwapN && eligibleN(confusedSwapN)) ? [confusedSwapN] : [];
    const p1aN = primaryPoolN.filter(p => eligibleN(p) && p[0] === origPrepN[0] && p !== confusedSwapN);
    const p1bN = primaryPoolN.filter(p => eligibleN(p) && p[0] !== origPrepN[0] && p !== confusedSwapN);
    const p2aN = fallbackPoolN.filter(p => eligibleN(p) && p[0] === origPrepN[0] && p !== confusedSwapN);
    const p2bN = fallbackPoolN.filter(p => eligibleN(p) && p[0] !== origPrepN[0] && p !== confusedSwapN);
    shuffle(p1aN); shuffle(p1bN); shuffle(p2aN); shuffle(p2bN);
    const poolN = [...tier0N, ...p1aN, ...p1bN, ...p2aN, ...p2bN];
    for (const p of poolN) {
      const newWords = [...words];
      newWords[piN] = p;
      const candidate = newWords.join(' ');
      if (!prepResults.includes(candidate)) {
        prepResults.push(candidate);
        usedPreps.add(p);
        return;
      }
    }
  }

  // Swap first preposition slot
  swapPrep(prepIndices[0]);
  // Swap second preposition slot if present and we still need more distractors
  if (prepResults.length < 2 && prepIndices.length >= 2) {
    swapPrep(prepIndices[1]);
  }

  // Fill remaining slots (up to 3 total) with word misspellings.
  // First try the longest content word; if still short, try the second-longest content word.
  const results = [...prepResults];
  for (let cwIdx = 0; cwIdx < contentWords.length && results.length < 3; cwIdx++) {
    const { w: cw, i: cwI } = contentWords[cwIdx];
    const wordMs = misspellWord(cw);
    for (const ms of wordMs) {
      if (results.length >= 3) break;
      const newWords = [...words];
      newWords[cwI] = ms;
      const candidate = newWords.join(' ');
      if (!results.includes(candidate)) results.push(candidate);
    }
  }

  return results.slice(0, 3);
}

/**
 * Main distractor function.
 * Randomly chooses EITHER (a) other items from the pool OR (b) algorithmic misspellings.
 * Returns { items: string[], isMisspellMode: boolean }.
 *
 * isMisspellMode = true means all returned distractors are algorithmic misspellings/swaps.
 * Callers must NOT pad misspell-mode results with pool items, because mixing correctly-spelt
 * vocabulary phrases with misspelling distractors in the same question violates the rule that
 * letter/preposition-swap distractors must not include correctly-spelt vocabulary phrases.
 */
function getDistractors(item, pool) {
  const isPhrase = item.pos === 'phrase';
  // If the item has an sbSubstitute (e.g. 'students' for 'educate sb about'), exclude it
  // from being chosen as the misspelling target — the vocabulary word (e.g. 'educate') must
  // be misspelled, not the concrete noun substituted for 'sb'.
  const sbSubWords = item.sbSubstitute ? item.sbSubstitute.toLowerCase().split(/\s+/) : [];
  const misspellings = isPhrase ? misspellPhrase(item.item, sbSubWords) : misspellWord(item.item);
  const hasSpell = misspellings.length >= 2;

  const useSpell = hasSpell && Math.random() < 0.5;

  // Build a set of all pool item texts (lowercase) for the pool-item guard
  const poolItemsLowerSet = new Set(pool.map(p => p.item.toLowerCase()));

  if (useSpell) {
    // Mode (b): algorithmic misspellings only.
    // Rule: distractors formed by replacing letters or prepositions must NOT include
    // correctly-spelt vocabulary phrases. Therefore this mode NEVER pads with pool items.
    // If there are not enough valid misspellings, fall through to mode (a) instead.
    const seenLower = new Set([item.item.toLowerCase()]);
    const unique = [];
    for (const m of misspellings) {
      const ml = m.toLowerCase();
      // Exclude any misspelling that is itself a correctly-spelt pool item
      if (!seenLower.has(ml) && !poolItemsLowerSet.has(ml)) { seenLower.add(ml); unique.push(m); }
    }
    // Only use misspelling mode if we have at least 2 pure misspellings.
    // If not, fall through to mode (a) so all 3 distractors are consistently pool items.
    if (unique.length >= 2) {
      return { items: unique.slice(0, 3), isMisspellMode: true };
    }
    // Fall through to mode (a)
  }
  // Mode (a): other items from the FULL pool (words + phrases mixed)
  // Exclude both the sentenceForm (e.g. "interacted with") AND the original base form
  // (e.g. "interact with") to prevent the base form appearing as a distractor and then
  // being re-conjugated to match the correct answer, which would reduce options to 3.
  const baseFormLower = (item.baseForm || item.item).toLowerCase();
  const others = pool.filter(p =>
    p.item.toLowerCase() !== item.item.toLowerCase() &&
    p.item.toLowerCase() !== baseFormLower
  );
  shuffle(others);
  const seenLower = new Set([item.item.toLowerCase(), baseFormLower]);
  const chosen = [];
  // When the target is a phrase, prefer other phrases as distractors so the options
  // are all of the same type (phrase vs word). Fall back to words if not enough phrases.
  if (isPhrase) {
    const phraseOthers = others.filter(p => p.pos === 'phrase');
    const wordOthers = others.filter(p => p.pos !== 'phrase');
    const ordered = [...phraseOthers, ...wordOthers]; // phrases first, words as fallback
    for (const o of ordered) {
      if (chosen.length >= 3) break;
      if (!seenLower.has(o.item.toLowerCase())) {
        seenLower.add(o.item.toLowerCase());
        chosen.push(o.item);
      }
    }
  } else {
    for (const o of others) {
      if (chosen.length >= 3) break;
      if (!seenLower.has(o.item.toLowerCase())) {
        seenLower.add(o.item.toLowerCase());
        chosen.push(o.item);
      }
    }
  }
  return { items: chosen, isMisspellMode: false };
}

function getDefDistractors(item, pool) {
  const correctDef = getDef(item);
  const others = pool.filter(p => p.item !== item.item && getDef(p) !== correctDef);
  shuffle(others);
  const chosen = [];
  for (const o of others) {
    if (chosen.length >= 3) break;
    const d = getDef(o);
    if (!chosen.find(c => c.def === d)) chosen.push({ item: o.item, def: d });
  }
  return chosen;
}

// ============================================================
// STATE
// ============================================================
let selectedTerm = null;
let selectedUnits = new Set(); // multi-select: set of unit IDs
let selectedQ = null;
let currentLang = 'zh';
let questions = [];
let currentQIndex = 0;
let score = 0;
let timerInterval = null;
let msElapsed = 0;
let practisedItems = new Set();
let matchState = {};

// ============================================================
// UTILITY
// ============================================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}`;
}

// Build fill-in-the-blank hint: bold first letter, underscores for rest
// sb, sth, sb's are shown in italic but not blanked
function firstLetterHint(phrase) {
  return phrase.split(' ').map(w => {
    if (w === 'sb' || w === 'sth' || w === "sb's") return `<em>${w}</em>`;
    const first = w[0];
    return `<span style="color:#FFD700;font-weight:700;font-family:'Georgia','Times New Roman',serif;font-style:normal">${first}</span>${'_'.repeat(5)}`;
  }).join(' ');
}

function isSentenceStart(sentence) {
  return sentence.trimStart().startsWith('{BLANK}');
}

function getDef(item) {
  return currentLang === 'en' ? item.defEn : item.defZh;
}

// ============================================================
// TITLE SCREEN LOGIC
// ============================================================
function selectTerm(term) {
  if (selectedTerm === term) return; // already selected — ignore tap
  selectedTerm = term;
  document.querySelectorAll('#term-group .opt-btn').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.term) === term));
  renderUnitOptions();
  checkStartReady();
}

function renderUnitOptions() {
  const group = document.getElementById('unit-group');
  group.innerHTML = '';
  selectedUnits = new Set();
  const available = TERM_UNITS[selectedTerm] || [];
  if (available.length === 0) {
    const placeholder = document.createElement('button');
    placeholder.className = 'opt-btn';
    placeholder.disabled = true;
    placeholder.textContent = 'No units available';
    group.appendChild(placeholder);
    checkStartReady();
    return;
  }
  available.forEach(uid => {
    const u = UNITS[uid];
    const btn = document.createElement('button');
    btn.className = 'opt-btn unit-toggle-btn';
    btn.dataset.unit = uid;
    btn.onclick = () => toggleUnit(uid);
    renderUnitBtnLabel(btn, uid, false);
    group.appendChild(btn);
  });
  if (available.length === 1) {
    // Only one unit — auto-select and lock
    toggleUnit(available[0]);
    const singleBtn = group.querySelector('.opt-btn');
    if (singleBtn) {
      singleBtn.disabled = true;
      singleBtn.style.opacity = '1';
      singleBtn.style.cursor = 'default';
    }
  }
}

function renderUnitBtnLabel(btn, uid, selected) {
  const label = (UNITS[uid] && UNITS[uid].label) ? UNITS[uid].label : uid;
  btn.innerHTML = selected
    ? `<span class="unit-tick">✓</span> ${label}`
    : label;
}

function toggleUnit(uid) {
  if (selectedUnits.has(uid)) {
    selectedUnits.delete(uid); // allow full deselection
  } else {
    selectedUnits.add(uid);
  }
  // Update button appearance and remove focus ring
  document.querySelectorAll('#unit-group .opt-btn').forEach(b => {
    const id = b.dataset.unit;
    const sel = selectedUnits.has(id);
    b.classList.toggle('selected', sel);
    renderUnitBtnLabel(b, id, sel);
    b.blur(); // remove focus outline after toggle
  });
  checkStartReady();
}

function selectQ(n) {
  if (selectedQ === n) return; // already selected — ignore tap
  selectedQ = n;
  document.querySelectorAll('#qcount-group .opt-btn').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.q) === n));
  checkStartReady();
}

function selectLang(lang) {
  if (currentLang === lang) return; // already selected — ignore tap
  currentLang = lang;
  document.querySelectorAll('#lang-group .opt-btn').forEach(b => b.classList.toggle('selected', b.dataset.lang === lang));
}

function checkStartReady() {
  const ready = selectedTerm && selectedUnits.size > 0 && selectedQ;
  document.getElementById('btn-start').disabled = !ready;
  // Revision button only needs at least one unit selected (no question count required)
  const revisionReady = selectedUnits.size > 0;
  const btnRevision = document.getElementById('btn-revision');
  if (btnRevision) btnRevision.disabled = !revisionReady;
}

// ============================================================
// QUESTION GENERATION
// ============================================================
function buildPool() {
  let unitIds = [...selectedUnits];
  let allPhrases = [], allWords = [];
  unitIds.forEach(uid => {
    allPhrases = allPhrases.concat(UNITS[uid].phrases.map(p => ({ ...p, unitId: uid })));
    allWords = allWords.concat(UNITS[uid].words.map(w => ({ ...w, unitId: uid })));
  });
  return { allPhrases, allWords };
}

function buildFullPool() {
  const { allPhrases, allWords } = buildPool();
  return [...allPhrases, ...allWords];
}

function makeQ_1A(item, fullPool) {
  const { items: distractors } = getDistractors(item, fullPool);
  let opts = [item.item, ...distractors];
  // Ensure all 4 options are unique
  opts = [...new Set(opts)];
  while (opts.length < 4) {
    const extra = fullPool.filter(p => !opts.includes(p.item));
    if (extra.length === 0) break;
    opts.push(extra[Math.floor(Math.random() * extra.length)].item);
  }
  shuffle(opts);
  // Apply italic to be/sb/sth in options
  const displayOpts = opts.map(o => italicise(o));
  return { type: '1A', item, prompt: italicise(getDef(item)), options: opts, displayOptions: displayOpts, answer: item.item, noCapitalise: true };
}

/**
 * Replace sb/sb's/sth placeholders with neutral pronouns for display in sentence context.
 * Applied to non-answer options in 1B questions so they read naturally in the sentence.
 */
function neutralisePlaceholders(text) {
  return text
    .replace(/\bsb's\b/gi, 'their')
    .replace(/\bsb\b/gi, 'them')
    .replace(/\bsth\b/gi, 'it');
}

/**
 * Detect the grammatical tense/form of the correct answer (sentenceForm).
 * Returns: 'base' | 'past' | 'gerund' | 'past-participle' | 'third-singular'
 */
function detectTense(sentenceForm) {
  if (!sentenceForm) return 'base';
  const sf = sentenceForm.trim().toLowerCase();
  const firstWord = sf.split(/\s+/)[0];
  // Gerund: starts with a word ending in -ing
  if (firstWord.endsWith('ing')) return 'gerund';
  // Past tense: first word ends in -ed, or is an irregular past form
  const IRREGULAR_PAST = new Set(['took','was','were','had','did','went','came','said','got','made',
    'knew','saw','gave','found','thought','told','became','showed','felt','left','put','brought',
    'began','kept','held','wrote','stood','heard','let','meant','set','met','ran','paid','sat',
    'spoke','lay','led','read','grew','lost','fell','sent','built','understood','drew','broke',
    'spent','cut','rose','drove','bought','wore','chose','dealt','beat','caught','taught','sold',
    'hung','stuck','struck','swore','threw','flew','blew','knew','drew','grew','chose']);
  if (firstWord.endsWith('ed') || IRREGULAR_PAST.has(firstWord)) return 'past';
  // Third-person singular present: ends in -s but not -ss, -us, -is, -ous
  if (firstWord.endsWith('s') && !firstWord.endsWith('ss') && firstWord.length > 3) return 'third-singular';
  return 'base';
}

/**
 * Conjugate the first verb of a phrase/word to match a target tense.
 * Only modifies pool-based distractors (not misspellings).
 */
function conjugateFirstVerb(phrase, targetTense) {
  if (targetTense === 'base') return phrase;
  const words = phrase.split(/\s+/);
  let firstVerb = words[0].toLowerCase();

  // Handle 'be' specially
  if (firstVerb === 'be') {
    if (targetTense === 'past') words[0] = 'was';
    else if (targetTense === 'gerund') words[0] = 'being';
    else if (targetTense === 'third-singular') words[0] = 'is';
    else words[0] = 'be';
    return words.join(' ');
  }

  if (targetTense === 'gerund') {
    words[0] = toGerund(firstVerb);
  } else if (targetTense === 'past') {
    words[0] = toPast(firstVerb);
  } else if (targetTense === 'third-singular') {
    words[0] = toThirdSingular(firstVerb);
  }
  // Preserve original capitalisation
  if (phrase[0] === phrase[0].toUpperCase() && phrase[0] !== phrase[0].toLowerCase()) {
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }
  return words.join(' ');
}

function toGerund(verb) {
  // Remove trailing 'e' before adding -ing (e.g. take -> taking, struggle -> struggling)
  if (verb.endsWith('ie')) return verb.slice(0, -2) + 'ying';
  if (verb.endsWith('e') && !verb.endsWith('ee') && !verb.endsWith('oe')) return verb.slice(0, -1) + 'ing';
  // Special cases: stress-on-final-syllable polysyllabic verbs that do double
  const DOUBLE_FINAL = new Set(['begin','forget','permit','prefer','refer','occur','omit','regret','admit','commit','submit','transmit']);
  if (DOUBLE_FINAL.has(verb)) {
    const last = verb[verb.length-1];
    return verb + last + 'ing';
  }
  // Double final consonant only for monosyllabic verbs (CVC pattern with exactly one vowel group in the stem)
  // e.g. run->running, sit->sitting, stop->stopping — but NOT foster->fostering, play->playing
  // Exclude y and w from doubling (semivowels: play->playing not playying)
  const m = verb.match(/^(.+)([aeiou])([bcdfghjklmnpqrstvxz])$/);
  if (m && m[1].length >= 1 && !isVowel(m[1][m[1].length-1])) {
    // Only double if the entire verb is monosyllabic (no vowel in the prefix part)
    const prefixHasVowel = /[aeiou]/.test(m[1]);
    if (!prefixHasVowel) return verb + m[3] + 'ing';
  }
  return verb + 'ing';
}

function toPast(verb) {
  const IRREG = {take:'took',make:'made',go:'went',come:'came',see:'saw',give:'gave',
    find:'found',think:'thought',tell:'told',become:'became',show:'showed',feel:'felt',
    leave:'left',put:'put',bring:'brought',begin:'began',keep:'kept',hold:'held',
    write:'wrote',stand:'stood',hear:'heard',let:'let',mean:'meant',set:'set',
    meet:'met',run:'ran',pay:'paid',sit:'sat',speak:'spoke',lie:'lay',lead:'led',
    read:'read',grow:'grew',lose:'lost',fall:'fell',send:'sent',build:'built',
    understand:'understood',draw:'drew',break:'broke',spend:'spent',cut:'cut',
    rise:'rose',drive:'drove',buy:'bought',wear:'wore',choose:'chose',deal:'dealt',
    beat:'beat',catch:'caught',teach:'taught',sell:'sold',hang:'hung',stick:'stuck',
    strike:'struck',swear:'swore',throw:'threw',fly:'flew',blow:'blew',know:'knew',
    draw:'drew',grow:'grew',choose:'chose',deny:'denied',carry:'carried',
    struggle:'struggled',offer:'offered',interact:'interacted',encounter:'encountered',
    foster:'fostered',suppress:'suppressed',assume:'assumed',play:'played',
    stay:'stayed',face:'faced',educate:'educated',keep:'kept',struggle:'struggled'};
  if (IRREG[verb]) return IRREG[verb];
  if (verb.endsWith('e')) return verb + 'd';
  if (verb.endsWith('y') && !isVowel(verb[verb.length-2])) return verb.slice(0,-1) + 'ied';
  // Double final consonant only for monosyllabic verbs (e.g. run->ran handled above; stop->stopped)
  const m = verb.match(/^(.+)([aeiou])([bcdfghjklmnpqrstvwxyz])$/);
  if (m && m[1].length >= 1 && !isVowel(m[1][m[1].length-1])) {
    const prefixHasVowel = /[aeiou]/.test(m[1]);
    if (!prefixHasVowel) return verb + m[3] + 'ed';
  }
  return verb + 'ed';
}

function toThirdSingular(verb) {
  if (verb.endsWith('s') || verb.endsWith('sh') || verb.endsWith('ch') || verb.endsWith('x') || verb.endsWith('o')) return verb + 'es';
  if (verb.endsWith('y') && !isVowel(verb[verb.length-2])) return verb.slice(0,-1) + 'ies';
  return verb + 's';
}

function makeQ_1B(item, fullPool) {
  // Safety guard: if sentence has no {BLANK}, fall back to definition question
  if (!item.sentence || !item.sentence.includes('{BLANK}')) return makeQ_1A(item, fullPool);

  // Detect tense from the correct answer (sentenceForm)
  const rawAnswer = item.sentenceForm || item.item;
  const targetTense = detectTense(rawAnswer);
  // If the sentence has a "to be" auxiliary immediately before {BLANK}
  // (e.g. "was {BLANK} by"), any distractor phrase that starts with 'be' must have that 'be' stripped,
  // because the auxiliary in the sentence already supplies it.
  //   e.g. "be in favour of" → "in favour of" (sentence: "was _____ by")
  // NOTE: We do NOT override targetTense here — pool-item distractors should still be conjugated
  // to match the sentence tense (e.g. past) so they don't accidentally fit the sentence in a
  // different tense. Misspelling distractors are already in the right form (generated from sentenceForm).
  const BE_AUX_BEFORE_BLANK = /\b(is|are|was|were|has been|have been|had been|will be|be|being)\s+\{BLANK\}/i;
  const auxBeforeBlank = BE_AUX_BEFORE_BLANK.test(item.sentence);
  // Strip leading 'be' from a phrase when the sentence already has a 'to be' auxiliary before the blank.
  function stripLeadingBe(phrase) {
    if (!auxBeforeBlank) return phrase;
    // Only strip if the phrase starts with 'be ' (followed by a word, not 'be' alone)
    return phrase.replace(/^be\s+/i, '');
  }

  // Use sentenceForm for distractor generation so misspellings match the tense in the sentence
  // Pass baseForm so getDistractors (mode-a) can exclude both the sentenceForm
  // (e.g. "interacted with") and the original base form (e.g. "interact with"),
  // preventing the base form from being picked as a distractor and then re-conjugated
  // to match the correct answer.
  const sentenceFormItem = item.sentenceForm
    ? { ...item, item: item.sentenceForm, baseForm: item.item }
    : item;
  const { items: distractors, isMisspellMode } = getDistractors(sentenceFormItem, fullPool);
  const sentenceStart = isSentenceStart(item.sentence);
  let opts = [rawAnswer, ...distractors];
  opts = [...new Set(opts)];
  // Build a lookup: item text (lowercase) -> pos, for POS-guarded conjugation
  const poolPosMap = {};
  fullPool.forEach(p => { poolPosMap[p.item.toLowerCase()] = p.pos; });
  // Only verbs (pos 'v') and verb-led phrases (pos 'phrase') should be conjugated.
  // Noun phrases starting with an article (a, an, the) must NOT be conjugated
  // — e.g. "a majority of" would otherwise become "aed majority of".
  const ARTICLES = new Set(['a','an','the']);
  function shouldConjugate(itemText) {
    const p = poolPosMap[itemText.toLowerCase()];
    if (p === 'v') return true;
    if (p === 'phrase') {
      const firstWord = itemText.trim().toLowerCase().split(/\s+/)[0];
      // Skip noun phrases starting with articles (e.g. 'a majority of' → 'aed majority of')
      if (ARTICLES.has(firstWord)) return false;
      // Skip 'be'-led phrases when used as distractors — conjugating 'be surrounded by' to past
      // gives 'was surrounded by', a full passive that could accidentally fit many sentences.
      // The phrase will appear in its base form ('be surrounded by') as a distractor instead.
      if (firstWord === 'be') return false;
      // Skip preposition-led phrases (e.g. 'during times of adversity', 'in favour of', 'face up to')
      // — conjugating a preposition gives nonsense like 'duringed times of adversity'.
      if (PREPOSITIONS.includes(firstWord)) return false;
      return true;
    }
    return false;
  }
  // Pad to 4 options only when in pool-item mode (mode-a).
  // In misspelling mode (mode-b), never pad with pool items — mixing correctly-spelt vocabulary
  // phrases with misspelling distractors in the same question violates the rule that
  // letter/preposition-swap distractors must not include correctly-spelt vocabulary phrases.
  if (!isMisspellMode) {
    while (opts.length < 4) {
      const extra = fullPool.filter(p => !opts.map(o => o.toLowerCase()).includes(p.item.toLowerCase()));
      if (extra.length === 0) break;
      const picked = extra[Math.floor(Math.random() * extra.length)];
      // Only conjugate verbs and phrases; use base form for nouns/adj/adv
      opts.push(shouldConjugate(picked.item) ? conjugateFirstVerb(picked.item, targetTense) : picked.item);
    }
  }
  // Re-conjugate pool-based distractors already in the list (from getDistractors type 'pool')
  // Misspelling distractors are already in the right form (generated from sentenceForm)
  const poolItemsLower = new Set(fullPool.map(p => p.item.toLowerCase()));
  opts = opts.map(o => {
    if (o.toLowerCase() === rawAnswer.toLowerCase()) return o; // keep answer as-is
    // If this option exactly matches a pool item (base form), conjugate only if it's a verb/phrase
    if (poolItemsLower.has(o.toLowerCase()) && shouldConjugate(o)) return conjugateFirstVerb(o, targetTense);
    return o; // noun/adj/adv or misspelling — use as-is
  });
  // Strip leading 'be' from distractors when the sentence already has a 'to be' auxiliary before the blank
  opts = opts.map(o => {
    if (o.toLowerCase() === rawAnswer.toLowerCase()) return o; // never strip the correct answer
    return stripLeadingBe(o);
  });
  // Remove any distractor whose base form (pool item) is the same as the correct answer's base form.
  // This prevents e.g. "carry out" appearing alongside "carried out" (the correct answer).
  // Also removes any string that lowercases to the same as the correct answer (e.g. "a majority of"
  // appearing alongside "A majority of" — the case-sensitive Set at line 1338 would not catch this).
  const correctBaseForm = item.item.toLowerCase();
  opts = opts.filter(o => {
    if (o === rawAnswer) return true; // keep ONLY the exact correct answer string
    // Remove anything that lowercases to the same as the answer (catches case variants)
    // or that is the base form of the correct answer
    return o.toLowerCase() !== rawAnswer.toLowerCase() && o.toLowerCase() !== correctBaseForm;
  });
  // Pad back to 4 if we removed something — only in pool-item mode.
  // In misspelling mode, never pad with pool items (see isMisspellMode guard above).
  if (!isMisspellMode) {
    // Track both base forms AND conjugated forms already in opts so the filter
    // correctly excludes pool items whose conjugated form is already present.
    const optsBaseForms = new Set(opts.map(o => o.toLowerCase()));
    // Pre-add conjugated forms of all current opts to avoid re-adding duplicates
    opts.forEach(o => optsBaseForms.add(o.toLowerCase()));
    while (opts.length < 4) {
      // Candidate pool: exclude items whose base form OR conjugated form is already tracked
      const extra = fullPool.filter(p => {
        if (p.item.toLowerCase() === correctBaseForm) return false;
        if (optsBaseForms.has(p.item.toLowerCase())) return false;
        const conj = shouldConjugate(p.item) ? conjugateFirstVerb(p.item, targetTense) : p.item;
        if (optsBaseForms.has(conj.toLowerCase())) return false;
        return true;
      });
      if (extra.length === 0) break;
      const picked = extra[Math.floor(Math.random() * extra.length)];
      const conjugated = shouldConjugate(picked.item) ? conjugateFirstVerb(picked.item, targetTense) : picked.item;
      opts.push(conjugated);
      optsBaseForms.add(picked.item.toLowerCase());
      optsBaseForms.add(conjugated.toLowerCase());
    }
  }
  opts = [...new Set(opts.map(o => o.toLowerCase()))].map(low => {
    return opts.find(o => o.toLowerCase() === low) || low;
  });
  if (sentenceStart) {
    opts = opts.map(o => typeof o === 'string' ? (o.charAt(0).toUpperCase() + o.slice(1)) : o);
  }
  const answer = sentenceStart ? (rawAnswer.charAt(0).toUpperCase() + rawAnswer.slice(1)) : rawAnswer;

  // ── sbSubstitute display mode ────────────────────────────────────────────
  // If the item has an sbSubstitute AND 'sb' appears in the middle of the phrase
  // (i.e. there are words both before and after 'sb' in item.item), use the
  // "double-blank" display:
  //   • Sentence prompt: replace {BLANK} with  _____ [sbSubstitute] _____
  //     e.g. "Schools should _____ students _____ mental health."
  //   • All options (answer + distractors): replace the sbSubstitute with "..."
  //     e.g. "educate ... about", "etucate ... about"
  // Otherwise fall back to the previous behaviour (single blank, noun appended).
  const sbSub = item.sbSubstitute || null;
  const sbWords = item.item ? item.item.trim().toLowerCase().split(/\s+/) : [];
  const sbIdx = sbWords.indexOf('sb');
  // 'sb' is "in the middle" when it is neither the first nor the last word
  const sbInMiddle = sbSub && sbIdx > 0 && sbIdx < sbWords.length - 1;

  // Detect split-blank phrases: sentenceForm contains ' / ' (e.g. 'maintain / balance')
  // These have two {BLANK} tokens in the sentence with intervening words between them.
  const isSplitBlank = rawAnswer.includes(' / ');

  // Build sentence display
  let sentenceDisplay;
  if (sbInMiddle) {
    // Double-blank: _____ [sbSubstitute] _____
    sentenceDisplay = item.sentence.replace('{BLANK}', `_____ ${sbSub} _____`);
  } else if (isSplitBlank) {
    // Split-blank: replace EACH {BLANK} with _____ (the intervening words stay visible)
    sentenceDisplay = item.sentence.replace(/\{BLANK\}/g, '_____');
  } else {
    sentenceDisplay = item.sentence.replace('{BLANK}', '_____');
  }

  shuffle(opts);

  // Prepositions that can take a noun object when they end a phrase
  const PREP_ENDINGS = new Set(['about','above','across','after','against','along','among','around',
    'at','before','behind','below','beside','between','beyond','by','down','for','from',
    'in','inside','into','near','of','off','on','onto','out','outside','over','past',
    'round','since','through','to','toward','towards','under','until','up','with','without']);

  function applyDistractorSbSub(phrase, sub) {
    if (sbInMiddle) {
      // Double-blank mode: replace the substitute noun with '...' in all options.
      // The phrase was generated from sentenceForm (e.g. 'edacate students about'),
      // so 'students' is already present — replace it with '...'.
      const escapedSub = sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return phrase.replace(new RegExp('\\b' + escapedSub + '\\b', 'gi'), '...');
    }
    // Single-blank mode (sb at end of phrase, e.g. 'interact with sb')
    // If the phrase already contains 'sb', replace it with the substitute noun
    if (/\bsb\b/i.test(phrase)) return phrase.replace(/\bsb\b/gi, sub);
    // If the phrase already contains the substitute noun, do not append it again.
    const escapedSub = sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('\\b' + escapedSub + '\\b', 'i').test(phrase)) return phrase;
    // Only append the noun if the phrase ends with a preposition.
    const lastWord = phrase.trim().split(/\s+/).pop().toLowerCase();
    if (PREP_ENDINGS.has(lastWord)) return phrase.trimEnd() + ' ' + sub;
    return phrase;
  }

  // Build display options
  const displayOpts = opts.map(o => {
    const isAnswer = o.toLowerCase() === answer.toLowerCase();
    if (sbInMiddle) {
      // In double-blank mode, apply ellipsis substitution to ALL options including the answer
      return italicise(applyDistractorSbSub(o, sbSub));
    }
    if (isSplitBlank) {
      // Split-blank mode: replace ' / ' with ' ... ' in options that are themselves split-blank
      // e.g. 'maintain / balance' → 'maintain ... balance'
      if (o.includes(' / ')) return italicise(o.replace(/ \/ /g, ' ... '));
      // If the phrase already contains ' ... ' in the data (e.g. 'keep ... in captivity'), use as-is
      if (o.includes(' ... ')) return italicise(o);
      // Plain phrase distractors (e.g. 'keep in captivity', 'leave no trace of') are shown as-is.
      // Do NOT insert ' ... ' into them — they have no split structure.
      return italicise(neutralisePlaceholders(o));
    }
    if (isAnswer) return italicise(o);
    if (sbSub) return italicise(applyDistractorSbSub(o, sbSub));
    return italicise(neutralisePlaceholders(o));
  });
  return { type: '1B', item, prompt: italicise(sentenceDisplay), options: opts, displayOptions: displayOpts, answer, revealDef: italicise(getDef(item)), isMisspellMode };
}

function makeQ_1C(item, fullPool) {
  const defDistractors = getDefDistractors(item, fullPool);
  const correctDef = getDef(item);
  let opts = [correctDef, ...defDistractors.map(d => d.def)];
  opts = [...new Set(opts)];
  while (opts.length < 4) {
    const extra = fullPool.filter(p => p.item !== item.item && !opts.includes(getDef(p)));
    if (extra.length === 0) break;
    opts.push(getDef(extra[Math.floor(Math.random() * extra.length)]));
  }
  shuffle(opts);
  const displayOpts = opts.map(o => italicise(o));
  return { type: '1C', item, prompt: italicise(item.item), options: opts, displayOptions: displayOpts, answer: correctDef, noCapitalise: true };
}

function makeQ_Fill(item, fullPool) {
  // Safety guard: if sentence has no {BLANK}, fall back to definition question
  if (!item.sentence || !item.sentence.includes('{BLANK}')) return makeQ_1A(item, fullPool);
  // Split-blank phrases (sentenceForm contains ' / ') cannot be typed by the student;
  // fall back to the multiple-choice sentence question instead.
  const _rawAns = item.sentenceForm || item.item;
  if (_rawAns.includes(' / ')) return makeQ_1B(item, fullPool);
  const rawAnswer = item.sentenceForm || item.item;
  const sentenceStart = isSentenceStart(item.sentence);

  // ── Strip leading 'be' or indefinite article (a/an) from the hint ──────────
  // These words are provided as plain text in the sentence so the student only
  // needs to type the remaining content words.
  const rawWords = rawAnswer.trim().split(/\s+/);
  const firstWord = rawWords[0].toLowerCase();
  let prefixText = '';   // plain-text prefix to inject before the hint
  let hintAnswer = rawAnswer; // the portion the student must type

  const BE_FORMS = new Set(['be','is','are','was','were','am','been']);
  if (BE_FORMS.has(firstWord) && rawWords.length > 1) {
    // be-led phrase (including conjugated forms): provide the 'be' verb in the sentence,
    // student types only the rest (e.g. 'was befriended by' → prefix 'was', hint 'befriended by')
    prefixText = firstWord + ' ';
    hintAnswer = rawWords.slice(1).join(' ');
  } else if ((firstWord === 'a' || firstWord === 'an') && rawWords.length > 1) {
    // article-led phrase: provide 'a'/'an' in the sentence, student types the rest
    prefixText = rawWords[0] + ' '; // preserve original capitalisation from rawAnswer
    hintAnswer = rawWords.slice(1).join(' ');
  }

  // Capitalise prefix and first hint letter when blank is at sentence start
  if (sentenceStart && prefixText) {
    prefixText = prefixText.charAt(0).toUpperCase() + prefixText.slice(1);
  }

  // Capitalise the hint answer when at sentence start AND there is no prefix
  const displayHintAnswer = (sentenceStart && !prefixText)
    ? hintAnswer.charAt(0).toUpperCase() + hintAnswer.slice(1)
    : hintAnswer;

  const hint = (prefixText ? '' : '') + firstLetterHint(displayHintAnswer);
  const fullHintDisplay = prefixText
    ? `<span style="font-weight:700">${prefixText}</span>${firstLetterHint(displayHintAnswer)}`
    : firstLetterHint(displayHintAnswer);

  // Build sentence display: replace {BLANK} with the full hint (prefix + letter hints)
  let sentenceDisplay = item.sentence.replace('{BLANK}', fullHintDisplay);
  sentenceDisplay = sentenceDisplay.replace(/\{BLANK\}/g, '_____');

  // The answer the student must type is the hintAnswer (without the stripped prefix).
  // Also accept the full rawAnswer as correct (in case student types the whole phrase).
  const acceptedAnswer = hintAnswer.toLowerCase();
  const acceptedFull = rawAnswer.toLowerCase();

  return {
    type: 'fill',
    item,
    prompt: italicise(sentenceDisplay),
    hint: fullHintDisplay,
    answer: acceptedAnswer,
    answerFull: acceptedFull,
    displayAnswer: prefixText
      ? prefixText.trim() + ' ' + hintAnswer
      : (sentenceStart ? rawAnswer.charAt(0).toUpperCase() + rawAnswer.slice(1) : rawAnswer),
    revealDef: italicise(getDef(item))
  };
}

function makeQ_Match(items) {
  const selected = items.slice(0, 5);
  const defs = shuffle(selected.map(i => getDef(i)));
  return {
    type: 'match',
    items: selected,
    defs,
    answers: Object.fromEntries(selected.map(i => [i.item, getDef(i)]))
  };
}

/**
 * Generate questions with guaranteed no two matching questions adjacent.
 * Matching questions are interleaved evenly among non-matching questions.
 */
function generateQuestions(totalQ) {
  // ── Stratified sampling: each selected unit contributes an equal share ──────
  // 1. Determine per-unit quota (distribute remainder round-robin)
  const unitIds = [...selectedUnits];
  const numUnits = unitIds.length;
  const baseQ = Math.floor(totalQ / numUnits);         // floor share per unit
  const remainder = totalQ - baseQ * numUnits;         // leftover questions
  const unitQuotas = {};                               // unitId → # questions
  unitIds.forEach((uid, i) => { unitQuotas[uid] = baseQ + (i < remainder ? 1 : 0); });

  // 2. For each unit, draw its quota of items (half phrases, half words).
  //    Items are drawn WITHOUT repetition up to the unit's total item count.
  //    Repetition only occurs if the requested quota exceeds the available items.
  const allItems = [];
  // Also collect ALL items per unit so unused items can be used for matching questions.
  const allUnitItems = {}; // unitId → full shuffled item list
  unitIds.forEach(uid => {
    const q = unitQuotas[uid];
    const phrases = shuffle(UNITS[uid].phrases.map(p => ({ ...p, unitId: uid })));
    const words   = shuffle(UNITS[uid].words.map(w => ({ ...w, unitId: uid })));
    allUnitItems[uid] = [...phrases, ...words]; // full pool for this unit
    const halfQ = Math.floor(q / 2);
    // Draw without repetition; only cycle if quota exceeds available items
    function drawItems(arr, n) {
      const result = [];
      for (let i = 0; i < n; i++) result.push(arr[i % arr.length]);
      return result;
    }
    allItems.push(...drawItems(phrases, halfQ));
    allItems.push(...drawItems(words, q - halfQ));
  });
  shuffle(allItems);

  // 3. Build full pool (for distractor generation — unchanged)
  const { allPhrases, allWords } = buildPool();
  const fullPool = [...allPhrases, ...allWords];

  // Build non-matching questions
  const nonMatchQs = [];
  const types = ['1A', '1B', '1C', 'fill'];
  let typeIndex = 0;
  for (const item of allItems) {
    const t = types[typeIndex % types.length];
    typeIndex++;
    if (t === '1A') nonMatchQs.push(makeQ_1A(item, fullPool));
    else if (t === '1B') nonMatchQs.push(makeQ_1B(item, fullPool));
    else if (t === '1C') nonMatchQs.push(makeQ_1C(item, fullPool));
    else nonMatchQs.push(makeQ_Fill(item, fullPool));
  }
  shuffle(nonMatchQs);

  // Build matching questions using items NOT already used in regular questions.
  // This prevents the same item from appearing in both a regular question AND a matching question.
  const usedItemKeys = new Set(allItems.map(i => i.item));
  const unusedItems = [];
  unitIds.forEach(uid => {
    allUnitItems[uid].forEach(i => {
      if (!usedItemKeys.has(i.item)) unusedItems.push(i);
    });
  });
  shuffle(unusedItems);
  // If there aren't enough unused items to fill a matching batch, fall back to used items
  const matchPool = unusedItems.length >= 2
    ? [...unusedItems, ...shuffle([...allItems])]  // prefer unused, then used as fallback
    : shuffle([...allItems]);
  const matchQs = [];
  for (let i = 0; i + 1 < matchPool.length && matchQs.length < Math.ceil(allItems.length / 5); i += 5) {
    const batch = matchPool.slice(i, Math.min(i + 5, matchPool.length));
    if (batch.length >= 2) matchQs.push(makeQ_Match(batch));
  }
  shuffle(matchQs);

  // Interleave: insert one matching question after every ~5 non-matching questions
  const combined = [];
  const step = matchQs.length > 0 ? Math.max(1, Math.floor(nonMatchQs.length / matchQs.length)) : nonMatchQs.length;
  let mIdx = 0;
  for (let i = 0; i < nonMatchQs.length; i++) {
    combined.push(nonMatchQs[i]);
    if (mIdx < matchQs.length && (i + 1) % step === 0) {
      combined.push(matchQs[mIdx++]);
    }
  }
  // Append any remaining matching questions at the end
  while (mIdx < matchQs.length) combined.push(matchQs[mIdx++]);

  return combined.slice(0, totalQ);
}

// ============================================================
// EXERCISE FLOW
// ============================================================
// Data validation: warn if any be-phrase item has a sentence where 'be' appears before {BLANK}
// AND the sentenceForm also starts with 'be' — which would cause a double-be in the sentence.
function validateData() {
  const BE_AUX_BEFORE = /\b(is|are|was|were|has been|have been|had been|will be|be|being)\s+\{BLANK\}/i;
  Object.values(UNITS).forEach(unit => {
    [...(unit.phrases||[]), ...(unit.words||[])].forEach(item => {
      if (!item.sentence) return;
      if (BE_AUX_BEFORE.test(item.sentence) && /^be\s/i.test(item.sentenceForm || item.item)) {
        console.warn('[DATA] Double-be risk: item "' + item.item + '" has aux-before-blank sentence but sentenceForm starts with "be":', item.sentence);
      }
    });
  });
}


// ============================================================
// FLASHCARD REVISION MODE
// ============================================================

// Flashcard state
let fcDeck = [];
let fcIndex = 0;
let fcFlipped = false;

/**
 * Build an ordered flash card deck from selectedUnits.
 * Order: unit by unit (in UNITS array order), phrases A–Z then words A–Z within each unit.
 * Each item gets a .unitId property attached.
 */
function buildFlashDeck() {
  const deck = [];
  // Iterate UNITS in definition order to preserve unit ordering
  Object.keys(UNITS).forEach(uid => {
    if (!selectedUnits.has(uid)) return;
    const unit = UNITS[uid];
    const phrases = (unit.phrases || []).map(p => ({ ...p, unitId: uid })).sort((a, b) => a.item.localeCompare(b.item));
    const words   = (unit.words   || []).map(w => ({ ...w, unitId: uid })).sort((a, b) => a.item.localeCompare(b.item));
    deck.push(...phrases, ...words);
  });
  return deck;
}

/**
 * Start the flashcard revision session.
 * Called when the user taps "Do Revision".
 */
function startRevision() {
  fcDeck = buildFlashDeck();
  if (fcDeck.length === 0) return;
  fcIndex = 0;
  fcFlipped = false;
  showScreen('screen-flashcard');
  window.scrollTo(0, 0);
  fcRender();
  fcInitSwipe();
}

/**
 * Sync the card wrapper height to the taller of the two faces.
 * Called after content is updated so the card never collapses.
 */
function fcSyncHeight() {
  const inner = document.getElementById('fc-card-inner');
  const front = inner.querySelector('.fc-front');
  const back  = inner.querySelector('.fc-back');
  // Temporarily make both faces visible (not rotated) to measure natural height
  const frontH = front.scrollHeight;
  const backH  = back.scrollHeight;
  const maxH = Math.max(frontH, backH, 280);
  inner.style.minHeight = maxH + 'px';
  // Also update the outer card wrapper so it doesn't collapse
  document.getElementById('fc-card').style.minHeight = maxH + 'px';
}

/**
 * Render the current card (both front and back faces) and update counter/buttons.
 */
// Italicise Oxford-style placeholders: sb, sth, sb's, be
function fcItalicisePlaceholders(text) {
  if (!text) return '';
  // Escape HTML first (for textContent-style fields that now use innerHTML)
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Replace whole-word occurrences of sb, sth, sb's, be with <em> tags
  return escaped.replace(/\b(sb's|sb|sth|be)\b/g, '<em>$1</em>');
}

function fcRender() {
  const card = fcDeck[fcIndex];
  const unitClass = card.unitId.replace('2nd-', 'unit-');
  const unitLabel = (UNITS[card.unitId] && UNITS[card.unitId].label) ? UNITS[card.unitId].label : card.unitId;
  const def = currentLang === 'en' ? card.defEn : card.defZh;

  // Front face
  const badge = document.getElementById('fc-unit-badge');
  badge.textContent = unitLabel;
  badge.className = 'fc-unit-badge ' + unitClass;

  // Display 'phr' instead of 'phrase' for brevity
  const posLabel = p => p === 'phrase' ? 'phr' : (p || '');
  document.getElementById('fc-pos').textContent = posLabel(card.pos);
  document.getElementById('fc-item').innerHTML = fcItalicisePlaceholders(card.item || '');

  // Back face
  const badgeBack = document.getElementById('fc-unit-badge-back');
  badgeBack.textContent = unitLabel;
  badgeBack.className = 'fc-unit-badge ' + unitClass;

  document.getElementById('fc-item-reminder').innerHTML = fcItalicisePlaceholders(card.item || '');
  document.getElementById('fc-def').innerHTML = fcItalicisePlaceholders(def || '');

  // Sample sentence — replace {BLANK} tokens with highlighted sentenceForm parts.
  // sentenceForm may be slash-separated (e.g. "consult / for") for split-blank phrases
  // that have two {BLANK} tokens in the sentence.
  const sentEl = document.getElementById('fc-sentence');
  if (card.sentence) {
    const rawForm = card.sentenceForm || card.item || '___';
    const formParts = rawForm.split(' / ');  // split on " / " for multi-blank phrases
    const blankCount = (card.sentence.match(/\{BLANK\}/g) || []).length;

    // Step 1: replace each {BLANK} sequentially with the corresponding part in <strong>
    let html = card.sentence;
    formParts.forEach(function(part) {
      html = html.replace('{BLANK}', '<strong>' + part + '</strong>');
    });
    // If any {BLANK} tokens remain (data mismatch), replace with placeholder
    html = html.replace(/\{BLANK\}/g, '<strong>___</strong>');

    // Step 2: for SINGLE-blank phrases only, also highlight any remaining words of
    // card.item that appear verbatim elsewhere in the sentence (e.g. "out" in "figure out").
    // This step is SKIPPED for split-blank phrases (blankCount > 1) to avoid false positives.
    if (card.pos === 'phrase' && card.item && blankCount === 1) {
      const formWords = formParts[0].toLowerCase().split(/\s+/);
      const phraseWords = card.item.replace(/\.\.\./g, '').split(/\s+/).filter(Boolean);
      const extraWords = phraseWords.filter(w => !formWords.includes(w.toLowerCase()));
      extraWords.forEach(function(w) {
        const re = new RegExp('(?<![>\\w])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\w<])', 'gi');
        html = html.replace(re, '<strong>$1</strong>');
      });
    }

    sentEl.innerHTML = html;
  } else {
    sentEl.textContent = '';
  }

  // Counter
  document.getElementById('fc-counter').textContent = (fcIndex + 1) + ' / ' + fcDeck.length;

  // Flip state: remove .flipped from card outer element
  document.getElementById('fc-card').classList.remove('flipped');
  fcFlipped = false;

  // Prev / Next button states
  document.getElementById('fc-prev').disabled = (fcIndex === 0);
  document.getElementById('fc-next').disabled = (fcIndex === fcDeck.length - 1);

  // Sync card height to fit the taller face
  // Use requestAnimationFrame so the DOM has painted before we measure
  requestAnimationFrame(fcSyncHeight);
}

/**
 * Toggle the flip state of the current card.
 * The .flipped class is toggled on #fc-card (outer container);
 * the CSS rotates #fc-card-inner.
 */
function fcFlip() {
  // Suppress flip if a swipe gesture was just detected on this touch sequence
  if (fcSwiping) { fcSwiping = false; return; }
  fcFlipped = !fcFlipped;
  document.getElementById('fc-card').classList.toggle('flipped', fcFlipped);
}

/**
 * Navigate to the previous card with a slide-right animation.
 */
function fcPrev() {
  if (fcIndex <= 0) return;
  fcIndex--;
  fcAnimateSlide('right');
}

/**
 * Navigate to the next card with a slide-left animation.
 */
function fcNext() {
  if (fcIndex >= fcDeck.length - 1) return;
  fcIndex++;
  fcAnimateSlide('left');
}

/**
 * Apply a slide animation class, render the new card, then remove the class.
 * @param {'left'|'right'} direction
 */
function fcAnimateSlide(direction) {
  const cardEl = document.getElementById('fc-card');
  const cls = direction === 'left' ? 'fc-slide-left' : 'fc-slide-right';
  // Remove any existing slide classes first
  cardEl.classList.remove('fc-slide-left', 'fc-slide-right');
  // Render new card content (flip state reset inside fcRender)
  fcRender();
  // Force reflow so the animation fires fresh
  void cardEl.offsetWidth;
  cardEl.classList.add(cls);
  setTimeout(() => cardEl.classList.remove(cls), 300);
}

/**
 * Shuffle the deck in place, reset to card 1, and re-render.
 */
function fcShuffle() {
  shuffle(fcDeck);
  fcIndex = 0;
  const cardEl = document.getElementById('fc-card');
  cardEl.classList.remove('fc-slide-left', 'fc-slide-right', 'flipped');
  fcFlipped = false;
  fcRender();
}

/**
 * Return to the title screen.
 */
function fcBackToTitle() {
  showScreen('screen-title');
  window.scrollTo(0, 0);
}

/**
 * Initialise touch/swipe listeners on the flash card element.
 * Called once when the flashcard screen is first shown.
 * Swipe left → next card; swipe right → previous card.
 */
let fcSwipeInitialised = false;
let fcSwiping = false; // flag to suppress onclick when a swipe was detected
function fcInitSwipe() {
  if (fcSwipeInitialised) return;
  fcSwipeInitialised = true;
  const cardEl = document.getElementById('fc-card');
  let touchStartX = 0;
  let touchStartY = 0;
  cardEl.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
    fcSwiping = false;
  }, { passive: true });
  cardEl.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Only treat as a swipe if horizontal movement dominates and exceeds threshold
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      fcSwiping = true; // suppress the subsequent onclick
      if (dx < 0) fcNext();   // swipe left → next
      else         fcPrev();  // swipe right → previous
    }
    // Tap: fcFlip() is wired via onclick on #fc-card; nothing to do here
  }, { passive: true });
}
