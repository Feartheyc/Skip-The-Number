const Game5 = {

  running: false,
  score: 0,
  
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

  // Configuration
  snapDistance: 45, 
  jumpLimit: 0.15, 

  // Roman Numeral Data (FIXED: III is perfectly symmetrical now)
  levels: [
    { symbol: "I", number: "1", strokes: [ { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8 } ] },
    { symbol: "V", number: "5", strokes: [
        { x1: 0.3, y1: 0.2, x2: 0.5, y2: 0.8 }, 
        { x1: 0.5, y1: 0.8, x2: 0.7, y2: 0.2 }  
      ] },
    { symbol: "X", number: "10", strokes: [
        { x1: 0.3, y1: 0.2, x2: 0.7, y2: 0.8 }, 
        { x1: 0.7, y1: 0.2, x2: 0.3, y2: 0.8 } 
      ] },
    { symbol: "L", number: "50", strokes: [
        { x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.8 }, 
        { x1: 0.4, y1: 0.8, x2: 0.7, y2: 0.8 }  
      ] },
    { symbol: "III", number: "3", strokes: [
        { x1: 0.3, y1: 0.2, x2: 0.3, y2: 0.8 },
        { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8 },
        { x1: 0.7, y1: 0.2, x2: 0.7, y2: 0.8 }
      ] }
  ],

  levelCompleteTimer: 0,
  levelFailedTimer: 0, 
  listenersAdded: false,
  offCtx: null, 

  /* ==============================
     INIT & HIGH-DPI SCALING
  ============================== */
  init() {
    this.running = true;
    this.score = 0;
    this.currentLevel = 0;
    this.mode = "TRACE"; 
    
    this.resizeCanvas();
    
    if (!this.offCtx) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 64; offCanvas.height = 64;
        this.offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    }

    // Generate perfect pixel templates
    this.levels.forEach(level => {
        let pathStrokes = level.strokes.map(s => [ {x: s.x1, y: s.y1}, {x: s.x2, y: s.y2} ]);
        level.templateData = this.rasterizeStrokes(pathStrokes);
    });

    this.resetLevel();

    if (!this.listenersAdded) {
      this.addInputListeners();
      window.addEventListener('resize', () => { if (this.running) this.resizeCanvas(); });
      this.listenersAdded = true;
    }
  },

  resizeCanvas() {
    const canvas = document.getElementById('game_canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  },

  setMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.resetLevel();
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
                this.currentStroke.push({x: this.cursor.x, y: this.cursor.y});
                this.submitTimer = 0; 
            }
        }
    };

    const endDraw = () => {
        this.isDrawing = false;
        if (this.mode === "TRACE") {
            this.tracePoints = []; 
            this.cursorColor = "white"; 
        } else if (this.mode === "FREEHAND" && this.freehandStrokes.length > 0) {
            this.submitTimer = 120; // 2 seconds to allow kids to pause between strokes
        }
    };

    canvas.addEventListener('mousedown', startDraw);
    window.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);
    canvas.addEventListener('touchstart', (e) => { startDraw(e.touches[0]); e.preventDefault(); }, {passive: false});
    canvas.addEventListener('touchmove', (e) => { moveDraw(e.touches[0]); e.preventDefault(); }, {passive: false});
    window.addEventListener('touchend', endDraw);
  },

  updateCursor(e) {
    const canvas = document.getElementById('game_canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    this.cursor.x = (e.clientX - rect.left) * scaleX;
    this.cursor.y = (e.clientY - rect.top) * scaleY;
  },

  checkButtonClicks() {
    const w = document.getElementById('game_canvas').width;
    const h = document.getElementById('game_canvas').height;
    const baseUnit = Math.min(w, h);
    
    const btnW = Math.max(140, baseUnit * 0.3); 
    const btnH = Math.max(40, baseUnit * 0.1); 
    const btnY = h - btnH - (baseUnit * 0.05); 
    
    const traceX = w / 2 - btnW - (baseUnit * 0.02); 
    const freeX = w / 2 + (baseUnit * 0.02);

    if (this.cursor.x >= traceX && this.cursor.x <= traceX + btnW && this.cursor.y >= btnY && this.cursor.y <= btnY + btnH) {
      this.setMode("TRACE"); return true;
    }
    if (this.cursor.x >= freeX && this.cursor.x <= freeX + btnW && this.cursor.y >= btnY && this.cursor.y <= btnY + btnH) {
      this.setMode("FREEHAND"); return true;
    }
    return false;
  },

  /* ==============================
     UPDATE LOOP
  ============================== */
  update(ctx) {
    if (!this.running) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const baseUnit = Math.min(w, h); 

    ctx.fillStyle = "#222"; 
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (this.shakeTimer > 0) {
        const shakeAmt = baseUnit * 0.02;
        ctx.translate((Math.random()-0.5)*shakeAmt, (Math.random()-0.5)*shakeAmt);
        this.shakeTimer--;
    }

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
    
    ctx.restore(); 
    this.drawUI(ctx, w, h, baseUnit);

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
  },

  /* ==============================
     1. TRACE MODE LOGIC 
  ============================== */
  handleTracing(w, h, baseUnit) {
    const level = this.levels[this.currentLevel];
    const stroke = level.strokes[this.activeStrokeIndex];
    if (!stroke) return;

    const p1 = { x: stroke.x1 * w, y: stroke.y1 * h };
    const p2 = { x: stroke.x2 * w, y: stroke.y2 * h };

    const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const distToStart = Math.hypot(this.cursor.x - p1.x, this.cursor.y - p1.y);
    const distToLine = this.pointToLineDist(this.cursor.x, this.cursor.y, p1.x, p1.y, p2.x, p2.y);

    const snapAllowed = baseUnit * 0.12; 

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
     2. FREEHAND MODE LOGIC
  ============================== */
  handleFreehand(baseUnit) {
      if (!this.isDrawing && this.freehandStrokes.length > 0) {
          if (this.submitTimer > 0) {
              this.submitTimer--;
              if (this.submitTimer <= 0) {
                  this.evaluateShape(baseUnit);
              }
          }
      }
  },

  evaluateShape(baseUnit) {
      let userData = this.rasterizeStrokes(this.freehandStrokes);
      let targetData = this.levels[this.currentLevel].templateData;

      let intersection = 0, templateInk = 0, userInk = 0;

      for(let i = 3; i < userData.length; i += 4) {
          let u = userData[i] > 128;
          let t = targetData[i] > 128;
          if (u) userInk++;
          if (t) templateInk++;
          if (u && t) intersection++;
      }

      let coverage = templateInk === 0 ? 0 : intersection / templateInk;
      let neatness = userInk === 0 ? 0 : intersection / userInk;

      console.log(`Checking shape... Coverage: ${(coverage*100).toFixed(0)}%, Neatness: ${(neatness*100).toFixed(0)}%`);

      // HIGHLY forgiving thresholds: 40% of shape covered, and up to 75% of ink can be messy.
      if (coverage > 0.40 && neatness > 0.25) { 
          this.levelCompleteTimer = 1;
          this.score += 20; 
          this.cursorColor = "#00FFCC";
          let lastPoint = this.freehandStrokes[this.freehandStrokes.length-1].slice(-1)[0];
          if (lastPoint) {
              for(let i=0; i<40; i++) this.spawnParticle(lastPoint.x, lastPoint.y, true, baseUnit);
          }
      } else {
          this.levelFailedTimer = 1;
          this.shakeTimer = 25; 
          this.cursorColor = "#FF4444";
      }
  },

  // Flattens aspect ratio AND removes stray dots
  rasterizeStrokes(strokes) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let validStrokes = [];

      // 1. FILTER OUT STRAY TAPS & GET BOUNDS
      strokes.forEach(stroke => {
          if (stroke.length < 2) return;
          
          let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
          stroke.forEach(pt => {
              if (pt.x < sMinX) sMinX = pt.x;
              if (pt.x > sMaxX) sMaxX = pt.x;
              if (pt.y < sMinY) sMinY = pt.y;
              if (pt.y > sMaxY) sMaxY = pt.y;
          });

          // Ignore tiny accidental dots that mess up the bounding box
          if ((sMaxX - sMinX) < 0.01 && (sMaxY - sMinY) < 0.01) return;

          validStrokes.push(stroke);

          if (sMinX < minX) minX = sMinX;
          if (sMaxX > maxX) maxX = sMaxX;
          if (sMinY < minY) minY = sMinY;
          if (sMaxY > maxY) maxY = sMaxY;
      });

      const ctx = this.offCtx;
      ctx.clearRect(0,0,64,64);

      if (validStrokes.length === 0) {
          return ctx.getImageData(0,0,64,64).data;
      }

      let w = maxX - minX; let h = maxY - minY;
      let cx = minX + w/2; let cy = minY + h/2;

      // 2. DRAW NORMALIZED SHAPE
      ctx.lineWidth = 18; // Super thick virtual ink so wobbly lines still pass
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "white";

      let stretchX = w; let stretchY = h;
      // Prevent straight lines from getting infinitely fat
      if (w < h * 0.25) stretchX = h; 
      if (h < w * 0.25) stretchY = w;
      if (stretchX < 0.001) stretchX = 1;
      if (stretchY < 0.001) stretchY = 1;

      validStrokes.forEach(stroke => {
          ctx.beginPath();
          for(let i=0; i<stroke.length; i++) {
              let px = 32 + ((stroke[i].x - cx) / stretchX) * 40;
              let py = 32 + ((stroke[i].y - cy) / stretchY) * 40;
              if (i===0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
          }
          ctx.stroke();
      });

      return ctx.getImageData(0,0,64,64).data;
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
      ctx.lineWidth = baseUnit * 0.06;
      let color = index < this.activeStrokeIndex ? "#00FF66" : 
                  index === this.activeStrokeIndex ? "#555" : "#2a2a2a";

      ctx.strokeStyle = color;
      ctx.moveTo(s.x1 * w, s.y1 * h);
      ctx.lineTo(s.x2 * w, s.y2 * h);
      ctx.stroke();

      if (index === this.activeStrokeIndex) this.drawArrow(ctx, s.x1*w, s.y1*h, s.x2*w, s.y2*h, baseUnit);
    });

    const active = level.strokes[this.activeStrokeIndex];
    if (active) {
      const pulse = Math.sin(Date.now() / 150) * (baseUnit * 0.01);
      ctx.fillStyle = "#FFCC00"; 
      ctx.beginPath(); 
      ctx.arc(active.x1 * w, active.y1 * h, (baseUnit * 0.03) + pulse, 0, Math.PI*2); 
      ctx.fill();
    }
  },

  drawArrow(ctx, x1, y1, x2, y2, baseUnit) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = baseUnit * 0.02; 
    ctx.save(); ctx.translate((x1 + x2)/2, (y1 + y2)/2); ctx.rotate(angle);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.moveTo(-size, -size); ctx.lineTo(size, 0); ctx.lineTo(-size, size); ctx.fill();
    ctx.restore();
  },

  drawUserInk(ctx, baseUnit) {
    ctx.lineWidth = baseUnit * 0.04; 
    
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
      ctx.arc(this.cursor.x, this.cursor.y, baseUnit * 0.02, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "black"; ctx.lineWidth = 2; ctx.stroke();
  },

  drawUI(ctx, w, h, baseUnit) {
    ctx.fillStyle = "white"; 
    ctx.font = `bold ${Math.max(20, baseUnit * 0.05)}px Arial`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Score: " + this.score, baseUnit * 0.03, baseUnit * 0.03);

    const level = this.levels[this.currentLevel];
    ctx.textAlign = "center"; 
    ctx.font = `bold ${Math.max(30, baseUnit * 0.08)}px Arial`;
    ctx.fillStyle = "#FFCC00"; ctx.shadowBlur = 10; ctx.shadowColor = "rgba(255, 204, 0, 0.5)";
    ctx.fillText("Number: " + level.number, w / 2, baseUnit * 0.05);
    ctx.shadowBlur = 0;

    if (this.mode === "FREEHAND" && this.submitTimer > 0 && this.freehandStrokes.length > 0 && this.levelFailedTimer === 0) {
        let progress = this.submitTimer / 120; // Matches 2 second timer
        let barW = baseUnit * 0.4;
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(w/2 - barW/2, baseUnit * 0.15, barW, baseUnit*0.015);
        ctx.fillStyle = "#00FFCC";
        ctx.fillRect(w/2 - barW/2, baseUnit * 0.15, barW * progress, baseUnit*0.015);
    } else if (this.mode === "FREEHAND" && this.freehandStrokes.length === 0 && this.levelFailedTimer === 0) {
        ctx.font = `${Math.max(16, baseUnit * 0.04)}px Arial`; ctx.fillStyle = "#888";
        ctx.fillText("Draw anywhere! Any size!", w / 2, baseUnit * 0.15);
    }

    const btnW = Math.max(140, baseUnit * 0.3); 
    const btnH = Math.max(40, baseUnit * 0.1); 
    const btnY = h - btnH - (baseUnit * 0.05); 
    const traceX = w / 2 - btnW - (baseUnit * 0.02); 
    const freeX = w / 2 + (baseUnit * 0.02);

    ctx.font = `bold ${Math.max(14, baseUnit * 0.03)}px Arial`; ctx.textBaseline = "middle";

    ctx.fillStyle = this.mode === "TRACE" ? "#00FFCC" : "#444";
    ctx.fillRect(traceX, btnY, btnW, btnH);
    ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(traceX, btnY, btnW, btnH);
    ctx.fillStyle = this.mode === "TRACE" ? "black" : "white";
    ctx.fillText("TRACE", traceX + btnW/2, btnY + btnH/2);

    ctx.fillStyle = this.mode === "FREEHAND" ? "#FF4444" : "#444";
    ctx.fillRect(freeX, btnY, btnW, btnH);
    ctx.strokeRect(freeX, btnY, btnW, btnH);
    ctx.fillStyle = this.mode === "FREEHAND" ? "white" : "white";
    ctx.fillText("FREEHAND", freeX + btnW/2, btnY + btnH/2);
  },

  drawSuccessEffect(ctx, w, h, baseUnit) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 255, 100, 0.2)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.15}px Arial`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 20; ctx.shadowColor = "#00FF66";
    ctx.fillText("NICE!", w/2, h/2);
    ctx.restore();
  },

  drawFailEffect(ctx, w, h, baseUnit) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 50, 50, 0.15)"; 
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#FF4444"; ctx.font = `bold ${baseUnit * 0.15}px Arial`;
    ctx.shadowBlur = 20; ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
    ctx.fillText("WRONG!", w/2, h/2 - (baseUnit * 0.05));
    ctx.fillStyle = "white"; ctx.font = `bold ${baseUnit * 0.05}px Arial`;
    ctx.shadowBlur = 10; ctx.shadowColor = "black";
    ctx.fillText("Use TRACE mode if you forgot!", w/2, h/2 + (baseUnit * 0.1));
    ctx.restore();
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
    const mult = baseUnit * 0.005; 
    const speed = burst ? (Math.random() * 5 + 2) * mult : (Math.random() * 2 + 1) * mult;
    this.particles.push({ 
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, 
        life: 1.0, color: `hsl(${Math.random()*60 + 160}, 100%, 70%)`,
        size: baseUnit * 0.008 
    });
  },
  
  updateParticles() { 
      for (let i = this.particles.length - 1; i >= 0; i--) { 
          let p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.05; 
          if (p.life <= 0) this.particles.splice(i, 1); 
      } 
  },
  
  drawParticles(ctx) { 
      for (let p of this.particles) { 
          ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); 
          ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); 
      } 
      ctx.globalAlpha = 1.0; 
  }
};