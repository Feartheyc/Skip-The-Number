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
  
  // State
  mode: "TRACE", 
  currentLevel: 0,
  
  // TRACE MODE State
  tracePoints: [], 
  activeStrokeIndex: 0, 
  currentStrokeProgress: 0, 

  // FREEHAND MODE State
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

  init() {
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
    this.generateLevels();
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
    this.particles = [];
    this.cursorColor = "white"; 
  },

  getPoint(sx, sy, w, h) {
      const size = Math.min(w, h) * 0.50; 
      const cx = w / 2;
      const cy = h / 2 - (h * 0.05); 
      return { x: cx + (sx - 0.5) * size, y: cy + (sy - 0.5) * size };
  },

  /* ==============================
     INPUT HANDLING
  ============================== */
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
                // Only save points if finger moved significantly (keeps math clean)
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
            this.submitTimer = 120; // Give them 2 seconds to draw next line
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

  const insideTrace =
    x >= traceX && x <= traceX + btnW &&
    y >= btnY && y <= btnY + btnH;

  const insideFree =
    x >= freeX && x <= freeX + btnW &&
    y >= btnY && y <= btnY + btnH;

  if (insideTrace) {
    this.setMode("TRACE");
    return true;
  }

  if (insideFree) {
    this.setMode("FREEHAND");
    return true;
  }

  return false;
},

  /* ===============================
     UPDATE LOOP
  ============================== */
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

    if (this.levelCompleteTimer === 0 && this.levelFailedTimer === 0) {
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
    this.drawCursor(ctx, baseUnit); 
    this.drawUI(ctx, w, h, baseUnit);
    
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

  /* ==============================
     1. TRACE MODE LOGIC
  ============================== */
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

  /* ==============================
     2. THE NEW FROM-SCRATCH AI
  ============================== */
  handleFreehand(baseUnit) {
      if (!this.isDrawing && this.freehandStrokes.length > 0) {
          if (this.submitTimer > 0) {
              this.submitTimer--;
              if (this.submitTimer <= 0) {
                  this.evaluateShapeVector(baseUnit);
              }
          }
      }
  },

  evaluateShapeVector(baseUnit) {
      // 1. Gather all drawn points
      let pts = [];
      this.freehandStrokes.forEach(s => pts.push(...s));
      
      // Filter out accidental clicks
      if (pts.length < 5) { this.triggerFail(); return; }

      // 2. Find the bounding box of whatever they drew
      let minX = Math.min(...pts.map(p=>p.x)), maxX = Math.max(...pts.map(p=>p.x));
      let minY = Math.min(...pts.map(p=>p.y)), maxY = Math.max(...pts.map(p=>p.y));
      
      let w = maxX - minX;
      let h = maxY - minY;
      
      // Fix for straight vertical/horizontal lines
      if (w < 40) { minX -= 20; w = 40; }
      if (h < 40) { minY -= 20; h = 40; }

      // 3. Normalize all points to 0.0 - 1.0 based on their own drawing
      let normPts = pts.map(p => ({
          x: (p.x - minX) / w,
          y: (p.y - minY) / h
      }));

      const level = this.levels[this.currentLevel];
      const template = level.localStrokes;

      // --- TEST 1: Neatness (Did they scribble outside the lines?) ---
      let neatPoints = 0;
      normPts.forEach(p => {
          let closestDist = Infinity;
          template.forEach(ts => {
              let d = this.pointToLineDist(p.x, p.y, ts.x1, ts.y1, ts.x2, ts.y2);
              if (d < closestDist) closestDist = d;
          });
          // Allow a 20% margin of error off the perfect line
          if (closestDist < 0.20) neatPoints++; 
      });
      let neatness = neatPoints / normPts.length;

      // --- TEST 2: Coverage (Did they draw the whole letter?) ---
      let totalSamples = 0;
      let coveredSamples = 0;
      
      template.forEach(ts => {
          let steps = 15; // Sample 15 checkpoints along every perfect line
          for(let i=0; i<=steps; i++) {
              totalSamples++;
              let targetX = ts.x1 + (ts.x2 - ts.x1) * (i/steps);
              let targetY = ts.y1 + (ts.y2 - ts.y1) * (i/steps);
              
              let closestDist = Infinity;
              normPts.forEach(p => {
                  let d = Math.hypot(p.x - targetX, p.y - targetY);
                  if (d < closestDist) closestDist = d;
              });
              // Must draw within 25% of the checkpoint
              if (closestDist < 0.25) coveredSamples++;
          }
      });
      let coverage = coveredSamples / totalSamples;

      console.log(`Vector AI -> Coverage: ${(coverage*100).toFixed(0)}% | Neatness: ${(neatness*100).toFixed(0)}%`);

      // 4. Final Decision
      if (coverage > 0.60 && neatness > 0.60) {
          this.levelCompleteTimer = 1;
          this.score += 20; 
          this.cursorColor = "#00FFCC";
          let lastPoint = pts[pts.length-1];
          for(let i=0; i<40; i++) this.spawnParticle(lastPoint.x, lastPoint.y, true, baseUnit);
      } else {
          this.triggerFail();
      }
  },

  triggerFail() {
      this.levelFailedTimer = 1;
      this.shakeTimer = 25; 
      this.cursorColor = "#FF4444";
  },

  /* ==============================
     DRAWING HELPERS 
  ============================== */
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
      ctx.fillStyle = "#FFCC00"; 
      ctx.beginPath(); 
      let startP = this.getPoint(active.x1, active.y1, w, h);
      ctx.arc(startP.x, startP.y, (baseUnit * 0.02) + pulse, 0, Math.PI*2); 
      ctx.fill();
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
    
    if (this.levelFailedTimer > 0) {
        ctx.strokeStyle = "#FF4444"; ctx.shadowColor = "red";
    } else {
        ctx.strokeStyle = "#00FFFF"; ctx.shadowColor = "cyan";
    }
    
    ctx.shadowBlur = baseUnit * 0.02;
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    if (this.mode === "TRACE" && this.tracePoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(this.tracePoints[0].x, this.tracePoints[0].y);
        for (let i = 1; i < this.tracePoints.length; i++) ctx.lineTo(this.tracePoints[i].x, this.tracePoints[i].y);
        ctx.stroke();
    } 
    else if (this.mode === "FREEHAND") {
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
      
      ctx.beginPath(); ctx.fillStyle = this.cursorColor;
      ctx.arc(this.cursor.x, this.cursor.y, baseUnit * 0.015, 0, Math.PI*2); ctx.fill(); 
      ctx.strokeStyle = "black";
      ctx.lineWidth = baseUnit * 0.005;
      ctx.stroke();
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

    if (this.mode === "FREEHAND" && this.submitTimer > 0 && this.freehandStrokes.length > 0 && this.levelFailedTimer === 0) {
        let progress = this.submitTimer / 120; 
        let barW = baseUnit * 0.3; 
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(w/2 - barW/2, baseUnit * 0.12, barW, baseUnit*0.015);
        ctx.fillStyle = "#00FFCC";
        ctx.fillRect(w/2 - barW/2, baseUnit * 0.12, barW * progress, baseUnit*0.015);
    } else if (this.mode === "FREEHAND" && this.freehandStrokes.length === 0 && this.levelFailedTimer === 0) {
        ctx.font = `${Math.max(14, baseUnit * 0.03)}px Arial`; ctx.fillStyle = "#888";
        ctx.fillText("Draw anywhere! Any size!", w / 2, baseUnit * 0.12);
    }

    const btnW = Math.max(140, baseUnit * 0.25); 
    const btnH = Math.max(50, baseUnit * 0.08); 
    const btnY = h - btnH - (baseUnit * 0.05); 
    const traceX = w / 2 - btnW - (baseUnit * 0.02); 
    const freeX = w / 2 + (baseUnit * 0.02);

    ctx.font = `bold ${Math.max(12, baseUnit * 0.025)}px Arial`; ctx.textBaseline = "middle";

    ctx.fillStyle = this.mode === "TRACE" ? "#00FFCC" : "#444";
    ctx.fillRect(traceX, btnY, btnW, btnH);
    ctx.strokeStyle = "white"; ctx.lineWidth = baseUnit * 0.005; ctx.strokeRect(traceX, btnY, btnW, btnH);
    ctx.fillStyle = this.mode === "TRACE" ? "black" : "white";
    ctx.fillText("TRACE", traceX + btnW/2, btnY + btnH/2);

    ctx.fillStyle = this.mode === "FREEHAND" ? "#FF4444" : "#444";
    ctx.fillRect(freeX, btnY, btnW, btnH);
    ctx.strokeRect(freeX, btnY, btnW, btnH);
    ctx.fillStyle = this.mode === "FREEHAND" ? "white" : "white";
    ctx.fillText("FREEHAND", freeX + btnW/2, btnY + btnH/2);
  },

  drawSuccessEffect(ctx, w, h, baseUnit) {
    const canvas = ctx.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = "rgba(0, 255, 100, 0.2)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore(); 

    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.1}px Arial`; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 20; ctx.shadowColor = "#00FF66";
    ctx.fillText("NICE!", w/2, h/2);
  },

  drawFailEffect(ctx, w, h, baseUnit) {
    const canvas = ctx.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = "rgba(255, 50, 50, 0.15)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore(); 

    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#FF4444"; ctx.font = `bold ${baseUnit * 0.1}px Arial`; 
    ctx.shadowBlur = 20; ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
    ctx.fillText("WRONG!", w/2, h/2 - (baseUnit * 0.05));
    
    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.04}px Arial`; 
    ctx.shadowBlur = 10; ctx.shadowColor = "black";
    ctx.fillText("Use TRACE mode if you forgot!", w/2, h/2 + (baseUnit * 0.08));
  },

  pointToLineDist(px, py, x1, y1, x2, y2) {
    const A = px - x1; const B = py - y1; const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D; const len_sq = C * C + D * D;
    let param = -1; if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = px - xx; const dy = py - yy; return Math.sqrt(dx * dx + dy * dy);
  },

  spawnParticle(x, y, burst = false, baseUnit) {
    const angle = Math.random() * Math.PI * 2;
    const mult = baseUnit ? baseUnit * 0.005 : 2; 
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

  setMode(newMode) {
  if (this.mode === newMode) return;
  this.mode = newMode;

  // Reset all drawing state when switching modes
  this.resetLevel();
},


toRoman(num) {
  const map = [
    { value: 100, numeral: "C" },
    { value: 90, numeral: "XC" },
    { value: 50, numeral: "L" },
    { value: 40, numeral: "XL" },
    { value: 10, numeral: "X" },
    { value: 9, numeral: "IX" },
    { value: 5, numeral: "V" },
    { value: 4, numeral: "IV" },
    { value: 1, numeral: "I" }
  ];

  let result = "";

  for (let i = 0; i < map.length; i++) {
    while (num >= map[i].value) {
      result += map[i].numeral;
      num -= map[i].value;
    }
  }

  return result;
},


generateLevels() {
  this.levels = [];

  for (let i = 1; i <= 100; i++) {
    const roman = this.toRoman(i);

    this.levels.push({
      symbol: roman,
      number: i.toString(),
      strokes: this.buildStrokesFromRoman(roman),
      localStrokes: this.buildLocalFromRoman(roman)
    });
  }
},

buildStrokesFromRoman(roman) {
  const chars = roman.split("");
  const strokes = [];

  const spacing = 0.15;
  const startX = 0.5 - (chars.length - 1) * spacing / 2;

  chars.forEach((ch, index) => {
    const offset = startX + index * spacing;

    if (ch === "I") {
      strokes.push({ x1: offset, y1: 0.2, x2: offset, y2: 0.8 });
    }

    if (ch === "V") {
      strokes.push(
        { x1: offset - 0.05, y1: 0.2, x2: offset, y2: 0.8 },
        { x1: offset, y1: 0.8, x2: offset + 0.05, y2: 0.2 }
      );
    }

    if (ch === "X") {
      strokes.push(
        { x1: offset - 0.05, y1: 0.2, x2: offset + 0.05, y2: 0.8 },
        { x1: offset + 0.05, y1: 0.2, x2: offset - 0.05, y2: 0.8 }
      );
    }

    if (ch === "L") {
      strokes.push(
        { x1: offset - 0.05, y1: 0.2, x2: offset - 0.05, y2: 0.8 },
        { x1: offset - 0.05, y1: 0.8, x2: offset + 0.05, y2: 0.8 }
      );
    }

    if (ch === "C") {
      // Simple C shape using 2 lines
      strokes.push(
        { x1: offset + 0.05, y1: 0.2, x2: offset - 0.05, y2: 0.5 },
        { x1: offset - 0.05, y1: 0.5, x2: offset + 0.05, y2: 0.8 }
      );
    }
  });

  return strokes;
},

buildLocalFromRoman(roman) {
  const chars = roman.split("");
  const strokes = [];

  chars.forEach((ch) => {
    if (ch === "I") strokes.push({ x1: 0.5, y1: 0, x2: 0.5, y2: 1 });

    if (ch === "V") strokes.push(
      { x1: 0, y1: 0, x2: 0.5, y2: 1 },
      { x1: 0.5, y1: 1, x2: 1, y2: 0 }
    );

    if (ch === "X") strokes.push(
      { x1: 0, y1: 0, x2: 1, y2: 1 },
      { x1: 1, y1: 0, x2: 0, y2: 1 }
    );

    if (ch === "L") strokes.push(
      { x1: 0, y1: 0, x2: 0, y2: 1 },
      { x1: 0, y1: 1, x2: 1, y2: 1 }
    );

    if (ch === "C") strokes.push(
      { x1: 1, y1: 0, x2: 0, y2: 0.5 },
      { x1: 0, y1: 0.5, x2: 1, y2: 1 }
    );
  });

  return strokes;
}

};