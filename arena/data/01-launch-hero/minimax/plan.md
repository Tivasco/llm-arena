# Build Plan — Aurora Pre-Launch Landing Page

## 1. Approach
A single self-contained `index.html` with embedded `<style>` and `<script>`. No external dependencies, no build step, works fully offline via `file://`. Theme detection uses `matchMedia('(prefers-color-scheme: dark)')` on first visit; subsequent visits read from `localStorage`. Countdown runs on a single stable `setInterval` (1000 ms) using `Date.now()` delta math to avoid drift. Email validation is a regex gate before any submission logic.

---

## 2. Page Structure

```
<body data-theme="light|dark">
  <header>          — logo/wordmark + theme toggle button
  <main>
    hero section:
      headline (h1)
      sub-headline / value prop
      countdown grid: [DD days] [HH hrs] [MM min] [SS sec]
      email form: input + submit button + inline feedback message
  </main>
</body>
```

**JS modules (logical separation inside one `<script>`):**
| Function | Responsibility |
|---|---|
| `initTheme()` | Read stored preference or OS; apply `[data-theme]` attribute to `<body>` |
| `toggleTheme()` | Flip theme, persist to `localStorage`, update toggle button label |
| `updateCountdown()` | Compute delta from now → target; zero-pad all units; swap to "We're live" when passed |
| `startCountdown()` | Single `setInterval` calling `updateCountdown` every 1000 ms |
| `validateEmail(v)` | Regex check returning boolean |
| `handleSubmit(e)` | Prevent default; validate; on success lock input and show success state |

---

## 3. The Hard Parts

1. **Countdown drift** — Using raw `setInterval(fn, 1000)` drifts over time. Fix: each tick computes `target − Date.now()` fresh rather than decrementing a stored value.

2. **"We're live" correctness** — When the delta goes negative (launch instant passed), the code must detect that before rendering and show the live state instead of `-1 days -23:-59:-59`. Must also clear the interval so it stops ticking.

3. **Theme FOUC prevention** — The `data-theme` attribute should be applied to `<body>` in the `<head>` (inline script, before any paint) using an IIFE that reads localStorage synchronously; CSS selectors `[data-theme="dark"]` will then match correctly on first render without a flash.

4. **Email UX edge cases** — Empty field, whitespace-only, malformed (`@` missing, multiple `@`, no TLD), and valid addresses all need distinct feedback. After success the input must become non-resubmittable (either clear + re-enable or lock).

---

## 4. Verification Against Functional Assertions

| # | Assertion | How verified |
|---|---|---|
| 1 | Countdown ticks days/hours/minutes/seconds, every second | Open DevTools console; change system clock forward by 60 s in browser; observe seconds decrement and higher units roll over correctly |
| 2 | "We're live" when launch instant passed | Set system clock to after 2026-09-01T09:00:00; page shows the live message, not negative numbers |
| 3 | Zero-padded units (days may exceed 2) | Visual check — seconds always show `05` not `5`; days can be `312` if far out |
| 4 | Email validation rejects empty/malformed with inline error | Submit empty → error shown; submit `notanemail` → error; submit `a@b.c` → success message |
| 5 | Form never reloads/navigates | DevTools Network tab shows no navigation request on submit |
| 6 | After successful submit, second empty submit fails | First submit succeeds; clear field (or re-focus locked input) and submit again → error or no-op |
| 7 | Theme toggle persists across reload | Toggle dark; reload page; still dark |
| 8 | OS preference respected on first visit (no stored choice) | Clear localStorage; open page with OS in dark mode; page is dark initially |

---

## 5. Design Intent

- **Palette:** Deep indigo/violet primary (`#4f46e5` / `#818cf8`) for light theme, soft lavender accent on near-black for dark — cohesive and premium-feeling.
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', …`) — no external fonts needed offline.
- **Spacing rhythm:** 8 px base unit; generous hero padding (80–120 px vertical); compact countdown number cards with tight inner gaps.
- **Motion investment:** Subtle `opacity + translateY` entrance on load for the hero content; smooth color transitions (`0.2 s ease`) on theme switch and interactive states; hover scale/shadow lift on the CTA button.
- **Responsive:** Single-column stack at ≤640 px; countdown 2×2 grid at 641–1024 px; full 4-across row above 1024 px. No horizontal overflow at any width.
