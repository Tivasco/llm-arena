# Plan — Aurora "First Light" Launch Page

## Approach

A single `index.html` with three cleanly separated `<script>` blocks and one `<style>` block. The page is a vertically-stacked, centered layout:

```
[theme toggle — top-right]
[hero headline + subcopy]
[countdown: days | hours | minutes | seconds]
[email capture form]
[footer microcopy]
```

Everything is flexbox-centered, max-width constrained (~680px), and responsive from 320px upward.

## Structure

### HTML
- `<header>` with the theme toggle button (aria-label, aria-pressed)
- `<main>` containing:
  - `<h1>` hero headline ("Aurora" + tagline)
  - `<section id="countdown">` with four `<div class="countdown-unit">` elements (data-label for days/hours/minutes/seconds)
  - `<section id="signup">` with a `<form>` containing `<label>`, `<input type="email">`, `<button type="submit">`, and an inline `<p class="validation-msg">` for errors/success
- `<footer>` with minimal microcopy

### CSS
- **Design tokens** via `:root` custom properties for colors, spacing, typography scale, border-radius, transitions.
- **Dark theme** via `[data-theme="dark"]` override of the same tokens.
- **Color palette** — Aurora-inspired:
  - Light: warm off-white background, deep navy text, gradient accent from violet to cyan for the headline
  - Dark: near-black background, soft white text, same gradient accent (adjusted for contrast)
- **Typography**: system font stack, headline at ~3rem (responsive clamp), countdown units large and monospaced
- **Motion**: entrance fade-up on page load (staggered), subtle gradient animation on the headline, countdown digit change pulse
- **Focus states**: visible ring outline on all interactive elements
- **Responsive**: clamp() for font sizes, flex-wrap for countdown units, padding adjustments for 320px

### JavaScript (three modules)

#### 1. Theme module (`initTheme()`)
- On load: check `localStorage.getItem('aurora-theme')`. If present, apply it.
- If absent: read `window.matchMedia('(prefers-color-scheme: dark)')` and default accordingly.
- Toggle button: flips `data-theme` attribute, writes to `localStorage`, updates `aria-pressed`.
- Listens for OS-level `prefers-color-scheme` changes to update if user hasn't manually set a preference.

#### 2. Countdown module (`initCountdown()`)
- Target: `2026-09-01T09:00:00` (local).
- `setInterval` every 1000ms computes `diff = target - now`.
- If `diff <= 0`: replace countdown section content with "We're live" message, clear interval.
- Otherwise: compute days/hours/minutes/seconds, zero-pad hours/minutes/seconds to 2 digits, days left as-is (may exceed 2 digits).
- Only updates the text content of units that changed (avoids DOM thrashing).
- Uses `requestAnimationFrame`-aligned timing to avoid drift: stores last tick timestamp, computes offset.

#### 3. Email validation module (`initForm()`)
- Form `submit` event: `e.preventDefault()` (assertion 5 — no page reload).
- Validation regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (rejects `foo`, `foo@`, `a@b`).
- Empty input → inline error "Please enter your email address."
- Malformed → inline error "Please enter a valid email address."
- Valid → success state: input clears, shows "You're on the list" confirmation message, form is visually locked (disabled input + button, changed text).
- Second empty submit while locked → no false success (button disabled, form non-submittable).
- Stretch: inline validation on `input` event with debounced visual feedback (green border for valid, red for invalid).

## How it verifies itself (against scoring assertions)

| # | Assertion | How the plan satisfies it |
|---|-----------|--------------------------|
| 1 | Live countdown to `2026-09-01T09:00:00` | `setInterval` every 1s, four units, drift-corrected via timestamp delta |
| 2 | "We're live" after launch | `diff <= 0` check replaces countdown content |
| 3 | Zero-padded to 2 digits | `String.padStart(2, '0')` on hours/minutes/seconds |
| 4 | Email validation with inline errors | Regex check, inline `<p>` error/success messages |
| 5 | No page reload on submit | `e.preventDefault()` |
| 6 | Input clears / locked after success | Input disabled, "you're on the list" shown, second submit blocked |
| 7 | Theme toggle persists via localStorage | `localStorage.getItem`/`setItem` on toggle |
| 8 | First visit respects OS preference | `matchMedia('prefers-color-scheme')` fallback |

## Stretch goals included

- **Countdown digit animation**: CSS class toggle on each unit when its value changes (pulse scale effect, no layout shift).
- **Animated background**: subtle CSS gradient animation on a fixed-position pseudo-element behind the content, wrapped in `@media (prefers-reduced-motion: reduce)` to disable.
- **Inline validation as user types**: debounced validation on `input` event with visual border feedback (green/red), error message cleared on valid input.

## Trade-offs & decisions

1. **`data-theme` on `<html>` vs class on `<body>`** — Using `data-theme` attribute is more semantic for theme toggling and plays nicely with `prefers-color-scheme` media queries.
2. **Countdown drift correction** — Instead of `setInterval` alone (which drifts), we store the last tick timestamp and compute `elapsed = now - lastTick`, only updating when a full second has passed. This prevents the "frozen numbers" issue.
3. **Form lock vs. re-render** — After success, we disable the input and button and change the confirmation text rather than re-rendering the whole section. This is simpler and avoids layout shift.
4. **Gradient animation** — A single fixed-position `::before` on `<body>` with a slow `background-position` keyframe animation. Lightweight, no JS needed, respects `prefers-reduced-motion`.

## File layout (single file)

```
index.html
├── <style>
│   ├── CSS custom properties (light/dark tokens)
│   ├── Reset + base styles
│   ├── Layout (centered container)
│   ├── Theme toggle button
│   ├── Hero typography
│   ├── Countdown units
│   ├── Form + validation states
│   ├── Animations (entrance, gradient bg, digit pulse)
│   └── Responsive breakpoints
└── <script>
    ├── Theme module (initTheme)
    ├── Countdown module (initCountdown)
    └── Form module (initForm)
```
