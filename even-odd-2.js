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
  LINE_GAP: 40,     // center cross gap
  EDGE_SIZE: 35,    // thickness of highlighted edges

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
  },

  /* ==============================
     UPDATE LOOP
  ============================== */
  update(ctx) {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 16.67;
    this.lastTime = now;

    // Spawn timing
    this.spawnTimer += deltaTime;
    if (this.spawnTimer > 120) { // spawn rate control
      this.spawnCircle();
      this.spawnTimer = 0;
    }

    this.updateCircles(deltaTime);
    this.checkArmHits();

    this.drawEdgeZones(ctx); // colored edges
    this.drawCross(ctx);
    this.drawCircles(ctx);
    this.drawIndicators(ctx);
  },

  /* ==============================
     SPAWN CIRCLES ON CROSS LINES
  ============================== */
  spawnCircle() {
    const number = Math.floor(Math.random() * 100) + 1;
    const side = Math.floor(Math.random() * 4);

    const gap = this.LINE_GAP;
    const speed = 1.5; // <<< SPEED CONTROL HERE

    let x, y, vx, vy;

    if (side === 0) { // TOP → down (left vertical line)
      x = this.CENTER_X - gap;
      y = -30;
      vx = 0;
      vy = speed;
    }
    else if (side === 1) { // BOTTOM → up (right vertical line)
      x = this.CENTER_X + gap;
      y = canvasElement.height + 30;
      vx = 0;
      vy = -speed;
    }
    else if (side === 2) { // LEFT → right (top horizontal line)
      x = -30;
      y = this.CENTER_Y - gap;
      vx = speed;
      vy = 0;
    }
    else { // RIGHT → left (bottom horizontal line)
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
        this.score -= 1; // miss penalty
        circle.hit = true;
      }
    }

    this.circles = this.circles.filter(c => !c.hit);
  },

  /* ==============================
     DRAW CROSS LINES
  ============================== */
  drawCross(ctx) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    const gap = this.LINE_GAP;

    // vertical lines
    ctx.beginPath();
    ctx.moveTo(this.CENTER_X - gap, 0);
    ctx.lineTo(this.CENTER_X - gap, canvasElement.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.CENTER_X + gap, 0);
    ctx.lineTo(this.CENTER_X + gap, canvasElement.height);
    ctx.stroke();

    // horizontal lines
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
     DRAW EDGE ZONES (ONLY EDGES)
     Left = Red (Even)
     Right = Blue (Odd)
     Center cross gap untouched
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

    /* LEFT SIDE (RED) */
    ctx.fillStyle = "rgb(255,40,40)";
    ctx.shadowColor = "red";

    ctx.fillRect(0, 0, cx - gap, e); // top-left edge
    ctx.fillRect(0, h - e, cx - gap, e); // bottom-left edge
    ctx.fillRect(0, 0, e, cy - gap);
    ctx.fillRect(0, cy + gap, e, h - (cy + gap));

    /* RIGHT SIDE (BLUE) */
    ctx.fillStyle = "rgb(40,120,255)";
    ctx.shadowColor = "blue";

    ctx.fillRect(cx + gap, 0, w - (cx + gap), e); // top-right
    ctx.fillRect(cx + gap, h - e, w - (cx + gap), e); // bottom-right
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
     SCORE + LEGEND
  ============================== */
  drawIndicators(ctx) {
    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd = Right Arm", 10, 20);

    ctx.fillStyle = "red";
    ctx.fillText("Even = Left Arm", 10, 40);

    ctx.fillStyle = "black";
    ctx.fillText("Score: " + this.score, canvasElement.width - 130, 30);
  },

  /* ==============================
     ARM HIT DETECTION
     Uses window.armPositions
  ============================== */
  checkArmHits() {
    if (!window.armPositions || window.armPositions.length === 0) return;

    for (let circle of this.circles) {
      if (circle.hit) continue;

      for (let arm of window.armPositions) {

        const dx = circle.x - arm.indexX;
        const dy = circle.y - arm.indexY;
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
  }
};
