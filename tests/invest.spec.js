// @ts-check
// ยุบรวมหน้าลงทุน (docs/invest-consolidation-design.md) — ROADMAP Phase 6
// ส่วนที่ 1 (node ล้วน, หัวข้อ 8.1 ข้อ 1–4): invest-calc.js เทียบกับ tests/fixtures/invest-original.js (สำเนาฟังก์ชันเดิม ห้ามแก้)
// และ known-answer ของมูลค่าสินทรัพย์/วันที่ไทย/snapshot/สมุดเทรด
const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepare } = require('./helpers');

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


/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 2: invest-core.js + หน้าข่าว (ขั้น 2)
   ═══════════════════════════════════════════════════════════════════ */
const FORBIDDEN_HOSTS = /allorigins|codetabs|cors\.eu\.org|cors\.workers\.dev|cors\.lol|rss2json|tanot-cors-proxy/;
const FONT_HOSTS = /^fonts\.(googleapis|gstatic)\.com$/;

/** เก็บชื่อโฮสต์ของทุกคำขอที่ออกนอก localhost (ที่ prepare() บล็อกไว้) */
function trackExternal(page) {
  const hosts = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') return;
    hosts.push(u.hostname);
  });
  return hosts;
}
/** จำลอง /api/proxy ของเว็บ: handler(urlปลายทาง) คืน {status, body, contentType} หรือ null = 502 */
async function mockProxy(page, handler) {
  const seen = [];
  await page.addInitScript(() => { window.TANOT_PROXY = { enabled: true }; });
  await page.route('**/api/proxy?*', (route) => {
    const target = new URL(route.request().url()).searchParams.get('url');
    seen.push(target);
    const r = handler(target);
    if (!r) return route.fulfill({ status: 502, body: 'down' });
    return route.fulfill({ status: r.status || 200, contentType: r.contentType || 'application/json', body: typeof r.body === 'string' ? r.body : JSON.stringify(r.body) });
  });
  return seen;
}
function rssXml(items) {
  return '<?xml version="1.0"?><rss><channel>' + items.map((i) => `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.pub}</pubDate><source>${i.src}</source></item>`).join('') + '</channel></rss>';
}
function yahooChart(n, base) {
  const t0 = 1767225600;
  const ts = Array.from({ length: n }, (_, i) => t0 + i * 86400);
  const mk = (f) => Array.from({ length: n }, (_, i) => +(base + i * 0.1 + f).toFixed(2));
  return { chart: { result: [{ timestamp: ts, meta: { regularMarketPrice: base + n * 0.1, previousClose: base + n * 0.1 - 0.5 },
    indicators: { quote: [{ open: mk(0), high: mk(0.5), low: mk(-0.5), close: mk(0.1), volume: ts.map((_, i) => 1000 + i) }] } }] } };
}
const NEWS_ITEMS = [{ title: 'ตลาดหุ้นไทยปิดบวก', link: 'https://example.com/a', pub: 'Fri, 02 Oct 2026 08:00:00 GMT', src: 'สำนักข่าว A' }, { title: 'SET พุ่ง <b>แรง</b>', link: 'https://example.com/b', pub: 'Fri, 02 Oct 2026 07:00:00 GMT', src: 'B' }];

