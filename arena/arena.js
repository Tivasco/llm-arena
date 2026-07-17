"use strict";
// arena.js — the Arena pillar gallery. Renders arena/data/arena.json:
// per challenge, every model's one-shot build running live in a scaled iframe,
// with the plan-round artifact one click away. No scores yet (stage 0).
const CACHE = {};
async function fetchJSON(path) {
  if (!(path in CACHE)) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    CACHE[path] = await r.json();
  }
  return CACHE[path];
}
const TEXT_CACHE = {};
async function fetchText(path) {
  if (!(path in TEXT_CACHE)) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    TEXT_CACHE[path] = await r.text();
  }
  return TEXT_CACHE[path];
}
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
}
// Makes a non-button element keyboard-operable as a button (WCAG 2.1.1 / 4.1.2).
function activatable(handler, extra = {}) {
  return {
    role: "button", tabindex: "0",
    onclick: handler,
    onkeydown: (e) => { if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); handler(e); } },
    ...extra,
  };
}

/* ── Overlay panel (same contract as benchmarks/bench.js) ────────────────── */
let _panelKeydown = null, _lastFocus = null;
function closePanel() {
  if (_panelKeydown) { document.removeEventListener("keydown", _panelKeydown); _panelKeydown = null; }
  document.getElementById("panel-root").innerHTML = "";
  document.body.classList.remove("panel-open");
  if (_lastFocus && typeof _lastFocus.focus === "function") _lastFocus.focus();
  _lastFocus = null;
}
function openPanel(title, body) {
  if (_panelKeydown) { document.removeEventListener("keydown", _panelKeydown); _panelKeydown = null; }
  _lastFocus = document.activeElement;
  const root = document.getElementById("panel-root");
  root.innerHTML = "";
  const closeBtn = el("button", { class: "btn panel-close", type: "button", "aria-label": "Close", onclick: closePanel }, "✕");
  const dialog = el("div", { class: "panel bench-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "bench-panel-title" },
    el("div", { class: "panel-head" }, el("h3", { id: "bench-panel-title" }, title), closeBtn),
    el("div", { class: "panel-body" }, body));
  const overlay = el("div", { class: "panel-overlay", onclick: (e) => { if (e.target === overlay) closePanel(); } }, dialog);
  root.append(overlay);
  document.body.classList.add("panel-open");
  _panelKeydown = (e) => {
    if (e.key === "Escape") { closePanel(); return; }
    if (e.key === "Tab") {
      const f = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", _panelKeydown);
  closeBtn.focus();
}

/* ── Preview scaling: render each build at a desktop viewport, shrunk ────── */
const PREVIEW_W = 1180, PREVIEW_H = 760;
function fitPreviews() {
  document.querySelectorAll(".build-preview iframe").forEach((f) => {
    const w = f.parentElement.clientWidth;
    if (w > 0) f.style.transform = `scale(${w / PREVIEW_W})`;
  });
}

function cfgLabel(b) {
  const t = b.temperature == null ? "" : `·t${b.temperature}`;
  return `${b.reasoning || "off"}${t}`;
}

async function openPlan(b) {
  let text;
  try { text = await fetchText(`data/${b.dir}/plan.md`); }
  catch (e) { openPanel(b.model, el("p", {}, "Could not load the plan: " + e.message)); return; }
  openPanel(`${b.model} — the plan`, el("div", { class: "mc" },
    el("p", { class: "di-summary" }, "The plan round's artifact — written from the spec alone, before any code. The build round got the spec plus this."),
    el("pre", { class: "arena-plan" }, text)));
}

function openAssertions(ch) {
  openPanel(`${ch.title} — what scoring will verify`, el("div", { class: "mc" },
    el("ol", { class: "arena-asserts" }, ...ch.functional.map(a => el("li", {}, a))),
    el("p", { class: "cm-caveat" },
      "The spec's numbered functional assertions, written to be verified pass/fail in a browser " +
      "(Playwright-automatable). They are worth " + ch.rubric.functional + " of 100 points and land on this page " +
      "when the scorer runs them per build. The remaining points — design & craft " + ch.rubric.design_craft +
      ", code quality " + ch.rubric.code_quality + ", robustness " + ch.rubric.robustness +
      " — stay human-judged, arena-style. Never an LLM judge.")));
}

function buildCard(b) {
  const buildUrl = `data/${b.dir}/index.html`;
  return el("article", { class: "build-card" },
    el("a", { class: "build-preview", href: buildUrl, target: "_blank", rel: "noopener",
        "aria-label": `Open ${b.model}'s build in a new tab` },
      el("iframe", { src: buildUrl, sandbox: "allow-scripts allow-same-origin", loading: "lazy",
        scrolling: "no", tabindex: "-1", "aria-hidden": "true", title: `${b.model} build preview` }),
      el("span", { class: "build-open", "aria-hidden": "true" }, "open ↗")),
    el("div", { class: "build-card__body" },
      el("div", { class: "build-card__name" },
        el("h3", {}, b.model),
        el("span", { class: `cfg-chip cfg-${b.reasoning === "on" ? "on" : "off"}` }, cfgLabel(b))),
      el("div", { class: "lb-sub" },
        [b.family, b.size].filter(Boolean).join(" · ") + (b.board ? "" : " · not on the board")),
      el("div", { class: "build-actions" },
        el("button", { class: "btn btn--ghost btn--sm", type: "button",
          "aria-haspopup": "dialog", onclick: () => openPlan(b) }, "Read the plan"),
        el("a", { class: "btn btn--ghost btn--sm", href: buildUrl, target: "_blank", rel: "noopener" }, "Open build ↗"))));
}

function renderChallenge(ch) {
  const num = ch.id.slice(0, 2);
  return el("section", { class: "section arena-challenge" },
    el("p", { class: "eyebrow" }, `Challenge ${num} · Level ${ch.level}/${ch.levels_total} · ${ch.kind}`),
    el("h2", {}, ch.title),
    el("p", { class: "arena-brief" }, ch.brief),
    el("div", { class: "arena-rubric" },
      el("span", { class: "chip chip--accent", "aria-haspopup": "dialog",
        ...activatable(() => openAssertions(ch), { "aria-label": `${ch.title}: functional assertions` }) },
        `functional ${ch.rubric.functional} · ${ch.functional.length} assertions →`),
      el("span", { class: "chip" }, `design & craft ${ch.rubric.design_craft}`),
      el("span", { class: "chip" }, `code quality ${ch.rubric.code_quality}`),
      el("span", { class: "chip" }, `robustness ${ch.rubric.robustness}`),
      el("span", { class: "chip v-warn" }, "scores — next phase")),
    el("div", { class: "arena-grid" }, ...ch.builds.map(buildCard)));
}

async function boot() {
  const gallery = document.getElementById("gallery");
  try {
    const m = await fetchJSON("data/arena.json");
    const nb = m.challenges.reduce((n, c) => n + c.builds.length, 0);
    document.getElementById("arena-meta").textContent =
      `${m.challenges.length} challenge${m.challenges.length === 1 ? "" : "s"} · ${nb} builds · ` +
      `${m.protocol} · generated ${m.generated_at}`;
    for (const ch of m.challenges) gallery.append(renderChallenge(ch));
    fitPreviews();
    window.addEventListener("resize", fitPreviews);
  } catch (e) {
    gallery.innerHTML = `<p class="panel">Could not load the gallery: ${e.message}</p>`;
  }
}
document.addEventListener("DOMContentLoaded", boot);
