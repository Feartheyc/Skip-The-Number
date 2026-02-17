const Game6 = {

  running: false,

  player: {
    x: 320,
    y: 240,
    size: 30,
    speed: 3,
    vx: 0,
    vy: 0
  },

  joystick: null,
  cameraDisabled: false,

  canvasWidth: 640,
  canvasHeight: 480,

  selectedBall: 1,

  balls: [
    { num: 1, label: "st" },
    { num: 2, label: "nd" },
    { num: 3, label: "rd" },
    { num: 4, label: "th" },
    { num: 5, label: "th" }
  ],


  /* =========================
     INIT
  ========================= */
  init() {

    this.running = true;

    // STOP CAMERA COMPLETELY
    if (window.stopCamera) {
      window.stopCamera();
    }

    const video = document.getElementById("input_video");
    if (video) video.style.display = "none";

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.createJoystick();

    const canvas = document.getElementById("game_canvas");

    canvas.addEventListener("mousedown", (e) => {

      const rect = canvas.getBoundingClientRect();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.handleClick(x, y);

    });

  },


  /* =========================
     FULLSCREEN CANVAS
  ========================= */
  resizeCanvas() {

    const canvas = document.getElementById("game_canvas");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;

    // Center player when resizing first time
    if (this.player.x === 320 && this.player.y === 240) {
      this.player.x = this.canvasWidth / 2;
      this.player.y = this.canvasHeight / 2;
    }
  },


  /* =========================
     DISABLE CAMERA
  ========================= */
  disableCamera() {

    const video = document.getElementById("input_video");

    if (video) video.style.display = "none";

    window.sendFrameToHands = null;
    window.sendFrameToPose = null;

    this.cameraDisabled = true;
  },


  /* =========================
     ENABLE CAMERA (optional)
  ========================= */
  enableCamera() {

    const video = document.getElementById("input_video");

    if (video) video.style.display = "block";

    this.cameraDisabled = false;
  },


  /* =========================
     JOYSTICK
  ========================= */
  createJoystick() {

    let zone = document.getElementById("joystickZone");

    if (!zone) {

      zone = document.createElement("div");
      zone.id = "joystickZone";

      zone.style.position = "absolute";
      zone.style.bottom = "40px";
      zone.style.left = "40px";
      zone.style.width = "150px";
      zone.style.height = "150px";
      zone.style.zIndex = "20";

      document.body.appendChild(zone);
    }

    this.joystick = nipplejs.create({
      zone: zone,
      mode: 'static',
      position: { left: '75px', bottom: '75px' },
      color: 'white'
    });

    this.joystick.on('move', (evt, data) => {

      const angle = data.angle.radian;

      this.player.vx = Math.cos(angle) * this.player.speed;
      this.player.vy = -Math.sin(angle) * this.player.speed; // fixed direction

    });

    this.joystick.on('end', () => {
      this.player.vx = 0;
      this.player.vy = 0;
    });

  },


  /* =========================
     BALL UI
  ========================= */
  drawBallUI(ctx) {

    const startX = this.canvasWidth / 2 - 200;
    const y = this.canvasHeight - 80;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "18px Arial";

    this.balls.forEach((ball, i) => {

      const x = startX + i * 100;

      ctx.fillStyle = this.selectedBall === ball.num ? "yellow" : "white";

      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.fillText(ball.num + ball.label, x, y);
    });
  },


  handleClick(x, y) {

    const startX = this.canvasWidth / 2 - 200;
    const uiY = this.canvasHeight - 80;

    this.balls.forEach((ball, i) => {

      const bx = startX + i * 100;
      const by = uiY;

      const dx = x - bx;
      const dy = y - by;

      if (Math.sqrt(dx * dx + dy * dy) < 30) {
        this.selectedBall = ball.num;
      }

    });
  },


  /* =========================
     UPDATE
  ========================= */
  update(ctx) {

    if (!this.running) return;

    this.player.x += this.player.vx;
    this.player.y += this.player.vy;

    // Keep player inside screen
    this.player.x = Math.max(this.player.size, Math.min(this.canvasWidth - this.player.size, this.player.x));
    this.player.y = Math.max(this.player.size, Math.min(this.canvasHeight - this.player.size, this.player.y));

    this.drawBackground(ctx);
    this.drawPlayer(ctx);
    this.drawBallUI(ctx);

  },


  /* =========================
     BACKGROUND
  ========================= */
  drawBackground(ctx) {

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.strokeStyle = "#1e293b";

    for (let x = 0; x < this.canvasWidth; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvasHeight);
      ctx.stroke();
    }

    for (let y = 0; y < this.canvasHeight; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvasWidth, y);
      ctx.stroke();
    }
  },


  /* =========================
     PLAYER
  ========================= */
  drawPlayer(ctx) {

    ctx.fillStyle = "#22c55e";

    ctx.beginPath();
    ctx.arc(
      this.player.x,
      this.player.y,
      this.player.size,
      0,
      Math.PI * 2
    );
    ctx.fill();
  },


  /* =========================
     STOP GAME
  ========================= */
  stop() {

    this.running = false;

    this.enableCamera();

    if (this.joystick) {
      this.joystick.destroy();
      this.joystick = null;
    }

    const zone = document.getElementById("joystickZone");
    if (zone) zone.remove();
  }

};
