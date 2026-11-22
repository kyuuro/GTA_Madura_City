const { chromium } = require('playwright'); const http=require('http'), fs=require('fs'), path=require('path');
const root=process.argv[2], out=process.argv[3], qs=process.argv[4]||'';
const hdir=path.join(__dirname);
const srv=http.createServer((req,res)=>{ let u=decodeURIComponent(req.url.split('?')[0]); let f= u==='/kick.html'?path.join(hdir,'kick.html'):u==='/moto.html'?path.join(hdir,'moto.html'):u==='/glb.html'?path.join(hdir,'glb.html'):u==='/ayah_game.html'?path.join(hdir,'ayah_game.html'):u==='/wheels.html'?path.join(hdir,'wheels.html'):u==='/spin.html'?path.join(hdir,'spin.html'):path.join(root,u);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;res.end();return;}
 const ext=path.extname(f); res.setHeader('Content-Type',{'.js':'text/javascript','.html':'text/html','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg'}[ext]||'application/octet-stream'); fs.createReadStream(f).pipe(res);}).listen(0,async()=>{
 const port=srv.address().port; const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}); const p=await b.newPage({viewport:{width:1600,height:1600}});
 p.on('console',m=>{const t=m.text(); if(/error|fail|gagal/i.test(t)) console.log('[page]',t)}); p.on('pageerror',e=>console.log('[pageerr]',e.message));
 await p.goto(`http://localhost:${port}/${process.env.PAGE||'kick.html'}?${qs}`); await p.waitForFunction('window.__done',null,{timeout:60000});
 if(process.env.DUMP){require('fs').writeFileSync(out,JSON.stringify(await p.evaluate('window.__out'),null,1));} else await p.locator('canvas').screenshot({path:out}); await b.close(); srv.close(); });
