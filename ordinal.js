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

  /* =========================
     INIT
  ========================= */
  init() {

    this.running = true;

    if (window.stopCamera) {
    window.stopCamera();
  }

  document.getElementById("input_video").style.display = "none";

    this.createJoystick();
  },

  /* =========================
     DISABLE CAMERA
  ========================= */
  disableCamera() {

    const video = document.getElementById("input_video");

    if (video) {
      video.style.display = "none";
    }

    // Stop sending frames to mediapipe
    window.sendFrameToHands = null;
    window.sendFrameToPose = null;

    this.cameraDisabled = true;
  },

  /* =========================
     ENABLE CAMERA (optional)
  ========================= */
  enableCamera() {

    const video = document.getElementById("input_video");

    if (video) {
      video.style.display = "block";
    }

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

      // FIXED VERTICAL INVERSION HERE
      this.player.vy = -Math.sin(angle) * this.player.speed;

    });

    this.joystick.on('end', () => {
      this.player.vx = 0;
      this.player.vy = 0;
    });

  },

  /* =========================
     UPDATE
  ========================= */
  update(ctx) {

    if (!this.running) return;

    this.player.x += this.player.vx;
    this.player.y += this.player.vy;

    this.drawBackground(ctx);
    this.drawPlayer(ctx);
  },

  /* =========================
     BACKGROUND
  ========================= */
  drawBackground(ctx) {

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    ctx.strokeStyle = "#1e293b";

    for (let x = 0; x < canvasElement.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasElement.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvasElement.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasElement.width, y);
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
     STOP GAME (optional)
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
