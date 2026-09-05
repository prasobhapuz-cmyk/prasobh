import React, { useState, useEffect } from 'react';
import { Camera, Lock, ArrowLeft } from 'lucide-react';

export default function Navbar({ onOpenStudio, onBackToHome, isInsideFolder }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-container">
        {/* Brand with Black & White Camera Icon */}
        <button
          onClick={onBackToHome}
          className="nav-logo"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          id="nav-brand-logo"
        >
          <div className="nav-logo-icon">
            <Camera size={16} stroke="#ffffff" />
          </div>
          <span>PRASOBH</span>
        </button>

        {/* Center Navigation Links */}
        {!isInsideFolder && (
          <nav>
            <ul className="nav-links">
              <li>
                <a href="#albums" className="nav-link">
                  Albums
                </a>
              </li>
              <li>
                <a href="#about" className="nav-link">
                  About
                </a>
              </li>
            </ul>
          </nav>
        )}

        {/* Actions (Studio Access / Back) */}
        <div className="nav-actions">
          {isInsideFolder && (
            <button
              onClick={onBackToHome}
              className="btn-studio"
              style={{ marginRight: '0.5rem' }}
            >
              <ArrowLeft size={13} />
              <span>Back to Albums</span>
            </button>
          )}

          <button
            onClick={onOpenStudio}
            className="btn-studio"
            id="btn-open-studio"
            title="Studio Access"
          >
            <Lock size={12} />
            <span>Studio Access</span>
          </button>
        </div>
      </div>
    </header>
  );
}
