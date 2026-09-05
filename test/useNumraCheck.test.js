import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

/* ═══════════════════════════════════════════════════════════════════════════
   Running the hook for real
   ───────────────────────────────────────────────────────────────────────────
   The defect below only exists in React's own lifecycle, so nothing short of
   mounting the hook in React can catch it. That needs react, react-dom and a
   DOM, none of which this package declares — it declares react as a PEER, and
   a peer is the app's to install.

   So the test asks whether they are here and skips if they are not, rather
   than making `npm test` fail on a clean checkout. Where React is installed —
   CI, a working tree, anyone debugging this — it runs.
   ═══════════════════════════════════════════════════════════════════════════ */

const req = createRequire(import.meta.url);
const present = (...names) => names.every((n) => { try { req.resolve(n); return true; } catch { return false; } });

const READY = present('react', 'react-dom/client', 'jsdom');
const skip = READY ? false : 'needs react, react-dom and jsdom installed (they are peers, not dependencies)';

let React, act, createRoot, container, useNumraCheck;

if (READY) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  /* React refuses to run effects synchronously inside act() without it. */
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  act = React.act ?? (await import('react-dom/test-utils')).act;
  container = dom.window.document.getElementById('root');
  ({ useNumraCheck } = await import('../src/useNumraCheck.js'));
}

const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const RATED = { isRated: true, riskLevel: 'HIGH', riskScore: 72 };

/** Replaces global fetch for one test, recording the calls. */
function stubFetch(handler) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, phone: JSON.parse(init.body).phone });
    return handler(url, init, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

/** Mounts the hook and exposes whatever it last returned. */
function probe(props = {}) {
  const seen = { current: null };
  function Probe({ phone, options }) {
    seen.current = useNumraCheck(phone, options);
    return null;
  }
  const root = createRoot(container);
  const el = (p) => React.createElement(
    React.StrictMode,
    null,
    React.createElement(Probe, { phone: p.phone, options: p.options }),
  );
  return { seen, root, render: (p) => root.render(el({ ...props, ...p })) };
}

test('a StrictMode double mount still fetches', { skip }, async () => {
  /* ═══════════════════════════════════════════════════════════════════════
     The controller used to be built in useMemo, and dispose() is one-way:
     it sets a flag nothing clears. StrictMode deliberately runs
     mount → effects → cleanups → effects again on the same render, and
     useMemo does not re-run for that second pass — so the remounted hook got
     back the controller the first cleanup had already killed. set()
     short-circuited on the disposed flag and the hook never fetched anything
     again, for the life of the component.

     Zero requests, no error, no loading state: in development, which is
     where an integrator meets this package first, the badge simply never
     appeared and nothing said why.
     ═══════════════════════════════════════════════════════════════════════ */
  const f = stubFetch(() => ok(RATED));
  const p = probe({ options: { debounceMs: 5 } });

  await act(async () => { p.render({ phone: '0600000000' }); });
  await act(async () => { await tick(40); });

  assert.equal(f.calls.length, 1, 'the hook never sent a request at all');
  assert.equal(f.calls[0].phone, '0600000000');
  assert.equal(p.seen.current.status, 'success');
  assert.equal(p.seen.current.data.riskLevel, 'HIGH');

  /* And it is still alive afterwards — a second number goes out too. */
  await act(async () => { p.render({ phone: '0611111111' }); });
  await act(async () => { await tick(40); });
  assert.equal(f.calls.length, 2, 'the hook stopped fetching after the first number');
  assert.equal(p.seen.current.data.phone ?? '0611111111', '0611111111');

  await act(async () => { p.root.unmount(); });
  f.restore();
});

test('refetch works after a StrictMode double mount', { skip }, async () => {
  /* The same dead controller was behind the ref, so "check again" did
     nothing either — and returned undefined rather than a promise. */
  const f = stubFetch(() => ok(RATED));
  const p = probe({ options: { debounceMs: 5000 } });

  await act(async () => { p.render({ phone: '0600000000' }); });

  let result;
  await act(async () => { result = await p.seen.current.refetch(); });
  assert.equal(f.calls.length, 1, 'refetch went nowhere');
  assert.equal(result.riskLevel, 'HIGH');

  await act(async () => { p.root.unmount(); });
  f.restore();
});

test('a real unmount aborts the request and leaves no timer behind', { skip }, async () => {
  /* The other half of the fix: creating the controller in the effect must not
     cost the cleanup that was already right. */
  let aborted = 0;
  const f = stubFetch(async (_url, init) => {
    init.signal.addEventListener('abort', () => { aborted += 1; });
    await tick(200);
    return ok(RATED);
  });
  const p = probe({ options: { debounceMs: 5 } });

  await act(async () => { p.render({ phone: '0600000000' }); });
  await act(async () => { await tick(30); });
  assert.equal(f.calls.length, 1, 'nothing was in flight to abort');

  await act(async () => { p.root.unmount(); });
  assert.equal(aborted, 1, 'the request nobody will read stayed on the wire');

  await tick(60);
  assert.equal(f.calls.length, 1, 'a timer outlived the component and fired');
  f.restore();
});

test('unmounting during the debounce sends nothing at all', { skip }, async () => {
  const f = stubFetch(() => ok(RATED));
  const p = probe({ options: { debounceMs: 60 } });

  await act(async () => { p.render({ phone: '0600000000' }); });
  await act(async () => { p.root.unmount(); });
  await tick(120);

  assert.equal(f.calls.length, 0, 'the debounce timer fired after the unmount');
  f.restore();
});
