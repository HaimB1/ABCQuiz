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

const TRICKY_ROUND_ODDS = 3; // 1-in-N rounds duplicates a distractor letter in both cases

function isTrickyRound(randomSource) {
  return randomSource.nextValue() % TRICKY_ROUND_ODDS === 0;
}

function pickTrickyDistractorLetters(targetLetter, randomSource) {
  const pool = alphabetLetters.filter((letter) => letter !== targetLetter);
  const dupIndex = randomSource.nextValue() % pool.length;
  const dupLetter = pool.splice(dupIndex, 1)[0];
  const otherIndex = randomSource.nextValue() % pool.length;
  const otherLetter = pool.splice(otherIndex, 1)[0];
  return [dupLetter, dupLetter, otherLetter];
}

function assignChoiceCasings(letters, randomSource) {
  const usedCasingByLetter = {};
  return letters.map((letter) => {
    if (letter in usedCasingByLetter) {
      return { letter, isUppercase: !usedCasingByLetter[letter] };
    }
    const isUppercase = randomCasing(randomSource);
    usedCasingByLetter[letter] = isUppercase;
    return { letter, isUppercase };
  });
}

function randomCasing(randomSource) {
  return randomSource.nextValue() % 2 === 0;
}

function letterChoiceDisplayString(choice) {
  return choice.isUppercase ? choice.letter.toUpperCase() : choice.letter.toLowerCase();
}

function findVoiceByURI(voices, voiceURI) {
  if (!voiceURI) return null;
  return voices.find((voice) => voice.voiceURI === voiceURI) || null;
}

function isUsOrUkEnglishVoice(voice) {
  const lang = voice.lang.toLowerCase();
  return lang === 'en-us' || lang === 'en-gb';
}

function shuffleArray(array, randomSource) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomSource.nextValue() % (i + 1);
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
    const distractors = isTrickyRound(randomSource)
      ? pickTrickyDistractorLetters(target, randomSource)
      : pickDistractors(target, 3, randomSource);
    const choices = shuffleArray(assignChoiceCasings([target, ...distractors], randomSource), randomSource);
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

const SETTINGS_KEYS = {
  autoSpeakEnabled: 'autoSpeakEnabled',
  persistMistakes: 'persistMistakes',
  roundsPerSession: 'roundsPerSession',
  mistakeCounts: 'mistakeCounts',
  voiceURI: 'voiceURI',
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
    const parsedRounds = storedRounds === null ? NaN : parseInt(storedRounds, 10);
    this.roundsPerSession = Number.isNaN(parsedRounds) ? 10 : parsedRounds;
    this.voiceURI = this.storage.getItem(SETTINGS_KEYS.voiceURI) || '';
  }

  setAutoSpeakEnabled(value) {
    this.autoSpeakEnabled = Boolean(value);
    this.storage.setItem(SETTINGS_KEYS.autoSpeakEnabled, String(this.autoSpeakEnabled));
  }

  setPersistMistakes(value) {
    this.persistMistakes = Boolean(value);
    this.storage.setItem(SETTINGS_KEYS.persistMistakes, String(this.persistMistakes));
  }

  setRoundsPerSession(value) {
    this.roundsPerSession = value;
    this.storage.setItem(SETTINGS_KEYS.roundsPerSession, String(value));
  }

  setVoiceURI(value) {
    this.voiceURI = value || '';
    this.storage.setItem(SETTINGS_KEYS.voiceURI, this.voiceURI);
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

class SpeechService {
  constructor() {
    this.praisePhrases = ["Yes! That's LETTER!", 'Great job!', 'You got it!'];
    this.voiceURI = '';
  }

  setVoiceURI(voiceURI) {
    this.voiceURI = voiceURI || '';
  }

  speak(letter) {
    this._speakText(letter);
  }

  speakPraise(letter) {
    const phrase = this.praisePhrases[Math.floor(Math.random() * this.praisePhrases.length)];
    this._speakText(phrase.replace('LETTER', letter));
  }

  speakSample() {
    this._speakText("Hi! This is what I sound like.");
  }

  _speakText(text) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const voice = findVoiceByURI(window.speechSynthesis.getVoices(), this.voiceURI);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }
}

