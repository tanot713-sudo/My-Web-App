// @ts-check
// ยุบรวมหน้าลงทุน (docs/invest-consolidation-design.md) — ROADMAP Phase 6
// ส่วนที่ 1 (node ล้วน, หัวข้อ 8.1 ข้อ 1–4): invest-calc.js เทียบกับ tests/fixtures/invest-original.js (สำเนาฟังก์ชันเดิม ห้ามแก้)
// และ known-answer ของมูลค่าสินทรัพย์/วันที่ไทย/snapshot/สมุดเทรด
const { test, expect } = require('@playwright/test');
const path = require('path');

const C = require(path.join(__dirname, '..', 'invest-calc.js'));
const O = require('./fixtures/invest-original.js');

/* ── ชุดราคาสังเคราะห์ (ผลคงที่): ขาขึ้น / ขาลง / แกว่ง / สั้น (ข้อมูลไม่พอสำหรับ EMA50/ADX) / แบน ── */
function lcg(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function makeSeries(kind, n) {
  const rnd = lcg(kind.length * 7919 + n);
  const times = [], opens = [], highs = [], lows = [], closes = [], vols = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    let ret;
    if (kind === 'up') ret = 0.004 + (rnd() - 0.5) * 0.02;
    else if (kind === 'down') ret = -0.004 + (rnd() - 0.5) * 0.02;
    else if (kind === 'flat') ret = 0;
    else ret = Math.sin(i / 6) * 0.012 + (rnd() - 0.5) * 0.02;
    const open = price, close = Math.max(1, open * (1 + ret));
    times.push('2026-01-' + String((i % 28) + 1).padStart(2, '0'));
    opens.push(+open.toFixed(4)); closes.push(+close.toFixed(4));
    highs.push(+(Math.max(open, close) * (1 + rnd() * 0.01)).toFixed(4));
    lows.push(+(Math.min(open, close) * (1 - rnd() * 0.01)).toFixed(4));
    vols.push(Math.round(1e6 + rnd() * 5e6));
    price = close;
  }
  return { times, opens, highs, lows, closes, vols, series: { closes, highs, lows } };
}
const SETS = [['up', 140], ['down', 140], ['wave', 140], ['wave', 40], ['up', 20], ['flat', 80]].map(([k, n]) => ({ name: k + n, d: makeSeries(k, n) }));

/* รหัสเหตุผลของ calc → คีย์ข้อความเดิมของแต่ละหน้า (ฝั่ง + / −) */
const WHY = {
  th: { pro: { cheapRange: 'whyCheap', rsiLow: 'whySellEase', momUp: 'whyMomUp', uptrend: 'whyUptrend', bbLow: 'whyLowerBand' },
        con: { expensiveRange: 'whyExpensive', rsiHigh: 'whyHot', momDn: 'whyMomDn', downtrend: 'whyDowntrend', bbHigh: 'whyUpperBand' }, neutral: 'whyMidRange' },
  us: { pro: { cheapRange: 'whyCheapRange', rsiLow: 'whyRsiLow', momUp: 'whyMomUp', uptrend: 'whyUptrend', bbLow: 'whyBbLow' },
        con: { expensiveRange: 'whyExpensiveRange', rsiHigh: 'whyRsiHigh', momDn: 'whyMomDn', downtrend: 'whyDowntrend', bbHigh: 'whyBbHigh' }, neutral: 'whyNeutral' },
  btc: { pro: { cheapRange: 'proCheapRange', rsiLow: 'proRsiLow', momUp: 'proMomUp', uptrend: 'proUptrend', bbLow: 'proBbLow' },
         con: { expensiveRange: 'conExpRange', rsiHigh: 'conRsiHigh', momDn: 'conMomDn', downtrend: 'conDowntrend', bbHigh: 'conBbHigh' }, neutral: 'whyNeutral' },
};
WHY.gold = WHY.us; WHY.comm = WHY.us;
const VERDICT = { th: ['vGood', 'vWait', 'vBad'], us: ['vInteresting', 'vWait', 'vCareful'], btc: ['verdictGreen', 'verdictYellow', 'verdictRed'], gold: ['vInterestingGold', 'vMidGold', 'vCarefulGold'], comm: ['vInteresting', 'vMid', 'vCareful'] };
const PSAR = { th: true, us: true, btc: true, gold: false, comm: false };

function sameNum(a, b, msg) {
  if (Number.isNaN(a)) expect(Number.isNaN(b), msg).toBe(true);
  else expect(a, msg).toBe(b);
}
/** เทียบ object ที่มีตัวเลข/NaN ซ้อนกัน แบบตรงทุกหลัก (ใช้ toEqual — NaN เท่ากับ NaN) */
function eq(a, b, msg) { expect(a, msg).toEqual(b); }

