// ═══════════════════════════════════════════════════════════════════════════
//  SANTA CRUZ SUNSETS
//  A generative averaging of hundreds of Pacific sunsets
//  — layers of noise, wave, light, and memory —
//  (ported to the-standard chrome from the original CRT control surface)
// ═══════════════════════════════════════════════════════════════════════════

// ─── LIVE PARAMS ───────────────────────────────────────────────────────────
const PARAMS = {};

// flags for deferred p5 operations (safe via draw loop)
let needVigRebuild = false;
let pendingGlintCount = null;
let pendingPelicanCount = null;

// ─── PALETTE CYCLE ─────────────────────────────────────────────────────────
const CYCLE_SECS = 420; // 7 minutes per full palette cycle (at speed 1×)

// Each palette: sky[6] bands (zenith→horizon), ocean[3] bands (far→near),
// glint, fog[4], sun
const PALETTES = [
  { // ── Golden Hour ──
    sky:   [[52,18,72],[95,32,108],[170,62,78],[232,108,42],[255,142,28],[255,175,55]],
    ocean: [[14,33,72],[22,55,92],[138,72,28]],
    glint: [255,232,138], fog: [238,188,118,52], sun: [255,218,118]
  },
  { // ── Fire & Crimson ──
    sky:   [[32,8,52],[75,18,68],[150,38,52],[228,72,18],[255,108,8],[255,148,28]],
    ocean: [[10,25,62],[16,42,78],[182,72,18]],
    glint: [255,248,158], fog: [255,162,88,42], sun: [255,198,78]
  },
  { // ── Rose & Lavender ──
    sky:   [[68,42,108],[118,68,138],[182,108,142],[238,152,128],[255,182,142],[255,208,168]],
    ocean: [[32,48,92],[48,72,112],[198,138,108]],
    glint: [255,252,218], fog: [238,198,198,62], sun: [255,228,178]
  },
  { // ── Purple Twilight ──
    sky:   [[18,8,52],[52,22,88],[98,42,108],[152,72,118],[188,98,128],[208,128,138]],
    ocean: [[16,16,52],[22,28,78],[108,62,98]],
    glint: [208,192,255], fog: [188,158,208,72], sun: [218,178,228]
  },
  { // ── Pacific Clear ──
    sky:   [[38,22,82],[82,42,98],[158,78,82],[228,118,38],[255,152,32],[255,182,58]],
    ocean: [[8,32,78],[18,58,98],[162,92,32]],
    glint: [255,248,182], fog: [198,178,142,48], sun: [255,222,128]
  },
  { // ── Late Amber ──
    sky:   [[22,12,48],[62,28,72],[128,58,78],[208,98,32],[255,132,18],[255,162,38]],
    ocean: [[12,28,68],[18,48,82],[172,82,22]],
    glint: [255,238,152], fog: [255,192,108,48], sun: [255,208,98]
  }
];

const NP = PALETTES.length;

// palette cycle offset (in palettes) — "next palette" button advances this
let paletteOffset = 0;
let lastCf = 0;

// ─── MATH HELPERS ──────────────────────────────────────────────────────────
function lp(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}
function ss(t) { return t*t*(3-2*t); }

function palBlend(A, B, t) {
  return {
    sky:   A.sky.map((c,i)  => lp(c, B.sky[i], t)),
    ocean: A.ocean.map((c,i)=> lp(c, B.ocean[i], t)),
    glint: lp(A.glint, B.glint, t),
    fog:   [...lp(A.fog, B.fog, t), A.fog[3]+(B.fog[3]-A.fog[3])*t],
    sun:   lp(A.sun, B.sun, t)
  };
}

function skyCol(pal, t) {
  let n = pal.sky.length-1, i = constrain(floor(t*n),0,n-1);
  return lp(pal.sky[i], pal.sky[i+1], (t*n)-i);
}
function oceanCol(pal, t) {
  let n = pal.ocean.length-1, i = constrain(floor(t*n),0,n-1);
  return lp(pal.ocean[i], pal.ocean[i+1], (t*n)-i);
}

