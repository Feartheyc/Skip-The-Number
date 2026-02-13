const videoElement = document.getElementById('input_video');

window.fingerPositions = [];

const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
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

function onResults(results) {

  window.fingerPositions = [];

  if (results.multiHandLandmarks) {
    results.multiHandLandmarks.forEach((landmarks) => {
      const x = landmarks[8].x * 640;
      const y = landmarks[8].y * 480;

      window.fingerPositions.push({ x, y });
    });
  }
}
