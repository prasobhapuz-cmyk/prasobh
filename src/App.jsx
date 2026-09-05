import React, { useState, useEffect } from 'react';
import Lenis from 'lenis';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import AlbumsSection from './components/AlbumsSection';
import VideosSection from './components/VideosSection';
import AboutContactSection from './components/AboutContactSection';
import FolderDetailPage from './components/FolderDetailPage';
import LightboxModal from './components/LightboxModal';
import StudioModal from './components/StudioModal';
import { initializeStorage, getAlbums, getAllMedia, DEFAULT_ALBUMS } from './services/storage';

export default function App() {
  const [albums, setAlbums] = useState(DEFAULT_ALBUMS);
  const [media, setMedia] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [lightboxList, setLightboxList] = useState([]);
  const [studioOpen, setStudioOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // ULTRA BUTTERY SMOOTH INERTIA SCROLLING WITH OPTIMIZED LENIS PHYSICS
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6, // Longer, silkier deceleration
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.4,
      infinite: false
    });

    let animationFrameId;
    function raf(time) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, [activeFolder]);

  // Load initial data from IndexedDB
  const loadData = async () => {
    try {
      await initializeStorage();
      const loadedAlbums = await getAlbums();
      const loadedMedia = await getAllMedia();
      setAlbums(loadedAlbums);
      setMedia(loadedMedia);
    } catch (err) {
      console.error('Failed to load gallery data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toast Helper
  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Open item in Fullscreen Lightbox
  const handleOpenLightbox = (item, currentList) => {
    setLightboxItem(item);
    setLightboxList(currentList || media);
  };

  // Open Folder Detail Page
  const handleOpenFolder = (album) => {
    setActiveFolder(album);
  };

  // Back to Main Albums view
  const handleBackToAlbums = () => {
    setActiveFolder(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const videos = media.filter((m) => m.type === 'video');

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar
        onOpenStudio={() => setStudioOpen(true)}
        onBackToHome={handleBackToAlbums}
        isInsideFolder={!!activeFolder}
      />

      {/* VIEW 1: FOLDER DETAIL PAGE (When an album folder is clicked) */}
      {activeFolder ? (
        <FolderDetailPage
          album={activeFolder}
          media={media}
          onBack={handleBackToAlbums}
          onOpenMedia={handleOpenLightbox}
        />
      ) : (
        /* VIEW 2: MAIN HOME EXPERIENCE */
        <main>
          {/* Hero Section */}
          <HeroSection />

          {/* Dedicated Full Page Floating 'ALBUMS' Section & Zigzag Passing Folders */}
          <AlbumsSection
            albums={albums}
            media={media}
            onOpenFolder={handleOpenFolder}
          />

          {/* Motion Cinema Archive */}
          {videos.length > 0 && (
            <VideosSection
              videos={videos}
              onOpenVideoModal={(video) => handleOpenLightbox(video, videos)}
            />
          )}

          {/* About Me & Contact Section */}
          <AboutContactSection
            onOpenStudio={() => setStudioOpen(true)}
            showToast={showToast}
          />
        </main>
      )}

      {/* Fullscreen Lightbox Modal */}
      <LightboxModal
        activeItem={lightboxItem}
        allItems={lightboxList}
        onClose={() => setLightboxItem(null)}
        onNavigate={(newItem) => setLightboxItem(newItem)}
        showToast={showToast}
      />

      {/* Studio CMS Password Protected Modal (appus@07) */}
      <StudioModal
        isOpen={studioOpen}
        onClose={() => setStudioOpen(false)}
        albums={albums}
        media={media}
        onDataChanged={loadData}
        showToast={showToast}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-msg">
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