// ─── PELICAN ───────────────────────────────────────────────────────────────
class Pelican {
  constructor(init) {
    this.id = floor(random(9999));
    this.reset(init);
  }
  reset(init) {
    this.x    = init ? random(-width, width*1.05) : random(-width*0.18,-width*0.04);
    this.y    = random(height*0.07, height*0.40);
    this.spd  = random(0.38, 0.92);
    this.sz   = random(0.72, 1.55);
    this.ph   = random(TWO_PI);
    this.fr   = random(0.042, 0.088);
    this.glide= false;
    this.cnt  = 0;
    this.gDur = floor(random(70,210));
    this.fDur = floor(random(28,78));
    this.yf   = random(0.007,0.019);
    this.yb   = random(-0.28,0.28);
    this.al   = random(148, 212);
  }
  update() {
    this.x += this.spd * PARAMS.pelicanSpeed;
    this.y += sin(frameCount * this.yf + this.id) * this.yb * 0.48;
    this.ph += this.glide ? 0.007 : this.fr;
    this.cnt++;
    if ( this.glide && this.cnt > this.gDur) { this.glide=false; this.cnt=0; }
    if (!this.glide && this.cnt > this.fDur) { this.glide=true;  this.cnt=0; }
    if (this.x > width*1.18) this.reset(false);
  }
  draw() {
    let ws = this.glide ? 0.82 : (sin(this.ph)*0.34 + 0.66);
    let W = 21*this.sz, H = 5*this.sz*ws;
    push();
    translate(this.x, this.y);
    noFill();
    stroke(0, 0, 0, this.al);
    strokeWeight(1.35*this.sz);
    beginShape();
    vertex(0,0);
    bezierVertex(-W*0.38,-H*0.65,-W*0.74,-H*0.18,-W, H*0.28);
    endShape();
    beginShape();
    vertex(0,0);
    bezierVertex( W*0.38,-H*0.65, W*0.74,-H*0.18, W, H*0.28);
    endShape();
    strokeWeight(1.9*this.sz);
    line(0, H*0.12, W*0.34, -H*0.18);
    pop();
  }
}

// ─── GLINT ─────────────────────────────────────────────────────────────────
class Glint {
  constructor() { this.active=false; this.spawn(); }
  spawn() {
    this.x  = random(width);
    let r   = random();
    this.y  = r < 0.55 ? random(height*0.42, height*0.66)
             : r < 0.82 ? random(height*0.66, height*0.84)
                        : random(height*0.84, height);
    if (random() < 0.42) {
      this.x = width*0.5 + randomGaussian(0, width*0.13);
      this.x = constrain(this.x, 0, width);
    }
    this.life    = 0;
    this.maxLife = random(28,145);
    this.sz      = random(0.5, 3.6);
    this.bright  = random(0.38,1.0);
  }
  update() {
    if (!this.active) { if (random()<0.016) this.active=true; return; }
    this.life++;
    if (this.life > this.maxLife) { this.spawn(); this.active=false; }
  }
  draw(pal) {
    if (!this.active) return;
    let lt = this.life/this.maxLife;
    let a  = sin(lt*PI)*255 * this.bright * PARAMS.glintBrightness;
    let c  = pal.glint;
    noStroke();
    fill(c[0],c[1],c[2], a*0.07); ellipse(this.x,this.y, this.sz*14,this.sz*4.5);
    fill(c[0],c[1],c[2], a*0.14); ellipse(this.x,this.y, this.sz*8, this.sz*2.8);
    fill(c[0],c[1],c[2], a*0.38); ellipse(this.x,this.y, this.sz*3.5,this.sz*1.3);
    fill(min(c[0]+28,255),min(c[1]+18,255),min(c[2]+8,255), a);
                                   ellipse(this.x,this.y, this.sz,this.sz*0.38);
  }
}

