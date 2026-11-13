import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {readRuntimeConfig} from './runtime-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'dist');
const {input,config}=readRuntimeConfig();
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(path.join(root,'src'),output,{recursive:true});
await build({
  entryPoints:[path.join(root,'src/entry.js')],outdir:output,bundle:true,format:'esm',splitting:true,
  target:['es2022'],minify:true,entryNames:'[name]',chunkNames:'chunks/[name]-[hash]',
  plugins:[{name:'public-config',setup(builder){
    builder.onResolve({filter:/^mass-runtime-config$/},()=>({path:'config',namespace:'public-config'}));
    builder.onLoad({filter:/.*/,namespace:'public-config'},()=>({contents:`export const runtimeConfig=${JSON.stringify(config)};`,loader:'js'}));
  }}],
});
// The React interface in web/ is built only on request (MASS_NEXT_UI=1) and is served beside the
// current app at /next/. Default builds, including Production, do not contain it.
const nextUi=process.env.MASS_NEXT_UI==='1';
if(nextUi){const {build:viteBuild}=await import('vite');await viteBuild({configFile:path.join(root,'web/vite.config.ts'),logLevel:'warn'});}
let commit=process.env.VERCEL_GIT_COMMIT_SHA||'',dirty=null,trackedChanges=null;
try {
  if(!commit)commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  trackedChanges=execFileSync('git',['diff','--name-only','-z','HEAD','--'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean).sort();
  dirty=trackedChanges.length>0;
  if(dirty)console.warn('Build checkout differs from its commit in tracked paths:',trackedChanges.join(', '));
} catch { /* A source checkout may legitimately have no Git metadata. */ }
const release={format:1,commit:/^[0-9a-f]{40}$/.test(commit)?commit:null,dirty,trackedChanges,
  deploymentEnvironment:['preview','production','development'].includes(process.env.VERCEL_ENV)?process.env.VERCEL_ENV:null,
  nextUi,mode:config.mode,project:config.project||null,url:config.url||null,readApi:config.readApi||null,directoryApi:config.directoryApi||null};
// Intentionally excludes ALL keys, tokens, identity and programme records.
await writeFile(path.join(output,'release.json'),JSON.stringify(release,null,2)+'\n');
console.log(`Built MASS ${input.mode} workspace in dist/.`);
