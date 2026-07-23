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

  isMenuOpen: false,
  showHelp: true, 
  
  unlockedUntilIndex: 99, 

  init() {
    this.running = true;
    this.score = 0;
    this.currentLevel = 0;
    this.mode = "TRACE"; 
    this.isMenuOpen = false;
    this.showHelp = true; 
    this.unlockedUntilIndex = 99; 
    
    const existingMenu = document.getElementById("game5-level-menu");
    if (existingMenu) existingMenu.style.display = "none";

    const menu = document.getElementById("menu");
    if (menu) menu.style.display = "none";
    
    this.generateLevels();
    this.resizeCanvas();
    this.resetLevel();
    
    if (!this.listenersAdded) {
      this.addInputListeners();
      window.addEventListener('resize', () => { if (this.running) this.resizeCanvas(); });
      this.listenersAdded = true;
    }
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'd') {
    this.debugMode = !this.debugMode;
  }
});
    
    

  },

  // =========================================================================
  // STAGE 1: GEOMETRY ENGINE & DOUGLAS-PEUCKER STROKE SIMPLIFIER
  // =========================================================================
  
  pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  },

  douglasPeucker(pts, epsilon) {
    if (pts.length <= 2) return pts;
    let maxDist = 0;
    let index = 0;
    const end = pts.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.pointToSegmentDist(pts[i].x, pts[i].y, pts[0].x, pts[0].y, pts[end].x, pts[end].y);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const rec1 = this.douglasPeucker(pts.slice(0, index + 1), epsilon);
      const rec2 = this.douglasPeucker(pts.slice(index), epsilon);
      return rec1.slice(0, rec1.length - 1).concat(rec2);
    } else {
      return [pts[0], pts[end]];
    }
  },

  // =========================================================================
  // STAGE 2: LINE EXTRACTION & SEGMENT MERGING
  // =========================================================================

  extractSegments(rawStrokes, epsilon = 18) {
    let rawSegments = [];
    rawStrokes.forEach(stroke => {
      if (stroke.length < 2) return;
      const simplified = this.douglasPeucker(stroke, epsilon);
      for (let i = 0; i < simplified.length - 1; i++) {
        const p1 = simplified[i];
        const p2 = simplified[i + 1];
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10) {
          rawSegments.push({ p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y } });
        }
      }
    });
    return this.mergeCollinearSegments(rawSegments);
  },

  mergeCollinearSegments(segments) {
    let merged = true;
    let list = [...segments];

    while (merged) {
      merged = false;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const s1 = list[i], s2 = list[j];
          const combined = this.tryMergeTwoSegments(s1, s2);
          if (combined) {
            list[i] = combined;
            list.splice(j, 1);
            merged = true;
            break;
          }
        }
        if (merged) break;
      }
    }
    return list;
  },

  tryMergeTwoSegments(s1, s2) {
    const a1 = Math.atan2(s1.p2.y - s1.p1.y, s1.p2.x - s1.p1.x);
    const a2 = Math.atan2(s2.p2.y - s2.p1.y, s2.p2.x - s2.p1.x);
    
    let diff = Math.abs(a1 - a2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > Math.PI / 2) diff = Math.PI - diff;

    // Angle tolerance: ~20 degrees
    if (diff > 0.35) return null;

    const pts = [s1.p1, s1.p2, s2.p1, s2.p2];
    const dists = [
      Math.hypot(s1.p1.x - s2.p1.x, s1.p1.y - s2.p1.y),
      Math.hypot(s1.p1.x - s2.p2.x, s1.p1.y - s2.p2.y),
      Math.hypot(s1.p2.x - s2.p1.x, s1.p2.y - s2.p1.y),
      Math.hypot(s1.p2.x - s2.p2.x, s1.p2.y - s2.p2.y)
    ];

    // Gap tolerance: 25px max gap to merge
    if (Math.min(...dists) > 25) return null;

    // Find the extreme pair of points to create a single span
    let maxDist = 0, bestP1 = null, bestP2 = null;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d > maxDist) {
          maxDist = d;
          bestP1 = pts[i];
          bestP2 = pts[j];
        }
      }
    }

    // Ensure all points lie near the merged line
    for (let p of pts) {
      if (this.pointToSegmentDist(p.x, p.y, bestP1.x, bestP1.y, bestP2.x, bestP2.y) > 15) {
        return null;
      }
    }

    return { p1: bestP1, p2: bestP2 };
  },

  // =========================================================================
  // STAGE 3: INTERSECTION DETECTION & GRAPH GENERATION
  // =========================================================================

  segmentIntersection(s1, s2) {
    const x1 = s1.p1.x, y1 = s1.p1.y, x2 = s1.p2.x, y2 = s1.p2.y;
    const x3 = s2.p1.x, y3 = s2.p1.y, x4 = s2.p2.x, y4 = s2.p2.y;
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return null;

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

    // Slight threshold margin for endpoints touching
    if (ua >= -0.05 && ua <= 1.05 && ub >= -0.05 && ub <= 1.05) {
      return { x: x1 + ua * (x2 - x1), y: y1 + ua * (y2 - y1) };
    }
    return null;
  },

  buildGraph(segments) {
    let nodes = [];
    let edges = [];

    const getOrCreateNode = (pt) => {
      for (let n of nodes) {
        if (Math.hypot(n.x - pt.x, n.y - pt.y) < 20) return n;
      }
      const newNode = { id: nodes.length, x: pt.x, y: pt.y, degree: 0 };
      nodes.push(newNode);
      return newNode;
    };

    segments.forEach(s => {
      const n1 = getOrCreateNode(s.p1);
      const n2 = getOrCreateNode(s.p2);
      n1.degree++;
      n2.degree++;
      edges.push({ n1, n2, seg: s });
    });

    // Check cross intersections
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const pt = this.segmentIntersection(segments[i], segments[j]);
        if (pt) getOrCreateNode(pt);
      }
    }

    return { nodes, edges };
  },

 // =========================================================================
