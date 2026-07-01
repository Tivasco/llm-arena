"use strict";
const CACHE = {};
async function fetchJSON(path) {
  if (!(path in CACHE)) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    CACHE[path] = await r.json();
  }
  return CACHE[path];
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
function verdictClass(rate, buckets) {
  if (rate >= buckets.automate) return "v-go";
  if (rate >= buckets.supervise) return "v-warn";
  return "v-stop";
}

let BOARD = null, sortTier = "overall";

function leaderboardRows() {
  const rows = [...BOARD.rows];
  rows.sort((a, b) => {
    const ra = sortTier === "overall" ? a.overall.rate : (a.scores[sortTier]?.rate ?? -1);
    const rb = sortTier === "overall" ? b.overall.rate : (b.scores[sortTier]?.rate ?? -1);
    return rb - ra;
  });
  return rows;
}
function renderLeaderboard() {
  const b = BOARD;
  const head = el("tr", {},
    el("th", { class: "lb-model", onclick: () => { sortTier = "overall"; mountLeaderboard(); } }, "Model"),
    ...b.tiers.map(t => el("th", { class: "lb-tier", title: t.job, onclick: () => { sortTier = t.id; mountLeaderboard(); } },
      el("div", { class: "lb-tier-label" }, t.label), el("div", { class: "lb-tier-job" }, t.job))),
    el("th", { onclick: () => { sortTier = "overall"; mountLeaderboard(); } }, "Overall"));
  const body = leaderboardRows().map(row => el("tr", {},
    el("td", { class: "lb-model", onclick: () => openCard(row.model, row.variant) },
      el("div", {}, row.label),
      el("div", { class: "lb-sub" }, [row.family, row.size].filter(Boolean).join(" · "))),
    ...b.tiers.map(t => {
      const c = row.scores[t.id];
      if (!c) return el("td", { class: "lb-cell v-none" }, "—");
      return el("td", { class: `lb-cell ${verdictClass(c.rate, b.verdict_buckets)}${c.borderline ? " lb-borderline" : ""}`,
        title: `${Math.round(c.rate*100)}%${c.borderline ? " · borderline" : ""}`,
        onclick: () => openDrill(row, t) }, `${c.pass}/${c.total}`);
    }),
    el("td", { class: "lb-cell lb-overall" }, `${Math.round(row.overall.rate*100)}%`)));
  return el("table", { class: "table lb" }, el("thead", {}, head), el("tbody", {}, ...body));
}
function mountLeaderboard() {
  const v = document.getElementById("view");
  v.innerHTML = "";
  v.append(
    el("div", { class: "lb-legend" },
      el("span", { class: "chip v-go" }, "automate ≥85%"),
      el("span", { class: "chip v-warn" }, "supervise 60–84%"),
      el("span", { class: "chip v-stop" }, "escalate <60%")),
    renderLeaderboard());
}

const TABS = [
  { id: "leaderboard", label: "Leaderboard", mount: mountLeaderboard },
  { id: "exercises", label: "Exercises", mount: () => mountExercises() },
  { id: "setup", label: "Setup", mount: () => mountSetup() },
];
function selectTab(id) {
  document.querySelectorAll("#tabs .bench-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === id));
  TABS.find(t => t.id === id).mount();
}
function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  for (const t of TABS)
    nav.append(el("button", { class: "bench-tab", "data-tab": t.id, onclick: () => selectTab(t.id) }, t.label));
}

let _escHandler = null;
function closePanel() {
  if (_escHandler) { document.removeEventListener("keydown", _escHandler); _escHandler = null; }
  document.getElementById("panel-root").innerHTML = "";
  document.body.classList.remove("panel-open");
}
function openPanel(title, body) {
  const root = document.getElementById("panel-root");
  root.innerHTML = "";
  const overlay = el("div", { class: "panel-overlay", onclick: (e) => { if (e.target === overlay) closePanel(); } },
    el("div", { class: "panel bench-panel", role: "dialog" },
      el("div", { class: "panel-head" }, el("h3", {}, title), el("button", { class: "btn panel-close", onclick: closePanel }, "✕")),
      el("div", { class: "panel-body" }, body)));
  root.append(overlay);
  document.body.classList.add("panel-open");
  _escHandler = (e) => { if (e.key === "Escape") closePanel(); };
  document.addEventListener("keydown", _escHandler);
}
function itemRow(it) {
  const failed = it.pass === false;
  const head = el("div", { class: `di-head ${failed ? "di-fail" : "di-pass"}`, onclick: (e) => {
    const body = e.currentTarget.nextElementSibling; body.style.display = body.style.display === "none" ? "" : "none";
  } },
    el("span", { class: `chip ${failed ? "v-stop" : "v-go"}` }, failed ? "FAIL" : "pass"),
    el("span", { class: "di-id" }, it.id),
    el("span", { class: "di-meta" }, [it.category, it.difficulty != null ? "L" + it.difficulty : null].filter(Boolean).join(" · ")));
  const failedChecks = (it.checks || []).filter(c => c.passed === false);
  const body = el("div", { class: "di-body", style: failed ? "" : "display:none" },
    el("div", { class: "di-prompt" }, el("b", {}, "prompt "), it.prompt),
    el("div", { class: "di-output" }, el("b", {}, "output "), it.output),
    failedChecks.length ? el("div", { class: "di-checks" }, el("b", {}, "failed "),
      ...failedChecks.map(c => el("span", { class: "chip v-stop", title: c.detail || "" }, c.name))) : null);
  return el("div", { class: "di-item" }, head, body);
}
async function openDrill(row, tier) {
  const title = `${row.label} · ${tier.job}`;
  try {
    const d = await fetchJSON("data/" + row.scores[tier.id].detail);
    const nFail = d.items.filter(i => i.pass === false).length;
    openPanel(title, el("div", {},
      el("p", { class: "di-summary" }, `${d.items.length - nFail}/${d.items.length} passed — ${nFail} failure${nFail === 1 ? "" : "s"} shown expanded`),
      ...d.items.slice().sort((a, b) => (a.pass === b.pass ? 0 : a.pass ? 1 : -1)).map(itemRow)));
  } catch (e) {
    openPanel(title, el("p", {}, "Could not load detail: " + e.message));
  }
}
async function openCard() {}
async function mountExercises() { document.getElementById("view").innerHTML = "<p>Exercises — coming next.</p>"; }
async function mountSetup() { document.getElementById("view").innerHTML = "<p>Setup — coming next.</p>"; }

async function boot() {
  try {
    BOARD = await fetchJSON("data/board.json");
    document.getElementById("board-meta").textContent =
      `${BOARD.rows.length} model-variant rows · generated ${BOARD.generated_at}`;
    renderTabs();
    selectTab("leaderboard");
  } catch (e) {
    document.getElementById("view").innerHTML = `<p class="panel">Could not load board data: ${e.message}</p>`;
  }
}
document.addEventListener("DOMContentLoaded", boot);
