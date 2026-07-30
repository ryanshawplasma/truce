'use client';

import { useEffect, useRef } from 'react';
import { HEART_GLYPHS, prefersReducedMotion } from './ui';

/**
 * The hearts drifting up through the hero.
 * Spawned as plain DOM nodes (cheap), capped, and removed on animationend.
 * Nothing renders at all when the user prefers reduced motion.
 */
export default function FloatingHearts({ max = 12, every = 1500 }) {
  const layerRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const layer = layerRef.current;
    if (!layer) return undefined;

    const spawn = () => {
      if (document.hidden) return;
      if (layer.childElementCount >= max) return;

      const el = document.createElement('span');
      el.className = 'fheart';
      el.textContent = HEART_GLYPHS[Math.floor(Math.random() * HEART_GLYPHS.length)];
      el.style.left = `${Math.random() * 96}%`;
      el.style.fontSize = `${14 + Math.random() * 18}px`;
      el.style.setProperty('--dx', `${Math.random() * 90 - 45}px`);
      el.style.setProperty('--rot', `${Math.random() * 60 - 30}deg`);
      el.style.animationDuration = `${(9 + Math.random() * 7).toFixed(2)}s`;
      el.addEventListener('animationend', () => el.remove());
      layer.appendChild(el);
    };

    const starters = [0, 700, 1400, 2100].map((delay) => setTimeout(spawn, delay));
    const interval = setInterval(spawn, every);

    return () => {
      starters.forEach(clearTimeout);
      clearInterval(interval);
      layer.replaceChildren();
    };
  }, [max, every]);

  return <div className="heart-layer" ref={layerRef} aria-hidden="true" />;
}
