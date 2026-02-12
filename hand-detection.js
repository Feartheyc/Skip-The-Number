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


    hands.onResults(onResults);

    // 3. Camera Setup
    const camera = new Camera(videoElement, {
      onFrame: async () => { await hands.send({image: videoElement}); },
      width: 640, height: 480
    });
    camera.start();

    // Placeholder for Note Logic
    function drawNotes() {
      // Logic for moving notes toward the center would go here
    }

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