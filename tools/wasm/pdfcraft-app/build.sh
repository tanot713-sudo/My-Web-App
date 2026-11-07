#!/usr/bin/env bash
# build PdfCraft แบบโปรแกรมเต็ม (apps/pdfcraft-web, egui/eframe → wasm) → vendor/craft/pdfcraft-app-<commit 7 ตัว><CRAFT_SUFFIX>/
# + ลงทะเบียนใน vendor/craft/manifest.json (libs["pdfcraft-app"]) — หน้า pdf-pro.html โหลดผ่าน craft-loader.js
# build จากซอร์สต้นฉบับที่ล็อก commit + patches/*.patch (เจ้าของสั่ง 2026-11: เอาการ์ด/ปุ่มชุมชน ArtCraft ออก) — รุ่นที่แก้ไขแล้ว
# จึงต้องไม่มีเครื่องหมาย ArtCraft เลย (docs/brand/LICENSE-brand.txt "Forks and modified versions"): patch ลบโลโก้/ชื่อออกทุกจุดใน UI
# + PDFCRAFT_BUILD_LABEL=tanot ให้หน้า About บอกว่าไม่ใช่รุ่นทางการ
# ต้องมี: rustup (ติดตั้ง rust ตาม RUST ด้านล่าง + wasm32 ให้เอง), git, node,
#         wasm-bindgen-cli เวอร์ชันเดียวกับ Cargo.lock ของ PdfCraft (cargo install wasm-bindgen-cli --version <เลข> --locked)
# ไม่บังคับ: wasm-opt (binaryen 132) — WASM_OPT=<path>; ไม่มี = ข้าม -Oz (ไฟล์ใหญ่ขึ้น)
# ฟอนต์: craft-fonts ที่ commit เดียวกับรุ่นทางการของ PdfCraft (มี Noto Sans Thai, OFL) → CRAFT_FONTS_DIR
# build ซ้ำได้ไบต์เดิม: ซอร์สอยู่ใต้ target/src และ path ถูก remap เป็น /pdfcraft, /cargo (ไม่ขึ้นกับเครื่อง)
# path ที่ deploy แล้วห้ามเปลี่ยนเนื้อไฟล์ — build ใหม่จาก commit เดิมให้ตั้ง CRAFT_SUFFIX=-2 แล้วลบโฟลเดอร์เก่า
# หลัง build: bump CACHE ใน sw.js + tests/repo-guards.mjs + tests/pdf-pro.spec.js
set -euo pipefail

REV=645016addcfb9078c557f0189559ab47cdcee057        # PdfCraft v0.9.0
FONTS_REV=b076417b5880bd4154bd22f00695b1d28c6bea83  # storytold/craft-fonts (ตาม .github/workflows/release.yml ของ v0.9.0)
RUST=1.97.0

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
work="$here/target"
src="$work/src/pdfcraft"
fonts="$work/src/craft-fonts"
out="$root/vendor/craft/pdfcraft-app-${REV:0:7}${CRAFT_SUFFIX:-}"
mkdir -p "$work/src"

