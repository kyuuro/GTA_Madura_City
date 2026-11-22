#!/usr/bin/env python3
"""Bangun test.html: satu file, tanpa server, dengan console error di layar.
Pakai: python tools/build_test.py   (jalankan tiap akhir iterasi)
Aturan kode: import antar modul lokal harus SATU baris, nama top-level harus unik antar modul."""
import re, subprocess, pathlib, datetime, sys, tempfile, os
root = pathlib.Path(__file__).resolve().parent.parent
MODULES = ['assets', 'hud', 'world', 'character', 'controls', 'collide', 'darmo_data', 'koridor_data', 'darmo_bld_data', 'roaddata', 'roads', 'buildings', 'lazy', 'koridor', 'darmo_bld', 'districts', 'perak', 'kenjeran', 'kampung', 'suramadu', 'madura', 'rumput', 'paving', 'vehicles', 'npcs', 'astar', 'satpol', 'health', 'impact', 'weapons', 'fight', 'sitik', 'retro', 'music', 'sfx', 'traffic', 'vcollide', 'damage', 'bengkel', 'lights', 'minimap', 'settings', 'main']   # urutan dependensi, main paling akhir. TAMBAH modul baru di sini.

def strip(src):
    out = []
    for line in src.splitlines():
        if re.match(r"\s*import\s.+from\s+'\./", line): continue
        if re.match(r"\s*import \* as THREE from 'three';", line): continue
        if re.match(r"\s*export \{.*\};?\s*$", line): continue
        line = line.replace("import('three/addons/loaders/GLTFLoader.js')", 'Promise.resolve(THREE)').replace("import('three/addons/utils/SkeletonUtils.js')", 'Promise.resolve(THREE)')   # addon sudah ada di bundle
        out.append(re.sub(r"^export (default )?", "", line))
    return "\n".join(out)

game = "const THREE = await import(window.__THREE_URL__);   // three.js r160 ter-inline (vendor/three.bundle.js) -> test.html jalan offline\n" + "\n".join(f"// ---- {m}.js ----\n" + strip((root/'src'/f'{m}.js').read_text()) for m in MODULES)

with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False) as f: f.write(game)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True); os.unlink(f.name)
if r.returncode: print('GAGAL cek sintaks gabungan:\n', r.stderr); sys.exit(1)

