/* ══════════════════════════════════════════════════════════════════
   Tanot — dom-runner-worker.js
   รันโค้ด JS ของผู้เรียนที่จัดการ DOM แบบแยกส่วน (sandbox) สำหรับแทร็ก "DOM (JS)"

   ⚠️ ทำไมไม่ใช้ DOM จริงใน <iframe> (ต่างจากที่ลองก่อนแล้วพบปัญหาจริง):
   ตอนแรกออกแบบให้รันโค้ดผู้เรียนใน <iframe sandbox="allow-scripts"> (ตัวเดียวกับพรีวิว HTML)
   เพราะคิดว่า sandbox แยก execution thread จากหน้าเว็บหลักด้วย — ทดสอบจริงแล้วพบว่า "ผิด":
   sandbox แยกแค่ "สิทธิ์" (เข้าถึง cookie/localStorage/top-level navigation ไม่ได้) ไม่ได้แยก
   JS thread เลย ถ้าโค้ดผู้เรียนมีลูปไม่รู้จบ (เช่น while(true){}) มันจะบล็อก event loop ของ
   ทั้ง renderer process รวมถึงหน้าเว็บหลักไปด้วย ทำให้ setTimeout ฝั่ง parent ที่ตั้งไว้เพื่อ
   ตรวจจับ/ฆ่าลูปค้างก็ค้างตามไปด้วย (ยืนยันด้วยการทดสอบจริง: เจอ renderer ค้าง 89% CPU
   ไม่มีทางเรียก timeout ได้เลย) จึงย้ายมาใช้ Web Worker เหมือนแทร็ก JS ทั่วไป (ดู
   code-runner-worker.js) เพราะ Worker มี .terminate() ที่ฆ่าลูปไม่รู้จบได้จริงจากภายนอก

   แต่ Worker ไม่มี document จริง (คนละ global scope จากหน้าเว็บหลัก) จึงสร้าง "DOM จำลอง"
   (fake document) ขั้นต่ำ พอสำหรับสิ่งที่แบบฝึกหัดในแทร็กนี้ต้องใช้: getElementById/querySelector/
   querySelectorAll, .textContent, .style.xxx, .classList.add/remove/contains/toggle,
   getAttribute/setAttribute, addEventListener/removeEventListener, .click() (จำลอง event)
   รันเสร็จแล้ว serialize สถานะสุดท้ายของ DOM จำลองกลับเป็น HTML string ธรรมดา (ไม่มีสคริปต์เลย)
   ส่งกลับไปให้หน้าเว็บหลัก set เป็น srcdoc ของ iframe พรีวิว — ผู้เรียนเห็นผลลัพธ์จริงเป็นภาพ
   แต่ตัว "การรัน" เกิดขึ้นใน Worker ที่ฆ่าได้เท่านั้น ไม่มีทางค้างจริง
   ══════════════════════════════════════════════════════════════════ */

