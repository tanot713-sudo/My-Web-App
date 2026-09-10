/* FINAL 1 — Organizational Dashboard (new domain, additive)
   Same plug-in architecture as report-dashboard.hr.final1.js / safety.final1.js / final62.projectcontrol.js
   (self-contained IIFE, injects its own layout before #domainDashboardCard, mutual exclusion via
   window.__tdDomainRegistry). ตามที่ผู้ใช้ขอ: แปลจากไฟล์ HTML แบบสแตนด์อโลนที่ส่งมา (org chart + employee
   directory + analytics) ให้ทำงานแบบ "อัปโหลด Excel แล้วเดาคอลัมน์เอา" เหมือน 10 แม่แบบเดิมในหน้านี้
   แทนที่จะ hardcode โครงสร้างองค์กร/ดึงข้อมูลจาก Google Apps Script อย่างต้นฉบับ — ผังองค์กรตอนนี้สร้างจาก
   คอลัมน์ "หัวหน้า/รหัสหัวหน้า" ในไฟล์ที่อัปโหลดแทน (ตามที่ผู้ใช้เลือกไว้ตอนคุยกัน) */
(function(){
  'use strict';
  var raf=0, scheduled=false, bootAttempts=0;
  var MSHOW=false, PIISHOW=false, curId=null;
  function q(s,r){return (r||document).querySelector(s)}
  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function text(v){return String(v==null?'':v).trim()}
  function esc(v){var d=document.createElement('div');d.textContent=text(v);return d.innerHTML}
  function num(v){var n=parseFloat(v);return isFinite(n)?n:null}
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
  var ORG1_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+ORG1_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthsBetween(a,b){ if(!a||!b)return null; return (b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth()); }
  function fyr(m){if(m==null)return '—';var y=Math.floor(m/12),mm=m%12;return y?(y+' yr'+(mm?' '+mm+' mo':'')):(mm+' mo');}
  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  /* =============== palette (คงที่ต่อ session เดียว ไม่ผูกกับ ORG hardcode แบบต้นฉบับ — สุ่ม/ไล่ตามลำดับ
     ทีมที่เจอจริงในไฟล์ที่อัปโหลด) =============== */
  var PAL={blue:'#2F6BF0',green:'#1FA85C',amber:'#F5A623',purple:'#7C5CF5',teal:'#12B5A6',pink:'#EC4899',
    orange:'#F97316',cyan:'#0EA5E9',rose:'#E11D48',lime:'#65A30D',indigo:'#4F46E5',red:'#EF3B41'};
  var SERIES=[PAL.blue,PAL.green,PAL.amber,PAL.purple,PAL.teal,PAL.pink,PAL.orange,PAL.cyan,PAL.rose,PAL.lime,PAL.indigo];
  function tint(h,a){var n=parseInt((h||'#94A3B8').slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';}
  function shade(h){var n=parseInt((h||'#94A3B8').slice(1),16),r=Math.round((n>>16&255)*.72),
    g=Math.round((n>>8&255)*.72),b=Math.round((n&255)*.72);
    return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}
  function initials(n){var p=text(n).split(/\s+/);return ((p[0]||'').charAt(0)+((p[1]||'').charAt(0)||'')).toUpperCase()||'?';}

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
      id: roleCol(st,['employee id','emp id','staff id','รหัสพนักงาน']),
      name: roleCol(st,['employee name','full name','name','ชื่อ-นามสกุล','ชื่อพนักงาน','ชื่อ']),
      nick: roleCol(st,['nickname','nick name','nick','ชื่อเล่น']),
      position: roleCol(st,['position','job title','title','ตำแหน่ง']),
      level: roleCol(st,['job level','level','band','grade','ระดับตำแหน่ง','ระดับ']),
      team: roleCol(st,['team','department','dept','division','แผนก','ทีม','สายงาน','หน่วยงาน']),
      system: roleCol(st,['system','ระบบงาน','ระบบ']),
      site: roleCol(st,['work site','site','location','พื้นที่ปฏิบัติงาน','พื้นที่','สถานที่']),
      start: roleCol(st,['start date','join date','hire date','date of joining','วันที่เริ่มงาน','เริ่มงาน','วันเข้างาน']),
      managerId: roleCol(st,['manager id','supervisor id','reports to id','รหัสหัวหน้า']),
      managerName: roleCol(st,['manager name','manager','supervisor','reports to','หัวหน้างาน','หัวหน้า','ผู้บังคับบัญชา']),
      dob: roleCol(st,['date of birth','dob','birthday','วันเกิด']),
      email: roleCol(st,['email','อีเมล']),
      phone: roleCol(st,['phone','tel','mobile','เบอร์โทร']),
      gender: roleCol(st,['gender','sex','เพศ']),
      status: roleCol(st,['employment status','status','สถานะ'])
    };
    // Activation gate: needs a name column plus at least one of team/position/manager — a generic
    // table with none of those isn't people/org data.
    if(!c.name || !(c.team||c.position||c.managerId||c.managerName)) return ov==='organizational' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var today=new Date(); today.setHours(0,0,0,0);
    var rows=st.rows.map(function(r,i){
      var start=date(c.start?r[c.start.key]:null), dob=date(c.dob?r[c.dob.key]:null);
      return {
        raw:r,i:i,
        id: c.id?text(r[c.id.key]):('#'+(i+1)),
        name: c.name?text(r[c.name.key]):('Employee #'+(i+1)),
        nick: c.nick?text(r[c.nick.key]):'',
        position: c.position?text(r[c.position.key]):'',
        level: c.level?text(r[c.level.key]):(c.position?text(r[c.position.key]):''),
        team: (c.team?text(r[c.team.key]):'')||'(Unassigned)',
        system: c.system?text(r[c.system.key]):'',
        site: c.site?text(r[c.site.key]):'',
        start: start,
        managerId: c.managerId?text(r[c.managerId.key]):'',
        managerName: c.managerName?text(r[c.managerName.key]):'',
        dob: dob,
        email: c.email?text(r[c.email.key]):'',
        phone: c.phone?text(r[c.phone.key]):'',
        gender: c.gender?text(r[c.gender.key]):'',
        status: c.status?text(r[c.status.key]):'',
        svcM: start?monthsBetween(start,today):null,
        ageM: dob?monthsBetween(dob,today):null
      };
    }).filter(function(r){return r.name;});
    if(rows.length<2) return ov==='organizational' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c, hasManager: !!(c.managerId||c.managerName)};
  }

  function injectCSS(){
    if(q('#org1-css'))return;
    var s=document.createElement('style');s.id='org1-css';s.textContent=`
#organizationalLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px}
#organizationalLayout .org1-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--sh)}
#organizationalLayout .org1-hero h2{font-size:16px;margin:0}
#organizationalLayout .org1-hero .org1-sub{font-size:12px;color:var(--muted);margin-top:3px}
#organizationalLayout .org1-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#organizationalLayout .org1-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:var(--sh);position:relative}
#organizationalLayout .org1-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--brand)}
#organizationalLayout .org1-kpi .l{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}
#organizationalLayout .org1-kpi .v{font-size:24px;font-weight:850;margin-top:4px;color:var(--ink)}
#organizationalLayout .org1-kpi .s{font-size:9.5px;color:var(--muted);margin-top:4px}
#organizationalLayout .org1-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;box-shadow:var(--sh)}
#organizationalLayout .org1-panel h3{font-size:13px;margin:0 0 3px;font-weight:850}
#organizationalLayout .org1-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}
#organizationalLayout .org1-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#organizationalLayout .org1-grid>.half{grid-column:span 6}#organizationalLayout .org1-grid>.full{grid-column:1/-1}
#organizationalLayout .org1-empty{padding:24px 8px;text-align:center;color:var(--muted);font-size:11px}
#organizationalLayout.org1-override-hidden{display:none!important}
.org1-hidden-source{display:none!important}
/* directory cards */
#organizationalLayout .org1-dir-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
#organizationalLayout .org1-pc{background:var(--bg);border:1px solid var(--line);border-radius:13px;padding:14px 10px;text-align:center;cursor:pointer;transition:transform .15s,box-shadow .15s}
#organizationalLayout .org1-pc:hover{transform:translateY(-2px);box-shadow:var(--sh)}
#organizationalLayout .org1-avc{width:56px;height:56px;border-radius:50%;margin:0 auto 8px;display:grid;place-items:center;font-weight:800;color:#fff;font-size:17px}
#organizationalLayout .org1-pc .nm{font-size:11.5px;font-weight:700;color:var(--ink);line-height:1.3}
#organizationalLayout .org1-pc .rl{font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.3}
#organizationalLayout .org1-pc .tm{display:inline-block;margin-top:7px;font-size:9.5px;font-weight:700;padding:2.5px 7px;border-radius:6px}
/* org tree (generic recursive, works at any depth) */
#organizationalLayout .org1-ocwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:12px 8px 16px}
#organizationalLayout .org1-tree{width:fit-content;min-width:100%;display:flex;justify-content:center}
#organizationalLayout .org1-tree ul{display:flex;justify-content:center;position:relative;padding:20px 0 0;margin:0;list-style:none}
#organizationalLayout .org1-tree li{position:relative;padding:20px 8px 0;list-style:none;display:flex;flex-direction:column;align-items:center}
#organizationalLayout .org1-tree li::before,#organizationalLayout .org1-tree li::after{content:'';position:absolute;top:0;right:50%;border-top:2px solid var(--line);width:50%;height:20px}
#organizationalLayout .org1-tree li::after{right:auto;left:50%;border-left:2px solid var(--line)}
#organizationalLayout .org1-tree li:only-child::before,#organizationalLayout .org1-tree li:only-child::after{display:none}
#organizationalLayout .org1-tree li:first-child::before{border:0}
#organizationalLayout .org1-tree li:last-child::after{border:0}
#organizationalLayout .org1-tree li:last-child::before{border-right:2px solid var(--line);border-radius:0 8px 0 0}
#organizationalLayout .org1-tree li:first-child::after{border-radius:8px 0 0 0}
#organizationalLayout .org1-tree>ul>li{padding-top:0}
#organizationalLayout .org1-tree>ul>li::before,#organizationalLayout .org1-tree>ul>li::after{display:none}
#organizationalLayout .org1-onode{background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:8px 12px;min-width:150px;text-align:center;box-shadow:var(--sh);cursor:pointer}
#organizationalLayout .org1-onode .r{font-size:9.5px;font-weight:700;color:var(--muted);letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#organizationalLayout .org1-onode .n{font-size:12px;font-weight:700;margin-top:2px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#organizationalLayout .org1-onode .t{font-size:9.5px;color:var(--muted);margin-top:1px}
#organizationalLayout .org1-onode.top{color:#fff;min-width:170px}
#organizationalLayout .org1-onode.top .r,#organizationalLayout .org1-onode.top .n{color:#fff}
/* horizontal bars (reused pattern from other domain modules) */
#organizationalLayout .org1-hbars{display:flex;flex-direction:column;gap:7px}
#organizationalLayout .org1-hbrow{display:grid;grid-template-columns:minmax(76px,32%) 1fr 28px;gap:8px;align-items:center;cursor:pointer}
#organizationalLayout .org1-hb-l{font-size:11px;font-weight:600;color:var(--muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#organizationalLayout .org1-hb-t{height:20px;border-radius:7px;background:var(--bg);overflow:hidden}
#organizationalLayout .org1-hb-t span{display:block;height:100%;border-radius:7px}
#organizationalLayout .org1-hb-v{font-size:11.5px;font-weight:700}
/* employee table */
#organizationalLayout .org1-tbl-wrap{overflow:auto;border-radius:12px;border:1px solid var(--line)}
#organizationalLayout table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}
#organizationalLayout thead th{background:var(--bg);color:var(--muted);font-weight:700;font-size:10.5px;text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);cursor:pointer;user-select:none}
#organizationalLayout thead th:hover{color:var(--ink)}
#organizationalLayout thead th.srt{color:var(--brand)}
#organizationalLayout tbody td{padding:8px 10px;border-bottom:1px solid var(--line);color:var(--muted)}
#organizationalLayout tbody tr{cursor:pointer}
#organizationalLayout tbody tr:hover td{background:var(--bg)}
#organizationalLayout tbody tr:last-child td{border-bottom:0}
#organizationalLayout td.b{color:var(--ink);font-weight:600}
#organizationalLayout .org1-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:7px}
/* profile modal */
#org1Mdl{display:none;position:fixed;inset:0;z-index:4200;background:rgba(16,24,40,.5);align-items:center;justify-content:center;padding:16px}
#org1Mdl.on{display:flex}
#org1Mbox{background:var(--card);border-radius:18px;width:100%;max-width:400px;max-height:90vh;overflow:auto;box-shadow:0 30px 70px rgba(16,24,40,.32);position:relative}
#org1Mtop{padding:26px 18px 20px;text-align:center;color:#fff}
#org1Mtop .org1-avc{width:96px;height:96px;font-size:30px;margin:0 auto 12px;border:4px solid rgba(255,255,255,.36)}
#org1Mtop h2{margin:0;font-size:17px;font-weight:700;color:#fff}
#org1Mtop p{margin:3px 0 0;font-size:11.5px;opacity:.9;color:#fff}
#org1Mbody{padding:4px 16px 16px}
#organizationalLayout .org1-mr,#org1Mbody .org1-mr{display:flex;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line);font-size:12px}
#org1Mbody .org1-mr:last-child{border-bottom:0}
#org1Mbody .org1-mr .l{width:96px;color:var(--muted);font-weight:500;flex:none}
#org1Mbody .org1-mr .v{color:var(--ink);font-weight:600;word-break:break-word}
#org1Mclose{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:9px;border:0;background:rgba(255,255,255,.22);color:#fff;cursor:pointer;font-size:16px;line-height:1}
#org1Mbody .org1-reveal{margin-top:10px;width:100%;justify-content:center}
@media(max-width:1100px){#organizationalLayout .org1-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#organizationalLayout .org1-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#organizationalLayout .org1-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#organizationalLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='organizationalLayout';
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function injectModal(){
    if(q('#org1Mdl'))return;
    var d=document.createElement('div'); d.id='org1Mdl';
    d.innerHTML='<div id="org1Mbox"><button id="org1Mclose" type="button">×</button><div id="org1Mtop"></div><div id="org1Mbody"></div></div>';
    d.addEventListener('click',function(e){ if(e.target===d) closeM(); });
    document.body.appendChild(d);
    q('#org1Mclose').addEventListener('click',closeM);
  }
  function closeM(){ var d=q('#org1Mdl'); if(d) d.classList.remove('on'); }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    layout.innerHTML=
      '<section class="org1-hero"><h2>🏢 Organizational Dashboard</h2><div class="org1-sub" id="org1Updated">Workforce overview, org chart, and employee directory</div></section>'+
      '<div class="org1-kpis" id="org1Kpis"></div>'+
      '<div id="org1TreeSection"></div>'+
      '<div class="org1-grid">'+
        '<section class="org1-panel half"><h3>Headcount by Team</h3><div class="org1-note">Click a bar to filter the table below</div><div id="org1ByTeam"></div></section>'+
        '<section class="org1-panel half" id="org1BySiteCard"><h3>Headcount by Site</h3><div class="org1-note">Work locations</div><div id="org1BySite"></div></section>'+
        '<section class="org1-panel full" id="org1ByLevelCard"><h3 id="org1ByLevelTitle">Headcount by Level</h3><div class="org1-note">Job level / position mix</div><div id="org1ByLevel"></div></section>'+
      '</div>'+
      '<section class="org1-panel"><h3>👥 Employee Directory</h3><div class="org1-note">Click a card to view full profile</div><div class="org1-dir-grid" id="org1Dir"></div></section>'+
      '<section class="org1-panel"><h3>📋 All Employees</h3><div class="org1-note" id="org1TblNote"></div><div class="org1-tbl-wrap" id="org1Tbl"></div></section>'+
      '<div class="mini" style="font-size:9px;color:var(--muted)">Detected from a Name column plus Team/Position/Manager in the uploaded file — the Table tab is not affected</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('org1-hidden-source');
    });
    injectModal();
    return true;
  }

  /* =============== small SVG bar list (matches HR/Safety/ProjectControl's own inline-SVG-free
     HTML+CSS bar style, no Chart.js dependency) =============== */
  var FILTER_KEY=null, FILTER_VAL=null;
  function hbars(hostId, items, opts){
    var host=q(hostId); if(!host)return;
    opts=opts||{};
    if(!items.length){ host.innerHTML='<div class="org1-empty">No data</div>'; return; }
    var max=Math.max.apply(null,items.map(function(i){return i.value;}))||1;
    host.innerHTML='<div class="org1-hbars">'+items.map(function(it,i){
      var col=it.color||SERIES[i%SERIES.length];
      var active=FILTER_KEY===opts.fk&&FILTER_VAL===it.label;
      return '<div class="org1-hbrow" data-fk="'+esc(opts.fk||'')+'" data-fv="'+esc(it.label)+'" title="'+esc(it.label)+': '+it.value+'">'+
        '<div class="org1-hb-l">'+esc(it.label)+'</div>'+
        '<div class="org1-hb-t"><span style="width:'+Math.max(3,it.value/max*100)+'%;background:'+col+(active?';outline:2px solid '+col+';outline-offset:1px':'')+'"></span></div>'+
        '<div class="org1-hb-v" style="color:'+col+'">'+it.value+'</div></div>';
    }).join('')+'</div>';
    qa('.org1-hbrow',host).forEach(function(row){
      row.addEventListener('click',function(){
        var fk=row.getAttribute('data-fk'), fv=row.getAttribute('data-fv');
        if(FILTER_KEY===fk&&FILTER_VAL===fv){FILTER_KEY=null;FILTER_VAL=null;} else {FILTER_KEY=fk;FILTER_VAL=fv;}
        schedule();
      });
    });
  }
  function cnt(rows,key){
    var m={}; rows.forEach(function(r){ var v=r[key]; if(!v)return; (m[v]=m[v]||[]).push(r); });
    return Object.keys(m).map(function(k){return {label:k,value:m[k].length,rows:m[k]};})
      .sort(function(a,b){return b.value-a.value;});
  }

  /* =============== org tree =============== */
  function buildForest(rows){
    var byId={}; rows.forEach(function(r){ if(r.id) byId[r.id]=r; });
    var byNameLc={}; rows.forEach(function(r){ if(r.name) byNameLc[r.name.toLowerCase()]=r; });
    rows.forEach(function(r){
      var mgr=null;
      if(r.managerId && byId[r.managerId] && byId[r.managerId]!==r) mgr=byId[r.managerId];
      else if(r.managerName && byNameLc[r.managerName.toLowerCase()] && byNameLc[r.managerName.toLowerCase()]!==r) mgr=byNameLc[r.managerName.toLowerCase()];
      r._mgr=mgr;
    });
    var childrenOf={};
    function keyOf(r){ return r.id||r.name; }
    rows.forEach(function(r){ if(r._mgr){ var k=keyOf(r._mgr); (childrenOf[k]=childrenOf[k]||[]).push(r); } });
    var roots=rows.filter(function(r){ return !r._mgr; });
    return { roots:roots, childrenOf:childrenOf, keyOf:keyOf };
  }
  function orgNode(r,cls){
    var col=SERIES[Math.abs(hashStr(r.team))%SERIES.length];
    return '<div class="org1-onode'+(cls?' '+cls:'')+'" style="'+
      (cls==='top'?'background:linear-gradient(135deg,'+col+','+shade(col)+')':'border-color:'+tint(col,.5))+'" data-emp="'+esc(r.id||r.name)+'">'+
      '<div class="r">'+esc(r.position||r.level||'')+'</div>'+
      '<div class="n">'+esc(r.name)+'</div>'+
      '<div class="t">'+esc(r.team)+'</div></div>';
  }
  function hashStr(s){ s=text(s); var h=0; for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0;} return h; }
  function renderTreeNode(r,forest,visited,depth){
    if(visited[forest.keyOf(r)] || depth>12) return '<li>'+orgNode(r)+'</li>'; // cycle/depth guard
    visited=Object.assign({},visited); visited[forest.keyOf(r)]=true;
    var kids=forest.childrenOf[forest.keyOf(r)]||[];
    var inner=orgNode(r, depth===0?'top':'');
    if(kids.length){ inner+='<ul>'+kids.map(function(k){return renderTreeNode(k,forest,visited,depth+1);}).join('')+'</ul>'; }
    return '<li>'+inner+'</li>';
  }
  function renderOrgTree(rows,hasManager){
    var host=q('#org1TreeSection'); if(!host)return;
    if(!hasManager){
      host.innerHTML='<section class="org1-panel"><h3>🌳 Org Chart</h3>'+
        '<div class="org1-empty">Add a "Manager" or "Manager ID" column to your file to see the reporting-line tree here. '+
        'Showing headcount by team below instead.</div></section>';
      return;
    }
    var forest=buildForest(rows);
    if(!forest.roots.length){ host.innerHTML=''; return; }
    var roots=forest.roots.slice(0,40); // sanity cap for very flat/broken manager data
    host.innerHTML='<section class="org1-panel"><h3>🌳 Org Chart</h3>'+
      '<div class="org1-note">Built from the Manager / Manager ID column — click a node to view the profile</div>'+
      '<div class="org1-ocwrap"><div class="org1-tree"><ul>'+
        roots.map(function(r){return renderTreeNode(r,forest,{},0);}).join('')+
      '</ul></div></div></section>';
    qa('.org1-onode',host).forEach(function(el){
      el.addEventListener('click',function(){ openM(el.getAttribute('data-emp')); });
    });
  }

  /* =============== directory + table + modal =============== */
  var CUR_ROWS=[];
  function findEmp(idOrName){
    return CUR_ROWS.filter(function(r){return (r.id&&r.id===idOrName)||r.name===idOrName;})[0]||null;
  }
  function renderDirectory(rows){
    var host=q('#org1Dir'); if(!host)return;
    var shown=rows.slice(0,60);
    host.innerHTML=shown.map(function(r){
      var col=SERIES[Math.abs(hashStr(r.team))%SERIES.length];
      return '<div class="org1-pc" data-emp="'+esc(r.id||r.name)+'">'+
        '<div class="org1-avc" style="background:linear-gradient(150deg,'+col+','+shade(col)+')">'+esc(initials(r.name))+'</div>'+
        '<div class="nm">'+esc(r.name)+'</div>'+
        '<div class="rl">'+esc(r.position||r.level||'')+'</div>'+
        '<span class="tm" style="background:'+tint(col,.14)+';color:'+col+'">'+esc(r.team)+'</span></div>';
    }).join('')+(rows.length>shown.length?'<div class="org1-empty" style="grid-column:1/-1">+'+(rows.length-shown.length)+' more — use the table below or search to narrow down</div>':'');
    qa('.org1-pc',host).forEach(function(el){ el.addEventListener('click',function(){ openM(el.getAttribute('data-emp')); }); });
  }

  var SORT={k:'name',d:1};
  var TBL_COLS=[['id','ID'],['name','Name'],['position','Position'],['team','Team'],['site','Site'],['start','Start Date'],['svcM','Tenure']];
  function sortBy(k){ SORT.d=(SORT.k===k)?-SORT.d:1; SORT.k=k; schedule(); }
  function tblCell(r,k){
    if(k==='team'){ var col=SERIES[Math.abs(hashStr(r.team))%SERIES.length];
      return '<span class="org1-pill" style="background:'+tint(col,.14)+';color:'+col+'">'+esc(r.team)+'</span>'; }
    if(k==='start')return fmt(r.start);
    if(k==='svcM')return fyr(r.svcM);
    return esc(r[k]);
  }
  function renderTable(rows){
    var host=q('#org1Tbl'); if(!host)return;
    var sorted=rows.slice().sort(function(a,b){
      var x=a[SORT.k],y=b[SORT.k];
      if(x==null)return 1; if(y==null)return -1;
      return (typeof x==='number'?(x-y):String(x).localeCompare(String(y)))*SORT.d;
    });
    var head='<tr>'+TBL_COLS.map(function(c){
      return '<th class="'+(SORT.k===c[0]?'srt':'')+'" data-k="'+c[0]+'">'+c[1]+(SORT.k===c[0]?(SORT.d>0?' ▲':' ▼'):'')+'</th>';
    }).join('')+'</tr>';
    var body=sorted.map(function(r){
      return '<tr data-emp="'+esc(r.id||r.name)+'">'+TBL_COLS.map(function(c){
        return '<td'+(c[0]==='name'?' class="b"':'')+'>'+tblCell(r,c[0])+'</td>';
      }).join('')+'</tr>';
    }).join('');
    host.innerHTML='<table><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
    qa('th[data-k]',host).forEach(function(th){ th.addEventListener('click',function(){ sortBy(th.getAttribute('data-k')); }); });
    qa('tbody tr',host).forEach(function(tr){ tr.addEventListener('click',function(){ openM(tr.getAttribute('data-emp')); }); });
    q('#org1TblNote').textContent=rows.length.toLocaleString()+' employee'+(rows.length===1?'':'s')+(FILTER_KEY?' · filtered by '+FILTER_KEY+' = '+FILTER_VAL+' (click the bar again to clear)':'');
  }

  function openM(idOrName){
    var r=findEmp(idOrName); if(!r)return;
    curId=idOrName; MSHOW=false; drawM(r);
    var d=q('#org1Mdl'); if(d) d.classList.add('on');
  }
  function toggleM(){ MSHOW=!MSHOW; var r=findEmp(curId); if(r) drawM(r); }
  function drawM(r){
    var col=SERIES[Math.abs(hashStr(r.team))%SERIES.length];
    q('#org1Mtop').style.background='linear-gradient(150deg,'+col+','+shade(col)+')';
    q('#org1Mtop').innerHTML='<div class="org1-avc" style="background:rgba(255,255,255,.22)">'+esc(initials(r.name))+'</div>'+
      '<h2>'+esc(r.name)+'</h2><p>'+esc(r.nick||r.position||'')+(r.nick&&r.position?' · '+esc(r.position):'')+'</p>';
    var rows=[];
    if(r.id)rows.push(['ID','<b style="color:var(--ink)">'+esc(r.id)+'</b>']);
    if(r.level && r.level!==r.position)rows.push(['Level',esc(r.level)]);
    rows.push(['Team',esc(r.team)]);
    if(r.system)rows.push(['System',esc(r.system)]);
    if(r.site)rows.push(['Site',esc(r.site)]);
    if(r._mgr)rows.push(['Reports To',esc(r._mgr.name)]);
    if(r.start)rows.push(['Start Date',fmt(r.start)+' · <span style="color:var(--muted)">Tenure '+fyr(r.svcM)+'</span>']);
    if(MSHOW){
      if(r.gender)rows.push(['Gender',esc(r.gender)]);
      if(r.dob)rows.push(['Date of Birth',fmt(r.dob)+(r.ageM!=null?' · <span style="color:var(--muted)">Age '+fyr(r.ageM)+'</span>':'')]);
      if(r.email)rows.push(['Email','<a href="mailto:'+esc(r.email)+'" style="color:var(--brand)">'+esc(r.email)+'</a>']);
      if(r.phone)rows.push(['Phone','<a href="tel:'+esc(r.phone)+'" style="color:var(--brand)">'+esc(r.phone)+'</a>']);
    }
    var hasHidden = !!(r.gender||r.dob||r.email||r.phone);
    q('#org1Mbody').innerHTML=rows.map(function(x){
      return '<div class="org1-mr"><div class="l">'+x[0]+'</div><div class="v">'+x[1]+'</div></div>';
    }).join('')+(hasHidden?'<button type="button" class="btn sm org1-reveal" id="org1RevealBtn">'+(MSHOW?'Hide Personal Info':'View Personal Info')+'</button>':'');
    var btn=q('#org1RevealBtn'); if(btn) btn.addEventListener('click',toggleM);
  }

  /* =============== main render =============== */
  function suppressLayout(){
    var layout=q('#organizationalLayout');
    if(layout) layout.classList.add('org1-override-hidden');
    qa('.org1-hidden-source').forEach(function(e){ e.classList.remove('org1-hidden-source'); });
  }
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='organizational'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'organizationalLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="org1-panel"><h3>🏢 Organizational Dashboard</h3>'+
      '<div class="org1-empty">This file has no columns that look like employee/org data (needs a Name column '+
      'plus at least one of Team / Position / Manager) — try Template "Auto" or upload a file with these columns</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('org1-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='organizational'){ suppressLayout(); return; }
    var ocl=q('#organizationalLayout'); if(ocl) ocl.classList.remove('org1-override-hidden');
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='organizationalLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="Layout"]').filter(function(e){return e.id!=='organizationalLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;

    var rows=data.rows; CUR_ROWS=rows;
    var teams=cnt(rows,'team').length, sites=cnt(rows,'site').length;
    var ages=rows.filter(function(r){return r.ageM!=null;}).map(function(r){return r.ageM/12;});
    var svcs=rows.filter(function(r){return r.svcM!=null;}).map(function(r){return r.svcM/12;});
    var avg=function(a){return a.length?(a.reduce(function(x,y){return x+y;},0)/a.length):0;};

    q('#org1Kpis').innerHTML=
      '<div class="org1-kpi"><div class="l">Headcount</div><div class="v">'+rows.length+'</div><div class="s">Employees in file</div></div>'+
      '<div class="org1-kpi"><div class="l">Teams</div><div class="v">'+teams+'</div><div class="s">Distinct teams/departments</div></div>'+
      '<div class="org1-kpi"><div class="l">Sites</div><div class="v">'+sites+'</div><div class="s">Active work sites</div></div>'+
      '<div class="org1-kpi"><div class="l">Average Age</div><div class="v">'+(ages.length?avg(ages).toFixed(1):'—')+'</div><div class="s">'+ages.length+' with DOB on file</div></div>'+
      '<div class="org1-kpi"><div class="l">Average Tenure</div><div class="v">'+(svcs.length?avg(svcs).toFixed(1):'—')+'</div><div class="s">'+svcs.length+' with start date</div></div>';

    renderOrgTree(rows, !!data.hasManager);

    var view = FILTER_KEY ? rows.filter(function(r){return String(r[FILTER_KEY])===FILTER_VAL;}) : rows;

    hbars('#org1ByTeam', cnt(rows,'team'), {fk:'team'});
    var siteD=cnt(rows,'site');
    if(siteD.length){ q('#org1BySiteCard').style.display=''; hbars('#org1BySite', siteD, {fk:'site'}); }
    else { q('#org1BySiteCard').style.display='none'; }
    var lvlKey = rows.some(function(r){return r.level && r.level!==r.position;}) ? 'level' : 'position';
    q('#org1ByLevelTitle').textContent = lvlKey==='level' ? 'Headcount by Level' : 'Headcount by Position';
    var lvlD=cnt(rows,lvlKey);
    if(lvlD.length){ q('#org1ByLevelCard').style.display=''; hbars('#org1ByLevel', lvlD, {fk:lvlKey}); }
    else { q('#org1ByLevelCard').style.display='none'; }

    renderDirectory(view);
    renderTable(view);

    q('#org1Updated').textContent=rows.length.toLocaleString()+' employees · '+teams+' teams'+(data.hasManager?' · org chart from Manager column':'');
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[ORG1]',e);}});
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
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeM(); });
    document.addEventListener('change',function(){setTimeout(schedule,50);},true);
    window.addEventListener('resize',schedule,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
