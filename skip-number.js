const Game1 = {
  centerX: null,
  centerY: null,

  baseOuterRadius: 1000,
  baseInnerRadius: 970,

  currentOuterRadius: 1000,
  currentInnerRadius: 970,

  ringScale: 1.5,

  notes: [],
  noteSpeed: 0,

  popEffects: [],
  explosions: [],

  score: 0,
  combo: 0,
  multiplier: 1,

  lastHitType: "",
  hitTextTimer: 0,

  currentNumber: 1,
  maxNumber: 100,

  spawnTimer: null,

  pulseTime: 0,
  pulseSpeed: 3,
  pulseAmountOuter: 12,
  pulseAmountInner: 6,

  mode: "default",
  skipAmount: 3,
  gameTitle: "SKIP 3",

  pattern: {
    skip: 3,
    collect: 1
  },

  cannonAngle: 0,
  cannonTargetAngle: 0,
  cannonLength: 0,
  pendingShot: null,
  lastCannonNote: null,


  orbImage: null,
  orbAngle: 0,
  orbTargetAngle: 0,
  lastOrbNote: null,


  charge: 0,
  chargeSpeed: 0.8,
  isCharging: false,
  chargeParticles: [],

  launcherSafeRadius: 0,

  /* ============================== */
  init() {
    const rect = document
      .getElementById("container")
      .getBoundingClientRect();

    this.onResize(rect.width, rect.height);

    this.notes = [];
    this.popEffects = [];

    this.currentNumber = 1;
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.hitTextTimer = 1;

    this.mode = "default";
    this.skipAmount = 3;
    this.gameTitle = "SKIP 3";

    this.noteSpeed = this.baseOuterRadius * 0.6;

    // Load orb sprite
    this.orbImage = new Image();
    this.orbImage.src = "orb1.png"; 

    if (this.spawnTimer) clearInterval(this.spawnTimer);

    this.spawnTimer = setInterval(() => {

  if (this.mode === "cannon") {
    this.spawnCannonNote();
  }
  else if (this.mode === "orb") {
    this.spawnOrbNote();
  }
  else {
    this.spawnNote();
  }

}, 1200);

    window.addEventListener("keydown", (e) => {
      if (e.key === "1") this.activatePatternMode();
      if (e.key === "2") this.activateCannonMode();
      if (e.key === "3") this.activateOrbMode();
    });

    
  },

  /* ============================== */
  onResize(width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;

    const base = Math.min(width, height);

    this.baseOuterRadius = base * 0.25 * this.ringScale;
    this.baseInnerRadius = this.baseOuterRadius * 0.8;

    this.currentOuterRadius = this.baseOuterRadius;
    this.currentInnerRadius = this.baseInnerRadius;

    this.noteSpeed = this.baseOuterRadius * 0.6;
    this.launcherSafeRadius = this.baseOuterRadius * 0.45;
  },

  /* ============================== */
  activatePatternMode() {
    this.mode = "pattern";

    this.pattern.skip = Math.floor(Math.random() * 5) + 1;
    this.pattern.collect = Math.floor(Math.random() * 5) + 1;

    this.gameTitle =
      "SKIP " +
      this.pattern.skip +
      " COLLECT " +
      this.pattern.collect;
  },

  /* ============================== */
  spawnNote() {
    const angle = Math.random() * Math.PI * 2;

    const minRadius = this.currentOuterRadius + 150;
    const maxRadius = this.currentOuterRadius + 200;

    const spawnRadius =
      Math.random() * (maxRadius - minRadius) + minRadius;

    const numberToSpawn = this.currentNumber;

    this.currentNumber++;
    if (this.currentNumber > this.maxNumber) this.currentNumber = 1;

    this.notes.push({
      x: this.centerX + Math.cos(angle) * spawnRadius,
      y: this.centerY + Math.sin(angle) * spawnRadius,
      radius: this.baseOuterRadius * 0.12,
      value: numberToSpawn
    });
  },

  /* ============================== */
  update(ctx, fingers, dt = 1 / 60) {
    if (this.mode !== "cannon" && this.mode !== "orb") {
      this.drawRings(ctx, dt);
    }

    this.drawTitle(ctx);

    if (this.mode === "cannon") {
      this.updateCannonNotes(ctx, dt);
      this.drawCannon(ctx, dt);
      this.drawExplosions(ctx);
      this.drawLauncherZone(ctx);
      this.drawCharging(ctx);
    } else if (this.mode === "orb") {
        this.updateCannonNotes(ctx, dt);   // reuse movement
        this.drawOrbLauncher(ctx, dt);
        this.drawExplosions(ctx);
        this.drawLauncherZone(ctx);
        this.drawCharging(ctx);
      } 
    else {
      this.drawNotes(ctx, dt);
    }

    if (this.mode === "cannon" || this.mode === "orb") {
      this.drawCharging(ctx);
     this.updateCharging(dt);
    }
    this.drawPopEffects(ctx);

    fingers.forEach((finger) => {
      this.drawFinger(ctx, finger.x, finger.y);

      if (this.mode === "cannon") {
        this.checkCannonCollision(finger.x, finger.y);
      } else {
        this.checkCollision(finger.x, finger.y);
      }
    });

    this.drawScore(ctx);
    this.drawCombo(ctx);
    this.drawHitText(ctx);
  },

  /* ============================== */
  shouldCollect(number) {
    if (this.mode === "default") {
      return number % this.skipAmount === 0;
    }

    if (this.mode === "pattern") {
      const cycleLength =
        this.pattern.skip + this.pattern.collect;

      const position =
        (number - 1) % cycleLength;

      return position >= this.pattern.skip;
    }

    return false;
  },

  /* ============================== */
  drawTitle(ctx) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      this.gameTitle,
      this.centerX,
      50
    );
  },

  /* ============================== */
  drawFinger(ctx, x, y) {
    ctx.fillStyle = "#FF2A2A";

    ctx.beginPath();

    ctx.shadowColor = "#fc3434";
    ctx.shadowBlur = 35;
    ctx.fillStyle = "#992020";
    ctx.fill();

    ctx.shadowBlur = 15;
    ctx.fillStyle = "#f13232";
    ctx.fill();

    ctx.arc(
      x,
      y,
      this.baseOuterRadius * 0.08,
      0,
      2 * Math.PI
    );

    ctx.fill();
  },

  /* ============================== */
  drawRings(ctx, dt) {
    this.pulseTime += this.pulseSpeed * dt;

    const outerOffset =
      Math.sin(this.pulseTime) *
      this.pulseAmountOuter;

    const innerOffset =
      Math.sin(this.pulseTime) *
      this.pulseAmountInner;

    this.currentOuterRadius =
      this.baseOuterRadius +
      Math.max(0, outerOffset);

    this.currentInnerRadius =
      this.baseInnerRadius +
      Math.max(0, innerOffset);

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    ctx.beginPath();
    ctx.arc(
      0,
      0,
      this.currentOuterRadius,
      0,
      Math.PI * 2
    );

    ctx.shadowColor = "#b84cff";
    ctx.shadowBlur = 60;
    ctx.strokeStyle = "#7a1cff";
    ctx.lineWidth = 12;
    ctx.stroke();

    ctx.shadowBlur = 25;
    ctx.strokeStyle = "#a94dff";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      0,
      0,
      this.currentInnerRadius,
      0,
      Math.PI * 2
    );

    ctx.shadowColor = "#d580ff";
    ctx.shadowBlur = 45;
    ctx.strokeStyle = "#c44dff";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.shadowBlur = 20;
    ctx.strokeStyle = "#e066ff";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.restore();
  },

  /* ============================== */
  drawNotes(ctx, dt) {
    this.notes.forEach((note, index) => {
      const dx = this.centerX - note.x;
      const dy = this.centerY - note.y;

      const length = Math.sqrt(dx * dx + dy * dy);

      const speed = this.noteSpeed * dt;

      note.x += (dx / length) * speed;
      note.y += (dy / length) * speed;

      ctx.save();

      ctx.beginPath();
      ctx.arc(
        note.x,
        note.y,
        note.radius,
        0,
        2 * Math.PI
      );

      ctx.shadowColor = "#7FDBFF";
      ctx.shadowBlur = 35;
      ctx.fillStyle = "#1f4fff";
      ctx.fill();

      ctx.shadowBlur = 15;
      ctx.fillStyle = "#7FDBFF";
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        note.value,
        note.x,
        note.y
      );

      ctx.restore();

      if (length < 15) {
        this.notes.splice(index, 1);
      }
    });
  },

  /* ============================== */
  drawPopEffects(ctx) {
    for (let i = this.popEffects.length - 1; i >= 0; i--) {
      const p = this.popEffects[i];

      p.life += 0.025;

      const ease =
        1 - Math.pow(1 - p.life, 2);

      const scale =
        1 + ease * 0.5;

      const alpha =
        1 - ease;

      ctx.save();

      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.scale(scale, scale);

      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (p.life >= 1)
        this.popEffects.splice(i, 1);
    }
  },

  /* ============================== */
  checkCollision(fingerX, fingerY) {
    this.notes.forEach((note, index) => {
      const dx = fingerX - note.x;
      const dy = fingerY - note.y;

      const distance =
        Math.sqrt(dx * dx + dy * dy);

      const distFromCenter =
        Math.sqrt(
          (note.x - this.centerX) ** 2 +
          (note.y - this.centerY) ** 2
        );

      const touchesRing =
        distFromCenter + note.radius >
          this.currentInnerRadius &&
        distFromCenter - note.radius <
          this.currentOuterRadius;

      if (
        distance < note.radius + 20 &&
        touchesRing
      ) {
        const shouldCollect =
          this.shouldCollect(note.value);

        if (shouldCollect) {
          this.combo++;

          if (this.combo % 5 === 0)
            this.multiplier++;

          this.score +=
            10 * this.multiplier;

          this.lastHitType = "CORRECT";

          this.popEffects.push({
            x: note.x,
            y: note.y,
            life: 0,
            color: "#00FFAA"
          });
        } else {
          this.combo = 0;
          this.multiplier = 1;
          this.score -= 5;

          this.lastHitType = "WRONG";

          this.popEffects.push({
            x: note.x,
            y: note.y,
            life: 0,
            color: "#FF0055"
          });
        }

        this.hitTextTimer = 30;
        this.notes.splice(index, 1);
      }
    });
  },

  /* ============================== */
  drawScore(ctx) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "left";

    ctx.fillText(
      "Score: " + this.score,
      20,
      40
    );
  },

  /* ============================== */
  drawCombo(ctx) {
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 22px Arial";

    ctx.fillText(
      "Combo: " +
        this.combo +
        " x" +
        this.multiplier,
      20,
      70
    );
  },

  /* ============================== */
  drawHitText(ctx) {
    if (this.hitTextTimer > 0) {
      const totalTime = 40;

      const progress =
        this.hitTextTimer /
        totalTime;

      const alpha =
        Math.sin(progress * Math.PI);

      ctx.save();

      ctx.globalAlpha = alpha;

      let color = "#FFFFFF";

      if (this.lastHitType === "CORRECT")
        color = "#00FF66";
      else if (this.lastHitType === "WRONG")
        color = "#FF3333";
      else if (
        this.lastHitType.includes("SKIPPED")
      )
        color = "#FFAA00";

      ctx.fillStyle = color;
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";

      ctx.fillText(
        this.lastHitType,
        this.centerX,
        this.centerY - 120
      );

      ctx.restore();

      this.hitTextTimer--;
    }
  },

  /* ============================== */
  spawnCannonNote() {

  // Prevent multiple pending shots
  if (this.pendingShot) return;

  const angle = Math.random() * Math.PI * 2;
  const speed = this.baseOuterRadius * 0.9;

  const numberToSpawn = this.currentNumber;
  this.currentNumber++;

  if (this.currentNumber > this.maxNumber)
    this.currentNumber = 1;

  // Store shot info (do NOT spawn yet)
  this.pendingShot = {
    angle,
    speed,
    value: numberToSpawn
  };

  // Cannon should face this direction
  this.cannonTargetAngle = angle + Math.PI / 2;

  this.startCharging();
},

  /* ============================== */
