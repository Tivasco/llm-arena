"use strict";
/* board2.js — renderer for the eval battery v2 board.
 *
 * Contract: benchmarks/data/board2.json, schema "llm-arena board2/1".
 *
 * Three rules this file enforces in code, not just in copy:
 *   1. NO TOTAL. Nothing here sums, averages or composites anything across
 *      axes, and no key named total/composite/overall/average is ever read.
 *      A future data file that carried one would still not get one rendered.
 *   2. NO SORT. Bands are rendered in file order; models inside a band are
 *      rendered in file order into an unordered list with visually identical
 *      cards, and the page ships no sort control. A reader must not be able to
 *      read a ranking out of a band.
 *   3. NO BARE POINT ESTIMATE. Every rate is rendered together with its 95%
 *      interval (numerically and as an error bar). A row whose interval is
 *      missing is marked as not reportable rather than shown as a lone number.
 */

/* ── tiny DOM helper (same shape as benchmarks/bench.js) ──────────────────── */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
}

/* Keys this renderer refuses to read, anywhere. See rule 1 above. */
const FORBIDDEN_KEYS = ["total", "composite_score", "overall", "average", "mean_score", "sum"];
function warnOnComposite(data) {
  const seen = new Set();
  const walk = (o, depth) => {
    if (o == null || typeof o !== "object" || depth > 4) return;
    for (const [k, v] of Object.entries(o)) {
      if (FORBIDDEN_KEYS.includes(k)) seen.add(k);
      walk(v, depth + 1);
    }
  };
  walk(data, 0);
  if (seen.size) {
    console.warn("board2: ignoring composite-shaped key(s) in the data file:", [...seen].join(", "),
      "— this board renders no total by design.");
  }
}

