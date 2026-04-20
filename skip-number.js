/* ============================================================
   skip-number.js  (Game1) — v3
   Changes vs v2:
   • Tutorial state built into the game — no tutorial.js dependency
   • Event listeners registered ONCE via _listenersAttached guard
   • Resize is debounced and only re-layouts — never resets score
   • No-finger prompt drawn on the game canvas, zero extra DOM
   • Hold-to-start reads window.fingerPositions directly
   • spawnInterval starts at 2000ms (doc6 values)
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
  tierNames:      ["Sprout 🌱","Star ⭐","Champ 🏆","Legend 🌟"],
  tierColors:     ["#6de8b4","#f5c842","#e8a06d","#c084fc"],
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

  /* ── Tutorial state ─────────────────────────────────────── */
  gameState: "tutorial",   // "tutorial" | "playing"
  _pendingMode: "default", // set before init, consumed after tutorial
  _tutHoldProgress: 0,     // 0..1 over 3 seconds
  _tutEnterAnim: 0,        // 0..1 fade-in
  _tutOrbT: 0,             // time for animated visuals
  _tutPulseT: 0,
  _tutStars: [],
  _tutNoFingerFrames: 0,
  _tutNoFingerThreshold: 90, // ~1.5s at 60fps
  HOLD_SEC: 3.0,

  /* ── Tutorial mode data ─────────────────────────────────── */
  _TMODES: {
    default: {
      title:"SKIP MODE", icon:"⟳", color:"#6de8b4",
      tagline:"Like Mario coins — only collect every Nth one!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"🎯",text:"Numbers fly in from the ring toward center"},
        {icon:"✅",text:"Touch ONLY multiples (e.g. 3, 6, 9 for Skip 3)"},
        {icon:"❌",text:"Wrong touch = lost points + speed penalty"},
        {icon:"🔥",text:"5-combo streak multiplies your score!"},
      ], visual:"skip",
    },
    pattern: {
      title:"PATTERN MODE", icon:"◈", color:"#8ecae6",
      tagline:"Like Guitar Hero — hit the right notes in rhythm!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"🎶",text:"Numbers appear in a repeating skip-collect cycle"},
        {icon:"⏭️",text:"SKIP a set, then COLLECT a set — repeat"},
        {icon:"🧠",text:"E.g. Skip 2, Collect 3 → ✗✗✓✓✓ then repeat"},
        {icon:"⚡",text:"Pattern resets every cycle — stay sharp!"},
      ], visual:"pattern",
    },
    cannon: {
      title:"CANNON MODE", icon:"▲", color:"#f5c842",
      tagline:"Like Space Invaders — zap right ones before escape!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"💥",text:"The cannon fires numbers across the screen"},
        {icon:"✅",text:"Touch correct multiples before they fly off"},
        {icon:"🚀",text:"Wrong touch = combo reset + speed penalty"},
        {icon:"⚠️",text:"Correct number escaping = score deduction!"},
      ], visual:"cannon",
    },
    orb: {
      title:"ORB MODE", icon:"◉", color:"#c084fc",
      tagline:"Like Metroid — intercept numbers mid-flight!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"🌀",text:"A spinning orb launches numbers outward"},
        {icon:"🎯",text:"Intercept the correct numbers as they fly past"},
        {icon:"💜",text:"Orb rotates to aim — anticipate direction"},
        {icon:"⚡",text:"Precision matters — react fast!"},
      ], visual:"orb",
    },
    triple: {
      title:"TRIPLE CANNON", icon:"⟁", color:"#e87c6d",
      tagline:"Like Galaga with 3 ships — pure chaos, total skill!",
      rules:[
        {icon:"👆",text:"Your index finger IS the green dot on screen"},
        {icon:"🔴",text:"THREE cannons fire in random order"},
        {icon:"👀",text:"Gold glow = that cannon fires next"},
        {icon:"🎯",text:"Intercept correct numbers from all directions"},
        {icon:"🌀",text:"Number paths cross — stay focused!"},
      ], visual:"triple",
    },
  },

  /* ============================================================
     INIT
  ============================================================ */
  init() {
    const rect = document.getElementById("container").getBoundingClientRect();
    this._applyResize(rect.width, rect.height);

    this.notes = [];
    this.popEffects = [];
    this.explosions = [];
    this.missQueue = [];
    this.levelUpParticles = [];
    this.chargeParticles = [];

    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.hitTextTimer = 1;
    this.currentNumber = 1;
    this.xp = 0;
    this.xpToNext = 8;
    this.level = 1;
    this.tier = 0;
    this.levelUpActive = false;
    this.xpPopFlash = 0;
    this.hintState = "full";
    this.noiseTime = 0;
    this.spawnInterval = 1800;
    this.torusAngle = 0;

    this.mode      = "default";
    this.skipAmount = this.getRandomSkip();
    this.gameTitle  = "SKIP " + this.skipAmount;
    this.noteSpeed  = this.speedCap;

    this.orbImage = new Image();
    this.orbImage.src = "orb1.png";

    this._initBgStars();

    // Tutorial reset
    this.gameState       = "tutorial";
    this._tutHoldProgress = 0;
    this._tutEnterAnim   = 0;
    this._tutOrbT        = 0;
    this._tutPulseT      = 0;
    this._tutNoFingerFrames = 0;
    this._initTutStars();

    // Register listeners ONCE for the lifetime of the page
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
      window.addEventListener("keydown", (e) => {
        if (e.key === "1") this._setMode("pattern");
        if (e.key === "2") this._setMode("cannon");
        if (e.key === "3") this._setMode("orb");
        if (e.key === "4") this._setMode("triple");
      });
    }
  },

  /* ── Resize — layout only, never resets gameplay ────────── */
  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this._applyResize(w, h);
    // Only rebuild stars — never touch score/combo/notes
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
    this.speedCap = this.baseOuterRadius * 0.3;
    this.speedMin = this.speedCap * 0.15;
    if (!this.noteSpeed || this.noteSpeed > this.speedCap) this.noteSpeed = this.speedCap;
    this.launcherSafeRadius = this.baseOuterRadius * 0.45;
  },

  /* ── Mode switching (used by keys + ModeSelector result) ── */
  _setMode(modeKey) {
    if (this.gameState === "tutorial") {
      // Switching mode while tutorial is showing — restart tutorial for new mode
      this._pendingMode = modeKey;
      this._tutHoldProgress = 0;
      this._tutEnterAnim = 0;
      this._tutOrbT = 0;
    } else {
      // Mid-game switch (key press)
      switch (modeKey) {
        case "pattern": this.activatePatternMode();      break;
        case "cannon":  this.activateCannonMode();       break;
        case "orb":     this.activateOrbMode();          break;
        case "triple":  this.activateTripleCannonMode(); break;
        default: break;
      }
    }
  },

  /* Called from main.js after ModeSelector resolves */
  setModeBeforeStart(modeKey) {
    this._pendingMode = modeKey || "default";
  },

  /* ── Transition from tutorial → playing ─────────────────── */
  _startPlaying() {
    this.gameState = "playing";
    const m = this._pendingMode || "default";
    switch (m) {
      case "pattern": this.activatePatternMode();      break;
      case "cannon":  this.activateCannonMode();       break;
      case "orb":     this.activateOrbMode();          break;
      case "triple":  this.activateTripleCannonMode(); break;
      default: this._restartSpawnTimer(); break;
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
     TUTORIAL — main draw (called from update when gameState === "tutorial")
  ============================================================ */
  _updateTutorial(ctx, fingers, dt) {
    this._tutEnterAnim  = Math.min(1, this._tutEnterAnim + dt * 2);
    this._tutOrbT      += dt;
    this._tutPulseT    += dt * 1.8;

    const alpha  = 1 - Math.pow(1 - Math.max(0, Math.min(1, this._tutEnterAnim)), 3);
    const W = this.centerX * 2, H = this.centerY * 2;
    const pal = this.C;
    const td  = this._TMODES[this._pendingMode] || this._TMODES.default;
    const tColor = td.color;

    // ── Background
    const bg = ctx.createRadialGradient(this.centerX, this.centerY * 0.6, 0, this.centerX, H * 0.5, Math.max(W, H) * 0.75);
    bg.addColorStop(0, "#1a2d4a"); bg.addColorStop(0.5, "#0f1e35"); bg.addColorStop(1, "#080f1c");
    ctx.globalAlpha = alpha; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;

    for (const s of this._tutStars) {
      s.tw += s.ts;
      ctx.globalAlpha = alpha * Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.fillStyle = "#c8dff0";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = alpha;

    // ── Card
    const isMob = W < 540;
    const cardW = Math.min(W - 32, isMob ? 360 : 700);
    const cardH = Math.min(H - 60, isMob ? 580 : 540);
    const cardX = this.centerX - cardW / 2;
    const cardY = this.centerY - cardH / 2;
    const cR    = 20;
    const hr    = s => { const h = (s||"").replace("#",""); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return isNaN(r)?"140,180,220":`${r},${g},${b}`; };

    ctx.shadowColor = tColor; ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(8,18,36,0.96)";
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, cR); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${hr(tColor)},0.38)`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = `rgba(${hr(tColor)},0.16)`;
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, 56, [cR, cR, 0, 0]); ctx.fill();

    // Header
    ctx.font = `bold ${isMob?22:28}px 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = tColor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = tColor; ctx.shadowBlur = 14;
    ctx.fillText(td.icon + "  " + td.title, this.centerX, cardY + 28); ctx.shadowBlur = 0;

    ctx.font = `${isMob?12:14}px 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = "rgba(240,244,255,0.68)";
    ctx.fillText(td.tagline, this.centerX, cardY + 58);

    // Visual box
    const visX = cardX + 12, visY = cardY + 76;
    const visW = isMob ? cardW - 24 : cardW * 0.42;
    const visH = isMob ? 130 : cardH - 200;
    ctx.fillStyle = "rgba(8,16,36,0.68)";
    ctx.beginPath(); ctx.roundRect(visX, visY, visW, visH, 12); ctx.fill();
    ctx.strokeStyle = `rgba(${hr(tColor)},0.14)`; ctx.lineWidth = 1; ctx.stroke();
    this._drawTutVisual(ctx, td.visual, visX, visY, visW, visH, this._tutOrbT, tColor);

    // Rules
    const rulesX = isMob ? cardX + 12 : cardX + visW + 24;
    const rulesY = isMob ? visY + visH + 10 : cardY + 76;
    const rulesW = isMob ? cardW - 24 : cardW - visW - 36;
    const rowH   = isMob ? 34 : 42;
    for (let i = 0; i < td.rules.length; i++) {
      const rule = td.rules[i];
      const prog = Math.max(0, Math.min(1, (this._tutEnterAnim - i * 0.08) / 0.6));
      const ea   = 1 - Math.pow(1 - prog, 3);
      ctx.globalAlpha = alpha * ea;
      ctx.fillStyle = i % 2 === 0 ? "rgba(20,40,70,0.45)" : "rgba(10,24,44,0.3)";
      ctx.beginPath(); ctx.roundRect(rulesX, rulesY + i * rowH, rulesW, rowH - 4, 8); ctx.fill();
      ctx.font = `${isMob?15:17}px 'Trebuchet MS', sans-serif`; ctx.fillStyle = "#f0f4ff";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(rule.icon, rulesX + 10, rulesY + i * rowH + rowH / 2 - 2);
      ctx.font = `${isMob?11:13}px 'Trebuchet MS', sans-serif`; ctx.fillStyle = "rgba(240,244,255,0.85)";
      ctx.fillText(rule.text, rulesX + 36, rulesY + i * rowH + rowH / 2 - 2);
    }
    ctx.globalAlpha = alpha;

    // ── Hold section
    const holdY = cardY + cardH - (isMob ? 82 : 86);
    ctx.strokeStyle = `rgba(${hr(tColor)},0.15)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cardX + 20, holdY - 6); ctx.lineTo(cardX + cardW - 20, holdY - 6); ctx.stroke();

    const hasFing = fingers.length > 0;
    if (hasFing) {
      this._tutHoldProgress = Math.min(1, this._tutHoldProgress + dt / this.HOLD_SEC);
      if (this._tutHoldProgress >= 1) {
        // Trigger game start after a brief flash
        ctx.globalAlpha = 1;
        this._startPlaying();
        return;
      }
    } else {
      this._tutHoldProgress = Math.max(0, this._tutHoldProgress - dt * 0.5);
    }

    if (!hasFing) {
      const blink = Math.sin(this._tutPulseT * 3) > 0;
      ctx.font = `bold ${isMob?13:15}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = blink ? "#f5c842" : "rgba(245,200,66,0.55)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#f5c842"; ctx.shadowBlur = blink ? 12 : 0;
      ctx.fillText("☝ Raise your index finger to the camera", this.centerX, holdY + 18); ctx.shadowBlur = 0;
      ctx.font = `${isMob?11:13}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = "rgba(142,202,230,0.65)";
      ctx.fillText("Hold still for 3 seconds to start playing", this.centerX, holdY + 40);
    } else {
      const pct = Math.round(this._tutHoldProgress * 100);
      ctx.font = `bold ${isMob?13:15}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = tColor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = tColor; ctx.shadowBlur = 10;
      ctx.fillText(`Hold still... ${pct}%`, this.centerX, holdY + 16); ctx.shadowBlur = 0;
      const barW = cardW * 0.6, barH = 8;
      const barX = this.centerX - barW / 2, barY = holdY + 34;
      ctx.fillStyle = "rgba(20,40,70,0.8)";
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();
      ctx.fillStyle = tColor; ctx.shadowColor = tColor; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * this._tutHoldProgress, barH, 4); ctx.fill(); ctx.shadowBlur = 0;
    }

    // ── Finger dot (drawn on tutorial canvas directly)
    if (hasFing) {
      const fx = fingers[0].x, fy = fingers[0].y;
      const FING_R = 28;
      // Hold ring
      ctx.beginPath(); ctx.arc(fx, fy, FING_R + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${hr(tColor)},0.18)`; ctx.lineWidth = 5; ctx.stroke();
      if (this._tutHoldProgress > 0.01) {
        ctx.beginPath(); ctx.arc(fx, fy, FING_R + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this._tutHoldProgress);
        ctx.strokeStyle = tColor; ctx.lineWidth = 5;
        ctx.shadowColor = tColor; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
      }
      // Green dot
      ctx.beginPath(); ctx.arc(fx, fy, 22, 0, Math.PI * 2);
      ctx.shadowColor = "rgba(126,207,179,0.7)"; ctx.shadowBlur = 28;
      ctx.fillStyle = "rgba(94,180,150,0.45)"; ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy, 10, 0, Math.PI * 2);
      ctx.shadowBlur = 12; ctx.fillStyle = "#b0f0da"; ctx.fill(); ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
  },

  /* ── Tutorial visual mini-diagrams ─────────────────────── */
  _drawTutVisual(ctx, mode, px, py, pw, ph, t, tColor) {
    const hr = s => { const h=(s||"").replace("#",""); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return isNaN(r)?"140,180,220":`${r},${g},${b}`; };
    ctx.save(); ctx.translate(px, py);

    if (mode === "skip") {
      const r = Math.min(pw, ph) * 0.36;
      ctx.strokeStyle = "rgba(212,164,74,0.7)"; ctx.lineWidth = 3;
      ctx.shadowColor = this.C.gold; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(pw/2, ph/2, r, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = "rgba(126,207,179,0.35)"; ctx.lineWidth = 2; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(pw/2, ph/2, r*0.72, 0, Math.PI*2); ctx.stroke();
      const notes = [{a:0.4,d:1.0,v:3,c:true},{a:1.8,d:0.75,v:5,c:false},{a:3.5,d:0.9,v:6,c:true},{a:5.0,d:0.6,v:7,c:false}];
      for (const n of notes) {
        const pr = ((t*0.38+n.d)%1.0), dist = r*1.65*(1-pr*0.6);
        const nx=pw/2+Math.cos(n.a)*dist, ny=ph/2+Math.sin(n.a)*dist;
        ctx.beginPath(); ctx.arc(nx,ny,15,0,Math.PI*2);
        ctx.fillStyle=n.c?"#0e3028":"#2a1010"; ctx.shadowColor=n.c?this.C.correct:this.C.wrong; ctx.shadowBlur=12; ctx.fill();
        ctx.strokeStyle=n.c?this.C.correct:this.C.wrong; ctx.lineWidth=2; ctx.stroke(); ctx.shadowBlur=0;
        ctx.fillStyle="#f0f4ff"; ctx.font="bold 11px 'Trebuchet MS',sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(n.v,nx,ny);
      }
      ctx.beginPath(); ctx.arc(pw/2,ph/2,10,0,Math.PI*2);
      ctx.fillStyle="rgba(94,180,150,0.4)"; ctx.shadowColor=this.C.correct; ctx.shadowBlur=18; ctx.fill();
      ctx.beginPath(); ctx.arc(pw/2,ph/2,5,0,Math.PI*2); ctx.fillStyle="#b0f0da"; ctx.fill(); ctx.shadowBlur=0;
      this._tutFingerLegend(ctx, pw/2, ph-12);

    } else if (mode === "pattern") {
      const nums=[1,2,3,4,5,6,7,8], skip=2, collect=3, cycle=skip+collect;
      const bW=28,bH=28,gap=5,totalW=nums.length*(bW+gap)-gap;
      const sX=(pw-totalW)/2,bY=ph/2-8;
      for (let i=0;i<nums.length;i++) {
        const isC=(i%cycle)>=skip,bx=sX+i*(bW+gap);
        ctx.beginPath(); ctx.roundRect(bx,bY,bW,bH,5);
        ctx.fillStyle=isC?"#0e3028":"#0a1525"; ctx.fill();
        ctx.strokeStyle=isC?this.C.correct:"rgba(140,180,220,0.3)"; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle="#f0f4ff"; ctx.font="bold 11px 'Trebuchet MS',sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(nums[i],bx+bW/2,bY+bH/2);
      }
      ctx.font="10px 'Trebuchet MS',sans-serif"; ctx.textAlign="center";
      ctx.fillStyle="rgba(232,124,109,0.85)"; ctx.fillText("← SKIP 2 →",sX+(skip*(bW+gap))/2-gap/2,bY-11);
      ctx.fillStyle="rgba(109,232,180,0.85)"; ctx.fillText("← COLLECT 3 →",sX+skip*(bW+gap)+(collect*(bW+gap))/2-gap/2,bY-11);
      this._tutFingerLegend(ctx, pw/2, ph-12);

    } else if (mode === "cannon") {
      const cnx=pw/2,cny=ph/2+8,ang=-0.6+Math.sin(t*0.5)*0.3;
      ctx.beginPath(); ctx.arc(cnx,cny,20,0,Math.PI*2);
      ctx.fillStyle="#2a4a6e"; ctx.shadowColor=this.C.accent; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0;
      ctx.save(); ctx.translate(cnx,cny); ctx.rotate(ang-Math.PI/2);
      ctx.fillStyle="#3a6080"; ctx.beginPath(); ctx.roundRect(-7,-38,14,38,3); ctx.fill();
      ctx.strokeStyle=this.C.accent; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
      const flyT=(t*0.5)%1, fnx=cnx+Math.cos(ang)*(28+flyT*70), fny=cny+Math.sin(ang)*(28+flyT*70);
      ctx.beginPath(); ctx.arc(fnx,fny,14,0,Math.PI*2);
      ctx.fillStyle="#0e3028"; ctx.shadowColor=this.C.correct; ctx.shadowBlur=10; ctx.fill();
      ctx.strokeStyle=this.C.correct; ctx.lineWidth=2; ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle="#f0f4ff"; ctx.font="bold 11px 'Trebuchet MS',sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("6",fnx,fny);
      this._tutFingerLegend(ctx, pw/2, ph-4);

    } else if (mode === "orb") {
      const orx=pw/2,ory=ph/2,oA=t*0.8;
      const og=ctx.createRadialGradient(orx,ory,0,orx,ory,28);
      og.addColorStop(0,"rgba(192,132,252,0.5)"); og.addColorStop(1,"rgba(14,30,50,0)");
      ctx.fillStyle=og; ctx.beginPath(); ctx.arc(orx,ory,28,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(orx,ory,18,0,Math.PI*2);
      ctx.fillStyle="#1a3a5c"; ctx.shadowColor="#c084fc"; ctx.shadowBlur=14; ctx.fill();
      ctx.strokeStyle="#c084fc"; ctx.lineWidth=2; ctx.stroke(); ctx.shadowBlur=0;
      const sR=50+Math.sin(t*1.2)*14, snx=orx+Math.cos(oA)*sR, sny=ory+Math.sin(oA)*sR;
      ctx.beginPath(); ctx.arc(snx,sny,14,0,Math.PI*2);
      ctx.fillStyle="#0e3028"; ctx.shadowColor=this.C.correct; ctx.shadowBlur=10; ctx.fill();
      ctx.strokeStyle=this.C.correct; ctx.lineWidth=2; ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle="#f0f4ff"; ctx.font="bold 11px 'Trebuchet MS',sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("9",snx,sny);
      this._tutFingerLegend(ctx, pw/2, ph-12);

    } else if (mode === "triple") {
      const tcx=pw/2,tcy=ph/2,triR=Math.min(pw,ph)*0.28,gi=Math.floor(t*0.4)%3;
      for (let i=0;i<3;i++) {
        const a=(i/3)*Math.PI*2-Math.PI/2+t*0.18;
        const ox=tcx+Math.cos(a)*triR,oy=tcy+Math.sin(a)*triR,isG=i===gi;
        ctx.beginPath(); ctx.arc(ox,oy,13,0,Math.PI*2);
        ctx.fillStyle="#1a3a5c"; ctx.shadowColor=isG?this.C.gold:this.C.accent; ctx.shadowBlur=isG?16:8; ctx.fill(); ctx.shadowBlur=0;
        ctx.strokeStyle=isG?this.C.gold:"rgba(142,202,230,0.4)"; ctx.lineWidth=isG?2.5:1.5; ctx.stroke();
        if (isG) {
          const pulse=0.5+Math.sin(t*5)*0.3;
          ctx.strokeStyle=`rgba(245,200,66,${pulse})`; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(ox,oy,16+pulse*4,0,Math.PI*2); ctx.stroke();
        }
      }
      ctx.font="10px 'Trebuchet MS',sans-serif"; ctx.fillStyle=this.C.gold; ctx.textAlign="center";
      ctx.fillText("✦ glowing = fires next",pw/2,ph-14);
      this._tutFingerLegend(ctx, pw/2, ph-4);
    }
    ctx.restore();
  },

  _tutFingerLegend(ctx, x, y) {
    ctx.beginPath(); ctx.arc(x-46,y,8,0,Math.PI*2); ctx.fillStyle="rgba(94,180,150,0.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x-46,y,4,0,Math.PI*2); ctx.fillStyle="#b0f0da"; ctx.fill();
    ctx.fillStyle="rgba(140,180,220,0.65)"; ctx.font="11px 'Trebuchet MS',sans-serif";
    ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.fillText("= your index finger",x-36,y);
  },

  /* ── No-finger in-game prompt (drawn on canvas) ─────────── */
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
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh/2); ctx.fill();
    ctx.strokeStyle = blink ? "#f5c842" : "rgba(245,200,66,0.4)";
    ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#f5c842"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(copy, W / 2, by + bh / 2);
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     SPAWN TIMER
  ============================================================ */
  _restartSpawnTimer() {
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    this.spawnTimer = setInterval(() => {
      if (this.gameState !== "playing") return;
      if      (this.mode === "cannon") this.spawnCannonNote();
      else if (this.mode === "orb")    this.spawnOrbNote();
      else if (this.mode === "triple") this.spawnTripleNote();
      else                             this.spawnNote();
    }, this.spawnInterval);
  },

  /* ============================================================
     ADAPTIVE SPEED
  ============================================================ */
  _penalizeSpeed() { this.noteSpeed = Math.max(this.speedMin, this.noteSpeed - this.speedCap * this.speedPenaltyStep); },
  _recoverSpeed()  { this.noteSpeed = Math.min(this.speedCap, this.noteSpeed + this.speedCap * this.speedRecoveryStep); },
  _driftSpeed(dt) {
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

  _drawBg(ctx) {
    const W = this.centerX * 2, H = this.centerY * 2;
    const g = ctx.createRadialGradient(this.centerX, this.centerY * 0.6, 0, this.centerX, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, "#1a2d4a"); g.addColorStop(0.5, "#0f1e35"); g.addColorStop(1, "#080f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },

  _drawBgStars(ctx) {
    for (const s of this.bgStars) {
      s.tw += s.ts;
      ctx.globalAlpha = Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.fillStyle = "#c8dff0";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     LEVEL / XP
  ============================================================ */
  _gainXP(amount) {
    if (this.level >= this.maxLevel) return;
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.xp = 0; this.level++;
      this.xpToNext = Math.min(8 + this.level * 2, 25);
      this.xpPopFlash = 1;
      for (let t = this.tierThresholds.length - 1; t >= 0; t--) {
        if (this.level >= this.tierThresholds[t]) { this.tier = Math.max(this.tier, t); break; }
      }
      this._updateHintState();
      if (this.level % 3 === 0) {
        this.spawnInterval = Math.max(1000, this.spawnInterval - 40
        );
        this._restartSpawnTimer();
      }
      this._triggerLevelUpBurst();
    }
  },

  _updateHintState() {
    const lv = this.level, prev = this.hintState;
    if      (lv <= 3)  this.hintState = "full";
    else if (lv <= 5)  this.hintState = "subtle";
    else if (lv <= 8)  this.hintState = "none";
    else if (lv <= 11) this.hintState = "decoy";
    else               this.hintState = "chaos";
    if (this.hintState !== prev) {
      this._hintChangeTimer   = 2800;
      this._hintChangeMessage = this._hintChangeMessages[this.hintState] || "";
    }
  },

  _noteVisual(isCorrect, noteId) {
    const h = this.hintState;
    const t = this.noiseTime + noteId * 137.5;
    const sh = Math.abs(Math.sin(t * 0.7));
    if (h === "full")   return { showCorrect: isCorrect,  showWrong: !isCorrect, shimmerAmt: 0 };
    if (h === "subtle") return { showCorrect: isCorrect,  showWrong: false,      shimmerAmt: 0 };
    if (h === "none")   return { showCorrect: false,      showWrong: false,      shimmerAmt: 0 };
    if (h === "decoy")  return { showCorrect: !isCorrect, showWrong: isCorrect,  shimmerAmt: 0 };
    return { showCorrect: sh > 0.6, showWrong: sh < 0.25, shimmerAmt: sh };
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
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94; p.vy += 120 * dt; p.life -= dt * 1.1;
    }
    this.levelUpParticles = this.levelUpParticles.filter(p => p.life > 0);
    if (this.levelUpTimer <= 0) this.levelUpActive = false;
  },

  _drawLevelUpBurst(ctx) {
    if (!this.levelUpActive) return;
    const prog = 1 - this.levelUpTimer / this.levelUpDuration;
    for (const p of this.levelUpParticles) {
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (prog > 0.05 && prog < 0.8) {
      const alpha = Math.sin(prog / 0.8 * Math.PI);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(this.centerX, this.centerY - 110);
      ctx.scale(0.8 + alpha * 0.3, 0.8 + alpha * 0.3);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 44px 'Trebuchet MS', sans-serif";
      ctx.shadowColor = this.C.gold; ctx.shadowBlur = 28; ctx.fillStyle = this.C.gold;
      ctx.fillText("LEVEL " + this.level + "!", 0, 0);
      ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = this.tierColors[this.tier]; ctx.shadowColor = this.tierColors[this.tier]; ctx.shadowBlur = 14;
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
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    const tw = ctx.measureText(this._hintChangeMessage).width;
    const bw = tw + 56, bh = 56, bx = W/2 - bw/2, by = bannerY - bh/2, br = bh/2;
    ctx.beginPath(); ctx.moveTo(bx+br,by); ctx.arcTo(bx+bw,by,bx+bw,by+bh,br); ctx.arcTo(bx+bw,by+bh,bx,by+bh,br); ctx.arcTo(bx,by+bh,bx,by,br); ctx.arcTo(bx,by,bx+bw,by,br); ctx.closePath();
    ctx.fillStyle="rgba(8,14,28,0.88)"; ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.shadowColor=col; ctx.shadowBlur=16; ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle=col; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.shadowColor=col; ctx.shadowBlur=10;
    ctx.fillText(this._hintChangeMessage, W/2, bannerY);
    ctx.restore();
  },

  _drawXPRing(ctx, cx, cy, radius) {
    const fill = this.level >= this.maxLevel ? 1 : this.xp / this.xpToNext;
    const tc   = this.tierColors[this.tier];
    const start = -Math.PI / 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2);
    ctx.strokeStyle = this.C.xpTrack; ctx.lineWidth = 6; ctx.stroke();
    if (fill > 0.01) {
      ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + Math.PI*2*fill);
      ctx.strokeStyle = tc; ctx.lineWidth = 6; ctx.shadowColor = tc; ctx.shadowBlur = 12 + this.xpPopFlash*20; ctx.stroke(); ctx.shadowBlur = 0;
    }
    if (this.xpPopFlash > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, radius + 12*this.xpPopFlash, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(245,200,66,${this.xpPopFlash*0.55})`; ctx.lineWidth = 5*this.xpPopFlash; ctx.stroke();
    }
  },

  /* ── HUD ─────────────────────────────────────────────────── */
  _pill(ctx, x, y, w, h) {
    const r = h / 2;
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
    ctx.fillStyle = this.C.hudBg; ctx.fill();
    ctx.strokeStyle = this.C.hudBorder; ctx.lineWidth = 1; ctx.stroke();
  },

  _drawHUD(ctx, isLauncher) {
    const W = this.centerX * 2, H = this.centerY * 2;
    const f = "bold 20px 'Trebuchet MS', sans-serif";
    if (isLauncher) {
      ctx.fillStyle = this.C.hudBg; ctx.fillRect(0, 0, W, 50);
      ctx.strokeStyle = this.C.hudBorder; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0,50); ctx.lineTo(W,50); ctx.stroke();
      ctx.font = f; ctx.textBaseline = "middle";
      ctx.fillStyle = "#e8f4ff"; ctx.textAlign = "left"; ctx.fillText("⭐ "+this.score, 16, 25);
      ctx.fillStyle = this.C.gold; ctx.textAlign = "center";
      ctx.font = "bold 17px 'Trebuchet MS', sans-serif"; ctx.fillText(this.gameTitle, W/2, 25);
      ctx.textAlign = "right";
      ctx.fillStyle = this.combo >= 3 ? this.C.correct : "#aac8e0";
      ctx.font = "bold 17px 'Trebuchet MS', sans-serif"; ctx.fillText("x"+this.combo+" combo", W-16, 25);
    } else {
      this._pill(ctx, 14, 14, 155, 42); ctx.font = f; ctx.fillStyle = "#e8f4ff"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("⭐ "+this.score, 28, 35);
      this._pill(ctx, W-174, 14, 160, 42); ctx.textAlign = "right";
      ctx.fillStyle = this.combo >= 3 ? this.C.correct : "#aac8e0"; ctx.fillText("🔥 "+this.combo+"  x"+this.multiplier, W-28, 35);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = this.C.gold; ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
      ctx.shadowColor = "rgba(245,200,66,0.4)"; ctx.shadowBlur = 14;
      ctx.fillText(this.gameTitle, W/2, 34); ctx.shadowBlur = 0;
    }
    const ringCX = W/2, ringCY = isLauncher ? H-60 : H-48, ringR = 26;
    this._drawXPRing(ctx, ringCX, ringCY, ringR);
    ctx.font = "bold 13px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = this.tierColors[this.tier]; ctx.shadowColor = this.tierColors[this.tier]; ctx.shadowBlur = 8;
    ctx.fillText("Lv."+this.level, ringCX, ringCY); ctx.shadowBlur = 0;
    const diffLabels = { full:"🟢 Training", subtle:"🟡 Subtle", none:"🔵 Blind", decoy:"🔴 Decoy", chaos:"🟣 Chaos" };
    ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.font = "13px 'Trebuchet MS', sans-serif"; ctx.globalAlpha = 0.7;
    ctx.fillStyle = this.tierColors[this.tier]; ctx.fillText(this.tierNames[this.tier], W-12, H-8);
    ctx.fillStyle = "#c8dff0"; ctx.fillText(diffLabels[this.hintState]||"", W-12, H-26);
    ctx.globalAlpha = 1;
  },

  /* ============================================================
     MAIN UPDATE
  ============================================================ */
  update(ctx, fingers, dt = 1/60) {
    // Tutorial state — runs on the same canvas, same loop
    if (this.gameState === "tutorial") {
      this._updateTutorial(ctx, fingers, dt);
      return;
    }

    // Playing state
    this._drawBg(ctx);
    this._drawBgStars(ctx);
    this._updateLevelUp(dt);
    this.noiseTime += dt * 1.8;
    this._driftSpeed(dt);

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
      if (isLauncher) this.checkCannonCollision(finger.x, finger.y);
      else            this.checkCollision(finger.x, finger.y);
    });

    this._drawHUD(ctx, isLauncher);
    this._drawLevelUpBurst(ctx);
    this._drawHintChangeAnnouncement(ctx, dt);
    this.drawHitText(ctx);
    this._drawNoFingerPrompt(ctx, dt);
  },

  /* ── Finger ─────────────────────────────────────────────── */
  drawFinger(ctx, x, y) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, this.baseOuterRadius * 0.065, 0, Math.PI*2);
    ctx.shadowColor = "rgba(126,207,179,0.7)"; ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(94,180,150,0.45)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, this.baseOuterRadius * 0.030, 0, Math.PI*2);
    ctx.shadowBlur = 12; ctx.fillStyle = "#b0f0da"; ctx.fill();
    ctx.restore();
  },

  /* ── Torus rings ─────────────────────────────────────────── */
  drawRings(ctx, dt) {
    this.pulseTime += this.pulseSpeed * dt;
    this.torusAngle = (this.torusAngle + dt * 0.28) % (Math.PI * 2);
    const outerOff = Math.sin(this.pulseTime) * this.pulseAmountOuter;
    const innerOff = Math.sin(this.pulseTime) * this.pulseAmountInner;
    this.currentOuterRadius = this.baseOuterRadius + Math.max(0, outerOff);
    this.currentInnerRadius = this.baseInnerRadius + Math.max(0, innerOff);
    const cx = this.centerX, cy = this.centerY;
    const Ro = this.currentOuterRadius, Ri = this.currentInnerRadius;
    const Rm = (Ro + Ri) / 2, r = (Ro - Ri) / 2;
    const lx = Math.cos(this.torusAngle), ly = Math.sin(this.torusAngle);
    ctx.save(); ctx.translate(cx, cy);
    const bloom = ctx.createRadialGradient(0,0,Ri-r*2.5,0,0,Ro+r*3.5);
    bloom.addColorStop(0,"rgba(0,0,0,0)"); bloom.addColorStop(0.30,"rgba(126,207,179,0.07)"); bloom.addColorStop(0.52,"rgba(201,147,58,0.14)"); bloom.addColorStop(0.70,"rgba(142,202,230,0.09)"); bloom.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=bloom; ctx.beginPath(); ctx.arc(0,0,Ro+r*3.5,0,Math.PI*2); ctx.fill();
    const gx0=-lx*(Ro+r),gy0=-ly*(Ro+r),gx1=lx*(Ro+r),gy1=ly*(Ro+r);
    const tg=ctx.createLinearGradient(gx0,gy0,gx1,gy1);
    tg.addColorStop(0,"#0a1525"); tg.addColorStop(0.22,"#1c3a2a"); tg.addColorStop(0.40,"#5a3010"); tg.addColorStop(0.55,"#c9933a"); tg.addColorStop(0.68,"#e8c87a"); tg.addColorStop(0.80,"#7ecfb3"); tg.addColorStop(1,"#0a1525");
    ctx.beginPath(); ctx.arc(0,0,Ro,0,Math.PI*2); ctx.arc(0,0,Ri,0,Math.PI*2,true);
    ctx.fillStyle=tg; ctx.shadowColor="rgba(201,147,58,0.4)"; ctx.shadowBlur=36; ctx.fill("evenodd"); ctx.shadowBlur=0;
    const hd=ctx.createRadialGradient(0,0,Ri*0.65,0,0,Ri);
    hd.addColorStop(0,"rgba(4,10,20,0.82)"); hd.addColorStop(0.6,"rgba(4,10,20,0.45)"); hd.addColorStop(1,"rgba(4,10,20,0.0)");
    ctx.beginPath(); ctx.arc(0,0,Ri,0,Math.PI*2); ctx.fillStyle=hd; ctx.fill();
    ctx.beginPath(); ctx.arc(0,0,Ro,0,Math.PI*2); ctx.strokeStyle="#d4a44a"; ctx.lineWidth=2.8; ctx.shadowColor="rgba(212,164,74,0.6)"; ctx.shadowBlur=18; ctx.stroke(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(0,0,Ri,0,Math.PI*2); ctx.strokeStyle="rgba(126,207,179,0.38)"; ctx.lineWidth=1.8; ctx.shadowColor="rgba(126,207,179,0.25)"; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0;
    const shimStart=this.torusAngle-Math.PI*0.35, shimEnd=this.torusAngle+Math.PI*0.35;
    ctx.beginPath(); ctx.arc(0,0,Rm+r*0.3,shimStart,shimEnd); ctx.arc(0,0,Rm-r*0.3,shimEnd,shimStart,true); ctx.closePath();
    const sg=ctx.createLinearGradient(Math.cos(this.torusAngle)*(Rm-r*0.3),Math.sin(this.torusAngle)*(Rm-r*0.3),Math.cos(this.torusAngle)*(Rm+r*0.3),Math.sin(this.torusAngle)*(Rm+r*0.3));
    sg.addColorStop(0,"rgba(255,255,255,0.0)"); sg.addColorStop(0.4,"rgba(255,240,200,0.18)"); sg.addColorStop(0.7,"rgba(200,240,255,0.22)"); sg.addColorStop(1,"rgba(255,255,255,0.0)");
    ctx.fillStyle=sg; ctx.fill();
    const sx=Math.cos(this.torusAngle)*Ro, sy=Math.sin(this.torusAngle)*Ro;
    const spec=ctx.createRadialGradient(sx,sy,0,sx,sy,r*1.8);
    spec.addColorStop(0,"rgba(255,250,230,0.95)"); spec.addColorStop(0.3,"rgba(245,215,140,0.55)"); spec.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=spec; ctx.beginPath(); ctx.arc(sx,sy,r*1.8,0,Math.PI*2); ctx.fill();
    const sx2=Math.cos(this.torusAngle+Math.PI*0.18)*Ri, sy2=Math.sin(this.torusAngle+Math.PI*0.18)*Ri;
    const spec2=ctx.createRadialGradient(sx2,sy2,0,sx2,sy2,r*1.2);
    spec2.addColorStop(0,"rgba(180,255,230,0.55)"); spec2.addColorStop(0.5,"rgba(126,207,179,0.2)"); spec2.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=spec2; ctx.beginPath(); ctx.arc(sx2,sy2,r*1.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  },

  /* ── Notes ───────────────────────────────────────────────── */
  spawnNote() {
    if (this.notes.length >= this.maxNotesOnScreen) return;
    const angle = Math.random() * Math.PI * 2;
    const minR  = this.currentOuterRadius + 150, maxR = this.currentOuterRadius + 210;
    const spawnR = Math.random() * (maxR - minR) + minR;
    const num = this.currentNumber++;
    if (this.currentNumber > this.maxNumber) this.currentNumber = 1;
    this.notes.push({ x: this.centerX + Math.cos(angle)*spawnR, y: this.centerY + Math.sin(angle)*spawnR, radius: this.baseOuterRadius*0.12, value: num, id: num });
  },

  drawNotes(ctx, dt) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      const dx = this.centerX - note.x, dy = this.centerY - note.y;
      const len = Math.sqrt(dx*dx + dy*dy);
      const step = Math.min(this.noteSpeed * dt, len);
      note.x += (dx/len)*step; note.y += (dy/len)*step;
      this._drawNoteCircle(ctx, note);
      if (len <= step + 1) this.notes.splice(i, 1);
    }
  },

  _drawNoteCircle(ctx, note) {
    const r   = note.radius;
    const isC = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple")
                ? this.shouldCollectCannon(note.value) : this.shouldCollect(note.value);
    const vis    = this._noteVisual(isC, note.id || note.value);
    const h      = this.hintState;
    const isVisC = vis.showCorrect, isVisW = vis.showWrong;
    ctx.save();
    if (isVisC || isVisW || vis.shimmerAmt > 0) {
      let ha = isVisC ? 0.16 : isVisW ? 0.11 : vis.shimmerAmt*0.12;
      if (h === "subtle" && isVisC) ha = 0.07;
      const hc = isVisC ? `rgba(109,232,180,${ha})` : isVisW ? `rgba(232,124,109,${ha})` : `rgba(140,180,220,${ha})`;
      const grd = ctx.createRadialGradient(note.x,note.y,r*0.2,note.x,note.y,r*1.4);
      grd.addColorStop(0,hc); grd.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(note.x,note.y,r*1.4,0,Math.PI*2); ctx.fill();
    }
    let bodyFill, rimColor, shadowCol;
    if (isVisC && h !== "subtle") { bodyFill="#0e3028"; rimColor=this.C.correct; shadowCol="rgba(109,232,180,0.45)"; }
    else if (isVisW)               { bodyFill="#2a1010"; rimColor=this.C.wrong;   shadowCol="rgba(232,124,109,0.4)"; }
    else {
      bodyFill  = "#102140";
      rimColor  = `rgba(${Math.round(100+vis.shimmerAmt*80)},${Math.round(160+vis.shimmerAmt*40)},${Math.round(200+vis.shimmerAmt*30)},${0.55+vis.shimmerAmt*0.35})`;
      shadowCol = `rgba(90,150,200,${0.25+vis.shimmerAmt*0.2})`;
    }
    ctx.shadowColor=shadowCol; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.arc(note.x,note.y,r,0,Math.PI*2); ctx.fillStyle=bodyFill; ctx.fill();
    ctx.strokeStyle=rimColor; ctx.lineWidth=2.5; ctx.stroke(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(note.x-r*0.27,note.y-r*0.27,r*0.20,0,Math.PI*2);
    ctx.fillStyle = isVisC && h !== "subtle" ? "rgba(200,255,230,0.30)" : "rgba(200,230,255,0.22)"; ctx.fill();
    if (h === "subtle" && !isC) {
      ctx.globalAlpha=0.18; ctx.fillStyle="#aac8e0";
      ctx.font=`bold ${Math.round(r*0.42)}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("?",note.x,note.y-r*0.55); ctx.globalAlpha=1;
    }
    ctx.fillStyle=this.C.noteText; ctx.font=`bold ${Math.round(r*0.72)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(note.value,note.x,note.y);
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
    for (let index = this.notes.length-1; index >= 0; index--) {
      const note = this.notes[index];
      const dx=fingerX-note.x, dy=fingerY-note.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const dfc=Math.sqrt((note.x-this.centerX)**2+(note.y-this.centerY)**2);
      const onRing = dfc+note.radius>this.currentInnerRadius && dfc-note.radius<this.currentOuterRadius;
      if (dist < note.radius+20 && onRing) {
        if (this.shouldCollect(note.value)) {
          this.combo++; if (this.combo%5===0) this.multiplier++;
          this.score += 10*this.multiplier; this.lastHitType="CORRECT";
          this._gainXP(1); this._recoverSpeed();
          if (this.popEffects.length < this.MAX_POP) this.popEffects.push({x:note.x,y:note.y,life:0,color:this.C.correct});
        } else {
          this.combo=0; this.multiplier=1; this.score-=5; this.lastHitType="WRONG";
          this._penalizeSpeed();
          if (this.popEffects.length < this.MAX_POP) this.popEffects.push({x:note.x,y:note.y,life:0,color:this.C.wrong});
        }
        this.hitTextTimer=30; this.notes.splice(index,1);
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
          this.combo++; if (this.combo%5===0) this.multiplier++;
          this.score+=10*this.multiplier; this.lastHitType="CORRECT";
          this._gainXP(1); this._recoverSpeed(); this.createExplosion(note.x,note.y,this.C.correct);
        } else {
          this.combo=0; this.multiplier=1; this.score-=5; this.lastHitType="WRONG";
          this._penalizeSpeed(); this.createExplosion(note.x,note.y,this.C.wrong);
        }
        this.hitTextTimer=30; this.notes.splice(i,1);
      }
    }
  },

  /* ── Pop effects ─────────────────────────────────────────── */
  drawPopEffects(ctx) {
    for (let i = this.popEffects.length-1; i >= 0; i--) {
      const p=this.popEffects[i]; p.life+=0.025;
      if (p.life>=1) { this.popEffects.splice(i,1); continue; }
      const ease=1-Math.pow(1-p.life,2), alpha=Math.max(0,1-ease), scale=1+ease*0.5;
      ctx.save(); ctx.globalAlpha=alpha; ctx.translate(p.x,p.y); ctx.scale(scale,scale);
      ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=16;
      ctx.beginPath(); ctx.arc(0,0,32,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  },

  /* ── Hit text ────────────────────────────────────────────── */
  drawHitText(ctx) {
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
      ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=color;
      ctx.font="bold 34px 'Trebuchet MS', sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.shadowColor=color; ctx.shadowBlur=18;
      ctx.fillText(this.lastHitType, this.centerX, this.centerY-130);
      ctx.restore(); this.hitTextTimer--;
    }
  },

  /* ── Mode activators ─────────────────────────────────────── */
  activatePatternMode() {
    this.mode="pattern";
    this.pattern.skip=Math.floor(Math.random()*5)+1;
    this.pattern.collect=Math.floor(Math.random()*5)+1;
    this.gameTitle="SKIP "+this.pattern.skip+" COLLECT "+this.pattern.collect;
    this._restartSpawnTimer();
  },
  activateCannonMode()       { this.mode="cannon";  this._resetLauncherState(); this.gameTitle="CANNON SKIP "+this.skipAmount; },
  activateOrbMode()          { this.mode="orb";     this._resetLauncherState(); this.orbAngle=0; this.orbTargetAngle=0; this.gameTitle="ORB SKIP "+this.skipAmount; },
  activateTripleCannonMode() {
    this.mode="triple"; this._resetLauncherState(); this.tripleBaseAngle=0; this.tripleTargetAngle=0; this.tripleCannons=[];
    const sp=(Math.PI*2)/this.tripleCount;
    for (let i=0;i<this.tripleCount;i++) this.tripleCannons.push({offset:i*sp});
    this.gameTitle="TRIPLE CANNON SKIP "+this.skipAmount;
  },

  _resetLauncherState() {
    this.notes=[]; this.explosions=[]; this.combo=0; this.multiplier=1;
    this.cannonAngle=0; this.cannonTargetAngle=0;
    this.pendingShot=null; this.previewCannons=[]; this.previewTimer=0;
    this.skipAmount=this.getRandomSkip(); this.noteSpeed=this.speedCap;
    this._restartSpawnTimer();
  },

  /* ── Cannon ──────────────────────────────────────────────── */
  spawnCannonNote() {
    if (this.notes.length >= this.maxNotesOnScreen) return;
    if (this.pendingShot) return;
    const angle=Math.random()*Math.PI*2;
    const num=this.currentNumber++;
    if (this.currentNumber>this.maxNumber) this.currentNumber=1;
    this.pendingShot={angle,speed:this.noteSpeed,value:num,id:num};
    this.cannonTargetAngle=angle+Math.PI/2; this.startCharging();
  },

  updateCannonNotes(ctx, dt) {
    for (let i=this.notes.length-1; i>=0; i--) {
      const note=this.notes[i];
      note.x+=note.vx*dt; note.y+=note.vy*dt;
      this.updateLauncherProtection(note); this._drawNoteCircle(ctx,note);
      const m=120;
      const off=note.x<-m||note.x>this.centerX*2+m||note.y<-m||note.y>this.centerY*2+m;
      if (off) {
        if (this.shouldCollectCannon(note.value)) {
          this.score-=10; this.combo=0; this.multiplier=1;
          this.missQueue.push(note.value); this._penalizeSpeed();
          this.createExplosion(note.x,note.y,"#e8a06d");
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
    ctx.save(); ctx.translate(this.centerX,this.centerY); ctx.rotate(this.cannonAngle);
    const bg=ctx.createRadialGradient(0,0,size*0.1,0,0,size*0.6);
    bg.addColorStop(0,"#2a4a6e"); bg.addColorStop(1,"#152035");
    ctx.beginPath(); ctx.arc(0,0,size*0.6,0,Math.PI*2);
    ctx.fillStyle=bg; ctx.shadowColor=this.C.accent; ctx.shadowBlur=18; ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle="#3a6080";
    ctx.beginPath();
    const bx=-size*0.13,by=-this.cannonLength,bw=size*0.26,bh=this.cannonLength;
    ctx.moveTo(bx+6,by); ctx.lineTo(bx+bw-6,by); ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+6);
    ctx.lineTo(bx+bw,by+bh); ctx.lineTo(bx,by+bh); ctx.lineTo(bx,by+6); ctx.quadraticCurveTo(bx,by,bx+6,by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=this.C.accent; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
  },

  fireCannon() {
    if (!this.pendingShot) return;
    const {angle,speed,value,id}=this.pendingShot;
    this.notes.push({x:this.centerX,y:this.centerY,radius:this.baseOuterRadius*0.12,value,id:id||value,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,spawnProtected:true});
    this.pendingShot=null; this.isCharging=false; this.charge=0; this.chargeParticles=[];
  },

  /* ── Orb ─────────────────────────────────────────────────── */
  spawnOrbNote() {
    if (this.notes.length >= this.maxNotesOnScreen) return;
    const angle=Math.random()*Math.PI*2;
    this.orbTargetAngle=angle+Math.PI/2;
    const num=this.currentNumber++;
    if (this.currentNumber>this.maxNumber) this.currentNumber=1;
    const speed=this.noteSpeed;
    setTimeout(()=>{
      this.notes.push({x:this.centerX,y:this.centerY,radius:this.baseOuterRadius*0.12,value:num,id:num,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,spawnProtected:true});
    },120);
  },

  drawOrbLauncher(ctx) {
    const sz=this.baseOuterRadius*0.6;
    let diff=this.orbTargetAngle-this.orbAngle;
    diff=Math.atan2(Math.sin(diff),Math.cos(diff)); this.orbAngle+=diff*0.18;
    ctx.save(); ctx.translate(this.centerX,this.centerY); ctx.rotate(this.orbAngle);
    if (this.orbImage && this.orbImage.complete && this.orbImage.naturalWidth>0) {
      const img=this.orbImage,sc=sz/Math.max(img.width,img.height);
      ctx.scale(1,-1); ctx.drawImage(img,-img.width*sc/2,-img.height*sc/2,img.width*sc,img.height*sc);
    } else {
      const g=ctx.createRadialGradient(0,0,0,0,0,sz/2);
      g.addColorStop(0,"#8ecae6"); g.addColorStop(0.55,"#1a3a5c"); g.addColorStop(1,"rgba(14,30,50,0)");
      ctx.fillStyle=g; ctx.shadowColor=this.C.accent; ctx.shadowBlur=28;
      ctx.beginPath(); ctx.arc(0,0,sz/2,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    }
    ctx.restore();
  },

  /* ── Triple cannon ───────────────────────────────────────── */
  spawnTripleNote() {
    if (this.notes.length >= this.maxNotesOnScreen) return;
    if (this.pendingShot) return;
    const angle=Math.random()*Math.PI*2;
    this.pendingShot={angle,speed:this.noteSpeed};
    this.tripleTargetAngle=angle+Math.PI/2; this.startCharging();
  },

  drawTripleCannons(ctx) {
    const sz=this.baseOuterRadius*0.6;
    let diff=this.tripleTargetAngle-this.tripleBaseAngle;
    diff=Math.atan2(Math.sin(diff),Math.cos(diff)); this.tripleBaseAngle+=diff*0.18;
    if (this.pendingShot && this.previewTimer<=0 && this.previewCannons.length===0 && Math.abs(diff)<0.05) this.fireTriple();
    for (let i=0;i<this.tripleCannons.length;i++) {
      const cannon=this.tripleCannons[i], angle=this.tripleBaseAngle+cannon.offset;
      ctx.save(); ctx.translate(this.centerX,this.centerY); ctx.rotate(angle);
      if (this.orbImage && this.orbImage.complete && this.orbImage.naturalWidth>0) {
        const img=this.orbImage,sc=sz/Math.max(img.width,img.height);
        ctx.scale(1,-1); ctx.drawImage(img,-img.width*sc/2,-img.height*sc/2,img.width*sc,img.height*sc);
      } else {
        const g=ctx.createRadialGradient(0,0,0,0,0,sz/2);
        g.addColorStop(0,"#8ecae6"); g.addColorStop(1,"rgba(14,30,50,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,sz*0.8,0,Math.PI*2*0.8); ctx.fill();
      }
      if (this.previewCannons.includes(i) && this.previewTimer>0) {
        const pulse=0.8+Math.sin(Date.now()*0.01)*0.2, miniR=sz*0.18, offY=-sz*0.6;
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.scale(1,-1);
        const g2=ctx.createRadialGradient(0,offY,0,0,offY,miniR);
        g2.addColorStop(0,"rgba(245,200,66,1)"); g2.addColorStop(0.4,"rgba(245,200,66,0.55)"); g2.addColorStop(1,"rgba(245,200,66,0)");
        ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(0,offY,miniR*pulse,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    }
  },

  fireTriple() {
    if (!this.pendingShot) return;
    const pool=[1,1,1,1,1,1,2,2,2,2,2,2,2,3,3];
    const fc=pool[Math.floor(Math.random()*pool.length)];
    this.previewCannons=[];
    while (this.previewCannons.length<fc) {
      const ri=Math.floor(Math.random()*this.tripleCount);
      if (!this.previewCannons.includes(ri)) this.previewCannons.push(ri);
    }
    this.previewTimer=this.previewDuration;
  },

  executeTripleShot() {
    if (!this.pendingShot) return;
    const speed=this.pendingShot.speed, delay=180;
    this.previewCannons.forEach((i,index)=>{
      setTimeout(()=>{
        const angle=this.tripleBaseAngle+this.tripleCannons[i].offset-Math.PI/2;
        const value=this.currentNumber++;
        if (this.currentNumber>this.maxNumber) this.currentNumber=1;
        this.notes.push({x:this.centerX,y:this.centerY,radius:this.baseOuterRadius*0.12,value,id:value,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,spawnProtected:true});
      },index*delay);
    });
    setTimeout(()=>{ this.previewCannons=[]; this.pendingShot=null; this.isCharging=false; this.charge=0; this.chargeParticles=[]; },this.previewCannons.length*delay);
  },

  /* ── Launcher shared ─────────────────────────────────────── */
  updateLauncherProtection(note) {
    const dx=note.x-this.centerX,dy=note.y-this.centerY;
    if (Math.sqrt(dx*dx+dy*dy)>this.launcherSafeRadius) note.spawnProtected=false;
  },
  drawLauncherZone(ctx) {
    ctx.save(); ctx.setLineDash([6,9]); ctx.strokeStyle="rgba(140,180,220,0.18)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(this.centerX,this.centerY,this.launcherSafeRadius,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
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
      p.x+=(this.centerX-p.x)*0.08; p.y+=(this.centerY-p.y)*0.08;
      p.life-=dt*1.2; if (p.life<=0) this.chargeParticles.splice(i,1);
    }
  },
  drawCharging(ctx) {
    if (!this.isCharging) return;
    ctx.save(); ctx.globalCompositeOperation="lighter";
    for (const p of this.chargeParticles) {
      ctx.globalAlpha=p.life*0.7; ctx.fillStyle=this.C.gold; ctx.shadowColor=this.C.gold; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    const gr=this.baseOuterRadius*0.18*(0.5+this.charge*0.8);
    const g=ctx.createRadialGradient(this.centerX,this.centerY,0,this.centerX,this.centerY,gr);
    g.addColorStop(0,`rgba(245,200,66,${0.65*this.charge})`); g.addColorStop(1,"rgba(245,200,66,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(this.centerX,this.centerY,gr,0,Math.PI*2); ctx.fill();
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
    for (let i=this.explosions.length-1; i>=0; i--) {
      const p=this.explosions[i]; p.life+=0.03;
      if (p.life>=1) { this.explosions.splice(i,1); continue; }
      p.x+=p.vx*0.016; p.y+=p.vy*0.016;
      const alpha=Math.max(0,1-p.life);
      ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(p.x,p.y,this.baseOuterRadius*0.038,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  },

  /* ── Utility ─────────────────────────────────────────────── */
  getRandomSkip() {
    const w=[2,2,2,2,3,3,3,3,3,3,4,4,4,5,5];
    return w[Math.floor(Math.random()*w.length)];
  },

  /* fullReset is only for absolute emergencies — normal resize
     calls _onResize() which never touches score/combo/lives     */
  fullReset() {
    this.notes=[]; this.popEffects=[]; this.explosions=[]; this.missQueue=[];
    this.currentNumber=1; this.score=0; this.combo=0; this.multiplier=1;
    this.xp=0; this.level=1; this.xpToNext=8; this.tier=0;
    this.noteSpeed=this.speedCap; this.hintState="full"; this.noiseTime=0;
    this.spawnInterval=1800;
    this.pendingShot=null; this.previewCannons=[]; this.previewTimer=0;
    this.isCharging=false; this.charge=0; this.chargeParticles=[];
    this.torusAngle=0; this.pulseTime=0;
    this.skipAmount=this.getRandomSkip(); this.gameTitle="SKIP "+this.skipAmount;
    this._restartSpawnTimer();
  },
};