// LENIENT + ROBUST RECOGNIZER (v2)
// =========================================================================

classifyStrokeGroup(segments) {
  if (segments.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  segments.forEach(s => {
    minX = Math.min(minX, s.p1.x, s.p2.x);
    maxX = Math.max(maxX, s.p1.x, s.p2.x);
    minY = Math.min(minY, s.p1.y, s.p2.y);
    maxY = Math.max(maxY, s.p1.y, s.p2.y);
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const aspect = height / width;
  const centerX = (minX + maxX) / 2;

  const graph = this.buildGraph(segments);

  // === I - Very lenient vertical line ===
  if (segments.length <= 2) {
    const totalLength = segments.reduce((sum, s) => {
      return sum + Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y);
    }, 0);

    const dx = Math.abs(maxX - minX);
    const dy = Math.abs(maxY - minY);

    if (dy > dx * 2.2 && totalLength > height * 0.65) {
      return { char: "I", bounds: { minX, maxX, minY, maxY }, confidence: 0.92 };
    }
  }

  // === V ===
  if (segments.length <= 3) {
    const inter = this.segmentIntersection(segments[0], segments[1] || segments[0]);
    if (inter) {
      const relY = (inter.y - minY) / height;
      if (relY > 0.55) {   // lowered threshold
        return { char: "V", bounds: { minX, maxX, minY, maxY }, confidence: 0.85 };
      }
    }
    // Fallback: two lines going down to a common bottom area
    if (segments.length === 2) {
      const bottomPoints = [segments[0].p2, segments[1].p2];
      if (Math.abs(bottomPoints[0].y - maxY) < height*0.3 && 
          Math.abs(bottomPoints[1].y - maxY) < height*0.3) {
        return { char: "V", bounds: { minX, maxX, minY, maxY }, confidence: 0.75 };
      }
    }
  }

  // === X ===
  if (segments.length <= 3) {
    let crossCount = 0;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i+1; j < segments.length; j++) {
        if (this.segmentIntersection(segments[i], segments[j])) crossCount++;
      }
    }
    if (crossCount >= 1) {
      return { char: "X", bounds: { minX, maxX, minY, maxY }, confidence: 0.88 };
    }
  }

  // === L ===
  if (segments.length <= 3) {
    let hasVertical = false, hasHorizontal = false;
    let horizAtBottom = false;

    segments.forEach(s => {
      const angle = Math.abs(Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x));
      if (angle > 0.9 && angle < 2.2) hasVertical = true;           // vertical-ish
      if (angle < 0.6 || angle > 2.5) hasHorizontal = true;         // horizontal-ish
    });

    // Check if any horizontal segment is near bottom
    segments.forEach(s => {
      if (Math.max(s.p1.y, s.p2.y) > maxY - height * 0.35) {
        horizAtBottom = true;
      }
    });

    if (hasVertical && hasHorizontal && horizAtBottom) {
      return { char: "L", bounds: { minX, maxX, minY, maxY }, confidence: 0.82 };
    }
  }

  // === C ===
  if (segments.length >= 2 && segments.length <= 5) {
    const leftMost = Math.min(...segments.flatMap(s => [s.p1.x, s.p2.x]));
    const rightMost = Math.max(...segments.flatMap(s => [s.p1.x, s.p2.x]));

    const opensRight = rightMost < centerX + width * 0.45;
    const opensLeft  = leftMost  > centerX - width * 0.45;

    if ((opensRight || opensLeft) && aspect > 0.65 && aspect < 2.0) {
      return { char: "C", bounds: { minX, maxX, minY, maxY }, confidence: 0.78 };
    }
  }

  // Final fallback using graph
  if (graph.nodes.some(n => n.degree >= 3)) {
    return { char: "X", bounds: { minX, maxX, minY, maxY }, confidence: 0.6 };
  }
  if (segments.length === 2) {
    return { char: "V", bounds: { minX, maxX, minY, maxY }, confidence: 0.55 };
  }

  return null;
},

