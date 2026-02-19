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

  selectedBall: "st",

  balls : [
  { type: "st" },
  { type: "nd" },
  { type: "rd" },
  { type: "th" }
],


    targets: [],
    spawnTimer: 0,
    spawnInterval: 1200, // frames (~2 seconds at 60fps)

    score: 0,
    catchRadius: 45,



  /* =========================
     INIT
  ========================= */
  init() {

    this.running = true;

    // STOP CAMERA COMPLETELY
    if (window.stopCamera) {
      window.stopCamera();
    }
    document.getElementById("menu").style.display = "none";


    const video = document.getElementById("input_video");
    if (video) video.style.display = "none";

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.createJoystick();

    const canvas = document.getElementById("game_canvas");

    canvas.addEventListener("mousedown", (e) => {

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  this.handleClick(x, y);

});


    this.targets = [];
    this.spawnTimer = 0;
    this.score = 0;

  },


  /* =========================
     FULLSCREEN CANVAS
  ========================= */
  resizeCanvas() {

  const canvas = document.getElementById("game_canvas");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";

  this.canvasWidth = canvas.width;
  this.canvasHeight = canvas.height;

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

    const startX = this.canvasWidth / 2 - (this.balls.length * 100) / 2;

    const y = this.canvasHeight - 80;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "18px Arial";

    this.balls.forEach((ball, i) => {

      const x = startX + i * 100;

      ctx.fillStyle = this.selectedBall === ball.type ? "yellow" : "white";

      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.fillText(ball.type, x, y);
    });
  },


handleClick(x, y) {

  const startX = this.canvasWidth / 2 - (this.balls.length * 100) / 2;
  const yPos = this.canvasHeight - 80;

  this.balls.forEach((ball, i) => {

    const bx = startX + i * 100;

    const dist = Math.hypot(x - bx, y - yPos);

    if (dist < 30) {
      this.selectedBall = ball.type;
      console.log("Selected:", ball);
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

      this.spawnTimer++;

    if (this.spawnTimer > this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
     }

    this.drawBackground(ctx);
    this.drawPlayer(ctx);
    this.drawTargets(ctx);
    this.drawBallUI(ctx);
    this.drawScore(ctx);
    this.checkCatch();



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

  drawTargets(ctx) {

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "20px Arial";

  this.targets.forEach(target => {

    // circle
    ctx.fillStyle = "#ef4444";

    ctx.beginPath();
    ctx.arc(target.x, target.y, target.size, 0, Math.PI * 2);
    ctx.fill();

    // text
    ctx.fillStyle = "white";
    ctx.fillText(target.num, target.x, target.y);

  });

},

    drawScore(ctx) {

  ctx.fillStyle = "white";
  ctx.font = "22px Arial";
  ctx.textAlign = "left";

  ctx.fillText("Score: " + this.score, 20, 30);

},



  spawnTarget() {

  const num = Math.floor(Math.random() * 30) + 1;


  const x = Math.random() * (this.canvasWidth - 100) + 50;
  const y = Math.random() * (this.canvasHeight - 200) + 50;

  this.targets.push({
    x: x,
    y: y,
    size: 35,
    num: num,
  });

},

    checkCatch() {

  for (let i = this.targets.length - 1; i >= 0; i--) {

    const t = this.targets[i];

    const dx = this.player.x - t.x;
    const dy = this.player.y - t.y;

    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.catchRadius + t.size) {

      // Correct ball
      const correctType = this.getOrdinalType(t.num);

        if (this.selectedBall === correctType)
        {

        this.score++;

        this.targets.splice(i, 1);

      } else {

        // Wrong feedback (shake effect)
        t.x += (Math.random() - 0.5) * 10;
        t.y += (Math.random() - 0.5) * 10;

      }

    }

  }

},
    getOrdinalType(num) {

  if (num % 100 >= 11 && num % 100 <= 13) return "th";

  if (num % 10 === 1) return "st";
  if (num % 10 === 2) return "nd";
  if (num % 10 === 3) return "rd";

  return "th";
},

getOrdinalSuffix(num) {

  const lastTwo = num % 100;

  if (lastTwo >= 11 && lastTwo <= 13) return "th";

  const lastDigit = num % 10;

  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";

  return "th";
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
