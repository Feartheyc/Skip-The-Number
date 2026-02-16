/* ==============================
   ARM DETECTION (ELBOW → INDEX)
   MediaPipe Pose Version
============================== */

const armVideo = document.getElementById("input_video");

/* ==============================
   GLOBAL ARM STORAGE
============================== */

window.armPositions = []; 
// Format:
// [
//   { elbowX, elbowY, indexX, indexY, side: "Left" },
//   { elbowX, elbowY, indexX, indexY, side: "Right" }
// ]


/* ==============================
   MEDIAPIPE POSE SETUP
============================== */

const pose = new Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});


/* ==============================
   RESULTS CALLBACK
============================== */

pose.onResults(onPoseResults);


function onPoseResults(results) {

  if (!results.poseLandmarks) return;

  const landmarks = results.poseLandmarks;

  const width = canvasElement.width;
  const height = canvasElement.height;

  window.armPositions = [];

  /* ==============================
     LANDMARK IDS
  ============================== */

  const LEFT_ELBOW = 13;
  const RIGHT_ELBOW = 14;

  const LEFT_WRIST = 15;
  const RIGHT_WRIST = 16;


  /* ==============================
     HELPER
  ============================== */

  function getPoint(id) {
    return {
      x: landmarks[id].x * width,
      y: landmarks[id].y * height
    };
  }


  const leftElbow = getPoint(LEFT_ELBOW);
  const rightElbow = getPoint(RIGHT_ELBOW);

  const leftWrist = getPoint(LEFT_WRIST);
  const rightWrist = getPoint(RIGHT_WRIST);


  /* ==============================
     ESTIMATE INDEX FROM WRIST
     (Extend arm direction)
  ============================== */

  function estimateIndex(elbow, wrist) {

    const dx = wrist.x - elbow.x;
    const dy = wrist.y - elbow.y;

    return {
      x: wrist.x + dx * 0.4,
      y: wrist.y + dy * 0.4
    };
  }


  const leftIndex = estimateIndex(leftElbow, leftWrist);
  const rightIndex = estimateIndex(rightElbow, rightWrist);


  /* ==============================
     SAVE DATA
  ============================== */

  window.armPositions.push({
    elbowX: leftElbow.x,
    elbowY: leftElbow.y,
    indexX: leftIndex.x,
    indexY: leftIndex.y,
    side: "Left"
  });

  window.armPositions.push({
    elbowX: rightElbow.x,
    elbowY: rightElbow.y,
    indexX: rightIndex.x,
    indexY: rightIndex.y,
    side: "Right"
  });


  /* ==============================
     OPTIONAL DEBUG DRAW
  ============================== */

  drawArmDebug(leftElbow, leftIndex, "red");
  drawArmDebug(rightElbow, rightIndex, "blue");
}



/* ==============================
   DEBUG VISUAL
============================== */

function drawArmDebug(elbow, index, color) {

  const ctx = canvasCtx;

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(elbow.x, elbow.y);
  ctx.lineTo(index.x, index.y);
  ctx.stroke();

  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(elbow.x, elbow.y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(index.x, index.y, 8, 0, Math.PI * 2);
  ctx.fill();
}



/* ==============================
   CAMERA PIPELINE
============================== */

const poseCamera = new Camera(armVideo, {
  onFrame: async () => {
    await pose.send({ image: armVideo });
  },
  width: 640,
  height: 480
});

poseCamera.start();



/* example usecase
if (window.armPositions.length >= 2) {

  const leftArm = window.armPositions.find(a => a.side === "Left");
  const rightArm = window.armPositions.find(a => a.side === "Right");

  console.log(leftArm.elbowX, leftArm.indexX);
}

*/