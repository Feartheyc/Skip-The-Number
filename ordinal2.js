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

  debugPoints: [],
  bodyCenterX: 0,
  systemStatus: "SCANNING FOR FULL BODY...",
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
    const num = Math.floor(Math.random() * 90) + 1;
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

    this.processPose();
    this.updateLogic(delta);
    this.draw(ctx);
  },

  processPose() {
    const landmarks = window.currentPoseLandmarks || window.poseLandmarks;
    
    if (!landmarks) {
      this.systemStatus = "WAITING FOR DATA (window.currentPoseLandmarks)";
      return;
    }

    // WE ARE LOOKING FOR: Shoulders (11, 12) and Knees (25, 26)
    const indices = [11, 12, 25, 26]; 
    let sumX = 0;
    let count = 0;
    this.debugPoints = [];

    const cssW = canvasElement.width / (window.devicePixelRatio || 1);
    const cssH = canvasElement.height / (window.devicePixelRatio || 1);

    indices.forEach(idx => {
      const lm = landmarks[idx];
      // LOW THRESHOLD: 0.25 visibility to keep tracking even in bad light
      if (lm && lm.visibility > 0.25) {
        // Mirror the X because webcams are inverted
        let mirroredX = 1 - lm.x;
        
        this.debugPoints.push({ x: mirroredX * cssW, y: lm.y * cssH, id: idx });
        sumX += mirroredX;
        count++;
      }
    });

    if (count > 0) {
      const finalAvgX = sumX / count;
      this.bodyCenterX = finalAvgX * cssW;
      
      // Map body center to one of the 5 columns
      this.playerColumn = Math.floor(finalAvgX * this.COLUMN_COUNT);
      this.playerColumn = Math.max(0, Math.min(4, this.playerColumn));
      
      // Update status based on how many points we see
      this.systemStatus = count === 4 ? "FULL BODY DETECTED" : `PARTIAL: ${count}/4 POINTS`;
    } else {
      this.systemStatus = "OUT OF FRAME - STAND BACK!";
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

  triggerFeedback(isCorrect) {
    if (isCorrect) {
      this.score += 10;
      this.feedbackText = "CORRECT!";
      this.feedbackColor = "#00FF88";
    } else {
      this.score -= 5;
      this.feedbackText = "TIME'S UP!";
      this.feedbackColor = "#FF4444";
    }
    this.feedbackTimer = 1500;
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
        ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
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

    // 2. Full Body Skeleton Visualization
    // Draw dots for shoulders and knees
    this.debugPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = p.id >= 25 ? "#FF00FF" : "#00FFFF"; // Knees Magenta, Shoulders Cyan
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.stroke();
    });

    // Body Center Line
    if (this.bodyCenterX) {
      ctx.beginPath();
      ctx.moveTo(this.bodyCenterX, 0);
      ctx.lineTo(this.bodyCenterX, h);
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 3. Gameplay UI
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = `bold ${120 * this.scale}px Arial`;
    ctx.fillText(this.currentNumber, w/2, h/2 - 20);

    ctx.font = `italic ${35 * this.scale}px Arial`;
    if (this.gameState === "MOVING") {
      ctx.fillText(`ZONE: ${this.correctSuffix.toUpperCase()}`, w/2, h/2 + 80);
      ctx.fillStyle = "orange";
      ctx.fillRect(0, 0, w * (this.timer / this.TIME_LIMIT), 12);
    } else {
      ctx.fillStyle = "#00FFFF";
      ctx.fillText("STEP BACK TO CENTER", w/2, h/2 + 80);
    }

    if (this.feedbackTimer > 0) {
      ctx.fillStyle = this.feedbackColor;
      ctx.font = `bold ${90 * this.scale}px Arial`;
      ctx.fillText(this.feedbackText, w/2, h/2 - 150);
    }

    // 4. Status Bar
    ctx.textAlign = "left";
    ctx.fillStyle = this.systemStatus.includes("FULL") ? "#00FF00" : "yellow";
    ctx.font = "16px monospace";
    ctx.fillText(`STATUS: ${this.systemStatus}`, 20, 40);
    ctx.fillStyle = "white";
    ctx.fillText(`SCORE: ${this.score}`, 20, 65);
  }
};