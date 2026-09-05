# @numra/react

**A debounced phone-check hook and a risk badge for React, talking to your own backend.**

[![npm version](https://img.shields.io/npm/v/@numra/react)](https://www.npmjs.com/package/@numra/react) [![npm downloads](https://img.shields.io/npm/dm/@numra/react)](https://www.npmjs.com/package/@numra/react) [![licence: MIT](https://img.shields.io/npm/l/@numra/react)](LICENSE)

React hook and components for Numra.

**This package never holds an API key and never talks to Numra.** It calls
your own backend — the one `@numra/express` (or `@numra/fastify`,
`@numra/next`, `@numra/nuxt`, `numra/laravel`) mounts for you.

Numra reads a shared fraud ledger. A key in a JavaScript bundle is readable by
anyone who opens dev tools, so there is no publishable key and no way to make
this package talk to the API directly. A test in this repo fails the build if
an `apiKey` or `api.numra.ma` ever appears in the source.

```bash
npm install @numra/react @numra/express
```

## Use it

```jsx
import { useNumraCheck, RiskBadge } from '@numra/react';

function OrderRow({ phone }) {
  const { data, isLoading, error } = useNumraCheck(phone);

  if (error) return <span>Could not check this number</span>;
  return <RiskBadge check={data} loading={isLoading} showScore />;
}
```

Server side, once:

```js
app.use('/api/numra', numraRouter({ apiKey, authorize: (req) => Boolean(req.session?.user) }));
```

## `useNumraCheck(phone, options)`

Debounced at 400ms and aborts superseded requests. Without that, typing a
phone number fires a lookup per keystroke — each one billable, and the answer
that lands last is often the answer to a prefix of what was typed.

```js
useNumraCheck(phone, {
  endpoint: '/api/numra',  // where you mounted the router
  enabled: true,
  debounceMs: 400,
});
```

Returns `{ status, data, error, isLoading, refetch }`.

## Reading the result

`riskScore` alone **cannot tell a checked-and-clean customer from a complete
stranger** — both come back low. On a cash-on-delivery store most buyers are
new, so this matters:

```js
if (!data.isRated) {
  // No history. Not a clean bill of health — just no evidence.
}
```

`<RiskBadge>` already does this: an unrated number renders as **"No history"**,
not "Low risk". A blacklisted number renders as **"Blacklisted"** even when its
band computed to MEDIUM — otherwise your page and the Numra control panel
disagree about the same number.

If you build your own badge, use the same logic:

```js
import { riskStateFor, RISK_STATES } from '@numra/react';
const state = RISK_STATES[riskStateFor(data)];
```

## Styling

`RiskBadge` uses inline styles so it works with no stylesheet in any setup.
Every colour pair clears 4.5:1 contrast, enforced by a test in
[`@numra/browser`](https://github.com/NumraApp/numra-browser) — that is where
the colours are defined, so that is where the check belongs. Pass `style` to
override the container.

## Release notes

Every release is tagged and written up on the
[Releases page](https://github.com/NumraApp/numra-react/releases). The same
history in one file is in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Bug reports and patches are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers
running the tests, the regression test a change is expected to bring with it,
and which repository a given fix actually belongs in.

## Security

Vulnerabilities go privately to the address in [SECURITY.md](SECURITY.md).
**Do not open a public issue for a security problem** — a public report is a
working exploit for every merchant running the released version until a fix
ships.

## The rest of the family

Twelve packages, one contract. The server side holds the API key; the browser
side calls the endpoint the server side mounts.

Server:

| Package | Repository |
|---|---|
| `@numra/core` | [numra-js-core](https://github.com/NumraApp/numra-js-core) |
| `@numra/express` | [numra-express](https://github.com/NumraApp/numra-express) |
| `@numra/fastify` | [numra-fastify](https://github.com/NumraApp/numra-fastify) |
| `@numra/next` | [numra-next](https://github.com/NumraApp/numra-next) |
| `@numra/nuxt` | [numra-nuxt](https://github.com/NumraApp/numra-nuxt) |
| `numra/numra-php` | [numra-php](https://github.com/NumraApp/numra-php) |
| `numra/laravel` | [numra-laravel](https://github.com/NumraApp/numra-laravel) |

Browser:

| Package | Repository |
|---|---|
| `@numra/browser` | [numra-browser](https://github.com/NumraApp/numra-browser) |
| `@numra/react` | [numra-react](https://github.com/NumraApp/numra-react) — this repo |
| `@numra/vue` | [numra-vue](https://github.com/NumraApp/numra-vue) |
| `@numra/svelte` | [numra-svelte](https://github.com/NumraApp/numra-svelte) |
| `@numra/angular` | [numra-angular](https://github.com/NumraApp/numra-angular) |

Documentation for all of them is at [numra.ma/docs](https://numra.ma/docs).

## Licence

MIT
