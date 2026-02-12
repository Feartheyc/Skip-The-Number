const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('game_canvas');
const canvasCtx = canvasElement.getContext('2d');

/* ==============================
   CENTER + RADIUS SETTINGS
============================== */
const centerX = canvasElement.width / 2;
const centerY = canvasElement.height / 2;

const outerRadius = 200;
const innerRadius = 180;

let anyFingerBetweenRings = false;

/* ==============================
   NOTES SYSTEM
============================== */
let notes = [];
let spawnInterval = 1200;
let noteSpeed = 2.5;

/* ==============================
   MEDIAPIPE HANDS SETUP
============================== */
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2, // ✅ Detect TWO hands
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

camera.start();

/* ==============================
   HAND TRACKING
============================== */
function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  anyFingerBetweenRings = false;

  if (results.multiHandLandmarks &&
      results.multiHandLandmarks.length > 0) {

    results.multiHandLandmarks.forEach((landmarks, index) => {

      const fingerX = landmarks[8].x * canvasElement.width;
      const fingerY = landmarks[8].y * canvasElement.height;

      const dx = fingerX - centerX;
      const dy = fingerY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // ✅ Show finger anywhere inside outer circle
      if (distance < outerRadius) {

        // Different colors for each hand
        canvasCtx.fillStyle = (index === 0) ? "#00FFCC" : "#FF0077";

        canvasCtx.beginPath();
        canvasCtx.arc(fingerX, fingerY, 15, 0, 2 * Math.PI);
        canvasCtx.fill();

        // ✅ Check if between rings
        if (distance > innerRadius) {
          anyFingerBetweenRings = true;
          checkCollision(fingerX, fingerY);
        }
      }

    });
  }

  drawCenterRings();
  drawNotes();
}

/* ==============================
   DRAW CENTER RINGS
============================== */
function drawCenterRings() {

  if (anyFingerBetweenRings) {
    canvasCtx.strokeStyle = "#00FFCC";
    canvasCtx.shadowColor = "#00FFCC";
    canvasCtx.shadowBlur = 25;
  } else {
    canvasCtx.strokeStyle = "white";
    canvasCtx.shadowBlur = 0;
  }

  // Outer Ring
  canvasCtx.lineWidth = 6;
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
  canvasCtx.stroke();

  // Inner Ring
  canvasCtx.lineWidth = 4;
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
  canvasCtx.stroke();

  canvasCtx.shadowBlur = 0;
}

/* ==============================
   NOTE SPAWNING
============================== */
function spawnNote() {
  const angle = Math.random() * Math.PI * 2;
  const spawnRadius = 350;

  notes.push({
    x: centerX + Math.cos(angle) * spawnRadius,
    y: centerY + Math.sin(angle) * spawnRadius,
    radius: 25,
    value: Math.floor(Math.random() * 9) + 1
  });
}

setInterval(spawnNote, spawnInterval);

/* ==============================
   DRAW + MOVE NOTES
============================== */
function drawNotes() {

  notes.forEach((note, index) => {

    const dx = centerX - note.x;
    const dy = centerY - note.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    note.x += (dx / length) * noteSpeed;
    note.y += (dy / length) * noteSpeed;

    // Draw note circle
    canvasCtx.fillStyle = "#FF4C4C";
    canvasCtx.beginPath();
    canvasCtx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
    canvasCtx.fill();

    // Draw number (fix mirrored text)
    canvasCtx.save();
    canvasCtx.translate(note.x, note.y);
    canvasCtx.scale(-1, 1);

    canvasCtx.fillStyle = "white";
    canvasCtx.font = "bold 22px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.textBaseline = "middle";
    canvasCtx.fillText(note.value, 0, 0);

    canvasCtx.restore();

    // Remove if reaches center
    if (length < 15) {
      notes.splice(index, 1);
    }
  });
}

/* ==============================
   COLLISION SYSTEM
============================== */
function checkCollision(fingerX, fingerY) {

  notes.forEach((note, index) => {

    const dx = fingerX - note.x;
    const dy = fingerY - note.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const noteDistFromCenter = Math.sqrt(
      (note.x - centerX) ** 2 +
      (note.y - centerY) ** 2
    );

    const noteInRingZone =
      noteDistFromCenter > innerRadius &&
      noteDistFromCenter < outerRadius;

    if (distance < note.radius + 20 && noteInRingZone) {
      console.log("PERFECT HIT:", note.value);
      notes.splice(index, 1);
    }
  });
}
