export const AdditiveBlending = 2, DoubleSide = 2;
export class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } clone() { return new Vector3(this.x, this.y, this.z); } copy(v) { return this.set(v.x, v.y, v.z); }
  length() { return Math.hypot(this.x, this.y, this.z); } normalize() { const l = this.length() || 1; return this.set(this.x / l, this.y / l, this.z / l); } dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  applyQuaternion(q) { const { x, y, z } = this, ix = q.w * x + q.y * z - q.z * y, iy = q.w * y + q.z * x - q.x * z, iz = q.w * z + q.x * y - q.y * x, iw = -q.x * x - q.y * y - q.z * z;
    return this.set(ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x); } }
export class Quaternion { constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; } copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; } clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
  invert() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  multiply(b) { const a = this; return this.set(a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y, a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z, a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x, a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z); }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  setFromAxisAngle(a, ang) { const s = Math.sin(ang / 2); return this.set(a.x * s, a.y * s, a.z * s, Math.cos(ang / 2)); }
  setFromUnitVectors(f, t) { let r = f.dot(t) + 1; let x, y, z; if (r < 1e-6) { x = 0; y = 0; z = 1; r = 0; if (Math.abs(f.x) > Math.abs(f.z)) { x = -f.y; y = f.x; z = 0; } else { x = 0; y = -f.z; z = f.y; } } else { x = f.y * t.z - f.z * t.y; y = f.z * t.x - f.x * t.z; z = f.x * t.y - f.y * t.x; }
    const l = Math.hypot(x, y, z, r) || 1; return this.set(x / l, y / l, z / l, r / l); } }
class Obj { constructor() { this.children = []; this.parent = null; this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0 }; this.scale = { x: 1, y: 1, z: 1, setScalar(s) { this.x = this.y = this.z = s; } }; this.quaternion = new Quaternion(); this.visible = true; this.name = ''; this.wq = new Quaternion(); this.ws = 1; }
  add(c) { if (c.parent) c.parent.remove(c); c.parent = this; this.children.push(c); } remove(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } }
  updateMatrixWorld() {} getWorldScale(v) { v.set(this.ws, this.ws, this.ws); return v; } getWorldQuaternion(q) { return q.copy(this.wq); }
  getObjectByName(n) { if (this.name === n) return this; for (const c of this.children) { const r = c.getObjectByName(n); if (r) return r; } return null; }
  traverse(f) { f(this); for (const c of this.children) c.traverse(f); } }
export class Group extends Obj {} export class Mesh extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; this.isMesh = true; } }
export class CylinderGeometry {} export class BoxGeometry {} export class RingGeometry {} export class MeshLambertMaterial { constructor(o) { Object.assign(this, o); } } export class MeshBasicMaterial { constructor(o) { Object.assign(this, o); } }
export class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; this.needsUpdate = false; } } export class BufferGeometry { constructor() { this.attributes = {}; } setAttribute(k, v) { this.attributes[k] = v; } }
export class PointsMaterial { constructor(o) { Object.assign(this, o); } } export class Points { constructor(g, m) { this.geometry = g; this.material = m; this.visible = true; } }
export { Obj };
