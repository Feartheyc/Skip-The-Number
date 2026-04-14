const sfxButtonClick_11 = new Audio('SFX-Bhavya/buttonclick.mp3');
const sfxCorrect_11 = new Audio('SFX-Bhavya/Correct.mp3');
const sfxWrong_11 = new Audio('SFX-Bhavya/Wrong.mp3');

const Game11 = {

  lastFingerPattern: "",
  fingerStableFrames: 0,
  fingerRequiredFrames: 10,

  BASE_WIDTH: 1280,
  BASE_HEIGHT: 720,
  scale: 1,

  CENTER_X: 0,
  CENTER_Y: 0,

  get cssWidth() {
    return canvasElement.width / (window.devicePixelRatio || 1);
  },

  get cssHeight() {
    return canvasElement.height / (window.devicePixelRatio || 1);
  },

  DOOR_RADIUS: 90,
  DOOR_DISTANCE: 260,

  doors: [],
  score: 0,

  fingerX: null,
  fingerY: null,

  /* ============================================================
     THEME SYSTEM
  ============================================================ */
  theme: "space",

  themes: {
    space: {
      bg1: "rgba(10, 14, 39, 0.9)", bg2: "rgba(26, 16, 64, 0.9)", bg3: "rgba(13, 31, 60, 0.9)",
      accent: "#7c3aed", accentGlow: "rgba(124,58,237,0.4)",
      textPrimary: "#e2e8f0", textAccent: "#a78bfa",
      correct: "#34d399", wrong: "#f87171",
      numberColor: "#fbbf24", numberGlow: "rgba(251,191,36,0.6)",
      cardBg: "rgba(255,255,255,0.07)", cardBorder: "rgba(255,255,255,0.15)",
      scoreBg: "rgba(124,58,237,0.3)", heartColor: "#f472b6", streakColor: "#fbbf24",
    }
  },

  get T() { return this.themes[this.theme]; },

  running: false,
  gameStarted: false,
  lastTime: 0,

  confettiParticles: [],
  shakeDuration: 0,
  shakeIntensity: 0,

  sparkBursts: [],
  floatingTexts: [],

  /* ===== MASCOT SYSTEM ===== */
  mascot: {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 2,
    maxSpeed: 8,
    size: 140,
    carryingNumber: false
  },

  mascotImages: {
    idle: [],
    happy: [],
    confused: []
  },

  mascotFrame: 0,
  mascotFrameTimer: 0,
  mascotFrameSpeed: 120,
  mascotState: "idle", // idle | happy | confused

  /* ===== FINGERS SYSTEM ===== */
  fingerImages: [],
  meteorImages: [],

  /* ===== PORTAL SPRITE SYSTEM ===== */

  portalFrames: [],
  portalFrameIndex: 0,
  portalFrameTimer: 0,
  portalFrameSpeed: 80, // lower = faster animation

  portalSize: 260,

  ordinalMap: {
    "st": "st",
    "nd": "nd",
    "rd": "rd",
    "th": "th"
  },



  /* ===== STARFIELD SYSTEM (Sync with ordinal2.js) ===== */
  stars: [],
  shootingStars: [],
  shootingStarTimer: 0,
  shootingStarInterval: 3000,


  /* ===== GAME MODE SYSTEM ===== */
  gameMode: 1, // 0 = default (current), 1 = new mode

  mode1Numbers: [], // Will contain only one number at a time
  minNumberStars: 4, // Minimum number of stars around the number
  mode1TargetSuffix: "st",
  mode1SpawnTimer: 0,
  mode1SpawnInterval: 5000, // 5 seconds
  mode1Collected: false,


  /* ===== MODE 1 ROUND STATE ===== */
  mode1CorrectTotal: 10, // Collect 10 correct numbers to win
  mode1CorrectCollected: 0,
  mode1RoundActive: true,
  mode1Confirming: false,
  mode1PortalTargetX: 0,
  mode1PortalTargetY: 0,
  mode1GameOver: false,

  /* ===== MODE 1 SUCTION SYSTEM ===== */
  mode1SuctionActive: false,
  mode1SuctionData: null,
  mode1SuctionDuration: 600,

  /* ===== GALAXY LIFE SYSTEM ===== */
  galaxyMaxLife: 20000,
  galaxyLife: 20000,
  galaxyShrinkTimer: 0,

  galaxyCollapsed: false,
  blackHoleDelay: 1000, // 1 second freeze before black hole arrives
  blackHoleDelayTimer: 0,

  blackHoleActive: false,
  blackHoleRadius: 0,
  blackHoleX: 0,
  blackHoleY: 0,
  blackHoleSuctionParticles: [],
  blackHoleGrowthPhase: 0,

  // 📦 Object Pools
  pools: {
    sparkBursts: [],
    floatingTexts: [],
    blackHoleSuctionParticles: []
  },

  // 🎁 Sticker System
  stickers: [],
  stickerThreshold: 30,
  nextStickerScore: 30,
  newStickerUnlocked: false,
  stickerDisplayTimer: 0,

  // 🏆 Level System
  level: 1,
  levelThreshold: 50,
  nextLevelScore: 50,
  levelUpActive: false,
  levelUpTimer: 0,

  // 🌈 Background Evolution
  backgroundHueShift: 0,
  init() {
    try { if (screen.orientation && screen.orientation.lock) { screen.orientation.lock("landscape").catch(e => console.log("Orientation lock failed:", e)); } } catch (e) { }

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.score = 0;
    this.running = true;
    this.lastTime = performance.now();

    this.loadMascotSprites();
    this.loadPortalSprites();
    this.loadFingerImages();
    this.loadMeteorImages();
    this.initStarfield();

    this.setupDoors();

    this.mascot.x = this.CENTER_X;
    this.mascot.y = this.CENTER_Y + 100 * this.scale;

    window.addEventListener("keydown", (e) => {
      if (e.key === "1") {
        this.activateGameMode1();
      }
    });

    const handleRestart = () => {
      if (this.gameMode === 1 && this.mode1GameOver) {

        // 1️⃣ Reset Score & Progress
        this.score = 0;
        this.mode1CorrectCollected = 0;
        this.mode1GameOver = false;
        this.level = 1;
        this.nextLevelScore = 50;
        this.stickers = [];
        this.nextStickerScore = 30;

        // 2️⃣ Clear Active Effects
        this.sparkBursts = [];
        this.floatingTexts = [];
        this.confettiParticles = [];
        this.shootingStars = [];
        this.blackHoleSuctionParticles = [];

        // 3️⃣ Reset Mascot
        this.mascot.x = this.CENTER_X;
        this.mascot.y = this.CENTER_Y + 100 * this.scale;
        this.mascot.vx = 0;
        this.mascot.vy = 0;
        this.mascot.carryingNumber = false;
        this.mascotState = "idle";

        // 4️⃣ Reset Starfield (Randomize positions again)
        this.initStarfield();

        // 5️⃣ Re-activate Mode (Resets galaxy life, black hole, etc.)
        this.activateGameMode1();

        // 6️⃣ Reset Timer to prevent huge delta
        this.lastTime = performance.now();
      }
    };


    window.addEventListener("click", (e) => {
      sfxButtonClick_11.currentTime = 0;
      sfxButtonClick_11.play().catch(() => { });
      if (!this.gameStarted) {
        this.handleStartClick(e);
      } else {
        handleRestart();
      }
    });

    window.addEventListener("touchstart", (e) => {
      sfxButtonClick_11.currentTime = 0;
      sfxButtonClick_11.play().catch(() => { });
      // Prevent double trigger if both touch and click fire
      if (!this.gameStarted) {
        if (e.touches && e.touches.length > 0) {
          this.handleStartClick({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        }
      } else {
        handleRestart();
      }
    }, { passive: false });
  },
  resize() {

    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvasElement.width = cssW * dpr;
    canvasElement.height = cssH * dpr;

    const ctx = canvasElement.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.scale = Math.min(cssW / this.BASE_WIDTH, cssH / this.BASE_HEIGHT);
    if (!this.scale || this.scale <= 0) this.scale = 1;

    this.CENTER_X = cssW / 2;
    this.CENTER_Y = cssH / 2;

    this.cacheScalesAndGradients(ctx, cssW, cssH);
  },

  cacheScalesAndGradients(ctx, W, H) {
    const s = this.scale;
    // Pre-calculate scale multiplications
    this.s30 = 30 * s; this.s34 = 34 * s; this.s36 = 36 * s;
    this.s40 = 40 * s; this.s45 = 45 * s; this.s60 = 60 * s;
    this.s70 = 70 * s; this.s80 = 80 * s; this.s100 = 100 * s;
    this.s120 = 120 * s; this.s140 = 140 * s; this.s260 = 260 * s;
    this.doorR = this.DOOR_RADIUS * s;
    this.doorDist = this.DOOR_DISTANCE * s;

    // Cache font strings
    this.fScore = `bold ${this.s36}px Comic Sans MS`;
    this.fInstruction = `bold ${this.s34}px Comic Sans MS`;
    this.fFloating = `bold ${this.s40}px Comic Sans MS`;
    this.fGameOver = `bold ${this.s80}px Arial`;
    this.fRetry = `bold ${this.s45}px Arial`;
    this.fFinger = `bold ${20 * s}px Arial`;
    this.fNumber = `bold ${this.s30}px Arial`;

    // Cache gradients
    const T = this.T;
    this.bgGrd = ctx.createLinearGradient(0, 0, 0, H);
    this.bgGrd.addColorStop(0, T.bg1);
    this.bgGrd.addColorStop(0.5, T.bg2);
    this.bgGrd.addColorStop(1, T.bg3);

    this.radialGrd = ctx.createRadialGradient(this.CENTER_X, this.CENTER_Y * 0.7, 0, this.CENTER_X, this.CENTER_Y * 0.7, W * 0.55);
    this.radialGrd.addColorStop(0, "rgba(124,58,237,0.15)");
    this.radialGrd.addColorStop(1, "rgba(0,0,0,0)");
  },

  activateGameMode1() {

    this.gameMode = 1;

    this.mascot.carryingNumber = false;

    this.galaxyLife = this.galaxyMaxLife;

    this.galaxyCollapsed = false;
    this.blackHoleDelayTimer = 0;
    this.blackHoleActive = false;
    this.blackHoleSuctionParticles = [];
    this.blackHoleRadius = 0;
    this.blackHoleGrowthPhase = 0;

    // ── CLEAR MODE 1 NUMBERS ──────────────────────────────────────
    this.mode1Numbers = [];

    // Determine suffix based on finger states
    this.updateMode1TargetSuffix();

    this.spawnMode1Numbers();
  },

  updateMode1TargetSuffix() {

    if (!window.fingerStates) return;

    const { index, middle, ring, thumb } = window.fingerStates;

    if (index && middle && ring && thumb) {
      this.mode1TargetSuffix = "th";
    }
    else if (index && middle && thumb) {
      this.mode1TargetSuffix = "rd";
    }
    else if (index && middle) {
      this.mode1TargetSuffix = "nd";
    }
    else if (index) {
      this.mode1TargetSuffix = "st";
    }
  },

  setupDoors() {

    this.doors = [];

    const suffixes = ["st", "nd", "rd", "th"];

    const startX = this.cssWidth * 0.2;
    const gap = this.cssWidth * 0.2;
    const y = this.cssHeight * 0.55;

    for (let i = 0; i < 4; i++) {

      const suffix = suffixes[i];

      this.doors.push({
        x: startX + i * gap,
        y: y,
        suffix: suffix,
        label: `${suffix}` // st nd rd th
      });
    }
  },

  getSuffix(num) {

    const lastTwo = num % 100;

    // Special case: 11, 12, 13
    if (lastTwo >= 11 && lastTwo <= 13) {
      return "th";
    }

    const last = num % 10;

    if (last === 1) return "st";
    if (last === 2) return "nd";
    if (last === 3) return "rd";

    return "th";
  },
  update(ctx) {

    if (!this.running) return;

    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.drawBackground(ctx);
    this.updateStars(delta);
    this.drawStars(ctx);
    this.updateShootingStars(delta);
    this.drawShootingStars(ctx);

    if (!this.gameStarted) {
      this.drawFingerImages(ctx);
      this.drawStartScreen(ctx);
      return;
    }

    // 💥 Global Screen Shake
    ctx.save();
    if (this.galaxyCollapsed && !this.mode1GameOver && this.blackHoleActive) {
      const shake = Math.min(20 * this.scale, this.blackHoleRadius * 0.02);
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // 🎮 GAME LOGIC
    this.updateFingerPosition();
    this.updateMode1TargetSuffix();
    this.updateMascot(delta);

    this.updateGalaxyLife(delta);

    this.updateMode1Logic();

    this.updateMode1Suction(delta);

    this.updatePortalAnimation(delta);

    this.updateSparkBursts(delta);


    this.drawMode1PortalPlayer(ctx);
    this.drawMode1Numbers(ctx);

    this.drawMode1Instruction(ctx);

    this.drawSparkBursts(ctx);
    this.updateFloatingTexts(delta);
    this.drawFloatingTexts(ctx);
    this.drawGalaxyLifeBar(ctx);
    this.drawFingerImages(ctx);

    this.drawBlackHole(ctx, delta);
    this.drawMode1GameOver(ctx);

    this.drawScore(ctx);
    ctx.restore(); // End of screen shake
  },

  updateFingerPosition() {

    if (!window.fingerPositions ||
      window.fingerPositions.length === 0) {
      this.fingerX = null;
      this.fingerY = null;
      return;
    }

    const finger = window.fingerPositions[0];
    this.fingerX = finger.x;
    this.fingerY = finger.y;
  },

  get doorRadius() {
    return this.DOOR_RADIUS * this.scale;
  },

  drawFingerImages(ctx) {
    if (this.gameMode !== 1 || this.mode1GameOver || !this.mode1RoundActive) return;
    if (this.fingerImages.length === 0) return;

    const imgSize = 70 * this.scale;
    const padding = 40 * this.scale;
    const startX = 30 * this.scale;
    const startY = 150 * this.scale; // Below the score area
    const verticalGap = 130 * this.scale;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `bold ${20 * this.scale}px Arial`;
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;

    const labels = ["st", "nd", "rd", "th"];

    for (let i = 0; i < this.fingerImages.length; i++) {
      const img = this.fingerImages[i];
      const x = startX;
      const y = startY + i * verticalGap;

      if (img.complete) {
        // Decrease width of the second image
        const currentWidth = (i === 1) ? imgSize * 0.7 : imgSize;
        const currentX = x + (imgSize - currentWidth) / 2; // Keep it centered relative to others

        ctx.drawImage(img, currentX, y, currentWidth, imgSize);
        ctx.fillText(labels[i] || "", x + imgSize / 2, y + imgSize + 5 * this.scale);
      }
    }


    ctx.restore();
  },

  drawScore(ctx) {

    const padding = 20 * this.scale;
    const width = 220 * this.scale;
    const height = 70 * this.scale;
    const x = 20 * this.scale;
    const y = 20 * this.scale;

    // Glassmorphism bubble
    ctx.save();

    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 10;

    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2 * this.scale;

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 25 * this.scale);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Score text
    ctx.fillStyle = "#FFD700"; // gold
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 10;
    ctx.font = this.fScore;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      `⭐ ${this.score}`,
      x + width / 2,
      y + height / 2 + 2 * this.scale
    );

    ctx.restore();
  },

  drawFingerIndicator(ctx) {

    if (this.fingerX === null ||
      this.fingerY === null) return;

    ctx.beginPath();
    ctx.arc(
      this.fingerX,
      this.fingerY,
      18 * this.scale,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255,255,0,0.3)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      this.fingerX,
      this.fingerY,
      8 * this.scale,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "yellow";
    ctx.fill();
  },


  spawnSparkBurst(x, y) {
    const burst = this.pools.sparkBursts.pop() || {};
    burst.x = x; burst.y = y;
    burst.radius = 0; burst.maxRadius = 140 * this.scale;
    burst.alpha = 1; burst.life = 600; burst.type = "circle";
    this.sparkBursts.push(burst);

    for (let i = 0; i < 15; i++) {
      const p = this.pools.sparkBursts.pop() || {};
      p.x = x; p.y = y;
      p.vx = (Math.random() - 0.5) * 10;
      p.vy = (Math.random() - 0.5) * 10;
      p.size = (Math.random() * 4 + 2) * this.scale;
      p.life = 500; p.type = "particle";
      this.sparkBursts.push(p);
    }
  },

  updateSparkBursts(delta) {
    for (let i = this.sparkBursts.length - 1; i >= 0; i--) {
      const s = this.sparkBursts[i];
      s.life -= delta;
      if (s.life <= 0) {
        this.pools.sparkBursts.push(this.sparkBursts[i]);
        this.sparkBursts[i] = this.sparkBursts[this.sparkBursts.length - 1];
        this.sparkBursts.pop();
        continue;
      }
      if (s.type === "particle") {
        s.x += s.vx; s.y += s.vy;
        s.vx *= 0.95; s.vy *= 0.95;
      } else {
        const progress = 1 - (s.life / 600);
        s.radius = s.maxRadius * progress;
        s.alpha = 1 - progress;
      }
    }
  },

  drawSparkBursts(ctx) {

    for (let s of this.sparkBursts) {

      if (s.type === "particle") {

        ctx.globalAlpha = s.life / 500;
        ctx.fillStyle = "#00FFFF";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

      } else {

        ctx.globalAlpha = s.alpha;
        ctx.strokeStyle = "#00FFFF";
        ctx.lineWidth = 6 * this.scale;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  },

  resetHold() {
    this.holdProgress = 0;
    this.activeDoorIndex = null;
    this.doorLocked = false;
  },

  loadMascotSprites() {

    // IDLE 00_MID-I to 04_MID-I
    for (let i = 0; i <= 4; i++) {
      const img = new Image();
      img.src = `MID-I/0${i}_MID-I.png`;
      this.mascotImages.idle.push(img);
    }

    // HAPPY 00_MID-H to 03_MID-H
    for (let i = 0; i <= 3; i++) {
      const img = new Image();
      img.src = `MID-H/0${i}_MID-H.png`;
      this.mascotImages.happy.push(img);
    }

    // CONFUSED 00_MID-C to 02_MID-C
    for (let i = 0; i <= 2; i++) {
      const img = new Image();
      img.src = `MID-C/0${i}_MID-C.png`;
      this.mascotImages.confused.push(img);
    }
  },

  updateMascot(delta) {

    // Stop moving if galaxy collapsed
    if (this.gameMode === 1 && this.galaxyCollapsed) {
      this.mascot.vx *= 0.9;
      this.mascot.vy *= 0.9;
      return;
    }

    // MODE 1 CONFIRMATION MOVE
    if (this.gameMode === 1 && this.mode1Confirming) {

      const dx = this.mode1PortalTargetX - this.mascot.x;
      const dy = this.mode1PortalTargetY - this.mascot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 5) {

        this.mascot.x += dx * 0.08;
        this.mascot.y += dy * 0.08;

      } else {

        this.mode1Confirming = false;

        const suffixes = ["st", "nd", "rd", "th"];
        this.mode1TargetSuffix =
          suffixes[Math.floor(Math.random() * 4)];

        this.spawnMode1Numbers();
      }

      return;
    }

    if (this.fingerX === null || this.fingerY === null) return;

    /* ===== FINGER SMOOTHING FILTER ===== */

    if (!this.smoothedFingerX) {
      this.smoothedFingerX = this.fingerX;
      this.smoothedFingerY = this.fingerY;
    }

    const smoothFactor = 0.25;

    this.smoothedFingerX += (this.fingerX - this.smoothedFingerX) * smoothFactor;
    this.smoothedFingerY += (this.fingerY - this.smoothedFingerY) * smoothFactor;

    const dx = this.smoothedFingerX - this.mascot.x;
    const dy = this.smoothedFingerY - this.mascot.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    /* ===== ACCELERATION MOVEMENT ===== */

    if (distance > 2) {

      const accel = 0.9;

      this.mascot.vx += (dx / distance) * accel;
      this.mascot.vy += (dy / distance) * accel;

    }

    /* ===== SPEED LIMIT ===== */

    const speed = Math.sqrt(
      this.mascot.vx * this.mascot.vx +
      this.mascot.vy * this.mascot.vy
    );

    if (speed > this.mascot.maxSpeed) {

      this.mascot.vx = (this.mascot.vx / speed) * this.mascot.maxSpeed;
      this.mascot.vy = (this.mascot.vy / speed) * this.mascot.maxSpeed;
    }

    /* ===== FRICTION ===== */

    this.mascot.vx *= 0.92;
    this.mascot.vy *= 0.92;

    this.mascot.x += this.mascot.vx;
    this.mascot.y += this.mascot.vy;

    /* ===== EDGE CLAMP (DYNAMIC) ===== */

    const lifeRatio = this.galaxyLife / this.galaxyMaxLife;
    const portalSize = this.portalSize * this.scale * lifeRatio;

    const margin = portalSize * 0.45;

    this.mascot.x = Math.max(
      margin,
      Math.min(this.cssWidth - margin, this.mascot.x)
    );

    this.mascot.y = Math.max(
      margin,
      Math.min(this.cssHeight - margin, this.mascot.y)
    );
  },

  drawMascot(ctx) {

    let spriteArray = this.mascotImages[this.mascotState];
    if (!spriteArray || spriteArray.length === 0) return;

    // Animate sprite frames
    this.mascotFrameTimer += 16;
    if (this.mascotFrameTimer > this.mascotFrameSpeed) {
      this.mascotFrame++;
      this.mascotFrameTimer = 0;
    }
    if (this.mascotFrame >= spriteArray.length) {
      this.mascotFrame = 0;
    }

    const img = spriteArray[this.mascotFrame];

    const time = performance.now();

    // 🌬️ Gentle breathing animation
    const breathe = 1 + Math.sin(time * 0.002) * 0.03;

    // 🎈 Floating bounce
    const floatOffset =
      Math.sin(time * 0.004) *
      8 *
      this.scale;

    const mascotX = this.mascot.x;
    const mascotY = this.mascot.y + floatOffset;

    // 🐾 Detect movement speed
    const speed =
      Math.sqrt(this.mascot.vx * this.mascot.vx +
        this.mascot.vy * this.mascot.vy);

    // 🧃 Squash & stretch when moving
    let stretchX = 1;
    let stretchY = 1;

    if (speed > 2) {
      stretchX = 1 + Math.min(speed * 0.02, 0.15);
      stretchY = 1 - Math.min(speed * 0.015, 0.1);
    }

    ctx.save();


    // 🫧 Soft shadow
    ctx.beginPath();
    ctx.ellipse(
      mascotX,
      mascotY + 70 * this.scale,
      65 * this.scale,
      22 * this.scale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    // ✨ Happy success aura
    if (this.mascotState === "happy") {
      const glowPulse =
        30 + Math.sin(time * 0.01) * 10;

      ctx.shadowColor = "#FFF59D";
      ctx.shadowBlur = glowPulse;

      // Radiating ring
      ctx.beginPath();
      ctx.arc(
        mascotX,
        mascotY,
        90 * this.scale,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "rgba(255,255,150,0.5)";
      ctx.lineWidth = 6 * this.scale;
      ctx.stroke();
    }

    // 🎮 Apply squash + breathe scaling
    ctx.translate(mascotX, mascotY);
    ctx.scale(
      stretchX * breathe,
      stretchY * breathe
    );

    ctx.drawImage(
      img,
      -(this.mascot.size * this.scale) / 2,
      -(this.mascot.size * this.scale) / 2,
      this.mascot.size * this.scale,
      this.mascot.size * this.scale
    );

    ctx.shadowBlur = 0;

    // 💎 Magical carried number badge
    if (this.mascot.carryingNumber) {

      const badgeY = -80 * this.scale;

      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 30;

      ctx.lineWidth = 7;
      ctx.strokeStyle = "#FFD700";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${44 * this.scale}px Comic Sans MS`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeText(
        this.currentNumber,
        0,
        badgeY
      );

      ctx.fillText(
        this.currentNumber,
        0,
        badgeY
      );

      ctx.shadowBlur = 0;
    }

    ctx.restore();
  },

  loadPortalSprites() {

    this.portalFrames = [];

    for (let i = 0; i <= 8; i++) {
      const img = new Image();
      img.src = `D-1/0${i}_D-1.png`;  // rename if needed
      this.portalFrames.push(img);
    }
  },

  loadFingerImages() {
    this.fingerImages = [];
    const files = [
      "Fingers/Fingers-ST.png",
      "Fingers/Fingers-ND.png",
      "Fingers/Fingers-RD.png",
      "Fingers/Fingers-TH.png"
    ];

    for (let file of files) {
      const img = new Image();
      img.src = file;
      this.fingerImages.push(img);
    }
  },

  loadMeteorImages() {
    this.meteorImages = [];
    const files = ["Meteors/meteors1.png", "Meteors/meteors2.png"];
    for (let f of files) {
      const img = new Image();
      img.src = f;
      this.meteorImages.push(img);
    }
  },


  updatePortalAnimation(delta) {

    this.portalFrameTimer += delta;

    if (this.portalFrameTimer > this.portalFrameSpeed) {

      this.portalFrameIndex++;
      this.portalFrameTimer = 0;

      if (this.portalFrameIndex >= this.portalFrames.length) {
        this.portalFrameIndex = 0;
      }
    }
  },

  /* ============================================================
     BACKGROUND (Ported from ordinal2.js)
  ============================================================ */
  drawBackground(ctx) {
    ctx.fillStyle = this.bgGrd || "#0a0e27";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.fillStyle = this.radialGrd || "transparent";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  },
  initStarfield() {
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * this.cssWidth,
        y: Math.random() * this.cssHeight,
        r: Math.random() * 1.8 + 0.3,
        speed: 0.008 + Math.random() * 0.025,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpd: 0.002 + Math.random() * 0.003
      });
    }
  },

  updateStars(delta) {
    for (let s of this.stars) {
      s.y += s.speed * delta;
      s.twinkle += s.twinkleSpd * delta;
      if (s.y > this.cssHeight) { s.y = 0; s.x = Math.random() * this.cssWidth; }
    }
  },

  drawStars(ctx) {
    for (let s of this.stars) {
      ctx.globalAlpha = Math.max(0, 0.35 + Math.sin(s.twinkle) * 0.3);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.fill();
    }
    ctx.globalAlpha = 1;
  },


  initShootingStarTimer() {
    this.shootingStarTimer = 0;
    this.shootingStarInterval = 2500 + Math.random() * 3000;
  },



  updateShootingStars(delta) {
    this.shootingStarTimer += delta;

    if (
      this.shootingStarTimer >= this.shootingStarInterval &&
      this.shootingStars.length < 4
    ) {
      this.shootingStarTimer = 0;
      this.shootingStarInterval = 2500 + Math.random() * 3000;

      const fl = Math.random() < 0.5;
      const spd = (7 + Math.random() * 5) * 0.055;
      this.shootingStars.push({
        x: fl ? -60 : this.cssWidth + 60,
        y: Math.random() * this.cssHeight * 0.5,
        vx: fl ? spd : -spd,
        vy: (1.5 + Math.random() * 1.5) * 0.055,
        life: 0,
        maxLife: 900
      });
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.x += s.vx * delta;
      s.y += s.vy * delta;
      s.life += delta;
      if (s.life > s.maxLife) this.shootingStars.splice(i, 1);
    }
  },

  drawShootingStars(ctx) {
    for (let s of this.shootingStars) {
      const alpha = Math.max(0, 1 - s.life / s.maxLife);
      const tailLen = 160;
      const absVx = Math.abs(s.vx) || 0.01;
      const tx = s.x - s.vx * tailLen / absVx;
      const ty = s.y - s.vy * tailLen / absVx;

      const grd = ctx.createLinearGradient(s.x, s.y, tx, ty);
      grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2 * this.scale;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  },


  spawnMode1Numbers() {

    const margin = 100 * this.scale;
    const minX = 180 * this.scale;  // Beside finger images
    const minY = 200 * this.scale;  // Below life bar
    const maxX = this.cssWidth - margin;
    const maxY = this.cssHeight - margin;

    const minDistance = 150 * this.scale;

    while (this.mode1Numbers.length < this.minNumberStars) {

      let foundPos = false;
      let x, y;
      let attempts = 0;

      while (!foundPos && attempts < 50) {
        attempts++;
        x = minX + Math.random() * (maxX - minX);
        y = minY + Math.random() * (maxY - minY);

        let overlapping = false;

        // 1️⃣ Check against other numbers
        for (let other of this.mode1Numbers) {
          const dx = x - other.x;
          const dy = y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            overlapping = true;
            break;
          }
        }

        // 2️⃣ Check against Mascot (Portal) position
        const dxM = x - this.mascot.x;
        const dyM = y - this.mascot.y;
        const distM = Math.sqrt(dxM * dxM + dyM * dyM);
        const minPortalDist = 250 * this.scale; // Fair distance from the portal
        if (distM < minPortalDist) {
          overlapping = true;
        }

        if (!overlapping) {
          foundPos = true;
        }
      }

      if (foundPos) {
        // Random number 1–100
        const num = Math.floor(Math.random() * 100) + 1;

        this.mode1Numbers.push({
          number: num,
          x: x,
          y: y,
          size: 60 * this.scale,

          starSize: 70 * this.scale,
          starRotation: Math.random() * Math.PI * 2,
          starOpacity: 1,
          meteorIndex: Math.floor(Math.random() * this.meteorImages.length)
        });
      } else {
        // Could not find a spot, wait for next attempt or lower count
        break;
      }
    }

  },


  generateNumberWithSuffix(suffix) {

    while (true) {

      const num = Math.floor(Math.random() * 100) + 1;

      if (this.getSuffix(num) === suffix) {
        return num;
      }
    }
  },


  drawMode1PortalPlayer(ctx) {

    const portalImg = this.portalFrames[this.portalFrameIndex];

    const lifeRatio = this.galaxyLife / this.galaxyMaxLife;
    const size = this.portalSize * this.scale * lifeRatio;

    // Draw inside pulse
    const time = performance.now();
    this.drawGalaxyPulse(ctx, time, size);

    if (!portalImg) return;

    ctx.drawImage(
      portalImg,
      this.mascot.x - size / 2,
      this.mascot.y - size / 2,
      size,
      size
    );

    /* Suffix label (match ordinal2.js style) */
    ctx.save();
    ctx.translate(this.mascot.x, this.mascot.y);
    ctx.shadowColor = "black";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.round(62 * this.scale * lifeRatio);
    ctx.font = `bold ${fontSize}px 'Comic Sans MS', cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textStr = this.mode1TargetSuffix.toUpperCase();
    ctx.fillText(textStr, 0, 0);
    ctx.fillText(textStr, 0, 0);
    ctx.fillText(textStr, 0, 0);
    ctx.fillText(textStr, 0, 0);
    ctx.fillText(textStr, 0, 0);
    ctx.restore();
  },


  drawMode1Numbers(ctx) {

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let n of this.mode1Numbers) {

      const scale = n.renderScale || 1;
      const rotation = n.renderRotation || 0;

      // Draw meteor image
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.starRotation + rotation);
      ctx.scale(scale, scale);
      ctx.globalAlpha = n.starOpacity || 1;

      const meteorImg = this.meteorImages[n.meteorIndex];
      if (meteorImg && meteorImg.complete) {
        ctx.drawImage(
          meteorImg,
          -n.starSize / 2,
          -n.starSize / 2,
          n.starSize,
          n.starSize
        );
      } else {
        // Fallback: star
        ctx.beginPath();
        const spikes = 5;
        const outerRadius = n.starSize / 2;
        const innerRadius = outerRadius * 0.45;
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
        grad.addColorStop(0, `rgba(255, 255, 200, ${n.starOpacity})`);
        grad.addColorStop(0.3, `rgba(255, 200, 0, ${n.starOpacity})`);
        grad.addColorStop(1, `rgba(255, 120, 0, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 230, 0, ${n.starOpacity * 0.9})`;
        ctx.lineWidth = 2 * this.scale;
        ctx.stroke();
      }
      ctx.restore();

      // Draw number
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#8B4513";
      ctx.lineWidth = 5 * this.scale;
      ctx.shadowBlur = 4;
      ctx.font = this.fNumber;

      ctx.strokeText(n.number, 0, 0);
      ctx.fillText(n.number, 0, 0);

      ctx.restore();
    }
  },

  updateGalaxyLife(delta) {

    if (this.galaxyCollapsed) return;

    this.galaxyLife -= delta;

    if (this.galaxyLife <= 0) {

      // Galaxy collapses - freeze everything
      this.galaxyCollapsed = true;
      this.blackHoleDelayTimer = 0;

      this.blackHoleX = this.mascot.x;
      this.blackHoleY = this.mascot.y;

      return;
    }
  },

  updateMode1Logic() {

    if (!this.mode1RoundActive ||
      this.mode1GameOver ||
      this.mode1SuctionActive ||
      this.galaxyCollapsed) return;

    // Update star rotation
    for (let n of this.mode1Numbers) {
      n.starRotation += 0.005; // Rotate star slowly
    }

    for (let i = 0; i < this.mode1Numbers.length; i++) {

      const n = this.mode1Numbers[i];

      const dx = this.mascot.x - n.x;
      const dy = this.mascot.y - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 70 * this.scale) {

        this.startMode1Suction(i);
        break;
      }
    }
  },

  drawMode1Instruction(ctx) {

    const time = performance.now();
    const floatY = Math.sin(time * 0.002) * 5 * this.scale;

    const yBaseline = 60 * this.scale + floatY;

    ctx.save();

    const text = `Show Fingers to Choose Ordinals Suffix: ${this.mode1TargetSuffix.toUpperCase()}`;
    ctx.font = this.fInstruction;
    const textWidth = ctx.measureText(text).width;

    const padX = 40 * this.scale;
    const padY = 20 * this.scale;

    // Glassy badge
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2 * this.scale;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.roundRect(this.CENTER_X - textWidth / 2 - padX, yBaseline - 25 * this.scale - padY / 2, textWidth + padX * 2, 50 * this.scale + padY, 30 * this.scale);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 8;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(text, this.CENTER_X, yBaseline);

    ctx.restore();
  },


  startMode1Confirmation() {

    this.mode1RoundActive = false;
    this.mode1Confirming = true;

    this.mode1PortalTargetX = 120 * this.scale;
    this.mode1PortalTargetY = this.cssHeight - 120 * this.scale;
  },

  drawMode1GameOver(ctx) {

    if (!this.mode1GameOver) return;
    const time = performance.now();

    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // Calculate pop-in animation scale
    const elapsed = time - (this.gameOverStartTime || time);
    let popScale = Math.min(elapsed / 300, 1.0); // 300ms pop in

    // Slight overshoot bounce
    if (elapsed < 300) {
      popScale += Math.sin((elapsed / 300) * Math.PI) * 0.15;
    }

    ctx.save();

    // Translate to center so scaling happens from the middle
    ctx.translate(this.CENTER_X, this.CENTER_Y - 50 * this.scale);
    ctx.scale(popScale, popScale);

    ctx.fillStyle = "#FF4444";
    ctx.shadowColor = "#FF0000";
    ctx.shadowBlur = 10;
    ctx.font = this.fGameOver;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "Galaxy Collapse!",
      0,
      0
    );
    ctx.restore();

    // 3. TAP TO RETRY TEXT WITH CYAN GLOW
    ctx.save();

    ctx.translate(this.CENTER_X, this.CENTER_Y + 50 * this.scale);
    ctx.scale(popScale, popScale);

    // Keep opacity high so it never fades out completely and is instantly visible
    ctx.globalAlpha = 0.8 + Math.sin(time * 0.005) * 0.2;
    ctx.fillStyle = "#00FFAA";
    ctx.shadowColor = "#00FFAA";
    ctx.shadowBlur = 10;
    ctx.font = this.fRetry;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "Tap To Retry",
      0,
      0
    );
    ctx.restore();
  },
  retryMode1() {

    this.mode1GameOver = false;

    const suffixes = ["st", "nd", "rd", "th"];
    this.mode1TargetSuffix =
      suffixes[Math.floor(Math.random() * 4)];

    this.spawnMode1Numbers();
  },


  startMode1Suction(index) {

    const n = this.mode1Numbers[index];

    this.mode1SuctionActive = true;

    this.mode1SuctionData = {
      index: index,
      startX: n.x,
      startY: n.y,
      time: 0,
      rotation: 0,
      scale: 1
    };
  },


  updateMode1Suction(delta) {

    if (!this.mode1SuctionActive) return;

    const s = this.mode1SuctionData;
    const n = this.mode1Numbers[s.index];

    if (!n) {
      this.mode1SuctionActive = false;
      return;
    }

    s.time += delta;

    const progress = s.time / this.mode1SuctionDuration;

    const angle = progress * Math.PI * 4;
    const radius = (1 - progress) * 60 * this.scale;

    n.x = this.mascot.x + Math.cos(angle) * radius;
    n.y = this.mascot.y + Math.sin(angle) * radius;

    s.rotation += 0.3;
    s.scale = 1 - progress;

    n.renderRotation = s.rotation;
    n.renderScale = s.scale;

    if (progress >= 1) {

      this.finishMode1Suction();
    }
  },

  finishMode1Suction() {

    const s = this.mode1SuctionData;
    const n = this.mode1Numbers[s.index];

    if (!n) {
      this.mode1SuctionActive = false;
      return;
    }

    if (this.getSuffix(n.number) === this.mode1TargetSuffix) {
      sfxCorrect_11.currentTime = 0;
      sfxCorrect_11.play().catch(() => { });

      this.score += 10;
      this.mode1CorrectCollected++;

      // ⭐ Add 3 seconds life
      this.galaxyLife += 5000;

      if (this.galaxyLife > this.galaxyMaxLife)
        this.galaxyLife = this.galaxyMaxLife;

      this.spawnSparkBurst(this.mascot.x, this.mascot.y);
      const ordinalNum = n.number + this.getSuffix(n.number);
      this.spawnFloatingText(this.mascot.x, this.mascot.y - 100 * this.scale, `${ordinalNum}! +5s`, "#00FFAA");

      this.mode1Numbers.splice(s.index, 1);

      // Always maintain minimum stars
      this.spawnMode1Numbers();

    } else {
      sfxWrong_11.currentTime = 0;
      sfxWrong_11.play().catch(() => { });

      this.score -= 5;
      const ordinalNum = n.number + this.getSuffix(n.number);
      this.spawnFloatingText(this.mascot.x, this.mascot.y - 100 * this.scale, `${ordinalNum}? Oops!`, "#FF4444");

      // Remove wrong number and spawn new one (game continues)
      this.mode1Numbers.splice(s.index, 1);
      this.spawnMode1Numbers();

    }

    this.mode1SuctionActive = false;
    this.mode1SuctionData = null;
  },

  distSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  },

  drawBlackHole(ctx, delta) {
    if (!this.galaxyCollapsed) return;

    // ── Phase 0: Freeze delay ──────────────────────────────────────
    this.blackHoleDelayTimer += delta;
    if (this.blackHoleDelayTimer < this.blackHoleDelay) {
      // During delay: draw a tiny seed point with a shockwave ring
      const progress = this.blackHoleDelayTimer / this.blackHoleDelay;
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.beginPath();
      ctx.arc(this.blackHoleX, this.blackHoleY, 12 * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "black";
      ctx.shadowColor = "white";
      ctx.shadowBlur = 30 * progress;
      ctx.fill();
      // shockwave ring expanding outward
      const shockR = progress * 80 * this.scale;
      ctx.beginPath();
      ctx.arc(this.blackHoleX, this.blackHoleY, shockR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${(1 - progress) * 0.8})`;
      ctx.lineWidth = 4 * this.scale;
      ctx.stroke();
      ctx.restore();
      return;
    }

    // ── Phase 1: Black hole active ─────────────────────────────────
    this.blackHoleActive = true;

    // Growth: slow S-curve start, then accelerate
    const growthRate = 0.15 + this.blackHoleRadius * 0.0018;
    this.blackHoleRadius += delta * growthRate;

    const bx = this.blackHoleX;
    const by = this.blackHoleY;
    const br = this.blackHoleRadius;

    // ── SUCK BACKGROUND STARS toward black hole ───────────────────
    for (let s of this.stars) {
      const dx = bx - s.x;
      const dy = by - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = Math.min(800 / dist, 25);  // stronger when closer
      s.x += (dx / dist) * pull * (delta / 16);
      s.y += (dy / dist) * pull * (delta / 16);
      // respawn star on other side if swallowed
      if (dist < br * 0.9) {
        s.x = Math.random() * this.cssWidth;
        s.y = Math.random() * this.cssHeight;
      }
    }

    // ── SUCK NUMBER STARS toward black hole ───────────────────────
    for (let n of this.mode1Numbers) {
      const dx = bx - n.x;
      const dy = by - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = Math.min(600 / dist, 18);
      n.x += (dx / dist) * pull * (delta / 16);
      n.y += (dy / dist) * pull * (delta / 16);
      n.starRotation += 0.08;   // spin faster as they're pulled
      // shrink as they enter
      if (dist < br * 1.2) {
        n.renderScale = Math.max(0, (dist - br) / (br * 0.2));
      }
    }

    // ── SPAWN SUCTION RIBBON PARTICLES ───────────────────────────
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spawnR = br * (1.5 + Math.random() * 3);
      this.blackHoleSuctionParticles.push({
        x: bx + Math.cos(angle) * spawnR,
        y: by + Math.sin(angle) * spawnR,
        life: 600 + Math.random() * 400,
        maxLife: 1000,
        size: (Math.random() * 2.5 + 0.5) * this.scale,
        color: Math.random() < 0.5
          ? `rgba(255,${Math.floor(100 + Math.random() * 155)},50,`
          : `rgba(200,200,255,`
      });
    }

    // Update & draw suction particles
    for (let i = this.blackHoleSuctionParticles.length - 1; i >= 0; i--) {
      const p = this.blackHoleSuctionParticles[i];
      const dx = bx - p.x;
      const dy = by - p.y;
      const dSq = dx * dx + dy * dy;
      const brSq = br * br;

      if (p.life <= 0 || dSq < brSq * 0.9) {
        this.pools.blackHoleSuctionParticles.push(this.blackHoleSuctionParticles[i]);
        this.blackHoleSuctionParticles[i] = this.blackHoleSuctionParticles[this.blackHoleSuctionParticles.length - 1];
        this.blackHoleSuctionParticles.pop();
        continue;
      }

      const dist = Math.sqrt(dSq) || 1;
      const pull = Math.min(1200 / dist, 30);
      p.x += (dx / dist) * pull * (delta / 16);
      p.y += (dy / dist) * pull * (delta / 16);
      p.life -= delta;

      const alpha = (p.life / p.maxLife) * 0.9;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color + alpha + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── OUTER GRAVITATIONAL LENS RINGS ────────────────────────────
    const lensTime = performance.now();
    for (let ring = 0; ring < 3; ring++) {
      const ringR = br * (1.08 + ring * 0.18);
      const pulse = Math.sin(lensTime * 0.003 + ring * 1.2) * 0.5 + 0.5;
      ctx.save();
      ctx.shadowColor = "white";
      ctx.shadowBlur = (20 + pulse * 20) * this.scale;
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + pulse * 0.08})`;
      ctx.lineWidth = (3 - ring) * this.scale;
      ctx.beginPath();
      ctx.arc(bx, by, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── ACCRETION DISK ────────────────────────────────────────────
    const diskRadius = br * 1.5;
    const gradient = ctx.createRadialGradient(bx, by, br * 0.55, bx, by, diskRadius);
    gradient.addColorStop(0, "rgba(255,220,80,0.95)");
    gradient.addColorStop(0.2, "rgba(255,130,0,0.75)");
    gradient.addColorStop(0.5, "rgba(200,40,10,0.4)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(bx, by, diskRadius, 0, Math.PI * 2);
    ctx.fill();

    // ── CORE BLACK CIRCLE ─────────────────────────────────────────
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();

    // ── EVENT HORIZON SHIMMER ─────────────────────────────────────
    const shimmerAngle = (lensTime * 0.001) % (Math.PI * 2);
    const shimGrad = ctx.createConicalGradient
      ? null  // not supported in most browsers; skip
      : null;
    // Simple rotating arc highlights instead:
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,180,1)";
    ctx.lineWidth = 4 * this.scale;
    ctx.beginPath();
    ctx.arc(bx, by, br * 1.02, shimmerAngle, shimmerAngle + 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, by, br * 1.02, shimmerAngle + Math.PI, shimmerAngle + Math.PI + 0.8);
    ctx.stroke();
    ctx.restore();

    // ── TRIGGER GAME OVER ─────────────────────────────────────────
    if (br > this.cssWidth * 1.5) {
      if (!this.mode1GameOver) {
        this.gameOverStartTime = performance.now();
      }
      this.mode1GameOver = true;
    }
  },



  spawnFloatingText(x, y, text, color) {
    const ft = this.pools.floatingTexts.pop() || {};
    ft.x = x; ft.y = y; ft.text = text; ft.color = color;
    ft.life = 1000; ft.maxLife = 1000; ft.vy = -2 * this.scale;
    this.floatingTexts.push(ft);
  },

  updateFloatingTexts(delta) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      let ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= delta;
      if (ft.life <= 0) {
        this.pools.floatingTexts.push(this.floatingTexts[i]);
        this.floatingTexts[i] = this.floatingTexts[this.floatingTexts.length - 1];
        this.floatingTexts.pop();
      }
    }
  },

  drawFloatingTexts(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = this.fFloating;
      ctx.fillStyle = ft.color;
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  },

  drawGalaxyLifeBar(ctx) {
    if (this.gameMode !== 1 || this.mode1GameOver || !this.mode1RoundActive) return;

    const barWidth = 400 * this.scale;
    const barHeight = 20 * this.scale;
    const x = this.CENTER_X - barWidth / 2;
    const y = 130 * this.scale;

    ctx.save();
    // Glassy background
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2 * this.scale;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 10 * this.scale);
    ctx.fill();
    ctx.stroke();

    // Fill gradient
    const lifeRatio = Math.max(0, this.galaxyLife / this.galaxyMaxLife);
    if (lifeRatio > 0) {
      const grad = ctx.createLinearGradient(x, 0, x + barWidth, 0);
      grad.addColorStop(0, "#FF0000"); // Red (left/low)
      grad.addColorStop(0.5, "#8A2BE2"); // Purple (mid)
      grad.addColorStop(1, "#00BFFF"); // Blue (right/full)

      ctx.fillStyle = grad;
      ctx.shadowColor = "#8A2BE2";
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth * lifeRatio, barHeight, 10 * this.scale);
      ctx.fill();
    }
    ctx.restore();
  },

  drawGalaxyPulse(ctx, time, portalSize) {
    if (this.gameMode !== 1 || this.mode1GameOver || this.galaxyCollapsed) return;

    // Pulsate every 1.5 seconds (1500 ms)
    const pulsePhase = (time % 1500) / 1500;
    let alpha = Math.sin(pulsePhase * Math.PI);
    alpha = Math.pow(alpha, 4) * 0.6;

    ctx.save();

    // Draw a pulsating aura inside/behind the portal
    const radius = portalSize * 0.6; // Scale pulse based on portal size
    const grad = ctx.createRadialGradient(
      this.mascot.x, this.mascot.y, 0,
      this.mascot.x, this.mascot.y, radius
    );
    grad.addColorStop(0, `rgba(255, 30, 30, ${alpha})`);
    grad.addColorStop(0.7, `rgba(255, 0, 0, ${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(255, 0, 0, 0)`);

    ctx.beginPath();
    ctx.arc(this.mascot.x, this.mascot.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();
  },

  handleStartClick(e) {
    const btnW = 220 * this.scale;
    const btnH = 70 * this.scale;
    const btnX = this.CENTER_X - btnW / 2;
    const btnY = this.CENTER_Y + 150 * this.scale;

    if (e.clientX >= btnX && e.clientX <= btnX + btnW &&
      e.clientY >= btnY && e.clientY <= btnY + btnH) {
      this.gameStarted = true;
      this.activateGameMode1();
      this.lastTime = performance.now();
    }
  },

  drawStartScreen(ctx) {
    ctx.save();

    const boxW = 1000 * this.scale;
    const boxH = 350 * this.scale;
    const boxX = this.CENTER_X - boxW / 2;
    const boxY = this.CENTER_Y - boxH / 2 - 40 * this.scale;

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.strokeStyle = "rgba(124, 58, 237, 0.9)";
    ctx.lineWidth = 4 * this.scale;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 20 * this.scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${28 * this.scale}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const line1 = "Make the hand shape as shown on the left";
    const line2 = "to get the necessary ordinal suffix on the galaxy";
    const line3 = "(Remember to show your palm towards the camera)";
    const line4 = "Collect numbers with correct suffix to increase score and life duration";
    const line5 = "Wrong answer will lead to decrease in score";

    ctx.fillText(line1, this.CENTER_X, boxY + 50 * this.scale);
    ctx.fillText(line2, this.CENTER_X, boxY + 100 * this.scale);

    ctx.fillStyle = "#60a5fa"; // blueish color for emphasis on the new instruction
    ctx.fillText(line3, this.CENTER_X, boxY + 150 * this.scale);

    ctx.fillStyle = "#34d399"; // greenish color 
    ctx.fillText(line4, this.CENTER_X, boxY + 220 * this.scale);

    ctx.fillStyle = "#f87171"; // reddish color
    ctx.fillText(line5, this.CENTER_X, boxY + 290 * this.scale);

    const btnW = 220 * this.scale;
    const btnH = 70 * this.scale;
    const btnX = this.CENTER_X - btnW / 2;
    const btnY = this.CENTER_Y + 150 * this.scale;

    ctx.shadowColor = "rgba(124, 58, 237, 0.8)";
    ctx.shadowBlur = 15;

    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 15 * this.scale);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${32 * this.scale}px Arial`;
    ctx.fillText("START", this.CENTER_X, btnY + btnH / 2 + 2 * this.scale);

    ctx.restore();
  }

};
