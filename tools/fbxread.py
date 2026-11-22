import struct, zlib, sys
def read_fbx(path):
    d = open(path,'rb').read()
    assert d[:20]==b'Kaydara FBX Binary  '
    ver = struct.unpack_from('<I', d, 23)[0]
    big = ver >= 7500
    pos = 27
    def node(pos):
        if big: end,nprops,plen,nl = struct.unpack_from('<QQQB', d, pos); pos += 25
        else: end,nprops,plen,nl = struct.unpack_from('<IIIB', d, pos); pos += 13
        if end==0: return None,pos
        name = d[pos:pos+nl].decode(); pos += nl
        props=[]
        for _ in range(nprops):
            t = chr(d[pos]); pos+=1
            if t in 'YCIFDL':
                fmt={'Y':'<h','C':'<?','I':'<i','F':'<f','D':'<d','L':'<q'}[t]
                props.append(struct.unpack_from(fmt,d,pos)[0]); pos+=struct.calcsize(fmt)
            elif t in 'fdilb':
                n,enc,cl = struct.unpack_from('<III',d,pos); pos+=12
                raw = d[pos:pos+cl]; pos+=cl
                if enc: raw = zlib.decompress(raw)
                dt={'f':'f','d':'d','i':'i','l':'q','b':'?'}[t]
                import array
                a = struct.unpack('<%d%s'%(n,dt), raw)
                props.append(list(a))
            elif t in 'SR':
                n = struct.unpack_from('<I',d,pos)[0]; pos+=4
                raw = d[pos:pos+n]; pos+=n
                props.append(raw.decode('latin1') if t=='S' else raw)
        children=[]
        while pos < end:
            c,pos = node(pos)
            if c is None: break
            children.append(c)
        pos = end
        return {'name':name,'props':props,'children':children},pos
    roots=[]
    while pos < len(d)-1:
        n,pos2 = node(pos)
        if n is None: break
        roots.append(n); pos=pos2
    return ver, roots
def find(n,name): return [c for c in n['children'] if c['name']==name]
if __name__=='__main__':
    ver,roots = read_fbx(sys.argv[1])
    print('version',ver)
    obj = [r for r in roots if r['name']=='Objects'][0]
    for o in obj['children']:
        p=o['props']; print(o['name'], p[:3] if p else '')
    con = [r for r in roots if r['name']=='Connections'][0]
    for c in con['children'][:80]: print(c['props'])
