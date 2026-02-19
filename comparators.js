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

  currentGrade: 1,

  winHoldTime: 0,
  winHoldThreshold: 0.7,

  failHoldTime: 0,
  failHoldThreshold: 0.7,

  margin: 0,
  detectedSymbol: "None",

  /* === Animations === */
  fadeAlpha: 0,
  fadeSpeed: 2.5,

  popScale: 0,
  popSpeed: 6,

  feedbackScale: 0,
  feedbackAlpha: 0,

  /* === New Systems === */
  popups: [],
  trails: { left: [], right: [] },
  shakeTime: 0,
  shakeMag: 0,

  bgHue: 0,

  /* ============================== */
  init() {
    const rect = document
      .getElementById("container")
      .getBoundingClientRect();

    this.onResize(rect.width, rect.height);
    this.score = 0;

    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setDifficulty(1);
      if (e.key === '2') this.setDifficulty(2);
      if (e.key === '3') this.setDifficulty(3);
      if (e.key === '4') this.setDifficulty(4);
    });

    this.spawnNumbers();
  },

  /* ============================== */
  onResize(width, height) {
    this.centerX = width / 2;
    this.centerY = height / 2;
    const base = Math.min(width, height);
    this.scale = base / 600;
    this.margin = 80 * this.scale;
  },

  setDifficulty(grade) {
    this.currentGrade = grade;
    this.score = 0;
    this.combo = 0;
    this.spawnNumbers();
  },

  getBrightColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 90%, 60%)`;
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
    else if (this.currentGrade === 4) {
      this.spawnIrregularFractions();
    }

    this.leftColor = this.getBrightColor();
    this.rightColor = this.getBrightColor();

    this.fadeAlpha = 0;
    this.popScale = 0.5;
    this.feedbackScale = 0;
    this.feedbackAlpha = 0;

    this.trails.left = [];
    this.trails.right = [];
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

  /* ============================== */
  update(ctx, fingers, dt = 1/60) {

  /* --- 1. ALWAYS draw background in world space (no transforms) --- */
  this.drawAnimatedBackground(ctx);

  /* --- 2. Apply shake ONLY to gameplay layer --- */
  ctx.save();

  if (this.shakeTime > 0) {
    this.shakeTime -= dt;
    ctx.translate(
      (Math.random() - 0.5) * this.shakeMag,
      (Math.random() - 0.5) * this.shakeMag
    );
  }

  /* --- 3. Animations --- */
  this.fadeAlpha = Math.min(1, this.fadeAlpha + dt * this.fadeSpeed);
  this.popScale = Math.min(1, this.popScale + dt * this.popSpeed);

  if (this.gameState !== "PLAYING") {
    this.feedbackAlpha = Math.min(1, this.feedbackAlpha + dt * 4);
    this.feedbackScale = Math.min(1, this.feedbackScale + dt * 5);
  }

  /* --- 4. UI + Popups --- */
  this.drawUI(ctx);
  this.drawPopups(ctx, dt);

  if (this.gameState !== "PLAYING") {
    ctx.restore();
    return;
  }

  /* --- 5. Input validation --- */
  if (fingers.length < 2) {
    this.drawFeedback(ctx, "Need 2 Hands!", "orange");
    ctx.restore();
    return;
  }

  fingers.sort((a, b) => a.y - b.y);
  const h1 = fingers[0];
  const h2 = fingers[1];

  /* --- 6. Trails + gameplay --- */
  this.drawNeonTrail(ctx, this.trails.left, h1, "#00eaff");
  this.drawNeonTrail(ctx, this.trails.right, h2, "#00ffa6");

  this.checkPose(ctx, h1, h2, dt);
  this.drawArmSymbol(ctx, h1, h2);

  /* --- 7. Restore to original world space --- */
  ctx.restore();
},



  /* ============================== */
 drawAnimatedBackground(ctx){
  this.bgHue += 20 * 0.016;

  const canvas = ctx.canvas;

  const grad = ctx.createLinearGradient(
    0, 0,
    canvas.width,
    canvas.height
  );

  grad.addColorStop(0, `hsl(${this.bgHue % 360}, 70%, 15%)`);
  grad.addColorStop(1, `hsl(${(this.bgHue + 60) % 360}, 70%, 10%)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
},


  /* ============================== */
  drawNeonTrail(ctx, trailArray, finger, color){
    trailArray.push({x:finger.x, y:finger.y});
    if(trailArray.length > 15) trailArray.shift();

    ctx.save();
    ctx.beginPath();

    for(let i=0;i<trailArray.length;i++){
      const p = trailArray[i];
      if(i===0) ctx.moveTo(p.x,p.y);
      else ctx.lineTo(p.x,p.y);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 8 * this.scale;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * this.scale;
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    ctx.restore();
  },

  /* ============================== */
  checkPose(ctx,h1,h2,dt){
    if(h1.x<this.centerX-this.margin && h2.x<this.centerX-this.margin) this.detectedSymbol=">";
    else if(h1.x>this.centerX+this.margin && h2.x>this.centerX+this.margin) this.detectedSymbol="<";
    else this.detectedSymbol="Center";

    const wrongRelation=this.currentRelation===">"?"<":">";

    if(this.detectedSymbol===this.currentRelation){
      this.winHoldTime+=dt;
      this.failHoldTime=0;
      const progress=this.winHoldTime/this.winHoldThreshold;
      this.drawProgressBar(ctx,progress,"#00FFCC");
      if(this.winHoldTime>=this.winHoldThreshold) this.handleSuccess();
    }
    else if(this.detectedSymbol===wrongRelation){
      this.failHoldTime+=dt;
      this.winHoldTime=0;
      const failProgress=this.failHoldTime/this.failHoldThreshold;
      this.drawProgressBar(ctx,failProgress,"#FF0000");
      if(this.failHoldTime>=this.failHoldThreshold) this.handleFail();
    }
  },

  /* ============================== */
  handleSuccess(){
    this.gameState="SUCCESS";
    this.score+=10;
    this.combo++;

    this.popups.push({
      text:"Correct",
      x:this.centerX,
      y:this.centerY,
      vy:-30,
      life:1,
      color:"#00FF66"
    });

    setTimeout(()=>this.spawnNumbers(),900);
  },

  handleFail(){
    this.gameState="GAME_OVER";
    this.score=Math.max(0,this.score-5);
    this.combo=0;
    this.shakeTime=0.4;
    this.shakeMag=10*this.scale;

    this.popups.push({
      text:"Wrong!!!",
      x:this.centerX,
      y:this.centerY,
      vy:30,
      life:1,
      color:"#FF4444"
    });

    setTimeout(()=>this.spawnNumbers(),1200);
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

  drawArmSymbol(ctx,h1,h2){
    ctx.lineWidth=12*this.scale;
    ctx.lineCap="round";
    ctx.shadowBlur=15*this.scale;
    ctx.strokeStyle="#00ff37";

    ctx.beginPath();
    ctx.moveTo(h1.x,h1.y);
    ctx.lineTo(this.centerX,this.centerY);
    ctx.lineTo(h2.x,h2.y);
    ctx.stroke();
    ctx.shadowBlur=0;
  },

  /* ============================== */
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

    /* ===== SCORE ===== */
    ctx.font=`bold ${36*this.scale}px Arial`;
    ctx.fillStyle="white";
    ctx.fillText(`Score: ${this.score}`,this.centerX,60*this.scale);

    /* ===== COMBO ===== */
    if(this.combo>=2){
      ctx.fillStyle="#FFD700";
      ctx.fillText(`Combo x${this.combo}`,this.centerX,100*this.scale);
    }

    /* ===== GRADE TEXT (NEW) ===== */
    ctx.textAlign="left";
    ctx.font=`bold ${32*this.scale}px Arial`;
    ctx.fillStyle="#FFFFFF";
    ctx.fillText(`Grade: ${this.currentGrade}`, 30*this.scale, 40*this.scale);

    ctx.textAlign="center"; // reset alignment
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
  }
};
