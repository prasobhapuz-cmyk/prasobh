import React, { useState } from 'react';
import {
  X, KeyRound, Upload, FolderPlus, Trash2, Edit3, Image as ImageIcon,
  Film, Download, RefreshCw, Sparkles, Database, LogOut, Check, Plus, Layers
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
  resetGalleryToDefaults
} from '../services/storage';

export default function StudioModal({
  isOpen,
  onClose,
  albums,
  media,
  onDataChanged,
  showToast
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('prasobh_gallery_auth') === 'appus@07';
  });
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'albums' | 'manage'

  // Batch Media Upload Queue (Supports Multiple Files at Once!)
  const [batchQueue, setBatchQueue] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(albums[0]?.id || '');
  const [batchCamera, setBatchCamera] = useState('');

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

  // MULTIPLE FILE UPLOAD HANDLER (Adds multiple photos/videos to the batch queue)
  const handleMultipleFiles = (files) => {
    if (!files || files.length === 0) return;

    const newItems = [];
    const filesArray = Array.from(files);

    filesArray.forEach((file, index) => {
      const isVideo = file.type.startsWith('video');
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const cleanTitle = nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);

      const reader = new FileReader();
      reader.onload = (e) => {
        setBatchQueue((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}-${index}-${Math.random()}`,
            file,
            url: e.target.result,
            type: isVideo ? 'video' : 'photo',
            title: cleanTitle,
            caption: '', // Caption can be assigned now or afterwards!
            camera: batchCamera || '',
            albumId: selectedAlbumId || albums[0]?.id || 'folder-kyoto'
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    showToast(`Loaded ${filesArray.length} ${filesArray.length === 1 ? 'file' : 'files'} into queue.`);
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

    setBatchQueue((prev) => [
      ...prev,
      {
        id: `temp-url-${Date.now()}`,
        url: singleUrl.trim(),
        type: 'photo',
        title: singleTitle.trim() || 'Untitled Frame',
        caption: '',
        camera: batchCamera || '',
        albumId: selectedAlbumId || albums[0]?.id || 'folder-kyoto'
      }
    ]);

    setSingleUrl('');
    setSingleTitle('');
    showToast('Added image URL to queue.');
  };

  // Update caption or title for an item in the batch queue
  const updateQueueItem = (index, field, value) => {
    setBatchQueue((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Remove an item from the batch queue
  const removeQueueItem = (index) => {
    setBatchQueue((prev) => prev.filter((_, i) => i !== index));
  };

  // PUBLISH ALL BATCH QUEUE ITEMS TO GALLERY
  const handlePublishAllBatch = async () => {
    if (batchQueue.length === 0) return;

    setIsSubmitting(true);
    const targetAlbum = albums.find((a) => a.id === selectedAlbumId) || albums[0];

    const mediaToSave = batchQueue.map((item, idx) => ({
      id: `media-${Date.now()}-${idx}`,
      albumId: item.albumId || targetAlbum?.id || 'folder-kyoto',
      type: item.type,
      title: item.title.trim() || `Frame ${idx + 1}`,
      location: targetAlbum?.location || '',
      url: item.url,
      aspectRatio: 'landscape',
      date: new Date().getFullYear().toString(),
      caption: item.caption ? item.caption.trim() : '',
      exif: {
        camera: item.camera ? item.camera.trim() : (batchCamera ? batchCamera.trim() : '')
      },
      duration: item.type === 'video' ? '0:30' : undefined
    }));

    await saveMultipleMediaItems(mediaToSave);
    await onDataChanged();
    setIsSubmitting(false);

    const count = batchQueue.length;
    setBatchQueue([]);
    showToast(`Published ${count} ${count === 1 ? 'photo' : 'photos'} to "${targetAlbum?.title || 'Album'}".`);

    try {
      confetti({ particleCount: 50, spread: 65 });
    } catch (err) {}
  };

  // EDIT EXISTING MEDIA CAPTION / DETAILS (In Library Tab)
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
    showToast('Caption and details updated successfully.');
  };

  // Handle Drag & Drop / File Selection / Paste for New Album Cover Image
  const handleAlbumCoverFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setNewAlbumCover(e.target.result);
      showToast('Cover image loaded.');
    };
    reader.readAsDataURL(file);
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

  // Local file upload handling for Album Cover Editing
  const handleCoverFileUpload = (albumId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      await updateAlbumCover(albumId, e.target.result);
      await onDataChanged();
      setEditingAlbumId(null);
      showToast('Album cover updated.');
    };
    reader.readAsDataURL(file);
  };

  // Create new folder
  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!newAlbumTitle.trim()) {
      alert('Please enter a folder title.');
      return;
    }

    setIsSubmitting(true);
    const slug = newAlbumTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const albumId = `folder-${slug}-${Date.now()}`;

    const newAlbum = {
      id: albumId,
      title: newAlbumTitle.trim(),
      location: newAlbumLocation.trim() || 'Expedition',
      description: newAlbumDesc.trim() || '',
      coverImage: newAlbumCover.trim() || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop'
    };

    await saveAlbum(newAlbum);
    await onDataChanged();
    setIsSubmitting(false);

    setNewAlbumTitle('');
    setNewAlbumLocation('');
    setNewAlbumCover('');
    setNewAlbumDesc('');
    showToast(`Created folder "${newAlbum.title}"`);
  };

  // Update Cover from URL
  const handleSaveEditedCover = async (albumId) => {
    if (!editCoverUrl.trim()) return;
    await updateAlbumCover(albumId, editCoverUrl.trim());
    await onDataChanged();
    setEditingAlbumId(null);
    setEditCoverUrl('');
    showToast('Album cover image updated.');
  };

  // Delete media item
  const handleDeleteMedia = async (id, title) => {
    if (confirm(`Delete "${title}"?`)) {
      await deleteMediaItem(id);
      await onDataChanged();
      showToast('Item deleted.');
    }
  };

  // Delete folder
  const handleDeleteAlbum = async (albumId, title) => {
    if (confirm(`Delete folder "${title}" and its items?`)) {
      await deleteAlbum(albumId);
      await onDataChanged();
      showToast(`Folder "${title}" deleted.`);
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
            </div>

            <div className="studio-body">
              {/* TAB 1: MULTIPLE PHOTO UPLOAD & CAPTION ASSIGNMENT */}
              {activeTab === 'upload' && (
                <div>
                  {/* Global Folder & Camera selectors for this batch */}
                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div className="form-field">
                      <label className="form-label">Upload into Folder</label>
                      <select
                        value={selectedAlbumId}
                        onChange={(e) => setSelectedAlbumId(e.target.value)}
                        className="form-select"
                        id="select-batch-folder"
                      >
                        {albums.map((alb) => (
                          <option key={alb.id} value={alb.id}>
                            {alb.title} ({alb.location})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label className="form-label">Camera or Phone (Optional for all)</label>
                      <input
                        type="text"
                        value={batchCamera}
                        onChange={(e) => setBatchCamera(e.target.value)}
                        placeholder="e.g. Leica M11 / iPhone 15 Pro"
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* MULTI-FILE DROPZONE (SELECT OR DROP 1 OR 50 PHOTOS AT ONCE) */}
                  <div
                    className={`upload-dropzone ${isDragging ? 'dragover' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('studio-multi-file-input').click()}
                  >
                    <input
                      type="file"
                      id="studio-multi-file-input"
                      accept="image/*,video/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => handleMultipleFiles(e.target.files)}
                    />
                    <Layers size={32} color="var(--accent-gold)" style={{ margin: '0 auto 0.4rem' }} />
                    <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', marginBottom: '0.2rem' }}>
                      Click or Drag & Drop Multiple Photos / Videos
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      You can select multiple photos at once. Captions can be assigned below now or anytime afterwards!
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
                    <button type="submit" className="auth-submit-btn" style={{ width: 'auto', padding: '0.55rem 1rem' }}>
                      + Add URL
                    </button>
                  </form>

                  {/* BATCH QUEUE CARDS (ASSIGN CAPTION TO EACH PHOTO) */}
                  {batchQueue.length > 0 && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: 'var(--text-pure)' }}>
                          Photos Ready to Publish ({batchQueue.length})
                        </h4>
                        <button
                          onClick={() => setBatchQueue([])}
                          style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Clear Queue
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                        {batchQueue.map((item, idx) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '80px 1fr 32px',
                              gap: '1rem',
                              alignItems: 'start',
                              background: '#000',
                              border: '1px solid var(--border-subtle)',
                              padding: '0.85rem',
                              borderRadius: '6px'
                            }}
                          >
                            <img
                              src={item.url}
                              alt={item.title}
                              style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateQueueItem(idx, 'title', e.target.value)}
                                placeholder="Photo Title"
                                className="form-input"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.825rem' }}
                              />
                              <input
                                type="text"
                                value={item.caption}
                                onChange={(e) => updateQueueItem(idx, 'caption', e.target.value)}
                                placeholder="Assign caption (Optional — can be added afterwards)"
                                className="form-input"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                              />
                            </div>

                            <button
                              onClick={() => removeQueueItem(idx)}
                              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem' }}
                              title="Remove from queue"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handlePublishAllBatch}
                        disabled={isSubmitting}
                        className="auth-submit-btn"
                        id="btn-publish-batch-submit"
                        style={{ padding: '0.9rem', fontSize: '0.88rem' }}
                      >
                        {isSubmitting ? 'Saving to Archive...' : `Publish All ${batchQueue.length} ${batchQueue.length === 1 ? 'Photo' : 'Photos'} to Gallery`}
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

                      {/* COVER IMAGE: DRAG & DROP / CLICK / CLIPBOARD PASTE (Ctrl+V) */}
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
                      {isSubmitting ? 'Creating...' : '+ Create New Folder'}
                    </button>
                  </form>

                  <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-pure)' }}>
                    EDIT ALBUM COVERS & FOLDERS ({albums.length})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {albums.map((alb) => {
                      const count = media.filter((m) => m.albumId === alb.id).length;
                      const isEditingThisCover = editingAlbumId === alb.id;

                      return (
                        <div
                          key={alb.id}
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
                                alt={alb.title}
                                style={{ width: '52px', height: '52px', borderRadius: '4px', objectFit: 'cover' }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-pure)', fontSize: '0.95rem' }}>
                                  {alb.title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                                  {alb.location} • {count} {count === 1 ? 'item' : 'items'}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => {
                                  setEditingAlbumId(isEditingThisCover ? null : alb.id);
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
                        Click "Edit Caption" to assign or change captions afterwards.
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
                          if (confirm('Reset to defaults?')) {
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
                        const currentAlbum = albums.find((a) => a.id === item.albumId);

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
                                    {currentAlbum?.title || 'Album'} {item.caption ? `• "${item.caption}"` : '• (No caption assigned yet)'}
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
                                      {albums.map((alb) => (
                                        <option key={alb.id} value={alb.id}>
                                          {alb.title}
                                        </option>
                                      ))}
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
