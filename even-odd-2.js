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
  MOVE_SPEED: 1.5, // constant speed
  EDGE_SIZE: 15,   // <<< thickness of highlighted edge zones

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
  update(ctx, fingers) {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 16.67;
    this.lastTime = now;

    this.spawnTimer += deltaTime;
    if (this.spawnTimer > 120) { // spawn rate control
      this.spawnCircle();
      this.spawnTimer = 0;
    }

    this.updateCircles(deltaTime);
    this.checkHandHits(fingers);

    this.drawEdgeZones(ctx); // <<< corrected highlight
    this.drawCross(ctx);
    this.drawCircles(ctx);
    this.drawIndicators(ctx);
  },

  /* ==============================
     SPAWN CIRCLES ON LINES
  ============================== */
  spawnCircle() {
    const number = Math.floor(Math.random() * 100) + 1;
    const side = Math.floor(Math.random() * 4);

    const gap = this.LINE_GAP;
    const speed = this.MOVE_SPEED;

    let x, y, vx, vy;

    if (side === 0) { // top -> down
      x = this.CENTER_X - gap;
      y = -30;
      vx = 0;
      vy = speed;
    }
    else if (side === 1) { // bottom -> up
      x = this.CENTER_X + gap;
      y = canvasElement.height + 30;
      vx = 0;
      vy = -speed;
    }
    else if (side === 2) { // left -> right
      x = -30;
      y = this.CENTER_Y - gap;
      vx = speed;
      vy = 0;
    }
    else { // right -> left
      x = canvasElement.width + 30;
      y = this.CENTER_Y + gap;
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
  updateCircles(deltaTime) {
    for (let circle of this.circles) {
      circle.x += circle.vx * deltaTime;
      circle.y += circle.vy * deltaTime;

      const out =
        circle.x < -50 ||
        circle.x > canvasElement.width + 50 ||
        circle.y < -50 ||
        circle.y > canvasElement.height + 50;

      if (out) circle.hit = true;
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

    // vertical
    ctx.beginPath();
    ctx.moveTo(this.CENTER_X - gap, 0);
    ctx.lineTo(this.CENTER_X - gap, canvasElement.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.CENTER_X + gap, 0);
    ctx.lineTo(this.CENTER_X + gap, canvasElement.height);
    ctx.stroke();

    // horizontal
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
     DRAW EDGE HIGHLIGHT ZONES
     (Matches your image exactly)
  ============================== */
 /* ==============================
   DRAW EDGE HIGHLIGHT ZONES
   Left edges = Red, Right edges = Blue
============================== */
/* ==============================
   DRAW EDGE HIGHLIGHT ZONES
   (Skip cross line gap area)
============================== */
drawEdgeZones(ctx) {
  const w = canvasElement.width;
  const h = canvasElement.height;
  const e = this.EDGE_SIZE;   // thickness of edge highlight
  const gap = this.LINE_GAP;

  const cx = this.CENTER_X;
  const cy = this.CENTER_Y;

  // 🔥 Strong color + glow
  ctx.globalAlpha = 0.8;
  ctx.shadowBlur = 10;

  /* ========= LEFT SIDE (RED) ========= */
  ctx.fillStyle = "rgb(255,40,40)";
  ctx.shadowColor = "red";

  // Top-left edge
  ctx.fillRect(0, 0, cx - gap, e);

  // Bottom-left edge
  ctx.fillRect(0, h - e, cx - gap, e);

  // Left vertical edges (skip center gap)
  ctx.fillRect(0, 0, e, cy - gap);
  ctx.fillRect(0, cy + gap, e, h - (cy + gap));


  /* ========= RIGHT SIDE (BLUE) ========= */
  ctx.fillStyle = "rgb(40,120,255)";
  ctx.shadowColor = "blue";

  // Top-right edge
  ctx.fillRect(cx + gap, 0, w - (cx + gap), e);

  // Bottom-right edge
  ctx.fillRect(cx + gap, h - e, w - (cx + gap), e);

  // Right vertical edges (skip center gap)
  ctx.fillRect(w - e, 0, e, cy - gap);
  ctx.fillRect(w - e, cy + gap, e, h - (cy + gap));

  // Reset effects
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
     DRAW TEXT
  ============================== */
  drawIndicators(ctx) {
    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd = Right Finger", 10, 25);

    ctx.fillStyle = "red";
    ctx.fillText("Even = Left Finger", 10, 50);

    ctx.fillStyle = "black";
    ctx.fillText("Score: " + this.score, canvasElement.width - 140, 30);
  },

  /* ==============================
     HAND COLLISION
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
            this.score += 10;
          }

          circle.hit = true;
          break;
        }
      }
    }

    this.circles = this.circles.filter(c => !c.hit);
  }

};
