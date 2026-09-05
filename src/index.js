export { useNumraCheck } from './useNumraCheck.js';
export { RiskBadge } from './RiskBadge.jsx';

/* Re-exported, not redefined. The decision lives in @numra/browser so that
   react, vue and svelte cannot drift apart about what a blacklisted number
   looks like; re-exporting means an app that only installed this package can
   still build its own component without a second install. */
export { riskStateFor, RISK_STATES, NumraRequestError } from '@numra/browser';

/* Deliberately absent from this package, and from every browser package in
   this family: anything that accepts an apiKey, and anything that can reach
   api.numra.ma. `test/no-credentials.test.js` fails the build if either
   appears. See useNumraCheck.js for why. */
