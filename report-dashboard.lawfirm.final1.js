/* FINAL 1 — Law Firm Dashboard (replaces the old "legal = statute reading" concept)
   Follows the exact pattern of report-dashboard.safety.final1.js: self-contained,
   own column-role detection, auto-activates only when the uploaded sheet looks like
   a law-firm matter/billing log (Matter/Client/Attorney/Billable Hours columns),
   inserts its own layout next to the existing Projects-section cards without
   touching them. Does NOT modify any existing file, hook, or the table renderer.

   ตามที่ผู้ใช้ขอ: เปลี่ยนแนวคิดจากเดิม "ติดตามการอ่านกฎหมาย" (ย้ายไปรวมกับ Reading domain แล้ว —
   ดู report-dashboard.reading.final1.js) เป็น "Law Firm Dashboard" บริหารสำนักงานกฎหมายจริง
   ใช้ dropdown value เดิม "legal" (ทั้ง #dashboardTemplateSel และ #domainOverrideSel มีอยู่แล้ว
   ไม่ต้องแก้ HTML เพิ่ม) — DOMAIN_ROLES.legal เดิม (คอลัมน์ มาตรา/หมวด/พรบ) ปล่อยไว้เฉยๆ ไม่ลบ
   ไม่กระทบใคร เพราะโมดูลนี้ตรวจจับคอลัมน์ของตัวเองอิสระ ไม่พึ่ง DOMAIN_ROLES/detectDomain() เลย
   (แพทเทิร์นเดียวกับ Safety/Maintenance/HR/IT Ops) */