updateCannonNotes(ctx, dt) {

  for (let i = this.notes.length - 1; i >= 0; i--) {

    const note = this.notes[i];

    // ===== MOVE NOTE =====
    note.x += note.vx * dt;
    note.y += note.vy * dt;

    // ===== UPDATE SAFE ZONE PROTECTION =====
    this.updateLauncherProtection(note);

    // ===== DRAW =====
    this.drawSingleNote(ctx, note);

    // ===== OFF SCREEN CHECK =====
    const margin = 120;

    const offScreen =
      note.x < -margin ||
      note.x > this.centerX * 2 + margin ||
      note.y < -margin ||
      note.y > this.centerY * 2 + margin;

    if (offScreen) {

      const shouldHaveCollected =
        this.shouldCollectCannon(note.value);

      // Only punish if correct number was missed
      if (shouldHaveCollected) {

        this.score -= 10;

        this.combo = 0;
        this.multiplier = 1;

        this.lastHitType =
          "YOU SKIPPED NUMBER " + note.value;

        this.hitTextTimer = 40;

        this.createExplosion(
          note.x,
          note.y,
          "#FFA500"
        );
      }

      this.notes.splice(i, 1);
    }
  }
},

  /* ============================== */
  drawCannon(ctx, dt = 1 / 60) {

  const size = this.baseOuterRadius * 0.35;
  this.cannonLength = size * 1.4;

  // Smooth rotation toward target
  let diff = this.cannonTargetAngle - this.cannonAngle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  const rotateSpeed = 0.18;
  this.cannonAngle += diff * rotateSpeed;

  // If aligned enough → fire
  if (this.pendingShot && Math.abs(diff) < 0.05) {
    this.fireCannon();
  }

  ctx.save();
  ctx.translate(this.centerX, this.centerY);
  ctx.rotate(this.cannonAngle);

  // Base
  ctx.fillStyle = "#444";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Barrel
  ctx.fillStyle = "#999";
  ctx.fillRect(
    -size * 0.15,
    -this.cannonLength,
    size * 0.3,
    this.cannonLength
  );

  ctx.restore();
},

  /* ============================== */
  drawSingleNote(ctx, note) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(
      note.x,
      note.y,
      note.radius,
      0,
      2 * Math.PI
    );

    ctx.shadowColor = "#7FDBFF";
    ctx.shadowBlur = 35;
    ctx.fillStyle = "#1f4fff";
    ctx.fill();

    ctx.shadowBlur = 15;
    ctx.fillStyle = "#7FDBFF";
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      note.value,
      note.x,
      note.y
    );

    ctx.restore();
  },

  /* ============================== */
  checkCannonCollision(fingerX, fingerY) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if(note.spawnProtected) continue;
      const dx = fingerX - note.x;
      const dy = fingerY - note.y;

      const distance =
        Math.sqrt(dx * dx + dy * dy);

      if (distance < note.radius + 20) {
        const correct =
          this.shouldCollectCannon(note.value);

        if (correct) {
          this.score += 10;
          this.lastHitType = "CORRECT";

          this.createExplosion(
            note.x,
            note.y,
            "#00FFAA"
          );
        } else {
          this.score -= 5;
          this.lastHitType = "WRONG";

          this.createExplosion(
            note.x,
            note.y,
            "#FF3355"
          );
        }

        this.hitTextTimer = 30;
        this.notes.splice(i, 1);
      }
    }
  },

  /* ============================== */
  shouldCollectCannon(number) {
    return number % this.skipAmount === 0;
  },

  /* ============================== */
  activateCannonMode() {

  this.mode = "cannon";

  this.notes = [];
  this.explosions = [];

  this.combo = 0;
  this.multiplier = 1;

  this.cannonAngle = 0;
  this.cannonTargetAngle = 0;

  this.pendingShot = null;
  this.lastCannonNote = null;

  this.gameTitle = "CANNON SKIP " + this.skipAmount;
},

  /* ============================== */
  createExplosion(x, y, color) {
    const count = 12;

    for (let i = 0; i < count; i++) {
      const angle =
        Math.random() * Math.PI * 2;

      const speed =
        Math.random() * 200 + 100;

      this.explosions.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        color
      });
    }
  },

  /* ============================== */
  drawExplosions(ctx) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const p = this.explosions[i];

      p.life += 0.03;
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;

      const alpha =
        1 - p.life;

      ctx.save();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        this.baseOuterRadius * 0.04,
        0,
        Math.PI * 2
      );

      ctx.fill();
      ctx.restore();

      if (p.life >= 1)
        this.explosions.splice(i, 1);
    }
  },

