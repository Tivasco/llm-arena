#!/usr/bin/env python3
"""Structural + no-CDN contract checks for the llm-arena shell.
Stdlib only, no deps. Run from repo root: python3 tools/check_shell.py
Each check returns a list of problem strings ([] = pass)."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def html_files(): return sorted(ROOT.rglob("*.html"))
def css_files():  return sorted(ROOT.rglob("*.css"))
def read(p):      return p.read_text(encoding="utf-8")

CHECKS = []
def check(fn):
    CHECKS.append(fn)
    return fn

@check
def repo_skeleton():
    """Baseline files exist."""
    problems = []
    for rel in (".nojekyll", "README.md"):
        if not (ROOT / rel).exists():
            problems.append(f"missing {rel}")
    return problems

REQUIRED_TOKENS = [
    "--bg", "--surface", "--text", "--text-muted", "--border", "--accent",
    "--verdict-go", "--verdict-warn", "--verdict-stop",
    "--font-sans", "--font-mono", "--maxw", "--radius", "--space",
]
REQUIRED_SELECTORS = [
    ".container", ".site-header", ".site-nav", ".site-footer",
    ".door-grid", ".door", ".chip", ".table", ".panel",
]

@check
def theme_contract():
    """theme.css defines every locked token and component selector."""
    theme = ROOT / "assets" / "theme.css"
    if not theme.exists():
        return ["assets/theme.css missing"]
    txt = read(theme)
    problems = []
    for tok in REQUIRED_TOKENS:
        if re.search(rf"{re.escape(tok)}\s*:", txt) is None:
            problems.append(f"theme.css: token {tok} not defined")
    for sel in REQUIRED_SELECTORS:
        if re.search(rf"(^|[,\s}}]){re.escape(sel)}([\s,{{:.>])", txt, re.M) is None:
            problems.append(f"theme.css: selector {sel} not defined")
    return problems

@check
def no_cdn():
    """No external (CDN) *resources*. Plain <a href> navigation may be external."""
    # external href on <link>, or external src on <script>/<img>/<source>
    link = re.compile(r'<link\b[^>]*\bhref\s*=\s*["\'](?:https?:)?//', re.I)
    src  = re.compile(r'<(?:script|img|source)\b[^>]*\bsrc\s*=\s*["\'](?:https?:)?//', re.I)
    url  = re.compile(r'url\(\s*["\']?(?:https?:)?//', re.I)
    problems = []
    for p in html_files():
        txt = read(p)
        for rx, label in ((link, "external <link>"), (src, "external src")):
            for m in rx.finditer(txt):
                problems.append(f"{p.relative_to(ROOT)}: {label} {m.group(0)!r}")
    for p in list(css_files()) + list(html_files()):
        for m in url.finditer(read(p)):
            problems.append(f"{p.relative_to(ROOT)}: external url() {m.group(0)!r}")
    return problems

@check
def chrome_contract():
    """Every page links theme.css and includes chrome.js (base-relative, optional ../)."""
    theme_rx  = re.compile(r'href\s*=\s*["\'](?:\.\./)*assets/theme\.css["\']')
    chrome_rx = re.compile(r'src\s*=\s*["\'](?:\.\./)*assets/chrome\.js["\']')
    problems = []
    for p in html_files():
        txt = read(p)
        if theme_rx.search(txt) is None:
            problems.append(f"{p.relative_to(ROOT)}: missing theme.css link")
        if chrome_rx.search(txt) is None:
            problems.append(f"{p.relative_to(ROOT)}: missing chrome.js script")
    return problems

@check
def hub_doors():
    """index.html is a hub linking the Benchmarks pillar door.
    (The Arena door is temporarily unlinked; the arena/ scaffold still exists.)"""
    idx = ROOT / "index.html"
    if not idx.exists():
        return ["index.html missing"]
    txt = read(idx)
    problems = []
    if 'href="benchmarks/"' not in txt:
        problems.append('index.html: missing door href="benchmarks/"')
    if 'class="door"' not in txt:
        problems.append("index.html: no .door cards")
    return problems

@check
def links_resolve():
    """Every internal href/src points to an existing file."""
    ref = re.compile(r'\b(?:href|src)\s*=\s*["\']([^"\']+)["\']', re.I)
    problems = []
    for p in html_files():
        for m in ref.finditer(read(p)):
            tgt = m.group(1).split("#")[0].split("?")[0]
            if not tgt or tgt.startswith(("http://", "https://", "//", "mailto:", "data:")):
                continue
            fp = (ROOT / tgt.lstrip("/")) if tgt.startswith("/") else (p.parent / tgt)
            if tgt.endswith("/") or fp.is_dir():
                fp = fp / "index.html"
            if not fp.exists():
                problems.append(f"{p.relative_to(ROOT)}: dead link {tgt!r}")
    return problems

CSS_URL = re.compile(r'url\(\s*["\']?([^"\')]+?)["\']?\s*\)', re.I)

@check
def no_root_absolute():
    """No INTERNAL ref starts with a single '/' — those 404 under a project subpath.
    External '//host' and 'scheme://' refs are fine (they don't start with a lone '/')."""
    href_src = re.compile(r'\b(?:href|src)\s*=\s*["\']([^"\']+)["\']', re.I)
    def root_abs(v): return v.startswith("/") and not v.startswith("//")
    problems = []
    for p in html_files():
        for m in href_src.finditer(read(p)):
            v = m.group(1)
            if root_abs(v):
                problems.append(f"{p.relative_to(ROOT)}: root-absolute ref {v!r}")
    for p in css_files():
        for m in CSS_URL.finditer(read(p)):
            v = m.group(1).strip()
            if root_abs(v):
                problems.append(f"{p.relative_to(ROOT)}: root-absolute url() {v!r}")
    return problems

@check
def chrome_nav():
    """chrome.js builds the primary nav base-aware (links_resolve can't see it);
    assert each base-relative ref is present AND its on-disk target exists."""
    js = ROOT / "assets" / "chrome.js"
    if not js.exists():
        return ["assets/chrome.js missing"]
    txt = read(js)
    problems = []
    # (base-relative ref expected in chrome.js, on-disk target it must resolve to)
    # Arena is temporarily unlinked from the nav (scaffold kept in arena/).
    nav = [
        ("../", ROOT),                                  # brand → site base
        ("../benchmarks/", ROOT / "benchmarks" / "index.html"),
        ("../about.html", ROOT / "about.html"),
    ]
    for rel, target in nav:
        if rel not in txt:
            problems.append(f"chrome.js: missing nav ref {rel!r}")
        if not target.exists():
            problems.append(f"chrome.js: nav target for {rel!r} missing on disk")
    return problems

@check
def font_refs_resolve():
    """Every url() in theme.css resolves (relative to assets/) to a real file —
    a dangling font ref would otherwise pass silently."""
    theme = ROOT / "assets" / "theme.css"
    if not theme.exists():
        return ["assets/theme.css missing"]
    problems = []
    for m in CSS_URL.finditer(read(theme)):
        v = m.group(1).strip()
        if v.startswith(("http://", "https://", "//", "data:")):
            continue
        fp = (ROOT / v.lstrip("/")) if v.startswith("/") else (theme.parent / v)
        if not fp.exists():
            problems.append(f"theme.css: dangling url({v!r})")
    return problems

@check
def bench_page():
    """The benchmarks page wires bench.js + has committed board data."""
    idx = ROOT / "benchmarks" / "index.html"
    problems = []
    if not idx.exists(): return ["benchmarks/index.html missing"]
    txt = read(idx)
    if 'src="bench.js"' not in txt: problems.append("benchmarks/index.html: missing bench.js")
    if not (ROOT / "benchmarks" / "bench.js").exists(): problems.append("benchmarks/bench.js missing")
    if not (ROOT / "benchmarks" / "data" / "leaderboard.json").exists(): problems.append("benchmarks/data/leaderboard.json missing")
    if not (ROOT / "benchmarks" / "data" / "models").is_dir(): problems.append("benchmarks/data/models/ missing")
    bj = ROOT / "benchmarks" / "bench.js"
    if bj.exists() and "exercise_results.json" not in read(bj):
        problems.append("benchmarks/bench.js: missing exercise_results.json reference")
    if not (ROOT / "benchmarks" / "data" / "exercise_results.json").exists():
        problems.append("benchmarks/data/exercise_results.json missing")
    return problems

@check
def js_no_external_or_root_fetch():
    """bench.js must fetch only relative same-origin paths (no CDN, no root-absolute)."""
    import re
    problems = []
    for p in ROOT.rglob("*.js"):
        txt = read(p)
        for m in re.finditer(r'fetch\(\s*["\'](/?)(https?:)?(//)?', txt):
            lead, scheme, slashes = m.group(1), m.group(2), m.group(3)
            if scheme or slashes:
                problems.append(f"{p.relative_to(ROOT)}: external fetch {m.group(0)!r}")
            elif lead == "/":
                problems.append(f"{p.relative_to(ROOT)}: root-absolute fetch {m.group(0)!r}")
    return problems

def main():
    failed = 0
    for fn in CHECKS:
        problems = fn()
        if problems:
            failed += 1
            print(f"FAIL {fn.__name__}")
            for p in problems:
                print(f"      - {p}")
        else:
            print(f"ok   {fn.__name__}")
    if failed:
        print(f"\n{failed} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")

if __name__ == "__main__":
    main()
