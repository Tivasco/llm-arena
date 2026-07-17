# Build Plan for Challenge "First Light" (01-launch-hero)

## 1. Approach
Create a single self‑contained `index.html` that combines semantic HTML, CSS custom properties for light/dark themes, and a small vanilla‑JS module handling three independent concerns:
1. **Countdown timer** – calculates remaining time to the fixed launch instant, updates DOM every second, and swaps to a “We’re live” message when the target is reached or passed.
2. **Email capture** – validates input with a regex, shows inline error/success messages, prevents page reload, and disables further submissions after success.
3. **Theme toggle** – a button that flips CSS custom properties, persists the choice in `localStorage`, and falls back to the OS `prefers‑color‑scheme` on first load.
All logic lives in an IIFE to avoid polluting the global scope. CSS uses flexbox and responsive breakpoints (320 px – 1440 px) with a purposeful colour palette for both themes. A single subtle motion (fade‑in of the hero and a slide‑up of the countdown) satisfies the design requirement.

## 2. Structure
| Region / Element | Responsibility | Key IDs / Classes |
|------------------|-----------------|-------------------|
| `<header>` | Hero headline, sub‑headline, theme toggle button (`#theme-toggle`) |
| `<section id="countdown">` | Four unit boxes (`.unit[data-unit]`) for days, hrs, mins, secs |
| `<section id="live-msg">` | Hidden “We’re live” message (`#live-message`) |
| `<form id="signup">` | Email input (`#email-input`), submit button (`#submit-btn`), inline message container (`#msg`) |
| `<script>` | **Modules**: `timer`, `validation`, `theme` – each exported as a plain object; an init block wires them together. |
| `<style>` | CSS variables (`--bg`, `--text`, `--accent`), light/dark theme definitions, responsive layout, focus outlines, motion keyframes. |

**JS Modules (inside the IIFE)**
- `timer.start(targetISO)` – sets interval, updates DOM, handles zero‑padding, swaps UI on expiry.
- `validation.handle(form)` – attaches submit listener, runs regex `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`, toggles classes `error`/`success`.
- `theme.init()` – reads `localStorage`, applies OS preference, registers click handler on `#theme-toggle`.

## 3. Hard Parts & Mitigations
1. **Accurate countdown without drift** – Use `Date.now()` each tick, compute diff from target, and render values directly; avoid decrementing a stored counter.
2. **Zero‑padding & day overflow** – Pad hours/minutes/seconds with `String(val).padStart(2, '0')`; days rendered as plain number (no pad) but allow any length.
3. **Theme persistence & OS fallback** – On load, check `localStorage.getItem('theme')`; if absent, use `matchMedia('(prefers-color-scheme: dark)')`. Store choice on toggle.
4. **Form state after success** – Disable input and button, show “you’re on the list” message; subsequent submits are ignored because the form is disabled.
5. **Responsive layout & focus visibility** – Use `rem` units, flex wrap, and explicit `:focus-visible` outlines to meet accessibility.

## 4. Verification (mapping spec assertions → test actions)
| Spec # | How the page satisfies it & manual check |
|--------|------------------------------------------|
| 1️⃣ Countdown renders live units, updates each second | Load page, open console → verify `#countdown` shows four boxes; watch numbers decrement every second. |
| 2️⃣ Past date → “We’re live” replaces countdown | Change `TARGET_DATE` to a past ISO in the script (or set system clock) → page shows element `#live-message` and hides countdown. |
| 3️⃣ Zero‑padding | Inspect any hour/minute/second value < 10 → should display with leading `0`. |
| 4️⃣ Email validation errors | Submit empty, `foo`, `foo@`, `a@b` → inline message with class `error` appears. |
| 5️⃣ No page reload on submit | Observe network tab / console – no navigation occurs; form `submit` event prevented. |
| 6️⃣ Success clears input & blocks second submit | Submit a valid email → success message, input cleared/disabled; try submitting again – no success shown. |
| 7️⃣ Theme toggle persists | Click toggle → colors switch; reload page – same theme remains. |
| 8️⃣ Initial theme follows OS preference | Open page in a fresh incognito window with system dark mode → dark colors appear; switch OS to light – reload shows light. |
| Design & motion | Visual inspection of hierarchy, contrast, hover/focus states, and a fade‑in animation on load. |
| Responsiveness | Resize viewport from 320 px to 1440 px – layout stays intact, no horizontal scroll. |
| Accessibility basics | Verify `<label>` for email input, focus outlines visible, ARIA live region for countdown (optional). |

## 5. Design Intent
- **Palette**: Light – soft teal background (`#e0f7fa`) with dark text; Dark – deep navy (`#121212`) with teal accent. Contrast ratios meet WCAG AA.
- **Typography**: System stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) with hierarchical `clamp()` sizes for fluid scaling.
- **Spacing**: 1 rem base, vertical rhythm using `gap` in flex containers.
- **Motion Detail**: Hero section fades in (`opacity` 0→1) and slides up the countdown boxes on first render (keyframes `slideUp`). Respects `prefers-reduced-motion` – motion disabled if user prefers reduced.

## 6. Deliverables
- `plan.md` (this document) placed in the run folder.
- In the next **Build** round, a single `index.html` will be produced containing all HTML, CSS, and JS as outlined above.
