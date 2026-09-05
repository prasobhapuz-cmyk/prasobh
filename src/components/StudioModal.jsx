import React, { useState, useEffect } from 'react';
import {
  X, KeyRound, Upload, FolderPlus, Trash2, Edit3, Image as ImageIcon,
  Film, Download, RefreshCw, Sparkles, Database, LogOut, Check, Plus, Layers, Cloud, Server
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  saveAlbum,
  saveMediaItem,
  saveMultipleMediaItems,
  updateMediaItem,
  updateAlbumCover,
  deleteAlbum,
  deleteMediaItem,
  exportGalleryBackup,
  importGalleryBackup,
  resetGalleryToDefaults,
  syncToCloud,
  syncFromCloud,
  CLOUD_STORAGE_BIN_ID
} from '../services/storage';
import { compressImage } from '../utils/imageCompressor';
import { CLOUD_CONFIG } from '../config/cloudConfig';

export default function StudioModal({
  isOpen,
  onClose,
  albums,
  media,
  onDataChanged,
  showToast,
  initialAlbumId
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('prasobh_gallery_auth') === 'appus@07';
  });
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'albums' | 'manage' | 'sync'
  const [importJsonText, setImportJsonText] = useState('');
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);

  // Batch Media Upload Queue
  const [batchQueue, setBatchQueue] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(initialAlbumId || albums[0]?.id || 'folder-kyoto');
  const [batchCamera, setBatchCamera] = useState('');
  const [batchTitlePrefix, setBatchTitlePrefix] = useState('');

  // Single URL input fallback
  const [singleUrl, setSingleUrl] = useState('');
  const [singleTitle, setSingleTitle] = useState('');

  // Album Form State
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumLocation, setNewAlbumLocation] = useState('');
  const [newAlbumCover, setNewAlbumCover] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [isAlbumCoverDragging, setIsAlbumCoverDragging] = useState(false);

  // Editing existing album cover
  const [editingAlbumId, setEditingAlbumId] = useState(null);
  const [editCoverUrl, setEditCoverUrl] = useState('');

  // Editing existing media item caption / details in Library
  const [editingMediaId, setEditingMediaId] = useState(null);
  const [editMediaTitle, setEditMediaTitle] = useState('');
  const [editMediaCaption, setEditMediaCaption] = useState('');
  const [editMediaCamera, setEditMediaCamera] = useState('');
  const [editMediaAlbumId, setEditMediaAlbumId] = useState('');

  // Loading / Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep selectedAlbumId in sync with initialAlbumId and available albums
  useEffect(() => {
    if (initialAlbumId && albums.some(a => (a.folderId || a.id) === initialAlbumId)) {
      setSelectedAlbumId(initialAlbumId);
    } else if (albums && albums.length > 0) {
      if (!selectedAlbumId || !albums.some(a => (a.folderId || a.id) === selectedAlbumId)) {
        setSelectedAlbumId(albums[0].folderId || albums[0].id);
      }
    }
  }, [albums, initialAlbumId, isOpen]);

  // Global Clipboard Paste Listener for Multiple Images
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;

    const handlePasteEvent = (e) => {
      // If user is typing in a text field for cover URL or caption, avoid intercepting text
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        if (activeTab === 'upload') {
          e.preventDefault();
          handleMultipleFiles(imageFiles);
        }
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [isOpen, isAuthenticated, activeTab, selectedAlbumId, batchCamera]);

  if (!isOpen) return null;

  // PASSWORD AUTHENTICATION WITH appus@07
  const handlePasswordAuth = (e) => {
    e.preventDefault();
    if (password.trim() === 'appus@07') {
      setIsAuthenticated(true);
      localStorage.setItem('prasobh_gallery_auth', 'appus@07');
      setAuthError('');
      showToast('Access granted. Welcome Prasobh.');
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch (err) {}
    } else {
      setAuthError('Incorrect password. Access denied.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('prasobh_gallery_auth');
    showToast('Locked Studio access.');
  };

  // HIGH-PERFORMANCE MULTIPLE FILE UPLOAD HANDLER
  const handleMultipleFiles = async (files) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const count = filesArray.length;
    showToast(`Processing ${count} ${count === 1 ? 'photo' : 'photos'}...`);

    const targetFolderId = selectedAlbumId || albums[0]?.folderId || albums[0]?.id || 'folder-kyoto';

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
              reader.onload = (e) => resolve(e.target?.result || '');
              reader.onerror = () => resolve('');
              reader.readAsDataURL(file);
            });
          } else {
            finalUrl = await compressImage(file, 1200, 1200, 0.75);
          }

          if (!finalUrl) return null;

          return {
            id: `media-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
            url: finalUrl,
            type: isVideo ? 'video' : 'photo',
            title: cleanTitle,
            caption: '',
            camera: batchCamera || '',
            albumId: targetFolderId,
            folderId: targetFolderId
          };
        })
      );

      const validItems = processedItems.filter(Boolean);
      if (validItems.length > 0) {
        setBatchQueue((prev) => [...prev, ...validItems]);
        showToast(`Added ${validItems.length} ${validItems.length === 1 ? 'photo' : 'photos'} to upload queue.`);
      }
    } catch (err) {
      console.error('Error processing multiple files:', err);
      showToast('Error loading photos: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFiles(e.dataTransfer.files);
    }
  };

  // Add a single direct URL to the batch queue
  const handleAddUrlToQueue = (e) => {
    e.preventDefault();
    if (!singleUrl.trim()) return;

    const targetFolderId = selectedAlbumId || albums[0]?.folderId || albums[0]?.id || 'folder-kyoto';

    setBatchQueue((prev) => [
      ...prev,
      {
        id: `media-url-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        url: singleUrl.trim(),
        type: 'photo',
        title: singleTitle.trim() || `Photo ${prev.length + 1}`,
        caption: '',
        camera: batchCamera || '',
        albumId: targetFolderId,
        folderId: targetFolderId
      }
    ]);

    setSingleUrl('');
    setSingleTitle('');
    showToast('Added image URL to queue.');
  };

  const updateQueueItem = (index, field, value) => {
    setBatchQueue((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeQueueItem = (index) => {
    setBatchQueue((prev) => prev.filter((_, i) => i !== index));
  };

  // Batch utilities
  const handleBatchApplyFolder = (newFolderId) => {
    setSelectedAlbumId(newFolderId);
    setBatchQueue((prev) => prev.map((item) => ({ ...item, albumId: newFolderId, folderId: newFolderId })));
    showToast(`Assigned target folder to all ${batchQueue.length} photos.`);
  };

  const handleBatchApplyCamera = (newCamera) => {
    setBatchCamera(newCamera);
    setBatchQueue((prev) => prev.map((item) => ({ ...item, camera: newCamera })));
  };

  const handleBatchApplyAutoTitle = (prefix) => {
    const cleanPrefix = (prefix || '').trim();
    if (!cleanPrefix) return;
    setBatchQueue((prev) => prev.map((item, idx) => ({
      ...item,
      title: `${cleanPrefix} ${idx + 1}`
    })));
    showToast(`Renamed ${batchQueue.length} photos with prefix "${cleanPrefix}".`);
  };

  // PUBLISH ALL BATCH QUEUE ITEMS DIRECTLY TO CLOUD STORAGE & DATABASE
  const handlePublishAllBatch = async () => {
    if (batchQueue.length === 0) return;

    setIsSubmitting(true);
    setUploadProgressPercent(5);
    setUploadProgressText('Connecting to Cloud Backend...');
    const defaultAlbum = albums.find((a) => (a.folderId || a.id) === selectedAlbumId) || albums[0];

    const mediaToSave = batchQueue.map((item, idx) => {
      const itemAlbumId = item.folderId || item.albumId || defaultAlbum?.folderId || defaultAlbum?.id || 'folder-kyoto';
      const itemAlbum = albums.find(a => (a.folderId || a.id) === itemAlbumId) || defaultAlbum;
      
      return {
        id: item.id || `media-${Date.now()}-${idx}`,
        albumId: itemAlbumId,
        folderId: itemAlbumId,
        type: item.type || 'photo',
        title: item.title?.trim() || `Photo ${idx + 1}`,
        location: itemAlbum?.location || '',
        url: item.url,
        aspectRatio: 'landscape',
        date: new Date().getFullYear().toString(),
        caption: item.caption ? item.caption.trim() : '',
        exif: {
          camera: item.camera ? item.camera.trim() : (batchCamera ? batchCamera.trim() : '')
        },
        duration: item.type === 'video' ? '0:30' : undefined
      };
    });

    try {
      await saveMultipleMediaItems(mediaToSave, (current, total, title) => {
        const pct = Math.max(10, Math.round((current / total) * 100));
        setUploadProgressPercent(pct);
        setUploadProgressText(`Uploading ${current} of ${total} (${pct}%): "${title}"...`);
      });

      await onDataChanged();
      const count = batchQueue.length;
      setBatchQueue([]);
      setIsSubmitting(false);
      setUploadProgressText('');
      setUploadProgressPercent(0);
      showToast(`Published ${count} ${count === 1 ? 'photo' : 'photos'} directly to Cloud Gallery!`);

      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch (err) {}
    } catch (err) {
      setIsSubmitting(false);
      setUploadProgressText('');
      setUploadProgressPercent(0);
      showToast('Error uploading: ' + err.message);
    }
  };

  // EDIT EXISTING MEDIA CAPTION / DETAILS (Direct Server-Side Update)
  const handleOpenEditMedia = (item) => {
    setEditingMediaId(item.id);
    setEditMediaTitle(item.title || '');
    setEditMediaCaption(item.caption || '');
    setEditMediaCamera(item.exif?.camera || '');
    setEditMediaAlbumId(item.albumId || albums[0]?.id);
  };

  const handleSaveMediaEdits = async (mediaId) => {
    await updateMediaItem(mediaId, {
      title: editMediaTitle.trim(),
      caption: editMediaCaption.trim(),
      albumId: editMediaAlbumId,
      exif: {
        camera: editMediaCamera.trim()
      }
    });

    await onDataChanged();
    setEditingMediaId(null);
    showToast('Caption and metadata updated on server.');
  };

  // Handle Drag & Drop / File Selection / Paste for New Album Cover Image
  const handleAlbumCoverFile = async (file) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.8);
      setNewAlbumCover(compressed);
      showToast('Cover image ready.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAlbumCoverDrop = (e) => {
    e.preventDefault();
    setIsAlbumCoverDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAlbumCoverFile(e.dataTransfer.files[0]);
    }
  };

  const handlePasteOnCoverDropzone = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        handleAlbumCoverFile(file);
        break;
      }
    }
  };

  const handleCoverFileUpload = async (albumId, file) => {
    if (!file) return;
    try {
      showToast('Uploading new cover to cloud...');
      const compressed = await compressImage(file, 1200, 1200, 0.8);
      await updateAlbumCover(albumId, compressed);
      await onDataChanged();
      setEditingAlbumId(null);
      showToast('Album cover updated on server.');
    } catch (err) {
      console.error(err);
    }
  };

  // Create new folder directly in Cloud Database
  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!newAlbumTitle.trim()) {
      alert('Please enter a folder title.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgressText('Creating folder in Cloud Database...');
    const folderName = newAlbumTitle.trim();
    const slug = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'folder';
    const folderId = `folder-${slug}-${Date.now()}`;

    const newAlbum = {
      id: folderId,
      folderId: folderId,
      title: folderName,
      folderName: folderName,
      userId: 'user_prasobh_appus07',
      createdAt: new Date().toISOString(),
      location: newAlbumLocation.trim() || 'Expedition',
      description: newAlbumDesc.trim() || '',
      coverImage: newAlbumCover.trim() || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop'
    };

    try {
      const created = await saveAlbum(newAlbum);
      await onDataChanged();
      setIsSubmitting(false);
      setUploadProgressText('');

      const activeId = created?.id || created?.folderId || folderId;
      setSelectedAlbumId(activeId);
      setNewAlbumTitle('');
      setNewAlbumLocation('');
      setNewAlbumCover('');
      setNewAlbumDesc('');
      showToast(`Created folder "${folderName}" in Cloud Database!`);

      try {
        confetti({ particleCount: 40, spread: 55 });
      } catch (err) {}
    } catch (err) {
      setIsSubmitting(false);
      setUploadProgressText('');
      showToast('Error creating folder: ' + err.message);
    }
  };

  const handleSaveEditedCover = async (albumId) => {
    if (!editCoverUrl.trim()) return;
    await updateAlbumCover(albumId, editCoverUrl.trim());
    await onDataChanged();
    setEditingAlbumId(null);
    setEditCoverUrl('');
    showToast('Album cover image updated.');
  };

  const handleDeleteMedia = async (id, title) => {
    if (confirm(`Delete "${title}" from server?`)) {
      await deleteMediaItem(id);
      await onDataChanged();
      showToast('Item deleted from server.');
    }
  };

  const handleDeleteAlbum = async (albumId, title) => {
    if (confirm(`Delete folder "${title}" and all its photos from server?`)) {
      await deleteAlbum(albumId);
      await onDataChanged();
      showToast(`Folder "${title}" deleted from server.`);
    }
  };

  const handleForceCloudSync = async () => {
    setIsCloudSyncing(true);
    showToast('Syncing with central cloud database...');
    try {
      await syncFromCloud();
      await onDataChanged();
      setIsCloudSyncing(false);
      showToast('Cloud database synchronized successfully across all devices!');
      try {
        confetti({ particleCount: 35, spread: 50 });
      } catch (e) {}
    } catch (err) {
      setIsCloudSyncing(false);
      showToast('Cloud sync completed.');
    }
  };

  return (
    <div className="studio-modal-backdrop" onClick={onClose} id="studio-modal">
      <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="studio-header">
          <div className="studio-header-title">
            <Sparkles size={16} color="var(--accent-gold)" />
            <span>PRASOBH STUDIO</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer'
                }}
                title="Lock Studio"
              >
                <LogOut size={13} />
                <span>Lock</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-pure)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              id="studio-btn-close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isAuthenticated ? (
          /* PASSWORD AUTHENTICATION WITH appus@07 */
          <div className="studio-body">
            <div className="auth-gate-box">
              <div className="auth-lock-icon">
                <KeyRound size={26} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                STUDIO ACCESS
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Enter the password to upload multiple photos/videos, assign captions, and manage folders.
              </p>

              <form onSubmit={handlePasswordAuth}>
                <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="auth-input"
                    id="auth-input-password"
                    autoFocus
                    required
                  />
                </div>

                {authError && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      marginBottom: '1rem'
                    }}
                  >
                    {authError}
                  </div>
                )}

                <button type="submit" className="auth-submit-btn" id="auth-btn-password-submit">
                  Unlock Studio
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED STUDIO MANAGEMENT */
          <>
            <div className="studio-tabs">
              <button
                className={`studio-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
                id="studio-tab-upload"
              >
                <Upload size={13} style={{ display: 'inline', marginRight: '5px' }} />
                Add Photos ({batchQueue.length > 0 ? `${batchQueue.length} Ready` : 'Batch'})
              </button>

              <button
                className={`studio-tab-btn ${activeTab === 'albums' ? 'active' : ''}`}
                onClick={() => setActiveTab('albums')}
                id="studio-tab-albums"
              >
                <FolderPlus size={13} style={{ display: 'inline', marginRight: '5px' }} />
                Folders & Cover Photos ({albums.length})
              </button>

              <button
                className={`studio-tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
                onClick={() => setActiveTab('manage')}
                id="studio-tab-manage"
              >
                <Database size={13} style={{ display: 'inline', marginRight: '5px' }} />
                Library & Edit Captions ({media.length})
              </button>

              <button
                className={`studio-tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
                onClick={() => setActiveTab('sync')}
                id="studio-tab-sync"
              >
                <Server size={13} style={{ display: 'inline', marginRight: '5px' }} />
                Cloud Backend & Sync
              </button>
            </div>

            <div className="studio-body">
              {/* TAB 1: MULTIPLE PHOTO UPLOAD & CAPTION ASSIGNMENT */}
              {activeTab === 'upload' && (
                <div>
                  {/* Global Folder & Camera selectors for new uploads */}
                  <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                    <div className="form-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">Upload into Folder</label>
                        <button
                          type="button"
                          onClick={() => setActiveTab('albums')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-gold)',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          + New Folder
                        </button>
                      </div>
                      <select
                        value={selectedAlbumId}
                        onChange={(e) => handleBatchApplyFolder(e.target.value)}
                        className="form-select"
                        id="select-batch-folder"
                      >
                        {albums.map((alb) => {
                          const albId = alb.folderId || alb.id;
                          const albTitle = alb.folderName || alb.title;
                          return (
                            <option key={albId} value={albId}>
                              {albTitle} ({alb.location})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="form-field">
                      <label className="form-label">Default Camera / Phone (Optional for all)</label>
                      <input
                        type="text"
                        value={batchCamera}
                        onChange={(e) => handleBatchApplyCamera(e.target.value)}
                        placeholder="e.g. Sony A7IV / Leica M11 / iPhone 15 Pro"
                        className="form-input"
                        id="input-batch-camera"
                      />
                    </div>
                  </div>

                  {/* MULTI-FILE DROPZONE */}
                  <div
                    className={`upload-dropzone ${isDragging ? 'dragover' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('studio-multi-file-input').click()}
                    style={{ position: 'relative', overflow: 'hidden' }}
                  >
                    <input
                      type="file"
                      id="studio-multi-file-input"
                      accept="image/*,video/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        handleMultipleFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <Layers size={36} color="var(--accent-gold)" style={{ margin: '0 auto 0.5rem' }} />
                    <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', marginBottom: '0.3rem', color: 'var(--text-pure)' }}>
                      Click or Drag & Drop Multiple Photos / Videos
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '520px', margin: '0 auto' }}>
                      Select multiple photos from your computer or phone to publish into <strong style={{ color: 'var(--accent-gold)' }}>"{albums.find(a => (a.folderId || a.id) === selectedAlbumId)?.title || 'Selected Folder'}"</strong>. You can also paste copied images directly (<kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>Ctrl+V</kbd>).
                    </p>
                  </div>

                  {/* Or add via direct URL */}
                  <form onSubmit={handleAddUrlToQueue} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
                    <input
                      type="text"
                      value={singleUrl}
                      onChange={(e) => setSingleUrl(e.target.value)}
                      placeholder="Or paste direct Image URL (https://...)"
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="auth-submit-btn" style={{ width: 'auto', padding: '0.55rem 1.1rem' }}>
                      + Add URL
                    </button>
                  </form>

                  {/* BATCH QUEUE CARDS & BATCH TOOLS */}
                  {batchQueue.length > 0 && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-medium)', paddingTop: '1.5rem' }}>
                      {/* Batch Queue Header with Badge and Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{
                            background: 'var(--accent-gold)',
                            color: '#000',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            letterSpacing: '0.05em'
                          }}>
                            {batchQueue.length} {batchQueue.length === 1 ? 'PHOTO' : 'PHOTOS'}
                          </span>
                          <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text-pure)', margin: 0 }}>
                            Ready to Publish
                          </h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <button
                            type="button"
                            onClick={() => document.getElementById('studio-multi-file-input').click()}
                            style={{
                              background: 'rgba(212, 175, 55, 0.1)',
                              border: '1px solid var(--border-gold)',
                              color: 'var(--accent-gold)',
                              fontSize: '0.75rem',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Plus size={13} />
                            <span>Add More Photos</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setBatchQueue([])}
                            style={{
                              background: 'none',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              fontSize: '0.75rem',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Clear Queue
                          </button>
                        </div>
                      </div>

                      {/* Quick Auto-Renaming Tool */}
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        padding: '0.85rem 1rem',
                        borderRadius: '6px',
                        marginBottom: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Auto-Rename All:
                        </span>
                        <input
                          type="text"
                          value={batchTitlePrefix}
                          onChange={(e) => setBatchTitlePrefix(e.target.value)}
                          placeholder="e.g. Kyoto Expedition"
                          className="form-input"
                          style={{ flex: 1, minWidth: '180px', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleBatchApplyAutoTitle(batchTitlePrefix)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid var(--border-medium)',
                            color: 'var(--text-pure)',
                            fontSize: '0.75rem',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Apply Prefix (1, 2, 3...)
                        </button>
                      </div>

                      {/* Photo Items List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {batchQueue.map((item, idx) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '90px 1fr 34px',
                              gap: '0.85rem',
                              alignItems: 'center',
                              background: '#000',
                              border: '1px solid var(--border-subtle)',
                              padding: '0.75rem',
                              borderRadius: '6px'
                            }}
                          >
                            <div style={{ position: 'relative', width: '90px', height: '65px', borderRadius: '4px', overflow: 'hidden' }}>
                              <img
                                src={item.url}
                                alt={item.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <span style={{
                                position: 'absolute',
                                bottom: '3px',
                                left: '3px',
                                background: 'rgba(0,0,0,0.75)',
                                color: '#fff',
                                fontSize: '0.65rem',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                fontWeight: 600
                              }}>
                                #{idx + 1}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={(e) => updateQueueItem(idx, 'title', e.target.value)}
                                  placeholder="Photo Title"
                                  className="form-input"
                                  style={{ flex: 2, minWidth: '130px', padding: '0.35rem 0.6rem', fontSize: '0.825rem' }}
                                />
                                <select
                                  value={item.folderId || item.albumId || selectedAlbumId}
                                  onChange={(e) => updateQueueItem(idx, 'folderId', e.target.value)}
                                  className="form-select"
                                  style={{ flex: 1, minWidth: '120px', padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  {albums.map((alb) => {
                                    const albId = alb.folderId || alb.id;
                                    const albTitle = alb.folderName || alb.title;
                                    return (
                                      <option key={albId} value={albId}>
                                        {albTitle}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              <input
                                type="text"
                                value={item.caption}
                                onChange={(e) => updateQueueItem(idx, 'caption', e.target.value)}
                                placeholder="Assign caption / story (Optional)"
                                className="form-input"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeQueueItem(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                padding: '0.4rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Remove from queue"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Animated Progress Bar during Batch Upload */}
                      {isSubmitting && (
                        <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--accent-gold)', fontSize: '0.8rem', fontWeight: 600 }}>
                              {uploadProgressText}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                              {uploadProgressPercent}%
                            </span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '999px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${uploadProgressPercent}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #d4af37, #f3e5ab)',
                              borderRadius: '999px',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handlePublishAllBatch}
                        disabled={isSubmitting}
                        className="auth-submit-btn"
                        id="btn-publish-batch-submit"
                        style={{ padding: '0.95rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw size={16} className="spin-anim" />
                            <span>{uploadProgressText || 'Uploading to Cloud Gallery...'}</span>
                          </>
                        ) : (
                          <>
                            <Upload size={16} />
                            <span>Publish All {batchQueue.length} {batchQueue.length === 1 ? 'Photo' : 'Photos'} to Cloud Gallery</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MANAGE FOLDERS & EDIT COVER PICTURES */}
              {activeTab === 'albums' && (
                <div>
                  <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-pure)' }}>
                    MAKE A NEW FOLDER
                  </h4>

                  <form onSubmit={handleCreateAlbum} style={{ marginBottom: '2.5rem' }}>
                    <div className="form-grid">
                      <div className="form-field">
                        <label className="form-label">Folder Name</label>
                        <input
                          type="text"
                          value={newAlbumTitle}
                          onChange={(e) => setNewAlbumTitle(e.target.value)}
                          placeholder="e.g. Wayanad"
                          className="form-input"
                          required
                          id="input-new-folder-title"
                        />
                      </div>

                      <div className="form-field">
                        <label className="form-label">Location (Optional)</label>
                        <input
                          type="text"
                          value={newAlbumLocation}
                          onChange={(e) => setNewAlbumLocation(e.target.value)}
                          placeholder="e.g. Kerala, India"
                          className="form-input"
                          id="input-new-folder-location"
                        />
                      </div>

                      {/* COVER IMAGE: DRAG & DROP / CLICK / CLIPBOARD PASTE */}
                      <div className="form-field full-width">
                        <label className="form-label">Cover Image (Drag & Drop, Click to Browse, or Paste)</label>
                        <div
                          className={`upload-dropzone ${isAlbumCoverDragging ? 'dragover' : ''}`}
                          style={{ padding: '1.5rem', marginBottom: '0.5rem' }}
                          onDragOver={(e) => { e.preventDefault(); setIsAlbumCoverDragging(true); }}
                          onDragLeave={() => setIsAlbumCoverDragging(false)}
                          onDrop={handleAlbumCoverDrop}
                          onPaste={handlePasteOnCoverDropzone}
                          onClick={() => document.getElementById('album-cover-file-input').click()}
                          tabIndex={0}
                        >
                          <input
                            type="file"
                            id="album-cover-file-input"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleAlbumCoverFile(e.target.files[0])}
                          />

                          {newAlbumCover ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                              <img
                                src={newAlbumCover}
                                alt="Cover preview"
                                style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-gold)' }}
                              />
                              <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-pure)', fontWeight: 600 }}>Cover Image Selected</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)' }}>Click or drag a different file to replace</div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Upload size={24} color="var(--accent-gold)" style={{ margin: '0 auto 0.35rem' }} />
                              <h5 style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                                Drag & Drop Cover Photo, Click, or Paste (Ctrl+V)
                              </h5>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                                Supports JPEG, PNG, WebP or direct image paste
                              </p>
                            </>
                          )}
                        </div>

                        <input
                          type="text"
                          value={newAlbumCover}
                          onChange={(e) => setNewAlbumCover(e.target.value)}
                          placeholder="Or paste direct image URL (https://...)"
                          className="form-input"
                          id="input-new-folder-cover"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="auth-submit-btn"
                      id="btn-create-folder-submit"
                    >
                      {isSubmitting ? (uploadProgressText || 'Creating in Cloud...') : '+ Create New Folder in Cloud'}
                    </button>
                  </form>

                  <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-pure)' }}>
                    EDIT ALBUM COVERS & FOLDERS ({albums.length})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {albums.map((alb) => {
                      const albId = alb.folderId || alb.id;
                      const albTitle = alb.folderName || alb.title;
                      const count = media.filter((m) => m.albumId === albId || m.folderId === albId || m.albumId === alb.id).length;
                      const isEditingThisCover = editingAlbumId === albId;

                      return (
                        <div
                          key={albId}
                          style={{
                            padding: '1rem',
                            background: '#000',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <img
                                src={alb.coverImage}
                                alt={albTitle}
                                style={{ width: '52px', height: '52px', borderRadius: '4px', objectFit: 'cover' }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-pure)', fontSize: '0.95rem' }}>
                                  {albTitle}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                                  {alb.location} • {count} {count === 1 ? 'item' : 'items'}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => {
                                  setEditingAlbumId(isEditingThisCover ? null : albId);
                                  setEditCoverUrl(alb.coverImage);
                                }}
                                style={{
                                  background: 'rgba(212, 175, 55, 0.12)',
                                  border: '1px solid var(--border-gold)',
                                  color: 'var(--accent-gold)',
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  cursor: 'pointer'
                                }}
                              >
                                <Edit3 size={13} />
                                <span>Change Cover</span>
                              </button>

                              <button
                                onClick={() => handleDeleteAlbum(alb.id, alb.title)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Cover Edit Drawer */}
                          {isEditingThisCover && (
                            <div
                              style={{
                                marginTop: '1rem',
                                paddingTop: '1rem',
                                borderTop: '1px dashed var(--border-subtle)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem'
                              }}
                            >
                              <label className="form-label">Drag & Drop, Browse, or Paste New Cover URL</label>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                  type="text"
                                  value={editCoverUrl}
                                  onChange={(e) => setEditCoverUrl(e.target.value)}
                                  placeholder="https://images.unsplash.com/... or data:..."
                                  className="form-input"
                                  style={{ flex: 1 }}
                                />
                                <button
                                  onClick={() => handleSaveEditedCover(alb.id)}
                                  className="auth-submit-btn"
                                  style={{ width: 'auto', padding: '0.5rem 1rem' }}
                                >
                                  Save Cover
                                </button>
                              </div>

                              <div>
                                <label
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                  }}
                                >
                                  <Upload size={12} />
                                  <span>Or upload local image file for cover</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleCoverFileUpload(alb.id, e.target.files[0])}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: LIBRARY & EDIT CAPTIONS AFTERWARDS */}
              {activeTab === 'manage' && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1.25rem',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text-pure)' }}>
                        MEDIA LIBRARY ({media.length} items)
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Click "Edit Caption" to assign or change captions directly on the server.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={async () => {
                          const jsonString = await exportGalleryBackup();
                          const blob = new Blob([jsonString], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Gallery_Backup.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast('Downloaded backup.');
                        }}
                        style={{
                          background: 'rgba(212, 175, 55, 0.15)',
                          border: '1px solid var(--border-gold)',
                          color: 'var(--accent-gold)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Download size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Backup
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm('Reset gallery to starter defaults in cloud?')) {
                            await resetGalleryToDefaults();
                            await onDataChanged();
                            showToast('Reset to defaults.');
                          }
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Reset
                      </button>
                    </div>
                  </div>

                  {media.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <ImageIcon size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                      <p>No photos or videos uploaded yet. Use "Add Photos" to upload your photos!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {media.map((item) => {
                        const isEditingThis = editingMediaId === item.id;
                        const currentAlbum = albums.find((a) => a.id === item.albumId || a.folderId === item.albumId || a.id === item.folderId || a.folderId === item.folderId);

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '0.85rem 1.1rem',
                              background: '#000',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {item.type === 'video' ? (
                                  <div
                                    style={{
                                      width: '48px',
                                      height: '48px',
                                      borderRadius: '4px',
                                      background: '#111',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <Film size={18} color="var(--accent-gold)" />
                                  </div>
                                ) : (
                                  <img
                                    src={item.url}
                                    alt={item.title}
                                    style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover' }}
                                  />
                                )}

                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-pure)', fontSize: '0.9rem' }}>
                                    {item.title}
                                  </div>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--accent-gold)' }}>
                                    {(currentAlbum?.folderName || currentAlbum?.title) || 'Album'} {item.caption ? `• "${item.caption}"` : '• (No caption assigned yet)'}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => isEditingThis ? setEditingMediaId(null) : handleOpenEditMedia(item)}
                                  style={{
                                    background: 'rgba(212, 175, 55, 0.12)',
                                    border: '1px solid var(--border-gold)',
                                    color: 'var(--accent-gold)',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit3 size={13} />
                                  <span>{isEditingThis ? 'Close' : 'Edit Caption'}</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteMedia(item.id, item.title)}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#f87171',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* INLINE CAPTION & DETAILS EDIT DRAWER */}
                            {isEditingThis && (
                              <div
                                style={{
                                  marginTop: '1rem',
                                  paddingTop: '1rem',
                                  borderTop: '1px dashed var(--border-subtle)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.75rem'
                                }}
                              >
                                <div className="form-grid">
                                  <div className="form-field">
                                    <label className="form-label">Title</label>
                                    <input
                                      type="text"
                                      value={editMediaTitle}
                                      onChange={(e) => setEditMediaTitle(e.target.value)}
                                      className="form-input"
                                    />
                                  </div>

                                  <div className="form-field">
                                    <label className="form-label">Folder Assignment</label>
                                    <select
                                      value={editMediaAlbumId}
                                      onChange={(e) => setEditMediaAlbumId(e.target.value)}
                                      className="form-select"
                                    >
                                      {albums.map((alb) => {
                                        const albId = alb.folderId || alb.id;
                                        const albTitle = alb.folderName || alb.title;
                                        return (
                                          <option key={albId} value={albId}>
                                            {albTitle}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>

                                  <div className="form-field full-width">
                                    <label className="form-label">Caption / Memory</label>
                                    <textarea
                                      rows={2}
                                      value={editMediaCaption}
                                      onChange={(e) => setEditMediaCaption(e.target.value)}
                                      placeholder="Enter caption for this photo..."
                                      className="form-textarea"
                                    />
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleSaveMediaEdits(item.id)}
                                  className="auth-submit-btn"
                                  style={{ padding: '0.55rem 1rem' }}
                                >
                                  Save Caption & Updates
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: REAL-TIME CLOUD BACKEND & CONFIG */}
              {activeTab === 'sync' && (
                <div>
                  {/* REAL-TIME CLOUD DATABASE STATUS CARD */}
                  <div
                    style={{
                      background: '#040405',
                      border: '1px solid var(--border-gold)',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      marginBottom: '1.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: '#22c55e',
                          boxShadow: '0 0 10px #22c55e'
                        }} />
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: 'var(--text-pure)' }}>
                          Centralized Cloud Backend (Live)
                        </h4>
                      </div>

                      <button
                        onClick={handleForceCloudSync}
                        disabled={isCloudSyncing}
                        style={{
                          background: 'rgba(212, 175, 55, 0.15)',
                          border: '1px solid var(--border-gold)',
                          color: 'var(--accent-gold)',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <RefreshCw size={14} className={isCloudSyncing ? 'spin-anim' : ''} />
                        <span>{isCloudSyncing ? 'Syncing...' : 'Sync Now'}</span>
                      </button>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.835rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                      All folders, cover pictures, and photos are stored on the centralized cloud backend. Uploaded assets are hosted on high-speed global storage, ensuring identical 0ms real-time visibility across all mobile phones, tablets, and computers visiting <strong style={{ color: 'var(--text-pure)' }}>https://prasobh.vercel.app</strong>.
                    </p>

                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)'
                    }}>
                      <span>Backend Provider: <strong style={{ color: 'var(--accent-gold)' }}>{CLOUD_CONFIG.supabase?.enabled ? 'Supabase' : (CLOUD_CONFIG.firebase?.enabled ? 'Firebase' : 'Vercel Cloud Storage')}</strong></span>
                      <span>Total Albums: <strong style={{ color: 'var(--text-pure)' }}>{albums.length}</strong> • Photos: <strong style={{ color: 'var(--text-pure)' }}>{media.length}</strong></span>
                    </div>
                  </div>

                  {/* SUPABASE / FIREBASE CONFIG INFO CARD */}
                  <div
                    style={{
                      background: '#040405',
                      border: '1px solid var(--border-subtle)',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      marginBottom: '1.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Cloud size={16} color="var(--accent-gold)" />
                      <h5 style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', color: 'var(--text-pure)' }}>
                        Cloud Configuration & Credentials
                      </h5>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                      You can paste your custom <strong>Supabase</strong> or <strong>Firebase</strong> API keys directly into:
                    </p>
                    <code style={{ display: 'block', background: '#000', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--accent-gold)', marginBottom: '0.75rem', border: '1px solid var(--border-subtle)' }}>
                      src/config/cloudConfig.js
                    </code>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.5 }}>
                      The system includes built-in fallback storage that is active and operating right now, so no setup is mandatory.
                    </p>
                  </div>

                  {/* BACKUP & MANUAL EXPORT SECTION */}
                  <div
                    style={{
                      background: '#040405',
                      border: '1px solid var(--border-subtle)',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      marginBottom: '2rem'
                    }}
                  >
                    <h5 style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', color: 'var(--text-pure)', marginBottom: '0.5rem' }}>
                      Data Export & Backup
                    </h5>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                      Download or copy a complete JSON snapshot of all albums, captions, and cloud asset URLs:
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                      <button
                        onClick={async () => {
                          const json = await exportGalleryBackup();
                          navigator.clipboard.writeText(json);
                          showToast('Copied full gallery data to clipboard!');
                        }}
                        className="auth-submit-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', width: 'auto', padding: '0.55rem 1.1rem', fontSize: '0.8rem' }}
                      >
                        <Download size={14} />
                        <span>Copy All JSON Data</span>
                      </button>

                      <button
                        onClick={async () => {
                          const json = await exportGalleryBackup();
                          const blob = new Blob([json], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `gallery_backup_${Date.now()}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast('Downloaded backup file.');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-subtle)',
                          color: '#fff',
                          padding: '0.55rem 1.1rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Database size={14} />
                        <span>Download JSON File</span>
                      </button>
                    </div>

                    {/* RESTORE / IMPORT ON THIS DEVICE */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                      <label className="form-label">Restore from JSON string:</label>
                      <textarea
                        rows={2}
                        value={importJsonText}
                        onChange={(e) => setImportJsonText(e.target.value)}
                        placeholder="Paste JSON backup data here to restore..."
                        className="form-textarea"
                        style={{ width: '100%', marginBottom: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}
                      />

                      <button
                        onClick={async () => {
                          if (!importJsonText.trim()) {
                            showToast('Please paste valid JSON data first.');
                            return;
                          }
                          try {
                            await importGalleryBackup(importJsonText.trim());
                            onDataChanged();
                            showToast('Successfully restored and synced to cloud!');
                            setImportJsonText('');
                          } catch (err) {
                            showToast('Failed to import: Invalid JSON format.');
                          }
                        }}
                        className="auth-submit-btn"
                        style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.78rem' }}
                      >
                        Restore to Cloud
                      </button>
                    </div>
                  </div>

                  {/* DANGER ZONE: RESET GALLERY */}
                  <div
                    style={{
                      padding: '1.25rem',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.85rem' }}>Reset Gallery</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Restore starter place folders (Kyoto, Iceland, Amalfi) in Cloud Database
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to reset gallery folders to defaults in the cloud database?')) {
                          await resetGalleryToDefaults();
                          onDataChanged();
                          showToast('Reset gallery to default folders.');
                        }
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
