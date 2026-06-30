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
