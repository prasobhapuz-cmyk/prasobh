import React, { useEffect, useState, useRef } from 'react';
import { MapPin, ArrowRight } from 'lucide-react';

export default function AlbumsSection({ albums, media, onOpenFolder }) {
  const [blurAmount, setBlurAmount] = useState(0);
  const [textOpacity, setTextOpacity] = useState(0.95);
  const [textScale, setTextScale] = useState(1);
  const [trackingAmount, setTrackingAmount] = useState(0.28);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const winHeight = window.innerHeight;

      // rect.top is the distance from top of viewport to the start of Albums section
      // 1. When rect.top >= 0: Approaching or just arrived at full-page ALBUMS (Crystal clear)
      // 2. While -rect.top is between 0 and winHeight * 0.3: Full-page ALBUMS stage in view (0px blur, full opacity)
      // 3. When -rect.top passes winHeight * 0.3: First folder begins entering, blur smoothly transitions from 0px to 10px
      // 4. Throughout the folders: Stays at 10px blur and ~0.18 opacity as a static backdrop
      // 5. Near the end of folders section: Gently fades out

      const scrolledInside = -rect.top;
      const blurStartThreshold = winHeight * 0.25; // Accurate threshold where folders approach
      const blurEndThreshold = winHeight * 0.75;   // Where blur reaches full backdrop depth

      if (scrolledInside <= blurStartThreshold) {
        // Stage 1: Crystal sharp and clear in exact center
        setBlurAmount(0);
        setTextOpacity(0.95);
        setTextScale(1);
        setTrackingAmount(0.28);
      } else if (scrolledInside < blurEndThreshold) {
        // Stage 2: Smooth, precise interpolation as first folder scrolls in
        const progress = (scrolledInside - blurStartThreshold) / (blurEndThreshold - blurStartThreshold);
        setBlurAmount(progress * 10);
        setTextOpacity(0.95 - progress * 0.77); // Transitions from 0.95 down to 0.18
        setTextScale(1 - progress * 0.08);
        setTrackingAmount(0.28 + progress * 0.15);
      } else {
        // Stage 3: Stable static blurred backdrop throughout the folders
        // Check if approaching the very end of albums section
        const totalHeight = rect.height;
        const remaining = totalHeight - (scrolledInside + winHeight);
        
        if (remaining < winHeight * 0.5 && remaining > 0) {
          const fadeOutProgress = 1 - (remaining / (winHeight * 0.5));
          setTextOpacity(Math.max(0, 0.18 * (1 - fadeOutProgress)));
        } else if (remaining <= 0) {
          setTextOpacity(0);
        } else {
          setTextOpacity(0.18);
        }

        setBlurAmount(10);
        setTextScale(0.92);
        setTrackingAmount(0.43);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial run
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const letters = ['A', 'L', 'B', 'U', 'M', 'S'];

  return (
    <section className="albums-master-wrapper" id="albums" ref={containerRef}>
      {/* FULL-PAGE STICKY BLURRED 'ALBUMS' TEXT IN EXACT CENTRE WITH ACCURATE TIMING */}
      <div className="album-fullpage-sticky-backdrop">
        <div
          className="album-center-floating-text"
          style={{
            filter: `blur(${blurAmount}px)`,
            opacity: textOpacity,
            transform: `scale(${textScale})`,
            letterSpacing: `${trackingAmount}em`
          }}
        >
          {letters.map((char, i) => (
            <span
              key={i}
              className="album-char"
              style={{
                animationDelay: `${i * 0.08}s`
              }}
            >
              {char}
            </span>
          ))}
        </div>
      </div>

      {/* FULL PAGE DEDICATED INTRO VIEWPORT FOR SHARP ALBUMS STAGE */}
      <div className="album-hero-spacer">
        <div className="album-scroll-cue">
          <span className="album-scroll-cue-line"></span>
        </div>
      </div>

      {/* ZIGZAG ALTERNATING FOLDERS (1st Top-Left, 2nd Right-Bottom, 3rd Left, 4th Right...) */}
      <div className="zigzag-folders-wrapper">
        {albums.map((album, index) => {
          const albumMedia = media.filter((m) => m.albumId === album.id);
          const isEven = index % 2 === 0;

          return (
            <div
              key={album.id}
              className={`zigzag-folder-card ${isEven ? 'pos-left' : 'pos-right'}`}
              onClick={() => onOpenFolder(album)}
              id={`folder-${album.id}`}
            >
              <div className="folder-image-frame">
                <img
                  src={album.coverImage}
                  alt={album.title}
                  className="folder-cover-img"
                  loading="lazy"
                />
                <div className="folder-gradient-overlay" />
              </div>

              <div className="folder-meta-overlay">
                <div className="folder-top-info">
                  <span className="folder-place-tag">
                    <MapPin size={11} />
                    {album.location}
                  </span>
                  <span className="folder-count-tag">
                    {albumMedia.length} {albumMedia.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="folder-bottom-info">
                  <h3 className="folder-card-heading">{album.title}</h3>
                  {album.description && (
                    <p className="folder-card-caption">{album.description}</p>
                  )}
                  <div className="folder-view-cue">
                    <span>Open Album</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
