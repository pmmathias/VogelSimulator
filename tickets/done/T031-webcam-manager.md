# T031: WebcamManager getUserMedia permissions
**Priority:** P0 | **Phase:** 4 | **Size:** M
**Depends on:** T004

## Description
WebcamManager handles requesting camera permissions via getUserMedia, managing the video stream lifecycle, and providing the video element to the pose detector.

## Acceptance Criteria
- [ ] getUserMedia called with appropriate constraints
- [ ] Permission denial handled gracefully with fallback message
- [ ] Video stream starts and provides HTMLVideoElement
- [ ] Stream can be stopped and restarted
