# T036: Forward lean = pitch
**Priority:** P1 | **Phase:** 4 | **Size:** M
**Depends on:** T033

## Description
Compute pitch input from the player's forward/backward lean. Measured by the relative position of shoulders to hips in the sagittal plane. Leaning forward pitches the bird down.

## Acceptance Criteria
- [ ] Pitch derived from shoulder-hip relative position
- [ ] Forward lean maps to nose-down pitch
- [ ] Backward lean maps to nose-up pitch
- [ ] Output normalized to [-1, 1]
