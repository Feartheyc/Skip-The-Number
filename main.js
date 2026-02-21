window.currentGame = null;

const canvasElement = document.getElementById('game_canvas');
const canvasCtx = canvasElement.getContext('2d');

let lastTime = performance.now();
window.currentGame = null;
window.isPaused = false;   // ⭐ PAUSE FLAG



/* ==============================
   PAUSE SYSTEM
============================== */

window.pauseGame = function () {
  window.isPaused = true;
  document.getElementById("pauseOverlay").style.display = "flex";
};

window.resumeGame = function () {
  window.isPaused = false;
  document.getElementById("pauseOverlay").style.display = "none";
};

window.goToMainMenu = function () {

  window.isPaused = false;

  document.getElementById("pauseOverlay").style.display = "none";
  document.getElementById("menu").style.display = "flex";
  document.getElementById("input_video").style.opacity = "0";

  window.currentGame = null;
};

/* ==============================
   CANVAS RESIZE SYSTEM
============================== */

function resizeCanvas() {

  const container = document.getElementById("container");
  const rect = container.getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;

  canvasElement.width = rect.width * dpr;
  canvasElement.height = rect.height * dpr;

  canvasElement.style.width = rect.width + "px";
  canvasElement.style.height = rect.height + "px";

  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (window.currentGame?.onResize) {
    window.currentGame.onResize(rect.width, rect.height);
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);

resizeCanvas();

/* ==============================
   START GAME
============================== */

window.startGame = function (gameName) {

  document.getElementById("menu").style.display = "none";
  document.getElementById("input_video").style.opacity = "1";

  if (gameName === "game1") {
    window.currentGame = Game1;
    Game1.init();
  }

  if (gameName === "game2") {
    window.currentGame = Game2;
    Game2.init();
  }

  if (gameName === "Game3") {
    window.currentGame = Game3;
    Game3.init();
  }

  if (gameName === "Game4") {
    window.currentGame = Game4;
    Game4.init();
  }

  if (gameName === "Game5") {
    window.currentGame = Game5;
    Game5.init();
  }

  if (gameName === "Game6") {
    window.currentGame = Game6;
    Game6.init();
  }

  resizeCanvas();
};

/* ==============================
   MAIN LOOP (delta-time based)
============================== */

function gameLoop(currentTime) {

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  const video = document.getElementById("input_video");

  if (window.sendFrameToPose && video && video.readyState >= 2 && !window.isPaused) {
    window.sendFrameToPose(video);
  }

  if (window.currentGame && window.currentGame.update && !window.isPaused) {
    window.currentGame.update(
      canvasCtx,
      window.fingerPositions || [],
      deltaTime
    );
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
