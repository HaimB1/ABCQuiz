const test = require('node:test');
const assert = require('node:assert');
const {
  alphabetLetters,
  createStubRandomSource,
  weightedRandomLetter,
  pickDistractors,
  isTrickyRound,
  pickTrickyDistractorLetters,
  assignChoiceCasings,
  randomCasing,
  letterChoiceDisplayString,
  findVoiceByURI,
  isUsOrUkEnglishVoice,
  GameEngine,
  SettingsStore,
  createSystemRandomSource,
  createInMemoryStorage,
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
  assert.strictEqual(storage.getItem('mistakeCounts'), null);
  store.setPersistMistakes(true);
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

test('SettingsStore defaults voiceURI to empty string when nothing is stored', () => {
  const store = new SettingsStore(createInMemoryStorage());
  assert.strictEqual(store.voiceURI, '');
});

test('SettingsStore saves and loads voiceURI across reloads', () => {
  const storage = createInMemoryStorage();
  const store = new SettingsStore(storage);
  store.setVoiceURI('com.apple.voice.compact.en-US.Samantha');
  const reloaded = new SettingsStore(storage);
  assert.strictEqual(reloaded.voiceURI, 'com.apple.voice.compact.en-US.Samantha');
});

test('findVoiceByURI returns the matching voice by voiceURI', () => {
  const voices = [
    { voiceURI: 'voice-a', name: 'A' },
    { voiceURI: 'voice-b', name: 'B' },
  ];
  assert.strictEqual(findVoiceByURI(voices, 'voice-b'), voices[1]);
});

test('findVoiceByURI returns null when no voice matches or none is requested', () => {
  const voices = [{ voiceURI: 'voice-a', name: 'A' }];
  assert.strictEqual(findVoiceByURI(voices, 'voice-x'), null);
  assert.strictEqual(findVoiceByURI(voices, ''), null);
});

test('isUsOrUkEnglishVoice accepts en-US and en-GB, rejects other languages', () => {
  assert.strictEqual(isUsOrUkEnglishVoice({ lang: 'en-US' }), true);
  assert.strictEqual(isUsOrUkEnglishVoice({ lang: 'en-GB' }), true);
  assert.strictEqual(isUsOrUkEnglishVoice({ lang: 'en-us' }), true);
  assert.strictEqual(isUsOrUkEnglishVoice({ lang: 'fr-FR' }), false);
  assert.strictEqual(isUsOrUkEnglishVoice({ lang: 'en-AU' }), false);
});

test('letterChoiceDisplayString respects isUppercase', () => {
  assert.strictEqual(letterChoiceDisplayString({ letter: 'B', isUppercase: true }), 'B');
  assert.strictEqual(letterChoiceDisplayString({ letter: 'B', isUppercase: false }), 'b');
});

test('isTrickyRound returns true for values divisible by 3, false otherwise', () => {
  const source = createStubRandomSource([0, 1, 2, 3, 4, 5]);
  assert.strictEqual(isTrickyRound(source), true);
  assert.strictEqual(isTrickyRound(source), false);
  assert.strictEqual(isTrickyRound(source), false);
  assert.strictEqual(isTrickyRound(source), true);
});

test('pickTrickyDistractorLetters returns [dup, dup, other], all distinct from the target', () => {
  const source = createStubRandomSource([5, 10]);
  const letters = pickTrickyDistractorLetters('B', source);
  assert.strictEqual(letters.length, 3);
  assert.strictEqual(letters[0], letters[1]);
  assert.notStrictEqual(letters[2], letters[0]);
  assert.ok(!letters.includes('B'));
});

test('assignChoiceCasings gives a duplicated letter opposite cases, unique letters independent cases', () => {
  const source = createStubRandomSource([0, 1]);
  const result = assignChoiceCasings(['G', 'G', 'M'], source);
  assert.deepStrictEqual(result, [
    { letter: 'G', isUppercase: true },
    { letter: 'G', isUppercase: false },
    { letter: 'M', isUppercase: false },
  ]);
});

test('GameEngine.makeRound occasionally produces a tricky round with one non-target letter shown in both cases', () => {
  const source = createSystemRandomSource();
  let sawTrickyRound = false;
  for (let i = 0; i < 300; i++) {
    const round = GameEngine.makeRound({}, null, source);
    assert.strictEqual(round.choices.length, 4);

    const casesByLetter = {};
    round.choices.forEach((choice) => {
      (casesByLetter[choice.letter] = casesByLetter[choice.letter] || []).push(choice.isUppercase);
    });
    const duplicated = Object.entries(casesByLetter).filter(([, cases]) => cases.length > 1);
    assert.ok(duplicated.length <= 1, 'at most one letter should be duplicated per round');

    if (duplicated.length === 1) {
      sawTrickyRound = true;
      const [dupLetter, cases] = duplicated[0];
      assert.strictEqual(cases.length, 2);
      assert.notStrictEqual(cases[0], cases[1], 'the duplicated letter must show both cases');
      assert.notStrictEqual(dupLetter, round.target, 'the target must never be the duplicated letter');
    }
  }
  assert.ok(sawTrickyRound, 'expected at least one tricky round across 300 trials');
});
