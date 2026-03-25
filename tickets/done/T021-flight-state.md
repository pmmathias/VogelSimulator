# T021: FlightState: position, velocity, orientation
**Priority:** P0 | **Phase:** 3 | **Size:** S
**Depends on:** T004

## Description
FlightState holds the bird's runtime physics state: 3D position, velocity vector, and orientation quaternion. Updated each frame by the physics step and read by the renderer.

## Acceptance Criteria
- [x] FlightState stores position (Vector3)
- [x] FlightState stores velocity (Vector3)
- [x] FlightState stores orientation (Quaternion)
- [x] State updated each frame in game loop
