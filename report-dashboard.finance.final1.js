/* FINAL 1 — Finance Control (new rich domain module, additive)
   Follows the exact pattern of report-dashboard.safety.final1.js: self-contained,
   own column-role detection, auto-activates only when the uploaded sheet looks like
   a transaction/ledger log, inserts its own layout next to the existing
   Projects-section cards without touching them. Does NOT modify any existing
   file, hook, or the table renderer. Reuses the dropdown value "finance" already
   wired in both #dashboardTemplateSel and #domainOverrideSel.

   ตามที่ผู้ใช้ขอ (ให้ผมตัดสินใจเองว่าจะเพิ่มอะไร เพราะไม่มีความรู้ด้าน finance): เพิ่ม Budget vs Actual
   (มุมมองที่งานวิจัยด้าน dashboard design ระบุว่าขาดไม่ได้ — ไม่งั้นแดชบอร์ดเป็นแค่ตัวบรรยายเฉยๆ ไม่
   actionable) และ Running Balance สะสม (มาตรฐานของ personal/SME finance dashboard) — ทั้งสอง
   panel นี้เปิดใช้ก็ต่อเมื่อไฟล์มีคอลัมน์ที่จำเป็นจริงๆ (งบประมาณต่อหมวด / วันที่+ยอด) ถ้าไม่มีจะซ่อน
   ไปเฉยๆ ไม่ error และไม่กุตัวเลขที่ไม่มีข้อมูลรองรับ */
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
  var FN_MONTH3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(d){return d&&!isNaN(d)?String(d.getDate()).padStart(2,'0')+' '+FN_MONTH3[d.getMonth()]+' '+d.getFullYear():'—'}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function baht(n){return '฿'+Math.round(n||0).toLocaleString()}

  function roleCol(st,words){
    return (st.columns||[]).find(function(c){
      var n=text(c.label).toLowerCase();
      return words.some(function(w){return n===w||n.indexOf(w)>=0});
    })||null;
  }

  var INCOME_KW=['income','revenue','รายรับ','รายได้'];
  var EXPENSE_KW=['expense','cost','spending','รายจ่าย','ค่าใช้จ่าย'];
  function txnFlow(typeVal){
    var n=text(typeVal).toLowerCase();
    if(EXPENSE_KW.some(function(k){return n.indexOf(k)>=0}))return 'expense';
    if(INCOME_KW.some(function(k){return n.indexOf(k)>=0}))return 'income';
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
      date: roleCol(st,['date','วันที่']),
      income: roleCol(st,['income','revenue','รายรับ','รายได้']),
      expense: roleCol(st,['expense','cost','spending','รายจ่าย','ค่าใช้จ่าย']),
      amount: roleCol(st,['amount','จำนวนเงิน','ยอดเงิน','มูลค่า']),
      txntype: roleCol(st,['transaction type','transactiontype','ประเภทรายการ','ประเภทธุรกรรม']),
      category: roleCol(st,['category','หมวดหมู่']),
      account: roleCol(st,['account','payment method','paymentmethod','บัญชี','ช่องทาง','วิธีชำระ']),
      description: roleCol(st,['description','note','รายละเอียด','คำอธิบาย']),
      budget: roleCol(st,['budget','งบประมาณ','budgeted'])
    };
    // Activation gate: ต้องมีวันที่ ร่วมกับข้อมูลยอดเงินอย่างน้อยหนึ่งรูปแบบ (income/expense แยกคอลัมน์
    // หรือ amount รวม)
    if(!c.date || !(c.income||c.expense||c.amount)) return ov==='finance' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    var rows=st.rows.map(function(r,i){
      var d=date(c.date?r[c.date.key]:null);
      var inc=0, exp=0;
      if(c.income||c.expense){
        inc = c.income?num(r[c.income.key])||0:0;
        exp = c.expense?num(r[c.expense.key])||0:0;
      } else if(c.amount){
        var amt = num(r[c.amount.key])||0;
        var flow = c.txntype?txnFlow(r[c.txntype.key]):null;
        if(flow==='expense') exp=Math.abs(amt);
        else if(flow==='income') inc=Math.abs(amt);
        else if(amt<0) exp=Math.abs(amt);
        else inc=amt;
      }
      return {
        raw:r, i:i, date:d, income:inc, expense:exp,
        category: c.category?text(r[c.category.key])||L('(ไม่ระบุ)','(unspecified)'):L('(ไม่ระบุ)','(unspecified)'),
        account: c.account?text(r[c.account.key])||L('(ไม่ระบุ)','(unspecified)'):L('(ไม่ระบุ)','(unspecified)'),
        description: c.description?text(r[c.description.key]):'',
        budget: c.budget?num(r[c.budget.key]):null
      };
    }).filter(function(r){return r.date;});
    if(rows.length<2) return ov==='finance' ? {st:st,rows:[],cols:c,noMatch:true} : null;
    return {st:st, rows:rows, cols:c, hasBudget:!!c.budget, hasAccount:!!c.account};
  }

  function injectCSS(){
    if(q('#finance1-css'))return;
    var s=document.createElement('style');s.id='finance1-css';s.textContent=`
#financeControlLayout{display:flex;flex-direction:column;gap:12px;margin-top:14px;font-family:var(--pc53-font,inherit)}
#financeControlLayout .fn-hero{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-lg);padding:15px 16px;box-shadow:var(--ome-shadow-1)}
#financeControlLayout .fn-hero h2{font-size:var(--ome-fs-md);margin:0}
#financeControlLayout .fn-hero .fn-sub{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:3px}
#financeControlLayout .fn-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
#financeControlLayout .fn-kpi{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-md);padding:11px 13px;box-shadow:var(--ome-shadow-1);position:relative}
#financeControlLayout .fn-kpi:after{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:var(--ome-radius-sm);background:var(--ome-ok)}
#financeControlLayout .fn-kpi.warn:after{background:var(--ome-warn)}#financeControlLayout .fn-kpi.bad:after{background:var(--ome-err)}
#financeControlLayout .fn-kpi .l{font-size:var(--ome-fs-xs);color:var(--ome-text-2);font-weight:700;}
#financeControlLayout .fn-kpi .v{font-size:var(--ome-fs-xl);font-weight:700;margin-top:4px;color:var(--ome-text-1)}
#financeControlLayout .fn-kpi.warn .v{color:var(--ome-warn-ink)}#financeControlLayout .fn-kpi.bad .v{color:var(--ome-err-ink)}
#financeControlLayout .fn-kpi .s{font-size:var(--ome-fs-xs);color:var(--ome-text-2);margin-top:4px}
#financeControlLayout .fn-panel{background:var(--ome-surface-1);border:1px solid var(--ome-border);border-radius:var(--ome-radius-lg);padding:12px;box-shadow:var(--ome-shadow-1)}
#financeControlLayout .fn-panel h3{font-size:var(--ome-fs-sm);margin:0 0 3px;font-weight:700}
#financeControlLayout .fn-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
#financeControlLayout .fn-grid>.half{grid-column:span 6}#financeControlLayout .fn-grid>.full{grid-column:1/-1}
#financeControlLayout .fn-insight{border-left:3px solid var(--ome-ok);padding:10px 13px;font-size:var(--ome-fs-xs);color:var(--ome-text-1)}
#financeControlLayout .fn-list{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--ome-border);font-size:var(--ome-fs-xs)}
#financeControlLayout .fn-list:last-child{border-bottom:none}
#financeControlLayout .fn-empty{padding:24px 8px;text-align:center;color:var(--ome-text-2);font-size:var(--ome-fs-xs)}
#financeControlLayout svg text{font-family:var(--pc53-font,inherit)}
#financeControlLayout .fn-trend-scroll{overflow-x:auto}
#financeControlLayout .fn-donut-wrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
#financeControlLayout .fn-donut-legend{display:flex;flex-direction:column;gap:10px;justify-content:center;flex:1;min-width:150px}
#financeControlLayout .fn-donut-legend .row{display:flex;align-items:center;gap:8px;font-size:var(--ome-fs-xs)}
#financeControlLayout .fn-donut-legend i{width:10px;height:10px;border-radius:var(--ome-radius-sm);display:inline-block;flex:none}
#financeControlLayout.finance-override-hidden{display:none!important}
.finance-hidden-source{display:none!important}
@media(max-width:1100px){#financeControlLayout .fn-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#financeControlLayout .fn-grid>.half{grid-column:1/-1}}
@media(max-width:700px){#financeControlLayout .fn-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(s);
  }

  function injectLayout(){
    var layout=q('#financeControlLayout'); if(layout)return layout;
    var anchor=q('#domainDashboardCard')||q('#scadaProgressCard')||q('#projectSpecialGrid')||q('#biProjectControlCard');
    if(!anchor)return null;
    layout=document.createElement('div'); layout.id='financeControlLayout';
    layout.setAttribute('data-dashboard-section','dashboardProjects');
    anchor.parentNode.insertBefore(layout,anchor);
    return layout;
  }

  function build(){
    var layout=injectLayout(); if(!layout)return false;
    if(layout.getAttribute('data-built')==='1')return true;
    layout.setAttribute('data-built','1');
    layout.innerHTML=
      '<section class="fn-hero"><h2>Finance Control</h2><div class="fn-sub" id="fnUpdated"></div></section>'+
      '<div class="fn-kpis" id="fnKpis"></div>'+
      '<section class="fn-panel fn-insight-panel"><h3>Executive Insight</h3><div id="fnInsight" class="fn-insight"></div></section>'+
      '<div class="fn-grid">'+
        '<section class="fn-panel full"><h3>'+L('แนวโน้มรายรับ-รายจ่ายรายเดือน','Monthly income and expense trend')+'</h3><div id="fnTrend"></div></section>'+
        '<section class="fn-panel half" id="fnBudgetSection"><h3>'+L('งบประมาณเทียบรายจ่ายจริง','Budget vs actual spending')+'</h3><div id="fnBudget"></div></section>'+
        '<section class="fn-panel half" id="fnAccountSection"><h3>'+L('สัดส่วนรายรับตามช่องทาง','Income by account')+'</h3><div id="fnAccount"></div></section>'+
        '<section class="fn-panel full"><h3>'+L('ยอดคงเหลือสะสม (Running Balance)','Running balance')+'</h3><div id="fnBalance"></div></section>'+
        '<section class="fn-panel full"><h3>'+L('รายการล่าสุด','Latest transactions')+'</h3><div id="fnRecent"></div></section>'+
      '</div>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('finance-hidden-source');
    });
    return true;
  }

  function svgOpen(w,h){return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:100%;height:'+h+'px">';}

  function trendSvg(seriesList,keys,fmtK){
    var perM=64,left=48,right=30,top=14,bottom=26,ph=170;
    var w=Math.max(400,left+right+(keys.length-1)*perM), h=top+ph+bottom, pw=w-left-right;
    var maxV=1,minV=0; seriesList.forEach(function(s){keys.forEach(function(k){var v=s.data[k]||0; maxV=Math.max(maxV,v); minV=Math.min(minV,v);});});
    maxV=Math.ceil(maxV*1.15)||1; minV=minV<0?Math.floor(minV*1.15):0;
    var span=(maxV-minV)||1;
    var out='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMinYMin meet" role="img" style="display:block;width:'+w+'px;height:'+h+'px">';
    for(var t=0;t<=4;t++){
      var val=minV+span*t/4, y=top+ph-ph*t/4;
      out+='<line x1="'+left+'" x2="'+(w-right)+'" y1="'+y+'" y2="'+y+'" stroke="'+P().grid+'" stroke-width="1"/>';
      out+='<text x="'+(left-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="9.5" fill="'+P().faint+'">'+(fmtK?Math.round(val/1000)+'k':Math.round(val))+'</text>';
    }
    var stepX=pw/(keys.length-1||1);
    seriesList.forEach(function(s){
      var pts=keys.map(function(k,i){var v=s.data[k]||0; return (left+stepX*i)+','+(top+ph-ph*(v-minV)/span);});
      out+='<path d="M'+pts.join(' L')+'" fill="none" stroke="'+s.color+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      keys.forEach(function(k,i){var v=s.data[k]||0; out+='<circle cx="'+(left+stepX*i)+'" cy="'+(top+ph-ph*(v-minV)/span)+'" r="3" fill="'+s.color+'" stroke="'+P().surface1+'" stroke-width="1.2"/>';});
    });
    keys.forEach(function(k,i){ out+='<text x="'+(left+stepX*i)+'" y="'+(h-6)+'" text-anchor="middle" font-size="10" fill="'+P().faint+'">'+k+'</text>'; });
    out+='</svg>';
    return '<div class="fn-trend-scroll">'+out+'</div>';
  }

  function renderTrend(rows){
    var host=q('#fnTrend'); if(!host)return;
    var byMonth={};
    rows.forEach(function(r){ var k=monthKey(r.date); if(!byMonth[k])byMonth[k]={income:0,expense:0}; byMonth[k].income+=r.income; byMonth[k].expense+=r.expense; });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="fn-empty">'+L('ข้อมูลยังไม่พอสำหรับดูแนวโน้ม (ต้องการอย่างน้อย 2 เดือน)','Not enough data for a trend (at least 2 months needed)')+'</div>';return;}
    var incomeData={}, expenseData={}; keys.forEach(function(k){incomeData[k]=byMonth[k].income;expenseData[k]=byMonth[k].expense;});
    host.innerHTML=trendSvg([{data:incomeData,color:P().ok},{data:expenseData,color:P().err}],keys,true)+
      '<div class="mini" style="display:flex;gap:14px;margin-top:4px"><span style=\"color:'+P().okInk+'\">● '+L('รายรับ','Income')+'</span><span style=\"color:'+P().errInk+'\">● '+L('รายจ่าย','Expense')+'</span></div>';
  }

  function renderBalance(rows){
    var host=q('#fnBalance'); if(!host)return;
    var byMonth={};
    rows.forEach(function(r){ var k=monthKey(r.date); if(!byMonth[k])byMonth[k]=0; byMonth[k]+=(r.income-r.expense); });
    var keys=Object.keys(byMonth).sort();
    if(keys.length<2){host.innerHTML='<div class="fn-empty">'+L('ข้อมูลยังไม่พอ','Not enough data')+'</div>';return;}
    var bal=0, running={}; keys.forEach(function(k){ bal+=byMonth[k]; running[k]=bal; });
    host.innerHTML=trendSvg([{data:running,color:P().series[0]}],keys,true);
  }

  function renderBudget(rows,hasBudget){
    var host=q('#fnBudget'); var sec=q('#fnBudgetSection'); if(!host)return;
    if(!hasBudget){ sec&&sec.setAttribute('hidden',''); return; }
    sec&&sec.removeAttribute('hidden');
    var actual={}, budget={};
    rows.forEach(function(r){
      if(!r.expense)return;
      actual[r.category]=(actual[r.category]||0)+r.expense;
      if(r.budget!=null) budget[r.category]=Math.max(budget[r.category]||0,r.budget);
    });
    var cats=Object.keys(actual).filter(function(k){return budget[k]!=null;}).sort(function(a,b){return actual[b]-actual[a];}).slice(0,6);
    if(!cats.length){host.innerHTML='<div class="fn-empty">'+L('ไม่มีข้อมูลงบประมาณต่อหมวดที่ใช้เทียบได้','No per-category budget data to compare')+'</div>';return;}
    var w=460, rowH=30, left=140, right=44, barW=w-left-right;
    var h=14+cats.length*rowH;
    var maxV=Math.max.apply(null,cats.map(function(k){return Math.max(actual[k],budget[k]);}))||1;
    var out=svgOpen(w,h);
    cats.forEach(function(k,i){
      var y=10+i*rowH, act=actual[k], bud=budget[k];
      var bw=Math.max(2,barW*act/maxV), budgetX=left+barW*bud/maxV;
      var over=act>bud;
      out+='<text x="'+(left-8)+'" y="'+(y+13)+'" text-anchor="end" font-size="10.5" fill="'+P().text+'">'+esc(k.length>16?k.slice(0,15)+'…':k)+'</text>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+barW+'" height="16" rx="4" fill="'+P().surface2+'"/>';
      out+='<rect x="'+left+'" y="'+y+'" width="'+bw+'" height="16" rx="4" fill="'+(over?P().err:P().ok)+'"/>';
      out+='<line x1="'+budgetX+'" x2="'+budgetX+'" y1="'+(y-3)+'" y2="'+(y+19)+'" stroke="'+P().axis+'" stroke-width="2"/>';
      var diff=act-bud, diffTxt=(diff>=0?'+':'−')+'฿'+Math.abs(Math.round(diff/1000))+'k';
      out+='<text x="'+(left+bw+6)+'" y="'+(y+13)+'" font-size="10" font-weight="700" fill="'+(over?P().err:P().ok)+'">'+diffTxt+L(' vs งบ',' vs budget')+'</text>';
    });
    out+='</svg>';
    host.innerHTML=out;
  }

  function donutChart(entries, centerLabel, fmtFn){
    fmtFn=fmtFn||function(v){return v;};
    var size=168, thick=24, r=(size-thick)/2, c=size/2, circ=2*Math.PI*r;
    var total=entries.reduce(function(s,e){return s+e[1];},0)||1;
    var offset=0, segs='';
    entries.forEach(function(e){
      var len=circ*(e[1]/total);
      segs+='<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+e[2]+'" stroke-width="'+thick+'" stroke-dasharray="'+len+' '+(circ-len)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 '+c+' '+c+')"/>';
      offset+=len;
    });
    var svg='<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" role="img" style="flex:none">'+segs+
      '<circle cx="'+c+'" cy="'+c+'" r="'+(r-thick/2-3)+'" fill="'+P().surface1+'"/>'+
      '<text x="'+c+'" y="'+(c-3)+'" text-anchor="middle" font-size="19" font-weight="850" fill="'+P().text+'">'+esc(fmtFn(total))+'</text>'+
      '<text x="'+c+'" y="'+(c+16)+'" text-anchor="middle" font-size="9.5" fill="'+P().text+'">'+esc(centerLabel)+'</text>'+
    '</svg>';
    var legend='<div class="fn-donut-legend">'+entries.map(function(e){
      var pct=(e[1]/total*100).toFixed(0);
      return '<div class="row"><i style="background:'+e[2]+'"></i><span style="flex:1">'+esc(e[0])+'</span><b>'+esc(fmtFn(e[1]))+'</b><span style="color:var(--ome-text-2);width:32px;text-align:right">'+pct+'%</span></div>';
    }).join('')+'</div>';
    return '<div class="fn-donut-wrap">'+svg+legend+'</div>';
  }

  function renderAccount(rows,hasAccount){
    var host=q('#fnAccount'); var sec=q('#fnAccountSection'); if(!host)return;
    if(!hasAccount){ sec&&sec.setAttribute('hidden',''); return; }
    sec&&sec.removeAttribute('hidden');
    var map={}; rows.forEach(function(r){ if(r.income) map[r.account]=(map[r.account]||0)+r.income; });
    var entries=Object.keys(map).map(function(k,i){return [k,map[k],P().series[i%8]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
    host.innerHTML=entries.length?donutChart(entries,L('รายรับรวม','Total income'),function(v){return '฿'+Math.round(v/1000)+'k';}):'<div class="fn-empty">'+L('ไม่มีข้อมูล','No data')+'</div>';
  }

  function suppressLayout(){
    var layout=q('#financeControlLayout');
    if(layout) layout.classList.add('finance-override-hidden');
    qa('.finance-hidden-source').forEach(function(e){ e.classList.remove('finance-hidden-source'); });
  }

  /* บั๊กเรื่องลำดับเวลาที่เจอตอนทดสอบสลับไฟล์หลายรอบ — ดูคอมเมนต์เต็มที่ __tdRevalidate ของ
     report-dashboard.safety.final1.js (แพทเทิร์นเดียวกัน): ลงทะเบียนให้โมดูลอื่นเรียก "บังคับ" ประเมินใหม่ได้ */
  function __tdRevalidate(){
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='finance'){ suppressLayout(); return; }
    var data=getData();
    if(!data){ suppressLayout(); return; }
  }
  (window.__tdDomainRegistry=window.__tdDomainRegistry||[]).push({id:'financeControlLayout',revalidate:__tdRevalidate});

  function buildNoMatchNotice(){
    var layout=injectLayout(); if(!layout)return;
    if(layout.getAttribute('data-built')==='notice')return;
    layout.setAttribute('data-built','notice');
    layout.innerHTML='<section class="fn-panel"><h3>Finance Control</h3>'+
      '<div class="fn-empty">'+L('ข้อมูลชุดนี้ไม่มีคอลัมน์ที่เข้าข่ายรายการเงิน (ต้องมีคอลัมน์วันที่ '+
      'ร่วมกับ รายรับ/รายจ่าย/ยอดเงิน) — ลองเลือก Template เป็น "Auto" หรืออัปโหลดข้อมูลที่มีคอลัมน์เหล่านี้','This data has no money-transaction columns (a date column together with income / expense / amount is required) — try setting Template to "Auto" or upload data that has these columns')+'</div></section>';
    qa('#domainDashboardCard,#scadaProgressCard,#projectSpecialGrid,#biProjectControlCard').forEach(function(e){
      if(e) e.classList.add('finance-hidden-source');
    });
  }

  function render(){
    scheduled=false;
    var A=window.TanotDashboard;
    var st0=A&&typeof A.getState==='function'?A.getState():null;
    var ov=st0&&st0.domainOverride;
    if(ov && ov!=='finance'){ suppressLayout(); return; }
    var scl=q('#financeControlLayout'); if(scl) scl.classList.remove('finance-override-hidden');
    /* บั๊กที่ผู้ใช้เจอ (สลับไฟล์ระหว่างเซสชันเดียวกันโดยไม่รีเฟรชหน้า): เดิม getData() ไม่แมตช์แล้วแค่
       return เฉยๆ ไม่เคยเรียก suppressLayout() ตัวเอง data-built เลยค้าง '1' ตลอดไป ทำให้โดเมนใหม่ที่
       ถูกต้องไม่มีสิทธิ์แสดงเลย (mutual exclusion เข้าใจผิดว่ายังมีโดเมนนี้ครองพื้นที่อยู่) */
    var data=getData(); if(!data){suppressLayout();return;}
    (window.__tdDomainRegistry||[]).forEach(function(m){ if(m.id!=='financeControlLayout'){ try{m.revalidate();}catch(e){} } });
    var others=qa('[id$="ControlLayout"]').filter(function(e){return e.id!=='financeControlLayout' && e.getAttribute('data-built')==='1' && e.className.indexOf('override-hidden')===-1;});
    if(others.length) return;
    if(data.noMatch){ buildNoMatchNotice(); return; }
    if(!build())return;
    var rows=data.rows;
    var totalIncome=rows.reduce(function(s,r){return s+r.income;},0);
    var totalExpense=rows.reduce(function(s,r){return s+r.expense;},0);
    var net=totalIncome-totalExpense;
    var monthsSpan=Object.keys(rows.reduce(function(m,r){m[monthKey(r.date)]=1;return m;},{})).length||1;
    var savingsRate=totalIncome>0?(net/totalIncome*100):null;
    var srClass=savingsRate==null?'':savingsRate<0?' bad':savingsRate<10?' warn':'';

    q('#fnKpis').innerHTML=
      '<div class="fn-kpi"><div class="l">'+L('รายรับรวม','Total income')+'</div><div class="v">'+baht(totalIncome)+'</div><div class="s">'+monthsSpan+L(' เดือน',' months')+'</div></div>'+
      '<div class="fn-kpi'+(totalExpense>totalIncome?' bad':'')+'"><div class="l">'+L('รายจ่ายรวม','Total expenses')+'</div><div class="v">'+baht(totalExpense)+'</div><div class="s">'+monthsSpan+L(' เดือน',' months')+'</div></div>'+
      '<div class="fn-kpi'+(net<0?' bad':'')+'"><div class="l">'+L('กระแสเงินสดสุทธิ','Net cash flow')+'</div><div class="v">'+baht(net)+'</div><div class="s">'+L('รายรับ − รายจ่าย','Income − expenses')+'</div></div>'+
      '<div class="fn-kpi"><div class="l">'+L('รายจ่ายเฉลี่ย/เดือน','Average monthly expenses')+'</div><div class="v">'+baht(totalExpense/monthsSpan)+'</div><div class="s">'+L('เฉลี่ยสะสม','Cumulative average')+'</div></div>'+
      '<div class="fn-kpi'+srClass+'"><div class="l">'+L('อัตราการออม','Savings rate')+'</div><div class="v">'+(savingsRate==null?'—':savingsRate.toFixed(0)+'%')+'</div><div class="s">'+L('ของรายรับ','of income')+'</div></div>';

    var statusText=net<0?L('กระแสเงินสดติดลบ ต้องระวัง','Cash flow is negative — be careful'):L('กระแสเงินสดเป็นบวก','Cash flow is positive');
    q('#fnInsight').innerHTML=L('สถานะโดยรวม <b>'+statusText+'</b> — รายรับรวม <b>'+baht(totalIncome)+'</b> รายจ่ายรวม <b>'+baht(totalExpense)+'</b> คงเหลือสุทธิ <b>'+baht(net)+'</b>'+(savingsRate!=null?' (อัตราการออม '+savingsRate.toFixed(0)+'%)':'')+'.','Overall status <b>'+statusText+'</b> — total income <b>'+baht(totalIncome)+'</b>, total expenses <b>'+baht(totalExpense)+'</b>, net balance <b>'+baht(net)+'</b>'+(savingsRate!=null?' (savings rate '+savingsRate.toFixed(0)+'%)':'')+'.');

    renderTrend(rows); renderBudget(rows,data.hasBudget); renderAccount(rows,data.hasAccount); renderBalance(rows);

    var recent=rows.slice().sort(function(a,b){return b.date-a.date;}).slice(0,10);
    q('#fnRecent').innerHTML=recent.length?recent.map(function(r){
      var isIncome=r.income>0;
      return '<div class="fn-list"><b>'+esc(r.description||r.category)+'</b><span>'+(isIncome?L('รายรับ','Income'):L('รายจ่าย','Expense'))+' · '+esc(r.category)+'</span><span style="color:'+(isIncome?'var(--ome-ok-ink)':'var(--ome-err-ink)')+';font-weight:700">'+(isIncome?'+':'-')+baht(isIncome?r.income:r.expense)+'</span></div>';
    }).join(''):'<div class="fn-empty">'+L('ไม่มีข้อมูล','No data')+'</div>';

    var today=new Date();
    q('#fnUpdated').textContent=L('รอบข้อมูลถึง ','Data through ')+fmt(today)+' · '+rows.length.toLocaleString()+L(' รายการ',' items');
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true; cancelAnimationFrame(raf);
    raf=requestAnimationFrame(function(){try{render();}catch(e){console.error('[Finance1]',e);}});
  }

  function init(){
    injectCSS();
    window.TanotReportUtils.onTheme(schedule);
    if(window.OME_LANG&&window.OME_LANG.onChange)window.OME_LANG.onChange(function(){var l=document.getElementById('financeControlLayout');if(l)l.removeAttribute('data-built');schedule();});
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
