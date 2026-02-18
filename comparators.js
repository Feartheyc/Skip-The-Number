const Game3 = {

  centerX: 0,
  centerY: 0,
  scale: 1,

  leftValue: 0,
  rightValue: 0,
  currentRelation: "",

  leftText: "",
  rightText: "",

  score: 0,
  gameState: "PLAYING",

  currentGrade: 1,

  winHoldTime: 0,
  winHoldThreshold: 0.7,   // seconds

  failHoldTime: 0,
  failHoldThreshold: 0.7,  // seconds

  margin: 0,
  detectedSymbol: "None",

  /* ============================== */
  init() {

    const rect = document
      .getElementById("container")
      .getBoundingClientRect();

    this.onResize(rect.width, rect.height);

    this.score = 0;

    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setDifficulty(1);
      if (e.key === '2') this.setDifficulty(2);
      if (e.key === '3') this.setDifficulty(3);
      if (e.key === '4') this.setDifficulty(4);
    });

    this.spawnNumbers();
  },

  /* ============================== */
  onResize(width, height) {

    this.centerX = width / 2;
    this.centerY = height / 2;

    const base = Math.min(width, height);

    this.scale = base / 600;

    this.margin = 80 * this.scale;
  },

  /* ============================== */
  setDifficulty(grade) {
    this.currentGrade = grade;
    this.score = 0;
    this.spawnNumbers();
  },

  /* ============================== */
  spawnNumbers() {

    this.gameState = "PLAYING";
    this.winHoldTime = 0;
    this.failHoldTime = 0;
    this.detectedSymbol = "None";

    if (this.currentGrade === 1) this.spawnIntegers(1, 20);
    else if (this.currentGrade === 2) this.spawnIntegers(-50, 50);
    else if (this.currentGrade === 3) {
      if (Math.random() > 0.5) this.spawnIntegers(100, 999);
      else this.spawnLikeFractions();
    }
    else if (this.currentGrade === 4) {
      this.spawnIrregularFractions();
    }
  },

  /* ============================== */
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

    this.currentRelation =
      this.leftValue > this.rightValue ? ">" : "<";
  },

  /* ============================== */
  spawnLikeFractions() {

    const den = Math.floor(Math.random() * 7) + 3;

    let n1 = Math.floor(Math.random() * 12) + 1;
    let n2 = Math.floor(Math.random() * 12) + 1;

    while (n1 === n2) n2 = Math.floor(Math.random() * 12) + 1;

    this.leftValue = n1 / den;
    this.rightValue = n2 / den;

    this.leftText = `${n1}/${den}`;
    this.rightText = `${n2}/${den}`;

    this.currentRelation =
      this.leftValue > this.rightValue ? ">" : "<";
  },

  /* ============================== */
  spawnIrregularFractions() {

    const easyDenoms = [2, 3, 4, 5, 6, 8, 10];

    let d1 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    let d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];

    while (d1 === d2) {
      d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    }

    let n1 = Math.floor(Math.random() * d1) + 1;
    let n2 = Math.floor(Math.random() * d2) + 1;

    this.leftValue = n1 / d1;
    this.rightValue = n2 / d2;

    while (Math.abs(this.leftValue - this.rightValue) < 0.001) {
      n2 = Math.floor(Math.random() * d2) + 1;
      this.rightValue = n2 / d2;
    }

    this.leftText = `${n1}/${d1}`;
    this.rightText = `${n2}/${d2}`;

    this.currentRelation =
      this.leftValue > this.rightValue ? ">" : "<";
  },

  /* ============================== */
  update(ctx, fingers, dt = 1 / 60) {

    this.drawUI(ctx);

    if (this.gameState !== "PLAYING") return;

    if (fingers.length < 2) {
      this.drawFeedback(ctx, "Need 2 Hands!", "orange");
      return;
    }

    fingers.sort((a, b) => a.y - b.y);

    const h1 = fingers[0];
    const h2 = fingers[1];

    this.checkPose(ctx, h1, h2, dt);
    this.drawArmSymbol(ctx, h1, h2);
  },

  /* ============================== */
  checkPose(ctx, h1, h2, dt) {

    if (h1.x < this.centerX - this.margin &&
        h2.x < this.centerX - this.margin) {

      this.detectedSymbol = ">";

    } else if (h1.x > this.centerX + this.margin &&
               h2.x > this.centerX + this.margin) {

      this.detectedSymbol = "<";

    } else {
      this.detectedSymbol = "Center";
    }

    const wrongRelation =
      this.currentRelation === ">" ? "<" : ">";

    if (this.detectedSymbol === this.currentRelation) {

      this.winHoldTime += dt;
      this.failHoldTime = 0;

      const progress =
        this.winHoldTime / this.winHoldThreshold;

      this.drawProgressBar(ctx, progress, "#00FFCC");

      if (this.winHoldTime >= this.winHoldThreshold)
        this.handleSuccess();

    }
    else if (this.detectedSymbol === wrongRelation) {

      this.failHoldTime += dt;
      this.winHoldTime = 0;

      const failProgress =
        this.failHoldTime / this.failHoldThreshold;

      this.drawProgressBar(ctx, failProgress, "#FF0000");

      if (this.failHoldTime >= this.failHoldThreshold)
        this.handleFail();

    }
    else {

      this.winHoldTime =
        Math.max(0, this.winHoldTime - dt * 2);

      this.failHoldTime =
        Math.max(0, this.failHoldTime - dt * 2);
    }
  },

  /* ============================== */
  drawArmSymbol(ctx, h1, h2) {

    const size = 12 * this.scale;

    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.shadowBlur = 15 * this.scale;

    if (this.detectedSymbol === ">") {
      ctx.strokeStyle = "#FFFF00";
      ctx.shadowColor = "#FFFF00";
    }
    else if (this.detectedSymbol === "<") {
      ctx.strokeStyle = "#00AAFF";
      ctx.shadowColor = "#00AAFF";
    }
    else {
      ctx.strokeStyle = "#00FFCC";
      ctx.shadowColor = "#00FFCC";
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
      ctx.arc(h.x, h.y, 10 * this.scale, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  /* ============================== */
  handleSuccess() {

    this.gameState = "SUCCESS";
    this.score += 10;

    setTimeout(() => {
      this.spawnNumbers();
    }, 900);
  },

  /* ============================== */
  handleFail() {

    this.gameState = "GAME_OVER";

    this.score = Math.max(0, this.score - 5);

    setTimeout(() => {
      this.spawnNumbers();
    }, 1200);
  },

  /* ============================== */
  drawUI(ctx) {

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const numberSize = 110 * this.scale;

    ctx.font = `bold ${numberSize}px Arial`;

    const offsetX = 180 * this.scale;

    ctx.fillStyle = "white";

    ctx.fillText(
      this.leftText,
      this.centerX - offsetX,
      this.centerY
    );

    ctx.fillText(
      this.rightText,
      this.centerX + offsetX,
      this.centerY
    );

    /* ===== Score ===== */

    ctx.font = `bold ${36 * this.scale}px Arial`;

    ctx.fillStyle = "#FFFF00";

    ctx.fillText(
      `Grade ${this.currentGrade}`,
      120 * this.scale,
      60 * this.scale
    );

    ctx.fillStyle = "white";

    ctx.fillText(
      `Score: ${this.score}`,
      this.centerX,
      60 * this.scale
    );

    /* ===== Feedback ===== */

    if (this.gameState === "SUCCESS") {

      ctx.fillStyle = "#00FF66";
      ctx.font = `bold ${60 * this.scale}px Arial`;

      ctx.fillText(
        "CORRECT!",
        this.centerX,
        this.centerY + 120 * this.scale
      );
    }

    if (this.gameState === "GAME_OVER") {

      ctx.fillStyle = "#FF0000";
      ctx.font = `bold ${70 * this.scale}px Arial`;

      ctx.fillText(
        "WRONG!",
        this.centerX,
        this.centerY
      );
    }
  },

  /* ============================== */
  drawFeedback(ctx, text, color) {

    ctx.fillStyle = color;
    ctx.font = `bold ${30 * this.scale}px Arial`;

    ctx.fillText(
      text,
      this.centerX,
      this.centerY + 150 * this.scale
    );
  },

  /* ============================== */
  drawProgressBar(ctx, percentage, color) {

    if (percentage <= 0) return;

    const width = 220 * this.scale;
    const height = 20 * this.scale;

    ctx.fillStyle = "rgba(0,0,0,0.5)";

    ctx.fillRect(
      this.centerX - width / 2,
      this.centerY + 70 * this.scale,
      width,
      height
    );

    ctx.fillStyle = color;

    ctx.fillRect(
      this.centerX - width / 2,
      this.centerY + 70 * this.scale,
      width * Math.min(1, percentage),
      height
    );
  }

};
