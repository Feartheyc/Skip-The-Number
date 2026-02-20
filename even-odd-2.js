const Game4 = {

  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  PIVOT_OFFSET: 120,
  PIVOT_RADIUS: 15,
  ARM_LENGTH: 140,
  BALL_RADIUS: 30,
  MAX_BALLS: 6,

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

  SMOOTH: 0.6,
  MIN_ARM_LENGTH: 25,

  init() {
    this.CENTER_X = canvasElement.width / 2;
    this.CENTER_Y = canvasElement.height / 2;

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
      x: (1 - p.x) * canvasElement.width,
      y: p.y * canvasElement.height
    });

    const smooth = (oldP, newP) => {
      if (!oldP) return newP;
      return {
        x: oldP.x * this.SMOOTH + newP.x * (1 - this.SMOOTH),
        y: oldP.y * this.SMOOTH + newP.y * (1 - this.SMOOTH)
      };
    };

    const updateArm = (side, elbowLm, wristLm) => {
      if (!elbowLm || !wristLm) return;
      if (elbowLm.visibility < 0.4 || wristLm.visibility < 0.4) return;

      let elbow = mapPoint(elbowLm);
      let wrist = mapPoint(wristLm);

      const prev = this.armData[side];
      elbow = smooth(prev?.elbow, elbow);
      wrist = smooth(prev?.wrist, wrist);

      const dx = wrist.x - elbow.x;
      const dy = wrist.y - elbow.y;
      if (Math.hypot(dx, dy) < this.MIN_ARM_LENGTH) return;

      const vel = this.armVelocity[side];
      if (vel.last) {
        vel.vx = vel.vx * 0.5 + (wrist.x - vel.last.x) * 0.5;
        vel.vy = vel.vy * 0.5 + (wrist.y - vel.last.y) * 0.5;
      }
      vel.last = { x: wrist.x, y: wrist.y };

      this.armData[side] = { elbow, wrist };
    };

    updateArm("right", lm[14], lm[16]);
    updateArm("left", lm[13], lm[15]);
  },

  resize() {
    const rect = canvasElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasElement.width = rect.width * dpr;
    canvasElement.height = rect.height * dpr;

    const w = canvasElement.width;
    const h = canvasElement.height;

    this.scale = Math.min(w / this.BASE_WIDTH, h / this.BASE_HEIGHT);
    if (!this.scale || this.scale <= 0) this.scale = 1;

    this.CENTER_X = w / 2;
    this.CENTER_Y = h / 2;
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

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (this.gameStarted) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
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
    const spawnRate = Math.max(500, 1000 - (this.score * 2));

    if (this.spawnTimer > spawnRate && this.balls.length < this.MAX_BALLS) {
      this.spawnBall();
      this.spawnTimer = 0;
    }
  },

  spawnBall() {
  const number = Math.floor(Math.random() * 100) + 1;
  const isOdd = number % 2 !== 0;
  const side = Math.floor(Math.random() * 4);
  const speed = (4 + Math.random() * 2) * this.scale;

  let x, y, vx, vy;

  // TOP → straight down
  if (side === 0) {
    x = this.CENTER_X;
    y = -50;
    vx = 0;
    vy = speed;
  }

  // BOTTOM → straight up
  else if (side === 1) {
    x = this.CENTER_X;
    y = canvasElement.height + 50;
    vx = 0;
    vy = -speed;
  }

  // LEFT → straight right
  else if (side === 2) {
    x = -50;
    y = this.CENTER_Y;
    vx = speed;
    vy = 0;
  }

  // RIGHT → straight left
  else {
    x = canvasElement.width + 50;
    y = this.CENTER_Y;
    vx = -speed;
    vy = 0;
  }

  this.balls.push({
    x, y, vx, vy,
    number,
    isOdd,
    color: isOdd ? "#00FFFF" : "#FF0055",
    trail: [],
    hitCooldown: 0,
    scored: false
  });
},
updateBalls(dt) {
  for (let b of this.balls) {
    if (b.scored) continue;

    // Move ball
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.hitCooldown -= dt;

    // ❌ Remove vertical bounce (this was blocking entry behavior)
    // if (b.y < 0 && b.vy < 0) b.vy *= -1;
    // if (b.y > canvasElement.height && b.vy > 0) b.vy *= -1;

    // OPTIONAL: remove ball if fully off screen (cleanup)
    if (
      b.x < -100 || b.x > canvasElement.width + 100 ||
      b.y < -100 || b.y > canvasElement.height + 100
    ) {
      b.remove = true;
    }
  }

  // Clean removed balls
  this.balls = this.balls.filter(b => !b.remove);
},

  checkPhysics() {
    const margin = this.ballRadius + 5;

    const checkArmCollision = (arm, pivot, side) => {
      if (!arm?.wrist || !arm?.elbow) return;

      const angle = Math.atan2(
        arm.wrist.y - arm.elbow.y,
        arm.wrist.x - arm.elbow.x
      );

      const tipX = pivot.x + Math.cos(angle) * this.armLength;
      const tipY = pivot.y + Math.sin(angle) * this.armLength;

      const ax = tipX - pivot.x;
      const ay = tipY - pivot.y;
      const armLen = Math.hypot(ax, ay);
      const nx = -ay / armLen;
      const ny = ax / armLen;

      const armVel = this.armVelocity[side];

      for (let b of this.balls) {
        if (b.hitCooldown > 0 || b.scored) continue;

        if (
          b.x < -margin || b.x > canvasElement.width + margin ||
          b.y < -margin || b.y > canvasElement.height + margin
        ) continue;

        const dist = this.pointToLineDistance(b.x, b.y, pivot.x, pivot.y, tipX, tipY);

        if (dist < this.ballRadius + 5) {
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * this.ELASTICITY;
          b.vy = (b.vy - 2 * dot * ny) * this.ELASTICITY;

          b.vx += armVel.vx * this.ARM_POWER;
          b.vy += armVel.vy * this.ARM_POWER;

          const speed = Math.hypot(b.vx, b.vy);
          const minSpeed = 8 * this.scale;
          const maxSpeed = 25 * this.scale;

          if (speed < minSpeed) {
            const s = minSpeed / speed;
            b.vx *= s; b.vy *= s;
          }
          if (speed > maxSpeed) {
            const s = maxSpeed / speed;
            b.vx *= s; b.vy *= s;
          }

          b.hitCooldown = 10;
          this.spawnExplosion(b.x, b.y, "white", 8);
        }
      }
    };

    const leftPivot = { x: this.CENTER_X - this.pivotOffset, y: this.CENTER_Y };
    const rightPivot = { x: this.CENTER_X + this.pivotOffset, y: this.CENTER_Y };

    checkArmCollision(this.armData.left, leftPivot, "left");
    checkArmCollision(this.armData.right, rightPivot, "right");
  },

  checkScoring() {
    const w = canvasElement.width;
    const h = canvasElement.height;
    const e = this.edgeSize; 
    const gap = this.lineGap;
    const cx = this.CENTER_X;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      let b = this.balls[i];
      if (b.scored) continue;

      let scoreType = null; 

      // LEFT ZONE (Red)
      if (b.x < cx - gap) {
          if (b.y < e || b.y > h - e || b.x < e) {
              if (!b.isOdd) scoreType = "good"; 
              else scoreType = "bad";
          }
      }
      // RIGHT ZONE (Blue)
      else if (b.x > cx + gap) {
          if (b.y < e || b.y > h - e || b.x > w - e) {
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
    const leftPivotX = cx - this.pivotOffset;
    const rightPivotX = cx + this.pivotOffset;

    const check = (arm, side, px) => {
        if (!arm?.elbow) return;
        const dist = Math.hypot(arm.elbow.x - px, arm.elbow.y - cy);
        
        if (dist < 120 *this.scale) {
            this.pivotLockTimer[side] += dt;
            if (this.pivotLockTimer[side] > this.LOCK_TIME) this.pivotLocked[side] = true;
        } else {
            this.pivotLockTimer[side] = 0;
        }
    };

    check(this.armData.left, "left", leftPivotX);
    check(this.armData.right, "right", rightPivotX);

    if (this.pivotLocked.left && this.pivotLocked.right) {
        this.gameStarted = true;
        
    const video = document.getElementById("input_video");
    if (video) video.style.opacity = "0";
        this.spawnFloatingText(cx, cy, "START!", "white");
    }
  },

  /* ==============================
     VISUAL EFFECTS
  ============================= */
  spawnExplosion(x, y, color, count) {
      for(let i=0; i<count; i++) {
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
      for(let i=this.particles.length-1; i>=0; i--) {
          let p = this.particles[i];
          p.x += p.vx; p.y += p.vy;
          p.life -= 0.05;
          if(p.life <= 0) this.particles.splice(i, 1);
      }
  },

  updateFloaters() {
      for(let i=this.floaters.length-1; i>=0; i--) {
          let f = this.floaters[i];
          f.y += f.dy;
          f.life -= 0.02;
          if(f.life <= 0) this.floaters.splice(i, 1);
      }
  },

  /* ==============================
     DRAWING
  ============================== */
  drawBackground(ctx) {
      ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      const step = 40;
      for(let x=0; x<canvasElement.width; x+=step) {
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, canvasElement.height); ctx.stroke();
      }
      for(let y=0; y<canvasElement.height; y+=step) {
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvasElement.width, y); ctx.stroke();
      }
  },

  drawEdgeZones(ctx) {
    const w = canvasElement.width;
    const h = canvasElement.height;
    const e = this.edgeSize;
    const gap = this.lineGap;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = 20;

    // LEFT (RED)
    ctx.fillStyle = "rgba(255, 40, 40, 0.6)"; 
    ctx.shadowColor = "red";
    ctx.fillRect(0, 0, cx - gap, e);
    ctx.fillRect(0, h - e, cx - gap, e);
    ctx.fillRect(0, 0, e, cy - gap);
    ctx.fillRect(0, cy + gap, e, h - (cy + gap));

    // RIGHT (BLUE)
    ctx.fillStyle = "rgba(40, 120, 255, 0.6)"; 
    ctx.shadowColor = "blue";
    ctx.fillRect(cx + gap, 0, w - (cx + gap), e);
    ctx.fillRect(cx + gap, h - e, w - (cx + gap), e);
    ctx.fillRect(w - e, 0, e, cy - gap);
    ctx.fillRect(w - e, cy + gap, e, h - (cy + gap));

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },
  

  drawCross(ctx) {
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2*this.scale;
    const gap = this.lineGap;
    
    ctx.beginPath(); ctx.moveTo(this.CENTER_X - gap, 0); ctx.lineTo(this.CENTER_X - gap, canvasElement.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.CENTER_X + gap, 0); ctx.lineTo(this.CENTER_X + gap, canvasElement.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, this.CENTER_Y - gap); ctx.lineTo(canvasElement.width, this.CENTER_Y - gap); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, this.CENTER_Y + gap); ctx.lineTo(canvasElement.width, this.CENTER_Y + gap); ctx.stroke();
  },

  drawBalls(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${16*this.scale}px Arial`;

    for (let b of this.balls) {
      // Trail
      if (b.trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = b.color;
          ctx.lineWidth = b.scale * this.ballRadius * 1.2;
          ctx.lineCap = "round";
          ctx.globalAlpha = 0.3;
          ctx.moveTo(b.trail[0].x, b.trail[0].y);
          for(let t of b.trail) ctx.lineTo(t.x, t.y);
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
    const drawOne = (arm, pivot, side) => {
        if (!arm?.elbow) return;
        const angle = Math.atan2(arm.wrist.y - arm.elbow.y, arm.wrist.x - arm.elbow.x);
        const tipX = pivot.x + Math.cos(angle) * this.armLength;
        const tipY = pivot.y + Math.sin(angle) * this.armLength;

        ctx.beginPath();
        ctx.moveTo(pivot.x, pivot.y);
        ctx.lineTo(tipX, tipY);
        
        // Flash White on Hit
        ctx.strokeStyle = this.armFlash[side] > 0 ? "white" : (side === "left" ? "#FF8888" : "#8888FF");
        ctx.lineWidth = this.armFlash[side] > 0 ? 12 *this.scale: 8 * this.scale;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "yellow";
      ctx.beginPath();
      ctx.arc(arm.elbow.x, arm.elbow.y, 10 * this.scale, 0, Math.PI * 2);
      ctx.fill();
        ctx.beginPath();
        ctx.arc(tipX, tipY, 8*this.scale, 0, Math.PI*2);
        ctx.fillStyle = "#FFCC00";
        ctx.fill();
    };

    drawOne(this.armData.left, { x: this.CENTER_X - this.pivotOffset, y: this.CENTER_Y }, "left");
    drawOne(this.armData.right, { x: this.CENTER_X + this.pivotOffset, y: this.CENTER_Y }, "right");
  },

  drawPivots(ctx) {
     const drawRing = (x, y, locked, progress) => {
         ctx.beginPath();
         ctx.arc(x, y, this.pivotRadius, 0, Math.PI*2);
         ctx.fillStyle = locked ? "#00FF00" : "#444";
         ctx.fill();
         
         if (!locked && progress > 0) {
             ctx.beginPath();
             ctx.arc(x, y, this.pivotRadius, -Math.PI/2, (-Math.PI/2) + (Math.PI*2 * progress));
             ctx.strokeStyle = "yellow";
             ctx.lineWidth = 4;
             ctx.stroke();
         }
     };

     const leftProg = Math.min(1, this.pivotLockTimer.left / this.LOCK_TIME);
     const rightProg = Math.min(1, this.pivotLockTimer.right / this.LOCK_TIME);

     drawRing(this.CENTER_X - this.pivotOffset, this.CENTER_Y, this.pivotLocked.left, leftProg);
     drawRing(this.CENTER_X + this.pivotOffset, this.CENTER_Y, this.pivotLocked.right, rightProg);
     
  },

  drawParticles(ctx) {
      for(let p of this.particles) {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
  },

  drawFloaters(ctx) {
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      for(let f of this.floaters) {
          ctx.globalAlpha = f.life;
          ctx.fillStyle = f.color;
          ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
  },
  drawUI(ctx) {
    if (!this.gameStarted) {
        ctx.fillStyle = "white";
        ctx.font = "bold 30px Arial";
        ctx.textAlign = "center";
        ctx.shadowBlur = 10; ctx.shadowColor = "black";
        ctx.fillText("HOLD ELBOWS ON DOTS TO START", this.CENTER_X, this.CENTER_Y - 50);
        ctx.shadowBlur = 0;
    }

    // ANIMATED SCORE
    ctx.textAlign = "center";
    // Scale the font size
    const fontSize = 24 * this.scoreScale; 
    ctx.font = `bold ${fontSize}px Arial`;
    
    ctx.fillStyle = this.scoreColor;
    ctx.fillText(this.score, this.CENTER_X, 40);

    // Legend
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "#FF4444"; 
    ctx.fillText("Even (Red)", 10, 20);
    ctx.fillStyle = "#00FFFF";
    ctx.fillText("Odd (Blue)", 10, 40);
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