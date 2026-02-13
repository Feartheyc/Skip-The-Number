const Game1 = {

  centerX: 320,
  centerY: 240,
  outerRadius: 200,
  innerRadius: 180,
  notes: [],
  noteSpeed: 2.5,

  init() {
    this.notes = [];

    setInterval(() => {
      this.spawnNote();
    }, 1200);
  },

  spawnNote() {
    const angle = Math.random() * Math.PI * 2;
    const spawnRadius = 350;

    this.notes.push({
      x: this.centerX + Math.cos(angle) * spawnRadius,
      y: this.centerY + Math.sin(angle) * spawnRadius,
      radius: 25,
      value: Math.floor(Math.random() * 9) + 1
    });
  },

  update(ctx, fingers) {

    this.drawRings(ctx);
    this.drawNotes(ctx);

    fingers.forEach(finger => {
      this.drawFinger(ctx, finger.x, finger.y);
      this.checkCollision(finger.x, finger.y);
    });
  },

  drawFinger(ctx, x, y) {
    ctx.fillStyle = "#00FFCC";
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.fill();
  },

  drawRings(ctx) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.outerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.innerRadius, 0, 2 * Math.PI);
    ctx.stroke();
  },

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
      ctx.font = "bold 22px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(note.value, note.x, note.y);

      if (length < 15) {
        this.notes.splice(index, 1);
      }
    });
  },

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
        distFromCenter < this.outerRadius;

      if (distance < note.radius + 20 && inRingZone) {
        console.log("HIT:", note.value);
        this.notes.splice(index, 1);
      }
    });
  }
};