// Keep the improved clusterSegmentsToChars from last version (or use this slightly relaxed one):
clusterSegmentsToChars(segments) {
  if (segments.length === 0) return [];

  const clusters = [];
  let unvisited = [...segments];

  while (unvisited.length > 0) {
    let cluster = [unvisited.pop()];
    let changed = true;

    while (changed) {
      changed = false;
      for (let i = unvisited.length - 1; i >= 0; i--) {
        const cand = unvisited[i];
        const connects = cluster.some(s => {
          const d1 = this.pointToSegmentDist(cand.p1.x, cand.p1.y, s.p1.x, s.p1.y, s.p2.x, s.p2.y);
          const d2 = this.pointToSegmentDist(cand.p2.x, cand.p2.y, s.p1.x, s.p1.y, s.p2.x, s.p2.y);
          return d1 < 60 || d2 < 60 || this.segmentIntersection(cand, s) !== null;   // increased tolerance
        });

        if (connects) {
          cluster.push(cand);
          unvisited.splice(i, 1);
          changed = true;
        }
      }
    }

    if (cluster.length >= 1) clusters.push(cluster);
  }

  const recognized = clusters
    .map(c => this.classifyStrokeGroup(c))
    .filter(Boolean);

  recognized.sort((a, b) => a.bounds.minX - b.bounds.minX);
  return recognized;
},
// Improved clustering
clusterSegmentsToChars(segments) {
  if (segments.length === 0) return [];

  const clusters = [];
  let unvisited = [...segments];

  while (unvisited.length > 0) {
    let cluster = [unvisited.pop()];
    let changed = true;

    while (changed) {
      changed = false;
      for (let i = unvisited.length - 1; i >= 0; i--) {
        const candidate = unvisited[i];
        const isConnected = cluster.some(seg => {
          const d1 = this.pointToSegmentDist(candidate.p1.x, candidate.p1.y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
          const d2 = this.pointToSegmentDist(candidate.p2.x, candidate.p2.y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
          return d1 < 45 || d2 < 45 || this.segmentIntersection(candidate, seg) !== null;
        });

        if (isConnected) {
          cluster.push(candidate);
          unvisited.splice(i, 1);
          changed = true;
        }
      }
    }

    // Filter tiny noise clusters
    if (cluster.length >= 1) {
      clusters.push(cluster);
    }
  }

  // Recognize and filter low quality
  const recognized = clusters
    .map(cluster => this.classifyStrokeGroup(cluster))
    .filter(res => res !== null);

  // Sort left to right
  recognized.sort((a, b) => a.bounds.minX - b.bounds.minX);

  return recognized;
},

  // Cluster segments spatially into individual character candidates
  clusterSegmentsToChars(segments) {
    if (segments.length === 0) return [];

    let clusters = [];
    let unvisited = [...segments];

    while (unvisited.length > 0) {
      let currentCluster = [unvisited.pop()];
      let added = true;

      while (added) {
        added = false;
        for (let i = unvisited.length - 1; i >= 0; i--) {
          const cand = unvisited[i];
          const connects = currentCluster.some(s => {
            const d1 = this.pointToSegmentDist(cand.p1.x, cand.p1.y, s.p1.x, s.p1.y, s.p2.x, s.p2.y);
            const d2 = this.pointToSegmentDist(cand.p2.x, cand.p2.y, s.p1.x, s.p1.y, s.p2.x, s.p2.y);
            return d1 < 50 || d2 < 50 || this.segmentIntersection(cand, s) !== null;
          });

          if (connects) {
            currentCluster.push(cand);
            unvisited.splice(i, 1);
            added = true;
          }
        }
      }
      clusters.push(currentCluster);
    }

    // Recognize each cluster
    let recognized = [];
    clusters.forEach(cluster => {
      const res = this.classifyStrokeGroup(cluster);
      if (res) recognized.push(res);
    });

    // Sort left to right by spatial X bounding box
    recognized.sort((a, b) => a.bounds.minX - b.bounds.minX);
    return recognized;
  },

  // =========================================================================
  // STAGE 5 & 6: ROMAN NUMERAL PARSER & CONFIDENCE SCORING
  // =========================================================================

  parseRomanString(romanStr) {
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100 };
    let total = 0;
    for (let i = 0; i < romanStr.length; i++) {
      const current = map[romanStr[i]];
      const next = map[romanStr[i + 1]];
      if (!current) return null;
      if (next && current < next) {
        total -= current;
      } else {
        total += current;
      }
    }
    return total;
  },

 evaluateShapeVector(baseUnit) {
  const result = this.recognizeRoman(this.freehandStrokes);
  
  if (!result || !result.roman) {
    this.triggerFail();
    return;
  }

  const parsedValue = this.parseRomanString(result.roman);
  const level = this.levels[this.currentLevel];
  const targetValue = parseInt(level.number, 10);

  if (result.roman === level.symbol && parsedValue === targetValue) {
    this.levelCompleteTimer = 1;
    this.score += 20;
    this.cursorColor = "#00FFCC";
  } else {
    this.triggerFail();
  }
},
  // =========================================================================
  // UI, DRAWING & GAME LOGIC INTEGRATION
  // =========================================================================

  drawHelpPopUp(ctx, w, h, baseUnit) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, w, h);

    const boxW = baseUnit * 0.8, boxH = baseUnit * 0.7;
    const bx = (w - boxW) / 2, by = (h - boxH) / 2;

    ctx.strokeStyle = "#00FFCC";
    ctx.lineWidth = 5;
    ctx.fillStyle = "#1A1A1A";
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 20);
        ctx.fill(); ctx.stroke();
    } else {
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeRect(bx, by, boxW, boxH);
    }

    ctx.fillStyle = "white";
    ctx.font = `bold ${baseUnit * 0.06}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("How to Play!", w / 2, by + baseUnit * 0.08);

    ctx.font = `bold ${baseUnit * 0.03}px Arial`;
    ctx.textAlign = "left";
    const textX = bx + baseUnit * 0.05;
    
    ctx.fillStyle = "#00FFCC";
    ctx.fillText("1. TRACE MODE", textX, by + baseUnit * 0.18);
    ctx.fillStyle = "#CCC";
    ctx.font = `${baseUnit * 0.025}px Arial`;
    ctx.fillText("• Follow the yellow dots and lines exactly.", textX, by + baseUnit * 0.22);
    ctx.fillText("• Move in the direction of the arrows.", textX, by + baseUnit * 0.26);

    ctx.fillStyle = "#FF4444";
    ctx.font = `bold ${baseUnit * 0.03}px Arial`;
    ctx.fillText("2. FREEHAND MODE", textX, by + baseUnit * 0.35);
    ctx.fillStyle = "#CCC";
    ctx.font = `${baseUnit * 0.025}px Arial`;
    ctx.fillText("• Draw the number anywhere on screen.", textX, by + baseUnit * 0.39);
    ctx.fillText("• When finished, press the SUBMIT button.", textX, by + baseUnit * 0.43);

    ctx.fillStyle = "#FFCC00";
    ctx.textAlign = "center";
    ctx.font = `italic bold ${baseUnit * 0.028}px Arial`;
    ctx.fillText("Tip: Take your time, then hit Submit!", w / 2, by + baseUnit * 0.55);

    const btnW = baseUnit * 0.3, btnH = baseUnit * 0.08;
    const btnX = w / 2 - btnW / 2, btnY = by + boxH - baseUnit * 0.12;
    ctx.fillStyle = "#00FFCC";
    if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 10); ctx.fill();
    } else {
        ctx.fillRect(btnX, btnY, btnW, btnH);
    }
    ctx.fillStyle = "black";
    ctx.font = `bold ${baseUnit * 0.035}px Arial`;
    ctx.fillText("START GAME", w / 2, btnY + btnH / 2 + baseUnit * 0.012);
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

  addInputListeners() {
    const canvas = document.getElementById('game_canvas');

    const startDraw = (e) => {
        this.updateCursor(e);
        if (this.checkButtonClicks()) return;
        if (this.isMenuOpen || this.showHelp) return; 

        this.isDrawing = true;

        if (this.mode === "FREEHAND") {
            if (this.levelFailedTimer > 0) {
                this.levelFailedTimer = 0;
                this.freehandStrokes = [];
            }
            this.currentStroke = [{x: this.cursor.x, y: this.cursor.y}];
            this.freehandStrokes.push(this.currentStroke);
            this.submitTimer = 100;
            this.cursorColor = "white";
        }


    };

    const moveDraw = (e) => {
        if (this.isDrawing && !this.isMenuOpen && !this.showHelp) {
            this.updateCursor(e);
            if (this.mode === "FREEHAND" && this.currentStroke) {
                let lastP = this.currentStroke[this.currentStroke.length - 1];
                if(Math.hypot(lastP.x - this.cursor.x, lastP.y - this.cursor.y) > 5) {
                    this.currentStroke.push({x: this.cursor.x, y: this.cursor.y});
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
    if (!this.debugMode) this.debugMode = true;

    if (this.showHelp) {
        const boxW = baseUnit * 0.8, boxH = baseUnit * 0.7;
        const by = (h - boxH) / 2;
        const btnW = baseUnit * 0.3, btnH = baseUnit * 0.08;
        const btnX = w / 2 - btnW / 2, btnY = by + boxH - baseUnit * 0.12;
        if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
            this.showHelp = false;
            return true;
        }
        return true; 
    }

    if (this.mode === "FREEHAND" && this.freehandStrokes.length > 0 && this.levelFailedTimer === 0) {
        const subW = baseUnit * 0.3, subH = baseUnit * 0.08;
        const subX = w / 2 - subW / 2, subY = baseUnit * 0.15;
        if (x >= subX && x <= subX + subW && y >= subY && y <= subY + subH) {
            this.evaluateShapeVector(baseUnit);
            return true;
        }
    }

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
          btn.innerHTML = `<div style="font-size: 24px; font-weight: bold;">${lvl.number}</div><div style="font-size: 14px; color: #00FFCC; margin-top: 4px;">${lvl.symbol}</div>`;
          Object.assign(btn.style, {
              padding: "15px 10px", cursor: "pointer",
              backgroundColor: "#2A2A2A", color: "white", 
              border: index === this.currentLevel ? "3px solid #FFCC00" : "2px solid #555",
              borderRadius: "12px", textAlign: "center", transition: "all 0.2s ease"
          });
          btn.onclick = () => { this.currentLevel = index; this.resetLevel(); this.toggleMenu(); };
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

    if (this.levelCompleteTimer === 0 && this.levelFailedTimer === 0 && !this.isMenuOpen && !this.showHelp) {
        if (this.mode === "TRACE" && this.isDrawing) {
            this.handleTracing(w, h, baseUnit);
        }
    }
    
    this.updateParticles();
    this.drawTemplate(ctx, w, h, baseUnit);
    this.drawUserInk(ctx, baseUnit);
    this.drawParticles(ctx, baseUnit); 
    this.drawRecognitionDebug(ctx, baseUnit);
    if (!this.isMenuOpen && !this.showHelp) this.drawCursor(ctx, baseUnit); 
    this.drawUI(ctx, w, h, baseUnit);

    if (this.levelCompleteTimer > 0) {
      this.drawSuccessEffect(ctx, w, h, baseUnit);
    }
    
    ctx.restore(); 

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    
    if (this.levelCompleteTimer > 0) {
      this.levelCompleteTimer++;
      this.drawSuccessEffect(ctx, w, h, baseUnit);
      if (this.levelCompleteTimer > 25) { 
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

    if (this.showHelp) {
        this.drawHelpPopUp(ctx, w, h, baseUnit);
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
    const distToLine = this.pointToSegmentDist(this.cursor.x, this.cursor.y, p1.x, p1.y, p2.x, p2.y);
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
    
    if (this.mode === "FREEHAND" && this.freehandStrokes.length > 0 && this.levelFailedTimer === 0) {
        const subW = baseUnit * 0.3, subH = baseUnit * 0.08;
        const subX = w / 2 - subW / 2, subY = baseUnit * 0.15;
        
        ctx.save();
        ctx.fillStyle = "#00FFCC";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#00FFCC";
        if (ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(subX, subY, subW, subH, 12); ctx.fill();
        } else {
            ctx.fillRect(subX, subY, subW, subH);
        }
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = "black";
        ctx.font = `bold ${baseUnit * 0.04}px Arial`;
        ctx.textBaseline = "middle";
        ctx.fillText("SUBMIT", w / 2, subY + subH / 2);
        ctx.restore();

        ctx.font = `${Math.max(12, baseUnit * 0.02)}px Arial`; ctx.fillStyle = "#AAA";
        ctx.fillText("Finished drawing? Click Submit!", w / 2, subY + subH + (baseUnit * 0.03));
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
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.max(14, baseUnit * 0.025)}px Arial`;
    ctx.fillText("MENU", menuBtnX + menuBtnW / 2, menuBtnY + menuBtnH / 2);
  },

  drawSuccessEffect(ctx, w, h, baseUnit) {
    ctx.font = `bold ${baseUnit * 0.15}px Arial`; 
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle";
    const bounce = Math.sin(this.levelCompleteTimer * 0.3) * 15;
    ctx.strokeStyle = "black";
    ctx.lineWidth = baseUnit * 0.02;
    ctx.strokeText("NICE!", w/2, h/2 + bounce);
    ctx.fillStyle = "#FFCC00"; 
    ctx.fillText("NICE!", w/2, h/2 + bounce);
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
        strokes: this.buildStrokesFromRoman(roman)
      });
    }
  },

  buildStrokesFromRoman(roman) {
    const chars = roman.split(""), strokes = [];
    const spacing = 0.3, startX = 0.5 - (chars.length - 1) * spacing / 2;
    chars.forEach((ch, index) => {
      const offset = startX + index * spacing;
      if (ch === "I") strokes.push({ x1: offset, y1: 0.2, x2: offset, y2: 0.8 });
      if (ch === "V") {
          strokes.push({ x1: offset - 0.15, y1: 0.2, x2: offset, y2: 0.8 }, { x1: offset, y1: 0.8, x2: offset + 0.15, y2: 0.2 });
      }
      if (ch === "X") {
          strokes.push({ x1: offset - 0.15, y1: 0.2, x2: offset + 0.15, y2: 0.8 }, { x1: offset + 0.15, y1: 0.2, x2: offset - 0.15, y2: 0.8 });
      }
      if (ch === "L") {
          strokes.push({ x1: offset - 0.1, y1: 0.2, x2: offset - 0.1, y2: 0.8 }, { x1: offset - 0.1, y1: 0.8, x2: offset + 0.15, y2: 0.8 });
      }
      if (ch === "C") {
          strokes.push({ x1: offset + 0.15, y1: 0.2, x2: offset - 0.1, y2: 0.2 }, { x1: offset - 0.1, y1: 0.2, x2: offset - 0.1, y2: 0.8 }, { x1: offset - 0.1, y1: 0.8, x2: offset + 0.15, y2: 0.8 });
      }
    });
    return strokes;
  },

  normalizeStrokes(strokes) {
  if (!strokes || strokes.length === 0) return [];
  
  let allPoints = [];
  strokes.forEach(stroke => stroke.forEach(p => allPoints.push(p)));

  if (allPoints.length < 3) return [];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  allPoints.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const scale = 180 / Math.max(width, height);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return strokes.map(stroke => stroke.map(p => ({
    x: (p.x - centerX) * scale,
    y: (p.y - centerY) * scale
  })));
},

