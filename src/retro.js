// Iterasi 26: karakter Kenney "Animated Characters Retro" (CC0) sebagai pengganti makeCharacter procedural.
// assets/char_retro.glb (mesh + klip Idle/Run/Jump) + skin ASLI Kenney (iter 33): assets/retro/humanMaleA.png & humanFemaleA.png (tanpa recolor).
// Varian recolor lama (assets/retro/m0_*.png dst) masih ada di disk tapi TIDAK dipakai lagi.
// initRetro() dipanggil sekali di main.js; sesudahnya makeCharacter() otomatis memakai karakter ini (opt-out: {proc:true}).
import * as THREE from 'three';
import { glbUrl } from './assets.js';
import { setRetro, makeHat } from './character.js';
import { sikSolve } from './sitik.js';

const VARIANTS = ['humanMaleA', 'humanFemaleA', 'survivorMaleB', 'survivorFemaleA'];   // Retro (iter 33) + Survivors (iter 49), semua Kenney CC0; model/rig sama   // skin asli Kenney
const HEIGHT = 1.8;
// Iterasi 50: NPC tambahan (model luar yang sudah disiapkan tools/prep_npc_chars.py): assets/npc_hijab.glb (Muslim_Girl, Ready Player Me) & assets/npc_sma.glb (anak SMA cewe, Sketchfab).
// Tiap GLB = 1 SkinnedMesh + 1 atlas + klip Idle/Run siap pakai, tinggi 1.0 -> diskala ke `h` (m, ukuran dunia game; karakter Kenney ~2.5 m karena kepala besar). Kosongkan/ubah daftar ini untuk mematikan/menyetel.
// Tes cepat: index.html?npc_extra=0 (matikan) | ?h_extra=2.3 (paksa tinggi semua).
const EXTRA_DEFS = [{ key: 'npc_hijab', h: 2.0 }, { key: 'npc_sma', h: 1.9 }, { key: 'npc_ayah', h: 2.3 }, { key: 'npc_malayu', h: 2.2 }, { key: 'npc_melayu', h: 2.0 }];   // iter 65: + ayah, pria baju melayu, wanita gamis+hijab
// Iterasi 56: model polisi (assets/npc_polisi.glb, "Indonesian Police Dalmas" oleh mixboni, CC BY 4.0, lihat CREDITS.md) = SEMUA karakter bertopi 'satpol' (petugas Satpol PP pengejar, patroli, NPC satpol). Dibuat tools/prep_polisi.py; membawa perisai di sisi kiri (+X).
// Tes cepat: index.html?polisi=0 (kembali ke karakter Kenney + topi satpol) | ?h_polisi=2.2 (paksa tinggi).
const POLISI_DEF = { key: 'npc_polisi', h: 2.3 };
const PLAYER_DEF = { key: 'npc_ndas', h: 2.1, rider: true };   // iter 81: karakter PEMAIN = badan scan + kepala detail (user). ?pemain=kenney = karakter Kenney lama, ?h_pemain=2.3 = tinggi   // Kenney ~2,5 m (kepala besar); polisi 2,3 m supaya terbaca sebagai petugas dewasa
// Iterasi 77 (menggantikan 'kerdil' iter 76): kepala Kenney yang terlalu besar DIPERKECIL (tulang Head diskala HEADK, pivot di pangkal leher), lalu seluruh badan diskala
// supaya tinggi akhir = TARGET_H m (sama dengan model realistis npc_*.glb 2,0-2,3 m). Topi ikut mengecil (menempel ke tulang Head). Model lain tidak diubah.
// Tes cepat: index.html?head=0.7 (kepala lebih besar) | ?head=1 (kepala asli Kenney) | ?tinggi=2.2 (tinggi akhir). Lihat log "[retro] proporsi".
const _q = (n, d) => { try { const v = parseFloat(new URLSearchParams(location.search).get(n)); return v > 0 ? v : d; } catch (e) { return d; } };
const HEADK = _q('head', 0.55), TARGET_H = _q('tinggi', 2.1);
const EXTRA_CHANCE = 0.3;   // peluang tiap pejalan kaki NPC memakai salah satu model tambahan (pemain, Satpol, pengendara tidak pernah)
const SIT = { thigh: -1.35, shin: 1.2, arm: -0.9, fore: -0.4 };   // iter 46: sudut pose duduk (rad) - atur kalau kaki/tangan kurang pas di Scoopy

