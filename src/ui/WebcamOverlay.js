/**
 * Picture-in-picture webcam overlay with skeleton drawing.
 */
export class WebcamOverlay {
  /**
   * @param {HTMLVideoElement} video
   */
  constructor(video) {
    this.video = video;

    // Container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 200px;
      height: 150px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 8px;
      overflow: hidden;
      z-index: 200;
    `;
    document.body.appendChild(this.container);

    // Canvas for skeleton overlay
    this.canvas = document.createElement('canvas');
    this.canvas.width = 200;
    this.canvas.height = 150;
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;
    this.container.appendChild(this.canvas);

    // Video element (mirrored)
    if (video) {
      const vid = video.cloneNode();
      vid.srcObject = video.srcObject;
      vid.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform: scaleX(-1);
      `;
      vid.play();
      this.container.insertBefore(vid, this.canvas);
    }

    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Draw skeleton from landmarks.
   * @param {Array|null} landmarks - 33 MediaPipe landmarks
   */
  drawSkeleton(landmarks) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!landmarks) return;

    // Connections for arms and torso
    const connections = [
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 12],           // shoulders
      [11, 23], [12, 24], // torso
      [23, 24],           // hips
    ];

    // Draw connections
    ctx.strokeStyle = 'rgba(0, 255, 128, 0.8)';
    ctx.lineWidth = 2;
    for (const [a, b] of connections) {
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb) continue;
      // Mirror X for selfie view
      ctx.beginPath();
      ctx.moveTo((1 - la.x) * w, la.y * h);
      ctx.lineTo((1 - lb.x) * w, lb.y * h);
      ctx.stroke();
    }

    // Draw keypoints (shoulders, elbows, wrists)
    const keypoints = [11, 12, 13, 14, 15, 16];
    ctx.fillStyle = 'rgba(255, 100, 50, 0.9)';
    for (const idx of keypoints) {
      const lm = landmarks[idx];
      if (!lm) continue;
      ctx.beginPath();
      ctx.arc((1 - lm.x) * w, lm.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  show() { this.container.style.display = 'block'; }
  hide() { this.container.style.display = 'none'; }
}
