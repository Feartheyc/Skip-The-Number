window.currentGame = null;

const canvasElement = document.getElementById('game_canvas');
const canvasCtx = canvasElement.getContext('2d');

window.startGame = function (gameName) {

  // Hide menu
  document.getElementById("menu").style.display = "none";

  // Ensure camera visible
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
    window.currentGame = Game3;   // ✅ FIXED NAME
    Game3.init();
  }

   if (gameName === "Game4") {
    window.currentGame = Game4;
    Game4.init();
   }
};

/* ==============================
   MAIN GLOBAL GAME LOOP
============================== */
function gameLoop() {

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (window.currentGame && window.currentGame.update) {
    window.currentGame.update(canvasCtx, window.fingerPositions || []);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
