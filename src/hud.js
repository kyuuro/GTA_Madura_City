// HUD: FPS, counter segitiga, kualitas.
export function createHUD(renderer, getQuality, getExtra = () => '') {
  const el = document.getElementById('hud');
  let frames = 0, last = performance.now(), fps = 0;
  return function update() {
    frames++;
    const now = performance.now();
    if (now - last >= 500) { fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now; }
    const i = renderer.info.render;
    el.textContent =
      `FPS       : ${fps}\nTriangles : ${i.triangles.toLocaleString('en-US')}\nDraw calls: ${i.calls}\n` +
      `Quality   : ${getQuality()}  (press 1=Low 2=High 3=Ultra)\n` +
      getExtra() + `\nPC: WASD, Shift, Q/E, F = enter/exit vehicle | Mobile: left stick, drag right, RUN, ENTER`;
  };
}
