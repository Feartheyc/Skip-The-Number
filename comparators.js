const Game3 = {

  centerX: null,
  centerY: null,

  leftNumber: 0,
  rightNumber: 0,
  currentRelation: "", // ">", "<", or "="

  score: 0,
  timer: 0,
  gameState: "PLAYING", // "PLAYING", "SUCCESS", "FAIL"
  feedbackText: "",

  // Configuration
  margin: 80, // How far from center hands must be to register
  winHoldTime: 0, // Frames the player holds the correct pose
  winHoldThreshold: 40, // Need to hold pose for ~0.7 seconds

  /* ============================== */
  init() {
    const canvas = document.getElementById('game_canvas');
    
    // 1. FORCE the resolution to match the camera
    canvas.width = 640;
    canvas.height = 480;

    // 2. Now calculate center
    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;
    
    this.score = 0;
    
    // 3. Spawn the first set of numbers
    this.spawnNumbers(); 
    
    console.log("Comparator Initialized!", this.leftNumber, this.rightNumber);
  },

  /* ============================== */
  spawnNumbers() {
    // Generate numbers between 1 and 20
    this.leftNumber = Math.floor(Math.random() * 20) + 1;
    this.rightNumber = Math.floor(Math.random() * 20) + 1;

    // Prevent equality for now (to keep gestures simple)
    while (this.leftNumber === this.rightNumber) {
      this.rightNumber = Math.floor(Math.random() * 20) + 1;
    }

    // Determine correct answer
    this.currentRelation = this.leftNumber > this.rightNumber ? ">" : "<";
    
    this.gameState = "PLAYING";
    this.winHoldTime = 0;
    this.feedbackText = "Make the mouth!";
  },

  /* ============================== */
  update(ctx, fingers) {
    
    // 1. Draw UI (Score & Numbers)
    this.drawUI(ctx);

    // 2. Logic & Detection
    if (fingers.length < 2) {
      this.drawFeedback(ctx, "Show both hands!", "#FFCC00");
      return;
    }

    // Sort fingers by Y to distinguish top/bottom hand visually
    fingers.sort((a, b) => a.y - b.y);
    const hand1 = fingers[0];
    const hand2 = fingers[1];

    // Visualize the "Arm Symbol"
    this.drawArmSymbol(ctx, hand1, hand2);

    // Check Pose
    this.checkPose(ctx, hand1, hand2);
  },

  /* ============================== */
  drawArmSymbol(ctx, h1, h2) {
    // Draw lines from hands to center to form the < or >
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#00FFCC";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00FFCC";

    ctx.beginPath();
    ctx.moveTo(h1.x, h1.y);       // Top Hand
    ctx.lineTo(this.centerX, this.centerY); // Center (Body)
    ctx.lineTo(h2.x, h2.y);       // Bottom Hand
    ctx.stroke();

    ctx.shadowBlur = 0;
    
    // Draw "Hands"
    ctx.fillStyle = "white";
    [h1, h2].forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  /* ============================== */
  checkPose(ctx, h1, h2) {
    if (this.gameState !== "PLAYING") return;

    const avgX = (h1.x + h2.x) / 2;
    let detectedSymbol = "";

    // If both hands are on the LEFT side of the center margin
    if (h1.x < this.centerX - this.margin && h2.x < this.centerX - this.margin) {
      detectedSymbol = ">";
    }
    // If both hands are on the RIGHT side of the center margin
    else if (h1.x > this.centerX + this.margin && h2.x > this.centerX + this.margin) {
      detectedSymbol = "<";
    }

    // Validate
    if (detectedSymbol === this.currentRelation) {
      this.winHoldTime++;
      
      // Visual Progress Bar
      const progress = this.winHoldTime / this.winHoldThreshold;
      this.drawProgressBar(ctx, progress);

      if (this.winHoldTime >= this.winHoldThreshold) {
        this.handleSuccess();
      }
    } else {
      this.winHoldTime = Math.max(0, this.winHoldTime - 2); // Decay progress
    }
  },

  /* ============================== */
  handleSuccess() {
    this.gameState = "SUCCESS";
    this.score += 10;
    this.feedbackText = "Correct!";
    
    // Wait a moment then spawn new numbers
    setTimeout(() => {
      this.spawnNumbers();
    }, 1000);
  },

  /* ============================== */
  /* ============================== */
  drawUI(ctx) {
    // Shared Text Settings
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // -- DRAW NUMBERS --
    ctx.font = "bold 120px Arial"; // Made them slightly bigger
    ctx.lineWidth = 8;             // Thickness of the outline
    ctx.lineJoin = "round";        // Smooth corners for the outline

    // 1. Draw Left Number
    // Outline (Black)
    ctx.strokeStyle = "black";
    ctx.strokeText(this.leftNumber, this.centerX - 200, this.centerY);
    // Fill (White)
    ctx.fillStyle = "white";
    ctx.fillText(this.leftNumber, this.centerX - 200, this.centerY);

    // 2. Draw Right Number
    // Outline
    ctx.strokeText(this.rightNumber, this.centerX + 200, this.centerY);
    // Fill
    ctx.fillText(this.rightNumber, this.centerX + 200, this.centerY);

    // -- DRAW SCORE --
    ctx.font = "bold 40px Arial";
    ctx.lineWidth = 4;
    
    // Outline
    ctx.strokeText("Score: " + this.score, this.centerX, 60);
    // Fill
    ctx.fillText("Score: " + this.score, this.centerX, 60);

    // -- DRAW FEEDBACK (Success Message) --
    if (this.gameState === "SUCCESS") {
      ctx.fillStyle = "#00FF66";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 6;
      ctx.font = "bold 60px Arial";
      
      ctx.strokeText("CORRECT!", this.centerX, this.centerY + 120);
      ctx.fillText("CORRECT!", this.centerX, this.centerY + 120);
    }
  },
};