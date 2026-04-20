/* ============================================================
   main.js  — ModeSelector + Tutorial integrated for Game1/9/10
   
   Key changes vs original:
   • startGame("game1")  → ModeSelector → Tutorial → launch
   • startGame("Game9")  → Tutorial → launch  (no mode selector)
   • startGame("Game10") → Tutorial → launch  (no mode selector)
   • No-finger prompts use Tutorial.showNoFingerPrompt(gameId)
     with the gameId explicitly passed — other games get nothing.
   • Tutorial.destroyNoFingerPrompt() called on pause/menu/mode-change
     so prompts never leak across games.
============================================================ */

window.currentGame  = null;
const canvasElement = document.getElementById("game_canvas");
const canvasCtx     = canvasElement.getContext("2d");
let   lastTime      = performance.now();
window.isPaused     = false;

/* ── Which game is active (for finger prompt isolation) ───── */
let _activeGameId = ""; // "game1"|"game9"|"game10"|"" for all others

/* ── No-finger detection — per-game, no cross-game leaking ──
   Only runs when _activeGameId is one of the tutorial games.
   ─────────────────────────────────────────────────────────── */
let _noFingerFrames = 0;
const NO_FINGER_THRESHOLD = 90; // ~1.5 s at 60 fps




/* ── Pause / Resume ───────────────────────────────────────── */
window.pauseGame = function () {
  window.isPaused = true;
  document.getElementById("pauseOverlay").style.display = "flex";

  // "Change Mode" only appears for Game1
  const btn = document.getElementById("changeModeBtn");
  if (btn) btn.style.display = (window.currentGame === Game1) ? "block" : "none";
};

window.changeMode = function () {
  window.isPaused = false;
  document.getElementById("pauseOverlay").style.display = "none";


  _activeGameId = "";
  document.getElementById("input_video").style.opacity = "0";
  window.currentGame = null;

  blackoutCanvas();
  ModeSelector.show((modeKey) => {

      _activeGameId = "game1";
      launchGame1WithMode(modeKey);
    });
  };

window.resumeGame = function () {
  window.isPaused = false;
  lastTime        = performance.now();
  document.getElementById("pauseOverlay").style.display = "none";
  // Restart finger-frame counter so prompt doesn't flash immediately on resume
  _noFingerFrames = 0;
};

window.goToMainMenu = function () {
  window.isPaused = false;
  document.getElementById("pauseOverlay").style.display = "none";


  _activeGameId = "";
  document.getElementById("input_video").style.opacity = "0";
  blackoutCanvas();
  window.currentGame = null;
  document.getElementById("menu").style.display = "flex";
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


/* ── Blackout ─────────────────────────────────────────────── */
function blackoutCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasCtx.fillStyle = "#0d1b2e";
  canvasCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);
}


/* ── Game1 launcher — called after Tutorial.show resolves ─── */
function launchGame1WithMode(modeKey) {
  blackoutCanvas();
  _noFingerFrames = 0;
  Game1.init(modeKey);
  window.currentGame = Game1;
  resizeCanvas();

}


/* ── Start game ───────────────────────────────────────────── */
window.startGame = function (gameName) {
  document.getElementById("menu").style.display = "none";
  window.currentGame = null;
  _activeGameId = "";

  const video = document.getElementById("input_video");

  /* ── GAME 1 ── ModeSelector → launch ─────────── */
  if (gameName === "game1") {
    blackoutCanvas();

    // ✅ Restore camera preview for Game1
    if (video) {
      video.style.position = "fixed";
      video.style.top = "-9999px";
      video.style.left = "-9999px";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
    }

    ModeSelector.show((modeKey) => {
      launchGame1WithMode(modeKey);
    });
    return;
  }

  /* ── GAME 9 ── Hide camera preview completely ─────────── */
  if (gameName === "Game9") {
    blackoutCanvas();

    _activeGameId = "game9";

    // ✅ FULLY hide camera preview but keep stream running
    if (video) {
      video.style.position = "fixed";
      video.style.top = "-9999px";
      video.style.left = "-9999px";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
    }

    Game9.init();
    window.currentGame = Game9;
    resizeCanvas();
    return;
  }

  /* ── GAME 10 ── Normal behavior ─────────── */
  if (gameName === "Game10") {
    blackoutCanvas();

    _activeGameId = "game10";

    // ✅ Restore camera preview
    if (video) {
      video.style.position = "fixed";
      video.style.top = "-9999px";
      video.style.left = "-9999px";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
    }

    Game10.init();
    window.currentGame = Game10;
    resizeCanvas();
    return;
  }

  /* ── ALL OTHER GAMES ─────────── */
  // ✅ Restore camera preview
  if (video) {
    video.style.position = "absolute";
    video.style.top = "0";
    video.style.left = "0";
    video.style.width = "";
    video.style.height = "";
    video.style.opacity = "1";
    video.style.pointerEvents = "auto";
  }

  const map = {
    game2:  () => { window.currentGame = Game2;  Game2.init(); },
    Game3:  () => { window.currentGame = Game3;  Game3.init(); Game3.startDetection(); },
    Game4:  () => { window.currentGame = Game4;  Game4.init(); },
    Game5:  () => { window.currentGame = Game5;  Game5.init(); },
    Game6:  () => { window.currentGame = Game6;  Game6.init(); },
    Game7:  () => { window.currentGame = Game7;  Game7.init(); },
    Game8:  () => { window.currentGame = Game8;  Game8.init(); },
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
  if (!game || !game.update) return;

  // Check finger presence ONLY for the three supported games


  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  game.update(canvasCtx, window.fingerPositions || [], dt);
}

requestAnimationFrame(gameLoop);