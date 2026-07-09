/* ============================================================
   ordinal-beta.js  (Game9) — v3
   Changes vs v2:
   • Fixed typo: tx.translate → ctx.translate in _drawTutVisual
   • Fonts updated: 'Fredoka' primary, Comic Sans fallback removed
     from gameplay text; proper weight/size hierarchy
   • Mascot follow speed increased — near-zero latency feel
   • Level-up: golden star-burst ring instead of orange screen flash
   • Game-over hearts=0: dreamy portal collapse (pastel vortex +
     sparkle implosion) — different from Game10's black hole
   • Loading screen preserved
============================================================ */

const Game9 = {

  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,
  CENTER_X: 0,
  CENTER_Y: 0,

  get cssWidth()  { return canvasElement.width  / (window.devicePixelRatio || 1); },
  get cssHeight() { return canvasElement.height / (window.devicePixelRatio || 1); },

  DOOR_RADIUS: 90,

  doors: [],
  score: 0,
  currentNumber: 1,
  correctSuffix: "st",

  fingerX: null, fingerY: null,
  _fingerSmoothX: null, _fingerSmoothY: null,
  _targetFingerX: null, _targetFingerY: null,
  /* Increased smoothing factor: 1.0 = instant follow, 0.3 = original */
  FINGER_SMOOTH: 0.55,

  running: false,
  lastTime: 0,
  selectionLocked: false,
  sparkBursts: [],

  hearts: 3, maxHearts: 3, heartShakeTime: 0,

  level: 1,
  correctAnswers: 0,
  correctThisLevel: 0,
  answersPerLevel: 3,
  numberRange: 10,
  /* Level-up burst system replaces flash */
  levelUpBurst: null,      // { time, particles[] }
  levelUpDuration: 1800,

  streak: 0, bestStreak: 0, streakPulse: 0,
  gameOver: false,
  toast: { text:"", timer:0, color:"#fff", y:0, alpha:0 },

  /* Portal-collapse game-over effect */
  collapseActive: false,
  collapseTime:   0,
  collapseDur:    2200,
  collapseAngle:  0,
  collapseSpiral: [],

  gameState: "tutorial",

  mascot: {
    x:0, y:0, vx:0, vy:0,
    /* Faster accel + higher maxSpeed = responsive, still smooth */
    accel: 0.065,
    maxSpeed: 1.1,
    friction: 0.970,
    size: 140,
    carryingNumber: false,
  },

  mascotImages: { idle:[], happy:[], confused:[] },
  mascotFrame: 0, mascotFrameTimer: 0, mascotFrameSpeed: 120,
  mascotState: "idle",

  numberPosition: { x:0, y:0, picked:false },

  portalFrames: [], portalFrameIndex: 0, portalFrameTimer: 0,
  portalFrameSpeed: 80, portalSize: 260,

  ordinalMap: { "st":"st","nd":"nd","rd":"rd","th":"th" },

  floatTime: 0, floatAmplitude: 20, floatSpeed: 0.002,
  numberRotation: 0, rotationSpeed: 0.0015,
  numberScalePulse: 0, pulseSpeed: 0.003,

  starsFar:[], starsMid:[], starsNear:[],
  starCountFar: 80, starCountMid: 50, starCountNear: 30,

  shootingStars: [], shootingStarSpawnTimer: 0,
  shootingStarSpawnInterval: 2000, shootingStarBursts: [],

  /* ── Listener guard ─────────────────────────────────────── */
  _listenersAttached: false,
  _resizeTimer: null,

  /* ── Tutorial state ─────────────────────────────────────── */
  _tutHoldProgress: 0,
  _tutEnterAnim: 0,
  _tutOrbT: 0,
  _tutPulseT: 0,
  _tutStars: [],
  _tutNoFingerFrames: 0,
  _tutNoFingerThreshold: 90,
  HOLD_SEC: 3.0,

  _lastFingerUpdateTime: 0,
  FINGER_UPDATE_INTERVAL: 16, /* Update target every frame effectively */

  loading: true,
  assetsToLoad: 0,
  assetsLoaded: 0,

  /* ============================================================
     INIT
  ============================================================ */
  init() {
    this._applyResize(window.innerWidth, window.innerHeight);

    // ── NEW: Initialize Auto-Pause Tracking ──
    this._noHandDuration = 0;
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.style.opacity = "0";
    }

    this.score            = 0;
    this.hearts           = 3;
    this.level            = 1;
    this.correctAnswers   = 0;
    this.correctThisLevel = 0;
    this.numberRange      = 10;
    this.streak           = 0;
    this.bestStreak       = 0;
    this.streakPulse      = 0;
    this.heartShakeTime   = 0;
    this.levelUpBurst     = null;
    this.gameOver         = false;
    this.selectionLocked  = false;
    this.collapseActive   = false;
    this.collapseTime     = 0;
    this.collapseSpiral   = [];
    this.running          = true;
    this.lastTime         = performance.now();
    this.sparkBursts      = [];
    this._fingerSmoothX   = null;
    this._fingerSmoothY   = null;
    this._targetFingerX   = null;
    this._targetFingerY   = null;

    /* Reset asset counters on each init so re-play works */
    this.loading        = true;
    this.assetsToLoad   = 0;
    this.assetsLoaded   = 0;

    this.loadMascotSprites();
    this.loadPortalSprites();
    this.initStarfield();
    this.setupDoors();
    this.spawnNumber();

    this.mascot.x  = this.CENTER_X;
    this.mascot.y  = this.CENTER_Y + 100 * this.scale;
    this.mascot.vx = 0;
    this.mascot.vy = 0;

    this.gameState        = "tutorial";
    this._tutHoldProgress = 0;
    this._tutEnterAnim    = 0;
    this._tutOrbT         = 0;
    this._tutPulseT       = 0;
    this._tutNoFingerFrames = 0;
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
      canvasElement.addEventListener("click", () => {
        if (this.gameOver && !this.collapseActive) this.retryGame();
      });
    }
  },

  /* ── Resize — layout only ────────────────────────────────── */
  _onResize() {
    this._applyResize(window.innerWidth, window.innerHeight);
    this.initStarfield();
    this.setupDoors();
    if (!this.numberPosition.picked) {
      this.numberPosition.x = this.CENTER_X;
      this.numberPosition.y = this.CENTER_Y - 230 * this.scale;
    }
    if (this.gameState === "tutorial") this._initTutStars();
  },

  _applyResize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvasElement.width  = Math.round(w * dpr);
    canvasElement.height = Math.round(h * dpr);
    canvasElement.style.width  = w + "px";
    canvasElement.style.height = h + "px";
    canvasElement.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale    = Math.min(w / this.BASE_WIDTH, h / this.BASE_HEIGHT) || 1;
    this.CENTER_X = w / 2;
    this.CENTER_Y = h / 2;
  },

  /* ── Tutorial stars ─────────────────────────────────────── */
  _initTutStars() {
    const W = window.innerWidth, H = window.innerHeight;
    this._tutStars = [];
    for (let i = 0; i < 60; i++) {
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

  _startPlaying() {
    this.gameState = "playing";
    this.gameOver  = false;
  },

  /* ============================================================
     TUTORIAL DRAW
  ============================================================ */
  _updateTutorial(ctx, fingers, dt) {
    this._tutEnterAnim = Math.min(1, this._tutEnterAnim + dt * 2);
    this._tutOrbT     += dt;
    this._tutPulseT   += dt * 1.8;
    const eA   = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    const alpha = eA(this._tutEnterAnim);
    const W = this.cssWidth, H = this.cssHeight;
    const cx = this.CENTER_X, cy = this.CENTER_Y;

    /* Dreamy gradient background */
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#60A5FA");
    g.addColorStop(0.5, "#A78BFA");
    g.addColorStop(1, "#F472B6");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
    glow.addColorStop(0, "rgba(255,255,255,0.14)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const s of this._tutStars) {
      s.tw += s.ts;
      ctx.globalAlpha = alpha * Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;

    const tColor = "#a78bfa";
    const isMob  = W < 540;
    const cardW  = Math.min(W - 32, isMob ? 360 : 700);
    const cardH  = Math.min(H - 60, isMob ? 580 : 540);
    const cardX  = cx - cardW / 2;
    const cardY  = cy - cardH / 2;
    const cR     = 20;
    const hr = s => {
      const h = (s || "").replace("#", "");
      const r = parseInt(h.slice(0,2), 16), g2 = parseInt(h.slice(2,4), 16), b = parseInt(h.slice(4,6), 16);
      return isNaN(r) ? "160,120,252" : `${r},${g2},${b}`;
    };

    /* Card */
    ctx.shadowColor = tColor; ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(30,10,55,0.92)";
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, cR); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${hr(tColor)},0.45)`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = `rgba(${hr(tColor)},0.16)`;
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, 56, [cR, cR, 0, 0]); ctx.fill();

    /* Header — Fredoka, no Comic Sans */
    ctx.font = `bold ${isMob ? 22 : 28}px 'Fredoka', sans-serif`;
    ctx.fillStyle = tColor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = tColor; ctx.shadowBlur = 14;
    ctx.fillText("🏠  ORDINAL EXPRESS", cx, cardY + 28);
    ctx.shadowBlur = 0;
    ctx.font = `${isMob ? 13 : 15}px 'Fredoka', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("Carry the number to the right ordinal door!", cx, cardY +65 );

    /* Visual box */
    const visX = cardX + 12, visY = cardY + 76;
    const visW = isMob ? cardW - 24 : cardW * 0.42;
    const visH = isMob ? 140 : cardH - 200;
    ctx.fillStyle = "rgba(20,5,45,0.7)";
    ctx.beginPath(); ctx.roundRect(visX, visY, visW, visH, 12); ctx.fill();
    ctx.strokeStyle = `rgba(${hr(tColor)},0.14)`; ctx.lineWidth = 1; ctx.stroke();
    this._drawTutVisual(ctx, visX, visY, visW, visH, this._tutOrbT);

    /* Rules — Fredoka */
    const rules = [
      { icon:"👆", text:"Your index finger controls the mascot" },
      { icon:"✨", text:"Move mascot onto the glowing number to pick it up" },
      { icon:"🚪", text:"Carry it to the correct ordinal door (st/nd/rd/th)" },
      { icon:"❤️", text:"Wrong door costs a heart — 3 hearts total" },
      { icon:"🔥", text:"Streak correct deliveries for bonus score!" },
    ];
    const rulesX = isMob ? cardX + 12 : cardX + visW + 24;
    const rulesY = isMob ? visY + visH + 10 : cardY + 76;
    const rulesW = isMob ? cardW - 24 : cardW - visW - 36;
    const rowH   = isMob ? 34 : 42;
    for (let i = 0; i < rules.length; i++) {
      const prog = Math.max(0, Math.min(1, (this._tutEnterAnim - i * 0.08) / 0.6));
      ctx.globalAlpha = alpha * (1 - Math.pow(1 - prog, 3));
      ctx.fillStyle = i % 2 === 0 ? "rgba(40,10,80,0.55)" : "rgba(25,5,50,0.4)";
      ctx.beginPath(); ctx.roundRect(rulesX, rulesY + i * rowH, rulesW, rowH - 4, 8); ctx.fill();
      ctx.font = `${isMob ? 16 : 18}px 'Fredoka', sans-serif`;
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(rules[i].icon, rulesX + 10, rulesY + i * rowH + rowH / 2 - 2);
      ctx.font = `${isMob ? 12 : 14}px 'Fredoka', sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(rules[i].text, rulesX + 36, rulesY + i * rowH + rowH / 2 - 2);
    }
    ctx.globalAlpha = alpha;

    /* Hold section */
    const holdY = cardY + cardH - (isMob ? 82 : 86);
    ctx.strokeStyle = "rgba(253,224,71,0.22)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cardX + 20, holdY - 6); ctx.lineTo(cardX + cardW - 20, holdY - 6); ctx.stroke();

    const hasFing = fingers.length > 0;
    if (hasFing) {
      this._tutHoldProgress = Math.min(1, this._tutHoldProgress + dt / this.HOLD_SEC);
      if (this._tutHoldProgress >= 1) { ctx.globalAlpha = 1; this._startPlaying(); return; }
    } else {
      this._tutHoldProgress = Math.max(0, this._tutHoldProgress - dt * 0.5);
    }

    if (!hasFing) {
      const blink = Math.sin(this._tutPulseT * 3) > 0;
      ctx.font = `bold ${isMob ? 14 : 16}px 'Fredoka', sans-serif`;
      ctx.fillStyle = blink ? "#fbbf24" : "rgba(251,191,36,0.55)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = blink ? 12 : 0;
      ctx.fillText("☝ Raise your finger to the camera!", cx, holdY + 18);
      ctx.shadowBlur = 0;
      ctx.font = `${isMob ? 12 : 13}px 'Fredoka', sans-serif`;
      ctx.fillStyle = "rgba(253,224,71,0.65)";
      ctx.fillText("Hold still for 3 seconds to start", cx, holdY + 40);
    } else {
      const pct = Math.round(this._tutHoldProgress * 100);
      ctx.font = `bold ${isMob ? 14 : 16}px 'Fredoka', sans-serif`;
      ctx.fillStyle = "#a78bfa"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 10;
      ctx.fillText(`Hold still... ${pct}%`, cx, holdY + 16);
      ctx.shadowBlur = 0;
      const barW = cardW * 0.6, barH = 8, barX = cx - barW / 2, barY = holdY + 34;
      ctx.fillStyle = "rgba(40,10,80,0.8)";
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();
      ctx.fillStyle = "#a78bfa"; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * this._tutHoldProgress, barH, 4);
      ctx.fill(); ctx.shadowBlur = 0;
    }

    /* Finger dot */
    if (hasFing) {
      const fx = fingers[0].x, fy = fingers[0].y;
      ctx.beginPath(); ctx.arc(fx, fy, 38, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(167,139,250,0.18)"; ctx.lineWidth = 5; ctx.stroke();
      if (this._tutHoldProgress > 0.01) {
        ctx.beginPath();
        ctx.arc(fx, fy, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this._tutHoldProgress);
        ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 5;
        ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
      }
      ctx.beginPath(); ctx.arc(fx, fy, 22, 0, Math.PI * 2);
      ctx.shadowColor = "rgba(167,139,250,0.7)"; ctx.shadowBlur = 28;
      ctx.fillStyle = "rgba(120,90,200,0.45)"; ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy, 10, 0, Math.PI * 2);
      ctx.shadowBlur = 12; ctx.fillStyle = "#c4b5fd"; ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  },

  /* ── Tutorial mini-diagram ───────────────────────────────── */
  _drawTutVisual(ctx, px, py, pw, ph, t) {
    ctx.save();
    ctx.translate(px, py);  /* FIXED: was tx.translate */
    const mx = pw / 2, my = ph / 2;

    const bg = ctx.createRadialGradient(mx, my, 0, mx, my, Math.min(pw, ph) * 0.55);
    bg.addColorStop(0, "rgba(253,224,71,0.14)");
    bg.addColorStop(1, "rgba(30,15,60,0)");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(mx, my, Math.min(pw, ph) * 0.55, 0, Math.PI * 2); ctx.fill();

    /* Floating number */
    const fY = my - 48 + Math.sin(t * 1.4) * 10;
    ctx.font = "bold 50px 'Fredoka', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 8; ctx.strokeStyle = "#FFD700";
    ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 28;
    ctx.strokeText("7", mx, fY); ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF"; ctx.fillText("7", mx, fY);

    for (let i = 0; i < 5; i++) {
      const sa = (Math.PI * 2 / 5) * i + t * 1.2;
      ctx.beginPath();
      ctx.arc(mx + Math.cos(sa) * 36, fY + Math.sin(sa) * 16, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFACD"; ctx.fill();
    }

    /* Mascot blob */
    const mascotY = my + 42, mR = 28;
    const mg = ctx.createRadialGradient(mx - 4, mascotY - 4, 0, mx, mascotY, mR);
    mg.addColorStop(0, "#c084fc"); mg.addColorStop(1, "#7c3aed");
    ctx.beginPath(); ctx.arc(mx, mascotY, mR, 0, Math.PI * 2);
    ctx.fillStyle = mg; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 14;
    ctx.fill(); ctx.shadowBlur = 0;
    [[mx - 9, mascotY - 7], [mx + 9, mascotY - 7]].forEach(([ex, ey]) => {
      ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 1, ey, 2.2, 0, Math.PI * 2); ctx.fillStyle = "#333"; ctx.fill();
    });
    ctx.beginPath(); ctx.arc(mx, mascotY + 2, 8, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();

    /* Pickup dashed line */
    ctx.strokeStyle = "rgba(253,224,71,0.55)"; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(mx, mascotY - mR - 3); ctx.lineTo(mx, fY + 18); ctx.stroke();
    ctx.setLineDash([]);

    /* 4 portal dots */
    const portals = [
      { x: pw * 0.15, y: ph * 0.82, l: "st" },
      { x: pw * 0.37, y: ph * 0.88, l: "nd" },
      { x: pw * 0.63, y: ph * 0.88, l: "rd" },
      { x: pw * 0.85, y: ph * 0.82, l: "th" },
    ];
    for (const p of portals) {
      const pulse = 0.85 + Math.sin(t * 2 + p.x) * 0.15;
      const pc = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18 * pulse);
      pc.addColorStop(0, "rgba(253,224,71,0.7)");
      pc.addColorStop(0.5, "rgba(167,139,250,0.4)");
      pc.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = pc; ctx.beginPath(); ctx.arc(p.x, p.y, 18 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px 'Fredoka', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.l, p.x, p.y);
    }

    /* Finger legend */
    ctx.beginPath(); ctx.arc(mx - 46, my + 42, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(94,180,150,0.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(mx - 46, my + 42, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#b0f0da"; ctx.fill();
    ctx.fillStyle = "rgba(253,224,71,0.75)"; ctx.font = "11px 'Fredoka', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("= controls mascot", mx - 36, my + 42);
    ctx.font = "10px 'Fredoka', sans-serif"; ctx.fillStyle = "rgba(253,224,71,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("carry it → right ordinal door!", mx, ph - 8);
    ctx.restore();
  },

  /* ── No-finger prompt ────────────────────────────────────── */
  _drawNoFingerPrompt(ctx) {
    const fingers = window.fingerPositions || [];
    if (fingers.length > 0) { this._tutNoFingerFrames = 0; return; }
    this._tutNoFingerFrames++;
    if (this._tutNoFingerFrames < this._tutNoFingerThreshold) return;
    const W = this.cssWidth, H = this.cssHeight;
    const copy  = "☝ Raise your finger — the mascot needs you!";
    const blink = Math.sin(performance.now() * 0.003) > 0;
    ctx.font = "bold 15px 'Fredoka', sans-serif";
    const tw = ctx.measureText(copy).width;
    const bw = tw + 56, bh = 46, bx = W / 2 - bw / 2, by = H - 110;
    ctx.globalAlpha = blink ? 0.95 : 0.55;
    ctx.fillStyle = "rgba(30,10,55,0.92)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = blink ? "#fbbf24" : "rgba(251,191,36,0.4)";
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#fbbf24"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(copy, W / 2, by + bh / 2);
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     DOORS
  ============================================================ */
  setupDoors() {
    this.doors = [];
    const suffixes = ["st","nd","rd","th"];
    const startX   = this.cssWidth  * 0.2;
    const gap      = this.cssWidth  * 0.2;
    const y        = this.cssHeight * 0.55;
    for (let i = 0; i < 4; i++) {
      this.doors.push({ x: startX + i * gap, y, suffix: suffixes[i], label: suffixes[i] });
    }
  },

  get doorRadius() { return this.DOOR_RADIUS * this.scale; },

  /* ============================================================
     NUMBER SPAWN
  ============================================================ */
  spawnNumber() {
    const num             = Math.floor(Math.random() * this.numberRange) + 1;
    this.currentNumber    = num;
    this.correctSuffix    = this.getSuffix(num);
    this.numberPosition.x = this.CENTER_X;
    this.numberPosition.y = this.CENTER_Y - 230 * this.scale;
    this.numberPosition.picked = false;
    this.mascot.carryingNumber = false;
    this.selectionLocked  = false;
    this.gameState_inner  = "pickup";
  },

  getSuffix(num) {
    const t = num % 100;
    if (t >= 11 && t <= 13) return "th";
    const l = num % 10;
    if (l === 1) return "st";
    if (l === 2) return "nd";
    if (l === 3) return "rd";
    return "th";
  },

  /* ============================================================
     LEVEL UP — star-burst ring instead of orange flash
  ============================================================ */
  checkLevelUp() {
    this.correctThisLevel++;
    this.correctAnswers++;
    if (this.correctThisLevel >= this.answersPerLevel) {
      this.correctThisLevel = 0;
      this.level++;
      const ranges = [10, 20, 30, 50, 100];
      this.numberRange = ranges[Math.min(this.level - 1, ranges.length - 1)];
      this._triggerLevelUpBurst();
      this.showToast(`🎉 Level ${this.level}! Numbers up to ${this.numberRange}!`, "#a78bfa");
    }
  },

  _triggerLevelUpBurst() {
    const cols = ["#fbbf24","#a78bfa","#f472b6","#60a5fa","#34d399","#ffffff"];
    const particles = [];
    for (let i = 0; i < 36; i++) {
      const a = (Math.PI * 2 / 36) * i;
      const v = 140 + Math.random() * 160;
      particles.push({
        x: this.CENTER_X, y: this.CENTER_Y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: 4 + Math.random() * 5,
        color: cols[i % cols.length],
        life: 1,
        spin: Math.random() * 6 - 3,
        isStar: Math.random() < 0.5,
      });
    }
    /* Extra inner ring of smaller stars */
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 / 18) * i + Math.PI / 18;
      const v = 60 + Math.random() * 60;
      particles.push({
        x: this.CENTER_X, y: this.CENTER_Y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: 2 + Math.random() * 3,
        color: "#ffffff",
        life: 1, spin: 0, isStar: false,
      });
    }
    this.levelUpBurst = { time: 0, duration: this.levelUpDuration, particles };
  },

  _updateLevelUpBurst(delta) {
    if (!this.levelUpBurst) return;
    this.levelUpBurst.time += delta;
    const dt_s = delta / 1000;
    for (const p of this.levelUpBurst.particles) {
      p.x  += p.vx * dt_s;
      p.y  += p.vy * dt_s;
      p.vx *= Math.pow(0.96, delta / 16);
      p.vy *= Math.pow(0.96, delta / 16);
      p.vy += 80 * dt_s;           /* gentle gravity */
      p.life -= dt_s * 0.9;
    }
    this.levelUpBurst.particles = this.levelUpBurst.particles.filter(p => p.life > 0);
    if (this.levelUpBurst.time >= this.levelUpBurst.duration) this.levelUpBurst = null;
  },

  _drawLevelUpBurst(ctx) {
    if (!this.levelUpBurst) return;
    const prog = this.levelUpBurst.time / this.levelUpBurst.duration;

    /* Radial ring wave */
    const ringR = prog * 280 * this.scale;
    const ringA = Math.max(0, (1 - prog * 1.8));
    if (ringA > 0) {
      ctx.beginPath();
      ctx.arc(this.CENTER_X, this.CENTER_Y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(251,191,36,${ringA * 0.6})`;
      ctx.lineWidth   = 6 * (1 - prog);
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 20 * ringA;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    /* Particles */
    for (const p of this.levelUpBurst.particles) {
      ctx.globalAlpha = Math.max(0, p.life) * 0.95;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      if (p.isStar) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * this.levelUpBurst.time * 0.001);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a  = (Math.PI / 5) * i - Math.PI / 2;
          const rr = i % 2 === 0 ? p.r : p.r * 0.4;
          i === 0 ? ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr)
                  : ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    /* "LEVEL UP!" text */
    if (prog > 0.05 && prog < 0.75) {
      const alpha = Math.sin((prog / 0.75) * Math.PI);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.CENTER_X, this.CENTER_Y - 120 * this.scale);
      ctx.scale(0.85 + alpha * 0.2, 0.85 + alpha * 0.2);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(52 * this.scale)}px 'Fredoka', sans-serif`;
      ctx.fillStyle   = "#fbbf24";
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 30;
      ctx.fillText("LEVEL " + this.level + "!", 0, 0);
      ctx.font = `bold ${Math.round(26 * this.scale)}px 'Fredoka', sans-serif`;
      ctx.fillStyle   = "#c4b5fd";
      ctx.shadowColor = "#c4b5fd"; ctx.shadowBlur = 16;
      ctx.fillText("Numbers up to " + this.numberRange, 0, 52 * this.scale);
      ctx.restore();
    }
  },

  /* ============================================================
     PORTAL COLLAPSE (game over — hearts = 0)
     Dreamy vortex: pastel spiral rings shrink to center,
     sparkles implode, portal glyph shatters — distinct from
     Game10's physics black hole.
  ============================================================ */
  _startCollapse() {
    this.collapseActive = true;
    this.collapseTime   = 0;
    this.collapseAngle  = 0;
    this.collapseSpiral = [];
    const cols = ["#a78bfa","#f472b6","#60a5fa","#fbbf24","#c4b5fd","#ffffff"];
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * Math.min(this.cssWidth, this.cssHeight) * 0.35;
      this.collapseSpiral.push({
        x: this.CENTER_X + Math.cos(a) * r,
        y: this.CENTER_Y + Math.sin(a) * r,
        color: cols[i % cols.length],
        size: 3 + Math.random() * 7,
        angle: a,
        radius: r,
        speed: 0.6 + Math.random() * 1.2,
        life: 1,
      });
    }
  },

  _updateCollapse(delta) {
    if (!this.collapseActive) return;
    this.collapseTime  += delta;
    this.collapseAngle += delta * 0.003;
    const prog = Math.min(this.collapseTime / this.collapseDur, 1);

    for (const p of this.collapseSpiral) {
      /* Spiral inward: reduce radius, rotate */
      p.angle  += p.speed * delta * 0.004;
      p.radius *= Math.pow(0.992, delta / 16);
      p.x = this.CENTER_X + Math.cos(p.angle) * p.radius;
      p.y = this.CENTER_Y + Math.sin(p.angle) * p.radius;
      p.life = Math.max(0, 1 - prog * 1.3);
    }

    if (prog >= 1) {
      this.collapseActive = false;
      this.gameOver = true;
    }
  },

  _drawCollapse(ctx) {
    if (!this.collapseActive) return;
    const prog = Math.min(this.collapseTime / this.collapseDur, 1);
    const cx   = this.CENTER_X, cy = this.CENTER_Y;

    /* Darkening overlay */
    ctx.fillStyle = `rgba(10,0,25,${prog * 0.72})`;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    /* Pulsing vortex rings */
    for (let r = 3; r >= 1; r--) {
      const ringProg = ((prog * 3 + r * 0.3) % 1);
      const ringR    = ringProg * 260 * this.scale * (1 - prog * 0.6);
      const alpha    = (1 - ringProg) * 0.55 * (1 - prog * 0.5);
      const hue      = r === 3 ? "167,139,250" : r === 2 ? "244,114,182" : "96,165,250";
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${hue},${alpha})`;
      ctx.lineWidth   = (4 - r * 0.5) * this.scale;
      ctx.shadowColor = `rgba(${hue},0.6)`; ctx.shadowBlur = 18;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    /* Portal glyph shattering */
    const portalR = 50 * this.scale * (1 - prog);
    if (portalR > 4) {
      /* Rotating glowing ring shrinking to nothing */
      for (let i = 0; i < 8; i++) {
        const a  = this.collapseAngle + (Math.PI * 2 / 8) * i;
        const px = cx + Math.cos(a) * portalR;
        const py = cy + Math.sin(a) * portalR;
        ctx.beginPath(); ctx.arc(px, py, 5 * this.scale * (1 - prog), 0, Math.PI * 2);
        ctx.fillStyle = "#c4b5fd"; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 14;
        ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.beginPath(); ctx.arc(cx, cy, portalR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(167,139,250,${0.7 * (1 - prog)})`;
      ctx.lineWidth   = 3 * this.scale; ctx.stroke();
    }

    /* Imploding sparkles */
    for (const p of this.collapseSpiral) {
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - prog * 0.5), 0, Math.PI * 2);
      ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    /* Center flash at peak */
    const flash = Math.max(0, 1 - Math.abs(prog - 0.85) * 10);
    if (flash > 0) {
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120 * this.scale);
      gr.addColorStop(0, `rgba(255,255,255,${flash * 0.9})`);
      gr.addColorStop(0.4, `rgba(196,181,253,${flash * 0.5})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(cx, cy, 120 * this.scale, 0, Math.PI * 2); ctx.fill();
    }

    /* "Portal shattered!" text */
    if (prog > 0.4 && prog < 0.95) {
      const alpha = Math.sin(((prog - 0.4) / 0.55) * Math.PI);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round(42 * this.scale)}px 'Fredoka', sans-serif`;
      ctx.fillStyle = "#f472b6"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#f472b6"; ctx.shadowBlur = 22;
      ctx.fillText("💔 Portal Shattered!", cx, cy - 60 * this.scale);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  },

  _rollScore() {
    const pool = [10,10,10,10,10,20,20,20,20,30,30,30,40,40,50,50,60,70,80,90,100];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  /* ── Toast ───────────────────────────────────────────────── */
  showToast(text, color) {
    this.toast = { text, color: color || "#fff", timer: 1600, y: this.CENTER_Y - 200 * this.scale, alpha: 1 };
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
    ctx.fillStyle = this.toast.color;
    ctx.font = `bold ${Math.round(34 * this.scale)}px 'Fredoka', sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = this.toast.color; ctx.shadowBlur = 14;
    ctx.fillText(this.toast.text, this.CENTER_X, this.toast.y);
    ctx.restore();
  },

  /* ============================================================
     MAIN UPDATE
  ============================================================ */
  update(ctx, _fp, dtArg) {
    if (!this.running) return;
    const delta = (dtArg > 0 && dtArg < 1) ? dtArg * 1000 : (dtArg > 0) ? Math.min(dtArg, 50) : 16;

    if (this.loading) { this.drawLoadingScreen(ctx); return; }

    if (this.gameState === "tutorial") {
      const fingers = window.fingerPositions || [];
      this._updateTutorial(ctx, fingers, delta / 1000);
      return;
    }

    // ── Live Playing State (Hand Detection Logic) ──
    if (this._noHandDuration === undefined) this._noHandDuration = 0;
    const pauseBtn = document.getElementById("pauseBtn");
    const fingers = window.fingerPositions || [];
    const dtSeconds = delta / 1000;

    if (fingers.length > 0) {
      this._noHandDuration = 0;
      if (pauseBtn) {
        pauseBtn.style.display = "none";
        pauseBtn.style.opacity = "0";
      }
    } else {
      this._noHandDuration += dtSeconds;

      // 7 Seconds: Show pause button
      if (this._noHandDuration >= 7 && this._noHandDuration < 15) {
        if (pauseBtn) {
          pauseBtn.style.display = "block";
          pauseBtn.style.opacity = "1";
        }
      }

      // 15 Seconds: Trigger Auto-Pause overlay window
      if (this._noHandDuration >= 15) {
        this._noHandDuration = 0;
        if (pauseBtn) {
          pauseBtn.style.display = "none";
          pauseBtn.style.opacity = "0";
        }
        window.pauseGame();
        return;
      }
    }

    /* Playing background always drawn first */
    this.drawDreamBackground(ctx);
    this.updateStarLayer(this.starsFar,  delta);
    this.updateStarLayer(this.starsMid,  delta);
    this.updateStarLayer(this.starsNear, delta);
    this.drawStarLayer(ctx, this.starsFar);
    this.drawStarLayer(ctx, this.starsMid);
    this.drawStarLayer(ctx, this.starsNear);
    this.updateShootingStars(delta); this.drawShootingStars(ctx);
    this.updateStarBursts(delta);    this.drawStarBursts(ctx);

    /* Level-up burst always updated/drawn (even during collapse) */
    this._updateLevelUpBurst(delta);

    /* Collapse animation */
    if (this.collapseActive) {
      this.drawDoors(ctx);
      this.drawNumber(ctx);
      this.drawMascot(ctx);
      this._updateCollapse(delta);
      this._drawCollapse(ctx);
      this._drawLevelUpBurst(ctx);
      this.drawHUD(ctx);
      return;
    }

    if (this.gameOver) { this.drawGameOver(ctx); return; }

    this.updateFingerPosition(performance.now());
    this.updateMascot(delta);
    this.checkPickup();
    this.checkDoorAlignment();
    this.updateFloatingNumber(delta);
    this.updatePortalAnimation(delta);
    this.updateSparkBursts(delta);
    this.updateToast(delta);
    this.updateHUDTimers(delta);

    this.drawDoors(ctx);
    this.drawNumber(ctx);
    this.drawMascot(ctx);
    this._drawLevelUpBurst(ctx);
    this.drawHUD(ctx);
    this.drawSparkBursts(ctx);
    this.drawToast(ctx);
    this._drawNoFingerPrompt(ctx);
  },
  /* ── HUD timers ──────────────────────────────────────────── */
  updateHUDTimers(delta) {
    if (this.heartShakeTime > 0) this.heartShakeTime = Math.max(0, this.heartShakeTime - delta);
    if (this.streakPulse    > 0) this.streakPulse    = Math.max(0, this.streakPulse    - delta * 0.003);
  },

  /* ── Finger — fast follow ────────────────────────────────── */
  updateFingerPosition(now) {
    if (!window.fingerPositions || window.fingerPositions.length === 0) {
      this.fingerX = null; this.fingerY = null; return;
    }
    const fp = window.fingerPositions[0];
    if (this._fingerSmoothX === null) {
      this._fingerSmoothX = fp.x; this._fingerSmoothY = fp.y;
      this._targetFingerX = fp.x; this._targetFingerY = fp.y;
    }
    /* Update target every frame */
    this._targetFingerX = fp.x;
    this._targetFingerY = fp.y;
    /* Smooth at FINGER_SMOOTH (0.55 = fast but not jittery) */
    this._fingerSmoothX += (this._targetFingerX - this._fingerSmoothX) * this.FINGER_SMOOTH;
    this._fingerSmoothY += (this._targetFingerY - this._fingerSmoothY) * this.FINGER_SMOOTH;
    this.fingerX = this._fingerSmoothX;
    this.fingerY = this._fingerSmoothY;
  },

  /* ── Mascot — faster physics ─────────────────────────────── */
  updateMascot(delta) {
    if (this.fingerX === null || this.fingerY === null) return;
    const dx = this.fingerX - this.mascot.x;
    const dy = this.fingerY - this.mascot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 4) {
      const force = Math.min(dist * this.mascot.accel * delta, this.mascot.maxSpeed);
      this.mascot.vx += (dx / dist) * force;
      this.mascot.vy += (dy / dist) * force;
    }
    const fr = Math.pow(this.mascot.friction, delta);
    this.mascot.vx *= fr; this.mascot.vy *= fr;
    const spd = Math.sqrt(this.mascot.vx ** 2 + this.mascot.vy ** 2);
    if (spd > this.mascot.maxSpeed) {
      const r = this.mascot.maxSpeed / spd;
      this.mascot.vx *= r; this.mascot.vy *= r;
    }
    this.mascot.x += this.mascot.vx * delta;
    this.mascot.y += this.mascot.vy * delta;
    const pad = 80;
    this.mascot.x = Math.max(pad, Math.min(this.cssWidth  - pad, this.mascot.x));
    this.mascot.y = Math.max(pad, Math.min(this.cssHeight - pad, this.mascot.y));
  },

  /* ── Pickup & door ───────────────────────────────────────── */
  checkPickup() {
    if (this.numberPosition.picked) return;
    const dx = this.mascot.x - this.numberPosition.x;
    const dy = this.mascot.y - this.numberPosition.y;
    if (Math.sqrt(dx * dx + dy * dy) < 80 * this.scale) {
      this.numberPosition.picked    = true;
      this.mascot.carryingNumber    = true;
      this.gameState_inner          = "deliver";
    }
  },

  checkDoorAlignment() {
    if (!this.mascot.carryingNumber || this.selectionLocked) return;
    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      const dx   = this.mascot.x - door.x;
      const dy   = this.mascot.y - door.y;
      if (Math.sqrt(dx * dx + dy * dy) <= this.doorRadius) {
        this.selectionLocked = true;
        this.confirmSelection(i);
        break;
      }
    }
  },

  confirmSelection(index) {
    const door = this.doors[index];
    if (door.suffix === this.correctSuffix) {
      const points = this._rollScore();
      this.score  += points;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      this.streakPulse = 1;
      this.mascotState = "happy";
      this.spawnSparkBurst(door.x, door.y);
      this.checkLevelUp();
      const msg = this.streak >= 5 ? "🔥 ON FIRE!"
                : this.streak >= 3 ? "⭐ Great streak!"
                : "✅ Correct!";
      this.showToast(`${msg} +${points}`, "#34d399");
    } else {
      this.score       = Math.max(0, this.score - 10);
      this.streak      = 0;
      this.hearts      = Math.max(0, this.hearts - 1);
      this.heartShakeTime = 520;
      this.mascotState    = "confused";
      this.showToast(`💡 ${this.currentNumber} is ${this.currentNumber}${this.getSuffix(this.currentNumber)}!`, "#f87171");
      if (this.hearts <= 0) {
        setTimeout(() => this._startCollapse(), 600);
        return;
      }
    }
    setTimeout(() => { this.mascotState = "idle"; this.spawnNumber(); }, 1200);
  },

  /* ── HUD — Fredoka throughout ────────────────────────────── */
  drawHUD(ctx) {
    const s = this.scale, W = this.cssWidth;

    /* Score badge */
    const sw=175*s, sh=54*s, sx=18*s, sy=16*s;
    ctx.fillStyle = "rgba(30,58,138,0.85)";
    this._rrect(ctx, sx, sy, sw, sh, 18*s); ctx.fill();
    ctx.fillStyle = "#FFD700";
    ctx.font = `bold ${Math.round(26*s)}px 'Fredoka', sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`⭐ ${this.score}`, sx + sw/2, sy + sh/2);

    /* Level badge */
    const lw=150*s, lh=42*s, lx=W/2-lw/2, ly=16*s;
    ctx.fillStyle = "rgba(30,58,138,0.85)";
    this._rrect(ctx, lx, ly, lw, lh, 14*s); ctx.fill();
    ctx.fillStyle = "#a78bfa";
    ctx.font = `bold ${Math.round(20*s)}px 'Fredoka', sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`Level ${this.level}`, lx + lw/2, ly + lh/2);

    /* Hearts */
    const hSz=32*s, hGap=8*s, totalHW=this.maxHearts*(hSz+hGap)-hGap;
    const hx0=W-18*s-totalHW, hy0=18*s;
    const shk = this.heartShakeTime > 0 ? Math.sin(this.heartShakeTime * 0.055) * 5 * s : 0;
    for (let i = 0; i < this.maxHearts; i++) {
      ctx.globalAlpha = i < this.hearts ? 1 : 0.22;
      ctx.font = `${Math.round(hSz)}px serif`;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("❤️", hx0 + i*(hSz+hGap), hy0 + (i < this.hearts ? shk : 0));
    }
    ctx.globalAlpha = 1;

    /* Streak */
    if (this.streak >= 2) {
      const ps = 1 + this.streakPulse * 0.28;
      ctx.save(); ctx.translate(W/2, 88*s); ctx.scale(ps, ps);
      ctx.globalAlpha = 0.9 + this.streakPulse * 0.1;
      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${Math.round(22*s)}px 'Fredoka', sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 10;
      ctx.fillText(`🔥 ${this.streak} in a row!`, 0, 0);
      ctx.shadowBlur = 0; ctx.restore();
    }

    /* Progress bar */
    const barW=260*s, barH=16*s, bottomPad=40*s;
    const bx=W/2-barW/2, by=this.cssHeight-bottomPad-barH;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    this._rrect(ctx, bx, by, barW, barH, 8*s); ctx.fill();
    const prog = Math.min(this.correctThisLevel / this.answersPerLevel, 1);
    if (prog > 0) {
      ctx.fillStyle = "#a78bfa";
      this._rrect(ctx, bx, by, barW * prog, barH, 8*s); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${Math.round(13*s)}px 'Fredoka', sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(`${this.correctThisLevel}/${this.answersPerLevel} to next level`, W/2, by - 6*s);
  },

  /* ── Game over screen ────────────────────────────────────── */
  drawGameOver(ctx) {
    const W=this.cssWidth, H=this.cssHeight, s=this.scale;
    ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(0, 0, W, H);
    const cw=Math.min(Math.max(W*0.58,320*s),640*s), ch=340*s;
    const cx=W/2-cw/2, cy=H/2-ch/2;
    ctx.fillStyle = "rgba(10,14,39,0.97)";
    this._rrect(ctx, cx, cy, cw, ch, 28*s); ctx.fill();
    ctx.strokeStyle = "#f87171"; ctx.lineWidth = 3*s;
    this._rrect(ctx, cx, cy, cw, ch, 28*s); ctx.stroke();
    const mx = W/2;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#f87171";
    ctx.font = `bold ${Math.round(Math.min(48*s,52))}px 'Fredoka', sans-serif`;
    ctx.shadowColor = "#f87171"; ctx.shadowBlur = 14;
    ctx.fillText("💔 Portal Shattered!", mx, cy + ch*0.20); ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFD700";
    ctx.font = `bold ${Math.round(Math.min(30*s,32))}px 'Fredoka', sans-serif`;
    ctx.fillText(`⭐ Score: ${this.score}`, mx, cy + ch*0.40);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.round(Math.min(22*s,24))}px 'Fredoka', sans-serif`;
    ctx.fillText(`🔥 Best Streak: ${this.bestStreak}   ·   🎮 Level: ${this.level}`, mx, cy + ch*0.57);
    ctx.fillStyle = "#a78bfa";
    ctx.font = `bold ${Math.round(Math.min(19*s,21))}px 'Fredoka', sans-serif`;
    ctx.fillText(`✅ Correct answers: ${this.correctAnswers}`, mx, cy + ch*0.71);
    const pulse = 0.78 + Math.sin(performance.now() * 0.004) * 0.22;
    ctx.globalAlpha = pulse; ctx.fillStyle = "#34d399";
    ctx.font = `bold ${Math.round(Math.min(22*s,24))}px 'Fredoka', sans-serif`;
    ctx.fillText("👆 Tap anywhere to play again!", mx, cy + ch*0.87);
    ctx.globalAlpha = 1;
  },

  retryGame() {
    this._noHandDuration = 0;
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.style.opacity = "0";
    }

    this.score=0; this.hearts=3; this.level=1; this.correctAnswers=0;
    this.correctThisLevel=0; this.numberRange=10; this.streak=0; this.bestStreak=0;
    this.streakPulse=0; this.heartShakeTime=0; this.levelUpBurst=null;
    this.gameOver=false; this.selectionLocked=false;
    this.collapseActive=false; this.collapseTime=0; this.collapseSpiral=[];
    this.sparkBursts=[]; this.shootingStars=[]; this.shootingStarBursts=[];
    this.mascotState="idle"; this.mascot.carryingNumber=false;
    this.mascot.x=this.CENTER_X; this.mascot.y=this.CENTER_Y+100*this.scale;
    this.mascot.vx=0; this.mascot.vy=0;
    this._fingerSmoothX=null; this._fingerSmoothY=null;
    this._targetFingerX=null; this._targetFingerY=null;
    this.fingerX=null; this.fingerY=null;
    this.toast={text:"",timer:0,color:"#fff",y:0,alpha:0};
    this.setupDoors(); this.spawnNumber();
  },

  /* ── Draw number ─────────────────────────────────────────── */
  drawNumber(ctx) {
    if (this.numberPosition.picked) return;
    const baseX=this.numberPosition.x, baseY=this.numberPosition.y;
    const floatOff=Math.sin(this.floatTime*this.floatSpeed)*this.floatAmplitude*this.scale;
    const pulse=1+Math.sin(this.numberScalePulse)*0.15;
    ctx.save(); ctx.translate(baseX, baseY+floatOff); ctx.scale(pulse, pulse);
    ctx.shadowColor="#FFD700"; ctx.shadowBlur=40; ctx.lineWidth=8; ctx.strokeStyle="#FFD700";
    ctx.font=`bold ${90*this.scale}px 'Fredoka', sans-serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.strokeText(this.currentNumber, 0, 0);
    ctx.fillStyle="#FFFFFF"; ctx.fillText(this.currentNumber, 0, 0);
    ctx.restore();
    this.drawFloatingSparkles(ctx, baseX, baseY+floatOff);
  },

  /* ── Draw doors ──────────────────────────────────────────── */
  drawDoors(ctx) {
    const size=this.portalSize*this.scale;
    for (let i=0; i<this.doors.length; i++) {
      const door=this.doors[i], pulse=1+Math.sin(performance.now()*0.003+i)*0.05;
      const gradient=ctx.createRadialGradient(door.x,door.y,size*0.2,door.x,door.y,size*0.6);
      gradient.addColorStop(0,"#FFFFFF"); gradient.addColorStop(0.3,"#FDE047");
      gradient.addColorStop(0.6,"#A78BFA"); gradient.addColorStop(1,"rgba(255,255,255,0)");
      ctx.save(); ctx.globalAlpha=0.8; ctx.fillStyle=gradient;
      ctx.beginPath(); ctx.arc(door.x,door.y,size*0.6*pulse,0,Math.PI*2); ctx.fill(); ctx.restore();
      const portalImg=this.portalFrames[this.portalFrameIndex];
      if (portalImg&&portalImg.complete&&portalImg.naturalWidth>0)
        ctx.drawImage(portalImg,door.x-size/2,door.y-size/2,size,size);
      ctx.fillStyle="#FFFFFF";
      ctx.font=`bold ${42*this.scale}px 'Fredoka', sans-serif`;
      ctx.textAlign="center";
      ctx.fillText(this.ordinalMap[door.suffix], door.x, door.y-size/2-20*this.scale);
    }
  },

  /* ── Draw mascot ─────────────────────────────────────────── */
  drawMascot(ctx) {
    const spriteArray=this.mascotImages[this.mascotState];
    if (!spriteArray||spriteArray.length===0) return;
    this.mascotFrameTimer+=16;
    if (this.mascotFrameTimer>this.mascotFrameSpeed) {
      this.mascotFrame=(this.mascotFrame+1)%spriteArray.length; this.mascotFrameTimer=0;
    }
    const img=spriteArray[this.mascotFrame];
    const time=performance.now();
    const breathe=1+Math.sin(time*0.002)*0.03, floatOff=Math.sin(time*0.004)*8*this.scale;
    const mascotX=this.mascot.x, mascotY=this.mascot.y+floatOff;
    const spd=Math.sqrt(this.mascot.vx**2+this.mascot.vy**2)*16;
    const stretchX=spd>2?1+Math.min(spd*0.02,0.15):1;
    const stretchY=spd>2?1-Math.min(spd*0.015,0.1):1;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(mascotX,mascotY+70*this.scale,65*this.scale,22*this.scale,0,0,Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.fill();
    if (this.mascotState==="happy") {
      const gp=30+Math.sin(time*0.01)*10;
      ctx.shadowColor="#FFF59D"; ctx.shadowBlur=gp;
      ctx.beginPath(); ctx.arc(mascotX,mascotY,90*this.scale,0,Math.PI*2);
      ctx.strokeStyle="rgba(255,255,150,0.5)"; ctx.lineWidth=6*this.scale; ctx.stroke();
    }
    ctx.translate(mascotX,mascotY); ctx.scale(stretchX*breathe, stretchY*breathe);
    if (img&&img.complete&&img.naturalWidth>0)
      ctx.drawImage(img,-(this.mascot.size*this.scale)/2,-(this.mascot.size*this.scale)/2,this.mascot.size*this.scale,this.mascot.size*this.scale);
    ctx.shadowBlur=0;
    if (this.mascot.carryingNumber) {
      const bY=-80*this.scale;
      ctx.shadowColor="#FFD700"; ctx.shadowBlur=30; ctx.lineWidth=7;
      ctx.strokeStyle="#FFD700"; ctx.fillStyle="#FFFFFF";
      ctx.font=`bold ${44*this.scale}px 'Fredoka', sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.strokeText(this.currentNumber,0,bY); ctx.fillText(this.currentNumber,0,bY);
      ctx.shadowBlur=0;
    }
    ctx.restore();
  },

  /* ── Spark bursts ────────────────────────────────────────── */
  spawnSparkBurst(x,y) {
    if (this.sparkBursts.length>80) return;
    this.sparkBursts.push({x,y,radius:0,maxRadius:140*this.scale,alpha:1,life:600});
    for (let i=0;i<20;i++) this.sparkBursts.push({x,y,vx:(Math.random()-0.5)*0.35,vy:(Math.random()-0.5)*0.35,size:(Math.random()*4+2)*this.scale,life:500,type:"particle"});
  },
  updateSparkBursts(delta) {
    for (let i=this.sparkBursts.length-1;i>=0;i--) {
      const s=this.sparkBursts[i]; s.life-=delta;
      if (s.type==="particle") {
        s.x+=s.vx*delta; s.y+=s.vy*delta;
        s.vx*=Math.pow(0.994,delta); s.vy*=Math.pow(0.994,delta);
      } else {
        const p=1-(s.life/600); s.radius=s.maxRadius*p; s.alpha=1-p;
      }
      if (s.life<=0) this.sparkBursts.splice(i,1);
    }
  },
  drawSparkBursts(ctx) {
    for (const s of this.sparkBursts) {
      if (s.type==="particle") {
        ctx.globalAlpha=Math.max(0,s.life/500); ctx.fillStyle="#c4b5fd";
        ctx.beginPath(); ctx.arc(s.x,s.y,s.size,0,Math.PI*2); ctx.fill();
      } else {
        ctx.globalAlpha=Math.max(0,s.alpha); ctx.strokeStyle="#a78bfa";
        ctx.lineWidth=6*this.scale; ctx.beginPath(); ctx.arc(s.x,s.y,s.radius,0,Math.PI*2); ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
  },

  /* ── Sprites with loading tracking ──────────────────────── */
  loadMascotSprites() {
    this.mascotImages = { idle:[], happy:[], confused:[] };
    const load = (src, arr) => {
      this.assetsToLoad++;
      const img = new Image(); img.src = src;
      img.onload = () => { this.assetsLoaded++; this._checkAssetsLoaded(); };
      img.onerror = () => { this.assetsLoaded++; this._checkAssetsLoaded(); };
      arr.push(img);
    };
    for (let i=0;i<=4;i++) load(`MID-I/0${i}_MID-I.png`, this.mascotImages.idle);
    for (let i=0;i<=3;i++) load(`MID-H/0${i}_MID-H.png`, this.mascotImages.happy);
    for (let i=0;i<=2;i++) load(`MID-C/0${i}_MID-C.png`, this.mascotImages.confused);
  },
  loadPortalSprites() {
    this.portalFrames = [];
    const load = src => {
      this.assetsToLoad++;
      const img = new Image(); img.src = src;
      img.onload = () => { this.assetsLoaded++; this._checkAssetsLoaded(); };
      img.onerror = () => { this.assetsLoaded++; this._checkAssetsLoaded(); };
      this.portalFrames.push(img);
    };
    for (let i=0;i<=8;i++) load(`D-1/0${i}_D-1.png`);
  },
  _checkAssetsLoaded() {
    if (this.assetsLoaded >= this.assetsToLoad) this.loading = false;
  },

  updatePortalAnimation(delta) {
    this.portalFrameTimer+=delta;
    if (this.portalFrameTimer>this.portalFrameSpeed) {
      this.portalFrameIndex=(this.portalFrameIndex+1)%Math.max(1,this.portalFrames.length);
      this.portalFrameTimer=0;
    }
  },

  /* ── Floating number ─────────────────────────────────────── */
  updateFloatingNumber(delta) {
    if (this.numberPosition.picked) return;
    this.floatTime+=delta; this.numberRotation+=delta*this.rotationSpeed; this.numberScalePulse+=delta*this.pulseSpeed;
  },

  /* ── Starfield ───────────────────────────────────────────── */
  initStarfield() {
    if (!this.cssWidth||this.cssWidth<=0) return;
    this.starsFar=[]; this.starsMid=[]; this.starsNear=[];
    for (let i=0;i<this.starCountFar;i++)  this.starsFar.push(this.createStar(0.2));
    for (let i=0;i<this.starCountMid;i++)  this.starsMid.push(this.createStar(0.5));
    for (let i=0;i<this.starCountNear;i++) this.starsNear.push(this.createStar(1.0));
  },
  createStar(sf) { return {x:Math.random()*this.cssWidth,y:Math.random()*this.cssHeight,size:Math.random()*3+1,speed:sf}; },
  updateStarLayer(layer,delta) {
    if(!layer||!layer.length)return;
    for(const s of layer){s.y+=s.speed*delta*0.02;if(s.y>this.cssHeight){s.y=0;s.x=Math.random()*this.cssWidth;}}
  },
  drawStarLayer(ctx,layer) {
    if(!layer||!layer.length)return;
    ctx.beginPath();
    for(const s of layer){ctx.moveTo(s.x+s.size*this.scale,s.y);ctx.arc(s.x,s.y,s.size*this.scale,0,Math.PI*2);}
    ctx.fillStyle="white"; ctx.fill();
  },

  /* ── Shooting stars ──────────────────────────────────────── */
  createShootingStar() {
    if (this.shootingStars.length>=4) return;
    const fl=Math.random()<0.5, spd=Math.random()*6+4;
    this.shootingStars.push({x:fl?-50:this.cssWidth+50,y:Math.random()*this.cssHeight*0.5,length:Math.random()*120+80,speedX:fl?spd:-spd,speedY:Math.random()*2+1,life:0,maxLife:1000,opacity:1});
  },
  updateShootingStars(delta) {
    this.shootingStarSpawnTimer+=delta;
    if (this.shootingStarSpawnTimer>this.shootingStarSpawnInterval) {
      this.createShootingStar(); this.shootingStarSpawnTimer=0;
      this.shootingStarSpawnInterval=1500+Math.random()*3000;
    }
    for (let i=this.shootingStars.length-1;i>=0;i--) {
      const s=this.shootingStars[i]; s.x+=s.speedX; s.y+=s.speedY;
      s.life+=delta; s.opacity=1-(s.life/s.maxLife);
      if (s.life>s.maxLife) { this.createStarBurst(s.x,s.y); this.shootingStars.splice(i,1); }
    }
  },
  drawShootingStars(ctx) {
    for (const s of this.shootingStars) {
      const grd=ctx.createLinearGradient(s.x,s.y,s.x-s.speedX*10,s.y-s.speedY*10);
      grd.addColorStop(0,`rgba(255,255,255,${s.opacity})`); grd.addColorStop(1,"rgba(255,255,255,0)");
      ctx.strokeStyle=grd; ctx.lineWidth=3*this.scale; ctx.beginPath();
      ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.speedX*s.length*0.05,s.y-s.speedY*s.length*0.05); ctx.stroke();
    }
  },
  createStarBurst(x,y) {
    for(let i=0;i<15;i++){const a=Math.random()*Math.PI*2,spd=Math.random()*3+2;this.shootingStarBursts.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:0,maxLife:600,size:Math.random()*3+1});}
  },
  updateStarBursts(delta) {
    for(let i=this.shootingStarBursts.length-1;i>=0;i--){const p=this.shootingStarBursts[i];p.x+=p.vx;p.y+=p.vy;p.life+=delta;if(p.life>p.maxLife)this.shootingStarBursts.splice(i,1);}
  },
  drawStarBursts(ctx) {
    for(const p of this.shootingStarBursts){const op=1-(p.life/p.maxLife);ctx.beginPath();ctx.arc(p.x,p.y,p.size*this.scale,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,200,${op})`;ctx.fill();}
  },

  /* ── Background ──────────────────────────────────────────── */
  drawDreamBackground(ctx) {
    const g=ctx.createLinearGradient(0,0,0,this.cssHeight);
    g.addColorStop(0,"#60A5FA"); g.addColorStop(0.5,"#A78BFA"); g.addColorStop(1,"#F472B6");
    ctx.fillStyle=g; ctx.fillRect(0,0,this.cssWidth,this.cssHeight);
    const glow=ctx.createRadialGradient(this.CENTER_X,this.CENTER_Y,0,this.CENTER_X,this.CENTER_Y,this.cssWidth*0.8);
    glow.addColorStop(0,"rgba(255,255,255,0.15)"); glow.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=glow; ctx.fillRect(0,0,this.cssWidth,this.cssHeight);
  },
  drawFloatingSparkles(ctx,x,y) {
    const time=performance.now()*0.002; 
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a=(Math.PI*2/6)*i+time,sx=x+Math.cos(a)*70*this.scale,sy=y+Math.sin(a)*70*this.scale;
      ctx.moveTo(sx+6*this.scale,sy);
      ctx.arc(sx,sy,6*this.scale,0,Math.PI*2);}
    ctx.fillStyle="#FFFACD"; 
    ctx.fill();
  },

  /* ── Utility ─────────────────────────────────────────────── */
  _rrect(ctx,x,y,w,h,r) {
    r=Math.min(r,w/2,h/2);
    ctx.beginPath(); 
    ctx.moveTo(x+r,y); 
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
     ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
     ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); 
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
     ctx.closePath();
  },

  /* ── Loading screen ──────────────────────────────────────── */
  drawLoadingScreen(ctx) {
    const W=this.cssWidth, H=this.cssHeight;
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#60A5FA"); 
    g.addColorStop(0.5,"#A78BFA"); 
    g.addColorStop(1,"#F472B6");
    ctx.fillStyle=g; 
    ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(this.CENTER_X,this.CENTER_Y,0,this.CENTER_X,this.CENTER_Y,W*0.7);
    glow.addColorStop(0,"rgba(255,255,255,0.15)"); 
    glow.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=glow; 
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#ffffff";
    ctx.font=`bold ${Math.round(36*this.scale)}px 'Fredoka', sans-serif`;
    ctx.textAlign="center"; 
    ctx.textBaseline="middle";
    ctx.fillText("✨ Loading Ordinal Express...", this.CENTER_X, this.CENTER_Y - 40*this.scale);
    const progress=this.assetsToLoad===0?0:this.assetsLoaded/this.assetsToLoad;
    const barW=300*this.scale, barH=14*this.scale;
    const bx=this.CENTER_X-barW/2, by=this.CENTER_Y+20*this.scale;
    ctx.fillStyle="rgba(255,255,255,0.2)"; 
    ctx.fillRect(bx,by,barW,barH);
    ctx.fillStyle="#a78bfa"; 
    ctx.fillRect(bx,by,barW*progress,barH);
    ctx.font=`bold ${Math.round(18*this.scale)}px 'Fredoka', sans-serif`;
    ctx.fillStyle="#fff"; 
    ctx.fillText(`${Math.round(progress*100)}%`, this.CENTER_X, by+36*this.scale);
  },
};