fireCannon() {

  if (!this.pendingShot) return;

  const shot = this.pendingShot;

  const speed = shot.speed;
  const angle = shot.angle;

  const note = {
    x: this.centerX,
    y: this.centerY,
    radius: this.baseOuterRadius * 0.12,
    value: shot.value,          // ✅ FIXED
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spawnProtected: true
  };

  this.notes.push(note);
  this.lastCannonNote = note;

  this.pendingShot = null;
  this.isCharging = false;
  this.charge = 0;
  this.chargeParticles = [];
},






activateOrbMode() {

  this.mode = "orb";

  this.notes = [];
  this.explosions = [];

  this.combo = 0;
  this.multiplier = 1;

  this.orbAngle = 0;
  this.orbTargetAngle = 0;

  this.gameTitle = "ORB SKIP " + this.skipAmount;
},

spawnOrbNote() {

  const angle = Math.random() * Math.PI * 2;
  const speed = this.baseOuterRadius * 0.9;

  // Set orb facing direction FIRST
  this.orbTargetAngle = angle + Math.PI / 2;

  const numberToSpawn = this.currentNumber;
  this.currentNumber++;

  if (this.currentNumber > this.maxNumber)
    this.currentNumber = 1;

  // Delay spawn slightly so rotation happens first
  setTimeout(() => {

    const note = {
      x: this.centerX,
      y: this.centerY,
      radius: this.baseOuterRadius * 0.12,
      value: numberToSpawn,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spawnProtected: true
    };

    this.notes.push(note);
    this.lastOrbNote = note;

  }, 120); // rotation delay
},

