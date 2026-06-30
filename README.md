# llm-arena

A learning series comparing how local LLMs perform — two ways:

- **Benchmarks** — deterministic, traceable pass-rate scoring (formatting, tool-use, coding).
- **Arena** — qualitative visual challenges: the same prompt, rendered by different models.

Live: https://tivasco.github.io/llm-arena

Static site, no build step. Preview locally with `python3 -m http.server` from the repo root.
Structural/no-CDN contract is enforced by `python3 tools/check_shell.py`.
