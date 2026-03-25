# T032: MediaPipe PoseLandmarker init and loop
**Priority:** P0 | **Phase:** 4 | **Size:** L
**Depends on:** T031

## Description
Initialize MediaPipe PoseLandmarker with the vision task WASM runtime. Run detection in a loop synchronized with the video feed, producing landmark arrays each frame for downstream processing.

## Acceptance Criteria
- [ ] PoseLandmarker created with correct model and options
- [ ] Detection runs each frame on video input
- [ ] Landmark results available for downstream consumers
- [ ] Handles model loading errors gracefully
