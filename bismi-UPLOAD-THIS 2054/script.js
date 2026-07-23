// ═══════════════════════════════════════════════════════════
// BISMI TREATS — script.js  (Full Featured)
// ═══════════════════════════════════════════════════════════

// ─── CONSTANTS ───────────────────────────────────────────────
const FLAVOR_NAMES = {
  'morango':'Morango 🍓','chocolate':'Chocolate 🍫','chocolate-branco':'Chocolate Branco 🍫',
  'limao':'Limão 🍋','limao-verde':'Limão Verde 🍋‍🟩 "Intensa"','laranja':'Laranja 🍊',
  'kiwi':'Kiwi 🥝','coco':'Coco 🥥','ananas':'Ananás 🍍','cereja':'Cereja 🍒',
  'manga':'Manga 🥭','framboesa':'Framboesa 🫐','caramel':'Caramel','frutos-vermelhos':'Frutos Vermelhos'
};
const CAKE_TYPE_NAMES = {
  'sponge-chocolate':'Chocolate Sponge Cake','sponge-vanilla':'Sponge Cake Vanilla',
  'sponge-normal':'Sponge Cake Normal','redvelvet':'Red Velvet','tres-leches':'Tres Leches'
};
const CAKE_TYPE_PRICES = {
  'sponge-chocolate':19.99,'sponge-vanilla':19.99,'sponge-normal':19.99,
  'redvelvet':24.99,'tres-leches':19.99
};
const STATUS_LABELS = {
  'pending':'⏳ Pendente','confirmed':'✅ Confirmado','ready':'🎂 Pronto','delivered':'📦 Entregue'
};
const STATUS_COLORS = {
  'pending':'status-pending','confirmed':'status-confirmed','ready':'status-ready','delivered':'status-delivered'
};
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const WEIGHT_OPTIONS = [1.0,1.2,1.3,1.5,1.8,2.0,2.5,3.0,3.5,4.0,4.5,5.0];

const _currentSession = typeof AUTH !== 'undefined' ? AUTH.checkSession() : null;

// ─── STATE ───────────────────────────────────────────────────
let orders = [];
let recycleBin = [];
let customerRequests = [];
let nextOrderNum = 1;
let currentReceiptType = 'confirmation';
let galleryLevel = 'year';
let galleryYear = null;
let galleryMonth = null;
let removeMode = false;
let panelPinned = { dashboard: false, form: false, orders: false };
let reminderInterval = null;
let adminLang = localStorage.getItem('bismiAdminLang') || 'pt';

// ─── HELPERS ─────────────────────────────────────────────────
function getFlavorName(v){ return FLAVOR_NAMES[v]||v||'—'; }
function getCakeTypeName(v){ return CAKE_TYPE_NAMES[v]||v||'—'; }
function getCakeTypePrice(v){ return CAKE_TYPE_PRICES[v]||19.99; }
function formatDate(d){ if(!d) return '—'; const dt=new Date(d+'T00:00:00'); return dt.toLocaleDateString('pt-PT'); }
function formatTime(t){ return t||'—'; }
function formatPrice(n){ return '€'+parseFloat(n||0).toFixed(2); }
function today(){ return new Date().toISOString().split('T')[0]; }
function tomorrow(){ const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; }
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
function showToast(msg, type='success'){
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;top:20px;right:20px;z-index:99999;background:${type==='success'?'#6a9e6a':type==='error'?'#c0544a':'#D4A373'};color:white;padding:12px 20px;border-radius:10px;font-size:0.88rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.2);animation:slideIn .3s ease;max-width:320px`;
  t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// ─── STORAGE ─────────────────────────────────────────────────
function saveData(){
  localStorage.setItem('bismiOrders', JSON.stringify(orders));
  localStorage.setItem('bismiRecycleBin', JSON.stringify(recycleBin));
  localStorage.setItem('bismiNextOrderNum', nextOrderNum);
  fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(orders)}).catch(()=>{});
}
function loadData(){
  try{
    orders=JSON.parse(localStorage.getItem('bismiOrders')||'[]');
    recycleBin=JSON.parse(localStorage.getItem('bismiRecycleBin')||'[]');
    nextOrderNum=parseInt(localStorage.getItem('bismiNextOrderNum')||'1');
    customerRequests=JSON.parse(localStorage.getItem('customerOrders')||'[]');
  }catch(e){ orders=[]; recycleBin=[]; nextOrderNum=1; customerRequests=[]; }
  // Also fetch from MongoDB
  fetch('/api/orders').then(r=>r.json()).then(data=>{
    if(Array.isArray(data)&&data.length>0){
      orders=data;
      try{localStorage.setItem('bismiOrders',JSON.stringify(data));}catch(e){}
      if(typeof renderOrdersList==='function')renderOrdersList();
      if(typeof renderTodayOrders==='function')renderTodayOrders();
    }
  }).catch(()=>{});
  fetch('/api/customer-requests').then(r=>r.json()).then(data=>{
    if(Array.isArray(data)&&data.length>0){
      customerRequests=data;
      try{localStorage.setItem('customerOrders',JSON.stringify(data));}catch(e){}
    }
  }).catch(()=>{});
}
function loadCustomerRequests(){
  customerRequests=JSON.parse(localStorage.getItem('customerOrders')||'[]');
  fetch('/api/customer-requests').then(r=>r.json()).then(data=>{
    if(Array.isArray(data)&&data.length>0){
      const ids=new Set(customerRequests.map(r=>r.id));
      data.forEach(r=>{ if(!ids.has(r.id)) customerRequests.push(r); });
      localStorage.setItem('customerOrders',JSON.stringify(customerRequests));
    }
    updateRequestBadge();
  }).catch(()=>updateRequestBadge());
}

// ─── WEIGHT SELECTS ──────────────────────────────────────────
function populateWeightSelects(minId, maxId){
  const minSel=document.getElementById(minId);
  if(!minSel) return;
  minSel.innerHTML='<option value="">Selecionar...</option>';
  WEIGHT_OPTIONS.forEach(w=>{
    const opt=document.createElement('option');
    opt.value=w.toFixed(1);
    opt.textContent=`${w.toFixed(1)} kg → máx. ${(w+0.3).toFixed(1)} kg`;
    minSel.appendChild(opt);
  });
  const customOpt=document.createElement('option');
  customOpt.value='custom'; customOpt.textContent='✏️ Peso Personalizado';
  minSel.appendChild(customOpt);
  const maxSel=document.getElementById(maxId);
  if(maxSel){
    maxSel.innerHTML='<option value="">Auto (+0.3kg)</option>';
    WEIGHT_OPTIONS.forEach(w=>{
      const opt=document.createElement('option');
      opt.value=w.toFixed(1); opt.textContent=`${w.toFixed(1)} kg`;
      maxSel.appendChild(opt);
    });
  }
}
function populateFinalWeightSelect(){
  const sel=document.getElementById('finalWeightSelect');
  if(!sel) return;
  sel.innerHTML='';
  for(let w=0.5;w<=8.0;w=parseFloat((w+0.1).toFixed(1))){
    const opt=document.createElement('option');
    opt.value=w.toFixed(1); opt.textContent=`${w.toFixed(1)} kg`;
    sel.appendChild(opt);
  }
}

// ─── PRICE CALCULATION ───────────────────────────────────────
function calcPrice(minW, maxW, cakeTypeVal, extraFillingVal, extraProducts){
  const ppkg=getCakeTypePrice(cakeTypeVal);
  const extraFillPrice=extraFillingVal?1.99:0;
  let extraProdTotal=0;
  if(Array.isArray(extraProducts)) extraProducts.forEach(p=>{ extraProdTotal+=parseFloat(p.price||0); });
  const minPrice=(parseFloat(minW)*ppkg+extraFillPrice+extraProdTotal).toFixed(2);
  const maxPrice=(parseFloat(maxW)*ppkg+extraFillPrice+extraProdTotal).toFixed(2);
  return {minPrice,maxPrice,ppkg,extraFillPrice,extraProdTotal};
}
function updatePriceDisplay(){
  const minW=document.getElementById('minWeight').value;
  const cakeType=document.getElementById('cakeType').value;
  const extraFilling=document.getElementById('extraFilling').value;
  const display=document.getElementById('priceDisplay');
  if(!minW||minW==='custom'||!cakeType){ display.style.display='none'; return; }
  const maxW=(parseFloat(minW)+0.3).toFixed(1);
  const {minPrice,maxPrice,ppkg,extraFillPrice}=calcPrice(minW,maxW,cakeType,extraFilling,getExtraProducts());
  display.style.display='block';
  document.getElementById('minPrice').textContent=minPrice;
  document.getElementById('maxPrice').textContent=maxPrice;
  let bd=`${minW}–${maxW}kg × €${ppkg}/kg`;
  if(extraFillPrice>0) bd+=` + €${extraFillPrice.toFixed(2)} recheio extra`;
  const extras=getExtraProducts();
  if(extras.length>0) extras.forEach(p=>{ if(p.price) bd+=` + €${parseFloat(p.price).toFixed(2)} ${p.name||'extra'}`; });
  document.getElementById('priceBreakdown').textContent=bd;
}
function updatePricePerKgDisplay(cakeTypeId, displayId){
  const sel=document.getElementById(cakeTypeId);
  const disp=document.getElementById(displayId);
  if(!sel||!disp) return;
  const val=sel.value;
  if(val&&val!=='add-new'){ disp.textContent=`€${getCakeTypePrice(val).toFixed(2)}/kg`; }
  else { disp.textContent=''; }
}

// ─── EXTRA PRODUCTS ──────────────────────────────────────────
function getExtraProducts(containerId='extraProductsContainer'){
  const container=document.getElementById(containerId);
  if(!container) return [];
  const result=[];
  container.querySelectorAll('.extra-product-item').forEach(item=>{
    const nameInput=item.querySelector('.extra-name');
    const priceInput=item.querySelector('.extra-price');
    if(nameInput&&nameInput.value.trim()){
      result.push({name:nameInput.value.trim(),price:parseFloat(priceInput?.value||0)||0});
    }
  });
  return result;
}
function addExtraProductRow(containerId='extraProductsContainer', name='', price=''){
  const container=document.getElementById(containerId);
  if(!container) return;
  const div=document.createElement('div');
  div.className='extra-product-item';
  div.innerHTML=`
    <input type="text" class="extra-name" placeholder="Nome do produto/serviço" value="${name}"/>
    <input type="number" class="extra-price" placeholder="€0.00" step="0.01" min="0" value="${price}" style="max-width:90px"/>
    <button type="button" class="btn-remove-extra" onclick="this.parentElement.remove();updatePriceDisplay()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(div);
  div.querySelector('.extra-name').addEventListener('input',updatePriceDisplay);
  div.querySelector('.extra-price').addEventListener('input',updatePriceDisplay);
}

// ─── ORDER HELPERS ───────────────────────────────────────────
function getStatusBadgeHtml(status){
  return `<span class="order-status-badge ${STATUS_COLORS[status]||'status-pending'}">${STATUS_LABELS[status]||status}</span>`;
}
function getFlavorDesc(order){
  let desc=getFlavorName(order.baseFlavor);
  if(order.combinationFlavor) desc+=' + '+getFlavorName(order.combinationFlavor);
  if(order.extraFilling) desc+=' c/ recheio extra de '+getFlavorName(order.extraFilling);
  return desc;
}
function getWeightDesc(order){
  if(order.customWeight) return `${order.customMinWeight}–${order.customMaxWeight} kg`;
  if(order.minWeight) return `${order.minWeight}–${(parseFloat(order.minWeight)+0.3).toFixed(1)} kg`;
  return '—';
}
function getPriceDesc(order){
  if(order.finalPrice) return `€${parseFloat(order.finalPrice).toFixed(2)} (final)`;
  if(order.minWeight||order.customWeight){
    const minW=order.customWeight?order.customMinWeight:order.minWeight;
    const maxW=order.customWeight?order.customMaxWeight:(parseFloat(order.minWeight)+0.3).toFixed(1);
    const {minPrice,maxPrice}=calcPrice(minW,maxW,order.cakeType,order.extraFilling,order.extraProducts||[]);
    return `€${minPrice} – €${maxPrice} (estimado)`;
  }
  return '—';
}

// ─── STATUS DROPDOWN IN CARD ──────────────────────────────────
function renderStatusDropdown(orderId, currentStatus){
  const statuses=['pending','confirmed','ready','delivered'];
  return `<select class="status-select-inline" onchange="changeStatusInline(${orderId},this.value)" style="background:var(--card2);border:1.5px solid var(--border);color:var(--text);padding:4px 8px;border-radius:7px;font-size:0.75rem;outline:none;cursor:pointer;font-family:inherit">
    ${statuses.map(s=>`<option value="${s}" ${s===currentStatus?'selected':''}>${STATUS_LABELS[s]}</option>`).join('')}
  </select>`;
}


// ─── ORDER CARD ───────────────────────────────────────────────────────────────

