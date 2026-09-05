import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/* ═══════════════════════════════════════════════════════════════════════════
   The component ships as .jsx, so something has to compile it
   ───────────────────────────────────────────────────────────────────────────
   That is the normal shape for a React library — the app's bundler does the
   transform — but it means node cannot import the file as it stands. So the
   test compiles it the way the Svelte package's test compiles its .svelte
   file: to a module beside the source, imported once, then deleted.

   react, react-dom and esbuild are not dependencies of this package (react is
   a peer, and a peer is the app's to install), so the test skips rather than
   failing `npm test` on a clean checkout. Where they are installed, it runs.
   ═══════════════════════════════════════════════════════════════════════════ */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, '..', 'src', 'RiskBadge.jsx');

const req = createRequire(import.meta.url);
const present = (...names) => names.every((n) => { try { req.resolve(n); return true; } catch { return false; } });

const READY = present('react', 'react-dom/server', 'esbuild');
const skip = READY ? false : 'needs react, react-dom and esbuild installed (react is a peer, not a dependency)';

let render = null;

if (READY) {
  const esbuild = (await import('esbuild')).default;
  const { js } = { js: esbuild.transformSync(fs.readFileSync(source, 'utf8'), { loader: 'jsx' }).code };
  /* Written beside the source rather than imported from a data: URL, because
     the compiled output resolves 'react' and '@numra/browser' by name. */
  const out = path.join(here, '.compiled-RiskBadge.js');
  fs.writeFileSync(out, js);
  let RiskBadge;
  try {
    ({ RiskBadge } = await import(`file://${out.replace(/\\/g, '/')}?t=${Date.now()}`));
  } finally {
    fs.rmSync(out, { force: true });
  }
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  render = (props) => renderToStaticMarkup(React.createElement(RiskBadge, props));
}

test('a rated number renders its band', { skip }, () => {
  const html = render({ check: { isRated: true, riskLevel: 'HIGH', riskScore: 72 } });
  assert.match(html, /High risk/);
  assert.match(html, /background:#FDECEC/);
});

test('a failed lookup says the check did not run', { skip }, () => {
  /* There was no error prop and no error state behind it, so a 403, a 503
     QUOTA_EXCEEDED and a dead network rendered exactly what an empty field
     renders: nothing. The operator could not tell "this number has no
     history" from "we never got to ask", and only one of those needs a
     human. */
  const html = render({ check: null, error: new Error('QUOTA_EXCEEDED') });
  assert.notEqual(html, '', 'a failed lookup rendered nothing at all');
  assert.match(html, /Check unavailable/);
  /* And it must not be readable as a verdict. */
  assert.doesNotMatch(html, /risk|No history|Blacklisted/i);
});

test('the badge is announced when it appears', { skip }, () => {
  /* It appears, changes and disappears on its own while the operator is
     typing somewhere else. Without a live region a screen-reader user gets a
     form that never mentions the verdict at all. */
  for (const props of [
    { check: { isRated: true, riskLevel: 'HIGH' } },
    { check: null, loading: true },
    { check: null, error: new Error('boom') },
  ]) {
    assert.match(render(props), /role="status"/, `${JSON.stringify(Object.keys(props))} is not announced`);
  }
  /* No aria-label: the words are already the text inside, and naming it twice
     makes a screen reader read it twice. */
  assert.doesNotMatch(render({ check: { isRated: true, riskLevel: 'HIGH' } }), /aria-label/);
});

test('a score that is not a finite number cannot crash the render', { skip }, () => {
  /* An object here used to take the whole tree down with "Objects are not
     valid as a React child" — a badge that crashes the checkout page it was
     added to — and NaN rendered as the literal word "NaN". */
  for (const riskScore of [NaN, { value: 72 }, [72], '72', null]) {
    const html = render({ check: { isRated: true, riskLevel: 'HIGH', riskScore }, showScore: true });
    assert.match(html, /High risk/);
    assert.doesNotMatch(html, /NaN|object Object|72/);
  }
  assert.match(render({ check: { isRated: true, riskLevel: 'HIGH', riskScore: 72 }, showScore: true }), /72/);
});

test('nothing to show renders nothing', { skip }, () => {
  assert.equal(render({ check: null }), '');
});
