import React, { useState } from 'react';

// A painting image that swaps itself for a coloured placeholder if the file fails to load.
export default function FrameImage({ src, alt = '', label, className = '', ...rest }) {
  const [broken, setBroken] = useState(!src);
  if (broken) {
    return <div className={`frame-placeholder ${className}`} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      <span>{label || alt || 'Rangrez'}</span>
    </div>;
  }
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" draggable="false" onError={() => setBroken(true)} {...rest} />;
}

// The seed paintings' image files (served from /public/images). Used by the intro
// and as a fallback row when the API cannot be reached.
export const SEED_IMAGES = Array.from({ length: 12 }, (_, i) => `/images/p-${String(i + 1).padStart(3, '0')}.jpg`);

export const placeholderPaintings = SEED_IMAGES.map((imageUrl, index) => ({
  id: null, // no detail page: these link to /paintings instead
  imageUrl,
  title: `Studio work ${index + 1}`,
  price: null,
  status: null
}));

// Repeat a list until it has at least `min` items, so loops never look empty.
export function fillTo(list, min) {
  if (!list.length) return [];
  const out = [];
  while (out.length < min) out.push(...list);
  return out;
}
