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

  showTutorial: true,
  tutorialHoldTime: 0,
  
  eventsBound: false,
  helpBtn: null,

  // ⚡ ADDITIVE: Performance Caching
  uiCache: null,
  fps: 0,
  frameCounter: 0,
  fpsTimer: 0,

  init() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.onResize(w, h);
    this.score = 0;
    this.running = true;
    this.showTutorial = true; 
    this.tutorialHoldTime = 0;

    if (!this.eventsBound) {
      this.eventsBound = true;

      window.addEventListener('keydown', (e) => {
        if (e.key === '1') this.setDifficulty(1);
        if (e.key === '2') this.setDifficulty(2);
        if (e.key === '3') this.setDifficulty(3);
        if (e.key === '4') this.setDifficulty(4);
        
        if (e.key === ' ' && this.showTutorial) {
            this.showTutorial = false;
            this.spawnNumbers();
        }
      });

      const canvas = document.getElementById("game_canvas") || document.querySelector("canvas");
      if (canvas) {
        canvas.addEventListener('pointerdown', (e) => {
          if (this.helpBtn) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const dx = mouseX - this.helpBtn.x;
            const dy = mouseY - this.helpBtn.y;
            const hitRadius = this.helpBtn.r + 15; 
            
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
              this.showTutorial = true;
              this.tutorialHoldTime = 0;
            }
          }
        });
      }
    }

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

    this.helpBtn = { 
      x: width - 100 * this.scale, 
      y: 40 * this.scale, 
      r: 20 * this.scale 
    };

    // ⚡ ADDITIVE: Pre-render UI elements that don't change every frame
    this.preRenderUI();
  },

  preRenderUI() {
    this.uiCache = document.createElement('canvas');
    this.uiCache.width = window.innerWidth;
    this.uiCache.height = 120 * this.scale;
    const cctx = this.uiCache.getContext('2d');
    
    // Draw Grade/Score Background Pills once
    const drawPill = (x, text, color) => {
      cctx.font = `bold ${36 * this.scale}px Arial`;
      const tw = cctx.measureText(text).width + 50 * this.scale;
      const th = 56 * this.scale;
      cctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      cctx.beginPath();
      cctx.roundRect(x - tw/2, 60 * this.scale - th/2, tw, th, 20 * this.scale);
      cctx.fill();
    };

    drawPill(120 * this.scale, "Grade: 8", ""); // Template size
    drawPill(this.centerX, "Score: 0000", "");
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
    this.leftValue = n1; this.rightValue = n2;
    this.leftText = n1.toString(); this.rightText = n2.toString();
    this.currentRelation = n1 > n2 ? ">" : "<";
  },

  spawnLikeFractions() {
    const den = Math.floor(Math.random() * 7) + 3;
    let n1 = Math.floor(Math.random() * 12) + 1;
    let n2 = Math.floor(Math.random() * 12) + 1;
    while (n1 === n2) n2 = Math.floor(Math.random() * 12) + 1;
    this.leftValue = n1 / den; this.rightValue = n2 / den;
    this.leftText = `${n1}/${den}`; this.rightText = `${n2}/${den}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  spawnIrregularFractions() {
    const easyDenoms = [2, 3, 4, 5, 6, 8, 10];
    let d1 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    let d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    while (d1 === d2) d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    let n1 = Math.floor(Math.random() * d1) + 1;
    let n2 = Math.floor(Math.random() * d2) + 1;
    this.leftValue = n1 / d1; this.rightValue = n2 / d2;
    this.leftText = `${n1}/${d1}`; this.rightText = `${n2}/${d2}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  update(ctx, landmarks, dt = 1 / 60) {
    const isPaused = typeof PauseArea !== 'undefined' && PauseArea.isPaused;
    if (isPaused) dt = 0;

    // ⚡ ADDITIVE: FPS Monitor
    this.frameCounter++;
    this.fpsTimer += dt;
    if(this.fpsTimer >= 1) { this.fps = this.frameCounter; this.frameCounter = 0; this.fpsTimer = 0; }

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

    const isPlaying = !this.showTutorial && this.gameState === "PLAYING";

    if (this.gameState === "PLAYING" || this.showTutorial) {
      if (!landmarks || landmarks.length < 3) {
        if (isPlaying) this.drawFeedback(ctx, "Show One Hand!", "orange");
        else if (this.showTutorial) this.tutorialHoldTime = Math.max(0, this.tutorialHoldTime - dt);
      } else {
        const [indexTip, thumbTip, wrist] = landmarks;
        this.drawArmSymbol(ctx, indexTip, thumbTip, wrist);
        if (this.showTutorial) {
          this.tutorialHoldTime += dt;
          if (this.tutorialHoldTime >= 1.5) { this.showTutorial = false; this.spawnNumbers(); }
        } else if (isPlaying) {
          this.checkPose(ctx, indexTip, thumbTip, wrist, dt);
        }
      }
    }

    if (this.showTutorial) this.drawTutorialWindow(ctx);
    ctx.restore();

    if (typeof PauseArea !== 'undefined') {
      PauseArea.drawPauseIcon(ctx);
      if (isPaused) PauseArea.draw();
    }
  },

  drawTutorialWindow(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const boxW = 750 * this.scale;
    const boxH = 400 * this.scale;
    const boxX = this.centerX - boxW / 2;
    const boxY = this.centerY - boxH / 2;

    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 25 * this.scale);
    ctx.fill();
    ctx.strokeStyle = "#00FFCC";
    ctx.lineWidth = 4 * this.scale;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${45 * this.scale}px Arial`;
    ctx.fillText("How to Play!", this.centerX, boxY + 60 * this.scale);

    ctx.font = `bold ${24 * this.scale}px Arial`;
    ctx.fillStyle = "#DDDDDD";
    const lines = [
        "1. Look at the two numbers.",
        "2. Make a shape with your thumb & index finger.",
        "3. Point at the BIGGER number!"
    ];
    lines.forEach((line, i) => ctx.fillText(line, this.centerX, boxY + 130 * this.scale + i * 45 * this.scale));

    const progressY = boxY + 350 * this.scale;
    if (this.tutorialHoldTime > 0) {
      let progress = Math.min(1, this.tutorialHoldTime / 1.5);
      ctx.fillStyle = "#00FFCC";
      ctx.fillRect(this.centerX - 150 * this.scale, progressY + 10 * this.scale, 300 * this.scale * progress, 10 * this.scale);
    } else {
      ctx.fillStyle = "#FFD700";
      ctx.fillText("Hold hand up to Start!", this.centerX, progressY);
    }
  },

  checkPose(ctx, indexTip, thumbTip, wrist, dt) {
    const angle = this.calculateWristAngle(indexTip, thumbTip, wrist);
    if (angle < 20) { this.resetHolds(dt); return; }

    const overlap = this.getHandOverlapRatio(indexTip, thumbTip, wrist);
    if (overlap < 0.5) { this.resetHolds(dt); return; }

    const tipsX = (indexTip.x + thumbTip.x) / 2;
    const threshold = 30 * this.scale;

    if (tipsX < wrist.x - threshold) this.detectedSymbol = ">";
    else if (tipsX > wrist.x + threshold) this.detectedSymbol = "<";
    else this.detectedSymbol = "Center";

    const isCorrect = this.detectedSymbol === this.currentRelation;
    const isWrong = this.detectedSymbol === (this.currentRelation === ">" ? "<" : ">");

    if (isCorrect) {
      this.winHoldTime += dt;
      this.failHoldTime = 0;
      this.drawProgressBar(ctx, this.winHoldTime / this.winHoldThreshold, "#00FFCC");
      if (this.winHoldTime >= this.winHoldThreshold) this.handleSuccess();
    } else if (isWrong) {
      this.failHoldTime += dt;
      this.winHoldTime = 0;
      this.drawProgressBar(ctx, this.failHoldTime / this.failHoldThreshold, "#FF0000");
      if (this.failHoldTime >= this.failHoldThreshold) this.handleFail();
    } else {
      this.resetHolds(dt);
    }
  },

  resetHolds(dt) {
    this.winHoldTime = Math.max(0, this.winHoldTime - dt);
    this.failHoldTime = Math.max(0, this.failHoldTime - dt);
    this.detectedSymbol = "None";
  },

  handleSuccess() {
    this.gameState = "SUCCESS";
    this.score += 10;
    this.combo++;
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: this.centerX, y: this.centerY,
        vx: (Math.random() - 0.5) * 400, vy: (Math.random() - 0.5) * 400,
        life: 1, color: this.getBrightColor()
      });
    }
    this.popups.push({ text: "Correct!", x: this.centerX, y: this.centerY, vy: -40, life: 1, color: "#00FF66" });
    setTimeout(() => this.spawnNumbers(), 800);
  },

  handleFail() {
    this.gameState = "GAME_OVER";
    this.score = Math.max(0, this.score - 5);
    this.combo = 0;
    this.shakeTime = 0.3;
    this.shakeMag = 12 * this.scale;
    this.popups.push({ text: "Wrong!", x: this.centerX, y: this.centerY, vy: 40, life: 1, color: "#FF4444" });
    setTimeout(() => this.spawnNumbers(), 1000);
  },

  drawParticles(ctx, dt) {
    ctx.save();
    this.particles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 * this.scale, 0, 7); ctx.fill();
    });
    ctx.restore();
    this.particles = this.particles.filter(p => p.life > 0);
  },

  drawPopups(ctx, dt) {
    this.popups.forEach(p => {
      p.y += p.vy * dt; p.life -= dt;
      ctx.globalAlpha = p.life;
      ctx.font = `bold ${50 * this.scale}px Arial`;
      ctx.fillStyle = p.color;
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter(p => p.life > 0);
  },

  drawArmSymbol(ctx, indexTip, thumbTip, wrist) {
    const angle = this.calculateWristAngle(indexTip, thumbTip, wrist);
    if (angle < 20) return;
    
    let color = "#00FFCC";
    if (this.detectedSymbol === ">") color = "#FFFF00";
    else if (this.detectedSymbol === "<") color = "#00AAFF";

    ctx.strokeStyle = color;
    ctx.lineWidth = 10 * this.scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(indexTip.x, indexTip.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.lineTo(thumbTip.x, thumbTip.y);
    ctx.stroke();

    ctx.fillStyle = "white";
    [indexTip, thumbTip, wrist].forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 6 * this.scale, 0, 7); ctx.fill();
    });
  },

  drawUI(ctx) {
    // ⚡ ADDITIVE: Draw cached backgrounds
    if(this.uiCache) ctx.drawImage(this.uiCache, 0, 0);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const offsetX = 280 * this.scale;
    const cardW = 200 * this.scale * this.popScale;
    const cardH = 180 * this.scale * this.popScale;

    ctx.globalAlpha = this.fadeAlpha;

    const drawCard = (x, color, text) => {
      // ⚡ OPTIMIZED: Cheap shadow instead of Gaussian Blur
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.roundRect(x - cardW/2 + 5, this.centerY - cardH/2 + 10, cardW, cardH, 20 * this.scale);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x - cardW/2, this.centerY - cardH/2, cardW, cardH, 20 * this.scale);
      ctx.fill();

      ctx.font = `bold ${80 * this.scale * this.popScale}px Arial`;
      ctx.fillStyle = "white";
      ctx.fillText(text, x, this.centerY);
    };

    drawCard(this.centerX - offsetX, this.leftColor, this.leftText);
    drawCard(this.centerX + offsetX, this.rightColor, this.rightText);

    ctx.globalAlpha = 1;
    ctx.font = `bold ${70 * this.scale}px Arial`;
    ctx.fillStyle = "white";
    ctx.fillText("?", this.centerX, this.centerY);

    // Dynamic Text over cached backgrounds
    ctx.font = `bold ${36 * this.scale}px Arial`;
    ctx.fillStyle = "#00FFCC";
    ctx.fillText(`Grade: ${this.currentGrade}`, 120 * this.scale, 60 * this.scale);
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`Score: ${this.score}`, this.centerX, 60 * this.scale);

    if (this.combo >= 2) {
      ctx.fillStyle = "#FF6600";
      ctx.fillText(`Combo x${this.combo}`, this.centerX, 120 * this.scale);
    }

    this.drawHelpButton(ctx);
    
    // ⚡ ADDITIVE: Performance overlay
    ctx.font = `12px Arial`; ctx.fillStyle = "lime";
    ctx.fillText(`FPS: ${this.fps}`, 50, window.innerHeight - 20);
  },

  drawHelpButton(ctx) {
    if (!this.helpBtn) return;
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(this.helpBtn.x, this.helpBtn.y, this.helpBtn.r, 0, 7); ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = `bold ${20 * this.scale}px Arial`;
    ctx.fillText("?", this.helpBtn.x, this.helpBtn.y);
  },

  drawFeedback(ctx, text, color) {
    ctx.fillStyle = color;
    ctx.font = `bold ${30 * this.scale}px Arial`;
    ctx.fillText(text, this.centerX, this.centerY + 150 * this.scale);
  },

  drawProgressBar(ctx, percentage, color) {
    const width = 200 * this.scale;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(this.centerX - width / 2, this.centerY + 70 * this.scale, width, 15 * this.scale);
    ctx.fillStyle = color;
    ctx.fillRect(this.centerX - width / 2, this.centerY + 70 * this.scale, width * Math.min(1, percentage), 15 * this.scale);
  },

  startDetection() {
    if (this.cameraStarted) return;
    this.cameraStarted = true;
    const video = document.getElementById("input_video");
    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });

    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    hands.onResults((res) => this.processHandResults(res));

    const camera = new Camera(video, { onFrame: async () => await hands.send({ image: video }), width: 1280, height: 720 });
    camera.start();
  },

  processHandResults(results) {
    const canvas = document.getElementById("game_canvas");
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
    const hand = results.multiHandLandmarks[0];
    const { width, height } = canvas.getBoundingClientRect();

    const smooth = (p, x, y) => {
        if(!this.prevPoints) this.prevPoints = {};
        if(!this.prevPoints[p]) return this.prevPoints[p] = {x, y};
        const f = 0.7;
        return this.prevPoints[p] = { x: this.prevPoints[p].x * f + x * (1-f), y: this.prevPoints[p].y * f + y * (1-f) };
    };

    window.fingerPositions = [
        smooth("idx", (1 - hand[8].x) * width, hand[8].y * height),
        smooth("thm", (1 - hand[4].x) * width, hand[4].y * height),
        smooth("wst", (1 - hand[0].x) * width, hand[0].y * height)
    ];
  },

  calculateWristAngle(p1, p2, wrist) {
    const v1 = { x: p1.x - wrist.x, y: p1.y - wrist.y };
    const v2 = { x: p2.x - wrist.x, y: p2.y - wrist.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag = Math.sqrt(v1.x**2 + v1.y**2) * Math.sqrt(v2.x**2 + v2.y**2);
    return mag === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
  },

  getHandOverlapRatio(indexTip, thumbTip, wrist) {
    const margin = 100 * this.scale;
    const left = this.centerX - 200 * this.scale, right = this.centerX + 200 * this.scale;
    const top = this.centerY - margin, bottom = this.centerY + margin;
    const hL = Math.min(indexTip.x, thumbTip.x, wrist.x), hR = Math.max(indexTip.x, thumbTip.x, wrist.x);
    const hT = Math.min(indexTip.y, thumbTip.y, wrist.y), hB = Math.max(indexTip.y, thumbTip.y, wrist.y);
    const overlap = Math.max(0, Math.min(hR, right) - Math.max(hL, left)) * Math.max(0, Math.min(hB, bottom) - Math.max(hT, top));
    return overlap / ((hR - hL) * (hB - hT) || 1);
  }
};