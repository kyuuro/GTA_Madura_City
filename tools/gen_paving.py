#!/usr/bin/env python3
"""Bikin assets/tex/paving.jpg: tekstur paving block (bata beton 20x10 cm) pola herringbone 90 derajat.
Buatan sendiri (procedural), TIDAK perlu kredit. 512 px = 1,6 m dunia (16 sel x 10 cm), bisa di-tile mulus.
Pakai: python3 tools/gen_paving.py"""
import numpy as np, pathlib
from PIL import Image

N, W = 512, 32                      # ukuran gambar, sisi sel (px) -> bata 64x32 px, periode pola 4W = 128 px
rng = np.random.default_rng(74)
yy, xx = np.mgrid[0:N, 0:N]
i, j = xx // W, yy // W
d = (i - j) % 4                      # 0,1 = bata horizontal; 2,3 = bata vertikal (domino herringbone)
# kotak bata (x0,y0,x1,y1) dalam sel, per piksel
x0 = np.where(d <= 1, (i - d) * W, i * W)
x1 = np.where(d <= 1, (i - d + 2) * W, (i + 1) * W)
y0 = np.where(d <= 1, j * W, np.where(d == 2, (j - 1) * W, j * W))
y1 = np.where(d <= 1, (j + 1) * W, np.where(d == 2, (j + 1) * W, (j + 2) * W))
# id bata -> warna tetap per bata (hash), modulo agar tile mulus
bx, by = (x0 // W) % 16, (y0 // W) % 16
h = ((bx * 73856093) ^ (by * 19349663) ^ (d.clip(0, 1) * 83492791)) & 0xFFFF
tone = 0.80 + 0.20 * (h / 65535.0)                       # variasi terang-gelap per bata
warm = ((h >> 3) & 7) / 7.0                               # sedikit variasi hangat/dingin
base = np.stack([0.60 + 0.05 * warm, np.full_like(warm, 0.59), 0.57 - 0.04 * warm], -1) * tone[..., None]
# alur nat (mortar) antar bata
g = 1.5
edge = np.minimum.reduce([xx - x0, x1 - 1 - xx, yy - y0, y1 - 1 - yy]).astype(float)
mortar = np.clip((g + 1.0 - edge) / 1.5, 0, 1)             # 1 di nat, halus ke 0 di dalam bata
bevel = np.clip((3.0 - edge) / 3.0, 0, 1) * 0.10           # tepi bata sedikit lebih gelap
col = base * (1 - bevel[..., None])
nat = np.array([0.30, 0.29, 0.27])
col = col * (1 - mortar[..., None]) + nat * mortar[..., None]
# butiran halus (pasir) + noda; noise tileable lewat roll
grain = rng.normal(0, 0.035, (N, N, 1))
blot = np.kron(rng.normal(0, 0.05, (N // 32, N // 32, 1)), np.ones((32, 32, 1)))
col = np.clip(col * (1 + grain + blot), 0, 1)
Image.fromarray((col * 255).astype(np.uint8)).save(pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'tex' / 'paving.jpg', quality=88)
print('OK assets/tex/paving.jpg', N, 'px')
