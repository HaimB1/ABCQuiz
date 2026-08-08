# ABC Letter Quiz — Design Spec

## Context

The goal is a small app that teaches a young kid the alphabet: the app speaks a letter aloud, and the kid picks the matching letter out of four displayed choices (mixed uppercase/lowercase). The app is a personal/family tool.

This spec is split into two parts: the **game definition** (the rules of play — platform-independent) and the **app details** (how it's built and delivered). Keeping these separate means the game logic can be reasoned about and tested on its own, without pulling in platform-specific concerns.

**Platform note:** this was originally scoped as a native iOS app, but was switched to a plain browser-based web app to avoid the overhead of Xcode project setup and iOS Simulator runtime installation. Part 1 (game definition) was written to be platform-independent and carried over unchanged; only Part 2 (app details) reflects the web implementation.

---

## Part 1: Game Definition

### Core Game Loop

1. Game starts and immediately begins a **session** of `roundsPerSession` rounds (default 10, configurable).
2. Each round:
   - Pick a target letter (see Selection Logic).
   - Pick 3 other distinct letters at random as distractors.
   - Assign each of the 4 letters (target + 3 distractors) an independently random case (upper/lower).
   - Shuffle the 4 into random display positions.
   - The target letter is announced (spoken aloud by the app). A manual replay is always available; whether it's *also* announced automatically at the start of the round is a configurable setting (`autoSpeakEnabled`).
3. On a guess:
   - **Correct**: positive feedback (sound/animation/spoken praise), then advance to the next round.
   - **Wrong**: gentle negative feedback (sound/shake), the wrongly-picked letter is eliminated as a hint (can't be picked again this round), and the round continues — the kid keeps guessing among the remaining options until they find the target.
4. After `roundsPerSession` rounds, the session ends with a score summary (e.g. "8/10 correct") and an option to start a new session.

### Data Model

- `letters`: the 26 letters A–Z.
- `mistakeCounts`: a per-letter count of how many times that letter was wrongly guessed as a target (i.e., the kid picked wrong when this letter was the target).
- `Round`: target letter + 4 (letter, case) choices + their display positions.

### Selection Logic

- **Target selection**: weighted random across all 26 letters, weight = `1 + mistakeCounts[letter]`. Letters the kid struggles with more are favored, but every letter remains reachable (weight never drops to 0). The same letter is never chosen as target twice in a row.
- **Distractor selection**: 3 letters chosen uniformly at random, excluding the target and each other (so all 4 displayed letters are always distinct identities).
- **Case assignment**: each of the 4 displayed letters independently gets uppercase or lowercase at random — the same letter identity can appear as either case in different rounds.

### Configuration

- `autoSpeakEnabled` (default `true`): whether the target letter is spoken automatically at the start of each round, in addition to the always-available manual replay.
- `persistMistakes` (default `true`): whether `mistakeCounts` is remembered across app restarts, or reset to empty each time the app launches.
- `roundsPerSession` (default `10`): number of rounds per session before the score summary is shown.

### Feedback Rules

- Correct guess → positive audio/visual feedback + spoken praise (varied phrasing, e.g. "Yes! That's B!", "Great job!") → advance immediately.
- Wrong guess → negative audio/visual feedback (no advance) → that letter option becomes disabled/eliminated for the remainder of the round → mistake is recorded against the target letter in `mistakeCounts`.
- A round always counts toward the session length once the target is found, regardless of how many wrong guesses preceded it. It only counts toward the session's final "correct" score if the target was found on the *first* attempt — a mistake that's later corrected still ends that round, but is not forgiven in the score.

---

## Part 2: App Details (Web)

### Platform & Distribution

- Plain HTML/CSS/JS — no framework, no build step, no dependencies.
- Runs by opening `index.html` directly in a browser (or serving it with `python3 -m http.server` if a `file://` origin ever causes friction with browser APIs).
- Project lives at `~/development/ABCQuiz`, as its own git repository, separate from the applemsp_skylark firmware repo.

### Screens & Layout

Single page (`index.html`) — the settings panel and celebration screen are sections within the same page (shown/hidden), not separate HTML files:

- **Quiz section** (default view): a large speaker/replay icon/button at the top (no reliance on text, since pre-readers can't read a written prompt — the icon plus spoken audio carries the instruction); below it, a 2×2 grid of large clickable letter cards; a gear icon in a corner opens the Settings panel (no parental gate — direct access).
- **Letter card**: large rounded box, big letter glyph, shake animation on a wrong click, dimmed/disabled visual state once eliminated for the round.
- **Settings panel**: toggles for `autoSpeakEnabled` and `persistMistakes`, and a number input/stepper for `roundsPerSession`.
- **Celebration section**: shown after a session ends — displays the score summary and a "Play Again" button that starts a fresh session, returning to the Quiz section.

### Architecture

Everything lives in a single `app.js` — game engine, speech wrapper, settings/storage, and DOM wiring — per the request to keep logic consolidated rather than split across many small files:

- Game engine (round state, selection logic, mistake tracking, score) implements Part 1 as plain, DOM-free JS functions/classes, exported for testing.
- A thin wrapper over the browser's `speechSynthesis` API speaks a single letter, and a small set of praise phrases is spoken on correct answers. Any new speech request cancels in-flight speech to avoid overlap.
- A settings/storage layer wraps `localStorage` (via an injected storage object so tests can substitute an in-memory fake, since Node has no real `localStorage`) to persist `autoSpeakEnabled`, `persistMistakes`, `roundsPerSession`, and (when `persistMistakes` is on) the mistake counts.
- DOM wiring reads state from the game engine and updates the page; click handlers call into the game engine and re-render.

### Project Structure

```
ABCQuiz/
  index.html
  styles.css
  app.js
  test/
    app.test.js
```

### Testing / Verification

- The game-definition logic in Part 1 (weighted target selection, no-repeat-target-twice-in-a-row, distractor/case assignment, mistake tracking) is unit-testable using Node's built-in `node:test` + `node:assert` (no npm install needed) — the test file imports the pure, DOM-free exports from `app.js` and runs them directly in Node.
- The browser-only parts (speech, `localStorage`, DOM wiring) are verified manually: open `index.html` in a browser and play through multiple rounds checking speech playback, correct/wrong feedback and elimination-hint behavior, settings toggles taking effect, and the celebration screen appearing after the configured round count.
