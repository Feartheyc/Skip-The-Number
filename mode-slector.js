/* ============================================================
   mode-selector.js
   A self-contained mode-selection overlay that appears before
   Game1 starts.  Call ModeSelector.show(onSelect) to display it;
   it resolves with the chosen mode string and cleans itself up.

   Matches Game1's palette exactly:
     bg      #0d1b2e   noteText  #f0f4ff   correct  #6de8b4
     wrong   #e87c6d   gold      #f5c842   accent   #8ecae6
   ============================================================ */

const ModeSelector = (() => {

  /* ── palette (mirrors Game1.C) ───────────────────────────── */
  const C = {
    bg:       "#0d1b2e",
    surface:  "rgba(10,24,44,0.92)",
    border:   "rgba(140,180,220,0.18)",
    text:     "#f0f4ff",
    muted:    "#8ecae6",
    correct:  "#6de8b4",
    wrong:    "#e87c6d",
    gold:     "#f5c842",
    accent:   "#8ecae6",
  };

  /* ── mode definitions ────────────────────────────────────── */
  const MODES = [
    {
      key:   "default",
      label: "SKIP",
      icon:  "⟳",
      color: C.correct,
      desc:  "Collect every Nth number as it flies in from the ring",
      badge: "CLASSIC",
    },
    {
      key:   "pattern",
      label: "PATTERN",
      icon:  "◈",
      color: C.accent,
      desc:  "Skip a sequence, then collect a sequence — rhythm matters",
      badge: "STRATEGY",
    },
    {
      key:   "cannon",
      label: "CANNON",
      icon:  "▲",
      color: C.gold,
      desc:  "A cannon fires numbers — tap the right ones before they escape",
      badge: "ACTION",
    },
    {
      key:   "orb",
      label: "ORB",
      icon:  "◉",
      color: "#c084fc",
      desc:  "The orb launcher rotates and fires — intercept the correct numbers",
      badge: "PRECISION",
    },
    {
      key:   "triple",
      label: "TRIPLE",
      icon:  "⟁",
      color: C.wrong,
      desc:  "Three cannons, random firing order — track them all",
      badge: "CHAOS",
    },
  ];

  /* ── star field (shared with Game1 style) ─────────────────── */
  let stars = [];
  function initStars(W, H) {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x:  Math.round(Math.random() * W),
        y:  Math.round(Math.random() * H),
        r:  0.5 + Math.random() * 1.4,
        a:  0.1 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
        ts: 0.012 + Math.random() * 0.018,
      });
    }
  }

  /* ── internal state ──────────────────────────────────────── */
  let overlay    = null;
  let canvas     = null;
  let ctx        = null;
  let raf        = null;
  let onSelect   = null;
  let hovered    = -1;
  let selected   = -1;
  let cardRects  = [];    /* { x, y, w, h } per card in logical px */
  let lastTime   = 0;
  let noiseT     = 0;
  let enterAnim  = 0;     /* 0→1 fade-in progress */
  let exitAnim   = -1;    /* -1=idle, 0→1 exit progress */
  let exitMode   = "";
  let titlePulse = 0;

  /* ── helpers ─────────────────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* ── layout (recalc every frame — handles resize) ─────────── */
  function calcLayout() {
    const W  = canvas.width  / (window.devicePixelRatio || 1);
    const H  = canvas.height / (window.devicePixelRatio || 1);
    const cx = W / 2, cy = H / 2;

    /* responsive card sizing */
    const cols     = W < 520 ? 1 : W < 860 ? 2 : (MODES.length === 5 ? 3 : 3);
    const rows     = Math.ceil(MODES.length / cols);
    const padX     = Math.max(W * 0.05, 16);
    const padY     = 16;
    const gapX     = W < 520 ? 12 : 18;
    const gapY     = W < 520 ? 12 : 18;
    const totalW   = W - padX * 2;
    const cw       = (totalW - gapX * (cols - 1)) / cols;

    /* header zone: title + subtitle */
    const headerH  = W < 520 ? 110 : 130;
    const footerH  = 60;
    const usableH  = H - headerH - footerH;
    const ch       = Math.min((usableH - gapY * (rows - 1)) / rows, W < 520 ? 140 : 170);

    const gridH    = rows * ch + (rows - 1) * gapY;
    const startY   = headerH + (usableH - gridH) / 2;

    cardRects = MODES.map((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      /* center last row if odd card count */
      const rowCount   = i >= (rows - 1) * cols ? MODES.length - (rows - 1) * cols : cols;
      const rowTotalW  = rowCount * cw + (rowCount - 1) * gapX;
      const rowStartX  = padX + (totalW - rowTotalW) / 2;
      return {
        x: rowStartX + col * (cw + gapX),
        y: startY   + row * (ch + gapY),
        w: cw,
        h: ch,
      };
    });

    return { W, H, cx, cy, headerH, cols, rows };
  }

  /* ── draw ─────────────────────────────────────────────────── */
  function draw(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    noiseT  += dt * 1.6;
    titlePulse += dt * 1.8;

    if (exitAnim >= 0) {
      exitAnim = Math.min(1, exitAnim + dt * 2.8);
      if (exitAnim >= 1) { finish(); return; }
    } else {
      enterAnim = Math.min(1, enterAnim + dt * 2.2);
    }

    const dpr = window.devicePixelRatio || 1;
    const { W, H, cx, cy, headerH } = calcLayout();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const masterAlpha = exitAnim >= 0
      ? easeOut(1 - exitAnim)
      : easeOut(enterAnim);

    ctx.globalAlpha = masterAlpha;

    /* background */
    const bgGrad = ctx.createRadialGradient(cx, cy * 0.6, 0, cx, H * 0.5, Math.max(W, H) * 0.75);
    bgGrad.addColorStop(0,   "#1a2d4a");
    bgGrad.addColorStop(0.5, "#0f1e35");
    bgGrad.addColorStop(1,   "#080f1c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    /* stars */
    for (const s of stars) {
      s.tw += s.ts;
      ctx.globalAlpha = masterAlpha * Math.max(0, s.a + Math.sin(s.tw) * 0.12);
      ctx.fillStyle   = "#c8dff0";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = masterAlpha;

    /* ── title ───────────────────────────────────────────────── */
    const titleY   = W < 520 ? 42 : 52;
    const subtitleY= W < 520 ? 74 : 88;
    const titleFs  = Math.max(22, Math.min(W * 0.072, 52));
    const subFs    = Math.max(11, Math.min(W * 0.028, 18));

    const pulseGlow = 0.35 + Math.sin(titlePulse) * 0.15;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.font         = `bold ${titleFs}px 'Trebuchet MS', sans-serif`;
    ctx.shadowColor  = `rgba(245,200,66,${pulseGlow})`;
    ctx.shadowBlur   = 22;
    ctx.fillStyle    = C.gold;
    ctx.fillText("SELECT MODE", cx, titleY);
    ctx.shadowBlur   = 0;

    ctx.font      = `${subFs}px 'Trebuchet MS', sans-serif`;
    ctx.fillStyle = C.muted;
    ctx.globalAlpha = masterAlpha * 0.75;
    ctx.fillText("SKIP NUMBER — Choose your challenge", cx, subtitleY);
    ctx.globalAlpha = masterAlpha;

    /* thin divider */
    const divY = subtitleY + subFs + 10;
    ctx.beginPath();
    const divGrad = ctx.createLinearGradient(cx - W * 0.3, 0, cx + W * 0.3, 0);
    divGrad.addColorStop(0, "rgba(140,180,220,0)");
    divGrad.addColorStop(0.5, "rgba(140,180,220,0.28)");
    divGrad.addColorStop(1, "rgba(140,180,220,0)");
    ctx.strokeStyle = divGrad;
    ctx.lineWidth   = 1;
    ctx.moveTo(cx - W * 0.3, divY);
    ctx.lineTo(cx + W * 0.3, divY);
    ctx.stroke();

    /* ── cards ───────────────────────────────────────────────── */
    cardRects.forEach((r, i) => {
      const mode    = MODES[i];
      const isHov   = hovered === i;
      const isSel   = selected === i;
      const isExit  = exitAnim >= 0 && exitMode === mode.key;
      const cardCol = mode.color;

      /* card slide-in stagger */
      const delay   = i * 0.07;
      const prog    = Math.max(0, Math.min(1, (enterAnim - delay) / (1 - delay)));
      const slideY  = easeOut(prog) * (isHov ? -5 : 0) + (1 - easeOut(prog)) * 30;
      const cardA   = easeOut(prog);

      if (exitAnim < 0) ctx.globalAlpha = masterAlpha * cardA;

      ctx.save();
      ctx.translate(r.x, r.y + (exitAnim >= 0 ? 0 : slideY));

      /* shadow glow */
      if (isHov || isSel || isExit) {
        ctx.shadowColor = cardCol;
        ctx.shadowBlur  = isExit ? 40 : isHov ? 22 : 14;
      }

      /* card fill */
      const fillAlpha = isHov ? 0.18 : isSel ? 0.22 : 0.09;
      ctx.fillStyle   = `rgba(${hexToRgb(cardCol)},${fillAlpha})`;
      roundRect(ctx, 0, 0, r.w, r.h, 14);
      ctx.fill();
      ctx.shadowBlur  = 0;

      /* border */
      ctx.strokeStyle = isHov || isSel
        ? cardCol
        : "rgba(140,180,220,0.22)";
      ctx.lineWidth   = isHov || isSel ? 1.8 : 1;
      roundRect(ctx, 0, 0, r.w, r.h, 14);
      ctx.stroke();

      const fss = Math.max(10, r.h * 0.11);   /* icon font size */
      const fsL = Math.max(12, r.h * 0.145);  /* label size */
      const fsD = Math.max(9,  r.h * 0.085);  /* desc size */

      /* badge top-right */
      const badgeFs = Math.max(8, r.h * 0.07);
      ctx.font      = `bold ${badgeFs}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = `rgba(${hexToRgb(cardCol)},0.55)`;
      ctx.fillText(mode.badge, r.w - 12, 10);

      /* icon */
      const iconY = r.h * 0.30;
      ctx.font         = `${r.h * 0.22}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle    = cardCol;
      ctx.shadowColor  = cardCol;
      ctx.shadowBlur   = isHov ? 16 : 8;
      ctx.fillText(mode.icon, r.w / 2, iconY);
      ctx.shadowBlur   = 0;

      /* label */
      ctx.font         = `bold ${fsL}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle    = C.text;
      ctx.textBaseline = "middle";
      ctx.fillText(mode.label, r.w / 2, r.h * 0.54);

      /* desc */
      ctx.font         = `${fsD}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle    = isHov ? C.text : C.muted;
      ctx.globalAlpha  = (exitAnim < 0 ? masterAlpha * cardA : masterAlpha) * (isHov ? 0.9 : 0.6);
      wrapText(ctx, mode.desc, r.w / 2, r.h * 0.74, r.w - 24, fsD * 1.35);

      ctx.restore();
      ctx.globalAlpha = masterAlpha;
    });

    /* ── footer hint ────────────────────────────────────────── */
    const footerFs  = Math.max(10, Math.min(W * 0.022, 14));
    ctx.font         = `${footerFs}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle    = C.muted;
    ctx.globalAlpha  = masterAlpha * 0.45;
    ctx.fillText("Tap / click a mode to begin", cx, H - 14);
    ctx.globalAlpha  = 1;

    raf = requestAnimationFrame(draw);
  }

  /* ── multi-line text wrap helper ─────────────────────────── */
  function wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = w;
      } else { line = test; }
    }
    if (line) lines.push(line);
    const total = lines.length * lineH;
    lines.forEach((l, i) => {
      ctx.fillText(l, cx, y - total / 2 + i * lineH + lineH / 2);
    });
  }

  /* ── roundRect polyfill ──────────────────────────────────── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  /* ── hex → "r,g,b" ──────────────────────────────────────── */
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return isNaN(r) ? "140,180,220" : `${r},${g},${b}`;
  }

  /* ── hit-test ────────────────────────────────────────────── */
  function hitTest(clientX, clientY) {
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const lx   = clientX - rect.left;
    const ly   = clientY - rect.top;
    for (let i = 0; i < cardRects.length; i++) {
      const r = cardRects[i];
      if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) return i;
    }
    return -1;
  }

  /* ── event handlers ──────────────────────────────────────── */
  function onMove(e) {
    const touch = e.touches ? e.touches[0] : e;
    hovered = hitTest(touch.clientX, touch.clientY);
    canvas.style.cursor = hovered >= 0 ? "pointer" : "default";
  }

  function onClick(e) {
    const touch = e.touches ? e.changedTouches[0] : e;
    const idx   = hitTest(touch.clientX, touch.clientY);
    if (idx < 0) return;
    selected  = idx;
    exitMode  = MODES[idx].key;
    exitAnim  = 0;
  }

  function onResize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w   = window.innerWidth;
    const h   = window.innerHeight;
    canvas.width        = Math.round(w * dpr);
    canvas.height       = Math.round(h * dpr);
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    initStars(w, h);
  }

  /* ── finish (after exit anim) ────────────────────────────── */
  function finish() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener("mousemove",  onMove);
    canvas.removeEventListener("click",      onClick);
    canvas.removeEventListener("touchmove",  onMove);
    canvas.removeEventListener("touchend",   onClick);
    window.removeEventListener("resize",     onResize);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = canvas = ctx = null;
    if (onSelect) onSelect(exitMode);
  }

  /* ── public API ──────────────────────────────────────────── */
  return {
    /**
     * show(callback)
     * Displays the mode selector overlay.
     * callback(modeKey) is called once the user picks a mode.
     * modeKey is one of: "default" | "pattern" | "cannon" | "orb" | "triple"
     */
    show(callback) {
      onSelect  = callback;
      hovered   = -1;
      selected  = -1;
      enterAnim = 0;
      exitAnim  = -1;
      exitMode  = "";
      noiseT    = 0;
      titlePulse= 0;
      lastTime  = performance.now();

      /* create overlay container */
      overlay = document.createElement("div");
      overlay.id = "modeSelectorOverlay";
      Object.assign(overlay.style, {
        position: "fixed",
        inset:    "0",
        zIndex:   "9999",
        pointerEvents: "auto",
      });

      canvas = document.createElement("canvas");
      Object.assign(canvas.style, {
        display: "block",
        width:   "100%",
        height:  "100%",
      });
      overlay.appendChild(canvas);
      document.body.appendChild(overlay);

      ctx = canvas.getContext("2d");
      onResize();

      canvas.addEventListener("mousemove",  onMove,   { passive: true });
      canvas.addEventListener("click",      onClick);
      canvas.addEventListener("touchmove",  onMove,   { passive: true });
      canvas.addEventListener("touchend",   onClick);
      window.addEventListener("resize",     onResize);

      raf = requestAnimationFrame(draw);
    },
  };
})();