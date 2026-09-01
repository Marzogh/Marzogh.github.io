import {
  ADIF_VERSION,
  applyExportPreset,
  dedupeRecords,
  detectDuplicateRecords,
  formatUtcTime,
  makeCreatedTimestamp,
  makeDownload,
  mergeParsedFiles,
  normaliseQso,
  parseAdi,
  serialiseAdi,
  serialiseCsv,
  serialiseJson,
  setField,
  validateParsedAdi,
} from '/scripts/adif-core.js';
import {createAdifSvgMap} from '/scripts/adif-svg-map.js';

const BAND_ORDER = ['2190m','630m','160m','80m','60m','40m','30m','20m','17m','15m','12m','10m','8m','6m','4m','2m','1.25m','70cm','33cm','23cm','13cm','9cm','6cm','3cm'];
const PAGE_SIZE = 100;
const safeUpper = (value) => String(value || '').trim().toUpperCase();
const safeLower = (value) => String(value || '').trim().toLowerCase();
const pad2 = (value) => String(value).padStart(2, '0');

const PREFIX_CENTROIDS = [
  [/^VK1/i,[-35.3,149.1,'VK1 / ACT']], [/^VK2/i,[-32.2,147,'VK2 / NSW']], [/^VK3/i,[-36.8,144.4,'VK3 / Victoria']],
  [/^VK4/i,[-22.8,144.4,'VK4 / Queensland']], [/^VK5/i,[-32.1,135.7,'VK5 / South Australia']], [/^VK6/i,[-25.6,122.3,'VK6 / Western Australia']],
  [/^VK7/i,[-42,146.7,'VK7 / Tasmania']], [/^VK8/i,[-19.5,133.4,'VK8 / Northern Territory']], [/^ZL/i,[-41.2,174.7,'ZL / New Zealand']],
  [/^JA/i,[36.2,138.3,'JA / Japan']], [/^(?:F|TM|TK)/i,[46.4,2.4,'France']], [/^(?:G|M|2E)/i,[54,-2.8,'United Kingdom']],
  [/^DL/i,[51,10.4,'Germany']], [/^(?:K|N|W)[0-9]/i,[39.8,-98.6,'United States']], [/^VE/i,[56.1,-106.3,'Canada']],
];
const REGION_CENTROIDS = { AU:[-25.3,133.8,'Australia'], VK:[-25.3,133.8,'Australia'], VKFF:[-25.3,133.8,'Australia'], ZL:[-41.2,174.7,'New Zealand'], JA:[36.2,138.3,'Japan'], F:[46.4,2.4,'France'], G:[54,-2.8,'United Kingdom'], K:[39.8,-98.6,'United States'], W:[39.8,-98.6,'United States'], VE:[56.1,-106.3,'Canada'] };

