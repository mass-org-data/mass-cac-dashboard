import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeSourceZip} from './zip.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'dist');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(path.join(root,'src'),output,{recursive:true});
await writeSourceZip(root,path.join(output,'MASS-CAC-Vercel-Source.zip'));
console.log('Built unchanged MASS frontend and source download in dist/.');
