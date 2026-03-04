const Game3 = {
  centerX: 0,
  centerY: 0,
  scale: 1,

  leftValue: 0,
  rightValue: 0,
  currentRelation: "",

  leftText: "",
  rightText: "",

  leftColor: "#FFFFFF",
  rightColor: "#FFFFFF",

  score: 0,
  combo: 0,
  gameState: "PLAYING",
  running: true, 

  currentGrade: 1,

  winHoldTime: 0,
  winHoldThreshold: 0.7,

  failHoldTime: 0,
  failHoldThreshold: 0.7,

  margin: 0,
  detectedSymbol: "None",

  fadeAlpha: 0,
  fadeSpeed: 2.5,

  popScale: 0,
  popSpeed: 6,

  popups: [],
  particles: [],
  confetti: [], 
  shakeTime: 0,
  shakeMag: 0,

  symbolHue: 0,

  init() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.onResize(w, h);
    this.score = 0;
    this.running = true;

    this.createConfetti();

    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setDifficulty(1);
      if (e.key === '2') this.setDifficulty(2);
      if (e.key === '3') this.setDifficulty(3);
      if (e.key === '4') this.setDifficulty(4);
    });

    this.spawnNumbers();

    if (typeof PauseArea !== 'undefined') {
      const canvas = document.getElementById("game_canvas") || document.querySelector("canvas");
      if (canvas) PauseArea.init(canvas, canvas.getContext('2d'), this);
    }
  },

  reset() {
      this.init();
  },

  onResize(width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    const base = Math.min(width, height);
    this.scale = base / 600;
    this.margin = 80 * this.scale;
  },

  createConfetti(){
    const symbols = ["+", "-", "×", "÷", "<", ">", "="];
    this.confetti = [];
    for(let i=0;i<5;i++){
      this.confetti.push({
        x: Math.random()*window.innerWidth,
        y: Math.random()*window.innerHeight,
        symbol: symbols[Math.floor(Math.random()*symbols.length)],
        size: (60 + Math.random()*40),
        speed: 20 + Math.random()*10,
        color: this.getBrightColor()
      });
    }
  },

  setDifficulty(grade) {
    this.currentGrade = grade;
    this.score = 0;
    this.combo = 0;
    this.spawnNumbers();
  },

  getBrightColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 900%, 60%)`;
  },

  spawnNumbers() {
    this.gameState = "PLAYING";
    this.winHoldTime = 0;
    this.failHoldTime = 0;
    this.detectedSymbol = "None";

    if (this.currentGrade === 1) this.spawnIntegers(1, 20);
    else if (this.currentGrade === 2) this.spawnIntegers(-50, 50);
    else if (this.currentGrade === 3) {
      if (Math.random() > 0.5) this.spawnIntegers(100, 999);
      else this.spawnLikeFractions();
    }
    else if (this.currentGrade === 4) this.spawnIrregularFractions();

    this.leftColor = this.getBrightColor();
    this.rightColor = this.getBrightColor();

    this.fadeAlpha = 0;
    this.popScale = 0.5;
  },

  spawnIntegers(min, max) {
    let n1 = Math.floor(Math.random() * (max - min + 1)) + min;
    let n2 = Math.floor(Math.random() * (max - min + 1)) + min;
    while (n1 === n2) n2 = Math.floor(Math.random() * (max - min + 1)) + min;

    this.leftValue = n1;
    this.rightValue = n2;
    this.leftText = n1.toString();
    this.rightText = n2.toString();
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  spawnLikeFractions() {
    const den = Math.floor(Math.random() * 7) + 3;
    let n1 = Math.floor(Math.random() * 12) + 1;
    let n2 = Math.floor(Math.random() * 12) + 1;
    while (n1 === n2) n2 = Math.floor(Math.random() * 12) + 1;

    this.leftValue = n1 / den;
    this.rightValue = n2 / den;
    this.leftText = `${n1}/${den}`;
    this.rightText = `${n2}/${den}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  spawnIrregularFractions() {
    const easyDenoms = [2,3,4,5,6,8,10];
    let d1 = easyDenoms[Math.floor(Math.random()*easyDenoms.length)];
    let d2 = easyDenoms[Math.floor(Math.random()*easyDenoms.length)];
    while (d1 === d2) d2 = easyDenoms[Math.floor(Math.random()*easyDenoms.length)];

    let n1 = Math.floor(Math.random()*d1)+1;
    let n2 = Math.floor(Math.random()*d2)+1;

    this.leftValue = n1/d1;
    this.rightValue = n2/d2;
    this.leftText = `${n1}/${d1}`;
    this.rightText = `${n2}/${d2}`;
    this.currentRelation = this.leftValue > this.rightValue ? ">" : "<";
  },

  update(ctx, landmarks, dt = 1/60) {
    const isPaused = typeof PauseArea !== 'undefined' && PauseArea.isPaused;
    if (isPaused) dt = 0; 

    ctx.save();
    this.symbolHue = (this.symbolHue + 200 * dt) % 360;
    this.drawConfetti(ctx, dt); 

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      ctx.translate((Math.random()-0.5)*this.shakeMag,(Math.random()-0.5)*this.shakeMag);
    }

    this.fadeAlpha = Math.min(1, this.fadeAlpha + dt * this.fadeSpeed);
    this.popScale = Math.min(1, this.popScale + dt * this.popSpeed);

    this.drawUI(ctx);
    this.drawPopups(ctx, dt);
    this.drawParticles(ctx, dt);

    if (this.gameState !== "PLAYING") { 
        ctx.restore(); 
    } else {
        if (!landmarks || landmarks.length < 3) {
          this.drawFeedback(ctx, "Show One Hand!", "orange");
        } else {
          const indexTip = landmarks[0];
          const thumbTip = landmarks[1];
          const wrist = landmarks[2];

          this.checkPose(ctx, indexTip, thumbTip, wrist, dt);
          this.drawArmSymbol(ctx, indexTip, thumbTip, wrist);
        }
        ctx.restore();
    }

    if (typeof PauseArea !== 'undefined') {
        PauseArea.drawPauseIcon(ctx);
        if (isPaused) PauseArea.draw();
    }
  },

  drawConfetti(ctx,dt){
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    this.confetti.forEach(c=>{
      c.y += c.speed * dt;
      if(c.y > window.innerHeight + 50){
        c.y = -50;
        c.x = Math.random()*window.innerWidth;
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = c.color;
      ctx.font = `bold ${c.size*this.scale}px Arial`;
      ctx.fillText(c.symbol, c.x, c.y);
    });
    ctx.globalAlpha=1;
  },

  checkPose(ctx, indexTip, thumbTip, wrist, dt) {
    const tipsX = (indexTip.x + thumbTip.x) / 2;
    const threshold = 30 * this.scale; 

    if (tipsX < wrist.x - threshold) {
        this.detectedSymbol = ">"; 
    } else if (tipsX > wrist.x + threshold) {
        this.detectedSymbol = "<"; 
    } else {
        this.detectedSymbol = "Center";
    }

    const wrongRelation = this.currentRelation === ">" ? "<" : ">";

    if (this.detectedSymbol === this.currentRelation) {
      this.winHoldTime += dt;
      this.failHoldTime = 0;
      this.drawProgressBar(ctx, this.winHoldTime / this.winHoldThreshold, "#00FFCC");
      if(this.winHoldTime >= this.winHoldThreshold) this.handleSuccess();
    }
    else if (this.detectedSymbol === wrongRelation) {
      this.failHoldTime += dt;
      this.winHoldTime = 0;
      this.drawProgressBar(ctx, this.failHoldTime / this.failHoldThreshold, "#FF0000");
      if(this.failHoldTime >= this.failHoldThreshold) this.handleFail();
    } else {
      this.winHoldTime = Math.max(0, this.winHoldTime - dt);
      this.failHoldTime = Math.max(0, this.failHoldTime - dt);
    }
  },

  handleSuccess(){
    this.gameState="SUCCESS";
    this.score+=10;
    this.combo++;

    for(let i=0;i<20;i++){
      this.particles.push({
        x:this.centerX,
        y:this.centerY,
        vx:(Math.random()-0.5)*300,
        vy:(Math.random()-0.5)*300,
        life:1,
        color:this.getBrightColor()
      });
    }

    this.popups.push({text:"Correct",x:this.centerX,y:this.centerY,vy:-30,life:1,color:"#00FF66"});
    setTimeout(()=>this.spawnNumbers(),900);
  },

  handleFail(){
    this.gameState="GAME_OVER";
    this.score=Math.max(0,this.score-5);
    this.combo=0;
    this.shakeTime=0.4;
    this.shakeMag=10*this.scale;

    this.popups.push({text:"Wrong!!!",x:this.centerX,y:this.centerY,vy:30,life:1,color:"#FF4444"});
    setTimeout(()=>this.spawnNumbers(),1200);
  },

  drawParticles(ctx,dt){
    this.particles.forEach(p=>{
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.life-=dt;
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,6*this.scale,0,Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha=1;
    this.particles=this.particles.filter(p=>p.life>0);
  },

  drawPopups(ctx,dt){
    this.popups.forEach(p=>{
      p.y+=p.vy*dt;
      p.life-=dt;
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;
      ctx.font=`bold ${40*this.scale}px Arial`;
      ctx.fillText(p.text,p.x,p.y);
    });
    ctx.globalAlpha=1;
    this.popups=this.popups.filter(p=>p.life>0);
  },

  drawArmSymbol(ctx, indexTip, thumbTip, wrist) {
    ctx.lineWidth = 12 * this.scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 15 * this.scale;

    let color = "#00FFCC"; 

    if (this.detectedSymbol === ">") {
        color = "#FFFF00"; 
    } 
    else if (this.detectedSymbol === "<") {
        color = "#00AAFF"; 
    }

    ctx.strokeStyle = color;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.moveTo(indexTip.x, indexTip.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.lineTo(thumbTip.x, thumbTip.y);
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "white";
    [indexTip, thumbTip, wrist].forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8 * this.scale, 0, Math.PI * 2);
        ctx.fill();
    });
  },
  
  drawUI(ctx){
    ctx.textAlign="center";
    ctx.textBaseline="middle";

    const numberSize=110*this.scale*this.popScale;
    ctx.font=`bold ${numberSize}px Arial`;
    ctx.globalAlpha=this.fadeAlpha;

    const offsetX=180*this.scale;
    const leftX=this.centerX-offsetX;
    const rightX=this.centerX+offsetX;
    const y=this.centerY;

    ctx.lineWidth=10*this.scale;
    ctx.strokeStyle="black";
    ctx.strokeText(this.leftText,leftX,y);
    ctx.strokeText(this.rightText,rightX,y);

    ctx.fillStyle=this.leftColor;
    ctx.fillText(this.leftText,leftX,y);

    ctx.fillStyle=this.rightColor;
    ctx.fillText(this.rightText,rightX,y);

    ctx.globalAlpha=1;

    ctx.font=`bold ${36*this.scale}px Arial`;
    ctx.fillStyle="white";
    ctx.fillText(`Score: ${this.score}`,this.centerX,60*this.scale);

    if(this.combo>=2){
      ctx.fillStyle="#FFD700";
      ctx.fillText(`Combo x${this.combo}`,this.centerX,100*this.scale);
    }

    ctx.textAlign="left";
    ctx.font=`bold ${32*this.scale}px Arial`;
    ctx.fillStyle="#FFFFFF";
    ctx.fillText(`Grade: ${this.currentGrade}`,30*this.scale,40*this.scale);
    ctx.textAlign="center";
  },

  drawFeedback(ctx,text,color){
    ctx.fillStyle=color;
    ctx.font=`bold ${30*this.scale}px Arial`;
    ctx.fillText(text,this.centerX,this.centerY+150*this.scale);
  },

  drawProgressBar(ctx,percentage,color){
    if(percentage<=0) return;
    const width=220*this.scale;
    const height=20*this.scale;

    ctx.fillStyle="rgba(0,0,0,0.5)";
    ctx.fillRect(this.centerX-width/2,this.centerY+70*this.scale,width,height);

    ctx.fillStyle=color;
    ctx.fillRect(this.centerX-width/2,this.centerY+70*this.scale,width*Math.min(1,percentage),height);
  },

  // ⭐ ADDITIVE LOGIC: 100% Native MediaPipe Integration Below Here ⭐
  lastTime: 0,
  gameCtx: null,

  startDetection(canvasId) {
    const canvas = document.getElementById(canvasId) || document.querySelector("canvas");
    if (!canvas) {
        console.error("Game3: Canvas not found!");
        return;
    }
    this.gameCtx = canvas.getContext('2d');
    
    // Create a hidden video element to feed the webcam to MediaPipe
    const videoElement = document.createElement('video');
    videoElement.style.display = 'none';
    document.body.appendChild(videoElement);

    // Initialize MediaPipe Hands
    const hands = new Hands({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
      maxNumHands: 1, // Only tracking 1 hand now!
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // When the AI finds hands, trigger our new game loop
    hands.onResults((results) => {
      this.onCameraFrame(results, canvas);
    });

    // Turn on the webcam
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({image: videoElement});
      },
      width: window.innerWidth,
      height: window.innerHeight
    });
    camera.start();
  },

  onCameraFrame(results, canvas) {
    // Calculate precise delta time (dt) for smooth animations
    const now = performance.now();
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 1/60;
    this.lastTime = now;

    // Clear the canvas and draw the webcam feed mirrored
    this.gameCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.gameCtx.save();
    this.gameCtx.scale(-1, 1);
    this.gameCtx.translate(-canvas.width, 0);
    this.gameCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    this.gameCtx.restore();

    let extractedPoints = [];

    // If a hand is detected, extract only the 3 points we need and convert them to screen pixels
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        
        // MediaPipe returns coordinates from 0.0 to 1.0. We multiply by canvas size to get actual pixels.
        // We also flip the X axis (1 - x) because the camera is mirrored like a selfie!
        const wrist = { 
            x: (1 - hand[0].x) * canvas.width, 
            y: hand[0].y * canvas.height 
        };
        const thumbTip = { 
            x: (1 - hand[4].x) * canvas.width, 
            y: hand[4].y * canvas.height 
        };
        const indexTip = { 
            x: (1 - hand[8].x) * canvas.width, 
            y: hand[8].y * canvas.height 
        };

        // Put them in the specific order the update function expects
        extractedPoints = [indexTip, thumbTip, wrist];
    }

    // Run the main game loop with the new points
    this.update(this.gameCtx, extractedPoints, dt);
  }
};