const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('game_canvas');
const canvasCtx = canvasElement.getContext('2d');

// Center Position
const centerX = canvasElement.width / 2;
const centerY = canvasElement.height / 2;

// Game State
let notes = [];
let spawnInterval = 1200; 
let noteSpeed = 2.5;

// 1. Initialize MediaPipe Hands
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// DETECT BOTH HANDS
hands.setOptions({ 
  maxNumHands: 2, 
  modelComplexity: 1, 
  minDetectionConfidence: 0.5, 
  minTrackingConfidence: 0.5 
});

function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  drawCenterRings();

  // 2. LOOP THROUGH BOTH HANDS
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    results.multiHandLandmarks.forEach((landmarks, index) => {
      
      // Landmark 8 = Index Finger Tip
      const fingerX = landmarks[8].x * canvasElement.width;
      const fingerY = landmarks[8].y * canvasElement.height;

      // Color coding: Cyan for hand 1, Pink for hand 2
      canvasCtx.fillStyle = (index === 0) ? "#00FFCC" : "#FF0077";
      canvasCtx.beginPath();
      canvasCtx.arc(fingerX, fingerY, 15, 0, 2 * Math.PI);
      canvasCtx.fill();

      // Check collision for each finger individually
      checkCollision(fingerX, fingerY);
    });
  }

  drawNotes();
}

hands.onResults(onResults);

// 3. Camera Setup
const camera = new Camera(videoElement, {
  onFrame: async () => { await hands.send({image: videoElement}); },
  width: 640, height: 480
});
camera.start();

// --- GAME FUNCTIONS ---

function drawNotes() {
  notes.forEach((note, index) => {
    const dx = centerX - note.x;
    const dy = centerY - note.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    note.x += (dx / length) * noteSpeed;
    note.y += (dy / length) * noteSpeed;

    // A. Draw the Note Circle
    canvasCtx.fillStyle = "#FF4C4C";
    canvasCtx.beginPath();
    canvasCtx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
    canvasCtx.fill();

    // B. Draw the Number (UN-MIRRORING LOGIC)
    canvasCtx.save(); 
    canvasCtx.translate(note.x, note.y);
    canvasCtx.scale(-1, 1); // Reverse the CSS mirroring
    
    canvasCtx.fillStyle = "white";
    canvasCtx.font = "bold 22px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.textBaseline = "middle";
    canvasCtx.fillText(note.value, 0, 0); 
    
    canvasCtx.restore(); 

    // Remove if it reaches the center
    if (length < 15) {
      notes.splice(index, 1);
    }
  });
}

function checkCollision(fX, fY) {
  notes.forEach((note, index) => {
    const dx = fX - note.x;
    const dy = fY - note.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Scoring logic
    if (distance < note.radius + 20) {
      console.log("HIT:", note.value);
      notes.splice(index, 1);
    }
  });
}

function drawCenterRings() {
  canvasCtx.strokeStyle = "white";
  canvasCtx.lineWidth = 4;
  
  // Scoring zone
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, 200, 0, 2 * Math.PI);
  canvasCtx.stroke();
}

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