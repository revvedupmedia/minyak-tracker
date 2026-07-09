// ===========================================
// Minyak Tracker v5 — Auth + Admin BG Video
// ===========================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MONTH_NAMES = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
const ADMIN_SECRET = 'GMRBAH7';

let state = {
  viewDate: new Date(),
  entries: [],
  selectedFuel: 'diesel',
  pendingFile: null,
  currentUser: null,
  isAdmin: false,
  adminUnlocked: false,
  pendingBgFile: null,
};

// ── Helpers ──────────────────────────────────────
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtRM(n) {
  return 'RM'+Number(n||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtKm(n) { return Number(n||0).toLocaleString('en-MY',{maximumFractionDigits:1}); }
function fmtDateShort(s) { return new Date(s+'T00:00:00').toLocaleDateString('ms-MY',{day:'numeric',month:'short'}); }
function fmtDateLong(s)  { return new Date(s+'T00:00:00').toLocaleDateString('ms-MY',{day:'numeric',month:'long',year:'numeric'}); }
function monthRange(d) {
  const s=new Date(d.getFullYear(),d.getMonth(),1);
  const e=new Date(d.getFullYear(),d.getMonth()+1,0);
  return {start:toLocalDateStr(s),end:toLocalDateStr(e)};
}
function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.hidden=false;
  clearTimeout(showToast._t);
  showToast._t=setTimeout(()=>{t.hidden=true;},2200);
}

// ── Background Video ──────────────────────────────
async function loadBackgroundVideo() {
  try {
    const {data} = await sb.from('app_settings').select('value').eq('key','bg_video_url').single();
    if(data?.value) applyBgVideo(data.value);
  } catch(_) {}
}

function applyBgVideo(url) {
  const vid = document.getElementById('bgVideo');
  if(!url) { vid.src=''; vid.classList.remove('loaded'); return; }
  vid.src = url;
  vid.onloadeddata = () => vid.classList.add('loaded');
  vid.onerror = () => vid.classList.remove('loaded');
  vid.load();
  // Show current URL in admin panel
  const wrap = document.getElementById('bgCurrentUrl');
  const txt  = document.getElementById('bgUrlText');
  if(wrap && txt) { txt.textContent = url.split('/').pop(); wrap.hidden = false; }
}

// ── Auth ──────────────────────────────────────────
async function initAuth() {
  await loadBackgroundVideo();
  const {data:{session}} = await sb.auth.getSession();
  if(session) onLoggedIn(session.user); else showLoginScreen();
  sb.auth.onAuthStateChange((_,session) => {
    if(session) onLoggedIn(session.user); else onLoggedOut();
  });
}

function showLoginScreen() {
  document.getElementById('loginScreen').hidden = false;
  document.getElementById('app').hidden = true;
}

function onLoggedIn(user) {
  state.currentUser = user;
  const app = document.getElementById('app');
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('userEmailDisplay').textContent = user.email;
  // Success animation
  if(!app.dataset.shown) {
    const suc = document.getElementById('loginSuccess');
    suc.hidden = false; app.hidden = true;
    setTimeout(() => { suc.hidden=true; app.hidden=false; app.dataset.shown='1'; loadEntries(); }, 2000);
  } else {
    app.hidden = false; loadEntries();
  }
}

function onLoggedOut() {
  state.currentUser = null; state.isAdmin = false; state.adminUnlocked = false;
  document.getElementById('adminBadge').hidden = true;
  const app = document.getElementById('app');
  delete app.dataset.shown; app.hidden = true;
  showLoginScreen();
}

// Login form
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email=document.getElementById('loginEmail').value.trim();
  const pass=document.getElementById('loginPassword').value;
  const err=document.getElementById('loginError');
  const btn=document.getElementById('loginBtn');
  err.hidden=true; btn.disabled=true; btn.textContent='Log masuk...';
  const {error} = await sb.auth.signInWithPassword({email,password:pass});
  if(error){err.textContent='Email atau password salah.';err.hidden=false;}
  btn.disabled=false; btn.textContent='Log Masuk';
});
document.getElementById('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginBtn').click();});
document.getElementById('loginEmail').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginPassword').focus();});
document.getElementById('logoutBtn').addEventListener('click',()=>sb.auth.signOut());

