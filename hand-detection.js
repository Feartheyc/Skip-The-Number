const videoElement = document.getElementById('input_video');
    const canvasElement = document.getElementById('game_canvas');
    const canvasCtx = canvasElement.getContext('2d');
    // Center Position
const centerX = canvasElement.width / 2;
const centerY = canvasElement.height / 2;

// Notes Array
let notes = [];

// Spawn Settings
let spawnInterval = 1200; // milliseconds
let noteSpeed = 2.5;


    // 1. Initialize MediaPipe Hands
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    // 2. Game Variables
    let fingerX = 0, fingerY = 0;

    function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  drawCenterRings();  // 👈 Draw rings first

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];

    fingerX = landmarks[8].x * canvasElement.width;
    fingerY = landmarks[8].y * canvasElement.height;

    canvasCtx.fillStyle = "#00FFCC";
    canvasCtx.beginPath();
    canvasCtx.arc(fingerX, fingerY, 15, 0, 2 * Math.PI);
    canvasCtx.fill();

    checkCollision(fingerX, fingerY);
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

    // Placeholder for Note Logic
    function drawNotes() {
  notes.forEach((note, index) => {

    // Direction vector toward center
    const dx = centerX - note.x;
    const dy = centerY - note.y;

    const length = Math.sqrt(dx * dx + dy * dy);

    const dirX = dx / length;
    const dirY = dy / length;

    // Move toward center
    note.x += dirX * noteSpeed;
    note.y += dirY * noteSpeed;

    // Draw circle
    canvasCtx.fillStyle = "#FF4C4C";
    canvasCtx.beginPath();
    canvasCtx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
    canvasCtx.fill();

    // Draw number
    canvasCtx.fillStyle = "white";
    canvasCtx.font = "20px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.textBaseline = "middle";
    canvasCtx.fillText(note.value, note.x, note.y);

    // Remove if passes center
    if (length < 10) {
      notes.splice(index, 1);
    }
  });
}

    function checkCollision(fingerX, fingerY) {
  notes.forEach((note, index) => {
    const dx = fingerX - note.x;
    const dy = fingerY - note.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only allow hit inside inner ring (180 radius)
    const distToCenter = Math.sqrt(
      (note.x - centerX) ** 2 +
      (note.y - centerY) ** 2
    );

    if (distance < note.radius + 15 && distToCenter < 180) {
      console.log("HIT:", note.value);
      notes.splice(index, 1);
    }
  });
}


    function drawCenterRings() {
  const centerX = canvasElement.width / 2;
  const centerY = canvasElement.height / 2;

  // OUTER RING
  canvasCtx.strokeStyle = "white";
  canvasCtx.lineWidth = 6;  // Thickness of ring
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, 200, 0, 2 * Math.PI); // 80 = outer radius
  canvasCtx.stroke();

  // INNER RING
  canvasCtx.lineWidth = 4;
  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, 180, 0, 2 * Math.PI); // 40 = inner radius
  canvasCtx.stroke();
}

    function spawnNote() {
  // Random angle around circle
  const angle = Math.random() * Math.PI * 2;

  // Spawn radius (outside outer ring)
  const spawnRadius = 300;

  const x = centerX + Math.cos(angle) * spawnRadius;
  const y = centerY + Math.sin(angle) * spawnRadius;

  notes.push({
    x: x,
    y: y,
    radius: 25,
    value: Math.floor(Math.random() * 9) + 1
  });
}
setInterval(spawnNote, spawnInterval);
