# ABC Letter Quiz (Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ABC Letter Quiz web app described in `docs/superpowers/specs/2026-08-06-abc-quiz-design.md` (Part 2: App Details (Web)) — a single-page, no-build-step HTML/CSS/JS app that speaks a letter aloud and has the kid pick it out of 4 mixed-case choices.

**Architecture:** Everything lives in one `app.js`, used both as a plain browser `<script>` (defining globals) and as a Node CommonJS module for testing, via a dual-environment export guard at the bottom of the file (`if (typeof module !== 'undefined' && module.exports) { module.exports = {...} }`). The pure game-logic pieces (random selection, `GameEngine`) have no `window`/`document`/`localStorage` references at module-load time, so Node can `require('../app.js')` and test them directly with the built-in `node:test` runner. Browser-only pieces (`SpeechService`, DOM wiring via `initApp()`) are defined in the same file but only ever invoked inside a `typeof window !== 'undefined'` guard, so requiring the file under Node never touches browser globals.

**Tech Stack:** Plain HTML/CSS/JS. No framework, no bundler, no npm dependencies. Testing via Node's built-in `node:test` + `node:assert` (Node 25 is installed).

---

## File Structure

```
ABCQuiz/
  index.html      // single page: quiz section, settings section, celebration section
  styles.css
  app.js          // game engine + settings/storage + speech + DOM wiring, all in one file
  test/
    app.test.js   // imports pure exports from ../app.js via Node's CommonJS require
```

---

### Task 1: Static page skeleton (`index.html`, `styles.css`) and empty `app.js`

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js` (empty stub for now, filled in by later tasks)

This task is layout-only — no game logic yet — so it's verified by a quick structural check rather than TDD.

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ABC Letter Quiz</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main id="quiz-section">
    <div class="top-bar">
      <button id="replay-button" aria-label="Replay letter">🔊</button>
      <button id="settings-button" aria-label="Settings">⚙️</button>
    </div>
    <div id="letter-grid"></div>
  </main>

  <section id="settings-section" class="hidden">
    <h2>Settings</h2>
    <label>
      <input type="checkbox" id="auto-speak-toggle">
      Speak letter automatically
    </label>
    <label>
      <input type="checkbox" id="persist-mistakes-toggle">
      Remember missed letters
    </label>
    <label>
      Rounds per session:
      <input type="number" id="rounds-per-session-input" min="5" max="20">
    </label>
    <button id="settings-close-button">Done</button>
  </section>

  <section id="celebration-section" class="hidden">
    <h2>Great job!</h2>
    <p id="score-summary"></p>
    <button id="play-again-button">Play Again</button>
  </section>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `styles.css`**

```css
* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, system-ui, sans-serif;
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.hidden {
  display: none !important;
}

#quiz-section {
  width: min(600px, 95vw);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.top-bar {
  display: flex;
  justify-content: space-between;
}

.top-bar button {
  font-size: 2rem;
  background: none;
  border: none;
  cursor: pointer;
}

#replay-button {
  font-size: 5rem;
  margin: 0 auto;
}

#letter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.letter-card {
  font-size: 4.5rem;
  font-weight: bold;
  padding: 32px;
  border-radius: 24px;
  border: none;
  background: #cfe3ff;
  cursor: pointer;
}

.letter-card.eliminated {
  background: #d9d9d9;
  color: #888;
  cursor: not-allowed;
}

.letter-card.shake {
  animation: shake 0.4s;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

#settings-section, #celebration-section {
  width: min(400px, 90vw);
  background: white;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
}

#settings-section label {
  display: block;
  margin: 16px 0;
  font-size: 1.1rem;
}

button {
  font-size: 1.1rem;
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  background: #4a90e2;
  color: white;
  cursor: pointer;
}
```

- [ ] **Step 3: Write the empty `app.js` stub**

```js
// Filled in by later tasks.
```

- [ ] **Step 4: Verify structure**

Run:
```bash
cd ~/development/ABCQuiz
grep -o 'id="[a-z-]*"' index.html | sort
```

Expected output (order may vary, but all of these must be present):
```
id="auto-speak-toggle"
id="celebration-section"
id="letter-grid"
id="persist-mistakes-toggle"
id="play-again-button"
id="quiz-section"
id="replay-button"
id="rounds-per-session-input"
id="score-summary"
id="settings-button"
id="settings-close-button"
id="settings-section"
```

Then open `index.html` directly in a browser (double-click it or run `open index.html` on macOS) and confirm: a speaker emoji and gear emoji appear at the top, an empty space below them (the letter grid, empty until Task 6), and no visible settings/celebration panels (they're hidden by default).

---

### Task 2: Pure random-selection helpers (TDD)

**Files:**
- Modify: `app.js`
- Create: `test/app.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/app.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  alphabetLetters,
  createStubRandomSource,
  weightedRandomLetter,
  pickDistractors,
  randomCasing,
} = require('../app.js');

