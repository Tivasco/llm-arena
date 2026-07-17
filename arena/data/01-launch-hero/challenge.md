# Challenge 01 — "First Light" launch page

**Tier:** `webdev-v1` · **Level:** 1 / 5 · **Item id:** `webdev-v1:01-launch-hero`
**Build:** one shot · **Deliverable:** a single self-contained `index.html`

## Brief

Build the pre-launch landing page for a fictional product called **Aurora** — a note-taking app that
launches soon. The page's whole job is to build anticipation and capture emails: a strong hero, a live
countdown to launch, an email sign-up that actually validates, and a light/dark theme the visitor can flip.
It should look like a real product's launch page, not a template.

You choose the copy, the palette, and the personality. The requirements below fix only the behaviour and the
bones.

## Functional requirements (logic) — testable assertions

1. **Countdown.** A live countdown to the launch instant **`2026-09-01T09:00:00` (local time)** renders four
   units — days, hours, minutes, seconds — and ticks down every second without drift or layout jitter.
2. When the launch instant has passed (or you hard-code a past date to test), the countdown is replaced by a
   clear **"We're live"** state instead of showing negative or frozen numbers.
3. Each unit is **zero-padded to two digits** (e.g. `07`, not `7`); days may exceed two digits.
4. **Email capture.** Submitting the form runs client-side validation: an empty field and a malformed address
   (e.g. `foo`, `foo@`, `a@b`) are **rejected with an inline error message**; a well-formed address shows an
   inline **success** state.
5. The form **never reloads or navigates the page** on submit (no full-page POST).
6. After a successful submit the input clears (or is visibly locked into a "you're on the list" state); a
   second empty submit does not falsely succeed.
7. **Theme toggle.** A control switches the whole page between light and dark. The choice **persists across
   reload** via `localStorage`.
8. On first visit (no stored choice), the initial theme **respects the OS preference** (`prefers-color-scheme`).

## Design requirements (styling)

- A genuine visual hierarchy: the hero headline is the unmistakable focal point; countdown and form are
  clearly secondary but prominent.
- A cohesive, deliberate colour + spacing system — both the light and the dark theme must look intentional,
  not one being an afterthought with unreadable contrast.
- At least one tasteful, non-gratuitous motion detail (entrance fade/slide, gradient, or the tick animation).
- Real interactive states: hover, active, and **visible focus** on the button, input, and toggle.
- Reads well and stays usable from 320px to 1440px.

## Constraints

Standard `webdev-v1` rules apply (see `../README.md`): one `index.html`, fully offline / zero network,
vanilla HTML+CSS+JS only, no build step, no runtime errors, ship complete, accessibility baseline, responsive.

## Stretch goals (optional — separates the top of the board)

- Countdown units animate on change (flip/roll) without causing layout shift.
- A subtle, self-contained animated background (CSS gradient/keyframes) that respects
  `prefers-reduced-motion`.
- Inline validation as the user types, not only on submit.

## Scoring (100 pts)

| Dimension | Pts | What earns it |
|---|---|---|
| Functional | 50 | Assertions 1–8, ~6 pts each, pass/fail in a browser. |
| Design & craft | 30 | Hierarchy, both themes intentional & readable, motion, states, responsive. |
| Code quality | 10 | Readable single file; countdown/validation/theme cleanly separated; no dead code. |
| Robustness | 10 | Past-date state, malformed emails, reload persistence, first-visit OS theme, clean console. |

## Definition of done

Opened as a `file://` with the network off: the clock ticks, a bad email is rejected and a good one is
accepted without a reload, the theme flips and survives a refresh, and it looks like a launch page you'd
actually sign up on.