function renderOrderCard(order){
  const flavorDesc=getFlavorDesc(order);
  const weightDesc=getWeightDesc(order);
  const priceDesc=getPriceDesc(order);
  const dateStr=order.orderDate?new Date(order.orderDate+'T00:00:00').toLocaleDateString('pt-PT'):'—';
  const timeStr=order.orderTime||'—';
  const delivLabel=order.deliveryType==='pickup'?'🏪 Recolha':'🚚 Entrega';
  const orderNum=order.orderId||('BT-'+String(order.id).slice(-4).padStart(4,'0'));
  const custId=order.customerId?(' · C-'+String(order.customerId).padStart(3,'0')):'';
  const hasPhotos=order.photos&&order.photos.length>0;
  const photoCount=hasPhotos?order.photos.length:0;
  let extraProductsHtml='';
  if(order.extraProducts&&order.extraProducts.length>0){
    extraProductsHtml=order.extraProducts.map(p=>`<div class="order-info-row"><i class="fas fa-plus-circle"></i><span>${p.name}: <strong>€${parseFloat(p.price||0).toFixed(2)}</strong></span></div>`).join('');
  }
  let chefNoteHtml='';
  if(order.chefNotes) chefNoteHtml=`<div class="chef-note"><i class="fas fa-utensils" style="color:var(--accent);margin-right:4px"></i>${order.chefNotes}</div>`;
  let cakeMessageHtml='';
  if(order.cakeMessage) cakeMessageHtml=`<div class="order-info-row"><i class="fas fa-comment"></i><span>Mensagem: <strong>"${order.cakeMessage}"</strong></span></div>`;

  // Calendar event data
  const calTitle=encodeURIComponent('Bismi Treats - '+order.customerName+' ('+orderNum+')');
  const calDate=order.orderDate?order.orderDate.replace(/-/g,''):'';
  const calTime=order.orderTime?order.orderTime.replace(':','')+'00':'180000';
  const calEnd=order.orderTime?(parseInt(order.orderTime.replace(':','').slice(0,4))+100).toString().padStart(6,'0'):'200000';
  const calDetails=encodeURIComponent(flavorDesc+' | '+weightDesc+' | '+priceDesc);
  const googleCalUrl=calDate?'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+calTitle+'&dates='+calDate+'T'+calTime+'/'+calDate+'T'+calEnd+'&details='+calDetails:'#';

  return `<div class="order-card" id="order-${order.id}">
      <div class="order-card-header">
        <div class="order-header-left">
          <span class="order-number">${orderNum}${custId} — ${order.customerName||'—'}</span>
          ${renderStatusDropdown(order.id, order.status)}
        </div>
        <div class="order-header-right">
          <button class="edit-btn" onclick="openEditModal(${order.id})" title="Editar"><i class="fas fa-edit"></i></button>
        </div>
      </div>
      <div class="order-card-body">
        <div class="order-info-row"><i class="fas fa-birthday-cake"></i><span><strong>${getCakeTypeName(order.cakeType)}</strong></span></div>
        <div class="order-info-row"><i class="fas fa-palette"></i><span>${flavorDesc}</span></div>
        ${cakeMessageHtml}
        <div class="order-info-row"><i class="fas fa-weight"></i><span>${weightDesc}</span></div>
        <div class="order-info-row"><i class="fas fa-tag"></i><span>${priceDesc}</span></div>
        ${extraProductsHtml}
        <div class="order-info-row"><i class="fas fa-calendar"></i><span>${dateStr} ${timeStr!=='—'?'às '+timeStr:''} — ${delivLabel}</span></div>
        ${order.address?`<div class="order-info-row"><i class="fas fa-map-marker-alt"></i><span>${order.address}</span></div>`:''}
        ${order.phone?`<div class="order-info-row"><i class="fas fa-phone"></i><span>${order.phone}</span></div>`:''}
        ${order.paymentMethod?`<div class="order-info-row"><i class="fas fa-credit-card"></i><span>${order.paymentMethod}</span></div>`:''}
        ${chefNoteHtml}
      </div>
      <div class="order-card-actions">
        <button class="btn-action btn-receipt" onclick="openReceipt(${order.id})" title="Recibo"><i class="fas fa-receipt"></i> Recibo</button>
        <button class="btn-action btn-whatsapp-action" onclick="openWhatsAppForOrder(${order.id})" title="WhatsApp"><i class="fab fa-whatsapp"></i> WhatsApp</button>
        <button class="btn-action btn-delivery-msg" onclick="openDeliveryMsg(${order.id})" title="Mensagem de Entrega" style="display:${order.deliveryType==='delivery'?'flex':'none'}"><i class="fas fa-truck"></i> Entrega</button>
        <button class="btn-action btn-calendar" onclick="window.open('${googleCalUrl}','_blank')" title="Adicionar ao Calendário" ${!calDate?'disabled':''} style="${!calDate?'opacity:.4;cursor:not-allowed':''}"><i class="fas fa-calendar-plus"></i> Calendário</button>
        <button class="btn-action btn-history" onclick="showCustomerHistory('${order.customerName||''}','${order.customerId||''}')" title="Histórico do Cliente"><i class="fas fa-history"></i> Histórico</button>
        <button class="btn-action btn-view-photos" onclick="openPhotoManager(${order.id})" title="${hasPhotos?'Ver '+photoCount+' foto(s)':'Adicionar foto'}"><i class="fas fa-camera"></i> ${hasPhotos?'Fotos ('+photoCount+')':'Foto'}</button>
        <button class="btn-action btn-delete-action" onclick="deleteOrder(${order.id})" title="Eliminar" style="background:#ffebee;color:#c62828;border-color:#ffcdd2"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
}

function getSortedOrders(list){
  const statusOrder={'pending':0,'confirmed':1,'ready':2,'delivered':3};
  return [...list].sort((a,b)=>{
    const sa=statusOrder[a.status]||0, sb=statusOrder[b.status]||0;
    if(sa!==sb) return sa-sb;
    const da=a.orderDate||'9999', db=b.orderDate||'9999';
    if(da!==db) return da.localeCompare(db);
    return (a.orderTime||'').localeCompare(b.orderTime||'');
  });
}
function renderOrdersList(){
  const search=(document.getElementById('searchOrders')?.value||'').toLowerCase();
  const statusF=document.getElementById('statusFilter')?.value||'';
  const yearF=document.getElementById('yearFilter')?.value||'';
  let list=orders.filter(o=>{
    if(statusF===''){
      if(o.status==='delivered') return false;
    } else {
      if(o.status!==statusF) return false;
    }
    if(yearF&&o.orderDate&&!o.orderDate.startsWith(yearF)) return false;
    if(search){
      const hay=[o.customerName,o.phone,o.nif,o.orderId,o.baseFlavor,o.cakeType,o.orderDate].join(' ').toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });
  list=getSortedOrders(list);
  const container=document.getElementById('ordersList');
  if(!container) return;
  if(list.length===0){
    container.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma encomenda encontrada</p></div>';
    return;
  }
  container.innerHTML=list.map(o=>renderOrderCard(o)).join('');
}
function populateYearFilters(){
  const years=[...new Set(orders.map(o=>o.orderDate?o.orderDate.substring(0,4):null).filter(Boolean))].sort().reverse();
  ['yearFilter','allOrdersYearFilter'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel) return;
    const cur=sel.value;
    sel.innerHTML='<option value="">Todos os Anos</option>';
    years.forEach(y=>{ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; sel.appendChild(opt); });
    if(cur) sel.value=cur;
  });
  const salesSel=document.getElementById('salesYearSelect');
  if(salesSel){
    const cur=salesSel.value;
    salesSel.innerHTML='';
    const allYears=years.length>0?years:[new Date().getFullYear().toString()];
    allYears.forEach(y=>{ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; salesSel.appendChild(opt); });
    if(cur) salesSel.value=cur;
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────
function updateDashboard(){
  const now=new Date();
  const todayStr=today();
  const tomorrowStr=tomorrow();
  const thisMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const thisMonthOrders=orders.filter(o=>o.orderDate&&o.orderDate.startsWith(thisMonth));
  const todayOrders=orders.filter(o=>o.orderDate===todayStr);
  const tomorrowOrders=orders.filter(o=>o.orderDate===tomorrowStr);
  const futureOrders=orders.filter(o=>o.orderDate&&o.orderDate>todayStr&&o.status!=='delivered');
  let todayRev=0;
  todayOrders.forEach(o=>{
    if(o.finalPrice) todayRev+=parseFloat(o.finalPrice);
    else if(o.minWeight){ const {minPrice}=calcPrice(o.minWeight,(parseFloat(o.minWeight)+0.3).toFixed(1),o.cakeType,o.extraFilling,o.extraProducts||[]); todayRev+=parseFloat(minPrice); }
  });
  document.getElementById('totalOrdersCount').textContent=thisMonthOrders.length;
  document.getElementById('todayOrdersCount').textContent=todayOrders.length;
  document.getElementById('tomorrowOrdersCount').textContent=tomorrowOrders.length;
  document.getElementById('todayRevenue').textContent='€'+todayRev.toFixed(2);
  document.getElementById('futureOrdersCount').textContent=futureOrders.length;
  const agenda=document.getElementById('todayAgenda');
  if(!agenda) return;
  const todaySorted=getSortedOrders(todayOrders);
  if(todaySorted.length===0){ agenda.innerHTML='<div class="empty-agenda">Sem encomendas para hoje 🎉</div>'; return; }
  agenda.innerHTML=todaySorted.map(o=>`
    <div class="agenda-item">
      <div class="agenda-time">${o.orderTime||'—'}</div>
      <div class="agenda-info"><strong>${o.customerName}</strong><div class="agenda-flavor">${getCakeTypeName(o.cakeType)} — ${getFlavorName(o.baseFlavor)}</div></div>
      <span class="agenda-status ${STATUS_COLORS[o.status]||'status-pending'}">${STATUS_LABELS[o.status]||o.status}</span>
    </div>`).join('');
}

// ─── FORM SUBMISSION ─────────────────────────────────────────
// ─── ADMIN PHOTO UPLOAD ──────────────────────────────────────
let adminPhotoData = null;
function initAdminPhotoUpload(){
  const input = document.getElementById('adminPhotoInput');
  const label = document.getElementById('adminPhotoLabel');
  const removeBtn = document.getElementById('adminRemovePhotoBtn');
  if(!input) return;
  input.addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      adminPhotoData=ev.target.result;
      document.getElementById('adminPhotoPreview').src=adminPhotoData;
      document.getElementById('adminPhotoPreviewArea').style.display='block';
      label.style.display='none';
    };
    reader.readAsDataURL(file);
  });
  if(removeBtn) removeBtn.addEventListener('click',()=>{
    adminPhotoData=null;
    document.getElementById('adminPhotoPreview').src='';
    document.getElementById('adminPhotoPreviewArea').style.display='none';
    label.style.display='flex';
    input.value='';
  });
  if(label){
    label.addEventListener('mouseenter',()=>{ label.style.borderColor='var(--accent)'; label.style.color='var(--accent-dark)'; });
    label.addEventListener('mouseleave',()=>{ label.style.borderColor='var(--border)'; label.style.color='var(--text2)'; });
  }
}

function initOrderForm(){
  const form=document.getElementById('orderForm');
  if(!form) return;
  initAdminPhotoUpload();
  const cidInput=document.getElementById('customerId');
  if(cidInput&&!cidInput.value){
    const maxId=orders.reduce((m,o)=>{ const n=parseInt((o.customerId||'C-000').replace(/\D/g,'')); return n>m?n:m; },0);
    cidInput.value='C-'+String(maxId+1).padStart(3,'0');
  }
  const dateInput=document.getElementById('orderDate');
  if(dateInput) dateInput.min=tomorrow();

  document.querySelectorAll('input[name="deliveryType"]').forEach(r=>{
    r.addEventListener('change',e=>{ document.getElementById('addressSection').style.display=e.target.value==='delivery'?'block':'none'; });
  });
  document.querySelectorAll('input[name="deliveryOption"]').forEach(r=>{
    r.addEventListener('change',e=>{
      document.getElementById('scheduledDelivery').style.display=e.target.value==='scheduled'?'grid':'none';
      document.getElementById('expressDelivery').style.display=e.target.value==='express'?'block':'none';
    });
  });
  document.getElementById('baseFlavor').addEventListener('change',e=>{
    const v=e.target.value;
    if(v==='add-new'){ addNewOption('baseFlavor'); return; }
    document.getElementById('combinationSection').style.display=(v==='chocolate'||v==='chocolate-branco')?'flex':'none';
    updatePriceDisplay();
  });
  document.getElementById('combinationFlavor').addEventListener('change',e=>{ if(e.target.value==='add-new') addNewOption('combinationFlavor'); });
  document.getElementById('extraFilling').addEventListener('change',e=>{ if(e.target.value==='add-new'){ addNewOption('extraFilling'); return; } updatePriceDisplay(); });
  document.getElementById('cakeType').addEventListener('change',e=>{
    if(e.target.value==='add-new'){ addNewCakeType(); return; }
    updatePricePerKgDisplay('cakeType','pricePerKgDisplay');
    updatePriceDisplay();
  });
  document.getElementById('minWeight').addEventListener('change',e=>{
    if(e.target.value==='custom'){ document.getElementById('normalWeightSection').style.display='none'; document.getElementById('customWeightSection').style.display='block'; return; }
    updatePriceDisplay();
  });
  document.getElementById('customMinWeight')?.addEventListener('input',updatePriceDisplay);
  document.getElementById('customMaxWeight')?.addEventListener('input',updatePriceDisplay);
  document.getElementById('customWeightBtn').addEventListener('click',()=>{
    const ns=document.getElementById('normalWeightSection');
    const cs=document.getElementById('customWeightSection');
    const isCustom=cs.style.display!=='none';
    ns.style.display=isCustom?'flex':'none';
    cs.style.display=isCustom?'none':'block';
    document.getElementById('customWeightBtn').innerHTML=isCustom?'<i class="fas fa-edit"></i> Peso Personalizado':'<i class="fas fa-list"></i> Peso da Lista';
    updatePriceDisplay();
  });
  document.getElementById('addExtraProductBtn').addEventListener('click',()=>{ addExtraProductRow(); updatePriceDisplay(); });
  form.addEventListener('submit',e=>{ e.preventDefault(); submitOrder(); });
}

function submitOrder(){
  const customerName=document.getElementById('customerName').value.trim();
  if(!customerName){ showToast('Nome do cliente é obrigatório','error'); return; }
  const isCustomWeight=document.getElementById('customWeightSection').style.display!=='none';
  let minW='', maxW='';
  if(isCustomWeight){
    minW=document.getElementById('customMinWeight').value;
    maxW=document.getElementById('customMaxWeight').value;
    if(!minW){ showToast('Insira o peso mínimo','error'); return; }
    if(!maxW) maxW=(parseFloat(minW)+0.3).toFixed(1);
  } else {
    minW=document.getElementById('minWeight').value;
    if(minW&&minW!=='custom') maxW=(parseFloat(minW)+0.3).toFixed(1);
  }
  const deliveryType=document.querySelector('input[name="deliveryType"]:checked')?.value||'';
  const deliveryOption=document.querySelector('input[name="deliveryOption"]:checked')?.value||'';
  const order={
    id:Date.now(),
    orderId:'BT-'+String(nextOrderNum).padStart(4,'0'),
    customerId:document.getElementById('customerId').value.trim(),
    customerName,
    phone:document.getElementById('phone').value.trim(),
    nif:document.getElementById('nif').value.trim(),
    cakeType:document.getElementById('cakeType').value,
    baseFlavor:document.getElementById('baseFlavor').value,
    combinationFlavor:document.getElementById('combinationFlavor').value,
    extraFilling:document.getElementById('extraFilling').value,
    cakeMessage:document.getElementById('cakeMessage').value.trim(),
    chefNotes:document.getElementById('chefNotes').value.trim(),
    minWeight:isCustomWeight?'':minW,
    maxWeight:isCustomWeight?'':maxW,
    customWeight:isCustomWeight,
    customMinWeight:isCustomWeight?minW:'',
    customMaxWeight:isCustomWeight?maxW:'',
    extraProducts:getExtraProducts(),
    deliveryType, deliveryOption,
    address:document.getElementById('address').value.trim(),
    orderDate:deliveryOption==='express'?today():document.getElementById('orderDate').value,
    orderTime:deliveryOption==='express'?document.getElementById('expressTime').value:document.getElementById('orderTime').value,
    expressTime:document.getElementById('expressTime').value,
    paymentMethod:document.getElementById('paymentMethod').value,
    status:document.getElementById('orderStatus').value||'pending',
    createdAt:new Date().toISOString(),
    finalPrice:null, finalWeight:null
  };
  orders.push(order);
  nextOrderNum++;
  // Save admin photo if exists
  if(adminPhotoData){
    try{
      const photos=JSON.parse(localStorage.getItem('bismiPhotos_'+order.id)||'[]');
      photos.push({id:Date.now(),label:'Referência Admin',data:adminPhotoData,type:'reference',uploadedBy:'Admin',uploadedAt:new Date().toISOString()});
      localStorage.setItem('bismiPhotos_'+order.id,JSON.stringify(photos));
    }catch(e){}
    adminPhotoData=null;
    const preview=document.getElementById('adminPhotoPreviewArea');
    const label=document.getElementById('adminPhotoLabel');
    if(preview) preview.style.display='none';
    if(label) label.style.display='flex';
    const input=document.getElementById('adminPhotoInput');
    if(input) input.value='';
  }
  saveData(); renderOrdersList(); updateDashboard(); populateYearFilters();
  document.getElementById('orderForm').reset();
  document.getElementById('combinationSection').style.display='none';
  document.getElementById('addressSection').style.display='none';
  document.getElementById('scheduledDelivery').style.display='none';
  document.getElementById('expressDelivery').style.display='none';
  document.getElementById('priceDisplay').style.display='none';
  document.getElementById('pricePerKgDisplay').textContent='';
  document.getElementById('extraProductsContainer').innerHTML='';
  const maxId=orders.reduce((m,o)=>{ const n=parseInt((o.customerId||'C-000').replace(/\D/g,'')); return n>m?n:m; },0);
  document.getElementById('customerId').value='C-'+String(maxId+1).padStart(3,'0');
  showToast('✅ Encomenda adicionada com sucesso!');
}

// ─── ADD NEW OPTIONS ─────────────────────────────────────────
function addNewOption(selectId){
  const name=prompt('Nome do novo sabor/recheio:');
  if(!name){ document.getElementById(selectId).value=''; return; }
  const val=name.toLowerCase().replace(/\s+/g,'-');
  const sel=document.getElementById(selectId);
  const opt=document.createElement('option'); opt.value=val; opt.textContent=name;
  sel.insertBefore(opt,sel.querySelector('option[value="add-new"]'));
  sel.value=val; FLAVOR_NAMES[val]=name; updatePriceDisplay();
}
function addNewCakeType(){
  const name=prompt('Nome do novo tipo de bolo:');
  if(!name){ document.getElementById('cakeType').value=''; return; }
  const price=parseFloat(prompt('Preço por kg (€):')||'19.99');
  const val=name.toLowerCase().replace(/\s+/g,'-');
  const sel=document.getElementById('cakeType');
  const opt=document.createElement('option'); opt.value=val; opt.textContent=`${name} (€${price.toFixed(2)}/kg)`; opt.dataset.price=price;
  sel.insertBefore(opt,sel.querySelector('option[value="add-new"]'));
  sel.value=val; CAKE_TYPE_NAMES[val]=name; CAKE_TYPE_PRICES[val]=price;
  updatePricePerKgDisplay('cakeType','pricePerKgDisplay'); updatePriceDisplay();
}

// ─── WHATSAPP MESSAGE (NEW FORMAT) ───────────────────────────
function buildWhatsAppFinalMessage(order){
  const orderNum=order.orderId?order.orderId.replace('BT-',''):String(order.id).slice(-3);
  const flavorDesc=getFlavorDesc(order);
  // Check if final price is set
  if(!order.finalPrice||!order.finalWeight){
    return `⚠️ O preço final ainda não foi calculado para esta encomenda.\n\nPor favor marque o estado como "Pronto" para introduzir o peso final e calcular o preço.\n\nEncomenda: #${orderNum} — ${order.customerName}`;
  }
  let extraLines='';
  const extraFillPrice=order.extraFilling?1.99:0;
  if(extraFillPrice>0) extraLines+=`\n• Recheio Extra (${getFlavorName(order.extraFilling)}): €${extraFillPrice.toFixed(2)}`;
  if(order.extraProducts&&order.extraProducts.length>0) order.extraProducts.forEach(p=>{ if(p.name) extraLines+=`\n• ${p.name}: €${parseFloat(p.price||0).toFixed(2)}`; });
  const discount=order.discount>0?`\n• Desconto: -${order.discount}%`:'';
  const baseCakePrice=(parseFloat(order.finalWeight)*parseFloat(order.finalPricePerKg||getCakeTypePrice(order.cakeType))).toFixed(2);
  return `🍰 BISMI TREATS - Recibo Final

Olá ${order.customerName}! 😊

O seu bolo está pronto! Aqui está o recibo final.

📋 DETALHES DA ENCOMENDA
🆔 Encomenda: #${orderNum}
👤 Cliente: ${order.customerName}${order.customerId?' ('+order.customerId+')':''}
📞 Contacto: ${order.phone||'—'}
${order.nif?'🪪 NIF: '+order.nif+'\n':''}
🍰 O SEU BOLO
Tipo: ${getCakeTypeName(order.cakeType)}
Sabor: ${flavorDesc}
${order.cakeMessage?'💬 Mensagem: "'+order.cakeMessage+'"\n':''}
⚖️ PESO & PREÇO FINAL
Peso Final: ${order.finalWeight} kg
Preço/kg: €${parseFloat(order.finalPricePerKg||getCakeTypePrice(order.cakeType)).toFixed(2)}
Bolo Base (${order.finalWeight}kg × €${parseFloat(order.finalPricePerKg||getCakeTypePrice(order.cakeType)).toFixed(2)}): €${baseCakePrice}${extraLines}${discount}

💳 TOTAL FINAL: €${parseFloat(order.finalPrice).toFixed(2)}

🚚 ENTREGA
Tipo: ${order.deliveryType==='pickup'?'Recolha 🏪':'Entrega ao Domicílio 🚚'}
${order.address?'📍 Morada: '+order.address+'\n':''}
💳 Pagamento: ${order.paymentMethod||'—'}

Muito obrigado pela sua confiança! 🙏
━━━━━━━━━━━━━━━━━━━━━
Bismi Treats
Luxury and taste in one bite 💕
📞 934453710
✉️ bismitreats.pt@gmail.com
📸 @bismitreats.pt
🌐 bismitreats.com`;
}

function buildWhatsAppMessage(order){
  const flavorDesc=getFlavorDesc(order);
  const weightDesc=getWeightDesc(order);
  const minW=order.customWeight?order.customMinWeight:order.minWeight;
  const maxW=order.customWeight?order.customMaxWeight:(parseFloat(order.minWeight||0)+0.3).toFixed(1);
  const ppkg=getCakeTypePrice(order.cakeType);
  const extraFillPrice=order.extraFilling?1.99:0;
  let extraProdTotal=0;
  if(order.extraProducts) order.extraProducts.forEach(p=>extraProdTotal+=parseFloat(p.price||0));
  const minPrice=(parseFloat(minW||0)*ppkg+extraFillPrice+extraProdTotal).toFixed(2);
  const maxPrice=(parseFloat(maxW||0)*ppkg+extraFillPrice+extraProdTotal).toFixed(2);
  const baseMinPrice=(parseFloat(minW||0)*ppkg).toFixed(2);
  const baseMaxPrice=(parseFloat(maxW||0)*ppkg).toFixed(2);
  const dateStr=order.deliveryOption==='express'?'Expresso (hoje)':formatDate(order.orderDate);
  const timeStr=order.deliveryOption==='express'?(order.expressTime||'—'):formatTime(order.orderTime);
  const delivLabel=order.deliveryType==='pickup'?'Recolha 🏪':order.deliveryType==='delivery'?'Entrega ao Domicílio 🚚':'—';
  const schedLabel=order.deliveryOption==='express'?'Expresso ⚡':'Agendada 📅';
  const orderNum=order.orderId?order.orderId.replace('BT-',''):String(order.id).slice(-3);

  let extrasSection='';
  const extraLines=[];
  if(extraFillPrice>0) extraLines.push(`• Recheio Extra (${getFlavorName(order.extraFilling)}): +€${extraFillPrice.toFixed(2)}`);
  if(order.extraProducts&&order.extraProducts.length>0) order.extraProducts.forEach(p=>{ if(p.name) extraLines.push(`• ${p.name}: +€${parseFloat(p.price||0).toFixed(2)}`); });
  if(extraLines.length>0) extrasSection=`\n📦 EXTRAS INCLUÍDOS:\n${extraLines.join('\n')}\n`;

  return `🍰 BISMI TREATS - Confirmação de Encomenda

Olá ${order.customerName}! 😊

Muito obrigado por escolher a Bismi Treats! A sua encomenda foi recebida com sucesso.

📋 DETALHES DA ENCOMENDA
🆔 Encomenda: #${orderNum}
👤 Cliente: ${order.customerName}${order.customerId?' ('+order.customerId+')':''}
📞 Contacto: ${order.phone||'—'}
${order.nif?'🪪 NIF: '+order.nif+'\n':''}
🍰 O SEU BOLO
Tipo: ${getCakeTypeName(order.cakeType)}
Sabor: ${flavorDesc}
${order.cakeMessage?'💬 Mensagem no Bolo: "'+order.cakeMessage+'"\n':''}Peso: ${minW}kg - ${maxW}kg
${order.chefNotes?'📝 Nota Chef: '+order.chefNotes+'\n':''}
💰 PREÇOS ESTIMADOS:
Bolo Base (${minW}kg - ${maxW}kg × €${ppkg}): €${baseMinPrice} - €${baseMaxPrice}${extrasSection}
💳 TOTAL ESTIMADO: €${minPrice} - €${maxPrice}

🚚 ENTREGA
Tipo: ${schedLabel} - ${delivLabel}
Data: ${dateStr}
Hora: ${timeStr}
${order.address?'📍 Morada: '+order.address+'\n':''}
💳 Pagamento: ${order.paymentMethod||'—'}

ℹ️ IMPORTANTE:
• O preço final será calculado após a pesagem
• Avisaremos quando estiver pronto para recolha/entrega
• Qualquer dúvida, não hesite em contactar-nos

Muito obrigado pela sua confiança! 🙏
Bismi Treats - Feito com amor e carinho 💕`;
}