/* ── formatting ───────────────────────────────────────────────────────────── */
function pct(x) {
  if (x == null || !isFinite(x)) return "—";
  const s = (x * 100).toFixed(1);
  return (s.endsWith(".0") ? s.slice(0, -2) : s) + "%";
}
function prettyKey(k) { return String(k).replace(/[_-]+/g, " "); }
function isNum(x) { return typeof x === "number" && isFinite(x); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function fmtP(p) {
  if (!isNum(p)) return "—";
  if (p === 0) return "0";
  return p < 1e-4 || p >= 1e5 ? p.toExponential(1) : String(Number(p.toPrecision(4)));
}

/* ── 1. What this board claims / does not claim ───────────────────────────── */
function renderClaims(data) {
  const c = data.claims || {};
  const axes = Array.isArray(data.axes) ? data.axes : [];
  const nAxes = isNum(c.scored_axes) ? c.scored_axes : axes.length;

  const claims = [
    `${nAxes} scored ${nAxes === 1 ? "axis" : "axes"}: ${axes.map(a => a.label).join(", ") || "—"}.`,
    "A 95% interval on every scored cell.",
    "Ordering only where a two-sample test separates two models; otherwise they share a band.",
  ];
  const notClaims = [
    c.composite === false
      ? "No composite. No total, no average, no /75 — this page computes none, client-side or otherwise."
      : "No composite is rendered by this page.",
    "No rank inside a band. Models in the same band are not ordered, and there is no way to sort them.",
    "No score for a model that did not run. An infrastructure failure is excluded, never counted as a zero.",
  ];

  return el("section", { class: "panel b2-claim", "aria-labelledby": "b2-claims-h" },
    el("span", { class: "eyebrow" }, "The claim"),
    el("h2", { id: "b2-claims-h", style: "margin-top:10px" }, "What this board claims — and what it does not"),
    el("div", { class: "b2-claim-grid" },
      el("div", { class: "b2-claim-col" },
        el("h3", {}, "It claims"),
        el("ul", {}, ...claims.map(t => el("li", {}, t)))),
      el("div", { class: "b2-claim-col b2-claim-col--not" },
        el("h3", {}, "It does not claim"),
        el("ul", {}, ...notClaims.map(t => el("li", {}, t))))),
    c.note ? el("p", { class: "b2-claim-note" }, c.note) : null);
}

/* ── 2. The axis, with the unit note that makes the number readable ───────── */
function renderAxes(data) {
  const axes = Array.isArray(data.axes) ? data.axes : [];
  if (!axes.length) return el("section", { class: "b2-section" }, el("p", { class: "panel" }, "No axis in the data file."));

  const cards = axes.map(a => {
    const facts = [
      ["axis id", a.id],
      ["items (n)", isNum(a.n) ? String(a.n) : a.n],
      ["unit", a.unit],
      ["reps", isNum(a.reps) ? String(a.reps) : a.reps],
      ["sampling", a.sampling],
    ].filter(([, v]) => v != null && v !== "");
    return el("section", { class: "panel" },
      el("div", { class: "b2-axis-head" },
        el("h3", {}, a.label || a.id),
        el("span", { class: "chip chip--accent" }, "scored")),
      a.job ? el("p", { class: "b2-axis-job" }, "The job: " + a.job) : null,
      el("div", { class: "b2-axis-facts" },
        ...facts.map(([k, v]) => el("div", { class: "b2-fact" },
          el("span", { class: "b2-fact-k" }, k),
          el("span", { class: "b2-fact-v" }, String(v))))),
      a.unit_note ? el("p", { class: "b2-unitnote" },
        el("b", {}, `how one ${a.unit || "item"} is scored`), a.unit_note) : null);
  });

  return el("section", { class: "b2-section", "aria-labelledby": "b2-axis-h" },
    el("span", { class: "eyebrow" }, "The scored axis" + (axes.length === 1 ? "" : "es")),
    el("h2", { id: "b2-axis-h" }, "What is measured"),
    el("p", { class: "b2-lede" },
      "One axis is scored because one axis has a demonstrated, tested separation on this fleet. " +
      "Read the scoring note before reading any number below it."),
    el("div", { style: "margin-top:calc(var(--space) * 2.5)" }, ...cards));
}

/* ── error bar: interval as a range, estimate as a tick ───────────────────── */
function rateBlock(s, axis) {
  const rate = isNum(s.rate) ? s.rate : null;
  const ci = Array.isArray(s.ci95) && isNum(s.ci95[0]) && isNum(s.ci95[1]) ? s.ci95 : null;
  const unit = axis && axis.unit ? axis.unit : "item";
  const plural = (n, u) => `${u}${n === 1 ? "" : "s"}`;

  // Rule 3: never a lone point estimate.
  if (rate == null) {
    return el("div", {},
      el("div", { class: "b2-rate" }, el("span", { class: "b2-rate-noci" }, "no rate in the data file")));
  }
  if (!ci) {
    return el("div", {},
      el("div", { class: "b2-rate" },
        el("span", { class: "b2-rate-num" }, pct(rate)),
        el("span", { class: "b2-rate-noci" }, "no 95% interval — not reportable")),
      isNum(s.passed) && isNum(s.n)
        ? el("p", { class: "b2-count" }, `${s.passed} / ${s.n} ${plural(s.n, unit)} passed`) : null);
  }

  const lo = clamp01(ci[0]), hi = clamp01(ci[1]), pt = clamp01(rate);
  const label = `pass rate ${pct(rate)}, 95% interval ${pct(lo)} to ${pct(hi)}`;
  return el("div", {},
    el("div", { class: "b2-rate" },
      el("span", { class: "b2-rate-num" }, pct(rate)),
      el("span", { class: "b2-rate-ci" }, `95% CI ${pct(lo)} – ${pct(hi)}`)),
    el("div", { class: "b2-bar", role: "img", "aria-label": label, title: label },
      el("div", { class: "b2-bar-track" },
        el("div", { class: "b2-bar-mid" }),
        el("div", { class: "b2-bar-range", style: `left:${(lo * 100).toFixed(2)}%;width:${((hi - lo) * 100).toFixed(2)}%` }),
        el("div", { class: "b2-bar-point", style: `left:${(pt * 100).toFixed(2)}%` })),
      el("div", { class: "b2-bar-scale" }, el("span", {}, "0%"), el("span", {}, "50%"), el("span", {}, "100%"))),
    isNum(s.passed) && isNum(s.n)
      ? el("p", { class: "b2-count" }, `${s.passed} / ${s.n} ${plural(s.n, unit)} passed`) : null);
}

/* ── 3. Bands — a set, never a ranking ────────────────────────────────────── */
function modelCard(key, row, axes) {
  if (!row) {
    return el("li", { class: "b2-mcard" },
      el("div", { class: "b2-mcard-head" },
        el("h4", {}, key),
        el("span", { class: "b2-mkey" }, key)),
      el("p", { class: "b2-mcard-missing" },
        "Listed in this band, but the data file carries no scored row for it."));
  }
  const parts = [
    el("div", { class: "b2-mcard-head" },
      el("h4", {}, row.model || key),
      row.config ? el("span", { class: "cfg-chip" }, row.config) : null,
      el("span", { class: "b2-mkey" }, row.model_key || key)),
  ];
  for (const axis of axes) {
    const s = (row.scores || {})[axis.id];
    if (!s) {
      parts.push(el("p", { class: "b2-mcard-missing" }, `${axis.label || axis.id}: not in this data file.`));
      continue;
    }
    parts.push(rateBlock(s, axis));
    const chips = [];
    if (s.status && s.status !== "ok") chips.push(el("span", { class: "chip v-warn" }, "status: " + s.status));
    for (const [k, v] of Object.entries(s.detail || {})) {
      chips.push(el("span", { class: "chip", title: `${prettyKey(k)}: ${v}` }, `${prettyKey(k)} ${v}`));
    }
    if (chips.length) parts.push(el("div", { class: "b2-detail" }, ...chips));
  }
  return el("li", { class: "b2-mcard" }, ...parts);
}

function renderBands(data) {
  const axes = Array.isArray(data.axes) ? data.axes : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const byKey = new Map(rows.map(r => [r.model_key, r]));
  const bands = Array.isArray(data.bands) ? data.bands : [];

  const cards = bands.map((b, i) => {
    // File order, both for bands and for the models inside them. No sort.
    const keys = Array.isArray(b.models) ? b.models : [];
    const n = keys.length;
    return el("section", { class: "panel b2-band", "aria-label": `Band: ${b.rank_label || i + 1}` },
      el("div", { class: "b2-band-head" },
        el("span", { class: "chip chip--accent" }, "band"),
        el("h3", {}, b.rank_label || "band"),
        el("span", { class: "b2-band-count" },
          `${n} model${n === 1 ? "" : "s"} · no ordering claimed within this band`)),
      b.note ? el("p", { class: "b2-band-note" }, b.note) : null,
      el("ul", { class: "b2-band-grid" }, ...keys.map(k => modelCard(k, byKey.get(k), axes))));
  });

  const scoredKeys = new Set(bands.flatMap(b => b.models || []));
  const orphans = rows.filter(r => !scoredKeys.has(r.model_key));

  return el("section", { class: "b2-section", "aria-labelledby": "b2-bands-h" },
    el("span", { class: "eyebrow" }, "The board"),
    el("h2", { id: "b2-bands-h" }, "Bands, not a rank"),
    el("p", { class: "b2-lede" },
      "Bands are separated from each other by a two-sample test; the note on each band gives the " +
      "p-value that justifies the split, or the tie that prevents one. Inside a band there is no " +
      "order, no position and no first place — the cards are deliberately equal, and nothing on this " +
      "page will sort them. Two models in one band are a measured tie, not a photo finish."),
    el("div", { style: "margin-top:calc(var(--space) * 2.5)" },
      ...(cards.length ? cards : [el("p", { class: "panel" }, "No bands in the data file.")]),
      ...(orphans.length ? [el("p", { class: "cm-caveat" },
        "Scored but not placed in a band: " + orphans.map(r => r.model || r.model_key).join(", ") + ".")] : [])));
}

/* ── 4. Gates — pass/fail, never summed ───────────────────────────────────── */
function gateBadge(v) {
  const s = v == null ? "" : String(v);
  const low = s.trim().toLowerCase();
  if (low === "unrun" || low === "not run" || low === "" || low === "null")
    return el("span", { class: "b2-badge b2-badge--unrun", title: "This gate was not run for this model." }, "not run");
  if (low.startsWith("pass")) return el("span", { class: "b2-badge b2-badge--pass" }, s);
  if (low.startsWith("fail")) return el("span", { class: "b2-badge b2-badge--fail" }, s);
  return el("span", { class: "b2-badge" }, s);
}
function renderGates(data) {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r.gates || {})) if (!cols.includes(k)) cols.push(k);
  if (!cols.length) return null;

  const table = el("table", { class: "table b2-gates" },
    el("thead", {}, el("tr", {},
      el("th", {}, "Model"),
      ...cols.map(c => el("th", {}, c)))),
    el("tbody", {}, ...rows.map(r => el("tr", {},
      el("td", { class: "b2-gate-model" }, r.model || r.model_key),
      ...cols.map(c => el("td", {}, gateBadge((r.gates || {})[c])))))));

  return el("section", { class: "b2-section", "aria-labelledby": "b2-gates-h" },
    el("span", { class: "eyebrow" }, "Gates — not part of the board"),
    el("h2", { id: "b2-gates-h" }, "Is the deployment working?"),
    el("p", { class: "b2-lede" },
      "A gate answers whether the deployment works, not how good a model is. Gates are pass/fail and " +
      "are never summed into a score — folding a saturated component into a total is exactly what " +
      "invalidated the previous board. A gate marked \"not run\" was not run: it is neither a pass nor a zero."),
    el("div", { class: "panel", style: "margin-top:calc(var(--space) * 2.5);padding-top:calc(var(--space) * 1.5);padding-bottom:calc(var(--space) * 1.5)" },
      el("div", { class: "b2-gate-scroll", style: "margin-top:0" }, table)));
}

