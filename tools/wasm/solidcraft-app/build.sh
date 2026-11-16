#!/usr/bin/env bash
# build SolidCraft แบบโปรแกรมเต็ม (apps/solidcraft-web, egui/eframe + wgpu → wasm) — ROADMAP แถว 11e
# ขั้น A (ตอนนี้): build ทดลองเพื่อวัดขนาด/ความเร็ว → tools/wasm/solidcraft-app/target/out-<profile>/ (ไม่แตะ vendor/ หรือ manifest)
# ขั้น B (เมื่อเจ้าของสั่งต่อ): OUT=vendor → vendor/craft/solidcraft-app-<commit 7>/ + manifest (แบบ tools/wasm/cadcraft-app)
#
# ต่างจาก PdfCraft/CADCraft: **ไม่มี patch ไม่แก้หน้าตา/ไอคอน/ธีม/ชื่อ** — LICENSE-BRAND ของ SolidCraft (ui-kit, look, theme,
# branding = Brand Material) อนุญาตให้ build และรันตัว SolidCraft เอง แต่การแจกจ่ายรุ่นที่แก้ไขภายใต้ชื่อ/หน้าตา SolidCraft
# ต้องขออนุญาตก่อน · ซอร์สใช้ตาม tag ไม่แก้ไฟล์ใดๆ
#
# PROFILE=upstream (ค่าเริ่มต้น) = [profile.release] ของต้นฉบับ (opt 3 + thin LTO + 16 CGU + line tables) + wasm-opt -Oz แบบ trunk
# PROFILE=small = opt-level z + fat LTO + 1 CGU + ไม่มี line tables (แบบ cadcraft-app; ปรับผ่านตัวแปรของ cargo ไม่แก้ซอร์ส)
#   ⚠ ยังไม่ได้ตัดสินว่า build ที่เปลี่ยน profile นับเป็น "modified build" ตาม LICENSE-BRAND ข้อ 3c หรือไม่ — ถามเจ้าของก่อนใช้จริง
#
# ต้องมี: rustup (ติดตั้ง rust ตาม rust-toolchain.toml + wasm32 ให้เอง), git, node,
#         wasm-bindgen-cli เวอร์ชันเดียวกับ Cargo.lock (cargo install wasm-bindgen-cli --version <เลข> --locked)
# ไม่บังคับ: wasm-opt (binaryen ≥ 132) — WASM_OPT=<path>; ไม่มี = ข้าม -Oz (ไฟล์ใหญ่ขึ้น)
# ซอร์ส ~900 MB (git depth 1) + target ของ cargo หลาย GB · fat LTO บนเครื่อง 4 core/16 GB ใช้เวลานาน (ชั่วโมง+)
# build ซ้ำได้ไบต์เดิมเฉพาะวันเดียวกัน: crates/ui-egui/build.rs ฝัง SOLIDCRAFT_BUILD_DATE จากนาฬิกาเครื่อง (ไม่อ่าน SOURCE_DATE_EPOCH)
#   ขั้น B ต้องหาทางตรึง (เช่น faketime) — ห้ามแก้ซอร์ส
set -euo pipefail

TAG=v0.43.0
REV=8ba46e9e2181396a9b5903b98031399aef61cf26   # SolidCraft v0.43.0 (release ล่าสุดที่ไม่ใช่ nightly, 2026-11-16)
PROFILE="${PROFILE:-upstream}"

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
work="$here/target"
src="$work/src/solidcraft"
out="$work/out-$PROFILE"
mkdir -p "$work/src"

[ -d "$src/.git" ] || git init -q "$src"
# ซอร์ส ~900 MB — การดาวน์โหลดหลุดกลางทางได้ จึงลองซ้ำ
for i in 1 2 3 4 5; do
  git -C "$src" fetch -q --depth 1 https://github.com/tangency-labs/solidcraft "$REV" && break
  [ "$i" = 5 ] && { echo "ดาวน์โหลดซอร์สไม่สำเร็จ" >&2; exit 1; }
  sleep $((i * 10))
done
git -C "$src" checkout -q --force FETCH_HEAD
git -C "$src" clean -qfdx
[ "$(git -C "$src" rev-parse HEAD)" = "$REV" ] || { echo "ซอร์สไม่ใช่ $REV ($TAG)" >&2; exit 1; }

