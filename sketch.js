let beat;                
let analyzer;             
let fft;                  
const FFT_SIZE = 1024;  
const BINS = 96;        
const KICK_BAND = [1, 7]; 
const RING_R = 118;      
const KICK_MIN_FLUX = 45; 
const KICK_RATIO = 2.5;   
const KICK_COOLDOWN = 10; 
const TRAIL_ALPHA = 38;   
let spectrum = [];        
let mode = 0;            
const MODE_NAMES = ['ring', 'grid', 'burst'];

let particles = [];      
let rings = [];         
let cooldown = 0;         
let energy = 0;          
let prevLow = [];        
let flux = 0;            
let fluxBase = 0;        
let lastKicks = [];       
let bpm = 0;

let hueBase = 210;        
let isReady = false;      

function preload() {
  beat = loadSound('beat.mp3', () => { isReady = true; });
}

function setup() {
  const myCanvas = createCanvas(720, 480);
  myCanvas.parent('myContainer');

  analyzer = new p5.Amplitude();
  analyzer.setInput(beat);
  analyzer.smooth(0.85);

  fft = new p5.FFT(0.8, FFT_SIZE);
  fft.setInput(beat);

  for (let i = 0; i < BINS; i++) spectrum.push(0);
  for (let i = 0; i < FFT_SIZE / 2; i++) prevLow.push(0);

  colorMode(HSB, 360, 100, 100, 1);
  textFont('monospace');
  describe('A sound reactive sketch: bars and particles grow with the beat of a drum loop.');
}

function mousePressed() {

  userStartAudio();
  if (!isReady) return;

  if (beat.isPlaying()) {
    beat.pause();
  } else {
    beat.loop();
  }
}

function keyPressed() {
  if (key === 'n' || key === 'N') {
    mode = (mode + 1) % MODE_NAMES.length;
  }
  if (key === ' ') { 
    mousePressed();
  }
}

function bandEnergy(from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += spectrum[i] || 0;
  return sum / Math.max(1, to - from);
}

function detectKick(raw) {
  flux = 0;
  for (let i = KICK_BAND[0]; i < KICK_BAND[1]; i++) {
    flux += Math.max(0, raw[i] - prevLow[i]);
    prevLow[i] = raw[i];
  }

  fluxBase = fluxBase * 0.95 + flux * 0.05;
  energy = energy * 0.85 + bandEnergy(KICK_BAND[0], KICK_BAND[1]) * 0.15;

  if (cooldown > 0) cooldown--;

  const isHit =
    cooldown === 0 &&
    flux > KICK_MIN_FLUX &&
    flux > fluxBase * KICK_RATIO;

  if (isHit) cooldown = KICK_COOLDOWN;
  return isHit;
}

function estimateBpm(now) {
  lastKicks.push(now);
  if (lastKicks.length > 16) lastKicks.shift();
  if (lastKicks.length < 5) return;


  const gaps = [];
  for (let i = 1; i < lastKicks.length; i++) {
    const gap = lastKicks[i] - lastKicks[i - 1];
    if (gap > 180 && gap < 1500) gaps.push(gap); 
  }
  if (gaps.length < 3) return;
  gaps.sort((a, b) => a - b);
  bpm = Math.round(60000 / gaps[Math.floor(gaps.length / 2)]);
}


function draw() {
  noStroke();
  fill(230, 60, 4, TRAIL_ALPHA / 255);
  rect(0, 0, width, height);

  
  const raw = fft.analyze();                       
  spectrum = raw.slice(0, BINS).map((v) => constrain(v / 255, 0, 1));

  let rms = analyzer.getLevel() || 0;
  rms = constrain(rms, 0, 1);

  const kicked = detectKick(raw);
  if (kicked) {
    estimateBpm(millis());
    spawnParticles(rms);
    rings.push({ r: RING_R * 0.6, a: 0.9, hue: hueBase + 40 });
  }

  hueBase = (hueBase + 0.15) % 360;

 
  background_glow(rms);

  if (mode === 0) drawRing(rms);
  else if (mode === 1) drawGrid(rms);
  else drawBurst(rms);

  updateParticles();
  updateRings();
  drawCore(rms, kicked);
  drawHud(rms);
}


function background_glow(rms) {
  push();
  blendMode(ADD);
  noStroke();
  for (let i = 6; i > 0; i--) {
    fill(hueBase, 55, 8 + rms * 40, 0.05);
    ellipse(width / 2, height / 2, i * 120 + rms * 260, i * 120 + rms * 260);
  }
  pop();
}


