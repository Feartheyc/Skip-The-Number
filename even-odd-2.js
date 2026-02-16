const Game4 = {
  running: false,
  score: 0,
  circles: [],
  spawnTimer: 0,

  CENTER_X: canvas.width / 2,
  CENTER_Y: canvas.height / 2,
  CIRCLE_RADIUS: 25,
  HIT_RADIUS: 40,

  start() {
    document.getElementById("menu").style.display = "none";
    this.running = true;
    this.score = 0;
    this.circles = [];
    this.spawnTimer = 0;
    requestAnimationFrame(this.loop.bind(this));
  },

  /* ==============================
     SPAWN CIRCLES FROM 4 SIDES
  ============================== */
  spawnCircle() {
    const number = Math.floor(Math.random() * 100) + 1;
    const side = Math.floor(Math.random() * 4); // 0 top,1 bottom,2 left,3 right

    let x, y, vx, vy;
    const speed = 2.5; // SPEED CONTROL HERE

    if (side === 0) { // top
      x = this.CENTER_X;
      y = -30;
      vx = 0;
      vy = speed;
    } else if (side === 1) { // bottom
      x = this.CENTER_X;
      y = canvas.height + 30;
      vx = 0;
      vy = -speed;
    } else if (side === 2) { // left
      x = -30;
      y = this.CENTER_Y;
      vx = speed;
      vy = 0;
    } else { // right
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
     DRAW CROSS LINES
  ============================== */
  drawCross() {
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
     INDICATORS + SCORE
  ============================== */
  drawIndicators() {
    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "blue";
    ctx.fillText("Odd = Right Finger", 10, 20);

    ctx.fillStyle = "red";
    ctx.fillText("Even = Left Finger", 10, 40);

    ctx.fillStyle = "black";
    ctx.fillText("Score: " + this.score, canvas.width - 120, 30);
  },

  /* ==============================
     UPDATE CIRCLES
  ============================== */
  updateCircles() {
    for (let circle of this.circles) {
      circle.x += circle.vx;
      circle.y += circle.vy;
    }

    // remove off-screen (no score penalty)
    this.circles = this.circles.filter(c =>
      c.x > -50 && c.x < canvas.width + 50 &&
      c.y > -50 && c.y < canvas.height + 50
    );
  },

  /* ==============================
     DRAW CIRCLES
  ============================== */
  drawCircles() {
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
     HAND COLLISION CHECK
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

    // remove hit circles
    this.circles = this.circles.filter(c => !c.hit);
  },

  /* ==============================
     GAME LOOP
  ============================== */
  loop() {
    if (!this.running) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.spawnTimer++;
    if (this.spawnTimer > 60) { // spawn rate control
      this.spawnCircle();
      this.spawnTimer = 0;
    }

    this.updateCircles();
    this.checkHandHits();
    this.drawCross();
    this.drawCircles();
    this.drawIndicators();

    requestAnimationFrame(this.loop.bind(this));
  }
};

/* ==============================
   HOOK INTO MENU
============================== */
const prevStartGame = window.startGame;
window.startGame = function (game) {
  if (game === "game4") {
    game4.start();
  } else {
    prevStartGame(game);
  }
};
