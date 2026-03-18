const Game3 = {
  centerX: 0,
  centerY: 0,
  scale: 1,

  leftValue: 0,
  rightValue: 0,
  currentRelation: "",

  leftText: "",
  rightText: "",

  leftColor: "#FFFFFF",
  rightColor: "#FFFFFF",

  score: 0,
  combo: 0,
  gameState: "PLAYING",
  running: true,

  currentGrade: 1,

  winHoldTime: 0,
  winHoldThreshold: 0.7,

  failHoldTime: 0,
  failHoldThreshold: 0.7,

  margin: 0,
  detectedSymbol: "None",

  fadeAlpha: 0,
  fadeSpeed: 2.5,

  popScale: 0,
  popSpeed: 6,

  popups: [],
  particles: [],
  confetti: [],
  shakeTime: 0,
  shakeMag: 0,

  symbolHue: 0,
  cameraStarted: false,

  init() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.onResize(w, h);
    this.score = 0;
    this.running = true;

    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setDifficulty(1);
      if (e.key === '2') this.setDifficulty(2);
      if (e.key === '3') this.setDifficulty(3);
      if (e.key === '4') this.setDifficulty(4);
    });

    this.spawnNumbers();

    if (typeof PauseArea !== 'undefined') {
      const canvas = document.getElementById("game_canvas") || document.querySelector("canvas");
      if (canvas) PauseArea.init(canvas, canvas.getContext('2d'), this);
    }
  },

  reset() {
    this.init();
  },

  onResize(width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    const base = Math.min(width, height);
    this.scale = base / 600;
    this.margin = 80 * this.scale;
  },

  setDifficulty(grade) {
    this.currentGrade = grade;
    this.score = 0;
    this.combo = 0;
    this.spawnNumbers();
  },

  getBrightColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 60%)`;
  },

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
    else if (this.currentGrade === 4) this.spawnIrregularFractions();

    this.leftColor = this.getBrightColor();
    this.rightColor = this.getBrightColor();

    this.fadeAlpha = 0;
    this.popScale = 0.5;
  },

  spawnIntegers(min, max) {
    let n1 = Math.floor(Math.random() * (max - min + 1)) + min;
    let n2 = Math.floor(Math.random() * (max - min + 1)) + min;
    while (n1 === n2) n2 = Math.floor(Math.random() * (max - min + 1)) + min;

    this.leftValue = n1;
    this.rightValue = n2;
    this.leftText = n1.toString();
    this.rightText = n2.toString();
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  spawnLikeFractions() {
    const den = Math.floor(Math.random() * 7) + 3;
    let n1 = Math.floor(Math.random() * 12) + 1;
    let n2 = Math.floor(Math.random() * 12) + 1;
    while (n1 === n2) n2 = Math.floor(Math.random() * 12) + 1;

    this.leftValue = n1 / den;
    this.rightValue = n2 / den;
    this.leftText = `${n1}/${den}`;
    this.rightText = `${n2}/${den}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  spawnIrregularFractions() {
    const easyDenoms = [2, 3, 4, 5, 6, 8, 10];
    let d1 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    let d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    while (d1 === d2) d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];

    let n1 = Math.floor(Math.random() * d1) + 1;
    let n2 = Math.floor(Math.random() * d2) + 1;

    this.leftValue = n1 / d1;
    this.rightValue = n2 / d2;
    this.leftText = `${n1}/${d1}`;
    this.rightText = `${n2}/${d2}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  update(ctx, landmarks, dt = 1 / 60) {
    const isPaused = typeof PauseArea !== 'undefined' && PauseArea.isPaused;
    if (isPaused) dt = 0;

    ctx.save();

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      ctx.translate((Math.random() - 0.5) * this.shakeMag, (Math.random() - 0.5) * this.shakeMag);
    }

    this.fadeAlpha = Math.min(1, this.fadeAlpha + dt * this.fadeSpeed);
    this.popScale = Math.min(1, this.popScale + dt * this.popSpeed);

    this.drawUI(ctx);
    this.drawPopups(ctx, dt);
    this.drawParticles(ctx, dt);

    if (this.gameState !== "PLAYING") {
      ctx.restore();
    }
    else {
      if (!landmarks || landmarks.length < 3) {
        this.drawFeedback(ctx, "Show One Hand!", "orange");
      }
      else {
        const indexTip = landmarks[0];
        const thumbTip = landmarks[1];
        const wrist = landmarks[2];

        const angle = this.calculateWristAngle(indexTip, thumbTip, wrist);

        if (angle < 20) {
          this.detectedSymbol = "None";
          ctx.restore();
          return;
        }

        this.checkPose(ctx, indexTip, thumbTip, wrist, dt);
        this.drawArmSymbol(ctx, indexTip, thumbTip, wrist);
      }
      ctx.restore();
    }

    if (typeof PauseArea !== 'undefined') {
      PauseArea.drawPauseIcon(ctx);
      if (isPaused) PauseArea.draw();
    }
  },

  checkPose(ctx, indexTip, thumbTip, wrist, dt) {
    const angle = this.calculateWristAngle(indexTip, thumbTip, wrist);

    if (angle < 20) {
      this.detectedSymbol = "None";
      this.winHoldTime = Math.max(0, this.winHoldTime - dt);
      this.failHoldTime = Math.max(0, this.failHoldTime - dt);
      return;
    }

    const overlap = this.getHandOverlapRatio(indexTip, thumbTip, wrist);

    if (overlap < 0.5) {
      this.detectedSymbol = "None";
      this.winHoldTime = Math.max(0, this.winHoldTime - dt);
      this.failHoldTime = Math.max(0, this.failHoldTime - dt);
      return;
    }

    const tipsX = (indexTip.x + thumbTip.x) / 2;
    const threshold = 30 * this.scale;

    if (tipsX < wrist.x - threshold) {
      this.detectedSymbol = ">";
    }
    else if (tipsX > wrist.x + threshold) {
      this.detectedSymbol = "<";
    }
    else {
      this.detectedSymbol = "Center";
    }

    const wrongRelation = this.currentRelation === ">" ? "<" : ">";

    if (this.detectedSymbol === this.currentRelation) {
      this.winHoldTime += dt;
      this.failHoldTime = 0;
      this.drawProgressBar(ctx, this.winHoldTime / this.winHoldThreshold, "#00FFCC");

      if (this.winHoldTime >= this.winHoldThreshold) {
        this.handleSuccess();
      }
    }
    else if (this.detectedSymbol === wrongRelation) {
      this.failHoldTime += dt;
      this.winHoldTime = 0;
      this.drawProgressBar(ctx, this.failHoldTime / this.failHoldThreshold, "#FF0000");

      if (this.failHoldTime >= this.failHoldThreshold) {
        this.handleFail();
      }
    }
    else {
      this.winHoldTime = Math.max(0, this.winHoldTime - dt);
      this.failHoldTime = Math.max(0, this.failHoldTime - dt);
    }
  },

  handleSuccess() {
    this.gameState = "SUCCESS";
    this.score += 10;
    this.combo++;

    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: this.centerX,
        y: this.centerY,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        life: 1,
        color: this.getBrightColor()
      });
    }

    this.popups.push({ text: "Correct", x: this.centerX, y: this.centerY, vy: -30, life: 1, color: "#00FF66" });
    setTimeout(() => this.spawnNumbers(), 900);
  },

  handleFail() {
    this.gameState = "GAME_OVER";
    this.score = Math.max(0, this.score - 5);
    this.combo = 0;
    this.shakeTime = 0.4;
    this.shakeMag = 10 * this.scale;

    this.popups.push({ text: "Wrong!!!", x: this.centerX, y: this.centerY, vy: 30, life: 1, color: "#FF4444" });
    setTimeout(() => this.spawnNumbers(), 1200);
  },

  drawParticles(ctx, dt) {
    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 * this.scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);
  },

  drawPopups(ctx, dt) {
    this.popups.forEach(p => {
      p.y += p.vy * dt;
      p.life -= dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.textAlign = "center";
      ctx.font = `bold ${50 * this.scale}px Arial`;
      
      ctx.lineWidth = 6 * this.scale;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.strokeText(p.text, p.x, p.y);
      
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter(p => p.life > 0);
  },

  drawArmSymbol(ctx, indexTip, thumbTip, wrist) {
    const angle = this.calculateWristAngle(indexTip, thumbTip, wrist);
    if (angle < 20) return;

    const overlap = this.getHandOverlapRatio(indexTip, thumbTip, wrist);
    if (overlap < 0.5) return;

    ctx.lineWidth = 12 * this.scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 15 * this.scale;

    let color = "#00FFCC";
    if (this.detectedSymbol === ">") {
      color = "#FFFF00";
    }
    else if (this.detectedSymbol === "<") {
      color = "#00AAFF";
    }

    ctx.strokeStyle = color;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.moveTo(indexTip.x, indexTip.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.lineTo(thumbTip.x, thumbTip.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "white";

    [indexTip, thumbTip, wrist].forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8 * this.scale, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  drawUI(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // --- 1. Draw The Math Cards ---
    const offsetX = 280 * this.scale;
    const leftX = this.centerX - offsetX;
    const rightX = this.centerX + offsetX;
    const y = this.centerY;

    const cardW = 200 * this.scale * this.popScale;
    const cardH = 180 * this.scale * this.popScale;

    ctx.globalAlpha = this.fadeAlpha;

    const drawCard = (x, color, text) => {
      const radius = 25 * this.scale;

      // Card Background Shadow
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 25 * this.scale;
      ctx.shadowOffsetY = 10 * this.scale;

      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.moveTo(x - cardW / 2 + radius, y - cardH / 2);
      ctx.lineTo(x + cardW / 2 - radius, y - cardH / 2);
      ctx.quadraticCurveTo(x + cardW / 2, y - cardH / 2, x + cardW / 2, y - cardH / 2 + radius);
      ctx.lineTo(x + cardW / 2, y + cardH / 2 - radius);
      ctx.quadraticCurveTo(x + cardW / 2, y + cardH / 2, x + cardW / 2 - radius, y + cardH / 2);
      ctx.lineTo(x - cardW / 2 + radius, y + cardH / 2);
      ctx.quadraticCurveTo(x - cardW / 2, y + cardH / 2, x - cardW / 2, y + cardH / 2 - radius);
      ctx.lineTo(x - cardW / 2, y - cardH / 2 + radius);
      ctx.quadraticCurveTo(x - cardW / 2, y - cardH / 2, x - cardW / 2 + radius, y - cardH / 2);
      ctx.closePath();
      ctx.fill();

      // Text Shadow for the numbers
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8 * this.scale;
      ctx.shadowOffsetY = 5 * this.scale;

      ctx.font = `bold ${90 * this.scale * this.popScale}px Arial`;
      
      ctx.lineWidth = 4 * this.scale;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.strokeText(text, x, y);
      
      ctx.fillStyle = "white";
      ctx.fillText(text, x, y);

      // Reset shadows completely so they don't leak
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    };

    drawCard(leftX, this.leftColor, this.leftText);
    drawCard(rightX, this.rightColor, this.rightText);

    ctx.globalAlpha = 1;

    // --- 2. VS indicator ---
    ctx.font = `bold ${70 * this.scale}px Arial`;
    
    ctx.lineWidth = 6 * this.scale;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.strokeText("?", this.centerX, this.centerY);
    
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("?", this.centerX, this.centerY);

    // --- 3. UI Badges ---
    const drawBadge = (text, centerX, centerY, bgColor, textColor) => {
      ctx.font = `bold ${36 * this.scale}px "Comic Sans MS", "Fredoka One", Arial, sans-serif`; 
      
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const textWidth = ctx.measureText(text).width;
      const paddingX = 25 * this.scale;
      
      const pillWidth = textWidth + (paddingX * 2);
      const pillHeight = 56 * this.scale; 
      const radius = 20 * this.scale;

      ctx.fillStyle = bgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(centerX - (pillWidth / 2), centerY - (pillHeight / 2), pillWidth, pillHeight, radius);
      } else {
         ctx.fillRect(centerX - (pillWidth / 2), centerY - (pillHeight / 2), pillWidth, pillHeight);
      }
      ctx.fill();

      const textDrawY = centerY + (2 * this.scale);
      
      ctx.lineWidth = 6 * this.scale;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.lineJoin = "round";
      ctx.strokeText(text, centerX, textDrawY);

      ctx.fillStyle = textColor;
      ctx.fillText(text, centerX, textDrawY);
    };

    drawBadge(`Grade: ${this.currentGrade}`, 120 * this.scale, 60 * this.scale, "rgba(0, 0, 0, 0.5)", "#00FFCC");
    drawBadge(`Score: ${this.score}`, this.centerX, 60 * this.scale, "rgba(0, 0, 0, 0.5)", "#FFD700");

    // --- 4. Combo Text ---
    if (this.combo >= 2) {
      ctx.textAlign = "center";
      ctx.font = `bold ${28 * this.scale}px Arial`;
      ctx.lineWidth = 4 * this.scale;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(`Combo x${this.combo}`, this.centerX, 120 * this.scale);
      
      ctx.fillStyle = "#FF6600";
      ctx.fillText(`Combo x${this.combo}`, this.centerX, 120 * this.scale);
    }
  },

  drawFeedback(ctx, text, color) {
    ctx.textAlign = "center";
    ctx.font = `bold ${30 * this.scale}px Arial`;
    
    ctx.lineWidth = 5 * this.scale;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(text, this.centerX, this.centerY + 150 * this.scale);
    
    ctx.fillStyle = color;
    ctx.fillText(text, this.centerX, this.centerY + 150 * this.scale);
  },

  drawProgressBar(ctx, percentage, color) {
    if (percentage <= 0) return;
    const width = 220 * this.scale;
    const height = 20 * this.scale;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(this.centerX - width / 2, this.centerY + 70 * this.scale, width, height);

    ctx.fillStyle = color;
    ctx.fillRect(this.centerX - width / 2, this.centerY + 70 * this.scale, width * Math.min(1, percentage), height);
  },

  lastTime: 0,
  gameCtx: null,

  startDetection() {
    if (this.cameraStarted) return;
    this.cameraStarted = true;

    const video = document.getElementById("input_video");

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    hands.onResults((results) => {
      this.processHandResults(results);
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 1280,
      height: 720
    });

    video.style.opacity = "0";
    video.onplaying = () => video.style.opacity = "1";

    camera.start();
  },

  processHandResults(results) {
    const canvas = document.getElementById("game_canvas");
    const rect = canvas.getBoundingClientRect();

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      window.fingerPositions = [];
      this.prevPoints = null;
      this.skipFrame = true;
      return;
    }

    const hand = results.multiHandLandmarks[0];

    const width = rect.width;
    const height = rect.height;

    const rawIndexX = (1 - hand[8].x) * width;
    const rawIndexY = hand[8].y * height;

    const rawThumbX = (1 - hand[4].x) * width;
    const rawThumbY = hand[4].y * height;

    const rawWristX = (1 - hand[0].x) * width;
    const rawWristY = hand[0].y * height;

    if (this.skipFrame) {
      this.skipFrame = false;
      return;
    }

    this.prevPoints = this.prevPoints || {};

    const smoothPoint = (name, x, y) => {
      const prev = this.prevPoints[name];

      if (!prev) {
        this.prevPoints[name] = { x, y };
        return { x, y };
      }

      const dx = x - prev.x;
      const dy = y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) return prev;

      const factor = dist > 20 ? 0.5 : 0.8;

      const smoothed = {
        x: prev.x * factor + x * (1 - factor),
        y: prev.y * factor + y * (1 - factor)
      };

      this.prevPoints[name] = smoothed;
      return smoothed;
    };

    const indexTip = smoothPoint("index", rawIndexX, rawIndexY);
    const thumbTip = smoothPoint("thumb", rawThumbX, rawThumbY);
    const wrist = smoothPoint("wrist", rawWristX, rawWristY);

    window.fingerPositions = [indexTip, thumbTip, wrist];
  },

  calculateWristAngle(indexTip, thumbTip, wrist) {
    const v1x = indexTip.x - wrist.x;
    const v1y = indexTip.y - wrist.y;

    const v2x = thumbTip.x - wrist.x;
    const v2y = thumbTip.y - wrist.y;

    const dot = v1x * v2x + v1y * v2y;

    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return angle * (180 / Math.PI);
  },

  getHandOverlapRatio(indexTip, thumbTip, wrist) {
    const margin = 60 * this.scale;
    const offsetX = 180 * this.scale;

    const zoneLeft = this.centerX - offsetX;
    const zoneRight = this.centerX + offsetX;
    const zoneTop = this.centerY - margin;
    const zoneBottom = this.centerY + margin;

    const handLeft = Math.min(indexTip.x, thumbTip.x, wrist.x);
    const handRight = Math.max(indexTip.x, thumbTip.x, wrist.x);
    const handTop = Math.min(indexTip.y, thumbTip.y, wrist.y);
    const handBottom = Math.max(indexTip.y, thumbTip.y, wrist.y);

    const handWidth = handRight - handLeft;
    const handHeight = handBottom - handTop;

    const handArea = handWidth * handHeight;

    const overlapLeft = Math.max(handLeft, zoneLeft);
    const overlapRight = Math.min(handRight, zoneRight);
    const overlapTop = Math.max(handTop, zoneTop);
    const overlapBottom = Math.min(handBottom, zoneBottom);

    const overlapWidth = Math.max(0, overlapRight - overlapLeft);
    const overlapHeight = Math.max(0, overlapBottom - overlapTop);

    const overlapArea = overlapWidth * overlapHeight;

    if (handArea === 0) return 0;

    return overlapArea / handArea;
  }
}