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

// stubs replaced in later tasks
async function openDrill() {}
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
