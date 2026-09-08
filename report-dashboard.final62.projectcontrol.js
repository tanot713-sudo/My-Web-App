/* FINAL 62 — Executive Project Control visual match + robust startup + Gantt per-bar colors
   Standalone JavaScript. Load after the existing dashboard scripts.
   Table renderer is intentionally untouched.
*/
(function(){
  'use strict';


  /* Final 53 Design System: editable labels, font, sizing, colors and row density. */
  var DESIGN_KEY='tanot.projectcontrol.final62.design';
  var GANTT={scale:'month',zoom:1};
  var DESIGN_DEFAULTS={
    fontFamily:'Prompt',fontSize:13,headingSize:15,rowHeight:44,projectWidth:240, /* Stage 7 (ตามที่ผู้ใช้ขอ): เพิ่มความสูงต่อแถวเล็กน้อย (38→44) ให้แต่ละแถวใน Gantt มีช่องว่างหายใจมากขึ้น */
    cardRadius:12,sectionGap:14,chartFontSize:11,cardPadding:14,actual:'#1C5CAB',plan:'#94A3B8',onTrack:'#16A34A',risk:'#F59E0B',delayed:'#DC2626',monitoring:'#64748B',today:'#DC2626',grid:'#E3E7EC',textColor:'#4B5763',
    barColors:{},title:'Project Control',attention:'Attention',gantt:'Project Gantt / Timeline',progress:'Progress vs Plan',status:'Project Health / Status',health:'Project Health',upcoming:'Milestones / Upcoming',forecast:'Forecast Finish',cost:'Cost / Value',trend:'Progress Trend'
  };
  function getDesign(){
    try{
      var raw=localStorage.getItem(DESIGN_KEY);
      if(!raw){
        var old=localStorage.getItem('tanot.projectcontrol.final61.design')||localStorage.getItem('tanot.projectcontrol.final60.design')||localStorage.getItem('tanot.projectcontrol.final59.design')||localStorage.getItem('tanot.projectcontrol.final58.design')||localStorage.getItem('tanot.projectcontrol.final54.design')||localStorage.getItem('tanot.projectcontrol.final53.design')||localStorage.getItem('tanot.projectcontrol.final51.design');
        if(old){raw=old;localStorage.setItem(DESIGN_KEY,old);}
      }
      return Object.assign({},DESIGN_DEFAULTS,JSON.parse(raw||'{}'));
    }catch(e){return Object.assign({},DESIGN_DEFAULTS);}
  }
  function saveDesign(d){try{localStorage.setItem(DESIGN_KEY,JSON.stringify(d));}catch(e){}}
  function designTitle(k){return esc(getDesign()[k]||DESIGN_DEFAULTS[k]||'');}
  function designVar(k){return 'var(--pc54-'+k+')';}
  function barColor(name){
    var d=getDesign(),m=d.barColors||{},c=m[text(name)];
    return /^#[0-9a-fA-F]{6}$/.test(c||'')?c:d.actual;
  }
  function safeColor(c,fallback){return /^#[0-9a-fA-F]{6}$/.test(c||'')?c:fallback;}
  function applyDesign53(){
    var d=getDesign(),r=document.documentElement;
    var font=d.fontFamily==='Prompt'?"'Prompt',Arial,sans-serif":d.fontFamily==='Sarabun'?"'Sarabun',Tahoma,sans-serif":d.fontFamily==='Arial'?'Arial,sans-serif':d.fontFamily==='Tahoma'?'Tahoma,sans-serif':"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    r.style.setProperty('--pc53-font',font);r.style.setProperty('--pc53-font-size',d.fontSize+'px');r.style.setProperty('--pc53-heading-size',d.headingSize+'px');r.style.setProperty('--pc53-row-height',d.rowHeight+'px');r.style.setProperty('--pc53-project-width',d.projectWidth+'px');r.style.setProperty('--pc53-card-radius',(d.cardRadius||12)+'px');r.style.setProperty('--pc53-section-gap',(d.sectionGap||14)+'px');r.style.setProperty('--pc53-chart-font-size',(d.chartFontSize||11)+'px');r.style.setProperty('--pc53-card-padding',(d.cardPadding||14)+'px');
    ['actual','plan','onTrack','risk','delayed','monitoring','today'].forEach(function(k){r.style.setProperty('--pc54-'+k,d[k]);});r.style.setProperty('--pc54-grid',d.grid);r.style.setProperty('--pc54-textColor',d.textColor);
  }

  var raf=0, scheduled=false, lastSignature='', bootAttempts=0, bootTimer=0;
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
  function pct(v){
    var n=num(v);
    if(n==null)return null;
    if(Math.abs(n)<=1.000001)n*=100;
    return Math.max(0,Math.min(100,n));
  }
  function date(v){
    if(v==null||v==='')return null;
    if(v instanceof Date && !isNaN(v))return new Date(v.getTime());
    var s=text(v), m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(m){var y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]);}
    var iso=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if(iso)return new Date(+iso[1],+iso[2]-1,+iso[3]);
    var n=Number(s);
    if(isFinite(n)&&n>20000&&n<80000)return new Date(Date.UTC(1899,11,30)+n*86400000);
    var d=new Date(s);
    return isNaN(d)?null:d;
  }
  /* Stage 5 (ตามที่ผู้ใช้ขอ): toLocaleDateString('en-GB',...) ย่อเดือนกันยายนเป็น "Sept" (4 ตัวอักษร)
     ในขณะที่เดือนอื่นย่อ 3 ตัวอักษรหมด ทำให้คอลัมน์ Due (และวันที่อื่นๆ ที่ใช้ fmt() ร่วมกัน) จัดแนวไม่
     ตรงกัน ใช้ตารางชื่อย่อเดือนคงที่ 3 ตัวอักษรเองแทน */
  var GANTT_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+GANTT_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function roleCol(st,role,words){
    var key=st.bi&&st.bi.model&&st.bi.model.roles?st.bi.model.roles[role]:null;
    if(key){
      var c=(st.columns||[]).find(function(x){return x.key===key});
      if(c)return c;
    }
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  function getData(){
    var A=window.TanotDashboard;
    if(!A||typeof A.getState!=='function')return null;
    var st=A.getState();
    if(!st)return null;
    if(!Array.isArray(st.rows)){
      if(Array.isArray(st.data)) st.rows=st.data;
      else if(Array.isArray(st.records)) st.rows=st.records;
    }
    if(!Array.isArray(st.rows)||!st.rows.length)return null;
    var c={
      start:roleCol(st,'start',['start','start date','เริ่ม','วันที่เริ่ม']),
      end:roleCol(st,'end',['finish','end','end date','สิ้นสุด','กำหนดเสร็จ']),
      task:roleCol(st,'task',['task name','task','กิจกรรม','งาน','ชื่อ']),
      project:roleCol(st,'project',['project name','project','โครงการ']),
      actual:roleCol(st,'actual',['actual','actual progress','progress','complete','% complete','ความคืบหน้า']),
      plan:roleCol(st,'plan',['plan','planned','planned progress','% plan','แผน']),
      status:roleCol(st,'status',['status','สถานะ']),
      cost:roleCol(st,'cost',['cost','actual cost','repair cost','value','มูลค่า']),
      assignee:roleCol(st,'assignee',['assignee','responsible','owner','ผู้รับผิดชอบ','ผู้ดูแล','ผู้ปฏิบัติงาน'])
    };
    var rows=st.rows.map(function(r,i){
      var s=date(c.start?r[c.start.key]:null), e=date(c.end?r[c.end.key]:null);
      var a=c.actual?pct(r[c.actual.key]):null, p=c.plan?pct(r[c.plan.key]):null;
      var name=text(c.project?r[c.project.key]:c.task?r[c.task.key]:'')||('Project '+(i+1));
      /* Stage 4b (ตามที่ผู้ใช้ขอ): ตาราง "Tracked Tasks" ต้องการคอลัมน์ผู้รับผิดชอบ แต่ไฟล์ตาราง WBS/
         Gantt ทั่วไปมักไม่มีคอลัมน์นี้ — ถ้าหาไม่เจอให้ใช้ชื่อโครงการ/งานแทนตามที่ขอ ไม่ปล่อยว่าง */
      var assignee=text(c.assignee?r[c.assignee.key]:'')||name;
      return {
        raw:r,name:name,start:s,end:e,
        actual:a,plan:p,assignee:assignee,
        status:text(c.status?r[c.status.key]:''),
        cost:c.cost?num(r[c.cost.key]):null
      };
    });
    return {st:st,rows:rows,cols:c};
  }

  /* Critical fix: completed projects are never marked Delayed just because
     their status text contains a stale "delay" label. */
  function health(r,today){
    var a=r.actual, p=r.plan;
    var s=r.status.toLowerCase();
    if(a!=null && a>=99.5) return ['Completed','good'];
    if(/complete|closed|done|เสร็จ|ปิด/.test(s)) return ['Completed','good'];
    var days=r.end?Math.ceil((r.end-today)/86400000):99999;
    var lag=(a!=null&&p!=null)?a-p:0;
    if(/overdue|late|delay|ล่าช้า|เกิน/.test(s)||days<0) return ['Delayed','bad'];
    if(days<=14||lag<-15) return ['At Risk','warn'];
    if(a!=null&&p!=null&&lag>=-5) return ['On Track','good'];
    return ['Monitoring','info'];
  }

  function svgOpen(w,h){return '<svg width=\"'+w+'\" height=\"'+h+'\" viewBox=\"0 0 '+w+' '+h+'\" preserveAspectRatio=\"xMinYMin meet\" role=\"img\" aria-label=\"Project chart\" style=\"display:block;max-width:none;height:'+h+'px;width:'+w+'px\">'}
  // Shared SVG line helper. Final 58 referenced this helper but did not define it, which stopped all Project Control charts after KPI rendering.
  function line(x1,y1,x2,y2,stroke,width,dash){return '<line x1=\"'+x1+'\" y1=\"'+y1+'\" x2=\"'+x2+'\" y2=\"'+y2+'\" stroke=\"'+stroke+'\" stroke-width=\"'+(width||1)+'\"'+(dash?' stroke-dasharray=\"'+dash+'\"':'')+' />';}

  function renderProgress(rows){
    var host=q('#f53Progress'); if(!host)return;
    var data=rows.filter(function(r){return r.actual!=null||r.plan!=null})
      .sort(function(a,b){
        var la=(a.actual==null||a.plan==null)?0:a.actual-a.plan;
        var lb=(b.actual==null||b.plan==null)?0:b.actual-b.plan;
        return la-lb;
      });
    if(!data.length){host.innerHTML='<div class="f53-empty">No project progress data.</div>';return;}
    var w=900,rowH=30,h=42+data.length*rowH,left=185,right=82,barW=w-left-right;
    var d=getDesign(),out=svgOpen(w,h);
    [0,25,50,75,100].forEach(function(v){
      var x=left+barW*v/100;
      out+=line(x,18,x,h-8,designVar('grid'),1);
      out+='<text x="'+x+'" y="12" text-anchor="middle" font-size="9" fill="'+designVar('textColor')+'">'+v+'%</text>';
    });
    data.forEach(function(r,i){
      var y=25+i*rowH,av=r.actual==null?0:r.actual,pl=r.plan==null?null:r.plan;
      var hh=health(r,new Date());
      var statusColor=hh[1]==='bad'?designVar('delayed'):hh[1]==='warn'?designVar('risk'):hh[1]==='info'?designVar('monitoring'):designVar('onTrack');
      var short=r.name.length>28?r.name.slice(0,27)+'…':r.name;
      out+='<text x="'+(left-8)+'" y="'+(y+12)+'" text-anchor="end" font-size="10" fill="'+designVar('textColor')+'"><title>'+esc(r.name)+'</title>'+esc(short)+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="10" rx="5" fill="#EEF1F4"/>';
      if(pl!=null)out+='<rect x="'+left+'" y="'+y+'" width="'+(barW*pl/100)+'" height="10" rx="5" fill="'+designVar('plan')+'" opacity=".45"/>';
      if(r.actual!=null)out+='<rect x="'+left+'" y="'+y+'" width="'+(barW*av/100)+'" height="10" rx="5" fill="'+designVar('actual')+'"/>';
      if(pl!=null){var px=left+barW*pl/100;out+=line(px,y-3,px,y+18,designVar('plan'),2);}
      var delta=(r.actual!=null&&r.plan!=null)?r.actual-r.plan:null;
      var txt=r.actual==null?'—':r.actual.toFixed(1)+'%';
      var deltaTxt=delta==null?'':(delta>=0?'+':'')+delta.toFixed(1)+'%';
      out+='<text x="'+(w-5)+'" y="'+(y+10)+'" text-anchor="end" font-size="10" font-weight="800" fill="'+statusColor+'">'+txt+(deltaTxt?' '+deltaTxt:'')+'</text>';
    });
    out+='</svg><div class="f53-legend"><span><i class="f53-plan"></i>Plan marker / plan level</span><span><i class="f53-actual"></i>Actual</span><span>Δ = Actual − Plan</span></div>';
    host.innerHTML='<div class="pc58-scroll-box pc58-progress-scroll">'+out+'</div>';
  }

  function renderStatus(rows,today){
    var host=q('#f53Status');if(!host)return;
    var counts={good:0,warn:0,bad:0,info:0};
    rows.forEach(function(r){counts[health(r,today)[1]]++;});
    var total=Math.max(1,rows.length);
    var vals=[['good','On Track',counts.good,designVar('onTrack')],['warn','At Risk',counts.warn,designVar('risk')],['bad','Delayed',counts.bad,designVar('delayed')],['info','Monitoring',counts.info,designVar('monitoring')]];
    var out='<div class="f56-status-summary">';
    vals.forEach(function(v){
      var pct=(v[2]/total*100).toFixed(0);
      out+='<div class="f56-status-item"><div class="f56-status-top"><span><i style="background:'+v[3]+'"></i>'+v[1]+'</span><b>'+v[2]+'</b></div><div class="f56-status-track"><span style="width:'+pct+'%;background:'+v[3]+'"></span></div><small>'+pct+'% of projects</small></div>';
    });
    out+='</div><div class="f56-status-message">'+(counts.bad?'🔴 '+counts.bad+' delayed project(s) require action.':counts.warn?'🟠 '+counts.warn+' project(s) are at risk.':'🟢 All projects are currently on track or completed.')+'</div>';
    host.innerHTML=out;
  }

  /* Stage 7 (ตามที่ผู้ใช้ขอ — เปลี่ยนใจจากกราฟแท่งต่อเดือนล้วนในรอบก่อน): ค่าเริ่มต้นดูเป็นรายปี (แท่งน้อย
     ตัวหนังสือเลยใหญ่อ่านง่าย) ถ้าอยากดูรายเดือนให้สลับตัวกรองเอง — โหมดเดือนจะเห็นแค่ ~3 แท่งแรกในความ
     กว้างกล่องเท่าเดิม ที่เหลือต้องเลื่อนดู (ไม่บีบทุกแท่งให้พอดีกล่องเหมือนเดิมอีกต่อไป) */
  var TREND_SCALE='year';
  function renderTrend(rows){
    var host=q('#f53Trend');if(!host)return;
    var groups={};
    rows.forEach(function(r){
      var d=r.end||r.start;if(!d)return;
      var k=TREND_SCALE==='year'?String(d.getFullYear()):d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      if(r.actual!=null)(groups[k]||(groups[k]={a:[],p:[]})).a.push(r.actual);
      if(r.plan!=null)(groups[k]||(groups[k]={a:[],p:[]})).p.push(r.plan);
    });
    var keys=Object.keys(groups).sort();
    var controls='<div class="f61-scale f53-trend-controls"><button type="button" data-trend-scale="year" class="'+(TREND_SCALE==='year'?'active':'')+'">Year</button><button type="button" data-trend-scale="month" class="'+(TREND_SCALE==='month'?'active':'')+'">Month</button></div>';
    if(keys.length<2){host.innerHTML=controls+'<div class="f53-empty">Not enough valid progress points for a trend.</div>';wireTrendControls(host,rows);return;}
    var pts=keys.map(function(k){
      var g=groups[k],label;
      if(TREND_SCALE==='year')label=k;
      else{var yy=+k.slice(0,4),mm=+k.slice(5,7)-1;label=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mm]+" '"+String(yy).slice(2);}
      return {k:k,label:label,a:g.a.length?g.a.reduce(function(s,n){return s+n},0)/g.a.length:null,p:g.p.length?g.p.reduce(function(s,n){return s+n},0)/g.p.length:null};
    });
    var perBar=TREND_SCALE==='year'?130:120, left=46,right=18,top=18,bottom=34,ph=168;
    var w=Math.max(320,left+right+pts.length*perBar), h=top+ph+bottom, pw=w-left-right, out=svgOpen(w,h);
    for(var i=0;i<=5;i++){
      var gy=top+ph*i/5;
      out+=line(left,gy,w-right,gy,designVar('grid'),1);
      out+='<text x="'+(left-8)+'" y="'+(gy+4)+'" text-anchor="end" font-size="11" fill="'+designVar('textColor')+'">'+(100-i*20)+'%</text>';
    }
    var slot=pw/pts.length, barW=Math.min(34,slot*.32), bgap=barW*.22;
    pts.forEach(function(p,i){
      var cx=left+slot*(i+.5);
      if(p.a!=null){
        var ah=ph*Math.max(0,Math.min(100,p.a))/100, ax=cx-bgap/2-barW;
        out+='<rect x="'+ax+'" y="'+(top+ph-ah)+'" width="'+barW+'" height="'+ah+'" rx="3" fill="'+designVar('actual')+'"><title>'+esc(p.label)+' Actual: '+p.a.toFixed(1)+'%</title></rect>';
      }
      if(p.p!=null){
        var phh=ph*Math.max(0,Math.min(100,p.p))/100, px=cx+bgap/2;
        out+='<rect x="'+px+'" y="'+(top+ph-phh)+'" width="'+barW+'" height="'+phh+'" rx="3" fill="'+designVar('plan')+'"><title>'+esc(p.label)+' Plan: '+p.p.toFixed(1)+'%</title></rect>';
      }
      out+='<text x="'+cx+'" y="'+(top+ph+20)+'" text-anchor="middle" font-size="12" font-weight="700" fill="'+designVar('textColor')+'">'+esc(p.label)+'</text>';
    });
    out+=line(left,top+ph,w-right,top+ph,designVar('grid'),1.5);
    out+='</svg>';
    host.innerHTML=controls+'<div class="f53-trend-scroll">'+out+'</div><div class="f53-legend"><span><i class="f53-actual"></i>Actual</span><span><i class="f53-plan"></i>Plan</span><span>'+(TREND_SCALE==='year'?'Yearly average':'Monthly average')+'</span></div>';
    wireTrendControls(host,rows);
  }
  function wireTrendControls(host,rows){
    qa('[data-trend-scale]',host).forEach(function(b){b.onclick=function(){TREND_SCALE=b.getAttribute('data-trend-scale');renderTrend(rows);};});
  }

  /* Stage 4b (เพิ่มตามที่ผู้ใช้ขอ): "Tracked Tasks" — เทียบเท่า "รายการงานที่ติดตาม" ของ AMR O&M template
     (Task/Assignee/Due/Status/Progress) เลือกงานที่ยังไม่เสร็จและใกล้ครบกำหนดที่สุดก่อน ถ้าไม่มีงานที่
     เข้าเงื่อนไขเลย (เช่น ทุกงานเสร็จหมดแล้ว หรือไม่มีวันที่ finish ที่ใช้ได้) ให้ซ่อนทั้งแผงไปเลยตามที่
     ผู้ใช้ขอไว้ ("ถ้าไม่มีข้อมูลก็ไม่ต้องแสดง") */
  function renderTaskTable(rows,today){
    var host=q('#f53TaskTable'),panel=q('#f53TaskTablePanel');if(!host||!panel)return;
    var items=rows.filter(function(r){return r.end&&(r.actual==null||r.actual<99.5);})
      .sort(function(a,b){return a.end-b.end;}).slice(0,8);
    if(!items.length){panel.classList.add('project-control-hidden-source');return;}
    panel.classList.remove('project-control-hidden-source');
    host.innerHTML='<div class="table-wrap"><table><thead><tr><th>Task</th><th>Assignee</th><th>Due</th><th>Status</th><th>Progress</th></tr></thead><tbody>'+
      items.map(function(r){
        var hh=health(r,today),pct=r.actual==null?0:Math.max(0,Math.min(100,r.actual));
        return '<tr><td>'+esc(r.name)+'</td><td class="muted">'+esc(r.assignee)+'</td><td class="num">'+fmt(r.end)+'</td>'+
          '<td><span class="f53-pill '+hh[1]+'">'+hh[0]+'</span></td>'+
          '<td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:'+pct+'%"></div></div><span class="pct">'+pct.toFixed(0)+'%</span></div></td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function renderAnalysis(rows){
    var host=q('#f53Analysis');if(!host)return;
    var metric=(host.getAttribute('data-metric')||'actual'),group=(host.getAttribute('data-group')||'month');
    var opts='<div class="pc58-analysis-controls"><label>Metric<select id="pc58Metric"><option value="actual" '+(metric==='actual'?'selected':'')+'>Actual</option><option value="plan" '+(metric==='plan'?'selected':'')+'>Plan</option><option value="variance" '+(metric==='variance'?'selected':'')+'>Variance</option><option value="spi" '+(metric==='spi'?'selected':'')+'>SPI</option></select></label><label>Group By<select id="pc58Group"><option value="month" '+(group==='month'?'selected':'')+'>Month</option><option value="quarter" '+(group==='quarter'?'selected':'')+'>Quarter</option><option value="status" '+(group==='status'?'selected':'')+'>Status</option><option value="project" '+(group==='project'?'selected':'')+'>Project</option></select></label></div>';
    var items=[];
    rows.forEach(function(r){var v=null;if(metric==='actual')v=r.actual;else if(metric==='plan')v=r.plan;else if(metric==='variance'&&r.actual!=null&&r.plan!=null)v=r.actual-r.plan;else if(metric==='spi'&&r.actual!=null&&r.plan>0)v=r.actual/r.plan; if(v==null)return;var key='';if(group==='project')key=r.name;else if(group==='status')key=health(r,new Date())[0];else if(r.end||r.start){var d=r.end||r.start;key=group==='quarter'?d.getFullYear()+' Q'+(Math.floor(d.getMonth()/3)+1):d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}else return;items.push({key:key,v:v});});
    var map={};items.forEach(function(x){(map[x.key]||(map[x.key]=[])).push(x.v);});
    var keys=Object.keys(map).sort();if(group==='status')keys=['On Track','At Risk','Delayed','Monitoring'].filter(function(k){return map[k]});if(group==='project')keys=keys.slice(0,8);
    var vals=keys.map(function(k){return {k:k,v:map[k].reduce(function(a,b){return a+b},0)/map[k].length};});
    var max=vals.reduce(function(m,x){return Math.max(m,Math.abs(x.v));},0)||1,html=opts+'<div class="pc58-analysis-list">';
    vals.forEach(function(x){var pct=Math.min(100,Math.abs(x.v)/max*100),label=metric==='spi'?x.v.toFixed(2):(metric==='variance'?(x.v>=0?'+':'')+x.v.toFixed(1)+'%':x.v.toFixed(1)+'%');html+='<div class="pc58-analysis-row"><span title="'+esc(x.k)+'">'+esc(x.k)+'</span><div><i style="width:'+pct+'%"></i></div><b>'+label+'</b></div>';});
    html+='</div><div class="pc58-analysis-insight">'+(vals.length?'Average '+esc(metric)+' shown by '+esc(group)+'.':'No data available for this selection.')+'</div>';host.innerHTML=html;
    q('#pc58Metric',host).onchange=function(){host.setAttribute('data-metric',this.value);renderAnalysis(rows);};q('#pc58Group',host).onchange=function(){host.setAttribute('data-group',this.value);renderAnalysis(rows);};
  }

  function renderCost(rows,cols){
    var panel=q('#f53CostPanel'),host=q('#f53Cost');if(!panel||!host)return;
    var valid=rows.filter(function(r){return r.cost!=null});
    if(!cols.cost||!valid.length){panel.style.display='none';return;}
    panel.style.display='';
    var total=valid.reduce(function(s,r){return s+r.cost},0);
    host.innerHTML='<div class="f53-cost-total">'+total.toLocaleString(undefined,{maximumFractionDigits:0})+'</div><div class="f53-cost-label">'+esc(cols.cost.label||'Cost / Value')+'</div><div class="f53-cost-note">Calculated from the currently filtered records.</div>';
  }

  /* Stage 5 (ตามที่ผู้ใช้ขอ): ชื่อโครงการในคอลัมน์ซ้ายของ Gantt เดิมตัดด้วยจำนวนตัวอักษร (42 ตัว) ไม่ใช่
     ความกว้างจริงเป็นพิกเซล ทำให้ภาษาไทย (ตัวอักษรกว้างกว่าโดยเฉลี่ย) ยังล้นหรือถูกตัดจนอ่านไม่ได้ ใช้การ
     ประมาณความกว้างจริงต่อตัวอักษร (Thai/Latin ต่างค่ากัน) แทนการนับตัวอักษรตรงๆ แล้วตัดคำขึ้นบรรทัดใหม่
     ที่ขอบคำ สูงสุด 2 บรรทัด บรรทัดสุดท้ายที่ยังล้นให้ใส่ … ต่อท้าย */
  var GANTT_THAI_COMBINING=/[ัิ-ฺ็-๎]/;
  function ganttCharWidthEm(ch){
    if(GANTT_THAI_COMBINING.test(ch))return 0; // สระ/วรรณยุกต์ลอยซ้อนตัวหน้า ไม่กินความกว้างเพิ่ม
    var c=ch.charCodeAt(0);
    if(c>=0x0E00&&c<=0x0E7F)return 0.58; // อักษรไทยตัวเต็ม
    if(ch===' ')return 0.28;
    if(/[iIl.,:;'|!]/.test(ch))return 0.28;
    if(/[mwMW]/.test(ch))return 0.82;
    if(/[A-Z]/.test(ch))return 0.64;
    if(/[0-9]/.test(ch))return 0.56;
    return 0.5;
  }
  function ganttTextWidth(str,fontSize){
    var w=0;for(var i=0;i<str.length;i++)w+=ganttCharWidthEm(str[i]);
    return w*fontSize;
  }
  function ganttFitLine(str,maxWidth,fontSize){
    if(ganttTextWidth(str,fontSize)<=maxWidth)return str;
    var s=str;
    while(s.length>1&&ganttTextWidth(s+'…',fontSize)>maxWidth)s=s.slice(0,-1);
    return s.replace(/\s+$/,'')+'…';
  }
  function ganttWrapName(name,maxWidth,fontSize){
    var words=text(name).split(/\s+/).filter(Boolean);
    if(!words.length)return [''];
    var lines=[],cur='',i=0;
    while(i<words.length&&lines.length<2){
      var w=words[i],test=cur?cur+' '+w:w;
      if(!cur||ganttTextWidth(test,fontSize)<=maxWidth){cur=test;i++;}
      else{lines.push(cur);cur='';}
    }
    if(cur)lines.push(cur);
    lines=lines.slice(0,2);
    var lastIdx=lines.length-1;
    if(i<words.length||ganttTextWidth(lines[lastIdx],fontSize)>maxWidth){
      lines[lastIdx]=ganttFitLine(lines[lastIdx],maxWidth,fontSize);
    }
    return lines;
  }
  function ganttTickDate(d,scale){var x=new Date(d.getTime());if(scale==='year')x=new Date(x.getFullYear(),0,1);else if(scale==='quarter')x=new Date(x.getFullYear(),Math.floor(x.getMonth()/3)*3,1);else if(scale==='month')x=new Date(x.getFullYear(),x.getMonth(),1);else{var day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));x.setHours(0,0,0,0);}return x;}
  function addMonths(d,n){return new Date(d.getFullYear(),d.getMonth()+n,1)}
  function ganttTicks(min,max,scale){var a=[],d=ganttTickDate(min,scale),guard=0;while(d<=max&&guard++<500){a.push(new Date(d));if(scale==='year')d=new Date(d.getFullYear()+1,0,1);else if(scale==='quarter')d=addMonths(d,3);else if(scale==='month')d=addMonths(d,1);else d=new Date(d.getTime()+604800000);}return a;}
  function ganttTickLabel(d,scale){if(scale==='year')return String(d.getFullYear());if(scale==='quarter')return 'Q'+(Math.floor(d.getMonth()/3)+1)+' '+d.getFullYear();if(scale==='week')return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});return d.toLocaleDateString('en-GB',{month:'short',year:'numeric'});}
  var GANTT_VIEW='priority';
  function ganttHealthRank(r,today){var h=health(r,today)[1];return h==='bad'?0:h==='warn'?1:h==='info'?2:3;}
  function renderGantt(rows,today){
    var host=q('#f53Gantt'); if(!host)return;
    var old=host.querySelector('.f53-gantt-scroll'),savedTop=old?old.scrollTop:0,savedLeft=old?old.scrollLeft:null;
    var all=rows.filter(function(r){return r.start||r.end});
    if(!all.length){host.innerHTML='<div class="f53-empty">No valid Start / Finish dates found.</div>';return;}
    var sorted=all.slice().sort(function(a,b){
      var hr=ganttHealthRank(a,today)-ganttHealthRank(b,today); if(hr)return hr;
      var da=(a.actual!=null&&a.plan!=null)?a.actual-a.plan:0, db=(b.actual!=null&&b.plan!=null)?b.actual-b.plan:0;
      if(da!==db)return da-db; return (a.end||a.start||today)-(b.end||b.start||today);
    });
    var active=sorted.filter(function(r){var h=health(r,today);return h[1]!=='good'||(r.actual!=null&&r.actual<99.5);});
    var data=GANTT_VIEW==='all'?sorted:(active.length?active:sorted).slice(0,12);
    var min=data.reduce(function(m,r){return r.start&&(!m||r.start<m)?r.start:m},null)||today;
    var max=data.reduce(function(m,r){return r.end&&(!m||r.end>m)?r.end:m},null)||today;
    if(max<=min)max=new Date(min.getTime()+86400000);
    var scale=GANTT.scale, zoom=Math.max(.5,Math.min(4,+GANTT.zoom||1)), d=getDesign(), rowH=Math.max(30,+d.rowHeight||38);
    /* Stage 5 (ตามที่ผู้ใช้ขอ): เดิม left ไม่มีระยะกันชนก่อนถึงเส้นแบ่ง/ตาราง ทำให้ชื่อโครงการ+หัวตาราง
       "Project / Activity" ดูชิดตารางเกินไป เพิ่มบัฟเฟอร์ +28px */
    var nameFontSize=Math.max(10,(+d.chartFontSize||11));
    var left=Math.max(255,+d.projectWidth||255)+28, right=245, topAxis=76, bottom=18;
    var nameMaxWidth=left-25-24; // เว้นที่หลังข้อความ 24px ก่อนถึงเส้นแบ่ง
    var nameLines=data.map(function(r){return ganttWrapName(r.name,nameMaxWidth,nameFontSize);});
    var maxNameLines=nameLines.reduce(function(m,l){return Math.max(m,l.length);},1);
    if(maxNameLines>1)rowH+=14; // แถวสูงขึ้นเท่ากันทุกแถว เผื่อที่ให้ชื่อ 2 บรรทัดจัดกึ่งกลางแนวตั้งสมมาตร
    var pad=(max-min)*.035; pad=Math.max(pad,86400000); min=new Date(min-pad); max=new Date(max.getTime()+pad);
    var span=max-min;
    var tickStep=scale==='year'?365*86400000:scale==='quarter'?91*86400000:scale==='month'?30*86400000:7*86400000;
    var ticks=ganttTicks(min,max,scale);
    var minCell=scale==='year'?170:scale==='quarter'?125:scale==='month'?72:92;
    var timeWidth=Math.max(860,ticks.length*minCell*zoom);
    var w=Math.max(left+right+timeWidth,1320), h=topAxis+data.length*rowH+bottom, pw=w-left-right;
    var out=svgOpen(w,h);
    out+='<rect x="0" y="0" width="'+w+'" height="'+h+'" fill="#fff"/>';
    out+='<rect x="0" y="0" width="'+left+'" height="'+h+'" fill="#fbfcfe"/>';
    out+='<rect x="'+(w-right)+'" y="0" width="'+right+'" height="'+h+'" fill="#fbfcfe"/>';
    // Axis: Year is one clean row. Quarter/Month/Week use two rows.
    var periods=[];
    ticks.forEach(function(t,i){
      var next=i<ticks.length-1?ticks[i+1]:(scale==='year'?new Date(t.getFullYear()+1,0,1):scale==='quarter'?addMonths(t,3):scale==='month'?addMonths(t,1):new Date(t.getTime()+604800000));
      var x=left+pw*((t-min)/span), x2=left+pw*((Math.min(next,max)-min)/span);
      if(x2<=left||x>=w-right)return; periods.push({t:t,x:x,x2:x2});
    });
    /* BUGFIX Stage 3: ชื่อโครงการยาวๆ (โดยเฉพาะภาษาไทย) เดิมตัดด้วยจำนวนตัวอักษร (42 ตัว) ไม่ใช่ความกว้าง
       จริงเป็นพิกเซล ถ้าความกว้างจริงของ 42 ตัวอักษรเกินคอลัมน์ซ้าย (left) ตัวหนังสือจะยื่นทับเข้าไปในโซน
       แถบ Gantt แล้วถูก <rect> ของแถบ (วาดทีหลังใน DOM ลำดับ) บังทับจนบางส่วนของตัวอักษรหายไป — ใส่
       clip-path ครอบคอลัมน์ชื่อทั้งหมด (0..left) เพื่อตัดข้อความให้ไม่มีทางล้นออกไปทับแถบได้อีก
       ไม่ว่าความกว้างจริงของชื่อจะเป็นเท่าไหร่ */
    out+='<clipPath id="pc61NameClip"><rect x="0" y="0" width="'+(left-4)+'" height="'+h+'"/></clipPath>';
    /* Stage 6 (ตามที่ผู้ใช้ขอ): ย้ายหัวตาราง "Project / Activity" จากชิดขวา (ติดเส้นแบ่ง) มาอยู่กึ่งกลาง
       คอลัมน์ชื่อทั้งแถบ (0..left) แทน */
    out+='<text x="'+(left/2)+'" y="22" text-anchor="middle" font-size="11" font-weight="800" fill="'+designVar('textColor')+'">Project / Activity</text>';
    /* Stage 7 (บั๊กที่เจอเพิ่ม — ยังหลุดแม้แก้ด้วย Math.max ไปแล้วรอบก่อน): ป้ายปี/ไตรมาส (เช่น "2024"/
       "Q4") จัดกึ่งกลางที่ (p.x+p.x2)/2 ซึ่งไม่ได้ผ่าน Math.max เหมือน rect/เส้น ถ้า tick แรกสุดเริ่มก่อน
       ขอบ min มากๆ จุดกึ่งกลางก็ยังคำนวณได้น้อยกว่า left อยู่ดี ป้ายเลยหลุดไปทับคอลัมน์ชื่อ — แก้อย่าง
       เด็ดขาดด้วย clip-path ครอบทั้งบล็อกแกนเวลา (x ตั้งแต่ left เป็นต้นไป) กันไม่ให้อะไรก็ตามที่วาดในนี้
       มีทางล้นออกไปทับคอลัมน์ชื่อได้อีกไม่ว่าจะคำนวณตำแหน่งผิดพลาดแบบไหน */
    out+='<clipPath id="pc61TimelineClip"><rect x="'+left+'" y="0" width="'+(w-left)+'" height="'+h+'"/></clipPath><g clip-path="url(#pc61TimelineClip)">';
    if(scale==='year'){
      periods.forEach(function(p){
        var gx=Math.max(left,p.x);
        out+=line(gx,0,gx,h-10,designVar('grid'),1);
        out+='<text x="'+((p.x+p.x2)/2)+'" y="28" text-anchor="middle" font-size="12" font-weight="800" fill="'+designVar('textColor')+'">'+p.t.getFullYear()+'</text>';
      });
    }else{
      var groups={};
      periods.forEach(function(p){
        var key=scale==='week'?p.t.getFullYear()+'-'+p.t.getMonth():String(p.t.getFullYear());
        if(!groups[key])groups[key]={x1:p.x,x2:p.x2,label:scale==='week'?p.t.toLocaleDateString('en-US',{month:'short',year:'numeric'}):String(p.t.getFullYear())}; else groups[key].x2=p.x2;
      });
      Object.keys(groups).forEach(function(k){var g=groups[k],rx=Math.max(left,g.x1);out+='<rect x="'+rx+'" y="0" width="'+Math.max(0,g.x2-rx)+'" height="31" fill="#f8fafc"/><text x="'+((g.x1+g.x2)/2)+'" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="'+designVar('textColor')+'">'+esc(g.label)+'</text>';});
      periods.forEach(function(p){
        var gx=Math.max(left,p.x);
        out+=line(gx,31,gx,h-10,designVar('grid'),1);
        var lab=scale==='quarter'?'Q'+(Math.floor(p.t.getMonth()/3)+1):scale==='week'?'W'+isoWeek(p.t):p.t.toLocaleDateString('en-US',{month:'short'});
        out+='<text x="'+((p.x+p.x2)/2)+'" y="52" text-anchor="middle" font-size="10.5" font-weight="700" fill="'+designVar('textColor')+'">'+esc(lab)+'</text>';
        if(scale==='week')out+='<text x="'+((p.x+p.x2)/2)+'" y="67" text-anchor="middle" font-size="9" fill="'+designVar('textColor')+'">'+p.t.toLocaleDateString('en-US',{day:'2-digit'})+'</text>';
      });
      out+=line(left,31,w-right,31,designVar('grid'),1);
    }
    out+='</g>';
    out+=line(left,topAxis-1,w-right,topAxis-1,designVar('grid'),1);
    // Today marker
    var tx=left+pw*Math.max(0,Math.min(1,(today-min)/span));
    out+=line(tx,0,tx,h-8,designVar('today'),2,'5 4');
    out+='<rect x="'+(tx-22)+'" y="3" width="44" height="16" rx="7" fill="'+designVar('today')+'"/><text x="'+tx+'" y="14" text-anchor="middle" font-size="8.5" font-weight="800" fill="#fff">Today</text>';
    // Right data columns
    var colX=w-right;
    ['Actual','Plan','Δ','Status'].forEach(function(lbl,idx){out+='<text x="'+(colX+[28,75,120,175][idx])+'" y="52" text-anchor="middle" font-size="10" font-weight="800" fill="'+designVar('textColor')+'">'+lbl+'</text>';});
    out+=line(colX,0,colX,h-8,designVar('grid'),1);
    /* ตามที่ผู้ใช้ขอ: เดิมแท่ง Gantt วางตายตัวที่ y+5 (นับจากบนแถว) ไม่ได้อิงความสูงแถวจริง (rowH) เลย
       เวลาแถวสูงกว่าปกติ (ชื่อโครงการยาว 2 บรรทัด → rowH+14 ด้านบน) แท่งเลยลอยค้างอยู่ค่อนไปทางขอบบน
       ของกล่อง ไม่อยู่กึ่งกลางแถวเหมือนชื่อโครงการ (ซึ่งใช้ cy=y+rowH/2 กึ่งกลางจริงอยู่แล้ว) — คำนวณ
       barY ให้กึ่งกลางแนวตั้งของแท่ง (สูง 14px) ตรงกับกึ่งกลางแถวเสมอไม่ว่า rowH จะเท่าไหร่ */
    var barH=14, barY=(rowH-barH)/2;
    data.forEach(function(r,i){
      var y=topAxis+i*rowH, s=r.start||min, e=r.end||r.start||max;
      var x1=left+pw*((s-min)/span), x2=left+pw*((e-min)/span), full=Math.max(12,x2-x1);
      var av=r.actual==null?0:Math.max(0,Math.min(100,r.actual)), pl=r.plan==null?null:Math.max(0,Math.min(100,r.plan));
      var actualW=Math.max(3,full*av/100), hh=health(r,today), status=hh[0], statusColor=hh[1]==='bad'?designVar('delayed'):hh[1]==='warn'?designVar('risk'):hh[1]==='info'?designVar('monitoring'):designVar('onTrack');
      var bc=barColor(r.name);
      out+=line(0,y+rowH-1,w-8,y+rowH-1,'#eef2f6',1);
      // project label with colored marker and clipped text (clip-path = คอลัมน์ชื่อจริง กัน bar บังทับ)
      var cy=y+rowH/2, lns=nameLines[i], nameTspans;
      if(lns.length>1){
        nameTspans='<tspan x="25" dy="-0.5em">'+esc(lns[0])+'</tspan><tspan x="25" dy="1.15em">'+esc(lns[1])+'</tspan>';
      }else{
        nameTspans='<tspan x="25" dy="0">'+esc(lns[0])+'</tspan>';
      }
      out+='<g clip-path="url(#pc61NameClip)"><circle cx="14" cy="'+cy+'" r="4" fill="'+bc+'"/><text x="25" y="'+(cy+4)+'" font-size="'+nameFontSize+'" font-weight="600" fill="'+designVar('textColor')+'"><title>'+esc(r.name)+'</title>'+nameTspans+'</text></g>';
      var tip='Project: '+r.name+' | Start: '+fmt(s)+' | Finish: '+fmt(e)+' | Actual: '+(r.actual==null?'—':r.actual.toFixed(1)+'%')+' | Plan: '+(r.plan==null?'—':r.plan.toFixed(1)+'%')+' | Status: '+status;
      // Remaining/plan track is intentionally visible light blue-gray, never white.
      out+='<rect x="'+x1+'" y="'+(y+barY)+'" width="'+full+'" height="'+barH+'" rx="7" fill="#DCE6F0"><title>'+esc(tip)+'</title></rect>';
      out+='<rect x="'+x1+'" y="'+(y+barY)+'" width="'+actualW+'" height="'+barH+'" rx="7" fill="'+bc+'"><title>'+esc(tip)+'</title></rect>';
      if(pl!=null){var px=x1+full*pl/100;out+=line(px,y+barY-3,px,y+barY+barH+3,designVar('plan'),2);}
      var delta=(r.actual!=null&&r.plan!=null)?r.actual-r.plan:null;
      out+='<text x="'+(colX+28)+'" y="'+(y+15)+'" text-anchor="middle" font-size="10" font-weight="800" fill="'+statusColor+'">'+(r.actual==null?'—':r.actual.toFixed(0)+'%')+'</text>';
      out+='<text x="'+(colX+75)+'" y="'+(y+15)+'" text-anchor="middle" font-size="10" fill="'+designVar('textColor')+'">'+(r.plan==null?'—':r.plan.toFixed(0)+'%')+'</text>';
      out+='<text x="'+(colX+120)+'" y="'+(y+15)+'" text-anchor="middle" font-size="10" font-weight="800" fill="'+(delta!=null&&delta<0?designVar('delayed'):designVar('onTrack'))+'">'+(delta==null?'—':(delta>=0?'+':'')+delta.toFixed(1)+'%')+'</text>';
      out+='<circle cx="'+(colX+151)+'" cy="'+(y+12)+'" r="4" fill="'+statusColor+'"/><text x="'+(colX+161)+'" y="'+(y+16)+'" font-size="9.5" font-weight="700" fill="'+statusColor+'">'+esc(status)+'</text>';
    });
    out+='</svg>';
    var controls='<div class="f61-gantt-controls"><div class="f61-filter-group"><button class="f61-chip active" data-g61-view="priority">Priority 12</button><button class="f61-chip" data-g61-view="all">All '+all.length+'</button></div><div class="f61-scale"><button data-g61-scale="year">Year</button><button data-g61-scale="quarter">Quarter</button><button data-g61-scale="month">Month</button><button data-g61-scale="week">Week</button></div><div class="f61-zoom"><span>Zoom</span><button data-g61-zoom="-">−</button><button data-g61-zoom="fit">Fit</button><button data-g61-zoom="+">+</button></div></div>';
    var delayed=sorted.filter(function(r){return health(r,today)[1]==='bad'}).length,risk=sorted.filter(function(r){return health(r,today)[1]==='warn'}).length,completed=sorted.filter(function(r){return r.actual!=null&&r.actual>=99.5;}).length,activeCount=sorted.length-completed;
    /* Stage 5 (ตามที่ผู้ใช้ขอ): ให้แต่ละสถิติมี class ตามความหมาย (delayed/at risk = โทนแดง/ส้มอ่อน)
       แทนกล่องสีเทาเหมือนกันหมด */
    var overallCls=delayed?'bad':risk?'warn':'good';
    var summary='<div class="f61-gantt-summary">'+
      '<div class="f61-stat"><b>'+data.length+'</b><span>shown</span></div>'+
      '<div class="f61-stat"><b>'+all.length+'</b><span>total projects</span></div>'+
      '<div class="f61-stat'+(delayed?' bad':'')+'"><b>'+delayed+'</b><span>delayed</span></div>'+
      '<div class="f61-stat'+(risk?' warn':'')+'"><b>'+risk+'</b><span>at risk</span></div>'+
      '<div class="f61-stat"><b>'+activeCount+'</b><span>active</span></div>'+
      '<div class="f61-stat"><b>'+completed+'</b><span>completed</span></div>'+
      '<div class="f61-stat f61-overall '+overallCls+'"><span>Overall</span><b>'+(delayed?'Needs Attention':risk?'Monitor Closely':'On Track')+'</b></div>'+
      '</div>';
    var legend='<div class="f61-gantt-legend"><span><i class="actual"></i>Actual</span><span><i class="remaining"></i>Plan / remaining</span><span><i class="today"></i>Today</span><span>Δ = Actual − Plan</span></div>';
    /* Stage 5 (ตามที่ผู้ใช้ขอ): ลบแถบ .f61-meta ("29 Nov 2024 → 13 Apr 2027 · 22 shown · year view ·
       zoom 1.0×") ออก — ข้อมูลซ้ำกับ stat chip ด้านบนแล้ว ดูรก */
    host.innerHTML=summary+controls+'<div class="f53-gantt-scroll f61-gantt-scroll">'+out+'</div>'+legend;
    qa('[data-g61-view]',host).forEach(function(b){b.classList.toggle('active',b.getAttribute('data-g61-view')===GANTT_VIEW);b.onclick=function(){GANTT_VIEW=b.getAttribute('data-g61-view');schedule();};});
    qa('[data-g61-scale]',host).forEach(function(b){b.classList.toggle('active',b.getAttribute('data-g61-scale')===GANTT.scale);b.onclick=function(){GANTT.scale=b.getAttribute('data-g61-scale');GANTT.zoom=1;schedule();};});
    qa('[data-g61-zoom]',host).forEach(function(b){b.onclick=function(){var z=b.getAttribute('data-g61-zoom');if(z==='+')GANTT.zoom=Math.min(4,+(GANTT.zoom+.25).toFixed(2));else if(z==='-')GANTT.zoom=Math.max(.5,+(GANTT.zoom-.25).toFixed(2));else GANTT.zoom=1;schedule();};});
    requestAnimationFrame(function(){var e=host.querySelector('.f61-gantt-scroll');if(e){if(savedLeft==null){var focus=left+pw*Math.max(0,Math.min(1,(today-min)/span));e.scrollLeft=Math.max(0,focus-e.clientWidth*.48);}else e.scrollLeft=savedLeft;e.scrollTop=savedTop;}});
  }
  function isoWeek(d){var x=new Date(d.getTime());x.setHours(0,0,0,0);x.setDate(x.getDate()+3-(x.getDay()+6)%7);var w1=new Date(x.getFullYear(),0,4);return 1+Math.round(((x-w1)/86400000-3+(w1.getDay()+6)%7)/7);}

  function injectLayout(){
    var layout=q('#projectControlLayout');
    if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div');
    layout.id='projectControlLayout';
    layout.className='project-control-layout';
    /* Stage 5 (บั๊กที่ยืนยันแล้ว): เดิมไม่เคยติด data-dashboard-section ทำให้ setPage() มองไม่เห็นการ์ดนี้
       เลยแสดงค้างอยู่ทุกแท็บ (Overview/Projects/Analytics/Details) เหมือนกันหมด ทั้งที่ตั้งใจให้อยู่แค่
       แท็บ Projects เท่านั้น */
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-f61-built')==='1')return true;
    layout.setAttribute('data-f61-built','1');
    // ตั้ง data-built มาตรฐานเดียวกับอีก 9 โมดูลด้วย (นอกเหนือจาก data-f61-built ที่ใช้เช็ค idempotency
    // ของตัวเอง) เพื่อให้ mutual-exclusion check ของโมดูลอื่นๆ มองเห็นว่า Project Control ครองพื้นที่อยู่
    // ได้ถูกต้อง (บั๊กเดิม: ใช้ชื่อ attribute ไม่ตรงกัน โมดูลอื่นเลยตรวจไม่เจอเลย)
    layout.setAttribute('data-built','1');
    /* Stage 4 (ตามที่ผู้ใช้ยืนยัน): ตัดส่วนที่ไม่มีอยู่ใน template "Project / KPI Tracking" ของ AMR O&M
       ออกทั้งหมด (Attention grid, Progress vs Plan chart, Project Analysis pivot, Cost/Value, Forecast
       Finish, ตาราง Project Health แบบละเอียดรายโครงการ) เหลือแค่ส่วนที่ template มีจริง แล้วจัดผัง 3
       คอลัมน์ท้ายสุด (Project Health/Status | Milestones/Upcoming | Progress Trend) ให้ตรงกับ template
       เป๊ะ (เดิมแยกเป็น quarter/full/half คนละที่ ไม่ใช่แถวเดียวกัน) */
    /* Stage 5 (ตามที่ผู้ใช้ขอ): ลบข้อความอธิบายที่ผู้ใช้ระบุว่ารกและไม่จำเป็นออกทั้งหมด —
       .pc55-hero-note, panel-note ของ Gantt, .pc55-reading-tip, panel-note ของ Tracked Tasks,
       และแถบ footnote ท้ายหน้า */
    layout.innerHTML=
      '<section class="project-control-hero"><div class="project-control-head"><div><h2>'+designTitle('title')+'</h2></div><button class="pc55-present" id="pc55Present" type="button">Presentation Mode</button><div class="mini" id="f53Updated">Project & schedule overview</div></div></section>'+
      '<div class="project-control-kpis" id="f53Kpis"></div>'+
      '<section class="project-panel f56-insight-panel" id="f61InsightPanel"><div class="f56-insight-title">Executive Insight</div><div id="f56Insight"></div></section>'+
      /* Stage 7 (ตามที่ผู้ใช้ขอ): ที่ว่างสำหรับย้ายกราฟ 2 ตัวจาก Analytics ("Task Name ตามผลรวม WBS" /
         "แนวโน้ม WBS ตามเวลา") เข้ามาไว้ตรงนี้ — relocateAnalyticsCharts() จะย้าย DOM จริงมาใส่ทีหลัง
         (ต้อง reuse class dashboard-12-grid เดิมของการ์ดกราฟ ไม่งั้น dash-span-6 จะไม่มีผลอะไร) */
      '<div class="dashboard-12-grid project-control-charts-row" id="projectControlChartsRow"></div>'+
      '<div class="project-control-main-grid">'+
        '<section class="project-panel full pc55-gantt-panel"><div class="pc55-panel-head"><div><h3>'+designTitle('gantt')+'</h3></div></div><div id="f53Gantt"></div></section>'+
        '<section class="project-panel third"><h3>'+designTitle('status')+'</h3><div class="panel-note">Overview of all projects.</div><div id="f53Status"></div></section>'+
        '<section class="project-panel third"><h3>'+designTitle('upcoming')+'</h3><div id="f53Upcoming"></div></section>'+
        '<section class="project-panel third" id="f53TrendPanel"><div class="pc58-panel-title-row"><div><h3>'+designTitle('trend')+'</h3><div class="panel-note">Actual vs plan trend.</div></div></div><div id="f53Trend"></div></section>'+
        /* Stage 4b (ตามที่ผู้ใช้ขอเพิ่ม): "รายการงานที่ติดตาม" ของ template — เดิมไม่มีแผงนี้เลย
           renderTaskTable() จะซ่อนแผงนี้อัตโนมัติถ้าไม่มีงานที่ต้องติดตาม (ตามที่ผู้ใช้ระบุว่าถ้าไม่มี
           ข้อมูลก็ไม่ต้องแสดง) */
        '<section class="project-panel full" id="f53TaskTablePanel"><div class="pc55-panel-head"><div><h3>Tracked Tasks</h3></div></div><div id="f53TaskTable"></div></section>'+
      '</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#scadaTimelineCard,#projectSpecialGrid,#projectProgressCard,#biProjectControlCard').forEach(function(e){if(e&&e!==layout)e.classList.add('project-control-hidden-source');});
    return true;
  }
  /* Stage 7 (ตามที่ผู้ใช้ขอ): ย้าย DOM จริงของการ์ดกราฟ "Task Name ตามผลรวม" (bar) กับ "แนวโน้มตามเวลา"
     (line) จาก Analytics เข้ามาไว้ใน Project Control (ใต้ Executive Insight เหนือ Gantt ตามลูกศรที่ชี้)
     — ย้าย DOM node จริง (ไม่ใช่ clone/สร้างใหม่) เพื่อให้ตัวเลือกชนิดกราฟ/จัดกลุ่ม/รวมค่าที่ติดมาด้วย,
     event listener, และ Chart.js instance ที่ผูกกับ canvas เดิมยังทำงานถูกต้องเป๊ะเหมือนเดิมทุกอย่าง
     ทำครั้งเดียวพอ (เช็ค parentNode ก่อนย้ายกันย้ายซ้ำ) เพราะ build() แทนที่ innerHTML ของ layout แค่ครั้ง
     เดียวตั้งแต่ต้นอยู่แล้ว */
  function relocateAnalyticsCharts(){
    var row=q('#projectControlChartsRow'); if(!row)return;
    var bar=document.getElementById('barChartCard'), line=document.getElementById('lineChartCard');
    if(bar&&bar.parentNode!==row)row.appendChild(bar);
    if(line&&line.parentNode!==row)row.appendChild(line);
  }
  /* บั๊กที่เจอ (รายงานจากผู้ใช้): เลือก Template = "Maintenance" ในดรอปดาวน์แต่การ์ดที่ขึ้นยังเป็น Project
     Control เหมือนเดิม เพราะโมดูลนี้ไม่เคยเช็ค state.domainOverride เลย ซ่อนด้วยคลาสเฉพาะแทนการ .remove()
     element เพราะ Project Control ย้าย DOM จริงของ bar/lineChartCard (พร้อม Chart.js instance ที่ผูกอยู่)
     เข้ามาไว้ข้างในผ่าน relocateAnalyticsCharts() — ถ้าลบ element ทิ้งจะทำลายกราฟ 2 ตัวนั้นไปด้วย */
  function suppressLayout(){
    var layout=q('#projectControlLayout');
    if(layout) layout.classList.add('pc-override-hidden');
    qa('.project-control-hidden-source').forEach(function(e){ e.classList.remove('project-control-hidden-source'); });
    var trig=q('.pc53-design-trigger'); if(trig) trig.classList.remove('pc53-show');
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้
     (getData() ของโมดูลนี้แทบไม่เคย return null เพราะไม่มีคอลัมน์เกทจริงๆ จึงพึ่ง domainOverride เป็นหลักใน
     การรู้ว่าเมื่อไหร่ควรซ่อนตัวเอง — ไม่ไปแตะ data-f61-built/rebuild โครงสร้างเลย ปลอดภัยต่อกราฟที่ย้าย DOM
     เข้ามาผ่าน relocateAnalyticsCharts() เพราะ suppressLayout() แค่ซ่อนด้วย CSS ไม่ทำลาย element ใดๆ) */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='project'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'projectControlLayout',revalidate:__tdRevalidate});

  function render(){
    scheduled=false;
    var __pc53Scroll=[];
    var __pc53G=document.querySelector('#f53Gantt .f53-gantt-scroll');
    if(__pc53G)__pc53Scroll=[__pc53G.scrollTop,__pc53G.scrollLeft];
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='project'){ suppressLayout(); return; }
    var pcl=q('#projectControlLayout'); if(pcl) pcl.classList.remove('pc-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-f61-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย — โมดูลนี้เดิมไม่มี mutual-exclusion check เลยด้วยซ้ำ (ต่างจาก Safety/HR/IT
       Ops/Maintenance/5 โดเมนใหม่ที่มี) เพิ่มให้ครบตอนนี้ */
    var data=getData();if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='projectControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='projectControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(!build())return;
    var trig=q('.pc53-design-trigger'); if(trig) trig.classList.add('pc53-show');
    relocateAnalyticsCharts();
    var rows=data.rows,today=new Date();today.setHours(0,0,0,0);
    var av=rows.filter(function(r){return r.actual!=null}),pl=rows.filter(function(r){return r.plan!=null});
    var avgA=av.length?av.reduce(function(s,r){return s+r.actual},0)/av.length:null;
    var avgP=pl.length?pl.reduce(function(s,r){return s+r.plan},0)/pl.length:null;
    var spi=avgA!=null&&avgP>0?avgA/avgP:null;
    var hs=rows.map(function(r){return health(r,today)}),good=hs.filter(function(x){return x[1]==='good'}).length,warn=hs.filter(function(x){return x[1]==='warn'}).length,bad=hs.filter(function(x){return x[1]==='bad'}).length;

    q('#f53Kpis').innerHTML=
      '<div class="project-kpi"><div class="pk-label">Projects</div><div class="pk-value">'+rows.length+'</div><div class="pk-sub">Scheduled records</div></div>'+
      '<div class="project-kpi"><div class="pk-label">Actual</div><div class="pk-value">'+(avgA==null?'—':avgA.toFixed(1)+'%')+'</div><div class="pk-sub">Average valid actual</div></div>'+
      '<div class="project-kpi"><div class="pk-label">Plan</div><div class="pk-value">'+(avgP==null?'—':avgP.toFixed(1)+'%')+'</div><div class="pk-sub">Average valid plan</div></div>'+
      '<div class="project-kpi '+(spi==null?'':spi>=1?'good':spi>=.85?'warn':'bad')+'"><div class="pk-label">SPI</div><div class="pk-value">'+(spi==null?'—':spi.toFixed(2))+'</div><div class="pk-sub">Actual / Plan</div></div>'+
      '<div class="project-kpi good"><div class="pk-label">On Track</div><div class="pk-value">'+good+'</div><div class="pk-sub">On track + completed</div></div>'+
      '<div class="project-kpi '+(bad?'bad':warn?'warn':'good')+'"><div class="pk-label">Attention</div><div class="pk-value">'+(bad+warn)+'</div><div class="pk-sub">'+bad+' delayed · '+warn+' at risk</div></div>';

    var statusText=bad?'Needs attention':warn?'Monitor closely':'On track';
    var deltaText=(avgA!=null&&avgP!=null)?((avgA-avgP>=0?'+':'')+(avgA-avgP).toFixed(1)+'% vs plan'):'';
    var insight='Overall status is <b>'+statusText+'</b>. Actual progress is <b>'+(avgA==null?'—':avgA.toFixed(1)+'%')+'</b>'+(avgP==null?'':' vs plan <b>'+avgP.toFixed(1)+'%</b>')+'. '+(deltaText?'<b>'+deltaText+'</b>. ':'')+(bad+warn?'There are <b>'+bad+' delayed</b> and <b>'+warn+' at-risk</b> project(s) requiring attention.':'There are currently <b>no delayed or at-risk projects</b>.');
    var ih=q('#f56Insight');if(ih)ih.innerHTML='<div class="f56-insight-text">'+insight+'</div>';


    renderGantt(rows,today);renderStatus(rows,today);

    var upcoming=rows.filter(function(r){return r.end&&r.end>=today}).sort(function(a,b){return a.end-b.end}).slice(0,8);
    q('#f53Upcoming').innerHTML=upcoming.length?upcoming.map(function(r){return '<div class="f53-list"><b>'+esc(r.name)+'</b><span>'+fmt(r.end)+'</span></div>'}).join(''):'<div class="mini">No upcoming finish dates detected.</div>';

    renderTrend(rows);renderTaskTable(rows,today);
    q('#f53Updated').textContent='Reporting '+fmt(today)+' · '+rows.length.toLocaleString()+' scheduled items';
    if(__pc53Scroll.length){requestAnimationFrame(function(){var e=document.querySelector('#f53Gantt .f53-gantt-scroll');if(e){e.scrollTop=__pc53Scroll[0];e.scrollLeft=__pc53Scroll[1];}});}
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render()}catch(e){console.error('[Final61]',e)}});
  }

  function injectCSS(){
    if(q('#final61-projectcontrol-css'))return;
    var s=document.createElement('style');s.id='final61-projectcontrol-css';s.textContent=`
#projectControlLayout.project-control-layout,#projectControlLayout.project-control-layout *{font-family:var(--pc53-font)}
#projectControlLayout.project-control-layout{font-size:var(--pc53-font-size);display:flex!important;flex-direction:column;gap:12px;margin-top:14px}
/* Stage 8 (บั๊กที่ยืนยันแล้วจากคอนโซลของผู้ใช้ — ต้นตอจริงของ "Project Control โผล่ผิดแท็บ"): กฎด้านบน
   (#projectControlLayout.project-control-layout{display:flex!important}) มี specificity สูงกว่า
   .dashboard-page-hidden{display:none!important} ที่ระบบสลับแท็บใช้ (ID+class ชนะ class เดี่ยว แม้ทั้งคู่
   จะมี !important เหมือนกัน) ผลคือต่อให้ setPage() ใส่ class dashboard-page-hidden ให้ถูกต้องแล้ว
   (ยืนยันจาก console: className มี dashboard-page-hidden ติดอยู่จริง) ก็ยังโดนกฎ display:flex ทับจนแสดง
   อยู่ดี เพิ่มกฎนี้ที่ specificity เท่ากัน (ID+class เหมือนกัน) แต่มาทีหลังในไฟล์เดียวกัน ให้ชนะแทน */
#projectControlLayout.dashboard-page-hidden{display:none!important}
/* บั๊กที่เจอ (คู่กับ Maintenance): กฎ display:flex!important ด้านบนต้องมีกฎ specificity เท่ากันมาทีหลัง
   มาคานอีกเช่นกัน สำหรับกรณีผู้ใช้ล็อก Template dropdown เป็นโดเมนอื่น (เช่น Maintenance) — เดิมโมดูลนี้
   ไม่เคยเช็ค state.domainOverride เลย (getData() ไม่มี activation gate ยอมรับข้อมูลตารางทั่วไปเสมอ) ทำให้
   เลือก Template อื่นแล้ว Project Control ก็ยังค้างแสดงอยู่ */
#projectControlLayout.pc-override-hidden{display:none!important}
#projectControlLayout .project-control-hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:0 4px 14px rgba(15,23,42,.04)}
#projectControlLayout .project-control-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
#projectControlLayout .project-kpi{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;box-shadow:0 3px 12px rgba(15,23,42,.04);min-width:0;position:relative}
#projectControlLayout .project-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:4px;background:var(--brand)}
#projectControlLayout .project-kpi.warn:after{background:var(--warn)}.project-kpi.bad:after{background:var(--err)}
/* BUGFIX Stage 3: ปุ่ม "Presentation Mode" (.pc55-present) ไม่เคยมี CSS เลย ใช้ปุ่ม <button> ดีฟอลต์ของ
   เบราว์เซอร์ (กรอบเทาเหลี่ยม) ต่างจากปุ่มอื่นในหน้านี้ทั้งหมด ให้ทรงเดียวกับปุ่มอื่น (เช่น .f61-chip) */
#projectControlLayout .pc55-present{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 13px;font-family:var(--ui-font);font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;flex:none}
#projectControlLayout .pc55-present:hover{border-color:var(--brand);color:var(--brand-dk);background:var(--brand-sf)}
#projectControlLayout .pc55-hero-note{font-size:11px;color:var(--muted);margin-top:2px}
#projectControlLayout .project-kpi .pk-label{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.03em}.project-kpi .pk-value{font-size:25px;font-weight:850;line-height:1.1;margin-top:4px;color:var(--ink)}.project-kpi.good .pk-value{color:var(--ok)}.project-kpi.warn .pk-value{color:var(--warn)}.project-kpi.bad .pk-value{color:var(--err)}.project-kpi .pk-sub{font-size:9.5px;color:var(--muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#projectControlLayout .project-panel{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px;min-width:0;box-shadow:0 4px 14px rgba(15,23,42,.045)}
#projectControlLayout .project-panel h3{font-size:13px;margin:0 0 4px;font-weight:850;color:var(--ink)}.panel-note{font-size:9.5px;color:var(--muted);margin-bottom:7px}.pc55-reading-tip{font-size:9px;color:var(--muted);padding-top:3px;white-space:nowrap}
#projectControlLayout .project-control-main-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}.project-control-main-grid>.full{grid-column:1/-1}.project-control-main-grid>.half{grid-column:span 6}.project-control-main-grid>.quarter{grid-column:span 3}
/* Stage 6 (บั๊กที่เจอระหว่างทดสอบ — มีมาก่อนหน้านี้แล้ว ไม่เกี่ยวกับที่แก้รอบนี้): ".project-panel.third"
   (Project Health/Status | Milestones/Upcoming | Progress Trend) ไม่เคยมี CSS กำหนด grid-column เลย
   ทำให้ grid auto-placement วาง 3 กล่องนี้ลงคอลัมน์ละ 1/12 เท่านั้น (แคบเหลือ ~85px) เว้นพื้นที่ว่างขวามือ
   เกือบทั้งแถว กำหนด span 4 ให้ครบ 3 กล่อง = 12 คอลัมน์พอดี */
.project-control-main-grid>.third{grid-column:span 4}
#projectControlLayout .f56-insight-panel{border-left:3px solid var(--brand);padding:10px 13px}.f56-insight-title{font-size:11px;font-weight:850;margin-bottom:3px}.f56-insight-text{font-size:10px;color:var(--ink)}
#projectControlLayout .f61-attention-compact{padding:9px 12px}.f61-attention-compact .project-control-head{display:flex;justify-content:space-between;align-items:center}.f61-attention-compact h3{margin:0}.f61-attention-compact:has(.mini:only-child){display:block}
#projectControlLayout #f53Attention{font-size:9.5px}.project-attention-card{display:inline-flex!important;margin:4px 6px 0 0;padding:6px 8px!important;border-radius:8px!important}
#projectControlLayout #f53Gantt{min-height:0}.f61-gantt-controls{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:7px 0 5px}.f61-filter-group,.f61-scale,.f61-zoom{display:flex;gap:4px;align-items:center}.f61-chip,.f61-scale button,.f61-zoom button{border:1px solid var(--line);background:var(--card);border-radius:7px;padding:5px 9px;font-size:9.5px;color:var(--ink);cursor:pointer}.f61-chip.active,.f61-scale button.active{background:var(--brand-sf);border-color:var(--brand);color:var(--brand-dk);font-weight:850}.f61-zoom span{font-size:9px;color:var(--muted);margin-right:2px}.f61-zoom button{min-width:29px}
/* Stage 5 (ตามที่ผู้ใช้ขอ): ปรับ stat chip แถวสรุปเหนือ Gantt ให้สวยขึ้น — เว้นระยะมากขึ้น เพิ่มเงาเบาๆ
   และให้กล่อง "delayed"/"at risk" มีสีพื้นหลัง/ตัวเลขตามความหมายจริง แทนกล่องสีเทาเหมือนกันหมด */
.f61-gantt-summary{display:flex;gap:8px;overflow:auto;margin:6px 0 8px}
.f61-stat{min-width:74px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:0 2px 6px rgba(15,23,42,.04)}
.f61-stat b{display:block;font-size:16px;font-weight:850;line-height:1.15;color:var(--ink)}
.f61-stat span{font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.f61-stat.bad{background:color-mix(in srgb, var(--err) 10%, var(--card));border-color:color-mix(in srgb, var(--err) 35%, var(--line))}
.f61-stat.bad b{color:var(--err)}
.f61-stat.warn{background:color-mix(in srgb, var(--warn) 12%, var(--card));border-color:color-mix(in srgb, var(--warn) 35%, var(--line))}
.f61-stat.warn b{color:#9a6a00}
.f61-stat.good b{color:var(--ok)}
.f61-overall{margin-left:auto;min-width:112px;display:flex;flex-direction:column;justify-content:center;gap:2px}
.f61-gantt-legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:8.5px;color:var(--muted);padding:5px 2px 0}.f61-gantt-legend span{display:inline-flex;align-items:center;gap:4px}.f61-gantt-legend i{display:inline-block;width:15px;height:6px;border-radius:5px}.f61-gantt-legend .actual{background:var(--pc54-actual)}.f61-gantt-legend .remaining{background:#DCE6F0}.f61-gantt-legend .today{width:2px;height:12px;background:var(--pc54-today)}
#projectControlLayout .f61-gantt-scroll{height:min(500px,58vh);overflow:auto;overscroll-behavior:contain;scroll-behavior:auto;border:1px solid var(--line);border-radius:9px;background:var(--card);scrollbar-gutter:stable both-edges}
#projectControlLayout .f61-gantt-scroll{min-height:280px}
#projectControlLayout .f61-gantt-scroll>svg{min-height:260px}
#projectControlLayout .pc58-progress-scroll{overflow-y:auto!important;overflow-x:hidden!important}
#projectControlLayout .f56-status-summary{overflow-y:auto!important;overflow-x:hidden!important}
#projectControlLayout #f53Health{max-height:310px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--line);border-radius:8px}
#projectControlLayout .f56-health-header{position:sticky;top:0;z-index:2;background:var(--bg)}
/* BUGFIX Stage 2: .f56-health-header/.f53-health-row/.f53-pill/.f56-positive/.f56-negative ไม่เคยมี
   CSS จัดคอลัมน์/รูปทรงเลย (มีแค่ position:sticky กับ min-height ที่เพิ่มทีหลัง) — ผลคือชื่อโปรเจกต์+
   สถานะ+ตัวเลขไหลรวมกันเป็นบรรทัดเดียวไม่มีช่องไฟ ให้เป็น grid 5 คอลัมน์ตาม header (Project/Status/
   Actual/Plan/Δ) และให้ .f53-pill เป็นทรงยาแคปซูลสีตามสถานะแบบเดียวกับ AMR O&M template */
#projectControlLayout .f56-health-header{display:grid;grid-template-columns:1fr 88px 60px 60px 56px;gap:8px;align-items:center;padding:7px 10px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--line)}
#projectControlLayout .f56-health-header span:not(:first-child){text-align:right}
#projectControlLayout .f53-health-row{display:grid;grid-template-columns:1fr 88px 60px 60px 56px;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line);font-size:12px}
#projectControlLayout .f53-health-row:last-child{border-bottom:none}
#projectControlLayout .f53-health-row b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
#projectControlLayout .f53-health-row>span{text-align:right;font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums;color:var(--ink)}
#projectControlLayout .f53-pill{display:inline-flex;align-items:center;justify-content:center;font-family:var(--ui-font);font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
#projectControlLayout .f53-pill.good{color:var(--ok);background:color-mix(in srgb, var(--ok) 15%, transparent)}
#projectControlLayout .f53-pill.warn{color:#9a6a00;background:color-mix(in srgb, var(--warn) 26%, transparent)}
#projectControlLayout .f53-pill.bad{color:var(--err);background:color-mix(in srgb, var(--err) 15%, transparent)}
#projectControlLayout .f53-pill.info{color:var(--sky);background:color-mix(in srgb, var(--sky) 15%, transparent)}
#projectControlLayout .f56-positive{color:var(--ok);font-weight:700}
#projectControlLayout .f56-negative{color:var(--err);font-weight:700}
#projectControlLayout #f53TrendPanel,#projectControlLayout #f53AnalysisPanel{min-height:250px}
#projectControlLayout .pc58-analysis-list{max-height:135px}
#projectControlLayout .f61-gantt-scroll>svg{display:block!important;max-width:none!important;min-width:1320px!important;width:auto!important}
/* Stage 5 (ตามที่ผู้ใช้ขอ): #f53Status/.f56-status-summary เดิมมีความสูงตายตัว (220px/205px) จากรอบ
   ก่อนที่เนื้อหายังสั้นกว่านี้ ตอนนี้เนื้อหา (4 แถวสถานะ + ข้อความสรุป) สูงกว่าที่กำหนดไว้แล้ว ทำให้เกิด
   scrollbar ที่ไม่จำเป็นและข้อความสรุปด้านล่างถูกตัดจนเหลือแค่เส้นบนสุด (ดูเหมือน "-") ปล่อยให้กล่องสูง
   ตามเนื้อหาจริงแทน */
#projectControlLayout #f53Progress{height:220px;overflow:hidden}.pc58-progress-scroll{height:205px!important;border:1px solid var(--line)!important;border-radius:8px!important}.pc58-progress-scroll>svg{width:900px!important;max-width:none!important}.f56-status-summary{padding-right:3px}
#projectControlLayout #f53Health{max-height:350px;overflow:auto;border-top:1px solid var(--line);border-bottom:1px solid var(--line);border-radius:8px}.f56-health-header{position:sticky;top:0;z-index:3;background:var(--card)}.f53-health-row{min-height:34px!important}
/* Stage 7 (ตามที่ผู้ใช้ขอ): เดิมบีบ svg ให้ width:100% เสมอ ทำให้ยิ่งมีหลายแท่งยิ่งเล็กจนอ่านไม่ออก
   เปลี่ยนเป็นความกว้างคงที่ต่อแท่ง (กำหนดใน renderTrend) + ห่อด้วย scroll แนวนอนแทน เหมือนวิธีที่ใช้กับ
   Gantt — กล่องขนาดเท่าเดิม ตัวหนังสือใหญ่ขึ้น ถ้าแท่งเยอะ (โหมด Month) ให้เลื่อนดูส่วนที่เหลือแทน */
#projectControlLayout .f53-trend-controls{margin-bottom:6px}
#projectControlLayout .f53-trend-scroll{overflow-x:auto;overflow-y:hidden}
#projectControlLayout .f53-trend-scroll>svg{display:block}
#projectControlLayout .pc58-analysis-controls{display:flex;gap:6px;margin:0 0 7px}.pc58-analysis-controls label{display:flex;flex-direction:column;gap:3px;font-size:8px;color:var(--muted);font-weight:700}.pc58-analysis-controls select{border:1px solid var(--line);border-radius:7px;background:var(--card);padding:5px 7px;font-size:9px}.pc58-analysis-list{height:125px;overflow:auto;padding-right:3px}.pc58-analysis-row{display:grid;grid-template-columns:85px 1fr 40px;gap:6px;align-items:center;margin:6px 0;font-size:9px}.pc58-analysis-row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc58-analysis-row div{height:7px;background:var(--bg);border-radius:7px;overflow:hidden}.pc58-analysis-row i{display:block;height:100%;background:var(--pc54-actual);border-radius:7px}.pc58-analysis-row b{text-align:right;font-size:9px}.pc58-analysis-insight{font-size:8.5px;color:var(--muted);padding-top:5px;border-top:1px solid var(--line)}.pc61-analysis-quick{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.pc61-analysis-quick>div{border:1px solid var(--line);border-radius:7px;padding:5px 7px;display:grid;grid-template-columns:1fr auto;gap:1px 6px}.pc61-analysis-quick small{grid-column:1/-1;color:var(--muted);font-size:7.5px}.pc61-analysis-quick b{font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc61-analysis-quick strong{font-size:9px;color:var(--ok)}
/* BUGFIX Stage 2b: .f53-list ("Milestones / Upcoming") มี CSS แค่บรรทัดเดียว เพียงพอสำหรับให้มีเส้นคั่น
   แต่ชื่อโครงการกับวันที่ตัวขนาด/น้ำหนักเท่ากันหมด แยกลำดับความสำคัญไม่ออก ปรับให้ชื่อเด่นกว่าและวันที่
   เป็นตัวเลข mono ชิดขวาเหมือนจุดอื่นในหน้านี้ */
/* Stage 6 (ตามที่ผู้ใช้ขอ — เปลี่ยนใจจากรอบก่อนที่ให้เลื่อนซ้าย-ขวา): ให้ชื่องานยาวๆ ขึ้นบรรทัดที่ 2 ได้
   แทนการเลื่อน/ตัดคำ เพิ่มความสูงแถวให้พอรับ 2 บรรทัด และจัดวันที่ชิดขวาคงที่ */
#projectControlLayout .f53-list{display:flex;align-items:flex-start;gap:14px;padding:11px 2px;border-bottom:1px solid var(--line);font-size:12px;min-height:44px}
#projectControlLayout .f53-list:last-child{border-bottom:none}
#projectControlLayout .f53-list b{font-weight:600;color:var(--ink);white-space:normal;overflow-wrap:break-word;line-height:1.35;flex:1 1 auto;min-width:0}
#projectControlLayout .f53-list span{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums;font-size:11px;color:var(--muted);white-space:nowrap;flex:none;margin-left:auto;padding-top:1px}
#projectControlLayout .f53-forecast{display:grid;grid-template-columns:1fr 1fr;gap:9px 15px;padding-top:7px}.f53-forecast b{font-size:9px;color:var(--muted)}.f53-forecast strong{font-size:10px}
/* Stage 4b: ตาราง "Tracked Tasks" — สไตล์อ้างอิงจาก template AMR O&M (table + status pill + bar-cell) */
#projectControlLayout .table-wrap{overflow-x:auto}
#projectControlLayout .table-wrap table{width:100%;border-collapse:collapse;font-size:12.5px}
#projectControlLayout .table-wrap thead th{text-align:left;font-weight:700;color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;padding:0 10px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
#projectControlLayout .table-wrap tbody td{padding:9px 10px;border-bottom:1px solid var(--line);color:var(--ink);vertical-align:middle}
#projectControlLayout .table-wrap tbody tr:last-child td{border-bottom:none}
/* Stage 6 (ตามที่ผู้ใช้ขอ): คอลัมน์ Due เดิมชิดขวา (text-align:right) แต่หัวตาราง "DUE" ชิดซ้ายเหมือนคอลัมน์
   อื่น ทำให้ตัวเลขวันที่เริ่มไม่ตรงแนวกับตัว D ของหัวคอลัมน์ เปลี่ยนเป็นชิดซ้ายให้ตรงกับหัวตาราง */
#projectControlLayout .table-wrap td.num,#projectControlLayout .table-wrap th.num{text-align:left;font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums}
#projectControlLayout .table-wrap td.muted{color:var(--muted)}
#projectControlLayout .bar-cell{display:flex;align-items:center;gap:8px;min-width:120px}
#projectControlLayout .bar-track{flex:1;height:6px;border-radius:999px;background:var(--bg);overflow:hidden}
#projectControlLayout .bar-fill{height:100%;border-radius:999px;background:var(--brand)}
#projectControlLayout .bar-cell .pct{font-family:var(--ui-font-mono);font-size:11px;color:var(--muted);width:34px;text-align:right;flex-shrink:0}
/* BUGFIX Stage 2b: .f56-status-item/.f56-status-top/.f56-status-track/.f56-status-message (สรุปย่อย
   "On Track/At Risk/Delayed/Monitoring" ในการ์ด "Project Health / Status" ตัวเล็กบนแดชบอร์ด) ไม่เคยมี
   CSS เลยเช่นกัน — สีของจุด/แถบมาจาก inline style ที่ JS ใส่ให้อยู่แล้ว (ถูกต้อง) แต่ไม่มี layout ใดๆ
   ทำให้ label+ตัวเลข+แถบไหลติดกันเป็นพืด เพิ่ม layout ตามแพทเทิร์น .health-row ของ AMR O&M (จุดสี+label
   ซ้าย ตัวเลขขวา แล้วมีแถบ progress บางๆ ด้านล่าง) */
#projectControlLayout .f56-status-summary{display:flex;flex-direction:column;gap:11px}
#projectControlLayout .f56-status-item{display:flex;flex-direction:column;gap:5px}
#projectControlLayout .f56-status-top{display:flex;align-items:center;justify-content:space-between;font-size:11.5px}
#projectControlLayout .f56-status-top span{display:flex;align-items:center;gap:6px;color:var(--ink);font-weight:600}
#projectControlLayout .f56-status-top span i{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
#projectControlLayout .f56-status-top b{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums;color:var(--ink);font-weight:700}
#projectControlLayout .f56-status-track{height:6px;border-radius:999px;background:var(--bg);overflow:hidden}
#projectControlLayout .f56-status-track span{display:block;height:100%;border-radius:999px}
#projectControlLayout .f56-status-item small{font-size:10px;color:var(--muted)}
#projectControlLayout .f56-status-message{margin-top:2px;padding-top:9px;border-top:1px solid var(--line);font-size:11px;color:var(--ink)}
/* BUGFIX Stage 2: .f56-forecast-state เดิม color:#16A34A!important ตายตัว ทำให้ตัวหนังสือขึ้นเขียวเสมอ
   ไม่ว่าค่าจริงจะเป็น "Ahead of target"/"Near target"/"At risk" ก็ตาม — เปลี่ยนเป็นสีปกติ แล้วให้ JS
   (ดูจุดที่ set forecastState ด้านบน) ใส่ class ตามสถานะจริงแทน */
.f56-forecast-state{font-weight:800}
.f56-forecast-state.good{color:var(--ok)!important}
.f56-forecast-state.warn{color:#9a6a00!important}
.f56-forecast-state.bad{color:var(--err)!important}
#projectControlLayout .f53-empty{padding:30px 10px;text-align:center;color:var(--muted);font-size:10px}.project-control-footnote{font-size:8.5px;color:var(--muted)}
/* Stage 5b (ตามที่ผู้ใช้ขอเพิ่ม): .f53-legend/.f53-actual/.f53-plan (ใช้ใต้กราฟ Progress Trend) ไม่เคยมี
   CSS เลย ทำให้ span เรียงติดกันไม่มีช่องไฟจนอ่านเป็น "ActualPlanaverage" ให้ layout แบบเดียวกับ
   .f61-gantt-legend (เว้นระยะ + เส้นสีสวอตช์สั้นๆ หน้าคำอธิบาย) */
#projectControlLayout .f53-legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:9px;color:var(--muted);padding:6px 2px 0}
#projectControlLayout .f53-legend span{display:inline-flex;align-items:center;gap:4px}
#projectControlLayout .f53-legend i{display:inline-block;width:15px;height:6px;border-radius:5px;background:var(--muted)}
#projectControlLayout .f53-legend i.f53-actual{background:var(--pc54-actual)}
#projectControlLayout .f53-legend i.f53-plan{background:var(--pc54-plan)}
#projectControlLayout .f53-gantt-scroll{scroll-behavior:auto;overscroll-behavior:contain}
@media(max-width:1100px){#projectControlLayout .project-control-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.project-control-main-grid>.quarter{grid-column:span 6}.project-control-main-grid>.third{grid-column:span 6}}
@media(max-width:700px){#projectControlLayout .project-control-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.project-control-main-grid>.quarter,.project-control-main-grid>.half,.project-control-main-grid>.third{grid-column:1/-1}.f61-gantt-controls{justify-content:flex-start}}
/* Stage 7 (ตามที่ผู้ใช้ขอ): ปุ่มไอคอนล้วนบนหัวการ์ดกราฟ (ขยายเต็มจอ/ปรับสีการ์ด/ปรับสีกราฟ) เปลี่ยนจาก
   กรอบเหลี่ยมทึบเดิมเป็นทรง "liquid glass" — พื้นหลังโปร่งแสง เบลอด้านหลัง (backdrop-filter) ขอบสีขาว
   จางๆ เงานุ่มๆ ไม่ใช่แค่ #projectControlLayout เพราะปุ่มพวกนี้ใช้ร่วมกันทุกการ์ดกราฟทั้งแอป ไม่ใช่แค่
   2 กราฟที่ย้ายมา ให้หน้าตาสม่ำเสมอกันทั้งหมด */
.widget-fullscreen,.card-color-btn,.chart-style-btn{
  background:rgba(255,255,255,.55)!important;border:1px solid rgba(255,255,255,.65)!important;
  -webkit-backdrop-filter:blur(10px) saturate(180%)!important;backdrop-filter:blur(10px) saturate(180%)!important;
  box-shadow:0 2px 10px rgba(16,24,40,.10),inset 0 1px 0 rgba(255,255,255,.7)!important;
  border-radius:10px!important;color:var(--muted)!important;opacity:1!important;
  transition:transform .15s ease,box-shadow .15s ease;
}
.widget-fullscreen:hover,.card-color-btn:hover,.chart-style-btn:hover{
  transform:translateY(-1px);box-shadow:0 4px 14px rgba(16,24,40,.14),inset 0 1px 0 rgba(255,255,255,.8)!important;
}
:root:not([data-theme="light"]) .widget-fullscreen,:root:not([data-theme="light"]) .card-color-btn,:root:not([data-theme="light"]) .chart-style-btn{
  background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.16)!important;
  box-shadow:0 2px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.12)!important;
}
[data-theme="dark"] .widget-fullscreen,[data-theme="dark"] .card-color-btn,[data-theme="dark"] .chart-style-btn{
  background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.16)!important;
  box-shadow:0 2px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.12)!important;
}
/* Stage 7 (ตามที่ผู้ใช้ขอ): ตัดกล่องโดนัท "สัดส่วนจำนวนรายการตาม..." ออกจาก Analytics ไปเลย */
#pieChartCard{display:none!important}
/* Stage 7 (บั๊กที่ยืนยันแล้ว): ปุ่ม "Presentation Mode" toggle คลาส pc55-presentation บน body มาตั้งแต่
   ต้น แต่ไม่เคยมี CSS ตอบสนองอะไรเลย กดแล้วเลยดูเหมือนไม่ทำงาน — ให้ซ่อนแถบเครื่องมือ/ตัวกรอง/แท็บ
   ด้านบนที่ไม่จำเป็นตอนนำเสนอ เหลือแค่เนื้อหา Project Control เต็มพื้นที่ */
body.pc55-presentation #dashboardCommandBar,
body.pc55-presentation .dashboard-filter-card,
body.pc55-presentation #dashboardNav{display:none!important}
body.pc55-presentation #projectControlLayout{margin-top:0}
/* Stage 7 (ตามที่ผู้ใช้ขอ): แถวใหม่สำหรับกราฟ Analytics 2 ตัวที่ย้ายมาไว้ใน Project Control — ใช้ grid
   12 คอลัมน์เดียวกับที่การ์ดกราฟใช้อยู่แล้ว (dash-span-6) เพื่อให้ตัวเลือกชนิดกราฟ/จัดกลุ่ม/รวมค่าที่ติดมา
   ด้วยยังทำงานและจัดวางถูกต้องเป๊ะเหมือนตอนอยู่ที่ Analytics */
#projectControlLayout .project-control-charts-row{margin:0}
/* Stage 8 (ตามที่ผู้ใช้ขอ): ตอนกด Fullscreen เบราว์เซอร์ใส่พื้นหลังดำ (::backdrop ค่าเริ่มต้นของ UA) ให้พื้น
   ที่ว่างรอบๆ element ที่ขยายเต็มจอ เปลี่ยนเป็นสีพื้นหลังเดียวกับแอป (สว่าง) แทน และเปิด scroll ไว้เผื่อ
   เนื้อหาสูงกว่าจอ */
#dashboardView:fullscreen,#dashboardView:-webkit-full-screen,
.card:fullscreen,.card:-webkit-full-screen{background:var(--bg)!important;overflow:auto!important}
#dashboardView::backdrop,.card::backdrop{background:var(--bg)!important}
#dashboardView:-webkit-full-screen::-webkit-scrollbar,.card:-webkit-full-screen::-webkit-scrollbar{width:10px}
.f61-chart-empty-note{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 20px;color:var(--muted);font-size:11.5px}
.chart-wrap{position:relative}
`;
    document.head.appendChild(s);
  }
  function initDesignUI53(){
    if(document.getElementById('pc53DesignPanel'))return;
    var b=document.createElement('button');b.className='pc53-design-trigger';b.type='button';b.textContent='⚙ Project Design';
    b.onclick=function(){document.getElementById('pc53DesignPanel').classList.add('open');fillDesign();};document.body.appendChild(b);
    var p=document.createElement('div');p.id='pc53DesignPanel';p.innerHTML='<div class="pc53-panel-backdrop"></div><div class="pc53-panel"><div class="pc53-panel-head"><b>Project Control Design</b><button id="pc53Close">×</button></div><div class="pc53-grid">'+
      '<label>Font<select id="pc53Font"><option value="Prompt">Prompt (KPI style)</option><option value="system">System UI</option><option value="Sarabun">Sarabun</option><option value="Arial">Arial</option><option value="Tahoma">Tahoma</option></select></label>'+
      '<label>Font size<input id="pc53FontSize" type="number" min="9" max="20"></label><label>Heading size<input id="pc53Heading" type="number" min="10" max="24"></label><label>Chart font size<input id="pc53ChartFont" type="number" min="8" max="16"></label>'+
      '<label>Row height<input id="pc53Row" type="number" min="24" max="60"></label><label>Project name width<input id="pc53Project" type="number" min="140" max="360"></label>'+
      '<label>Card radius<input id="pc53Radius" type="number" min="6" max="24"></label><label>Section gap<input id="pc53Gap" type="number" min="6" max="24"></label><label>Card padding<input id="pc53Padding" type="number" min="8" max="24"></label>'+
      '<label>Actual color<input id="pc53Actual" type="color"></label><label>Plan color<input id="pc53Plan" type="color"></label><label>On Track<input id="pc53OnTrack" type="color"></label><label>At Risk<input id="pc53Risk" type="color"></label><label>Delayed<input id="pc53Delayed" type="color"></label><label>Monitoring<input id="pc53Monitoring" type="color"></label><label>Today line<input id="pc53Today" type="color"></label>'+'<div class="wide pc60-bar-colors"><div class="pc60-subhead">Gantt bar colors — set a different color for each project</div><div id="pc60BarColors"></div></div>'+
      '<label class="wide">Dashboard title<input id="pc53Title"></label><label>Gantt title<input id="pc53Gantt"></label><label>Status title<input id="pc53Status"></label><label>Upcoming title<input id="pc53Upcoming"></label><label>Trend title<input id="pc53Trend"></label>'+
      '</div><div class="pc53-actions"><button id="pc60ResetBars">Reset bar colors</button><button id="pc53Reset">Reset</button><button class="save" id="pc53Save">Save</button></div></div>';
    document.body.appendChild(p);
    function fillDesign(){
      var d=getDesign();var map={pc53Font:'fontFamily',pc53FontSize:'fontSize',pc53Heading:'headingSize',pc53ChartFont:'chartFontSize',pc53Row:'rowHeight',pc53Project:'projectWidth',pc53Radius:'cardRadius',pc53Gap:'sectionGap',pc53Padding:'cardPadding',pc53Actual:'actual',pc53Plan:'plan',pc53OnTrack:'onTrack',pc53Risk:'risk',pc53Delayed:'delayed',pc53Monitoring:'monitoring',pc53Today:'today',pc54Grid:'grid',pc54Text:'textColor',pc53Title:'title',pc53Attention:'attention',pc53Gantt:'gantt',pc53Progress:'progress',pc53Status:'status',pc53Health:'health',pc53Upcoming:'upcoming',pc53Forecast:'forecast',pc53Cost:'cost',pc53Trend:'trend'};Object.keys(map).forEach(function(id){var e=document.getElementById(id);if(e)e.value=d[map[id]];});
      var box=document.getElementById('pc60BarColors');if(!box)return;
      var dat=getData(),rows=dat?dat.rows.filter(function(r){return r.start||r.end}):[];
      box.innerHTML=rows.length?rows.map(function(r){var c=barColor(r.name);return '<div class="pc60-bar-row"><span title="'+esc(r.name)+'">'+esc(r.name)+'</span><input class="pc60-bar-color" data-project="'+esc(r.name)+'" type="color" value="'+c+'"></div>';}).join(''):'<div class="mini">Load project data first to edit individual bar colors.</div>';
    }
    function readDesign(){
      var d=getDesign(),map={pc53Font:'fontFamily',pc53FontSize:'fontSize',pc53Heading:'headingSize',pc53ChartFont:'chartFontSize',pc53Row:'rowHeight',pc53Project:'projectWidth',pc53Radius:'cardRadius',pc53Gap:'sectionGap',pc53Padding:'cardPadding',pc53Actual:'actual',pc53Plan:'plan',pc53OnTrack:'onTrack',pc53Risk:'risk',pc53Delayed:'delayed',pc53Monitoring:'monitoring',pc53Today:'today',pc54Grid:'grid',pc54Text:'textColor',pc53Title:'title',pc53Attention:'attention',pc53Gantt:'gantt',pc53Progress:'progress',pc53Status:'status',pc53Health:'health',pc53Upcoming:'upcoming',pc53Forecast:'forecast',pc53Cost:'cost',pc53Trend:'trend'};Object.keys(map).forEach(function(id){var e=document.getElementById(id);if(e)d[map[id]]=e.value;});
      d.barColors=Object.assign({},d.barColors||{});qa('.pc60-bar-color').forEach(function(e){d.barColors[e.getAttribute('data-project')]=safeColor(e.value,d.actual);});
      d.fontSize=+d.fontSize;d.headingSize=+d.headingSize;d.chartFontSize=+d.chartFontSize;d.rowHeight=+d.rowHeight;d.projectWidth=+d.projectWidth;d.cardRadius=+d.cardRadius;d.sectionGap=+d.sectionGap;d.cardPadding=+d.cardPadding;saveDesign(d);applyDesign53();schedule();
    }
    p.querySelector('.pc53-panel-backdrop').onclick=function(){p.classList.remove('open')};document.getElementById('pc53Close').onclick=function(){p.classList.remove('open')};document.getElementById('pc53Save').onclick=function(){readDesign();p.classList.remove('open')};document.getElementById('pc60ResetBars').onclick=function(){var d=getDesign();d.barColors={};saveDesign(d);fillDesign();schedule();};document.getElementById('pc53Reset').onclick=function(){saveDesign(Object.assign({},DESIGN_DEFAULTS,{barColors:{}}));fillDesign();applyDesign53();schedule()};
  }

  function init(){
    applyDesign53();
    injectCSS();
    initDesignUI53();
    schedule();
    // Robust startup: local dashboard data may be created after DOMContentLoaded.
    // Retry briefly without a permanent interval, then let dashboard hooks handle later updates.
    function bootRetry(){
      var A=window.TanotDashboard;
      if(A&&typeof A.getState==='function'){
        var st=A.getState();
        if(st&&Array.isArray(st.rows)&&st.rows.length){schedule();return;}
      }
      if(bootAttempts++<120) bootTimer=requestAnimationFrame(bootRetry);
    }
    bootRetry();
    document.addEventListener('click',function(e){
      var pb=e.target.closest&&e.target.closest('#pc55Present');
      if(pb){document.body.classList.toggle('pc55-presentation');pb.textContent=document.body.classList.contains('pc55-presentation')?'Exit Presentation':'Presentation Mode';}

      var b=e.target.closest&&e.target.closest('.dashboard-nav-btn');
      if(b&&(b.getAttribute('data-section-page')==='projects'||b.getAttribute('data-section')==='dashboardProjects'))setTimeout(schedule,80);
    },true);
    document.addEventListener('change',function(){setTimeout(schedule,50)},true);
    window.addEventListener('resize',schedule,{passive:true});
    var A=window.TanotDashboard;
    if(A&&A.Hooks){A.Hooks.afterTableRender=schedule;A.Hooks.afterDashboardFiltersRender=schedule;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();