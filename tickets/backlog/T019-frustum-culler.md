# T019: Frustum culler
**Priority:** P0 | **Phase:** 2 | **Size:** M
**Depends on:** T018

## Description
Query octree against camera frustum each frame. Enable/disable chunk visibility based on intersection test.

## Acceptance Criteria
- [ ] Chunks outside frustum are hidden
- [ ] Chunks inside frustum are shown
- [ ] No visual popping artifacts