DBG = r"""
<style>
#dbgb{position:fixed;right:8px;top:8px;z-index:99;display:flex;gap:6px;font:12px monospace}
#dbgb button{background:#000b;color:#ffe9a8;border:1px solid #ffe9a866;padding:6px 9px;border-radius:6px;font:12px monospace}
#dbg{position:fixed;left:0;right:0;bottom:0;max-height:45%;overflow:auto;z-index:98;background:#000d;color:#ddd;font:11px/1.35 monospace;padding:6px;white-space:pre-wrap;display:none}
#dbg .error{color:#ff6b6b}#dbg .warn{color:#ffd166}
</style>
<div id="dbgb"><button id="dbgt">Console 0</button><button id="dbgc">Salin</button><button id="dbgx">Bersih</button></div>
<div id="dbg"></div>
<script>
(function(){
 var box=document.getElementById('dbg'),bt=document.getElementById('dbgt'),errs=0,lines=[];
 function log(k,m){var t=new Date().toLocaleTimeString()+' ['+k+'] '+m;lines.push(t);if(lines.length>300)lines.shift();
  var d=document.createElement('div');d.className=k;d.textContent=t;box.appendChild(d);box.scrollTop=box.scrollHeight;
  if(k==='error'){errs++;bt.textContent='Console '+errs+' error';bt.style.color='#ff6b6b';box.style.display='block';}}
 ['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){
  try{log(k==='info'?'log':k,Array.prototype.map.call(arguments,function(a){return a instanceof Error?a.stack||a.message:(typeof a==='object'?JSON.stringify(a):String(a))}).join(' '))}catch(e){}
  o.apply(console,arguments)}});
 addEventListener('error',function(e){log('error',(e.message||'error')+' @ '+String(e.filename||'').split('/').pop()+':'+e.lineno+':'+e.colno)});
 addEventListener('unhandledrejection',function(e){log('error','Promise: '+(e.reason&&(e.reason.stack||e.reason.message)||e.reason))});
 bt.onclick=function(){box.style.display=box.style.display==='block'?'none':'block'};
 document.getElementById('dbgx').onclick=function(){box.innerHTML='';lines=[];errs=0;bt.textContent='Console 0';bt.style.color=''};
 document.getElementById('dbgc').onclick=function(){var s=lines.join('\n');(navigator.clipboard?navigator.clipboard.writeText(s):Promise.reject()).then(function(){log('log','tersalin')},function(){var a=document.createElement('textarea');a.value=s;document.body.appendChild(a);a.select();try{document.execCommand('copy');log('log','tersalin')}catch(e){log('warn','salin gagal, screenshot saja')}a.remove()})};
 log('log','test.html build @@STAMP@@ | '+navigator.userAgent.slice(0,80));
 setTimeout(function(){if(!window.__gameStarted)log('error','Game belum mulai setelah 10 dtk. Cek error di atas (three.js sudah ter-inline, tidak butuh internet).')},10000);
})();
</script>
"""
head = """<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>GTA: Gak Tau Aturan - TEST</title>
<link rel="icon" type="image/png" sizes="32x32" href="@@FAV32@@"><link rel="icon" type="image/png" sizes="192x192" href="@@FAV192@@"><link rel="apple-touch-icon" href="@@FAV180@@">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#1a1410;touch-action:none}canvas{display:block}
#hud{position:fixed;left:12px;top:10px;color:#ffe9a8;text-shadow:0 2px 0 #000;font:12px/1.4 monospace;pointer-events:none;white-space:pre}
#title{display:none}</style>
@@THREELOADER@@
</head><body><div id="hud"></div><div id="title"></div>"""
import base64, mimetypes
def inline_assets(js):   # ganti path assets/... di splash.js dengan data URI kalau file-nya ada (test.html satu file)
    def rep(m):
        f = root / m.group(0)
        if not f.exists(): return m.group(0)
        mt = 'font/woff2' if f.suffix == '.woff2' else (mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
        return f"data:{mt};base64," + base64.b64encode(f.read_bytes()).decode()
    return re.sub(r"(?:assets|vendor)/[\w./-]+\.(?:jpg|jpeg|png|woff2)", rep, js)
import json
GLB = {f.stem: 'data:model/gltf-binary;base64,' + base64.b64encode(f.read_bytes()).decode() for f in sorted((root/'assets').glob('*.glb'))}   # .glb di assets/ ikut ter-inline ke test.html (fetch file:// diblok browser)
KENNEY_USED = ['roads/light-square', 'roads/electricity-pole', 'roads/traffic-light', 'retro-urban/wall-a-door', 'retro-urban/roof-metal-type-a', 'retro-urban/detail-dumpster-closed', 'rumput/tufts', 'pohon/trees', 'rumah/rusty', 'rumah/indo', 'rumah/abandoned', 'rumah/indomaret'] + ['retro-urban/' + c for c in ['wall-a','wall-b','wall-a-window','wall-b-window','wall-a-door','wall-b-door','roof-metal-type-b', 'wall-fence']] + ['commercial/building-' + c for c in 'abcdefghijklmn'] + ['commercial/building-skyscraper-' + c for c in 'abcde'] + ['suburban/building-type-' + c for c in 'abcdefghijklmnopqrstu']   # TAMBAH tiap model Kenney yang sudah disambung ke kode (path tanpa .glb)
PACK_USED = {'taxi': 'taxi', 'hatch': 'hatchback', 'pickup': 'pickup', 'suv': 'suv', 'sedan': 'sedan', 'sports': 'sports', 'muscle': 'muscle', 'truck': 'truck', 'police': 'police_sedan', 'polsuv': 'police_suv', 'ambulance': 'ambulance', 'firetruck': 'firetruck', 'becak': 'props/becak', 'muscle2': 'muscle_2', 'polmuscle': 'police_muscle', 'polsports': 'police_sports', 'roadster': 'roadster', 'monster': 'monster_truck', 'limo': 'limousine', 'bus': 'bus', 'trailer': 'truck_with_trailer'}   # nama model game -> assets/vehicles-pack/<file>.glb (iterasi 15; samakan dengan MODEL_CFG[...].file)
for k, fn in PACK_USED.items():
    f = root / 'assets' / ((fn if '/' in fn else 'vehicles-pack/' + fn) + '.glb')
    if f.exists(): GLB[k] = 'data:model/gltf-binary;base64,' + base64.b64encode(f.read_bytes()).decode()
def embed_tex(path):   # GLB + tekstur luar -> GLB mandiri (tekstur masuk BIN chunk), supaya jalan dari file://
    import struct
    d = path.read_bytes(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20+L]); o = 20 + L
    bl = struct.unpack('<I', d[o:o+4])[0]; binc = bytearray(d[o+8:o+8+bl])
    for im in j.get('images', []):
        if 'uri' in im:
            png = (path.parent / im.pop('uri')).read_bytes()
            while len(binc) % 4: binc.append(0)
            j['bufferViews'].append({'buffer': 0, 'byteOffset': len(binc), 'byteLength': len(png)}); im['bufferView'] = len(j['bufferViews']) - 1; im['mimeType'] = 'image/png'; binc += png
    while len(binc) % 4: binc.append(0)
    j['buffers'][0]['byteLength'] = len(binc)
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
    return struct.pack('<4sII', b'glTF', 2, 28 + len(js) + len(binc)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(binc), b'BIN\0') + bytes(binc)
