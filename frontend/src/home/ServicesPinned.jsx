import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import DisplayText from '../DisplayText.jsx';
import FrameImage from './FrameImage.jsx';
import { clamp, prefersReducedMotion } from './motion.js';

// The three services as big editorial blocks.
// On wide screens the section is "pinned": it is several screens tall, and a
// position: sticky panel stays on screen while scroll progress cross-fades from
// one service to the next (image scales and slides, text fades and un-blurs).
// On small screens / reduced motion the blocks simply stack.

const HOLD = 0.24; // share of each step where a service stays put (0 = always moving)

const SERVICES = [
  { key: 'paintings', number: '01', title: ['One of one', 'paintings.'], copy: 'Madhubani, Warli, Tanjore, Pichwai and more, each painting is a single original. Buy it once and it is yours; it is marked sold for everyone else.', to: '/paintings', cta: 'Browse paintings', image: '/images/p-003.jpg', alt: 'Tanjore Lakshmi with gold leaf' },
  { key: 'walls', number: '02', title: ['Walls with', 'a story.'], copy: 'Pick a date between 7 and 90 days away, tell us the wall size and address, and we paint it at ₹150 per sq ft. Each date belongs to one wall only.', to: '/wall-painting', cta: 'Book a wall date', image: '/images/p-002.jpg', alt: 'Warli village scene' },
  { key: 'pottery', number: '03', title: ['Fired to', 'your order.'], copy: 'Choose a form, choose a glaze, tell us how many (1 to 12) and when you need them, at least 14 days out. Edit freely until we accept.', to: '/pottery', cta: 'Request pottery', image: null, alt: '' }
];

// Pottery panel visual: a big glazed pot (same drawing as the logo) and the live glaze/item list.
function PotteryVisual() {
  const [options, setOptions] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/pottery/options').then(setOptions).catch((err) => setError(err.message)); }, []);
  return <div className="pottery-visual">
    <img src="/logo-mark.svg" alt="" className="pottery-pot" />
    <div className="pottery-chips" aria-live="polite">
      {!options && !error && <span className="chip chip-muted"><i className="spinner" /> Loading glazes…</span>}
      {error && <span className="chip chip-error">Glazes could not load: {error}</span>}
      {options && !options.glazes.length && <span className="chip chip-muted">No glazes listed yet.</span>}
      {options?.glazes.map((glaze) => <span className="chip" key={glaze.id}>{glaze.name}</span>)}
      {options?.items.map((item) => <span className="chip chip-outline" key={item.id}>{item.name}</span>)}
    </div>
  </div>;
}

export default function ServicesPinned() {
  const sectionRef = useRef(null);
  const panelRefs = useRef([]);
  const dotRefs = useRef([]);
  const barRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    let frame = 0;
    // Remove all inline motion styles (used when the section is not pinned).
    const clear = () => panelRefs.current.forEach((panel) => {
      if (!panel) return;
      panel.style.visibility = ''; panel.style.pointerEvents = '';
      panel.querySelectorAll('[data-layer]').forEach((el) => { el.style.cssText = ''; });
    });

    const update = () => {
      frame = 0;
      const pinned = !prefersReducedMotion() && window.matchMedia('(min-width: 851px)').matches;
      section.classList.toggle('is-pinned', pinned);
      if (!pinned) { clear(); return; }
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;           // how far the sticky panel can move
      const progress = clamp(-rect.top / Math.max(travel, 1), 0, 1);
      const active = progress * (SERVICES.length - 1);           // 0 → first service … 2 → last
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress.toFixed(3)})`;
      panelRefs.current.forEach((panel, i) => {
        if (!panel) return;
        const raw = clamp(active - i, -1, 1);                     // -1 coming in, 0 centred, 1 leaving
        // HOLD keeps each service still and fully visible for a moment before it moves on
        const a = Math.max(0, Math.abs(raw) - HOLD) / (1 - HOLD);
        const t = Math.sign(raw) * a;
        const visible = clamp(1 - a * 1.7, 0, 1);
        panel.style.visibility = visible > 0.01 ? 'visible' : 'hidden';
        panel.style.pointerEvents = a < 0.5 ? 'auto' : 'none';
        const image = panel.querySelector('[data-layer="image"]');
        const text = panel.querySelector('[data-layer="text"]');
        if (image) {
          image.style.opacity = visible.toFixed(3);
          image.style.transform = `translate3d(0, ${(t * -14).toFixed(2)}vh, 0) scale(${(1 - a * 0.16).toFixed(3)}) rotate(${(t * -3).toFixed(2)}deg)`;
        }
        if (text) {
          text.style.opacity = visible.toFixed(3);
          text.style.transform = `translate3d(0, ${(t * -26).toFixed(2)}vh, 0)`; // text moves faster than the image (parallax)
          text.style.filter = `blur(${(a * 10).toFixed(1)}px)`;
        }
        dotRefs.current[i]?.classList.toggle('is-active', Math.round(active) === i);
      });
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
  }, []);

  return <section className="services-pin" ref={sectionRef} aria-label="What Rangrez makes">
    <div className="services-sticky">
      <div className="services-top">
        <span className="section-kicker">(What we make)</span>
        <div className="services-index" aria-hidden="true">
          {SERVICES.map((service, i) => <span key={service.key} ref={(el) => { dotRefs.current[i] = el; }}>{service.number}</span>)}
          <i className="services-bar"><b ref={barRef} /></i>
        </div>
      </div>
      {SERVICES.map((service, i) => <article className={`service-panel service-${service.key} ${i % 2 ? 'flip' : ''}`} key={service.key} ref={(el) => { panelRefs.current[i] = el; }}>
        <div className="service-visual" data-layer="image">
          {service.image ? <FrameImage src={service.image} alt={service.alt} label={service.alt} /> : <PotteryVisual />}
        </div>
        <div className="service-text" data-layer="text">
          <span className="service-num">{service.number} / 03</span>
          <DisplayText as="h3" lines={service.title} reveal={false} />
          <p>{service.copy}</p>
          <Link className="outline-pill" to={service.to}>{service.cta} <span>↗</span></Link>
        </div>
      </article>)}
    </div>
  </section>;
}
