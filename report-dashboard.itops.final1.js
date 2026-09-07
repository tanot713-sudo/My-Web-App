/* FINAL 1 — IT / DevOps Control (new domain, additive)
   Same architecture as the safety/HR modules alongside it.
*/
(function(){
  'use strict';
  var raf=0, scheduled=false, bootAttempts=0;
  function q(s,r){return (r||document).querySelector(s)}
  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function text(v){return String(v==null?'':v).trim()}
  function esc(v){var d=document.createElement('div');d.textContent=text(v);return d.innerHTML}
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
  /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control/Maintenance/Safety/HR): toLocaleDateString('en-GB',...)
     ย่อเดือนกันยายนเป็น "Sept" (4 ตัวอักษร) ต่างจากเดือนอื่นที่ย่อ 3 ตัว ทำให้คอลัมน์วันที่จัดแนวไม่ตรงกัน
     ใช้ตารางเดือนย่อ 3 ตัวอักษรคงที่เองแทน */
  var IT_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+IT_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }
  var OPEN_KW=['open','pending','in progress','ระหว่างดำเนินการ','ค้าง','รอ'];
  var CLOSED_KW=['closed','resolved','complete','done','ปิด','เสร็จ','แก้ไขแล้ว'];
  function ticketStatus(v){
    var n=text(v).toLowerCase();
    if(CLOSED_KW.some(function(k){return n.indexOf(k)>=0}))return 'closed';
    if(OPEN_KW.some(function(k){return n.indexOf(k)>=0}))return 'open';
    return n?'other':'unknown';
  }
  var CRIT_KW=['critical','urgent','p1','สูงมาก','ด่วนมาก'];
  var HIGH_KW=['high','p2','สูง'];
  var LOW_KW=['low','p4','ต่ำ'];
  function priorityBucket(v){
    var n=text(v).toLowerCase();
    if(CRIT_KW.some(function(k){return n.indexOf(k)>=0}))return 'critical';
    if(HIGH_KW.some(function(k){return n.indexOf(k)>=0}))return 'high';
    if(LOW_KW.some(function(k){return n.indexOf(k)>=0}))return 'low';
    return n?'medium':'unknown';
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
      ticketId: roleCol(st,['ticket id','ticket no','ticket','เลขที่ ticket']),
      system: roleCol(st,['system','service','application','ระบบ','แอปพลิเคชัน']),
      priority: roleCol(st,['priority','severity','ความสำคัญ','ระดับความรุนแรง']),
      status: roleCol(st,['status','สถานะ']),
      opened: roleCol(st,['opened date','open date','created date','date reported','วันที่แจ้ง','วันที่เปิด']),
      closed: roleCol(st,['closed date','resolved date','resolution date','วันที่ปิด','วันที่แก้ไข']),
      assignee: roleCol(st,['assignee','owner','ผู้รับผิดชอบ']),
      subject: roleCol(st,['subject','title','description','หัวข้อ','รายละเอียด'])
    };
    // Activation gate: needs opened-date + (system or priority) — a bare
    // status list isn't enough to claim as a ticket log.
    /* ตามที่ผู้ใช้ขอ (เพิ่มตัวเลือก "IT Ops" ใน Template dropdown): ถ้าผู้ใช้ล็อกมาตรงๆ ว่าเป็น IT Ops แต่
       คอลัมน์ในข้อมูลไม่เข้าเกณฑ์ ให้ส่ง noMatch กลับไปให้ render() แสดงข้อความแจ้งเหตุผลแทนความเงียบ
       (แพทเทิร์นเดียวกับ Maintenance/Safety/HR) */
    if(!c.opened || !(c.system||c.priority||c.ticketId)) return ov==='itops' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var rows=st.rows.map(function(r,i){
      return {
        raw:r,i:i,
        ticketId: c.ticketId?text(r[c.ticketId.key]):('#'+(i+1)),
        system: c.system?text(r[c.system.key])||'(ไม่ระบุ)':'(ไม่ระบุ)',
        priority: c.priority?text(r[c.priority.key]):'',
        status: c.status?text(r[c.status.key]):'',
        opened: date(c.opened?r[c.opened.key]:null),
        closed: date(c.closed?r[c.closed.key]:null),
        assignee: c.assignee?text(r[c.assignee.key]):'',
        subject: c.subject?text(r[c.subject.key]):''
      };
    }).filter(function(r){return r.opened;});
    if(rows.length<2) return ov==='itops' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c};
  }

  function injectCSS(){
    if(q('#it1-css'))return;
    var s=document.createElement('style');s.id='it1-css';s.textContent=`
#itControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px}
#itControlLayout .it-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--sh)}
#itControlLayout .it-hero h2{font-size:16px;margin:0}
#itControlLayout .it-hero .it-sub{font-size:12px;color:var(--muted);margin-top:3px}
#itControlLayout .it-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#itControlLayout .it-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:var(--sh);position:relative}
#itControlLayout .it-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--ok)}
#itControlLayout .it-kpi.warn:after{background:var(--warn)}#itControlLayout .it-kpi.bad:after{background:var(--err)}
#itControlLayout .it-kpi .l{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#itControlLayout .it-kpi .v{font-size:24px;font-weight:850;margin-top:4px;color:var(--ink)}
#itControlLayout .it-kpi.warn .v{color:#B8720A}#itControlLayout .it-kpi.bad .v{color:var(--err)}
#itControlLayout .it-kpi .s{font-size:9.5px;color:var(--muted);margin-top:4px}
#itControlLayout .it-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--sh)}
#itControlLayout .it-panel h3{font-size:13px;margin:0 0 3px;font-weight:850}
#itControlLayout .it-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}
#itControlLayout .it-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#itControlLayout .it-grid>.half{grid-column:span 6}#itControlLayout .it-grid>.full{grid-column:1/-1}
#itControlLayout .it-insight{border-left:3px solid var(--ok);padding:10px 13px;font-size:12px;color:var(--ink)}
#itControlLayout .it-status-row{display:flex;flex-direction:column;gap:8px}
#itControlLayout .it-status-item{display:grid;grid-template-columns:96px 1fr 30px;align-items:center;gap:9px;font-size:11px}
#itControlLayout .it-status-item .lab{display:flex;align-items:center;gap:6px;font-weight:700}
#itControlLayout .it-status-item i{width:8px;height:8px;border-radius:50%;display:inline-block}
#itControlLayout .it-track{height:7px;border-radius:6px;background:#eef1f4;overflow:hidden}
#itControlLayout .it-track span{display:block;height:100%;border-radius:6px}
#itControlLayout .it-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}
#itControlLayout .it-list:last-child{border-bottom:none}
#itControlLayout .it-list .age{font-weight:800;color:var(--err)}
#itControlLayout .it-empty{padding:24px 8px;text-align:center;color:var(--muted);font-size:11px}
#itControlLayout .it-trend-scroll{overflow-x:auto}
#itControlLayout.it-override-hidden{display:none!important}
.it-hidden-source{display:none!important}
@media(max-width:1100px){#itControlLayout .it-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#itControlLayout .it-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#itControlLayout .it-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#itControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='itControlLayout';
    /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control/Maintenance/Safety/HR): ไม่เคยติด
       data-dashboard-section ทำให้ setPage() มองไม่เห็นการ์ดนี้ เลยแสดงค้างอยู่ทุกแท็บ
       (Overview/Projects/Analytics/Details) ทั้งที่ตั้งใจให้อยู่แค่แท็บ Projects เท่านั้น */
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    layout.innerHTML=
      '<section class="it-hero"><h2>🖥 IT / DevOps Control</h2><div class="it-sub" id="itUpdated">ภาพรวม Ticket, เวลาแก้ไขปัญหา และความสำคัญของงาน</div></section>'+
      '<div class="it-kpis" id="itKpis"></div>'+
      '<section class="it-panel"><h3>Executive Insight</h3><div id="itInsight" class="it-insight"></div></section>'+
      '<div class="it-grid">'+
        '<section class="it-panel full"><h3>Ticket เปิด vs ปิดรายเดือน</h3><div class="it-note">Opened vs Closed</div><div id="itTrend"></div></section>'+
        '<section class="it-panel half"><h3>Ticket แยกตามระบบ</h3><div class="it-note">จำนวนต่อระบบ/บริการ</div><div id="itBySystem"></div></section>'+
        '<section class="it-panel half"><h3>สัดส่วนตาม Priority</h3><div class="it-note">Critical / High / Medium / Low</div><div id="itPriority"></div></section>'+
        '<section class="it-panel full"><h3>⚠ Ticket ค้างนานสุด</h3><div class="it-note">เรียงตามอายุ Ticket (วัน)</div><div id="itOldest"></div></section>'+
      '</div>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">ตรวจพบจากคอลัมน์ วันที่แจ้ง + ระบบ/ความสำคัญ ในไฟล์ที่อัปโหลด — Table ด้านล่างไม่ถูกแก้ไข</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('it-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function renderTrend(rows){
    var host=q('#itTrend'); if(!host)return;
    var byMonth={};
    rows.forEach(function(r){
      var ok=monthKey(r.opened);
      if(!byMonth[ok])byMonth[ok]={open:0,close:0};
      byMonth[ok].open++;
      if(r.closed){var ck=monthKey(r.closed); if(!byMonth[ck])byMonth[ck]={open:0,close:0}; byMonth[ck].close++;}
    });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="it-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)</div>';return;}
    /* บั๊กที่เจอ (จุดเดิมกับ Progress Trend ของ Project Control และ Downtime รายเดือนของ Maintenance/
       Safety/HR): เดิมบีบกราฟให้กว้างคงที่ 900 แล้ว scale ลงด้วย width:100% เสมอ ยิ่งมีหลายเดือนยิ่งบีบจน
       เส้น/จุด/ป้ายเดือนเล็กจนอ่านไม่ออก เปลี่ยนเป็นความกว้างคงที่ต่อเดือน (ไม่บีบ) ห่อด้วย scroll แนวนอน
       แทน — เดือนน้อยพอดีกล่องไม่ต้องเลื่อน เดือนเยอะเลื่อนดูได้ ป้ายเดือนเลยโชว์ครบทุกเดือนได้ (เดิมต้องข้าม
       บางป้าย) right ต้องกว้างพอให้ป้ายเดือนสุดท้ายไม่โดนตัดขอบขวา (ยืนยันบั๊กนี้จากการทดสอบ Safety รอบก่อน
       — เพิ่ม right เป็น 30 ตั้งแต่แรกกันไว้เลย) */
    var perM=64,left=40,right=30,top=14,bottom=26,ph=190;
    var w=Math.max(400,left+right+(keys.length-1)*perM), h=top+ph+bottom, pw=w-left-right;
    var maxV=1; keys.forEach(function(k){maxV=Math.max(maxV,byMonth[k].open,byMonth[k].close);});
    maxV=Math.ceil(maxV*1.2)||1;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+Math.round(val)+'</text>';
    }
    var stepX=pw/(keys.length-1||1);
    [['open','#DC2626'],['close','#16A34A']].forEach(function(cat){
      var pts=keys.map(function(k,i){var v=byMonth[k][cat[0]]; return (left+stepX*i)+','+(top+ph-ph*v/maxV);});
      out+='<path d="M'+pts.join(' L')+'" fill="none" stroke="'+cat[1]+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      keys.forEach(function(k,i){var v=byMonth[k][cat[0]]; out+='<circle cx="'+(left+stepX*i)+'" cy="'+(top+ph-ph*v/maxV)+'" r="3" fill="'+cat[1]+'" stroke="#fff" stroke-width="1.2"/>';});
    });
    keys.forEach(function(k,i){
      out+='<text x="'+(left+stepX*i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="#8a97a3">'+k+'</text>';
    });
    out+='</svg>';
    host.innerHTML='<div class="it-trend-scroll">'+out+'</div><div class="mini" style="display:flex;gap:14px;font-size:10.5px;color:var(--muted);margin-top:4px"><span>● <span style="color:#DC2626">Opened</span></span><span>● <span style="color:#16A34A">Closed</span></span></div>';
  }

  function renderBySystem(rows){
    var host=q('#itBySystem'); if(!host)return;
    var map={}; rows.forEach(function(r){ map[r.system]=(map[r.system]||0)+1; });
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    if(!entries.length){host.innerHTML='<div class="it-empty">ไม่มีข้อมูลระบบ</div>';return;}
    var w=460,rowH=26,h=14+entries.length*rowH,left=118,right=34,barW=w-left-right;
    var maxV=Math.max.apply(null,entries.map(function(e){return e[1];}))||1;
    var out=svgOpen(w,h);
    entries.forEach(function(e,i){
      var y=10+i*rowH, bw=Math.max(2,barW*e[1]/maxV);
      out+='<text x="'+(left-8)+'" y="'+(y+13)+'" text-anchor="end" font-size="10.5" fill="#374151"><title>'+esc(e[0])+'</title>'+esc(e[0].length>16?e[0].slice(0,15)+'…':e[0])+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="16" rx="4" fill="#EEF1F4"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="16" rx="4" fill="#0EA5E9"/>';
      out+='<text x="'+(left+bw+6)+'" y="'+(y+13)+'" font-size="10.5" font-weight="700" fill="#172033">'+e[1]+'</text>';
    });
    out+='</svg>';
    host.innerHTML=out;
  }

  function renderPriority(rows){
    var host=q('#itPriority'); if(!host)return;
    var counts={critical:0,high:0,medium:0,low:0,unknown:0};
    rows.forEach(function(r){counts[priorityBucket(r.priority)]++;});
    var total=Math.max(1,rows.length);
    var vals=[['critical','Critical',counts.critical,'#DC2626'],['high','High',counts.high,'#F59E0B'],['medium','Medium',counts.medium+counts.unknown,'#0EA5E9'],['low','Low',counts.low,'#94A3B8']];
    var out='<div class="it-status-row">';
    vals.forEach(function(v){
      var pct=(v[2]/total*100).toFixed(0);
      out+='<div class="it-status-item"><span class="lab"><i style="background:'+v[3]+'"></i>'+v[1]+'</span><div class="it-track"><span style="width:'+pct+'%;background:'+v[3]+'"></span></div><b>'+v[2]+'</b></div>';
    });
    out+='</div>';
    host.innerHTML=out;
  }

  /* บั๊กที่เจอ (จุดเดิมกับ Project Control/Maintenance/Safety/HR): โมดูลนี้ไม่เคยเช็ค state.domainOverride
     เลย — ตอนนี้เพิ่มตัวเลือก "IT Ops" ใน Template dropdown แล้ว (ตามที่ผู้ใช้ขอ) เลยแก้เป็นสองทิศทาง: ล็อก
     เป็นโดเมนอื่น → ปิดตัวเอง, ล็อกเป็น "itops" ตรงๆ → เปิดแม้คอลัมน์จะยังไม่ครบ (ให้ getData() ส่ง noMatch
     กลับมาแสดงข้อความแจ้งแทน) ซ่อนด้วยคลาสเฉพาะ ไม่ใช้ .remove() กันพลาดถ้ามีการย้าย DOM จริงเข้ามาแบบ
     Project Control ในอนาคต */
  function suppressLayout(){
    var layout=q('#itControlLayout');
    if(layout) layout.classList.add('it-override-hidden');
    qa('.it-hidden-source').forEach(function(e){ e.classList.remove('it-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้ */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='itops'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'itControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="it-panel"><h3>🖥 IT / DevOps Control</h3>'+
      '<div class="it-empty">ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่าย Ticket log (ต้องมีคอลัมน์วันที่แจ้ง '+
      'และอย่างน้อยหนึ่งใน ระบบ/ความสำคัญ/เลขที่ Ticket) — ลองเลือก Template เป็น "Auto" '+
      'หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('it-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='itops'){ suppressLayout(); return; }
    var icl=q('#itControlLayout'); if(icl) icl.classList.remove('it-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='itControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='itControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows, today=new Date(); today.setHours(0,0,0,0);
    var open=rows.filter(function(r){return ticketStatus(r.status)!=='closed';});
    var closed=rows.filter(function(r){return r.closed;});
    var avgRes=closed.length?closed.reduce(function(s,r){return s+((r.closed-r.opened)/86400000);},0)/closed.length:null;
    var critOpen=open.filter(function(r){return priorityBucket(r.priority)==='critical';}).length;
    var oldest=open.slice().sort(function(a,b){return a.opened-b.opened;});
    var maxAge=oldest.length?Math.round((today-oldest[0].opened)/86400000):0;

    q('#itKpis').innerHTML=
      '<div class="it-kpi"><div class="l">Ticket ทั้งหมด</div><div class="v">'+rows.length+'</div><div class="s">รายการที่บันทึก</div></div>'+
      '<div class="it-kpi'+(open.length?' warn':'')+'"><div class="l">Ticket เปิดอยู่</div><div class="v">'+open.length+'</div><div class="s">ยังไม่ปิด</div></div>'+
      '<div class="it-kpi'+(critOpen?' bad':'')+'"><div class="l">Critical เปิดอยู่</div><div class="v">'+critOpen+'</div><div class="s">ต้องเร่งแก้ไข</div></div>'+
      '<div class="it-kpi"><div class="l">Avg. Resolution</div><div class="v">'+(avgRes!=null?avgRes.toFixed(1):'—')+'</div><div class="s">วัน (เฉลี่ย)</div></div>'+
      '<div class="it-kpi'+(maxAge>14?' bad':maxAge>7?' warn':'')+'"><div class="l">Ticket ค้างนานสุด</div><div class="v">'+maxAge+'</div><div class="s">วัน</div></div>';

    var statusText=critOpen?'มี Critical ticket ค้างอยู่ ต้องเร่งแก้ไข':maxAge>14?'มี ticket ค้างนานเกินเกณฑ์':'อยู่ในเกณฑ์ปกติ';
    q('#itInsight').innerHTML='สถานะโดยรวม <b>'+statusText+'</b> — ticket ทั้งหมด <b>'+rows.length+'</b> รายการ, เปิดอยู่ <b>'+open.length+'</b> รายการ, Avg. Resolution <b>'+(avgRes!=null?avgRes.toFixed(1)+' วัน':'ไม่ทราบ')+'</b>. '+(critOpen?'มี <b>'+critOpen+' รายการ Critical</b> ที่ยังไม่ปิด.':'ไม่มี Critical ticket ค้างอยู่ในขณะนี้.');

    renderTrend(rows); renderBySystem(rows); renderPriority(rows);

    var top10=oldest.slice(0,10);
    q('#itOldest').innerHTML=top10.length?top10.map(function(r){
      var age=Math.round((today-r.opened)/86400000);
      return '<div class="it-list"><b>'+esc(r.ticketId)+'</b><span>'+esc(r.system)+(r.subject?' · '+esc(r.subject):'')+'</span><span class="age">'+age+' วัน</span></div>';
    }).join(''):'<div class="it-empty">ไม่มี Ticket ที่เปิดค้างอยู่</div>';

    q('#itUpdated').textContent='รอบข้อมูลถึง '+fmt(today)+' · '+rows.length.toLocaleString()+' รายการ';
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[ITOps1]',e);}});
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
