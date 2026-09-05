import React, { useEffect, useRef, useState } from 'react';

const TOTAL_FRAMES = 72;
const BLEND_FRAMES = 16; // 16 frames of seamless cross-dissolve mix between end and beginning
const LOOP_PERIOD = TOTAL_FRAMES - BLEND_FRAMES; // 56 frames per loop cycle
const FPS = 16; // Slower, tranquil, cinematic cadence
const FRAME_INTERVAL = 1000 / FPS;

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

  // Continuous buttery smooth frame playback with seamless ending-to-beginning mix
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let animationFrameId;
    let lastTime = 0;
    let currentFrame = 0;

    const drawRotatedFrame = (img, alpha) => {
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
      ctx.globalAlpha = alpha;
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(Math.PI / 2); // Rotate horizontally (90 deg clockwise)
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    };

    const render = (time) => {
      if (!lastTime) lastTime = time;
      const elapsed = time - lastTime;

      if (elapsed >= FRAME_INTERVAL) {
        lastTime = time - (elapsed % FRAME_INTERVAL);
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

          // SEAMLESS CROSSFADE MIX:
          // When currentFrame is in [0, BLEND_FRAMES - 1], blend ending tail frames (56..71) with beginning head frames (0..15)
          if (currentFrame < BLEND_FRAMES) {
            const tailIndex = LOOP_PERIOD + currentFrame; // 56 to 71
            const headIndex = currentFrame; // 0 to 15
            const linearT = (currentFrame + 0.5) / BLEND_FRAMES;
            const t = linearT * linearT * (3 - 2 * linearT); // Smoothstep curve

            // Draw base ending frame, then blend in beginning frame on top
            drawRotatedFrame(images[tailIndex], 1);
            drawRotatedFrame(images[headIndex], t);
          } else {
            // Pure video frame
            drawRotatedFrame(images[currentFrame], 1);
          }

          currentFrame = (currentFrame + 1) % LOOP_PERIOD;
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
