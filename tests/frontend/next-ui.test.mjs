import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the React interface is the default build at the dist root, the original is kept at /vanilla/, and no script is inlined', async () => {
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.match(build, /const legacy=path\.join\(output,'vanilla'\)/);
  assert.match(build, /outdir:legacy/);
  assert.match(build, /await viteBuild\(\{configFile:path\.join\(root,'web\/vite\.config\.ts'\)/);
  assert.equal(/MASS_NEXT_UI/.test(build), false);
  const vite = await readFile('web/vite.config.ts', 'utf8');
  assert.match(vite, /polyfill: false/);
  assert.match(vite, /outDir: fileURLToPath\(new URL\('\.\.\/dist'/);
  assert.match(vite, /emptyOutDir: false/);
  const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
  const redirects = Object.fromEntries(vercel.redirects.map(r => [r.source, r.destination]));
  assert.equal(redirects['/next'], '/');
  assert.equal(redirects['/vanilla'], '/vanilla/');
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
  for (const file of ['web/src/session/backend.ts', 'web/src/session/controller.ts', 'web/src/app/App.tsx', 'web/src/pages/Overview.tsx']) {
    const source = await readFile(file, 'utf8');
    assert.equal(/service_role|sb_secret_|dangerouslySetInnerHTML/.test(source), false, file);
  }
});
