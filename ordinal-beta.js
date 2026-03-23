const Game9 = {

  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  CENTER_X: 0,
  CENTER_Y: 0,

  get cssWidth()  { return canvasElement.width  / (window.devicePixelRatio || 1); },
  get cssHeight() { return canvasElement.height / (window.devicePixelRatio || 1); },

  DOOR_RADIUS: 90,

  doors: [],
  score: 0,

  currentNumber: 1,
  correctSuffix: "st",

  fingerX: null,
  fingerY: null,

  /* ── Smoothed finger position ─────────────────────────────── */
  _fingerSmoothX: null,
  _fingerSmoothY: null,
  FINGER_SMOOTH: 0.30,   // 0=frozen, 1=raw — 0.30 feels responsive but not jittery

  running: false,
  lastTime: 0,

  /* ── Score selection lock ─────────────────────────────────── */
  // Prevents confirmSelection firing every frame while inside door radius
  selectionLocked: false,

  sparkBursts: [],

  /* ===== MASCOT ===== */
  gameState: "pickup",

  mascot: {
    x: 0, 
    y: 0,
    vx: 0, 
    vy: 0,
    /* Physics constants — tuned so the mascot feels the same on all devices */
    accel:    0.010,   // px per ms² per px-of-distance (very small — delta is in ms)
    maxSpeed: 0.65,    // px per ms  (≈ 33px/frame @60fps — quick but controllable)
    friction: 0.978,   // exponential decay base; applied as v *= friction^delta
    size: 140,
    carryingNumber: false
  },

  mascotImages: { idle: [], happy: [], confused: [] },
  mascotFrame: 0,
  mascotFrameTimer: 0,
  mascotFrameSpeed: 120,
  mascotState: "idle",

  numberPosition: { x: 0, y: 0, picked: false },

  /* ===== PORTAL ===== */
  portalFrames: [],
  portalFrameIndex: 0,
  portalFrameTimer: 0,
  portalFrameSpeed: 80,
  portalSize: 260,

  ordinalMap: { "st": "st", "nd": "nd", "rd": "rd", "th": "th" },

  /* ===== FLOATING NUMBER ===== */
  floatTime: 0,
  floatAmplitude: 20,
  floatSpeed: 0.002,
  numberRotation: 0,
  rotationSpeed: 0.0015,
  numberScalePulse: 0,
  pulseSpeed: 0.003,

  /* ===== STARFIELD ===== */
  starsFar: [], starsMid: [], starsNear: [],
  starCountFar: 80, starCountMid: 50, starCountNear: 30,

  /* ===== SHOOTING STARS ===== */
  shootingStars: [],
  shootingStarSpawnTimer: 0,
  shootingStarSpawnInterval: 2000,
  shootingStarBursts: [],


  /* ============================================================
     INIT
  ============================================================ */
  init() {
    this.resize();
    // NOTE: internal resize listener is suppressed by ordinals-perf-patch.js
    // to prevent conflict with main.js's debounced resizeCanvas().
    window.addEventListener("resize", () => this.resize());

    this.score          = 0;
    this.selectionLocked = false;
    this.running        = true;
    this.lastTime       = performance.now();
    this.sparkBursts    = [];
  
    this._fingerSmoothX = null;
    this._fingerSmoothY = null;

    this.loadMascotSprites();
    this.loadPortalSprites();
    this.initStarfield();
    this.setupDoors();
    this.spawnNumber();

    this.mascot.x  = this.CENTER_X;
    this.mascot.y  = this.CENTER_Y + 100 * this.scale;
    this.mascot.vx = 0;
    this.mascot.vy = 0;
    this.gameState = "pickup";
  },

  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr  = window.devicePixelRatio || 1;
    canvasElement.width  = cssW * dpr;
    canvasElement.height = cssH * dpr;
    canvasElement.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale    = Math.min(cssW / this.BASE_WIDTH, cssH / this.BASE_HEIGHT) || 1;
    this.CENTER_X = cssW / 2;
    this.CENTER_Y = cssH / 2;
  },


  /* ============================================================
     DOORS
  ============================================================ */
  setupDoors() {
    this.doors = [];
    const suffixes = ["st", "nd", "rd", "th"];
    const startX   = this.cssWidth  * 0.2;
    const gap      = this.cssWidth  * 0.2;
    const y        = this.cssHeight * 0.55;
    for (let i = 0; i < 4; i++) {
      this.doors.push({ 
        x: startX + i * gap, y, 
        suffix: suffixes[i], 
        label: suffixes[i] });
    }
  },

  get doorRadius() { return this.DOOR_RADIUS * this.scale; },


  /* ============================================================
     NUMBER SPAWN
  ============================================================ */
  spawnNumber() {
    const num              = Math.floor(Math.random() * 10) + 1;
    this.currentNumber     = num;
    this.correctSuffix     = this.getSuffix(num);
    this.numberPosition.x  = this.CENTER_X;
    this.numberPosition.y  = this.CENTER_Y - 230 * this.scale;
    this.numberPosition.picked = false;
    this.mascot.carryingNumber = false;
    this.selectionLocked   = false;   // unlock for new round
    this.gameState         = "pickup";
  },

  getSuffix(num) {
    const t = num % 100;
    if (t >= 11 && t <= 13) return "th";
    const l = num % 10;
    if (l === 1) return "st";
    if (l === 2) return "nd";
    if (l === 3) return "rd";
    return "th";
  },


  /* ============================================================
     SCORE SYSTEM
     ─────────────────────────────────────────────────────────
     Correct answer gives a "fun" random bonus that always ends
     in 0 (so the scoreboard stays readable).
     Range: 10 – 100, multiples of 10, weighted toward lower
     values so getting 100 feels exciting but rare.
  ============================================================ */
  _rollScore() {
    // Weighted pool: 10 appears most, 100 appears least
    const pool = [10,10,10,10,10, 20,20,20,20, 30,30,30, 40,40, 50,50, 60, 70, 80, 90, 100];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  /* ============================================================
     MAIN UPDATE — delta arrives in SECONDS from main.js
     Convert to ms once here so everything else stays the same.
  ============================================================ */
  update(ctx, _fp, dtArg) {
    if (!this.running) return;

    // Accept both seconds (new main.js) and ms (old main.js / direct call)
    const delta = (dtArg > 0 && dtArg < 1) ? dtArg * 1000
                : (dtArg > 0)              ? Math.min(dtArg, 50)
                : 16;

    this.drawDreamBackground(ctx);

    // Starfield
    this.updateStarLayer(this.starsFar,  delta);
    this.updateStarLayer(this.starsMid,  delta);
    this.updateStarLayer(this.starsNear, delta);
    this.drawStarLayer(ctx, this.starsFar);
    this.drawStarLayer(ctx, this.starsMid);
    this.drawStarLayer(ctx, this.starsNear);

    // Shooting stars
    this.updateShootingStars(delta);
    this.drawShootingStars(ctx);
    this.updateStarBursts(delta);
    this.drawStarBursts(ctx);

    // Game logic
    this.updateFingerPosition();
    this.updateMascot(delta);
    this.checkPickup();
    this.checkDoorAlignment();

    this.updateFloatingNumber(delta);
    this.updatePortalAnimation(delta);
    this.updateSparkBursts(delta);


    // Draw
    this.drawDoors(ctx);
    this.drawNumber(ctx);
    this.drawMascot(ctx);
    this.drawScore(ctx);

    this.drawSparkBursts(ctx);
  },


  /* ============================================================
     FINGER — smoothed so cursor doesn't jitter
  ============================================================ */
  updateFingerPosition() {
    if (!window.fingerPositions || window.fingerPositions.length === 0) {
      this.fingerX = null;
      this.fingerY = null;
      return;
    }
    const fp   = window.fingerPositions[0];
    const rawX = fp.x, rawY = fp.y;

    if (this._fingerSmoothX === null) {
      this._fingerSmoothX = rawX;
      this._fingerSmoothY = rawY;
    }
    this._fingerSmoothX += (rawX - this._fingerSmoothX) * this.FINGER_SMOOTH;
    this._fingerSmoothY += (rawY - this._fingerSmoothY) * this.FINGER_SMOOTH;

    this.fingerX = this._fingerSmoothX;
    this.fingerY = this._fingerSmoothY;
  },


  /* ============================================================
     MASCOT MOVEMENT — framerate-independent physics
     ─────────────────────────────────────────────────────────
     Old code:  vx = force  →  x += vx   (runs faster on fast devices)
     New code:  vx += force * delta  →  x += vx * delta
                friction applied as  v *= friction^delta  (exponential)
  ============================================================ */
  updateMascot(delta) {
    if (this.fingerX === null || this.fingerY === null) return;

    const dx   = this.fingerX - this.mascot.x;
    const dy   = this.fingerY - this.mascot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 4) {
      // Force proportional to distance, capped at maxSpeed
      const force = Math.min(dist * this.mascot.accel * delta, this.mascot.maxSpeed);
      this.mascot.vx += (dx / dist) * force;
      this.mascot.vy += (dy / dist) * force;
    }

    // Framerate-independent friction: v *= friction^delta
    const fr = Math.pow(this.mascot.friction, delta);
    this.mascot.vx *= fr;
    this.mascot.vy *= fr;

    // Speed cap
    const spd = Math.sqrt(this.mascot.vx * this.mascot.vx + this.mascot.vy * this.mascot.vy);
    if (spd > this.mascot.maxSpeed) {
      const ratio = this.mascot.maxSpeed / spd;
      this.mascot.vx *= ratio;
      this.mascot.vy *= ratio;
    }

    // Integrate — multiply by delta so distance per step is time-consistent
    this.mascot.x += this.mascot.vx * delta;
    this.mascot.y += this.mascot.vy * delta;

    // Screen clamp
    const pad = 80;
    this.mascot.x = Math.max(pad, Math.min(this.cssWidth  - pad, this.mascot.x));
    this.mascot.y = Math.max(pad, Math.min(this.cssHeight - pad, this.mascot.y));
  },


  /* ============================================================
     PICKUP
  ============================================================ */
  checkPickup() {
    if (this.gameState !== "pickup") return;
    const dx   = this.mascot.x - this.numberPosition.x;
    const dy   = this.mascot.y - this.numberPosition.y;
    if (Math.sqrt(dx * dx + dy * dy) < 80 * this.scale) {
      this.numberPosition.picked     = true;
      this.mascot.carryingNumber     = true;
      this.gameState                 = "deliver";
    }
  },


  /* ============================================================
     DOOR ALIGNMENT
     ─────────────────────────────────────────────────────────
     FIX: selectionLocked flag ensures confirmSelection fires
     exactly ONCE per delivery, not every frame while inside radius.
  ============================================================ */
  checkDoorAlignment() {
    if (this.gameState !== "deliver") return;
    if (this.selectionLocked) return;   // ← already processed this delivery

    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i];
      const dx   = this.mascot.x - door.x;
      const dy   = this.mascot.y - door.y;
      if (Math.sqrt(dx * dx + dy * dy) <= this.doorRadius) {
        this.selectionLocked = true;    // lock immediately before any async
        this.confirmSelection(i);
        break;
      }
    }
  },

  confirmSelection(index) {
    const door = this.doors[index];

    if (door.suffix === this.correctSuffix) {
      const points = this._rollScore();
      this.score  += points;
      this.mascotState = "happy";
      this.spawnSparkBurst(door.x, door.y);
      // Show floating score popup
     
    } else {
      this.score      = Math.max(0, this.score - 10);
      this.mascotState = "confused";
    }

    setTimeout(() => {
      this.mascotState = "idle";
      this.spawnNumber();   // spawnNumber resets selectionLocked
    }, 1200);
  },



  /* ============================================================
     DRAW — number, doors, mascot, score (unchanged visuals)
  ============================================================ */
  drawNumber(ctx) {
    if (this.numberPosition.picked) return;
    const baseX = this.numberPosition.x;
    const baseY = this.numberPosition.y;
    const floatOffset = Math.sin(this.floatTime * this.floatSpeed) * this.floatAmplitude * this.scale;
    const pulse       = 1 + Math.sin(this.numberScalePulse) * 0.15;

    ctx.save();
    ctx.translate(baseX, baseY + floatOffset);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "#FFD700"; 
    ctx.shadowBlur = 40;
    ctx.lineWidth = 8; 
    ctx.strokeStyle = "#FFD700";
    ctx.font = `bold ${90 * this.scale}px Comic Sans MS`;
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle";
    ctx.strokeText(this.currentNumber, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(this.currentNumber, 0, 0);
    ctx.restore();
    this.drawFloatingSparkles(ctx, baseX, baseY + floatOffset);
  },

  drawDoors(ctx) {
    const size = this.portalSize * this.scale;
    for (let i = 0; i < this.doors.length; i++) {
      const door  = this.doors[i];
      const pulse = 1 + Math.sin(performance.now() * 0.003 + i) * 0.05;

      const gradient = ctx.createRadialGradient(door.x, door.y, size * 0.2, door.x, door.y, size * 0.6);
      gradient.addColorStop(0,   "#FFFFFF");
      gradient.addColorStop(0.3, "#FDE047");
      gradient.addColorStop(0.6, "#A78BFA");
      gradient.addColorStop(1,   "rgba(255,255,255,0)");

      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle   = gradient;
      ctx.beginPath();
      ctx.arc(door.x, door.y, size * 0.6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const portalImg = this.portalFrames[this.portalFrameIndex];
      if (portalImg && portalImg.complete && portalImg.naturalWidth > 0) {
        ctx.drawImage(portalImg, door.x - size / 2, door.y - size / 2, size, size);
      }
      ctx.fillStyle    = "#FFFFFF";
      ctx.font         = `bold ${42 * this.scale}px Comic Sans MS`;
      ctx.textAlign    = "center";
      ctx.fillText(this.ordinalMap[door.suffix], door.x, door.y - size / 2 - 20 * this.scale);
    }
  },

  drawMascot(ctx) {
    const spriteArray = this.mascotImages[this.mascotState];
    if (!spriteArray || spriteArray.length === 0) return;

    this.mascotFrameTimer += 16;
    if (this.mascotFrameTimer > this.mascotFrameSpeed) {
      this.mascotFrame = (this.mascotFrame + 1) % spriteArray.length;
      this.mascotFrameTimer = 0;
    }

    const img         = spriteArray[this.mascotFrame];
    const time        = performance.now();
    const breathe     = 1 + Math.sin(time * 0.002) * 0.03;
    const floatOffset = Math.sin(time * 0.004) * 8 * this.scale;
    const mascotX     = this.mascot.x;
    const mascotY     = this.mascot.y + floatOffset;
    const spd         = Math.sqrt(this.mascot.vx * this.mascot.vx + this.mascot.vy * this.mascot.vy);

    // Speed is now in px/ms — scale squash threshold accordingly
    const spdPx = spd * 16;   // approx px per frame at 60fps for threshold comparison
    let stretchX = 1, stretchY = 1;
    if (spdPx > 2) {
      stretchX = 1 + Math.min(spdPx * 0.02, 0.15);
      stretchY = 1 - Math.min(spdPx * 0.015, 0.1);
    }

    ctx.save();
    // Shadow
    ctx.beginPath();
    ctx.ellipse(mascotX, mascotY + 70 * this.scale, 65 * this.scale, 22 * this.scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    // Happy aura
    if (this.mascotState === "happy") {
      const glowPulse = 30 + Math.sin(time * 0.01) * 10;
      ctx.shadowColor = "#FFF59D"; 
      ctx.shadowBlur = glowPulse;
      ctx.beginPath();
      ctx.arc(mascotX, mascotY, 90 * this.scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,150,0.5)";
      ctx.lineWidth   = 6 * this.scale; ctx.stroke();
    }

    ctx.translate(mascotX, mascotY);
    ctx.scale(stretchX * breathe, stretchY * breathe);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img,
        -(this.mascot.size * this.scale) / 2,
        -(this.mascot.size * this.scale) / 2,
         this.mascot.size * this.scale,
         this.mascot.size * this.scale
      );
    }
    ctx.shadowBlur = 0;

    if (this.mascot.carryingNumber) {
      const badgeY = -80 * this.scale;
      ctx.shadowColor = "#FFD700"; 
      ctx.shadowBlur = 30;
      ctx.lineWidth   = 7; ctx.strokeStyle = "#FFD700"; 
      ctx.fillStyle = "#FFFFFF";
      ctx.font        = `bold ${44 * this.scale}px Comic Sans MS`;
      ctx.textAlign   = "center"; 
      ctx.textBaseline = "middle";
      ctx.strokeText(this.currentNumber, 0, badgeY);
      ctx.fillText(this.currentNumber, 0, badgeY);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  },

  drawScore(ctx) {
    const width  = 220 * this.scale;
    const height = 70  * this.scale;
    const x      = 20  * this.scale;
    const y      = 20  * this.scale;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 15;
    ctx.fillStyle   = "#1E3A8A";
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 25 * this.scale);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = "#FFD700";
    ctx.font        = `bold ${32 * this.scale}px Comic Sans MS`;
    ctx.textAlign   = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`⭐ ${this.score}`, x + width / 2, y + height / 2);
    ctx.restore();
  },


  /* ============================================================
     SPARK BURSTS
  ============================================================ */
  spawnSparkBurst(x, y) {
    if (this.sparkBursts.length > 80) return;   // cap
    this.sparkBursts.push({ 
      x, 
      y, 
      radius: 0, 
      maxRadius: 140 * this.scale, 
      alpha: 1, 
      life: 600 
    });
    for (let i = 0; i < 20; i++) {
      this.sparkBursts.push({
        x, 
        y,
        vx: (Math.random() - 0.5) * 0.35,   // px/ms instead of px/frame
        vy: (Math.random() - 0.5) * 0.35,
        size: (Math.random() * 4 + 2) * this.scale,
        life: 500,
        type: "particle"
      });
    }
  },

  updateSparkBursts(delta) {
    for (let i = this.sparkBursts.length - 1; i >= 0; i--) {
      const s = this.sparkBursts[i];
      s.life -= delta;
      if (s.type === "particle") {
        s.x  += s.vx * delta;
        s.y  += s.vy * delta;
        s.vx *= Math.pow(0.994, delta);   // framerate-independent drag
        s.vy *= Math.pow(0.994, delta);
      } else {
        const progress = 1 - (s.life / 600);
        s.radius = s.maxRadius * progress;
        s.alpha  = 1 - progress;
      }
      if (s.life <= 0) this.sparkBursts.splice(i, 1);
    }
  },

  drawSparkBursts(ctx) {
    if (this.sparkBursts.length === 0) return;
    for (const s of this.sparkBursts) {
      if (s.type === "particle") {
        ctx.globalAlpha = Math.max(0, s.life / 500);
        ctx.fillStyle   = "#00FFFF";
        ctx.beginPath(); 
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); 
        ctx.fill();
      } else {
        ctx.globalAlpha  = Math.max(0, s.alpha);
        ctx.strokeStyle  = "#00FFFF";
        ctx.lineWidth    = 6 * this.scale;
        ctx.beginPath(); 
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); 
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },


  /* ============================================================
     SPRITE LOADING
  ============================================================ */
  loadMascotSprites() {
    this.mascotImages = { idle: [], happy: [], confused: [] };
    for (let i = 0; i <= 4; i++) { const img = new Image(); img.src = `MID-I/0${i}_MID-I.png`; this.mascotImages.idle.push(img); }
    for (let i = 0; i <= 3; i++) { const img = new Image(); img.src = `MID-H/0${i}_MID-H.png`; this.mascotImages.happy.push(img); }
    for (let i = 0; i <= 2; i++) { const img = new Image(); img.src = `MID-C/0${i}_MID-C.png`; this.mascotImages.confused.push(img); }
  },

  loadPortalSprites() {
    this.portalFrames = [];
    for (let i = 0; i <= 8; i++) { const img = new Image(); img.src = `D-1/0${i}_D-1.png`; this.portalFrames.push(img); }
  },


  /* ============================================================
     PORTAL ANIMATION
  ============================================================ */
  updatePortalAnimation(delta) {
    this.portalFrameTimer += delta;
    if (this.portalFrameTimer > this.portalFrameSpeed) {
      this.portalFrameIndex = (this.portalFrameIndex + 1) % Math.max(1, this.portalFrames.length);
      this.portalFrameTimer = 0;
    }
  },


  /* ============================================================
     FLOATING NUMBER
  ============================================================ */
  updateFloatingNumber(delta) {
    if (this.numberPosition.picked) return;
    this.floatTime        += delta;
    this.numberRotation   += delta * this.rotationSpeed;
    this.numberScalePulse += delta * this.pulseSpeed;
  },


  /* ============================================================
     STARFIELD — batched draw call per layer (one fill per layer)
  ============================================================ */
  initStarfield() {
    if (!this.cssWidth || this.cssWidth <= 0) return;
    this.starsFar  = [];
    this.starsMid  = [];
    this.starsNear = [];
    for (let i = 0; i < this.starCountFar;  i++) this.starsFar.push(this.createStar(0.2));
    for (let i = 0; i < this.starCountMid;  i++) this.starsMid.push(this.createStar(0.5));
    for (let i = 0; i < this.starCountNear; i++) this.starsNear.push(this.createStar(1.0));
  },

  createStar(speedFactor) {
    return {
      x: Math.random() * this.cssWidth,
      y: Math.random() * this.cssHeight,
      size:  Math.random() * 3 + 1,
      speed: speedFactor
    };
  },

  updateStarLayer(layer, delta) {
    if (!layer || layer.length === 0) return;
    for (const star of layer) {
      star.y += star.speed * delta * 0.02;
      if (star.y > this.cssHeight) { star.y = 0; star.x = Math.random() * this.cssWidth; }
    }
  },

  // Batched: one beginPath / fill per layer instead of one per star
  drawStarLayer(ctx, layer) {
    if (!layer || layer.length === 0) return;
    ctx.beginPath();
    for (const star of layer) {
      ctx.moveTo(star.x + star.size * this.scale, star.y);
      ctx.arc(star.x, star.y, star.size * this.scale, 0, Math.PI * 2);
    }
    ctx.fillStyle = "white";
    ctx.fill();
  },


  /* ============================================================
     SHOOTING STARS
  ============================================================ */
  createShootingStar() {
    if (this.shootingStars.length >= 4) return;
    const fl  = Math.random() < 0.5;
    const spd = Math.random() * 6 + 4;
    this.shootingStars.push({
      x:       fl ? -50 : this.cssWidth + 50,
      y:       Math.random() * this.cssHeight * 0.5,
      length:  Math.random() * 120 + 80,
      speedX:  fl ? spd : -spd,
      speedY:  Math.random() * 2 + 1,
      life:    0,
      maxLife: 1000,
      opacity: 1
    });
  },

  updateShootingStars(delta) {
    this.shootingStarSpawnTimer += delta;
    if (this.shootingStarSpawnTimer > this.shootingStarSpawnInterval) {
      this.createShootingStar();
      this.shootingStarSpawnTimer   = 0;
      this.shootingStarSpawnInterval = 1500 + Math.random() * 3000;
    }
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const star = this.shootingStars[i];
      star.x      += star.speedX;
      star.y      += star.speedY;
      star.life   += delta;
      star.opacity = 1 - (star.life / star.maxLife);
      if (star.life > star.maxLife) {
        this.createStarBurst(star.x, star.y);
        this.shootingStars.splice(i, 1);
      }
    }
  },

  drawShootingStars(ctx) {
    for (const star of this.shootingStars) {
      const grd = ctx.createLinearGradient(
        star.x, star.y,
        star.x - star.speedX * 10,
        star.y - star.speedY * 10
      );
      grd.addColorStop(0, `rgba(255,255,255,${star.opacity})`);
      grd.addColorStop(1,  "rgba(255,255,255,0)");
      ctx.strokeStyle = grd;
      ctx.lineWidth   = 3 * this.scale;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(
        star.x - star.speedX * star.length * 0.05,
        star.y - star.speedY * star.length * 0.05
      );
      ctx.stroke();
    }
  },

  createStarBurst(x, y) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      this.shootingStarBursts.push({
        x, 
        y,
        vx: Math.cos(angle) * speed, 
        vy: Math.sin(angle) * speed,
        life: 0, maxLife: 600,
        size: Math.random() * 3 + 1
      });
    }
  },

  updateStarBursts(delta) {
    for (let i = this.shootingStarBursts.length - 1; i >= 0; i--) {
      const p = this.shootingStarBursts[i];
      p.x += p.vx; 
      p.y += p.vy;
      p.life += delta;
      if (p.life > p.maxLife) this.shootingStarBursts.splice(i, 1);
    }
  },

  drawStarBursts(ctx) {
    for (const p of this.shootingStarBursts) {
      const opacity = 1 - (p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,200,${opacity})`;
      ctx.fill();
    }
  },


  /* ============================================================
     BACKGROUND
  ============================================================ */
  drawDreamBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.cssHeight);
    g.addColorStop(0,   "#60A5FA");
    g.addColorStop(0.5, "#A78BFA");
    g.addColorStop(1,   "#F472B6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    const glow = ctx.createRadialGradient(this.CENTER_X, this.CENTER_Y, 0, this.CENTER_X, this.CENTER_Y, this.cssWidth * 0.8);
    glow.addColorStop(0, "rgba(255,255,255,0.15)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  },

  drawFloatingSparkles(ctx, x, y) {
    const time = performance.now() * 0.002;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i + time;
      const sx    = x + Math.cos(angle) * 70 * this.scale;
      const sy    = y + Math.sin(angle) * 70 * this.scale;
      ctx.moveTo(sx + 6 * this.scale, sy);
      ctx.arc(sx, sy, 6 * this.scale, 0, Math.PI * 2);
    }
    ctx.fillStyle = "#FFFACD";
    ctx.fill();
  },
};