function compareBands(a,b){
  const ai=BAND_ORDER.indexOf(a), bi=BAND_ORDER.indexOf(b);
  if(ai!==-1||bi!==-1){ if(ai===-1)return 1;if(bi===-1)return-1;return ai-bi; }
  return a.localeCompare(b,undefined,{numeric:true});
}
function formatDuration(ms){
  const seconds=Math.max(0,Math.round(ms/1000)), hours=Math.floor(seconds/3600), minutes=Math.floor(seconds%3600/60);
  if(hours>=24)return `${Math.floor(hours/24)}d ${hours%24}h`;
  if(hours)return `${hours}h ${pad2(minutes)}m`;
  return `${minutes}m`;
}
function dateInputValue(date){ return date ? `${date.getUTCFullYear()}-${pad2(date.getUTCMonth()+1)}-${pad2(date.getUTCDate())}` : ''; }
function countBy(rows,key){ const map=new Map(); rows.forEach(row=>{const value=String(row[key]||'').trim();if(value)map.set(value,(map.get(value)||0)+1)});return map; }
function cell(text){ const td=document.createElement('td');td.textContent=text||'—';return td; }
function escapeXml(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function getField(record,...names){const fields=record?.fields||{};for(const name of names){const value=fields[safeUpper(name)]?.value;if(value)return String(value).trim();}return '';}

async function parseFiles(files){
  const texts=await Promise.all(files.map(async(file)=>({file,text:await file.text()})));
  const parsed=texts.map(({file,text},index)=>{const item=parseAdi(text);item.source={name:file.name,size:file.size,index};return item;});
  const merged=mergeParsedFiles(parsed);merged.sources=parsed.map(item=>{const metadata=Object.fromEntries((item.header?.fields||[]).map(field=>[field.normalisedName,field.value]));return {...item.source,records:item.records.length,adifVersion:metadata.ADIF_VER||'',program:metadata.PROGRAMID||'',programVersion:metadata.PROGRAMVERSION||''};});return merged;
}

function normalisedRows(bundle){
  return bundle.records.map((record,index)=>({...normaliseQso(record),index,id:`${record._source?.index??-1}:${record._source?.recordIndex??index}:${index}`}))
    .filter(row=>row.call||row.dt||row.dateRaw)
    .sort((a,b)=>(a.dt?.getTime()??Infinity)-(b.dt?.getTime()??Infinity));
}

function drawRateChart(canvas,rows){
  const context=canvas?.getContext('2d');if(!context)return {peak:0,average:0,label:'No usable timing data'};
  const dated=rows.filter(row=>row.dt);if(!dated.length){context.clearRect(0,0,canvas.width,canvas.height);return {peak:0,average:0,label:'No usable timing data'};}
  const start=dated[0].dt.getTime(),end=dated[dated.length-1].dt.getTime(),span=Math.max(1,end-start);
  const binMs=span>172800000?3600000:span>36000000?900000:span>10800000?300000:60000;
  const binCount=Math.max(1,Math.ceil((end-start+1)/binMs)),bins=new Array(binCount).fill(0);
  dated.forEach(row=>{bins[Math.min(binCount-1,Math.floor((row.dt.getTime()-start)/binMs))]+=1;});
  const ratio=window.devicePixelRatio||1,width=canvas.clientWidth||1000,height=Math.min(320,Math.max(220,width*.3));canvas.width=width*ratio;canvas.height=height*ratio;context.setTransform(ratio,0,0,ratio,0,0);
  const colour=getComputedStyle(canvas).color||'#222',accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#a64b34';context.clearRect(0,0,width,height);
  const pad={t:20,r:18,b:34,l:34},gw=width-pad.l-pad.r,gh=height-pad.t-pad.b,max=Math.max(1,...bins);
  context.strokeStyle=`color-mix(in srgb, ${colour} 16%, transparent)`;context.globalAlpha=.15;for(let i=0;i<5;i++){const y=pad.t+gh*i/4;context.beginPath();context.moveTo(pad.l,y);context.lineTo(pad.l+gw,y);context.stroke();}context.globalAlpha=1;
  const bw=gw/bins.length;context.fillStyle=accent;bins.forEach((value,index)=>{const bh=value/max*gh;context.fillRect(pad.l+index*bw+1,pad.t+gh-bh,Math.max(1,bw-2),bh)});
  context.fillStyle=colour;context.font='12px ui-monospace, monospace';const step=Math.max(1,Math.ceil(bins.length/6));bins.forEach((_,index)=>{if(index%step)return;const stamp=new Date(start+index*binMs);context.fillText(`${pad2(stamp.getUTCHours())}:${pad2(stamp.getUTCMinutes())}`,pad.l+index*bw,height-10)});
  return {peak:max,average:rows.length/binCount,label:binMs===3600000?'hour':binMs===900000?'15 minutes':binMs===300000?'5 minutes':'minute'};
}

function renderBars(target,counts,total,sort){
  if(!target)return;target.innerHTML='';const entries=[...counts.entries()].sort(sort);const max=Math.max(1,...entries.map(([,count])=>count));
  if(!entries.length){target.textContent='No data recorded.';return;}
  entries.forEach(([label,count])=>{const row=document.createElement('div');row.className='adifBar';row.innerHTML=`<span>${escapeXml(label)}</span><i style="transform:scaleX(${count/max})"></i><b>${count}</b>`;row.title=`${Math.round(count/Math.max(1,total)*100)}%`;target.appendChild(row)});
}

function groupSessions(rows,gapMinutes){
  const buckets=new Map();
  rows.filter(row=>row.dt).forEach(row=>{const date=dateInputValue(row.dt),place=row.myRef||row.myGrid||'unlocated',station=row.station||row.operator||'station not recorded',key=`${date}|${station}|${place}`;const bucket=buckets.get(key)||[];bucket.push(row);buckets.set(key,bucket)});
  const sessions=[];const threshold=gapMinutes*60000;
  buckets.forEach((bucket,key)=>{bucket.sort((a,b)=>a.dt-b.dt);let current=[];bucket.forEach(row=>{if(current.length&&row.dt-current.at(-1).dt>threshold){sessions.push(makeSession(key,current,sessions.length));current=[];}current.push(row)});if(current.length)sessions.push(makeSession(key,current,sessions.length));});
  return sessions.sort((a,b)=>a.start-b.start);
}
function makeSession(key,rows,index){const [date,station,place]=key.split('|');return {id:`session-${index}`,date,station,place,rows,start:rows[0].dt,end:rows.at(-1).dt,bands:[...new Set(rows.map(row=>row.band).filter(Boolean))].sort(compareBands)};}

function maidenheadToLatLon(grid){
  const clean=safeUpper(grid).replace(/[^A-Z0-9]/g,'');if(!/^[A-R]{2}\d{2}([A-X]{2})?([0-9]{2})?$/.test(clean))return null;
  let lon=-180+(clean.charCodeAt(0)-65)*20+Number(clean[2])*2,lat=-90+(clean.charCodeAt(1)-65)*10+Number(clean[3]),lonSize=2,latSize=1;
  if(clean.length>=6){lon+=(clean.charCodeAt(4)-65)*5/60;lat+=(clean.charCodeAt(5)-65)*2.5/60;lonSize=5/60;latSize=2.5/60;}
  if(clean.length>=8){lon+=Number(clean[6])*.5/60;lat+=Number(clean[7])*.25/60;lonSize=.5/60;latSize=.25/60;}
  return {lat:lat+latSize/2,lon:lon+lonSize/2};
}
function parseCoordinate(value){const clean=String(value??'').trim();if(!clean)return null;const number=Number(clean);return Number.isFinite(number)?number:null;}
function resolveReference(ref){const upper=safeUpper(ref),match=upper.match(/^([A-Z0-9/]+)-\d+$/),prefix=match?.[1]||'';for(const key of [prefix,prefix.split('/')[0],prefix.match(/^(VK[1-8])/i)?.[1]].filter(Boolean)){if(REGION_CENTROIDS[key])return REGION_CENTROIDS[key];}return null;}
function resolveMapPoint(row){
  const lat=parseCoordinate(getField(row.record,'LAT')),lon=parseCoordinate(getField(row.record,'LON'));if(lat!==null&&lon!==null)return {lat,lon,source:'coordinates',confidence:'high',clue:`${lat}, ${lon}`};
  const grid=maidenheadToLatLon(row.grid);if(grid)return {...grid,source:'grid square',confidence:'high',clue:row.grid};
  const ref=resolveReference(row.ref);if(ref)return {lat:ref[0],lon:ref[1],source:'reference region',confidence:'medium',clue:row.ref};
  for(const [pattern,point] of PREFIX_CENTROIDS){if(pattern.test(row.call))return {lat:point[0],lon:point[1],source:'callsign region',confidence:'low',clue:point[2]};}
  return null;
}
function resolveOrigin(row){
  const lat=parseCoordinate(getField(row.record,'MY_LAT','STATION_LAT')),lon=parseCoordinate(getField(row.record,'MY_LON','STATION_LON'));if(lat!==null&&lon!==null)return {lat,lon,clue:'station coordinates'};
  const grid=maidenheadToLatLon(row.myGrid);if(grid)return {...grid,clue:row.myGrid};
  const ref=resolveReference(row.myRef);return ref?{lat:ref[0],lon:ref[1],clue:ref[2],confidence:'medium'}:null;
}
function greatCircleKm(a,b){const radians=(degrees)=>degrees*Math.PI/180,R=6371,dLat=radians(b.lat-a.lat),dLon=radians(b.lon-a.lon),lat1=radians(a.lat),lat2=radians(b.lat);const value=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(value));}
function distanceForRow(row){const destination=maidenheadToLatLon(row.grid),origin=maidenheadToLatLon(row.myGrid);return destination&&origin?greatCircleKm(origin,destination):null;}
function peakWindow(rows,minutes){const times=rows.filter(row=>row.dt).map(row=>row.dt.getTime()).sort((a,b)=>a-b),windowMs=minutes*60000;let best=0,left=0;for(let right=0;right<times.length;right+=1){while(times[right]-times[left]>=windowMs)left+=1;best=Math.max(best,right-left+1);}return best;}
function reconciliationKey(row,includeTime=true){const minute=row.dt?Math.round(row.dt.getTime()/60000):row.timeRaw;return [row.call,row.dateRaw,includeTime?minute:'',row.band,row.mode].join('|');}
function makeKml(points){return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Filtered ADIF contacts</name>${points.map(point=>`<Placemark><name>${escapeXml(point.row.call||'QSO')}</name><description>${escapeXml(`${point.row.band} ${point.row.mode} · ${point.source} · ${point.confidence}`)}</description><Point><coordinates>${point.lon},${point.lat},0</coordinates></Point></Placemark>`).join('')}</Document></kml>`;}

function initialiseTool(root){
  const q=(selector)=>root.querySelector(selector),qa=(selector)=>[...root.querySelectorAll(selector)];
  const elements={input:q('[data-adif-input]'),dropzone:q('[data-adif-dropzone]'),status:q('[data-adif-status]'),filePills:q('[data-adif-files]'),empty:q('[data-adif-empty]'),results:q('[data-adif-results]'),manualForm:q('[data-adif-manual-form]'),manualStatus:q('[data-adif-manual-status]'),summaryNote:q('[data-adif-summary-note]'),fileSummary:q('[data-adif-file-summary]'),issueGrid:q('[data-adif-issue-grid]'),duplicatesSection:q('[data-adif-duplicates-section]'),duplicateGroups:q('[data-adif-duplicate-groups]'),chart:q('[data-adif-chart]'),rateMeta:q('[data-adif-rate-meta]'),operatingStats:q('[data-adif-operating-stats]'),bandBars:q('[data-adif-band-bars]'),modeBars:q('[data-adif-mode-bars]'),satelliteSummary:q('[data-adif-satellite-summary]'),satelliteBars:q('[data-adif-satellite-bars]'),sessionGrid:q('[data-adif-session-grid]'),sessionGap:q('[data-adif-session-gap]'),search:q('[data-adif-filter]'),dateFrom:q('[data-adif-date-from]'),dateTo:q('[data-adif-date-to]'),filterPills:q('[data-adif-filter-pills]'),filterCount:q('[data-adif-filter-count]'),selectedCount:q('[data-adif-selected-count]'),bulkField:q('[data-adif-bulk-field]'),bulkValue:q('[data-adif-bulk-value]'),bulkApply:q('[data-adif-bulk-apply]'),table:q('[data-adif-qso-table]'),selectPage:q('[data-adif-select-page]'),pageMeta:q('[data-adif-page-meta]'),prev:q('[data-adif-page-prev]'),next:q('[data-adif-page-next]'),editor:q('[data-adif-editor]'),editorForm:q('[data-adif-editor-form]'),mapHost:q('[data-adif-map-host]'),mapMeta:q('[data-adif-map-meta]'),mapStatus:q('[data-adif-map-status]'),mapKml:q('[data-adif-map-kml]'),mapPng:q('[data-adif-map-png]'),mapPngScale:q('[data-adif-map-png-scale]'),mapLegend:q('[data-adif-map-legend]'),mapFullscreen:q('[data-adif-map-fullscreen]'),mapTraceMaster:q('[data-adif-map-traces]'),mapTraceOpacity:q('[data-adif-map-opacity]'),mapTraceOpacityValue:q('[data-adif-map-opacity-value]'),mapStations:q('[data-adif-map-stations]'),mapZoomIn:q('[data-adif-map-zoom-in]'),mapZoomOut:q('[data-adif-map-zoom-out]'),mapFit:q('[data-adif-map-fit]'),mapWorld:q('[data-adif-map-world]'),reconciliation:q('[data-adif-reconciliation]'),reconcileA:q('[data-adif-reconcile-a]'),reconcileB:q('[data-adif-reconcile-b]'),reconcileStats:q('[data-adif-reconcile-stats]'),exportScope:q('[data-adif-export-scope]'),exportPreset:q('[data-adif-export-preset]'),exportFilename:q('[data-adif-export-filename]'),exportStation:q('[data-adif-export-station]'),exportOperator:q('[data-adif-export-operator]'),exportMyRef:q('[data-adif-export-my-ref]'),exportContactRef:q('[data-adif-export-contact-ref]'),exportOverwrite:q('[data-adif-export-overwrite]'),dedupeMode:q('[data-adif-dedupe-mode]'),exportStatus:q('[data-adif-export-status]')};
  elements.mapBasemap=q('[data-adif-map-basemap]');
  const state={bundle:null,rows:[],filtered:[],files:[],warnings:[],duplicates:{groups:[],duplicateIndexes:new Set(),duplicateCount:0,duplicateGroupCount:0},duplicateDecisions:new Map(),selected:new Set(),facets:{band:new Set(),mode:new Set(),source:new Set(),propagation:new Set(),station:new Set(),satellite:new Set()},issue:'',session:'',sessions:[],sort:{key:'utc',direction:1},page:1,map:null,mapPoints:[],editingId:''};
  const kpi=(key)=>q(`[data-kpi="${key}"]`);
  const setStatus=(text,error=false)=>{elements.status.textContent=`Status: ${text}`;elements.status.dataset.state=error?'error':'info';};
  const setExportStatus=(text)=>{if(elements.exportStatus)elements.exportStatus.textContent=text;};

  function refreshRows(){
    if(!state.bundle)return;state.rows=normalisedRows(state.bundle);state.warnings=validateParsedAdi(state.bundle);state.duplicates=detectDuplicateRecords(state.bundle.records,{mode:'fuzzy',thresholdMs:90000});
    renderAll();
  }
  function renderAll(){
    elements.results.hidden=!state.rows.length;elements.empty.hidden=Boolean(state.rows.length);if(!state.rows.length)return;
    renderSummary();renderIssues();renderDuplicates();renderSessions();renderReconciliation();buildFacets();applyFilters();
  }
  function renderSummary(){
    const dated=state.rows.filter(row=>row.dt),first=dated[0]?.dt,last=dated.at(-1)?.dt,bands=[...new Set(state.rows.map(row=>row.band).filter(Boolean))].sort(compareBands),modes=[...new Set(state.rows.map(row=>row.mode).filter(Boolean))].sort();
    kpi('total').textContent=state.rows.length;kpi('files').textContent=String(new Set(state.rows.map(row=>row.source)).size);kpi('first').textContent=first?`${dateInputValue(first)} ${formatUtcTime(first)}`:'—';kpi('last').textContent=last?`${dateInputValue(last)} ${formatUtcTime(last)}`:'—';kpi('duration').textContent=first&&last?formatDuration(last-first):'—';kpi('calls').textContent=String(new Set(state.rows.map(row=>row.call).filter(Boolean)).size);kpi('bands').textContent=bands.length?String(bands.length):'—';kpi('modes').textContent=modes.length?String(modes.length):'—';kpi('duplicates').textContent=state.duplicates.duplicateCount?`${state.duplicates.duplicateCount} / ${state.duplicates.duplicateGroupCount} groups`:'None';kpi('warnings').textContent=state.warnings.length?String(state.warnings.length):'None';
    elements.summaryNote.textContent=first&&last?`${dateInputValue(first)} ${formatUtcTime(first)} to ${dateInputValue(last)} ${formatUtcTime(last)} UTC`:'No complete timestamps found.';
    elements.fileSummary.innerHTML='';const bySource=new Map();state.rows.forEach(row=>{const list=bySource.get(row.source)||[];list.push(row);bySource.set(row.source,list)});bySource.forEach((rows,name)=>{const card=document.createElement('article');card.className='adifFileCard';const dates=rows.filter(row=>row.dt),metadata=state.bundle.sources?.find(source=>source.name===name);card.innerHTML=`<strong>${escapeXml(name)}</strong><span>${rows.length} QSOs · ${new Set(rows.map(row=>row.call).filter(Boolean)).size} calls</span><span>${dates.length?`${dateInputValue(dates[0].dt)} to ${dateInputValue(dates.at(-1).dt)}`:'No complete dates'}</span>${metadata?.program?`<span>${escapeXml(metadata.program)}${metadata.programVersion?` ${escapeXml(metadata.programVersion)}`:''}${metadata.adifVersion?` · ADIF ${escapeXml(metadata.adifVersion)}`:''}</span>`:''}`;elements.fileSummary.appendChild(card)});
    const rate=drawRateChart(elements.chart,state.rows);elements.rateMeta.textContent=rate.peak?`Peak ${rate.peak} QSOs per ${rate.label}; ${rate.average.toFixed(1)} average.`:rate.label;renderBars(elements.bandBars,countBy(state.rows,'band'),state.rows.length,(a,b)=>b[1]-a[1]||compareBands(a[0],b[0]));renderBars(elements.modeBars,countBy(state.rows,'mode'),state.rows.length,(a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const gaps=dated.slice(1).map((row,index)=>row.dt-dated[index].dt),longest=gaps.length?Math.max(...gaps):0,bandChanges=state.rows.slice(1).filter((row,index)=>row.band&&state.rows[index].band&&row.band!==state.rows[index].band).length,modeChanges=state.rows.slice(1).filter((row,index)=>row.mode&&state.rows[index].mode&&row.mode!==state.rows[index].mode).length,distances=state.rows.map(distanceForRow).filter(Number.isFinite).sort((a,b)=>a-b);
    elements.operatingStats.innerHTML=`<article><span>Peak 10 min</span><strong>${peakWindow(state.rows,10)} QSOs</strong></article><article><span>Peak 60 min</span><strong>${peakWindow(state.rows,60)} QSOs</strong></article><article><span>Longest gap</span><strong>${longest?formatDuration(longest):'—'}</strong></article><article><span>Band / mode changes</span><strong>${bandChanges} / ${modeChanges}</strong></article><article><span>Median / farthest</span><strong>${distances.length?`${Math.round(distances[Math.floor(distances.length/2)])} / ${Math.round(distances.at(-1))} km`:'—'}</strong></article>`;
    const satelliteCounts=countBy(state.rows.filter(row=>row.propagation==='SAT'||row.satellite),'satellite');elements.satelliteSummary.hidden=!satelliteCounts.size;if(satelliteCounts.size)renderBars(elements.satelliteBars,satelliteCounts,[...satelliteCounts.values()].reduce((a,b)=>a+b,0),(a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  }
  function renderIssues(){
    const groups=new Map();state.warnings.forEach(warning=>{const group=groups.get(warning.code)||[];group.push(warning);groups.set(warning.code,group)});if(state.duplicates.duplicateCount)groups.set('duplicate-qsos',state.duplicates.groups);
    elements.issueGrid.innerHTML='';if(!groups.size){const clean=document.createElement('p');clean.textContent='No validation warnings found.';elements.issueGrid.appendChild(clean);return;}
    groups.forEach((items,code)=>{const button=document.createElement('button');button.type='button';button.className=`adifIssue${state.issue===code?' is-active':''}`;button.dataset.issue=code;button.innerHTML=`<strong>${code==='duplicate-qsos'?state.duplicates.duplicateCount:items.length}</strong><span>${escapeXml(code.replaceAll('-',' '))}</span>`;button.addEventListener('click',()=>{state.issue=state.issue===code?'':code;state.page=1;renderIssues();applyFilters();document.querySelector('#contacts')?.scrollIntoView({behavior:'smooth',block:'start'});});elements.issueGrid.appendChild(button)});
  }
  function renderDuplicates(){
    elements.duplicatesSection.hidden=!state.duplicates.groups.length;elements.duplicateGroups.innerHTML='';state.duplicates.groups.forEach((group,groupIndex)=>{const wrapper=document.createElement('article');wrapper.className='adifDuplicateGroup';const rows=group.indices.map(index=>state.rows.find(row=>row.index===index)).filter(Boolean),decision=state.duplicateDecisions.get(group.key)||'keep-both';wrapper.innerHTML=`<div class="adifDuplicateRows">${rows.map(row=>`<div class="adifDuplicateRecord"><strong>${escapeXml(row.call||'Unknown call')}</strong><span>${escapeXml(row.utc||'No time')} · ${escapeXml(row.band)} · ${escapeXml(row.mode)}</span><span>${escapeXml(row.source)}</span></div>`).join('')}</div><div class="adifDuplicateActions"><span>Group ${groupIndex+1}:</span>${[['keep-both','Keep both'],['keep-first','Keep first'],['keep-last','Keep last']].map(([value,label])=>`<button type="button" data-decision="${value}" class="${decision===value?'is-active':''}">${label}</button>`).join('')}</div>`;wrapper.querySelectorAll('[data-decision]').forEach(button=>button.addEventListener('click',()=>{state.duplicateDecisions.set(group.key,button.dataset.decision);renderDuplicates();}));elements.duplicateGroups.appendChild(wrapper)});
  }
  function renderSessions(){
    state.sessions=groupSessions(state.rows,Number(elements.sessionGap.value||60));elements.sessionGrid.innerHTML='';state.sessions.forEach(session=>{const button=document.createElement('button');button.type='button';button.className=`adifSession${state.session===session.id?' is-active':''}`;button.innerHTML=`<strong>${escapeXml(session.date)} · ${session.rows.length} QSOs</strong><span>${escapeXml(session.station)} · ${escapeXml(session.place)}</span><span>${escapeXml(session.bands.join(', ')||'Band not recorded')} · ${formatDuration(session.end-session.start)}</span>`;button.addEventListener('click',()=>{state.session=state.session===session.id?'':session.id;state.page=1;renderSessions();applyFilters();});elements.sessionGrid.appendChild(button)});if(!state.sessions.length)elements.sessionGrid.textContent='No complete timestamps available for session grouping.';
  }
  function renderReconciliation(){
    const sources=[...new Set(state.rows.map(row=>row.source))];elements.reconciliation.hidden=sources.length<2;if(sources.length<2)return;
    const previousA=elements.reconcileA.value,previousB=elements.reconcileB.value;elements.reconcileA.innerHTML='';elements.reconcileB.innerHTML='';sources.forEach(source=>{for(const select of [elements.reconcileA,elements.reconcileB]){const option=document.createElement('option');option.value=source;option.textContent=source;select.appendChild(option)}});elements.reconcileA.value=sources.includes(previousA)?previousA:sources[0];elements.reconcileB.value=sources.includes(previousB)&&previousB!==elements.reconcileA.value?previousB:sources[1];updateReconciliation();
    if(!elements.reconcileA.dataset.bound){elements.reconcileA.dataset.bound='true';elements.reconcileA.addEventListener('change',updateReconciliation);elements.reconcileB.addEventListener('change',updateReconciliation);}
  }
  function updateReconciliation(){
    const rowsA=state.rows.filter(row=>row.source===elements.reconcileA.value),rowsB=state.rows.filter(row=>row.source===elements.reconcileB.value),exactA=new Map(rowsA.map(row=>[reconciliationKey(row),row])),exactB=new Map(rowsB.map(row=>[reconciliationKey(row),row]));let both=0;exactA.forEach((_,key)=>{if(exactB.has(key))both+=1});const onlyA=rowsA.filter(row=>!exactB.has(reconciliationKey(row))),onlyB=rowsB.filter(row=>!exactA.has(reconciliationKey(row))),probableKeysB=new Map(onlyB.map(row=>[reconciliationKey(row,false),row])),probable=onlyA.filter(row=>probableKeysB.has(reconciliationKey(row,false))).length;
    elements.reconcileStats.innerHTML=`<article><span>In both</span><strong>${both}</strong></article><article><span>Only in A</span><strong>${onlyA.length}</strong></article><article><span>Only in B</span><strong>${onlyB.length}</strong></article><article><span>Likely match, fields differ</span><strong>${probable}</strong></article><article><span>Compared</span><strong>${rowsA.length} / ${rowsB.length}</strong></article>`;
  }
  function buildFacets(){
    qa('[data-adif-facet]').forEach(facet=>{const key=facet.dataset.adifFacet,values=[...new Set(state.rows.map(row=>row[key]).filter(Boolean))].sort(key==='band'?compareBands:(a,b)=>a.localeCompare(b)),panel=facet.querySelector('div'),trigger=facet.querySelector('button'),selected=state.facets[key];panel.innerHTML='';values.forEach(value=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=selected.has(value);input.addEventListener('change',()=>{input.checked?selected.add(value):selected.delete(value);state.page=1;syncFacetLabel(facet,key);applyFilters();});label.append(input,document.createTextNode(value));panel.appendChild(label)});syncFacetLabel(facet,key);if(!trigger.dataset.bound){trigger.dataset.bound='true';trigger.addEventListener('click',()=>{qa('[data-adif-facet]').forEach(other=>{if(other!==facet)other.classList.remove('is-open')});facet.classList.toggle('is-open')});}});
  }
  function syncFacetLabel(facet,key){const count=state.facets[key].size,span=facet.querySelector('button span');span.textContent=count?String(count):'All';}
  function warningIndexesForIssue(){if(!state.issue)return null;if(state.issue==='duplicate-qsos')return state.duplicates.duplicateIndexes;return new Set(state.warnings.filter(w=>w.code===state.issue&&Number.isInteger(w.recordIndex)).map(w=>w.recordIndex));}
  function applyFilters(){
    const query=safeUpper(elements.search.value),from=elements.dateFrom.value?new Date(`${elements.dateFrom.value}T00:00:00Z`):null,to=elements.dateTo.value?new Date(`${elements.dateTo.value}T23:59:59Z`):null,issueIndexes=warningIndexesForIssue(),session=state.sessions.find(item=>item.id===state.session),sessionIds=session?new Set(session.rows.map(row=>row.id)):null;
    state.filtered=state.rows.filter(row=>{if(query&&!`${row.utc} ${row.call} ${row.band} ${row.mode} ${row.grid} ${row.myGrid} ${row.ref} ${row.myRef} ${row.station} ${row.operator} ${row.source} ${row.propagation} ${row.satellite}`.toUpperCase().includes(query))return false;if(from&&(!row.dt||row.dt<from))return false;if(to&&(!row.dt||row.dt>to))return false;for(const key of Object.keys(state.facets)){if(state.facets[key].size&&!state.facets[key].has(row[key]))return false;}if(issueIndexes&&!issueIndexes.has(row.index))return false;if(sessionIds&&!sessionIds.has(row.id))return false;return true;});
    sortFiltered();const pages=Math.max(1,Math.ceil(state.filtered.length/PAGE_SIZE));state.page=Math.min(state.page,pages);renderFilterPills();renderTable();elements.filterCount.textContent=`${state.filtered.length} of ${state.rows.length}`;updateMap();setExportStatus(`${state.filtered.length} QSOs in the current filtered view; ${state.selected.size} selected.`);
  }
  function sortFiltered(){const {key,direction}=state.sort;state.filtered.sort((a,b)=>{let left=key==='utc'?(a.dt?.getTime()??Infinity):String(a[key]||''),right=key==='utc'?(b.dt?.getTime()??Infinity):String(b[key]||'');return (typeof left==='number'?left-right:String(left).localeCompare(String(right),undefined,{numeric:true}))*direction;});}
  function renderFilterPills(){elements.filterPills.innerHTML='';const add=(label,clear)=>{const button=document.createElement('button');button.type='button';button.className='adifFilterPill';button.textContent=`${label} ×`;button.addEventListener('click',clear);elements.filterPills.appendChild(button)};if(elements.search.value)add(`Search: ${elements.search.value}`,()=>{elements.search.value='';applyFilters()});if(elements.dateFrom.value)add(`From ${elements.dateFrom.value}`,()=>{elements.dateFrom.value='';applyFilters()});if(elements.dateTo.value)add(`To ${elements.dateTo.value}`,()=>{elements.dateTo.value='';applyFilters()});Object.entries(state.facets).forEach(([key,set])=>set.forEach(value=>add(`${key}: ${value}`,()=>{set.delete(value);buildFacets();applyFilters()})));if(state.issue)add(`Issue: ${state.issue}`,()=>{state.issue='';renderIssues();applyFilters()});if(state.session)add('Session',()=>{state.session='';renderSessions();applyFilters()});}
  function renderTable(){
    elements.table.innerHTML='';const start=(state.page-1)*PAGE_SIZE,pageRows=state.filtered.slice(start,start+PAGE_SIZE);if(!pageRows.length){const tr=document.createElement('tr'),td=cell('No QSOs match the current filters.');td.colSpan=11;tr.appendChild(td);elements.table.appendChild(tr);}pageRows.forEach(row=>{const tr=document.createElement('tr');if(state.duplicates.duplicateIndexes.has(row.index)||state.warnings.some(w=>w.recordIndex===row.index))tr.classList.add('is-flagged');if(row.record._modifiedFields?.length)tr.classList.add('is-modified');const select=document.createElement('td'),checkbox=document.createElement('input'),distance=distanceForRow(row),actions=document.createElement('td'),edit=document.createElement('button');checkbox.type='checkbox';checkbox.checked=state.selected.has(row.id);checkbox.setAttribute('aria-label',`Select ${row.call||'QSO'}`);checkbox.addEventListener('change',()=>{checkbox.checked?state.selected.add(row.id):state.selected.delete(row.id);syncSelectionStatus();});select.appendChild(checkbox);edit.type='button';edit.className='adifEditButton';edit.textContent='Edit';edit.addEventListener('click',()=>openEditor(row));actions.appendChild(edit);tr.append(select,cell(row.utc),cell(row.call),cell(row.band),cell(row.mode),cell(row.grid),cell(row.ref),cell(row.station),cell(Number.isFinite(distance)?`${Math.round(distance)} km`:''),cell(`${row.source}${row.record._modifiedFields?.length?' · modified':''}`),actions);elements.table.appendChild(tr)});const pages=Math.max(1,Math.ceil(state.filtered.length/PAGE_SIZE));elements.pageMeta.textContent=`Page ${state.page} of ${pages} · ${state.filtered.length} records`;elements.prev.disabled=state.page<=1;elements.next.disabled=state.page>=pages;elements.selectPage.checked=pageRows.length>0&&pageRows.every(row=>state.selected.has(row.id));syncSelectionStatus();
  }
  function syncSelectionStatus(){elements.selectedCount.textContent=String(state.selected.size);setExportStatus(`${state.filtered.length} QSOs in the current filtered view; ${state.selected.size} selected.`);}
  function openEditor(row){state.editingId=row.id;elements.editorForm.querySelectorAll('[data-edit-field]').forEach(input=>{input.value=getField(row.record,input.dataset.editField)});elements.editor.showModal();}
  function clearFilters(){elements.search.value='';elements.dateFrom.value='';elements.dateTo.value='';Object.values(state.facets).forEach(set=>set.clear());state.issue='';state.session='';state.page=1;buildFacets();renderIssues();renderSessions();applyFilters();}

  function syncMapStations(stations){
    if(!elements.mapStations)return;const signature=stations.join('|');if(elements.mapStations.dataset.signature===signature)return;elements.mapStations.dataset.signature=signature;elements.mapStations.innerHTML='';if(!stations.length){elements.mapStations.textContent='No station callsigns in this view.';return;}stations.forEach(station=>{const label=document.createElement('label'),enabled=document.createElement('input'),colour=document.createElement('input'),name=document.createElement('span');enabled.type='checkbox';enabled.checked=true;enabled.setAttribute('aria-label',`Show traces for ${station}`);colour.type='color';colour.value=state.map.colourFor(station);colour.setAttribute('aria-label',`Trace colour for ${station}`);name.textContent=station;enabled.addEventListener('change',()=>state.map.setStationVisible(station,enabled.checked));colour.addEventListener('input',()=>state.map.setStationColour(station,colour.value));label.append(enabled,colour,name);elements.mapStations.appendChild(label)});
  }
  async function ensureMap(){if(!elements.mapHost)return null;if(!state.map){try{state.map=createAdifSvgMap(elements.mapHost);}catch(error){console.error(error);elements.mapStatus.textContent='The map could not be initialised. KML export still works for resolved records.';}}return state.map;}
  async function updateMap(){try{const map=await ensureMap();state.mapPoints=state.filtered.map(row=>{const point=resolveMapPoint(row);return point?{...point,row,origin:resolveOrigin(row)}:null}).filter(Boolean);const result=map?.update(state.mapPoints)||{traceCount:0,stations:[]};syncMapStations(result.stations);const high=state.mapPoints.filter(p=>p.confidence==='high').length,medium=state.mapPoints.filter(p=>p.confidence==='medium').length,low=state.mapPoints.filter(p=>p.confidence==='low').length,traces=result.traceCount;elements.mapMeta.textContent=`${state.mapPoints.length} of ${state.filtered.length} filtered QSOs mapped: ${high} precise/grid, ${medium} reference-region and ${low} callsign-region.`;elements.mapStatus.textContent=!state.mapPoints.length?'No filtered contacts have usable location clues.':traces?`${traces} trace${traces===1?'':'s'} drawn from logged station and contact coordinates.`:'No traces: both ends need coordinates or grid squares; references alone are not precise locations.';}catch(error){console.error(error);elements.mapStatus.textContent=`Map refresh failed: ${error.message}`;}}
  function reviewedRecords(rows){const excluded=new Set();state.duplicates.groups.forEach(group=>{const decision=state.duplicateDecisions.get(group.key)||'keep-both';if(decision==='keep-first')group.indices.slice(1).forEach(index=>excluded.add(index));if(decision==='keep-last')group.indices.slice(0,-1).forEach(index=>excluded.add(index));});return rows.filter(row=>!excluded.has(row.index)).map(row=>row.record);}
  function exportRows(){if(elements.exportScope.value==='filtered')return state.filtered;if(elements.exportScope.value==='selected')return state.rows.filter(row=>state.selected.has(row.id));return state.rows;}
  function exportFile(format){
    if(!state.bundle)return;let records=reviewedRecords(exportRows());if(!records.length){setExportStatus('There are no records in that export scope.');return;}const preset=elements.exportPreset.value;if(preset!=='generic')records=applyExportPreset(records,preset,{stationCallsign:elements.exportStation.value,operator:elements.exportOperator.value,myRef:elements.exportMyRef.value,contactRef:elements.exportContactRef.value,overwrite:elements.exportOverwrite.checked});records=dedupeRecords(records,elements.dedupeMode.value,{thresholdMs:90000});let output,extension;if(format==='csv'){output=serialiseCsv(records);extension='csv';}else if(format==='json'){output=serialiseJson(records);extension='json';}else{output=serialiseAdi(state.bundle,{records,adifVersion:ADIF_VERSION,programId:'ChipsnCode ADIF Analyser',programVersion:'2.0',createdTimestamp:makeCreatedTimestamp()});extension='adi';}const name=(elements.exportFilename.value||'adif-export').replace(/\.(adi|adif|csv|json)$/i,'');makeDownload(`${name}.${extension}`,output);setExportStatus(`Downloaded ${records.length} records as ${name}.${extension}.`);
  }
  async function handleFiles(fileList){
    const files=[...fileList].filter(file=>/\.(adi|adif)$/i.test(file.name));state.files=files;elements.filePills.innerHTML='';files.forEach(file=>{const pill=document.createElement('span');pill.className='adifFilePill';pill.textContent=`${file.name} · ${Math.max(1,Math.round(file.size/1024))} KB`;elements.filePills.appendChild(pill)});elements.filePills.hidden=!files.length;if(!files.length){setStatus('Those do not look like ADIF files.',true);return;}setStatus(`Reading ${files.length} file${files.length===1?'':'s'}…`);try{state.bundle=await parseFiles(files);state.duplicateDecisions.clear();state.selected.clear();refreshRows();setStatus(`Parsed ${state.bundle.records.length} QSO${state.bundle.records.length===1?'':'s'} from ${files.length} file${files.length===1?'':'s'}.`);if(files.length===1)elements.exportFilename.value=files[0].name.replace(/\.(adi|adif)$/i,'');}catch(error){console.error(error);setStatus('The parser tripped over something in those files.',true);}
  }

  elements.search.addEventListener('input',()=>{state.page=1;applyFilters()});elements.dateFrom.addEventListener('change',()=>{state.page=1;applyFilters()});elements.dateTo.addEventListener('change',()=>{state.page=1;applyFilters()});q('[data-adif-clear-filters]').addEventListener('click',clearFilters);elements.sessionGap.addEventListener('change',()=>{renderSessions();applyFilters()});
  qa('[data-sort]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.sort;if(state.sort.key===key)state.sort.direction*=-1;else state.sort={key,direction:1};applyFilters()}));elements.prev.addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderTable()});elements.next.addEventListener('click',()=>{state.page+=1;renderTable()});elements.selectPage.addEventListener('change',()=>{const start=(state.page-1)*PAGE_SIZE;state.filtered.slice(start,start+PAGE_SIZE).forEach(row=>elements.selectPage.checked?state.selected.add(row.id):state.selected.delete(row.id));renderTable();});
  elements.bulkApply.addEventListener('click',()=>{const field=elements.bulkField.value,value=elements.bulkValue.value.trim();if(!value||!state.selected.size)return;state.rows.filter(row=>state.selected.has(row.id)).forEach(row=>{setField(row.record,field,value);row.record._modifiedFields=[...new Set([...(row.record._modifiedFields||[]),field])];});elements.bulkValue.value='';refreshRows();});
  elements.editorForm.addEventListener('submit',(event)=>{const submitter=event.submitter;if(submitter?.value!=='save')return;event.preventDefault();const row=state.rows.find(item=>item.id===state.editingId);if(!row)return;const modified=[];elements.editorForm.querySelectorAll('[data-edit-field]').forEach(input=>{const field=input.dataset.editField,value=input.value.trim(),before=getField(row.record,field);if(value!==before){setField(row.record,field,value);modified.push(field);}});row.record._modifiedFields=[...new Set([...(row.record._modifiedFields||[]),...modified])];elements.editor.close();refreshRows();});
  qa('[data-adif-export-download]').forEach(button=>button.addEventListener('click',()=>exportFile(button.dataset.exportFormat)));
  elements.mapBasemap?.addEventListener('change',async()=>{const map=await ensureMap();map?.setBasemap(elements.mapBasemap.value)});
  elements.mapTraceMaster?.addEventListener('change',()=>state.map?.setTracesVisible(elements.mapTraceMaster.checked));
  elements.mapTraceOpacity?.addEventListener('input',()=>{const value=Number(elements.mapTraceOpacity.value);elements.mapTraceOpacityValue.textContent=`${value}%`;state.map?.setTraceOpacity(value/100)});
  elements.mapZoomIn?.addEventListener('click',()=>state.map?.zoomIn());elements.mapZoomOut?.addEventListener('click',()=>state.map?.zoomOut());elements.mapFit?.addEventListener('click',()=>state.map?.fit());elements.mapWorld?.addEventListener('click',()=>state.map?.world());
  elements.mapKml.addEventListener('click',()=>{if(!state.mapPoints.length)return;makeDownload('filtered-adif-contacts.kml',makeKml(state.mapPoints),'application/vnd.google-earth.kml+xml;charset=utf-8')});
  elements.mapPng?.addEventListener('click',async()=>{if(!state.mapPoints.length)return;const original=elements.mapPng.textContent;elements.mapPng.disabled=true;elements.mapPng.textContent='Rendering…';try{const result=await state.map.exportPng({scale:elements.mapPngScale.value,legend:elements.mapLegend.checked}),url=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=url;link.download=`filtered-adif-map-${state.mapPoints.length}-qsos.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);elements.mapStatus.textContent=`Exported ${result.width.toLocaleString()} × ${result.height.toLocaleString()} PNG.`;}catch(error){elements.mapStatus.textContent=`PNG export failed: ${error.message}`;}finally{elements.mapPng.disabled=false;elements.mapPng.textContent=original;}});
  elements.mapFullscreen.addEventListener('click',async()=>{if(document.fullscreenElement===elements.mapHost)await document.exitFullscreen();else await elements.mapHost.requestFullscreen()});document.addEventListener('fullscreenchange',()=>setTimeout(()=>state.map?.invalidate(),80));
  elements.manualForm.addEventListener('submit',(event)=>{event.preventDefault();const form=event.currentTarget,call=form.querySelector('[data-manual-call]').value.trim(),date=form.querySelector('[data-manual-date]').value,time=form.querySelector('[data-manual-time]').value;if(!call||!date||!time)return;state.bundle||={header:{text:'Manually entered log.',fields:[],userDefs:[],appFieldTypes:{}},records:[]};const record={fields:{},order:[],_source:{name:'Manual entry',index:-1,recordIndex:state.bundle.records.length}};setField(record,'CALL',call.toUpperCase());setField(record,'QSO_DATE',date.replaceAll('-',''));setField(record,'TIME_ON',time.replaceAll(':',''));[['BAND','[data-manual-band]',String.prototype.toLowerCase],['MODE','[data-manual-mode]',String.prototype.toUpperCase],['GRIDSQUARE','[data-manual-grid]',String.prototype.toUpperCase],['RST_SENT','[data-manual-rst-sent]'],['RST_RCVD','[data-manual-rst-received]'],['SIG_INFO','[data-manual-ref]'],['STATION_CALLSIGN','[data-manual-station]',String.prototype.toUpperCase]].forEach(([field,selector,transform])=>{let value=form.querySelector(selector).value.trim();if(value)setField(record,field,transform?transform.call(value):value)});state.bundle.records.push(record);refreshRows();elements.manualStatus.textContent=`Added ${call.toUpperCase()} at ${time} UTC.`;form.reset();});
  elements.input.addEventListener('change',event=>handleFiles(event.target.files));['dragenter','dragover'].forEach(name=>elements.dropzone.addEventListener(name,event=>{event.preventDefault();elements.dropzone.classList.add('is-dragover')}));['dragleave','dragend','drop'].forEach(name=>elements.dropzone.addEventListener(name,event=>{event.preventDefault();elements.dropzone.classList.remove('is-dragover')}));elements.dropzone.addEventListener('drop',event=>handleFiles(event.dataTransfer.files));document.addEventListener('click',event=>{if(!event.target.closest('[data-adif-facet]'))qa('[data-adif-facet]').forEach(facet=>facet.classList.remove('is-open'))});window.addEventListener('resize',()=>{if(state.rows.length){const rate=drawRateChart(elements.chart,state.rows);elements.rateMeta.textContent=rate.peak?`Peak ${rate.peak} QSOs per ${rate.label}; ${rate.average.toFixed(1)} average.`:rate.label;state.map?.invalidate();}});
}

function init(){document.querySelectorAll('[data-adif-tool]').forEach(initialiseTool);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
