# Build Plan — Aurora "First Light" Launch Page

## Approach

Single `index.html` with semantic HTML, CSS custom properties for theming, and vanilla JS
split into three self-contained modules: **Countdown**, **EmailForm**, **ThemeToggle**.

Design direction: a cosmic/aurora aesthetic. Dark theme uses deep navy-to-purple gradient
background with warm amber accent. Light theme uses soft lavender-to-sky gradient with
indigo accent. Both themes are designed equally, not one derived from the other.

## Structure

```
<body>
  <div class="bg-animation">  <!-- subtle CSS gradient animation -->
  <header>
    <span class="logo">Aurora</span>
    <button class="theme-toggle" aria-label="Toggle theme">☀/☾</button>
  </header>
  <main class="hero">
    <h1>Notes, illuminated.</h1>
    <p class="subtitle">A new way to capture ideas. Launching soon.</p>

    <section class="countdown" aria-label="Countdown to launch">
      <div class="unit"><span class="value" data-unit="days">000</span><label>Days</label></div>
      <div class="unit"><span class="value" data-unit="hours">00</span><label>Hours</label></div>
      <div class="unit"><span class="value" data-unit="minutes">00</span><label>Minutes</label></div>
      <div class="unit"><span class="value" data-unit="seconds">00</span><label>Seconds</label></div>
    </section>

    <!-- Replaced by <div class="live-banner">We're live!</div> when date passes -->

    <form class="signup-form" novalidate>
      <div class="input-group">
        <input type="email" id="email" placeholder="your@email.com" aria-label="Email address" required>
        <button type="submit">Notify me</button>
      </div>
      <p class="form-message" aria-live="polite"></p>
    </form>
  </main>
  <footer>© 2026 Aurora</footer>
</body>
```

## Implementation Details

### Countdown (Assertion 1-3)
- **No-drift tick:** `setTimeout` recalculated each tick to align with the next whole second
  (compensates for JS execution time). Never use `setInterval`.
- **Zero-pad:** `String(n).padStart(2, '0')` for hours/minutes/seconds. Days: no padStart cap,
  but fixed-width container via `min-width` + `tabular-nums` to prevent layout jitter.
- **Past-date state (Assertion 2):** When `now >= launchDate`, replace the countdown DOM with
  a "We're live" banner. Clear the timer.

### Email Validation (Assertion 4-6)
- **Regex:** `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` — rejects `foo` (no @), `foo@` (no domain),
  `a@b` (TLD too short), accepts `user@domain.com`.
- **Inline error:** Show message below input with `role="alert"` and `aria-live="polite"`.
- **No reload:** `event.preventDefault()` on submit.
- **Post-success:** Clear the input, show success message, disable button with "You're on the list!"
  text. A second empty submit hits the disabled button or re-validates the empty field as invalid.

### Theme Toggle (Assertion 7-8)
- **CSS custom properties** on `:root` for all colors. `[data-theme="dark"]` overrides.
- **Persistence:** `localStorage.setItem('aurora-theme', 'dark|light')` on toggle.
- **First visit:** Read `localStorage` first. If absent, check `window.matchMedia('prefers-color-scheme: dark')`.
- **Apply before paint:** Run theme detection in a `<script>` in `<head>` to prevent flash of
  wrong theme.

### Accessibility
- Semantic elements: `<header>`, `<main>`, `<footer>`, `<section>`, `<form>`, `<label>`.
- `aria-label` on theme toggle and countdown section.
- `aria-live="polite"` on form messages.
- Visible `:focus-visible` outlines on all interactive elements.
- Sufficient contrast in both themes (test with WCAG AA ratios).

### Responsive
- Mobile-first CSS. Countdown units in a flex row that wraps to 2x2 grid below ~480px.
- Form input + button stack vertically on narrow screens.
- Fluid typography with `clamp()` for the hero headline.
- Max-width container for readability at wide viewports.

### Motion (Stretch Goals)
- **Countdown flip:** CSS class `.flip` triggered when a digit changes, using a Y-axis
  `transform: rotateX()` keyframe. No layout shift — the container dimensions are fixed.
- **Background animation:** Subtle CSS `@keyframes` shifting gradient stops, gated behind
  `@media (prefers-reduced-motion: no-preference)`.
- **Entrance:** Hero elements fade-slide in on page load.
- **Inline validation:** Show validation state as the user types (after first blur or on
  `input` after 500ms debounce).

## Verification Checklist

| # | Assertion | How to verify |
|---|-----------|---------------|
| 1 | Countdown ticks every second | Observe seconds changing; check no drift over 30s |
| 2 | Past-date → "We're live" | Temporarily set launchDate to past date, reload |
| 3 | Zero-padded units | Confirm `07` not `7` for single-digit values |
| 4 | Email validation | Submit `""`, `foo`, `foo@`, `a@b` → error; `test@example.com` → success |
| 5 | No page reload | Submit form, check URL unchanged, DevTools Network shows no navigation |
| 6 | Post-success state | After success, submit again empty → no false success |
| 7 | Theme persists | Toggle theme, reload page → theme retained |
| 8 | OS preference | Clear localStorage, reload → matches system preference |

## Hard Parts & Risks

1. **Countdown drift** — mitigated by recalculating `setTimeout` delay each tick.
2. **Theme flash on load** — mitigated by inline `<script>` in `<head>` applying theme before paint.
3. **Email regex edge cases** — the spec gives concrete examples; the regex must reject all three
   (`foo`, `foo@`, `a@b`) while accepting standard addresses.
4. **Layout jitter on countdown** — `tabular-nums` + fixed `min-width` containers.