test('weightedRandomLetter picks the letter whose weight range contains the roll', () => {
  // 26 letters, mistakeCounts empty except B=3 (weight 4). Order is A..Z.
  // A has weight 1 (cumulative 0..<1), B has weight 4 (cumulative 1..<5).
  // A roll of 1 should land in B's range.
  const source = createStubRandomSource([1]);
  const letter = weightedRandomLetter({ B: 3 }, null, source);
  assert.strictEqual(letter, 'B');
});

test('weightedRandomLetter excludes the given letter', () => {
  // With "A" excluded, candidates start at "B" (weight 1, cumulative 0..<1).
  const source = createStubRandomSource([0]);
  const letter = weightedRandomLetter({}, 'A', source);
  assert.strictEqual(letter, 'B');
});

test('pickDistractors returns distinct letters excluding the target', () => {
  const source = createStubRandomSource([5, 10, 15, 20]);
  const distractors = pickDistractors('B', 3, source);
  assert.strictEqual(distractors.length, 3);
  assert.strictEqual(new Set(distractors).size, 3);
  assert.ok(!distractors.includes('B'));
});

test('randomCasing produces both true and false over many trials', () => {
  const values = Array.from({ length: 1000 }, (_, i) => i);
  const source = createStubRandomSource(values);
  let sawTrue = false;
  let sawFalse = false;
  for (let i = 0; i < 1000; i++) {
    if (randomCasing(source)) sawTrue = true;
    else sawFalse = true;
  }
  assert.ok(sawTrue);
  assert.ok(sawFalse);
});

