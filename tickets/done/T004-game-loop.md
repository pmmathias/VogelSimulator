# T004: Game loop
**Priority:** P0 | **Phase:** 1 | **Size:** M
**Depends on:** T001

## Description
Create GameLoop.js with requestAnimationFrame loop, delta time calculation, delta capping to avoid spiral of death.

## Acceptance Criteria
- [x] rAF loop with delta time
- [x] Delta capped at 1/30s
- [x] Callback registration via onUpdate()
