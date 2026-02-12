 const videoElement = document.getElementById('input_video');
    const canvasElement = document.getElementById('game_canvas');
    const canvasCtx = canvasElement.getContext('2d');

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


const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('game_canvas');
const canvasCtx = canvasElement.getContext('2d');
const focusWheelElement = document.getElementById("focus-wheel");

// ===============================
// GAME VARIABLES
// ===============================

let fingerX = 0;
let fingerY = 0;

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;

// ===============================
// FOCUS WHEEL DATA
// ===============================

function getFocusWheelData() {
  const rect = focusWheelElement.getBoundingClientRect();
  const containerRect = canvasElement.getBoundingClientRect();

  return {
    x: rect.left - containerRect.left + rect.width / 2,
    y: rect.top - containerRect.top + rect.height / 2,
    radius: rect.width / 2
  };
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

function distance(x1, y1, x2, y2) {
  return Math.sqrt(
    (x1 - x2) * (x1 - x2) +
    (y1 - y2) * (y1 - y2)
  );
}

function isFingerInsideFocusWheel() {
  const focusWheel = getFocusWheelData();

  return distance(
    fingerX,
    fingerY,
    focusWheel.x,
    focusWheel.y
  ) < focusWheel.radius;
}

// ===============================
// DRAW FUNCTIONS
// ===============================

function drawFingerPointer(x, y) {
  canvasCtx.fillStyle = "#00FFCC";
  canvasCtx.beginPath();
  canvasCtx.arc(x, y, 15, 0, 2 * Math.PI);
  canvasCtx.fill();
}

// ===============================
// MEDIAPIPE SETUP
// ===============================

    function checkCollision(x, y) {
      // If x,y is inside a note's hit box, trigger "Perfect!"
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
