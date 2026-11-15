// Worker ของ iapp-dec-test.html: mode 'prefill' (vision → KV 10 ชั้น) และ 'decode' (วนสร้างโทเค็นด้วย KV cache) — แต่ละ mode รันใน Worker ใหม่แล้วหน้าหลัก terminate ทิ้ง
// ข้อมูล fp16 เป็น Uint16Array (บิตดิบ) ทั้งขาเข้าและขาออก · ไฟล์ทดสอบ ไม่เกี่ยวกับหน้าเว็บอื่น
import * as ort from '../../vendor/transformers/ort.webgpu.bundle.min.mjs';
const log = (m) => postMessage({ log: m });
function f16ToF32(h) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}
const asU16 = (d) => (d instanceof Uint16Array ? d : new Uint16Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength)));
const toF32 = (d) => (d instanceof Uint16Array ? Float32Array.from(d, f16ToF32) : Float32Array.from(d));
const ts = (data, dims) => new ort.Tensor('float16', data, dims);

async function decode3(e) {
  // decode แบบแบ่ง 3 session (a: ชั้น 0–4, b: ชั้น 5–9, head) — สร้างทีละตัว (ลดช่วงพีค) แล้วถือไว้ทั้งสามตลอดลูป · แถว embedding อ่านจากไฟล์ตารางทีละแถว (ไม่เก็บตารางในหน่วยความจำ)
  const { files, opts, wasmPaths, table, gpuKV, fakeEmb, isStatic } = e.data;
  ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = wasmPaths;
  const sess = [];
  for (const [i, f] of files.entries()) {
    log(`Worker(decode3): ก้อน ${'ab'[i] || 'head'} (${(f.size / 2 ** 20).toFixed(0)} MiB): อ่านไฟล์แล้วเรียก create …`);
    const t0 = performance.now();
    const o2 = { ...opts };
    if (gpuKV && i < 2) { const loc = {}; for (let k = 0; k < 5; k++) { loc[`present_k${k}`] = 'gpu-buffer'; loc[`present_v${k}`] = 'gpu-buffer'; } o2.preferredOutputLocation = loc; }   // KV ใหม่อยู่บน GPU ไม่คัดลอกกลับ CPU
    sess.push(await ort.InferenceSession.create(new Uint8Array(await f.arrayBuffer()), o2));
    log(`Worker(decode3): ก้อน ${'ab'[i] || 'head'} create สำเร็จ ${((performance.now() - t0) / 1000).toFixed(1)} วิ`);
    await new Promise((r) => setTimeout(r, e.data.slowMs || 200));
  }
  let { kv, first, n, eos } = e.data;
  let lmax = 0, M0 = kv[0].dims[2];
  if (isStatic) {   // decode ขนาดคงที่: KV เต็ม lmax ตลอด (เติมศูนย์ท้าย) · lmax อ่านจากรูปทรงอินพุต past_k0 (ลำดับที่ 3: x, onehot, mask, past…)
    lmax = sess[0].inputMetadata[3].shape[2];
    log(`Worker(decode3): โหมดขนาดคงที่ lmax=${lmax} · prefill ยาว ${M0}`);
    if (n + M0 > lmax) { n = lmax - M0; log(`⚠️ จำกัดจำนวนโทเค็นเหลือ ${n} (เต็ม lmax)`); }
    kv = kv.map((x) => { const [b, h, L, d] = x.dims, o = new Uint16Array(h * lmax * d); for (let i = 0; i < h; i++) o.set(x.data.subarray(i * L * d, (i + 1) * L * d), i * lmax * d); return { data: o, dims: [b, h, lmax, d] }; });
  }
  let kva = kv.slice(0, kv.length / 2), kvb = kv.slice(kv.length / 2);
  const [sa, sb, sh] = sess, toks = [], times = []; let cur = first;
  const run = async (s, x, past, extra) => {
    const off = isStatic ? 3 : 1;
    const feeds = { [s.inputNames[0]]: x };
    if (isStatic) { feeds[s.inputNames[1]] = extra.onehot; feeds[s.inputNames[2]] = extra.mask; }
    for (let j = 0; j < past.length; j++) feeds[s.inputNames[j + off]] = past[j] instanceof ort.Tensor ? past[j] : ts(past[j].data, past[j].dims);
    const o = await s.run(feeds); const hid = o[s.outputNames[0]];
    for (const p of past) if (p instanceof ort.Tensor && p.location === 'gpu-buffer') p.dispose();   // KV เก่าบน GPU ใช้เสร็จแล้ว
    const next = [];
    for (let j = 1; j < s.outputNames.length; j++) { const t = o[s.outputNames[j]]; next.push(gpuKV ? t : { data: asU16(await t.getData()), dims: t.dims }); }
    return { hid: { data: asU16(await hid.getData()), dims: hid.dims }, kv: next };
  };
  for (let i = 0; i < n; i++) {
    const t1 = performance.now();
    const row = fakeEmb ? new Uint16Array(1024).fill(0x2400 + (cur & 0xff)) : new Uint16Array(await table.slice(cur * 2048, (cur + 1) * 2048).arrayBuffer());   // fakeEmb = วินิจฉัย: ไม่อ่านไฟล์ตาราง
    let extra = null;
    if (isStatic) {   // ตำแหน่งที่เขียน = M0 + i · one-hot (fp16 1.0 = 0x3C00) และ mask (0 = ใช้ได้, -1e4 = 0xF0E2)
      const pos = M0 + i, oh = new Uint16Array(lmax), mk = new Uint16Array(lmax).fill(0xF0E2);
      oh[pos] = 0x3C00; mk.fill(0, 0, pos + 1);
      extra = { onehot: ts(oh, [1, 1, lmax, 1]), mask: ts(mk, [1, 1, 1, lmax]) };
    }
    const ra = await run(sa, ts(row, [1, 1, 1024]), kva, extra); kva = ra.kv;
    const rb = await run(sb, ts(ra.hid.data, ra.hid.dims), kvb, extra); kvb = rb.kv;
    const lo = await sh.run({ [sh.inputNames[0]]: ts(rb.hid.data, rb.hid.dims) });
    const lg = toF32(await lo[sh.outputNames[0]].getData());
    let best = 0, bv = -Infinity, bad = 0;
    for (let j = 0; j < lg.length; j++) { const v = lg[j]; if (!Number.isFinite(v)) bad++; else if (v > bv) { bv = v; best = j; } }
    cur = best; toks.push(cur); times.push(performance.now() - t1);
    if (bad) log(`⚠️ logits มี NaN/Inf ${bad} ค่า (ก้าว ${i})`);
    if (i < 16 || (i + 1) % 8 === 0) log(`  ก้าว ${i + 1}/${n}: โทเค็น ${cur} · ${times[i].toFixed(0)} ms · KV ยาว ${kva[0].dims[2]}`);
    if (i < 16 && e.data.slowMs > 1000) await new Promise((r) => setTimeout(r, 1500));   // 16 ก้าวแรก: รอให้ log ลงดิสก์ทัน เพื่อรู้ว่าเด้งที่ก้าวไหน
    if (cur === eos) break;
  }
  postMessage({ tokens: toks, times });
}

