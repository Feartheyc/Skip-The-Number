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

    if (this.spawnTimer) clearInterval(this.spawnTimer);

    this.spawnTimer = setInterval(() => {
      this.spawnNote();
    }, 1200);

    window.addEventListener("keydown", (e) => {
      if (e.key === "1") this.activatePatternMode();
    });
  },

  /* ============================== */
  onResize(width, height) {

    this.centerX = width / 2;
    this.centerY = height / 2;

    const base = Math.min(width, height);

    this.baseOuterRadius = base * 0.25 * this.ringScale;
    this.baseInnerRadius = this.baseOuterRadius * 0.80;

    this.currentOuterRadius = this.baseOuterRadius;
    this.currentInnerRadius = this.baseInnerRadius;

    this.noteSpeed = this.baseOuterRadius * 0.6;
  },

  /* ============================== */
  activatePatternMode() {

    this.mode = "pattern";

    this.pattern.skip = Math.floor(Math.random() * 5) + 1;
    this.pattern.collect = Math.floor(Math.random() * 5) + 1;

    this.gameTitle =
      "SKIP " + this.pattern.skip +
      " COLLECT " + this.pattern.collect;
  },

  /* ============================== */
spawnNote() {
    const angle = Math.random() * Math.PI * 2;

    // Spawn radius outside the outer ring
    const minRadius = this.currentOuterRadius + 150;
    const maxRadius = this.currentOuterRadius + 200; // can adjust distance
    const spawnRadius = Math.random() * (maxRadius - minRadius) + minRadius;

    const numberToSpawn = this.currentNumber;
    this.currentNumber++;
    if (this.currentNumber > this.maxNumber)
      this.currentNumber = 1;

    this.notes.push({
      x: this.centerX + Math.cos(angle) * spawnRadius,
      y: this.centerY + Math.sin(angle) * spawnRadius,
      radius: this.baseOuterRadius * 0.12,
      value: numberToSpawn
    });
},



  /* ============================== */
  update(ctx, fingers, dt = 1 / 60) {

    this.drawRings(ctx, dt);
    this.drawTitle(ctx);
    this.drawNotes(ctx, dt);
    this.drawPopEffects(ctx);

    fingers.forEach(finger => {
      this.drawFinger(ctx, finger.x, finger.y);
      this.checkCollision(finger.x, finger.y);
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
    ctx.fillText(this.gameTitle, this.centerX, 50);
  },

  drawFinger(ctx, x, y) {
    ctx.fillStyle = "#FF2A2A";
    ctx.beginPath();

    ctx.shadowColor = "#fc3434";
    ctx.shadowBlur = 35;
    ctx.fillStyle = "#992020";
    ctx.fill();

    // Core glow
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#f13232";
    ctx.fill();
    
    ctx.arc(x, y, this.baseOuterRadius * 0.08, 0, 2 * Math.PI);
    ctx.fill();
  },

  /* 💜 PURPLE NEON PULSING RINGS */
  drawRings(ctx, dt) {

    this.pulseTime += this.pulseSpeed * dt;

    const outerOffset =
      Math.sin(this.pulseTime) * this.pulseAmountOuter;

    const innerOffset =
      Math.sin(this.pulseTime) * this.pulseAmountInner;

    this.currentOuterRadius =
      this.baseOuterRadius + Math.max(0, outerOffset);

    this.currentInnerRadius =
      this.baseInnerRadius + Math.max(0, innerOffset);

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    /* ===== OUTER RING GLOW ===== */
    ctx.beginPath();
    ctx.arc(0, 0, this.currentOuterRadius, 0, Math.PI * 2);

    ctx.shadowColor = "#b84cff";
    ctx.shadowBlur = 60;
    ctx.strokeStyle = "#7a1cff";
    ctx.lineWidth = 12;
    ctx.stroke();

    ctx.shadowBlur = 25;
    ctx.strokeStyle = "#a94dff";
    ctx.lineWidth = 8;
    ctx.stroke();

   

    /* ===== INNER RING GLOW ===== */
    ctx.beginPath();
    ctx.arc(0, 0, this.currentInnerRadius, 0, Math.PI * 2);

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

    const speed = this.noteSpeed * dt ;

    note.x += (dx / length) * speed;
    note.y += (dy / length) * speed;

    ctx.save();

    /* ===== NEON GLOW LAYERS ===== */
    ctx.beginPath();
    ctx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);

    // Outer glow
    ctx.shadowColor = "#7FDBFF";
    ctx.shadowBlur = 35;
    ctx.fillStyle = "#1f4fff";
    ctx.fill();

    // Core glow
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#7FDBFF";
    ctx.fill();
    
    /* ===== NUMBER TEXT ===== */
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(note.value, note.x, note.y);

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

      const ease = 1 - Math.pow(1 - p.life, 2);
      const scale = 1 + ease * 0.5;
      const alpha = 1 - ease;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.scale(scale, scale);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (p.life >= 1) this.popEffects.splice(i, 1);
    }
  },

  /* ============================== */
  checkCollision(fingerX, fingerY) {

    this.notes.forEach((note, index) => {

      const dx = fingerX - note.x;
      const dy = fingerY - note.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const distFromCenter = Math.sqrt(
        (note.x - this.centerX) ** 2 +
        (note.y - this.centerY) ** 2
      );

      const touchesRing =
        (distFromCenter + note.radius) > this.currentInnerRadius &&
        (distFromCenter - note.radius) < this.currentOuterRadius;

      if (distance < note.radius + 20 && touchesRing) {

        const shouldCollect =
          this.shouldCollect(note.value);

        if (shouldCollect) {

          this.combo++;

          if (this.combo % 5 === 0)
            this.multiplier++;

          this.score += 10 * this.multiplier;
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
    ctx.fillText("Score: " + this.score, 20, 40);
  },

  drawCombo(ctx) {
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 22px Arial";
    ctx.fillText(
      "Combo: " + this.combo +
      "  x" + this.multiplier,
      20, 70
    );
  },

  /* ============================== */
 drawHitText(ctx) {

  if (this.hitTextTimer > 0) {

    const totalTime = 30; // duration of text
    const progress = this.hitTextTimer / totalTime;

    // Smooth fade in and fade out using sine curve
    const alpha = Math.sin(progress * Math.PI);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle =
      this.lastHitType === "CORRECT"
        ? "#00FF66"
        : "#FF3333";

    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
      this.lastHitType,
      this.centerX,
      this.centerY - 120
    );

    ctx.restore();

    this.hitTextTimer--;
  }
}


};
