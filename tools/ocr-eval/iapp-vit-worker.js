// Worker สำหรับ iapp-vit-test.html โหมด "แยก Worker ต่อก้อน": สร้าง → รัน → ส่งผลกลับ แล้วหน้าหลัก terminate() ทิ้ง เพื่อให้ GPU device/หน่วยความจำของก้อนนั้นถูกคืนจริง
// (session.release() ไม่การันตีว่า buffer ของ WebGPU ถูกคืนบน iPhone) — ไฟล์ทดสอบ ไม่เกี่ยวกับหน้าเว็บอื่น
import * as ort from '../../vendor/transformers/ort.webgpu.bundle.min.mjs';
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const log = (m) => postMessage({ log: m });
onmessage = async (e) => {
  const { file, opts, wasmPaths, seed, hidden, nFallback } = e.data;
  try {
    ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = wasmPaths;
    log('Worker: อ่านไฟล์ …');
    const bytes = new Uint8Array(await file.arrayBuffer());
    log('Worker: เรียก create …');
    const s = await ort.InferenceSession.create(bytes, opts);
    log('Worker: create สำเร็จ');
    let feeds;
    if (hidden) feeds = { [s.inputNames[0]]: new ort.Tensor('float32', hidden.data, hidden.dims) };
    else {
      const sh = s.inputMetadata?.[0]?.shape?.[0]; const N = sh > 0 ? sh : nFallback;
      const r = mulberry32(seed), patches = new Float32Array(N * 768), pos = new Float32Array(N * 1152);
      for (let i = 0; i < patches.length; i++) patches[i] = r() * 2 - 1;
      for (let i = 0; i < pos.length; i++) pos[i] = (r() * 2 - 1) * 0.1;
      feeds = { patches: new ort.Tensor('float32', patches, [N, 768]), pos: new ort.Tensor('float32', pos, [1, N, 1152]) };
    }
    await new Promise((r) => setTimeout(r, 200));
    log('Worker: เรียก run …');
    const o = await s.run(feeds); const t = o[s.outputNames[0]];
    const data = Float32Array.from(await t.getData());
    postMessage({ out: { data, dims: t.dims } }, [data.buffer]);
  } catch (err) { postMessage({ error: String(err?.message || err) }); }
};
