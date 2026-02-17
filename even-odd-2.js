const Game4 = {

  PIVOT_OFFSET: 100,
  PIVOT_RADIUS: 12,
  ARM_LENGTH: 120,

  LOCK_RADIUS: 40,
  LOCK_TIME: 2000,

  pivotLockTimer: { left: 0, right: 0 },
  pivotLocked: { left: false, right: false },

  gameStarted: false,

  running: false,
  score: 0,
  balls: [],
  spawnTimer: 0,
  lastTime: 0,

  MAX_BALLS: 3, // <<< CONTROL MAX BALLS ON SCREEN HERE

  CENTER_X: 0,
  CENTER_Y: 0,

  BALL_RADIUS: 20,
  LINE_GAP: 40,
  EDGE_SIZE: 35,

  pose: null,

  armData: {
    left: null,
    right: null
  },

  init() {
    this.CENTER_X = canvasElement.width / 2;
    this.CENTER_Y = canvasElement.height / 2;

    this.running = true;
    this.score = 0;
    this.balls = [];
    this.spawnTimer = 0;
    this.lastTime = performance.now();

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

    window.sendFrameToPose = async (image) => {
      if (!this.running) return;
      await this.pose.send({ image });
    };
  },

  onPoseResults(results) {
    if (!results.poseLandmarks) return;

    const lm = results.poseLandmarks;

    const mapPoint = (p) => ({
      x: canvasElement.width - (p.x * canvasElement.width),
      y: p.y * canvasElement.height
    });

    this.armData.left = {
      elbow: mapPoint(lm[13]),
      wrist: mapPoint(lm[15])
    };

    this.armData.right = {
      elbow: mapPoint(lm[14]),
      wrist: mapPoint(lm[16])
    };
  },

  update(ctx) {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    if (!this.gameStarted) {
      this.checkPivotLock(deltaTime);
    } else {
      this.spawnTimer += deltaTime / 16.67;

      // SPAWN ONLY IF BELOW MAX BALL LIMIT
      if (this.spawnTimer > 120 && this.balls.length < this.MAX_BALLS) {
        this.spawnBall();
        this.spawnTimer = 0;
      }

      this.updateBalls(deltaTime / 16.67);
      this.checkBallLinePhysics();
      this.checkEdgeScoring();
    }

    this.drawEdgeZones(ctx);
    this.drawCross(ctx);
    this.drawCenterPivots(ctx);
    this.drawPivotArms(ctx);
    this.drawBalls(ctx);
    this.drawElbows(ctx);
    this.drawIndicators(ctx);
  },

  spawnBall() {
    const number = Math.floor(Math.random() * 100) + 1;
    const side = Math.floor(Math.random() * 4);

    const gap = this.LINE_GAP;
    const speed = 1.8;

    let x, y, vx, vy;

    if (side === 0) {
      x = this.CENTER_X - gap;
      y = -30;
      vx = 0;
      vy = speed;
    } else if (side === 1) {
      x = this.CENTER_X + gap;
      y = canvasElement.height + 30;
      vx = 0;
      vy = -speed;
    } else if (side === 2) {
      x = -30;
      y = this.CENTER_Y - gap;
      vx = speed;
      vy = 0;
    } else {
      x = canvasElement.width + 30;
      y = this.CENTER_Y + gap;
      vx = -speed;
      vy = 0;
    }

    this.balls.push({
      x, y, vx, vy,
      number,
      isOdd: number % 2 !== 0,
      recentlyHit: 0,
      scored: false
    });
  },

  updateBalls(dt) {
    for (let b of this.balls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.recentlyHit -= dt;
    }
  },

  checkBallLinePhysics() {
    const checkLine = (arm, pivot) => {
      if (!arm?.wrist || !arm?.elbow) return;

      const angle = Math.atan2(
        arm.wrist.y - arm.elbow.y,
        arm.wrist.x - arm.elbow.x
      );

      const endX = pivot.x + Math.cos(angle) * this.ARM_LENGTH;
      const endY = pivot.y + Math.sin(angle) * this.ARM_LENGTH;

      const dx = endX - pivot.x;
      const dy = endY - pivot.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;

      for (let b of this.balls) {
        if (b.recentlyHit > 0) continue;

        const dist = this.pointToLineDistance(
          b.x, b.y,
          pivot.x, pivot.y,
          endX, endY
        );

        if (dist < this.BALL_RADIUS + 2) {
          const dot = b.vx * nx + b.vy * ny;
          b.vx = b.vx - 2 * dot * nx;
          b.vy = b.vy - 2 * dot * ny;
          b.recentlyHit = 10;
        }
      }
    };

    const leftPivot = { x: this.CENTER_X - this.PIVOT_OFFSET, y: this.CENTER_Y };
    const rightPivot = { x: this.CENTER_X + this.PIVOT_OFFSET, y: this.CENTER_Y };

    checkLine(this.armData.left, leftPivot);
    checkLine(this.armData.right, rightPivot);
  },

  checkEdgeScoring() {
    const e = this.EDGE_SIZE;
    const w = canvasElement.width;
    const h = canvasElement.height;
    const cx = this.CENTER_X;
    const gap = this.LINE_GAP;

    for (let b of this.balls) {
      if (b.scored) continue;

      if (b.x < cx - gap && (b.y < e || b.y > h - e || b.x < e)) {
        if (!b.isOdd) this.score += 10;
        else this.score -= 5;
        b.scored = true;
      }

      if (b.x > cx + gap && (b.y < e || b.y > h - e || b.x > w - e)) {
        if (b.isOdd) this.score += 10;
        else this.score -= 5;
        b.scored = true;
      }
    }

    this.balls = this.balls.filter(b =>
      b.x > -100 && b.x < w + 100 && b.y > -100 && b.y < h + 100
    );
  },

  drawCross(ctx) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    const gap = this.LINE_GAP;

    ctx.beginPath();
    ctx.moveTo(this.CENTER_X - gap, 0);
    ctx.lineTo(this.CENTER_X - gap, canvasElement.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.CENTER_X + gap, 0);
    ctx.lineTo(this.CENTER_X + gap, canvasElement.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, this.CENTER_Y - gap);
    ctx.lineTo(canvasElement.width, this.CENTER_Y - gap);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, this.CENTER_Y + gap);
    ctx.lineTo(canvasElement.width, this.CENTER_Y + gap);
    ctx.stroke();
  },

  drawCenterPivots(ctx) {
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    const left = { x: cx - this.PIVOT_OFFSET, y: cy };
    const right = { x: cx + this.PIVOT_OFFSET, y: cy };

    const pulse = Math.sin(performance.now() * 0.01) * 4;

    const draw = (p, locked) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.PIVOT_RADIUS + (locked ? pulse : 0), 0, Math.PI * 2);
      ctx.fillStyle = locked ? "yellow" : "white";
      ctx.shadowBlur = locked ? 25 : 0;
      ctx.shadowColor = "yellow";
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    draw(left, this.pivotLocked.left);
    draw(right, this.pivotLocked.right);
  },

  drawPivotArms(ctx) {
    if (!this.gameStarted) return;

    const leftPivot = { x: this.CENTER_X - this.PIVOT_OFFSET, y: this.CENTER_Y };
    const rightPivot = { x: this.CENTER_X + this.PIVOT_OFFSET, y: this.CENTER_Y };

    const drawArm = (arm, pivot) => {
      if (!arm?.wrist || !arm?.elbow) return;

      const angle = Math.atan2(
        arm.wrist.y - arm.elbow.y,
        arm.wrist.x - arm.elbow.x
      );

      const endX = pivot.x + Math.cos(angle) * this.ARM_LENGTH;
      const endY = pivot.y + Math.sin(angle) * this.ARM_LENGTH;

      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    };

    drawArm(this.armData.left, leftPivot);
    drawArm(this.armData.right, rightPivot);
  },

  drawEdgeZones(ctx) {
    const w = canvasElement.width;
    const h = canvasElement.height;
    const e = this.EDGE_SIZE;
    const gap = this.LINE_GAP;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    ctx.globalAlpha = 0.9;
    ctx.shadowBlur = 40;

    ctx.fillStyle = "rgb(255,40,40)";
    ctx.shadowColor = "red";
    ctx.fillRect(0, 0, cx - gap, e);
    ctx.fillRect(0, h - e, cx - gap, e);
    ctx.fillRect(0, 0, e, cy - gap);
    ctx.fillRect(0, cy + gap, e, h - (cy + gap));

    ctx.fillStyle = "rgb(40,120,255)";
    ctx.shadowColor = "blue";
    ctx.fillRect(cx + gap, 0, w - (cx + gap), e);
    ctx.fillRect(cx + gap, h - e, w - (cx + gap), e);
    ctx.fillRect(w - e, 0, e, cy - gap);
    ctx.fillRect(w - e, cy + gap, e, h - (cy + gap));

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },

  drawBalls(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 18px Arial";

    for (let b of this.balls) {
      ctx.beginPath();
      ctx.fillStyle = "purple";
      ctx.arc(b.x, b.y, this.BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.fillText(b.number, b.x, b.y);
    }
  },

  drawElbows(ctx) {
    const draw = (arm) => {
      if (!arm?.elbow) return;
      ctx.beginPath();
      ctx.arc(arm.elbow.x, arm.elbow.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = "yellow";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "white";
      ctx.stroke();
    };

    draw(this.armData.left);
    draw(this.armData.right);
  },

  drawIndicators(ctx) {
    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd → Blue Edge = +10", 10, 20);

    ctx.fillStyle = "red";
    ctx.fillText("Even → Red Edge = +10", 10, 40);

    ctx.fillStyle = "white";
    ctx.fillText("Score: " + this.score, canvasElement.width - 150, 30);
  },

  checkPivotLock(dt) {
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    const leftPivotX = cx - this.PIVOT_OFFSET;
    const rightPivotX = cx + this.PIVOT_OFFSET;

    const checkArm = (arm, side, pivotX) => {
      if (!arm?.elbow) return;

      const dx = arm.elbow.x - pivotX;
      const dy = arm.elbow.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.LOCK_RADIUS) {
        this.pivotLockTimer[side] += dt;
        if (this.pivotLockTimer[side] > this.LOCK_TIME) {
          this.pivotLocked[side] = true;
        }
      } else {
        this.pivotLockTimer[side] = 0;
        this.pivotLocked[side] = false;
      }
    };

    checkArm(this.armData.left, "left", leftPivotX);
    checkArm(this.armData.right, "right", rightPivotX);

    if (this.pivotLocked.left && this.pivotLocked.right) {
      this.gameStarted = true;
    }
  },

  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = dot / lenSq;

    param = Math.max(0, Math.min(1, param));

    const xx = x1 + param * C;
    const yy = y1 + param * D;

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
};
