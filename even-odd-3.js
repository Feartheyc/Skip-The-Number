const sfxButtonClick_8 = new Audio('SFX-Bhavya/buttonclick.mp3');
sfxButtonClick_8.volume = 0.5;
const sfxCorrect_8 = new Audio('SFX-Bhavya/Correct.mp3');
sfxCorrect_8.volume = 0.5;
const sfxWrong_8 = new Audio('SFX-Bhavya/Wrong.mp3');
sfxWrong_8.volume = 0.5;
const sfxLevel_8 = new Audio('SFX-Bhavya/level.mp3');
sfxLevel_8.volume = 0.5;

const Game8 = {
  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  PIVOT_OFFSET: 120,
  PIVOT_RADIUS: 5,
  ARM_LENGTH: 140,
  BALL_RADIUS: 30,
  MAX_BALLS: 3,

  LOCK_TIME: 2000,
  ELASTICITY: 1.3,
  ARM_POWER: 0.8,

  EDGE_SIZE: 35,
  LINE_GAP: 40,

  gameStarted: false,
  running: false,
  score: 0,

  scoreScale: 1,
  scoreColor: "white",

  balls: [],
  particles: [],
  floaters: [],

  spawnTimer: 0,
  spawnRate: 2000,
  minSpawnRate: 2000,
  maxSpawnRate: 3000,
  spawnMode: "top-bottom", 
  modeTimer: 0,
  lastTime: performance.now(),
  shakeTimer: 0,

  pivotLockTimer: { left: 0, right: 0 },

  pose: null,
  // ADDITIVE: Track both hands for steering logic
  armData: { right: null, left: null },
  armVelocity: {
    right: { vx: 0, vy: 0, last: null }
  },

  CENTER_X: 0,
  CENTER_Y: 0,
  cssWidth: 0,
  cssHeight: 0,

  SMOOTH: 0.6,
  MIN_ARM_LENGTH: 25,

  init() {
    try { if (screen.orientation && screen.orientation.lock) { screen.orientation.lock("landscape").catch(e => console.log("Orientation lock failed:", e)); } } catch (e) { }
    window.addEventListener('click', () => {
      if (window.currentGame !== Game8) return;
      sfxButtonClick_8.currentTime = 0;
      sfxButtonClick_8.play().catch(() => { });
    });
    this.currentMissingState = null;
    this.missingFrames = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.CENTER_X = (canvasElement.width / dpr) / 2;
    this.CENTER_Y = (canvasElement.height / dpr) / 2;

    this.particlePool = [];
    this.floaterPool = [];
    if (!this.edgeZoneCanvas) this.edgeZoneCanvas = document.createElement("canvas");
    if (!this.ballCanvas) this.ballCanvas = document.createElement("canvas");
    if (!this.armCanvas) this.armCanvas = document.createElement("canvas");
    if (!this.wristCanvas) this.wristCanvas = document.createElement("canvas");

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.running = true;
    this.score = 0;
    this.balls = [];
    this.particles = [];
    this.floaters = [];
    this.spawnTimer = 0;
    this.spawnRate = 2000;
    this.spawnMode = "top-bottom";
    this.modeTimer = 0;
    this.lastTime = performance.now();
    this.gameStarted = false;

    this.scoreScale = 1;
    this.scoreColor = "white";

    this.pivotLockTimer = { left: 0, right: 0 };

    this.initPose();
  },

  initPose() {
    if (this.pose) return;
    this.pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    this.pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults(this.onPoseResults.bind(this));
    this.poseBusy = false;

    let lastPoseTime = 0;
    window.sendFrameToPose = async (image) => {
      if (!this.running || this.poseBusy) return;
      const now = performance.now();
      if (now - lastPoseTime < 80) return; 
      lastPoseTime = now;
      this.poseBusy = true;
      try { await this.pose.send({ image }); } catch (e) { console.error(e); }
      this.poseBusy = false;
    };
  },

  onPoseResults(results) {
    let state = null;
    if (!results.poseLandmarks) {
      state = "arm";
    } else {
      const lm = results.poseLandmarks;
      // Track both wrists for the steering wheel
      const leftWrist = lm[15];
      const rightWrist = lm[16];
      
      const isBad = (pt) => !pt || pt.visibility < 0.3 || pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1;
      
      if (isBad(leftWrist) || isBad(rightWrist)) state = "wrist";
    }

    if (state) {
      this.missingFrames = (this.missingFrames || 0) + 1;
      if (this.missingFrames > 5) this.currentMissingState = state;
    } else {
      this.missingFrames = 0;
      this.currentMissingState = null;
    }

    if (!results.poseLandmarks) return;
    const lm = results.poseLandmarks;

    const mapPoint = (p) => ({
      x: (1 - p.x) * this.cssWidth,
      y: p.y * this.cssHeight
    });

    const smooth = (oldP, newP) => {
      if (!oldP) return newP;
      const S = 0.75; 
      return {
        x: oldP.x * S + newP.x * (1 - S),
        y: oldP.y * S + newP.y * (1 - S)
      };
    };

    // Calculate Steering Angle
    const lw = mapPoint(lm[15]); // Left Wrist
    const rw = mapPoint(lm[16]); // Right Wrist

    // Smoothen the raw points before calculating angle
    if (!this._rawL) this._rawL = lw;
    if (!this._rawR) this._rawR = rw;
    this._rawL = smooth(this._rawL, lw);
    this._rawR = smooth(this._rawR, rw);

    const angle = Math.atan2(this._rawR.y - this._rawL.y, this._rawR.x - this._rawL.x);

    // ADDITIVE: Keep original property names (shoulder/wrist) so physics works
    // Shoulder = Pivot point (Center)
    // Wrist = Calculated tip of the arm based on steering angle
    this.armData.right = {
      shoulder: { x: this.CENTER_X, y: this.CENTER_Y },
      wrist: {
        x: this.CENTER_X + Math.cos(angle) * this.armLength,
        y: this.CENTER_Y + Math.sin(angle) * this.armLength
      }
    };

    // Helper for checkPivotLock (Distance between hands to start)
    this.armData.left = { shoulder: lw, wrist: rw };
  },

  rebuildCaches() {
    if (!this.bgCanvas) this.bgCanvas = document.createElement("canvas");
    this.bgCanvas.width = this.cssWidth;
    this.bgCanvas.height = this.cssHeight;
    const bgCtx = this.bgCanvas.getContext("2d");

    bgCtx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    bgCtx.lineWidth = 1;
    const step = 40 * this.scale;
    bgCtx.beginPath();
    for (let x = 0; x < this.cssWidth; x += step) {
      bgCtx.moveTo(x, 0); bgCtx.lineTo(x, this.cssHeight);
    }
    for (let y = 0; y < this.cssHeight; y += step) {
      bgCtx.moveTo(0, y); bgCtx.lineTo(this.cssWidth, y);
    }
    bgCtx.stroke();

    const w = this.cssWidth;
    const h = this.cssHeight;
    const e = this.edgeSize;
    const gap = this.lineGap;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;
    const overS = e * 1.3;

    bgCtx.globalAlpha = 0.85;

    // Red - Even (Top Half)
    bgCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
    bgCtx.fillRect(0, 0, overS, cy - gap + 5);
    bgCtx.fillRect(0, 0, cx - gap + 5, overS);
    bgCtx.fillRect(w - overS, 0, overS, cy - gap + 5);
    bgCtx.fillRect(cx + gap - 5, 0, w, overS);

    bgCtx.fillStyle = "rgba(255, 0, 0, 0.8)";
    bgCtx.fillRect(0, 0, e, cy - gap);
    bgCtx.fillRect(0, 0, cx - gap, e);
    bgCtx.fillRect(w - e, 0, e, cy - gap);
    bgCtx.fillRect(cx + gap, 0, w - (cx + gap), e);

    // Blue - Odd (Bottom Half)
    bgCtx.fillStyle = "rgba(0, 255, 255, 0.3)";
    bgCtx.fillRect(0, cy + gap - 5, overS, h);
    bgCtx.fillRect(0, h - overS, cx - gap + 5, overS);
    bgCtx.fillRect(w - overS, cy + gap - 5, overS, h);
    bgCtx.fillRect(cx + gap - 5, h - overS, w, overS);

    bgCtx.fillStyle = "rgba(0, 255, 255, 0.8)";
    bgCtx.fillRect(0, cy + gap, e, h - (cy + gap));
    bgCtx.fillRect(0, h - e, cx - gap, e);
    bgCtx.fillRect(w - e, cy + gap, e, h - (cy + gap));
    bgCtx.fillRect(cx + gap, h - e, w - (cx + gap), e);

    bgCtx.globalAlpha = 1;
    bgCtx.strokeStyle = "rgba(255,255,255,0.2)";
    bgCtx.lineWidth = 2 * this.scale;
    const insetV = 200 * this.scale;
    const insetH = 600 * this.scale;
    bgCtx.beginPath();
    bgCtx.moveTo(cx - gap, 0); bgCtx.lineTo(cx - gap, cy - insetV);
    bgCtx.moveTo(cx - gap, cy + insetV); bgCtx.lineTo(cx - gap, h);
    bgCtx.moveTo(cx + gap, 0); bgCtx.lineTo(cx + gap, cy - insetV);
    bgCtx.moveTo(cx + gap, cy + insetV); bgCtx.lineTo(cx + gap, h);
    bgCtx.moveTo(0, cy - gap); bgCtx.lineTo(cx - insetH, cy - gap);
    bgCtx.moveTo(cx + insetH, cy - gap); bgCtx.lineTo(w, cy - gap);
    bgCtx.moveTo(0, cy + gap); bgCtx.lineTo(cx - insetH, cy + gap);
    bgCtx.moveTo(cx + insetH, cy + gap); bgCtx.lineTo(w, cy + gap);
    bgCtx.stroke();

    const ballPad = 30; 
    const br = this.ballRadius;
    this.ballCanvas.width = (br + ballPad) * 2;
    this.ballCanvas.height = (br + ballPad) * 2;
    const bCtx = this.ballCanvas.getContext("2d");
    bCtx.shadowBlur = 15;
    bCtx.shadowColor = "#ffffff";
    bCtx.fillStyle = "#ffffff";
    bCtx.beginPath();
    bCtx.arc(br + ballPad, br + ballPad, br, 0, Math.PI * 2);
    bCtx.fill();

    const armPad = 40;
    const al = this.armLength;
    this.armCanvas.width = al + armPad * 2;
    this.armCanvas.height = armPad * 2;
    const aCtx = this.armCanvas.getContext("2d");
    aCtx.shadowBlur = 20;
    aCtx.shadowColor = "#f36affff";
    aCtx.strokeStyle = "#ac2fffff";
    aCtx.lineWidth = 10 * this.scale;
    aCtx.beginPath();
    aCtx.moveTo(armPad, armPad);
    aCtx.lineTo(armPad + al, armPad);
    aCtx.stroke();
    aCtx.shadowBlur = 0;
    aCtx.beginPath();
    aCtx.arc(armPad + al, armPad, 8 * this.scale, 0, Math.PI * 2);
    aCtx.fillStyle = "#b906b9ff";
    aCtx.fill();

    const wPad = 30;
    const wr = 18 * this.scale;
    this.wristCanvas.width = (wr + wPad) * 2;
    this.wristCanvas.height = (wr + wPad) * 2;
    const wCtx = this.wristCanvas.getContext("2d");
    wCtx.shadowBlur = 15;
    wCtx.shadowColor = "#BB66FF";
    wCtx.strokeStyle = "#BB66FF";
    wCtx.lineWidth = 4 * this.scale;
    wCtx.beginPath();
    wCtx.arc(wr + wPad, wr + wPad, wr, 0, Math.PI * 2);
    wCtx.stroke();
  },

  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    let newScale = Math.min(cssW / this.BASE_WIDTH, cssH / this.BASE_HEIGHT);
    if (!newScale || newScale <= 0) newScale = 1;
    if (this.scale && Math.abs(newScale - this.scale) < 0.001 && this.cssWidth === cssW && this.cssHeight === cssH) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvasElement.width = cssW * dpr;
    canvasElement.height = cssH * dpr;
    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.scale = newScale;

    this._armLength = this.ARM_LENGTH * this.scale;
    this._ballRadius = this.BALL_RADIUS * this.scale;
    this._edgeSize = this.EDGE_SIZE * this.scale;
    this._lineGap = this.LINE_GAP * this.scale;
    this._pivotRadius = this.PIVOT_RADIUS * this.scale;
    this._pivotOffset = this.PIVOT_OFFSET * this.scale;

    this.CENTER_X = cssW / 2;
    this.CENTER_Y = cssH / 2;

    const ctx = canvasElement.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.fontBall = `bold ${30 * this.scale}px Orbitron`;
    this.fontUI = `bold ${30 * this.scale}px Orbitron`;
    this.fontLegend = `bold ${36 * this.scale}px Orbitron`;
    this.fontFloater = `bold ${24 * this.scale}px Orbitron`;
    this.fontScore = `bold ${20 * this.scale}px Orbitron`;
    this.fontScoreBig = `bold ${40 * this.scale}px Orbitron`;
    this.rebuildCaches();
  },

  update(ctx) {
    if (!this.running) return;
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    if (this.scoreScale > 1) this.scoreScale = Math.max(1, this.scoreScale - 0.05);

    if (!this.gameStarted) this.checkPivotLock(deltaTime);
    else {
      this.handleSpawning(deltaTime);
      this.updateBalls(deltaTime / 16.67);
      this.checkPhysics();
      this.checkScoring();
    }

    this.updateParticles();
    this.updateFloaters();
    this.drawBackground(ctx);
    if (this.gameStarted) {
      this.drawBalls(ctx);
      this.drawArms(ctx);
    }
    this.drawPivots(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    this.drawUI(ctx);
  },

  handleSpawning(dt) {
    this.spawnTimer += dt;
    this.modeTimer += dt;
    if (this.modeTimer > 12000) {
      sfxLevel_8.currentTime = 0;
      sfxLevel_8.play().catch(() => { });
      const allModes = ["top-bottom", "left-right", "all", "random-one"];
      const otherModes = allModes.filter(m => m !== this.spawnMode);
      this.spawnMode = otherModes[Math.floor(Math.random() * otherModes.length)];
      this.modeTimer = 0;
      this.spawnFloatingText(this.CENTER_X, this.CENTER_Y - 150 * this.scale, `Spawn Mode: ${this.spawnMode.toUpperCase()}`, "white", 0, -0.2, 5.0);
    }
    if (this.spawnTimer > this.spawnRate && this.balls.length < this.MAX_BALLS) {
      this.spawnBall();
      this.spawnTimer = 0;
    }
  },

  spawnBall() {
    const number = Math.floor(Math.random() * 100) + 1;
    const isOdd = number % 2 !== 0;
    const speed = (1 + (2000 - this.spawnRate) / 2000) * this.scale;
    let sides = [];
    if (this.spawnMode === "top-bottom") sides = [0, 1];
    else if (this.spawnMode === "left-right") sides = [2, 3];
    else if (this.spawnMode === "all") sides = [0, 1, 2, 3];
    else if (this.spawnMode === "random-one") {
      if (!this._lastRandomSide) this._lastRandomSide = Math.floor(Math.random() * 4);
      sides = [this._lastRandomSide];
      if (Math.random() < 0.1) this._lastRandomSide = Math.floor(Math.random() * 4);
    }
    const side = sides[Math.floor(Math.random() * sides.length)];
    let x, y, tx, ty;
    const outsideOffset = this.ballRadius * 2;
    const farBoundary = 2000 * this.scale;
    if (side === 0) { x = this.CENTER_X; y = -outsideOffset; tx = x; ty = this.cssHeight + farBoundary; }
    else if (side === 1) { x = this.CENTER_X; y = this.cssHeight + outsideOffset; tx = x; ty = -farBoundary; }
    else if (side === 2) { x = -outsideOffset; y = this.CENTER_Y; tx = this.cssWidth + farBoundary; ty = y; }
    else if (side === 3) { x = this.cssWidth + outsideOffset; y = this.CENTER_Y; tx = -farBoundary; ty = y; }
    this.balls.push({ x, y, targetX: tx, targetY: ty, vx: 0, vy: 0, speed, number, isOdd, color: "#ffffff", trail: [], trailIdx: 0, hitCooldown: 0, scored: false, hasCollided: false });
  },

  updateBalls(dt) {
    for (let i = 0; i < this.balls.length; i++) {
      let b = this.balls[i];
      if (b.scored) continue;
      b.prevX = b.x; b.prevY = b.y;
      const dx = b.targetX - b.x;
      const dy = b.targetY - b.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const step = Math.min(b.speed * dt, len);
      b.vx = (dx / len) * b.speed;
      b.vy = (dy / len) * b.speed;
      b.x += (dx / len) * step;
      b.y += (dy / len) * step;
      if (b.trailIdx === undefined) b.trailIdx = 0;
      if (b.trail.length < 9) b.trail.push({ x: b.x, y: b.y });
      else { b.trail[b.trailIdx].x = b.x; b.trail[b.trailIdx].y = b.y; b.trailIdx = (b.trailIdx + 1) % 9; }
      if (b.hitCooldown > 0) b.hitCooldown -= dt;
      const limit = 150 * this.scale;
      if (len <= step + 1 || b.x < -limit || b.x > this.cssWidth + limit || b.y < -limit || b.y > this.cssHeight + limit) b.remove = true;
    }
    this.balls = this.balls.filter(b => !b.remove);
  },

  checkPhysics() {
    if (this.balls.length === 0) return;
    const pivot = { x: this.CENTER_X, y: this.CENTER_Y };
    const arm = this.armData.right;
    if (!arm?.wrist || !arm?.shoulder) return;
    const angle = Math.atan2(arm.wrist.y - arm.shoulder.y, arm.wrist.x - arm.shoulder.x);
    const angles = [angle, angle + Math.PI];
    if (!this.lastArmAngle) this.lastArmAngle = angle;
    let angVel = angle - this.lastArmAngle;
    this.lastArmAngle = angle;
    angVel = Math.max(-0.3, Math.min(0.3, angVel));
    const tangentialSpeed = angVel * this.armLength * 1.2;
    for (let a = 0; a < angles.length; a++) {
      let stickAngle = angles[a];
      const tipX = pivot.x + Math.cos(stickAngle) * this.armLength;
      const tipY = pivot.y + Math.sin(stickAngle) * this.armLength;
      const armVelX = -Math.sin(stickAngle) * tangentialSpeed;
      const armVelY = Math.cos(stickAngle) * tangentialSpeed;
      const radius = this.ballRadius + 6;
      for (let i = 0; i < this.balls.length; i++) {
        let b = this.balls[i];
        if (b.hitCooldown > 0 || b.scored) continue;
        const dx = tipX - pivot.x;
        const dy = tipY - pivot.y;
        const lenSq = dx * dx + dy * dy;
        let t = ((b.x - pivot.x) * dx + (b.y - pivot.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const closestX = pivot.x + dx * t;
        const closestY = pivot.y + dy * t;
        const distSq2 = (b.x - closestX) ** 2 + (b.y - closestY) ** 2;
        if (distSq2 > radius * radius) continue;
        const dist = Math.sqrt(distSq2);
        let nx = (b.x - closestX) / (dist || 1);
        let ny = (b.y - closestY) / (dist || 1);
        const relVX = b.vx - armVelX;
        const relVY = b.vy - armVelY;
        const dot = relVX * nx + relVY * ny;
        if (dot >= 0) continue;
        b.vx = (relVX - 2 * dot * nx) + armVelX;
        b.vy = (relVY - 2 * dot * ny) + armVelY;
        const maxSpeed = 18 * this.scale;
        let sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > maxSpeed) { b.vx = (b.vx / sp) * maxSpeed; b.vy = (b.vy / sp) * maxSpeed; sp = maxSpeed; }
        b.speed = sp;
        b.targetX = b.x + (b.vx / (b.speed || 1)) * 2000 * this.scale;
        b.targetY = b.y + (b.vy / (b.speed || 1)) * 2000 * this.scale;
        b.hitCooldown = 8 * this.scale;
        this.spawnExplosion(b.x, b.y, "white", 5);
      }
    }
  },

  checkScoring() {
    const w = this.cssWidth; const h = this.cssHeight;
    const e = this.edgeSize; const gap = this.lineGap;
    const cx = this.CENTER_X; const cy = this.CENTER_Y;
    const triggerEdge = e * 0.5;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      let b = this.balls[i];
      let scoreType = null;
      if (b.x < cx - gap) {
        if ((b.y < triggerEdge && b.vy < 0) || (b.y > h - triggerEdge && b.vy > 0) || (b.x < triggerEdge && b.vx < 0)) {
          scoreType = (b.y < cy) ? (!b.isOdd ? "good" : "bad") : (b.isOdd ? "good" : "bad");
        }
      } else if (b.x > cx + gap) {
        if ((b.y < triggerEdge && b.vy < 0) || (b.y > h - triggerEdge && b.vy > 0) || (b.x > w - triggerEdge && b.vx > 0)) {
          scoreType = (b.y < cy) ? (!b.isOdd ? "good" : "bad") : (b.isOdd ? "good" : "bad");
        }
      }
      if (scoreType) {
        const dx = cx - b.x; const dy = cy - b.y; const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (scoreType === "good") { this.updateScore(10, true); this.spawnFloatingText(b.x, b.y, "+10", "#00FF00", (dx/dist)*1.5, (dy/dist)*1.5, 2.5); this.spawnExplosion(b.x, b.y, "#00FF00", 8, (dx/dist)*3, (dy/dist)*3); }
        else { this.updateScore(-5, false); this.spawnFloatingText(b.x, b.y, "-5", "#FF0000", (dx/dist)*1.5, (dy/dist)*1.5, 2.5); this.spawnExplosion(b.x, b.y, "#FF0000", 5, (dx/dist)*3, (dy/dist)*3); this.shakeTimer = 25; }
        this.balls.splice(i, 1);
      }
    }
  },

  updateScore(amount, isGood) {
    if (isGood) { sfxCorrect_8.currentTime = 0; sfxCorrect_8.play().catch(() => { }); }
    else { sfxWrong_8.currentTime = 0; sfxWrong_8.play().catch(() => { }); }
    this.score += amount; this.scoreScale = 2.0; this.scoreColor = isGood ? "#00FF00" : "#FF0000";
    this.spawnRate = isGood ? Math.max(this.minSpawnRate, this.spawnRate - 100) : Math.min(this.maxSpawnRate, this.spawnRate + 200);
  },

  checkPivotLock(dt) {
    // Lock by checking if hands are leveled (steering wheel center)
    const armL = this.armData.left;
    const armR = this.armData.right;
    if (!armL?.shoulder || !armR?.wrist) return;
    
    const midX = (armL.shoulder.x + armR.wrist.x) / 2;
    const midY = (armL.shoulder.y + armR.wrist.y) / 2;
    const distSq = (midX - this.CENTER_X) ** 2 + (midY - this.CENTER_Y) ** 2;

    if (distSq < (150 * this.scale) ** 2) {
      this.pivotLockTimer.right += dt;
      this.lockProgress = Math.min(this.pivotLockTimer.right / this.LOCK_TIME, 1);
      if (this.pivotLockTimer.right > this.LOCK_TIME) {
        this.gameStarted = true;
        const video = document.getElementById("input_video");
        if (video) video.style.opacity = "0.2";
        this.spawnFloatingText(this.CENTER_X, this.CENTER_Y, "START!", "white");
      }
    } else { this.pivotLockTimer.right = 0; this.lockProgress = 0; }
  },

  spawnExplosion(x, y, color, count, biasX = 0, biasY = 0) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 5 + 2;
      let p = this.particlePool.pop() || {};
      p.x = x; p.y = y; p.vx = Math.cos(angle) * speed + biasX; p.vy = Math.sin(angle) * speed + biasY; p.life = 1.0; p.color = color;
      this.particles.push(p);
    }
  },

  spawnFloatingText(x, y, text, color, dx = 0, dy = -2, life = 1.0) {
    let f = this.floaterPool.pop() || {};
    f.x = x; f.y = y; f.text = text; f.color = color; f.life = life; f.dx = dx; f.dy = dy;
    this.floaters.push(f);
  },

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.05;
      if (p.life <= 0) { this.particlePool.push(p); this.particles.splice(i, 1); }
    }
  },

  updateFloaters() {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      let f = this.floaters[i]; f.x += f.dx || 0; f.y += f.dy; f.life -= 0.02;
      if (f.life <= 0) { this.floaterPool.push(f); this.floaters.splice(i, 1); }
    }
  },

  drawBackground(ctx) { if (this.bgCanvas) ctx.drawImage(this.bgCanvas, 0, 0); },

  drawBalls(ctx) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = this.fontBall;
    ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = this.ballRadius * 1.5; ctx.lineCap = "round"; ctx.globalAlpha = 0.25;
    for (let b of this.balls) {
      if (b.trail.length < 2) continue;
      let tIdx = b.trailIdx || 0; ctx.moveTo(b.trail[tIdx].x, b.trail[tIdx].y);
      for (let j = 1; j < b.trail.length; j++) { let idx = (tIdx + j) % b.trail.length; ctx.lineTo(b.trail[idx].x, b.trail[idx].y); }
    }
    ctx.stroke(); ctx.globalAlpha = 1.0;
    for (let b of this.balls) {
      if (this.ballCanvas) ctx.drawImage(this.ballCanvas, b.x - this.ballRadius - 30, b.y - this.ballRadius - 30);
      ctx.fillStyle = "black"; ctx.fillText(b.number, b.x, b.y);
    }
  },

  drawArms(ctx) {
    const arm = this.armData.right; if (!arm?.shoulder) return;
    const baseAngle = Math.atan2(arm.wrist.y - arm.shoulder.y, arm.wrist.x - arm.shoulder.x);
    if (this.armCanvas) {
      ctx.save(); ctx.translate(this.CENTER_X, this.CENTER_Y);
      ctx.save(); ctx.rotate(baseAngle); ctx.drawImage(this.armCanvas, -40, -40); ctx.restore();
      ctx.rotate(baseAngle + Math.PI); ctx.drawImage(this.armCanvas, -40, -40); ctx.restore();
    }
    if (this.wristCanvas) {
      const wr = 18 * this.scale;
      // Draw markers for both hands
      ctx.drawImage(this.wristCanvas, this.armData.left.shoulder.x - wr - 30, this.armData.left.shoulder.y - wr - 30);
      ctx.drawImage(this.wristCanvas, this.armData.left.wrist.x - wr - 30, this.armData.left.wrist.y - wr - 30);
    }
  },

  drawPivots(ctx) {
    const r = this.gameStarted ? this.PIVOT_RADIUS : 15;
    ctx.beginPath(); ctx.arc(this.CENTER_X, this.CENTER_Y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.gameStarted ? "#ff2491ff" : "#444"; ctx.fill();
    if (!this.gameStarted && this.lockProgress > 0) {
      ctx.beginPath(); ctx.arc(this.CENTER_X, this.CENTER_Y, r + 8 * this.scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.lockProgress);
      ctx.strokeStyle = "#BB66FF"; ctx.lineWidth = 6 * this.scale; ctx.stroke();
    }
  },

  drawParticles(ctx) {
    for (let p of this.particles) {
      ctx.fillStyle = p.color; const s = (4 * this.scale) * Math.max(0, p.life) * 2;
      ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
    }
  },

  drawFloaters(ctx) {
    ctx.font = this.fontFloater; ctx.textAlign = "center";
    for (let f of this.floaters) { ctx.globalAlpha = Math.max(0, Math.min(1, f.life)); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
  },

  drawUI(ctx) {
    if (!this.gameStarted) {
      ctx.textAlign = "center"; ctx.font = this.fontUI; ctx.fillStyle = "black";
      ctx.fillText("STEER HANDS TO START", this.CENTER_X + 2 * this.scale, this.CENTER_Y - 48 * this.scale);
      ctx.fillStyle = "white"; ctx.fillText("STEER HANDS TO START", this.CENTER_X, this.CENTER_Y - 50 * this.scale);
    }
    ctx.textAlign = "center"; ctx.font = this.scoreScale > 1.1 ? this.fontScoreBig : this.fontScore;
    ctx.fillStyle = this.scoreColor; ctx.fillText(this.score, this.CENTER_X, 100 * this.scale);
    const w = this.cssWidth; const h = this.cssHeight; ctx.font = this.fontLegend; ctx.textAlign = "center";
    ctx.fillStyle = "#FF0000"; 
    ctx.fillText("Even", w * 0.07, 85 * this.scale);
    ctx.fillText("Even", w * 0.93, 85 * this.scale);
    const bh = h - 65 * this.scale;
    ctx.fillStyle = "#00FFFF"; 
    ctx.fillText("Odd", w * 0.07, bh);
    ctx.fillText("Odd", w * 0.93, bh);
    if (this.currentMissingState) {
      ctx.fillStyle = "red"; ctx.font = this.fontUI;
      ctx.fillText("BRING BOTH HANDS IN VIEW", this.CENTER_X, this.CENTER_Y + 150 * this.scale);
    }
  },

  get pivotOffset() { return this._pivotOffset; },
  get armLength() { return this._armLength; },
  get ballRadius() { return this._ballRadius; },
  get edgeSize() { return this._edgeSize; },
  get lineGap() { return this._lineGap; },
  get pivotRadius() { return this._pivotRadius; }
};