drawOrbLauncher(ctx, dt = 1 / 60) {


  ctx.canvas.style.zIndex = "0";
  const targetSize = this.baseOuterRadius * 0.6;

  let diff = this.orbTargetAngle - this.orbAngle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  this.orbAngle += diff * 0.18;

  ctx.save();

  ctx.translate(this.centerX, this.centerY);
  ctx.rotate(this.orbAngle);
  

  if (this.orbImage && this.orbImage.complete) {

    const img = this.orbImage;

    // Maintain aspect ratio
    const scale = targetSize / Math.max(img.width, img.height);

    const drawW = img.width * scale;
    const drawH = img.height * scale;

    // 🔥 FLIP IMAGE
    ctx.scale(1, -1);

    ctx.drawImage(
      img,
      -drawW / 2,
      -drawH / 2,
      drawW,
      drawH
    );

  } else {

    ctx.fillStyle = "#66ccff";
    ctx.beginPath();
    ctx.arc(0, 0, targetSize / 2, 0, Math.PI * 2);
    ctx.fill();

  }

  ctx.restore();
},


updateLauncherProtection(note) {

  const dx = note.x - this.centerX;
  const dy = note.y - this.centerY;

  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > this.launcherSafeRadius) {
    note.spawnProtected = false;
  }
},

