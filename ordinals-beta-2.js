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

  running: false,
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
    speed: 0.6,
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



  /* ===== STARFIELD SYSTEM ===== */

  starsFar: [],
  starsMid: [],
  starsNear: [],

  starCountFar: 80,
  starCountMid: 50,
  starCountNear: 30,

  /* ===== COSMIC DUST SYSTEM ===== */

  cosmicDust: [],
  dustCount: 120,
  dustDriftAngle: 0.0003,
  dustGlobalTime: 0,


  /* ===== NEBULA SYSTEM ===== */

  nebulaTime: 0,
  nebulaSpeed: 0.0002,


  /* ===== SHOOTING STAR SYSTEM ===== */

  shootingStars: [],
  shootingStarSpawnTimer: 0,
  shootingStarSpawnInterval: 2000, // average spawn time (ms)

  /* ===== SHOOTING STAR BURST SYSTEM ===== */

  shootingStarBursts: [],


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
  galaxyMaxLife: 10000, // 7 seconds
  galaxyLife: 10000,
  galaxyShrinkTimer: 0,

  galaxyCollapsed: false,
  blackHoleDelay: 1000, // 1 second freeze before black hole arrives
  blackHoleDelayTimer: 0,

  blackHoleActive: false,
  blackHoleRadius: 0,
  blackHoleX: 0,
  blackHoleY: 0,


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

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.score = 0;
    this.running = true;
    this.lastTime = performance.now();

    this.loadMascotSprites();
    this.loadPortalSprites();
    this.loadFingerImages();
    this.initStarfield();      // NEW

    this.setupDoors();

    this.mascot.x = this.CENTER_X;
    this.mascot.y = this.CENTER_Y + 100 * this.scale;

    this.activateGameMode1();

    window.addEventListener("keydown", (e) => {
      if (e.key === "1") {
        this.activateGameMode1();
      }
    });

    const handleRestart = () => {
      if (this.gameMode === 1 && this.mode1GameOver) {
        this.score = 0;
        this.mode1CorrectCollected = 0;
        this.mode1GameOver = false;
        this.activateGameMode1();
      }
    };

    window.addEventListener("click", handleRestart);
    window.addEventListener("touchstart", (e) => {
      // Prevent double trigger if both touch and click fire
      handleRestart();
    }, { passive: true });
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
  },

  activateGameMode1() {

    this.gameMode = 1;

    this.mascot.carryingNumber = false;

    this.galaxyLife = this.galaxyMaxLife;

    this.galaxyCollapsed = false;
    this.blackHoleDelayTimer = 0;
    this.blackHoleActive = false;
    this.blackHoleRadius = 0;

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

    this.drawDreamBackground(ctx);

    // 💥 Global Screen Shake
    ctx.save();
    if (this.galaxyCollapsed && !this.mode1GameOver && this.blackHoleActive) {
      const shake = Math.min(20 * this.scale, this.blackHoleRadius * 0.02);
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }



    // 🌌 STARFIELD
    this.updateStarLayer(this.starsFar, delta);
    this.updateStarLayer(this.starsMid, delta);
    this.updateStarLayer(this.starsNear, delta);
    this.ensureMinimumStars();

    this.drawStarLayer(ctx, this.starsFar);
    this.drawStarLayer(ctx, this.starsMid);
    this.drawStarLayer(ctx, this.starsNear);


    // 🌠 SHOOTING STARS
    this.updateShootingStars(delta);
    this.drawShootingStars(ctx);

    this.updateStarBursts(delta);
    this.drawStarBursts(ctx);

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
    ctx.font = `bold ${36 * this.scale}px Comic Sans MS`;
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

    this.sparkBursts.push({
      x: x,
      y: y,
      radius: 0,
      maxRadius: 140 * this.scale,
      alpha: 1,
      life: 600
    });

    // Add mini sparks
    for (let i = 0; i < 20; i++) {
      this.sparkBursts.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
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

        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.95;
        s.vy *= 0.95;

      } else {

        const progress = 1 - (s.life / 600);
        s.radius = s.maxRadius * progress;
        s.alpha = 1 - progress;
      }

      if (s.life <= 0) {
        this.sparkBursts.splice(i, 1);
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


  initStarfield() {

    this.starsFar = [];
    this.starsMid = [];
    this.starsNear = [];

    // Ensure minimum 5 stars total
    const totalStars = Math.max(5, this.starCountFar + this.starCountMid + this.starCountNear);

    // Distribute stars across layers, ensuring minimum coverage
    const farCount = Math.max(2, Math.floor(totalStars * 0.4));
    const midCount = Math.max(2, Math.floor(totalStars * 0.35));
    const nearCount = Math.max(1, totalStars - farCount - midCount);

    for (let i = 0; i < farCount; i++) {
      this.starsFar.push(this.createStar(0.2));
    }

    for (let i = 0; i < midCount; i++) {
      this.starsMid.push(this.createStar(0.5));
    }

    for (let i = 0; i < nearCount; i++) {
      this.starsNear.push(this.createStar(1));
    }
  },

  createStar(speedFactor) {

    return {
      x: Math.random() * this.cssWidth,
      y: Math.random() * this.cssHeight,
      size: Math.random() * 3 + 1,
      speed: speedFactor
    };
  },

  updateStarLayer(layer, delta) {

    for (let star of layer) {

      star.y += star.speed * delta * 0.02;

      if (this.galaxyCollapsed) {
        const dx = this.blackHoleX - star.x;
        const dy = this.blackHoleY - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = 0.02; // Reduced slightly for smoothness

        star.x += dx * pull;
        star.y += dy * pull;

        // swirl
        star.x += -dy * 0.01;
        star.y += dx * 0.01;
      }

      if (star.y > this.cssHeight) {
        star.y = 0;
        star.x = Math.random() * this.cssWidth;
      }
    }
  },

  ensureMinimumStars() {

    const totalStars = this.starsFar.length + this.starsMid.length + this.starsNear.length;

    if (totalStars < 5) {
      const starsNeeded = 5 - totalStars;

      // Add stars to the near layer (most visible)
      for (let i = 0; i < starsNeeded; i++) {
        this.starsNear.push(this.createStar(1));
      }
    }
  },

  drawStarLayer(ctx, layer) {

    for (let star of layer) {

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
    }
  },


  createShootingStar() {

    const startFromLeft = Math.random() < 0.5;

    const star = {
      x: startFromLeft ? -50 : this.cssWidth + 50,
      y: Math.random() * this.cssHeight * 0.5,
      length: Math.random() * 120 + 80,
      speedX: startFromLeft ? Math.random() * 6 + 4 : -(Math.random() * 6 + 4),
      speedY: Math.random() * 2 + 1,
      life: 0,
      maxLife: 1000,
      opacity: 1
    };

    this.shootingStars.push(star);
  },

  updateShootingStars(delta) {

    this.shootingStarSpawnTimer += delta;

    if (this.shootingStarSpawnTimer > this.shootingStarSpawnInterval) {

      this.createShootingStar();
      this.shootingStarSpawnTimer = 0;

      this.shootingStarSpawnInterval = 1500 + Math.random() * 3000;
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {

      const star = this.shootingStars[i];

      star.x += star.speedX;
      star.y += star.speedY;

      star.life += delta;
      star.opacity = 1 - (star.life / star.maxLife);

      if (star.life > star.maxLife) {

        // 🌟 CREATE BURST AT END
        this.createStarBurst(star.x, star.y);

        this.shootingStars.splice(i, 1);
      }
    }
  },

  drawShootingStars(ctx) {

    for (let star of this.shootingStars) {

      const gradient = ctx.createLinearGradient(
        star.x,
        star.y,
        star.x - star.speedX * 10,
        star.y - star.speedY * 10
      );

      gradient.addColorStop(0, `rgba(255,255,255,${star.opacity})`);
      gradient.addColorStop(1, `rgba(255,255,255,0)`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 * this.scale;

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

    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;

      this.shootingStarBursts.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 600,
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

      if (p.life > p.maxLife) {
        this.shootingStarBursts.splice(i, 1);
      }
    }
  },

  drawStarBursts(ctx) {

    for (let p of this.shootingStarBursts) {

      const opacity = 1 - (p.life / p.maxLife);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * this.scale, 0, Math.PI * 2);

      ctx.fillStyle = `rgba(255, 255, 200, ${opacity})`;
      ctx.fill();
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
        for (let other of this.mode1Numbers) {
          const dx = x - other.x;
          const dy = y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            overlapping = true;
            break;
          }
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

          starSize: 80 * this.scale,
          starRotation: Math.random() * Math.PI * 2,
          starOpacity: 1
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
  },


  drawMode1Numbers(ctx) {

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let n of this.mode1Numbers) {

      const scale = n.renderScale || 1;
      const rotation = n.renderRotation || 0;

      // Draw star effect
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.starRotation);

      // Draw star shape
      ctx.beginPath();
      const spikes = 5;
      const outerRadius = n.starSize / 2;
      const innerRadius = outerRadius * 0.45;

      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2; // Offset rotation to point up
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

      ctx.shadowColor = "rgba(255, 200, 0, 1)";
      ctx.shadowBlur = 15;

      ctx.strokeStyle = `rgba(255, 230, 0, ${n.starOpacity * 0.9})`;
      ctx.lineWidth = 2 * this.scale;
      ctx.stroke();

      ctx.restore();

      // Draw number
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#8B4513"; // Saddle brown for contrast on gold
      ctx.lineWidth = 5 * this.scale;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8;
      ctx.font = `bold ${50 * this.scale}px Arial`;

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

    const text = `You Are Galaxy ${this.mode1TargetSuffix.toUpperCase()}! Collect Matching Numbers`;
    ctx.font = `bold ${34 * this.scale}px Comic Sans MS`;
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
    ctx.shadowBlur = 20 + Math.sin(time * 0.005) * 10;
    ctx.font = `bold ${80 * this.scale}px Arial`;
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
    ctx.shadowBlur = 15;
    ctx.font = `bold ${45 * this.scale}px Arial`;
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

      this.score += 10;
      this.mode1CorrectCollected++;

      // ⭐ Add 3 seconds life
      this.galaxyLife += 3000;

      if (this.galaxyLife > this.galaxyMaxLife)
        this.galaxyLife = this.galaxyMaxLife;

      this.spawnSparkBurst(this.mascot.x, this.mascot.y);
      this.spawnFloatingText(this.mascot.x, this.mascot.y - 100 * this.scale, "+3 Secs!", "#00FFAA");

      this.mode1Numbers.splice(s.index, 1);

      // Always maintain minimum stars
      this.spawnMode1Numbers();

    } else {

      this.score -= 5;
      this.spawnFloatingText(this.mascot.x, this.mascot.y - 100 * this.scale, "-Oops!", "#FF4444");

      // Remove wrong number and spawn new one (game continues)
      this.mode1Numbers.splice(s.index, 1);
      this.spawnMode1Numbers();

    }

    this.mode1SuctionActive = false;
    this.mode1SuctionData = null;
  },

  drawBlackHole(ctx, delta) {

    if (!this.galaxyCollapsed) return;

    // Countdown freeze delay
    this.blackHoleDelayTimer += delta;

    if (this.blackHoleDelayTimer >= this.blackHoleDelay) {
      this.blackHoleActive = true;
    }

    // Only expand after delay passes
    if (this.blackHoleActive) {
      // 📈 4. Accelerating growth curve
      this.blackHoleRadius += delta * (0.4 + this.blackHoleRadius * 0.002);

      // 🌪️ 6. Suction particles
      for (let i = 0; i < 6; i++) {
        const px = Math.random() * this.cssWidth;
        const py = Math.random() * this.cssHeight;
        this.sparkBursts.push({
          x: px,
          y: py,
          vx: (this.blackHoleX - px) * 0.05,
          vy: (this.blackHoleY - py) * 0.05,
          size: (Math.random() * 3 + 1) * this.scale,
          life: 800,
          type: "particle"
        });
      }
    }

    // 1️⃣ ACCRETION DISK
    const diskRadius = this.blackHoleRadius * 1.4;
    const gradient = ctx.createRadialGradient(
      this.blackHoleX,
      this.blackHoleY,
      this.blackHoleRadius * 0.6,
      this.blackHoleX,
      this.blackHoleY,
      diskRadius
    );

    gradient.addColorStop(0, "rgba(255,200,50,0.8)");
    gradient.addColorStop(0.3, "rgba(255,120,0,0.6)");
    gradient.addColorStop(0.6, "rgba(255,50,0,0.3)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.blackHoleX, this.blackHoleY, diskRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3️⃣ Gravitational Lens
    ctx.save();
    ctx.shadowColor = "white";
    ctx.shadowBlur = 40 * this.scale;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 6 * this.scale;
    ctx.beginPath();
    ctx.arc(
      this.blackHoleX,
      this.blackHoleY,
      this.blackHoleRadius * 1.05,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();

    // The core black circle
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(
      this.blackHoleX,
      this.blackHoleY,
      this.blackHoleRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (this.blackHoleRadius > this.cssWidth * 1.5) {
      if (!this.mode1GameOver) {
        this.gameOverStartTime = performance.now();
      }
      this.mode1GameOver = true;
    }
  },


  drawDreamBackground(ctx) {
    const gradient = ctx.createLinearGradient(
      0, 0,
      0, this.cssHeight
    );

    gradient.addColorStop(0, "rgba(96,165,250,0.6)");
    gradient.addColorStop(0.5, "rgba(167,139,250,0.6)");
    gradient.addColorStop(1, "rgba(244,114,182,0.6)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // soft radial glow center
    const glow = ctx.createRadialGradient(
      this.CENTER_X,
      this.CENTER_Y,
      0,
      this.CENTER_X,
      this.CENTER_Y,
      this.cssWidth * 0.8
    );

    glow.addColorStop(0, "rgba(255,255,255,0.15)");
    glow.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  },

  spawnFloatingText(x, y, text, color) {
    this.floatingTexts.push({
      x: x,
      y: y,
      text: text,
      color: color,
      life: 1000,
      maxLife: 1000,
      vy: -2 * this.scale
    });
  },

  updateFloatingTexts(delta) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      let ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= delta;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
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
      ctx.font = `bold ${40 * this.scale}px Comic Sans MS`;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
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
  }

};