// Iterasi 78: animasi berkelahi yang sebenarnya (dulu: satu lengan diayun lurus + kaki tetap lari -> mirip jalan biasa). Dipakai karakter Kenney DAN model tambahan/polisi (nama tulang sama: Hips/Spine/LeftArm/...).
// Pukulan (PT dtk): tarik tangan (siku ditekuk, badan memutar ke belakang) -> HENTAK lurus (badan memutar ke depan + condong) -> tahan -> kembali. Tangan satunya menjaga di dekat dagu, kaki melebar (kuda-kuda) dan animasi jalan dimatikan selama menyerang.
// Titik kena (fight.js wind 0,12 dtk = u 0,31) jatuh tepat di akhir hentakan. Sudut dalam radian di sumbu X/Y DUNIA milik holder (depan = +Z, negatif X = ke depan), dipasang SETELAH mixer tiap frame. Atur konstanta MELEE_* di bawah kalau pose kurang pas.
const MELEE = { PT: 0.38, KT: 0.45, armBack: 0.25, armOut: -1.5, foreWind: -1.9, foreOut: -0.1, twistWind: -0.18, twistOut: 0.25, lean: -0.1, guardArm: -0.75, guardFore: -1.8, legFront: -0.3, legBack: 0.25 };
const KICK = { thigh: -1.45, fold: 1.7, out: 0.05, back: 1.2, lean: 0.22, armL: -1.0, foreL: -1.0, armR: -0.4, foreR: -0.9 };   // iter 82: sudut tendangan (rad): paha maju, betis terlipat (chamber), betis lurus (hentak), betis terlipat saat ditarik, condong belakang
function makeMelee(body, holder) {
  const qh = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), qr = new THREE.Quaternion(), ax = new THREE.Vector3(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
  const get = (...ns) => { for (const n of ns) { const b = body.getObjectByName(n); if (b) return b; } return null; };
  const B = { spine: get('Spine'), chest: get('Chest', 'Spine2', 'Spine1'), arm: { Left: get('LeftArm'), Right: get('RightArm') }, fore: { Left: get('LeftForeArm'), Right: get('RightForeArm') }, up: { Left: get('LeftUpLeg'), Right: get('RightUpLeg') }, leg: { Left: get('LeftLeg'), Right: get('RightLeg') } };
  const rot = (b, axis, ang) => { if (!b || !b.parent || !ang) return; holder.getWorldQuaternion(qh); ax.copy(axis).applyQuaternion(qh); qr.setFromAxisAngle(ax, ang); b.getWorldQuaternion(qw); qw.premultiply(qr); b.parent.getWorldQuaternion(qp); b.quaternion.copy(qp.invert().multiply(qw)); b.updateMatrixWorld(true); };
  const sm = (x) => x * x * (3 - 2 * x), cl = (x) => Math.min(1, Math.max(0, x));
  let pT = 0, kT = 0, side = 'Right', dirty = false; const M = MELEE;
  // iter 83: klip Idle model tambahan/pemain TIDAK punya track kaki (npc_ndas: hanya Hips/Spine/lengan) -> tulang itu tidak pernah di-reset mixer saat bobot Run = 0, sehingga rotasi tendangan
  // MENUMPUK tiap frame (kaki makin kusut/'distorted' dan tetap miring setelah tendangan). Solusi: simpan pose awal (bind) tulang yang kita sentuh dan kembalikan SEBELUM mixer.update tiap frame selama menyerang.
  const touched = []; for (const o of [B.spine, B.chest, B.arm.Left, B.arm.Right, B.fore.Left, B.fore.Right, B.up.Left, B.up.Right, B.leg.Left, B.leg.Right]) if (o && !touched.some(t => t.b === o)) touched.push({ b: o, q: o.quaternion.clone() });
  return {
    pre() { const act = pT > 0 || kT > 0; if (act || dirty) for (const t of touched) t.b.quaternion.copy(t.q); dirty = act; },   // panggil SEBELUM mixer.update
    punch(sd) { pT = M.PT; side = sd === 'L' ? 'Left' : 'Right'; kT = 0; },
    kick() { kT = M.KT; pT = 0; },
    busy() { return pT > 0 || kT > 0; },
    update(dt) {
      if (pT > 0) {
        pT -= dt; const u = 1 - Math.max(0, pT) / M.PT; let Wd, E;
        if (u < 0.18) { Wd = sm(u / 0.18); E = 0; } else if (u < 0.34) { const t = sm((u - 0.18) / 0.16); Wd = 1 - t; E = t; } else if (u < 0.55) { Wd = 0; E = 1; } else { Wd = 0; E = sm(1 - (u - 0.55) / 0.45); }
        const g = cl(u / 0.15) * cl((1 - u) / 0.2), s = side === 'Right' ? 1 : -1, opp = side === 'Right' ? 'Left' : 'Right'; holder.updateMatrixWorld(true);
        const tw = s * (M.twistWind * Wd + M.twistOut * E);
        rot(B.spine, AY, tw); rot(B.chest, AY, tw * 1.1); rot(B.spine, AX, M.lean * E);
        rot(B.up[opp], AX, M.legFront * g); rot(B.leg[opp], AX, 0.15 * g); rot(B.up[side], AX, M.legBack * g); rot(B.leg[side], AX, 0.2 * g);
        rot(B.arm[opp], AX, M.guardArm * g); rot(B.fore[opp], AX, M.guardFore * g);
        rot(B.arm[side], AX, M.armBack * Wd + M.armOut * E); rot(B.fore[side], AX, M.foreWind * Wd + M.foreOut * E);
      } else if (kT > 0) {
        // Iter 82: TENDANGAN DEPAN (teep) 3 tahap, u = 0..1: (1) ANGKAT LUTUT (paha naik, betis terlipat), (2) HENTAK (betis lurus tepat di u~0,46 = titik kena fight.js wind 0,2 dtk), (3) TARIK kembali + turun.
        // Badan condong ke belakang sedikit, kaki tumpu menekuk, kedua tangan menjaga di depan dada. Sudut betis = relatif terhadap paha (rotasi dunia ditumpuk). Atur KICK_* di bawah kalau kurang pas.
        kT -= dt; const u = 1 - Math.max(0, kT) / M.KT; holder.updateMatrixWorld(true);
        const g = sm(cl(u / 0.22)) * (1 - sm(cl((u - 0.8) / 0.2))), lerp = (a, b, t) => a + (b - a) * t;
        const thigh = KICK.thigh * sm(cl(u / 0.3)) * (1 - sm(cl((u - 0.6) / 0.4)));
        const shin = u < 0.3 ? KICK.fold * sm(u / 0.3) : u < 0.46 ? lerp(KICK.fold, KICK.out, sm((u - 0.3) / 0.16)) : u < 0.6 ? KICK.out : u < 0.78 ? lerp(KICK.out, KICK.back, sm((u - 0.6) / 0.18)) : KICK.back * (1 - sm((u - 0.78) / 0.22));
        rot(B.spine, AX, KICK.lean * sm(cl(u / 0.35)) * (1 - sm(cl((u - 0.6) / 0.4))));
        rot(B.up.Right, AX, thigh); rot(B.leg.Right, AX, shin);
        rot(B.up.Left, AX, -0.14 * g); rot(B.leg.Left, AX, 0.3 * g);
        rot(B.arm.Left, AX, KICK.armL * g); rot(B.fore.Left, AX, KICK.foreL * g); rot(B.arm.Right, AX, KICK.armR * g); rot(B.fore.Right, AX, KICK.foreR * g);
      }
    },
  };
}

