# T022: Gravity + terminal velocity
**Priority:** P0 | **Phase:** 3 | **Size:** M
**Depends on:** T021

## Description
Apply gravitational acceleration to the bird each frame. Clamp downward speed to a terminal velocity constant to prevent unrealistic free-fall speeds.

## Acceptance Criteria
- [x] Gravity accelerates bird downward each frame
- [x] Terminal velocity caps maximum fall speed
- [x] Constants defined in config
