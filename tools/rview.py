"""Render kasar (numpy+matplotlib) untuk memeriksa hasil skinning/animasi tanpa three.js"""
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

def shade(P, F, view):   # view: 'front' (kamera di +Z) | 'side' (kamera di +X)
    n = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    L = np.array([0.3, 0.5, 0.8]) if view == 'front' else np.array([0.8, 0.5, 0.3]); L /= np.linalg.norm(L)
    return np.clip(n @ L, 0, 1) * 0.7 + 0.3

def draw(ax, P, F, col, view='front', title=''):
    if view == 'front': X, Z = P[:, 0], P[:, 2]
    else: X, Z = -P[:, 2], P[:, 0]   # samping: kanan layar = +Z (depan)
    Y = P[:, 1]; depth = Z if view == 'front' else Z
    order = np.argsort(depth[F].mean(1)) if view == 'front' else np.argsort(-P[F][:, :, 0].mean(1))
    polys = [np.c_[X[F[i]], Y[F[i]]] for i in order]
    ax.add_collection(PolyCollection(polys, facecolors=col[order], edgecolors='none'))
    ax.set_xlim(X.min() - .05, X.max() + .05); ax.set_ylim(Y.min() - .05, Y.max() + .05); ax.set_aspect('equal'); ax.set_title(title, fontsize=8); ax.axis('off')
