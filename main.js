window.currentGame = null;
const canvasElement = document.getElementById('game_canvas');
const canvasCtx = canvasElement.getContext('2d');
let lastTime = performance.now();
window.isPaused = false;

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

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvasElement.width = w * dpr;
  canvasElement.height = h * dpr;
  canvasElement.style.width = w + "px";
  canvasElement.style.height = h + "px";
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (window.currentGame?.onResize) {
    window.currentGame.onResize(w, h);
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
resizeCanvas();

window.startGame = function (gameName) {
  document.getElementById("menu").style.display = "none";
  document.getElementById("input_video").style.opacity = "1";

  if (gameName === "game1") { window.currentGame = Game1; Game1.init(); }
  if (gameName === "game2") { window.currentGame = Game2; Game2.init(); }
  if (gameName === "Game3") { window.currentGame = Game3; Game3.init(); }
  if (gameName === "Game4") { window.currentGame = Game4; Game4.init(); }
  if (gameName === "Game5") { window.currentGame = Game5; Game5.init(); }
  if (gameName === "Game6") { window.currentGame = Game6; Game6.init(); }
  if (gameName === "Game7") { window.currentGame = Game7; Game7.init(); }
  if (gameName === "Game8") { window.currentGame = Game8; Game8.init(); }
  if (gameName === "Game9") { window.currentGame = Game9; Game9.init(); }
  if (gameName === "Game10") {
    if (window.initArmDetection) window.initArmDetection(); 
    window.currentGame = Game10;
    Game10.init();
  }
  resizeCanvas();
};

function gameLoop(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  const video = document.getElementById("input_video");

  if (window.sendFrameToPose && video && video.readyState >= 2 && !window.isPaused) {
    window.sendFrameToPose(video);
  }

  if (window.currentGame && window.currentGame.update && !window.isPaused) {
    window.currentGame.update(canvasCtx, window.fingerPositions || [], deltaTime);
  }
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);