test.describe('known-answer: invest-calc.js เทียบฟังก์ชันเดิม', () => {
  for (const s of SETS) {
    test('อินดิเคเตอร์ตรงทุกหลัก — ' + s.name, () => {
      const d = s.d, c = d.closes;
      for (const page of ['th', 'us', 'btc']) {
        const f = O[page];
        for (const n of [5, 14, 20, 50]) {
          sameNum(C.sma(c, n), f.sma(c, n), page + ' sma ' + n);
          eq(C.smaSeries(c, n), f.smaSeries(c, n), page + ' smaSeries ' + n);
          eq(C.emaSeries(c, n), f.emaSeries(c, n), page + ' emaSeries ' + n);
          sameNum(C.emaLast(c, n), f.emaLast(c, n), page + ' emaLast ' + n);
        }
        sameNum(C.rsi(c, 14), f.rsi(c, 14), page + ' rsi');
        eq(C.rsiSeries(c, 14), f.rsiSeries(c, 14), page + ' rsiSeries');
        eq(C.macd(c), f.macd(c), page + ' macd');
        eq(C.bollinger(c, 20, 2), f.bollinger(c, 20, 2), page + ' bollinger');
        sameNum(C.atr(d.highs, d.lows, c, 14), f.atr(d.highs, d.lows, c, 14), page + ' atr');
        eq(C.supRes(d.highs, d.lows, 20), f.supRes(d.highs, d.lows, 20), page + ' supRes');
        sameNum(C.adx(d.highs, d.lows, c, 14), f.adx(d.highs, d.lows, c, 14), page + ' adx');
        eq(C.psar(d.highs, d.lows), f.psar(d.highs, d.lows), page + ' psar');
        eq(C.toSeries(d.times, d.opens, d.highs, d.lows, c, d.vols), f.toSeries(d.times, d.opens, d.highs, d.lows, c, d.vols), page + ' toSeries');
      }
      // ทอง/สินค้าโภคภัณฑ์เดิมไม่มี PSAR และ toSeries แบบเบา — เทียบเฉพาะที่มี
      for (const page of ['gold', 'comm']) {
        const f = O[page];
        sameNum(C.rsi(c, 14), f.rsi(c, 14), page + ' rsi');
        eq(C.macd(c), f.macd(c), page + ' macd');
        sameNum(C.adx(d.highs, d.lows, c, 14), f.adx(d.highs, d.lows, c, 14), page + ' adx');
        eq(C.bollinger(c, 20, 2), f.bollinger(c, 20, 2), page + ' bollinger');
      }
      const ts = C.toSeries(d.times, d.opens, d.highs, d.lows, c, d.vols), gs = O.gold.toSeries(d.times, d.opens, d.highs, d.lows, c, d.vols);
      eq(ts.ohlc, gs.ohlc, 'gold ohlc'); eq(ts.closes, gs.closes, 'gold closes');
    });

    test('analyzeSeries + sellVerdict ตรงของเดิม (ไฟ/คะแนน/เหตุผล/ระดับราคา) — ' + s.name, () => {
      for (const page of ['th', 'us', 'btc', 'gold', 'comm']) {
        const f = O[page], d = s.d.series, W = WHY[page];
        const o = f.analyzeSeries(d), n = C.analyzeSeries(d, { psar: PSAR[page] });
        expect(n.light, page).toBe(o.light);
        expect(n.score, page).toBe(o.score);
        expect(o.verdict, page).toBe(VERDICT[page][o.light === 'green' ? 0 : o.light === 'yellow' ? 1 : 2]);
        eq(n.pros.map((c) => W.pro[c]), o.pros, page + ' pros');
        eq(n.cons.map((c) => W.con[c]), o.cons, page + ' cons');
        expect(W.pro[n.why] || W.con[n.why] || (n.why === 'neutral' ? W.neutral : undefined), page + ' why').toBe(o.why);
        eq(n.reasons.filter((r) => r.sign > 0).map((r) => r.code), n.pros, page + ' reasons+'); eq(n.reasons.filter((r) => r.sign < 0).map((r) => r.code), n.cons, page + ' reasons-');
        for (const k of ['price', 'suggestStop', 'resistance', 'uptrend', 'rsi', 'adx']) sameNum(n[k], o[k], page + ' ' + k);
        for (const k of Object.keys(o.det)) {
          if (k === 'psar') eq(n.det.psar, o.det.psar, page + ' det.psar');
          else sameNum(n.det[k], o.det[k], page + ' det.' + k);
        }
        if (PSAR[page]) eq(n.psar, o.psar, page + ' psar');
      }
      // ควรขาย? (หุ้นไทย/นอก/BTC)
      const SELL = {
        th: { head: { sarDown: 'sellSarDn', belowTrend: 'sellBelowTrend', hotRsi: 'sellHotRsi', nearResist: 'sellNearResist', hold: 'sellHold' },
              reason: { sarNoData: 'sarNoData', sarUp: 'sarUpReason', sarDown: 'sarDnReason', stopNoData: 'noData', stopReason: 'stopRiskReason', ema20NoData: 'noData', ema20: 'ema20Reason', resistNoData: 'noData', resist: 'resistReason' } },
        btc: { head: { sarDown: 'sellVerdictSar', belowTrend: 'sellVerdictTrend', hotRsi: 'sellVerdictRsi', nearResist: 'sellVerdictResist', hold: 'sellVerdictGo' },
               reason: { sarNoData: 'lvSarReasonNoData', sarUp: 'lvSarReasonUp', sarDown: 'lvSarReasonDown', stopNoData: 'lvStopReasonNoData', stopReason: 'lvStopReason', ema20NoData: 'lvEma20ReasonNoData', ema20: 'lvEma20Reason', resistNoData: 'lvResistReasonNoData', resist: 'lvResistReason' } },
      };
      SELL.us = SELL.th;
      for (const page of ['th', 'us', 'btc']) {
        const f = O[page], M = SELL[page];
        const oa = f.analyzeSeries(s.d.series), na = C.analyzeSeries(s.d.series);
        // วนหลายสถานการณ์ของราคาปัจจุบัน เพื่อให้ทุกกิ่งของ sellVerdict ถูกเดิน
        const variants = [{}, { rsi: 75 }, { uptrend: false }, { price: (oa.resistance || 1) * 0.99 }, { price: (oa.resistance || 1) * 0.5 },
          { det: { psar: { sar: 90, up: false } } }, { det: { psar: { sar: 90, up: true } } }, { det: { psar: null } }, { suggestStop: NaN }, { resistance: NaN }];
        for (const v of variants) {
          const a1 = Object.assign({}, oa, v, { det: Object.assign({}, oa.det, v.det || {}) });
          const a2 = Object.assign({}, na, v, { det: Object.assign({}, na.det, v.det || {}) });
          if (v.det && 'psar' in v.det) { a1.det.psar = v.det.psar; a2.det.psar = v.det.psar; }
          const o = f.sellVerdict(a1), n = C.sellVerdict(a2);
          expect(n.cls, page).toBe(o.cls);
          expect(M.head[n.code], page + ' headline').toBe(o.headline);
          expect(n.levels.length).toBe(o.levels.length);
          n.levels.forEach((lv, i) => {
            expect(lv.key).toBe(o.levels[i].key); expect(lv.type).toBe(o.levels[i].type);
            sameNum(lv.price, o.levels[i].price, page + ' level ' + lv.key);
            const orig = o.levels[i].reason;
            let want = M.reason[lv.reasonCode];
            if (lv.reasonCode === 'stopReason' && page === 'btc' && isFinite(lv.atr)) want += 'lvStopAtrSuffix';
            expect(want, page + ' ' + lv.key + ' reason').toBe(orig);
          });
        }
      }
    });
  }

  test('analyzeSimple ตรงของเดิม', () => {
    for (const page of ['th', 'us', 'btc', 'gold']) {
      for (const [p, hi, lo] of [[10, 20, 5], [19, 20, 5], [12, 20, 5], [7, 7, 7]]) {
        const o = O[page].analyzeSimple(p, hi, lo), n = C.analyzeSimple(p, hi, lo);
        expect(n.light).toBe(o.light);
        for (const k of ['price', 'suggestStop', 'resistance']) sameNum(n[k], o[k], k);
        sameNum(n.det.posRange, o.det.posRange, 'posRange'); expect(n.pct).toBe(Math.round(o.det.posRange * 100));
        expect(n.simple).toBe(true);
      }
    }
  });

  test('riskCalc 4+1 แบบ ตรงของเดิมทุกหลัก', () => {
    const NOTE = { th: { minLot: 'minLotNote', capitalLimit: 'capitalLimitNote' }, us: { minShare: 'minShareNote', capitalLimit: 'capitalLimitNote' }, btc: { capitalLimit: 'riskCapLimitedNote' }, gold: { capitalLimit: 'rcCapLimitedNote' }, comm: { capitalLimit: 'rcCapLimitedNote' } };
    const ERR = { th: 'stopMustBeLower', us: 'stopMustBeLower', btc: 'riskErrStop', gold: 'rcErrStop', comm: 'rcErrStop' };
    const cases = [
      { capital: 300000, riskPct: 2, entry: 35.5, stop: 33, comm: 0.157, commMin: 50, resistance: 40 },
      { capital: 100000, riskPct: 1, entry: 250, stop: 240, comm: 0.1, commMin: 100, resistance: 270 },
      { capital: 5000, riskPct: 2, entry: 120, stop: 100, comm: 0.2, commMin: NaN, resistance: NaN },
      { capital: 1000, riskPct: 5, entry: 500, stop: 490, comm: 0.1, resistance: 510 },
      { capital: 300000, riskPct: 2, entry: 100, stop: 100, comm: 0.157, resistance: 110 },
      { capital: 300000, riskPct: 2, entry: 100, stop: 110, comm: 0.157, resistance: 110 },
      { capital: 250000, riskPct: 1, entry: 45000, stop: 43000, comm: 0.1, resistance: 50000, usdPrice: 2400, usdResistance: 2600 },
      { capital: 20000, riskPct: 2, entry: 42000, stop: 41000, comm: 0.1, resistance: 44000, usdPrice: 2400, usdResistance: 2300 },
    ];
    for (const page of ['th', 'us', 'btc', 'gold', 'comm']) {
      const fn = page === 'comm' ? 'markets' : page;
      for (const c of cases) {
        const o = O[page].riskCalc(c), n = C.riskCalc[fn](c);
        if (o.error) { expect(n.error, page).toBe('stopMustBeLower'); expect(o.error).toBe(ERR[page]); continue; }
        const nn = Object.assign({}, n), oo = Object.assign({}, o);
        expect(nn.note === '' ? '' : NOTE[page][nn.note], page + ' note').toBe(oo.note);
        delete nn.note; delete oo.note;
        eq(nn, oo, page + ' ' + JSON.stringify(c));
      }
    }
  });

  test('checklist.* ตรงของเดิม (ok + ข้อความ) ทุกหน้า', () => {
    const TXT = {
      th: { trendUp: 'trendUpAdx', trendDn: 'trendNotUpAdx', adxStrong: 'adxStrongTxt', adxWeak: 'adxWeakTxt', noChase: 'notChasing', chasing: 'chasing', trendNeedData: 'needChartFirst', rsiOk: 'rsiOk', rsiHot: 'rsiHot', rsiNeedData: 'rsiNeedChart', stopSet: 'stopSetOk', stopUnset: 'stopNotSet', riskOk: 'riskOk', riskHigh: 'riskHigh', rrOk: 'rrOk', rrLow: 'rrLow', rrNeedData: 'rrNeedInfo' },
      us: { trendUp: 'chkTrendUp', trendDn: 'chkTrendDn', adxStrong: 'chkAdxStrong', adxWeak: 'chkAdxWeak', noChase: 'chkNoChase', chasing: 'chkChasing', trendNeedData: 'chkTrendUnknown', rsiOk: 'chkRsiOk', rsiHot: 'chkRsiHot', rsiNeedData: 'chkRsiUnknown', stopSet: 'chkStopSet', stopUnset: 'chkStopUnset', riskOk: 'chkRiskOk', riskHigh: 'chkRiskHigh', rrOk: 'chkRrOk', rrLow: 'chkRrLow', rrNeedData: 'chkRrUnknown' },
      btc: { trendUp: 'chkTrendUp', trendDn: 'chkTrendDn', adxStrong: 'chkAdxSuffix', adxWeak: 'chkAdxSuffix', noChase: 'chkNoChase', chasing: 'chkChasing', trendNeedData: 'chkTrendNeedData', rsiOk: 'chkRsiOk', rsiHot: 'chkRsiHot', rsiNeedData: 'chkRsiNeedData', stopSet: 'chkStopSet', stopUnset: 'chkStopUnset', riskOk: 'chkRiskOk', riskHigh: 'chkRiskHigh', rrOk: 'chkRrOk', rrLow: 'chkRrLow', rrNeedData: 'chkRrNeedData', leverageYes: 'chkLeverageYes', leverageNo: 'chkLeverageNo', leverageUnknown: 'chkLeverageUnknown' },
    };
    TXT.gold = Object.assign({}, TXT.btc, { spotYes: 'chkSpotYes', spotNo: 'chkSpotNo', spotUnknown: 'chkSpotUnknown' });
    TXT.comm = TXT.btc;
    const IDS = { th: ['entry', 'stop', 'riskPct'], us: ['entry', 'stop', 'riskPct'], btc: ['entry', 'stop', 'riskPct'], gold: ['rcEntry', 'rcStop', 'rcRiskPct'], comm: ['rcEntry', 'rcStop', 'rcRiskPct'] };
    const inputs = [[100, 95, 1], [100, 95, 2], [100, 95, 3], [100, 105, 1], [NaN, NaN, NaN], [150, 90, 2], [100, 95, 0.5]];
    for (const page of ['th', 'us', 'btc', 'gold', 'comm']) {
      const f = O.fresh[page](), fn = page === 'comm' ? 'markets' : page, W = TXT[page], ids = IDS[page];
      for (const s of SETS) {
        const oa = f.analyzeSeries(s.d.series), na = C.analyzeSeries(s.d.series, { psar: PSAR[page] });
        for (const [entry, stop, riskPct] of inputs) for (const answer of ['yes', 'no', null]) for (const useA of [true, false]) {
          const inp = {}; inp[ids[0]] = isFinite(entry) ? entry : ''; inp[ids[1]] = isFinite(stop) ? stop : ''; inp[ids[2]] = isFinite(riskPct) ? riskPct : '';
          f.__set(useA ? oa : null, inp, answer);
          const o = f.checklistChecks();
          const n = C.checklist[fn]({ a: useA ? na : null, entry, stop, riskPct, answer });
          expect(n.length, page).toBe(o.length);
          n.forEach((it, i) => {
            expect(it.ok, page + ' #' + i).toBe(o[i].ok);
            let txt = W[it.code];
            expect(txt, page + ' มีคีย์ข้อความสำหรับ ' + it.code).toBeTruthy();
            if (it.code === 'trendUp' || it.code === 'trendDn') {
              if (isFinite(it.vars.adx)) txt += it.vars.adxStrong ? W.adxStrong : W.adxWeak;
            }
            expect(txt, page + ' #' + i + ' ' + it.code).toBe(o[i].txt);
          });
        }
      }
    }
    expect(C.checklistVerdict([{ ok: true }, { ok: null }])).toEqual({ fails: 0, unknowns: 1, verdict: 'unknown' });
    expect(C.checklistVerdict([{ ok: false }, { ok: null }]).verdict).toBe('fail');
    expect(C.checklistVerdict([{ ok: true }]).verdict).toBe('go');
  });

  test('DCA ทอง/BTC/กองทุน + เติมไม้ตอนย่อ ตรงของเดิม', () => {
    const o1 = O.btc.simulateBtcDCA(5000, 60000, 12, 36), n1 = C.simulateDCA(5000, 60000, 12, 36);
    const o2 = O.gold.simulateGoldDCA(3000, 42000, 8, 24), n2 = C.simulateDCA(3000, 42000, 8, 24);
    eq({ qty: n1.qty, price: n1.price, value: n1.value, contrib: n1.contrib, series: n1.series.map((r) => ({ month: r.month, price: r.price, qty: r.qty, value: r.value, contrib: r.contrib })) }, o1, 'btc dca');
    eq({ weight: n2.weight, price: n2.price, value: n2.value, contrib: n2.contrib, series: n2.series.map((r) => ({ month: r.month, price: r.price, weight: r.weight, value: r.value, contrib: r.contrib })) }, o2, 'gold dca');
    for (const f of [O.thfund, O.gfund]) {
      for (const p of [{ years: 10, cagr: 8, fee: 1.5, dy: 3, accM: 5000, divM: 5000 }, { years: 0.5, cagr: 0, fee: 0, dy: 0, accM: 1000, divM: 0 }, { years: 20, cagr: 10, fee: 0.5, dy: 4, accM: 0, divM: 8000 }]) {
        eq(C.fundPlan(p), f.plan(p), 'fundPlan');
      }
      eq(C.simulateFund(1000, 6, 12, 2), f.simulate(1000, 6, 12, 2), 'simulateFund');
    }
    expect(C.drawdown(85, 100)).toMatchObject({ mult: 1.25, zone: 'tier' });
    expect(C.drawdown(65, 100).mult).toBe(2); expect(C.drawdown(75, 100).mult).toBe(1.5);
    expect(C.drawdown(99.5, 100).zone).toBe('nearAth');
    expect(C.drawdown(95, 100).zone).toBe('normal');
    expect(C.drawdown(NaN, 100)).toBeNull();
  });

  test('กองทุนไทย: วันพร้อมขาย (HOLD_RULES) ตรงของเดิม', () => {
    const y = (yr) => new Date(yr, 5, 1).getTime();
    for (const cat of ['ssf', 'esg', 'rmf']) {
      for (const first of [2022, 2024, 2026, 2027, 2033]) for (const by of [null, 1990]) {
        const purchases = [{ ts: y(first + 1) }, { ts: y(first) }];
        const o = O.thfund.eligibilityFor(cat, purchases.map((p) => ({ ts: p.ts })), by), n = C.eligibilityFor(cat, purchases, by);
        expect(n.readyYear).toBe(o.readyYear);
        expect(!!n.needsBirthYear).toBe(!!o.needsBirthYear);
      }
    }
    expect(C.eligibilityFor('ssf', [], null)).toBeNull();
    expect(C.eligibilityFor('general', [{ ts: 1 }], null)).toBeNull();
    for (const yr of [2023, 2024, 2026, 2027, 2032, 2040]) expect(C.esgHoldRule(yr).holdYears).toBe(O.thfund.esgRuleForYear(yr).holdYears);
    // ตารางปีถือครองต้องไม่มีเพดาน/ขั้นภาษี (อ่านจาก tax-rules เท่านั้น)
    expect(JSON.stringify(C.HOLD_RULES)).not.toMatch(/cap|bracket/i);
  });

  test('พันธบัตร: PV/YTM/ตารางดอกเบี้ย/เทียบเงินฝาก ตรงของเดิม', () => {
    const B = O.bond;
    expect(C.bondPV(1500, 100000, 10, 0.015)).toBe(B.bondPV(1500, 100000, 10, 0.015));
    for (const [price, face, cpn, freq, yrs] of [[98000, 100000, 3, 2, 5], [100000, 100000, 2.5, 1, 3], [105000, 100000, 4, 4, 2], [NaN, 100000, 3, 2, 5], [100000, 100000, 3, 2, 0]]) {
      sameNum(C.solveYTM(price, face, cpn, freq, yrs), B.solveYTM(price, face, cpn, freq, yrs), 'ytm');
    }
    for (const [pd, md, freq] of [['2025-01-31', '2030-01-31', 2], ['2025-03-15', '2028-03-15', 1], ['2025-01-01', '2026-01-01', 4], ['2025-06-30', '2025-06-30', 2], ['2025-01-10', '2025-12-20', 2]]) {
      const a = C.couponSchedule(C.parseYMD(pd), C.parseYMD(md), freq, 100000, 3), b = B.couponSchedule(B.parseYMD(pd), B.parseYMD(md), freq, 100000, 3);
      eq(a.map((r) => ({ d: r.date.getTime(), c: r.coupon, p: r.principal, t: r.total })), b.map((r) => ({ d: r.date.getTime(), c: r.coupon, p: r.principal, t: r.total })), 'couponSchedule');
    }
    eq(C.compareDeposit(100000, 5, 3000, 1.5), B.compareDeposit(100000, 5, 3000, 1.5), 'compareDeposit');
    expect(C.addMonths(C.parseYMD('2025-01-31'), 1).getTime()).toBe(B.addMonths(B.parseYMD('2025-01-31'), 1).getTime());
    expect(C.parseYMD('')).toBeNull();
  });

  test('สลากออมสิน/ธ.ก.ส./สลากกินแบ่ง ตรงของเดิม', () => {
    const tiers = [{ label: 'รางวัลที่ 1', amount: 1000000, winners: 5, totalUnits: 1000000 }, { label: 'รางวัลที่ 2', amount: 10000, winners: 300, totalUnits: 1000000 }, { label: 'x', amount: 0, winners: 0, totalUnits: 0 }];
    for (const L of [O.gsb, O.baac]) {
      expect(C.evPerUnitPerDraw(tiers)).toBe(L.evPerUnitPerDraw(tiers));
      sameNum(C.probAtLeastOnePerDraw(tiers, 200), L.probAtLeastOnePerDraw(tiers, 200), 'prob');
      expect(C.expectedTotalPrize(tiers, 200, 36)).toBe(L.expectedTotalPrize(tiers, 200, 36));
      expect(C.guaranteedRedemption(20000, 1.5, 3)).toBe(L.guaranteedRedemption(20000, 1.5, 3));
      for (const ex of [true, false]) eq(C.totalExpectedReturn(20000, 1.5, 3, tiers, 200, 36, ex), L.totalExpectedReturn(20000, 1.5, 3, tiers, 200, 36, ex), 'totalExpectedReturn');
      sameNum(C.annualizedExpectedReturnPct(1500, 20000, 3), L.annualizedExpectedReturnPct(1500, 20000, 3), 'ann');
      sameNum(C.annualizedExpectedReturnPct(1500, 0, 3), L.annualizedExpectedReturnPct(1500, 0, 3), 'ann0');
      const ex = C.totalExpectedReturn(20000, 1.5, 3, tiers, 200, 36, false);
      eq(C.compareLotteryVsDeposit(20000, 3, ex, 1.5), L.compareLotteryVsDeposit(20000, 3, ex, 1.5), 'vsDeposit');
      expect(C.parseDrawDays('1,16')).toEqual(L.parseDrawDays('1,16')); expect(C.parseDrawDays('')).toEqual(L.parseDrawDays(''));
      for (const [pd, md, days] of [['2025-01-01', '2028-01-01', [16]], ['2025-01-15', '2026-02-28', [1, 16]], ['2025-01-31', '2025-06-30', [31]]]) {
        const a = C.drawSchedule(C.parseYMD(pd), C.parseYMD(md), days), b = L.drawSchedule(L.parseYMD(pd), L.parseYMD(md), days);
        eq(a.map((r) => r.date.getTime()), b.map((r) => r.date.getTime()), 'drawSchedule');
      }
      expect(C.ymd(new Date(2026, 9, 3))).toBe(L.ymd(new Date(2026, 9, 3)));
    }
    // สลากกินแบ่ง
    const txt = 'https://example\nFIRST 123456\nSECOND 111111 222222\nTHIRD 333333\nTHREE_FIRST 123 456\nTHREE_LAST 789 012\nTWO 34\nNEAR_FIRST 123455 123457\nFOURTH 444444\nFIFTH 555555\nUNKNOWN 1';
    const L = O.lottery;
    eq(C.parseDrawText(txt, '2026-10-01'), L.parseDrawText(txt, '2026-10-01'), 'parseDrawText');
    expect(C.parseDrawText('', 'x')).toBeNull();
    for (const [a, b] of [['2020-01-01', '2020-12-31'], ['2015-04-20', '2016-01-31'], ['2024-11-01', '2025-02-28']]) {
      eq(C.candidateDrawDates(new Date(a + 'T00:00:00'), new Date(b + 'T00:00:00')), L.candidateDrawDates(new Date(a + 'T00:00:00'), new Date(b + 'T00:00:00')), 'candidateDrawDates');
    }
    const draw = C.parseDrawText(txt, '2026-10-01');
    const cache = { '2026-10-01': draw, '2026-09-16': Object.assign({}, draw, { date: '2026-09-16', twoDigit: '12' }) };
    eq(C.drawsInWindow(cache, new Date(2026, 8, 1), new Date(2026, 9, 30)), L.drawsInWindow(cache, new Date(2026, 8, 1), new Date(2026, 9, 30)), 'drawsInWindow');
    const draws = C.drawsInWindow(cache, new Date(2026, 8, 1), new Date(2026, 9, 30));
    for (const f of ['twoDigit', 'threeFirst', 'threeLast']) eq(C.frequencyTable(draws, f), L.frequencyTable(draws, f), 'freq ' + f);
    for (const tr of ['first', 'second']) eq(C.digitPositionFrequency(draws, tr), L.digitPositionFrequency(draws, tr), 'digit ' + tr);
    const CODE = { first: 'hitFirst', second: 'hitSecond', third: 'hitThird', nearFirst: 'hitNearFirst', fourth: 'hitFourth', fifth: 'hitFifth', threeFront: 'hitThreeFront', threeBack: 'hitThreeBack', twoDigit: 'hitTwoDigit' };
    for (const tk of ['123456', '111111', '999034', '123789', '000012', '12345', 'abc']) {
      const o = L.checkTicket(tk, draw), n = C.checkTicket(tk, draw);
      if (!o) { expect(n).toBeNull(); continue; }
      expect(n.hits.map((h) => CODE[h])).toEqual(o.hits); expect(n.ticket).toBe(o.ticket); expect(n.drawDate).toBe(o.drawDate);
    }
  });

  test('parseYahoo/parseQuoteLite/parseGoldTH/parseFxRate/parseFng/parsePaste ตรงของเดิม', () => {
    const t0 = 1767225600; // 2026-01-01
    const j = { chart: { result: [{ timestamp: Array.from({ length: 30 }, (_, i) => t0 + i * 86400), meta: { regularMarketPrice: 36.5, previousClose: 36.1 },
      indicators: { quote: [{ open: Array.from({ length: 30 }, (_, i) => 30 + i * 0.1), high: Array.from({ length: 30 }, (_, i) => 31 + i * 0.1), low: Array.from({ length: 30 }, (_, i) => 29 + i * 0.1), close: Array.from({ length: 30 }, (_, i) => (i === 7 ? null : 30.5 + i * 0.1)), volume: Array.from({ length: 30 }, (_, i) => i * 1000) }] } }] } };
    for (const page of ['th', 'us', 'btc']) eq(C.parseYahoo(j), O[page].parseYahoo(j), page + ' parseYahoo');
    expect(() => C.parseYahoo({})).toThrow(); expect(() => C.parseYahoo({ chart: { result: [{ timestamp: [1, 2], indicators: { quote: [{ close: [1, 2] }] } }] } })).toThrow();
    const q = C.parseQuoteLite(j), oq = O.gold.parseQuoteLite(JSON.stringify(j));
    expect(q.price).toBe(oq.price); expect(q.prevClose).toBe(oq.prevClose); expect(q.prev).toBe(36.1); expect(q.spark.length).toBe(29);
    expect(() => C.parseQuoteLite({})).toThrow();
    expect(C.parseFxRate(j)).toBe(O.btc.parseFxRate(JSON.stringify(j))); expect(C.parseFxRate({ chart: { result: [{ meta: {}, indicators: { quote: [{ close: [null, 35.2, null] }] } }] } })).toBe(35.2);
    expect(() => C.parseFxRate({ chart: { result: [{ meta: { regularMarketPrice: 0 } }] } })).toThrow();
    const g = { response: { update_date: '3 ต.ค. 2569', update_time: '09:00', price: { gold_bar: { buy: '42,000.00', sell: '42,100.00' }, gold: { buy: '41,000.00', sell: '41,500.00' } } } };
    eq(C.parseGoldTH(g), O.gold.parseGoldTH(JSON.stringify(g)), 'parseGoldTH');
    expect(() => C.parseGoldTH({ response: {} })).toThrow();
    const f = { data: [{ value: '55', value_classification: 'Greed', timestamp: '1767225600' }] };
    eq(C.parseFng(f), O.btc.parseFng(JSON.stringify(f)), 'parseFng');
    expect(() => C.parseFng({ data: [] })).toThrow();
    const NOW = new Date('2026-10-03T03:00:00Z').getTime();
    const pp = C.parsePaste('10 11 12 13 14 15 16', NOW), po = O.th.parsePaste('10 11 12 13 14 15 16');
    expect(pp.closes).toEqual(po.closes); expect(pp.highs).toEqual(po.highs); expect(pp.lows).toEqual(po.lows);
    expect(C.parsePaste('1 2', NOW)).toBeNull();
  });
});

