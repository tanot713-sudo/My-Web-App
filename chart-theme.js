/* chart-theme.js — สีกราฟจากโทเคนใน theme.css (--ome-chart-*, --ome-text-*, --ome-surface-1)
   ส่งต่อให้ Lightweight Charts / Chart.js / ECharts แล้วอัปเดตเองเมื่อสลับสว่าง/มืด/สีเน้น/ฟอนต์
   ใช้:  var t = OmeChartTheme.get();                      // ค่าสีปัจจุบัน
         chart.applyOptions(OmeChartTheme.lightweight());   // Lightweight Charts
         OmeChartTheme.chartjs(Chart);                      // ตั้ง Chart.defaults
         echarts.init(el, OmeChartTheme.echarts());         // ECharts
         OmeChartTheme.onChange(function (t) { ... });      // วาดใหม่เมื่อธีมเปลี่ยน */
(function () {
  var root = document.documentElement;
  function v(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  /* ค่าที่เป็น color-mix()/var() ต้องให้เบราว์เซอร์คำนวณก่อน แล้วแปลงเป็น rgb() ผ่าน canvas 1px
     (computed style ของ color-mix ออกมาเป็น color(srgb ...) ซึ่งไลบรารีกราฟอ่านไม่ได้) */
  var probe, ctx;
  function resolve(name) {
    if (!probe) {
      probe = document.createElement('span');
      probe.style.display = 'none';
      (document.body || root).appendChild(probe);
      var c = document.createElement('canvas');
      c.width = c.height = 1;
      ctx = c.getContext('2d', { willReadFrequently: true });
    }
    probe.style.color = 'var(' + name + ')';
    var css = getComputedStyle(probe).color;
    if (!ctx) return css;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return d[3] === 255 ? 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')'
      : 'rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ',' + (d[3] / 255).toFixed(3) + ')';
  }
  function withAlpha(rgb, a) {
    var m = rgb.match(/[\d.]+/g);
    return m ? 'rgba(' + m[0] + ',' + m[1] + ',' + m[2] + ',' + a + ')' : rgb;
  }

  function get() {
    var series = [];
    for (var i = 1; i <= 8; i++) series.push(resolve('--ome-chart-' + i));
    return {
      dark: root.getAttribute('data-theme') === 'dark',
      series: series,
      up: resolve('--ome-chart-up'),
      down: resolve('--ome-chart-down'),
      accent: resolve('--ome-accent'),
      grid: resolve('--ome-chart-grid'),
      axis: resolve('--ome-chart-axis'),
      text: resolve('--ome-text-1'),
      textMuted: resolve('--ome-text-2'),
      surface: resolve('--ome-surface-1'),
      border: resolve('--ome-border'),
      font: v('--ome-f') || 'system-ui, sans-serif'
    };
  }

  /* Lightweight Charts (TradingView) — chart.applyOptions(...) */
  function lightweight() {
    var t = get();
    return {
      layout: { background: { type: 'solid', color: t.surface }, textColor: t.textMuted, fontFamily: t.font },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
      crosshair: { vertLine: { color: t.axis, labelBackgroundColor: t.text }, horzLine: { color: t.axis, labelBackgroundColor: t.text } }
    };
  }
  /* สีแท่งเทียน/เส้นขึ้นลง — series.applyOptions(OmeChartTheme.candles()) */
  function candles() {
    var t = get();
    return { upColor: t.up, downColor: t.down, borderUpColor: t.up, borderDownColor: t.down, wickUpColor: t.up, wickDownColor: t.down };
  }

  /* Chart.js — ตั้งค่าเริ่มต้นทั้งหน้า แล้ว chart.update() กราฟที่วาดไปแล้ว */
  function chartjs(Chart) {
    var t = get();
    if (!Chart || !Chart.defaults) return t;
    Chart.defaults.color = t.textMuted;
    Chart.defaults.borderColor = t.grid;
    Chart.defaults.font.family = t.font;
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = t.text;
      Chart.defaults.plugins.tooltip.titleColor = t.surface;
      Chart.defaults.plugins.tooltip.bodyColor = t.surface;
    }
    return t;
  }

  /* ECharts — ส่งเป็นอ็อบเจกต์ธีมตอน echarts.init(el, theme) (เปลี่ยนธีมต้อง dispose แล้ว init ใหม่) */
  function echarts() {
    var t = get();
    var axis = { axisLine: { lineStyle: { color: t.border } }, axisTick: { lineStyle: { color: t.border } },
      axisLabel: { color: t.textMuted }, splitLine: { lineStyle: { color: t.grid } } };
    return {
      color: t.series,
      backgroundColor: 'transparent',
      textStyle: { color: t.text, fontFamily: t.font },
      title: { textStyle: { color: t.text }, subtextStyle: { color: t.textMuted } },
      legend: { textStyle: { color: t.textMuted } },
      tooltip: { backgroundColor: t.surface, borderColor: t.border, textStyle: { color: t.text } },
      categoryAxis: axis, valueAxis: axis, timeAxis: axis, logAxis: axis,
      candlestick: { itemStyle: { color: t.up, color0: t.down, borderColor: t.up, borderColor0: t.down } }
    };
  }

  var listeners = [];
  var pending = false;
  function notify() {
    if (pending) return;
    pending = true;
    /* รอให้ CSS ของค่าใหม่คำนวณเสร็จก่อนอ่านสี */
    requestAnimationFrame(function () {
      pending = false;
      var t = get();
      for (var i = 0; i < listeners.length; i++) { try { listeners[i](t); } catch (e) {} }
    });
  }
  new MutationObserver(notify).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'data-style', 'style'] });

  window.OmeChartTheme = {
    get: get, lightweight: lightweight, candles: candles, chartjs: chartjs, echarts: echarts,
    alpha: withAlpha,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