clusterIntoCharacters(strokes) {
  if (!strokes || strokes.length === 0) return [];
  
  const allSegments = this.extractSegments(strokes, 18);
  if (allSegments.length === 0) return [];

  const sortedSegments = [...allSegments].sort((a, b) => {
    const ax = (a.p1.x + a.p2.x) / 2;
    const bx = (b.p1.x + b.p2.x) / 2;
    return ax - bx;
  });

  const clusters = [];
  let currentCluster = [];
  let lastX = -Infinity;

  sortedSegments.forEach(seg => {
    const avgX = (seg.p1.x + seg.p2.x) / 2;
    
    // Special logic for vertical I's (narrow width)
    const isLikelyI = (seg.p2.x - seg.p1.x) ** 2 + (seg.p2.y - seg.p1.y) ** 2 > 100 && 
                      Math.abs(seg.p2.x - seg.p1.x) < 40; // tall and narrow

    const gapThreshold = isLikelyI ? 55 : 90;   // allow I's closer

    if (currentCluster.length === 0 || (avgX - lastX) < gapThreshold) {
      currentCluster.push(seg);
    } else {
      if (currentCluster.length > 0) clusters.push([...currentCluster]);
      currentCluster = [seg];
    }
    lastX = avgX;
  });

  if (currentCluster.length > 0) clusters.push(currentCluster);

  return clusters;
},

