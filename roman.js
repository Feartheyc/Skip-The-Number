const Game5 = {

  running: false,
  score: 0,
  
  // State
  mode: "TRACE", 
  currentLevel: 0,
  tracePoints: [], 
  activeStrokeIndex: 0, 
  
  // Particles System
  particles: [],

  // Input State
  isDrawing: false,
  cursor: { x: 0, y: 0 },
  cursorColor: "white", // Changes to red on error

  // Configuration
  snapDistance: 45, 
  jumpLimit: 0.15, 

  // Roman Numeral Data
  levels: [
    { 
      symbol: "I", 
      number: "1", 
      strokes: [ { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8 } ] 
    },
    { 
      symbol: "V", 
      number: "5", 
      strokes: [
        { x1: 0.3, y1: 0.2, x2: 0.5, y2: 0.8 }, 
        { x1: 0.5, y1: 0.8, x2: 0.7, y2: 0.2 }  
      ]
    },
    { 
      symbol: "X", 
      number: "10", 
      strokes: [
        { x1: 0.3, y1: 0.2, x2: 0.7, y2: 0.8 }, 
        { x1: 0.7, y1: 0.2, x2: 0.3, y2: 0.8 } 
      ]
    },
    { 
      symbol: "L", 
      number: "50", 
      strokes: [
        { x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.8 }, 
        { x1: 0.4, y1: 0.8, x2: 0.7, y2: 0.8 }  
      ]
    },
    { 
      symbol: "III", 
      number: "3", 
      strokes: [
        { x1: 0.35, y1: 0.2, x2: 0.35, y2: 0.8 },
        { x1: 0.45, y1: 0.2, x2: 0.45, y2: 0.8 },
        { x1: 0.60, y1: 0.2, x2: 0.60, y2: 0.8 }
      ]
    }
  ],

  currentStrokeProgress: 0, 
  levelCompleteTimer: 0,
  listenersAdded: false,

  /* ==============================
     INIT
  ============================== */
  init() {
    this.running = true;
    this.score = 0;
    this.currentLevel = 0;
    this.mode = "TRACE"; 
    this.resetLevel();

    if (!this.listenersAdded) {
      this.addInputListeners();
      this.listenersAdded = true;
    }
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
    this.levelCompleteTimer = 0;
    this.isDrawing = false;
    this.particles = [];
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
    };

    const moveDraw = (e) => {
        if (this.isDrawing) this.updateCursor(e);
    };

    const endDraw = () => {
        this.isDrawing = false;
        this.tracePoints = []; 
        this.cursorColor = "white"; // Reset color
    };

    // Mouse
    canvas.addEventListener('mousedown', startDraw);
    window.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);

    // Touch
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
    const canvas = document.getElementById('game_canvas');
    const w = canvas.width;
    const h = canvas.height;
    
    const btnW = 120; const btnH = 40; const btnY = h - 60;
    const traceX = w / 2 - 130;
    const freeX = w / 2 + 10;

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

    // Background
    ctx.fillStyle = "#222"; 
    ctx.fillRect(0, 0, w, h);

    // Logic
    if (this.levelCompleteTimer === 0 && this.isDrawing) {
      this.handleTracing(w, h);
    }
    
    // Update Particles
    this.updateParticles();

    // Render
    this.drawTemplate(ctx, w, h);
    this.drawUserInk(ctx);
    this.drawParticles(ctx); // Draw sparks
    this.drawCursor(ctx); // Draw custom cursor
    this.drawUI(ctx);

    // Success Animation
    if (this.levelCompleteTimer > 0) {
      this.levelCompleteTimer++;
      this.drawSuccessEffect(ctx, w, h);
      
      if (this.levelCompleteTimer > 80) { 
        this.currentLevel++;
        if (this.currentLevel >= this.levels.length) this.currentLevel = 0;
        this.resetLevel();
      }
    }
  },

  /* ==============================
     TRACING LOGIC
  ============================== */
  handleTracing(w, h) {
    const level = this.levels[this.currentLevel];
    const stroke = level.strokes[this.activeStrokeIndex];
    if (!stroke) return;

    const p1 = { x: stroke.x1 * w, y: stroke.y1 * h };
    const p2 = { x: stroke.x2 * w, y: stroke.y2 * h };

    const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const distToStart = Math.hypot(this.cursor.x - p1.x, this.cursor.y - p1.y);
    const distToLine = this.pointToLineDist(this.cursor.x, this.cursor.y, p1.x, p1.y, p2.x, p2.y);

    const currentSnap = this.mode === "FREEHAND" ? 100 : 45;

    // ERROR FEEDBACK: If far away, turn cursor RED
    if (distToLine > currentSnap) {
        this.cursorColor = "#FF4444";
        return;
    }

    const newProgress = Math.min(1, Math.max(0, distToStart / lineLen));
    const startTolerance = this.mode === "FREEHAND" ? 0.2 : 0.1;

    // ERROR FEEDBACK: If jumping too far
    if (this.currentStrokeProgress === 0 && newProgress > startTolerance) {
        this.cursorColor = "#FF4444"; 
        return;
    }
    if (newProgress > this.currentStrokeProgress + this.jumpLimit) {
        return; // Just ignore, don't flash red for speed, just stop drawing
    }

    // SUCCESS: Drawing Forward
    if (newProgress > this.currentStrokeProgress) {
      this.currentStrokeProgress = newProgress;
      this.tracePoints.push({ x: this.cursor.x, y: this.cursor.y });
      this.cursorColor = "#00FFCC"; // Green when drawing correctly
      
      // SPAWN PARTICLES!
      if (Math.random() > 0.5) {
        this.spawnParticle(this.cursor.x, this.cursor.y);
      }
    }

    if (this.currentStrokeProgress >= 0.95) {
      this.completeStroke();
    }
  },

  completeStroke() {
    this.activeStrokeIndex++;
    this.currentStrokeProgress = 0;
    this.tracePoints = []; 
    this.score += 10;
    
    // Burst of particles on completion
    for(let i=0; i<20; i++) {
        const lastPt = this.cursor; 
        this.spawnParticle(lastPt.x, lastPt.y, true);
    }

    if (this.activeStrokeIndex >= this.levels[this.currentLevel].strokes.length) {
      this.levelCompleteTimer = 1; 
    }
  },

  /* ==============================
     PARTICLE SYSTEM
  ============================== */
  spawnParticle(x, y, burst = false) {
    const angle = Math.random() * Math.PI * 2;
    const speed = burst ? Math.random() * 5 + 2 : Math.random() * 2 + 1;
    this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0, // 100% opacity
        color: `hsl(${Math.random()*60 + 160}, 100%, 70%)` // Cyan/Green/Blue hues
    });
  },

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05; // Fade out
        if (p.life <= 0) this.particles.splice(i, 1);
    }
  },

  drawParticles(ctx) {
    for (let p of this.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  },

  /* ==============================
     DRAWING HELPERS
  ============================== */
  drawTemplate(ctx, w, h) {
    const level = this.levels[this.currentLevel];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    level.strokes.forEach((s, index) => {
      ctx.beginPath();
      ctx.lineWidth = 40;
      
      let shouldDraw = false;
      let color = "";

      if (index < this.activeStrokeIndex) {
        shouldDraw = true; color = "#00FF66"; 
      } 
      else if (this.mode === "TRACE") {
        shouldDraw = true;
        color = index === this.activeStrokeIndex ? "#444" : "#2a2a2a";
      }

      if (shouldDraw) {
        ctx.strokeStyle = color;
        ctx.moveTo(s.x1 * w, s.y1 * h);
        ctx.lineTo(s.x2 * w, s.y2 * h);
        ctx.stroke();
      }

      // Draw ARROWS for Guidance (New!)
      if (shouldDraw && index === this.activeStrokeIndex) {
        this.drawArrow(ctx, s.x1*w, s.y1*h, s.x2*w, s.y2*h);
      }
    });

    // Start Dot
    const active = level.strokes[this.activeStrokeIndex];
    if (active) {
      const pulse = Math.sin(Date.now() / 150) * 4;
      ctx.fillStyle = "#FFCC00"; 
      ctx.beginPath(); 
      ctx.arc(active.x1 * w, active.y1 * h, 12 + pulse, 0, Math.PI*2); 
      ctx.fill();
    }
  },

  drawArrow(ctx, x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, 0);
    ctx.lineTo(-10, 10);
    ctx.fill();
    
    ctx.restore();
  },

  drawUserInk(ctx) {
    if (this.tracePoints.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = 15;
    ctx.strokeStyle = "#00FFFF"; 
    ctx.shadowBlur = 15;
    ctx.shadowColor = "cyan";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(this.tracePoints[0].x, this.tracePoints[0].y);
    for (let i = 1; i < this.tracePoints.length; i++) {
      ctx.lineTo(this.tracePoints[i].x, this.tracePoints[i].y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  },

  drawCursor(ctx) {
      // Draw a circle following the finger/mouse
      ctx.beginPath();
      ctx.fillStyle = this.cursorColor;
      ctx.arc(this.cursor.x, this.cursor.y, 10, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.stroke();
  },

  drawUI(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // Score
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score: " + this.score, 20, 20);

    // Hint
    const level = this.levels[this.currentLevel];
    ctx.textAlign = "center";
    ctx.font = "bold 50px Arial";
    ctx.fillStyle = "#FFCC00"; 
    ctx.fillText("Number: " + level.number, w / 2, 40);

    // Buttons
    const btnW = 120; const btnH = 40; const btnY = h - 60;
    const traceX = w / 2 - 130; const freeX = w / 2 + 10;

    ctx.font = "bold 16px Arial";
    ctx.textBaseline = "middle";

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

  drawSuccessEffect(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 255, 100, 0.2)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "white";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NICE!", w/2, h/2);
    ctx.restore();
  },

  pointToLineDist(px, py, x1, y1, x2, y2) {
    const A = px - x1; const B = py - y1;
    const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = px - xx; const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
};