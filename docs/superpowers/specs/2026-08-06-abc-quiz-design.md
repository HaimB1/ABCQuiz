# ABC Letter Quiz — Design Spec

## Context

The goal is a small iOS app that teaches a young kid the alphabet: the app speaks a letter aloud, and the kid picks the matching letter out of four displayed choices (mixed uppercase/lowercase). The app is a personal/family tool, not intended for App Store distribution.

This spec is split into two parts: the **game definition** (the rules of play — platform-independent, could be unit tested or even ported elsewhere) and the **app details** (how it's built and delivered as an iOS app). Keeping these separate means the game logic can be reasoned about and tested on its own, without pulling in SwiftUI/AVFoundation concerns.

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

---

## Part 2: App Details (iOS)

### Platform & Distribution

- Native iOS app, SwiftUI, targeting iPhone/iPad.
- Installed via Xcode + USB/Wi-Fi debugging with a free Apple ID (no paid Developer Program). App expires after 7 days and is reinstalled by running from Xcode again. No App Store / TestFlight involvement.
- Project lives at `~/development/ABCQuiz`, as its own git repository, separate from the applemsp_skylark firmware repo.

### Screens & Views

- **QuizView** (main screen): top ~40% has a large speaker/replay icon (no reliance on text, since pre-readers can't read a written prompt — the icon plus spoken audio carries the instruction); below it, a 2×2 grid of large tappable letter cards; a gear icon in a corner opens Settings (no parental gate — direct access).
- **LetterCardView**: reusable card component — large rounded rectangle, big letter glyph, shake animation for wrong taps, dimmed/disabled visual state once eliminated, tap gesture handling.
- **SettingsView**: modal/sheet with toggles for `autoSpeakEnabled` and `persistMistakes`, and a stepper/picker for `roundsPerSession`.
- **CelebrationView**: shown after a session ends — displays the score summary and a "Play Again" button that starts a fresh session, returning to QuizView.

### Architecture

Plain SwiftUI + MVVM — no external dependencies or state-management libraries, given the app's scope:

- `GameViewModel` (ObservableObject): owns the game-definition logic (round state, selection logic, mistake tracking, score) as described in Part 1. Views render state provided by the view model and forward taps to it.
- `SpeechService`: thin wrapper around `AVSpeechSynthesizer`. `speak(letter:)` speaks a single letter; a small set of praise phrases is spoken on correct answers. A single shared synthesizer instance is used, and new speech requests cancel any in-flight speech to avoid overlap.
- `SettingsStore`: wraps `UserDefaults` to persist `autoSpeakEnabled`, `persistMistakes`, `roundsPerSession`, and (when `persistMistakes` is on) `mistakeCounts`.

### Project Structure

```
ABCQuiz/
  ABCQuizApp.swift
  ViewModels/GameViewModel.swift
  Services/SpeechService.swift
  Services/SettingsStore.swift
  Views/QuizView.swift
  Views/LetterCardView.swift
  Views/SettingsView.swift
  Views/CelebrationView.swift
  Models/Round.swift        // target letter + 4 (Character, isUpper) choices
```

### Testing / Verification

- The game-definition logic in Part 1 (weighted target selection, no-repeat-target-twice-in-a-row, distractor/case assignment, mistake tracking) is unit-testable with XCTest independent of any UI.
- The app itself is verified manually: build and run in the iOS Simulator (and on-device), play through multiple rounds checking speech playback, correct/wrong feedback and elimination-hint behavior, settings toggles taking effect, and the celebration screen appearing after the configured round count.
