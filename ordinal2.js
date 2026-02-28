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

  // Tracking State
  bodyPoints: [], // For the pink dots
  bodyCenterX: null,
  systemStatus: "SCANNING...",
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
    const num = Math.floor(Math.random() * 50) + 1;
    this.currentNumber = num;
    this.correctSuffix = this.getSuffix(num);
    
    // Column Map: 0:ST, 1:ND, 3:RD, 4:TH (Center 2 is PRIME)
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
    const delta = (now - this.lastTime);
    this.lastTime = now;

    this.processFullBody();
    this.updateLogic(delta);
    this.draw(ctx);
  },

  processFullBody() {
    // Check all possible MediaPipe sources
    const landmarks = window.currentPoseLandmarks || window.poseLandmarks;

    if (!landmarks) {
      this.systemStatus = "SIGNAL LOST: NO BODY DETECTED";
      this.bodyCenterX = null;
      this.bodyPoints = [];
      return;
    }

    const indices = [11, 12, 25, 26]; // Shoulders and Knees
    let sumX = 0;
    let count = 0;
    this.bodyPoints = [];

    const cssW = canvasElement.width / (window.devicePixelRatio || 1);
    const cssH = canvasElement.height / (window.devicePixelRatio || 1);

    indices.forEach(idx => {
      const lm = landmarks[idx];
      // Laptop visibility can be low; threshold at 0.4
      if (lm && lm.visibility > 0.4) {
        // Mirror the X so stepping left moves left on screen
        const mirroredX = 1 - lm.x;
        this.bodyPoints.push({ x: mirroredX * cssW, y: lm.y * cssH });
        sumX += mirroredX;
        count++;
      }
    });

    if (count > 0) {
      this.systemStatus = count === 4 ? "FULL BODY TRACKING" : "PARTIAL TRACKING";
      const avgX = sumX / count;
      this.bodyCenterX = avgX * cssW;

      // Update the active column based on body center
      this.playerColumn = Math.floor(avgX * this.COLUMN_COUNT);
      this.playerColumn = Math.max(0, Math.min(4, this.playerColumn));
    } else {
      this.systemStatus = "STAND BACK: NEED SHOULDERS & KNEES";
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
        // Player must go back to PRIME center to start next round
        if (this.playerColumn === 2) {
          this.startNewRound();
        }
        break;
    }
  },

  triggerFeedback(isCorrect) {
    if (isCorrect) {
      this.score += 10;
      this.feedbackText = "PERFECT!";
      this.feedbackColor = "#00FF88";
    } else {
      this.score -= 5;
      this.feedbackText = "OUT OF TIME!";
      this.feedbackColor = "#FF4444";
    }
    this.feedbackTimer = 1200;
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
        ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
        ctx.fillRect(i * colWidth, 0, colWidth, h);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.strokeRect(i * colWidth, 0, colWidth, h);
      
      const labels = ["ST", "ND", "PRIME", "RD", "TH"];
      ctx.fillStyle = (i === this.targetColumn && this.gameState === "MOVING") ? "yellow" : "white";
      ctx.font = `bold ${24 * this.scale}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(labels[i], i * colWidth + colWidth/2, h - 30);
    }

    // 2. Full Body Visualization (Shoulders and Knees)
    
    this.bodyPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#FF00FF";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.stroke();
    });

    if (this.bodyCenterX !== null) {
      ctx.beginPath();
      ctx.moveTo(this.bodyCenterX, 0);
      ctx.lineTo(this.bodyCenterX, h);
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Game HUD
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = `bold ${110 * this.scale}px Arial`;
    ctx.fillText(this.currentNumber, w/2, h/2);

    ctx.font = `italic ${30 * this.scale}px Arial`;
    if (this.gameState === "MOVING") {
      ctx.fillText(`Jump to the ${this.correctSuffix.toUpperCase()} zone!`, w/2, h/2 + 75);
      ctx.fillStyle = "orange";
      ctx.fillRect(0, 0, w * (this.timer / this.TIME_LIMIT), 12);
    } else {
      ctx.fillStyle = "#00FFFF";
      ctx.fillText("Return to PRIME center", w/2, h/2 + 75);
    }

    if (this.feedbackTimer > 0) {
      ctx.fillStyle = this.feedbackColor;
      ctx.font = `bold ${85 * this.scale}px Arial`;
      ctx.fillText(this.feedbackText, w/2, h/2 - 130);
    }

    // 4. Status Bar
    ctx.textAlign = "left";
    ctx.font = "14px monospace";
    ctx.fillStyle = this.systemStatus.includes("LOST") ? "red" : "#00FF88";
    ctx.fillText(this.systemStatus, 20, 35);
    ctx.fillStyle = "white";
    ctx.fillText(`SCORE: ${this.score}`, 20, 60);
  }
};