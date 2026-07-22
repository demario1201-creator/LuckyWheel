'use strict';

/* ============================================================
   抽奖模拟器 — 纯前端实现
   - 列表数量自动等分圆盘
   - 拖拽边界圆点微调相邻扇区占比（中奖概率）
   - 加权随机旋转，停在顶部指针处并提示结果
   ============================================================ */

const TAU = Math.PI * 2;
const W = 380, H = 380, CX = 190, CY = 190, R = 175;
const HANDLE_R = R * 0.93;          // 拖拽圆点所在半径
const MIN_SWEEP = TAU * 0.01;       // 单个扇区最小角度（1%）
const GRAB_THRESH = 0.10;           // 抓取边界的容差（弧度）

// 抽奖进行时的「直播文案」，按时间均分三段依次显示
const CHANT_LINES = [
  '中奖概率倍儿高',
  '奖品也嘛倍儿好',
  '手机钞票，奔驰金条，还有大金劳'
];

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const resultEl = document.getElementById('result');
const chantEl = document.getElementById('chant');
const spinBtn = document.getElementById('spinBtn');
const listEl = document.getElementById('prizeList');
const newPrizeInput = document.getElementById('newPrize');

let prizes = [];          // { id, label, weight, img?, imgSrc?, color?, hideLabel? }
let rotation = 0;         // 圆盘当前旋转角（弧度）
let spinning = false;
let dragBoundary = -1;    // 正在拖拽的边界索引
let lastWinner = null;    // 上一次中奖扇区（用于高亮）
let uid = 0;

/* ---------------- 工具函数 ---------------- */

function cd(a, b) { return ((b - a) % TAU + TAU) % TAU; }   // 圆形正向距离

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function truncate(s, n = 7) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// 温暖街头风色板 — 模仿地摊抽奖圆盘的暖色调
const WARM_PALETTE = [
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f',
  '#457b9d', '#e76f51', '#9b5de5', '#06d6a0',
  '#ef476f', '#ffd166', '#118ab2', '#ef8354'
];
function colorFor(i, n, prize) {
  if (prize && prize.color) return prize.color;
  return WARM_PALETTE[i % WARM_PALETTE.length];
}

/* ---------------- 图片处理 ---------------- */

const imgCache = new Map();   // src -> HTMLImageElement
function getImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const im = new Image();
  im.onload = () => draw();   // 图片加载完成后重绘，确保默认/上传图片可见
  im.src = src;
  imgCache.set(src, im);
  return im;
}
function fileToDataURL(file, cb) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
}

/* ---------------- 数据模型 ---------------- */

function computeSweeps() {
  const total = prizes.reduce((s, p) => s + p.weight, 0) || 1;
  let acc = 0;
  return prizes.map(p => {
    const sweep = (p.weight / total) * TAU;
    const o = { start: acc, end: acc + sweep, sweep, weight: p.weight };
    acc += sweep;
    return o;
  });
}

function addPrize(label) {
  label = (label || '').trim();
  if (!label) return;
  prizes.push({ id: ++uid, label, weight: 1, img: null });
  lastWinner = null;
  refresh();
}

function removePrize(i) {
  prizes.splice(i, 1);
  lastWinner = null;
  refresh();
}

function setWeight(i, v) {
  v = parseFloat(v);
  if (!isFinite(v) || v <= 0) v = 0.1;
  prizes[i].weight = v;
  lastWinner = null;
  refresh();
}

function setLabel(i, v) {
  const t = (v || '').trim();
  prizes[i].label = t || '未命名';
  draw();
}

function equalize() {
  prizes.forEach(p => (p.weight = 1));
  lastWinner = null;
  refresh();
}

function clearAll() {
  prizes = [];
  lastWinner = null;
  refresh();
}

/* ---------------- 拖拽边界（调整占比） ---------------- */

function toLogical(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height)
  };
}

function localAngle(e) {
  const p = toLogical(e);
  let a = Math.atan2(p.y - CY, p.x - CX) - rotation;
  return ((a % TAU) + TAU) % TAU;
}

function nearestBoundary(localA) {
  const B = computeSweeps().map(s => s.start);
  let best = -1, bestD = Infinity;
  for (let j = 0; j < B.length; j++) {
    let d = Math.abs(localA - B[j]);
    d = Math.min(d, TAU - d);
    if (d < bestD) { bestD = d; best = j; }
  }
  return { idx: best, dist: bestD };
}

