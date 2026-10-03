/* ══════════════════════════════════════════════════════════════════
   Tanot — บันทึกรถ: ตรรกะล้วน (ไม่มี DOM/storage) · UMD — window.CarCalc ในหน้า, require() ตรงๆ ใน tests/car.spec.js
   car.html / index.js (การ์ด "รถ") ใช้ไฟล์นี้ร่วมกัน — ห้ามมีสูตรวันครบกำหนด/นัดเข้าศูนย์/กฎ ตรอ. ของตัวเองที่อื่น

   รถ (localStorage['tanot:car:vehicles'] = array, sync mode 'list' idField 'id'):
     { id, type ('car' | 'motorcycle' — ไม่มี = car), plate, province, make, model, year (ปี ค.ศ. ที่จดทะเบียนครั้งแรก/ปีรุ่น), odometer (กม. ล่าสุด), odometerAt 'YYYY-MM-DD',
       actDue (พ.ร.บ. หมดอายุ), taxDue (ภาษีประจำปีครบกำหนด), insuranceDue (ประกันภาคสมัครใจหมดอายุ — ใช้เมื่อไม่เชื่อมกรมธรรม์),
       insurancePolicyId? (กรมธรรม์ประเภทรถใน tanot:insurance:policies — อ่านอย่างเดียว), inspectDue (ใบตรวจสภาพ ตรอ. หมดอายุ),
       note, files: [{ id, name, size, mime }] (R2 ผ่าน /api/files?ns=car) }
   เข้าศูนย์/ซ่อมบำรุง (localStorage['tanot:car:services'] = array, sync list idField 'id'):
     { id, vehicleId, date, odometer, items (ข้อความ), cost (บาท), nextKm?, nextDate? (อย่างใดถึงก่อน), budgetId? (แถวใน budget:records), note }
   วันที่เป็น 'YYYY-MM-DD' เวลาท้องถิ่น · เวลาแจ้งเตือน 08:00 เวลาไทย (Date.UTC ตรงๆ ไม่ขึ้นกับ timezone เครื่อง)

   กฎ ตรอ.: รถยนต์อายุเกิน 7 ปี / รถจักรยานยนต์อายุเกิน 5 ปี นับจากปีจดทะเบียนครั้งแรก ต้องมีใบตรวจสภาพที่ยังไม่หมดอายุ ณ วันต่อภาษี (INSPECT_AFTER)
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CarCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INSPECT_AFTER = { car: 7, motorcycle: 5 };
  var INSPECT_AFTER_YEARS = INSPECT_AFTER.car; // คงไว้ให้โค้ดเดิมที่อ้างค่านี้
  var TYPES = { car: 'รถยนต์', motorcycle: 'รถจักรยานยนต์' };
  function vType(v) { return v && v.type === 'motorcycle' ? 'motorcycle' : 'car'; }
  function inspectAfter(v) { return INSPECT_AFTER[vType(v)]; }
  var REMIND_LEADS = [30, 7, 0];
  var SERVICE_LEADS = [7, 0];
  var SOON_DAYS = 30, SOON_KM = 1000;
  var KINDS = { act: 'พ.ร.บ.', tax: 'ภาษีรถประจำปี', insurance: 'ประกันภาคสมัครใจ', inspect: 'ตรวจสภาพ (ตรอ.)' };
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var FALLBACK_CATS = [
    { id: 'cat-fuel', name: 'เติมน้ำมัน', type: 'expense' },
    { id: 'cat-personal', name: 'ซื้อของใช้ส่วนตัว', type: 'expense' },
    { id: 'cat-shopping', name: 'Shopping', type: 'expense' }
  ];
  var CAR_CAT_RE = /รถ|ยานพาหนะ|ซ่อม|บำรุง|น้ำมัน|เดินทาง/;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function daysUntil(dateStr, now) {
    var d = parseDate(dateStr);
    if (!d) return null;
    var n = now || new Date();
    return Math.round((d - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
  }
  function thDate(d) { return d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
  function plateKey(s) { return String(s || '').replace(/[\s\-.]/g, '').toLowerCase(); }
  function title(v) { return [String(v && v.plate || '').trim(), String(v && v.province || '').trim()].filter(Boolean).join(' ') || [v && v.make, v && v.model].filter(Boolean).join(' ') || 'รถ'; }

  /* ── ตรอ. ── */
  /** อายุรถ (ปีเต็ม) ณ วัน onDate จากปีจดทะเบียน — null ถ้าไม่รู้ปี */
  function ageYears(v, onDate) {
    var y = Math.round(Number(v && v.year));
    var d = parseDate(onDate);
    if (!y || y < 1900 || !d) return null;
    return d.getFullYear() - y;
  }
  /** รถต้องตรวจสภาพ ณ วัน onDate หรือไม่: อายุเกินเกณฑ์ตามประเภท (รถยนต์ 7 ปี, รถจักรยานยนต์ 5 ปี — ปี onDate − ปีจดทะเบียน > เกณฑ์) */
  function inspectRequired(v, onDate) {
    var a = ageYears(v, onDate);
    return a !== null && a > inspectAfter(v);
  }
  /** ใบตรวจสภาพใช้ต่อภาษีได้หรือไม่ ณ วันต่อภาษี (taxDue): ต้องมีและไม่หมดก่อนวันนั้น */
  function inspectOk(v) {
    if (!v || !v.taxDue) return true;
    if (!inspectRequired(v, v.taxDue)) return true;
    return !!v.inspectDue && v.inspectDue >= v.taxDue;
  }

  /* ── ประกันภาคสมัครใจ: อ่านกรมธรรม์รถจากหน้าประกัน (อ่านอย่างเดียว) ── */
  function carPolicies(policies) {
    return (policies || []).filter(function (p) { return p && p.id && p.type === 'car'; });
  }
  /** กรมธรรม์ที่ผูกกับรถ: ที่เลือกไว้ (insurancePolicyId) ก่อน ไม่งั้นจับจากทะเบียนในช่อง "ผู้เอาประกัน / ทะเบียนรถ" · ไม่เจอ = null */
  function linkedPolicy(v, policies) {
    var list = carPolicies(policies), i;
    if (v && v.insurancePolicyId) {
      for (i = 0; i < list.length; i++) if (list[i].id === v.insurancePolicyId) return list[i];
    }
    var k = plateKey(v && v.plate);
    if (k.length >= 3) {
      var hits = list.filter(function (p) { return plateKey(p.insured).indexOf(k) !== -1; });
      if (hits.length) {
        hits.sort(function (a, b) { return String(b.renewDate || '').localeCompare(String(a.renewDate || '')); });
        return hits[0];
      }
    }
    return null;
  }

  /* ── กำหนดต่ออายุของรถ 1 คัน ── */
  /** [{ kind, date, label, linked? }] — ประกัน: ใช้ renewDate ของกรมธรรม์ที่ผูกอยู่ (linked:true) ไม่งั้นใช้ insuranceDue;
   *  ตรอ.: แสดงเมื่อรถต้องตรวจ ณ วันต่อภาษี (หรือวันนี้ถ้าไม่มี taxDue) หรือผู้ใช้กรอกวันไว้เอง */
  function deadlines(v, policies, now) {
    var out = [];
    if (!v) return out;
    if (parseDate(v.actDue)) out.push({ kind: 'act', date: v.actDue, label: KINDS.act });
    if (parseDate(v.taxDue)) out.push({ kind: 'tax', date: v.taxDue, label: KINDS.tax });
    var pol = linkedPolicy(v, policies);
    if (pol && parseDate(pol.renewDate) && !(pol.endDate && pol.endDate < pol.renewDate)) {
      out.push({ kind: 'insurance', date: pol.renewDate, label: KINDS.insurance, linked: true, policyId: pol.id });
    } else if (!pol && parseDate(v.insuranceDue)) out.push({ kind: 'insurance', date: v.insuranceDue, label: KINDS.insurance });
    if (parseDate(v.inspectDue)) out.push({ kind: 'inspect', date: v.inspectDue, label: KINDS.inspect });
    return out;
  }

  /* ── นัดเข้าศูนย์ครั้งถัดไป (จากรายการล่าสุดที่ระบุ nextKm/nextDate) ── */
  function vehicleServices(services, vehicleId) {
    return (services || []).filter(function (s) { return s && s.vehicleId === vehicleId; });
  }
  function latestFirst(a, b) {
    return String(b.date || '').localeCompare(String(a.date || '')) || num(b.odometer) - num(a.odometer);
  }
  /** เลขไมล์ปัจจุบัน = มากสุดของที่กรอกในรถกับที่บันทึกในประวัติเข้าศูนย์ */
  function currentOdometer(v, services) {
    var m = num(v && v.odometer);
    vehicleServices(services, v && v.id).forEach(function (s) { m = Math.max(m, num(s.odometer)); });
    return m;
  }
  /** { service, nextKm, nextDate, days, kmLeft, due: 'date'|'km'|null, state: 'overdue'|'soon'|'ok' } หรือ null ถ้าไม่มีนัด
   *  อย่างใดถึงก่อน: เลยกำหนด = วันที่ผ่านแล้ว หรือเลขไมล์ถึง nextKm แล้ว (due บอกว่าอย่างไหน) */
  function nextService(v, services, now) {
    var list = vehicleServices(services, v && v.id).filter(function (s) { return num(s.nextKm) || parseDate(s.nextDate); });
    if (!list.length) return null;
    list.sort(latestFirst);
    var s = list[0], odo = currentOdometer(v, services);
    var nextKm = num(s.nextKm), nextDate = parseDate(s.nextDate) ? s.nextDate : '';
    var days = nextDate ? daysUntil(nextDate, now) : null;
    var kmLeft = nextKm && odo ? nextKm - odo : null;
    var byDate = days !== null && days < 0, byKm = kmLeft !== null && kmLeft <= 0;
    var state = byDate || byKm ? 'overdue' : (days !== null && days <= SOON_DAYS) || (kmLeft !== null && kmLeft <= SOON_KM) ? 'soon' : 'ok';
    var due = byDate ? 'date' : byKm ? 'km' : state === 'soon' ? (days !== null && days <= SOON_DAYS ? 'date' : 'km') : null;
    return { service: s, nextKm: nextKm, nextDate: nextDate, days: days, kmLeft: kmLeft, due: due, state: state };
  }

  /* ── รายการที่ใกล้ถึง/เลยกำหนด (หน้า car + การ์ดหน้าวันนี้) ── */
  /** [{ vehicle, kind, label, date, days, linked? }] ภายใน withinDays วัน (รวมเลยกำหนด) + นัดเข้าศูนย์ (kind 'service') ที่ถึง/ใกล้ถึง · เรียงใกล้สุดก่อน */
  function dueList(vehicles, services, policies, now, withinDays) {
    var out = [];
    (vehicles || []).forEach(function (v) {
      if (!v || !v.id) return;
      deadlines(v, policies, now).forEach(function (d) {
        var days = daysUntil(d.date, now);
        if (days === null || days > withinDays) return;
        out.push({ vehicle: v, kind: d.kind, label: d.label, date: d.date, days: days, linked: !!d.linked });
      });
      var n = nextService(v, services, now);
      if (n && (n.state !== 'ok' || (n.days !== null && n.days <= withinDays))) {
        out.push({ vehicle: v, kind: 'service', label: 'เข้าศูนย์', date: n.nextDate, days: n.days === null ? (n.state === 'overdue' ? -1 : 0) : n.days, service: n });
      }
    });
    out.sort(function (a, b) { return a.days - b.days; });
    return out;
  }

  /* ── การแจ้งเตือน (TanotPush.setReminders('car', …) → ตาราง reminders scope 'car') ──
     พ.ร.บ./ภาษี/ประกัน(กรอกเอง)/ตรอ.: ก่อนหมด 30 · 7 วัน และวันหมด · นัดเข้าศูนย์ (nextDate): ก่อน 7 วันและวันนัด
     ประกันที่ผูกกับกรมธรรม์ในหน้าประกันไม่ลงทะเบียนซ้ำ (หน้าประกันเตือนอยู่แล้ว scope 'insurance') · เฉพาะเวลาที่ยังไม่ถึง
     นัดตามเลขไมล์ไม่มีวันที่ให้เตือน — แสดงในหน้า/การ์ดเท่านั้น */
  function reminders(vehicles, services, policies, now) {
    var t = (now || new Date()).getTime(), out = [];
    function push(id, d, lead, ttl, body) {
      var at = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - lead, 1, 0);
      if (at <= t) return;
      out.push({ id: id + ':' + lead, title: ttl, body: body, url: 'car.html', due_at: at, kind: 'push' });
    }
    (vehicles || []).forEach(function (v) {
      if (!v || !v.id) return;
      var name = title(v);
      deadlines(v, policies, now).forEach(function (dl) {
        if (dl.linked) return;
        var d = parseDate(dl.date);
        REMIND_LEADS.forEach(function (lead) {
          var ttl = lead ? dl.label + ' ' + name + ' หมดใน ' + lead + ' วัน' : dl.label + ' ' + name + ' หมดอายุวันนี้';
          var body = dl.label + ' · ' + name + ' · ครบกำหนด ' + thDate(d);
          if (dl.kind === 'tax' && inspectRequired(v, dl.date)) body += ' · ต้องตรวจสภาพ (ตรอ.) ก่อนต่อภาษี';
          push(v.id + ':' + dl.kind + ':' + dl.date, d, lead, ttl, body);
        });
      });
      var n = nextService(v, services, now);
      if (n && n.nextDate) {
        var sd = parseDate(n.nextDate);
        SERVICE_LEADS.forEach(function (lead) {
          push(v.id + ':svc:' + n.service.id + ':' + n.nextDate, sd, lead,
            lead ? 'นัดเข้าศูนย์ ' + name + ' ในอีก ' + lead + ' วัน' : 'นัดเข้าศูนย์ ' + name + ' วันนี้',
            [String(n.service.items || '').trim(), 'นัด ' + thDate(sd)].filter(Boolean).join(' · '));
        });
      }
    });
    return out;
  }

  /* ── ส่งเข้า budget (รูปแบบ budget:records เดิม — id ตายตัวต่อรายการเข้าศูนย์ กดซ้ำ/2 เครื่องได้แถวเดียว) ── */
  function budgetId(serviceId) { return 'car-' + serviceId; }
  function defaultCategory(cats) {
    var list = (Array.isArray(cats) ? cats : []).filter(function (c) { return c && c.id && c.type === 'expense'; });
    for (var i = 0; i < list.length; i++) if (CAR_CAT_RE.test(list[i].name || '')) return list[i].id;
    return list.length ? list[0].id : '';
  }
  function budgetRecord(service, vehicle, categoryId) {
    var what = String(service.items || '').trim().split(/\r?\n/)[0] || 'เข้าศูนย์/ซ่อมบำรุง';
    return { id: budgetId(service.id), date: service.date, type: 'expense', categoryId: categoryId, amount: num(service.cost), note: 'รถ ' + title(vehicle) + ' · ' + what };
  }

  return {
    KINDS: KINDS, REMIND_LEADS: REMIND_LEADS, SERVICE_LEADS: SERVICE_LEADS, INSPECT_AFTER_YEARS: INSPECT_AFTER_YEARS, INSPECT_AFTER: INSPECT_AFTER, TYPES: TYPES, vType: vType, inspectAfter: inspectAfter,
    FALLBACK_CATS: FALLBACK_CATS,
    parseDate: parseDate, ymd: ymd, daysUntil: daysUntil, thDate: thDate, plateKey: plateKey, title: title,
    ageYears: ageYears, inspectRequired: inspectRequired, inspectOk: inspectOk,
    carPolicies: carPolicies, linkedPolicy: linkedPolicy, deadlines: deadlines,
    vehicleServices: vehicleServices, currentOdometer: currentOdometer, nextService: nextService,
    dueList: dueList, reminders: reminders,
    budgetId: budgetId, defaultCategory: defaultCategory, budgetRecord: budgetRecord
  };
});
