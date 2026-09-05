import type { CSSProperties, ReactElement } from 'react';
import type { BrowserCheck, NumraRequestError, RiskState } from '@getnumra/browser';

/* No apiKey anywhere in this file, on purpose. This package talks to your own
   backend; @getnumra/express (or fastify / next / nuxt / laravel) is that
   backend and holds the credential. */

/* Imported, not redeclared — the way @getnumra/vue and @getnumra/svelte do it. The
   local copy that used to live here had already drifted: it was missing
   'BLOCKED' from riskLevel, so the one state a merchant most needs to branch
   on did not type-check. A second definition of a shared shape is a second
   thing to forget to update. */
export type { BrowserCheck, RiskState };

export interface UseNumraCheckOptions {
  /** Your backend's mount point. Default '/api/numra'. */
  endpoint?: string;
  enabled?: boolean;
  /** Default 400. Keystroke-per-request is billable; this is why. */
  debounceMs?: number;
}

export interface UseNumraCheckResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: BrowserCheck | null;
  error: NumraRequestError | null;
  isLoading: boolean;
  refetch: () => Promise<BrowserCheck | null>;
}

export declare function useNumraCheck(
  phone: string | null | undefined,
  options?: UseNumraCheckOptions,
): UseNumraCheckResult;

/** Kept as an alias so existing imports of this name still compile. */
export type RiskStateKey = RiskState;

/* Re-exported rather than redeclared, matching src/index.js and the Vue and
   Svelte declaration files.

   NumraRequestError is the one that mattered: src/index.js has always
   exported it, but this file did not declare it, so the
   `catch (e) { if (e instanceof NumraRequestError) }` pattern the README
   documents did not compile — a missing line here costs someone an afternoon.
   riskStateFor and RISK_STATES were second copies of the shared decision,
   which is exactly what @getnumra/browser exists to prevent. */
export { riskStateFor, RISK_STATES, NumraRequestError } from '@getnumra/browser';

export declare function RiskBadge(props: {
  check: BrowserCheck | null;
  loading?: boolean;
  /** Pass the hook's `error` and the badge says the check did not run. */
  error?: unknown;
  showScore?: boolean;
  style?: CSSProperties;
}): ReactElement | null;