function switchWaType(type){
  const orderId=parseInt(document.getElementById('whatsappOrderId').value);
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  document.getElementById('waTypeConfirmation')?.classList.toggle('active',type==='confirmation');
  document.getElementById('waTypeFinal')?.classList.toggle('active',type==='final');
  document.getElementById('whatsappMessageText').textContent = type==='final' ? buildWhatsAppFinalMessage(order) : buildWhatsAppMessage(order);
}
function copyWhatsAppMessage(){
  const msg=document.getElementById('whatsappMessageText').textContent;
  navigator.clipboard.writeText(msg).then(()=>showToast('Mensagem copiada!')).catch(()=>{
    const ta=document.createElement('textarea'); ta.value=msg; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); showToast('Mensagem copiada!');
  });
}
function sendWhatsApp(){
  const orderId=parseInt(document.getElementById('whatsappOrderId').value);
  const order=orders.find(o=>o.id===orderId);
  if(!order||!order.phone){ showToast('Número de telefone não disponível','error'); return; }
  const msg=document.getElementById('whatsappMessageText').textContent;
  const phone=order.phone.replace(/\D/g,'');
  const fullPhone=phone.startsWith('351')?phone:'351'+phone;
  window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`,'_blank');
}

// ─── DELIVERY MESSAGE ────────────────────────────────────────
function openDeliveryMsg(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  document.getElementById('deliveryMsgOrderId').value=orderId;
  document.getElementById('deliveryMsgText').textContent=buildDeliveryMessage(order);
  openModal('deliveryMsgModal');
}
function buildDeliveryMessage(order){
  const priceDesc=getPriceDesc(order);
  return `🌸 Olá ${order.customerName}!

O seu pedido já está a caminho 🚚

📦 Encomenda: ${order.orderId||''}
🎂 ${getCakeTypeName(order.cakeType)} — ${getFlavorName(order.baseFlavor)}
💰 Valor a Pagar: ${priceDesc}
💳 Pagamento: ${order.paymentMethod||'—'}
${order.address?'📍 Morada: '+order.address+'\n':''}
A entrega será feita em aproximadamente 30 minutos ⏱️
O motorista irá partilhar a localização em tempo real.

Obrigado por escolher a Bismi Treats! ❤️`;
}
function copyDeliveryMessage(){
  const msg=document.getElementById('deliveryMsgText').textContent;
  navigator.clipboard.writeText(msg).then(()=>showToast('Mensagem copiada!')).catch(()=>{
    const ta=document.createElement('textarea'); ta.value=msg; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); showToast('Mensagem copiada!');
  });
}
function sendDeliveryWhatsApp(){
  const orderId=parseInt(document.getElementById('deliveryMsgOrderId').value);
  const order=orders.find(o=>o.id===orderId);
  if(!order||!order.phone){ showToast('Número de telefone não disponível','error'); return; }
  const msg=document.getElementById('deliveryMsgText').textContent;
  const phone=order.phone.replace(/\D/g,'');
  const fullPhone=phone.startsWith('351')?phone:'351'+phone;
  window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`,'_blank');
}

// ─── RECEIPT ─────────────────────────────────────────────────
function openReceipt(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  document.getElementById('receiptOrderId').value=orderId;
  currentReceiptType='confirmation';
  document.getElementById('receiptTypeConfirmation').classList.add('active');
  document.getElementById('receiptTypeComplete').classList.remove('active');
  renderReceipt(order,'confirmation');
  openModal('receiptModal');
}
function renderReceipt(order, type){
  const flavorDesc=getFlavorDesc(order);
  const weightDesc=getWeightDesc(order);
  const priceDesc=getPriceDesc(order);
  const dateStr=order.deliveryOption==='express'?'Expresso':formatDate(order.orderDate);
  const timeStr=order.deliveryOption==='express'?(order.expressTime||'—'):formatTime(order.orderTime);
  const delivLabel=order.deliveryType==='pickup'?'Recolha':'Entrega ao Domicílio';
  const minW=order.customWeight?order.customMinWeight:order.minWeight;
  const maxW=order.customWeight?order.customMaxWeight:(parseFloat(order.minWeight||0)+0.3).toFixed(1);
  const ppkg=getCakeTypePrice(order.cakeType);
  const extraFillPrice=order.extraFilling?1.99:0;
  let extraProdTotal=0;
  if(order.extraProducts) order.extraProducts.forEach(p=>extraProdTotal+=parseFloat(p.price||0));
  const minPrice=(parseFloat(minW||0)*ppkg+extraFillPrice+extraProdTotal).toFixed(2);
  const maxPrice=(parseFloat(maxW||0)*ppkg+extraFillPrice+extraProdTotal).toFixed(2);

  let extraProductsRows='';
  if(order.extraProducts&&order.extraProducts.length>0){
    extraProductsRows=order.extraProducts.map(p=>`<div class="rcp-row"><span>${p.name}</span><span>+€${parseFloat(p.price||0).toFixed(2)}</span></div>`).join('');
  }
  let extraFillRow=order.extraFilling?`<div class="rcp-row"><span>Recheio Extra (${getFlavorName(order.extraFilling)})</span><span>+€${extraFillPrice.toFixed(2)}</span></div>`:'';

  let priceSection='';
  if(type==='confirmation'){
    priceSection=`
      <div class="rcp-row"><span>Bolo Base (${minW}–${maxW}kg × €${ppkg})</span><span>€${(parseFloat(minW||0)*ppkg).toFixed(2)} – €${(parseFloat(maxW||0)*ppkg).toFixed(2)}</span></div>
      ${extraFillRow}${extraProductsRows}
      <div class="rcp-total"><span>Total Estimado</span><span>€${minPrice} – €${maxPrice}</span></div>`;
  } else {
    priceSection=`
      <div class="rcp-row"><span>Peso Final</span><span>${order.finalWeight||'—'} kg</span></div>
      <div class="rcp-row"><span>Preço/kg</span><span>€${order.finalPricePerKg||ppkg}</span></div>
      ${extraFillRow}${extraProductsRows}
      ${order.discount>0?`<div class="rcp-row"><span>Desconto</span><span>-${order.discount}%</span></div>`:''}
      <div class="rcp-total"><span>Total Final</span><span>${order.finalPrice?'€'+parseFloat(order.finalPrice).toFixed(2):'—'}</span></div>`;
  }

  // Style 1: Classic (default)
  const classicHtml=`
    <div class="receipt-doc">
      <div class="receipt-header">
        <div class="receipt-logo">🎂</div>
        <h2>Bismi Treats</h2>
        <p>${type==='confirmation'?'Confirmação de Encomenda':'Recibo Final'}</p>
        <p style="font-size:0.75rem;color:#999">${order.orderId||''} · ${new Date().toLocaleDateString('pt-PT')}</p>
      </div>
      <div class="rcp-section-title">Cliente</div>
      <div class="rcp-row"><span>Nome</span><span><strong>${order.customerName}</strong></span></div>
      ${order.phone?`<div class="rcp-row"><span>Telefone</span><span>${order.phone}</span></div>`:''}
      ${order.nif?`<div class="rcp-row"><span>NIF</span><span>${order.nif}</span></div>`:''}
      ${order.customerId?`<div class="rcp-row"><span>ID Cliente</span><span>${order.customerId}</span></div>`:''}
      <div class="rcp-section-title">Encomenda</div>
      <div class="rcp-row"><span>Tipo de Bolo</span><span>${getCakeTypeName(order.cakeType)}</span></div>
      <div class="rcp-row"><span>Sabor</span><span>${flavorDesc}</span></div>
      ${order.cakeMessage?`<div class="rcp-row"><span>Mensagem</span><span>"${order.cakeMessage}"</span></div>`:''}
      <div class="rcp-row"><span>Peso</span><span>${weightDesc}</span></div>
      ${order.chefNotes?`<div class="rcp-row"><span>Nota Chef</span><span>${order.chefNotes}</span></div>`:''}
      <div class="rcp-section-title">Preço</div>
      ${priceSection}
      <div class="rcp-section-title">Entrega</div>
      <div class="rcp-row"><span>Data</span><span>${dateStr}</span></div>
      <div class="rcp-row"><span>Hora</span><span>${timeStr}</span></div>
      <div class="rcp-row"><span>Tipo</span><span>${delivLabel}</span></div>
      ${order.address?`<div class="rcp-row"><span>Morada</span><span>${order.address}</span></div>`:''}
      ${order.paymentMethod?`<div class="rcp-row"><span>Pagamento</span><span>${order.paymentMethod}</span></div>`:''}
      <div class="receipt-footer">❤️ Obrigado por escolher a Bismi Treats!</div>
    </div>`;

  // Style 2: Modern card style
  const modernHtml=`
    <div class="receipt-modern">
      <div class="rcpm-header">
        <div class="rcpm-logo">🎂</div>
        <div class="rcpm-brand">Bismi Treats</div>
        <div class="rcpm-type">${type==='confirmation'?'Confirmação de Encomenda':'Recibo Final'}</div>
        <div style="font-size:0.7rem;opacity:0.85;margin:3px 0">📞 934 453 710 · ✉️ bismitreats.pt@gmail.com</div>
        <div style="font-size:0.7rem;opacity:0.85">🌐 bismitreats.com · 📍 Coimbra, Portugal</div>
        <div class="rcpm-id">${order.orderId||''} · ${new Date().toLocaleDateString('pt-PT')}</div>
      </div>
      <div class="rcpm-body">
        <div class="rcpm-card">
          <div class="rcpm-card-title"><i class="fas fa-user"></i> Cliente</div>
          <div class="rcpm-card-row"><span class="rcpm-label">Nome</span><span class="rcpm-val"><strong>${order.customerName}</strong></span></div>
          ${order.phone?`<div class="rcpm-card-row"><span class="rcpm-label">Telefone</span><span class="rcpm-val">${order.phone}</span></div>`:''}
          ${order.nif?`<div class="rcpm-card-row"><span class="rcpm-label">NIF</span><span class="rcpm-val">${order.nif}</span></div>`:''}
          ${order.customerId?`<div class="rcpm-card-row"><span class="rcpm-label">ID</span><span class="rcpm-val">${order.customerId}</span></div>`:''}
        </div>
        <div class="rcpm-card">
          <div class="rcpm-card-title"><i class="fas fa-birthday-cake"></i> Bolo</div>
          <div class="rcpm-card-row"><span class="rcpm-label">Tipo</span><span class="rcpm-val">${getCakeTypeName(order.cakeType)}</span></div>
          <div class="rcpm-card-row"><span class="rcpm-label">Sabor</span><span class="rcpm-val">${flavorDesc}</span></div>
          ${order.cakeMessage?`<div class="rcpm-card-row"><span class="rcpm-label">Mensagem</span><span class="rcpm-val">"${order.cakeMessage}"</span></div>`:''}
          <div class="rcpm-card-row"><span class="rcpm-label">Peso</span><span class="rcpm-val">${weightDesc}</span></div>
          ${order.chefNotes?`<div class="rcpm-card-row"><span class="rcpm-label">Nota Chef</span><span class="rcpm-val">${order.chefNotes}</span></div>`:''}
        </div>
        <div class="rcpm-card rcpm-price-card">
          <div class="rcpm-card-title"><i class="fas fa-tag"></i> ${type==='confirmation'?'Preço Estimado':'Preço Final'}</div>
          ${type==='confirmation'?`
            <div class="rcpm-card-row"><span class="rcpm-label">Base (${minW}–${maxW}kg × €${ppkg})</span><span class="rcpm-val">€${(parseFloat(minW||0)*ppkg).toFixed(2)} – €${(parseFloat(maxW||0)*ppkg).toFixed(2)}</span></div>
            ${order.extraFilling?`<div class="rcpm-card-row"><span class="rcpm-label">Recheio Extra</span><span class="rcpm-val">+€${extraFillPrice.toFixed(2)}</span></div>`:''}
            ${order.extraProducts&&order.extraProducts.length>0?order.extraProducts.map(p=>`<div class="rcpm-card-row"><span class="rcpm-label">${p.name}</span><span class="rcpm-val">+€${parseFloat(p.price||0).toFixed(2)}</span></div>`).join(''):''}
            <div class="rcpm-total-row"><span>Total Estimado</span><span>€${minPrice} – €${maxPrice}</span></div>
          `:`
            <div class="rcpm-card-row"><span class="rcpm-label">Peso Final</span><span class="rcpm-val">${order.finalWeight||'—'} kg</span></div>
            ${order.discount>0?`<div class="rcpm-card-row"><span class="rcpm-label">Desconto</span><span class="rcpm-val">-${order.discount}%</span></div>`:''}
            <div class="rcpm-total-row"><span>Total Final</span><span>${order.finalPrice?'€'+parseFloat(order.finalPrice).toFixed(2):'—'}</span></div>
          `}
        </div>
        <div class="rcpm-card">
          <div class="rcpm-card-title"><i class="fas fa-truck"></i> Entrega</div>
          <div class="rcpm-card-row"><span class="rcpm-label">Data</span><span class="rcpm-val">${dateStr}</span></div>
          <div class="rcpm-card-row"><span class="rcpm-label">Hora</span><span class="rcpm-val">${timeStr}</span></div>
          <div class="rcpm-card-row"><span class="rcpm-label">Tipo</span><span class="rcpm-val">${delivLabel}</span></div>
          ${order.address?`<div class="rcpm-card-row"><span class="rcpm-label">Morada</span><span class="rcpm-val">${order.address}</span></div>`:''}
          ${order.paymentMethod?`<div class="rcpm-card-row"><span class="rcpm-label">Pagamento</span><span class="rcpm-val">${order.paymentMethod}</span></div>`:''}
        </div>
      </div>
      <div class="rcpm-footer">❤️ Obrigado por escolher a Bismi Treats!</div>
    </div>`;

  

  

  // Store both styles for tab switching
  window._receiptClassic = classicHtml;
  window._receiptModern = modernHtml;

  // Display based on current style selection
  const _currentStyle = (typeof currentReceiptStyle !== 'undefined') ? currentReceiptStyle : 'classic';
  const _finalHtml = _currentStyle === 'modern' ? modernHtml : classicHtml;
  const _rcEl = document.getElementById('receiptContent');
  if(_rcEl) _rcEl.innerHTML = _finalHtml || '';

  // Update tab active state
  try{
    document.getElementById('receiptStyleClassic')?.classList.toggle('active', _currentStyle !== 'modern');
    document.getElementById('receiptStyleModern')?.classList.toggle('active', _currentStyle === 'modern');
  }catch(e){}
}


