const Game1 = {

  centerX: null,
  centerY: null,

  baseOuterRadius: 200,
  innerRadius: 170,
  currentOuterRadius: 200,

  notes: [],
  noteSpeed: 1.8,

  score: 0,

  combo: 0,
  multiplier: 1,

  lastHitType: "",
  hitTextTimer: 0,

  currentNumber: 1,
  maxNumber: 100,

  spawnTimer: null,

  pulseTime: 0,
  pulseSpeed: 0.08,
  pulseAmount: 12,

  skipAmount: 3,
  gameTitle: "SKIP 3",

  /* ============================== */
  init() {

    const canvas = document.getElementById('game_canvas');

    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;

    this.notes = [];
    this.currentNumber = 1;

    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;

    this.hitTextTimer = 0;
    this.currentOuterRadius = this.baseOuterRadius;

    this.gameTitle = "SKIP " + this.skipAmount;

    if (this.spawnTimer) clearInterval(this.spawnTimer);

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
    if (this.currentNumber > this.maxNumber)
      this.currentNumber = 1;

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
    this.drawTitle(ctx);
    this.drawNotes(ctx);

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

  // collect only multiples of skipAmount
  return number % this.skipAmount === 0;

},

  /* ============================== */
  isFingerInsideRing(fingers) {

    for (let finger of fingers) {

      const dx = finger.x - this.centerX;
      const dy = finger.y - this.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.innerRadius && dist < this.baseOuterRadius)
        return true;
    }

    return false;
  },

  /* ============================== */
  drawTitle(ctx) {
    ctx.fillStyle = "#00FF66";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(this.gameTitle, this.centerX, 50);
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
      const pulseOffset =
        Math.sin(this.pulseTime) * this.pulseAmount;

      targetRadius =
        this.baseOuterRadius + Math.max(0, pulseOffset);

      ctx.strokeStyle = "#00FF66";
      ctx.shadowColor = "#00FF66";
      ctx.shadowBlur = 25;

    } else {
      ctx.strokeStyle = "white";
      ctx.shadowBlur = 0;
    }

    this.currentOuterRadius +=
      (targetRadius - this.currentOuterRadius) * 0.12;

    if (this.currentOuterRadius < this.baseOuterRadius)
      this.currentOuterRadius = this.baseOuterRadius;

    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY,
      this.currentOuterRadius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY,
      this.innerRadius, 0, 2 * Math.PI);
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

      const shouldCollect = this.shouldCollect(note.value);

      ctx.fillStyle = shouldCollect ? "#4CAF50" : "#FF4C4C";

      ctx.beginPath();
      ctx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(note.value, note.x, note.y);

      // Missed correct note = combo break
      if (length < 15) {

        if (shouldCollect) {
          this.combo = 0;
          this.multiplier = 1;
        }

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

      const touchesRing =
        (distFromCenter + note.radius) > this.innerRadius &&
        (distFromCenter - note.radius) < this.baseOuterRadius;

      if (distance < note.radius + 20 && touchesRing) {

        const shouldCollect = this.shouldCollect(note.value);

        if (shouldCollect) {

          this.combo++;
          if (this.combo % 5 === 0)
            this.multiplier++;

          this.score += 10 * this.multiplier;
          this.lastHitType = "CORRECT";

        } else {

          // Wrong hit
          this.combo = 0;
          this.multiplier = 1;
          this.score -= 5;
          this.lastHitType = "WRONG";
        }

        this.hitTextTimer = 30;
        this.notes.splice(index, 1);
      }
    });
  },

  /* ============================== */
  drawScore(ctx) {
    ctx.fillStyle = "white";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Score: " + this.score, 20, 40);
  },

  /* ============================== */
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

      this.hitTextTimer--;
    }
  }

};