/* ── ตัวอย่างหัวข้อ 6.4 (now = 2026-10-03T03:00:00Z = 10:00 เวลาไทย) ── */
const NOW = new Date('2026-10-03T03:00:00Z').getTime();
function sample() {
  const data = {
    thstock: [{ sym: 'PTT', shares: 200, cost: 32, ts: 1 }, { sym: 'PTT', shares: 100, cost: 36, ts: 2 }, { sym: 'AOT', shares: 500, cost: 60, ts: 3, cur: 58 }],
    globalstock: [{ sym: 'AAPL', shares: 3, cost: 150, ts: 4 }],
    btc: [{ qty: 0.01, cost: 60000, ts: 5 }],
    gold: [{ type: 'bar', unit: 'baht', amt: 40000, price: 40000, weight: 1, ts: 6 }, { type: 'jewelry', unit: 'gram', amt: 21000, price: 2770.45, weight: 7.58, ts: 7 }],
    thaifund: [{ fund: 'K-RMF', cat: 'rmf', amt: 10000, nav: 10, units: 1000, ts: 8 }],
    spfund: [{ cls: 'สะสมมูลค่า', amt: 5000, nav: 20, units: 250, ts: 9 }],
    govbond: [{ name: 'LB30', purchDate: '2025-01-01', maturity: '2030-01-01', face: 100000, coupon: 3, freq: 2, ts: 10 }, { name: 'LB26', purchDate: '2024-01-01', maturity: '2026-01-01', face: 50000, coupon: 2.5, freq: 2, ts: 11 }],
    gsblottery: [{ name: 'ออมสิน 3 ปี', purchDate: '2025-01-01', maturity: '2028-01-01', unitPrice: 100, units: 200, drawFreq: '16', evPerDraw: 0, results: {}, ts: 12 }],
    baaclottery: [],
  };
  const store = {
    'tanot:invest:cache:PTT': { ts: NOW, c: [30, 31, 32, 34.5] },
    'tanot:invest:cache:q:AAPL': { ts: NOW, price: 200 },
    'tanot:invest:cache:q:BTC-USD': { ts: NOW, price: 100000 },
    'tanot:invest:fxcache': { ts: NOW, rate: 36.5 },
    'tanot:invest:cache:gold:th': { barSellPrice: 42000, jewelrySellPrice: 41000, ts: NOW },
    'tanot:invest:nav': { 'th:K-RMF': { nav: 11, d: '2026-10-02' } },
  };
  return { data, store };
}
const readOf = (store) => (k) => (k in store ? store[k] : null);
const near2 = (a, b) => expect(Math.abs(a - b)).toBeLessThan(0.005);