fetch() { # <url> <dir> <rev>
  [ -d "$2/.git" ] || git init -q "$2"
  git -C "$2" fetch -q --depth 1 "$1" "$3"
  git -C "$2" checkout -q --force FETCH_HEAD
  git -C "$2" clean -qfdx
  [ "$(git -C "$2" rev-parse HEAD)" = "$3" ] || { echo "$2 ไม่ใช่ $3" >&2; exit 1; }
}
fetch https://github.com/storytold/pdfcraft "$src" "$REV"
fetch https://github.com/storytold/craft-fonts "$fonts" "$FONTS_REV"
for p in "$here"/patches/*.patch; do git -C "$src" apply --whitespace=nowarn "$p"; done
# ห้ามเหลือไฟล์ของ docs/brand/ ที่ฝังเข้า wasm
! grep -rn 'docs/brand/' "$src/crates" "$src/apps" --include=*.rs | grep -v '/tests/' || { echo "ยังมีการฝังไฟล์ docs/brand/" >&2; exit 1; }
[ -f "$fonts/fonts/noto-sans-thai/NotoSansThai.ttf" ] || { echo "craft-fonts ไม่มี Noto Sans Thai" >&2; exit 1; }

rustup toolchain install "$RUST" --profile minimal --target wasm32-unknown-unknown >/dev/null
wbg="$(awk '/^name = "wasm-bindgen"$/ { getline; gsub(/version = |"/, ""); print; exit }' "$src/Cargo.lock")"
command -v wasm-bindgen >/dev/null || { echo "ไม่พบ wasm-bindgen — cargo install wasm-bindgen-cli --version $wbg --locked" >&2; exit 1; }
have="$(wasm-bindgen --version | awk '{ print $2 }')"
[ "$have" = "$wbg" ] || { echo "wasm-bindgen $have ไม่ตรงกับ Cargo.lock ($wbg)" >&2; exit 1; }

cargo_home="${CARGO_HOME:-$HOME/.cargo}"
export CARGO_TARGET_DIR="$work/cargo"
export CRAFT_FONTS_DIR="$fonts"
export SOURCE_DATE_EPOCH="$(git -C "$src" log -1 --format=%ct)"
export PDFCRAFT_BUILD_SHA="$REV"
export PDFCRAFT_BUILD_LABEL=tanot
export PDFCRAFT_BUILD_DATE="$(date -u -d "@$SOURCE_DATE_EPOCH" +%Y-%m-%d)"
export RUSTFLAGS="--remap-path-prefix=$src=/pdfcraft --remap-path-prefix=$fonts=/craft-fonts --remap-path-prefix=$cargo_home=/cargo --remap-path-prefix=$HOME/.rustup=/rustup"
(cd "$src" && cargo "+$RUST" build --release --locked --target wasm32-unknown-unknown -p pdfcraft-web)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# --target web = ES module (หน้า import แบบ module); ชื่อไฟล์คงที่ — รุ่นอยู่ในชื่อโฟลเดอร์แทน hash ของ trunk
wasm-bindgen --target web --no-typescript --out-dir "$tmp" --out-name pdfcraft_app \
  "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/pdfcraft-web.wasm"

opt="${WASM_OPT:-$(command -v wasm-opt || true)}"
optver=""
if [ -n "$opt" ]; then
  # ระดับเดียวกับ trunk ของต้นฉบับ (data-wasm-opt="z") · ฟีเจอร์ = ค่าเริ่มต้นของ rustc 1.97 บน wasm32-unknown-unknown
  "$opt" -Oz --strip-debug --strip-producers \
    --enable-bulk-memory --enable-mutable-globals --enable-sign-ext --enable-nontrapping-float-to-int \
    --enable-multivalue --enable-reference-types \
    "$tmp/pdfcraft_app_bg.wasm" -o "$tmp/opt.wasm"
  mv "$tmp/opt.wasm" "$tmp/pdfcraft_app_bg.wasm"
  optver="$("$opt" --version)"
else
  echo "ไม่มี wasm-opt — ข้าม -Oz" >&2
fi

rm -rf "$out"
mkdir -p "$out"
cp "$tmp/pdfcraft_app.js" "$out/"
# Cloudflare Pages รับไฟล์ละ ≤ 25 MiB — wasm ของแอปเต็ม (~43 MiB) แบ่งเป็นส่วนเท่าๆ กัน ≤ 24 MiB (pdfcraft_app_bg.<n>.wasm)
# ส่วนย่อยไม่ใช่ wasm ที่รันเองได้: craft-app.js โหลดทุกส่วน (ตรวจ sha256 ทีละไฟล์) ต่อกัน แล้วตรวจ sha256 ของทั้งก้อนตาม manifest ก่อน init
whole="$tmp/pdfcraft_app_bg.wasm"
cap=$((24 * 1024 * 1024))
size="$(stat -c %s "$whole")"
n=$(( (size + cap - 1) / cap ))
chunk=$(( (size + n - 1) / n ))
for i in $(seq 1 "$n"); do
  dd if="$whole" of="$out/pdfcraft_app_bg.$i.wasm" bs="$chunk" skip=$((i - 1)) count=1 status=none
done
# license ตามต้นฉบับ (ไม่แก้ข้อความ) + OFL ของฟอนต์ที่ฝังใน wasm (ตามแบบ packaging/env.sh copy_font_licences)
cp "$src/LICENSE-MIT" "$out/LICENSE-MIT"
cp "$src/NOTICE" "$out/NOTICE.txt"
cp "$src/ATTRIBUTION.md" "$out/ATTRIBUTION.md"
# เฉพาะฟอนต์ที่ build.rs ของ crates/fonts ฝังใน wasm32 (BIZ UDPGothic Regular + หน้าฟอนต์ที่มีสคริปต์ Arab/Telu/Hebr/Thai)
awk -F' [|] ' '!/^#/ && NF >= 4 && (($1 == "BIZ UDPGothic" && $2 == "Regular") || $4 ~ /(^|,) *(Arab|Telu|Hebr|Thai) *(,|$)/) { print $3 }' \
  "$fonts/fonts/manifest.txt" | while read -r f; do d="$(basename "$(dirname "$f")")"; cp "$fonts/fonts/$d/OFL.txt" "$out/OFL-$d.txt"; done
[ -f "$out/OFL-noto-sans-thai.txt" ] || { echo "ไม่มี OFL ของ Noto Sans Thai" >&2; exit 1; }
node "$here/third-party.mjs" "$src" > "$out/THIRD-PARTY.txt"
node "$here/manifest.mjs" "$root" "$out" "$whole" "$REV" "$FONTS_REV" "$(rustc "+$RUST" --version)" "wasm-bindgen $have" "$optver"
ls -l "$out"
echo "→ $out"
