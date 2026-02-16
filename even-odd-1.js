// ===== ODD EVEN HAND GAME =====
const GAME2 = {
  canvas: document.getElementById("game_canvas"),
  ctx: document.getElementById("game_canvas").getContext("2d"),

  running: false,
  score: 0,

  laneCount: 5,
  lanes: [],
  circles: [],
  maxPerLane: 2,

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

  start() {
    this.running = true;
    this.score = 0;
    this.circles = [];
    this.initLanes();
    this.spawnLoop();
    requestAnimationFrame(() => this.gameLoop());
  },

  spawnCircle() {
    if (!this.running) return;

    const available = this.lanes.filter(l => l.active < this.maxPerLane);
    if (available.length === 0) return;

    const lane = available[Math.floor(Math.random() * available.length)];
    lane.active++;

    const num = Math.floor(Math.random() * 200) + 1;
    const fromTop = Math.random() < 0.5;

    this.circles.push({
      lane: lane,
      x: lane.x,
      y: fromTop ? -30 : this.canvas.height + 30,
      speed: 1.5,
      direction: fromTop ? 1 : -1,
      number: num,
      radius: 22,
      isOdd: num % 2 !== 0
    });
  },

  spawnLoop() {
    if (!this.running) return;
    this.spawnCircle();
    setTimeout(() => this.spawnLoop(), 900);
  },

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

 drawHUD() {
  // Score (black color)
  this.ctx.fillStyle = "black";
  this.ctx.font = "22px Arial";
  this.ctx.fillText("Score: " + this.score, this.canvas.width - 90, 30);

  // EVEN indicator (Red)
  this.ctx.fillStyle = "red";
  this.ctx.font = "20px Arial";
  this.ctx.fillText("EVEN", 40, 25);

  // ODD indicator (Blue)
  this.ctx.fillStyle = "blue";
  this.ctx.fillText("ODD", 40, 55);
},


  drawCircles() {
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "bold 16px Arial";

    this.circles.forEach(c => {
      this.ctx.beginPath();
      this.ctx.fillStyle = "purple";
      this.ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = "white";
      this.ctx.fillText(c.number, c.x, c.y);
    });
  },

  checkHandHit(circle) {
    if (!window.fingerPositions || window.fingerPositions.length === 0) return false;

    for (let finger of window.fingerPositions) {
      const dx = circle.x - finger.x;
      const dy = circle.y - finger.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < circle.radius + 15) {
        circle.hitHand = finger.hand; // "Left" or "Right"
        return true;
      }
    }
    return false;
  },

  updateCircles() {
    for (let i = this.circles.length - 1; i >= 0; i--) {
      const c = this.circles[i];
      c.y += c.speed * c.direction;

      if (this.checkHandHit(c)) {
        // Right hand → ODD
        // Left hand → EVEN
        if ((c.isOdd && c.hitHand === "Right") || (!c.isOdd && c.hitHand === "Left")) {
          this.score += 10;
        } else {
          this.score -= 10;
        }

        c.lane.active--;
        this.circles.splice(i, 1);
        continue;
      }

      // Missed circle → just remove, NO score change
      if (c.y < -40 || c.y > this.canvas.height + 40) {
        c.lane.active--;
        this.circles.splice(i, 1);
      }
    }
  },

  drawHandCursor() {
    if (!window.fingerPositions) return;

    window.fingerPositions.forEach(finger => {
      this.ctx.beginPath();
      this.ctx.fillStyle = finger.hand === "Right" ? "blue" : "red";
      this.ctx.arc(finger.x, finger.y, 10, 0, Math.PI * 2);
      this.ctx.fill();
    });
  },

  gameLoop() {
    if (!this.running) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawLanes();
    this.drawHUD();
    this.updateCircles();
    this.drawCircles();
    this.drawHandCursor();

    requestAnimationFrame(() => this.gameLoop());
  }
};

// Hook into menu
const originalStartGame = window.startGame;
window.startGame = function (game) {
  if (game === "game2") {
    document.getElementById("menu").style.display = "none";
    GAME2.start();
  } else {
    originalStartGame(game);
  }
};
