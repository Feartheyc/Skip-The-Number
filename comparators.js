const Game3 = {

  centerX: null,
  centerY: null,

  leftNumber: 0,
  rightNumber: 0,
  currentRelation: "", // ">", "<"

  score: 0,
  gameState: "PLAYING", // "PLAYING", "SUCCESS", "GAME_OVER"
  
  // Progress Logic
  winHoldTime: 0, 
  winHoldThreshold: 30, // Hold correct pose for ~0.5s to WIN
  
  failHoldTime: 0,
  failHoldThreshold: 30, // Hold WRONG pose for ~0.5s to LOSE

  // Controls
  margin: 50, 
  detectedSymbol: "None", 

  /* ============================== */
  init() {
    const canvas = document.getElementById('game_canvas');
    canvas.width = 640;
    canvas.height = 480;

    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;
    this.score = 0;
    
    this.spawnNumbers();
    console.log("Game3 Initialized (Score Penalty Mode)");
  },

  /* ============================== */
  spawnNumbers() {
    this.leftNumber = Math.floor(Math.random() * 20) + 1;
    this.rightNumber = Math.floor(Math.random() * 20) + 1;

    // Prevent equal numbers
    while (this.leftNumber === this.rightNumber) {
      this.rightNumber = Math.floor(Math.random() * 20) + 1;
    }

    this.currentRelation = this.leftNumber > this.rightNumber ? ">" : "<";
    
    this.gameState = "PLAYING";
    this.winHoldTime = 0;
    this.failHoldTime = 0; // Reset fail timer
    this.detectedSymbol = "None"; 
  },

  /* ============================== */
  update(ctx, fingers) {
    this.drawUI(ctx);

    // If Round Ended (Success or Fail), stop processing
    if (this.gameState === "GAME_OVER" || this.gameState === "SUCCESS") return;

    if (fingers.length < 2) {
      this.drawFeedback(ctx, "Need 2 Hands!", "orange");
      return;
    }

    fingers.sort((a, b) => a.y - b.y);
    const hand1 = fingers[0];
    const hand2 = fingers[1];

    this.checkPose(ctx, hand1, hand2);
    this.drawArmSymbol(ctx, hand1, hand2);
  },

  /* ============================== */
  checkPose(ctx, h1, h2) {
    if (this.gameState !== "PLAYING") return;

    // 1. Detect Symbol
    if (h1.x < this.centerX - this.margin && h2.x < this.centerX - this.margin) {
      this.detectedSymbol = ">";
    } 
    else if (h1.x > this.centerX + this.margin && h2.x > this.centerX + this.margin) {
      this.detectedSymbol = "<";
    } 
    else {
      this.detectedSymbol = "Center";
    }

    // 2. Identify the WRONG answer
    const wrongRelation = this.currentRelation === ">" ? "<" : ">";

    // 3. Compare
    if (this.detectedSymbol === this.currentRelation) {
      // --- CORRECT PATH ---
      this.winHoldTime++;
      this.failHoldTime = 0; 
      
      const progress = this.winHoldTime / this.winHoldThreshold;
      this.drawProgressBar(ctx, progress, "#00FFCC"); // Green/Cyan Bar

      if (this.winHoldTime >= this.winHoldThreshold) {
        this.handleSuccess();
      }

    } else if (this.detectedSymbol === wrongRelation) {
      // --- FAILURE PATH ---
      this.failHoldTime++;
      this.winHoldTime = 0; 

      // Show DANGER Bar (Red)
      const failProgress = this.failHoldTime / this.failHoldThreshold;
      this.drawProgressBar(ctx, failProgress, "#FF0000");

      if (this.failHoldTime >= this.failHoldThreshold) {
        this.handleFail();
      }

    } else {
      // --- NEUTRAL PATH ---
      this.winHoldTime = Math.max(0, this.winHoldTime - 2);
      this.failHoldTime = Math.max(0, this.failHoldTime - 2);
    }
  },

  /* ============================== */
  drawArmSymbol(ctx, h1, h2) {
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 15;

    // Colors
    if (this.detectedSymbol === ">") {
      ctx.strokeStyle = "#FFFF00"; // Yellow
      ctx.shadowColor = "#FFFF00";
    } else if (this.detectedSymbol === "<") {
      ctx.strokeStyle = "#00AAFF"; // Blue
      ctx.shadowColor = "#00AAFF";
    } else {
      ctx.strokeStyle = "#00FFCC"; // Cyan
      ctx.shadowColor = "#00FFCC";
    }

    // Override color if failing
    if (this.failHoldTime > 10) {
        ctx.strokeStyle = "red";
        ctx.shadowColor = "red";
    }

    if (this.gameState === "SUCCESS") {
      ctx.strokeStyle = "#00FF00";
      ctx.shadowColor = "#00FF00";
    }

    ctx.beginPath();
    ctx.moveTo(h1.x, h1.y);
    ctx.lineTo(this.centerX, this.centerY);
    ctx.lineTo(h2.x, h2.y);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = "white";
    [h1, h2].forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  /* ============================== */
  handleSuccess() {
    this.gameState = "SUCCESS";
    this.score += 10;
    
    setTimeout(() => {
      this.spawnNumbers();
    }, 1200);
  },

  /* ============================== */
  handleFail() {
    this.gameState = "GAME_OVER";
    
    // --- UPDATED LOGIC HERE ---
    this.score = this.score - 5;
    
    // Optional: Prevent negative score? 
    // If you want negative scores, remove the line below.
    if (this.score < 0) this.score = 0; 
    
    // Restart round after 2 seconds
    setTimeout(() => {
      this.spawnNumbers();
    }, 2000);
  },

  /* ============================== */
  drawUI(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // -- NUMBERS --
    ctx.font = "bold 120px Arial";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";

    ctx.strokeStyle = "black";
    ctx.strokeText(this.leftNumber, this.centerX - 200, this.centerY);
    ctx.fillStyle = "white";
    ctx.fillText(this.leftNumber, this.centerX - 200, this.centerY);

    ctx.strokeStyle = "black";
    ctx.strokeText(this.rightNumber, this.centerX + 200, this.centerY);
    ctx.fillStyle = "white";
    ctx.fillText(this.rightNumber, this.centerX + 200, this.centerY);

    // -- SCORE --
    ctx.font = "bold 40px Arial";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "black";
    ctx.strokeText("Score: " + this.score, this.centerX, 60);
    ctx.fillStyle = "white";
    ctx.fillText("Score: " + this.score, this.centerX, 60);

    // -- SUCCESS MESSAGE --
    if (this.gameState === "SUCCESS") {
      ctx.fillStyle = "#00FF66";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 6;
      ctx.font = "bold 60px Arial";
      ctx.strokeText("CORRECT!", this.centerX, this.centerY + 120);
      ctx.fillText("CORRECT!", this.centerX, this.centerY + 120);
      
      ctx.font = "bold 40px Arial";
      ctx.fillStyle = "white";
      ctx.fillText("+10 Points", this.centerX, this.centerY + 170);
    }

    // -- FAIL MESSAGE --
    if (this.gameState === "GAME_OVER") {
      ctx.fillStyle = "#FF0000"; // RED
      ctx.strokeStyle = "white";
      ctx.lineWidth = 6;
      ctx.font = "bold 80px Arial";
      
      ctx.strokeText("WRONG!", this.centerX, this.centerY);
      ctx.fillText("WRONG!", this.centerX, this.centerY);

      ctx.font = "bold 40px Arial";
      ctx.fillStyle = "white";
      // UPDATED TEXT
      ctx.fillText("-5 Points", this.centerX, this.centerY + 80);
    }
  },

  drawFeedback(ctx, text, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.strokeText(text, this.centerX, this.centerY + 150);
    ctx.fillText(text, this.centerX, this.centerY + 150);
  },

  drawProgressBar(ctx, percentage, color) {
    if (percentage <= 0) return;
    
    // Background bar
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(this.centerX - 100, this.centerY + 70, 200, 20);

    // Fill bar
    ctx.fillStyle = color;
    ctx.fillRect(this.centerX - 100, this.centerY + 70, 200 * percentage, 20);
  }
};