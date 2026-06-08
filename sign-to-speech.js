// ═══════════════════════════════════════════
//  SIGN TO SPEECH MODULE
//  Handles: letter buffering, word building, TTS
//
//  CHANGES vs original:
//   Task 3 — processFrame() now uses a 6-frame rolling buffer.
//             A new letter is accepted only when it is the consensus
//             (strict majority) across the recent frame history.
//             Also fixes the original typo: processFame → processFrame
//             (backward-compat alias retained so app.js works unchanged).
// ═══════════════════════════════════════════

class SignToSpeech {
  constructor() {
    this.currentWord    = '';
    this.sentence       = [];
    this.currentLetter  = null;
    this.letterHoldTime = 0;
    this.holdThreshold  = 1200; // ms to hold before confirming
    this.lastConfirmed  = null;
    this.holdTimer      = null;
    this.holdProgress   = 0;
    this.detectionEnabled = true;
    this.isSpeaking     = false;
    this.voices         = [];
    this.selectedVoice  = null;
    this.speechRate     = 1;
    this.autoCapture    = true;

    // ── Task 3: Frame buffer ──────────────────────────────────────────────
    // A ring buffer of the last BUFFER_SIZE raw detections.  We only advance
    // the hold-timer state machine when the incoming letter is also the strict
    // majority winner across the buffer, filtering out 1–2 frame glitches.
    this._BUFFER_SIZE = 6;
    this._frameBuffer = []; // stores raw letter strings (or null)

    // Callbacks
    this.onLetterConfirmed = null;
    this.onWordUpdate      = null;
    this.onSentenceUpdate  = null;
    this.onSpeaking        = null;

    this._initTTS();
  }

  _initTTS() {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.onVoicesLoaded) this.onVoicesLoaded(this.voices);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  // ── Task 3: buffered processFrame ─────────────────────────────────────
  //
  // Algorithm:
  //  1. Push the raw detected letter into the sliding window.
  //  2. Compute the mode (most-frequent value) in the window.
  //  3. A letter is the "consensus" only when:
  //       a. It IS the mode, AND
  //       b. Its frequency is a strict majority (> BUFFER_SIZE / 2).
  //     This means a single rogue frame cannot shift the consensus.
  //  4. The raw letter still feeds `onCurrentLetter` immediately so the
  //     UI remains responsive, but the hold-timer logic runs only on the
  //     smoothed consensus value.
  //
  processFrame(detectionResult) {
    if (!this.detectionEnabled) return;
    const { letter, confidence } = detectionResult;

    // ── Step 1: update rolling buffer ─────────────────────────────────────
    this._frameBuffer.push(letter);
    if (this._frameBuffer.length > this._BUFFER_SIZE) {
      this._frameBuffer.shift();
    }

    // ── Step 2: compute consensus ─────────────────────────────────────────
    const consensus = this._consensus(this._frameBuffer);

    // Always update the live display with the raw detection (snappy UI).
    if (this.onCurrentLetter) {
      this.onCurrentLetter(letter, confidence);
    }

    // ── Step 3: guard — only drive state machine with the consensus value ──
    // If the raw detection is not the consensus, it's noise — do nothing.
    if (letter !== consensus) return;

    // From here the logic is identical to the original, but operating on
    // the smoothed signal rather than the raw per-frame detection.
    if (!consensus) {
      this._resetHold();
      return;
    }

    if (consensus === this.currentLetter) {
      const elapsed    = performance.now() - this.letterHoldTime;
      this.holdProgress = Math.min(1, elapsed / this.holdThreshold);
      if (this.onHoldProgress) this.onHoldProgress(this.holdProgress, consensus);
      if (elapsed >= this.holdThreshold && consensus !== this.lastConfirmed) {
        this._confirmLetter(consensus);
      }
    } else {
      // New stable letter — reset hold timer
      this.currentLetter  = consensus;
      this.letterHoldTime = performance.now();
      this.holdProgress   = 0;
      this.lastConfirmed  = null;
      if (this.onHoldProgress) this.onHoldProgress(0, consensus);
    }
  }

