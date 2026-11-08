"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type AuthSlide = { src: string; alt: string; quote: string; detail: string; label: string };

export function AuthSlideshow({ slides }: { slides: AuthSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const active = slides[activeIndex];
  const change = (direction: number) => {
    if (slides.length < 2) return;
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <div className={`auth-visual ${active ? "auth-visual-photo" : "auth-visual-empty"}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((slide, index) => (
        <Image
          key={slide.src}
          className={`auth-visual-image ${index === activeIndex ? "auth-visual-image-active" : ""}`}
          src={slide.src}
          fill
          unoptimized
          sizes="(max-width: 900px) 100vw, 44vw"
          alt={slide.alt}
          aria-hidden={index !== activeIndex}
          priority={index === 0}
        />
      ))}
      <div className="auth-visual-wash" />
      <div className="auth-visual-content">
        <p className="auth-visual-kicker">HENKS MEDICAL LIMITED</p>
        <div className="auth-visual-copy" key={active?.src ?? "fallback"}>
          <p className="auth-slide-label">{active?.label ?? "CARE. CLARITY. CONFIDENCE."}</p>
          <h2>{active?.quote ?? "Care begins with seeing the whole picture."}</h2>
          <p>{active?.detail ?? "Every accurate result helps move compassionate care forward."}</p>
        </div>
        {slides.length > 1 ? (
          <div className="auth-slide-controls" aria-label="Healthcare team stories">
            <div className="auth-slide-dots">
              {slides.map((slide, index) => (
                <button key={slide.src} type="button" aria-label={`Show ${slide.label.toLowerCase()} story`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => setActiveIndex(index)} />
              ))}
            </div>
            <div className="auth-slide-arrows">
              <button type="button" aria-label="Previous story" onClick={() => change(-1)}>←</button>
              <button type="button" aria-label="Next story" onClick={() => change(1)}>→</button>
            </div>
          </div>
        ) : <p className="auth-visual-note">A trusted workspace for the people behind better care.</p>}
      </div>
    </div>
  );
}
