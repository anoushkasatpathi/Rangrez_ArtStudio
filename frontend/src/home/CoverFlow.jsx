import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../api.js';
import FrameImage, { fillTo } from './FrameImage.jsx';
import { clamp, prefersReducedMotion } from './motion.js';

// ---- Tweak these ----
// Auto-scroll speed in cards per second. The old home rail moved about 0.26 cards/s,
// so 0.5 is roughly twice as fast. Raise it for a quicker row.
export const COVERFLOW_SPEED = 0.5;
const HOVER_SPEED = 0.18;   // speed multiplier while the pointer is over the row
const VISIBLE_RANGE = 3.6;  // cards further than this from the centre are hidden
// ----------------------

// Where a card sits for a given distance `d` from the centre (d = 0 is the focus card).
// Neighbours get smaller, dimmer, pushed back and turned towards the centre.
function cardStyle(d, cardWidth) {
  const a = Math.abs(d);
  const near = Math.min(a, 1);        // first step is wide…
  const far = Math.max(a - 1, 0);     // …then cards overlap more
  const x = Math.sign(d) * cardWidth * (0.92 * near + 0.6 * far);
  const rotate = clamp(-d * 24, -52, 52);
  const scale = 1 - Math.min(a, 3.5) * 0.11;
  const opacity = a > VISIBLE_RANGE ? 0 : clamp(VISIBLE_RANGE - a, 0, 1);
  return {
    transform: `translate3d(${x.toFixed(1)}px, 0, ${(-a * 110).toFixed(1)}px) rotateY(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
    opacity: opacity.toFixed(3),
    shade: (Math.min(a, 3) * 0.2).toFixed(3), // dark overlay: cheaper to animate than a CSS filter
    zIndex: String(100 - Math.round(a * 10))
  };
}

export default function CoverFlow({ paintings }) {
  const cards = fillTo(paintings, 8);           // the loop needs enough cards to wrap seamlessly
  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const state = useRef({ position: 0, inertia: 0, speedFactor: 1, hover: false, drag: null, snap: null, idleUntil: 0, moved: 0 });
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !cards.length) return undefined;
    const reduced = prefersReducedMotion();
    const s = state.current;
    let last = performance.now();
    let frame = 0;
    let onScreen = true;
    let focusIndex = -1;

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }) : null;
    observer?.observe(stage);

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (onScreen) {
        if (!s.drag) {
          if (s.snap !== null) {
            // moving to a card chosen with the arrow buttons/keys
            s.position += (s.snap - s.position) * Math.min(1, dt * 9);
            if (Math.abs(s.snap - s.position) < 0.002) { s.position = s.snap; s.snap = null; }
          } else {
            const auto = reduced || now < s.idleUntil ? 0 : COVERFLOW_SPEED;
            s.speedFactor += ((s.hover ? HOVER_SPEED : 1) - s.speedFactor) * Math.min(1, dt * 5);
            s.position += (auto * s.speedFactor + s.inertia) * dt;
            s.inertia *= Math.pow(0.04, dt); // inertia fades out over about a second
          }
        }
        const width = cardRefs.current[0]?.offsetWidth || 220;
        const n = cards.length;
        cardRefs.current.forEach((el, i) => {
          if (!el) return;
          let d = (((i - s.position) % n) + n) % n; // wrap so the row loops forever
          if (d > n / 2) d -= n;
          const style = cardStyle(d, width);
          el.style.transform = style.transform;
          el.style.opacity = style.opacity;
          el.style.zIndex = style.zIndex;
          el.style.setProperty('--shade', style.shade);
        });
        const nearest = ((Math.round(s.position) % n) + n) % n;
        if (nearest !== focusIndex) {
          cardRefs.current[focusIndex]?.classList.remove('is-focus');
          cardRefs.current[nearest]?.classList.add('is-focus');
          focusIndex = nearest;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [cards.length]);

  // ---- Interaction: drag / swipe, horizontal wheel, arrow keys ----
  const cardWidth = () => cardRefs.current[0]?.offsetWidth || 220;
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const s = state.current;
    s.drag = { x: event.clientX, start: s.position, lastX: event.clientX, lastT: performance.now(), v: 0 };
    s.moved = 0; s.snap = null; s.inertia = 0;
  };
  const onPointerMove = (event) => {
    const s = state.current;
    if (!s.drag) return;
    const dx = event.clientX - s.drag.x;
    s.moved = Math.max(s.moved, Math.abs(dx));
    if (s.moved > 6 && !event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.setPointerCapture?.(event.pointerId);
    s.position = s.drag.start - dx / (cardWidth() * 0.92);
    const now = performance.now();
    const dt = Math.max(now - s.drag.lastT, 1) / 1000;
    s.drag.v = -(event.clientX - s.drag.lastX) / (cardWidth() * 0.92) / dt;
    s.drag.lastX = event.clientX; s.drag.lastT = now;
    if (s.moved > 6) setHintVisible(false);
  };
  const onPointerUp = () => {
    const s = state.current;
    if (!s.drag) return;
    s.inertia = clamp(s.drag.v, -8, 8);   // fling
    s.idleUntil = performance.now() + 1200; // short rest before auto-scroll resumes
    s.drag = null;
  };
  const onWheel = (event) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return; // vertical wheel scrolls the page
    const s = state.current;
    s.snap = null;
    s.position += event.deltaX / (cardWidth() * 2.2);
    s.idleUntil = performance.now() + 1200;
    setHintVisible(false);
  };
  const step = (direction) => {
    const s = state.current;
    s.inertia = 0;
    s.snap = Math.round(s.snap ?? s.position) + direction;
    s.idleUntil = performance.now() + 2500;
  };
  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  };
  // A drag should not also count as a click on the card underneath.
  const onClickCapture = (event) => { if (state.current.moved > 6) { event.preventDefault(); event.stopPropagation(); } };

  if (!cards.length) return null;
  return <div className="coverflow" aria-roledescription="carousel" aria-label="Paintings">
    <div
      className="coverflow-stage"
      ref={stageRef}
      tabIndex={0}
      onPointerEnter={() => { state.current.hover = true; }}
      onPointerLeave={() => { state.current.hover = false; onPointerUp(); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      onClickCapture={onClickCapture}
      onDragStart={(event) => event.preventDefault()}
    >
      {cards.map((painting, i) => <Link
        key={`${painting.id || painting.imageUrl}-${i}`}
        ref={(el) => { cardRefs.current[i] = el; }}
        to={painting.id ? `/paintings/${painting.id}` : '/paintings'}
        className="flow-card"
        aria-label={`${painting.title}${painting.price ? `, ${formatMoney(painting.price)}` : ''}${painting.status ? `, ${painting.status}` : ''}`}
      >
        <FrameImage src={painting.imageUrl} alt="" label={painting.title} />
        {painting.status && <span className={`flow-badge flow-badge-${painting.status}`}>{painting.status === 'sold' ? 'Sold' : 'Available'}</span>}
        <span className="flow-meta">
          <strong>{painting.title}</strong>
          <span>{painting.artist || 'Rangrez studio'}{painting.price ? ` · ${formatMoney(painting.price)}` : ''}</span>
        </span>
      </Link>)}
    </div>
    <div className="coverflow-controls">
      <button type="button" onClick={() => step(-1)} aria-label="Previous painting">←</button>
      <span className={`drag-hint ${hintVisible ? '' : 'drag-hint-hidden'}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M9 3.5a1.5 1.5 0 0 1 3 0V10l.6-.1a1.5 1.5 0 0 1 2.9.4l.5-.1a1.5 1.5 0 0 1 2.8.6l.4-.1A1.5 1.5 0 0 1 21 12v4.5c0 3-2.4 5.5-5.4 5.5h-2.3a5.4 5.4 0 0 1-4.1-1.9l-4.4-5.2a1.5 1.5 0 0 1 2.2-2l2 2V3.5Z" /></svg>
        drag
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next painting">→</button>
    </div>
  </div>;
}
