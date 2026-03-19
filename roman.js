const Game5 = {
  running: false,
  score: 0,
  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  playWidth: 0,
  playHeight: 0,
  
  mode: "TRACE", 
  currentLevel: 0,
  
  tracePoints: [], 
  activeStrokeIndex: 0, 
  currentStrokeProgress: 0, 

  freehandStrokes: [], 
  currentStroke: null,
  submitTimer: 0,      
  shakeTimer: 0,       
  
  particles: [],
  isDrawing: false,
  cursor: { x: 0, y: 0 },
  cursorColor: "white", 

  levelCompleteTimer: 0,
  levelFailedTimer: 0, 
  listenersAdded: false,

  tfModel: null,
  isEvaluating: false, 

  isMenuOpen: false,
  
  // ⭐ NEW: Tier Progression System
  unlockedUntilIndex: 9, // Starts by allowing indices 0-9 (Numbers 1-10)

  init() {
    this.running = true;
    this.score = 0;
    this.currentLevel = 0;
    this.mode = "TRACE"; 
    this.isMenuOpen = false;
    this.unlockedUntilIndex = 9; // Reset unlocks on fresh load
    
    const existingMenu = document.getElementById("game5-level-menu");
    if (existingMenu) existingMenu.style.display = "none";

    if (window.stopCamera) window.stopCamera();
    
    this.loadModel();

    const menu = document.getElementById("menu");
    if (menu) menu.style.display = "none";
    const video = document.getElementById("input_video");
    if (video) video.style.display = "none";
    
    this.generateLevels();
    this.resizeCanvas();
    this.resetLevel();
    
    if (!this.listenersAdded) {
      this.addInputListeners();
      window.addEventListener('resize', () => { if (this.running) this.resizeCanvas(); });
      this.listenersAdded = true;
    }
  },

  async loadModel() {
      try {
          this.tfModel = await tf.loadLayersModel('./tfjs_model/model.json');
          console.log("Custom Roman Numeral Model loaded successfully!");
      } catch (error) {
          console.error("Failed to load TFJS model.", error);
      }
  },

  resizeCanvas() {
    const canvas = document.getElementById("game_canvas");
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;

    canvas.width = cssWidth;
    canvas.height = cssHeight;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";

    const screenW = canvas.width;
    const screenH = canvas.height;

    this.scale = Math.min(screenW / this.BASE_WIDTH, screenH / this.BASE_HEIGHT);
    this.playWidth = this.BASE_WIDTH * this.scale;
    this.playHeight = this.BASE_HEIGHT * this.scale;
    this.offsetX = (screenW - this.playWidth) / 2;
    this.offsetY = (screenH - this.playHeight) / 2;
  },

  resetLevel() {
    this.tracePoints = [];
    this.activeStrokeIndex = 0;
    this.currentStrokeProgress = 0;
    this.freehandStrokes = [];
    this.submitTimer = 0;
    this.levelCompleteTimer = 0;
    this.levelFailedTimer = 0; 
    this.isDrawing = false;
    this.particles = [];
    this.cursorColor = "white"; 
    this.isEvaluating = false; 
  },

  getPoint(sx, sy, w, h) {
      const size = Math.min(w, h) * 0.50; 
      const cx = w / 2;
      const cy = h / 2 - (h * 0.05); 
      return { x: cx + (sx - 0.5) * size, y: cy + (sy - 0.5) * size };
  },

  addInputListeners() {
    const canvas = document.getElementById('game_canvas');

    const startDraw = (e) => {
        this.updateCursor(e);
        if (this.checkButtonClicks()) return;
        if (this.isMenuOpen) return; 

        this.isDrawing = true;

        if (this.mode === "FREEHAND") {
            if (this.levelFailedTimer > 0) {
                this.levelFailedTimer = 0;
                this.freehandStrokes = [];
            }
            this.currentStroke = [{x: this.cursor.x, y: this.cursor.y}];
            this.freehandStrokes.push(this.currentStroke);
            this.submitTimer = 0; 
            this.cursorColor = "white";
        }
    };

    const moveDraw = (e) => {
        if (this.isDrawing && !this.isMenuOpen) {
            this.updateCursor(e);
            if (this.mode === "FREEHAND" && this.currentStroke) {
                let lastP = this.currentStroke[this.currentStroke.length - 1];
                if(Math.hypot(lastP.x - this.cursor.x, lastP.y - this.cursor.y) > 5) {
                    this.currentStroke.push({x: this.cursor.x, y: this.cursor.y});
                    this.submitTimer = 0; 
                }
            }
        }
    };

    const endDraw = () => {
        if (!this.isDrawing) return; 
        this.isDrawing = false;
        
        if (this.mode === "TRACE") {
            this.tracePoints = []; 
            this.cursorColor = "white"; 
        } else if (this.mode === "FREEHAND" && this.freehandStrokes.length > 0) {
            this.submitTimer = 100;
        }
    };

    const extractEvent = (e) => (e.touches && e.touches.length > 0) ? e.touches[0] : e;

    canvas.addEventListener('mousedown', (e) => startDraw(extractEvent(e)));
    window.addEventListener('mousemove', (e) => moveDraw(extractEvent(e)));
    window.addEventListener('mouseup', endDraw);
    window.addEventListener('mouseleave', endDraw);
    
    canvas.addEventListener('touchstart', (e) => { startDraw(extractEvent(e)); e.preventDefault(); }, {passive: false});
    canvas.addEventListener('touchmove', (e) => { moveDraw(extractEvent(e)); e.preventDefault(); }, {passive: false});
    window.addEventListener('touchend', endDraw);
    window.addEventListener('touchcancel', endDraw);
  },

  updateCursor(e) {
    const rect = document.getElementById("game_canvas").getBoundingClientRect();
    let rawX = e.clientX - rect.left;
    let rawY = e.clientY - rect.top;
    this.cursor.x = (rawX - this.offsetX) / this.scale;
    this.cursor.y = (rawY - this.offsetY) / this.scale;
  },

  checkButtonClicks() {
    const w = this.BASE_WIDTH;
    const h = this.BASE_HEIGHT;
    const baseUnit = Math.min(w, h);
    
    const x = this.cursor.x;
    const y = this.cursor.y;

    const btnW = Math.max(140, baseUnit * 0.25);
    const btnH = Math.max(50, baseUnit * 0.08);
    const btnY = h - btnH - (baseUnit * 0.05);
    const traceX = w / 2 - btnW - (baseUnit * 0.02);
    const freeX = w / 2 + (baseUnit * 0.02);

    if (x >= traceX && x <= traceX + btnW && y >= btnY && y <= btnY + btnH) { 
        this.setMode("TRACE"); 
        return true; 
    }
    if (x >= freeX && x <= freeX + btnW && y >= btnY && y <= btnY + btnH) { 
        this.setMode("FREEHAND"); 
        return true; 
    }

    const menuBtnW = Math.max(80, baseUnit * 0.12);
    const menuBtnH = Math.max(40, baseUnit * 0.06);
    const menuBtnX = w - menuBtnW - (baseUnit * 0.02);
    const menuBtnY = baseUnit * 0.02;

    if (x >= menuBtnX && x <= menuBtnX + menuBtnW && y >= menuBtnY && y <= menuBtnY + menuBtnH) {
        this.toggleMenu();
        return true;
    }

    return false;
  },

  toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
      let menuDiv = document.getElementById("game5-level-menu");

      if (this.isMenuOpen) {
          if (!menuDiv) menuDiv = this.buildHTMLMenu();
          else {
              // Rebuild to update locked/unlocked states
              menuDiv.remove(); 
              menuDiv = this.buildHTMLMenu();
          }
          menuDiv.style.display = "flex";
      } else {
          if (menuDiv) menuDiv.style.display = "none";
      }
  },

  buildHTMLMenu() {
      const menu = document.createElement("div");
      menu.id = "game5-level-menu";
      
      Object.assign(menu.style, {
          position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
          backgroundColor: "rgba(15, 15, 15, 0.95)", zIndex: "10000",
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "20px", boxSizing: "border-box", fontFamily: "Arial, sans-serif"
      });

      const headerDiv = document.createElement("div");
      Object.assign(headerDiv.style, {
          display: "flex", justifyContent: "space-between", alignItems: "center",
          width: "100%", maxWidth: "800px", marginBottom: "20px"
      });

      const title = document.createElement("h1");
      title.innerText = "Select Level";
      title.style.color = "#FFCC00";
      title.style.margin = "0";

      const closeBtn = document.createElement("button");
      closeBtn.innerText = "Close ✖";
      Object.assign(closeBtn.style, {
          padding: "10px 20px", fontSize: "16px", cursor: "pointer", fontWeight: "bold",
          backgroundColor: "#FF4444", color: "white", border: "none", borderRadius: "8px"
      });
      closeBtn.onclick = () => this.toggleMenu();

      headerDiv.appendChild(title);
      headerDiv.appendChild(closeBtn);
      menu.appendChild(headerDiv);

      const grid = document.createElement("div");
      Object.assign(grid.style, {
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
          gap: "12px", width: "100%", maxWidth: "800px",
          overflowY: "auto", paddingBottom: "40px", paddingRight: "10px"
      });

      this.levels.forEach((lvl, index) => {
          const btn = document.createElement("button");
          const isUnlocked = index <= this.unlockedUntilIndex;

          if (isUnlocked) {
              // ⭐ Unlocked Button Styling
              btn.innerHTML = `
                  <div style="font-size: 24px; font-weight: bold;">${lvl.number}</div>
                  <div style="font-size: 14px; color: #00FFCC; margin-top: 4px;">${lvl.symbol}</div>
              `;
              Object.assign(btn.style, {
                  padding: "15px 10px", cursor: "pointer",
                  backgroundColor: "#2A2A2A", color: "white", 
                  border: index === this.currentLevel ? "3px solid #FFCC00" : "2px solid #555",
                  borderRadius: "12px", textAlign: "center", transition: "all 0.2s ease"
              });
              
              btn.onmouseover = () => { if (index !== this.currentLevel) btn.style.borderColor = "#00FFCC"; };
              btn.onmouseout = () => { if (index !== this.currentLevel) btn.style.borderColor = "#555"; };
              
              btn.onclick = () => {
                  this.currentLevel = index;
                  this.resetLevel();
                  this.toggleMenu();
              };
          } else {
              // ⭐ Locked Button Styling
              btn.innerHTML = `
                  <div style="font-size: 24px; font-weight: bold; color: #555;">${lvl.number}</div>
                  <div style="font-size: 14px; color: #444; margin-top: 4px;">🔒</div>
              `;
              Object.assign(btn.style, {
                  padding: "15px 10px", cursor: "not-allowed",
                  backgroundColor: "#111", color: "#555", 
                  border: "2px solid #222",
                  borderRadius: "12px", textAlign: "center"
              });
          }
          
          grid.appendChild(btn);
      });

      menu.appendChild(grid);
      document.body.appendChild(menu);
      return menu;
  },

  update(ctx) {
    if (!this.running) return;
    const canvas = ctx.canvas;
    const screenW = canvas.width;
    const screenH = canvas.height;

    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, screenW, screenH);

    ctx.save();
    if (this.shakeTimer > 0) {
      const shake = 10 * this.scale;
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      this.shakeTimer--;
    }

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const w = this.BASE_WIDTH;
    const h = this.BASE_HEIGHT;
    const baseUnit = Math.min(w, h);

    if (this.levelCompleteTimer === 0 && this.levelFailedTimer === 0 && !this.isMenuOpen) {
        if (this.mode === "TRACE" && this.isDrawing) {
            this.handleTracing(w, h, baseUnit);
        } else if (this.mode === "FREEHAND") {
            this.handleFreehand(baseUnit);
        }
    }
    
    this.updateParticles();
    this.drawTemplate(ctx, w, h, baseUnit);
    this.drawUserInk(ctx, baseUnit);
    this.drawParticles(ctx, baseUnit); 
    if (!this.isMenuOpen) this.drawCursor(ctx, baseUnit); 
    this.drawUI(ctx, w, h, baseUnit);
    
    ctx.restore(); 

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    
    if (this.levelCompleteTimer > 0) {
      this.levelCompleteTimer++;
      this.drawSuccessEffect(ctx, w, h, baseUnit);
      if (this.levelCompleteTimer > 80) { 

        // ⭐ NEW: Tier Unlock Logic
        // If they just beat the highest unlocked tier threshold (e.g., Level 10)
        if (this.currentLevel === this.unlockedUntilIndex) {
            this.unlockedUntilIndex = Math.min(99, this.unlockedUntilIndex + 10);
            console.log("New numbers unlocked! Playable up to:", this.unlockedUntilIndex + 1);
        }

        this.currentLevel++;
        if (this.currentLevel > this.unlockedUntilIndex || this.currentLevel >= this.levels.length) {
            this.currentLevel = 0; // Wrap around if they beat the absolute highest available
        }

        this.resetLevel();
      }
    }

    if (this.levelFailedTimer > 0) {
        this.levelFailedTimer++;
        this.drawFailEffect(ctx, w, h, baseUnit);
        if (this.levelFailedTimer > 120) {
            this.levelFailedTimer = 0;
            this.freehandStrokes = []; 
        }
    }
    ctx.restore();
  },

  handleTracing(w, h, baseUnit) {
    const level = this.levels[this.currentLevel];
    const stroke = level.strokes[this.activeStrokeIndex];
    if (!stroke) return;

    const p1 = this.getPoint(stroke.x1, stroke.y1, w, h);
    const p2 = this.getPoint(stroke.x2, stroke.y2, w, h);
    const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const distToStart = Math.hypot(this.cursor.x - p1.x, this.cursor.y - p1.y);
    const distToLine = this.pointToLineDist(this.cursor.x, this.cursor.y, p1.x, p1.y, p2.x, p2.y);
    const snapAllowed = baseUnit * 0.08; 

    if (distToLine > snapAllowed) { this.cursorColor = "#FF4444"; return; }
    const newProgress = Math.min(1, Math.max(0, distToStart / lineLen));
    if (this.currentStrokeProgress === 0 && newProgress > 0.15) { this.cursorColor = "#FF4444"; return; }
    if (newProgress > this.currentStrokeProgress + 0.15) return; 

    if (newProgress > this.currentStrokeProgress) {
      this.currentStrokeProgress = newProgress;
      this.tracePoints.push({ x: this.cursor.x, y: this.cursor.y });
      this.cursorColor = "#00FFCC"; 
      if (Math.random() > 0.5) this.spawnParticle(this.cursor.x, this.cursor.y, false, baseUnit);
    }
    if (this.currentStrokeProgress >= 0.95) this.completeStroke(baseUnit);
  },

  completeStroke(baseUnit) {
    this.activeStrokeIndex++;
    this.currentStrokeProgress = 0;
    this.tracePoints = []; 
    this.score += 10;
    for(let i=0; i<20; i++) this.spawnParticle(this.cursor.x, this.cursor.y, true, baseUnit);
    if (this.activeStrokeIndex >= this.levels[this.currentLevel].strokes.length) {
      this.levelCompleteTimer = 1; 
    }
  },

  handleFreehand(baseUnit) {
      if (!this.isDrawing && this.freehandStrokes.length > 0) {
          if (this.submitTimer > 0) {
              this.submitTimer--;
              if (this.submitTimer <= 0 && !this.isEvaluating) {
                  this.isEvaluating = true; 
                  this.evaluateWithTFJS(baseUnit);
              }
          }
      }
  },

  async evaluateWithTFJS(baseUnit) {
      if (!this.tfModel) {
          console.warn("TFJS model not loaded, falling back to vector check.");
          this.evaluateShapeVector(baseUnit);
          this.isEvaluating = false;
          return;
      }

      const MODEL_IMG_SIZE = 64; 
      const offCanvas = document.createElement('canvas');
      offCanvas.width = MODEL_IMG_SIZE;
      offCanvas.height = MODEL_IMG_SIZE;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

      offCtx.fillStyle = "black";
      offCtx.fillRect(0, 0, MODEL_IMG_SIZE, MODEL_IMG_SIZE);

      let allPts = [];
      this.freehandStrokes.forEach(s => allPts.push(...s));
      let minX = Math.min(...allPts.map(p => p.x));
      let maxX = Math.max(...allPts.map(p => p.x));
      let minY = Math.min(...allPts.map(p => p.y));
      let maxY = Math.max(...allPts.map(p => p.y));
      
      let drawWidth = Math.max(maxX - minX, 1);
      let drawHeight = Math.max(maxY - minY, 1);
      let padding = 8; 
      
      let scale = (MODEL_IMG_SIZE - padding * 2) / Math.max(drawWidth, drawHeight);
      let drawOffsetX = (MODEL_IMG_SIZE - (drawWidth * scale)) / 2;
      let drawOffsetY = (MODEL_IMG_SIZE - (drawHeight * scale)) / 2;

      offCtx.save();
      offCtx.translate(drawOffsetX, drawOffsetY);
      offCtx.scale(scale, scale);
      offCtx.translate(-minX, -minY);

      offCtx.lineWidth = Math.max(3 / scale, 2); 
      offCtx.strokeStyle = "white";
      offCtx.lineCap = "round";
      offCtx.lineJoin = "round";

      this.freehandStrokes.forEach(stroke => {
          if(stroke.length < 2) return;
          offCtx.beginPath();
          offCtx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < stroke.length; i++) offCtx.lineTo(stroke[i].x, stroke[i].y);
          offCtx.stroke();
      });
      offCtx.restore();

      let debugImg = document.getElementById('debug_model_view');
      if (!debugImg) {
          debugImg = document.createElement('img');
          debugImg.id = 'debug_model_view';
          debugImg.style.position = 'absolute';
          debugImg.style.top = '10px';
          debugImg.style.left = '10px';
          debugImg.style.width = '128px'; 
          debugImg.style.height = '128px';
          debugImg.style.border = '2px solid red';
          debugImg.style.zIndex = '9999';
          debugImg.style.backgroundColor = 'black';
          document.body.appendChild(debugImg);
      }
      debugImg.src = offCanvas.toDataURL(); 

      try {
          const imageData = offCtx.getImageData(0, 0, MODEL_IMG_SIZE, MODEL_IMG_SIZE);
          
          const predictionData = tf.tidy(() => {
              const tensor = tf.browser.fromPixels(imageData, 1)
                                       .toFloat()
                                       .expandDims();
              
              return this.tfModel.predict(tensor).dataSync(); 
          });

          const predictedIndex = predictionData.indexOf(Math.max(...predictionData));
          
          const classNames = ["C", "I", "L", "V", "X"]; 
          const predictedSymbol = classNames[predictedIndex];
          
          const level = this.levels[this.currentLevel];
          const targetSymbol = level.symbol; 
          
          const isCorrect = (predictedSymbol === targetSymbol);

          if (isCorrect) {
              this.levelCompleteTimer = 1;
              this.score += 20;
              this.cursorColor = "#00FFCC";
          } else {
              this.triggerFail();
          }

      } catch (err) {
          console.error("TFJS Prediction Error:", err);
          this.triggerFail();
      }

      this.isEvaluating = false; 
  },

  splitStrokeAtCorners(stroke) {
    if (stroke.length < 10) return [stroke];
    let segments = [];
    let startIdx = 0;
    for (let i = 5; i < stroke.length - 5; i++) {
      const p1 = stroke[i - 4], p2 = stroke[i], p3 = stroke[i + 4];
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y }, v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      const mag1 = Math.hypot(v1.x, v1.y), mag2 = Math.hypot(v2.x, v2.y);
      if (mag1 < 1 || mag2 < 1) continue;
      const dot = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
      if (dot < 0.3) {
        segments.push(stroke.slice(startIdx, i + 1));
        startIdx = i;
        i += 5; 
      }
    }
    segments.push(stroke.slice(startIdx));
    return segments;
  },

  evaluateShapeVector(baseUnit) {
    let splitStrokes = [];
    this.freehandStrokes.forEach(s => {
        if(s.length > 3) splitStrokes.push(...this.splitStrokeAtCorners(s));
    });

    if (splitStrokes.length === 0) return this.triggerFail();

    const maxGap = 350; 
    for (let i = 0; i < splitStrokes.length - 1; i++) {
        let p1 = splitStrokes[i][splitStrokes[i].length - 1];
        let p2 = splitStrokes[i+1][0];
        if (Math.hypot(p1.x - p2.x, p1.y - p2.y) > maxGap) return this.triggerFail();
    }

    const level = this.levels[this.currentLevel];
    const template = level.localStrokes;
    const normUser = this.normalizeStrokes(splitStrokes);

    if (Math.abs(normUser.length - template.length) > 1) return this.triggerFail();

    let usedTemplate = new Array(template.length).fill(false);
    let totalScore = 0;

    for (let u of normUser) {
        let bestScore = -Infinity, bestIndex = -1;
        for (let i = 0; i < template.length; i++) {
            if (usedTemplate[i]) continue;
            const score = this.strokeMatchScore(u, template[i]);
            if (score > bestScore) { bestScore = score; bestIndex = i; }
        }
        
        if (bestIndex !== -1 && bestScore > 0.45) {
            usedTemplate[bestIndex] = true;
            totalScore += bestScore;
        } else {
            return this.triggerFail(); 
        }
    }

    let matchedCount = usedTemplate.filter(v => v).length;
    if (matchedCount === template.length && (totalScore / matchedCount) > 0.5) {
        this.levelCompleteTimer = 1;
        this.score += 20;
        this.cursorColor = "#00FFCC";
    } else {
        this.triggerFail();
    }
  },

  triggerFail() {
      this.levelFailedTimer = 1;
      this.shakeTimer = 25; 
      this.cursorColor = "#FF4444";
  },

  drawTemplate(ctx, w, h, baseUnit) {
    if (this.mode === "FREEHAND") return; 
    const level = this.levels[this.currentLevel];
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    level.strokes.forEach((s, index) => {
      ctx.beginPath();
      ctx.lineWidth = baseUnit * 0.04; 
      let color = index < this.activeStrokeIndex ? "#00FF66" : index === this.activeStrokeIndex ? "#555" : "#2a2a2a";
      ctx.strokeStyle = color;
      let p1 = this.getPoint(s.x1, s.y1, w, h), p2 = this.getPoint(s.x2, s.y2, w, h);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      if (index === this.activeStrokeIndex) this.drawArrow(ctx, p1.x, p1.y, p2.x, p2.y, baseUnit);
    });
    const active = level.strokes[this.activeStrokeIndex];
    if (active) {
      const pulse = Math.sin(Date.now() / 150) * (baseUnit * 0.01);
      ctx.fillStyle = "#FFCC00"; ctx.beginPath(); 
      let startP = this.getPoint(active.x1, active.y1, w, h);
      ctx.arc(startP.x, startP.y, (baseUnit * 0.02) + pulse, 0, Math.PI*2); ctx.fill();
    }
  },

  drawArrow(ctx, x1, y1, x2, y2, baseUnit) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = baseUnit * 0.015; 
    ctx.save(); ctx.translate((x1 + x2)/2, (y1 + y2)/2); ctx.rotate(angle);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.moveTo(-size, -size); ctx.lineTo(size, 0); ctx.lineTo(-size, size); ctx.fill();
    ctx.restore();
  },

  drawUserInk(ctx, baseUnit) {
    ctx.lineWidth = baseUnit * 0.03; 
    if (this.levelFailedTimer > 0) { ctx.strokeStyle = "#FF4444"; ctx.shadowColor = "red"; } 
    else { ctx.strokeStyle = "#00FFFF"; ctx.shadowColor = "cyan"; }
    ctx.shadowBlur = baseUnit * 0.02;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (this.mode === "TRACE" && this.tracePoints.length > 1) {
        ctx.beginPath(); ctx.moveTo(this.tracePoints[0].x, this.tracePoints[0].y);
        for (let i = 1; i < this.tracePoints.length; i++) ctx.lineTo(this.tracePoints[i].x, this.tracePoints[i].y);
        ctx.stroke();
    } else if (this.mode === "FREEHAND") {
        this.freehandStrokes.forEach(stroke => {
            if(stroke.length < 2) return;
            ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
            ctx.stroke();
        });
    }
    ctx.shadowBlur = 0;
  },

  drawCursor(ctx, baseUnit) {
      if (this.levelFailedTimer > 0 || this.levelCompleteTimer > 0) return; 
      ctx.beginPath(); ctx.fillStyle = this.cursorColor;
      ctx.arc(this.cursor.x, this.cursor.y, baseUnit * 0.015, 0, Math.PI*2); ctx.fill(); 
      ctx.strokeStyle = "black"; ctx.lineWidth = baseUnit * 0.005; ctx.stroke();
  },

  drawUI(ctx, w, h, baseUnit) {
    ctx.fillStyle = "white"; ctx.font = `bold ${Math.max(16, baseUnit * 0.04)}px Arial`; 
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Score: " + this.score, baseUnit * 0.03, baseUnit * 0.03);
    const level = this.levels[this.currentLevel];
    ctx.textAlign = "center"; ctx.font = `bold ${Math.max(24, baseUnit * 0.06)}px Arial`; 
    ctx.fillStyle = "#FFCC00"; ctx.shadowBlur = 10; ctx.shadowColor = "rgba(255, 204, 0, 0.5)";
    ctx.fillText("Number: " + level.number, w / 2, baseUnit * 0.05);
    ctx.shadowBlur = 0;
    
    if (this.mode === "FREEHAND" && this.submitTimer > 0 && this.freehandStrokes.length > 0 && this.levelFailedTimer === 0) {
        let progress = this.submitTimer / 100; let barW = baseUnit * 0.3; 
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; ctx.fillRect(w/2 - barW/2, baseUnit * 0.12, barW, baseUnit*0.015);
        ctx.fillStyle = "#00FFCC"; ctx.fillRect(w/2 - barW/2, baseUnit * 0.12, barW * progress, baseUnit*0.015);
    } else if (this.mode === "FREEHAND" && this.freehandStrokes.length === 0 && this.levelFailedTimer === 0) {
        ctx.font = `${Math.max(14, baseUnit * 0.03)}px Arial`; ctx.fillStyle = "#888";
        ctx.fillText("Draw anywhere! Any size!", w / 2, baseUnit * 0.12);
    }

    const btnW = Math.max(140, baseUnit * 0.25), btnH = Math.max(50, baseUnit * 0.08), btnY = h - btnH - (baseUnit * 0.05); 
    const traceX = w / 2 - btnW - (baseUnit * 0.02), freeX = w / 2 + (baseUnit * 0.02);
    ctx.font = `bold ${Math.max(12, baseUnit * 0.025)}px Arial`; ctx.textBaseline = "middle";
    
    ctx.fillStyle = this.mode === "TRACE" ? "#00FFCC" : "#444";
    ctx.fillRect(traceX, btnY, btnW, btnH); ctx.strokeStyle = "white"; ctx.lineWidth = baseUnit * 0.005; ctx.strokeRect(traceX, btnY, btnW, btnH);
    ctx.fillStyle = this.mode === "TRACE" ? "black" : "white"; ctx.fillText("TRACE", traceX + btnW/2, btnY + btnH/2);
    
    ctx.fillStyle = this.mode === "FREEHAND" ? "#FF4444" : "#444";
    ctx.fillRect(freeX, btnY, btnW, btnH); ctx.strokeRect(freeX, btnY, btnW, btnH);
    ctx.fillStyle = "white"; ctx.fillText("FREEHAND", freeX + btnW/2, btnY + btnH/2);

    const menuBtnW = Math.max(80, baseUnit * 0.12);
    const menuBtnH = Math.max(40, baseUnit * 0.06);
    const menuBtnX = w - menuBtnW - (baseUnit * 0.02);
    const menuBtnY = baseUnit * 0.02;

    ctx.fillStyle = "#333";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(menuBtnX, menuBtnY, menuBtnW, menuBtnH, 8);
    else ctx.fillRect(menuBtnX, menuBtnY, menuBtnW, menuBtnH);
    ctx.fill();

    ctx.strokeStyle = "#555";
    ctx.lineWidth = Math.max(2, baseUnit * 0.004);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.max(14, baseUnit * 0.025)}px Arial`;
    ctx.fillText("MENU", menuBtnX + menuBtnW / 2, menuBtnY + menuBtnH / 2);
  },

  drawSuccessEffect(ctx, w, h, baseUnit) {
    const canvas = ctx.canvas;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = "rgba(0, 255, 100, 0.2)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); 
    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.1}px Arial`; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowBlur = 20; ctx.shadowColor = "#00FF66";
    ctx.fillText("NICE!", w/2, h/2);
  },

  drawFailEffect(ctx, w, h, baseUnit) {
    const canvas = ctx.canvas;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = "rgba(255, 50, 50, 0.15)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); 
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#FF4444"; ctx.font = `bold ${baseUnit * 0.1}px Arial`; 
    ctx.shadowBlur = 20; ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
    ctx.fillText("WRONG!", w/2, h/2 - (baseUnit * 0.05));
    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.04}px Arial`; ctx.shadowBlur = 10; ctx.shadowColor = "black";
    ctx.fillText("Use TRACE mode if you forgot!", w/2, h/2 + (baseUnit * 0.08));
  },

  pointToLineDist(px, py, x1, y1, x2, y2) {
    const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D, len_sq = C * C + D * D;
    let param = -1; if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(px - xx, py - yy);
  },

  spawnParticle(x, y, burst = false, baseUnit) {
    const angle = Math.random() * Math.PI * 2, mult = baseUnit ? baseUnit * 0.005 : 2; 
    const speed = burst ? (Math.random() * 5 + 2) * mult : (Math.random() * 2 + 1) * mult;
    this.particles.push({ 
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, 
        life: 1.0, color: `hsl(${Math.random()*60 + 160}, 100%, 70%)`,
        size: baseUnit ? baseUnit * 0.008 : 4
    });
  },
  
  updateParticles() { 
      for (let i = this.particles.length - 1; i >= 0; i--) { 
          let p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.05; 
          if (p.life <= 0) this.particles.splice(i, 1); 
      } 
  },
  
  drawParticles(ctx, baseUnit) { 
      for (let p of this.particles) { 
          ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); 
          ctx.arc(p.x, p.y, p.size || (baseUnit*0.008), 0, Math.PI*2); ctx.fill(); 
      } 
      ctx.globalAlpha = 1.0; 
  },

  setMode(newMode) { if (this.mode !== newMode) { this.mode = newMode; this.resetLevel(); } },

  toRoman(num) {
    const map = [
      { value: 100, numeral: "C" }, { value: 90, numeral: "XC" }, { value: 50, numeral: "L" },
      { value: 40, numeral: "XL" }, { value: 10, numeral: "X" }, { value: 9, numeral: "IX" },
      { value: 5, numeral: "V" }, { value: 4, numeral: "IV" }, { value: 1, numeral: "I" }
    ];
    let result = "";
    for (let i = 0; i < map.length; i++) {
      while (num >= map[i].value) { result += map[i].numeral; num -= map[i].value; }
    }
    return result;
  },

  generateLevels() {
    this.levels = [];
    for (let i = 1; i <= 100; i++) {
      const roman = this.toRoman(i);
      this.levels.push({
        symbol: roman, number: i.toString(),
        strokes: this.buildStrokesFromRoman(roman),
        localStrokes: this.buildLocalFromRoman(roman)
      });
    }
  },

  buildStrokesFromRoman(roman) {
    const chars = roman.split(""), strokes = [];
    const spacing = 0.15, startX = 0.5 - (chars.length - 1) * spacing / 2;
    chars.forEach((ch, index) => {
      const offset = startX + index * spacing;
      if (ch === "I") strokes.push({ x1: offset, y1: 0.2, x2: offset, y2: 0.8 });
      if (ch === "V") strokes.push({ x1: offset - 0.05, y1: 0.2, x2: offset, y2: 0.8 }, { x1: offset, y1: 0.8, x2: offset + 0.05, y2: 0.2 });
      if (ch === "X") strokes.push({ x1: offset - 0.05, y1: 0.2, x2: offset + 0.05, y2: 0.8 }, { x1: offset + 0.05, y1: 0.2, x2: offset - 0.05, y2: 0.8 });
      if (ch === "L") strokes.push({ x1: offset - 0.05, y1: 0.2, x2: offset - 0.05, y2: 0.8 }, { x1: offset - 0.05, y1: 0.8, x2: offset + 0.05, y2: 0.8 });
      if (ch === "C") strokes.push({ x1: offset + 0.05, y1: 0.2, x2: offset - 0.05, y2: 0.5 }, { x1: offset - 0.05, y1: 0.5, x2: offset + 0.05, y2: 0.8 });
    });
    return strokes;
  },

  buildLocalFromRoman(roman) {
    const chars = roman.split(""), strokes = [];
    const spacing = 1.2, totalWidth = chars.length * spacing, startX = 0.5 - totalWidth / 2 + spacing / 2;
    chars.forEach((ch, index) => {
      const offset = startX + index * spacing;
      if (ch === "I") strokes.push({ x1: offset, y1: 0, x2: offset, y2: 1 });
      if (ch === "V") strokes.push({ x1: offset - 0.5, y1: 0, x2: offset, y2: 1 }, { x1: offset, y1: 1, x2: offset + 0.5, y2: 0 });
      if (ch === "X") strokes.push({ x1: offset - 0.5, y1: 0, x2: offset + 0.5, y2: 1 }, { x1: offset + 0.5, y1: 0, x2: offset - 0.5, y2: 1 });
      if (ch === "L") strokes.push({ x1: offset - 0.5, y1: 0, x2: offset - 0.5, y2: 1 }, { x1: offset - 0.5, y1: 1, x2: offset + 0.5, y2: 1 });
      if (ch === "C") strokes.push({ x1: offset + 0.5, y1: 0, x2: offset - 0.5, y2: 0.5 }, { x1: offset - 0.5, y1: 0.5, x2: offset + 0.5, y2: 1 });
    });
    return strokes;
  },

  normalizeStrokes(strokes) {
    let allPts = [];
    strokes.forEach(s => allPts.push(...s));
    
    let minX = Math.min(...allPts.map(p => p.x)), maxX = Math.max(...allPts.map(p => p.x));
    let minY = Math.min(...allPts.map(p => p.y)), maxY = Math.max(...allPts.map(p => p.y));
    let centerX = (minX + maxX) / 2;
    let centerY = (minY + maxY) / 2;

    const FIXED_SCALE = 300; 

    return strokes.map(stroke =>
        stroke.map(p => ({
            x: (p.x - centerX) / FIXED_SCALE, 
            y: (p.y - centerY) / FIXED_SCALE
        }))
    );
  },

  strokeMatchScore(stroke, tmpl) {
    const p1 = stroke[0], p2 = stroke[stroke.length - 1];
    const udx = p2.x - p1.x, udy = p2.y - p1.y, ulen = Math.hypot(udx, udy) + 0.0001;
    const tdx = tmpl.x2 - tmpl.x1, tdy = tmpl.y2 - tmpl.y1, tlen = Math.hypot(tdx, tdy) + 0.0001;

    const dirScore = Math.max(0, (udx * tdx + udy * tdy) / (ulen * tlen));
    const lenScore = 1 - Math.min(1, Math.abs(ulen - tlen));

    let dist = 0;
    stroke.forEach(p => { dist += this.pointToLineDist(p.x, p.y, tmpl.x1, tmpl.y1, tmpl.x2, tmpl.y2); });
    const distScore = 1 - Math.min(1, (dist / stroke.length) * 1.2);

    return (dirScore * 0.6) + (lenScore * 0.2) + (distScore * 0.2);
  },
};