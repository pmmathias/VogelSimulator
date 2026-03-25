# T034: Flap detection arm raise/lower frequency
**Priority:** P0 | **Phase:** 4 | **Size:** L
**Depends on:** T033

## Description
Detect flapping by tracking the vertical oscillation of both arms. A flap is registered when arms cross a height threshold on the downstroke. Frequency is tracked to modulate lift intensity.

## Acceptance Criteria
- [ ] Flap detected on arm downstroke crossing threshold
- [ ] Flap frequency measured over rolling window
- [ ] False positives filtered (e.g. single arm movement)
- [ ] Flap event emitted for physics consumption
