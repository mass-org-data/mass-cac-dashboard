import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeSourceZip} from './zip.mjs';
import {build} from 'esbuild';
import {validateConfig} from '../src/live/config.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'dist');
const input={mode:process.env.MASS_APP_MODE || 'live',url:process.env.MASS_SUPABASE_URL,publishableKey:process.env.MASS_SUPABASE_PUBLISHABLE_KEY,readApi:process.env.MASS_READ_API || 'baseline',directoryApi:process.env.MASS_DIRECTORY_API || 'off'};
// Missing config builds a fail-closed configuration screen. Partial/unsafe config
// fails the build before any browser bundle or download archive is produced.
const configured=Boolean(input.url || input.publishableKey);
const config=(input.mode==='demo' || configured) ? validateConfig(input) : {mode:input.mode};
if(!['live','demo'].includes(input.mode)) throw Error('MASS_APP_MODE must be live or demo.');
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
await writeSourceZip(root,path.join(output,'MASS-CAC-Vercel-Source.zip'));
console.log(`Built MASS ${input.mode} workspace and code-only source archive in dist/.`);