test.describe('known-answer: มูลค่าสินทรัพย์ลงทุน (หัวข้อ 6.4)', () => {
  test('ตัวอย่างครบทุก class + เงินสมมติไม่ถูกนับ', () => {
    const { data, store } = sample();
    data.portfolio = { cash: 1000000, startCash: 1000000, holdings: [{ sym: 'PTT', shares: 1000, avgCost: 30 }], tx: [] };
    const p = C.collectPrices(readOf(store), data);
    expect(p.fx).toBe(36.5);
    const nw = C.netWorth(data, p, p.fx, NOW);
    const want = { stockTh: [39350, 40000], stockUs: [21900, 16425], crypto: [36500, 21900], gold: [62500, 61000], fundTh: [11000, 10000], fundGlobal: [5000, 5000], bond: [100000, 100000], savingsLottery: [20000, 20000] };
    for (const c of C.CLASSES) { near2(nw.byClass[c].value, want[c][0]); near2(nw.byClass[c].cost, want[c][1]); }
    near2(nw.total, 296250); near2(nw.cost, 274325); near2(nw.pl, 21925);
    expect(nw.plPct.toFixed(2)).toBe('7.99');
    expect(nw.missingFx).toBe(false); expect(nw.maturedCount).toBe(1); expect(nw.stale).toBe(false);
    expect(C.CLASSES).toEqual(['stockTh', 'stockUs', 'crypto', 'gold', 'fundTh', 'fundGlobal', 'bond', 'savingsLottery']);
    // แหล่งราคาของแต่ละแถว
    const src = (cls, key) => nw.rows.find((r) => r.cls === cls && r.key === key).src;
    expect(src('stockTh', 'PTT')).toBe('market'); expect(src('stockTh', 'AOT')).toBe('manual'); expect(src('stockUs', 'AAPL')).toBe('market');
    expect(src('gold', 'bar')).toBe('market'); expect(src('fundTh', 'K-RMF')).toBe('manual'); expect(src('fundGlobal', 'สะสมมูลค่า')).toBe('cost');
    expect(src('bond', 'LB30')).toBe('cost');
    // ทองรูปพรรณ: 7.58 กรัม / 15.16 = 0.5 บาททองคำ ใช้ราคารับซื้อรูปพรรณ
    const jew = nw.rows.find((r) => r.cls === 'gold' && r.key === 'jewelry');
    near2(jew.qty, 0.5); near2(jew.valueCcy, 20500);
  });

  test('ไม่มีอัตราแลกเปลี่ยน: ไม่นับแถว USD และไม่เดาอัตรา', () => {
    const { data, store } = sample();
    delete store['tanot:invest:fxcache'];
    const p = C.collectPrices(readOf(store), data);
    expect(p.fx).toBeNull();
    const nw = C.netWorth(data, p, p.fx, NOW);
    near2(nw.total, 237850); near2(nw.cost, 236000);
    expect(nw.missingFx).toBe(true); expect(nw.fx).toBeNull();
    const usd = nw.rows.filter((r) => r.ccy === 'USD'); expect(usd.length).toBe(2);
    for (const r of usd) { expect(r.valueThb).toBeNull(); expect(r.costThb).toBeNull(); }
    near2(nw.byClass.stockUs.value, 0); near2(nw.byClass.crypto.value, 0);
    // quote THB=X ในแคช quote ใช้แทนได้
    store['tanot:invest:cache:q:THB=X'] = { ts: NOW, price: 35 };
    const p2 = C.collectPrices(readOf(store), data); expect(p2.fx).toBe(35);
  });

  test('ราคาเก่า → stale · cur ใช้เมื่อไม่มีแคช · แคช q ใหม่กว่า series → ใช้ q · ไม่มีอะไรเลย → ต้นทุน', () => {
    const { data, store } = sample();
    // PTT: series ใหม่ (34.5 @ NOW) แต่มี q เก่ากว่า → ใช้ series; แล้วลองให้ q ใหม่กว่า
    store['tanot:invest:cache:q:PTT.BK'] = { ts: NOW - 1000, price: 99 };
    let nw = C.netWorth(data, C.collectPrices(readOf(store), data), 36.5, NOW);
    near2(nw.rows.find((r) => r.key === 'PTT').price, 34.5);
    store['tanot:invest:cache:q:PTT.BK'] = { ts: NOW + 1000, price: 40 };
    nw = C.netWorth(data, C.collectPrices(readOf(store), data), 36.5, NOW);
    near2(nw.rows.find((r) => r.key === 'PTT').valueCcy, 300 * 40);
    // แคชเก่า > 3 วัน → stale แต่ยังใช้
    store['tanot:invest:cache:PTT'] = { ts: NOW - 4 * 86400000, c: [30, 31, 32, 34.5] }; delete store['tanot:invest:cache:q:PTT.BK'];
    nw = C.netWorth(data, C.collectPrices(readOf(store), data), 36.5, NOW);
    const ptt = nw.rows.find((r) => r.key === 'PTT'); expect(ptt.stale).toBe(true); expect(ptt.src).toBe('market'); expect(nw.stale).toBe(true);
    // ไม่มีแคช/cur ของหุ้นเลย → ต้นทุนเฉลี่ย
    delete store['tanot:invest:cache:PTT'];
    nw = C.netWorth(data, C.collectPrices(readOf(store), data), 36.5, NOW);
    const p2 = nw.rows.find((r) => r.key === 'PTT'); expect(p2.src).toBe('cost'); near2(p2.valueCcy, 10000);
    // cur: ใช้ของแถวที่ ts ใหม่สุดที่มี cur
    const d2 = JSON.parse(JSON.stringify(data)); d2.thstock = [{ sym: 'XYZ', shares: 10, cost: 5, ts: 1, cur: 6 }, { sym: 'XYZ', shares: 10, cost: 5, ts: 2, cur: 7 }, { sym: 'XYZ', shares: 10, cost: 5, ts: 3 }];
    nw = C.netWorth(d2, C.collectPrices(readOf({}), d2), 36.5, NOW);
    const x = nw.rows.find((r) => r.key === 'XYZ'); near2(x.price, 7); expect(x.src).toBe('manual'); near2(x.valueCcy, 210);
    // ไม่มีข้อมูลเลย
    nw = C.netWorth({}, C.collectPrices(readOf({}), {}), null, NOW);
    expect(nw.n).toBe(0); expect(nw.total).toBe(0); expect(Number.isNaN(nw.plPct)).toBe(true);
  });

  test('พันธบัตร/สลากครบกำหนดแล้วไม่นับ · วันนี้ตามเวลาไทย', () => {
    const { data, store } = sample();
    // 2026-10-02 17:00Z = 3 ต.ค. 00:00 ไทย; พันธบัตรครบ 2026-10-03 = ครบแล้ว, 2026-10-04 ยังไม่ครบ
    const d = JSON.parse(JSON.stringify(data));
    d.govbond = [{ name: 'A', maturity: '2026-10-03', face: 1000, ts: 1 }, { name: 'B', maturity: '2026-10-04', face: 2000, ts: 2 }];
    d.gsblottery = []; d.baaclottery = [{ name: 'C', maturity: '2026-10-03', unitPrice: 100, units: 5, ts: 3 }, { name: 'D', maturity: '2027-01-01', unitPrice: 100, units: 7, ts: 4 }];
    const nw = C.netWorth(d, C.collectPrices(readOf(store), d), 36.5, new Date('2026-10-02T17:00:00Z').getTime());
    near2(nw.byClass.bond.value, 2000); near2(nw.byClass.savingsLottery.value, 700); expect(nw.maturedCount).toBe(2);
    const nw2 = C.netWorth(d, C.collectPrices(readOf(store), d), 36.5, new Date('2026-10-02T16:59:59Z').getTime());
    near2(nw2.byClass.bond.value, 3000); expect(nw2.maturedCount).toBe(0);
  });
});

