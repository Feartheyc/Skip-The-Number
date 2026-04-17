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

function _checkFingerPresence() {
  // Only show prompt for the three games that support it
  if (!_activeGameId) return;
  if (!["game1", "game9", "game10"].includes(_activeGameId)) return;

  const has = (window.fingerPositions || []).length > 0;
  if (has) {
    _noFingerFrames = 0;
    Tutorial.hideNoFingerPrompt(_activeGameId);
  } else {
    _noFingerFrames++;
    if (_noFingerFrames > NO_FINGER_THRESHOLD) {
      Tutorial.showNoFingerPrompt(_activeGameId);
    }
  }
}

function _clearFingerState() {
  _noFingerFrames = 0;
  Tutorial.destroyNoFingerPrompt();
}


/* ── Pause / Resume ───────────────────────────────────────── */
window.pauseGame = function () {
  window.isPaused = true;
  document.getElementById("pauseOverlay").style.display = "flex";

  // "Change Mode" only appears for Game1
  const btn = document.getElementById("changeModeBtn");
  if (btn) btn.style.display = (window.currentGame === Game1) ? "block" : "none";

  // Always kill the finger prompt while paused
  Tutorial.destroyNoFingerPrompt();
};

window.changeMode = function () {
  window.isPaused = false;
  document.getElementById("pauseOverlay").style.display = "none";

  _clearFingerState();
  _activeGameId = "";
  document.getElementById("input_video").style.opacity = "0";
  window.currentGame = null;

  blackoutCanvas();
  ModeSelector.show((modeKey) => {
    Tutorial.show("game1", modeKey, () => {
      _activeGameId = "game1";
      document.getElementById("input_video").style.opacity = "1";
      launchGame1WithMode(modeKey);
    });
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

  _clearFingerState();
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
  Game1.init();
  window.currentGame = Game1;
  resizeCanvas();
  switch (modeKey) {
    case "pattern": Game1.activatePatternMode();      break;
    case "cannon":  Game1.activateCannonMode();       break;
    case "orb":     Game1.activateOrbMode();          break;
    case "triple":  Game1.activateTripleCannonMode(); break;
    default: break; // "default" mode needs no extra call
  }
}


/* ── Start game ───────────────────────────────────────────── */
window.startGame = function (gameName) {
  document.getElementById("menu").style.display = "none";
  window.currentGame = null;
  _clearFingerState();
  _activeGameId = "";

  /* ── GAME 1 ── ModeSelector → Tutorial → launch ─────────── */
  if (gameName === "game1") {
    blackoutCanvas();
    ModeSelector.show((modeKey) => {
      Tutorial.show("game1", modeKey, () => {
        _activeGameId = "game1";
        document.getElementById("input_video").style.opacity = "1";
        launchGame1WithMode(modeKey);
      });
    });
    return;
  }

  /* ── GAME 9 ── Tutorial (dreamy theme) → launch ──────────── */
  if (gameName === "Game9") {
    blackoutCanvas();
    Tutorial.show("game9", null, () => {
      _activeGameId = "game9";
       Game9.init();
      // document.getElementById("input_video").style.opacity = "1";
      blackoutCanvas();
      _noFingerFrames = 0;
     
      window.currentGame = Game9;
      resizeCanvas();
    });
    return;
  }

  /* ── GAME 10 ── Tutorial (cosmic theme) → launch ─────────── */
  if (gameName === "Game10") {
    blackoutCanvas();
    Tutorial.show("game10", null, () => {
      _activeGameId = "game10";
      blackoutCanvas();
      Game10.init();
      // document.getElementById("input_video").style.opacity = "1";
      
      _noFingerFrames = 0;
      if (window.initArmDetection) window.initArmDetection();
      
      window.currentGame = Game10;
      resizeCanvas();
    });
    return;
  }

  /* ── ALL OTHER GAMES — no tutorial, no finger prompt ─────── */
  document.getElementById("input_video").style.opacity = "1";

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
  _checkFingerPresence();

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  game.update(canvasCtx, window.fingerPositions || [], dt);
}

requestAnimationFrame(gameLoop);