function escapeHtmlText(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function makeFakeElement(spec) {
  var el = {
    tag: spec.tag, id: spec.id || '',
    classes: {}, attrs: {}, styleObj: {},
    _text: spec.text || '', _listeners: {}
  };
  if (spec.classes) (Array.isArray(spec.classes) ? spec.classes : Object.keys(spec.classes)).forEach(function (c) { el.classes[c] = true; });
  if (spec.style) Object.keys(spec.style).forEach(function (k) { el.styleObj[k] = spec.style[k]; });
  if (spec.attrs) Object.keys(spec.attrs).forEach(function (k) { el.attrs[k] = spec.attrs[k]; });

  Object.defineProperty(el, 'textContent', {
    get: function () { return el._text; },
    set: function (v) { el._text = String(v); }
  });
  Object.defineProperty(el, 'innerText', {
    get: function () { return el._text; },
    set: function (v) { el._text = String(v); }
  });
  Object.defineProperty(el, 'style', {
    /* Proxy เพื่อรองรับ property ใดๆ แบบไดนามิก (el.style.color = 'red', el.style.fontSize = ...)
       โดยไม่ต้องประกาศชื่อ CSS property ล่วงหน้าทุกตัว */
    get: function () {
      return new Proxy(el.styleObj, {
        get: function (target, prop) { return target[prop] !== undefined ? target[prop] : ''; },
        set: function (target, prop, value) { target[prop] = String(value); return true; }
      });
    }
  });
  Object.defineProperty(el, 'classList', {
    get: function () {
      return {
        add: function (c) { el.classes[c] = true; },
        remove: function (c) { delete el.classes[c]; },
        contains: function (c) { return !!el.classes[c]; },
        toggle: function (c) { if (el.classes[c]) delete el.classes[c]; else el.classes[c] = true; return !!el.classes[c]; }
      };
    }
  });
  el.getAttribute = function (name) { return el.attrs[name] !== undefined ? el.attrs[name] : null; };
  el.setAttribute = function (name, value) { el.attrs[name] = String(value); };
  el.addEventListener = function (type, fn) {
    if (!el._listeners[type]) el._listeners[type] = [];
    el._listeners[type].push(fn);
  };
  el.removeEventListener = function (type, fn) {
    if (!el._listeners[type]) return;
    el._listeners[type] = el._listeners[type].filter(function (f) { return f !== fn; });
  };
  el.click = function () {
    (el._listeners.click || []).forEach(function (fn) { try { fn.call(el, { type: 'click', target: el }); } catch (e) {} });
  };
  return el;
}

function makeFakeDocument(domSpec) {
  var elements = (domSpec || []).map(makeFakeElement);
  function matchOne(sel) {
    if (!sel) return null;
    if (sel[0] === '#') { var id = sel.slice(1); for (var i = 0; i < elements.length; i++) if (elements[i].id === id) return elements[i]; return null; }
    if (sel[0] === '.') { var cls = sel.slice(1); for (var j = 0; j < elements.length; j++) if (elements[j].classes[cls]) return elements[j]; return null; }
    for (var k = 0; k < elements.length; k++) if (elements[k].tag === sel) return elements[k];
    return null;
  }
  return {
    getElementById: function (id) { for (var i = 0; i < elements.length; i++) if (elements[i].id === id) return elements[i]; return null; },
    querySelector: matchOne,
    querySelectorAll: function (sel) {
      if (!sel) return [];
      if (sel[0] === '.') { var cls = sel.slice(1); return elements.filter(function (e) { return e.classes[cls]; }); }
      if (sel[0] === '#') { var el = matchOne(sel); return el ? [el] : []; }
      return elements.filter(function (e) { return e.tag === sel; });
    },
    _elements: elements
  };
}

function elementSpecToHtml(el) {
  var styleStr = Object.keys(el.styleObj || {}).map(function (k) {
    var cssProp = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
    return cssProp + ': ' + el.styleObj[k] + ';';
  }).join(' ');
  var classStr = Object.keys(el.classes || {}).filter(function (c) { return el.classes[c]; }).join(' ');
  var attrsStr = Object.keys(el.attrs || {}).map(function (k) { return ' ' + k + '="' + escapeHtmlText(el.attrs[k]) + '"'; }).join('');
  return '<' + el.tag +
    (el.id ? ' id="' + el.id + '"' : '') +
    (classStr ? ' class="' + classStr + '"' : '') +
    (styleStr ? ' style="' + styleStr + '"' : '') +
    attrsStr + '>' + escapeHtmlText(el._text) + '</' + el.tag + '>';
}

/* ตัวแปร document ต้องเป็น global ของสคริปต์ (ประกาศนอก onmessage) เพราะ (0, eval) แบบ indirect
   รันใน global scope ของ worker เท่านั้น มองไม่เห็นตัวแปร local ของฟังก์ชัน onmessage เลย */
var document;

self.onmessage = function (e) {
  var msg = e.data || {};
  var logs = [];
  var origLog = console.log;
  console.log = function () {
    var parts = Array.prototype.slice.call(arguments).map(function (a) {
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch (err) { return String(a); } }
      return String(a);
    });
    logs.push(parts.join(' '));
  };

  document = makeFakeDocument(msg.domSpec);
  var runtimeError = null;

  try {
    (0, eval)(msg.code || '');
  } catch (err) {
    runtimeError = String(err && err.message || err);
  }

  (msg.preActions || []).forEach(function (a) {
    try {
      var el = document.querySelector(a.selector);
      if (el && a.type === 'click') el.click();
    } catch (err) {}
  });

  var testResults = (msg.tests || []).map(function (test) {
    try {
      if (test.type === 'dom-exists') return { label: test.label, pass: !!document.querySelector(test.selector) };
      var el = document.querySelector(test.selector);
      if (!el) return { label: test.label, pass: false };
      if (test.type === 'dom-text') return { label: test.label, pass: (el._text || '').indexOf(test.includes) !== -1 };
      if (test.type === 'dom-attr') return { label: test.label, pass: ((el.attrs[test.attr] || '')).indexOf(test.includes) !== -1 };
      if (test.type === 'dom-style') return { label: test.label, pass: String(el.styleObj[test.prop] || '').indexOf(test.includes) !== -1 };
      if (test.type === 'dom-class') return { label: test.label, pass: !!el.classes[test.class] };
      if (test.type === 'dom-count') return { label: test.label, pass: document.querySelectorAll(test.selector).length === test.count };
      return { label: test.label, pass: false };
    } catch (err) { return { label: test.label, pass: false }; }
  });

  var previewHtml = (msg.previewCss ? '<style>' + msg.previewCss + '</style>\n' : '') +
    document._elements.map(elementSpecToHtml).join('\n');

  console.log = origLog;
  self.postMessage({ jobId: msg.jobId, logs: logs, testResults: testResults, runtimeError: runtimeError, previewHtml: previewHtml });
};
