const Game4 = {

  running: false,
  score: 0,
  circles: [],
  spawnTimer: 0,

  CENTER_X: 0,
  CENTER_Y: 0,

  CIRCLE_RADIUS: 25,
  HIT_RADIUS: 40,

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
  },

  /* ==============================
     UPDATE LOOP (CALLED FROM MAIN)
  ============================== */
  update(ctx, fingers) {

    if (!this.running) return;

    // Spawn control
    this.spawnTimer++;

    if (this.spawnTimer > 60) { // spawn speed
      this.spawnCircle();
      this.spawnTimer = 0;
    }

    this.updateCircles();
    this.checkHandHits(fingers);

    this.drawCross(ctx);
    this.drawCircles(ctx);
    this.drawIndicators(ctx);
  },

  /* ==============================
     SPAWN CIRCLES FROM 4 SIDES
  ============================== */
  spawnCircle() {

    const number = Math.floor(Math.random() * 100) + 1;
    const side = Math.floor(Math.random() * 4);

    let x, y, vx, vy;

    const speed = 2.5;

    if (side === 0) { // TOP
      x = this.CENTER_X;
      y = -30;
      vx = 0;
      vy = speed;
    }
    else if (side === 1) { // BOTTOM
      x = this.CENTER_X;
      y = canvasElement.height + 30;
      vx = 0;
      vy = -speed;
    }
    else if (side === 2) { // LEFT
      x = -30;
      y = this.CENTER_Y;
      vx = speed;
      vy = 0;
    }
    else { // RIGHT
      x = canvasElement.width + 30;
      y = this.CENTER_Y;
      vx = -speed;
      vy = 0;
    }

    this.circles.push({
      x,
      y,
      vx,
      vy,
      number,
      isOdd: number % 2 !== 0,
      hit: false
    });
  },

  /* ==============================
     UPDATE POSITIONS
  ============================== */
  updateCircles() {

    for (let circle of this.circles) {
      circle.x += circle.vx;
      circle.y += circle.vy;
    }

    // Remove offscreen
    this.circles = this.circles.filter(c =>
      c.x > -50 &&
      c.x < canvasElement.width + 50 &&
      c.y > -50 &&
      c.y < canvasElement.height + 50
    );
  },

  /* ==============================
     DRAW CROSS LINES
  ============================== */
  drawCross(ctx) {

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, this.CENTER_Y);
    ctx.lineTo(canvasElement.width, this.CENTER_Y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.CENTER_X, 0);
    ctx.lineTo(this.CENTER_X, canvasElement.height);
    ctx.stroke();
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
     INDICATORS + SCORE
  ============================== */
  drawIndicators(ctx) {

    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd = Right Finger", 10, 20);

    ctx.fillStyle = "red";
    ctx.fillText("Even = Left Finger", 10, 40);

    ctx.fillStyle = "black";
    ctx.fillText("Score: " + this.score, canvasElement.width - 120, 30);
  },

  /* ==============================
     HAND COLLISION CHECK
  ============================== */
  checkHandHits(fingers) {

    if (!fingers || fingers.length === 0) return;

    for (let circle of this.circles) {

      if (circle.hit) continue;

      for (let finger of fingers) {

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

    // Remove hit circles
    this.circles = this.circles.filter(c => !c.hit);
  }

};
