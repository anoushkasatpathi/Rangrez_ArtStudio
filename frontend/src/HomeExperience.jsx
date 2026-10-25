import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import DisplayText from './DisplayText.jsx';
import IntroHallway from './home/IntroHallway.jsx';
import CoverFlow from './home/CoverFlow.jsx';
import PaintingTrails from './home/PaintingTrails.jsx';
import ServicesPinned from './home/ServicesPinned.jsx';
import AboutCards from './home/AboutCards.jsx';
import { placeholderPaintings } from './home/FrameImage.jsx';
import { prefersReducedMotion, useParallax, useReveal, useSmoothScroll } from './home/motion.js';
import './home.css';

const INTRO_KEY = 'rangrez-intro-seen'; // sessionStorage flag: the intro plays once per browser session

// Thin ruler with tick marks that fills as the page scrolls.
function Timeline() {
  const ref = useRef(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      ref.current?.style.setProperty('--timeline-progress', `${(max > 0 ? window.scrollY / max : 0) * 100}%`);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => { window.removeEventListener('scroll', request); window.removeEventListener('resize', request); cancelAnimationFrame(frame); };
  }, []);
  return <div className="timeline" ref={ref} aria-hidden="true"><i className="timeline-dot" />{Array.from({ length: 31 }, (_, index) => <i className={index % 5 === 0 ? 'timeline-tick long' : 'timeline-tick'} key={index} />)}<i className="timeline-dot" /></div>;
}

// Hero row states: loading (skeleton cards), error (message + seed images), empty, ready.
function HeroRow({ status, paintings, error }) {
  if (status === 'loading') {
    return <div className="flow-state" role="status"><div className="flow-skeletons" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} />)}</div><p><i className="spinner" /> Loading the collection…</p></div>;
  }
  if (status === 'empty') {
    return <div className="flow-state"><p className="flow-message"><strong>No paintings on the wall yet.</strong> The studio is hanging new work. Check back soon.</p></div>;
  }
  return <>
    {status === 'error' && <p className="flow-message flow-error" role="alert"><strong>We could not reach the studio.</strong> {error} Showing studio images meanwhile.</p>}
    <CoverFlow paintings={paintings} />
  </>;
}

export default function HomeExperience() {
  const [data, setData] = useState({ status: 'loading', paintings: [], error: '' });
  const [intro, setIntro] = useState(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_KEY) === '1'; } catch { /* storage can be blocked; just play it */ }
    return !seen && !prefersReducedMotion();
  });
  const rootRef = useRef(null);
  const backdropRef = useRef(null);

  useSmoothScroll();
  useReveal(rootRef, [data.status]);
  useParallax(rootRef);

  useEffect(() => {
    api('/api/paintings')
      .then((result) => setData({ status: result.paintings.length ? 'ready' : 'empty', paintings: result.paintings, error: '' }))
      .catch((err) => setData({ status: 'error', paintings: placeholderPaintings, error: err.message }));
  }, []);

  const finishIntro = useCallback(() => {
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* best effort only */ }
    setIntro(false);
  }, []);

  // The big Hindi word drifts slightly with the pointer (kept from the earlier design).
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const move = (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 18;
      const y = (event.clientY / window.innerHeight - 0.5) * 12;
      if (backdropRef.current) backdropRef.current.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  const rowPaintings = data.paintings; // all paintings, each card shows a Sold/Available badge
  const trailPaintings = data.paintings.length ? data.paintings : placeholderPaintings;

  return <div className={`home-experience ${intro ? 'intro-playing' : 'intro-done'}`} ref={rootRef}>
    {intro && <IntroHallway onDone={finishIntro} />}

    {/* (a) Hero: headline + cover-flow row of paintings */}
    <section className="hero">
      <div className="hero-hindi" ref={backdropRef} aria-hidden="true"><span data-parallax="0.18">रंगरेज़</span></div>
      <div className="hero-intro">
        <span className="hero-kicker" data-reveal>रंगरेज़ · the colourer · contemporary Indian art studio</span>
        <DisplayText as="h1" lines={['Paint it. Fire it.', 'Frame it.']} className="hero-title" />
        <p data-reveal style={{ '--d': 0.25 }}>Original paintings, walls with a story, and custom pottery, shaped slowly for the rooms you live in.</p>
      </div>
      <div className="hero-row" data-reveal style={{ '--d': 0.15 }}>
        <HeroRow status={data.status} paintings={rowPaintings} error={data.error} />
      </div>
      <div className="hero-foot" data-reveal style={{ '--d': 0.35 }}>
        <span>Scroll to explore</span>
        <Link className="outline-pill" to="/paintings">Browse Paintings <span>↗</span></Link>
        <span>Est. in the studio · 2026</span>
      </div>
    </section>

    {/* (b) Two trails moving in opposite directions */}
    <PaintingTrails paintings={trailPaintings} />

    {/* (c) The three services, pinned while you scroll */}
    <ServicesPinned />

    {/* (d) About Us cards */}
    <AboutCards />

    <Timeline />
  </div>;
}
