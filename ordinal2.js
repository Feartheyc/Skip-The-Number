const Game10 = {
  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  COLUMN_COUNT: 5,
  TIME_LIMIT: 5000, 
  RESET_REQUIRED: true,

  currentNumber: 0,
  correctSuffix: "",
  playerColumn: 2, 
  targetColumn: -1,
  
  timer: 0,
  score: 0,
  gameState: "WAITING", 
  
  feedbackText: "",
  feedbackColor: "white",
  feedbackTimer: 0,

  // Tracking & Effects State
  bodyPoints: [],
  bodyCenterX: null,
  shakeDuration: 0,
  shakeIntensity: 0,
  sparks: [],

  systemStatus: "SCANNING UPPER BODY...",
  lastTime: performance.now(),
  running: false,

  init() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.score = 0;
    this.running = true;
    this.lastTime = performance.now();
    this.sparks = [];
    this.startNewRound();
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
  },

  startNewRound() {
    const num = Math.floor(Math.random() * 60) + 1;
    this.currentNumber = num;
    this.correctSuffix = this.getSuffix(num);
    
    const suffixIndices = { "st": 0, "nd": 1, "rd": 3, "th": 4 };
    this.targetColumn = suffixIndices[this.correctSuffix];
    
    this.timer = this.TIME_LIMIT;
    this.gameState = "MOVING";
  },

  getSuffix(num) {
    if (num % 100 >= 11 && num % 100 <= 13) return "th";
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

    this.processUpperBody();
    this.updateLogic(delta);
    this.updateEffects(delta);

    // Apply Screen Shake
    let sx = 0, sy = 0;
    if (this.shakeDuration > 0) {
      sx = (Math.random() - 0.5) * this.shakeIntensity;
      sy = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeDuration -= delta;
    }

    ctx.save();
    ctx.translate(sx, sy);
    this.draw(ctx);
    ctx.restore();
  },

  processUpperBody() {
    const landmarks = window.currentPoseLandmarks || window.poseLandmarks;
    if (!landmarks) {
      this.systemStatus = "SIGNAL LOST: NO BODY";
      this.bodyCenterX = null;
      return;
    }

    // Use Nose (0) and Shoulders (11, 12) for reliable laptop tracking
    const indices = [0, 11, 12]; 
    let sumX = 0;
    let count = 0;
    this.bodyPoints = [];

    const cssW = canvasElement.width / (window.devicePixelRatio || 1);
    const cssH = canvasElement.height / (window.devicePixelRatio || 1);

    indices.forEach(idx => {
      const lm = landmarks[idx];
      if (lm && lm.visibility > 0.5) {
        const mirroredX = 1 - lm.x;
        this.bodyPoints.push({ x: mirroredX * cssW, y: lm.y * cssH });
        sumX += mirroredX;
        count++;
      }
    });

    if (count > 0) {
      this.systemStatus = "UPPER BODY ACTIVE";
      const avgX = sumX / count;
      this.bodyCenterX = avgX * cssW;
      this.playerColumn = Math.floor(avgX * this.COLUMN_COUNT);
      this.playerColumn = Math.max(0, Math.min(4, this.playerColumn));
    }
  },

  updateLogic(delta) {
    if (this.feedbackTimer > 0) this.feedbackTimer -= delta;

    switch (this.gameState) {
      case "MOVING":
        this.timer -= delta;
        if (this.playerColumn === this.targetColumn) {
          this.triggerFeedback(true);
        } else if (this.timer <= 0) {
          this.triggerFeedback(false);
        }
        break;
      case "RETURN":
        if (this.playerColumn === 2) this.startNewRound();
        break;
    }
  },

  updateEffects(delta) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= delta;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
  },

  triggerFeedback(isCorrect) {
    if (isCorrect) {
      this.score += 10;
      this.feedbackText = "CORRECT!";
      this.feedbackColor = "#00FF88";
      // Spawn Energy Sparks
      for (let i = 0; i < 20; i++) {
        this.sparks.push({
          x: this.bodyCenterX,
          y: canvasElement.height / (2 * (window.devicePixelRatio || 1)),
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          life: 800,
          color: "#00FFFF"
        });
      }
    } else {
      this.score -= 5;
      this.feedbackText = "MISS!";
      this.feedbackColor = "#FF4444";
      this.shakeDuration = 300;
      this.shakeIntensity = 15;
    }
    this.feedbackTimer = 1000;
    this.gameState = "RETURN";
  },

  draw(ctx) {
    const w = canvasElement.width / (window.devicePixelRatio || 1);
    const h = canvasElement.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const colWidth = w / this.COLUMN_COUNT;

    // 1. Columns
    for (let i = 0; i < this.COLUMN_COUNT; i++) {
      if (i === this.playerColumn) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(i * colWidth, 0, colWidth, h);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.strokeRect(i * colWidth, 0, colWidth, h);
      const labels = ["ST", "ND", "PRIME", "RD", "TH"];
      ctx.fillStyle = (i === this.targetColumn && this.gameState === "MOVING") ? "yellow" : "white";
      ctx.font = `bold ${24 * this.scale}px Arial`;
      ctx.fillText(labels[i], i * colWidth + colWidth/2, h - 30);
    }

    // 2. Tracking Markers
    this.bodyPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#00FFFF";
      ctx.fill();
    });

    if (this.bodyCenterX) {
      ctx.beginPath();
      ctx.moveTo(this.bodyCenterX, 0);
      ctx.lineTo(this.bodyCenterX, h);
      ctx.strokeStyle = "yellow";
      ctx.stroke();
    }

    // 3. Sparks Effect
    this.sparks.forEach(s => {
      ctx.globalAlpha = s.life / 800;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, 4, 4);
    });
    ctx.globalAlpha = 1;

    // 4. UI
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = `bold ${110 * this.scale}px Arial`;
    ctx.fillText(this.currentNumber, w / 2, h / 2);

    ctx.font = `italic ${30 * this.scale}px Arial`;
    if (this.gameState === "MOVING") {
      ctx.fillText(`Lean to the ${this.correctSuffix.toUpperCase()} zone`, w / 2, h / 2 + 70);
      ctx.fillStyle = "orange";
      ctx.fillRect(0, 0, w * (this.timer / this.TIME_LIMIT), 10);
    } else {
      ctx.fillStyle = "#00FFFF";
      ctx.fillText("Back to center (PRIME)", w / 2, h / 2 + 70);
    }

    if (this.feedbackTimer > 0) {
      ctx.fillStyle = this.feedbackColor;
      ctx.font = `bold ${90 * this.scale}px Arial`;
      ctx.fillText(this.feedbackText, w/2, h/2 - 140);
    }

    // HUD
    ctx.textAlign = "left";
    ctx.font = "14px monospace";
    ctx.fillStyle = "#00FF88";
    ctx.fillText(`STATUS: ${this.systemStatus}`, 20, 30);
    ctx.fillStyle = "white";
    ctx.fillText(`SCORE: ${this.score}`, 20, 55);
  }
};