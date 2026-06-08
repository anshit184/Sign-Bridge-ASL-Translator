// ═══════════════════════════════════════════
//  SPEECH TO SIGN MODULE
//  Handles: text → ASL letter sequence, sign image display
// ═══════════════════════════════════════════

class SpeechToSign {
  constructor() {
    this.sequence       = [];   // Array of {letter, char}
    this.currentIndex   = -1;
    this.isPlaying      = false;
    this.isPaused       = false;
    this.playbackSpeed  = 800;  // ms per sign
    this.playTimer      = null;
    this.recognition    = null;
    this.isListening    = false;

    // Callbacks
    this.onSignChange    = null;
    this.onPlaybackEnd   = null;
    this.onProgressChange= null;
    this.onTranscript    = null;
    this.onMicState      = null;

    this._initSpeechRecognition();
  }

  // Parse text into letter sequence
  parseText(text) {
    this.stop();
    this.sequence = [];
    this.currentIndex = -1;

    const upper = text.toUpperCase().replace(/[^A-Z\s]/g, '');

    for (let i = 0; i < upper.length; i++) {
      const ch = upper[i];
      if (ch === ' ') {
        this.sequence.push({ letter: ' ', char: ' ', isSpace: true });
      } else if (/[A-Z]/.test(ch)) {
        this.sequence.push({ letter: ch, char: ch, isSpace: false });
      }
    }

    return this.sequence;
  }

  play() {
    if (this.sequence.length === 0) return;
    if (this.isPaused) {
      this.isPaused = false;
      this.isPlaying = true;
      this._next();
      return;
    }
    this.isPlaying = true;
    this.isPaused  = false;
    this.currentIndex = -1;
    this._next();
  }

  pause() {
    this.isPlaying = false;
    this.isPaused  = true;
    if (this.playTimer) clearTimeout(this.playTimer);
  }

  stop() {
    this.isPlaying = false;
    this.isPaused  = false;
    if (this.playTimer) clearTimeout(this.playTimer);
    this.currentIndex = -1;
  }

  next() {
    if (this.currentIndex < this.sequence.length - 1) {
      clearTimeout(this.playTimer);
      this.currentIndex++;
      this._showCurrent();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      clearTimeout(this.playTimer);
      this.currentIndex--;
      this._showCurrent();
    }
  }

  goTo(index) {
    if (index >= 0 && index < this.sequence.length) {
      this.currentIndex = index;
      this._showCurrent();
    }
  }

  _next() {
    if (!this.isPlaying) return;

    this.currentIndex++;

    if (this.currentIndex >= this.sequence.length) {
      this.isPlaying = false;
      if (this.onPlaybackEnd) this.onPlaybackEnd();
      return;
    }

    this._showCurrent();

    const item = this.sequence[this.currentIndex];
    const delay = item.isSpace ? this.playbackSpeed * 0.5 : this.playbackSpeed;

    this.playTimer = setTimeout(() => this._next(), delay);
  }

  _showCurrent() {
    const item = this.sequence[this.currentIndex];
    if (!item) return;

    if (this.onSignChange) this.onSignChange(item, this.currentIndex, this.sequence.length);
    if (this.onProgressChange) {
      this.onProgressChange(this.currentIndex + 1, this.sequence.length);
    }
  }

  setSpeed(ms) {
    this.playbackSpeed = ms;
  }

  // ── SPEECH RECOGNITION ──
  _initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      if (this.onTranscript) this.onTranscript(transcript, event.results[0].isFinal);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onMicState) this.onMicState(false);
    };

    this.recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      this.isListening = false;
      if (this.onMicState) this.onMicState(false);
    };
  }

  startListening() {
    if (!this.recognition || this.isListening) return false;
    try {
      this.recognition.start();
      this.isListening = true;
      if (this.onMicState) this.onMicState(true);
      return true;
    } catch(e) {
      return false;
    }
  }

  stopListening() {
    if (!this.recognition || !this.isListening) return;
    this.recognition.stop();
    this.isListening = false;
    if (this.onMicState) this.onMicState(false);
  }

  toggleMic() {
    if (this.isListening) {
      this.stopListening();
    } else {
      return this.startListening();
    }
  }

  // Generate a canvas-based sign image for a letter
  // (Used when no external image is available)
  generateSignCanvas(letter, size = 200) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const color = ASL_COLORS[letter] || '#00e5ff';

    // Background
    ctx.fillStyle = '#0e1117';
    ctx.fillRect(0, 0, size, size);

    // Hexagon border
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = size/2 + (size/2 - 10) * Math.cos(angle);
      const y = size/2 + (size/2 - 10) * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;

    // Emoji / letter
    const signData = ASL_SIGNS[letter];
    if (signData) {
      ctx.font = `${size * 0.42}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(signData.emoji, size/2, size/2 - 10);
    }

    // Letter label
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = `bold ${size * 0.18}px 'Syne', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(letter, size/2, size - 10);

    return canvas.toDataURL();
  }
}