test.describe('known-answer: วันที่ไทย + snapshot', () => {
  test('thaiDate', () => {
    expect(C.thaiDate(new Date('2026-10-02T17:00:00Z').getTime())).toBe('2026-10-03');
    expect(C.thaiDate(new Date('2026-10-02T16:59:59Z').getTime())).toBe('2026-10-02');
    expect(C.thaiDate(NOW)).toBe('2026-10-03');
  });
  test('snapshotRow + shouldWriteSnapshot ทุกกิ่ง', () => {
    const { data, store } = sample();
    const nw = C.netWorth(data, C.collectPrices(readOf(store), data), 36.5, NOW);
    const row = C.snapshotRow(nw, NOW);
    expect(row).toMatchObject({ d: '2026-10-03', v: 296250, c: 274325, fx: 36.5, n: nw.n, ts: NOW });
    expect(Object.keys(row.parts)).toEqual(C.CLASSES);
    expect(row.parts.gold).toBe(62500);
    // ยังไม่มีแถวของวันนั้น → เขียน
    expect(C.shouldWriteSnapshot(undefined, row, NOW)).toBe(true);
    expect(C.shouldWriteSnapshot({ d: '2026-10-02', v: 296250, ts: NOW - 1 }, row, NOW)).toBe(true);
    // มีแล้ว ค่าเท่าเดิม → ไม่เขียน
    expect(C.shouldWriteSnapshot(Object.assign({}, row, { ts: NOW - 7200000 }), row, NOW)).toBe(false);
    // เปลี่ยน ≥ 0.1% แต่ห่างไม่ถึง 1 ชม. → ไม่เขียน · ครบ 1 ชม. → เขียน
    const moved = Object.assign({}, row, { v: row.v * 1.002 });
    expect(C.shouldWriteSnapshot(Object.assign({}, row, { ts: NOW - 1800000 }), moved, NOW)).toBe(false);
    expect(C.shouldWriteSnapshot(Object.assign({}, row, { ts: NOW - 3600000 }), moved, NOW)).toBe(true);
    // เปลี่ยน < 0.1% → ไม่เขียน
    const tiny = Object.assign({}, row, { v: row.v * 1.0005 });
    expect(C.shouldWriteSnapshot(Object.assign({}, row, { ts: NOW - 7200000 }), tiny, NOW)).toBe(false);
    // prev.v = 0
    expect(C.shouldWriteSnapshot({ d: row.d, v: 0, ts: NOW - 7200000 }, row, NOW)).toBe(true);
    // ไม่มีสินทรัพย์เลย → ไม่เขียน
    const empty = C.snapshotRow(C.netWorth({}, C.collectPrices(readOf({}), {}), null, NOW), NOW);
    expect(empty.n).toBe(0); expect(C.shouldWriteSnapshot(undefined, empty, NOW)).toBe(false);
    // ปัดเศษ 2 ตำแหน่งตอนเก็บ ไม่ปัดระหว่างคำนวณ
    const odd = { total: 100.005, cost: 1 / 3, fx: null, n: 1, byClass: Object.fromEntries(C.CLASSES.map((c) => [c, { value: 1 / 3, cost: 0, n: 0 }])) };
    const r2 = C.snapshotRow(odd, NOW); expect(r2.v).toBe(100.01); expect(r2.c).toBe(0.33); expect(r2.parts.gold).toBe(0.33);
  });
  test('คีย์ series/quote ตามตาราง 3.5', () => {
    expect(C.seriesKey('PTT.BK')).toBe('tanot:invest:cache:PTT');
    expect(C.seriesKey('BTC-USD')).toBe('tanot:invest:cache:btc:BTC-USD');
    expect(C.seriesKey('GC=F')).toBe('tanot:invest:cache:gold:GC=F');
    expect(C.seriesKey('CL=F')).toBe('tanot:invest:cache:comm:s:CL=F');
    expect(C.seriesKey('THB=X')).toBe('tanot:invest:cache:comm:s:THB=X');
    expect(C.seriesKey('DX-Y.NYB')).toBe('tanot:invest:cache:comm:s:DX-Y.NYB');
    expect(C.seriesKey('AAPL')).toBe('tanot:invest:cache:us:AAPL');
    expect(C.quoteKey('PTT.BK')).toBe('tanot:invest:cache:q:PTT.BK');
  });
});

