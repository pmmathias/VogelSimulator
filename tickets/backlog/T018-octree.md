# T018: Octree construction
**Priority:** P0 | **Phase:** 2 | **Size:** L
**Depends on:** T011

## Description
Build custom Octree from terrain chunk bounding boxes. Recursive subdivision with max depth 5-6. Each leaf maps to terrain chunks.

## Acceptance Criteria
- [ ] Octree builds from chunk AABBs
- [ ] Correct recursive subdivision
- [ ] Unit test with known geometry