onmessage = async (e) => {
  if (e.data.mode === 'decode3') { try { await decode3(e); } catch (err) { postMessage({ error: String(err?.message || err) }); } return; }
  const { mode, file, opts, wasmPaths } = e.data;
  try {
    ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = wasmPaths;
    log(`Worker(${mode}): อ่านไฟล์ ${(file.size / 2 ** 20).toFixed(0)} MiB …`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    log(`Worker(${mode}): เรียก create …`);
    let t0 = performance.now();
    const s = await ort.InferenceSession.create(bytes, opts);
    log(`Worker(${mode}): create สำเร็จ ${((performance.now() - t0) / 1000).toFixed(1)} วิ`);
    await new Promise((r) => setTimeout(r, 200));
    if (mode === 'prefill') {
      t0 = performance.now();
      const o = await s.run({ vision: ts(e.data.vision.data, e.data.vision.dims) });
      const kv = [];
      for (const n of s.outputNames) { const t = o[n]; kv.push({ data: asU16(await t.getData()), dims: t.dims }); }
      log(`Worker(prefill): run ${((performance.now() - t0) / 1000).toFixed(1)} วิ · KV ${kv.length} ก้อน dims ${kv[0].dims.join('x')}`);
      postMessage({ kv }, kv.map((x) => x.data.buffer));
      return;
    }
    // decode
    let { kv, first, n, eos } = e.data;
    const inNames = s.inputNames, outNames = s.outputNames;   // inNames[0]=token, [1..]=past_k0,past_v0,… · outNames[0]=logits
    const toks = [], times = []; let cur = first;
    for (let i = 0; i < n; i++) {
      const t1 = performance.now();
      const feeds = { [inNames[0]]: new ort.Tensor('int64', BigInt64Array.from([BigInt(cur)]), [1]) };
      for (let j = 0; j < kv.length; j++) feeds[inNames[j + 1]] = ts(kv[j].data, kv[j].dims);
      const o = await s.run(feeds);
      const lg = toF32(await o[outNames[0]].getData());
      let best = 0, bv = -Infinity, bad = 0;
      for (let j = 0; j < lg.length; j++) { const v = lg[j]; if (!Number.isFinite(v)) bad++; else if (v > bv) { bv = v; best = j; } }
      const nk = [];
      for (let j = 1; j < outNames.length; j++) { const t = o[outNames[j]]; nk.push({ data: asU16(await t.getData()), dims: t.dims }); }
      kv = nk; cur = best; toks.push(cur); times.push(performance.now() - t1);
      if (bad) log(`⚠️ logits มี NaN/Inf ${bad} ค่า (ก้าว ${i})`);
      if (i === 0 || (i + 1) % 8 === 0) log(`  ก้าว ${i + 1}/${n}: โทเค็น ${cur} · ${times[i].toFixed(0)} ms · KV ยาว ${kv[0].dims[2]}`);
      if (cur === eos) break;
    }
    postMessage({ tokens: toks, times });
  } catch (err) { postMessage({ error: String(err?.message || err) }); }
};
