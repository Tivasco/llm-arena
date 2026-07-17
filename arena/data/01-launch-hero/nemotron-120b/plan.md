# Build Plan for Aurora Launch Page

## Approach
Create a single-file HTML landing page with three main sections: hero (headline + subheadline), countdown timer, and email capture form. Implement theme toggle functionality with persistence. Use vanilla JavaScript for all interactive logic.

## Page Structure
1. **Hero Section**: Product name, tagline, and brief description
2. **Countdown Section**: Live timer showing days/hours/minutes/seconds until launch
3. **Email Capture Section**: Form with validation and submit feedback
4. **Theme Toggle**: Control for switching between light/dark modes

## Implementation Details

### Countdown Logic
- Set target date to `2026-09-01T09:00:00` (local time)
- Calculate time difference every second using `setInterval`
- Convert milliseconds to days, hours, minutes, seconds
- Zero-pad values to 2 digits (except days which can exceed)
- Display "We're live" when target date has passed
- Prevent layout jitter by using fixed-width containers

### Email Validation
- Client-side validation on form submit
- Check for empty field and basic email format (contains @ and valid structure)
- Show inline error messages for invalid inputs
- Show success message for valid emails
- Prevent form submission/reload using `event.preventDefault()`
- Clear input after successful submission

### Theme System
- CSS variables for light and dark color palettes
- Theme toggle button/switch
- On load: check `localStorage` for saved theme, else use `prefers-color-scheme`
- Apply theme by adding class to `<html>` or `<body>` element
- Persist choice to `localStorage` on change

### Motion & Interactions
- Fade-in entrance animation for sections using CSS keyframes
- Subtle pulse or color change on countdown tick
- Hover/active/focus states on all interactive elements
- Focus outlines visible for accessibility

### File Organization
- Single `index.html` with:
  - Semantic HTML structure
  - CSS in `<style>` tag (including variables for both themes)
  - JavaScript in `<script>` tag (countdown, validation, theme logic)
- No external dependencies
- Accessible elements (labels, button types, semantic sections)

## Verification Plan
1. **Countdown**: Verify ticking, zero-padding, and "We're live" state
2. **Email Form**: Test validation (empty, malformed, valid) and success state
3. **Theme Toggle**: Check light/dark switching and persistence across reloads
4. **Responsiveness**: Test at 320px and 1440px widths
5. **Accessibility**: Verify semantic elements, focus states, contrast
6. **Offline**: Confirm no network requests

## Hard Parts & Solutions
- **Countdown drift**: Use `setInterval` with correction based on actual elapsed time
- **Theme persistence**: Store in `localStorage` and check on initial load
- **Validation UX**: Provide immediate feedback without being intrusive
- **Layout stability**: Use fixed dimensions for countdown units to prevent jitter