// ── Admin Cheat Code — tap logo 7x ───────────────
let logoTaps=0, logoTimer=null;
['loginLogo','appLogo'].forEach(id => {
  const el=document.getElementById(id); if(!el)return;
  el.addEventListener('click',()=>{
    logoTaps++; clearTimeout(logoTimer);
    logoTimer=setTimeout(()=>logoTaps=0,2000);
    if(logoTaps>=7){
      logoTaps=0;
      if(state.isAdmin){
        state.isAdmin=false; state.adminUnlocked=false;
        document.getElementById('adminBadge').hidden=true;
        showToast('Admin mode dimatikan');
      } else { openAdminDialog(); }
    }
  });
});

const adminDialog = document.getElementById('adminDialog');
document.getElementById('adminDialogClose').addEventListener('click',()=>adminDialog.close());
adminDialog.addEventListener('click',e=>{if(e.target===adminDialog)adminDialog.close();});

function openAdminDialog() {
  if(addDialog.open)addDialog.close();
  if(detailDialog.open)detailDialog.close();
  // Reset to lock screen if not yet unlocked
  if(!state.adminUnlocked){
    document.getElementById('adminLockSection').hidden=false;
    document.getElementById('adminToolSection').hidden=true;
    document.getElementById('adminPassword').value='';
    document.getElementById('adminError').hidden=true;
  }
  adminDialog.showModal();
  if(!state.adminUnlocked) setTimeout(()=>document.getElementById('adminPassword').focus(),100);
}

