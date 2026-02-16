const Game4 = {

  running: false,
  score: 0,
  circles: [],
  spawnTimer: 0,
  lastTime: 0,

  CENTER_X: 0,
  CENTER_Y: 0,

  CIRCLE_RADIUS: 20,
  HIT_RADIUS: 40,
  LINE_GAP: 40,
  EDGE_SIZE: 35,

  pose: null,

  armData: {
    left: null,
    right: null
  },

  /* ==============================
     INIT GAME
  ============================== */
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


  /* ==============================
     INIT MEDIAPIPE POSE
  ============================== */
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
      await this.pose.send({ image });
    };
  },


  /* ==============================
     POSE RESULTS → ARM DATA
  ============================== */
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
      side: "Left"
    };

    this.armData.right = {
      elbow: mapPoint(lm[14]),
      wrist: mapPoint(lm[16]),
      side: "Right"
    };
  },


  /* ==============================
     UPDATE LOOP
  ============================== */
  update(ctx) {

    if (!this.running) return;

    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 16.67;
    this.lastTime = now;

    this.spawnTimer += deltaTime;

    if (this.spawnTimer > 120) {
      this.spawnCircle();
      this.spawnTimer = 0;
    }

    this.updateCircles(deltaTime);
    this.checkArmHits();

    this.drawEdgeZones(ctx);
    this.drawCross(ctx);
    this.drawCircles(ctx);
    this.drawArms(ctx);
    this.drawIndicators(ctx);
  },


  /* ==============================
     SPAWN CIRCLES
  ============================== */
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
    }
    else if (side === 1) {
      x = this.CENTER_X + gap;
      y = canvasElement.height + 30;
      vx = 0;
      vy = -speed;
    }
    else if (side === 2) {
      x = -30;
      y = this.CENTER_Y - gap;
      vx = speed;
      vy = 0;
    }
    else {
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


  /* ==============================
     UPDATE POSITIONS
  ============================== */
  updateCircles(deltaTime) {

    for (let circle of this.circles) {

      circle.x += circle.vx * deltaTime;
      circle.y += circle.vy * deltaTime;

      const out =
        circle.x < -60 ||
        circle.x > canvasElement.width + 60 ||
        circle.y < -60 ||
        circle.y > canvasElement.height + 60;

      if (out && !circle.hit) {
        this.score -= 1;
        circle.hit = true;
      }
    }

    this.circles = this.circles.filter(c => !c.hit);
  },


  /* ==============================
     DRAW CROSS
  ============================== */
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


  /* ==============================
     DRAW EDGE ZONES
  ============================== */
  drawEdgeZones(ctx) {

    const w = canvasElement.width;
    const h = canvasElement.height;
    const e = this.EDGE_SIZE;
    const gap = this.LINE_GAP;
    const cx = this.CENTER_X;
    const cy = this.CENTER_Y;

    ctx.globalAlpha = 0.9;
    ctx.shadowBlur = 40;

    // LEFT RED
    ctx.fillStyle = "rgb(255,40,40)";
    ctx.shadowColor = "red";

    ctx.fillRect(0, 0, cx - gap, e);
    ctx.fillRect(0, h - e, cx - gap, e);
    ctx.fillRect(0, 0, e, cy - gap);
    ctx.fillRect(0, cy + gap, e, h - (cy + gap));

    // RIGHT BLUE
    ctx.fillStyle = "rgb(40,120,255)";
    ctx.shadowColor = "blue";

    ctx.fillRect(cx + gap, 0, w - (cx + gap), e);
    ctx.fillRect(cx + gap, h - e, w - (cx + gap), e);
    ctx.fillRect(w - e, 0, e, cy - gap);
    ctx.fillRect(w - e, cy + gap, e, h - (cy + gap));

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },


  /* ==============================
     DRAW CIRCLES
  ============================== */
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


  /* ==============================
     DRAW ARMS
  ============================== */
  drawArms(ctx) {

    ctx.lineWidth = 6;
    ctx.strokeStyle = "cyan";

    const drawArm = (arm) => {

      if (!arm) return;

      ctx.beginPath();
      ctx.moveTo(arm.elbow.x, arm.elbow.y);
      ctx.lineTo(arm.wrist.x, arm.wrist.y);
      ctx.stroke();
    };

    drawArm(this.armData.left);
    drawArm(this.armData.right);
  },


  /* ==============================
     ARM COLLISION
  ============================== */
  checkArmHits() {

    const arms = [this.armData.left, this.armData.right];

    for (let circle of this.circles) {

      if (circle.hit) continue;

      for (let arm of arms) {

        if (!arm) continue;

        const dx = circle.x - arm.wrist.x;
        const dy = circle.y - arm.wrist.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const nearCenter =
          Math.abs(circle.x - this.CENTER_X) < this.HIT_RADIUS &&
          Math.abs(circle.y - this.CENTER_Y) < this.HIT_RADIUS;

        if (dist < this.CIRCLE_RADIUS + 15 && nearCenter) {

          if (
            (circle.isOdd && arm.side === "Right") ||
            (!circle.isOdd && arm.side === "Left")
          ) {
            this.score += 10;
          } else {
            this.score -= 10;
          }

          circle.hit = true;
          break;
        }
      }
    }

    this.circles = this.circles.filter(c => !c.hit);
  },


  /* ==============================
     DRAW UI
  ============================== */
  drawIndicators(ctx) {

    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd = Right Arm", 10, 20);

    ctx.fillStyle = "red";
    ctx.fillText("Even = Left Arm", 10, 40);

    ctx.fillStyle = "white";
    ctx.fillText("Score: " + this.score, canvasElement.width - 130, 30);
  }

};
