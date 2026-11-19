#!/usr/bin/env bash
# build CADCraft แบบโปรแกรมเต็ม (apps/cadcraft-web, egui/eframe → wasm) → vendor/craft/cadcraft-app-<commit 7 ตัว><CRAFT_SUFFIX>/
# + ลงทะเบียนใน vendor/craft/manifest.json (libs["cadcraft-app"]) — หน้า cad-pro.html โหลดผ่าน craft-app.js
# แม่แบบเดียวกับ tools/wasm/pdfcraft-app/build.sh (ใช้ inline-snippets.mjs + third-party.mjs ของที่นั่นร่วมกัน)
# build จากซอร์สต้นฉบับที่ล็อก commit + patches/*.patch (เจ้าของสั่ง 2026-11):
#   - เอาเครื่องหมาย/ลิงก์ ArtCraft ออก (หน้า About: ลิงก์ getartcraft + Discord) → รุ่นที่แก้ไขแล้วต้องไม่มีเครื่องหมาย ArtCraft
#     (docs/brand/LICENSE-brand.txt "Forks and modified versions") · About บอกว่าเป็นรุ่นที่แก้ไข + CADCRAFT_BUILD_SHA=<commit>-tanot
#   - ซ่อน DWG (รุ่นเว็บไม่มีตัวอ่าน/เขียน DWG — acadrust ไม่ลิงก์บน wasm32): ตัวเลือกไฟล์ .dwg, Default Save Format › DWG,
#     ส่งออก dwg, ชื่อเมนู "DWG Reference…" → "DXF Reference…"
#   - คำแปลใน crates/ui-egui/src/i18n/*.tsv: ลบบรรทัดที่มี ArtCraft/Discord (ข้อความของส่วนที่เอาออก) ด้วย sed ด้านล่าง
# ต้องมี: rustup (ติดตั้ง rust ตาม RUST ด้านล่าง + wasm32 ให้เอง), git, node,
#         wasm-bindgen-cli เวอร์ชันเดียวกับ Cargo.lock ของ CADCraft (cargo install wasm-bindgen-cli --version <เลข> --locked)
# ไม่บังคับ: wasm-opt (binaryen 132) — WASM_OPT=<path>; ไม่มี = ข้าม -Oz (ไฟล์ใหญ่ขึ้น)
# ฟอนต์: craft-fonts ที่ commit เดียวกับรุ่นทางการ (.github/workflows/release.yml craft-fonts-ref) → CRAFT_FONTS_DIR
#        รุ่นเว็บฝังเฉพาะ BIZ UDPGothic Regular + หน้าฟอนต์ Arab/Geor + Thai Regular (crates/fonts/build.rs)
#   - เมนูภาษาไทย (ROADMAP 11c, patches/0002-thai-interface.patch): crates/ui-egui/src/i18n/th.tsv (คำแปลที่เราเขียนเอง)
#     + ลงทะเบียน "th" ใน i18n.rs + ฟอนต์ Thai ของ craft-fonts เข้าชุดฟอนต์หน้าจอ (theme.rs) — CADCraft ไม่ใช้ craft-i18n
# build ซ้ำได้ไบต์เดิม: ซอร์สอยู่ใต้ target/src และ path ถูก remap เป็น /cadcraft, /cargo (ไม่ขึ้นกับเครื่อง)
# path ที่ deploy แล้วห้ามเปลี่ยนเนื้อไฟล์ — build ใหม่จาก commit เดิมเปลี่ยน SUFFIX (ค่าเริ่มต้นด้านล่าง) แล้วลบโฟลเดอร์เก่า
# หลัง build: bump CACHE ใน sw.js + tests/cad-pro.spec.js
set -euo pipefail

REV=7526dc62c14e71b3c8d46e73bbf1fa29ef506af1        # CADCraft v0.20.1 — เจ้าของเลือก 2026-11-16 (ภาษาไทยในแบบ #2591)
FONTS_REV=b076417b5880bd4154bd22f00695b1d28c6bea83  # storytold/craft-fonts (ตาม .github/workflows/release.yml ของ REV)
RUST=1.97.0

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
shared="$here/../pdfcraft-app"
work="$here/target"
src="$work/src/cadcraft"
fonts="$work/src/craft-fonts"
SUFFIX="${CRAFT_SUFFIX--2}"                          # -2 = รุ่นที่มีเมนูไทย (ROADMAP 11c); รุ่นแรกไม่มี suffix
out="$root/vendor/craft/cadcraft-app-${REV:0:7}$SUFFIX"
mkdir -p "$work/src"

