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

onmessage = async (e) => {
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
