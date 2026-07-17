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

/* ── Minimal safe markdown renderer ──────────────────────────────────────────
   The plan/spec artifacts are markdown; plans are MODEL OUTPUT, so every
   character is HTML-escaped before any transform — no raw content ever
   reaches innerHTML. Covers what the artifacts use: headings, paragraphs,
   bullet/numbered lists (wrapped lines fold into their item), pipe tables,
   fenced code, blockquotes, hr, **bold**, *italic*, `code`. Headings are
   demoted three levels so they nest under the dialog's h3 title.
   Anything unrecognised degrades to an escaped paragraph, never breaks. */
function mdEscape(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function mdInline(s) {
  // Code spans out first (placeholders), so emphasis can pair across them
  // (e.g. **`code` and text**) without ever transforming code content.
  const codes = [];
  let t = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push("<code>" + mdEscape(c) + "</code>");
    return "\u0000" + (codes.length - 1) + "\u0000";
  });
  t = mdEscape(t);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}
function mdToHtml(md) {
  const out = [], lines = md.replace(/\r\n/g, "\n").split("\n");
  const isTable = l => /^\s*\|/.test(l);
  const blockStart = l => /^(#{1,6}\s|```|\s*\||>\s?)/.test(l) || /^\s*[-*]\s+\S/.test(l) || /^\s*\d+\.\s+\S/.test(l) || /^\s*---+\s*$/.test(l);
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push("<pre><code>" + mdEscape(buf.join("\n")) + "</code></pre>");
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { const n = Math.min(h[1].length + 3, 6); out.push(`<h${n}>` + mdInline(h[2]) + `</h${n}>`); i++; continue; }
    if (/^\s*---+\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push("<blockquote>" + mdToHtml(buf.join("\n")) + "</blockquote>");
      continue;
    }
    if (isTable(l)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
      let header = null, body = rows.map(cells);
      if (rows.length > 1 && /^[\s|:-]+$/.test(rows[1])) { header = body[0]; body = body.slice(2); }
      let t = "<table>";
      if (header) t += "<thead><tr>" + header.map(c => "<th>" + mdInline(c) + "</th>").join("") + "</tr></thead>";
      t += "<tbody>" + body.map(r => "<tr>" + r.map(c => "<td>" + mdInline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
      out.push(t);
      continue;
    }
    const ol = /^\s*(\d+)\.\s+(.*)$/.exec(l), ul = ol ? null : /^\s*[-*]\s+(.*)$/.exec(l);
    if (ol || ul) {
      const re = ol ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      const items = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) { items.push(m[1]); i++; }
        else if (/^\s+\S/.test(lines[i]) && !blockStart(lines[i])) { items[items.length - 1] += " " + lines[i].trim(); i++; }
        else break;
      }
      const start = ol && ol[1] !== "1" ? ` start="${ol[1]}"` : "";
      out.push((ol ? `<ol${start}>` : "<ul>") + items.map(t => "<li>" + mdInline(t) + "</li>").join("") + (ol ? "</ol>" : "</ul>"));
      continue;
    }
    const buf = [l]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !blockStart(lines[i])) buf.push(lines[i++]);
    out.push("<p>" + mdInline(buf.join(" ")) + "</p>");
  }
  return out.join("\n");
}
function mdBlock(text) { return el("div", { class: "arena-md", html: mdToHtml(text) }); }

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
    mdBlock(text)));
}

async function openSpec(ch) {
  let text;
  try { text = await fetchText(`data/${ch.id}/challenge.md`); }
  catch (e) { openPanel(ch.title, el("p", {}, "Could not load the spec: " + e.message)); return; }
  openPanel(`${ch.title} — the brief`, el("div", { class: "mc" },
    el("p", { class: "di-summary" }, "The challenge spec, verbatim — the only brief every model saw. Each plan and build was produced from this alone."),
    mdBlock(text)));
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
        ...activatable(() => openSpec(ch), { "aria-label": `${ch.title}: read the full challenge spec` }) },
        "the full spec →"),
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
