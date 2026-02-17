const Game4 = {

  // --- CONFIGURATION ---
  PIVOT_OFFSET: 120, 
  PIVOT_RADIUS: 15,
  ARM_LENGTH: 140,
  BALL_RADIUS: 20,
  MAX_BALLS: 8, // More balls because they are predictable now
  
  // Grid Settings
  GRID_SIZE: 40, // Pixel size of grid cells
  
  // Physics Tweaks
  LOCK_TIME: 2000,
  ELASTICITY: 1.3, 
  ARM_POWER: 1.0, // High power to launch them off tracks

  // Visuals
  EDGE_SIZE: 35, 
  LINE_GAP: 40,  

  // State
  gameStarted: false,
  running: false,
  score: 0,
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

    this.running = true;
    this.score = 0;
    this.balls = [];
    this.particles = [];
    this.floaters = [];
    this.spawnTimer = 0;
    this.lastTime = performance.now();
    this.gameStarted = false;
    this.scoreScale = 1;
    this.pivotLocked = { left: false, right: false };
    this.pivotLockTimer = { left: 0, right: 0 };
    this.armFlash = { left: 0, right: 0 };

    this.initPose();
  },

  initPose() {
    if (this.pose) return;
    this.pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
    this.pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
    this.pose.onResults(this.onPoseResults.bind(this));
    window.sendFrameToPose = async (image) => { if (!this.running) return; await this.pose.send({ image }); };
  },

  onPoseResults(results) {
    if (!results.poseLandmarks) return;
    const lm = results.poseLandmarks;
    const mapPoint = (p) => ({ x: canvasElement.width - (p.x * canvasElement.width), y: p.y * canvasElement.height });

    const updateArm = (side, elbowLm, wristLm) => {
      const elbow = mapPoint(elbowLm);
      const wrist = mapPoint(wristLm);
      const vel = this.armVelocity[side];
      if (vel.last) {
        const currVx = elbow.x - vel.last.x;
        const currVy = elbow.y - vel.last.y;
        vel.vx = vel.vx * 0.3 + currVx * 0.7;
        vel.vy = vel.vy * 0.3 + currVy * 0.7;
      }
      vel.last = { x: elbow.x, y: elbow.y };
      this.armData[side] = { elbow, wrist };
    };
    updateArm("left", lm[13], lm[15]);
    updateArm("right", lm[14], lm[16]);
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

    if (this.scoreScale > 1) this.scoreScale -= 0.05;
    else { this.scoreScale = 1; this.scoreColor = "white"; }

    if (this.armFlash.left > 0) this.armFlash.left--;
    if (this.armFlash.right > 0) this.armFlash.right--;

    ctx.save();
    if (this.shakeTimer > 0) {
        const intensity = this.shakeTimer;
        ctx.translate((Math.random()-0.5)*intensity, (Math.random()-0.5)*intensity);
        this.shakeTimer *= 0.9;
        if (this.shakeTimer < 0.5) this.shakeTimer = 0;
    }

    this.drawBackground(ctx);
    this.drawEdgeZones(ctx); 
    this.drawCross(ctx);     
    this.drawPivots(ctx);
    
    if (this.gameStarted) {
        this.drawBalls(ctx);
        this.drawArms(ctx);
    }

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
    const spawnRate = Math.max(400, 1200 - (this.score * 2)); // Faster spawn

    if (this.spawnTimer > spawnRate && this.balls.length < this.MAX_BALLS) {
       this.spawnBall();
       this.spawnTimer = 0;
    }
  },

  spawnBall() {
    const number = Math.floor(Math.random() * 100) + 1;
    const isOdd = number % 2 !== 0;
    
    // Pick a side (Top, Bottom, Left, Right)
    const side = Math.floor(Math.random() * 4);
    const speed = 2.0 + Math.random(); // Crawler speed (slower than free flight)

    // Calculate Grid Dimensions
    const cols = Math.floor(canvasElement.width / this.GRID_SIZE);
    const rows = Math.floor(canvasElement.height / this.GRID_SIZE);

    let x, y, vx, vy;

    // Snap to grid lines
    if (side === 0) { // Top
        x = (Math.floor(Math.random() * (cols-2)) + 1) * this.GRID_SIZE;
        y = 0;
        vx = 0; vy = speed;
    } else if (side === 1) { // Bottom
        x = (Math.floor(Math.random() * (cols-2)) + 1) * this.GRID_SIZE;
        y = canvasElement.height;
        vx = 0; vy = -speed;
    } else if (side === 2) { // Left
        x = 0;
        y = (Math.floor(Math.random() * (rows-2)) + 1) * this.GRID_SIZE;
        vx = speed; vy = 0;
    } else { // Right
        x = canvasElement.width;
        y = (Math.floor(Math.random() * (rows-2)) + 1) * this.GRID_SIZE;
        vx = -speed; vy = 0;
    }

    this.balls.push({
      x, y, vx, vy,
      number, isOdd,
      color: isOdd ? "#00FFFF" : "#FF0055", 
      trail: [],
      hitCooldown: 0,
      scored: false,
      gridLocked: true, // <<< Key Property: Is it stuck on the rails?
      scale: 1
    });
  },

  updateBalls(dt) {
    for (let b of this.balls) {
      if (b.scored) continue;

      // Update Position
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.hitCooldown -= dt;
      
      b.trail.push({x: b.x, y: b.y});
      if (b.trail.length > 6) b.trail.shift();

      // --- GRID NAVIGATOR LOGIC ---
      if (b.gridLocked) {
          // Check if near an intersection
          const modX = Math.abs(b.x % this.GRID_SIZE);
          const modY = Math.abs(b.y % this.GRID_SIZE);
          const snapT = 4.0; // Tolerance

          // If we are at a cross (both x and y are near grid lines)
          // We check if "centered" on a node (mod close to 0 or close to GRID_SIZE)
          const atNodeX = modX < snapT || modX > this.GRID_SIZE - snapT;
          const atNodeY = modY < snapT || modY > this.GRID_SIZE - snapT;

          if (atNodeX && atNodeY) {
              // 10% Chance to turn at any intersection
              if (Math.random() < 0.10) {
                  this.turnBallOnGrid(b);
              }
              // Force turn if hitting screen edge while locked
              if (b.x < 10 || b.x > canvasElement.width - 10 || b.y < 10 || b.y > canvasElement.height - 10) {
                  this.turnBallOnGrid(b);
              }
          }
      } 
      else {
          // --- FREE FLIGHT PHYSICS (After hit) ---
          if (b.y < 0 && b.vy < 0) b.vy *= -1;
          if (b.y > canvasElement.height && b.vy > 0) b.vy *= -1;
          if (b.x < 0 && b.vx < 0) b.vx *= -1;
          if (b.x > canvasElement.width && b.vx > 0) b.vx *= -1;
      }
    }
  },

  turnBallOnGrid(b) {
      const speed = Math.hypot(b.vx, b.vy);
      // Snap position perfectly to grid to prevent drift
      b.x = Math.round(b.x / this.GRID_SIZE) * this.GRID_SIZE;
      b.y = Math.round(b.y / this.GRID_SIZE) * this.GRID_SIZE;

      // Pick random direction (Up, Down, Left, Right)
      const r = Math.random();
      if (r < 0.25) { b.vx = speed; b.vy = 0; }
      else if (r < 0.5) { b.vx = -speed; b.vy = 0; }
      else if (r < 0.75) { b.vx = 0; b.vy = speed; }
      else { b.vx = 0; b.vy = -speed; }
  },

  checkPhysics() {
    const checkArmCollision = (arm, pivot, side) => {
      if (!arm?.wrist || !arm?.elbow) return;

      const angle = Math.atan2(arm.wrist.y - arm.elbow.y, arm.wrist.x - arm.elbow.x);
      const tipX = pivot.x + Math.cos(angle) * this.ARM_LENGTH;
      const tipY = pivot.y + Math.sin(angle) * this.ARM_LENGTH;

      const ax = tipX - pivot.x;
      const ay = tipY - pivot.y;
      const armLen = Math.sqrt(ax*ax + ay*ay);
      const nx = -ay / armLen; 
      const ny = ax / armLen;  
      const armVel = this.armVelocity[side];

      for (let b of this.balls) {
        if (b.hitCooldown > 0 || b.scored) continue;

        const dist = this.pointToLineDistance(b.x, b.y, pivot.x, pivot.y, tipX, tipY);

        // HIT!
        if (dist < this.BALL_RADIUS + 8) {
          
          // 1. UNLOCK FROM GRID
          b.gridLocked = false; 

          // 2. REFLECTION & SMASH
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * this.ELASTICITY;
          b.vy = (b.vy - 2 * dot * ny) * this.ELASTICITY;
          b.vx += armVel.vx * this.ARM_POWER;
          b.vy += armVel.vy * this.ARM_POWER;

          // 3. SPEED CAPS
          const currentSpeed = Math.sqrt(b.vx**2 + b.vy**2);
          const minSpeed = 8;
          if (currentSpeed < minSpeed) {
              const scale = minSpeed / currentSpeed;
              b.vx *= scale; b.vy *= scale;
          }
          const maxSpeed = 25;
          if (currentSpeed > maxSpeed) {
             const scale = maxSpeed / currentSpeed;
             b.vx *= scale; b.vy *= scale;
          }

          // 4. PUSH OUT
          b.x += nx * (this.BALL_RADIUS - dist + 5);
          b.y += ny * (this.BALL_RADIUS - dist + 5);

          b.hitCooldown = 12;
          this.shakeTimer = 8; 
          this.armFlash[side] = 5; 
          this.spawnExplosion(b.x, b.y, "white", 8);
        }
      }
    };

    const leftPivot = { x: this.CENTER_X - this.PIVOT_OFFSET, y: this.CENTER_Y };
    const rightPivot = { x: this.CENTER_X + this.PIVOT_OFFSET, y: this.CENTER_Y };

    checkArmCollision(this.armData.left, leftPivot, "left");
    checkArmCollision(this.armData.right, rightPivot, "right");
  },

  checkScoring() {
    const w = canvasElement.width;
    const h = canvasElement.height;
    const e = this.EDGE_SIZE; 
    const gap = this.LINE_GAP;
    const cx = this.CENTER_X;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      let b = this.balls[i];
      if (b.scored) continue;

      let scoreType = null; 

      // LEFT ZONE (Red)
      if (b.x < cx - gap && (b.y < e || b.y > h - e || b.x < e)) {
          if (!b.isOdd) scoreType = "good"; else scoreType = "bad";
      }
      // RIGHT ZONE (Blue)
      else if (b.x > cx + gap && (b.y < e || b.y > h - e || b.x > w - e)) {
          if (b.isOdd) scoreType = "good"; else scoreType = "bad";
      }

      if (scoreType) {
        if (scoreType === "good") {
            this.updateScore(10, true); 
            this.spawnFloatingText(b.x, b.y, "+10", "#00FF00");
            this.spawnExplosion(b.x, b.y, "#00FF00", 15);
        } else {
            this.updateScore(-5, false); 
            this.spawnFloatingText(b.x, b.y, "-5", "#FF0000");
            this.spawnExplosion(b.x, b.y, "#FF0000", 10);
            this.shakeTimer = 15; 
        }
        this.balls.splice(i, 1);
      }
    }
  },

  updateScore(amount, isGood) {
      this.score += amount;
      this.scoreScale = 2.0; 
      this.scoreColor = isGood ? "#00FF00" : "#FF0000"; 
  },

  checkPivotLock(dt) {
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;
    const leftPivotX = cx - this.PIVOT_OFFSET;
    const rightPivotX = cx + this.PIVOT_OFFSET;

    const check = (arm, side, px) => {
        if (!arm?.elbow) return;
        const dist = Math.hypot(arm.elbow.x - px, arm.elbow.y - cy);
        if (dist < 40) {
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
        this.spawnFloatingText(cx, cy, "START!", "white");
    }
  },

  spawnExplosion(x, y, color, count) {
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 2;
          this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0, color: color });
      }
  },
  spawnFloatingText(x, y, text, color) { this.floaters.push({ x, y, text, color, life: 1.0, dy: -2 }); },
  updateParticles() { for(let i=this.particles.length-1; i>=0; i--) { let p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.05; if(p.life <= 0) this.particles.splice(i, 1); } },
  updateFloaters() { for(let i=this.floaters.length-1; i>=0; i--) { let f = this.floaters[i]; f.y += f.dy; f.life -= 0.02; if(f.life <= 0) this.floaters.splice(i, 1); } },

  /* ==============================
     DRAWING
  ============================== */
  drawBackground(ctx) {
      ctx.strokeStyle = "rgba(0, 255, 255, 0.1)"; // Brighter grid
      ctx.lineWidth = 1;
      const step = this.GRID_SIZE; 
      
      // Shift grid to center it
      const offsetX = (canvasElement.width % step) / 2;
      const offsetY = (canvasElement.height % step) / 2;

      for(let x=offsetX; x<canvasElement.width; x+=step) {
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, canvasElement.height); ctx.stroke();
      }
      for(let y=offsetY; y<canvasElement.height; y+=step) {
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvasElement.width, y); ctx.stroke();
      }
  },

  drawEdgeZones(ctx) {
    const w = canvasElement.width;
    const h = canvasElement.height;
    const e = this.EDGE_SIZE;
    const gap = this.LINE_GAP;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = 20;

    ctx.fillStyle = "rgba(255, 40, 40, 0.6)"; ctx.shadowColor = "red";
    ctx.fillRect(0, 0, cx - gap, e); ctx.fillRect(0, h - e, cx - gap, e); ctx.fillRect(0, 0, e, cy - gap); ctx.fillRect(0, cy + gap, e, h - (cy + gap));

    ctx.fillStyle = "rgba(40, 120, 255, 0.6)"; ctx.shadowColor = "blue";
    ctx.fillRect(cx + gap, 0, w - (cx + gap), e); ctx.fillRect(cx + gap, h - e, w - (cx + gap), e); ctx.fillRect(w - e, 0, e, cy - gap); ctx.fillRect(w - e, cy + gap, e, h - (cy + gap));

    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  },

  drawCross(ctx) {
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2; const gap = this.LINE_GAP;
    ctx.beginPath(); ctx.moveTo(this.CENTER_X - gap, 0); ctx.lineTo(this.CENTER_X - gap, canvasElement.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.CENTER_X + gap, 0); ctx.lineTo(this.CENTER_X + gap, canvasElement.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, this.CENTER_Y - gap); ctx.lineTo(canvasElement.width, this.CENTER_Y - gap); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, this.CENTER_Y + gap); ctx.lineTo(canvasElement.width, this.CENTER_Y + gap); ctx.stroke();
  },

  drawBalls(ctx) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 16px Arial";

    for (let b of this.balls) {
      if (b.trail.length > 1) {
          ctx.beginPath(); ctx.strokeStyle = b.color; ctx.lineWidth = this.BALL_RADIUS * 0.8; ctx.lineCap = "round"; ctx.globalAlpha = 0.3;
          ctx.moveTo(b.trail[0].x, b.trail[0].y); for(let t of b.trail) ctx.lineTo(t.x, t.y);
          ctx.stroke(); ctx.globalAlpha = 1.0;
      }
      ctx.beginPath(); ctx.fillStyle = b.gridLocked ? "white" : b.color; // Locked balls are white centered
      if (!b.gridLocked) { ctx.shadowBlur = 15; ctx.shadowColor = b.color; }
      
      // Draw Square if locked, Circle if free
      if (b.gridLocked) {
         const s = this.BALL_RADIUS * 1.5;
         ctx.strokeStyle = b.color; ctx.lineWidth = 3;
         ctx.strokeRect(b.x - s/2, b.y - s/2, s, s);
         ctx.fillStyle = "black"; ctx.fillRect(b.x - s/2 + 2, b.y - s/2 + 2, s-4, s-4);
      } else {
         ctx.arc(b.x, b.y, this.BALL_RADIUS, 0, Math.PI * 2); ctx.fill();
      }
      
      ctx.shadowBlur = 0;
      ctx.fillStyle = b.gridLocked ? b.color : "black";
      ctx.fillText(b.number, b.x, b.y);
    }
  },

  drawArms(ctx) {
    const drawOne = (arm, pivot, side) => {
        if (!arm?.elbow) return;
        const angle = Math.atan2(arm.wrist.y - arm.elbow.y, arm.wrist.x - arm.elbow.x);
        const tipX = pivot.x + Math.cos(angle) * this.ARM_LENGTH;
        const tipY = pivot.y + Math.sin(angle) * this.ARM_LENGTH;

        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = this.armFlash[side] > 0 ? "white" : (side === "left" ? "#FF8888" : "#8888FF");
        ctx.lineWidth = this.armFlash[side] > 0 ? 12 : 8;
        ctx.shadowBlur = 20; ctx.shadowColor = ctx.strokeStyle; ctx.stroke(); ctx.shadowBlur = 0;

        ctx.beginPath(); ctx.arc(tipX, tipY, 8, 0, Math.PI*2); ctx.fillStyle = "#FFCC00"; ctx.fill();
    };
    drawOne(this.armData.left, { x: this.CENTER_X - this.PIVOT_OFFSET, y: this.CENTER_Y }, "left");
    drawOne(this.armData.right, { x: this.CENTER_X + this.PIVOT_OFFSET, y: this.CENTER_Y }, "right");
  },

  drawPivots(ctx) {
     const drawRing = (x, y, locked, progress) => {
         ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI*2); ctx.fillStyle = locked ? "#00FF00" : "#444"; ctx.fill();
         if (!locked && progress > 0) { ctx.beginPath(); ctx.arc(x, y, 25, -Math.PI/2, (-Math.PI/2) + (Math.PI*2 * progress)); ctx.strokeStyle = "yellow"; ctx.lineWidth = 4; ctx.stroke(); }
     };
     const leftProg = Math.min(1, this.pivotLockTimer.left / this.LOCK_TIME);
     const rightProg = Math.min(1, this.pivotLockTimer.right / this.LOCK_TIME);
     drawRing(this.CENTER_X - this.PIVOT_OFFSET, this.CENTER_Y, this.pivotLocked.left, leftProg);
     drawRing(this.CENTER_X + this.PIVOT_OFFSET, this.CENTER_Y, this.pivotLocked.right, rightProg);
  },
  drawParticles(ctx) { for(let p of this.particles) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha = 1; },
  drawFloaters(ctx) { ctx.font = "bold 24px Arial"; ctx.textAlign = "center"; for(let f of this.floaters) { ctx.globalAlpha = f.life; ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1; },

  drawUI(ctx) {
    if (!this.gameStarted) {
        ctx.fillStyle = "white"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
        ctx.shadowBlur = 10; ctx.shadowColor = "black";
        ctx.fillText("HOLD ELBOWS ON DOTS TO START", this.CENTER_X, this.CENTER_Y - 50); ctx.shadowBlur = 0;
    }
    ctx.textAlign = "center"; const fontSize = 24 * this.scoreScale; ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = this.scoreColor; ctx.fillText(this.score, this.CENTER_X, 40);
    ctx.font = "16px Arial"; ctx.textAlign = "left"; ctx.fillStyle = "#FF4444"; ctx.fillText("Even (Red)", 10, 20); ctx.fillStyle = "#00FFFF"; ctx.fillText("Odd (Blue)", 10, 40);
  },
  pointToLineDistance(px, py, x1, y1, x2, y2) { const A = px - x1; const B = py - y1; const C = x2 - x1; const D = y2 - y1; const dot = A * C + B * D; const lenSq = C * C + D * D; let param = -1; if (lenSq !== 0) param = dot / lenSq; let xx, yy; if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; } const dx = px - xx; const dy = py - yy; return Math.sqrt(dx * dx + dy * dy); }
};