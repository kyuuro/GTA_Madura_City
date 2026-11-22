import json,struct,sys,numpy as np
def info(path):
    d=open(path,'rb').read(); n=struct.unpack_from('<I',d,12)[0]; g=json.loads(d[20:20+n]); bo=20+n+8; B=d[bo:]
    def accdata(i):
        a=g['accessors'][i]; v=g['bufferViews'][a['bufferView']]
        return np.frombuffer(B,dtype=np.float32,count=a['count']*3,offset=v['byteOffset']).reshape(-1,3)
    def qrot(q,p):
        x,y,z,w=q; R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]); return p@R.T
    def world(nd,p):
        p=p*np.array(nd.get('scale',[1,1,1]))
        if 'rotation' in nd: p=qrot(nd['rotation'],p)
        return p+np.array(nd.get('translation',[0,0,0]))
    top=g['nodes'][g['scenes'][0]['nodes'][0]]
    res={}
    for ci in top['children']:
        nd=g['nodes'][ci]
        for pr in g['meshes'][nd['mesh']]['primitives']:
            P=world(top,world(nd,accdata(pr['attributes']['POSITION'])))
            mname=g['materials'][pr['material']]['name'] if 'material' in pr else '-'
            res.setdefault(nd['name'],[]).append((mname,P))
    return g,res
if __name__=='__main__':
    g,res=info(sys.argv[1]); allp=np.vstack([p for v in res.values() for _,p in v])
    print('bounds',allp.min(0).round(2),allp.max(0).round(2),'size',(allp.max(0)-allp.min(0)).round(2))
    for k,v in res.items():
        pts=np.vstack([p for _,p in v]); print(' ',k,'center',pts.mean(0).round(2))
    for k,v in res.items():
        for m,p in v:
            if m in('headlights','rear lights'): print('  ',k,m,'center',p.mean(0).round(2))
