const Game3 = {

  centerX: null,
  centerY: null,

  // Logic Values (for Math)
  leftValue: 0,
  rightValue: 0,
  currentRelation: "", // ">", "<"

  // Display Values (Strings to draw on screen)
  leftText: "",
  rightText: "",

  score: 0,
  gameState: "PLAYING", // "PLAYING", "SUCCESS", "GAME_OVER"
  
  // -- DIFFICULTY SETTINGS --
  currentGrade: 1, 
  
  // Progress Logic
  winHoldTime: 0, 
  winHoldThreshold: 30,
  
  failHoldTime: 0,
  failHoldThreshold: 30,

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
    
    // Keyboard Shortcuts for Grades
    window.addEventListener('keydown', (e) => {
        if (e.key === '1') this.setDifficulty(1);
        if (e.key === '2') this.setDifficulty(2);
        if (e.key === '3') this.setDifficulty(3);
        if (e.key === '4') this.setDifficulty(4);
    });
    
    this.spawnNumbers();
    console.log(`Game3 Initialized (Grade ${this.currentGrade})`);
  },

  /* ============================== */
  setDifficulty(grade) {
    this.currentGrade = grade;
    this.score = 0; 
    this.spawnNumbers(); 
    console.log("Difficulty changed to Grade:", grade);
  },

  /* ============================== */
  spawnNumbers() {
    this.gameState = "PLAYING";
    this.winHoldTime = 0;
    this.failHoldTime = 0; 
    this.detectedSymbol = "None"; 

    // --- GRADE 1: Simple 1-20 ---
    if (this.currentGrade === 1) {
        this.spawnIntegers(1, 20);
    } 
    // --- GRADE 2: Integers (-50 to 50) ---
    else if (this.currentGrade === 2) {
        this.spawnIntegers(-50, 50);
    }
    // --- GRADE 3: Big Numbers OR Like Fractions ---
    else if (this.currentGrade === 3) {
        if (Math.random() > 0.5) {
            this.spawnIntegers(100, 999);
        } else {
            this.spawnLikeFractions(); // Same Denominator
        }
    }
    // --- GRADE 4: Irregular Fractions (Easy Mode) ---
    else if (this.currentGrade === 4) {
        this.spawnIrregularFractions(); // Different Denominators
    }
  },

  /* Helper: Spawn Integers */
  spawnIntegers(min, max) {
    let n1 = Math.floor(Math.random() * (max - min + 1)) + min;
    let n2 = Math.floor(Math.random() * (max - min + 1)) + min;

    while (n1 === n2) {
        n2 = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    this.leftValue = n1;
    this.rightValue = n2;
    this.leftText = n1.toString();
    this.rightText = n2.toString();
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  /* Helper: Grade 3 Fractions (Same Denominator) */
  spawnLikeFractions() {
    const den = Math.floor(Math.random() * 7) + 3; // 3 to 9
    let n1 = Math.floor(Math.random() * 12) + 1;
    let n2 = Math.floor(Math.random() * 12) + 1;

    while (n1 === n2) n2 = Math.floor(Math.random() * 12) + 1;

    this.leftValue = n1 / den;
    this.rightValue = n2 / den;
    this.leftText = `${n1}/${den}`;
    this.rightText = `${n2}/${den}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  /* Helper: Grade 4 Fractions (Different Denominators) */
  spawnIrregularFractions() {
    // We restrict denominators to small "friendly" numbers to keep it easy
    // Set: 2, 3, 4, 5, 6, 8, 10
    const easyDenoms = [2, 3, 4, 5, 6, 8, 10];
    
    // Pick two DIFFERENT denominators
    let d1 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    let d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    
    while (d1 === d2) {
       d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    }

    // Generate Numerators (mostly proper fractions, occasionally improper)
    // We try to keep values reasonably close to 1
    let n1 = Math.floor(Math.random() * d1) + 1; // e.g. 1/4 to 4/4
    let n2 = Math.floor(Math.random() * d2) + 1; 

    // Calculate Values
    this.leftValue = n1 / d1;
    this.rightValue = n2 / d2;

    // Retry if they happen to be exactly equal (e.g. 1/2 and 2/4)
    while (Math.abs(this.leftValue - this.rightValue) < 0.001) {
       n2 = Math.floor(Math.random() * d2) + 1; 
       this.rightValue = n2 / d2;
    }

    this.leftText = `${n1}/${d1}`;
    this.rightText = `${n2}/${d2}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  /* ============================== */
  update(ctx, fingers) {
    this.drawUI(ctx);

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

    if (h1.x < this.centerX - this.margin && h2.x < this.centerX - this.margin) {
      this.detectedSymbol = ">";
    } 
    else if (h1.x > this.centerX + this.margin && h2.x > this.centerX + this.margin) {
      this.detectedSymbol = "<";
    } 
    else {
      this.detectedSymbol = "Center";
    }

    const wrongRelation = this.currentRelation === ">" ? "<" : ">";

    if (this.detectedSymbol === this.currentRelation) {
      this.winHoldTime++;
      this.failHoldTime = 0; 
      const progress = this.winHoldTime / this.winHoldThreshold;
      this.drawProgressBar(ctx, progress, "#00FFCC"); 

      if (this.winHoldTime >= this.winHoldThreshold) this.handleSuccess();

    } else if (this.detectedSymbol === wrongRelation) {
      this.failHoldTime++;
      this.winHoldTime = 0; 
      const failProgress = this.failHoldTime / this.failHoldThreshold;
      this.drawProgressBar(ctx, failProgress, "#FF0000");

      if (this.failHoldTime >= this.failHoldThreshold) this.handleFail();

    } else {
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
    setTimeout(() => { this.spawnNumbers(); }, 1200);
  },

  /* ============================== */
  handleFail() {
    this.gameState = "GAME_OVER";
    this.score = this.score - 5;
    if (this.score < 0) this.score = 0; 
    setTimeout(() => { this.spawnNumbers(); }, 2000);
  },

  /* ============================== */
  drawUI(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Dynamic Font Size
    let fontSize = 120;
    if (this.leftText.length > 3 || this.rightText.length > 3) fontSize = 90;
    
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";

    ctx.strokeStyle = "black";
    ctx.strokeText(this.leftText, this.centerX - 200, this.centerY);
    ctx.fillStyle = "white";
    ctx.fillText(this.leftText, this.centerX - 200, this.centerY);

    ctx.strokeText(this.rightText, this.centerX + 200, this.centerY);
    ctx.fillStyle = "white";
    ctx.fillText(this.rightText, this.centerX + 200, this.centerY);

    // Score & Grade
    ctx.font = "bold 40px Arial";
    ctx.lineWidth = 4;
    
    ctx.strokeStyle = "black";
    ctx.strokeText(`Grade ${this.currentGrade}`, 100, 60);
    ctx.fillStyle = "#FFFF00"; 
    ctx.fillText(`Grade ${this.currentGrade}`, 100, 60);

    ctx.strokeStyle = "black";
    ctx.strokeText("Score: " + this.score, this.centerX, 60);
    ctx.fillStyle = "white";
    ctx.fillText("Score: " + this.score, this.centerX, 60);

    // Feedback
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

    if (this.gameState === "GAME_OVER") {
      ctx.fillStyle = "#FF0000"; 
      ctx.strokeStyle = "white";
      ctx.lineWidth = 6;
      ctx.font = "bold 80px Arial";
      ctx.strokeText("WRONG!", this.centerX, this.centerY);
      ctx.fillText("WRONG!", this.centerX, this.centerY);

      ctx.font = "bold 40px Arial";
      ctx.fillStyle = "white";
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
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(this.centerX - 100, this.centerY + 70, 200, 20);
    ctx.fillStyle = color;
    ctx.fillRect(this.centerX - 100, this.centerY + 70, 200 * percentage, 20);
  }
};