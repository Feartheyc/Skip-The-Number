/* ============================================================
   main.js  — with ModeSelector integrated for Game1
   Changes vs original:
   • startGame("game1") now shows ModeSelector first, then
     calls the appropriate Game1 mode activator after selection.
   • Everything else is identical to the optimised original.
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
  lastTime         = performance.now();
  document.getElementById("pauseOverlay").style.display = "none";
};

window.goToMainMenu = function () {
  window.isPaused = false;
  document.getElementById("pauseOverlay").style.display = "none";
  /* Hide camera BEFORE nulling currentGame so the loop doesn't
     clear to transparent while the feed is still visible */
  document.getElementById("input_video").style.opacity  = "0";
  blackoutCanvas();
  window.currentGame = null;
  document.getElementById("menu").style.display         = "flex";
};

/* ── Canvas resize (debounced) ────────────────────────────── */
let _resizeTimer = null;

function resizeCanvas() {
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

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
resizeCanvas();

/* ── Solid dark fill on the game canvas — covers camera ────── */
function blackoutCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasCtx.fillStyle = "#0d1b2e";
  canvasCtx.fillRect(0, 0, w, h);
}

/* ── Game1 mode launcher (called after ModeSelector) ─────── */
function launchGame1WithMode(modeKey) {
  /* Paint dark bg immediately so there's no camera flash
     between the selector disappearing and the first game frame */
  blackoutCanvas();

  Game1.init();
  window.currentGame = Game1;
  resizeCanvas();

  switch (modeKey) {
    case "pattern": Game1.activatePatternMode();      break;
    case "cannon":  Game1.activateCannonMode();       break;
    case "orb":     Game1.activateOrbMode();          break;
    case "triple":  Game1.activateTripleCannonMode(); break;
    default: break;
  }
}

/* ── Start game ───────────────────────────────────────────── */
window.startGame = function (gameName) {
  document.getElementById("menu").style.display = "none";
  window.currentGame = null;

  /* Game1 gets the mode selector before starting.
     We do NOT reveal the camera yet — the selector paints its
     own dark background.  The camera opacity is set to 1 only
     after the mode is chosen and the game loop takes over. */
  if (gameName === "game1") {
    /* Paint dark bg on the game canvas before the selector
       overlay appears, so there is zero visible gap */
    blackoutCanvas();
    ModeSelector.show((modeKey) => {
      /* Now it's safe to show the camera feed — the game loop
         will immediately start drawing over it */
      document.getElementById("input_video").style.opacity = "1";
      launchGame1WithMode(modeKey);
    });
    return;
  }

  /* All other games: reveal camera then start as normal */
  document.getElementById("input_video").style.opacity = "1";

  /* All other games start directly as before */
  const map = {
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
  resizeCanvas();
};

/* ── Game loop ────────────────────────────────────────────── */
function gameLoop(currentTime) {
  requestAnimationFrame(gameLoop);

  let dt = (currentTime - lastTime) / 1000;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0)    dt = 0;
  lastTime = currentTime;

  if (window.isPaused) return;

  const game = window.currentGame;
  if (!game || !game.update) return;   // leave blackout in place, don't clear

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  game.update(canvasCtx, window.fingerPositions || [], dt);
}

requestAnimationFrame(gameLoop);