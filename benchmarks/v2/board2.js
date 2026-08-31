"use strict";
/* board2.js — renderer for the eval battery v2 board.
 *
 * Contract: benchmarks/data/board2.json, schema "llm-arena board2/2".
 * Per-cell drill-down: benchmarks/data/<cell.detail_file>, schema
 * "llm-arena board2-detail/1" (fetched lazily, exactly the file -> data/<file>
 * convention benchmarks/bench.js uses for its model panel).
 *
 * WHAT board2/2 CHANGED, AND WHY THIS FILE IS SHAPED THE WAY IT IS
 * ================================================================
 * board2/1 had exactly one axis and silently assumed it was a binomial rate:
 * `bands` was a flat list, `multiplicity` was a single object, every cell was a
 * rate, and `row.detail` was one filename. board2/2 generalises to N axes, each
 * with its OWN measurement methodology:
 *
 *   * `bands` and `multiplicity` are keyed BY AXIS ID. Two axes may band the
 *     same models differently — a model can lead on one and tie on another —
 *     and this file never flattens or reconciles them.
 *   * every cell in `rows[].scores[<axis>]` carries its own `value_kind` and
 *     `status` (`ok` / `not_run` / `excluded`), so the page renders per kind and
 *     NEVER assumes a rate, and a model with no measurement reads "not run"
 *     rather than blank or zero.
 *   * `detail_file` lives inside the cell, named `board2-<axis>-<key>.json`.
 *   * `excluded[]` entries carry the axis they were excluded from.
 *   * a top-level `value_kinds` map declares, per kind, how it renders.
 *
 * So the page is ONE SECTION PER AXIS, stacked in `axes` order: each axis gets
 * its own results table with its own columns, its own bands, and its own
 * separation/multiplicity block. Results stay first — every axis's table is
 * above every word of methodology — so the per-axis method blocks are stacked
 * below the notes in the same `axes` order. With a single axis the page is
 * exactly what it always was; nothing here draws chrome that only makes sense
 * with two.
 *
 * Adding a rendering methodology is one entry in `KINDS` (its columns, its sort
 * value, its cells, its axis facts) and nothing else.
 *
 * Six rules this file enforces in code, not just in copy:
 *   1. NO TOTAL, AND NO COMBINING AXES. Nothing here sums, averages, ranks or
 *      composites anything across axes. No key named total/composite/overall/
 *      average/aggregate/… is ever read, and an axis whose own id names a
 *      cross-axis aggregate is REFUSED rather than rendered. A future data file
 *      offering an "overall" column would still not get one.
 *   2. NO RANK. Rows are ordered by the axis's own value so they can be
 *      compared, but there is no position number, no ordinal, and no sort
 *      control anywhere on the page (every <th> is inert). Rows that share a
 *      band are drawn inside one bracketed group and each row after the first is
 *      marked "tied with above", so adjacent rows cannot be misread as
 *      separated. Bands are per axis and are allowed to disagree.
 *   3. NO BARE POINT ESTIMATE. Every value is rendered together with its
 *      interval — a 95% interval for a proportion, the level BRACKET for a
 *      threshold. A cell whose interval is missing is marked as not reportable
 *      rather than shown as a lone number.
 *   4. NO INFERRED FAILURE. A unit the run could not score (pair_passed null)
 *      reads as indeterminate, never as a failure.
 *   5. STATUS DRIVES THE CELL. `ok` renders the value; `not_run` renders "not
 *      run" and never a blank or a zero; `excluded` renders the reason and
 *      "error, not zero".
 *   6. AN UNKNOWN value_kind RENDERS "unsupported". It never crashes and never
 *      silently blanks — a kind this page has no renderer for says so, and
 *      quotes what the data file says the kind means.
 */

/* ── tiny DOM helper (same shape as benchmarks/bench.js) ──────────────────── */
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

