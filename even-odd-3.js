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
  spawnMode: "top-bottom", // "top-bottom", "left-right", "all", "random-one"
  modeTimer: 0,
  lastTime: performance.now(),
  shakeTimer: 0,

  pivotLockTimer: { left: 0, right: 0 },
  pivotLocked: { left: false, right: false },
  armFlash: { left: 0, right: 0 },

  pose: null,
  armData: { left: null, right: null },
  armVelocity: {
    left: { vx: 0, vy: 0, last: null },
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
    // initial center in CSS coordinates; resize() will recompute
    const dpr = window.devicePixelRatio || 1;
    this.CENTER_X = (canvasElement.width / dpr) / 2;
    this.CENTER_Y = (canvasElement.height / dpr) / 2;

    // Caches and object pools must be initialized before resize() calls rebuildCaches()
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

    this.pivotLocked = { left: false, right: false };
    this.pivotLockTimer = { left: 0, right: 0 };
    this.armFlash = { left: 0, right: 0 };

    this.initPose();
  },

  initPose() {
    if (this.pose) return;

    this.pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    this.pose.onResults(this.onPoseResults.bind(this));
    this.poseBusy = false;

    window.sendFrameToPose = async (image) => {
      if (!this.running || this.poseBusy) return;
      this.poseBusy = true;
      try {
        await this.pose.send({ image });
      } catch (e) {
        console.error(e);
      }
      this.poseBusy = false;
    };
  },

  onPoseResults(results) {
    let state = null;
    if (!results.poseLandmarks) {
      state = "arm";
    } else {
      const lm = results.poseLandmarks;

      const rightElbow = lm[14];
      const rightWrist = lm[16];
      const rightIndex = lm[20];
      
      const isBad = (pt) => !pt || pt.visibility < 0.3 || pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1;
      
      const elbowBad = isBad(rightElbow);
      const wristBad = isBad(rightWrist) || isBad(rightIndex);
      
      if (elbowBad && wristBad) state = "arm";
      else if (elbowBad) state = "elbow";
      else if (wristBad) state = "wrist";
    }

    if (state) {
      this.missingFrames = (this.missingFrames || 0) + 1;
      if (this.missingFrames > 5) {
        this.currentMissingState = state;
      }
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
      return {
        x: oldP.x * this.SMOOTH + newP.x * (1 - this.SMOOTH),
        y: oldP.y * this.SMOOTH + newP.y * (1 - this.SMOOTH)
      };
    };

    // ELBOW SPECIFIC SMOOTHING for higher accuracy/stability on the pivot point
    const smoothElbow = (oldP, newP) => {
      if (!oldP) return newP;
      const E_SMOOTH = 0.85;
      return {
        x: oldP.x * E_SMOOTH + newP.x * (1 - E_SMOOTH),
        y: oldP.y * E_SMOOTH + newP.y * (1 - E_SMOOTH)
      };
    };

    // NEW: wrist -> index finger instead of shoulder -> wrist
    const updateArm = (side, wristLm, indexLm) => {
      if (!wristLm || !indexLm) return;
      if (wristLm.visibility < 0.3 || indexLm.visibility < 0.3) return;

      let wrist = mapPoint(wristLm);   // base
      let index = mapPoint(indexLm);   // tip

      const prev = this.armData[side];
      wrist = smoothElbow(prev?.shoulder, wrist); // reuse shoulder slot as base
      index = smooth(prev?.wrist, index);    // reuse wrist slot as tip

      const dx = index.x - wrist.x;
      const dy = index.y - wrist.y;
      if (dx * dx + dy * dy < this.MIN_ARM_LENGTH * this.MIN_ARM_LENGTH) return;

      const vel = this.armVelocity[side];
      if (vel.last) {
        vel.vx = vel.vx * 0.5 + (index.x - vel.last.x) * 0.5;
        vel.vy = vel.vy * 0.5 + (index.y - vel.last.y) * 0.5;
      }
      vel.last = { x: index.x, y: index.y };

      // IMPORTANT:
      // keep same property names so rest of code works
      this.armData[side] = {
        shoulder: wrist, // now base = wrist
        wrist: index     // now tip = index finger
      };
    };

    // Mediapipe Pose indices:
    // Right wrist = 16, Right index = 20
    // Left wrist  = 15, Left index  = 19
    updateArm("right", lm[14], lm[16]);
    updateArm("left", lm[15], lm[19]);
  },

  rebuildCaches() {
    // 1. Edge Zones Cache
    this.edgeZoneCanvas.width = this.cssWidth;
    this.edgeZoneCanvas.height = this.cssHeight;
    const eCtx = this.edgeZoneCanvas.getContext("2d");
    eCtx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    
    const w = this.cssWidth;
    const h = this.cssHeight;
    const e = this.edgeSize;
    const gap = this.lineGap;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    eCtx.globalAlpha = 0.85;
    eCtx.shadowBlur = 20;

    eCtx.fillStyle = "rgba(255, 0, 0, 0.6)";
    eCtx.shadowColor = "red";
    eCtx.fillRect(0, 0, e, cy - gap);
    eCtx.fillRect(0, 0, cx - gap, e);
    eCtx.fillRect(w - e, cy + gap, e, h - (cy + gap));
    eCtx.fillRect(cx + gap, h - e, w - (cx + gap), e);

    eCtx.fillStyle = "rgba(0, 255, 255, 0.6)";
    eCtx.shadowColor = "cyan";
    eCtx.fillRect(0, cy + gap, e, h - (cy + gap));
    eCtx.fillRect(0, h - e, cx - gap, e);
    eCtx.fillRect(w - e, 0, e, cy - gap);
    eCtx.fillRect(cx + gap, 0, w - (cx + gap), e);

    // 2. Ball Cache (Using white as base template)
    // Ball needs some extra padding for shadowBlur
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

    // 3. Arm Canvas
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

    // 4. Wrist Canvas
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
    // adopt the full viewport CSS dimensions for consistent scaling
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // update canvas buffer size (main.js already does this but repeating is safe)
    canvasElement.width = cssW * dpr;
    canvasElement.height = cssH * dpr;

    this.cssWidth = cssW;
    this.cssHeight = cssH;

    // compute game scale using CSS coordinates (avoids DPI issues)
    this.scale = Math.min(cssW / this.BASE_WIDTH, cssH / this.BASE_HEIGHT);
    if (!this.scale || this.scale <= 0) this.scale = 1;

    // keep center coordinates in CSS space; transform scales them to device pixels
    this.CENTER_X = cssW / 2;
    this.CENTER_Y = cssH / 2;

    // normalize drawing matrix
    const ctx = canvasElement.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.rebuildCaches();
  },

  update(ctx) {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    if (!this.gameStarted) this.checkPivotLock(deltaTime);
    else {
      this.handleSpawning(deltaTime);
      this.updateBalls(deltaTime / 16.67);
      this.checkPhysics();
      this.checkScoring();
    }

    this.updateParticles();
    this.updateFloaters();

    // canvas cleared globally in main loop; no need to double-clear here

    if (this.gameStarted) {
      // FIX: Removed the solid black fillRect so your AR camera feed remains visible
      this.drawBalls(ctx);
      this.drawArms(ctx);
    }

    this.drawBackground(ctx);
    this.drawEdgeZones(ctx);
    this.drawCross(ctx);
    this.drawPivots(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    this.drawUI(ctx);
  },

  handleSpawning(dt) {
    this.spawnTimer += dt;
    this.modeTimer += dt;

    // Rotate spawn mode every 12 seconds
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

    if (side === 0) { // TOP
      x = this.CENTER_X;
      y = -outsideOffset;
      tx = x;
      ty = this.cssHeight + farBoundary;
    } else if (side === 1) { // BOTTOM
      x = this.CENTER_X;
      y = this.cssHeight + outsideOffset;
      tx = x;
      ty = -farBoundary;
    } else if (side === 2) { // LEFT
      x = -outsideOffset;
      y = this.CENTER_Y;
      tx = this.cssWidth + farBoundary;
      ty = y;
    } else if (side === 3) { // RIGHT
      x = this.cssWidth + outsideOffset;
      y = this.CENTER_Y;
      tx = -farBoundary;
      ty = y;
    }

    this.balls.push({
      x, y,
      targetX: tx,
      targetY: ty,
      vx: 0,
      vy: 0,
      speed,
      number,
      isOdd,
      color: "#ffffff",
      trail: [],
      hitCooldown: 0,
      scored: false,
      hasCollided: false
    });
  },

  updateBalls(dt) {
    for (let i = 0; i < this.balls.length; i++) {
      let b = this.balls[i];
      if (b.scored) continue;

      // Store previous position (important for collision sweep)
      b.prevX = b.x;
      b.prevY = b.y;

      const dx = b.targetX - b.x;
      const dy = b.targetY - b.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      // Feature: Cap step to remaining distance — prevents overshoot jitter
      const step = Math.min(b.speed * dt, len);

      // We maintain vx/vy for trail and physics, but actual movement uses target
      b.vx = (dx / len) * b.speed;
      b.vy = (dy / len) * b.speed;

      b.x += (dx / len) * step;
      b.y += (dy / len) * step;

      if (b.trailIdx === undefined) b.trailIdx = 0;
      if (b.trail.length < 9) {
        b.trail.push({ x: b.x, y: b.y });
      } else {
        b.trail[b.trailIdx].x = b.x;
        b.trail[b.trailIdx].y = b.y;
        b.trailIdx = (b.trailIdx + 1) % 9;
      }

      if (b.hitCooldown > 0) b.hitCooldown -= dt;

      // Removal logic: if we reached the target or go way out of bounds
      const limit = 150 * this.scale;
      const cw = this.cssWidth;
      const ch = this.cssHeight;
      if (
        len <= step + 1 ||
        b.x < -limit || b.x > cw + limit ||
        b.y < -limit || b.y > ch + limit
      ) {
        b.remove = true;
      }
    }

    this.balls = this.balls.filter(b => !b.remove);
  },

  checkPhysics() {
    if (this.balls.length === 0) return;

    const pivot = { x: this.CENTER_X, y: this.CENTER_Y };
    const arm = this.armData.right;
    if (!arm?.wrist || !arm?.shoulder) return;

    const angle = Math.atan2(
      arm.wrist.y - arm.shoulder.y,
      arm.wrist.x - arm.shoulder.x
    );

    // Two sticks: original + opposite
    const angles = [angle, angle + Math.PI];

    if (!this.lastArmAngle) this.lastArmAngle = angle;
    let angVel = angle - this.lastArmAngle;
    this.lastArmAngle = angle;
    angVel = Math.max(-0.3, Math.min(0.1, angVel));

    const tangentialSpeed = angVel * this.armLength * 0.8;

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

        const distX = b.x - closestX;
        const distY = b.y - closestY;
        const distSq2 = distX * distX + distY * distY;

        if (distSq2 > radius * radius) continue;
        const dist = Math.sqrt(distSq2);

        let nx = distX / (dist || 1);
        let ny = distY / (dist || 1);

        const relVX = b.vx - armVelX;
        const relVY = b.vy - armVelY;

        const dot = relVX * nx + relVY * ny;
        if (dot >= 0) continue;

        let rvx = relVX - 2 * dot * nx;
        let rvy = relVY - 2 * dot * ny;

        b.vx = rvx + armVelX;
        b.vy = rvy + armVelY;

        const maxSpeed = 18 * this.scale;
        let sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > maxSpeed) {
          b.vx = (b.vx / sp) * maxSpeed;
          b.vy = (b.vy / sp) * maxSpeed;
          sp = maxSpeed;
        }

        // Recalculate target and speed for smoother movement physics
        b.speed = sp;
        const farBoundary = 2000 * this.scale;
        b.targetX = b.x + (b.vx / (b.speed || 1)) * farBoundary;
        b.targetY = b.y + (b.vy / (b.speed || 1)) * farBoundary;

        b.hitCooldown = 8 * this.scale;
        this.spawnExplosion(b.x, b.y, "white", 10);
      }
    }
  },

  checkScoring() {
    const w = this.cssWidth;
    const h = this.cssHeight;
    const e = this.edgeSize;
    const gap = this.lineGap;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    // FIX: Thin the collision detection (Require ball to go 50% into the zone)
    const triggerEdge = e * 0.5;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      let b = this.balls[i];
      if (b.scored) continue;

      let scoreType = null;

      // LEFT SIDE (Top: Red/Even, Bottom: Blue/Odd)
      if (b.x < cx - gap) {
        if ((b.y < triggerEdge && b.vy < 0) || (b.y > h - triggerEdge && b.vy > 0) || (b.x < triggerEdge && b.vx < 0)) {
          const isBottom = b.y > cy;
          if (!isBottom) { // Top part (Red)
            scoreType = !b.isOdd ? "good" : "bad";
          } else { // Bottom part (Blue)
            scoreType = b.isOdd ? "good" : "bad";
          }
        }
      }
      // RIGHT SIDE (Top: Blue/Odd, Bottom: Red/Even)
      else if (b.x > cx + gap) {
        if ((b.y < triggerEdge && b.vy < 0) || (b.y > h - triggerEdge && b.vy > 0) || (b.x > w - triggerEdge && b.vx > 0)) {
          const isBottom = b.y > cy;
          if (!isBottom) { // Top part (Blue)
            scoreType = b.isOdd ? "good" : "bad";
          } else { // Bottom part (Red)
            scoreType = !b.isOdd ? "good" : "bad";
          }
        }
      }

      if (scoreType) {
        const dx = this.CENTER_X - b.x;
        const dy = this.CENTER_Y - b.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        if (scoreType === "good") {
          this.updateScore(10, true);
          this.spawnFloatingText(b.x, b.y, "+10", "#00FF00", nx * 1.5, ny * 1.5, 2.5);
          this.spawnExplosion(b.x, b.y, "#00FF00", 15, nx * 3, ny * 3);
        } else {
          this.updateScore(-5, false);
          this.spawnFloatingText(b.x, b.y, "-5", "#FF0000", nx * 1.5, ny * 1.5, 2.5);
          this.spawnExplosion(b.x, b.y, "#FF0000", 10, nx * 3, ny * 3);
          this.shakeTimer = 25;
        }
        this.balls.splice(i, 1);
      }
    }
  },

  // --- SCORE ANIMATION TRIGGER ---
  updateScore(amount, isGood) {
    if (isGood) {
      sfxCorrect_8.currentTime = 0;
      sfxCorrect_8.play().catch(() => { });
    } else {
      sfxWrong_8.currentTime = 0;
      sfxWrong_8.play().catch(() => { });
    }
    this.score += amount;
    this.scoreScale = 2.0;
    this.scoreColor = isGood ? "#00FF00" : "#FF0000";

    // Difficulty scaling
    if (isGood) {
      this.spawnRate = Math.max(this.minSpawnRate, this.spawnRate - 100);
    } else {
      this.spawnRate = Math.min(this.maxSpawnRate, this.spawnRate + 200);
    }
  },

  checkPivotLock(dt) {
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    const arm = this.armData.right;
    if (!arm?.shoulder) return; // shoulder now stores wrist position

    const dx = arm.shoulder.x - cx;
    const dy = arm.shoulder.y - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq < (120 * this.scale) * (120 * this.scale)) {
      this.pivotLockTimer.right += dt;
      this.lockProgress = Math.min(
        this.pivotLockTimer.right / this.LOCK_TIME,
        1
      );

      if (this.pivotLockTimer.right > this.LOCK_TIME) {
        this.gameStarted = true;
        const video = document.getElementById("input_video");
        if (video) video.style.opacity = "0.2";
        this.spawnFloatingText(cx, cy, "START!", "white");
      }
    } else {
      this.pivotLockTimer.right = 0;
      this.lockProgress = 0;
    }
  },
  /* ==============================
     VISUAL EFFECTS
  ============================= */
  spawnExplosion(x, y, color, count, biasX = 0, biasY = 0) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      
      let p = this.particlePool.pop();
      if (!p) p = {};
      
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed + biasX;
      p.vy = Math.sin(angle) * speed + biasY;
      p.life = 1.0;
      p.color = color;
      
      this.particles.push(p);
    }
  },

  spawnFloatingText(x, y, text, color, dx = 0, dy = -2, life = 1.0) {
    let f = this.floaterPool.pop();
    if (!f) f = {};
    
    f.x = x;
    f.y = y;
    f.text = text;
    f.color = color;
    f.life = life;
    f.dx = dx;
    f.dy = dy;
    
    this.floaters.push(f);
  },

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) {
        this.particlePool.push(p);
        this.particles.splice(i, 1);
      }
    }
  },

  updateFloaters() {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      let f = this.floaters[i];
      f.x += f.dx || 0;
      f.y += f.dy;
      f.life -= 0.02;
      if (f.life <= 0) {
        this.floaterPool.push(f);
        this.floaters.splice(i, 1);
      }
    }
  },

  /* ==============================
     DRAWING
  ============================== */
  drawBackground(ctx) {
    ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const step = 40 * this.scale;
    for (let x = 0; x < this.cssWidth; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.cssHeight); ctx.stroke();
    }
    for (let y = 0; y < this.cssHeight; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.cssWidth, y); ctx.stroke();
    }
  },

  drawEdgeZones(ctx) {
    if (this.edgeZoneCanvas) {
      ctx.drawImage(this.edgeZoneCanvas, 0, 0);
    }
  },

  drawCross(ctx) {
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2 * this.scale;
    const gap = this.lineGap;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;
    const w = this.cssWidth;
    const h = this.cssHeight;
    const insetV = 200 * this.scale;
    const insetH = 600 * this.scale;

    ctx.beginPath();
    // Vertical lines (top and bottom segments)
    ctx.moveTo(cx - gap, 0); ctx.lineTo(cx - gap, cy - insetV);
    ctx.moveTo(cx - gap, cy + insetV); ctx.lineTo(cx - gap, h);
    ctx.moveTo(cx + gap, 0); ctx.lineTo(cx + gap, cy - insetV);
    ctx.moveTo(cx + gap, cy + insetV); ctx.lineTo(cx + gap, h);

    // Horizontal lines (left and right segments)
    ctx.moveTo(0, cy - gap); ctx.lineTo(cx - insetH, cy - gap);
    ctx.moveTo(cx + insetH, cy - gap); ctx.lineTo(w, cy - gap);
    ctx.moveTo(0, cy + gap); ctx.lineTo(cx - insetH, cy + gap);
    ctx.moveTo(cx + insetH, cy + gap); ctx.lineTo(w, cy + gap);
    ctx.stroke();
  },

  drawBalls(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${30 * this.scale}px Orbitron`;

    for (let i = 0; i < this.balls.length; i++) {
      let b = this.balls[i];
      // Trail
      if (b.trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = b.color;
        ctx.lineWidth = this.ballRadius * 1.5; // Increased from 1.2
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.25; // Slightly lower alpha for longer trail

        let tIdx = b.trailIdx || 0;
        ctx.moveTo(b.trail[tIdx].x, b.trail[tIdx].y);
        for (let j = 1; j < b.trail.length; j++) {
          let idx = (tIdx + j) % b.trail.length;
          ctx.lineTo(b.trail[idx].x, b.trail[idx].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      if (this.ballCanvas) {
        const bp = 30; // ball padding
        const br = this.ballRadius;
        ctx.drawImage(this.ballCanvas, b.x - br - bp, b.y - br - bp);
      }

      ctx.fillStyle = "black";
      ctx.fillText(b.number, b.x, b.y);
    }
  },

  drawArms(ctx) {
    const arm = this.armData.right;
    if (!arm?.shoulder) return;

    const pivot = { x: this.CENTER_X, y: this.CENTER_Y };

    const baseAngle = Math.atan2(
      arm.wrist.y - arm.shoulder.y,
      arm.wrist.x - arm.shoulder.x
    );

    const angles = [baseAngle, baseAngle + Math.PI];

    for (let i = 0; i < angles.length; i++) {
      let angle = angles[i];
      const tipX = pivot.x + Math.cos(angle) * this.armLength;
      const tipY = pivot.y + Math.sin(angle) * this.armLength;

      // Cached Stick & Tip
      if (this.armCanvas) {
        const armPad = 40;
        ctx.save();
        ctx.translate(pivot.x, pivot.y);
        ctx.rotate(angle);
        ctx.drawImage(this.armCanvas, -armPad, -armPad);
        ctx.restore();
      }
    }

    // Wrist highlight
    if (this.wristCanvas) {
      const wPad = 30;
      const wr = 18 * this.scale;
      ctx.drawImage(this.wristCanvas, arm.shoulder.x - wr - wPad, arm.shoulder.y - wr - wPad);
    }
  },

  drawPivots(ctx) {
    const x = this.CENTER_X;
    const y = this.CENTER_Y;
    const r = this.gameStarted ? this.PIVOT_RADIUS : 15;

    // Base pivot
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.gameStarted ? "#ff2491ff" : "#444";
    ctx.fill();

    // Loading progress ring (before start)
    if (!this.gameStarted && this.lockProgress > 0) {
      ctx.beginPath();
      ctx.arc(
        x, y, r + 8 * this.scale,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * this.lockProgress
      );
      ctx.strokeStyle = "#BB66FF";
      ctx.lineWidth = 6 * this.scale;
      ctx.stroke();
    }
  },

  drawParticles(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      let p = this.particles[i];
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * this.scale, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  drawFloaters(ctx) {
    ctx.font = `bold ${24 * this.scale}px Orbitron`;
    ctx.textAlign = "center";
    for (let i = 0; i < this.floaters.length; i++) {
      let f = this.floaters[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life)); // Ensure alpha is between 0 and 1
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  },

  drawUI(ctx) {
    if (!this.gameStarted) {
      ctx.fillStyle = "white";
      ctx.font = `bold ${30 * this.scale}px Orbitron`;
      ctx.textAlign = "center";
      ctx.fillStyle = "black";
      ctx.fillText(
        "HOLD ELBOW ON DOTS TO START",
        this.CENTER_X + 2 * this.scale,
        this.CENTER_Y - 48 * this.scale
      );
      ctx.fillStyle = "white";
      ctx.fillText(
        "HOLD ELBOW ON DOTS TO START",
        this.CENTER_X,
        this.CENTER_Y - 50 * this.scale
      );
    }

    // ===== SCORE =====
    ctx.textAlign = "center";
    const fontSize = 20 * this.scoreScale * this.scale;
    ctx.font = `bold ${fontSize}px Orbitron`;
    ctx.fillStyle = this.scoreColor;
    ctx.fillText(this.score, this.CENTER_X, 100 * this.scale);

    // ===== LEGEND (Responsive Positions) =====
    const w = this.cssWidth;

    ctx.font = `bold ${36 * this.scale}px Orbitron`;
    ctx.textAlign = "center";

    // Left = 25% of screen width
    ctx.fillStyle = "#FF0000";
    ctx.fillText("Even", w * 0.07, 85 * this.scale); // Top Left

    // Right = 75% of screen width
    ctx.fillStyle = "#00FFFF";
    ctx.fillText("Odd", w * 0.93, 85 * this.scale); // Top Right

    // --- BOTTOM LEGEND ---
    const bh = this.cssHeight - 65 * this.scale;

    // Bottom Left (Blue/Odd)
    ctx.fillStyle = "#00FFFF";
    ctx.fillText("Odd", w * 0.065, bh);

    // Bottom Right (Red/Even)
    ctx.fillStyle = "#FF0000";
    ctx.fillText("Even", w * 0.92, bh);

    if (this.currentMissingState) {
      ctx.fillStyle = "red";
      ctx.font = `bold ${30 * this.scale}px Orbitron`;
      let msg = "";
      if (this.currentMissingState === "arm") msg = "BRING ARM BACK IN SCREEN";
      else if (this.currentMissingState === "elbow") msg = "BRING ELBOW BACK IN SCREEN";
      else if (this.currentMissingState === "wrist") msg = "BRING WRIST BACK IN SCREEN";

      ctx.fillText(msg, this.CENTER_X, this.CENTER_Y + 150 * this.scale);
    }
  },

  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1; const B = py - y1;
    const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = px - xx; const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  },

  get pivotOffset() { return this.PIVOT_OFFSET * this.scale },
  get armLength() { return this.ARM_LENGTH * this.scale },
  get ballRadius() { return this.BALL_RADIUS * this.scale },
  get edgeSize() { return this.EDGE_SIZE * this.scale },
  get lineGap() { return this.LINE_GAP * this.scale },
  get pivotRadius() { return this.PIVOT_RADIUS * this.scale }

};