function initApp() {
  const settings = new SettingsStore(window.localStorage);
  const speech = new SpeechService();
  speech.setVoiceURI(settings.voiceURI);
  let engine = new GameEngine(settings.roundsPerSession, settings.loadMistakeCounts());

  const letterGrid = document.getElementById('letter-grid');
  const replayButton = document.getElementById('replay-button');
  const settingsButton = document.getElementById('settings-button');
  const settingsSection = document.getElementById('settings-section');
  const settingsCloseButton = document.getElementById('settings-close-button');
  const autoSpeakToggle = document.getElementById('auto-speak-toggle');
  const persistMistakesToggle = document.getElementById('persist-mistakes-toggle');
  const roundsPerSessionInput = document.getElementById('rounds-per-session-input');
  const voiceSelect = document.getElementById('voice-select');
  const voiceTestButton = document.getElementById('voice-test-button');
  const celebrationSection = document.getElementById('celebration-section');
  const scoreSummary = document.getElementById('score-summary');
  const playAgainButton = document.getElementById('play-again-button');
  const quizSection = document.getElementById('quiz-section');

  function populateVoiceOptions() {
    const voices = window.speechSynthesis.getVoices().filter(isUsOrUkEnglishVoice);
    voiceSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Default';
    voiceSelect.appendChild(defaultOption);
    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });
    voiceSelect.value = settings.voiceURI;
  }

  if (typeof window.speechSynthesis !== 'undefined') {
    populateVoiceOptions();
    window.speechSynthesis.addEventListener('voiceschanged', populateVoiceOptions);
  }

  function currentTargetDisplayString() {
    const targetChoice = engine.currentRound.choices.find((choice) => choice.letter === engine.currentRound.target);
    return letterChoiceDisplayString(targetChoice);
  }

  function announceCurrentTargetIfNeeded() {
    if (settings.autoSpeakEnabled) {
      speech.speak(currentTargetDisplayString());
    }
  }

  function renderRound() {
    letterGrid.innerHTML = '';
    engine.currentRound.choices.forEach((choice) => {
      const button = document.createElement('button');
      button.className = 'letter-card';
      button.textContent = letterChoiceDisplayString(choice);
      button.dataset.letter = choice.letter;
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
      speech.speakPraise(button.textContent);
      if (engine.isSessionComplete) {
        showCelebration();
      } else {
        engine.startNextRound();
        renderRound();
        announceCurrentTargetIfNeeded();
      }
    } else {
      button.classList.add('shake');
      setTimeout(() => button.classList.remove('shake'), 400);
      letterGrid.querySelectorAll(`[data-letter="${letter}"]`).forEach((matchingButton) => {
        matchingButton.classList.add('eliminated');
        matchingButton.disabled = true;
      });
    }
  }

  replayButton.addEventListener('click', () => speech.speak(currentTargetDisplayString()));

  voiceTestButton.addEventListener('click', () => {
    speech.setVoiceURI(voiceSelect.value);
    speech.speakSample();
  });

  settingsButton.addEventListener('click', () => {
    autoSpeakToggle.checked = settings.autoSpeakEnabled;
    persistMistakesToggle.checked = settings.persistMistakes;
    roundsPerSessionInput.value = settings.roundsPerSession;
    voiceSelect.value = settings.voiceURI;
    quizSection.classList.add('hidden');
    settingsSection.classList.remove('hidden');
  });

  settingsCloseButton.addEventListener('click', () => {
    settings.setAutoSpeakEnabled(autoSpeakToggle.checked);
    settings.setPersistMistakes(persistMistakesToggle.checked);
    settings.setRoundsPerSession(parseInt(roundsPerSessionInput.value, 10) || settings.roundsPerSession);
    settings.setVoiceURI(voiceSelect.value);
    speech.setVoiceURI(settings.voiceURI);
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

// Keep this block last — later additions to this file go above it, not below.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    alphabetLetters,
    createSystemRandomSource,
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
    createInMemoryStorage,
  };
}
