# T023: Lift from flap input impulse model
**Priority:** P0 | **Phase:** 3 | **Size:** M
**Depends on:** T021

## Description
When the player flaps, apply an upward lift impulse to the velocity. The impulse magnitude is tuned so repeated flapping sustains altitude while single flaps only slow descent.

## Acceptance Criteria
- [x] Flap input triggers upward impulse
- [x] Impulse magnitude is configurable
- [x] Repeated flapping sustains or gains altitude
