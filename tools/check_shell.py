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
    """Every page links theme.css and includes chrome.js."""
    problems = []
    for p in html_files():
        txt = read(p)
        if 'href="/assets/theme.css"' not in txt:
            problems.append(f"{p.relative_to(ROOT)}: missing theme.css link")
        if 'src="/assets/chrome.js"' not in txt:
            problems.append(f"{p.relative_to(ROOT)}: missing chrome.js script")
    return problems

@check
def hub_doors():
    """index.html is a hub with exactly the two pillar doors."""
    idx = ROOT / "index.html"
    if not idx.exists():
        return ["index.html missing"]
    txt = read(idx)
    problems = []
    for href in ('href="/benchmarks/"', 'href="/arena/"'):
        if href not in txt:
            problems.append(f"index.html: missing door {href}")
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
