/* FINAL 1 — KPI Dashboard (new universal/domain-agnostic module, additive)
   Two independent modes, chosen automatically by what columns are present:

   1) Auto-detect summary — works on ANY uploaded table that doesn't match one of
      the other specialized templates. Profiles the columns itself (finds a date
      column, a primary numeric column, a low-cardinality categorical column) —
      no keyword schema required. This is the catch-all fallback, so unlike the
      other domain modules it also activates on plain "Auto" (no override) as
      long as nothing more specific has already claimed the slot this render pass
      — <script> tag for this file MUST be the LAST domain module in the HTML so
      every more specific module gets first refusal within the same frame.

   2) KPI Scorecard — activates instead of (1) when the sheet itself IS a KPI
      catalog: one row per KPI with name/weight/target/actual columns. Shows a
      weighted scorecard with min–target–max gauge bars and a 1-5 grade per KPI,
      adapted from a reference corporate scorecard screenshot the user shared.
      Grade is derived from a fixed, documented formula (% of target achieved)
      — never hand-picked, since real uploaded data has no "designer's judgment"
      to lean on.

   Follows the structural pattern of report-dashboard.safety.final1.js (own
   getData/injectLayout/render, does not touch the table renderer). Needs a new
   dropdown option "kpidashboard" added to #dashboardTemplateSel/#domainOverrideSel
   (this domain didn't pre-exist like legal/risk/finance/reading did). */