(function(){
  'use strict';
  function P(){return window.TanotReportUtils.palette();}
  /* ภาษาหน้า (OME_LANG กลาง) — ข้อความไทย/อังกฤษคู่กัน, โครงแผงสร้างใหม่เมื่อสลับภาษา (ดู init) */
  function L(th,en){return (window.OME_LANG&&window.OME_LANG.get&&window.OME_LANG.get()==='en')?en:th;}
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
  /* บั๊กเดิม (Project Control/Maintenance/Safety/HR/IT Ops): toLocaleDateString('en-GB',...) ย่อเดือน
     กันยายนเป็น "Sept" (4 ตัวอักษร) ทำให้คอลัมน์วันที่จัดแนวไม่ตรงกัน ใช้ตารางเดือนย่อ 3 ตัวคงที่เองแทน */
  var LF_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+LF_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function baht(n){return '฿'+Math.round(n||0).toLocaleString()}

  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  /* ===== ความคืบหน้าคดี (37 ขั้นตอนมาตรฐานคดีแพ่ง) — ตามที่ผู้ใช้ระบุ 7 ก.ย. 2569 แทนที่แผง
     "กำหนดนัด/เอกสารที่ใกล้ถึง" เดิม โมเดล/สีผ่านการอนุมัติ mockup แล้ว (v3 — แยกฝ่ายโจทก์/จำเลย)
     ===== */
  var LF_STAGE_NAMES=[
    "สอบข้อเท็จจริงจากลูกความ","ปรับข้อเท็จจริงเข้ากับหลักกฎหมาย","ออกหนังสือบอกกล่าวทวงถาม (Notice)","เขียนคำฟ้อง","เขียนคำให้การ","เขียนคำให้การพร้อมฟ้องแย้ง",
    "ยื่นคำฟ้อง หรือยื่นคำให้การ ชำระค่าขึ้นศาล","ขอดำเนินคดีอย่างคนอนาถา หรือยกเว้นค่าธรรมเนียมศาล","ขาดนัดยื่นคำให้การ","การประนีประนอมยอมความ หรือไกล่เกลี่ย","ขอคุ้มครองชั่วคราวก่อนมีคำพิพากษา",
    "นัดชี้สองสถาน (ถ้ามี)","ยื่นบัญชีระบุพยาน (ก่อนวันสืบอย่างน้อย 7 วัน)","ขอหมายเรียกพยานเอกสาร พยานบุคคล พยานวัตถุ","ยื่นพยานต่างๆ แก่ศาล และคู่ความ","เตรียมคดี หรือซ้อมพยานก่อนเบิกความ","การตรวจสอบพยานต่างๆ ก่อนส่งแก่ศาล","การขอรวมการพิจารณา","การขอเลื่อนคดี",
    "สืบพยานโจทก์และจำเลย","การซักถาม ซักค้าน ถามติง ขออนุญาตศาลถาม","การชำระค่าอากรแสตมป์เอกสารที่อ้างส่งศาล","คำแถลงการณ์ปิดคดี","นัดฟังคำพิพากษา",
    "ขอทุเลาการบังคับคดี","คัดถ่ายคำเบิกความพยาน","วิเคราะห์คำพิพากษาก่อนอุทธรณ์","ค่าใช้จ่ายในชั้นอุทธรณ์","คำฟ้องอุทธรณ์และคำแก้อุทธรณ์","คำฟ้องฎีกา และคำแก้ฎีกา",
    "ออกคำบังคับ","ออกหมายบังคับคดี และตั้งเจ้าพนักงานบังคับคดี","ยึดหรือการอายัดทรัพย์","ขายทอดตลาด","ร้องขัดทรัพย์","ขอเฉลี่ยทรัพย์","ขอกันส่วน"
  ];
  var LF_STAGE_NAMES_EN=["Interview client on the facts","Apply the facts to legal principles","Issue a demand notice","Draft the plaint","Draft the answer","Draft the answer with counterclaim","File the plaint or answer; pay court fees","Apply to sue as a pauper or for court-fee waiver","Default in filing the answer","Compromise or mediation","Apply for interim protection before judgment","Pre-trial conference (if any)","File the witness list (at least 7 days before trial)","Request summonses for documentary, personal and physical evidence","Submit evidence to the court and the parties","Prepare the case or rehearse witnesses before testimony","Review evidence before submitting to the court","Request to consolidate proceedings","Request for postponement","Hear the plaintiff's and defendant's witnesses","Examination, cross-examination, re-examination, leave to ask the court","Pay stamp duty on documents submitted to the court","Closing statement","Judgment hearing","Request stay of execution","Obtain copies of witness testimony","Analyse the judgment before appealing","Appeal-stage costs","Appeal and response to appeal","Supreme Court appeal and response","Issue the enforcement order","Issue writ of execution and appoint enforcement officer","Seize or attach assets","Auction","Third-party claim to seized assets","Claim a share of the proceeds","Claim a reserved share"];
  function lfStageName(i){return L(LF_STAGE_NAMES[i],LF_STAGE_NAMES_EN[i]);}
  var LF_TOTAL_STAGES=37;
  // ยืนยันกับผู้ใช้แล้ว (7 ก.ย. 2569): เฉพาะ 4 ข้อนี้ผูกกับฝ่ายเดียว ที่เหลือ 33 ข้อใช้ร่วมกันทั้งสองฝ่าย
  var LF_ROLE_MAP={3:'plaintiff',4:'plaintiff',5:'defendant',6:'defendant',9:'defendant'};
  function lfRoleLabel(r){return {plaintiff:L('โจทก์','Plaintiff'),defendant:L('จำเลย','Defendant')}[r];}
  var LF_PLAINTIFF_KW=['plaintiff','โจทก์'];
  var LF_DEFENDANT_KW=['defendant','จำเลย'];
  function lfMix(c1,c2,t){
    var a=(c1.match(/\d+/g)||[0,0,0]).map(Number),b=(c2.match(/\d+/g)||[255,255,255]).map(Number);
    return 'rgb('+[0,1,2].map(function(i){return Math.round(a[i]*t+b[i]*(1-t));}).join(',')+')';
  }
  var LF_PHASES=[
    {th:'เตรียมคดี',en:'Case preparation',from:1,to:6,mix:1},
    {th:'ยื่นฟ้อง/ให้การ',en:'Filing / answer',from:7,to:11,mix:0.82},
    {th:'ชั้นพยาน',en:'Evidence stage',from:12,to:19,mix:0.64},
    {th:'สืบพยาน/พิจารณา',en:'Trial / hearing',from:20,to:24,mix:0.48},
    {th:'อุทธรณ์/ฎีกา',en:'Appeal',from:25,to:30,mix:0.34},
    {th:'บังคับคดี',en:'Enforcement',from:31,to:37,mix:0.22}
  ].map(function(p){
    Object.defineProperty(p,'name',{get:function(){return L(p.th,p.en);}});
    Object.defineProperty(p,'color',{get:function(){var c=P();return lfMix(c.accent,c.surface1,p.mix);}});
    return p;
  });
  function lfRoleOfStage(s){ return LF_ROLE_MAP[s]||'both'; }
  // role='plaintiff'/'defendant' (จากคอลัมน์ฝ่ายในไฟล์) หรือ falsy (ไม่มีคอลัมน์ฝ่าย/ค่าไม่แมตช์ — ในกรณีนี้
  // ถือว่าขั้นตอน "ทุกข้อ" ใช้ได้หมด ไม่กรองอะไรออก เหมือนพฤติกรรมเดิมก่อนแยกฝ่าย) — ห้ามใช้ 'both' เป็นค่า role
  // ของคดี (สงวนไว้เป็นค่าที่ lfRoleOfStage คืนสำหรับ "ขั้นตอนที่ใช้ร่วมกันทั้งสองฝ่าย" เท่านั้น คนละความหมาย
  function lfIsApplicable(s,role){ if(!role) return true; var r=lfRoleOfStage(s); return r==='both'||r===role; }
  function lfApplicableStages(role){ var a=[]; for(var s=1;s<=LF_TOTAL_STAGES;s++) if(lfIsApplicable(s,role)) a.push(s); return a; }
  function lfPhaseOf(s){ return LF_PHASES.filter(function(p){return s>=p.from&&s<=p.to;})[0]; }
  function lfCurrentStageFor(role,doneSteps){
    var app=lfApplicableStages(role);
    for(var i=0;i<app.length;i++){ if(doneSteps.indexOf(app[i])===-1) return {step:app[i],idx:i+1,total:app.length}; }
    return {step:app[app.length-1],idx:app.length,total:app.length,finished:true};
  }
  // เทียบกับ "แผนงาน" ที่ผู้ใช้กรอกมาเองในไฟล์ (จำนวนวันมาตรฐานต่อขั้นตอน ต่อแถว/คดี) ยืนยันกับผู้ใช้แล้ว
  // (7 ก.ย. 2569): ไม่ hardcode จำนวนวันในโค้ด — ถ้าคดีไหนไม่มีข้อมูลแผนครบ (คอลัมน์ "แผนN"/"planN")
  // หรือไม่มีวันที่เปิดคดี จะไม่ประเมินสถานะ (แสดง "—" แทนป้ายล่าช้า/ตามแผน/เร็วกว่า)
  function lfScheduleEval(role,doneSteps,planDays,openDate,today){
    var cur=lfCurrentStageFor(role,doneSteps);
    if(cur.finished) return {cur:cur,status:'finished'};
    if(!openDate) return {cur:cur,status:null};
    var app=lfApplicableStages(role), cum=0;
    for(var i=0;i<app.length;i++){
      if(app[i]===cur.step) break;
      var d=planDays[app[i]];
      if(d==null) return {cur:cur,status:null};
      cum+=d;
    }
    var curPlan=planDays[cur.step];
    if(curPlan==null) return {cur:cur,status:null};
    var winStart=new Date(openDate.getTime()+cum*86400000);
    var winEnd=new Date(openDate.getTime()+(cum+curPlan)*86400000);
    var status = today<winStart?'ahead':today>winEnd?'late':'ontrack';
    return {cur:cur,status:status,winStart:winStart,winEnd:winEnd};
  }

  var OPEN_KW=['open','active','ongoing','ระหว่างดำเนินการ','เปิดอยู่','กำลังดำเนินการ'];
  var CLOSED_KW=['closed','complete','done','won','settled','ปิด','เสร็จ','แล้วเสร็จ','สิ้นสุด'];
  var HOLD_KW=['hold','pause','suspend','stay','ระงับ','พัก','ชะลอ'];
  // บั๊กที่เจอ (Playwright): เช็ค CLOSED_KW ก่อน OPEN_KW ทำให้คำว่า "ปิด" ใน CLOSED_KW ไป match ซ้อนอยู่ใน
  // "เปิดอยู่" ของ OPEN_KW เอง (เพราะ "เปิด" มีตัวอักษร "ปิด" ประกอบอยู่ในตัว) ผลคือทุกแถวที่สถานะ "เปิดอยู่"
  // ถูกจัดเป็น "ปิดแล้ว" หมด (Open Matters เป็น 0 เสมอ) แก้โดยเช็ค OPEN_KW ก่อน — คำใน OPEN_KW ไม่มีคำไหน
  // เป็นส่วนย่อยของคำใน CLOSED_KW เลย เช็คก่อนจึงปลอดภัย
  function statusBucket(v){
    var n=text(v).toLowerCase();
    if(OPEN_KW.some(function(k){return n.indexOf(k)>=0})) return 'open';
    if(CLOSED_KW.some(function(k){return n.indexOf(k)>=0})) return 'closed';
    if(HOLD_KW.some(function(k){return n.indexOf(k)>=0})) return 'hold';
    return n?'other':'unknown';
  }
  function lfRoleBucket(v){
    var n=text(v).toLowerCase();
    if(LF_PLAINTIFF_KW.some(function(k){return n.indexOf(k)>=0})) return 'plaintiff';
    if(LF_DEFENDANT_KW.some(function(k){return n.indexOf(k)>=0})) return 'defendant';
    return null;
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
      matterId: roleCol(st,['matter id','matterid','case no','case number','เลขคดี','หมายเลขคดี','เลขที่คดี']),
      client: roleCol(st,['client','ลูกความ','ลูกค้า']),
      practiceArea: roleCol(st,['practice area','practicearea','ประเภทคดี','ประเภทงาน']),
      attorney: roleCol(st,['attorney','lawyer','ทนาย','ทนายความ','ผู้รับผิดชอบ']),
      billableHours: roleCol(st,['billable hours','billablehours','ชั่วโมงเรียกเก็บ','ชั่วโมงทำงาน','ชั่วโมง']),
      billed: roleCol(st,['amount billed','billed amount','billedamount','เรียกเก็บ','ยอดเรียกเก็บ']),
      collected: roleCol(st,['amount collected','collected amount','collectedamount','จัดเก็บ','ยอดจัดเก็บ','เก็บเงินได้']),
      status: roleCol(st,['status','สถานะ']),
      openDate: roleCol(st,['open date','opendate','วันที่เปิดคดี','วันที่รับคดี']),
      closeDate: roleCol(st,['close date','closedate','วันที่ปิดคดี']),
      dueDate: roleCol(st,['court date','courtdate','due date','duedate','deadline','นัดศาล','กำหนดนัด','นัดความ']),
      caseRole: roleCol(st,['role','capacity','ฝ่าย','สถานะคู่ความ','ประเภทคู่ความ'])
    };
    // ===== ความคืบหน้าคดี 37 ขั้นตอน — คอลัมน์แบบ dynamic (ไม่ใช่ roleCol ปกติ): สแกนหัวคอลัมน์ทั้งหมด
    // หาแบบ "N. ..." (วันที่ทำขั้นตอนที่ N เสร็จ — ใช้ตัวเลขนำหน้าเหมือนลิสต์ 37 ข้อที่ผู้ใช้ให้มาตรงๆ พิมพ์
    // หัวคอลัมน์อะไรต่อท้ายเลขก็ได้) และ "แผนN"/"planN" (จำนวนวันมาตรฐานของขั้นตอนที่ N ต่อคดีนั้น —
    // ผู้ใช้ยืนยันแล้วว่าจะกรอกเองในไฟล์ ไม่ hardcode ในโค้ด)
    var stageDateCol={}, stagePlanCol={};
    (st.columns||[]).forEach(function(col){
      var lbl=text(col.label);
      var m1=lbl.match(/^(\d{1,2})\s*[.\)]/);
      if(m1){ var n1=+m1[1]; if(n1>=1&&n1<=LF_TOTAL_STAGES&&!stageDateCol[n1]) stageDateCol[n1]=col; }
      var m2=lbl.match(/^(?:แผน|plan)\s*[:\-]?\s*(\d{1,2})\b/i);
      if(m2){ var n2=+m2[1]; if(n2>=1&&n2<=LF_TOTAL_STAGES&&!stagePlanCol[n2]) stagePlanCol[n2]=col; }
    });
    var stageColCount=Object.keys(stageDateCol).length;
    // เกณฑ์ >=10 ขั้นตอน กันไม่ให้ไฟล์ที่บังเอิญมีคอลัมน์ตัวเลขนำหน้า 1-2 อันเข้าใจผิดว่าเป็นข้อมูล 37 ขั้นตอน
    var hasLitigation = stageColCount>=10;
    c.stageDateCol=stageDateCol; c.stagePlanCol=stagePlanCol;
    // Activation gate: ต้องมี billableHours หรือ billed (เป็นตัวชี้ว่านี่คือข้อมูลเรียกเก็บเงินของสำนักงาน
    // กฎหมายจริง ไม่ใช่ตารางการเงิน/โครงการทั่วไป) ร่วมกับ attorney หรือ practiceArea
    if(!(c.billableHours||c.billed) || !(c.attorney||c.practiceArea)) return ov==='legal' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var dateCol = c.openDate || c.closeDate;
    var rows=st.rows.map(function(r,i){
      return {
        raw:r, i:i,
        matterId: c.matterId?text(r[c.matterId.key]):('M-'+(i+1)),
        client: c.client?text(r[c.client.key]):'',
        practiceArea: c.practiceArea?text(r[c.practiceArea.key])||L('(ไม่ระบุ)','(unspecified)'):L('(ไม่ระบุ)','(unspecified)'),
        attorney: c.attorney?text(r[c.attorney.key])||L('(ไม่ระบุ)','(unspecified)'):L('(ไม่ระบุ)','(unspecified)'),
        billableHours: c.billableHours?num(r[c.billableHours.key])||0:0,
        billed: c.billed?num(r[c.billed.key])||0:0,
        collected: c.collected?num(r[c.collected.key])||0:0,
        status: c.status?text(r[c.status.key]):'',
        openDate: date(c.openDate?r[c.openDate.key]:null),
        closeDate: date(c.closeDate?r[c.closeDate.key]:null),
        dueDate: date(c.dueDate?r[c.dueDate.key]:null),
        caseRole: c.caseRole?lfRoleBucket(r[c.caseRole.key]):null,
        doneSteps: hasLitigation ? Object.keys(stageDateCol).filter(function(n){
          return !!date(r[stageDateCol[n].key]);
        }).map(Number) : [],
        planDays: hasLitigation ? Object.keys(stagePlanCol).reduce(function(acc,n){
          acc[n]=num(r[stagePlanCol[n].key]); return acc;
        },{}) : {}
      };
    });
    if(rows.length<2) return ov==='legal' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c, hasDate:!!dateCol, hasLitigation:hasLitigation};
  }

  function injectCSS(){
    if(q('#lawfirm1-css'))return;
    var s=document.createElement('style');s.id='lawfirm1-css';s.textContent=`
#lawfirmControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px;font-family:var(--pc53-font,inherit)}
#lawfirmControlLayout .lf-hero{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-lg);padding:15px 16px;box-shadow:var(--ome-shadow-1)}
#lawfirmControlLayout .lf-hero h2{font-size:var(--ome-fs-md);margin:0}
#lawfirmControlLayout .lf-hero .lf-sub{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:3px}
#lawfirmControlLayout .lf-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#lawfirmControlLayout .lf-kpi{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-md);padding:11px 13px;box-shadow:var(--ome-shadow-1);position:relative}
#lawfirmControlLayout .lf-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:var(--ome-radius-sm);background:var(--ome-ok)}
#lawfirmControlLayout .lf-kpi.warn:after{background:var(--ome-warn)}#lawfirmControlLayout .lf-kpi.bad:after{background:var(--ome-err)}
#lawfirmControlLayout .lf-kpi .l{font-size:var(--ome-fs-xs);color:var(--ome-text-2);font-weight:700;}
#lawfirmControlLayout .lf-kpi .v{font-size:var(--ome-fs-xl);font-weight:700;margin-top:4px;color:var(--ome-text-1)}
#lawfirmControlLayout .lf-kpi.warn .v{color:var(--ome-warn-ink)}#lawfirmControlLayout .lf-kpi.bad .v{color:var(--ome-err-ink)}
#lawfirmControlLayout .lf-kpi .s{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:4px}
#lawfirmControlLayout .lf-panel{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-lg);padding:12px;box-shadow:var(--ome-shadow-1)}
#lawfirmControlLayout .lf-panel h3{font-size:var(--ome-fs-sm);margin:0 0 3px;font-weight:700}
#lawfirmControlLayout .lf-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#lawfirmControlLayout .lf-grid>.half{grid-column:span 6}#lawfirmControlLayout .lf-grid>.full{grid-column:1/-1}
#lawfirmControlLayout .lf-insight{border-left:3px solid var(--ome-ok);padding:10px 13px;font-size:var(--ome-fs-xs);color:var(--ome-text-1)}
#lawfirmControlLayout .lf-status-row{display:flex;flex-direction:column;gap:8px}
#lawfirmControlLayout .lf-status-item{display:grid;grid-template-columns:100px 1fr 30px;align-items:center;gap:9px;font-size:var(--ome-fs-xs)}
#lawfirmControlLayout .lf-status-item .lab{display:flex;align-items:center;gap:6px;font-weight:700}
#lawfirmControlLayout .lf-status-item i{width:8px;height:8px;border-radius:50%;display:inline-block}
#lawfirmControlLayout .lf-track{height:7px;border-radius:var(--ome-radius-sm);background:var(--ome-surface-2);overflow:hidden}
#lawfirmControlLayout .lf-track span{display:block;height:100%;border-radius:var(--ome-radius-sm)}
#lawfirmControlLayout .lf-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--ome-border);font-size:var(--ome-fs-xs)}
#lawfirmControlLayout .lf-list:last-child{border-bottom:none}
#lawfirmControlLayout .lf-empty{padding:24px 8px;text-align:center;color:var(--ome-text-2);font-size:var(--ome-fs-xs)}
#lawfirmControlLayout svg text{font-family:var(--pc53-font,inherit)}
#lawfirmControlLayout .lf-trend-scroll{overflow-x:auto}
#lawfirmControlLayout.lawfirm-override-hidden{display:none!important}
.lawfirm-hidden-source{display:none!important}

/* ── ความคืบหน้าคดี 37 ขั้นตอน (แทนที่แผงกำหนดนัดเดิม เมื่อไฟล์มีคอลัมน์ขั้นตอนครบพอ) ── */
#lawfirmControlLayout .lg-overview{display:flex;align-items:center;gap:26px;flex-wrap:wrap;padding:4px 0 14px;border-bottom:1px solid var(--ome-border);margin-bottom:14px}
#lawfirmControlLayout .lg-donut-wrap{position:relative;width:104px;height:104px;flex:none}
#lawfirmControlLayout .lg-donut{width:100%;height:100%;border-radius:50%}
#lawfirmControlLayout .lg-donut-hole{position:absolute;inset:14px;background:var(--ome-surface-1);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center}
#lawfirmControlLayout .lg-donut-total{font-size:var(--ome-fs-lg);font-weight:700;font-variant-numeric:tabular-nums;line-height:1;color:var(--ome-text-1)}
#lawfirmControlLayout .lg-donut-label{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:2px}
#lawfirmControlLayout .lg-donut-legend{display:flex;gap:18px;flex-wrap:wrap;flex:1}
#lawfirmControlLayout .lg-dl-item{display:flex;align-items:center;gap:7px;font-size:var(--ome-fs-xs)}
#lawfirmControlLayout .lg-dl-dot{width:10px;height:10px;border-radius:var(--ome-radius-sm);flex:none}
#lawfirmControlLayout .lg-dl-val{font-weight:700;font-variant-numeric:tabular-nums}
#lawfirmControlLayout .lg-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:var(--ome-fs-xs);color:var(--ome-text-2);font-weight:600;margin-bottom:10px}
#lawfirmControlLayout .lg-legend .sw{width:9px;height:9px;border-radius:var(--ome-radius-sm);display:inline-block;margin-right:4px}
#lawfirmControlLayout .lg-legend .sw.na{background-image:repeating-linear-gradient(45deg,var(--ome-text-3),var(--ome-text-3) 2px,var(--ome-text-3) 2px,var(--ome-text-3) 4px)}
#lawfirmControlLayout .lg-case-list{display:flex;flex-direction:column;gap:10px}
#lawfirmControlLayout .lg-case{border:1px solid var(--ome-border);border-radius:var(--ome-radius-md);padding:12px 14px}
#lawfirmControlLayout .lg-case-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px}
#lawfirmControlLayout .lg-id-wrap{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
#lawfirmControlLayout .lg-id{font-family:var(--pc53-mono,monospace);font-weight:700;font-size:var(--ome-fs-xs);color:var(--ome-accent-strong);background:var(--ome-accent-soft);padding:3px 8px;border-radius:var(--ome-radius-sm)}
#lawfirmControlLayout .lg-role{display:inline-flex;align-items:center;gap:5px;font-size:var(--ome-fs-xs);font-weight:700;padding:3.5px 10px;border-radius:var(--ome-radius-pill);white-space:nowrap}
#lawfirmControlLayout .lg-role.plaintiff{background:var(--ome-accent-soft);color:var(--ome-accent-strong)}
#lawfirmControlLayout .lg-role.defendant{background:var(--ome-chart-7);color:var(--ome-chart-7)}
#lawfirmControlLayout .lg-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:var(--ome-fs-xs);color:var(--ome-text-2)}
#lawfirmControlLayout .lg-meta b{color:var(--ome-text-1);font-weight:600}
#lawfirmControlLayout .lg-badge{display:inline-flex;align-items:center;gap:5px;font-size:var(--ome-fs-xs);font-weight:700;padding:3.5px 10px;border-radius:var(--ome-radius-pill);white-space:nowrap}
#lawfirmControlLayout .lg-badge.ontrack{background:var(--ome-ok-soft);color:var(--ome-ok-ink)}
#lawfirmControlLayout .lg-badge.late{background:var(--ome-err-soft);color:var(--ome-err-ink)}
#lawfirmControlLayout .lg-badge.ahead{background:var(--ome-accent-soft);color:var(--ome-accent)}
#lawfirmControlLayout .lg-badge.finished{background:var(--ome-surface-2);color:var(--ome-text-2)}
#lawfirmControlLayout .lg-badge.unknown{background:var(--ome-surface-2);color:var(--ome-text-2)}
#lawfirmControlLayout .lg-badge .dot{width:5px;height:5px;border-radius:50%;background:currentColor}
#lawfirmControlLayout .lg-track-wrap{position:relative}
#lawfirmControlLayout .lg-track{display:flex;height:11px;border-radius:var(--ome-radius-pill);overflow:hidden;background:var(--ome-surface-2)}
#lawfirmControlLayout .lg-track .c{height:100%;flex:1 1 0}
#lawfirmControlLayout .lg-track .c+.c{border-left:1px solid color-mix(in srgb,var(--ome-border) 65%,transparent)}
#lawfirmControlLayout .lg-track .c.na{background-image:repeating-linear-gradient(45deg,var(--ome-text-3),var(--ome-text-3) 2px,var(--ome-text-3) 2px,var(--ome-text-3) 4px)}
#lawfirmControlLayout .lg-marker{position:absolute;top:-16px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:1px}
#lawfirmControlLayout .lg-marker .chip{font-size:var(--ome-fs-xs);font-weight:700;color:var(--ome-on-accent);background:var(--ome-text-1);padding:1px 5px;border-radius:var(--ome-radius-sm);white-space:nowrap}
#lawfirmControlLayout .lg-marker .pin{width:2px;height:7px;background:var(--ome-text-1);border-radius:var(--ome-radius-sm)}
#lawfirmControlLayout .lg-caption{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
#lawfirmControlLayout .lg-phasechip{font-size:var(--ome-fs-xs);font-weight:700;padding:1px 7px;border-radius:var(--ome-radius-pill);color:var(--ome-on-accent)}
#lawfirmControlLayout .lg-foot{display:flex;justify-content:flex-end;margin-top:10px;padding-top:9px;border-top:1px solid var(--ome-border)}
/* modal (แนบตัวเองกับ body — ไม่ใช่ #lawfirmControlLayout — เพราะต้องลอยทับทั้งหน้าจอ) */
.lg-modal-ov{position:fixed;inset:0;background:color-mix(in srgb,var(--ome-text-1) 45%,transparent);z-index:9500;display:flex;align-items:center;justify-content:center;padding:24px}
.lg-modal{background:var(--ome-surface-1);border-radius:var(--ome-radius-lg);max-width:900px;width:100%;max-height:88vh;overflow:auto;box-shadow:var(--ome-shadow-1)}
.lg-modal-hero{padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-bottom:1px solid var(--ome-border);position:sticky;top:0;background:var(--ome-surface-1);z-index:1}
.lg-modal-hero .lg-cid{font-size:var(--ome-fs-md);font-weight:700;font-family:var(--pc53-mono,monospace)}

.lg-modal-body{padding:18px 20px}
.lg-phase-block{margin-bottom:16px}
.lg-phase-head{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.lg-phase-head .ring{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ome-on-accent);font-size:var(--ome-fs-xs);font-weight:700;flex:none;line-height:1.05;text-align:center}
.lg-phase-head .name{font-size:var(--ome-fs-xs);font-weight:700}
.lg-phase-head .ptrack{flex:1;height:5px;border-radius:var(--ome-radius-pill);background:var(--ome-surface-2);overflow:hidden;max-width:150px}
.lg-phase-head .pfill{height:100%;border-radius:var(--ome-radius-pill)}
.lg-phase-head .ptxt{font-size:var(--ome-fs-xs);color:var(--ome-text-2);font-weight:600}
.lg-step-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
.lg-step{display:flex;align-items:center;gap:8px;font-size:var(--ome-fs-xs);padding:8px 10px;border-radius:var(--ome-radius-md);border:1px solid var(--ome-border)}
.lg-step.done{background:var(--ome-ok-soft);border-color:var(--ome-ok);color:var(--ome-ok-ink)}
.lg-step.current{background:var(--ome-warn-soft);border-color:var(--ome-warn);color:var(--ome-warn-ink)}
.lg-step.pending{background:var(--ome-surface-2);border-color:var(--ome-border);color:var(--ome-text-2)}
.lg-step.na{background:var(--ome-surface-2);border-color:var(--ome-border);color:var(--ome-text-2)}
.lg-step .ic{flex:none;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:var(--ome-fs-xs);font-weight:700;color:var(--ome-on-accent)}
.lg-step.done .ic{background:var(--ome-ok)}.lg-step.current .ic{background:var(--ome-warn)}.lg-step.pending .ic{background:var(--ome-border-strong)}.lg-step.na .ic{background:var(--ome-info-soft);color:var(--ome-text-2)}
.lg-step .natag{font-size:var(--ome-fs-xs);font-weight:700;margin-left:auto;padding-left:6px;white-space:nowrap}
@media(max-width:640px){.lg-step-grid{grid-template-columns:1fr}}

@media(max-width:1100px){#lawfirmControlLayout .lf-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#lawfirmControlLayout .lf-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#lawfirmControlLayout .lf-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#lawfirmControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='lawfirmControlLayout';
    // บั๊กเดิม (Project Control/Maintenance/Safety/HR/IT Ops): ไม่ติด data-dashboard-section ทำให้
    // setPage() มองไม่เห็น การ์ดค้างแสดงทุกแท็บ — แก้ให้อยู่แค่แท็บ Projects ตั้งแต่แรก
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    layout.innerHTML=
      '<section class="lf-hero"><h2>Law Firm Dashboard</h2><div class="lf-sub" id="lfUpdated"></div></section>'+
      '<div class="lf-kpis" id="lfKpis"></div>'+
      '<section class="lf-panel lf-insight-panel"><h3>Executive Insight</h3><div id="lfInsight" class="lf-insight"></div></section>'+
      '<div class="lf-grid">'+
        '<section class="lf-panel full" id="lfTrendSection"><h3>'+L('เรียกเก็บ (Billed) vs จัดเก็บได้จริง (Collected)','Billed vs collected')+'</h3><div id="lfTrend"></div></section>'+
        '<section class="lf-panel half"><h3>'+L('คดี/งานแยกตามประเภท','Matters by practice area')+'</h3><div id="lfPractice"></div></section>'+
        '<section class="lf-panel half"><h3>'+L('สถานะคดี','Matter status')+'</h3><div id="lfStatus"></div></section>'+
        '<section class="lf-panel full"><h3>'+L('Billable Hours ต่อทนายความ','Billable hours per attorney')+'</h3><div id="lfAttorney"></div></section>'+
        '<section class="lf-panel full" id="lfDeadlineSection"><h3 id="lfDeadlineTitle">'+L('กำหนดนัด/เอกสารที่ใกล้ถึง','Upcoming court dates / documents')+'</h3><div id="lfDeadlines"></div></section>'+
      '</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('lawfirm-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function renderTrend(rows){
    var host=q('#lfTrend'); var sec=q('#lfTrendSection'); if(!host)return;
    if(!rows.some(function(r){return r.openDate||r.closeDate;})){
      sec&&sec.setAttribute('hidden','');return;
    }
    sec&&sec.removeAttribute('hidden');
    var byMonth={};
    rows.forEach(function(r){
      var d=r.openDate||r.closeDate; if(!d)return;
      var k=monthKey(d);
      if(!byMonth[k]) byMonth[k]={billed:0,collected:0};
      byMonth[k].billed+=r.billed; byMonth[k].collected+=r.collected;
    });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="lf-empty">'+L('ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)','Not enough data for a trend (at least 2 months needed)')+'</div>';return;}
    var perM=64,left=48,right=30,top=14,bottom=26,ph=190;
    var w=Math.max(400,left+right+(keys.length-1)*perM), h=top+ph+bottom, pw=w-left-right;
    var maxV=1; keys.forEach(function(k){maxV=Math.max(maxV,byMonth[k].billed,byMonth[k].collected);});
    maxV=Math.ceil(maxV*1.15)||1;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="'+P().grid+'" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="9.5" fill="'+P().faint+'">'+Math.round(val/1000)+'k</text>';
    }
    var stepX=pw/(keys.length-1||1);
    [['billed',P().info],['collected',P().ok]].forEach(function(cat){
      var pts=keys.map(function(k,i){var v=byMonth[k][cat[0]]; return (left+stepX*i)+','+(top+ph-ph*v/maxV);});
      out+='<path d="M'+pts.join(' L')+'" fill="none" stroke="'+cat[1]+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      keys.forEach(function(k,i){var v=byMonth[k][cat[0]]; out+='<circle cx="'+(left+stepX*i)+'" cy="'+(top+ph-ph*v/maxV)+'" r="3" fill="'+cat[1]+'" stroke="'+P().surface1+'" stroke-width="1.2"/>';});
    });
    keys.forEach(function(k,i){
      out+='<text x="'+(left+stepX*i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="'+P().faint+'">'+k+'</text>';
    });
    out+='</svg>';
    host.innerHTML='<div class="lf-trend-scroll">'+out+'</div><div class="mini" style="display:flex;gap:14px;margin-top:4px"><span style=\"color:'+P().infoInk+'\">● '+L('เรียกเก็บ (Billed)','Billed')+'</span><span style=\"color:'+P().okInk+'\">● '+L('จัดเก็บได้จริง (Collected)','Collected')+'</span></div>';
  }

  function barListHtml(entries,color){
    if(!entries.length)return '<div class="lf-empty">'+L('ไม่มีข้อมูล','No data')+'</div>';
    var w=460,rowH=26,h=14+entries.length*rowH,left=118,right=34,barW=w-left-right;
    var maxV=Math.max.apply(null,entries.map(function(e){return e[1];}))||1;
    var out=svgOpen(w,h);
    entries.forEach(function(e,i){
      var y=10+i*rowH, bw=Math.max(2,barW*e[1]/maxV);
      out+='<text x="'+(left-8)+'" y="'+(y+13)+'" text-anchor="end" font-size="10.5" fill="'+P().text+'"><title>'+esc(e[0])+'</title>'+esc(e[0].length>16?e[0].slice(0,15)+'…':e[0])+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="16" rx="4" fill="'+P().surface2+'"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="16" rx="4" fill="'+color+'"/>';
      out+='<text x="'+(left+bw+6)+'" y="'+(y+13)+'" font-size="10.5" font-weight="700" fill="'+P().text+'">'+(Math.round(e[1]*10)/10).toLocaleString()+'</text>';
    });
    out+='</svg>';
    return out;
  }

  function renderPractice(rows){
    var host=q('#lfPractice'); if(!host)return;
    var map={}; rows.forEach(function(r){ map[r.practiceArea]=(map[r.practiceArea]||0)+1; });
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    host.innerHTML=barListHtml(entries,P().series[0]);
  }

  function renderAttorney(rows){
    var host=q('#lfAttorney'); if(!host)return;
    var map={}; rows.forEach(function(r){ map[r.attorney]=(map[r.attorney]||0)+r.billableHours; });
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
    host.innerHTML=barListHtml(entries,P().series[0]);
  }

  function renderStatus(rows){
    var host=q('#lfStatus'); if(!host)return;
    var counts={open:0,closed:0,hold:0,other:0,unknown:0};
    rows.forEach(function(r){ var b=statusBucket(r.status); counts[b]=(counts[b]||0)+1; });
    var total=Math.max(1,rows.length);
    var vals=[['open',L('เปิดอยู่ (Active)','Active'),counts.open+counts.unknown+counts.other,P().info],['closed',L('ปิดแล้ว','Closed'),counts.closed,P().ok],['hold',L('ระงับชั่วคราว','On hold'),counts.hold,P().faint]];
    var out='<div class="lf-status-row">';
    vals.forEach(function(v){
      var pct=(v[2]/total*100).toFixed(0);
      out+='<div class="lf-status-item"><span class="lab"><i style="background:'+v[3]+'"></i>'+v[1]+'</span><div class="lf-track"><span style="width:'+pct+'%;background:'+v[3]+'"></span></div><b>'+v[2]+'</b></div>';
    });
    out+='</div>';
    host.innerHTML=out;
    return counts.open+counts.unknown+counts.other;
  }

  var lgCases=[]; // เก็บผลลัพธ์ล่าสุดของแต่ละคดี (สำหรับ modal "ดูรายละเอียด" — ผูกด้วย index ไม่ใช่ id
                  // เพราะ matterId อาจซ้ำ/ว่างได้ในข้อมูลจริง)

  function lgGanttHtml(role, doneSteps, curStage){
    var cells='';
    for(var s=1;s<=LF_TOTAL_STAGES;s++){
      var cls;
      if(!lfIsApplicable(s,role)) cls='na';
      else if(doneSteps.indexOf(s)>-1 || s<curStage.step) cls='';
      else cls='pending';
      var bg = cls==='na' ? '' : (cls==='pending' ? P().surface2 : lfPhaseOf(s).color);
      cells+='<div class="c'+(cls==='na'?' na':'')+'"'+(bg?' style="background:'+bg+'"':'')+'></div>';
    }
    var track='<div class="lg-track">'+cells+'</div>';
    var pct=(curStage.step-0.5)/LF_TOTAL_STAGES*100;
    var marker='<div class="lg-marker" style="left:'+pct+'%"><span class="chip">'+curStage.idx+'/'+curStage.total+'</span><span class="pin"></span></div>';
    var ph=lfPhaseOf(curStage.step);
    var caption='<div class="lg-caption"><span class="lg-phasechip" style="background:color-mix(in srgb,'+ph.color+' 30%,var(--ome-surface-1));color:var(--ome-text-1);box-shadow:inset 0 0 0 1.5px '+ph.color+'">'+esc(ph.name)+'</span>'+
      '<span>'+L('ขั้นตอนที่ ','Step ')+curStage.idx+'/'+curStage.total+(role?L(' (เฉพาะฝ่ายนี้)',' (this side only)'):'')+' — '+esc(lfStageName(curStage.step-1))+'</span></div>';
    return '<div class="lg-track-wrap">'+marker+track+'</div>'+caption;
  }

  function lgEvalLabel(k){return {ontrack:[L('ตามแผน','On plan'),'ontrack'],late:[L('ล่าช้ากว่าแผน','Behind plan'),'late'],ahead:[L('เร็วกว่าแผน','Ahead of plan'),'ahead'],finished:[L('เสร็จสิ้นแล้ว','Finished'),'finished']}[k];}

  function renderLitigation(allRows, today){
    var host=q('#lfDeadlines'); if(!host)return;
    var rows=allRows.filter(function(r){return statusBucket(r.status)!=='closed';});
    var cases=rows.map(function(r){
      var ev=lfScheduleEval(r.caseRole, r.doneSteps, r.planDays, r.openDate, today);
      return {r:r, ev:ev};
    });
    lgCases=cases;
    if(!cases.length){ host.innerHTML='<div class="lf-empty">'+L('ไม่มีคดีที่เปิดอยู่','No open matters')+'</div>'; return; }
    // ภาพรวม: นับเฉพาะคดีที่ประเมินได้ (มีทั้งวันที่เปิดคดี+ข้อมูลแผนครบ) ไม่รวม finished/unknown ในโดนัท
    var statusCount={ontrack:0,late:0,ahead:0};
    cases.forEach(function(c){ if(statusCount.hasOwnProperty(c.ev.status)) statusCount[c.ev.status]++; });
    var evaluable=statusCount.ontrack+statusCount.late+statusCount.ahead;
    var STATUS_COLOR={ontrack:P().ok,late:P().err,ahead:P().info};
    var donutHtml='';
    if(evaluable>0){
      var acc=0, stops='';
      ['ontrack','late','ahead'].forEach(function(k,i){
        var p=statusCount[k]/evaluable*100, from=acc, to=acc+p; acc=to;
        stops+=(i?', ':'')+STATUS_COLOR[k]+' '+from.toFixed(2)+'% '+to.toFixed(2)+'%';
      });
      donutHtml='<div class="lg-overview"><div class="lg-donut-wrap"><div class="lg-donut" style="background:conic-gradient('+stops+')"></div>'+
        '<div class="lg-donut-hole"><span class="lg-donut-total">'+evaluable+'</span><span class="lg-donut-label">'+L('คดีที่ประเมินได้','Assessable matters')+'</span></div></div>'+
        '<div class="lg-donut-legend">'+['ontrack','late','ahead'].map(function(k){
          return '<div class="lg-dl-item"><span class="lg-dl-dot" style="background:'+STATUS_COLOR[k]+'"></span>'+lgEvalLabel(k)[0]+' <span class="lg-dl-val">'+statusCount[k]+'</span></div>';
        }).join('')+'</div></div>';
    }
    var legendHtml='<div class="lg-legend">'+LF_PHASES.map(function(p){return '<span><span class="sw" style="background:'+p.color+'"></span>'+esc(p.name)+'</span>';}).join('')+
      '<span><span class="sw na"></span>'+L('ไม่เกี่ยวข้องกับฝ่ายนี้','Not applicable to this side')+'</span></div>';
    // เรียงคดีล่าช้าก่อน แล้วตามแผน แล้วเร็วกว่า แล้วไม่ทราบ/เสร็จสิ้น ท้ายสุด
    var RANK={late:0,ontrack:1,ahead:2,null:3,finished:4};
    var sorted=cases.slice().sort(function(a,b){
      var ra=RANK[a.ev.status==null?'null':a.ev.status], rb=RANK[b.ev.status==null?'null':b.ev.status];
      return ra-rb;
    }).slice(0,12);
    var cardsHtml=sorted.map(function(c){
      var idx=cases.indexOf(c);
      var r=c.r, ev=c.ev, role=r.caseRole;
      var roleHtml = role ? '<span class="lg-role '+role+'">'+(role==='plaintiff'?'':'')+' '+L('ฝ่าย','Side: ')+lfRoleLabel(role)+'</span>' : '';
      var lab = ev.status==null ? [L('ไม่มีข้อมูลแผน','No plan data'),'unknown'] : lgEvalLabel(ev.status);
      return '<div class="lg-case">'+
        '<div class="lg-case-top"><div class="lg-id-wrap"><span class="lg-id">'+esc(r.matterId)+'</span>'+roleHtml+
          '<div class="lg-meta">'+(r.client?'<span><b>'+esc(r.client)+'</b></span>':'')+'<span>'+esc(r.attorney)+'</span></div></div>'+
          '<span class="lg-badge '+lab[1]+'"><span class="dot"></span>'+lab[0]+'</span></div>'+
        lgGanttHtml(role, r.doneSteps, ev.cur)+
        '<div class="lg-foot"><button class="btn sm lg-detail" data-lg-idx="'+idx+'">'+L('ดูรายละเอียดขั้นตอน →','View step details →')+'</button></div>'+
      '</div>';
    }).join('');
    host.innerHTML=donutHtml+legendHtml+'<div class="lg-case-list">'+cardsHtml+'</div>';
  }

  function lgOpenDetail(idx){
    var c=lgCases[idx]; if(!c)return;
    var r=c.r, ev=c.ev, role=r.caseRole;
    var phaseBlocks=LF_PHASES.map(function(p){
      var stepsInPhase=[]; for(var s=p.from;s<=p.to;s++) stepsInPhase.push(s);
      var applicableInPhase=stepsInPhase.filter(function(s){return lfIsApplicable(s,role);});
      var doneCount=applicableInPhase.filter(function(s){return r.doneSteps.indexOf(s)>-1;}).length;
      var pct=applicableInPhase.length?Math.round(doneCount/applicableInPhase.length*100):0;
      return '<div class="lg-phase-block"><div class="lg-phase-head">'+
        '<span class="ring" style="background:color-mix(in srgb,'+p.color+' 30%,var(--ome-surface-1));color:var(--ome-text-1);box-shadow:inset 0 0 0 1.5px '+p.color+'">'+doneCount+'/'+applicableInPhase.length+'</span>'+
        '<span class="name">'+esc(p.name)+'</span>'+
        '<div class="ptrack"><div class="pfill" style="width:'+pct+'%;background:'+p.color+'"></div></div>'+
        '<span class="ptxt">'+pct+'%</span></div>'+
        '<div class="lg-step-grid">'+stepsInPhase.map(function(s){
          var cls = !lfIsApplicable(s,role) ? 'na' : (r.doneSteps.indexOf(s)>-1 ? 'done' : (s===ev.cur.step ? 'current' : 'pending'));
          var icon = cls==='na' ? '–' : cls==='done' ? '✓' : cls==='current' ? '●' : s;
          return '<div class="lg-step '+cls+'"><span class="ic">'+icon+'</span><span>'+s+'. '+esc(lfStageName(s-1))+'</span>'+(cls==='na'?'<span class="natag">'+L('ไม่เกี่ยวข้องกับฝ่ายนี้','Not applicable to this side')+'</span>':'')+'</div>';
        }).join('')+'</div></div>';
    }).join('');
    var lab = ev.status==null ? [L('ไม่มีข้อมูลแผน','No plan data'),'unknown'] : lgEvalLabel(ev.status);
    var ov=document.createElement('div'); ov.className='lg-modal-ov';
    ov.innerHTML='<div class="lg-modal">'+
      '<div class="lg-modal-hero"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="lg-cid">'+esc(r.matterId)+'</span>'+
        (role?'<span class="lg-role '+role+'">'+(role==='plaintiff'?'':'')+' '+L('ฝ่าย','Side: ')+lfRoleLabel(role)+'</span>':'')+
        '<span class="lg-badge '+lab[1]+'"><span class="dot"></span>'+lab[0]+'</span></div>'+
        '<button class="btn ghost icon sm lg-modal-close" type="button" aria-label="'+L('ปิด','Close')+'">'+window.TanotReportUtils.icon('x')+'</button></div>'+
      '<div class="lg-modal-body">'+phaseBlocks+'</div>'+
    '</div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    ov.querySelector('.lg-modal-close').addEventListener('click',close);
  }

  function suppressLayout(){
    var layout=q('#lawfirmControlLayout');
    if(layout) layout.classList.add('lawfirm-override-hidden');
    qa('.lawfirm-hidden-source').forEach(function(e){ e.classList.remove('lawfirm-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้ */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='legal'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'lawfirmControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="lf-panel"><h3>Law Firm Dashboard</h3>'+
      '<div class="lf-empty">'+L('ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่ายข้อมูลสำนักงานกฎหมาย (ต้องมีคอลัมน์ '+
      'ทนายความ/ประเภทคดี ร่วมกับ ชั่วโมงเรียกเก็บ/ยอดเรียกเก็บ) — ลองเลือก Template เป็น "Auto" '+
      'หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้','This data has no law-firm columns (an attorney / practice-area column together with billable hours / amount billed is required) — try setting Template to "Auto" or upload data that has these columns')+'</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('lawfirm-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='legal'){ suppressLayout(); return; }
    var scl=q('#lawfirmControlLayout'); if(scl) scl.classList.remove('lawfirm-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='lawfirmControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='lawfirmControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows, today=new Date(); today.setHours(0,0,0,0);
    var openMatters=rows.filter(function(r){var b=statusBucket(r.status);return b==='open'||b==='other'||b==='unknown';}).length;
    var totalHours=rows.reduce(function(s,r){return s+r.billableHours;},0);
    var totalBilled=rows.reduce(function(s,r){return s+r.billed;},0);
    var totalCollected=rows.reduce(function(s,r){return s+r.collected;},0);
    var collectionRate=totalBilled>0?(totalCollected/totalBilled*100):null;
    var crClass=collectionRate==null?'':collectionRate<80?' bad':collectionRate<90?' warn':'';

    q('#lfKpis').innerHTML=
      '<div class="lf-kpi"><div class="l">Open Matters</div><div class="v">'+openMatters+'</div><div class="s">'+L('คดี/งานที่ยังเปิดอยู่','Matters still open')+'</div></div>'+
      '<div class="lf-kpi"><div class="l">Billable Hours</div><div class="v">'+Math.round(totalHours).toLocaleString()+'</div><div class="s">'+L('ชั่วโมงสะสมทั้งหมด','Total cumulative hours')+'</div></div>'+
      '<div class="lf-kpi"><div class="l">'+L('ยอดเรียกเก็บ','Amount billed')+'</div><div class="v">'+baht(totalBilled)+'</div><div class="s">'+L('สะสมทั้งหมด','Cumulative')+'</div></div>'+
      '<div class="lf-kpi"><div class="l">'+L('ยอดจัดเก็บได้จริง','Amount collected')+'</div><div class="v">'+baht(totalCollected)+'</div><div class="s">'+L('สะสมทั้งหมด','Cumulative')+'</div></div>'+
      '<div class="lf-kpi'+crClass+'"><div class="l">Collection Rate</div><div class="v">'+(collectionRate==null?'—':collectionRate.toFixed(0)+'%')+'</div><div class="s">'+L('จัดเก็บได้ / เรียกเก็บ','Collected / billed')+'</div></div>';

    var statusText=collectionRate!=null&&collectionRate<80?L('ต้องเร่งติดตามการจัดเก็บเงิน','Collections need urgent follow-up'):openMatters>0?L('มีคดีเปิดอยู่หลายรายการ','Several matters are open'):L('อยู่ในเกณฑ์ปกติ','Within normal range');
    q('#lfInsight').innerHTML=L('สถานะโดยรวม <b>'+statusText+'</b> — มี <b>'+openMatters+' คดี</b> ที่ยังเปิดอยู่ เรียกเก็บรวม <b>'+baht(totalBilled)+'</b>'+(collectionRate!=null?' Collection Rate <b>'+collectionRate.toFixed(0)+'%</b>':'')+'.','Overall status <b>'+statusText+'</b> — <b>'+openMatters+' matters</b> are still open, total billed <b>'+baht(totalBilled)+'</b>'+(collectionRate!=null?', collection rate <b>'+collectionRate.toFixed(0)+'%</b>':'')+'.');

    renderTrend(rows); renderPractice(rows); renderStatus(rows); renderAttorney(rows);

    if(data.hasLitigation){
      q('#lfDeadlineTitle').textContent=L('ความคืบหน้าคดี (37 ขั้นตอนมาตรฐานคดีแพ่ง)','Matter progress (37 standard civil-case steps)');
      renderLitigation(rows, today);
    } else {
      q('#lfDeadlineTitle').textContent=L('กำหนดนัด/เอกสารที่ใกล้ถึง','Upcoming court dates / documents');
      var deadlines=rows.filter(function(r){return r.dueDate && statusBucket(r.status)!=='closed';})
        .sort(function(a,b){return a.dueDate-b.dueDate;}).slice(0,8);
      q('#lfDeadlines').innerHTML=deadlines.length?deadlines.map(function(r){
        var days=Math.round((r.dueDate-today)/86400000);
        var urgency=days<3?'color:var(--ome-err-ink);font-weight:800':days<7?'color:var(--ome-warn-ink);font-weight:700':'color:var(--ome-text-2)';
        var label=days<0?L('เลยกำหนดแล้ว '+Math.abs(days)+' วัน',Math.abs(days)+' days overdue'):days===0?L('วันนี้','Today'):L('อีก '+days+' วัน','In '+days+' days');
        return '<div class="lf-list"><b>'+esc(r.matterId)+(r.client?' · '+esc(r.client):'')+'</b><span>'+esc(r.practiceArea)+' · '+esc(r.attorney)+'</span><span style="'+urgency+'">'+label+'</span></div>';
      }).join(''):'<div class="lf-empty">'+L('ไม่มีกำหนดนัดที่ใกล้ถึง','No upcoming dates')+'</div>';
    }

    q('#lfUpdated').textContent=L('รอบข้อมูลถึง ','Data through ')+fmt(today)+' · '+rows.length.toLocaleString()+L(' คดี/งาน',' matters');
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[LawFirm1]',e);}});
  }

  function init(){
    injectCSS();
    window.TanotReportUtils.onTheme(schedule);
    if(window.OME_LANG&&window.OME_LANG.onChange)window.OME_LANG.onChange(function(){var l=document.getElementById('lawfirmControlLayout');if(l)l.removeAttribute('data-built');schedule();});
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
      var db=e.target.closest&&e.target.closest('.lg-detail');
      if(db) lgOpenDetail(+db.getAttribute('data-lg-idx'));
    },true);
    document.addEventListener('change',function(){setTimeout(schedule,50);},true);
    window.addEventListener('resize',schedule,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