// 将边界 i 的角度 a 约束到相邻扇区允许范围内
function clampBoundary(i, a) {
  const B = computeSweeps().map(s => s.start);
  const n = B.length;
  const left = B[(i - 1 + n) % n];
  const right = B[(i + 1) % n];
  a = ((a % TAU) + TAU) % TAU;
  if (left < right) {
    const lo = left + MIN_SWEEP, hi = right - MIN_SWEEP;
    return Math.min(hi, Math.max(lo, a));
  }
  // 跨越 0 的环形区间
  if (a > left) return Math.min(TAU - MIN_SWEEP, a);
  if (a < right) return Math.max(MIN_SWEEP, a);
  const dRight = a - right, dLeft = left - a;
  return dRight <= dLeft ? right + MIN_SWEEP : left - MIN_SWEEP;
}

function applyBoundary(i, a) {
  const sweeps = computeSweeps();
  const B = sweeps.map(s => s.start);
  const n = prizes.length;
  const left = B[(i - 1 + n) % n];
  const right = B[(i + 1) % n];
  const total = prizes.reduce((s, p) => s + p.weight, 0) || 1;
  const prev = cd(left, a);
  const next = cd(a, right);
  prizes[(i - 1 + n) % n].weight = (prev / TAU) * total;
  prizes[i % n].weight = (next / TAU) * total;
}

/* ---------------- 绘制 ---------------- */

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw() {
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (prizes.length === 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(61,43,26,0.08)';
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(212,196,168,.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#8c7a5e';
    ctx.font = '600 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎲 请先在右侧添加奖项', CX, CY);
    ctx.restore();
    drawPointer();
    return;
  }

  const sweeps = computeSweeps();

  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(rotation);

  for (let i = 0; i < sweeps.length; i++) {
    const s = sweeps[i];
    const p = prizes[i];
    const mid = (s.start + s.end) / 2;
    const isWin = i === lastWinner;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, s.start, s.end);
    ctx.closePath();
    ctx.fillStyle = colorFor(i, prizes.length, p);
    ctx.fill();
    ctx.lineWidth = isWin ? 4 : 2;
    ctx.strokeStyle = isWin ? '#d4a017' : 'rgba(61,43,26,0.25)';
    ctx.stroke();

    // 扇区文字（内侧，沿半径方向）— 有图片的扇区不显示文字
    const hasImg = !!(p.img || p.imgSrc);
    if (!hasImg || p.hideLabel !== true) {
      ctx.save();
      ctx.rotate(mid);
      ctx.translate(R * (hasImg ? 0.30 : 0.55), 0);   // 有图更靠内；纯文字置于扇区径向中部
      if (mid > Math.PI / 2 && mid < (3 * Math.PI) / 2) ctx.rotate(Math.PI);
      ctx.fillStyle = '#fff';
      ctx.font = (hasImg ? '700 12px' : '800 26px') + ' sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;
      ctx.fillText(truncate(p.label, 8), 0, 0);
      ctx.restore();
    }

    // 扇区图片（外侧，自适应扇区大小）
    const imgSrc = p.img || p.imgSrc;
    if (imgSrc) {
      const im = getImage(imgSrc);
      if (im.complete && im.naturalWidth > 0) {
        const rImg = R * 0.74;
        const arcLen = s.sweep * rImg;                 // 该扇区在 rImg 处的弧长
        let d = Math.min(arcLen * 0.9, 2 * (R - 6 - rImg), 2 * (rImg - 22), 82);
        if (d > 12) {
          const ix = Math.cos(mid) * rImg;
          const iy = Math.sin(mid) * rImg;
          drawPrizeImage(im, ix, iy, d);
        }
      }
    }
  }

  // 拖拽圆点（位于各扇区分界线上）
  if (prizes.length >= 2 && !spinning) {
    const B = sweeps.map(s => s.start);
    for (let i = 0; i < B.length; i++) {
      const hx = Math.cos(B[i]) * HANDLE_R;
      const hy = Math.sin(B[i]) * HANDLE_R;
      ctx.beginPath();
      ctx.arc(hx, hy, 9, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#d4a017';
      ctx.stroke();
    }
  }

  ctx.restore();
  drawPointer();
  drawHub();
}

function drawPointer() {
  ctx.save();
  // 指针 — 温暖红，粗体感
  ctx.fillStyle = '#e63946';
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(CX, CY - R + 16);
  ctx.lineTo(CX - 14, CY - R - 18);
  ctx.lineTo(CX + 14, CY - R - 18);
  ctx.closePath();
  ctx.fill();

  // 指针内圈高光
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.moveTo(CX, CY - R + 20);
  ctx.lineTo(CX - 7, CY - R - 8);
  ctx.lineTo(CX + 7, CY - R - 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.restore();
}

// 在 (cx,cy) 处绘制圆形图片（cover 填充），外圈白边
function drawPrizeImage(im, cx, cy, d) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, TAU);
  ctx.closePath();
  ctx.clip();
  const iw = im.naturalWidth, ih = im.naturalHeight;
  const scale = Math.max(d / iw, d / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(im, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, TAU);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
}

