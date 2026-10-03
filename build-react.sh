#!/bin/sh
# ══════════════════════════════════════════════════════════════════
# คอมไพล์หน้า React 4 หน้า (languages, legal, classroom-business, classroom-engineering)
#   *.jsx            -> *.compiled.js   (esbuild, React classic runtime, ES2019, iife)
#   Tailwind (v3)    -> react-pages.css (ไฟล์เดียวใช้ร่วมกัน; สีผูกกับ --ome-* ใน theme.css)
# ต้องรันทุกครั้งที่แก้ .jsx / .html ของ 4 หน้านี้ / tests/react-build/* แล้ว commit ไฟล์ที่คอมไพล์
# คู่กันเสมอ — ไม่มี build step ใน deploy (เว็บยัง static ล้วน, ไม่มี package.json ที่ root)
# เว็บไม่โหลด Babel/Tailwind CDN อีกต่อไป ดู CLAUDE.md หัวข้อ "หน้า React 4 หน้า"
#
# เครื่องมือ pin เวอร์ชันไว้ใน tests/package.json (esbuild, tailwindcss) — รันครั้งแรกด้วย
#   cd tests && npm ci
# ใช้: ./build-react.sh            (languages.jsx ตัวเดียว: ./build-languages.sh ก็ยังใช้ได้ ผลเดียวกัน)
# ══════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"
BIN=tests/node_modules/.bin
if [ ! -x "$BIN/esbuild" ] || [ ! -x "$BIN/tailwindcss" ]; then
  echo "ไม่พบเครื่องมือ build — รัน: cd tests && npm ci" >&2
  exit 1
fi

for page in languages legal classroom-business classroom-engineering; do
  "$BIN/esbuild" "$page.jsx" \
    --jsx=transform \
    --jsx-factory=React.createElement \
    --jsx-fragment=React.Fragment \
    --outfile="$page.compiled.js" \
    --target=es2019 \
    --format=iife \
    --log-level=warning
  node --check "$page.compiled.js"
done

"$BIN/tailwindcss" \
  -c tests/react-build/tailwind.config.js \
  -i tests/react-build/input.css \
  -o react-pages.css \
  --minify

echo "OK: compiled 4 pages (*.jsx -> *.compiled.js) + react-pages.css"
