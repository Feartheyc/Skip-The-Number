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
  maxSpeed: 12,
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
  "st": "1st",
  "nd": "2nd",
  "rd": "3rd",
  "th": "4th"
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

  setupDoors() {

  this.doors = [];

  const suffixes = ["st", "nd", "rd", "th"];

  const startX = this.cssWidth * 0.2;
  const gap = this.cssWidth * 0.2;
  const y = this.cssHeight * 0.5;

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
  this.numberPosition.y = this.CENTER_Y - 150 * this.scale;
  this.numberPosition.picked = false;

  this.mascot.carryingNumber = false;
  this.gameState = "pickup";
},

  getSuffix(num) {
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

  ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

  // 🌌 NEBULA BACKGROUND
  // this.drawNebula(ctx);

  // 🌌 STARFIELD
  this.updateStarLayer(this.starsFar, delta);
  this.updateStarLayer(this.starsMid, delta);
  this.updateStarLayer(this.starsNear, delta);

  this.drawStarLayer(ctx, this.starsFar);
  this.drawStarLayer(ctx, this.starsMid);
  this.drawStarLayer(ctx, this.starsNear);

  // // 🌫 COSMIC DUST
  // this.updateCosmicDust(delta);
  // this.drawCosmicDust(ctx);

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

  // 🎮 FOREGROUND
  this.drawDoors(ctx);
  this.drawNumber(ctx);
  this.drawMascot(ctx);
  this.drawScore(ctx);
  // this.drawConfetti(ctx);
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
    // this.spawnConfetti(door.x, door.y);
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
  // updateFeedback(delta) {

  //   if (this.feedbackTimer > 0) {
  //     this.feedbackTimer -= delta;
  //     if (this.feedbackTimer < 0) this.feedbackTimer = 0;
  //   }

  //   if (this.flashTimer > 0) {
  //     this.flashTimer -= delta;
  //     if (this.flashTimer < 0) this.flashTimer = 0;
  //   }
  // },

  get doorRadius() {
    return this.DOOR_RADIUS * this.scale;
  },

  drawNumber(ctx) {

  if (this.numberPosition.picked) return;

  const baseX = this.numberPosition.x;
  const baseY = this.numberPosition.y;

  const floatOffset = Math.sin(this.floatTime * this.floatSpeed) * this.floatAmplitude * this.scale;

  const scalePulse = 1 + Math.sin(this.numberScalePulse) * 0.1;

  ctx.save();

  ctx.translate(baseX, baseY + floatOffset);
  ctx.rotate(Math.sin(this.numberRotation) * 0.2);
  ctx.scale(scalePulse, scalePulse);

  // Glow effect
  ctx.shadowColor = "#00FFFF";
  ctx.shadowBlur = 30;

  ctx.fillStyle = "#00FFAA";
  ctx.font = `bold ${80 * this.scale}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(this.currentNumber, 0, 0);

  ctx.restore();
},

    drawDoors(ctx) {

  const portalImg = this.portalFrames[this.portalFrameIndex];
  const size = this.portalSize * this.scale;

  for (let i = 0; i < this.doors.length; i++) {

    const door = this.doors[i];

    // ===== DRAW PORTAL SPRITE =====
    if (portalImg) {
      ctx.drawImage(
        portalImg,
        door.x - size / 2,
        door.y - size / 2,
        size,
        size
      );
    }

    // ===== DRAW ORDINAL LABEL BELOW =====
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${36 * this.scale}px Arial`;
    ctx.textAlign = "center";

    ctx.fillText(
      door.label, // precomputed ordinal
      door.x,
      door.y + size / 2 + 40 * this.scale
    );
  }
},


  drawScore(ctx) {

    ctx.fillStyle = "white";
    ctx.font = `bold ${28 * this.scale}px Arial`;
    ctx.textAlign = "center";

    ctx.fillText(
      "Score: " + this.score,
      this.CENTER_X,
      50 * this.scale
    );
  },

  // drawFeedback(ctx) {

  //   if (this.feedbackTimer <= 0) return;

  //   const alpha =
  //     this.feedbackTimer / 1000;

  //   ctx.globalAlpha = alpha;
  //   ctx.fillStyle = this.feedbackColor;
  //   ctx.font = `bold ${60 * this.scale}px Arial`;
  //   ctx.textAlign = "center";

  //   ctx.fillText(
  //     this.feedbackText,
  //     this.CENTER_X,
  //     this.CENTER_Y
  //   );

  //   ctx.globalAlpha = 1;
  // },

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

//   spawnConfetti(x, y) {

//   for (let i = 0; i < 40; i++) {