// Main recognition function
recognizeRoman(strokes) {
  const clusters = this.clusterIntoCharacters(strokes);
  if (clusters.length === 0) return null;

  let roman = "";
  let totalScore = 0;

  clusters.forEach(cluster => {
    const res = this.recognizeSingleCharacter(cluster);
    if (res) {
      roman += res.char;
      totalScore += res.score;
    } else {
      roman += "?"; 
    }
  });

  return {
    roman: roman,
    score: clusters.length > 0 ? totalScore / clusters.length : 0
  };
},


recognizeSingleCharacter(segments) {
  if (!segments || segments.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  segments.forEach(s => {
    minX = Math.min(minX, s.p1.x, s.p2.x);
    maxX = Math.max(maxX, s.p1.x, s.p2.x);
    minY = Math.min(minY, s.p1.y, s.p2.y);
    maxY = Math.max(maxY, s.p1.y, s.p2.y);
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let crossCount = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (this.segmentIntersection(segments[i], segments[j])) crossCount++;
    }
  }

  // === X ===
  if (crossCount >= 1) {
    let middleCross = false;
    const midY = centerY;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const inter = this.segmentIntersection(segments[i], segments[j]);
        if (inter && Math.abs(inter.y - midY) < height * 0.4) middleCross = true;
      }
    }
    if (middleCross) return { char: "X", score: 0.94 };
  }

  // === I ===
  if (segments.length <= 3) {
    const dx = maxX - minX;
    const dy = maxY - minY;
    if (dy > dx * 1.85 && dx < 65) {
      return { char: "I", score: 0.90 };
    }
  }

  // === L - Improved (horizontal at bottom) ===
  if (segments.length <= 3) {
    let hasVertical = false;
    let hasHorizontalAtBottom = false;

    segments.forEach(s => {
      const angle = Math.abs(Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x));
      const isVertical = angle > 0.6 && angle < 2.45;
      const isHorizontal = angle < 0.7 || angle > 2.45;

      if (isVertical) hasVertical = true;
      if (isHorizontal && Math.max(s.p1.y, s.p2.y) > maxY - height * 0.35) {
        hasHorizontalAtBottom = true;
      }
    });

    if (hasVertical && hasHorizontalAtBottom) {
      return { char: "L", score: 0.88 };
    }
  }

  // === V ===
  if (segments.length <= 3) {
    let bottomIntersect = false;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const inter = this.segmentIntersection(segments[i], segments[j]);
        if (inter && inter.y > minY + height * 0.67) bottomIntersect = true;
      }
    }
    if (bottomIntersect) return { char: "V", score: 0.86 };
  }

  // === C - Much better detection ===
  if (segments.length >= 2 && segments.length <= 6) {
    const rightMost = Math.max(...segments.flatMap(s => [s.p1.x, s.p2.x]));
    const aspect = height / width;

    // Open to the right + decent width
    if (rightMost < centerX + width * 0.42 && width > height * 0.6 && aspect > 0.75) {
      return { char: "C", score: 0.85 };
    }
  }

  return null;
},















