# T033: Shoulder-elbow-wrist angle calculation
**Priority:** P0 | **Phase:** 4 | **Size:** M
**Depends on:** T032

## Description
From pose landmarks, compute the angle at each elbow (shoulder-elbow-wrist) and the elevation angle of each arm relative to the torso. These angles drive flap detection and tilt calculations.

## Acceptance Criteria
- [ ] Elbow angle calculated from three landmark points
- [ ] Arm elevation angle computed relative to torso
- [ ] Angles computed for both left and right arms
- [ ] Output values stable and in consistent units (radians)