// ─── GLOBALS ───────────────────────────────────────────────────────────────
let pelicans=[], glints=[], vig=null;

function rebuildGlints(n) {
  glints = [];
  for (let i=0; i<n; i++) {
    let g = new Glint();
    g.life = floor(random(g.maxLife));
    if (random()<0.62) g.active=true;
    glints.push(g);
  }
}

function adjustPelicans(n) {
  while (pelicans.length < n) pelicans.push(new Pelican(true));
  while (pelicans.length > n) pelicans.pop();
}

// ─── SETUP ─────────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB,255);
  for (let i=0; i<PARAMS.pelicanCount; i++) pelicans.push(new Pelican(true));
  rebuildGlints(PARAMS.glintDensity);
  buildVig();
}

function buildVig() {
  if (vig) vig.remove();
  vig = createGraphics(width, height);
  let ctx = vig.drawingContext;
  let r1  = min(width,height)*0.22;
  let r2  = min(width,height)*0.88;
  let g   = ctx.createRadialGradient(width/2,height/2,r1, width/2,height/2,r2);
  g.addColorStop(0,   'rgba(0,0,0,0)');
  g.addColorStop(0.65,'rgba(0,0,0,'+( PARAMS.vignetteStrength*0.154 ).toFixed(3)+')');
  g.addColorStop(1,   'rgba(0,0,0,'+ PARAMS.vignetteStrength.toFixed(3)+')');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,width,height);
}

// ─── MOUNTAIN HELPERS ──────────────────────────────────────────────────────
function mtY(x, seed) {
  let nx = x/width;
  return height*(
    0.058*noise(nx*3.4 + seed*7.2 + 100) +
    0.026*noise(nx*7.8 + seed*5.0 + 200) +
    0.013*noise(nx*17  + seed*3.6 + 300)
  );
}

