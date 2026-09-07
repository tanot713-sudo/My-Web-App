/* FINAL 1 — HR Control (new domain, additive)
   Same architecture as report-dashboard.safety.final1.js / final62.projectcontrol.js.
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
  /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control/Maintenance/Safety): toLocaleDateString('en-GB',...) ย่อ
     เดือนกันยายนเป็น "Sept" (4 ตัวอักษร) ต่างจากเดือนอื่นที่ย่อ 3 ตัว ทำให้คอลัมน์วันที่จัดแนวไม่ตรงกัน ใช้
     ตารางเดือนย่อ 3 ตัวอักษรคงที่เองแทน */
  var HR_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+HR_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }
  var ACTIVE_KW=['active','working','current','ปกติ','ทำงาน','คงอยู่'];
  var EXIT_KW=['resign','terminat','left','exit','ลาออก','พ้นสภาพ','สิ้นสุด'];
  function empStatus(v){
    var n=text(v).toLowerCase();
    if(EXIT_KW.some(function(k){return n.indexOf(k)>=0}))return 'exit';
    if(ACTIVE_KW.some(function(k){return n.indexOf(k)>=0}))return 'active';
    return n?'other':'unknown';
  }
  var TRAIN_DONE_KW=['complete','passed','ผ่าน','เสร็จ','สำเร็จ'];
  var TRAIN_PENDING_KW=['pending','not complete','ยังไม่','ค้าง','รอ'];
  function trainStatus(v){
    var n=text(v).toLowerCase();
    if(TRAIN_DONE_KW.some(function(k){return n.indexOf(k)>=0}))return 'done';
    if(TRAIN_PENDING_KW.some(function(k){return n.indexOf(k)>=0}))return 'pending';
    return n?'other':'unknown';
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
      id: roleCol(st,['employee id','emp id','รหัสพนักงาน']),
      name: roleCol(st,['employee name','name','ชื่อพนักงาน','ชื่อ-สกุล','ชื่อ']),
      department: roleCol(st,['department','แผนก','หน่วยงาน','สายงาน']),
      position: roleCol(st,['position','job title','ตำแหน่ง']),
      join: roleCol(st,['join date','hire date','start date','วันที่เริ่มงาน','วันเข้างาน']),
      exitDate: roleCol(st,['exit date','resign date','termination date','last day','วันที่ลาออก','วันพ้นสภาพ']),
      status: roleCol(st,['employment status','status','สถานะ']),
      empType: roleCol(st,['employment type','contract type','ประเภทการจ้าง']),
      training: roleCol(st,['training status','training','การอบรม','สถานะการอบรม'])
    };
    // Activation gate: needs join-date-like column + department/position — a
    // generic table without a headcount/hire concept isn't an HR log.
    /* ตามที่ผู้ใช้ขอ (เพิ่มตัวเลือก "HR" ใน Template dropdown): ถ้าผู้ใช้ล็อกมาตรงๆ ว่าเป็น HR แต่คอลัมน์
       ในข้อมูลไม่เข้าเกณฑ์ ให้ส่ง noMatch กลับไปให้ render() แสดงข้อความแจ้งเหตุผลแทนความเงียบ (แพทเทิร์น
       เดียวกับ Maintenance/Safety) */
    if(!c.join || !(c.department||c.position)) return ov==='hr' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var rows=st.rows.map(function(r,i){
      return {
        raw:r,i:i,
        name: c.name?text(r[c.name.key]):('พนักงาน #'+(i+1)),
        department: c.department?text(r[c.department.key])||'(ไม่ระบุ)':'(ไม่ระบุ)',
        position: c.position?text(r[c.position.key]):'',
        join: date(c.join?r[c.join.key]:null),
        exitDate: date(c.exitDate?r[c.exitDate.key]:null),
        status: c.status?text(r[c.status.key]):'',
        empType: c.empType?text(r[c.empType.key]):'',
        training: c.training?text(r[c.training.key]):''
      };
    }).filter(function(r){return r.join;});
    if(rows.length<2) return ov==='hr' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c};
  }

  function injectCSS(){
    if(q('#hr1-css'))return;
    var s=document.createElement('style');s.id='hr1-css';s.textContent=`
#hrControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px}
#hrControlLayout .hr-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--sh)}
#hrControlLayout .hr-hero h2{font-size:16px;margin:0}
#hrControlLayout .hr-hero .hr-sub{font-size:12px;color:var(--muted);margin-top:3px}
#hrControlLayout .hr-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#hrControlLayout .hr-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:var(--sh);position:relative}
#hrControlLayout .hr-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--ok)}
#hrControlLayout .hr-kpi.warn:after{background:var(--warn)}#hrControlLayout .hr-kpi.bad:after{background:var(--err)}
#hrControlLayout .hr-kpi .l{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#hrControlLayout .hr-kpi .v{font-size:24px;font-weight:850;margin-top:4px;color:var(--ink)}
#hrControlLayout .hr-kpi.warn .v{color:#B8720A}#hrControlLayout .hr-kpi.bad .v{color:var(--err)}
#hrControlLayout .hr-kpi .s{font-size:9.5px;color:var(--muted);margin-top:4px}
#hrControlLayout .hr-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--sh)}
#hrControlLayout .hr-panel h3{font-size:13px;margin:0 0 3px;font-weight:850}
#hrControlLayout .hr-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}
#hrControlLayout .hr-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#hrControlLayout .hr-grid>.half{grid-column:span 6}#hrControlLayout .hr-grid>.full{grid-column:1/-1}
#hrControlLayout .hr-insight{border-left:3px solid var(--ok);padding:10px 13px;font-size:12px;color:var(--ink)}
#hrControlLayout .hr-status-row{display:flex;flex-direction:column;gap:8px}
#hrControlLayout .hr-status-item{display:grid;grid-template-columns:110px 1fr 30px;align-items:center;gap:9px;font-size:11px}
#hrControlLayout .hr-status-item .lab{display:flex;align-items:center;gap:6px;font-weight:700}
#hrControlLayout .hr-status-item i{width:8px;height:8px;border-radius:50%;display:inline-block}
#hrControlLayout .hr-track{height:7px;border-radius:6px;background:#eef1f4;overflow:hidden}
#hrControlLayout .hr-track span{display:block;height:100%;border-radius:6px}
#hrControlLayout .hr-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}
#hrControlLayout .hr-list:last-child{border-bottom:none}
#hrControlLayout .hr-empty{padding:24px 8px;text-align:center;color:var(--muted);font-size:11px}
#hrControlLayout .hr-trend-scroll{overflow-x:auto}
#hrControlLayout.hr-override-hidden{display:none!important}
.hr-hidden-source{display:none!important}
@media(max-width:1100px){#hrControlLayout .hr-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#hrControlLayout .hr-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#hrControlLayout .hr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#hrControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='hrControlLayout';
    /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control/Maintenance/Safety): ไม่เคยติด data-dashboard-section
       ทำให้ setPage() มองไม่เห็นการ์ดนี้ เลยแสดงค้างอยู่ทุกแท็บ (Overview/Projects/Analytics/Details) ทั้งที่
       ตั้งใจให้อยู่แค่แท็บ Projects เท่านั้น */
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    layout.innerHTML=
      '<section class="hr-hero"><h2>👥 HR Control</h2><div class="hr-sub" id="hrUpdated">ภาพรวมกำลังคน, การรับเข้า-ออก และความครบถ้วนของการอบรม</div></section>'+
      '<div class="hr-kpis" id="hrKpis"></div>'+
      '<section class="hr-panel"><h3>Executive Insight</h3><div id="hrInsight" class="hr-insight"></div></section>'+
      '<div class="hr-grid">'+
        '<section class="hr-panel full"><h3>แนวโน้มรับเข้า-ออกรายเดือน</h3><div class="hr-note">New hires vs exits</div><div id="hrTrend"></div></section>'+
        '<section class="hr-panel half"><h3>Headcount แยกตามแผนก</h3><div class="hr-note">พนักงานที่ยัง Active</div><div id="hrByDept"></div></section>'+
        '<section class="hr-panel half"><h3>สถานะการอบรม</h3><div class="hr-note">ความครบถ้วนของการอบรมพนักงาน</div><div id="hrTraining"></div></section>'+
        '<section class="hr-panel full"><h3>พนักงานออกล่าสุด</h3><div class="hr-note">10 รายการล่าสุด</div><div id="hrRecent"></div></section>'+
      '</div>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">ตรวจพบจากคอลัมน์ วันที่เริ่มงาน + แผนก/ตำแหน่ง ในไฟล์ที่อัปโหลด — Table ด้านล่างไม่ถูกแก้ไข</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('hr-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function renderTrend(rows){
    var host=q('#hrTrend'); if(!host)return;
    var byMonth={};
    rows.forEach(function(r){
      var jk=monthKey(r.join);
      if(!byMonth[jk])byMonth[jk]={hire:0,exit:0};
      byMonth[jk].hire++;
      if(r.exitDate){var ek=monthKey(r.exitDate); if(!byMonth[ek])byMonth[ek]={hire:0,exit:0}; byMonth[ek].exit++;}
    });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="hr-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)</div>';return;}
    /* บั๊กที่เจอ (จุดเดิมกับ Progress Trend ของ Project Control และ Downtime รายเดือนของ Maintenance/
       Safety): เดิมบีบกราฟให้กว้างคงที่ 900 แล้ว scale ลงด้วย width:100% เสมอ ยิ่งมีหลายเดือนยิ่งบีบจนเส้น/
       จุด/ป้ายเดือนเล็กจนอ่านไม่ออก เปลี่ยนเป็นความกว้างคงที่ต่อเดือน (ไม่บีบ) ห่อด้วย scroll แนวนอนแทน —
       เดือนน้อยพอดีกล่องไม่ต้องเลื่อน เดือนเยอะเลื่อนดูได้ ป้ายเดือนเลยโชว์ครบทุกเดือนได้ (เดิมต้องข้ามบางป้าย)
       right ต้องกว้างพอให้ป้ายเดือนสุดท้าย (เช่น "2025-10") ไม่โดนตัดที่ขอบขวา (ยืนยันบั๊กนี้จริงจากการ
       ทดสอบ render ของ Safety รอบก่อน — เพิ่ม right เป็น 30 ตั้งแต่แรกกันไว้เลย) */
    var perM=64,left=40,right=30,top=14,bottom=26,ph=190;
    var w=Math.max(400,left+right+(keys.length-1)*perM), h=top+ph+bottom, pw=w-left-right;
    var maxV=1; keys.forEach(function(k){maxV=Math.max(maxV,byMonth[k].hire,byMonth[k].exit);});
    maxV=Math.ceil(maxV*1.2)||1;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+Math.round(val)+'</text>';
    }
    var stepX=pw/(keys.length-1||1);
    [['hire','#16A34A'],['exit','#DC2626']].forEach(function(cat){
      var pts=keys.map(function(k,i){var v=byMonth[k][cat[0]]; return (left+stepX*i)+','+(top+ph-ph*v/maxV);});
      out+='<path d="M'+pts.join(' L')+'" fill="none" stroke="'+cat[1]+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      keys.forEach(function(k,i){var v=byMonth[k][cat[0]]; out+='<circle cx="'+(left+stepX*i)+'" cy="'+(top+ph-ph*v/maxV)+'" r="3" fill="'+cat[1]+'" stroke="#fff" stroke-width="1.2"/>';});
    });
    keys.forEach(function(k,i){
      out+='<text x="'+(left+stepX*i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="#8a97a3">'+k+'</text>';
    });
    out+='</svg>';
    host.innerHTML='<div class="hr-trend-scroll">'+out+'</div><div class="mini" style="display:flex;gap:14px;font-size:10.5px;color:var(--muted);margin-top:4px"><span>● <span style="color:#16A34A">New Hires</span></span><span>● <span style="color:#DC2626">Exits</span></span></div>';
  }

  function renderByDept(rows){
    var host=q('#hrByDept'); if(!host)return;
    var map={}; rows.forEach(function(r){ if(empStatus(r.status)!=='exit') map[r.department]=(map[r.department]||0)+1; });
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    if(!entries.length){host.innerHTML='<div class="hr-empty">ไม่มีข้อมูลหน่วยงาน</div>';return;}
    var w=460,rowH=26,h=14+entries.length*rowH,left=118,right=34,barW=w-left-right;
    var maxV=Math.max.apply(null,entries.map(function(e){return e[1];}))||1;
    var out=svgOpen(w,h);
    entries.forEach(function(e,i){
      var y=10+i*rowH, bw=Math.max(2,barW*e[1]/maxV);
      out+='<text x="'+(left-8)+'" y="'+(y+13)+'" text-anchor="end" font-size="10.5" fill="#374151"><title>'+esc(e[0])+'</title>'+esc(e[0].length>16?e[0].slice(0,15)+'…':e[0])+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="16" rx="4" fill="#EEF1F4"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="16" rx="4" fill="#7C3AED"/>';
      out+='<text x="'+(left+bw+6)+'" y="'+(y+13)+'" font-size="10.5" font-weight="700" fill="#172033">'+e[1]+'</text>';
    });
    out+='</svg>';
    host.innerHTML=out;
  }

  function renderTraining(rows){
    var host=q('#hrTraining'); if(!host)return;
    var active=rows.filter(function(r){return empStatus(r.status)!=='exit';});
    var counts={done:0,pending:0,other:0,unknown:0};
    active.forEach(function(r){var b=trainStatus(r.training); counts[b]=(counts[b]||0)+1;});
    var total=Math.max(1,active.length);
    var vals=[['done','อบรมครบแล้ว',counts.done,'#16A34A'],['pending','ยังไม่ครบ',counts.pending,'#F59E0B'],['other','ไม่ระบุ',counts.other+counts.unknown,'#94A3B8']];
    var out='<div class="hr-status-row">';
    vals.forEach(function(v){
      var pct=(v[2]/total*100).toFixed(0);
      out+='<div class="hr-status-item"><span class="lab"><i style="background:'+v[3]+'"></i>'+v[1]+'</span><div class="hr-track"><span style="width:'+pct+'%;background:'+v[3]+'"></span></div><b>'+v[2]+'</b></div>';
    });
    out+='</div>';
    host.innerHTML=out;
  }

  /* บั๊กที่เจอ (จุดเดิมกับ Project Control/Maintenance/Safety): โมดูลนี้ไม่เคยเช็ค state.domainOverride
     เลย — ตอนนี้เพิ่มตัวเลือก "HR" ใน Template dropdown แล้ว (ตามที่ผู้ใช้ขอ) เลยแก้เป็นสองทิศทาง: ล็อกเป็น
     โดเมนอื่น → ปิดตัวเอง, ล็อกเป็น "hr" ตรงๆ → เปิดแม้คอลัมน์จะยังไม่ครบ (ให้ getData() ส่ง noMatch
     กลับมาแสดงข้อความแจ้งแทน) ซ่อนด้วยคลาสเฉพาะ ไม่ใช้ .remove() กันพลาดถ้ามีการย้าย DOM จริงเข้ามาแบบ
     Project Control ในอนาคต */
  function suppressLayout(){
    var layout=q('#hrControlLayout');
    if(layout) layout.classList.add('hr-override-hidden');
    qa('.hr-hidden-source').forEach(function(e){ e.classList.remove('hr-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้ */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='hr'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'hrControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="hr-panel"><h3>👥 HR Control</h3>'+
      '<div class="hr-empty">ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่ายข้อมูลพนักงาน (ต้องมีคอลัมน์วันที่เริ่มงาน '+
      'และอย่างน้อยหนึ่งใน แผนก/ตำแหน่ง) — ลองเลือก Template เป็น "Auto" '+
      'หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('hr-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='hr'){ suppressLayout(); return; }
    var hcl=q('#hrControlLayout'); if(hcl) hcl.classList.remove('hr-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='hrControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='hrControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows, today=new Date(); today.setHours(0,0,0,0);
    var active=rows.filter(function(r){return empStatus(r.status)!=='exit' && !r.exitDate;});
    var thisMonth=monthKey(today);
    var newHires=rows.filter(function(r){return monthKey(r.join)===thisMonth;}).length;
    var exitsThisMonth=rows.filter(function(r){return r.exitDate&&monthKey(r.exitDate)===thisMonth;}).length;
    var totalExits=rows.filter(function(r){return r.exitDate||empStatus(r.status)==='exit';}).length;
    var headcount=Math.max(1,active.length);
    var attritionRate=(totalExits/(headcount+totalExits)*100);
    var trainPending=active.filter(function(r){return trainStatus(r.training)==='pending';}).length;

    q('#hrKpis').innerHTML=
      '<div class="hr-kpi"><div class="l">Headcount</div><div class="v">'+active.length+'</div><div class="s">พนักงานที่ยัง Active</div></div>'+
      '<div class="hr-kpi"><div class="l">New Hires</div><div class="v">'+newHires+'</div><div class="s">เดือนนี้</div></div>'+
      '<div class="hr-kpi'+(exitsThisMonth?' warn':'')+'"><div class="l">Exits</div><div class="v">'+exitsThisMonth+'</div><div class="s">เดือนนี้</div></div>'+
      '<div class="hr-kpi'+(attritionRate>15?' bad':attritionRate>8?' warn':'')+'"><div class="l">Attrition Rate</div><div class="v">'+attritionRate.toFixed(1)+'%</div><div class="s">สะสมทั้งหมด</div></div>'+
      '<div class="hr-kpi'+(trainPending?' warn':'')+'"><div class="l">Training ค้าง</div><div class="v">'+trainPending+'</div><div class="s">ยังอบรมไม่ครบ</div></div>';

    var status=attritionRate>15?'ควรทบทวนสาเหตุการลาออก':trainPending?'ควรเร่งติดตามการอบรม':'อยู่ในเกณฑ์ปกติ';
    q('#hrInsight').innerHTML='สถานะโดยรวม <b>'+status+'</b> — Headcount ปัจจุบัน <b>'+active.length+'</b> คน, Attrition Rate สะสม <b>'+attritionRate.toFixed(1)+'%</b>. '+(trainPending?'มี <b>'+trainPending+' คน</b> ที่ยังอบรมไม่ครบตามเกณฑ์.':'การอบรมพนักงานอยู่ในเกณฑ์ครบถ้วน.');

    renderTrend(rows); renderByDept(rows); renderTraining(rows);

    var recentExits=rows.filter(function(r){return r.exitDate;}).sort(function(a,b){return b.exitDate-a.exitDate;}).slice(0,10);
    q('#hrRecent').innerHTML=recentExits.length?recentExits.map(function(r){
      return '<div class="hr-list"><b>'+esc(r.name)+'</b><span>'+esc(r.department)+(r.position?' · '+esc(r.position):'')+'</span><span>'+fmt(r.exitDate)+'</span></div>';
    }).join(''):'<div class="hr-empty">ไม่มีข้อมูลการลาออก</div>';

    q('#hrUpdated').textContent='รอบข้อมูลถึง '+fmt(today)+' · '+rows.length.toLocaleString()+' รายการ';
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[HR1]',e);}});
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
