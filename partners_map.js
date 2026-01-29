/* Partners Map (Leaflet + OpenStreetMap tiles)
   - No Google API key required
   - Still provides "Open in Google Maps" link per shop
*/

function safeText(x){
  return (x===null||x===undefined)?"":String(x);
}

function normUrl(url){
  const u = safeText(url).trim();
  if(!u) return "";
  // allow already-correct URLs
  if(/^https?:\/\//i.test(u)) return u;
  return "https://" + u;
}

function googleMapsQueryUrl(lat,lng){
  if(typeof lat !== 'number' || typeof lng !== 'number') return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

let map;
let markersLayer;
let allPartners=[];
let markerByKey=new Map();

function buildKey(p){
  return `${safeText(p['Shop Name']).trim()}|${safeText(p.Location1_EN)}|${safeText(p.Location2_EN)}|${safeText(p.Lat)}|${safeText(p.Lng)}`;
}

function initMap(){
  map = L.map('pm-map', { zoomControl: true });
  // Default center: Phnom Penh
  map.setView([11.5564, 104.9282], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function clearMarkers(){
  markersLayer.clearLayers();
  markerByKey.clear();
}

function addMarkers(partners){
  clearMarkers();
  const bounds=[];

  partners.forEach(p => {
    const lat = p.Lat;
    const lng = p.Lng;
    if(typeof lat !== 'number' || typeof lng !== 'number') return;

    const popupHtml = `
      <div style="min-width:180px">
        <div style="font-weight:700;margin-bottom:4px">${safeText(p['Shop Name'])}</div>
        <div style="font-size:12px;color:#556;margin-bottom:8px">${safeText(p.Location2_EN)} (${safeText(p.Location2_KH)})</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="${normUrl(p['Google map']) || googleMapsQueryUrl(lat,lng)}" target="_blank" rel="noopener" style="font-size:12px">Google map</a>
          ${p.Contact ? `<a href="${normUrl(p.Contact)}" target="_blank" rel="noopener" style="font-size:12px">Contact</a>` : ''}
        </div>
      </div>
    `;

    const m = L.marker([lat,lng]).bindPopup(popupHtml);
    m.addTo(markersLayer);
    const key=buildKey(p);
    markerByKey.set(key, m);
    bounds.push([lat,lng]);
  });

  if(bounds.length>=2){
    map.fitBounds(bounds, { padding: [18,18] });
  } else if(bounds.length===1){
    map.setView(bounds[0], 15);
  }
}

function groupPartners(partners){
  // Group by Location1 then Location2; sort groups by count desc
  const byL1 = new Map();
  partners.forEach(p=>{
    const l1 = safeText(p.Location1_EN);
    const l2 = safeText(p.Location2_EN);
    if(!byL1.has(l1)) byL1.set(l1, new Map());
    const m = byL1.get(l1);
    if(!m.has(l2)) m.set(l2, []);
    m.get(l2).push(p);
  });

  // Convert to array with counts
  const l1Arr = Array.from(byL1.entries()).map(([l1, l2map])=>{
    const l2Arr = Array.from(l2map.entries()).map(([l2, items])=>({ l2, items, count: items.length }));
    l2Arr.sort((a,b)=> b.count - a.count || a.l2.localeCompare(b.l2));
    const total = l2Arr.reduce((s,x)=>s+x.count,0);
    return { l1, l2Arr, total };
  });
  l1Arr.sort((a,b)=> b.total - a.total || a.l1.localeCompare(b.l1));
  return l1Arr;
}

function renderList(partners){
  const list=document.getElementById('pm-list');
  list.innerHTML='';

  const grouped = groupPartners(partners);
  // Dynamic numbering: within current filtered set, sorted by (Location1 count desc, Location2 count desc)
  let runningNo=1;

  grouped.forEach(g=>{
    const groupBox=document.createElement('div');
    groupBox.className='pm-group';
    const h=document.createElement('h3');
    h.innerHTML=`<span>${safeText(g.l1)}</span><span>${g.total}</span>`;
    groupBox.appendChild(h);
    list.appendChild(groupBox);

    g.l2Arr.forEach(sub=>{
      const subHeader=document.createElement('div');
      subHeader.style.padding='0 12px 6px 12px';
      subHeader.style.color='#556';
      subHeader.style.fontSize='12px';
      subHeader.textContent=`${safeText(sub.l2)} (${sub.count})`;
      list.appendChild(subHeader);

      sub.items.forEach(p=>{
        const row=document.createElement('div');
        row.className='pm-row';

        const left=document.createElement('div');
        left.className='pm-left';

        const no=document.createElement('div');
        no.className='pm-no';
        no.textContent=String(runningNo++);

        const text=document.createElement('div');
        const name=document.createElement('div');
        name.className='pm-name';
        name.textContent=safeText(p['Shop Name']).replace(/:$/,'');
        const loc=document.createElement('div');
        loc.className='pm-loc';
        loc.textContent=`${safeText(p.Location2_EN)} · ${safeText(p.Location2_KH)}`;
        text.appendChild(name);
        text.appendChild(loc);

        left.appendChild(no);
        left.appendChild(text);

        const actions=document.createElement('div');
        actions.className='pm-actions';

        const mapBtn=document.createElement('button');
        mapBtn.className='pm-btn';
        mapBtn.type='button';
        mapBtn.textContent='Google map';
        mapBtn.addEventListener('click',(e)=>{
          e.stopPropagation();
          const url = normUrl(p['Google map']) || googleMapsQueryUrl(p.Lat, p.Lng);
          if(url) window.open(url, '_blank', 'noopener');
        });

        const contactBtn=document.createElement('button');
        contactBtn.className='pm-btn';
        contactBtn.type='button';
        contactBtn.textContent='Contact';
        contactBtn.disabled = !p.Contact;
        contactBtn.addEventListener('click',(e)=>{
          e.stopPropagation();
          const url = normUrl(p.Contact);
          if(url) window.open(url, '_blank', 'noopener');
        });

        actions.appendChild(mapBtn);
        actions.appendChild(contactBtn);

        row.appendChild(left);
        row.appendChild(actions);

        row.addEventListener('click', ()=>{
          const key=buildKey(p);
          const m=markerByKey.get(key);
          if(m){
            map.setView(m.getLatLng(), 16, { animate: true });
            m.openPopup();
          } else if(typeof p.Lat==='number' && typeof p.Lng==='number'){
            map.setView([p.Lat,p.Lng], 16, { animate: true });
          }
        });

        list.appendChild(row);
      });
    });
  });
}

function applyFilter(){
  const filter=document.getElementById('pm-filter').value;
  const q=document.getElementById('pm-search').value.trim().toLowerCase();

  let filtered = allPartners.slice();
  if(filter!=='ALL'){
    filtered = filtered.filter(p=> safeText(p.Location1_EN)===filter);
  }
  if(q){
    filtered = filtered.filter(p=>{
      const blob = `${safeText(p['Shop Name'])} ${safeText(p.Location1_EN)} ${safeText(p.Location2_EN)} ${safeText(p.Location2_KH)}`.toLowerCase();
      return blob.includes(q);
    });
  }

  renderList(filtered);
  addMarkers(filtered);
}

async function loadPartners(){
  const res = await fetch('data/official_partners.json', { cache: 'no-store' });
  if(!res.ok) throw new Error('Failed to load partners JSON');
  const data = await res.json();

  // normalize coords to numbers
  allPartners = (Array.isArray(data) ? data : []).map(p=>{
    const lat = typeof p.Lat==='string' ? Number(p.Lat) : p.Lat;
    const lng = typeof p.Lng==='string' ? Number(p.Lng) : p.Lng;
    return { ...p, Lat: Number.isFinite(lat)?lat:null, Lng: Number.isFinite(lng)?lng:null };
  });
}

(async function main(){
  initMap();
  await loadPartners();

  document.getElementById('pm-filter').addEventListener('change', applyFilter);
  document.getElementById('pm-search').addEventListener('input', applyFilter);

  applyFilter();
})();
