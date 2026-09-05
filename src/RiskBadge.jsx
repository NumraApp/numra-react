import React from 'react';
import { badgeParts } from '@numra/browser';

/* A presentational badge. No fetching, no key, no opinion about your layout.

   The label, the colours and the geometry come from @numra/browser, shared
   with the Vue and Svelte packages — a merchant running two of ours on two
   pages must not see two different badges. See that package for why
   blacklisted outranks the band and why unrated has its own words.

   This file is the React rendering of that data and nothing else. */

export function RiskBadge({ check, loading = false, error = null, showScore = false, style = {} }) {
  const b = badgeParts(check, { loading, error, showScore, style });
  if (!b) return null;

  return (
    /* role="status" because this appears, changes and disappears on its own
       while the operator is typing somewhere else entirely. Without a live
       region a screen-reader user gets a form that never mentions the verdict
       at all. No aria-label: the label is already the text inside, and
       spelling it twice makes the announcement say it twice. */
    <span role="status" style={b.container}>
      <span aria-hidden="true" style={b.dot} />
      {b.label}
      {b.score !== null && <span style={b.scoreStyle}>{b.score}</span>}
    </span>
  );
}

export default RiskBadge;