document.getElementById('adminUnlockBtn').addEventListener('click',()=>{
  const pw=document.getElementById('adminPassword').value;
  if(pw===ADMIN_SECRET){
    state.adminUnlocked=true; state.isAdmin=true;
    document.getElementById('adminBadge').hidden=false;
    document.getElementById('adminLockSection').hidden=true;
    document.getElementById('adminToolSection').hidden=false;
    document.getElementById('adminError').hidden=true;
    // Load current bg info
    loadBackgroundVideo();
  } else {
    document.getElementById('adminError').hidden=false;
    document.getElementById('adminPassword').value='';
    document.getElementById('adminPassword').focus();
  }
});
document.getElementById('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('adminUnlockBtn').click();});

// ── Admin: Background Video Upload ───────────────
const videoDrop = document.getElementById('videoDrop');
const bgVideoFile = document.getElementById('bgVideoFile');

videoDrop.addEventListener('click',e=>{if(e.target.id!=='bgVideoFile')bgVideoFile.click();});
bgVideoFile.addEventListener('change',()=>{
  const file=bgVideoFile.files[0]; if(!file)return;
  if(file.size>52428800){showToast('Video terlalu besar (max 50MB)');return;}
  state.pendingBgFile=file;
  document.getElementById('videoDropEmpty').hidden=true;
  document.getElementById('videoDropPreview').hidden=false;
  document.getElementById('videoFileName').textContent=file.name;
  document.getElementById('bgUploadBtn').disabled=false;
});

document.getElementById('bgUploadBtn').addEventListener('click', async()=>{
  if(!state.pendingBgFile)return;
  const btn=document.getElementById('bgUploadBtn');
  const msg=document.getElementById('bgMsg');
  const prog=document.getElementById('bgUploadProgress');
  const bar=document.getElementById('bgUploadBar');
  const label=document.getElementById('bgUploadLabel');
  btn.disabled=true; btn.textContent='Uploading...';
  msg.hidden=true; prog.hidden=false; bar.style.width='0%'; label.textContent='0%';

  try {
    const file=state.pendingBgFile;
    const ext=file.name.split('.').pop();
    const path=`bg_${Date.now()}.${ext}`;
    // Upload with progress simulation (Supabase JS v2 doesn't have upload progress natively)
    bar.style.width='30%'; label.textContent='30%';
    const {error:upErr} = await sb.storage.from('backgrounds').upload(path,file,{upsert:true});
    if(upErr) throw new Error(upErr.message);
    bar.style.width='80%'; label.textContent='80%';
    const {data:urlData} = sb.storage.from('backgrounds').getPublicUrl(path);
    const url=urlData.publicUrl;
    // Save to settings
    const {error:setErr} = await sb.from('app_settings')
      .upsert({key:'bg_video_url',value:url,updated_at:new Date().toISOString()});
    if(setErr) throw new Error(setErr.message);
    bar.style.width='100%'; label.textContent='100%';
    applyBgVideo(url);
    showToast('Background video dikemaskini ✓');
    state.pendingBgFile=null;
    bgVideoFile.value='';
    document.getElementById('videoDropEmpty').hidden=false;
    document.getElementById('videoDropPreview').hidden=true;
    btn.textContent='Upload Video'; btn.disabled=true;
  } catch(err){
    msg.textContent=err.message||'Upload gagal.'; msg.hidden=false;
    btn.textContent='Upload Video'; btn.disabled=false;
  } finally {
    setTimeout(()=>prog.hidden=true,1500);
  }
});

document.getElementById('bgRemoveBtn').addEventListener('click', async()=>{
  if(!confirm('Buang background video?'))return;
  const {error} = await sb.from('app_settings')
    .upsert({key:'bg_video_url',value:'',updated_at:new Date().toISOString()});
  if(!error){
    applyBgVideo('');
    document.getElementById('bgCurrentUrl').hidden=true;
    showToast('Background dibuang');
  }
});

// ── Data ──────────────────────────────────────────
async function loadEntries() {
  const {start,end}=monthRange(state.viewDate);
  const {data,error}=await sb.from('fuel_entries').select('*')
    .gte('entry_date',start).lte('entry_date',end)
    .order('entry_date',{ascending:false}).order('created_at',{ascending:false});
  if(error){showToast('Gagal load data.');return;}
  state.entries=data||[];
  render();
}

function render(){
  document.getElementById('monthText').textContent=`${MONTH_NAMES[state.viewDate.getMonth()]} ${state.viewDate.getFullYear()}`;
  renderGauge(); renderStats(); renderHistory();
}

function renderGauge(){
  const dT=sum('diesel'),rT=sum('ron95'),tot=dT+rT;
  document.getElementById('gaugeTotal').textContent=fmtRM(tot);
  document.getElementById('dieselTotal').textContent=fmtRM(dT);
  document.getElementById('ronTotal').textContent=fmtRM(rT);
  const cx=120,cy=130,r=90;
  document.getElementById('gaugeTrack').setAttribute('d',arc(cx,cy,r,180,0));
  if(tot<=0){document.getElementById('gaugeDiesel').setAttribute('d','');document.getElementById('gaugeRon').setAttribute('d','');return;}
  const dEnd=180-(dT/tot*180);
  document.getElementById('gaugeDiesel').setAttribute('d',arc(cx,cy,r,180,dEnd));
  document.getElementById('gaugeRon').setAttribute('d',arc(cx,cy,r,dEnd,0));
}
function sum(ft){return state.entries.filter(e=>e.fuel_type===ft).reduce((a,e)=>a+Number(e.amount||0),0);}
function polar(cx,cy,r,a){const rad=a*Math.PI/180;return{x:cx+r*Math.cos(rad),y:cy-r*Math.sin(rad)};}
function arc(cx,cy,r,sa,ea){
  if(Math.abs(sa-ea)<.01)return'';
  const s=polar(cx,cy,r,sa),e=polar(cx,cy,r,ea);
  return`M ${s.x} ${s.y} A ${r} ${r} 0 ${Math.abs(sa-ea)>180?1:0} 1 ${e.x} ${e.y}`;
}

function renderStats(){
  const km=state.entries.reduce((a,e)=>a+Number(e.distance_km||0),0);
  document.getElementById('statMileage').innerHTML=`${fmtKm(km)} <span class="unit">km</span>`;
  const pend=state.entries.filter(e=>e.needs_claim&&e.claim_status==='pending').reduce((a,e)=>a+Number(e.amount||0),0);
  document.getElementById('statPending').textContent=fmtRM(pend);
}

function renderHistory(){
  const list=document.getElementById('historyList');
  const empty=document.getElementById('emptyState');
  list.innerHTML='';
  if(!state.entries.length){empty.hidden=false;document.getElementById('historyCount').textContent='';return;}
  empty.hidden=true;
  document.getElementById('historyCount').textContent=`${state.entries.length} entry`;
  for(const entry of state.entries){
    const li=document.createElement('li');
    const isD=entry.fuel_type==='diesel';
    const isOwner=state.currentUser&&entry.user_id===state.currentUser.id;
    const kmH=entry.distance_km?`<span class="h-km">${fmtKm(entry.distance_km)} km</span>`:'';
    const clH=entry.needs_claim?`<span class="h-claim-pill ${entry.claim_status==='claimed'?'claimed':'pending'}">${entry.claim_status==='claimed'?'Dah Claim':'Pending'}</span>`:'';
    const recH=entry.receipt_url?'<span class="h-receipt-dot">📎</span>':'';
    const btn=document.createElement('button');
    btn.type='button'; btn.className='history-item';
    btn.innerHTML=`
      <div class="h-fuel-badge ${isD?'diesel':'ron'}">${isD?'🚗':'🚤'}</div>
      <div class="h-main">
        <div class="h-top">
          <span class="h-fuel-name">${isD?'Diesel':'RON95 (Boat)'}</span>
          <span class="h-amount">${fmtRM(entry.amount)}</span>
        </div>
        <div class="h-bottom">
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span class="h-date">${fmtDateShort(entry.entry_date)}</span>
            <span class="h-owner">${entry.user_email||''}</span>
          </div>
          <div class="h-meta">${kmH}${recH}${clH}</div>
        </div>
      </div>`;
    btn.addEventListener('click',()=>openDetail(entry,isOwner));
    li.appendChild(btn); list.appendChild(li);
  }
}

// Month nav
document.querySelectorAll('.chev').forEach(c=>{
  c.addEventListener('click',()=>{
    const d=parseInt(c.dataset.dir,10);
    state.viewDate=new Date(state.viewDate.getFullYear(),state.viewDate.getMonth()+d,1);
    loadEntries();
  });
});

// ── Add Entry ─────────────────────────────────────
const addDialog=document.getElementById('addDialog');
const detailDialog=document.getElementById('detailDialog');
const odoStart=document.getElementById('odoStart');
const odoEnd=document.getElementById('odoEnd');
const submitBtn=document.getElementById('submitBtn');
const formError=document.getElementById('formError');

document.getElementById('fabAdd').addEventListener('click',openAddDialog);
document.getElementById('addDialogClose').addEventListener('click',()=>addDialog.close());
document.getElementById('detailDialogClose').addEventListener('click',()=>detailDialog.close());
addDialog.addEventListener('click',e=>{if(e.target===addDialog)addDialog.close();});
detailDialog.addEventListener('click',e=>{if(e.target===detailDialog)detailDialog.close();});

function openAddDialog(){
  if(detailDialog.open)detailDialog.close();
  state.pendingFile=null; state.selectedFuel='diesel';
  document.getElementById('entryForm').reset();
  document.getElementById('entryDate').value=toLocalDateStr(new Date());
  setFuel('diesel'); resetDrop(); formError.hidden=true;
  submitBtn.disabled=false; submitBtn.textContent='Simpan Entry';
  addDialog.showModal();
}
function setFuel(f){
  state.selectedFuel=f;
  document.querySelectorAll('.fuel-opt').forEach(b=>b.classList.toggle('active',b.dataset.fuel===f));
}
document.getElementById('fuelToggle').addEventListener('click',e=>{const b=e.target.closest('.fuel-opt');if(b)setFuel(b.dataset.fuel);});

odoStart.addEventListener('input',updateDist);
odoEnd.addEventListener('input',updateDist);
function updateDist(){
  const s=parseFloat(odoStart.value),e=parseFloat(odoEnd.value);
  const prev=document.getElementById('distancePreview');
  if(!isNaN(s)&&!isNaN(e)&&e>=s){document.getElementById('distanceValue').textContent=fmtKm(e-s);prev.hidden=false;}
  else prev.hidden=true;
}

// Receipt file
const dropZone=document.getElementById('dropZone');
const receiptFile=document.getElementById('receiptFile');
dropZone.addEventListener('click',e=>{if(e.target.id!=='removeFile')receiptFile.click();});
receiptFile.addEventListener('change',()=>{const f=receiptFile.files[0];if(f){state.pendingFile=f;showFilePrev(f);}});
document.getElementById('removeFile').addEventListener('click',e=>{e.stopPropagation();state.pendingFile=null;receiptFile.value='';resetDrop();});
function resetDrop(){document.getElementById('dropZoneEmpty').hidden=false;document.getElementById('dropZonePreview').hidden=true;document.getElementById('previewImg').hidden=true;document.getElementById('previewPdf').hidden=true;}
function showFilePrev(f){
  document.getElementById('dropZoneEmpty').hidden=true;document.getElementById('dropZonePreview').hidden=false;
  if(f.type==='application/pdf'){document.getElementById('previewImg').hidden=true;document.getElementById('previewPdf').hidden=false;document.getElementById('previewPdfName').textContent=f.name;}
  else{const r=new FileReader();r.onload=ev=>{const i=document.getElementById('previewImg');i.src=ev.target.result;i.hidden=false;document.getElementById('previewPdf').hidden=true;};r.readAsDataURL(f);}
}

// Submit
submitBtn.addEventListener('click',async()=>{
  formError.hidden=true;submitBtn.disabled=true;submitBtn.textContent='Menyimpan...';
  try{
    const date=document.getElementById('entryDate').value;
    const amount=parseFloat(document.getElementById('entryAmount').value);
    const needsClaim=document.getElementById('needsClaim').checked;
    const notes=document.getElementById('entryNotes').value.trim();
    const oS=odoStart.value?parseFloat(odoStart.value):null;
    const oE=odoEnd.value?parseFloat(odoEnd.value):null;
    if(!date)throw new Error('Sila pilih tarikh.');
    if(isNaN(amount)||amount<=0)throw new Error('Sila masukkan amount yang sah.');
    if(oS!==null&&oE!==null&&oE<oS)throw new Error('Odometer akhir mesti lebih besar.');
    let recUrl=null,recPath=null;
    if(state.pendingFile){
      const f=state.pendingFile,ext=f.name.split('.').pop();
      const path=`${state.currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const{error:upE}=await sb.storage.from('receipts').upload(path,f);
      if(upE)throw new Error('Gagal upload resit.');
      recUrl=sb.storage.from('receipts').getPublicUrl(path).data.publicUrl;
      recPath=path;
    }
    const payload={
      entry_date:date,fuel_type:state.selectedFuel,
      odometer_start:oS,odometer_end:oE,
      distance_km:oS!==null&&oE!==null?oE-oS:null,
      amount,needs_claim:needsClaim,
      claim_status:needsClaim?'pending':'not_applicable',
      notes:notes||null,user_id:state.currentUser.id,user_email:state.currentUser.email,
    };
    if(recUrl){payload.receipt_url=recUrl;payload.receipt_path=recPath;}
    const{error:insE}=await sb.from('fuel_entries').insert(payload);
    if(insE)throw new Error(insE.message);
    addDialog.close();showToast('Entry disimpan ✓');await loadEntries();
  }catch(err){formError.textContent=err.message||'Ralat.';formError.hidden=false;}
  finally{submitBtn.disabled=false;submitBtn.textContent='Simpan Entry';}
});

// ── Detail ────────────────────────────────────────
const detailBody=document.getElementById('detailBody');
const detailActions=document.getElementById('detailActions');
let curEntry=null;

function openDetail(entry,isOwner){
  if(addDialog.open)addDialog.close();
  curEntry=entry;
  const isD=entry.fuel_type==='diesel';
  const rows=[
    row('Tarikh',fmtDateLong(entry.entry_date)),
    row('Oleh',entry.user_email||'—'),
    row('Jenis',isD?'Diesel':'RON95 (Boat)'),
    row('Amount',fmtRM(entry.amount),true),
  ];
  if(entry.odometer_start!==null&&entry.odometer_end!==null){
    rows.push(row('Odo Mula',fmtKm(entry.odometer_start)+' km',true));
    rows.push(row('Odo Akhir',fmtKm(entry.odometer_end)+' km',true));
    rows.push(row('Jarak',fmtKm(entry.distance_km)+' km',true));
  }
  if(entry.needs_claim) rows.push(row('Claim',entry.claim_status==='claimed'?'Dah Claim ✓':'Pending'));
  if(entry.notes) rows.push(row('Nota',entry.notes));
  let recH='';
  if(entry.receipt_url){
    const isPdf=entry.receipt_url.toLowerCase().includes('.pdf');
    recH=isPdf
      ?`<a href="${entry.receipt_url}" target="_blank" rel="noopener" class="detail-receipt-link">📄 Buka Resit (PDF)</a>`
      :`<img src="${entry.receipt_url}" class="detail-receipt" alt="Resit"/><a href="${entry.receipt_url}" target="_blank" rel="noopener" class="detail-receipt-link" style="margin-top:8px;">⬇ Download Resit</a>`;
  }
  detailBody.innerHTML=rows.join('')+recH;
  // Claim toggle
  if(entry.needs_claim&&isOwner){
    const isClaimed=entry.claim_status==='claimed';
    const tb=document.createElement('button');tb.type='button';tb.className='detail-receipt-link';
    tb.style.cssText='margin-top:8px;width:100%;border:none;background:rgba(26,122,74,0.2);color:#4ACA7A;cursor:pointer;';
    tb.textContent=isClaimed?'Tandakan Pending':'Tandakan Dah Claim';
    tb.addEventListener('click',async()=>{
      const{error}=await sb.from('fuel_entries').update({claim_status:isClaimed?'pending':'claimed'}).eq('id',entry.id);
      if(!error){detailDialog.close();showToast('Status dikemaskini ✓');loadEntries();}
    });
    detailBody.appendChild(tb);
  }
  // Actions
  detailActions.innerHTML='';
  if(isOwner||state.isAdmin){
    const db=document.createElement('button');db.type='button';db.className='danger-btn';
    db.textContent=(state.isAdmin&&!isOwner)?'🔐 Padam (Admin)':'Padam Entry';
    db.addEventListener('click',()=>deleteEntry(entry));
    detailActions.appendChild(db);
  }
  detailDialog.showModal();
}

function row(l,v,m=false){return`<div class="detail-row"><span class="detail-label">${l}</span><span class="detail-value${m?' mono':''}">${v}</span></div>`;}

async function deleteEntry(entry){
  if(!confirm('Padam entry ni?'))return;
  if(entry.receipt_path)await sb.storage.from('receipts').remove([entry.receipt_path]);
  const{error}=await sb.from('fuel_entries').delete().eq('id',entry.id);
  if(error){showToast('Gagal padam.');return;}
  detailDialog.close();showToast('Entry dipadam');loadEntries();
}

// ── Init ──────────────────────────────────────────
if('serviceWorker' in navigator)
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

initAuth();
