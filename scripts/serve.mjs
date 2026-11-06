import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.zip':'application/zip'};
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:(process.env.PORT||3000));
http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let target=path.resolve(root,'.'+pathname);
    if(target!==root&&!target.startsWith(root+path.sep)) {res.writeHead(403);res.end('Forbidden');return;}
    if((await stat(target)).isDirectory()) target=path.join(target,'index.html');
    const bytes=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});
    res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`MASS frontend: http://localhost:${port}`));
