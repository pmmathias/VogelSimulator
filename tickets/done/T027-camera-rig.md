# T027: Third-person chase cam with smooth follow
**Priority:** P0 | **Phase:** 3 | **Size:** M
**Depends on:** T021, T003

## Description
A third-person camera that follows behind and above the bird. Uses smooth damping so the camera doesn't snap instantly but eases toward the target position and look-at point.

## Acceptance Criteria
- [x] Camera positioned behind and above bird
- [x] Smooth damping on position follow
- [x] Camera look-at tracks bird with easing
- [x] No jitter at high speeds
