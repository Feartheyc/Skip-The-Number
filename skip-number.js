/* ============================================================
   OPTIMIZED v3: 
   - Torus Caching: Pre-renders the complex ring to an offscreen canvas.
   - Shadow Removal: Replaced ctx.shadowBlur with manual glow circles.
   - State Batching: Reduced ctx.save/restore overhead.
   - Resource Cleanup: Integrated better memory management.
============================================================ */

const Game1 = {
  /* ── Layout & Performance ───────────────────────────────── */
  centerX: null,
  centerY: null,
  baseOuterRadius: 1000,
  baseInnerRadius: 970,
  currentOuterRadius: 1000,
  currentInnerRadius: 970,
  ringScale: 1.5,
  
  // Offscreen canvas for caching the Torus
  _torusCache: null,
  _cacheSize: 0,

  /* ── Palette ────────────────────────────────────────────── */
  C: {
    bg: "#0d1b2e",
    noteText: "#f0f4ff",
    correct: "#6de8b4",
    wrong: "#e87c6d",
    gold: "#f5c842",
    accent: "#8ecae6",
    hudBg: "rgba(10,20,38,0.78)",
    hudBorder: "rgba(140,180,220,0.18)",
    xpTrack: "rgba(245,200,66,0.15)",
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
  spawnInterval: 2000,

  pulseTime: 0,
  pulseSpeed: 2.2,
  pulseAmountOuter: 10,
  pulseAmountInner: 5,
  torusAngle: 0,

  mode: "default",
  skipAmount: 3,
  gameTitle: "SKIP 3",
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
  tierNames: ["Sprout 🌱", "Star ⭐", "Champ 🏆", "Legend 🌟"],
  tierColors: ["#6de8b4", "#f5c842", "#e8a06d", "#c084fc"],
  tierThresholds: [1, 6, 12, 18],

  levelUpActive: false,
  levelUpTimer: 0,
  levelUpDuration: 1400,
  levelUpParticles: [],
  xpPopFlash: 0,
  hintState: "full",
  noiseTime: 0,

  speedCap: 0,
  speedMin: 0,
  speedPenaltyStep: 0.06,
  speedRecoveryStep: 0.02,
  speedDriftRate: 0.008,

  bgStars: [],
  MAX_POP: 60,   // Reduced slightly for low-end
  MAX_EXPL: 60,

  maxNotesOnScreen: 6, // tweak this (15–30 is a good range)


  /* ============================================================
      INIT
  ============================================================ */
  init() {
    const container = document.getElementById("container");
    const rect = container.getBoundingClientRect();
    
    // Create offscreen canvas for caching
    this._torusCache = document.createElement('canvas');
    
    this.onResize(rect.width, rect.height);

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
    this.xpToNext = 8;
    this.level = 1;
    this.tier = 0;
    this.levelUpActive = false;
    this.xpPopFlash = 0;
    this.hintState = "full";
    this.noiseTime = 0;
    this.spawnInterval = 1200;

    this.mode = "default";
    this.skipAmount = this.getRandomSkip();
    this.gameTitle = "SKIP " + this.skipAmount;
    this.noteSpeed = this.speedCap;

    this.orbImage = new Image();
    this.orbImage.src = "orb1.png";

    this._initBgStars();
    this._restartSpawnTimer();

    window.addEventListener("resize", () => this.fullReset());
  },

  /* ============================================================
      CACHING THE TORUS (Performance Core)
  ============================================================ */
  _preRenderTorus() {
    const Ro = this.baseOuterRadius;
    const Ri = this.baseInnerRadius;
    const r = (Ro - Ri) / 2;
    const padding = 50; 
    
    this._cacheSize = (Ro + padding) * 2;
    this._torusCache.width = this._cacheSize;
    this._torusCache.height = this._cacheSize;
    const tctx = this._torusCache.getContext('2d');
    const mid = this._cacheSize / 2;

    // 1. Static Ambient Nebula (drawn once)
    const bloom = tctx.createRadialGradient(mid, mid, Ri - r * 2, mid, mid, Ro + r * 3);
    bloom.addColorStop(0, "rgba(0,0,0,0)");
    bloom.addColorStop(0.5, "rgba(126,207,179,0.08)");
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    tctx.fillStyle = bloom;
    tctx.beginPath();
    tctx.arc(mid, mid, Ro + r * 3, 0, Math.PI * 2);
    tctx.fill();

    // 2. Static Tube Body
    tctx.beginPath();
    tctx.arc(mid, mid, Ro, 0, Math.PI * 2);
    tctx.arc(mid, mid, Ri, 0, Math.PI * 2, true);
    tctx.fillStyle = "#1a2d4a"; // Flat color for base
    tctx.fill("evenodd");

    // 3. Static Rims (No shadowBlur here!)
    tctx.strokeStyle = "rgba(212,164,74,0.5)";
    tctx.lineWidth = 2;
    tctx.stroke(); 
  },

  onResize(width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    const base = Math.min(width, height);
    this.baseOuterRadius = base * 0.25 * this.ringScale;
    this.baseInnerRadius = this.baseOuterRadius * 0.8;
    
    this.speedCap = this.baseOuterRadius * 0.4;
    this.speedMin = this.speedCap * 0.20;
    this.noteSpeed = this.speedCap;
    this.launcherSafeRadius = this.baseOuterRadius * 0.45;

    this._preRenderTorus();
    this._initBgStars();
  },

  /* ============================================================
      RENDER LOOP OPTIMIZATIONS
  ============================================================ */
  drawRings(ctx, dt) {
    this.pulseTime += this.pulseSpeed * dt;
    this.torusAngle = (this.torusAngle + dt * 0.28) % (Math.PI * 2);

    ctx.save();
    // Use the cache!
    ctx.translate(this.centerX, this.centerY);
    
    // Pulse effect via scaling (cheaper than recalculating radii)
    const pulse = 1 + Math.sin(this.pulseTime) * 0.02;
    ctx.scale(pulse, pulse);
    
    ctx.drawImage(this._torusCache, -this._cacheSize/2, -this._cacheSize/2);

    // Dynamic Specular Highlight (The only dynamic part of the ring)
    const sx = Math.cos(this.torusAngle) * this.baseOuterRadius;
    const sy = Math.sin(this.torusAngle) * this.baseOuterRadius;
    ctx.fillStyle = "rgba(255,250,230,0.4)";
    ctx.beginPath();
    ctx.arc(sx, sy, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  _drawNoteCircle(ctx, note) {
    const r = note.radius;
    const isC = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple")
                ? this.shouldCollectCannon(note.value)
                : this.shouldCollect(note.value);

    const vis = this._noteVisual(isC, note.id || note.value);
    
    // Instead of shadowBlur, we use a manual "Glow" circle
    if (vis.showCorrect || vis.showWrong) {
        ctx.fillStyle = vis.showCorrect ? "rgba(109,232,180,0.2)" : "rgba(232,124,109,0.15)";
        ctx.beginPath();
        ctx.arc(note.x, note.y, r * 1.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Main Circle
    ctx.fillStyle = vis.showCorrect ? "#0e3028" : vis.showWrong ? "#2a1010" : "#102140";
    ctx.beginPath();
    ctx.arc(note.x, note.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = vis.showCorrect ? this.C.correct : vis.showWrong ? this.C.wrong : "#8ecae6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text (Round coords for sharpness)
    ctx.fillStyle = this.C.noteText;
    ctx.font = `bold ${Math.round(r * 0.7)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(note.value, Math.round(note.x), Math.round(note.y));
  },

  /* ============================================================
      EXISTING LOGIC (CORE GAMEPLAY)
  ============================================================ */
  update(ctx, fingers, dt = 1 / 60) {
    // 1. Clear & Background
    ctx.fillStyle = this.C.bg;
    ctx.fillRect(0, 0, this.centerX * 2, this.centerY * 2);
    this._drawBgStars(ctx, dt);

    this.noiseTime += dt * 1.8;
    this._driftSpeed(dt);
    const isLauncher = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple");

    // 2. Gameplay Elements
    if (!isLauncher) this.drawRings(ctx, dt);

    if (this.mode === "cannon") {
      this.updateCannonNotes(ctx, dt);
      this.drawCannon(ctx, dt);
      this.drawExplosions(ctx);
    } else if (this.mode === "orb") {
      this.updateCannonNotes(ctx, dt);
      this.drawOrbLauncher(ctx, dt);
      this.drawExplosions(ctx);
    } else if (this.mode === "triple") {
      this.updateCannonNotes(ctx, dt);
      this.drawTripleCannons(ctx, dt);
      this.drawExplosions(ctx);
    } else {
      this.drawNotes(ctx, dt);
    }

    // 3. Input & Collision
    fingers.forEach((f) => {
      this.drawFinger(ctx, f.x, f.y);
      if (isLauncher) this.checkCannonCollision(f.x, f.y);
      else this.checkCollision(f.x, f.y);
    });

    // 4. UI Overlay
    this._drawHUD(ctx, isLauncher, dt);
    this.drawHitText(ctx);
    if (this.levelUpActive) {
        this._updateLevelUp(dt);
        this._drawLevelUpBurst(ctx);
    }
  },

  // ... [Keep other utility functions like shouldCollect, spawnNote, checkCollision etc. from v2]
  // Note: For the sake of performance, ensure particles in createExplosion 
  // do not use shadowBlur either!

  _restartSpawnTimer() {
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    this.spawnTimer = setInterval(() => {
      if (this.mode === "cannon") this.spawnCannonNote();
      else if (this.mode === "orb") this.spawnOrbNote();
      else if (this.mode === "triple") this.spawnTripleNote();
      else this.spawnNote();
    }, this.spawnInterval);
  },

  getRandomSkip() {
    const w = [2, 2, 2, 3, 3, 3, 4, 4, 5];
    return w[Math.floor(Math.random() * w.length)];
  },

  fullReset() {
    const rect = document.getElementById("container").getBoundingClientRect();
    this.onResize(rect.width, rect.height);
    this.score = 0;
    this.combo = 0;
    this.notes = [];
    this.currentNumber = 1;
    this._restartSpawnTimer();
  }
};