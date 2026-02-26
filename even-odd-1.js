const Game2 = {

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
  lastTime: 0,
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

  // helpers to work in CSS pixels (canvas buffer is scaled by devicePixelRatio)
  get cssWidth() { return canvasElement.width / (window.devicePixelRatio || 1); },
  get cssHeight() { return canvasElement.height / (window.devicePixelRatio || 1); },

  SMOOTH: 0.6,
  MIN_ARM_LENGTH: 25,

  init() {
    // initial center in CSS coordinates; resize() will recompute
    const dpr = window.devicePixelRatio || 1;
    this.CENTER_X = (canvasElement.width / dpr) / 2;
    this.CENTER_Y = (canvasElement.height / dpr) / 2;

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.running = true;
    this.score = 0;
    this.balls = [];
    this.particles = [];
    this.floaters = [];
    this.spawnTimer = 0;
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

  // NEW: wrist -> index finger instead of shoulder -> wrist
  const updateArm = (side, wristLm, indexLm) => {
    if (!wristLm || !indexLm) return;
    if (wristLm.visibility < 0.4 || indexLm.visibility < 0.4) return;

    let wrist = mapPoint(wristLm);   // base
    let index = mapPoint(indexLm);   // tip

    const prev = this.armData[side];
    wrist = smooth(prev?.shoulder, wrist); // reuse shoulder slot as base
    index = smooth(prev?.wrist, index);    // reuse wrist slot as tip

    const dx = index.x - wrist.x;
    const dy = index.y - wrist.y;
    if (Math.hypot(dx, dy) < this.MIN_ARM_LENGTH) return;

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
  updateArm("right", lm[16], lm[20]);
  updateArm("left", lm[15], lm[19]);
},

  resize() {
    // adopt the full viewport CSS dimensions for consistent scaling
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // update canvas buffer size (main.js already does this but repeating is safe)
    canvasElement.width = cssW * dpr;
    canvasElement.height = cssH * dpr;

    // compute game scale using CSS coordinates (avoids DPI issues)
    this.scale = Math.min(cssW / this.BASE_WIDTH, cssH / this.BASE_HEIGHT);
    if (!this.scale || this.scale <= 0) this.scale = 1;

    // keep center coordinates in CSS space; transform scales them to device pixels
    this.CENTER_X = cssW / 2;
    this.CENTER_Y = cssH / 2;

    // normalize drawing matrix
    const ctx = canvasElement.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const spawnRate = 2000;

    if (this.spawnTimer > spawnRate && this.balls.length < this.MAX_BALLS) {
      this.spawnBall();
      this.spawnTimer = 0;
    }
  },

  spawnBall() {
    const number = Math.floor(Math.random() * 100) + 1;
    const isOdd = number % 2 !== 0;
    const side = Math.floor(Math.random() * 2); // 0 = top, 1 = bottom
    const speed = 1.5 * this.scale;

    let x, y, vx, vy;

    // spawn slightly outside screen
    const outsideOffset = this.ballRadius * 2;

    // TOP → enter from above screen
    if (side === 0) {
      x = this.CENTER_X;
      y = -outsideOffset;                 // 👈 above canvas
      vx = 0;
      vy = speed;
    }
    // BOTTOM → enter from below screen
    else {
      x = this.CENTER_X;
      y = this.cssHeight + outsideOffset; // 👈 below canvas (CSS units)
      vx = 0;
      vy = -speed;
    }

    this.balls.push({
      x, y, vx, vy,
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
    for (let b of this.balls) {
      if (b.scored) continue;

      // Store previous position (important for collision sweep)
      b.prevX = b.x;
      b.prevY = b.y;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();

      if (b.hitCooldown > 0) b.hitCooldown -= dt;

      const limit = 120 * this.scale;
      const cw = this.cssWidth;
      const ch = this.cssHeight;
      if (
        b.x < -limit || b.x > cw + limit ||
        b.y < -limit || b.y > ch + limit
      ) {
        b.remove = true;
      }
    }

    this.balls = this.balls.filter(b => !b.remove);
  },

 checkPhysics() {
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

  for (let stickAngle of angles) {
    const tipX = pivot.x + Math.cos(stickAngle) * this.armLength;
    const tipY = pivot.y + Math.sin(stickAngle) * this.armLength;

    const armVelX = -Math.sin(stickAngle) * tangentialSpeed;
    const armVelY = Math.cos(stickAngle) * tangentialSpeed;

    const radius = this.ballRadius + 6;

    for (let b of this.balls) {
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
      const dist = Math.hypot(distX, distY);

      if (dist > radius) continue;

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
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > maxSpeed) {
        b.vx = (b.vx / sp) * maxSpeed;
        b.vy = (b.vy / sp) * maxSpeed;
      }

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

    // FIX: Thin the collision detection (Require ball to go 50% into the zone)
    const triggerEdge = e * 0.5;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      let b = this.balls[i];
      if (b.scored) continue;

      let scoreType = null;

      // LEFT ZONE (Red)
      if (b.x < cx - gap) {
        if (b.y < triggerEdge || b.y > h - triggerEdge || b.x < triggerEdge) {
          if (!b.isOdd) scoreType = "good";
          else scoreType = "bad";
        }
      }
      // RIGHT ZONE (Blue)
      else if (b.x > cx + gap) {
        if (b.y < triggerEdge || b.y > h - triggerEdge || b.x > w - triggerEdge) {
          if (b.isOdd) scoreType = "good";
          else scoreType = "bad";
        }
      }

      if (scoreType) {
        if (scoreType === "good") {
          this.updateScore(10, true); // +10, Good
          this.spawnFloatingText(b.x, b.y, "+10", "#00FF00");
          this.spawnExplosion(b.x, b.y, "#00FF00", 15);
        } else {
          this.updateScore(-5, false); // -5, Bad
          this.spawnFloatingText(b.x, b.y, "-5", "#FF0000");
          this.spawnExplosion(b.x, b.y, "#FF0000", 10);
          this.shakeTimer = 15;
        }
        this.balls.splice(i, 1);
      }
    }
  },

  // --- SCORE ANIMATION TRIGGER ---
  updateScore(amount, isGood) {
    this.score += amount;
    this.scoreScale = 2.0; // Jump scale to 2x
    this.scoreColor = isGood ? "#00FF00" : "#FF0000"; // Set color
  },

  checkPivotLock(dt) {
  const cx = this.CENTER_X;
  const cy = this.CENTER_Y;

  const arm = this.armData.right;
  if (!arm?.shoulder) return; // shoulder now stores wrist position

  const dist = Math.hypot(arm.shoulder.x - cx, arm.shoulder.y - cy);

  if (dist < 120 * this.scale) {
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
  spawnExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color
      });
    }
  },

  spawnFloatingText(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.0, dy: -2 });
  },

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  },

  updateFloaters() {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      let f = this.floaters[i];
      f.y += f.dy;
      f.life -= 0.02;
      if (f.life <= 0) this.floaters.splice(i, 1);
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
    const w = this.cssWidth;
    const h = this.cssHeight;
    const e = this.edgeSize;
    const gap = this.lineGap;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = 20;

    // LEFT FULL (Red)
    ctx.fillStyle = "rgba(255, 40, 40, 0.6)";
    ctx.shadowColor = "red";
    ctx.fillRect(0, 0, e, cy);           // left upper vertical
    ctx.fillRect(0, cy, e, h); // left lower vertical
    ctx.fillRect(0, 0, cx - gap, e);                 // top strip
    ctx.fillRect(0, h - e, cx - gap, e);

    // RIGHT FULL (Blue)
    ctx.fillStyle = "rgba(40, 120, 255, 0.6)";
    ctx.shadowColor = "blue";

    ctx.fillRect(w - e, 0, e, cy);           // right upper vertical
    ctx.fillRect(w - e, cy, e, h);           // right lower vertical

    ctx.fillRect(cx + gap, 0, w - (cx + gap), e);       // top strip with gap
    ctx.fillRect(cx + gap, h - e, w - (cx + gap), e);   // bottom strip with gap


    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },

  drawCross(ctx) {
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2 * this.scale;
    const gap = this.lineGap;

    ctx.beginPath(); ctx.moveTo(this.CENTER_X - gap, 0); ctx.lineTo(this.CENTER_X - gap, this.cssHeight); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.CENTER_X + gap, 0); ctx.lineTo(this.CENTER_X + gap, this.cssHeight); ctx.stroke();
    const ch = this.cssHeight;
    ctx.beginPath(); ctx.moveTo(0, this.CENTER_Y - gap); ctx.lineTo(this.cssWidth, this.CENTER_Y - gap); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, this.CENTER_Y + gap); ctx.lineTo(this.cssWidth, this.CENTER_Y + gap); ctx.stroke();
  },

  drawBalls(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${30 * this.scale}px Arial`;

    for (let b of this.balls) {
      // Trail
      if (b.trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = b.color;
        ctx.lineWidth = this.ballRadius * 1.2;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.3;
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (let t of b.trail) ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      ctx.beginPath();
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = b.color;
      ctx.arc(b.x, b.y, this.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

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

  for (let angle of angles) {
    const tipX = pivot.x + Math.cos(angle) * this.armLength;
    const tipY = pivot.y + Math.sin(angle) * this.armLength;

    // Stick
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = "#88FFAA";
    ctx.lineWidth = 10 * this.scale;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#88FFAA";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Tip
    ctx.beginPath();
    ctx.arc(tipX, tipY, 8 * this.scale, 0, Math.PI * 2);
    ctx.fillStyle = "#FFCC00";
    ctx.fill();
  }

  // Wrist highlight
  ctx.beginPath();
  ctx.arc(arm.shoulder.x, arm.shoulder.y, 18 * this.scale, 0, Math.PI * 2);
  ctx.strokeStyle = "#BB66FF";
  ctx.lineWidth = 4 * this.scale;
  ctx.shadowBlur = 15;
  ctx.shadowColor = "#BB66FF";
  ctx.stroke();
  ctx.shadowBlur = 0;
},

  drawPivots(ctx) {
    const x = this.CENTER_X;
    const y = this.CENTER_Y;
    const r = this.gameStarted ? this.PIVOT_RADIUS : 15;

    // Base pivot
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.gameStarted ? "#00FF00" : "#444";
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
    for (let p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * this.scale, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  drawFloaters(ctx) {
    ctx.font = `bold ${24 * this.scale}px Arial`;
    ctx.textAlign = "center";
    for (let f of this.floaters) {
      ctx.globalAlpha = f.life;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  },

  drawUI(ctx) {
    if (!this.gameStarted) {
      ctx.fillStyle = "white";
      ctx.font = `bold ${30 * this.scale}px Arial`;
      ctx.textAlign = "center";
      ctx.shadowBlur = 10 * this.scale; ctx.shadowColor = "black";
      ctx.fillText("HOLD SHOULDER ON DOTS TO START", this.CENTER_X, this.CENTER_Y - 50 * this.scale);
      ctx.shadowBlur = 0;
    }

    // ANIMATED SCORE
    ctx.textAlign = "center";
    // Scale the font size
    const fontSize = 24 * this.scoreScale * this.scale;
    ctx.font = `bold ${fontSize}px Arial`;

    ctx.fillStyle = this.scoreColor;
    ctx.fillText(this.score, this.CENTER_X, 40 * this.scale);

    // Legend
    ctx.font = `${16 * this.scale}px Arial`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FF4444";
    ctx.fillText("Even (Red)", 10 * this.scale, 20 * this.scale);
    ctx.fillStyle = "#00FFFF";
    ctx.fillText("Odd (Blue)", 10 * this.scale, 40 * this.scale);
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

