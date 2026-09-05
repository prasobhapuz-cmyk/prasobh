import React, { useState } from 'react';
import { Camera, MapPin, SlidersHorizontal, Image as ImageIcon, Search, Eye } from 'lucide-react';

export default function PhotosSection({ albums, photos, selectedAlbumId, onSelectAlbum, onOpenLightbox }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter photos by selected album and search query
  const filteredPhotos = photos.filter((photo) => {
    const matchesAlbum = selectedAlbumId === 'all' || photo.albumId === selectedAlbumId;
    const matchesSearch =
      searchQuery.trim() === '' ||
      photo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (photo.caption && photo.caption.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAlbum && matchesSearch;
  });

  return (
    <section className="photos-section" id="photos">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-tag">
            <Camera size={14} />
            <span>Still Frames & Architectural Studies</span>
          </div>
          <h2 className="section-title">PHOTOGRAPHY GALLERY</h2>
          <p className="section-description">
            High-resolution visual studies captured across changing weather, twilight gradients, and timeless horizons. Click any frame to inspect full EXIF metadata and high-res format.
          </p>
        </div>

        {/* Filter Bar & Search */}
        <div className="filter-bar">
          <button
            className={`filter-pill ${selectedAlbumId === 'all' ? 'active' : ''}`}
            onClick={() => onSelectAlbum('all')}
            id="filter-pill-all"
          >
            All Places ({photos.length})
          </button>

          {albums.map((album) => {
            const count = photos.filter((p) => p.albumId === album.id).length;
            return (
              <button
                key={album.id}
                className={`filter-pill ${selectedAlbumId === album.id ? 'active' : ''}`}
                onClick={() => onSelectAlbum(album.id)}
                id={`filter-pill-${album.id}`}
              >
                {album.location.split(',')[0]} ({count})
              </button>
            );
          })}
        </div>

        {/* Photos Grid */}
        {filteredPhotos.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '5rem 2rem',
              background: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px dashed var(--border-subtle)'
            }}
          >
            <ImageIcon size={40} color="var(--accent-gold)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              No Frames Found in this Selection
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Upload new images for this folder using the Studio Portal or select "All Places".
            </p>
          </div>
        ) : (
          <div className="photos-masonry">
            {filteredPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="photo-card"
                onClick={() => onOpenLightbox(photo, filteredPhotos)}
                id={`photo-card-${photo.id}`}
              >
                <div className={`photo-card-img-wrap ${photo.aspectRatio || 'landscape'}`}>
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="photo-card-img"
                    loading="lazy"
                  />

                  {/* Hover Overlay */}
                  <div className="photo-card-info-overlay">
                    <div className="photo-card-location">
                      <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {photo.location}
                    </div>
                    <h4 className="photo-card-title">{photo.title}</h4>
                    
                    {photo.exif && (
                      <div className="photo-card-exif-pill">
                        <Camera size={11} color="var(--accent-gold)" />
                        <span>
                          {photo.exif.camera || 'Leica'} • {photo.exif.lens || photo.exif.focalLength || 'Fine Art'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
