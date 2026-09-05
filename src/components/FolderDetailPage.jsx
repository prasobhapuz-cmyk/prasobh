import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Play, Plus, Upload, Sparkles } from 'lucide-react';

export default function FolderDetailPage({ album, media, onBack, onOpenMedia, onOpenStudio }) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const progress = Math.min(scrollY / 300, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const albumId = album.folderId || album.id;
  const albumTitle = album.folderName || album.title;
  const folderMedia = media.filter((m) => m.albumId === albumId || m.folderId === albumId || m.albumId === album.id);

  return (
    <div className="folder-detail-page">
      {/* Top Fixed Header with Back Button & Quick Add Photos */}
      <div className="folder-detail-nav">
        <button onClick={onBack} className="btn-back-folders" id="btn-back-to-albums">
          <ArrowLeft size={16} />
          <span>Albums</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {album.location && (
            <div className="folder-nav-location">
              {album.location}
            </div>
          )}

          {onOpenStudio && (
            <button
              onClick={() => onOpenStudio(albumId)}
              className="btn-folder-add-photos"
              id="btn-folder-add-photos"
              title="Add Photos to this Folder"
            >
              <Plus size={14} />
              <span>Add Photos</span>
            </button>
          )}
        </div>
      </div>

      {/* STICKY BLURRED FOLDER TITLE AT TOP */}
      <div className="folder-detail-hero">
        <div
          className="folder-detail-title-wrap"
          style={{
            transform: `scale(${1 - scrollProgress * 0.1})`,
            filter: scrollProgress > 0.05 ? `blur(${scrollProgress * 10}px)` : 'blur(0px)',
            opacity: scrollProgress > 0.05 ? Math.max(0.2, 1 - scrollProgress * 0.6) : 1
          }}
        >
          <h1 className="folder-detail-title">{albumTitle}</h1>
          {album.description && (
            <p className="folder-detail-desc">{album.description}</p>
          )}
        </div>
      </div>

      {/* SEQUENTIAL HIGH-CLARITY MEDIA ITEMS */}
      <div className="folder-media-container">
        {folderMedia.length === 0 ? (
          <div className="folder-empty-state">
            <p className="folder-empty-text">No items uploaded to this album yet.</p>
            <p className="folder-empty-sub">
              Upload multiple high clarity photos and videos directly into this folder.
            </p>
            {onOpenStudio && (
              <button
                onClick={() => onOpenStudio(albumId)}
                className="auth-submit-btn"
                style={{
                  width: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.75rem',
                  marginTop: '1.25rem'
                }}
                id="btn-empty-add-photos"
              >
                <Plus size={16} />
                <span>+ Add Photos to {albumTitle}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="folder-media-grid">
              {folderMedia.map((item) => (
                <div
                  key={item.id}
                  className="folder-media-card"
                  onClick={() => onOpenMedia(item, folderMedia)}
                  id={`folder-item-${item.id}`}
                >
                  {item.type === 'video' ? (
                    <div className="folder-video-wrap">
                      <video
                        src={item.url}
                        className="folder-media-asset"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                      />
                      <div className="folder-video-play-indicator">
                        <Play size={20} fill="#fff" />
                      </div>
                    </div>
                  ) : (
                    <div className="folder-photo-wrap">
                      <img
                        src={item.url}
                        alt={item.title}
                        className="folder-media-asset"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {(item.caption || item.exif?.camera) && (
                    <div className="folder-media-caption-bar">
                      {item.exif?.camera && (
                        <div className="folder-media-meta">{item.exif.camera}</div>
                      )}
                      {item.caption && (
                        <div className="folder-media-note">{item.caption}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Add More Photos CTA */}
            {onOpenStudio && (
              <div style={{ textAlign: 'center', margin: '4rem 0 2rem' }}>
                <button
                  onClick={() => onOpenStudio(albumId)}
                  className="btn-folder-add-more"
                  id="btn-folder-add-more"
                >
                  <Plus size={15} />
                  <span>Add More Photos to {albumTitle}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
