import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
async function check(dir){
  for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){
    const relative=path.join(dir,entry.name);
    if(entry.isDirectory())await check(relative);
    else if(/\.m?js$/.test(entry.name)){
      const result=spawnSync(process.execPath,['--check',path.join(root,relative)],{stdio:'inherit'});
      if(result.status!==0)process.exit(result.status||1);
    }
  }
}
await check('src');await check('scripts');
console.log('All application and build modules passed syntax checks.');
