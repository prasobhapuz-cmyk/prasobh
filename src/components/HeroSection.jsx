import React, { useEffect, useRef, useState } from 'react';

const TOTAL_FRAMES = 72; // 0 to 71
const BASE_FPS = 16;
const FRAME_INTERVAL = 1000 / BASE_FPS;

export default function HeroSection() {
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const [loadedCount, setLoadedCount] = useState(0);

  // Preload all 72 frames in highest quality
  useEffect(() => {
    const loadedImages = [];
    let count = 0;

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      const frameNumber = String(i).padStart(3, '0');
      img.src = `/hero_video_frames/rotate_this_video_horizontally_${frameNumber}.jpg`;
      img.onload = () => {
        count++;
        setLoadedCount(count);
      };
      loadedImages.push(img);
    }

    imagesRef.current = loadedImages;

    return () => {
      imagesRef.current = [];
    };
  }, []);

  // Continuous seamless loop that looks like an uninterrupted single live video
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let animationFrameId;
    let lastTime = 0;
    let currentFrame = 0;
    let direction = 1; // 1 = forward, -1 = reverse
    let pauseCounter = 0;

    const drawRotatedFrame = (img) => {
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      // When rotated 90 deg clockwise, image height corresponds to canvas width, and image width to canvas height
      const scale = Math.max(cw / ih, ch / iw);
      const drawW = iw * scale;
      const drawH = ih * scale;

      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(Math.PI / 2); // Rotate horizontally (90 deg clockwise)
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    };

    const render = (time) => {
      if (!lastTime) lastTime = time;
      const elapsed = time - lastTime;

      // Subtle dynamic deceleration near the turnaround endpoints for organic human motion
      const isNearEnd = currentFrame >= TOTAL_FRAMES - 4 || currentFrame <= 3;
      const dynamicInterval = isNearEnd ? FRAME_INTERVAL * 1.35 : FRAME_INTERVAL;

      if (elapsed >= dynamicInterval) {
        lastTime = time - (elapsed % dynamicInterval);
        const images = imagesRef.current;

        if (images.length === TOTAL_FRAMES) {
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = canvas.clientWidth;
          const displayHeight = canvas.clientHeight;

          if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw current frame with crisp 100% opacity (no ghosting or jump cuts)
          drawRotatedFrame(images[currentFrame]);

          // Handle organic turnaround at endpoints
          if (pauseCounter > 0) {
            pauseCounter--;
          } else {
            const nextFrame = currentFrame + direction;

            if (nextFrame >= TOTAL_FRAMES) {
              // Reached peak dial turn: pause for 2 frames, then seamlessly reverse
              direction = -1;
              currentFrame = TOTAL_FRAMES - 2;
              pauseCounter = 1;
            } else if (nextFrame < 0) {
              // Reached origin dial position: pause for 2 frames, then seamlessly advance forward
              direction = 1;
              currentFrame = 1;
              pauseCounter = 1;
            } else {
              currentFrame = nextFrame;
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <section className="hero-section" id="hero">
      {/* High-Performance Hardware-Accelerated Video Background Canvas */}
      <div className="hero-video-bg-wrap">
        <canvas ref={canvasRef} className="hero-video-canvas" />
        <div className="hero-video-vignette-overlay" />
      </div>

      {/* EXACT CENTRE BOLD TYPOGRAPHY */}
      <div className="hero-center-content">
        <h1 className="hero-main-title">
          THE GEOMETRY OF SILENCE
        </h1>
      </div>

      {/* TOWARDS BOTTOM RIGHT: FRAMED BY PRASOBH */}
      <div className="hero-bottom-right-signature">
        <div className="signature-name">FRAMED BY PRASOBH</div>
      </div>

      {/* Scroll Cue */}
      <a href="#albums" className="hero-scroll-indicator" aria-label="Scroll to albums">
        <div className="scroll-indicator-mouse">
          <span className="scroll-wheel-dot" />
        </div>
      </a>
    </section>
  );
}
