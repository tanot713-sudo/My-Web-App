
(function(){
  'use strict';
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true}); else fn(); }
  ready(function(){
    var A=window.TanotDashboard;
    if(!A) return;
    var state=A.getState();
    state.bi=state.bi||{}; state.bi.model=state.bi.model||{roles:{},tables:[],relationships:[]}; state.bi.parameters=state.bi.parameters||{};
    if(!state.bi.parameters.chartEngine) state.bi.parameters.chartEngine='echarts';
    if(!state.bi.parameters.topN) state.bi.parameters.topN=10;
    var eCharts={};
    var gantt=null;
    /* สีกราฟมาจาก chart-theme.js ทั้งหมด (โทเคน --ome-chart-*) — fallback เฉพาะตอนโหลดไม่ขึ้น */
    var FALLBACK_T={series:['#2A78D6','#EB6834','#1BAF7A','#EDA100','#E87BA4','#008300','#4A3AA7','#E34948'],grid:'#E6E9F2',axis:'#727C93',text:'#1F2430',textMuted:'#727C93',surface:'#FFFFFF',border:'#EAEDF5',font:'system-ui,sans-serif'};
    function theme(){var t=null;try{t=window.OmeChartTheme&&window.OmeChartTheme.get();}catch(e){}if(t&&window.Chart&&window.OmeChartTheme.chartjs)window.OmeChartTheme.chartjs(window.Chart);return t||FALLBACK_T;}
    function C(i){return theme().series[i%8];}
    function soft(c,a){return window.OmeChartTheme&&window.OmeChartTheme.alpha?window.OmeChartTheme.alpha(c,a):c;}
    function einit(el){return echarts.init(el,window.OmeChartTheme&&window.OmeChartTheme.echarts?window.OmeChartTheme.echarts():null);}

    function esc(s){var d=document.createElement('div');d.textContent=String(s==null?'':s);return d.innerHTML;}
    function norm(s){return String(s==null?'':s).toLowerCase().replace(/\s+/g,' ').trim();}
    function colByKey(k){return (state.columns||[]).find(function(c){return c.key===k;})||null;}
    function colsByLabel(keys){
      var arr=state.columns||[];
      for(var i=0;i<arr.length;i++){var c=arr[i],n=norm(c.label); if(keys.some(function(k){return n.indexOf(norm(k))>=0;})) return c;}
      return null;
    }
    function firstRole(role, fallbacks){ return colByKey((state.bi.model.roles||{})[role]) || colsByLabel(fallbacks||[]); }
    function pct(v){ var n=Number(v); if(!isFinite(n))return 0; if(Math.abs(n)<=1)return Math.max(0,Math.min(100,n*100)); return Math.max(0,Math.min(100,n)); }
    function dateVal(v){if(v instanceof Date&&!isNaN(v))return v;var d=new Date(v);return isNaN(d)?null:d;}
    function formatCompact(n){var x=Number(n)||0, ax=Math.abs(x); if(ax>=1e9)return (x/1e9).toFixed(1)+'B'; if(ax>=1e6)return (x/1e6).toFixed(1)+'M'; if(ax>=1e3)return (x/1e3).toFixed(1)+'K'; return x.toLocaleString();}
    function activeRows(){ return (state.rows||[]).filter(function(r){
      if(state.globalQuery){var q=norm(state.globalQuery); if(!state.columns.some(function(c){return norm(r[c.key]).indexOf(q)>=0;}))return false;}
      var ok=true; Object.keys(state.dashboardFilters||{}).forEach(function(k){var f=state.dashboardFilters[k]; if(f!=null&&f!==''){var v=String(r[k]==null?'':r[k]); if(Array.isArray(f)){if(f.length&&!f.includes(v))ok=false;} else if(v!==String(f))ok=false;}});
      if(state.drill&&state.drill.key){if(String(r[state.drill.key]==null?'':r[state.drill.key])!==String(state.drill.value))ok=false;}
      var dk=state.dashboardDateCol; if(dk&&(state.dashboardDateFrom||state.dashboardDateTo)){var d=dateVal(r[dk]); if(d){var iso=d.toISOString().slice(0,10); if(state.dashboardDateFrom&&iso<state.dashboardDateFrom)ok=false; if(state.dashboardDateTo&&iso>state.dashboardDateTo)ok=false;}}
      return ok;
    });}
    function aggregate(rows, catKey, numKey){
      var m=new Map(); (rows||[]).forEach(function(r){var lab=r[catKey]; var label=lab==null||lab===''?'(blank)':String(lab); var v=numKey?Number(r[numKey]):1; if(!isFinite(v))v=0; m.set(label,(m.get(label)||0)+v);});
      return Array.from(m.entries()).sort(function(a,b){return b[1]-a[1];});
    }
    function aggregateDate(rows,dateKey,numKey){
      var m=new Map(); (rows||[]).forEach(function(r){var d=dateVal(r[dateKey]); if(!d)return; var key=d.toISOString().slice(0,7); var v=numKey?Number(r[numKey]):1;if(!isFinite(v))v=0;m.set(key,(m.get(key)||0)+v);});
      return Array.from(m.entries()).sort(function(a,b){return a[0]<b[0]?-1:1;});
    }
    function showProCard(show){var el=document.getElementById('biProjectControlCard');if(el)el.style.display=show?'block':'none';}
    function enoughForProjectControl(){
      var r=state.bi.model.roles||{};
      var start=firstRole('start',['start','เริ่ม','วันที่เริ่ม','contract start']);
      var end=firstRole('end',['finish','end','สิ้นสุด','กำหนดเสร็จ']);
      var task=firstRole('task',['task name','task','กิจกรรม','งาน']);
      var proj=firstRole('project',['project name','project','โครงการ']);
      return !!(start&&end&&(task||proj));
    }
    function destroyE(id){if(eCharts[id]){try{eCharts[id].dispose();}catch(_){ } delete eCharts[id];}}
    function ec(id, option){var el=document.getElementById(id);if(!el||!window.echarts)return null;destroyE(id);var c=einit(el);c.setOption(option);eCharts[id]=c;return c;}
    function commonText(){return {fontFamily:theme().font}}

    function renderProgressChart(){
      var rows=activeRows(), task=firstRole('task',['task name','task','กิจกรรม','งาน']), proj=firstRole('project',['project name','project','โครงการ']), actual=firstRole('actual',['actual','actual progress','%complete actual','% complete']), plan=firstRole('plan',['plan','planned','%complete plan','% complete plan']);
      var cat=task||proj; if(!cat){return;}
      var arr=rows.map(function(r){return {name:String(r[cat.key]||'(blank)'),a:pct(actual?r[actual.key]:0),p:pct(plan?r[plan.key]:0)};}).filter(function(x){return x.name&&x.name!=='(blank)' || x.a||x.p;});
      var top=Number(state.bi.parameters.topN||10); arr.sort(function(a,b){return b.a-a.a;}); arr=arr.slice(0,top); arr.reverse();
      ec('biProgressChart',{animation:true,textStyle:commonText(),tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(ps){return '<b>'+esc(ps[0].name)+'</b><br>Actual: '+ps[0].value+'%<br>Plan: '+(ps[1]?ps[1].value:'—')+'%';}},legend:{top:0,data:['Actual','Plan']},grid:{left:110,right:22,top:38,bottom:24},xAxis:{type:'value',max:100,axisLabel:{formatter:'{value}%'}},yAxis:{type:'category',data:arr.map(function(x){return x.name;}),axisLabel:{fontSize:10}},series:[{name:'Actual',type:'bar',data:arr.map(function(x){return +x.a.toFixed(1);}),itemStyle:{color:C(0)},barWidth:10},{name:'Plan',type:'bar',data:arr.map(function(x){return +x.p.toFixed(1);}),itemStyle:{color:soft(C(0),.35)},barWidth:10}]});
    }

    function renderStatusChart(){
      var rows=activeRows(), status=firstRole('status',['status','สถานะ']), cat=status||firstRole('project',['project']);
      if(!cat)return; var arr=aggregate(rows,cat.key,null); var top=Number(state.bi.parameters.topN||10); arr=arr.slice(0,top);
      var c=ec('biStatusChart',{textStyle:commonText(),tooltip:{trigger:'item'},grid:{left:35,right:20,top:18,bottom:42},xAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{interval:0,rotate:25,fontSize:9}},yAxis:{type:'value'},series:[{type:'bar',data:arr.map(function(x){return x[1];}),barMaxWidth:34,itemStyle:{color:function(p){var pal=[C(2),C(0),C(3),C(7),C(6),C(1),C(4),C(5)];return pal[p.dataIndex%pal.length];}}}]});
      var box=document.getElementById('biAttentionPanel'); if(box){var late=rows.filter(function(r){var st=String(status?r[status.key]:'').toLowerCase();return /overdue|late|delay|ล่าช้า|เกิน/.test(st);}).length; var done=rows.filter(function(r){var st=String(status?r[status.key]:'').toLowerCase();return /complete|closed|done|เสร็จ|ปิด/.test(st);}).length; box.innerHTML='<div class="bi-attention-grid"><div class="bi-attention-card"><div class="n">'+rows.length+'</div><div class="l">Items</div></div><div class="bi-attention-card"><div class="n">'+done+'</div><div class="l">Complete</div></div><div class="bi-attention-card"><div class="n">'+late+'</div><div class="l">Attention</div></div><div class="bi-attention-card"><div class="n">'+Math.max(0,rows.length-done-late)+'</div><div class="l">Open</div></div></div>';
      }
    }
    function renderCostChart(){
      var rows=activeRows(), cat=firstRole('customer',['customer','ลูกค้า','หน่วยงาน'])||firstRole('project',['project','โครงการ']), cost=firstRole('cost',['cost','actual cost','value','amount','มูลค่า','ค่าใช้จ่าย']); if(!cat){return;}
      var arr=aggregate(rows,cat.key,cost?cost.key:null), top=Number(state.bi.parameters.topN||10); arr=arr.slice(0,top); ec('biCostChart',{textStyle:commonText(),tooltip:{trigger:'axis',axisPointer:{type:'shadow'},valueFormatter:function(v){return formatCompact(v)}},grid:{left:110,right:20,top:18,bottom:24},xAxis:{type:'value'},yAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{fontSize:9}},series:[{type:'bar',data:arr.map(function(x){return Math.round(x[1]);}),itemStyle:{color:C(2)},barWidth:15}]});
    }
    function renderTrendChart(){
      var rows=activeRows(), date=firstRole('start',['start','start date','วันที่เริ่ม'])||firstRole('end',['finish','end','date','วันที่']); actual=firstRole('actual',['actual','actual progress','progress','% complete']); if(!date)return; var arr=aggregateDate(rows,date.key,actual?actual.key:null); ec('biTrendChart',{textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:40,right:20,top:18,bottom:45},xAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{rotate:35,fontSize:9}},yAxis:{type:'value'},series:[{name:'Actual',type:'line',smooth:true,showSymbol:true,data:arr.map(function(x){return actual?pct(x[1]):x[1];}),areaStyle:{opacity:.12},lineStyle:{width:3,color:C(0)},itemStyle:{color:C(0)}}]});
    }

    function buildGantt(){
      var box=document.getElementById('biGantt'); if(!box||!window.Gantt)return;
      var rows=activeRows(), task=firstRole('task',['task name','task','กิจกรรม','งาน']), proj=firstRole('project',['project name','project','โครงการ']), start=firstRole('start',['start','start date','วันที่เริ่ม']), end=firstRole('end',['finish','end','end date','วันที่สิ้นสุด']), actual=firstRole('actual',['actual','actual progress','%complete actual','progress']);
      if(!(start&&end&&(task||proj))){box.innerHTML='<div class="mini" style="padding:20px">Timeline needs Project/Task + Start + End columns.</div>';return;}
      var src=rows.map(function(r,i){var s=dateVal(r[start.key]),e=dateVal(r[end.key]);if(!s||!e)return null;var n=String(r[(task||proj).key]||('Item '+(i+1))).trim();if(!n)n='Item '+(i+1);return {id:'g'+i,name:n.slice(0,90),start:s,end:e,progress:actual?pct(r[actual.key]):0,custom_class:'bi-gantt-bar'};}).filter(Boolean);
      if(!src.length){box.innerHTML='<div class="mini" style="padding:20px">No valid Start/End data.</div>';return;}
      box.innerHTML=''; try{ if(gantt&&gantt.destroy)gantt.destroy(); }catch(_){ }
      gantt=new Gantt('#biGantt',src,{view_mode:'Year',today_button:true,readonly:true,bar_height:22,bar_corner_radius:5,arrow_curve:5,padding:18,custom_popup_html:function(t){return '<div style="padding:8px 10px;font-size:12px"><b>'+esc(t.name)+'</b><br>Start: '+esc(t.start) +'<br>End: '+esc(t.end)+'<br>Progress: '+t.progress+'%</div>';}});
      [].forEach.call(document.querySelectorAll('#biGanttToolbar [data-gantt-view]'),function(btn){btn.classList.toggle('on',btn.dataset.ganttView==='Year'); if(!btn.__biBound){btn.__biBound=true;btn.onclick=function(){if(gantt&&gantt.change_view_mode)gantt.change_view_mode(btn.dataset.ganttView);[].forEach.call(document.querySelectorAll('#biGanttToolbar [data-gantt-view]'),function(b){b.classList.toggle('on',b===btn);});};}});
    }
    function renderPro(){
      var show=enoughForProjectControl(); showProCard(show); if(!show)return;
      var title=document.getElementById('biProjectControlTitle'); if(title){title.textContent='Project Control';}
      if(window.echarts){renderProgressChart();renderStatusChart();renderCostChart();renderTrendChart();}
      if(window.Gantt)buildGantt();
    }

    function replaceLegacyCanvas(canvasId, renderFn){
      var c=document.getElementById(canvasId); if(!c)return; var host=c.parentElement; if(!host)return;
      if(host.__biEcharts){return;}
      var div=document.createElement('div');div.id=canvasId+'_echarts';div.style.width='100%';div.style.height='100%';div.className='bi-echart-legacy';
      c.style.display='none'; host.insertBefore(div,c); host.__biEcharts=true; host.__biEchartsId=div.id;
    }
    function renderMainECharts(){
      if(!window.echarts)return;
      var engine=(state.bi.parameters.chartEngine||'echarts');
      var bar=document.getElementById('barChart'),line=document.getElementById('lineChart'),pie=document.getElementById('pieChart');
      if(engine!=='echarts'){
        [bar,line,pie].forEach(function(c){if(!c)return; c.style.display=''; var h=c.parentElement; if(h){var d=h.querySelector('.bi-echart-legacy'); if(d){destroyE(d.id);d.remove();} h.__biEcharts=false;}});
        return;
      }
      // Build ECharts containers beside existing canvases; hide Chart.js canvas visually.
      [bar,line,pie].forEach(function(c){if(c){var h=c.parentElement;if(h&&!h.__biEcharts){var d=document.createElement('div');d.id=c.id+'_echarts';d.style.width='100%';d.style.height='100%';d.className='bi-echart-legacy';h.insertBefore(d,c);c.style.display='none';h.__biEcharts=true;}}});
      var rows=activeRows();
      var bcat=firstRole('customer',['customer','ลูกค้า'])||firstRole('status',['status','สถานะ'])||firstRole('project',['project','โครงการ']); var num=firstRole('cost',['cost','value','amount','มูลค่า','ค่าใช้จ่าย'])||firstRole('actual',['actual','progress']);
      if(bcat){var arr=aggregate(rows,bcat.key,num?num.key:null).slice(0,Number(state.bi.parameters.topN||10));if(document.getElementById('barChart_echarts')){destroyE('barChart_echarts');eCharts['barChart_echarts']=einit(document.getElementById('barChart_echarts'));eCharts['barChart_echarts'].setOption({textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:90,right:20,top:15,bottom:35},xAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{rotate:25,fontSize:9}},yAxis:{type:'value'},series:[{type:'bar',data:arr.map(function(x){return x[1]}),itemStyle:{color:C(0)}}]});eCharts['barChart_echarts'].on('click',function(p){A.setDrill(bcat.key,p.name);});}}
      var dcol=firstRole('start',['start','start date'])||firstRole('end',['finish','end','date']); if(dcol){var ar=aggregateDate(rows,dcol.key,num?num.key:null); if(document.getElementById('lineChart_echarts')){destroyE('lineChart_echarts');eCharts['lineChart_echarts']=einit(document.getElementById('lineChart_echarts'));eCharts['lineChart_echarts'].setOption({textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:38,right:20,top:15,bottom:40},xAxis:{type:'category',data:ar.map(function(x){return x[0]}),axisLabel:{rotate:30,fontSize:9}},yAxis:{type:'value'},series:[{type:'line',smooth:true,data:ar.map(function(x){return x[1]}),areaStyle:{opacity:.14},lineStyle:{color:C(0),width:3},itemStyle:{color:C(0)}}]});}}
      if(bcat){var pr=aggregate(rows,bcat.key,null).slice(0,Number(state.bi.parameters.topN||10)); if(document.getElementById('pieChart_echarts')){destroyE('pieChart_echarts');eCharts['pieChart_echarts']=einit(document.getElementById('pieChart_echarts'));eCharts['pieChart_echarts'].setOption({textStyle:commonText(),tooltip:{trigger:'item'},legend:{type:'scroll',bottom:0,left:'center'},series:[{type:'pie',radius:['45%','72%'],avoidLabelOverlap:true,data:pr.map(function(x){return {name:x[0],value:x[1]}}),label:{fontSize:9}}]});eCharts['pieChart_echarts'].on('click',function(p){A.setDrill(bcat.key,p.name);});}}
    }

    function enhanceHeader(){}

    function patchRender(){
      var old=A.renderDashboard; if(!old||old.__bi21)return; function wrapped(){old.apply(null,arguments); requestAnimationFrame(function(){setTimeout(function(){try{state=A.getState();if(!state)return;renderPro();renderMainECharts();enhanceHeader();}catch(e){console.warn('BI render skipped',e);}},30);});} wrapped.__bi21=true; A.renderDashboard=wrapped;
      var oldC=A.renderCustomView;if(oldC&&!oldC.__bi21){function wc(){oldC.apply(null,arguments); requestAnimationFrame(function(){setTimeout(function(){try{state=A.getState();if(!state)return;bindCustomProWidgets();}catch(e){console.warn('Custom BI render skipped',e);}},80);});} wc.__bi21=true;A.renderCustomView=wc;}
    }

    function bindCustomProWidgets(){
      if(!window.echarts)return;
      document.querySelectorAll('#customView .widget-body').forEach(function(body){
        var item=body.closest('.grid-stack-item'); if(!item)return; var wid=item.getAttribute('gs-id')||item.id; var w=(state.customWidgets||[]).find(function(x){return x.id===wid;}); if(!w||!w.config||w.config.engine!=='echarts')return;
        if(body.__biMounted)return; body.__biMounted=true; body.innerHTML=''; var id='biCustom_'+String(w.id).replace(/[^a-zA-Z0-9_-]/g,'_'); var div=document.createElement('div');div.id=id;div.style.width='100%';div.style.height='100%';body.appendChild(div);
        var cat=colByKey(w.config.catColKey)||firstRole('project',['project']);var num=colByKey(w.config.numColKey)||firstRole('actual',['actual','progress']);if(!cat)return;var arr=aggregate(activeRows(),cat.key,num?num.key:null).slice(0,Number(state.bi.parameters.topN||10));var ch=einit(div);eCharts[id]=ch;var typ=w.config.chartType||'bar';var opt={textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:75,right:15,top:15,bottom:35},xAxis:{type:'category',data:arr.map(function(x){return x[0]}),axisLabel:{fontSize:9,rotate:25}},yAxis:{type:'value'},series:[{type:typ==='line'?'line':'bar',data:arr.map(function(x){return x[1]}),smooth:true,itemStyle:{color:C(0)},areaStyle:typ==='line'?{opacity:.12}:undefined}]};ch.setOption(opt);ch.on('click',function(p){A.setDrill(cat.key,p.name);});
      });
    }

    function addProVisualToCustom(kind){
      var s=A.getState(); var widget={id:'w_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),type:'chart',x:null,y:null,w:kind==='gantt'?12:6,h:kind==='gantt'?5:4,config:{engine:kind==='gantt'?'gantt':'echarts',chartType:kind==='line'?'line':'bar',catColKey:(firstRole('project',['project'])||firstRole('task',['task','task name'])||s.columns[0]||{}).key||null,numColKey:(firstRole('actual',['actual','progress'])||firstRole('cost',['cost','value'])||s.columns.filter(function(c){return c.type==='number'})[0]||{}).key||'' ,title:kind==='gantt'?'Project Timeline':'ECharts '+kind.toUpperCase()}};
      s.customWidgets.push(widget);A.persist();A.renderCustomView();
    }

    // Public, idempotent hooks used by the shell/hamburger/command palette.
    window.__tanotAddProVisualToCustom=function(kind){
      try {
        var s=A.getState();
        if(!s||!s.rows||!s.rows.length){ if(window.showBIToast) window.showBIToast('Upload a file first','error'); return false; }
        A.setView('custom');
        setTimeout(function(){ try{ addProVisualToCustom(kind||'bar'); }catch(err){ console.error('[BI] add visual failed',err); if(window.showBIToast) window.showBIToast('Unable to add this visual.','error'); } },120);
        return true;
      } catch(err){ console.error('[BI] add visual hook failed',err); return false; }
    };

    /* พาเลตต์คำสั่งของแดชบอร์ด (ปุ่มค้นหาบนแถบคำสั่ง) — กล่องโต้ตอบกลาง <dialog class="dialog"> */
    function installCommandPalette(){
      if(document.getElementById('biCommandPalette'))return;
      var U=window.TanotReportUtils;
      var dlg=document.createElement('dialog');dlg.id='biCommandPalette';dlg.className='dialog rd-dialog rd-palette';dlg.setAttribute('aria-label','Command Palette');
      dlg.innerHTML='<div class="dialog-body"><input id="biCommandInput" class="input" type="search" placeholder="Search commands…" autocomplete="off"><div id="biCommandList" class="list rd-palette-list"></div></div>';
      document.body.appendChild(dlg);
      function needData(){var s=A.getState();if(!s||!s.rows||!s.rows.length){if(window.showBIToast)window.showBIToast('Upload a file first','error');close();return true;}return false;}
      function addVisual(kind){return function(){if(needData())return;if(window.__tanotAddProVisualToCustom)window.__tanotAddProVisualToCustom(kind);else{A.setView('custom');setTimeout(function(){addProVisualToCustom(kind);},120);}close();};}
      var actions=[
        ['chart-column','Open Dashboard',function(){A.setView('dashboard');close();}],
        ['layout-grid','Open Custom',function(){A.setView('custom');close();}],
        ['plus','Add ECharts Bar',addVisual('bar')],
        ['chart-line','Add ECharts Line',addVisual('line')],
        ['calendar-clock','Add Project Gantt',addVisual('gantt')],
        ['brain','BI Studio',function(){A.openBIModal('model');close();}],
        ['maximize-2','Fullscreen Dashboard',function(){var b=document.getElementById('dashboardFullBtn');if(b)b.click();close();}]
      ];
      function renderList(q){
        var list=document.getElementById('biCommandList');var z=norm(q||'');
        var shown=actions.filter(function(a){return !z||norm(a[1]).indexOf(z)>=0;});
        list.innerHTML=shown.map(function(a,i){return '<button type="button" class="list-row" data-i="'+i+'"><span class="lead">'+U.icon(a[0])+'</span><span class="grow"><span class="title">'+esc(a[1])+'</span></span></button>';}).join('')||'<div class="empty">—</div>';
        [].forEach.call(list.querySelectorAll('[data-i]'),function(x){x.onclick=function(){var a=shown[+x.dataset.i];if(a)a[2]();};});
      }
      function open(){var inp=document.getElementById('biCommandInput');if(!dlg.open)dlg.showModal();if(inp){inp.value='';renderList('');inp.focus();}}
      function close(){if(dlg.open)dlg.close();}
      document.getElementById('biCommandInput').addEventListener('input',function(){renderList(this.value);});
      dlg.addEventListener('click',function(e){if(e.target===dlg)close();});
      window.__tanotCommandPalette={open:open,close:close};
    }

    function addToolsToCustomMenu(){
      var panel=document.getElementById('customToolsPanel'); if(!panel||panel.querySelector('[data-custom-pro]'))return;
      var sec=panel.querySelector('.utility-menu-section'); if(!sec)return;
      var b=document.createElement('button');b.type='button';b.className='btn utility-menu-item';b.dataset.customPro='1';b.innerHTML=window.TanotReportUtils.icon('zap')+'<span>BI Visuals</span>';b.onclick=function(){openProVisualPicker();};sec.appendChild(b);
    }
    function openProVisualPicker(){
      var U=window.TanotReportUtils;
      var items=[['bar','chart-column','ECharts Bar / Stacked'],['line','chart-line','ECharts Line / Area'],['gantt','calendar-clock','Project Gantt / Timeline']];
      var ui=U.modal('BI Visual Library','<div class="list">'+items.map(function(x){return '<button type="button" class="list-row" data-v="'+x[0]+'"><span class="lead">'+U.icon(x[1])+'</span><span class="grow"><span class="title">'+esc(x[2])+'</span></span></button>';}).join('')+'</div>','');
      [].forEach.call(ui.body.querySelectorAll('[data-v]'),function(x){x.onclick=function(){var k=x.dataset.v;if(window.__tanotAddProVisualToCustom)window.__tanotAddProVisualToCustom(k);else{A.setView('custom');setTimeout(function(){addProVisualToCustom(k);},120);}ui.close();};});
    }

    /* แผง Design — แผ่นข้างขวา (<dialog class="dialog rd-drawer">) */
    function installDesignDrawer(){
      if(document.getElementById('biDesignDrawer'))return;
      var U=window.TanotReportUtils;
      var dr=document.createElement('dialog');dr.id='biDesignDrawer';dr.className='dialog rd-drawer';dr.setAttribute('aria-labelledby','biDesignTitle');
      dr.innerHTML='<div class="dialog-head"><h2 id="biDesignTitle">Dashboard Design</h2><button type="button" class="btn ghost icon sm" data-dlg-x aria-label="Close">'+U.icon('x')+'</button></div>'+
        '<div class="dialog-body">'+
          '<div class="field"><label for="drawerEngine">Engine</label><select id="drawerEngine" class="select"><option value="echarts">ECharts</option><option value="chartjs">Chart.js</option></select></div>'+
          '<div class="field"><label for="drawerTop">Top N</label><select id="drawerTop" class="select"><option>5</option><option selected>10</option><option>20</option><option>50</option></select></div>'+
          '<div class="field"><label>Density</label><div class="segmented" id="drawerDensity"><button type="button" data-density="comfortable">Comfortable</button><button type="button" data-density="compact">Compact</button><button type="button" data-density="dense">Dense</button></div></div>'+
          '<div class="row"><button type="button" class="btn" id="drawerBI">'+U.icon('brain')+'<span>BI Studio</span></button><button type="button" class="btn" id="drawerCmd">'+U.icon('search')+'<span>Command Palette</span></button></div>'+
        '</div>';
      document.body.appendChild(dr);
      function open(){var cur=(document.getElementById('dashboardDensitySel')||{}).value||'comfortable';[].forEach.call(dr.querySelectorAll('[data-density]'),function(x){x.classList.toggle('on',x.dataset.density===cur);});if(!dr.open)dr.showModal();}
      function close(){if(dr.open)dr.close();}
      dr.addEventListener('click',function(e){if(e.target===dr)close();});
      dr.querySelector('[data-dlg-x]').onclick=close;
      dr.querySelector('#drawerBI').onclick=function(){close();A.openBIModal('model');};
      dr.querySelector('#drawerCmd').onclick=function(){close();window.__tanotCommandPalette&&window.__tanotCommandPalette.open();};
      [].forEach.call(dr.querySelectorAll('[data-density]'),function(x){x.onclick=function(){var sel=document.getElementById('dashboardDensitySel');if(sel){sel.value=x.dataset.density;sel.dispatchEvent(new Event('change',{bubbles:true}));}close();};});
      dr.querySelector('#drawerEngine').onchange=function(){state.bi.parameters.chartEngine=this.value;A.persist();A.renderDashboard();};
      dr.querySelector('#drawerTop').onchange=function(){state.bi.parameters.topN=+this.value;var s=document.getElementById('dashboardRankingSel');if(s){s.value='top10';}A.persist();A.renderDashboard();};
      window.__tanotDesignDrawer={open:open,close:close};
      var btn=document.getElementById('dashboardDesignBtn');if(btn){btn.onclick=function(e){e.preventDefault();open();};}
    }

    function toggleFullscreenEl(target){
      if(!target)return;
      if(document.fullscreenElement){try{document.exitFullscreen();}catch(e){}return;}
      try{if(target.requestFullscreen)target.requestFullscreen();else if(target.webkitRequestFullscreen)target.webkitRequestFullscreen();}catch(e){}
    }
    function bindCommandButtons(){
      var ids=['commandPaletteBtn','customCommandPaletteBtn'];
      ids.forEach(function(id){var btn=document.getElementById(id);if(btn&&!btn.__commandWired){btn.__commandWired=true;btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(window.__tanotCommandPalette)window.__tanotCommandPalette.open();});}});
      /* Stage 7 (บั๊กที่ยืนยันแล้ว): ปุ่ม "⛶ Fullscreen" บนแถบเครื่องมือหลักมีอยู่ใน HTML แต่ไม่เคยมี
         event listener ผูกให้เลย กดแล้วไม่มีอะไรเกิดขึ้น */
      var fsBtn=document.getElementById('dashboardFullBtn');
      if(fsBtn&&!fsBtn.__f61Wired){fsBtn.__f61Wired=true;fsBtn.addEventListener('click',function(){toggleFullscreenEl(document.getElementById('dashboardView')||document.documentElement);});}
      /* Stage 7 (บั๊กเดียวกัน): ปุ่ม "⛶" มุมขวาบนของการ์ดกราฟแต่ละใบ (.widget-fullscreen, มี
         data-target ชี้การ์ดตัวเอง) ก็ไม่เคยมี event listener ผูกเช่นกัน — ผูกแบบ delegated ครั้งเดียว
         พอ เพราะการ์ดใหม่ๆ ที่สร้างทีหลัง (เช่น Custom View) ก็มีปุ่มนี้ซ้ำได้อีก */
      if(!document.__f61WidgetFsWired){
        document.__f61WidgetFsWired=true;
        document.addEventListener('click',function(e){
          var b=e.target.closest&&e.target.closest('.widget-fullscreen[data-target]');
          if(!b)return;
          toggleFullscreenEl(document.getElementById(b.getAttribute('data-target')));
        },true);
      }
    }

    function boot(){
      patchRender();installCommandPalette();bindCommandButtons();installDesignDrawer();addToolsToCustomMenu();
      var en=document.getElementById('biEngineSel'),top=document.getElementById('biTopNSel');if(en){en.value=state.bi.parameters.chartEngine||'echarts';en.onchange=function(){state.bi.parameters.chartEngine=this.value;A.persist();A.renderDashboard();};}if(top){top.value=String(state.bi.parameters.topN||10);top.onchange=function(){state.bi.parameters.topN=+this.value||10;A.persist();A.renderDashboard();};}
      if(A.getCurrentView&&A.getCurrentView()==='dashboard')setTimeout(function(){renderPro();renderMainECharts();},100);
      window.addEventListener('resize',function(){Object.keys(eCharts).forEach(function(k){try{eCharts[k].resize();}catch(_){}});});
      /* สีกราฟเปลี่ยนตามสว่าง/มืด/สีเน้น — ECharts ต้อง dispose แล้ว init ใหม่ด้วยธีมใหม่ (ตัวรอบแกนกลางวาด Chart.js ใหม่เองอยู่แล้ว) */
      if(window.OmeChartTheme)window.OmeChartTheme.onChange(function(){
        try{
          var v=A.getCurrentView&&A.getCurrentView();
          if(v==='dashboard'){state=A.getState();renderPro();renderMainECharts();}
          else if(v==='custom'){setTimeout(function(){state=A.getState();bindCustomProWidgets();},120);}
        }catch(e){console.warn('BI theme redraw skipped',e);}
      });
    }
    boot();
  });
})();
