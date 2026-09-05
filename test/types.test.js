import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const dts = fs.readFileSync(path.join(root, 'index.d.ts'), 'utf8');

/* ═══════════════════════════════════════════════════════════════════════════
   The declaration file is an interface too, and it can be wrong on its own
   ───────────────────────────────────────────────────────────────────────────
   src/index.js and index.d.ts describe the same package to two different
   audiences, and nothing makes them agree. Both defects below came from that:
   an export the runtime had and the types did not, and a type this package
   redeclared instead of importing, which then drifted.
   ═══════════════════════════════════════════════════════════════════════════ */

test('every runtime export is declared', () => {
  /* `catch (e) { if (e instanceof NumraRequestError) }` is the pattern the
     README documents. src/index.js has always exported the class; index.d.ts
     did not declare it, so that line did not compile and a TypeScript user
     had no way to branch on the server's error code. */
  const runtime = fs
    .readFileSync(path.join(root, 'src', 'index.js'), 'utf8')
    .match(/export \{([^}]*)\}/g)
    .flatMap((m) => m.replace(/export \{|\}/g, '').split(','))
    .map((n) => n.trim().split(/\s+as\s+/).pop())
    .filter(Boolean);

  assert.ok(runtime.includes('NumraRequestError'), 'the fixture stopped being about the right thing');
  for (const name of runtime) {
    assert.match(dts, new RegExp(`\\b${name}\\b`), `index.d.ts never mentions ${name}`);
  }
});

test('the shared check type is imported, not redeclared', () => {
  /* Vue and Svelte import BrowserCheck from @getnumra/browser. React kept its
     own copy, and the copy had already drifted: it was missing 'BLOCKED'
     from riskLevel — the one state a merchant most needs to branch on. */
  assert.doesNotMatch(dts, /interface\s+BrowserCheck\b/, 'BrowserCheck is declared locally again');
  assert.match(dts, /from '@getnumra\/browser'/);
});

/* ── The same thing, compiled, when a compiler is available ─────────────── */

const req = createRequire(import.meta.url);
/* Resolved by manifest: a types-only package has no main to resolve. */
const has = (n) => { try { req.resolve(`${n}/package.json`); return true; } catch { return false; } };
const skip = has('typescript') && has('@types/react')
  ? false
  : 'needs typescript and @types/react installed (neither is a dependency of this package)';

test('the documented TypeScript usage actually compiles', { skip }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'numra-types-'));
  const file = path.join(dir, 'usage.ts');
  fs.writeFileSync(file, `
    import { NumraRequestError, riskStateFor, useNumraCheck } from ${JSON.stringify(root)};
    import type { BrowserCheck, RiskStateKey } from ${JSON.stringify(root)};

    declare const check: BrowserCheck;
    const state: RiskStateKey | null = riskStateFor(check);
    /* BLOCKED was missing from the local copy of the type. */
    const blocked: BrowserCheck['riskLevel'] = 'BLOCKED';

    export function widget() {
      const { data, error, refetch } = useNumraCheck('0600000000');
      try { void refetch(); } catch (e) {
        if (e instanceof NumraRequestError) return e.code;
      }
      return { data, error, state, blocked };
    }
  `);

  /* Its own manifest, not its exports map: typescript does not publish
     ./bin/tsc as a subpath. */
  const tsc = path.join(path.dirname(req.resolve('typescript/package.json')), 'bin', 'tsc');

  try {
    execFileSync(
      process.execPath,
      [tsc, '--noEmit', '--strict', '--skipLibCheck',
        '--moduleResolution', 'bundler', '--module', 'esnext', '--target', 'es2022', file],
      { stdio: 'pipe', encoding: 'utf8' },
    );
  } catch (e) {
    assert.fail(`the declared types do not compile:\n${e.stdout || e.message}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