//     this.confettiParticles.push({
//       x: x,
//       y: y,
//       vx: (Math.random() - 0.5) * 8,
//       vy: (Math.random() - 1.5) * 8,
//       size: (Math.random() * 6 + 4) * this.scale,
//       life: 800,
//       color: `hsl(${Math.random() * 360}, 100%, 50%)`
//     });
//   }
// },


// updateConfetti(delta) {

//   for (let i = this.confettiParticles.length - 1; i >= 0; i--) {

//     const p = this.confettiParticles[i];

//     p.life -= delta;
//     p.x += p.vx;
//     p.y += p.vy;
//     p.vy += 0.25; // gravity

//     if (p.life <= 0) {
//       this.confettiParticles.splice(i, 1);
//     }
//   }
// },



// drawConfetti(ctx) {

//   for (let p of this.confettiParticles) {

//     ctx.globalAlpha = p.life / 800;
//     ctx.fillStyle = p.color;

//     ctx.fillRect(
//       p.x,
//       p.y,
//       p.size,
//       p.size
//     );
//   }

//   ctx.globalAlpha = 1;
// },

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

  this.mascotFrameTimer += 16;

  if (this.mascotFrameTimer > this.mascotFrameSpeed) {
    this.mascotFrame++;
    this.mascotFrameTimer = 0;
  }

  if (this.mascotFrame >= spriteArray.length) {
    this.mascotFrame = 0;
  }

  const img = spriteArray[this.mascotFrame];

  ctx.drawImage(
    img,
    this.mascot.x - (this.mascot.size * this.scale) / 2,
    this.mascot.y - (this.mascot.size * this.scale) / 2,
    this.mascot.size * this.scale,
    this.mascot.size * this.scale
  );

  // Draw carried number
  if (this.mascot.carryingNumber) {

    ctx.fillStyle = "#00FFAA";
    ctx.font = `bold ${40 * this.scale}px Arial`;
    ctx.textAlign = "center";

    ctx.fillText(
      this.currentNumber,
      this.mascot.x,
      this.mascot.y - 60 * this.scale
    );
  }
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


// initCosmicDust() {

//   this.cosmicDust = [];

//   for (let i = 0; i < this.dustCount; i++) {

//     this.cosmicDust.push({
//       x: Math.random() * this.cssWidth,
//       y: Math.random() * this.cssHeight,
//       size: Math.random() * 2 + 0.5,
//       alpha: Math.random(),
//       driftSpeed: Math.random() * 0.3 + 0.1,
//       offset: Math.random() * Math.PI * 2
//     });
//   }
// },


// updateCosmicDust(delta) {

//   this.dustGlobalTime += delta;

//   for (let dust of this.cosmicDust) {

//     dust.x += Math.cos(this.dustDriftAngle * this.dustGlobalTime + dust.offset) * dust.driftSpeed;
//     dust.y += 0.1 * dust.driftSpeed;

//     dust.alpha = 0.5 + Math.sin(this.dustGlobalTime * 0.001 + dust.offset) * 0.5;

//     if (dust.y > this.cssHeight) {
//       dust.y = 0;
//       dust.x = Math.random() * this.cssWidth;
//     }

//     if (dust.x > this.cssWidth) dust.x = 0;
//     if (dust.x < 0) dust.x = this.cssWidth;
//   }
// },


// drawCosmicDust(ctx) {

//   for (let dust of this.cosmicDust) {

//     ctx.beginPath();
//     ctx.arc(dust.x, dust.y, dust.size * this.scale, 0, Math.PI * 2);

//     ctx.fillStyle = `rgba(180, 220, 255, ${dust.alpha})`;
//     ctx.fill();
//   }
// },

// drawNebula(ctx) {

//   this.nebulaTime += this.nebulaSpeed * this.lastTime;

//   const centerX = this.cssWidth / 2;
//   const centerY = this.cssHeight / 2;

//   const radius = Math.max(this.cssWidth, this.cssHeight);

//   const gradient = ctx.createRadialGradient(
//     centerX,
//     centerY,
//     radius * 0.1,
//     centerX,
//     centerY,
//     radius
//   );

//   const hueShift = Math.sin(performance.now() * 0.0001) * 20;

//   gradient.addColorStop(0, `hsla(${260 + hueShift}, 80%, 30%, 0.8)`);
//   gradient.addColorStop(0.5, `hsla(${280 + hueShift}, 70%, 20%, 0.5)`);
//   gradient.addColorStop(1, `hsla(${240 + hueShift}, 60%, 10%, 1)`);

//   ctx.fillStyle = gradient;
//   ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
// },


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
};