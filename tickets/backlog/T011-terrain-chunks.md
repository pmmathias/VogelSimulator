# T011: Terrain chunk system
**Priority:** P0 | **Phase:** 2 | **Size:** M
**Depends on:** T010

## Description
Split the world terrain into an NxN grid of chunks. Each chunk is an independent mesh that can be toggled visible/invisible for culling.

## Acceptance Criteria
- [ ] World divided into CHUNK_COUNT x CHUNK_COUNT chunks
- [ ] Each chunk is a separate Mesh
- [ ] Chunks seamlessly tile together
