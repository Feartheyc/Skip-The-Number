const Game1 = {

  centerX: null,
  centerY: null,

  baseOuterRadius: 200,
  innerRadius: 180,

  currentOuterRadius: 200,

  notes: [],
  noteSpeed: 1.2,

  score: 0,

  currentNumber: 1,
  maxNumber: 100,

  spawnTimer: null,

  pulseTime: 0,
  pulseSpeed: 0.08,
  pulseAmount: 12,

  /* ============================== */
  init() {

    const canvas = document.getElementById('game_canvas');

    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;

    this.notes = [];
    this.currentNumber = 1;
    this.score = 0;
    this.pulseTime = 0;
    this.currentOuterRadius = this.baseOuterRadius;

    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
    }

    this.spawnTimer = setInterval(() => {
      this.spawnNote();
    }, 1200);
  },

  /* ============================== */
  spawnNote() {

    const angle = Math.random() * Math.PI * 2;
    const spawnRadius = 350;

    const numberToSpawn = this.currentNumber;

    this.currentNumber++;
    if (this.currentNumber > this.maxNumber) {
      this.currentNumber = 1;
    }

    this.notes.push({
      x: this.centerX + Math.cos(angle) * spawnRadius,
      y: this.centerY + Math.sin(angle) * spawnRadius,
      radius: 25,
      value: numberToSpawn
    });
  },

  /* ============================== */
  update(ctx, fingers) {

    const fingerInRing = this.isFingerInsideRing(fingers);

    this.drawRings(ctx, fingerInRing);
    this.drawNotes(ctx);

    fingers.forEach(finger => {
      this.drawFinger(ctx, finger.x, finger.y);
      this.checkCollision(finger.x, finger.y);
    });

    this.drawScore(ctx);
  },

  /* ============================== */
  isFingerInsideRing(fingers) {

    for (let finger of fingers) {

      const dx = finger.x - this.centerX;
      const dy = finger.y - this.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.innerRadius && dist < this.baseOuterRadius) {
        return true;
      }
    }

    return false;
  },

  /* ============================== */
  drawFinger(ctx, x, y) {
    ctx.fillStyle = "#00FFCC";
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.fill();
  },

  /* ============================== */
  drawRings(ctx, active) {

    let targetRadius = this.baseOuterRadius;

    if (active) {

      this.pulseTime += this.pulseSpeed;

      const pulseOffset = Math.sin(this.pulseTime) * this.pulseAmount;

      // Only expand, never shrink below base
      targetRadius = this.baseOuterRadius + Math.max(0, pulseOffset);

      ctx.strokeStyle = "#00FF66";
      ctx.shadowColor = "#00FF66";
      ctx.shadowBlur = 25;

    } else {

      ctx.strokeStyle = "white";
      ctx.shadowBlur = 0;
    }

    // Smooth transition
    this.currentOuterRadius +=
      (targetRadius - this.currentOuterRadius) * 0.12;

    // Clamp (never below original size)
    if (this.currentOuterRadius < this.baseOuterRadius) {
      this.currentOuterRadius = this.baseOuterRadius;
    }

    // Outer Ring
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(
      this.centerX,
      this.centerY,
      this.currentOuterRadius,
      0,
      2 * Math.PI
    );
    ctx.stroke();

    // Inner Ring (static)
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      this.centerX,
      this.centerY,
      this.innerRadius,
      0,
      2 * Math.PI
    );
    ctx.stroke();

    ctx.shadowBlur = 0;
  },

  /* ============================== */
  drawNotes(ctx) {

    this.notes.forEach((note, index) => {

      const dx = this.centerX - note.x;
      const dy = this.centerY - note.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      note.x += (dx / length) * this.noteSpeed;
      note.y += (dy / length) * this.noteSpeed;

      ctx.fillStyle = "#FF4C4C";
      ctx.beginPath();
      ctx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(note.value, note.x, note.y);

      if (length < 15) {
        this.notes.splice(index, 1);
      }
    });
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

      const inRingZone =
        distFromCenter > this.innerRadius &&
        distFromCenter < this.baseOuterRadius;

      if (distance < note.radius + 20 && inRingZone) {

        this.score++;  // 🔥 increase counter

        this.notes.splice(index, 1);
      }
    });
  },

  /* ============================== */
  drawScore(ctx) {

    ctx.fillStyle = "white";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Captured: " + this.score, 20, 40);
  }

};