function drawRing(rms) {
  push();
  translate(width / 2, height / 2);
  blendMode(ADD);
  strokeWeight(3);
  strokeCap(ROUND);

  const rot = millis() * 0.00012;

  for (let i = 0; i < BINS; i++) {
    const a = (i / BINS) * TWO_PI + rot;
    const v = spectrum[i];
    const inner = RING_R + 10 + rms * 30;
    const outer = inner + 8 + v * 150;

    const hue = (hueBase + i * 2.4) % 360;
    stroke(hue, 80, 70 + v * 30, 0.25 + v * 0.75);
    line(cos(a) * inner, sin(a) * inner, cos(a) * outer, sin(a) * outer);

    stroke(hue, 60, 55, 0.12 + v * 0.4);
    line(cos(-a) * inner, sin(-a) * inner, cos(-a) * outer, sin(-a) * outer);
  }
  pop();
}

function drawGrid(rms) {
  push();
  blendMode(ADD);
  const mid = width / 2;
  const bw = mid / BINS;

  noStroke();
  for (let i = 0; i < BINS; i++) {
    const v = spectrum[i];
    const h = 4 + v * (height * 0.42) + rms * 30;
    const hue = (hueBase + i * 3) % 360;

    fill(hue, 75, 60 + v * 40, 0.55);
    rect(i * bw, height - h, bw * 0.72, h);            
    rect(width - (i + 1) * bw, height - h, bw * 0.72, h); 
  }

  // horizontal midline that breathes with the volume
  stroke(hueBase, 40, 90, 0.5);
  strokeWeight(1 + rms * 4);
  line(0, height / 2 + sin(frameCount * 0.02) * (6 + rms * 30), width, height / 2);
  pop();
}


function drawBurst(rms) {
  push();
  translate(width / 2, height / 2);
  blendMode(ADD);
  noFill();

  for (let i = 0; i < BINS; i += 2) {
    const v = spectrum[i];
    const a = (i / BINS) * TWO_PI * 3 + millis() * 0.0003;
    const len = 20 + v * 260 + rms * 90;

    stroke((hueBase + i * 4) % 360, 80, 65 + v * 35, 0.15 + v * 0.6);
    strokeWeight(1 + v * 4);
    
    arc(0, 0, len * 2, len * 2, a, a + 0.18 + v * 0.5);
  }
  pop();
}

function spawnParticles(rms) {
  const count = 26 + floor(rms * 90);
  for (let i = 0; i < count; i++) {
    const a = random(TWO_PI);
    const speed = random(1.5, 5.5) * (0.6 + rms * 1.6);
    particles.push({
      x: width / 2 + cos(a) * RING_R,
      y: height / 2 + sin(a) * RING_R,
      vx: cos(a) * speed,
      vy: sin(a) * speed,
      life: 1,
      decay: random(0.008, 0.024),
      size: random(2, 7),
      hue: (hueBase + random(-60, 60) + 360) % 360,
    });
  }

  if (particles.length > 1400) particles.splice(0, particles.length - 1400);
}

function updateParticles() {
  push();
  blendMode(ADD);
  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.975;   
    p.vy *= 0.975;
    p.vy += 0.03;    
    p.life -= p.decay;

    if (p.life <= 0) { particles.splice(i, 1); continue; }

    fill(p.hue, 85, 95, p.life * 0.85);
    ellipse(p.x, p.y, p.size * p.life * 2);
  }
  pop();
}

function updateRings() {
  push();
  blendMode(ADD);
  noFill();
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r += 7;
    r.a -= 0.022;
    if (r.a <= 0) { rings.splice(i, 1); continue; }
    stroke(r.hue % 360, 80, 90, r.a * 0.7);
    strokeWeight(1 + r.a * 3);
    ellipse(width / 2, height / 2, r.r * 2);
  }
  pop();
}


function drawCore(rms, kicked) {
  push();
  translate(width / 2, height / 2);
  noStroke();

  erase();
  ellipse(0, 0, 300, 300);
  noErase();

  const size = 60 + rms * 260 + (kicked ? 70 : 0);

  blendMode(ADD);
  for (let i = 5; i > 0; i--) {
    fill((hueBase + i * 12) % 360, 70 - i * 6, 90, 0.10 + rms * 0.22);
    ellipse(0, 0, size * (i / 5) * 1.35);
  }
  fill(0, 0, 100, 0.85 + rms * 0.15);
  ellipse(0, 0, 10 + rms * 200, 10 + rms * 200); 
  pop();
}

function drawHud(rms) {
  if (frameCount % 6 !== 0) return;

  const status = !isReady ? 'loading' : beat.isPlaying() ? 'playing' : 'paused';
  const el = document.getElementById('hud');
  if (!el) return;

  el.textContent =
    `mode[${MODE_NAMES[mode]}]  audio[${status}]  rms[${nf(rms, 1, 3)}]  ` +
    `flux[${nf(flux, 3, 0)}/${nf(fluxBase, 3, 0)}]  bpm[~${bpm}]  ` +
    `particles[${particles.length}]`;
}
