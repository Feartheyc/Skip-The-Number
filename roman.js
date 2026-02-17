const Game5 = {

  running: false,
  score: 0,
  
  // State
  mode: "TRACE", // "TRACE" or "FREEHAND"
  currentLevel: 0,
  tracePoints: [], 
  activeStrokeIndex: 0, 
  
  // Input State
  isDrawing: false,
  cursor: { x: 0, y: 0 },

  // Configuration
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
      window.addEventListener('keydown', (e) => {
        if (e.key === '1') this.setMode("TRACE");
        if (e.key === '2') this.setMode("FREEHAND");
      });
      this.listenersAdded = true;
    }
    
    console.log("Game5 Init: Press 1 for Trace, 2 for Freehand");
  },

  setMode(newMode) {
    this.mode = newMode;
    this.resetLevel();
    console.log("Mode set to:", this.mode);
  },

  resetLevel() {
    this.tracePoints = [];
    this.activeStrokeIndex = 0;
    this.currentStrokeProgress = 0;
    this.levelCompleteTimer = 0;
    this.isDrawing = false;
  },

  /* ==============================
     INPUT HANDLING
  ============================== */
  addInputListeners() {
    const canvas = document.getElementById('game_canvas');

    canvas.addEventListener('mousedown', (e) => { this.isDrawing = true; this.updateCursor(e); });
    window.addEventListener('mousemove', (e) => { if (this.isDrawing) this.updateCursor(e); });
    window.addEventListener('mouseup', () => { this.isDrawing = false; this.tracePoints = []; });

    canvas.addEventListener('touchstart', (e) => {
      this.isDrawing = true;
      this.updateCursor(e.touches[0]);
      e.preventDefault(); 
    }, {passive: false});
    
    canvas.addEventListener('touchmove', (e) => {
      if (this.isDrawing) this.updateCursor(e.touches[0]);
      e.preventDefault();
    }, {passive: false});

    window.addEventListener('touchend', () => { this.isDrawing = false; this.tracePoints = []; });
  },

  updateCursor(e) {
    const canvas = document.getElementById('game_canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    this.cursor.x = (e.clientX - rect.left) * scaleX;
    this.cursor.y = (e.clientY - rect.top) * scaleY;
  },

  /* ==============================
     UPDATE LOOP
  ============================== */
  update(ctx) {
    if (!this.running) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.fillStyle = "#222"; 
    ctx.fillRect(0, 0, w, h);

    if (this.levelCompleteTimer === 0 && this.isDrawing) {
      this.handleTracing(w, h);
    }

    this.drawTemplate(ctx, w, h);
    this.drawUserInk(ctx);
    this.drawUI(ctx);

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

    // --- UPDATED LOGIC FOR FREEHAND ---
    
    // 1. DYNAMIC SNAP DISTANCE
    // In Freehand (blind) mode, we allow you to be 100px off!
    // In Trace (visible) mode, we require 45px accuracy.
    const currentSnap = this.mode === "FREEHAND" ? 100 : 45;

    if (distToLine > currentSnap) return;

    const newProgress = Math.min(1, Math.max(0, distToStart / lineLen));

    // 2. DYNAMIC START TOLERANCE
    // In Freehand, finding the exact start pixel is hard, so we allow starting at 20%
    const startTolerance = this.mode === "FREEHAND" ? 0.2 : 0.1;

    if (this.currentStrokeProgress === 0 && newProgress > startTolerance) return;

    // Rule 3: No teleporting forward
    if (newProgress > this.currentStrokeProgress + this.jumpLimit) return;

    if (newProgress > this.currentStrokeProgress) {
      this.currentStrokeProgress = newProgress;
      this.tracePoints.push({ x: this.cursor.x, y: this.cursor.y });
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

    if (this.activeStrokeIndex >= this.levels[this.currentLevel].strokes.length) {
      this.levelCompleteTimer = 1; 
    }
  },

  /* ==============================
     DRAWING HELPERS
  ============================== */
  drawTemplate(ctx, w, h) {
    const level = this.levels[this.currentLevel];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw Guides
    level.strokes.forEach((s, index) => {
      ctx.beginPath();
      ctx.lineWidth = 40;
      
      let shouldDraw = false;
      let color = "";

      if (index < this.activeStrokeIndex) {
        // Completed strokes are always visible
        shouldDraw = true;
        color = "#00FF66"; 
      } 
      else if (this.mode === "TRACE") {
        // Guides only visible in Trace Mode
        shouldDraw = true;
        color = index === this.activeStrokeIndex ? "#444" : "#2a2a2a";
      }

      if (shouldDraw) {
        ctx.strokeStyle = color;
        ctx.moveTo(s.x1 * w, s.y1 * h);
        ctx.lineTo(s.x2 * w, s.y2 * h);
        ctx.stroke();
      }
    });

    // --- START DOT (Crucial for Freehand) ---
    // We ALWAYS show the pulsing start dot so the user knows WHERE to touch.
    const active = level.strokes[this.activeStrokeIndex];
    if (active) {
      const pulse = Math.sin(Date.now() / 150) * 4; // Faster pulse
      ctx.fillStyle = "#FFCC00"; 
      ctx.beginPath(); 
      ctx.arc(active.x1 * w, active.y1 * h, 12 + pulse, 0, Math.PI*2); 
      ctx.fill();
    }
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

  drawUI(ctx) {
    // Score
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score: " + this.score, 20, 20);

    // Mode
    ctx.font = "20px Arial";
    ctx.fillStyle = this.mode === "TRACE" ? "#00FFCC" : "#FF4444";
    ctx.fillText("Mode: " + this.mode, 20, 60);

    // Number Hint
    const level = this.levels[this.currentLevel];
    ctx.textAlign = "center";
    ctx.font = "bold 50px Arial";
    ctx.fillStyle = "#FFCC00"; 
    ctx.fillText("Number: " + level.number, ctx.canvas.width / 2, 30);
    
    // Instructions (Bottom)
    ctx.font = "16px Arial";
    ctx.fillStyle = "#888"; 
    ctx.fillText("Press 1 for Trace Mode | Press 2 for Freehand", ctx.canvas.width / 2, ctx.canvas.height - 20);
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