test('alphabetLetters contains all 26 letters A-Z', () => {
  assert.strictEqual(alphabetLetters.length, 26);
  assert.strictEqual(alphabetLetters[0], 'A');
  assert.strictEqual(alphabetLetters[25], 'Z');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd ~/development/ABCQuiz
node --test test/app.test.js
```

Expected: failure — `require('../app.js')` returns `undefined` for all the destructured names (the stub `app.js` exports nothing yet).

- [ ] **Step 3: Implement the minimal code to make the tests pass**

Replace the contents of `app.js` (the stub from Task 1) with:

```js
const alphabetLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function createSystemRandomSource() {
  return {
    nextValue() {
      return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    },
  };
}

function createStubRandomSource(values) {
  let index = 0;
  return {
    nextValue() {
      const value = values[index % values.length];
      index++;
      return value;
    },
  };
}

function weightedRandomLetter(mistakeCounts, excludeLetter, randomSource) {
  const candidates = alphabetLetters.filter((letter) => letter !== excludeLetter);
  const weights = candidates.map((letter) => 1 + (mistakeCounts[letter] || 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = randomSource.nextValue() % totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    if (roll < weights[i]) return candidates[i];
    roll -= weights[i];
  }
  return candidates[candidates.length - 1];
}

function pickDistractors(targetLetter, count, randomSource) {
  const pool = alphabetLetters.filter((letter) => letter !== targetLetter);
  const result = [];
  for (let i = 0; i < count; i++) {
    const index = randomSource.nextValue() % pool.length;
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function randomCasing(randomSource) {
  return randomSource.nextValue() % 2 === 0;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    alphabetLetters,
    createSystemRandomSource,
    createStubRandomSource,
    weightedRandomLetter,
    pickDistractors,
    randomCasing,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command as Step 2.

Expected: all 5 tests pass.

---

### Task 3: `GameEngine` — round generation, guess submission, session logic (TDD)

**Files:**
- Modify: `app.js`
- Modify: `test/app.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `test/app.test.js` (add to the existing `require` destructuring at the top — change it to also pull in `GameEngine`):

```js
const {
  alphabetLetters,
  createStubRandomSource,
  weightedRandomLetter,
  pickDistractors,
  randomCasing,
  GameEngine,
} = require('../app.js');
```

Then add these tests to the file:

```js
test('GameEngine initial round has 4 distinct letters including the target', () => {
  const source = createStubRandomSource([1, 5, 5, 5, 5, 5, 5]);
  const engine = new GameEngine(10, {}, source);
  const letters = new Set(engine.currentRound.choices.map((c) => c.letter));
  assert.strictEqual(letters.size, 4);
  assert.ok(letters.has(engine.currentRound.target));
});

test('GameEngine.submitGuess with the target increments correctCount and completes the round', () => {
  const source = createStubRandomSource([1]);
  const engine = new GameEngine(10, {}, source);
  const target = engine.currentRound.target;
  const result = engine.submitGuess(target);
  assert.strictEqual(result, 'correct');
  assert.strictEqual(engine.correctCount, 1);
  assert.strictEqual(engine.completedRounds, 1);
});

test('GameEngine.submitGuess with a wrong letter records a mistake and does not advance', () => {
  const source = createStubRandomSource([1]);
  const engine = new GameEngine(10, {}, source);
  const target = engine.currentRound.target;
  const wrongLetter = engine.currentRound.choices.map((c) => c.letter).find((l) => l !== target);
  const result = engine.submitGuess(wrongLetter);
  assert.strictEqual(result, 'incorrect');
  assert.strictEqual(engine.completedRounds, 0);
  assert.strictEqual(engine.mistakeCounts[target], 1);
  assert.ok(engine.eliminatedLetters.has(wrongLetter));
});

test('GameEngine.startNextRound clears eliminated letters and avoids repeating the target', () => {
  const source = createStubRandomSource([1]);
  const engine = new GameEngine(10, {}, source);
  const target = engine.currentRound.target;
  const wrongLetter = engine.currentRound.choices.map((c) => c.letter).find((l) => l !== target);
  engine.submitGuess(wrongLetter);
  engine.submitGuess(target);
  engine.startNextRound();
  assert.strictEqual(engine.eliminatedLetters.size, 0);
  assert.notStrictEqual(engine.currentRound.target, target);
});

test('GameEngine.isSessionComplete becomes true after roundsPerSession correct guesses', () => {
  const source = createStubRandomSource([1]);
  const engine = new GameEngine(2, {}, source);
  engine.submitGuess(engine.currentRound.target);
  assert.strictEqual(engine.isSessionComplete, false);
  engine.startNextRound();
  engine.submitGuess(engine.currentRound.target);
  assert.strictEqual(engine.isSessionComplete, true);
});

test('GameEngine.startNewSession resets counters', () => {
  const source = createStubRandomSource([1]);
  const engine = new GameEngine(1, {}, source);
  engine.submitGuess(engine.currentRound.target);
  assert.strictEqual(engine.isSessionComplete, true);
  engine.startNewSession();
  assert.strictEqual(engine.completedRounds, 0);
  assert.strictEqual(engine.correctCount, 0);
  assert.strictEqual(engine.isSessionComplete, false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd ~/development/ABCQuiz
node --test test/app.test.js
```

Expected: failure — `GameEngine` is `undefined`.

- [ ] **Step 3: Implement the minimal code to make the tests pass**

In `app.js`, add the `GameEngine` class after `randomCasing` (before the `module.exports` guard at the bottom):

```js
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

class GameEngine {
  constructor(roundsPerSession, mistakeCounts = {}, randomSource = createSystemRandomSource()) {
    this.roundsPerSession = roundsPerSession;
    this.mistakeCounts = { ...mistakeCounts };
    this.completedRounds = 0;
    this.correctCount = 0;
    this.eliminatedLetters = new Set();
    this.randomSource = randomSource;
    this.currentRound = GameEngine.makeRound(this.mistakeCounts, null, this.randomSource);
    this.previousTarget = this.currentRound.target;
  }

  static makeRound(mistakeCounts, excludeLetter, randomSource) {
    const target = weightedRandomLetter(mistakeCounts, excludeLetter, randomSource);
    const distractors = pickDistractors(target, 3, randomSource);
    const choices = shuffleArray(
      [target, ...distractors].map((letter) => ({
        letter,
        isUppercase: randomCasing(randomSource),
      }))
    );
    return { target, choices };
  }

  get isSessionComplete() {
    return this.completedRounds >= this.roundsPerSession;
  }

  submitGuess(letter) {
    if (letter !== this.currentRound.target) {
      this.eliminatedLetters.add(letter);
      this.mistakeCounts[this.currentRound.target] = (this.mistakeCounts[this.currentRound.target] || 0) + 1;
      return 'incorrect';
    }
    this.correctCount++;
    this.completedRounds++;
    return 'correct';
  }

  startNextRound() {
    this.eliminatedLetters = new Set();
    this.previousTarget = this.currentRound.target;
    this.currentRound = GameEngine.makeRound(this.mistakeCounts, this.previousTarget, this.randomSource);
  }

  startNewSession() {
    this.completedRounds = 0;
    this.correctCount = 0;
    this.eliminatedLetters = new Set();
    this.startNextRound();
  }
}
```

Update the `module.exports` block at the bottom of `app.js` to also include `GameEngine`:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    alphabetLetters,
    createSystemRandomSource,
    createStubRandomSource,
    weightedRandomLetter,
    pickDistractors,
    randomCasing,
    GameEngine,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command as Step 2.

Expected: all tests pass (5 from Task 2 + 6 new ones = 11 total).

---

### Task 4: `SettingsStore` — settings and mistake-count persistence (TDD)

**Files:**
- Modify: `app.js`
- Modify: `test/app.test.js`

- [ ] **Step 1: Write the failing tests**

Update the `require` destructuring at the top of `test/app.test.js` to also pull in `SettingsStore` and `createInMemoryStorage`:

```js
const {
  alphabetLetters,
  createStubRandomSource,
  weightedRandomLetter,
  pickDistractors,
  randomCasing,
  GameEngine,
  SettingsStore,
  createInMemoryStorage,
} = require('../app.js');
```

Then add these tests:

```js
test('SettingsStore defaults to expected values when nothing is stored', () => {
  const store = new SettingsStore(createInMemoryStorage());
  assert.strictEqual(store.autoSpeakEnabled, true);
  assert.strictEqual(store.persistMistakes, true);
  assert.strictEqual(store.roundsPerSession, 10);
});

test('SettingsStore saves and loads mistake counts when persistMistakes is enabled', () => {
  const storage = createInMemoryStorage();
  const store = new SettingsStore(storage);
  store.saveMistakeCounts({ B: 2, Q: 1 });
  const reloaded = new SettingsStore(storage);
  assert.deepStrictEqual(reloaded.loadMistakeCounts(), { B: 2, Q: 1 });
});

test('SettingsStore does not save mistake counts when persistMistakes is disabled', () => {
  const storage = createInMemoryStorage();
  const store = new SettingsStore(storage);
  store.setPersistMistakes(false);
  store.saveMistakeCounts({ B: 2 });
  assert.deepStrictEqual(store.loadMistakeCounts(), {});
});

test('SettingsStore setters persist values across reloads', () => {
  const storage = createInMemoryStorage();
  const store = new SettingsStore(storage);
  store.setAutoSpeakEnabled(false);
  store.setRoundsPerSession(15);
  const reloaded = new SettingsStore(storage);
  assert.strictEqual(reloaded.autoSpeakEnabled, false);
  assert.strictEqual(reloaded.roundsPerSession, 15);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd ~/development/ABCQuiz
node --test test/app.test.js
```

Expected: failure — `SettingsStore` and `createInMemoryStorage` are `undefined`.

- [ ] **Step 3: Implement the minimal code to make the tests pass**

In `app.js`, add after the `GameEngine` class (before the `module.exports` guard):

```js
const SETTINGS_KEYS = {
  autoSpeakEnabled: 'autoSpeakEnabled',
  persistMistakes: 'persistMistakes',
  roundsPerSession: 'roundsPerSession',
  mistakeCounts: 'mistakeCounts',
};

function createInMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

class SettingsStore {
  constructor(storage) {
    this.storage = storage;
    const storedAutoSpeak = this.storage.getItem(SETTINGS_KEYS.autoSpeakEnabled);
    this.autoSpeakEnabled = storedAutoSpeak === null ? true : storedAutoSpeak === 'true';
    const storedPersist = this.storage.getItem(SETTINGS_KEYS.persistMistakes);
    this.persistMistakes = storedPersist === null ? true : storedPersist === 'true';
    const storedRounds = this.storage.getItem(SETTINGS_KEYS.roundsPerSession);
    this.roundsPerSession = storedRounds === null ? 10 : parseInt(storedRounds, 10);
  }

  setAutoSpeakEnabled(value) {
    this.autoSpeakEnabled = value;
    this.storage.setItem(SETTINGS_KEYS.autoSpeakEnabled, String(value));
  }

  setPersistMistakes(value) {
    this.persistMistakes = value;
    this.storage.setItem(SETTINGS_KEYS.persistMistakes, String(value));
  }

  setRoundsPerSession(value) {
    this.roundsPerSession = value;
    this.storage.setItem(SETTINGS_KEYS.roundsPerSession, String(value));
  }

  loadMistakeCounts() {
    if (!this.persistMistakes) return {};
    const raw = this.storage.getItem(SETTINGS_KEYS.mistakeCounts);
    return raw ? JSON.parse(raw) : {};
  }

  saveMistakeCounts(counts) {
    if (!this.persistMistakes) return;
    this.storage.setItem(SETTINGS_KEYS.mistakeCounts, JSON.stringify(counts));
  }
}
```

Update the `module.exports` block to also include `SettingsStore` and `createInMemoryStorage`:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    alphabetLetters,
    createSystemRandomSource,
    createStubRandomSource,
    weightedRandomLetter,
    pickDistractors,
    randomCasing,
    GameEngine,
    SettingsStore,
    createInMemoryStorage,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command as Step 2.

Expected: all tests pass (11 from before + 4 new = 15 total).

---

### Task 5: `SpeechService` (browser-only, no automated test)

**Files:**
- Modify: `app.js`

`speechSynthesis` is a browser API with no meaningful Node equivalent, so this is implementation + manual verification (done in Task 7) rather than TDD.

- [ ] **Step 1: Add `SpeechService` to `app.js`**

Add after the `SettingsStore` class (before the `module.exports` guard):

```js
class SpeechService {
  constructor() {
    this.praisePhrases = ["Yes! That's LETTER!", 'Great job!', 'You got it!'];
  }

  speak(letter) {
    this._speakText(letter);
  }

  speakPraise(letter) {
    const phrase = this.praisePhrases[Math.floor(Math.random() * this.praisePhrases.length)];
    this._speakText(phrase.replace('LETTER', letter));
  }

  _speakText(text) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}
```

Note: `SpeechService` is intentionally not added to the `module.exports` block — it's never exercised from Node tests.

- [ ] **Step 2: Confirm requiring the file under Node still works**

Run:
```bash
cd ~/development/ABCQuiz
node --test test/app.test.js
```

Expected: all 15 tests still pass (defining the `SpeechService` class doesn't execute any browser-only code, since `_speakText` is only ever called, never invoked at load time).

---

### Task 6: DOM wiring (`initApp`) and finishing the page

**Files:**
- Modify: `app.js`
- Modify: `index.html` (if any element needs adjusting to match the wiring — expected to already match from Task 1)

This ties `GameEngine`, `SettingsStore`, and `SpeechService` to the actual page. No automated test — verified manually in Task 7.

- [ ] **Step 1: Add the DOM wiring to `app.js`**

Add after the `SpeechService` class (before the `module.exports` guard):

```js
function initApp() {
  const settings = new SettingsStore(window.localStorage);
  const speech = new SpeechService();
  let engine = new GameEngine(settings.roundsPerSession, settings.loadMistakeCounts());

  const letterGrid = document.getElementById('letter-grid');
  const replayButton = document.getElementById('replay-button');
  const settingsButton = document.getElementById('settings-button');
  const settingsSection = document.getElementById('settings-section');
  const settingsCloseButton = document.getElementById('settings-close-button');
  const autoSpeakToggle = document.getElementById('auto-speak-toggle');
  const persistMistakesToggle = document.getElementById('persist-mistakes-toggle');
  const roundsPerSessionInput = document.getElementById('rounds-per-session-input');
  const celebrationSection = document.getElementById('celebration-section');
  const scoreSummary = document.getElementById('score-summary');
  const playAgainButton = document.getElementById('play-again-button');
  const quizSection = document.getElementById('quiz-section');

  function announceCurrentTargetIfNeeded() {
    if (settings.autoSpeakEnabled) {
      speech.speak(engine.currentRound.target);
    }
  }

  function renderRound() {
    letterGrid.innerHTML = '';
    engine.currentRound.choices.forEach((choice) => {
      const button = document.createElement('button');
      button.className = 'letter-card';
      button.textContent = choice.isUppercase ? choice.letter.toUpperCase() : choice.letter.toLowerCase();
      if (engine.eliminatedLetters.has(choice.letter)) {
        button.classList.add('eliminated');
        button.disabled = true;
      }
      button.addEventListener('click', () => onLetterClick(choice.letter, button));
      letterGrid.appendChild(button);
    });
  }

  function showCelebration() {
    quizSection.classList.add('hidden');
    scoreSummary.textContent = `${engine.correctCount}/${engine.roundsPerSession} correct`;
    celebrationSection.classList.remove('hidden');
  }

  function onLetterClick(letter, button) {
    const result = engine.submitGuess(letter);
    settings.saveMistakeCounts(engine.mistakeCounts);
    if (result === 'correct') {
      speech.speakPraise(letter);
      if (engine.isSessionComplete) {
        showCelebration();
      } else {
        engine.startNextRound();
        renderRound();
        announceCurrentTargetIfNeeded();
      }
    } else {
      button.classList.add('shake');
      button.classList.add('eliminated');
      button.disabled = true;
      setTimeout(() => button.classList.remove('shake'), 400);
    }
  }

  replayButton.addEventListener('click', () => speech.speak(engine.currentRound.target));

  settingsButton.addEventListener('click', () => {
    autoSpeakToggle.checked = settings.autoSpeakEnabled;
    persistMistakesToggle.checked = settings.persistMistakes;
    roundsPerSessionInput.value = settings.roundsPerSession;
    quizSection.classList.add('hidden');
    settingsSection.classList.remove('hidden');
  });

  settingsCloseButton.addEventListener('click', () => {
    settings.setAutoSpeakEnabled(autoSpeakToggle.checked);
    settings.setPersistMistakes(persistMistakesToggle.checked);
    settings.setRoundsPerSession(parseInt(roundsPerSessionInput.value, 10) || settings.roundsPerSession);
    settingsSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
  });

  playAgainButton.addEventListener('click', () => {
    engine = new GameEngine(settings.roundsPerSession, engine.mistakeCounts);
    celebrationSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    renderRound();
    announceCurrentTargetIfNeeded();
  });

  renderRound();
  announceCurrentTargetIfNeeded();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initApp);
}
```

- [ ] **Step 2: Confirm requiring the file under Node still works**

Run:
```bash
cd ~/development/ABCQuiz
node --test test/app.test.js
```

Expected: all 15 tests still pass — `initApp` is defined but never called under Node (no `window`), so no `ReferenceError`.

---

### Task 7: Full manual run-through in the browser

**Files:** none (verification only)

- [ ] **Step 1: Open the app**

```bash
cd ~/development/ABCQuiz
open index.html
```

(On Linux, use `xdg-open index.html`; on Windows, `start index.html`.)

- [ ] **Step 2: Walk through the golden path**

1. Confirm the target letter is spoken aloud when the page loads (auto-speak is on by default).
2. Click the speaker emoji and confirm the letter replays.
3. Click a wrong letter: confirm it shakes, dims, and becomes unclickable, and the round does not advance.
4. Click the correct letter: confirm praise is spoken and the next round loads with a new letter (not the same one as before).
5. Play through all rounds (default 10) and confirm the celebration section appears with a correct score (e.g. "8/10 correct"), and the quiz section is hidden.
6. Click "Play Again" and confirm a fresh session starts with the celebration section hidden again.

- [ ] **Step 3: Walk through settings**

1. Click the gear icon, confirm the settings panel shows the current values.
2. Turn off "Speak letter automatically", click Done, confirm the next round's letter is no longer spoken automatically but clicking the replay button still works.
3. Change "Rounds per session" to a smaller number (e.g. 3), click Done, play through a session, and confirm the celebration screen appears after that many rounds.
4. Turn off "Remember missed letters", force a couple of wrong guesses, then reload the page (`Cmd+R` / `F5`) and confirm the letter weighting reset (informal check — the weighting effect is probabilistic, so this is a sanity check rather than a strict assertion).

- [ ] **Step 4: Check the browser console**

Open DevTools (or Safari's Web Inspector) and confirm there are no JavaScript errors printed during any of the above steps.
