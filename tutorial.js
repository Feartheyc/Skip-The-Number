/* ============================================================
   tutorial.js  — Themed tutorial overlays for Game1, Game9, Game10

   ISOLATION GUARANTEES:
   • Tutorial.show(gameId, modeKey, onStart)
       gameId must be "game1" | "game9" | "game10" to get a tutorial.
   • Tutorial.showNoFingerPrompt(gameId)
       Only shows if gameId is one of the three supported games,
       AND matches the currently active prompt game.
       Safe to call for every game — silently no-ops for others.
   • Tutorial.hideNoFingerPrompt(gameId)  — mirrors above
   • Tutorial.destroyNoFingerPrompt()     — full DOM cleanup

   Game themes:
     game1  — dark deep-space ring  (mirrors Game1.C palette)
     game9  — dreamy pastel gradient (mirrors Game9 dream bg)
     game10 — cosmic dark minimal   (mirrors Game10 T.space)
============================================================ */

const Tutorial = (() => {

  /* ══════════════════════════════════════════════════════════
     PALETTES  — each mirrors its game exactly
  ══════════════════════════════════════════════════════════ */
  const PAL = {
    game1: {
      bg1: "#1a2d4a", bg2: "#0f1e35", bg3: "#080f1c",
      surface: "rgba(8,18,36,0.96)",
      border:  "rgba(140,180,220,0.22)",
      text:    "#f0f4ff", muted: "#8ecae6",
      correct: "#6de8b4", wrong: "#e87c6d",
      gold:    "#f5c842", accent: "#8ecae6", purple: "#c084fc",
      star:    "#c8dff0", font: "'Trebuchet MS', sans-serif",
      promptBg: "rgba(8,18,36,0.93)",
      promptBorder: "rgba(245,200,66,0.45)",
      promptGlow:   "rgba(245,200,66,0.22)",
    },
    game9: {
      bg1: "#60A5FA", bg2: "#A78BFA", bg3: "#F472B6",
      surface: "rgba(30,10,55,0.90)",
      border:  "rgba(253,224,71,0.45)",
      text:    "#ffffff", muted: "#fde047",
      correct: "#34d399", wrong: "#f87171",
      gold:    "#fbbf24", accent: "#a78bfa", purple: "#f472b6",
      star:    "#ffffff", font: "'Comic Sans MS', cursive",
      promptBg: "rgba(30,10,55,0.93)",
      promptBorder: "rgba(253,224,71,0.55)",
      promptGlow:   "rgba(253,224,71,0.22)",
    },
    game10: {
      bg1: "#0a0e27", bg2: "#1a1040", bg3: "#0d1f3c",
      surface: "rgba(18,12,46,0.96)",
      border:  "rgba(124,58,237,0.35)",
      text:    "#e2e8f0", muted: "#a78bfa",
      correct: "#34d399", wrong: "#f87171",
      gold:    "#fbbf24", accent: "#7c3aed", purple: "#a78bfa",
      star:    "#ffffff", font: "'Fredoka', 'Trebuchet MS', sans-serif",
      promptBg: "rgba(10,8,30,0.93)",
      promptBorder: "rgba(124,58,237,0.55)",
      promptGlow:   "rgba(124,58,237,0.22)",
    },
  };

  /* ── No-finger copy per game ─────────────────────────────── */
  const NF_COPY = {
    game1:  "☝ Show your index finger to play!",
    game9:  "☝ Raise your finger — the mascot needs you!",
    game10: "☝ Raise your index finger to navigate the galaxy!",
  };

  /* ══════════════════════════════════════════════════════════
     GAME 1 — mode tutorial data
  ══════════════════════════════════════════════════════════ */
  const G1 = {
    default: {
      title: "SKIP MODE", icon: "⟳", color: "#6de8b4",
      tagline: "Like Mario coins — but only collect every Nth one!",
      rules: [
        { icon: "👆", text: "Your index finger IS the green dot on screen" },
        { icon: "🎯", text: "Numbers fly in from the ring toward center" },
        { icon: "✅", text: "Touch ONLY multiples (e.g. 3, 6, 9 for Skip 3)" },
        { icon: "❌", text: "Wrong touch = lost points + speed penalty" },
        { icon: "🔥", text: "5-combo streak multiplies your score!" },
      ],
      visual: "skip",
    },
    pattern: {
      title: "PATTERN MODE", icon: "◈", color: "#8ecae6",
      tagline: "Like Guitar Hero — hit the right notes in rhythm!",
      rules: [
        { icon: "👆", text: "Your index finger IS the green dot on screen" },
        { icon: "🎶", text: "Numbers appear in a repeating skip-collect cycle" },
        { icon: "⏭️", text: "SKIP a set, then COLLECT a set — repeat" },
        { icon: "🧠", text: "E.g. Skip 2, Collect 3 → ✗✗✓✓✓ then repeat" },
        { icon: "⚡", text: "Pattern resets every cycle — stay sharp!" },
      ],
      visual: "pattern",
    },
    cannon: {
      title: "CANNON MODE", icon: "▲", color: "#f5c842",
      tagline: "Like Space Invaders — zap the right ones before escape!",
      rules: [
        { icon: "👆", text: "Your index finger IS the green dot on screen" },
        { icon: "💥", text: "The cannon fires numbers across the screen" },
        { icon: "✅", text: "Touch correct multiples before they fly off screen" },
        { icon: "🚀", text: "Wrong touch = combo reset + speed penalty" },
        { icon: "⚠️", text: "Correct number escaping = score deduction!" },
      ],
      visual: "cannon",
    },
    orb: {
      title: "ORB MODE", icon: "◉", color: "#c084fc",
      tagline: "Like Metroid's orb — intercept numbers mid-flight!",
      rules: [
        { icon: "👆", text: "Your index finger IS the green dot on screen" },
        { icon: "🌀", text: "A spinning orb launches numbers outward" },
        { icon: "🎯", text: "Intercept the correct numbers as they fly past" },
        { icon: "💜", text: "Orb rotates to aim — anticipate direction" },
        { icon: "⚡", text: "Precision matters — react fast!" },
      ],
      visual: "orb",
    },
    triple: {
      title: "TRIPLE CANNON", icon: "⟁", color: "#e87c6d",
      tagline: "Like Galaga with 3 ships — pure chaos, total skill!",
      rules: [
        { icon: "👆", text: "Your index finger IS the green dot on screen" },
        { icon: "🔴", text: "THREE cannons fire in random order" },
        { icon: "👀", text: "Gold glow = that cannon fires next" },
        { icon: "🎯", text: "Intercept correct numbers from all directions" },
        { icon: "🌀", text: "Number paths cross — stay focused!" },
      ],
      visual: "triple",
    },
  };

  /* ══════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════ */
  let overlay = null, canvas = null, ctx = null, raf = null;
  let _onStart = null, _gameId = "", _modeKey = "default";
  let stars = [], lastTime = 0;
  let enterAnim = 0, exitAnim = -1, exitStarted = false;
  let holdProgress = 0, particlesH = [], confetti = [];
  let pulseT = 0, orbT = 0;
  let fingerX = -999, fingerY = -999;
  let noFingEl = null, noFingVisible = false, noFingGameId = "";

  const HOLD_SEC = 3.0, FING_R = 28;

  /* ── Helpers ─────────────────────────────────────────────── */
  const easeOut = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  function hr(hex) {
    const h = (hex || "").replace("#", "");
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return isNaN(r) ? "140,180,220" : `${r},${g},${b}`;
  }
  const cW  = () => canvas ? canvas.width  / (window.devicePixelRatio || 1) : window.innerWidth;
  const cH  = () => canvas ? canvas.height / (window.devicePixelRatio || 1) : window.innerHeight;
  const ccx = () => cW() / 2;
  const ccy = () => cH() / 2;
  const getLiveFingers = () => (window.fingerPositions || []).slice(0, 1);

  /* ── Stars ───────────────────────────────────────────────── */
  function initStars(pal) {
    const w = window.innerWidth, h = window.innerHeight;
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.round(Math.random() * w),
        y: Math.round(Math.random() * h),
        r: 0.5 + Math.random() * 1.4,
        a: 0.1 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
        ts: 0.012 + Math.random() * 0.018,
        col: pal.star,
      });
    }
  }

  /* ── Background ──────────────────────────────────────────── */
  function drawBg(pal, alpha) {
    const w = cW(), h = cH(), cx = ccx(), cy = ccy();
    if (_gameId === "game9") {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#60A5FA"); g.addColorStop(0.5, "#A78BFA"); g.addColorStop(1, "#F472B6");
      ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
      glow.addColorStop(0, "rgba(255,255,255,0.14)"); glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    } else {
      const g = ctx.createRadialGradient(cx, cy * 0.6, 0, cx, h * 0.5, Math.max(w,h) * 0.75);
      g.addColorStop(0, pal.bg1); g.addColorStop(0.5, pal.bg2); g.addColorStop(1, pal.bg3);
      ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      if (_gameId === "game10") {
        const ag = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy * 0.7, w * 0.55);
        ag.addColorStop(0, "rgba(124,58,237,0.12)"); ag.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ag; ctx.fillRect(0, 0, w, h);
      }
    }
    for (const s of stars) {
      s.tw += s.ts;
      ctx.globalAlpha = alpha * Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ── Finger legend ───────────────────────────────────────── */
  function fingerLegend(pal, x, y) {
    ctx.beginPath(); ctx.arc(x - 46, y, 8, 0, Math.PI*2);
    ctx.fillStyle = "rgba(94,180,150,0.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x - 46, y, 4, 0, Math.PI*2);
    ctx.fillStyle = "#b0f0da"; ctx.fill();
    ctx.fillStyle = "rgba(140,180,220,0.65)";
    ctx.font = `11px ${pal.font}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("= your index finger", x - 36, y);
  }

  /* ══════════════════════════════════════════════════════════
     GAME 1 — mode visuals
  ══════════════════════════════════════════════════════════ */
  function drawG1Visual(mode, pal, px, py, pw, ph, t) {
    ctx.save(); ctx.translate(px, py);
    if (mode === "skip") {
      const r = Math.min(pw, ph) * 0.36;
      ctx.strokeStyle = "rgba(212,164,74,0.7)"; ctx.lineWidth = 3;
      ctx.shadowColor = pal.gold; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(pw/2, ph/2, r, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = "rgba(126,207,179,0.35)"; ctx.lineWidth = 2; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(pw/2, ph/2, r*0.72, 0, Math.PI*2); ctx.stroke();
      const notes = [
        {angle:0.4, dist:1.0, val:3, c:true}, {angle:1.8, dist:0.75, val:5, c:false},
        {angle:3.5, dist:0.9, val:6, c:true},  {angle:5.0, dist:0.6, val:7, c:false},
      ];
      for (const n of notes) {
        const prog = ((t*0.38 + n.dist) % 1.0);
        const d = r*1.65*(1 - prog*0.6);
        const nx = pw/2+Math.cos(n.angle)*d, ny = ph/2+Math.sin(n.angle)*d;
        ctx.beginPath(); ctx.arc(nx, ny, 15, 0, Math.PI*2);
        ctx.fillStyle = n.c ? "#0e3028" : "#2a1010";
        ctx.shadowColor = n.c ? pal.correct : pal.wrong; ctx.shadowBlur = 12; ctx.fill();
        ctx.strokeStyle = n.c ? pal.correct : pal.wrong; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = "#f0f4ff"; ctx.font = `bold 11px ${pal.font}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.val, nx, ny);
      }
      ctx.beginPath(); ctx.arc(pw/2, ph/2, 10, 0, Math.PI*2);
      ctx.fillStyle = "rgba(94,180,150,0.4)"; ctx.shadowColor = pal.correct; ctx.shadowBlur = 18; ctx.fill();
      ctx.beginPath(); ctx.arc(pw/2, ph/2, 5, 0, Math.PI*2);
      ctx.fillStyle = "#b0f0da"; ctx.fill(); ctx.shadowBlur = 0;
      fingerLegend(pal, pw/2, ph - 12);

    } else if (mode === "pattern") {
      const nums=[1,2,3,4,5,6,7,8], skip=2, collect=3, cycle=skip+collect;
      const bW=28, bH=28, gap=5, totalW=nums.length*(bW+gap)-gap;
      const sX=(pw-totalW)/2, bY=ph/2-8;
      for (let i=0; i<nums.length; i++) {
        const isC=(i%cycle)>=skip, bx=sX+i*(bW+gap);
        ctx.beginPath(); ctx.roundRect(bx, bY, bW, bH, 5);
        ctx.fillStyle = isC?"#0e3028":"#0a1525"; ctx.fill();
        ctx.strokeStyle = isC?pal.correct:"rgba(140,180,220,0.3)"; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle="#f0f4ff"; ctx.font=`bold 11px ${pal.font}`;
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(nums[i],bx+bW/2,bY+bH/2);
      }
      ctx.font=`10px ${pal.font}`; ctx.textAlign="center";
      ctx.fillStyle="rgba(232,124,109,0.85)";
      ctx.fillText("← SKIP 2 →", sX+(skip*(bW+gap))/2-gap/2, bY-11);
      ctx.fillStyle="rgba(109,232,180,0.85)";
      ctx.fillText("← COLLECT 3 →", sX+skip*(bW+gap)+(collect*(bW+gap))/2-gap/2, bY-11);
      ctx.strokeStyle="rgba(140,180,220,0.35)"; ctx.lineWidth=1.5;
      const rX=sX+totalW+8, rY=bY+bH/2;
      ctx.beginPath(); ctx.moveTo(rX, rY-8); ctx.arcTo(rX+12,rY-8,rX+12,rY+8,8);
      ctx.arcTo(rX+12,rY+8,sX-8,rY+8,8); ctx.lineTo(sX-8,rY+8); ctx.stroke();
      fingerLegend(pal, pw/2, ph-12);

    } else if (mode === "cannon") {
      const cnx=pw/2, cny=ph/2+8, ang=-0.6+Math.sin(t*0.5)*0.3;
      ctx.beginPath(); ctx.arc(cnx,cny,20,0,Math.PI*2);
      ctx.fillStyle="#2a4a6e"; ctx.shadowColor=pal.accent; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0;
      ctx.save(); ctx.translate(cnx,cny); ctx.rotate(ang-Math.PI/2);
      ctx.fillStyle="#3a6080"; ctx.beginPath(); ctx.roundRect(-7,-38,14,38,3); ctx.fill();
      ctx.strokeStyle=pal.accent; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
      const flyT=(t*0.5)%1;
      const fnx=cnx+Math.cos(ang)*(28+flyT*70), fny=cny+Math.sin(ang)*(28+flyT*70);
      ctx.beginPath(); ctx.arc(fnx,fny,14,0,Math.PI*2);
      ctx.fillStyle="#0e3028"; ctx.shadowColor=pal.correct; ctx.shadowBlur=10; ctx.fill();
      ctx.strokeStyle=pal.correct; ctx.lineWidth=2; ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle="#f0f4ff"; ctx.font=`bold 11px ${pal.font}`;
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("6",fnx,fny);
      ctx.strokeStyle="rgba(232,124,109,0.22)"; ctx.lineWidth=1; ctx.setLineDash([4,6]);
      ctx.strokeRect(12,12,pw-24,ph-28); ctx.setLineDash([]);
      ctx.font=`10px ${pal.font}`; ctx.fillStyle="rgba(232,124,109,0.6)";
      ctx.textAlign="center"; ctx.fillText("⚠ escape zone",pw/2,ph-14);
      fingerLegend(pal, pw/2, ph-4);

    } else if (mode === "orb") {
      const orx=pw/2, ory=ph/2, oA=t*0.8;
      const og=ctx.createRadialGradient(orx,ory,0,orx,ory,28);
      og.addColorStop(0,"rgba(192,132,252,0.5)"); og.addColorStop(1,"rgba(14,30,50,0)");
      ctx.fillStyle=og; ctx.beginPath(); ctx.arc(orx,ory,28,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(orx,ory,18,0,Math.PI*2);
      ctx.fillStyle="#1a3a5c"; ctx.shadowColor=pal.purple; ctx.shadowBlur=14; ctx.fill();
      ctx.strokeStyle=pal.purple; ctx.lineWidth=2; ctx.stroke(); ctx.shadowBlur=0;
      const sR=50+Math.sin(t*1.2)*14;
      const snx=orx+Math.cos(oA)*sR, sny=ory+Math.sin(oA)*sR;
      ctx.beginPath(); ctx.arc(snx,sny,14,0,Math.PI*2);
      ctx.fillStyle="#0e3028"; ctx.shadowColor=pal.correct; ctx.shadowBlur=10; ctx.fill();
      ctx.strokeStyle=pal.correct; ctx.lineWidth=2; ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle="#f0f4ff"; ctx.font=`bold 11px ${pal.font}`;
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("9",snx,sny);
      ctx.strokeStyle="rgba(192,132,252,0.3)"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(orx,ory,30,oA+0.3,oA+Math.PI*1.2); ctx.stroke();
      fingerLegend(pal, pw/2, ph-12);

    } else if (mode === "triple") {
      const tcx=pw/2, tcy=ph/2, triR=Math.min(pw,ph)*0.28, gi=Math.floor(t*0.4)%3;
      for (let i=0; i<3; i++) {
        const a=(i/3)*Math.PI*2-Math.PI/2+t*0.18;
        const ox=tcx+Math.cos(a)*triR, oy=tcy+Math.sin(a)*triR;
        const isG=i===gi;
        const g2=ctx.createRadialGradient(ox,oy,0,ox,oy,20);
        g2.addColorStop(0,isG?"rgba(245,200,66,0.5)":"rgba(142,202,230,0.2)"); g2.addColorStop(1,"rgba(14,30,50,0)");
        ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(ox,oy,20,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(ox,oy,13,0,Math.PI*2);
        ctx.fillStyle="#1a3a5c"; ctx.shadowColor=isG?pal.gold:pal.accent; ctx.shadowBlur=isG?16:8; ctx.fill(); ctx.shadowBlur=0;
        ctx.strokeStyle=isG?pal.gold:"rgba(142,202,230,0.4)"; ctx.lineWidth=isG?2.5:1.5; ctx.stroke();
        if (isG) {
          const pulse=0.5+Math.sin(t*5)*0.3;
          ctx.strokeStyle=`rgba(245,200,66,${pulse})`; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(ox,oy,16+pulse*4,0,Math.PI*2); ctx.stroke();
        }
      }
      ctx.font=`10px ${pal.font}`; ctx.fillStyle=pal.gold;
      ctx.textAlign="center"; ctx.fillText("✦ glowing = fires next",pw/2,ph-14);
      fingerLegend(pal, pw/2, ph-4);
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════
     GAME 9 — dreamy ordinal door visual
  ══════════════════════════════════════════════════════════ */
  function drawG9Visual(pal, px, py, pw, ph, t) {
    ctx.save(); ctx.translate(px, py);
    const mx=pw/2, my=ph/2;

    // Soft backdrop
    const bg9=ctx.createRadialGradient(mx,my,0,mx,my,Math.min(pw,ph)*0.55);
    bg9.addColorStop(0,"rgba(253,224,71,0.14)"); bg9.addColorStop(1,"rgba(30,15,60,0)");
    ctx.fillStyle=bg9; ctx.beginPath(); ctx.arc(mx,my,Math.min(pw,ph)*0.55,0,Math.PI*2); ctx.fill();

    // Floating golden number (the pickup)
    const fY=my-48+Math.sin(t*1.4)*10;
    ctx.font="bold 50px 'Comic Sans MS', cursive";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.lineWidth=8; ctx.strokeStyle="#FFD700"; ctx.shadowColor="#FFD700"; ctx.shadowBlur=28;
    ctx.strokeText("7",mx,fY); ctx.shadowBlur=0;
    ctx.fillStyle="#FFFFFF"; ctx.fillText("7",mx,fY);
    // Orbiting sparkles
    for (let i=0; i<5; i++) {
      const sa=(Math.PI*2/5)*i+t*1.2;
      ctx.beginPath(); ctx.arc(mx+Math.cos(sa)*36, fY+Math.sin(sa)*16, 5, 0, Math.PI*2);
      ctx.fillStyle="#FFFACD"; ctx.fill();
    }

    // Mascot blob
    const mascotY=my+42, mR=28;
    const mg=ctx.createRadialGradient(mx-4,mascotY-4,0,mx,mascotY,mR);
    mg.addColorStop(0,"#c084fc"); mg.addColorStop(1,"#7c3aed");
    ctx.beginPath(); ctx.arc(mx,mascotY,mR,0,Math.PI*2);
    ctx.fillStyle=mg; ctx.shadowColor="#a78bfa"; ctx.shadowBlur=14; ctx.fill(); ctx.shadowBlur=0;
    // Eyes
    [[mx-9,mascotY-7],[mx+9,mascotY-7]].forEach(([ex,ey]) => {
      ctx.beginPath(); ctx.arc(ex,ey,4.5,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill();
      ctx.beginPath(); ctx.arc(ex+1,ey,2.2,0,Math.PI*2); ctx.fillStyle="#333"; ctx.fill();
    });
    // Smile
    ctx.beginPath(); ctx.arc(mx,mascotY+2,8,0.2,Math.PI-0.2);
    ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();

    // Dashed pickup line
    ctx.strokeStyle="rgba(253,224,71,0.55)"; ctx.lineWidth=2; ctx.setLineDash([4,5]);
    ctx.beginPath(); ctx.moveTo(mx,mascotY-mR-3); ctx.lineTo(mx,fY+18); ctx.stroke();
    ctx.setLineDash([]);

    // 4 small portal circles at bottom
    const portals=[
      {x:pw*0.15,y:ph*0.75,label:"st"},{x:pw*0.37,y:ph*0.82,label:"nd"},
      {x:pw*0.63,y:ph*0.82,label:"rd"},{x:pw*0.85,y:ph*0.75,label:"th"},
    ];
    for (const p of portals) {
      const pulse=0.85+Math.sin(t*2+p.x)*0.15;
      const pc=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,18*pulse);
      pc.addColorStop(0,"rgba(253,224,71,0.7)"); pc.addColorStop(0.5,"rgba(167,139,250,0.4)"); pc.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=pc; ctx.beginPath(); ctx.arc(p.x,p.y,18*pulse,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 12px 'Comic Sans MS',cursive";
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(p.label,p.x,p.y);
    }

    // Finger = mascot label
    ctx.beginPath(); ctx.arc(mx-46, my+42, 8, 0, Math.PI*2);
    ctx.fillStyle="rgba(94,180,150,0.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(mx-46, my+42, 4, 0, Math.PI*2);
    ctx.fillStyle="#b0f0da"; ctx.fill();
    ctx.fillStyle="rgba(253,224,71,0.7)"; ctx.font=`11px ${pal.font}`;
    ctx.textAlign="left"; ctx.textBaseline="middle";
    ctx.fillText("= controls mascot", mx-36, my+42);

    ctx.font=`10px ${pal.font}`; ctx.fillStyle="rgba(253,224,71,0.72)";
    ctx.textAlign="center"; ctx.fillText("carry it → right ordinal door!",mx,ph-8);
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════
     GAME 10 — cosmic portal collector visual
  ══════════════════════════════════════════════════════════ */
  function drawG10Visual(pal, px, py, pw, ph, t) {
    ctx.save(); ctx.translate(px, py);
    const mx=pw/2, my=ph/2;

    // Cosmic backdrop
    const bg10=ctx.createRadialGradient(mx,my,0,mx,my,Math.min(pw,ph)*0.6);
    bg10.addColorStop(0,"rgba(124,58,237,0.18)"); bg10.addColorStop(1,"rgba(10,14,39,0)");
    ctx.fillStyle=bg10; ctx.beginPath(); ctx.arc(mx,my,Math.min(pw,ph)*0.6,0,Math.PI*2); ctx.fill();
    // Mini stars
    ctx.fillStyle="rgba(255,255,255,0.55)";
    for (let i=0; i<20; i++) {
      const sx=(i*37.3)%pw, sy=(i*29.7)%ph;
      ctx.beginPath(); ctx.arc(sx,sy,0.8,0,Math.PI*2); ctx.fill();
    }

    // Portal (player) — glowing ring + label
    const bobY=my+Math.sin(t*2)*5, pR=28;
    const pg=ctx.createRadialGradient(mx,bobY,0,mx,bobY,pR*1.4);
    pg.addColorStop(0,"rgba(124,58,237,0.5)"); pg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(mx,bobY,pR*1.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx,bobY,pR,0,Math.PI*2);
    ctx.fillStyle="#1a1040"; ctx.shadowColor="#7c3aed"; ctx.shadowBlur=20; ctx.fill();
    ctx.strokeStyle="#a78bfa"; ctx.lineWidth=2.5; ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle="#fbbf24"; ctx.font="bold 13px 'Fredoka',cursive";
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("ST",mx,bobY);

    // Number cards scattered around portal
    const cards=[
      {x:pw*0.15,y:my-28,num:1, c:true}, {x:pw*0.80,y:my-20,num:4,c:false},
      {x:pw*0.22,y:my+40,num:21,c:true}, {x:pw*0.76,y:my+42,num:7,c:false},
    ];
    for (const card of cards) {
      const cr=22;
      ctx.save(); ctx.translate(card.x,card.y);
      ctx.fillStyle="rgba(255,255,255,0.07)";
      ctx.beginPath(); ctx.roundRect(-cr,-cr*0.7,cr*2,cr*1.4,8); ctx.fill();
      ctx.strokeStyle=card.c?pal.correct:"rgba(255,255,255,0.18)"; ctx.lineWidth=card.c?2:1;
      if (card.c) { ctx.shadowColor=pal.correct; ctx.shadowBlur=12; }
      ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle="#fbbf24"; ctx.font="bold 19px 'Fredoka',cursive";
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(card.num,0,0);
      ctx.restore();
    }
    // Suction trail to first correct card
    const sc=cards.find(c=>c.c);
    if (sc) {
      const prog=(t*0.5)%1;
      const lx=sc.x+(mx-sc.x)*prog, ly=sc.y+(bobY-sc.y)*prog;
      ctx.strokeStyle="rgba(52,211,153,0.38)"; ctx.lineWidth=1.5; ctx.setLineDash([4,6]);
      ctx.beginPath(); ctx.moveTo(sc.x,sc.y); ctx.lineTo(mx,bobY); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(lx,ly,7,0,Math.PI*2); ctx.fillStyle="#fbbf24"; ctx.fill();
      ctx.fillStyle="#000"; ctx.font="bold 7px 'Fredoka',cursive";
      ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("1",lx,ly);
    }

    // Finger legend
    ctx.beginPath(); ctx.arc(mx-46,bobY,8,0,Math.PI*2); ctx.fillStyle="rgba(94,180,150,0.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(mx-46,bobY,4,0,Math.PI*2); ctx.fillStyle="#b0f0da"; ctx.fill();
    ctx.fillStyle="rgba(167,139,250,0.75)"; ctx.font=`11px ${pal.font}`;
    ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.fillText("= controls the portal",mx-36,bobY);

    ctx.font=`10px ${pal.font}`; ctx.fillStyle="rgba(167,139,250,0.8)";
    ctx.textAlign="center"; ctx.fillText("Swallow only numbers ending in ST!",mx,ph-8);
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════
     HOLD RING
  ══════════════════════════════════════════════════════════ */
  function drawHoldRing(fx, fy, prog, col) {
    ctx.beginPath(); ctx.arc(fx,fy,FING_R+18,0,Math.PI*2);
    ctx.fillStyle=`rgba(${hr(col)},0.06)`; ctx.fill();
    ctx.beginPath(); ctx.arc(fx,fy,FING_R+10,0,Math.PI*2);
    ctx.strokeStyle=`rgba(${hr(col)},0.18)`; ctx.lineWidth=5; ctx.stroke();
    if (prog>0.01) {
      ctx.beginPath(); ctx.arc(fx,fy,FING_R+10,-Math.PI/2,-Math.PI/2+Math.PI*2*prog);
      ctx.strokeStyle=col; ctx.lineWidth=5;
      ctx.shadowColor=col; ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0;
    }
    for (const p of particlesH) {
      ctx.globalAlpha=p.life*0.8; ctx.fillStyle=col;
      ctx.shadowColor=col; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;
  }

  function spawnConfetti(fx, fy, pal) {
    const cols=[pal.gold,pal.correct,pal.accent,"#ffffff",pal.purple];
    for (let i=0; i<32; i++) {
      const a=Math.random()*Math.PI*2, v=160+Math.random()*200;
      confetti.push({x:fx,y:fy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:3+Math.random()*4,col:cols[i%cols.length],life:1});
    }
  }

  /* ══════════════════════════════════════════════════════════
     MAIN DRAW LOOP
  ══════════════════════════════════════════════════════════ */
  function draw(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now; pulseT += dt*1.8; orbT += dt;

    const pal    = PAL[_gameId] || PAL.game1;
    const g1data = _gameId === "game1" ? (G1[_modeKey] || G1.default) : null;
    const tColor = g1data ? g1data.color : pal.accent;

    let masterA;
    if (exitAnim >= 0) {
      exitAnim = Math.min(1, exitAnim + dt*3);
      masterA  = Math.max(0, 1 - exitAnim);
      if (exitAnim >= 1) { finish(); return; }
    } else {
      enterAnim = Math.min(1, enterAnim + dt*2);
      masterA   = easeOut(enterAnim);
    }

    const fingers = getLiveFingers();
    const hasFing = fingers.length > 0;
    if (hasFing) { fingerX = fingers[0].x; fingerY = fingers[0].y; }

    // Hold logic
    if (hasFing && exitAnim < 0) {
      holdProgress = Math.min(1, holdProgress + dt / HOLD_SEC);
      if (Math.random() < 0.4) {
        const a = Math.random()*Math.PI*2, d = (FING_R+10)+Math.random()*20;
        particlesH.push({x:fingerX+Math.cos(a)*d,y:fingerY+Math.sin(a)*d,life:1});
      }
      for (let i=particlesH.length-1; i>=0; i--) {
        const p=particlesH[i];
        p.x+=(fingerX-p.x)*0.1; p.y+=(fingerY-p.y)*0.1;
        p.life-=dt*1.4; if (p.life<=0) particlesH.splice(i,1);
      }
      if (holdProgress >= 1 && !exitStarted) {
        exitStarted = true;
        spawnConfetti(fingerX, fingerY, pal);
        setTimeout(() => { exitAnim = 0; }, 480);
      }
    } else {
      holdProgress = Math.max(0, holdProgress - dt*0.5);
      particlesH   = [];
    }
    for (let i=confetti.length-1; i>=0; i--) {
      const p=confetti[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.94; p.vy*=0.94; p.vy+=120*dt; p.life-=dt*1.2;
      if (p.life<=0) confetti.splice(i,1);
    }

    // Render
    const dpr=window.devicePixelRatio||1;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cW(),cH());
    drawBg(pal, masterA);

    const w=cW(), h=cH(), isMob=w<540;
    ctx.globalAlpha = masterA;

    // Card
    const cardW=Math.min(w-32, isMob?360:700);
    const cardH=Math.min(h-60, isMob?600:560);
    const cardX=ccx()-cardW/2, cardY=ccy()-cardH/2, cardR=20;

    ctx.shadowColor=tColor; ctx.shadowBlur=30;
    ctx.fillStyle=pal.surface;
    ctx.beginPath(); ctx.roundRect(cardX,cardY,cardW,cardH,cardR); ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle=`rgba(${hr(tColor)},0.38)`; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=`rgba(${hr(tColor)},0.16)`;
    ctx.beginPath(); ctx.roundRect(cardX,cardY,cardW,56,[cardR,cardR,0,0]); ctx.fill();

    // Header
    const iconStr  = g1data ? g1data.icon : (_gameId==="game9"?"🏠":"🌌");
    const titleStr = g1data ? g1data.title : (_gameId==="game9"?"ORDINAL EXPRESS":"GALAXY COLLECTOR");
    ctx.font=`bold ${isMob?22:28}px ${pal.font}`;
    ctx.fillStyle=tColor; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.shadowColor=tColor; ctx.shadowBlur=16;
    ctx.fillText(iconStr+"  "+titleStr, ccx(), cardY+28); ctx.shadowBlur=0;

    // Tagline
    const tagline = g1data ? g1data.tagline
      : (_gameId==="game9"
          ? "Like a delivery game — carry the number to the right ordinal door!"
          : "Like Pac-Man in space — BE the portal and swallow matching numbers!");
    ctx.font=`${isMob?12:14}px ${pal.font}`;
    ctx.fillStyle=`rgba(${hr(pal.text)},0.68)`;
    ctx.fillText(tagline, ccx(), cardY+58);

    // Visual box
    const visX=cardX+12, visY=cardY+76;
    const visW=isMob?cardW-24:cardW*0.42;
    const visH=isMob?130:cardH-200;
    ctx.fillStyle="rgba(8,16,36,0.68)";
    ctx.beginPath(); ctx.roundRect(visX,visY,visW,visH,12); ctx.fill();
    ctx.strokeStyle=`rgba(${hr(tColor)},0.14)`; ctx.lineWidth=1; ctx.stroke();

    if (_gameId==="game1" && g1data) drawG1Visual(g1data.visual, pal, visX, visY, visW, visH, orbT);
    else if (_gameId==="game9")      drawG9Visual(pal, visX, visY, visW, visH, orbT);
    else if (_gameId==="game10")     drawG10Visual(pal, visX, visY, visW, visH, orbT);

    // Rules
    const rules = g1data ? g1data.rules
      : _gameId==="game9" ? [
          {icon:"👆", text:"Your index finger controls the mascot"},
          {icon:"✨", text:"Move mascot onto the glowing number to pick it up"},
          {icon:"🚪", text:"Carry it to the CORRECT ordinal door"},
          {icon:"❤️", text:"Wrong door costs a heart — 3 hearts total"},
          {icon:"🔥", text:"Streak correct deliveries for bonus score!"},
        ] : [
          {icon:"👆", text:"Your index finger IS the portal on screen"},
          {icon:"🌌", text:"Move the portal to absorb floating numbers"},
          {icon:"✅", text:"Collect ONLY numbers with the suffix shown on portal"},
          {icon:"❌", text:"Wrong number = lost heart + black hole collapses!"},
          {icon:"⭐", text:"Collect all correct numbers to trigger a Big Bang!"},
        ];

    const rulesX=isMob?cardX+12:cardX+visW+24;
    const rulesY=isMob?visY+visH+12:cardY+76;
    const rulesW=isMob?cardW-24:cardW-visW-36;
    const rowH=isMob?34:42;

    for (let i=0; i<rules.length; i++) {
      const rule=rules[i];
      const prog=Math.max(0,Math.min(1,(enterAnim-i*0.08)/0.6));
      ctx.globalAlpha=masterA*easeOut(prog);
      ctx.fillStyle=i%2===0?"rgba(20,40,70,0.45)":"rgba(10,24,44,0.3)";
      ctx.beginPath(); ctx.roundRect(rulesX, rulesY+i*rowH, rulesW, rowH-4, 8); ctx.fill();
      ctx.font=`${isMob?16:18}px ${pal.font}`; ctx.fillStyle=pal.text;
      ctx.textAlign="left"; ctx.textBaseline="middle";
      ctx.fillText(rule.icon, rulesX+10, rulesY+i*rowH+rowH/2-2);
      ctx.font=`${isMob?11:13}px ${pal.font}`; ctx.fillStyle=`rgba(${hr(pal.text)},0.85)`;
      ctx.fillText(rule.text, rulesX+38, rulesY+i*rowH+rowH/2-2);
    }
    ctx.globalAlpha = masterA;

    // Hold section
    const holdY=cardY+cardH-(isMob?82:86);
    ctx.strokeStyle=`rgba(${hr(tColor)},0.15)`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cardX+20,holdY-6); ctx.lineTo(cardX+cardW-20,holdY-6); ctx.stroke();

    if (!hasFing) {
      const blink=Math.sin(pulseT*3)>0;
      const nfCopy=_gameId==="game9"
        ? "☝ Raise your finger to the camera!"
        : _gameId==="game10"
          ? "☝ Raise your index finger to the camera!"
          : "☝ Raise your index finger to the camera";
      ctx.font=`bold ${isMob?13:15}px ${pal.font}`;
      ctx.fillStyle=blink?pal.gold:`rgba(${hr(pal.gold)},0.55)`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.shadowColor=pal.gold; ctx.shadowBlur=blink?12:0;
      ctx.fillText(nfCopy, ccx(), holdY+18); ctx.shadowBlur=0;
      ctx.font=`${isMob?11:13}px ${pal.font}`;
      ctx.fillStyle=`rgba(${hr(pal.muted)},0.65)`;
      ctx.fillText("Hold still for 3 seconds to start playing", ccx(), holdY+40);
    } else {
      const pct=Math.round(holdProgress*100);
      ctx.font=`bold ${isMob?13:15}px ${pal.font}`;
      ctx.fillStyle=tColor; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.shadowColor=tColor; ctx.shadowBlur=10;
      ctx.fillText(holdProgress>=1?"🚀 LAUNCHING...": `Hold still... ${pct}%`, ccx(), holdY+16); ctx.shadowBlur=0;
      const barW=cardW*0.6, barH=8, barX=ccx()-cardW*0.3, barY=holdY+34;
      ctx.fillStyle="rgba(20,40,70,0.8)";
      ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,4); ctx.fill();
      ctx.fillStyle=tColor; ctx.shadowColor=tColor; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.roundRect(barX,barY,barW*holdProgress,barH,4); ctx.fill(); ctx.shadowBlur=0;
    }

    // Green finger dot
    if (hasFing) {
      drawHoldRing(fingerX, fingerY, holdProgress, tColor);
      ctx.beginPath(); ctx.arc(fingerX,fingerY,22,0,Math.PI*2);
      ctx.shadowColor="rgba(126,207,179,0.7)"; ctx.shadowBlur=28;
      ctx.fillStyle="rgba(94,180,150,0.45)"; ctx.fill();
      ctx.beginPath(); ctx.arc(fingerX,fingerY,10,0,Math.PI*2);
      ctx.shadowBlur=12; ctx.fillStyle="#b0f0da"; ctx.fill(); ctx.shadowBlur=0;
    }

    // Confetti
    for (const p of confetti) {
      ctx.globalAlpha=Math.max(0,p.life)*masterA;
      ctx.fillStyle=p.col; ctx.shadowColor=p.col; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;

    raf = requestAnimationFrame(draw);
  }

  function onResize() {
    if (!canvas) return;
    const dpr=window.devicePixelRatio||1, w=window.innerWidth, h=window.innerHeight;
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    canvas.style.width=w+"px"; canvas.style.height=h+"px";
    initStars(PAL[_gameId] || PAL.game1);
  }

  function finish() {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = canvas = ctx = null;
    if (_onStart) _onStart();
  }

  /* ══════════════════════════════════════════════════════════
     NO-FINGER PROMPT  — fully isolated per-game DOM element
  ══════════════════════════════════════════════════════════ */
  function buildPrompt(gameId) {
    if (noFingEl) return; // already built
    const pal  = PAL[gameId];
    const copy = NF_COPY[gameId];
    noFingEl = document.createElement("div");
    noFingEl.id = "noFingerPrompt_" + gameId;
    Object.assign(noFingEl.style, {
      position:     "fixed",
      bottom:       "90px",
      left:         "50%",
      transform:    "translateX(-50%)",
      zIndex:       "8888",
      background:   pal.promptBg,
      border:       `1px solid ${pal.promptBorder}`,
      borderRadius: "40px",
      padding:      "12px 28px",
      color:        pal.gold,
      fontFamily:   pal.font,
      fontSize:     "15px",
      fontWeight:   "bold",
      boxShadow:    `0 0 24px ${pal.promptGlow}`,
      pointerEvents:"none",
      opacity:      "0",
      transition:   "opacity 0.4s",
      textAlign:    "center",
      whiteSpace:   "nowrap",
    });
    noFingEl.textContent = copy;
    document.body.appendChild(noFingEl);
    noFingGameId = gameId;
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════ */
  return {

    /**
     * show(gameId, modeKey, callback)
     *   gameId  : "game1" | "game9" | "game10"
     *   modeKey : "default"|"pattern"|"cannon"|"orb"|"triple"  (game1 only)
     *   callback: called when the 3-second finger-hold completes
     */
    show(gameId, modeKey, callback) {
      _gameId      = gameId;
      _modeKey     = modeKey || "default";
      _onStart     = callback;
      enterAnim    = 0; exitAnim = -1; exitStarted = false;
      holdProgress = 0; particlesH = []; confetti = [];
      lastTime     = performance.now();
      fingerX = fingerY = -999;
      pulseT = 0; orbT = 0;

      overlay = document.createElement("div");
      overlay.id = "tutorialOverlay_" + gameId;
      Object.assign(overlay.style, { position:"fixed", inset:"0", zIndex:"9998", pointerEvents:"none" });
      canvas = document.createElement("canvas");
      Object.assign(canvas.style, { display:"block", width:"100%", height:"100%" });
      overlay.appendChild(canvas);
      document.body.appendChild(overlay);
      ctx = canvas.getContext("2d");
      onResize();

      initStars(PAL[gameId] || PAL.game1);
      window.addEventListener("resize",            onResize);
      window.addEventListener("orientationchange", onResize);
      raf = requestAnimationFrame(draw);
    },

    /**
     * showNoFingerPrompt(gameId)
     *   Safe to call from ANY game's update loop — silently ignored
     *   if gameId is not one of the three supported games, or if a
     *   prompt from a DIFFERENT game is already showing.
     */
    showNoFingerPrompt(gameId) {
      if (!gameId || !NF_COPY[gameId]) return;          // not a tutorial game — ignore
      if (noFingVisible && noFingGameId === gameId) return; // already showing
      if (noFingEl && noFingGameId !== gameId) this.destroyNoFingerPrompt(); // clean up stale
      noFingVisible = true;
      buildPrompt(gameId);
      if (noFingEl) noFingEl.style.opacity = "1";
    },

    /**
     * hideNoFingerPrompt(gameId)
     *   Only hides if gameId matches the currently showing prompt.
     *   Safe to call from any game.
     */
    hideNoFingerPrompt(gameId) {
      if (!gameId || noFingGameId !== gameId) return;
      if (!noFingVisible) return;
      noFingVisible = false;
      if (noFingEl) noFingEl.style.opacity = "0";
    },

    /**
     * destroyNoFingerPrompt()
     *   Full DOM cleanup — call when leaving ANY game.
     *   Completely safe to call even if no prompt exists.
     */
    destroyNoFingerPrompt() {
      if (noFingEl && noFingEl.parentNode) noFingEl.parentNode.removeChild(noFingEl);
      noFingEl      = null;
      noFingVisible = false;
      noFingGameId  = "";
    },
  };
})();