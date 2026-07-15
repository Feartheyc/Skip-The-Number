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

  // ⚡ ADDITIVE: Letterbox coordinate offsets for tablet protection
  offsetX: 0,
  offsetY: 0,
  virtualWidth: 1280,
  virtualHeight: 720,

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

  STEERING_HAND: "right",

  SWEEP_STEP_ANGLE: 0.035,
  MAX_SWEEP_STEPS: 28,
  CONTACT_EXTRA_RADIUS: 10,

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

  pivotLockTimer: { right: 0 },

  pose: null,

  armData: {
    right: null
  },

  steeringHand: null,

  CENTER_X: 0,
  CENTER_Y: 0,
  cssWidth: 0,
  cssHeight: 0,

  SMOOTH: 0.6,
  MIN_ARM_LENGTH: 25,

  showTutorial: true,
  tutorialHoldTime: 0,
  gifPlaceholder: null,

  init() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(e => console.log("Orientation lock failed:", e));
      }
    } catch (e) { }

    window.addEventListener('click', () => {
      if (window.currentGame !== Game8) return;

      sfxButtonClick_8.currentTime = 0;
      sfxButtonClick_8.play().catch(() => { });
    });

    this.currentMissingState = null;
    this.missingFrames = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

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
    this.showTutorial = true; 
    this.tutorialHoldTime = 0;

    this.scoreScale = 1;
    this.scoreColor = "white";

    this.pivotLockTimer = { right: 0 };
    this.lockProgress = 0;

    this.armData = {
      right: null
    };

    this.steeringHand = null;
    this._rawHand = null;
    this.lastArmAngle = null;

    this.gifPlaceholder = {
      w: 340,
      h: 220
    };

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
      state = "wrist";
    } else {
      const lm = results.poseLandmarks;

      const rightWrist = lm[16];
      const leftWrist = lm[15];

      const isGoodWrist = (pt) => {
        return pt && pt.visibility >= 0.3 && pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1;
      };

      const preferredWrist = this.STEERING_HAND === "left" ? leftWrist : rightWrist;
      const fallbackWrist = this.STEERING_HAND === "left" ? rightWrist : leftWrist;

      if (!isGoodWrist(preferredWrist) && !isGoodWrist(fallbackWrist)) {
        state = "wrist";
      }
    }

    if (state) {
      this.missingFrames = (this.missingFrames || 0) + 1;

      if (this.missingFrames > 5) {
        this.currentMissingState = state;
        this.steeringHand = null;
      }
    } else {
      this.missingFrames = 0;
      this.currentMissingState = null;
    }

    if (!results.poseLandmarks) return;

    const lm = results.poseLandmarks;

    // ⚡ ADDITIVE: Normalize tracking to fit perfectly into the virtual bounds box rather than raw window edges
    const mapPoint = (p) => ({
      x: (1 - p.x) * this.virtualWidth,
      y: p.y * this.virtualHeight
    });

    const smooth = (oldP, newP) => {
      if (!oldP) return newP;

      const S = 0.75;

      return {
        x: oldP.x * S + newP.x * (1 - S),
        y: oldP.y * S + newP.y * (1 - S)
      };
    };

    const isGoodWrist = (pt) => {
      return pt && pt.visibility >= 0.3 && pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1;
    };

    const rightWrist = lm[16];
    const leftWrist = lm[15];

    const preferredWrist = this.STEERING_HAND === "left" ? leftWrist : rightWrist;
    const fallbackWrist = this.STEERING_HAND === "left" ? rightWrist : leftWrist;

    let selectedWrist = null;

    if (isGoodWrist(preferredWrist)) {
      selectedWrist = preferredWrist;
    } else if (isGoodWrist(fallbackWrist)) {
      selectedWrist = fallbackWrist;
    }

    if (!selectedWrist) return;

    const handPoint = mapPoint(selectedWrist);

    if (!this._rawHand) this._rawHand = handPoint;

    this._rawHand = smooth(this._rawHand, handPoint);

    this.steeringHand = {
      x: this._rawHand.x,
      y: this._rawHand.y
    };

    const dx = this.steeringHand.x - this.CENTER_X;
    const dy = this.steeringHand.y - this.CENTER_Y;

    let angle;

    if (Math.sqrt(dx * dx + dy * dy) < 5) {
      angle = this.lastArmAngle || 0;
    } else {
      angle = Math.atan2(dy, dx);
    }

    this.armData.right = {
      shoulder: {
        x: this.CENTER_X,
        y: this.CENTER_Y
      },
      wrist: {
        x: this.CENTER_X + Math.cos(angle) * this.armLength,
        y: this.CENTER_Y + Math.sin(angle) * this.armLength
      }
    };
  },

  rebuildCaches() {
    if (!this.bgCanvas) this.bgCanvas = document.createElement("canvas");

    this.bgCanvas.width = this.virtualWidth;
    this.bgCanvas.height = this.virtualHeight;

    const bgCtx = this.bgCanvas.getContext("2d");

    bgCtx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    bgCtx.lineWidth = 1;

    const step = 40;

    bgCtx.beginPath();
    for (let x = 0; x < this.virtualWidth; x += step) {
      bgCtx.moveTo(x, 0); bgCtx.lineTo(x, this.virtualHeight);
    }
    for (let y = 0; y < this.virtualHeight; y += step) {
      bgCtx.moveTo(0, y); bgCtx.lineTo(this.virtualWidth, y);
    }
    bgCtx.stroke();

    const w = this.virtualWidth;
    const h = this.virtualHeight;
    const e = this.EDGE_SIZE;
    const gap = this.LINE_GAP;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;
    const overS = e * 1.3;

    bgCtx.globalAlpha = 0.85;

    // ================= LEFT SIDE = RED = ODD =================
    bgCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
    bgCtx.fillRect(0, 0, overS, h);
    bgCtx.fillRect(0, 0, cx - gap + 5, overS);
    bgCtx.fillRect(0, h - overS, cx - gap + 5, overS);

    bgCtx.fillStyle = "rgba(255, 0, 0, 0.8)";
    bgCtx.fillRect(0, 0, e, h);
    bgCtx.fillRect(0, 0, cx - gap, e);
    bgCtx.fillRect(0, h - e, cx - gap, e);

    // ================= RIGHT SIDE = BLUE = EVEN =================
    bgCtx.fillStyle = "rgba(0, 255, 255, 0.3)";
    bgCtx.fillRect(w - overS, 0, overS, h);
    bgCtx.fillRect(cx + gap - 5, 0, w, overS);
    bgCtx.fillRect(cx + gap - 5, h - overS, w, overS);

    bgCtx.fillStyle = "rgba(0, 255, 255, 0.8)";
    bgCtx.fillRect(w - e, 0, e, h);
    bgCtx.fillRect(cx + gap, 0, w - (cx + gap), e);
    bgCtx.fillRect(cx + gap, h - e, w - (cx + gap), e);

    bgCtx.globalAlpha = 1;
    bgCtx.strokeStyle = "rgba(255,255,255,0.2)";
    bgCtx.lineWidth = 2;

    const insetV = 200;
    const insetH = 600;

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
    const br = this.BALL_RADIUS;

    this.ballCanvas.width = (br + ballPad) * 2;
    this.ballCanvas.height = (br + ballPad) * 2;
    const bCtx = this.ballCanvas.getContext("2d");
    bCtx.shadowBlur = 15; bCtx.shadowColor = "#ffffff"; bCtx.fillStyle = "#ffffff";
    bCtx.beginPath(); bCtx.arc(br + ballPad, br + ballPad, br, 0, Math.PI * 2); bCtx.fill();

    const armPad = 40;
    const al = this.ARM_LENGTH;
    this.armCanvas.width = al + armPad * 2; this.armCanvas.height = armPad * 2;
    const aCtx = this.armCanvas.getContext("2d");
    aCtx.shadowBlur = 20; aCtx.shadowColor = "#f36affff"; aCtx.strokeStyle = "#ac2fffff"; aCtx.lineWidth = 10;
    aCtx.beginPath(); aCtx.moveTo(armPad, armPad); aCtx.lineTo(armPad + al, armPad); aCtx.stroke();
    aCtx.shadowBlur = 0; aCtx.beginPath(); aCtx.arc(armPad + al, armPad, 8, 0, Math.PI * 2); aCtx.fillStyle = "#b906b9ff"; aCtx.fill();

    const wPad = 30;
    const wr = 18;
    this.wristCanvas.width = (wr + wPad) * 2; this.wristCanvas.height = (wr + wPad) * 2;
    const wCtx = this.wristCanvas.getContext("2d");
    wCtx.shadowBlur = 15; wCtx.shadowColor = "#BB66FF"; wCtx.strokeStyle = "#BB66FF"; wCtx.lineWidth = 4;
    wCtx.beginPath(); wCtx.arc(wr + wPad, wr + wPad, wr, 0, Math.PI * 2); wCtx.stroke();
  },

  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    // ⚡ FIXED SCALING METHOD: Employs standard laptop aspect boundaries to map letterboxing coordinates natively
    let scaleX = cssW / this.BASE_WIDTH;
    let scaleY = cssH / this.BASE_HEIGHT;
    this.scale = Math.min(scaleX, scaleY) || 1;

    this.offsetX = (cssW - this.BASE_WIDTH * this.scale) / 2;
    this.offsetY = (cssH - this.BASE_HEIGHT * this.scale) / 2;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvasElement.width = cssW * dpr;
    canvasElement.height = cssH * dpr;

    this.cssWidth = cssW;
    this.cssHeight = cssH;

    this.CENTER_X = this.virtualWidth / 2;
    this.CENTER_Y = this.virtualHeight / 2;

    const ctx = canvasElement.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dynamic fonts stay un-scaled inside cached layer transform matrix
    this.fontBall = `bold 30px Orbitron`;
    this.fontUI = `bold 30px Orbitron`;
    this.fontLegend = `bold 36px Orbitron`;
    this.fontFloater = `bold 24px Orbitron`;
    this.fontScore = `bold 20px Orbitron`;
    this.fontScoreBig = `bold 40px Orbitron`;

    this.rebuildCaches();
  },

  update(ctx) {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    if (this.scoreScale > 1) {
      this.scoreScale = Math.max(1, this.scoreScale - 0.05);
    }

    if (this.showTutorial) {
      this.checkPivotLock(deltaTime);
    } else if (!this.gameStarted) {
      this.checkPivotLock(deltaTime);
    } else {
      this.handleSpawning(deltaTime);
      this.updateBalls(deltaTime / 16.67);
      this.checkPhysics();
      this.checkScoring();
    }

    this.updateParticles();
    this.updateFloaters();

    // ⚡ MATRIX PUSH: Shift and scale the rendering matrix before executing draws so everything adapts on a tablet
    ctx.save();
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    
    // Draw background black bars over raw tablet space leaks
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Clip rendering cleanly to virtual bounds box limit boundaries
    ctx.beginPath();
    ctx.rect(0, 0, this.virtualWidth, this.virtualHeight);
    ctx.clip();

    this.drawBackground(ctx);

    if (this.gameStarted && !this.showTutorial) {
      this.drawBalls(ctx);
      this.drawArms(ctx);
    }

    this.drawPivots(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    this.drawUI(ctx);

    if (this.showTutorial) {
      this.drawTutorialWindow(ctx);
    }

    ctx.restore(); // Matrix restored back to raw canvas coordinates smoothly
  },

  handleSpawning(dt) {
    this.spawnTimer += dt;
    this.spawnMode = "top-bottom";

    if (this.spawnTimer > this.spawnRate && this.balls.length < this.MAX_BALLS) {
      this.spawnBall();
      this.spawnTimer = 0;
    }
  },

  spawnBall() {
    const number = Math.floor(Math.random() * 100) + 1;
    const isOdd = number % 2 !== 0;
    const speed = (1 + (2000 - this.spawnRate) / 2000);

    let sides = [0, 1];
    const side = sides[Math.floor(Math.random() * sides.length)];

    let x, y, tx, ty;
    const outsideOffset = this.BALL_RADIUS * 2;
    const farBoundary = 2000;

    if (side === 0) {
      x = this.CENTER_X; y = -outsideOffset; tx = x; ty = this.virtualHeight + farBoundary;
    } else if (side === 1) {
      x = this.CENTER_X; y = this.virtualHeight + outsideOffset; tx = x; ty = -farBoundary;
    }

    this.balls.push({
      x, y, prevX: x, prevY: y, targetX: tx, targetY: ty, vx: 0, vy: 0, speed, number, isOdd, color: "#ffffff", trail: [], trailIdx: 0, hitCooldown: 0, scored: false, hasCollided: false
    });
  },

  updateBalls(dt) {
    for (let i = 0; i < this.balls.length; i++) {
      let b = this.balls[i];
      if (b.scored) continue;

      b.prevX = b.x; b.prevY = b.y;
      const dx = b.targetX - b.x; const dy = b.targetY - b.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const step = Math.min(b.speed * dt, len);

      b.vx = (dx / len) * b.speed; b.vy = (dy / len) * b.speed;
      b.x += (dx / len) * step; b.y += (dy / len) * step;

      if (b.trailIdx === undefined) b.trailIdx = 0;
      if (b.trail.length < 9) b.trail.push({ x: b.x, y: b.y });
      else { b.trail[b.trailIdx].x = b.x; b.trail[b.trailIdx].y = b.y; b.trailIdx = (b.trailIdx + 1) % 9; }

      if (b.hitCooldown > 0) b.hitCooldown -= dt;

      const limit = 150;
      if (len <= step + 1 || b.x < -limit || b.x > this.virtualWidth + limit || b.y < -limit || b.y > this.virtualHeight + limit) {
        b.remove = true;
      }
    }
    this.balls = this.balls.filter(b => !b.remove);
  },

  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  },

  getPointSegmentInfo(px, py, ax, ay, bx, by) {
    const abx = bx - ax; const aby = by - ay;
    const apx = px - ax; const apy = py - ay;
    const lenSq = abx * abx + aby * aby || 1;
    let t = (apx * abx + apy * aby) / lenSq; t = Math.max(0, Math.min(1, t));
    const closestX = ax + abx * t; const closestY = ay + aby * t;
    const dx = px - closestX; const dy = py - closestY;
    return { t, closestX, closestY, dx, dy, distSq: dx * dx + dy * dy };
  },

  checkArmBallAt(ballX, ballY, stickAngle) {
    const pivotX = this.CENTER_X; const pivotY = this.CENTER_Y;
    const tipX = pivotX + Math.cos(stickAngle) * this.ARM_LENGTH;
    const tipY = pivotY + Math.sin(stickAngle) * this.ARM_LENGTH;
    const radius = this.BALL_RADIUS + this.CONTACT_EXTRA_RADIUS;
    const info = this.getPointSegmentInfo(ballX, ballY, pivotX, pivotY, tipX, tipY);
    if (info.distSq <= radius * radius) {
      return { hit: true, stickAngle, armT: info.t, closestX: info.closestX, closestY: info.closestY, dx: info.dx, dy: info.dy, distSq: info.distSq };
    }
    return null;
  },

  resolveSweptHit(ball, hit, angleDelta) {
    let dist = Math.sqrt(hit.distSq);
    let nx, ny;
    if (dist < 0.001) {
      nx = Math.cos(hit.stickAngle + Math.PI / 2); ny = Math.sin(hit.stickAngle + Math.PI / 2); dist = 1;
    } else { nx = hit.dx / dist; ny = hit.dy / dist; }

    const contactDistance = this.ARM_LENGTH * hit.armT;
    const clampedAngleDelta = Math.max(-0.35, Math.min(0.35, angleDelta));
    const armVelX = -Math.sin(hit.stickAngle) * clampedAngleDelta * contactDistance * 2.8;
    const armVelY = Math.cos(hit.stickAngle) * clampedAngleDelta * contactDistance * 2.8;

    const relVX = ball.vx - armVelX; const relVY = ball.vy - armVelY;
    const dot = relVX * nx + relVY * ny;

    if (dot < 0) {
      ball.vx = (relVX - 2 * dot * nx) + armVelX; ball.vy = (relVY - 2 * dot * ny) + armVelY;
    } else {
      ball.vx += nx * 5 + armVelX * 0.35; ball.vy += ny * 5 + armVelY * 0.35;
    }

    const pushOut = Math.max(1, this.BALL_RADIUS + this.CONTACT_EXTRA_RADIUS - dist);
    ball.x += nx * pushOut; ball.y += ny * pushOut;

    let sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const minSpeed = 5; const maxSpeed = 22;
    if (sp < minSpeed) {
      ball.vx = nx * minSpeed + armVelX * 0.5; ball.vy = ny * minSpeed + armVelY * 0.5;
      sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    }
    if (sp > maxSpeed) {
      ball.vx = (ball.vx / sp) * maxSpeed; ball.vy = (ball.vy / sp) * maxSpeed; sp = maxSpeed;
    }
    ball.speed = sp;
    ball.targetX = ball.x + (ball.vx / (ball.speed || 1)) * 2000;
    ball.targetY = ball.y + (ball.vy / (ball.speed || 1)) * 2000;
    ball.hitCooldown = 10; ball.hasCollided = true;
    this.spawnExplosion(ball.x, ball.y, "white", 5);
  },

  checkPhysics() {
    if (this.balls.length === 0) return;
    const arm = this.armData.right;
    if (!arm?.wrist || !arm?.shoulder) return;

    const currentAngle = Math.atan2(arm.wrist.y - arm.shoulder.y, arm.wrist.x - arm.shoulder.x);
    let previousAngle = this.lastArmAngle;
    if (previousAngle === null || previousAngle === undefined) previousAngle = currentAngle;

    const angleDelta = this.normalizeAngle(currentAngle - previousAngle);
    const baseAngleSteps = Math.ceil(Math.abs(angleDelta) / this.SWEEP_STEP_ANGLE);

    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i];
      if (b.scored || b.hitCooldown > 0) continue;

      const ballMoveX = b.x - (b.prevX ?? b.x); const ballMoveY = b.y - (b.prevY ?? b.y);
      const ballMoveDist = Math.sqrt(ballMoveX * ballMoveX + ballMoveY * ballMoveY);
      const ballMoveSteps = Math.ceil(ballMoveDist / Math.max(1, this.BALL_RADIUS * 0.35));
      const steps = Math.min(this.MAX_SWEEP_STEPS, Math.max(2, baseAngleSteps, ballMoveSteps));

      let foundHit = null;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const sampleBaseAngle = previousAngle + angleDelta * t;
        const sampleBallX = (b.prevX ?? b.x) + (b.x - (b.prevX ?? b.x)) * t;
        const sampleBallY = (b.prevY ?? b.y) + (b.y - (b.prevY ?? b.y)) * t;

        const hitA = this.checkArmBallAt(sampleBallX, sampleBallY, sampleBaseAngle);
        if (hitA) { foundHit = hitA; break; }

        const hitB = this.checkArmBallAt(sampleBallX, sampleBallY, sampleBaseAngle + Math.PI);
        if (hitB) { foundHit = hitB; break; }
      }
      if (foundHit) this.resolveSweptHit(b, foundHit, angleDelta);
    }
    this.lastArmAngle = currentAngle;
  },

  checkScoring() {
    const w = this.virtualWidth; const h = this.virtualHeight;
    const e = this.EDGE_SIZE; const gap = this.LINE_GAP;
    const cx = this.CENTER_X; const triggerEdge = e * 0.5;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      let b = this.balls[i]; let scoreType = null;

      if (b.x < cx - gap) {
        if ((b.y < triggerEdge && b.vy < 0) || (b.y > h - triggerEdge && b.vy > 0) || (b.x < triggerEdge && b.vx < 0)) {
          scoreType = b.isOdd ? "good" : "bad";
        }
      }
      else if (b.x > cx + gap) {
        if ((b.y < triggerEdge && b.vy < 0) || (b.y > h - triggerEdge && b.vy > 0) || (b.x > w - triggerEdge && b.vx > 0)) {
          scoreType = !b.isOdd ? "good" : "bad";
        }
      }

      if (scoreType) {
        const dx = cx - b.x; const dy = this.CENTER_Y - b.y; const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (scoreType === "good") {
          this.updateScore(10, true);
          this.spawnFloatingText(b.x, b.y, "+10", "#00FF00", (dx / dist) * 1.5, (dy / dist) * 1.5, 2.5);
          this.spawnExplosion(b.x, b.y, "#00FF00", 8, (dx / dist) * 3, (dy / dist) * 3);
        } else {
          this.updateScore(-5, false);
          this.spawnFloatingText(b.x, b.y, "-5", "#FF0000", (dx / dist) * 1.5, (dy / dist) * 1.5, 2.5);
          this.spawnExplosion(b.x, b.y, "#FF0000", 5, (dx / dist) * 3, (dy / dist) * 3);
          this.shakeTimer = 25;
        }
        this.balls.splice(i, 1);
      }
    }
  },

  updateScore(amount, isGood) {
    if (isGood) { sfxCorrect_8.currentTime = 0; sfxCorrect_8.play().catch(() => { }); }
    else { sfxWrong_8.currentTime = 0; sfxWrong_8.play().catch(() => { }); }

    this.score += amount; this.scoreScale = 2.0; this.scoreColor = isGood ? "#00FF00" : "#FF0000";
    this.spawnRate = isGood ? Math.max(2000, this.spawnRate - 100) : Math.min(3000, this.spawnRate + 200);
  },

  checkPivotLock(dt) {
    if (!this.steeringHand) { this.pivotLockTimer.right = 0; this.lockProgress = 0; return; }
    const dx = this.steeringHand.x - this.CENTER_X; const dy = this.steeringHand.y - this.CENTER_Y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 150 ** 2) {
      this.pivotLockTimer.right += dt;
      this.lockProgress = Math.min(this.pivotLockTimer.right / this.LOCK_TIME, 1);
      if (this.pivotLockTimer.right > this.LOCK_TIME) {
        if (this.showTutorial) {
          this.showTutorial = false; this.pivotLockTimer.right = 0; this.lockProgress = 0;
        } else {
          this.gameStarted = true;
          const video = document.getElementById("input_video");
          if (video) video.style.opacity = "0.2";
          this.spawnFloatingText(this.CENTER_X, this.CENTER_Y, "START!", "white");
        }
      }
    } else { this.pivotLockTimer.right = 0; this.lockProgress = 0; }
  },

  drawTutorialWindow(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 10, 0.88)";
    ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

    const boxW = 860; const boxH = 500;
    const boxX = this.CENTER_X - boxW / 2; const boxY = this.CENTER_Y - boxH / 2;

    ctx.fillStyle = "#121212"; ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 4;
    ctx.shadowBlur = 15; ctx.shadowColor = "#00ffff";
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 20); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = `bold 36px Orbitron`; ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
    ctx.fillText("MATH ADVENTURE: SORTING", this.CENTER_X, boxY + 55);

    ctx.font = `16px Orbitron`; ctx.textAlign = "left";
    const lineX = boxX + 40; let textY = boxY + 130; const lineGap = 45;

    ctx.fillStyle = "#e0e0e0";
    ctx.fillText("1. Numbers will spawn from the outer borders.", lineX, textY);
    ctx.fillText("2. Use your hand to spin the neon paddle bar.", lineX, textY + lineGap);
    ctx.fillStyle = "#ff5555";
    ctx.fillText("3. Deflect ODD numbers into LEFT (Red) slots.", lineX, textY + lineGap * 2);
    ctx.fillStyle = "#55ffff";
    ctx.fillText("4. Deflect EVEN numbers into RIGHT (Blue) slots.", lineX, textY + lineGap * 3);

    const gifX = boxX + boxW - (this.gifPlaceholder.w + 40);
    const gifY = boxY + 120;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(gifX, gifY, this.gifPlaceholder.w, this.gifPlaceholder.h, 10); ctx.fill(); ctx.stroke();

    ctx.font = `italic 14px Orbitron`; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.textAlign = "center";
    ctx.fillText("[ PREVIEW .GIF SPACE ]", gifX + this.gifPlaceholder.w / 2, gifY + this.gifPlaceholder.h / 2);

    ctx.textAlign = "center"; const promptY = boxY + boxH - 45;
    if (this.lockProgress > 0) {
      ctx.fillStyle = "#00ffaa"; ctx.font = `bold 22px Orbitron`;
      ctx.fillText(`LOCKING IN... ${Math.floor(this.lockProgress * 100)}%`, this.CENTER_X, promptY);
    } else {
      ctx.fillStyle = "#ffaa00"; ctx.font = `bold 20px Orbitron`;
      ctx.fillText("PLACE HAND IN CENTER TO CLOSE TUTORIAL", this.CENTER_X, promptY);
    }
    ctx.restore();
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
    ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = this.BALL_RADIUS * 1.5; ctx.lineCap = "round"; ctx.globalAlpha = 0.25;

    for (let b of this.balls) {
      if (b.trail.length < 2) continue;
      let tIdx = b.trailIdx || 0; ctx.moveTo(b.trail[tIdx].x, b.trail[tIdx].y);
      for (let j = 1; j < b.trail.length; j++) { let idx = (tIdx + j) % b.trail.length; ctx.lineTo(b.trail[idx].x, b.trail[idx].y); }
    }
    ctx.stroke(); ctx.globalAlpha = 1.0;

    for (let b of this.balls) {
      if (this.ballCanvas) ctx.drawImage(this.ballCanvas, b.x - this.BALL_RADIUS - 30, b.y - this.BALL_RADIUS - 30);
      ctx.fillStyle = "black"; ctx.fillText(b.number, b.x, b.y);
    }
  },

  drawArms(ctx) {
    const arm = this.armData.right; if (!arm?.shoulder || !arm?.wrist) return;
    const baseAngle = Math.atan2(arm.wrist.y - arm.shoulder.y, arm.wrist.x - arm.shoulder.x);

    if (this.armCanvas) {
      ctx.save(); ctx.translate(this.CENTER_X, this.CENTER_Y);
      ctx.save(); ctx.rotate(baseAngle); ctx.drawImage(this.armCanvas, -40, -40); ctx.restore();
      ctx.rotate(baseAngle + Math.PI); ctx.drawImage(this.armCanvas, -40, -40); ctx.restore();
    }
    if (this.wristCanvas && this.steeringHand) {
      ctx.drawImage(this.wristCanvas, this.steeringHand.x - 18 - 30, this.steeringHand.y - 18 - 30);
    }
  },

  drawPivots(ctx) {
    const r = this.gameStarted ? this.PIVOT_RADIUS : 15;
    ctx.beginPath(); ctx.arc(this.CENTER_X, this.CENTER_Y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.gameStarted ? "#ff2491ff" : "#444"; ctx.fill();

    if (this.lockProgress > 0) {
      ctx.beginPath(); ctx.arc(this.CENTER_X, this.CENTER_Y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.lockProgress);
      ctx.strokeStyle = "#BB66FF"; ctx.lineWidth = 6; ctx.stroke();
    }
  },

  drawParticles(ctx) {
    for (let p of this.particles) {
      ctx.fillStyle = p.color; const s = 4 * Math.max(0, p.life) * 2;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  },

  drawFloaters(ctx) {
    ctx.font = this.fontFloater; ctx.textAlign = "center";
    for (let f of this.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life)); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  },

  drawUI(ctx) {
    if (!this.gameStarted && !this.showTutorial) {
      ctx.textAlign = "center"; ctx.font = this.fontUI;
      ctx.fillStyle = "black"; ctx.fillText("PLACE ONE HAND ON CENTER TO START", this.CENTER_X + 2, this.CENTER_Y - 48);
      ctx.fillStyle = "white"; ctx.fillText("PLACE ONE HAND ON CENTER TO START", this.CENTER_X, this.CENTER_Y - 50);
    }

    ctx.textAlign = "center"; ctx.font = this.scoreScale > 1.1 ? this.fontScoreBig : this.fontScore;
    ctx.fillStyle = this.scoreColor; ctx.fillText(this.score, this.CENTER_X, 100);

    const w = this.virtualWidth; const h = this.virtualHeight;
    ctx.font = this.fontLegend; ctx.textAlign = "center";
    const bottomHeight = h - 65;

    ctx.fillStyle = "#FF0000";
    ctx.fillText("Odd", w * 0.07, 85); ctx.fillText("Odd", w * 0.07, bottomHeight);

    ctx.fillStyle = "#00FFFF";
    ctx.fillText("Even", w * 0.93, 85); ctx.fillText("Even", w * 0.93, bottomHeight);

    if (this.currentMissingState && !this.showTutorial) {
      ctx.fillStyle = "red"; ctx.font = this.fontUI;
      ctx.fillText("BRING ONE HAND IN VIEW", this.CENTER_X, this.CENTER_Y + 150);
    }
  },

  get pivotOffset() { return this._pivotOffset; },
  get armLength() { return this._armLength; },
  get ballRadius() { return this._ballRadius; },
  get edgeSize() { return this._edgeSize; },
  get lineGap() { return this._lineGap; },
  get pivotRadius() { return this._pivotRadius; }
};