import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DisplayText from '../DisplayText.jsx';
import FrameImage, { fillTo } from './FrameImage.jsx';
import { clamp, prefersReducedMotion } from './motion.js';

// Base speeds in pixels per second. Positive = moves right, negative = moves left.
const TOP_SPEED = 46;      // top trail: left → right
const BOTTOM_SPEED = -64;  // bottom trail: right → left
// How strongly page scrolling pushes the trails (scrolling up can briefly reverse them).
const SCROLL_PUSH = 1 / 450;

function Trail({ items, label, rowRef }) {
  // The list is rendered twice side by side; when one copy has fully passed,
  // we jump back by exactly one copy width, which is invisible (a seamless loop).
  return <div className="trail" ref={rowRef} aria-label={label}>
    <div className="trail-track">
      {[0, 1].map((copy) => items.map((painting, i) => <Link
        key={`${copy}-${i}`}
        to={painting.id ? `/paintings/${painting.id}` : '/paintings'}
        className="trail-card"
        tabIndex={copy === 0 ? 0 : -1}
        aria-hidden={copy === 1 ? 'true' : undefined}
        draggable="false"
      >
        <FrameImage src={painting.imageUrl} alt={copy === 0 ? painting.title : ''} label={painting.title} />
        <span>{painting.title}</span>
      </Link>))}
    </div>
  </div>;
}

export default function PaintingTrails({ paintings }) {
  const sectionRef = useRef(null);
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const top = fillTo(paintings, 10);
  const bottom = fillTo([...paintings].reverse(), 10);

  useEffect(() => {
    if (prefersReducedMotion() || !top.length) return undefined; // reduced motion: rows stay still (and can be scrolled sideways)
    const rows = [
      { el: topRef.current, base: TOP_SPEED, x: 0, factor: 1, hover: false },
      { el: bottomRef.current, base: BOTTOM_SPEED, x: 0, factor: 1, hover: false }
    ].filter((row) => row.el);
    const cleanups = rows.map((row) => {
      const enter = () => { row.hover = true; };
      const leave = () => { row.hover = false; };
      row.el.addEventListener('pointerenter', enter);
      row.el.addEventListener('pointerleave', leave);
      return () => { row.el.removeEventListener('pointerenter', enter); row.el.removeEventListener('pointerleave', leave); };
    });

    let onScreen = true;
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }) : null;
    if (sectionRef.current) observer?.observe(sectionRef.current);

    let lastY = window.scrollY;
    let push = 0; // smoothed scroll velocity, as a speed multiplier
    let last = performance.now();
    let frame = 0;
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // scroll-linked velocity: scrolling down speeds the trails up, scrolling up pushes them backwards
      const scrollVelocity = (window.scrollY - lastY) / Math.max(dt, 0.001);
      lastY = window.scrollY;
      push += (clamp(scrollVelocity * SCROLL_PUSH, -2.6, 4) - push) * Math.min(1, dt * 6);
      if (onScreen) {
        rows.forEach((row) => {
          const half = row.el.firstChild.scrollWidth / 2; // width of one copy
          row.factor += ((row.hover ? 0 : 1) - row.factor) * Math.min(1, dt * 6); // ease to a stop on hover
          row.x += row.base * (1 + push) * row.factor * dt;
          if (half > 0) row.x = ((row.x % half) - half) % half; // keep x inside (-half, 0]
          row.el.firstChild.style.transform = `translate3d(${row.x.toFixed(1)}px, 0, 0)`;
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); cleanups.forEach((fn) => fn()); };
  }, [top.length]);

  if (!top.length) return null;
  return <section className="trails-section" ref={sectionRef} aria-labelledby="trails-heading">
    <div className="trails-tilt">
      <Trail items={top} label="Paintings moving right" rowRef={topRef} />
      <div className="trails-heading" id="trails-heading">
        <span className="section-kicker" data-reveal>(The collection)</span>
        <DisplayText lines={['Colour that', 'travels.']} />
      </div>
      <Trail items={bottom} label="Paintings moving left" rowRef={bottomRef} />
    </div>
    <div className="trails-cta" data-reveal>
      <p>One of one, every time. When a painting finds its room, it is marked sold for good.</p>
      <Link className="outline-pill" to="/paintings">Browse Paintings <span>↗</span></Link>
    </div>
  </section>;
}
