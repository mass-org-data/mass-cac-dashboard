import {readFile, readdir, writeFile} from 'node:fs/promises';
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
async function walk(root, relative) {
  const entries=await readdir(path.join(root,relative),{withFileTypes:true});
  const files=[];
  for (const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    const next=path.posix.join(relative,entry.name);
    if(entry.isDirectory()) files.push(...await walk(root,next));
    else if(entry.isFile()) files.push(next);
  }
  return files;
}
export async function writeSourceZip(root, destination) {
  const files=['.gitignore','README.md','package.json','package-lock.json','vercel.json'];
  for(const dir of ['src','scripts','docs','tests']) files.push(...await walk(root,dir));
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

