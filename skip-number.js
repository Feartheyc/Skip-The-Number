/* ============================================================
   ring-sprite-system.js
   Pre-renders 28 torus ring frames → OffscreenCanvas sprites.
   Cache: IndexedDB ("RingSpriteCache", store "sprites", key "frames_v1").
   Public API:
     RingSpriteSystem.init(game1Ref, onReady)   ← call after tutorial ends
     RingSpriteSystem.drawFrame(ctx, frameIndex) ← use instead of game1.drawRings()
     RingSpriteSystem.getFrameCount()            ← 28
     RingSpriteSystem.isReady()                  ← bool
============================================================ */

const RingSpriteSystem = (() => {

  /* ── Config ──────────────────────────────────────────────── */
  const FRAME_COUNT   = 36;
  const DB_NAME       = "RingSpriteCache";
  const DB_VERSION    = 1;
  const STORE_NAME    = "sprites";
  const CACHE_KEY     = "frames_v1";

  /* ── State ───────────────────────────────────────────────── */
  let _ready          = false;
  let _frames         = [];   // array of ImageBitmap (28 items)
  let _game1          = null;
  let _onReady        = null;
  let _loadingScreen  = null;

  /* ── Public ──────────────────────────────────────────────── */
  function isReady()        { return _ready; }
  function getFrameCount()  { return FRAME_COUNT; }

  /**
   * Main entry point.
   * @param {object}   game1Ref  – reference to Game1 object (for layout params)
   * @param {function} onReady   – called with no args once sprites are available
   */
  function init(game1Ref, onReady) {
    _game1   = game1Ref;
    _onReady = onReady;

    _showLoadingScreen();
    _tryLoadFromCache();
  }

  /**
   * Draw the ring sprite for a given animation frame.
   * frameIndex should advance by 1 each game frame (wraps automatically).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} frameIndex  – integer 0..∞ (auto-wrapped)
   * @param {number} cx          – center X
   * @param {number} cy          – center Y
   */
  function drawFrame(ctx, frameIndex, cx, cy) {
    if (!_ready || _frames.length === 0) return;
    const idx = ((Math.floor(frameIndex) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
    const bmp = _frames[idx];
    // bmp is 512×512 centered; draw it centred on cx,cy
    const hw = bmp.width  / 2;
    const hh = bmp.height / 2;
    ctx.drawImage(bmp, cx - hw, cy - hh);
  }

  /* ── Loading screen ──────────────────────────────────────── */
  function _showLoadingScreen() {
    // Overlay div drawn on top of the game canvas
    const el = document.createElement("div");
    el.id = "ring-sprite-loader";
    el.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: radial-gradient(ellipse at 50% 40%, #1a2d4a 0%, #0f1e35 50%, #080f1c 100%);
      font-family: 'Trebuchet MS', sans-serif;
      color: #f0f4ff;
      user-select: none;
      pointer-events: none;
    `;

    el.innerHTML = `
      <canvas id="ls-canvas" width="220" height="220"
        style="display:block; margin-bottom:28px; opacity:0.92;"></canvas>

      <div id="ls-title" style="
        font-size: clamp(18px,4vw,28px);
        font-weight: bold;
        letter-spacing: 0.18em;
        color: #f5c842;
        text-shadow: 0 0 24px rgba(245,200,66,0.55);
        margin-bottom: 10px;
      ">PREPARING RING</div>

      <div id="ls-sub" style="
        font-size: clamp(11px,2.5vw,14px);
        color: rgba(142,202,230,0.7);
        margin-bottom: 28px;
        letter-spacing: 0.06em;
      ">Building sprite frames…</div>

      <div style="
        width: clamp(180px, 40vw, 320px);
        height: 6px;
        background: rgba(245,200,66,0.13);
        border-radius: 3px;
        overflow: hidden;
      ">
        <div id="ls-bar" style="
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #f5c842, #6de8b4);
          border-radius: 3px;
          box-shadow: 0 0 12px rgba(245,200,66,0.6);
          transition: width 0.12s ease;
        "></div>
      </div>

      <div id="ls-pct" style="
        margin-top: 10px;
        font-size: 12px;
        color: rgba(240,244,255,0.45);
        letter-spacing: 0.08em;
      ">0%</div>
    `;

    document.body.appendChild(el);
    _loadingScreen = el;

    // Animate a mini ring on the loading canvas
    _animateLoadingRing();
  }

  function _setLoadingProgress(pct) {
    const bar = document.getElementById("ls-bar");
    const txt = document.getElementById("ls-pct");
    const sub = document.getElementById("ls-sub");
    if (bar) bar.style.width = pct + "%";
    if (txt) txt.textContent  = Math.round(pct) + "%";
    if (sub && pct >= 100) sub.textContent = "Loading from cache…";
  }

  function _hideLoadingScreen() {
    if (!_loadingScreen) return;
    _loadingScreen.style.transition = "opacity 0.55s ease";
    _loadingScreen.style.opacity    = "0";
    setTimeout(() => {
      if (_loadingScreen && _loadingScreen.parentNode)
        _loadingScreen.parentNode.removeChild(_loadingScreen);
      _loadingScreen = null;
    }, 600);
  }

  /* Mini ring animation on loading canvas */
  let _lsRafId = null;
  function _animateLoadingRing() {
    const canvas = document.getElementById("ls-canvas");
    if (!canvas) return;
    const ctx  = canvas.getContext("2d");
    const cx   = 110, cy = 110;
    let angle  = 0;
    let pulse  = 0;

    function frame() {
      if (!document.getElementById("ls-canvas")) return; // unmounted
      ctx.clearRect(0, 0, 220, 220);
      angle += 0.012;
      pulse += 0.04;

      const Ro = 80 + Math.sin(pulse) * 4;
      const Ri = 65 + Math.sin(pulse) * 2;

      // Bloom
      const bloom = ctx.createRadialGradient(cx, cy, Ri - 10, cx, cy, Ro + 18);
      bloom.addColorStop(0, "rgba(0,0,0,0)");
      bloom.addColorStop(0.4, "rgba(126,207,179,0.07)");
      bloom.addColorStop(0.65, "rgba(201,147,58,0.14)");
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath(); ctx.arc(cx, cy, Ro + 18, 0, Math.PI * 2); ctx.fill();

      // Torus
      const lx = Math.cos(angle), ly = Math.sin(angle);
      const tg = ctx.createLinearGradient(
        cx - lx * Ro, cy - ly * Ro, cx + lx * Ro, cy + ly * Ro
      );
      tg.addColorStop(0,    "#0a1525");
      tg.addColorStop(0.22, "#1c3a2a");
      tg.addColorStop(0.40, "#5a3010");
      tg.addColorStop(0.55, "#c9933a");
      tg.addColorStop(0.68, "#e8c87a");
      tg.addColorStop(0.80, "#7ecfb3");
      tg.addColorStop(1,    "#0a1525");

      ctx.beginPath();
      ctx.arc(cx, cy, Ro, 0, Math.PI * 2);
      ctx.arc(cx, cy, Ri, 0, Math.PI * 2, true);
      ctx.fillStyle = tg;
      ctx.shadowColor = "rgba(201,147,58,0.5)";
      ctx.shadowBlur  = 22;
      ctx.fill("evenodd");
      ctx.shadowBlur  = 0;

      // Outer rim
      ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, Math.PI * 2);
      ctx.strokeStyle = "#d4a44a"; ctx.lineWidth = 1.8;
      ctx.shadowColor = "rgba(212,164,74,0.7)"; ctx.shadowBlur = 12;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Inner rim
      ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(126,207,179,0.4)"; ctx.lineWidth = 1.2;
      ctx.stroke();

      // Specular
      const sx = cx + Math.cos(angle) * Ro, sy = cy + Math.sin(angle) * Ro;
      const sp = ctx.createRadialGradient(sx, sy, 0, sx, sy, 10);
      sp.addColorStop(0, "rgba(255,250,230,0.9)");
      sp.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sp;
      ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();

      _lsRafId = requestAnimationFrame(frame);
    }
    _lsRafId = requestAnimationFrame(frame);
  }

  /* ── IndexedDB helpers ───────────────────────────────────── */
  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function _loadFromDB() {
    try {
      const db    = await _openDB();
      const tx    = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      return await new Promise((resolve, reject) => {
        const req    = store.get(CACHE_KEY);
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror   = e => reject(e.target.error);
      });
    } catch { return null; }
  }

  async function _saveToDB(blobArray) {
    try {
      const db    = await _openDB();
      const tx    = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(blobArray, CACHE_KEY);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    } catch (e) {
      console.warn("[RingSprite] Could not save to IndexedDB:", e);
    }
  }

  /* ── Cache flow ──────────────────────────────────────────── */
  async function _tryLoadFromCache() {
    _setLoadingProgress(5);

    const cached = await _loadFromDB();
    if (cached && Array.isArray(cached) && cached.length === FRAME_COUNT) {
      // Fast path: decode blobs → ImageBitmaps
      const sub = document.getElementById("ls-sub");
      if (sub) sub.textContent = "Loading from cache…";
      try {
        const bitmaps = await Promise.all(
          cached.map((blob, i) =>
            createImageBitmap(blob).then(bmp => {
              _setLoadingProgress(60 + (i / FRAME_COUNT) * 40);
              return bmp;
            })
          )
        );
        _frames = bitmaps;
        _finalize();
        return;
      } catch {
        console.warn("[RingSprite] Cache decode failed, re-rendering.");
      }
    }

    // Slow path: render all 28 frames
    await _renderAllFrames();
  }

  /* ── Renderer ────────────────────────────────────────────── */
  async function _renderAllFrames() {
    const sub = document.getElementById("ls-sub");
    if (sub) sub.textContent = "Rendering sprite frames…";

    const g1      = _game1;
    const SIZE    = 512;            // sprite sheet cell size
    const cx      = SIZE / 2;
    const cy      = SIZE / 2;

    // We need layout params from game1 — compute ring radii scaled to 512
    // Use a fixed reference: outer = 180px in 512 canvas
    const Ro_base = 180;
    const Ri_base = Ro_base * 0.80;
    const pulsePk = 10;            // max outer pulse offset (scaled)
    const pulsePi = 5;             // max inner pulse offset

    const blobs   = [];
    const bitmaps = [];

    for (let f = 0; f < FRAME_COUNT; f++) {
      // Progress 10 → 60
      _setLoadingProgress(10 + (f / FRAME_COUNT) * 50);

      // Spread one tick per frame across 28 frames
      const t       = (f / FRAME_COUNT);
      const pTime   = t * Math.PI * 2;          // pulseTime (full cycle)
      const tAngle  = t * Math.PI * 2;          // torusAngle (full rotation)

      const outerOff = Math.sin(pTime) * pulsePk;
      const innerOff = Math.sin(pTime) * pulsePi;
      const Ro = Ro_base + Math.max(0, outerOff);
      const Ri = Ri_base + Math.max(0, innerOff);
      const Rm = (Ro + Ri) / 2;
      const r  = (Ro - Ri) / 2;
      const lx = Math.cos(tAngle);
      const ly = Math.sin(tAngle);

      // Render to OffscreenCanvas
      const oc  = new OffscreenCanvas(SIZE, SIZE);
      const ctx = oc.getContext("2d");

      // Bloom
      const bloom = ctx.createRadialGradient(cx, cy, Ri - r * 2.5, cx, cy, Ro + r * 3.5);
      bloom.addColorStop(0,    "rgba(0,0,0,0)");
      bloom.addColorStop(0.30, "rgba(126,207,179,0.07)");
      bloom.addColorStop(0.52, "rgba(201,147,58,0.14)");
      bloom.addColorStop(0.70, "rgba(142,202,230,0.09)");
      bloom.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath(); ctx.arc(cx, cy, Ro + r * 3.5, 0, Math.PI * 2); ctx.fill();

      // Torus body
      const gx0 = cx - lx * (Ro + r), gy0 = cy - ly * (Ro + r);
      const gx1 = cx + lx * (Ro + r), gy1 = cy + ly * (Ro + r);
      const tg = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      tg.addColorStop(0,    "#0a1525");
      tg.addColorStop(0.22, "#1c3a2a");
      tg.addColorStop(0.40, "#5a3010");
      tg.addColorStop(0.55, "#c9933a");
      tg.addColorStop(0.68, "#e8c87a");
      tg.addColorStop(0.80, "#7ecfb3");
      tg.addColorStop(1,    "#0a1525");

      ctx.beginPath();
      ctx.arc(cx, cy, Ro, 0, Math.PI * 2);
      ctx.arc(cx, cy, Ri, 0, Math.PI * 2, true);
      ctx.fillStyle = tg;
      ctx.shadowColor = "rgba(201,147,58,0.4)";
      ctx.shadowBlur  = 36;
      ctx.fill("evenodd");
      ctx.shadowBlur  = 0;

      // Hole darkening
      const hd = ctx.createRadialGradient(cx, cy, Ri * 0.65, cx, cy, Ri);
      hd.addColorStop(0, "rgba(4,10,20,0.82)");
      hd.addColorStop(0.6, "rgba(4,10,20,0.45)");
      hd.addColorStop(1, "rgba(4,10,20,0.0)");
      ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2);
      ctx.fillStyle = hd; ctx.fill();

      // Outer rim
      ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, Math.PI * 2);
      ctx.strokeStyle = "#d4a44a"; ctx.lineWidth = 2.8;
      ctx.shadowColor = "rgba(212,164,74,0.6)"; ctx.shadowBlur = 18;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Inner rim
      ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(126,207,179,0.38)"; ctx.lineWidth = 1.8;
      ctx.shadowColor = "rgba(126,207,179,0.25)"; ctx.shadowBlur = 10;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Shimmer arc
      const shimStart = tAngle - Math.PI * 0.35;
      const shimEnd   = tAngle + Math.PI * 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, Rm + r * 0.3, shimStart, shimEnd);
      ctx.arc(cx, cy, Rm - r * 0.3, shimEnd, shimStart, true);
      ctx.closePath();
      const sg = ctx.createLinearGradient(
        cx + Math.cos(tAngle) * (Rm - r * 0.3), cy + Math.sin(tAngle) * (Rm - r * 0.3),
        cx + Math.cos(tAngle) * (Rm + r * 0.3), cy + Math.sin(tAngle) * (Rm + r * 0.3)
      );
      sg.addColorStop(0,   "rgba(255,255,255,0.0)");
      sg.addColorStop(0.4, "rgba(255,240,200,0.18)");
      sg.addColorStop(0.7, "rgba(200,240,255,0.22)");
      sg.addColorStop(1,   "rgba(255,255,255,0.0)");
      ctx.fillStyle = sg; ctx.fill();

      // Outer specular
      const sx  = cx + Math.cos(tAngle) * Ro;
      const sy  = cy + Math.sin(tAngle) * Ro;
      const sp  = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.8);
      sp.addColorStop(0,   "rgba(255,250,230,0.95)");
      sp.addColorStop(0.3, "rgba(245,215,140,0.55)");
      sp.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = sp;
      ctx.beginPath(); ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2); ctx.fill();

      // Inner specular
      const sx2 = cx + Math.cos(tAngle + Math.PI * 0.18) * Ri;
      const sy2 = cy + Math.sin(tAngle + Math.PI * 0.18) * Ri;
      const sp2 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, r * 1.2);
      sp2.addColorStop(0,   "rgba(180,255,230,0.55)");
      sp2.addColorStop(0.5, "rgba(126,207,179,0.2)");
      sp2.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = sp2;
      ctx.beginPath(); ctx.arc(sx2, sy2, r * 1.2, 0, Math.PI * 2); ctx.fill();

      // Convert to blob for caching
      const blob   = await oc.convertToBlob({ type: "image/png" });
      const bitmap = await createImageBitmap(blob);
      blobs.push(blob);
      bitmaps.push(bitmap);

      // Yield to keep UI responsive every 4 frames
      if (f % 4 === 3) await _yield();
    }

    _frames = bitmaps;
    _setLoadingProgress(100);

    // Persist blobs to IndexedDB (fire-and-forget)
    _saveToDB(blobs);

    _finalize();
  }

  function _yield() {
    return new Promise(r => setTimeout(r, 0));
  }

  function _finalize() {
    if (_lsRafId) { cancelAnimationFrame(_lsRafId); _lsRafId = null; }
    _ready = true;
    setTimeout(() => {
      _hideLoadingScreen();
      if (typeof _onReady === "function") _onReady();
    }, 350); // brief pause so 100% bar is visible
  }

  /* ── Public surface ──────────────────────────────────────── */
  return { init, drawFrame, isReady, getFrameCount };

})();

/* ============================================================
   HOW TO INTEGRATE INTO skip-number.js / Game1
   ============================================================

  1. Include this file BEFORE skip-number.js in your HTML.

  2. In Game1._startPlaying(), BEFORE the switch(m) statement, add:

       _startPlaying() {
         this.gameState = "loading";          // ← new intermediate state
         this._spriteFrame = 0;               // frame counter

         RingSpriteSystem.init(this, () => {
           // Called once sprites are ready & loading screen fades
           this.gameState = "playing";
           const m = this._pendingMode || "default";
           switch (m) {
             case "pattern": this.activatePatternMode();      break;
             case "cannon":  this.activateCannonMode();       break;
             case "orb":     this.activateOrbMode();          break;
             case "triple":  this.activateTripleCannonMode(); break;
             default: this._restartSpawnTimer(); break;
           }
         });
       },

  3. In Game1.drawRings(ctx, dt), replace the ENTIRE method body with:

       drawRings(ctx, dt) {
         if (RingSpriteSystem.isReady()) {
           // ── Sprite path (fast) ────────────────────────
           this.pulseTime  += this.pulseSpeed * dt;
           this.torusAngle  = (this.torusAngle + dt * 0.28) % (Math.PI * 2);

           // Advance frame at 60fps → 1 full animation cycle per ~28 frames
           this._spriteFrame = (this._spriteFrame || 0) + dt * 60;

           RingSpriteSystem.drawFrame(
             ctx,
             this._spriteFrame,
             this.centerX,
             this.centerY
           );
         } else {
           // ── Fallback: original procedural path ────────
           // (paste the original drawRings body here as a safety net)
           this._drawRingsProcedural(ctx, dt);
         }
       },

       // Rename original drawRings content to _drawRingsProcedural:
       _drawRingsProcedural(ctx, dt) {
         // ... original drawRings code ...
       },

  4. In Game1.update(), guard the "loading" state so it's a no-op
     (the loading screen DOM sits on top, so nothing needs to be drawn):

       update(ctx, fingers, dt = 1/60) {
         if (this.gameState === "tutorial") { ... return; }
         if (this.gameState === "loading")  { return; }   // ← add this line
         // ... rest of playing logic
       },

  NOTE ON SCALING:
  The sprites are rendered at 512×512 with Ro_base=180.
  If your game canvas is a different size the ring POSITION is always correct
  (it's centered via cx/cy in drawFrame), but the RADIUS will differ from the
  procedural version.  To match exactly, pass your actual outer radius when
  calling RingSpriteSystem.init() and the renderer will use it.
  A simpler workaround: use ctx.save()/scale()/restore() around drawFrame:

      const scale = this.baseOuterRadius / 180;   // 180 = sprite's Ro_base
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.scale(scale, scale);
      RingSpriteSystem.drawFrame(ctx, this._spriteFrame, 0, 0);
      ctx.restore();

============================================================ */
/* ============================================================
   skip-number.js  (Game1) — v4  [Ring Sprite Edition]
   Changes vs v3:
   • Depends on ring-sprite-system.js (must be loaded first)
   • After tutorial → gameState = "loading" while sprites build
   • drawRings() uses pre-rendered ImageBitmap sprites (28 frames)
   • Falls back to procedural _drawRingsProcedural() if sprites fail
   • Loading screen is provided by RingSpriteSystem (same theme)
============================================================ */

const Game1 = {

  /* ── Layout ─────────────────────────────────────────────── */
  centerX: null,
  centerY: null,
  baseOuterRadius: 1000,
  baseInnerRadius: 970,
  currentOuterRadius: 1000,
  currentInnerRadius: 970,
  ringScale: 1.5,

  /* ── Palette ────────────────────────────────────────────── */
  C: {
    bg:        "#0d1b2e",
    noteText:  "#f0f4ff",
    correct:   "#6de8b4",
    wrong:     "#e87c6d",
    gold:      "#f5c842",
    accent:    "#8ecae6",
    hudBg:     "rgba(10,20,38,0.78)",
    hudBorder: "rgba(140,180,220,0.18)",
    xpTrack:   "rgba(245,200,66,0.15)",
  },

  /* ── Notes & Game State ─────────────────────────────────── */
  notes: [],
  noteSpeed: 0,
  popEffects: [],
  explosions: [],
  score: 0,
  combo: 0,
  multiplier: 1,
  lastHitType: "",
  hitTextTimer: 0,
  missQueue: [],
  currentNumber: 1,
  maxNumber: 100,
  spawnTimer: null,
  spawnInterval: 1800,
  roundNumber: 1,
  nextRoundNumber: 1,
  roundCycleGoal: 100,
  timeLimit: 200  ,
  timeRemaining: 200,
  skillPoints: 0,
  levelThreshold: 90,
  bestCombo: 0,
  totalCorrectTouches: 0,
  totalWrongTouches: 0,
  totalMissedCorrect: 0,
  roundCorrectTouches: 0,
  roundWrongTouches: 0,
  roundMissedCorrect: 0,
  roundMaxCombo: 0,
  roundWrongStreakPeak: 0,
  roundMissStreakPeak: 0,
  wrongTouchStreak: 0,
  missedCorrectStreak: 0,
  roundScoreStart: 0,
  currentRoundPlan: null,
  nextRoundPlan: null,
  roundWrapPending: false,
  roundWrapDelay: 0,
  roundEndBonus: 10,
  levelUpBonus: 100,
  roundHoldSec: 3.0,
  overlayHoldProgress: 0,
  levelCongratsTapHold: 0,
  gameOverFade: 0,
  overlayData: null,
  assistTimeBonus: 0,
  assistAppliedThisRound: false,

  pulseTime: 0,
  pulseSpeed: 1.8,
  pulseAmountOuter: 10,
  pulseAmountInner: 5,
  torusAngle: 0,

  mode: "default",
  skipAmount: 3,
  gameTitle: "COLLECT MULTIPLES OF ",
  pattern: { skip: 3, collect: 1 },

  cannonAngle: 0,
  cannonTargetAngle: 0,
  cannonLength: 0,
  pendingShot: null,

  orbImage: null,
  orbAngle: 0,
  orbTargetAngle: 0,

  charge: 0,
  chargeSpeed: 0.8,
  isCharging: false,
  chargeParticles: [],
  launcherSafeRadius: 0,

  tripleCannons: [],
  tripleBaseAngle: 0,
  tripleTargetAngle: 0,
  tripleCount: 3,
  previewCannons: [],
  previewTimer: 0,
  previewDuration: 0.6,

  xp: 0,
  xpToNext: 8,
  level: 1,
  maxLevel: 20,
  tier: 0,
  tierNames:      ["Sprout 🌱","Star ⭐","Champ 🏆","Legend 🌟"],
  tierColors:     ["#6de8b4","#f5c842","#e8a06d","#c084fc"],
  tierThresholds: [1, 6, 12, 18],

  levelUpActive: false,
  levelUpTimer: 0,
  levelUpDuration: 1400,
  levelUpParticles: [],
  xpPopFlash: 0,
  hintState: "none",
  noiseTime: 0,

  speedCap: 0,
  speedMin: 0,
  speedPenaltyStep: 0.1,
  speedRecoveryStep: 0.08,
  speedDriftRate: 0.008,

  bgStars: [],

  _hintChangeMessages: {
    subtle: "👀 Look carefully — hints are fading!",
    none:   "🧠 No more hints — use your brain!",
    decoy:  "😈 Watch out — fake signals ahead!",
    chaos:  "🌀 CHAOS MODE — trust nothing!",
  },
  _hintChangeTimer: 0,
  _hintChangeMessage: "",

  MAX_POP:  80,
  MAX_EXPL: 80,
  maxNotesOnScreen: 6,

  /* ── Listener guard ─────────────────────────────────────── */
  _listenersAttached: false,
  _resizeTimer: null,

  /* ── Sprite state ───────────────────────────────────────── */
  _spriteFrame: 0,   // accumulates at dt*60 per game tick

  /* ── Tutorial state ─────────────────────────────────────── */
  gameState: "tutorial",   // "tutorial" | "loading" | "playing"
  _pendingMode: "default",
  _tutHoldProgress: 0,
  _tutEnterAnim: 0,
  _tutOrbT: 0,
  _tutPulseT: 0,
  _tutStars: [],
  _tutNoFingerFrames: 0,
  _tutNoFingerThreshold: 90,
  HOLD_SEC: 3.0,

  /* ── Tutorial mode data ─────────────────────────────────── */
  _TMODES: {
    default: {
      title:"SKIP MODE", icon:"⟳", color:"#6de8b4",
      tagline:"Like Mario coins — only collect every Nth one!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"⏱️",text:"You start with 200 seconds"},
        {icon:"⏳",text:"The time bar keeps going down"},
        {icon:"🔁",text:"Numbers reset to 1 after 100"},
        {icon:"➕",text:"Finish a round = +20 seconds"},
        {icon:"🎯",text:"Numbers fly in from the ring toward center"},
        {icon:"✅",text:"Touch ONLY multiples (e.g. 3, 6, 9 for Skip 3)"},
        {icon:"✨",text:"A NEUTRAL GLOW means the number is inside the ring and collectible!"}, 
        // ── UPDATED TEXT ──
        {icon:"💍",text:"Tap numbers inside the ring before they escape!"},
        {icon:"⚠️",text:"Miss a good number = score goes down"},
        {icon:"❌",text:"Wrong touch = lose points + your streak breaks + speed drops"},
        {icon:"🔥",text:"5-combo streaks multiply your score!"},
      ], visual:"skip",
    },
    pattern: {
      title:"PATTERN MODE", icon:"◈", color:"#8ecae6",
      tagline:"Like Guitar Hero — hit the right notes in rhythm!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"⏱️",text:"You start with 200 seconds"},
        {icon:"⏳",text:"The time bar keeps going down"},
        {icon:"🔁",text:"Numbers reset to 1 after 100"},
        {icon:"➕",text:"Finish a round = +20 seconds"},
        {icon:"🎶",text:"Numbers appear in a repeating skip-collect cycle"},
        {icon:"⏭️",text:"SKIP a set, then COLLECT a set — repeat"},
        {icon:"🧠",text:"E.g. Skip 2, Collect 3 → ✗✗✓✓✓ then repeat"},
        {icon:"✨",text:"A NEUTRAL GLOW means the number is inside the ring and collectible! "}, 
        // ── UPDATED TEXT ──
        {icon:"💍",text:"Tap numbers inside the ring before they escape!"},
        {icon:"⚠️",text:"Miss a good number = score goes down"},
        {icon:"❌",text:"Wrong touch = lose points + your streak breaks + speed drops"},
        {icon:"🔥",text:"5-combo streaks multiply your score!"},
      ], visual:"pattern",
    },
    cannon: {
      title:"CANNON MODE", icon:"▲", color:"#f5c842",
      tagline:"Like Space Invaders — zap right ones before escape!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"⏱️",text:"You start with 200 seconds"},
        {icon:"⏳",text:"The time bar keeps going down"},
        {icon:"🔁",text:"Numbers reset to 1 after 100"},
        {icon:"➕",text:"Finish a round = +20 seconds"},
        {icon:"💥",text:"The cannon fires numbers across the screen"},
        {icon:"✅",text:"Touch correct multiples before they fly off"},
        {icon:"🚀",text:"Wrong touch = lost points + your streak breaks + speed drops"},
        {icon:"⚠️",text:"A good number gets away = score goes down"},
        {icon:"🔥",text:"5-combo streaks multiply your score!"},
      ], visual:"cannon",
    },
    orb: {
      title:"ORB MODE", icon:"◉", color:"#c084fc",
      tagline:"Like Metroid — intercept numbers mid-flight!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"⏱️",text:"You start with 200 seconds"},
        {icon:"⏳",text:"The time bar keeps going down"},
        {icon:"🔁",text:"Numbers reset to 1 after 100"},
        {icon:"➕",text:"Finish a round = +20 seconds"},
        {icon:"🌀",text:"A spinning orb launches numbers outward"},
        {icon:"🎯",text:"Catch the right numbers as they fly past"},
        {icon:"💜",text:"The orb turns to aim, so watch closely"},
        {icon:"❌",text:"Wrong touch = lost points + your streak breaks + speed drops"},
        {icon:"⚠️",text:"A good number gets away = score goes down"},
        {icon:"🔥",text:"5-combo streaks multiply your score!"},
      ], visual:"orb",
    },
    triple: {
      title:"TRIPLE CANNON", icon:"⟁", color:"#e87c6d",
      tagline:"Like Galaga with 3 ships — pure chaos, total skill!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"⏱️",text:"You start with 200 seconds"},
        {icon:"⏳",text:"The time bar keeps going down"},
        {icon:"🔁",text:"Numbers reset to 1 after 100"},
        {icon:"➕",text:"Finish a round = +20 seconds"},
        {icon:"🔴",text:"THREE cannons fire in random order"},
        {icon:"👀",text:"Gold glow = that cannon fires next"},
        {icon:"🎯",text:"Intercept correct numbers from all directions"},
        {icon:"❌",text:"Wrong touch = lost points + your streak breaks + speed drops"},
        {icon:"⚠️",text:"A good number gets away = score goes down"},
        {icon:"🔥",text:"5-combo streaks multiply your score!"},
      ], visual:"triple",
    },
  },

  _lastFingerUpdateTime: 0,
  FINGER_UPDATE_INTERVAL: 22,


  /* ── Spawn timing state (replaces setInterval) ─────────────── */
_spawnAccumulator: 0,


/* ── Sprite state ───────────────────────────────────────── */
  _spriteFrame: 0,   // accumulates at dt*60 per game tick
  showSkillDebug: false, // UI Debug flag for rendering tracking values


  /* ============================================================
      INIT
  ============================================================ */
 
   /* ============================================================
      INIT
  ============================================================ */
  init(modeKey = "default") {
    const rect = document.getElementById("container").getBoundingClientRect();
    this._applyResize(rect.width, rect.height);

    // ── Fixed Tracking Property Initializer ──
    this._noHandDuration = 0;
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.style.opacity = "0";
    }

    this.notes = [];
    this.popEffects = [];
    this.explosions = [];
    this.missQueue = [];
    this.levelUpParticles = [];
    this.chargeParticles = [];

    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.hitTextTimer = 0;
    this.currentNumber = 1;
    this.xp = 0;
    this.level = 1;
    this.levelThreshold = this._getCumulativeThreshold(this.level); // was _getLevelThreshold
    this.tier = 0;
    this.levelUpActive = false;
    this.xpPopFlash = 0;
    this.hintState = "full";
    this.noiseTime = 0;
    this.spawnInterval = 1800;
    this.timeLimit = 200;
    this.timeRemaining = this.timeLimit;
    this.skillPoints = 0;
    this.bestCombo = 0;
    this.totalCorrectTouches = 0;
    this.totalWrongTouches = 0;
    this.totalMissedCorrect = 0;
    this.roundCorrectTouches = 0;
    this.roundWrongTouches = 0;
    this.roundMissedCorrect = 0;
    this.roundMaxCombo = 0;
    this.roundWrongStreakPeak = 0;
    this.roundMissStreakPeak = 0;
    this.wrongTouchStreak = 0;
    this.missedCorrectStreak = 0;
    this.roundScoreStart = 0;
    this.roundNumber = 1;
    this.nextRoundNumber = 1;
    this.currentRoundPlan = null;
    this.nextRoundPlan = null;
    this.roundWrapPending = false;
    this.roundWrapDelay = 0;
    this.overlayHoldProgress = 0;
    this.levelCongratsTapHold = 0;
    this.gameOverFade = 0;
    this.overlayData = null;
    this.torusAngle = 0;
    this._spriteFrame = 0;
    this.showSkillDebug = false; // Reset debug toggles across hard reboots

    // ── FIXED: use the actual chosen mode (not a hardcoded "default")
    //    so _buildRoundPlan() below generates the correct type of plan
    //    (pattern skip/collect vs. plain skip amount) right from the start. ──
    this.mode = modeKey || "default";
    this.skipAmount = this.getRandomSkip();
    this.gameTitle = "COLLECT MULTIPLES OF "+ this.skipAmount;
    this.noteSpeed = this.speedCap;
    this.levelThreshold = this._getLevelThreshold(this.level);
    this.xpToNext = this.levelThreshold;

    this.orbImage = new Image();
    this.orbImage.src = "orb1.png";

    this._initBgStars();

    this.gameState = "tutorial";
    this._pendingMode = modeKey;

    this._tutHoldProgress = 0;
    this._tutEnterAnim = 0;
    this._tutOrbT = 0;
    this._tutPulseT = 0;
    this._tutNoFingerFrames = 0;
    this._syncDifficultyScalars();

    // ── FIXED: this plan is now generated ONCE, using the correct mode,
    //    and will be reused verbatim when the round actually starts. ──
    this.nextRoundPlan = this._buildRoundPlan();

    this._initTutStars();

    if (!this._listenersAttached) {
      this._listenersAttached = true;

      window.addEventListener("resize", () => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this._onResize(), 150);
      });

      window.addEventListener("orientationchange", () => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this._onResize(), 300);
      });

      // ── Unified Double Click / Double Tap Interaction Listener ──
      this._lastTapTime = 0;
      window.addEventListener("pointerdown", (e) => {
        // Only allow freezing actions inside the live execution gameplay loop
        if (this.gameState !== "playing") return;
        
        const now = performance.now();
        const timespan = now - this._lastTapTime;
        
        if (timespan > 0 && timespan < 300) {
          e.preventDefault();
          this._noHandDuration = 0;
          
          const pBtn = document.getElementById("pauseBtn");
          if (pBtn) {
            pBtn.style.display = "none";
            pBtn.style.opacity = "0";
          }
          window.pauseGame();
        }
        this._lastTapTime = now;
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "1") {
          if (this.gameState === "playing") {
            this.roundCorrectTouches = 10;
            this.roundMaxCombo = 10;
            this.score += 100;
            this.skillPoints = this.levelThreshold; 
            this._resolveRoundEnd();
          }
          return;
        }

        if (e.key === "2") {
          if (this.gameState === "playing") {
            this.roundCorrectTouches = 5;
            this.roundMaxCombo = 3;
            this.score += 50;
            this.skillPoints = 0; 
            this._resolveRoundEnd();
          }
          return;
        }

        // ── KEY 3 Toggles Interactive UI Skill Point Overlay Debug Display ──
        if (e.key === "3") {
          this.showSkillDebug = !this.showSkillDebug;
          return;
        }
        
        if (e.key === "5") this._setMode("orb");
        if (e.key === "4") this._setMode("triple");
      });
    }
  },
  /* ── Resize — layout only, never resets gameplay ────────── */
  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this._applyResize(w, h);
    this._initBgStars();
    if (this.gameState === "tutorial") this._initTutStars();
  },

  _applyResize(width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    const base = Math.min(width, height);
    this.baseOuterRadius    = base * 0.25 * this.ringScale;
    this.baseInnerRadius    = this.baseOuterRadius * 0.8;
    this.currentOuterRadius = this.baseOuterRadius;
    this.currentInnerRadius = this.baseInnerRadius;
    const levelBoost = 1 + Math.min(0.55, Math.max(0, (this.level || 1) - 1) * 0.08);
    this.speedCap = this.baseOuterRadius * 0.25 * levelBoost;
    this.speedMin = this.speedCap * 0.15;
    if (!this.noteSpeed || this.noteSpeed > this.speedCap) this.noteSpeed = this.speedCap;
    this.launcherSafeRadius = this.baseOuterRadius * 0.45;
  },

   /* ── Mode switching ─────────────────────────────────────── */
  _setMode(modeKey) {
    if (this.gameState === "tutorial") {
      this._pendingMode = modeKey;
      this._tutHoldProgress = 0;
      this._tutEnterAnim = 0;
      this._tutOrbT = 0;
      this._tutPulseT = 0;

      // ── FIXED: switching modes mid-tutorial must regenerate the plan
      //    for the NEW mode, so the preview text stays accurate. ──
      this.mode = modeKey || "default";
      this.nextRoundPlan = this._buildRoundPlan();
    } else {
      switch (modeKey) {
        case "pattern": this.activatePatternMode(); break;
        case "cannon":  this.activateCannonMode(); break;
        case "orb":     this.activateOrbMode(); break;
        case "triple":  this.activateTripleCannonMode(); break;
      }
    }
  },

  setModeBeforeStart(modeKey) {
    this._pendingMode = modeKey || "default";
    if (this.gameState === "tutorial") {
      this._tutHoldProgress = 0;
      this._tutEnterAnim = 0;
      this._tutOrbT = 0;
      this._tutPulseT = 0;

      // ── FIXED: same reasoning as _setMode — regenerate the preview
      //    plan whenever the pending mode changes before play starts. ──
      this.mode = this._pendingMode;
      this.nextRoundPlan = this._buildRoundPlan();
    }
  },

  /* ── Transition: tutorial → loading → playing ───────────── */
_startPlaying() {
  const m = this._pendingMode || "default";

  // Only use sprite loading for these modes
  const useSprites = (m === "default" || m === "pattern");

  const beginSession = () => {
    this._resetSessionFlow(m);
    this._beginRound();
  };

  if (useSprites) {
    this.gameState = "loading";

    RingSpriteSystem.init(this, () => {
      beginSession();
    });

  } else {
    // 🚀 Skip loading completely
    beginSession();
  }
},
  /* ============================================================
     TUTORIAL — stars
  ============================================================ */
  _initTutStars() {
    const W = window.innerWidth, H = window.innerHeight;
    this._tutStars = [];
    for (let i = 0; i < 80; i++) {
      this._tutStars.push({
        x: Math.round(Math.random() * W),
        y: Math.round(Math.random() * H),
        r: 0.5 + Math.random() * 1.4,
        a: 0.1 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
        ts: 0.012 + Math.random() * 0.018,
      });
    }
  },

  /* ============================================================
     TUTORIAL — main draw (Page-Based System to Prevent Overflow)
  ============================================================ */
  _updateTutorial(ctx, fingers, dt) {
    this._tutEnterAnim  = Math.min(1, this._tutEnterAnim + dt * 2);
    this._tutOrbT      += dt;
    this._tutPulseT    += dt * 1.8;

    if (this._tutPage === undefined) {
      this._tutPage = 1;
    }

    const alpha  = 1 - Math.pow(1 - Math.max(0, Math.min(1, this._tutEnterAnim)), 3);
    const W = this.centerX * 2, H = this.centerY * 2;
    const pal = this.C;
    const td  = this._TMODES[this._pendingMode] || this._TMODES.default;
    const tColor = td.color;
    const visualKey = td.visual;

    // ── FIXED: pull the actual numbers that WILL be used when play starts,
    //    straight from the plan generated for this pending mode. This is
    //    the single source of truth shared with _resetSessionFlow(). ──
    const previewPlan    = this.nextRoundPlan || this._buildRoundPlan();
    const previewSkip     = previewPlan.skip;
    const previewCollect  = previewPlan.collect;

    // Background
    const bg = ctx.createRadialGradient(this.centerX, this.centerY * 0.6, 0, this.centerX, H * 0.5, Math.max(W, H) * 0.75);
    bg.addColorStop(0, "#1a2d4a");
    bg.addColorStop(0.5, "#0f1e35");
    bg.addColorStop(1, "#080f1c");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    for (const s of this._tutStars) {
      s.tw += s.ts;
      ctx.globalAlpha = alpha * Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.fillStyle = "#c8dff0";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;

    const isMob = W < 540;
    const cardW = Math.min(W - 32, isMob ? 360 : 700);
    const cardH = Math.min(H - 60, isMob ? 580 : 540);
    const cardX = this.centerX - cardW / 2;
    const cardY = this.centerY - cardH / 2;
    const cR    = 20;
    const hr    = s => {
      const h = (s||"").replace("#","");
      const r=parseInt(h.slice(0,2),16);
      const g=parseInt(h.slice(2,4),16);
      const b=parseInt(h.slice(4,6),16);
      return isNaN(r)?"140,180,220":`${r},${g},${b}`;
    };

    ctx.shadowColor = tColor;
    ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(8,18,36,0.96)";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cR);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${hr(tColor)},0.38)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = `rgba(${hr(tColor)},0.16)`;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 56, [cR, cR, 0, 0]);
    ctx.fill();

    ctx.font = `bold ${isMob?22:28}px 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = tColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = tColor;
    ctx.shadowBlur = 14;
    ctx.fillText(td.icon + "  " + td.title, this.centerX, cardY + 28);
    ctx.shadowBlur = 0;

    ctx.font = `${isMob?12:14}px 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = "rgba(240,244,255,0.68)";
    ctx.fillText(`Page ${this._tutPage} of 2 — ${this._tutPage === 1 ? 'Gameplay & Scoring' : 'Time & Speed Parameters'}`, this.centerX, cardY + 65);

    const visX = cardX + 12, visY = cardY + 82;
    const visW = isMob ? cardW - 24 : cardW * 0.42;
    const visH = isMob ? 130 : cardH - 200;
    ctx.fillStyle = "rgba(8,16,36,0.68)";
    ctx.beginPath();
    ctx.roundRect(visX, visY, visW, visH, 12);
    ctx.fill();
    ctx.strokeStyle = `rgba(${hr(tColor)},0.14)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    this._drawTutVisual(ctx, td.visual, visX, visY, visW, visH, this._tutOrbT, tColor);

    // ── Mode-specific gameplay descriptions (Page 1) — now driven by previewPlan ──
    const gameplayByMode = {
      skip: [
        { icon: "🎯", text: "Numbers fly from the ring toward the center." },
        { icon: "✅", text: `Collect multiples of ${previewSkip}.` },
        { icon: "💍", text: "Tap numbers inside the ring before they escape!" },
        { icon: "🛡️", text: "Safe Zone: Center is safe! No tapping here. ⭕" },
      ],
      pattern: [
        { icon: "🎶", text: "Numbers cycle: skip a set, then collect a set." },
        { icon: "🧠", text: `Skip ${previewSkip}, Collect ${previewCollect} — then repeat.` },
        { icon: "💍", text: "Tap numbers inside the ring before they escape!" },
        { icon: "🛡️", text: "Safe Zone: Center is safe! No tapping here. ⭕" },
      ],
      cannon: [
        { icon: "💥", text: "The cannon fires numbers straight across the screen." },
        { icon: "✅", text: `Touch correct multiples of ${previewSkip} before they fly off.` },
        { icon: "🚀", text: "Numbers travel in one direction until they escape." },
        { icon: "🛡️", text: "Safe Zone: Right by the cannon is safe! No tapping here. ⭕" },
      ],
      orb: [
        { icon: "🌀", text: "A spinning orb launches numbers outward." },
        { icon: "✅", text: `Catch correct multiples of ${previewSkip} as they fly past.` },
        { icon: "💜", text: "The orb turns to aim — watch closely." },
        { icon: "🛡️", text: "Safe Zone: Right by the orb is safe! No tapping here. ⭕" },
      ],
      triple: [
        { icon: "🔴", text: "THREE cannons fire in random order." },
        { icon: "👀", text: "A gold glow shows which cannon fires next." },
        { icon: "✅", text: `Intercept correct multiples of ${previewSkip} from any direction.` },
        { icon: "🛡️", text: "Safe Zone: Right by the cannons is safe! No tapping here. ⭕" },
      ],
    };

    // ── Mode-specific dynamics descriptions (Page 2) ──
    const dynamicsByMode = {
      skip: [
        { icon: "🧠", text: "Numbers auto-reset back to 1 after reaching 100." },
        { icon: "📉", text: "Wrong touches slow down incoming numbers." },
        { icon: "📈", text: "Success streaks ramp speed back up." },
        { icon: "✨", text: "A glow means the number is inside the ring and collectible!" },
      ],
      pattern: [
        { icon: "🧠", text: "Numbers auto-reset back to 1 after reaching 100." },
        { icon: "📉", text: "Wrong touches slow down incoming numbers." },
        { icon: "📈", text: "Success streaks ramp speed back up." },
        { icon: "✨", text: "A glow means the number is inside the ring and collectible!" },
      ],
      cannon: [
        { icon: "🧠", text: "Numbers auto-reset back to 1 after reaching 100." },
        { icon: "📉", text: "Wrong touches slow down the cannon's fire speed." },
        { icon: "📈", text: "Success streaks ramp speed back up." },
        { icon: "🧠", text: "No visual hints here — use your math skills!" },
      ],
      orb: [
        { icon: "🧠", text: "Numbers auto-reset back to 1 after reaching 100." },
        { icon: "📉", text: "Wrong touches slow down the orb's launch speed." },
        { icon: "📈", text: "Success streaks ramp speed back up." },
        { icon: "🧠", text: "No visual hints here — use your math skills!" },
      ],
      triple: [
        { icon: "🧠", text: "Numbers auto-reset back to 1 after reaching 100." },
        { icon: "📉", text: "Wrong touches slow down all three cannons." },
        { icon: "📈", text: "Success streaks ramp speed back up." },
        { icon: "🧠", text: "No visual hints here — use your math skills!" },
      ],
    };

    const contentRows = [];
    if (this._tutPage === 1) {
      contentRows.push(
        { isHeader: true,  text: "🎮 Gameplay" },
        { icon: "☝️", text: "Your index finger is the green dot." },
        ...(gameplayByMode[visualKey] || gameplayByMode.skip),
        { isHeader: true,  text: "⭐ Scoring" },
        { icon: "✅", text: "Correct touch = +10 points + streak +1" },
        { icon: "❌", text: "Wrong touch = −5 points + streak reset" },
        { icon: "⚠️", text: "Miss correct number = −10 points + streak reset" },
        { icon: "🔥", text: "5-combo streaks multiply your score!" }
      );
    } else {
      contentRows.push(
        { isHeader: true,  text: "⏱️ Time Metrics" },
        { icon: "⏱️", text: "You begin with a clean 200 seconds." },
        { icon: "⏳", text: "The countdown bar depletes continuously." },
        { icon: "➕", text: "Completing a round adds bonus time." },
        { icon: "🚀", text: "Leveling up grants a big time bonus." },
        { isHeader: true,  text: "⚙️ Dynamic Scaling" },
        ...(dynamicsByMode[visualKey] || dynamicsByMode.skip)
      );
    }

    const rulesX = isMob ? cardX + 12 : cardX + visW + 24;
    const rulesY = isMob ? visY + visH + 10 : cardY + 82;
    const rulesW = isMob ? cardW - 24 : cardW - visW - 36;
    const dynamicRowH = isMob ? (this._tutPage === 1 ? 26 : 30) : (this._tutPage === 1 ? 32 : 36);

    for (let i = 0; i < contentRows.length; i++) {
      const item = contentRows[i];
      const currentY = rulesY + (i * dynamicRowH);

      if (item.isHeader) {
        ctx.font = `bold ${isMob?13:15}px 'Trebuchet MS', sans-serif`;
        ctx.fillStyle = tColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(item.text, rulesX + 4, currentY + dynamicRowH / 2);
      } else {
        ctx.fillStyle = i % 2 === 0 ? "rgba(20,40,70,0.45)" : "rgba(10,24,44,0.3)";
        ctx.beginPath();
        ctx.roundRect(rulesX, currentY, rulesW, dynamicRowH - 2, 6);
        ctx.fill();

        ctx.font = `${isMob?13:15}px 'Trebuchet MS', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(item.icon, rulesX + 16, currentY + dynamicRowH / 2);

        ctx.font = `${isMob?10.5:12.5}px 'Trebuchet MS', sans-serif`;
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(240,244,255,0.9)";
        ctx.fillText(item.text, rulesX + 36, currentY + dynamicRowH / 2);
      }
    }

    const holdY = cardY + cardH - (isMob ? 82 : 86);
    ctx.strokeStyle = `rgba(${hr(tColor)},0.15)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 20, holdY - 6);
    ctx.lineTo(cardX + cardW - 20, holdY - 6);
    ctx.stroke();

    const hasFing = fingers.length > 0;
    if (hasFing) {
      this._tutHoldProgress = Math.min(1, this._tutHoldProgress + dt / this.HOLD_SEC);
      if (this._tutHoldProgress >= 1) {
        if (this._tutPage === 1) {
          this._tutPage = 2;
          this._tutHoldProgress = 0;
          this._tutEnterAnim = 0.3;
        } else {
          this._tutPage = 1;
          ctx.globalAlpha = 1;
          this._startPlaying();
          return;
        }
      }
    } else {
      this._tutHoldProgress = Math.max(0, this._tutHoldProgress - dt * 0.5);
    }

    if (!hasFing) {
      const blink = Math.sin(this._tutPulseT * 3) > 0;
      ctx.font = `bold ${isMob?13:15}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = blink ? "#f5c842" : "rgba(245,200,66,0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#f5c842";
      ctx.shadowBlur = blink ? 12 : 0;
      ctx.fillText("☝ Raise your index finger to the camera", this.centerX, holdY + 18);
      ctx.shadowBlur = 0;
      ctx.font = `${isMob?11:13}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = "rgba(142,202,230,0.65)";
      
      const promptStr = this._tutPage === 1 ? "Hold still for 3 seconds to view Page 2" : "Hold still for 3 seconds to Launch Game";
      ctx.fillText(promptStr, this.centerX, holdY + 40);
    } else {
      const pct = Math.round(this._tutHoldProgress * 100);
      ctx.font = `bold ${isMob?13:15}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = tColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = tColor;
      ctx.shadowBlur = 10;
      
      const actionStr = this._tutPage === 1 ? `Loading Page 2... ${pct}%` : `Launching Session... ${pct}%`;
      ctx.fillText(actionStr, this.centerX, holdY + 16);
      ctx.shadowBlur = 0;
      
      const barW = cardW * 0.6, barH = 8;
      const barX = this.centerX - barW / 2, barY = holdY + 34;
      ctx.fillStyle = "rgba(20,40,70,0.8)";
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 4);
      ctx.fill();
      ctx.fillStyle = tColor;
      ctx.shadowColor = tColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * this._tutHoldProgress, barH, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (hasFing) {
      const fx = fingers[0].x, fy = fingers[0].y;
      const FING_R = 28;
      ctx.beginPath();
      ctx.arc(fx, fy, FING_R + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${hr(tColor)},0.18)`;
      ctx.lineWidth = 5;
      ctx.stroke();
      if (this._tutHoldProgress > 0.01) {
        ctx.beginPath();
        ctx.arc(fx, fy, FING_R + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this._tutHoldProgress);
        ctx.strokeStyle = tColor;
        ctx.lineWidth = 5;
        ctx.shadowColor = tColor;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(fx, fy, 22, 0, Math.PI * 2);
      ctx.shadowColor = "rgba(126,207,179,0.7)";
      ctx.shadowBlur = 28;
      ctx.fillStyle = "rgba(94,180,150,0.45)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx, fy, 10, 0, Math.PI * 2);
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#b0f0da";
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  },

  /* ── Tutorial visual mini-diagrams ─────────────────────── */
  _tutNoteColors(isCorrect, noteId) {
    const vis = this._noteVisual(isCorrect, noteId);
    const h   = this.hintState;
    const isVisC = vis.showCorrect, isVisW = vis.showWrong;
    let bodyFill, rimColor, shadowCol;
    if (isVisC && h !== "subtle") {
      bodyFill = "#0e3028"; rimColor = this.C.correct; shadowCol = "rgba(109,232,180,0.45)";
    } else if (isVisW) {
      bodyFill = "#2a1010"; rimColor = this.C.wrong;   shadowCol = "rgba(232,124,109,0.4)";
    } else {
      bodyFill  = "#102140";
      rimColor  = `rgba(${Math.round(100+vis.shimmerAmt*80)},${Math.round(160+vis.shimmerAmt*40)},${Math.round(200+vis.shimmerAmt*30)},${0.55+vis.shimmerAmt*0.35})`;
      shadowCol = `rgba(90,150,200,${0.25+vis.shimmerAmt*0.2})`;
    }
    return { bodyFill, rimColor, shadowCol, isVisC, isVisW, shimmerAmt: vis.shimmerAmt };
  },

  _drawTutVisual(ctx, mode, px, py, pw, ph, t, tColor) {
    const hr = s => { const h=(s||"").replace("#",""); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return isNaN(r)?"140,180,220":`${r},${g},${b}`; };
    ctx.save(); ctx.translate(px, py);

    if (mode === "skip") {
      const r = Math.min(pw, ph) * 0.36;
      ctx.strokeStyle = "rgba(212,164,74,0.7)";
      ctx.lineWidth = 3;
      ctx.shadowColor = this.C.gold;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(pw/2, ph/2, r, 0, Math.PI*2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(126,207,179,0.35)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(pw/2, ph/2, r*0.72, 0, Math.PI*2);
      ctx.stroke();
      const notes = [{a:0.4,d:1.0,v:3,c:true},{a:1.8,d:0.75,v:5,c:false},{a:3.5,d:0.9,v:6,c:true},{a:5.0,d:0.6,v:7,c:false}];
      for (const n of notes) {
        const pr = ((t*0.38+n.d)%1.0), dist = r*1.65*(1-pr*0.6);
        const nx=pw/2+Math.cos(n.a)*dist, ny=ph/2+Math.sin(n.a)*dist;
        const cols = this._tutNoteColors(n.c, n.v);
        ctx.beginPath();
        ctx.arc(nx,ny,15,0,Math.PI*2);
        ctx.fillStyle=cols.bodyFill;
        ctx.shadowColor=cols.shadowCol;
        ctx.shadowBlur=12;
        ctx.fill();
        ctx.strokeStyle=cols.rimColor;
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.shadowBlur=0;
        ctx.fillStyle="#f0f4ff";
        ctx.font="bold 11px 'Trebuchet MS',sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(n.v,nx,ny);
      }
      ctx.beginPath();
      ctx.arc(pw/2,ph/2,10,0,Math.PI*2);
      ctx.fillStyle="rgba(94,180,150,0.4)";
      ctx.shadowColor=this.C.correct;
      ctx.shadowBlur=18;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pw/2,ph/2,5,0,Math.PI*2);
      ctx.fillStyle="#b0f0da";
      ctx.fill();
      ctx.shadowBlur=0;
      this._tutFingerLegend(ctx, pw/2, ph-12);

    } else if (mode === "pattern") {
      const nums=[1,2,3,4,5,6,7,8], skip=2, collect=3, cycle=skip+collect;
      const bW=28,bH=28,gap=5,totalW=nums.length*(bW+gap)-gap;
      const sX=(pw-totalW)/2,bY=ph/2-8;
      for (let i=0;i<nums.length;i++) {
        const isC=(i%cycle)>=skip,bx=sX+i*(bW+gap);
        const cols = this._tutNoteColors(isC, nums[i]);
        ctx.beginPath();
        ctx.roundRect(bx,bY,bW,bH,5);
        ctx.fillStyle=cols.bodyFill;
        ctx.fill();
        ctx.strokeStyle=cols.rimColor;
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.fillStyle="#f0f4ff";
        ctx.font="bold 11px 'Trebuchet MS',sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(nums[i],bx+bW/2,bY+bH/2);
      }
      ctx.font="10px 'Trebuchet MS',sans-serif";
      ctx.textAlign="center";
      ctx.fillStyle="rgba(232,124,109,0.85)";
      ctx.fillText("← SKIP 2 →",sX+(skip*(bW+gap))/2-gap/2,bY-11);
      ctx.fillStyle="rgba(109,232,180,0.85)";
      ctx.fillText("← COLLECT 3 →",sX+skip*(bW+gap)+(collect*(bW+gap))/2-gap/2,bY-11);
      this._tutFingerLegend(ctx, pw/2, ph-12);

    } else if (mode === "cannon") {
      const cnx=pw/2,cny=ph/2+8,ang=-0.6+Math.sin(t*0.5)*0.3;
      ctx.beginPath();
      ctx.arc(cnx,cny,20,0,Math.PI*2);
      ctx.fillStyle="#2a4a6e";
      ctx.shadowColor=this.C.accent;
      ctx.shadowBlur=10;
      ctx.fill();
      ctx.shadowBlur=0;
      ctx.save();
      ctx.translate(cnx,cny);
      ctx.rotate(ang-Math.PI/2);
      ctx.fillStyle="#3a6080";
      ctx.beginPath();
      ctx.roundRect(-7,-38,14,38,3);
      ctx.fill();
      ctx.strokeStyle=this.C.accent;
      ctx.lineWidth=1.5;
      ctx.stroke();
      ctx.restore();
      const flyT=(t*0.5)%1, fnx=cnx+Math.cos(ang)*(28+flyT*70), fny=cny+Math.sin(ang)*(28+flyT*70);
      const cols = this._tutNoteColors(true, 6);
      ctx.beginPath();
      ctx.arc(fnx,fny,14,0,Math.PI*2);
      ctx.fillStyle=cols.bodyFill;
      ctx.shadowColor=cols.shadowCol;
      ctx.shadowBlur=10;
      ctx.fill();
      ctx.strokeStyle=cols.rimColor;

      ctx.lineWidth=2;
      ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle="#f0f4ff";
      ctx.font="bold 11px 'Trebuchet MS',sans-serif";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText("6",fnx,fny);
      this._tutFingerLegend(ctx, pw/2, ph-12);

    } else if (mode === "orb") {
      const orx=pw/2,ory=ph/2,oA=t*0.8;
      const og=ctx.createRadialGradient(orx,ory,0,orx,ory,28);
      og.addColorStop(0,"rgba(192,132,252,0.5)");
      og.addColorStop(1,"rgba(14,30,50,0)");
      ctx.fillStyle=og;
      ctx.beginPath();
      ctx.arc(orx,ory,28,0,Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(orx,ory,18,0,Math.PI*2);
      ctx.fillStyle="#1a3a5c";
      ctx.shadowColor="#c084fc";
      ctx.shadowBlur=14;
      ctx.fill();
      ctx.strokeStyle="#c084fc";
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.shadowBlur=0;
      const sR=50+Math.sin(t*1.2)*14, snx=orx+Math.cos(oA)*sR, sny=ory+Math.sin(oA)*sR;
      const cols = this._tutNoteColors(true, 9);
      ctx.beginPath();
      ctx.arc(snx,sny,14,0,Math.PI*2);
      ctx.fillStyle=cols.bodyFill;
      ctx.shadowColor=cols.shadowCol;
      ctx.shadowBlur=10;
      ctx.fill();
      ctx.strokeStyle=cols.rimColor;
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle="#f0f4ff";
      ctx.font="bold 11px 'Trebuchet MS',sans-serif";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText("9",snx,sny);
      this._tutFingerLegend(ctx, pw/2, ph-12);

    } else if (mode === "triple") {
      const tcx=pw/2,tcy=ph/2,triR=Math.min(pw,ph)*0.28,gi=Math.floor(t*0.4)%3;
      for (let i=0;i<3;i++) {
        const a=(i/3)*Math.PI*2-Math.PI/2+t*0.18;
        const ox=tcx+Math.cos(a)*triR,oy=tcy+Math.sin(a)*triR,isG=i===gi;
        ctx.beginPath();
        ctx.arc(ox,oy,13,0,Math.PI*2);
        ctx.fillStyle="#1a3a5c";
        ctx.shadowColor=isG?this.C.gold:this.C.accent;
        ctx.shadowBlur=isG?16:8;
        ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle=isG?this.C.gold:"rgba(142,202,230,0.4)";
        ctx.lineWidth=isG?2.5:1.5;
        ctx.stroke();
        if (isG) {
          const pulse=0.5+Math.sin(t*5)*0.3;
          ctx.strokeStyle=`rgba(245,200,66,${pulse})`;
          ctx.lineWidth=1.5;
          ctx.beginPath();
          ctx.arc(ox,oy,16+pulse*4,0,Math.PI*2);
          ctx.stroke();
        }
      }
      ctx.font="10px 'Trebuchet MS',sans-serif";
      ctx.fillStyle=this.C.gold;
      ctx.textAlign="center";
      ctx.fillText("✦ glowing = fires next",pw/2,ph+8);
      this._tutFingerLegend(ctx, pw/2, ph-12);
    }
    ctx.restore();
  },

  _tutFingerLegend(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x-46,y,8,0,Math.PI*2);
    ctx.fillStyle="rgba(94,180,150,0.35)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x-46,y,4,0,Math.PI*2);
    ctx.fillStyle="#b0f0da";
    ctx.fill();
    ctx.fillStyle="rgba(140,180,220,0.65)";
    ctx.font="11px 'Trebuchet MS',sans-serif";
    ctx.textAlign="left";
    ctx.textBaseline="middle";
    ctx.fillText("= your index finger",x-36,y);
  },

  /* ── No-finger in-game prompt ───────────────────────────── */
  _drawNoFingerPrompt(ctx, dt) {
    const fingers = window.fingerPositions || [];
    if (fingers.length > 0) {
      this._tutNoFingerFrames = 0;
      return;
    }
    this._tutNoFingerFrames++;
    if (this._tutNoFingerFrames < this._tutNoFingerThreshold) return;

    const W = this.centerX * 2, H = this.centerY * 2;
    const blink = Math.sin(performance.now() * 0.003) > 0;
    const copy  = "☝ Show your index finger to play!";
    ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
    const tw  = ctx.measureText(copy).width;
    const bw  = tw + 56, bh = 46;
    const bx  = W / 2 - bw / 2, by = H - 110;
    ctx.globalAlpha = blink ? 0.95 : 0.55;
    ctx.fillStyle = "rgba(8,18,36,0.92)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh/2);
    ctx.fill();
    ctx.strokeStyle = blink ? "#f5c842" : "rgba(245,200,66,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f5c842";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(copy, W / 2, by + bh / 2);
    ctx.globalAlpha = 1;
  },

  _getLevelThreshold(level = this.level) {
  // Tuned against the REAL live-accumulation ceiling (~35-40/round),
  // since skillPoints is now purely fed by _gainXP() during play
  // (1 point per correct hit + 1 bonus per 5-combo).
  const table = {
    1: 22,   // easy — well under half a round of correct hits
    2: 32,   // a bit harder — needs a solid, mostly-clean round
    3: 38,   // barely — needs a near-max round
    4: 40,   // extremely barely — needs an essentially perfect round
    5: 65,   // realistically needs 2 rounds
  };
  if (table[level]) return table[level];
  // Level 6+: keep raising the bar ~1.5-2 rounds worth per level
  return Math.round(65 + (level - 5) * 30);
},

// ── NEW: per-level delta (points needed to go from level-1 → level) ──
_getLevelThresholdDelta(level) {
  const table = {
    1: 22,
    2: 32,
    3: 38,
    4: 40,
    5: 65,
  };
  if (table[level]) return table[level];
  // Level 6+: keep raising the bar ~1.5-2 rounds worth per level
  return Math.round(65 + (level - 5) * 30);
},

_getCumulativeThreshold(level) {
  let total = 0;
  for (let l = 1; l <= level; l++) {
    total += this._getLevelThresholdDelta(l);
  }
  return total;
},

  _difficultyLabelForLevel(level = this.level) {
  return `Speed Level up! Dynamic speed cap shifted up.`;
},


  _syncTierForLevel() {
  for (let t = this.tierThresholds.length - 1; t >= 0; t--) {
    if (this.level >= this.tierThresholds[t]) {
      this.tier = Math.max(this.tier, t);
      break;
    }
  }
},

  _getSpawnIntervalForLevel() {
  const baseMap = { default: 1800, pattern: 2800, cannon: 1800, orb: 1800, triple: 1800 };
  const minMap  = { default: 900,  pattern: 1400, cannon: 900,  orb: 900,  triple: 900 };
  const base = baseMap[this.mode] || 1800;
  const min  = minMap[this.mode] || 900;
  const drop = (this.level - 1) * (this.mode === "pattern" ? 90 : 80);
  return Math.max(min, base - drop);
},

  _syncDifficultyScalars() {
  // Ramps speed baseline significantly higher on each successive level up
  const speedMultiplier = 1 + Math.min(1.9, Math.max(0, this.level - 1) * 0.22); 
  this.speedCap = this.baseOuterRadius * 0.25 * speedMultiplier;
  this.speedMin = this.speedCap * 0.15;
  
  // Protection zone size calculation: 2.5x the size of the flying numbers
  const noteRadius = this.baseOuterRadius * 0.12;
  this.launcherSafeRadius = noteRadius * 2.5; 
  
  // ── FIXED: cumulative threshold instead of per-level absolute.
  //    xp mirrors the real running skillPoints total — no forced reset,
  //    since progress is continuous across level-ups now. ──
  this.levelThreshold = this._getCumulativeThreshold(this.level);
  this.xpToNext = this.levelThreshold;
  this.xp = this.skillPoints;
  if (!this.noteSpeed || this.noteSpeed > this.speedCap) this.noteSpeed = this.speedCap;
},


  _buildRoundPlan() {
    if (this.mode === "pattern") {
      const skip = this.getRandomSkip();
      const collect = Math.floor(Math.random() * 4) + 1;
      return {
        mode: "pattern",
        skip,
        collect,
        title: `SKIP ${skip} COLLECT ${collect}`,
        label: `Skip ${skip}, collect ${collect}`,
      };
    }

    const skip = this.getRandomSkip();
    return {
      mode: this.mode,
      skip,
      collect: 0,
      title: `COLLECT MULTIPLES OF ${skip}`,
      label: `Collect multiples of ${skip}`,
    };
  },

  _applyRoundPlan(plan) {
    this.currentRoundPlan = plan;
    if (!plan) return;

    if (plan.mode === "pattern") {
      this.pattern.skip = plan.skip;
      this.pattern.collect = plan.collect;
    } else {
      this.skipAmount = plan.skip;
    }

    this.gameTitle = plan.title;
    this.spawnInterval = this._getSpawnIntervalForLevel();
    this._syncDifficultyScalars();
    this._updateHintState();
    this.noteSpeed = this.speedCap;
  },

  _resetRoundTransientState() {
    this._noHandDuration = 0; 
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.style.opacity = "0";
    }

    this.notes = [];
    this.popEffects = [];
    this.explosions = [];
    this.missQueue = [];
    this.pendingShot = null;
    this.previewCannons = [];
    this.previewTimer = 0;
    this.isCharging = false;
    this.charge = 0;
    this.chargeParticles = [];
    this.combo = 0;
    this.multiplier = 1;
    this.lastHitType = "";
    this.hitTextTimer = 0;
    this.currentNumber = 1;
    this.roundCorrectTouches = 0;
    this.roundWrongTouches = 0;
    this.roundMissedCorrect = 0;
    this.roundMaxCombo = 0;
    this.roundWrongStreakPeak = 0;
    this.roundMissStreakPeak = 0;
    this.wrongTouchStreak = 0;
    this.missedCorrectStreak = 0;
    this.roundScoreStart = this.score;
    this.roundWrapPending = false;
    this.roundWrapDelay = 0;
    this.overlayHoldProgress = 0;
    this.levelCongratsTapHold = 0;
    this.gameOverFade = 0;
    this.assistTimeBonus = 0;
    this.assistAppliedThisRound = false;
    if (this.mode === "triple" && (!this.tripleCannons || this.tripleCannons.length === 0)) {
        this.tripleCannons = [
            { offset: 0 },
            { offset: (Math.PI * 2) / 3 },
            { offset: (Math.PI * 4) / 3 }
        ];
        this.tripleCount = 3;
    }
  },




  _resetSessionFlow(modeKey) {
    this.recentSkips = []; // Clear history on new session
    this.mode = modeKey || "default";
    this.roundNumber = 1;
    this.nextRoundNumber = 1;
    this.timeLimit = 200; // ── FIXED: reset the time-bar ceiling too, or a
                           //    prior session's inflated ceiling would carry
                           //    over and make the bar start under-filled.
    this.timeRemaining = this.timeLimit;
    this.score = 0;
    this.skillPoints = 0;
    this.bestCombo = 0;
    this.totalCorrectTouches = 0;
    this.totalWrongTouches = 0;
    this.totalMissedCorrect = 0;
    this.level = 1;
    this.levelThreshold = this._getCumulativeThreshold(this.level);
    this.xp = 0;
    this.xpToNext = this.levelThreshold;
    this.tier = 0;
    this.levelUpActive = false;
    this.levelUpTimer = 0;
    this.levelUpParticles = [];
    this.xpPopFlash = 0;
    this.hintState = "full";
    this.noiseTime = 0;
    this.overlayData = null;

    if (!this.nextRoundPlan || this.nextRoundPlan.mode !== this.mode) {
      this.nextRoundPlan = this._buildRoundPlan();
    }

    this.currentRoundPlan = null;
    this._syncDifficultyScalars();
    this.noteSpeed = this.speedCap;
    this.assistTimeBonus = 0;
    this.assistAppliedThisRound = false;
  },

  // ── FIXED: only floor-clamp at 0. Do NOT ceiling-clamp at levelThreshold —
//    that was causing correct hits to silently stop registering once the
//    player hit the cap mid-round, while mistakes could still subtract
//    from that capped value (one-directional-feeling progress). The real
//    level-up decision happens in _resolveRoundEnd() via the >= check. ──
_adjustSkill(amount) {
  this.skillPoints = Math.max(0, this.skillPoints + amount);
  this.xp = this.skillPoints;
  this.xpToNext = this.levelThreshold;
  if (amount > 0) this.xpPopFlash = Math.min(1, this.xpPopFlash + 0.3);
},

  _computeRoundSkillDelta() {
  const attempts = this.roundCorrectTouches + this.roundWrongTouches + this.roundMissedCorrect;
  if (attempts <= 0) return 0;

  const accuracy = this.roundCorrectTouches / attempts;
  const comboNorm = Math.min(1, this.roundMaxCombo / (8 + this.level * 2));
  const scoreEarned = Math.max(0, this.score - this.roundScoreStart);
  const scoreNorm = Math.min(1, scoreEarned / (attempts * 10 + 1));
  const penalty = Math.min(14, this.roundWrongStreakPeak * 1.2 + this.roundMissStreakPeak * 1.45);

  return Math.round((accuracy * 34) + (comboNorm * 18) + (scoreNorm * 12) - penalty);
},



// Cumulative threshold of the PREVIOUS level — the "floor" this level's
// progress bar should start counting from. Returns 0 for level 1.
_getCurrentLevelFloor(level = this.level) {
  return this._getCumulativeThreshold(level - 1);
},

/* ============================================================
   UPDATED FUNCTIONS FOR ILLUSION & LEVEL-UP PROGRESSION
   ============================================================ */

/**
 * Computes the progress percentage for UI/ring display.
 * Applies an illusion cap: if the target criteria is met mid-round,
 * it caps visually at 99% so the ring does not fully close until round end.
 */
_computeProgressPercent(useLiveRound = false) {
  const liveBonus = useLiveRound ? this._computeRoundSkillDelta() : 0;
  const points = Math.max(0, this.skillPoints + liveBonus);
  const floor = this._getCurrentLevelFloor();
  const target = this.levelThreshold;
  const levelRange = Math.max(1, target - floor);

  const raw = ((points - floor) / levelRange) * 100;
  const clamped = Math.max(-100, Math.min(100, Math.round(raw)));

  // ILLUSION: Mid-round progress visually caps at 99% if criteria met
  if (this.gameState === "playing" && points >= target) {
    return 99;
  }

  return clamped;
},

  _maybeGrantAssistTime() {
  if (this.assistAppliedThisRound || this.gameState !== "playing" || this.roundWrapPending) return 0;
  const progress = this._computeProgressPercent(false);
  if (progress < 72 || this.timeRemaining > 42) return 0;
  const bonus = 2 + Math.floor(Math.random() * 4);
  this.timeRemaining += bonus;
  this._bumpTimeCeiling();
  this.assistTimeBonus += bonus;
  this.assistAppliedThisRound = true;
  return bonus;
},

  _prepareNextRoundPlan() {
    this.nextRoundPlan = this._buildRoundPlan();
  },

 /* ============================================================
     UPDATED CORE GAMEPLAY & ROUND SYSTEM FUNCTIONS
  ============================================================ */

  _beginRound() {
    this.gameState = "playing";
    this.roundNumber = this.nextRoundNumber || 1;
    this.nextRoundNumber = this.roundNumber + 1;
    
    // Ensure we have a valid plan generated from the tutorial or previous round breakdown
    if (!this.nextRoundPlan) {
      this.nextRoundPlan = this._buildRoundPlan();
    }
    
    // 1. Apply the plan to the active round state parameters FIRST
    this._applyRoundPlan(this.nextRoundPlan);
    
    // 2. Clear out the staging slot so it doesn't cross contaminate overlay reads
    this.nextRoundPlan = null;
    
    // 3. Reset all dynamic arrays, streaks, and hit counters safely
    this._resetRoundTransientState();
    
    this.spawnInterval = this._getSpawnIntervalForLevel();
    this._restartSpawnTimer();
  },

  _queueRoundEnd() {
  if (this.roundWrapPending || this.gameState !== "playing") return;
  this.roundWrapPending = true;
  this.roundWrapDelay = 0.85;
  // spawn timer no longer exists — spawning stops automatically because
  // _updateSpawning() checks roundWrapPending
},
 /**
 * Handles the end of a round and resolves level progression.
 * Fully fills the ring and completes the actual level transition here.
 */
_resolveRoundEnd() {
  if (this.gameState !== "playing") return;

  const roundSkillDelta = this._computeRoundSkillDelta();
  const progressBefore = this.skillPoints;

  const qualified = this.skillPoints >= this.levelThreshold;
  const canLevelUp = qualified && this.level < this.maxLevel;
  const currentRound = this.roundNumber;

  let nextRound;
  const nextLevel = canLevelUp ? this.level + 1 : this.level;

  if (canLevelUp) {
    nextRound = 1;
  } else {
    nextRound = currentRound + 1;
  }

  let dynamicBonusTime = canLevelUp ? 100 : this.roundEndBonus;

  this.nextRoundPlan = this._buildRoundPlan();

  const summary = {
    roundNumber: currentRound,
    nextRoundNumber: nextRound,
    levelBefore: this.level,
    levelAfter: nextLevel,
    roundSkillDelta,
    progressBefore,
    progressAfter: this.skillPoints,
    // ILLUSION BREAK: Explicitly show 100% completion on summary screens
    progressPercent: canLevelUp ? 100 : this._computeProgressPercent(false),
    timeBeforeBonus: Math.max(0, Math.ceil(this.timeRemaining)),
    bonusTime: dynamicBonusTime,
    totalScore: this.score,
    maxCombo: this.bestCombo,
    roundMaxCombo: this.roundMaxCombo,
    totalWrong: this.totalWrongTouches,
    totalMissed: this.totalMissedCorrect,
    assistTimeBonus: this.assistTimeBonus,
    nextRoundLabel: this.nextRoundPlan.label,
    nextRoundTitle: this.nextRoundPlan.title,
    nextRoundMode: this.nextRoundPlan.mode,
    difficultyLabel: this._difficultyLabelForLevel(nextLevel),
    qualified: canLevelUp,
  };

  this.overlayData = summary;
  this.roundWrapPending = false;
  this.roundWrapDelay = 0;
  this.overlayHoldProgress = 0;
  this.levelCongratsTapHold = 0;
  this.notes = [];
  this.popEffects = [];
  this.explosions = [];
  this.missQueue = [];
  this.pendingShot = null;
  this.previewCannons = [];
  this.previewTimer = 0;
  this.isCharging = false;
  this.charge = 0;
  this.chargeParticles = [];
  this.combo = 0;
  this.multiplier = 1;
  this.lastHitType = "";

  this.timeRemaining = Math.max(0, this.timeRemaining + dynamicBonusTime);
  this._bumpTimeCeiling();
  this.assistTimeBonus = 0;
  this.assistAppliedThisRound = false;

  if (canLevelUp) {
    this.level = nextLevel;
    this.roundNumber = nextRound;
    this.nextRoundNumber = nextRound + 1;

    const overflow = Math.max(0, this.skillPoints - this.levelThreshold);
    this.skillPoints = this.levelThreshold + overflow * 0.1;

    this.levelThreshold = this._getCumulativeThreshold(this.level);
    this.xp = this.skillPoints;
    this.xpToNext = this.levelThreshold;

    summary.progressAfter = this.skillPoints;

    this._syncDifficultyScalars();
    this._syncTierForLevel();
    this._updateHintState();
    this._triggerLevelUpBurst();
    this.gameState = "levelCongrats";
  } else {
    this.roundNumber = currentRound;
    this.nextRoundNumber = nextRound;
    this.gameState = "roundBreak";
  }
},

  _enterGameOver() {
  if (this.gameState === "gameOver") return;
  this.gameState = "gameOver";
  this.gameOverFade = 0;
  this.overlayData = { /* ...unchanged... */ };
  this.roundWrapPending = false;
  this.roundWrapDelay = 0;
  this.overlayHoldProgress = 0;
  this.levelCongratsTapHold = 0;
  this.gameOverFade = 0;
  this.notes = [];
  this.popEffects = [];
  this.explosions = [];
  this.missQueue = [];
  this.pendingShot = null;
  this.previewCannons = [];
  this.previewTimer = 0;
  this.isCharging = false;
  this.charge = 0;
  this.chargeParticles = [];
  // spawn timer no longer exists — nothing to clear
},
  /* ============================================================
     SPAWN TIMER
  ============================================================ */
  /**
 * Called once per round-start / mode-switch to reset spawn timing.
 * No longer creates a setInterval — spawning is now driven by the
 * same dt clock as movement and the countdown timer, so it can't
 * drift or burst independently of everything else.
 */
_restartSpawnTimer() {
  this._spawnAccumulator = 0;
},


/**
 * Frame-synced replacement for the old setInterval spawn loop.
 * Called every update() tick with the (clamped) dt.
 * guard caps catch-up spawns per frame so a big dt spike (e.g. app
 * resuming from background) can't dump a pile of notes at once —
 * this is what was causing the "6 numbers spawn instantly" bug.
 */
_updateSpawning(dt) {
  if (this.gameState !== "playing" || this.roundWrapPending) return;
  this._spawnAccumulator += dt * 1000; // ms, matches this.spawnInterval's units

  let guard = 0;
  while (this._spawnAccumulator >= this.spawnInterval && guard < 2) {
    this._spawnAccumulator -= this.spawnInterval;
    guard++;
    if      (this.mode === "cannon") this.spawnCannonNote();
    else if (this.mode === "orb")    this.spawnOrbNote();
    else if (this.mode === "triple") this.spawnTripleNote();
    else                             this.spawnNote();
  }
},

  /* ============================================================
     ADAPTIVE SPEED
  ============================================================ */
  _penalizeSpeed() { this.noteSpeed = Math.max(this.speedMin, this.noteSpeed - this.speedCap * this.speedPenaltyStep); },
  _recoverSpeed()  { this.noteSpeed = Math.min(this.speedCap, this.noteSpeed + this.speedCap * this.speedRecoveryStep); },
  _driftSpeed(dt) {
  const fingers = window.fingerPositions || [];
  if (fingers.length === 0) return; // don't recover speed while hand is absent
  if (this.noteSpeed < this.speedCap) {
    this.noteSpeed = Math.min(this.speedCap, this.noteSpeed + (this.speedCap - this.noteSpeed) * this.speedDriftRate * dt * 60);
  }
},

  /* ============================================================
     BACKGROUND
  ============================================================ */
  _initBgStars() {
    this.bgStars = [];
    const W = this.centerX * 2, H = this.centerY * 2;
    for (let i = 0; i < 80; i++) {
      this.bgStars.push({
        x: Math.round(Math.random() * W), y: Math.round(Math.random() * H),
        r: 0.5 + Math.random() * 1.4, a: 0.1 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2, ts: 0.012 + Math.random() * 0.018,
      });
    }
  },

  _bgGradient: null,
  _bgGradientKey: "",

  _drawBg(ctx) {
    const W = this.centerX * 2, H = this.centerY * 2;
    // Recreate gradient only when canvas size changes
    const key = `${W}x${H}`;
    if (key !== this._bgGradientKey) {
      this._bgGradientKey = key;
      const g = ctx.createRadialGradient(this.centerX, this.centerY * 0.6, 0, this.centerX, H * 0.5, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#1a2d4a"); g.addColorStop(0.5, "#0f1e35"); g.addColorStop(1, "#080f1c");
      this._bgGradient = g;
    }
    ctx.fillStyle = this._bgGradient;
    ctx.fillRect(0, 0, W, H);
  },

  _drawBgStars(ctx) {
    // Group stars by quantised alpha to minimise state changes.
    // We bucket into 6 alpha levels; within each bucket draw one path.
    const buckets = {};
    for (const s of this.bgStars) {
      s.tw += s.ts;
      const a = Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      // quantise to 6 levels (0.00, 0.10, 0.20, 0.30, 0.40, 0.50)
      const key = (Math.round(a * 10) / 10).toFixed(1);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(s);
    }
    ctx.fillStyle = "#c8dff0";
    for (const [alpha, stars] of Object.entries(buckets)) {
      ctx.globalAlpha = parseFloat(alpha);
      ctx.beginPath();
      for (const s of stars) {
        ctx.moveTo(s.x + s.r, s.y);
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     SKILL PROGRESS
  ============================================================ */
  _gainXP(amount) {
    if (amount <= 0) return;
    this._adjustSkill(amount);
  },

  _updateHintState() {
    // All levels from 1 to end are now permanently neutral (Level 3 style)
    this.hintState = "none";
  },

  // Reused visual result object — avoids allocating a new object every note every frame
  _visResult: { showCorrect: false, showWrong: false, shimmerAmt: 0 },

  _noteVisual(isCorrect, noteId) {
    const h  = this.hintState;
    const v  = this._visResult;
    if (h === "full") {
      v.showCorrect = isCorrect; v.showWrong = !isCorrect; v.shimmerAmt = 0;
    } else if (h === "subtle") {
      v.showCorrect = isCorrect; v.showWrong = false;      v.shimmerAmt = 0;
    } else if (h === "none") {
      v.showCorrect = false;     v.showWrong = false;      v.shimmerAmt = 0;
    } else if (h === "decoy") {
      v.showCorrect = !isCorrect; v.showWrong = isCorrect; v.shimmerAmt = 0;
    } else {
      const t  = this.noiseTime + noteId * 137.5;
      const sh = Math.abs(Math.sin(t * 0.7));
      v.showCorrect = sh > 0.6; v.showWrong = sh < 0.25; v.shimmerAmt = sh;
    }
    return v;
  },

  
  _triggerLevelUpBurst() {
    this.levelUpActive = true; this.levelUpTimer = this.levelUpDuration;
    this.levelUpParticles = [];
    const cols = [this.C.gold, this.C.correct, this.C.accent, "#ffffff"];
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2, v = 180 + Math.random() * 220;
      this.levelUpParticles.push({ x: this.centerX, y: this.centerY, vx: Math.cos(a)*v, vy: Math.sin(a)*v, r: 3+Math.random()*5, color: cols[i%cols.length], life: 1 });
    }
  },

  _updateLevelUp(dt) {
    if (!this.levelUpActive) return;
    this.levelUpTimer -= dt * 1000;
    if (this.xpPopFlash > 0) this.xpPopFlash = Math.max(0, this.xpPopFlash - dt * 3);
    for (const p of this.levelUpParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.vy += 120 * dt;
      p.life -= dt * 1.1;
    }
    this.levelUpParticles = this.levelUpParticles.filter(p => p.life > 0);
    if (this.levelUpTimer <= 0) this.levelUpActive = false;
  },

  _drawLevelUpBurst(ctx) {
    if (!this.levelUpActive) return;
    const prog = 1 - this.levelUpTimer / this.levelUpDuration;
    ctx.shadowBlur = 10;
    for (const p of this.levelUpParticles) {
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
    if (prog > 0.05 && prog < 0.8) {
      const alpha = Math.sin(prog / 0.8 * Math.PI);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.centerX, this.centerY - 110);
      ctx.scale(0.8 + alpha * 0.3, 0.8 + alpha * 0.3);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 44px 'Trebuchet MS', sans-serif";
      ctx.shadowColor = this.C.gold;
      ctx.shadowBlur = 28;
      ctx.fillStyle = this.C.gold;
      ctx.fillText("LEVEL " + this.level + "!", 0, 0);
      ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = this.tierColors[this.tier];
      ctx.shadowColor = this.tierColors[this.tier];
      ctx.shadowBlur = 14;
      ctx.fillText(this.tierNames[this.tier], 0, 46);
      ctx.restore();
    }
  },

  _drawHintChangeAnnouncement(ctx, dt) {
    if (this._hintChangeTimer <= 0 || !this._hintChangeMessage) return;
    this._hintChangeTimer -= dt * 1000;
    const total = 2800, progress = 1 - this._hintChangeTimer / total;
    let alpha;
    if      (progress < 0.14) alpha = progress / 0.14;
    else if (progress < 0.72) alpha = 1;
    else                       alpha = 1 - (progress - 0.72) / 0.28;
    alpha = Math.max(0, Math.min(1, alpha));
    const colors = { subtle:"#f5c842", none:"#8ecae6", decoy:"#e87c6d", chaos:"#c084fc" };
    const col = colors[this.hintState] || "#ffffff";
    const W = this.centerX * 2, bannerY = this.centerY * 0.38;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    const tw = ctx.measureText(this._hintChangeMessage).width;
    const bw = tw + 56, bh = 56, bx = W/2 - bw/2, by = bannerY - bh/2, br = bh/2;
    ctx.beginPath();
    ctx.moveTo(bx+br,by);
    ctx.arcTo(bx+bw,by,bx+bw,by+bh,br);
    ctx.arcTo(bx+bw,by+bh,bx,by+bh,br);
    ctx.arcTo(bx,by+bh,bx,by,br);
    ctx.arcTo(bx,by,bx+bw,by,br);
    ctx.closePath();
    ctx.fillStyle="rgba(8,14,28,0.88)";
    ctx.fill();
    ctx.strokeStyle=col;
    ctx.lineWidth=2;
    ctx.shadowColor=col;
    ctx.shadowBlur=16;
    ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle=col;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.shadowColor=col;
    ctx.shadowBlur=10;
    ctx.fillText(this._hintChangeMessage, W/2, bannerY);
    ctx.restore();
  },

  /**
 * Renders the circular XP ring HUD element.
 * Respects the illusion percentage and suppresses premature level-up visual flashes.
 */
_drawXPRing(ctx, cx, cy, radius) {
  const percent = this.level >= this.maxLevel ? 100 : this._computeProgressPercent(false);
  const fill = Math.abs(percent) / 100;
  const isDeficit = percent < 0;

  const tc = isDeficit ? this.C.wrong : this.tierColors[this.tier];
  const start = -Math.PI / 2;

  // Outer Track
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = this.C.xpTrack;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Active Fill Segment
  if (fill > 0.01) {
    ctx.beginPath();
    if (isDeficit) {
      ctx.arc(cx, cy, radius, start, start - Math.PI * 2 * fill, true);
    } else {
      ctx.arc(cx, cy, radius, start, start + Math.PI * 2 * fill);
    }
    ctx.strokeStyle = tc;
    ctx.lineWidth = 6;
    ctx.shadowColor = tc;
    // Suppress heavy flash intensity while holding at 99% illusion
    const flashIntensity = percent >= 99 && this.gameState === "playing" ? 0 : this.xpPopFlash;
    ctx.shadowBlur = 12 + flashIntensity * 20;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (this.xpPopFlash > 0 && this.gameState !== "playing") {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 12 * this.xpPopFlash, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(245,200,66,${this.xpPopFlash * 0.55})`;
    ctx.lineWidth = 5 * this.xpPopFlash;
    ctx.stroke();
  }
},
  /* ── HUD ─────────────────────────────────────────────────── */
  _pill(ctx, x, y, w, h) {
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    ctx.fillStyle = this.C.hudBg;
    ctx.fill();
    ctx.strokeStyle = this.C.hudBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
  },

 _drawHUD(ctx, isLauncher) {
    const W = this.centerX * 2, H = this.centerY * 2;
    const f = "bold 20px 'Trebuchet MS', sans-serif";
    if (isLauncher) {
      ctx.fillStyle = this.C.hudBg;
      ctx.fillRect(0, 0, W, 50);
      ctx.strokeStyle = this.C.hudBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0,50);
      ctx.lineTo(W,50);
      ctx.stroke();
      ctx.font = f;
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e8f4ff";
      ctx.textAlign = "left";
      ctx.fillText("⭐ "+this.score, 16, 25);
      ctx.fillStyle = this.C.gold;
      ctx.textAlign = "center";
      ctx.font = "bold 17px 'Trebuchet MS', sans-serif";
      ctx.fillText(this.gameTitle, W/2, 25);
      
      ctx.textAlign = "right";
      ctx.fillStyle = this.combo >= 3 ? this.C.correct : "#aac8e0";
      ctx.font = "bold 17px 'Trebuchet MS', sans-serif";
      
      if (this.showSkillDebug) {
        // Shift baseline slightly upwards to make clean visual space for fractional text
        ctx.fillText("x"+this.combo+" combo", W-16, 18);
        ctx.font = "bold 12px 'Trebuchet MS', sans-serif";
        ctx.fillStyle = this.tierColors[this.tier];
        ctx.fillText(`${this.skillPoints}/${this.levelThreshold}`, W-16, 36);
      } else {
        ctx.fillText("x"+this.combo+" combo", W-16, 25);
      }
    } else {
      this._pill(ctx, 14, 14, 155, 42);
      ctx.font = f;
      ctx.fillStyle = "#e8f4ff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("⭐ "+this.score, 28, 35);
      
      // Dynamic scaling panel framework adjustments based on UI diagnostics layout switches
      const pillHeight = this.showSkillDebug ? 56 : 42;
      this._pill(ctx, W-174, 14, 160, pillHeight);
      ctx.textAlign = "right";
      ctx.fillStyle = this.combo >= 3 ? this.C.correct : "#aac8e0";
      
      if (this.showSkillDebug) {
        ctx.fillText("🔥 "+this.combo+"  x"+this.multiplier, W-28, 30);
        ctx.font = "bold 12px 'Trebuchet MS', sans-serif";
        ctx.fillStyle = this.tierColors[this.tier];
        ctx.fillText(`${this.skillPoints}/${this.levelThreshold}`, W-28, 50);
      } else {
        ctx.fillText("🔥 "+this.combo+"  x"+this.multiplier, W-28, 35);
      }
      
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = this.C.gold;
      ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
      ctx.shadowColor = "rgba(245,200,66,0.4)";
      ctx.shadowBlur = 14;
      ctx.fillText(this.gameTitle, W/2, 34);
      ctx.shadowBlur = 0;
    }
    this._drawTimeBar(ctx, isLauncher);
    const ringCX = W/2, ringCY = isLauncher ? H-60 : H-48, ringR = 26;
    this._drawXPRing(ctx, ringCX, ringCY, ringR);
    ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.tierColors[this.tier];
    ctx.shadowColor = this.tierColors[this.tier];
    ctx.shadowBlur = 8;
    ctx.fillText("Lv."+this.level, ringCX, ringCY);
    ctx.shadowBlur = 0;
    const diffLabels = { full:"🟢 Training", subtle:"🟡 Subtle", none:"🔵 Blind", decoy:"🔴 Decoy", chaos:"🟣 Chaos" };
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.font = "13px 'Trebuchet MS', sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = this.tierColors[this.tier];
    ctx.fillText(this.tierNames[this.tier], W-12, H-8);
    ctx.fillStyle = "#c8dff0";
    ctx.fillText(diffLabels[this.hintState]||"", W-12, H-26);
    ctx.globalAlpha = 1;
  },


  // ── FIXED: timeLimit is the time-bar denominator. It was a static 300,
//    so any bonus that pushed timeRemaining above 300 made the bar
//    render as fully-filled ("stuck") until the surplus burned back
//    down below 300. Now timeLimit ratchets up to match the highest
//    timeRemaining we've granted, so the bar always shows the correct
//    proportion right after a bonus instead of pinning at 100%. ──
_bumpTimeCeiling() {
  if (this.timeRemaining > this.timeLimit) this.timeLimit = this.timeRemaining;
},


  _drawTimeBar(ctx, isLauncher) {
    const W = this.centerX * 2;
    const pct = this.timeLimit > 0 ? Math.max(0, Math.min(1, this.timeRemaining / this.timeLimit)) : 0;
    const barW = Math.min(W * 0.52, 380);
    const barH = 12;
    const x = W / 2 - barW / 2;
    const y = isLauncher ? 58 : 58;
    ctx.save();
    ctx.font = "bold 12px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(240,244,255,0.8)";
    ctx.fillText(`Time ${Math.ceil(this.timeRemaining)}s`, (W / 2) +220, y +7);
    ctx.fillStyle = "rgba(8,18,36,0.76)";
    ctx.beginPath();
    ctx.roundRect(x-4, y, barW, barH, 6);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y, x + barW, y);
    g.addColorStop(0, "#e87c6d");
    g.addColorStop(0.45, "#f5c842");
    g.addColorStop(1, "#6de8b4");
    ctx.fillStyle = g;
    ctx.shadowColor = this.timeRemaining < 30 ? "#e87c6d" : this.C.gold;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(x-4, y, barW * pct, barH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(140,180,220,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },

  _drawOverlayCard(ctx, title, subtitle, accent, cardH) {
    const W = this.centerX * 2, H = this.centerY * 2;
    const isMob = W < 540;
    const cardW = Math.min(W - 32, isMob ? 360 : 760);
    const ch = Math.min(H - 48, cardH || (isMob ? 520 : 440));
    const cardX = this.centerX - cardW / 2;
    const cardY = this.centerY - ch / 2;
    const hr = s => {
      const h = (s || "").replace("#", "");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return isNaN(r) ? "140,180,220" : `${r},${g},${b}`;
    };
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(8,18,36,0.96)";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, ch, 20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${hr(accent)},0.34)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = `rgba(${hr(accent)},0.16)`;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 54, [20, 20, 0, 0]);
    ctx.fill();
    ctx.font = `bold ${isMob ? 22 : 28}px 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.fillText(title, this.centerX, cardY + 27);
    ctx.shadowBlur = 0;
    ctx.font = `${isMob ? 12 : 14}px 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = "rgba(240,244,255,0.7)";
    ctx.fillText(subtitle || "", this.centerX, cardY + 65);
    ctx.restore();
    return { W, H, isMob, cardW, cardH: ch, cardX, cardY, accent, hr };
  },

  _drawOverlayLines(ctx, rows, x, y, width, accent, isMob) {
    const rowH = isMob ? 34 : 40;
    const valueX = x + Math.min(width * 0.42, 170);
    rows.forEach((row, i) => {
      const top = y + i * rowH;
      ctx.fillStyle = i % 2 === 0 ? "rgba(20,40,70,0.42)" : "rgba(10,24,44,0.26)";
      ctx.beginPath();
      ctx.roundRect(x, top, width, rowH - 4, 8);
      ctx.fill();
      ctx.font = `bold ${isMob ? 14 : 16}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = accent;
      ctx.fillText(row.label, x + 10, top + (rowH - 4) / 2);
      ctx.font = `${isMob ? 11 : 13}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = "rgba(240,244,255,0.88)";
      ctx.fillText(row.value, valueX, top + (rowH - 4) / 2);
    });
  },

  _drawHoldPrompt(ctx, text, accent, y, progress) {
    const W = this.centerX * 2;
    const p = Math.max(0, Math.min(1, progress || 0));
    ctx.save();
    ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillText(text, W / 2, y);
    ctx.shadowBlur = 0;
    const barW = Math.min(W * 0.48, 320);
    const barX = W / 2 - barW / 2;
    const barY = y + 18;
    ctx.fillStyle = "rgba(20,40,70,0.82)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * p, 8, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  },

  _startNextRoundFromOverlay() {
    if (this.gameState === "levelExplain") {
      this.nextRoundNumber = this.roundNumber; 
    } else {
      this.roundNumber = this.nextRoundNumber || (this.roundNumber + 1);
    }
    
    // Safeguard plan generation parameters in case of anomalies
    if (!this.nextRoundPlan) {
      this.nextRoundPlan = this._buildRoundPlan();
    }
    
    this._beginRound();
  },

  _restartSessionFromGameOver() {
    this._resetSessionFlow(this._pendingMode || this.mode || "default");
    this._beginRound();
  },

  /* ============================================================
     UPDATED OVERLAY DRAWING & UI FEEDBACK FUNCTIONS
  ============================================================ */

  _drawRoundBreakScreen(ctx, fingers, dt) {
    this._drawBg(ctx);
    this._drawBgStars(ctx);
    this._updateLevelUp(dt);
    if (this.levelUpActive) this._drawLevelUpBurst(ctx);

    const summary = this.overlayData || {};
    const hasFing = fingers.length > 0;
    if (hasFing) {
      this.overlayHoldProgress = Math.min(1, this.overlayHoldProgress + dt / this.roundHoldSec);
      if (this.overlayHoldProgress >= 1) {
        this._startNextRoundFromOverlay();
        return;
      }
    } else {
      this.overlayHoldProgress = Math.max(0, this.overlayHoldProgress - dt * 0.45);
    }

    const title = `Round ${summary.roundNumber || this.roundNumber} complete!`;
    const subtitle = `Round ${summary.nextRoundNumber || (this.roundNumber + 1)} starts at 1`;
    const box = this._drawOverlayCard(ctx, title, subtitle, this.C.gold, 500);
    
    // --- CRITICAL FIX: Forces UI to look strictly at upcoming summary plan metadata ---
    const targetTitle = summary.nextRoundTitle || (this.nextRoundPlan ? this.nextRoundPlan.title : "Get Ready!");

    const rows = [
      { label: "Next round", value: targetTitle },
      { label: "Time left", value: `${summary.timeBeforeBonus != null ? summary.timeBeforeBonus : Math.ceil(this.timeRemaining)}s` },
      { label: "Bonus time", value: `+${summary.bonusTime != null ? summary.bonusTime : this.roundEndBonus}s` },
      { label: "Score", value: `${this.score}` },
      { label: "Best combo", value: `${this.bestCombo}` },
      { label: "Next level", value: `${summary.progressPercent || this._computeProgressPercent(false)}% ready` },
    ];
    this._drawOverlayLines(ctx, rows, box.cardX + 16, box.cardY + 82, box.cardW - 32, this.C.gold, box.isMob);
    this._drawHoldPrompt(ctx, `Hold your finger still for ${this.roundHoldSec} seconds to start round ${summary.nextRoundNumber || (this.roundNumber + 1)}`, this.C.correct, box.cardY + box.cardH - 54, this.overlayHoldProgress);
  },

  _drawLevelCongratsScreen(ctx, fingers, dt) {
    this._drawBg(ctx);
    this._drawBgStars(ctx);
    this._updateLevelUp(dt);
    if (this.levelUpActive) this._drawLevelUpBurst(ctx);

    const summary = this.overlayData || {};
    const hasFing = fingers.length > 0;
    if (hasFing) {
      this.levelCongratsTapHold = Math.min(1, this.levelCongratsTapHold + dt / 0.45);
      if (this.levelCongratsTapHold >= 1) {
        this.gameState = "levelExplain";
        this.overlayHoldProgress = 0;
        this.levelCongratsTapHold = 0;
        return;
      }
    } else {
      this.levelCongratsTapHold = Math.max(0, this.levelCongratsTapHold - dt * 0.5);
    }

    const box = this._drawOverlayCard(ctx, "You leveled up!", `Level ${summary.levelAfter || this.level} unlocked`, this.C.correct, 300);
    const rows = [
      { label: "Time bonus", value: `+${summary.bonusTime || this.levelUpBonus}s` },
      { label: "New level", value: `${summary.difficultyLabel || this._difficultyLabelForLevel(summary.levelAfter || this.level)}` },
      { label: "Next round", value: "Tap or hold to see the changes" },
    ];
    this._drawOverlayLines(ctx, rows, box.cardX + 16, box.cardY + 82, box.cardW - 32, this.C.correct, box.isMob);
    if ((summary.assistTimeBonus || 0) > 0) {
      const bonusLines = [
        `🎁 Bonus! A friendly clock fairy dropped +${summary.assistTimeBonus} extra seconds!`,
        "You were on FIRE, so the game gave you a boost! 🔥⏰",
      ];
      ctx.fillStyle = "rgba(240,244,255,0.85)";
      ctx.font = `bold ${box.isMob ? 12 : 14}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bonusLines[0], box.cardX + box.cardW / 2, box.cardY + box.cardH - 90);
      ctx.font = `${box.isMob ? 11 : 13}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = "rgba(245,200,66,0.9)";
      ctx.fillText(bonusLines[1], box.cardX + box.cardW / 2, box.cardY + box.cardH - 70);
    }
    this._drawHoldPrompt(ctx, "Tap or hold to open the next card", this.C.gold, box.cardY + box.cardH - 54, this.levelCongratsTapHold);
  },
  _drawLevelExplainScreen(ctx, fingers, dt) {
    this._drawBg(ctx);
    this._drawBgStars(ctx);
    this._updateLevelUp(dt);
    if (this.levelUpActive) this._drawLevelUpBurst(ctx);

    const summary = this.overlayData || {};
    const hasFing = fingers.length > 0;
    if (hasFing) {
      this.overlayHoldProgress = Math.min(1, this.overlayHoldProgress + dt / this.roundHoldSec);
      if (this.overlayHoldProgress >= 1) {
        this._startNextRoundFromOverlay();
        return;
      }
    } else {
      this.overlayHoldProgress = Math.max(0, this.overlayHoldProgress - dt * 0.45);
    }

    const box = this._drawOverlayCard(ctx, `Level ${summary.levelAfter || this.level}`, `Round ${summary.nextRoundNumber || 1} Ready!`, this.C.accent, 540);
    const visX = box.cardX + 16, visY = box.cardY + 84;
    const visW = box.isMob ? box.cardW - 32 : Math.floor(box.cardW * 0.42);
    const visH = box.isMob ? 130 : 260;
    ctx.fillStyle = "rgba(8,16,36,0.68)";
    ctx.beginPath();
    ctx.roundRect(visX, visY, visW, visH, 12);
    ctx.fill();
    ctx.strokeStyle = `rgba(${box.hr(this.C.accent)},0.14)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    this._tutOrbT += dt;
    
    // --- CRITICAL FIX: Pull visual modes directly from the pre-generated summary plan values ---
    const targetMode = summary.nextRoundMode || (this.nextRoundPlan ? this.nextRoundPlan.mode : this.mode);
    const visMode = targetMode === "default" ? "skip" : targetMode;
    this._drawTutVisual(ctx, visMode, visX, visY, visW, visH, this._tutOrbT, this.C.accent);

    const rulesX = box.isMob ? box.cardX + 16 : box.cardX + visW + 24;
    const rulesY = box.isMob ? visY + visH + 12 : box.cardY + 84;
    const rulesW = box.isMob ? box.cardW - 32 : box.cardW - visW - 40;
    
    const rows = [
      { label: "What's New",       value: "Speed up! 🚀" },
      { label: "Game Speed",      value: "Numbers fly faster now!" },
      { label: "Combo Streak", value: "Hit 5 in a row for multipliers! 🔥" },
      { label: "Where to Tap",    value: "Inside the big gold ring! ⭕" },
    ];
    
    this._drawOverlayLines(ctx, rows, rulesX, rulesY, rulesW - 16, this.C.accent, box.isMob);
    this._drawHoldPrompt(ctx, `Hold your finger still for 3 seconds to play!`, this.C.correct, box.cardY + box.cardH - 54, this.overlayHoldProgress);
  },

  _drawGameOverScreen(ctx, fingers, dt) {
    this._drawBg(ctx);
    this._drawBgStars(ctx);
    this.gameOverFade = Math.min(1, this.gameOverFade + dt * 0.75);
    const fade = this.gameOverFade;
    ctx.save();
    ctx.globalAlpha = fade * 0.72;
    ctx.fillStyle = "#050914";
    ctx.fillRect(0, 0, this.centerX * 2, this.centerY * 2);
    ctx.restore();

    const summary = this.overlayData || {};
    const hasFing = fingers.length > 0;
    if (hasFing) {
      this.overlayHoldProgress = Math.min(1, this.overlayHoldProgress + dt / this.roundHoldSec);
      if (this.overlayHoldProgress >= 1) {
        this._restartSessionFromGameOver();
        return;
      }
    } else {
      this.overlayHoldProgress = Math.max(0, this.overlayHoldProgress - dt * 0.45);
    }

    const box = this._drawOverlayCard(ctx, "Time's up!", `Scoreboard for round ${summary.roundNumber || this.roundNumber}`, this.C.wrong, 470);
    const rows = [
      { label: "Score", value: `${summary.totalScore != null ? summary.totalScore : this.score}` },
      { label: "Max combo", value: `${summary.maxCombo != null ? summary.maxCombo : this.bestCombo}` },
      { label: "Wrong touches", value: `${summary.totalWrong != null ? summary.totalWrong : this.totalWrongTouches}` },
      { label: "Missed correct", value: `${summary.totalMissed != null ? summary.totalMissed : this.totalMissedCorrect}` },
      { label: "Next level", value: `${summary.progressPercent != null ? summary.progressPercent : this._computeProgressPercent(true)}%` },
    ];
    this._drawOverlayLines(ctx, rows, box.cardX + 16, box.cardY + 82, box.cardW - 32, this.C.wrong, box.isMob);

    const barW = box.isMob ? box.cardW - 80 : box.cardW - 120;
    const barX = box.cardX + (box.cardW - barW) / 2;
    const barY = box.cardY + box.cardH - 116;
    const pct = Math.max(0, Math.min(1, (summary.progressPercent != null ? summary.progressPercent : this._computeProgressPercent(true)) / 100));
    ctx.fillStyle = "rgba(20,40,70,0.8)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 14, 7);
    ctx.fill();
    const g = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    g.addColorStop(0, this.C.wrong);
    g.addColorStop(0.5, this.C.gold);
    g.addColorStop(1, this.C.correct);
    ctx.fillStyle = g;
    ctx.shadowColor = this.C.gold;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * pct, 14, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(240,244,255,0.9)";
    ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(pct * 100)}%`, barX + barW + 38, barY + 7);
    ctx.textAlign = "center";
    this._drawHoldPrompt(ctx, "Hold your finger still for 3 seconds to play again", this.C.correct, box.cardY + box.cardH - 54, this.overlayHoldProgress);
  },

  /* ============================================================
     MAIN UPDATE
  ============================================================ */
  update(ctx, fingers, dt = 1/60) {
  // Clamp runaway dt spikes from tab/app backgrounding, camera-permission
  // dialogs, or device stutters. Without this, a 3-5s dt spike can yank
  // timeRemaining down in one frame or fling notes across huge distances.
  dt = Math.min(dt, 1 / 20);

  if (this.gameState === "tutorial") {
    this._updateTutorial(ctx, fingers, dt);
    return;
  }

  if (this.gameState === "loading") return;

  if (this.gameState === "roundBreak")     { this._drawRoundBreakScreen(ctx, fingers, dt); return; }
  if (this.gameState === "levelCongrats")  { this._drawLevelCongratsScreen(ctx, fingers, dt); return; }
  if (this.gameState === "levelExplain")   { this._drawLevelExplainScreen(ctx, fingers, dt); return; }
  if (this.gameState === "gameOver")       { this._drawGameOverScreen(ctx, fingers, dt); return; }

  // ── Live Playing State (Double Tap Active) ──
  this._noHandDuration = 0;
  const pauseBtn = document.getElementById("pauseBtn");
  if (pauseBtn) {
    pauseBtn.style.display = "none";
    pauseBtn.style.opacity = "0";
  }

  this._drawBg(ctx);
  this._drawBgStars(ctx);
  this._updateLevelUp(dt);
  this.noiseTime += dt * 1.8;
  this._driftSpeed(dt);
  const assistDrain = this._computeProgressPercent(false) >= 72 ? 0.55 : 1;
  this.timeRemaining = Math.max(0, this.timeRemaining - (dt * assistDrain));
  this._maybeGrantAssistTime();
  if (this.timeRemaining <= 0) {
    this._enterGameOver();
    this._drawGameOverScreen(ctx, fingers, dt);
    return;
  }

  if (this.roundWrapPending) {
    this._drawBg(ctx);
    this._drawBgStars(ctx);
    this.roundWrapDelay -= dt;
    if (this.roundWrapDelay <= 0) {
      this._resolveRoundEnd();
      return;
    }
    return;
  }

  // ── NEW: dt-synced spawning replaces the old setInterval ──
  this._updateSpawning(dt);

  const isLauncher = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple");
  if (!isLauncher) this.drawRings(ctx, dt);

  if      (this.mode === "cannon") { this.updateCannonNotes(ctx, dt); this.drawCannon(ctx, dt); this.drawExplosions(ctx); this.drawLauncherZone(ctx); this.drawCharging(ctx); this.updateCharging(dt); }
  else if (this.mode === "orb")    { this.updateCannonNotes(ctx, dt); this.drawOrbLauncher(ctx, dt); this.drawExplosions(ctx); this.drawLauncherZone(ctx); this.drawCharging(ctx); this.updateCharging(dt); }
  else if (this.mode === "triple") { this.updateCannonNotes(ctx, dt); this.drawTripleCannons(ctx, dt); this.drawExplosions(ctx); this.drawLauncherZone(ctx); }
  else                             { this.drawNotes(ctx, dt); }

  if (this.mode === "triple" && this.previewTimer > 0) {
    this.previewTimer -= dt;
    if (this.previewTimer <= 0) this.executeTripleShot();
  }

  this.drawPopEffects(ctx);

  fingers.forEach(finger => {
    this.drawFinger(ctx, finger.x, finger.y);
  });

  const now = performance.now();
  if (now - this._lastFingerUpdateTime >= this.FINGER_UPDATE_INTERVAL) {
    this._lastFingerUpdateTime = now;
    for (let i = 0; i < fingers.length; i++) {
      const finger = fingers[i];
      if (isLauncher) this.checkCannonCollision(finger.x, finger.y);
      else            this.checkCollision(finger.x, finger.y);
    }
  }

  this._drawHUD(ctx, isLauncher);
  this._drawLevelUpBurst(ctx);
  this._drawHintChangeAnnouncement(ctx, dt);
  this.drawHitText(ctx);
  this._drawNoFingerPrompt(ctx, dt);
},

  /* ── Finger ─────────────────────────────────────────────── */
  drawFinger(ctx, x, y) {
    ctx.shadowColor = "rgba(126,207,179,0.55)";
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = "rgba(94,180,150,0.38)";
    ctx.beginPath();
    ctx.arc(x, y, this.baseOuterRadius * 0.055, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle  = "#b0f0da";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(x, y, this.baseOuterRadius * 0.025, 0, 6.2832);
    ctx.fill();
    ctx.shadowBlur = 0;
  },

  /* ============================================================
     RING DRAWING — sprite-first, procedural fallback
  ============================================================ */

  /**
   * Public method called each frame.
   * Uses pre-rendered ImageBitmap sprites when ready,
   * falls back to the full procedural path otherwise.
   */
  drawRings(ctx, dt) {
    // Advance animation counters regardless of which path we take
       this.pulseTime  = (this.pulseTime + dt * 2.4) % (Math.PI * 2);
    this.torusAngle = (this.torusAngle + dt * 1.08) % (Math.PI * 2);

    if (RingSpriteSystem.isReady()) {
      /* ── Fast sprite path ─────────────────────────────────
         _spriteFrame accumulates at 60fps-equivalent pace.
         One full 28-frame cycle = 28/60 ≈ 0.47s, matching
         the original torusAngle rotation speed.              */
      this._spriteFrame += dt*10;

      // The sprite was rendered at 512×512 with Ro_base = 180.
      // Scale it so the ring matches the actual game radius.
      const scale = this.baseOuterRadius / 180;

      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.scale(scale, scale);
      RingSpriteSystem.drawFrame(ctx, this._spriteFrame, 0, 0);
      ctx.restore();
    } else {
      // Procedural fallback (original logic)
      this._drawRingsProcedural(ctx);
    }
  },

  /**
   * Original full procedural ring renderer — used as fallback
   * and to borrow the visual recipe for the sprite renderer.
   */
  _drawRingsProcedural(ctx) {
    const cx = this.centerX, cy = this.centerY;
    const Ro = this.currentOuterRadius
             + Math.max(0, Math.sin(this.pulseTime) * this.pulseAmountOuter);
    const Ri = this.currentInnerRadius
             + Math.max(0, Math.sin(this.pulseTime) * this.pulseAmountInner);
    this.currentOuterRadius = Ro;
    this.currentInnerRadius = Ri;
    const Rm = (Ro + Ri) / 2, r = (Ro - Ri) / 2;
    const lx = Math.cos(this.torusAngle), ly = Math.sin(this.torusAngle);
    ctx.save();
    ctx.translate(cx, cy);
    const bloom = ctx.createRadialGradient(0,0,Ri-r*2.5,0,0,Ro+r*3.5);
    bloom.addColorStop(0,"rgba(0,0,0,0)");
    bloom.addColorStop(0.30,"rgba(126,207,179,0.07)");
    bloom.addColorStop(0.52,"rgba(201,147,58,0.14)");
    bloom.addColorStop(0.70,"rgba(142,202,230,0.09)");
    bloom.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=bloom;
    ctx.beginPath();
    ctx.arc(0,0,Ro+r*3.5,0,Math.PI*2);
    ctx.fill();
    const gx0=-lx*(Ro+r),gy0=-ly*(Ro+r),gx1=lx*(Ro+r),gy1=ly*(Ro+r);
    const tg=ctx.createLinearGradient(gx0,gy0,gx1,gy1);
    tg.addColorStop(0,"#0a1525");
    tg.addColorStop(0.22,"#1c3a2a");
    tg.addColorStop(0.40,"#5a3010");
    tg.addColorStop(0.55,"#c9933a");
    tg.addColorStop(0.68,"#e8c87a");
    tg.addColorStop(0.80,"#7ecfb3");
    tg.addColorStop(1,"#0a1525");
    ctx.beginPath();
    ctx.arc(0,0,Ro,0,Math.PI*2);
    ctx.arc(0,0,Ri,0,Math.PI*2,true);
    ctx.fillStyle=tg;
    ctx.shadowColor="rgba(201,147,58,0.4)";
    ctx.shadowBlur=36;
    ctx.fill("evenodd");
    ctx.shadowBlur=0;
    const hd=ctx.createRadialGradient(0,0,Ri*0.65,0,0,Ri);
    hd.addColorStop(0,"rgba(4,10,20,0.82)");
    hd.addColorStop(0.6,"rgba(4,10,20,0.45)");
    hd.addColorStop(1,"rgba(4,10,20,0.0)");
    ctx.beginPath();
    ctx.arc(0,0,Ri,0,Math.PI*2);
    ctx.fillStyle=hd;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0,0,Ro,0,Math.PI*2);
    ctx.strokeStyle="#d4a44a";
    ctx.lineWidth=2.8;
    ctx.shadowColor="rgba(212,164,74,0.6)";
    ctx.shadowBlur=18;
    ctx.stroke();
    ctx.shadowBlur=0;
    ctx.beginPath();
    ctx.arc(0,0,Ri,0,Math.PI*2);
    ctx.strokeStyle="rgba(126,207,179,0.38)";
    ctx.lineWidth=1.8;
    ctx.shadowColor="rgba(126,207,179,0.25)";
    ctx.shadowBlur=10;
    ctx.stroke();
    ctx.shadowBlur=0;
    const shimStart=this.torusAngle-Math.PI*0.35, shimEnd=this.torusAngle+Math.PI*0.35;
    ctx.beginPath();
    ctx.arc(0,0,Rm+r*0.3,shimStart,shimEnd);
    ctx.arc(0,0,Rm-r*0.3,shimEnd,shimStart,true);
    ctx.closePath();
    const sg=ctx.createLinearGradient(Math.cos(this.torusAngle)*(Rm-r*0.3),Math.sin(this.torusAngle)*(Rm-r*0.3),Math.cos(this.torusAngle)*(Rm+r*0.3),Math.sin(this.torusAngle)*(Rm+r*0.3));
    sg.addColorStop(0,"rgba(255,255,255,0.0)");
    sg.addColorStop(0.4,"rgba(255,240,200,0.18)");
    sg.addColorStop(0.7,"rgba(200,240,255,0.22)");
    sg.addColorStop(1,"rgba(255,255,255,0.0)");
    ctx.fillStyle=sg;
    ctx.fill();
    const sx=Math.cos(this.torusAngle)*Ro, sy=Math.sin(this.torusAngle)*Ro;
    const spec=ctx.createRadialGradient(sx,sy,0,sx,sy,r*1.8);
    spec.addColorStop(0,"rgba(255,250,230,0.95)");
    spec.addColorStop(0.3,"rgba(245,215,140,0.55)");
    spec.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=spec;
    ctx.beginPath();
    ctx.arc(sx,sy,r*1.8,0,Math.PI*2);
    ctx.fill();
    const sx2=Math.cos(this.torusAngle+Math.PI*0.18)*Ri, sy2=Math.sin(this.torusAngle+Math.PI*0.18)*Ri;
    const spec2=ctx.createRadialGradient(sx2,sy2,0,sx2,sy2,r*1.2);
    spec2.addColorStop(0,"rgba(180,255,230,0.55)");
    spec2.addColorStop(0.5,"rgba(126,207,179,0.2)");
    spec2.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=spec2;
    ctx.beginPath();
    ctx.arc(sx2,sy2,r*1.2,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  },

  /* ── Notes ───────────────────────────────────────────────── */
  spawnNote() {
    if (this.notes.length >= this.maxNotesOnScreen) return;
    if (this.roundWrapPending || this.gameState !== "playing") return;
    
    // GUARD: If 100 has already been spawned, stop producing new notes entirely
    if (this.currentNumber > this.maxNumber) return;

    const angle = Math.random() * Math.PI * 2;
    const minR  = this.currentOuterRadius + 150, maxR = this.currentOuterRadius + 210;
    const spawnR = Math.random() * (maxR - minR) + minR;
    const num = this.currentNumber++;

    this.notes.push({ 
      x: this.centerX + Math.cos(angle)*spawnR, 
      y: this.centerY + Math.sin(angle)*spawnR, 
      radius: this.baseOuterRadius*0.12, 
      value: num, 
      id: num 
    });
  },
  drawNotes(ctx, dt) {
  const isLauncher = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple");
  if (!isLauncher) {
    this.drawLauncherZone(ctx);
  }

  for (let i = this.notes.length - 1; i >= 0; i--) {
    const note = this.notes[i];

    // ── Note is mid-despawn animation: animate + splice when done ──
    if (note.despawning) {
      note.despawnT += dt;

      // Particles are created lazily on the FIRST despawn-draw frame,
      // not on the trigger frame (which already does scoring/streak/
      // skill math). Keeps the heavy "note hit center" frame light.
      if (!note._despawnParticles) {
        note._despawnParticles = [];
        const count = note.despawnWasCorrect ? 9 : 4;
        for (let p = 0; p < count; p++) {
          const a = (p / count) * Math.PI * 2 + Math.random() * 0.6;
          const v = (note.despawnWasCorrect ? 100 : 55) + Math.random() * 60;
          note._despawnParticles.push({
            x: this.centerX, y: this.centerY,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            life: 1
          });
        }
      }

      this._drawDespawnEffect(ctx, note, dt);

      if (note.despawnT >= note.despawnDuration) {
        this.notes.splice(i, 1);
      }
      continue;
    }

    const dx = this.centerX - note.x, dy = this.centerY - note.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const step = Math.min(this.noteSpeed * dt, len);
    note.x += (dx/len)*step; note.y += (dy/len)*step;

    // Update entry into the central no-hit protection boundary ring area
    if (len <= this.launcherSafeRadius) {
      note.spawnProtected = true;
    }

    const reachedCenter = len <= step + 1;

    if (reachedCenter) {
      const wasCorrect = this.shouldCollect(note.value);

      if (wasCorrect) {
        this.roundMissedCorrect++;
        this.totalMissedCorrect++;
        this.missedCorrectStreak++;
        this.wrongTouchStreak = 0;
        if (this.missedCorrectStreak > this.roundMissStreakPeak) this.roundMissStreakPeak = this.missedCorrectStreak;
        this.score -= 10;
        this.combo = 0;
        this.multiplier = 1;
        this._adjustSkill(-(1.2 + Math.min(2, this.missedCorrectStreak * 0.22)));
        this.missQueue.push(note.value);
      } else {
        this.missedCorrectStreak = 0;
      }

      if (note.value === this.maxNumber) {
        this.roundWrapPending = true;
        this.roundWrapDelay = 1.0;
        if (this.spawnTimer) clearInterval(this.spawnTimer);
      }

      // ── Hand off to despawn animation instead of an instant splice.
      //    Particle creation is deferred to next frame (see above) so
      //    this trigger frame stays cheap. ──
      note.x = this.centerX;
      note.y = this.centerY;
      note.despawning = true;
      note.despawnT = 0;
      note.despawnDuration = wasCorrect ? 0.34 : 0.22;
      note.despawnWasCorrect = wasCorrect;
      note._despawnParticles = null;
      continue;
    }

    this._drawNoteCircle(ctx, note);
  }
},

/**
 * Collapse animation played when a note reaches the center unhit —
 * replaces an instant splice() with a shrinking core, an outward
 * shockwave ring, and a few spark particles.
 *
 * Deliberately avoids ctx.shadowBlur (expensive, especially combined
 * with "lighter" composite mode — was the cause of the ~10ms hitch).
 * Glow is done via radial gradients instead, which are much cheaper
 * for the canvas rasterizer.
 *
 * wasCorrect drives color: red/gold "ouch" burst for missed correct
 * numbers, a cooler blue/neutral fizzle for numbers that didn't need
 * collecting.
 */
_drawDespawnEffect(ctx, note, dt) {
  const t = Math.min(1, note.despawnT / note.despawnDuration);
  const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
  const r = note.radius;
  const wasCorrect = note.despawnWasCorrect;
  const cx = this.centerX, cy = this.centerY;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Outward shockwave ring
  const waveR = r * (1 + ease * 2.4);
  const waveAlpha = (1 - ease) * (wasCorrect ? 0.55 : 0.3);
  if (waveAlpha > 0.01) {
    ctx.beginPath();
    ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
    ctx.strokeStyle = wasCorrect
      ? `rgba(232,124,109,${waveAlpha})`
      : `rgba(142,202,230,${waveAlpha})`;
    ctx.lineWidth = 2.5 * (1 - ease) + 0.6;
    ctx.stroke();
  }

  // Shrinking, fading core — glow via gradient, NOT shadowBlur
  const coreR = Math.max(0, r * (1 - ease));
  if (coreR > 0.5) {
    const glowR = coreR * 2.2;
    const hot = wasCorrect ? "232,124,109" : "142,202,230";
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grd.addColorStop(0,   `rgba(${hot},${0.9 * (1 - ease)})`);
    grd.addColorStop(0.5, `rgba(${hot},${0.35 * (1 - ease)})`);
    grd.addColorStop(1,   `rgba(${hot},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spark particles (created lazily by drawNotes on the first despawn frame)
  if (note._despawnParticles) {
    ctx.fillStyle = wasCorrect ? "#f5c842" : "#c8dff0";
    for (const p of note._despawnParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt / note.despawnDuration;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life) * 0.85;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Number fades out with the core (readable, not jarring)
  if (t < 0.55) {
    ctx.globalAlpha = 1 - (t / 0.55);
    ctx.fillStyle = this.C.noteText;
    ctx.font = `bold ${Math.round(r * 0.72)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(note.value, cx, cy);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
},
 _drawNoteCircle(ctx, note) {
    const r   = note.radius;
    const isC = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple")
                ? this.shouldCollectCannon(note.value) : this.shouldCollect(note.value);
    const vis    = this._noteVisual(isC, note.id || note.value);
    const h      = this.hintState;
    const isVisC = vis.showCorrect, isVisW = vis.showWrong;
    
    // ── Calculate if the note is physically crossing into the gold ring zone ──
    const distFromCenter = Math.hypot(note.x - this.centerX, note.y - this.centerY);
    const isInsideRingZone = (distFromCenter - r) <= (this.currentOuterRadius + 15);
    
    // ── Glow is ONLY allowed in skip ("default") and pattern modes ──
    const glowEligibleMode = (this.mode === "default" || this.mode === "pattern");
    const shouldGlow = glowEligibleMode && isInsideRingZone && !note.spawnProtected;

    ctx.save();
    
    // ── Neutral Feedback Glow Aura Pass ──
    if (shouldGlow) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      
      // Using a soft, bright celestial cyan/gold blend for an absolute neutral feedback aura
      const glowGrd = ctx.createRadialGradient(note.x, note.y, r * 0.1, note.x, note.y, r * 1.8);
      glowGrd.addColorStop(0, "rgba(235, 245, 255, 0.45)"); // Soft cosmic white core
      glowGrd.addColorStop(0.4, "rgba(142, 202, 230, 0.25)"); // Fades into neutral UI light blue
      glowGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = glowGrd;
      ctx.beginPath();
      ctx.arc(note.x, note.y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Original Background Hint Glow Path ──
    if (isVisC || isVisW || vis.shimmerAmt > 0) {
      let ha = isVisC ? 0.16 : isVisW ? 0.11 : vis.shimmerAmt*0.12;
      if (h === "subtle" && isVisC) ha = 0.07;
      const hc = isVisC ? `rgba(109,232,180,${ha})` : isVisW ? `rgba(232,124,109,${ha})` : `rgba(140,180,220,${ha})`;
      const grd = ctx.createRadialGradient(note.x,note.y,r*0.2,note.x,note.y,r*1.4);
      grd.addColorStop(0,hc);
      grd.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=grd;
      ctx.beginPath();
      ctx.arc(note.x,note.y,r*1.4,0,Math.PI*2);
      ctx.fill();
    }

    let bodyFill, rimColor, shadowCol;
    if (isVisC && h !== "subtle") { bodyFill="#0e3028"; rimColor=this.C.correct; shadowCol="rgba(109,232,180,0.45)"; }
    else if (isVisW)               { bodyFill="#2a1010"; rimColor=this.C.wrong;   shadowCol="rgba(232,124,109,0.4)"; }
    else {
      bodyFill  = "#102140";
      rimColor  = `rgba(${Math.round(100+vis.shimmerAmt*80)},${Math.round(160+vis.shimmerAmt*40)},${Math.round(200+vis.shimmerAmt*30)},${0.55+vis.shimmerAmt*0.35})`;
      shadowCol = `rgba(90,150,200,${0.25+vis.shimmerAmt*0.2})`;
    }
    
    // Highlight the card board structure cleanly when inside the active interaction zone
    if (shouldGlow) {
      shadowCol = "rgba(142, 202, 230, 0.6)"; // Bright neutral shadow drop
      rimColor  = "#ffffff";                  // Crisp white edge highlight
    }

    ctx.shadowColor=shadowCol;
    ctx.shadowBlur=shouldGlow ? 30 : 20; 
    ctx.beginPath();
    ctx.arc(note.x,note.y,r,0,Math.PI*2);
    ctx.fillStyle=bodyFill;
    ctx.fill();
    ctx.strokeStyle=rimColor;
    ctx.lineWidth=shouldGlow ? 3.5 : 2.5; 
    ctx.stroke();
    ctx.shadowBlur=0;

    ctx.beginPath();
    ctx.arc(note.x-r*0.27,note.y-r*0.27,r*0.20,0,Math.PI*2);
    ctx.fillStyle = isVisC && h !== "subtle" ? "rgba(200,255,230,0.30)" : "rgba(200,230,255,0.22)";
    ctx.fill();

    if (h === "subtle" && !isC) {
      ctx.globalAlpha=0.18;
      ctx.fillStyle="#aac8e0";
      ctx.font=`bold ${Math.round(r*0.42)}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText("?",note.x,note.y-r*0.55);
      ctx.globalAlpha=1;
    }

    ctx.fillStyle=this.C.noteText;
    ctx.font=`bold ${Math.round(r*0.72)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(note.value,note.x,note.y);
    ctx.restore();
  },
  /* ── Collision ───────────────────────────────────────────── */
  shouldCollect(number) {
    if (this.mode === "default") return number % this.skipAmount === 0;
    if (this.mode === "pattern") { const cycle = this.pattern.skip + this.pattern.collect; return (number-1)%cycle >= this.pattern.skip; }
    return false;
  },
  shouldCollectCannon(number) { return number % this.skipAmount === 0; },

 checkCollision(fingerX, fingerY) {
  for (let index = this.notes.length - 1; index >= 0; index--) {
    const note = this.notes[index];

    // GUARD: skip notes inside the protection zone AND notes already
    // mid-despawn-animation (they're no longer live targets).
    if (note.spawnProtected || note.despawning) continue;

    const dx = fingerX - note.x, dy = fingerY - note.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const dfc = Math.sqrt((note.x - this.centerX)**2 + (note.y - this.centerY)**2);

    // Optimized Condition: Valid collection anywhere INSIDE or ON the outer boundary ring radius limit
    const validCaptureArea = dfc - note.radius <= this.currentOuterRadius;

    if (dist < note.radius + 20 && validCaptureArea) {
      if (this.shouldCollect(note.value)) {
        this.roundCorrectTouches++;
        this.totalCorrectTouches++;
        this.wrongTouchStreak = 0;
        this.missedCorrectStreak = 0;
        this.combo++;
        if (this.combo > this.bestCombo) this.bestCombo = this.combo;
        if (this.combo > this.roundMaxCombo) this.roundMaxCombo = this.combo;
        if (this.combo % 5 === 0) {
          this.multiplier++;
          this._gainXP(1);
        }
        this.score += 10 * this.multiplier;
        this.lastHitType = "CORRECT";
        this._gainXP(1);
        this._recoverSpeed();
        if (this.popEffects.length < this.MAX_POP) this.popEffects.push({x:note.x, y:note.y, life:0, color:this.C.correct});
      } else {
        this.roundWrongTouches++;
        this.totalWrongTouches++;
        this.wrongTouchStreak++;
        this.missedCorrectStreak = 0;
        if (this.wrongTouchStreak > this.roundWrongStreakPeak) this.roundWrongStreakPeak = this.wrongTouchStreak;
        this.combo = 0;
        this.multiplier = 1;
        this.score -= 5;
        this.lastHitType = "WRONG";
        this._adjustSkill(-(1 + Math.min(2, this.wrongTouchStreak * 0.18)));
        this._penalizeSpeed();
        if (this.popEffects.length < this.MAX_POP) this.popEffects.push({x:note.x, y:note.y, life:0, color:this.C.wrong});
      }

      if (note.value === this.maxNumber) {
        this.roundWrapPending = true;
        this.roundWrapDelay = 1.0;
        if (this.spawnTimer) clearInterval(this.spawnTimer);
      }

      this.hitTextTimer = 30;
      this.notes.splice(index, 1);
    }
  }
},

  checkCannonCollision(fingerX, fingerY) {
    for (let i = this.notes.length-1; i >= 0; i--) {
      const note = this.notes[i];
      if (note.spawnProtected) continue;
      const dx=fingerX-note.x, dy=fingerY-note.y;
      if (Math.sqrt(dx*dx+dy*dy) < note.radius+20) {
        if (this.shouldCollectCannon(note.value)) {
          this.roundCorrectTouches++;
          this.totalCorrectTouches++;
          this.wrongTouchStreak = 0;
          this.missedCorrectStreak = 0;
          this.combo++;
          if (this.combo > this.bestCombo) this.bestCombo = this.combo;
          if (this.combo > this.roundMaxCombo) this.roundMaxCombo = this.combo;
          if (this.combo%5===0) {
            this.multiplier++;
            this._gainXP(1);
          }
          this.score+=10*this.multiplier; this.lastHitType="CORRECT";
          this._gainXP(1); this._recoverSpeed(); this.createExplosion(note.x,note.y,this.C.correct);
        } else {
          this.roundWrongTouches++;
          this.totalWrongTouches++;
          this.wrongTouchStreak++;
          this.missedCorrectStreak = 0;
          if (this.wrongTouchStreak > this.roundWrongStreakPeak) this.roundWrongStreakPeak = this.wrongTouchStreak;
          this.combo=0; this.multiplier=1; this.score-=5; this.lastHitType="WRONG";
          this._adjustSkill(-(1 + Math.min(2, this.wrongTouchStreak * 0.18)));
          this._penalizeSpeed(); this.createExplosion(note.x,note.y,this.C.wrong);
        }
        this.hitTextTimer=30; this.notes.splice(i,1);
      }
    }
  },

  /* ── Pop effects ─────────────────────────────────────────── */
  drawPopEffects(ctx) {
    // Single shadow pass for all particles
    ctx.shadowBlur = 12;
    for (let i = this.popEffects.length - 1; i >= 0; i--) {
      const p = this.popEffects[i];
      p.life += 0.025;
      if (p.life >= 1) { this.popEffects.splice(i, 1); continue; }
      const ease  = 1 - Math.pow(1 - p.life, 2);
      const alpha = Math.max(0, 1 - ease);
      const scale = 1 + ease * 0.5;
      ctx.globalAlpha  = alpha;
      ctx.fillStyle    = p.color;
      ctx.shadowColor  = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 32 * scale, 0, 6.2832);
      ctx.fill();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  },

  /* ── Hit text ────────────────────────────────────────────── */
 /* ── Hit text ────────────────────────────────────────────── */
  drawHitText(ctx) {
  // ── FIXED: if a miss just landed in the queue while a CORRECT/WRONG
  //    banner is still showing, cut that banner short so the miss text
  //    shows up immediately instead of waiting out the remaining timer. ──
  if (this.missQueue.length > 0 && this.hitTextTimer > 0 &&
      (this.lastHitType === "CORRECT" || this.lastHitType === "WRONG")) {
    this.hitTextTimer = 0;
  }

  if (this.hitTextTimer<=0 && this.missQueue.length>0) {
    this.missQueue.sort((a,b)=>a-b);
    this.lastHitType = "YOU SKIPPED NUMBER " + this.missQueue.shift();
    this.hitTextTimer=40; this._penalizeSpeed();
  }
  if (this.hitTextTimer>0) {
    const alpha=Math.sin((this.hitTextTimer/40)*Math.PI);
    let color="#ffffff";
    if (this.lastHitType==="CORRECT") color=this.C.correct;
    else if (this.lastHitType==="WRONG") color=this.C.wrong;
    else if (this.lastHitType.includes("SKIPPED")) color=this.C.gold;

    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.font="bold 34px 'Trebuchet MS', sans-serif";
    ctx.textAlign="center";
    ctx.textBaseline="middle";

    const tx = this.centerX;
    const ty = this.centerY - 130;

    if (this.lastHitType.includes("SKIPPED")) {
      const tw = ctx.measureText(this.lastHitType).width;
      const padX = 30, padY = 16;
      const bw = tw + padX * 2, bh = 34 + padY * 2;
      const bx = tx - bw / 2, by = ty - bh / 2, br = bh / 2;

      ctx.beginPath();
      ctx.moveTo(bx+br,by);
      ctx.arcTo(bx+bw,by,bx+bw,by+bh,br);
      ctx.arcTo(bx+bw,by+bh,bx,by+bh,br);
      ctx.arcTo(bx,by+bh,bx,by,br);
      ctx.arcTo(bx,by,bx+bw,by,br);
      ctx.closePath();

      ctx.fillStyle = "rgba(6,13,26,0.94)";
      ctx.fill();

      ctx.strokeStyle = "rgba(245,200,66,0.65)";
      ctx.lineWidth = 2;
      ctx.shadowColor = this.C.gold;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle=color;
    ctx.shadowColor=color;
    ctx.shadowBlur=18;
    ctx.fillText(this.lastHitType, tx, ty);
    ctx.restore();
    this.hitTextTimer--;
  }
},
  /* ── Mode activators ─────────────────────────────────────── */
  activatePatternMode() {
    this.mode="pattern";
    this.nextRoundPlan = this._buildRoundPlan();
    this._beginRound();
  },
  activateCannonMode()       { this.mode="cannon";  this.nextRoundPlan = this._buildRoundPlan(); this._beginRound(); },
  activateOrbMode()          { this.mode="orb";     this.nextRoundPlan = this._buildRoundPlan(); this._beginRound(); },
activateTripleCannonMode() {
    this.mode = "triple";
    this.tripleCount = 3;
    this.tripleCannons = [
        { offset: 0 },
        { offset: (Math.PI * 2) / 3 },
        { offset: (Math.PI * 4) / 3 }
    ];
    this.tripleBaseAngle = 0;
    this.tripleTargetAngle = 0;
    this.nextRoundPlan = this._buildRoundPlan();
    this._beginRound();
},

  _resetLauncherState() {
    this._resetRoundTransientState();
    this.skipAmount = this.getRandomSkip();
    this.noteSpeed = this.speedCap;
  },


  /**
 * Returns the max simultaneous notes allowed for the current mode.
 * Cannon/orb/triple stay capped at 5 (tighter, since launcher modes
 * already feel busier with cannon/orb visuals + explosions on screen).
 * Skip/pattern keep the original maxNotesOnScreen (6).
 */
_getMaxNotesForMode() {
  const isLauncher = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple");
  return isLauncher ? 5 : this.maxNotesOnScreen;
},

  /* ── Cannon ──────────────────────────────────────────────── */
  spawnCannonNote() {
  if (this.notes.length >= this._getMaxNotesForMode()) return;
  if (this.pendingShot || this.roundWrapPending || this.gameState !== "playing") return;
  const angle=Math.random()*Math.PI*2;
  const num=this.currentNumber++;
  if (this.currentNumber>this.maxNumber) {
    this.currentNumber=1;
    this._queueRoundEnd();
  }
  this.pendingShot={angle,speed:this.noteSpeed,value:num,id:num};
  this.cannonTargetAngle=angle+Math.PI/2;
  this.startCharging();
},

  updateCannonNotes(ctx, dt) {
  for (let i=this.notes.length-1; i>=0; i--) {
    const note=this.notes[i];
    note.x+=note.vx*dt; note.y+=note.vy*dt;
    this.updateLauncherProtection(note); this._drawNoteCircle(ctx,note);

    // ── FIXED: was `const m = 120`, causing a visible delay between
    //    the note leaving the canvas and the miss/hit-text registering.
    //    Now the note is only considered "off" once it's fully past
    //    the edge (its own radius), so the miss fires basically the
    //    instant it disappears visually. ──
    const m = note.radius;
    const off=note.x<-m||note.x>this.centerX*2+m||note.y<-m||note.y>this.centerY*2+m;

    if (off) {
      if (this.shouldCollectCannon(note.value)) {
        this.roundMissedCorrect++;
        this.totalMissedCorrect++;
        this.missedCorrectStreak++;
        this.wrongTouchStreak = 0;
        if (this.missedCorrectStreak > this.roundMissStreakPeak) this.roundMissStreakPeak = this.missedCorrectStreak;
        this.score-=10; this.combo=0; this.multiplier=1;
        this.missQueue.push(note.value); this._penalizeSpeed();
        this._adjustSkill(-(1.2 + Math.min(2, this.missedCorrectStreak * 0.22)));
        this.createExplosion(note.x,note.y,"#e8a06d");
      } else {
        this.missedCorrectStreak = 0;
      }
      this.notes.splice(i,1);
    }
  }
},

  drawCannon(ctx) {
    const size=this.baseOuterRadius*0.35;
    this.cannonLength=size*1.4;
    let diff=this.cannonTargetAngle-this.cannonAngle;
    diff=Math.atan2(Math.sin(diff),Math.cos(diff));
    this.cannonAngle+=diff*0.18;
    if (this.pendingShot && Math.abs(diff)<0.05) this.fireCannon();
    ctx.save();
    ctx.translate(this.centerX,this.centerY);
    ctx.rotate(this.cannonAngle);
    const bg=ctx.createRadialGradient(0,0,size*0.1,0,0,size*0.6);
    bg.addColorStop(0,"#2a4a6e");
    bg.addColorStop(1,"#152035");
    ctx.beginPath();
    ctx.arc(0,0,size*0.6,0,Math.PI*2);
    ctx.fillStyle=bg;
    ctx.shadowColor=this.C.accent;
    ctx.shadowBlur=18;
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle="#3a6080";
    ctx.beginPath();
    const bx=-size*0.13,by=-this.cannonLength,bw=size*0.26,bh=this.cannonLength;
    ctx.moveTo(bx+6,by);
    ctx.lineTo(bx+bw-6,by);
    ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+6);
    ctx.lineTo(bx+bw,by+bh);
    ctx.lineTo(bx,by+bh);
    ctx.lineTo(bx,by+6);
    ctx.quadraticCurveTo(bx,by,bx+6,by);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle=this.C.accent;
    ctx.lineWidth=1.5;
    ctx.stroke();
    ctx.restore();
  },

  fireCannon() {
    if (!this.pendingShot) return;
    const {angle,speed,value,id}=this.pendingShot;
    this.notes.push({x:this.centerX,y:this.centerY,radius:this.baseOuterRadius*0.12,value,id:id||value,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,spawnProtected:true});
    this.pendingShot=null;
    this.isCharging=false;
    this.charge=0;
    this.chargeParticles=[];
  },

  /* ── Orb ─────────────────────────────────────────────────── */
  spawnOrbNote() {
  if (this.notes.length >= this._getMaxNotesForMode()) return;
  if (this.roundWrapPending || this.gameState !== "playing") return;
  const angle=Math.random()*Math.PI*2;
  this.orbTargetAngle=angle+Math.PI/2;
  const num=this.currentNumber++;
  if (this.currentNumber>this.maxNumber) {
    this.currentNumber=1;
    this._queueRoundEnd();
  }
  const speed=this.noteSpeed;
  setTimeout(()=>{
    if (this.gameState !== "playing" || this.roundWrapPending) return;
    this.notes.push({x:this.centerX,y:this.centerY,radius:this.baseOuterRadius*0.12,value:num,id:num,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,spawnProtected:true});
  },120);
},

  drawOrbLauncher(ctx) {
    const sz=this.baseOuterRadius*0.6;
    let diff=this.orbTargetAngle-this.orbAngle;
    diff=Math.atan2(Math.sin(diff),Math.cos(diff)); this.orbAngle+=diff*0.18;
    ctx.save();
    ctx.translate(this.centerX,this.centerY);
    ctx.rotate(this.orbAngle);
    if (this.orbImage && this.orbImage.complete && this.orbImage.naturalWidth>0) {
      const img=this.orbImage,sc=sz/Math.max(img.width,img.height);
      ctx.scale(1,-1);
      ctx.drawImage(img,-img.width*sc/2,-img.height*sc/2,img.width*sc,img.height*sc);
    } else {
      const g=ctx.createRadialGradient(0,0,0,0,0,sz/2);
      g.addColorStop(0,"#8ecae6");
      g.addColorStop(0.55,"#1a3a5c");
      g.addColorStop(1,"rgba(14,30,50,0)");
      ctx.fillStyle=g;
      ctx.shadowColor=this.C.accent;
      ctx.shadowBlur=28;
      ctx.beginPath();
      ctx.arc(0,0,sz/2,0,Math.PI*2);
      ctx.fill();
      ctx.shadowBlur=0;
    }
    ctx.restore();
  },

  /* ── Triple cannon ───────────────────────────────────────── */
spawnTripleNote() {
  // GUARD: Initialize if missing
  if (!this.tripleCannons || this.tripleCannons.length === 0) {
      this.tripleCannons = [
          { offset: 0 },
          { offset: (Math.PI * 2) / 3 },
          { offset: (Math.PI * 4) / 3 }
      ];
      this.tripleCount = 3;
  }

  if (this.notes.length >= this._getMaxNotesForMode()) return;
  if (this.roundWrapPending || this.gameState !== "playing") return;
  if (this.previewTimer > 0 || (this.previewCannons && this.previewCannons.length > 0)) return;

  const angle = Math.random() * Math.PI * 2;
  this.tripleTargetAngle = angle + Math.PI / 2;
  this.pendingShot = { angle, speed: this.noteSpeed };
  this.startCharging();
},  drawTripleCannons(ctx, dt) {
    if (!this.tripleCannons || this.tripleCannons.length === 0) {
        this.tripleCannons = [
            { offset: 0 },
            { offset: (Math.PI * 2) / 3 },
            { offset: (Math.PI * 4) / 3 }
        ];
        this.tripleCount = 3;
    }
    
    const sz = this.baseOuterRadius * 0.6;
    
    let diff = this.tripleTargetAngle - this.tripleBaseAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.tripleBaseAngle += diff * 0.18;
    
    if (this.pendingShot && this.previewTimer <= 0 && this.previewCannons.length === 0 && Math.abs(diff) < 0.05) {
        this.fireTriple();
    }
    
    for (let i = 0; i < this.tripleCannons.length; i++) {
        const cannon = this.tripleCannons[i];
        const angle = this.tripleBaseAngle + cannon.offset;
        
        ctx.save();
        ctx.translate(this.centerX, this.centerY);
        ctx.rotate(angle);
        ctx.rotate(Math.PI); // 180° flip
        
        if (this.orbImage && this.orbImage.complete && this.orbImage.naturalWidth > 0) {
            const img = this.orbImage;
            const sc = sz / Math.max(img.width, img.height);
            ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
        } else {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz / 2);
            g.addColorStop(0, "#8ecae6");
            g.addColorStop(0.55, "#1a3a5c");
            g.addColorStop(1, "rgba(14,30,50,0)");
            ctx.fillStyle = g;
            ctx.shadowColor = this.C.accent;
            ctx.shadowBlur = 28;
            ctx.beginPath();
            ctx.arc(0, 0, sz / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        // Preview glow — at the FRONT of the cannon (+Y after 180° flip)
        if (this.previewCannons.includes(i) && this.previewTimer > 0) {
            const pulse = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            
            const glowY = sz * 0.55; // FRONT is at +Y after flip
            
            const g2 = ctx.createRadialGradient(0, glowY, 0, 0, glowY, sz * 0.35);
            g2.addColorStop(0, "rgba(245,200,66,1)");
            g2.addColorStop(0.4, "rgba(245,200,66,0.55)");
            g2.addColorStop(1, "rgba(245,200,66,0)");
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(0, glowY, sz * 0.35 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        ctx.restore();
    }
},
  fireTriple() {
    if (!this.pendingShot) return;
    
    // GUARD: Initialize if missing
    if (!this.tripleCannons || this.tripleCannons.length === 0) {
        this.tripleCannons = [
            { offset: 0 },
            { offset: (Math.PI * 2) / 3 },
            { offset: (Math.PI * 4) / 3 }
        ];
        this.tripleCount = 3;
    }
    
    const pool = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3];
    const fireCount = pool[Math.floor(Math.random() * pool.length)];
    
    this.previewCannons = [];
    while (this.previewCannons.length < fireCount) {
        const ri = Math.floor(Math.random() * this.tripleCount);
        if (!this.previewCannons.includes(ri)) this.previewCannons.push(ri);
    }
    this.previewTimer = this.previewDuration;
},

  executeTripleShot() {
    if (!this.pendingShot || this.previewCannons.length === 0) return;

    const speed = this.pendingShot.speed;
    const delay = 180;
    const shotCount = this.previewCannons.length;

    this.previewCannons.forEach((cannonIndex, index) => {
        setTimeout(() => {
            if (this.gameState !== "playing" || this.roundWrapPending) return;

            // This MUST match the cannon's visual rotation
            const cannonAngle =
                this.tripleBaseAngle +
                this.tripleCannons[cannonIndex].offset +
                Math.PI;

            // Front of the cannon (where the glow is)
            const fireAngle = cannonAngle + Math.PI / 2;

            const value = this.currentNumber++;

            if (this.currentNumber > this.maxNumber) {
                this.currentNumber = 1;
                this._queueRoundEnd();
            }

            this.notes.push({
                x: this.centerX,
                y: this.centerY,
                radius: this.baseOuterRadius * 0.12,
                value: value,
                id: value,
                vx: Math.cos(fireAngle) * speed,
                vy: Math.sin(fireAngle) * speed,
                spawnProtected: true
            });

        }, index * delay);
    });

    setTimeout(() => {
        this.previewCannons = [];
        this.pendingShot = null;
        this.isCharging = false;
        this.charge = 0;
        this.chargeParticles = [];
    }, shotCount * delay);
},

  /* ── Launcher shared ─────────────────────────────────────── */
  updateLauncherProtection(note) {
    const dx=note.x-this.centerX,dy=note.y-this.centerY;
    if (Math.sqrt(dx*dx+dy*dy)>this.launcherSafeRadius) note.spawnProtected=false;
  },
  drawLauncherZone(ctx) {
    ctx.save();
    ctx.setLineDash([6,9]);
    ctx.strokeStyle="rgba(140,180,220,0.18)";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(this.centerX,this.centerY,this.launcherSafeRadius,0,Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },
  startCharging() { this.charge=0; this.isCharging=true; this.chargeParticles=[]; },
  updateCharging(dt) {
    if (!this.isCharging) return;
    this.charge=Math.min(1,this.charge+this.chargeSpeed*dt);
    if (Math.random()<0.35) {
      const a=Math.random()*Math.PI*2;
      this.chargeParticles.push({x:this.centerX+Math.cos(a)*this.launcherSafeRadius,y:this.centerY+Math.sin(a)*this.launcherSafeRadius,life:1});
    }
    for (let i=this.chargeParticles.length-1; i>=0; i--) {
      const p=this.chargeParticles[i];
      p.x+=(this.centerX-p.x)*0.08;
      p.y+=(this.centerY-p.y)*0.08;
      p.life-=dt*1.2;
      if (p.life<=0) this.chargeParticles.splice(i,1);
    }
  },
  drawCharging(ctx) {
    if (!this.isCharging) return;
    ctx.save();
    ctx.globalCompositeOperation="lighter";
    for (const p of this.chargeParticles) {
      ctx.globalAlpha=p.life*0.7;
      ctx.fillStyle=this.C.gold;
      ctx.shadowColor=this.C.gold;
      ctx.shadowBlur=12;
      ctx.beginPath();
      ctx.arc(p.x,p.y,5,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
    const gr=this.baseOuterRadius*0.18*(0.5+this.charge*0.8);
    const g=ctx.createRadialGradient(this.centerX,this.centerY,0,this.centerX,this.centerY,gr);
    g.addColorStop(0,`rgba(245,200,66,${0.65*this.charge})`);
    g.addColorStop(1,"rgba(245,200,66,0)");
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.arc(this.centerX,this.centerY,gr,0,Math.PI*2);
    ctx.fill();
  },

  /* ── Explosions ──────────────────────────────────────────── */
  createExplosion(x,y,color) {
    for (let i=0;i<14;i++) {
      if (this.explosions.length>=this.MAX_EXPL) break;
      const a=Math.random()*Math.PI*2,v=Math.random()*200+100;
      this.explosions.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0,color});
    }
  },
  drawExplosions(ctx) {
    ctx.shadowBlur = 8;
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const p = this.explosions[i];
      p.life += 0.03;
      if (p.life >= 1) { this.explosions.splice(i, 1); continue; }
      p.x += p.vx * 0.016; p.y += p.vy * 0.016;
      ctx.globalAlpha = Math.max(0, 1 - p.life);
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.baseOuterRadius * 0.038, 0, 6.2832);
      ctx.fill();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  },

  /* ── Utility ─────────────────────────────────────────────── */
 recentSkips: [], // Tracks recently used target numbers


 _getSkipPoolForLevel(level = this.level) {
    if (level <= 5) {
      return [2, 3, 4, 5];
    } else if (level <= 10) {
      return [4, 5, 6, 7, 8];
    } else if (level <= 15) {
      return [6, 7, 8, 9, 10, 11];
    } else {
      // Scales dynamically for Level 16+: drops lower numbers and adds higher ones
      const tierIndex = Math.floor((level - 1) / 5); // 3 for Lv 16-20, 4 for Lv 21-25, etc.
      const minNum = 2 + (tierIndex * 2);
      const maxNum = minNum + 5;
      
      const pool = [];
      for (let n = minNum; n <= maxNum; n++) {
        pool.push(n);
      }
      return pool;
    }
  },


  getRandomSkip() {
    const basePool = this._getSkipPoolForLevel(this.level || 1);
    
    // Filter out numbers used in the last 2 rounds
    const available = basePool.filter(num => !this.recentSkips.includes(num));
    
    // Fallback to full pool if filtering eliminates all options (e.g., small pool)
    const pool = available.length > 0 ? available : basePool;
    const selected = pool[Math.floor(Math.random() * pool.length)];

    // Store in history and retain only the last 2 entries
    this.recentSkips.push(selected);
    if (this.recentSkips.length > 2) {
      this.recentSkips.shift();
    }

    return selected;
  },

  fullReset() {
    this.recentSkips = []; // Clear history on full reset
    this.notes = [];
    this.popEffects = [];
    this.explosions = [];
    this.missQueue = [];
    this.currentNumber = 1;
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 8;
    this.tier = 0;
    this.noteSpeed = this.speedCap;
    this.hintState = "full";
    this.noiseTime = 0;
    this.spawnInterval = 1800;
    this.pendingShot = null;
    this.previewCannons = [];
    this.previewTimer = 0;
    this.isCharging = false;
    this.charge = 0;
    this.chargeParticles = [];
    this.torusAngle = 0;
    this.pulseTime = 0;
    this._spriteFrame = 0;
    this.skipAmount = this.getRandomSkip();
    this.gameTitle = "SKIP " + this.skipAmount;
    this._restartSpawnTimer();
  },


  _activateMode(m) {
    this.mode = m || "default";
    this.nextRoundPlan = this._buildRoundPlan();
    this._beginRound();
  }
};




