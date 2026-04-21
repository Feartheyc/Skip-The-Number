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
  const FRAME_COUNT   = 28;
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