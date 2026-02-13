const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('game_canvas');
const canvasCtx = canvasElement.getContext('2d');
const scoreDisplay = document.getElementById('score-counter'); // ✅ UI Reference

/* ==============================
    CENTER + RADIUS SETTINGS
============================== */
const centerX = canvasElement.width / 2;
const centerY = canvasElement.height / 2;
const outerRadius = 210; 
const innerRadius = 170; 

let anyFingerBetweenRings = false;

/* ==============================
    GAME SYSTEMS
============================== */
let notes = [];
let particles = [];
let nextNoteValue = 1;
let noteSpeed = 3.5; 
let collectedCount = 0; // ✅ New Counter Variable

const bpm = 120;
const beatInterval = 60000 / bpm; 
const beatMap = [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0];
let currentBeat = 0;

/* ==============================
    MEDIAPIPE SETUP
============================== */
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => { await hands.send({ image: videoElement }); },
  width: 640, height: 480
});
camera.start();

/* ==============================
    CORE LOOP
============================== */
function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  anyFingerBetweenRings = false;

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    results.multiHandLandmarks.forEach((landmarks, index) => {
      const fingerX = landmarks[8].x * canvasElement.width;
      const fingerY = landmarks[8].y * canvasElement.height;

      const dx = fingerX - centerX;
      const dy = fingerY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < outerRadius + 60) {
        canvasCtx.fillStyle = (index === 0) ? "#00FFCC" : "#FF0077";
        canvasCtx.beginPath();
        canvasCtx.arc(fingerX, fingerY, 15, 0, 2 * Math.PI);
        canvasCtx.fill();

        if (distance > innerRadius && distance < outerRadius) {
          anyFingerBetweenRings = true;
          checkCollision(fingerX, fingerY);
        }
      }
    });
  }

  drawCenterRings();
  drawNotes();
  updateParticles(); 
}

/* ==============================
    PARTICLE SYSTEM
============================== */
function createBurst(x, y, color) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0,
      color: color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.05;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    canvasCtx.globalAlpha = p.life;
    canvasCtx.fillStyle = p.color;
    canvasCtx.beginPath();
    canvasCtx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
    canvasCtx.fill();
  }
  canvasCtx.globalAlpha = 1.0;
}

/* ==============================
    COLLISION SYSTEM
============================== */
function checkCollision(fX, fY) {
  notes.forEach((note, index) => {
    const dx = fX - note.x;
    const dy = fY - note.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < note.radius + 45) {
      createBurst(note.x, note.y, "#FF4C4C");
      
      // ✅ Update Counter Logic
      collectedCount++;
      if (scoreDisplay) scoreDisplay.innerText = collectedCount;
      
      notes.splice(index, 1);
    }
  });
}

/* ==============================
    VISUALS & SPAWNING
============================== */
function drawCenterRings() {
  const pulse = Math.sin(Date.now() / 100) * 5;
  canvasCtx.strokeStyle = anyFingerBetweenRings ? "#00FFCC" : "rgba(255, 255, 255, 0.8)";
  canvasCtx.shadowBlur = anyFingerBetweenRings ? 30 : 0;
  canvasCtx.shadowColor = "#00FFCC";

  canvasCtx.lineWidth = 6;
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, outerRadius + (anyFingerBetweenRings ? pulse : 0), 0, 2 * Math.PI);
  canvasCtx.stroke();

  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
  canvasCtx.stroke();
  canvasCtx.shadowBlur = 0;
}

function spawnNote() {
  const shouldSpawn = beatMap[currentBeat];
  if (shouldSpawn === 1) {
    const angle = currentBeat * (Math.PI / 4); 
    notes.push({
      x: centerX + Math.cos(angle) * 400,
      y: centerY + Math.sin(angle) * 400,
      radius: 28,
      value: nextNoteValue
    });
    nextNoteValue++;
  }
  currentBeat = (currentBeat + 1) % beatMap.length;
}

setInterval(spawnNote, beatInterval);

function drawNotes() {
  notes.forEach((note, index) => {
    const dx = centerX - note.x;
    const dy = centerY - note.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    note.x += (dx / length) * noteSpeed;
    note.y += (dy / length) * noteSpeed;

    canvasCtx.fillStyle = "#FF4C4C";
    canvasCtx.beginPath();
    canvasCtx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
    canvasCtx.fill();

    canvasCtx.save();
    canvasCtx.translate(note.x, note.y);
    canvasCtx.scale(-1, 1);
    canvasCtx.fillStyle = "white";
    canvasCtx.font = "bold 24px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.textBaseline = "middle";
    canvasCtx.fillText(note.value, 0, 0);
    canvasCtx.restore();

    // Auto-remove if missed
    if (length < innerRadius - 30) {
      notes.splice(index, 1);
    }
  });
}