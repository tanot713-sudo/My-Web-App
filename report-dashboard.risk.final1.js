/* FINAL 1 — Risk Control (new rich domain module, additive)
   Follows the exact pattern of report-dashboard.safety.final1.js: self-contained,
   own column-role detection, auto-activates only when the uploaded sheet looks like
   a risk register, inserts its own layout next to the existing Projects-section
   cards without touching them. Does NOT modify any existing file, hook, or the
   table renderer. Reuses the dropdown value "risk" already wired in both
   #dashboardTemplateSel and #domainOverrideSel — no HTML dropdown changes needed.

   ตามที่ผู้ใช้ขอ: เพิ่มตาราง JSA (Job Safety Analysis) — ความเสี่ยง/อันตราย, ประเภท, ความรุนแรง
   (เช่น catastrophic), มาตรการลดความเสี่ยง, ระดับความเสี่ยงที่ลดลง (residual), เอกสารอ้างอิง โดย
   ระดับความเสี่ยง = ความรุนแรง (severity) ไขว้กับความบ่อยของการเกิด (likelihood) ตาม Risk Matrix
   ด้านบน (คูณกันแบบมาตรฐาน severity × likelihood) */
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
    // บั๊กที่เจอ (Playwright): Number('')===0 (ไม่ใช่ NaN) ทำให้ข้อความที่ไม่มีตัวเลขเลย (เช่น ชื่อ, "N/A")
    // ถูกตีความเป็น 0 แทนที่จะเป็น "ไม่ใช่ตัวเลข" — ต้องเช็คว่ามีอย่างน้อย 1 หลักจริงๆ ก่อน
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
    // parser) ทำให้ข้อความรหัสอ้างอิงถูกเข้าใจผิดว่าเป็นวันที่ — จำกัดผลลัพธ์ให้อยู่ในช่วงปีที่สมเหตุสมผล
    // ของข้อมูลธุรกิจจริงเท่านั้น (1901-2200) นอกช่วงนี้ถือว่า parse ไม่ผ่าน
    var d=new Date(s);
    if(isNaN(d))return null;
    var yr=d.getFullYear();
    return (yr>=1901&&yr<=2200)?d:null;
  }
  var RK_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+RK_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}

  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  // ── แปลงคำ severity/likelihood แบบข้อความเป็นสเกล 1-5 (ถ้าคอลัมน์เป็นตัวเลขอยู่แล้วใช้ตรงๆ) ──
  var SEV_KW=[[5,['catastrophic','วิกฤต','ร้ายแรงที่สุด']],[4,['critical','ร้ายแรง','สูงมาก']],[3,['moderate','marginal','ปานกลาง']],[2,['minor','เล็กน้อย','น้อย']],[1,['negligible','ไม่มีนัยสำคัญ','น้อยมาก']]];
  var LIKE_KW=[[5,['almost certain','เกือบแน่นอน','เกิดขึ้นประจำ','บ่อยมาก']],[4,['likely','บ่อยครั้ง','บ่อย']],[3,['possible','ปานกลาง','เป็นครั้งคราว']],[2,['unlikely','นานๆครั้ง','นาน ๆ ครั้ง','เกิดขึ้นบ้าง']],[1,['rare','แทบไม่เกิด','ไม่ค่อยเกิด']]];
  function scaleFromText(v,map){
    var n=text(v).toLowerCase(); if(!n)return null;
    for(var i=0;i<map.length;i++){ if(map[i][1].some(function(k){return n.indexOf(k)>=0})) return map[i][0]; }
    return null;
  }
  function toScale5(v,map){
    var nv=num(v);
    if(nv!=null) return Math.max(1,Math.min(5,Math.round(nv)));
    return scaleFromText(v,map);
  }
  function sevTier(n){ return n>=5?'catastrophic':n===4?'critical':n>=2?'marginal':'negligible'; }
  var SEV_LABEL={catastrophic:'วิกฤต (Catastrophic)',critical:'ร้ายแรง (Critical)',marginal:'ปานกลาง (Marginal)',negligible:'เล็กน้อย (Negligible)'};
  function cellColor(score){
    if(score>=15)return '#B91C1C'; if(score>=10)return '#DC2626'; if(score>=6)return '#F59E0B'; if(score>=3)return '#EAB308'; return '#65A30D';
  }
  var PLAN_KW=['มีแผน','มีมาตรการ','has plan','planned','done','complete'];
  var NOPLAN_KW=['ยังไม่มีแผน','ไม่มีมาตรการ','no plan','pending','open'];
  function planBucket(v){
    var n=text(v).toLowerCase();
    if(NOPLAN_KW.some(function(k){return n.indexOf(k)>=0}))return 'noplan';
    if(PLAN_KW.some(function(k){return n.indexOf(k)>=0}))return 'plan';
    return n?'plan':'noplan'; // ถ้ามีข้อความสถานะอะไรก็ตามที่ไม่ใช่ "ยังไม่มี" ให้ถือว่ามีแผนแล้ว
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
      riskName: roleCol(st,['risk name','riskname','ความเสี่ยง/อันตราย','ความเสี่ยง','อันตราย']),
      riskCategory: roleCol(st,['risk category','riskcategory','ประเภทความเสี่ยง','หมวดความเสี่ยง']),
      severity: roleCol(st,['severity','impact','ความรุนแรง','ผลกระทบ']),
      likelihood: roleCol(st,['likelihood','probability','frequency','โอกาสเกิด','ความน่าจะเป็น','ความถี่']),
      riskLevel: roleCol(st,['risk level','risklevel','riskscore','riskrating','ระดับความเสี่ยง','คะแนนความเสี่ยง']),
      mitigation: roleCol(st,['mitigation','มาตรการ','แผนจัดการ','แผนรองรับ','แผนลดความเสี่ยง']),
      residual: roleCol(st,['residual','ระดับที่เหลือ','ความเสี่ยงที่ลดลง','หลังลดความเสี่ยง']),
      refDoc: roleCol(st,['reference','เอกสารอ้างอิง','อ้างอิง','document','sop']),
      status: roleCol(st,['status','สถานะ']),
      owner: roleCol(st,['risk owner','riskowner','ผู้รับผิดชอบ','owner']),
      date: roleCol(st,['identified date','date','วันที่ระบุ','วันที่บันทึก','วันที่พบ']),
      closeDate: roleCol(st,['closed date','mitigated date','วันที่ปิด','วันที่ควบคุม'])
    };
    // Activation gate: ต้องมีชื่อ/ประเภทความเสี่ยง ร่วมกับอย่างน้อยหนึ่งใน severity/likelihood/riskLevel
    if(!(c.riskName||c.riskCategory) || !(c.severity||c.likelihood||c.riskLevel)) return ov==='risk' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var rows=st.rows.map(function(r,i){
      var sevRaw=c.severity?r[c.severity.key]:null, likeRaw=c.likelihood?r[c.likelihood.key]:null;
      var sev=toScale5(sevRaw,SEV_KW)||3, like=toScale5(likeRaw,LIKE_KW)||3;
      var level = c.riskLevel?num(r[c.riskLevel.key]) : null;
      if(level==null) level = sev*like;
      return {
        raw:r, i:i,
        riskName: c.riskName?text(r[c.riskName.key]):('ความเสี่ยง #'+(i+1)),
        riskCategory: c.riskCategory?text(r[c.riskCategory.key])||'(ไม่ระบุ)':'(ไม่ระบุ)',
        severity: sev, severityText: c.severity?text(sevRaw):'',
        likelihood: like, likelihoodText: c.likelihood?text(likeRaw):'',
        level: level,
        mitigation: c.mitigation?text(r[c.mitigation.key]):'',
        residual: c.residual?text(r[c.residual.key]):'',
        refDoc: c.refDoc?text(r[c.refDoc.key]):'',
        status: c.status?text(r[c.status.key]):'',
        owner: c.owner?text(r[c.owner.key]):'',
        date: date(c.date?r[c.date.key]:null),
        closeDate: date(c.closeDate?r[c.closeDate.key]:null)
      };
    });
    if(rows.length<2) return ov==='risk' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c};
  }

  function injectCSS(){
    if(q('#risk1-css'))return;
    var s=document.createElement('style');s.id='risk1-css';s.textContent=`
#riskControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px;font-family:var(--pc53-font,inherit)}
#riskControlLayout .rk-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--sh)}
#riskControlLayout .rk-hero h2{font-size:16px;margin:0}
#riskControlLayout .rk-hero .rk-sub{font-size:12px;color:var(--muted);margin-top:3px}
#riskControlLayout .rk-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#riskControlLayout .rk-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:var(--sh);position:relative}
#riskControlLayout .rk-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--ok)}
#riskControlLayout .rk-kpi.warn:after{background:var(--warn)}#riskControlLayout .rk-kpi.bad:after{background:var(--err)}
#riskControlLayout .rk-kpi .l{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#riskControlLayout .rk-kpi .v{font-size:22px;font-weight:850;margin-top:4px;color:var(--ink)}
#riskControlLayout .rk-kpi.warn .v{color:#B8720A}#riskControlLayout .rk-kpi.bad .v{color:var(--err)}
#riskControlLayout .rk-kpi .s{font-size:9.5px;color:var(--muted);margin-top:4px}
#riskControlLayout .rk-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--sh)}
#riskControlLayout .rk-panel h3{font-size:13px;margin:0 0 3px;font-weight:850}
#riskControlLayout .rk-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}
#riskControlLayout .rk-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#riskControlLayout .rk-grid>.half{grid-column:span 6}#riskControlLayout .rk-grid>.full{grid-column:1/-1}
#riskControlLayout .rk-insight{border-left:3px solid var(--ok);padding:10px 13px;font-size:12px;color:var(--ink)}
#riskControlLayout .rk-matrix{display:grid;grid-template-columns:60px repeat(5,1fr);gap:3px}
#riskControlLayout .rk-matrix .ax{display:flex;align-items:center;justify-content:center;font-size:9.5px;color:var(--muted);font-weight:700}
#riskControlLayout .rk-matrix .cell{border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;min-height:40px}
#riskControlLayout .rk-status-row{display:flex;flex-direction:column;gap:8px}
#riskControlLayout .rk-status-item{display:grid;grid-template-columns:120px 1fr 30px;align-items:center;gap:9px;font-size:11px}
#riskControlLayout .rk-status-item .lab{display:flex;align-items:center;gap:6px;font-weight:700}
#riskControlLayout .rk-status-item i{width:8px;height:8px;border-radius:50%;display:inline-block}
#riskControlLayout .rk-track{height:7px;border-radius:6px;background:#eef1f4;overflow:hidden}
#riskControlLayout .rk-track span{display:block;height:100%;border-radius:6px}
#riskControlLayout .rk-empty{padding:24px 8px;text-align:center;color:var(--muted);font-size:11px}
#riskControlLayout svg text{font-family:var(--pc53-font,inherit)}
#riskControlLayout .rk-trend-scroll{overflow-x:auto}
#riskControlLayout .rk-table-wrap{overflow-x:auto}
#riskControlLayout .rk-table{width:100%;border-collapse:collapse;font-size:11.5px;min-width:980px}
#riskControlLayout .rk-table thead th{text-align:left;font-weight:800;color:var(--muted);font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;padding:0 10px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
#riskControlLayout .rk-table tbody td{padding:9px 10px;border-bottom:1px solid var(--line);color:var(--ink);vertical-align:top}
#riskControlLayout .rk-table tbody tr:last-child td{border-bottom:none}
#riskControlLayout .rk-sev{display:inline-flex;align-items:center;font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;color:#fff}
#riskControlLayout .rk-sev.catastrophic{background:#7F1D1D}#riskControlLayout .rk-sev.critical{background:#DC2626}#riskControlLayout .rk-sev.marginal{background:#F59E0B}#riskControlLayout .rk-sev.negligible{background:#65A30D}
#riskControlLayout .rk-donut-wrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
#riskControlLayout .rk-donut-legend{display:flex;flex-direction:column;gap:10px;justify-content:center;flex:1;min-width:150px}
#riskControlLayout .rk-donut-legend .row{display:flex;align-items:center;gap:8px;font-size:11.5px}
#riskControlLayout .rk-donut-legend i{width:10px;height:10px;border-radius:3px;display:inline-block;flex:none}
#riskControlLayout.risk-override-hidden{display:none!important}
.risk-hidden-source{display:none!important}
@media(max-width:1100px){#riskControlLayout .rk-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#riskControlLayout .rk-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#riskControlLayout .rk-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#riskControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='riskControlLayout';
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    layout.innerHTML=
      '<section class="rk-hero"><h2>⚠️ Risk Control</h2><div class="rk-sub" id="rkUpdated">ภาพรวมทะเบียนความเสี่ยง, Risk Matrix และสถานะมาตรการจัดการ</div></section>'+
      '<div class="rk-kpis" id="rkKpis"></div>'+
      '<section class="rk-panel rk-insight-panel"><h3>Executive Insight</h3><div id="rkInsight" class="rk-insight"></div></section>'+
      '<div class="rk-grid">'+
        '<section class="rk-panel full"><h3>🔥 Risk Matrix (โอกาสเกิด × ความรุนแรง)</h3><div class="rk-note">ตัวเลขในช่อง = จำนวนความเสี่ยง · สีเข้ม = คะแนนความเสี่ยงสูง</div><div id="rkMatrix"></div></section>'+
        '<section class="rk-panel full" id="rkTrendSection"><h3>แนวโน้มความเสี่ยงรายเดือน</h3><div class="rk-note">ระบุใหม่ vs ปิด/ควบคุมแล้ว</div><div id="rkTrend"></div></section>'+
        '<section class="rk-panel half"><h3>ความเสี่ยงแยกตามประเภท</h3><div class="rk-note">จำนวนรายการต่อประเภท</div><div id="rkCategory"></div></section>'+
        '<section class="rk-panel half"><h3>สถานะมาตรการจัดการ</h3><div class="rk-note">มีแผนแล้ว / ยังไม่มีแผน</div><div id="rkStatus"></div></section>'+
        '<section class="rk-panel full"><h3>🗂 ทะเบียนความเสี่ยงแบบ JSA</h3><div class="rk-note">Job Safety Analysis — ระดับความเสี่ยง = ความรุนแรงไขว้กับความบ่อยที่เกิด</div><div id="rkJsa"></div></section>'+
      '</div>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">ตรวจพบจากคอลัมน์ ความเสี่ยง/ประเภท + ความรุนแรง/โอกาสเกิด ในไฟล์ที่อัปโหลด — Table ด้านล่างไม่ถูกแก้ไข</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('risk-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function renderMatrix(rows){
    var host=q('#rkMatrix'); if(!host)return;
    var matrix=[[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]]; // [impact-1][likelihood-1]
    rows.forEach(function(r){ matrix[r.severity-1][r.likelihood-1]++; });
    var html='<div class="rk-matrix"><div></div>';
    html+='<div class="ax">1</div><div class="ax">2</div><div class="ax">3</div><div class="ax">4</div><div class="ax">5</div>';
    for(var impact=5;impact>=1;impact--){
      html+='<div class="ax">'+impact+'</div>';
      for(var like=1;like<=5;like++){
        var cnt=matrix[impact-1][like-1], score=impact*like;
        html+='<div class="cell" style="background:'+(cnt>0?cellColor(score):'#EEF1F4')+';color:'+(cnt>0?'#fff':'#c7cdd3')+'">'+(cnt||'')+'</div>';
      }
    }
    html+='</div><div style="display:flex;font-size:9.5px;color:var(--muted);margin-top:4px"><div style="width:60px"></div><div style="flex:1;text-align:center">โอกาสเกิด (1=น้อย → 5=มาก) &nbsp;·&nbsp; แกนตั้ง = ความรุนแรง (1=น้อย → 5=มาก)</div></div>';
    host.innerHTML=html;
  }

  function renderTrend(rows){
    var host=q('#rkTrend'); var sec=q('#rkTrendSection'); if(!host)return;
    if(!rows.some(function(r){return r.date;})){ sec&&sec.setAttribute('hidden',''); return; }
    sec&&sec.removeAttribute('hidden');
    var byMonth={};
    rows.forEach(function(r){ if(!r.date)return; var k=monthKey(r.date); if(!byMonth[k])byMonth[k]={n:0,c:0}; byMonth[k].n++; if(r.closeDate)byMonth[monthKey(r.closeDate)]=byMonth[monthKey(r.closeDate)]||{n:0,c:0},byMonth[monthKey(r.closeDate)].c++; });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="rk-empty">ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)</div>';return;}
    var perM=64,left=40,right=30,top=14,bottom=26,ph=170;
    var w=Math.max(400,left+right+(keys.length-1)*perM), h=top+ph+bottom, pw=w-left-right;
    var maxV=1; keys.forEach(function(k){maxV=Math.max(maxV,byMonth[k].n,byMonth[k].c);});
    maxV=Math.ceil(maxV*1.15)||1;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e9edf1" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8a97a3">'+Math.round(val)+'</text>';
    }
    var stepX=pw/(keys.length-1||1);
    [['n','#DC2626'],['c','#16A34A']].forEach(function(cat){
      var pts=keys.map(function(k,i){var v=byMonth[k][cat[0]]||0; return (left+stepX*i)+','+(top+ph-ph*v/maxV);});
      out+='<path d="M'+pts.join(' L')+'" fill="none" stroke="'+cat[1]+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      keys.forEach(function(k,i){var v=byMonth[k][cat[0]]||0; out+='<circle cx="'+(left+stepX*i)+'" cy="'+(top+ph-ph*v/maxV)+'" r="3" fill="'+cat[1]+'" stroke="#fff" stroke-width="1.2"/>';});
    });
    keys.forEach(function(k,i){ out+='<text x="'+(left+stepX*i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="#8a97a3">'+k+'</text>'; });
    out+='</svg>';
    host.innerHTML='<div class="rk-trend-scroll">'+out+'</div><div class="mini" style="display:flex;gap:14px;font-size:10.5px;color:var(--muted);margin-top:4px"><span>● <span style="color:#DC2626">ระบุใหม่</span></span><span>● <span style="color:#16A34A">ปิด/ควบคุมแล้ว</span></span></div>';
  }

  // โดนัทชาร์ต — ตามที่ผู้ใช้ขอให้ใช้ที่จุด "ความเสี่ยงแยกตามประเภท"
  function donutChart(entries, centerLabel){
    var size=168, thick=24, r=(size-thick)/2, c=size/2, circ=2*Math.PI*r;
    var total=entries.reduce(function(s,e){return s+e[1];},0)||1;
    var offset=0, segs='';
    entries.forEach(function(e){
      var len=circ*(e[1]/total);
      segs+='<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+e[2]+'" stroke-width="'+thick+'" stroke-dasharray="'+len+' '+(circ-len)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 '+c+' '+c+')"/>';
      offset+=len;
    });
    var svg='<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" role="img" style="flex:none">'+segs+
      '<circle cx="'+c+'" cy="'+c+'" r="'+(r-thick/2-3)+'" fill="#FFFFFF"/>'+
      '<text x="'+c+'" y="'+(c-3)+'" text-anchor="middle" font-size="21" font-weight="850" fill="#101820">'+total+'</text>'+
      '<text x="'+c+'" y="'+(c+16)+'" text-anchor="middle" font-size="9.5" fill="#4B5763">'+esc(centerLabel)+'</text>'+
    '</svg>';
    var legend='<div class="rk-donut-legend">'+entries.map(function(e){
      var pct=(e[1]/total*100).toFixed(0);
      return '<div class="row"><i style="background:'+e[2]+'"></i><span style="flex:1">'+esc(e[0])+'</span><b>'+e[1]+'</b><span style="color:var(--muted);width:32px;text-align:right">'+pct+'%</span></div>';
    }).join('')+'</div>';
    return '<div class="rk-donut-wrap">'+svg+legend+'</div>';
  }

  var DONUT_PALETTE=['#1C5CAB','#7C3AED','#0EA5E9','#F59E0B','#94A3B8','#16A34A','#DC2626'];
  function renderCategory(rows){
    var host=q('#rkCategory'); if(!host)return;
    var map={}; rows.forEach(function(r){ map[r.riskCategory]=(map[r.riskCategory]||0)+1; });
    var entries=Object.keys(map).map(function(k,i){return [k,map[k],DONUT_PALETTE[i%DONUT_PALETTE.length]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    host.innerHTML=entries.length?donutChart(entries,'ความเสี่ยงทั้งหมด'):'<div class="rk-empty">ไม่มีข้อมูล</div>';
  }

  function renderStatus(rows){
    var host=q('#rkStatus'); if(!host)return;
    var withPlan=0,noPlan=0;
    rows.forEach(function(r){ if(planBucket(r.mitigation||r.status)==='plan')withPlan++; else noPlan++; });
    var total=Math.max(1,rows.length);
    var vals=[['plan','มีแผนจัดการแล้ว',withPlan,'#16A34A'],['noplan','ยังไม่มีแผน',noPlan,'#F59E0B']];
    var out='<div class="rk-status-row">';
    vals.forEach(function(v){
      var pct=(v[2]/total*100).toFixed(0);
      out+='<div class="rk-status-item"><span class="lab"><i style="background:'+v[3]+'"></i>'+v[1]+'</span><div class="rk-track"><span style="width:'+pct+'%;background:'+v[3]+'"></span></div><b>'+v[2]+'</b></div>';
    });
    out+='</div>';
    host.innerHTML=out;
    return noPlan;
  }

  function renderJsa(rows){
    var host=q('#rkJsa'); if(!host)return;
    var top=rows.slice().sort(function(a,b){return b.level-a.level;}).slice(0,12);
    if(!top.length){host.innerHTML='<div class="rk-empty">ไม่มีข้อมูล</div>';return;}
    var html='<div class="rk-table-wrap"><table class="rk-table"><thead><tr>'+
      '<th>ความเสี่ยง/อันตราย</th><th>ประเภท</th><th>ความรุนแรง</th><th>โอกาสเกิด</th><th>ระดับความเสี่ยง</th><th>มาตรการลดความเสี่ยง</th><th>ระดับที่เหลือหลังลด</th><th>เอกสารอ้างอิง</th>'+
    '</tr></thead><tbody>'+
    top.map(function(r){
      var tier=sevTier(r.severity);
      var likeLabel=r.likelihoodText||(r.likelihood+'/5');
      return '<tr><td><b>'+esc(r.riskName)+'</b></td><td>'+esc(r.riskCategory)+'</td>'+
        '<td><span class="rk-sev '+tier+'">'+esc(SEV_LABEL[tier])+'</span></td>'+
        '<td>'+esc(likeLabel)+'</td><td><b>'+r.level+'</b></td>'+
        '<td>'+esc(r.mitigation||'—')+'</td>'+
        '<td style="color:var(--ok);font-weight:700">'+esc(r.residual||'—')+'</td>'+
        '<td style="color:var(--muted);font-family:var(--ui-font-mono,monospace);white-space:nowrap">'+esc(r.refDoc||'—')+'</td></tr>';
    }).join('')+
    '</tbody></table></div>';
    host.innerHTML=html;
  }

  function suppressLayout(){
    var layout=q('#riskControlLayout');
    if(layout) layout.classList.add('risk-override-hidden');
    qa('.risk-hidden-source').forEach(function(e){ e.classList.remove('risk-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้ */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='risk'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'riskControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="rk-panel"><h3>⚠️ Risk Control</h3>'+
      '<div class="rk-empty">ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่ายทะเบียนความเสี่ยง (ต้องมีคอลัมน์ '+
      'ความเสี่ยง/ประเภท ร่วมกับ ความรุนแรง/โอกาสเกิด/ระดับความเสี่ยง) — ลองเลือก Template เป็น "Auto" '+
      'หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('risk-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='risk'){ suppressLayout(); return; }
    var scl=q('#riskControlLayout'); if(scl) scl.classList.remove('risk-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='riskControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='riskControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows;
    var high=rows.filter(function(r){return r.level>=15;}).length;
    var avgScore=rows.reduce(function(s,r){return s+r.level;},0)/rows.length;

    q('#rkKpis').innerHTML=
      '<div class="rk-kpi"><div class="l">ความเสี่ยงทั้งหมด</div><div class="v">'+rows.length+'</div><div class="s">รายการที่บันทึก</div></div>'+
      '<div class="rk-kpi'+(high?' bad':'')+'"><div class="l">ระดับสูง/วิกฤต</div><div class="v">'+high+'</div><div class="s">คะแนน ≥ 15</div></div>';
    // withPlan/noPlan คำนวณใน renderStatus แล้วนำมาต่อ KPI ด้วย
    var withPlan=rows.filter(function(r){return planBucket(r.mitigation||r.status)==='plan';}).length;
    var noPlan=rows.length-withPlan;
    q('#rkKpis').innerHTML+=
      '<div class="rk-kpi"><div class="l">มีแผนจัดการแล้ว</div><div class="v">'+withPlan+'</div><div class="s">รายการ</div></div>'+
      '<div class="rk-kpi'+(noPlan?' warn':'')+'"><div class="l">ยังไม่มีแผน</div><div class="v">'+noPlan+'</div><div class="s">ต้องติดตาม</div></div>'+
      '<div class="rk-kpi"><div class="l">คะแนนเฉลี่ย</div><div class="v">'+avgScore.toFixed(1)+'</div><div class="s">จาก 25 คะแนนเต็ม</div></div>';

    var statusText=high?'ควรทบทวนความเสี่ยงระดับสูง':noPlan?'ควรเร่งจัดทำแผนจัดการ':'อยู่ในเกณฑ์ปกติ';
    q('#rkInsight').innerHTML='สถานะโดยรวม <b>'+statusText+'</b> — พบความเสี่ยง <b>'+high+' รายการ</b> ที่คะแนนอยู่ในระดับวิกฤต (≥15)'+(noPlan?' และมี <b>'+noPlan+' รายการ</b> ที่ยังไม่มีมาตรการจัดการ':'')+'.';

    renderMatrix(rows); renderTrend(rows); renderCategory(rows); renderStatus(rows); renderJsa(rows);

    var today=new Date();
    q('#rkUpdated').textContent='รอบข้อมูลถึง '+fmt(today)+' · '+rows.length.toLocaleString()+' รายการ';
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[Risk1]',e);}});
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
