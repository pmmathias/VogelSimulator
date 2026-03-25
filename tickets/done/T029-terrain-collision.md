# T029: Terrain collision altitude floor
**Priority:** P0 | **Phase:** 3 | **Size:** M
**Depends on:** T021, T009

## Description
Prevent the bird from flying below terrain height. Each frame, sample terrain height at the bird's XZ position and clamp altitude to stay above ground with a small offset.

## Acceptance Criteria
- [x] Bird altitude clamped above terrain height
- [x] Terrain height sampled at bird XZ position
- [x] Small offset prevents z-fighting at ground level