  // Backward-compat alias — app.js originally called processFame() (typo).
  // This shim means app.js works without modification.
  processFame(detectionResult) {
    return this.processFrame(detectionResult);
  }

  // ── Task 3 helper: strict-majority mode of the frame buffer ─────────────
  //
  // Returns the most-frequent value only if its count exceeds half the buffer
  // size, otherwise returns null (no consensus yet).
  // Ties resolve to null so we never incorrectly accept an ambiguous frame.
  //
  _consensus(arr) {
    if (!arr.length) return null;

    const counts = new Map();
    for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);

    let modeVal   = null;
    let modeCount = 0;
    for (const [v, c] of counts) {
      if (c > modeCount) { modeCount = c; modeVal = v; }
    }

    // Require strict majority: more than half the buffer frames agree.
    return modeCount > this._BUFFER_SIZE / 2 ? modeVal : null;
  }

  _confirmLetter(letter) {
    this.lastConfirmed = letter;
    this.currentWord  += letter;
    if (this.onLetterConfirmed) this.onLetterConfirmed(letter);
    if (this.onWordUpdate)      this.onWordUpdate(this.currentWord);
  }

  _resetHold() {
    this.currentLetter  = null;
    this.letterHoldTime = 0;
    this.holdProgress   = 0;
    this.lastConfirmed  = null;
    if (this.onHoldProgress) this.onHoldProgress(0, null);
  }

  addSpace() {
    if (this.currentWord) {
      this.sentence.push(this.currentWord);
      this.currentWord = '';
      if (this.onWordUpdate)      this.onWordUpdate('');
      if (this.onSentenceUpdate)  this.onSentenceUpdate(this.sentence.join(' '));
    }
  }

  backspace() {
    if (this.currentWord.length > 0) {
      this.currentWord = this.currentWord.slice(0, -1);
      if (this.onWordUpdate) this.onWordUpdate(this.currentWord);
    }
  }

  clearWord() {
    this.currentWord = '';
    if (this.onWordUpdate) this.onWordUpdate('');
  }

  addWordToSentence() {
    if (this.currentWord.trim()) {
      this.sentence.push(this.currentWord.trim());
      this.currentWord = '';
      if (this.onWordUpdate)     this.onWordUpdate('');
      if (this.onSentenceUpdate) this.onSentenceUpdate(this.sentence.join(' '));
    }
  }

  clearSentence() {
    this.sentence    = [];
    this.currentWord = '';
    if (this.onWordUpdate)     this.onWordUpdate('');
    if (this.onSentenceUpdate) this.onSentenceUpdate('');
  }

  getSentenceText() {
    const full = [...this.sentence];
    if (this.currentWord) full.push(this.currentWord);
    return full.join(' ');
  }

  speak(text, rate) {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();

    const utterance   = new SpeechSynthesisUtterance(text);
    utterance.rate    = rate || this.speechRate;
    utterance.pitch   = 1;
    utterance.volume  = 1;
    if (this.selectedVoice) utterance.voice = this.selectedVoice;

    utterance.onstart = () => { this.isSpeaking = true;  if (this.onSpeaking) this.onSpeaking(true);  };
    utterance.onend   = () => { this.isSpeaking = false; if (this.onSpeaking) this.onSpeaking(false); };
    utterance.onerror = () => { this.isSpeaking = false; if (this.onSpeaking) this.onSpeaking(false); };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    window.speechSynthesis.cancel();
    this.isSpeaking = false;
  }

  setVoice(voiceIndex)  { this.selectedVoice = this.voices[voiceIndex] || null; }
  setRate(rate)         { this.speechRate = parseFloat(rate); }
  setHoldThreshold(ms)  { this.holdThreshold = ms; }

  toggleDetection() {
    this.detectionEnabled = !this.detectionEnabled;
    return this.detectionEnabled;
  }
}
