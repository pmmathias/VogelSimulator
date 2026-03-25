# T028: Keyboard fallback Space/WASD
**Priority:** P0 | **Phase:** 3 | **Size:** M
**Depends on:** T021

## Description
Keyboard input as fallback when no webcam is available. Space for flap, W/S for pitch, A/D for roll. Provides the same input interface as pose detection will later.

## Acceptance Criteria
- [x] Space triggers flap input
- [x] W/S controls pitch up/down
- [x] A/D controls roll left/right
- [x] Input values normalized to same range as pose input