// ─── DRAW ──────────────────────────────────────────────────────────────────
function draw() {
  // ── deferred p5 operations from UI ──
  if (needVigRebuild)       { buildVig(); needVigRebuild=false; }
  if (pendingGlintCount   !== null) { rebuildGlints(pendingGlintCount);   pendingGlintCount=null; }
  if (pendingPelicanCount !== null) { adjustPelicans(pendingPelicanCount); pendingPelicanCount=null; }

  let sec  = frameCount/60;
  let nt   = sec*0.038;                       // noise time

  // Palette blend — speed multiplier applied here
  let cf   = ((sec * PARAMS.skyShiftSpeed / CYCLE_SECS * NP + paletteOffset) % NP + NP) % NP;
  lastCf   = cf;
  let iA   = floor(cf)%NP, iB=(iA+1)%NP;
  let pal  = palBlend(PALETTES[iA], PALETTES[iB], ss(cf%1));

  let hy   = height*0.42;

  // ── 1. SKY ────────────────────────────────────────────────────────────────
  {
    noStroke();
    let strips=92, sh=hy/strips;
    for (let i=0;i<strips;i++) {
      let t = i/strips;
      let c = skyCol(pal, t);
      let n1 = noise(t*2.6*PARAMS.noiseScale+28, nt)          - 0.5;
      let n2 = noise(t*1.2*PARAMS.noiseScale+62, nt*0.68+100) - 0.5;
      let ws = n1*26, hs = n2*14;
      fill(
        constrain(c[0]+ws+hs,    0,255),
        constrain(c[1]+ws*0.38+hs*0.18,0,255),
        constrain(c[2]-ws*0.52+hs*0.82,0,255)
      );
      rect(0, i*sh, width, sh+1);
    }
    let gh = hy*0.22, hc = pal.sky[5];
    for (let y=hy-gh; y<hy+gh*0.28; y++) {
      let d=1-abs(y-hy)/gh;
      fill(hc[0],hc[1],hc[2], d*d*95);
      rect(0,y,width,1);
    }
  }

  // ── 2. SUN ────────────────────────────────────────────────────────────────
  {
    let sx = width*0.5 + sin(sec*0.00038)*width*0.042;
    let sy = hy - 7   + sin(sec*0.00022)*4.5;
    let c  = pal.sun;
    noStroke();
    for (let r=9;r>0;r--) {
      let rt=r/9;
      fill(c[0],c[1],c[2], rt*rt*38);
      ellipse(sx,sy,r*36,r*29);
    }
    fill(min(c[0]+28,255),min(c[1]+18,255),min(c[2]+8,255), 215);
    ellipse(sx,sy,40,33);
    fill(255,255,242,195);
    ellipse(sx,sy,19,15);
  }

  // ── 3. MOUNTAINS ─────────────────────────────────────────────────────────
  {
    noStroke();
    fill(22,10,32,205);
    beginShape();
    vertex(0, hy+2);
    for (let x=0;x<=width*0.6;x+=5) vertex(x, hy - mtY(x,0) - mtY(x,1)*0.48);
    vertex(width*0.6, hy+2);
    endShape(CLOSE);
    fill(32,16,42,155);
    beginShape();
    vertex(0, hy+2);
    for (let x=0;x<=width*0.52;x+=5) vertex(x, hy - mtY(x,2)*0.58 + height*0.018);
    vertex(width*0.52, hy+2);
    endShape(CLOSE);
  }

  // ── 4. FOG ────────────────────────────────────────────────────────────────
  {
    let fd  = sec*0.028;
    let fst = (noise(sec*0.018)*0.82+0.08) * PARAMS.fogDensity;
    let fb  = hy*0.32;
    let fc  = pal.fog;
    noStroke();
    let steps=32;
    for (let i=0;i<steps;i++) {
      let ft  = i/steps;
      let fy  = hy - fb*0.38 + ft*fb;
      let al  = sin(ft*PI)*fst*fc[3];
      let fw  = min(width*(0.32+noise(fy*0.009,fd*0.18)*0.52)
              + noise(fy*0.012+fd*0.3,50)*width*0.28, width);
      if (fw<=0||al<=0) continue;
      fill(fc[0],fc[1],fc[2],al);
      rect(0, fy, fw, fb/steps+1);
    }
  }

  // ── 5. OCEAN ──────────────────────────────────────────────────────────────
  {
    noStroke();
    let oh=height-hy, strips=72;
    for (let i=0;i<strips;i++) {
      let t=i/strips, c=oceanCol(pal,t);
      let nv=noise(t*3.1, nt*1.18)-0.5;
      fill(constrain(c[0]+nv*13,0,255), constrain(c[1]+nv*8,0,255), constrain(c[2]+nv*19,0,255));
      rect(0, hy+t*oh, width, oh/strips+1);
    }

    // Wave lines
    let fc2=frameCount;
    noFill();
    for (let w=0;w<13;w++) {
      let wt  = w/13;
      let wy  = hy+(height-hy)*(wt*0.54+0.04);
      let amp = lerp(1.5, 10.5, wt) * PARAMS.waveAmplitude;
      let frq = lerp(0.026,0.010,wt);
      let spd = lerp(1.15, 2.05, wt);
      let c   = oceanCol(pal,wt);
      let hl  = lp(c,[255,255,255],0.14);
      stroke(hl[0],hl[1],hl[2], lerp(52,16,wt));
      strokeWeight(lerp(0.4,1.25,wt));
      beginShape();
      for (let x=0;x<=width;x+=5) {
        let y=wy
          +sin(x*frq + fc2*0.008*spd*PARAMS.waveSpeed)*amp
          +sin(x*frq*1.618+fc2*0.005*spd*PARAMS.waveSpeed)*amp*0.44
          +(noise(x*0.009,wt+nt*0.82)-0.5)*amp*0.68;
        vertex(x,y);
      }
      endShape();
    }
  }

  // ── 6. SUN PATH ───────────────────────────────────────────────────────────
  {
    let c=pal.glint; noStroke();
    for (let i=0;i<62;i++) {
      let t=i/62;
      let py=hy+(height-hy)*t;
      let pw=(t*t*0.34+0.014)*width;
      fill(c[0],c[1],c[2], (1-t*0.65)*52*(1-t*0.28));
      ellipse(width*0.5, py, pw, 4);
    }
  }

  // ── 7. KELP FOREST ────────────────────────────────────────────────────────
  {
    noStroke();
    for (let k=0;k<8;k++) {
      let kx = (noise(k*3.72+0.1)*0.78+0.11)*width;
      let ky = hy+(height-hy)*(0.32+k*0.048);
      let kw = noise(k*2.28+5)*24+7;
      let kh = noise(k*1.82+10)*58+28;
      let sw = sin(sec*0.42+k*1.28)*4.5;
      fill(0,28,12,22);
      beginShape();
      for (let y=0;y<kh;y++) {
        let wv=sin(y*0.19+sec*0.48+k)*kw*0.5+sw;
        vertex(kx+wv,    ky+y);
        vertex(kx+wv+kw, ky+y);
      }
      endShape();
    }
  }

  // ── 8. PIER + BOARDWALK ───────────────────────────────────────────────────
  {
    let psx=width*0.71, psy=hy+(height-hy)*0.185;
    let pex=width*0.499, pey=hy+3;
    push(); noStroke();
    fill(0,0,0,208);
    beginShape();
    vertex(psx-13,psy); vertex(psx+13,psy);
    vertex(pex+4,pey);  vertex(pex-4,pey);
    endShape(CLOSE);
    let np=14;
    for (let i=0;i<np;i++) {
      let pt=i/(np-1);
      let px=lerp(psx,pex,pt), py=lerp(psy,pey,pt);
      let pw=lerp(11,3.2,pt), pd=lerp(52,7,pt);
      fill(0,0,0, lerp(188,95,pt));
      rect(px-pw/2,py,pw,pd);
      if (i<np-1) {
        let np2=(i+1)/(np-1);
        let nx2=lerp(psx,pex,np2), ny2=lerp(psy,pey,np2);
        stroke(0,0,0,lerp(88,38,pt)); strokeWeight(0.55);
        line(px,py+pd*0.38, nx2,ny2+lerp(52,7,np2)*0.38);
        noStroke();
      }
    }
    {
      let ctx2=drawingContext; ctx2.globalAlpha=0.18;
      noStroke();
      for (let i=0;i<13;i++) {
        let pt=i/12;
        let px=lerp(psx,pex,pt), py=lerp(psy,pey,pt);
        let pw=lerp(11,3.2,pt);
        let rp=sin(px*0.058+sec*1.18)*4.2+noise(px*0.024,sec*0.38)*7.5;
        fill(0,0,0,115); rect(px-pw/2,py+rp,pw,2.5);
      }
      ctx2.globalAlpha=1;
    }
    fill(0,0,0,178);
    rect(psx-22, psy, width-(psx-22), height-psy);
    noStroke(); fill(0,0,0,218);
    let bx=psx;
    rect(bx+28,  psy-68, 62, 68);
    rect(bx+100, psy-56, 38, 56);
    rect(bx+148, psy-46, 52, 46);
    rect(bx+210, psy-50, 72, 50);
    rect(bx-18,  psy-40, 26, 40);
    rect(bx-52,  psy-32, 22, 32);
    noFill(); stroke(0,0,0,198); strokeWeight(2.2);
    let gcx=bx+28, gcy=psy-68;
    beginShape();
    for (let x2=0;x2<=62;x2+=2) {
      let xt=x2/62;
      let y2=gcy+18*(sin(xt*PI*1.5)*0.58+abs(sin(xt*PI*3))*0.42)-16;
      vertex(gcx+x2,y2);
    }
    endShape();
    noStroke(); fill(0,0,0,218);
    let tx=bx+100+19, ty=psy-56;
    triangle(tx-7,ty, tx+7,ty, tx,ty-26);
    pop();
  }

  // ── 9. GLINTS ─────────────────────────────────────────────────────────────
  for (let g of glints) { g.update(); g.draw(pal); }

  // ── 10. PELICANS ──────────────────────────────────────────────────────────
  for (let p of pelicans) { p.update(); p.draw(); }

  // ── 11. DREAMY OVERLAY ────────────────────────────────────────────────────
  {
    let c  = pal.sky[4];
    let dc = drawingContext;
    dc.globalCompositeOperation='soft-light';
    noStroke(); fill(c[0],c[1],c[2],22); rect(0,0,width,height);
    dc.globalCompositeOperation='source-over';
    noStroke(); fill(pal.sun[0],pal.sun[1],pal.sun[2],7);
    rect(0,height*0.32,width,height*0.68);
  }

  // ── 12. VIGNETTE ──────────────────────────────────────────────────────────
  image(vig,0,0);

  // ── 13. FILM GRAIN ────────────────────────────────────────────────────────
  {
    noStroke();
    for (let i=0;i<280;i++) {
      let x=random(width), y=random(height);
      let v=random()>0.5?random(185,255):random(0,52);
      fill(v,v,v, random(3.5,11));
      rect(x,y,1,1);
    }
  }
}

