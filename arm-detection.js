/* =========================================
   ARM DETECTION USING MEDIAPIPE POSE
   Uses SAME camera as hand detection
========================================= */

window.armData = {
  left: null,
  right: null
};

let pose = null;
let armDetectionRunning = false;


/* =========================================
   INIT ARM DETECTION
========================================= */
window.initArmDetection = function () {

  if (armDetectionRunning) return;

  pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(onPoseResults);

  armDetectionRunning = true;

  console.log("✅ Arm detection ready (waiting for frames)");
};


/* =========================================
   SEND FRAME FROM MAIN CAMERA LOOP
========================================= */
window.sendFrameToPose = async function (video) {

  if (!pose || !armDetectionRunning) return;

  await pose.send({ image: video });
};


/* =========================================
   PROCESS RESULTS
========================================= */
/* =========================================
   PROCESS RESULTS
========================================= */
function onPoseResults(results) {

  if (!results.poseLandmarks) {
    // Optional: Clear global data if no one is in frame
    window.currentPoseLandmarks = null;
    return;
  }

  // ⭐ THE CRITICAL ADDITION ⭐
  // This line allows Game10 to see the raw data (Nose, Shoulders, etc.)
  window.currentPoseLandmarks = results.poseLandmarks;

  const lm = results.poseLandmarks;

  // Keep your existing width/height logic for other games that use window.armData
  const width = 640; 
  const height = 480;

  function convert(p) {
    return {
      x: p.x * width,
      y: p.y * height
    };
  }

  window.armData.left = {
    shoulder: convert(lm[11]),
    elbow: convert(lm[13]),
    wrist: convert(lm[15]),
    index: convert(lm[19])
  };

  window.armData.right = {
    shoulder: convert(lm[12]),
    elbow: convert(lm[14]),
    wrist: convert(lm[16]),
    index: convert(lm[20])
  };
}