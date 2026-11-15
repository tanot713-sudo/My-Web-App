// node iapp-pre.test.mjs <โฟลเดอร์ fixtures จาก make_iapp_pre_fixtures.py> — resize ต้องตรง PIL ทุกบิต · patch/pos ต้องตรง torch ในความคลาดเคลื่อน float32
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('./iapp-pre.js');
const dir = process.argv[2], man = JSON.parse(readFileSync(dir + '/manifest.json', 'utf8'));
const u8 = (f) => new Uint8Array(readFileSync(f)), f32 = (f) => { const b = readFileSync(f); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
let bad = 0;
const table = f32(dir + '/pos_table.f32');
for (const c of man.cases) {
  if (c.kind === 'resize') {
    const got = P.resize(u8(`${dir}/${c.name}.in`), c.w, c.h, c.ow, c.oh, c.filter), exp = u8(`${dir}/${c.name}.out`);
    let d = 0, mx = 0; for (let i = 0; i < exp.length; i++) if (got[i] !== exp[i]) { d++; mx = Math.max(mx, Math.abs(got[i] - exp[i])); }
    console.log(d ? '❌' : '✅', 'resize', c.filter, `${c.w}x${c.h}→${c.ow}x${c.oh}`, d ? `ต่าง ${d} ไบต์ (สูงสุด ${mx})` : 'ตรงทุกบิต'); if (d) bad++;
  } else {
    const r = P.prepare(u8(`${dir}/${c.name}.in`), c.w, c.h, table, 128, 128, c.C, {});
    const shape = r.canvasH === c.canvasH && r.canvasW === c.canvasW && r.contentH === c.contentH && r.contentW === c.contentW;
    const ep = f32(`${dir}/${c.name}.patches`), eq = f32(`${dir}/${c.name}.pos`);
    let mp = 0, mq = 0; for (let i = 0; i < ep.length; i++) mp = Math.max(mp, Math.abs(r.patches[i] - ep[i])); for (let i = 0; i < eq.length; i++) mq = Math.max(mq, Math.abs(r.pos[i] - eq[i]));
    const ok = shape && r.patches.length === ep.length && r.pos.length === eq.length && mp < 2e-5 && mq < 2e-4;
    console.log(ok ? '✅' : '❌', 'canvas', `${c.w}x${c.h}`, `→ ${r.canvasH}x${r.canvasW} content ${r.contentH}x${r.contentW} N=${r.N}`, `patch max|ต่าง| ${mp.toExponential(1)} · pos ${mq.toExponential(1)}`, shape ? '' : `(คาด ${c.canvasH}x${c.canvasW} content ${c.contentH}x${c.contentW})`); if (!ok) bad++;
  }
}
console.log(bad ? `❌ ผิด ${bad}` : '✅ ผ่านทั้งหมด'); process.exit(bad ? 1 : 0);
