import { useCallback, useEffect, useRef, useState } from 'react';
import { createCheckController, IDLE } from '@numra/browser';

/* ═══════════════════════════════════════════════════════════════════════════
   @numra/react — the browser half
   ───────────────────────────────────────────────────────────────────────────
   This package never talks to api.numra.ma and cannot be made to. There is no
   apiKey option anywhere in it, by design: Numra reads a shared fraud ledger,
   and a key in a bundle is a key in everyone's hands.

   It talks to YOUR backend — the one @numra/express (or fastify / next /
   nuxt / laravel / plain PHP) mounts for you. The two halves are built to
   meet: mount the router, drop in the component, no glue.

       app.use('/api/numra', numraRouter({ apiKey, authorize }));   // server
       const { data } = useNumraCheck(phone);                       // browser

   Debounce, abort and stale-answer rejection live in @numra/browser's
   controller, shared with Vue and Svelte. This hook used to own that logic
   and was missing the stale-answer guard — an abort landing after the
   response resolved does not always throw, so an old verdict could overwrite
   a newer one. Sharing the machine is what caught it.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Look up a phone number through your own backend.
 *
 * @param {string|null} phone      null/empty disables the lookup
 * @param {{ endpoint?: string, enabled?: boolean, debounceMs?: number }} [options]
 */
export function useNumraCheck(phone, options = {}) {
  const { endpoint = '/api/numra', enabled = true, debounceMs = 400 } = options;

  const [state, setState] = useState(IDLE);
  const ref = useRef(null);

  /* Read by the effect below when it builds a controller, so a controller
     rebuilt mid-life (the endpoint changed) starts out knowing what to look
     up instead of waiting for the next keystroke. */
  const latest = useRef(null);
  latest.current = { phone, enabled };

  /* One controller per (endpoint, debounce), built HERE and not in useMemo.
     dispose() is one-way — it sets a disposed flag that nothing clears — and
     StrictMode deliberately runs mount → effects → cleanups → effects again
     on the same render. useMemo does not re-run for that second pass, so the
     remounted hook got back the controller the first cleanup had already
     killed, every set() short-circuited, and the hook silently never fetched
     anything for the life of the component. In development only, which is
     where every integrator meets it first.

     Creating it in the effect means each mount gets a live one. */
  useEffect(() => {
    const c = createCheckController({ endpoint, debounceMs, onState: setState });
    ref.current = c;
    c.set(latest.current.phone, latest.current.enabled);

    return () => {
      c.dispose();
      /* Only if it is still ours: a cleanup must not blank out the
         controller a newer effect has already installed. */
      if (ref.current === c) ref.current = null;
    };
  }, [endpoint, debounceMs]);

  useEffect(() => {
    ref.current?.set(phone, enabled);
  }, [phone, enabled]);

  /* Stable, so passing it to a memoised "check again" button does not
     re-render the button on every keystroke. */
  const refetch = useCallback(() => ref.current?.refetch() ?? Promise.resolve(null), []);

  return {
    ...state,
    isLoading: state.status === 'loading',
    /* An explicit re-run, for a "check again" button. */
    refetch,
  };
}
