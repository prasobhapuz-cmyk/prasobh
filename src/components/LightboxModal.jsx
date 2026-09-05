import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Camera, MapPin, Calendar, Download, Share2, Info } from 'lucide-react';

export default function LightboxModal({ activeItem, allItems, onClose, onNavigate, showToast }) {
  if (!activeItem) return null;

  const currentIndex = allItems.findIndex((item) => item.id === activeItem.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allItems.length - 1;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allItems[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allItems[currentIndex + 1]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, hasPrev, hasNext, allItems, onClose, onNavigate]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: activeItem.title,
        text: `Framed by Prasobh: ${activeItem.title} - ${activeItem.location}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Gallery link copied to clipboard');
    }
  };

  return (
    <div className="lightbox-backdrop" onClick={onClose} id="lightbox-modal">
      {/* Close Button */}
      <button
        className="lightbox-close-btn"
        onClick={onClose}
        aria-label="Close Lightbox"
        id="lightbox-btn-close"
      >
        <X size={20} />
      </button>

      {/* Nav Buttons */}
      {hasPrev && (
        <button
          className="lightbox-nav-btn prev"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(allItems[currentIndex - 1]);
          }}
          aria-label="Previous Frame"
          id="lightbox-btn-prev"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {hasNext && (
        <button
          className="lightbox-nav-btn next"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(allItems[currentIndex + 1]);
          }}
          aria-label="Next Frame"
          id="lightbox-btn-next"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Main Content */}
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {activeItem.type === 'video' ? (
          <video
            src={activeItem.url}
            controls
            autoPlay
            playsInline
            style={{
              maxWidth: '100%',
              maxHeight: '75vh',
              borderRadius: '6px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9)'
            }}
          />
        ) : (
          <img
            src={activeItem.url}
            alt={activeItem.title}
            className="lightbox-img"
          />
        )}

        {/* Caption & EXIF Details Drawer */}
        <div className="lightbox-caption-bar">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              color: 'var(--accent-gold)',
              fontSize: '0.8rem',
              letterSpacing: '0.1em',
              marginBottom: '0.35rem'
            }}
          >
            <MapPin size={13} />
            <span>{activeItem.location}</span>
            {activeItem.date && <span>• {activeItem.date}</span>}
          </div>

          {activeItem.title && !activeItem.title.startsWith('temp-') && (
            <h3 className="lightbox-title">{activeItem.title}</h3>
          )}
          {activeItem.caption && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 300, lineHeight: 1.5 }}>
              {activeItem.caption}
            </p>
          )}

          {/* EXIF Metadata Chips */}
          {activeItem.exif && (
            <div className="lightbox-exif-chips">
              {activeItem.exif.camera && (
                <div className="exif-chip">
                  <strong>Body:</strong> {activeItem.exif.camera}
                </div>
              )}
              {activeItem.exif.lens && (
                <div className="exif-chip">
                  <strong>Lens:</strong> {activeItem.exif.lens}
                </div>
              )}
              {activeItem.exif.aperture && (
                <div className="exif-chip">
                  <strong>Aperture:</strong> {activeItem.exif.aperture}
                </div>
              )}
              {activeItem.exif.shutterSpeed && (
                <div className="exif-chip">
                  <strong>Shutter:</strong> {activeItem.exif.shutterSpeed}
                </div>
              )}
              {activeItem.exif.iso && (
                <div className="exif-chip">
                  <strong>ISO:</strong> {activeItem.exif.iso}
                </div>
              )}
            </div>
          )}

          {/* Quick Action Tools */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              marginTop: '1.25rem'
            }}
          >
            <a
              href={activeItem.url}
              target="_blank"
              rel="noopener noreferrer"
              download={`${activeItem.title.replace(/\s+/g, '_')}.jpg`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.06)',
                padding: '0.4rem 0.9rem',
                borderRadius: '999px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <Download size={13} />
              <span>Full Resolution</span>
            </a>

            <button
              onClick={handleShare}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.06)',
                padding: '0.4rem 0.9rem',
                borderRadius: '999px',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer'
              }}
            >
              <Share2 size={13} />
              <span>Share Frame</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
