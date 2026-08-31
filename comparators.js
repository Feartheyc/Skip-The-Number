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
  currentLevel: 1, 
  maxGradeUnlocked: 1,
  questionsInLevel: 0,
  targetPromptText: "Aim at the BIGGER number!", 

  winHoldTime: 0,
  winHoldThreshold: 1.0,

  failHoldTime: 0,
  failHoldThreshold: 1.0,

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
  _tutPage: 1,
  _tutOrbT: 0,
  _tutPulseT: 0,
  HOLD_SEC: 3.0,

  gestureGraceTimer: 0,
  GESTURE_GRACE_DELAY: 0.25, 
  _lastDetectedSymbol: "None",

  handResetRequired: false,

  eventsBound: false,
  helpBtn: null,

  difficultyMenuOpen: false,
  gradeBtn: null,
  menuOptions: [
    { grade: 1, label: "Grade 1: Progressive (1-20)", color: "#4CAF50" },
    { grade: 2, label: "Grade 2: Negatives (-50 to 50)", color: "#2196F3" },
    { grade: 3, label: "Grade 3: Like Fractions", color: "#FF9800" },
    { grade: 4, label: "Grade 4: Advanced Fractions", color: "#F44336" }
  ],

  sfx: {
    correct: new Audio('sfx-yc/correct.mp3'),
    wrong: new Audio('sfx-yc/wrong.mp3'),
    tick: new Audio('sfx-yc/tick.mp3'),
    cheer: new Audio('sfx-yc/cheer.mp3')
  },

  uiCache: null,
  fps: 0,
  frameCounter: 0,
  fpsTimer: 0,

  _lastFingerUpdateTime: 0,
  _lastHandDetectedTime: 0,
  FINGER_UPDATE_INTERVAL: 33, 
  _cachedLandmarks: null,

  comboTimer: 0,
  COMBO_MAX_TIME: 5.0, 

  playSFX(name, vol = 0.5) {
    const s = this.sfx[name];
    if (s) {
      s.currentTime = 0;
      s.volume = vol;
      s.play().catch(() => { });
    }
  },

  init() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.onResize(w, h);
    this.score = 0;
    this.combo = 0;
    this.currentLevel = 1; 
    this.questionsInLevel = 0;
    this.running = true;
    this.showTutorial = true;
    this.tutorialHoldTime = 0;
    this._tutPage = 1; 
    this.difficultyMenuOpen = false;
    this.confetti = [];
    this.popups = [];
    this.comboTimer = 0; 
    this.gestureGraceTimer = 0;
    this._lastDetectedSymbol = "None";
    this.handResetRequired = false;
    this._cachedLandmarks = null;
    window.fingerPositions = null;

    if (!this.eventsBound) {
      this.eventsBound = true;

      window.addEventListener('keydown', (e) => {
        // Cheat key: Press '1' to skip to the next level
        if (e.key === '1') {
          this.currentLevel++;
          this.questionsInLevel = 0;
          
          this.popups.push({ 
            text: `CHEAT: LEVEL ${this.currentLevel}!`, 
            x: this.centerX, 
            y: this.centerY - 140 * this.scale, 
            vy: -15, 
            life: 1.5, 
            color: "#FFD700", 
            timestamp: performance.now() 
          });

          this.spawnNumbers();
        }

        if (e.key === ' ' && this.showTutorial) {
          this.showTutorial = false;
          this.spawnNumbers();
        }
      });

      window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
          this.reset();
        }, 200);
      });




      const canvas = document.getElementById("game_canvas") || document.querySelector("canvas");
      if (canvas) {
        canvas.addEventListener('pointerdown', (e) => {
          const rect = canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const gDx = mouseX - this.gradeBtn.x;
          const gDy = mouseY - this.gradeBtn.y;
          if (gDx * gDx + gDy * gDy <= (this.gradeBtn.r + 20) ** 2) {
            this.difficultyMenuOpen = !this.difficultyMenuOpen;
            return;
          }

          if (this.difficultyMenuOpen) {
            this.menuOptions.forEach((opt, i) => {
              const btnW = 380 * this.scale;
              const btnH = 55 * this.scale;
              const x = this.centerX - btnW / 2;
              const y = this.centerY - 90 * this.scale + (i * 75 * this.scale);
              if (mouseX >= x && mouseX <= x + btnW && mouseY >= y && mouseY <= y + btnH) {
                if (opt.grade <= this.maxGradeUnlocked) {
                  this.setDifficulty(opt.grade);
                  this.difficultyMenuOpen = false;
                } else {
                  this.playSFX('wrong', 0.4);
                  this.popups.push({ 
                    text: `Grade ${opt.grade} is Locked! Beat Grade ${opt.grade - 1} Level 5 first.`, 
                    x: this.centerX, 
                    y: this.centerY + 210 * this.scale, 
                    vy: 0, 
                    life: 1.5, 
                    color: "#FF4444", 
                    isMilestone: true,
                    timestamp: performance.now() 
                  });
                }
              }
            });
            return;
          }

          if (this.helpBtn) {
            const dx = mouseX - this.helpBtn.x;
            const dy = mouseY - this.helpBtn.y;
            if (dx * dx + dy * dy <= (this.helpBtn.r + 15) ** 2) {
              this.showTutorial = true;
              this.tutorialHoldTime = 0;
              this._tutPage = 1;
              return;
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

    this.startDetection();
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

    this.gradeBtn = { x: 140 * this.scale, y: 50 * this.scale, r: 35 * this.scale };
    this.helpBtn = { x: width - 125 * this.scale, y: 50 * this.scale, r: 22 * this.scale };
    this.preRenderUI();
  },

  preRenderUI() {
    this.uiCache = document.createElement('canvas');
    this.uiCache.width = window.innerWidth;
    this.uiCache.height = window.innerHeight;
  },

  setDifficulty(grade) {
    this.currentGrade = grade;
    this.currentLevel = 1; 
    this.questionsInLevel = 0;
    this.score = 0;
    this.combo = 0;
    this.onResize(window.innerWidth, window.innerHeight);
    this.spawnNumbers();
  },

  getBrightColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 85%, 55%)`;
  },

  spawnNumbers() {
    this.gameState = "PLAYING";
    this.winHoldTime = 0;
    this.failHoldTime = 0;
    this.detectedSymbol = "None";
    this.gestureGraceTimer = 0;
    this.confetti = [];
    this.handResetRequired = true;

    // Level 3 is the mixed barrage (shorter hold threshold & faster combo timer)
    if (this.currentLevel === 3) {
      this.winHoldThreshold = 0.6;
      this.COMBO_MAX_TIME = 3.0;
    } else {
      this.winHoldThreshold = 1.0;
      this.COMBO_MAX_TIME = 5.0;
    }

    // Determine gesture prompt based on levels
    let askBigger = true;
    if (this.currentLevel === 1) {
      askBigger = true; // Level 1: Hand gesture at BIGGER number
    } else if (this.currentLevel === 2) {
      askBigger = false; // Level 2: Point at SMALLER number
    } else {
      askBigger = Math.random() > 0.5; // Level 3+: Mixed Barrage
    }

    if (this.currentLevel === 3) {
      this.targetPromptText = askBigger ? "⚡ BARRAGE: Aim at BIGGER!" : "⚡ BARRAGE: Point at SMALLER!";
    } else {
      this.targetPromptText = askBigger ? "Aim at the BIGGER number!" : "Point finger at the SMALLER number!";
    }

    // Progression mechanics based on levels:
    // Level 1-3: Base numbers (1 to 20)
    // Level 4-5: Number range increases (21 to 100)
    // Level 6-9: Negative numbers (-50 to -1)
    // Level 10: Like Fractions (same denominator, max number 20)
    // Level 11+: Unlike Fractions (different denominators, max number 20)
    if (this.currentLevel <= 3) {
      this.spawnIntegers(1, 20);
    } else if (this.currentLevel <= 5) {
      this.spawnIntegers(21, 100);
    } else if (this.currentLevel <= 9) {
      this.spawnIntegers(-50, -1);
    } else if (this.currentLevel === 10) {
      this.spawnLikeFractions(20);
    } else {
      this.spawnIrregularFractions(20);
    }

    this.leftColor = this.getBrightColor();
    this.rightColor = this.getBrightColor();
    this.fadeAlpha = 0;
    this.popScale = 0.5;
  },
// Updated spawnNumbers method according to level-only progression
  spawnNumbers() {
    this.gameState = "PLAYING";
    this.winHoldTime = 0;
    this.failHoldTime = 0;
    this.detectedSymbol = "None";
    this.gestureGraceTimer = 0;
    this.confetti = [];
    this.handResetRequired = true;

    // Level 3 is the mixed barrage (shorter hold threshold & faster combo timer)
    if (this.currentLevel === 3) {
      this.winHoldThreshold = 0.6;
      this.COMBO_MAX_TIME = 3.0;
    } else {
      this.winHoldThreshold = 1.0;
      this.COMBO_MAX_TIME = 5.0;
    }

    // Determine prompt based on level
    let askBigger = true;
    if (this.currentLevel === 1) {
      askBigger = true; // Level 1: Aim at BIGGER
    } else if (this.currentLevel === 2) {
      askBigger = false; // Level 2: Point at SMALLER
    } else {
      askBigger = Math.random() > 0.5; // Level 3+: Mixed Barrage
    }

    if (this.currentLevel === 3) {
      this.targetPromptText = askBigger ? "⚡ BARRAGE: Aim at BIGGER!" : "⚡ BARRAGE: Point at SMALLER!";
    } else {
      this.targetPromptText = askBigger ? "Aim at the BIGGER number!" : "Point finger at the SMALLER number!";
    }

    // Progression mechanics based strictly on Levels:
    // Level 1-3: Low numbers (1 to 20)
    // Level 4-5: Number range increases (21 to 100)
    // Level 6-9: Negative numbers (-50 to -1)
    // Level 10: Like Fractions (same denominator, numbers under 20)
    // Level 11+: Unlike Fractions (different denominators, numbers under 20)
    if (this.currentLevel <= 3) {
      this.spawnIntegers(1, 20);
    } else if (this.currentLevel <= 5) {
      this.spawnIntegers(21, 100);
    } else if (this.currentLevel <= 9) {
      this.spawnIntegers(-50, -1);
    } else if (this.currentLevel === 10) {
      this.spawnLikeFractions(20);
    } else {
      this.spawnIrregularFractions(20);
    }

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

    const isBiggerTarget = this.targetPromptText.includes("BIGGER");
    if (isBiggerTarget) {
      this.currentRelation = n1 > n2 ? ">" : "<";
    } else {
      this.currentRelation = n1 < n2 ? ">" : "<";
    }
  },

  spawnLikeFractions(maxNum = 20) {
    const den = Math.floor(Math.random() * 8) + 2; // Denominator 2-9
    let n1 = Math.floor(Math.random() * maxNum) + 1;
    let n2 = Math.floor(Math.random() * maxNum) + 1;
    while (n1 === n2) n2 = Math.floor(Math.random() * maxNum) + 1;

    this.leftValue = n1 / den; this.rightValue = n2 / den;
    this.leftText = `${n1}/${den}`; this.rightText = `${n2}/${den}`;
    
    const isBiggerTarget = this.targetPromptText.includes("BIGGER");
    if (isBiggerTarget) {
      this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
    } else {
      this.currentRelation = this.leftValue < this.rightValue ? ">" : "<";
    }
  },
  spawnIrregularFractions(maxNum = 20) {
    const easyDenoms = [2, 3, 4, 5, 6, 8, 10];
    let d1 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    let d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];
    while (d1 === d2) d2 = easyDenoms[Math.floor(Math.random() * easyDenoms.length)];

    let n1 = Math.floor(Math.random() * Math.min(d1 * 2, maxNum)) + 1;
    let n2 = Math.floor(Math.random() * Math.min(d2 * 2, maxNum)) + 1;
    
    this.leftValue = n1 / d1; this.rightValue = n2 / d2;
    this.leftText = `${n1}/${d1}`; this.rightText = `${n2}/${d2}`;
    
    const isBiggerTarget = this.targetPromptText.includes("BIGGER");
    if (isBiggerTarget) {
      this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
    } else {
      this.currentRelation = this.leftValue < this.rightValue ? ">" : "<";
    }
  },

  drawSciFiCameraOverlay(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.save();

    const innerRadius = Math.min(w, h) * 0.22;
    const outerRadius = Math.max(w, h) * 0.55;

    const vignette = ctx.createRadialGradient(
      this.centerX, this.centerY, innerRadius,
      this.centerX, this.centerY, outerRadius
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(0.45, "rgba(0, 0, 0, 0.45)");
    vignette.addColorStop(0.85, "rgba(0, 0, 0, 0.88)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.96)");

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  },

  update(ctx, landmarks, dt = 1 / 60) {
    const isPaused = typeof PauseArea !== 'undefined' && PauseArea.isPaused;
    if (isPaused) dt = 0;

    this.frameCounter++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) { this.fps = this.frameCounter; this.frameCounter = 0; this.fpsTimer = 0; }

    const now = performance.now();
    if (now - this._lastHandDetectedTime > 200) {
      this._cachedLandmarks = null;
      window.fingerPositions = null;
    } else if (now - this._lastFingerUpdateTime >= this.FINGER_UPDATE_INTERVAL) {
      this._lastFingerUpdateTime = now;
      this._cachedLandmarks = (landmarks && landmarks.length >= 3) ? landmarks : null;
    }

    const activeLandmarks = this._cachedLandmarks;
    ctx.save();

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      ctx.translate((Math.random() - 0.5) * this.shakeMag, (Math.random() - 0.5) * this.shakeMag);
    }

    this.drawSciFiCameraOverlay(ctx);

    if (this.combo > 0 && this.gameState === "PLAYING" && !this.showTutorial && !this.difficultyMenuOpen) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
        this.playSFX('wrong', 0.25); 
        this.popups.push({ text: "COMBO RESET!", x: this.centerX, y: this.centerY + 175 * this.scale, vy: 10, life: 1.0, color: "#FF9800", timestamp: performance.now() });
      }
    }

    this.fadeAlpha = Math.min(1, this.fadeAlpha + dt * this.fadeSpeed);
    this.popScale = Math.min(1, this.popScale + dt * this.popSpeed);

    this.drawUI(ctx);
    this.drawPopups(ctx, dt);
    this.drawParticles(ctx, dt);
    this.drawConfetti(ctx, dt); 

    const isPlaying = !this.showTutorial && !this.difficultyMenuOpen && this.gameState === "PLAYING";

    if (this.gameState === "PLAYING" || this.showTutorial) {
      if (!activeLandmarks || activeLandmarks.length < 3) {
        this.handResetRequired = false;
        if (isPlaying) this.drawFeedback(ctx, "Show One Hand!", "orange");
        else if (this.showTutorial) this.tutorialHoldTime = Math.max(0, this.tutorialHoldTime - dt);
      } else {
        const [indexTip, thumbTip, wrist] = activeLandmarks;
        this.drawArmSymbol(ctx, indexTip, thumbTip, wrist);

        if (this.showTutorial) {
          this.tutorialHoldTime += dt;
          if (this.tutorialHoldTime >= this.HOLD_SEC) {
            if (this._tutPage === 1) {
              this._tutPage = 2;
              this.tutorialHoldTime = 0;
            } else {
              this._tutPage = 1;
              this.showTutorial = false;
              this.spawnNumbers();
            }
          }
        } else if (isPlaying) {
          this.checkPose(ctx, indexTip, thumbTip, wrist, dt);
        }
      }
    }

    if (this.showTutorial) this.drawTutorialWindow(ctx, activeLandmarks);
    if (this.difficultyMenuOpen) this.drawDifficultyMenu(ctx);

    ctx.restore();

    if (typeof PauseArea !== 'undefined') {
      PauseArea.drawPauseIcon(ctx);
      if (isPaused) PauseArea.draw(ctx);
    }
  },

  drawDifficultyMenu(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.textAlign = "center"; ctx.fillStyle = "white";
    ctx.font = `bold ${32 * this.scale}px Arial`;
    ctx.fillText("Select Difficulty", this.centerX, this.centerY - 160 * this.scale);

    this.menuOptions.forEach((opt, i) => {
      const btnW = 380 * this.scale; const btnH = 55 * this.scale;
      const x = this.centerX - btnW / 2;
      const y = this.centerY - 90 * this.scale + (i * 75 * this.scale);

      const isUnlocked = opt.grade <= this.maxGradeUnlocked;
      ctx.fillStyle = isUnlocked ? opt.color : "#444444"; 
      ctx.beginPath(); ctx.roundRect(x, y, btnW, btnH, 12 * this.scale); ctx.fill();

      if (this.currentGrade === opt.grade) {
        ctx.strokeStyle = "white"; ctx.lineWidth = 4 * this.scale; ctx.stroke();
      } else if (!isUnlocked) {
        ctx.strokeStyle = "#222"; ctx.lineWidth = 2 * this.scale; ctx.stroke();
      }

      ctx.fillStyle = isUnlocked ? "white" : "#AAAAAA"; 
      ctx.font = `bold ${20 * this.scale}px Arial`;
      const labelText = isUnlocked ? opt.label : `🔒 ${opt.label}`;
      ctx.fillText(labelText, this.centerX, y + 35 * this.scale);
    });
  },

  drawTutorialWindow(ctx, landmarks) {
    this._tutOrbT += 0.016;
    this._tutPulseT += 0.03;

    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 10, 0.88)";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const boxW = 850 * this.scale;
    const boxH = 540 * this.scale;
    const boxX = this.centerX - boxW / 2;
    const boxY = this.centerY - boxH / 2;

    ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 25 * this.scale); ctx.fill();
    ctx.strokeStyle = "#00FFCC"; ctx.lineWidth = 4 * this.scale; ctx.stroke();

    ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${38 * this.scale}px Arial`;
    ctx.fillText("COMPARATORS: HOW TO PLAY!", this.centerX, boxY + 35 * this.scale);

    ctx.font = `${14 * this.scale}px Arial`; ctx.fillStyle = "rgba(240,244,255,0.6)";
    ctx.fillText(`Page ${this._tutPage} of 2 — ${this._tutPage === 1 ? 'Gameplay & Gestures' : 'Timers & Multipliers'}`, this.centerX, boxY + 80 * this.scale);

    const visX = boxX + 40 * this.scale, visY = boxY + 120 * this.scale;
    const visW = 320 * this.scale, visH = 260 * this.scale;
    ctx.fillStyle = "rgba(8,16,36,0.68)"; ctx.beginPath(); ctx.roundRect(visX, visY, visW, visH, 15 * this.scale); ctx.fill();
    ctx.strokeStyle = "rgba(0,255,204,0.15)"; ctx.stroke();

    this._drawTutSandboxDiagram(ctx, visX, visY, visW, visH);

    const rulesX = boxX + 390 * this.scale, rulesY = boxY + 120 * this.scale;
    const rulesW = boxW - 430 * this.scale, rowH = 36 * this.scale;

    const contentRows = [];
    if (this._tutPage === 1) {
      contentRows.push(
        { isHeader: true, text: "🎮 Challenge Rules & Gestures" },
        { icon: "👀", text: "Read the prompt at the bottom of screen." },
        { icon: "✌️", text: "Bigger number: Make a wide 'V' crocodile mouth." },
        { icon: "☝️", text: "Smaller number: Point directly at the card." },
        { icon: "🖐️", text: "LOWER HAND after answering to start next Q!" }
      );
    } else {
      contentRows.push(
        { isHeader: true, text: "🔥 Timers & Multiplier Meter" },
        { icon: "⚡", text: "Combo Timer (5s): Starts as question appears." },
        { icon: "📈", text: "Answer fast to stack score multipliers!" },
        { icon: "📉", text: "If Combo Timer drains to 0, multiplier resets." },
        { icon: "🎯", text: "Response Bar (1s): Fills as you hold gesture." },
        { icon: "💥", text: "Level 5 Question Barrage: Faster rapid-fire rounds!" }
      );
    }

    contentRows.forEach((item, i) => {
      const currentY = rulesY + (i * rowH);
      if (item.isHeader) {
        ctx.font = `bold ${16 * this.scale}px Arial`; ctx.fillStyle = "#00FFCC";
        ctx.textAlign = "left"; ctx.fillText(item.text, rulesX, currentY + 6 * this.scale);
      } else {
        ctx.fillStyle = "rgba(25,50,80,0.3)"; ctx.beginPath(); ctx.roundRect(rulesX, currentY, rulesW, rowH - 4 * this.scale, 6 * this.scale); ctx.fill();
        ctx.font = `${14 * this.scale}px Arial`; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(item.icon, rulesX + 18 * this.scale, currentY + 8 * this.scale);
        ctx.font = `${12 * this.scale}px Arial`; ctx.textAlign = "left"; ctx.fillStyle = "rgba(240,244,255,0.9)"; ctx.fillText(item.text, rulesX + 38 * this.scale, currentY + 8 * this.scale);
      }
    });

    const holdY = boxY + boxH - 75 * this.scale;
    ctx.textAlign = "center";
    if (landmarks && landmarks.length > 0) {
      const pct = Math.round((this.tutorialHoldTime / this.HOLD_SEC) * 100);
      ctx.font = `bold ${16 * this.scale}px Arial`; ctx.fillStyle = "#00FFCC";
      ctx.fillText(this._tutPage === 1 ? `Loading Page 2... ${pct}%` : `Launching Game... ${pct}%`, this.centerX, holdY);

      const barW = 300 * this.scale, barH = 8 * this.scale;
      const barX = this.centerX - barW / 2;
      ctx.fillStyle = "rgba(40,70,100,0.5)"; ctx.beginPath(); ctx.roundRect(barX, holdY + 15 * this.scale, barW, barH, 4 * this.scale); ctx.fill();
      ctx.fillStyle = "#00FFCC"; ctx.beginPath(); ctx.roundRect(barX, holdY + 15 * this.scale, barW * (this.tutorialHoldTime / this.HOLD_SEC), barH, 4 * this.scale); ctx.fill();
    } else {
      const blink = Math.sin(this._tutPulseT * 5) > 0;
      ctx.font = `bold ${16 * this.scale}px Arial`; ctx.fillStyle = blink ? "#FFD700" : "rgba(255,215,0,0.5)";
      ctx.fillText("☝ Hold your hand up in camera view to proceed", this.centerX, holdY);
      ctx.font = `${12 * this.scale}px Arial`; ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText(this._tutPage === 1 ? "Keep hand steady for 3s to view Page 2" : "Keep hand steady for 3s to Enter Game", this.centerX, holdY + 22 * this.scale);
    }
    ctx.restore();
  },

  _drawTutSandboxDiagram(ctx, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2;
    
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(cx - 100 * this.scale, cy - 60 * this.scale, 60 * this.scale, 50 * this.scale);
    ctx.fillRect(cx + 40 * this.scale, cy - 60 * this.scale, 60 * this.scale, 50 * this.scale);
    
    ctx.font = `bold ${22 * this.scale}px Arial`; ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.textAlign = "center"; ctx.fillText("15", cx - 70 * this.scale, cy - 28 * this.scale);
    ctx.fillText("3", cx + 70 * this.scale, cy - 28 * this.scale);

    const baseDrawingY = cy + 45 * this.scale;
    const waveOffset = Math.sin(this._tutOrbT * 2) * 25 * this.scale;

    if (this._tutPage === 1) {
      ctx.strokeStyle = "#00FFCC"; ctx.lineWidth = 6 * this.scale; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 50 * this.scale + waveOffset, baseDrawingY - 15 * this.scale);
      ctx.lineTo(cx + waveOffset, baseDrawingY + 45 * this.scale);
      ctx.lineTo(cx - 10 * this.scale + waveOffset, baseDrawingY - 20 * this.scale);
      ctx.stroke();

      ctx.font = `bold ${12 * this.scale}px Arial`; ctx.fillStyle = "#00FFCC";
      ctx.fillText("Wide V = Bigger / Point = Smaller", cx, baseDrawingY + 75 * this.scale);
    } else {
      const barW = 160 * this.scale, barH = 8 * this.scale;
      const bx = cx - barW / 2, by = baseDrawingY + 20 * this.scale;
      const ratio = Math.abs(Math.sin(this._tutOrbT * 1.5));

      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = `hsl(${ratio * 40}, 100%, 50%)`; ctx.fillRect(bx, by, barW * ratio, barH);

      ctx.font = `bold ${14 * this.scale}px Arial`; ctx.fillStyle = "#FF6600";
      ctx.fillText(`Combo x4 (Draining)`, cx, baseDrawingY + 5 * this.scale);
      
      ctx.fillStyle = "#00FF66"; ctx.fillRect(cx - 45 * this.scale, baseDrawingY - 10 * this.scale + waveOffset * 0.3, 6 * this.scale, 6 * this.scale);
      ctx.fillStyle = "#FFD700"; ctx.fillRect(cx + 45 * this.scale, baseDrawingY - 15 * this.scale - waveOffset * 0.2, 5 * this.scale, 8 * this.scale);
    }
  },

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    ctx.save(); const words = text.split(' '); let line = ''; ctx.textBaseline = "top";
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line, x, y); line = words[n] + ' '; y += lineHeight;
      } else { line = testLine; }
    }
    ctx.fillText(line, x, y); ctx.restore();
  },

  checkPose(ctx, indexTip, thumbTip, wrist, dt) {
    const isSmallerNumberChallenge = this.targetPromptText.includes("SMALLER");
    
    if (!isSmallerNumberChallenge) {
      const angle = this.calculateWristAngle(indexTip, thumbTip, wrist);
      if (angle < 20) { this.resetHolds(dt); return; }
      
      const overlap = this.getHandOverlapRatio(indexTip, thumbTip, wrist);
      if (overlap < 0.5) { this.resetHolds(dt); return; }
    }

    let targetDetected = "Center";
    if (isSmallerNumberChallenge) {
      const deadzone = 40 * this.scale;
      if (indexTip.x < this.centerX - deadzone) {
        targetDetected = ">";
      } else if (indexTip.x > this.centerX + deadzone) {
        targetDetected = "<";
      }
    } else {
      const tipsX = (indexTip.x + thumbTip.x) / 2;
      const threshold = 30 * this.scale;

      if (tipsX < wrist.x - threshold) {
        targetDetected = ">";
      } else if (tipsX > wrist.x + threshold) {
        targetDetected = "<";
      }
    }

    if (this.handResetRequired) {
      if (targetDetected === "Center") {
        this.handResetRequired = false;
      } else {
        this.resetHolds(dt);
        this.drawFeedback(ctx, "Lower hand / re-aim to start next Q!", "orange");
        return;
      }
    }

    this.detectedSymbol = targetDetected;

    if (this.detectedSymbol !== this._lastDetectedSymbol) {
      this._lastDetectedSymbol = this.detectedSymbol;
      this.gestureGraceTimer = 0; 
    }

    if (this.detectedSymbol === "None" || this.detectedSymbol === "Center") {
      this.resetHolds(dt);
      return;
    }

    this.gestureGraceTimer += dt;
    if (this.gestureGraceTimer < this.GESTURE_GRACE_DELAY) {
      return; 
    }

    const isCorrect = this.detectedSymbol === this.currentRelation;
    const isWrong = this.detectedSymbol !== "None" && this.detectedSymbol !== this.currentRelation;

    if (isCorrect) {
      if (Math.floor(this.winHoldTime * 10) !== Math.floor((this.winHoldTime + dt) * 10)) { this.playSFX('tick', 0.2); }
      this.winHoldTime += dt; this.failHoldTime = 0;
      this.drawProgressBar(ctx, this.winHoldTime / this.winHoldThreshold, "#00FFCC");
      if (this.winHoldTime >= this.winHoldThreshold) this.handleSuccess();
    } else if (isWrong) {
      this.failHoldTime += dt; this.winHoldTime = 0;
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

  // Level Progression Logic without Grades
  handleSuccess() {
    this.gameState = "SUCCESS";
    this.handResetRequired = true;
    
    const multiplier = Math.min(5, Math.floor(this.combo / 2) + 1);
    const pointsGained = 10 * multiplier;
    this.score += pointsGained;
    this.combo++;
    this.questionsInLevel++;

    this.comboTimer = this.COMBO_MAX_TIME;
    this.popups = this.popups.filter(p => p.color !== "#FF4444");

    for (let i = 0; i < 35; i++) {
      this.confetti.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * -60,
        w: (Math.random() * 8 + 4) * this.scale,
        h: (Math.random() * 12 + 6) * this.scale,
        vy: Math.random() * 150 + 100,
        vx: (Math.random() - 0.5) * 60,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10,
        color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`
      });
    }

    const requiredQuestions = (this.currentLevel === 3) ? 10 : 5; 

    if (this.questionsInLevel >= requiredQuestions) {
      this.questionsInLevel = 0;
      this.currentLevel++;
      
      const levelMsg = (this.currentLevel === 3) ? "⚡ LEVEL 3: QUESTION BARRAGE!" : `LEVEL ${this.currentLevel}!`;
      this.popups.push({ 
        text: levelMsg, 
        x: this.centerX, 
        y: this.centerY - 140 * this.scale, 
        vy: -15, 
        life: 2.0, 
        color: "#FFFF00", 
        timestamp: performance.now() 
      });
    }

    if (this.combo > 0 && this.combo % 5 === 0) {
      this.playSFX('cheer', 0.7);
    } else {
      this.playSFX('correct', 0.5);
    }

    this.popups.push({ text: `+${pointsGained}!`, x: this.centerX, y: this.centerY - 40 * this.scale, vy: -20, life: 1.2, color: "#00FF22", timestamp: performance.now() });

    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: this.centerX, y: this.centerY,
        vx: (Math.random() - 0.5) * 400, vy: (Math.random() - 0.5) * 400,
        life: 1, color: "#00FF22"
      });
    }
    setTimeout(() => this.spawnNumbers(), 800);
  },

  handleFail() {
    this.playSFX('wrong', 0.5);
    this.gameState = "GAME_OVER";
    this.handResetRequired = true;
    this.score = Math.max(0, this.score - 5);
    this.combo = 0;
    this.comboTimer = 0; 
    this.shakeTime = 0.35; 
    this.shakeMag = 14 * this.scale;
    this.confetti = [];

    this.popups.push({ text: "Wrong!", x: this.centerX, y: this.centerY - 40 * this.scale, vy: 40, life: 1, color: "#FF4444", timestamp: performance.now() });
    setTimeout(() => this.spawnNumbers(), 1000);
  },

  drawParticles(ctx, dt) {
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 * this.scale, 0, 7); ctx.fill();
    });
    ctx.restore(); this.particles = this.particles.filter(p => p.life > 0);
  },

  drawConfetti(ctx, dt) {
    ctx.save();
    this.confetti.forEach(c => {
      c.y += c.vy * dt; c.x += c.vx * dt; c.rotation += c.rotSpeed * dt;
      ctx.fillStyle = c.color;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rotation);
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
    });
    ctx.restore(); this.confetti = this.confetti.filter(c => c.y < window.innerHeight + 20);
  },

  drawPopups(ctx, dt) {
    const now = performance.now();
    this.popups.forEach(p => {
      const elapsed = now - p.timestamp;
      let targetAlpha = 1.0;
      if (elapsed > 500) { targetAlpha = Math.max(0, 1.0 - (elapsed - 500) / 400); }
      ctx.globalAlpha = targetAlpha;
      p.life = targetAlpha; 

      if (p.isMilestone) ctx.font = `bold ${28 * this.scale}px Arial`; 
      else ctx.font = `bold ${44 * this.scale}px Arial`;
      
      ctx.fillStyle = p.color; ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1; this.popups = this.popups.filter(p => p.life > 0);
  },

  drawArmSymbol(ctx, indexTip, thumbTip, wrist) {
    if (this.showTutorial) return; 

    const isSmallerNumberChallenge = this.targetPromptText.includes("SMALLER");

    let color = "#00FFCC"; 

    if (this.gameState === "SUCCESS") {
      color = "#00FF22"; 
    } else if (this.gameState === "GAME_OVER") {
      color = "#FF3333"; 
    }

    ctx.strokeStyle = color; ctx.lineWidth = 10 * this.scale; ctx.lineCap = "round";
    ctx.beginPath();
    
    if (isSmallerNumberChallenge) {
      ctx.moveTo(indexTip.x, indexTip.y); ctx.lineTo(wrist.x, wrist.y); ctx.stroke();
    } else {
      const angle = this.calculateWristAngle(indexTip, thumbTip, wrist);
      if (angle < 20) return;
      ctx.moveTo(indexTip.x, indexTip.y); ctx.lineTo(wrist.x, wrist.y); ctx.lineTo(thumbTip.x, thumbTip.y); ctx.stroke();
    }
  },

  // Updated UI pill removing Grade labels
  drawUI(ctx) {
    const topY = 28 * this.scale;

    const drawPill = (x, y, w, h, bg = "rgba(20, 20, 20, 0.75)", stroke = "rgba(255, 255, 255, 0.15)") => {
      ctx.fillStyle = bg;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2 * this.scale;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
      else ctx.fillRect(x, y, w, h);
      ctx.fill();
      ctx.stroke();
    };

    const subLabel = `Level ${this.currentLevel}`;
    ctx.font = `bold ${18 * this.scale}px Arial`;
    const levelW = ctx.measureText(subLabel).width + 36 * this.scale;
    const levelH = 44 * this.scale;
    const levelX = 25 * this.scale;
    drawPill(levelX, topY, levelW, levelH);
    ctx.fillStyle = "#00FFCC";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(subLabel, levelX + levelW / 2, topY + levelH / 2);

    const scoreText = `SCORE: ${this.score}`;
    ctx.font = `bold ${22 * this.scale}px Arial`;
    const scoreW = ctx.measureText(scoreText).width + 48 * this.scale;
    const scoreH = 48 * this.scale;
    const scoreX = this.centerX - scoreW / 2;
    drawPill(scoreX, topY, scoreW, scoreH, "rgba(15, 15, 15, 0.82)", "#FFD700");
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(scoreText, this.centerX, topY + scoreH / 2);

    if (this.combo >= 2) {
      const comboText = `x${this.combo}`;
      ctx.font = `bold ${16 * this.scale}px Arial`;
      const comboW = ctx.measureText(comboText).width + 24 * this.scale;
      const comboH = 32 * this.scale;
      const comboX = scoreX + scoreW + 10 * this.scale;
      const comboY = topY + (scoreH - comboH) / 2;
      drawPill(comboX, comboY, comboW, comboH, "rgba(255, 102, 0, 0.9)", "rgba(255, 255, 255, 0.4)");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(comboText, comboX + comboW / 2, comboY + comboH / 2);
    }

    if (this.combo > 0 && this.comboTimer > 0) {
      const barW = scoreW - 12 * this.scale;
      const barH = 5 * this.scale;
      const barX = this.centerX - barW / 2;
      const barY = topY + scoreH + 6 * this.scale;
      const ratio = Math.max(0, Math.min(1, this.comboTimer / this.COMBO_MAX_TIME));

      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 3 * this.scale);
      else ctx.fillRect(barX, barY, barW, barH);
      ctx.fill();

      ctx.fillStyle = `hsl(${ratio * 45}, 100%, 50%)`;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, barY, barW * ratio, barH, 3 * this.scale);
      else ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.fill();
    }

    ctx.textAlign = "center";
    const offsetX = 220 * this.scale;
    const cardW = 180 * this.scale * this.popScale; 
    const cardH = 160 * this.scale * this.popScale;

    ctx.globalAlpha = this.fadeAlpha;
    const drawCard = (x, color, text) => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; 
      ctx.beginPath(); 
      ctx.roundRect(x - cardW / 2 + 5, this.centerY - cardH / 2 + 8, cardW, cardH, 15 * this.scale); 
      ctx.fill();

      ctx.fillStyle = color; 
      ctx.beginPath(); 
      ctx.roundRect(x - cardW / 2, this.centerY - cardH / 2, cardW, cardH, 15 * this.scale); 
      ctx.fill();

      ctx.font = `bold ${64 * this.scale * this.popScale}px Arial`; 
      ctx.fillStyle = "white"; 
      ctx.fillText(text, x, this.centerY);
    };

    drawCard(this.centerX - offsetX, this.leftColor, this.leftText);
    drawCard(this.centerX + offsetX, this.rightColor, this.rightText);

    ctx.globalAlpha = 1;

    ctx.font = `bold ${24 * this.scale}px Arial`; 
    ctx.fillStyle = (this.currentLevel === 3) ? "#FFCC00" : "#FFFFFF";
    ctx.shadowBlur = 8; 
    ctx.shadowColor = "#000";
    ctx.fillText(this.targetPromptText, this.centerX, this.centerY + 140 * this.scale);
    ctx.shadowBlur = 0;

    this.drawHelpPillButton(ctx, topY);

    ctx.font = `12px Arial`; 
    ctx.fillStyle = "rgba(0, 255, 0, 0.3)"; 
    ctx.textAlign = "left";
    ctx.fillText(`FPS: ${this.fps}`, 20, window.innerHeight - 20);
  },

  drawHelpPillButton(ctx, topY) {
    const itemW = 44 * this.scale;
    const pillX = window.innerWidth - itemW - 85 * this.scale;

    ctx.fillStyle = "rgba(20, 20, 20, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2 * this.scale;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, topY, itemW, itemW, itemW / 2);
    else ctx.fillRect(pillX, topY, itemW, itemW);
    ctx.fill();
    ctx.stroke();

    const helpX = pillX + itemW / 2;
    const helpY = topY + itemW / 2;
    this.helpBtn = { x: helpX, y: helpY, r: itemW / 2 };

    ctx.fillStyle = "white";
    ctx.font = `bold ${20 * this.scale}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", helpX, helpY);
  },

  drawFeedback(ctx, text, color) {
    ctx.fillStyle = color; ctx.font = `bold ${24 * this.scale}px Arial`; ctx.textAlign = "center";
    ctx.fillText(text, this.centerX, this.centerY + 190 * this.scale);
  },

  drawProgressBar(ctx, percentage, color) {
    const width = 240 * this.scale; const barY = this.centerY + 100 * this.scale;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(this.centerX - width / 2, barY, width, 12 * this.scale);
    ctx.fillStyle = color; ctx.fillRect(this.centerX - width / 2, barY, width * Math.min(1, percentage), 12 * this.scale);
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
    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this._cachedLandmarks = null;
      window.fingerPositions = null;
      return;
    }

    const hand = results.multiHandLandmarks[0];
    this._lastHandDetectedTime = performance.now();
    
    window.isLeftHand = results.multiHandedness && results.multiHandedness[0].label === "Left";

    const { width, height } = canvas.getBoundingClientRect();
    const smooth = (p, x, y) => {
      if (!this.prevPoints) this.prevPoints = {};
      if (!this.prevPoints[p]) return this.prevPoints[p] = { x, y };
      const f = 0.7; return this.prevPoints[p] = { x: this.prevPoints[p].x * f + x * (1 - f), y: this.prevPoints[p].y * f + y * (1 - f) };
    };
    window.fingerPositions = [
      smooth("idx", (1 - hand[8].x) * width, hand[8].y * height),
      smooth("thm", (1 - hand[4].x) * width, hand[4].y * height),
      smooth("wst", (1 - hand[0].x) * width, hand[0].y * height)
    ];
  },

  calculateWristAngle(p1, p2, wrist) {
    const v1 = { x: p1.x - wrist.x, y: p1.y - wrist.y }; const v2 = { x: p2.x - wrist.x, y: p2.y - wrist.y };
    const dot = v1.x * v2.x + v1.y * v2.y; const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2);
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