# Contributing to @getnumra/react

Patches are welcome. What this package renders is what a merchant's staff act
on, so the bar for a change is a test that would have caught the bug, not a
convincing description of it.

## Running the tests

```bash
npm install
npm test
```

Node 22.12 or newer, as `engines` declares. The suite is the built-in
`node:test` runner; components are rendered in `jsdom` and `fetch` is stubbed,
so nothing reaches a network. `test/types.test.js` type-checks `index.d.ts`
against the source, so a new export needs its declaration in the same commit.

## Every change needs a test

Every package in this family ships a regression suite, and it is the only
thing standing between a refactor and a silent behavioural change. So:

- A bug fix comes with a test that fails before it and passes after.
- A new option or export comes with a test that exercises it.
- A change to existing behaviour comes with the changed assertion, and the
  reason for the change in the commit message.

Two tests here are not negotiable:

- `test/no-credentials.test.js` fails the build if an `apiKey` or a reference
  to the Numra API appears in the source. That test *is* the credential
  boundary — this package must only ever call the merchant's own backend.
- `test/RiskBadge.test.js` asserts that a failed lookup says so rather than
  showing a stale verdict, that the badge is announced to assistive
  technology, and that a nonsensical score cannot crash the render. The
  contrast of every colour pair is enforced one level down, in
  `@getnumra/browser`, because that is where the colours are defined.

## Which repository your fix belongs in

These repositories are split out of a single monorepo. What you see here is
one package of twelve, and this one is a binding: debounce, abort, the
late-answer rule, risk states and badge styling all live in
[numra-browser](https://github.com/NumraApp/numra-browser), shared with the
Vue, Svelte and Angular packages.

So:

- Anything about *what a check means* — labels, colours, when a request fires,
  which answer wins — belongs in **`@getnumra/browser`**. Fixing it here alone is
  how the four bindings drift, and they have before.
- Anything React-shaped — the hook's lifecycle, the JSX, the prop names —
  belongs here.
- A change to what the endpoint returns belongs in
  [numra-js-core](https://github.com/NumraApp/numra-js-core) or the framework
  package that mounts it.

If your fix lands in `@getnumra/browser`, this package picks it up as a
dependency bump; say so in the pull request.

## The conformance gate

```bash
node scripts/openapi-conformance.js
```

This checks the package against the API contract and against itself. It fails
by default when no contract is vendored, on purpose: a conformance step that
goes green having compared nothing manufactures exactly the assurance it
exists to provide. Point `NUMRA_OPENAPI` at a copy of the spec, or drop it at
one of the paths the script lists, to make it run for real.

## House style

British spelling, no emoji in headings, and prose that says what a thing does
rather than how good it is. Comments explain the decision, not the syntax.

## Reporting a bug

Open an issue with the package version, the React version, and the smallest
reproduction you can manage. **A security vulnerability is not a bug report**
— see [SECURITY.md](SECURITY.md) and mail it privately instead.
