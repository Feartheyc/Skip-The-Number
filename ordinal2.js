const Game10 = {
  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  // Game Settings
  COLUMN_COUNT: 5,
  TIME_LIMIT: 5000,
  RESET_REQUIRED: true,
  MIRROR_VIDEO: true, // Set to false if your movements are inverted

  // State
  currentNumber: 0,
  correctSuffix: "",
  playerColumn: 2,
  targetColumn: -1,
  
  timer: 0,
  score: 0,
  gameState: "WAITING", // WAITING, MOVING, RETURN
  
  feedbackText: "",
  feedbackColor: "white",
  feedbackTimer: 0,

  // Tracking & Debug
  debugPoints: [],
  bodyCenterX: 0,
  systemStatus: "INITIALIZING",
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
    
    // Ensure canvas matches screen
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
    
    // 0:ST, 1:ND, 3:RD, 4:TH (Skipping 2 which is PRIME)
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
    // 1. Check if the landmarks exist
    if (!window.currentPoseLandmarks) {
      this.systemStatus = "ERROR: NO POSE DATA";
      return;
    }

    const indices = [11, 12, 25, 26]; // L/R Shoulder, L/R Knee
    let avgX = 0;
    let count = 0;
    this.debugPoints = [];

    const cssW = canvasElement.width / (window.devicePixelRatio || 1);
    const cssH = canvasElement.height / (window.devicePixelRatio || 1);

    indices.forEach(idx => {
      const landmark = window.currentPoseLandmarks[idx];
      
      // Laptop cams can be grainy; lower visibility threshold to 0.4
      if (landmark && landmark.visibility > 0.4) {
        let finalX = landmark.x;
        
        // Mirror logic: MediaPipe is usually mirrored by default
        if (this.MIRROR_VIDEO) finalX = 1 - finalX;

        const x = finalX * cssW;
        const y = landmark.y * cssH;
        
        this.debugPoints.push({ x, y });
        avgX += finalX;
        count++;
      }
    });

    if (count > 0) {
      this.systemStatus = "TRACKING ACTIVE";
      const finalAvgX = avgX / count;
      this.bodyCenterX = finalAvgX * cssW;
      
      // Determine Column
      this.playerColumn = Math.floor(finalAvgX * this.COLUMN_COUNT);
      this.playerColumn = Math.max(0, Math.min(4, this.playerColumn));
    } else {
      this.systemStatus = "ERROR: BODY NOT IN FRAME";
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
        // Wait for player to go back to center column (2)
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
      this.feedbackText = "WRONG ZONE!";
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

    // 1. Draw Column Backgrounds & Labels
    for (let i = 0; i < this.COLUMN_COUNT; i++) {
      // Highlight column if player is in it
      if (i === this.playerColumn) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
        ctx.fillRect(i * colWidth, 0, colWidth, h);
      }
      
      // Draw Divider
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.strokeRect(i * colWidth, 0, colWidth, h);

      // Draw Column Suffix Text
      const labels = ["ST", "ND", "PRIME", "RD", "TH"];
      ctx.fillStyle = (i === this.targetColumn && this.gameState === "MOVING") ? "#FFFF00" : "white";
      ctx.font = `bold ${28 * this.scale}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(labels[i], i * colWidth + colWidth/2, h - 40 * this.scale);
    }

    // 2. Draw Diagnostic Dots (The "Skeleton" look)
    this.debugPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#FF00FF"; // Bright Pink
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.stroke();
    });

    // Draw Body Center Line
    if (this.debugPoints.length > 0) {
      ctx.beginPath();
      ctx.setLineDash([10, 5]);
      ctx.moveTo(this.bodyCenterX, 0);
      ctx.lineTo(this.bodyCenterX, h);
      ctx.strokeStyle = "yellow";
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Draw Game Content
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // The Number
    ctx.fillStyle = "white";
    ctx.font = `bold ${110 * this.scale}px Arial`;
    ctx.fillText(this.currentNumber, w / 2, h / 2 - 40 * this.scale);

    // Prompt Text
    ctx.font = `italic ${35 * this.scale}px Arial`;
    if (this.gameState === "MOVING") {
      ctx.fillText(`Run to the ${this.correctSuffix.toUpperCase()} zone!`, w / 2, h / 2 + 60 * this.scale);
      // Timer Bar
      ctx.fillStyle = "orange";
      ctx.fillRect(0, 0, w * (this.timer / this.TIME_LIMIT), 10 * this.scale);
    } else if (this.gameState === "RETURN") {
      ctx.fillStyle = "#00FFFF";
      ctx.fillText("Step back to PRIME center", w / 2, h / 2 + 60 * this.scale);
    }

    // Feedback message
    if (this.feedbackTimer > 0) {
      ctx.fillStyle = this.feedbackColor;
      ctx.font = `bold ${90 * this.scale}px Arial`;
      ctx.fillText(this.feedbackText, w / 2, h / 2 - 140 * this.scale);
    }

    // 4. Draw HUD (Score and Status)
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.font = `bold ${24 * this.scale}px Arial`;
    ctx.fillText(`Score: ${this.score}`, 30, 40);
    
    // Status text (The most important part for your laptop test)
    ctx.fillStyle = this.systemStatus.includes("ERROR") ? "#FF4444" : "#00FF88";
    ctx.font = `18px monospace`;
    ctx.fillText(`STATUS: ${this.systemStatus}`, 30, 75);
  }
};  