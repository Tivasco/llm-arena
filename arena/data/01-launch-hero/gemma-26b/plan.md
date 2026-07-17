# Build Plan: Aurora "First Light" Launch Page

## Approach
The core idea is to build a high-impact, single-page landing page using semantic HTML5, modern CSS (Flexbox/Grid + CSS Variables), and vanilla JavaScript. I will use a component-based structure within a single file, separating the Countdown Engine, Form Validator, and Theme Manager into distinct JS modules for clarity and robustness. To ensure design intentionality, I'll define a robust color palette via CSS variables that maps to both light and dark modes, ensuring high contrast and accessibility in both.

## Structure
- **HTML Layout**:
    - `<header>`: Contains the brand (Aurora) and the Theme Toggle button.
    - `<main>`:
        - `section#hero`: The focal point with a large headline and subtext.
        - `section#countdown`: A container for the four time units (Days, Hours, Minutes, Seconds).
        - `section#signup`: The email capture form with input, submit button, and error/success message containers.
    - `<footer>`: Minimal copyright/links to maintain hierarchy.
- **CSS Architecture**:
    - Root variables for spacing, typography, and transitions.
    - Color variable sets: `--bg`, `--text`, `--accent`, `--surface` (for both `.theme-light` and `.theme-dark`).
    - Responsive utility classes and media queries for 320px to 1440px range.
- **JS Modules**:
    - `ThemeManager`: Handles `localStorage` persistence, OS preference detection via `matchMedia`, and class toggling on `document.documentElement`.
    - `CountdownEngine`: A `setInterval`-based clock that calculates time remaining until `2026-09-01T09:00:00`, handles the "We're live" state, and performs zero-padding.
    - `FormHandler`: Manages event listeners for form submission, regex-based email validation, UI state updates (error/success messages), and input resetting.

## The Hard Parts
1. **Countdown Drift & Jitter**: To prevent layout shifts when numbers change width (e.g., '1' to '01'), I will use a monospace font for the timer digits or `font-variant-numeric: tabular-nums`. I'll ensure the interval is robust by calculating the delta from the target time on every tick rather than just subtracting 1 second.
2. **Theme Persistence & OS Sync**: Getting the order of operations right (Check `localStorage` -> if empty, check `prefers-color-scheme`) to prevent a "flash of unstyled content" or incorrect theme on initial load. I'll apply the theme class as early as possible in the script execution.
3. **Robust Form Validation**: Implementing a regex that is strict enough to catch `foo@` or `a@b` while remaining standard-compliant, and ensuring the success/error states are visually distinct and accessible (ARIA live regions).

## Verification
1. **Countdown Logic**: Verify digits tick every second, show zero-padding (`07`), and transition to "We're live" if the target date is set in the past.
2. **Email Validation**: Test with `""`, `"test"`, `"test@"`, and `"test@example.com"`; check for inline error messages and successful state/input clearing without page reload.
3. **Theme Toggle**: Flip themes, refresh the browser, and verify the choice persists. Check that a fresh visit (cleared storage) respects `prefers-color-scheme`.
4. **Responsiveness**: Resize viewport from mobile to desktop to ensure no horizontal scroll and proper font scaling.

## Design Intent
- **Palette**: A "Twilight" inspired theme—deep purples/indigos for dark mode, soft lavender/whites for light mode, with a vibrant cyan or gold accent for the CTA.
- **Typography**: A sophisticated Sans-Serif (system stack: Inter/system-ui) with heavy weights for headlines to establish hierarchy.
- **Motion**: A subtle fade-in entrance animation for the hero text and a smooth scale effect on the countdown numbers when they tick.
