import React, { useState } from 'react';
import DisplayText from '../DisplayText.jsx';

// "Clay is 20% craft, 80% soul": a small grid of dots that glow near the pointer.
function DotField() {
  const [hot, setHot] = useState(null);
  const rows = [1, 2, 3, 4, 5];
  const update = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const column = Math.round(((event.clientX - rect.left) / rect.width) * 4);
    const row = Math.round(((event.clientY - rect.top) / rect.height) * 4);
    setHot(row * 5 + column);
  };
  let dotIndex = 0;
  return <div className="dot-field" onPointerMove={update} onPointerLeave={() => setHot(null)}>{rows.map((count, row) => <div className="dot-row" key={row}>{Array.from({ length: count }, () => {
    const dot = dotIndex; dotIndex += 1;
    const distance = hot === null ? 99 : Math.abs((dot % 5) - (hot % 5)) + Math.abs(Math.floor(dot / 5) - Math.floor(hot / 5));
    return <span key={dot} className="clay-dot" style={{ '--heat': Math.max(0, 1 - distance / 4) }} />;
  })}</div>)}</div>;
}

export default function AboutCards() {
  return <section className="about-section" id="about">
    <div className="about-heading">
      <span className="section-kicker" data-reveal>(Who we are)</span>
      <DisplayText text="About us." />
      <p data-reveal>A living studio for colour, clay, and the stories that make a room yours.</p>
    </div>
    <div className="about-cards">
      <article className="about-card about-fact" data-reveal style={{ '--d': 0 }}>
        <div><span className="about-eyebrow">01 / material note</span><h2>Clay is 20% craft,<br /><em>80% soul</em></h2><DotField /></div>
        <div className="about-card-foot"><strong>#Fact</strong><span>Every mark remembers the hand that made it.</span></div>
      </article>
      <article className="about-card about-hours" data-reveal style={{ '--d': 0.12 }}>
        <div className="glitch-frame"><img src="/images/p-009.jpg" alt="Pichwai Lotus Pond" data-parallax="-0.08" /></div>
        <div className="hours-panel">
          <div><span>Open Days</span><strong>Mon to Sat</strong></div>
          <div><span>Studio Hours</span><strong>10:00 to 18:00</strong></div>
          <p><b>Location:</b> 12 Colour Lane, Jaipur <small>· placeholder studio address</small></p>
        </div>
      </article>
      <article className="about-card about-story" data-reveal style={{ '--d': 0.24 }}>
        <div className="silhouette-frame"><div className="profile-silhouette"><i /></div></div>
        <h2>Why does a wall<br />need a story?</h2>
        <span className="story-arrow">↗</span>
      </article>
    </div>
  </section>;
}