drawLauncherZone(ctx) {

  ctx.save();

  ctx.strokeStyle = "rgba(255,0,0,0.3)";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(
    this.centerX,
    this.centerY,
    this.launcherSafeRadius,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.restore();
},


startCharging() {

  this.charge = 0;
  this.isCharging = true;
  this.chargeParticles = [];
},

updateCharging(dt) {

  if (!this.isCharging) return;

  // Increase charge
  this.charge += this.chargeSpeed * dt;
  if (this.charge > 1) this.charge = 1;

  // Spawn particles
  if (Math.random() < 0.4) {

    const angle = Math.random() * Math.PI * 2;
    const radius = this.launcherSafeRadius;

    const startX = this.centerX + Math.cos(angle) * radius;
    const startY = this.centerY + Math.sin(angle) * radius;

    this.chargeParticles.push({
      x: startX,
      y: startY,
      life: 1
    });
  }

  // Move particles inward
  for (let i = this.chargeParticles.length - 1; i >= 0; i--) {

    const p = this.chargeParticles[i];

    const dx = this.centerX - p.x;
    const dy = this.centerY - p.y;

    p.x += dx * 0.08;
    p.y += dy * 0.08;

    p.life -= dt * 1.2;

    if (p.life <= 0) {
      this.chargeParticles.splice(i, 1);
    }
  }
},


drawCharging(ctx) {

  if (!this.isCharging) return;

  // ===== PARTICLES =====
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of this.chargeParticles) {

    ctx.globalAlpha = p.life;

    ctx.fillStyle = "#00FFFF";

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6 * this.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();


  // ===== CENTER GLOW =====
  const glowRadius =
    this.baseOuterRadius * 0.18 * (0.5 + this.charge * 0.8);

  const gradient = ctx.createRadialGradient(
    this.centerX,
    this.centerY,
    0,
    this.centerX,
    this.centerY,
    glowRadius
  );

  gradient.addColorStop(0, "rgba(0,255,255,0.9)");
  gradient.addColorStop(1, "rgba(0,255,255,0)");

  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.arc(
    this.centerX,
    this.centerY,
    glowRadius,
    0,
    Math.PI * 2
  );
  ctx.fill();
},
};