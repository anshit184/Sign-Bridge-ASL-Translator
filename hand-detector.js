// ═══════════════════════════════════════════
//  HAND DETECTOR — MediaPipe + ASL Classifier
//  Real-time hand landmark detection & letter classification
//
//  CHANGES vs original:
//   Task 1 — _startProcessing() throttled to 20 FPS with a cancellation token
//   Task 2 — _getFingerStates() rewritten with wrist-origin 3D distance
//   Task 5 — saveCustomGesture() + KNN matching inside classify()
// ═══════════════════════════════════════════

class HandDetector {
  constructor() {
    this.hands         = null;
    this.camera        = null;
    this.isRunning     = false;
    this.lastLandmarks = null;
    this.onLetter      = null;
    this.onFrame       = null;
    this.onHandDetected = null;
    this.onHandLost    = null;
    this.frameCount    = 0;
    this.lastFpsTime   = performance.now();
    this.fps           = 0;
    this.latency       = 0;
    this._frameStart   = 0;
    this.handPresent   = false;

    // ── Task 1: throttle + cancellation ───────────────────────────────────
    // _loopToken is a plain object used as a unique identity stamp.
    // The rAF closure captures the token created at start time; when
    // stopCamera() nulls _loopToken the identity check fails and the loop
    // exits cleanly — even if a callback was already queued by the browser.
    this._loopToken    = null;
    this._TARGET_FPS   = 20;
    this._FRAME_BUDGET = 1000 / this._TARGET_FPS; // 50 ms per frame
    this._lastFrameAt  = 0;

    // ── Task 5: KNN custom gesture store ──────────────────────────────────
    // localStorage key that persists gestures across page reloads.
    this._GESTURE_KEY       = 'signbridge_custom_gestures';
    // Maximum Euclidean distance (in normalised feature space) to be
    // considered a match. Lower = stricter. Tuned empirically.
    this._KNN_THRESHOLD     = 0.75;
    this._customGestures    = this._loadCustomGestures();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  INIT & CAMERA
  // ─────────────────────────────────────────────────────────────────────────
  async init(videoElement, canvasElement) {
    this.video  = videoElement;
    this.canvas = canvasElement;
    this.ctx    = canvasElement.getContext('2d');

    if (typeof Hands === 'undefined') {
      console.warn('MediaPipe Hands not loaded — using simulation mode');
      this.simulationMode = true;
      return;
    }

    this.hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults((results) => this._onResults(results));
    this.simulationMode = false;
  }

  async startCamera(videoElement) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:     { ideal: 640 },
          height:    { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      });

      videoElement.srcObject = stream;
      this.stream = stream;

      await new Promise((resolve) => {
        videoElement.onloadedmetadata = () => { videoElement.play(); resolve(); };
      });

      this.canvas.width  = videoElement.videoWidth  || 640;
      this.canvas.height = videoElement.videoHeight || 480;
      this.isRunning     = true;

      if (this.simulationMode) {
        this._startSimulation();
      } else {
        this._startProcessing(videoElement);
      }

