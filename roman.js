/* game5.js - Roman Numeral Tracer */

const Game5 = {

  running: false,
  currentNumeral: "I",
  currentIndex: 0, // Which numeral we are on
  
  // Define the shapes as a series of line segments (Start -> End)
  // Coordinates are percentage based (0.0 to 1.0) to fit any screen
  numerals: [
    { 
      name: "I", 
      strokes: [ 
        {x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8} // Vertical line
      ]
    },
    { 
      name: "V", 
      strokes: [ 
        {x1: 0.3, y1: 0.2, x2: 0.5, y2: 0.8}, // Left diag
        {x1: 0.5, y1: 0.8, x2: 0.7, y2: 0.2}  // Right diag
      ]
    },
    { 
      name: "X", 
      strokes: [ 
        {x1: 0.3, y1: 0.2, x2: 0.7, y2: 0.8}, // Left-to-Right diag
        {x1: 0.7, y1: 0.2, x2: 0.3, y2: 0.8}  // Right-to-Left diag
      ]
    },
    { 
      name: "L", 
      strokes: [ 
        {x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.8}, // Vertical
        {x1: 0.4, y1: 0.8, x2: 0.7, y2: 0.8}  // Horizontal
      ]
    }
  ],

  // Tracking State
  strokeProgress: [], // Array of booleans, is this stroke finished?
  tracingPoint: null, // Where the user is currently touching
  score: 0,
  completedTimer: 0,

  /* ============================== */
  init() {
    this.running = true;
    this.currentIndex = 0;
    this.score = 0;
    this.loadNumeral(0);
  },

  /* ============================== */
  loadNumeral(index) {
    if (index >= this.numerals.length) {
      index = 0; // Loop back to start
    }
    this.currentIndex = index;
    const current = this.numerals[index];
    
    // Reset progress for new letter
    this.strokeProgress = current.strokes.map(() => ({
      completed: false,
      progress: 0 // 0.0 to 1.0
    }));
    
    this.completedTimer = 0;
  },

  /* ============================== */
  update(ctx, fingers) {
    if (!this.running) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const current = this.numerals[this.currentIndex];

    // 1. Detect Finger (Use the first finger found)
    let finger = null;
    if (fingers && fingers.length > 0) {
      finger = fingers[0];
    }

    // 2. Logic: Check Tracing
    if (finger) {
      this.checkTracing(finger, w, h);
    }

    // 3. Draw The Guide (Ghost Letter)
    this.drawGuide(ctx, w, h);

    // 4. Draw User's Trace
    if (finger) {
      ctx.fillStyle = "#00FFCC";
      ctx.beginPath();
      ctx.arc(finger.x, finger.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 5. Check Win
    const allDone = this.strokeProgress.every(s => s.completed);
    if (allDone) {
      this.completedTimer++;
      
      // Success Message
      ctx.fillStyle = "#00FF66";
      ctx.font = "bold 60px Arial";
      ctx.textAlign = "center";
      ctx.fillText("GREAT!", w/2, h/2);

      if (this.completedTimer > 60) { // Wait 1 second
        this.score += 10;
        this.loadNumeral(this.currentIndex + 1);
      }
    }
    
    this.drawUI(ctx);
  },

  /* ============================== */
  checkTracing(finger, w, h) {
    const current = this.numerals[this.currentIndex];

    current.strokes.forEach((stroke, i) => {
      if (this.strokeProgress[i].completed) return; // Already done

      // Convert Start/End to pixels
      const x1 = stroke.x1 * w;
      const y1 = stroke.y1 * h;
      const x2 = stroke.x2 * w;
      const y2 = stroke.y2 * h;

      // Distance from finger to the line segment
      const dist = this.pointLineDistance(finger.x, finger.y, x1, y1, x2, y2);

      // If finger is close to the line (within 40px)
      if (dist < 40) {
        // Calculate progress along the line
        // We project the finger onto the line vector
        const lineLen = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        const distFromStart = Math.sqrt((finger.x-x1)**2 + (finger.y-y1)**2);
        
        const currentProg = Math.min(1, Math.max(0, distFromStart / lineLen));
        
        // Only allow forward progress
        if (currentProg > this.strokeProgress[i].progress) {
          this.strokeProgress[i].progress = currentProg;
        }

        // If we reached near the end (> 90%)
        if (this.strokeProgress[i].progress > 0.9) {
          this.strokeProgress[i].completed = true;
        }
      }
    });
  },

  /* ============================== */
  drawGuide(ctx, w, h) {
    const current = this.numerals[this.currentIndex];

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    current.strokes.forEach((stroke, i) => {
      const x1 = stroke.x1 * w;
      const y1 = stroke.y1 * h;
      const x2 = stroke.x2 * w;
      const y2 = stroke.y2 * h;

      // 1. Draw Gray Background Line (The Guide)
      ctx.lineWidth = 40;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // 2. Draw Progress Line (Green)
      if (this.strokeProgress[i].progress > 0) {
        const prog = this.strokeProgress[i].progress;
        
        // Calculate point where progress currently is
        const currentX = x1 + (x2 - x1) * prog;
        const currentY = y1 + (y2 - y1) * prog;

        ctx.lineWidth = 20;
        ctx.strokeStyle = "#00FF66"; // Green
        ctx.shadowColor = "#00FF66";
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
      }
      
      // 3. Draw Start/End dots to guide direction
      ctx.fillStyle = "yellow";
      ctx.beginPath();
      ctx.arc(x1, y1, 8, 0, Math.PI*2);
      ctx.fill();
    });
  },

  drawUI(ctx) {
    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.fillText("Trace the Numeral", 20, 40);
    ctx.fillText("Score: " + this.score, 20, 80);
  },

  // Math Helper: Distance from point (px,py) to line segment (x1,y1)-(x2,y2)
  pointLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq != 0) // in case of 0 length line
        param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    }
    else if (param > 1) {
      xx = x2;
      yy = y2;
    }
    else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
};