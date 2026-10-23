#!/usr/bin/env bash
# build GridCraft recalc (wasm) → vendor/gridcraft/ ของเว็บ
# ต้องมี: rustup (rust-toolchain.toml ติดตั้ง 1.97.0 + wasm32 ให้เอง), node,
#         wasm-bindgen-cli เวอร์ชันเดียวกับ Cargo.lock (cargo install wasm-bindgen-cli --version <เลข> --locked)
# ไม่บังคับ: wasm-opt (binaryen) — ไม่มี = ข้าม -Oz (ไฟล์ใหญ่ขึ้น), WASM_OPT=<path> ชี้ตัวที่ติดตั้งไว้ที่อื่นได้
# หลัง build: bump CACHE ใน sw.js + รัน tests/repo-guards.mjs + tests/compare.spec.js
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
out="$root/vendor/gridcraft"
target="${CARGO_TARGET_DIR:-$here/target}"
export CARGO_TARGET_DIR="$target"
cd "$here"

rev="$(sed -n 's/.*rev = "\([0-9a-f]\{40\}\)".*/\1/p' Cargo.toml | head -1)"
wbg="$(awk '/^name = "wasm-bindgen"$/ { getline; gsub(/version = |"/, ""); print; exit }' Cargo.lock)"
command -v wasm-bindgen >/dev/null || { echo "ไม่พบ wasm-bindgen — cargo install wasm-bindgen-cli --version $wbg --locked" >&2; exit 1; }
have="$(wasm-bindgen --version | awk '{ print $2 }')"
[ "$have" = "$wbg" ] || { echo "wasm-bindgen $have ไม่ตรงกับ Cargo.lock ($wbg)" >&2; exit 1; }

cargo build --release --locked --target wasm32-unknown-unknown

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
wasm-bindgen --target no-modules --no-typescript --out-dir "$tmp" --out-name gridcraft_recalc \
  "$target/wasm32-unknown-unknown/release/gridcraft_recalc.wasm"

opt="${WASM_OPT:-$(command -v wasm-opt || true)}"
optver=""
if [ -n "$opt" ]; then
  # ฟีเจอร์ที่ rustc 1.97 เปิดให้ wasm32-unknown-unknown เป็นค่าเริ่มต้น (Safari 15+) — ไม่เปิดเพิ่ม
  "$opt" -Oz --strip-debug --strip-producers \
    --enable-bulk-memory --enable-mutable-globals --enable-sign-ext --enable-nontrapping-float-to-int \
    --enable-multivalue --enable-reference-types \
    "$tmp/gridcraft_recalc_bg.wasm" -o "$tmp/opt.wasm"
  mv "$tmp/opt.wasm" "$tmp/gridcraft_recalc_bg.wasm"
  optver="$("$opt" --version)"
else
  echo "ไม่มี wasm-opt — ข้าม -Oz" >&2
fi

mkdir -p "$out"
cp "$tmp/gridcraft_recalc.js" "$tmp/gridcraft_recalc_bg.wasm" "$out/"
src="$(cargo metadata --format-version 1 --locked | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const p = JSON.parse(s).packages.find((x) => x.name === "gridcraft-xlsx");
    process.stdout.write(require("path").resolve(p.manifest_path, "../../.."));
  });')"
# บรรทัดลิขสิทธิ์ตามต้นฉบับ (ไม่แก้ข้อความ)
cp "$src/LICENSE-MIT" "$out/LICENSE-MIT"
node "$here/third-party.mjs" > "$out/THIRD-PARTY.txt"
node "$here/manifest.mjs" "$out" "$rev" "$(rustc --version)" "wasm-bindgen $have" "$optver"
echo "→ $out"
