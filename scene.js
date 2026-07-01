// =============================================
// Minyak Tracker — Unified Scene Engine
// One canvas, one RAF loop — everything synced
// Background + D-Max + weather all in one system
// =============================================
(function(){

const cv = document.getElementById('bgCanvas');
if(!cv) return;
const cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;

// ===== RESIZE =====
function resize(){
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ===== MALAYSIA TIME & WEATHER =====
let weatherState = { phase:'day', rain:false, transAlpha:1 };
let targetPhase = 'day';
let targetRain = false;
let currentTransAlpha = 0;

function getMalaysiaTime(){
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset()*60000;
  return new Date(utc + 8*3600000);
}

function detectPhase(){
  const myt = getMalaysiaTime();
  const h = myt.getHours() + myt.getMinutes()/60;
  const rainSeed = Math.floor(myt.getTime()/(30*60*1000));
  const rng = ((rainSeed * 1234567) % 997) / 997;
  const rain = rng < 0.25;
  let phase;
  if(h >= 6 && h < 17.5) phase = 'day';
  else if(h >= 17.5 && h < 19.5) phase = 'evening';
  else phase = 'night';
  return { phase, rain };
}

// Smooth phase transition
let phaseBlend = 0; // 0=fully current, 1=fully target
let prevPhase = 'day', prevRain = false;
let nextPhase = 'day', nextRain = false;
const TRANS_DUR = 180; // frames for transition
let transFrame = TRANS_DUR;

function updatePhase(){
  const det = detectPhase();
  if(det.phase !== nextPhase || det.rain !== nextRain){
    prevPhase = nextPhase; prevRain = nextRain;
    nextPhase = det.phase; nextRain = det.rain;
    transFrame = 0;
  }
  transFrame++;
  phaseBlend = Math.min(1, transFrame / TRANS_DUR);
}
setInterval(updatePhase, 8000);
updatePhase();

// ===== PALETTES =====
const P = {
  day:{
    skyT:'#5A9EC8',skyM:'#7AB8DA',skyH:'#9ACCE8',
    seaD:'#1E7A9A',seaM:'#2890B4',seaL:'#38A0C0',foam:'#70C0D8',
    iD:'#1A4A1A',iM:'#2A6A2A',iL:'#3A8A3A',sand:'#C0A040',
    road:'#585468',roadS:'#6A6680',roadY:'#C8A818',roadW:'rgba(220,215,170,0.8)',
    grass:'#3A7A2A',grassD:'#286018',
    sunA:1,moonA:0,starA:0,amb:null,fog:null,
    truckC:'#F5F5F5',truckS:'#DCDCDC',truckD:'#C8C8C8'
  },
  evening:{
    skyT:'#C85A20',skyM:'#E88840',skyH:'#F0A860',
    seaD:'#8A4A1A',seaM:'#A06030',seaL:'#B87840',foam:'#D09060',
    iD:'#2A1A0A',iM:'#3A2A10',iL:'#4A3818',sand:'#A87830',
    road:'#483A28',roadS:'#5A4A38',roadY:'#A08010',roadW:'rgba(180,165,120,0.6)',
    grass:'#2A5A18',grassD:'#1A3A10',
    sunA:0.5,moonA:0.4,starA:0.15,amb:'rgba(200,80,0,0.1)',fog:null,
    truckC:'#E8E8E0',truckS:'#D0D0C0',truckD:'#B8B8A8'
  },
  rain:{
    skyT:'#1E2C3C',skyM:'#283848',skyH:'#384858',
    seaD:'#0A3A4E',seaM:'#144A5E',seaL:'#1E5A6E',foam:'#2E6A7A',
    iD:'#0E180E',iM:'#162018',iL:'#1E2C1E',sand:'#706030',
    road:'#383648',roadS:'#484660',roadY:'#806808',roadW:'rgba(140,135,100,0.5)',
    grass:'#204010',grassD:'#142808',
    sunA:0.05,moonA:0,starA:0,amb:'rgba(60,90,120,0.28)',fog:'rgba(100,130,160,0.12)',
    truckC:'#D8D8D8',truckS:'#C0C0C0',truckD:'#A8A8A8'
  },
  night:{
    skyT:'#04080E',skyM:'#080E1A',skyH:'#0C1424',
    seaD:'#060C14',seaM:'#0A1018',seaL:'#0E1820',foam:'#141E28',
    iD:'#060A06',iM:'#0A100A',iL:'#0E160E',sand:'#3A2C10',
    road:'#1E1C28',roadS:'#26243A',roadY:'#604C0E',roadW:'rgba(120,115,80,0.4)',
    grass:'#0E1E08',grassD:'#081006',
    sunA:0,moonA:1,starA:1,amb:null,fog:null,
    truckC:'#D0D0D0',truckS:'#B8B8B8',truckD:'#A0A0A0'
  }
};

function hexR(h){ return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
function lC(c1,c2,f){
  if(!c1||!c2||c1[0]!='#'||c2[0]!='#') return c1||c2||'#000';
  const a=hexR(c1),b=hexR(c2);
  return `rgb(${Math.round(a[0]+f*(b[0]-a[0]))},${Math.round(a[1]+f*(b[1]-a[1]))},${Math.round(a[2]+f*(b[2]-a[2]))})`;
}

function blendPal(a,b,f){
  const out={};
  for(const k in a){
    const av=a[k],bv=b[k];
    if(typeof av==='number') out[k]=av+(bv-av)*f;
    else if(av&&bv&&av[0]==='#'&&bv[0]==='#') out[k]=lC(av,bv,f);
    else out[k]=f>0.5?bv:av;
  }
  return out;
}

function getPal(){
  const a = nextRain ? blendPal(P[prevPhase],P.rain,phaseBlend) : P[prevPhase];
  const b = nextRain ? P.rain : P[nextPhase];
  if(!nextRain && prevRain) return blendPal(P.rain, P[nextPhase], phaseBlend);
  return blendPal(a,b,phaseBlend);
}

// ===== PARTICLE SYSTEMS =====
const stars=[];
for(let i=0;i<200;i++) stars.push({
  x:Math.random()*3000,y:Math.random()*500,
  s:Math.random()<0.1?2:1,
  spd:0.015+Math.random()*0.03,
  off:Math.random()*Math.PI*2,
  br:0.4+Math.random()*0.6
});

const birds=[];
for(let i=0;i<9;i++) birds.push({
  x:Math.random()*3000,y:25+Math.random()*130,
  spd:0.5+Math.random()*0.9,
  flap:Math.random()*Math.PI*2,
  sz:i%3===0?2:1
});

const rainDrops=[];
for(let i=0;i<400;i++) rainDrops.push({
  x:Math.random()*3000,y:Math.random()*2000,
  l:6+Math.random()*11,spd:9+Math.random()*7,
  a:0.25+Math.random()*0.45
});

const puddleBase=[
  {rx:0.06,ry:0.806,rw:0.05,rh:0.016},
  {rx:0.18,ry:0.812,rw:0.038,rh:0.013},
  {rx:0.30,ry:0.808,rw:0.055,rh:0.018},
  {rx:0.44,ry:0.814,rw:0.042,rh:0.014},
  {rx:0.55,ry:0.810,rw:0.048,rh:0.016},
  {rx:0.67,ry:0.808,rw:0.036,rh:0.013},
  {rx:0.80,ry:0.812,rw:0.05,rh:0.015},
];

const splashes=[];
let splashT=0;
function addSplash(x,y){
  for(let i=0;i<5;i++) splashes.push({
    x,y,vx:(Math.random()-.5)*3.5,vy:-2.5-Math.random()*2,
    life:0,max:16+Math.random()*10
  });
}

const puffs=[];
let puffT=0;

// D-Max wheel spin
let wspin=0;
// Island beam angles
let bA1=0,bA2=0;
// Cloud offsets
let cOff=0;
// Wave offset
let wOff=0;
// dash offset
let dashOff=0;
// Global frame counter
let t=0;

// ===== HELPERS =====
function dr(x,y,w,h,c,a=1){
  if(a!==1) cx.globalAlpha=Math.max(0,Math.min(1,a));
  cx.fillStyle=c;
  cx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
  if(a!==1) cx.globalAlpha=1;
}

// ===== MAIN LOOP =====
function frame(){
  const W=cv.width,H=cv.height;
  const pal=getPal();
  const isNight=nextPhase==='night'&&!nextRain&&phaseBlend>0.3;
  const isRain=nextRain&&phaseBlend>0.1;
  const nightStr=nextPhase==='night'&&!nextRain?Math.min(1,phaseBlend*1.5):0;
  const rainStr=nextRain?Math.min(1,phaseBlend*1.8):0;
  const sc=Math.min(W,H*2)/520; // scale factor

  cx.clearRect(0,0,W,H);

  // ===== SKY =====
  const sg=cx.createLinearGradient(0,0,0,H*0.62);
  sg.addColorStop(0,pal.skyT);
  sg.addColorStop(0.55,pal.skyM);
  sg.addColorStop(1,pal.skyH);
  cx.fillStyle=sg; cx.fillRect(0,0,W,H*0.62);

  // Rain sky extra darkness
  if(isRain){
    cx.fillStyle=`rgba(20,28,40,${rainStr*0.4})`;
    cx.fillRect(0,0,W,H*0.62);
  }

  // ===== STARS =====
  if(pal.starA>0.02){
    stars.forEach(s=>{
      s.x-=s.spd;
      if(s.x<-5) s.x=W+5;
      const tw=0.5+0.5*Math.sin(t*s.spd*4+s.off);
      const a=pal.starA*tw*s.br;
      if(a<0.03) return;
      cx.globalAlpha=a;
      if(s.s===2){
        cx.fillStyle='#FFFFFF';
        cx.fillRect(s.x,s.y,1,3); cx.fillRect(s.x-1,s.y+1,3,1);
        cx.globalAlpha=a*0.4;
        cx.fillStyle='rgba(200,215,255,1)';
        cx.fillRect(s.x-1,s.y-1,1,1);cx.fillRect(s.x+1,s.y-1,1,1);
        cx.fillRect(s.x-1,s.y+3,1,1);cx.fillRect(s.x+1,s.y+3,1,1);
      } else {
        cx.fillStyle='rgba(200,215,255,1)';
        cx.fillRect(s.x,s.y,1,1);
      }
      cx.globalAlpha=1;
    });
  }

  // SUN
  if(pal.sunA>0.02){
    const sx=W*0.14,sy=H*0.1;
    cx.globalAlpha=pal.sunA;
    dr(sx,sy,26,26,'#FFE880');
    dr(sx+4,sy+4,18,18,'#FFD840');
    dr(sx+8,sy+8,10,10,'#FFF0C0');
    [[sx+9,sy-12,5,9],[sx+19,sy-5,9,5],[sx+23,sy+9,9,5],[sx+19,sy+21,9,5],
     [sx+9,sy+28,5,9],[sx-4,sy+21,9,5],[sx-8,sy+9,9,5],[sx-4,sy-5,9,5]].forEach(r=>dr(r[0],r[1],r[2],r[3],'#FFE880'));
    // Evening sun glow
    if(nextPhase==='evening'){
      cx.globalAlpha=pal.sunA*0.3;
      const eg=cx.createRadialGradient(sx+13,sy+13,8,sx+13,sy+13,80);
      eg.addColorStop(0,'rgba(255,140,20,0.5)');
      eg.addColorStop(1,'rgba(255,140,20,0)');
      cx.fillStyle=eg; cx.fillRect(sx-70,sy-70,170,170);
    }
    cx.globalAlpha=1;
  }

  // MOON
  if(pal.moonA>0.02){
    const mx=W*0.82,my=H*0.07;
    cx.globalAlpha=pal.moonA;
    dr(mx,my,24,24,'#F5E88A');
    dr(mx+4,my+4,16,16,'#FFE066');
    dr(mx+8,my+8,8,8,'#FFF0A0');
    dr(mx+10,my+6,3,3,'rgba(255,255,255,0.6)');
    cx.globalAlpha=pal.moonA*0.6;
    const mg=cx.createRadialGradient(mx+12,my+12,5,mx+12,my+12,50);
    mg.addColorStop(0,'rgba(255,240,150,0.35)');
    mg.addColorStop(1,'rgba(255,240,150,0)');
    cx.fillStyle=mg; cx.fillRect(mx-38,my-38,100,100);
    cx.globalAlpha=1;
  }

  // CLOUDS
  cOff+=isRain?0.04:0.1;
  const cloudColors=isNight?'rgba(8,18,35,0.55)':isRain?'rgba(40,55,75,0.88)':'rgba(255,255,255,0.92)';
  [[0.06,0.055,0.17,0.058],[0.32,0.038,0.22,0.065],[0.6,0.065,0.16,0.052],[0.8,0.028,0.19,0.062]].forEach((cl,ci)=>{
    const cxp=((cl[0]+cOff*0.00014*(ci+1))%1.15)*W;
    const cyp=cl[1]*H,cw=cl[2]*W,ch=cl[3]*H;
    const ca=isNight?0.15:isRain?0.82:0.88;
    cx.globalAlpha=ca;
    cx.fillStyle=cloudColors;
    cx.fillRect(cxp,cyp+ch*.4,cw,ch*.6);
    cx.fillRect(cxp+cw*.08,cyp+ch*.15,cw*.84,ch*.7);
    cx.fillRect(cxp+cw*.18,cyp,cw*.64,ch*.5);
    if(isRain){
      cx.globalAlpha=ca*0.4;
      cx.fillStyle='rgba(20,28,45,0.9)';
      cx.fillRect(cxp+cw*.05,cyp+ch*.75,cw*.9,ch*.3);
    }
    cx.globalAlpha=1;
  });

  // ===== SEA =====
  const seaY=H*0.5;
  const seaH=H*0.22;
  const sg2=cx.createLinearGradient(0,seaY,0,seaY+seaH);
  sg2.addColorStop(0,pal.seaM);
  sg2.addColorStop(1,pal.seaD);
  cx.fillStyle=sg2; cx.fillRect(0,seaY,W,seaH);
  // Texture
  cx.fillStyle=pal.seaL;
  for(let sy2=seaY;sy2<seaY+seaH*0.6;sy2+=4){
    for(let sx2=((sy2/4)%2===0?0:3);sx2<W;sx2+=7) cx.fillRect(sx2,sy2,2,2);
  }
  // Moon sea reflection
  if(pal.moonA>0.15){
    const mr=cx.createLinearGradient(W*.72,seaY,W*.95,seaY+seaH);
    mr.addColorStop(0,'rgba(255,240,150,0)');
    mr.addColorStop(.4,`rgba(255,240,150,${0.13*pal.moonA})`);
    mr.addColorStop(1,'rgba(255,240,150,0)');
    cx.fillStyle=mr; cx.fillRect(W*.6,seaY,W*.4,seaH);
  }
  // Evening sea glow
  if(nextPhase==='evening'&&pal.sunA>0.1){
    cx.globalAlpha=pal.sunA*0.35;
    const er=cx.createLinearGradient(0,seaY,W*.5,seaY+seaH);
    er.addColorStop(0,'rgba(255,110,20,0.5)');
    er.addColorStop(1,'rgba(255,110,20,0)');
    cx.fillStyle=er; cx.fillRect(0,seaY,W*.6,seaH);
    cx.globalAlpha=1;
  }
  // WAVES
  wOff=(wOff+0.7)%55;
  for(let wr=0;wr<5;wr++){
    const wy=seaY+5+wr*9;
    for(let wx2=-wOff+wr*13;wx2<W;wx2+=55){
      cx.globalAlpha=0.32-wr*.055;
      dr(wx2,wy,20,2,pal.foam);
      dr(wx2+4,wy-1,10,1,pal.foam);
    }
  }
  cx.globalAlpha=1;
  // Rain on sea
  if(isRain){
    cx.fillStyle=`rgba(180,200,220,${rainStr*0.2})`;
    for(let ri=0;ri<25;ri++){
      const rx=((ri*41+t*2.5)%W);
      const ry=seaY+((ri*29+t*1.8)%seaH);
      cx.fillRect(rx,ry,2,1);
    }
  }

  // ===== PULAU TALANG KECIL — LEFT =====
  const ikW=Math.round(W*0.13),ikH=Math.round(H*0.19);
  const ikx=Math.round(W*0.04),iky=Math.round(seaY-ikH+H*0.025);
  for(let l=0;l<9;l++){
    const p=l/9;
    dr(ikx+Math.round(l*ikW*.055),iky+Math.round(ikH*(.45+p*.55)),Math.round(ikW*(1-p*.52)),Math.round(ikH*.12),lC(pal.iD,pal.iL,1-p*.8));
  }
  dr(ikx,iky+Math.round(ikH*.93),ikW,Math.round(ikH*.07),pal.sand);
  [[.18,.32],[.44,.2],[.72,.28]].forEach(tp=>{
    const tbx=ikx+Math.round(tp[0]*ikW),tby=iky+Math.round(tp[1]*ikH);
    dr(tbx,tby,3,Math.round(ikH*.28),pal.iD);
    dr(tbx-5,tby-9,16,9,pal.iM);
    dr(tbx-3,tby-4,12,5,pal.iL);
    dr(tbx+1,tby+Math.round(ikH*.28),2,12,'#5A3020');
  });
  // Night watcher Kecil
  if(nightStr>0.35){
    bA1=Math.sin(t*.013)*.55;
    const pw=ikx+Math.round(ikW*.68),ph=iky+Math.round(ikH*.76);
    dr(pw,ph-11,4,11,`rgba(5,5,2,${nightStr})`);
    dr(pw-1,ph-14,6,4,`rgba(5,5,2,${nightStr})`);
    cx.globalAlpha=nightStr*.24;
    cx.save(); cx.translate(pw+2,ph-9); cx.rotate(bA1-.55);
    const b1g=cx.createLinearGradient(0,0,90,0);
    b1g.addColorStop(0,'rgba(255,240,200,1)');b1g.addColorStop(1,'rgba(255,240,200,0)');
    cx.fillStyle=b1g; cx.beginPath();cx.moveTo(0,0);cx.lineTo(90,-20);cx.lineTo(90,20);cx.closePath();cx.fill();
    cx.restore();
    cx.globalAlpha=nightStr;
    dr(pw,ph-11,4,2,'#FFF0A0');dr(pw+1,ph-10,2,2,'#FFFFFF');
    cx.globalAlpha=1;
  }

  // ===== PULAU TALANG BESAR — RIGHT =====
  const ibW=Math.round(W*0.22),ibH=Math.round(H*0.24);
  const ibx=Math.round(W*0.7),iby=Math.round(seaY-ibH+H*0.032);
  for(let l=0;l<11;l++){
    const p=l/11;
    dr(ibx+Math.round(l*ibW*.045),iby+Math.round(ibH*(.4+p*.6)),Math.round(ibW*(1-p*.42)),Math.round(ibH*.1),lC(pal.iD,pal.iL,1-p*.75));
  }
  dr(ibx,iby+Math.round(ibH*.95),ibW,Math.round(ibH*.05),pal.sand);
  [[.1,.25],[.28,.14],[.48,.08],[.66,.17],[.84,.23]].forEach(tp=>{
    const tbx=ibx+Math.round(tp[0]*ibW),tby=iby+Math.round(tp[1]*ibH);
    dr(tbx,tby,3,Math.round(ibH*.3),pal.iD);
    dr(tbx-5,tby-10,17,10,pal.iM);
    dr(tbx-3,tby-5,13,6,pal.iL);
    dr(tbx+1,tby+Math.round(ibH*.3),2,13,'#5A3020');
    dr(tbx+1,tby+Math.round(ibH*.28),4,4,'#8B6914');
  });
  // Hut
  dr(ibx+Math.round(ibW*.52),iby+Math.round(ibH*.82),Math.round(ibW*.2),Math.round(ibH*.1),'#7A5A14');
  dr(ibx+Math.round(ibW*.5),iby+Math.round(ibH*.78),Math.round(ibW*.24),Math.round(ibH*.06),'#5A3A0C');
  // Night watcher Besar
  if(nightStr>0.35){
    bA2=Math.sin(t*.011+1.2)*.45;
    const pw=ibx+Math.round(ibW*.38),ph=iby+Math.round(ibH*.73);
    dr(pw,ph-11,4,11,`rgba(5,5,2,${nightStr})`);
    dr(pw-1,ph-14,6,4,`rgba(5,5,2,${nightStr})`);
    cx.globalAlpha=nightStr*.2;
    cx.save(); cx.translate(pw+2,ph-9); cx.rotate(bA2-.3);
    const b2g=cx.createLinearGradient(0,0,100,0);
    b2g.addColorStop(0,'rgba(255,240,200,0.8)');b2g.addColorStop(1,'rgba(255,240,200,0)');
    cx.fillStyle=b2g; cx.beginPath();cx.moveTo(0,0);cx.lineTo(100,-22);cx.lineTo(100,22);cx.closePath();cx.fill();
    cx.restore();
    cx.globalAlpha=nightStr;
    dr(pw,ph-11,4,2,'#FFF0A0');dr(pw+1,ph-10,2,2,'#FFFFFF');
    cx.globalAlpha=1;
    // Second watcher on beach
    const pw3=ibx+Math.round(ibW*.7),ph3=iby+Math.round(ibH*.9);
    dr(pw3,ph3-9,3,9,`rgba(5,5,2,${nightStr})`);
    cx.globalAlpha=nightStr*.15;
    cx.save();cx.translate(pw3+1,ph3-7);cx.rotate(-bA2*.4);
    const b3g=cx.createLinearGradient(0,0,70,0);
    b3g.addColorStop(0,'rgba(255,240,200,0.6)');b3g.addColorStop(1,'rgba(255,240,200,0)');
    cx.fillStyle=b3g;cx.beginPath();cx.moveTo(0,0);cx.lineTo(70,-16);cx.lineTo(70,16);cx.closePath();cx.fill();
    cx.restore();
    cx.globalAlpha=nightStr;
    dr(pw3,ph3-9,3,2,'#FFF0A0');
    cx.globalAlpha=1;
  }

  // ===== GRASS + ROAD =====
  const gY=H*0.728;
  const rY=H*0.756;
  dr(0,gY,W,rY-gY,pal.grassD);
  dr(0,gY+2,W,rY-gY-4,pal.grass);
  cx.fillStyle=pal.grassD;
  for(let gx=0;gx<W;gx+=4) if((gx/4)%2===0) cx.fillRect(gx,gY,2,4);
  for(let gx=0;gx<W;gx+=7){
    dr(gx,gY-3-Math.round(Math.sin(gx*.3+t*.02)),2,5,pal.grass);
  }
  // Road
  dr(0,rY,W,3,pal.road);
  dr(0,rY+3,W,H*0.175,pal.roadS);
  // Road texture
  cx.fillStyle='rgba(0,0,0,0.1)';
  for(let ry2=rY+3;ry2<rY+H*.175;ry2+=4){
    for(let rx2=(ry2%8<4?0:4);rx2<W;rx2+=9) cx.fillRect(rx2,ry2,2,2);
  }
  dr(0,rY+4,W,2,pal.roadY);
  dr(0,rY+H*.162,W,2,pal.roadY);
  // Center dashes
  dashOff=(dashOff+0.9)%50;
  for(let dx=-dashOff;dx<W;dx+=50){
    dr(dx,rY+H*.085,32,H*.006,pal.roadW);
  }
  // Guardrail
  dr(0,rY,W,3,'#9A9AA8'); dr(0,rY+H*.17,W,3,'#9A9AA8');
  const gpStep=Math.round(W/14);
  for(let gp=0;gp<W;gp+=gpStep){
    dr(gp,rY,3,H*.02,'#888898');dr(gp,rY+H*.15,3,H*.022,'#888898');
  }

  // ===== PUDDLES =====
  if(isRain){
    puddleBase.forEach(pd=>{
      const px=pd.rx*W,py=pd.ry*H,pw2=pd.rw*W,ph2=pd.rh*H;
      cx.globalAlpha=0.75*rainStr;
      dr(px,py,pw2,ph2,'#141E2E');
      dr(px+2,py+1,pw2-4,ph2-2,'#1E2A3E');
      cx.globalAlpha=0.35*rainStr;
      dr(px+4,py+1,pw2-10,1,'rgba(140,175,215,0.9)');
      if(nightStr>0.3){
        cx.globalAlpha=nightStr*rainStr*0.45;
        dr(px+pw2/2-4,py,8,ph2,'rgba(255,200,80,0.7)');
      }
      cx.globalAlpha=1;
    });
    // Splashes
    splashT++;
    if(splashT%5===0){
      const pd=puddleBase[Math.floor(Math.random()*puddleBase.length)];
      addSplash(pd.rx*W+Math.random()*pd.rw*W,pd.ry*H);
    }
  }
  for(let i=splashes.length-1;i>=0;i--){
    const s=splashes[i];
    s.x+=s.vx;s.y+=s.vy;s.vy+=0.28;s.life++;
    if(s.life>s.max){splashes.splice(i,1);continue;}
    const a=(1-s.life/s.max)*0.65*(isRain?rainStr:0);
    if(a>0.02) dr(s.x,s.y,2,2,'#7AACCC',a);
  }

  // ===== D-MAX — facing LEFT, bottom right =====
  const S=(v)=>Math.round(v*sc);
  wspin+=0.1;
  const tx=W-S(188),ty=rY+S(4);

  // Headlight beam — sync'd with night weather
  if(nightStr>0.4){
    const bs=(nightStr-.4)*1.67;
    cx.globalAlpha=bs*.22;
    const hb=cx.createLinearGradient(tx+S(8),ty+S(14),tx-S(190),ty+S(22));
    hb.addColorStop(0,'rgba(255,215,90,1)');hb.addColorStop(1,'rgba(255,215,90,0)');
    cx.fillStyle=hb;
    cx.beginPath();cx.moveTo(tx+S(8),ty+S(10));cx.lineTo(tx-S(200),ty-S(6));cx.lineTo(tx-S(200),ty+S(40));cx.closePath();cx.fill();
    // Road glow
    cx.globalAlpha=bs*.17;
    cx.fillStyle='rgba(255,205,70,0.5)';
    cx.beginPath();cx.ellipse(tx-S(90),rY+S(80),S(130),S(14),0,0,Math.PI*2);cx.fill();
    // Rain refracts headlight through drops
    if(isRain){
      cx.globalAlpha=bs*rainStr*.1;
      cx.fillStyle='rgba(255,215,90,0.4)';
      cx.fillRect(tx-S(190),ty-S(10),S(190),S(60));
    }
    cx.globalAlpha=1;
  }

  // Truck shadow
  cx.globalAlpha=0.22;cx.fillStyle='#000';
  cx.beginPath();cx.ellipse(tx+S(88),ty+S(58),S(82),S(5),0,0,Math.PI*2);cx.fill();cx.globalAlpha=1;

  const wC=pal.truckC,lgC=pal.truckS,dkC=pal.truckD;

  // TRAY
  dr(tx+S(58),ty+S(10),S(74),S(36),wC);
  dr(tx+S(58),ty+S(10),S(74),S(3),lgC);
  dr(tx+S(58),ty+S(42),S(74),S(4),lgC);
  dr(tx+S(58),ty+S(10),S(3),S(36),lgC);
  dr(tx+S(129),ty+S(10),S(3),S(36),lgC);
  for(let tl=0;tl<3;tl++) dr(tx+S(62),ty+S(15+tl*7),S(64),1,'#C0C0C0');
  dr(tx+S(129),ty+S(14),S(4),S(28),lgC);

  // BARRELS — bob with weather (rain = more violent bob)
  const bobAmp=isRain?2.5:0.9;
  const bob=Math.sin(t*.05)*bobAmp;
  [[64,8],[80,8],[71,0]].forEach((b,i)=>{
    const bx2=tx+S(b[0]),by2=ty+S(b[1])+(i===2?S(-2):0)+bob;
    const bc1=isNight?'#903018':'#C84020',bc2=isNight?'#702010':'#A03010',bc3=isNight?'#B04028':'#E85030';
    dr(bx2,by2,S(14),S(18),bc1);
    dr(bx2,by2,S(14),S(3),bc3);
    dr(bx2,by2+S(15),S(14),S(3),bc2);
    dr(bx2+S(2),by2+S(4),S(2),S(10),bc3);
    dr(bx2+S(10),by2+S(4),S(2),S(10),bc2);
    dr(bx2,by2+S(8),S(14),S(2),bc2);
    // Rain: water dripping off barrel
    if(isRain&&rainStr>0.5){
      cx.globalAlpha=rainStr*.5;
      dr(bx2+S(4),by2+S(18),2,Math.round(3+Math.sin(t*.3+i)*3),'rgba(100,160,200,0.7)');
      cx.globalAlpha=1;
    }
    // Label
    dr(bx2+S(4),by2+S(5),S(6),S(6),'#F0D0A0');
    dr(bx2+S(5),by2+S(6),S(4),S(4),'#E8C890');
  });

  // CABIN
  dr(tx+S(8),ty,S(112),S(48),wC);
  dr(tx+S(8),ty,S(112),S(3),lgC);
  dr(tx+S(8),ty,S(3),S(48),lgC);
  dr(tx+S(60),ty,S(2),S(48),dkC);
  dr(tx+S(28),ty+S(20),S(14),S(3),'#B8B8B8');
  dr(tx+S(70),ty+S(20),S(14),S(3),'#B8B8B8');
  // Roof
  dr(tx+S(10),ty-S(10),S(108),S(12),wC);
  dr(tx+S(10),ty-S(10),S(108),S(2),lgC);
  dr(tx+S(14),ty-S(12),S(98),S(4),dkC);
  // Snorkel
  dr(tx+S(115),ty-S(20),S(5),S(14),dkC);
  dr(tx+S(115),ty-S(22),S(6),S(5),'#AAAAAA');
  // Windshield (LEFT)
  dr(tx+S(8),ty-S(4),S(10),S(34),'#243440');
  dr(tx+S(9),ty-S(2),S(5),S(15),'#2E4050');
  // Windows
  dr(tx+S(22),ty+S(2),S(20),S(22),'#2E5060');
  dr(tx+S(68),ty+S(2),S(20),S(22),'#2E5060');
  dr(tx+S(90),ty+S(2),S(18),S(22),'#2E5060');
  // Window night tint lighter
  if(nightStr>0.4){
    cx.globalAlpha=nightStr*.35;
    [[S(22),S(2),S(20),S(22)],[S(68),S(2),S(20),S(22)],[S(90),S(2),S(18),S(22)]].forEach(w=>{
      dr(tx+w[0],ty+w[1],w[2],w[3],'rgba(80,120,160,0.5)');
    });
    cx.globalAlpha=1;
  }
  // Front fascia (LEFT facing)
  dr(tx,ty+S(10),S(10),S(28),'#E0E0E0');
  dr(tx,ty+S(14),S(10),S(14),'#0E0E0E');
  dr(tx+S(1),ty+S(15),S(8),S(2),'#2A2A2A');dr(tx+S(1),ty+S(19),S(8),S(2),'#2A2A2A');dr(tx+S(1),ty+S(23),S(8),S(2),'#2A2A2A');
  dr(tx,ty+S(12),S(10),S(3),'#C0C0C0');
  dr(tx+S(3),ty+S(13),S(4),1,'#CC0000');
  // HEADLIGHTS
  const hlOn=nightStr>0.4;
  dr(tx,ty+S(2),S(10),S(8),hlOn?'#FFFDE0':'#DDDDB0');
  dr(tx,ty+S(2),S(10),S(2),'#FFFFFF');
  if(hlOn){
    dr(tx,ty+S(4),S(10),S(2),'rgba(160,200,255,0.9)');
    cx.globalAlpha=nightStr*.75;
    const hg=cx.createRadialGradient(tx+S(2),ty+S(6),1,tx+S(2),ty+S(6),S(20));
    hg.addColorStop(0,'rgba(255,240,180,0.9)');hg.addColorStop(1,'rgba(255,240,180,0)');
    cx.fillStyle=hg;cx.fillRect(tx-S(20),ty-S(6),S(36),S(28));cx.globalAlpha=1;
  }
  // Foglights (sync: on during rain AND night)
  const fogOn=hlOn||isRain;
  dr(tx+S(2),ty+S(37),S(6),S(4),fogOn?'rgba(255,255,180,0.95)':'rgba(180,180,100,0.4)');
  if(fogOn&&isRain){
    cx.globalAlpha=rainStr*.35;
    const fg=cx.createRadialGradient(tx+S(5),ty+S(39),2,tx+S(5),ty+S(39),S(40));
    fg.addColorStop(0,'rgba(255,255,150,0.5)');fg.addColorStop(1,'rgba(255,255,150,0)');
    cx.fillStyle=fg;cx.fillRect(tx-S(35),ty+S(28),S(55),S(30));cx.globalAlpha=1;
  }
  // Hood
  dr(tx+S(18),ty-S(6),S(44),S(8),'#F0F0F0');
  dr(tx+S(22),ty-S(8),S(36),S(6),'#EEEEEE');
  // Rain on hood — water streaks
  if(isRain){
    cx.globalAlpha=rainStr*.4;
    for(let rs=0;rs<4;rs++) dr(tx+S(22+rs*8),ty-S(4),2,S(8),'rgba(160,190,220,0.6)');
    cx.globalAlpha=1;
  }
  // Running board
  dr(tx+S(10),ty+S(46),S(118),S(5),dkC);
  // Mud flaps
  dr(tx+S(8),ty+S(42),S(5),S(10),'#2A2A2A');
  dr(tx+S(122),ty+S(42),S(5),S(10),'#2A2A2A');
  // Wheel arches
  dr(tx+S(12),ty+S(38),S(44),S(14),wC);
  dr(tx+S(84),ty+S(38),S(42),S(14),wC);
  // Tail lights
  const tlC=nightStr>0.3?'#FF1818':'#BB1414';
  dr(tx+S(129),ty+S(10),S(4),S(8),tlC);
  dr(tx+S(130),ty+S(11),S(2),S(6),'#FF3030');
  if(nightStr>0.3){
    cx.globalAlpha=nightStr*.55;
    const tlg=cx.createRadialGradient(tx+S(131),ty+S(14),1,tx+S(131),ty+S(14),S(16));
    tlg.addColorStop(0,'rgba(255,0,0,0.75)');tlg.addColorStop(1,'rgba(255,0,0,0)');
    cx.fillStyle=tlg;cx.fillRect(tx+S(115),ty+S(4),S(30),S(22));cx.globalAlpha=1;
  }

  // WHEELS — spin speed syncs with weather (rain = slower, careful driving)
  [[tx+S(34),ty+S(48)],[tx+S(106),ty+S(48)]].forEach(wh=>{
    const wx=wh[0],wy=wh[1];
    dr(wx-S(18),wy-S(12),S(36),S(24),'#101010');
    dr(wx-S(14),wy-S(8),S(28),S(16),'#0A0A0A');
    // Tread
    [[-S(18),-S(5),S(4),S(10)],[S(14),-S(5),S(4),S(10)],[-S(4),-S(12),S(4),S(4)],[S(2),-S(12),S(4),S(4)],[-S(4),S(8),S(4),S(4)],[S(2),S(8),S(4),S(4)]].forEach(r=>dr(wx+r[0],wy+r[1],r[2],r[3],'#1A1A1A'));
    // Rim
    dr(wx-S(12),wy-S(6),S(24),S(12),'#D0D0D0');
    dr(wx-S(8),wy-S(4),S(16),S(8),'#BBBBBB');
    // Spokes
    for(let sp=0;sp<5;sp++){
      const sa=wspin+sp*(Math.PI*2/5);
      cx.fillStyle='#C8C8C8';
      cx.fillRect(Math.round(wx+Math.cos(sa)*S(7))-1,Math.round(wy+Math.sin(sa)*S(5))-1,3,2);
    }
    dr(wx-S(2),wy-S(2),S(5),S(4),'#E0E0E0');
    // Rain splash from tyres
    if(isRain&&rainStr>0.4){
      const splashX=wx+S(16),splashY=wy+S(10);
      cx.globalAlpha=rainStr*.5;
      for(let rs=0;rs<4;rs++){
        const sa2=wspin*1.3+rs*(Math.PI/2);
        dr(splashX+Math.round(Math.cos(sa2)*S(8)),splashY+Math.round(Math.sin(sa2)*S(4)),2,2,'rgba(140,180,210,0.8)');
      }
      cx.globalAlpha=1;
    }
    // Night tyre glow
    if(nightStr>0.4){
      cx.globalAlpha=nightStr*.14;
      cx.fillStyle='rgba(255,195,70,0.4)';
      cx.beginPath();cx.arc(wx,wy,S(20),0,Math.PI*2);cx.fill();cx.globalAlpha=1;
    }
  });

  // EXHAUST — heavier in rain (cold engine, more exhaust)
  puffT++;
  const puffRate=isRain?8:15;
  if(puffT%puffRate===0){
    puffs.push({x:tx+S(62),y:ty+S(28),r:S(3),vx:-.35,vy:-.25,life:0,max:isRain?55:40});
  }
  for(let i=puffs.length-1;i>=0;i--){
    const p=puffs[i];
    p.x+=p.vx+(isRain?-0.2:0);p.y+=p.vy;p.r+=.22;p.life++;
    if(p.life>p.max){puffs.splice(i,1);continue;}
    const pa=(1-p.life/p.max)*(isRain?.45:.3);
    if(pa>.02){cx.globalAlpha=pa;cx.fillStyle=isRain?'rgba(180,185,200,1)':'rgba(210,210,210,1)';cx.beginPath();cx.arc(p.x,p.y,p.r,0,Math.PI*2);cx.fill();}
  }
  cx.globalAlpha=1;

  // ===== BIRDS — fewer in rain, almost gone at night =====
  const birdCount=isNight?2:isRain?3:birds.length;
  const birdAlpha=isNight?.2:isRain?.55:1;
  for(let bi=0;bi<birdCount;bi++){
    const b=birds[bi];
    b.x-=b.spd*(isRain?.6:1);
    b.flap+=.15;
    if(b.x<-20) b.x=W+20;
    const fy=Math.sin(b.flap)*4;
    const bc=isNight?`rgba(12,12,22,${birdAlpha})`:`rgba(28,28,38,${birdAlpha})`;
    cx.globalAlpha=birdAlpha;
    dr(b.x,b.y,b.sz*4,b.sz*2,bc);
    dr(b.x-b.sz*3,b.y-fy,b.sz*3,b.sz,bc);
    dr(b.x+b.sz*4,b.y-fy,b.sz*3,b.sz,bc);
    dr(b.x+b.sz*5,b.y+b.sz,b.sz*2,b.sz,bc);
    cx.globalAlpha=1;
  }

  // ===== RAIN DROPS — sync everything =====
  if(isRain){
    cx.strokeStyle=`rgba(155,180,205,${.42*rainStr})`;
    cx.lineWidth=1;
    rainDrops.forEach(rd=>{
      rd.x-=2.2;rd.y+=rd.spd;
      if(rd.y>H+20){rd.y=-20;rd.x=Math.random()*W;}
      if(rd.x<-20){rd.x=W+20;rd.y=Math.random()*H;}
      cx.globalAlpha=rd.a*rainStr;
      cx.beginPath();cx.moveTo(rd.x,rd.y);cx.lineTo(rd.x-3,rd.y+rd.l);cx.stroke();
    });
    cx.globalAlpha=1;
    // Mist
    cx.fillStyle=`rgba(110,140,165,${Math.min(.14,rainStr*.16)})`;
    cx.fillRect(0,0,W,H);
    // Droplets on windshield (meta effect)
    cx.fillStyle=`rgba(140,170,200,${rainStr*.08})`;
    cx.fillRect(0,0,W,H*.35);
  }

  // ===== AMBIENT OVERLAY =====
  if(pal.amb){cx.fillStyle=pal.amb;cx.fillRect(0,0,W,H);}
  if(pal.fog){cx.fillStyle=pal.fog;cx.fillRect(0,0,W,H);}

  // Ground strip
  dr(0,rY+H*.175,W,H*.025,pal.grassD);
  dr(0,rY+H*.2,W,H,isNight?'#100E08':'#1A1810');

  t++;
  requestAnimationFrame(frame);
}

// ===== EXPOSE for login success canvas sync =====
// So the login success animation can also use weather state
window.sceneState = {
  getPhase: ()=>nextPhase,
  getRain: ()=>nextRain,
  getNight: ()=>nightStr=>nightStr
};

// Wait for DOM ready
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',frame);
} else {
  frame();
}

})();
