#!/bin/sh
# Bangun ulang vendor/three.bundle.js (three.js r160 + GLTFLoader + SkeletonUtils, satu file ESM ter-minify) supaya game jalan OFFLINE tanpa CDN.
# Butuh node + npm + internet SEKALI. Hasilnya di-commit di vendor/, jadi build_test.py & index.html tidak butuh internet lagi.
set -e; D=$(mktemp -d); cd "$D"; npm init -y >/dev/null; npm i three@0.160.0 esbuild
cp "$OLDPWD/vendor/three.entry.js" entry.js
npx esbuild entry.js --bundle --format=esm --minify --legal-comments=none --outfile="$OLDPWD/vendor/three.bundle.js"
cp node_modules/three/LICENSE "$OLDPWD/vendor/LICENSE-three.txt"
