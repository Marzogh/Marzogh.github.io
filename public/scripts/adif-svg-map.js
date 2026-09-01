const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 1200;
const HEIGHT = 600;
const LAT_LIMIT = 85;
const TRACE_PALETTE = ['#2d63a7','#a64b34','#2f7d5c','#8b5bb5','#c28a17','#16839b','#b64069','#557a2f'];
const BASEMAP_SERVICE = {
  topographic: 'World_Topo_Map',
  terrain: 'World_Terrain_Base',
  satellite: 'World_Imagery',
};
let mapInstance = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const svgNode = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const project = (lon, lat) => [((lon + 180) / 360) * WIDTH, ((LAT_LIMIT - clamp(lat, -LAT_LIMIT, LAT_LIMIT)) / (LAT_LIMIT * 2)) * HEIGHT];
const distanceKm = (a, b) => {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLon = radians(b.lon - a.lon), lat1 = radians(a.lat), lat2 = radians(b.lat);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(value));
};
function greatCircle(a, b, steps = 56) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const lat1 = a.lat * rad, lon1 = a.lon * rad, lat2 = b.lat * rad, lon2 = b.lon * rad;
  const distance = 2 * Math.asin(Math.sqrt(Math.sin((lat2-lat1)/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2-lon1)/2) ** 2));
  if (!distance) return [[a.lon, a.lat], [b.lon, b.lat]];
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const fraction = index / steps, A = Math.sin((1-fraction)*distance) / Math.sin(distance), B = Math.sin(fraction*distance) / Math.sin(distance);
    const x = A*Math.cos(lat1)*Math.cos(lon1)+B*Math.cos(lat2)*Math.cos(lon2), y = A*Math.cos(lat1)*Math.sin(lon1)+B*Math.cos(lat2)*Math.sin(lon2), z = A*Math.sin(lat1)+B*Math.sin(lat2);
    points.push([Math.atan2(y,x)*deg, Math.atan2(z,Math.sqrt(x*x+y*y))*deg]);
  }
  return points;
}
function routePath(a, b) {
  const points = greatCircle(a, b); let path = '', previous = null;
  points.forEach(([lon, lat]) => {
    if (!previous) { const [x,y] = project(lon,lat); path = `M${x.toFixed(1)},${y.toFixed(1)}`; previous=[lon,lat]; return; }
    const [previousLon, previousLat] = previous, delta = lon - previousLon;
    if (Math.abs(delta) > 180) {
      const westward = previousLon > 0 && lon < 0, adjusted = westward ? lon + 360 : lon - 360, edge = westward ? 180 : -180;
      const fraction = (edge - previousLon) / (adjusted - previousLon), seamLat = previousLat + (lat - previousLat) * fraction;
      const [ax,ay] = project(edge,seamLat), [bx,by] = project(-edge,seamLat), [cx,cy] = project(lon,lat);
      path += ` L${ax.toFixed(1)},${ay.toFixed(1)} M${bx.toFixed(1)},${by.toFixed(1)} L${cx.toFixed(1)},${cy.toFixed(1)}`;
    } else { const [x,y] = project(lon,lat); path += ` L${x.toFixed(1)},${y.toFixed(1)}`; }
    previous = [lon,lat];
  });
  return path;
}
function basemapUrl(kind, width = 2048, height = 1024) {
  const service = BASEMAP_SERVICE[kind] || BASEMAP_SERVICE.topographic;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/export?bbox=-180,-85,180,85&bboxSR=4326&imageSR=4326&size=${width},${height}&format=png32&transparent=false&f=image`;
}
function loadImage(url, crossOrigin = false) {
  return new Promise((resolve,reject)=>{const image=new Image();if(crossOrigin)image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The basemap could not be loaded for export.'));image.src=url;});
}
function circularExtent(values) {
  if (values.length < 2) return {min: values[0] || 0, max: values[0] || 0};
  const sorted = [...values].sort((a,b)=>a-b); let largestGap = -1, gapIndex = 0;
  sorted.forEach((value,index)=>{const next=index===sorted.length-1?sorted[0]+WIDTH:sorted[index+1],gap=next-value;if(gap>largestGap){largestGap=gap;gapIndex=index;}});
  return {min:gapIndex===sorted.length-1?sorted[0]:sorted[gapIndex+1],max:sorted[gapIndex]+WIDTH};
}

export function createAdifSvgMap(host, options = {}) {
  host.innerHTML = '';
  const shell = document.createElement('div'); shell.className = 'adifSvgMap';
  const stage = document.createElement('div'); stage.className = 'adifSvgMap__stage';
  const svg = svgNode('svg',{viewBox:`0 0 ${WIDTH} ${HEIGHT}`,role:'img','aria-label':'Interactive world map of filtered radio contacts'}),viewportId=`adif-map-viewport-${++mapInstance}`;
  const panzoom=svgNode('g'),viewport=svgNode('g',{id:viewportId}),raster=svgNode('image',{x:0,y:0,width:WIDTH,height:HEIGHT,preserveAspectRatio:'none'}),traces=svgNode('g'),origins=svgNode('g'),selectedRoute=svgNode('g'),contacts=svgNode('g');
  viewport.append(raster,traces,origins,selectedRoute,contacts);const left=svgNode('use',{href:`#${viewportId}`,x:-WIDTH,y:0,'pointer-events':'all'}),right=svgNode('use',{href:`#${viewportId}`,x:WIDTH,y:0,'pointer-events':'all'});panzoom.append(left,viewport,right);svg.appendChild(panzoom);stage.appendChild(svg);
  const attribution=document.createElement('span');attribution.className='adifSvgMap__attribution';stage.appendChild(attribution);
  const selection=document.createElement('div');selection.className='adifSvgMap__selection';selection.innerHTML='<strong>No QSO selected</strong><span>Select a contact to inspect it and emphasise its path.</span>';
  shell.append(stage,selection);host.appendChild(shell);

  let entries=[], transform={x:0,y:0,k:1}, dragging=false, dragStart=null, transformStart=null, moved=false, basemap='topographic', opacity=.18, showTraces=true, selected=null;
  const stationVisibility=new Map(), colours=new Map();
  const stationFor = entry => entry.row.station || entry.row.operator || 'My station';
  const colourFor = station => { if(colours.has(station))return colours.get(station);let hash=0;for(const character of station)hash=((hash<<5)-hash+character.charCodeAt(0))|0;return TRACE_PALETTE[Math.abs(hash)%TRACE_PALETTE.length]; };
  function updateTransform(){transform.k=clamp(transform.k,1,16);transform.y=clamp(transform.y,HEIGHT-HEIGHT*transform.k,0);while(transform.x>0)transform.x-=WIDTH*transform.k;while(transform.x<=-WIDTH*transform.k)transform.x+=WIDTH*transform.k;panzoom.setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.k})`);contacts.querySelectorAll('circle').forEach(node=>node.setAttribute('r',2.5/Math.sqrt(transform.k)));origins.querySelectorAll('circle').forEach(node=>node.setAttribute('r',3.2/Math.sqrt(transform.k)));}
  function drawSelection(entry,node){contacts.querySelectorAll('.is-selected').forEach(item=>item.classList.remove('is-selected'));node?.classList.add('is-selected');selected=entry;selectedRoute.textContent='';if(!entry){selection.innerHTML='<strong>No QSO selected</strong><span>Select a contact to inspect it and emphasise its path.</span>';return;}const station=stationFor(entry),distance=entry.origin?`${Math.round(distanceKm(entry.origin,entry)).toLocaleString()} km`:'—';if(entry.origin){const route=svgNode('path',{d:routePath(entry.origin,entry),class:'adifSvgMap__selectedRoute'});selectedRoute.appendChild(route);}selection.innerHTML=`<strong>${escapeHtml(entry.row.call||'Unknown call')}</strong><span>${escapeHtml(entry.row.utc||'No timestamp')} · ${escapeHtml(entry.row.band||'Unknown band')} · ${escapeHtml(entry.row.mode||'Unknown mode')}</span><span>${escapeHtml(station)} → ${escapeHtml(entry.clue||entry.row.grid||'mapped location')} · ${distance}</span><span>${escapeHtml(entry.row.ref||entry.row.myRef||'')}</span>`;}
  function draw(){traces.textContent='';origins.textContent='';contacts.textContent='';selectedRoute.textContent='';const seenOrigins=new Set();let traceCount=0;entries.forEach((entry,index)=>{const station=stationFor(entry),colour=colourFor(station),visible=stationVisibility.get(station)!==false;if(showTraces&&visible&&entry.origin&&entry.confidence==='high'&&entry.origin.confidence!=='medium'){traces.appendChild(svgNode('path',{d:routePath(entry.origin,entry),class:'adifSvgMap__trace',stroke:colour,'stroke-opacity':opacity}));traceCount+=1;const key=`${station}|${entry.origin.lat.toFixed(5)}|${entry.origin.lon.toFixed(5)}`;if(!seenOrigins.has(key)){seenOrigins.add(key);const [x,y]=project(entry.origin.lon,entry.origin.lat);origins.appendChild(svgNode('circle',{cx:x,cy:y,r:3.2,class:'adifSvgMap__origin',fill:colour}));}}const [x,y]=project(entry.lon,entry.lat),point=svgNode('circle',{cx:x,cy:y,r:2.5,class:`adifSvgMap__contact adifSvgMap__contact--${entry.confidence}`,fill:colour,tabindex:0,'aria-label':`${entry.row.call||'QSO'} ${entry.row.band||''} ${entry.row.mode||''}`});point.dataset.index=index;point.addEventListener('click',event=>{event.stopPropagation();drawSelection(entry,point)});point.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();drawSelection(entry,point)}});contacts.appendChild(point);});drawSelection(null);updateTransform();return traceCount;}
  function fit(){const points=entries.map(entry=>project(entry.lon,entry.lat));if(!points.length){transform={x:0,y:0,k:1};updateTransform();return;}const extent=circularExtent(points.map(point=>point[0])),ys=points.map(point=>point[1]),minY=Math.min(...ys),maxY=Math.max(...ys),width=Math.max(35,extent.max-extent.min),height=Math.max(35,maxY-minY),k=clamp(Math.min(WIDTH/(width*1.2),HEIGHT/(height*1.25)),1,8),cx=(extent.min+extent.max)/2,cy=(minY+maxY)/2;transform={k,x:WIDTH/2-k*cx,y:HEIGHT/2-k*cy};updateTransform();}
  function zoom(factor,cx=WIDTH/2,cy=HEIGHT/2){const next=clamp(transform.k*factor,1,16),ratio=next/transform.k;transform.x=cx-(cx-transform.x)*ratio;transform.y=cy-(cy-transform.y)*ratio;transform.k=next;updateTransform();}
  function eventPoint(event){const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const result=point.matrixTransform(svg.getScreenCTM().inverse());return [result.x,result.y];}
  function pickEntry(event){if(!entries.length){drawSelection(null);return;}const [mapX,mapY]=eventPoint(event),worldX=(mapX-transform.x)/transform.k,worldY=(mapY-transform.y)/transform.k,rect=svg.getBoundingClientRect(),threshold=12*WIDTH/Math.max(1,rect.width);let best=null,bestIndex=-1,bestDistance=Infinity;entries.forEach((entry,index)=>{const [x,y]=project(entry.lon,entry.lat),dx=((worldX-x+WIDTH/2)%WIDTH+WIDTH)%WIDTH-WIDTH/2,dy=worldY-y,distance=Math.hypot(dx*transform.k,dy*transform.k);if(distance<bestDistance){bestDistance=distance;best=entry;bestIndex=index;}});if(best&&bestDistance<=threshold){drawSelection(best,contacts.querySelector(`[data-index="${bestIndex}"]`));}else drawSelection(null);}
  svg.addEventListener('pointerdown',event=>{if(event.button!==0||(event.pointerType!=='mouse'&&!document.fullscreenElement))return;dragging=true;moved=false;dragStart=[event.clientX,event.clientY];transformStart={...transform};svg.setPointerCapture(event.pointerId)});
  svg.addEventListener('pointermove',event=>{if(!dragging)return;const rect=svg.getBoundingClientRect(),dx=(event.clientX-dragStart[0])*WIDTH/rect.width,dy=(event.clientY-dragStart[1])*HEIGHT/rect.height;if(Math.hypot(dx,dy)>4)moved=true;transform.x=transformStart.x+dx;transform.y=transformStart.y+dy;updateTransform()});
  svg.addEventListener('pointerup',event=>{dragging=false;try{svg.releasePointerCapture(event.pointerId)}catch{}if(!moved)pickEntry(event)});svg.addEventListener('pointercancel',()=>{dragging=false});
  svg.addEventListener('wheel',event=>{const factor=event.deltaY<0?1.22:.82,next=clamp(transform.k*factor,1,16);if(next===transform.k)return;event.preventDefault();const [x,y]=eventPoint(event);zoom(factor,x,y)},{passive:false});
  function setBasemap(kind){basemap=BASEMAP_SERVICE[kind]?kind:'topographic';raster.setAttribute('href',basemapUrl(basemap));attribution.textContent=basemap==='satellite'?'Imagery © Esri and contributors':'Map © Esri and contributors';}
  async function exportPng({scale=4,legend=true}={}){const requested=clamp(Number(scale)||4,1,8),rect=svg.getBoundingClientRect();let width=Math.round(rect.width*requested),height=Math.round(rect.height*requested);const cap=8000;if(Math.max(width,height)>cap){const factor=cap/Math.max(width,height);width=Math.round(width*factor);height=Math.round(height*factor);}const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';const image=await loadImage(basemapUrl(basemap,Math.min(2048,width),Math.min(2048,height)),true);context.drawImage(image,0,0,width,height);const clone=svg.cloneNode(true);clone.querySelector('image')?.remove();clone.setAttribute('width',WIDTH);clone.setAttribute('height',HEIGHT);const style=svgNode('style');style.textContent='.adifSvgMap__trace{fill:none;stroke-width:.8;vector-effect:non-scaling-stroke}.adifSvgMap__origin{stroke:#fff;stroke-width:1;vector-effect:non-scaling-stroke}.adifSvgMap__contact{stroke:#fff;stroke-width:.8;fill-opacity:.9;vector-effect:non-scaling-stroke}.adifSvgMap__selectedRoute{fill:none;stroke:#f2c14e;stroke-width:1.6;vector-effect:non-scaling-stroke}';clone.insertBefore(style,clone.firstChild);const overlay=await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`);context.drawImage(overlay,0,0,width,height);if(legend){const stations=[...new Set(entries.map(stationFor))].filter(station=>stationVisibility.get(station)!==false),pad=Math.max(12,Math.round(width/180)),font=Math.max(14,Math.round(width/110)),line=Math.round(font*1.45),boxWidth=Math.min(width*.48,Math.max(240,stations.reduce((max,station)=>Math.max(max,station.length*font*.62),0)+pad*4)),boxHeight=pad*2+line*(stations.length+1);context.fillStyle='rgba(255,255,255,.82)';context.fillRect(pad,height-boxHeight-pad,boxWidth,boxHeight);context.font=`600 ${font}px system-ui,sans-serif`;context.textBaseline='middle';context.fillStyle='#17191d';context.fillText(`${entries.length.toLocaleString()} filtered QSO${entries.length===1?'':'s'}`,pad*2,height-boxHeight+pad+line/2);stations.forEach((station,index)=>{const y=height-boxHeight+pad+line*(index+1.5);context.strokeStyle=colourFor(station);context.lineWidth=Math.max(3,font/4);context.beginPath();context.moveTo(pad*2,y);context.lineTo(pad*3.5,y);context.stroke();context.fillStyle='#17191d';context.fillText(station,pad*4,y)});}const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed.');return {blob,width,height};}
  setBasemap(basemap);updateTransform();
  return {
    update(nextEntries){entries=nextEntries||[];const stations=[...new Set(entries.map(stationFor))];stations.forEach(station=>{if(!stationVisibility.has(station))stationVisibility.set(station,true)});[...stationVisibility.keys()].filter(station=>!stations.includes(station)).forEach(station=>stationVisibility.delete(station));const traceCount=draw();fit();return {traceCount,stations};},
    setBasemap,
    setTraceOpacity(value){opacity=clamp(Number(value)||.18,.05,.7);return draw();},
    setTracesVisible(value){showTraces=Boolean(value);return draw();},
    setStationVisible(station,value){stationVisibility.set(station,Boolean(value));return draw();},
    setStationColour(station,value){colours.set(station,value);return draw();},
    colourFor,
    fit,
    world(){transform={x:0,y:0,k:1};updateTransform()},
    zoomIn(){zoom(1.5)},
    zoomOut(){zoom(1/1.5)},
    exportPng,
    invalidate(){updateTransform()},
  };
}
