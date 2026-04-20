# AGENTS.md - Pathfinding Visualizer

This repository is a specific scenario within the LLM Arena. The goal is to produce a high-quality, single-file HTML implementation of an A* Pathfinding Visualizer.

## Core Constraints
- **Single File:** Everything (HTML, CSS, JS) must be in one `.html` file.
- **Zero Dependencies:** No external libraries, frameworks, or CDN imports (no jQuery, no Tailwind via CDN, etc.).
- **No Build Step:** Raw HTML/JS only.

## Implementation Requirements
### Grid & Interaction
- **Canvas:** Use HTML5 Canvas for the 30x20 grid.
- **Interactions:** 
  - Left-click drag: Draw walls.
  - Right-click drag: Erase walls.
  - Drag & Drop: Start (green) and End (red) nodes must be repositionable.
  - Shift + Draw: Create weighted terrain (cost = 5).

### Algorithm (A*)
- **Implementation:** Must be written from scratch. Use a Priority Queue/Min-Heap for the open set.
- **Heuristic:** Manhattan distance (no diagonal movement).
- **Visualization:** Distinct colors for: Unexplored, Open Set (frontier), Closed Set (visited), and Final Path.

### UI & UX
- **Theme:** Modern dark theme with clear visual hierarchy.
- **Controls:** 
  - Visualize, Clear Path (resets algorithm state), Clear All (resets grid), Random Maze.
  - Speed slider: 1 to 20 steps per frame.
- **Stats Panel:** Live updates for steps taken, cells visited, path length (cost), and elapsed time (ms).
- **Error Handling:** User-facing message if no path is found.

## Code Quality
- **Architecture:** Modular JS (separate Grid, Algorithm, Renderer, and UI logic). Avoid global variable soup; use a state object or module pattern.
- **Documentation:** Comments should explain the *why* of the A* logic, not just the *what*.
