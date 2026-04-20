# LLM Arena

A learning series comparing how different LLMs interpret the same prompts —
evaluating reasoning, CSS, JS, edge cases, and constraint adherence.

Each round is a single HTML/CSS/JS challenge. Outputs are saved side by side
and judged manually.

## Structure

```
gradient/       — output dir for the gradient-challenge scenario
spreadsheet/    — output dir for the spreadsheet-challenge scenario
tests/
  prompts.md    — the evaluation prompts (one per scenario)
```

Each scenario gets its own top-level directory. The model's output is a **single
self-contained `.html` file** (inline `<style>` + `<script>`, no external deps).

## Adding a new scenario

1. Create `tests/prompts/<name>.md` with the prompt.
2. Create the output directory `<name>/`.
3. Run the model against the prompt; save its output as `<name>/index.html`.

## Prompt design principles

Prompts should differentiate models along these axes:

- **Reasoning depth** — multi-step layout or state logic that forces the model
  to plan before writing code
- **CSS complexity** — gradients, animations, responsive grids, custom properties
- **JS complexity** — event handling, DOM manipulation, data binding, state
  management
- **Edge cases** — empty states, overflow, accessibility, input validation
- **Constraint adherence** — exact dimensions, color values, interactive behavior

## Gotchas

- **Single-file only.** Prompts must not require external CSS/JS files or CDNs.
  Everything must work from one `.html` file opened in a browser.
- **No build step.** This repo has zero tooling — no npm, no bundler, no
  linter. Output is raw HTML.
- **Comparisons are manual.** There's no automated scoring. Judge outputs by
  inspecting the rendered page and source code.
