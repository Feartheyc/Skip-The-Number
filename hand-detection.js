const videoElement = document.getElementById('input_video');

window.fingerPositions = [];

/* ==============================
   CAMERA CONTROL FLAGS
============================== */

window.disableCameraProcessing = false;
window.handCamera = null;


/* ==============================
   MEDIAPIPE HANDS
============================== */

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


/* ==============================
   CAMERA START
============================== */

window.handCamera = new Camera(videoElement, {
  onFrame: async () => {

    // If camera disabled → skip processing
    if (window.disableCameraProcessing) return;

    await hands.send({ image: videoElement });

    // Send frame to pose if needed
    if (window.sendFrameToPose) {
      await window.sendFrameToPose(videoElement);
    }

  },
  width: 640,
  height: 480
});

window.handCamera.start();


/* ==============================
   CAMERA STOP FUNCTION
============================== */

window.stopCamera = function () {

  console.log("Stopping camera...");

  window.disableCameraProcessing = true;

  const video = document.getElementById("input_video");

  if (video && video.srcObject) {

    const tracks = video.srcObject.getTracks();

    tracks.forEach(track => track.stop());

    video.srcObject = null;
  }
};


/* ==============================
   OPTIONAL CAMERA RESTART
============================== */

window.startCamera = function () {

  window.disableCameraProcessing = false;

  location.reload(); // simple restart
};


/* ==============================
   HAND RESULTS
============================== */

function onResults(results) {

  window.fingerPositions = [];

  // Reset finger states every frame
  window.fingerStates = {
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    little: false
  };

  const canvas = document.getElementById("game_canvas");
  const video = document.getElementById("input_video");

  const rect = canvas.getBoundingClientRect();

  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 480;

  const canvasRatio = rect.width / rect.height;
  const videoRatio = videoWidth / videoHeight;

  let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

  if (canvasRatio > videoRatio) {
    // canvas wider → crop top/bottom
    drawWidth = rect.width;
    drawHeight = rect.width / videoRatio;
    offsetY = (drawHeight - rect.height) / 2;
  } else {
    // canvas taller → crop left/right
    drawHeight = rect.height;
    drawWidth = rect.height * videoRatio;
    offsetX = (drawWidth - rect.width) / 2;
  }

  if (results.multiHandLandmarks && results.multiHandedness) {

    for (let i = 0; i < results.multiHandLandmarks.length; i++) {

      const landmarks = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness[i].label;

      /* ==============================
         THUMB DETECTION (SIDEWAYS)
      ============================== */

      let thumbExtended;

      if (handedness === "Right") {
        thumbExtended = landmarks[4].x < landmarks[3].x;
      } else {
        thumbExtended = landmarks[4].x > landmarks[3].x;
      }

      /* ==============================
         OTHER FINGERS (VERTICAL)
      ============================== */

      const indexExtended = landmarks[8].y < landmarks[6].y;
      const middleExtended = landmarks[12].y < landmarks[10].y;
      const ringExtended = landmarks[16].y < landmarks[14].y;
      const littleExtended = landmarks[20].y < landmarks[18].y;

      /* ==============================
         UPDATE GLOBAL STATES
      ============================== */

      window.fingerStates.thumb = thumbExtended;
      window.fingerStates.index = indexExtended;
      window.fingerStates.middle = middleExtended;
      window.fingerStates.ring = ringExtended;
      window.fingerStates.little = littleExtended;

      /* ==============================
         INDEX FINGER CURSOR
      ============================== */

      if (indexExtended) {

        let x = (1 - landmarks[8].x) * drawWidth - offsetX;
        let y = landmarks[8].y * drawHeight - offsetY;

        window.fingerPositions.push({
          x: x,
          y: y,
          hand: handedness
        });
      }
    }
  }
}