/* ================================================================
   GAME 1 — SKIP COUNTING
   Theme: Cozy Planetarium — warm navy · soft gold · mint green
   HUD:   Corners-only on Default/Pattern, thin top bar on launchers
   Level: XP ring fills → pops → tier up (Sprout→Star→Champ→Legend)

   CHANGES v2:
   - Default + Pattern modes: two concentric rings now rendered as
     ONE unified torus (a single glowing space-donut). The gap
     between them is the hollow core of the torus. Lit from above-
     left; ambient nebula glow underneath; slow rotation drives the
     specular highlight around the rim.
   - Adaptive speed system: starts at speedCap, drops on miss/wrong,
     recovers on correct hits, gently drifts back toward cap when
     playing well. Never exceeds speedCap.
================================================================ */

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
    bg:          "#0d1b2e",
    ring1:       "#c9933a",
    ring1Glow:   "rgba(201,147,58,0.35)",
    ring2:       "#7ecfb3",
    ring2Glow:   "rgba(126,207,179,0.25)",
    noteText:    "#f0f4ff",
    correct:     "#6de8b4",
    wrong:       "#e87c6d",
    gold:        "#f5c842",
    accent:      "#8ecae6",
    hudBg:       "rgba(10,20,38,0.78)",
    hudBorder:   "rgba(140,180,220,0.18)",
    xpTrack:     "rgba(245,200,66,0.15)",
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
  spawnInterval: 1200,

  pulseTime: 0,
  pulseSpeed: 2.2,
  pulseAmountOuter: 10,
  pulseAmountInner: 5,

  /* ── Torus rotation ──────────────────────────────────────── */
  torusAngle: 0,

  mode: "default",
  skipAmount: 3,
  gameTitle: "SKIP 3",
  pattern: { skip: 3, collect: 1 },

  /* ── Launcher state ─────────────────────────────────────── */
  cannonAngle: 0,
  cannonTargetAngle: 0,
  cannonLength: 0,
  pendingShot: null,
  lastCannonNote: null,

  orbImage: null,
  orbAngle: 0,
  orbTargetAngle: 0,
  lastOrbNote: null,

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

  /* ── Level / XP ──────────────────────────────────────────── */
  xp: 0,
  xpToNext: 8,
  level: 1,
  maxLevel: 20,
  tier: 0,
  tierNames:       ["Sprout 🌱", "Star ⭐", "Champ 🏆", "Legend 🌟"],
  tierColors:      ["#6de8b4",   "#f5c842",  "#e8a06d",   "#c084fc"],
  tierThresholds:  [1, 6, 12, 18],

  levelUpActive: false,
  levelUpTimer: 0,
  levelUpDuration: 1400,
  levelUpParticles: [],
  xpPopFlash: 0,
  hintState: "full",
  noiseTime: 0,

  /* ── Adaptive Speed ──────────────────────────────────────── */
  speedCap: 0,
  speedMin: 0,
  speedPenaltyStep: 0.06,
  speedRecoveryStep: 0.02,
  speedDriftRate: 0.008,

  /* ── Background ─────────────────────────────────────────── */
  bgStars: [],

  /* ── Hint messages ───────────────────────────────────────── */
  _hintChangeMessages: {
    subtle: "👀 Look carefully — hints are fading!",
    none:   "🧠 No more hints — use your brain!",
    decoy:  "😈 Watch out — fake signals ahead!",
    chaos:  "🌀 CHAOS MODE — trust nothing!",
  },
  _hintChangeTimer: 0,
  _hintChangeMessage: "",


  /* ============================================================
     INIT
  ============================================================ */
  init() {
    const rect = document.getElementById("container").getBoundingClientRect();
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
    this.spawnInterval = 1200;
    this.torusAngle = 0;

    this.mode = "default";
    this.skipAmount = this.getRandomSkip();
    this.gameTitle  = "SKIP " + this.skipAmount;
    this.noteSpeed  = this.speedCap;

    this.orbImage = new Image();
    this.orbImage.src = "orb1.png";

    this._initBgStars();
    this._restartSpawnTimer();

    window.addEventListener("keydown", (e) => {
      if (e.key === "1") this.activatePatternMode();
      if (e.key === "2") this.activateCannonMode();
      if (e.key === "3") this.activateOrbMode();
      if (e.key === "4") this.activateTripleCannonMode();
    });
  },

  _restartSpawnTimer() {
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    this.spawnTimer = setInterval(() => {
      if      (this.mode === "cannon") this.spawnCannonNote();
      else if (this.mode === "orb")    this.spawnOrbNote();
      else if (this.mode === "triple") this.spawnTripleNote();
      else                             this.spawnNote();
    }, this.spawnInterval);
  },


  /* ============================================================
     RESIZE
  ============================================================ */
  onResize(width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    const base = Math.min(width, height);
    this.baseOuterRadius = base * 0.25 * this.ringScale;
    this.baseInnerRadius = this.baseOuterRadius * 0.8;
    this.currentOuterRadius = this.baseOuterRadius;
    this.currentInnerRadius = this.baseInnerRadius;

    this.speedCap  = this.baseOuterRadius * 0.6;
    this.speedMin  = this.speedCap * 0.40;
    if (!this.noteSpeed || this.noteSpeed > this.speedCap) {
      this.noteSpeed = this.speedCap;
    }

    this.launcherSafeRadius = this.baseOuterRadius * 0.45;
    this._initBgStars();
  },


  /* ============================================================
     ADAPTIVE SPEED
  ============================================================ */
  _penalizeSpeed() {
    this.noteSpeed = Math.max(this.speedMin, this.noteSpeed - this.speedCap * this.speedPenaltyStep);
  },

  _recoverSpeed() {
    this.noteSpeed = Math.min(this.speedCap, this.noteSpeed + this.speedCap * this.speedRecoveryStep);
  },

  _driftSpeed(dt) {
    if (this.noteSpeed < this.speedCap) {
      this.noteSpeed = Math.min(
        this.speedCap,
        this.noteSpeed + (this.speedCap - this.noteSpeed) * this.speedDriftRate * dt * 60
      );
    }
  },


  /* ============================================================
     BACKGROUND
  ============================================================ */
  _initBgStars() {
    this.bgStars = [];
    for (let i = 0; i < 80; i++) {
      this.bgStars.push({
        x: Math.random() * (this.centerX * 2),
        y: Math.random() * (this.centerY * 2),
        r: 0.5 + Math.random() * 1.4,
        a: 0.1 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
        ts: 0.012 + Math.random() * 0.018,
      });
    }
  },

  _drawBg(ctx) {
    const W = this.centerX * 2, H = this.centerY * 2;
    const g = ctx.createRadialGradient(this.centerX, this.centerY * 0.6, 0, this.centerX, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, "#1a2d4a");
    g.addColorStop(0.5, "#0f1e35");
    g.addColorStop(1, "#080f1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },

  _drawBgStars(ctx, dt) {
    for (const s of this.bgStars) {
      s.tw += s.ts;
      const alpha = Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#c8dff0";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
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
      this.xp = 0;
      this.level++;
      this.xpToNext = Math.min(8 + this.level * 2, 25);
      this.xpPopFlash = 1;
      for (let t = this.tierThresholds.length - 1; t >= 0; t--) {
        if (this.level >= this.tierThresholds[t]) { this.tier = Math.max(this.tier, t); break; }
      }
      this._updateHintState();
      if (this.level % 3 === 0) {
        this.spawnInterval = Math.max(650, this.spawnInterval - 60);
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
    this.levelUpActive = true;
    this.levelUpTimer  = this.levelUpDuration;
    this.levelUpParticles = [];
    const cols = [this.C.gold, this.C.correct, this.C.accent, "#ffffff"];
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2, v = 180 + Math.random() * 220;
      this.levelUpParticles.push({
        x: this.centerX, y: this.centerY,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: 3 + Math.random() * 5,
        color: cols[i % cols.length], life: 1,
      });
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
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.centerX, this.centerY - 110);
      ctx.scale(0.8 + alpha * 0.3, 0.8 + alpha * 0.3);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 44px 'Trebuchet MS', sans-serif";
      ctx.shadowColor = this.C.gold; ctx.shadowBlur = 28;
      ctx.fillStyle = this.C.gold;
      ctx.fillText("LEVEL " + this.level + "!", 0, 0);
      ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = this.tierColors[this.tier];
      ctx.shadowColor = this.tierColors[this.tier]; ctx.shadowBlur = 14;
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
    const colors = { subtle: "#f5c842", none: "#8ecae6", decoy: "#e87c6d", chaos: "#c084fc" };
    const col = colors[this.hintState] || "#ffffff";
    const W = this.centerX * 2, bannerY = this.centerY * 0.38;
    ctx.save(); ctx.globalAlpha = alpha;
    const msg = this._hintChangeMessage;
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    const tw = ctx.measureText(msg).width;
    const bw = tw + 56, bh = 56, bx = W / 2 - bw / 2, by = bannerY - bh / 2, br = bh / 2;
    ctx.beginPath();
    ctx.moveTo(bx + br, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, br);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, br); ctx.arcTo(bx, by + bh, bx, by, br);
    ctx.arcTo(bx, by, bx + bw, by, br); ctx.closePath();
    ctx.fillStyle = "rgba(8,14,28,0.88)"; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = col; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.fillText(msg, W / 2, bannerY);
    ctx.restore();
  },

  _drawXPRing(ctx, cx, cy, radius) {
    const fill = this.level >= this.maxLevel ? 1 : this.xp / this.xpToNext;
    const tierColor = this.tierColors[this.tier];
    const start = -Math.PI / 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.C.xpTrack; ctx.lineWidth = 6; ctx.stroke();
    if (fill > 0.01) {
      ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + Math.PI * 2 * fill);
      ctx.strokeStyle = tierColor; ctx.lineWidth = 6;
      ctx.shadowColor = tierColor; ctx.shadowBlur = 12 + this.xpPopFlash * 20;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    if (this.xpPopFlash > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, radius + 12 * this.xpPopFlash, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245,200,66,${this.xpPopFlash * 0.55})`;
      ctx.lineWidth = 5 * this.xpPopFlash; ctx.stroke();
    }
  },


  /* ============================================================
     HUD
  ============================================================ */
  _pill(ctx, x, y, w, h) {
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fillStyle = this.C.hudBg; ctx.fill();
    ctx.strokeStyle = this.C.hudBorder; ctx.lineWidth = 1; ctx.stroke();
  },

  _drawHUD(ctx, isLauncher, dt) {
    const W = this.centerX * 2, H = this.centerY * 2;
    const f = "bold 20px 'Trebuchet MS', sans-serif";

    if (isLauncher) {
      ctx.fillStyle = this.C.hudBg; ctx.fillRect(0, 0, W, 50);
      ctx.strokeStyle = this.C.hudBorder; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(W, 50); ctx.stroke();
      ctx.font = f; ctx.textBaseline = "middle";
      ctx.fillStyle = "#e8f4ff"; ctx.textAlign = "left";
      ctx.fillText("⭐ " + this.score, 16, 25);
      ctx.fillStyle = this.C.gold; ctx.textAlign = "center";
      ctx.font = "bold 17px 'Trebuchet MS', sans-serif";
      ctx.fillText(this.gameTitle, W / 2, 25);
      ctx.textAlign = "right";
      ctx.fillStyle = this.combo >= 3 ? this.C.correct : "#aac8e0";
      ctx.font = "bold 17px 'Trebuchet MS', sans-serif";
      ctx.fillText("x" + this.combo + " combo", W - 16, 25);
    } else {
      this._pill(ctx, 14, 14, 155, 42);
      ctx.font = f; ctx.fillStyle = "#e8f4ff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("⭐ " + this.score, 28, 35);
      this._pill(ctx, W - 174, 14, 160, 42);
      ctx.textAlign = "right";
      ctx.fillStyle = this.combo >= 3 ? this.C.correct : "#aac8e0";
      ctx.fillText("🔥 " + this.combo + "  x" + this.multiplier, W - 28, 35);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = this.C.gold; ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
      ctx.shadowColor = "rgba(245,200,66,0.4)"; ctx.shadowBlur = 14;
      ctx.fillText(this.gameTitle, W / 2, 34); ctx.shadowBlur = 0;
    }

    const ringCX = W / 2, ringCY = isLauncher ? H - 60 : H - 48, ringR = 26;
    this._drawXPRing(ctx, ringCX, ringCY, ringR);
    ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = this.tierColors[this.tier];
    ctx.shadowColor = this.tierColors[this.tier]; ctx.shadowBlur = 8;
    ctx.fillText("Lv." + this.level, ringCX, ringCY); ctx.shadowBlur = 0;

    const diffLabels = { full: "🟢 Training", subtle: "🟡 Subtle", none: "🔵 Blind", decoy: "🔴 Decoy", chaos: "🟣 Chaos" };
    ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.font = "13px 'Trebuchet MS', sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = this.tierColors[this.tier]; ctx.fillText(this.tierNames[this.tier], W - 12, H - 8);
    ctx.fillStyle = "#c8dff0"; ctx.fillText(diffLabels[this.hintState] || "", W - 12, H - 26);
    ctx.globalAlpha = 1;
  },


  /* ============================================================
     MAIN UPDATE
  ============================================================ */
  update(ctx, fingers, dt = 1 / 60) {
    this._drawBg(ctx);
    this._drawBgStars(ctx, dt);
    this._updateLevelUp(dt);
    this.noiseTime += dt * 1.8;
    this._driftSpeed(dt);

    const isLauncher = (this.mode === "cannon" || this.mode === "orb" || this.mode === "triple");

    if (!isLauncher) this.drawRings(ctx, dt);

    if (this.mode === "cannon") {
      this.updateCannonNotes(ctx, dt);
      this.drawCannon(ctx, dt);
      this.drawExplosions(ctx);
      this.drawLauncherZone(ctx);
      this.drawCharging(ctx);
      this.updateCharging(dt);
    } else if (this.mode === "orb") {
      this.updateCannonNotes(ctx, dt);
      this.drawOrbLauncher(ctx, dt);
      this.drawExplosions(ctx);
      this.drawLauncherZone(ctx);
      this.drawCharging(ctx);
      this.updateCharging(dt);
    } else if (this.mode === "triple") {
      this.updateCannonNotes(ctx, dt);
      this.drawTripleCannons(ctx, dt);
      this.drawExplosions(ctx);
      this.drawLauncherZone(ctx);
    } else {
      this.drawNotes(ctx, dt);
    }

    if (this.mode === "triple" && this.previewTimer > 0) {
      this.previewTimer -= dt;
      if (this.previewTimer <= 0) this.executeTripleShot();
    }

    this.drawPopEffects(ctx);

    fingers.forEach((finger) => {
      this.drawFinger(ctx, finger.x, finger.y);
      if (isLauncher) this.checkCannonCollision(finger.x, finger.y);
      else            this.checkCollision(finger.x, finger.y);
    });

    this._drawHUD(ctx, isLauncher, dt);
    this._drawLevelUpBurst(ctx);
    this._drawHintChangeAnnouncement(ctx, dt);
    this.drawHitText(ctx);
  },

  drawTitle(ctx) {},
  drawScore(ctx) {},
  drawCombo(ctx)  {},


  /* ============================================================
     FINGER
  ============================================================ */
  drawFinger(ctx, x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, this.baseOuterRadius * 0.065, 0, Math.PI * 2);
    ctx.shadowColor = "rgba(126,207,179,0.7)"; ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(94,180,150,0.45)"; ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, this.baseOuterRadius * 0.030, 0, Math.PI * 2);
    ctx.shadowBlur = 12; ctx.fillStyle = "#b0f0da"; ctx.fill();
    ctx.restore();
  },


  /* ============================================================
     TORUS RINGS — single unified space-donut
  
     The two original radii (currentOuterRadius, currentInnerRadius)
     now define the outer and inner edges of ONE torus. The tube's
     midpoint is the average of the two; the tube's cross-section
     radius is half the gap between them.
  
     Visual layers (drawn back-to-front):
       1. Wide ambient nebula bloom under the whole donut
       2. Bottom-half shadow arc  (dark, behind the hole)
       3. Tube fill — angled gradient following the light angle
       4. Top-half highlight arc  (bright, catches the "light")
       5. Outer edge stroke (crisp gold rim)
       6. Inner edge stroke (faint mint rim — the hole's near edge)
       7. Animated specular highlight dot that orbits the ring
       8. Thin iridescent shimmer band along the top arc
  ============================================================ */
  drawRings(ctx, dt) {
    this.pulseTime += this.pulseSpeed * dt;
    this.torusAngle = (this.torusAngle + dt * 0.28) % (Math.PI * 2);

    const outerOff = Math.sin(this.pulseTime) * this.pulseAmountOuter;
    const innerOff = Math.sin(this.pulseTime) * this.pulseAmountInner;
    this.currentOuterRadius = this.baseOuterRadius + Math.max(0, outerOff);
    this.currentInnerRadius = this.baseInnerRadius + Math.max(0, innerOff);

    const cx = this.centerX, cy = this.centerY;
    const Ro = this.currentOuterRadius;   // outer edge of torus
    const Ri = this.currentInnerRadius;   // inner edge of torus
    const Rm = (Ro + Ri) / 2;             // tube centreline radius
    const r  = (Ro - Ri) / 2;             // tube cross-section radius

    // Light direction (orbits slowly)
    const lx = Math.cos(this.torusAngle);
    const ly = Math.sin(this.torusAngle);

    ctx.save();
    ctx.translate(cx, cy);

    /* ── 1. Ambient nebula bloom ──────────────────────────── */
    const bloom = ctx.createRadialGradient(0, 0, Ri - r * 2.5, 0, 0, Ro + r * 3.5);
    bloom.addColorStop(0,    "rgba(0,0,0,0)");
    bloom.addColorStop(0.30, "rgba(126,207,179,0.07)");
    bloom.addColorStop(0.52, "rgba(201,147,58,0.14)");
    bloom.addColorStop(0.70, "rgba(142,202,230,0.09)");
    bloom.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(0, 0, Ro + r * 3.5, 0, Math.PI * 2);
    ctx.fill();

    /* ── 2. Tube body — fill the annulus with a light-direction gradient ─
       The gradient axis points from the shadow side toward the lit side,
       giving the illusion that the tube is catching light at one angle   */
    const gx0 = -lx * (Ro + r), gy0 = -ly * (Ro + r);
    const gx1 =  lx * (Ro + r), gy1 =  ly * (Ro + r);

    const tubeGrad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    tubeGrad.addColorStop(0,    "#0a1525");          // deep shadow
    tubeGrad.addColorStop(0.22, "#1c3a2a");          // shadow-side dark mint
    tubeGrad.addColorStop(0.40, "#5a3010");          // warm mid-tone (gold shadow)
    tubeGrad.addColorStop(0.55, "#c9933a");          // main gold
    tubeGrad.addColorStop(0.68, "#e8c87a");          // bright lit face
    tubeGrad.addColorStop(0.80, "#7ecfb3");          // mint sheen on far side
    tubeGrad.addColorStop(1,    "#0a1525");          // wrap back to shadow

    // Draw annulus (evenodd rule creates the hole)
    ctx.beginPath();
    ctx.arc(0, 0, Ro, 0, Math.PI * 2);
    ctx.arc(0, 0, Ri, 0, Math.PI * 2, true);
    ctx.fillStyle = tubeGrad;
    ctx.shadowColor = "rgba(201,147,58,0.4)";
    ctx.shadowBlur  = 36;
    ctx.fill("evenodd");
    ctx.shadowBlur  = 0;

    /* ── 3. Inner hole darkness — makes the hole look deep ── */
    // A subtle radial fade from just inside Ri inward
    const holeDark = ctx.createRadialGradient(0, 0, Ri * 0.65, 0, 0, Ri);
    holeDark.addColorStop(0,   "rgba(4,10,20,0.82)");
    holeDark.addColorStop(0.6, "rgba(4,10,20,0.45)");
    holeDark.addColorStop(1,   "rgba(4,10,20,0.0)");
    ctx.beginPath();
    ctx.arc(0, 0, Ri, 0, Math.PI * 2);
    ctx.fillStyle = holeDark;
    ctx.fill();

    /* ── 4. Outer edge stroke — crisp gold rim ───────────── */
    ctx.beginPath();
    ctx.arc(0, 0, Ro, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4a44a";
    ctx.lineWidth   = 2.8;
    ctx.shadowColor = "rgba(212,164,74,0.6)";
    ctx.shadowBlur  = 18;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    /* ── 5. Inner edge stroke — faint mint ──────────────── */
    ctx.beginPath();
    ctx.arc(0, 0, Ri, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(126,207,179,0.38)";
    ctx.lineWidth   = 1.8;
    ctx.shadowColor = "rgba(126,207,179,0.25)";
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    /* ── 6. Iridescent shimmer band along lit arc ────────── */
    //  A semi-transparent arc on the lit half — like the sheen
    //  you see on a glossy torus where the surface curves away
    const shimStart = this.torusAngle - Math.PI * 0.35;
    const shimEnd   = this.torusAngle + Math.PI * 0.35;

    ctx.beginPath();
    ctx.arc(0, 0, Rm + r * 0.3, shimStart, shimEnd);
    ctx.arc(0, 0, Rm - r * 0.3, shimEnd, shimStart, true);
    ctx.closePath();
    const shimGrad = ctx.createLinearGradient(
      Math.cos(this.torusAngle) * (Rm - r * 0.3),
      Math.sin(this.torusAngle) * (Rm - r * 0.3),
      Math.cos(this.torusAngle) * (Rm + r * 0.3),
      Math.sin(this.torusAngle) * (Rm + r * 0.3)
    );
    shimGrad.addColorStop(0,   "rgba(255,255,255,0.0)");
    shimGrad.addColorStop(0.4, "rgba(255,240,200,0.18)");
    shimGrad.addColorStop(0.7, "rgba(200,240,255,0.22)");
    shimGrad.addColorStop(1,   "rgba(255,255,255,0.0)");
    ctx.fillStyle = shimGrad;
    ctx.fill();

    /* ── 7. Specular highlight — small bright dot on rim ─── */
    //  The dot orbits at the light angle, sitting on the outer edge
    const sx = Math.cos(this.torusAngle) * Ro;
    const sy = Math.sin(this.torusAngle) * Ro;
    const specGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.8);
    specGrad.addColorStop(0,   "rgba(255,250,230,0.95)");
    specGrad.addColorStop(0.3, "rgba(245,215,140,0.55)");
    specGrad.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    /* ── 8. Secondary specular on inner rim (mint tint) ──── */
    const sx2 = Math.cos(this.torusAngle + Math.PI * 0.18) * Ri;
    const sy2 = Math.sin(this.torusAngle + Math.PI * 0.18) * Ri;
    const specGrad2 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, r * 1.2);
    specGrad2.addColorStop(0,   "rgba(180,255,230,0.55)");
    specGrad2.addColorStop(0.5, "rgba(126,207,179,0.2)");
    specGrad2.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = specGrad2;
    ctx.beginPath();
    ctx.arc(sx2, sy2, r * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },


  /* ============================================================
     NOTES
  ============================================================ */
  spawnNote() {
    const angle  = Math.random() * Math.PI * 2;
    const minR   = this.currentOuterRadius + 150;
    const maxR   = this.currentOuterRadius + 210;
    const spawnR = Math.random() * (maxR - minR) + minR;
    const num    = this.currentNumber++;
    if (this.currentNumber > this.maxNumber) this.currentNumber = 1;
    this.notes.push({
      x: this.centerX + Math.cos(angle) * spawnR,
      y: this.centerY + Math.sin(angle) * spawnR,
      radius: this.baseOuterRadius * 0.12,
      value: num, id: num,
    });
  },

  drawNotes(ctx, dt) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      const dx = this.centerX - note.x;
      const dy = this.centerY - note.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      // Cap step to remaining distance — prevents overshoot jitter
      const step = Math.min(this.noteSpeed * dt, len);
      note.x += (dx / len) * step;
      note.y += (dy / len) * step;

      this._drawNoteCircle(ctx, note);

      if (len <= step + 1) {
        this.notes.splice(i, 1);
      }
    }
  },

  _drawNoteCircle(ctx, note) {
    ctx.save();
    const r = note.radius;
    const isC = this.mode === "cannon" || this.mode === "orb" || this.mode === "triple"
                ? this.shouldCollectCannon(note.value)
                : this.shouldCollect(note.value);

    const vis = this._noteVisual(isC, note.id || note.value);
    const h   = this.hintState;
    const isVisC = vis.showCorrect;
    const isVisW = vis.showWrong;

    if (isVisC || isVisW || vis.shimmerAmt > 0) {
      let haloAlpha = isVisC ? 0.16 : isVisW ? 0.11 : vis.shimmerAmt * 0.12;
      if (h === "subtle" && isVisC) haloAlpha = 0.07;
      const haloColor = isVisC
        ? `rgba(109,232,180,${haloAlpha})`
        : isVisW ? `rgba(232,124,109,${haloAlpha})`
                 : `rgba(140,180,220,${haloAlpha})`;
      const grd = ctx.createRadialGradient(note.x, note.y, r * 0.2, note.x, note.y, r * 1.4);
      grd.addColorStop(0, haloColor); grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(note.x, note.y, r * 1.4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.beginPath(); ctx.arc(note.x, note.y, r, 0, Math.PI * 2);
    let bodyFill, rimColor, shadowCol;
    if (isVisC && h !== "subtle") {
      bodyFill = "#0e3028"; rimColor = this.C.correct; shadowCol = "rgba(109,232,180,0.45)";
    } else if (isVisW) {
      bodyFill = "#2a1010"; rimColor = this.C.wrong; shadowCol = "rgba(232,124,109,0.4)";
    } else {
      bodyFill  = "#102140";
      rimColor  = `rgba(${Math.round(100+vis.shimmerAmt*80)},${Math.round(160+vis.shimmerAmt*40)},${Math.round(200+vis.shimmerAmt*30)},${0.55+vis.shimmerAmt*0.35})`;
      shadowCol = `rgba(90,150,200,${0.25+vis.shimmerAmt*0.2})`;
    }
    ctx.shadowColor = shadowCol; ctx.shadowBlur = 20;
    ctx.fillStyle = bodyFill; ctx.fill();
    ctx.strokeStyle = rimColor; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath(); ctx.arc(note.x - r * 0.27, note.y - r * 0.27, r * 0.20, 0, Math.PI * 2);
    ctx.fillStyle = isVisC && h !== "subtle" ? "rgba(200,255,230,0.30)" : "rgba(200,230,255,0.22)";
    ctx.fill();

    if (h === "subtle" && !isC) {
      ctx.globalAlpha = 0.18; ctx.fillStyle = "#aac8e0";
      ctx.font = `bold ${Math.round(r * 0.42)}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", note.x, note.y - r * 0.55); ctx.globalAlpha = 1;
    }

    ctx.fillStyle = this.C.noteText;
    ctx.font = `bold ${Math.round(r * 0.72)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(note.value, note.x, note.y);
    ctx.restore();
  },


  /* ============================================================
     COLLISION
  ============================================================ */
  shouldCollect(number) {
    if (this.mode === "default") return number % this.skipAmount === 0;
    if (this.mode === "pattern") {
      const cycle = this.pattern.skip + this.pattern.collect;
      return (number - 1) % cycle >= this.pattern.skip;
    }
    return false;
  },

  shouldCollectCannon(number) { return number % this.skipAmount === 0; },

  checkCollision(fingerX, fingerY) {
    this.notes.forEach((note, index) => {
      const dx = fingerX - note.x, dy = fingerY - note.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const dfc  = Math.sqrt((note.x - this.centerX)**2 + (note.y - this.centerY)**2);
      const onRing = dfc + note.radius > this.currentInnerRadius &&
                     dfc - note.radius < this.currentOuterRadius;
      if (dist < note.radius + 20 && onRing) {
        if (this.shouldCollect(note.value)) {
          this.combo++;
          if (this.combo % 5 === 0) this.multiplier++;
          this.score += 10 * this.multiplier;
          this.lastHitType = "CORRECT";
          this._gainXP(1);
          this._recoverSpeed();
          this.popEffects.push({ x: note.x, y: note.y, life: 0, color: this.C.correct });
        } else {
          this.combo = 0; this.multiplier = 1;
          this.score -= 5; this.lastHitType = "WRONG";
          this._penalizeSpeed();
          this.popEffects.push({ x: note.x, y: note.y, life: 0, color: this.C.wrong });
        }
        this.hitTextTimer = 30;
        this.notes.splice(index, 1);
      }
    });
  },

  checkCannonCollision(fingerX, fingerY) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (note.spawnProtected) continue;
      const dx = fingerX - note.x, dy = fingerY - note.y;
      if (Math.sqrt(dx*dx + dy*dy) < note.radius + 20) {
        if (this.shouldCollectCannon(note.value)) {
          this.score += 10; this.lastHitType = "CORRECT";
          this._gainXP(1); this._recoverSpeed();
          this.createExplosion(note.x, note.y, this.C.correct);
        } else {
          this.score -= 5; this.lastHitType = "WRONG";
          this._penalizeSpeed();
          this.createExplosion(note.x, note.y, this.C.wrong);
        }
        this.hitTextTimer = 30;
        this.notes.splice(i, 1);
      }
    }
  },


  /* ============================================================
     POP EFFECTS
  ============================================================ */
  drawPopEffects(ctx) {
    for (let i = this.popEffects.length - 1; i >= 0; i--) {
      const p = this.popEffects[i];
      p.life += 0.025;
      const ease = 1 - Math.pow(1 - p.life, 2);
      const scale = 1 + ease * 0.5;
      ctx.save(); ctx.globalAlpha = 1 - ease;
      ctx.translate(p.x, p.y); ctx.scale(scale, scale);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (p.life >= 1) this.popEffects.splice(i, 1);
    }
  },


  /* ============================================================
     HIT TEXT
  ============================================================ */
  drawHitText(ctx) {
    if (this.hitTextTimer <= 0 && this.missQueue.length > 0) {
      this.missQueue.sort((a, b) => a - b);
      this.lastHitType = "YOU SKIPPED NUMBER " + this.missQueue.shift();
      this.hitTextTimer = 40;
      this._penalizeSpeed();
    }
    if (this.hitTextTimer > 0) {
      const alpha = Math.sin((this.hitTextTimer / 40) * Math.PI);
      let color = "#ffffff";
      if (this.lastHitType === "CORRECT")           color = this.C.correct;
      else if (this.lastHitType === "WRONG")         color = this.C.wrong;
      else if (this.lastHitType.includes("SKIPPED")) color = this.C.gold;
      ctx.save();
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.font = "bold 34px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.fillText(this.lastHitType, this.centerX, this.centerY - 130);
      ctx.restore();
      this.hitTextTimer--;
    }
  },


  /* ============================================================
     MODE ACTIVATORS
  ============================================================ */
  activatePatternMode() {
    this.mode = "pattern";
    this.pattern.skip    = Math.floor(Math.random() * 5) + 1;
    this.pattern.collect = Math.floor(Math.random() * 5) + 1;
    this.gameTitle = "SKIP " + this.pattern.skip + " COLLECT " + this.pattern.collect;
  },

  activateCannonMode() {
    this.mode = "cannon"; this._resetLauncherState();
    this.gameTitle = "CANNON SKIP " + this.skipAmount;
  },

  activateOrbMode() {
    this.mode = "orb"; this._resetLauncherState();
    this.orbAngle = 0; this.orbTargetAngle = 0;
    this.gameTitle = "ORB SKIP " + this.skipAmount;
  },

  activateTripleCannonMode() {
    this.mode = "triple"; this._resetLauncherState();
    this.tripleBaseAngle = 0; this.tripleTargetAngle = 0;
    this.tripleCannons = [];
    const sp = (Math.PI * 2) / this.tripleCount;
    for (let i = 0; i < this.tripleCount; i++) this.tripleCannons.push({ offset: i * sp });
    this.gameTitle = "TRIPLE CANNON SKIP " + this.skipAmount;
  },

  _resetLauncherState() {
    this.notes = []; this.explosions = [];
    this.combo = 0; this.multiplier = 1;
    this.cannonAngle = 0; this.cannonTargetAngle = 0;
    this.pendingShot = null; this.lastCannonNote = null;
    this.previewCannons = []; this.previewTimer = 0;
    this.skipAmount = this.getRandomSkip();
    this.noteSpeed = this.speedCap;
  },


  /* ============================================================
     CANNON
  ============================================================ */
  spawnCannonNote() {
    if (this.pendingShot) return;
    const angle = Math.random() * Math.PI * 2;
    const num   = this.currentNumber++;
    if (this.currentNumber > this.maxNumber) this.currentNumber = 1;
    this.pendingShot = { angle, speed: this.noteSpeed, value: num, id: num };
    this.cannonTargetAngle = angle + Math.PI / 2;
    this.startCharging();
  },

  updateCannonNotes(ctx, dt) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      note.x += note.vx * dt; note.y += note.vy * dt;
      this.updateLauncherProtection(note);
      this._drawNoteCircle(ctx, note);
      const m = 120;
      const off = note.x < -m || note.x > this.centerX*2+m || note.y < -m || note.y > this.centerY*2+m;
      if (off) {
        if (this.shouldCollectCannon(note.value)) {
          this.score -= 10; this.combo = 0; this.multiplier = 1;
          this.missQueue.push(note.value);
          this._penalizeSpeed();
          this.createExplosion(note.x, note.y, "#e8a06d");
        }
        this.notes.splice(i, 1);
      }
    }
  },

  drawCannon(ctx, dt = 1 / 60) {
    const size = this.baseOuterRadius * 0.35;
    this.cannonLength = size * 1.4;
    let diff = this.cannonTargetAngle - this.cannonAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.cannonAngle += diff * 0.18;
    if (this.pendingShot && Math.abs(diff) < 0.05) this.fireCannon();

    ctx.save(); ctx.translate(this.centerX, this.centerY); ctx.rotate(this.cannonAngle);
    const bg = ctx.createRadialGradient(0, 0, size*0.1, 0, 0, size*0.6);
    bg.addColorStop(0, "#2a4a6e"); bg.addColorStop(1, "#152035");
    ctx.beginPath(); ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = bg; ctx.shadowColor = this.C.accent; ctx.shadowBlur = 18;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#3a6080";
    ctx.beginPath();
    const bx = -size * 0.13, by = -this.cannonLength, bw = size * 0.26, bh = this.cannonLength;
    ctx.moveTo(bx + 6, by); ctx.lineTo(bx + bw - 6, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 6);
    ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx, by + 6); ctx.quadraticCurveTo(bx, by, bx + 6, by);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = this.C.accent; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  },

  fireCannon() {
    if (!this.pendingShot) return;
    const { angle, speed, value, id } = this.pendingShot;
    this.notes.push({
      x: this.centerX, y: this.centerY,
      radius: this.baseOuterRadius * 0.12, value, id: id || value,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      spawnProtected: true,
    });
    this.pendingShot = null; this.isCharging = false; this.charge = 0; this.chargeParticles = [];
  },


  /* ============================================================
     ORB LAUNCHER
  ============================================================ */
  spawnOrbNote() {
    const angle = Math.random() * Math.PI * 2;
    this.orbTargetAngle = angle + Math.PI / 2;
    const num = this.currentNumber++;
    if (this.currentNumber > this.maxNumber) this.currentNumber = 1;
    const speed = this.noteSpeed;
    setTimeout(() => {
      this.notes.push({
        x: this.centerX, y: this.centerY,
        radius: this.baseOuterRadius * 0.12, value: num, id: num,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        spawnProtected: true,
      });
    }, 120);
  },

  drawOrbLauncher(ctx, dt = 1 / 60) {
    const sz = this.baseOuterRadius * 0.6;
    let diff = this.orbTargetAngle - this.orbAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.orbAngle += diff * 0.18;
    ctx.save(); ctx.translate(this.centerX, this.centerY); ctx.rotate(this.orbAngle);
    if (this.orbImage && this.orbImage.complete && this.orbImage.naturalWidth > 0) {
      const img = this.orbImage, sc = sz / Math.max(img.width, img.height);
      ctx.scale(1, -1);
      ctx.drawImage(img, -img.width*sc/2, -img.height*sc/2, img.width*sc, img.height*sc);
    } else {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz / 2);
      g.addColorStop(0, "#8ecae6"); g.addColorStop(0.55, "#1a3a5c"); g.addColorStop(1, "rgba(14,30,50,0)");
      ctx.fillStyle = g; ctx.shadowColor = this.C.accent; ctx.shadowBlur = 28;
      ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.restore();
  },


  /* ============================================================
     TRIPLE CANNON
  ============================================================ */
  spawnTripleNote() {
    if (this.pendingShot) return;
    const angle = Math.random() * Math.PI * 2;
    this.pendingShot = { angle, speed: this.noteSpeed };
    this.tripleTargetAngle = angle + Math.PI / 2;
    this.startCharging();
  },

  drawTripleCannons(ctx, dt = 1 / 60) {
    const sz = this.baseOuterRadius * 0.6;
    let diff = this.tripleTargetAngle - this.tripleBaseAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.tripleBaseAngle += diff * 0.18;

    if (this.pendingShot && this.previewTimer <= 0 && this.previewCannons.length === 0 && Math.abs(diff) < 0.05)
      this.fireTriple();

    for (let i = 0; i < this.tripleCannons.length; i++) {
      const cannon = this.tripleCannons[i];
      const angle  = this.tripleBaseAngle + cannon.offset;
      ctx.save(); ctx.translate(this.centerX, this.centerY); ctx.rotate(angle);
      if (this.orbImage && this.orbImage.complete && this.orbImage.naturalWidth > 0) {
        const img = this.orbImage, sc = sz / Math.max(img.width, img.height);
        ctx.scale(1, -1);
        ctx.drawImage(img, -img.width*sc/2, -img.height*sc/2, img.width*sc, img.height*sc);
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz/2);
        g.addColorStop(0, "#8ecae6"); g.addColorStop(1, "rgba(14,30,50,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, sz * 0.8, 0, Math.PI * 2 * 0.8); ctx.fill();
      }
      if (this.previewCannons.includes(i) && this.previewTimer > 0) {
        const pulse = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
        const miniR = sz * 0.18, offY = -sz * 0.6;
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.scale(1, -1);
        const g2 = ctx.createRadialGradient(0, offY, 0, 0, offY, miniR);
        g2.addColorStop(0, "rgba(245,200,66,1)"); g2.addColorStop(0.4, "rgba(245,200,66,0.55)"); g2.addColorStop(1, "rgba(245,200,66,0)");
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(0, offY, miniR * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  },

  fireTriple() {
    if (!this.pendingShot) return;
    const pool = [1,1,2,2,2,2,2,3];
    const fc   = pool[Math.floor(Math.random() * pool.length)];
    this.previewCannons = [];
    while (this.previewCannons.length < fc) {
      const ri = Math.floor(Math.random() * this.tripleCount);
      if (!this.previewCannons.includes(ri)) this.previewCannons.push(ri);
    }
    this.previewTimer = this.previewDuration;
  },

  executeTripleShot() {
    if (!this.pendingShot) return;
    const speed = this.pendingShot.speed;
    for (const i of this.previewCannons) {
      const angle = this.tripleBaseAngle + this.tripleCannons[i].offset - Math.PI / 2;
      const value = this.currentNumber++;
      if (this.currentNumber > this.maxNumber) this.currentNumber = 1;
      this.notes.push({
        x: this.centerX, y: this.centerY,
        radius: this.baseOuterRadius * 0.12, value, id: value,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        spawnProtected: true,
      });
    }
    this.previewCannons = []; this.pendingShot = null;
    this.isCharging = false; this.charge = 0; this.chargeParticles = [];
  },


  /* ============================================================
     LAUNCHER SHARED
  ============================================================ */
  updateLauncherProtection(note) {
    const dx = note.x - this.centerX, dy = note.y - this.centerY;
    if (Math.sqrt(dx*dx + dy*dy) > this.launcherSafeRadius) note.spawnProtected = false;
  },

  drawLauncherZone(ctx) {
    ctx.save(); ctx.setLineDash([6, 9]);
    ctx.strokeStyle = "rgba(140,180,220,0.18)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.centerX, this.centerY, this.launcherSafeRadius, 0, Math.PI * 2);
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  },

  startCharging() {
    this.charge = 0; this.isCharging = true; this.chargeParticles = [];
  },

  updateCharging(dt) {
    if (!this.isCharging) return;
    this.charge = Math.min(1, this.charge + this.chargeSpeed * dt);
    if (Math.random() < 0.35) {
      const a = Math.random() * Math.PI * 2;
      this.chargeParticles.push({
        x: this.centerX + Math.cos(a) * this.launcherSafeRadius,
        y: this.centerY + Math.sin(a) * this.launcherSafeRadius,
        life: 1,
      });
    }
    for (let i = this.chargeParticles.length - 1; i >= 0; i--) {
      const p = this.chargeParticles[i];
      p.x += (this.centerX - p.x) * 0.08; p.y += (this.centerY - p.y) * 0.08;
      p.life -= dt * 1.2;
      if (p.life <= 0) this.chargeParticles.splice(i, 1);
    }
  },

  drawCharging(ctx) {
    if (!this.isCharging) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of this.chargeParticles) {
      ctx.globalAlpha = p.life * 0.7; ctx.fillStyle = this.C.gold;
      ctx.shadowColor = this.C.gold; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const gr = this.baseOuterRadius * 0.18 * (0.5 + this.charge * 0.8);
    const g  = ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, gr);
    g.addColorStop(0, `rgba(245,200,66,${0.65 * this.charge})`); g.addColorStop(1, "rgba(245,200,66,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.centerX, this.centerY, gr, 0, Math.PI * 2); ctx.fill();
  },


  /* ============================================================
     EXPLOSIONS
  ============================================================ */
  createExplosion(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * 200 + 100;
      this.explosions.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 0, color });
    }
  },

  drawExplosions(ctx) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const p = this.explosions[i];
      p.life += 0.03; p.x += p.vx * 0.016; p.y += p.vy * 0.016;
      ctx.save(); ctx.globalAlpha = 1 - p.life;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, this.baseOuterRadius * 0.038, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (p.life >= 1) this.explosions.splice(i, 1);
    }
  },


  /* ============================================================
     UTILITY
  ============================================================ */
  getRandomSkip() {
    const w = [2,2,2,2,3,3,3,3,3,3,4,4,4,5,5,6,7,8,9];
    return w[Math.floor(Math.random() * w.length)];
  },
};