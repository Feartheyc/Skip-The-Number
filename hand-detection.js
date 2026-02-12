// ===============================
// DOM ELEMENTS
// ===============================

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

const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// ===============================
// CAMERA SETUP
// ===============================

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: GAME_WIDTH,
  height: GAME_HEIGHT
});

camera.start();

// ===============================
// MAIN HAND CALLBACK
// ===============================

function onResults(results) {
  canvasCtx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (
    results.multiHandLandmarks &&
    results.multiHandLandmarks.length > 0
  ) {
    const landmarks = results.multiHandLandmarks[0];

    // Landmark 8 = Index fingertip
    fingerX = landmarks[8].x * GAME_WIDTH;
    fingerY = landmarks[8].y * GAME_HEIGHT;

    drawFingerPointer(fingerX, fingerY);

    // Debug: highlight focus wheel when finger inside
    if (isFingerInsideFocusWheel()) {
      focusWheelElement.style.borderColor = "lime";
    } else {
      focusWheelElement.style.borderColor = "white";
    }
  }
}