// ─── RESIZE ────────────────────────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth,windowHeight);
  buildVig();
  rebuildGlints(PARAMS.glintDensity);
}

// ═══════════════════════════════════════════════════════════════════════════
//  STANDARD CHROME — sliders (the original CTRL_DEFS, restyled) + palette jump
// ═══════════════════════════════════════════════════════════════════════════

(function wireChrome() {
  const container = document.getElementById('controls');

  const SPECS = [
    { id:'skyShiftSpeed',    label:'sky shift',   min:0.1, max:5,   step:0.05, value:1.0,  fmt:v=>v.toFixed(2)+'x' },
    { id:'waveAmplitude',    label:'wave height', min:0,   max:3,   step:0.05, value:1.0,  fmt:v=>v.toFixed(2) },
    { id:'waveSpeed',        label:'wave speed',  min:0,   max:5,   step:0.1,  value:1.0,  fmt:v=>v.toFixed(1)+'x' },
    { id:'glintDensity',     label:'glints',      min:10,  max:500, step:10,   value:230,  fmt:v=>String(Math.round(v)),
      apply:v=>{ PARAMS.glintDensity=v; pendingGlintCount=Math.round(v); } },
    { id:'glintBrightness',  label:'glint glow',  min:0,   max:2,   step:0.05, value:1.0,  fmt:v=>v.toFixed(2) },
    { id:'fogDensity',       label:'fog',         min:0,   max:3,   step:0.05, value:1.0,  fmt:v=>v.toFixed(2) },
    { id:'pelicanCount',     label:'pelicans',    min:0,   max:10,  step:1,    value:6,    fmt:v=>String(Math.round(v)),
      apply:v=>{ PARAMS.pelicanCount=v; pendingPelicanCount=Math.round(v); } },
    { id:'pelicanSpeed',     label:'pelican drift', min:0, max:5,   step:0.1,  value:1.0,  fmt:v=>v.toFixed(1)+'x' },
    { id:'vignetteStrength', label:'vignette',    min:0,   max:1,   step:0.01, value:0.78, fmt:v=>Math.round(v*100)+'%',
      apply:v=>{ PARAMS.vignetteStrength=v; needVigRebuild=true; } },
    { id:'noiseScale',       label:'noise scale', min:0.1, max:3,   step:0.05, value:1.0,  fmt:v=>v.toFixed(2) },
  ];
  SPECS.forEach((s) => Standard.param(container, PARAMS, s));

  // keep the palette-jump button below the sliders
  const nextBtn = document.getElementById('next-palette');
  container.appendChild(nextBtn);
  nextBtn.addEventListener('click', () => {
    // snap the cycle forward to the start of the next palette
    paletteOffset += Math.floor(lastCf) + 1 - lastCf;
  });
})();
