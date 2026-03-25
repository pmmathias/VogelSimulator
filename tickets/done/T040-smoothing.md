# T040: Smoothing + deadzone filtering on pose input
**Priority:** P0 | **Phase:** 4 | **Size:** M
**Depends on:** T034, T035, T036

## Description
Apply exponential moving average smoothing and deadzone filtering to raw pose input values. Prevents jittery flight controls from noisy landmark detection while maintaining responsiveness.

## Acceptance Criteria
- [ ] EMA smoothing applied to pose input values
- [ ] Deadzone near neutral suppresses noise
- [ ] Smoothing factor configurable
- [ ] Input still feels responsive despite filtering
