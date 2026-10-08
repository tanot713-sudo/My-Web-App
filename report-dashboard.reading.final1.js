/* FINAL 1 — Reading Control (new rich domain module, additive)
   Follows the exact pattern of report-dashboard.safety.final1.js: self-contained,
   own column-role detection, auto-activates only when the uploaded sheet looks like
   a personal reading log, inserts its own layout next to the existing
   Projects-section cards without touching them. Does NOT modify any existing
   file, hook, or the table renderer. Reuses the dropdown value "reading" already
   wired in both #dashboardTemplateSel and #domainOverrideSel.

   ตามที่ผู้ใช้ขอ: ย้ายการติดตาม "อ่านหนังสือ/ตำรากฎหมาย" มารวมกับ Reading แทนที่จะแยกเป็น Legal
   ต่างหาก — ไม่ต้องแก้ schema อะไรเพิ่ม เพราะ genre เป็นช่องข้อความอิสระอยู่แล้ว "กฎหมาย" เป็นแค่หนึ่ง
   ในค่าที่ผู้ใช้กรอกได้ตามปกติ ระบบนับ/แสดงในกราฟแนวหนังสือได้ทันทีโดยไม่ต้องแก้โค้ด
   ส่วน "เป้าหมายการอ่าน" ปรับจากมุมมองใน mockup (เทียบเป้าคงที่ 30 เล่ม/ปีซึ่งเป็นตัวเลขสมมติ) เป็น
   "จังหวะการอ่าน" ที่คำนวณจากข้อมูลจริงล้วนๆ (ไม่กุเป้าที่ไม่มีข้อมูลรองรับ) — คาดการณ์ยอดทั้งปีจาก
   จังหวะปัจจุบัน + นับ streak เดือนที่อ่านต่อเนื่อง ทั้งสองอย่างคำนวณได้ตรงจากข้อมูลจริง */
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
  var RD_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+RD_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}

  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  var READING_KW=['reading','ongoing','in progress','กำลังอ่าน','อ่านอยู่'];
  function isCurrentlyReading(status,hasStart,hasFinish){
    var n=text(status).toLowerCase();
    if(READING_KW.some(function(k){return n.indexOf(k)>=0}))return true;
    return hasStart && !hasFinish;
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
      booktitle: roleCol(st,['book title','booktitle','title','ชื่อหนังสือ','ชื่อเรื่อง']),
      finishdate: roleCol(st,['finish date','datefinished','completeddate','finishdate','วันที่อ่านจบ','อ่านจบ']),
      startdate: roleCol(st,['start date','datestarted','startdate','วันที่เริ่มอ่าน','เริ่มอ่าน']),
      pages: roleCol(st,['pages','pagecount','จำนวนหน้า']),
      genre: roleCol(st,['genre','แนวหนังสือ','ประเภทหนังสือ']),
      rating: roleCol(st,['rating','คะแนน','ให้ดาว']),
      author: roleCol(st,['author','ผู้แต่ง','นักเขียน']),
      status: roleCol(st,['status','สถานะ'])
    };
    // Activation gate: ต้องมีชื่อหนังสือ ร่วมกับวันที่อ่านจบ (หรือวันที่เริ่มอ่านถ้ายังไม่จบ)
    if(!c.booktitle || !(c.finishdate||c.startdate)) return ov==='reading' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var rows=st.rows.map(function(r,i){
      var fd=date(c.finishdate?r[c.finishdate.key]:null), sd=date(c.startdate?r[c.startdate.key]:null);
      return {
        raw:r, i:i,
        booktitle: c.booktitle?text(r[c.booktitle.key]):(L('หนังสือ #','Book #')+(i+1)),
        finishDate: fd, startDate: sd,
        pages: c.pages?num(r[c.pages.key]):null,
        genre: c.genre?text(r[c.genre.key])||L('(ไม่ระบุ)','(unspecified)'):L('(ไม่ระบุ)','(unspecified)'),
        rating: c.rating?num(r[c.rating.key]):null,
        author: c.author?text(r[c.author.key]):'',
        status: c.status?text(r[c.status.key]):'',
        reading: isCurrentlyReading(c.status?r[c.status.key]:'', !!sd, !!fd)
      };
    });
    if(rows.length<2) return ov==='reading' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c};
  }

  function injectCSS(){
    if(q('#reading1-css'))return;
    var s=document.createElement('style');s.id='reading1-css';s.textContent=`
#readingControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px;font-family:var(--pc53-font,inherit)}
#readingControlLayout .rd-hero{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-lg);padding:15px 16px;box-shadow:var(--ome-shadow-1)}
#readingControlLayout .rd-hero h2{font-size:var(--ome-fs-md);margin:0}
#readingControlLayout .rd-hero .rd-sub{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:3px}
#readingControlLayout .rd-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#readingControlLayout .rd-kpi{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-md);padding:11px 13px;box-shadow:var(--ome-shadow-1);position:relative}
#readingControlLayout .rd-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:var(--ome-radius-sm);background:var(--ome-ok)}
#readingControlLayout .rd-kpi.warn:after{background:var(--ome-warn)}
#readingControlLayout .rd-kpi .l{font-size:var(--ome-fs-xs);color:var(--ome-text-2);font-weight:700;}
#readingControlLayout .rd-kpi .v{font-size:var(--ome-fs-xl);font-weight:700;margin-top:4px;color:var(--ome-text-1)}
#readingControlLayout .rd-kpi.warn .v{color:var(--ome-warn-ink)}
#readingControlLayout .rd-kpi .s{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:4px}
#readingControlLayout .rd-panel{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-lg);padding:12px;box-shadow:var(--ome-shadow-1)}
#readingControlLayout .rd-panel h3{font-size:var(--ome-fs-sm);margin:0 0 3px;font-weight:700}
#readingControlLayout .rd-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#readingControlLayout .rd-grid>.half{grid-column:span 6}#readingControlLayout .rd-grid>.full{grid-column:1/-1}
#readingControlLayout .rd-insight{border-left:3px solid var(--ome-ok);padding:10px 13px;font-size:var(--ome-fs-xs);color:var(--ome-text-1)}
#readingControlLayout .rd-status-row{display:flex;flex-direction:column;gap:8px}
#readingControlLayout .rd-status-item{display:grid;grid-template-columns:70px 1fr 30px;align-items:center;gap:9px;font-size:var(--ome-fs-xs)}
#readingControlLayout .rd-status-item .lab{display:flex;align-items:center;gap:6px;font-weight:700}
#readingControlLayout .rd-status-item i{width:8px;height:8px;border-radius:50%;display:inline-block}
#readingControlLayout .rd-track{height:7px;border-radius:var(--ome-radius-sm);background:var(--ome-surface-2);overflow:hidden}
#readingControlLayout .rd-track span{display:block;height:100%;border-radius:var(--ome-radius-sm)}
#readingControlLayout .rd-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--ome-border);font-size:var(--ome-fs-xs)}
#readingControlLayout .rd-list:last-child{border-bottom:none}
#readingControlLayout .rd-empty{padding:24px 8px;text-align:center;color:var(--ome-text-2);font-size:var(--ome-fs-xs)}
#readingControlLayout svg text{font-family:var(--pc53-font,inherit)}
#readingControlLayout .rd-trend-scroll{overflow-x:auto}
#readingControlLayout.reading-override-hidden{display:none!important}
.reading-hidden-source{display:none!important}
@media(max-width:1100px){#readingControlLayout .rd-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#readingControlLayout .rd-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#readingControlLayout .rd-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#readingControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='readingControlLayout';
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    layout.innerHTML=
      '<section class="rd-hero"><h2>Reading Control</h2><div class="rd-sub" id="rdUpdated"></div></section>'+
      '<div class="rd-kpis" id="rdKpis"></div>'+
      '<section class="rd-panel rd-insight-panel"><h3>Executive Insight</h3><div id="rdInsight" class="rd-insight"></div></section>'+
      '<section class="rd-panel" id="rdPace"><h3>'+L('จังหวะการอ่าน','Reading pace')+'</h3><div id="rdPaceBody"></div></section>'+
      '<div class="rd-grid">'+
        '<section class="rd-panel full"><h3>'+L('หนังสือที่อ่านจบรายเดือน','Books finished per month')+'</h3><div id="rdTrend"></div></section>'+
        '<section class="rd-panel half"><h3>'+L('แนวหนังสือที่อ่านมากที่สุด','Most-read genres')+'</h3><div id="rdGenre"></div></section>'+
        '<section class="rd-panel half"><h3>'+L('การกระจายคะแนนรีวิว','Rating distribution')+'</h3><div id="rdRating"></div></section>'+
        '<section class="rd-panel full"><h3>'+L('หนังสือที่อ่านจบล่าสุด','Recently finished books')+'</h3><div id="rdRecent"></div></section>'+
      '</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('reading-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function barListHtml(entries,color){
    if(!entries.length)return '<div class="rd-empty">'+L('ไม่มีข้อมูล','No data')+'</div>';
    var w=460,rowH=26,h=14+entries.length*rowH,left=118,right=34,barW=w-left-right;
    var maxV=Math.max.apply(null,entries.map(function(e){return e[1];}))||1;
    var out=svgOpen(w,h);
    entries.forEach(function(e,i){
      var y=10+i*rowH, bw=Math.max(2,barW*e[1]/maxV);
      out+='<text x="'+(left-8)+'" y="'+(y+13)+'" text-anchor="end" font-size="10.5" fill="'+P().text+'"><title>'+esc(e[0])+'</title>'+esc(e[0].length>16?e[0].slice(0,15)+'…':e[0])+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="16" rx="4" fill="'+P().surface2+'"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="16" rx="4" fill="'+color+'"/>';
      out+='<text x="'+(left+bw+6)+'" y="'+(y+13)+'" font-size="10.5" font-weight="700" fill="'+P().text+'">'+e[1]+'</text>';
    });
    out+='</svg>';
    return out;
  }

  function renderTrend(finished){
    var host=q('#rdTrend'); if(!host)return;
    var byMonth={}; finished.forEach(function(r){ var k=monthKey(r.finishDate); byMonth[k]=(byMonth[k]||0)+1; });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="rd-empty">'+L('ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)','Not enough data for a trend (at least 2 months needed)')+'</div>';return;}
    var perM=64,left=40,right=30,top=14,bottom=26,ph=170;
    var w=Math.max(400,left+right+keys.length*perM), h=top+ph+bottom, pw=w-left-right;
    var maxV=1; keys.forEach(function(k){maxV=Math.max(maxV,byMonth[k]);});
    maxV=Math.ceil(maxV*1.15)||1;
    var bw=Math.min(34,perM*0.55), step=pw/keys.length;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=maxV*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="'+P().grid+'" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="'+P().faint+'">'+Math.round(val)+'</text>';
    }
    keys.forEach(function(k,i){
      var x=left+step*i+(step-bw)/2, v=byMonth[k], h2=ph*v/maxV;
      out+='<rect x="'+x+'" y="'+(top+ph-h2)+'" width="'+bw+'" height="'+h2+'" fill="'+P().series[0]+'"/>';
      out+='<text x="'+(x+bw/2)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="'+P().faint+'">'+k+'</text>';
    });
    out+='</svg>';
    host.innerHTML='<div class="rd-trend-scroll">'+out+'</div>';
  }

  function renderGenre(rows){
    var host=q('#rdGenre'); if(!host)return;
    var map={}; rows.forEach(function(r){ map[r.genre]=(map[r.genre]||0)+1; });
    var entries=Object.keys(map).map(function(k){return [k,map[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    host.innerHTML=barListHtml(entries,P().series[0]);
  }

  function renderRating(finished){
    var host=q('#rdRating'); if(!host)return;
    var rated=finished.filter(function(r){return r.rating!=null;});
    if(!rated.length){host.innerHTML='<div class="rd-empty">'+L('ไม่มีข้อมูลคะแนนรีวิว','No rating data')+'</div>';return;}
    var buckets={5:0,4:0,3:0,'≤2':0};
    rated.forEach(function(r){ var v=Math.round(r.rating); if(v>=5)buckets[5]++; else if(v===4)buckets[4]++; else if(v===3)buckets[3]++; else buckets['≤2']++; });
    var total=rated.length;
    var vals=[['5','5 '+L('ดาว','stars'),buckets[5],P().ok],['4','4 '+L('ดาว','stars'),buckets[4],P().series[2]],['3','3 '+L('ดาว','stars'),buckets[3],P().warn],['2','≤2 '+L('ดาว','stars'),buckets['≤2'],P().err]];
    var out='<div class="rd-status-row">';
    vals.forEach(function(v){
      var pct=(v[2]/total*100).toFixed(0);
      out+='<div class="rd-status-item"><span class="lab"><i style="background:'+v[3]+'"></i>'+v[1]+'</span><div class="rd-track"><span style="width:'+pct+'%;background:'+v[3]+'"></span></div><b>'+v[2]+'</b></div>';
    });
    out+='</div>';
    host.innerHTML=out;
  }

  function renderPace(finished){
    var host=q('#rdPaceBody'); if(!host)return;
    if(!finished.length){host.innerHTML='<div class="rd-empty">'+L('ยังไม่มีหนังสือที่อ่านจบ','No finished books yet')+'</div>';return;}
    var now=new Date();
    var yearBooks=finished.filter(function(r){return r.finishDate.getFullYear()===now.getFullYear();});
    // streak: นับเดือนต่อเนื่องที่มีอย่างน้อย 1 เล่ม ไล่ย้อนจากเดือนล่าสุดที่มีข้อมูล
    var monthSet={}; finished.forEach(function(r){ monthSet[monthKey(r.finishDate)]=true; });
    var latest=finished.reduce(function(m,r){return r.finishDate>m?r.finishDate:m;},finished[0].finishDate);
    var streak=0, cursor=new Date(latest.getFullYear(),latest.getMonth(),1);
    while(monthSet[monthKey(cursor)]){ streak++; cursor.setMonth(cursor.getMonth()-1); }
    var monthsElapsed=Math.max(1,now.getMonth()+1);
    var projected=yearBooks.length?Math.round(yearBooks.length/monthsElapsed*12):0;
    var totalPages=finished.reduce(function(s,r){return s+(r.pages||0);},0);
    var dateSpanDays=Math.max(1,Math.round((finished.reduce(function(m,r){return r.finishDate>m?r.finishDate:m;},finished[0].finishDate)-finished.reduce(function(m,r){return r.finishDate<m?r.finishDate:m;},finished[0].finishDate))/86400000));
    var pagesPerDay=totalPages>0?(totalPages/dateSpanDays).toFixed(0):null;
    host.innerHTML='<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'+
      '<div style="font-size:var(--ome-fs-xs);color:var(--ome-text-2);white-space:nowrap">'+L('ปีนี้อ่านจบแล้ว','Finished this year')+' <b style="color:var(--ome-text-1)">'+yearBooks.length+L(' เล่ม',' books')+'</b></div>'+
      '<div style="font-size:var(--ome-fs-xs);color:var(--ome-text-2);white-space:nowrap">'+L('คาดการณ์ทั้งปี','Projected for the year')+' <b style="color:var(--ome-text-1)">~'+projected+L(' เล่ม',' books')+'</b>'+L(' ถ้ารักษาจังหวะนี้',' at this pace')+'</div>'+
      '<div style="font-size:var(--ome-fs-xs);color:var(--ome-text-2);white-space:nowrap">'+L('อ่านต่อเนื่อง','Reading streak')+' <b style="color:var(--ome-text-1)">'+streak+L(' เดือน',' months')+'</b></div>'+
      (pagesPerDay?'<div style="font-size:var(--ome-fs-xs);color:var(--ome-text-2);white-space:nowrap">'+L('เฉลี่ย','Average')+' <b style="color:var(--ome-text-1)">'+pagesPerDay+L(' หน้า/วัน',' pages/day')+'</b></div>':'')+
    '</div>';
  }

  function stars(r){ var v=Math.round(r||0); return v>0?'★'.repeat(v)+'☆'.repeat(Math.max(0,5-v)):'—'; }

  function suppressLayout(){
    var layout=q('#readingControlLayout');
    if(layout) layout.classList.add('reading-override-hidden');
    qa('.reading-hidden-source').forEach(function(e){ e.classList.remove('reading-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้ */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='reading'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'readingControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="rd-panel"><h3>Reading Control</h3>'+
      '<div class="rd-empty">'+L('ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่ายบันทึกการอ่านหนังสือ (ต้องมีคอลัมน์ '+
      'ชื่อหนังสือ ร่วมกับ วันที่อ่านจบ/เริ่มอ่าน) — ลองเลือก Template เป็น "Auto" หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้','This data has no reading-log columns (a book title column together with finish / start date is required) — try setting Template to "Auto" or upload data that has these columns')+'</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('reading-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='reading'){ suppressLayout(); return; }
    var scl=q('#readingControlLayout'); if(scl) scl.classList.remove('reading-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='readingControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='readingControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows;
    var finished=rows.filter(function(r){return r.finishDate;});
    var totalBooks=finished.length;
    var totalPages=finished.reduce(function(s,r){return s+(r.pages||0);},0);
    var rated=finished.filter(function(r){return r.rating!=null;});
    var avgRating=rated.length?(rated.reduce(function(s,r){return s+r.rating;},0)/rated.length):null;
    var currentlyReading=rows.filter(function(r){return r.reading;}).length;
    var monthsSpan=Object.keys(finished.reduce(function(m,r){m[monthKey(r.finishDate)]=1;return m;},{})).length||1;

    q('#rdKpis').innerHTML=
      '<div class="rd-kpi"><div class="l">'+L('หนังสือที่อ่านจบ','Books finished')+'</div><div class="v">'+totalBooks+'</div><div class="s">'+L('เล่ม','books')+'</div></div>'+
      '<div class="rd-kpi"><div class="l">'+L('หน้ารวมที่อ่าน','Total pages read')+'</div><div class="v">'+totalPages.toLocaleString()+'</div><div class="s">'+L('หน้า','pages')+'</div></div>'+
      '<div class="rd-kpi"><div class="l">'+L('คะแนนเฉลี่ย','Average rating')+'</div><div class="v">'+(avgRating==null?'—':avgRating.toFixed(1)+' ★')+'</div><div class="s">'+L('จาก 5 ดาว','out of 5 stars')+'</div></div>'+
      '<div class="rd-kpi'+(currentlyReading?' warn':'')+'"><div class="l">'+L('กำลังอ่านอยู่','Currently reading')+'</div><div class="v">'+currentlyReading+'</div><div class="s">'+L('เล่ม','books')+'</div></div>'+
      '<div class="rd-kpi"><div class="l">'+L('เฉลี่ย/เดือน','Average per month')+'</div><div class="v">'+(totalBooks/monthsSpan).toFixed(1)+'</div><div class="s">'+L('เล่มต่อเดือน','books per month')+'</div></div>';

    var topGenre=(function(){var m={};finished.forEach(function(r){m[r.genre]=(m[r.genre]||0)+1;});var best=null;Object.keys(m).forEach(function(k){if(!best||m[k]>m[best])best=k;});return best;})();
    q('#rdInsight').innerHTML=L('สถานะโดยรวม <b>อ่านสม่ำเสมอ</b> — อ่านจบไปแล้ว <b>'+totalBooks+' เล่ม</b> รวม <b>'+totalPages.toLocaleString()+' หน้า</b>'+(avgRating!=null?' คะแนนเฉลี่ย <b>'+avgRating.toFixed(1)+' ดาว</b>':'')+(topGenre?' แนวที่อ่านมากที่สุดคือ <b>'+esc(topGenre)+'</b>':'')+'.','Overall status <b>reading steadily</b> — finished <b>'+totalBooks+' books</b>, <b>'+totalPages.toLocaleString()+' pages</b> in total'+(avgRating!=null?', average rating <b>'+avgRating.toFixed(1)+' stars</b>':'')+(topGenre?', most-read genre <b>'+esc(topGenre)+'</b>':'')+'.');

    renderPace(finished);
    renderTrend(finished); renderGenre(rows); renderRating(finished);

    var recent=finished.slice().sort(function(a,b){return b.finishDate-a.finishDate;}).slice(0,10);
    q('#rdRecent').innerHTML=recent.length?recent.map(function(r){
      return '<div class="rd-list"><b>'+esc(r.booktitle)+'</b><span>'+esc(r.author||'')+(r.author&&r.genre?' · ':'')+esc(r.genre)+'</span><span style="font-weight:700">'+stars(r.rating)+'</span></div>';
    }).join(''):'<div class="rd-empty">'+L('ไม่มีข้อมูล','No data')+'</div>';

    var today=new Date();
    q('#rdUpdated').textContent=L('รอบข้อมูลถึง ','Data through ')+fmt(today)+' · '+rows.length.toLocaleString()+L(' รายการ',' items');
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[Reading1]',e);}});
  }

  function init(){
    injectCSS();
    window.TanotReportUtils.onTheme(schedule);
    if(window.OME_LANG&&window.OME_LANG.onChange)window.OME_LANG.onChange(function(){var l=document.getElementById('readingControlLayout');if(l)l.removeAttribute('data-built');schedule();});
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
