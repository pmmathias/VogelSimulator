# T009: Terrain height function
**Priority:** P0 | **Phase:** 2 | **Size:** M
**Depends on:** T006

## Description
Implement the parabolic arc height function: height(x,z) = SUM_i[h_i * max(0, 1 - ((x-cx_i)^2 + (z-cz_i)^2) / r_i^2)]. Generate 50-100 random arcs with varying centers, radii, and heights.

## Acceptance Criteria
- [ ] Height function returns correct values
- [ ] Random arc generation with configurable count
- [ ] Unit test verifies known coordinates