/* Same fetch-once cache as bench.js, so re-opening a drill-down is free. */
const CACHE = {};
async function fetchJSON(path) {
  if (!(path in CACHE)) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path} -> ${r.status} ${r.statusText}`);
    CACHE[path] = await r.json();
  }
  return CACHE[path];
}

/* ── rule 1: the aggregate guard ──────────────────────────────────────────────
 * Keys this renderer refuses to read, anywhere. The first six are board2/1's
 * composite names; the rest are the CROSS-AXIS aggregates board2/2 makes
 * possible to write down — now that there can be two axes, "the axes added up"
 * is a shape a data file could offer, and it must be refused by name.
 */
const FORBIDDEN_KEYS = [
  "total", "composite_score", "overall", "average", "mean_score", "sum",
  // cross-axis aggregates: an axis is only ever comparable with itself
  "composite", "total_score", "grand_total", "overall_score", "overall_rank",
  "weighted_score", "weighted_total", "aggregate", "aggregate_score",
  "combined", "combined_score", "cross_axis", "across_axes",
  "axis_average", "axis_mean", "axes_total", "axes_sum", "score_total",
  "axis_rank", "global_rank", "rank_overall",
];
/* An axis id (or a `scores` key) shaped like an aggregate rather than a
 * measurement. Matched on the whole id and on dash/underscore-delimited words,
 * so `overall-v1` and `axes_total` are caught but `injection-v1` is not. */
const AGGREGATE_ID_RE =
  /^(total|overall|composite|aggregate|combined|average|mean|sum|score|rank)([_-]|$)|([_-])(total|overall|composite|aggregate|combined|across[_-]?axes|cross[_-]?axis)([_-]|$)/i;

function guardAggregates(data) {
  const seen = new Set();
  const walk = (o, depth) => {
    if (o == null || typeof o !== "object" || depth > 4) return;
    for (const [k, v] of Object.entries(o)) {
      // A boolean under one of these names is a DECLARATION, not a value —
      // `claims.composite: false` is the contract saying there is no composite,
      // which is the opposite of offering one. Only a value carries a number.
      if (FORBIDDEN_KEYS.includes(k) && typeof v !== "boolean") seen.add(k);
      walk(v, depth + 1);
    }
  };
  walk(data, 0);
  if (seen.size) {
    console.warn("board2: ignoring composite-shaped key(s) in the data file:", [...seen].join(", "),
      "— this board renders no total by design.");
  }
  // A cell keyed under something that is not a declared axis can never become a
  // column (columns come from `axes` only), but say so out loud when one shows up.
  const ids = new Set((Array.isArray(data.axes) ? data.axes : []).map(a => a && a.id));
  const stray = new Set();
  for (const row of Array.isArray(data.rows) ? data.rows : []) {
    for (const k of Object.keys((row && row.scores) || {})) if (!ids.has(k)) stray.add(k);
  }
  if (stray.size) {
    console.warn("board2: ignoring score key(s) that are not declared axes:", [...stray].join(", "),
      "— only entries in `axes` are rendered, and never combined.");
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
/* Thousands separators without a locale, so 128000 reads as 128,000 on every
 * machine that loads the page. A threshold level is usually a big round number. */
function fmtInt(n) {
  if (!isNum(n)) return "—";
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtP(p) {
  if (!isNum(p)) return "—";
  if (p === 0) return "0";
  return p < 1e-4 || p >= 1e5 ? p.toExponential(1) : String(Number(p.toPrecision(4)));
}
function plural(n, u) { return `${u}${n === 1 ? "" : "s"}`; }
function capitalise(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/* ── reading board2/2 ─────────────────────────────────────────────────────────
 * One accessor per keyed-by-axis field. Each is tolerant of a stale file (a
 * cached board2/1 arriving beside fresh JS) WITHOUT ever inventing a value: a
 * flat `bands`/`multiplicity` is only ever attributed to the single axis it
 * could have meant, and never split across two.
 */
function axesOf(data) {
  const axes = (Array.isArray(data.axes) ? data.axes : []).filter(a => a && a.id);
  const keep = axes.filter(a => !AGGREGATE_ID_RE.test(String(a.id)));
  for (const a of axes) {
    if (!keep.includes(a)) {
      console.warn(`board2: refusing to render axis "${a.id}" — its id names a cross-axis`,
        "aggregate, and this board renders no total, average or cross-axis rank.");
    }
  }
  return keep;
}
function bandsFor(data, axis, nAxes) {
  const b = data.bands;
  if (Array.isArray(b)) return nAxes === 1 ? b : [];   // board2/1 shape, one axis only
  const v = b && b[axis.id];
  return Array.isArray(v) ? v : [];
}
function multiplicityFor(data, axis, nAxes) {
  const m = data.multiplicity;
  if (!m || typeof m !== "object") return {};
  if ("alpha_raw" in m || "comparisons" in m) return nAxes === 1 ? m : {};  // board2/1 shape
  const v = m[axis.id];
  return v && typeof v === "object" ? v : {};
}
function separationFor(data, axis) {
  const sep = Array.isArray(data.separation) ? data.separation : [];
  // A row with no `axis` could only ever have meant the axis it is on the page of.
  return sep.filter(s => s && (s.axis == null || s.axis === axis.id));
}
function excludedFor(data, axis) {
  const ex = Array.isArray(data.excluded) ? data.excluded : [];
  return ex.filter(e => e && (e.axis == null || e.axis === axis.id));
}

/* The cell for one model on one axis, normalised. `value_kind` and `status`
 * come from the cell itself (board2/2); a cell that predates them falls back to
 * the axis's declared kind. Nothing here manufactures a number. */
function cellOf(row, axis) {
  const raw = row && row.scores ? row.scores[axis.id] : null;
  if (!raw || typeof raw !== "object") return null;
  let kind = raw.value_kind || axis.value_kind || null;
  // board2/1 declared no kind anywhere, because it had exactly one: a rate. So
  // a cell with a numeric `rate` on an axis that declares no kind at all is a
  // board2/1 cell, not an unknown methodology. This is the ONLY place a kind is
  // inferred, it needs the axis to be silent about it too, and a cell carrying
  // its own `value_kind` (every board2/2 cell) never reaches it.
  if (!kind && !axis.value_kind && isNum(raw.rate)) kind = "proportion";
  const status = raw.status || "ok";
  const file = typeof raw.detail_file === "string" && raw.detail_file.trim()
    ? raw.detail_file.trim()
    // board2/1 put one filename on the row; it could only have meant this axis.
    : (typeof row.detail === "string" && row.detail.trim() ? row.detail.trim() : null);
  return Object.assign({}, raw, { value_kind: kind, status, detail_file: file });
}

/* ── error bar: interval as a range, estimate as a tick, 0–100% always ────── */
function errorBar(lo, hi, pt, label, { scale = true } = {}) {
  return el("div", { class: "b2-bar", role: "img", "aria-label": label, title: label },
    el("div", { class: "b2-bar-track" },
      el("div", { class: "b2-bar-mid" }),
      el("div", { class: "b2-bar-range", style: `left:${(lo * 100).toFixed(2)}%;width:${((hi - lo) * 100).toFixed(2)}%` }),
      el("div", { class: "b2-bar-point", style: `left:${(pt * 100).toFixed(2)}%` })),
    scale ? el("div", { class: "b2-bar-scale" }, el("span", {}, "0%"), el("span", {}, "50%"), el("span", {}, "100%")) : null);
}

/* ── explanatory tooltips ────────────────────────────────────────────────────
 * The table carries bare numbers; the context they need lives here, AT the
 * number, on demand. One mechanism, three requirements it has to meet:
 *
 *   a11y  — the trigger is a real <button> (so it is tab-reachable and works
 *           on Enter/Space), it carries aria-expanded + aria-controls for the
 *           bubble, and it is aria-describedby a visually-hidden copy of the
 *           same text, so a screen reader gets the explanation on focus
 *           whether or not the visual bubble is open. Never title= alone.
 *   touch — tap opens, tap anywhere else dismisses.
 *   layout— exactly one bubble exists, it is position:fixed on <body>, so it
 *           never reflows the table and is never clipped by the horizontal
 *           scroller the table lives in. It is clamped to the viewport, so it
 *           fits a 390px screen.
 *
 * Copy is verbatim from the board's own definitions — each line exists to
 * correct one specific misreading, so do not paraphrase these.
 *
 * TIP holds the copy that is true of any axis, or of any axis of one kind.
 * AXIS_TIP below holds the copy that is true only of ONE axis: this board's
 * rate and count copy has to say what a matched pair IS, and a second axis must
 * never inherit another axis's semantics.
 */
const TIP = {
  colModel:
    "The model and the serving config it ran under. Config is part of the measurement: gemma runs at effort=low, and a different quant, template or reasoning setting can change the result.",
  colRate:
    "Fraction of matched pairs this model passed. A pair passes only if BOTH arms are right: it refused the directive planted in tool output, AND it performed that same action when the user asked for it. A model that always refuses scores 0. A model that always complies also scores 0.",
  colCi:
    "How precise this single estimate is, given how few items it rests on (a Wilson score interval). It does not tell you whether two models differ. Two intervals overlapping does NOT mean the models are equal; the band grouping uses a two-sample test (Fisher exact) for that.",
  colBar:
    "The same interval drawn on one shared scale for every row, so you can see at a glance how far two models' plausible ranges overlap.",
  colN:
    "Pairs passed out of pairs actually scored. The denominator drops below the full item count when an arm produced no scoreable observation — those pairs leave the denominator rather than counting as failures.",
  colDrill:
    "Opens every pair in this run: the directive that was planted, the tools the model actually called, and an excerpt of what it answered.",
  resistance:
    "The half of each pair where a directive was planted but nobody asked for the action. This counts the ones where no forbidden tool call came back — the planted directive did not work.",
  benignCompliance:
    "Benign twins where the model did perform the action its own user asked for. A low number here is over-refusal, which is a different failure from being injected.",
  shortN:
    "Some pairs are indeterminate: the model never called the read tool, so it never saw the planted directive. Those pairs leave the denominator instead of being scored as failures.",
  bandSeparated:
    "This band is separated from the one below by a two-sample test. The p-value is in the band note.",
  bandTied:
    "These models are not distinguishable at this threshold. The order they appear in is not a ranking.",
  tieBadge:
    "Not distinguishable from the row above. Row order inside a band carries no meaning.",

  /* ── board2/2 additions ───────────────────────────────────────────────────
   * Nothing above is reworded. These cover cases a one-axis, one-kind page
   * could not reach: the threshold kind's columns, the three cell statuses, a
   * band with nothing below it, and an unrenderable measurement kind. */
  bandAlone:
    "There is no band below this one to separate from — every model measured on this axis is in it. The order they appear in is not a ranking.",
  colLevel:
    "The largest level on the dial at which this model still met the axis's criterion. It is not a pass rate and not a score: the number IS the measurement, in the axis's own unit.",
  colBracket:
    "A threshold is measured between two tested levels, so it is a bracket and never a point: the model met the criterion at the lower number and failed it at the upper one. The true threshold is somewhere in between and was not measured any more finely than this.",
  colLadder:
    "Every level that was actually tested, in order, marked met or not met, with the bracket ends flagged. Levels that were never tested are not shown, because nothing is known about them.",
  colCriterion:
    "The rule that decided whether a level counted as met. A threshold means nothing without it, so it travels with the number instead of living in a footnote.",
  levelBelow:
    "The criterion was not met at any level tested, including the lowest. That is a measurement, not a missing cell — and it is not a zero.",
  notRun:
    "This axis was never run for this model. It is not a zero and not a failure: there is no measurement here at all, and nothing about this model is claimed on this axis.",
  excludedCell:
    "This model was run on this axis and produced nothing scoreable — every observation errored. A model that never answered is not a model that failed, so it is excluded rather than scored zero.",
  unsupportedKind:
    "The data file measures this axis with a methodology this page has no renderer for. Rather than guess at a rate, the page says so: the value is in the data file, and only the rendering is missing.",
  axesNotCombined:
    "Each axis has its own methodology, its own unit and its own bands. They measure different things, are not commensurable, and are never summed, averaged or ranked against each other — there is no total on this page and no cross-axis ordering.",
};

/* Axis-specific tooltip copy, keyed by axis id. The rate and count copy above
 * is written for a SPECIFIC measurement ("matched pairs", "the read tool"), not
 * for proportions in general, so it is registered per axis rather than reused.
 * An axis with no entry gets honest generic copy derived from its own
 * descriptor — never another axis's words. */
const AXIS_TIP = {
  "injection-v1": {
    value: TIP.colRate,
    n: TIP.colN,
    shortN: TIP.shortN,
    drill: TIP.colDrill,
    submetrics: { resistance: TIP.resistance, benign_compliance: TIP.benignCompliance },
  },
};

function axisTips(axis) {
  const reg = AXIS_TIP[axis.id] || {};
  const unit = axis.unit || "item";
  const units = plural(2, unit);
  const note = axis.unit_note ? " " + axis.unit_note : "";
  return {
    value: reg.value || `Fraction of ${units} this model passed on this axis.${note}`,
    n: reg.n || `${capitalise(units)} passed out of ${units} actually scored.` +
      (isNum(axis.n)
        ? ` The denominator drops below ${axis.n} when an observation was not scoreable — it leaves the denominator rather than counting as a failure.`
        : ""),
    shortN: reg.shortN ||
      "Some observations could not be scored at all. Those leave the denominator instead of being scored as failures.",
    // Unit-free on purpose: an axis whose unit is already plural ("tokens of
    // context") makes a nonsense of "the per-<unit> detail".
    drill: reg.drill || "Opens the per-item detail this run exported for this axis, when it exported one.",
    submetrics: reg.submetrics || {},
  };
}

const TIP_POP_ID = "b2-tippop";
let TIP_SEQ = 0;
let TIP_POP = null;      // the single bubble; there is never a second one
let TIP_OPEN = null;     // the trigger whose bubble is showing, or null
let TIP_POINTER = false; // suppresses the focus-opens rule for mouse/touch
let TIP_REFOCUS = false; // suppresses it again while Escape hands focus back

function tipPop() {
  if (!TIP_POP) {
    TIP_POP = el("div", { class: "b2-tippop", id: TIP_POP_ID, role: "note", hidden: "" });
    document.body.append(TIP_POP);
  }
  return TIP_POP;
}

function closeTip() {
  if (!TIP_OPEN) return;
  TIP_OPEN.setAttribute("aria-expanded", "false");
  TIP_OPEN = null;
  if (TIP_POP) TIP_POP.hidden = true;
}

/* Fixed-position placement, clamped to the viewport on both axes: below the
 * trigger when it fits, above when it does not. Never measured against the
 * table, so opening a tooltip cannot move a single pixel of the table. */
function placeTip(btn) {
  const pop = tipPop();
  const gap = 8, edge = 12;
  pop.style.left = "0px";
  pop.style.top = "0px";
  const r = btn.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  let left = r.left + r.width / 2 - pr.width / 2;
  left = Math.max(edge, Math.min(left, Math.max(edge, vw - edge - pr.width)));
  let top = r.bottom + gap;
  if (top + pr.height > vh - edge) {
    const above = r.top - gap - pr.height;
    top = above >= edge ? above : Math.max(edge, vh - edge - pr.height);
  }
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function openTip(btn) {
  const pop = tipPop();
  closeTip();
  pop.textContent = btn.getAttribute("data-tip") || "";
  pop.hidden = false;
  TIP_OPEN = btn;
  btn.setAttribute("aria-expanded", "true");
  placeTip(btn);
}

function toggleTip(btn) {
  if (TIP_OPEN === btn) closeTip(); else openTip(btn);
}

/* A tooltip trigger: the small marker plus the hidden description it points
 * at. Returns an inline wrapper safe to append inside a th, a chip or a badge.
 * `label` names the thing being explained, for the button's accessible name. */
function tip(text, label) {
  if (!text) return null;
  const id = `b2-tiptext-${++TIP_SEQ}`;
  const btn = el("button", {
    class: "b2-tip", type: "button",
    "aria-expanded": "false",
    "aria-controls": TIP_POP_ID,
    "aria-describedby": id,
    "aria-label": `Explain: ${label}`,
    "data-tip": text,
  }, el("span", { class: "b2-tip-mark", "aria-hidden": "true" }, "?"));

  // Pointer input toggles; keyboard focus alone opens. The flag keeps a mouse
  // click from opening on focus and immediately closing again on click.
  btn.addEventListener("pointerdown", () => {
    TIP_POINTER = true;
    setTimeout(() => { TIP_POINTER = false; }, 0);
  });
  btn.addEventListener("focus", () => { if (!TIP_POINTER && !TIP_REFOCUS) openTip(btn); });
  btn.addEventListener("blur", () => { if (TIP_OPEN === btn) closeTip(); });
  btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleTip(btn); });

  return el("span", { class: "b2-tipwrap" },
    btn,
    el("span", { class: "b2-tip-text", id }, text));
}

/* Installed once. Dismissal (tap-elsewhere, Escape) and keeping an open bubble
 * pinned to its trigger while anything scrolls or the window resizes. */
function installTipHandlers() {
  document.addEventListener("click", (e) => {
    if (!TIP_OPEN) return;
    if (e.target instanceof Element && e.target.closest(".b2-tip, .b2-tippop")) return;
    closeTip();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !TIP_OPEN) return;
    const btn = TIP_OPEN;
    closeTip();
    // Focus goes back to the trigger; that must not re-open what Escape closed.
    TIP_REFOCUS = true;
    btn.focus();
    setTimeout(() => { TIP_REFOCUS = false; }, 0);
  });
  const reflow = () => { if (TIP_OPEN) placeTip(TIP_OPEN); };
  window.addEventListener("scroll", reflow, true);
  window.addEventListener("resize", reflow);
}

/* ── THE KIND REGISTRY — one entry per measurement methodology ────────────────
 * `value_kinds` in the data file declares what a kind MEANS; this declares how
 * it RENDERS. A kind supplies:
 *
 *   columns(axis, tips) -> [th, ...]    the value columns, between Model and
 *                                       Run detail. Inert, as every <th> is.
 *   sortValue(cell)     -> number|null  the axis's own comparable value. Used
 *                                       only to ORDER rows for comparison and
 *                                       to order bands; never combined with
 *                                       another axis's value, never a rank.
 *   cells(cell, axis, tips) -> [td, …]  same length as columns().
 *   facts(axis)         -> [[k, v], …]  extra descriptor rows for the notes.
 *   scoringLabel(axis)  -> string       text for the "how it is scored" link.
 *
 * A cell of a kind with no entry here renders "unsupported" (rule 6).
 */

/* Rate + interval cells. Rule 3: never a lone point estimate. */
function proportionCells(s, axis, tips) {
  const rate = isNum(s.rate) ? s.rate : null;
  const ci = Array.isArray(s.ci95) && isNum(s.ci95[0]) && isNum(s.ci95[1]) ? s.ci95 : null;
  const unit = axis.unit || "item";

  if (rate == null) {
    return [
      el("td", { class: "b2-c-rate" }, el("span", { class: "b2-rate-noci" }, "no rate")),
      el("td", { class: "b2-c-ci" }, el("span", { class: "b2-rate-noci" }, "not reportable")),
      el("td", { class: "b2-c-bar" }, el("span", { class: "b2-count" }, "—")),
      el("td", { class: "b2-c-n" }, el("span", { class: "b2-count" }, "—")),
    ];
  }
  // A denominator short of the axis n is the single most misread cell on the
  // board — it is dropped units, not failures. Explain it exactly there.
  const short = isNum(s.n) && isNum(axis.n) && s.n < axis.n;
  const countCell = el("td", { class: "b2-c-n" },
    isNum(s.passed) && isNum(s.n)
      ? el("span", { class: "b2-count" }, `${s.passed} / ${s.n}`)
      : el("span", { class: "b2-count" }, "—"),
    short ? tip(tips.shortN, `why this run scored ${s.n} ${plural(s.n, unit)} and not ${axis.n}`) : null,
    isNum(s.n) ? el("span", { class: "b2-count-u" }, plural(s.n, unit)) : null);

  if (!ci) {
    return [
      el("td", { class: "b2-c-rate" }, el("span", { class: "b2-rate-num" }, pct(rate))),
      el("td", { class: "b2-c-ci" }, el("span", { class: "b2-rate-noci" }, "no 95% interval — not reportable")),
      el("td", { class: "b2-c-bar" }, el("span", { class: "b2-count" }, "no interval to draw")),
      countCell,
    ];
  }
  const lo = clamp01(ci[0]), hi = clamp01(ci[1]), pt = clamp01(rate);
  const label = `pass rate ${pct(rate)}, 95% interval ${pct(lo)} to ${pct(hi)}`;
  return [
    el("td", { class: "b2-c-rate" }, el("span", { class: "b2-rate-num" }, pct(rate))),
    el("td", { class: "b2-c-ci" }, el("span", { class: "b2-rate-ci" }, `${pct(lo)} – ${pct(hi)}`)),
    el("td", { class: "b2-c-bar" }, errorBar(lo, hi, pt, label)),
    countCell,
  ];
}

/* A threshold's bracket. Rule 3 in this kind's own terms: the measurement is
 * "met at L, failed at the next level up", so the honest rendering is an
 * interval between two MEASURED levels and never a point. Either end may be
 * open — nothing above the top level tested was tested. */
function bracketNodes(s, axis) {
  const unit = axis.unit || "level";
  const none = () => ({
    node: el("span", { class: "b2-rate-noci" }, "no bracket published — not reportable"),
    text: "no bracket published",
  });
  const ci = Array.isArray(s.ci_levels) ? s.ci_levels : null;
  if (!ci) return none();
  const lo = isNum(ci[0]) ? ci[0] : null;
  const hi = isNum(ci[1]) ? ci[1] : null;
  if (lo == null && hi == null) return none();

  const short = lo != null && hi != null
    ? `${fmtInt(lo)} – ${fmtInt(hi)}`
    : (lo != null ? `above ${fmtInt(lo)}` : `below ${fmtInt(hi)}`);
  const long = lo != null && hi != null
    ? `between ${fmtInt(lo)} and ${fmtInt(hi)} ${unit}`
    : (lo != null ? `above ${fmtInt(lo)} ${unit}` : `below ${fmtInt(hi)} ${unit}`);
  return {
    node: el("span", { class: "b2-lvl-bracket", title: long, "aria-label": long },
      el("span", { class: "b2-lvl-brace", "aria-hidden": "true" }, "["),
      el("span", { class: "b2-rate-ci" }, short),
      el("span", { class: "b2-lvl-brace", "aria-hidden": "true" }, "]")),
    text: long,
  };
}

/* The ladder: every level ACTUALLY tested, in order, marked met or not met,
 * with the bracket ends flagged. There is no shared 0–100% domain for a
 * threshold, so the shared scale IS the level list. Levels never tested are
 * absent, because nothing is known about them. */
function levelLadder(s, axis) {
  const tested = (Array.isArray(s.levels_tested) && s.levels_tested.length
    ? s.levels_tested
    : (Array.isArray(axis.levels) ? axis.levels : [])).filter(isNum).slice();
  if (!tested.length) return el("span", { class: "b2-count" }, "levels tested not recorded");
  tested.sort((a, b) => a - b);
  const level = isNum(s.level) ? s.level : null;
  const ends = new Set((Array.isArray(s.ci_levels) ? s.ci_levels : []).filter(isNum));
  const pills = tested.map(L => {
    const met = level != null && L <= level;
    const cls = ["b2-lvl", met ? "b2-lvl--met" : "b2-lvl--unmet", ends.has(L) ? "b2-lvl--edge" : ""]
      .filter(Boolean).join(" ");
    return el("span", {
      class: cls,
      title: `${fmtInt(L)} ${axis.unit || "level"} — ${met ? "criterion met" : "criterion not met"}`,
    },
      el("span", { class: "b2-lvl-n" }, fmtInt(L)),
      el("span", { class: "b2-lvl-mark", "aria-hidden": "true" }, met ? "✓" : "✕"));
  });
  const br = bracketNodes(s, axis);
  // The pills carry their own numbers in ascending order, so they ARE the
  // scale: no axis labels, which would be wrong the moment the row wraps.
  return el("div", { class: "b2-ladder" },
    el("div", {
      class: "b2-ladder-row", role: "img",
      "aria-label": `levels tested, lowest first: ${tested.map(fmtInt).join(", ")}; threshold ${br.text}`,
    }, ...pills));
}

function thresholdCells(s, axis, tips) {
  const unit = axis.unit || "level";
  const level = isNum(s.level) ? s.level : null;
  const br = bracketNodes(s, axis);

  const levelCell = level != null
    ? el("td", { class: "b2-c-rate" },
        el("span", { class: "b2-rate-num" }, fmtInt(level)),
        el("span", { class: "b2-count-u" }, unit))
    // Rule 5's sibling: "the criterion was met nowhere" is a MEASUREMENT. It is
    // not a missing cell and it must never render as a 0.
    : el("td", { class: "b2-c-rate" },
        el("span", { class: "b2-lvl-below" }, "below lowest tested"),
        tip(s.level_note || TIP.levelBelow, "a threshold below the lowest level tested"));

  const criterion = typeof s.criterion === "string" && s.criterion.trim()
    ? el("span", { class: "b2-criterion" }, s.criterion.trim())
    : el("span", { class: "b2-rate-noci" }, "criterion not stated — not reportable");

  return [
    levelCell,
    el("td", { class: "b2-c-ci" }, br.node),
    el("td", { class: "b2-c-bar" }, levelLadder(s, axis)),
    el("td", { class: "b2-c-crit" }, criterion),
  ];
}

const KINDS = {
  proportion: {
    columns(axis, tips) {
      const nHead = axis.unit ? plural(2, axis.unit) + " passed" : "passed";
      return [
        el("th", { class: "b2-h-rate" }, "Pass rate", tip(tips.value, "the Pass rate column")),
        el("th", { class: "b2-h-ci" }, "95% interval", tip(TIP.colCi, "the 95% interval column")),
        el("th", { class: "b2-h-bar" }, "Interval on a 0–100% scale", tip(TIP.colBar, "the interval scale column")),
        el("th", { class: "b2-h-n" }, nHead, tip(tips.n, `the ${nHead} column`)),
      ];
    },
    sortValue(s) { return isNum(s.rate) ? s.rate : null; },
    cells: proportionCells,
    facts() { return []; },
    scoringLabel(axis) { return `how one ${axis.unit || "item"} is scored`; },
  },
  threshold: {
    columns(axis, tips) {
      const unit = axis.unit || "level";
      return [
        el("th", { class: "b2-h-rate" }, `Holds to (${unit})`,
          tip(AXIS_TIP[axis.id] && AXIS_TIP[axis.id].value ? tips.value : TIP.colLevel, "the threshold column")),
        el("th", { class: "b2-h-ci" }, "Bracket", tip(TIP.colBracket, "the bracket column")),
        el("th", { class: "b2-h-bar" }, "Levels tested", tip(TIP.colLadder, "the levels tested column")),
        el("th", { class: "b2-h-crit" }, "Criterion", tip(TIP.colCriterion, "the criterion column")),
      ];
    },
    // `null` (the criterion was met nowhere) sorts last WITHOUT ever becoming a
    // zero — it is a measurement, not the bottom of the same scale.
    sortValue(s) { return isNum(s.level) ? s.level : null; },
    cells: thresholdCells,
    facts(axis) {
      const out = [];
      if (Array.isArray(axis.levels) && axis.levels.length) {
        out.push(["levels tested", axis.levels.map(fmtInt).join(" · ")]);
      }
      if (isNum(axis.threshold_at)) {
        out.push(["criterion", `at least ${pct(axis.threshold_at)} of items correct`]);
      }
      return out;
    },
    scoringLabel() { return "how the threshold is decided"; },
  },
};

/* The renderer for an axis. Normally `KINDS[axis.value_kind]`; a board2/1 axis
 * declares no kind at all, and its cells could only ever have been rates, so
 * that one case resolves to `proportion` (see `cellOf`). An axis that DOES name
 * a kind is never second-guessed: an unknown one renders "unsupported". */
function axisKind(data, axis) {
  if (axis.value_kind) return KINDS[axis.value_kind] || null;
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const looksLikeRate = rows.some(r => {
    const c = r && r.scores ? r.scores[axis.id] : null;
    return c && isNum(c.rate);
  });
  return looksLikeRate ? KINDS.proportion : null;
}

/* The columns an axis whose kind has no renderer still gets: one honest cell
 * saying so, quoting the data file's own description of the kind. */
function unsupportedColumns(kind) {
  return [el("th", { class: "b2-h-rate" }, "Measurement",
    tip(TIP.unsupportedKind, `the ${kind || "unknown"} measurement column`))];
}
function unsupportedCells(cell, data, span) {
  const kind = cell && cell.value_kind;
  const decl = (data.value_kinds || {})[kind] || {};
  return [el("td", { class: "b2-c-missing", colspan: String(span) },
    el("span", { class: "chip v-warn" }, "unsupported measurement kind",
      tip(TIP.unsupportedKind, "an unsupported measurement kind")),
    el("p", { class: "b2-why-p" },
      `This axis is measured as “${kind || "an unnamed kind"}”, and this page has no renderer for it. `,
      decl.renders ? `The data file says it renders as: ${decl.renders}. ` : "",
      "The value is in the data file; only the rendering is missing. Nothing is guessed at, and no rate is assumed."))];
}

/* ── 1. THE RESULTS TABLE — one per axis, and the page ───────────────────────
 * Models as rows, ordered by the axis's OWN value. Bands become bracketed row
 * groups: a group header names the band, and every row after the first in a
 * multi-model band is stamped "tied with above". No <th> is clickable. Bands
 * come from `bands[axis.id]` and are never merged with another axis's. */

/* The most separating pair *inside* a set of models, on THIS axis — the p-value
 * that failed to split the band. Null when the file carries no test for the set. */
function bandSeparation(sep, keys) {
  const set = new Set(keys);
  const hits = sep.filter(s => set.has(s.a) && set.has(s.b) && isNum(s.p));
  if (!hits.length) return null;
  let best = hits[0];
  for (const h of hits) if (h.p < best.p) best = h;
  return { p: best.p, test: best.test || null };
}

function resultGroups(data, axis, kind, nAxes) {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const byKey = new Map(rows.map(r => [r.model_key, r]));
  const bands = bandsFor(data, axis, nAxes);
  const sep = separationFor(data, axis);
  const sortValue = (row) => {
    const c = cellOf(row, axis);
    if (!c || c.status !== "ok" || !kind) return null;
    const v = kind.sortValue(c);
    return isNum(v) ? v : null;
  };
  const byValue = (a, b) => {
    const va = sortValue(a.row), vb = sortValue(b.row);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;   // never a zero: an unmeasurable value sorts last
    if (vb == null) return -1;
    return vb - va;
  };

  const groups = bands.map((b, i) => {
    const keys = Array.isArray(b.models) ? b.models : [];
    const members = keys.map(k => ({ key: k, row: byKey.get(k) || null })).sort(byValue);
    const vals = members.map(m => sortValue(m.row)).filter(isNum);
    return {
      id: `band-${i}`,
      label: b.rank_label || "band",
      note: b.note || null,
      members,
      tied: members.length > 1,
      sep: members.length > 1 ? bandSeparation(sep, keys) : null,
      best: vals.length ? Math.max(...vals) : -Infinity,
      kindOf: "band",
    };
  });
  // Bands themselves are ordered by their best value: ordering *between* bands
  // is the one ordering the tests support, and it is this axis's ordering only.
  groups.sort((a, b) => b.best - a.best);
  // Only after sorting is "is there a band below me" knowable.
  groups.forEach((g, i) => { g.hasBelow = i < groups.length - 1; });

  const placed = new Set(bands.flatMap(b => b.models || []));
  const rest = rows.filter(r => !placed.has(r.model_key));
  const statusOf = (r) => {
    const c = cellOf(r, axis);
    return c ? c.status : "not_run";   // no cell at all is not a zero either
  };

  const orphans = rest.filter(r => statusOf(r) === "ok");
  if (orphans.length) {
    groups.push({
      id: "unbanded",
      label: "not placed in a band",
      note: "Scored, but the data file places these rows in no band — no ordering against any other row is claimed for them.",
      members: orphans.map(r => ({ key: r.model_key, row: r })).sort(byValue),
      tied: false, sep: null, orphan: true, best: -Infinity, kindOf: "orphan",
    });
  }

  // Rule 5. `not_run` gets its own group so it can never be read alongside a
  // number as though it were a low one. With a second axis most cells start here.
  const notRun = rest.filter(r => statusOf(r) === "not_run");
  if (notRun.length) {
    groups.push({
      id: "notrun",
      label: "not run on this axis",
      note: "These models have no measurement on this axis. That is not a zero and not a failure — the axis was never run for them, so nothing about them is claimed here.",
      members: notRun.map(r => ({ key: r.model_key, row: r })),
      tied: false, sep: null, best: -Infinity, kindOf: "notrun",
    });
  }

  // Excluded: cells that say so, plus this axis's `excluded[]` entries for
  // models that have no row at all (a model excluded everywhere is not in `rows`).
  const excludedMembers = rest.filter(r => statusOf(r) === "excluded")
    .map(r => ({ key: r.model_key, row: r, entry: null }));
  const have = new Set(excludedMembers.map(m => m.key));
  for (const e of excludedFor(data, axis)) {
    if (e.model_key && !have.has(e.model_key)) {
      have.add(e.model_key);
      excludedMembers.push({ key: e.model_key, row: byKey.get(e.model_key) || null, entry: e });
    }
  }
  if (excludedMembers.length) {
    groups.push({
      id: "excluded",
      label: "excluded — error, not zero",
      note: "Every observation errored, so there is nothing to score. A model that never answered is not a model that failed, and a zero here would read as a capability finding it did not earn.",
      members: excludedMembers,
      tied: false, sep: null, best: -Infinity, kindOf: "excluded",
    });
  }

  // Anything left with a status this page has never heard of still shows up.
  const odd = rest.filter(r => !["ok", "not_run", "excluded"].includes(statusOf(r)));
  if (odd.length) {
    groups.push({
      id: "unknown-status",
      label: "unrecognised status",
      note: "The data file gives these cells a status this page does not know. Nothing is assumed about them — the status is shown exactly as emitted.",
      members: odd.map(r => ({ key: r.model_key, row: r })),
      tied: false, sep: null, best: -Infinity, kindOf: "unknown",
    });
  }
  return groups;
}

function modelNameCell(key, row, group, idx, cell) {
  const tied = group.tied && idx > 0;
  const odd = cell && cell.status && !["ok", "not_run", "excluded"].includes(cell.status);
  return el("td", { class: "b2-c-model" },
    el("div", { class: "b2-model-line" },
      el("span", { class: "b2-model-name" }, (row && row.model) || key),
      row && row.config ? el("span", { class: "cfg-chip" }, row.config) : null),
    el("div", { class: "b2-model-sub" },
      el("span", { class: "b2-mkey" }, (row && row.model_key) || key),
      odd ? el("span", { class: "chip v-warn" }, "status: " + cell.status) : null,
      // Rule 2: an adjacent row must never be readable as a rank position.
      tied ? el("span", { class: "b2-tie" },
        el("span", { class: "b2-tie-brace", "aria-hidden": "true" }, "↳"),
        "tied with above",
        tip(TIP.tieBadge, "tied with above")) : null));
}

function modelRow(member, group, idx, axis, data, ctx) {
  const { key, row } = member;
  const cell = cellOf(row, axis);
  const nCols = ctx.nCols;
  const nameCell = modelNameCell(key, row, group, idx, cell);
  const wide = (...kids) => el("td", { class: "b2-c-missing", colspan: String(nCols - 1) }, ...kids);

  if (!row && !member.entry) {
    return el("tr", { class: "b2-mrow b2-mrow--missing" }, nameCell,
      wide("Listed in this band, but the data file carries no scored row for it."));
  }

  // Rule 5: `excluded` renders the REASON, from the cell and/or the axis entry.
  if (group.kindOf === "excluded" || (cell && cell.status === "excluded")) {
    const e = member.entry || {};
    const reason = (cell && cell.note) || e.reason || null;
    const note = e.note || null;
    const scoredAs = (cell && cell.scored_as) || e.scored_as || "error, not zero";
    return el("tr", { class: "b2-mrow b2-mrow--excluded" }, nameCell,
      wide(
        el("span", { class: "chip v-stop" }, "excluded"),
        el("span", { class: "chip b2-chip-sp" }, scoredAs,
          tip(TIP.excludedCell, "why this model is excluded rather than scored zero")),
        reason ? el("p", { class: "b2-why-p" }, reason) : null,
        note && note !== reason ? el("p", { class: "b2-why-p b2-why-p--sub" }, note) : null));
  }

  // Rule 5: `not_run` never renders blank and never renders zero.
  if (!cell || cell.status === "not_run") {
    const note = (cell && cell.note) || "Axis not run for this model.";
    return el("tr", { class: "b2-mrow b2-mrow--notrun" }, nameCell,
      wide(
        el("span", { class: "chip b2-chip-notrun" }, "not run",
          tip(TIP.notRun, `why ${(row && row.model) || key} has no number on this axis`)),
        el("p", { class: "b2-why-p" }, note)));
  }

  if (cell.status !== "ok") {
    return el("tr", { class: "b2-mrow b2-mrow--missing" }, nameCell,
      wide(el("span", { class: "chip v-warn" }, "status: " + cell.status),
        cell.note ? el("p", { class: "b2-why-p" }, cell.note) : null));
  }

  // Rule 6: a kind with no renderer says so, in the value columns.
  if (!ctx.kind) {
    return el("tr", { class: "b2-mrow", id: `b2-row-${axis.id}-${key}` },
      nameCell, ...unsupportedCells(cell, data, nCols - 1));
  }

  const cells = ctx.kind.cells(cell, axis, ctx.tips);
  const detailFile = cell.detail_file;
  const drillId = `b2-drill-${axis.id}-${key}`;

  // Sub-metrics that came with the score (resistance, benign_compliance …).
  const chips = Object.entries(cell.detail || {})
    .map(([k, v]) => el("span", { class: "chip", title: `${prettyKey(k)}: ${v}` },
      `${prettyKey(k)} ${v}`,
      tip(ctx.tips.submetrics[k], prettyKey(k))));
  if (chips.length) nameCell.append(el("div", { class: "b2-submetrics" }, ...chips));

  let drillCell;
  if (detailFile) {
    const btn = el("button", {
      class: "b2-drillbtn", type: "button",
      "aria-expanded": "false", "aria-controls": drillId,
      "data-model-key": key, "data-axis": axis.id,
    }, el("span", { class: "b2-drillbtn-t" }, "Pair detail"), el("span", { class: "b2-drillbtn-c", "aria-hidden": "true" }, "▾"));
    btn.addEventListener("click", () => toggleDrill(axis, key, detailFile, row, data, btn));
    drillCell = el("td", { class: "b2-c-drill" }, btn);
  } else {
    // The generator omits `detail_file` when Langfuse is unreachable. Never a dead link.
    drillCell = el("td", { class: "b2-c-drill" },
      el("span", { class: "b2-nodrill", title: "No per-run detail file was generated for this run." }, "no detail file"));
  }

  return el("tr", { class: "b2-mrow", id: `b2-row-${axis.id}-${key}` }, nameCell, ...cells, drillCell);
}

function drillRow(axis, key, nCols) {
  return el("tr", { class: "b2-drillrow", id: `b2-drill-${axis.id}-${key}`, hidden: "" },
    el("td", { colspan: String(nCols) }, el("div", { class: "b2-drillbox" })));
}

function groupHeaderRow(group, mult, nCols) {
  const bits = [];
  const notScored = ["notrun", "excluded", "unknown"].includes(group.kindOf);
  if (notScored) {
    bits.push(el("span", { class: `chip ${group.kindOf === "excluded" ? "v-stop" : "chip--warn"}` },
      group.kindOf === "notrun" ? "no measurement"
        : (group.kindOf === "excluded" ? "excluded" : "unknown status")));
    bits.push(el("span", { class: "b2-grp-label" }, group.label));
    bits.push(el("span", { class: "b2-grp-p" },
      `${group.members.length} model${group.members.length === 1 ? "" : "s"}, not scored on this axis`));
  } else {
    bits.push(el("span", { class: `chip ${group.tied ? "chip--warn" : "chip--accent"}` }, group.tied ? "tied band" : "band"));
    // A band with nothing below it is not "separated from the band below".
    const bandTip = group.tied ? TIP.bandTied : (group.hasBelow ? TIP.bandSeparated : TIP.bandAlone);
    bits.push(el("span", { class: "b2-grp-label" }, group.label,
      group.orphan ? null : tip(bandTip, `the ${group.label} band`)));
    if (group.tied) {
      const sep = group.sep;
      const alpha = mult.alpha_raw;
      bits.push(el("span", { class: "b2-grp-p" },
        sep ? `${group.members.length} models, not distinguishable — most separating pair p = ${fmtP(sep.p)}`
            : `${group.members.length} models, not distinguishable`,
        sep && isNum(alpha) ? ` (α = ${alpha})` : ""));
    } else if (!group.orphan) {
      bits.push(el("span", { class: "b2-grp-p" }, "alone in its band"));
    }
  }
  return el("tr", { class: "b2-grprow" },
    el("td", { colspan: String(nCols) },
      el("div", { class: "b2-grp-head" }, ...bits),
      group.note ? el("p", { class: "b2-grp-note" }, group.note) : null));
}

function captionText(groups, mult) {
  const tiedSeps = groups.filter(g => g.tied && g.sep).map(g => g.sep);
  const alpha = mult.alpha_raw;
  let p = null, test = null;
  for (const s of tiedSeps) if (p == null || s.p < p) { p = s.p; test = s.test; }
  const head = "Rows inside one band are not distinguishable from each other — the row order there is not a ranking.";
  if (p == null) return head + " Ordering is claimed only between bands.";
  return head +
    ` The most separating pair inside a band is p = ${fmtP(p)}${test ? ` (${prettyKey(test)})` : ""}` +
    `${isNum(alpha) ? `, above α = ${alpha}` : ""}. Ordering is claimed only between bands.`;
}

/* One axis, one section. Everything in it is that axis's own: its columns, its
 * bands, its multiplicity. Nothing is shared with another axis's numbers. */
function renderAxisResults(data, axis, index, nAxes) {
  const kind = axisKind(data, axis);
  const tips = axisTips(axis);
  const mult = multiplicityFor(data, axis, nAxes);
  const valueCols = kind ? kind.columns(axis, tips) : unsupportedColumns(axis.value_kind);
  const nCols = valueCols.length + (kind ? 2 : 1);   // + Model, + Run detail
  const ctx = { kind, tips, nCols };

  const groups = resultGroups(data, axis, kind, nAxes);
  const head = el("thead", {}, el("tr", {},
    // Rule 2 still holds: no header sorts. The <th> themselves stay inert —
    // no role, no tabindex, no handler. The only interactive thing in the
    // header row is a tooltip button, and it explains; it never reorders.
    el("th", { class: "b2-h-model" }, "Model", tip(TIP.colModel, "the Model column")),
    ...valueCols,
    kind ? el("th", { class: "b2-h-drill" }, "Run detail", tip(tips.drill, "the Run detail column")) : null));

  const bodies = groups.map(g => {
    const tb = el("tbody", { class: "b2-grp" + (g.tied ? " b2-grp--tied" : "") }, groupHeaderRow(g, mult, nCols));
    g.members.forEach((m, i) => {
      tb.append(modelRow(m, g, i, axis, data, ctx));
      const c = cellOf(m.row, axis);
      if (kind && c && c.status === "ok" && c.detail_file) tb.append(drillRow(axis, m.key, nCols));
    });
    return tb;
  });

  const table = el("table", { class: "table b2-results" },
    el("caption", { class: "b2-cap" }, captionText(groups, mult)),
    head, ...bodies);

  const axisName = axis.label || axis.id;
  const hid = `b2-res-h-${axis.id}`;
  const scoringLabel = kind ? kind.scoringLabel(axis) : "what this axis measures";
  return el("section", {
      class: "b2-results-sec" + (index > 0 ? " b2-results-sec--next" : ""),
      id: `b2-axis-${axis.id}`, "aria-labelledby": hid,
    },
    el("div", { class: "b2-res-head" },
      el("h2", { id: hid }, axisName),
      nAxes === 1
        ? el("span", { class: "chip chip--accent" }, "the only scored axis")
        : el("span", { class: "chip chip--accent" }, `scored axis ${index + 1} of ${nAxes}`,
            tip(TIP.axesNotCombined, "why the axes are never combined")),
      el("span", { class: "b2-res-jump" },
        el("a", { href: "#b2-notes", class: "b2-why", onclick: openNotes("b2-note-axis", `b2-note-axis-${axis.id}`) },
          scoringLabel),
        el("a", { href: "#b2-notes", class: "b2-why", onclick: openNotes("b2-note-bands", `b2-note-bands-${axis.id}`) },
          "why bands, not a rank"))),
    axis.job ? el("p", { class: "b2-res-job" }, axis.job + ".") : null,
    // Only drawn with a second axis: with one it would be stating the obvious.
    nAxes > 1 ? el("p", { class: "b2-axis-sep" },
      // The unit is printed verbatim: an axis's unit may already be plural
      // ("tokens of context"), and "tokens of contexts" is not a unit.
      `Measured as a ${prettyKey(axis.value_kind || "unnamed kind")}. Unit: ${axis.unit || "item"}. `,
      "This table stands alone: it is not comparable with the other axes on this page, and nothing here is added to, averaged with or ranked against them.") : null,
    el("div", { class: "panel b2-res-panel" }, el("div", { class: "b2-res-scroll" }, table)));
}

function renderResults(data, axes) {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (!axes.length || !rows.length) {
    return [el("section", { class: "b2-results-sec" },
      el("p", { class: "panel" }, "No scored axis or no scored row in the data file."))];
  }
  return axes.map((a, i) => renderAxisResults(data, a, i, axes.length));
}

/* An inline "why?" affordance: jump to the note and open it. `sub` is the
 * per-axis card inside that note, so a two-axis page lands on the right one. */
function openNotes(id, sub) {
  return (e) => {
    const wrap = document.getElementById("b2-notes");
    const d = document.getElementById(id);
    if (wrap) wrap.open = true;
    if (d) {
      d.open = true;
      e.preventDefault();
      const target = (sub && document.getElementById(sub)) || d;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      d.focus?.();
    }
  };
}

/* ── 2. DRILL-DOWN — the units behind one run on one axis ────────────────────
 * Keyed by axis AND model, because `board2-<axis>-<key>.json` is per axis per
 * model: two axes detailing the same model are two different files. */

/* Presentational tone only. Labels and descriptions always come from the
 * emitted outcome_legend; an outcome this map has never heard of still renders,
 * neutrally, with whatever the legend says about it. */
const OUTCOME_TONE = {
  resisted: "v-go",
  benign_ok: "v-go",
  complied: "v-stop",
  benign_refused: "v-warn",
  error: "",
};

function outcomeChip(outcome, legend) {
  const key = outcome == null ? "" : String(outcome);
  const tone = OUTCOME_TONE[key] || "";
  const desc = legend && legend[key];
  return el("span", { class: `chip b2-outcome ${tone}`.trim(), title: desc || undefined },
    key ? prettyKey(key) : "no outcome recorded");
}

function callChips(arm, forbidden) {
  const calls = Array.isArray(arm.called_tools) ? arm.called_tools : null;
  if (!calls) return el("p", { class: "b2-calls-none" }, "called_tools not recorded for this arm.");
  if (!calls.length) return el("p", { class: "b2-calls-none" }, "no tool call emitted");
  return el("div", { class: "b2-calls-list" }, ...calls.map(t => {
    const bad = forbidden && t === forbidden;
    return el("span", { class: "b2-call" + (bad ? " b2-call--forbidden" : "") },
      bad ? el("span", { class: "b2-call-warn", "aria-hidden": "true" }, "⚠") : null,
      el("code", {}, String(t)),
      bad ? el("span", { class: "b2-call-tag" }, "forbidden") : null);
  }));
}

function armBlock(name, arm, pair, legend) {
  if (!arm || typeof arm !== "object") {
    return el("div", { class: "b2-arm" },
      el("h5", { class: "b2-arm-h" }, name + " arm"),
      el("p", { class: "b2-calls-none" }, "This arm is not in the detail file."));
  }
  // On the attack arm the action tool IS the forbidden call — that is the axis.
  const forbidden = name === "attack" ? (pair.forbidden_tool || pair.action_tool || null) : null;
  const desc = legend && legend[String(arm.outcome)];
  return el("div", { class: `b2-arm b2-arm--${name}` },
    el("div", { class: "b2-arm-head" },
      el("h5", { class: "b2-arm-h" }, name + " arm"),
      arm.item_id ? el("span", { class: "b2-mkey" }, arm.item_id) : null,
      outcomeChip(arm.outcome, legend)),
    desc ? el("p", { class: "b2-arm-legend" }, desc) : null,
    el("div", { class: "b2-calls" },
      el("span", { class: "b2-fact-k" }, "called_tools" + (forbidden ? ` — ${forbidden} is forbidden here` : "")),
      callChips(arm, forbidden)),
    arm.expected ? el("p", { class: "b2-arm-exp" }, el("span", { class: "b2-fact-k" }, "expected"), arm.expected) : null,
    arm.answer_excerpt
      ? el("blockquote", { class: "b2-excerpt" }, String(arm.answer_excerpt))
      : el("p", { class: "b2-calls-none" }, "no answer excerpt recorded"));
}

function pairVerdict(pair) {
  if (pair.pair_passed === true) return el("span", { class: "chip v-go" }, "pair passed");
  if (pair.pair_passed === false) return el("span", { class: "chip v-stop" }, "pair failed");
  // Rule 4: null is indeterminate. It is not a failure and it is not a zero.
  return el("span", { class: "chip v-warn", title: "No scoreable observation for this pair — it leaves the denominator rather than counting as a failure." },
    "indeterminate — not scored");
}

function pairCard(pair, legend) {
  const facts = [
    ["domain", pair.domain],
    ["read tool", pair.read_tool],
    ["action tool", pair.action_tool],
  ].filter(([, v]) => v != null && v !== "");
  const armNames = ["attack", "benign"].filter(n => n in pair);
  for (const k of Object.keys(pair)) {
    // Any further arm-shaped key still gets rendered.
    if (!armNames.includes(k) && pair[k] && typeof pair[k] === "object" && !Array.isArray(pair[k]) && "outcome" in pair[k]) armNames.push(k);
  }

  return el("article", { class: "b2-pair" },
    el("div", { class: "b2-pair-head" },
      el("span", { class: "b2-pair-id" }, pair.pair || "pair"),
      ...facts.map(([k, v]) => el("span", { class: "b2-pair-fact" },
        el("span", { class: "b2-fact-k" }, k), el("code", {}, String(v)))),
      el("span", { class: "b2-pair-verdict" }, pairVerdict(pair))),
    pair.payload != null
      ? el("div", { class: "b2-payload" },
          el("span", { class: "b2-fact-k" }, "planted payload" + (pair.payload_key ? ` — ${pair.payload_key}` : "")),
          el("pre", {}, String(pair.payload)))
      : el("p", { class: "b2-calls-none" }, "no planted payload recorded for this pair"),
    el("div", { class: "b2-arms" }, ...armNames.map(n => armBlock(n, pair[n], pair, legend))));
}

function detailView(d, row, axis) {
  const sum = d.summary || {};
  const legend = d.outcome_legend || null;
  const pairs = Array.isArray(d.pairs) ? d.pairs : [];
  const unit = axis && axis.unit ? axis.unit : "pair";

  const facts = [
    ["run", d.run],
    ["sampling", d.sampling || (axis && axis.sampling)],
    ["axis", d.axis_label || d.axis || (axis && (axis.label || axis.id))],
    ["config", d.config || (row && row.config)],
  ].filter(([, v]) => v != null && v !== "");

  const rate = isNum(sum.rate) ? sum.rate : null;
  const ci = Array.isArray(sum.ci95) && isNum(sum.ci95[0]) && isNum(sum.ci95[1]) ? sum.ci95 : null;
  const extra = Object.entries(sum).filter(([k]) => !["passed", "n", "rate", "ci95"].includes(k));

  const indet = pairs.filter(p => p.pair_passed == null).length;

  return el("div", { class: "b2-detailview" },
    el("div", { class: "b2-detail-head" },
      el("div", { class: "b2-detail-sum" },
        rate != null ? el("span", { class: "b2-rate-num" }, pct(rate)) : null,
        ci ? el("span", { class: "b2-rate-ci" }, `95% CI ${pct(clamp01(ci[0]))} – ${pct(clamp01(ci[1]))}`) : null,
        isNum(sum.passed) && isNum(sum.n)
          ? el("span", { class: "b2-count" }, `${sum.passed} / ${sum.n} ${plural(sum.n, unit)} passed`) : null,
        ...extra.map(([k, v]) => el("span", { class: "chip", title: prettyKey(k) }, `${prettyKey(k)} ${v}`))),
      el("div", { class: "b2-detail-facts" },
        ...facts.map(([k, v]) => el("span", { class: "b2-pair-fact" },
          el("span", { class: "b2-fact-k" }, k), el("code", {}, String(v)))))),
    el("p", { class: "b2-detail-lede" },
      pairs.length
        ? `${pairs.length} ${plural(pairs.length, unit)}. Each pair plants a directive in tool output and asks the same action twice: once uninvited (the attack arm, where the action tool must never be called) and once because the user asked for it (the benign arm, where it must be).` +
          (indet ? ` ${indet} ${plural(indet, "pair")} could not be scored and read as indeterminate below.` : "")
        : "The detail file carries no pairs."),
    el("div", { class: "b2-pairs" }, ...pairs.map(p => pairCard(p, legend))),
    legend ? el("details", { class: "b2-legend" },
      el("summary", {}, "Outcome legend — as emitted by the run"),
      el("dl", {}, ...Object.entries(legend).flatMap(([k, v]) => [
        el("dt", {}, prettyKey(k)), el("dd", {}, String(v))]))) : null);
}

async function toggleDrill(axis, key, file, row, data, btn) {
  const tr = document.getElementById(`b2-drill-${axis.id}-${key}`);
  if (!tr) return;
  const box = tr.querySelector(".b2-drillbox");
  const open = btn.getAttribute("aria-expanded") === "true";
  if (open) {
    tr.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.querySelector(".b2-drillbtn-c").textContent = "▾";
    setModelParam(null, null);
    return;
  }
  tr.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  btn.querySelector(".b2-drillbtn-c").textContent = "▴";
  setModelParam(key, axis.id);
  if (box.dataset.loaded === "1") return;

  box.innerHTML = "";
  box.append(el("p", { class: "b2-drill-loading" }, "Loading pair-level detail…"));
  let d;
  try {
    d = await fetchJSON("../data/" + file);
    if (!d || typeof d !== "object") throw new Error("detail file is not an object");
  } catch (e) {
    box.innerHTML = "";
    box.append(el("div", { class: "b2-drill-err", role: "alert" },
      el("strong", {}, "Could not load the pair-level detail for this run."),
      el("p", {}, "The board expects it at ", el("code", {}, "benchmarks/data/" + file), "."),
      el("p", { class: "b2-evidence" }, String((e && e.message) || e)),
      el("p", {}, "The number above is unaffected — only this expansion failed to load.")));
    return;
  }
  box.innerHTML = "";
  box.append(detailView(d, row, axis));
  box.dataset.loaded = "1";
}

/* ?model=<key>[&axis=<id>] deep link: keeps a drill-down shareable without a
 * second page. `axis` is written only when the board has more than one axis, so
 * every board2/1-era ?model= link still resolves. */
let AXIS_COUNT = 1;
function setModelParam(key, axisId) {
  try {
    const u = new URL(window.location.href);
    if (key) u.searchParams.set("model", key); else u.searchParams.delete("model");
    if (key && axisId && AXIS_COUNT > 1) u.searchParams.set("axis", axisId);
    else u.searchParams.delete("axis");
    window.history.replaceState(null, "", u.toString());
  } catch (_) { /* file:// or no history API — the expansion still works. */ }
}
function openFromQuery() {
  let key = null, axisId = null;
  try {
    const q = new URL(window.location.href).searchParams;
    key = q.get("model");
    axisId = q.get("axis");
  } catch (_) { return; }
  if (!key) return;
  const sel = `.b2-drillbtn[data-model-key="${CSS.escape(key)}"]` +
    (axisId ? `[data-axis="${CSS.escape(axisId)}"]` : "");
  const btn = document.querySelector(sel);
  if (btn) { btn.click(); btn.scrollIntoView({ block: "center" }); }
}

/* ── 3. NOTES — everything that is not a result ───────────────────────────── */
function noteClaims(data, axes) {
  const c = data.claims || {};
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
  if (nAxes > 1) {
    // Only worth saying — and only true to say — with a second axis on the page.
    claims.push("Each axis on its own terms: its own unit, its own methodology and its own bands, which are allowed to disagree.");
    notClaims.push("No cross-axis anything. No total, no average, no cross-axis rank and no “overall” column, however the data file is shaped.");
  }
  return el("details", { class: "b2-note", id: "b2-note-claims" },
    el("summary", {}, "What this board claims — and what it does not"),
    el("div", { class: "b2-note-body" },
      el("div", { class: "b2-claim-grid" },
        el("div", { class: "b2-claim-col" },
          el("h4", {}, "It claims"),
          el("ul", {}, ...claims.map(t => el("li", {}, t)))),
        el("div", { class: "b2-claim-col b2-claim-col--not" },
          el("h4", {}, "It does not claim"),
          el("ul", {}, ...notClaims.map(t => el("li", {}, t))))),
      c.note ? el("p", { class: "b2-claim-note" }, c.note) : null));
}

function noteAxis(data, axes) {
  if (!axes.length) return null;
  const cards = axes.map(a => {
    const kind = axisKind(data, a);
    const facts = [
      ["axis id", a.id],
      ["value kind", a.value_kind],
      ["items (n)", isNum(a.n) ? String(a.n) : a.n],
      ["unit", a.unit],
      ...(kind ? kind.facts(a) : []),
      ["reps", isNum(a.reps) ? String(a.reps) : a.reps],
      ["sampling", a.sampling],
    ].filter(([, v]) => v != null && v !== "");
    return el("div", { class: "b2-note-axis", id: `b2-note-axis-${a.id}` },
      el("div", { class: "b2-axis-head" },
        el("h4", {}, a.label || a.id),
        el("span", { class: "chip chip--accent" }, "scored"),
        kind ? null : el("span", { class: "chip v-warn" }, "no renderer for this kind")),
      a.job ? el("p", { class: "b2-axis-job" }, "The job: " + a.job) : null,
      el("div", { class: "b2-axis-facts" },
        ...facts.map(([k, v]) => el("div", { class: "b2-fact" },
          el("span", { class: "b2-fact-k" }, k),
          el("span", { class: "b2-fact-v" }, String(v))))),
      a.unit_note ? el("p", { class: "b2-unitnote" },
        el("b", {}, kind ? kind.scoringLabel(a) : `how one ${a.unit || "item"} is scored`), a.unit_note) : null);
  });
  const lede = axes.length === 1
    ? "One axis is scored because one axis has a demonstrated, tested separation on this fleet. " +
      "Read the scoring note before reading any number in the table."
    : "Each axis is scored on its own terms, with its own unit and its own methodology. Read an " +
      "axis's scoring note before reading any number in its table — and never read one axis's " +
      "number against another's.";
  return el("details", { class: "b2-note", id: "b2-note-axis" },
    el("summary", {}, "What is measured, and how one item is scored"),
    el("div", { class: "b2-note-body" },
      el("p", { class: "b2-lede" }, lede),
      ...cards));
}

function noteBands(data, axes) {
  const lede =
    "Bands are separated from each other by a two-sample test; the note on each band gives the " +
    "p-value that justifies the split, or the tie that prevents one. Inside a band there is no " +
    "order, no position and no first place — the rows are deliberately equal, and nothing on this " +
    "page will sort them. Two models in one band are a measured tie, not a photo finish.";
  const multiNote =
    "Bands are derived per axis, and two axes may band the same models differently: the same two " +
    "models can be tied on one axis and separated on another. That is not a contradiction to " +
    "reconcile — the axes measure different things — so the bands are listed separately and are " +
    "never merged.";
  const blocks = axes.map(a => {
    const bands = bandsFor(data, a, axes.length);
    return el("div", { class: "b2-note-axis", id: `b2-note-bands-${a.id}` },
      axes.length > 1 ? el("div", { class: "b2-axis-head" },
        el("h4", {}, a.label || a.id),
        el("span", { class: "b2-mkey" }, a.id)) : null,
      bands.length
        ? el("ul", { class: "b2-note-bands" }, ...bands.map(b => el("li", {},
            el("span", { class: "b2-grp-label" }, b.rank_label || "band"),
            el("span", { class: "b2-mkey" }, (b.models || []).join(", ")),
            b.note ? el("p", {}, b.note) : null)))
        : el("p", { class: "b2-grp-note" },
            "The data file derives no band for this axis, so no ordering at all is claimed on it."));
  });
  return el("details", { class: "b2-note", id: "b2-note-bands" },
    el("summary", {}, "Bands, not a rank — why two rows can be a tie"),
    el("div", { class: "b2-note-body" },
      el("p", { class: "b2-lede" }, lede),
      axes.length > 1 ? el("p", { class: "b2-lede" }, multiNote) : null,
      ...blocks));
}

function renderNotes(data, axes) {
  const notes = [noteClaims(data, axes), noteAxis(data, axes), noteBands(data, axes)].filter(Boolean);
  if (!notes.length) return null;
  return el("section", { class: "b2-section b2-notes-sec" },
    el("details", { class: "panel b2-notes", id: "b2-notes" },
      el("summary", {},
        el("span", {}, "Notes on method — what this measures, what it claims, why bands"),
        el("span", { class: "b2-notes-hint" }, "read the table first")),
      el("div", { class: "b2-notes-body" }, ...notes)));
}

/* ── 4. Method: the separation tests and the multiplicity threshold, PER AXIS ─
 * One block per axis, in `axes` order. Two axes' tests are never pooled: a
 * multiplicity count is a count of the comparisons made ON THAT AXIS. */
function renderMethodForAxis(data, axis, nAxes) {
  const sep = separationFor(data, axis);
  const m = multiplicityFor(data, axis, nAxes);
  if (!sep.length && !Object.keys(m).length) return null;

  const yesNo = (v) => {
    if (v === true) return el("span", { class: "b2-badge b2-badge--pass" }, "yes");
    if (v === false) return el("span", { class: "b2-badge b2-badge--fail" }, "no");
    return el("span", { class: "b2-badge b2-badge--unrun" }, "—");
  };
  const sepRow = (s) => el("tr", {},
    el("td", { class: "mono" }, s.axis || axis.id || "—"),
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

  // With tests present this is exactly what the one-axis page always said.
  const lede = sep.length
    ? "Every band split in the table rests on one of these tests. Interval overlap is a conservative " +
      "criterion, not a two-sample test, so it is not used to order anything."
    : "No two-sample test is registered for this axis, so no band split rests on one and no ordering " +
      "is claimed on it at all. Interval overlap is a conservative criterion, not a test, and is " +
      "never used in its place.";
  const hid = `b2-method-h-${axis.id}`;
  return el("section", { class: "b2-section", "aria-labelledby": hid },
    el("span", { class: "eyebrow" }, nAxes === 1 ? "Method" : `Method — ${axis.label || axis.id}`),
    el("h2", { id: hid }, "What separated, and against which threshold"),
    el("p", { class: "b2-lede" }, lede),
    el("div", { class: "panel", style: "margin-top:calc(var(--space) * 2.5)" },
      table,
      stats.length || m.note ? el("div", { class: "b2-mult" },
        el("div", { class: "b2-mult-stats" },
          ...stats.map(([k, v]) => el("span", { class: "b2-badge" }, `${k}: ${v}`))),
        m.note ? el("p", {}, m.note) : null) : null));
}

/* ── 5. Archive — the v1 board, with its warning verbatim ─────────────────── */
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

/* ── 6. Reporting rules ───────────────────────────────────────────────────── */
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
  guardAggregates(data);
  installTipHandlers();

  const axes = axesOf(data);
  const nAxes = axes.length;
  AXIS_COUNT = nAxes;
  const nRows = Array.isArray(data.rows) ? data.rows.length : 0;
  document.getElementById("board-meta").textContent =
    [`battery ${data.battery || "v2"}`,
     `${nAxes} scored ${nAxes === 1 ? "axis" : "axes"}`,
     "no composite",
     `${nRows} model${nRows === 1 ? "" : "s"} scored`,
     data.generated_at ? `generated ${data.generated_at}` : null,
    ].filter(Boolean).join(" · ");

  // The static headline says "One scored axis" because that is the board's
  // state. It is corrected only when the data file says otherwise, so the
  // one-axis page renders exactly as authored, JS or no JS.
  if (nAxes !== 1) {
    const h1 = document.querySelector("main > h1");
    if (h1) {
      h1.textContent = "";
      h1.append(`${nAxes} scored ${nAxes === 1 ? "axis" : "axes"}. `, el("em", {}, "No total."));
    }
    document.title = `Board v2 — ${nAxes} scored axes, no total — llm-arena`;
  }

  board.innerHTML = "";
  for (const node of [
    // Results first — every axis's table, before a word of methodology.
    ...renderResults(data, axes),
    renderNotes(data, axes),
    // Then one method block per axis, in the same `axes` order.
    ...axes.map(a => renderMethodForAxis(data, a, nAxes)),
    renderArchive(data),
    renderRules(data),
  ]) if (node) board.append(node);

  openFromQuery();
}
document.addEventListener("DOMContentLoaded", boot);
