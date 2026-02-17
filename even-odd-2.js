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
  circles: [],
  spawnTimer: 0,
  lastTime: 0,

  CENTER_X: 0,
  CENTER_Y: 0,

  CIRCLE_RADIUS: 20,
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
    this.circles = [];
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
      wrist: mapPoint(lm[15]),
      side: "left"
    };

    this.armData.right = {
      elbow: mapPoint(lm[14]),
      wrist: mapPoint(lm[16]),
      side: "right"
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

      if (this.spawnTimer > 120) {
        this.spawnCircle();
        this.spawnTimer = 0;
      }

      this.updateCircles(deltaTime / 16.67);
      this.checkArmLineHits();
    }

    this.drawEdgeZones(ctx);
    this.drawCross(ctx);
    this.drawCenterPivots(ctx);
    this.drawPivotArms(ctx);
    this.drawCircles(ctx);
    this.drawElbows(ctx);
    this.drawIndicators(ctx);
  },

  spawnCircle() {
    const number = Math.floor(Math.random() * 100) + 1;
    const side = Math.floor(Math.random() * 4);

    const gap = this.LINE_GAP;
    const speed = 1.5;

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

    this.circles.push({
      x, y, vx, vy,
      number,
      isOdd: number % 2 !== 0,
      hit: false
    });
  },

  updateCircles(dt) {
    for (let circle of this.circles) {
      circle.x += circle.vx * dt;
      circle.y += circle.vy * dt;

      if (
        circle.x < -60 ||
        circle.x > canvasElement.width + 60 ||
        circle.y < -60 ||
        circle.y > canvasElement.height + 60
      ) {
        if (!circle.hit) this.score -= 1;
        circle.hit = true;
      }
    }

    this.circles = this.circles.filter(c => !c.hit);
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

    const draw = (p, locked, color) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.PIVOT_RADIUS + (locked ? pulse : 0), 0, Math.PI * 2);
      ctx.fillStyle = locked ? color : "white";
      ctx.shadowBlur = locked ? 25 : 0;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    draw(left, this.pivotLocked.left, "red");
    draw(right, this.pivotLocked.right, "blue");
  },

  drawPivotArms(ctx) {
    if (!this.gameStarted) return;

    const leftPivot = {
      x: this.CENTER_X - this.PIVOT_OFFSET,
      y: this.CENTER_Y
    };

    const rightPivot = {
      x: this.CENTER_X + this.PIVOT_OFFSET,
      y: this.CENTER_Y
    };

    const drawArm = (arm, pivot, color) => {
      if (!arm?.wrist || !arm?.elbow) return;

      // ONLY angle from elbow to wrist
      const angle = Math.atan2(
        arm.wrist.y - arm.elbow.y,
        arm.wrist.x - arm.elbow.x
      );

      const endX = pivot.x + Math.cos(angle) * this.ARM_LENGTH;
      const endY = pivot.y + Math.sin(angle) * this.ARM_LENGTH;

      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    };

    drawArm(this.armData.left, leftPivot, "red");
    drawArm(this.armData.right, rightPivot, "blue");
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

  drawCircles(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 18px Arial";

    for (let circle of this.circles) {
      ctx.beginPath();
      ctx.fillStyle = "purple";
      ctx.arc(circle.x, circle.y, this.CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.fillText(circle.number, circle.x, circle.y);
    }
  },

  drawElbows(ctx) {
    const draw = (arm, color) => {
      if (!arm?.elbow) return;
      ctx.beginPath();
      ctx.arc(arm.elbow.x, arm.elbow.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "white";
      ctx.stroke();
    };

    draw(this.armData.left, "red");
    draw(this.armData.right, "blue");
  },

  drawIndicators(ctx) {
    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd = Right Arm", 10, 20);

    ctx.fillStyle = "red";
    ctx.fillText("Even = Left Arm", 10, 40);

    ctx.fillStyle = "white";
    ctx.fillText("Score: " + this.score, canvasElement.width - 130, 30);
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

  checkArmLineHits() {
    const leftPivot = {
      x: this.CENTER_X - this.PIVOT_OFFSET,
      y: this.CENTER_Y
    };

    const rightPivot = {
      x: this.CENTER_X + this.PIVOT_OFFSET,
      y: this.CENTER_Y
    };

    const checkLine = (arm, pivot, side) => {
      if (!arm?.wrist || !arm?.elbow) return;

      const angle = Math.atan2(
        arm.wrist.y - arm.elbow.y,
        arm.wrist.x - arm.elbow.x
      );

      const endX = pivot.x + Math.cos(angle) * this.ARM_LENGTH;
      const endY = pivot.y + Math.sin(angle) * this.ARM_LENGTH;

      for (let circle of this.circles) {
        if (circle.hit) continue;

        const dist = this.pointToLineDistance(
          circle.x, circle.y,
          pivot.x, pivot.y,
          endX, endY
        );

        if (dist < this.CIRCLE_RADIUS + 5) {
          if (
            (circle.isOdd && side === "right") ||
            (!circle.isOdd && side === "left")
          ) this.score += 10;
          else this.score -= 10;

          circle.hit = true;
        }
      }
    };

    checkLine(this.armData.left, leftPivot, "left");
    checkLine(this.armData.right, rightPivot, "right");

    this.circles = this.circles.filter(c => !c.hit);
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
