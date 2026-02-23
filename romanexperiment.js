const Game7 = {
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

  // --- NEW PRODUCTION & DEBUG PROPERTIES ---
  isProcessing: false,
  worker: null,
  debugMode: true, // Toggle this to false to hide the AI preview
  lastProcessedCanvas: null,

  async init() {
    this.running = true;
    this.score = 0;
    this.currentLevel = 0;
    this.mode = "TRACE"; 
    
    if (window.stopCamera) window.stopCamera();
    
    const menu = document.getElementById("menu");
    if (menu) menu.style.display = "none";
    const video = document.getElementById("input_video");
    if (video) video.style.display = "none";
    
    this.generateLevels();
    this.resizeCanvas();
    this.resetLevel();

    // Initialize AI Worker
    if (!this.worker) {
        this.worker = await Tesseract.createWorker('eng');
        await this.worker.setParameters({
            tessedit_char_whitelist: 'IVXLC',
            tessedit_pageseg_mode: '13', // Treat as single line/character
        });
    }
    
    if (!this.listenersAdded) {
      this.addInputListeners();
      window.addEventListener('resize', () => { if (this.running) this.resizeCanvas(); });
      this.listenersAdded = true;
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
    this.isProcessing = false;
    this.particles = [];
    this.cursorColor = "white"; 
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
        if (this.isDrawing) {
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
            this.submitTimer = 60; 
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
    const btnW = Math.max(140, baseUnit * 0.25);
    const btnH = Math.max(50, baseUnit * 0.08);
    const btnY = h - btnH - (baseUnit * 0.05);
    const traceX = w / 2 - btnW - (baseUnit * 0.02);
    const freeX = w / 2 + (baseUnit * 0.02);
    const x = this.cursor.x;
    const y = this.cursor.y;

    if (x >= traceX && x <= traceX + btnW && y >= btnY && y <= btnY + btnH) {
      this.setMode("TRACE"); return true;
    }
    if (x >= freeX && x <= freeX + btnW && y >= btnY && y <= btnY + btnH) {
      this.setMode("FREEHAND"); return true;
    }
    return false;
  },

  update(ctx) {
    if (!this.running) return;
    const canvas = ctx.canvas;
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    if (this.levelCompleteTimer === 0 && this.levelFailedTimer === 0) {
        if (this.mode === "TRACE" && this.isDrawing) this.handleTracing(w, h, baseUnit);
        else if (this.mode === "FREEHAND") this.handleFreehand(baseUnit);
    }
    
    this.updateParticles();
    this.drawTemplate(ctx, w, h, baseUnit);
    this.drawUserInk(ctx, baseUnit);
    this.drawParticles(ctx, baseUnit); 
    this.drawCursor(ctx, baseUnit); 
    this.drawUI(ctx, w, h, baseUnit);
    
    // DEBUG MODE DRAWING
    if (this.debugMode && this.lastProcessedCanvas) {
        ctx.strokeStyle = "#00FFCC";
        ctx.lineWidth = 2;
        ctx.strokeRect(w - 170, 20, 150, 150);
        ctx.drawImage(this.lastProcessedCanvas, w - 170, 20, 150, 150);
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.fillText("AI VISION PREVIEW", w - 170, 15);
    }

    ctx.restore(); 

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    
    if (this.levelCompleteTimer > 0) {
      this.levelCompleteTimer++;
      this.drawSuccessEffect(ctx, w, h, baseUnit);
      if (this.levelCompleteTimer > 80) { 
        this.currentLevel++;
        if (this.currentLevel >= this.levels.length) this.currentLevel = 0;
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

    if (distToLine > baseUnit * 0.08) { this.cursorColor = "#FF4444"; return; }

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
    if (this.activeStrokeIndex >= this.levels[this.currentLevel].strokes.length) this.levelCompleteTimer = 1; 
  },

  handleFreehand(baseUnit) {
      if (!this.isDrawing && this.freehandStrokes.length > 0 && !this.isProcessing) {
          if (this.submitTimer > 0) {
              this.submitTimer--;
              if (this.submitTimer <= 0) this.evaluateWithAI(baseUnit);
          }
      }
  },

  calculateIoU(userStrokes, tempStrokes) {
      const size = 100;
      const c1 = document.createElement('canvas');
      const c2 = document.createElement('canvas');
      c1.width = c2.width = size; c1.height = c2.height = size;
      const ctx1 = c1.getContext('2d');
      const ctx2 = c2.getContext('2d');

      this.drawStrokesNormalized(ctx1, userStrokes, size, "black");
      this.drawStrokesNormalized(ctx2, tempStrokes, size, "black");

      const d1 = ctx1.getImageData(0,0,size,size).data;
      const d2 = ctx2.getImageData(0,0,size,size).data;

      let inter = 0, union = 0;
      for (let i = 3; i < d1.length; i += 4) {
          let p1 = d1[i] > 10; let p2 = d2[i] > 10;
          if (p1 && p2) inter++;
          if (p1 || p2) union++;
      }
      return union === 0 ? 0 : inter / union;
  },

  /* ==============================
     IMPROVED AI EVALUATION
  ============================== */
  /* ==============================
     AI EVALUATION + VALIDATION LAYER
  ============================== */
  async evaluateWithAI(baseUnit) {
      if (!this.worker) return;
      this.isProcessing = true;
      const level = this.levels[this.currentLevel];
      
      const size = 250; 
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = "white"; 
      ctx.fillRect(0, 0, size, size);
      this.drawStrokesNormalized(ctx, this.freehandStrokes, size, "black", size * 0.12);
      
      this.lastProcessedCanvas = canvas; 

      try {
          const { data: { text } } = await this.worker.recognize(canvas);
          let cleanText = text.replace(/\s/g, "").replace(/[^IVXLC]/g, ""); 

          // --- ROMANJS VALIDATION LAYER ---
          // RomanJS.parse() returns NaN or throws if the string is not a valid numeral.
          let isValidRoman = false;
          try {
              const decimalValue = Roman.parse(cleanText); 
              if (!isNaN(decimalValue) && decimalValue > 0) {
                  isValidRoman = true;
              }
          } catch(e) { isValidRoman = false; }

          const tempStrokes = level.localStrokes.map(s => [{x: s.x1, y: s.y1}, {x: s.x2, y: s.y2}]);
          const overlapScore = this.calculateIoU(this.freehandStrokes, tempStrokes);

          console.log(`Target: ${level.symbol} | OCR: ${cleanText} | Valid: ${isValidRoman} | Match: ${(overlapScore*100).toFixed(1)}%`);

          // --- REFINED PRODUCTION LOGIC ---
          const isExactMatch = cleanText === level.symbol;
          const isPartialWithShape = cleanText.includes(level.symbol) && overlapScore > 0.30;
          const isShapeOnlyMatch = overlapScore > 0.60;

          // If the OCR finds a valid Roman numeral but it's WRONG, and the shape is also poor:
          if (isValidRoman && cleanText !== level.symbol && overlapScore < 0.25) {
              return this.triggerFail(); // Confidently wrong
          }

          if (isExactMatch || isPartialWithShape || isShapeOnlyMatch) { 
              this.levelCompleteTimer = 1;
              this.score += 20;
              this.cursorColor = "#00FFCC";
          } else {
              this.triggerFail();
          }
      } catch (err) {
          console.error(err);
          this.triggerFail();
      } finally {
          this.isProcessing = false;
      }
  },

  // Added 'weight' parameter to customize thickness for different checks
  drawStrokesNormalized(ctx, strokes, size, color = "#00FFFF", weight) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      strokes.forEach(s => s.forEach(p => {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }));
      if (minX === Infinity) return;

      // REDUCED PADDING: 15% -> 10% 
      // This gives the OCR more "character" to look at and reduces stretching distortion.
      const pad = size * 0.10; 
      const w = maxX - minX, h = maxY - minY;
      const scale = (size - pad * 2) / Math.max(w, h, 0.001);
      const ox = (size - w * scale) / 2, oy = (size - h * scale) / 2;

      ctx.strokeStyle = color;
      ctx.lineWidth = weight || (size * 0.08); 
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      strokes.forEach(s => {
          if (s.length < 2) return;
          ctx.moveTo((s[0].x - minX) * scale + ox, (s[0].y - minY) * scale + oy);
          for (let i = 1; i < s.length; i++) ctx.lineTo((s[i].x - minX) * scale + ox, (s[i].y - minY) * scale + oy);
      });
      ctx.stroke();
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
      let color = index < this.activeStrokeIndex ? "#00FF66" : 
                  index === this.activeStrokeIndex ? "#555" : "#2a2a2a";
      ctx.strokeStyle = color;
      let p1 = this.getPoint(s.x1, s.y1, w, h);
      let p2 = this.getPoint(s.x2, s.y2, w, h);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
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
        ctx.beginPath();
        ctx.moveTo(this.tracePoints[0].x, this.tracePoints[0].y);
        for (let i = 1; i < this.tracePoints.length; i++) ctx.lineTo(this.tracePoints[i].x, this.tracePoints[i].y);
        ctx.stroke();
    } else if (this.mode === "FREEHAND") {
        this.freehandStrokes.forEach(stroke => {
            if(stroke.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
            ctx.stroke();
        });
    }
    ctx.shadowBlur = 0;
  },

  drawCursor(ctx, baseUnit) {
      if (this.levelFailedTimer > 0 || this.levelCompleteTimer > 0) return; 
      ctx.beginPath(); ctx.fillStyle = this.isProcessing ? "orange" : this.cursorColor;
      ctx.arc(this.cursor.x, this.cursor.y, baseUnit * 0.015, 0, Math.PI*2); ctx.fill(); 
      ctx.strokeStyle = "black"; ctx.lineWidth = baseUnit * 0.005; ctx.stroke();
  },

  drawUI(ctx, w, h, baseUnit) {
    ctx.fillStyle = "white"; 
    ctx.font = `bold ${Math.max(16, baseUnit * 0.04)}px Arial`; 
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Score: " + this.score, baseUnit * 0.03, baseUnit * 0.03);

    const level = this.levels[this.currentLevel];
    ctx.textAlign = "center"; 
    ctx.font = `bold ${Math.max(24, baseUnit * 0.06)}px Arial`; 
    ctx.fillStyle = "#FFCC00"; ctx.shadowBlur = 10; ctx.shadowColor = "rgba(255, 204, 0, 0.5)";
    ctx.fillText("Number: " + level.number, w / 2, baseUnit * 0.05);
    ctx.shadowBlur = 0;

    if (this.isProcessing) {
        ctx.fillStyle = "#00FFCC"; ctx.font = "16px Arial";
        ctx.fillText("AI ANALYZING...", w / 2, baseUnit * 0.15);
    } else if (this.mode === "FREEHAND" && this.submitTimer > 0 && this.freehandStrokes.length > 0) {
        let progress = this.submitTimer / 60; 
        let barW = baseUnit * 0.3; 
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(w/2 - barW/2, baseUnit * 0.12, barW, baseUnit*0.015);
        ctx.fillStyle = "#00FFCC";
        ctx.fillRect(w/2 - barW/2, baseUnit * 0.12, barW * progress, baseUnit*0.015);
    }

    const btnW = Math.max(140, baseUnit * 0.25), btnH = Math.max(50, baseUnit * 0.08); 
    const btnY = h - btnH - (baseUnit * 0.05); 
    const traceX = w / 2 - btnW - (baseUnit * 0.02), freeX = w / 2 + (baseUnit * 0.02);

    ctx.font = `bold ${Math.max(12, baseUnit * 0.025)}px Arial`; ctx.textBaseline = "middle";
    ctx.fillStyle = this.mode === "TRACE" ? "#00FFCC" : "#444";
    ctx.fillRect(traceX, btnY, btnW, btnH);
    ctx.fillStyle = this.mode === "TRACE" ? "black" : "white";
    ctx.fillText("TRACE", traceX + btnW/2, btnY + btnH/2);

    ctx.fillStyle = this.mode === "FREEHAND" ? "#FF4444" : "#444";
    ctx.fillRect(freeX, btnY, btnW, btnH);
    ctx.fillStyle = "white";
    ctx.fillText("FREEHAND", freeX + btnW/2, btnY + btnH/2);
  },

  drawSuccessEffect(ctx, w, h, baseUnit) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = "rgba(0, 255, 100, 0.2)"; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); 
    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.1}px Arial`; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 20; ctx.shadowColor = "#00FF66"; ctx.fillText("NICE!", w/2, h/2);
  },

  drawFailEffect(ctx, w, h, baseUnit) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = "rgba(255, 50, 50, 0.15)"; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); 
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#FF4444"; ctx.font = `bold ${baseUnit * 0.1}px Arial`; 
    ctx.fillText("WRONG!", w/2, h/2 - (baseUnit * 0.05));
    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.04}px Arial`; 
    ctx.fillText("Try again or use TRACE!", w/2, h/2 + (baseUnit * 0.08));
  },

  pointToLineDist(px, py, x1, y1, x2, y2) {
    const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D, len_sq = C * C + D * D;
    let param = len_sq !== 0 ? dot / len_sq : -1;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(px - xx, py - yy);
  },

  spawnParticle(x, y, burst = false, baseUnit) {
    const angle = Math.random() * Math.PI * 2;
    const mult = baseUnit * 0.005; 
    const speed = burst ? (Math.random() * 5 + 2) * mult : (Math.random() * 2 + 1) * mult;
    this.particles.push({ 
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, 
        life: 1.0, color: `hsl(${Math.random()*60 + 160}, 100%, 70%)`, size: baseUnit * 0.008
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
          ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); 
      } 
      ctx.globalAlpha = 1.0; 
  },

  setMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.resetLevel();
  },

  toRoman(num) {
    const map = [
      { value: 100, numeral: "C" }, { value: 90, numeral: "XC" },
      { value: 50, numeral: "L" }, { value: 40, numeral: "XL" },
      { value: 10, numeral: "X" }, { value: 9, numeral: "IX" },
      { value: 5, numeral: "V" }, { value: 4, numeral: "IV" },
      { value: 1, numeral: "I" }
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
      // Use RomanJS for guaranteed correct symbols
      const roman = Roman.stringify(i); 
      this.levels.push({
        symbol: roman, 
        number: i.toString(),
        strokes: this.buildStrokesFromRoman(roman),
        localStrokes: this.buildLocalFromRoman(roman)
      });
    }
  },

  buildStrokesFromRoman(roman) {
    const chars = roman.split(""); const strokes = [];
    const spacing = 0.15; const startX = 0.5 - (chars.length - 1) * spacing / 2;
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
    const chars = roman.split(""); const strokes = [];
    const spacing = 1.2; const startX = 0.5 - (chars.length * spacing) / 2 + spacing / 2;
    chars.forEach((ch, index) => {
      const offset = startX + index * spacing;
      if (ch === "I") strokes.push({ x1: offset, y1: 0, x2: offset, y2: 1 });
      if (ch === "V") strokes.push({ x1: offset - 0.5, y1: 0, x2: offset, y2: 1 }, { x1: offset, y1: 1, x2: offset + 0.5, y2: 0 });
      if (ch === "X") strokes.push({ x1: offset - 0.5, y1: 0, x2: offset + 0.5, y2: 1 }, { x1: offset + 0.5, y1: 0, x2: offset - 0.5, y2: 1 });
      if (ch === "L") strokes.push({ x1: offset - 0.5, y1: 0, x2: offset - 0.5, y2: 1 }, { x1: offset - 0.5, y1: 1, x2: offset + 0.5, y2: 1 });
      if (ch === "C") strokes.push({ x1: offset + 0.5, y1: 0, x2: offset - 0.5, y2: 0.5 }, { x1: offset - 0.5, y1: 0.5, x2: offset + 0.5, y2: 1 });
    });
    return strokes;
  }
};