      return true;
    } catch (err) {
      console.error('Camera error:', err);
      throw err;
    }
  }

  // ── Task 1: throttled rAF loop with strict cancellation token ─────────
  //
  // Design:
  //  • A new empty object `token` is minted every time the camera starts.
  //    It is stored on the instance AND captured by the closure.
  //  • Each tick checks `token !== this._loopToken`. While the camera runs,
  //    both point at the same object → loop continues.
  //  • stopCamera() sets `this._loopToken = null`. The very next tick that
  //    fires (even if rAF already queued it) sees the mismatch and returns,
  //    leaving zero orphaned background callbacks.
  //  • Throttling: the rAF timestamp is compared to _lastFrameAt. If the
  //    budget hasn't elapsed we re-arm rAF immediately but skip the costly
  //    hands.send() call — the browser paints at its native rate while
  //    inference is capped at TARGET_FPS.
  //  • A second identity check after `await hands.send()` guards against the
  //    case where stopCamera() is called during the async await.
  //
  _startProcessing(videoElement) {
    const token       = {};   // unique stamp for this camera session
    this._loopToken   = token;
    this._lastFrameAt = 0;

    const tick = async (timestamp) => {
      // ── Cancellation check ─────────────────────────────────────────────
      if (token !== this._loopToken) return;

      // ── Throttle ───────────────────────────────────────────────────────
      if (timestamp - this._lastFrameAt < this._FRAME_BUDGET) {
        requestAnimationFrame(tick);
        return;
      }
      this._lastFrameAt = timestamp;
      this._frameStart  = performance.now();

      // ── MediaPipe inference ────────────────────────────────────────────
      try {
        await this.hands.send({ image: videoElement });
      } catch (_) {
        // Transient frame errors (e.g. video not ready) are non-fatal.
      }

      // ── FPS accounting ─────────────────────────────────────────────────
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.fps       = this.frameCount;
        this.frameCount = 0;
        this.lastFpsTime = now;
      }

      // ── Post-await cancellation check ──────────────────────────────────
      if (token !== this._loopToken) return;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  stopCamera() {
    // Invalidate token → the rAF closure exits on its next tick.
    this._loopToken = null;
    this.isRunning  = false;

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MEDIAPIPE RESULT HANDLER
  // ─────────────────────────────────────────────────────────────────────────
  _onResults(results) {
    this.latency = Math.round(performance.now() - this._frameStart);

    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      this.lastLandmarks = landmarks;

      if (!this.handPresent) {
        this.handPresent = true;
        if (this.onHandDetected) this.onHandDetected();
      }

      this._drawHand(landmarks, w, h);

      const result = this.classify(landmarks);
      if (this.onLetter) this.onLetter(result);
    } else {
      this.lastLandmarks = null;
      if (this.handPresent) {
        this.handPresent = false;
        if (this.onHandLost) this.onHandLost();
      }
      if (this.onLetter) this.onLetter({ letter: null, confidence: 0 });
    }

    if (this.onFrame) this.onFrame({ fps: this.fps, latency: this.latency });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CANVAS DRAWING
  // ─────────────────────────────────────────────────────────────────────────
  _drawHand(landmarks, w, h) {
    const ctx = this.ctx;
    const CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20],
      [5,9],[9,13],[13,17]
    ];

    ctx.strokeStyle = 'rgba(0,229,255,0.5)';
    ctx.lineWidth   = 2;
    CONNECTIONS.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
      ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
      ctx.stroke();
    });

    landmarks.forEach((lm, i) => {
      const x     = lm.x * w;
      const y     = lm.y * h;
      const isTip = [4, 8, 12, 16, 20].includes(i);
      ctx.beginPath();
      ctx.arc(x, y, isTip ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#00e5ff' : 'rgba(0,229,255,0.7)';
      ctx.fill();
      if (isTip) {
        ctx.strokeStyle = 'rgba(0,229,255,0.3)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CLASSIFIER PIPELINE
  // ─────────────────────────────────────────────────────────────────────────

  // ── Task 5: classify() — KNN first, heuristics as fallback ─────────────
  //
  // Before running the standard rule-based matcher we:
  //  1. Normalise the live landmarks into a wrist-relative feature vector.
  //  2. Compute the Euclidean distance to every saved custom gesture vector.
  //  3. If the nearest neighbour is within _KNN_THRESHOLD, return its meaning
  //     immediately so custom gestures always take priority.
  //  4. Otherwise fall through to the standard ASL heuristics.
  //
  classify(lm) {
    // ── KNN custom gesture check ───────────────────────────────────────────
    const liveFeat = this._normaliseLandmarks(lm);
    const knnMatch = this._knnMatch(liveFeat);
    if (knnMatch) {
      return { letter: knnMatch.meaning, confidence: knnMatch.confidence, fingers: null, isCustom: true };
    }

    // ── Standard ASL heuristics ────────────────────────────────────────────
    const f      = this._getFingerStates(lm);
    const letter = this._matchLetter(lm, f);
    const confidence = letter ? this._calcConfidence(lm, f, letter) : 0;
    return { letter, confidence, fingers: f, isCustom: false };
  }

  // ── Task 2: rotation-invariant finger state detection ───────────────────
  //
  // Old approach: `lm[tip].y < lm[pip].y`  — breaks when hand is tilted.
  //
  // New approach: compare 3D Euclidean distances from the WRIST (landmark 0).
  //   • d_pip = ||wrist → PIP||
  //   • d_tip = ||wrist → TIP||
  //   If d_tip > d_pip the fingertip is farther from the wrist than the
  //   intermediate joint → the finger is EXTENDED, regardless of orientation.
  //
  // An adaptive tolerance (5 % of the wrist-to-middle-MCP "hand unit")
  // prevents flapping on borderline postures and scales with camera distance.
  //
  // Thumb special case: the thumb abducts laterally rather than extending
  // dorsally, so we compare TIP vs IP (the thumb's nearest pip-equivalent)
  // and also check lateral separation from the index MCP.
  //
  _getFingerStates(lm) {
    const wrist = lm[LANDMARK.WRIST];

    const d3 = (a, b) => Math.sqrt(
      (a.x - b.x) ** 2 +
      (a.y - b.y) ** 2 +
      ((a.z || 0) - (b.z || 0)) ** 2
    );

    // Normalisation scale: wrist → middle MCP — stable across all rotations
    // and adapts automatically to the hand's distance from the camera.
    const scale     = d3(wrist, lm[LANDMARK.MIDDLE_MCP]) || 0.001;
    const tolerance = 0.05 * scale; // 5 % hysteresis band

    const isExtended = (tipIdx, pipIdx) =>
      d3(wrist, lm[tipIdx]) > d3(wrist, lm[pipIdx]) + tolerance;

    const isBent = (tipIdx, pipIdx) =>
      d3(wrist, lm[tipIdx]) < d3(wrist, lm[pipIdx]) - tolerance;

    // Thumb: use IP as the pip-equivalent; also check lateral abduction.
    const thumbDistFromIndex =
      d3(lm[LANDMARK.THUMB_TIP], lm[LANDMARK.INDEX_MCP]) >
      d3(lm[LANDMARK.THUMB_IP],  lm[LANDMARK.INDEX_MCP]) + tolerance;
    const thumbExtended =
      isExtended(LANDMARK.THUMB_TIP, LANDMARK.THUMB_IP) || thumbDistFromIndex;

    return {
      thumb:  thumbExtended,
      index:  isExtended(LANDMARK.INDEX_TIP,  LANDMARK.INDEX_PIP),
      middle: isExtended(LANDMARK.MIDDLE_TIP, LANDMARK.MIDDLE_PIP),
      ring:   isExtended(LANDMARK.RING_TIP,   LANDMARK.RING_PIP),
      pinky:  isExtended(LANDMARK.PINKY_TIP,  LANDMARK.PINKY_PIP),
      thumbBent:  isBent(LANDMARK.THUMB_TIP,  LANDMARK.THUMB_IP),
      indexBent:  isBent(LANDMARK.INDEX_TIP,  LANDMARK.INDEX_PIP),
      middleBent: isBent(LANDMARK.MIDDLE_TIP, LANDMARK.MIDDLE_PIP),
      ringBent:   isBent(LANDMARK.RING_TIP,   LANDMARK.RING_PIP),
      pinkyBent:  isBent(LANDMARK.PINKY_TIP,  LANDMARK.PINKY_PIP),
    };
  }

  // Utility: 3D Euclidean distance between two landmark objects
  _dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  }

  _matchLetter(lm, f) {
    const T    = lm[LANDMARK.THUMB_TIP];
    const I    = lm[LANDMARK.INDEX_TIP];
    const M    = lm[LANDMARK.MIDDLE_TIP];
    const R    = lm[LANDMARK.RING_TIP];
    const P    = lm[LANDMARK.PINKY_TIP];
    const IPIP = lm[LANDMARK.INDEX_PIP];
    const MPIP = lm[LANDMARK.MIDDLE_PIP];

    const iClose = (a, b, thresh = 0.08) => this._dist(a, b) < thresh;

    if (!f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (T.y > lm[LANDMARK.INDEX_MCP].y) return 'A';
    }
    if (f.index && f.middle && f.ring && f.pinky && !f.thumb) {
      if (Math.abs(I.x - M.x) < 0.05) return 'B';
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky) {
      if (iClose(T, I, 0.15) && lm[LANDMARK.INDEX_PIP].y > lm[LANDMARK.INDEX_TIP].y - 0.05) {
        if (lm[LANDMARK.INDEX_TIP].x - T.x > 0.05) return 'C';
      }
    }
    if (f.index && !f.middle && !f.ring && !f.pinky) {
      if (iClose(T, M, 0.07)) return 'D';
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (T.y > lm[LANDMARK.INDEX_PIP].y) return 'E';
    }
    if (!f.index && f.middle && f.ring && f.pinky) {
      if (iClose(T, I, 0.06)) return 'F';
    }
    if (f.index && !f.middle && !f.ring && !f.pinky && f.thumb) {
      if (Math.abs(I.y - IPIP.y) < 0.05) return 'G';
    }
    if (f.index && f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (Math.abs(I.y - M.y) < 0.05) return 'H';
    }
    if (!f.index && !f.middle && !f.ring && f.pinky && !f.thumb) return 'I';
    if (f.index && f.middle && !f.ring && !f.pinky) {
      if (f.thumb && iClose(T, MPIP, 0.1)) return 'K';
    }
    if (f.index && !f.middle && !f.ring && !f.pinky && f.thumb) {
      if (I.y < lm[LANDMARK.INDEX_MCP].y - 0.1) return 'L';
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
      const over = (tip) => lm[tip].y > T.y - 0.03;
      if (over(LANDMARK.INDEX_TIP) && over(LANDMARK.MIDDLE_TIP) && over(LANDMARK.RING_TIP)) return 'M';
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (lm[LANDMARK.INDEX_TIP].y  > T.y - 0.03 &&
          lm[LANDMARK.MIDDLE_TIP].y > T.y - 0.03 &&
          lm[LANDMARK.RING_TIP].y   < T.y - 0.03) return 'N';
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky) {
      if (iClose(T, I, 0.06) && iClose(T, M, 0.09) && iClose(T, R, 0.12)) return 'O';
    }
    if (f.index && !f.middle && !f.ring && !f.pinky && f.thumb) {
      if (I.y > lm[LANDMARK.INDEX_MCP].y + 0.05) return 'Q';
    }
    if (f.index && f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (Math.abs(I.x - M.x) < 0.03 && I.x > M.x + 0.01) return 'R';
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (T.y < lm[LANDMARK.INDEX_PIP].y) return 'S';
    }
    if (!f.index && !f.middle && !f.ring && !f.pinky) {
      if (T.y < lm[LANDMARK.INDEX_TIP].y && T.x > lm[LANDMARK.INDEX_MCP].x) return 'T';
    }
    if (f.index && f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (Math.abs(I.x - M.x) < 0.04) return 'U';
    }
    if (f.index && f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (Math.abs(I.x - M.x) >= 0.04) return 'V';
    }
    if (f.index && f.middle && f.ring && !f.pinky && !f.thumb) return 'W';
    if (!f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (lm[LANDMARK.INDEX_TIP].x > lm[LANDMARK.INDEX_PIP].x + 0.03) return 'X';
    }
    if (!f.index && !f.middle && !f.ring && f.pinky && f.thumb) return 'Y';
    if (f.index && !f.middle && !f.ring && !f.pinky && !f.thumb) {
      if (I.y < lm[LANDMARK.INDEX_MCP].y - 0.12) return 'Z';
    }

    return null;
  }

  _calcConfidence(lm, f, letter) {
    const base = 0.65 + Math.random() * 0.20;
    return Math.min(0.98, base);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  TASK 5 — CUSTOM GESTURE KNN MATCHING
  // ─────────────────────────────────────────────────────────────────────────

  // Normalise a raw MediaPipe landmarks array into a 60-element feature vector:
  //   • For each of the 20 non-wrist landmarks compute the 3D Euclidean
  //     distance from the wrist (landmark 0), giving 20 values.
  //   • Divide all 20 values by the wrist→middle-MCP distance (hand scale)
  //     so the vector is invariant to hand size and camera distance.
  //   • The wrist landmark itself has distance 0 and is omitted from the
  //     vector, but for completeness we also include normalised (x,y,z)
  //     offsets — giving 20 distances + 20×2 x/y offsets = 60 features.
  //
  _normaliseLandmarks(lm) {
    const wrist     = lm[0];
    const scale     = this._dist(wrist, lm[LANDMARK.MIDDLE_MCP]) || 1;
    const features  = [];

    for (let i = 1; i < lm.length; i++) {
      // Distance from wrist (rotation-invariant)
      features.push(this._dist(wrist, lm[i]) / scale);
      // Normalised x/y offsets (captures spatial layout)
      features.push((lm[i].x - wrist.x) / scale);
      features.push((lm[i].y - wrist.y) / scale);
    }
    return features;  // length = 20 × 3 = 60
  }

  // Euclidean distance between two equal-length feature vectors.
  _vectorDist(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }

  // Find the nearest saved gesture; return null if nothing is within threshold.
  _knnMatch(liveFeat) {
    if (!this._customGestures.length) return null;

    let best     = null;
    let bestDist = Infinity;

    for (const g of this._customGestures) {
      const d = this._vectorDist(liveFeat, g.features);
      if (d < bestDist) { bestDist = d; best = g; }
    }

    if (bestDist > this._KNN_THRESHOLD) return null;

    // Map distance to a confidence score: at distance 0 → 0.99, at threshold → 0.70
    const confidence = 0.99 - 0.29 * (bestDist / this._KNN_THRESHOLD);
    return { meaning: best.meaning, confidence: Math.min(0.99, confidence) };
  }

  // ── Public API — called from app.js ───────────────────────────────────

  // Save the currently visible hand as a custom gesture mapped to `meaning`.
  // `landmarks` is the raw MediaPipe array (passed in from app.js which holds
  // a reference to detector.lastLandmarks at capture time).
  saveCustomGesture(meaning, landmarks) {
    if (!meaning || !landmarks) return false;

    const features = this._normaliseLandmarks(landmarks);
    const gesture  = { meaning: meaning.trim(), features, savedAt: Date.now() };

    this._customGestures.push(gesture);
    this._persistCustomGestures();
    return true;
  }

  // Delete all saved custom gestures (and clear localStorage entry).
  clearCustomGestures() {
    this._customGestures = [];
    localStorage.removeItem(this._GESTURE_KEY);
  }

  // Return a shallow copy of the gestures list (for UI rendering).
  getCustomGestures() {
    return this._customGestures.map(g => ({ meaning: g.meaning, savedAt: g.savedAt }));
  }

  // ── Persistence helpers ────────────────────────────────────────────────
  _loadCustomGestures() {
    try {
      const raw = localStorage.getItem(this._GESTURE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  _persistCustomGestures() {
    try {
      localStorage.setItem(this._GESTURE_KEY, JSON.stringify(this._customGestures));
    } catch (e) {
      console.warn('Could not persist custom gestures:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SIMULATION MODE (fallback when no camera / MediaPipe)
  // ─────────────────────────────────────────────────────────────────────────
  _startSimulation() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let idx = 0;
    this.simulationInterval = setInterval(() => {
      if (!this.isRunning) return;
      const letter = letters[idx % letters.length];
      idx++;
      this.fps     = 24;
      this.latency = 15 + Math.floor(Math.random() * 20);
      if (this.onLetter) this.onLetter({ letter, confidence: 0.75 + Math.random() * 0.2 });
      if (this.onFrame)  this.onFrame({ fps: this.fps, latency: this.latency });
      if (this.onHandDetected && !this.handPresent) {
        this.handPresent = true;
        this.onHandDetected();
      }
    }, 2000);
  }
}
