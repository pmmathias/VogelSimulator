# T037: InputManager pose + keyboard merge
**Priority:** P0 | **Phase:** 4 | **Size:** M
**Depends on:** T028, T034, T035, T036

## Description
InputManager merges pose-based input and keyboard input into a single unified input state. When pose data is available it takes priority; keyboard serves as fallback. Outputs normalized flap, pitch, and roll values.

## Acceptance Criteria
- [ ] Unified input interface for flap, pitch, roll
- [ ] Pose input takes priority when available
- [ ] Keyboard fallback works when pose unavailable
- [ ] Smooth transition if pose tracking is lost mid-session
