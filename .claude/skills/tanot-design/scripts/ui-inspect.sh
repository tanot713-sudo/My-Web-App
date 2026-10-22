#!/usr/bin/env bash
# ตรวจหน้าจอแอปด้วย taste-skill inspect.mjs --app (1440/768/390) ผ่านเซิร์ฟเวอร์ static ในเครื่อง
#
#   .claude/skills/tanot-design/scripts/ui-inspect.sh <page.html> [--dark] [--en] [--seed file.js] [--tag name] [-- <ตัวเลือกของ inspect.mjs>]
#
#   --dark / --en   ตั้ง ome:theme=dark / ome:lang=en ก่อนเปิดหน้า
#   --seed file.js  สคริปต์ที่รันก่อนเปิดหน้า (ใส่ข้อมูลตัวอย่างลง localStorage) — เปิดหน้า seed บน origin เดียวกันแล้ว location.replace ไปหน้าจริง
#   --tag name      ต่อท้ายชื่อโฟลเดอร์ผล (.taste-skill/inspect/<page>-<tag>)
#
# รันจากรากของ repo · ผลอยู่ใน .taste-skill/ (อยู่ใน .gitignore) · ต้องมี Node 22+ และ Chromium
# (/opt/pw-browsers ในคอนเทนเนอร์คลาวด์ หรือ CHROME_PATH) · รันเป็น root = ใส่ --no-sandbox ให้เอง
set -euo pipefail

page="${1:-}"; [ -n "$page" ] || { sed -n 2,11p "$0"; exit 2; }; shift
dark=0; en=0; seed=""; tag=""; extra=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dark) dark=1 ;;
    --en) en=1 ;;
    --seed) seed="$2"; shift ;;
    --tag) tag="$2"; shift ;;
    --) shift; extra=("$@"); break ;;
    *) echo "ไม่รู้จักตัวเลือก: $1" >&2; exit 2 ;;
  esac
  shift
done
[ -f "$page" ] || { echo "ไม่พบ $page (รันจากรากของ repo)" >&2; exit 2; }

root="$(pwd)"; port="${UI_INSPECT_PORT:-8199}"; work="$root/.taste-skill"
mkdir -p "$work"

# เซิร์ฟเวอร์ static (เปิดค้างไว้ใช้ซ้ำ)
if ! curl -s -o /dev/null "http://127.0.0.1:$port/$page"; then
  (python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 &)
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null "http://127.0.0.1:$port/$page" && break; sleep 0.3; done
fi

# Chromium: CHROME_PATH > Playwright ในคอนเทนเนอร์ > ให้ inspect.mjs หาเอง
chrome="${CHROME_PATH:-}"
if [ -z "$chrome" ]; then chrome="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)"; fi
if [ -n "$chrome" ] && [ "$(id -u)" = "0" ]; then
  printf '#!/bin/sh\nexec "%s" --no-sandbox "$@"\n' "$chrome" > "$work/chrome.sh"; chmod +x "$work/chrome.sh"; chrome="$work/chrome.sh"
fi

name="$(basename "$page" .html)"; [ -n "$tag" ] && name="$name-$tag"
url="http://127.0.0.1:$port/$page"
if [ $dark = 1 ] || [ $en = 1 ] || [ -n "$seed" ]; then
  {
    printf '<!doctype html><meta charset="utf-8"><script>\n'
    [ $dark = 1 ] && printf "localStorage.setItem('ome:theme','dark');\n"
    [ $en = 1 ] && printf "localStorage.setItem('ome:lang','en');\n"
    [ -n "$seed" ] && cat "$seed"
    printf "\nlocation.replace('/%s');\n</script>\n" "$page"
  } > "$work/seed-$name.html"
  url="http://127.0.0.1:$port/.taste-skill/seed-$name.html"
fi

CHROME_PATH="$chrome" node "$root/.claude/skills/taste-skill/scripts/inspect.mjs" --app "$url" --out "$work/inspect/$name" ${extra[@]+"${extra[@]}"}