(function(){
  'use strict';
  var raf=0, scheduled=false, bootAttempts=0;
  function q(s,r){return (r||document).querySelector(s)}
  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function text(v){return String(v==null?'':v).trim()}
  function esc(v){var d=document.createElement('div');d.textContent=text(v);return d.innerHTML}
  function num(v){
    if(v==null||v==='') return null;
    var s=String(v).replace(/,/g,'').replace(/%/g,'').trim();
    if(!s) return null;
    var stripped=s.replace(/[^0-9.\-]/g,'');
    // บั๊กที่เจอ (Playwright): Number('')===0 (ไม่ใช่ NaN) ทำให้ข้อความที่ไม่มีตัวเลขเลย (เช่น ชื่อจังหวัด,
    // "N/A") ถูกตีความเป็น 0 แทนที่จะเป็น "ไม่ใช่ตัวเลข" — ผลคือใน profileColumns() คอลัมน์ข้อความล้วนถูก
    // เข้าใจผิดว่าเป็นคอลัมน์ตัวเลข (ทุกค่า=0) ต้องเช็คว่ามีอย่างน้อย 1 หลักจริงๆ ก่อน
    if(!stripped || !/\d/.test(stripped)) return null;
    var n=Number(stripped);
    return isFinite(n)?n:null;
  }
  function date(v){
    if(v==null||v==='')return null;
    if(v instanceof Date && !isNaN(v))return new Date(v.getTime());
    var s=text(v), m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(m){var y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),+(m[6]||0));}
    var iso=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if(iso)return new Date(+iso[1],+iso[2]-1,+iso[3],+(iso[4]||0),+(iso[5]||0),+(iso[6]||0));
    var n=Number(s);
    if(isFinite(n)&&n>20000&&n<80000)return new Date(Date.UTC(1899,11,30)+n*86400000);
    // บั๊กที่เจอ (Playwright): new Date("ORD-8001") ของเบราว์เซอร์ parse ผ่านได้จริงเป็นปี ค.ศ. 8001 (lenient
    // parser) ทำให้คอลัมน์รหัสอ้างอิงอย่าง "ORD-8001" ถูก profileColumns() เข้าใจผิดว่าเป็นคอลัมน์วันที่
    // (เห็นแกน X ของกราฟแนวโน้มกลายเป็นปี 8001-8020) จำกัดผลลัพธ์ให้อยู่ในช่วงปีที่สมเหตุสมผลของข้อมูล
    // ธุรกิจจริงเท่านั้น (1901-2200) นอกช่วงนี้ถือว่า parse ไม่ผ่าน
    var d=new Date(s);
    if(isNaN(d))return null;
    var yr=d.getFullYear();
    return (yr>=1901&&yr<=2200)?d:null;
  }
  var KD_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+KD_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}

  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  // ── โปรไฟล์คอลัมน์เอง (ไม่พึ่ง keyword schema) สำหรับโหมด auto-detect ──
  function profileColumns(st){
    var cols=st.columns||[], sample=st.rows.slice(0,300);
    return cols.map(function(c){
      var vals=sample.map(function(r){return r[c.key];}).filter(function(v){return v!=null&&v!=='';});
      if(!vals.length) return {col:c,type:'empty'};
      var dateHits=0,numHits=0;
      vals.forEach(function(v){ if(date(v)) dateHits++; if(num(v)!=null) numHits++; });
      var n=vals.length;
      if(dateHits/n>0.7) return {col:c,type:'date'};
      if(numHits/n>0.7) return {col:c,type:'number'};
      var distinct={}; vals.forEach(function(v){distinct[text(v).toLowerCase()]=1;});
      return {col:c,type:'text',distinct:Object.keys(distinct).length};
    });
  }

  function getData(){
    var A=window.TanotDashboard;
    if(!A||typeof A.getState!=='function')return null;
    var st=A.getState();
    if(st&&!Array.isArray(st.rows)){
      if(Array.isArray(st.data)) st.rows=st.data;
      else if(Array.isArray(st.records)) st.rows=st.records;
    }
    if(!st||!Array.isArray(st.rows)||!st.rows.length)return null;
    var ov=st.domainOverride;

    // ── ลองโหมด Scorecard ก่อน (ตรวจจำเพาะกว่า) ──
    var sc={
      kpiName: roleCol(st,['kpi name','kpi','ตัวชี้วัด','indicator']),
      weight: roleCol(st,['weight','น้ำหนัก']),
      target: roleCol(st,['target','เป้าหมาย']),
      actual: roleCol(st,['actual','ผลจริง','ค่าจริง']),
      min: roleCol(st,['min','ค่าต่ำสุด']),
      max: roleCol(st,['max','ค่าสูงสุด']),
      frequency: roleCol(st,['frequency','ความถี่']),
      direction: roleCol(st,['direction','ทิศทาง'])
    };
    if(sc.kpiName && sc.target && sc.actual){
      var rows=st.rows.map(function(r,i){
        var target=num(r[sc.target.key]), actual=num(r[sc.actual.key]);
        if(target==null||actual==null)return null;
        var lowerIsBetter = sc.direction ? /lower|ต่ำ/i.test(text(r[sc.direction.key])) : false;
        var min = sc.min?num(r[sc.min.key]):0; if(min==null)min=0;
        var max = sc.max?num(r[sc.max.key]):null; if(max==null)max=Math.max(target,actual)*1.25||1;
        return {
          name: text(r[sc.kpiName.key]),
          weight: sc.weight?num(r[sc.weight.key])||0:0,
          target:target, actual:actual, min:min, max:max, lowerIsBetter:lowerIsBetter,
          frequency: sc.frequency?text(r[sc.frequency.key]):''
        };
      }).filter(Boolean);
      if(rows.length>=2) return {st:st, mode:'scorecard', rows:rows};
    }
    if(ov==='kpidashboard' && sc.kpiName && (sc.target||sc.actual)) return {st:st, mode:'scorecard', rows:[], noMatch:true};

    // ── โหมด auto-detect ──
    var profile=profileColumns(st);
    var dateCol=profile.filter(function(p){return p.type==='date';})[0];
    var numCols=profile.filter(function(p){return p.type==='number';});
    var catCandidates=profile.filter(function(p){return p.type==='text'&&p.distinct>=2&&p.distinct<=Math.max(20,st.rows.length*0.6);});
    var catCol=catCandidates.sort(function(a,b){return a.distinct-b.distinct;})[0];
    if(!numCols.length) return ov==='kpidashboard' ? {st:st, mode:'auto', rows:[], noMatch:true} : null;
    // เลือกคอลัมน์ตัวเลขหลัก: เดาจากชื่อคอลัมน์ก่อน (มูลค่า/ยอด/amount/total) ถ้าไม่เจอใช้ตัวแรก
    var primaryNum = numCols.filter(function(p){return /amount|total|มูลค่า|ยอด|value|price|revenue/i.test(text(p.col.label));})[0] || numCols[0];
    var rows2=st.rows.map(function(r,i){
      return {
        raw:r, i:i,
        date: dateCol?date(r[dateCol.col.key]):null,
        value: primaryNum?num(r[primaryNum.col.key]):null,
        category: catCol?text(r[catCol.col.key])||'(ไม่ระบุ)':null
      };
    });
    return {st:st, mode:'auto', rows:rows2, dateCol:dateCol, primaryNum:primaryNum, catCol:catCol, totalCols:(st.columns||[]).length};
  }

  function injectCSS(){
    if(q('#kpidashboard1-css'))return;
    var s=document.createElement('style');s.id='kpidashboard1-css';s.textContent=`
#kpidashboardControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px;font-family:var(--pc53-font,inherit)}
#kpidashboardControlLayout .kd-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--sh)}
#kpidashboardControlLayout .kd-hero h2{font-size:16px;margin:0}
#kpidashboardControlLayout .kd-hero .kd-sub{font-size:12px;color:var(--muted);margin-top:3px}
#kpidashboardControlLayout .kd-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#kpidashboardControlLayout .kd-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:var(--sh);position:relative}
#kpidashboardControlLayout .kd-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--ok)}
#kpidashboardControlLayout .kd-kpi.warn:after{background:var(--warn)}
#kpidashboardControlLayout .kd-kpi .l{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#kpidashboardControlLayout .kd-kpi .v{font-size:22px;font-weight:850;margin-top:4px;color:var(--ink)}
#kpidashboardControlLayout .kd-kpi .s{font-size:9.5px;color:var(--muted);margin-top:4px}
#kpidashboardControlLayout .kd-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--sh)}
#kpidashboardControlLayout .kd-panel h3{font-size:13px;margin:0 0 3px;font-weight:850}
#kpidashboardControlLayout .kd-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}
#kpidashboardControlLayout .kd-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#kpidashboardControlLayout .kd-grid>.half{grid-column:span 6}#kpidashboardControlLayout .kd-grid>.full{grid-column:1/-1}
#kpidashboardControlLayout .kd-insight{border-left:3px solid var(--ok);padding:10px 13px;font-size:12px;color:var(--ink)}
#kpidashboardControlLayout .kd-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}
#kpidashboardControlLayout .kd-list:last-child{border-bottom:none}
#kpidashboardControlLayout .kd-empty{padding:24px 8px;text-align:center;color:var(--muted);font-size:11px}
#kpidashboardControlLayout svg text{font-family:var(--pc53-font,inherit)}
#kpidashboardControlLayout .kd-trend-scroll{overflow-x:auto}
/* Scorecard */
#kpidashboardControlLayout .kd-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:4px}
#kpidashboardControlLayout .kd-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:10.5px;color:var(--muted);margin-bottom:12px}
#kpidashboardControlLayout .kd-legend span{display:inline-flex;align-items:center;gap:5px}
#kpidashboardControlLayout .kd-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}
#kpidashboardControlLayout .kd-summary-grid{display:grid;grid-template-columns:1fr 1.6fr;gap:10px;margin-bottom:12px}
#kpidashboardControlLayout .kd-gauge-card,#kpidashboardControlLayout .kd-donut-card{background:var(--card);border-radius:13px;box-shadow:var(--sh);padding:14px 16px}
#kpidashboardControlLayout .kd-gauge-card{border:2px solid var(--ok);display:flex;align-items:center;gap:12px}
#kpidashboardControlLayout .kd-donut-card{border:1px solid var(--line)}
#kpidashboardControlLayout .kd-grade-circle{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:850;font-size:12px;color:#fff}
#kpidashboardControlLayout .kd-table-wrap{overflow-x:auto}
#kpidashboardControlLayout .kd-table{width:100%;border-collapse:collapse;font-size:11.5px;min-width:1120px}
#kpidashboardControlLayout .kd-table thead th{text-align:left;font-weight:800;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.03em;padding:0 10px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
#kpidashboardControlLayout .kd-table tbody td{padding:14px 10px;border-bottom:1px solid var(--line);color:var(--ink);vertical-align:middle}
#kpidashboardControlLayout .kd-table tbody tr:last-child td{border-bottom:none}
#kpidashboardControlLayout .kd-freq-pill{display:inline-block;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--brand-sf,#E5EEF9);color:var(--brand-dk,#164A89);white-space:nowrap}
#kpidashboardControlLayout .kd-status-pill{display:inline-block;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap}
#kpidashboardControlLayout .kd-status-pill.done{background:#E9F8EC;color:var(--ok)}
#kpidashboardControlLayout .kd-status-pill.mjk{background:#FEF6EA;color:#B8720A}
#kpidashboardControlLayout .kd-status-pill.bad{background:#FDECEC;color:var(--err)}
#kpidashboardControlLayout .kd-gauge-row{position:relative;min-width:280px;padding-top:22px}
#kpidashboardControlLayout .kd-gauge-row .track{height:6px;border-radius:6px;background:#eef1f4;position:relative}
#kpidashboardControlLayout .kd-gauge-row .fill{position:absolute;left:0;top:0;height:100%;border-radius:6px}
#kpidashboardControlLayout .kd-gauge-row .badge{position:absolute;top:-4px;transform:translateX(-50%);font-size:9.5px;font-weight:800;color:#fff;padding:2px 7px;border-radius:5px;white-space:nowrap}
#kpidashboardControlLayout.kpidashboard-override-hidden{display:none!important}
.kpidashboard-hidden-source{display:none!important}
@media(max-width:1100px){#kpidashboardControlLayout .kd-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#kpidashboardControlLayout .kd-grid>.half{grid-column:1/-1}#kpidashboardControlLayout .kd-summary-grid{grid-template-columns:1fr}}
@media(max-width:700px){#kpidashboardControlLayout .kd-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#kpidashboardControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='kpidashboardControlLayout';
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  // ═══════════════ โหมด 1: Auto-detect ═══════════════
  function buildAuto(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='auto')return true;
    layout.setAttribute('data-built','auto');
    layout.innerHTML=
      '<section class="kd-hero"><h2>📊 KPI Dashboard</h2><div class="kd-sub" id="kdUpdated">แดชบอร์ดสรุปอัตโนมัติสำหรับข้อมูลตารางที่ไม่เข้าข่าย template เฉพาะทางไหนเลย — ตรวจจับคอลัมน์ตัวเลข/วันที่/หมวดหมู่ที่น่าจะใช่เองอัตโนมัติ</div></section>'+
      '<div class="kd-kpis" id="kdKpis"></div>'+
      '<section class="kd-panel kd-insight-panel"><h3>Executive Insight</h3><div id="kdInsight" class="kd-insight"></div></section>'+
      '<div class="kd-grid">'+
        '<section class="kd-panel full" id="kdTrendSection"><h3>แนวโน้มตามเวลา</h3><div class="kd-note">ผลรวมคอลัมน์ตัวเลขต่อเดือน</div><div id="kdTrend"></div></section>'+
        '<section class="kd-panel half" id="kdCatSection"><h3>แยกตามหมวดหมู่ที่เจอ</h3><div class="kd-note">Top ค่าที่พบบ่อยสุด</div><div id="kdCat"></div></section>'+
        '<section class="kd-panel half"><h3>การกระจายค่าตัวเลข</h3><div class="kd-note">แบ่งช่วงคอลัมน์หลักเป็น 4 กลุ่ม</div><div id="kdDist"></div></section>'+
        '<section class="kd-panel full"><h3>ตัวอย่างข้อมูลล่าสุด</h3><div class="kd-note">แถวล่าสุด</div><div id="kdRecent"></div></section>'+
      '</div>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">ตรวจจับคอลัมน์อัตโนมัติจากไฟล์ที่อัปโหลด — Table ด้านล่างไม่ถูกแก้ไข</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('kpidashboard-hidden-source');
    });
    return true;
  }

  function barListHtml(entries,color){
    if(!entries.length)return '<div class="kd-empty">ไม่มีข้อมูล</div>';
    var w=460,rowH=26,h=14+entries.length*rowH,left=118,right=34,barW=w-left-right;
    var maxV=Math.max.apply(null,entries.map(function(e){return e[1];}))||1;
    var out=svgOpen(w,h);
    entries.forEach(function(e,i){
      var y=10+i*rowH, bw=Math.max(2,barW*e[1]/maxV);
      out+='<text x="'+(left-8)+'" y="'+(y+13)+'" text-anchor="end" font-size="10.5" fill="#374151"><title>'+esc(e[0])+'</title>'+esc(e[0].length>16?e[0].slice(0,15)+'…':e[0])+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="16" rx="4" fill="#EEF1F4"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="16" rx="4" fill="'+color+'"/>';
      out+='<text x="'+(left+bw+6)+'" y="'+(y+13)+'" font-size="10.5" font-weight="700" fill="#172033">'+e[1]+'</text>';
    });
    out+='</svg>';
    return out;
  }

  function renderAuto(data){
    var rows=data.rows;
    var withDate=data.dateCol?rows.filter(function(r){return r.date;}):[];
    var withVal=rows.filter(function(r){return r.value!=null;});
    var total=withVal.reduce(function(s,r){return s+r.value;},0);
    var avg=withVal.length?total/withVal.length:0;
    var catMap={}; if(data.catCol) rows.forEach(function(r){ if(r.category) catMap[r.category]=(catMap[r.category]||0)+1; });
    var catCount=Object.keys(catMap).length;
    var filledCells=0, totalCells=rows.length*Math.max(1,data.totalCols||1);
    rows.forEach(function(r){ (data.st.columns||[]).forEach(function(c){ if(r.raw[c.key]!=null && r.raw[c.key]!=='') filledCells++; }); });
    var completeness = totalCells?Math.round(filledCells/totalCells*100):100;

    q('#kdKpis').innerHTML=
      '<div class="kd-kpi"><div class="l">Total Records</div><div class="v">'+rows.length.toLocaleString()+'</div><div class="s">แถวทั้งหมด</div></div>'+
      (data.primaryNum?'<div class="kd-kpi"><div class="l">ผลรวม ('+esc(data.primaryNum.col.label)+')</div><div class="v">'+Math.round(total).toLocaleString()+'</div><div class="s">คอลัมน์ตัวเลขที่เจอ</div></div>':'')+
      (data.primaryNum?'<div class="kd-kpi"><div class="l">ค่าเฉลี่ยต่อรายการ</div><div class="v">'+avg.toLocaleString(undefined,{maximumFractionDigits:1})+'</div><div class="s">Total ÷ Records</div></div>':'')+
      (data.catCol?'<div class="kd-kpi"><div class="l">หมวดหมู่ที่ตรวจพบ</div><div class="v">'+catCount+'</div><div class="s">ค่าต่างกันในคอลัมน์ "'+esc(data.catCol.col.label)+'"</div></div>':'')+
      '<div class="kd-kpi'+(completeness<90?' warn':'')+'"><div class="l">Data Completeness</div><div class="v">'+completeness+'%</div><div class="s">สัดส่วนช่องที่มีข้อมูล</div></div>';

    q('#kdInsight').innerHTML='ตรวจพบ'+(data.dateCol?'คอลัมน์วันที่ 1 คอลัมน์ ("'+esc(data.dateCol.col.label)+'"), ':'')+
      (data.primaryNum?'คอลัมน์ตัวเลข 1 คอลัมน์ ("'+esc(data.primaryNum.col.label)+'"), ':'')+
      (data.catCol?'และคอลัมน์หมวดหมู่ 1 คอลัมน์ ("'+esc(data.catCol.col.label)+'") ':'')+
      'จากทั้งหมด <b>'+rows.length+'</b> แถว — สร้างแดชบอร์ดสรุปให้อัตโนมัติ ข้อมูลครบถ้วน <b>'+completeness+'%</b>';

    var trendSec=q('#kdTrendSection');
    if(data.dateCol && data.primaryNum && withDate.length>=2){
      trendSec&&trendSec.removeAttribute('hidden');
      var byMonth={}; withDate.forEach(function(r){ var k=monthKey(r.date); byMonth[k]=(byMonth[k]||0)+(r.value||0); });
      var keys=Object.keys(byMonth).sort();
      if(keys.length>=2){
        var perM=64,left=48,right=30,top=14,bottom=26,ph=170;
        var w=Math.max(400,left+right+keys.length*perM), h=top+ph+bottom, pw=w-left-right;
        var maxV=Math.ceil(Math.max.apply(null,keys.map(function(k){return byMonth[k];}))*1.15)||1;
        var bw=Math.min(34,perM*0.55), step=pw/keys.length;
        var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
        for(var t=0;t<=4;t++){ var val=maxV*t/4, y=top+ph-ph*t/4; out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/><text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+Math.round(val)+'</text>'; }
        keys.forEach(function(k,i){ var x=left+step*i+(step-bw)/2, v=byMonth[k], h2=ph*v/maxV; out+='<rect x="'+x+'" y="'+(top+ph-h2)+'" width="'+bw+'" height="'+h2+'" fill="#1C5CAB"/><text x="'+(x+bw/2)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="#8a97a3">'+k+'</text>'; });
        out+='</svg>';
        q('#kdTrend').innerHTML='<div class="kd-trend-scroll">'+out+'</div>';
      } else q('#kdTrend').innerHTML='<div class="kd-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม</div>';
    } else trendSec&&trendSec.setAttribute('hidden','');

    var catSec=q('#kdCatSection');
    if(data.catCol){
      catSec&&catSec.removeAttribute('hidden');
      var entries=Object.keys(catMap).map(function(k){return [k,catMap[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
      q('#kdCat').innerHTML=barListHtml(entries,'#1C5CAB');
    } else catSec&&catSec.setAttribute('hidden','');

    if(withVal.length){
      var vs=withVal.map(function(r){return r.value;}).sort(function(a,b){return a-b;});
      var mx=vs[vs.length-1], mn=vs[0], span=(mx-mn)||1;
      var buckets=[0,0,0,0];
      vs.forEach(function(v){ var idx=Math.min(3,Math.floor((v-mn)/span*4)); buckets[idx]++; });
      var qtr=function(i){return Math.round(mn+span*i/4);};
      q('#kdDist').innerHTML=barListHtml([
        [qtr(0)+' – '+qtr(1),buckets[0]],
        [qtr(1)+' – '+qtr(2),buckets[1]],
        [qtr(2)+' – '+qtr(3),buckets[2]],
        [qtr(3)+' – '+qtr(4),buckets[3]]
      ],'#0EA5E9');
    } else q('#kdDist').innerHTML='<div class="kd-empty">ไม่มีคอลัมน์ตัวเลข</div>';

    var recent=(withDate.length?withDate.slice().sort(function(a,b){return b.date-a.date;}):rows).slice(0,10);
    q('#kdRecent').innerHTML=recent.length?recent.map(function(r){
      return '<div class="kd-list"><b>'+(r.category?esc(r.category):'#'+(r.i+1))+'</b><span>'+(r.date?fmt(r.date):'')+'</span><span>'+(r.value!=null?r.value.toLocaleString():'')+'</span></div>';
    }).join(''):'<div class="kd-empty">ไม่มีข้อมูล</div>';

    var today=new Date();
    q('#kdUpdated').textContent='รอบข้อมูลถึง '+fmt(today)+' · '+rows.length.toLocaleString()+' แถว';
  }

  // ═══════════════ โหมด 2: KPI Scorecard ═══════════════
  var GRADE_COLORS=['#DC2626','#F59E0B','#EAB308','#65A30D','#16A34A'];
  var GRADE_LABELS=['1 วิกฤต','2 ต้องปรับปรุง','3 ตามแผน','4 ดี','5 ดีเยี่ยม'];
  function gradeColor(g){return GRADE_COLORS[Math.max(1,Math.min(5,Math.round(g)))-1];}
  // สูตรให้เกรด: % ของเป้าที่ทำได้จริง (achievement) — ไม่ใช้ตัวเลขที่เลือกเอง คำนวณจากข้อมูลล้วนๆ
  // achievement>=100% → 5, 95-99.9%→4, 85-94.9%→3, 70-84.9%→2, <70%→1
  function gradeFromAchievement(pct){
    if(pct>=100)return 5; if(pct>=95)return 4; if(pct>=85)return 3; if(pct>=70)return 2; return 1;
  }
  function computeRow(r){
    var achievement = r.lowerIsBetter ? (r.target/Math.max(r.actual,1e-9))*100 : (r.actual/Math.max(r.target,1e-9))*100;
    return {achievement:achievement, grade:gradeFromAchievement(achievement)};
  }
  function gaugeRowHtml(min,max,target,actual,lowerIsBetter){
    var pct=function(v){return Math.max(0,Math.min(100,(v-min)/((max-min)||1)*100));};
    var ap=pct(actual), tp=pct(target);
    var good=lowerIsBetter?actual<=target:actual>=target;
    var margin=Math.abs(max-min)*0.12;
    var color=good?'#16A34A':(Math.abs(actual-target)<=margin?'#F59E0B':'#DC2626');
    var fmtN=function(v){return (Math.round(v*10)/10).toLocaleString();};
    return '<div class="kd-gauge-row">'+
      '<div class="badge" style="left:'+ap+'%;background:'+color+'">'+fmtN(actual)+'</div>'+
      '<div class="track"><div class="fill" style="width:'+ap+'%;background:'+color+'"></div>'+
      '<div style="position:absolute;left:'+tp+'%;top:-5px;width:2px;height:16px;background:#172033;transform:translateX(-1px)"></div></div>'+
      '<div style="position:relative;height:14px;margin-top:2px">'+
        '<span style="position:absolute;left:0;font-size:8.5px;color:#8a97a3">'+fmtN(min)+'</span>'+
        '<span style="position:absolute;left:'+tp+'%;transform:translateX(-50%);font-size:8.5px;font-weight:800;color:#172033;white-space:nowrap">🎯'+fmtN(target)+'</span>'+
        '<span style="position:absolute;right:0;font-size:8.5px;color:#8a97a3">'+fmtN(max)+'</span>'+
      '</div></div>';
  }

  function buildScorecard(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='scorecard')return true;
    layout.setAttribute('data-built','scorecard');
    layout.innerHTML=
      '<section class="kd-hero"><h2>🎯 KPI Scorecard</h2><div class="kd-sub" id="kdUpdated">เทียบผลจริงกับเป้าหมายที่ตั้งไว้ต่อตัวชี้วัด พร้อมเกรด 1-5 ตามเกณฑ์ % ที่ทำได้จากเป้า</div></section>'+
      '<div class="kd-legend">'+GRADE_LABELS.map(function(l,i){return '<span><i style="background:'+GRADE_COLORS[i]+'"></i>'+l+'</span>';}).join('')+'</div>'+
      '<div class="kd-summary-grid" id="kdScSummary"></div>'+
      '<section class="kd-panel"><div id="kdScTable"></div></section>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">ตรวจพบจากคอลัมน์ ตัวชี้วัด/เป้าหมาย/ผลจริง ในไฟล์ที่อัปโหลด — Table ด้านล่างไม่ถูกแก้ไข</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('kpidashboard-hidden-source');
    });
    return true;
  }

  function renderScorecard(rows){
    rows.forEach(function(r){ var c=computeRow(r); r.achievement=c.achievement; r.grade=c.grade; });
    var totalW=rows.reduce(function(s,r){return s+r.weight;},0);
    var avgGrade = totalW>0
      ? rows.reduce(function(s,r){return s+r.grade*r.weight;},0)/totalW
      : rows.reduce(function(s,r){return s+r.grade;},0)/rows.length;
    var gradeCounts=[0,0,0,0,0]; rows.forEach(function(r){gradeCounts[r.grade-1]++;});
    var donutEntries=[5,4,3,2,1].map(function(g){return [GRADE_LABELS[g-1],gradeCounts[g-1],GRADE_COLORS[g-1]];}).filter(function(e){return e[1]>0;});

    var circ=2*Math.PI*38, offset=0, segs='';
    var totalCnt=donutEntries.reduce(function(s,e){return s+e[1];},0)||1;
    donutEntries.forEach(function(e){ var len=circ*(e[1]/totalCnt); segs+='<circle cx="56" cy="56" r="38" fill="none" stroke="'+e[2]+'" stroke-width="18" stroke-dasharray="'+len+' '+(circ-len)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 56 56)"/>'; offset+=len; });
    var donutSvg='<svg width="112" height="112" viewBox="0 0 112 112" role="img" style="flex:none">'+segs+'<circle cx="56" cy="56" r="27" fill="#FFFFFF"/><text x="56" y="60" text-anchor="middle" font-size="19" font-weight="850" fill="#101820">'+rows.length+'</text></svg>';
    var donutLegend='<div style="display:flex;flex-direction:column;gap:6px;justify-content:center;flex:1;min-width:150px">'+donutEntries.map(function(e){
      var pct=(e[1]/totalCnt*100).toFixed(0);
      return '<div style="display:flex;align-items:center;gap:8px;font-size:11px"><i style="width:9px;height:9px;border-radius:2px;background:'+e[2]+';display:inline-block;flex:none"></i><span style="flex:1">'+esc(e[0])+'</span><b>'+e[1]+'</b><span style="color:var(--muted);width:30px;text-align:right">'+pct+'%</span></div>';
    }).join('')+'</div>';

    q('#kdScSummary').innerHTML=
      '<div class="kd-gauge-card"><span class="kd-grade-circle" style="width:40px;height:40px;font-size:18px;background:'+gradeColor(Math.round(avgGrade))+'">'+avgGrade.toFixed(1)+'</span><div><div style="font-size:10.5px;color:var(--muted);font-weight:700">เกรดเฉลี่ย'+(totalW>0?'ถ่วงน้ำหนัก':'')+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">จาก '+rows.length+' ตัวชี้วัด'+(totalW>0?' รวมน้ำหนัก '+totalW+'%':'')+'</div></div></div>'+
      '<div class="kd-donut-card"><div style="font-size:10.5px;color:var(--muted);font-weight:700;margin-bottom:8px">Grade Distribution</div><div style="display:flex;align-items:center;gap:16px">'+donutSvg+donutLegend+'</div></div>';

    var hasWeight=totalW>0, hasFreq=rows.some(function(r){return r.frequency;});
    var html='<div class="kd-table-wrap"><table class="kd-table"><thead><tr>'+
      '<th>ตัวชี้วัด (KPI)</th>'+(hasWeight?'<th>น้ำหนัก</th>':'')+(hasFreq?'<th>ความถี่วัด</th>':'')+'<th>เป้าหมาย vs ผลจริง</th><th>เกรด</th><th>สถานะ</th>'+
    '</tr></thead><tbody>'+
    rows.map(function(r){
      var statusCls=r.grade>=4?'done':(r.grade===3?'mjk':'bad');
      var statusTxt=r.grade>=4?'บรรลุเป้าหมาย':(r.grade===3?'ใกล้เป้าหมาย':'ต่ำกว่าเป้าหมาย');
      return '<tr><td><b>'+esc(r.name)+'</b></td>'+
        (hasWeight?'<td style="font-weight:700">'+r.weight+'%</td>':'')+
        (hasFreq?'<td><span class="kd-freq-pill">'+esc(r.frequency||'—')+'</span></td>':'')+
        '<td>'+gaugeRowHtml(r.min,r.max,r.target,r.actual,r.lowerIsBetter)+'</td>'+
        '<td><span class="kd-grade-circle" style="background:'+gradeColor(r.grade)+'">'+r.grade+'</span></td>'+
        '<td><span class="kd-status-pill '+statusCls+'">'+statusTxt+'</span></td></tr>';
    }).join('')+
    '</tbody></table></div>';
    q('#kdScTable').innerHTML=html;

    var today=new Date();
    q('#kdUpdated').textContent='รอบข้อมูลถึง '+fmt(today)+' · '+rows.length+' ตัวชี้วัด';
  }

  function suppressLayout(){
    var layout=q('#kpidashboardControlLayout');
    if(layout) layout.classList.add('kpidashboard-override-hidden');
    qa('.kpidashboard-hidden-source').forEach(function(e){ e.classList.remove('kpidashboard-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้
     (โมดูลนี้เองไม่จำเป็นต้องมีใครมาบังคับตัวเองบ่อย เพราะโหลดท้ายสุด แต่ต้องลงทะเบียนไว้เผื่อโมดูลอื่นที่โหลด
     ก่อนหน้าต้องการบังคับให้ตัวเองเช็คซ้ำตอนสลับกลับมาที่โดเมนนั้นๆ) */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='kpidashboard'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'kpidashboardControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="kd-panel"><h3>📊 KPI Dashboard</h3>'+
      '<div class="kd-empty">ข้อมูลชุดนี้ไม่มีคอลัมน์ตัวเลขให้สรุป (หรือถ้าต้องการ KPI Scorecard ต้องมีคอลัมน์ '+
      'ตัวชี้วัด + เป้าหมาย + ผลจริง) — ลองเลือก Template เป็น "Auto" หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('kpidashboard-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='kpidashboard'){ suppressLayout(); return; }
    var scl=q('#kpidashboardControlLayout'); if(scl) scl.classList.remove('kpidashboard-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    // Mutual exclusion: ให้โดเมนเฉพาะทางอื่นๆ ได้สิทธิ์ก่อนเสมอ (สคริปต์นี้ต้องอยู่ท้ายสุดใน HTML) — เช็คว่า
    // ยังไม่ถูกซ่อนด้วย (className มี "override-hidden") ไม่งั้นโมดูลที่ซ่อนตัวเองไปแล้วจะยังนับเป็น
    // "ครองพื้นที่" อยู่ตลอดไป (บั๊กเดิม) — บังคับให้ทุกโมดูลอื่นประเมินตัวเองใหม่ก่อนด้วย (ดู __tdRevalidate)
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='kpidashboardControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='kpidashboardControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    // เคารพการ์ด generic เดิม (#domainDashboardCard) ถ้ามันเพิ่งเรนเดอร์เนื้อหาจริงไปแล้วในรอบนี้ (ยังมองเห็นอยู่
    // และมี KPI แถวข้างในจริง) — กันไม่ให้ซ้อนทับกับผลของ detectDomain() แบบเดิมที่ยังจับได้แบบหลวมๆ
    var generic=q('#domainDashboardCard');
    if(generic && !generic.classList.contains('kpidashboard-hidden-source') && generic.offsetParent!==null){
      var statRow=generic.querySelector('.stat-row');
      if(statRow && statRow.children.length>0) return;
    }
    if(data.noMatch){ buildNoMatchNotice(); return; }

    if(data.mode==='scorecard'){
      if(!buildScorecard())return;
      renderScorecard(data.rows);
    } else {
      if(!buildAuto())return;
      renderAuto(data);
    }
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[KpiDashboard1]',e);}});
  }

  function init(){
    injectCSS();
    schedule();
    (function bootRetry(){
      var A=window.TanotDashboard;
      if(A&&typeof A.getState==='function'){
        var st=A.getState();
        if(st&&Array.isArray(st.rows)&&st.rows.length){schedule();return;}
      }
      if(bootAttempts++<120) requestAnimationFrame(bootRetry);
    })();
    document.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('.dashboard-nav-btn');
      if(b&&(b.getAttribute('data-section-page')==='projects'||b.getAttribute('data-section')==='dashboardProjects'))setTimeout(schedule,80);
    },true);
    document.addEventListener('change',function(){setTimeout(schedule,50);},true);
    window.addEventListener('resize',schedule,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
