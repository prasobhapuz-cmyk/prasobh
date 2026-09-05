import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, MapPin, Play, Plus, Upload, Sparkles, RefreshCw, Check, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';
import { compressImage } from '../utils/imageCompressor';
import { saveMultipleMediaItems } from '../services/storage';

export default function FolderDetailPage({ album, media, onBack, onOpenMedia, onOpenStudio, onDataChanged, showToast }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [directProgressText, setDirectProgressText] = useState('');
  const [directProgressPercent, setDirectProgressPercent] = useState(0);
  const fileInputRef = useRef(null);

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
  const folderMedia = (media || []).filter((m) => {
    return (
      (m.albumId && (m.albumId === albumId || m.albumId === album.id || m.albumId === album.folderId)) ||
      (m.folderId && (m.folderId === albumId || m.folderId === album.id || m.folderId === album.folderId))
    );
  });

  // Direct Multiple Photos Picker Handler
  const handleTriggerFilePicker = () => {
    const isAuth = localStorage.getItem('prasobh_gallery_auth') === 'appus@07';
    if (!isAuth) {
      if (onOpenStudio) onOpenStudio(albumId);
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDirectFilesSelected = async (eOrFiles) => {
    let files = null;
    if (eOrFiles && eOrFiles.target && eOrFiles.target.files) {
      files = eOrFiles.target.files;
    } else if (eOrFiles && (eOrFiles.length || eOrFiles instanceof FileList || Array.isArray(eOrFiles))) {
      files = eOrFiles;
    }

    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const count = filesArray.length;
    setIsDirectUploading(true);
    setDirectProgressPercent(5);
    setDirectProgressText(`Processing ${count} ${count === 1 ? 'photo' : 'photos'}...`);
    if (showToast) showToast(`Processing ${count} ${count === 1 ? 'photo' : 'photos'} for ${albumTitle}...`);

    try {
      const processedItems = await Promise.all(
        filesArray.map(async (file, index) => {
          const isVideo = file.type && file.type.startsWith('video');
          const nameWithoutExt = file.name ? file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : '';
          const cleanTitle = nameWithoutExt ? (nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1)) : `Photo ${index + 1}`;

          let finalUrl = '';
          if (isVideo) {
            finalUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target?.result || '');
              reader.onerror = () => resolve('');
              reader.readAsDataURL(file);
            });
          } else {
            finalUrl = await compressImage(file, 1200, 1200, 0.75);
          }

          if (!finalUrl) return null;

          return {
            id: `media-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
            mediaId: `media-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
            url: finalUrl,
            type: isVideo ? 'video' : 'photo',
            title: cleanTitle,
            caption: '',
            location: album.location || '',
            albumId: albumId,
            folderId: albumId,
            aspectRatio: 'landscape',
            createdAt: new Date().toISOString()
          };
        })
      );

      const validItems = processedItems.filter(Boolean);
      if (validItems.length === 0) {
        setIsDirectUploading(false);
        return;
      }

      setDirectProgressText(`Uploading ${validItems.length} photos to Cloud Storage...`);
      await saveMultipleMediaItems(validItems, (current, total, title) => {
        const pct = Math.max(10, Math.round((current / total) * 100));
        setDirectProgressPercent(pct);
        setDirectProgressText(`Uploading ${current} of ${total} (${pct}%): "${title}"...`);
      });

      if (onDataChanged) {
        await onDataChanged();
      }

      setIsDirectUploading(false);
      setDirectProgressText('');
      setDirectProgressPercent(0);
      if (showToast) showToast(`Added ${validItems.length} photos to "${albumTitle}"!`);

      try {
        confetti({ particleCount: 65, spread: 75, origin: { y: 0.6 } });
      } catch (err) {}
    } catch (err) {
      console.error('Direct upload error:', err);
      setIsDirectUploading(false);
      setDirectProgressText('');
      setDirectProgressPercent(0);
      if (showToast) showToast('Error uploading: ' + err.message);
    } finally {
      if (eOrFiles && eOrFiles.target) eOrFiles.target.value = '';
    }
  };

  return (
    <div
      className={`folder-detail-page ${isDragOver ? 'page-dragover' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleDirectFilesSelected(e.dataTransfer.files);
        }
      }}
    >
      {/* Hidden Multiple Files Input for Instant 1-Click Multi-Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        multiple={true}
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleDirectFilesSelected}
      />

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

          <button
            onClick={handleTriggerFilePicker}
            className="btn-folder-add-photos"
            id="btn-folder-add-photos"
            title="Select & Add Multiple Photos to this Folder"
          >
            <Plus size={14} />
            <span>+ Add Multiple Photos</span>
          </button>
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
              Select multiple high clarity photos or videos from your computer or phone.
            </p>
            <button
              onClick={handleTriggerFilePicker}
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
              <Layers size={16} />
              <span>+ Select Multiple Photos for {albumTitle}</span>
            </button>
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
            <div style={{ textAlign: 'center', margin: '4rem 0 2rem' }}>
              <button
                onClick={handleTriggerFilePicker}
                className="btn-folder-add-more"
                id="btn-folder-add-more"
              >
                <Plus size={15} />
                <span>+ Add More Photos to {albumTitle}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Floating Real-Time Batch Upload Progress Overlay */}
      {isDirectUploading && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: '#0a0a0d',
          border: '1px solid var(--border-gold)',
          borderRadius: '10px',
          padding: '1rem 1.5rem',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9)',
          minWidth: '320px',
          maxWidth: '90vw'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <span style={{ color: 'var(--accent-gold)', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <RefreshCw size={14} className="spin-anim" />
              <span>{directProgressText}</span>
            </span>
            <span style={{ color: '#fff', fontSize: '0.825rem', fontWeight: 700 }}>
              {directProgressPercent}%
            </span>
          </div>
          <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${directProgressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #d4af37, #f3e5ab)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}
    </div>
  );
}
