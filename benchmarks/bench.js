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
// Makes a non-button element keyboard-operable as a button: adds role/tabindex,
// the click handler, and Enter/Space activation. `extra` merges extra attrs
// (e.g. aria-haspopup, aria-label). Used for the table cells / accordion heads
// that must stay <td>/<div> for layout but need to be real controls (WCAG 2.1.1 / 4.1.2).
function activatable(handler, extra = {}) {
  return {
    role: "button", tabindex: "0",
    onclick: handler,
    onkeydown: (e) => { if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); handler(e); } },
    ...extra,
  };
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
  const sortBy = (id) => activatable(() => { sortTier = id; mountLeaderboard(); }, { "aria-label": `Sort by ${id}` });
  const head = el("tr", {},
    el("th", { class: "lb-model", ...sortBy("overall") }, "Model"),
    ...b.tiers.map(t => el("th", { class: "lb-tier", title: t.job, ...sortBy(t.id) },
      el("div", { class: "lb-tier-label" }, t.label), el("div", { class: "lb-tier-job" }, t.job))),
    el("th", { ...sortBy("overall") }, "Overall"));
  const body = leaderboardRows().map(row => el("tr", {},
    el("td", { class: "lb-model", ...activatable(() => openCard(row.model, row.variant),
        { "aria-haspopup": "dialog", "aria-label": `Model card: ${row.label}` }) },
      el("div", {}, row.label),
      el("div", { class: "lb-sub" }, [row.family, row.size].filter(Boolean).join(" · "))),
    ...b.tiers.map(t => {
      const c = row.scores[t.id];
      if (!c) return el("td", { class: "lb-cell v-none" }, "—");
      return el("td", { class: `lb-cell ${verdictClass(c.rate, b.verdict_buckets)}${c.borderline ? " lb-borderline" : ""}`,
        title: `${c.pass}/${c.total} passed${c.borderline ? " · borderline" : ""}`,
        ...activatable(() => openDrill(row, t),
          { "aria-haspopup": "dialog", "aria-label": `${row.label} ${t.label}: ${c.pass} of ${c.total} passed — open details` }) },
        `${c.pass}/${c.total}`);
    }),
    el("td", { class: "lb-cell lb-overall" }, `${row.overall.pass}/${row.overall.total}`)));
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
function itemRow(it) {
  const failed = it.pass === false;
  const head = el("div", { class: `di-head ${failed ? "di-fail" : "di-pass"}`, "aria-expanded": failed ? "true" : "false",
    ...activatable((e) => {
      const body = e.currentTarget.nextElementSibling;
      const show = body.style.display === "none";
      body.style.display = show ? "" : "none";
      e.currentTarget.setAttribute("aria-expanded", show ? "true" : "false");
    }) },
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
      el("span", {}, `truncation ${Math.round((st.truncation_rate || 0) * (st.n_calls || 0))}/${st.n_calls || 0}`),
      el("span", {}, `errors ${Math.round((st.error_rate || 0) * (st.n_calls || 0))}/${st.n_calls || 0}`)),
    el("p", { class: "mc-lastrun", style: "color:var(--text-muted)" }, `last run ${m.last_run}`)));
}
let EXRES = null;
async function mountExercises() {
  const v = document.getElementById("view"); v.innerHTML = "";
  try {
    const ex = await fetchJSON("data/exercises.json");
    if (EXRES === null) { try { EXRES = await fetchJSON("data/exercise_results.json"); } catch (_) { EXRES = false; } }
    const models = EXRES && EXRES.models;
    if (models) {
      v.append(el("div", { class: "panel ex-colkey" },
        el("span", { class: "ex-colkey-title" }, "Columns — leaderboard order"),
        ...models.map((m, i) => el("span", { class: "ex-colkey-item" }, el("b", {}, String(i + 1)), m.label))));
    }
    for (const ds of ex.datasets) {
      const results = models && EXRES.datasets[ds.id];
      const items = ds.items.map(it => {
        const crit = (it.checks || []).map(c =>
          el("span", { class: "chip", title: c.desc || "" }, c.name + (c.params && Object.keys(c.params).length ? " " + JSON.stringify(c.params) : "")));
        const rules = (it.rules || []).map(r => el("span", { class: "chip" }, r.rule + (r.value ? " " + JSON.stringify(r.value) : "")));
        const gold = it.gold_passes === true ? el("span", { class: "chip v-go" }, "gold ✓")
                   : it.gold_passes === false ? el("span", { class: "chip v-stop" }, "gold ✗") : null;
        const head = el("div", { class: "ex-head", "aria-expanded": "false",
          ...activatable((e) => {
            const item = e.currentTarget.closest(".ex-item");
            const b = item.querySelector(".ex-body");
            const show = b.style.display === "none";
            b.style.display = show ? "" : "none";
            e.currentTarget.setAttribute("aria-expanded", show ? "true" : "false");
          }) },
          el("span", { class: "ex-id" }, it.id),
          el("span", { class: "ex-meta" }, [it.category, (it.difficulty ?? it.level) != null ? "L" + (it.difficulty ?? it.level) : null].filter(Boolean).join(" · ")));
        const arr = results && results[it.id];
        const resultsStrip = arr ? el("div", { class: "ex-results" },
          el("span", { class: "ex-count" }, `${arr.filter(x => x === true).length}/${arr.filter(x => x != null).length} passed`),
          el("div", { class: "hm" }, ...arr.map((val, i) => {
            const tip = `${models[i].label} — ${val === true ? "pass" : val === false ? "fail" : "—"}`;
            return el("span", { class: "hm-cell " + (val === true ? "hm-go" : val === false ? "hm-stop" : "hm-none"),
              "data-tip": tip, "aria-label": tip });
          }))) : null;
        const body = el("div", { class: "ex-body", style: "display:none" },
          el("div", { class: "ex-prompt" }, it.prompt),
          el("div", { class: "ex-crit" }, ...crit, ...rules, gold));
        return el("div", { class: "ex-item" }, head, resultsStrip, body);
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
