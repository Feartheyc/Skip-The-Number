const Game10 = {

  /* ============================================================
     CORE CONFIG
  ============================================================ */
  BASE_WIDTH:  1280,
  BASE_HEIGHT: 720,
  scale:    1,
  CENTER_X: 0,
  CENTER_Y: 0,

  get cssWidth()  { return canvasElement.width  / (window.devicePixelRatio || 1); },
  get cssHeight() { return canvasElement.height / (window.devicePixelRatio || 1); },

  /* ============================================================
     THEME SYSTEM  (Q to toggle)
  ============================================================ */
  theme: "space",

  themes: {
    space: {
      bg1: "#0a0e27", bg2: "#1a1040", bg3: "#0d1f3c",
      accent: "#7c3aed", accentGlow: "rgba(124,58,237,0.4)",
      textPrimary: "#e2e8f0", textAccent: "#a78bfa",
      correct: "#34d399", wrong: "#f87171",
      numberColor: "#fbbf24", numberGlow: "rgba(251,191,36,0.6)",
      cardBg: "rgba(255,255,255,0.07)", cardBorder: "rgba(255,255,255,0.15)",
      scoreBg: "rgba(124,58,237,0.3)", heartColor: "#f472b6", streakColor: "#fbbf24",
    },
  },

  get T() { return this.themes[this.theme]; },

  /* ============================================================
     GAME STATE
  ============================================================ */
  score: 0, running: false, lastTime: 0, gameMode: 1,

  /*
   * fingerX/Y: updated every frame from window.fingerPositions
   * We store the PREVIOUS frame's value so we can detect stale data.
   */
  fingerX: null,
  fingerY: null,

  /* Hand tracking smoothing */
fingerSmoothX: null,
fingerSmoothY: null,
fingerSmoothing: 0.12,

  /*
   * Mascot physics in px/ms:
   *   accel    – added to velocity per ms per unit distance (keep small)s
   *   maxSpeed – hard cap px/ms  (0.45 ≈ 27px/frame @60fps — snappy but not jittery)
   *   friction – exponential decay base; applied as  v *= friction^delta
   */
  mascot: {
    x: 0, y: 0, vx: 0, vy: 0,
    accel: 0.012,    // px/ms² per px-of-distance
    maxSpeed: 0.65,   // px/ms
    friction: 0.980, // per-ms decay  (0.980^16 ≈ 0.73 per frame @60fps)
    size: 130
  },


  
  /* Mode 1 */
  mode1Numbers: [], 
  mode1TargetSuffix: "st",
  mode1CorrectTotal: 0, 
  mode1CorrectCollected: 0,
  mode1RoundActive: true, 
  mode1Confirming: false,
  mode1PortalTargetX: 0, 
  mode1PortalTargetY: 0,
  mode1GameOver: false,
  mode1SuctionActive: false, 
  mode1SuctionData: null,
  mode1MergeActive: false,   
  mode1MergeData:   null,
  mode1BreakActive: false,   
  mode1BreakData:   null,
  mode1MaxMatches: 3, 
  mode1MinMatches: 1,

  /* Progressive difficulty */
  level: 1, 
  roundsCompleted: 0, 
  numberRange: 10,

  /* Hearts */
  hearts: 3,
  maxHearts: 3, 
  heartShakeTime: 0,

  /* Streak */
  streak: 0, 
  bestStreak: 0, 
  streakPulse: 0,

  /* Round reward */
  roundRewardActive: false, 
  roundRewardTimer: 0, 
  roundRewardStars: [],

  /* Black hole */
  blackHoleActive: false, 
  blackHoleTime: 0,
  blackHoleDuration: 2800, 
  blackHoleStrength: 0, 
  accretionAngle: 0,

  /* Big Bang */
  bigBangActive: false, 
  bigBangTime: 0,
  bigBangDuration: 1400, 
  bigBangFlash: 0,

  /* Particles — capped arrays to prevent unbounded growth */
  particles: [], 
  sparkBursts: [], 
  floatNumbers: [],
  MAX_PARTICLES: 120,
  MAX_SPARKS: 80,

  /* Background */
  stars: [],
  shootingStars: [],    // strictly capped — max 4 at once
  shootingStarTimer: 0,
  dustMotes: [],

  /* Portal sprite */
  portalFrames: [], 
  portalFrameIndex: 0,
  portalFrameTimer: 0, 
  portalFrameSpeed: 80, portalSize: 200,

  /* Mascot sprites */
  mascotImages: { idle: [], happy: [], confused: [] },
  mascotFrame: 0, 
  mascotFrameTimer: 0, 
  mascotFrameSpeed: 120,
  mascotState: "idle",

  /* Per-number proximity glow */
  proximityGlow: [],

  /* Toast */
  toast: { text: "", timer: 0, color: "#fff", y: 0, alpha: 0, maxTimer: 1600 },

  /* Debug finger dot — set false in production */
  debugFinger: true,

  /* ============================================================
     INIT
  ============================================================ */
  init() {
    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.score = 0; 
    this.running = true; 
    this.lastTime = performance.now();
    this.hearts = 3; 
    this.streak = 0; 
    this.roundsCompleted = 0;
    this.level = 1; 
    this.numberRange = 10;
    this.mode1GameOver = false; 
    this.blackHoleActive = false;
    this.bigBangActive = false; 
    this.bigBangFlash = 0;
    this.particles = [];
    this.sparkBursts = []; 
    this.floatNumbers = [];
    this.shootingStars = [];
    this.heartShakeTime = 0; 
    this.streakPulse = 0;
    this.fingerX = null; 
    this.fingerY = null;

    this.loadMascotSprites();
    this.loadPortalSprites();
    this.initStarfield();
    this.initDustMotes();

    this.mascot.x = this.CENTER_X;
    this.mascot.y = this.CENTER_Y;
    this.mascot.vx = 0; this.mascot.vy = 0;

    this.activateGameMode1();

    canvasElement.addEventListener("click", () => {
      if (this.mode1GameOver) this.retryMode1();
    });
  },

  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr  = window.devicePixelRatio || 1;
    canvasElement.width  = cssW * dpr;
    canvasElement.height = cssH * dpr;
    canvasElement.style.width  = cssW + "px";
    canvasElement.style.height = cssH + "px";
    canvasElement.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale    = Math.min(cssW / this.BASE_WIDTH, cssH / this.BASE_HEIGHT) || 1;
    this.CENTER_X = cssW / 2;
    this.CENTER_Y = cssH / 2;
  },

  toggleTheme() {
    this.theme = this.theme === "space" ? "minimal" : "space";
    this.initStarfield();
    this.initDustMotes();
  },

  activateGameMode1() {
    this.gameMode = 1;
    const s = ["st","nd","rd","th"];
    this.mode1TargetSuffix = s[Math.floor(Math.random() * 4)];
    this.spawnMode1Numbers();
  },

  /* ============================================================
     SUFFIX HELPERS
  ============================================================ */
  getSuffix(num) {
    const t = num % 100;
    if (t >= 11 && t <= 13) return "th";
    const l = num % 10;
    if (l === 1) return "st";
    if (l === 2) return "nd";
    if (l === 3) return "rd";
    return "th";
  },

  generateNumberWithSuffix(suffix) {
    let n;
    do { n = Math.floor(Math.random() * this.numberRange) + 1; }
    while (this.getSuffix(n) !== suffix);
    return n;
  },

  /* ============================================================
     SPAWN NUMBERS
  ============================================================ */
  spawnMode1Numbers() {
    this.mode1Numbers = []; 
    this.proximityGlow = [];
    this.mode1SuctionActive = false; 
    this.mode1SuctionData = null;
    this.mode1MergeActive   = false; 
    this.mode1BreakActive  = false;

    const correctCount = Math.floor(
      Math.random() * (this.mode1MaxMatches - this.mode1MinMatches + 1)
    ) + this.mode1MinMatches;

    this.mode1CorrectTotal = correctCount;
    this.mode1CorrectCollected = 0;
    this.mode1RoundActive  = true;
    this.mode1Confirming   = false;

    const count  = 4 + this.level;
    const margin = 140 * this.scale;
    const safeR  = 170 * this.scale;
    const used   = [];
    let correctSpawned = 0;

    for (let i = 0; i < count; i++) {
      let x, y, att = 0;
      do {
        x = margin + Math.random() * (this.cssWidth  - margin * 2);
        y = margin + Math.random() * (this.cssHeight - margin * 2);
        att++;
      } while (
        (Math.hypot(x - this.CENTER_X, y - this.CENTER_Y) < safeR ||
         used.some(p => Math.hypot(x - p.x, y - p.y) < 130 * this.scale))
        && att < 40
      );
      used.push({ x, y });

      let num;
      if (correctSpawned < correctCount) {
        num = this.generateNumberWithSuffix(this.mode1TargetSuffix);
        correctSpawned++;
      } else {
        do { num = Math.floor(Math.random() * this.numberRange) + 1; }
        while (this.getSuffix(num) === this.mode1TargetSuffix);
      }

      this.mode1Numbers.push({
        number: num, x, y, 
        baseX: x, 
        baseY: y,
        floatAmp:    6 * this.scale,
        floatPeriod: 2500 + Math.random() * 1500,
        floatOffset: Math.random() * Math.PI * 2,
        renderScale: 1, renderRotation: 0,
        spawnAlpha: 0, spawnDelay: i * 80
      });
      this.proximityGlow.push(0);
    }
  },


  update(ctx, _fp, dtArg) {
    if (!this.running) return;

    /* ── Delta resolution ── */
    const now = performance.now();
    let delta;
    if (typeof dtArg === "number" && dtArg > 0 && dtArg < 1) {
      delta = dtArg * 1000;        // seconds → ms
    } else {
      delta = now - this.lastTime;
    }
    delta = Math.min(Math.max(delta, 1), 50); // clamp: min 1ms, max 50ms (prevents spiral on tab-switch)
    this.lastTime = now;

    /* ── Draw order ── */
    this.drawBackground(ctx);

    if (this.theme === "space") {
      this.updateStars(delta);         
      this.drawStars(ctx);
      this.updateShootingStars(delta); 
      this.drawShootingStars(ctx);
    } else {
      this.updateDustMotes(delta);     
      this.drawDustMotes(ctx);
    }

    this.updateBigBang(delta);

    /* Finger must be read BEFORE mascot update every frame */
    this.updateFingerPosition();
    this.updateMascot(delta);
    this.updatePortalAnimation(delta);

    this.updateNumberSpawns(delta);
    this.updateMode1Logic(delta);     // includes proximityGlow
    this.updateMode1Suction(delta);
    this.updateMode1Merge(delta);
    this.updateBlackHole(delta);
    this.updateMode1Break(delta);
    this.updateParticles(delta);
    this.updateSparkBursts(delta);
    this.updateFloatNumbers(delta);
    this.updateToast(delta);
    this.updateRoundReward(delta);
    this.updateHUDTimers(delta);

    this.drawMode1PortalPlayer(ctx);
    this.drawMode1Numbers(ctx);
    this.drawMode1Merge(ctx);
    this.drawBlackHole(ctx);
    this.drawMode1Break(ctx);
    this.drawParticles(ctx);
    this.drawSparkBursts(ctx);
    this.drawFloatNumbers(ctx);
    this.drawRoundReward(ctx);

    this.drawHUD(ctx);
    this.drawInstruction(ctx);
    this.drawToast(ctx);  
    this.drawBigBangFlash(ctx);
    this.drawGameOver(ctx);
  },


