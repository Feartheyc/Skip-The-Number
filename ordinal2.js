const Game10 = {
  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  // Game Constants
  COLUMN_COUNT: 5,
  TIME_LIMIT: 5000, // 5 seconds to move
  RESET_REQUIRED: true, // Must return to center between rounds

  // State
  currentNumber: 0,
  correctSuffix: "",
  suffixMap: ["st", "nd", "rd", "th"],
  
  playerColumn: 2, // Start in center
  targetColumn: -1,
  
  timer: 0,
  score: 0,
  gameState: "WAITING", // WAITING, MOVING, FEEDBACK, RETURN
  
  feedbackText: "",
  feedbackColor: "white",
  feedbackTimer: 0,

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
    const num = Math.floor(Math.random() * 20) + 1;
    this.currentNumber = num;
    this.correctSuffix = this.getSuffix(num);
    
    // Map suffix to a specific column (0:ST, 1:ND, 3:RD, 4:TH) - skip 2 (center)
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
    // MediaPipe landmarks: 11(L shoulder), 12(R shoulder), 25(L knee), 26(R knee)
    if (!window.currentPoseLandmarks) return;

    const indices = [11, 12, 25, 26];
    let avgX = 0;
    let count = 0;

    indices.forEach(idx => {
      const landmark = window.currentPoseLandmarks[idx];
      if (landmark && landmark.visibility > 0.5) {
        avgX += landmark.x; // Normalized 0 to 1
        count++;
      }
    });

    if (count > 0) {
      const finalX = avgX / count;
      // Determine column (0 to 4)
      this.playerColumn = Math.floor(finalX * this.COLUMN_COUNT);
      // Clamp values
      this.playerColumn = Math.max(0, Math.min(4, this.playerColumn));
    }
  },

  updateLogic(delta) {
    if (this.feedbackTimer > 0) this.feedbackTimer -= delta;

    switch (this.gameState) {
      case "MOVING":
        this.timer -= delta;
        
        // Success check: If they are in the right column
        if (this.playerColumn === this.targetColumn) {
          this.triggerFeedback(true);
        } else if (this.timer <= 0) {
          this.triggerFeedback(false);
        }
        break;

      case "RETURN":
        // Wait for player to go back to column 2 (center)
        if (this.playerColumn === 2) {
          this.startNewRound();
        }
        break;
    }
  },

  triggerFeedback(isCorrect) {
    if (isCorrect) {
      this.score += 10;
      this.feedbackText = "EXCELLENT!";
      this.feedbackColor = "#00FF88";
    } else {
      this.score -= 5;
      this.feedbackText = "TOO SLOW!";
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

    // Draw Columns
    for (let i = 0; i < this.COLUMN_COUNT; i++) {
      // Highlight current player position
      if (i === this.playerColumn) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(i * colWidth, 0, colWidth, h);
      }

      // Draw Column Borders
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.strokeRect(i * colWidth, 0, colWidth, h);

      // Draw Suffix labels for columns
      ctx.fillStyle = "white";
      ctx.font = `bold ${30 * this.scale}px Arial`;
      ctx.textAlign = "center";
      let label = "";
      if (i === 0) label = "ST";
      if (i === 1) label = "ND";
      if (i === 2) label = "PRIME";
      if (i === 3) label = "RD";
      if (i === 4) label = "TH";
      ctx.fillText(label, i * colWidth + colWidth/2, h - 50 * this.scale);
    }

    // Draw Main Number
    ctx.fillStyle = "#00FFFF";
    ctx.font = `bold ${120 * this.scale}px Arial`;
    ctx.fillText(this.currentNumber, w / 2, h / 2 - 50 * this.scale);

    // Draw Instruction / State
    ctx.font = `italic ${40 * this.scale}px Arial`;
    ctx.fillStyle = "white";
    if (this.gameState === "MOVING") {
      ctx.fillText(`Move to the ${this.correctSuffix} zone!`, w / 2, h / 2 + 50 * this.scale);
      // Progress bar for timer
      ctx.fillStyle = "orange";
      ctx.fillRect(0, 0, w * (this.timer / this.TIME_LIMIT), 10 * this.scale);
    } else if (this.gameState === "RETURN") {
      ctx.fillText("Return to center (PRIME)", w / 2, h / 2 + 50 * this.scale);
    }

    // Draw Feedback
    if (this.feedbackTimer > 0) {
      ctx.fillStyle = this.feedbackColor;
      ctx.font = `bold ${80 * this.scale}px Arial`;
      ctx.fillText(this.feedbackText, w/2, h/2 - 150 * this.scale);
    }

    // Draw Score
    ctx.fillStyle = "white";
    ctx.font = `bold ${30 * this.scale}px Arial`;
    ctx.fillText("SCORE: " + this.score, 100 * this.scale, 50 * this.scale);
  }
};