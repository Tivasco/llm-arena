# Build Plan: Aurora "First Light" Launch Page

## Approach
The goal is to create a high-conversion, polished pre-launch landing page for "Aurora". The core technical challenge is the synchronization of a live countdown, a robust email validation system, and a persistent theme engine. I will use a CSS-variable-driven design system to ensure seamless transitions between light and dark modes and a modular JS structure to handle the countdown and form logic independently.

## Structure

### HTML Regions
- **Navigation**: Minimal header with the Aurora logo and the Theme Toggle.
- **Hero Section**: 
    - H1 Headline (Focal point).
    - Subheadline providing context.
    - **Countdown Timer**: Four distinct blocks (Days, Hours, Minutes, Seconds).
    - **Email Capture Form**: Input field, Submit button, and a hidden error/success message area.
- **Footer**: Simple copyright and social placeholders (SVG icons).

### JS Modules/Functions
- `ThemeManager`: 
    - `init()`: Checks `localStorage` $\rightarrow$ `prefers-color-scheme` $\rightarrow$ applies class to `<html>`.
    - `toggle()`: Flips theme and updates `localStorage`.
- `CountdownTimer`: 
    - `update()`: Calculates delta between now and `2026-09-01T09:00:00`.
    - `render()`: Updates DOM with zero-padded strings; handles the "We're live" state.
    - `start()`: Sets up a 1s interval.
- `FormHandler`: 
    - `validateEmail(email)`: Regex check for well-formed addresses.
    - `handleSubmit(event)`: Prevents default, validates, and updates UI state (success/error).

## The Hard Parts
1. **Countdown Jitter**: To prevent layout shift when numbers change (e.g., '1' vs '8'), I will use a monospaced font for the digits or fixed-width containers.
2. **Theme Flash**: To avoid a "flash of light mode" on reload for dark-mode users, the `ThemeManager.init()` script will be placed at the very top of the `<head>` or executed immediately before the body renders.
3. **Email Validation**: Ensuring a strict but fair regex that catches `foo@` or `a@b` as requested, while providing clear inline feedback.

## Verification
- **REQ 1 (Countdown)**: Verify digits tick every second; check that `2026-09-01T09:00:00` is the target.
- **REQ 2 (Live State)**: Temporarily change target date to yesterday; verify "We're live" appears.
- **REQ 3 (Zero-padding)**: Verify `09` instead of `9` for hours/mins/secs.
- **REQ 4 (Validation)**: Test empty, `foo`, `foo@`, and `valid@email.com`; verify inline messages.
- **REQ 5 (No Reload)**: Verify `event.preventDefault()` is called; page does not refresh on submit.
- **REQ 6 (Post-Submit)**: Verify input clears/locks and subsequent empty submits don't trigger success.
- **REQ 7 (Persistence)**: Toggle theme $\rightarrow$ Refresh page $\rightarrow$ Theme remains.
- **REQ 8 (OS Preference)**: Clear `localStorage` $\rightarrow$ Change OS theme $\rightarrow$ Refresh page.

## Design Intent
- **Palette**: A "Celestial" theme. Light mode: Soft whites, airy blues, and a vibrant indigo accent. Dark mode: Deep midnight navy, slate grays, and a glowing cyan/violet accent.
- **Typography**: System sans-serif stack for speed, with a bold, tight-kerning H1.
- **Motion**: A subtle "breathing" glow effect on the countdown units and a smooth CSS transition (0.3s) for theme switching.
- **Interaction**: High-contrast focus rings (`outline: 2px solid accent`) for accessibility.
