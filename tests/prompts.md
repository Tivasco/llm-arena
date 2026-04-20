# LLM Arena — Round 1: Personal Dashboard

Build a **Personal Dashboard** — a single-page app with four interactive widgets.
Everything must live in one `.html` file (inline `<style>` + `<script>`, no
external dependencies).

## Layout

- Dark background (`#121212`)
- Centered card grid, max-width `1100px`, auto-responsive (2×2 on desktop,
  1 column below `768px`)
- Each widget is a card: `background #1E1E1E`, `border-radius 12px`, subtle
  `box-shadow`
- Cards have a colored top accent bar (see each widget below)

---

## Widget 1 — Clock

- Shows the **current time** in `HH:MM:SS` 24-hour format
- Time updates every second (no external libraries)
- Below the time, show the **full date** (e.g. "Monday, April 20, 2026")
- Accent bar: gradient from `#6C63FF` to `#3F3D56`
- Typography: large, readable time; smaller date text in `#888`

---

## Widget 2 — Task List

- A text input + "Add" button to create tasks
- Each task renders as a row with:
  - A checkbox (click to toggle complete)
  - Task text (strikethrough when complete)
  - A "Delete" button (×) on hover
- Tasks persist in `localStorage` (survive page reload)
- Empty state: when no tasks exist, show centered text "No tasks yet — add one above"
- Accent bar: gradient from `#00B894` to `#00695C`
- Input validation: reject empty / whitespace-only input; trim before saving

---

## Widget 3 — Counter / Ticker

- Displays a numeric counter (starts at `0`)
- Three buttons: **Increment** (+1), **Decrement** (-1), **Reset** (back to 0)
- The counter value must never go below `0` (disable Decrement at `0`)
- Accent bar: gradient from `#E17055` to `#D63031`
- Counter text: large font, centered, `#fff`

---

## Widget 4 — Notes

- A `<textarea>` where the user can type free-form text
- Auto-saves to `localStorage` every 500ms (debounced)
- Shows a small indicator: "Saved" (green dot + text) when recently saved, or
  "Unsaved" (amber dot + text) when changes are pending
- Accent bar: gradient from `#FDCB6E` to `#E67E22`
- Placeholder text: "Start typing…"

---

## Interaction & Accessibility

- All interactive elements must be keyboard-accessible (Enter to add task,
  Tab/Enter to navigate buttons)
- Use `aria-label` on decorative buttons (e.g. the × delete button)
- Focus visible on all interactive elements (outline or ring)
- Hover states on buttons (subtle background shift)

## CSS Requirements

- Use at least **3 CSS custom properties** (e.g. for card bg, text color, accent)
- Smooth `transition` on interactive elements (`0.2s ease`)
- Responsive: cards stack vertically below `768px`
- No external fonts, icons, or libraries — use system fonts and CSS shapes/emojis
  for any icons

## What Judges Look For

| Axis | What to check |
|------|---------------|
| **Reasoning** | Correct time format, debounced save, localStorage persistence, counter floor at 0 |
| **CSS** | Responsive grid, gradients, custom properties, transitions, dark theme consistency |
| **JS** | `setInterval` clock, event delegation or clean handlers, debounce logic, storage API |
| **Edge cases** | Empty task state, counter floor, whitespace input rejection, focus states |
| **Constraints** | Exact colors, max-width 1100px, 768px breakpoint, no external deps |
