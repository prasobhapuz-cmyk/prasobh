import React, { useState } from 'react';
import { Film, Play, Pause, Volume2, VolumeX, Maximize2, MapPin, Sparkles } from 'lucide-react';

export default function VideosSection({ videos, onOpenVideoModal }) {
  const [playingId, setPlayingId] = useState(null);
  const [mutedStates, setMutedStates] = useState({});

  const togglePlay = (id, e) => {
    e.stopPropagation();
    const videoEl = document.getElementById(`video-player-${id}`);
    if (!videoEl) return;

    if (videoEl.paused) {
      videoEl.play();
      setPlayingId(id);
    } else {
      videoEl.pause();
      setPlayingId(null);
    }
  };

  const toggleMute = (id, e) => {
    e.stopPropagation();
    const videoEl = document.getElementById(`video-player-${id}`);
    if (!videoEl) return;

    const newMuted = !videoEl.muted;
    videoEl.muted = newMuted;
    setMutedStates((prev) => ({ ...prev, [id]: newMuted }));
  };

  return (
    <section className="videos-section" id="videos">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-tag">
            <Film size={14} />
            <span>Cinematography & Motion Works</span>
          </div>
          <h2 className="section-title">THE MOTION ARCHIVE</h2>
          <p className="section-description">
            Fluid motion studies documenting the natural movement of wind, water, and ritual. Graded in custom film emulations and cinematic color profiles.
          </p>
        </div>

        {/* Videos Grid */}
        <div className="videos-grid">
          {videos.map((video) => {
            const isPlaying = playingId === video.id;
            const isMuted = mutedStates[video.id] !== false; // Default muted

            return (
              <div
                key={video.id}
                className="video-card"
                id={`video-card-${video.id}`}
                onClick={() => onOpenVideoModal(video)}
              >
                {/* Video Frame */}
                <div className="video-frame-container">
                  <video
                    id={`video-player-${video.id}`}
                    src={video.url}
                    poster={video.poster}
                    className="video-element"
                    loop
                    muted={isMuted}
                    playsInline
                    preload="metadata"
                  />

                  {/* Badges */}
                  {video.format && (
                    <span className="video-badge-format">{video.format}</span>
                  )}
                  {video.duration && (
                    <span className="video-badge-duration">{video.duration}</span>
                  )}

                  {/* Play/Pause Button Overlay */}
                  <div
                    className="video-overlay-play-btn"
                    onClick={(e) => togglePlay(video.id, e)}
                  >
                    <div className="play-circle">
                      {isPlaying ? (
                        <Pause size={24} fill="#000" />
                      ) : (
                        <Play size={24} fill="#000" style={{ marginLeft: '4px' }} />
                      )}
                    </div>
                  </div>

                  {/* Mute & Fullscreen quick controls */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '1rem',
                      left: '1rem',
                      display: 'flex',
                      gap: '0.5rem',
                      zIndex: 8
                    }}
                  >
                    <button
                      onClick={(e) => toggleMute(video.id, e)}
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* Video Info Details */}
                <div className="video-info-body">
                  <h3 className="video-title">{video.title}</h3>
                  <p className="video-caption">{video.caption}</p>

                  <div className="video-meta-bar">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-gold)' }}>
                      <MapPin size={13} />
                      {video.location}
                    </span>
                    <span>{video.date || 'Cinematic Study'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