test.describe('known-answer: สมุดเทรดรวม', () => {
  const th = [{ sym: 'PTT', en: 30, ex: 33, sh: 100, pl: 300, ts: 3 }, { sym: 'AOT', en: 60, ex: 55, sh: 100, pl: -500, ts: 1 }];
  const us = [{ sym: 'AAPL', en: 100, ex: 110, sh: 2, pl: 20, ts: 2 }];
  const btc = [{ en: 60000, ex: 66000, qty: 0.01, pl: 60, ts: 4 }, { en: 70000, ex: 69000, qty: 0.01, pl: -10, ts: 5 }];
  test('journalRows normalize 3 คีย์ (แถว BTC ไม่มี sym)', () => {
    const rows = C.journalRows(th, us, btc);
    expect(rows.length).toBe(5);
    expect(rows[0]).toEqual({ market: 'th', key: 'thjournal', ts: 3, sym: 'PTT', entry: 30, exit: 33, qty: 100, pl: 300, ccy: 'THB' });
    expect(rows[2]).toEqual({ market: 'us', key: 'globaljournal', ts: 2, sym: 'AAPL', entry: 100, exit: 110, qty: 2, pl: 20, ccy: 'USD' });
    expect(rows[3]).toEqual({ market: 'btc', key: 'btcjournal', ts: 4, sym: 'BTC', entry: 60000, exit: 66000, qty: 0.01, pl: 60, ccy: 'USD' });
    expect(C.journalRows(null, undefined, [])).toEqual([]);
  });
  test('journalStats สูตรเดิม (ชนะ = pl > 0, expectancy)', () => {
    const rows = C.journalRows(th, us, btc);
    const s = C.journalStats(rows.filter((r) => r.market === 'th'));
    expect(s).toEqual({ n: 2, wins: 1, losses: 1, winRate: 50, total: -200, avgWin: 300, avgLoss: 500, expectancy: 0.5 * 300 - 0.5 * 500 });
    const b = C.journalStats(rows.filter((r) => r.market === 'btc'));
    expect(b.n).toBe(2); expect(b.total).toBe(50); expect(b.winRate).toBe(50); expect(b.expectancy).toBe(0.5 * 60 - 0.5 * 10);
    expect(C.journalStats([])).toEqual({ n: 0, wins: 0, losses: 0, winRate: 0, total: 0, avgWin: 0, avgLoss: 0, expectancy: 0 });
    // pl = 0 นับเป็นไม่ชนะ (เหมือน renderJournal เดิม)
    expect(C.journalStats([{ pl: 0 }]).wins).toBe(0);
  });
});
