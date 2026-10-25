import React from 'react';

// Big display heading in the Devanagari-inspired style.
// Each word is its own <span class="deva-word">, and CSS draws a flat bar
// (the "shirorekha", like the top line in Hindi writing) across the top of
// every word. Splitting into words also lets the words stagger in on scroll.
//
// Usage: <DisplayText as="h1" lines={['Paint it.', 'Fire it. Frame it.']} />
//        <DisplayText text="RANGREZ" caps />   (caps moves the bar to cap height)
export default function DisplayText({ as: Tag = 'h2', text, lines, caps = false, className = '', reveal = true }) {
  const rows = lines || [text];
  let wordIndex = 0; // running index used for the stagger delay (--i)
  return <Tag
    className={`display-text ${caps ? 'display-caps' : ''} ${className}`}
    aria-label={rows.join(' ')}
    {...(reveal ? { 'data-reveal': 'words' } : {})}
  >
    {rows.map((row, rowIndex) => <span className="display-line" key={rowIndex} aria-hidden="true">
      {row.split(' ').map((word, i) => {
        const index = wordIndex++;
        return <React.Fragment key={i}>{i > 0 && ' '}<span className="deva-word" style={{ '--i': index }}>{word}</span></React.Fragment>;
      })}
    </span>)}
  </Tag>;
}