updateFingerPosition() {

  if (
    !window.fingerPositions ||
    !Array.isArray(window.fingerPositions) ||
    window.fingerPositions.length === 0
  ) {
    this.fingerX = null;
    this.fingerY = null;
    this.fingerSmoothX = null;
    this.fingerSmoothY = null;
    return;
  }

  const fp = window.fingerPositions[0];

  const rawX = fp.x;
  const rawY = fp.y;

  /* Initialize smoothing */
  if (this.fingerSmoothX === null) {
    this.fingerSmoothX = rawX;
    this.fingerSmoothY = rawY;
  }

  /* 🔧 Better smoothing (less jitter) */
  const smoothing = 0.12; // lower = smoother
  this.fingerSmoothX += (rawX - this.fingerSmoothX) * smoothing;
  this.fingerSmoothY += (rawY - this.fingerSmoothY) * smoothing;

  /* 🧠 Deadzone to ignore tiny noise */
  const DEADZONE = 3; // tweak 2–5

  if (this.fingerX !== null && this.fingerY !== null) {
    const dx = this.fingerSmoothX - this.fingerX;
    const dy = this.fingerSmoothY - this.fingerY;

    if (Math.hypot(dx, dy) < DEADZONE) {
      return; // ignore micro movement
    }
  }

  this.fingerX = this.fingerSmoothX;
  this.fingerY = this.fingerSmoothY;
},

  updateMascot(delta) {

  /* Auto-move during round confirmation */
  if (this.gameMode === 1 && this.mode1Confirming) {
    const dx = this.mode1PortalTargetX - this.mascot.x;
    const dy = this.mode1PortalTargetY - this.mascot.y;

    if (Math.hypot(dx, dy) > 4) {
      const f = 1 - Math.pow(0.92, delta / 16.67);
      this.mascot.x += dx * f;
      this.mascot.y += dy * f;
    } else {
      this.mascot.x = this.mode1PortalTargetX;
      this.mascot.y = this.mode1PortalTargetY;
      this.mode1Confirming = false;
      this.startNewRound();
    }

    this.mascot.vx = 0;
    this.mascot.vy = 0;
    return;
  }

  /* 🎯 Follow finger */
  if (this.fingerX !== null && this.fingerY !== null) {
    const dx = this.fingerX - this.mascot.x;
    const dy = this.fingerY - this.mascot.y;
    const dist = Math.hypot(dx, dy);

    /* 🔧 Bigger threshold removes vibration */
    if (dist > 8) {

      const force = Math.min(dist * this.mascot.accel * delta, this.mascot.maxSpeed);

      this.mascot.vx += (dx / dist) * force;
      this.mascot.vy += (dy / dist) * force;
    }
  }

  /* 🧊 Friction (smooth decay) */
  const fr = Math.pow(this.mascot.friction, delta);
  this.mascot.vx *= fr;
  this.mascot.vy *= fr;

  /* 🚫 Speed cap */
  const spd = Math.hypot(this.mascot.vx, this.mascot.vy);
  if (spd > this.mascot.maxSpeed) {
    const ratio = this.mascot.maxSpeed / spd;
    this.mascot.vx *= ratio;
    this.mascot.vy *= ratio;
  }

  /* 📍 Apply movement */
  this.mascot.x += this.mascot.vx * delta;
  this.mascot.y += this.mascot.vy * delta;

  /* 🛑 Kill micro jitter completely */
  if (Math.abs(this.mascot.vx) < 0.01) this.mascot.vx = 0;
  if (Math.abs(this.mascot.vy) < 0.01) this.mascot.vy = 0;

  /* 🧱 Screen bounds */
  const pad = 70 * this.scale;
  this.mascot.x = Math.max(pad, Math.min(this.cssWidth - pad, this.mascot.x));
  this.mascot.y = Math.max(pad, Math.min(this.cssHeight - pad, this.mascot.y));
},
  /* ============================================================
     SPRITE LOADING
  ============================================================ */
  loadMascotSprites() {
    for (let i = 0; i <= 4; i++) { 
      const img = new Image(); 
      img.src = `MID-I/0${i}_MID-I.png`; 
      this.mascotImages.idle.push(img); 
    }
    for (let i = 0; i <= 3; i++) { 
      const img = new Image(); 
      img.src = `MID-H/0${i}_MID-H.png`; 
      this.mascotImages.happy.push(img); 
    }
    for (let i = 0; i <= 2; i++) { 
      const img = new Image(); 
      img.src = `MID-C/0${i}_MID-C.png`; 
      this.mascotImages.confused.push(img); 
    }
  },

  loadPortalSprites() {
    this.portalFrames = [];
    for (let i = 0; i <= 8; i++) { 
      const img = new Image(); 
      img.src = `D-1/0${i}_D-1.png`; 
      this.portalFrames.push(img); 
    }
  },

  updatePortalAnimation(delta) {
    this.portalFrameTimer += delta;
    if (this.portalFrameTimer >= this.portalFrameSpeed) {
      this.portalFrameIndex  = (this.portalFrameIndex + 1) % Math.max(1, this.portalFrames.length);
      this.portalFrameTimer -= this.portalFrameSpeed;
    }
  },

  /* ============================================================
     BACKGROUND
  ============================================================ */
  drawBackground(ctx) {
    const T = this.T, W = this.cssWidth, H = this.cssHeight;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (this.theme === "space") {
      g.addColorStop(0, T.bg1);
      g.addColorStop(0.5, T.bg2); 
      g.addColorStop(1, T.bg3);
    } else {
      g.addColorStop(0, T.bg1); 
      g.addColorStop(1, T.bg2);
    }
    ctx.fillStyle = g; 
    ctx.fillRect(0, 0, W, H);

    const r = ctx.createRadialGradient(this.CENTER_X, this.CENTER_Y * 0.7, 0, this.CENTER_X, this.CENTER_Y * 0.7, W * 0.55);
    r.addColorStop(0, this.theme === "space" ? "rgba(124,58,237,0.12)" : "rgba(99,102,241,0.07)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = r; 
    ctx.fillRect(0, 0, W, H);
  },


  initStarfield() {
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x:          Math.random() * this.cssWidth,
        y:          Math.random() * this.cssHeight,
        r:          Math.random() * 1.8 + 0.3,
        speed:      0.008 + Math.random() * 0.025,   // px/ms — gentle drift downward
        twinkle:    Math.random() * Math.PI * 2,
        twinkleSpd: 0.002 + Math.random() * 0.003,   // rad/ms
        vx: 0, 
        vy: 0
      });
    }
  },

  updateStars(delta) {
    for (let s of this.stars) {
      s.y       += s.speed * delta;
      s.twinkle += s.twinkleSpd * delta;
      if (s.y > this.cssHeight) { s.y = 0; s.x = Math.random() * this.cssWidth; }
    }
  },

  drawStars(ctx) {
    for (let s of this.stars) {
      ctx.globalAlpha = Math.max(0, 0.35 + Math.sin(s.twinkle) * 0.3);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.fill();
    }
    ctx.globalAlpha = 1;
  },


  initShootingStarTimer() {
    this.shootingStarTimer    = 0;
    this.shootingStarInterval = 2500 + Math.random() * 3000; // ms, set once
  },

  updateShootingStars(delta) {
    this.shootingStarTimer += delta;

    if (
      this.shootingStarTimer >= this.shootingStarInterval &&
      this.shootingStars.length < 4   // hard cap
    ) {
      this.shootingStarTimer = 0;
      this.shootingStarInterval = 2500 + Math.random() * 3000; // set next interval

      const fl = Math.random() < 0.5;
      const spd = (7 + Math.random() * 5) * 0.055; // px/ms
      this.shootingStars.push({
        x:       fl ? -60 : this.cssWidth + 60,
        y:       Math.random() * this.cssHeight * 0.5,
        vx:      fl ? spd : -spd,
        vy:      (1.5 + Math.random() * 1.5) * 0.055,
        life:    0,
        maxLife: 900
      });
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.x += s.vx * delta;
      s.y += s.vy * delta;
      s.life += delta;
      if (s.life > s.maxLife) this.shootingStars.splice(i, 1);
    }
  },

  drawShootingStars(ctx) {
    for (let s of this.shootingStars) {
      const alpha = Math.max(0, 1 - s.life / s.maxLife);
      const tailLen = 160;
      const absVx = Math.abs(s.vx) || 0.01;
      const tx = s.x - s.vx * tailLen / absVx;
      const ty = s.y - s.vy * tailLen / absVx;

      const grd = ctx.createLinearGradient(s.x, s.y, tx, ty);
      grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grd.addColorStop(1,  "rgba(255,255,255,0)");
      ctx.strokeStyle = grd;
      ctx.lineWidth   = 2 * this.scale;
      ctx.beginPath(); 
      ctx.moveTo(s.x, s.y); 
      ctx.lineTo(tx, ty); 
      ctx.stroke();
    }
  },

  /* ============================================================
     DUST MOTES (minimal)
  ============================================================ */
  initDustMotes() {
    this.dustMotes = [];
    for (let i = 0; i < 60; i++) {
      this.dustMotes.push({
        x: Math.random() * this.cssWidth,
        y: Math.random() * this.cssHeight,
        r: Math.random() * 3 + 1,
        vx: (Math.random() - 0.5) * 0.00006,
        vy: -(0.00004 + Math.random() * 0.00006),
        alpha: Math.random() * 0.15 + 0.05
      });
    }
  },

  updateDustMotes(delta) {
    for (let d of this.dustMotes) {
      d.x += d.vx * delta; 
      d.y += d.vy * delta;
      if (d.y < -10)               { d.y = this.cssHeight + 10; d.x = Math.random() * this.cssWidth; }
      if (d.x < -10)               { d.x = this.cssWidth + 10; }
      if (d.x > this.cssWidth + 10){ d.x = -10; }
    }
  },

  drawDustMotes(ctx) {
    for (let d of this.dustMotes) {
      ctx.globalAlpha = d.alpha;
      ctx.beginPath(); 
      ctx.arc(d.x, d.y, d.r * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = this.T.accent; 
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     PORTAL PLAYER
  ============================================================ */
  drawMode1PortalPlayer(ctx) {
    const T   = this.T;
    const px  = this.mascot.x, py = this.mascot.y;
    const sz  = this.portalSize * this.scale;
    const now = performance.now();

    const spdN = Math.min(Math.hypot(this.mascot.vx, this.mascot.vy) / this.mascot.maxSpeed, 1);
    const scX  = 1 + spdN * 0.10;
    const scY  = 1 - spdN * 0.07;
    const bob  = Math.sin(now * 0.003) * 5 * this.scale;

    ctx.save();
    ctx.translate(px, py + bob);
    ctx.scale(scX, scY);

    /* Glow halo */
    const halo = ctx.createRadialGradient(0, 0, sz * 0.25, 0, 0, sz * 0.75);
    halo.addColorStop(0, T.accentGlow); 
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath(); 
    ctx.arc(0, 0, sz * 0.75, 0, Math.PI * 2); ctx.fill();

    /* Portal sprite with fallback */
    const frame = this.portalFrames[this.portalFrameIndex];
    if (frame && frame.complete && frame.naturalWidth > 0) {
      ctx.drawImage(frame, -sz / 2, -sz / 2, sz, sz);
    } else {
      ctx.beginPath(); 
      ctx.arc(0, 0, sz * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = T.accent; 
      ctx.globalAlpha = 0.85; 
      ctx.fill(); 
      ctx.globalAlpha = 1;
    }

    /* Suffix label */
    ctx.shadowColor = T.accentGlow; ctx.shadowBlur = 20;
    ctx.font = `bold ${Math.round(52 * this.scale)}px 'Fredoka', cursive`;
ctx.textAlign = "center";
ctx.textBaseline = "middle";

/* 🔥 Thin black outline */
ctx.lineWidth = 2 * this.scale;   // VERY thin
ctx.strokeStyle = "black";
ctx.strokeText(this.mode1TargetSuffix.toUpperCase(), 0, 0);

/* Fill text */
ctx.fillStyle = "#ffffff";
ctx.fillText(this.mode1TargetSuffix.toUpperCase(), 0, 0);
    ctx.shadowBlur = 0;

    if (this.mascotState === "happy") {
      const rr = 96 * this.scale + Math.sin(now * 0.01) * 8;
      ctx.strokeStyle = T.correct; 
      ctx.lineWidth = 4 * this.scale; 
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); 
      ctx.arc(0, 0, rr, 0, Math.PI * 2); 
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  },

  /* ============================================================
     NUMBER SPAWNS
  ============================================================ */
  updateNumberSpawns(delta) {
    for (let n of this.mode1Numbers) {
      if (n.spawnDelay > 0) { n.spawnDelay -= delta; }
      else                  { n.spawnAlpha = Math.min(1, n.spawnAlpha + delta * 0.003); }
    }
  },

  /* ============================================================
     PROXIMITY GLOW
  ============================================================ */
  updateProximityGlow(delta) {
    if (this.level > 1) {
    for (let i = 0; i < this.proximityGlow.length; i++) {
      this.proximityGlow[i] = 0;
    }
    return;
  }
    const px = this.mascot.x, py = this.mascot.y;
    const maxD = 270 * this.scale;
    /* Lerp coefficient: approach ~15% closer per 16ms frame at 60fps */
    const k = 1 - Math.pow(0.985, delta);

    for (let i = 0; i < this.mode1Numbers.length; i++) {
      const n = this.mode1Numbers[i];
      const t = Math.max(0, 1 - Math.hypot(px - n.x, py - n.y) / maxD);
      this.proximityGlow[i] += (t - this.proximityGlow[i]) * k;
    }
  },

  drawMode1Numbers(ctx) {
    const T   = this.T;
    const now = performance.now();

    for (let i = 0; i < this.mode1Numbers.length; i++) {
      const n    = this.mode1Numbers[i];
      if (n.spawnAlpha <= 0.01) continue;

      const glow = this.level === 1 ? (this.proximityGlow[i] || 0) : 0;

      const fY  = Math.sin((now / n.floatPeriod) * Math.PI * 2 + n.floatOffset) * n.floatAmp;


      const sc  = (n.renderScale || 1) * (1 + glow * 0.12);
      const isC = this.getSuffix(n.number) === this.mode1TargetSuffix;

      ctx.save();
      ctx.globalAlpha = n.spawnAlpha;
      ctx.translate(n.x, n.y + fY);
      ctx.rotate(n.renderRotation || 0);
      ctx.scale(sc, sc);

      if (glow > 0.05) {
        ctx.shadowColor = isC ? T.correct : T.wrong;
        ctx.shadowBlur  = 22 * glow;
      }

      const cr = 44 * this.scale;
      ctx.fillStyle   = T.cardBg;
      ctx.strokeStyle = glow > 0.1 ? (isC ? T.correct : T.wrong) : T.cardBorder;
      ctx.lineWidth   = (2 + glow * 3) * this.scale;
      this._rrect(ctx, -cr, -cr * 0.72, cr * 2, cr * 1.44, 16 * this.scale);
      ctx.fill(); 
      ctx.stroke();

      ctx.shadowColor  = T.numberGlow; ctx.shadowBlur = 12 + glow * 18;
      ctx.fillStyle    = T.numberColor;
      ctx.font         = `bold ${Math.round(46 * this.scale)}px 'Fredoka', cursive`;
      ctx.textAlign    = "center"; ctx.textBaseline = "middle";
      ctx.fillText(n.number, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  },

  /* ============================================================
     MODE 1 LOGIC
  ============================================================ */
  updateMode1Logic(delta) {
    this.updateProximityGlow(delta);

    if (!this.mode1RoundActive || this.mode1GameOver ||
        this.mode1SuctionActive || this.mode1BreakActive ||
        this.blackHoleActive    || this.mode1Confirming) return;

    for (let i = 0; i < this.mode1Numbers.length; i++) {
      const n = this.mode1Numbers[i];
      if (n.spawnAlpha < 0.5) continue;
      if (Math.hypot(this.mascot.x - n.x, this.mascot.y - n.y) < 65 * this.scale) {
        this.startMode1Suction(i); break;
      }
    }
  },

  /* ============================================================
     SUCTION
  ============================================================ */
  startMode1Suction(index) {
    const n = this.mode1Numbers[index];
    this.mode1SuctionActive = true;
    this.mode1SuctionData   = {
      index,
      startX: n.x, 
      startY: n.y,
      targetX: this.mascot.x, 
      targetY: this.mascot.y,
      time: 0, 
      duration: 420
    };
  },

  updateMode1Suction(delta) {
    if (!this.mode1SuctionActive) return;
    const s = this.mode1SuctionData;
    const n = this.mode1Numbers[s.index];
    if (!n) { this.mode1SuctionActive = false; return; }

    s.targetX = this.mascot.x; s.targetY = this.mascot.y;
    s.time   += delta;
    const p   = Math.min(1, s.time / s.duration);
    const ep  = 1 - Math.pow(1 - p, 3);   // ease-out cubic
    n.x = s.startX + (s.targetX - s.startX) * ep;
    n.y = s.startY + (s.targetY - s.startY) * ep;
    n.renderScale = 1 - ep * 0.4;
    if (p >= 1) this.finishMode1Suction();
  },

  finishMode1Suction() {
    const s = this.mode1SuctionData;
    const n = this.mode1Numbers[s.index];
    if (!n) return;

    const correct = this.getSuffix(n.number) === this.mode1TargetSuffix;

    if (correct) {
      this.score += 10;
      this.streak++; if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      this.streakPulse = 1;
      this.mascotState = "happy";
      this.startPortalMerge(n.number);
      this.mode1Numbers.splice(s.index, 1);
      this.proximityGlow.splice(s.index, 1);
      this.showToast(this.getPositiveFeedback(), this.T.correct);
      this.spawnCorrectParticles(this.mascot.x, this.mascot.y);
    } else {
      this.score = Math.max(0, this.score - 3);
      this.streak = 0;
      this.hearts = Math.max(0, this.hearts - 1);
      this.heartShakeTime = 520;
      this.mascotState = "confused";
      this.spawnHintFloater(n.number, n.x, n.y);
      this.showToast(this.getWrongFeedback(n.number), this.T.wrong);
      this.spawnWrongParticles(this.mascot.x, this.mascot.y);
      this.mode1Numbers.splice(s.index, 1);
      this.proximityGlow.splice(s.index, 1);
      this.startNumberBreak(n.number);
      if (this.hearts <= 0) setTimeout(() => this.startBlackHoleCollapse(), 600);
    }

    this.mode1SuctionActive = false;
    this.mode1SuctionData   = null;
    setTimeout(() => { if (this.mascotState !== "idle") this.mascotState = "idle"; }, 1100);
  },

  getPositiveFeedback() {
    if (this.streak >= 5) return ["🔥 You're on FIRE!", "🌟 Unstoppable!", "🚀 Total Genius!"][Math.floor(Math.random()*3)];
    if (this.streak >= 3) return ["⭐ Amazing streak!", "💫 Keep going!", "🎯 So good!"][Math.floor(Math.random()*3)];
    return ["✅ That's right!", "🎉 Correct!", "👏 Great job!", "💡 You got it!", "🥳 Woohoo!"][Math.floor(Math.random()*5)];
  },

  getWrongFeedback(num) { return `💡 ${num} is ${num}${this.getSuffix(num)} — try again!`; },

  /* ============================================================
     HINT FLOATER
  ============================================================ */
  spawnHintFloater(num, x, y) {
    this.floatNumbers.push({
      text: `${num}${this.getSuffix(num)}`, x, y,
      vy: -0.06, alpha: 1, life: 1400, maxLife: 1400
    });
  },

  updateFloatNumbers(delta) {
    for (let i = this.floatNumbers.length - 1; i >= 0; i--) {
      const f = this.floatNumbers[i];
      f.y    += f.vy * delta;
      f.life -= delta;
      f.alpha = Math.max(0, f.life / f.maxLife);
      if (f.life <= 0) this.floatNumbers.splice(i, 1);
    }
  },

  drawFloatNumbers(ctx) {
    for (let f of this.floatNumbers) {
      ctx.save(); 
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle    = this.T.wrong;
      ctx.font         = `bold ${Math.round(38 * this.scale)}px 'Fredoka', cursive`;
      ctx.textAlign    = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor  = this.T.wrong; ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  },

  /* ============================================================
     MERGE ANIMATION
  ============================================================ */
  startPortalMerge(number) {
    this.mode1MergeActive = true;
    this.mode1MergeData   = {
      number, 
      suffix: this.mode1TargetSuffix,
      angle: 0, 
      radius: 80 * this.scale,
      time: 0, 
      duration: 800, 
      scale: 1
    };
  },

  updateMode1Merge(delta) {
    if (!this.mode1MergeActive) return;
    const m = this.mode1MergeData;
    m.time += delta;
    const p = m.time / m.duration;

    if (p < 0.45) {
      m.angle  += 0.009 * delta;
    } else if (p < 0.78) {
      m.angle  += 0.017 * delta;
      m.radius *= Math.pow(0.994, delta);
    } else {
      m.radius *= Math.pow(0.978, delta);
      m.scale  *= Math.pow(0.992, delta);
    }

    if (p >= 1) {
      this.spawnSparkBurst(this.mascot.x, this.mascot.y);
      this.mode1MergeActive = false;
      this.mode1CorrectCollected++;
      if (this.mode1CorrectCollected >= this.mode1CorrectTotal) this.startMode1Confirmation();
    }
  },

  drawMode1Merge(ctx) {
    if (!this.mode1MergeActive) return;
    const m = this.mode1MergeData;
    const x = this.mascot.x + Math.cos(m.angle) * m.radius;
    const y = this.mascot.y + Math.sin(m.angle) * m.radius;
    ctx.save(); ctx.translate(x, y); ctx.scale(m.scale, m.scale);
    ctx.shadowColor = this.T.correct; ctx.shadowBlur = 28;
    ctx.fillStyle   = "#ffffff";
    ctx.font        = `bold ${Math.round(60 * this.scale)}px 'Fredoka', cursive`;
    ctx.textAlign   = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${m.number}${m.suffix}`, 0, 0);
    ctx.restore();
  },

  /* ============================================================
     ROUND CONFIRMATION & REWARD
  ============================================================ */
  startMode1Confirmation() {
    this.mode1RoundActive   = false;
    this.mode1Confirming    = true;
    this.mode1PortalTargetX = this.CENTER_X;
    this.mode1PortalTargetY = this.CENTER_Y - 40 * this.scale;
    this.startRoundReward();
  },

  startRoundReward() {
    this.roundRewardActive = true;
    this.roundRewardTimer  = 1600;
    this.roundRewardStars  = [];
    for (let i = 0; i < 18; i++) {
      const ang = (Math.PI * 2 / 18) * i;
      this.roundRewardStars.push({
        angle: ang, radius: 0,
        speed: (2.5 + Math.random() * 2) * 0.055,
        size:  (8 + Math.random() * 8) * this.scale,
        color: ["#fbbf24","#34d399","#a78bfa","#f472b6"][Math.floor(Math.random()*4)]
      });
    }
  },

  updateRoundReward(delta) {
    if (!this.roundRewardActive) return;
    this.roundRewardTimer -= delta;
    for (let s of this.roundRewardStars) s.radius += s.speed * delta;
    if (this.roundRewardTimer <= 0) this.roundRewardActive = false;
  },

  drawRoundReward(ctx) {
    if (!this.roundRewardActive) return;
    const px = this.mascot.x, py = this.mascot.y;
    const lf = Math.max(0, this.roundRewardTimer / 1600);

    for (let s of this.roundRewardStars) {
      ctx.globalAlpha = lf * 0.88;
      ctx.beginPath();
      ctx.arc(px + Math.cos(s.angle) * s.radius, py + Math.sin(s.angle) * s.radius, s.size, 0, Math.PI * 2);
      ctx.fillStyle = s.color; 
      ctx.shadowColor = s.color; 
      ctx.shadowBlur = 10; 
      ctx.fill(); 
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    const prog = 1 - lf;
    if (prog > 0.08 && prog < 0.88) {
      const alpha = Math.sin(prog * Math.PI);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.CENTER_X, this.CENTER_Y - 160 * this.scale);
      ctx.scale(0.7 + alpha * 0.4, 0.7 + alpha * 0.4);
      ctx.fillStyle = this.T.correct;
      ctx.font      = `bold ${Math.round(56 * this.scale)}px 'Fredoka', cursive`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = this.T.correct; ctx.shadowBlur = 20;
      ctx.fillText("⭐ Round Clear!", 0, 0);
      ctx.restore();
    }
  },

  startNewRound() {
    this.roundsCompleted++;
    if (this.roundsCompleted % 3 === 0 && this.level < 3) {
      this.level++;
      this.numberRange = [10, 20, 30][this.level - 1];
      this.showToast(`🎮 Level ${this.level}! Numbers get bigger!`, this.T.streakColor);
    }
    const s = ["st","nd","rd","th"];
    this.mode1TargetSuffix = s[Math.floor(Math.random() * 4)];
    this.spawnMode1Numbers();
  },

  /* ============================================================
     NUMBER BREAK
  ============================================================ */
  startNumberBreak(number) {
    const px = this.mascot.x, py = this.mascot.y;
    this.mode1BreakActive = true;
    this.mode1BreakData   = { number, x: px, y: py, pieces: [], time: 0 };
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (Math.random() * 5 + 2) * 0.055;
      this.mode1BreakData.pieces.push({
        x: px, y: py,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.014,
        alpha: 1
      });
    }
  },

  updateMode1Break(delta) {
    if (!this.mode1BreakActive) return;
    const b = this.mode1BreakData;
    b.time += delta;
    for (let p of b.pieces) {
      p.x   += p.vx * delta; 
      p.y  += p.vy * delta;
      p.vx  *= Math.pow(0.996, delta);
      p.vy *= Math.pow(0.996, delta);
      p.rot += p.vr * delta;
      p.alpha = Math.max(0, 1 - b.time / 700);
    }
    if (b.time > 700) this.mode1BreakActive = false;
  },

  drawMode1Break(ctx) {
    if (!this.mode1BreakActive) return;
    for (let p of this.mode1BreakData.pieces) {
      ctx.save(); ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle    = this.T.wrong;
      ctx.font         = `bold ${Math.round(40 * this.scale)}px 'Fredoka', cursive`;
      ctx.textAlign    = "center"; ctx.textBaseline = "middle";
      ctx.fillText(this.mode1BreakData.number, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     BLACK HOLE
  ============================================================ */
  startBlackHoleCollapse() {
    this.blackHoleActive   = true;
    this.blackHoleTime     = 0;
    this.blackHoleStrength = 0;
    this.accretionAngle    = 0;
  },

  updateBlackHole(delta) {
    this.accretionAngle += (0.04 + (this.blackHoleStrength || 0) * 0.004) * delta * 0.05;
    if (!this.blackHoleActive) return;

    this.blackHoleTime    += delta;
    const prog             = this.blackHoleTime / this.blackHoleDuration;
    this.blackHoleStrength = prog * 20;

    const cx = this.mascot.x, cy = this.mascot.y;
    const suck = (arr) => {
      for (let s of arr) {
        const dx = cx - s.x, dy = cy - s.y;
        const d  = Math.hypot(dx, dy) + 0.1;
        const f  = 0.0012 * this.blackHoleStrength * delta;
        s.x += (dx / d) * f * d + (-dy / d) * f * 0.7 * d;
        s.y += (dy / d) * f * d + ( dx / d) * f * 0.7 * d;
      }
    };
    suck(this.stars);

    for (let n of this.mode1Numbers) {
      const dx = cx - n.x, dy = cy - n.y;
      const f  = 0.0022 * this.blackHoleStrength * delta;
      n.x += dx * f; n.y += dy * f;
      n.renderScale    = (n.renderScale    || 1) * Math.pow(0.9985, delta);
      n.renderRotation = (n.renderRotation || 0) + 0.022 * delta;
    }

    if (prog >= 1) { this.blackHoleActive = false; this.mode1GameOver = true; }
  },

  drawBlackHole(ctx) {
    if (!this.blackHoleActive) return;
    const px = this.mascot.x, py = this.mascot.y;
    const r  = (100 + Math.sin(performance.now() * 0.018) * 18) * this.scale;

    ctx.save(); ctx.translate(px, py); ctx.rotate(this.accretionAngle);
    const disk = ctx.createRadialGradient(0, 0, r*0.28, 0, 0, r*1.15);
    disk.addColorStop(0,    "rgba(0,0,0,0)");
    disk.addColorStop(0.38, "rgba(255,180,60,0.55)");
    disk.addColorStop(0.74, "rgba(255,80,0,0.72)");
    disk.addColorStop(1,    "rgba(180,0,120,0)");
    ctx.fillStyle = disk;
    ctx.beginPath(); 
    ctx.ellipse(0, 0, r*1.15, r*0.36, 0, 0, Math.PI*2); 
    ctx.fill();
    ctx.restore();

    const core = ctx.createRadialGradient(px, py, 8, px, py, r);
    core.addColorStop(0, "#000"); 
    core.addColorStop(0.5, "#050505"); 
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core; 
    ctx.beginPath(); 
    ctx.arc(px, py, r, 0, Math.PI*2); 
    ctx.fill();

    const msgs  = ["🌀 Uh oh!", "⚠️ Collapsing!", "💀 Oh no!"];
    ctx.globalAlpha = Math.min(1, this.blackHoleTime / 400);
    ctx.fillStyle   = "#fbbf24";
    ctx.font        = `bold ${Math.round(44 * this.scale)}px 'Fredoka', cursive`;
    ctx.textAlign   = "center"; ctx.textBaseline = "middle";
    ctx.fillText(msgs[Math.floor(this.blackHoleTime / 900) % msgs.length], px, py - r - 28 * this.scale);
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     BIG BANG
  ============================================================ */
  startBigBang() {
    this.bigBangActive = true; this.bigBangTime = 0; this.bigBangFlash = 1;
    const cx = this.CENTER_X, cy = this.CENTER_Y;
    for (let s of this.stars) {
      const a = Math.random() * Math.PI * 2;
      const v = (Math.random() * 7 + 3) * 0.065;
      s.x = cx; s.y = cy; s.vx = Math.cos(a)*v; s.vy = Math.sin(a)*v;
    }
  },

  updateBigBang(delta) {
    if (!this.bigBangActive) return;
    this.bigBangTime += delta;
    const p = this.bigBangTime / this.bigBangDuration;
    for (let s of this.stars) {
      if (s.vx !== undefined) {
        s.x += s.vx * delta; s.y += s.vy * delta;
        s.vx *= Math.pow(0.998, delta); s.vy *= Math.pow(0.998, delta);
      }
    }
    this.bigBangFlash = Math.max(0, 1 - p * 2.2);
    if (p >= 1) { this.bigBangActive = false; this.initStarfield(); }
  },

  drawBigBangFlash(ctx) {
    if (this.bigBangFlash <= 0) return;
    ctx.fillStyle = `rgba(255,255,255,${this.bigBangFlash})`;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  },

  /* ============================================================
     GAME OVER
  ============================================================ */
  drawGameOver(ctx) {
    if (!this.mode1GameOver) return;
    const W = this.cssWidth, H = this.cssHeight, s = this.scale;
    ctx.fillStyle = "rgba(0,0,0,0.78)"; 
    ctx.fillRect(0, 0, W, H);

    const cw = Math.min(Math.max(W * 0.52, 320 * s), 620 * s);
    const ch = 290 * s;
    const cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;

    ctx.fillStyle   = this.theme === "space" ? "rgba(18,12,46,0.97)" : "rgba(255,252,245,0.97)";
    this._rrect(ctx, cx, cy, cw, ch, 24 * s); ctx.fill();
    ctx.strokeStyle = this.T.wrong; ctx.lineWidth = 3 * s;
    this._rrect(ctx, cx, cy, cw, ch, 24 * s); ctx.stroke();

    const mx = W / 2;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    ctx.fillStyle   = this.T.wrong;
    ctx.font        = `bold ${Math.round(Math.min(50 * s, 50))}px 'Fredoka', cursive`;
    ctx.shadowColor = this.T.wrong; ctx.shadowBlur = 14;
    ctx.fillText("💥 Oops! Try Again!", mx, cy + ch * 0.24); ctx.shadowBlur = 0;

    ctx.fillStyle = this.T.textPrimary;
    ctx.font      = `bold ${Math.round(Math.min(28 * s, 28))}px 'Fredoka', cursive`;
    ctx.fillText(`⭐ Score: ${this.score}   |   🔥 Best Streak: ${this.bestStreak}`, mx, cy + ch * 0.52);

    const pulse = 0.82 + Math.sin(performance.now() * 0.004) * 0.18;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = this.T.correct;
    ctx.font        = `bold ${Math.round(Math.min(24 * s, 24))}px 'Fredoka', cursive`;
    ctx.fillText("👆 Tap anywhere to rebuild the galaxy!", mx, cy + ch * 0.8);
    ctx.globalAlpha = 1;
  },

  retryMode1() {
    this.mode1GameOver = false; 
    this.hearts = 3; 
    this.streak = 0;
    this.score = 0; 
    this.level = 1; 
    this.numberRange = 10; 
    this.roundsCompleted = 0;
    this.particles = []; 
    this.sparkBursts = []; 
    this.floatNumbers = [];
    this.shootingStars = [];
    this.heartShakeTime = 0; 
    this.streakPulse = 0;
    const s = ["st","nd","rd","th"];
    this.mode1TargetSuffix = s[Math.floor(Math.random() * 4)];
    this.startBigBang();
    this.spawnMode1Numbers();
  },

  /* ============================================================
     HUD TIMERS
  ============================================================ */
  updateHUDTimers(delta) {
    if (this.heartShakeTime > 0) this.heartShakeTime = Math.max(0, this.heartShakeTime - delta);
    if (this.streakPulse    > 0) this.streakPulse    = Math.max(0, this.streakPulse    - delta * 0.003);
  },

  /* ============================================================
     HUD
  ============================================================ */
  drawHUD(ctx) {
  const T = this.T, s = this.scale;
  const W = this.cssWidth, H = this.cssHeight;

  /* Score */
  const sw = 175 * s, sh = 54 * s, sx = 18 * s, sy = 16 * s;
  ctx.fillStyle = T.scoreBg;
  this._rrect(ctx, sx, sy, sw, sh, 18 * s); 
  ctx.fill();
  ctx.fillStyle = T.numberColor;
  ctx.font = `bold ${Math.round(26 * s)}px 'Fredoka', cursive`;
  ctx.textAlign = "center"; 
  ctx.textBaseline = "middle";
  ctx.fillText(`⭐ ${this.score}`, sx + sw / 2, sy + sh / 2);

  /* Hearts */
  const hSz = 32 * s, hGap = 8 * s;
  const totalHW = this.maxHearts * (hSz + hGap) - hGap;
  const hx0 = W - 18 * s - totalHW, hy0 = 18 * s;
  const shk = this.heartShakeTime > 0 ? Math.sin(this.heartShakeTime * 0.055) * 5 * s : 0;

  for (let i = 0; i < this.maxHearts; i++) {
    const filled = i < this.hearts;
    ctx.globalAlpha = filled ? 1 : 0.2;
    ctx.font = `${Math.round(hSz)}px serif`;
    ctx.textAlign = "left"; 
    ctx.textBaseline = "top";
    ctx.fillText("❤️", hx0 + i * (hSz + hGap), hy0 + (filled ? shk : 0));
  }
  ctx.globalAlpha = 1;

  /* 🔥 FIXED STREAK POSITION */
  if (this.streak >= 2) {
    const ps = 1 + this.streakPulse * 0.3;

    /* 👇 SAME HEIGHT AS INSTRUCTION + OFFSET */
    const instructionTop = 20 * s;
    const instructionHeight = 48 * s;
    const gap = 20 * s;

    const streakY = instructionTop + instructionHeight + gap;

    ctx.save();
    ctx.translate(W / 2, streakY);
    ctx.scale(ps, ps);

    ctx.globalAlpha = 0.88 + this.streakPulse * 0.12;
    ctx.fillStyle = T.streakColor;
    ctx.font = `bold ${Math.round(24 * s)}px 'Fredoka', cursive`;
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle";

    ctx.shadowColor = T.streakColor;
    ctx.shadowBlur = 10;

    ctx.fillText(`🔥 ${this.streak} in a row!`, 0, 0);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* Level badge */
  const lw = 200 * s, lh = 40 * s;
  const lx = W / 2 - lw / 2, ly = H - 58 * s;

  ctx.fillStyle = T.scoreBg;
  this._rrect(ctx, lx, ly, lw, lh, 13 * s);
  ctx.fill();

  ctx.fillStyle = T.textAccent;
  ctx.font = `bold ${Math.round(18 * s)}px 'Fredoka', cursive`;
  ctx.textAlign = "center"; 
  ctx.textBaseline = "middle";

  ctx.fillText(
    `Level ${this.level}  ·  ${this.roundsCompleted} round${this.roundsCompleted !== 1 ? "s" : ""}`,
    lx + lw / 2,
    ly + lh / 2
  );
},

  /* ============================================================
     INSTRUCTION BANNER
  ============================================================ */
  drawInstruction(ctx) {
  if (this.mode1GameOver || this.blackHoleActive) return;

  const T = this.T, s = this.scale;
  const W = this.cssWidth, H = this.cssHeight;
  const suf = this.mode1TargetSuffix;

  /* 🔼 Position at TOP CENTER */
  const maxW = Math.min(W - 44 * s, 700 * s);
  const bh = 48 * s;
  const bx = W / 2 - maxW / 2;
  const by = 20 * s;   // 👈 moved to TOP (was bottom)

  /* Background */
  ctx.fillStyle = T.cardBg;
  this._rrect(ctx, bx, by, maxW, bh, 13 * s);
  ctx.fill();

  ctx.strokeStyle = T.cardBorder;
  ctx.lineWidth = 1.5 * s;
  this._rrect(ctx, bx, by, maxW, bh, 13 * s);
  ctx.stroke();

  /* Text */
  ctx.fillStyle = T.textPrimary;
  ctx.font = `bold ${Math.round(19 * s)}px 'Fredoka', cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    `You are the ${suf.toUpperCase()} Galaxy! Collect numbers ending in "${suf}"`,
    W / 2,
    by + bh / 2
  );
},

  /* ============================================================
     TOAST
  ============================================================ */
  showToast(text, color) {
    this.toast = {
      text, 
      color,
      timer: 1600, 
      maxTimer: 1600,
      y: this.CENTER_Y - 220 * this.scale,
      alpha: 1
    };
  },

  updateToast(delta) {
    if (this.toast.timer <= 0) return;
    this.toast.timer -= delta;
    this.toast.alpha  = Math.min(1, this.toast.timer / 350);
    this.toast.y     -= 0.022 * delta;
  },

  drawToast(ctx) {
    if (this.toast.timer <= 0 || this.toast.alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = this.toast.alpha;
    ctx.fillStyle    = this.toast.color;
    ctx.font         = `bold ${Math.round(36 * this.scale)}px 'Fredoka', cursive`;
    ctx.textAlign    = "center"; 
    ctx.textBaseline = "middle";
    ctx.shadowColor  = this.toast.color; 
    ctx.shadowBlur = 14;
    ctx.fillText(this.toast.text, this.CENTER_X, this.toast.y);
    ctx.restore();
  },

  /* ============================================================
     THEME HINT
  ============================================================ */



  spawnCorrectParticles(x, y) {
    const cols = ["#34d399","#fbbf24","#a78bfa","#ffffff"];
    for (let i = 0; i < 20; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      const v = (Math.random() * 6 + 3) * 0.055;
      this.particles.push({
        x, 
        y, 
        vx: Math.cos(a)*v, 
        vy: Math.sin(a)*v,
        color: cols[i % cols.length],
        size: (Math.random()*5+3) * this.scale,
        life: 700, 
        maxLife: 700, 
        type: "star"
      });
    }
  },

  spawnWrongParticles(x, y) {
    for (let i = 0; i < 12; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      const v = (Math.random()*4+2) * 0.055;
      this.particles.push({
        x, 
        y, 
        vx: Math.cos(a)*v, 
        vy: Math.sin(a)*v,
        color: "#f87171",
        size: (Math.random()*4+2) * this.scale,
        life: 500, 
        maxLife: 500, 
        type: "circle"
      });
    }
  },

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x  += p.vx * delta;
      p.y  += p.vy * delta;
      /* Use multiply-assign instead of Math.pow each frame for perf */
      const fric = 1 - (1 - 0.994) * delta / 16;  // approx Math.pow(0.994, delta)
      p.vx *= fric; 
      p.vy *= fric;
      p.vy += 0.00007 * delta;
      p.life -= delta;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  },

  drawParticles(ctx) {
    for (let p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle   = p.color;
      if (p.type === "star") this._star(ctx, p.x, p.y, p.size, 5);
      else { ctx.beginPath(); 
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); 
        ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  },

  _star(ctx, x, y, r, pts) {
    ctx.save(); ctx.translate(x, y); 
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const a  = (Math.PI / pts) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.44;
      i === 0 ? ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr)
              : ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    }
    ctx.closePath(); 
    ctx.fill(); 
    ctx.restore();
  },

  spawnSparkBurst(x, y) {
    if (this.sparkBursts.length < this.MAX_SPARKS) {
      this.sparkBursts.push({
        x, 
        y, 
        radius: 0, 
        maxRadius: 130 * this.scale,
        alpha: 1, 
        life: 550, 
        maxLife: 550
      });
    }
    for (let i = 0; i < 16; i++) {
      if (this.sparkBursts.length >= this.MAX_SPARKS) break;
      const a = Math.random() * Math.PI * 2;
      const v = (Math.random()*9+3) * 0.055;
      this.sparkBursts.push({
        x, 
        y, 
        vx: Math.cos(a)*v, 
        vy: Math.sin(a)*v,
        size: (Math.random()*4+2) * this.scale,
        life: 480, 
        maxLife: 480,
        type: "p"
      });
    }
  },

  updateSparkBursts(delta) {
    for (let i = this.sparkBursts.length - 1; i >= 0; i--) {
      const s = this.sparkBursts[i];
      s.life -= delta;
      if (s.type === "p") {
        s.x  += s.vx * delta; s.y += s.vy * delta;
        const fric = 1 - (1 - 0.993) * delta / 16;
        s.vx *= fric; s.vy *= fric;
      } else {
        s.radius = s.maxRadius * (1 - s.life / s.maxLife);
        s.alpha  = Math.max(0, s.life / s.maxLife);
      }
      if (s.life <= 0) this.sparkBursts.splice(i, 1);
    }
  },

  drawSparkBursts(ctx) {
    for (let s of this.sparkBursts) {
      if (s.type === "p") {
        ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
        ctx.fillStyle   = this.T.correct;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); 
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.strokeStyle = this.T.correct; ctx.lineWidth = 5 * this.scale;
        ctx.beginPath(); 
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); 
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     UTILITY
  ============================================================ */
  _rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);   
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r); 
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);   
    ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
    ctx.lineTo(x, y + r);       
    ctx.quadraticCurveTo(x,     y,     x + r, y);
    ctx.closePath();
  },

};