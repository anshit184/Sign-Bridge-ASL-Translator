// ═══════════════════════════════════════════
//  SIGNBRIDGE — MAIN APP
//  Wires all modules together
//
//  CHANGES vs original:
//   Task 4 — onWordUpdate: wordDisplay rebuilt with createElement / textContent
//             (no more innerHTML string interpolation → XSS-safe)
//   Task 5 — Custom gesture capture panel wired to detector.saveCustomGesture()
//             Saved gestures list rendered and persists across reloads.
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ─── LOADER ─────────────────────────────
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 2200);

  // ─── MODULE INSTANCES ───────────────────
  const detector   = new HandDetector();
  const s2speech   = new SignToSpeech();
  const speech2sign= new SpeechToSign();

  // ─── DOM REFS: SIGN-TO-SPEECH ────────────
  const webcam          = document.getElementById('webcam');
  const overlay         = document.getElementById('overlayCanvas');
  const placeholder     = document.getElementById('videoPlaceholder');
  const cameraStatus    = document.getElementById('cameraStatus');
  const startCamBtn     = document.getElementById('startCameraBtn');
  const stopCamBtn      = document.getElementById('stopCameraBtn');
  const toggleDetBtn    = document.getElementById('toggleDetectionBtn');
  const flipBtn         = document.getElementById('flipCameraBtn');
  const bigLetter       = document.getElementById('bigLetter');
  const wordDisplay     = document.getElementById('wordDisplay');
  const letterStream    = document.getElementById('letterStream');
  const sentenceDisplay = document.getElementById('sentenceDisplay');
  const speakBtn        = document.getElementById('speakBtn');
  const copySentBtn     = document.getElementById('copySentenceBtn');
  const voiceSelect     = document.getElementById('voiceSelect');
  const speechSpeed     = document.getElementById('speechSpeed');
  const speedVal        = document.getElementById('speedVal');
  const statFps         = document.getElementById('statFps');
  const statLatency     = document.getElementById('statLatency');
  const statLetters     = document.getElementById('statLetters');
  const holdRing        = document.getElementById('holdRing');
  const holdLetter      = document.getElementById('holdLetter');
  const confidenceFill  = document.getElementById('confidenceFill');
  const confidencePct   = document.getElementById('confidencePct');
  const detectedBadge   = document.getElementById('detectedBadge');
  const addSpaceBtn     = document.getElementById('addSpaceBtn');
  const backspaceBtn    = document.getElementById('backspaceBtn');
  const clearWordBtn    = document.getElementById('clearWordBtn');
  const addWordBtn      = document.getElementById('addWordBtn');
  const clearSentBtn    = document.getElementById('clearSentenceBtn');
  const signGrid        = document.getElementById('signGrid');
  const toggleRef       = document.getElementById('toggleReference');

  // ── Task 5: Custom gesture DOM refs ────────────────────────────────────
  const captureGestureBtn  = document.getElementById('captureGestureBtn');
  const gestureMeaningInput= document.getElementById('gestureMeaning');
  const savedGestureList   = document.getElementById('savedGestureList');
  const clearGesturesBtn   = document.getElementById('clearGesturesBtn');

  // ─── DOM REFS: SPEECH-TO-SIGN ────────────
  const textInput          = document.getElementById('textInput');
  const charCount          = document.getElementById('charCount');
  const micBtn             = document.getElementById('micBtn');
  const translateBtn       = document.getElementById('translateBtn');
  const autoPlayBtn        = document.getElementById('autoPlayBtn');
  const clearTextBtn       = document.getElementById('clearTextBtn');
  const playbackControls   = document.getElementById('playbackControls');
  const prevSignBtn        = document.getElementById('prevSignBtn');
  const playPauseBtn       = document.getElementById('playPauseBtn');
  const nextSignBtn        = document.getElementById('nextSignBtn');
  const progressFill       = document.getElementById('progressFill');
  const progressText       = document.getElementById('progressText');
  const signSpeedInput     = document.getElementById('signSpeed');
  const signSpeedVal       = document.getElementById('signSpeedVal');
  const signImage          = document.getElementById('signImage');
  const signPlaceholder    = document.getElementById('signPlaceholder');
  const signLetterOverlay  = document.getElementById('signLetterOverlay');
  const currentSignLabel   = document.getElementById('currentSignLabel');
  const letterSequence     = document.getElementById('letterSequence');
  const signWordContext    = document.getElementById('signWordContext');

  let letterCount  = 0;
  let cameraActive = false;
  let mirrored     = true;

  // ══════════════════════════════════════════
  //  TAB NAVIGATION
  // ══════════════════════════════════════════
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ══════════════════════════════════════════
  //  SIGN REFERENCE GRID
  // ══════════════════════════════════════════
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
    const chip = document.createElement('div');
    chip.className = 'sign-chip';
    chip.innerHTML = `
      <span class="sign-chip-letter">${letter}</span>
      <span class="sign-chip-emoji">${ASL_SIGNS[letter]?.emoji || '?'}</span>
    `;
    chip.title = ASL_SIGNS[letter]?.hint || letter;
    chip.addEventListener('click', () => {
      showToast(`${letter}: ${ASL_SIGNS[letter]?.description || ''}`, 'info');
    });
    signGrid.appendChild(chip);
  });

  toggleRef.addEventListener('click', () => {
    const isCollapsed = signGrid.classList.toggle('collapsed');
    toggleRef.textContent = isCollapsed ? 'Show' : 'Hide';
  });

  // ══════════════════════════════════════════
  //  CAMERA — START / STOP
  // ══════════════════════════════════════════
  startCamBtn.addEventListener('click', async () => {
    startCamBtn.disabled    = true;
    startCamBtn.textContent = '⏳ Starting...';

    try {
      await detector.init(webcam, overlay);
      await detector.startCamera(webcam);

      placeholder.classList.add('hidden');
      startCamBtn.classList.add('hidden');
      stopCamBtn.classList.remove('hidden');
      toggleDetBtn.disabled = false;
      flipBtn.disabled      = false;
      cameraActive          = true;

      cameraStatus.innerHTML = `<span class="status-dot on"></span><span>Live</span>`;
      showToast('Camera started!', 'success');

      // Enable capture button once camera is live
      if (captureGestureBtn) captureGestureBtn.disabled = false;

    } catch (err) {
      startCamBtn.disabled    = false;
      startCamBtn.textContent = '▶ Start Camera';
      if (err.name === 'NotAllowedError') {
        showToast('Camera permission denied. Please allow camera access.', 'error');
      } else {
        showToast('Camera error: ' + err.message, 'error');
      }
    }
  });

  stopCamBtn.addEventListener('click', () => {
    detector.stopCamera();
    webcam.srcObject = null;
    placeholder.classList.remove('hidden');
    stopCamBtn.classList.add('hidden');
    startCamBtn.classList.remove('hidden');
    startCamBtn.disabled        = false;
    startCamBtn.innerHTML       = '<span class="btn-icon">▶</span> Start Camera';
    toggleDetBtn.disabled       = true;
    flipBtn.disabled            = true;
    cameraActive                = false;
    cameraStatus.innerHTML      = `<span class="status-dot off"></span><span>Camera Off</span>`;
    bigLetter.textContent       = '—';
    confidenceFill.style.width  = '0%';
    confidencePct.textContent   = '0%';
    detectedBadge.style.opacity = '0';
    if (captureGestureBtn) captureGestureBtn.disabled = true;
  });

  toggleDetBtn.addEventListener('click', () => {
    const enabled = s2speech.toggleDetection();
    toggleDetBtn.innerHTML   = `<span class="btn-icon">🔍</span> Detection: ${enabled ? 'ON' : 'OFF'}`;
    toggleDetBtn.style.opacity = enabled ? '1' : '0.5';
  });

  flipBtn.addEventListener('click', () => {
    mirrored = !mirrored;
    webcam.style.transform  = mirrored ? 'scaleX(-1)' : 'scaleX(1)';
    overlay.style.transform = mirrored ? 'scaleX(-1)' : 'scaleX(1)';
  });

  // ══════════════════════════════════════════
  //  DETECTOR CALLBACKS
  // ══════════════════════════════════════════
  detector.onLetter = (result) => {
    s2speech.processFame(result);

    const pct = Math.round((result.confidence || 0) * 100);
    confidenceFill.style.width = pct + '%';
    confidencePct.textContent  = pct + '%';

    if (result.letter) {
      detectedBadge.textContent   = result.letter;
      detectedBadge.style.opacity = '1';
      // Dim badge slightly for custom gestures (longer text)
      if (result.isCustom) detectedBadge.style.fontSize = '0.75em';
      else                 detectedBadge.style.fontSize = '';
    } else {
      detectedBadge.style.opacity = '0';
    }
  };

  detector.onFrame = ({ fps, latency }) => {
    statFps.textContent     = fps;
    statLatency.textContent = latency + 'ms';
  };

  // ══════════════════════════════════════════
  //  S2SPEECH CALLBACKS
  // ══════════════════════════════════════════
  s2speech.onCurrentLetter = (letter, confidence) => {
    bigLetter.textContent = letter || '—';
  };

  s2speech.onHoldProgress = (progress, letter) => {
    const deg = Math.round(progress * 360);
    holdRing.style.background =
      `conic-gradient(var(--accent) ${deg}deg, transparent ${deg}deg)`;
    holdLetter.textContent = letter && progress > 0 ? `Holding "${letter}"` : '';
  };

  s2speech.onLetterConfirmed = (letter) => {
    letterCount++;
    statLetters.textContent = letterCount;

    bigLetter.style.color      = 'var(--green)';
    bigLetter.style.textShadow = '0 0 40px var(--green)';
    setTimeout(() => {
      bigLetter.style.color      = '';
      bigLetter.style.textShadow = '';
    }, 300);

    const chip = document.createElement('span');
    chip.className   = 'letter-chip';
    chip.textContent = letter;
    letterStream.appendChild(chip);
    letterStream.scrollTop = letterStream.scrollHeight;

    showToast(`Confirmed: "${letter}"`, 'success');
  };

  // ── Task 4: XSS-safe wordDisplay update ───────────────────────────────
  //
  // BEFORE (vulnerable):
  //   wordDisplay.innerHTML = word
  //     ? word.split('').map(l => `<span style="...">${l}</span>`).join('') + '<span>|</span>'
  //     : '<span class="cursor-blink">|</span>';
  //
  // The interpolated `l` was a single letter from a classifiedresult so the
  // actual injection surface was tiny, but innerHTML with any dynamic content
  // is unsafe by principle (XSS, future refactors, custom gesture meanings).
  //
  // AFTER: DOM is constructed entirely with createElement + textContent.
  // No string ever enters the HTML parser. The visual result is identical.
  //
  s2speech.onWordUpdate = (word) => {
    // Remove all existing children safely
    while (wordDisplay.firstChild) wordDisplay.removeChild(wordDisplay.firstChild);

    if (word) {
      // One <span> per character — styled via the existing CSS class
      for (const char of word) {
        const span = document.createElement('span');
        span.className   = 'word-char';
        span.textContent = char;           // textContent never parses HTML
        wordDisplay.appendChild(span);
      }
    }

    // Blinking cursor — always appended last
    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    cursor.textContent = '|';
    wordDisplay.appendChild(cursor);
  };

  s2speech.onSentenceUpdate = (sentence) => {
    if (sentence.trim()) {
      sentenceDisplay.textContent = sentence;
      speakBtn.disabled = false;
    } else {
      sentenceDisplay.innerHTML = '<em class="placeholder-text">Your sentence will appear here...</em>';
      speakBtn.disabled = true;
    }
  };

  s2speech.onSpeaking = (isSpeaking) => {
    if (isSpeaking) {
      speakBtn.innerHTML = '<span>🔊</span> Speaking...';
      document.body.classList.add('speaking');
    } else {
      speakBtn.innerHTML = '<span>🔊</span> Speak Sentence';
      document.body.classList.remove('speaking');
    }
  };

  // ── Word / Sentence controls ──
  addSpaceBtn.addEventListener('click',  () => s2speech.addSpace());
  backspaceBtn.addEventListener('click', () => s2speech.backspace());
  clearWordBtn.addEventListener('click', () => s2speech.clearWord());
  addWordBtn.addEventListener('click',   () => s2speech.addWordToSentence());
  clearSentBtn.addEventListener('click', () => {
    s2speech.clearSentence();
    letterCount             = 0;
    statLetters.textContent = '0';
    letterStream.innerHTML  = '';
    bigLetter.textContent   = '—';
  });

  speakBtn.addEventListener('click', () => {
    const text = s2speech.getSentenceText();
    if (text) s2speech.speak(text);
  });

  copySentBtn.addEventListener('click', () => {
    const text = s2speech.getSentenceText();
    if (text) navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
  });

  // ── Voice select ──
  s2speech.onVoicesLoaded = (voices) => {
    voiceSelect.innerHTML = '<option value="">Default Voice</option>';
    voices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value       = i;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    });
  };

  voiceSelect.addEventListener('change', () => {
    if (voiceSelect.value !== '') s2speech.setVoice(parseInt(voiceSelect.value));
  });

  speechSpeed.addEventListener('input', () => {
    const val = parseFloat(speechSpeed.value);
    speedVal.textContent = val + 'x';
    s2speech.setRate(val);
  });

  // ══════════════════════════════════════════
  //  TASK 5 — CUSTOM GESTURE CAPTURE
  // ══════════════════════════════════════════
  //
  // Flow:
  //  1. User holds a hand pose in front of the camera.
  //  2. User types a meaning (e.g. "Water") into #gestureMeaning.
  //  3. User clicks "Capture Gesture".
  //  4. app.js reads detector.lastLandmarks (the most recent frame) and
  //     calls detector.saveCustomGesture(meaning, landmarks).
  //  5. The saved gesture list is re-rendered from detector.getCustomGestures().
  //  6. From the next frame onward, classify() checks live landmarks against
  //     saved templates via KNN and returns the meaning if close enough.

  // Render the list of saved gestures (called on load + after each save/clear)
  function _renderSavedGestures() {
    if (!savedGestureList) return;
    const gestures = detector.getCustomGestures();

    while (savedGestureList.firstChild) savedGestureList.removeChild(savedGestureList.firstChild);

    if (!gestures.length) {
      const empty = document.createElement('p');
      empty.className   = 'gesture-empty';
      empty.textContent = 'No custom gestures saved yet.';
      savedGestureList.appendChild(empty);
      return;
    }

    gestures.forEach((g, idx) => {
      const row = document.createElement('div');
      row.className = 'gesture-row';

      // Index badge
      const badge = document.createElement('span');
      badge.className   = 'gesture-badge';
      badge.textContent = `#${idx + 1}`;

      // Meaning label — textContent only, never innerHTML
      const label = document.createElement('span');
      label.className   = 'gesture-label';
      label.textContent = g.meaning;

      // Saved-at timestamp
      const time = document.createElement('span');
      time.className   = 'gesture-time';
      time.textContent = new Date(g.savedAt).toLocaleTimeString();

      row.appendChild(badge);
      row.appendChild(label);
      row.appendChild(time);
      savedGestureList.appendChild(row);
    });
  }

  // Wire up capture button
  if (captureGestureBtn) {
    captureGestureBtn.disabled = true; // enabled once camera starts

    captureGestureBtn.addEventListener('click', () => {
      const meaning = gestureMeaningInput ? gestureMeaningInput.value.trim() : '';
      if (!meaning) {
        showToast('Please enter a meaning for the gesture first.', 'error');
        return;
      }
      if (!detector.lastLandmarks) {
        showToast('No hand detected — show your hand to the camera first.', 'error');
        return;
      }

      const ok = detector.saveCustomGesture(meaning, detector.lastLandmarks);
      if (ok) {
        showToast(`✅ Gesture saved: "${meaning}"`, 'success');
        if (gestureMeaningInput) gestureMeaningInput.value = '';
        _renderSavedGestures();
      } else {
        showToast('Failed to save gesture. Try again.', 'error');
      }
    });
  }

  // Wire up clear-all button
  if (clearGesturesBtn) {
    clearGesturesBtn.addEventListener('click', () => {
      if (!confirm('Clear all saved custom gestures?')) return;
      detector.clearCustomGestures();
      _renderSavedGestures();
      showToast('All custom gestures cleared.', 'info');
    });
  }

  // Render any gestures persisted from a previous session
  _renderSavedGestures();

  // ══════════════════════════════════════════
  //  SPEECH TO SIGN
  // ══════════════════════════════════════════
  textInput.addEventListener('input', () => {
    charCount.textContent = `${textInput.value.length}/200`;
  });

  translateBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) { showToast('Please enter some text first', 'error'); return; }

    const seq = speech2sign.parseText(text);
    if (!seq.length) { showToast('No valid letters found', 'error'); return; }

    _renderLetterSequence(seq);
    playbackControls.style.display = 'flex';
    signPlaceholder.style.display  = 'flex';
    signImage.classList.add('hidden');

    showToast(`Ready! ${seq.filter(s => !s.isSpace).length} signs to display`, 'success');
  });

  autoPlayBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) { showToast('Please enter some text first', 'error'); return; }

    speech2sign.parseText(text);
    _renderLetterSequence(speech2sign.sequence);
    playbackControls.style.display = 'flex';
    speech2sign.play();
    playPauseBtn.textContent = '⏸';
    showToast('Auto-playing signs...', 'info');
  });

  clearTextBtn.addEventListener('click', () => {
    textInput.value                = '';
    charCount.textContent          = '0/200';
    speech2sign.stop();
    letterSequence.innerHTML       = '';
    signImage.classList.add('hidden');
    signPlaceholder.style.display  = 'flex';
    signLetterOverlay.textContent  = '';
    currentSignLabel.textContent   = '—';
    playbackControls.style.display = 'none';
    progressFill.style.width       = '0%';
    progressText.textContent       = '0/0';
  });

  prevSignBtn.addEventListener('click',  () => speech2sign.prev());
  nextSignBtn.addEventListener('click',  () => speech2sign.next());
  playPauseBtn.addEventListener('click', () => {
    if (speech2sign.isPlaying) {
      speech2sign.pause();
      playPauseBtn.textContent = '▶';
    } else {
      speech2sign.play();
      playPauseBtn.textContent = '⏸';
    }
  });

  signSpeedInput.addEventListener('input', () => {
    const ms = parseInt(signSpeedInput.value);
    speech2sign.setSpeed(ms);
    signSpeedVal.textContent = (ms / 1000).toFixed(1) + 's';
  });

  // ── Speech recognition ──
  micBtn.addEventListener('click', () => {
    const ok = speech2sign.toggleMic();
    if (ok === false) showToast('Microphone not available', 'error');
  });

  speech2sign.onMicState = (active) => {
    micBtn.classList.toggle('active', active);
    micBtn.innerHTML = active
      ? '<span class="mic-icon">🔴</span> Listening...'
      : '<span class="mic-icon">🎤</span> Use Microphone';
  };

  speech2sign.onTranscript = (text, isFinal) => {
    textInput.value       = text;
    charCount.textContent = `${text.length}/200`;
    if (isFinal) showToast('Transcript captured!', 'success');
  };

  // ── Sign display callbacks ──
  speech2sign.onSignChange = (item, index, total) => {
    _updateSignDisplay(item, index, total);
  };

  speech2sign.onPlaybackEnd = () => {
    playPauseBtn.textContent = '▶';
    showToast('Playback complete!', 'success');
  };

  speech2sign.onProgressChange = (current, total) => {
    progressFill.style.width  = `${(current / total) * 100}%`;
    progressText.textContent  = `${current}/${total}`;
  };

  function _updateSignDisplay(item, index, total) {
    if (item.isSpace) {
      signImage.classList.add('hidden');
      signPlaceholder.style.display  = 'flex';
      signLetterOverlay.textContent  = '';
      currentSignLabel.textContent   = 'SPACE';
      signWordContext.textContent    = '[ word break ]';
    } else {
      const letter  = item.letter;
      const dataUrl = speech2sign.generateSignCanvas(letter, 200);

      signPlaceholder.style.display = 'none';
      signImage.src                 = dataUrl;
      signImage.classList.remove('hidden');
      signImage.classList.remove('animate-in');
      void signImage.offsetWidth; // force reflow
      signImage.classList.add('animate-in');

      signLetterOverlay.textContent = letter;
      currentSignLabel.textContent  = letter;

      const signData = ASL_SIGNS[letter];
      if (signData) signWordContext.textContent = signData.hint;
    }

    document.querySelectorAll('.seq-chip').forEach((chip, i) => {
      chip.classList.remove('active', 'done');
      if (i === index)    chip.classList.add('active');
      else if (i < index) chip.classList.add('done');
    });
  }

  function _renderLetterSequence(seq) {
    letterSequence.innerHTML = '';
    seq.forEach((item, i) => {
      const chip       = document.createElement('span');
      chip.className   = item.isSpace ? 'seq-chip space-chip' : 'seq-chip';
      chip.textContent = item.isSpace ? '␣' : item.letter;
      chip.addEventListener('click', () => speech2sign.goTo(i));
      letterSequence.appendChild(chip);
    });
  }

  // ══════════════════════════════════════════
  //  TOAST NOTIFICATIONS
  // ══════════════════════════════════════════
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast     = document.createElement('div');
    toast.className   = `toast ${type}`;
    toast.textContent = message;           // textContent, not innerHTML
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  window.showToast = showToast;

  // ══════════════════════════════════════════
  //  KEYBOARD SHORTCUTS
  // ══════════════════════════════════════════
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('tab-sign2speech').classList.contains('active')) return;
    if (e.code === 'Space'     && e.target === document.body) { e.preventDefault(); s2speech.addSpace(); }
    if (e.code === 'Backspace' && e.target === document.body) { e.preventDefault(); s2speech.backspace(); }
    if (e.code === 'Enter'     && e.target === document.body) { e.preventDefault(); s2speech.addWordToSentence(); }
  });

  // ══════════════════════════════════════════
  //  INITIAL TOAST
  // ══════════════════════════════════════════
  setTimeout(() => {
    showToast('Welcome to SignBridge! Click "Start Camera" to begin.', 'info');
  }, 2500);

});
