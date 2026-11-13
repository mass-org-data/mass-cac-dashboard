import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the React interface is built only on request and never inlines script', async () => {
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.match(build, /process\.env\.MASS_NEXT_UI==='1'/);
  assert.match(build, /if\(nextUi\)\{const \{build:viteBuild\}=await import\('vite'\)/);
  const vite = await readFile('web/vite.config.ts', 'utf8');
  assert.match(vite, /polyfill: false/);
  assert.match(vite, /outDir: fileURLToPath\(new URL\('\.\.\/dist\/next'/);
  const html = await readFile('web/index.html', 'utf8');
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.match(html, /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.equal(/\son[a-z]+\s*=/i.test(html), false);
});

test('the new interface reuses the approved configuration check and the production CSV escaping', async () => {
  const main = await readFile('web/src/main.tsx', 'utf8');
  assert.match(main, /validateConfig\(runtimeConfig\)/);
  const csv = await readFile('web/src/lib/csv.ts', 'utf8');
  assert.match(csv, /safeCsvCell/);
  const shared = await readFile('scripts/runtime-config.mjs', 'utf8');
  assert.match(shared, /Preview builds must use the preview Supabase project/);
});

test('web sources never use service keys or inline handlers', async () => {
  for (const file of ['web/src/session/backend.ts', 'web/src/session/controller.ts', 'web/src/app/App.tsx', 'web/src/pages/Foundation.tsx']) {
    const source = await readFile(file, 'utf8');
    assert.equal(/service_role|sb_secret_|dangerouslySetInnerHTML/.test(source), false, file);
  }
});