function drawHub() {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, 28, 0, TAU);
  ctx.fillStyle = '#d4a017';
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 5;
  ctx.fill();

  // 内圈
  ctx.beginPath();
  ctx.arc(CX, CY, 20, 0, TAU);
  ctx.fillStyle = '#b8860b';
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.stroke();

  // 文字
  ctx.fillStyle = '#fff';
  ctx.font = '900 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 2;
  ctx.fillText('GO', CX, CY);
  ctx.restore();
}

/* ---------------- 抽奖旋转 ---------------- */

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 不支持则静音 */ }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function tick(freq) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'triangle';
  o.frequency.value = freq || 760;
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.09);
}

function pickWinner() {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    if (r < prizes[i].weight) return i;
    r -= prizes[i].weight;
  }
  return prizes.length - 1;
}

function sectorUnderPointer() {
  const sweeps = computeSweeps();
  let a = (-Math.PI / 2 - rotation);
  a = ((a % TAU) + TAU) % TAU;
  for (let i = 0; i < sweeps.length; i++) {
    if (a >= sweeps[i].start && a < sweeps[i].end) return i;
  }
  return sweeps.length - 1;
}

function spin() {
  if (spinning || prizes.length === 0) return;
  spinning = true;
  ensureAudio();
  updateSpinBtn();
  lastWinner = null;
  // 抽奖开始：清掉上一次的结果与直播文案
  resultEl.classList.remove('show');
  resultEl.textContent = '';
  chantEl.textContent = '';
  draw();

  const idx = pickWinner();
  const sweeps = computeSweeps();
  const center = (sweeps[idx].start + sweeps[idx].end) / 2;
  const jitter = (Math.random() - 0.5) * sweeps[idx].sweep * 0.6;
  const needed = -Math.PI / 2 - (center + jitter);

  const spins = 5 + Math.floor(Math.random() * 3);
  const baseMod = ((rotation % TAU) + TAU) % TAU;
  const neededMod = ((needed % TAU) + TAU) % TAU;
  const offset = ((neededMod - baseMod) % TAU + TAU) % TAU;
  const target = rotation + spins * TAU + offset;

  const startRot = rotation;
  const delta = target - startRot;
  const duration = 4200;
  const t0 = performance.now();
  let lastSector = sectorUnderPointer();

  function frame(now) {
    let t = (now - t0) / duration;
    if (t > 1) t = 1;
    const e = 1 - Math.pow(1 - t, 3);   // easeOutCubic
    rotation = startRot + delta * e;
    draw();

    // 直播文案：把抽奖时长均分为三段，依次显示三句话
    const ci = Math.min(CHANT_LINES.length - 1, Math.floor(t * CHANT_LINES.length));
    if (chantEl.textContent !== CHANT_LINES[ci]) {
      chantEl.textContent = CHANT_LINES[ci];
      chantEl.classList.remove('pop');
      void chantEl.offsetWidth;   // 重启动画
      chantEl.classList.add('pop');
    }

    const cur = sectorUnderPointer();
    if (cur !== lastSector) { tick(700 + Math.floor(Math.random() * 200)); lastSector = cur; }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      spinning = false;
      lastWinner = idx;
      draw();
      chantEl.textContent = '';      // 文案消失
      showResult(idx);               // 中奖提示再出现
      updateSpinBtn();
    }
  }
  requestAnimationFrame(frame);
}

function showResult(idx) {
  const p = prizes[idx];
  resultEl.textContent = p.lose ? '得，没中' : `🎉 恭喜抽中：${p.label}`;
  resultEl.classList.remove('show');
  void resultEl.offsetWidth;   // 重启动画
  resultEl.classList.add('show');
}

/* ---------------- 列表渲染 ---------------- */