/* ── 5. Excluded models — excluded, not zeroed ────────────────────────────── */
function renderExcluded(data) {
  const exc = Array.isArray(data.excluded) ? data.excluded : [];
  if (!exc.length) return null;
  return el("section", { class: "b2-section", "aria-labelledby": "b2-exc-h" },
    el("span", { class: "eyebrow" }, "Excluded"),
    el("h2", { id: "b2-exc-h" }, "Models that did not run"),
    el("p", { class: "b2-lede" },
      "These models are absent from the board because they produced no measurement. They are not " +
      "scored low and they are not scored zero — a model that never answered is not a model that failed."),
    el("ul", { class: "b2-excluded" }, ...exc.map(e => el("li", { class: "b2-exc" },
      el("div", { class: "b2-exc-head" },
        el("h3", {}, e.model || e.model_key),
        el("span", { class: "chip v-warn" }, "excluded — did not run"),
        e.model_key && e.model ? el("span", { class: "b2-mkey" }, e.model_key) : null),
      e.reason ? el("p", {}, e.reason) : null,
      e.scored_as ? el("p", { class: "b2-count" }, "recorded as: " + e.scored_as) : null,
      e.note ? el("p", { class: "b2-exc-note" }, e.note) : null))));
}

/* ── 6. Method: the separation tests and the multiplicity threshold ───────── */
function renderMethod(data) {
  const sep = Array.isArray(data.separation) ? data.separation : [];
  const m = data.multiplicity || {};
  if (!sep.length && !Object.keys(m).length) return null;

  const yesNo = (v) => {
    if (v === true) return el("span", { class: "b2-badge b2-badge--pass" }, "yes");
    if (v === false) return el("span", { class: "b2-badge b2-badge--fail" }, "no");
    return el("span", { class: "b2-badge b2-badge--unrun" }, "—");
  };
  const sepRow = (s) => el("tr", {},
    el("td", { class: "mono" }, s.axis || "—"),
    el("td", { class: "mono" }, `${s.a} vs ${s.b}`),
    el("td", { class: "mono" }, s.test || "—"),
    el("td", { class: "num" }, fmtP(s.p)),
    el("td", {}, yesNo(s.differs)),
    el("td", {}, yesNo(s.clears_bonferroni)));
  const sepHead = el("thead", {}, el("tr", {},
    el("th", {}, "Axis"), el("th", {}, "Pair"), el("th", {}, "Test"),
    el("th", {}, "p"), el("th", {}, "Separates?"), el("th", {}, "Clears Bonferroni?")));
  const table = sep.length
    ? el("div", { class: "b2-sep-scroll" },
        el("table", { class: "table b2-sep" }, sepHead, el("tbody", {}, ...sep.map(sepRow))))
    : null;

  const stats = [
    ["comparisons", m.comparisons],
    ["alpha (raw)", m.alpha_raw],
    ["alpha (Bonferroni)", m.alpha_bonferroni],
    ["applied", m.applied === undefined ? undefined : (m.applied ? "yes" : "no — reported only")],
  ].filter(([, v]) => v !== undefined && v !== null);

  return el("section", { class: "b2-section", "aria-labelledby": "b2-method-h" },
    el("span", { class: "eyebrow" }, "Method"),
    el("h2", { id: "b2-method-h" }, "What separated, and against which threshold"),
    el("p", { class: "b2-lede" },
      "Every band split above rests on one of these tests. Interval overlap is a conservative " +
      "criterion, not a two-sample test, so it is not used to order anything."),
    el("div", { class: "panel", style: "margin-top:calc(var(--space) * 2.5)" },
      table,
      stats.length || m.note ? el("div", { class: "b2-mult" },
        el("div", { class: "b2-mult-stats" },
          ...stats.map(([k, v]) => el("span", { class: "b2-badge" }, `${k}: ${v}`))),
        m.note ? el("p", {}, m.note) : null) : null));
}