// Individual matchers with tolerance
matchI(segments) {
  if (segments.length > 3) return null;
  let verticalScore = 0;
  segments.forEach(s => {
    const angle = Math.abs(Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x));
    if (angle > 0.8 && angle < 2.3) verticalScore += 1; // quite vertical
  });
  const score = verticalScore / Math.max(segments.length, 1);
  return score > 0.65 ? { char: "I", score: score * 0.95 } : null;
},

matchV(segments) {
  if (segments.length > 4) return null;
  let intersections = 0;
  let bottomBias = 0;

  for (let i = 0; i < segments.length; i++) {
    for (let j = i+1; j < segments.length; j++) {
      if (this.segmentIntersection(segments[i], segments[j])) intersections++;
    }
  }

  segments.forEach(s => {
    const avgY = (s.p1.y + s.p2.y) / 2;
    if (avgY > 40) bottomBias += 1; // bottom half
  });

  const score = (intersections * 0.6 + bottomBias * 0.4) / Math.max(segments.length, 2);
  return score > 0.55 ? { char: "V", score } : null;
},

matchX(segments) {
  if (segments.length > 4) return null;
  let crossCount = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i+1; j < segments.length; j++) {
      if (this.segmentIntersection(segments[i], segments[j])) crossCount++;
    }
  }
  const score = crossCount >= 1 ? 0.9 : 0.4;
  return score > 0.6 ? { char: "X", score } : null;
},

