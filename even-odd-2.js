const Game4 = {

  running: false,
  score: 0,
  circles: [],
  spawnTimer: 0,

  CENTER_X: 320,
  CENTER_Y: 240,

  CIRCLE_RADIUS: 25,
  HIT_RADIUS: 40,

  pose: null,

  armData: {
    left: null,
    right: null
  },

  /* ==============================
     START GAME
  ============================== */
  init() {

    document.getElementById("menu").style.display = "none";

    this.running = true;
    this.score = 0;
    this.circles = [];
    this.spawnTimer = 0;

    this.initPose();

    window.currentGame = this;

    requestAnimationFrame(this.loop.bind(this));
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

    const video = document.getElementById("input_video");

    // Attach to global camera loop
    window.sendFrameToPose = async (image) => {
      await this.pose.send({ image });
    };
  },


  /* ==============================
     POSE RESULTS
  ============================== */
  onPoseResults(results) {

    if (!results.poseLandmarks) return;

    const lm = results.poseLandmarks;
    const canvas = document.getElementById("game_canvas");

    const mapPoint = (p) => ({
      x: canvas.width - (p.x * canvas.width),
      y: p.y * canvas.height
    });

    // LEFT ARM
    this.armData.left = {
      elbow: mapPoint(lm[13]),
      wrist: mapPoint(lm[15])
    };

    // RIGHT ARM
    this.armData.right = {
      elbow: mapPoint(lm[14]),
      wrist: mapPoint(lm[16])
    };
  },


  /* ==============================
     SPAWN CIRCLES
  ============================== */
  spawnCircle() {

    const canvas = document.getElementById("game_canvas");

    const number = Math.floor(Math.random() * 100) + 1;
    const side = Math.floor(Math.random() * 4);

    let x, y, vx, vy;
    const speed = 2.5;

    if (side === 0) {
      x = this.CENTER_X;
      y = -30;
      vx = 0;
      vy = speed;
    }
    else if (side === 1) {
      x = this.CENTER_X;
      y = canvas.height + 30;
      vx = 0;
      vy = -speed;
    }
    else if (side === 2) {
      x = -30;
      y = this.CENTER_Y;
      vx = speed;
      vy = 0;
    }
    else {
      x = canvas.width + 30;
      y = this.CENTER_Y;
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
     UPDATE CIRCLES
  ============================== */
  updateCircles(canvas) {

    for (let circle of this.circles) {
      circle.x += circle.vx;
      circle.y += circle.vy;
    }

    this.circles = this.circles.filter(c =>
      c.x > -50 && c.x < canvas.width + 50 &&
      c.y > -50 && c.y < canvas.height + 50
    );
  },


  /* ==============================
     DRAW CROSS
  ============================== */
  drawCross(ctx, canvas) {

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, this.CENTER_Y);
    ctx.lineTo(canvas.width, this.CENTER_Y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.CENTER_X, 0);
    ctx.lineTo(this.CENTER_X, canvas.height);
    ctx.stroke();
  },


  /* ==============================
     DRAW CIRCLES
  ============================== */
  drawCircles(ctx) {

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 18px Arial";

    for (let c of this.circles) {

      ctx.beginPath();
      ctx.fillStyle = "purple";
      ctx.arc(c.x, c.y, this.CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.fillText(c.number, c.x, c.y);
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
      ctx.lineTo(arm.elbow.x, arm.elbow.y);
      ctx.lineTo(arm.wrist.x, arm.wrist.y);
      ctx.stroke();
    };

    drawArm(this.armData.left);
    drawArm(this.armData.right);
  },


  /* ==============================
     HAND COLLISION
  ============================== */
  checkHandHits() {

    if (!window.fingerPositions) return;

    for (let circle of this.circles) {

      if (circle.hit) continue;

      for (let finger of window.fingerPositions) {

        const dx = circle.x - finger.x;
        const dy = circle.y - finger.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const nearCenter =
          Math.abs(circle.x - this.CENTER_X) < this.HIT_RADIUS &&
          Math.abs(circle.y - this.CENTER_Y) < this.HIT_RADIUS;

        if (dist < this.CIRCLE_RADIUS + 15 && nearCenter) {

          if (
            (circle.isOdd && finger.hand === "Right") ||
            (!circle.isOdd && finger.hand === "Left")
          ) {
            this.score++;
          }

          circle.hit = true;
        }
      }
    }

    this.circles = this.circles.filter(c => !c.hit);
  },


  /* ==============================
     DRAW UI
  ============================== */
  drawUI(ctx, canvas) {

    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd = Right Hand", 10, 20);

    ctx.fillStyle = "red";
    ctx.fillText("Even = Left Hand", 10, 40);

    ctx.fillStyle = "white";
    ctx.fillText("Score: " + this.score, canvas.width - 120, 30);
  },


  /* ==============================
     MAIN UPDATE (for main.js loop)
  ============================== */
  update(ctx) {

    if (!this.running) return;

    const canvas = document.getElementById("game_canvas");

    this.spawnTimer++;

    if (this.spawnTimer > 60) {
      this.spawnCircle();
      this.spawnTimer = 0;
    }

    this.updateCircles(canvas);
    this.checkHandHits();

    this.drawCross(ctx, canvas);
    this.drawCircles(ctx);
    this.drawArms(ctx);
    this.drawUI(ctx, canvas);
  },


  /* ==============================
     LOOP WRAPPER
  ============================== */
  loop() {

    if (!this.running) return;

    requestAnimationFrame(this.loop.bind(this));
  }
};
