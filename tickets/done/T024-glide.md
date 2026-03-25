# T024: Glide ratio and drag coefficient
**Priority:** P0 | **Phase:** 3 | **Size:** M
**Depends on:** T021

## Description
Implement aerodynamic drag and a glide ratio so the bird loses altitude gradually when not flapping. Forward speed is traded for lift according to the glide ratio constant.

## Acceptance Criteria
- [x] Drag coefficient slows bird over time
- [x] Glide ratio converts forward speed to vertical lift
- [x] Bird descends gradually without flap input
