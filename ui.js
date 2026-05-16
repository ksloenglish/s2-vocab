function startExercise() {
  questions = generateQuestions(selectedQ);
  currentQIndex = 0;
  score = 0;
  msElapsed = 0;
  practisedItems = new Set();

  showScreen('screen-exercise');
  startTimer();
  renderQuestion();
}

function startTimer() {
  clearInterval(timerInterval);
  const startTime = performance.now() - msElapsed;
  timerInterval = setInterval(() => {
    msElapsed = Math.floor(performance.now() - startTime);
    const timerEl = document.getElementById('hud-timer');
    timerEl.textContent = formatTime(msElapsed);
    // 8. Timer colour change: amber after 2 min, red after 4 min
    if (msElapsed >= 240000) {
      timerEl.style.color = 'var(--danger)';
    } else if (msElapsed >= 120000) {
      timerEl.style.color = 'var(--warning)';
    } else {
      timerEl.style.color = '';
    }
  }, 50);
}

function updateHUD() {
  document.getElementById('hud-progress').textContent = `${currentQIndex + 1} / ${questions.length}`;
  document.getElementById('hud-score').textContent = score;
  const pct = ((currentQIndex + 1) / questions.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
}

function showScreen(id) {
  // 6. Screen fade is handled by CSS animation on .screen.active
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function renderQuestion() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateHUD();
  const q = questions[currentQIndex];
  const card = document.getElementById('q-card');
  const nextBtn = document.getElementById('btn-next');
  nextBtn.classList.remove('show');

  if (!q) { endExercise(); return; }

  updateNextBtn();
  if (q.type === '1A' || q.type === '1B' || q.type === '1C') renderMCQ(q, card);
  else if (q.type === 'fill') renderFill(q, card);
  else if (q.type === 'match') renderMatch(q, card);
}

// ---- UNIT BADGE HELPER ----
function unitBadgeHTML(unitId) {
  if (!unitId) return '';
  const label = (UNITS[unitId] && UNITS[unitId].label) ? UNITS[unitId].label.toUpperCase() : unitId.toUpperCase();
  // derive CSS class from the numeric part of the unitId (e.g. "2nd-5" → "unit-5")
  const m = unitId.match(/(\d+)$/);
  const cls = m ? 'unit-' + m[1] : 'unit-mix';
  return `<span class="q-unit-badge ${cls}">${label}</span>`;
}

function matchUnitBadgeHTML(items) {
  // For matching questions: show unit badge only if all items share the same unit
  const ids = [...new Set(items.map(i => i.unitId).filter(Boolean))];
  if (ids.length === 1) return unitBadgeHTML(ids[0]);
  if (ids.length > 1) {
    return `<span class="q-unit-badge unit-mix">MIXED</span>`;
  }
  return '';
}

// ---- MCQ ----
function renderMCQ(q, card) {
  const badgeLabel = (q.type === '1A' || q.type === '1B') ? 'Choose the correct word / phrase' : 'Choose the correct definition';
  card.innerHTML = `
    <div class="q-card-header">
      <span class="q-type-badge badge-mcq">${badgeLabel}</span>
      ${unitBadgeHTML(q.item && q.item.unitId)}
    </div>
    <div class="q-text">${q.prompt}</div>
    <div class="mcq-options" id="mcq-opts"></div>
    <div class="def-reveal" id="def-reveal"></div>
  `;
  const optsDiv = document.getElementById('mcq-opts');
  const displayOpts = q.displayOptions || q.options.map(o => italicise(o));
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'mcq-opt';
    btn.innerHTML = displayOpts[idx];
    btn.onclick = () => handleMCQ(btn, opt, q);
    optsDiv.appendChild(btn);
  });
}