for k in KENNEY_USED:
    f = root / 'assets' / 'kenney' / (k + '.glb')
    if f.exists(): GLB['kenney/' + k] = 'data:model/gltf-binary;base64,' + base64.b64encode(embed_tex(f)).decode()
import zlib, gzip   # iter 24: GLB inline = 'gz:' + base64(gzip); dibuka di assets.js glbUrl()
GLB = {k: 'gz:' + base64.b64encode(gzip.compress(base64.b64decode(v.split(',', 1)[1]), 9)).decode() for k, v in GLB.items()}
RETRO_USED = ['humanMaleA', 'humanFemaleA', 'survivorMaleB', 'survivorFemaleA']   # skin asli Kenney (iter 33); varian recolor lama tidak ikut ter-inline
RTEX = {f.stem: 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode() for f in sorted((root/'assets'/'retro').glob('*.png')) if f.stem in RETRO_USED}
AUD = {'assets/audio/' + f.name: 'data:audio/mpeg;base64,' + base64.b64encode(f.read_bytes()).decode() for f in sorted((root/'assets'/'audio').glob('*.mp3'))}   # mp3 di-inline sekali; dipakai splash.js & music.js
TEXD = {f.stem: 'data:image/jpeg;base64,' + base64.b64encode(f.read_bytes()).decode() for f in sorted((root/'assets'/'tex').glob('*.jpg'))}   # iter 62: tekstur jalan/trotoar (file:// tidak boleh memuat gambar ke WebGL)
GLBJS = '<script>window.__GLB=' + json.dumps(GLB) + ';window.__RTEX=' + json.dumps(RTEX) + ';window.__AUD=' + json.dumps(AUD) + ';window.__TEX=' + json.dumps(TEXD) + ';</script>' if GLB else ''
SPLASH = '<script>\n' + inline_assets((root/'splash.js').read_text()) + '\n</script>' if (root/'splash.js').exists() else ''
import base64 as _b64
_tb = (root/'vendor'/'three.bundle.js').read_bytes()
THREELOADER = "<script>window.__THREE_URL__=URL.createObjectURL(new Blob([Uint8Array.from(atob('" + _b64.b64encode(_tb).decode() + "'),function(c){return c.charCodeAt(0)})],{type:'text/javascript'}));</script>"
head = head.replace('@@THREELOADER@@', THREELOADER)
_fav = lambda n: 'data:image/png;base64,' + base64.b64encode((root/'assets'/'icons'/f'icon-{n}.png').read_bytes()).decode()   # iter 83: favicon ter-inline (test.html satu file)
head = head.replace('@@FAV32@@', _fav(32)).replace('@@FAV192@@', _fav(192)).replace('@@FAV180@@', _fav(180))
html = head + GLBJS + SPLASH + DBG.replace('@@STAMP@@', datetime.datetime.now().strftime('%Y-%m-%d %H:%M')) + '<script type="module">\n' + game + '\n</script></body></html>'
(root/'test.html').write_text(html)
print('GLB inline:', ', '.join(GLB) or '-');print(f'OK test.html {len(html)/1024:.1f} KB dari modul: {", ".join(MODULES)}')