rust="$(awk -F'"' '/^channel/ { print $2 }' "$src/rust-toolchain.toml")"
rustup toolchain install "$rust" --profile minimal --target wasm32-unknown-unknown >/dev/null
wbg="$(awk '/^name = "wasm-bindgen"$/ { getline; gsub(/version = |"/, ""); print; exit }' "$src/Cargo.lock")"
command -v wasm-bindgen >/dev/null || { echo "ไม่พบ wasm-bindgen — cargo install wasm-bindgen-cli --version $wbg --locked" >&2; exit 1; }
have="$(wasm-bindgen --version | awk '{ print $2 }')"
[ "$have" = "$wbg" ] || { echo "wasm-bindgen $have ไม่ตรงกับ Cargo.lock ($wbg)" >&2; exit 1; }

cargo_home="${CARGO_HOME:-$HOME/.cargo}"
export CARGO_TARGET_DIR="$work/cargo-$PROFILE"
export SOURCE_DATE_EPOCH="$(git -C "$src" log -1 --format=%ct)"
case "$PROFILE" in
  upstream) ;;
  small)
    export CARGO_PROFILE_RELEASE_OPT_LEVEL=z CARGO_PROFILE_RELEASE_LTO=fat CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1
    export CARGO_PROFILE_RELEASE_DEBUG=false ;;
  *) echo "PROFILE ต้องเป็น upstream|small" >&2; exit 1 ;;
esac
export RUSTFLAGS="--remap-path-prefix=$src=/solidcraft --remap-path-prefix=$cargo_home=/cargo --remap-path-prefix=$HOME/.rustup=/rustup"
start=$(date +%s)
(cd "$src" && cargo "+$rust" build --release --locked --target wasm32-unknown-unknown -p solidcraft-web)
echo "cargo build: $(( $(date +%s) - start )) วิ"

rm -rf "$out"
mkdir -p "$out"
# --weak-refs ตาม data-weak-refs ใน apps/solidcraft-web/index.html (trunk ของต้นฉบับ) · ชื่อไฟล์คงที่ (รุ่นอยู่ในชื่อโฟลเดอร์)
wasm-bindgen --target web --no-typescript --weak-refs --out-dir "$out" --out-name solidcraft_app \
  "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/solidcraft-web.wasm"

opt="${WASM_OPT:-$(command -v wasm-opt || true)}"
if [ -n "$opt" ]; then
  # ระดับเดียวกับ trunk ของต้นฉบับ (data-wasm-opt="z") · ฟีเจอร์ = ค่าเริ่มต้นของ rustc บน wasm32-unknown-unknown
  "$opt" -Oz --strip-debug --strip-producers \
    --enable-bulk-memory --enable-mutable-globals --enable-sign-ext --enable-nontrapping-float-to-int \
    --enable-multivalue --enable-reference-types \
    "$out/solidcraft_app_bg.wasm" -o "$out/opt.wasm"
  mv "$out/opt.wasm" "$out/solidcraft_app_bg.wasm"
else
  echo "ไม่มี wasm-opt — ข้าม -Oz" >&2
fi

# ฟอนต์ที่แอปโหลดเองตอนเลือกภาษาญี่ปุ่น/จีน/เกาหลี (apps/solidcraft-web/src/main.rs "./fonts/…") — OFL-1.1 ไม่ใช่ Brand Material
mkdir -p "$out/fonts"
for d in biz-udp-gothic craft-ui-sc craft-ui-tc craft-ui-kr; do
  cp "$src/assets/fonts/$d/"*.[ot]tf "$out/fonts/"
  cp "$src/assets/fonts/$d/OFL.txt" "$out/fonts/OFL-$d.txt"
done
# license ตามต้นฉบับ ไม่แก้ข้อความ
for f in LICENSE-MIT LICENSE-APACHE LICENSE-BRAND NOTICE ATTRIBUTION.md THIRD-PARTY-LICENSES.txt; do cp "$src/$f" "$out/"; done

node - "$out" <<'JS'
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const dir = process.argv[2], cap = 24 * 1024 * 1024;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
let raw = 0, br = 0;
for (const f of walk(dir).sort()) {
  const b = fs.readFileSync(f), c = /\.(wasm|js|[ot]tf)$/.test(f) ? zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }).length : b.length;
  raw += b.length; br += c;
  console.log(`${(b.length / 2 ** 20).toFixed(2).padStart(8)} MiB  br ${(c / 2 ** 20).toFixed(2).padStart(7)} MiB  ${path.relative(dir, f)}`);
}
const w = fs.statSync(path.join(dir, 'solidcraft_app_bg.wasm')).size;
console.log(`รวม ${(raw / 2 ** 20).toFixed(1)} MiB · brotli ${(br / 2 ** 20).toFixed(1)} MiB · wasm ต้องแบ่ง ${Math.ceil(w / cap)} ส่วน (≤ 24 MiB)`);
JS
echo "→ $out"
