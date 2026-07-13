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
// Makes a non-button element keyboard-operable as a button (WCAG 2.1.1 / 4.1.2).
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
// cost formatters
function fmtMs(ms) { if (ms == null) return "—"; return ms >= 1000 ? (ms / 1000).toFixed(ms >= 10000 ? 0 : 1) + "s" : Math.round(ms) + "ms"; }
function fmtToks(t) { if (t == null) return "—"; return t >= 1000 ? (t / 1000).toFixed(1) + "k" : String(t); }
function fmtTps(x) { return (x == null || x === 0) ? "—" : x.toFixed(0); }

let LB = null, sortTier = "overall";

function leaderboardRows() {
  const rows = [...LB.rows];
  rows.sort((a, b) => {
    const ra = sortTier === "overall" ? a.best.overall.rate : (a.best.scores[sortTier]?.rate ?? -1);
    const rb = sortTier === "overall" ? b.best.overall.rate : (b.best.scores[sortTier]?.rate ?? -1);
    return rb - ra;
  });
  return rows;
}
function renderLeaderboard() {
  const b = LB;
  const sortBy = (id) => activatable(() => { sortTier = id; mountLeaderboard(); }, { "aria-label": `Sort by ${id}` });
  const head = el("tr", {},
    el("th", { class: "lb-model", ...sortBy("overall") }, "Model"),
    ...b.tiers.map(t => el("th", { class: "lb-tier", title: t.job, ...sortBy(t.id) },
      el("div", { class: "lb-tier-label" }, t.label), el("div", { class: "lb-tier-job" }, t.job))),
    el("th", { ...sortBy("overall") }, "Overall"),
    el("th", { class: "lb-cfg-h" }, "Best config"),
    el("th", { class: "lb-tps-h", title: "tokens ÷ end-to-end latency (throughput, not decode speed)" }, "tok/s"));
  const body = leaderboardRows().map(row => {
    const bc = row.best;
    return el("tr", { class: "lb-row", ...activatable(() => openModel(row),
        { "aria-haspopup": "dialog", "aria-label": `${row.model}: ${row.n_configs} configs — open detail` }) },
      el("td", { class: "lb-model" },
        el("div", {}, row.model),
        el("div", { class: "lb-sub" }, [row.family, row.size].filter(Boolean).join(" · ") + ` · ${row.n_configs} config${row.n_configs === 1 ? "" : "s"}`)),
      ...b.tiers.map(t => {
        const c = bc.scores[t.id];
        if (!c) return el("td", { class: "lb-cell v-none" }, "—");
        return el("td", { class: `lb-cell ${verdictClass(c.rate, b.verdict_buckets)}`, title: `${c.pass}/${c.total} passed` }, `${c.pass}/${c.total}`);
      }),
      el("td", { class: "lb-cell lb-overall" }, `${bc.overall.pass}/${bc.overall.total}`),
      el("td", { class: "lb-cfg" }, el("span", { class: `cfg-chip cfg-${bc.config.reasoning}` }, bc.label)),
      el("td", { class: "lb-cell lb-tps" }, fmtTps(bc.cost.tok_s)));
  });
  return el("table", { class: "table lb" }, el("thead", {}, head), el("tbody", {}, ...body));
}
function mountLeaderboard() {
  const v = document.getElementById("view");
  v.innerHTML = "";
  v.append(
    el("div", { class: "lb-legend" },
      el("span", { class: "chip v-go" }, "automate ≥85%"),
      el("span", { class: "chip v-warn" }, "supervise 60–84%"),
      el("span", { class: "chip v-stop" }, "escalate <60%"),
      el("span", { class: "lb-note" }, "each model at its best single config · click a row for every config")),
    el("div", { class: "lb-scroll" }, renderLeaderboard()));
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

// Model detail: every config (reasoning × temp × quant) with per-tier scores + cost.
async function openModel(row) {
  let m;
  try { m = await fetchJSON("data/" + row.detail); }
  catch (e) { openPanel(row.model, el("p", {}, "Could not load detail: " + e.message)); return; }
  const tiers = LB.tiers;
  const head = el("tr", {},
    el("th", { class: "cm-cfg" }, "Config"),
    ...tiers.map(t => el("th", { title: t.job }, t.label)),
    el("th", {}, "Overall"),
    el("th", { title: "tokens ÷ end-to-end latency" }, "tok/s"),
    el("th", { title: "median item latency" }, "time"),
    el("th", { title: "total completion tokens over 75 items" }, "tokens"),
    el("th", { title: "truncated items" }, "trunc"));
  const rows = m.configs.map((c, i) => {
    const best = i === 0;
    return el("tr", { class: best ? "cm-best" : "" },
      el("td", { class: "cm-cfg" },
        el("span", { class: `cfg-chip cfg-${c.config.reasoning}` }, c.label),
        best ? el("span", { class: "cm-bestflag" }, "BEST") : null),
      ...tiers.map(t => {
        const s = c.scores[t.id];
        return s ? el("td", { class: `lb-cell ${verdictClass(s.rate, LB.verdict_buckets)}` }, `${s.pass}/${s.total}`)
                 : el("td", { class: "lb-cell v-none" }, "—");
      }),
      el("td", { class: "lb-cell lb-overall" }, `${c.overall.pass}/${c.overall.total}`),
      el("td", { class: "cm-cost" }, fmtTps(c.cost.tok_s)),
      el("td", { class: "cm-cost" }, fmtMs(c.cost.median_latency_ms)),
      el("td", { class: "cm-cost" }, fmtToks(c.cost.total_completion_tokens)),
      el("td", { class: "cm-cost" }, String(c.cost.truncation || 0)));
  });
  const table = el("div", { class: "cm-scroll" },
    el("table", { class: "table cm" }, el("thead", {}, head), el("tbody", {}, ...rows)));
  openPanel(m.model, el("div", { class: "mc" },
    el("p", { class: "mc-fam" }, [m.family, m.size].filter(Boolean).join(" · ") + ` · ${m.configs.length} configs tested`),
    table,
    el("p", { class: "cm-caveat" },
      "tok/s is end-to-end throughput (tokens ÷ total call latency), not decode speed — short reasoning-off answers read low because a fixed prefill+network cost dominates. time = median item latency; tokens = total completion (reasoning + answer) over 75 items.")));
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
        el("span", { class: "ex-colkey-title" }, "Columns — leaderboard order (best config)"),
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
    LB = await fetchJSON("data/leaderboard.json");
    document.getElementById("board-meta").textContent =
      `${LB.rows.length} models · best-config leaderboard · generated ${LB.generated_at}`;
    renderTabs();
    selectTab("leaderboard");
  } catch (e) {
    document.getElementById("view").innerHTML = `<p class="panel">Could not load leaderboard data: ${e.message}</p>`;
  }
}
document.addEventListener("DOMContentLoaded", boot);
