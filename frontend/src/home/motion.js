// Small, dependency-light motion helpers shared by the Home page sections.
// Every helper is defensive: if something fails, the page still renders normally.
import { useEffect } from 'react';
import Lenis from 'lenis';

// True when the visitor asked the OS for less motion.
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Smooth, inertial wheel scrolling with Lenis (Home page only).
// Lenis still uses the browser's native scroll position, so position: sticky,
// keyboard scrolling, the scrollbar and screen readers keep working.
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return undefined;
    let lenis;
    let frame = 0;
    try {
      lenis = new Lenis({ duration: 1.05, smoothWheel: true });
      const loop = (time) => { lenis.raf(time); frame = requestAnimationFrame(loop); };
      frame = requestAnimationFrame(loop);
    } catch {
      return undefined; // fall back to normal browser scrolling
    }
    return () => { cancelAnimationFrame(frame); lenis?.destroy(); };
  }, [enabled]);
}

// Reveal-on-enter: every element inside `rootRef` with a data-reveal attribute
// gets the class "is-in" the first time it enters the viewport. The hidden
// starting state only applies once the root has the class "motion-ready",
// so if this hook never runs, all content is simply visible.
export function useReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => observer.observe(el));
    root.classList.add('motion-ready');
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Scroll parallax: elements with data-parallax="0.12" move at a different speed
// from the text around them. The value is how far they drift per pixel scrolled.
export function useParallax(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return undefined;
    let frame = 0;
    const update = () => {
      const middle = window.innerHeight / 2;
      root.querySelectorAll('[data-parallax]').forEach((el) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return; // off screen
        const speed = Number(el.dataset.parallax) || 0;
        const offset = (rect.top + rect.height / 2 - middle) * speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      frame = 0;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [rootRef]);
}
