# Analisis export Overpass (Darmo) -> koordinat game (skala 1:3, origin geo13 + offset (340,-105))
import json, math, sys, collections
src = sys.argv[1]
d = json.load(open(src))
LAT0, LON0 = -7.2115, 112.7795
KLAT = 110574.0; KLON = 111320.0*math.cos(math.radians(7.25))
def g(lon, lat): return ((lon-LON0)*KLON/3.0 + 340, -(lat-LAT0)*KLAT/3.0 - 105)   # (x,z) game
roads=collections.defaultdict(lambda:[0,0.0]); names=collections.defaultdict(float)
b=collections.Counter(); barea=0; bl=[]; parks=[]; xs=[]; zs=[]
def area(poly):
    s=0
    for (x1,z1),(x2,z2) in zip(poly,poly[1:]): s+=x1*z2-x2*z1
    return abs(s)/2*9   # m2 asli
for f in d['features']:
    p=f['properties']; t=f['geometry']['type']; c=f['geometry']['coordinates']
    if t=='LineString':
        pts=[g(*q) for q in c]; L=sum(math.dist(a,b2) for a,b2 in zip(pts,pts[1:]))
        h=p.get('highway'); roads[h][0]+=1; roads[h][1]+=L
        if p.get('name'): names[(p['name'],h)]+=L
        xs+= [q[0] for q in pts]; zs+=[q[1] for q in pts]
    else:
        pts=[g(*q) for q in c[0]]; a=area(pts); k=p.get('building') or p.get('leisure') or '?'
        b[k]+=1; barea+=a
        cx=sum(q[0] for q in pts)/len(pts); cz=sum(q[1] for q in pts)/len(pts)
        if p.get('name'): bl.append((p['name'],k,round(cx),round(cz),round(a)))
        if p.get('leisure'): parks.append((p.get('name'),p['leisure'],round(cx),round(cz),round(a)))
print('bbox game x %.0f..%.0f z %.0f..%.0f'%(min(xs),max(xs),min(zs),max(zs)))
print('ROADS (n, panjang unit game, km asli):')
for h,(n,L) in sorted(roads.items(), key=lambda x:-x[1][1]): print(' ',h,n,round(L),round(L*3/1000,1))
print('JALAN UTAMA (nama, kelas, panjang unit):')
for (n,h),L in sorted(names.items(), key=lambda x:-x[1])[:40]:
    if h in('primary','trunk','secondary','tertiary'): print(' ',n,h,round(L))
print('BANGUNAN:',sum(b.values()),dict(b.most_common(12)),'luas total m2',round(barea))
print('TAMAN:',parks[:12])
key=['Darmo Trade Center','Royal Plaza','Taman Bungkul','Stasiun Wonokromo','Polsek Wonokromo','Marvell City Mall','Rumah Sakit Surabaya Medical Center','Transmart Ngagel','Giant Extra','Kebun Binatang','Pasar','Terminal','Rumah Sakit']
for n,k,x,z,a in bl:
    if any(s.lower() in n.lower() for s in key): print(' ',n,k,x,z,a)