matchL(segments) {
  if (segments.length > 4) return null;
  let vert = 0, horiz = 0, horizAtBottom = 0;

  segments.forEach(s => {
    const angle = Math.abs(Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x));
    if (angle > 0.7 && angle < 2.4) vert++;
    else if (angle < 0.7 || angle > 2.5) {
      horiz++;
      if (Math.max(s.p1.y, s.p2.y) > 30) horizAtBottom++;
    }
  });

  const score = (vert > 0 && horiz > 0 && horizAtBottom > 0) ? 0.85 : 0.3;
  return score > 0.65 ? { char: "L", score } : null;
},

matchC(segments) {
  if (segments.length < 2 || segments.length > 6) return null;

  let minX = Infinity, maxX = -Infinity;
  segments.forEach(s => {
    minX = Math.min(minX, s.p1.x, s.p2.x);
    maxX = Math.max(maxX, s.p1.x, s.p2.x);
  });

  const opensSide = maxX - minX < 120; // not too wide

  const score = opensSide ? 0.8 : 0.35;
  return score > 0.6 ? { char: "C", score: score } : null;
},

// Add this method inside the Game5 object
drawRecognitionDebug(ctx, baseUnit) {
  if (!this.debugMode || this.mode !== "FREEHAND") return;

  const result = this.recognizeRoman(this.freehandStrokes);
  const clusters = this.clusterIntoCharacters(this.freehandStrokes);
  const normalized = this.normalizeStrokes(this.freehandStrokes);

  // === Small preview of normalized drawing ===
  ctx.save();
  ctx.translate(70, 100);        // Position of preview box
  ctx.scale(0.32, 0.32);

  ctx.strokeStyle = "#00FFCC";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (normalized && normalized.length > 0) {
    normalized.forEach(stroke => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
  }

  ctx.restore();

  // === Debug Text Info ===
  ctx.textAlign = "left";
  ctx.font = `bold ${baseUnit * 0.028}px Arial`;
  
  let y = baseUnit * 0.18;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("=== RECOGNITION DEBUG ===", 35, y);
  y += baseUnit * 0.055;

  if (result && result.roman) {
    ctx.fillStyle = "#00FF88";
    ctx.fillText(`Detected: ${result.roman}`, 35, y);
    y += baseUnit * 0.05;
    
    ctx.fillStyle = "#88FFAA";
    ctx.fillText(`Confidence: ${Math.round(result.score * 100)}%`, 35, y);
    y += baseUnit * 0.05;
  } else {
    ctx.fillStyle = "#FF6666";
    ctx.fillText("No clear character detected", 35, y);
    y += baseUnit * 0.05;
  }

  ctx.fillStyle = "#BBBBBB";
  ctx.font = `${baseUnit * 0.023}px Arial`;
  ctx.fillText(`Characters detected: ${clusters ? clusters.length : 0}`, 35, y);
  y += baseUnit * 0.045;

  if (clusters && clusters.length > 0) {
    ctx.fillText(`Segments: ${this.extractSegments(this.freehandStrokes, 20).length}`, 35, y);
  }

  // Instructions
  ctx.fillStyle = "#666666";
  ctx.font = `${baseUnit * 0.02}px Arial`;
  ctx.fillText("Press D to toggle debug", 35, baseUnit * 0.75);
},
};