/* ── 7. Archive — the v1 board, with its warning verbatim ─────────────────── */
function archiveHref(href) {
  // Data-file hrefs are written relative to /benchmarks/; this page lives one
  // level deeper at /benchmarks/v2/. Leave absolute and already-relative
  // (./, ../) refs alone.
  if (!href) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith("./") || href.startsWith("../")) return href;
  return "../" + href.replace(/^\//, "");
}
function renderArchive(data) {
  const a = data.archive;
  if (!a) return null;
  const href = archiveHref(a.href);
  return el("section", { class: "b2-section", "aria-labelledby": "b2-arch-h" },
    el("span", { class: "eyebrow" }, "Archive"),
    el("h2", { id: "b2-arch-h" }, "The board this one replaces"),
    el("div", { class: "panel b2-archive", style: "margin-top:calc(var(--space) * 2.5)" },
      href
        ? el("a", { class: "b2-archive-link", href }, a.label || "Previous board", el("span", {}, "→"))
        : el("p", { class: "b2-archive-link" }, a.label || "Previous board"),
      a.warning ? el("p", { class: "b2-warning" }, a.warning) : null,
      a.evidence ? el("p", { class: "b2-evidence" }, "Evidence: " + a.evidence) : null));
}

/* ── 8. Reporting rules ───────────────────────────────────────────────────── */
function renderRules(data) {
  const rules = Array.isArray(data.reporting_rules) ? data.reporting_rules : [];
  if (!rules.length && !data.battery_doc) return null;
  return el("section", { class: "b2-section" },
    el("details", { class: "panel b2-rules" },
      el("summary", {}, "Reporting rules — binding"),
      rules.length ? el("ol", {}, ...rules.map(r => el("li", {}, r))) : null,
      data.battery_doc ? el("p", { class: "b2-doc" }, "Contract: " + data.battery_doc) : null));
}

