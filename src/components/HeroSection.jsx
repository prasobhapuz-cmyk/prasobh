import React, { useEffect, useRef, useState } from 'react';

const TOTAL_FRAMES = 72; // 0 to 71
const CYCLE_DURATION = 6.5; // 6.5 seconds per natural harmonic breathing cycle

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

  // Continuous seamless loop with harmonic physics & 60 FPS sub-frame interpolation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let animationFrameId;
    let startTime = null;

    const drawRotatedFrame = (img, alpha = 1) => {
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

    const render = (now) => {
      if (!startTime) startTime = now;
      const elapsedSeconds = (now - startTime) / 1000;
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

        // Continuous harmonic sine oscillation: position smoothly oscillates between frame 0.0 and 71.0
        // Continuous 1st and 2nd derivatives guarantee zero jerk, zero jump cuts, and imperceptible looping
        const phase = (elapsedSeconds % CYCLE_DURATION) / CYCLE_DURATION; // 0 to 1
        const harmonicPos = 0.5 * (1 - Math.cos(2 * Math.PI * phase)); // smooth 0 -> 1 -> 0
        const floatIndex = harmonicPos * (TOTAL_FRAMES - 1); // 0.0 to 71.0

        const baseIndex = Math.floor(floatIndex);
        const nextIndex = Math.min(TOTAL_FRAMES - 1, baseIndex + 1);
        const fraction = floatIndex - baseIndex;

        const imgA = images[baseIndex];
        const imgB = images[nextIndex];

        // Draw primary base frame
        drawRotatedFrame(imgA, 1);

        // Micro sub-frame interpolation between adjacent frames for 60 FPS silkiness
        if (fraction > 0.02 && baseIndex !== nextIndex) {
          drawRotatedFrame(imgB, fraction);
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