export async function initRetro() {
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const SU = await import('three/addons/utils/SkeletonUtils.js');
    const url = await glbUrl((typeof window !== 'undefined' && window.__GLB && window.__GLB['char_retro']) || 'assets/char_retro.glb');
    const gltf = await new GLTFLoader().loadAsync(url);
    const tl = new THREE.TextureLoader(), tex = {};
    await Promise.all(VARIANTS.map(n => new Promise((res) => tl.load((window.__RTEX && window.__RTEX[n]) || `assets/retro/${n}.png`, (t) => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; tex[n] = t; res(); }, undefined, () => res()))));
    if (!tex.humanMaleA) throw new Error('skin asli tidak termuat');
    // tinggi dari posisi tulang (Box3 pada SkinnedMesh tak bisa dipercaya karena skala Root 100x)
    gltf.scene.updateMatrixWorld(true);
    let y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
    gltf.scene.traverse(n => { if (n.isBone && !/Ctrl|IK|Roll/.test(n.name)) { n.getWorldPosition(v); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } });
    const k = HEIGHT / Math.max(y1 - y0, 1e-6), q = new URLSearchParams(location.search).get('yaw_retro');
    const yaw = ((q ? parseFloat(q) : 0) || 0) * Math.PI / 180;
    console.log(`[retro] tulang y ${y0.toFixed(3)}..${y1.toFixed(3)} -> skala ${k.toFixed(4)}, ${Object.keys(tex).length} skin asli, klip: ${gltf.animations.map(a => a.name).join(',')}`);
    const clip = (n) => gltf.animations.find(a => a.name === n);
    // iter 42: ukur kepala asli (vertex berbobot >=0.5 ke tulang Head, pose rest) -> topi dipasang di PUNCAK kepala, bukan di tebakan tinggi badan
    const HEAD = { cx: 0, cz: 0, top: HEIGHT, cy: HEIGHT - 0.2, hw: 0.25, hd: 0.25 };
    gltf.scene.traverse(m => {
      if (!m.isSkinnedMesh) return;
      const g = m.geometry, pp = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bi = m.skeleton.bones.findIndex(x => x.name === 'Head');
      if (bi < 0 || !si || !sw) return;
      const bb = new THREE.Box3(), t = new THREE.Vector3(); let n = 0;
      for (let i = 0; i < pp.count; i++) {
        let w = 0; const a4 = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)], w4 = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)];
        for (let c = 0; c < 4; c++) if (a4[c] === bi) w += w4[c];
        if (w < 0.5) continue; t.fromBufferAttribute(pp, i).applyMatrix4(m.matrixWorld); bb.expandByPoint(t); n++;
      }
      if (n > 20) { HEAD.cx = (bb.min.x + bb.max.x) / 2 * k; HEAD.cz = (bb.min.z + bb.max.z) / 2 * k; HEAD.top = (bb.max.y - y0) * k; HEAD.cy = ((bb.min.y + bb.max.y) / 2 - y0) * k; HEAD.hw = (bb.max.x - bb.min.x) / 2 * k; HEAD.hd = (bb.max.z - bb.min.z) / 2 * k; }
    });
    console.log(`[retro] kepala: puncak y ${HEAD.top.toFixed(2)}, pusat y ${HEAD.cy.toFixed(2)}, setengah lebar ${HEAD.hw.toFixed(2)} dalam ${HEAD.hd.toFixed(2)}, tengah x ${HEAD.cx.toFixed(2)} z ${HEAD.cz.toFixed(2)}`);
    let HIP = 0.9, FIT = 1; { const hb = gltf.scene.getObjectByName('Hips'); if (hb) { hb.getWorldPosition(v); HIP = (v.y - y0) * k; } }   // iter 76: tinggi pinggul (dipakai mengangkat pengendara motor supaya tetap duduk di jok)
    { const hb = gltf.scene.getObjectByName('Head'); const hy = hb ? (hb.getWorldPosition(v).y - y0) * k : HEAD.cy; const top = hy + (HEAD.top - hy) * HEADK; FIT = TARGET_H / Math.max(top, 1e-6);
      console.log(`[retro] proporsi: sendi kepala y ${hy.toFixed(2)}, puncak lama ${HEAD.top.toFixed(2)} -> baru ${top.toFixed(2)} (kepala x${HEADK}), skala badan x${FIT.toFixed(3)} -> tinggi ${TARGET_H} m`); }
    const extras = [], xq = new URLSearchParams(location.search), hq = parseFloat(xq.get('h_extra')) || 0;
    if (xq.get('npc_extra') !== '0') await Promise.all(EXTRA_DEFS.map(async (def) => {   // iter 50: gagal muat = dilewati, karakter Kenney tetap jalan
      try {
        const gx = await new GLTFLoader().loadAsync(await glbUrl((window.__GLB && window.__GLB[def.key]) || `assets/${def.key}.glb`));
        if (!gx.animations.find(a => a.name === 'Idle') || !gx.animations.find(a => a.name === 'Run')) throw new Error('klip Idle/Run tidak ada');
        gx.scene.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; } });
        extras.push({ def, gx }); console.log(`[retro] NPC tambahan ${def.key} dimuat (klip: ${gx.animations.map(a => a.name).join(',')})`);
      } catch (e) { console.log(`[retro] NPC tambahan ${def.key} gagal (${e && e.message ? e.message : e}), dilewati`); }
    }));
    let playerX = null;   // iter 81: gagal muat = pemain tetap karakter Kenney
    if (xq.get('pemain') !== 'kenney') {
      try {
        const gp = await new GLTFLoader().loadAsync(await glbUrl((window.__GLB && window.__GLB[PLAYER_DEF.key]) || `assets/${PLAYER_DEF.key}.glb`));
        if (!gp.animations.find(a => a.name === 'Idle') || !gp.animations.find(a => a.name === 'Run')) throw new Error('klip Idle/Run tidak ada');
        gp.scene.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; } });
        playerX = { def: { ...PLAYER_DEF, h: parseFloat(xq.get('h_pemain')) || PLAYER_DEF.h }, gx: gp }; console.log(`[retro] karakter pemain ${PLAYER_DEF.key} dimuat (klip: ${gp.animations.map(a => a.name).join(',')})`);
      } catch (e) { console.log(`[retro] karakter pemain gagal (${e && e.message ? e.message : e}), pakai Kenney`); }
    }
    let polisi = null;   // iter 56: gagal muat = Satpol tetap karakter Kenney + topi
    if (xq.get('polisi') !== '0') {
      try {
        const gp = await new GLTFLoader().loadAsync(await glbUrl((window.__GLB && window.__GLB[POLISI_DEF.key]) || `assets/${POLISI_DEF.key}.glb`));
        if (!gp.animations.find(a => a.name === 'Idle') || !gp.animations.find(a => a.name === 'Run')) throw new Error('klip Idle/Run tidak ada');
        gp.scene.traverse(m => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; } });
        polisi = { def: POLISI_DEF, gx: gp }; console.log(`[retro] model polisi ${POLISI_DEF.key} dimuat (klip: ${gp.animations.map(a => a.name).join(',')})`);
      } catch (e) { console.log(`[retro] model polisi gagal (${e && e.message ? e.message : e}), Satpol pakai karakter Kenney`); }
    }
    // iter 81: pose duduk di motor dipakai bersama (karakter Kenney & model tambahan yang diberi def.rider)
    const makeSit = (holder, body, mixer, idle, run) => (P) => {   // iter 46: pose duduk di motor (dipanggil sekali oleh vehicles.js SEBELUM holder dimasukkan ke kendaraan, jadi posisi dunia = koordinat lokal kendaraan; pengendara tidak dianimasikan lagi).
        // iter 79: P = { foot:[y,z], grip:[y,z], lean } -> pose dihitung IK (sitik.js) dari posisi tulang nyata: pergelangan kaki ke pijakan, tangan ke stang (P.grip) / pinggang pengemudi (boncengan), badan condong P.lean rad. Tanpa P: sudut tetap SIT (cara lama).
        idle.setEffectiveWeight(1); run.setEffectiveWeight(0); mixer.update(0); holder.updateMatrixWorld(true);
        const qh = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), qr = new THREE.Quaternion(), ax = new THREE.Vector3(), wv = new THREE.Vector3();
        const rot = (name, ang) => {
          const b = body.getObjectByName(name); if (!b || !b.parent) return;
          holder.getWorldQuaternion(qh); ax.set(1, 0, 0).applyQuaternion(qh); qr.setFromAxisAngle(ax, ang);
          b.getWorldQuaternion(qw); qw.premultiply(qr); b.parent.getWorldQuaternion(qp); b.quaternion.copy(qp.invert().multiply(qw)); b.updateMatrixWorld(true);
        };
        if (!P) { for (const sd of ['Left', 'Right']) { rot(sd + 'UpLeg', SIT.thigh); rot(sd + 'Leg', SIT.shin); rot(sd + 'Arm', SIT.arm); rot(sd + 'ForeArm', SIT.fore); } return; }
        const pos = (n) => { const b = body.getObjectByName(n); if (!b) return null; b.getWorldPosition(wv); return [wv.y, wv.z]; };
        if (P.lean) { rot('Spine', P.lean); rot('Chest', P.lean * 0.4); rot('Neck', -P.lean * 0.9); }   // badan condong ke depan (tulang menunjuk ATAS: sudut POSITIF = ke depan, kebalikan dari kaki), leher menegakkan kepala
        const limb = (u, m, e, tg, opt) => {
          const U = pos(u), M = pos(m), E = pos(e); if (!U || !M || !E || !tg) return;
          const r = sikSolve([M[0] - U[0], M[1] - U[1]], [E[0] - M[0], E[1] - M[1]], [tg[0] - U[0], tg[1] - U[1]], opt);
          rot(u, r.a1); rot(m, r.a2);
        };
        for (const sd of ['Left', 'Right']) {
          limb(sd + 'UpLeg', sd + 'Leg', sd + 'Foot', P.foot, { a1: [-2.1, 0.4], a2: [-0.3, 2.4], pref: 0.6, reg: 0.02 });
          limb(sd + 'Arm', sd + 'ForeArm', sd + 'Hand', P.grip, { a1: [-2.2, 0.3], a2: [-1.3, 1.3], pref: 0, reg: 0.01 });
        }
      };
    const makeExtra = (o, pick) => {
      const ex = pick || extras[(Math.random() * extras.length) | 0], holder = new THREE.Group(), inner = new THREE.Group(), body = SU.clone(ex.gx.scene);
      if (ex.noShield) body.traverse(m => { if (m.isSkinnedMesh) m.geometry = ex.noShield; });   // iter 85
      inner.add(body); inner.scale.setScalar((pick && pick.def.key === 'npc_polisi' && parseFloat(xq.get('h_polisi'))) || (!ex.def.rider && hq) || ex.def.h); holder.add(inner); holder.scale.setScalar(o.scale || 1);
      const mixer = new THREE.AnimationMixer(body), idle = mixer.clipAction(ex.gx.animations.find(a => a.name === 'Idle')), run = mixer.clipAction(ex.gx.animations.find(a => a.name === 'Run'));
      idle.play(); run.play(); idle.time = Math.random() * 1; run.time = Math.random() * 0.6; let w = 0;
      holder.userData.sit = () => {};   // bukan pengendara; kosong supaya aman kalau dipanggil
      if (ex.def.rider) { holder.userData.sit = makeSit(holder, body, mixer, idle, run); holder.userData.sitLift = HIP - 0.48 * inner.scale.x * holder.scale.x; }   // iter 81: pemain 'ndas' naik motor: pinggul (0,48 tinggi) ke jok seperti karakter Kenney
      const melee = makeMelee(body, holder); holder.userData.punch = (sd) => melee.punch(sd); holder.userData.kick = () => melee.kick();   // iter 78: polisi & NPC tambahan ikut punya animasi pukul
      holder.userData.retroAnim = (dt, speed) => {   // sama dengan karakter Kenney: campur Idle<->Run menurut kecepatan
        if (!holder.visible) return;
        w += ((speed > 0.3 && !melee.busy() ? 1 : 0) - w) * Math.min(1, dt * (melee.busy() ? 25 : 10));
        idle.setEffectiveWeight(1 - w); run.setEffectiveWeight(w); run.setEffectiveTimeScale(Math.min(1.7, Math.max(0.45, speed / 4.2)));
        melee.pre(); mixer.update(dt); melee.update(dt);
      };
      return holder;
    };
    // iter 85: petugas di motor tanpa perisai. Perisai model polisi = simpul berbobot 1,0 ke LeftArm yang membentuk busur (r 0,215..0,31 dari (x 0, z -0,10), satuan model tinggi 1; lihat tools/prep_polisi.py shield_mask).
    // Dibuat sekali (geometri baru berbagi atribut, indeks tanpa segitiga perisai); makeExtra memasangnya ke tiap klon pengendara.
    const noShieldGeo = (gx) => {
      let sm = null; gx.scene.traverse(m => { if (m.isSkinnedMesh && !sm) sm = m; }); if (!sm) return null;
      const g = sm.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, la = sm.skeleton.bones.findIndex(b => b.name === 'LeftArm'), ix = g.index; if (la < 0 || !ix) return null;
      const sh = new Uint8Array(P.count);
      for (let i = 0; i < P.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === la) w += SW.getComponent(i, k); sh[i] = w > 0.999 && Math.hypot(P.getX(i), P.getZ(i) + 0.10) > 0.215 ? 1 : 0; }
      const keep = []; for (let t = 0; t < ix.count; t += 3) { const a = ix.getX(t), b = ix.getX(t + 1), c = ix.getX(t + 2); if (!(sh[a] || sh[b] || sh[c])) keep.push(a, b, c); }
      const g2 = g.clone(); g2.setIndex(keep); console.log(`[retro] polisi pengendara: perisai dibuang (${(ix.count - keep.length) / 3} dari ${ix.count / 3} segitiga)`); return g2;
    };
    const bag = []; let lastT = null;   // iter 65: shuffle-bag semua tipe NPC (4 skin Kenney + model tambahan), tiap putaran semua tipe keluar sekali
    const nextType = () => {
      if (!bag.length) { const all = [...extras.map(e => 'x:' + e.def.key), ...VARIANTS.filter(n => tex[n]).map(n => 'k:' + n)]; for (let i = all.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [all[i], all[j]] = [all[j], all[i]]; } if (all.length > 1 && all[all.length - 1] === lastT) all.unshift(all.pop()); bag.push(...all); }
      return lastT = bag.pop();
    };
    setRetro((o = {}) => {
      if (o.player && playerX) return makeExtra(o, playerX);   // iter 81
      if (polisi && o.hat === 'satpol') return makeExtra(o, o.rider ? (polisi.rider ||= { def: { ...polisi.def, rider: true }, gx: polisi.gx, noShield: noShieldGeo(polisi.gx) }) : polisi);   // iter 85: o.rider = petugas di motor pengejar (model polisi + pose duduk IK)   // iter 56: semua petugas bertopi satpol = model polisi (bukan pengendara, jadi tanpa pose duduk)
      let forced = null;   // iter 65: NPC memakai 'kantong acak' (tiap tipe karakter muncul bergiliran, merata) -> tidak ada satu model yang mendominasi
      if (o.npc && o.hat !== 'satpol' && o.hat !== 'helm') { const t = nextType(); if (t.startsWith('x:')) return makeExtra(o, extras.find(e => 'x:' + e.def.key === t)); forced = t.slice(2); }
      const fem = o.female !== undefined ? !!o.female : !!(o.npc && o.hat !== 'satpol' && o.hat !== 'helm' && Math.random() < 0.35);
      const pool = (fem ? ['humanFemaleA', 'survivorFemaleA'] : ['humanMaleA', 'survivorMaleB']).filter(n => tex[n]), vary = o.npc && o.hat !== 'satpol';   // iter 49: NPC acak dari 2 skin per gender; pemain/satpol tetap skin dasar
      const name = (o.variant && tex[o.variant] ? o.variant : null) || forced || (fem && !pool.length ? ['humanMaleA'] : pool)[vary ? (Math.random() * pool.length) | 0 : 0] || 'humanMaleA';   // iter 79: o.variant = skin tertentu (variasi pengendara)   // skin asli; o.shirt / o.skin tidak dipakai lagi
      const holder = new THREE.Group(), inner = new THREE.Group(), body = SU.clone(gltf.scene);
      body.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.map = tex[name]; m.material.needsUpdate = true; m.frustumCulled = false; m.castShadow = true; } });
      inner.add(body); inner.scale.setScalar(k); inner.position.y = -y0 * k; inner.rotation.y = yaw; holder.add(inner);
      const hk = o.hat === undefined ? 'peci' : o.hat, hat = makeHat(hk, o.hatColor);
      if (hat) {   // iter 47: skala mengikuti lebar & kedalaman kepala; topi ditempel ke tulang Head supaya ikut gerak animasi (dulu diam di holder -> tertinggal/melayang saat kepala maju)
        const H = HEAD, helm = hk === 'helm', r = helm ? 0.29 : 0.23, sy = helm ? (H.top + 0.09 - (H.cy + H.hw * 0.2)) / 0.29 : H.hw / 0.23;
        const m = helm ? 1.2 : 1.08; hat.scale.set(H.hw * m / r, sy, H.hd * m / r);
        hat.position.set(H.cx, helm ? H.cy + H.hw * 0.2 : H.top - 0.2 * sy, H.cz); holder.add(hat);
        const hb = body.getObjectByName('Head'); if (hb) { holder.updateMatrixWorld(true); hb.attach(hat); }
      }
      { const hb2 = body.getObjectByName('Head'); if (hb2) hb2.scale.setScalar(HEADK); }   // iter 77: SETELAH topi di-attach (attach menjaga ukuran dunia topi, lalu ikut mengecil bersama kepala)
      holder.scale.setScalar((o.scale || 1) * FIT); holder.userData.sitLift = HIP * (1 - FIT);   // iter 77: pengendara diturunkan/dinaikkan ke jok sesuai skala badan
      const mixer = new THREE.AnimationMixer(body), idle = mixer.clipAction(clip('Idle')), run = mixer.clipAction(clip('Run'));
      idle.play(); run.play(); idle.time = Math.random() * 1; run.time = Math.random() * 0.6; let w = 0;
      holder.userData.sit = makeSit(holder, body, mixer, idle, run);
      const melee = makeMelee(body, holder);   // iter 78
      holder.userData.punch = (sd) => melee.punch(sd); holder.userData.kick = () => melee.kick();
      holder.userData.retroAnim = (dt, speed) => {
        if (!holder.visible) return;
        w += ((speed > 0.3 && !melee.busy() ? 1 : 0) - w) * Math.min(1, dt * (melee.busy() ? 25 : 10));   // iter 78: saat berkelahi animasi lari mati cepat
        idle.setEffectiveWeight(1 - w); run.setEffectiveWeight(w); run.setEffectiveTimeScale(Math.min(1.7, Math.max(0.45, speed / 4.2)));
        melee.pre(); mixer.update(dt); melee.update(dt);
      };
      return holder;
    });
    console.log('[retro] karakter Kenney aktif');
  } catch (e) { console.log(`[retro] gagal (${e && e.message ? e.message : e}), pakai karakter procedural`); }
}
