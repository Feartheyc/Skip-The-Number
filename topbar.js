// topbar.js — the shared Not-a-Bot game top bar.
//
// A self-contained, framework-free DOM component: a fixed, full-width bar that
// sits over the top of any game (canvas or DOM). Three regions on one row:
//   • left   — the full Not-a-Bot horizontal wordmark (links notabot.ai)
//   • centre — the game's name (horizontally centred in the bar)
//   • right  — a read-only "Grade N" chip from the ?difficulty query param, then
//              a slot the game fills with its own system controls (mute/info/pause).
//
// ── How another game copies this ──────────────────────────────────────────
//
//   1. copy this file → public/js/topbar.js, and img/logo-horiz.png → public/img/
//   2. load it in index.html BEFORE the game's own script:
//        <script src="js/topbar.js"></script>
//   3. mount it once and drop the game's system controls into its slot:
//        const bar = NbTopbar.mount({ gameName: "Triangles" });
//        bar.controls.appendChild(muteButton);   // and info / pause, etc.
//   4. THEME IT to the game so the bar blends instead of standing out: set the
//        --nb-tb-* custom properties (on :root or the bar) to the game's palette:
//        --nb-tb-bg (bar background), --nb-tb-ink (text), --nb-tb-accent (chip).
//
// It injects its own <style> once, reads ?difficulty itself (hiding the chip
// when absent), and publishes the bar's live height as the CSS variable
// --nb-topbar-h so a game can lay its own top content directly beneath the bar,
// e.g.  top: calc(var(--nb-topbar-h) + 10px).
//
// Colours resolve through --nb-tb-* custom properties, falling back to a game's
// own --ink / --teal, then to a sane default. Set them per game to blend.
(() => {
  if (typeof document === "undefined") return;

  const STYLE_ID = "nb-topbar-style";
  // grid: [1fr logo] [auto name] [1fr right] — the two 1fr rails keep the name
  // centred in the whole bar even when the logo and the right cluster differ in
  // width.
  const CSS = `
    .nb-topbar{position:fixed;top:0;left:0;right:0;z-index:30;box-sizing:border-box;
      display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;
      padding:calc(max(8px,env(safe-area-inset-top)) + 6px)
        max(14px,env(safe-area-inset-right)) 8px max(14px,env(safe-area-inset-left));
      background:var(--nb-tb-bg,rgba(253,251,245,.82));
      -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
      box-shadow:0 1px 0 rgba(47,58,74,.10),0 6px 18px rgba(47,58,74,.08);
      font-family:Nunito,ui-sans-serif,system-ui,-apple-system,sans-serif;
      pointer-events:none;}
    .nb-topbar>*{pointer-events:auto;}
    .nb-tb-left{justify-self:start;display:flex;align-items:center;min-width:0;}
    .nb-tb-logo{display:flex;align-items:center;flex:none;transition:opacity .15s ease;}
    .nb-tb-logo:hover{opacity:.8;}
    .nb-tb-logo img{height:26px;width:auto;display:block;}
    .nb-tb-name{justify-self:center;text-align:center;font-weight:800;
      font-size:clamp(15px,3.2vw,20px);
      color:var(--nb-tb-ink,var(--ink,#2f3a4a));text-decoration:none;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
    .nb-tb-right{justify-self:end;display:flex;align-items:center;gap:8px;flex:none;}
    .nb-tb-grade{font-weight:800;font-size:clamp(12px,2.6vw,13.5px);letter-spacing:.01em;
      color:var(--nb-tb-ink,var(--ink,#2f3a4a));
      background:rgba(23,163,152,.14);
      background:color-mix(in srgb,var(--nb-tb-accent,var(--teal,#17a398)) 15%,transparent);
      border:1.5px solid rgba(23,163,152,.4);
      border:1.5px solid color-mix(in srgb,var(--nb-tb-accent,var(--teal,#17a398)) 40%,transparent);
      border-radius:999px;padding:5px 11px;white-space:nowrap;}
    .nb-tb-controls{display:flex;align-items:center;gap:6px;}
    @media (max-width:560px){
      .nb-tb-logo img{height:22px;}
      .nb-tb-name{font-size:clamp(14px,4vw,17px);}
    }
  `;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function query(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch {
      return null;
    }
  }

  // Publish the bar's rendered height so games can offset their own top content
  // beneath it. Re-called after the webfont and logo settle (both can nudge it).
  function publishHeight(bar) {
    const h = Math.round(bar.getBoundingClientRect().height);
    if (h > 0) {
      document.documentElement.style.setProperty("--nb-topbar-h", `${h}px`);
    }
  }

  function mount(opts = {}) {
    injectStyle();

    const bar = document.createElement("header");
    bar.className = "nb-topbar";

    const left = document.createElement("div");
    left.className = "nb-tb-left";
    const logo = document.createElement("a");
    logo.className = "nb-tb-logo";
    logo.href = "https://notabot.ai";
    logo.target = "_blank";
    logo.rel = "noopener noreferrer";
    logo.setAttribute("aria-label", "Not a Bot");
    logo.innerHTML = `<img src="img/logo-horiz.png" alt="Not a Bot">`;
    left.appendChild(logo);

    // Centre region — the game name, centred in the bar.
    const name = document.createElement("a");
    name.className = "nb-tb-name";
    name.href = opts.homeHref || "/";
    name.textContent = opts.gameName || document.title || "";

    const right = document.createElement("div");
    right.className = "nb-tb-right";
    const difficulty = opts.difficulty !== undefined
      ? opts.difficulty
      : query("difficulty");
    if (difficulty != null && String(difficulty).trim() !== "") {
      const chip = document.createElement("div");
      chip.className = "nb-tb-grade";
      chip.textContent = `Grade ${String(difficulty).trim()}`;
      right.appendChild(chip);
    }
    const controls = document.createElement("div");
    controls.className = "nb-tb-controls";
    right.appendChild(controls);

    bar.appendChild(left);
    bar.appendChild(name);
    bar.appendChild(right);
    document.body.appendChild(bar);

    publishHeight(bar);
    const republish = () => publishHeight(bar);
    addEventListener("resize", republish);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(republish).catch(() => {});
    }
    const logoImg = logo.querySelector("img");
    if (logoImg && !logoImg.complete) {
      logoImg.addEventListener("load", republish, { once: true });
    }

    return {
      el: bar,
      controls,
      left,
      right,
      setGameName(text) {
        name.textContent = text;
      },
      refresh: republish,
    };
  }

  globalThis.NbTopbar = { mount };
})();
