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
  if (_escHandler) { document.removeEventListener("keydown", _escHandler); _escHandler = null; }
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
let MODELS = null;
async function openCard(model, variant) {
  if (!MODELS) MODELS = await fetchJSON("data/models.json");
  const m = MODELS.models.find(x => x.id === model.replace(/\//g, "-") && x.variant === variant)
        || MODELS.models.find(x => x.lmstudio_id === model && x.variant === variant);
  if (!m) { openPanel(model, el("p", {}, "No card for this model.")); return; }
  const spec = m.quantization
    ? el("div", { class: "mc-specs" },
        ...[["publisher", m.publisher], ["arch", m.arch], ["quant", m.quantization], ["format", m.format],
            ["context", m.max_context_length], ["modality", m.modality],
            ["capabilities", (m.capabilities || []).join(", ")]]
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => el("div", { class: "mc-spec" }, el("span", { class: "mc-k" }, k), el("span", {}, String(v)))))
    : el("p", { class: "mc-nospec" }, "run-derived only (no LM Studio match)");
  const st = m.stats || {};
  openPanel(`${m.label}`, el("div", { class: "mc" },
    el("p", { class: "mc-fam" }, [m.family, m.size].filter(Boolean).join(" · ")),
    spec,
    el("div", { class: "mc-stats" },
      el("span", {}, `median ${st.median_latency_ms} ms`),
      el("span", {}, `${st.n_calls} calls`),
      el("span", {}, `truncation ${Math.round((st.truncation_rate || 0) * 100)}%`),
      el("span", {}, `errors ${Math.round((st.error_rate || 0) * 100)}%`)),
    el("p", { class: "mc-lastrun", style: "color:var(--text-muted)" }, `last run ${m.last_run}`)));
}
async function mountExercises() {
  const v = document.getElementById("view"); v.innerHTML = "";
  try {
    const ex = await fetchJSON("data/exercises.json");
    for (const ds of ex.datasets) {
      const items = ds.items.map(it => {
        const crit = (it.checks || []).map(c =>
          el("span", { class: "chip", title: c.desc || "" }, c.name + (c.params && Object.keys(c.params).length ? " " + JSON.stringify(c.params) : "")));
        const rules = (it.rules || []).map(r => el("span", { class: "chip" }, r.rule + (r.value ? " " + JSON.stringify(r.value) : "")));
        const gold = it.gold_passes === true ? el("span", { class: "chip v-go" }, "gold ✓")
                   : it.gold_passes === false ? el("span", { class: "chip v-stop" }, "gold ✗") : null;
        const head = el("div", { class: "ex-head", onclick: (e) => { const b = e.currentTarget.nextElementSibling; b.style.display = b.style.display === "none" ? "" : "none"; } },
          el("span", { class: "ex-id" }, it.id),
          el("span", { class: "ex-meta" }, [it.category, (it.difficulty ?? it.level) != null ? "L" + (it.difficulty ?? it.level) : null].filter(Boolean).join(" · ")));
        const body = el("div", { class: "ex-body", style: "display:none" },
          el("div", { class: "ex-prompt" }, it.prompt),
          el("div", { class: "ex-crit" }, ...crit, ...rules, gold));
        return el("div", { class: "ex-item" }, head, body);
      });
      v.append(el("div", { class: "panel ex-ds" }, el("h3", {}, `${ds.label} — ${ds.n_items} items`), ...items));
    }
  } catch (e) { v.innerHTML = `<p class="panel">Could not load exercises: ${e.message}</p>`; }
}
async function mountSetup() {
  const v = document.getElementById("view"); v.innerHTML = "";
  try {
    const s = await fetchJSON("data/setup.json");
    const matrix = el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...["model", "variant", "reasoning_effort", "temperature", "top_p", "top_k", "deadline_s"].map(h => el("th", {}, h)))),
      el("tbody", {}, ...s.config_matrix.map(r => el("tr", {},
        ...[r.model, r.variant, r.reasoning_effort, r.temperature, r.top_p, r.top_k, r.call_deadline_s].map(x => el("td", {}, x == null ? "—" : String(x)))))));
    const checks = el("div", { class: "setup-checks" },
      ...s.checks.map(c => el("div", { class: "setup-check" },
        el("span", { class: "chip" }, c.name), el("span", { class: "sc-fam" }, c.tier_family), el("span", { class: "sc-desc" }, c.desc || ""))));
    v.append(
      el("div", { class: "panel" }, el("h3", {}, "Environment"), el("p", {}, s.environment.summary)),
      el("div", { class: "panel" }, el("h3", {}, "Run config"), matrix),
      el("div", { class: "panel" }, el("h3", {}, `Checks & rules (${s.checks.length})`), checks));
  } catch (e) { v.innerHTML = `<p class="panel">Could not load setup: ${e.message}</p>`; }
}

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
