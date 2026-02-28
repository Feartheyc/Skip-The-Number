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

  // NEW: Debugging and Tracking state
  debugPoints: [],
  bodyCenterX: 0,

  lastTime: performance.now(),
  running: false,

  init() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.score = 0;
    this.running = true;
    this.lastTime = performance.now();
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
    const num = Math.floor(Math.random() * 30) + 1;
    this.currentNumber = num;
    this.correctSuffix = this.getSuffix(num);
    
    const suffixIndices = { "st": 0, "nd": 1, "rd": 3, "th": 4 };
    this.targetColumn = suffixIndices[this.correctSuffix];
    
    this.timer = this.TIME_LIMIT;
    this.gameState = "MOVING";
  },

  getSuffix(num) {
    if (num >= 11 && num <= 13) return "th";
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

    this.processPose();
    this.updateLogic(delta);
    this.draw(ctx);
  },

  processPose() {
    if (!window.currentPoseLandmarks) return;

    const indices = [11, 12, 25, 26]; // Shoulder L/R, Knee L/R
    let avgX = 0;
    let count = 0;
    this.debugPoints = [];

    const cssW = canvasElement.width / (window.devicePixelRatio || 1);
    const cssH = canvasElement.height / (window.devicePixelRatio || 1);

    indices.forEach(idx => {
      const landmark = window.currentPoseLandmarks[idx];
      // Check visibility/confidence score
      if (landmark && landmark.visibility > 0.5) {
        // Map normalized 0-1 to actual CSS pixels for drawing
        const x = landmark.x * cssW;
        const y = landmark.y * cssH;
        
        this.debugPoints.push({ x, y });
        avgX += landmark.x;
        count++;
      }
    });

    if (count > 0) {
      const finalX = avgX / count;
      this.bodyCenterX = finalX * cssW; // Real-time center line position
      
      this.playerColumn = Math.floor(finalX * this.COLUMN_COUNT);
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
        if (this.playerColumn === 2) {
          this.startNewRound();
        }
        break;
    }
  },

  triggerFeedback(isCorrect) {
    if (isCorrect) {
      this.score += 10;
      this.feedbackText = "CORRECT!";
      this.feedbackColor = "#00FF88";
    } else {
      this.score -= 5;
      this.feedbackText = "MISS!";
      this.feedbackColor = "#FF4444";
    }
    this.feedbackTimer = 1000;
    this.gameState = "RETURN";
  },

  draw(ctx) {
    const w = canvasElement.width / (window.devicePixelRatio || 1);
    const h = canvasElement.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const colWidth = w / this.COLUMN_COUNT;

    // 1. Draw Columns
    for (let i = 0; i < this.COLUMN_COUNT; i++) {
      if (i === this.playerColumn) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
        ctx.fillRect(i * colWidth, 0, colWidth, h);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.strokeRect(i * colWidth, 0, colWidth, h);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = `bold ${24 * this.scale}px Arial`;
      ctx.textAlign = "center";
      const labels = ["ST", "ND", "PRIME", "RD", "TH"];
      ctx.fillText(labels[i], i * colWidth + colWidth/2, h - 30 * this.scale);
    }

    // 2. Draw Body Tracking Markers
    this.debugPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#FF00FF"; // Bright magenta dots
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Vertical indicator for the average center
    if (this.debugPoints.length > 0) {
      ctx.beginPath();
      ctx.setLineDash([10, 5]);
      ctx.moveTo(this.bodyCenterX, 0);
      ctx.lineTo(this.bodyCenterX, h);
      ctx.strokeStyle = "yellow";
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Draw Game UI
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = `bold ${100 * this.scale}px Arial`;
    ctx.fillText(this.currentNumber, w / 2, h / 2);

    ctx.font = `italic ${30 * this.scale}px Arial`;
    if (this.gameState === "MOVING") {
      ctx.fillText(`Move to ${this.correctSuffix.toUpperCase()}`, w / 2, h / 2 + 60 * this.scale);
      // Timer Bar
      ctx.fillStyle = "orange";
      ctx.fillRect(0, 0, w * (this.timer / this.TIME_LIMIT), 8 * this.scale);
    } else if (this.gameState === "RETURN") {
      ctx.fillStyle = "#FFDD00";
      ctx.fillText("Go back to center!", w / 2, h / 2 + 60 * this.scale);
    }

    // Feedback Text
    if (this.feedbackTimer > 0) {
      ctx.globalAlpha = this.feedbackTimer / 1000;
      ctx.fillStyle = this.feedbackColor;
      ctx.font = `bold ${80 * this.scale}px Arial`;
      ctx.fillText(this.feedbackText, w / 2, h / 2 - 120 * this.scale);
      ctx.globalAlpha = 1.0;
    }

    // Score
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.font = `bold ${24 * this.scale}px Arial`;
    ctx.fillText("Score: " + this.score, 20, 40);
  }
};