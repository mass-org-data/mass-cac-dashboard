import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const crcTable = Array.from({length:256}, (_,n) => {
  for (let k=0;k<8;k++) n = n&1 ? 0xedb88320^(n>>>1) : n>>>1;
  return n>>>0;
});
function crc32(bytes) {
  let crc=0xffffffff;
  for (const byte of bytes) crc=crcTable[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
export async function writeSourceZip(root, destination) {
  const files=['.gitignore','.env.example','.env.preview.example','README.md','package.json','package-lock.json','vercel.json'];
  // A reviewed allowlist prevents untracked/private working notes being exposed
  // by the public source-download feature. It also works without Git on Vercel.
  files.push('source-archive.manifest.json');
  const reviewed=JSON.parse(await readFile(path.join(root,'source-archive.manifest.json'),'utf8'));
  for(const relative of reviewed.files){
    if(!/^(src|scripts|docs)\//.test(relative)||relative.includes('..')||/\.private\.|\.(xlsx|dump|backup|pgdump)$/i.test(relative))throw Error('Unsafe source archive entry.');
    files.push(relative);
  }
  files.push('tests/entry-workflows.mjs');
  const local=[],central=[];
  let offset=0;
  for(const relative of files) {
    const name=Buffer.from('MASS-Frontend/'+relative);
    const data=await readFile(path.join(root,relative));
    const crc=crc32(data);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);
    header.writeUInt16LE(0x0800,6);header.writeUInt16LE(33,12);
    header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);
    header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
    local.push(header,name,data);
    const directory=Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);
    directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x0800,8);
    directory.writeUInt16LE(33,14);directory.writeUInt32LE(crc,16);
    directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);
    directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
    central.push(directory,name);
    offset+=header.length+name.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);
  end.writeUInt32LE(offset,16);
  await writeFile(destination,Buffer.concat([...local,directory,end]));
}