function renderList() {
  listEl.innerHTML = '';
  const total = prizes.reduce((s, p) => s + p.weight, 0) || 1;

  prizes.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'prize-item';

    // 图片缩略图 / 上传按钮（替代原色块）
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb' + (p.img ? ' has-img' : '');
    const thumbImg = p.img || p.imgSrc;
    thumb.style.borderColor = colorFor(i, prizes.length, p);
    if (thumbImg) {
      thumb.style.backgroundImage = `url(${thumbImg})`;
      thumb.classList.add('has-img');
    } else {
      thumb.style.background = colorFor(i, prizes.length, p);
      thumb.classList.remove('has-img');
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    fileInput.addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      fileToDataURL(f, data => { p.img = data; refresh(); });
    });
    thumb.addEventListener('click', () => fileInput.click());

    if (p.img || p.imgSrc) {
      const clr = document.createElement('span');
      clr.className = 'thumb-clear';
      clr.textContent = '×';
      clr.title = '移除图片';
      clr.addEventListener('click', ev => { ev.stopPropagation(); p.img = null; p.imgSrc = null; refresh(); });
      thumb.appendChild(clr);
    }
    thumb.appendChild(fileInput);

    const label = document.createElement('input');
    label.className = 'label-input';
    label.value = p.label;
    label.addEventListener('change', () => setLabel(i, label.value));

    const weight = document.createElement('input');
    weight.className = 'weight-input';
    weight.type = 'number';
    weight.min = '0.1';
    weight.step = '0.1';
    weight.value = Number(p.weight.toFixed(2));
    weight.addEventListener('change', () => setWeight(i, weight.value));

    const pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = ((p.weight / total) * 100).toFixed(1) + '%';

    const rm = document.createElement('button');
    rm.className = 'rm';
    rm.textContent = '✕';
    rm.title = '删除';
    rm.addEventListener('click', () => removePrize(i));

    li.append(thumb, label, weight, pct, rm);
    listEl.appendChild(li);
  });
}

function updateSpinBtn() {
  spinBtn.disabled = spinning || prizes.length === 0;
  spinBtn.textContent = spinning ? '抽奖中…' : '开始抽奖';
}

function refresh() {
  renderList();
  draw();
  updateSpinBtn();
}

/* ---------------- 事件绑定 ---------------- */

canvas.addEventListener('pointerdown', e => {
  if (spinning || prizes.length < 2) return;
  const pt = toLogical(e);
  const distC = Math.hypot(pt.x - CX, pt.y - CY);
  if (distC > R + 16 || distC < 16) return;
  const local = localAngle(e);
  const { idx, dist } = nearestBoundary(local);
  if (idx >= 0 && dist < GRAB_THRESH) {
    dragBoundary = idx;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', e => {
  const pt = toLogical(e);
  if (dragBoundary >= 0) {
    const a = clampBoundary(dragBoundary, localAngle(e));
    applyBoundary(dragBoundary, a);
    refresh();
    return;
  }
  if (spinning || prizes.length < 2) { canvas.style.cursor = 'default'; return; }
  const distC = Math.hypot(pt.x - CX, pt.y - CY);
  const { dist } = nearestBoundary(localAngle(e));
  canvas.style.cursor = (dist < GRAB_THRESH && distC < R + 16 && distC > 16) ? 'grab' : 'default';
});

function endDrag() {
  if (dragBoundary >= 0) {
    dragBoundary = -1;
    canvas.style.cursor = 'grab';
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

spinBtn.addEventListener('click', spin);

document.getElementById('addBtn').addEventListener('click', () => {
  addPrize(newPrizeInput.value);
  newPrizeInput.value = '';
  newPrizeInput.focus();
});
newPrizeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addPrize(newPrizeInput.value);
    newPrizeInput.value = '';
  }
});
document.getElementById('equalBtn').addEventListener('click', equalize);
document.getElementById('clearBtn').addEventListener('click', clearAll);

/* ---------------- 初始化（示例数据） ---------------- */

/* ---------------- 默认数据：8 扇区地摊风 ---------------- */

const DEFAULT_PRIZES = [
  { label: '没中',   weight: 1, color: '#e63946', imgSrc: null,          hideLabel: false, lose: true },  // 红色文字扇区（未中奖）
  { label: '奔驰',   weight: 1, color: null,     imgSrc: 'assets/key.png',   hideLabel: true  },
  { label: '大金劳儿', weight: 1, color: null,   imgSrc: 'assets/watch.png', hideLabel: true  },
  { label: '钞票',   weight: 1, color: null,     imgSrc: 'assets/money.png', hideLabel: true  },
  { label: '陀螺',   weight: 1, color: null,     imgSrc: 'assets/top.png',   hideLabel: true  },
  { label: '手机',   weight: 1, color: null,     imgSrc: 'assets/phone.png', hideLabel: true  },
  { label: '泰迪熊', weight: 1, color: null,     imgSrc: 'assets/bear.png',  hideLabel: true  },
  { label: '金条',   weight: 1, color: null,     imgSrc: 'assets/gold.png',  hideLabel: true  },
];

function init() {
  setupCanvas();
  DEFAULT_PRIZES.forEach(def => {
    prizes.push({ id: ++uid, label: def.label, weight: def.weight,
                   color: def.color || null, img: null, imgSrc: def.imgSrc || null, hideLabel: !!def.hideLabel, lose: !!def.lose });
  });
  refresh();
}

init();
