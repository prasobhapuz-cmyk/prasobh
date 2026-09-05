import React, { useState } from 'react';
import { Mail, Copy, Check, ArrowUpRight, Sparkles, Send } from 'lucide-react';

const InstagramIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

export default function AboutContactSection({ onOpenStudio, showToast }) {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText('prasobhapuz@gmail.com');
    setCopiedEmail(true);
    showToast('Email address copied to clipboard: prasobhapuz@gmail.com');
    setTimeout(() => setCopiedEmail(false), 3000);
  };

  return (
    <section className="about-contact-section" id="about">
      <div className="section-container">
        {/* Artistic Photography Quote */}
        <div className="about-quote-container">
          <blockquote className="about-quote-text">
            Photography is the geometry of silence — the quiet intersection where transient light pauses and memory breathes.
          </blockquote>
          <cite className="about-quote-author">— Prasobh</cite>
        </div>

        {/* About & Contact Grid */}
        <div className="about-grid">
          {/* Left Column: About Prasobh */}
          <div className="about-text-column">
            <h3>ABOUT PRASOBH</h3>
            <p>
              I am a visual storyteller and fine art photographer dedicated to exploring the subtle harmonies between architectural precision and unrefined natural landscapes.
            </p>
            <p>
              To me, a camera is an instrument of reduction. In a chaotic world saturated with noise, I search for the geometric balance, the solitary line of light across stone, and the stillness that remains when everything else fades.
            </p>
          </div>

          {/* Right Column: Contact Cards */}
          <div className="contact-cards-container">
            {/* Email Card */}
            <a
              href="mailto:prasobhapuz@gmail.com"
              className="contact-card"
              id="contact-card-email"
              onClick={handleCopyEmail}
            >
              <div className="contact-card-left">
                <div className="contact-card-icon">
                  <Mail size={18} />
                </div>
                <div>
                  <div className="contact-card-type">Email</div>
                  <div className="contact-card-value">prasobhapuz@gmail.com</div>
                </div>
              </div>
              <div className="contact-card-action" title="Click to copy email">
                {copiedEmail ? <Check size={16} color="var(--accent-gold)" /> : <Copy size={16} />}
              </div>
            </a>

            {/* Instagram Card */}
            <a
              href="https://instagram.com/iprasobh"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-card"
              id="contact-card-instagram"
            >
              <div className="contact-card-left">
                <div className="contact-card-icon">
                  <InstagramIcon size={18} />
                </div>
                <div>
                  <div className="contact-card-type">Instagram</div>
                  <div className="contact-card-value">@iprasobh</div>
                </div>
              </div>
              <div className="contact-card-action">
                <ArrowUpRight size={18} />
              </div>
            </a>
          </div>
        </div>

        {/* Footer & Dedication Sentence at the very end */}
        <footer className="gallery-footer">
          <div className="footer-brand">THE GEOMETRY OF SILENCE</div>
          <div className="footer-divider-line" />
          <p className="footer-dedication">
            To every one who has supported me then and now
          </p>
          <div className="footer-copy">
            © {new Date().getFullYear()} Framed by Prasobh
          </div>
        </footer>
      </div>
    </section>
  );
}