fetch() { # <url> <dir> <rev>
  [ -d "$2/.git" ] || git init -q "$2"
  git -C "$2" fetch -q --depth 1 "$1" "$3"
  git -C "$2" checkout -q --force FETCH_HEAD
  git -C "$2" clean -qfdx
  [ "$(git -C "$2" rev-parse HEAD)" = "$3" ] || { echo "$2 ไม่ใช่ $3" >&2; exit 1; }
}
fetch https://github.com/storytold/cadcraft "$src" "$REV"
fetch https://github.com/storytold/craft-fonts "$fonts" "$FONTS_REV"
grep -q "craft-fonts-ref: $FONTS_REV" "$src/.github/workflows/release.yml" || { echo "FONTS_REV ไม่ตรงกับ release.yml ของ CADCraft" >&2; exit 1; }
for p in "$here"/patches/*.patch; do git -C "$src" apply --whitespace=nowarn "$p"; done
sed -i -E '/ArtCraft|artcraft|Discord/d' "$src"/crates/ui-egui/src/i18n/*.tsv
# ห้ามเหลือไฟล์ของ docs/brand/ หรือลิงก์ ArtCraft ในซอร์สที่ลิงก์เข้า wasm (apps/cadcraft = แอปเดสก์ท็อป ไม่ได้ build)
! grep -rnI 'docs/brand/' "$src/crates" "$src/apps/cadcraft-web" | grep -v '/tests/' || { echo "ยังมีการฝังไฟล์ docs/brand/" >&2; exit 1; }
! grep -rnIi 'getartcraft\|discord\.gg' "$src/crates" "$src/apps/cadcraft-web" || { echo "ยังมีลิงก์ ArtCraft/Discord" >&2; exit 1; }
[ -f "$fonts/fonts/noto-sans-thai/NotoSansThai.ttf" ] || ls "$fonts"/fonts/*thai* >/dev/null 2>&1 || { echo "craft-fonts ไม่มีฟอนต์ไทย" >&2; exit 1; }

rustup toolchain install "$RUST" --profile minimal --target wasm32-unknown-unknown >/dev/null
wbg="$(awk '/^name = "wasm-bindgen"$/ { getline; gsub(/version = |"/, ""); print; exit }' "$src/Cargo.lock")"
command -v wasm-bindgen >/dev/null || { echo "ไม่พบ wasm-bindgen — cargo install wasm-bindgen-cli --version $wbg --locked" >&2; exit 1; }
have="$(wasm-bindgen --version | awk '{ print $2 }')"
[ "$have" = "$wbg" ] || { echo "wasm-bindgen $have ไม่ตรงกับ Cargo.lock ($wbg)" >&2; exit 1; }

cargo_home="${CARGO_HOME:-$HOME/.cargo}"
export CARGO_TARGET_DIR="$work/cargo"
export CRAFT_FONTS_DIR="$fonts" CRAFT_FONTS_REQUIRED=1
export SOURCE_DATE_EPOCH="$(git -C "$src" log -1 --format=%ct)"
export CADCRAFT_BUILD_SHA="${REV:0:9}-tanot"
# ขนาด (เจ้าของสั่ง 2026-11-16 "ลองลดขนาด"): release ของต้นฉบับคือ opt-level 3 + thin LTO + codegen-units 16 (wasm ~35 MiB)
# ที่นี่ปรับเฉพาะ profile ด้วยตัวแปรของ cargo (ไม่แก้ซอร์ส) — opt-level z + fat LTO + 1 codegen unit + panic=abort ไม่ได้ใช้ (eframe จับ panic เพื่อแสดงข้อผิดพลาด)
export CARGO_PROFILE_RELEASE_OPT_LEVEL="${CADCRAFT_OPT_LEVEL:-z}"
export CARGO_PROFILE_RELEASE_LTO="${CADCRAFT_LTO:-fat}"
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS="${CADCRAFT_CGU:-1}"
export RUSTFLAGS="--remap-path-prefix=$src=/cadcraft --remap-path-prefix=$fonts=/craft-fonts --remap-path-prefix=$cargo_home=/cargo --remap-path-prefix=$HOME/.rustup=/rustup"
(cd "$src" && cargo "+$RUST" build --release --locked --target wasm32-unknown-unknown -p cadcraft-web)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# --target web = ES module (craft-frame.js import จาก Blob URL); ชื่อไฟล์คงที่ — รุ่นอยู่ในชื่อโฟลเดอร์แทน hash ของ trunk
# --weak-refs ตาม data-weak-refs ใน apps/cadcraft-web/index.html (trunk ของต้นฉบับ)
wasm-bindgen --target web --no-typescript --weak-refs --out-dir "$tmp" --out-name cadcraft_app \
  "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/cadcraft-web.wasm"
node "$shared/inline-snippets.mjs" "$tmp" cadcraft_app.js

opt="${WASM_OPT:-$(command -v wasm-opt || true)}"
optver=""
if [ -n "$opt" ]; then
  # ระดับเดียวกับ trunk ของต้นฉบับ (data-wasm-opt="z") · ฟีเจอร์ = ค่าเริ่มต้นของ rustc 1.97 บน wasm32-unknown-unknown
  "$opt" -Oz --strip-debug --strip-producers \
    --enable-bulk-memory --enable-mutable-globals --enable-sign-ext --enable-nontrapping-float-to-int \
    --enable-multivalue --enable-reference-types \
    "$tmp/cadcraft_app_bg.wasm" -o "$tmp/opt.wasm"
  mv "$tmp/opt.wasm" "$tmp/cadcraft_app_bg.wasm"
  optver="$("$opt" --version)"
else
  echo "ไม่มี wasm-opt — ข้าม -Oz" >&2
fi
# รุ่นที่แก้ไขแล้วต้องไม่มีลิงก์ ArtCraft/Discord เหลือใน wasm
! LC_ALL=C grep -aqi 'getartcraft\|discord\.gg' "$tmp/cadcraft_app_bg.wasm" || { echo "wasm ยังมีลิงก์ ArtCraft/Discord" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out"
cp "$tmp/cadcraft_app.js" "$out/"
# Cloudflare Pages รับไฟล์ละ ≤ 25 MiB — wasm เกิน 24 MiB แบ่งเป็นส่วนเท่าๆ กัน (cadcraft_app_bg.<n>.wasm) แบบ pdfcraft-app
# ไม่เกิน = ไฟล์เดียว cadcraft_app_bg.wasm (craft-app.js loadWasm รับได้ทั้งสองแบบ)
whole="$tmp/cadcraft_app_bg.wasm"
cap=$((24 * 1024 * 1024))
size="$(stat -c %s "$whole")"
if [ "$size" -le "$cap" ]; then
  cp "$whole" "$out/cadcraft_app_bg.wasm"
else
  n=$(( (size + cap - 1) / cap ))
  chunk=$(( (size + n - 1) / n ))
  for i in $(seq 1 "$n"); do
    dd if="$whole" of="$out/cadcraft_app_bg.$i.wasm" bs="$chunk" skip=$((i - 1)) count=1 status=none
  done
fi
# license ตามต้นฉบับ (ไม่แก้ข้อความ) + OFL ของฟอนต์ที่ฝังใน wasm (ตามเงื่อนไขเดียวกับ crates/fonts/build.rs บน wasm32)
cp "$src/LICENSE-MIT" "$out/LICENSE-MIT"
cp "$src/NOTICE" "$out/NOTICE.txt"
cp "$src/ATTRIBUTION.md" "$out/ATTRIBUTION.md"
awk -F' [|] ' '!/^#/ && NF >= 4 {
    s = "," $4 ","; gsub(/ /, "", s)
    if (($1 == "BIZ UDPGothic" && $2 == "Regular") || s ~ /,Arab,/ || s ~ /,Geor,/ || (s ~ /,Thai,/ && $2 == "Regular")) print $3
  }' "$fonts/fonts/manifest.txt" | while read -r f; do d="$(basename "$(dirname "$f")")"; cp "$fonts/fonts/$d/OFL.txt" "$out/OFL-$d.txt"; done
ls "$out"/OFL-*thai*.txt >/dev/null 2>&1 || { echo "ไม่มี OFL ของฟอนต์ไทย" >&2; exit 1; }
node "$shared/third-party.mjs" "$src" cadcraft > "$out/THIRD-PARTY.txt"
node "$here/manifest.mjs" "$root" "$out" "$whole" "$REV" "$FONTS_REV" "$(awk '/^\[/ { p = ($0 == "[workspace.package]"); next } p && $1 == "version" { gsub(/[" ]/, "", $3); print $3; exit }' "$src/Cargo.toml")" "$(rustc "+$RUST" --version)" "wasm-bindgen $have" "$optver"
ls -l "$out"
echo "→ $out"
