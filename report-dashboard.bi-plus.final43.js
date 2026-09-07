
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
    function ec(id, option){var el=document.getElementById(id);if(!el||!window.echarts)return null;destroyE(id);var c=echarts.init(el);c.setOption(option);eCharts[id]=c;return c;}
    function commonText(){return {fontFamily:'Arial'}}

    function renderProgressChart(){
      var rows=activeRows(), task=firstRole('task',['task name','task','กิจกรรม','งาน']), proj=firstRole('project',['project name','project','โครงการ']), actual=firstRole('actual',['actual','actual progress','%complete actual','% complete']), plan=firstRole('plan',['plan','planned','%complete plan','% complete plan']);
      var cat=task||proj; if(!cat){return;}
      var arr=rows.map(function(r){return {name:String(r[cat.key]||'(blank)'),a:pct(actual?r[actual.key]:0),p:pct(plan?r[plan.key]:0)};}).filter(function(x){return x.name&&x.name!=='(blank)' || x.a||x.p;});
      var top=Number(state.bi.parameters.topN||10); arr.sort(function(a,b){return b.a-a.a;}); arr=arr.slice(0,top); arr.reverse();
      ec('biProgressChart',{animation:true,textStyle:commonText(),tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(ps){return '<b>'+esc(ps[0].name)+'</b><br>Actual: '+ps[0].value+'%<br>Plan: '+(ps[1]?ps[1].value:'—')+'%';}},legend:{top:0,data:['Actual','Plan']},grid:{left:110,right:22,top:38,bottom:24},xAxis:{type:'value',max:100,axisLabel:{formatter:'{value}%'}},yAxis:{type:'category',data:arr.map(function(x){return x.name;}),axisLabel:{fontSize:10}},series:[{name:'Actual',type:'bar',data:arr.map(function(x){return +x.a.toFixed(1);}),itemStyle:{color:'#2D7FF0'},barWidth:10},{name:'Plan',type:'bar',data:arr.map(function(x){return +x.p.toFixed(1);}),itemStyle:{color:'#C7DDFB'},barWidth:10}]});
    }

    function renderStatusChart(){
      var rows=activeRows(), status=firstRole('status',['status','สถานะ']), cat=status||firstRole('project',['project']);
      if(!cat)return; var arr=aggregate(rows,cat.key,null); var top=Number(state.bi.parameters.topN||10); arr=arr.slice(0,top);
      var c=ec('biStatusChart',{textStyle:commonText(),tooltip:{trigger:'item'},grid:{left:35,right:20,top:18,bottom:42},xAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{interval:0,rotate:25,fontSize:9}},yAxis:{type:'value'},series:[{type:'bar',data:arr.map(function(x){return x[1];}),barMaxWidth:34,itemStyle:{color:function(p){var pal=['#1E9E5A','#2D7FF0','#F59E0B','#DC2626','#7C6BE0','#14B8A6'];return pal[p.dataIndex%pal.length];}}}]});
      var box=document.getElementById('biAttentionPanel'); if(box){var late=rows.filter(function(r){var st=String(status?r[status.key]:'').toLowerCase();return /overdue|late|delay|ล่าช้า|เกิน/.test(st);}).length; var done=rows.filter(function(r){var st=String(status?r[status.key]:'').toLowerCase();return /complete|closed|done|เสร็จ|ปิด/.test(st);}).length; box.innerHTML='<div class="bi-attention-grid"><div class="bi-attention-card"><div class="n">'+rows.length+'</div><div class="l">Items</div></div><div class="bi-attention-card"><div class="n">'+done+'</div><div class="l">Complete</div></div><div class="bi-attention-card"><div class="n">'+late+'</div><div class="l">Attention</div></div><div class="bi-attention-card"><div class="n">'+Math.max(0,rows.length-done-late)+'</div><div class="l">Open</div></div></div>';
      }
    }
    function renderCostChart(){
      var rows=activeRows(), cat=firstRole('customer',['customer','ลูกค้า','หน่วยงาน'])||firstRole('project',['project','โครงการ']), cost=firstRole('cost',['cost','actual cost','value','amount','มูลค่า','ค่าใช้จ่าย']); if(!cat){return;}
      var arr=aggregate(rows,cat.key,cost?cost.key:null), top=Number(state.bi.parameters.topN||10); arr=arr.slice(0,top); ec('biCostChart',{textStyle:commonText(),tooltip:{trigger:'axis',axisPointer:{type:'shadow'},valueFormatter:function(v){return formatCompact(v)}},grid:{left:110,right:20,top:18,bottom:24},xAxis:{type:'value'},yAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{fontSize:9}},series:[{type:'bar',data:arr.map(function(x){return Math.round(x[1]);}),itemStyle:{color:'#14B8A6'},barWidth:15}]});
    }
    function renderTrendChart(){
      var rows=activeRows(), date=firstRole('start',['start','start date','วันที่เริ่ม'])||firstRole('end',['finish','end','date','วันที่']); actual=firstRole('actual',['actual','actual progress','progress','% complete']); if(!date)return; var arr=aggregateDate(rows,date.key,actual?actual.key:null); ec('biTrendChart',{textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:40,right:20,top:18,bottom:45},xAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{rotate:35,fontSize:9}},yAxis:{type:'value'},series:[{name:'Actual',type:'line',smooth:true,showSymbol:true,data:arr.map(function(x){return actual?pct(x[1]):x[1];}),areaStyle:{opacity:.12},lineStyle:{width:3,color:'#1E9E5A'},itemStyle:{color:'#1E9E5A'}}]});
    }

    function buildGantt(){
      var box=document.getElementById('biGantt'); if(!box||!window.Gantt)return;
      var rows=activeRows(), task=firstRole('task',['task name','task','กิจกรรม','งาน']), proj=firstRole('project',['project name','project','โครงการ']), start=firstRole('start',['start','start date','วันที่เริ่ม']), end=firstRole('end',['finish','end','end date','วันที่สิ้นสุด']), actual=firstRole('actual',['actual','actual progress','%complete actual','progress']);
      if(!(start&&end&&(task||proj))){box.innerHTML='<div class="mini" style="padding:20px">Timeline needs Project/Task + Start + End columns.</div>';return;}
      var src=rows.map(function(r,i){var s=dateVal(r[start.key]),e=dateVal(r[end.key]);if(!s||!e)return null;var n=String(r[(task||proj).key]||('Item '+(i+1))).trim();if(!n)n='Item '+(i+1);return {id:'g'+i,name:n.slice(0,90),start:s,end:e,progress:actual?pct(r[actual.key]):0,custom_class:'bi-gantt-bar'};}).filter(Boolean);
      if(!src.length){box.innerHTML='<div class="mini" style="padding:20px">No valid Start/End data.</div>';return;}
      box.innerHTML=''; try{ if(gantt&&gantt.destroy)gantt.destroy(); }catch(_){ }
      gantt=new Gantt('#biGantt',src,{view_mode:'Year',today_button:true,readonly:true,bar_height:22,bar_corner_radius:5,arrow_curve:5,padding:18,custom_popup_html:function(t){return '<div style="padding:8px 10px;font:12px Arial"><b>'+esc(t.name)+'</b><br>Start: '+esc(t.start) +'<br>End: '+esc(t.end)+'<br>Progress: '+t.progress+'%</div>';}});
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
      if(bcat){var arr=aggregate(rows,bcat.key,num?num.key:null).slice(0,Number(state.bi.parameters.topN||10));if(document.getElementById('barChart_echarts')){destroyE('barChart_echarts');eCharts['barChart_echarts']=echarts.init(document.getElementById('barChart_echarts'));eCharts['barChart_echarts'].setOption({textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:90,right:20,top:15,bottom:35},xAxis:{type:'category',data:arr.map(function(x){return x[0];}),axisLabel:{rotate:25,fontSize:9}},yAxis:{type:'value'},series:[{type:'bar',data:arr.map(function(x){return x[1]}),itemStyle:{color:'#1E9E5A'}}]});eCharts['barChart_echarts'].on('click',function(p){A.setDrill(bcat.key,p.name);});}}
      var dcol=firstRole('start',['start','start date'])||firstRole('end',['finish','end','date']); if(dcol){var ar=aggregateDate(rows,dcol.key,num?num.key:null); if(document.getElementById('lineChart_echarts')){destroyE('lineChart_echarts');eCharts['lineChart_echarts']=echarts.init(document.getElementById('lineChart_echarts'));eCharts['lineChart_echarts'].setOption({textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:38,right:20,top:15,bottom:40},xAxis:{type:'category',data:ar.map(function(x){return x[0]}),axisLabel:{rotate:30,fontSize:9}},yAxis:{type:'value'},series:[{type:'line',smooth:true,data:ar.map(function(x){return x[1]}),areaStyle:{opacity:.14},lineStyle:{color:'#2D7FF0',width:3},itemStyle:{color:'#2D7FF0'}}]});}}
      if(bcat){var pr=aggregate(rows,bcat.key,null).slice(0,Number(state.bi.parameters.topN||10)); if(document.getElementById('pieChart_echarts')){destroyE('pieChart_echarts');eCharts['pieChart_echarts']=echarts.init(document.getElementById('pieChart_echarts'));eCharts['pieChart_echarts'].setOption({textStyle:commonText(),tooltip:{trigger:'item'},legend:{type:'scroll',bottom:0,left:'center'},series:[{type:'pie',radius:['45%','72%'],avoidLabelOverlap:true,data:pr.map(function(x){return {name:x[0],value:x[1]}}),label:{fontSize:9}}]});eCharts['pieChart_echarts'].on('click',function(p){A.setDrill(bcat.key,p.name);});}}
    }

    function enhanceHeader(){
      var left=document.querySelector('.dashboard-command-left'); if(left)left.classList.add('bi-centered-title');
      var title=document.getElementById('dashboardReportTitle'); if(title) title.style.textAlign='center';
      var meta=document.getElementById('dashboardReportMeta'); if(meta)meta.style.textAlign='center';
    }

    function patchRender(){
      var old=A.renderDashboard; if(!old||old.__bi21)return; function wrapped(){old.apply(null,arguments); requestAnimationFrame(function(){setTimeout(function(){try{state=A.getState();if(!state)return;renderPro();renderMainECharts();enhanceHeader();}catch(e){console.warn('BI render skipped',e);}},30);});} wrapped.__bi21=true; A.renderDashboard=wrapped;
      var oldC=A.renderCustomView;if(oldC&&!oldC.__bi21){function wc(){oldC.apply(null,arguments); requestAnimationFrame(function(){setTimeout(function(){try{state=A.getState();if(!state)return;bindCustomProWidgets();}catch(e){console.warn('Custom BI render skipped',e);}},80);});} wc.__bi21=true;A.renderCustomView=wc;}
    }

    function bindCustomProWidgets(){
      if(!window.echarts)return;
      document.querySelectorAll('#customView .widget-body').forEach(function(body){
        var item=body.closest('.grid-stack-item'); if(!item)return; var wid=item.getAttribute('gs-id')||item.id; var w=(state.customWidgets||[]).find(function(x){return x.id===wid;}); if(!w||!w.config||w.config.engine!=='echarts')return;
        if(body.__biMounted)return; body.__biMounted=true; body.innerHTML=''; var id='biCustom_'+String(w.id).replace(/[^a-zA-Z0-9_-]/g,'_'); var div=document.createElement('div');div.id=id;div.style.width='100%';div.style.height='100%';body.appendChild(div);
        var cat=colByKey(w.config.catColKey)||firstRole('project',['project']);var num=colByKey(w.config.numColKey)||firstRole('actual',['actual','progress']);if(!cat)return;var arr=aggregate(activeRows(),cat.key,num?num.key:null).slice(0,Number(state.bi.parameters.topN||10));var ch=echarts.init(div);eCharts[id]=ch;var typ=w.config.chartType||'bar';var opt={textStyle:commonText(),tooltip:{trigger:'axis'},grid:{left:75,right:15,top:15,bottom:35},xAxis:{type:'category',data:arr.map(function(x){return x[0]}),axisLabel:{fontSize:9,rotate:25}},yAxis:{type:'value'},series:[{type:typ==='line'?'line':'bar',data:arr.map(function(x){return x[1]}),smooth:true,itemStyle:{color:'#1E9E5A'},areaStyle:typ==='line'?{opacity:.12}:undefined}]};ch.setOption(opt);ch.on('click',function(p){A.setDrill(cat.key,p.name);});
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
        if(!s||!s.rows||!s.rows.length){ if(window.__tanotOpenQuickStart) window.__tanotOpenQuickStart(); return false; }
        A.setView('custom');
        setTimeout(function(){ try{ addProVisualToCustom(kind||'bar'); }catch(err){ console.error('[BI] add visual failed',err); if(window.showBIToast) window.showBIToast('Unable to add this visual.','error'); } },120);
        return true;
      } catch(err){ console.error('[BI] add visual hook failed',err); return false; }
    };

    function installCommandPalette(){
      if(document.getElementById('biCommandPalette'))return;
      var wrap=document.createElement('div');wrap.id='biCommandPalette';wrap.className='bi-command';wrap.innerHTML='<div class="bi-command-box" role="dialog" aria-modal="true"><div class="bi-command-head"><strong>Command Palette</strong><button type="button" class="bi-command-close" aria-label="Close">×</button></div><input id="biCommandInput" class="bi-command-input" placeholder="Search commands…"><div id="biCommandList" class="bi-command-list"></div><div class="bi-command-foot"><button type="button" class="bi-command-cancel">Cancel</button></div></div>';document.body.appendChild(wrap);
      var actions=[
        ['📊','Open Dashboard',function(){A.setView('dashboard');close();}],
        ['🧩','Open Custom',function(){A.setView('custom');close();}],
        ['➕','Add ECharts Bar',function(){var s=A.getState();if(!s.rows||!s.rows.length){if(window.__tanotOpenQuickStart)window.__tanotOpenQuickStart();close();return;}if(window.__tanotAddProVisualToCustom)window.__tanotAddProVisualToCustom('bar');else{A.setView('custom');setTimeout(function(){addProVisualToCustom('bar');},120);}close();}],
        ['📈','Add ECharts Line',function(){var s=A.getState();if(!s.rows||!s.rows.length){if(window.__tanotOpenQuickStart)window.__tanotOpenQuickStart();close();return;}if(window.__tanotAddProVisualToCustom)window.__tanotAddProVisualToCustom('line');else{A.setView('custom');setTimeout(function(){addProVisualToCustom('line');},120);}close();}],
        ['🗓️','Add Project Gantt',function(){var s=A.getState();if(!s.rows||!s.rows.length){if(window.__tanotOpenQuickStart)window.__tanotOpenQuickStart();close();return;}if(window.__tanotAddProVisualToCustom)window.__tanotAddProVisualToCustom('gantt');else{A.setView('custom');setTimeout(function(){addProVisualToCustom('gantt');},120);}close();}],
        ['🧠','BI Studio',function(){A.openBIModal('model');close();}],
        ['❔','Quick Start',function(){if(window.__tanotOpenQuickStart)window.__tanotOpenQuickStart();close();}],
        ['⛶','Fullscreen Dashboard',function(){var b=document.getElementById('dashboardFullBtn');if(b)b.click();close();}]
      ];
      function renderList(q){var list=document.getElementById('biCommandList');var z=norm(q||'');list.innerHTML=actions.filter(function(a){return !z||norm(a[1]).indexOf(z)>=0;}).map(function(a,i){return '<div class="bi-command-item" data-i="'+i+'"><span>'+a[0]+'</span><span>'+esc(a[1])+'</span></div>';}).join('');[].forEach.call(list.querySelectorAll('.bi-command-item'),function(x){x.onclick=function(){var a=actions.filter(function(a){return !z||norm(a[1]).indexOf(z)>=0;})[+x.dataset.i];if(a)a[2]();};});}
      function open(){wrap.classList.add('open');var inp=document.getElementById('biCommandInput');if(inp){inp.value='';renderList('');setTimeout(function(){inp.focus();},10);}}
      function close(){wrap.classList.remove('open');}
      document.getElementById('biCommandInput').addEventListener('input',function(){renderList(this.value);});wrap.querySelector('.bi-command-close').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();close();});wrap.querySelector('.bi-command-cancel').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();close();});wrap.querySelector('.bi-command-box').addEventListener('click',function(e){e.stopPropagation();});wrap.addEventListener('click',function(e){if(e.target===wrap)close();});document.addEventListener('keydown',function(e){if(e.key==='Escape' && wrap.classList.contains('open')){e.preventDefault();close();}});window.__tanotCommandPalette={open:open,close:close};
    }

    function addToolsToCustomMenu(){
      var panel=document.getElementById('customToolsPanel'); if(!panel||panel.querySelector('[data-custom-pro]'))return;
      var sec=panel.querySelector('.utility-menu-section'); if(!sec)return; var b=document.createElement('button');b.className='utility-menu-item';b.dataset.customPro='1';b.textContent='⚡ BI Visuals';b.onclick=function(){openProVisualPicker();};sec.appendChild(b);
    }
    function openProVisualPicker(){
      var old=document.getElementById('biProVisualModal'); if(old)old.remove(); var h=document.createElement('div');h.id='biProVisualModal';h.className='bi-command open';h.innerHTML='<div class="bi-command-box"><div style="padding:16px 18px;border-bottom:1px solid var(--line);font-weight:800">BI Visual Library</div><div class="bi-command-list"><div class="bi-command-item" data-v="bar">📊 ECharts Bar / Stacked</div><div class="bi-command-item" data-v="line">📈 ECharts Line / Area</div><div class="bi-command-item" data-v="gantt">🗓️ Project Gantt / Timeline</div><div class="bi-command-item" data-v="scatter">🔵 Scatter / Bubble</div><div class="bi-command-item" data-v="heat">🔥 Heatmap</div><div class="bi-command-item" data-v="pareto">📉 Pareto</div></div></div>';document.body.appendChild(h);[].forEach.call(h.querySelectorAll('[data-v]'),function(x){x.onclick=function(){var k=x.dataset.v==='gantt'?'gantt':(x.dataset.v==='line'?'line':'bar');if(window.__tanotAddProVisualToCustom)window.__tanotAddProVisualToCustom(k);else{A.setView('custom');setTimeout(function(){addProVisualToCustom(k);},120);}h.remove();};});h.addEventListener('click',function(e){if(e.target===h)h.remove();});
    }

    function installDesignDrawer(){
      if(document.getElementById('biDesignDrawer'))return;
      var bd=document.createElement('div');bd.id='biDesignBackdrop';bd.className='bi-drawer-backdrop';var dr=document.createElement('aside');dr.id='biDesignDrawer';dr.className='bi-drawer';dr.innerHTML='<div class="bi-drawer-head"><strong>Dashboard Design</strong><button class="bi-drawer-close">×</button></div><div class="bi-drawer-body"><div class="bi-drawer-sec"><h4>Visuals</h4><div class="bi-drawer-grid"><div class="bi-drawer-item">Engine <select id="drawerEngine"><option value="echarts">ECharts</option><option value="chartjs">Chart.js</option></select></div><div class="bi-drawer-item">Top N <select id="drawerTop"><option>5</option><option selected>10</option><option>20</option><option>50</option></select></div></div></div><div class="bi-drawer-sec"><h4>Density</h4><div class="bi-drawer-grid"><div class="bi-drawer-item" data-density="comfortable">Comfortable</div><div class="bi-drawer-item" data-density="compact">Compact</div><div class="bi-drawer-item" data-density="dense">Dense</div></div></div><div class="bi-drawer-sec"><h4>Quick actions</h4><div class="bi-drawer-grid"><div class="bi-drawer-item" id="drawerBI">BI Studio</div><div class="bi-drawer-item" id="drawerCmd">Command Palette</div></div></div></div>';document.body.appendChild(bd);document.body.appendChild(dr);function open(){bd.classList.add('open');dr.classList.add('open');}function close(){bd.classList.remove('open');dr.classList.remove('open');}bd.onclick=close;dr.querySelector('.bi-drawer-close').onclick=close;dr.querySelector('#drawerBI').onclick=function(){A.openBIModal('model');};dr.querySelector('#drawerCmd').onclick=function(){window.__tanotCommandPalette&&window.__tanotCommandPalette.open();};[].forEach.call(dr.querySelectorAll('[data-density]'),function(x){x.onclick=function(){var sel=document.getElementById('dashboardDensitySel');if(sel){sel.value=x.dataset.density;sel.dispatchEvent(new Event('change',{bubbles:true}));}close();};});dr.querySelector('#drawerEngine').onchange=function(){state.bi.parameters.chartEngine=this.value;A.persist();A.renderDashboard();};dr.querySelector('#drawerTop').onchange=function(){state.bi.parameters.topN=+this.value;var s=document.getElementById('dashboardRankingSel');if(s){s.value='top10';}A.persist();A.renderDashboard();};window.__tanotDesignDrawer={open:open,close:close};
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

    function renderAdvancedAnalytics(){
      var card=document.getElementById('advancedAnalyticsCard'); if(!card||card.style.display==='none') return;
      var A=window.TanotDashboard, st=A&&A.getState?A.getState():null; if(!st) return;
      st.bi=st.bi||{}; st.bi.model=st.bi.model||{roles:{}}; st.bi.model.roles=st.bi.model.roles||{};
      var roles=st.bi.model.roles;
      function find(k,words,types){ if(roles[k]){var z=st.columns.find(function(c){return c.key===roles[k];});if(z)return z;}return st.columns.find(function(c){var n=String(c.label||'').toLowerCase();return (!types||types.indexOf(c.type)>=0)&&words.some(function(w){return n.indexOf(w)>=0;});})||null; }
      var eq=find('equipment',['equipment','asset','เครื่องจักร','อุปกรณ์'],['category','text']);
      var task=find('task',['task','work','กิจกรรม','งาน'],['category','text'])||find('project',['project','โครงการ'],['category','text']);
      var actual=find('actual',['actual','progress','complete','ความคืบหน้า'],['number'])||st.columns.find(function(c){return c.type==='number';});
      var eqSel=document.getElementById('enterpriseEquipmentSel');
      if(eqSel){var vals=[],seen={};if(eq)st.rows.forEach(function(r){var v=String(r[eq.key]==null?'':r[eq.key]);if(v&&!seen[v]){seen[v]=1;vals.push(v);}});var old=eqSel.value;eqSel.innerHTML='<option value="">All equipment</option>'+vals.sort().map(function(v){return '<option value="'+String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')+'">'+String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</option>';}).join('');if(vals.indexOf(old)>=0)eqSel.value=old;}
      var rows=st.rows.slice(), eqVal=eqSel&&eqSel.value; if(eqVal&&eq)rows=rows.filter(function(r){return String(r[eq.key]==null?'':r[eq.key])===eqVal;});
      var groups={};rows.forEach(function(r){var label=task?String(r[task.key]==null?'':r[task.key]):'Record';if(!groups[label])groups[label]={label:label,count:0,value:0};groups[label].count++;var v=actual?Number(r[actual.key]):1;if(isFinite(v))groups[label].value+=v;});
      var arr=Object.keys(groups).map(function(k){return groups[k];}),mode=(document.getElementById('enterpriseAnalysisSel')||{}).value||'pareto';
      if(mode==='repeat')arr.sort(function(a,b){return b.count-a.count;});else arr.sort(function(a,b){return b.value-a.value;});arr=arr.slice(0,20);
      if(mode==='anomaly'){var mean=arr.length?arr.reduce(function(s,g){return s+g.value;},0)/arr.length:0;var sd=Math.sqrt(arr.reduce(function(s,g){return s+(g.value-mean)*(g.value-mean);},0)/(arr.length||1))||1;arr.forEach(function(g){g.score=Math.abs((g.value-mean)/sd);});arr.sort(function(a,b){return b.score-a.score;});}
      document.getElementById('enterpriseChartATitle').textContent=mode==='repeat'?'Repeat Failure / Task Frequency':mode==='anomaly'?'Anomaly Score':mode==='forecast'?'Forecast / Trend':'Pareto / Failure Analysis';
      document.getElementById('enterpriseChartBTitle').textContent='Top Contributors';
      document.getElementById('enterpriseAnalysisNote').textContent=mode==='repeat'?'นับความถี่ของงาน/Task ที่เกิดซ้ำ':mode==='anomaly'?'คะแนนสูง = เบี่ยงเบนจากค่าเฉลี่ยมาก':'เรียงผู้มีส่วนร่วมจากมากไปน้อย';
      var mini=document.getElementById('enterpriseMiniGrid');if(mini)mini.innerHTML='<div><b>'+rows.length.toLocaleString()+'</b><span>records</span></div><div><b>'+String(eq?eq.label:'Equipment')+'</b><span>'+String(eqVal||'All')+'</span></div>';
      if(!window.Chart)return;window.__f27ea=window.__f27ea||{};try{if(window.__f27ea.a)window.__f27ea.a.destroy();if(window.__f27ea.b)window.__f27ea.b.destroy();}catch(e){}
      var va=arr.map(function(g){return mode==='repeat'?g.count:mode==='anomaly'?g.score:g.value;});
      window.__f27ea.a=new Chart(document.getElementById('enterpriseChartA').getContext('2d'),{type:'bar',data:{labels:arr.map(function(g){return g.label;}),datasets:[{data:va,backgroundColor:'#2563EB',borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
      window.__f27ea.b=new Chart(document.getElementById('enterpriseChartB').getContext('2d'),{type:'bar',data:{labels:arr.slice(0,10).map(function(g){return g.label;}),datasets:[{data:arr.slice(0,10).map(function(g){return g.value;}),backgroundColor:'#16A34A',borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});
    }
    function wireAdvancedAnalytics(){
      var b=document.getElementById('advancedAnalyticsBtn'); if(b&&!b.__f27){b.__f27=true;b.addEventListener('click',function(){var c=document.getElementById('advancedAnalyticsCard');if(c){c.style.display=c.style.display==='none'?'block':'none';if(c.style.display!=='none')renderAdvancedAnalytics();}});}
      ['enterpriseEquipmentSel','enterpriseAnalysisSel'].forEach(function(id){var e=document.getElementById(id);if(e&&!e.__f27){e.__f27=true;e.addEventListener('change',renderAdvancedAnalytics);}});
    }
    function boot(){
      patchRender();installCommandPalette();bindCommandButtons();installDesignDrawer();addToolsToCustomMenu();wireAdvancedAnalytics();
      var en=document.getElementById('biEngineSel'),top=document.getElementById('biTopNSel');if(en){en.value=state.bi.parameters.chartEngine||'echarts';en.onchange=function(){state.bi.parameters.chartEngine=this.value;A.persist();A.renderDashboard();};}if(top){top.value=String(state.bi.parameters.topN||10);top.onchange=function(){state.bi.parameters.topN=+this.value||10;A.persist();A.renderDashboard();};}
      if(A.getCurrentView&&A.getCurrentView()==='dashboard')setTimeout(function(){renderPro();renderMainECharts();},100);
      window.addEventListener('resize',function(){Object.keys(eCharts).forEach(function(k){try{eCharts[k].resize();}catch(_){}});});
    }
    boot();
  });
})();
