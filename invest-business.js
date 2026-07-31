/* ══════════════════════════════════════════════════════════════════
   Tanot — ลงทุนทำธุรกิจ (รายได้เสริม/ธุรกิจส่วนตัว)
   • เครื่องคำนวณจุดคุ้มทุน (breakeven) + ระยะเวลาคืนทุน
   • เช็กลิสต์ "พร้อมเริ่มหรือยัง?" (เงินสำรอง/สัญญาจ้าง/เวลา/ทุน/ใบอนุญาต)
   • บันทึกไอเดียที่กำลังพิจารณาไว้เทียบกัน เก็บใน localStorage
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือกฎหมาย
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:bizplan';
  var MARGIN_OK = 1.2; /* เผื่อกันชนอย่างน้อย ~20% เหนือจุดคุ้มทุนถึงจะถือว่า "เขียว" */

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ── เครื่องคำนวณจุดคุ้มทุน (pure — reuse ได้ทั้งการ์ดคำนวณและตอนบันทึกไอเดีย) ── */
  function computeBreakeven(o) {
    var startup = isFinite(o.startup) ? o.startup : 0;
    var fixed = Math.max(0, isFinite(o.fixed) ? o.fixed : 0);
    var price = o.price, varCost = isFinite(o.varCost) ? o.varCost : 0, vol = o.vol;
    var r = { profitPerUnit: NaN, breakevenUnits: NaN, monthlyProfitAtVol: NaN, paybackMonths: NaN, ratio: NaN, cls: 'warn', txt: '' };

    if (!isFinite(price) || price <= 0) { r.txt = 'กรอกราคาขายเฉลี่ยต่อหน่วยให้ถูกต้องก่อน'; return r; }

    r.profitPerUnit = price - varCost;
    if (r.profitPerUnit <= 0) {
      r.cls = 'no';
      r.txt = 'ราคาขาย (' + fmt(price) + ') ต้องสูงกว่าต้นทุนผันแปรต่อหน่วย (' + fmt(varCost) + ') ไม่งั้นยิ่งขายยิ่งขาดทุน — ไม่มีจุดคุ้มทุน';
      return r;
    }
    r.breakevenUnits = fixed / r.profitPerUnit;

    if (!isFinite(vol)) {
      r.cls = 'warn';
      r.txt = 'กรอกปริมาณขายที่คาดหวังต่อเดือน เพื่อประเมินว่าคุ้มไหม (จุดคุ้มทุน ≈ ' + (r.breakevenUnits <= 0 ? 'ตั้งแต่หน่วยแรก' : fmt(r.breakevenUnits, 1) + ' หน่วย/เดือน') + ')';
      return r;
    }

    r.monthlyProfitAtVol = vol * r.profitPerUnit - fixed;
    if (r.monthlyProfitAtVol > 0) { r.paybackMonths = startup <= 0 ? 0 : startup / r.monthlyProfitAtVol; }

    if (r.breakevenUnits <= 0) {
      /* ต้นทุนคงที่ 0 (หรือคุ้มทุนตั้งแต่หน่วยแรก) */
      if (vol > 0) { r.cls = 'go'; r.ratio = Infinity; r.txt = 'ต้นทุนคงที่ต่ำมาก/เป็นศูนย์ คุ้มทุนตั้งแต่หน่วยแรก และคาดขายได้ ' + fmt0(vol) + ' หน่วย/เดือน — มีกำไรที่ปริมาณนี้'; }
      else { r.cls = 'no'; r.txt = 'ปริมาณขายที่คาดเป็น 0 — ยังไม่มีกำไร'; }
      return r;
    }

    r.ratio = vol / r.breakevenUnits;
    if (r.ratio < 1) {
      r.cls = 'no';
      r.txt = 'ปริมาณขายที่คาด (' + fmt0(vol) + ' หน่วย) ยังไม่ถึงจุดคุ้มทุน (' + fmt(r.breakevenUnits, 1) + ' หน่วย) — ขาดทุน ~' + baht(Math.abs(r.monthlyProfitAtVol)) + '/เดือนที่ปริมาณนี้';
    } else if (r.ratio < MARGIN_OK) {
      r.cls = 'warn';
      r.txt = 'คุ้มทุนพอดีๆ (เกินจุดคุ้มทุน ' + fmt((r.ratio - 1) * 100, 0) + '%) กำไรเล็กน้อย เผื่อความผันผวนของยอดขายไม่ค่อยได้';
    } else {
      r.cls = 'go';
      r.txt = 'ปริมาณขายที่คาดเกินจุดคุ้มทุนพอสมควร (+' + fmt((r.ratio - 1) * 100, 0) + '%) มีกันชนไว้บ้าง';
    }
    return r;
  }

  function doCalc() {
    var price = num($('bzPrice').value);
    if (!isFinite(price) || price <= 0) { alert('กรอกราคาขายเฉลี่ยต่อหน่วยให้ถูกต้อง'); return; }
    var o = {
      startup: num($('bzStartup').value) || 0,
      fixed: num($('bzFixed').value) || 0,
      price: price,
      varCost: num($('bzVar').value) || 0,
      vol: num($('bzVol').value)
    };
    var r = computeBreakeven(o);
    $('bzOut').style.display = 'block';

    $('bzProfitUnit').textContent = isFinite(r.profitPerUnit) ? baht(r.profitPerUnit) : '—';
    $('bzBreakeven').textContent = !isFinite(r.breakevenUnits) ? '—' : (r.breakevenUnits <= 0 ? 'ตั้งแต่หน่วยแรก' : fmt(r.breakevenUnits, 1));

    var projEl = $('bzProjected');
    if (isFinite(r.monthlyProfitAtVol)) {
      projEl.textContent = (r.monthlyProfitAtVol >= 0 ? '+' : '−') + baht(Math.abs(r.monthlyProfitAtVol));
      projEl.style.color = r.monthlyProfitAtVol >= 0 ? 'var(--ok)' : 'var(--err)';
    } else { projEl.textContent = '—'; projEl.style.color = ''; }

    $('bzPayback').textContent = isFinite(r.paybackMonths) ? (r.paybackMonths <= 0 ? 'ทันที' : fmt(r.paybackMonths, 1) + ' เดือน') : '—';

    var v = $('bzVerdict');
    v.className = 'verdict-box ' + r.cls;
    v.innerHTML = (r.cls === 'go' ? '🟢 ' : r.cls === 'no' ? '🔴 ' : '🟡 ') + r.txt;
  }

  /* ── เช็กลิสต์ "พร้อมเริ่มหรือยัง?" ── */
  var bzAnswers = { emergency: null, contract: null, time: null, license: null };

  function checklistChecks() {
    var checks = [];
    function ynCheck(key, txt) {
      var v = bzAnswers[key];
      checks.push({ ok: v === 'yes' ? true : v === 'no' ? false : null, txt: txt });
    }
    ynCheck('emergency', 'มีเงินสำรองฉุกเฉินอย่างน้อย 3–6 เดือนของค่าใช้จ่าย (ไม่นับเงินลงทุน)');
    ynCheck('contract', 'เช็คสัญญาจ้างงานปัจจุบันเรื่อง non-compete/ผลประโยชน์ทับซ้อนแล้ว');
    ynCheck('time', 'มีเวลาจริงเพียงพอต่อสัปดาห์ นอกเหนือจากงานประจำ');

    var startup = num($('bzStartup').value), own = num($('bzOwnCapital').value);
    if (!isFinite(startup) || !isFinite(own)) {
      checks.push({ ok: null, txt: 'ทุนเริ่มต้นครอบคลุมไหม — กรอกเงินลงทุนเริ่มต้น (การ์ดด้านบน) และทุนที่มีอยู่จริงก่อน' });
    } else {
      var okCap = own >= startup;
      checks.push({ ok: okCap, txt: okCap ? ('ทุนที่มีอยู่จริง (' + baht(own) + ') ครอบคลุมเงินลงทุนเริ่มต้น (' + baht(startup) + ')') : ('ทุนที่มีอยู่จริง (' + baht(own) + ') ยังไม่พอเงินลงทุนเริ่มต้น (' + baht(startup) + ')') });
    }

    ynCheck('license', 'ธุรกิจนี้ไม่ต้องมีใบอนุญาต/คุณสมบัติเฉพาะ หรือมีครบแล้ว');
    return checks;
  }

  function doChecklist() {
    var checks = checklistChecks();
    var fails = checks.filter(function (c) { return c.ok === false; }).length;
    var unknowns = checks.filter(function (c) { return c.ok === null; }).length;
    var box = $('bzChkResult'), v = $('bzChkVerdict');
    if (fails > 0) { v.className = 'verdict-box no'; v.textContent = '⛔ ยังไม่พร้อม — ติด ' + fails + ' ข้อ ควรแก้ให้ครบก่อนเริ่ม'; }
    else if (unknowns > 0) { v.className = 'verdict-box warn'; v.textContent = '⚠️ ตอบให้ครบก่อนประเมิน — เหลือ ' + unknowns + ' ข้อ'; }
    else { v.className = 'verdict-box go'; v.textContent = '✅ พร้อมเริ่มได้ตามเกณฑ์ — ผ่านครบทุกข้อ (แต่ยังไม่การันตีความสำเร็จ)'; }
    var html = '';
    checks.forEach(function (c) {
      var ic = c.ok === true ? '✅' : c.ok === false ? '❌' : '◻️';
      html += '<li class="' + (c.ok === false ? 'fail' : 'pass') + '"><span class="ic">' + ic + '</span><span>' + c.txt + '</span></li>';
    });
    $('bzChkList').innerHTML = html;
    box.style.display = 'block';
  }

  /* ── บันทึกไอเดียที่กำลังพิจารณา (localStorage) ── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  function renderLog() {
    var log = loadLog(), box = $('bzLogBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">ยังไม่มีไอเดียที่บันทึก — กรอกเครื่องคำนวณด้านบนแล้วกด "บันทึกไอเดียนี้"</div>'; return; }
    var html = '<table class="log-table"><thead><tr><th>ไอเดีย</th><th>ลงทุนเริ่มต้น</th><th>คุ้มทุน(หน่วย/ด)</th><th>คืนทุน(ด)</th><th>กำไรคาด/ด</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + r.name + '</td><td>' + baht(r.startup) + '</td>' +
        '<td>' + (isFinite(r.breakevenUnits) ? fmt(r.breakevenUnits, 1) : '—') + '</td>' +
        '<td>' + (isFinite(r.paybackMonths) ? fmt(r.paybackMonths, 1) : '—') + '</td>' +
        '<td style="color:' + (r.monthlyProfitAtVol >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (isFinite(r.monthlyProfitAtVol) ? ((r.monthlyProfitAtVol >= 0 ? '+' : '−') + baht(Math.abs(r.monthlyProfitAtVol))) : '—') + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
  }

  function addIdea() {
    var name = ($('bzIdeaName').value || '').trim();
    var price = num($('bzPrice').value);
    if (!name) { alert('ใส่ชื่อไอเดียก่อน'); return; }
    if (!isFinite(price) || price <= 0) { alert('กรอกราคาขายเฉลี่ยต่อหน่วยในเครื่องคำนวณด้านบนก่อน'); return; }
    var o = { startup: num($('bzStartup').value) || 0, fixed: num($('bzFixed').value) || 0, price: price, varCost: num($('bzVar').value) || 0, vol: num($('bzVol').value) };
    var r = computeBreakeven(o);
    var log = loadLog();
    log.push({
      name: name, startup: o.startup, fixed: o.fixed, price: o.price, varCost: o.varCost, vol: o.vol,
      profitPerUnit: r.profitPerUnit, breakevenUnits: r.breakevenUnits, paybackMonths: r.paybackMonths, monthlyProfitAtVol: r.monthlyProfitAtVol,
      ts: Date.now()
    });
    saveLog(log);
    $('bzIdeaName').value = '';
    renderLog();
  }

  function init() {
    $('bzCalcBtn').addEventListener('click', doCalc);
    $('bzChkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), key = row.getAttribute('data-key'), val = btn.getAttribute('data-val');
      bzAnswers[key] = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    $('bzChkBtn').addEventListener('click', doChecklist);
    $('bzOwnCapital').addEventListener('input', function () { if ($('bzChkResult').style.display !== 'none') doChecklist(); });
    $('bzAddBtn').addEventListener('click', addIdea);
    renderLog();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__biz = { computeBreakeven: computeBreakeven };
})();
