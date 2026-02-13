const Game2 = {

  canvas: document.getElementById("game_canvas"),
  ctx: document.getElementById("game_canvas").getContext("2d"),

  oddEvenRunning: false,
  score: 0,

  laneCount: 6,
  lanes: [],
  circles: [],
  maxPerLane: 2,

  /* ============================== */
  init() {
    this.oddEvenRunning = true;
    this.score = 0;
    this.circles = [];
    this.initLanes();
  },

  /* ============================== */
  initLanes() {
    this.lanes.length = 0;
    const spacing = this.canvas.width / (this.laneCount + 1);

    for (let i = 1; i <= this.laneCount; i++) {
      this.lanes.push({
        x: spacing * i,
        active: 0
      });
    }
  },

  /* ============================== */
  spawnCircle() {

    const available = this.lanes.filter(l => l.active < this.maxPerLane);
    if (available.length === 0) return;

    const lane = available[Math.floor(Math.random() * available.length)];
    lane.active++;

    const num = Math.floor(Math.random() * 200) + 1;

    this.circles.push({
      lane: lane,
      x: lane.x,
      y: -30,
      speed: 1 + Math.random() * 1.5,
      number: num,
      radius: 22,
      isOdd: num % 2 !== 0
    });
  },

  /* ============================== */
  drawLanes() {
    this.ctx.strokeStyle = "#cfcfcf";
    this.ctx.lineWidth = 2;

    this.lanes.forEach(lane => {
      this.ctx.beginPath();
      this.ctx.moveTo(lane.x, 0);
      this.ctx.lineTo(lane.x, this.canvas.height);
      this.ctx.stroke();
    });
  },

  /* ============================== */
  drawHUD() {
    this.ctx.fillStyle = "white";
    this.ctx.font = "18px Arial";
    this.ctx.fillText("Score: " + this.score, this.canvas.width - 110, 30);

    // ODD zone
    this.ctx.fillStyle = "rgba(255,0,0,0.1)";
    this.ctx.fillRect(0, 0, this.canvas.width / 2, this.canvas.height);

    // EVEN zone
    this.ctx.fillStyle = "rgba(0,150,255,0.1)";
    this.ctx.fillRect(this.canvas.width / 2, 0, this.canvas.width / 2, this.canvas.height);

    this.ctx.fillStyle = "white";
    this.ctx.font = "16px Arial";
    this.ctx.fillText("ODD", 20, 20);
    this.ctx.fillText("EVEN", this.canvas.width - 70, 20);
  },

  /* ============================== */
  drawCircles() {
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "bold 16px Arial";

    this.circles.forEach(c => {
      this.ctx.beginPath();
      this.ctx.fillStyle = c.isOdd ? "#ff6b6b" : "#4dabf7";
      this.ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = "white";
      this.ctx.fillText(c.number, c.x, c.y);
    });
  },

  /* ============================== */
  checkHandHit(circle, fingers) {

    if (!fingers || fingers.length === 0) return false;

    for (let finger of fingers) {
      const dx = circle.x - finger.x;
      const dy = circle.y - finger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < circle.radius + 15) {
        circle.hitFingerX = finger.x;
        return true;
      }
    }

    return false;
  },

  /* ============================== */
  update(ctx, fingers) {

    if (!this.oddEvenRunning) return;

    // Spawn occasionally
    if (Math.random() < 0.02) {
      this.spawnCircle();
    }

    // Update circles
    for (let i = this.circles.length - 1; i >= 0; i--) {

      const c = this.circles[i];
      c.y += c.speed;

      if (this.checkHandHit(c, fingers)) {

        const handOnLeft = c.hitFingerX < this.canvas.width / 2;

        if ((c.isOdd && handOnLeft) || (!c.isOdd && !handOnLeft)) {
          this.score += 1;
        } else {
          this.score -= 1;
        }

        c.lane.active--;
        this.circles.splice(i, 1);
        continue;
      }

      if (c.y > this.canvas.height + 30) {
        this.score -= 1;
        c.lane.active--;
        this.circles.splice(i, 1);
      }
    }

    // Draw
    this.drawLanes();
    this.drawHUD();
    this.drawCircles();

    // Draw hand cursors
    fingers.forEach(finger => {
      ctx.beginPath();
      ctx.fillStyle = "yellow";
      ctx.arc(finger.x, finger.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });
  }
};
