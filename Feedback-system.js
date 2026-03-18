
const FeedbackSystem = (() => {

  let overlay, threeCanvas, renderer, scene, camera;
  let vrm = null, puppet = null;
  let holisticInst = null, videoEl = null, mirrorCanvas = null;
  let animId = null, countdownEl = null, shotCanvas = null;
  let countdownVal = 7, cdInterval = null;
  let launched = false, opts = {};
  let poseData = null;
  let T = null; // THREE namespace, set after dynamic load
  let GLTFLoaderCls = null, VRMLoaderPluginCls = null, VRMUtilsCls = null;
  const pBones = {};
  const clock  = { last: 0 };
  const smooth = {
    headY:0, headX:0, spineY:0,
    lShoulderAngle:0, rShoulderAngle:0,
    lElbowAngle:0, rElbowAngle:0,
    lWristX:0, lWristY:0, rWristX:0, rWristY:0,
  };

  /* ---- dynamic script loader -------------------------------- */
  function _loadScript(src, cb) {
    const s = document.createElement("script");
    s.src = src;
    s.onload  = cb;
    s.onerror = () => cb(false);
    document.head.appendChild(s);
  }

  function _loadThree(cb) {
    // Use r128 UMD — last version with reliable non-module CDN build
    _loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.152.0/three.min.js",
      ok => {
        if (ok === false || !window.THREE) { cb(false); return; }
        T = window.THREE;
        // Load GLTFLoader for that same version
        _loadScript(
          "https://cdn.jsdelivr.net/npm/three@0.152.0/examples/js/loaders/GLTFLoader.js",
          ok2 => {
            if (ok2 !== false && window.THREE && window.THREE.GLTFLoader) {
              GLTFLoaderCls = window.THREE.GLTFLoader;
            }
            // three-vrm UMD (v0.x works with r128)
            _loadScript(
              "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@1.0.0/lib/three-vrm.js",
              ok3 => {
                if (ok3 !== false && window.THREE_VRM) {
                  VRMLoaderPluginCls = null; // v0.x uses different API
                }
                cb(true);
              }
            );
          }
        );
      }
    );
  }

  /* ---- PUBLIC ----------------------------------------------- */
  function launch(options) {
    if (launched) return;
    launched = true;
    opts = { score:0, streak:0, avatarPath:"avatar.vrm", ...(options||{}) };

    _injectStyles();
    _buildOverlay();
    _startWebcam();
    _startHolistic();
    _startCountdown();

    _loadThree(ok => {
      if (ok && T) {
        _initThree();
        _loadAvatar();
      } else {
        _show2DFallback();
      }
      _loop();
    });
  }

  function destroy() {
    launched = false;
    if (cdInterval) clearInterval(cdInterval);
    if (animId)     cancelAnimationFrame(animId);
    try { if (holisticInst) holisticInst.close(); } catch(_){}
    if (renderer)   { renderer.dispose(); renderer = null; }
    if (videoEl && videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t=>t.stop());
    if (videoEl && videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay=null; vrm=null; puppet=null; scene=null; camera=null; poseData=null;
  }

  /* ---- STYLES ----------------------------------------------- */
  function _injectStyles() {
    if (document.getElementById("fs-styles")) return;
    const s = document.createElement("style");
    s.id = "fs-styles";
    s.textContent = [
      "@keyframes fsCountdownPulse{0%,100%{transform:scale(1);box-shadow:0 0 40px rgba(124,58,237,.7)}50%{transform:scale(1.08);box-shadow:0 0 70px rgba(124,58,237,1)}}",
      "@keyframes fsFlash{0%{opacity:1}100%{opacity:0}}",
      "@keyframes fsSlideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}",
      "@keyframes fsBtnGlow{0%,100%{box-shadow:0 0 18px rgba(52,211,153,.45)}50%{box-shadow:0 0 44px rgba(52,211,153,.95)}}",
    ].join("");
    document.head.appendChild(s);
  }

  /* ---- OVERLAY ---------------------------------------------- */
  function _el(tag, styles) {
    const e = document.createElement(tag);
    Object.assign(e.style, styles);
    return e;
  }
  function _panel(border, shadow, bg) {
    return _el("div",{
      position:"relative",borderRadius:"20px",overflow:"hidden",
      border:"2px solid "+border,
      boxShadow:"0 0 34px "+shadow+",inset 0 0 26px rgba(0,0,0,.5)",
      flex:"1",maxWidth:"420px",aspectRatio:"3/4",background:bg,
    });
  }
  function _badge(text, color, border) {
    const l = _el("div",{
      position:"absolute",bottom:"10px",left:"50%",transform:"translateX(-50%)",
      zIndex:"5",color:color,fontSize:"12px",letterSpacing:"1px",
      background:"rgba(0,0,0,.65)",padding:"3px 12px",
      borderRadius:"20px",border:"1px solid "+border,whiteSpace:"nowrap",
    });
    l.textContent = text;
    return l;
  }

  function _buildOverlay() {
    overlay = _el("div",{
      position:"fixed",inset:"0",zIndex:"99999",
      background:"radial-gradient(ellipse at 30% 50%,#0d0221 0%,#07091a 55%,#000 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",
      fontFamily:"'Comic Sans MS',cursive",
      opacity:"0",transition:"opacity .55s ease",overflow:"hidden",
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(function(){ overlay.style.opacity="1"; });

    // Stars
    const sb = document.createElement("canvas");
    Object.assign(sb.style,{position:"absolute",inset:"0",pointerEvents:"none",zIndex:"0"});
    overlay.appendChild(sb);
    (function(){
      const dpr=window.devicePixelRatio||1;
      sb.width=window.innerWidth*dpr; sb.height=window.innerHeight*dpr;
      const c=sb.getContext("2d"); c.scale(dpr,dpr);
      for(let i=0;i<200;i++){
        c.globalAlpha=Math.random()*.55+.08; c.fillStyle="#fff";
        c.beginPath(); c.arc(Math.random()*window.innerWidth,Math.random()*window.innerHeight,Math.random()*1.4+.2,0,Math.PI*2); c.fill();
      }
      c.globalAlpha=1;
    })();

    // Title
    const title = _el("div",{
      position:"relative",zIndex:"10",marginTop:"22px",textAlign:"center",color:"#e2e8f0",
      fontSize:"clamp(14px,2.4vw,25px)",letterSpacing:"2px",
      textShadow:"0 0 22px rgba(124,58,237,.85)",
    });
    title.innerHTML='<span style="color:#a78bfa">✨ EPIC MOMENT CAPTURED ✨</span><br>'
      +'<span style="font-size:.57em;color:#64748b">⭐ Score: '+opts.score+' &nbsp;|&nbsp; 🔥 Best Streak: '+opts.streak+'</span>';
    overlay.appendChild(title);

    // Stage
    const stage = _el("div",{
      position:"relative",zIndex:"10",display:"flex",alignItems:"center",
      justifyContent:"center",gap:"clamp(10px,2.2vw,36px)",
      marginTop:"12px",width:"100%",flex:"1",padding:"0 18px",boxSizing:"border-box",
    });
    overlay.appendChild(stage);

    // Left — Three.js canvas
    const lw = _panel("rgba(124,58,237,.5)","rgba(124,58,237,.22)","#050211");
    threeCanvas = document.createElement("canvas");
    Object.assign(threeCanvas.style,{width:"100%",height:"100%",display:"block"});
    lw.appendChild(threeCanvas);
    lw.appendChild(_badge("🤖 YOUR AVATAR","#a78bfa","rgba(124,58,237,.4)"));
    stage.appendChild(lw);

    // Center — countdown
    const cc = _el("div",{display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",flexShrink:"0"});
    countdownEl = _el("div",{
      width:"clamp(68px,8.5vw,96px)",height:"clamp(68px,8.5vw,96px)",
      borderRadius:"50%",background:"conic-gradient(#7c3aed 0%,#a78bfa 100%)",
      boxShadow:"0 0 40px rgba(124,58,237,.7)",display:"flex",
      alignItems:"center",justifyContent:"center",
      fontSize:"clamp(24px,3.8vw,40px)",color:"#fff",fontWeight:"bold",
      animation:"fsCountdownPulse 1s ease infinite",
    });
    countdownEl.textContent="7";
    const csub=_el("div",{color:"#475569",fontSize:"11px",letterSpacing:"1px",textAlign:"center"});
    csub.textContent="SNAP IN";
    cc.appendChild(countdownEl); cc.appendChild(csub);
    stage.appendChild(cc);

    // Right — webcam mirror
    const rw = _panel("rgba(52,211,153,.4)","rgba(52,211,153,.18)","#030d09");
    mirrorCanvas = document.createElement("canvas");
    Object.assign(mirrorCanvas.style,{width:"100%",height:"100%",display:"block",transform:"scaleX(-1)"});
    rw.appendChild(mirrorCanvas);
    rw.appendChild(_badge("📸 YOU","#34d399","rgba(52,211,153,.4)"));
    stage.appendChild(rw);

    // Bottom
    const bottom = _el("div",{
      position:"relative",zIndex:"10",padding:"12px 18px 20px",
      display:"flex",gap:"12px",alignItems:"center",
      justifyContent:"center",flexWrap:"wrap",width:"100%",boxSizing:"border-box",
    });
    bottom.id="fs-bottom";
    overlay.appendChild(bottom);
    const hint=_el("div",{color:"#475569",fontSize:"13px",textAlign:"center",width:"100%"});
    hint.id="fs-hint";
    hint.textContent="🎭 Strike your best pose! Auto-snap in 7 seconds…";
    bottom.appendChild(hint);
  }

  function _show2DFallback() {
    if (!threeCanvas) return;
    const W=threeCanvas.clientWidth||380, H=threeCanvas.clientHeight||507;
    threeCanvas.width=W; threeCanvas.height=H;
    const ctx=threeCanvas.getContext("2d");
    ctx.fillStyle="#0a0015"; ctx.fillRect(0,0,W,H);
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle="#a78bfa";
    ctx.font="bold "+Math.round(W*.09)+"px 'Comic Sans MS',cursive";
    ctx.fillText("🤖",W/2,H/2-30);
    ctx.fillStyle="#64748b";
    ctx.font=Math.round(W*.045)+"px 'Comic Sans MS',cursive";
    ctx.fillText("3D loading…",W/2,H/2+45);
  }

  /* ---- WEBCAM ----------------------------------------------- */
  function _startWebcam() {
    videoEl=document.createElement("video");
    videoEl.autoplay=videoEl.playsInline=videoEl.muted=true;
    videoEl.style.display="none";
    document.body.appendChild(videoEl);
    navigator.mediaDevices.getUserMedia({video:{width:640,height:480}})
      .then(function(s){ videoEl.srcObject=s; videoEl.play(); })
      .catch(function(err){
        console.warn("[FeedbackSystem] No webcam:",err.message);
        if(!mirrorCanvas) return;
        mirrorCanvas.width=300; mirrorCanvas.height=400;
        const c=mirrorCanvas.getContext("2d");
        c.fillStyle="#0a0015"; c.fillRect(0,0,300,400);
        c.fillStyle="#475569"; c.font="15px 'Comic Sans MS'"; c.textAlign="center";
        c.fillText("📷 No camera",150,190); c.fillText("(avatar still moves!)",150,215);
      });
  }

  /* ---- THREE.JS SCENE --------------------------------------- */
  function _initThree() {
    if (!T) return;
    const W=threeCanvas.clientWidth||380, H=threeCanvas.clientHeight||507;
    renderer=new T.WebGLRenderer({canvas:threeCanvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(W,H,false);
    if (renderer.outputColorSpace!==undefined) renderer.outputColorSpace=T.SRGBColorSpace;
    else renderer.outputEncoding=T.sRGBEncoding;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.2;

    scene=new T.Scene();
    scene.background=new T.Color(0x050211);
    scene.fog=new T.FogExp2(0x050211,0.055);

    camera=new T.PerspectiveCamera(28,W/H,0.1,100);
    camera.position.set(0,1.3,4.5);
    camera.lookAt(0,1.2,0);

    scene.add(new T.AmbientLight(0xffffff,0.55));
    const key=new T.DirectionalLight(0xa78bfa,1.5); key.position.set(1,3,2); scene.add(key);
    const fill=new T.PointLight(0x34d399,0.9,9); fill.position.set(-2,1.2,1); scene.add(fill);
    const rim=new T.DirectionalLight(0x7c3aed,0.45); rim.position.set(-1,2,-3); scene.add(rim);
    scene.add(new T.GridHelper(6,22,0x7c3aed,0x180840));

    const gp=new T.Mesh(
      new T.PlaneGeometry(3.5,3.5),
      new T.MeshBasicMaterial({color:0x7c3aed,transparent:true,opacity:.06,side:T.DoubleSide})
    );
    gp.rotation.x=-Math.PI/2; gp.position.y=0.01; scene.add(gp);
    clock.last=performance.now();
  }

  /* ---- AVATAR ----------------------------------------------- */
  function _loadAvatar() {
    // three-vrm v0.x UMD API
    if (!T || !GLTFLoaderCls) { _buildPuppet(); return; }
    var loader = new THREE.GLTFLoader();
loader.load(
  opts.avatarPath,

  function (gltf) {
    console.log("GLTF loaded");

    if (window.THREE_VRM && window.THREE_VRM.VRM) {
      window.THREE_VRM.VRM.from(gltf)
        .then(function (v) {
          console.log("VRM parsed ✅");

          vrm = v;
          vrm.scene.rotation.y = Math.PI;
          scene.add(vrm.scene);
        })
        .catch(function (err) {
          console.error("VRM parse failed ❌", err);
          _buildPuppet();
        });

    } else {
      console.warn("No VRM lib → fallback");
      _buildPuppet();
    }
  },

  function (progress) {
    console.log("Loading:", (progress.loaded / progress.total * 100).toFixed(2) + "%");
  },

  function (error) {
    console.error("LOAD FAILED ❌", error);
    _buildPuppet();
  }
);
  }

  /* ---- PUPPET ----------------------------------------------- */
  function _buildPuppet() {
    if(!T||!scene) return;
    puppet=new T.Group(); scene.add(puppet);
    const bM=new T.MeshPhongMaterial({color:0xa78bfa,emissive:0x3b0070,shininess:80,transparent:true,opacity:.93});
    const aM=new T.MeshPhongMaterial({color:0x34d399,emissive:0x003322,shininess:120});
    const hM=new T.MeshPhongMaterial({color:0xfde68a,emissive:0x5a3a00,shininess:60});
    const eM=new T.MeshPhongMaterial({color:0x0f172a});
    function mk(geo,mat,x,y,z){ const m=new T.Mesh(geo,mat); m.position.set(x,y,z); puppet.add(m); return m; }
    pBones.head =mk(new T.SphereGeometry(.145,16,12),hM,0,1.68,0);
    pBones.eyeL =mk(new T.SphereGeometry(.03,8,6),eM,-.058,1.685,.125);
    pBones.eyeR =mk(new T.SphereGeometry(.03,8,6),eM,.058,1.685,.125);
                 mk(new T.CylinderGeometry(.057,.063,.18,10),bM,0,1.49,0);
    pBones.torso=mk(new T.BoxGeometry(.43,.60,.21),bM,0,1.09,0);
                 mk(new T.BoxGeometry(.39,.27,.19),bM,0,.73,0);
    pBones.shL  =mk(new T.SphereGeometry(.077,10,8),aM,-.27,1.29,0);
    pBones.shR  =mk(new T.SphereGeometry(.077,10,8),aM,.27,1.29,0);
    pBones.uAL  =mk(new T.CylinderGeometry(.046,.041,.33,8),bM,-.38,1.09,0);
    pBones.uAR  =mk(new T.CylinderGeometry(.046,.041,.33,8),bM,.38,1.09,0);
    pBones.elL  =mk(new T.SphereGeometry(.052,8,6),aM,-.38,.88,0);
    pBones.elR  =mk(new T.SphereGeometry(.052,8,6),aM,.38,.88,0);
    pBones.fAL  =mk(new T.CylinderGeometry(.039,.033,.31,8),bM,-.38,.67,0);
    pBones.fAR  =mk(new T.CylinderGeometry(.039,.033,.31,8),bM,.38,.67,0);
    pBones.wL   =mk(new T.BoxGeometry(.105,.105,.065),aM,-.38,.48,0);
    pBones.wR   =mk(new T.BoxGeometry(.105,.105,.065),aM,.38,.48,0);
                 mk(new T.CylinderGeometry(.066,.051,.60,10),bM,-.14,.29,0);
                 mk(new T.CylinderGeometry(.066,.051,.60,10),bM,.14,.29,0);
                 mk(new T.SphereGeometry(.071,8,6),aM,-.14,-.01,0);
                 mk(new T.SphereGeometry(.071,8,6),aM,.14,-.01,0);
                 mk(new T.BoxGeometry(.11,.072,.23),aM,-.14,-.31,.04);
                 mk(new T.BoxGeometry(.11,.072,.23),aM,.14,-.31,.04);
    pBones.ring =mk(new T.TorusGeometry(.29,.018,8,42),new T.MeshBasicMaterial({color:0x7c3aed,transparent:true,opacity:.55}),0,0,0);
    pBones.ring.rotation.x=Math.PI/2;
    puppet.position.y=0.18;
    console.info("[FeedbackSystem] Puppet built ✅");
  }

  /* ---- HOLISTIC --------------------------------------------- */
  function _startHolistic() {
    if (typeof Holistic==="undefined") return;
    holisticInst=new Holistic({
      locateFile:function(f){ return "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/"+f; }
    });
    holisticInst.setOptions({
      modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,
      refineFaceLandmarks:false,minDetectionConfidence:.5,minTrackingConfidence:.5,
    });
    holisticInst.onResults(function(results){
      poseData=results.poseLandmarks||null;
      _drawMirror(results);
    });
    (function tryStart(){
      if(!videoEl||videoEl.readyState<2){ setTimeout(tryStart,300); return; }
      if(typeof Camera!=="undefined"){
        new Camera(videoEl,{
          onFrame:async function(){ if(videoEl.readyState>=2) await holisticInst.send({image:videoEl}); },
          width:640,height:480,
        }).start();
      }
    })();
  }

  function _drawMirror(results) {
    if(!mirrorCanvas||!videoEl||videoEl.readyState<2) return;
    const W=mirrorCanvas.clientWidth||380, H=mirrorCanvas.clientHeight||507;
    if(mirrorCanvas.width!==W||mirrorCanvas.height!==H){mirrorCanvas.width=W;mirrorCanvas.height=H;}
    const ctx=mirrorCanvas.getContext("2d");
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(videoEl,0,0,W,H);
    if(typeof drawConnectors!=="undefined"){
      if(results.poseLandmarks){
        drawConnectors(ctx,results.poseLandmarks,POSE_CONNECTIONS,{color:"rgba(52,211,153,.7)",lineWidth:3});
        drawLandmarks(ctx,results.poseLandmarks,{color:"#34d399",lineWidth:1.5,radius:3.5});
      }
      if(results.leftHandLandmarks)
        drawConnectors(ctx,results.leftHandLandmarks,HAND_CONNECTIONS,{color:"rgba(167,139,250,.85)",lineWidth:2.5});
      if(results.rightHandLandmarks)
        drawConnectors(ctx,results.rightHandLandmarks,HAND_CONNECTIONS,{color:"rgba(251,191,36,.85)",lineWidth:2.5});
    }
  }

  /* ---- POSE → AVATAR ---------------------------------------- */
  function _applyPose(delta) {
    const k=Math.min(1,delta*.009);
    if(poseData&&poseData.length>=17){
      const p=poseData;
      const m=function(i){ return p[i]?{x:1-p[i].x,y:1-p[i].y}:null; };
      if(p[0]&&p[7]&&p[8]){
        smooth.headY+=((p[0].x-(p[7].x+p[8].x)/2)*3-smooth.headY)*k;
        smooth.headX+=((p[0].y-.45)*-1.4-smooth.headX)*k;
      }
      const lSh=m(12),lEl=m(14),lWr=m(16),rSh=m(11),rEl=m(13),rWr=m(15);
      if(lSh&&lEl) smooth.lShoulderAngle+=(Math.atan2(lEl.y-lSh.y,lEl.x-lSh.x)-smooth.lShoulderAngle)*k;
      if(rSh&&rEl) smooth.rShoulderAngle+=(Math.atan2(rEl.y-rSh.y,rEl.x-rSh.x)-smooth.rShoulderAngle)*k;
      if(lEl&&lWr) smooth.lElbowAngle+=((lWr.y-lEl.y)*2-smooth.lElbowAngle)*k;
      if(rEl&&rWr) smooth.rElbowAngle+=((rWr.y-rEl.y)*2-smooth.rElbowAngle)*k;
      if(lWr){smooth.lWristX+=((lWr.x-.5)*.8-smooth.lWristX)*k;smooth.lWristY+=((lWr.y-.8)*-.8-smooth.lWristY)*k;}
      if(rWr){smooth.rWristX+=((rWr.x-.5)*.8-smooth.rWristX)*k;smooth.rWristY+=((rWr.y-.8)*-.8-smooth.rWristY)*k;}
      if(p[11]&&p[12]&&p[23]&&p[24])
        smooth.spineY+=((((p[11].y+p[12].y)/2-(p[23].y+p[24].y)/2)*-.5)-smooth.spineY)*k;
    }

    // VRM (v0.x API)
    if(vrm&&vrm.humanoid){
      function bn(n){ return vrm.humanoid.getBoneNode?vrm.humanoid.getBoneNode(n):null; }
      function rot(n,x,y,z){const b=bn(n);if(!b)return;if(x!==null)b.rotation.x=x;if(y!==null)b.rotation.y=y;if(z!==null)b.rotation.z=z;}
      rot("head",smooth.headX,smooth.headY,null);
      rot("neck",null,smooth.headY*.38,null);
      rot("spine",null,null,smooth.spineY);
      rot("hips",null,null,smooth.spineY*.28);
      rot("leftUpperArm",null,null,smooth.lShoulderAngle+Math.PI/2);
      rot("rightUpperArm",null,null,smooth.rShoulderAngle-Math.PI/2);
      rot("leftLowerArm",null,null,smooth.lElbowAngle);
      rot("rightLowerArm",null,null,smooth.rElbowAngle);
      if(vrm.update) vrm.update(delta/1000);
      return;
    }

    // Puppet
    if(!puppet||!pBones.head) return;
    const t=performance.now()*.001, PI2=Math.PI/2;
    pBones.head.rotation.y=smooth.headY; pBones.head.rotation.x=smooth.headX;
    if(pBones.torso) pBones.torso.rotation.z=smooth.spineY*.48;
    function _arm(uA,el,fA,w,sA,eA,wX,wY,sx){
      if(!uA) return;
      uA.rotation.z=sA+PI2*sx;
      const bY=uA.position.y-.2, ox=Math.sin(sA)*.33;
      if(el) el.position.set(uA.position.x+ox,bY,0);
      if(fA){fA.position.y=bY-.10;fA.rotation.z=eA;}
      if(w)  w.position.set(uA.position.x+wX*.2,bY-.27+wY*.3,0);
    }
    _arm(pBones.uAL,pBones.elL,pBones.fAL,pBones.wL,smooth.lShoulderAngle,smooth.lElbowAngle,smooth.lWristX,smooth.lWristY, 1);
    _arm(pBones.uAR,pBones.elR,pBones.fAR,pBones.wR,smooth.rShoulderAngle,smooth.rElbowAngle,smooth.rWristX,smooth.rWristY,-1);
    if(pBones.ring){pBones.ring.rotation.z=t*1.1;const s=1+Math.sin(t*2.1)*.055;pBones.ring.scale.set(s,s,1);}
    const blink=Math.sin(t*.85)>.972;
    if(pBones.eyeL) pBones.eyeL.scale.y=blink?.08:1;
    if(pBones.eyeR) pBones.eyeR.scale.y=blink?.08:1;
  }

  /* ---- COUNTDOWN -------------------------------------------- */
  function _startCountdown(){
    countdownVal=7;
    cdInterval=setInterval(function(){
      countdownVal--;
      if(countdownEl){
        countdownEl.textContent=countdownVal>0?countdownVal:"📸";
        if(countdownVal<=3&&countdownVal>0){
          countdownEl.style.background="conic-gradient(#ef4444 0%,#f87171 100%)";
          countdownEl.style.boxShadow="0 0 55px rgba(239,68,68,.95)";
        }
      }
      if(countdownVal<=0){clearInterval(cdInterval);_takeScreenshot();}
    },1000);
  }

  /* ---- SCREENSHOT ------------------------------------------- */
  function _takeScreenshot(){
    const flash=_el("div",{position:"fixed",inset:"0",background:"white",zIndex:"999999",pointerEvents:"none",animation:"fsFlash .5s ease forwards"});
    document.body.appendChild(flash);
    setTimeout(function(){flash.parentNode&&flash.parentNode.removeChild(flash);},600);

    shotCanvas=document.createElement("canvas");
    const pad=18,lblH=62;
    const tcW=threeCanvas.clientWidth||380,tcH=threeCanvas.clientHeight||507;
    const mcW=mirrorCanvas.clientWidth||380,mcH=mirrorCanvas.clientHeight||507;
    const W=tcW+mcW+pad*3, H=Math.max(tcH,mcH)+pad*2+lblH;
    shotCanvas.width=W; shotCanvas.height=H;
    const ctx=shotCanvas.getContext("2d");
    const bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,"#0d0221"); bg.addColorStop(1,"#07091a");
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    try{ctx.drawImage(threeCanvas,pad,pad,tcW,tcH);}catch(e){}
    try{ctx.save();ctx.translate(pad*2+tcW+mcW,pad);ctx.scale(-1,1);ctx.drawImage(mirrorCanvas,0,0,mcW,mcH);ctx.restore();}catch(e){}
    const ly=H-lblH+8;
    ctx.fillStyle="rgba(255,255,255,.04)"; ctx.fillRect(0,ly,W,lblH);
    ctx.font="bold "+Math.round(W*.022)+"px 'Comic Sans MS',cursive";
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#a78bfa";
    ctx.fillText("⭐ Score: "+opts.score+"  🔥 Best Streak: "+opts.streak+"  ✨ Galaxy Mind Game",W/2,ly+lblH/2);
    ctx.strokeStyle="rgba(124,58,237,.5)"; ctx.lineWidth=2; ctx.strokeRect(pad,pad,tcW,tcH);
    ctx.strokeStyle="rgba(52,211,153,.45)"; ctx.strokeRect(pad*2+tcW,pad,mcW,mcH);
    _showPostShotUI();
  }

  function _showPostShotUI(){
    var hint=document.getElementById("fs-hint");
    if(hint&&hint.parentNode) hint.parentNode.removeChild(hint);
    if(countdownEl){
      countdownEl.style.animation="none"; countdownEl.textContent="✅";
      countdownEl.style.background="conic-gradient(#34d399 0%,#a78bfa 100%)";
      countdownEl.style.boxShadow="0 0 55px rgba(52,211,153,.85)";
    }
    var bottom=document.getElementById("fs-bottom");
    if(!bottom) return;
    const taken=_el("div",{width:"100%",textAlign:"center",color:"#34d399",fontSize:"19px",letterSpacing:"2px",animation:"fsSlideUp .35s ease",textShadow:"0 0 22px rgba(52,211,153,.85)"});
    taken.textContent="✅ Photo captured! Save your cosmic moment!";
    bottom.appendChild(taken);
    bottom.appendChild(_btn("⬇️ Download Photo","#34d399","rgba(52,211,153,.13)","fsBtnGlow",_downloadShot));
    bottom.appendChild(_btn("🚀 Play Again","#a78bfa","rgba(124,58,237,.15)","",function(){
      destroy();
      document.dispatchEvent(new CustomEvent("feedbackSystemClosed"));
    }));
  }

  function _btn(text,color,bg,anim,onClick){
    const b=_el("button",{
      padding:"13px 28px",borderRadius:"50px",border:"2px solid "+color,background:bg,
      color:color,fontSize:"16px",fontFamily:"'Comic Sans MS',cursive",cursor:"pointer",
      letterSpacing:"1px",
      animation:"fsSlideUp .4s ease"+(anim?", "+anim+" 2s ease infinite":""),
      transition:"transform .15s, background .15s",
    });
    b.textContent=text;
    b.onmouseenter=function(){b.style.transform="scale(1.06)";};
    b.onmouseleave=function(){b.style.transform="scale(1)";};
    b.onclick=onClick;
    return b;
  }

  function _downloadShot(){
    if(!shotCanvas) return;
    const a=document.createElement("a");
    a.href=shotCanvas.toDataURL("image/png");
    a.download="galaxy-mind-"+Date.now()+".png";
    a.click();
  }

  /* ---- LOOP ------------------------------------------------- */
  function _loop(){
    if(!launched) return;
    animId=requestAnimationFrame(_loop);
    const now=performance.now(), delta=Math.min(now-clock.last,50);
    clock.last=now;
    if(camera){ camera.position.x=Math.sin(now*.00025)*.25; camera.lookAt(0,1.2,0); }
    _applyPose(delta);
    if(renderer&&scene&&camera) renderer.render(scene,camera);
    if(videoEl&&videoEl.readyState>=2&&!holisticInst&&mirrorCanvas){
      if(!mirrorCanvas.width){mirrorCanvas.width=mirrorCanvas.clientWidth||380;mirrorCanvas.height=mirrorCanvas.clientHeight||507;}
      mirrorCanvas.getContext("2d").drawImage(videoEl,0,0,mirrorCanvas.width,mirrorCanvas.height);
    }
  }

  return { launch:launch, destroy:destroy };
})();