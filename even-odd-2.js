const Game4 = {



  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  // --- CONFIGURATION ---
  PIVOT_OFFSET: 120, 
  PIVOT_RADIUS: 15,
  ARM_LENGTH: 140,
  BALL_RADIUS: 30,
  MAX_BALLS: 6,
  
  // Physics Tweaks
  LOCK_TIME: 2000,
  ELASTICITY: 1.3, // 1.3 = Ball gains 30% speed on bounce (Pinball feel)
  ARM_POWER: 0.8,  // How much arm speed transfers to ball (0.0 to 1.0)

  // Visuals
  EDGE_SIZE: 35, 
  LINE_GAP: 40,  

  // State
  gameStarted: false,
  running: false,
  score: 0,
  
  // Score Animation State
  scoreScale: 1,
  scoreColor: "white",
  
  // Entities
  balls: [],
  particles: [], 
  floaters: [],  
  
  // Timers
  spawnTimer: 0,
  lastTime: 0,
  shakeTimer: 0, 

  // Pivots
  pivotLockTimer: { left: 0, right: 0 },
  pivotLocked: { left: false, right: false },
  
  // Arm Flash State (Visual feedback on hit)
  armFlash: { left: 0, right: 0 },

  // Pose Data
  pose: null,
  armData: { left: null, right: null },
  armVelocity: {
    left: { vx: 0, vy: 0, last: null },
    right: { vx: 0, vy: 0, last: null }
  },

  CENTER_X: 0,
  CENTER_Y: 0,

  /* ==============================
     INIT
  ============================== */
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
    const video = document.getElementById("input_video");
    if (video) video.style.opacity = "1";
    
    // Reset Score Anim
    this.scoreScale = 1;
    this.scoreColor = "white";
    
    this.pivotLocked = { left: false, right: false };
    this.pivotLockTimer = { left: 0, right: 0 };
    this.armFlash = { left: 0, right: 0 };
    
    this.initPose();
    this.resize()
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

  // ✅ ADD LOCK
  this.poseBusy = false;

  window.sendFrameToPose = async (image) => {

    if (!this.running) return;
    if (this.poseBusy) return;   // ⭐ prevents crash

    this.poseBusy = true;

    try {
      await this.pose.send({ image });
    } catch (e) {
      console.error("POSE ERROR:", e);
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


  const updateArm = (side, elbowLm, wristLm) => {

    if (!elbowLm || !wristLm) return;

    // relax visibility for debugging
    if (elbowLm.visibility < 0.3 || wristLm.visibility < 0.3) return;

    const elbow = mapPoint(elbowLm);
    const wrist = mapPoint(wristLm);

    const vel = this.armVelocity[side];

    if (vel.last) {
      const currVx = wrist.x - vel.last.x;
      const currVy = wrist.y - vel.last.y;

      vel.vx = vel.vx * 0.3 + currVx * 0.7;
      vel.vy = vel.vy * 0.3 + currVy * 0.7;
    }

    vel.last = { x: wrist.x, y: wrist.y };

    this.armData[side] = { elbow, wrist };
  };

  // ⭐ CRITICAL — THIS WAS MISSING
  // swap because camera is mirrored
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

  // ✅ calculate scale FIRST
  this.scale = Math.min(
    w / this.BASE_WIDTH,
    h / this.BASE_HEIGHT
  );

  if (!this.scale || this.scale <= 0) this.scale = 1;

  // ✅ centered play area
  this.playWidth = this.BASE_WIDTH * this.scale;
  this.playHeight = this.BASE_HEIGHT * this.scale;

  this.offsetX = (w - this.playWidth) / 2;
  this.offsetY = (h - this.playHeight) / 2;

  this.CENTER_X = w / 2;
  this.CENTER_Y = h / 2;
},



  /* ==============================
     UPDATE LOOP
  ============================== */
  update(ctx) {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    if (!this.gameStarted) {
      this.checkPivotLock(deltaTime);
    } else {
      this.handleSpawning(deltaTime);
      this.updateBalls(deltaTime / 16.67); 
      this.checkPhysics();
      this.checkScoring();
    }
    
    this.updateParticles();
    this.updateFloaters();

    // Score Animation Decay
    if (this.scoreScale > 1) {
        this.scoreScale -= 0.05; // Shrink back
    } else {
        this.scoreScale = 1;
        this.scoreColor = "white"; // Reset color when settled
    }

    // Arm Flash Decay
    if (this.armFlash.left > 0) this.armFlash.left--;
    if (this.armFlash.right > 0) this.armFlash.right--;

    // Shake Effect
    ctx.save();
    if (this.shakeTimer > 0) {
        const intensity = this.shakeTimer;
        ctx.translate((Math.random()-0.5)*intensity, (Math.random()-0.5)*intensity);
        this.shakeTimer *= 0.9;
        if (this.shakeTimer < 0.5) this.shakeTimer = 0;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    
    ctx.restore();
  },

  /* ==============================
     GAMEPLAY LOGIC
  ============================== */
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
    const speed = (4 + Math.random() * 2)*this.scale; // Slightly faster base speed

    let x, y, vx, vy;

    if (side === 0) { x = this.CENTER_X; y = -30*this.scale; vx = (Math.random()-0.5)*3; vy = speed; } 
    else if (side === 1) { x = this.CENTER_X; y = canvasElement.height + 30; vx = (Math.random()-0.5)*3; vy = -speed; } 
    else if (side === 2) { x = -30*this.scale; y = this.CENTER_Y; vx = speed; vy = (Math.random()-0.5)*3; } 
    else { x = canvasElement.width + 30; y = this.CENTER_Y; vx = -speed; vy = (Math.random()-0.5)*3; } 

    this.balls.push({
      x, y, vx, vy,
      number,
      isOdd,
      color: isOdd ? "#00FFFF" : "#FF0055", 
      trail: [],
      hitCooldown: 0,
      scored: false,
      scale: 1
    });
  },

  updateBalls(dt) {
    for (let b of this.balls) {
      if (b.scored) continue;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.hitCooldown -= dt;

      b.trail.push({x: b.x, y: b.y});
      if (b.trail.length > 8) b.trail.shift();

      // Screen Bounds Bounce (Top/Bottom)
      if (b.y < 0 && b.vy < 0) b.vy *= -1;
      if (b.y > canvasElement.height && b.vy > 0) b.vy *= -1;
    }
  },

  // --- NEW PHYSICS ENGINE ---
  checkPhysics() {
    const checkArmCollision = (arm, pivot, side) => {
      if (!arm?.wrist || !arm?.elbow) return;

      const angle = Math.atan2(arm.wrist.y - arm.elbow.y, arm.wrist.x - arm.elbow.x);
      const tipX = pivot.x + Math.cos(angle) * this.armLength;
      const tipY = pivot.y + Math.sin(angle) * this.armLength;

      const ax = tipX - pivot.x;
      const ay = tipY - pivot.y;
      const armLen = Math.sqrt(ax*ax + ay*ay);
      const nx = -ay / armLen; // Normal
      const ny = ax / armLen;  

      const armVel = this.armVelocity[side];

      for (let b of this.balls) {
        if (b.hitCooldown > 0 || b.scored) continue;

        const dist = this.pointToLineDistance(b.x, b.y, pivot.x, pivot.y, tipX, tipY);

        // HIT DETECTED
        if (dist < this.ballRadius + 8) {
          
          // 1. REFLECTION LOGIC (Bumper Physics)
          // Calculate dot product
          const dot = b.vx * nx + b.vy * ny;
          
          // Elastic Collision formula: v' = v - 2(v.n)n
          // We multiply by ELASTICITY (>1) to add energy (Pinball feel)
          b.vx = (b.vx - 2 * dot * nx) * this.ELASTICITY;
          b.vy = (b.vy - 2 * dot * ny) * this.ELASTICITY;

          // 2. SMASH LOGIC (Add Arm Velocity)
          // Add a percentage of the arm's movement vector to the ball
          b.vx += armVel.vx * this.ARM_POWER;
          b.vy += armVel.vy * this.ARM_POWER;

          // 3. MINIMUM SPEED CHECK
          // Ensure ball doesn't get stuck or stop
          const minSpeed = 8 * this.scale;
          const currentSpeed = Math.sqrt(b.vx**2 + b.vy**2);
          if (currentSpeed < minSpeed) {
              const scale = minSpeed / currentSpeed;
              b.vx *= scale;
              b.vy *= scale;
          }

          // 4. MAX SPEED CLAMP
          const maxSpeed = 25 * this.scale;
          if (currentSpeed > maxSpeed) {
             const scale = maxSpeed / currentSpeed;
             b.vx *= scale;
             b.vy *= scale;
          }

          // 5. PUSH OUT (Prevent sticking)
          b.x += nx * (this.ballRadius - dist + 5 * this.scale);
          b.y += ny * (this.ballRadius - dist + 5 * this.scale);

          b.hitCooldown = 12;
          this.shakeTimer = 8; // Screen Shake
          this.armFlash[side] = 5; // Flash Arm
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