# T035: Lateral tilt arm height asymmetry = roll
**Priority:** P0 | **Phase:** 4 | **Size:** M
**Depends on:** T033

## Description
Compute roll input from the height difference between left and right wrists. When one arm is higher than the other, the bird banks in that direction. Normalized to [-1, 1] range.

## Acceptance Criteria
- [ ] Roll derived from left/right wrist height difference
- [ ] Output normalized to [-1, 1]
- [ ] Neutral position produces zero roll
- [ ] Responds smoothly to gradual arm tilt
