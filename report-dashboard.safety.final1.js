/* FINAL 1 — Safety / HSE Control (new domain, additive)
   Follows the exact pattern of report-dashboard.final62.projectcontrol.js:
   self-contained, own column-role detection, auto-activates only when the
   uploaded sheet looks like a safety/incident log, inserts its own layout
   next to the existing Projects-section cards without touching them.
   Does NOT modify any existing file, hook, or the table renderer.
*/
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
  /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control/Maintenance): toLocaleDateString('en-GB',...) ย่อเดือน
     กันยายนเป็น "Sept" (4 ตัวอักษร) ต่างจากเดือนอื่นที่ย่อ 3 ตัว ทำให้คอลัมน์วันที่จัดแนวไม่ตรงกัน ใช้
     ตารางเดือนย่อ 3 ตัวอักษรคงที่เองแทน */
  var SF_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+SF_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}

  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  /* ── Classify a free-text incident-type / severity value into the three
     categories every HSE program tracks. Same "keyword classifier" idiom the
     base app already uses for finance income/expense classification. ── */
  var NEARMISS_KW=['near miss','near-miss','nearmiss','เกือบเกิด','เกือบพลาด'];
  var LOSTTIME_KW=['lost time','lost-time','losttime','lti','หยุดงาน','บาดเจ็บถึงขั้นหยุดงาน'];
  var FIRSTAID_KW=['first aid','first-aid','firstaid','ปฐมพยาบาล'];
  function classify(typeVal, sevVal){
    var n=(text(typeVal)+' '+text(sevVal)).toLowerCase();
    if(LOSTTIME_KW.some(function(k){return n.indexOf(k)>=0})) return 'losttime';
    if(FIRSTAID_KW.some(function(k){return n.indexOf(k)>=0})) return 'firstaid';
    if(NEARMISS_KW.some(function(k){return n.indexOf(k)>=0})) return 'nearmiss';
    return 'other';
  }
  var OPEN_KW=['open','pending','ระหว่างแก้ไข','ค้าง','รอดำเนินการ'];
  var CLOSED_KW=['closed','complete','done','resolved','ปิด','เสร็จ','แล้วเสร็จ'];
  function statusBucket(v){
    var n=text(v).toLowerCase();
    if(CLOSED_KW.some(function(k){return n.indexOf(k)>=0})) return 'closed';
    if(OPEN_KW.some(function(k){return n.indexOf(k)>=0})) return 'open';
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
      date: roleCol(st,['incident date','event date','date of incident','วันที่เกิดเหตุ','วันที่เกิดเหตุการณ์','วันที่']),
      type: roleCol(st,['incident type','event type','ประเภทเหตุการณ์','ประเภทอุบัติเหตุ']),
      severity: roleCol(st,['severity','ความรุนแรง','ระดับความรุนแรง']),
      department: roleCol(st,['department','แผนก','หน่วยงาน','สายงาน']),
      status: roleCol(st,['status','สถานะ']),
      due: roleCol(st,['due date','กำหนดปิด','กำหนดแก้ไข','กำหนดเสร็จ']),
      project: roleCol(st,['project','โครงการ','สาย','line']),
      finding: roleCol(st,['finding','ประเด็น','รายละเอียด','description'])
    };
    // Activation gate: needs a date column and (type or severity) — a bare
    // status/department table is too generic to claim as a safety log.
    /* ตามที่ผู้ใช้ขอ (เพิ่มตัวเลือก "Safety" ใน Template dropdown): ถ้าผู้ใช้ล็อกมาตรงๆ ว่าเป็น Safety
       แต่คอลัมน์ในข้อมูลไม่เข้าเกณฑ์ ให้ส่ง noMatch กลับไปให้ render() แสดงข้อความแจ้งเหตุผลแทนความเงียบ
       (แพทเทิร์นเดียวกับ Maintenance) */
    if(!c.date || !(c.type||c.severity)) return ov==='safety' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var rows=st.rows.map(function(r,i){
      var d=date(c.date?r[c.date.key]:null);
      return {
        raw:r, i:i, date:d,
        type: c.type?text(r[c.type.key]):'',
        severity: c.severity?text(r[c.severity.key]):'',
        department: c.department?text(r[c.department.key])||'(ไม่ระบุ)':'(ไม่ระบุ)',
        status: c.status?text(r[c.status.key]):'',
        due: date(c.due?r[c.due.key]:null),
        project: c.project?text(r[c.project.key]):'',
        finding: c.finding?text(r[c.finding.key]):''
      };
    }).filter(function(r){return r.date;});
    if(rows.length<2) return ov==='safety' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c};
  }

  function injectCSS(){
    if(q('#safety1-css'))return;
    var s=document.createElement('style');s.id='safety1-css';s.textContent=`
#safetyControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px;font-family:var(--pc53-font,inherit)}
#safetyControlLayout .sf-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--sh)}
#safetyControlLayout .sf-hero h2{font-size:16px;margin:0}
#safetyControlLayout .sf-hero .sf-sub{font-size:12px;color:var(--muted);margin-top:3px}
#safetyControlLayout .sf-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
#safetyControlLayout .sf-pyramid{display:flex;flex-direction:column;align-items:center;gap:2px}
#safetyControlLayout .sf-pyramid-legend{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:9.5px;color:var(--muted);margin-top:6px}
#safetyControlLayout .sf-pyramid-legend span{display:inline-flex;align-items:center;gap:5px}
#safetyControlLayout .sf-pyramid-legend i{width:10px;height:10px;border-radius:2px;display:inline-block}
#safetyControlLayout .sf-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:var(--sh);position:relative}
#safetyControlLayout .sf-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--ok)}
#safetyControlLayout .sf-kpi.warn:after{background:var(--warn)}#safetyControlLayout .sf-kpi.bad:after{background:var(--err)}
#safetyControlLayout .sf-kpi .l{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#safetyControlLayout .sf-kpi .v{font-size:24px;font-weight:850;margin-top:4px;color:var(--ink)}
#safetyControlLayout .sf-kpi.warn .v{color:#B8720A}#safetyControlLayout .sf-kpi.bad .v{color:var(--err)}
#safetyControlLayout .sf-kpi .s{font-size:9.5px;color:var(--muted);margin-top:4px}
#safetyControlLayout .sf-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--sh)}
#safetyControlLayout .sf-panel h3{font-size:13px;margin:0 0 3px;font-weight:850}
#safetyControlLayout .sf-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}
#safetyControlLayout .sf-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#safetyControlLayout .sf-grid>.half{grid-column:span 6}#safetyControlLayout .sf-grid>.full{grid-column:1/-1}
#safetyControlLayout .sf-insight{border-left:3px solid var(--ok);padding:10px 13px;font-size:12px;color:var(--ink)}
#safetyControlLayout .sf-status-row{display:flex;flex-direction:column;gap:8px}
#safetyControlLayout .sf-status-item{display:grid;grid-template-columns:96px 1fr 30px;align-items:center;gap:9px;font-size:11px}
#safetyControlLayout .sf-status-item .lab{display:flex;align-items:center;gap:6px;font-weight:700}
#safetyControlLayout .sf-status-item i{width:8px;height:8px;border-radius:50%;display:inline-block}
#safetyControlLayout .sf-track{height:7px;border-radius:6px;background:#eef1f4;overflow:hidden}
#safetyControlLayout .sf-track span{display:block;height:100%;border-radius:6px}
#safetyControlLayout .sf-attention{display:flex;flex-direction:column;gap:6px;max-height:230px;overflow:auto}
#safetyControlLayout .sf-att-card{border-radius:9px;padding:8px 10px;font-size:11px;border-left:3px solid var(--err);background:#FDEEEE}
#safetyControlLayout .sf-att-card.warn{border-left-color:var(--warn);background:#FEF6EA}
#safetyControlLayout .sf-att-card b{display:block;font-size:11.5px;margin-bottom:2px}
#safetyControlLayout .sf-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}
#safetyControlLayout .sf-list:last-child{border-bottom:none}
#safetyControlLayout .sf-empty{padding:24px 8px;text-align:center;color:var(--muted);font-size:11px}
#safetyControlLayout svg text{font-family:var(--pc53-font,inherit)}
#safetyControlLayout .sf-trend-scroll{overflow-x:auto}
#safetyControlLayout.safety-override-hidden{display:none!important}
.safety-hidden-source{display:none!important}
@media(max-width:1100px){#safetyControlLayout .sf-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#safetyControlLayout .sf-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#safetyControlLayout .sf-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}

`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#safetyControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='safetyControlLayout';
    /* บั๊กที่ยืนยันแล้ว (จุดเดิมกับ Project Control/Maintenance): ไม่เคยติด data-dashboard-section ทำให้
       setPage() มองไม่เห็นการ์ดนี้ เลยแสดงค้างอยู่ทุกแท็บ (Overview/Projects/Analytics/Details) ทั้งที่
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
      '<section class="sf-hero"><h2>🛡 Safety &amp; HSE Control</h2><div class="sf-sub" id="sfUpdated">ภาพรวมอุบัติเหตุ, Near-miss และสถานะการแก้ไขตามมาตรฐาน ISO 45001/14001</div></section>'+
      '<div class="sf-kpis" id="sfKpis"></div>'+
      '<section class="sf-panel sf-insight-panel"><h3>Executive Insight</h3><div id="sfInsight" class="sf-insight"></div></section>'+
      '<div class="sf-grid">'+
        '<section class="sf-panel full"><h3>แนวโน้มเหตุการณ์รายเดือน</h3><div class="sf-note">Near-miss / First-aid / Lost-time</div><div id="sfTrend"></div></section>'+
        '<section class="sf-panel half"><h3>เหตุการณ์แยกตามหน่วยงาน</h3><div class="sf-note">จำนวนรายการต่อแผนก</div><div id="sfByDept"></div></section>'+
        '<section class="sf-panel half"><h3>Safety Pyramid</h3><div class="sf-note">สัดส่วน Near-miss : First-aid : Lost-time (Heinrich\'s Triangle)</div><div id="sfPyramid"></div></section>'+
        '<section class="sf-panel half"><h3>Action Status</h3><div class="sf-note">สถานะการปิดประเด็นทั้งหมด</div><div id="sfStatus"></div></section>'+
        '<section class="sf-panel half"><h3>⚠ ต้องติดตามด่วน</h3><div class="sf-note">ค้าง/เลยกำหนด หรือ Lost-time</div><div id="sfAttention"></div></section>'+
        '<section class="sf-panel full"><h3>รายการล่าสุด</h3><div class="sf-note">10 รายการล่าสุด</div><div id="sfRecent"></div></section>'+
      '</div>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">ตรวจพบจากคอลัมน์ วันที่เกิดเหตุ + ประเภท/ความรุนแรง ในไฟล์ที่อัปโหลด — Table ด้านล่างไม่ถูกแก้ไข</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('safety-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function renderTrend(rows){
    var host=q('#sfTrend'); if(!host)return;
    var byMonth={};
    rows.forEach(function(r){
      var k=monthKey(r.date); var cls=classify(r.type,r.severity);
      if(!byMonth[k]) byMonth[k]={nearmiss:0,firstaid:0,losttime:0,other:0};
      byMonth[k][cls]++;
    });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="sf-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)</div>';return;}
    /* บั๊กที่เจอ (จุดเดิมกับ Progress Trend ของ Project Control และ Downtime รายเดือนของ Maintenance):
       เดิมบีบกราฟให้กว้างคงที่ 900 แล้ว scale ลงด้วย width:100% เสมอ ยิ่งมีหลายเดือนยิ่งบีบจนเส้น/จุด/ป้าย
       เดือนเล็กจนอ่านไม่ออก เปลี่ยนเป็นความกว้างคงที่ต่อเดือน (ไม่บีบ) ห่อด้วย scroll แนวนอนแทน — เดือนน้อย
       พอดีกล่องไม่ต้องเลื่อน เดือนเยอะเลื่อนดูได้ ป้ายเดือนเลยโชว์ครบทุกเดือนได้ (เดิมต้องข้ามบางป้าย) */
    /* right ต้องกว้างพอให้ป้ายเดือนสุดท้าย (เช่น "2025-10" กว้าง ~7 ตัวอักษร, text-anchor=middle จุดกึ่งกลาง
       ชนขอบ viewBox พอดี) ไม่โดนตัดที่ขอบขวา — ยืนยันบั๊กนี้จริงจากการทดสอบ render (เห็น "2025-1" ขาดเลข
       ท้าย) เพิ่ม right จาก 14 เป็น 30 */
    var perM=64,left=40,right=30,top=14,bottom=26,ph=190;
    var w=Math.max(400,left+right+(keys.length-1)*perM), h=top+ph+bottom, pw=w-left-right;
    var maxV=1; keys.forEach(function(k){var t=byMonth[k]; maxV=Math.max(maxV,t.nearmiss+t.firstaid+t.losttime+t.other);});
    maxV=Math.ceil(maxV*1.15)||1;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+Math.round(val)+'</text>';
    }
    var stepX=pw/(keys.length-1||1);
    var cats=[['nearmiss','#2D7FF0'],['firstaid','#F59E0B'],['losttime','#DC2626']];
    cats.forEach(function(cat){
      var pts=keys.map(function(k,i){var v=byMonth[k][cat[0]]; return (left+stepX*i)+','+(top+ph-ph*v/maxV);});
      out+='<path d="M'+pts.join(' L')+'" fill="none" stroke="'+cat[1]+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      keys.forEach(function(k,i){var v=byMonth[k][cat[0]]; out+='<circle cx="'+(left+stepX*i)+'" cy="'+(top+ph-ph*v/maxV)+'" r="3" fill="'+cat[1]+'" stroke="#fff" stroke-width="1.2"/>';});
    });
    keys.forEach(function(k,i){
      out+='<text x="'+(left+stepX*i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="#8a97a3">'+k+'</text>';
    });
    out+='</svg>';
    host.innerHTML='<div class="sf-trend-scroll">'+out+'</div><div class="mini" style="display:flex;gap:14px;font-size:10.5px;color:var(--muted);margin-top:4px"><span>● <span style="color:#2D7FF0">Near-miss</span></span><span>● <span style="color:#F59E0B">First-aid</span></span><span>● <span style="color:#DC2626">Lost-time</span></span></div>';
  }

  function renderByDept(rows){
    var host=q('#sfByDept'); if(!host)return;
    var map={}; rows.forEach(function(r){ map[r.department]=(map[r.department]||0)+1; });
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    if(!entries.length){host.innerHTML='<div class="sf-empty">ไม่มีข้อมูลหน่วยงาน</div>';return;}
    var w=460,rowH=26,h=14+entries.length*rowH,left=118,right=34,barW=w-left-right;
    var maxV=Math.max.apply(null,entries.map(function(e){return e[1];}))||1;
    var out=svgOpen(w,h);
    entries.forEach(function(e,i){
      var y=10+i*rowH, bw=Math.max(2,barW*e[1]/maxV);
      out+='<text x="'+(left-8)+'" y="'+(y+13)+'" text-anchor="end" font-size="10.5" fill="#374151"><title>'+esc(e[0])+'</title>'+esc(e[0].length>16?e[0].slice(0,15)+'…':e[0])+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="16" rx="4" fill="#EEF1F4"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="16" rx="4" fill="#2D7FF0"/>';
      out+='<text x="'+(left+bw+6)+'" y="'+(y+13)+'" font-size="10.5" font-weight="700" fill="#172033">'+e[1]+'</text>';
    });
    out+='</svg>';
    host.innerHTML=out;
  }

  function renderStatus(rows){
    var host=q('#sfStatus'); if(!host)return;
    var counts={open:0,closed:0,other:0,unknown:0};
    var today=new Date(); today.setHours(0,0,0,0);
    var overdue=0;
    rows.forEach(function(r){
      var b=statusBucket(r.status);
      counts[b]=(counts[b]||0)+1;
      if(r.due && r.due<today && b!=='closed') overdue++;
    });
    var total=Math.max(1,rows.length);
    var vals=[['closed','ปิดแล้ว',counts.closed,'#16A34A'],['open','ระหว่างแก้ไข',counts.open,'#F59E0B'],['other','อื่นๆ/ไม่ระบุ',counts.other+counts.unknown,'#94A3B8'],['overdue','เลยกำหนด',overdue,'#DC2626']];
    var out='<div class="sf-status-row">';
    vals.forEach(function(v){
      var pct=(v[2]/total*100).toFixed(0);
      out+='<div class="sf-status-item"><span class="lab"><i style="background:'+v[3]+'"></i>'+v[1]+'</span><div class="sf-track"><span style="width:'+pct+'%;background:'+v[3]+'"></span></div><b>'+v[2]+'</b></div>';
    });
    out+='</div>';
    host.innerHTML=out;
    return overdue;
  }

  /* ตามที่ผู้ใช้ขอ: Safety Pyramid (Heinrich's Triangle) — พีระมิดแสดงสัดส่วน Near-miss (ฐาน กว้างสุด) /
     First-aid (กลาง) / Lost-time (ยอด แคบสุด) ความสูงของแต่ละชั้นแปรผันตามสัดส่วนจำนวนจริง (ไม่ใช่แค่
     รูปสามเหลี่ยมตายตัวสำหรับตกแต่ง) ส่วนความกว้างค่อยๆ แคบลงจากฐานถึงยอดตามธรรมเนียมภาพพีระมิดความ
     ปลอดภัยมาตรฐาน */
  function renderPyramid(rows){
    var host=q('#sfPyramid'); if(!host)return;
    var c={nearmiss:0,firstaid:0,losttime:0};
    rows.forEach(function(r){ var k=classify(r.type,r.severity); if(c[k]!=null)c[k]++; });
    var total=c.nearmiss+c.firstaid+c.losttime;
    if(!total){host.innerHTML='<div class="sf-empty">ไม่มีข้อมูลเพียงพอสำหรับพีระมิดความปลอดภัย</div>';return;}
    var W=300,H=190,apexPad=6;
    var tiers=[['nearmiss','Near-miss',c.nearmiss,'#2D7FF0'],['firstaid','First-aid',c.firstaid,'#F59E0B'],['losttime','Lost-time',c.losttime,'#DC2626']];
    // ความสูงแต่ละชั้นแปรผันตามสัดส่วน แต่กันชั้นที่มีข้อมูลไม่ให้แคบจนมองไม่เห็น (ขั้นต่ำ 22px)
    var minH=22, raw=tiers.map(function(t){return t[2]/total*H;});
    var extra=0; raw=raw.map(function(h){ if(h>0&&h<minH){extra+=minH-h;return minH;} return h; });
    if(extra>0){ var flexIdx=raw.map(function(h,i){return h>minH?i:-1;}).filter(function(i){return i>=0;});
      if(flexIdx.length){ var each=extra/flexIdx.length; flexIdx.forEach(function(i){raw[i]-=each;}); } }
    /* วัดจากฐาน (yFromBottom=0, กว้างสุด=W) ขึ้นไปยอด (yFromBottom=H, แคบสุด=apexPad) — เดิมสูตรนี้เขียน
       สลับทิศ ทำให้พีระมิดกลับหัว (Near-miss ซึ่งควรเป็นฐานกว้างด้านล่างกลับไปโผล่ด้านบนแทน) แก้ให้ถูกทิศ:
       วนจาก tiers[0]=Near-miss ก่อน (ฐานกว้างสุด อยู่ล่างสุด) ไล่ขึ้นไปจนถึง Lost-time (ยอดแคบสุด) */
    var widthAt=function(yFromBottom){ return W-(W-apexPad)*(yFromBottom/H); };
    var out='<svg width="'+W+'" height="'+(H+10)+'" viewBox="0 0 '+W+' '+(H+10)+'" role="img" style="display:block;margin:0 auto">';
    var cursor=0; // yFromBottom ของขอบล่างของชั้นปัจจุบัน เริ่มจากฐาน (0)
    tiers.forEach(function(t,i){
      var h=raw[i]; if(h<=0)return;
      var yb=cursor, yt=cursor+h;
      var wBottom=widthAt(yb), wTop=widthAt(yt);
      var xL_b=(W-wBottom)/2, xR_b=xL_b+wBottom, xL_t=(W-wTop)/2, xR_t=xL_t+wTop;
      var svgYBottom=H-yb+5, svgYTop=H-yt+5; // แปลงเป็นพิกัด SVG (0=บน, ค่ามากขึ้น=ลงล่าง)
      out+='<polygon points="'+xL_b+','+svgYBottom+' '+xR_b+','+svgYBottom+' '+xR_t+','+svgYTop+' '+xL_t+','+svgYTop+'" fill="'+t[3]+'" stroke="#fff" stroke-width="1.5"/>';
      out+='<text x="'+(W/2)+'" y="'+((svgYBottom+svgYTop)/2+4)+'" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">'+t[2]+'</text>';
      cursor=yt;
    });
    out+='</svg>';
    var legend='<div class="sf-pyramid-legend">'+tiers.map(function(t){return '<span><i style="background:'+t[3]+'"></i>'+t[1]+' ('+(total?Math.round(t[2]/total*100):0)+'%)</span>';}).join('')+'</div>';
    host.innerHTML='<div class="sf-pyramid">'+out+legend+'</div>';
  }

  /* ตามที่ผู้ใช้ขอ: Days Since Last LTI — ตัวชี้วัดมาตรฐานที่โรงงาน/ไซต์งานส่วนใหญ่ติดป้ายไว้จริง คำนวณจาก
     วันที่ล่าสุดที่จัดอยู่ในหมวด Lost-time เทียบกับวันนี้ */
  function daysSinceLastLTI(rows, today){
    var ltiDates=rows.filter(function(r){return classify(r.type,r.severity)==='losttime';}).map(function(r){return r.date;});
    if(!ltiDates.length)return null;
    var last=ltiDates.reduce(function(m,d){return d>m?d:m;});
    return Math.floor((today-last)/86400000);
  }

  /* บั๊กที่เจอ (จุดเดิมกับ Project Control/Maintenance): โมดูลนี้ไม่เคยเช็ค state.domainOverride เลย —
     ตอนนี้เพิ่มตัวเลือก "Safety" ใน Template dropdown แล้ว (ตามที่ผู้ใช้ขอ) เลยแก้เป็นสองทิศทาง:
     ล็อกเป็นโดเมนอื่น → ปิดตัวเอง, ล็อกเป็น "safety" ตรงๆ → เปิดแม้คอลัมน์จะยังไม่ครบ (ให้ getData()
     ส่ง noMatch กลับมาแสดงข้อความแจ้งแทน) */
  function suppressLayout(){
    var layout=q('#safetyControlLayout');
    if(layout) layout.classList.add('safety-override-hidden');
    qa('.safety-hidden-source').forEach(function(e){ e.classList.remove('safety-hidden-source'); });
  }

  /* บั๊กที่เจอตอนทดสอบสลับไฟล์หลายรอบ (Playwright): ต่อให้แต่ละโมดูลซ่อนตัวเองเมื่อข้อมูลไม่ตรงแล้ว ยังมี
     ปัญหาเรื่องลำดับเวลาเหลืออยู่ — ถ้าโมดูลที่โหลดทีหลัง (ในลำดับ <script>) ยังไม่ทันได้ประเมินตัวเองใหม่ใน
     รอบ render นี้ โมดูลที่โหลดก่อนหน้าจะเห็น data-built ของมันค้างเป็น '1' แบบเก่า (จากเฟรมก่อน) แล้วเข้าใจ
     ผิดว่ายังมีโดเมนอื่นครองพื้นที่อยู่ ทั้งที่จริงๆ ควรจะซ่อนตัวเองไปแล้ว — ลงทะเบียนฟังก์ชันนี้ไว้กลางเพื่อให้
     โมดูลอื่นๆ เรียก "บังคับ" ให้ตัวเองประเมินใหม่ทันทีก่อนตัดสินใจเรื่อง mutual exclusion ของตัวเอง */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='safety'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'safetyControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="sf-panel"><h3>🛡 Safety &amp; HSE Control</h3>'+
      '<div class="sf-empty">ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่ายบันทึกความปลอดภัย (ต้องมีคอลัมน์วันที่เกิดเหตุ '+
      'และอย่างน้อยหนึ่งใน ประเภทเหตุการณ์/ความรุนแรง) — ลองเลือก Template เป็น "Auto" '+
      'หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('safety-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='safety'){ suppressLayout(); return; }
    var scl=q('#safetyControlLayout'); if(scl) scl.classList.remove('safety-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ: อัปโหลดไฟล์ใหม่ที่ไม่ใช่ Safety แล้วแดชบอร์ดของโดเมนก่อนหน้ายังค้างแสดงอยู่ ไม่ยอม
       เปิดทางให้โดเมนใหม่ที่ถูกต้องแสดงแทน — สาเหตุคือเดิม getData() ไม่แมตช์แล้วก็แค่ return เฉยๆ ไม่เคย
       เรียก suppressLayout() ตัวเอง ทำให้ data-built ค้างเป็น '1' ตลอดไป โดเมนอื่นที่เช็ค mutual exclusion
       เลยเข้าใจผิดว่า "มีโดเมนนี้ครองพื้นที่อยู่" ทั้งที่จริงๆ ข้อมูลเปลี่ยนไปแล้ว แก้โดยซ่อนตัวเองทันทีที่
       ข้อมูลปัจจุบันไม่ตรงกับโดเมนนี้อีกต่อไป */
    var data=getData(); if(!data){suppressLayout();return;}
    // Mutual exclusion: if another specialized control module (Project/HR/
    // IT/Maintenance) has already claimed this same slot for this upload,
    // don't stack a second full layout on top of it. ต้องเช็คว่ายังไม่ถูกซ่อนด้วย (className มี
    // "override-hidden") ไม่งั้นโมดูลที่ซ่อนตัวเองไปแล้วจะยังนับเป็น "ครองพื้นที่" อยู่ตลอดไป (บั๊กเดิม)
    // บังคับให้ทุกโมดูลอื่นประเมินตัวเองใหม่ก่อน กันปัญหาลำดับเวลา (ดูคอมเมนต์ที่ __tdRevalidate ด้านบน)
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='safetyControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='safetyControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows, today=new Date(); today.setHours(0,0,0,0);
    var counts={nearmiss:0,firstaid:0,losttime:0,other:0};
    rows.forEach(function(r){counts[classify(r.type,r.severity)]++;});
    var openCount=rows.filter(function(r){return statusBucket(r.status)==='open';}).length;
    var overdueCount=rows.filter(function(r){return r.due && r.due<today && statusBucket(r.status)!=='closed';}).length;
    var daysSinceLTI=daysSinceLastLTI(rows,today);
    var ltiDaysClass=daysSinceLTI==null?'':daysSinceLTI<7?' bad':daysSinceLTI<30?' warn':'';

    q('#sfKpis').innerHTML=
      '<div class="sf-kpi"><div class="l">Total Incidents</div><div class="v">'+rows.length+'</div><div class="s">รายการทั้งหมดที่บันทึก</div></div>'+
      '<div class="sf-kpi'+(counts.nearmiss?'':' ')+'"><div class="l">Near-miss</div><div class="v">'+counts.nearmiss+'</div><div class="s">รายงานเชิงรุก</div></div>'+
      '<div class="sf-kpi'+(counts.losttime?' bad':'')+'"><div class="l">Lost-time</div><div class="v">'+counts.losttime+'</div><div class="s">บาดเจ็บถึงขั้นหยุดงาน</div></div>'+
      '<div class="sf-kpi'+ltiDaysClass+'"><div class="l">Days Since Last LTI</div><div class="v">'+(daysSinceLTI==null?'—':daysSinceLTI.toLocaleString())+'</div><div class="s">'+(daysSinceLTI==null?'ยังไม่มีบันทึก Lost-time':'วันปลอดอุบัติเหตุหยุดงาน')+'</div></div>'+
      '<div class="sf-kpi'+(openCount?' warn':'')+'"><div class="l">Action ค้าง</div><div class="v">'+openCount+'</div><div class="s">ระหว่างดำเนินการ</div></div>'+
      '<div class="sf-kpi'+(overdueCount?' bad':'')+'"><div class="l">เลยกำหนด</div><div class="v">'+overdueCount+'</div><div class="s">ต้องเร่งปิด</div></div>';

    var statusText=overdueCount?'ต้องเร่งดำเนินการ':openCount?'ติดตามใกล้ชิด':'อยู่ในเกณฑ์ปกติ';
    q('#sfInsight').innerHTML='สถานะโดยรวม <b>'+statusText+'</b> — บันทึกทั้งหมด <b>'+rows.length+'</b> รายการ พบ Near-miss <b>'+counts.nearmiss+'</b>, Lost-time <b>'+counts.losttime+'</b>. '+(overdueCount?'มี <b>'+overdueCount+' รายการ</b> เลยกำหนดปิด ต้องติดตามด่วน.':'ไม่มีรายการที่เลยกำหนดปิดในขณะนี้.');

    renderTrend(rows); renderByDept(rows); renderStatus(rows); renderPyramid(rows);

    var attention=rows.filter(function(r){return (r.due&&r.due<today&&statusBucket(r.status)!=='closed')||classify(r.type,r.severity)==='losttime';})
      .sort(function(a,b){return (a.due||a.date)-(b.due||b.date);}).slice(0,8);
    q('#sfAttention').innerHTML=attention.length?attention.map(function(r){
      var lt=classify(r.type,r.severity)==='losttime';
      return '<div class="sf-att-card'+(lt?'':' warn')+'"><b>'+esc(r.project||r.department)+'</b>'+esc(r.finding||r.type||r.severity||'—')+(r.due?' · กำหนด '+fmt(r.due):'')+'</div>';
    }).join(''):'<div class="sf-empty">ไม่มีรายการที่ต้องติดตามด่วน</div>';

    var recent=rows.slice().sort(function(a,b){return b.date-a.date;}).slice(0,10);
    q('#sfRecent').innerHTML=recent.length?recent.map(function(r){
      return '<div class="sf-list"><b>'+esc(r.department)+'</b><span>'+esc(r.type||r.severity||'—')+'</span><span>'+fmt(r.date)+'</span></div>';
    }).join(''):'<div class="sf-empty">ไม่มีข้อมูล</div>';

    q('#sfUpdated').textContent='รอบข้อมูลถึง '+fmt(today)+' · '+rows.length.toLocaleString()+' รายการ';
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[Safety1]',e);}});
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
