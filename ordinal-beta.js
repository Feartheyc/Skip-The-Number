const Game9 = {

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

  currentNumber: 1,
  correctSuffix: "st",

  fingerX: null,
  fingerY: null,

  holdDuration: 1500,
  holdProgress: 0,
  activeDoorIndex: null,
  doorLocked: false,

  /* NEW FEEDBACK STATE */
  feedbackText: "",
  feedbackTimer: 0,
  feedbackColor: "white",
  flashDoorIndex: null,
  flashTimer: 0,

  running: false,
  lastTime: 0,
  
  confettiParticles: [],
shakeDuration: 0,
shakeIntensity: 0,

  sparkBursts: [],

  
  /* ===== MASCOT SYSTEM ===== */
gameState: "pickup", // "pickup" | "deliver"

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

numberPosition: {
  x: 0,
  y: 0,
  picked: false
},

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



/* ===== FLOATING NUMBER SYSTEM ===== */

floatTime: 0,
floatAmplitude: 20,
floatSpeed: 0.002,

numberRotation: 0,
rotationSpeed: 0.0015,

numberScalePulse: 0,
pulseSpeed: 0.003,


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
gameMode: 0, // 0 = default (current), 1 = new mode

mode1Numbers: [],
mode1TargetSuffix: "st",
mode1SpawnTimer: 0,
mode1MaxMatches: 3,
mode1MinMatches: 1,
mode1Collected: false,


/* ===== MODE 1 ROUND STATE ===== */
mode1CorrectTotal: 0,
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


mode1MergeActive: false,
mode1MergeData: null,
init() {

  this.resize();
  window.addEventListener("resize", () => this.resize());

  this.score = 0;
  this.running = true;
  this.lastTime = performance.now();

  this.loadMascotSprites();
  this.loadPortalSprites();
  this.initStarfield();      // NEW

  this.setupDoors();
  this.spawnNumber();

  this.mascot.x = this.CENTER_X;
  this.mascot.y = this.CENTER_Y + 100 * this.scale;

  this.gameState = "pickup";

  window.addEventListener("keydown", (e) => {
  if (e.key === "1") {
    this.activateGameMode1();
  }

  window.addEventListener("click", () => {

  if (this.gameMode === 1 && this.mode1GameOver) {
    this.retryMode1();
  }
});
});
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

  // Reset mascot behavior
  this.mascot.carryingNumber = false;
  this.numberPosition.picked = true; // hide default floating number

  // Choose random target suffix
  const suffixes = ["st", "nd", "rd", "th"];
  this.mode1TargetSuffix = suffixes[Math.floor(Math.random() * 4)];

  // Clear and spawn numbers
  this.spawnMode1Numbers();
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

  spawnNumber() {

  const num = Math.floor(Math.random() * 10) + 1;
  this.currentNumber = num;
  this.correctSuffix = this.getSuffix(num);

  this.numberPosition.x = this.CENTER_X;
  this.numberPosition.y = this.CENTER_Y - 230 * this.scale;
  this.numberPosition.picked = false;

  this.mascot.carryingNumber = false;
  this.gameState = "pickup";
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



  // 🌌 STARFIELD
  this.updateStarLayer(this.starsFar, delta);
  this.updateStarLayer(this.starsMid, delta);
  this.updateStarLayer(this.starsNear, delta);

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
  this.updateMascot(delta);
  this.checkPickup();
  this.checkDoorAlignment(delta);

  this.updateFloatingNumber(delta);
  this.updatePortalAnimation(delta);

  // this.updateConfetti(delta);
  this.updateSparkBursts(delta);


if (this.gameMode === 0) {

  // DEFAULT MODE (UNCHANGED)
  this.drawDoors(ctx);
  this.drawNumber(ctx);
  this.drawMascot(ctx);

} else if (this.gameMode === 1) {

  this.updateMode1Logic();
  
  this.updateMode1Suction(delta);
  this.updateMode1Merge(delta);

  this.drawMode1PortalPlayer(ctx);
  this.drawMode1Numbers(ctx);
  this.drawMode1Merge(ctx);

  this.drawMode1Instruction(ctx);

  this.drawMode1GameOver(ctx);

}


  this.drawScore(ctx);

  this.drawSparkBursts(ctx);
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

  checkDoorAlignment(delta) {

  if (this.gameState !== "deliver") return;

  let alignedIndex = null;

  for (let i = 0; i < this.doors.length; i++) {

    const door = this.doors[i];
    const dx = this.mascot.x - door.x;
    const dy = this.mascot.y - door.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= this.doorRadius) {
      alignedIndex = i;
      break;
    }
  }

  if (alignedIndex !== null) {

    this.confirmSelection(alignedIndex);
  }
},

confirmSelection(index) {

  const door = this.doors[index];

  if (door.suffix === this.correctSuffix) {

    this.score += 10;

    this.mascotState = "happy";
   
    this.spawnSparkBurst(door.x, door.y);

    

  } else {

    this.score -= 5;

    this.mascotState = "confused";
    this.shakeDuration = 400;
    this.shakeIntensity = 12;
  }

  setTimeout(() => {

    this.mascotState = "idle";
    this.spawnNumber();

  }, 1200);
},
 

  get doorRadius() {
    return this.DOOR_RADIUS * this.scale;
  },

drawNumber(ctx) {

  if (this.numberPosition.picked) return;

  const baseX = this.numberPosition.x;
  const baseY = this.numberPosition.y;

  const floatOffset =
    Math.sin(this.floatTime * this.floatSpeed) *
    this.floatAmplitude *
    this.scale;

  const pulse =
    1 + Math.sin(this.numberScalePulse) * 0.15;

  ctx.save();

  ctx.translate(baseX, baseY + floatOffset);
  ctx.scale(pulse, pulse);

  // Sparkle glow
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

    const door = this.doors[i];

    // Rainbow glow
    const pulse = 1 + Math.sin(performance.now() * 0.003 + i) * 0.05;

    const gradient = ctx.createRadialGradient(
      door.x,
      door.y,
      size * 0.2,
      door.x,
      door.y,
      size * 0.6
    );

    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(0.3, "#FDE047");
    gradient.addColorStop(0.6, "#A78BFA");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(door.x, door.y, size * 0.6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Portal sprite (unchanged)
    const portalImg = this.portalFrames[this.portalFrameIndex];
    if (portalImg) {
      ctx.drawImage(
        portalImg,
        door.x - size / 2,
        door.y - size / 2,
        size,
        size
      );
    }

    // Floating label ABOVE
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${42 * this.scale}px Comic Sans MS`;
    ctx.textAlign = "center";

    ctx.fillText(
      `${this.ordinalMap[door.suffix]}`,
      door.x,
      door.y - size / 2 - 20 * this.scale
    );
  }
},


drawScore(ctx) {

  const padding = 20 * this.scale;
  const width = 220 * this.scale;
  const height = 70 * this.scale;
  const x = 20 * this.scale;
  const y = 20 * this.scale;

  // Soft rounded bubble
  ctx.save();

  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 15;

  ctx.fillStyle = "#1E3A8A"; // deep blue
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 25 * this.scale);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Score text
  ctx.fillStyle = "#FFD700"; // gold
  ctx.font = `bold ${32 * this.scale}px Comic Sans MS`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    `⭐ ${this.score}`,
    x + width / 2,
    y + height / 2
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

  // MODE 1 CONFIRMATION MOVE
if (this.gameMode === 1 && this.mode1Confirming) {

  const dx = this.mode1PortalTargetX - this.mascot.x;
  const dy = this.mode1PortalTargetY - this.mascot.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 5) {

    this.mascot.x += dx * 0.05;
    this.mascot.y += dy * 0.05;

  } else {

    // Confirmation reached
    this.mode1Confirming = false;

    // NEW ROUND
    const suffixes = ["st", "nd", "rd", "th"];
    this.mode1TargetSuffix =
      suffixes[Math.floor(Math.random() * 4)];

    this.spawnMode1Numbers();
  }

  return;
}

  if (this.fingerX === null || this.fingerY === null) return;

  const dx = this.fingerX - this.mascot.x;
  const dy = this.fingerY - this.mascot.y;

  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 5) {

    const force = Math.min(distance * this.mascot.speed, this.mascot.maxSpeed);

    this.mascot.vx = (dx / distance) * force;
    this.mascot.vy = (dy / distance) * force;

  } else {
    this.mascot.vx *= 0.9;
    this.mascot.vy *= 0.9;
  }

  this.mascot.x += this.mascot.vx;
  this.mascot.y += this.mascot.vy;

  // Clamp to screen
  this.mascot.x = Math.max(80, Math.min(this.cssWidth - 80, this.mascot.x));
  this.mascot.y = Math.max(80, Math.min(this.cssHeight - 80, this.mascot.y));
},

checkPickup() {

  if (this.gameState !== "pickup") return;

  const dx = this.mascot.x - this.numberPosition.x;
  const dy = this.mascot.y - this.numberPosition.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 80 * this.scale) {

    this.numberPosition.picked = true;
    this.mascot.carryingNumber = true;
    this.gameState = "deliver";
  }
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

updateFloatingNumber(delta) {

  if (this.numberPosition.picked) return;

  this.floatTime += delta;
  this.numberRotation += delta * this.rotationSpeed;
  this.numberScalePulse += delta * this.pulseSpeed;
},


initStarfield() {

  this.starsFar = [];
  this.starsMid = [];
  this.starsNear = [];

  for (let i = 0; i < this.starCountFar; i++) {
    this.starsFar.push(this.createStar(0.2));
  }

  for (let i = 0; i < this.starCountMid; i++) {
    this.starsMid.push(this.createStar(0.5));
  }

  for (let i = 0; i < this.starCountNear; i++) {
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

    if (star.y > this.cssHeight) {
      star.y = 0;
      star.x = Math.random() * this.cssWidth;
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

  this.mode1Numbers = [];

  const correctCount =
    Math.floor(Math.random() *
      (this.mode1MaxMatches - this.mode1MinMatches + 1)
    ) + this.mode1MinMatches;

  this.mode1CorrectTotal = correctCount;
  this.mode1CorrectCollected = 0;
  this.mode1RoundActive = true;
  this.mode1Confirming = false;

  let correctSpawned = 0;

  const shuffledDoors = [...this.doors].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffledDoors.length; i++) {

    const door = shuffledDoors[i];
    let num;

    if (correctSpawned < correctCount) {

      num = this.generateNumberWithSuffix(this.mode1TargetSuffix);
      correctSpawned++;

    } else {

      do {
        num = Math.floor(Math.random() * 30) + 1;
      } while (this.getSuffix(num) === this.mode1TargetSuffix);
    }

    this.mode1Numbers.push({
      number: num,
      x: door.x,
      y: door.y,
      size: 60 * this.scale
    });
  }
},

generateNumberWithSuffix(suffix) {

  while (true) {

    const num = Math.floor(Math.random() * 30) + 1;

    if (this.getSuffix(num) === suffix) {
      return num;
    }
  }
},


drawMode1PortalPlayer(ctx) {

  const portalImg = this.portalFrames[this.portalFrameIndex];
  const size = this.portalSize * this.scale;

  if (!portalImg) return;

  const px = this.mascot.x;
  const py = this.mascot.y;

  // Draw portal sprite
  ctx.drawImage(
    portalImg,
    px - size / 2,
    py - size / 2,
    size,
    size
  );

  // === DRAW GALAXY SUFFIX TEXT INSIDE PORTAL ===

  const suffix = this.mode1TargetSuffix.toUpperCase();

  ctx.save();

  // glowing text
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 20;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${60 * this.scale}px Comic Sans MS`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    suffix,
    px,
    py
  );

  ctx.restore();
},


drawMode1Numbers(ctx) {

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let n of this.mode1Numbers) {

    const scale = n.renderScale || 1;
    const rotation = n.renderRotation || 0;

    ctx.save();

    ctx.translate(n.x, n.y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    ctx.fillStyle = "#00FFAA";
    ctx.font = `bold ${60 * this.scale}px Arial`;

    ctx.fillText(n.number, 0, 0);

    ctx.restore();
  }
},

updateMode1Logic() {

  if (!this.mode1RoundActive || 
      this.mode1GameOver || 
      this.mode1SuctionActive) return;

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

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${40 * this.scale}px Arial`;
  ctx.textAlign = "center";

  ctx.fillText(
    `You Are Galaxy ${this.mode1TargetSuffix.toUpperCase()}! Collect Matching Numbers`,
    this.CENTER_X,
    60 * this.scale
  );
},


startMode1Confirmation() {

  this.mode1RoundActive = false;
  this.mode1Confirming = true;

  // Target bottom-left
  this.mode1PortalTargetX = 120 * this.scale;
  this.mode1PortalTargetY = this.cssHeight - 120 * this.scale;
},

drawMode1GameOver(ctx) {

  if (!this.mode1GameOver) return;

  ctx.fillStyle = "red";
  ctx.font = `bold ${60 * this.scale}px Arial`;
  ctx.textAlign = "center";

  ctx.fillText(
    "Wrong Galaxy! Game Over",
    this.CENTER_X,
    this.CENTER_Y
  );
},


drawMode1GameOver(ctx) {

  if (!this.mode1GameOver) return;

  // Translucent black overlay
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

  // GAME OVER text
  ctx.fillStyle = "#FF4444";
  ctx.font = `bold ${70 * this.scale}px Arial`;
  ctx.textAlign = "center";

  ctx.fillText(
    "Galaxy Collapse!",
    this.CENTER_X,
    this.CENTER_Y - 40 * this.scale
  );

  // Retry button
  ctx.fillStyle = "#00FFAA";
  ctx.font = `bold ${40 * this.scale}px Arial`;

  ctx.fillText(
    "Tap To Retry",
    this.CENTER_X,
    this.CENTER_Y + 40 * this.scale
  );
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

  // Spiral movement
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

  // Check correctness AFTER animation
  if (this.getSuffix(n.number) === this.mode1TargetSuffix) {

    this.score += 10;
    this.mode1CorrectCollected++;
    this.spawnSparkBurst(this.mascot.x, this.mascot.y);

    this.mode1Numbers.splice(s.index, 1);

    if (this.mode1CorrectCollected === this.mode1CorrectTotal) {
      this.startMode1Confirmation();
    }

  } else {

    this.score -= 5;
    this.mode1GameOver = true;
    this.mode1RoundActive = false;
  }

  this.mode1SuctionActive = false;
  this.mode1SuctionData = null;
} ,finishMode1Suction() {

  const s = this.mode1SuctionData;
  const n = this.mode1Numbers[s.index];

  if (!n) {
    this.mode1SuctionActive = false;
    return;
  }

  // Check correctness AFTER animation
  if (this.getSuffix(n.number) === this.mode1TargetSuffix) {

    this.score += 10;

    this.mode1CorrectCollected++;

    this.spawnSparkBurst(this.mascot.x, this.mascot.y);

    // START MERGE ANIMATION
    this.startMode1Merge(n.number);

    this.mode1Numbers.splice(s.index, 1);

    if (this.mode1CorrectCollected === this.mode1CorrectTotal) {
      this.startMode1Confirmation();
    }

  } else {

    this.score -= 5;
    this.mode1GameOver = true;
    this.mode1RoundActive = false;
  }

  this.mode1SuctionActive = false;
  this.mode1SuctionData = null;
},


drawDreamBackground(ctx) {
  const gradient = ctx.createLinearGradient(
    0, 0,
    0, this.cssHeight
  );

  gradient.addColorStop(0, "#60A5FA");  // sky blue
  gradient.addColorStop(0.5, "#A78BFA"); // lavender
  gradient.addColorStop(1, "#F472B6");  // soft pink

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


drawFloatingSparkles(ctx, x, y) {

  const time = performance.now() * 0.002;

  for (let i = 0; i < 6; i++) {

    const angle = (Math.PI * 2 / 6) * i + time;
    const radius = 70 * this.scale;

    const sx = x + Math.cos(angle) * radius;
    const sy = y + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.arc(sx, sy, 6 * this.scale, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFACD";
    ctx.fill();
  }
},

startMode1Merge(number) {

  this.mode1MergeActive = true;

  this.mode1MergeData = {
    number: number,
    suffix: this.mode1TargetSuffix,
    x: this.mascot.x,
    y: this.mascot.y,
    scale: 1,
    rotation: 0,
    time: 0,
    duration: 500
  };
},

updateMode1Merge(delta) {

  if (!this.mode1MergeActive) return;

  const m = this.mode1MergeData;

  m.time += delta;

  const progress = m.time / m.duration;

  m.scale = 1 + progress * 0.8;
  m.rotation += 0.15;

  if (progress >= 1) {

    this.mode1MergeActive = false;
    this.mode1MergeData = null;
  }
},

drawMode1Merge(ctx) {

  if (!this.mode1MergeActive) return;

  const m = this.mode1MergeData;

  const text = `${m.number}${m.suffix}`;

  ctx.save();

  ctx.translate(m.x, m.y);
  ctx.rotate(m.rotation);
  ctx.scale(m.scale, m.scale);

  ctx.shadowColor = "#FFD700";
  ctx.shadowBlur = 30;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${70 * this.scale}px Comic Sans MS`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(text, 0, 0);

  ctx.restore();
}
};          