test.describe('invest-core + หน้าข่าว', () => {
  test('ข่าวผ่าน /api/proxy เท่านั้น: แสดงรายการ + เขียนแคช newscache:q: + ไม่ออกโฮสต์อื่น + มีแถบหมวดย่อย', async ({ page }) => {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    const seen = await mockProxy(page, (u) => (u.startsWith('https://news.google.com/rss/search') ? { contentType: 'application/xml', body: rssXml(NEWS_ITEMS) } : null));
    await page.clock.setFixedTime(new Date('2026-10-03T03:00:00Z'));
    await page.goto('/invest-news.html');
    await expect(page.locator('.news-item')).toHaveCount(2);
    await expect(page.locator('.news-item').first()).toContainText('ตลาดหุ้นไทยปิดบวก');
    await expect(page.locator('.news-item .src').first()).toHaveText('สำนักข่าว A');
    // หัวข้อที่มี HTML ในข้อความต้องไม่กลายเป็นแท็กจริง
    await expect(page.locator('.news-item b')).toHaveCount(0);
    expect(seen.length).toBe(1);
    expect(decodeURIComponent(seen[0])).toContain('q=');
    const key = 'tanot:invest:newscache:q:ตลาดหุ้นไทย OR SET Index';
    const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    expect(cached.items).toHaveLength(2);
    // แถบหมวดย่อยแถวเดียว: ภาพรวม + หน้าลงทุน และหน้านี้ active
    await expect(page.locator('#ivSubRow a').first()).toHaveText('ภาพรวม');
    await expect(page.locator('#ivSubRow a.on')).toHaveText('ข่าวหุ้น');
    expect(hosts.filter((h) => !FONT_HOSTS.test(h))).toEqual([]);
    expect(hosts.filter((h) => FORBIDDEN_HOSTS.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ข่าว: ดึงไม่ได้แต่มีแคช = ใช้ที่บันทึกไว้ · ไม่มีแคช = ลิงก์ค้นเอง (ไม่ใช่ error แข็ง)', async ({ page }) => {
    const errors = await prepare(page);
    await mockProxy(page, () => null);
    await page.addInitScript(() => {
      localStorage.setItem('tanot:invest:newscache:q:ตลาดหุ้นไทย OR SET Index', JSON.stringify({ ts: Date.now() - 5 * 3600e3, items: [{ title: 'ข่าวเก่าที่บันทึกไว้', link: 'https://example.com/x', pubDate: '', source: 'S' }] }));
    });
    await page.goto('/invest-news.html');
    await expect(page.locator('.news-item')).toHaveCount(1);
    await expect(page.locator('#srcBadge')).toContainText('ใช้ข่าวที่บันทึกไว้');
    // เปลี่ยนชิปที่ไม่มีแคช → ข้อความ + ลิงก์ Google News
    await page.locator('.chip[data-key="econ"]').click();
    await expect(page.locator('.news-empty a')).toHaveAttribute('href', /news\.google\.com\/search/);
    expect(errors.filter((e) => !/502|Failed to load resource/.test(e))).toEqual([]);
  });

  test('InvestCore: series/quote/fx/ทองไทย/กลัว-โลภ เขียนแคชตามชื่อเดิม · ดึงไม่ได้ = คืนแคช stale · ไม่มีแคช = reject', async ({ page }) => {
    await prepare(page);
    const hosts = trackExternal(page);
    let down = false;
    const seen = await mockProxy(page, (u) => {
      if (down) return null;
      if (/finance\.yahoo\.com\/v8\/finance\/chart\/THB%3DX|chart\/THB=X/.test(u)) return { body: { chart: { result: [{ meta: { regularMarketPrice: 36.1 }, indicators: { quote: [{ close: [36, 36.1] }] } }] } } };
      if (/range=1y/.test(u)) return { body: yahooChart(40, 30) };
      if (/range=5d/.test(u)) return { body: yahooChart(5, 100) };
      if (/chnwt\.dev/.test(u)) return { body: { response: { update_date: 'x', update_time: 'y', price: { gold_bar: { buy: '42,000.00', sell: '42,100.00' }, gold: { buy: '41,000.00', sell: '41,500.00' } } } } };
      if (/alternative\.me/.test(u)) return { body: { data: [{ value: '61', value_classification: 'Greed', timestamp: '1' }] } };
      return null;
    });
    await page.goto('/invest-news.html');
    await page.waitForFunction(() => window.InvestCore);
    const r = await page.evaluate(async () => {
      const IC = window.InvestCore, out = {};
      out.series = (await IC.series('PTT.BK')).series.closes.length;
      out.us = (await IC.series('AAPL')).series.closes.length;
      out.quote = await IC.quote('BTC-USD', { force: true });
      out.fx = await IC.fx('USD');
      out.gold = await IC.thaiGold();
      out.fng = await IC.fng();
      out.keys = ['tanot:invest:cache:PTT', 'tanot:invest:cache:us:AAPL', 'tanot:invest:cache:q:BTC-USD', 'tanot:invest:fxcache', 'tanot:invest:cache:gold:th', 'tanot:invest:cache:fng'].map((k) => [k, !!localStorage.getItem(k)]);
      out.shape = Object.keys(JSON.parse(localStorage.getItem('tanot:invest:cache:PTT'))).sort();
      out.qshape = Object.keys(JSON.parse(localStorage.getItem('tanot:invest:cache:q:BTC-USD'))).sort();
      return out;
    });
    expect(r.series).toBe(40); expect(r.us).toBe(40);
    expect(r.quote).toMatchObject({ stale: false }); expect(r.quote.spark.length).toBe(5);
    expect(r.fx).toMatchObject({ rate: 36.1, stale: false });
    expect(r.gold).toMatchObject({ barBuyPrice: 42100, barSellPrice: 42000, jewelrySellPrice: 41000, stale: false });
    expect(r.fng).toMatchObject({ value: 61, classification: 'Greed', stale: false });
    expect(r.keys.every(([, ok]) => ok), JSON.stringify(r.keys)).toBe(true);
    expect(r.shape).toEqual(['c', 'h', 'l', 'o', 't', 'ts', 'v']); expect(r.qshape).toEqual(['prev', 'price', 'spark', 'ts']);
    // ทองไทยลองตรงก่อน (ถูกบล็อก) แล้วค่อย proxy
    expect(hosts).toContain('api.chnwt.dev'); expect(hosts).toContain('api.alternative.me');
    expect(hosts.filter((h) => FORBIDDEN_HOSTS.test(h))).toEqual([]);
    expect(seen.some((u) => /chnwt\.dev/.test(u))).toBe(true);
    // เซิร์ฟเวอร์ล่ม → แคชเดิมพร้อม stale · สัญลักษณ์ที่ไม่เคยมีแคช → reject
    down = true;
    const r2 = await page.evaluate(async () => {
      const IC = window.InvestCore, out = {};
      out.series = (await IC.series('PTT.BK')).stale;
      out.quote = (await IC.quote('BTC-USD', { force: true })).stale;
      out.fx = (await IC.fx('USD', { force: true })).stale;
      out.gold = (await IC.thaiGold({ force: true })).stale;
      out.fng = (await IC.fng({ force: true })).stale;
      out.noCache = await IC.series('ZZZZ.BK').then(() => 'ok', () => 'rejected');
      out.noFx = (localStorage.removeItem('tanot:invest:fxcache'), await IC.fx('USD', { force: true }).then(() => 'ok', () => 'rejected'));
      return out;
    });
    expect(r2).toEqual({ series: true, quote: true, fx: true, gold: true, fng: true, noCache: 'rejected', noFx: 'rejected' });
  });

  test('ล้างแคชเก่า: แคชที่ไม่ใช้แล้วหาย · คีย์ข้อมูลผู้ใช้ไม่หายสักคีย์ · ทำครั้งเดียวต่อเครื่อง', async ({ page }) => {
    await prepare(page);
    await mockProxy(page, () => null);
    const USER = {
      'tanot:invest:thstock': [{ sym: 'PTT', shares: 1, cost: 1, ts: 1 }], 'tanot:invest:thjournal': [{ sym: 'A', en: 1, ex: 2, sh: 1, pl: 1, ts: 2 }],
      'tanot:invest:globalstock': [{ sym: 'AAPL', shares: 1, cost: 1, ts: 3 }], 'tanot:invest:globaljournal': [], 'tanot:invest:btc': [{ qty: 1, cost: 1, ts: 4 }], 'tanot:invest:btcjournal': [],
      'tanot:invest:gold': [{ type: 'bar', unit: 'baht', amt: 1, price: 1, weight: 1, ts: 5 }], 'tanot:invest:thaifund': [{ fund: 'K', cat: 'rmf', amt: 1, nav: 1, units: 1, ts: 6 }],
      'tanot:invest:thaifund:birthyear': '1990', 'tanot:invest:spfund': [], 'tanot:invest:govbond': [], 'tanot:invest:gsblottery': [], 'tanot:invest:gsblottery:tiers': { unitPrice: '100' },
      'tanot:invest:baaclottery': [], 'tanot:invest:baaclottery:tiers': {}, 'tanot:invest:bizplan': [], 'tanot:invest:portfolio': { cash: 1, startCash: 1, holdings: [], tx: [] },
      'tanot:invest:lottery:spins': [], 'tanot:invest:lottery:budget': '100', 'tanot:invest:hub:watch:thai': ['PTT'], 'tanot:invest:hub:history': [{ d: '2026-10-01', v: 1 }],
      'tanot:invest:driveConnected': '1', 'tanot:invest:gold:driveConnected': '1', 'tanot:aiChat:noBigModel': '1', 'tanot:market:live-config:v1': { provider: 'yahoo', apiKey: 'k' },
    };
    const OLD = ['tanot:invest:cache:hub:q:bk:PTT', 'tanot:invest:cache:hub:fng', 'tanot:invest:cache:comm:q:CL=F', 'tanot:invest:newscache:PTT', 'tanot:invest:newscache:us:AAPL', 'tanot:invest:newscache:hub:ปันผล',
      'tanot:invest:cache:comm:thaigold', 'tanot:invest:cache:btc:fng', 'tanot:invest:cache:gold:dxy', 'tanot:invest:cache:gold:tnx'];
    const KEEP_CACHE = ['tanot:invest:newscache:q:x', 'tanot:invest:cache:PTT', 'tanot:invest:cache:us:AAPL', 'tanot:invest:cache:gold:th', 'tanot:invest:fxcache', 'tanot:invest:cache:comm:s:CL=F'];
    await page.addInitScript(([user, old, keep]) => {
      if (localStorage.getItem('tanot:invest:ui')) return; // ครั้งเดียว: โหลดซ้ำไม่ seed ทับ
      Object.entries(user).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
      old.concat(keep).forEach((k) => localStorage.setItem(k, '{"ts":1}'));
    }, [USER, OLD, KEEP_CACHE]);
    await page.goto('/invest-news.html');
    await page.waitForFunction(() => window.InvestCore && JSON.parse(localStorage.getItem('tanot:invest:ui') || '{}').cleaned === 1);
    const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    for (const k of OLD) expect(after[k], k).toBeUndefined();
    for (const k of KEEP_CACHE) expect(after[k], k).toBeDefined();
    for (const [k, v] of Object.entries(USER)) expect(after[k], k).toBe(typeof v === 'string' ? v : JSON.stringify(v));
    // รอบสอง: แคชเก่าที่โผล่มาใหม่ไม่ถูกลบซ้ำ (ธงตั้งแล้ว)
    await page.evaluate(() => localStorage.setItem('tanot:invest:cache:hub:fng', '{"ts":2}'));
    await page.reload();
    await page.waitForFunction(() => window.InvestCore);
    expect(await page.evaluate(() => localStorage.getItem('tanot:invest:cache:hub:fng'))).toBe('{"ts":2}');
  });

  test('คีย์ใหม่อยู่ใน registry: ui = local, nav = sync map, networth = sync list (id d) · แคชเป็น cache', async ({ page }) => {
    await prepare(page);
    await page.goto('/invest-news.html');
    const c = await page.evaluate(() => ['tanot:invest:ui', 'tanot:invest:nav', 'tanot:invest:networth', 'tanot:invest:cache:q:PTT.BK', 'tanot:invest:newscache:q:x', 'tanot:market:live-config:v1'].map((k) => [k, window.TanotRegistry.classify(k)]));
    expect(c[0][1]).toMatchObject({ kind: 'local' });
    expect(c[1][1]).toMatchObject({ kind: 'sync', mode: 'map' });
    expect(c[2][1]).toMatchObject({ kind: 'sync', mode: 'list', idField: 'd' });
    expect(c[3][1].kind).toBe('cache'); expect(c[4][1].kind).toBe('cache'); expect(c[5][1].kind).toBe('local');
  });

  test('proxy.js: api.chnwt.dev อยู่ใน allowlist · โฮสต์นอกรายการยัง 403 (ไม่เป็น open proxy)', async () => {
    // functions/api/proxy.js เป็น ESM แต่ไม่มี package.json type=module — รันซอร์สจริงด้วย Function โดยตัดคำว่า export
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'api', 'proxy.js'), 'utf8').replace('export async function onRequestGet', 'async function onRequestGet');
    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (u) => { calls.push(String(u)); return new Response('{"ok":1}', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    const onRequestGet = new Function(src + '; return onRequestGet;')();
    try {
      const ok = await onRequestGet({ request: new Request('https://x.pages.dev/api/proxy?url=' + encodeURIComponent('https://api.chnwt.dev/thai-gold-api/latest')) });
      expect(ok.status).toBe(200); expect(calls).toEqual(['https://api.chnwt.dev/thai-gold-api/latest']);
      for (const bad of ['https://api.allorigins.win/raw', 'https://evil.example/x', 'http://api.chnwt.dev/x']) {
        const r = await onRequestGet({ request: new Request('https://x.pages.dev/api/proxy?url=' + encodeURIComponent(bad)) });
        expect(r.status, bad).toBe(403);
      }
      expect(calls.length).toBe(1);
    } finally { globalThis.fetch = realFetch; }
  });
});

/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 3: การ์ด "สินทรัพย์ลงทุน" บนหน้าวันนี้ + snapshot (ขั้น 3, หัวข้อ 8.1 ข้อ 8)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('การ์ดสินทรัพย์ลงทุน (หน้าวันนี้)', () => {
  /** เปิดหน้าวันนี้ด้วยข้อมูลตัวอย่าง 6.4 ณ NOW (10:00 เวลาไทย) */
  async function open(page, { withFx = true, init } = {}) {
    const errors = await prepare(page);
    const s = sample();
    await page.addInitScript((payload) => {
      if (localStorage.getItem('__seeded')) return; // โหลดซ้ำ/รีโหลดไม่ seed ทับ
      const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      Object.keys(payload.data).forEach((k) => S('tanot:invest:' + k, payload.data[k]));
      Object.keys(payload.store).forEach((k) => { if (payload.withFx || k !== 'tanot:invest:fxcache') S(k, payload.store[k]); });
      S('tanot:invest:portfolio', { cash: 1000000, startCash: 1000000, holdings: [{ sym: 'PTT', shares: 1000, avgCost: 30 }], tx: [] });
      if (payload.init) Object.keys(payload.init).forEach((k) => S(k, payload.init[k]));
      localStorage.setItem('__seeded', '1');
    }, { data: s.data, store: s.store, withFx, init });
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/index.html', { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');
    return errors;
  }
  const nwRows = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:networth') || '[]'));

  test('ยอดรวม ฿296,250 · P/L +฿21,925 (7.99%) · แถวละประเภท · เขียน snapshot 1 แถวของวันนี้ (เวลาไทย)', async ({ page }) => {
    const errors = await open(page);
    const inv = page.locator('#investBody');
    await expect(inv.locator('[data-i=total]')).toHaveText('฿296,250');
    await expect(inv.locator('[data-i=pl]')).toContainText('+฿21,925');
    await expect(inv.locator('[data-i=pl]')).toContainText('7.99%');
    await expect(inv.locator('[data-i=nofx]')).toHaveCount(0);
    // แถบสัดส่วน 8 ประเภท + รายการสูงสุด 4 แถวเรียงตามมูลค่า
    await expect(inv.locator('.alloc > i')).toHaveCount(8);
    await expect(inv.locator('.list-row')).toHaveCount(4);
    await expect(inv.locator('.list-row').first()).toContainText('LB30'); // ฿100,000
    await expect(inv.locator('.list-row').nth(1)).toContainText('ทองแท่ง'); // ฿42,000
    await expect(inv.locator('.list-row').first()).toHaveAttribute('href', 'invest-gov-bond.html');
    // snapshot: 1 แถว d = 2026-10-03 (10:00 ไทย) พร้อม parts ครบ 8 ประเภท
    const rows = await nwRows(page);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ d: '2026-10-03', v: 296250, c: 274325, fx: 36.5 });
    expect(Object.keys(rows[0].parts)).toEqual(C.CLASSES);
    // เปิดซ้ำวันเดียวกัน (ค่าเท่าเดิม) ไม่เพิ่มแถว
    await page.reload(); await page.waitForSelector('#investBody [data-i=total]');
    expect(await nwRows(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('พอร์ตจำลองไม่ถูกนับ (เปลี่ยนเงินสมมติแล้วยอดไม่ขยับ)', async ({ page }) => {
    await open(page, { init: { 'tanot:invest:portfolio': { cash: 99999999, startCash: 1, holdings: [{ sym: 'PTT', shares: 99999, avgCost: 1 }], tx: [] } } });
    await expect(page.locator('#investBody [data-i=total]')).toHaveText('฿296,250');
  });

  test('ไม่มีอัตราแลกเปลี่ยน → ฿237,850 + ป้ายเตือน ไม่เดาอัตรา · snapshot บันทึกยอดที่นับได้ fx = null', async ({ page }) => {
    await open(page, { withFx: false });
    await expect(page.locator('#investBody [data-i=total]')).toHaveText('฿237,850');
    await expect(page.locator('#investBody [data-i=nofx]')).toContainText('ไม่รวมสินทรัพย์ USD');
    const rows = await nwRows(page);
    expect(rows[0]).toMatchObject({ d: '2026-10-03', v: 237850, c: 236000, fx: null });
  });

  test('เปลี่ยนแปลง 30 วัน: เทียบแถว snapshot ล่าสุดที่เก่า ≥ 30 วัน · แถวเก่าไม่ถูกแตะ/ลบ', async ({ page }) => {
    const old = [{ d: '2026-08-20', v: 200000, c: 190000, parts: {}, fx: 36, n: 8, ts: 1 }, { d: '2026-09-03', v: 250000, c: 240000, parts: {}, fx: 36, n: 8, ts: 2 }, { d: '2026-09-20', v: 280000, c: 260000, parts: {}, fx: 36, n: 8, ts: 3 }];
    await open(page, { init: { 'tanot:invest:networth': old } });
    // 3 ต.ค. − 30 วัน = 3 ก.ย. → ใช้แถว 2026-09-03 (250,000) → +18.5%
    await expect(page.locator('#investBody [data-i=change]')).toContainText('+18.5%');
    const rows = await nwRows(page);
    expect(rows).toHaveLength(4);
    expect(rows.slice(0, 3)).toEqual(old);
    expect(rows[3].d).toBe('2026-10-03');
  });

  test('วันเดียวกัน: ค่าเปลี่ยน ≥ 0.1% แต่ห่างไม่ถึง 1 ชม. ไม่เขียน · ครบ 1 ชม. เขียนทับแถวเดิม (ไม่เพิ่มแถว)', async ({ page }) => {
    // แถววันนี้เขียนไว้เมื่อ 30 นาทีก่อนด้วยมูลค่าต่างไป 1%
    const prev = { d: '2026-10-03', v: 293000, c: 274325, parts: {}, fx: 36.5, n: 8, ts: NOW - 1800000 };
    await open(page, { init: { 'tanot:invest:networth': [prev] } });
    await expect(page.locator('#investBody [data-i=total]')).toHaveText('฿296,250');
    expect(await nwRows(page)).toEqual([prev]);
    // ผ่านไป 2 ชม. → เขียนทับแถว d เดิม
    await page.clock.setFixedTime(new Date(NOW + 2 * 3600e3));
    await page.reload(); await page.waitForSelector('#investBody [data-i=total]');
    const rows = await nwRows(page);
    expect(rows).toHaveLength(1); expect(rows[0].v).toBe(296250); expect(rows[0].ts).toBe(NOW + 2 * 3600e3);
  });

  test('ไม่มีสินทรัพย์ → empty state ไม่เขียน snapshot', async ({ page }) => {
    const errors = await prepare(page);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/index.html'); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#investBody .empty')).toContainText('ยังไม่มีสินทรัพย์ลงทุน');
    expect(await page.evaluate(() => localStorage.getItem('tanot:invest:networth'))).toBeNull();
    expect(errors).toEqual([]);
  });
});

/* ═══ ซิงก์ 2 เครื่อง (เซิร์ฟเวอร์ 8138 มี /__reset — ทั้งกลุ่มรันต่อเนื่อง) ═══ */
const SRV = 'http://localhost:8138';
test.describe('ซิงก์ 2 เครื่อง', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => { await request.get(SRV + '/__reset'); });
  const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
  const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
  async function device(browser, p, { data, caches, nowMs }) {
    const ctx = await browser.newContext({ baseURL: SRV });
    const page = await ctx.newPage();
    const errors = await prepare(page);
    await page.addInitScript(({ data, caches }) => {
      window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
      if (localStorage.getItem('__seeded')) return;
      Object.keys(data).forEach((k) => localStorage.setItem(k, JSON.stringify(data[k])));
      Object.keys(caches || {}).forEach((k) => localStorage.setItem(k, JSON.stringify(caches[k])));
      localStorage.setItem('__seeded', '1');
    }, { data, caches });
    await page.clock.setFixedTime(new Date(nowMs));
    await page.goto(p, { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');
    return { ctx, page, errors };
  }

  test('snapshot วันเดียวกันจาก 2 เครื่อง = 1 แถว (เครื่องที่เขียนทีหลังชนะ) · ข้อมูลหุ้นรวมกันได้', async ({ browser }) => {
    const s = sample();
    const base = { 'tanot:invest:thstock': s.data.thstock };
    // A มีราคาตลาดในแคช (PTT 34.5) · B ไม่มีแคช (ใช้ต้นทุน) → ยอดต่างกัน
    const A = await device(browser, '/index.html', { data: base, caches: { 'tanot:invest:cache:PTT': { ts: NOW, c: [30, 31, 32, 34.5] } }, nowMs: NOW });
    const B = await device(browser, '/index.html', { data: base, caches: {}, nowMs: NOW + 120000 });
    await expect(A.page.locator('#investBody [data-i=total]')).toBeVisible(); await expect(B.page.locator('#investBody [data-i=total]')).toBeVisible();
    const ra = await store(A.page, 'tanot:invest:networth'), rb = await store(B.page, 'tanot:invest:networth');
    expect(ra).toHaveLength(1); expect(rb).toHaveLength(1);
    expect(ra[0].d).toBe('2026-10-03'); expect(rb[0].d).toBe('2026-10-03');
    expect(ra[0].v).not.toBe(rb[0].v);
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const rows = await store(d.page, 'tanot:invest:networth');
      expect(rows, 'หนึ่งแถวต่อวัน').toHaveLength(1);
      expect(rows[0].d).toBe('2026-10-03');
      expect(rows[0].v).toBe(rb[0].v); // B เขียนทีหลัง (นาฬิกาเดินหน้า 2 นาที)
      expect((await store(d.page, 'tanot:invest:thstock')).length).toBe(3);
    }
    for (const d of [A, B]) expect(d.errors).toEqual([]);
    await A.ctx.close(); await B.ctx.close();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 4: หน้าภาพรวม invest.html (ขั้น 4, หัวข้อ 6.7)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('หน้าภาพรวม invest.html', () => {
  async function openHub(page, { withFx = true, init, proxy } = {}) {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    const seen = proxy ? await mockProxy(page, proxy) : [];
    const s = sample();
    await page.addInitScript((payload) => {
      if (localStorage.getItem('__seeded')) return;
      const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      Object.keys(payload.data).forEach((k) => S('tanot:invest:' + k, payload.data[k]));
      Object.keys(payload.store).forEach((k) => { if (payload.withFx || k !== 'tanot:invest:fxcache') S(k, payload.store[k]); });
      S('tanot:invest:portfolio', { cash: 1000000, startCash: 1000000, holdings: [{ sym: 'PTT', shares: 1000, avgCost: 30 }], tx: [] });
      if (payload.init) Object.keys(payload.init).forEach((k) => S(k, payload.init[k]));
      localStorage.setItem('__seeded', '1');
    }, { data: s.data, store: s.store, withFx, init });
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest.html', { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');
    return { errors, hosts, seen };
  }

  test('ยอดเดียวกับหน้าวันนี้ ฿296,250 · P/L · ตาราง 8+ แถวพร้อมแหล่งราคา · พอร์ตจำลองไม่นับ · ไม่มีฟีเจอร์ที่ตัดออก', async ({ page }) => {
    const { errors } = await openHub(page);
    await expect(page.locator('#kValue')).toHaveText('฿296,250');
    await expect(page.locator('#kPl')).toHaveText('+฿21,925');
    await expect(page.locator('#kPlSub')).toContainText('+7.99%');
    await expect(page.locator('#kCount')).toHaveText('10'); // PTT AOT AAPL BTC แท่ง รูปพรรณ กองทุนไทย กองทุนต่างประเทศ LB30 สลาก
    await expect(page.locator('#kCountSub')).toContainText('ครบกำหนดแล้ว 1');
    const rows = page.locator('#assetsBody tbody tr');
    await expect(rows).toHaveCount(10);
    await expect(rows.first()).toContainText('LB30');
    await expect(page.locator('#assetsBody tr', { hasText: 'AOT' })).toContainText('กรอกเอง');
    await expect(page.locator('#assetsBody tr', { hasText: 'K-RMF' })).toContainText('กรอกเอง');
    await expect(page.locator('#assetsBody tr', { hasText: 'สะสมมูลค่า' })).toContainText('ต้นทุน');
    await expect(page.locator('#allocBody circle')).toHaveCount(8);
    // ตัดแล้ว: AI ลอย, ป๊อปอัพ iframe, ช่องค้นหา, Health, รายการที่ต้องทำ, เครื่องมือด่วน
    for (const sel of ['#aiFab', '#toolModalFrame', '#heroSearch', '#healthRing', '#tasksBody', '.qbtn', 'iframe']) await expect(page.locator(sel)).toHaveCount(0);
    // แถวคลิกไปหน้าของสินทรัพย์
    await page.locator('#assetsBody tr', { hasText: 'LB30' }).evaluate((tr) => tr.getAttribute('data-href')).then((h) => expect(h).toBe('invest-gov-bond.html'));
    expect(errors).toEqual([]);
    // หน้าวันนี้ยอดเดียวกัน
    await page.goto('/index.html'); await page.waitForSelector('#investBody [data-i=total]');
    await expect(page.locator('#investBody [data-i=total]')).toHaveText('฿296,250');
  });

  test('ไม่มี FX → ฿237,850 + ป้าย · ช่วงกราฟจำใน ui.chartRange · เขียน snapshot เดียวกับหน้าวันนี้', async ({ page }) => {
    await openHub(page, { withFx: false, init: { 'tanot:invest:networth': [{ d: '2026-09-10', v: 200000, c: 190000, parts: {}, fx: 36, n: 8, ts: 1 }, { d: '2026-09-25', v: 220000, c: 190000, parts: {}, fx: 36, n: 8, ts: 2 }] } });
    await expect(page.locator('#kValue')).toHaveText('฿237,850');
    await expect(page.locator('[data-i=nofx]')).toBeVisible();
    await expect(page.locator('#assetsBody tr', { hasText: 'AAPL' })).toContainText('ไม่มีอัตรา');
    // กราฟ: ค่าเริ่ม 90 วัน = 3 จุด (09-10, 09-25, วันนี้) → มีเส้น · 30 วัน = ตัดแถว 09-10 ออก
    await expect(page.locator('#chartBody polyline')).toHaveCount(1);
    await page.locator('#rangeSeg [data-r="30d"]').click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:ui')).chartRange)).toBe('30d');
    await expect(page.locator('#rangeSeg [data-r="30d"]')).toHaveAttribute('aria-pressed', 'true');
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:networth')));
    expect(rows.map((r) => r.d)).toEqual(['2026-09-10', '2026-09-25', '2026-10-03']);
    await page.reload(); // จำช่วงที่เลือก
    await expect(page.locator('#rangeSeg [data-r="30d"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('รีเฟรชราคา: ดึง quote ของทุกสินทรัพย์ที่ถือ + FX + ทองไทย ผ่าน /api/proxy แล้วยอดเปลี่ยนตามราคาสด · ไม่ออกโฮสต์อื่น', async ({ page }) => {
    const { hosts, seen, errors } = await openHub(page, {
      proxy: (u) => {
        if (/chart\/PTT\.BK/.test(u)) return { body: yahooChart(5, 40) };       // ราคา ~40.5
        if (/chart\/THB%3DX|chart\/THB=X/.test(u)) return { body: { chart: { result: [{ meta: { regularMarketPrice: 40 }, indicators: { quote: [{ close: [40] }] } }] } } };
        if (/chnwt\.dev/.test(u)) return { body: { response: { update_date: 'x', update_time: 'y', price: { gold_bar: { buy: '50,000.00', sell: '50,100.00' }, gold: { buy: '45,000.00', sell: '45,500.00' } } } } };
        if (/range=5d/.test(u)) return { body: yahooChart(5, 100) };
        return null;
      },
    });
    await page.click('#refreshBtn');
    await expect(page.locator('#refreshBtn')).toBeEnabled();
    await expect.poll(async () => (await page.locator('#assetsBody tr', { hasText: 'PTT' }).textContent()) || '').toContain('ตลาด');
    // ทองใช้ราคาใหม่: แท่ง 1 × 50,000 + รูปพรรณ 0.5 × 45,000
    const gold = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:cache:gold:th')));
    expect(gold.barSellPrice).toBe(50000);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:fxcache')).rate)).toBe(40);
    expect(seen.some((u) => /chart\/PTT\.BK/.test(u))).toBe(true);
    expect(hosts.filter((h) => !FONT_HOSTS.test(h) && h !== 'api.chnwt.dev' && h !== 'api.alternative.me')).toEqual([]);
    expect(hosts.filter((h) => FORBIDDEN_HOSTS.test(h))).toEqual([]);
    expect(errors.filter((e) => !/502|Failed to load resource|ERR_/.test(e))).toEqual([]);
  });

  test('ตลาด 3 กลุ่ม: ใช้ราคาแคช/quote · ฟันเฟืองบันทึกคีย์ hub:watch:* เดิม · ลิงก์หุ้นไปหน้าใหม่ ?sym=', async ({ page }) => {
    await openHub(page, { proxy: (u) => (/range=5d/.test(u) ? { body: yahooChart(5, 100) } : null) });
    await expect(page.locator('#mkGrid-thai .ticker')).toHaveCount(6);
    await expect(page.locator('#mkGrid-thai a.ticker').first()).toHaveAttribute('href', /invest-stock\.html\?sym=(PTT|AOT)#th/);
    await page.locator('.gear-btn[data-group="global"]').click();
    await page.locator('#gearPanel-global .gp-check', { hasText: 'Tesla' }).click();
    await page.locator('#gearPanel-global .gp-save').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:hub:watch:global')));
    expect(saved).toContain('TSLA');
    await expect(page.locator('#mkGrid-global .ticker', { hasText: 'TSLA' })).toHaveCount(1);
    // ข้อมูลเก่าที่ปล่อยไว้ไม่ถูกแตะ
    expect(await page.evaluate(() => localStorage.getItem('tanot:invest:hub:history'))).toBeNull();
  });

  test('ข่าว 3 ข่าว + กลัว-โลภ ผ่าน core · คีย์ hub:history เดิมที่มีอยู่ไม่ถูกอ่าน/ลบ', async ({ page }) => {
    const hist = [{ d: '2026-09-01', v: 1234567 }];
    const { errors } = await openHub(page, {
      init: { 'tanot:invest:hub:history': hist },
      proxy: (u) => {
        if (u.startsWith('https://news.google.com/rss/search')) return { contentType: 'application/xml', body: rssXml([1, 2, 3, 4].map((i) => ({ title: 'ข่าว ' + i, link: 'https://example.com/' + i, pub: 'Fri, 02 Oct 2026 08:00:00 GMT', src: 'S' }))) };
        if (/alternative\.me/.test(u)) return { body: { data: [{ value: '25', value_classification: 'Fear', timestamp: '1' }] } };
        return null;
      },
    });
    await expect(page.locator('#newsBody .newsitem')).toHaveCount(3);
    await expect(page.locator('#fngLabel')).toContainText('กลัว');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:hub:history')))).toEqual(hist);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:networth')).length)).toBe(1); // ไม่ต่อกราฟจาก hub:history
    expect(errors.filter((e) => !/502|Failed to load resource|ERR_/.test(e))).toEqual([]);
  });

  test('ไม่มีสินทรัพย์ → empty state · 390px ไม่ล้นแนวนอน', async ({ page }) => {
    const errors = await prepare(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest.html'); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#assetsBody .empty-hint')).toContainText('ยังไม่มีสินทรัพย์ลงทุน');
    await expect(page.locator('#kValue')).toHaveText('฿0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 5: สมุดเทรดรวม (ขั้น 5, หัวข้อ 3.3)
   ═══════════════════════════════════════════════════════════════════ */
const JN = {
  'tanot:invest:thjournal': [{ sym: 'PTT', en: 30, ex: 33, sh: 100, pl: 300, ts: 3, extra: 'keep-me' }, { sym: 'AOT', en: 60, ex: 55, sh: 100, pl: -500, ts: 1 }],
  'tanot:invest:globaljournal': [{ sym: 'AAPL', en: 100, ex: 110, sh: 2, pl: 20, ts: 2 }],
  'tanot:invest:btcjournal': [{ en: 60000, ex: 66000, qty: 0.01, pl: 60, ts: 4 }, { en: 70000, ex: 69000, qty: 0.01, pl: -10, ts: 5 }],
};
test.describe('สมุดเทรดรวม', () => {
  async function openJournal(page, hash = '', { fx = false } = {}) {
    const errors = await prepare(page);
    await page.addInitScript(([jn, fx]) => {
      if (localStorage.getItem('__seeded')) return;
      Object.keys(jn).forEach((k) => localStorage.setItem(k, JSON.stringify(jn[k])));
      if (fx) localStorage.setItem('tanot:invest:fxcache', JSON.stringify({ ts: Date.now(), rate: 36.5 }));
      localStorage.setItem('__seeded', '1');
    }, [JN, fx]);
    await page.goto('/invest-trade-journal.html' + hash, { waitUntil: 'load' });
    await page.waitForSelector('nav.ome-nav');
    return errors;
  }
  const get = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);

  test('#all: รวม 5 ไม้ · P/L แยกสกุล · ≈ บาทเมื่อมีอัตรา · แท็บเดี่ยว: สถิติในสกุลของตลาดนั้น + คาดหวัง/ไม้', async ({ page }) => {
    const errors = await openJournal(page, '', { fx: true });
    await expect(page.locator('#jBox tbody tr')).toHaveCount(5);
    await expect(page.locator('[data-k=n]')).toHaveText('5');
    await expect(page.locator('[data-k=win]')).toHaveText('60%'); // 3 ชนะ (300, 20, 60) จาก 5
    await expect(page.locator('[data-k=plthb]')).toHaveText('−฿200');
    await expect(page.locator('[data-k=plusd]')).toHaveText('+$70');
    await expect(page.locator('[data-k=approx]')).toContainText('฿2,355'); // −200 + 70 × 36.5
    await page.locator('#jTabs [data-tab="th"]').click();
    await expect(page).toHaveURL(/#th$/);
    await expect(page.locator('#jBox tbody tr')).toHaveCount(2);
    await expect(page.locator('[data-k=pl]')).toHaveText('−฿200');
    await expect(page.locator('[data-k=exp]')).toContainText('−฿100'); // 0.5×300 − 0.5×500
    await page.locator('#jTabs [data-tab="btc"]').click();
    await expect(page.locator('#jBox tbody tr')).toHaveCount(2);
    await expect(page.locator('#jBox tbody tr').first()).toContainText('BTC');
    await expect(page.locator('[data-k=pl]')).toHaveText('+$50');
    expect(errors).toEqual([]);
  });

  test('ไม่มีอัตรา USD/THB → ไม่แสดงบรรทัดรวมเป็นบาท', async ({ page }) => {
    await openJournal(page);
    await expect(page.locator('[data-k=plusd]')).toBeVisible();
    await expect(page.locator('[data-k=approx]')).toHaveCount(0);
  });

  test('เพิ่มไม้แต่ละตลาด: เขียนรูปแบบเดิมของคีย์นั้นตรงตัว · แถวเดิมไม่ถูกแตะ (ฟิลด์แปลกปลอมคงอยู่) · BTC ไม่มี sym', async ({ page }) => {
    await openJournal(page, '#all');
    const add = async (market, sym, en, ex, qty) => {
      await page.selectOption('#jMarket', market);
      if (sym) await page.fill('#jSym', sym);
      await page.fill('#jEntry', en); await page.fill('#jExit', ex); await page.fill('#jQty', qty);
      await page.click('#jAdd');
    };
    await add('th', 'ptt', '34', '36', '300');
    await add('us', 'msft', '400', '390', '2');
    await add('btc', '', '60000', '63000', '0.5');
    const th = await get(page, 'tanot:invest:thjournal'), us = await get(page, 'tanot:invest:globaljournal'), btc = await get(page, 'tanot:invest:btcjournal');
    expect(th.slice(0, 2)).toEqual(JN['tanot:invest:thjournal']);
    expect(us.slice(0, 1)).toEqual(JN['tanot:invest:globaljournal']);
    expect(btc.slice(0, 2)).toEqual(JN['tanot:invest:btcjournal']);
    expect(Object.keys(th[2]).sort()).toEqual(['en', 'ex', 'pl', 'sh', 'sym', 'ts']);
    expect(th[2]).toMatchObject({ sym: 'PTT', en: 34, ex: 36, sh: 300, pl: 600 });
    expect(Object.keys(us[1]).sort()).toEqual(['en', 'ex', 'pl', 'sh', 'sym', 'ts']);
    expect(us[1]).toMatchObject({ sym: 'MSFT', pl: -20 });
    expect(Object.keys(btc[2]).sort()).toEqual(['en', 'ex', 'pl', 'qty', 'ts']); // ไม่มี sym
    expect(btc[2]).toMatchObject({ en: 60000, ex: 63000, qty: 0.5, pl: 1500 });
    for (const r of [th[2], us[1], btc[2]]) expect(Number.isInteger(r.ts) && r.ts > 1e12).toBe(true);
    await expect(page.locator('#jBox tbody tr')).toHaveCount(8);
  });

  test('ฟอร์ม: ค่าเริ่ม = แท็บที่เปิด (#all → หุ้นไทย) · BTC ซ่อนช่องชื่อ · ข้อมูลไม่ครบ = ไม่บันทึก', async ({ page }) => {
    await openJournal(page, '#us');
    await expect(page.locator('#jMarket')).toHaveValue('us');
    await page.goto('/invest-trade-journal.html#btc');
    await expect(page.locator('#jMarket')).toHaveValue('btc'); await expect(page.locator('#jSymField')).toBeHidden();
    await page.goto('/invest-trade-journal.html#all');
    await expect(page.locator('#jMarket')).toHaveValue('th');
    await page.fill('#jEntry', '10');
    await page.click('#jAdd');
    await expect(page.locator('dialog.dialog')).toBeVisible();
    await page.locator('dialog.dialog .btn').click();
    expect((await get(page, 'tanot:invest:thjournal')).length).toBe(2);
  });

  test('ลบด้วย ts ในคีย์ต้นทาง: แถวที่โผล่จากอีกเครื่องระหว่างนั้นไม่ถูกลบผิดแถว · ไม่มีปุ่ม Drive', async ({ page }) => {
    await openJournal(page);
    await expect(page.locator('#driveConnectBtn')).toHaveCount(0);
    // อีกเครื่องเพิ่มไม้ใหม่เข้าคีย์เดียวกัน "หลังจากหน้านี้วาดแล้ว" (ลำดับแถวในหน่วยความจำของหน้าเก่าเลื่อน)
    await page.evaluate(() => {
      const k = 'tanot:invest:thjournal', a = JSON.parse(localStorage.getItem(k));
      a.unshift({ sym: 'NEW', en: 1, ex: 2, sh: 1, pl: 1, ts: 99 });
      localStorage.setItem(k, JSON.stringify(a));
    });
    await page.locator('#jBox tbody tr[data-ts="1"] .jdel').click(); // ลบ AOT (ts 1)
    const th = await get(page, 'tanot:invest:thjournal');
    expect(th.map((r) => r.ts)).toEqual([99, 3]);
    expect(th[1].extra).toBe('keep-me');
    // ลบแถวใน us ไม่กระทบ th
    await page.locator('#jBox tbody tr[data-key="globaljournal"] .jdel').click();
    expect(await get(page, 'tanot:invest:globaljournal')).toEqual([]);
    expect((await get(page, 'tanot:invest:thjournal')).length).toBe(2);
  });
});

test.describe('สมุดเทรด ซิงก์ 2 เครื่อง', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => { await request.get('http://localhost:8138/__reset'); });
  test('A ลบไม้ (ตาม ts) ขณะ B เพิ่มไม้ใหม่ → ทั้งสองเครื่องได้ผลเดียวกัน และแถวที่ลบไม่กลับมา', async ({ browser }) => {
    const SRV = 'http://localhost:8138';
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
    async function dev(nowMs) {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const errors = await prepare(page);
      await page.addInitScript((jn) => {
        window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
        if (localStorage.getItem('__seeded')) return;
        Object.keys(jn).forEach((k) => localStorage.setItem(k, JSON.stringify(jn[k])));
        localStorage.setItem('__seeded', '1');
      }, JN);
      await page.clock.setFixedTime(new Date(nowMs));
      await page.goto('/invest-trade-journal.html'); await page.waitForSelector('nav.ome-nav');
      return { ctx, page, errors };
    }
    const A = await dev(NOW), B = await dev(NOW);
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    // A ลบ AOT (ts 1) ที่เวลาหลังสุด · B เพิ่มไม้ BTC ใหม่ผ่าน UI
    await A.page.clock.setFixedTime(new Date(NOW + 120000));
    await A.page.locator('#jBox tbody tr[data-ts="1"] .jdel').click();
    await B.page.clock.setFixedTime(new Date(NOW + 60000));
    await B.page.selectOption('#jMarket', 'btc');
    await B.page.fill('#jEntry', '100'); await B.page.fill('#jExit', '110'); await B.page.fill('#jQty', '2');
    await B.page.click('#jAdd');
    for (let i = 0; i < 3; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      expect((await store(d.page, 'tanot:invest:thjournal')).map((r) => r.ts)).toEqual([3]);
      const btc = await store(d.page, 'tanot:invest:btcjournal');
      expect(btc.length).toBe(3); expect(btc.map((r) => r.pl)).toContain(20);
      await expect(d.page.locator('#jBox tbody tr')).toHaveCount(5); // วาดใหม่เองโดยไม่ต้องรีโหลด: th 1 + us 1 + btc 3
    }
    for (const d of [A, B]) expect(d.errors).toEqual([]);
    await A.ctx.close(); await B.ctx.close();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 6: หน้าหุ้น #th / #us (ขั้น 6) + หน้า redirect
   ═══════════════════════════════════════════════════════════════════ */
/** หน้า redirect → [ปลายทางพร้อม hash] (ขยายทุกขั้นที่หน้าเดิมกลายเป็น stub) */
const STUBS = {
  'invest-thai-stock.html': 'invest-stock.html#th',
  'invest-global-stock.html': 'invest-stock.html#us',
  'invest-set50-scanner.html': 'invest-stock.html#scan',
  'invest-portfolio.html': 'invest-stock.html#paper',
  'invest-thai-fund.html': 'invest-fund.html#th',
  'invest-global-fund.html': 'invest-fund.html#global',
  'invest-commodities.html': 'invest-gold.html#markets',
  'invest-gsb-lottery.html': 'invest-lottery.html#gsb',
  'invest-baac-lottery.html': 'invest-lottery.html#baac',
};
test.describe('หน้า redirect ของ URL เดิม', () => {
  for (const [from, to] of Object.entries(STUBS)) {
    test(from + ' → ' + to + ' (ส่ง ?sym= ต่อ · มี meta refresh · ปลายทางอยู่ใน PRECACHE)', async ({ page }) => {
      const errors = await prepare(page);
      await page.goto('/' + from + '?sym=PTT');
      await page.waitForURL(new RegExp(to.split('#')[0].replace('.', '\\.') + '\\?sym=PTT#' + to.split('#')[1] + '$'));
      await page.waitForSelector('nav.ome-nav');
      const meta = await page.evaluate(async (f) => { const h = await (await fetch('/' + f)).text(); return /http-equiv="refresh" content="0; url=([^"]+)"/.exec(h)[1]; }, from);
      expect(meta).toBe(to);
      const sw = require('fs').readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
      expect(sw).toContain("'./" + from + "'"); expect(sw).toContain("'./" + to.split('#')[0] + "'");
      expect(errors.filter((e) => !/Failed to load resource|ERR_/.test(e))).toEqual([]);
    });
  }
  test('invest-thai-stock.html?sym=PTT → ช่องสัญลักษณ์เป็น PTT บนแท็บหุ้นไทย', async ({ page }) => {
    await prepare(page);
    await mockProxy(page, (u) => (/range=1y/.test(u) ? { body: yahooChart(60, 30) } : null));
    await page.goto('/invest-thai-stock.html?sym=PTT');
    await expect(page.locator('#sym')).toHaveValue('PTT');
    await expect(page.locator('#stockTabs [data-tab="th"]')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('หน้าหุ้น invest-stock.html', () => {
  const TH = [{ sym: 'PTT', shares: 200, cost: 32, ts: 1, cur: 33, extra: 'keep' }, { sym: 'AOT', shares: 500, cost: 60, ts: 3 }];
  const US = [{ sym: 'AAPL', shares: 3, cost: 150, ts: 4 }];
  async function openStock(page, hash = '#th', { proxy, ai = false, init } = {}) {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    const seen = await mockProxy(page, proxy || ((u) => {
      if (/range=1y/.test(u)) return { body: yahooChart(120, /AAPL/.test(u) ? 150 : 32) };
      if (/THB%3DX|THB=X/.test(u)) return { body: { chart: { result: [{ meta: { regularMarketPrice: 36 }, indicators: { quote: [{ close: [36] }] } }] } } };
      if (u.startsWith('https://news.google.com/rss/search')) return { contentType: 'application/xml', body: rssXml([{ title: 'ข่าวหุ้น', link: 'https://example.com/n', pub: 'Fri, 02 Oct 2026 08:00:00 GMT', src: 'S' }]) };
      return null;
    }));
    await page.addInitScript(([th, us, ai, init]) => {
      window.__workers = 0;
      window.Worker = function () { window.__workers++; throw new Error('no worker'); };
      if (ai) window.TANOT_AI = { enabled: true };
      if (localStorage.getItem('__seeded')) return;
      localStorage.setItem('tanot:invest:thstock', JSON.stringify(th)); localStorage.setItem('tanot:invest:globalstock', JSON.stringify(us));
      Object.keys(init || {}).forEach((k) => localStorage.setItem(k, JSON.stringify(init[k])));
      localStorage.setItem('__seeded', '1');
    }, [TH, US, ai, init]);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-stock.html' + hash);
    await page.waitForSelector('nav.ome-nav');
    return { errors, hosts, seen };
  }
  const get = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);
  async function fetchSym(page, sym) { await page.fill('#sym', sym); await page.click('#fetchBtn'); await page.waitForSelector('#shead[style*="flex"]'); await expect(page.locator('#chartCard')).toBeVisible(); }

  test('#th: ดึงราคา → หัวหุ้น/ไฟจราจร/กราฟ/รายละเอียด/ข่าว · คุมเงินแบบล็อต 100 + ค่าคอมขั้นต่ำ · เช็กลิสต์', async ({ page }) => {
    const { errors, hosts, seen } = await openStock(page);
    await expect(page.locator('#stockTabs [data-tab="th"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#commMinField')).toBeVisible();
    await fetchSym(page, 'ptt');
    await expect(page.locator('#stkName')).toContainText('ปตท.');
    await expect(page.locator('#verdictTxt')).not.toHaveText('สัญญาณ —');
    expect(seen.some((u) => /chart\/PTT\.BK/.test(decodeURIComponent(u)) || /PTT\.BK/.test(u))).toBe(true);
    await expect(page.locator('#detailsBox')).toBeVisible();
    await expect(page.locator('#stockNewsCard')).toBeVisible();
    await expect(page.locator('#stockNewsBlock .news-list li')).toHaveCount(1);
    const key = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^tanot:invest:cache:PTT$/.test(k)));
    expect(key).toEqual(['tanot:invest:cache:PTT']);
    await page.fill('#capital', '100000'); await page.fill('#riskPct', '2'); await page.fill('#entry', '35'); await page.fill('#stop', '33');
    await page.click('#calcBtn');
    // 100000×2% = 2000 / 2 = 1000 หุ้น → ล็อต 100 พอดี · ค่าคอม max(35000×0.157%, 50) = 54.95 ต่อขา
    await expect(page.locator('#riskHeadline')).toContainText('1,000 หุ้น');
    await expect(page.locator('#riskHeadline')).toContainText('10 ล็อต');
    await expect(page.locator('#riskKv')).toContainText('ค่าคอมฯ');
    await page.click('#checkBtn');
    await expect(page.locator('#chkList li')).toHaveCount(6);
    await expect(page.locator('#checkVerdict')).toBeVisible();
    expect(hosts.filter((h) => !FONT_HOSTS.test(h) && h !== 'api.chnwt.dev' && h !== 'api.alternative.me')).toEqual([]);
    expect(hosts.filter((h) => FORBIDDEN_HOSTS.test(h))).toEqual([]);
    expect(errors.filter((e) => !/502|Failed to load resource|ERR_/.test(e))).toEqual([]);
  });

  test('#us: USD · ไม่ปัดล็อต · ไม่มีช่องค่าคอมขั้นต่ำ · แปลงบาท ≈ ฿ ตามอัตรา · พอร์ตใช้คีย์ globalstock', async ({ page }) => {
    const { errors } = await openStock(page, '#us');
    await expect(page.locator('#stockTabs [data-tab="us"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#commMinField')).toBeHidden();
    await expect(page.locator('#sym')).toHaveAttribute('placeholder', 'AAPL');
    await expect(page.locator('#capital')).toHaveValue('10000');
    await fetchSym(page, 'AAPL');
    expect(await page.evaluate(() => Object.keys(localStorage).includes('tanot:invest:cache:us:AAPL'))).toBe(true);
    await page.locator('#fxBox summary').click();
    await page.fill('#fxRate', '36'); await page.check('#fxShowChk');
    await page.fill('#capital', '10000'); await page.fill('#riskPct', '1'); await page.fill('#entry', '150'); await page.fill('#stop', '145'); await page.fill('#comm', '0.2');
    await page.click('#calcBtn');
    // 10000×1% = 100 / 5 = 20 หุ้น · ใช้เงิน $3,000 ≈ ฿108,000
    await expect(page.locator('#riskHeadline')).toContainText('20 หุ้น');
    await expect(page.locator('#riskHeadline')).toContainText('$3,000');
    await expect(page.locator('#riskHeadline .fx-sub')).toContainText('฿108,000');
    // พอร์ต US แสดงแถว AAPL (3 หุ้น) ไม่ปนกับพอร์ตไทย
    await expect(page.locator('#pfBox tbody tr[data-ts]')).toHaveCount(1);
    await expect(page.locator('#pfBox')).toContainText('AAPL');
    await expect(page.locator('#pfBox')).not.toContainText('PTT');
    expect(errors.filter((e) => !/502|Failed to load resource|ERR_/.test(e))).toEqual([]);
  });

  test('พอร์ต: เพิ่ม/แก้ราคา/ลบ ใช้คีย์เดิมรูปแบบเดิม · แก้เฉพาะ cur คงฟิลด์อื่น · ลบด้วย ts ไม่ลบผิดแถวเมื่อมีแถวใหม่โผล่', async ({ page }) => {
    await openStock(page, '#th');
    await expect(page.locator('#pfBox tbody tr[data-ts]')).toHaveCount(2);
    await page.fill('#pfSym', 'scb'); await page.fill('#pfShares', '100'); await page.fill('#pfCost', '110.5'); await page.click('#pfAdd');
    let th = await get(page, 'tanot:invest:thstock');
    expect(th.slice(0, 2)).toEqual(TH);
    expect(Object.keys(th[2]).sort()).toEqual(['cost', 'shares', 'sym', 'ts']);
    expect(th[2]).toMatchObject({ sym: 'SCB', shares: 100, cost: 110.5 });
    // แก้ราคาปัจจุบันของ AOT → เขียนเฉพาะ cur
    await page.locator('#pfBox tr[data-ts="3"] .pf-price').fill('62');
    th = await get(page, 'tanot:invest:thstock');
    expect(th.find((r) => r.ts === 3)).toEqual({ sym: 'AOT', shares: 500, cost: 60, ts: 3, cur: 62 });
    expect(th.find((r) => r.ts === 1)).toEqual(TH[0]); // ฟิลด์แปลกปลอม extra คงอยู่
    await expect(page.locator('#pfBox tr[data-ts="3"] .pf-pl')).toContainText('+฿1,000');
    // อีกเครื่องเพิ่มแถวเข้าคีย์ระหว่างนั้น แล้วลบ PTT (ts 1) → ต้องลบถูกแถว
    await page.evaluate(() => { const k = 'tanot:invest:thstock', a = JSON.parse(localStorage.getItem(k)); a.unshift({ sym: 'NEW', shares: 1, cost: 1, ts: 99 }); localStorage.setItem(k, JSON.stringify(a)); });
    await page.locator('#pfBox tr[data-ts="1"] .pf-del').click();
    th = await get(page, 'tanot:invest:thstock');
    expect(th.map((r) => r.ts).sort((a, b) => a - b)).toEqual([3, 99, th[th.length - 1].ts].sort((a, b) => a - b));
    expect(th.some((r) => r.sym === 'PTT')).toBe(false); expect(th.some((r) => r.sym === 'NEW')).toBe(true);
    // บันทึกจากผลคุมเงินเข้าพอร์ต
    await fetchSym(page, 'PTT');
    await page.fill('#entry', '35'); await page.fill('#stop', '33'); await page.click('#calcBtn'); await page.click('#saveBtn');
    th = await get(page, 'tanot:invest:thstock');
    expect(th[th.length - 1]).toMatchObject({ sym: 'PTT', shares: 1000, cost: 35 });
    // ไม่มีสมุดเทรด/Drive/Expectancy ในหน้า
    for (const sel of ['#jBox', '#jAdd', '#driveConnectBtn', '#eBtn', '#eResult']) await expect(page.locator(sel)).toHaveCount(0);
    await expect(page.locator('#journalLink')).toHaveAttribute('href', 'invest-trade-journal.html#th');
  });

  test('ควรขาย? ในพอร์ต: ดึงซีรีส์ → คำตัดสิน + ระดับราคา + ข้อมูลบริษัท(ไทย) · อัปเดต cur ของแถวนั้น', async ({ page }) => {
    await openStock(page, '#th');
    await page.locator('#pfBox tr[data-ts="1"] .pf-sell').click();
    await expect(page.locator('#pfBox .sell-detail .sell-verdict')).toBeVisible();
    await expect(page.locator('#pfBox .sell-levels li')).toHaveCount(4);
    await expect(page.locator('#pfBox .company-card')).toContainText('ปตท');
    const th = await get(page, 'tanot:invest:thstock');
    expect(th.find((r) => r.ts === 1).cur).toBeGreaterThan(30); expect(th.find((r) => r.ts === 1).extra).toBe('keep');
  });

  test('สลับแท็บ: เคลียร์สถานะตลาดเดิม · hash/แท็บล่าสุดจำใน ui.tabs.stock · ?sym= ใช้กับแท็บที่เปิด', async ({ page }) => {
    await openStock(page, '#th');
    await fetchSym(page, 'PTT');
    await page.locator('#stockTabs [data-tab="us"]').click();
    await expect(page).toHaveURL(/#us$/);
    await expect(page.locator('#chartCard')).toBeHidden(); await expect(page.locator('#sym')).toHaveValue('');
    await expect(page.locator('#shead')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:ui')).tabs.stock)).toBe('us');
    await page.goto('/invest-stock.html'); // ไม่มี hash → แท็บล่าสุด
    await expect(page.locator('#stockTabs [data-tab="us"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('AI: ไม่ใช่ pages.dev = ซ่อนการ์ด · เปิด = ส่ง task เดิม (stock:thaistock/globalstock) ผ่าน /api/ai/summarize และไม่สร้าง Worker', async ({ page }) => {
    let calls = [];
    await openStock(page, '#th', { ai: true });
    await page.route('**/api/ai/summarize', (route) => { calls.push(JSON.parse(route.request().postData())); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: 'สรุปภาพรวม: ทดสอบ', cached: false, model: 'm' }) }); });
    await fetchSym(page, 'PTT');
    await expect(page.locator('#aiSumCard')).toBeVisible();
    await page.click('#aiSumBtn');
    await expect(page.locator('#aiSumOut')).toContainText('สรุปภาพรวม');
    expect(calls[0].task).toBe('stock:thaistock');
    await page.locator('#stockTabs [data-tab="us"]').click();
    await fetchSym(page, 'AAPL'); await page.click('#aiSumBtn');
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1].task).toBe('stock:globalstock');
    expect(await page.evaluate(() => window.__workers)).toBe(0);
  });
  test('AI ล่ม: แสดงข้อความผิดพลาดชัด ไม่ถอยไปโมเดลในเบราว์เซอร์ · ไม่ใช่ pages.dev ซ่อนการ์ด', async ({ page, browser }) => {
    await openStock(page, '#th', { ai: true });
    await page.route('**/api/ai/summarize', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'down' }) }));
    await fetchSym(page, 'PTT'); await page.click('#aiSumBtn');
    await expect(page.locator('#aiSumStatus')).toContainText(/down|ไม่สำเร็จ|ผิดพลาด/);
    expect(await page.evaluate(() => window.__workers)).toBe(0);
    const p2 = await browser.newPage(); await openStock(p2, '#th');
    await fetchSym(p2, 'PTT');
    await expect(p2.locator('#aiSumCard')).toBeHidden();
    await p2.close();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 7: แท็บ #scan (SET50 + US) และ #paper (ขั้น 7)
   ═══════════════════════════════════════════════════════════════════ */
test('InvestCalc.parseHistoricalClose: ราคาปิดล่าสุดที่ใช้ได้ ข้าม null', () => {
  const j = { chart: { result: [{ timestamp: [1, 2, 3], indicators: { quote: [{ close: [10, 11, null] }] } }] } };
  expect(C.parseHistoricalClose(j)).toEqual({ price: 11, ts: 2000 });
  expect(() => C.parseHistoricalClose({ chart: { result: [{ timestamp: [1], indicators: { quote: [{ close: [null] }] } }] } })).toThrow();
  expect(() => C.parseHistoricalClose({})).toThrow();
});

test.describe('แท็บ #scan', () => {
  async function openScan(page, hash = '#scan') {
    const errors = await prepare(page);
    const seen = await mockProxy(page, (u) => {
      const m = /chart\/([^?]+)\?range=1y/.exec(decodeURIComponent(u));
      if (!m) return null;
      const sym = m[1];
      // PTT.BK ขาขึ้นแรงๆ → น่าจะเขียว ; AOT.BK ขาลง → ไม่เขียว ; ที่เหลือแกว่ง
      const n = 120, ts = Array.from({ length: n }, (_, i) => 1767225600 + i * 86400);
      const close = ts.map((_, i) => sym === 'PTT.BK' ? 30 + i * 0.05 : sym === 'AOT.BK' ? 60 - i * 0.1 : 100 + Math.sin(i / 5) * 3);
      const q = { open: close, high: close.map((c) => c + 0.3), low: close.map((c) => c - 0.3), close, volume: close.map(() => 1000) };
      return { body: { chart: { result: [{ timestamp: ts, meta: {}, indicators: { quote: [q] } }] } } };
    });
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-stock.html' + hash);
    await page.waitForSelector('nav.ome-nav');
    return { errors, seen };
  }
  test('SET50 50 แถว · สแกน → เติมราคา/สัญญาณ + เรียงเขียวขึ้นก่อน + กรองเฉพาะเขียว · เขียนแคชหุ้นไทยครบทุกฟิลด์', async ({ page }) => {
    const { errors, seen } = await openScan(page);
    await expect(page.locator('#panelScan')).toBeVisible(); await expect(page.locator('#panelAnalysis')).toBeHidden();
    await expect(page.locator('#scanBody tr')).toHaveCount(50);
    await page.click('#scanBtn');
    await expect(page.locator('#scanStatus')).toContainText('สแกนสำเร็จ 50/50', { timeout: 30000 });
    expect(seen.filter((u) => /range=1y/.test(u)).length).toBe(50);
    const first = page.locator('#scanBody tr').first();
    await expect(first).toHaveAttribute('data-light', 'green');
    await expect(page.locator('#scanBody tr[data-sym="PTT"]')).toContainText('+');
    const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:cache:PTT')));
    expect(Object.keys(cache).sort()).toEqual(['c', 'h', 'l', 'o', 't', 'ts', 'v']);
    await page.check('#greenOnly');
    const visible = await page.locator('#scanBody tr:visible').evaluateAll((trs) => trs.map((t) => t.getAttribute('data-light')));
    expect(visible.length).toBeGreaterThan(0); expect(visible.every((l) => l === 'green')).toBe(true);
    await page.uncheck('#greenOnly');
    await page.locator('#scanBody tr[data-sym="PTT"]').click();
    await page.waitForURL(/invest-stock\.html\?sym=PTT#th$/);
    await expect(page.locator('#sym')).toHaveValue('PTT');
    expect(errors.filter((e) => !/502|Failed to load resource|ERR_/.test(e))).toEqual([]);
  });
  test('สลับเป็นหุ้นดังสหรัฐฯ: 40 แถว สแกนด้วยสัญลักษณ์ไม่มี .BK · คลิกไป #us', async ({ page }) => {
    const { seen } = await openScan(page);
    await page.click('#scanSeg [data-set="us"]');
    await expect(page.locator('#scanBody tr')).toHaveCount(40);
    await page.click('#scanBtn');
    await expect(page.locator('#scanStatus')).toContainText('สแกนสำเร็จ 40/40', { timeout: 30000 });
    expect(seen.some((u) => /chart\/AAPL\?range=1y/.test(decodeURIComponent(u)))).toBe(true);
    expect(await page.evaluate(() => !!localStorage.getItem('tanot:invest:cache:us:AAPL'))).toBe(true);
    await page.locator('#scanBody tr[data-sym="AAPL"]').click();
    await page.waitForURL(/invest-stock\.html\?sym=AAPL#us$/);
  });
  test('ไม่มีเน็ต/พร็อกซีล่ม: แสดงแถวจากแคชที่มี ไม่ error แข็ง · ยกเลิกสแกนได้', async ({ page }) => {
    const errors = await prepare(page);
    await mockProxy(page, () => null);
    await page.addInitScript(() => { localStorage.setItem('tanot:invest:cache:PTT', JSON.stringify({ ts: Date.now(), t: ['a', 'b', 'c', 'd', 'e'], o: [1, 2, 3, 4, 5], h: [2, 3, 4, 5, 6], l: [1, 1, 2, 3, 4], c: [1, 2, 3, 4, 5], v: [1, 1, 1, 1, 1] })); });
    await page.goto('/invest-stock.html#scan');
    await expect(page.locator('#scanBody tr[data-sym="PTT"]')).toContainText('5.00');
    await page.click('#scanBtn'); await page.click('#scanBtn'); // กดซ้ำ = หยุด
    await expect(page.locator('#scanBtn')).toHaveText('หาหุ้นน่าสนใจ', { timeout: 15000 });
    expect(errors.filter((e) => !/502|Failed to load resource|ERR_/.test(e))).toEqual([]);
  });
});

test.describe('แท็บ #paper (พอร์ตจำลอง)', () => {
  const PAPER = { cash: 900000, startCash: 1000000, holdings: [{ sym: 'PTT', shares: 1000, avgCost: 30 }], tx: [{ ts: 1700000000000, type: 'buy', sym: 'PTT', shares: 1000, price: 30, amount: 30000 }], extra: 'keep' };
  async function openPaper(page, { seed = true, price = 40 } = {}) {
    const errors = await prepare(page);
    const seen = await mockProxy(page, (u) => {
      const d = decodeURIComponent(u);
      if (/period1=/.test(d)) return { body: { chart: { result: [{ timestamp: [1760000000, 1760086400], indicators: { quote: [{ close: [35, null] }] } }] } } };
      if (/range=5d/.test(d)) return { body: { chart: { result: [{ meta: { regularMarketPrice: price, previousClose: price - 1 }, indicators: { quote: [{ close: [price] }] } }] } } };
      return null;
    });
    await page.addInitScript(([seed, p]) => { if (seed && !localStorage.getItem('__s')) { localStorage.setItem('tanot:invest:portfolio', JSON.stringify(p)); localStorage.setItem('__s', '1'); } }, [seed, PAPER]);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-stock.html#paper');
    await page.waitForSelector('nav.ome-nav');
    return { errors, seen };
  }
  const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:portfolio')));
  test('แสดงพอร์ตเดิมจากคีย์เดิม · ซื้อที่ราคาจริง → เงินสด/ต้นทุนเฉลี่ย/ประวัติ เขียนทั้งก้อนรูปแบบเดิม คงฟิลด์อื่น', async ({ page }) => {
    const { errors } = await openPaper(page);
    await expect(page.locator('#sCash')).toHaveText('฿900,000');
    await expect(page.locator('#holdTable tbody tr')).toHaveCount(1);
    await page.fill('#buySym', 'ptt'); await page.fill('#buyShares', '500'); await page.click('#buyBtn');
    await expect(page.locator('#tradeStatus')).toContainText('ซื้อ PTT 500 หุ้น');
    const s = await state(page);
    expect(s.cash).toBe(900000 - 500 * 40);
    expect(s.holdings).toEqual([{ sym: 'PTT', shares: 1500, avgCost: (1000 * 30 + 500 * 40) / 1500 }]);
    expect(s.tx[0]).toMatchObject({ type: 'buy', sym: 'PTT', shares: 500, price: 40, amount: 20000 }); expect(s.tx).toHaveLength(2);
    expect(s.extra).toBe('keep'); expect(s.startCash).toBe(1000000);
    // ขาย → กำไรที่รับรู้
    await page.click('#tradeTabs [data-tab="sell"]');
    await page.selectOption('#sellSym', 'PTT'); await page.fill('#sellShares', '300'); await page.click('#sellBtn');
    await expect(page.locator('#tradeStatus')).toContainText('ขาย PTT 300 หุ้น');
    const s2 = await state(page);
    expect(s2.holdings[0].shares).toBe(1200);
    expect(s2.tx[0]).toMatchObject({ type: 'sell', shares: 300, price: 40 }); expect(s2.tx[0].realizedPl).toBeCloseTo((40 - s.holdings[0].avgCost) * 300, 6);
    expect(s2.cash).toBe(s.cash + 300 * 40);
    await expect(page.locator('#txTable tbody tr')).toHaveCount(3);
    expect(errors.filter((e) => !/502|Failed to load resource|ERR_/.test(e))).toEqual([]);
  });
  test('เงินสดไม่พอ = ไม่ซื้อ · ซื้อย้อนหลังใช้ราคาปิดวันนั้น · วันในอนาคตไม่ได้ · ซื้อไม่สำเร็จเมื่อดึงราคาไม่ได้', async ({ page }) => {
    await openPaper(page);
    await page.fill('#buySym', 'PTT'); await page.fill('#buyShares', '100000'); await page.click('#buyBtn');
    await expect(page.locator('#tradeStatus')).toContainText('เงินสดไม่พอ');
    expect((await state(page)).cash).toBe(900000);
    await page.fill('#buyShares', '10'); await page.fill('#buyDate', '2026-10-05'); await page.click('#buyBtn');
    await expect(page.locator('#tradeStatus')).toContainText('อนาคต');
    await page.fill('#buyDate', '2026-10-01'); await page.click('#buyBtn');
    await expect(page.locator('#tradeStatus')).toContainText('ราคาปิดวันที่');
    const s = await state(page);
    expect(s.tx[0]).toMatchObject({ price: 35, shares: 10, ts: 1760000000 * 1000 }); // ใช้แท่งล่าสุดที่ close ไม่ null
  });
  test('อ่านสดหลังรอราคา: อีกแท็บแก้เงินสด/ถือหุ้นระหว่างรอ → ผลซื้อไม่ทับของเขา', async ({ page }) => {
    await openPaper(page);
    await page.route('**/api/proxy?*', async (route) => {
      // หน่วงตอบ แล้วให้ "อีกแท็บ" เขียนพอร์ตก่อนคำตอบมาถึง
      await page.evaluate(() => { const k = 'tanot:invest:portfolio', s = JSON.parse(localStorage.getItem(k)); s.cash = 800000; s.holdings.push({ sym: 'AOT', shares: 10, avgCost: 60 }); localStorage.setItem(k, JSON.stringify(s)); });
      await route.fallback();
    });
    await page.fill('#buySym', 'SCB'); await page.fill('#buyShares', '100'); await page.click('#buyBtn');
    await expect(page.locator('#tradeStatus')).toContainText('ซื้อ SCB');
    const s = await state(page);
    expect(s.cash).toBe(800000 - 100 * 40);
    expect(s.holdings.map((h) => h.sym).sort()).toEqual(['AOT', 'PTT', 'SCB']);
  });
  test('แก้เงินสด · เริ่มพอร์ตใหม่ (ยืนยัน) · ไม่มีสำรอง Drive/โหมด embed', async ({ page }) => {
    await openPaper(page);
    await page.click('#cashEditBtn'); await page.fill('#cashEditInput', '123456'); await page.click('#cashEditSave');
    await expect(page.locator('#sCash')).toHaveText('฿123,456');
    expect((await state(page)).cash).toBe(123456);
    await page.click('#resetBtn');
    await page.locator('dialog.dialog .btn.danger').click();
    await expect(page.locator('#holdEmpty')).toBeVisible(); // ยืนยันเป็น promise — รอให้หน้าวาดใหม่ก่อนอ่านคีย์ (เดิมอ่านทันทีเลยสุ่มพลาด)
    expect(await state(page)).toEqual({ cash: 1000000, startCash: 1000000, holdings: [], tx: [] });
    await expect(page.locator('#driveConnectBtn')).toHaveCount(0);
  });
  test('เริ่มจากไม่มีคีย์: ค่าเริ่มต้น 1,000,000 และไม่เขียนคีย์จนกว่าจะทำรายการ', async ({ page }) => {
    await openPaper(page, { seed: false });
    await expect(page.locator('#sCash')).toHaveText('฿1,000,000');
    expect(await page.evaluate(() => localStorage.getItem('tanot:invest:portfolio'))).toBeNull();
  });
});


/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 7: หน้ากองทุน invest-fund.html (ขั้น 8)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('หน้ากองทุน invest-fund.html', () => {
  const TFUND = [
    { fund: 'K-RMF', cat: 'rmf', amt: 10000, nav: 10, units: 1000, ts: Date.parse('2026-05-01T10:00:00+07:00'), extra: 'keep' },
    { fund: 'Y-ESG', cat: 'esg', amt: 60000, nav: 10, units: 6000, ts: Date.parse('2026-06-01T10:00:00+07:00') },
    { fund: 'Z-RMF', cat: 'rmf', amt: 99999, nav: 10, units: 9999.9, ts: Date.parse('2025-06-01T10:00:00+07:00') },
  ];
  const SPFUND = [{ cls: 'สะสมมูลค่า', amt: 5000, nav: 20, units: 250, ts: 9 }];
  async function openFund(page, hash = '#th', { seed = true } = {}) {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    await page.addInitScript(([th, sp, seed]) => {
      if (localStorage.getItem('__seeded')) return;
      if (seed) { localStorage.setItem('tanot:invest:thaifund', JSON.stringify(th)); localStorage.setItem('tanot:invest:spfund', JSON.stringify(sp)); }
      localStorage.setItem('__seeded', '1');
    }, [TFUND, SPFUND, seed]);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-fund.html' + hash);
    await page.waitForSelector('nav.ome-nav');
    return { errors, hosts };
  }
  const get = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);
  const money = (n) => '฿' + Math.round(n).toLocaleString('en-US');

  test('#th: แถวเดิมแสดงครบ · เพิ่มผ่าน UI ได้ชุดฟิลด์ตรงเดิม · ลบด้วย ts แล้วแถวเดิมอยู่ครบ · ไม่ออกเน็ตนอกที่อนุญาต', async ({ page }) => {
    const { errors, hosts } = await openFund(page);
    await expect(page.locator('#fundTabs [data-tab="th"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#th_lgBox .log-group-hd')).toHaveCount(3);
    await expect(page.locator('#th_lgBox tbody tr')).toHaveCount(3);
    const before = await get(page, 'tanot:invest:thaifund');
    await page.fill('#th_lgFund', 'SCB-RMF'); await page.selectOption('#th_lgCat', 'rmf');
    await page.fill('#th_lgAmt', '10000'); await page.fill('#th_lgNav', '12.5'); await page.click('#th_lgAdd');
    await expect(page.locator('#th_lgBox tbody tr')).toHaveCount(4);
    const after = await get(page, 'tanot:invest:thaifund');
    expect(after.slice(0, 3)).toEqual(before);
    expect(Object.keys(after[3]).sort()).toEqual(['amt', 'cat', 'fund', 'nav', 'ts', 'units']);
    expect(after[3]).toMatchObject({ fund: 'SCB-RMF', cat: 'rmf', amt: 10000, nav: 12.5, units: 800 });
    await page.locator('#th_lgBox .log-del[data-ts="' + after[3].ts + '"]').click();
    expect(await get(page, 'tanot:invest:thaifund')).toEqual(before);
    expect(hosts.filter((h) => !/^fonts\./.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('NAV ล่าสุด: พิมพ์แล้วบันทึกที่ tanot:invest:nav (th:<กองทุน>) + แสดงกำไร/ขาดทุน · ล้างช่อง = ลบคีย์ · ไม่แตะสมุดซื้อ', async ({ page }) => {
    await openFund(page);
    const before = await get(page, 'tanot:invest:thaifund');
    expect(await get(page, 'tanot:invest:nav')).toBeNull();
    await page.fill('#th_nav_K-RMF', '11');
    const nav = await get(page, 'tanot:invest:nav');
    expect(Object.keys(nav)).toEqual(['th:K-RMF']);
    expect(nav['th:K-RMF']).toMatchObject({ nav: 11, d: '2026-10-03' });
    expect(typeof nav['th:K-RMF'].ts).toBe('number');
    await expect(page.locator('[data-pl="K-RMF"]')).toContainText('฿11,000'); // 1000 หน่วย × 11
    await expect(page.locator('[data-pl="K-RMF"]')).toContainText('+฿1,000');
    await page.fill('#th_nav_K-RMF', '');
    expect(await get(page, 'tanot:invest:nav')).toEqual({});
    expect(await get(page, 'tanot:invest:thaifund')).toEqual(before);
    // เปิดใหม่ = ช่อง NAV กลับมาจากคีย์
    await page.fill('#th_nav_Y-ESG', '10.5');
    await page.reload(); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#th_nav_Y-ESG')).toHaveValue('10.5');
  });

  test('#global: แถว spfund เดิม · เพิ่ม/ลบผ่าน UI ตรงรูปแบบเดิม (cls ค่าไทยตายตัว) · NAV ของชนิดบันทึกที่ global:<ชนิด>', async ({ page }) => {
    await openFund(page, '#global');
    await expect(page.locator('#fundTabs [data-tab="global"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gl_lgBox tbody tr')).toHaveCount(1);
    await page.selectOption('#gl_lgClass', 'ปันผล'); await page.fill('#gl_lgAmt', '3000'); await page.fill('#gl_lgNav', '15'); await page.click('#gl_lgAdd');
    const rows = await get(page, 'tanot:invest:spfund');
    expect(rows[0]).toEqual(SPFUND[0]);
    expect(Object.keys(rows[1]).sort()).toEqual(['amt', 'cls', 'nav', 'ts', 'units']);
    expect(rows[1]).toMatchObject({ cls: 'ปันผล', amt: 3000, nav: 15, units: 200 });
    await page.fill('#gl_nav_สะสมมูลค่า', '22');
    expect((await get(page, 'tanot:invest:nav'))['global:สะสมมูลค่า']).toMatchObject({ nav: 22, d: '2026-10-03' });
    await page.locator('#gl_lgBox .log-del[data-ts="' + rows[1].ts + '"]').click();
    expect(await get(page, 'tanot:invest:spfund')).toEqual(SPFUND);
  });

  test('แผน DCA ตรง InvestCalc.fundPlan · ตลาดย่อใช้ drawdown เดิม (−20% → ×1.5)', async ({ page }) => {
    await openFund(page);
    const pl = C.fundPlan({ accM: 3000, divM: 3000, years: 10, cagr: 6, fee: 1.5, dy: 2.5 });
    await expect(page.locator('#th_oValue')).toHaveText(money(pl.valueTotal));
    await expect(page.locator('#th_oContrib')).toHaveText(money(pl.contribTotal));
    await page.fill('#th_idxNow', '75'); await page.fill('#th_idxAth', '100'); await page.click('#th_ddBtn');
    await expect(page.locator('#th_tranche .tr-box[data-dd="20"]')).toHaveClass(/on/);
    await expect(page.locator('#th_ddOut')).toContainText('฿9,000'); // (3000+3000) × 1.5
  });

  test('การ์ดภาษี = TaxCalc.simulate ของปีเดียวกัน (กฎจาก tax-rules/*.json) · SSF ซ่อนเมื่อปีนั้นไม่มีสิทธิ', async ({ page }) => {
    await openFund(page);
    const T = require(path.join(__dirname, '..', 'tax-calc.js'));
    const R69 = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', 'tax-rules', '2569.json'), 'utf8'));
    await expect(page.locator('#txYear')).toHaveValue('2569');
    await expect(page.locator('[data-row="ssf"]')).toBeHidden();
    await page.fill('#txIncome', '1000000'); await page.fill('#txRmf', '100000'); await page.fill('#txEsg', '50000'); await page.fill('#txOther', '20000');
    await page.click('#txBtn');
    const r = T.simulate(R69, { salary: 1000000, gpf: 20000 }, { rmf: 100000, thaiEsg: 50000 });
    expect(r.saved).toBeGreaterThan(0);
    await expect(page.locator('#txBefore')).toHaveText(money(r.before.tax));
    await expect(page.locator('#txAfter')).toHaveText(money(r.after.tax));
    await expect(page.locator('#txSaved')).toHaveText(money(r.saved));
    // แผนหลายปี: ปีแรก = เท่ากับ simulate ปีเดียวกัน
    await page.locator('#txOut details summary').click();
    await page.click('#txProjBtn');
    await expect(page.locator('#txProjTable tbody tr').first()).toContainText(money(r.saved));
    // ไม่มีเพดาน/ขั้นภาษีฝังในไฟล์ของหน้า
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'invest-fund.js'), 'utf8');
    expect(src).not.toMatch(/\b(500000|300000|750000|2000000|5000000)\b/);
  });

  test('"ใช้ยอดจากสมุดซื้อปีนี้" เติม RMF/ESG ของปีภาษีที่เลือก · ปุ่มไป tax.html#sim เปิดแท็บ "ถ้าซื้อเพิ่ม"', async ({ page }) => {
    await openFund(page);
    await page.fill('#txIncome', '800000');
    await page.click('#txFromLogBtn');
    await expect(page.locator('#txRmf')).toHaveValue('10000');
    await expect(page.locator('#txEsg')).toHaveValue('60000');
    await page.click('#txSimLink');
    await page.waitForURL(/tax(\.html)?#sim$/);
    await expect(page.locator('#txTabs [data-tab="sim"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#txSim')).toBeVisible();
  });

  test('tax.html เติมยอดกองทุนจากการซื้อที่เพิ่มผ่านหน้ากองทุน · tax.html#sim เปิดแท็บ sim ตรงๆ', async ({ page }) => {
    await openFund(page, '#th', { seed: false });
    await page.fill('#th_lgFund', 'A-RMF'); await page.selectOption('#th_lgCat', 'rmf'); await page.fill('#th_lgAmt', '50000'); await page.fill('#th_lgNav', '10'); await page.click('#th_lgAdd');
    await page.fill('#th_lgFund', 'B-ESG'); await page.selectOption('#th_lgCat', 'esg'); await page.fill('#th_lgAmt', '60000'); await page.fill('#th_lgNav', '10'); await page.click('#th_lgAdd');
    await expect(page.locator('#th_lgBox tbody tr')).toHaveCount(2);
    await page.goto('/tax.html'); await page.waitForSelector('#txKpi .kpi');
    await expect(page.locator('#tx_rmf')).toHaveAttribute('placeholder', '50,000');
    await expect(page.locator('#tx_thaiEsg')).toHaveAttribute('placeholder', '60,000');
    await page.goto('/tax.html#sim'); await page.waitForSelector('#txKpi .kpi');
    await expect(page.locator('#txTabs [data-tab="sim"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('วันพร้อมขาย: ใช้ InvestCalc.eligibilityFor · ปีเกิด ค.ศ./พ.ศ. ให้ผลเดียวกัน · เก็บปีเกิดที่คีย์เดิม', async ({ page }) => {
    await openFund(page);
    // RMF ไม้แรก 2025 → ครบ 5 ปี 2030 · อายุ 55 (เกิด 1990) → 2045 · ESG ไม้แรก 2026 → +5 = 2031
    await expect(page.locator('#elBox [data-cat="esg"]')).toContainText('1 ม.ค. 2031');
    await expect(page.locator('#elBox [data-cat="rmf"]')).toContainText('1 ม.ค. 2030');
    await page.fill('#elBirthYear', '1990');
    await expect(page.locator('#elBox [data-cat="rmf"]')).toContainText('1 ม.ค. 2045');
    expect(await page.evaluate(() => localStorage.getItem('tanot:invest:thaifund:birthyear'))).toBe('1990');
    await page.fill('#elBirthYear', '2533');
    await expect(page.locator('#elBox [data-cat="rmf"]')).toContainText('1 ม.ค. 2045');
  });

  test('แท็บ: hash เลือกแท็บ · ไม่มี hash ใช้แท็บล่าสุด · เปลี่ยนแท็บไม่เพิ่มประวัติ', async ({ page }) => {
    await openFund(page, '#global');
    await expect(page.locator('#panel-global')).toBeVisible(); await expect(page.locator('#panel-th')).toBeHidden();
    await page.click('#fundTabs [data-tab="th"]');
    expect(new URL(page.url()).hash).toBe('#th');
    await page.goto('/invest-fund.html#global'); await page.waitForSelector('nav.ome-nav');
    await page.goto('/invest-fund.html'); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#fundTabs [data-tab="global"]')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('กองทุน ซิงก์ 2 เครื่อง', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => { await request.get('http://localhost:8138/__reset'); });
  test('A ลบแถวซื้อ (ตาม ts) ขณะ B เพิ่มแถวใหม่ → ผลเดียวกัน · NAV ของ B ซิงก์ไป A', async ({ browser }) => {
    const SRV = 'http://localhost:8138';
    const sync = (p) => p.evaluate(() => window.TanotData.syncNow().then((s) => s.state));
    const store = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
    const seedRows = [{ fund: 'K-RMF', cat: 'rmf', amt: 10000, nav: 10, units: 1000, ts: 1 }, { fund: 'Y-ESG', cat: 'esg', amt: 6000, nav: 10, units: 600, ts: 2 }];
    async function dev(nowMs) {
      const ctx = await browser.newContext({ baseURL: SRV });
      const page = await ctx.newPage();
      const errors = await prepare(page);
      await page.addInitScript((rows) => {
        window.TANOT_SYNC = { enabled: true, initialDelay: 60000, interval: 1e9 };
        if (localStorage.getItem('__seeded')) return;
        localStorage.setItem('tanot:invest:thaifund', JSON.stringify(rows)); localStorage.setItem('__seeded', '1');
      }, seedRows);
      await page.clock.setFixedTime(new Date(nowMs));
      await page.goto('/invest-fund.html#th'); await page.waitForSelector('nav.ome-nav');
      return { ctx, page, errors };
    }
    const A = await dev(NOW), B = await dev(NOW);
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    await A.page.clock.setFixedTime(new Date(NOW + 120000));
    await A.page.locator('#th_lgBox .log-del[data-ts="1"]').click();
    await B.page.clock.setFixedTime(new Date(NOW + 60000));
    await B.page.fill('#th_lgFund', 'NEW-SSF'); await B.page.selectOption('#th_lgCat', 'ssf'); await B.page.fill('#th_lgAmt', '5000'); await B.page.fill('#th_lgNav', '10'); await B.page.click('#th_lgAdd');
    await B.page.fill('#th_nav_Y-ESG', '12');
    for (let i = 0; i < 3; i++) { await sync(A.page); await sync(B.page); }
    await B.page.evaluate(() => document.activeElement && document.activeElement.blur()); // ขณะโฟกัสช่อง NAV หน้าไม่วาดสมุดทับ
    for (let i = 0; i < 2; i++) { await sync(A.page); await sync(B.page); }
    for (const d of [A, B]) {
      const rows = await store(d.page, 'tanot:invest:thaifund');
      expect(rows.map((r) => r.fund).sort()).toEqual(['NEW-SSF', 'Y-ESG']);
      expect((await store(d.page, 'tanot:invest:nav'))['th:Y-ESG']).toMatchObject({ nav: 12 });
      await expect(d.page.locator('#th_lgBox tbody tr')).toHaveCount(2);
    }
    for (const d of [A, B]) expect(d.errors).toEqual([]);
    await A.ctx.close(); await B.ctx.close();
  });
});


/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 8: ทอง #gold + ค่าเงิน & วัตถุดิบ #markets (ขั้น 9)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('หน้าทอง invest-gold.html', () => {
  const GOLD_TH = { response: { update_date: '3 ต.ค. 2569', update_time: '09:00', price: { gold_bar: { buy: '70,850', sell: '70,950' }, gold: { buy: '69,523', sell: '71,950' } } } };
  const GLOG = [{ type: 'bar', unit: 'baht', amt: 40000, price: 40000, weight: 1, ts: 6, extra: 'keep' }, { type: 'jewelry', unit: 'gram', amt: 21000, price: 2770.45, weight: 7.58, ts: 7 }];
  function proxy(u) {
    if (/thai-gold-api/.test(u)) return { body: GOLD_TH };
    if (/THB%3DX|THB=X/.test(decodeURIComponent(u)) || /JPY|CNY|EURUSD/.test(u)) return { body: yahooChart(120, 36) };
    if (/range=1y/.test(u)) return { body: yahooChart(120, 2000) };
    if (/range=5d/.test(u)) return { body: yahooChart(6, 100) };
    return null;
  }
  async function openGold(page, hash = '#gold', { seed = true, ai = false } = {}) {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    const seen = await mockProxy(page, proxy);
    await page.addInitScript(([log, seed, ai]) => {
      if (ai) window.TANOT_AI = { enabled: true };
      if (localStorage.getItem('__seeded')) return;
      if (seed) localStorage.setItem('tanot:invest:gold', JSON.stringify(log));
      localStorage.setItem('__seeded', '1');
    }, [GLOG, seed, ai]);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-gold.html' + hash);
    await page.waitForSelector('nav.ome-nav');
    return { errors, hosts, seen };
  }
  const get = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);

  test('#gold: ราคาทองไทยจาก thai-gold-api เข้าช่อง + แคช cache:gold:th รูปแบบเดิม · ไฟจราจร GC=F · ไม่มีสัดส่วนทอง/Drive · ไม่ออกเน็ตนอกที่อนุญาต', async ({ page }) => {
    const { errors, hosts, seen } = await openGold(page);
    await expect(page.locator('#goldTabs [data-tab="gold"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#barBuy')).toHaveValue('70950.00');
    await expect(page.locator('#barSell')).toHaveValue('70850.00');
    await expect(page.locator('#jewelrySell')).toHaveValue('69523.00');
    const th = await get(page, 'tanot:invest:cache:gold:th');
    expect(th).toMatchObject({ barBuyPrice: 70950, barSellPrice: 70850, jewelryBuyPrice: 71950, jewelrySellPrice: 69523 });
    await expect(page.locator('#gVerdict')).not.toHaveText('กำลังโหลด…');
    await expect(page.locator('#gLight')).toHaveClass(/green|yellow|red/);
    expect(seen.some((u) => /GC%3DF|GC=F/.test(u))).toBe(true);
    await expect(page.locator('#alOut, #alBtn, #driveConnectBtn')).toHaveCount(0);
    expect(await page.evaluate(() => [...document.scripts].some((s) => /accounts\.google\.com/.test(s.src)))).toBe(false);
    expect(hosts.filter((h) => !/^fonts\.|^api\.chnwt\.dev$/.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('สมุดทอง: แถวเดิมแสดงถูก (แท่ง ใช้ราคารับซื้อแท่ง · รูปพรรณ 7.58 ก. ÷ 15.16 ใช้ราคารับซื้อรูปพรรณ) · เพิ่ม/ลบผ่าน UI ตรงรูปแบบเดิม', async ({ page }) => {
    await openGold(page);
    await expect(page.locator('#lgBox tbody tr')).toHaveCount(2);
    // แท่ง 1 บาท × 70,850 = 70,850 (ต้นทุน 40,000) · รูปพรรณ 0.5 บาท × 69,523 = 34,762 (ต้นทุน 21,000)
    await expect(page.locator('#lgBox .log-group-sub').first()).toContainText('฿70,850');
    await expect(page.locator('#lgBox .log-group-sub').nth(1)).toContainText('฿34,762');
    await expect(page.locator('#lgBox .log-group-sub').nth(1)).toContainText('0.5000 บาททองคำ');
    const before = await get(page, 'tanot:invest:gold');
    await page.selectOption('#lgType', 'jewelry'); await page.selectOption('#lgUnit', 'gram'); await page.fill('#lgAmt', '10000'); await page.fill('#lgPrice', '2500'); await page.click('#lgAdd');
    const after = await get(page, 'tanot:invest:gold');
    expect(after.slice(0, 2)).toEqual(before);
    expect(Object.keys(after[2]).sort()).toEqual(['amt', 'price', 'ts', 'type', 'unit', 'weight']);
    expect(after[2]).toMatchObject({ type: 'jewelry', unit: 'gram', amt: 10000, price: 2500, weight: 4 });
    await page.locator('#lgBox .log-del[data-ts="' + after[2].ts + '"]').click();
    expect(await get(page, 'tanot:invest:gold')).toEqual(before);
  });

  test('DCA/ตลาดย่อ/คุมเงิน/เช็กลิสต์ ตรง InvestCalc', async ({ page }) => {
    await openGold(page);
    await expect(page.locator('#dcaOut')).toBeVisible();
    const r = C.simulateDCA(3000, 70950, 5, 120);
    await expect(page.locator('#dcaValue')).toHaveText('฿' + Math.round(r.value).toLocaleString('th-TH'));
    await page.fill('#gdAth', '100000'); await page.click('#gdBtn'); // 70,950 vs 100,000 → ย่อ 29% → ขั้น −20% (×1.5)
    await expect(page.locator('#gdTranche .tr-box[data-dd="20"]')).toHaveClass(/on/);
    await expect(page.locator('#gdOut')).toContainText('฿4,500');
    await page.fill('#rcStop', '67000'); await page.click('#rcCalcBtn');
    const res = C.riskCalc.gold({ capital: 300000, riskPct: 2, entry: 70950, stop: 67000 });
    await expect(page.locator('#rcHeadline')).toContainText(res.qty.toFixed(4));
    await page.click('#chkForm .yn-btn[data-val="yes"]'); await page.click('#checkBtn');
    await expect(page.locator('#chkList li')).toHaveCount(7);
    await expect(page.locator('#chkList')).toContainText('ซื้อทองจริง');
  });

  test('#markets: แท็บเปิดตาม hash · การ์ดสถิติ+16 สินทรัพย์ · cross คำนวณจาก 2 ticker · ทองไทยใช้ราคาเดียวกับแท็บทอง', async ({ page }) => {
    const { errors, hosts } = await openGold(page, '#markets');
    await expect(page.locator('#panel-markets')).toBeVisible(); await expect(page.locator('#panel-gold')).toBeHidden();
    await expect(page.locator('#mk_statRow .stat-card')).toHaveCount(5);
    await expect(page.locator('#mk_pillRow .pill')).toHaveCount(16);
    await expect(page.locator('#mk_statRow .stat-card[data-key="goldbar"] .pr')).toHaveText('70,950');
    await expect(page.locator('#mk_dName')).toHaveText('ทองคำ COMEX');
    await expect(page.locator('#mk_vVerdict')).not.toHaveText('กำลังโหลด…', { timeout: 15000 });
    await page.click('#mk_pillRow .pill[data-key="jpythb"]');
    await expect(page.locator('#mk_dName')).toHaveText('เยนเทียบบาท');
    await expect(page.locator('#mk_histTable tbody tr')).toHaveCount(30);
    // cross: THB=X ÷ JPY=X × 100 ของแท่งสุดท้าย (ทั้งคู่ใช้ชุดเดียวกัน → 100)
    await expect(page.locator('#mk_oClose')).toHaveText('100.000');
    await page.click('#mk_pillRow .pill[data-key="goldjew"]');
    await expect(page.locator('#mk_chartEmpty')).toContainText('ไม่มีข้อมูลย้อนหลัง');
    expect(await page.evaluate(() => localStorage.getItem('tanot:invest:comm:lastKey'))).toBe('goldjew');
    expect(hosts.filter((h) => !/^fonts\.|^api\.chnwt\.dev$/.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('#markets: คุมเงิน/เช็กลิสต์ตามหน่วยสินทรัพย์ · ไม่เรียก /api/ocr · สลับแท็บไม่เพิ่มประวัติ', async ({ page }) => {
    await openGold(page, '#markets');
    await expect(page.locator('#mk_vVerdict')).not.toHaveText('กำลังโหลด…', { timeout: 15000 });
    await page.fill('#mk_rcStop', '1990'); await page.click('#mk_rcCalcBtn');
    await expect(page.locator('#mk_rcHeadline')).toContainText('หน่วย');
    await page.click('#mk_chkForm .yn-btn[data-val="no"]'); await page.click('#mk_checkBtn');
    await expect(page.locator('#mk_chkList li')).toHaveCount(7);
    await page.click('#goldTabs [data-tab="gold"]');
    expect(new URL(page.url()).hash).toBe('#gold');
    await expect(page.locator('#panel-gold')).toBeVisible();
  });

  test('แท็บเริ่มต้นเป็น #gold · จำแท็บล่าสุดเมื่อไม่มี hash', async ({ page }) => {
    await openGold(page, '#markets');
    await page.goto('/invest-gold.html'); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#goldTabs [data-tab="markets"]')).toHaveAttribute('aria-selected', 'true');
  });
});


/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 9: Bitcoin (ขั้น 10)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('หน้า Bitcoin invest-bitcoin.html', () => {
  const PF = [{ qty: 0.05, cost: 60000, ts: 5, cur: 62000, extra: 'keep' }, { qty: 0.1, cost: 55000, ts: 8 }];
  const BJ = [{ en: 60000, ex: 65000, qty: 0.1, pl: 500, ts: 11 }];
  async function openBtc(page, { ai = false } = {}) {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    const seen = await mockProxy(page, (u) => {
      const d = decodeURIComponent(u);
      if (/alternative\.me/.test(d)) return { body: { data: [{ value: '72', value_classification: 'Greed', timestamp: '1' }] } };
      if (/THB=X|THB%3DX/.test(d)) return { body: { chart: { result: [{ meta: { regularMarketPrice: 36 }, indicators: { quote: [{ close: [36] }] } }] } } };
      if (/range=1y/.test(d)) return { body: yahooChart(120, 60000) };
      return null;
    });
    await page.addInitScript(([pf, bj, ai]) => {
      if (ai) window.TANOT_AI = { enabled: true };
      if (localStorage.getItem('__seeded')) return;
      localStorage.setItem('tanot:invest:btc', JSON.stringify(pf)); localStorage.setItem('tanot:invest:btcjournal', JSON.stringify(bj));
      localStorage.setItem('__seeded', '1');
    }, [PF, BJ, ai]);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-bitcoin.html');
    await page.waitForSelector('nav.ome-nav');
    return { errors, hosts, seen };
  }
  const get = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);

  test('ดึงราคา → ไฟจราจร/กราฟ/กลัว-โลภ · แคชชื่อเดิม · ไม่มีสมุดเทรด/Expectancy/Drive · ลิงก์ไปสมุดเทรด #btc · ไม่ออกเน็ตนอกที่อนุญาต', async ({ page }) => {
    const { errors, hosts, seen } = await openBtc(page);
    await expect(page.locator('#fngNum')).toHaveText('72');
    await page.click('#fetchBtn');
    await expect(page.locator('#lightCard')).toBeVisible();
    await expect(page.locator('#chartCard')).toBeVisible();
    await expect(page.locator('#price')).not.toHaveValue('');
    expect(seen.some((u) => /BTC-USD/.test(decodeURIComponent(u)))).toBe(true);
    const cache = await get(page, 'tanot:invest:cache:btc:BTC-USD');
    expect(cache.c.length).toBeGreaterThan(60);
    expect((await get(page, 'tanot:invest:cache:fng')).value).toBe(72);
    await expect(page.locator('#jBox, #jAdd, #eBtn, #driveConnectBtn, #marketSettingsPanel')).toHaveCount(0);
    await expect(page.locator('#journalLink')).toHaveAttribute('href', 'invest-trade-journal.html#btc');
    expect(await page.evaluate(() => [...document.scripts].some((s) => /accounts\.google\.com/.test(s.src)))).toBe(false);
    expect(hosts.filter((h) => !/^fonts\.|^api\.alternative\.me$/.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('พอร์ต: แถวเดิมครบ · เพิ่ม/แก้ราคา/ลบด้วย ts ตรงรูปแบบเดิม · btcjournal ไม่ถูกแตะ', async ({ page }) => {
    await openBtc(page);
    await expect(page.locator('#pfBox tr[data-ts]')).toHaveCount(2);
    await page.fill('#pfQty', '0.02'); await page.fill('#pfCost', '70000'); await page.click('#pfAdd');
    const rows = await get(page, 'tanot:invest:btc');
    expect(rows.slice(0, 2)).toEqual(PF);
    expect(Object.keys(rows[2]).sort()).toEqual(['cost', 'qty', 'ts']);
    expect(rows[2]).toMatchObject({ qty: 0.02, cost: 70000 });
    await page.locator('#pfBox tr[data-ts="' + rows[2].ts + '"] .pf-price').fill('71000');
    expect((await get(page, 'tanot:invest:btc'))[2].cur).toBe(71000);
    await expect(page.locator('#pfBox tr[data-ts="' + rows[2].ts + '"] .pf-pl')).toContainText('+$20');
    await page.locator('#pfBox tr[data-ts="' + rows[2].ts + '"] .pf-del').click();
    expect(await get(page, 'tanot:invest:btc')).toEqual(PF);
    expect(await get(page, 'tanot:invest:btcjournal')).toEqual(BJ);
  });

  test('ควรขายไหม: ดึงชุดราคา → คำตัดสิน + 4 ระดับ · ราคาปัจจุบันบันทึกลงแถวเดิม', async ({ page }) => {
    await openBtc(page);
    await page.locator('#pfBox tr[data-ts="8"] .pf-sell').click();
    await expect(page.locator('#pfBox tr[data-sr="8"] .sell-verdict')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#pfBox tr[data-sr="8"] .sell-levels li')).toHaveCount(4);
    expect((await get(page, 'tanot:invest:btc')).find((r) => r.ts === 8).cur).toBeGreaterThan(0);
  });

  test('คุมเงิน/เช็กลิสต์/DCA/ตัวอย่างกราฟ ตรง InvestCalc (BTC เศษส่วน เสี่ยง ≤ 1%)', async ({ page }) => {
    await openBtc(page);
    await page.click('#demoBtn');
    await expect(page.locator('#chartSource')).toContainText('ข้อมูลตัวอย่าง');
    await page.fill('#entry', '50000'); await page.fill('#stop', '47500'); await page.fill('#riskPct', '1'); await page.fill('#capital', '10000'); await page.click('#calcBtn');
    const r = C.riskCalc.btc({ capital: 10000, riskPct: 1, entry: 50000, stop: 47500, comm: 0.25, resistance: NaN });
    await expect(page.locator('#riskHeadline')).toContainText(r.qty.toFixed(6));
    await expect(page.locator('#riskKv')).toContainText('$' + Math.round(r.riskUsd));
    await page.click('#saveBtn');
    expect((await get(page, 'tanot:invest:btc')).length).toBe(3);
    await page.click('#chkForm .yn-btn[data-val="yes"]'); await page.click('#checkBtn');
    await expect(page.locator('#chkList li')).toHaveCount(7);
    await expect(page.locator('#chkList')).toContainText('spot');
    const d = C.simulateDCA(100, +(await page.inputValue('#dcaStart')), 15, 60);
    await page.click('#dcaBtn');
    await expect(page.locator('#dcaValue')).toHaveText('$' + Math.round(d.value).toLocaleString('en-US'));
  });

  test('ตัวแปลงเป็นบาท: ดึงอัตรา → ≈ ฿ ใน headline · อัตราเก็บที่ fxcache เดิม', async ({ page }) => {
    await openBtc(page);
    await page.click('#demoBtn');
    await page.locator('details:has(#fxRate) summary').click();
    await page.click('#fxFetchBtn');
    await expect(page.locator('#fxRate')).toHaveValue('36.00');
    expect((await get(page, 'tanot:invest:fxcache')).rate).toBe(36);
    await page.check('#fxShowChk');
    await page.fill('#capital', '10000'); await page.fill('#entry', '50000'); await page.fill('#stop', '47500'); await page.click('#calcBtn');
    await expect(page.locator('#riskHeadline .fx-sub')).toContainText('฿');
  });
});


/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 10: สลาก #gsb #baac #govt (ขั้น 11)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('หน้าสลาก invest-lottery.html', () => {
  const GSB = [{ name: 'ออมสิน 3 ปี', purchDate: '2025-01-01', maturity: '2028-01-01', unitPrice: 100, units: 200, drawFreq: '16', evPerDraw: 0.5, results: { '2025-02-16': 300 }, ts: 12, extra: 'keep' }];
  const BAAC = [{ name: 'ธ.ก.ส. 2 ปี', purchDate: '2026-01-01', maturity: '2028-01-01', unitPrice: 100, units: 50, drawFreq: '1,16', evPerDraw: 0, results: {}, ts: 13 }];
  const TIERS_GSB = { unitPrice: '100', units: '200', purchDate: '2026-10-03', maturity: '2027-10-03', drawFreq: '16', guarRate: '0.5', taxExempt: true, tiers: [{ label: 'ที่ 1', amount: 1000, winners: 10, totalUnits: 1000 }, { label: 'ที่ 2', amount: 100, winners: 100, totalUnits: 1000 }] };
  async function openLottery(page, hash = '', { seed = true } = {}) {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    await page.addInitScript(([g, b, ts, seed]) => {
      if (localStorage.getItem('__seeded')) return;
      if (seed) {
        localStorage.setItem('tanot:invest:gsblottery', JSON.stringify(g)); localStorage.setItem('tanot:invest:baaclottery', JSON.stringify(b));
        localStorage.setItem('tanot:invest:gsblottery:tiers', JSON.stringify(ts));
      }
      localStorage.setItem('__seeded', '1');
    }, [GSB, BAAC, TIERS_GSB, seed]);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-lottery.html' + hash);
    await page.waitForSelector('nav.ome-nav');
    return { errors, hosts };
  }
  const get = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);

  test('ไม่มี hash → #govt (สลากกินแบ่ง) · แท็บออมสิน/ธ.ก.ส. ไม่สร้างแผงและไม่ยิงเน็ต', async ({ page }) => {
    const { errors, hosts } = await openLottery(page);
    await expect(page.locator('#lotteryTabs [data-tab="govt"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panelGovt')).toBeVisible();
    await expect(page.locator('#panelSavings')).toBeHidden();
    await expect(page.locator('#panelSavings .card')).toHaveCount(0);
    await expect(page.locator('#ltLoadBtn')).toBeVisible();
    expect(hosts.filter((h) => !/^fonts\./.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('#gsb: สมุดเดิมครบ · ค่าฟอร์มจากคีย์ :tiers · คำนวณ EV ตรง InvestCalc · เพิ่ม/บันทึกผล/ลบด้วย ts รูปแบบเดิม', async ({ page }) => {
    const { errors } = await openLottery(page, '#gsb');
    await expect(page.locator('#lotteryTabs [data-tab="gsb"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#gbGuarRate')).toHaveValue('0.5');
    await expect(page.locator('#tierBox tr[data-ti]')).toHaveCount(2);
    await expect(page.locator('#lgBox .log-group-hd')).toHaveText('ออมสิน 3 ปี');
    await page.click('#gbCalcBtn');
    const tiers = TIERS_GSB.tiers, drawsN = C.drawSchedule(new Date(2026, 9, 3), new Date(2027, 9, 3), [16]).length;
    const ev = C.evPerUnitPerDraw(tiers);
    await expect(page.locator('#gbDrawCount')).toHaveText(String(drawsN));
    await expect(page.locator('#gbEvUnit')).toHaveText('฿' + Math.round(ev).toLocaleString('th-TH'));
    const res = C.totalExpectedReturn(20000, 0.5, (new Date(2027, 9, 3) - new Date(2026, 9, 3)) / (365.25 * 86400000), tiers, 200, drawsN, true);
    await expect(page.locator('#gbTotalReturn')).toHaveText('฿' + Math.round(res.totalNet).toLocaleString('th-TH'));
    await page.fill('#cmpDepRate', '1.5'); await page.click('#cmpBtn');
    await expect(page.locator('#cmpOut')).toBeVisible();
    // บันทึก state ลงคีย์ :tiers รูปแบบเดิม
    const st = await get(page, 'tanot:invest:gsblottery:tiers');
    expect(Object.keys(st).sort()).toEqual(['drawFreq', 'guarRate', 'maturity', 'purchDate', 'taxExempt', 'tiers', 'unitPrice', 'units']);
    // สมุด: เพิ่ม → ฟิลด์ตรงเดิม · บันทึกผลงวดที่ผ่านแล้ว → results ของแถวนั้น · ลบด้วย ts
    const before = await get(page, 'tanot:invest:gsblottery');
    await page.fill('#lgName', 'ใหม่'); await page.fill('#lgPurchDate', '2026-01-01'); await page.fill('#lgMaturity', '2027-01-01'); await page.click('#lgAdd');
    const after = await get(page, 'tanot:invest:gsblottery');
    expect(after[0]).toEqual(before[0]);
    expect(Object.keys(after[1]).sort()).toEqual(['drawFreq', 'evPerDraw', 'maturity', 'name', 'purchDate', 'results', 'ts', 'unitPrice', 'units']);
    const inp = page.locator('#lgBox .draw-input[data-ts="' + after[1].ts + '"]').first();
    await inp.fill('250'); await inp.blur();
    const withRes = await get(page, 'tanot:invest:gsblottery');
    expect(Object.values(withRes[1].results)).toEqual([250]);
    expect(withRes[0]).toEqual(before[0]);
    await page.locator('#lgBox .log-del[data-ts="' + after[1].ts + '"]').click();
    expect(await get(page, 'tanot:invest:gsblottery')).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('#baac: ใช้คีย์ของ ธ.ก.ส. แยกจากออมสิน · สลับแท็บแล้วฟอร์ม/สมุดเปลี่ยนตามชนิด · ข้อความเฉพาะชนิด', async ({ page }) => {
    await openLottery(page, '#gsb');
    await expect(page.locator('#lgBox .log-group-hd')).toHaveText('ออมสิน 3 ปี');
    await page.click('#lotteryTabs [data-tab="baac"]');
    expect(new URL(page.url()).hash).toBe('#baac');
    await expect(page.locator('#lgBox .log-group-hd')).toHaveText('ธ.ก.ส. 2 ปี');
    await expect(page.locator('#gbGuarRate')).toHaveValue('0.1'); // ธ.ก.ส. ไม่มีค่าฟอร์มที่บันทึกไว้ = ค่าเริ่มต้น
    await expect(page.locator('h1')).toContainText('ธ.ก.ส.');
    await page.fill('#gbPurchDate', '2026-10-03'); await page.fill('#gbMaturity', '2027-10-03');
    await page.fill('#tierBox tr[data-ti="0"] .t-amount', '500'); await page.fill('#tierBox tr[data-ti="0"] .t-winners', '1'); await page.fill('#tierBox tr[data-ti="0"] .t-total', '100');
    await page.click('#gbCalcBtn');
    expect((await get(page, 'tanot:invest:baaclottery:tiers')).tiers[0]).toMatchObject({ amount: 500, winners: 1, totalUnits: 100 });
    expect((await get(page, 'tanot:invest:gsblottery:tiers')).guarRate).toBe('0.5'); // ของออมสินไม่ถูกแตะ
    await page.click('#lotteryTabs [data-tab="gsb"]');
    await expect(page.locator('#lgBox .log-group-hd')).toHaveText('ออมสิน 3 ปี');
    await expect(page.locator('#gbGuarRate')).toHaveValue('0.5');
  });

  test('#govt เปิดครั้งแรก: ตรวจเลข/สุ่มเลข/ช่วงย้อนหลังทำงาน · สุ่มเลขเขียนคีย์เดิม', async ({ page }) => {
    const { errors } = await openLottery(page, '#govt');
    await expect(page.locator('#ltRangeNote')).toBeAttached();
    await page.click('#ltSpinBtn');
    await expect(page.locator('#ltSpinDerived')).toBeVisible({ timeout: 10000 });
    const spins = await get(page, 'tanot:invest:lottery:spins');
    expect(spins.length).toBe(1); expect(spins[0].n).toMatch(/^\d{6}$/);
    expect(errors).toEqual([]);
  });
});


/* ═══════════════════════════════════════════════════════════════════
   หน้า (Playwright) — ส่วนที่ 11: พันธบัตร + แผนธุรกิจ (ขั้น 12)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('หน้าพันธบัตร invest-gov-bond.html', () => {
  const BONDS = [{ name: 'LB30', purchDate: '2025-01-01', maturity: '2030-01-01', face: 100000, coupon: 3, freq: 2, ts: 10, extra: 'keep' }, { name: 'LB26', purchDate: '2024-01-01', maturity: '2026-01-01', face: 50000, coupon: 2.5, freq: 2, ts: 11 }];
  async function openBond(page) {
    const errors = await prepare(page);
    const hosts = trackExternal(page);
    await page.addInitScript((b) => { if (localStorage.getItem('__s')) return; localStorage.setItem('tanot:invest:govbond', JSON.stringify(b)); localStorage.setItem('__s', '1'); }, BONDS);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/invest-gov-bond.html'); await page.waitForSelector('nav.ome-nav');
    return { errors, hosts };
  }
  const get = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);
  test('สมุดเดิมครบ + ตารางดอกเบี้ย · YTM ตรง InvestCalc · เพิ่ม/ลบด้วย ts รูปแบบเดิม · ไม่ออกเน็ต', async ({ page }) => {
    const { errors, hosts } = await openBond(page);
    await expect(page.locator('#lgBox .log-group-hd')).toHaveCount(2);
    await page.fill('#bfFace', '100000'); await page.fill('#bfCoupon', '3'); await page.selectOption('#bfFreq', '2'); await page.fill('#bfPrice', '98000'); await page.fill('#bfYears', '5'); await page.click('#bfCalcBtn');
    const y = C.solveYTM(98000, 100000, 3, 2, 5);
    await expect(page.locator('#bfYtm')).toHaveText(y.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%');
    await page.click('#cmpBtn'); await expect(page.locator('#cmpOut')).toBeVisible();
    const before = await get(page, 'tanot:invest:govbond');
    await page.fill('#lgName', 'ใหม่'); await page.fill('#lgPurchDate', '2026-10-01'); await page.fill('#lgMaturity', '2028-10-01'); await page.click('#lgAdd');
    const after = await get(page, 'tanot:invest:govbond');
    expect(after.slice(0, 2)).toEqual(before);
    expect(Object.keys(after[2]).sort()).toEqual(['coupon', 'face', 'freq', 'maturity', 'name', 'purchDate', 'ts']);
    await page.locator('#lgBox .log-del[data-ts="' + after[2].ts + '"]').click();
    expect(await get(page, 'tanot:invest:govbond')).toEqual(before);
    expect(hosts.filter((h) => !/^fonts\./.test(h))).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('หน้าแผนธุรกิจ invest-business.html', () => {
  const PLANS = [{ name: 'ขายขนม', startup: 20000, fixed: 5000, price: 50, varCost: 20, vol: 300, profitPerUnit: 30, breakevenUnits: 166.7, paybackMonths: 2.3, monthlyProfitAtVol: 4000, ts: 21, extra: 'keep' }];
  test('บันทึกไอเดียเดิมครบ · จุดคุ้มทุนตรงสูตร · เพิ่ม/ลบด้วย ts รูปแบบเดิม · เช็กลิสต์ทำงาน', async ({ page }) => {
    const errors = await prepare(page);
    await page.addInitScript((p) => { if (localStorage.getItem('__s')) return; localStorage.setItem('tanot:invest:bizplan', JSON.stringify(p)); localStorage.setItem('__s', '1'); }, PLANS);
    await page.goto('/invest-business.html'); await page.waitForSelector('nav.ome-nav');
    await expect(page.locator('#bzLogBox tbody tr')).toHaveCount(1);
    await page.fill('#bzStartup', '30000'); await page.fill('#bzFixed', '6000'); await page.fill('#bzPrice', '100'); await page.fill('#bzVar', '40'); await page.fill('#bzVol', '200'); await page.click('#bzCalcBtn');
    await expect(page.locator('#bzBreakeven')).toContainText('100'); // 6000 ÷ (100−40)
    await expect(page.locator('#bzProfitUnit')).toContainText('60');
    const before = JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:invest:bizplan')));
    await page.fill('#bzIdeaName', 'ไอเดียใหม่'); await page.click('#bzAddBtn');
    const after = JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:invest:bizplan')));
    expect(after[0]).toEqual(before[0]);
    expect(Object.keys(after[1]).sort()).toEqual(['breakevenUnits', 'fixed', 'monthlyProfitAtVol', 'name', 'paybackMonths', 'price', 'profitPerUnit', 'startup', 'ts', 'varCost', 'vol']);
    expect(after[1]).toMatchObject({ name: 'ไอเดียใหม่', startup: 30000, breakevenUnits: 100, monthlyProfitAtVol: 6000 });
    await page.locator('#bzLogBox .log-del[data-ts="' + after[1].ts + '"]').click();
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tanot:invest:bizplan')))).toEqual(before);
    await page.click('#bzChkBtn');
    await expect(page.locator('#bzChkResult')).toBeVisible();
    expect(errors).toEqual([]);
  });
});


/* ═══════════════════════════════════════════════════════════════════
   เมนู + ค้นหาด่วน + แคชเก่า (ขั้น 13)
   ═══════════════════════════════════════════════════════════════════ */
test.describe('เมนูการลงทุน 9 รายการ + แท็บ + palette', () => {
  test('invest.children = 9 รายการตามลำดับ · มี tabs ตามที่ออกแบบ · INVEST_CATS คงรูปแบบ {key,label,icon,page}', async ({ page }) => {
    await prepare(page);
    await page.goto('/invest.html'); await page.waitForSelector('nav.ome-nav');
    const info = await page.evaluate(() => {
      let inv = null; (function f(ns) { ns.forEach((n) => { if (n.key === 'invest') inv = n; else if (n.children) f(n.children); }); })(window.OME_MENU);
      return { keys: inv.children.map((c) => c.key), tabs: Object.fromEntries(inv.children.filter((c) => c.tabs).map((c) => [c.key, c.tabs.map((x) => x.hash)])), href: inv.children.map((c) => c.href), cats: window.INVEST_CATS.map((c) => Object.keys(c).sort().join(',')) };
    });
    expect(info.keys).toEqual(['stock', 'fund', 'gold', 'bitcoin', 'gov-bond', 'lottery', 'journal', 'news', 'business']);
    expect(info.tabs).toEqual({ stock: ['th', 'us', 'scan', 'paper'], fund: ['th', 'global'], gold: ['gold', 'markets'], lottery: ['gsb', 'baac', 'govt'] });
    expect(new Set(info.cats)).toEqual(new Set(['icon,key,label,page']));
    for (const h of info.href) expect(require('fs').existsSync(path.join(__dirname, '..', h.split('#')[0]))).toBe(true);
    // ไม่ลิงก์ไปหน้า redirect เดิม
    for (const h of info.href) expect(Object.keys(STUBS)).not.toContain(h.split('#')[0]);
  });
  test('หน้าที่มีแท็บ: เมนู active เมื่อ path ตรงโดยไม่สน hash (invest-stock.html#us ยังไฮไลต์ "หุ้น")', async ({ page }) => {
    await prepare(page);
    await page.goto('/invest-stock.html#us'); await page.waitForSelector('nav.ome-nav');
    const active = await page.evaluate(() => [...document.querySelectorAll('.ome-menu-link.active')].map((a) => a.textContent.trim()));
    expect(active).toContain('หุ้น');
    await page.goto('/invest-lottery.html#baac'); await page.waitForSelector('nav.ome-nav');
    expect(await page.evaluate(() => [...document.querySelectorAll('.ome-menu-link.active')].map((a) => a.textContent.trim()))).toContain('สลาก');
  });
  test('ค้นหาด่วน: พิมพ์ "ออมสิน" → แท็บสลากออมสิน → Enter ไป invest-lottery.html#gsb', async ({ page }) => {
    await prepare(page);
    await page.goto('/index.html'); await page.waitForSelector('nav.ome-nav');
    await page.keyboard.press('Control+k');
    await page.fill('.ome-pal-input', 'ออมสิน');
    await expect(page.locator('.ome-pal-row').first()).toContainText('สลากออมสิน');
    await page.keyboard.press('Enter');
    await page.waitForURL(/invest-lottery(\.html)?#gsb$/);
    await expect(page.locator('#lotteryTabs [data-tab="gsb"]')).toHaveAttribute('aria-selected', 'true');
  });
  test('ล้างแคชเก่าตอนโหลดหน้าลงทุน: แคช hub/comm/btc:fng หายครั้งเดียว · คีย์ข้อมูลผู้ใช้ไม่หายสักคีย์', async ({ page }) => {
    await prepare(page);
    const USER = { 'tanot:invest:thstock': [{ sym: 'PTT', shares: 1, cost: 1, ts: 1 }], 'tanot:invest:gold': [{ type: 'bar', unit: 'baht', amt: 1, price: 1, weight: 1, ts: 2 }], 'tanot:invest:portfolio': { cash: 1, startCash: 1, holdings: [], tx: [] }, 'tanot:invest:hub:history': [1], 'tanot:invest:nav': { 'th:X': { nav: 1 } } };
    await page.addInitScript((u) => {
      if (localStorage.getItem('__s')) return;
      Object.keys(u).forEach((k) => localStorage.setItem(k, JSON.stringify(u[k])));
      ['tanot:invest:cache:hub:q:bk:PTT', 'tanot:invest:cache:comm:q:CL=F', 'tanot:invest:cache:btc:fng', 'tanot:invest:cache:gold:dxy', 'tanot:invest:newscache:PTT', 'tanot:invest:cache:comm:thaigold'].forEach((k) => localStorage.setItem(k, '{"ts":1}'));
      localStorage.setItem('tanot:invest:newscache:q:PTT', '{"ts":1,"items":[]}'); // รูปแบบใหม่ ต้องอยู่
      localStorage.setItem('__s', '1');
    }, USER);
    await page.goto('/invest-news.html'); await page.waitForSelector('nav.ome-nav');
    const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => /cache/.test(k)));
    expect(left).toEqual(['tanot:invest:newscache:q:PTT']);
    for (const k of Object.keys(USER)) expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k)).toEqual(USER[k]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tanot:invest:ui')).cleaned)).toBe(1);
  });
});


test.describe('ไม่ออกเน็ตนอกที่อนุญาต (ทั้ง 10 หน้า + ทุกแท็บ)', () => {
  const PAGES = ['invest.html', 'invest-stock.html#th', 'invest-stock.html#us', 'invest-stock.html#scan', 'invest-stock.html#paper', 'invest-fund.html#th', 'invest-fund.html#global',
    'invest-gold.html#gold', 'invest-gold.html#markets', 'invest-bitcoin.html', 'invest-gov-bond.html', 'invest-lottery.html#gsb', 'invest-lottery.html#baac', 'invest-lottery.html#govt',
    'invest-trade-journal.html#all', 'invest-news.html', 'invest-business.html'];
  test('ทุกหน้า/แท็บ: ไม่มี host proxy สาธารณะ/rss2json/tanot-cors-proxy และไม่เรียก /api/ocr', async ({ page }) => {
    await prepare(page);
    const hosts = trackExternal(page), ocr = [];
    page.on('request', (r) => { if (/\/api\/ocr/.test(r.url())) ocr.push(r.url()); });
    await mockProxy(page, () => null);
    await page.clock.setFixedTime(new Date(NOW));
    for (const p of PAGES) {
      await page.goto('/' + p); await page.waitForSelector('nav.ome-nav');
      await page.waitForTimeout(400);
    }
    expect(hosts.filter((h) => FORBIDDEN_HOSTS.test(h))).toEqual([]);
    expect(hosts.filter((h) => !FONT_HOSTS.test(h) && !/^(api\.chnwt\.dev|api\.alternative\.me|raw\.githubusercontent\.com|openlibrary\.org)$/.test(h))).toEqual([]);
    expect(ocr).toEqual([]);
  });
});
