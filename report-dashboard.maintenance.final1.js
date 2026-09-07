/* FINAL 1 — Maintenance Control (enhanced visual treatment for the EXISTING
   maintenance domain, additive). Reuses the same column-name keyword
   conventions as DOMAIN_ROLES.maintenance in report-dashboard.complete.final43.local.js
   (workorder, equipmentno, equipmenttype, downtime, planstart/finish,
   actstart/end, matcost/laborcost/othercost, status, priority, failuremode,
   subsystem) so it activates on the exact same real-world column headers,
   but renders the Project-Control-style rich layout instead of the generic
   2-chart domain card.
*/
(function(){
  'use strict';
  var raf=0, scheduled=false, bootAttempts=0;
  function q(s,r){return (r||document).querySelector(s)}
  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function text(v){return String(v==null?'':v).trim()}
  function esc(v){var d=document.createElement('div');d.textContent=text(v);return d.innerHTML}
  function num(v){
    if(v==null||v==='')return null;
    if(typeof v==='number')return isFinite(v)?v:null;
    var s=String(v).replace(/,/g,'').trim();
    if(!s)return null;
    var n=Number(s.replace(/[^0-9.\-]/g,''));
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
    var d=new Date(s);
    return isNaN(d)?null:d;
  }
  /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control): toLocaleDateString('en-GB',...) ย่อเดือนกันยายนเป็น
     "Sept" (4 ตัวอักษร) ต่างจากเดือนอื่นที่ย่อ 3 ตัว ทำให้คอลัมน์วันที่จัดแนวไม่ตรงกัน ใช้ตารางเดือนย่อ
     3 ตัวอักษรคงที่เองแทน */
  var MNT_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+MNT_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  /* PM (preventive) vs CM (corrective/breakdown) classifier — same idiom as
     the base app's finance income/expense classifier, applied to whichever
     text column (work-order type, failure mode, or status) carries the hint. */
  var PM_KW=['pm','preventive','planned','ตามแผน','ป้องกัน','บำรุงรักษาเชิงป้องกัน'];
  var CM_KW=['cm','corrective','breakdown','unplanned','ฉุกเฉิน','ซ่อมฉุกเฉิน','เสีย','ขัดข้อง'];
  function classifyWO(a,b,c){
    var n=(text(a)+' '+text(b)+' '+text(c)).toLowerCase();
    if(CM_KW.some(function(k){return n.indexOf(k)>=0}))return 'cm';
    if(PM_KW.some(function(k){return n.indexOf(k)>=0}))return 'pm';
    return 'other';
  }
  var LATE_KW=['late','overdue','delay','ล่าช้า','เกินกำหนด'];
  var DONE_KW=['complete','closed','done','เสร็จ','ปิดงาน'];
  function woStatus(v){
    var n=text(v).toLowerCase();
    if(LATE_KW.some(function(k){return n.indexOf(k)>=0}))return 'late';
    if(DONE_KW.some(function(k){return n.indexOf(k)>=0}))return 'done';
    return n?'other':'unknown';
  }
  /* สำหรับตาราง "อุปกรณ์ที่ต้องเฝ้าระวัง" (ตามที่ผู้ใช้ขอเทียบ template) — เช็คว่างานที่ค้างอยู่ของ
     เครื่องจักรนั้นกำลัง "รอชิ้นส่วน/อะไหล่" อยู่หรือไม่ จากข้อความในอาการเสีย/สถานะ */
  var AWAIT_PARTS_KW=['await','waiting for part','pending part','รออะไหล่','รอชิ้นส่วน','รอของ','รอสั่งซื้อ'];
  function isAwaitingParts(r){
    var n=(text(r.status)+' '+text(r.failuremode)).toLowerCase();
    return AWAIT_PARTS_KW.some(function(k){return n.indexOf(k)>=0});
  }
  /* PSD (Platform Screen Door) เป็นกลุ่มเครื่องจักรเฉพาะของระบบรถไฟฟ้าที่ template อ้างอิงใช้ทำ KPI
     "PSD Availability" แยกต่างหาก — เช็คจากชื่อประเภทเครื่องจักรว่าเข้าข่ายกลุ่มนี้ไหม ถ้าไม่มีเครื่องจักร
     กลุ่มนี้เลยในข้อมูล จะคำนวณ Availability ของเครื่องจักรทั้งหมดแทน (ดู computeAvailability) */
  var PSD_KW=['psd','platform screen door','ประตูกั้นชานชาลา'];
  function isPsdEquip(equipmentType){
    var n=text(equipmentType).toLowerCase();
    return PSD_KW.some(function(k){return n.indexOf(k)>=0});
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
    var c={
      workorder: roleCol(st,['workorder','work order','ใบสั่งงาน','เลขที่งาน']),
      equipmentno: roleCol(st,['equipmentno','equipment no','equipment id','รหัสเครื่องจักร','รหัสอุปกรณ์']),
      equipmenttype: roleCol(st,['equipmenttype','equipment type','ประเภทเครื่องจักร','ประเภทอุปกรณ์']),
      downtime: roleCol(st,['downtime','เวลาหยุด','หยุดทำงาน']),
      planfinish: roleCol(st,['planfinish','plan finish','planworkfinish','กำหนดเสร็จ']),
      actstart: roleCol(st,['actworkstart','actualstart','actual start','เริ่มปฏิบัติงาน','เริ่มจริง']),
      actend: roleCol(st,['actworkend','actualend','actual end','เสร็จปฏิบัติงาน','เสร็จจริง']),
      matcost: roleCol(st,['matcost','material cost','ค่าวัสดุ','ค่าอะไหล่']),
      laborcost: roleCol(st,['laborcost','labourcost','labor cost','ค่าแรง']),
      status: roleCol(st,['status','สถานะ']),
      failuremode: roleCol(st,['failuremode','failure mode','อาการเสีย','สาเหตุเสีย','รูปแบบการเสีย']),
      workordertype: roleCol(st,['work order type','wo type','maintenance type','ประเภทงาน','ประเภทการซ่อมบำรุง']),
      /* เพิ่มตามที่ผู้ใช้ขอ (เทียบ template "Maintenance & Asset Operations"): มิติ "สาย/โครงการ" สำหรับ
         กราฟ "PM Compliance รายเดือน แยกตามสาย" — เป็น optional column ไม่กระทบ activation gate เดิม
         ถ้าไฟล์ที่อัปโหลดไม่มีคอลัมน์นี้ กราฟที่พึ่งมันจะซ่อนตัวเอง (ดู renderPmByLine) ไม่ใช่พังหรือว่างเปล่า */
      line: roleCol(st,['line','route','สาย','โครงการ'])
    };
    // Activation gate: needs equipment + (downtime or actstart/actend) — a
    // generic status list without an equipment/downtime concept is too weak
    // to claim as a maintenance log.
    /* บั๊กที่เจอ (รายงานจากผู้ใช้): เดิมโมดูลนี้ไม่เคยอ่าน state.domainOverride เลย ทำให้เลือก Template =
       "Maintenance" ในดรอปดาวน์แล้วไม่มีผลจริง ยังเดาจากคอลัมน์เท่านั้น — ถ้าผู้ใช้ล็อกมาตรงๆ ว่าเป็น
       Maintenance แต่คอลัมน์ในข้อมูลไม่เข้าเกณฑ์ (เช่นเป็นข้อมูลโปรเจกต์) ให้ส่ง noMatch กลับไปให้ render()
       แสดงข้อความแจ้งเหตุผลแทนความเงียบ (เดิมจะไม่มีอะไรขึ้นเลย ผู้ใช้เดาไม่ออกว่าทำไม) */
    if(!c.equipmentno || !(c.downtime||c.actstart||c.actend)) return ov==='maintenance' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var rows=st.rows.map(function(r,i){
      var actend=date(c.actend?r[c.actend.key]:null);
      var actstart=date(c.actstart?r[c.actstart.key]:null);
      var planfinish=date(c.planfinish?r[c.planfinish.key]:null);
      return {
        raw:r,i:i,
        workorder: c.workorder?text(r[c.workorder.key]):('WO-'+(i+1)),
        equipmentno: c.equipmentno?text(r[c.equipmentno.key])||'(ไม่ระบุ)':'(ไม่ระบุ)',
        equipmenttype: c.equipmenttype?text(r[c.equipmenttype.key]):'',
        downtime: num(c.downtime?r[c.downtime.key]:null),
        planfinish: planfinish,
        actstart: actstart,
        actend: actend,
        matcost: num(c.matcost?r[c.matcost.key]:null)||0,
        laborcost: num(c.laborcost?r[c.laborcost.key]:null)||0,
        status: c.status?text(r[c.status.key]):'',
        failuremode: c.failuremode?text(r[c.failuremode.key]):'',
        workordertype: c.workordertype?text(r[c.workordertype.key]):'',
        line: c.line?text(r[c.line.key]):'',
        anchorDate: actend||actstart||planfinish
      };
    }).filter(function(r){return r.anchorDate;});
    if(rows.length<2) return ov==='maintenance' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c};
  }

  function injectCSS(){
    if(q('#mnt1-css'))return;
    var s=document.createElement('style');s.id='mnt1-css';s.textContent=`
#mntControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px}
#mntControlLayout .mn-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--sh)}
#mntControlLayout .mn-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
#mntControlLayout .mn-hero h2{font-size:16px;margin:0}
#mntControlLayout .mn-hero .mn-sub{font-size:12px;color:var(--muted);margin-top:3px}
/* ตามที่ผู้ใช้ขอ (เทียบ template): แถบ badge "รอบข้อมูล"/"อัปเดตล่าสุด" ที่หัวการ์ด */
#mntControlLayout .mn-badges{display:flex;gap:8px;flex-wrap:wrap;flex:none}
#mntControlLayout .mn-badge{background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:10.5px;color:var(--ink);white-space:nowrap}
/* KPI แถวหลัก (4 ตัวหลักตาม template: PM Compliance/Availability/Backlog/MTTR) ให้เด่นกว่าแถวรอง */
#mntControlLayout .mn-kpis-primary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
#mntControlLayout .mn-kpi-primary{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px;box-shadow:var(--sh);position:relative}
#mntControlLayout .mn-kpi-primary:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--ok)}
#mntControlLayout .mn-kpi-primary.warn:after{background:var(--warn)}#mntControlLayout .mn-kpi-primary.bad:after{background:var(--err)}
#mntControlLayout .mn-kpi-primary .l{font-size:10.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#mntControlLayout .mn-kpi-primary .v{font-size:25px;font-weight:850;margin-top:5px;color:var(--ink)}
#mntControlLayout .mn-kpi-primary .delta{font-size:10.5px;font-weight:700;margin-top:5px}
#mntControlLayout .mn-kpi-primary .delta.up{color:var(--ok)}#mntControlLayout .mn-kpi-primary .delta.down{color:var(--err)}
#mntControlLayout .mn-kpi-primary .target{font-size:9.5px;color:var(--muted);margin-top:3px}
#mntControlLayout .mn-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
#mntControlLayout .mn-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:var(--sh);position:relative}
#mntControlLayout .mn-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--ok)}
#mntControlLayout .mn-kpi.warn:after{background:var(--warn)}#mntControlLayout .mn-kpi.bad:after{background:var(--err)}
#mntControlLayout .mn-kpi .l{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#mntControlLayout .mn-kpi .v{font-size:22px;font-weight:850;margin-top:4px;color:var(--ink)}
#mntControlLayout .mn-kpi.warn .v{color:#B8720A}#mntControlLayout .mn-kpi.bad .v{color:var(--err)}
#mntControlLayout .mn-kpi .s{font-size:9.5px;color:var(--muted);margin-top:4px}
#mntControlLayout .mn-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--sh)}
#mntControlLayout .mn-panel h3{font-size:13px;margin:0 0 3px;font-weight:850}
#mntControlLayout .mn-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
#mntControlLayout .mn-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}
#mntControlLayout .mn-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#mntControlLayout .mn-grid>.half{grid-column:span 6}#mntControlLayout .mn-grid>.full{grid-column:1/-1}
#mntControlLayout .mn-insight{border-left:3px solid var(--ok);padding:10px 13px;font-size:12px;color:var(--ink)}
#mntControlLayout .mn-status-row{display:flex;flex-direction:column;gap:8px}
#mntControlLayout .mn-status-item{display:grid;grid-template-columns:96px 1fr 30px;align-items:center;gap:9px;font-size:11px}
#mntControlLayout .mn-status-item .lab{display:flex;align-items:center;gap:6px;font-weight:700}
#mntControlLayout .mn-status-item i{width:8px;height:8px;border-radius:50%;display:inline-block}
#mntControlLayout .mn-track{height:7px;border-radius:6px;background:#eef1f4;overflow:hidden}
#mntControlLayout .mn-track span{display:block;height:100%;border-radius:6px}
#mntControlLayout .mn-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}
#mntControlLayout .mn-list:last-child{border-bottom:none}
#mntControlLayout .mn-empty{padding:24px 8px;text-align:center;color:var(--muted);font-size:11px}
#mntControlLayout .mn-trend-scroll{overflow-x:auto}
/* ปุ่มสลับมุมมอง (Year/Month ของ Project Control ใช้ class คนละชื่อ — ทำแยกของตัวเองให้ชัดเจนว่าเป็นของ
   Maintenance โดยเฉพาะ) ใช้กับ "Downtime แยกตามกลุ่มอุปกรณ์/เครื่องจักร" */
#mntControlLayout .mn-toggle{display:flex;gap:6px}
#mntControlLayout .mn-toggle button{border:1px solid var(--line);background:var(--card);color:var(--muted);font-family:var(--ui-font);font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:7px;cursor:pointer}
#mntControlLayout .mn-toggle button.active{background:var(--brand-sf);color:var(--brand-dk);border-color:var(--brand)}
/* ตาราง "อุปกรณ์ที่ต้องเฝ้าระวัง" — เรียงตาม Downtime สะสม พร้อม pill สถานะ */
#mntControlLayout .mn-watch-head{display:grid;grid-template-columns:1fr 110px 90px 100px;gap:10px;padding:0 2px 6px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);border-bottom:1px solid var(--line)}
#mntControlLayout .mn-watch-row{display:grid;grid-template-columns:1fr 110px 90px 100px;gap:10px;align-items:center;padding:9px 2px;border-bottom:1px solid var(--line);font-size:11.5px}
#mntControlLayout .mn-watch-row:last-child{border-bottom:none}
#mntControlLayout .mn-watch-row b{font-weight:700;color:var(--ink)}
#mntControlLayout .mn-watch-row span.muted{color:var(--muted);font-size:10.5px}
#mntControlLayout .mn-watch-row .num{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums;text-align:right}
#mntControlLayout .mn-pill{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
#mntControlLayout .mn-pill:before{content:'';width:6px;height:6px;border-radius:50%;display:inline-block}
#mntControlLayout .mn-pill.watch{color:#B8720A;background:color-mix(in srgb, var(--warn) 20%, transparent)}#mntControlLayout .mn-pill.watch:before{background:var(--warn)}
#mntControlLayout .mn-pill.ok{color:var(--ok);background:color-mix(in srgb, var(--ok) 15%, transparent)}#mntControlLayout .mn-pill.ok:before{background:var(--ok)}
#mntControlLayout .mn-pill.parts{color:var(--err);background:color-mix(in srgb, var(--err) 15%, transparent)}#mntControlLayout .mn-pill.parts:before{background:var(--err)}
/* กราฟเส้นหลายสี "PM Compliance รายเดือน แยกตามสาย" */
#mntControlLayout .mn-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:9.5px;color:var(--muted);padding:6px 2px 0}
#mntControlLayout .mn-legend span{display:inline-flex;align-items:center;gap:5px}
#mntControlLayout .mn-legend i{width:14px;height:3px;border-radius:3px;display:inline-block}
#mntControlLayout.mnt-override-hidden{display:none!important}
.mnt-hidden-source{display:none!important}
@media(max-width:1100px){#mntControlLayout .mn-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#mntControlLayout .mn-kpis-primary{grid-template-columns:repeat(2,minmax(0,1fr))}#mntControlLayout .mn-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#mntControlLayout .mn-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#mntControlLayout .mn-kpis-primary{grid-template-columns:repeat(2,minmax(0,1fr))}#mntControlLayout .mn-watch-head,#mntControlLayout .mn-watch-row{grid-template-columns:1fr 80px 70px}#mntControlLayout .mn-watch-head span:nth-child(2),#mntControlLayout .mn-watch-row span:nth-child(2){display:none}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#mntControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='mntControlLayout';
    /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control): ไม่เคยติด data-dashboard-section ทำให้ setPage()
       มองไม่เห็นการ์ดนี้ เลยแสดงค้างอยู่ทุกแท็บ (Overview/Projects/Analytics/Details) ทั้งที่ตั้งใจให้อยู่
       แค่แท็บ Projects เท่านั้น (จุดยึด #domainDashboardCard เดียวกับ Project Control) */
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    /* โครงสร้างใหม่ทั้งหมด (ตามที่ผู้ใช้ขอ "ทำไปให้สุด" เทียบกับ template "Maintenance & Asset Operations"):
       เพิ่มแถบ badge หัวการ์ด, แถว KPI หลัก 4 ตัว (PM Compliance/PSD Availability/Backlog/MTTR) แยกจาก
       แถว KPI รอง 6 ตัวเดิม (ของเดิมยังอยู่ครบ ไม่ตัดอะไรทิ้ง), เพิ่มกราฟ PM vs CM รายเดือน, กราฟ PM
       Compliance แยกตามสาย (ซ่อนอัตโนมัติถ้าไม่มีคอลัมน์ "สาย"), และเปลี่ยนรายการ "งานเลยกำหนด" เป็น
       ตารางเฝ้าระวังเรียงตาม Downtime สะสมพร้อมสถานะ */
    layout.innerHTML=
      '<section class="mn-hero"><div class="mn-hero-top"><div><h2>🔧 Maintenance Control</h2><div class="mn-sub" id="mnUpdated">ภาพรวมงานซ่อมบำรุง PM/CM, Downtime และต้นทุนตามเครื่องจักร</div></div><div class="mn-badges" id="mnBadges"></div></div></section>'+
      '<div class="mn-kpis-primary" id="mnKpisPrimary"></div>'+
      '<div class="mn-kpis" id="mnKpis"></div>'+
      '<section class="mn-panel"><h3>Executive Insight</h3><div id="mnInsight" class="mn-insight"></div></section>'+
      '<div class="mn-grid">'+
        '<section class="mn-panel full"><h3>Downtime รายเดือน</h3><div class="mn-note">ชั่วโมงหยุดทำงานรวมต่อเดือน</div><div id="mnTrend"></div></section>'+
        '<section class="mn-panel full" id="mnPmByLinePanel"><h3>PM Compliance รายเดือน แยกตามสาย</h3><div class="mn-note">% งานตามแผนที่เสร็จตรงเวลา แยกตามสาย/โครงการ</div><div id="mnPmByLine"></div></section>'+
        '<section class="mn-panel half"><h3>Work Order รายเดือน: PM vs CM</h3><div class="mn-note">จำนวนใบงานต่อเดือน</div><div id="mnPmCm"></div></section>'+
        '<section class="mn-panel half"><h3>สถานะงานซ่อมบำรุง</h3><div class="mn-note">PM Compliance / งานเลยกำหนด</div><div id="mnStatus"></div></section>'+
        '<section class="mn-panel full"><div class="mn-panel-head"><h3>Downtime แยกตามกลุ่มอุปกรณ์</h3><div class="mn-toggle" id="mnByEquipToggle"></div></div><div class="mn-note" id="mnByEquipNote">Top 8 อันดับ Downtime สูงสุด</div><div id="mnByEquip"></div></section>'+
        '<section class="mn-panel full"><h3>🔍 อุปกรณ์ที่ต้องเฝ้าระวัง</h3><div class="mn-note">เรียงตาม Downtime สะสมสูงสุด</div><div id="mnWatchlist"></div></section>'+
      '</div>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">ตรวจพบจากคอลัมน์ รหัสเครื่องจักร + Downtime/วันที่ปฏิบัติงาน ในไฟล์ที่อัปโหลด — Table ด้านล่างไม่ถูกแก้ไข</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('mnt-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function renderTrend(rows){
    var host=q('#mnTrend'); if(!host)return;
    var byMonth={};
    rows.forEach(function(r){
      if(r.downtime==null)return;
      var k=monthKey(r.anchorDate);
      byMonth[k]=(byMonth[k]||0)+r.downtime;
    });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="mn-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)</div>';return;}
    /* บั๊กที่เจอ (จุดเดิมกับ Progress Trend ของ Project Control): เดิมบีบกราฟให้กว้างคงที่ 900 แล้ว scale
       ลงด้วย width:100% เสมอ ยิ่งมีหลายเดือนยิ่งบีบจนแท่ง/ป้ายเดือนเล็กจนอ่านไม่ออก เปลี่ยนเป็นความกว้าง
       คงที่ต่อแท่ง (ไม่บีบ) ห่อด้วย scroll แนวนอนแทน — เดือนน้อยพอดีกล่องไม่ต้องเลื่อน เดือนเยอะเลื่อนดูได้
       ป้ายเดือนเลยโชว์ครบทุกแท่งได้ (เดิมต้องข้ามบางป้ายเพราะที่ไม่พอ) */
    var perBar=64,left=44,right=14,top=14,bottom=26,ph=180;
    var w=Math.max(400,left+right+keys.length*perBar), h=top+ph+bottom, pw=w-left-right;
    var maxV=Math.max.apply(null,keys.map(function(k){return byMonth[k];}))||1;
    maxV=Math.ceil(maxV*1.15);
    var bw=Math.min(40,perBar*0.6), step=pw/keys.length;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+Math.round(val)+'</text>';
    }
    keys.forEach(function(k,i){
      var v=byMonth[k], x=left+step*i+(step-bw)/2, bh=ph*v/maxV, y=top+ph-bh;
      out+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="3" fill="#F59E0B"/>';
      out+='<text x="'+(x+bw/2)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="#8a97a3">'+k+'</text>';
    });
    out+='</svg>';
    host.innerHTML='<div class="mn-trend-scroll">'+out+'</div>';
  }

  /* ตามที่ผู้ใช้ขอ (เทียบ template): ของเดิมแยกตาม "รหัสเครื่องจักร" รายตัวเท่านั้น แต่ template อ้างอิง
     แยกตาม "กลุ่มอุปกรณ์" (ประเภท) รวมทุกตัวในกลุ่มเดียวกันเข้าด้วยกัน — เพิ่มเป็นตัวเลือกสลับได้ 2 มุมมอง
     แทนที่จะแทนที่ของเดิม (ค่าเริ่มต้น = "กลุ่ม" ให้ตรงกับ template ก่อน สลับเป็นรายเครื่องได้) */
  var EQUIP_GROUP='type';
  function renderByEquip(rows){
    var host=q('#mnByEquip'); if(!host)return;
    var byType=rows.some(function(r){return r.equipmenttype;});
    var mode=(EQUIP_GROUP==='type'&&byType)?'type':'unit';
    var map={};
    rows.forEach(function(r){
      if(r.downtime==null)return;
      var key=mode==='type'?(r.equipmenttype||'(ไม่ระบุประเภท)'):r.equipmentno;
      map[key]=(map[key]||0)+r.downtime;
    });
    var noteEl=q('#mnByEquipNote');
    if(noteEl)noteEl.textContent=mode==='type'?'Top 8 อันดับ Downtime สูงสุด (รวมตามประเภทเครื่องจักร)':'Top 8 อันดับ Downtime สูงสุด (รายเครื่องจักร)';
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    if(!entries.length){host.innerHTML='<div class="mn-empty">ไม่มีข้อมูล Downtime</div>';return;}
    var w=900,rowH=28,h=14+entries.length*rowH,left=210,right=50,barW=w-left-right;
    var maxV=Math.max.apply(null,entries.map(function(e){return e[1];}))||1;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';
    entries.forEach(function(e,i){
      var y=10+i*rowH, bw=Math.max(2,barW*e[1]/maxV);
      out+='<text x="'+(left-10)+'" y="'+(y+14)+'" text-anchor="end" font-size="11.5" fill="#374151"><title>'+esc(e[0])+'</title>'+esc(e[0].length>24?e[0].slice(0,23)+'…':e[0])+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="17" rx="4" fill="#EEF1F4"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="17" rx="4" fill="#DC2626"/>';
      out+='<text x="'+(left+bw+8)+'" y="'+(y+14)+'" font-size="11.5" font-weight="700" fill="#172033">'+e[1].toFixed(1)+'</text>';
    });
    out+='</svg>';
    host.innerHTML=out;
  }
  function wireByEquipToggle(rows){
    var host=q('#mnByEquipToggle'); if(!host)return;
    var hasType=rows.some(function(r){return r.equipmenttype;});
    if(!hasType){host.innerHTML='';return;}
    host.innerHTML='<button type="button" data-eq-group="type">กลุ่มอุปกรณ์</button><button type="button" data-eq-group="unit">รายเครื่อง</button>';
    qa('[data-eq-group]',host).forEach(function(b){
      b.classList.toggle('active',b.getAttribute('data-eq-group')===EQUIP_GROUP);
      b.onclick=function(){EQUIP_GROUP=b.getAttribute('data-eq-group');wireByEquipToggle(rows);renderByEquip(rows);};
    });
  }

  function renderStatus(rows){
    var host=q('#mnStatus'); if(!host)return;
    var pmRows=rows.filter(function(r){return classifyWO(r.workordertype,r.failuremode,r.status)!=='cm';});
    var pmDone=pmRows.filter(function(r){return r.actend && (!r.planfinish || r.actend<=r.planfinish);}).length;
    var pmCompliance=pmRows.length?(pmDone/pmRows.length*100):null;
    var late=rows.filter(function(r){return woStatus(r.status)==='late'||(r.planfinish&&r.actend&&r.actend>r.planfinish);}).length;
    var cmCount=rows.filter(function(r){return classifyWO(r.workordertype,r.failuremode,r.status)==='cm';}).length;
    var total=Math.max(1,rows.length);
    var vals=[
      ['pm','PM Compliance',pmCompliance!=null?pmCompliance.toFixed(0)+'%':'—',pmCompliance!=null?pmCompliance:0,'#16A34A'],
      ['cm','งาน CM (ฉุกเฉิน)',cmCount,cmCount/total*100,'#F59E0B'],
      ['late','เลยกำหนด',late,late/total*100,'#DC2626']
    ];
    var out='<div class="mn-status-row">';
    vals.forEach(function(v){
      out+='<div class="mn-status-item"><span class="lab"><i style="background:'+v[4]+'"></i>'+v[1]+'</span><div class="mn-track"><span style="width:'+Math.min(100,v[3])+'%;background:'+v[4]+'"></span></div><b>'+v[2]+'</b></div>';
    });
    out+='</div>';
    host.innerHTML=out;
    return {pmCompliance:pmCompliance, late:late, cmCount:cmCount};
  }

  function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}

  /* ---------- ฟีเจอร์ใหม่ตามที่ผู้ใช้ขอ "ทำไปให้สุด" เทียบกับ template "Maintenance & Asset Operations" ---------- */

  /* a) MTTR เฉลี่ย (Mean Time To Repair) — นิยามมาตรฐานคือ "Downtime เฉลี่ยต่องานซ่อม" ใช้คอลัมน์ Downtime
     ที่มีอยู่แล้วโดยตรง (ไม่ใช้ actend-actstart ลบกัน เพราะไฟล์งานซ่อมบำรุงทั่วไปมักบันทึกแค่ระดับวัน
     ไม่มีเวลา ทำให้ลบกันได้ค่าเป็นจำนวนเท่าของ 24 ชม. เสมอ ไม่สมจริง) นับเฉพาะงาน CM (ซ่อมเมื่อเสีย) ตาม
     นิยาม MTTR มาตรฐาน ไม่รวมงาน PM (บำรุงรักษาเชิงป้องกัน) เทียบเดือนล่าสุดกับเดือนก่อนหน้าเพื่อโชว์ delta */
  function computeMTTR(rows){
    var byMonth={};
    rows.forEach(function(r){
      if(r.downtime==null)return;
      if(classifyWO(r.workordertype,r.failuremode,r.status)!=='cm')return;
      var k=monthKey(r.anchorDate);
      (byMonth[k]||(byMonth[k]=[])).push(r.downtime);
    });
    var keys=Object.keys(byMonth).sort();
    if(!keys.length)return {value:null,delta:null};
    var avg=function(arr){return arr.reduce(function(s,n){return s+n;},0)/arr.length;};
    var cur=avg(byMonth[keys[keys.length-1]]);
    var prev=keys.length>1?avg(byMonth[keys[keys.length-2]]):null;
    return {value:cur, delta:prev!=null?cur-prev:null};
  }

  /* b) Work Order ค้างดำเนินการ (Backlog) — จำนวนงานที่ "เปิดอยู่" ณ เวลาใดเวลาหนึ่ง (actstart ผ่านมาแล้ว
     แต่ actend ยังไม่มี/ยังไม่ถึง) คำนวณย้อนหลังได้จริงจาก actstart/actend ที่มี ไม่ใช่แค่ snapshot ปัจจุบัน
     เทียบกับ 7 วันก่อนหน้าเพื่อโชว์ delta แบบ "จากสัปดาห์ก่อน" ตาม template */
  function backlogAsOf(rows, asOf){
    return rows.filter(function(r){
      if(!r.actstart||r.actstart>asOf)return false;
      return !r.actend||r.actend>asOf;
    }).length;
  }
  function computeBacklog(rows){
    var maxDate=rows.reduce(function(m,r){return (!m||r.anchorDate>m)?r.anchorDate:m;},null);
    if(!maxDate)return {value:0,delta:0};
    var weekAgo=new Date(maxDate.getTime()-7*86400000);
    return {value:backlogAsOf(rows,maxDate), delta:backlogAsOf(rows,maxDate)-backlogAsOf(rows,weekAgo)};
  }

  /* PSD Availability (หรือ Availability ทั่วไปถ้าไม่มีเครื่องจักรกลุ่ม PSD ในข้อมูล) — คำนวณจาก Downtime
     สะสมของกลุ่มเทียบกับเวลารวมที่ควรพร้อมใช้งานทั้งหมดในเดือนล่าสุด (จำนวนเครื่องจักร × ชั่วโมงในเดือน)
     ไม่ต้องพึ่งคอลัมน์ Availability% ที่ไฟล์งานซ่อมบำรุงทั่วไปมักไม่มีอยู่แล้ว */
  function computeAvailability(rows){
    var psdRows=rows.filter(function(r){return isPsdEquip(r.equipmenttype);});
    var isPsd=psdRows.length>0;
    var pool=isPsd?psdRows:rows;
    var monthOf=function(list){
      var m={}; list.forEach(function(r){var k=monthKey(r.anchorDate);(m[k]||(m[k]=[])).push(r);}); return m;
    };
    var byMonth=monthOf(pool), keys=Object.keys(byMonth).sort();
    if(!keys.length)return {value:null,delta:null,label:isPsd?'PSD Availability':'Availability'};
    var equipAll={}; pool.forEach(function(r){equipAll[r.equipmentno]=true;});
    var nEquip=Math.max(1,Object.keys(equipAll).length);
    function availFor(k){
      var yy=+k.slice(0,4),mm=+k.slice(5,7)-1;
      var totalHrs=nEquip*daysInMonth(yy,mm)*24;
      var down=(byMonth[k]||[]).reduce(function(s,r){return s+(r.downtime||0);},0);
      return Math.max(0,Math.min(100,(1-down/totalHrs)*100));
    }
    var cur=availFor(keys[keys.length-1]);
    var prev=keys.length>1?availFor(keys[keys.length-2]):null;
    return {value:cur, delta:prev!=null?cur-prev:null, label:isPsd?'PSD Availability':'Availability'};
  }

  /* PM Compliance รายเดือนรวมทุกกลุ่ม (ไม่แยกตามสาย) เทียบเดือนล่าสุดกับเดือนก่อนหน้า สำหรับ KPI หลัก —
     ต่างจาก renderStatus() ที่คำนวณ compliance % รวมทั้งชุดข้อมูลเป็นค่าเดียว ตัวนี้แยกรายเดือนเพื่อโชว์
     delta "vs เดือนก่อน" ตาม template */
  function computePmComplianceTrend(rows){
    var byMonth={};
    rows.forEach(function(r){
      if(classifyWO(r.workordertype,r.failuremode,r.status)==='cm')return;
      var k=monthKey(r.anchorDate);
      var g=byMonth[k]||(byMonth[k]={done:0,total:0});
      g.total++;
      if(r.actend && (!r.planfinish||r.actend<=r.planfinish))g.done++;
    });
    var keys=Object.keys(byMonth).sort();
    if(!keys.length)return {value:null,delta:null};
    var pctOf=function(k){var g=byMonth[k];return g.total?g.done/g.total*100:null;};
    var cur=pctOf(keys[keys.length-1]);
    var prev=keys.length>1?pctOf(keys[keys.length-2]):null;
    return {value:cur, delta:(cur!=null&&prev!=null)?cur-prev:null};
  }

  function fmtDelta(v, digits, unit, goodWhenUp){
    if(v==null)return '';
    var up=v>=0;
    var good=goodWhenUp?up:!up;
    var arrow=up?'▲':'▼';
    return '<div class="delta '+(good?'up':'down')+'">'+arrow+' '+Math.abs(v).toFixed(digits)+(unit||'')+'</div>';
  }

  function renderBadges(rows){
    var host=q('#mnBadges'); if(!host)return;
    var min=null,max=null;
    rows.forEach(function(r){ if(!min||r.anchorDate<min)min=r.anchorDate; if(!max||r.anchorDate>max)max=r.anchorDate; });
    var now=new Date();
    var hh=String(now.getHours()).padStart(2,'0'), mm=String(now.getMinutes()).padStart(2,'0');
    host.innerHTML=
      '<span class="mn-badge">รอบข้อมูล '+(min?fmt(min):'—')+' – '+(max?fmt(max):'—')+'</span>'+
      '<span class="mn-badge">อัปเดตล่าสุด '+fmt(now)+', '+hh+':'+mm+'</span>';
  }

  /* KPI หลัก 4 ตัวตาม template (แยกจากแถว KPI รอง 6 ตัวเดิมที่ยังอยู่ครบ) */
  function renderPrimaryKpis(rows, pmc, avail, backlog, mttr){
    var host=q('#mnKpisPrimary'); if(!host)return;
    var pmWarn=pmc.value!=null&&pmc.value<95;
    var availWarn=avail.value!=null&&avail.value<99.7;
    var backlogWarn=backlog.value>0;
    var mttrWarn=mttr.value!=null&&mttr.value>4;
    host.innerHTML=
      '<div class="mn-kpi-primary'+(pmWarn?' warn':'')+'"><div class="l">PM Compliance (รวมทุกกลุ่ม)</div><div class="v">'+(pmc.value!=null?pmc.value.toFixed(1)+'%':'—')+'</div>'+
        fmtDelta(pmc.delta,1,'pt vs เดือนก่อน',true)+'<div class="target">เป้าหมาย ≥ 95%</div></div>'+
      '<div class="mn-kpi-primary'+(availWarn?' warn':'')+'"><div class="l">'+avail.label+'</div><div class="v">'+(avail.value!=null?avail.value.toFixed(2)+'%':'—')+'</div>'+
        fmtDelta(avail.delta,2,'pt',true)+'<div class="target">เป้าหมาย ≥ 99.7%</div></div>'+
      '<div class="mn-kpi-primary'+(backlogWarn?' warn':'')+'"><div class="l">Work Order ค้างดำเนินการ</div><div class="v">'+backlog.value+' <span style="font-size:11px;font-weight:700;color:var(--muted)">รายการ</span></div>'+
        fmtDelta(backlog.delta,0,' จากสัปดาห์ก่อน',false)+'<div class="target">SLA ปิดงานภายใน 72 ชม.</div></div>'+
      '<div class="mn-kpi-primary'+(mttrWarn?' warn':'')+'"><div class="l">MTTR เฉลี่ย</div><div class="v">'+(mttr.value!=null?mttr.value.toFixed(1)+' ชม.':'—')+'</div>'+
        fmtDelta(mttr.delta,1,'ชม.',false)+'<div class="target">เป้าหมาย ≤ 4 ชม.</div></div>';
  }

  /* c) Work Order รายเดือน: PM vs CM — กราฟแท่งซ้อนรายเดือน (ใช้แพทเทิร์นความกว้างคงที่ต่อแท่ง + scroll
     แนวนอนเดียวกับ Downtime รายเดือน กันแท่ง/ป้ายเดือนเล็กจนอ่านไม่ออกเมื่อมีหลายเดือน) */
  function renderPmCm(rows){
    var host=q('#mnPmCm'); if(!host)return;
    var byMonth={};
    rows.forEach(function(r){
      var k=monthKey(r.anchorDate);
      var cls=classifyWO(r.workordertype,r.failuremode,r.status);
      var g=byMonth[k]||(byMonth[k]={pm:0,cm:0});
      if(cls==='cm')g.cm++; else g.pm++;
    });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="mn-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)</div>';return;}
    var perBar=56,left=40,right=14,top=14,bottom=26,ph=170;
    var w=Math.max(360,left+right+keys.length*perBar), h=top+ph+bottom, pw=w-left-right;
    var maxV=Math.max.apply(null,keys.map(function(k){return byMonth[k].pm+byMonth[k].cm;}))||1;
    maxV=Math.ceil(maxV*1.15);
    var bw=Math.min(34,perBar*0.6), step=pw/keys.length;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+Math.round(val)+'</text>';
    }
    keys.forEach(function(k,i){
      var g=byMonth[k], x=left+step*i+(step-bw)/2;
      var pmH=ph*g.pm/maxV, cmH=ph*g.cm/maxV;
      out+='<rect x="'+x+'" y="'+(top+ph-pmH)+'" width="'+bw+'" height="'+pmH+'" fill="#4285F4"/>';
      out+='<rect x="'+x+'" y="'+(top+ph-pmH-cmH)+'" width="'+bw+'" height="'+cmH+'" fill="#EA4285"/>';
      out+='<text x="'+(x+bw/2)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="#8a97a3">'+k+'</text>';
    });
    out+='</svg><div class="mn-legend"><span><i style="background:#4285F4"></i>PM (แผน)</span><span><i style="background:#EA4285"></i>CM (เหตุขัดข้อง)</span></div>';
    host.innerHTML='<div class="mn-trend-scroll">'+out+'</div>';
  }

  /* g) PM Compliance รายเดือน แยกตามสาย — ต้องมีคอลัมน์ "สาย/โครงการ" ในไฟล์ที่อัปโหลด ถ้าไม่มีให้ซ่อน
     แผงนี้ทั้งหมด (ไม่ใช่โชว์ว่างเปล่า) เพราะข้อมูลไม่มีมิตินี้จริงๆ */
  var PMLINE_COLORS=['#F4B400','#34A853','#EA4285','#4285F4','#9C27B0','#00BCD4'];
  function renderPmByLine(rows){
    var panel=q('#mnPmByLinePanel'), host=q('#mnPmByLine');
    var lines=[]; rows.forEach(function(r){ if(r.line&&lines.indexOf(r.line)<0)lines.push(r.line); });
    if(!lines.length){ if(panel)panel.style.display='none'; return; }
    if(panel)panel.style.display='';
    if(!host)return;
    var byLineMonth={};
    rows.forEach(function(r){
      if(!r.line)return;
      var k=monthKey(r.anchorDate);
      var cell=byLineMonth[r.line]||(byLineMonth[r.line]={});
      var g=cell[k]||(cell[k]={done:0,total:0});
      if(classifyWO(r.workordertype,r.failuremode,r.status)==='cm')return; // นับเฉพาะงาน PM ตามที่ template ระบุ "PM Compliance"
      g.total++;
      if(r.actend && (!r.planfinish||r.actend<=r.planfinish))g.done++;
    });
    var months=[]; rows.forEach(function(r){var k=monthKey(r.anchorDate); if(months.indexOf(k)<0)months.push(k);}); months.sort();
    if(months.length<2){host.innerHTML='<div class="mn-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)</div>';return;}
    var perM=64,left=44,right=18,top=14,bottom=26,ph=170;
    var w=Math.max(400,left+right+months.length*perM), h=top+ph+bottom, pw=w-left-right, step=pw/(months.length-1||1);
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=100*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+val+'%</text>';
    }
    months.forEach(function(k,i){
      out+='<text x="'+(left+step*i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="9.5" fill="#8a97a3">'+k+'</text>';
    });
    var legend='<div class="mn-legend">';
    lines.forEach(function(line,li){
      var color=PMLINE_COLORS[li%PMLINE_COLORS.length];
      var pts=months.map(function(k,i){
        var cell=(byLineMonth[line]||{})[k];
        var pct=cell&&cell.total?(cell.done/cell.total*100):null;
        return pct==null?null:[left+step*i, top+ph-ph*pct/100];
      }).filter(function(p){return p;});
      if(pts.length>=2){
        out+='<polyline points="'+pts.map(function(p){return p[0]+','+p[1];}).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2.2"/>';
        pts.forEach(function(p){out+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3" fill="'+color+'"/>';});
      }
      legend+='<span><i style="background:'+color+'"></i>'+esc(line)+'</span>';
    });
    legend+='</div>';
    out+='</svg>';
    host.innerHTML='<div class="mn-trend-scroll">'+out+'</div>'+legend;
  }

  /* e) ตารางเฝ้าระวัง — เรียงตาม Downtime สะสมสูงสุด (แทนที่รายการ "งานเลยกำหนด" เดิมที่เรียงตามวันที่
     อย่างเดียว) พร้อมจัดสถานะเป็น pill: "รอชิ้นส่วน" > "เฝ้าระวัง" (มีงานเปิดค้าง/เลยกำหนด) > "ปกติ" */
  function renderWatchlist(rows){
    var host=q('#mnWatchlist'); if(!host)return;
    var map={};
    rows.forEach(function(r){
      var g=map[r.equipmentno]||(map[r.equipmentno]={downtime:0,line:'',openLate:false,awaitParts:false});
      g.downtime+=(r.downtime||0);
      if(r.line&&!g.line)g.line=r.line;
      var openUnfinished=!r.actend;
      var overdue=woStatus(r.status)==='late'||(r.planfinish&&r.actend&&r.actend>r.planfinish)||(openUnfinished&&r.planfinish&&r.planfinish<new Date());
      if(overdue)g.openLate=true;
      if(openUnfinished&&isAwaitingParts(r))g.awaitParts=true;
    });
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).filter(function(e){return e[1].downtime>0;})
      .sort(function(a,b){return b[1].downtime-a[1].downtime;}).slice(0,10);
    if(!entries.length){host.innerHTML='<div class="mn-empty">ไม่มีข้อมูล Downtime</div>';return;}
    var showLine=entries.some(function(e){return e[1].line;});
    var head='<div class="mn-watch-head"><span>อุปกรณ์</span><span>'+(showLine?'สาย/โครงการ':'')+'</span><span>Downtime (ชม.)</span><span>สถานะ</span></div>';
    var body=entries.map(function(e){
      var g=e[1];
      var pill=g.awaitParts?['parts','รอชิ้นส่วน']:g.openLate?['watch','เฝ้าระวัง']:['ok','ปกติ'];
      return '<div class="mn-watch-row"><b>'+esc(e[0])+'</b><span class="muted">'+(g.line?esc(g.line):'—')+'</span><span class="num">'+g.downtime.toFixed(1)+'</span><span><span class="mn-pill '+pill[0]+'">'+pill[1]+'</span></span></div>';
    }).join('');
    host.innerHTML=head+body;
  }

  /* บั๊กที่เจอ (รายงานจากผู้ใช้): เลือก Template = "Maintenance" ในดรอปดาวน์แล้วยังเห็นการ์ด Project
     Control ค้างอยู่ เพราะโมดูลนี้ไม่เคยเช็ค state.domainOverride เลย เมื่อผู้ใช้ล็อกเป็นโดเมนอื่นให้ซ่อน
     ตัวเองด้วยคลาสเฉพาะ (ไม่ใช่ .remove() ทั้ง element เพราะจะไปกระทบ DOM ลูกถ้ามีการย้ายโหนดจริงเข้ามา
     ในอนาคตแบบเดียวกับ Project Control) และคืนคลาส .mnt-hidden-source ที่เคยไปแปะไว้กับการ์ดต้นฉบับ
     เพื่อให้โมดูลอื่นที่ถูกเลือกจริงตัดสินใจการมองเห็นของการ์ดพวกนั้นเอง */
  function suppressLayout(){
    var layout=q('#mntControlLayout');
    if(layout) layout.classList.add('mnt-override-hidden');
    qa('.mnt-hidden-source').forEach(function(e){ e.classList.remove('mnt-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้ */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='maintenance'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'mntControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="mn-panel"><h3>🔧 Maintenance Control</h3>'+
      '<div class="mn-empty">ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่ายงานซ่อมบำรุง (ต้องมีคอลัมน์รหัสเครื่องจักร '+
      'และอย่างน้อยหนึ่งใน Downtime/วันที่เริ่ม-เสร็จปฏิบัติงาน) — ลองเลือก Template เป็น "Auto" '+
      'หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('mnt-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='maintenance'){ suppressLayout(); return; }
    var mcl=q('#mntControlLayout'); if(mcl) mcl.classList.remove('mnt-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='mntControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='mntControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows, today=new Date(); today.setHours(0,0,0,0);
    var totalDowntime=rows.reduce(function(s,r){return s+(r.downtime||0);},0);
    var totalCost=rows.reduce(function(s,r){return s+r.matcost+r.laborcost;},0);
    var equipSet={}; rows.forEach(function(r){equipSet[r.equipmentno]=true;});
    var cmCount=rows.filter(function(r){return classifyWO(r.workordertype,r.failuremode,r.status)==='cm';}).length;
    var lateCount=rows.filter(function(r){return woStatus(r.status)==='late'||(r.planfinish&&r.actend&&r.actend>r.planfinish);}).length;

    var st=renderStatus(rows);

    q('#mnKpis').innerHTML=
      '<div class="mn-kpi"><div class="l">Work Orders</div><div class="v">'+rows.length+'</div><div class="s">รายการทั้งหมด</div></div>'+
      '<div class="mn-kpi"><div class="l">Equipment</div><div class="v">'+Object.keys(equipSet).length+'</div><div class="s">เครื่องจักรที่มีบันทึก</div></div>'+
      '<div class="mn-kpi"><div class="l">Downtime รวม</div><div class="v">'+totalDowntime.toLocaleString(undefined,{maximumFractionDigits:1})+'</div><div class="s">ชั่วโมง</div></div>'+
      '<div class="mn-kpi'+(st.pmCompliance!=null&&st.pmCompliance<80?' warn':'')+'"><div class="l">PM Compliance</div><div class="v">'+(st.pmCompliance!=null?st.pmCompliance.toFixed(0)+'%':'—')+'</div><div class="s">งานตามแผนที่เสร็จตรงเวลา</div></div>'+
      '<div class="mn-kpi'+(cmCount?' warn':'')+'"><div class="l">CM (ฉุกเฉิน)</div><div class="v">'+cmCount+'</div><div class="s">งานซ่อมฉุกเฉิน</div></div>'+
      '<div class="mn-kpi'+(lateCount?' bad':'')+'"><div class="l">เลยกำหนด</div><div class="v">'+lateCount+'</div><div class="s">ต้องติดตาม</div></div>';

    var statusText=lateCount?'มีงานเลยกำหนดต้องเร่งติดตาม':(st.pmCompliance!=null&&st.pmCompliance<80)?'PM Compliance ต่ำกว่าเป้าหมาย':'อยู่ในเกณฑ์ปกติ';
    q('#mnInsight').innerHTML='สถานะโดยรวม <b>'+statusText+'</b> — Work Order ทั้งหมด <b>'+rows.length+'</b> รายการ, Downtime รวม <b>'+totalDowntime.toLocaleString(undefined,{maximumFractionDigits:1})+' ชม.</b>'+(totalCost?', ต้นทุนรวม <b>'+totalCost.toLocaleString(undefined,{maximumFractionDigits:0})+'</b>':'')+'. '+(lateCount?'มี <b>'+lateCount+' งาน</b> เลยกำหนด ต้องเร่งติดตาม.':'ไม่มีงานที่เลยกำหนดในขณะนี้.');

    /* ฟีเจอร์ใหม่ตามที่ผู้ใช้ขอ "ทำไปให้สุด" เทียบ template "Maintenance & Asset Operations" */
    renderBadges(rows);
    var mttr=computeMTTR(rows), backlog=computeBacklog(rows), avail=computeAvailability(rows), pmc=computePmComplianceTrend(rows);
    renderPrimaryKpis(rows, pmc, avail, backlog, mttr);
    renderPmCm(rows);
    renderPmByLine(rows);

    renderTrend(rows);
    wireByEquipToggle(rows); renderByEquip(rows);
    renderWatchlist(rows);

    q('#mnUpdated').textContent='รอบข้อมูลถึง '+fmt(today)+' · '+rows.length.toLocaleString()+' รายการ';
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[Maintenance1]',e);}});
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
