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
  particles: [],
  popups: [],
  trails: { left: [], right: [] },
  shakeTime: 0,
  shakeMag: 0,

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

  /* ============================== */
  setDifficulty(grade) {
    this.currentGrade = grade;
    this.score = 0;
    this.combo = 0;
    this.spawnNumbers();
  },

  /* ============================== */
  getBrightColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 90%, 60%)`;
  },

  /* ============================== */
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

    // spawn floating symbols
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: Math.random() * this.centerX * 2,
        y: Math.random() * this.centerY * 2,
        symbol: ["<", ">", "="][Math.floor(Math.random() * 3)],
        speed: 20 + Math.random() * 20,
        alpha: 0.2 + Math.random() * 0.5
      });
    }
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

    // Screen shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      ctx.save();
      ctx.translate(
        (Math.random()-0.5)*this.shakeMag,
        (Math.random()-0.5)*this.shakeMag
      );
    }

    // animations
    this.fadeAlpha = Math.min(1, this.fadeAlpha + dt * this.fadeSpeed);
    this.popScale = Math.min(1, this.popScale + dt * this.popSpeed);

    if (this.gameState !== "PLAYING") {
      this.feedbackAlpha = Math.min(1, this.feedbackAlpha + dt * 4);
      this.feedbackScale = Math.min(1, this.feedbackScale + dt * 5);
    }

    this.drawParticles(ctx);
    this.drawUI(ctx);
    this.drawPopups(ctx, dt);

    if (this.gameState !== "PLAYING") {
      if (this.shakeTime > 0) ctx.restore();
      return;
    }

    if (fingers.length < 2) {
      this.drawFeedback(ctx, "Need 2 Hands!", "orange");
      if (this.shakeTime > 0) ctx.restore();
      return;
    }

    fingers.sort((a,b)=>a.y-b.y);
    const h1 = fingers[0];
    const h2 = fingers[1];

    this.drawTrails(ctx, h1, h2);
    this.checkPose(ctx, h1, h2, dt);
    this.drawArmSymbol(ctx, h1, h2);

    if (this.shakeTime > 0) ctx.restore();
  },

  /* ============================== */
  drawParticles(ctx){
    ctx.font = `${40*this.scale}px Arial`;
    this.particles.forEach(p=>{
      p.y -= p.speed * 0.01;
      if(p.y < -20) p.y = this.centerY*2 + 20;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(p.symbol, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  },

  /* ============================== */
  drawTrails(ctx, h1, h2){
    this.trails.left.push({x:h1.x,y:h1.y});
    this.trails.right.push({x:h2.x,y:h2.y});
    if(this.trails.left.length>10) this.trails.left.shift();
    if(this.trails.right.length>10) this.trails.right.shift();

    const drawTrail = (trail,color)=>{
      ctx.beginPath();
      for(let i=0;i<trail.length;i++){
        const t=trail[i];
        ctx.globalAlpha=i/trail.length;
        ctx.lineTo(t.x,t.y);
      }
      ctx.strokeStyle=color;
      ctx.lineWidth=6*this.scale;
      ctx.stroke();
      ctx.globalAlpha=1;
    };

    drawTrail(this.trails.left,"#00ffff");
    drawTrail(this.trails.right,"#ff00ff");
  },

  /* ============================== */
  handleSuccess(){
    this.gameState="SUCCESS";
    this.score+=10;
    this.combo++;

    this.popups.push({
      text:"+10",
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
      text:"-5",
      x:this.centerX,
      y:this.centerY,
      vy:30,
      life:1,
      color:"#FF4444"
    });

    setTimeout(()=>this.spawnNumbers(),1200);
  },

  /* ============================== */
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

    const gradeColors={
      1:"#4CAF50",
      2:"#2196F3",
      3:"#FF9800",
      4:"#9C27B0"
    };

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
    ctx.fillStyle=gradeColors[this.currentGrade];
    ctx.fillText(`Grade ${this.currentGrade}`,120*this.scale,60*this.scale);

    ctx.fillStyle="white";
    ctx.fillText(`Score: ${this.score}`,this.centerX,60*this.scale);

    if(this.combo>=2){
      ctx.fillStyle="#FFD700";
      ctx.fillText(`🔥 Combo x${this.combo}`,this.centerX,100*this.scale);
    }

    if(this.gameState==="SUCCESS"){
      ctx.save();
      ctx.translate(this.centerX,this.centerY+120*this.scale);
      ctx.scale(this.feedbackScale,this.feedbackScale);
      ctx.globalAlpha=this.feedbackAlpha;
      ctx.fillStyle="#00FF66";
      ctx.font=`bold ${60*this.scale}px Arial`;
      ctx.fillText("CORRECT!",0,0);
      ctx.restore();
    }

    if(this.gameState==="GAME_OVER"){
      ctx.save();
      ctx.translate(this.centerX,this.centerY);
      ctx.scale(this.feedbackScale,this.feedbackScale);
      ctx.globalAlpha=this.feedbackAlpha;
      ctx.fillStyle="#FF0000";
      ctx.font=`bold ${70*this.scale}px Arial`;
      ctx.fillText("WRONG!",0,0);
      ctx.restore();
    }
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
