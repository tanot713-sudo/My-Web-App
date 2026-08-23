#!/bin/sh
# ══════════════════════════════════════════════════════════════════
# Compile languages.jsx (JSX source, React classic runtime) -> languages.compiled.js
# ต้องรันไฟล์นี้ทุกครั้งที่แก้ languages.jsx แล้ว commit languages.compiled.js
# คู่กันเสมอ — ไม่มี CI build step ผูกไว้ (ตั้งใจให้เว็บยัง deploy แบบ static
# ไฟล์ล้วนๆ เหมือนเดิม ไม่มี package.json/build ใน pipeline) เว็บโหลด
# languages.compiled.js ตรงๆ ไม่มี Babel-in-browser อีกต่อไป (เร็วขึ้นมาก
# โดยเฉพาะมือถือ) — ดู CLAUDE.md หัวข้อ languages.html สำหรับรายละเอียด
#
# ใช้: ./build-languages.sh   (ต้องมี Node.js; ใช้ esbuild ผ่าน npx ครั้งเดียว)
# ══════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

npx --yes esbuild languages.jsx \
  --jsx=transform \
  --jsx-factory=React.createElement \
  --jsx-fragment=React.Fragment \
  --outfile=languages.compiled.js \
  --target=es2019 \
  --format=iife

node --check languages.compiled.js
echo "OK: compiled languages.jsx -> languages.compiled.js"