/* ── boot ─────────────────────────────────────────────────────────────────── */
function showError(msg, detail) {
  const board = document.getElementById("board");
  board.innerHTML = "";
  board.append(el("section", { class: "panel b2-error", role: "alert" },
    el("span", { class: "eyebrow" }, "Board unavailable"),
    el("h2", {}, "Could not load the v2 board data"),
    el("p", {}, msg),
    detail ? el("p", { style: "margin-top:10px" }, el("code", {}, detail)) : null,
    el("p", { style: "margin-top:14px" },
      "Nothing is shown rather than an empty board: an empty board would read as ",
      el("em", {}, "no model passed"), ", which is not what happened.")));
  document.getElementById("board-meta").textContent = "data not loaded";
}

async function boot() {
  const board = document.getElementById("board");
  let data;
  try {
    const res = await fetch("../data/board2.json");
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (e) {
    showError("The board reads its numbers from benchmarks/data/board2.json, and that file could not be fetched or parsed.", String(e && e.message || e));
    return;
  }
  if (!data || typeof data !== "object") {
    showError("benchmarks/data/board2.json loaded but is not an object.", String(data));
    return;
  }
  warnOnComposite(data);

  const nAxes = Array.isArray(data.axes) ? data.axes.length : 0;
  const nRows = Array.isArray(data.rows) ? data.rows.length : 0;
  document.getElementById("board-meta").textContent =
    [`battery ${data.battery || "v2"}`,
     `${nAxes} scored ${nAxes === 1 ? "axis" : "axes"}`,
     "no composite",
     `${nRows} model${nRows === 1 ? "" : "s"} scored`,
     data.generated_at ? `generated ${data.generated_at}` : null,
    ].filter(Boolean).join(" · ");

  board.innerHTML = "";
  for (const node of [
    renderClaims(data),
    renderAxes(data),
    renderBands(data),
    renderGates(data),
    renderExcluded(data),
    renderMethod(data),
    renderArchive(data),
    renderRules(data),
  ]) if (node) board.append(node);
}
document.addEventListener("DOMContentLoaded", boot);