function handleMCQ(btn, chosen, q) {
  const allBtns = document.querySelectorAll('.mcq-opt');
  if (chosen === q.answer) {
    btn.classList.add('correct');
    allBtns.forEach(b => b.disabled = true);
    if (q.revealDef) {
      const rev = document.getElementById('def-reveal');
      rev.innerHTML = '📖 ' + q.revealDef;
      rev.classList.add('show');
    }
    if (!q._wrongAttempt) {
      score++;
      popScore();
    }
    practisedItems.add(q.item.item);
    document.getElementById('btn-next').classList.add('show');
  } else {
    btn.classList.add('wrong');
    btn.disabled = true;
    q._wrongAttempt = true;
  }
}

// ---- FILL IN THE BLANK ----
function renderFill(q, card) {
  card.innerHTML = `
    <div class="q-card-header">
      <span class="q-type-badge badge-fill">Fill in the Blank</span>
      ${unitBadgeHTML(q.item && q.item.unitId)}
    </div>
    <div class="q-text">${q.prompt}</div>
    <div class="fill-wrap">
      <input type="text" class="fill-input" id="fill-input" placeholder="Type your answer…" autocomplete="off" autocorrect="off" spellcheck="false" />
      <button class="btn-submit" id="btn-submit-fill" onclick="handleFill('${escapeForAttr(q.answer)}', '${escapeForAttr(q.revealDef)}', '${escapeForAttr(q.displayAnswer || q.answer)}')">Submit</button>
    </div>
    <div class="fill-feedback" id="fill-feedback"></div>
    <div class="def-reveal" id="def-reveal"></div>
  `;
  const input = document.getElementById('fill-input');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-submit-fill').click();
  });
  // On mobile, scroll the question card into view when keyboard opens
  // Use a short delay to let the keyboard animation start first
  input.addEventListener('focus', () => {
    setTimeout(() => {
      const card = document.getElementById('q-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  });
  input.focus();
}

function escapeForAttr(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function handleFill(correctAnswer, revealDef, displayAnswer) {
  if (!displayAnswer) displayAnswer = correctAnswer;
  const input = document.getElementById('fill-input');
  const feedback = document.getElementById('fill-feedback');
  const submitBtn = document.getElementById('btn-submit-fill');
  const userAnswer = input.value.trim().toLowerCase();

  submitBtn.disabled = true;
  input.disabled = true;

  const isCorrect = userAnswer === correctAnswer.toLowerCase();
  feedback.classList.add('show');

  if (isCorrect) {
    input.classList.add('correct');
    feedback.classList.add('ok');
    feedback.textContent = '✓ Correct!';
    score++;
    popScore();
    practisedItems.add(questions[currentQIndex].item.item);
  } else {
    input.classList.add('wrong');
    feedback.classList.add('err');
    feedback.innerHTML = `✗ Wrong!`;
    // Replace the hint in the sentence prompt with the highlighted correct answer
    const qText = document.querySelector('.q-text');
    if (qText) {
      const answerSpan = `<span style="color:#FFD700;font-weight:800;font-size:1.1em;text-decoration:underline;letter-spacing:0.03em">${displayAnswer}</span>`;
      // q.hint contains the HTML of the hint (first-letter + underscores); replace it with the answer span
      const currentQ = questions[currentQIndex];
      if (currentQ && currentQ.hint) {
        qText.innerHTML = qText.innerHTML.replace(currentQ.hint, answerSpan);
      }
    }
  }

  if (revealDef) {
    const rev = document.getElementById('def-reveal');
    rev.innerHTML = '📖 ' + revealDef;
    rev.classList.add('show');
  }

  document.getElementById('btn-next').classList.add('show');
}

// ---- MATCHING ----
function renderMatch(q, card) {
  matchState = {
    q,
    selectedWord: null,
    selectedDef: null,
    matched: {},
    anyMistake: false,
    totalItems: q.items.length
  };

  card.innerHTML = `
    <div class="q-card-header">
      <span class="q-type-badge badge-match">Matching</span>
      ${matchUnitBadgeHTML(q.items)}
    </div>
    <div class="q-text" style="font-size:0.9rem;margin-bottom:14px;">Match each word or phrase with its correct definition.</div>
    <div class="match-grid">
      <div class="match-col">
        <div class="match-col-label">Words / Phrases</div>
        <div id="match-words"></div>
      </div>
      <div class="match-col">
        <div class="match-col-label">Definitions</div>
        <div id="match-defs"></div>
      </div>
    </div>
    <div class="match-score-note" id="match-score-note"></div>
  `;

  renderMatchItems();
}

function renderMatchItems() {
  const q = matchState.q;
  const wordsDiv = document.getElementById('match-words');
  const defsDiv = document.getElementById('match-defs');
  wordsDiv.innerHTML = '';
  defsDiv.innerHTML = '';

  q.items.forEach(item => {
    const div = document.createElement('div');
    if (matchState.matched[item.item]) {
      div.className = 'match-item matched';
    } else {
      div.className = 'match-item' + (matchState.selectedWord === item.item ? ' selected' : '');
      div.onclick = () => selectMatchWord(item.item);
    }
    div.innerHTML = `<span class="match-label">${italicise(item.item)}</span>`;
    wordsDiv.appendChild(div);
  });

  q.defs.forEach(def => {
    const matchedItem = Object.entries(matchState.matched).find(([, v]) => v === def);
    const div = document.createElement('div');
    if (matchedItem) {
      div.className = 'match-item matched';
    } else {
      div.className = 'match-item' + (matchState.selectedDef === def ? ' selected' : '');
      div.onclick = () => selectMatchDef(def);
    }
    div.innerHTML = `<span class="match-label">${italicise(def)}</span>`;
    defsDiv.appendChild(div);
  });
}

function selectMatchWord(word) {
  if (matchState.matched[word]) return;
  matchState.selectedWord = word;
  renderMatchItems();
  tryMatchPair();
}

function selectMatchDef(def) {
  if (Object.values(matchState.matched).includes(def)) return;
  matchState.selectedDef = def;
  renderMatchItems();
  tryMatchPair();
}

function tryMatchPair() {
  if (!matchState.selectedWord || !matchState.selectedDef) return;
  const word = matchState.selectedWord;
  const def = matchState.selectedDef;
  const correctDef = matchState.q.answers[word];

  if (def === correctDef) {
    matchState.matched[word] = def;
    matchState.selectedWord = null;
    matchState.selectedDef = null;
    const matchedItem = matchState.q.items.find(i => i.item === word);
    if (matchedItem) practisedItems.add(matchedItem.item);
    renderMatchItems();
    if (Object.keys(matchState.matched).length === matchState.totalItems) {
      if (!matchState.anyMistake) {
        score++;
        popScore();
      }
      const noteEl = document.getElementById('match-score-note');
      if (matchState.anyMistake) {
        noteEl.textContent = '✗ Mistakes were made – no point awarded.';
        noteEl.className = 'match-score-note err';
      } else {
        noteEl.textContent = '✓ All matched! +1 point';
        noteEl.className = 'match-score-note ok';
      }
      document.getElementById('btn-next').classList.add('show');
    }
  } else {
    matchState.anyMistake = true;
    matchState.selectedWord = null;
    matchState.selectedDef = null;
    flashWrong(word, def);
  }
}

function flashWrong(word, def) {
  document.querySelectorAll('.match-item').forEach(el => {
    const plainText = el.textContent;
    if (plainText === word || plainText === def) {
      el.classList.add('wrong-flash');
      setTimeout(() => { el.classList.remove('wrong-flash'); renderMatchItems(); }, 500);
    }
  });
}

// ---- NEXT QUESTION ----
function nextQuestion() {
  currentQIndex++;
  if (currentQIndex >= questions.length) {
    endExercise();
  } else {
    renderQuestion();
  }
}

function updateNextBtn() {
  const btn = document.getElementById('btn-next');
  const isLast = (currentQIndex === questions.length - 1);
  btn.textContent = isLast ? 'Finish Exercise ✓' : 'Next Question →';
}

// ---- SCORE POP (item 5) ----
function popScore() {
  const el = document.getElementById('hud-score');
  el.textContent = score;
  el.classList.remove('pop');
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add('pop');
  el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
}

// ---- QUIT ----
function quitToTitle() {
  clearInterval(timerInterval);
  showScreen('screen-title');
}

// ---- END ----
function endExercise() {
  clearInterval(timerInterval);
  showScreen('screen-results');
  window.scrollTo({ top: 0, behavior: 'instant' });

  const total = questions.length;
  const displayScore = Math.min(score, total);
  document.getElementById('res-score').textContent = `${displayScore} / ${total}`;
  document.getElementById('res-time').textContent = formatTime(msElapsed);

  const pct = total > 0 ? displayScore / total : 0;
  let remark = '';
  if (pct === 1) remark = '🏆 Perfect! A flawless performance — well done!';
  else if (pct >= 0.9) remark = '🌟 Outstanding! You have mastered this unit!';
  else if (pct >= 0.75) remark = '🎉 Great work! Keep it up!';
  else if (pct >= 0.6) remark = '👍 Good effort! A little more practice will get you there.';
  else if (pct >= 0.4) remark = '📚 Keep practising — you are making progress!';
  else remark = '💪 Don\'t give up! Review the words and try again.';
  document.getElementById('res-remark').textContent = remark;

  // 9. Confetti for 100%
  if (pct === 1) launchConfetti();

  const { allPhrases, allWords } = buildPool();
  const practisedPhrases = allPhrases.filter(p => practisedItems.has(p.item)).sort((a, b) => a.item.localeCompare(b.item));
  const practisedWords = allWords.filter(w => practisedItems.has(w.item)).sort((a, b) => a.item.localeCompare(b.item));

  function renderVocabList(items, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">None practised.</div>';
      return;
    }
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'vocab-item';
      // Unit label pill: small coloured text badge showing e.g. "U5"
      let labelHTML = '';
      if (item.unitId) {
        const m = item.unitId.match(/(\d+)$/);
        const cls = m ? 'unit-' + m[1] : '';
        const fullLabel = (UNITS[item.unitId] && UNITS[item.unitId].label) || item.unitId;
        const shortLabel = fullLabel.replace('Unit ', 'U'); // "Unit 5" → "U5"
        labelHTML = `<span class="vi-unit-label ${cls}" title="${fullLabel}">${shortLabel}</span>`;
      }
      const posHTML = item.pos ? `<span class="vi-pos">${item.pos}</span>` : '';
      div.innerHTML = `${labelHTML}<span class="vi-word">${italicise(item.item)}</span>${posHTML}<span class="vi-def">${italicise(getDef(item))}</span>`;
      container.appendChild(div);
    });
  }
  renderVocabList(practisedPhrases, 'vocab-phrases-list');
  renderVocabList(practisedWords, 'vocab-words-list');
}

function playAgain() {
  // Remove any leftover confetti pieces
  document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
  showScreen('screen-title');
}

// ---- CONFETTI (item 9) ----
function launchConfetti() {
  const colours = ['#a78bfa','#06b6d4','#f59e0b','#10b981','#f472b6','#60a5fa'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colours[Math.floor(Math.random() * colours.length)];
    el.style.width = (8 + Math.random() * 8) + 'px';
    el.style.height = (8 + Math.random() * 8) + 'px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    el.style.animationDuration = (2 + Math.random() * 2.5) + 's';
    el.style.animationDelay = (Math.random() * 1.2) + 's';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ============================================================
// INIT
// ============================================================
selectLang('zh');
validateData();
// Random title greeting
(function() {
  const greetings = [
    'Ready for the challenge?',
    'Challenge time!',
    'Ready to begin?',
    "Let's get started!",
    'Set your challenge!'
  ];
  const el = document.getElementById('title-greeting');
  if (el) el.textContent = greetings[Math.floor(Math.random() * greetings.length)];
})();

(function() {
  const el = document.getElementById('copyright-year');
  if (el) el.textContent = new Date().getFullYear();
})();
