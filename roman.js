const Game5 = {

  running: false,
  score: 0,
  
  // State
  currentLevel: 0,
  tracePoints: [], // The trail of "chalk"
  activeStrokeIndex: 0, 
  
  // Input State
  isDrawing: false,
  cursor: { x: 0, y: 0 },

  // Configuration
  snapDistance: 40, // Pixel tolerance for staying on the line

  // Roman Numeral Data
  levels: [
    { 
      symbol: "I", 
      strokes: [ { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8 } ] 
    },
    { 
      symbol: "L", 
      strokes: [
        { x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.8 }, // Down
        { x1: 0.4, y1: 0.8, x2: 0.7, y2: 0.8 }  // Right
      ]
    },
    { 
      symbol: "V", 
      strokes: [
        { x1: 0.3, y1: 0.2, x2: 0.5, y2: 0.8 }, // Down-Right
        { x1: 0.5, y1: 0.8, x2: 0.7, y2: 0.2 }  // Up-Right
      ]
    },
    { 
      symbol: "X", 
      strokes: [
        { x1: 0.3, y1: 0.2, x2: 0.7, y2: 0.8 }, 
        { x1: 0.7, y1: 0.2, x2: 0.3, y2: 0.8 } 
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
    this.resetLevel();

    // Attach Touch/Mouse Listeners ONCE
    if (!this.listenersAdded) {
      this.addInputListeners();
      this.listenersAdded = true;
    }
  },

  resetLevel() {
    this.tracePoints = [];
    this.activeStrokeIndex = 0;
    this.currentStrokeProgress = 0;
    this.levelCompleteTimer = 0;
    this.isDrawing = false;
  },

  /* ==============================
     INPUT HANDLING (TOUCH & MOUSE)
  ============================== */
  addInputListeners() {
    const canvas = document.getElementById('game_canvas');

    // --- MOUSE EVENTS ---
    canvas.addEventListener('mousedown', (e) => {
      this.isDrawing = true;
      this.updateCursor(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.isDrawing) this.updateCursor(e);
    });
    window.addEventListener('mouseup', () => {
      this.isDrawing = false;
      this.tracePoints = []; // Clear trail on lift (optional)
    });

    // --- TOUCH EVENTS ---
    canvas.addEventListener('touchstart', (e) => {
      this.isDrawing = true;
      this.updateCursor(e.touches[0]);
      e.preventDefault(); // Stop scrolling while playing
    }, {passive: false});
    
    canvas.addEventListener('touchmove', (e) => {
      if (this.isDrawing) this.updateCursor(e.touches[0]);
      e.preventDefault();
    }, {passive: false});

    window.addEventListener('touchend', () => {
      this.isDrawing = false;
      this.tracePoints = [];
    });
  },

  updateCursor(e) {
    const canvas = document.getElementById('game_canvas');
    const rect = canvas.getBoundingClientRect();
    
    // Scale Logic: Maps screen pixels to canvas internal resolution (640x480)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    this.cursor.x = (e.clientX - rect.left) * scaleX;
    this.cursor.y = (e.clientY - rect.top) * scaleY;
  },

  /* ==============================
     UPDATE LOOP
  ============================== */
  update(ctx) { // No 'fingers' argument needed anymore
    if (!this.running) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // 1. Draw Blackboard
    ctx.fillStyle = "#222"; 
    ctx.fillRect(0, 0, w, h);

    // 2. Logic
    if (this.levelCompleteTimer === 0 && this.isDrawing) {
      this.handleTracing(w, h);
    }

    // 3. Render
    this.drawTemplate(ctx, w, h);
    this.drawUserInk(ctx);
    this.drawUI(ctx);

    // 4. Level Completion Animation
    if (this.levelCompleteTimer > 0) {
      this.levelCompleteTimer++;
      this.drawSuccessEffect(ctx, w, h);
      
      if (this.levelCompleteTimer > 80) { // Next level after pause
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

    // Math: Distance logic
    const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const distToStart = Math.hypot(this.cursor.x - p1.x, this.cursor.y - p1.y);
    const distToLine = this.pointToLineDist(this.cursor.x, this.cursor.y, p1.x, p1.y, p2.x, p2.y);

    // 1. Must be touching NEAR the line
    if (distToLine < this.snapDistance) {
      
      const newProgress = Math.min(1, Math.max(0, distToStart / lineLen));
      
      // 2. Must be moving FORWARD (allows small jitter, but prevents backtracking)
      if (newProgress > this.currentStrokeProgress - 0.05) {
        
        if (newProgress > this.currentStrokeProgress) {
          this.currentStrokeProgress = newProgress;
          this.tracePoints.push({ x: this.cursor.x, y: this.cursor.y });
        }

        // 3. Stroke Complete (> 95%)
        if (this.currentStrokeProgress >= 0.95) {
          this.completeStroke();
        }
      }
    }
  },

  completeStroke() {
    this.activeStrokeIndex++;
    this.currentStrokeProgress = 0;
    this.tracePoints = []; // Reset ink for the next line
    this.score += 10;

    if (this.activeStrokeIndex >= this.levels[this.currentLevel].strokes.length) {
      this.levelCompleteTimer = 1; // Trigger win
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
      
      if (index < this.activeStrokeIndex) {
        ctx.strokeStyle = "#00FF66"; // Completed = Green
      } else if (index === this.activeStrokeIndex) {
        ctx.strokeStyle = "#444"; // Active = Dark Gray
      } else {
        ctx.strokeStyle = "#2a2a2a"; // Future = Very Dark
      }
      
      ctx.moveTo(s.x1 * w, s.y1 * h);
      ctx.lineTo(s.x2 * w, s.y2 * h);
      ctx.stroke();
    });

    // Draw Guidance Dots for the CURRENT stroke
    const active = level.strokes[this.activeStrokeIndex];
    if (active) {
      // Start Dot (Yellow)
      ctx.fillStyle = "#FFCC00"; 
      ctx.beginPath(); ctx.arc(active.x1 * w, active.y1 * h, 15, 0, Math.PI*2); ctx.fill();

      // End Dot (Red)
      ctx.fillStyle = "#FF4444"; 
      ctx.beginPath(); ctx.arc(active.x2 * w, active.y2 * h, 15, 0, Math.PI*2); ctx.fill();
    }
  },

  drawUserInk(ctx) {
    if (this.tracePoints.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 15;
    ctx.strokeStyle = "#00FFFF"; // Cyan Chalk
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
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Score: " + this.score, 20, 40);
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