import React, { useEffect, useMemo } from 'react';
import FrameImage, { SEED_IMAGES } from './FrameImage.jsx';

// Opening animation (Home page, once per session).
// 1. The Rangrez mark appears in the middle (0 – 0.6s).
// 2. Painting frames start far away on the left and right "walls" of a hallway,
//    turned sideways (rotateY ±70°), small and dim.
// 3. They glide inward (translate X/Z) while turning to face the viewer (rotateY → small curve),
//    and finish as a curved row with a bigger centre painting, like the hero row underneath.
// All motion is CSS keyframes driven by per-frame CSS variables set below.

const INTRO_MS = 3400;   // when the overlay starts fading out
const FADE_MS = 550;     // fade duration, then onDone()

// Final row layout (slot -4 … 4, 0 is the centre). Start positions mimic two hallway walls.
function frameVars(slot) {
  const side = Math.sign(slot);          // -1 left wall, +1 right wall, 0 centre
  const depth = Math.abs(slot);          // 1 = nearest neighbour … 4 = far end
  const row = depth % 2 === 0 ? -1 : 1;  // alternate upper/lower rows on each wall
  if (slot === 0) {
    return { '--sx': '0vw', '--sy': '0vh', '--sz': '-1800px', '--sr': '0deg', '--ss': '.55',
      '--ex': '0px', '--ez': '0px', '--er': '0deg', '--es': '1.32', '--eb': '1', '--delay': '.75s', zIndex: 20 };
  }
  return {
    '--sx': `${side * (34 + depth * 4)}vw`,
    '--sy': `${row * 17}vh`,
    '--sz': `${-300 - depth * 380}px`,
    '--sr': `${-side * 72}deg`,           // left wall faces right, right wall faces left
    '--ss': '.8',
    '--ex': `calc(${side} * (var(--frame-w) * ${0.96 + (depth - 1) * 0.74}))`,
    '--ez': `${-depth * 70}px`,
    '--er': `${-side * Math.min(depth * 13, 44)}deg`, // gentle curve, like the cover-flow
    '--es': `${(1 - depth * 0.1).toFixed(2)}`,
    '--eb': `${(1 - depth * 0.17).toFixed(2)}`, // end brightness: far frames stay dimmer
    '--delay': `${(0.42 + depth * 0.07).toFixed(2)}s`,
    zIndex: 20 - depth
  };
}

export default function IntroHallway({ onDone }) {
  const slots = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  const images = useMemo(() => slots.map((_, i) => SEED_IMAGES[(i * 5 + 2) % SEED_IMAGES.length]), []);

  useEffect(() => {
    // Lock page scrolling while the intro covers the page; Escape skips.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const fade = window.setTimeout(() => document.querySelector('.hallway')?.classList.add('hallway-out'), INTRO_MS);
    const finish = window.setTimeout(onDone, INTRO_MS + FADE_MS);
    const onKey = (event) => { if (event.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.clearTimeout(fade); window.clearTimeout(finish); window.removeEventListener('keydown', onKey); };
  }, [onDone]);

  return <div className="hallway" role="dialog" aria-label="Rangrez opening animation">
    <button type="button" className="hallway-skip" onClick={onDone}>Skip ↗</button>
    <div className="hallway-hindi" aria-hidden="true">रंगरेज़</div>
    <div className="hallway-logo" aria-hidden="true">
      <img src="/logo-mark.svg" alt="" />
      <span>RANGREZ</span>
    </div>
    <div className="hallway-stage" aria-hidden="true">
      {slots.map((slot, i) => <div className="hallway-frame" key={slot} style={frameVars(slot)}>
        <FrameImage src={images[i]} loading="eager" label="Rangrez" />
      </div>)}
    </div>
    <div className="hallway-caption" aria-hidden="true"><span>Paint it. Fire it. Frame it.</span><span>रंगरेज़ — the colourer</span></div>
  </div>;
}
