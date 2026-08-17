/* ============================================================
   ordinals-beta-2.js  (Game10) — v2
   Changes:
   • Tutorial state built in — no tutorial.js dependency
   • Event listeners registered ONCE via _listenersAttached guard
   • Resize debounced, repositions layout only — never resets score
   • No-finger prompt drawn on canvas, zero extra DOM
   • Hold-to-start reads window.fingerPositions directly
   • fullResetOnResize() removed — replaced with _onResize()
   • FIX: countValidNumbers() caps correctCount to achievable max
   • FIX: updateMode1Merge remainingCorrect safety net added
   • UPDATE: Portal follows raw finger position directly with jitter threshold filtering
============================================================ */

const Game10 = {

  BASE_WIDTH:  1280,
  BASE_HEIGHT: 720,
  scale:    1,
  CENTER_X: 0,
  CENTER_Y: 0,

  get cssWidth()  { return canvasElement.width  / (window.devicePixelRatio || 1); },
  get cssHeight() { return canvasElement.height / (window.devicePixelRatio || 1); },

  /* ── Theme ───────────────────────────────────────────────── */
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

  /* ── Game state ──────────────────────────────────────────── */
  score: 0, running: false, lastTime: 0, gameMode: 1,
  fingerX: null, fingerY: null,
  fingerSmoothX: null, fingerSmoothY: null,
  fingerSmoothing: 0.12,

  mascot: { x:0, y:0, vx:0, vy:0, accel:0.012, maxSpeed:0.65, friction:0.980, size:130 },

  mode1Numbers: [], mode1TargetSuffix: "st",
  mode1CorrectTotal: 0, mode1CorrectCollected: 0,
  mode1RoundActive: true, mode1Confirming: false,
  mode1PortalTargetX: 0, mode1PortalTargetY: 0,
  mode1GameOver: false,
  mode1SuctionActive: false, mode1SuctionData: null,
  mode1MergeActive: false,  mode1MergeData: null,
  mode1BreakActive: false,  mode1BreakData: null,
  mode1MaxMatches: 3, mode1MinMatches: 1,

  level: 1, roundsCompleted: 0, numberRange: 10,
  hearts: 3, maxHearts: 3, heartShakeTime: 0,
  streak: 0, bestStreak: 0, streakPulse: 0,

  roundRewardActive: false, roundRewardTimer: 0, roundRewardStars: [],

  blackHoleActive: false, blackHoleTime: 0,
  blackHoleDuration: 2800, blackHoleStrength: 0, accretionAngle: 0,

  bigBangActive: false, bigBangTime: 0,
  bigBangDuration: 1400, bigBangFlash: 0,

  particles: [], sparkBursts: [], floatNumbers: [],
  MAX_PARTICLES: 120, MAX_SPARKS: 80,

  stars: [], shootingStars: [], shootingStarTimer: 0, dustMotes: [],
  shootingStarInterval: 2500,

  portalFrames: [], portalFrameIndex: 0,
  portalFrameTimer: 0, portalFrameSpeed: 80, portalSize: 200,

  mascotImages: { idle:[], happy:[], confused:[] },
  mascotFrame: 0, mascotFrameTimer: 0, mascotFrameSpeed: 120,
  mascotState: "idle",

  proximityGlow: [],
  toast: { text:"", timer:0, color:"#fff", y:0, alpha:0, maxTimer:1600 },

  /* ── Listener guard ─────────────────────────────────────── */
  _listenersAttached: false,
  _resizeTimer: null,

  /* ── Tutorial state ─────────────────────────────────────── */
  gameState: "tutorial",   // "tutorial" | "playing"
  _tutHoldProgress: 0,
  _tutEnterAnim: 0,
  _tutOrbT: 0,
  _tutPulseT: 0,
  _tutStars: [],
  _tutNoFingerFrames: 0,
  _tutNoFingerThreshold: 90,
  HOLD_SEC: 3.0,

  /* ── Finger throttle ─────────────────────────────────────── */
  _lastFingerUpdateTime: 0,
  FINGER_UPDATE_INTERVAL: 50, 

  /* ============================================================
     INIT
  ============================================================ */
 init() {
    this._applyResize(window.innerWidth, window.innerHeight);

    // ── Fixed Tracking Property Initializer ──
    this._noHandDuration = 0;
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.style.opacity = "0";
    }

    this.score = 0; this.running = true; this.lastTime = performance.now();
    this.hearts = 3; this.streak = 0; this.roundsCompleted = 0;
    this.level = 1;
    this._roundsInLevel = 0;
    this._levelRoundTarget = this._pickLevelRoundTarget();
    this.numberRange = this._getNumberRangeForLevel(this.level);
    this.mode1GameOver = false; this.blackHoleActive = false;
    this.bigBangActive = false; this.bigBangFlash = 0;
    this.particles = []; this.sparkBursts = []; this.floatNumbers = [];
    this.shootingStars = []; this.heartShakeTime = 0; this.streakPulse = 0;
    this.fingerX = null; this.fingerY = null;
    this.fingerSmoothX = null; this.fingerSmoothY = null;

    this.loadMascotSprites();
    this.loadPortalSprites();
    this.initStarfield();
    this.initDustMotes();

    this.mascot.x = this.CENTER_X; this.mascot.y = this.CENTER_Y;
    this.mascot.vx = 0; this.mascot.vy = 0;

    this.activateGameMode1();

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

      // ── Unified Double Click / Double Tap Interaction Listener ──
      this._lastTapTime = 0;
      window.addEventListener("pointerdown", (e) => {
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

      canvasElement.addEventListener("click", () => {
        if (this.mode1GameOver) this.retryMode1();
      });
    }
  },

  /* ── Resize — layout only, never resets score ───────────── */
  _onResize() {
    this._applyResize(window.innerWidth, window.innerHeight);
    this.initStarfield();
    this.initDustMotes();
    // Clear visuals that depend on screen dimensions
    this.shootingStars = [];
    this.particles = [];
    this.sparkBursts = [];
    this.floatNumbers = [];
    // Reposition mascot to center (prevents drift after resize)
    this.mascot.x = this.CENTER_X; this.mascot.y = this.CENTER_Y;
    this.mascot.vx = 0; this.mascot.vy = 0;
    // Reset finger smoothing
    this.fingerX = null; this.fingerY = null;
    this.fingerSmoothX = null; this.fingerSmoothY = null;
    // Re-layout numbers if mid-round
    if (!this.mode1GameOver && this.gameState === "playing") {
      this.spawnMode1Numbers();
    }
    // Cancel unstable states
    this.mode1SuctionActive = false;
    this.mode1MergeActive   = false;
    this.mode1BreakActive   = false;
    this.blackHoleActive    = false;
    if (this.gameState === "tutorial") this._initTutStars();
  },

  _applyResize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvasElement.width        = Math.round(w * dpr);
    canvasElement.height       = Math.round(h * dpr);
    canvasElement.style.width  = w + "px";
    canvasElement.style.height = h + "px";
    canvasElement.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale    = Math.min(w / this.BASE_WIDTH, h / this.BASE_HEIGHT) || 1;
    this.CENTER_X = w / 2;
    this.CENTER_Y = h / 2;
    // Invalidate cached gradients/canvases that depend on size/scale
    this._bgCanvas = null;
    this._portalHaloCache = null;
  },

  /* ── Tutorial stars ─────────────────────────────────────── */
  _initTutStars() {
    const w = window.innerWidth, h = window.innerHeight;
    this._tutStars = [];
    for (let i = 0; i < 80; i++) {
      this._tutStars.push({
        x: Math.round(Math.random() * w),
        y: Math.round(Math.random() * h),
        r: 0.5 + Math.random() * 1.4,
        a: 0.1 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
        ts: 0.012 + Math.random() * 0.018,
      });
    }
  },

  /* ── Transition from tutorial → playing ─────────────────── */
  _startPlaying() {
    this.gameState = "playing";
  },

  /* ============================================================
     TUTORIAL DRAW
  ============================================================ */
  /* ============================================================
     TUTORIAL DRAW
  ============================================================ */
  _updateTutorial(ctx, fingers, dt) {
    this._tutEnterAnim = Math.min(1, this._tutEnterAnim + dt * 2);
    this._tutOrbT     += dt;
    this._tutPulseT   += dt * 1.8;

    if (this._tutPage === undefined) {
      this._tutPage = 1;
    }

    const eA    = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    const alpha = eA(this._tutEnterAnim);
    const W = this.cssWidth, H = this.cssHeight;
    const cx = this.CENTER_X, cy = this.CENTER_Y;
    const T = this.T;

    /* Background matching game environment */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, T.bg1); bg.addColorStop(0.5, T.bg2); bg.addColorStop(1, T.bg3);
    ctx.globalAlpha = alpha; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    
    const ag = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy * 0.7, W * 0.55);
    ag.addColorStop(0, "rgba(124,58,237,0.12)"); ag.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);

    for (const s of this._tutStars) {
      s.tw += s.ts;
      ctx.globalAlpha = alpha * Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = alpha;

    const tColor = "#7c3aed";
    const isMob  = W < 540;
    const cardW  = Math.min(W - 32, isMob ? 360 : 700);
    const cardH  = Math.min(H - 60, isMob ? 580 : 540);
    const cardX  = cx - cardW / 2;
    const cardY  = cy - cardH / 2;
    const cR     = 20;
    const hr = s => { const h=(s||"").replace("#",""); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return isNaN(r)?"124,58,237":`${r},${g},${b}`; };

    /* Card Frame structure */
    ctx.shadowColor = tColor; ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(18,12,46,0.96)";
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, cR); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${hr(tColor)},0.45)`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = `rgba(${hr(tColor)},0.16)`;
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, 56, [cR, cR, 0, 0]); ctx.fill();

    /* Header text rendering */
    ctx.font = `bold ${isMob ? 22 : 28}px 'Fredoka', 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = "#a78bfa"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 14;
    ctx.fillText("🌌  GALAXY COLLECTOR", cx, cardY + 28); ctx.shadowBlur = 0;
    
    ctx.font = `${isMob ? 12 : 14}px 'Fredoka', 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = "rgba(226,232,240,0.68)";
    ctx.fillText(`Page ${this._tutPage} of 2 — ${this._tutPage === 1 ? 'Core Mechanics & Target UI' : 'Hearts & Streak Bonus'}`, cx, cardY + 65);

    /* Left Side Mini-Diagram Box Frame */
    const visX = cardX + 12, visY = cardY + 76;
    const visW = isMob ? cardW - 24 : cardW * 0.42;
    const visH = isMob ? 140 : cardH - 200;
    ctx.fillStyle = "rgba(8,6,28,0.72)";
    ctx.beginPath(); ctx.roundRect(visX, visY, visW, visH, 12); ctx.fill();
    ctx.strokeStyle = `rgba(${hr(tColor)},0.14)`; ctx.lineWidth = 1; ctx.stroke();
    this._drawTutVisual(ctx, visX, visY, visW, visH, this._tutOrbT);

    /* Split Pagination Rows Matrix */
    const contentRows = [];
    if (this._tutPage === 1) {
      contentRows.push(
        { isHeader: true,  text: "🎮 Gameplay" },
        { icon: "👆", text: "Your index finger controls the portal" },
        { icon: "🌌", text: "Move portal around to absorb numbers" },
        { icon: "✅", text: "Swallow numbers matching portal suffix" },
        { isHeader: true,  text: "⭐ Score Parameters" },
        { icon: "✨", text: "Absorb matching numbers to earn points" },
        { icon: "🔥", text: "Consecutive matches multiply total scores" }
      );
    } else {
      contentRows.push(
        { isHeader: true,  text: "⏱️ Round Vital Metrics" },
        { icon: "❤️", text: "You begin with 3 full structural hearts" },
        { icon: "⏳", text: "Absorbing incorrect numbers drops 1 heart" },
        { isHeader: true,  text: "🔥 Streak Bonus Points" },
        { icon: "✅", text: "0-2 in a row = +10 points" },
        { icon: "✨", text: "3-4 in a row = +20 points" },
        { icon: "⭐", text: "5-9 in a row = +30 points" },
        { icon: "🔥", text: "10+ in a row = +50 points!" }
      );
    }

    const rulesX = isMob ? cardX + 12 : cardX + visW + 24;
    const rulesY = isMob ? visY + visH + 10 : cardY + 76;
    const rulesW = isMob ? cardW - 24 : cardW - visW - 36;
    const dynamicRowH = isMob ? (this._tutPage === 1 ? 30 : 27) : (this._tutPage === 1 ? 36 : 33);

    for (let i = 0; i < contentRows.length; i++) {
      const item = contentRows[i];
      const currentY = rulesY + (i * dynamicRowH);
      const prog = Math.max(0, Math.min(1, (this._tutEnterAnim - i * 0.08) / 0.6));
      ctx.globalAlpha = alpha * (1 - Math.pow(1 - prog, 3));

      if (item.isHeader) {
        ctx.font = `bold ${isMob ? 13 : 15}px 'Fredoka', 'Trebuchet MS', sans-serif`;
        ctx.fillStyle = "#a78bfa"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(item.text, rulesX + 4, currentY + dynamicRowH / 2);
      } else {
        ctx.fillStyle = i % 2 === 0 ? "rgba(18,10,50,0.55)" : "rgba(10,6,30,0.4)";
        ctx.beginPath(); ctx.roundRect(rulesX, currentY, rulesW, dynamicRowH - 4, 8); ctx.fill();
        
        ctx.font = `${isMob ? 15 : 17}px 'Fredoka', 'Trebuchet MS', sans-serif`;
        ctx.fillStyle = T.textPrimary; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(item.icon, rulesX + 10, currentY + dynamicRowH / 2 - 2);
        
        ctx.font = `${isMob ? 11.5 : 13}px 'Fredoka', 'Trebuchet MS', sans-serif`;
        ctx.fillStyle = `rgba(226,232,240,0.85)`;
        ctx.fillText(item.text, rulesX + 36, currentY + dynamicRowH / 2 - 2);
      }
    }
    ctx.globalAlpha = alpha;

    /* Interactive Progress Divider and Hold Validation */
    const holdY = cardY + cardH - (isMob ? 82 : 86);
    ctx.strokeStyle = `rgba(${hr(tColor)},0.18)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cardX + 20, holdY - 6); ctx.lineTo(cardX + cardW - 20, holdY - 6); ctx.stroke();

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
      ctx.font = `bold ${isMob ? 13 : 15}px 'Fredoka', 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = blink ? "#fbbf24" : "rgba(251,191,36,0.55)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = blink ? 12 : 0;
      ctx.fillText("☝ Raise your index finger to the camera!", cx, holdY + 18); ctx.shadowBlur = 0;
      ctx.font = `${isMob ? 11 : 13}px 'Fredoka', 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = "rgba(167,139,250,0.65)";
      const promptStr = this._tutPage === 1 ? "Hold still for 3 seconds to view Page 2" : "Hold still for 3 seconds to launch";
      ctx.fillText(promptStr, cx, holdY + 40);
    } else {
      const pct = Math.round(this._tutHoldProgress * 100);
      ctx.font = `bold ${isMob ? 13 : 15}px 'Fredoka', 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = "#a78bfa"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 10;
      const actionStr = this._tutPage === 1 ? `Loading Page 2... ${pct}%` : `Hold still... ${pct}%`;
      ctx.fillText(actionStr, cx, holdY + 16); ctx.shadowBlur = 0;
      
      const barW = cardW * 0.6, barH = 8, barX = cx - barW / 2, barY = holdY + 34;
      ctx.fillStyle = "rgba(18,10,50,0.8)";
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();
      ctx.fillStyle = "#a78bfa"; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * this._tutHoldProgress, barH, 4); ctx.fill(); ctx.shadowBlur = 0;
    }

    /* Reticle Pass */
    if (hasFing) {
      const fx = fingers[0].x, fy = fingers[0].y;
      ctx.beginPath(); ctx.arc(fx, fy, 38, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${hr(tColor)},0.18)`; ctx.lineWidth = 5; ctx.stroke();
      if (this._tutHoldProgress > 0.01) {
        ctx.beginPath(); ctx.arc(fx, fy, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this._tutHoldProgress);
        ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 5; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
      }
      ctx.beginPath(); ctx.arc(fx, fy, 22, 0, Math.PI * 2);
      ctx.shadowColor = "rgba(124,58,237,0.7)"; ctx.shadowBlur = 28;
      ctx.fillStyle = "rgba(90,40,180,0.45)"; ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy, 10, 0, Math.PI * 2);
      ctx.shadowBlur = 12; ctx.fillStyle = "#c4b5fd"; ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  },

  /* ── Tutorial visual: portal with scattered number cards ── */
  _drawTutVisual(ctx, px, py, pw, ph, t) {
    ctx.save(); ctx.translate(px, py);
    const mx = pw / 2, my = ph / 2;
    const T = this.T;

    // Cosmic backdrop
    const bg = ctx.createRadialGradient(mx, my, 0, mx, my, Math.min(pw, ph) * 0.6);
    bg.addColorStop(0, "rgba(124,58,237,0.18)"); bg.addColorStop(1, "rgba(10,14,39,0)");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(mx, my, Math.min(pw, ph) * 0.6, 0, Math.PI * 2); ctx.fill();
    
    // Mini stars
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 20; i++) {
      ctx.beginPath(); ctx.arc((i * 37.3) % pw, (i * 29.7) % ph, 0.8, 0, Math.PI * 2); ctx.fill();
    }

    // Portal (player)
    const bobY = my + Math.sin(t * 2) * 5;
    const pg = ctx.createRadialGradient(mx, bobY, 0, mx, bobY, 40);
    pg.addColorStop(0, "rgba(124,58,237,0.5)"); pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(mx, bobY, 40, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx, bobY, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1040"; ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 20; ctx.fill();
    ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#fbbf24"; ctx.font = "bold 13px 'Fredoka', cursive";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ST", mx, bobY);

    // Number cards
    const cards = [
      { x: pw * 0.15, y: my - 28, num: 1,  c: true  },
      { x: pw * 0.80, y: my - 20, num: 4,  c: false },
      { x: pw * 0.22, y: my + 40, num: 21, c: true  },
      { x: pw * 0.76, y: my + 42, num: 7,  c: false },
    ];
    for (const card of cards) {
      const cr = 22;
      ctx.save(); ctx.translate(card.x, card.y);
      ctx.fillStyle = T.cardBg;
      ctx.beginPath(); ctx.roundRect(-cr, -cr * 0.7, cr * 2, cr * 1.4, 8); ctx.fill();
      ctx.strokeStyle = card.c ? T.correct : "rgba(255,255,255,0.18)"; ctx.lineWidth = card.c ? 2 : 1;
      if (card.c) { ctx.shadowColor = T.correct; ctx.shadowBlur = 12; }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#fbbf24"; ctx.font = "bold 19px 'Fredoka', cursive";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(card.num, 0, 0);
      ctx.restore();
    }

    // Animated suction trail to first correct card
    const sc = cards.find(c => c.c);
    if (sc) {
      const prog = (t * 0.5) % 1;
      const lx = sc.x + (mx - sc.x) * prog, ly = sc.y + (bobY - sc.y) * prog;
      ctx.strokeStyle = "rgba(52,211,153,0.38)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(sc.x, sc.y); ctx.lineTo(mx, bobY); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(lx, ly, 7, 0, Math.PI * 2); ctx.fillStyle = "#fbbf24"; ctx.fill();
      ctx.fillStyle = "#000"; ctx.font = "bold 7px 'Fredoka', cursive";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("1", lx, ly);
    }

    ctx.font = "10px 'Fredoka', cursive"; ctx.fillStyle = "rgba(167,139,250,0.8)";
    ctx.textAlign = "center"; ctx.fillText("Swallow only numbers ending in ST!", mx, ph - 8);

    const legendY = ph + 10;

    ctx.beginPath(); ctx.arc(mx - 46, legendY, 8, 0, Math.PI * 2); ctx.fillStyle = "rgba(124,58,237,0.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(mx - 46, legendY, 4, 0, Math.PI * 2); ctx.fillStyle = "#c4b5fd"; ctx.fill();
    ctx.fillStyle = "rgba(167,139,250,0.75)"; ctx.font = "11px 'Fredoka', cursive";
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("= controls the portal", mx - 36, legendY);

    ctx.restore();
  },

  /* ── No-finger prompt (drawn on canvas) ─────────────────── */
  _drawNoFingerPrompt(ctx) {
    const fingers = window.fingerPositions || [];
    if (fingers.length > 0) { this._tutNoFingerFrames = 0; return; }
    this._tutNoFingerFrames++;
    if (this._tutNoFingerFrames < this._tutNoFingerThreshold) return;
    const W = this.cssWidth, H = this.cssHeight;
    const copy  = "☝ Raise your index finger to navigate the galaxy!";
    const blink = Math.sin(performance.now() * 0.003) > 0;
    ctx.font = "bold 15px 'Fredoka', 'Trebuchet MS', sans-serif";
    // Cache text width — string and font never change, measureText is a layout op
    if (this._noFingerTextWidth === undefined) {
      this._noFingerTextWidth = ctx.measureText(copy).width;
    }
    const tw = this._noFingerTextWidth;
    const bw = tw + 56, bh = 46, bx = W / 2 - bw / 2, by = H - 110;
    ctx.globalAlpha = blink ? 0.95 : 0.55;
    ctx.fillStyle = "rgba(18,12,46,0.92)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = blink ? "#a78bfa" : "rgba(167,139,250,0.4)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#a78bfa"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(copy, W / 2, by + bh / 2);
    ctx.globalAlpha = 1;
  },

  /* ── Mode 1 setup ────────────────────────────────────────── */
  activateGameMode1() {
    this.gameMode = 1;
    const s = ["st","nd","rd","th"];
    this.mode1TargetSuffix = s[Math.floor(Math.random() * 4)];
    this.spawnMode1Numbers();
  },

  /* ── Suffix helpers ──────────────────────────────────────── */
  getSuffix(num) {
    const t = num % 100;
    if (t >= 11 && t <= 13) return "th";
    const l = num % 10;
    if (l === 1) return "st"; if (l === 2) return "nd"; if (l === 3) return "rd";
    return "th";
  },
  generateNumberWithSuffix(suffix, usedNumbers) {
    usedNumbers = usedNumbers || new Set();
    let n, attempts = 0;
    do {
      n = Math.floor(Math.random() * this.numberRange) + 1;
      attempts++;
      if (attempts > 200) {
        for (let i = 1; i <= this.numberRange; i++) {
          if (this.getSuffix(i) === suffix && !usedNumbers.has(i)) return i;
        }
        for (let i = 1; i <= this.numberRange; i++) {
          if (this.getSuffix(i) === suffix) return i;
        }
        for (let i = 1; i <= 100; i++) {
          if (this.getSuffix(i) === suffix && !usedNumbers.has(i)) return i;
        }
        return 1;
      }
    } while (this.getSuffix(n) !== suffix || usedNumbers.has(n));
    return n;
  },

  /* ── Count valid numbers for suffix ── */
  countValidNumbers(suffix) {
    let count = 0;
    for (let n = 1; n <= this.numberRange; n++) {
      if (this.getSuffix(n) === suffix) count++;
    }
    return count;
  },

  /* ── Spawn numbers ───────────────────────────────────────── */
  spawnMode1Numbers() {
    this.mode1Numbers = [];
    this.proximityGlow = [];

    this.mode1SuctionActive = false;
    this.mode1SuctionData = null;

    this.mode1MergeActive = false;
    this.mode1BreakActive = false;

    const maxPossible = this.countValidNumbers(this.mode1TargetSuffix);
    const safeMax = Math.max(1, Math.min(this.mode1MaxMatches, maxPossible));
    const safeMin = Math.min(this.mode1MinMatches, safeMax);

    const correctCount = safeMax > safeMin
      ? Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin
      : safeMax;

    this.mode1CorrectTotal = correctCount;
    this.mode1CorrectCollected = 0;

    this.mode1RoundActive = true;
    this.mode1Confirming = false;

    const MAX_NUMBERS = 5;
    const MIN_DISTANCE = 220 * this.scale;

    const count = Math.min(MAX_NUMBERS, 4 + this.level);

    const margin = 140 * this.scale;
    const safeR = 170 * this.scale;

    // No-spawn zone is centered on the portal's CURRENT position (wherever
    // the finger actually is right now), not the screen center — otherwise
    // numbers can spawn under/near a portal that never recenters.
    const originX = this.mascot.x;
    const originY = this.mascot.y;

    const used = [];
    let correctSpawned = 0;

    const usedNumbers = new Set();

    for (let i = 0; i < count; i++) {

      let x, y;
      let attempts = 0;
      let foundPosition = false;

      while (attempts < 80 && !foundPosition) {
        attempts++;
        x = margin + Math.random() * (this.cssWidth - margin * 2);
        y = margin + Math.random() * (this.cssHeight - margin * 2);

        if (Math.hypot(x - originX, y - originY) < safeR) continue;

        let tooClose = false;
        for (const p of used) {
          if (Math.hypot(x - p.x, y - p.y) < MIN_DISTANCE) { tooClose = true; break; }
        }
        if (!tooClose) foundPosition = true;
      }

      if (!foundPosition) {
        x = margin + Math.random() * (this.cssWidth - margin * 2);
        y = margin + Math.random() * (this.cssHeight - margin * 2);
      }

      used.push({ x, y });

      let num;
      if (correctSpawned < correctCount) {
        num = this.generateNumberWithSuffix(this.mode1TargetSuffix, usedNumbers);
        correctSpawned++;
      } else {
        // Generate a DISTRACTOR number — must NOT match the target suffix.
        let distAttempts = 0;
        do {
          num = Math.floor(Math.random() * this.numberRange) + 1;
          distAttempts++;
          if (distAttempts > 300) {
            // FIX: previously this just broke out and kept whatever `num`
            // was last rolled — which could still match the target suffix,
            // producing a visually-"correct" distractor that was never
            // counted in mode1CorrectTotal. That let players finish a round
            // after catching only ONE of two identical-looking numbers,
            // leaving a duplicate uncollected on screen.
            //
            // Instead, explicitly search for a guaranteed non-matching,
            // unused number before giving up.
            let fallback = null;
            for (let n = 1; n <= this.numberRange; n++) {
              if (this.getSuffix(n) !== this.mode1TargetSuffix && !usedNumbers.has(n)) {
                fallback = n;
                break;
              }
            }
            // If the range is too small/saturated to find an unused one,
            // fall back to ANY non-matching number (allow reuse) rather
            // than risking a number that matches the target suffix.
            if (fallback === null) {
              for (let n = 1; n <= this.numberRange; n++) {
                if (this.getSuffix(n) !== this.mode1TargetSuffix) {
                  fallback = n;
                  break;
                }
              }
            }
            num = fallback !== null ? fallback : num;
            break;
          }
        } while (
          (this.getSuffix(num) === this.mode1TargetSuffix || usedNumbers.has(num))
        );
      }

      usedNumbers.add(num);

      this.mode1Numbers.push({
        number: num,
        x, y,
        baseX: x, baseY: y,
        floatAmp: 6 * this.scale,
        floatPeriod: 2500 + Math.random() * 1500,
        floatOffset: Math.random() * Math.PI * 2,
        renderScale: 1,
        renderRotation: 0,
        spawnAlpha: 0,
        spawnDelay: i * 80
      });

      this.proximityGlow.push(0);
    }
  },

  /* ============================================================
     MAIN UPDATE
  ============================================================ */
  update(ctx, _fp, dtArg) {
    if (!this.running) return;

    const now = performance.now();
    let delta;
    if (typeof dtArg === "number" && dtArg > 0 && dtArg < 1) delta = dtArg * 1000;
    else delta = now - this.lastTime;
    delta = Math.min(Math.max(delta, 1), 50);
    this.lastTime = now;

    if (this.gameState === "tutorial") {
      const fingers = window.fingerPositions || [];
      this._updateTutorial(ctx, fingers, delta / 1000);
      return;
    }

    this._noHandDuration = 0;
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.style.opacity = "0";
    }

    this.drawBackground(ctx);
    if (this.theme === "space") {
      this.updateStars(delta); this.drawStars(ctx);
      this.updateShootingStars(delta); this.drawShootingStars(ctx);
    } else {
      this.updateDustMotes(delta); this.drawDustMotes(ctx);
    }

    this.updateBigBang(delta);
    this.updateFingerPosition(now);
    this.updateMascot(delta);
    this.updatePortalAnimation(delta);
    this.updateNumberSpawns(delta);
    this.updateMode1Logic(delta);
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
    this._drawNoFingerPrompt(ctx);
  },

  /* ── Finger tracking with direct follow & anti-jitter deadzone ───────────────── */
  updateFingerPosition(now) {
    if (now - this._lastFingerUpdateTime < this.FINGER_UPDATE_INTERVAL) return;
    this._lastFingerUpdateTime = now;

    if (!window.fingerPositions || !Array.isArray(window.fingerPositions) || window.fingerPositions.length === 0) {
      this.fingerX = null; this.fingerY = null;
      return;
    }

    const fp = window.fingerPositions[0];

    // Initialize position directly if unset
    if (this.fingerX === null || this.fingerY === null) {
      this.fingerX = fp.x;
      this.fingerY = fp.y;
      return;
    }

    // Deadzone threshold (in CSS pixels): ignore microscopic micro-movements to remove jitter
    const JITTER_THRESHOLD = 2.5; 
    const dist = Math.hypot(fp.x - this.fingerX, fp.y - this.fingerY);

    // Only update portal position when reading movement exceeds the threshold
    if (dist >= JITTER_THRESHOLD) {
      this.fingerX = fp.x;
      this.fingerY = fp.y;
    }
  },

  /* ── Mascot / Portal Movement ───────────────────────────── */
  updateMascot(delta) {
    if (this.gameMode === 1 && this.mode1Confirming) {
      // Round-complete pause: portal freezes exactly where it caught the
      // last correct number (does NOT fly to center — that's what caused
      // it to land on top of a number the instant the finger was re-read).
      this.mode1ConfirmTimer -= delta;
      this.mascot.vx = 0; this.mascot.vy = 0;
      if (this.mode1ConfirmTimer <= 0) {
        this.mode1Confirming = false;
        this.startNewRound();
      }
      return;
    }

    // Follow finger position directly
    if (this.fingerX !== null && this.fingerY !== null) {
      this.mascot.x = this.fingerX;
      this.mascot.y = this.fingerY;
      this.mascot.vx = 0;
      this.mascot.vy = 0;
    }

    const pad = 70 * this.scale;
    this.mascot.x = Math.max(pad, Math.min(this.cssWidth  - pad, this.mascot.x));
    this.mascot.y = Math.max(pad, Math.min(this.cssHeight - pad, this.mascot.y));
  },

  /* ── Sprites ─────────────────────────────────────────────── */
  loadMascotSprites() {
    this.mascotImages = { idle:[], happy:[], confused:[] };
    for (let i=0;i<=4;i++){const img=new Image();img.src=`MID-I/0${i}_MID-I.png`;this.mascotImages.idle.push(img);}
    for (let i=0;i<=3;i++){const img=new Image();img.src=`MID-H/0${i}_MID-H.png`;this.mascotImages.happy.push(img);}
    for (let i=0;i<=2;i++){const img=new Image();img.src=`MID-C/0${i}_MID-C.png`;this.mascotImages.confused.push(img);}
  },
  loadPortalSprites() {
    this.portalFrames = [];
    for (let i=0;i<=8;i++){const img=new Image();img.src=`D-1/0${i}_D-1.png`;this.portalFrames.push(img);}
  },
  updatePortalAnimation(delta) {
    this.portalFrameTimer += delta;
    if (this.portalFrameTimer >= this.portalFrameSpeed) { this.portalFrameIndex = (this.portalFrameIndex+1)%Math.max(1,this.portalFrames.length); this.portalFrameTimer -= this.portalFrameSpeed; }
  },

  /* ── Background ──────────────────────────────────────────── */
  /* Pre-render the (static) background gradient stack to an offscreen
     canvas once, then just blit it every frame. Avoids rebuilding two
     gradients from scratch 60x/sec — same pixels, far cheaper draw call.
     Cache is invalidated on resize (_applyResize clears _bgCanvas) and
     rebuilt automatically if theme changes at runtime. */
  _buildBgCache() {
    const W = this.cssWidth, H = this.cssHeight, T = this.T;
    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(W * dpr));
    off.height = Math.max(1, Math.round(H * dpr));
    const octx = off.getContext("2d");
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = octx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, T.bg1); g.addColorStop(0.5, T.bg2); g.addColorStop(1, T.bg3);
    octx.fillStyle = g; octx.fillRect(0, 0, W, H);

    const r = octx.createRadialGradient(this.CENTER_X, this.CENTER_Y * 0.7, 0, this.CENTER_X, this.CENTER_Y * 0.7, W * 0.55);
    r.addColorStop(0, "rgba(124,58,237,0.12)"); r.addColorStop(1, "rgba(0,0,0,0)");
    octx.fillStyle = r; octx.fillRect(0, 0, W, H);

    this._bgCanvas = off;
    this._bgCanvasTheme = this.theme;
    this._bgCanvasCssW = W;
    this._bgCanvasCssH = H;
  },
  drawBackground(ctx) {
    const W = this.cssWidth, H = this.cssHeight;
    if (!this._bgCanvas || this._bgCanvasTheme !== this.theme ||
        this._bgCanvasCssW !== W || this._bgCanvasCssH !== H) {
      this._buildBgCache();
    }
    ctx.drawImage(this._bgCanvas, 0, 0, W, H);
  },

  initStarfield() {
    this.stars=[];
    for (let i=0;i<120;i++) this.stars.push({x:Math.random()*this.cssWidth,y:Math.random()*this.cssHeight,r:Math.random()*1.8+0.3,speed:0.008+Math.random()*0.025,twinkle:Math.random()*Math.PI*2,twinkleSpd:0.002+Math.random()*0.003,vx:0,vy:0});
  },
  updateStars(delta) { for(const s of this.stars){s.y+=s.speed*delta;s.twinkle+=s.twinkleSpd*delta;if(s.y>this.cssHeight){s.y=0;s.x=Math.random()*this.cssWidth;}} },
  drawStars(ctx) { for(const s of this.stars){ctx.globalAlpha=Math.max(0,0.35+Math.sin(s.twinkle)*0.3);ctx.beginPath();ctx.arc(s.x,s.y,s.r*this.scale,0,Math.PI*2);ctx.fillStyle="#ffffff";ctx.fill();}ctx.globalAlpha=1; },

  updateShootingStars(delta) {
    this.shootingStarTimer += delta;
    if (this.shootingStarTimer >= this.shootingStarInterval && this.shootingStars.length < 4) {
      this.shootingStarTimer = 0; this.shootingStarInterval = 2500 + Math.random() * 3000;
      const fl=Math.random()<0.5,spd=(7+Math.random()*5)*0.055;
      this.shootingStars.push({x:fl?-60:this.cssWidth+60,y:Math.random()*this.cssHeight*0.5,vx:fl?spd:-spd,vy:(1.5+Math.random()*1.5)*0.055,life:0,maxLife:900});
    }
    // Swap-and-pop removal (order doesn't matter for rendering) — avoids
    // O(n) element shifting that splice() does inside a loop.
    for(let i=this.shootingStars.length-1;i>=0;i--){
      const s=this.shootingStars[i];s.x+=s.vx*delta;s.y+=s.vy*delta;s.life+=delta;
      if(s.life>s.maxLife){
        this.shootingStars[i]=this.shootingStars[this.shootingStars.length-1];
        this.shootingStars.pop();
      }
    }
  },
  drawShootingStars(ctx) {
    for(const s of this.shootingStars){const alpha=Math.max(0,1-s.life/s.maxLife),tL=160,absVx=Math.abs(s.vx)||0.01,tx=s.x-s.vx*tL/absVx,ty=s.y-s.vy*tL/absVx;const grd=ctx.createLinearGradient(s.x,s.y,tx,ty);grd.addColorStop(0,`rgba(255,255,255,${alpha})`);grd.addColorStop(1,"rgba(255,255,255,0)");ctx.strokeStyle=grd;ctx.lineWidth=2*this.scale;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(tx,ty);ctx.stroke();}
  },

  initDustMotes() {
    this.dustMotes=[];
    for(let i=0;i<60;i++) this.dustMotes.push({x:Math.random()*this.cssWidth,y:Math.random()*this.cssHeight,r:Math.random()*3+1,vx:(Math.random()-0.5)*0.00006,vy:-(0.00004+Math.random()*0.00006),alpha:Math.random()*0.15+0.05});
  },
  updateDustMotes(delta) { for(const d of this.dustMotes){d.x+=d.vx*delta;d.y+=d.vy*delta;if(d.y<-10){d.y=this.cssHeight+10;d.x=Math.random()*this.cssWidth;}if(d.x<-10)d.x=this.cssWidth+10;if(d.x>this.cssWidth+10)d.x=-10;} },
  drawDustMotes(ctx) { for(const d of this.dustMotes){ctx.globalAlpha=d.alpha;ctx.beginPath();ctx.arc(d.x,d.y,d.r*this.scale,0,Math.PI*2);ctx.fillStyle=this.T.accent;ctx.fill();}ctx.globalAlpha=1; },

  /* ── Portal player ───────────────────────────────────────── */
  /* Halo gradient only depends on sz (i.e. scale) and theme accent color —
     cache it per scale value instead of building a fresh radial gradient
     every single frame. */
  _getPortalHalo(ctx, sz) {
    const key = sz.toFixed(2) + "|" + this.theme;
    if (this._portalHaloCache && this._portalHaloCache.key === key) {
      return this._portalHaloCache.gradient;
    }
    const T = this.T;
    const halo = ctx.createRadialGradient(0, 0, sz * 0.25, 0, 0, sz * 0.75);
    halo.addColorStop(0, T.accentGlow); halo.addColorStop(1, "rgba(0,0,0,0)");
    this._portalHaloCache = { key, gradient: halo };
    return halo;
  },
  drawMode1PortalPlayer(ctx) {
    const T=this.T,px=this.mascot.x,py=this.mascot.y;
    const sz=this.portalSize*this.scale,now=performance.now();
    const spdN=Math.min(Math.hypot(this.mascot.vx,this.mascot.vy)/this.mascot.maxSpeed,1);
    const scX=1+spdN*0.10,scY=1-spdN*0.07,bob=Math.sin(now*0.003)*5*this.scale;
    ctx.save();ctx.translate(px,py+bob);ctx.scale(scX,scY);
    const halo=this._getPortalHalo(ctx, sz);
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,sz*0.75,0,Math.PI*2);ctx.fill();
    const frame=this.portalFrames[this.portalFrameIndex];
    if(frame&&frame.complete&&frame.naturalWidth>0){ctx.drawImage(frame,-sz/2,-sz/2,sz,sz);}
    else{ctx.beginPath();ctx.arc(0,0,sz*0.44,0,Math.PI*2);ctx.fillStyle=T.accent;ctx.globalAlpha=0.85;ctx.fill();ctx.globalAlpha=1;}
    ctx.shadowColor=T.accentGlow;ctx.shadowBlur=20;
    ctx.font=`bold ${Math.round(52*this.scale)}px 'Fredoka',cursive`;
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.lineWidth=2*this.scale;ctx.strokeStyle="black";ctx.strokeText(this.mode1TargetSuffix.toUpperCase(),0,0);
    ctx.fillStyle="#ffffff";ctx.fillText(this.mode1TargetSuffix.toUpperCase(),0,0);ctx.shadowBlur=0;
    if(this.mascotState==="happy"){const rr=96*this.scale+Math.sin(now*0.01)*8;ctx.strokeStyle=T.correct;ctx.lineWidth=4*this.scale;ctx.globalAlpha=0.6;ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    ctx.restore();
  },

  /* ── Number spawns ───────────────────────────────────────── */
  updateNumberSpawns(delta) { for(const n of this.mode1Numbers){if(n.spawnDelay>0)n.spawnDelay-=delta;else n.spawnAlpha=Math.min(1,n.spawnAlpha+delta*0.003);} },

  /* ── Proximity glow ──────────────────────────────────────── */
  updateProximityGlow(delta) {
    if (this.level > 1) { for(let i=0;i<this.proximityGlow.length;i++)this.proximityGlow[i]=0; return; }
    const px=this.mascot.x,py=this.mascot.y,maxD=270*this.scale;
    const k=1-Math.pow(0.985,delta);
    for(let i=0;i<this.mode1Numbers.length;i++){const n=this.mode1Numbers[i];const t=Math.max(0,1-Math.hypot(px-n.x,py-n.y)/maxD);this.proximityGlow[i]+=(t-this.proximityGlow[i])*k;}
  },

  drawMode1Numbers(ctx) {
    const T=this.T,now=performance.now();
    // Shadow blur is one of the most expensive canvas ops on weak/Android
    // GPUs. Only pay for it once glow is visually meaningful — below this
    // threshold the blur was imperceptible anyway (radius < ~1px).
    const SHADOW_GLOW_THRESHOLD = 0.12;
    for(let i=0;i<this.mode1Numbers.length;i++){
      const n=this.mode1Numbers[i];
      if(n.spawnAlpha<=0.01)continue;
      const glow=this.level===1?(this.proximityGlow[i]||0):0;
      const fY=Math.sin((now/n.floatPeriod)*Math.PI*2+n.floatOffset)*n.floatAmp;
      const sc=(n.renderScale||1)*(1+glow*0.12);
      const isC=this.getSuffix(n.number)===this.mode1TargetSuffix;
      ctx.save();ctx.globalAlpha=n.spawnAlpha;ctx.translate(n.x,n.y+fY);ctx.rotate(n.renderRotation||0);ctx.scale(sc,sc);
      if(glow>SHADOW_GLOW_THRESHOLD){ctx.shadowColor=isC?T.correct:T.wrong;ctx.shadowBlur=22*glow;}
      const cr=44*this.scale;
      ctx.fillStyle=T.cardBg;ctx.strokeStyle=glow>0.1?(isC?T.correct:T.wrong):T.cardBorder;ctx.lineWidth=(2+glow*3)*this.scale;
      this._rrect(ctx,-cr,-cr*0.72,cr*2,cr*1.44,16*this.scale);ctx.fill();ctx.stroke();
      if (glow>SHADOW_GLOW_THRESHOLD) { ctx.shadowBlur=0; }
      ctx.shadowColor=T.numberGlow;
      ctx.shadowBlur=glow>SHADOW_GLOW_THRESHOLD ? (12+glow*18) : 0;
      ctx.fillStyle=T.numberColor;
      ctx.font=`bold ${Math.round(46*this.scale)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(n.number,0,0);ctx.shadowBlur=0;ctx.restore();
    }
  },

  /* ── Mode 1 logic ────────────────────────────────────────── */
  updateMode1Logic(delta) {
    this.updateProximityGlow(delta);
    if (!this.mode1RoundActive || this.mode1GameOver || this.mode1SuctionActive || 
        this.mode1BreakActive || this.blackHoleActive || this.mode1Confirming) return;

    const pullRadius = 160 * this.scale;
    const catchRadius = 65 * this.scale;

    for (let i = 0; i < this.mode1Numbers.length; i++) {
      const n = this.mode1Numbers[i];
      if (n.spawnAlpha < 0.5) continue;

      const dx = this.mascot.x - n.x;
      const dy = this.mascot.y - n.y;
      const dist = Math.hypot(dx, dy);

      // Magnetic pull when close
      if (dist < pullRadius && dist > catchRadius) {
        const pullForce = (1 - dist / pullRadius) * 0.12 * delta;
        n.x += (dx / dist) * pullForce;
        n.y += (dy / dist) * pullForce;
      }

      // Trigger absorption
      if (dist <= catchRadius) {
        this.startMode1Suction(i);
        break;
      }
    }
  },

  /* ── Suction ─────────────────────────────────────────────── */
  startMode1Suction(index) {
    const n=this.mode1Numbers[index];
    this.mode1SuctionActive=true;this.mode1SuctionData={index,startX:n.x,startY:n.y,targetX:this.mascot.x,targetY:this.mascot.y,time:0,duration:420};
  },
  updateMode1Suction(delta) {
    if(!this.mode1SuctionActive)return;
    const s=this.mode1SuctionData,n=this.mode1Numbers[s.index];
    if(!n){this.mode1SuctionActive=false;return;}
    s.targetX=this.mascot.x;s.targetY=this.mascot.y;s.time+=delta;
    const p=Math.min(1,s.time/s.duration),ep=1-Math.pow(1-p,3);
    n.x=s.startX+(s.targetX-s.startX)*ep;n.y=s.startY+(s.targetY-s.startY)*ep;n.renderScale=1-ep*0.4;
    if(p>=1)this.finishMode1Suction();
  },
  finishMode1Suction() {
    const s = this.mode1SuctionData, n = this.mode1Numbers[s.index];
    if (!n) return;
    const correct = this.getSuffix(n.number) === this.mode1TargetSuffix;
    if (correct) {
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      
      // Calculate multiplier bonus based on consecutive correct streak
      let points = 10;
      if (this.streak >= 10) points = 50;
      else if (this.streak >= 5) points = 30;
      else if (this.streak >= 3) points = 20;

      this.score += points;
      this.streakPulse = 1;
      this.mascotState = "happy";
      this.startPortalMerge(n.number);
      this.mode1Numbers.splice(s.index, 1);
      this.proximityGlow.splice(s.index, 1);
      this.showToast(`${this.getPositiveFeedback()} +${points}`, this.T.correct);
      this.spawnCorrectParticles(this.mascot.x, this.mascot.y);
    } else {
      this.score -= 5
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
    this.mode1SuctionData = null;
    setTimeout(() => { if (this.mascotState !== "idle") this.mascotState = "idle"; }, 1100);
  },



  getPositiveFeedback(){if(this.streak>=5)return["🔥 You're on FIRE!","🌟 Unstoppable!","🚀 Total Genius!"][Math.floor(Math.random()*3)];if(this.streak>=3)return["⭐ Amazing streak!","💫 Keep going!","🎯 So good!"][Math.floor(Math.random()*3)];return["✅ That's right!","🎉 Correct!","👏 Great job!","💡 You got it!","🥳 Woohoo!"][Math.floor(Math.random()*5)];},
  getWrongFeedback(num){return`💡 ${num} is ${num}${this.getSuffix(num)} — try again!`;},

  /* ── Hint floater ────────────────────────────────────────── */
  spawnHintFloater(num,x,y){this.floatNumbers.push({text:`${num}${this.getSuffix(num)}`,x,y,vy:-0.06,alpha:1,life:1400,maxLife:1400});},
  updateFloatNumbers(delta){
    for(let i=this.floatNumbers.length-1;i>=0;i--){
      const f=this.floatNumbers[i];f.y+=f.vy*delta;f.life-=delta;f.alpha=Math.max(0,f.life/f.maxLife);
      if(f.life<=0){
        this.floatNumbers[i]=this.floatNumbers[this.floatNumbers.length-1];
        this.floatNumbers.pop();
      }
    }
  },
  drawFloatNumbers(ctx){for(const f of this.floatNumbers){ctx.save();ctx.globalAlpha=f.alpha;ctx.fillStyle=this.T.wrong;ctx.font=`bold ${Math.round(38*this.scale)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.shadowColor=this.T.wrong;ctx.shadowBlur=12;ctx.fillText(f.text,f.x,f.y);ctx.restore();}},

  /* ── Merge animation ─────────────────────────────────────── */
  startPortalMerge(number){this.mode1MergeActive=true;this.mode1MergeData={number,suffix:this.mode1TargetSuffix,angle:0,radius:80*this.scale,time:0,duration:800,scale:1};},
  updateMode1Merge(delta){
    if(!this.mode1MergeActive)return;
    const m=this.mode1MergeData;
    m.time+=delta;
    const p=m.time/m.duration;
    if(p<0.45)m.angle+=0.009*delta;
    else if(p<0.78){m.angle+=0.017*delta;m.radius*=Math.pow(0.994,delta);}
    else{m.radius*=Math.pow(0.978,delta);m.scale*=Math.pow(0.992,delta);}
    if(p>=1){
      this.spawnSparkBurst(this.mascot.x,this.mascot.y);
      this.mode1MergeActive=false;
      this.mode1CorrectCollected++;

      const remainingCorrect = this.mode1Numbers.filter(
        n => this.getSuffix(n.number) === this.mode1TargetSuffix
      ).length;

      if(this.mode1CorrectCollected >= this.mode1CorrectTotal || remainingCorrect === 0){
        this.startMode1Confirmation();
      }
    }
  },
  drawMode1Merge(ctx){
    if(!this.mode1MergeActive)return;const m=this.mode1MergeData;
    const x=this.mascot.x+Math.cos(m.angle)*m.radius,y=this.mascot.y+Math.sin(m.angle)*m.radius;
    ctx.save();ctx.translate(x,y);ctx.scale(m.scale,m.scale);ctx.shadowColor=this.T.correct;ctx.shadowBlur=28;ctx.fillStyle="#ffffff";ctx.font=`bold ${Math.round(60*this.scale)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(`${m.number}${m.suffix}`,0,0);ctx.restore();
  },

  /* ── Round confirmation ──────────────────────────────────── */
  startMode1Confirmation() {
    this.mode1RoundActive = false;
    this.mode1Confirming = true;
    // Portal stays exactly where it is — hold in place for the reward animation
    this.mode1ConfirmTimer = 1400;
    this.mode1PortalTargetX = this.CENTER_X;
    this.mode1PortalTargetY = this.CENTER_Y;
    this.startRoundReward();
  },
  startRoundReward(){
    this.roundRewardActive=true;this.roundRewardTimer=1600;this.roundRewardStars=[];
    for(let i=0;i<18;i++){const ang=(Math.PI*2/18)*i;this.roundRewardStars.push({angle:ang,radius:0,speed:(2.5+Math.random()*2)*0.055,size:(8+Math.random()*8)*this.scale,color:["#fbbf24","#34d399","#a78bfa","#f472b6"][Math.floor(Math.random()*4)]});}
  },
  updateRoundReward(delta){if(!this.roundRewardActive)return;this.roundRewardTimer-=delta;for(const s of this.roundRewardStars)s.radius+=s.speed*delta;if(this.roundRewardTimer<=0)this.roundRewardActive=false;},
  /* ── Round reward draw ────────────────────────────────────── */
  drawRoundReward(ctx) {
    if (!this.roundRewardActive) return;
    const px = this.CENTER_X, py = this.CENTER_Y;
    const lf = Math.max(0, this.roundRewardTimer / 1600);

    for (const s of this.roundRewardStars) {
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
      const a = Math.sin(prog * Math.PI);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(px, py);
      ctx.scale(0.7 + a * 0.4, 0.7 + a * 0.4);
      ctx.fillStyle = this.T.correct;
      ctx.font = `bold ${Math.round(56 * this.scale)}px 'Fredoka',cursive`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = this.T.correct;
      ctx.shadowBlur = 20;
      ctx.fillText("⭐ Round Clear!", 0, 0);
      ctx.restore();
    }
  },
  /* ── Level progression ──────────────────────────────────── */
  startNewRound() {
    this.roundsCompleted++;
    this._roundsInLevel = (this._roundsInLevel || 0) + 1;

    if (this._levelRoundTarget === undefined) {
      this._levelRoundTarget = this._pickLevelRoundTarget();
    }

    if (this._roundsInLevel >= this._levelRoundTarget) {
      this.level++;
      this._roundsInLevel = 0;
      this._levelRoundTarget = this._pickLevelRoundTarget();
      this.numberRange = this._getNumberRangeForLevel(this.level);
      this.showToast(`🎮 Level ${this.level}! Numbers get bigger!`, this.T.streakColor);
    }

    const s = ["st", "nd", "rd", "th"];
    this.mode1TargetSuffix = s[Math.floor(Math.random() * 4)];
    this.spawnMode1Numbers();
  },

  _getNumberRangeForLevel(level) {
    const table = [10, 20, 30, 50, 70, 100];
    if (level - 1 < table.length) return table[level - 1];
    return 100 + (level - table.length) * 30;
  },

  _pickLevelRoundTarget() {
    return 3 + Math.floor(Math.random() * 3);
  },

  /* ── Number break ────────────────────────────────────────── */
  startNumberBreak(number){
    const px=this.mascot.x,py=this.mascot.y;this.mode1BreakActive=true;this.mode1BreakData={number,x:px,y:py,pieces:[],time:0};
    for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,v=(Math.random()*5+2)*0.055;this.mode1BreakData.pieces.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*Math.PI,vr:(Math.random()-0.5)*0.014,alpha:1});}
  },
  updateMode1Break(delta){
    if(!this.mode1BreakActive)return;const b=this.mode1BreakData;b.time+=delta;
    for(const p of b.pieces){p.x+=p.vx*delta;p.y+=p.vy*delta;p.vx*=Math.pow(0.996,delta);p.vy*=Math.pow(0.996,delta);p.rot+=p.vr*delta;p.alpha=Math.max(0,1-b.time/700);}
    if(b.time>700)this.mode1BreakActive=false;
  },
  drawMode1Break(ctx){
    if(!this.mode1BreakActive)return;
    for(const p of this.mode1BreakData.pieces){ctx.save();ctx.globalAlpha=p.alpha;ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=this.T.wrong;ctx.font=`bold ${Math.round(40*this.scale)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(this.mode1BreakData.number,0,0);ctx.restore();}
    ctx.globalAlpha=1;
  },

  /* ── Black hole ──────────────────────────────────────────── */
  startBlackHoleCollapse(){this.blackHoleActive=true;this.blackHoleTime=0;this.blackHoleStrength=0;this.accretionAngle=0;},
  updateBlackHole(delta){
    this.accretionAngle+=(0.04+(this.blackHoleStrength||0)*0.004)*delta*0.05;
    if(!this.blackHoleActive)return;
    this.blackHoleTime+=delta;const prog=this.blackHoleTime/this.blackHoleDuration;this.blackHoleStrength=prog*20;
    const cx=this.mascot.x,cy=this.mascot.y;
    for(const s of this.stars){const dx=cx-s.x,dy=cy-s.y,d=Math.hypot(dx,dy)+0.1,f=0.0012*this.blackHoleStrength*delta;s.x+=(dx/d)*f*d+(-dy/d)*f*0.7*d;s.y+=(dy/d)*f*d+(dx/d)*f*0.7*d;}
    for(const n of this.mode1Numbers){const dx=cx-n.x,dy=cy-n.y,f=0.0022*this.blackHoleStrength*delta;n.x+=dx*f;n.y+=dy*f;n.renderScale=(n.renderScale||1)*Math.pow(0.9985,delta);n.renderRotation=(n.renderRotation||0)+0.022*delta;}
    if(prog>=1){this.blackHoleActive=false;this.mode1GameOver=true;}
  },
  drawBlackHole(ctx){
    if(!this.blackHoleActive)return;const px=this.mascot.x,py=this.mascot.y;const r=(100+Math.sin(performance.now()*0.018)*18)*this.scale;
    ctx.save();ctx.translate(px,py);ctx.rotate(this.accretionAngle);
    const disk=ctx.createRadialGradient(0,0,r*0.28,0,0,r*1.15);
    disk.addColorStop(0,"rgba(0,0,0,0)");disk.addColorStop(0.38,"rgba(255,180,60,0.55)");disk.addColorStop(0.74,"rgba(255,80,0,0.72)");disk.addColorStop(1,"rgba(180,0,120,0)");
    ctx.fillStyle=disk;ctx.beginPath();ctx.ellipse(0,0,r*1.15,r*0.36,0,0,Math.PI*2);ctx.fill();ctx.restore();
    const core=ctx.createRadialGradient(px,py,8,px,py,r);
    core.addColorStop(0,"#000");core.addColorStop(0.5,"#050505");core.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=core;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
    const msgs=["🌀 Uh oh!","⚠️ Collapsing!","💀 Oh no!"];
    ctx.globalAlpha=Math.min(1,this.blackHoleTime/400);ctx.fillStyle="#fbbf24";
    ctx.font=`bold ${Math.round(44*this.scale)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(msgs[Math.floor(this.blackHoleTime/900)%msgs.length],px,py-r-28*this.scale);ctx.globalAlpha=1;
  },

  /* ── Big Bang ────────────────────────────────────────────── */
  startBigBang(){
    this.bigBangActive=true;this.bigBangTime=0;this.bigBangFlash=1;
    for(const s of this.stars){const a=Math.random()*Math.PI*2,v=(Math.random()*7+3)*0.065;s.x=this.CENTER_X;s.y=this.CENTER_Y;s.vx=Math.cos(a)*v;s.vy=Math.sin(a)*v;}
  },
  updateBigBang(delta){
    if(!this.bigBangActive)return;this.bigBangTime+=delta;const p=this.bigBangTime/this.bigBangDuration;
    for(const s of this.stars)if(s.vx!==undefined){s.x+=s.vx*delta;s.y+=s.vy*delta;s.vx*=Math.pow(0.998,delta);s.vy*=Math.pow(0.998,delta);}
    this.bigBangFlash=Math.max(0,1-p*2.2);if(p>=1){this.bigBangActive=false;this.initStarfield();}
  },
  drawBigBangFlash(ctx){if(this.bigBangFlash<=0)return;ctx.fillStyle=`rgba(255,255,255,${this.bigBangFlash})`;ctx.fillRect(0,0,this.cssWidth,this.cssHeight);},

  /* ── Particles ───────────────────────────────────────────── */
  spawnCorrectParticles(x,y){const cols=["#34d399","#fbbf24","#a78bfa","#ffffff"];for(let i=0;i<20;i++){if(this.particles.length>=this.MAX_PARTICLES)break;const a=Math.random()*Math.PI*2,v=(Math.random()*6+3)*0.055;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color:cols[i%cols.length],size:(Math.random()*5+3)*this.scale,life:700,maxLife:700,type:"star"});}},
  spawnWrongParticles(x,y){for(let i=0;i<12;i++){if(this.particles.length>=this.MAX_PARTICLES)break;const a=Math.random()*Math.PI*2,v=(Math.random()*4+2)*0.055;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color:"#f87171",size:(Math.random()*4+2)*this.scale,life:500,maxLife:500,type:"circle"});}},
  updateParticles(delta){
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.x+=p.vx*delta;p.y+=p.vy*delta;const fric=1-(1-0.994)*delta/16;p.vx*=fric;p.vy*=fric;p.vy+=0.00007*delta;p.life-=delta;
      if(p.life<=0){
        this.particles[i]=this.particles[this.particles.length-1];
        this.particles.pop();
      }
    }
  },
  drawParticles(ctx){for(const p of this.particles){ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;if(p.type==="star")this._star(ctx,p.x,p.y,p.size,5);else{ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;},
  _star(ctx,x,y,r,pts){ctx.save();ctx.translate(x,y);ctx.beginPath();for(let i=0;i<pts*2;i++){const a=(Math.PI/pts)*i-Math.PI/2,rr=i%2===0?r:r*0.44;i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.restore();},

  /* ── Spark bursts ────────────────────────────────────────── */
  spawnSparkBurst(x,y){
    if(this.sparkBursts.length<this.MAX_SPARKS)this.sparkBursts.push({x,y,radius:0,maxRadius:130*this.scale,alpha:1,life:550,maxLife:550});
    for(let i=0;i<16;i++){if(this.sparkBursts.length>=this.MAX_SPARKS)break;const a=Math.random()*Math.PI*2,v=(Math.random()*9+3)*0.055;this.sparkBursts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,size:(Math.random()*4+2)*this.scale,life:480,maxLife:480,type:"p"});}
  },
  updateSparkBursts(delta){
    for(let i=this.sparkBursts.length-1;i>=0;i--){
      const s=this.sparkBursts[i];s.life-=delta;
      if(s.type==="p"){s.x+=s.vx*delta;s.y+=s.vy*delta;const fric=1-(1-0.993)*delta/16;s.vx*=fric;s.vy*=fric;}
      else{s.radius=s.maxRadius*(1-s.life/s.maxLife);s.alpha=Math.max(0,s.life/s.maxLife);}
      if(s.life<=0){
        this.sparkBursts[i]=this.sparkBursts[this.sparkBursts.length-1];
        this.sparkBursts.pop();
      }
    }
  },
  drawSparkBursts(ctx){for(const s of this.sparkBursts){if(s.type==="p"){ctx.globalAlpha=Math.max(0,s.life/s.maxLife);ctx.fillStyle=this.T.correct;ctx.beginPath();ctx.arc(s.x,s.y,s.size,0,Math.PI*2);ctx.fill();}else{ctx.globalAlpha=Math.max(0,s.alpha);ctx.strokeStyle=this.T.correct;ctx.lineWidth=5*this.scale;ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,Math.PI*2);ctx.stroke();}}ctx.globalAlpha=1;},

  /* ── HUD ─────────────────────────────────────────────────── */
  updateHUDTimers(delta){if(this.heartShakeTime>0)this.heartShakeTime=Math.max(0,this.heartShakeTime-delta);if(this.streakPulse>0)this.streakPulse=Math.max(0,this.streakPulse-delta*0.003);},
  drawHUD(ctx) {
    const T=this.T,s=this.scale,W=this.cssWidth,H=this.cssHeight;
    
    // Top-Left Score Display Box
    const sw=175*s,sh=54*s,sx=18*s,sy=16*s;
    ctx.fillStyle=T.scoreBg;this._rrect(ctx,sx,sy,sw,sh,18*s);ctx.fill();
    ctx.fillStyle=T.numberColor;ctx.font=`bold ${Math.round(26*s)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(`⭐ ${this.score}`,sx+sw/2,sy+sh/2);

    // Top-Right Hearts
    const hSz=32*s,hGap=8*s,totalHW=this.maxHearts*(hSz+hGap)-hGap;
    const hx0=W-18*s-totalHW,hy0=18*s,shk=this.heartShakeTime>0?Math.sin(this.heartShakeTime*0.055)*5*s:0;
    for(let i=0;i<this.maxHearts;i++){ctx.globalAlpha=i<this.hearts?1:0.2;ctx.font=`${Math.round(hSz)}px serif`;ctx.textAlign="left";ctx.textBaseline="top";ctx.fillText("❤️",hx0+i*(hSz+hGap),hy0+(i<this.hearts?shk:0));}
    ctx.globalAlpha=1;

    // Top-Left Streak Counter (position matching Game 9)
    if(this.streak>=2){
      const ps=1+this.streakPulse*0.15;
      const streakY=sy+sh+12*s;
      ctx.save();
      ctx.translate(sx+sw/2, streakY);
      ctx.scale(ps,ps);
      ctx.globalAlpha=0.9+this.streakPulse*0.1;
      ctx.fillStyle=T.streakColor;
      ctx.font=`bold ${Math.round(18*s)}px 'Fredoka',cursive`;
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.shadowColor=T.streakColor;ctx.shadowBlur=8;
      ctx.fillText(`🔥 ${this.streak} in a row!`,0,0);
      ctx.shadowBlur=0;
      ctx.restore();
    }

    // Bottom Level Tracker Badge
    const lw=200*s,lh=40*s,lx=W/2-lw/2,ly=H-58*s;
    ctx.fillStyle=T.scoreBg;this._rrect(ctx,lx,ly,lw,lh,13*s);ctx.fill();
    ctx.fillStyle=T.textAccent;ctx.font=`bold ${Math.round(18*s)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(`Level ${this.level}  ·  ${this.roundsCompleted} round${this.roundsCompleted!==1?"s":""}`,lx+lw/2,ly+lh/2);
  },

  drawInstruction(ctx) {
    if(this.mode1GameOver||this.blackHoleActive)return;
    const T=this.T,s=this.scale,W=this.cssWidth;
    const suf=this.mode1TargetSuffix,maxW=Math.min(W-44*s,700*s),bh=48*s,bx=W/2-maxW/2,by=20*s;
    ctx.fillStyle=T.cardBg;
    ctx.beginPath(); this._rrectPath(ctx,bx,by,maxW,bh,13*s); ctx.fill();
    ctx.strokeStyle=T.cardBorder;ctx.lineWidth=1.5*s;
    ctx.beginPath(); this._rrectPath(ctx,bx,by,maxW,bh,13*s); ctx.stroke();
    ctx.fillStyle=T.textPrimary;ctx.font=`bold ${Math.round(19*s)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(`You are the ${suf.toUpperCase()} Galaxy! Collect numbers ending in "${suf}"`,W/2,by+bh/2);
  },

  /* ── Toast ───────────────────────────────────────────────── */
  showToast(text,color){this.toast={text,color,timer:1600,maxTimer:1600,y:this.CENTER_Y-220*this.scale,alpha:1};},
  updateToast(delta){if(this.toast.timer<=0)return;this.toast.timer-=delta;this.toast.alpha=Math.min(1,this.toast.timer/350);this.toast.y-=0.022*delta;},
  drawToast(ctx){if(this.toast.timer<=0||this.toast.alpha<=0)return;ctx.save();ctx.globalAlpha=this.toast.alpha;ctx.fillStyle=this.toast.color;ctx.font=`bold ${Math.round(36*this.scale)}px 'Fredoka',cursive`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.shadowColor=this.toast.color;ctx.shadowBlur=14;ctx.fillText(this.toast.text,this.CENTER_X,this.toast.y);ctx.restore();},

  /* ── Game over ───────────────────────────────────────────── */
  drawGameOver(ctx) {
    if(!this.mode1GameOver)return;const W=this.cssWidth,H=this.cssHeight,s=this.scale;
    ctx.fillStyle="rgba(0,0,0,0.78)";ctx.fillRect(0,0,W,H);
    const cw=Math.min(Math.max(W*0.52,320*s),620*s),ch=290*s,cx=W/2-cw/2,cy=H/2-ch/2;
    ctx.fillStyle="rgba(18,12,46,0.97)";this._rrect(ctx,cx,cy,cw,ch,24*s);ctx.fill();
    ctx.strokeStyle=this.T.wrong;ctx.lineWidth=3*s;this._rrect(ctx,cx,cy,cw,ch,24*s);ctx.stroke();
    const mx=W/2;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle=this.T.wrong;ctx.font=`bold ${Math.round(Math.min(50*s,50))}px 'Fredoka',cursive`;ctx.shadowColor=this.T.wrong;ctx.shadowBlur=14;ctx.fillText("💥 Oops! Try Again!",mx,cy+ch*0.24);ctx.shadowBlur=0;
    ctx.fillStyle=this.T.textPrimary;ctx.font=`bold ${Math.round(Math.min(28*s,28))}px 'Fredoka',cursive`;ctx.fillText(`⭐ Score: ${this.score}   |   🔥 Best Streak: ${this.bestStreak}`,mx,cy+ch*0.52);
    const pulse=0.82+Math.sin(performance.now()*0.004)*0.18;ctx.globalAlpha=pulse;ctx.fillStyle=this.T.correct;ctx.font=`bold ${Math.round(Math.min(24*s,24))}px 'Fredoka',cursive`;ctx.fillText("👆 Tap anywhere to rebuild the galaxy!",mx,cy+ch*0.8);ctx.globalAlpha=1;
  },

  retryMode1(){
    this._noHandDuration = 0;
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
      pauseBtn.style.display = "none";
      pauseBtn.style.opacity = "0";
    }

    this.mode1GameOver=false;this.hearts=3;this.streak=0;this.score=0;this.level=1;this.numberRange=10;this.roundsCompleted=0;
    this.particles=[];this.sparkBursts=[];this.floatNumbers=[];this.shootingStars=[];this.heartShakeTime=0;this.streakPulse=0;
    const s=["st","nd","rd","th"];this.mode1TargetSuffix=s[Math.floor(Math.random()*4)];
    this.startBigBang();this.spawnMode1Numbers();
  },

  /* ── Utility ─────────────────────────────────────────────── */
  // Path-only builder (no beginPath) so callers that fill+stroke the same
  // shape don't have to rebuild the rounded-rect path twice.
  _rrectPath(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();},
  _rrect(ctx,x,y,w,h,r){ctx.beginPath();this._rrectPath(ctx,x,y,w,h,r);},
};