function printReceipt(size){
  const content=document.getElementById('receiptContent').innerHTML;
  const w=window.open('','_blank');
  const pageSize=size==='a5'?'148mm 210mm':'210mm 297mm';
  const companyFooter=`
    <div style="text-align:center;margin-top:14px;padding-top:10px;border-top:2px solid #D4A373;font-size:${size==='a5'?'9px':'10px'};color:#7a6a58;line-height:1.9">
      <div style="font-family:Georgia,serif;font-size:${size==='a5'?'11px':'13px'};font-weight:700;color:#b5845a;margin-bottom:4px">🎂 Bismi Treats</div>
      <div style="font-style:italic;margin-bottom:6px;color:#9a8a78">Luxury and taste in one bite</div>
      <div>📞 934453710 &nbsp;·&nbsp; ✉️ bismitreats.pt@gmail.com</div>
      <div>📸 @bismitreats.pt &nbsp;·&nbsp; 🌐 bismitreats.com</div>
    </div>`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo Bismi Treats</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
  <style>
    @page{size:${pageSize};margin:8mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Georgia,sans-serif;color:#2c3e50;font-size:${size==='a5'?'10px':'12px'};background:white}
    .receipt-doc{max-width:100%;padding:0}
    .receipt-header{text-align:center;padding-bottom:10px;border-bottom:2px solid #D4A373;margin-bottom:10px}
    .receipt-logo{font-size:1.8rem}
    .receipt-header h2{font-size:1.2rem;color:#b5845a;margin:4px 0;font-family:Georgia,serif}
    .receipt-header p{color:#7f8c8d;font-size:0.78rem;margin:2px 0}
    .rcp-section-title{font-size:0.7rem;font-weight:700;color:#b5845a;text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px;padding-bottom:3px;border-bottom:1px solid #e8d9c0}
    .rcp-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #e8d9c0;font-size:0.8rem;color:#555}
    .rcp-total{display:flex;justify-content:space-between;font-weight:700;font-size:0.95rem;padding-top:5px;border-top:2px solid #D4A373;color:#b5845a;margin-top:4px}
    .receipt-footer{text-align:center;margin-top:10px;font-style:italic;color:#7f8c8d;font-size:0.78rem}
    .receipt-modern{max-width:100%}
    .rcpm-header{background:linear-gradient(135deg,#b5845a,#CB997E);color:white;padding:14px;border-radius:8px;text-align:center;margin-bottom:10px}
    .rcpm-logo{font-size:2rem;margin-bottom:4px}
    .rcpm-brand{font-family:Georgia,serif;font-size:1.2rem;font-weight:700}
    .rcpm-type{font-size:0.8rem;opacity:.85;margin-top:2px}
    .rcpm-id{font-size:0.72rem;opacity:.7;margin-top:2px}
    .rcpm-body{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rcpm-card{background:#FAEDCD;border:1px solid #e8d9c0;border-radius:7px;padding:9px}
    .rcpm-price-card{grid-column:span 2;background:linear-gradient(135deg,#D4A37315,#CB997E10);border-color:#D4A37340}
    .rcpm-card-title{font-size:0.72rem;font-weight:700;color:#b5845a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:flex;align-items:center;gap:5px}
    .rcpm-card-row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted #e8d9c0;font-size:0.78rem}
    .rcpm-label{color:#7a6a58}
    .rcpm-val{color:#3A3A3A;font-weight:500;text-align:right;max-width:55%}
    .rcpm-total-row{display:flex;justify-content:space-between;font-weight:700;font-size:0.9rem;padding-top:5px;border-top:2px solid #D4A373;color:#b5845a;margin-top:4px}
    .rcpm-footer{text-align:center;margin-top:10px;font-style:italic;color:#7f8c8d;font-size:0.78rem;padding-top:8px;border-top:1px solid #e8d9c0}
  </style></head><body>${content}${companyFooter}</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),600);
}

// ─── CALENDAR ────────────────────────────────────────────────
function openCalendarModal(orderId){
  document.getElementById('calendarOrderId').value=orderId;
  openModal('calendarModal');
}
function addToGoogleCalendar(){
  const orderId=parseInt(document.getElementById('calendarOrderId').value);
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  const date=order.orderDate||today();
  const time=order.orderTime||'18:00';
  const dt=date.replace(/-/g,'')+'T'+time.replace(':','')+'00';
  const dtEnd=date.replace(/-/g,'')+'T'+String(parseInt(time.split(':')[0])+1).padStart(2,'0')+time.split(':')[1]+'00';
  const title=encodeURIComponent(`Bismi Treats — ${order.customerName} (${getCakeTypeName(order.cakeType)})`);
  const details=encodeURIComponent(`Encomenda ${order.orderId||''}\nSabor: ${getFlavorDesc(order)}\nPeso: ${getWeightDesc(order)}`);
  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dt}/${dtEnd}&details=${details}`,'_blank');
  closeModal('calendarModal');
}
function addToOutlookCalendar(){
  const orderId=parseInt(document.getElementById('calendarOrderId').value);
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  const date=order.orderDate||today();
  const time=order.orderTime||'18:00';
  const startDt=`${date}T${time}:00`;
  const endHour=String(parseInt(time.split(':')[0])+1).padStart(2,'0');
  const endDt=`${date}T${endHour}:${time.split(':')[1]}:00`;
  const title=encodeURIComponent(`Bismi Treats — ${order.customerName}`);
  window.open(`https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDt}&enddt=${endDt}`,'_blank');
  closeModal('calendarModal');
}

// ─── FINAL WEIGHT ────────────────────────────────────────────
function openFinalWeightModal(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  document.getElementById('finalWeightOrderId').value=orderId;
  populateFinalWeightSelect();
  const ppkg=getCakeTypePrice(order.cakeType);
  document.getElementById('finalPricePerKg').value=ppkg.toFixed(2);
  document.getElementById('finalDiscount').value='0';
  const sel=document.getElementById('finalWeightSelect');
  const targetW=order.minWeight||order.customMinWeight||'1.0';
  for(let i=0;i<sel.options.length;i++){ if(parseFloat(sel.options[i].value)>=parseFloat(targetW)){ sel.selectedIndex=i; break; } }
  updateFinalPrice();
  openModal('finalWeightModal');
}
function confirmFinalWeight(orderId){ openFinalWeightModal(orderId); }

function updateFinalPrice(){
  const w=parseFloat(document.getElementById('finalWeightSelect')?.value||0);
  const ppkg=parseFloat(document.getElementById('finalPricePerKg')?.value||19.99);
  const disc=parseFloat(document.getElementById('finalDiscount')?.value||0);
  const orderId=parseInt(document.getElementById('finalWeightOrderId')?.value||0);
  const order=orders.find(o=>o.id===orderId);
  let extraFillPrice=0;
  if(order&&order.extraFilling) extraFillPrice=1.99;
  let extraProdTotal=0;
  if(order&&order.extraProducts) order.extraProducts.forEach(p=>extraProdTotal+=parseFloat(p.price||0));
  let total=w*ppkg+extraFillPrice+extraProdTotal;
  if(disc>0) total=total*(1-disc/100);
  const disp=document.getElementById('finalPriceDisplay');
  if(disp) disp.textContent='€'+total.toFixed(2);
}


// ─── EDIT ORDER ──────────────────────────────────────────────
function openEditOrder(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  document.getElementById('editOrderId').value=orderId;
  document.getElementById('editCustomerId').value=order.customerId||'';
  document.getElementById('editCustomerName').value=order.customerName||'';
  document.getElementById('editPhone').value=order.phone||'';
  document.getElementById('editNif').value=order.nif||'';
  document.getElementById('editCakeType').value=order.cakeType||'';
  document.getElementById('editBaseFlavor').value=order.baseFlavor||'';
  document.getElementById('editCombinationFlavor').value=order.combinationFlavor||'';
  document.getElementById('editExtraFilling').value=order.extraFilling||'';
  document.getElementById('editCakeMessage').value=order.cakeMessage||'';
  document.getElementById('editChefNotes').value=order.chefNotes||'';
  document.getElementById('editDeliveryType').value=order.deliveryType||'';
  document.getElementById('editDeliveryOption').value=order.deliveryOption||'';
  document.getElementById('editOrderDate').value=order.orderDate||'';
  document.getElementById('editOrderTime').value=order.orderTime||'';
  document.getElementById('editAddress').value=order.address||'';
  document.getElementById('editPaymentMethod').value=order.paymentMethod||'';
  document.getElementById('editOrderStatus').value=order.status||'pending';
  document.getElementById('editScheduledDelivery').style.display=order.deliveryOption==='scheduled'?'grid':'none';
  document.getElementById('editAddressSection').style.display=order.deliveryType==='delivery'?'block':'none';
  populateWeightSelects('editMinWeight','editMaxWeight');
  document.getElementById('editMinWeight').value=order.minWeight||'';
  const container=document.getElementById('editExtraProductsContainer');
  container.innerHTML='';
  if(order.extraProducts) order.extraProducts.forEach(p=>addExtraProductRow('editExtraProductsContainer',p.name,p.price));
  document.getElementById('editDeliveryType').onchange=e=>{ document.getElementById('editAddressSection').style.display=e.target.value==='delivery'?'block':'none'; };
  document.getElementById('editDeliveryOption').onchange=e=>{ document.getElementById('editScheduledDelivery').style.display=e.target.value==='scheduled'?'grid':'none'; };
  openModal('editOrderModal');
}
function initEditOrderForm(){
  const form=document.getElementById('editOrderForm');
  if(!form) return;
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const orderId=parseInt(document.getElementById('editOrderId').value);
    const order=orders.find(o=>o.id===orderId);
    if(!order) return;
    order.customerId=document.getElementById('editCustomerId').value.trim();
    order.customerName=document.getElementById('editCustomerName').value.trim();
    order.phone=document.getElementById('editPhone').value.trim();
    order.nif=document.getElementById('editNif').value.trim();
    order.cakeType=document.getElementById('editCakeType').value;
    order.baseFlavor=document.getElementById('editBaseFlavor').value;
    order.combinationFlavor=document.getElementById('editCombinationFlavor').value;
    order.extraFilling=document.getElementById('editExtraFilling').value;
    order.cakeMessage=document.getElementById('editCakeMessage').value.trim();
    order.chefNotes=document.getElementById('editChefNotes').value.trim();
    order.deliveryType=document.getElementById('editDeliveryType').value;
    order.deliveryOption=document.getElementById('editDeliveryOption').value;
    order.orderDate=document.getElementById('editOrderDate').value;
    order.orderTime=document.getElementById('editOrderTime').value;
    order.address=document.getElementById('editAddress').value.trim();
    order.paymentMethod=document.getElementById('editPaymentMethod').value;
    order.status=document.getElementById('editOrderStatus').value;
    const minW=document.getElementById('editMinWeight').value;
    order.minWeight=minW; order.maxWeight=minW?(parseFloat(minW)+0.3).toFixed(1):'';
    order.extraProducts=getExtraProducts('editExtraProductsContainer');
    saveData(); renderOrdersList(); updateDashboard();
    closeModal('editOrderModal');
    showToast('Encomenda atualizada!');
  });
  document.getElementById('editAddExtraProductBtn').addEventListener('click',()=>addExtraProductRow('editExtraProductsContainer'));
}

// ─── ORDER PHOTO MANAGER ─────────────────────────────────────
function openOrderPhotoManager(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order) return;
  let modal=document.getElementById('orderPhotoManagerModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='orderPhotoManagerModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(58,40,20,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px';
    document.body.appendChild(modal);
  }
  function renderPhotoManager(){
    let photos=[];
    try{ photos=JSON.parse(localStorage.getItem('bismiPhotos_'+orderId)||'[]'); }catch(e){}
    const photosHtml=photos.length===0
      ?'<p style="color:var(--text2);font-size:0.85rem;text-align:center;padding:16px">Sem fotos para esta encomenda</p>'
      :photos.map(p=>`<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <img src="${p.data}" alt="${p.label}" style="width:100%;height:100px;object-fit:cover;cursor:pointer" onclick="document.getElementById('photoViewImg').src='${p.data}';document.getElementById('photoViewModal').classList.add('active')"/>
          <div style="padding:6px 8px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:0.72rem;color:var(--text2)">${p.label||'Foto'}</span>
            <button onclick="deletePhotoFromOrder(${orderId},${p.id})" style="background:none;border:none;color:#c0544a;cursor:pointer;font-size:0.75rem"><i class="fas fa-trash"></i></button>
          </div>
        </div>`).join('');
    modal.innerHTML=`<div style="background:var(--card);border-radius:16px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 20px 60px rgba(212,163,115,0.3)">
      <div style="background:linear-gradient(135deg,var(--card2),#f5e4c0);padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <h3 style="font-size:0.95rem;font-weight:700;color:var(--accent-dark)"><i class="fas fa-camera"></i> Fotos — ${order.orderId||''} · ${order.customerName}</h3>
        <button onclick="document.getElementById('orderPhotoManagerModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text2)">✕</button>
      </div>
      <div style="padding:14px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:12px">${photosHtml}</div>
        <label for="orderPhotoUploadInput" style="display:flex;align-items:center;justify-content:center;gap:7px;padding:10px;background:var(--card2);border:1.5px dashed var(--border);border-radius:8px;cursor:pointer;font-size:0.82rem;color:var(--text2)">
          <i class="fas fa-plus"></i> Adicionar Foto
        </label>
        <input type="file" id="orderPhotoUploadInput" accept="image/*" style="display:none"/>
      </div>
    </div>`;
    document.getElementById('orderPhotoUploadInput').addEventListener('change',e=>{
      const file=e.target.files[0]; if(!file) return;
      const label=prompt('Etiqueta da foto:')||'Referência';
      const reader=new FileReader();
      reader.onload=ev=>{
        try{
          const p=JSON.parse(localStorage.getItem('bismiPhotos_'+orderId)||'[]');
          p.push({id:Date.now(),label,data:ev.target.result,type:'reference',uploadedBy:'Admin',uploadedAt:new Date().toISOString()});
          localStorage.setItem('bismiPhotos_'+orderId,JSON.stringify(p));
        }catch(err){}
        renderPhotoManager();
        renderOrdersList();
        showToast('Foto adicionada!');
      };
      reader.readAsDataURL(file);
      e.target.value='';
    });
  }
  renderPhotoManager();
}
function deletePhotoFromOrder(orderId, photoId){
  if(!confirm('Eliminar esta foto?')) return;
  try{
    const photos=JSON.parse(localStorage.getItem('bismiPhotos_'+orderId)||'[]');
    localStorage.setItem('bismiPhotos_'+orderId,JSON.stringify(photos.filter(p=>String(p.id)!==String(photoId))));
    openOrderPhotoManager(orderId);
    renderOrdersList();
    showToast('Foto eliminada');
  }catch(e){}
}

// ─── DELETE ──────────────────────────────────────────────────
function deleteOrder(orderId){
  if(!confirm('Mover esta encomenda para a reciclagem?')) return;
  const idx=orders.findIndex(o=>o.id===orderId);
  if(idx===-1) return;
  const order=orders.splice(idx,1)[0];
  order.deletedAt=new Date().toISOString();
  recycleBin.push(order);
  saveData(); renderOrdersList(); updateDashboard();
  showToast('Encomenda movida para a reciclagem');
}

// ─── GALLERY ─────────────────────────────────────────────────
function openGallery(){
  galleryLevel='year'; galleryYear=null; galleryMonth=null;
  const now=new Date();
  const yearSel=document.getElementById('galleryYearSelect');
  yearSel.innerHTML='';
  const years=[...new Set(orders.map(o=>o.orderDate?o.orderDate.substring(0,4):null).filter(Boolean))].sort().reverse();
  if(years.length===0) years.push(String(now.getFullYear()));
  years.forEach(y=>{ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; yearSel.appendChild(opt); });
  yearSel.value=String(now.getFullYear());
  document.getElementById('galleryMonthSelect').value='';
  renderGallery();
  openModal('galleryModal');
}
function renderGallery(){
  const year=parseInt(document.getElementById('galleryYearSelect').value)||new Date().getFullYear();
  const monthVal=document.getElementById('galleryMonthSelect').value;
  const content=document.getElementById('galleryContent');
  const title=document.getElementById('galleryTitle');
  if(monthVal===''){
    galleryLevel='year'; galleryYear=year;
    title.textContent=`Calendário — ${year}`;
    content.innerHTML='';
    content.style.gridTemplateColumns='repeat(auto-fill,minmax(130px,1fr))';
    MONTHS_PT.forEach((m,i)=>{
      const monthOrders=orders.filter(o=>o.orderDate&&o.orderDate.startsWith(`${year}-${String(i+1).padStart(2,'0')}`));
      const div=document.createElement('div');
      div.className='gallery-date-card'+(monthOrders.length>0?' has-orders':'');
      div.innerHTML=`<input type="checkbox" class="gallery-checkbox" data-month="${i}"/>
        <div class="gallery-date-label">${m}</div>
        <div class="gallery-order-count ${monthOrders.length>0?'has-orders':''}">${monthOrders.length}</div>
        <div class="gallery-order-label">encomenda${monthOrders.length!==1?'s':''}</div>`;
      div.addEventListener('click',e=>{ if(e.target.type==='checkbox') return; document.getElementById('galleryMonthSelect').value=String(i); renderGallery(); });
      content.appendChild(div);
    });
  } else {
    const month=parseInt(monthVal);
    galleryLevel='month'; galleryYear=year; galleryMonth=month;
    title.textContent=`${MONTHS_PT[month]} ${year}`;
    content.innerHTML='';
    content.style.gridTemplateColumns='repeat(auto-fill,minmax(130px,1fr))';
    const daysInMonth=new Date(year,month+1,0).getDate();
    for(let d=1;d<=daysInMonth;d++){
      const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayOrders=orders.filter(o=>o.orderDate===dateStr);
      const dayName=DAYS_PT[new Date(dateStr+'T00:00:00').getDay()];
      const div=document.createElement('div');
      div.className='gallery-date-card'+(dayOrders.length>0?' has-orders':'');
      div.innerHTML=`<input type="checkbox" class="gallery-checkbox" data-date="${dateStr}"/>
        <div class="gallery-date-label">${d}</div>
        <div class="gallery-day-name">${dayName}</div>
        <div class="gallery-order-count ${dayOrders.length>0?'has-orders':''}">${dayOrders.length}</div>
        <div class="gallery-order-label">encomenda${dayOrders.length!==1?'s':''}</div>`;
      div.addEventListener('click',e=>{ if(e.target.type==='checkbox') return; showDayOrders(dateStr); });
      content.appendChild(div);
    }
  }
}
function showDayOrders(dateStr){
  const dayOrders=getSortedOrders(orders.filter(o=>o.orderDate===dateStr));
  const content=document.getElementById('galleryContent');
  const title=document.getElementById('galleryTitle');
  galleryLevel='day';
  const d=new Date(dateStr+'T00:00:00');
  title.textContent=`${d.getDate()} de ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
  content.innerHTML='';
  content.style.gridTemplateColumns='repeat(auto-fill,minmax(280px,1fr))';
  if(dayOrders.length===0){ content.innerHTML='<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Sem encomendas neste dia</p></div>'; return; }
  dayOrders.forEach(o=>{
    const div=document.createElement('div');
    div.className='gallery-order-card';
    div.innerHTML=`<input type="checkbox" class="gallery-checkbox" data-order-id="${o.id}"/>
      <div class="gallery-order-header"><span class="gallery-order-num">${o.orderId||''}</span><span class="order-status-badge ${STATUS_COLORS[o.status]||'status-pending'}">${STATUS_LABELS[o.status]||o.status}</span></div>
      <div class="gallery-order-name">${o.customerName}</div>
      <div class="gallery-order-flavor">${getCakeTypeName(o.cakeType)} — ${getFlavorName(o.baseFlavor)}</div>
      <div class="gallery-order-time">⏰ ${o.orderTime||'—'} | ${o.deliveryType==='pickup'?'🏪 Recolha':'🚚 Entrega'}</div>
      <div class="gallery-order-price">💰 ${getPriceDesc(o)}</div>`;
    content.appendChild(div);
  });
}
function galleryBack(){
  if(galleryLevel==='day'){ galleryLevel='month'; document.getElementById('galleryMonthSelect').value=String(galleryMonth); renderGallery(); }
  else if(galleryLevel==='month'){ galleryLevel='year'; document.getElementById('galleryMonthSelect').value=''; renderGallery(); }
  else { closeModal('galleryModal'); }
}
function selectAllGallery(){ document.querySelectorAll('#galleryContent .gallery-checkbox').forEach(cb=>cb.checked=true); }
function printSelectedGallery(){
  const checkboxes=document.querySelectorAll('#galleryContent .gallery-checkbox:checked');
  if(checkboxes.length===0){ showToast('Selecione pelo menos um item','error'); return; }
  let ordersToPrint=[];
  checkboxes.forEach(cb=>{
    if(cb.dataset.orderId){ const o=orders.find(x=>x.id===parseInt(cb.dataset.orderId)); if(o) ordersToPrint.push(o); }
    else if(cb.dataset.date){ orders.filter(o=>o.orderDate===cb.dataset.date).forEach(o=>ordersToPrint.push(o)); }
    else if(cb.dataset.month!==undefined){ const m=parseInt(cb.dataset.month); const y=galleryYear||new Date().getFullYear(); orders.filter(o=>o.orderDate&&o.orderDate.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).forEach(o=>ordersToPrint.push(o)); }
  });
  if(ordersToPrint.length===0){ showToast('Nenhuma encomenda para imprimir','error'); return; }
  printOrdersBatch(ordersToPrint);
}
function printOrdersBatch(ordersList){
  const w=window.open('','_blank');
  const pairs=[];
  for(let i=0;i<ordersList.length;i+=2) pairs.push([ordersList[i],ordersList[i+1]||null]);
  const pairHtml=pairs.map(([a,b])=>`
    <div class="pair">
      <div class="order-half">${buildPrintOrderHtml(a)}</div>
      ${b?`<div class="divider"></div><div class="order-half">${buildPrintOrderHtml(b)}</div>`:''}
    </div>`).join('');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bismi Treats — Impressão</title>
  <style>
    @page{size:A4;margin:8mm}
    body{font-family:'Segoe UI',Georgia,sans-serif;color:#2c3e50;font-size:10px}
    .pair{display:flex;gap:0;page-break-after:always;min-height:120mm;border:1px solid #D4A373;border-radius:6px;overflow:hidden}
    .order-half{flex:1;padding:10px}
    .divider{width:2px;background:repeating-linear-gradient(to bottom,#D4A373 0,#D4A373 5px,transparent 5px,transparent 10px)}
    h3{color:#b5845a;font-family:Georgia,serif;margin:0 0 6px;font-size:11px}
    .row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted #e0d0b8;font-size:9px}
    .badge{display:inline-block;padding:2px 6px;border-radius:8px;font-size:8px;font-weight:700;background:#D4A37320;color:#b5845a}
  </style></head><body>${pairHtml}</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}
function buildPrintOrderHtml(order){
  return `<h3>🎂 ${order.orderId||''} — ${order.customerName}</h3>
    <div class="row"><span>Bolo</span><span>${getCakeTypeName(order.cakeType)}</span></div>
    <div class="row"><span>Sabor</span><span>${getFlavorDesc(order)}</span></div>
    ${order.cakeMessage?`<div class="row"><span>Mensagem</span><span>"${order.cakeMessage}"</span></div>`:''}
    ${order.chefNotes?`<div class="row"><span>Nota Chef</span><span>${order.chefNotes}</span></div>`:''}
    <div class="row"><span>Peso</span><span>${getWeightDesc(order)}</span></div>
    <div class="row"><span>Preço</span><span>${getPriceDesc(order)}</span></div>
    <div class="row"><span>Data</span><span>${formatDate(order.orderDate)} ${order.orderTime||''}</span></div>
    <div class="row"><span>Entrega</span><span>${order.deliveryType==='pickup'?'Recolha':'Entrega'}</span></div>
    ${order.address?`<div class="row"><span>Morada</span><span>${order.address}</span></div>`:''}
    ${order.paymentMethod?`<div class="row"><span>Pagamento</span><span>${order.paymentMethod}</span></div>`:''}
    <div style="margin-top:5px"><span class="badge">${STATUS_LABELS[order.status]||order.status}</span></div>`;
}

// ─── ALL ORDERS ──────────────────────────────────────────────
function openAllOrders(){
  populateYearFilters(); renderAllOrders(); openModal('allOrdersModal');
}
function renderAllOrders(){
  const search=(document.getElementById('allOrdersSearch')?.value||'').toLowerCase();
  const statusF=document.getElementById('allOrdersStatusFilter')?.value||'';
  const yearF=document.getElementById('allOrdersYearFilter')?.value||'';
  let list=orders.filter(o=>{
    if(statusF&&o.status!==statusF) return false;
    if(yearF&&o.orderDate&&!o.orderDate.startsWith(yearF)) return false;
    if(search){ const hay=[o.customerName,o.phone,o.nif,o.orderId,o.baseFlavor,o.cakeType,o.orderDate].join(' ').toLowerCase(); if(!hay.includes(search)) return false; }
    return true;
  });
  list=getSortedOrders(list);
  const container=document.getElementById('allOrdersContent');
  if(!container) return;
  const isGrid=document.getElementById('allOrdersGridBtn')?.classList.contains('active');
  if(list.length===0){ container.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma encomenda encontrada</p></div>'; return; }
  container.style.display=isGrid?'grid':'block';
  if(isGrid){ container.style.gridTemplateColumns='repeat(auto-fill,minmax(300px,1fr))'; container.style.gap='12px'; }
  container.innerHTML=list.map(o=>renderOrderCard(o)).join('');
}

// ─── REMAINING ORDERS ────────────────────────────────────────
function openRemainingOrders(){
  const remaining=orders.filter(o=>o.status!=='delivered');
  const sorted=getSortedOrders(remaining);
  document.getElementById('remainingTotal').textContent=remaining.length;
  document.getElementById('remainingPending').textContent=remaining.filter(o=>o.status==='pending').length;
  document.getElementById('remainingConfirmed').textContent=remaining.filter(o=>o.status==='confirmed').length;
  document.getElementById('remainingReady').textContent=remaining.filter(o=>o.status==='ready').length;
  const container=document.getElementById('remainingOrdersList');
  if(sorted.length===0){ container.innerHTML='<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-check-circle" style="color:#6a9e6a"></i><p>Sem encomendas pendentes! 🎉</p></div>'; }
  else { container.innerHTML=sorted.map(o=>renderOrderCard(o)).join(''); }
  openModal('remainingOrdersModal');
}

// ─── CUSTOMER REQUESTS ───────────────────────────────────────
function updateRequestBadge(){
  const unseen=customerRequests.filter(r=>r.status!=='deleted').length;
  const badge=document.getElementById('requestBadge');
  if(badge){ badge.style.display=unseen>0?'block':'none'; badge.textContent=unseen; }
}
function openCustomerRequests(){
  loadCustomerRequests();
  displayCustomerRequests('all');
  openModal('customerRequestsModal');
}
function displayCustomerRequests(filter){
  let list=customerRequests.filter(r=>r.status!=='deleted');
  if(filter==='sent') list=list.filter(r=>r.status==='sent');
  else if(filter==='copied') list=list.filter(r=>r.status==='copied');
  const container=document.getElementById('customerRequestsList');
  if(!container) return;
  if(list.length===0){ container.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><p>Sem pedidos de clientes</p></div>'; return; }
  container.innerHTML=list.map(r=>{
    const dt=new Date(r.submittedAt||r.id);
    const timeStr=dt.toLocaleDateString('pt-PT')+' '+dt.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});
    const statusLabel=r.status==='sent'?'<span style="color:#6a9e6a;font-size:0.75rem;font-weight:600">✅ Enviado</span>':r.status==='copied'?'<span style="color:#5a85b0;font-size:0.75rem;font-weight:600">📋 Copiado</span>':'<span style="color:#c9853a;font-size:0.75rem;font-weight:600">⏳ Pendente</span>';
    return `<div class="request-card">
      <div class="request-header">
        <strong style="color:var(--text)">${r.customerName||'—'}</strong>
        <div style="display:flex;align-items:center;gap:8px">${statusLabel}<span class="request-time">${timeStr}</span></div>
      </div>
      <div class="request-details">
        <span>🎂 ${(typeof getCakeTypeName==='function'?getCakeTypeName(r.cakeType):r.cakeType)||'—'} — ${(typeof getFlavorName==='function'?getFlavorName(r.baseFlavor):r.baseFlavor)||'—'}</span>
        <span>⚖️ ${r.minWeight||'—'}–${r.maxWeight||'—'} kg | 📅 ${formatDate(r.orderDate)||'—'} ${r.orderTime||''}</span>
        <span>📞 ${r.phone||'—'} | 💳 ${r.paymentMethod||'—'} | ${r.deliveryType==='pickup'?'🏪 Recolha':'🚚 Entrega'}</span>
        ${r.cakeMessage?`<span>💬 "${r.cakeMessage}"</span>`:''}
        ${r.address?`<span>📍 ${r.address}</span>`:''}
      </div>
      <div class="request-actions">
        <button class="btn-action btn-view-action" onclick="viewRequestDetail(${r.id})"><i class="fas fa-eye"></i> Ver</button>
        <button class="btn-action btn-insert-action" onclick="insertRequestToForm(${r.id})"><i class="fas fa-plus"></i> Inserir</button>
        <button class="btn-action btn-delete-action" onclick="deleteRequest(${r.id})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}
function viewRequestDetail(reqId){
  const req=customerRequests.find(r=>r.id===reqId);
  if(!req) return;
  document.getElementById('requestDetailId').value=reqId;
  document.getElementById('requestDetailContent').textContent=req.summary||JSON.stringify(req,null,2);
  openModal('requestDetailModal');
}
function insertRequestToForm(reqId){
  const req=customerRequests.find(r=>r.id===reqId);
  if(!req) return;
  document.getElementById('customerName').value=req.customerName||'';
  document.getElementById('phone').value=req.phone||'';
  document.getElementById('nif').value=req.nif||'';
  if(req.cakeType) document.getElementById('cakeType').value=req.cakeType;
  if(req.baseFlavor){ document.getElementById('baseFlavor').value=req.baseFlavor; if(req.baseFlavor==='chocolate'||req.baseFlavor==='chocolate-branco') document.getElementById('combinationSection').style.display='flex'; }
  if(req.combinationFlavor) document.getElementById('combinationFlavor').value=req.combinationFlavor;
  if(req.extraFilling) document.getElementById('extraFilling').value=req.extraFilling;
  if(req.cakeMessage) document.getElementById('cakeMessage').value=req.cakeMessage;
  if(req.chefNotes) document.getElementById('chefNotes').value=req.chefNotes;
  if(req.minWeight) document.getElementById('minWeight').value=req.minWeight;
  if(req.deliveryType){ const radio=document.querySelector(`input[name="deliveryType"][value="${req.deliveryType}"]`); if(radio){ radio.checked=true; document.getElementById('addressSection').style.display=req.deliveryType==='delivery'?'block':'none'; } }
  if(req.address) document.getElementById('address').value=req.address;
  if(req.orderDate) document.getElementById('orderDate').value=req.orderDate;
  if(req.orderTime) document.getElementById('orderTime').value=req.orderTime;
  if(req.paymentMethod) document.getElementById('paymentMethod').value=req.paymentMethod;
  const schedRadio=document.querySelector('input[name="deliveryOption"][value="scheduled"]');
  if(schedRadio){ schedRadio.checked=true; document.getElementById('scheduledDelivery').style.display='grid'; }
  updatePricePerKgDisplay('cakeType','pricePerKgDisplay'); updatePriceDisplay();
  closeModal('customerRequestsModal'); closeModal('requestDetailModal');
  showToast('Dados inseridos no formulário!');
  document.getElementById('formPanel').scrollIntoView({behavior:'smooth'});
}
function deleteRequest(reqId){
  if(!confirm('Mover este pedido para a reciclagem?')) return;
  const req=customerRequests.find(r=>r.id===reqId);
  if(!req) return;
  req.status='deleted'; req.deletedAt=new Date().toISOString();
  recycleBin.push({...req,type:'customer-request'});
  localStorage.setItem('customerOrders',JSON.stringify(customerRequests));
  saveData(); updateRequestBadge(); displayCustomerRequests('all');
  showToast('Pedido movido para a reciclagem');
}

// ─── RECYCLE BIN ─────────────────────────────────────────────
function openRecycleBin(){ renderRecycleBin(); openModal('recycleBinModal'); }
function renderRecycleBin(){
  const container=document.getElementById('recycleBinList');
  if(!container) return;
  if(recycleBin.length===0){ container.innerHTML='<div class="empty-state"><i class="fas fa-trash"></i><p>Reciclagem vazia</p></div>'; return; }
  container.innerHTML=recycleBin.map((item,idx)=>`
    <div class="recycle-item">
      <div class="recycle-info"><strong>${item.customerName||item.orderId||'Item'}</strong><span>${item.type==='customer-request'?'Pedido de Cliente':'Encomenda'} — ${item.deletedAt?new Date(item.deletedAt).toLocaleDateString('pt-PT'):'—'}</span></div>
      <div class="recycle-actions">
        <button class="btn-action btn-restore-action" onclick="restoreFromRecycleBin(${idx})"><i class="fas fa-undo"></i> Restaurar</button>
        <button class="btn-action btn-delete-action" onclick="permanentDelete(${idx})"><i class="fas fa-times"></i></button>
      </div>
    </div>`).join('');
}
function restoreFromRecycleBin(idx){
  const item=recycleBin.splice(idx,1)[0];
  if(item.type==='customer-request'){ item.status='restored'; delete item.deletedAt; customerRequests.push(item); localStorage.setItem('customerOrders',JSON.stringify(customerRequests)); }
  else { delete item.deletedAt; orders.push(item); }
  saveData(); renderRecycleBin(); renderOrdersList(); updateDashboard();
  showToast('Item restaurado!');
}
function permanentDelete(idx){
  if(!confirm('Eliminar permanentemente?')) return;
  recycleBin.splice(idx,1); saveData(); renderRecycleBin();
  showToast('Item eliminado permanentemente');
}
function emptyRecycleBin(){
  if(!confirm('Esvaziar toda a reciclagem? Esta ação é irreversível.')) return;
  recycleBin=[]; saveData(); renderRecycleBin();
  showToast('Reciclagem esvaziada');
}

// ─── MONTHLY SALES ───────────────────────────────────────────
function openMonthlySales(){ populateYearFilters(); const salesSel=document.getElementById('salesYearSelect'); if(salesSel) salesSel.value=String(new Date().getFullYear()); const curMonth=new Date().getMonth(); document.querySelectorAll('.month-checkbox').forEach(cb=>{ cb.checked=parseInt(cb.value)===curMonth; }); renderMonthlySales(); openModal('monthlySalesModal'); }
function renderMonthlySales(){
  const year=document.getElementById('salesYearSelect')?.value||String(new Date().getFullYear());
  const selectedMonths=[...document.querySelectorAll('.month-checkbox:checked')].map(cb=>parseInt(cb.value));
  const container=document.getElementById('monthlySalesContent');
  if(!container) return;
  if(selectedMonths.length===0){ container.innerHTML='<p style="color:var(--text2);text-align:center">Selecione pelo menos um mês</p>'; return; }
  let grandTotal=0; let html='';
  selectedMonths.sort((a,b)=>a-b).forEach(m=>{
    const monthStr=`${year}-${String(m+1).padStart(2,'0')}`;
    const monthOrders=orders.filter(o=>o.orderDate&&o.orderDate.startsWith(monthStr));
    if(monthOrders.length===0) return;
    let monthTotal=0;
    const rows=getSortedOrders(monthOrders).map(o=>{
      const price=o.finalPrice?parseFloat(o.finalPrice):(o.minWeight?parseFloat(calcPrice(o.minWeight,(parseFloat(o.minWeight)+0.3).toFixed(1),o.cakeType,o.extraFilling,o.extraProducts||[]).minPrice):0);
      monthTotal+=price;
      return `<tr><td>${o.orderId||''}</td><td>${o.customerId||'—'}</td><td>${o.customerName}</td><td>${o.phone||'—'}</td><td>${formatDate(o.orderDate)}</td><td>${getCakeTypeName(o.cakeType)}</td><td>${getStatusBadgeHtml(o.status)}</td><td><strong>€${price.toFixed(2)}</strong></td></tr>`;
    }).join('');
    grandTotal+=monthTotal;
    html+=`<div class="sales-month-section"><h4>${MONTHS_PT[m]} ${year} — ${monthOrders.length} encomenda${monthOrders.length!==1?'s':''}</h4>
      <table class="sales-table"><thead><tr><th>ID</th><th>Cliente ID</th><th>Nome</th><th>Telefone</th><th>Data</th><th>Bolo</th><th>Estado</th><th>Preço</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="text-align:right;font-size:0.85rem;color:var(--accent-dark);margin-top:6px;font-weight:600">Total ${MONTHS_PT[m]}: €${monthTotal.toFixed(2)}</div></div>`;
  });
  if(!html) html='<p style="color:var(--text2);text-align:center">Sem encomendas nos meses selecionados</p>';
  else html+=`<div class="sales-grand-total">Total Geral: €${grandTotal.toFixed(2)}</div>`;
  container.innerHTML=html;
}
function exportMonthlySalesPDF(){
  const content=document.getElementById('monthlySalesContent').innerHTML;
  const year=document.getElementById('salesYearSelect')?.value||'';
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório Bismi Treats ${year}</title>
  <style>@page{size:A4;margin:15mm}body{font-family:'Segoe UI',Georgia,sans-serif;color:#2c3e50;font-size:11px}h1{color:#b5845a;font-family:Georgia,serif;text-align:center;margin-bottom:20px}h4{background:#FAEDCD;padding:6px 10px;border-radius:6px;color:#b5845a;border-left:3px solid #D4A373;margin-bottom:6px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th{background:#D4A373;color:white;padding:5px 8px;text-align:left;font-size:10px}td{padding:4px 8px;border-bottom:1px solid #e8d9c0;font-size:10px}.sales-grand-total{font-weight:700;font-size:1rem;text-align:right;margin-top:12px;padding-top:8px;border-top:2px solid #D4A373;color:#b5845a}.order-status-badge{font-size:9px;padding:2px 5px;border-radius:8px}.status-pending{background:#c9853a20;color:#c9853a}.status-confirmed{background:#5a85b020;color:#5a85b0}.status-ready{background:#6a9e6a20;color:#6a9e6a}.status-delivered{background:#9a9a9a20;color:#9a9a9a}</style></head><body>
  <h1>🎂 Bismi Treats — Relatório de Vendas ${year}</h1>${content}</body></html>`);
  w.document.close(); setTimeout(()=>w.print(),500);
}

// ─── EDIT FORM OPTIONS ───────────────────────────────────────
function openEditForm(){ renderEditFormOptions(); openModal('editFormModal'); }
function renderEditFormOptions(){
  const cakeContainer=document.getElementById('editFormCakeTypes');
  const flavorContainer=document.getElementById('editFormFlavors');
  if(!cakeContainer||!flavorContainer) return;
  const cakeSel=document.getElementById('cakeType');
  const cakeOpts=[...cakeSel.options].filter(o=>o.value&&o.value!=='add-new'&&o.value!=='');
  cakeContainer.innerHTML=cakeOpts.map(o=>`<div class="edit-form-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--card2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px"><span style="font-size:0.85rem">${o.textContent}</span>${removeMode?`<button class="btn-action btn-delete-action" onclick="removeFormOption('cakeType','${o.value}')"><i class="fas fa-times"></i></button>`:''}</div>`).join('');
  const flavorSel=document.getElementById('baseFlavor');
  const flavorOpts=[...flavorSel.options].filter(o=>o.value&&o.value!=='add-new'&&o.value!=='');
  flavorContainer.innerHTML=flavorOpts.map(o=>`<div class="edit-form-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--card2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px"><span style="font-size:0.85rem">${o.textContent}</span>${removeMode?`<button class="btn-action btn-delete-action" onclick="removeFormOption('baseFlavor','${o.value}')"><i class="fas fa-times"></i></button>`:''}</div>`).join('');
}
function removeFormOption(selectId, value){
  if(!confirm('Remover esta opção?')) return;
  ['cakeType','baseFlavor','combinationFlavor','extraFilling','editCakeType','editBaseFlavor','editCombinationFlavor','editExtraFilling'].forEach(id=>{ const sel=document.getElementById(id); if(!sel) return; const opt=sel.querySelector(`option[value="${value}"]`); if(opt) opt.remove(); });
  renderEditFormOptions(); showToast('Opção removida');
}

// ─── REMOVE MODE ─────────────────────────────────────────────
function toggleRemoveMode(){
  removeMode=!removeMode;
  const item=document.getElementById('removeModeSettings');
  if(item) item.innerHTML=`<i class="fas fa-minus-circle"></i> ${removeMode?'Desativar':'Ativar'} Modo Remover`;
  showToast(removeMode?'Modo remover ativado':'Modo remover desativado',removeMode?'warning':'success');
  document.getElementById('settingsMenu').classList.remove('open');
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────
function exportData(){
  const data={orders,recycleBin,nextOrderNum,customerRequests,exportedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`bismi-treats-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  showToast('Dados exportados!');
}
function importData(file){
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(data.orders) orders=data.orders;
      if(data.recycleBin) recycleBin=data.recycleBin;
      if(data.nextOrderNum) nextOrderNum=data.nextOrderNum;
      if(data.customerRequests) customerRequests=data.customerRequests;
      saveData(); renderOrdersList(); updateDashboard(); populateYearFilters(); updateRequestBadge();
      showToast('Dados importados com sucesso!');
    }catch(err){ showToast('Erro ao importar dados','error'); }
  };
  reader.readAsText(file);
}

// ─── REMINDERS ───────────────────────────────────────────────
function checkReminders(){
  const enabled=localStorage.getItem('bismiRemindersEnabled')==='true';
  if(!enabled) return;
  const now=new Date();
  orders.forEach(o=>{
    if(!o.orderDate||o.status==='delivered') return;
    const deliveryDt=new Date(o.orderDate+'T'+(o.orderTime||'18:00')+':00');
    const diff=(deliveryDt-now)/1000/60/60;
    const key24=`reminder-24-${o.id}`, key2=`reminder-2-${o.id}`;
    if(diff>0&&diff<=24&&diff>2&&!sessionStorage.getItem(key24)){ sessionStorage.setItem(key24,'1'); showReminderNotification(o,'24h'); }
    if(diff>0&&diff<=2&&!sessionStorage.getItem(key2)){ sessionStorage.setItem(key2,'1'); showReminderNotification(o,'2h'); }
  });
}
function showReminderNotification(order, timeLabel){
  const div=document.createElement('div');
  div.className='reminder-notification';
  div.innerHTML=`<div class="reminder-icon">🔔</div>
    <div class="reminder-body"><strong>Lembrete — ${timeLabel} antes da entrega</strong><p>${order.customerName} — ${getCakeTypeName(order.cakeType)}</p><p>📅 ${formatDate(order.orderDate)} às ${order.orderTime||'—'}</p></div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:1.2rem;padding:4px">✕</button>`;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),10000);
}
function saveReminderSettings(){
  const enabled=document.getElementById('remindersEnabled').checked;
  localStorage.setItem('bismiRemindersEnabled',enabled);
  closeModal('reminderSettingsModal');
  showToast(enabled?'Lembretes ativados!':'Lembretes desativados');
  if(enabled){ if(reminderInterval) clearInterval(reminderInterval); reminderInterval=setInterval(checkReminders,60000); checkReminders(); }
  else { if(reminderInterval) clearInterval(reminderInterval); }
}

// ─── PANEL CONTROLS ──────────────────────────────────────────
function initPanelControls(){
  ['dashboard','form','orders'].forEach(name=>{
    const panel=document.getElementById(name+'Panel');
    const body=document.getElementById(name+'PanelBody');
    const toggleBtn=document.getElementById('toggle'+capitalize(name)+'Btn');
    const pinBtn=document.getElementById('pin'+capitalize(name)+'Btn');
    if(!panel||!body||!toggleBtn) return;
    toggleBtn.addEventListener('click',()=>{
      if(panelPinned[name]) return;
      const isMin=panel.classList.contains('minimized');
      panel.classList.toggle('minimized');
      toggleBtn.innerHTML=isMin?'<i class="fas fa-minus"></i>':'<i class="fas fa-plus"></i>';
      toggleBtn.title=isMin?'Minimizar':'Maximizar';
    });
    if(pinBtn){
      pinBtn.addEventListener('click',()=>{
        panelPinned[name]=!panelPinned[name];
        pinBtn.classList.toggle('pinned',panelPinned[name]);
        pinBtn.title=panelPinned[name]?'Desafixar':'Fixar';
        if(panelPinned[name]){ panel.classList.remove('minimized'); toggleBtn.innerHTML='<i class="fas fa-minus"></i>'; }
      });
    }
  });
}
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

// ─── SETTINGS MENU ───────────────────────────────────────────
function initSettingsMenu(){
  const btn=document.getElementById('settingsBtn');
  const menu=document.getElementById('settingsMenu');
  if(!btn||!menu) return;
  btn.addEventListener('click',e=>{ e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click',()=>menu.classList.remove('open'));
  menu.addEventListener('click',e=>e.stopPropagation());
  document.getElementById('exportDataSettings')?.addEventListener('click',()=>{ exportData(); menu.classList.remove('open'); });
  document.getElementById('importDataSettings')?.addEventListener('click',()=>{ document.getElementById('importFile').click(); menu.classList.remove('open'); });
  document.getElementById('monthlySalesReportSettings')?.addEventListener('click',()=>{ openMonthlySales(); menu.classList.remove('open'); });
  document.getElementById('reminderSettings')?.addEventListener('click',()=>{ document.getElementById('remindersEnabled').checked=localStorage.getItem('bismiRemindersEnabled')==='true'; openModal('reminderSettingsModal'); menu.classList.remove('open'); });
  document.getElementById('recycleBinSettings')?.addEventListener('click',()=>{ openRecycleBin(); menu.classList.remove('open'); });
  document.getElementById('removeModeSettings')?.addEventListener('click',()=>{ toggleRemoveMode(); });
  document.getElementById('editFormSettings')?.addEventListener('click',()=>{ openEditForm(); menu.classList.remove('open'); });
  document.getElementById('profilesSettings')?.addEventListener('click',()=>{ openModal('profilesModal'); if(typeof renderProfilesModal==='function')renderProfilesModal(); menu.classList.remove('open'); });
  document.getElementById('activityLogSettings')?.addEventListener('click',()=>{ openModal('activityLogModal'); if(typeof renderActivityLog==='function')renderActivityLog(); menu.classList.remove('open'); });
  document.getElementById('loginHistorySettings')?.addEventListener('click',()=>{ openModal('loginHistoryModal'); if(typeof renderLoginHistory==='function')renderLoginHistory(); menu.classList.remove('open'); });
  document.getElementById('staffStatsSettings')?.addEventListener('click',()=>{ openModal('staffStatsModal'); if(typeof renderStaffStats==='function')renderStaffStats(); menu.classList.remove('open'); });
  document.getElementById('autoBackupSettings')?.addEventListener('click',()=>{ openModal('backupModal'); menu.classList.remove('open'); });
  document.getElementById('websiteAdminSettings')?.addEventListener('click',()=>{ window.open('catalogue-admin.html','_blank'); menu.classList.remove('open'); });
}

// ─── MODAL CLOSE BUTTONS ─────────────────────────────────────
function initModalCloseButtons(){
  const pairs=[
    ['closeReceiptModal','receiptModal'],['closeWhatsappModal','whatsappModal'],
    ['closeDeliveryMsgModal','deliveryMsgModal'],['closeCalendarModal','calendarModal'],
    ['closeFinalWeightModal','finalWeightModal'],['cancelFinalWeightBtn','finalWeightModal'],
    ['closeEditOrderModal','editOrderModal'],['cancelEditOrderBtn','editOrderModal'],
    ['closeGalleryModal','galleryModal'],['closeAllOrdersModal','allOrdersModal'],
    ['closeRemainingModal','remainingOrdersModal'],['closeCustomerRequestsModal','customerRequestsModal'],
    ['closeRequestDetailModal','requestDetailModal'],['closeRequestDetailBtn','requestDetailModal'],
    ['closeRecycleBinModal','recycleBinModal'],['closeEditFormModal','editFormModal'],
    ['closeEditFormBtn','editFormModal'],['closeMonthlySalesModal','monthlySalesModal'],
    ['closeReminderSettingsModal','reminderSettingsModal'],['cancelReminderBtn','reminderSettingsModal'],
  ];
  pairs.forEach(([btnId,modalId])=>{ const btn=document.getElementById(btnId); if(btn) btn.addEventListener('click',()=>closeModal(modalId)); });
  document.querySelectorAll('.modal-overlay').forEach(overlay=>{ overlay.addEventListener('click',e=>{ if(e.target===overlay) overlay.classList.remove('active'); }); });
}

// ─── RECEIPT BUTTONS ─────────────────────────────────────────
function initReceiptButtons(){
  // Type tabs
  document.getElementById('receiptTypeConfirmation')?.addEventListener('click',()=>{
    currentReceiptType='confirmation';
    document.getElementById('receiptTypeConfirmation').classList.add('active');
    document.getElementById('receiptTypeComplete').classList.remove('active');
    const orderId=parseInt(document.getElementById('receiptOrderId').value);
    const order=orders.find(o=>o.id===orderId);
    if(order) renderReceipt(order,'confirmation');
  });
  document.getElementById('receiptTypeComplete')?.addEventListener('click',()=>{
    currentReceiptType='complete';
    document.getElementById('receiptTypeComplete').classList.add('active');
    document.getElementById('receiptTypeConfirmation').classList.remove('active');
    const orderId=parseInt(document.getElementById('receiptOrderId').value);
    const order=orders.find(o=>o.id===orderId);
    if(order) renderReceipt(order,'complete');
  });
  // Style tabs
  document.getElementById('receiptStyleClassic')?.addEventListener('click',()=>{
    document.getElementById('receiptStyleClassic').classList.add('active');
    document.getElementById('receiptStyleModern').classList.remove('active');
    document.getElementById('receiptContent').innerHTML=window._receiptClassic||'';
  });
  document.getElementById('receiptStyleModern')?.addEventListener('click',()=>{
    document.getElementById('receiptStyleModern').classList.add('active');
    document.getElementById('receiptStyleClassic').classList.remove('active');
    document.getElementById('receiptContent').innerHTML=window._receiptModern||'';
  });
  document.getElementById('printA4Btn')?.addEventListener('click',()=>printReceipt('a4'));
  document.getElementById('printA5Btn')?.addEventListener('click',()=>printReceipt('a5'));
}

// ─── OTHER BUTTON INITS ──────────────────────────────────────
function initWhatsAppButtons(){
  document.getElementById('copyWhatsappBtn')?.addEventListener('click',copyWhatsAppMessage);
  document.getElementById('sendWhatsappBtn')?.addEventListener('click',sendWhatsApp);
  document.getElementById('copyDeliveryMsgBtn')?.addEventListener('click',copyDeliveryMessage);
  document.getElementById('sendDeliveryMsgBtn')?.addEventListener('click',sendDeliveryWhatsApp);
}
function initCalendarButtons(){
  document.getElementById('googleCalendarBtn')?.addEventListener('click',addToGoogleCalendar);
  document.getElementById('outlookCalendarBtn')?.addEventListener('click',addToOutlookCalendar);
}
function initFinalWeightButtons(){
  document.getElementById('confirmFinalWeightBtn')?.addEventListener('click',confirmFinalWeight);
  document.querySelectorAll('.discount-btn').forEach(btn=>{ btn.addEventListener('click',()=>{ document.getElementById('finalDiscount').value=btn.dataset.discount; updateFinalPrice(); }); });
  document.getElementById('finalWeightSelect')?.addEventListener('change',updateFinalPrice);
  document.getElementById('finalPricePerKg')?.addEventListener('input',updateFinalPrice);
  document.getElementById('finalDiscount')?.addEventListener('input',updateFinalPrice);
}
function initGalleryButtons(){
  document.getElementById('galleryBackBtn')?.addEventListener('click',galleryBack);
  document.getElementById('selectAllGallery')?.addEventListener('click',selectAllGallery);
  document.getElementById('printSelectedGallery')?.addEventListener('click',printSelectedGallery);
  document.getElementById('galleryYearSelect')?.addEventListener('change',renderGallery);
  document.getElementById('galleryMonthSelect')?.addEventListener('change',renderGallery);
}
function initAllOrdersButtons(){
  document.getElementById('allOrdersGridBtn')?.addEventListener('click',()=>{ document.getElementById('allOrdersGridBtn').classList.add('active'); document.getElementById('allOrdersListBtn').classList.remove('active'); renderAllOrders(); });
  document.getElementById('allOrdersListBtn')?.addEventListener('click',()=>{ document.getElementById('allOrdersListBtn').classList.add('active'); document.getElementById('allOrdersGridBtn').classList.remove('active'); renderAllOrders(); });
  document.getElementById('allOrdersSearch')?.addEventListener('input',renderAllOrders);
  document.getElementById('allOrdersStatusFilter')?.addEventListener('change',renderAllOrders);
  document.getElementById('allOrdersYearFilter')?.addEventListener('change',renderAllOrders);
}
function initCustomerRequestsButtons(){
  document.getElementById('customerRequestsBtn')?.addEventListener('click',openCustomerRequests);
  document.getElementById('requestFilterTabs')?.addEventListener('click',e=>{ const tab=e.target.closest('.req-tab'); if(!tab) return; document.querySelectorAll('#requestFilterTabs .req-tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); displayCustomerRequests(tab.dataset.filter); });
  document.getElementById('insertRequestBtn')?.addEventListener('click',()=>{ const reqId=parseInt(document.getElementById('requestDetailId').value); insertRequestToForm(reqId); });
}
function initMonthlySalesButtons(){
  document.getElementById('selectAllMonthsBtn')?.addEventListener('click',()=>{ document.querySelectorAll('.month-checkbox').forEach(cb=>cb.checked=true); renderMonthlySales(); });
  document.getElementById('exportSalesPDFBtn')?.addEventListener('click',exportMonthlySalesPDF);
  document.getElementById('salesYearSelect')?.addEventListener('change',renderMonthlySales);
  document.querySelectorAll('.month-checkbox').forEach(cb=>cb.addEventListener('change',renderMonthlySales));
}
function initRecycleBinButtons(){ document.getElementById('emptyRecycleBinBtn')?.addEventListener('click',emptyRecycleBin); }
function initTopbarButtons(){
  document.getElementById('viewRemainingOrdersBtn')?.addEventListener('click',openRemainingOrders);
  document.getElementById('galleryViewBtn')?.addEventListener('click', openBusinessCalendar);
  document.getElementById('viewAllOrdersBtn')?.addEventListener('click',openAllOrders);
  // Logout button - backup listener
  document.getElementById('adminLogoutBtn')?.addEventListener('click',function(){
    if(confirm('Terminar sessão?')){ AUTH.logout(); window.location.href='login.html'; }
  });
}
function initSearchAndFilter(){
  document.getElementById('searchOrders')?.addEventListener('input',renderOrdersList);
  document.getElementById('statusFilter')?.addEventListener('change',renderOrdersList);
  document.getElementById('yearFilter')?.addEventListener('change',renderOrdersList);
}
function initImportFile(){ document.getElementById('importFile')?.addEventListener('change',e=>{ if(e.target.files[0]) importData(e.target.files[0]); }); }

// ─── SYNC ────────────────────────────────────────────────────
function syncFromServer(){
  // Load orders from MongoDB (primary source)
  fetch('/api/orders').then(r=>r.json()).then(data=>{
    if(Array.isArray(data)&&data.length>0){
      // MongoDB is authoritative - replace local orders with server data
      orders=data;
      // Update localStorage cache
      try{localStorage.setItem('bismiOrders',JSON.stringify(orders));}catch(e){}
      // Update nextOrderNum
      const maxNum=orders.reduce((m,o)=>Math.max(m,parseInt(o.orderNum||o.id||0)),0);
      if(maxNum>=nextOrderNum){nextOrderNum=maxNum+1;localStorage.setItem('bismiNextOrderNum',nextOrderNum);}
      renderOrdersList();updateDashboard();populateYearFilters();
    }
  }).catch(()=>{});
  // Load customer requests from MongoDB
  fetch('/api/customer-requests').then(r=>r.json()).then(data=>{
    if(Array.isArray(data)&&data.length>0){
      customerRequests=data;
      try{localStorage.setItem('customerOrders',JSON.stringify(customerRequests));}catch(e){}
      loadCustomerRequests();
    }
  }).catch(()=>{});
}

function openPhotoManager(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order)return;
  openModal('photoManagerModal');
  const container=document.getElementById('photoManagerContent');
  if(!container)return;
  const photos=order.photos||[];
  container.innerHTML=photos.length?
    photos.map((p,i)=>`<div style="position:relative;display:inline-block;margin:4px"><img src="${p}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)"/><button onclick="removeOrderPhoto(${orderId},${i})" style="position:absolute;top:2px;right:2px;background:rgba(198,40,40,.9);color:white;border:none;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:.6rem">✕</button></div>`).join('')
    :'<div style="color:var(--text2);text-align:center;padding:20px">Sem fotos. Adicione uma foto abaixo.</div>';
  document.getElementById('photoOrderId').value=orderId;
}
function removeOrderPhoto(orderId,photoIdx){
  const order=orders.find(o=>o.id===orderId);
  if(!order||!order.photos)return;
  order.photos.splice(photoIdx,1);
  saveData();
  openPhotoManager(orderId);
}

function openEditModal(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order)return;
  // Populate edit form
  const fields={
    editCustomerId:order.customerId||'',editCustomerName:order.customerName||'',
    editPhone:order.phone||'',editNif:order.nif||'',editCakeType:order.cakeType||'',
    editBaseFlavor:order.baseFlavor||'',editCombinationFlavor:order.combinationFlavor||'',
    editExtraFilling:order.extraFilling||'',editCakeMessage:order.cakeMessage||'',
    editChefNotes:order.chefNotes||'',editOrderDate:order.orderDate||'',
    editOrderTime:order.orderTime||'',editPaymentMethod:order.paymentMethod||'',
    editDeliveryAddress:order.address||''
  };
  Object.entries(fields).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val;});
  document.getElementById('editOrderId').value=orderId;
  const delType=order.deliveryType||'pickup';
  document.querySelectorAll('input[name="editDeliveryType"]').forEach(r=>{r.checked=r.value===delType;});
  const schedType=order.scheduleType||'scheduled';
  document.querySelectorAll('input[name="editDeliveryOption"]').forEach(r=>{r.checked=r.value===schedType;});
  openModal('editOrderModal');
}

function changeStatusInline(orderId,newStatus){
  const order=orders.find(o=>o.id===orderId);
  if(!order)return;
  const oldStatus=order.status;
  if(newStatus==='ready'&&oldStatus!=='ready'){
    const finalW=prompt('Peso final do bolo (kg):');
    if(finalW){
      order.finalWeight=parseFloat(finalW);
      const ppkg=order.pricePerKg||19.99;
      const extraFillPrice=order.extraFilling?1.99:0;
      let extraProd=0;
      if(order.extraProducts)order.extraProducts.forEach(p=>extraProd+=parseFloat(p.price||0));
      order.finalPrice=((order.finalWeight*ppkg)+extraFillPrice+extraProd).toFixed(2);
    }
  }
  order.status=newStatus;
  logActivity(orderId,'Status alterado para '+newStatus);
  saveData();
  renderOrdersList();
  renderDashboard();
}

// ── MISSING FUNCTIONS (stub implementations) ──────────────────

function uploadOrderPhoto(input){
  const orderId=parseInt(document.getElementById('photoOrderId').value);
  const order=orders.find(o=>o.id===orderId);
  if(!order)return;
  if(!order.photos)order.photos=[];
  Array.from(input.files).forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      order.photos.push(e.target.result);
      saveData();
      openPhotoManager(orderId);
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function openOrderHistory(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order)return;
  const history=order.activityLog||[];
  const content=history.length?
    history.map(function(h){
      const dt=new Date(h.timestamp||h.time||Date.now());
      const timeStr=dt.toLocaleString('pt-PT');
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.82rem"><strong>'+(h.action||h.type||'Ação')+'</strong><br/><span style="color:var(--text2)">'+timeStr+' — '+(h.details||h.user||'')+'</span></div>';
    }).join('')
    :'<div style="color:var(--text2);text-align:center;padding:20px">Sem histórico para esta encomenda.</div>';
  let modal=document.getElementById('orderHistoryModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='orderHistoryModal';
    modal.className='modal-overlay';
    const inner=document.createElement('div');
    inner.className='modal-container';
    inner.style.maxWidth='500px';
    const hdr=document.createElement('div');hdr.className='modal-header';
    hdr.innerHTML='<h3>Histórico da Encomenda</h3>';
    const closeBtn=document.createElement('button');closeBtn.className='modal-close';closeBtn.innerHTML='<i class="fas fa-times"></i>';closeBtn.onclick=function(){closeModal('orderHistoryModal');};
    hdr.appendChild(closeBtn);
    const bdy=document.createElement('div');bdy.className='modal-body';bdy.id='orderHistoryContent';
    const ftr=document.createElement('div');ftr.className='modal-footer';
    const closeBtn2=document.createElement('button');closeBtn2.className='btn-secondary';closeBtn2.textContent='Fechar';closeBtn2.onclick=function(){closeModal('orderHistoryModal');};
    ftr.appendChild(closeBtn2);
    inner.appendChild(hdr);inner.appendChild(bdy);inner.appendChild(ftr);
    modal.appendChild(inner);
    document.body.appendChild(modal);
  }
  const contentEl=document.getElementById('orderHistoryContent');
  if(contentEl)contentEl.innerHTML=content;
  openModal('orderHistoryModal');
}


function setBizCalMonth(year,month){
  if(typeof renderBusinessCalendar==='function')renderBusinessCalendar(year,month);
}


function deleteProfileConfirm(profileId){
  if(confirm('Tem a certeza que quer eliminar este perfil?')){
    if(typeof AUTH!=='undefined'&&AUTH.deleteProfile)AUTH.deleteProfile(profileId);
    if(typeof renderProfilesModal==='function')renderProfilesModal();
  }
}

function editProfilePin(profileId){
  const newPin=prompt('Novo PIN (mínimo 4 dígitos):');
  if(newPin&&newPin.length>=4){
    if(typeof AUTH!=='undefined'&&AUTH.updateProfile)AUTH.updateProfile(profileId,{pin:newPin});
    showToast('PIN atualizado!','success');
  }
}

function toggleProfileActive(profileId,active){
  if(typeof AUTH!=='undefined'&&AUTH.updateProfile)AUTH.updateProfile(profileId,{active:active});
  if(typeof renderProfilesModal==='function')renderProfilesModal();
}

function viewGalleryPhoto(src,caption){
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.innerHTML='<div style="text-align:center"><img src="'+src+'" style="max-width:90vw;max-height:80vh;border-radius:8px"/><div style="color:white;margin-top:8px;font-size:.9rem">'+(caption||'')+'</div></div>';
  overlay.addEventListener('click',()=>overlay.remove());
  document.body.appendChild(overlay);
}

function openWhatsAppForOrder(orderId){
  const order=orders.find(o=>o.id===orderId);
  if(!order)return;
  // Set current order for WhatsApp modal
  if(typeof currentOrderForWhatsApp!=='undefined')currentOrderForWhatsApp=orderId;
  // Try to open WhatsApp modal
  const modal=document.getElementById('whatsappModal');
  if(modal){
    // Store order ID
    const waOrderId=document.getElementById('whatsappOrderId');
    if(waOrderId) waOrderId.value=orderId;
    // Populate WhatsApp message with correct element ID
    const msgEl=document.getElementById('whatsappMessageText')||document.getElementById('whatsappMessage')||document.getElementById('whatsappConfirmMsg');
    if(msgEl&&typeof buildWhatsAppMessage==='function') msgEl.value=buildWhatsAppMessage(order);
    // Reset to confirmation tab
    document.getElementById('waTypeConfirmation')?.classList.add('active');
    document.getElementById('waTypeFinal')?.classList.remove('active');
    openModal('whatsappModal');
  } else {
    // Fallback: open WhatsApp directly
    const msg=typeof buildWhatsAppMessage==='function'?buildWhatsAppMessage(order):'Olá! Encomenda #'+order.id;
    window.open('https://wa.me/351934453710?text='+encodeURIComponent(msg),'_blank');
  }
}

// ── DASHBOARD & ACTIVITY FUNCTIONS ──────────────────────────
function renderDashboard(){
  try{
    const now=new Date();
    const todayStr=now.toISOString().split('T')[0];
    const tomorrowStr=new Date(now.getTime()+86400000).toISOString().split('T')[0];
    const thisMonth=now.getFullYear()+'-'+(now.getMonth()+1).toString().padStart(2,'0');
    
    const activeOrders=orders.filter(o=>o.status!=='delivered');
    const todayOrders=activeOrders.filter(o=>o.orderDate===todayStr);
    const tomorrowOrders=activeOrders.filter(o=>o.orderDate===tomorrowStr);
    const monthOrders=orders.filter(o=>o.orderDate&&o.orderDate.startsWith(thisMonth));
    const revenue=todayOrders.reduce((s,o)=>s+(parseFloat(o.finalPrice||0)||0),0);
    
    const setEl=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    setEl('dashThisMonth',monthOrders.length);
    setEl('dashToday',todayOrders.length);
    setEl('dashTomorrow',tomorrowOrders.length);
    setEl('dashRevenue','€'+revenue.toFixed(2));
    setEl('dashFuture',activeOrders.filter(o=>o.orderDate>todayStr).length);
    
    renderTodayOrders();
  }catch(e){console.error('renderDashboard error:',e);}
}

function renderTodayOrders(){
  try{
    const todayStr=new Date().toISOString().split('T')[0];
    const todayOrders=orders.filter(o=>o.orderDate===todayStr&&o.status!=='delivered');
    const container=document.getElementById('todayAgenda');
    if(!container)return;
    if(!todayOrders.length){
      container.innerHTML='<div class="empty-agenda">Sem encomendas para hoje</div>';
      return;
    }
    container.innerHTML=todayOrders.map(o=>{
      const timeStr=o.orderTime||'—';
      const statusLabel=STATUS_LABELS[o.status]||o.status;
      return '<div class="agenda-item"><span class="agenda-time">'+timeStr+'</span><span class="agenda-name">'+o.customerName+'</span><span class="agenda-status status-'+o.status+'">'+statusLabel+'</span></div>';
    }).join('');
  }catch(e){console.error('renderTodayOrders error:',e);}
}

function logActivity(orderId,action,details){
  try{
    const order=orders.find(o=>o.id===orderId);
    if(!order)return;
    if(!order.activityLog)order.activityLog=[];
    const session=typeof AUTH!=='undefined'?AUTH.checkSession():null;
    order.activityLog.push({
      timestamp:new Date().toISOString(),
      action:action||'Ação',
      details:details||'',
      user:session?session.name:'Sistema',
      role:session?session.role:'system'
    });
    // Keep last 50 entries
    if(order.activityLog.length>50)order.activityLog=order.activityLog.slice(-50);
  }catch(e){}
}

// ─── INIT ────────────────────────────────────────────────────

// ── BUSINESS CALENDAR (3-level: Year → Month → Day) ──────────────────────
function openBusinessCalendar(){
  var modal=document.getElementById('businessCalModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='businessCalModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(58,40,20,.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:12px';
    var inner=document.createElement('div');
    inner.id='businessCalInner';
    inner.style.cssText='background:var(--card);border-radius:16px;width:100%;max-width:860px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(212,163,115,0.35)';
    modal.appendChild(inner);
    modal.addEventListener('click',function(e){if(e.target===modal)closeBusinessCalendar();});
    inner.addEventListener('click',function(e){
      if(e.target.matches('input,button,select,option')) return;
      var el=e.target.closest('[data-biz-date]');
      if(el){renderBizCalDay(el.dataset.bizDate);return;}
      el=e.target.closest('[data-biz-month]');
      if(el&&el.dataset.bizMonth!==undefined){renderBizCalMonth(parseInt(el.dataset.bizYear),parseInt(el.dataset.bizMonth));return;}
      el=e.target.closest('[data-biz-year]');
      if(el&&!el.dataset.bizMonth){renderBizCalYear(parseInt(el.dataset.bizYear));return;}
    });
    document.body.appendChild(modal);
  }
  modal.style.display='flex';
  renderBizCalYear(new Date().getFullYear());
}
function closeBusinessCalendar(){
  var m=document.getElementById('businessCalModal');
  if(m)m.style.display='none';
}
function bizCalSetHeader(title,year,month){
  var inner=document.getElementById('businessCalInner'); if(!inner)return;
  var monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var hdr=document.createElement('div');
  hdr.style.cssText='background:linear-gradient(135deg,var(--card2),#f5e4c0);padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0';
  var titleEl=document.createElement('span');
  titleEl.style.cssText='font-weight:800;color:var(--accent-dark);font-size:.95rem;flex:1;min-width:120px';
  titleEl.textContent='📅 '+title;
  hdr.appendChild(titleEl);
  var ySel=document.createElement('select');
  ySel.style.cssText='padding:5px 8px;border:1.5px solid var(--border);border-radius:7px;background:var(--card);color:var(--text);font-size:.8rem;cursor:pointer';
  for(var y=2024;y<=2028;y++){var opt=document.createElement('option');opt.value=y;opt.textContent=y;if(y===year)opt.selected=true;ySel.appendChild(opt);}
  ySel.addEventListener('change',function(){renderBizCalYear(parseInt(this.value));});
  hdr.appendChild(ySel);
  var mSel=document.createElement('select');
  mSel.style.cssText='padding:5px 8px;border:1.5px solid var(--border);border-radius:7px;background:var(--card);color:var(--text);font-size:.8rem;cursor:pointer';
  var blankOpt=document.createElement('option');blankOpt.value='';blankOpt.textContent='Mês...';mSel.appendChild(blankOpt);
  for(var mi=0;mi<12;mi++){var mopt=document.createElement('option');mopt.value=mi;mopt.textContent=monthNames[mi];if(month!==undefined&&month===mi)mopt.selected=true;mSel.appendChild(mopt);}
  mSel.addEventListener('change',function(){if(this.value!=='')renderBizCalMonth(year,parseInt(this.value));});
  hdr.appendChild(mSel);
  var backBtn=document.createElement('button');
  backBtn.style.cssText='padding:5px 12px;background:var(--card);border:1.5px solid var(--border);border-radius:7px;cursor:pointer;font-size:.8rem;font-weight:600;font-family:inherit;color:var(--text)';
  backBtn.textContent='← Voltar';backBtn.addEventListener('click',bizCalGoBack);hdr.appendChild(backBtn);
  var selAllBtn=document.createElement('button');
  selAllBtn.style.cssText='padding:5px 12px;background:var(--card);border:1.5px solid var(--border);border-radius:7px;cursor:pointer;font-size:.8rem;font-weight:600;font-family:inherit;color:var(--text)';
  selAllBtn.textContent='✓ Selecionar Tudo';selAllBtn.addEventListener('click',bizCalSelectAll);hdr.appendChild(selAllBtn);
  var printBtn=document.createElement('button');
  printBtn.style.cssText='padding:5px 14px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:white;border:none;border-radius:7px;cursor:pointer;font-size:.8rem;font-weight:700;font-family:inherit';
  printBtn.textContent='🖨 Imprimir Selecionados';printBtn.addEventListener('click',bizCalPrintSelected);hdr.appendChild(printBtn);
  var closeBtn=document.createElement('button');
  closeBtn.style.cssText='padding:5px 10px;background:var(--card);border:1.5px solid var(--border);border-radius:7px;cursor:pointer;font-size:.9rem;font-weight:700;color:var(--text2)';
  closeBtn.textContent='✕';closeBtn.addEventListener('click',closeBusinessCalendar);hdr.appendChild(closeBtn);
  if(inner.firstChild){inner.replaceChild(hdr,inner.firstChild);}else{inner.appendChild(hdr);}
}
function renderBizCalYear(year){
  window._bizCalLevel='year';window._bizCalYear=year;window._bizCalMonth=undefined;
  var monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var inner=document.getElementById('businessCalInner');if(!inner)return;
  inner.innerHTML='';bizCalSetHeader('Calendário — '+year,year,undefined);
  var byMonth={};
  (orders||[]).forEach(function(o){if(!o.orderDate)return;var parts=o.orderDate.split('-');if(parseInt(parts[0])===year){var m=parseInt(parts[1])-1;byMonth[m]=(byMonth[m]||0)+1;}});
  var body=document.createElement('div');body.style.cssText='padding:16px;overflow-y:auto;flex:1';
  var grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px';
  for(var m=0;m<12;m++){
    var count=byMonth[m]||0;var active=count>0;
    var card=document.createElement('div');
    card.dataset.bizYear=year;card.dataset.bizMonth=m;
    card.style.cssText='background:'+(active?'linear-gradient(135deg,#fdf3e3,#fae8c8)':'var(--card2)')+';border:'+(active?'2px solid var(--accent)':'1.5px solid var(--border)')+';border-radius:12px;padding:14px 10px;text-align:center;cursor:pointer;transition:all .2s;position:relative';
    var chk=document.createElement('input');chk.type='checkbox';chk.className='biz-cal-check';chk.dataset.month=m;
    chk.style.cssText='position:absolute;top:8px;left:8px;width:14px;height:14px;cursor:pointer';card.appendChild(chk);
    var nameEl=document.createElement('div');nameEl.style.cssText='font-weight:700;font-size:.88rem;color:var(--text);margin-bottom:6px';nameEl.textContent=monthNames[m];card.appendChild(nameEl);
    var numEl=document.createElement('div');numEl.style.cssText='font-size:1.8rem;font-weight:900;color:'+(active?'var(--accent-dark)':'var(--text2)')+';line-height:1';numEl.textContent=count;card.appendChild(numEl);
    var lblEl=document.createElement('div');lblEl.style.cssText='font-size:.68rem;color:var(--text2);margin-top:2px';lblEl.textContent='encomenda'+(count!==1?'s':'');card.appendChild(lblEl);
    grid.appendChild(card);
  }
  body.appendChild(grid);inner.appendChild(body);
}
function renderBizCalMonth(year,month){
  window._bizCalLevel='month';window._bizCalYear=year;window._bizCalMonth=month;
  var monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  var inner=document.getElementById('businessCalInner');if(!inner)return;
  inner.innerHTML='';bizCalSetHeader(monthNames[month]+' '+year,year,month);
  var daysInMonth=new Date(year,month+1,0).getDate();
  var byDay={};var prefix=year+'-'+(month+1).toString().padStart(2,'0')+'-';
  (orders||[]).forEach(function(o){if(o.orderDate&&o.orderDate.startsWith(prefix)){var d=parseInt(o.orderDate.split('-')[2]);byDay[d]=(byDay[d]||0)+1;}});
  var body=document.createElement('div');body.style.cssText='padding:16px;overflow-y:auto;flex:1';
  var grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px';
  var today=new Date();
  for(var d=1;d<=daysInMonth;d++){
    var dateStr=year+'-'+(month+1).toString().padStart(2,'0')+'-'+d.toString().padStart(2,'0');
    var count=byDay[d]||0;var active=count>0;
    var isToday=(today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d);
    var card=document.createElement('div');card.dataset.bizDate=dateStr;
    card.style.cssText='background:'+(active?'linear-gradient(135deg,#fdf3e3,#fae8c8)':'var(--card2)')+';border:'+(isToday?'2px solid var(--accent)':(active?'1.5px solid var(--accent)':'1px solid var(--border)'))+';border-radius:10px;padding:10px 6px;text-align:center;cursor:pointer;transition:all .15s;position:relative';
    var chk=document.createElement('input');chk.type='checkbox';chk.className='biz-cal-check';chk.dataset.date=dateStr;
    chk.style.cssText='position:absolute;top:6px;left:6px;width:13px;height:13px;cursor:pointer';card.appendChild(chk);
    var dEl=document.createElement('div');dEl.style.cssText='font-weight:'+(isToday?'900':'700')+';font-size:.95rem;color:var(--text)';dEl.textContent=d;card.appendChild(dEl);
    var dowEl=document.createElement('div');dowEl.style.cssText='font-size:.65rem;color:var(--text2);margin-bottom:4px';dowEl.textContent=dayNames[new Date(year,month,d).getDay()];card.appendChild(dowEl);
    var cntEl=document.createElement('div');cntEl.style.cssText='font-size:1.4rem;font-weight:900;color:'+(active?'var(--accent-dark)':'var(--text2)')+';line-height:1';cntEl.textContent=count;card.appendChild(cntEl);
    var lblEl=document.createElement('div');lblEl.style.cssText='font-size:.6rem;color:var(--text2)';lblEl.textContent='encomenda'+(count!==1?'s':'');card.appendChild(lblEl);
    grid.appendChild(card);
  }
  body.appendChild(grid);inner.appendChild(body);
}
function renderBizCalDay(dateStr){
  window._bizCalLevel='day';
  var parts=dateStr.split('-');var year=parseInt(parts[0]),month=parseInt(parts[1])-1,day=parseInt(parts[2]);
  var monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var inner=document.getElementById('businessCalInner');if(!inner)return;
  inner.innerHTML='';bizCalSetHeader(day+' de '+monthNames[month]+' '+year,year,month);
  var dayOrders=(orders||[]).filter(function(o){return o.orderDate===dateStr;});
  dayOrders.sort(function(a,b){return (a.orderTime||'').localeCompare(b.orderTime||'');});
  var body=document.createElement('div');body.style.cssText='padding:12px;overflow-y:auto;flex:1';
  if(dayOrders.length===0){
    body.innerHTML='<div style="text-align:center;padding:40px;color:var(--text2);font-size:.9rem">🎂 Sem encomendas neste dia</div>';
  } else {
    var html='<div style="display:flex;flex-direction:column;gap:10px">';
    dayOrders.forEach(function(o){
      html+='<div style="display:flex;align-items:flex-start;gap:8px">';
      html+='<input type="checkbox" class="biz-cal-check" data-order="'+o.id+'" style="margin-top:14px;width:15px;height:15px;cursor:pointer;flex-shrink:0"/>';
      html+='<div style="flex:1;min-width:0">'+renderOrderCard(o)+'</div>';
      html+='</div>';
    });
    html+='</div>';
    body.innerHTML=html;
  }
  inner.appendChild(body);
}
function bizCalGoBack(){
  var level=window._bizCalLevel;var year=window._bizCalYear||new Date().getFullYear();var month=window._bizCalMonth;
  if(level==='day')renderBizCalMonth(year,month);else renderBizCalYear(year);
}
function bizCalSelectAll(){
  var checks=document.querySelectorAll('#businessCalInner .biz-cal-check');
  var allChecked=Array.from(checks).every(function(c){return c.checked;});
  checks.forEach(function(c){c.checked=!allChecked;});
}
function bizCalPrintSelected(){
  var checks=document.querySelectorAll('#businessCalInner .biz-cal-check:checked');
  if(checks.length===0){showToast('Selecione pelo menos um item para imprimir.','warning');return;}
  var year=window._bizCalYear||new Date().getFullYear();
  var selectedOrders=[];
  checks.forEach(function(c){
    if(c.dataset.order){var o=(orders||[]).find(function(x){return x.id===c.dataset.order;});if(o)selectedOrders.push(o);}
    else if(c.dataset.date){(orders||[]).filter(function(o){return o.orderDate===c.dataset.date;}).forEach(function(o){selectedOrders.push(o);});}
    else if(c.dataset.month!==undefined){var m=parseInt(c.dataset.month);var prefix=year+'-'+(m+1).toString().padStart(2,'0')+'-';(orders||[]).filter(function(o){return o.orderDate&&o.orderDate.startsWith(prefix);}).forEach(function(o){selectedOrders.push(o);});}
  });
  var seen={};selectedOrders=selectedOrders.filter(function(o){if(seen[o.id])return false;seen[o.id]=true;return true;});
  selectedOrders.sort(function(a,b){var d=(a.orderDate||'').localeCompare(b.orderDate||'');return d!==0?d:(a.orderTime||'').localeCompare(b.orderTime||'');});
  if(selectedOrders.length===0){showToast('Sem encomendas nos itens selecionados.','warning');return;}
  var statusLabels={new:'Nova',confirmed:'Confirmado',ready:'Pronto',delivered:'Entregue',cancelled:'Cancelado'};
  var statusColors={new:'#5a85b0',confirmed:'#6a9e6a',ready:'#c9853a',delivered:'#7a6a58',cancelled:'#c0544a'};
  var cards=selectedOrders.map(function(o){
    var flavorDesc=typeof getFlavorDesc==='function'?getFlavorDesc(o):(o.baseFlavor||'—');
    var weightDesc=typeof getWeightDesc==='function'?getWeightDesc(o):((o.minWeight||'?')+' – '+(o.maxWeight||'?')+' kg');
    var priceDesc=typeof getPriceDesc==='function'?getPriceDesc(o):'';
    var cakeName=typeof getCakeTypeName==='function'?getCakeTypeName(o.cakeType):(o.cakeType||'—');
    var sl=statusLabels[o.status]||o.status||'—';var sc=statusColors[o.status]||'#888';
    var dateFormatted=o.orderDate?new Date(o.orderDate+'T00:00:00').toLocaleDateString('pt-PT'):'—';
    var card='<div class="oc">';
    card+='<div class="och"><span class="oid">'+o.id+'</span>';
    if(o.clientId)card+='<span class="ocid">'+o.clientId+'</span>';
    card+='<span class="obadge" style="background:'+sc+'22;color:'+sc+';border:1px solid '+sc+'55">'+sl+'</span></div>';
    card+='<div class="oname">'+o.customerName+'</div>';
    if(o.phone)card+='<div class="orow"><b>📞</b>'+o.phone+'</div>';
    card+='<div class="odiv"></div>';
    card+='<div class="orow"><b>🎂</b>'+cakeName+'</div>';
    card+='<div class="orow"><b>🍓</b>'+flavorDesc+'</div>';
    if(o.cakeMessage)card+='<div class="orow"><b>💬</b>"'+o.cakeMessage+'"</div>';
    card+='<div class="orow"><b>⚖️</b>'+weightDesc+'</div>';
    if(priceDesc)card+='<div class="orow"><b>💰</b>'+priceDesc+'</div>';
    card+='<div class="odiv"></div>';
    card+='<div class="orow"><b>📅</b>'+dateFormatted+' às '+(o.orderTime||'—')+'</div>';
    card+='<div class="orow"><b>'+(o.deliveryType==='pickup'?'🏪':'🚚')+'</b>'+(o.deliveryType==='pickup'?'Recolha':'Entrega')+(o.address?' — '+o.address:'')+'</div>';
    card+='<div class="orow"><b>💳</b>'+(o.paymentMethod||'—')+'</div>';
    if(o.chefNotes)card+='<div class="orow onote"><b>👨‍🍳</b>'+o.chefNotes+'</div>';
    if(o.finalPrice)card+='<div class="ototl">Total Final: €'+parseFloat(o.finalPrice).toFixed(2)+'</div>';
    card+='</div>';return card;
  }).join('');
  var css='*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI",Georgia,sans-serif;background:#FFFDF7;color:#3A3A3A;padding:16px}.ph{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #D4A373}.ph h1{font-family:Georgia,serif;font-size:1.3rem;color:#b5845a;margin-bottom:3px}.ph p{font-size:0.75rem;color:#7a6a58}.ph .cnt{font-size:0.8rem;color:#b5845a;font-weight:700;margin-top:3px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.oc{background:white;border:1.5px solid #e8d9c0;border-radius:10px;padding:12px;page-break-inside:avoid;break-inside:avoid}.och{display:flex;align-items:center;gap:5px;margin-bottom:6px;flex-wrap:wrap}.oid{font-weight:800;color:#b5845a;font-size:0.8rem}.ocid{font-size:0.68rem;color:#7a6a58;background:#FAEDCD;padding:1px 5px;border-radius:8px}.obadge{font-size:0.67rem;font-weight:700;padding:1px 7px;border-radius:8px;margin-left:auto}.oname{font-weight:700;font-size:0.95rem;color:#3A3A3A;margin-bottom:6px}.odiv{border-top:1px dashed #e8d9c0;margin:6px 0}.orow{display:flex;gap:5px;font-size:0.75rem;margin-bottom:3px;align-items:flex-start}.orow b{flex-shrink:0;width:18px;font-weight:normal}.onote{background:#fdf3e3;border-radius:5px;padding:3px 5px;margin-top:3px}.ototl{margin-top:7px;background:linear-gradient(135deg,#D4A37320,#CB997E15);border:1.5px solid #D4A373;border-radius:7px;padding:6px 10px;text-align:center;font-weight:800;color:#b5845a;font-size:0.85rem}.pf{text-align:center;margin-top:16px;padding-top:10px;border-top:1px solid #e8d9c0;font-size:0.72rem;color:#7a6a58}@media print{body{background:white;padding:8px}.grid{grid-template-columns:1fr 1fr;gap:8px}.oc{border:1px solid #ccc}}';
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bismi Treats</title><style>'+css+'</style></head><body><div class="ph"><h1>🎂 Bismi Treats</h1><p>Encomendas Selecionadas</p><div class="cnt">'+selectedOrders.length+' encomenda'+(selectedOrders.length!==1?'s':'')+'</div><p>Impresso em '+new Date().toLocaleString('pt-PT')+'</p></div><div class="grid">'+cards+'</div><div class="pf">❤️ Bismi Treats · bismitreats.com · 934 453 710 · bismitreats.pt@gmail.com</div></body></html>';
  var win=window.open('','_blank');win.document.open();win.document.write(html);win.document.close();setTimeout(function(){win.print();},500);
}
function renderBusinessCalendar(year,month){
  openBusinessCalendar();
  if(month!==undefined)renderBizCalMonth(year||new Date().getFullYear(),month);
  else renderBizCalYear(year||new Date().getFullYear());
}
function showBizCalDay(dateStr){renderBizCalDay(dateStr);}

function bizCalPrintSelected(){
  var checks=document.querySelectorAll('#businessCalInner .biz-cal-check:checked');
  if(checks.length===0){showToast('Selecione pelo menos um item para imprimir.','warning');return;}
  var year=window._bizCalYear||new Date().getFullYear();
  var selectedOrders=[];
  checks.forEach(function(c){
    if(c.dataset.order){var o=(orders||[]).find(function(x){return x.id===c.dataset.order;});if(o)selectedOrders.push(o);}
    else if(c.dataset.date){(orders||[]).filter(function(o){return o.orderDate===c.dataset.date;}).forEach(function(o){selectedOrders.push(o);});}
    else if(c.dataset.month!==undefined){var m=parseInt(c.dataset.month);var prefix=year+'-'+(m+1).toString().padStart(2,'0')+'-';(orders||[]).filter(function(o){return o.orderDate&&o.orderDate.startsWith(prefix);}).forEach(function(o){selectedOrders.push(o);});}
  });
  var seen={};selectedOrders=selectedOrders.filter(function(o){if(seen[o.id])return false;seen[o.id]=true;return true;});
  selectedOrders.sort(function(a,b){var d=(a.orderDate||'').localeCompare(b.orderDate||'');return d!==0?d:(a.orderTime||'').localeCompare(b.orderTime||'');});
  if(selectedOrders.length===0){showToast('Sem encomendas nos itens selecionados.','warning');return;}
  var statusLabels={new:'Nova',confirmed:'Confirmado',ready:'Pronto',delivered:'Entregue',cancelled:'Cancelado'};
  var statusColors={new:'#5a85b0',confirmed:'#6a9e6a',ready:'#c9853a',delivered:'#7a6a58',cancelled:'#c0544a'};
  var cards=selectedOrders.map(function(o){
    var flavorDesc=typeof getFlavorDesc==='function'?getFlavorDesc(o):(o.baseFlavor||'—');
    var weightDesc=typeof getWeightDesc==='function'?getWeightDesc(o):((o.minWeight||'?')+' – '+(o.maxWeight||'?')+' kg');
    var priceDesc=typeof getPriceDesc==='function'?getPriceDesc(o):'';
    var cakeName=typeof getCakeTypeName==='function'?getCakeTypeName(o.cakeType):(o.cakeType||'—');
    var sl=statusLabels[o.status]||o.status||'—';var sc=statusColors[o.status]||'#888';
    var dateFormatted=o.orderDate?new Date(o.orderDate+'T00:00:00').toLocaleDateString('pt-PT'):'—';
    var card='<div class="oc">';
    card+='<div class="och"><span class="oid">'+o.id+'</span>';
    if(o.clientId)card+='<span class="ocid">'+o.clientId+'</span>';
    card+='<span class="obadge" style="background:'+sc+'22;color:'+sc+';border:1px solid '+sc+'55">'+sl+'</span></div>';
    card+='<div class="oname">'+o.customerName+'</div>';
    if(o.phone)card+='<div class="orow"><b>📞</b>'+o.phone+'</div>';
    card+='<div class="odiv"></div>';
    card+='<div class="orow"><b>🎂</b>'+cakeName+'</div>';
    card+='<div class="orow"><b>🍓</b>'+flavorDesc+'</div>';
    if(o.cakeMessage)card+='<div class="orow"><b>💬</b>"'+o.cakeMessage+'"</div>';
    card+='<div class="orow"><b>⚖️</b>'+weightDesc+'</div>';
    if(priceDesc)card+='<div class="orow"><b>💰</b>'+priceDesc+'</div>';
    card+='<div class="odiv"></div>';
    card+='<div class="orow"><b>📅</b>'+dateFormatted+' às '+(o.orderTime||'—')+'</div>';
    card+='<div class="orow"><b>'+(o.deliveryType==='pickup'?'🏪':'🚚')+'</b>'+(o.deliveryType==='pickup'?'Recolha':'Entrega')+(o.address?' — '+o.address:'')+'</div>';
    card+='<div class="orow"><b>💳</b>'+(o.paymentMethod||'—')+'</div>';
    if(o.chefNotes)card+='<div class="orow onote"><b>👨‍🍳</b>'+o.chefNotes+'</div>';
    if(o.finalPrice)card+='<div class="ototl">Total Final: €'+parseFloat(o.finalPrice).toFixed(2)+'</div>';
    card+='</div>';return card;
  }).join('');
  var css='*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI",Georgia,sans-serif;background:#FFFDF7;color:#3A3A3A;padding:16px}.ph{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #D4A373}.ph h1{font-family:Georgia,serif;font-size:1.3rem;color:#b5845a;margin-bottom:3px}.ph p{font-size:0.75rem;color:#7a6a58}.ph .cnt{font-size:0.8rem;color:#b5845a;font-weight:700;margin-top:3px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.oc{background:white;border:1.5px solid #e8d9c0;border-radius:10px;padding:12px;page-break-inside:avoid;break-inside:avoid}.och{display:flex;align-items:center;gap:5px;margin-bottom:6px;flex-wrap:wrap}.oid{font-weight:800;color:#b5845a;font-size:0.8rem}.ocid{font-size:0.68rem;color:#7a6a58;background:#FAEDCD;padding:1px 5px;border-radius:8px}.obadge{font-size:0.67rem;font-weight:700;padding:1px 7px;border-radius:8px;margin-left:auto}.oname{font-weight:700;font-size:0.95rem;color:#3A3A3A;margin-bottom:6px}.odiv{border-top:1px dashed #e8d9c0;margin:6px 0}.orow{display:flex;gap:5px;font-size:0.75rem;margin-bottom:3px;align-items:flex-start}.orow b{flex-shrink:0;width:18px;font-weight:normal}.onote{background:#fdf3e3;border-radius:5px;padding:3px 5px;margin-top:3px}.ototl{margin-top:7px;background:linear-gradient(135deg,#D4A37320,#CB997E15);border:1.5px solid #D4A373;border-radius:7px;padding:6px 10px;text-align:center;font-weight:800;color:#b5845a;font-size:0.85rem}.pf{text-align:center;margin-top:16px;padding-top:10px;border-top:1px solid #e8d9c0;font-size:0.72rem;color:#7a6a58}@media print{body{background:white;padding:8px}.grid{grid-template-columns:1fr 1fr;gap:8px}.oc{border:1px solid #ccc}}';
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bismi Treats</title><style>'+css+'</style></head><body><div class="ph"><h1>🎂 Bismi Treats</h1><p>Encomendas Selecionadas</p><div class="cnt">'+selectedOrders.length+' encomenda'+(selectedOrders.length!==1?'s':'')+'</div><p>Impresso em '+new Date().toLocaleString('pt-PT')+'</p></div><div class="grid">'+cards+'</div><div class="pf">❤️ Bismi Treats · bismitreats.com · 934 453 710 · bismitreats.pt@gmail.com</div></body></html>';
  var win=window.open('','_blank');win.document.open();win.document.write(html);win.document.close();setTimeout(function(){win.print();},500);
}


function showCustomerHistory(customerName, customerId){
  var customerOrders = orders.filter(function(o){ 
    return (customerId && (o.customerId===customerId||o.clientId===customerId)) ||
           (customerName && o.customerName===customerName);
  });
  var existing = document.getElementById('customerHistoryModal');
  if(!existing){
    existing = document.createElement('div');
    existing.id = 'customerHistoryModal';
    existing.className = 'modal-overlay';
    var inner = document.createElement('div');
    inner.className = 'modal modal-lg';
    var hdr = document.createElement('div');
    hdr.className = 'modal-header';
    hdr.innerHTML = '<h3><i class="fas fa-user-clock"></i> Histórico do Cliente</h3>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener('click', function(){ closeModal('customerHistoryModal'); });
    hdr.appendChild(closeBtn);
    var body = document.createElement('div');
    body.className = 'modal-body';
    body.id = 'customerHistoryContent';
    inner.appendChild(hdr);
    inner.appendChild(body);
    existing.appendChild(inner);
    document.body.appendChild(existing);
  }
  var content = document.getElementById('customerHistoryContent');
  if(!content) return;
  if(customerOrders.length===0){
    content.innerHTML = '<p style="color:var(--text2);text-align:center;padding:20px">Sem histórico para este cliente</p>';
  } else {
    var html = '<div style="display:flex;flex-direction:column;gap:10px">';
    customerOrders.forEach(function(o){
      var sc = {new:'#5a85b0',confirmed:'#6a9e6a',ready:'#c9853a',delivered:'#7a6a58',cancelled:'#c0544a'}[o.status]||'#888';
      var sl = {new:'Nova',confirmed:'Confirmado',ready:'Pronto',delivered:'Entregue',cancelled:'Cancelado'}[o.status]||o.status||'—';
      html += '<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
      html += '<strong style="color:var(--accent-dark)">' + (o.orderId||o.id) + '</strong>';
      html += '<span style="background:' + sc + '22;color:' + sc + ';border:1px solid ' + sc + '44;padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:700">' + sl + '</span>';
      html += '</div>';
      html += '<div style="font-size:.82rem;color:var(--text2)">';
      html += '🎂 ' + getCakeTypeName(o.cakeType) + ' · ' + getFlavorDesc(o) + '<br>';
      html += '📅 ' + (o.orderDate||'—') + ' ⏰ ' + (o.orderTime||'—') + '<br>';
      html += '💰 ' + getPriceDesc(o);
      html += '</div></div>';
    });
    html += '</div>';
    content.innerHTML = html;
  }
  openModal('customerHistoryModal');
}

document.addEventListener('DOMContentLoaded',()=>{
  loadData();
  populateWeightSelects('minWeight','maxWeight');
  populateWeightSelects('editMinWeight','editMaxWeight');
  populateFinalWeightSelect();
  populateYearFilters();
  initOrderForm();
  initEditOrderForm();
  initPanelControls();
  initSettingsMenu();
  initModalCloseButtons();
  initReceiptButtons();
  initWhatsAppButtons();
  initCalendarButtons();
  initFinalWeightButtons();
  initGalleryButtons();
  initAllOrdersButtons();
  initCustomerRequestsButtons();
  initMonthlySalesButtons();
  initRecycleBinButtons();
  initTopbarButtons();
  initSearchAndFilter();
  initImportFile();
  renderOrdersList();
  updateDashboard();
  loadCustomerRequests();
  syncFromServer();
  if(localStorage.getItem('bismiRemindersEnabled')==='true'){ reminderInterval=setInterval(checkReminders,60000); checkReminders(); }
  setInterval(()=>{ loadCustomerRequests(); },30000);
});