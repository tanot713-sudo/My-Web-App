/* ══════════════════════════════════════════════════════════════════
   Tanot — ภาษีเงินได้บุคคลธรรมดา: ตรรกะล้วน (ไม่มี DOM) · UMD — window.TaxCalc ในหน้า tax.html, require() ตรงๆ ใน tests/tax.spec.js
   ตัวเลขทุกตัว (ขั้นภาษี, เพดาน, อัตราหักค่าใช้จ่าย, กำหนดยื่น) อยู่ใน tax-rules/<ปีภาษี พ.ศ.>.json — ไฟล์นี้มีแต่ลำดับการคำนวณ
   กฎที่ไม่มีในปีนั้นใส่ null ในไฟล์ปี (เช่น ssf, eReceipt) → รายการนั้นหักได้ 0 และ items[key].avail = false

   ลำดับ (ประมวลรัษฎากร ม.40, 42, 47, 48):
     เงินได้พึงประเมิน = 40(1) เงินเดือน + 40(2) รับจ้าง/ค่าธรรมเนียม + 40(8) อื่นๆ
     − ค่าใช้จ่าย: 40(1)+(2) รวมกัน 50% ไม่เกิน 100,000 · 40(8) เหมา 60%
     − ค่าลดหย่อน (ยกเว้นเงินบริจาค)
       · ประกันสุขภาพตัวเอง ≤ 25,000 และ ชีวิต + สุขภาพ ≤ 100,000
       · เบี้ยบำนาญใช้โควตาประกันชีวิตที่เหลือจาก 100,000 ก่อน (fillLifeFirst) ส่วนที่เหลือ ≤ 15% ของเงินได้พึงประเมิน และ ≤ 200,000
       · กลุ่มเกษียณ (PVD/กองทุนครูเอกชน, กบข., กอช., บำนาญส่วนที่เหลือ, SSF, RMF) รวมกัน ≤ retireGroup (500,000)
       · ThaiESG / ThaiESGX แยกเพดานของตัวเอง ไม่อยู่ในกลุ่มเกษียณ
     − เงินบริจาคเพื่อการศึกษา/กีฬา/โรงพยาบาลรัฐ × 2 ≤ 10% ของเงินได้หลังหักค่าใช้จ่ายและค่าลดหย่อน
     − เงินบริจาคทั่วไป ≤ 10% ของยอดหลังหักเงินบริจาคเพื่อการศึกษาแล้ว
     = เงินได้สุทธิ → ภาษีอัตราก้าวหน้า
     ภาษีขั้นต่ำ: เงินได้ 40(2)–40(8) รวม ≥ 1,000,000 → 0.5% ของยอดนั้น (ถ้าไม่เกิน 5,000 ยกเว้น) — เสียอันที่มากกว่า
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TaxCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ช่องกรอกทั้งหมด (จำนวนเงินเป็นบาท, ยกเว้น spouse = 0/1 และ children/children2561/parents/disabled = จำนวนคน) */
  var INCOME_KEYS = ['salary', 'service', 'other'];
  /* กลุ่มสำหรับแสดงผล — annuity อยู่ในกลุ่มเกษียณ แต่ส่วนที่เติมโควตาประกันชีวิต (toLife) นับเป็นกลุ่มประกัน */
  var GROUPS = [
    { key: 'family', items: ['personal', 'spouse', 'children', 'prenatal', 'parents', 'disabled', 'socialSecurity'] },
    { key: 'insurance', items: ['lifeIns', 'healthIns', 'parentsHealth', 'spouseLife'] },
    { key: 'retire', items: ['pvd', 'gpf', 'nsf', 'annuity', 'ssf', 'rmf'] },
    { key: 'invest', items: ['thaiEsg', 'thaiEsgxNew', 'thaiEsgxLtf'] },
    { key: 'other', items: ['homeLoan', 'homeBuild', 'eReceipt', 'eReceiptOtop', 'politic'] },
    { key: 'donation', items: ['donationEdu', 'donation'] }
  ];
  var COUNT_KEYS = { spouse: 1, children: 1, children2561: 1, parents: 1, disabled: 1 };
  /* ลำดับใช้เพดานกลุ่มเกษียณ — ยอดรวมเท่ากันทุกลำดับ ลำดับนี้มีผลแค่ว่ารายการไหนถูกตัดตอนเกิน (เงินที่หักอัตโนมัติจากเงินเดือนก่อน แล้วค่อยที่ซื้อเอง) */
  var RETIRE_ORDER = ['pvd', 'gpf', 'nsf', 'annuity', 'ssf', 'rmf'];

  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
  function int(v) { return Math.floor(num(v)); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function capOf(rule, base) { // rule = ตัวเลข | { pct, cap } | null
    if (rule == null) return 0;
    if (typeof rule === 'number') return rule;
    var c = rule.cap != null ? rule.cap : Infinity;
    if (rule.pct != null) c = Math.min(c, rule.pct * base);
    return c;
  }

  /** ภาษีอัตราก้าวหน้า + รายขั้น */
  function progressive(rules, net) {
    var rows = [], prev = 0, tax = 0;
    net = num(net);
    rules.brackets.forEach(function (b) {
      var top = b.upTo == null ? Infinity : b.upTo;
      var part = Math.max(0, Math.min(net, top) - prev);
      var tx = part * b.rate;
      rows.push({ from: prev, upTo: b.upTo, rate: b.rate, taxable: part, tax: r2(tx) });
      tax += tx;
      prev = top;
    });
    return { tax: r2(tax), rows: rows };
  }

  /** อัตราภาษีของบาทถัดไป (ขั้นที่เงินได้สุทธิอยู่) */
  function marginalRate(rules, net) {
    net = num(net);
    for (var i = 0; i < rules.brackets.length; i++) {
      var b = rules.brackets[i];
      if (b.upTo == null || net < b.upTo) return b.rate;
    }
    return rules.brackets[rules.brackets.length - 1].rate;
  }

  function compute(rules, inp) {
    inp = inp || {};
    var D = rules.deductions, E = rules.expenses;
    var salary = num(inp.salary), service = num(inp.service), other = num(inp.other);
    var assessable = salary + service + other;

    var expSS = Math.min((salary + service) * E.salaryService.rate, E.salaryService.cap);
    var expOther = other * E.other.rate;
    var expenses = expSS + expOther;
    var afterExp = Math.max(0, assessable - expenses);

    var items = {};
    function put(key, raw, ded, avail, cap) { items[key] = { raw: raw, ded: r2(ded), avail: avail !== false, cap: cap }; }
    function simple(key, rule, base) {
      var raw = num(inp[key]), avail = rule != null, cap = avail ? capOf(rule, base) : 0;
      put(key, raw, Math.min(raw, cap), avail, avail ? cap : 0);
    }

    /* ── ส่วนตัว/ครอบครัว ── */
    put('personal', 1, D.personal, true, D.personal);
    var sp = num(inp.spouse) ? 1 : 0;
    put('spouse', sp, sp * D.spouse, true, D.spouse);
    var nKids = int(inp.children), n2561 = Math.min(int(inp.children2561), Math.max(0, nKids - 1)); // คนแรกไม่ได้ 60,000
    put('children', nKids, (nKids - n2561) * D.child + n2561 * D.child2561, true, null);
    items.children.n2561 = n2561;
    simple('prenatal', D.prenatal);
    var nPar = Math.min(int(inp.parents), D.parentMax);
    put('parents', int(inp.parents), nPar * D.parent, true, D.parentMax * D.parent);
    var nDis = int(inp.disabled);
    put('disabled', nDis, nDis * D.disabled, true, null);
    var ssRaw = num(inp.socialSecurity);
    put('socialSecurity', ssRaw, D.socialSecurity == null ? ssRaw : Math.min(ssRaw, D.socialSecurity), true, D.socialSecurity);

    /* ── ประกัน ── */
    var healthRaw = num(inp.healthIns), lifeRaw = num(inp.lifeIns);
    var health = Math.min(healthRaw, D.healthIns);
    var life = Math.min(lifeRaw, D.lifeIns, Math.max(0, D.lifeHealth - health));
    put('healthIns', healthRaw, health, true, D.healthIns);
    put('lifeIns', lifeRaw, life, true, D.lifeIns);
    simple('parentsHealth', D.parentsHealth);
    simple('spouseLife', D.spouseLife);

    /* ── บำนาญ: เติมโควตาประกันชีวิตที่เหลือก่อน ── */
    var annRaw = num(inp.annuity), annRule = D.annuity, moved = 0;
    if (annRule && annRule.fillLifeFirst) {
      var lifeRoom = Math.max(0, Math.min(D.lifeIns - life, D.lifeHealth - life - health));
      moved = Math.min(annRaw, lifeRoom);
    }
    var annCap = annRule ? capOf(annRule, assessable) : 0;
    var annRetire = Math.min(annRaw - moved, annCap);

    /* ── กลุ่มเกษียณ ── */
    var want = {
      pvd: D.pvd ? Math.min(num(inp.pvd), capOf(D.pvd, salary)) : 0,
      gpf: D.gpf ? Math.min(num(inp.gpf), capOf(D.gpf, salary)) : 0,
      nsf: D.nsf ? Math.min(num(inp.nsf), capOf(D.nsf, assessable)) : 0,
      annuity: annRetire,
      ssf: D.ssf ? Math.min(num(inp.ssf), capOf(D.ssf, assessable)) : 0,
      rmf: D.rmf ? Math.min(num(inp.rmf), capOf(D.rmf, assessable)) : 0
    };
    var left = D.retireGroup, got = {};
    RETIRE_ORDER.forEach(function (k) { got[k] = Math.min(want[k], left); left -= got[k]; });
    put('pvd', num(inp.pvd), got.pvd, !!D.pvd, D.pvd ? capOf(D.pvd, salary) : 0);
    put('gpf', num(inp.gpf), got.gpf, !!D.gpf, D.gpf ? capOf(D.gpf, salary) : 0);
    put('nsf', num(inp.nsf), got.nsf, !!D.nsf, D.nsf ? capOf(D.nsf, assessable) : 0);
    put('annuity', annRaw, moved + got.annuity, !!annRule, annCap);
    items.annuity.toLife = r2(moved);
    items.annuity.toRetire = r2(got.annuity);
    put('ssf', num(inp.ssf), got.ssf, !!D.ssf, D.ssf ? capOf(D.ssf, assessable) : 0);
    put('rmf', num(inp.rmf), got.rmf, !!D.rmf, D.rmf ? capOf(D.rmf, assessable) : 0);
    var retireUsed = D.retireGroup - left;

    /* ── ThaiESG / ThaiESGX ── */
    simple('thaiEsg', D.thaiEsg, assessable);
    simple('thaiEsgxNew', D.thaiEsgxNew, assessable);
    simple('thaiEsgxLtf', D.thaiEsgxLtf, assessable);

    /* ── อื่นๆ ── */
    simple('homeLoan', D.homeLoan);
    var hb = D.homeBuild, hbRaw = num(inp.homeBuild);
    put('homeBuild', hbRaw, hb ? Math.min(Math.floor(hbRaw / hb.per) * hb.amount, hb.cap) : 0, !!hb, hb ? hb.cap : 0);
    simple('eReceipt', D.eReceipt);
    simple('eReceiptOtop', D.eReceiptOtop);
    simple('politic', D.politic);

    var deductions = 0;
    Object.keys(items).forEach(function (k) { deductions += items[k].ded; });
    deductions = r2(deductions);
    var base = Math.max(0, afterExp - deductions);

    /* ── เงินบริจาค (คิดหลังสุด) ── */
    var de = D.donationEdu, dg = D.donation;
    var eduRaw = num(inp.donationEdu), genRaw = num(inp.donation);
    var eduCap = de ? de.pct * base : 0;
    var edu = de ? Math.min(eduRaw * de.mult, eduCap) : 0;
    var genCap = dg ? dg.pct * (base - edu) : 0;
    var gen = dg ? Math.min(genRaw, genCap) : 0;
    put('donationEdu', eduRaw, edu, !!de, eduCap);
    put('donation', genRaw, gen, !!dg, genCap);
    var donations = r2(edu + gen);

    var net = r2(Math.max(0, base - donations));
    var prog = progressive(rules, net);
    var nonSalary = service + other, mt = rules.minimumTax, minTax = 0;
    if (mt && nonSalary >= mt.threshold) {
      minTax = r2(nonSalary * mt.rate);
      if (minTax <= mt.exemptUpTo) minTax = 0;
    }
    var tax = Math.max(prog.tax, minTax);
    var withheld = num(inp.withheld);

    /* ผลรวมรายกลุ่ม — บำนาญส่วนที่เติมโควตาประกันชีวิตนับเป็นกลุ่มประกัน ส่วนที่เหลือนับในกลุ่มเกษียณ */
    var groups = {};
    GROUPS.forEach(function (g) {
      var s = 0;
      g.items.forEach(function (k) { if (items[k] && k !== 'annuity') s += items[k].ded; });
      if (g.key === 'insurance') s += items.annuity.toLife;
      if (g.key === 'retire') s += items.annuity.toRetire;
      groups[g.key] = r2(s);
    });

    return {
      taxYear: rules.taxYear,
      assessable: r2(assessable), expenses: r2(expenses), expSS: r2(expSS), expOther: r2(expOther),
      deductions: deductions, donations: donations, net: net,
      items: items, groups: groups,
      retire: { used: r2(retireUsed), cap: D.retireGroup },
      progressiveTax: prog.tax, brackets: prog.rows, minTax: minTax, minTaxApplied: minTax > prog.tax,
      tax: r2(tax), withheld: r2(withheld), balance: r2(tax - withheld),
      marginalRate: marginalRate(rules, net),
      effectiveRate: assessable > 0 ? tax / assessable : 0
    };
  }

  function withExtra(inp, extra) {
    var o = {};
    Object.keys(inp || {}).forEach(function (k) { o[k] = inp[k]; });
    Object.keys(extra || {}).forEach(function (k) { o[k] = num(o[k]) + num(extra[k]); });
    return o;
  }

  /** ช่องนี้มีสิทธิในปีภาษีนั้นไหม (กฎเป็น null = หมดอายุ/ยังไม่มี) — ใช้ซ่อนช่องในหน้า */
  var RULE_OF = { children: 'child', children2561: 'child2561', parents: 'parent' };
  function available(rules, key) {
    if (INCOME_KEYS.indexOf(key) >= 0 || key === 'withheld' || key === 'socialSecurity') return true;
    var rk = RULE_OF[key] || key;
    return !(rk in rules.deductions) || rules.deductions[rk] != null;
  }

  /** "ถ้าซื้อเพิ่ม": คำนวณใหม่โดยบวก extra = { key: บาท } เข้ากับช่องเดิม แล้วเทียบกับปัจจุบัน */
  function simulate(rules, inp, extra) {
    var before = compute(rules, inp), after = compute(rules, withExtra(inp, extra));
    var spend = 0;
    Object.keys(extra || {}).forEach(function (k) { spend += num(extra[k]); });
    var saved = r2(before.tax - after.tax);
    return { before: before, after: after, spend: r2(spend), saved: saved, ratio: spend > 0 ? saved / spend : 0 };
  }

  /** ซื้อ/จ่ายเพิ่มได้อีกกี่บาทจนกว่าค่าลดหย่อนจะไม่เพิ่ม (คิดเพดานเดี่ยว + เพดานกลุ่มเกษียณ + โควตาประกันชีวิตที่บำนาญใช้)
   *  — เงินบริจาคเพื่อการศึกษานับ 2 เท่า จึงหารกลับ · ตัวที่ไม่มีเพดาน (ประกันสังคมตามจริง) คืน Infinity */
  function room(rules, inp, key) {
    var BIG = 1e9;
    var e = {}; e[key] = BIG;
    var a = compute(rules, inp), b = compute(rules, withExtra(inp, e));
    var gain = key === 'donationEdu' || key === 'donation'
      ? b.items[key].ded - a.items[key].ded
      : b.deductions - a.deductions;
    if (gain >= BIG / 2) return Infinity;
    if (key === 'donationEdu' && rules.deductions.donationEdu) gain = gain / rules.deductions.donationEdu.mult;
    return Math.max(0, Math.floor(gain * 100) / 100);
  }

  /** จ่ายเพิ่มเท่าไรถึงได้ภาษีลดเต็มที่แล้ว (ไม่เกิน room) — เกินจากนี้ยังหักได้แต่ภาษีไม่ลดอีก (เงินได้สุทธิลงถึงขั้น 0% หรือติดภาษีขั้นต่ำ)
   *  ภาษีไม่เพิ่มตามยอดที่จ่าย จึงหาจุดแรกที่ภาษีเท่ากับตอนจ่ายเต็ม room ด้วย binary search ทีละบาท */
  function useful(rules, inp, key) {
    var rm = room(rules, inp, key);
    if (!(rm > 0) || rm === Infinity) return rm;
    function taxAt(x) { var e = {}; e[key] = x; return compute(rules, withExtra(inp, e)).tax; }
    var floorTax = taxAt(rm);
    if (taxAt(0) <= floorTax) return 0;
    var lo = 0, hi = Math.ceil(rm);
    while (hi - lo > 1) {
      var mid = Math.floor((lo + hi) / 2);
      if (taxAt(mid) <= floorTax) hi = mid; else lo = mid;
    }
    return Math.min(hi, rm);
  }

  /** ปีภาษี พ.ศ. ที่ควรเปิดเป็นค่าเริ่มต้น: ม.ค.–เม.ย. เป็นช่วงยื่นของปีก่อน */
  function defaultTaxYear(now, years) {
    var d = now || new Date();
    var be = d.getFullYear() + 543;
    var want = d.getMonth() <= 3 ? be - 1 : be;
    if (!years || !years.length) return want;
    if (years.indexOf(want) >= 0) return want;
    var best = years[0];
    years.forEach(function (y) { if (Math.abs(y - want) < Math.abs(best - want)) best = y; });
    return best;
  }

  /* ── การแจ้งเตือนกำหนดยื่น (tanot-push.js → ตาราง reminders scope 'tax') ──
     rulesByYear = { ปี พ.ศ.: กฎของปีนั้น } · ใช้ deadlines.online ของทุกปี: ก่อน 30 / 7 / 1 วัน และวันสุดท้าย 08:00 เวลาไทย
     วันที่อยู่ในไฟล์กฎเท่านั้น (ห้ามเขียนวันที่ใน JS) · เฉพาะเวลาที่ยังไม่ถึง */
  var REMIND_LEADS = [30, 7, 1, 0];
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function ymdParts(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? [+m[1], +m[2] - 1, +m[3]] : null;
  }
  function thDate(p) { return p[2] + ' ' + TH_MONTHS[p[1]] + ' ' + (p[0] + 543); }
  function reminders(rulesByYear, now) {
    var t = (now || new Date()).getTime(), out = [];
    Object.keys(rulesByYear || {}).forEach(function (y) {
      var dl = rulesByYear[y] && rulesByYear[y].deadlines;
      var on = dl && ymdParts(dl.online), paper = dl && ymdParts(dl.paper);
      if (!on) return;
      var body = 'ยื่นออนไลน์ภายใน ' + thDate(on) + (paper ? ' · แบบกระดาษ ' + thDate(paper) : '');
      REMIND_LEADS.forEach(function (lead) {
        var at = Date.UTC(on[0], on[1], on[2] - lead, 1, 0); // 08:00 น. เวลาไทย
        if (at <= t) return;
        out.push({
          id: y + ':' + dl.online + ':' + lead,
          title: lead ? 'ยื่นภาษีเงินได้ปี ' + y + ' — อีก ' + lead + ' วัน' : 'วันสุดท้ายยื่นภาษีเงินได้ปี ' + y,
          body: body, url: 'tax.html', due_at: at, kind: 'push'
        });
      });
    });
    return out;
  }

  return {
    REMIND_LEADS: REMIND_LEADS, reminders: reminders,
    INCOME_KEYS: INCOME_KEYS, GROUPS: GROUPS, COUNT_KEYS: COUNT_KEYS, RETIRE_ORDER: RETIRE_ORDER,
    available: available, progressive: progressive, marginalRate: marginalRate, compute: compute, simulate: simulate, room: room, useful: useful,
    defaultTaxYear: defaultTaxYear
  };
});
