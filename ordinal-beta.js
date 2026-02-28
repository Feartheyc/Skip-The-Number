const Game9 = {

  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  CENTER_X: 0,
  CENTER_Y: 0,

  get cssWidth() {
    return canvasElement.width / (window.devicePixelRatio || 1);
  },

  get cssHeight() {
    return canvasElement.height / (window.devicePixelRatio || 1);
  },

  DOOR_RADIUS: 90,
  DOOR_DISTANCE: 260,

  doors: [],
  score: 0,

  currentNumber: 1,
  correctSuffix: "st",

  fingerX: null,
  fingerY: null,

  holdDuration: 1500,
  holdProgress: 0,
  activeDoorIndex: null,
  doorLocked: false,

  /* NEW FEEDBACK STATE */
  feedbackText: "",
  feedbackTimer: 0,
  feedbackColor: "white",
  flashDoorIndex: null,
  flashTimer: 0,

  running: false,
  lastTime: 0,
  
  confettiParticles: [],
shakeDuration: 0,
shakeIntensity: 0,

  sparkBursts: [],
  init() {

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.score = 0;
    this.running = true;
    this.lastTime = performance.now();

    this.setupDoors();
    this.spawnNumber();
  },

  resize() {

    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvasElement.width = cssW * dpr;
    canvasElement.height = cssH * dpr;

    const ctx = canvasElement.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.scale = Math.min(cssW / this.BASE_WIDTH, cssH / this.BASE_HEIGHT);
    if (!this.scale || this.scale <= 0) this.scale = 1;

    this.CENTER_X = cssW / 2;
    this.CENTER_Y = cssH / 2;
  },

  setupDoors() {

    const suffixes = ["st", "nd", "rd", "th"];
    this.doors = [];

    const spacing = this.DOOR_DISTANCE * this.scale;

    for (let i = 0; i < 4; i++) {

      const x = this.CENTER_X + (i - 1.5) * spacing;
      const y = this.CENTER_Y + 150 * this.scale;

      this.doors.push({ suffix: suffixes[i], x, y });
    }
  },

  spawnNumber() {

    const num = Math.floor(Math.random() * 10) + 1;
    this.currentNumber = num;
    this.correctSuffix = this.getSuffix(num);
  },

  getSuffix(num) {
    const last = num % 10;
    if (last === 1) return "st";
    if (last === 2) return "nd";
    if (last === 3) return "rd";
    return "th";
  },

  update(ctx) {

  if (!this.running) return;

  const now = performance.now();
  const delta = now - this.lastTime;
  this.lastTime = now;

  ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

  // NEW: Apply screen shake
  let shakeX = 0;
  let shakeY = 0;

  if (this.shakeDuration > 0) {
    this.shakeDuration -= delta;

    shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    if (this.shakeDuration <= 0) {
      this.shakeDuration = 0;
    }
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  this.updateFingerPosition();
  this.checkDoorAlignment(delta);
  this.updateFeedback(delta);
  this.updateConfetti(delta);
  this.updateSparkBursts(delta);


  this.drawDoors(ctx);
  this.drawNumber(ctx);
  this.drawScore(ctx);
  this.drawFeedback(ctx);
  this.drawConfetti(ctx);
  this.drawSparkBursts(ctx);
  this.drawFingerIndicator(ctx);

  ctx.restore();
},

  updateFingerPosition() {

    if (!window.fingerPositions ||
        window.fingerPositions.length === 0) {
      this.fingerX = null;
      this.fingerY = null;
      return;
    }

    const finger = window.fingerPositions[0];
    this.fingerX = finger.x;
    this.fingerY = finger.y;
  },

  checkDoorAlignment(delta) {

    if (this.fingerX === null ||
        this.fingerY === null) {
      this.resetHold();
      return;
    }

    let alignedIndex = null;

    for (let i = 0; i < this.doors.length; i++) {

      const door = this.doors[i];
      const dx = this.fingerX - door.x;
      const dy = this.fingerY - door.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= this.doorRadius) {
        alignedIndex = i;
        break;
      }
    }

    if (alignedIndex !== null) {

      if (this.activeDoorIndex !== alignedIndex) {
        this.holdProgress = 0;
        this.activeDoorIndex = alignedIndex;
        this.doorLocked = false;
      }

      if (!this.doorLocked) {
        this.holdProgress += delta;

        if (this.holdProgress >= this.holdDuration) {
          this.confirmSelection(alignedIndex);
          this.doorLocked = true;
        }
      }

    } else {
      this.resetHold();
    }
  },

confirmSelection(index) {

  const door = this.doors[index];

  this.flashDoorIndex = index;
  this.flashTimer = 400;

  if (door.suffix === this.correctSuffix) {

  this.score += 10;

  this.feedbackText = "Correct!";
  this.feedbackColor = "#00FF88";
  this.feedbackTimer = 1000;

  this.spawnConfetti(door.x, door.y);
  this.spawnSparkBurst(door.x, door.y);
} else {

    this.score -= 5;

    this.feedbackText = "Try Again!";
    this.feedbackColor = "#FF4444";
    this.feedbackTimer = 1000;

    // Screen shake (already supported in your base)
    this.shakeDuration = 400;
    this.shakeIntensity = 12;
  }

  setTimeout(() => {
    this.spawnNumber();
    this.resetHold();
  }, 700);
},
  updateFeedback(delta) {

    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= delta;
      if (this.feedbackTimer < 0) this.feedbackTimer = 0;
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer < 0) this.flashTimer = 0;
    }
  },

  get doorRadius() {
    return this.DOOR_RADIUS * this.scale;
  },

  drawNumber(ctx) {

    ctx.fillStyle = "#00FF88";
    ctx.font = `bold ${70 * this.scale}px Arial`;
    ctx.textAlign = "center";

    ctx.fillText(
      this.currentNumber,
      this.CENTER_X,
      this.CENTER_Y - 120 * this.scale
    );
  },

    drawDoors(ctx) {

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < this.doors.length; i++) {

      const door = this.doors[i];

      let glow = 0;

      if (i === this.activeDoorIndex) {
        glow = this.holdProgress / this.holdDuration;
      }

      ctx.beginPath();
      ctx.fillStyle = "#222";
      ctx.shadowBlur = 40 * glow;
      ctx.shadowColor = "#00FFFF";

      ctx.arc(
        door.x,
        door.y,
        this.doorRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.shadowBlur = 0;

      ctx.fillStyle = "white";
      ctx.font = `bold ${40 * this.scale}px Arial`;

      ctx.fillText(
        door.suffix.toUpperCase(),
        door.x,
        door.y
      );

      if (i === this.activeDoorIndex && !this.doorLocked) {

        const angle =
          (this.holdProgress / this.holdDuration) * Math.PI * 2;

        ctx.beginPath();
        ctx.lineWidth = 8 * this.scale;
        ctx.strokeStyle = "#00FF88";
        
        ctx.arc(
          door.x,
          door.y,
          this.doorRadius + 12 * this.scale,
          -Math.PI / 2,
          -Math.PI / 2 + angle
        );

        ctx.stroke();
      }
    }
  },


  drawScore(ctx) {

    ctx.fillStyle = "white";
    ctx.font = `bold ${28 * this.scale}px Arial`;
    ctx.textAlign = "center";

    ctx.fillText(
      "Score: " + this.score,
      this.CENTER_X,
      50 * this.scale
    );
  },

  drawFeedback(ctx) {

    if (this.feedbackTimer <= 0) return;

    const alpha =
      this.feedbackTimer / 1000;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.feedbackColor;
    ctx.font = `bold ${60 * this.scale}px Arial`;
    ctx.textAlign = "center";

    ctx.fillText(
      this.feedbackText,
      this.CENTER_X,
      this.CENTER_Y
    );

    ctx.globalAlpha = 1;
  },

  drawFingerIndicator(ctx) {

    if (this.fingerX === null ||
        this.fingerY === null) return;

    ctx.beginPath();
    ctx.arc(
      this.fingerX,
      this.fingerY,
      18 * this.scale,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255,255,0,0.3)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      this.fingerX,
      this.fingerY,
      8 * this.scale,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "yellow";
    ctx.fill();
  },

  spawnConfetti(x, y) {

  for (let i = 0; i < 40; i++) {

    this.confettiParticles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 1.5) * 8,
      size: (Math.random() * 6 + 4) * this.scale,
      life: 800,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`
    });
  }
},


updateConfetti(delta) {

  for (let i = this.confettiParticles.length - 1; i >= 0; i--) {

    const p = this.confettiParticles[i];

    p.life -= delta;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25; // gravity

    if (p.life <= 0) {
      this.confettiParticles.splice(i, 1);
    }
  }
},



drawConfetti(ctx) {

  for (let p of this.confettiParticles) {

    ctx.globalAlpha = p.life / 800;
    ctx.fillStyle = p.color;

    ctx.fillRect(
      p.x,
      p.y,
      p.size,
      p.size
    );
  }

  ctx.globalAlpha = 1;
},

spawnSparkBurst(x, y) {

  this.sparkBursts.push({
    x: x,
    y: y,
    radius: 0,
    maxRadius: 140 * this.scale,
    alpha: 1,
    life: 600
  });

  // Add mini sparks
  for (let i = 0; i < 20; i++) {
    this.sparkBursts.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      size: (Math.random() * 4 + 2) * this.scale,
      life: 500,
      type: "particle"
    });
  }
},

updateSparkBursts(delta) {

  for (let i = this.sparkBursts.length - 1; i >= 0; i--) {

    const s = this.sparkBursts[i];

    s.life -= delta;

    if (s.type === "particle") {

      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.95;
      s.vy *= 0.95;

    } else {

      const progress = 1 - (s.life / 600);
      s.radius = s.maxRadius * progress;
      s.alpha = 1 - progress;
    }

    if (s.life <= 0) {
      this.sparkBursts.splice(i, 1);
    }
  }
},

drawSparkBursts(ctx) {

  for (let s of this.sparkBursts) {

    if (s.type === "particle") {

      ctx.globalAlpha = s.life / 500;
      ctx.fillStyle = "#00FFFF";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();

    } else {

      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 6 * this.scale;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
},

resetHold() {
  this.holdProgress = 0;
  this.activeDoorIndex = null;
  this.doorLocked = false;
},
};