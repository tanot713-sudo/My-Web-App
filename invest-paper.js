/* ══════════════════════════════════════════════════════════════════
   Tanot — พอร์ตจำลอง (แท็บ #paper ของ invest-stock.html) — ยุบรวมหน้าลงทุน ขั้น 7
   • ฝึกซื้อ-ขายหุ้นไทยด้วยเงินสมมติ (เริ่ม 1,000,000 บาท) ที่ราคาจริงจาก Yahoo Finance ผ่าน InvestCore (/api/proxy) — ซื้อย้อนหลังได้
   • คีย์เดิม tanot:invest:portfolio (blob) เขียนทั้งก้อนตามเดิม {cash, startCash, holdings:[{sym,shares,avgCost}], tx:[{ts,type,sym,shares,price,amount,realizedPl?}]}
     อ่านสดก่อนแก้ทุกครั้ง (รวมหลังรอราคา) ไม่ถือ state ค้างข้ามการเขียน · ไม่นับรวมในมูลค่าสินทรัพย์ลงทุน (เงินสมมติ)
   • ไม่มีสำรอง Google Drive แล้ว · ไม่มีโหมด embed
   หมายเหตุ: ตัวช่วยฝึกฝน ไม่ใช่การลงทุนจริง
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var STATE_KEY = 'tanot:invest:portfolio';
  var START_CASH = 1000000;
  var DICT = {
 "th": {
  "lblCash": "เงินสดคงเหลือ",
  "editCashBtn": "แก้ไข",
  "saveBtn": "บันทึก",
  "cancelBtn": "ยกเลิก",
  "lblHoldVal": "มูลค่าหุ้นที่ถือ",
  "lblTotal": "มูลค่าพอร์ตรวม",
  "lblPl": "กำไร/ขาดทุนรวม",
  "resetBtn": "เริ่มพอร์ตใหม่",
  "tradeTitle": "ซื้อ / ขายหุ้น",
  "tabBuy": "ซื้อ",
  "tabSell": "ขาย",
  "lblSym": "ชื่อย่อหุ้น",
  "phSym": "เช่น PTT",
  "lblShares": "จำนวนหุ้น",
  "phShares": "เช่น 100",
  "lblBuyDate": "วันที่ซื้อ (ย้อนหลังได้)",
  "buyBtn": "ดึงราคา + ซื้อ",
  "lblSellSym": "หุ้นที่ถือ",
  "sellBtn": "ดึงราคา + ขาย",
  "holdTitle": "หุ้นที่ถือ",
  "refreshBtn": "รีเฟรชราคา",
  "holdEmpty": "ยังไม่มีหุ้นในพอร์ต",
  "txTitle": "ประวัติการซื้อขาย",
  "txEmpty": "ยังไม่มีรายการ",
  "thHoldSym": "หุ้น",
  "thHoldShares": "จำนวน",
  "thHoldAvg": "ทุนเฉลี่ย",
  "thHoldPrice": "ราคาล่าสุด",
  "thHoldVal": "มูลค่า",
  "thHoldPl": "กำไร/ขาดทุน",
  "priceNotFetched": "ยังไม่ดึง",
  "optHoldSuffix": "มี {n} หุ้น",
  "thTxDate": "วันที่",
  "thTxType": "ประเภท",
  "thTxSym": "หุ้น",
  "thTxShares": "จำนวน",
  "thTxPrice": "ราคา",
  "thTxAmt": "มูลค่า",
  "thTxPl": "กำไรที่รับรู้",
  "txTypeBuy": "ซื้อ",
  "txTypeSell": "ขาย",
  "errEnterSym": "พิมพ์ชื่อย่อหุ้นก่อน เช่น PTT",
  "errShares": "กรอกจำนวนหุ้นให้ถูกต้อง",
  "errFutureDate": "เลือกวันที่ในอนาคตไม่ได้",
  "statusFetchingHist": "กำลังดึงราคาย้อนหลัง {sym} วันที่ {date}…",
  "statusFetching": "กำลังดึงราคา {sym}…",
  "errNoCash": "เงินสดไม่พอ — ต้องใช้ {cost} แต่มีเงินสด {cash}",
  "buySuccess": "ซื้อ {sym} {shares} หุ้น ที่ {price} บาท{backdated} สำเร็จ — ใช้เงิน {cost}",
  "buySuccessBackdatedSuffix": " (ราคาปิดวันที่ {date})",
  "buyFailHist": "ดึงราคาย้อนหลัง {sym} วันที่ {date} ไม่ได้ (อาจไม่มีข้อมูลช่วงนั้น หรือสัญลักษณ์ไม่ถูกต้อง) — ลองใหม่หรือเลือกวันอื่น",
  "buyFail": "ดึงราคา {sym} ไม่ได้ตอนนี้ (สัญลักษณ์อาจไม่ถูกต้อง หรือบริการฟรีจำกัดชั่วคราว) — ลองใหม่อีกครั้ง",
  "errNoSellSym": "ยังไม่มีหุ้นในพอร์ตให้ขาย",
  "errNoHolding": "ไม่พบหุ้นนี้ในพอร์ต",
  "errSharesWithMax": "กรอกจำนวนหุ้นให้ถูกต้อง (มีอยู่ {n} หุ้น)",
  "sellSuccess": "ขาย {sym} {shares} หุ้น ที่ {price} บาท สำเร็จ — {plWord} {pl}",
  "plWordProfit": "กำไร",
  "plWordLoss": "ขาดทุน",
  "sellFail": "ดึงราคา {sym} ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง",
  "resetConfirm": "เริ่มพอร์ตจำลองใหม่ทั้งหมด? เงินสด/หุ้นที่ถือ/ประวัติการซื้อขายทั้งหมดจะถูกล้าง (กู้คืนไม่ได้)",
  "resetOkLabel": "เริ่มใหม่",
  "errCashInvalid": "กรอกจำนวนเงินสดให้ถูกต้อง (ต้องไม่ติดลบ)",
  "pageTitle": "พอร์ตจำลอง"
 },
 "en": {
  "lblCash": "Cash balance",
  "editCashBtn": "Edit",
  "saveBtn": "Save",
  "cancelBtn": "Cancel",
  "lblHoldVal": "Holdings value",
  "lblTotal": "Total portfolio value",
  "lblPl": "Total profit/loss",
  "resetBtn": "Start new portfolio",
  "tradeTitle": "Buy / Sell Stock",
  "tabBuy": "Buy",
  "tabSell": "Sell",
  "lblSym": "Stock symbol",
  "phSym": "e.g. PTT",
  "lblShares": "Number of shares",
  "phShares": "e.g. 100",
  "lblBuyDate": "Purchase date (can be backdated)",
  "buyBtn": "Fetch price + Buy",
  "lblSellSym": "Stock held",
  "sellBtn": "Fetch price + Sell",
  "holdTitle": "Holdings",
  "refreshBtn": "Refresh prices",
  "holdEmpty": "No stocks in your portfolio yet",
  "txTitle": "Trade History",
  "txEmpty": "No transactions yet",
  "thHoldSym": "Stock",
  "thHoldShares": "Shares",
  "thHoldAvg": "Avg cost",
  "thHoldPrice": "Latest price",
  "thHoldVal": "Value",
  "thHoldPl": "Profit/Loss",
  "priceNotFetched": "Not fetched yet",
  "optHoldSuffix": "has {n} shares",
  "thTxDate": "Date",
  "thTxType": "Type",
  "thTxSym": "Stock",
  "thTxShares": "Shares",
  "thTxPrice": "Price",
  "thTxAmt": "Amount",
  "thTxPl": "Realized P/L",
  "txTypeBuy": "Buy",
  "txTypeSell": "Sell",
  "errEnterSym": "Enter a stock symbol first, e.g. PTT",
  "errShares": "Enter a valid number of shares",
  "errFutureDate": "Can't pick a future date",
  "statusFetchingHist": "Fetching historical price for {sym} on {date}…",
  "statusFetching": "Fetching price for {sym}…",
  "errNoCash": "Not enough cash — needs {cost} but you have {cash}",
  "buySuccess": "Bought {sym} {shares} shares at {price} THB{backdated} — used {cost}",
  "buySuccessBackdatedSuffix": " (closing price on {date})",
  "buyFailHist": "Couldn't fetch the historical price for {sym} on {date} (may have no data for that period, or the symbol is wrong) — try again or pick another date",
  "buyFail": "Couldn't fetch the price for {sym} right now (symbol may be wrong, or the free service is temporarily limited) — try again",
  "errNoSellSym": "No stock in your portfolio to sell",
  "errNoHolding": "This stock was not found in your portfolio",
  "errSharesWithMax": "Enter a valid number of shares (you have {n} shares)",
  "sellSuccess": "Sold {sym} {shares} shares at {price} THB — {plWord} {pl}",
  "plWordProfit": "profit of",
  "plWordLoss": "loss of",
  "sellFail": "Couldn't fetch the price for {sym} right now — try again",
  "resetConfirm": "Start a completely new simulated portfolio? Cash/holdings/trade history will all be cleared (cannot be undone)",
  "resetOkLabel": "Start over",
  "errCashInvalid": "Enter a valid cash amount (cannot be negative)",
  "pageTitle": "Simulated Portfolio"
 }
};
  var L = IC.i18n(DICT), t = L.t;
  var inited = false, priceCache = {};

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { return IC.fmt(n, d); }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function baht(n, d) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + fmt(Math.abs(n), d == null ? 0 : d); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function esc(s) { return IC.esc(s); }

  function defaultState() { return { cash: START_CASH, startCash: START_CASH, holdings: [], tx: [] }; }
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY));
      if (s && isFinite(s.cash) && Array.isArray(s.holdings) && Array.isArray(s.tx)) return s;
    } catch (e) {}
    return defaultState();
  }
  function saveState(s) { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {} }
  /* แก้สถานะ: อ่านสด → mut(state) → เขียนทั้งก้อน */
  function mutate(fn) { var s = loadState(); var r = fn(s); saveState(s); return r; }
  function findHolding(s, sym) { for (var i = 0; i < s.holdings.length; i++) if (s.holdings[i].sym === sym) return s.holdings[i]; return null; }

  function getPrice(sym, force) {
    var c = priceCache[sym];
    if (!force && c && Date.now() - c.ts < 5 * 60 * 1000) return Promise.resolve(c.price);
    return IC.quote(sym + '.BK', { force: !!force }).then(function (q) { priceCache[sym] = { price: q.price, ts: Date.now() }; return q.price; });
  }
  /* ราคาปิดของวันทำการล่าสุดที่ไม่เกินวันที่เลือก (ดึงแท่งรายวัน ~12 วันก่อนหน้า) */
  function fetchHistoricalPrice(sym, dateStr) {
    var period2 = Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 1000) + 86400, period1 = period2 - 12 * 86400;
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '.BK?period1=' + period1 + '&period2=' + period2 + '&interval=1d';
    return IC.fetchText(url, { timeout: 8000 }).then(function (txt) { return Calc.parseHistoricalClose(JSON.parse(txt)); });
  }

  function setTradeStatus(msg, cls) { var el = $('tradeStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function doBuy() {
    var sym = ($('buySym').value || '').trim().toUpperCase().replace(/\.BK$/, '');
    var shares = num($('buyShares').value), dateStr = $('buyDate') ? $('buyDate').value : '';
    var backdated = !!dateStr && dateStr !== todayStr();
    if (!sym) { setTradeStatus(t('errEnterSym'), 'err'); return; }
    if (!isFinite(shares) || shares <= 0) { setTradeStatus(t('errShares'), 'err'); return; }
    if (dateStr && dateStr > todayStr()) { setTradeStatus(t('errFutureDate'), 'err'); return; }
    setTradeStatus(backdated ? t('statusFetchingHist', { sym: sym, date: dateStr }) : t('statusFetching', { sym: sym }));
    $('buyBtn').disabled = true;
    var pricePromise = backdated ? fetchHistoricalPrice(sym, dateStr) : getPrice(sym, true).then(function (price) { return { price: price, ts: Date.now() }; });
    pricePromise.then(function (res) {
      $('buyBtn').disabled = false;
      var price = res.price, txTs = res.ts, cost = shares * price, noCash = null;
      mutate(function (s) {   /* อ่านสดหลังรอราคา — ไม่ใช้ state เก่า */
        if (cost > s.cash + 1e-6) { noCash = s.cash; return; }
        var h = findHolding(s, sym);
        if (h) { h.avgCost = (h.shares * h.avgCost + shares * price) / (h.shares + shares); h.shares += shares; }
        else s.holdings.push({ sym: sym, shares: shares, avgCost: price });
        s.cash -= cost;
        s.tx.unshift({ ts: txTs, type: 'buy', sym: sym, shares: shares, price: price, amount: cost });
      });
      if (noCash != null) { setTradeStatus(t('errNoCash', { cost: baht(cost), cash: baht(noCash) }), 'err'); return; }
      $('buySym').value = ''; $('buyShares').value = ''; if ($('buyDate')) $('buyDate').value = '';
      setTradeStatus(t('buySuccess', { sym: sym, shares: fmt0(shares), price: fmt(price), cost: baht(cost),
        backdated: backdated ? t('buySuccessBackdatedSuffix', { date: new Date(txTs).toLocaleDateString('th-TH') }) : '' }), 'ok');
      renderAll();
    }, function () {
      $('buyBtn').disabled = false;
      setTradeStatus(backdated ? t('buyFailHist', { sym: sym, date: dateStr }) : t('buyFail', { sym: sym }), 'err');
    });
  }
  function doSell() {
    var sym = $('sellSym').value, shares = num($('sellShares').value), st = loadState();
    if (!sym) { setTradeStatus(t('errNoSellSym'), 'err'); return; }
    var h0 = findHolding(st, sym);
    if (!h0) { setTradeStatus(t('errNoHolding'), 'err'); return; }
    if (!isFinite(shares) || shares <= 0 || shares > h0.shares) { setTradeStatus(t('errSharesWithMax', { n: fmt0(h0.shares) }), 'err'); return; }
    setTradeStatus(t('statusFetching', { sym: sym }));
    $('sellBtn').disabled = true;
    getPrice(sym, true).then(function (price) {
      $('sellBtn').disabled = false;
      var realizedPl = 0, bad = false;
      mutate(function (s) {
        var h = findHolding(s, sym);
        if (!h || shares > h.shares + 1e-9) { bad = true; return; }
        var proceeds = shares * price; realizedPl = (price - h.avgCost) * shares;
        h.shares -= shares;
        if (h.shares <= 1e-9) s.holdings = s.holdings.filter(function (x) { return x.sym !== sym; });
        s.cash += proceeds;
        s.tx.unshift({ ts: Date.now(), type: 'sell', sym: sym, shares: shares, price: price, amount: proceeds, realizedPl: realizedPl });
      });
      if (bad) { setTradeStatus(t('errNoHolding'), 'err'); renderAll(); return; }
      $('sellShares').value = '';
      setTradeStatus(t('sellSuccess', { sym: sym, shares: fmt0(shares), price: fmt(price), plWord: realizedPl >= 0 ? t('plWordProfit') : t('plWordLoss'), pl: baht(Math.abs(realizedPl)) }), realizedPl >= 0 ? 'ok' : 'err');
      renderAll();
    }, function () { $('sellBtn').disabled = false; setTradeStatus(t('sellFail', { sym: sym }), 'err'); });
  }
  function doReset() {
    window.tanotConfirm(t('resetConfirm'), { danger: true, okLabel: t('resetOkLabel') }).then(function (ok) {
      if (!ok) return;
      saveState(defaultState()); renderAll();
    });
  }

  function renderSummary(s) {
    var holdVal = 0;
    s.holdings.forEach(function (h) { var c = priceCache[h.sym]; holdVal += h.shares * (c ? c.price : h.avgCost); });
    var total = s.cash + holdVal, pl = total - s.startCash, pct = s.startCash ? pl / s.startCash * 100 : 0;
    $('sCash').textContent = baht(s.cash); $('sHoldVal').textContent = baht(holdVal); $('sTotal').textContent = baht(total);
    var plEl = $('sPl'); plEl.textContent = (pl >= 0 ? '+' : '') + baht(pl); plEl.className = 'kpi-value ' + (pl > 0 ? 'up' : pl < 0 ? 'dn' : '');
    $('sPlPct').textContent = (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%';
  }
  function renderHoldings(s) {
    var tbl = $('holdTable'), empty = $('holdEmpty'), sel = $('sellSym');
    if (!s.holdings.length) { tbl.innerHTML = ''; empty.style.display = 'block'; sel.innerHTML = ''; return; }
    empty.style.display = 'none';
    var rows = '<thead><tr><th>' + t('thHoldSym') + '</th><th>' + t('thHoldShares') + '</th><th>' + t('thHoldAvg') + '</th><th>' + t('thHoldPrice') + '</th><th>' + t('thHoldVal') + '</th><th>' + t('thHoldPl') + '</th></tr></thead><tbody>', selHtml = '';
    s.holdings.forEach(function (h) {
      var c = priceCache[h.sym], price = c ? c.price : NaN, val = h.shares * (isFinite(price) ? price : h.avgCost);
      var pl = isFinite(price) ? (price - h.avgCost) * h.shares : NaN, pct = isFinite(pl) ? pl / (h.avgCost * h.shares) * 100 : NaN;
      rows += '<tr><td>' + esc(h.sym) + '</td><td>' + fmt0(h.shares) + '</td><td>' + fmt(h.avgCost) + '</td><td>' + (isFinite(price) ? fmt(price) : t('priceNotFetched')) + '</td><td>' + baht(val) + '</td>' +
        '<td class="' + (pl > 0 ? 'up' : pl < 0 ? 'dn' : '') + '">' + (isFinite(pl) ? (pl >= 0 ? '+' : '') + baht(pl) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)' : '') : '—') + '</td></tr>';
      selHtml += '<option value="' + esc(h.sym) + '">' + esc(h.sym) + ' (' + t('optHoldSuffix', { n: fmt0(h.shares) }) + ')</option>';
    });
    tbl.innerHTML = rows + '</tbody>';
    var prevSel = sel.value; sel.innerHTML = selHtml;
    if (s.holdings.some(function (h) { return h.sym === prevSel; })) sel.value = prevSel;
  }
  function renderTx(s) {
    var tbl = $('txTable'), empty = $('txEmpty');
    if (!s.tx.length) { tbl.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    var rows = '<thead><tr><th>' + t('thTxDate') + '</th><th>' + t('thTxType') + '</th><th>' + t('thTxSym') + '</th><th>' + t('thTxShares') + '</th><th>' + t('thTxPrice') + '</th><th>' + t('thTxAmt') + '</th><th>' + t('thTxPl') + '</th></tr></thead><tbody>';
    /* เรียงตามเวลาจริงเสมอ (รายการซื้อย้อนหลังอาจถูกเพิ่มทีหลัง) */
    s.tx.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 100).forEach(function (tx) {
      var dateTxt = new Date(tx.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + new Date(tx.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      rows += '<tr><td>' + dateTxt + '</td><td><span class="badge ' + (tx.type === 'buy' ? 'ok' : 'err') + '">' + (tx.type === 'buy' ? t('txTypeBuy') : t('txTypeSell')) + '</span></td>' +
        '<td>' + esc(tx.sym) + '</td><td>' + fmt0(tx.shares) + '</td><td>' + fmt(tx.price) + '</td><td>' + baht(tx.amount) + '</td>' +
        '<td class="' + (tx.realizedPl > 0 ? 'up' : tx.realizedPl < 0 ? 'dn' : '') + '">' + (tx.type === 'sell' && isFinite(tx.realizedPl) ? (tx.realizedPl >= 0 ? '+' : '') + baht(tx.realizedPl) : '—') + '</td></tr>';
    });
    tbl.innerHTML = rows + '</tbody>';
  }
  function renderAll() { var s = loadState(); renderSummary(s); renderHoldings(s); renderTx(s); }

  function refreshAllPrices() {
    var s = loadState(); if (!s.holdings.length) return;
    $('refreshBtn').disabled = true;
    IC.sequence(s.holdings, function (h) { return getPrice(h.sym, true); }, 260).then(function () { $('refreshBtn').disabled = false; renderAll(); });
  }
  function editCash() { $('cashEditInput').value = Math.round(loadState().cash); $('cashEditRow').hidden = false; $('sCash').hidden = true; $('cashEditInput').focus(); $('cashEditInput').select(); }
  function cancelEditCash() { $('cashEditRow').hidden = true; $('sCash').hidden = false; }
  function saveEditCash() {
    var v = num($('cashEditInput').value);
    if (!isFinite(v) || v < 0) { window.tanotAlert(t('errCashInvalid')); return; }
    mutate(function (s) { s.cash = v; });
    cancelEditCash(); renderAll();
  }

  function init() {
    if (inited) { renderAll(); return; }
    inited = true;
    L.apply($('panelPaper'));
    if ($('buyDate')) $('buyDate').max = todayStr();
    $('buyBtn').addEventListener('click', doBuy); $('sellBtn').addEventListener('click', doSell);
    $('resetBtn').addEventListener('click', doReset); $('refreshBtn').addEventListener('click', refreshAllPrices);
    $('cashEditBtn').addEventListener('click', editCash); $('cashEditCancel').addEventListener('click', cancelEditCash); $('cashEditSave').addEventListener('click', saveEditCash);
    $('cashEditInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveEditCash(); if (e.key === 'Escape') cancelEditCash(); });
    [].forEach.call(document.querySelectorAll('#tradeTabs button'), function (b) {
      b.addEventListener('click', function () {
        [].forEach.call(document.querySelectorAll('#tradeTabs button'), function (x) { x.classList.toggle('on', x === b); });
        var tab = b.getAttribute('data-tab');
        $('buyPane').style.display = tab === 'buy' ? 'block' : 'none'; $('sellPane').style.display = tab === 'sell' ? 'block' : 'none';
        setTradeStatus('');
      });
    });
    IC.onLang(function () { L.apply($('panelPaper')); renderAll(); });
    if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () { if (!$('panelPaper').hidden) renderAll(); });
    renderAll();
  }
  window.InvestPaper = { init: init, defaultState: defaultState };
})();
