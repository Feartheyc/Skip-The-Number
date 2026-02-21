// pause-area.js

const PauseArea = {
  isPaused: false,
  currentGame: null, // reference to active game object
  canvas: null,
  ctx: null,

  buttons: {
    resume: { x: 0, y: 0, w: 200, h: 60, text: "RESUME" },
    restart: { x: 0, y: 0, w: 200, h: 60, text: "RESTART" },
    back: { x: 0, y: 0, w: 200, h: 60, text: "BACK" }
  },

  init(canvas, ctx, gameRef) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentGame = gameRef;

    this.layoutButtons();

    canvas.addEventListener("click", (e) => {
      if (!this.isPaused) return;

      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      this.handleClick(mx, my);
    });
  },

  layoutButtons() {
    const centerX = this.canvas.width / 2;
    const startY = this.canvas.height / 2 - 100;

    this.buttons.resume.x = centerX - 100;
    this.buttons.resume.y = startY;

    this.buttons.restart.x = centerX - 100;
    this.buttons.restart.y = startY + 90;

    this.buttons.back.x = centerX - 100;
    this.buttons.back.y = startY + 180;
  },

  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.currentGame) {
      this.currentGame.running = !this.isPaused;
    }
  },

  resumeGame() {
    this.isPaused = false;
    if (this.currentGame) this.currentGame.running = true;
  },

  restartGame() {
    this.isPaused = false;
    if (this.currentGame && this.currentGame.reset) {
      this.currentGame.reset();
      this.currentGame.running = true;
    }
  },

  goBack() {
    this.isPaused = false;
    if (typeof Main !== "undefined" && Main.loadHome) {
      Main.loadHome(); // assumes main.js exposes this
    }
  },

  handleClick(mx, my) {
    if (this.isInside(mx, my, this.buttons.resume)) {
      this.resumeGame();
    } else if (this.isInside(mx, my, this.buttons.restart)) {
      this.restartGame();
    } else if (this.isInside(mx, my, this.buttons.back)) {
      this.goBack();
    }
  },

  isInside(mx, my, btn) {
    return (
      mx >= btn.x &&
      mx <= btn.x + btn.w &&
      my >= btn.y &&
      my <= btn.y + btn.h
    );
  },

  draw() {
    if (!this.isPaused) return;

    const ctx = this.ctx;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 40px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("PAUSED", this.canvas.width / 2, this.canvas.height / 2 - 180);

    this.drawButton(this.buttons.resume);
    this.drawButton(this.buttons.restart);
    this.drawButton(this.buttons.back);

    ctx.restore();
  },

  drawButton(btn) {
    const ctx = this.ctx;

    ctx.fillStyle = "#222";
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px Arial";
    ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }
};