const videoElement = document.getElementById('input_video');

window.fingerPositions = [];

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

function onResults(results) {
  window.fingerPositions = [];

  if (results.multiHandLandmarks && results.multiHandedness) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness[i].label; // "Left" or "Right"

      const x = (1 - landmarks[8].x) * 640; // mirror flip
      const y = landmarks[8].y * 480;

      window.fingerPositions.push({
        x,
        y,
        hand: handedness // 👈 VERY IMPORTANT
      });
    }
  }
}

