// ============================================================
//  みうのブロック崩し
//  セクションごとに分けてあるので、あとから要素を足しやすいです
// ============================================================

/* ============================================================
   1. 設定・定数
   ============================================================ */

const CONFIG = {
  paddleWidth: 68,
  paddleHeight: 14,
  paddleSpeed: 7,
  ballRadius: 7,
  ballSpeedBase: 4,
  blockPadding: 2,
  blockOffsetTop: 38,
  blockOffsetLeft: 6,
  blockHeight: 18,
  pointsPerBlock: 100,
  comboTimeout: 1800,       // コンボが切れるまでのミリ秒（短め）
  comboMaxMultiplier: 8,
  itemFallSpeed: 2.8,
  itemSize: 22,
  itemDropChance: 0.18,     // アイテム落下率（やや低め）
  laserWidth: 4,
  laserSpeed: 10,
  laserDuration: 7000,
  laserFireInterval: 280,
  widePaddleScale: 1.45,
  wideDuration: 9000,
  pierceDuration: 8000,     // 貫通ボールの持続時間(ms)
  moveStep: 3,                // 1フレームの移動を分割（貫通防止）
  stageClearDelay: 1800,
  lives: 2,
  // チャージ（長押しでパドルにためる）
  chargeMaxTime: 1400,       // 満タンまでのミリ秒
  chargeSpeedBoost: 1.6,     // 満タン時の速度倍率（+160%）
  chargeReleaseBonus: 1.25,  // 離したタイミングで当てたボーナス
  chargeReleaseWindow: 700,  // 離してから有効なミリ秒
  maxBallSpeed: 11,
};

// ステージ定義（layout: ブロック並び / ステージ4以降で変化）
const STAGES = [
  // ステージ1〜3：やさしめ・並びは基本
  { rows: 6, cols: 9,  ballSpeed: 4.3, dropRate: 0.16, layout: "full" },
  { rows: 6, cols: 9,  ballSpeed: 4.4, dropRate: 0.16, layout: "full" },
  { rows: 7, cols: 9,  ballSpeed: 4.5, dropRate: 0.17, layout: "full" },
  // ステージ4〜：並び変化＋少しずつ難化
  { rows: 7, cols: 10, ballSpeed: 4.7, dropRate: 0.17, layout: "pyramid" },
  { rows: 7, cols: 10, ballSpeed: 4.9, dropRate: 0.17, layout: "checker" },
  { rows: 8, cols: 10, ballSpeed: 5.1, dropRate: 0.17, layout: "diamond" },
  { rows: 8, cols: 10, ballSpeed: 5.3, dropRate: 0.18, layout: "fortress" },
  { rows: 8, cols: 10, ballSpeed: 5.5, dropRate: 0.18, layout: "gates" },
  { rows: 9, cols: 10, ballSpeed: 5.7, dropRate: 0.18, layout: "scatter" },
  { rows: 9, cols: 10, ballSpeed: 5.9, dropRate: 0.18, layout: "pyramid" },
  { rows: 9, cols: 10, ballSpeed: 6.1, dropRate: 0.19, layout: "checker" },
  { rows: 9, cols: 10, ballSpeed: 6.3, dropRate: 0.19, layout: "diamond" },
  { rows: 10, cols: 10, ballSpeed: 6.5, dropRate: 0.19, layout: "fortress" },
  { rows: 10, cols: 10, ballSpeed: 6.7, dropRate: 0.19, layout: "gates" },
  { rows: 10, cols: 10, ballSpeed: 6.9, dropRate: 0.20, layout: "scatter" },
  { rows: 10, cols: 10, ballSpeed: 7.1, dropRate: 0.20, layout: "wall" },
  { rows: 11, cols: 10, ballSpeed: 7.3, dropRate: 0.20, layout: "pyramid" },
  { rows: 11, cols: 10, ballSpeed: 7.5, dropRate: 0.20, layout: "checker" },
  { rows: 11, cols: 10, ballSpeed: 7.7, dropRate: 0.21, layout: "diamond" },
  { rows: 12, cols: 10, ballSpeed: 7.9, dropRate: 0.21, layout: "fortress" },
  { rows: 12, cols: 10, ballSpeed: 8.2, dropRate: 0.21, layout: "scatter" },
];

// ブロックの並びパターン（true = ブロックを置く）
const BLOCK_LAYOUTS = {
  full: () => true,
  pyramid: (row, col, rows, cols) => {
    const width = Math.min(cols, 3 + row * 2);
    const start = Math.floor((cols - width) / 2);
    return col >= start && col < start + width;
  },
  checker: (row, col) => (row + col) % 2 === 0,
  diamond: (row, col, rows, cols) => {
    const dr = Math.abs(row - (rows - 1) / 2);
    const dc = Math.abs(col - (cols - 1) / 2);
    return dr + dc <= Math.ceil(rows / 2) + 0.5;
  },
  fortress: (row, col, rows, cols) => {
    if (col === 0 || col === cols - 1) return row < rows - 2;
    return true;
  },
  gates: (row, col, rows, cols) => col % 3 !== 1 || row % 2 === 0,
  scatter: (row, col, rows, cols, seed) => (row * 17 + col * 31 + seed * 7) % 6 !== 0,
  wall: (row, col, rows, cols) => row >= 2 || col % 2 === 0,
};

function shouldPlaceBlock(layout, row, col, rows, cols) {
  const fn = BLOCK_LAYOUTS[layout] || BLOCK_LAYOUTS.full;
  return fn(row, col, rows, cols, currentStage);
}

function getBlockHp(row, col) {
  if (currentStage < 3) return 1;
  let hp = 1;
  if (currentStage >= 3 && row === 0 && col % 2 === 0) hp = 2;
  if (currentStage >= 6 && row <= 1 && col % 3 === 0) hp = 2;
  if (currentStage >= 9 && row === 0) hp = 2;
  if (currentStage >= 12 && row <= 2 && col % 4 === 0) hp = 3;
  if (currentStage >= 16 && row <= 1 && col % 2 === 1) hp = 3;
  return hp;
}

// ステージ別の背景（色は列ごとに決まる）
const STAGE_BG = [
  { name: "ネオンナイト",     bgTint: "rgba(255, 60, 150, 0.03)" },
  { name: "サイバー_wave",   bgTint: "rgba(0, 220, 255, 0.03)" },
  { name: "パープル夢",      bgTint: "rgba(160, 80, 255, 0.04)" },
  { name: "ゴールドラッシュ", bgTint: "rgba(255, 200, 50, 0.03)" },
  { name: "オーロラ",        bgTint: "rgba(100, 200, 255, 0.04)" },
  { name: "ミッドナイト",    bgTint: "rgba(80, 60, 200, 0.04)" },
  { name: "サンセット",      bgTint: "rgba(255, 100, 60, 0.03)" },
  { name: "エメラルド",      bgTint: "rgba(0, 200, 120, 0.03)" },
  { name: "クリムゾン",      bgTint: "rgba(255, 40, 80, 0.04)" },
  { name: "ムーンライト",    bgTint: "rgba(120, 140, 255, 0.04)" },
  { name: "インフェルノ",    bgTint: "rgba(255, 80, 0, 0.04)" },
  { name: "スターダスト",    bgTint: "rgba(200, 100, 255, 0.05)" },
  { name: "コスモス",        bgTint: "rgba(60, 100, 255, 0.04)" },
  { name: "サクラ",          bgTint: "rgba(255, 120, 180, 0.04)" },
  { name: "トワイライト",    bgTint: "rgba(100, 60, 180, 0.05)" },
  { name: "フロスト",        bgTint: "rgba(150, 220, 255, 0.04)" },
  { name: "ボルケーノ",      bgTint: "rgba(255, 60, 30, 0.04)" },
  { name: "ギャラクシー",    bgTint: "rgba(80, 40, 200, 0.05)" },
  { name: "プリンセス",      bgTint: "rgba(255, 150, 220, 0.04)" },
  { name: "ファイナル",      bgTint: "rgba(255, 200, 100, 0.05)" },
];

// 列ごとのネオンカラー（左から順にこの色が繰り返る）
const COLUMN_NEON_COLORS = [
  { base: "#9e1858", mid: "#ff4da6", light: "#ffc0e0", glow: "#ff6ec7" }, // ピンク
  { base: "#5a20a8", mid: "#a050ff", light: "#d8b8ff", glow: "#b967ff" }, // パープル
  { base: "#006880", mid: "#00d4f5", light: "#a0f0ff", glow: "#00f5ff" }, // シアン
  { base: "#906000", mid: "#ffc830", light: "#ffe890", glow: "#ffd700" }, // ゴールド
  { base: "#8040a0", mid: "#d070ff", light: "#f0b8ff", glow: "#e888ff" }, // マゼンタ
  { base: "#008860", mid: "#30e8a0", light: "#a0ffd8", glow: "#50ffbb" }, // ミント
  { base: "#a04020", mid: "#ff7840", light: "#ffc8a8", glow: "#ff9966" }, // オレンジ
  { base: "#2040a0", mid: "#5080ff", light: "#b0c8ff", glow: "#6699ff" }, // ブルー
  { base: "#a02060", mid: "#ff4090", light: "#ffb0d0", glow: "#ff66aa" }, // ローズ
  { base: "#408888", mid: "#60e0e0", light: "#c0ffff", glow: "#88ffff" }, // ターコイズ
];

function getStageBg() {
  return STAGE_BG[Math.min(currentStage, STAGE_BG.length - 1)];
}

function getColumnColor(col) {
  return COLUMN_NEON_COLORS[col % COLUMN_NEON_COLORS.length];
}

/* ============================================================
   1b. セーブデータ（ステージ解放）
   ============================================================ */

const SAVE_KEY = "miu-block-breaker-save";

const Save = {
  data: { unlockedStage: 0, allClear: false },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch (e) { /* 読み込み失敗時は初期値 */ }
    this.data.unlockedStage = Math.max(0, Math.min(this.data.unlockedStage, STAGES.length - 1));
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) { /* 保存失敗時は無視 */ }
  },

  unlockStage(stageIndex) {
    const next = Math.max(0, Math.min(stageIndex, STAGES.length - 1));
    if (next > this.data.unlockedStage) {
      this.data.unlockedStage = next;
      this.save();
    }
  },

  onStageClear(clearedIndex) {
    if (clearedIndex >= STAGES.length - 1) {
      this.data.allClear = true;
      this.unlockStage(STAGES.length - 1);
    } else {
      this.unlockStage(clearedIndex + 1);
    }
    this.save();
  },
};

let selectedStartStage = 0;

// アイテム種類
const ITEM_TYPES = {
  MULTI:  { label: "M", color: "#ffe066", glow: "#fff099" },  // ボール増殖
  LASER:  { label: "L", color: "#00f5ff", glow: "#80ffff" },  // レーザー
  WIDE:   { label: "W", color: "#b967ff", glow: "#d4a0ff" },  // パドル拡大
  PIERCE: { label: "P", color: "#ff3344", glow: "#ff6b6b" },  // 貫通ボール
};

// みう宣伝（ここを書き換えるとクリア画面が変わる）
const MIU_PROMO = {
  songUrl: "https://example.com/miu-song",  // 曲のURL
  imageUrl: "",                              // 画像パス（例: "assets/miu.png"）
};

/* ============================================================
   2. DOM・画面
   ============================================================ */

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const UI = {
  score:      document.getElementById("score"),
  combo:      document.getElementById("combo"),
  stageNum:   document.getElementById("stage-num"),
  stageClear: document.getElementById("stage-clear-msg"),
  comboPopup: document.getElementById("combo-popup"),
  finalScoreOver:  document.getElementById("final-score-over"),
  finalStageOver:  document.getElementById("final-stage-over"),
  finalScoreClear: document.getElementById("final-score-clear"),
  miuSongLink:     document.getElementById("miu-song-link"),
  miuAvatar:       document.getElementById("miu-avatar"),
};

const screens = {
  title:    document.getElementById("title-screen"),
  game:     document.getElementById("game-screen"),
  gameover: document.getElementById("gameover-screen"),
  clear:    document.getElementById("clear-screen"),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ============================================================
   3. サウンド（Web Audio API・外部ファイル不要）
   ============================================================ */

const Sound = {
  enabled: true,
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  toggle() {
    this.enabled = !this.enabled;
    updateSoundButtons();
    if (this.enabled) this.init();
    return this.enabled;
  },

  play(freq, duration = 0.1, type = "sine", volume = 0.15) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  blockBreak()  { this.play(520, 0.08, "square", 0.1); },
  paddleHit()   { this.play(280, 0.06, "sine", 0.08); },
  chargeHit()   { this.play(180, 0.12, "square", 0.14); this.play(520, 0.1, "sine", 0.1); },
  itemGet()     { this.play(660, 0.15, "sine", 0.12); this.play(880, 0.15, "sine", 0.1); },
  comboHit(n)   { this.play(400 + n * 40, 0.1, "triangle", 0.1); },
  laserShoot()  { this.play(900, 0.05, "sawtooth", 0.06); },
  stageClear()  { this.play(523, 0.2); setTimeout(() => this.play(659, 0.2), 150); setTimeout(() => this.play(784, 0.3), 300); },
  gameOver()    { this.play(200, 0.4, "sawtooth", 0.12); },
  allClear()    { this.play(523, 0.15); setTimeout(() => this.play(659, 0.15), 120); setTimeout(() => this.play(784, 0.15), 240); setTimeout(() => this.play(1047, 0.4), 360); },
};

function updateSoundButtons() {
  const label = Sound.enabled ? "🔊 ON" : "🔇 OFF";
  const mini  = Sound.enabled ? "🔊" : "🔇";
  document.querySelectorAll(".sound-toggle").forEach((btn) => {
    if (btn.classList.contains("mini")) {
      btn.textContent = mini;
    } else {
      btn.textContent = label;
    }
    btn.classList.toggle("off", !Sound.enabled);
  });
}

/* ============================================================
   4. ゲーム状態
   ============================================================ */

let gameState = "title";   // title | playing | paused | gameover | clear
let animationId = null;

let currentStage = 0;
let score = 0;
let combo = 0;
let comboTimer = 0;
let lives = CONFIG.lives;

let paddle = {
  x: 0, y: 0,
  width: CONFIG.paddleWidth,
  height: CONFIG.paddleHeight,
  baseWidth: CONFIG.paddleWidth,
  charge: 0,
  chargeReady: false,
  chargeReadyTimer: 0,
};
let balls = [];
let blocks = [];
let items = [];
let lasers = [];
let particles = [];

let laserActive = false;
let laserTimer = 0;
let laserFireTimer = 0;
let wideTimer = 0;
let pierceTimer = 0;
let stageClearing = false;   // ステージ切り替え中フラグ

const input = {
  left: false,
  right: false,
  touchX: null,
  charging: false,
  touchStartX: 0,
  touchMode: null, // "move" | "charge"
};

/* ============================================================
   5. 初期化・ステージ生成
   ============================================================ */

function getStageConfig() {
  return STAGES[Math.min(currentStage, STAGES.length - 1)];
}

function initGame(startStage = 0) {
  currentStage = Math.max(0, Math.min(startStage, STAGES.length - 1));
  score = 0;
  lives = CONFIG.lives;

  combo = 0;
  comboTimer = 0;
  items = [];
  lasers = [];
  particles = [];
  laserActive = false;
  laserTimer = 0;
  wideTimer = 0;
  pierceTimer = 0;
  stageClearing = false;

  paddle.baseWidth = CONFIG.paddleWidth;
  paddle.width = CONFIG.paddleWidth;
  paddle.x = (canvas.width - paddle.width) / 2;
  paddle.y = canvas.height - paddle.height - 16;
  paddle.charge = 0;
  paddle.chargeReady = false;
  paddle.chargeReadyTimer = 0;
  input.charging = false;
  input.touchMode = null;

  balls = [createBall()];
  createBlocksForStage();
  updateHUD();
}

function createBall(speedMult = 1) {
  const stage = getStageConfig();
  const speed = stage.ballSpeed * speedMult;
  const angle = (Math.random() * 0.5 + 0.25) * Math.PI;
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    x: paddle.x + paddle.width / 2,
    y: paddle.y - CONFIG.ballRadius - 2,
    dx: Math.cos(angle) * speed * dir,
    dy: -Math.sin(angle) * speed,
    radius: CONFIG.ballRadius,
    speed,
  };
}

function createBlocksForStage() {
  blocks = [];
  const stage = getStageConfig();
  const cols = stage.cols;
  const rows = stage.rows;
  const layout = stage.layout || "full";
  const blockHeight = rows > 10 ? 16 : CONFIG.blockHeight;
  const blockWidth =
    (canvas.width - CONFIG.blockOffsetLeft * 2 - CONFIG.blockPadding * (cols - 1)) / cols;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!shouldPlaceBlock(layout, row, col, rows, cols)) continue;
      const hp = getBlockHp(row, col);
      blocks.push({
        x: CONFIG.blockOffsetLeft + col * (blockWidth + CONFIG.blockPadding),
        y: CONFIG.blockOffsetTop + row * (blockHeight + CONFIG.blockPadding),
        width: blockWidth,
        height: blockHeight,
        hp,
        maxHp: hp,
        alive: true,
        color: getColumnColor(col),
      });
    }
  }
}

function updateHUD() {
  UI.score.textContent = score;
  UI.combo.textContent = `×${combo || 1}`;
  UI.combo.classList.toggle("active", combo >= 3);
  UI.stageNum.textContent = currentStage + 1;
}

function setupPromo() {
  UI.miuSongLink.href = MIU_PROMO.songUrl;
  if (MIU_PROMO.imageUrl) {
    UI.miuAvatar.innerHTML = `<img src="${MIU_PROMO.imageUrl}" alt="みう">`;
  }
}

/* ============================================================
   6. コンボ
   ============================================================ */

function addCombo() {
  combo++;
  comboTimer = CONFIG.comboTimeout;
  const mult = Math.min(combo, CONFIG.comboMaxMultiplier);
  UI.combo.textContent = `×${mult}`;
  UI.combo.classList.add("active");

  if (combo >= 2) {
    showComboPopup(combo);
    Sound.comboHit(combo);
  }
  updateHUD();
}

function resetCombo() {
  combo = 0;
  comboTimer = 0;
  UI.combo.textContent = "×1";
  UI.combo.classList.remove("active");
}

function getComboMultiplier() {
  return combo > 0 ? Math.min(combo, CONFIG.comboMaxMultiplier) : 1;
}

function showComboPopup(n) {
  UI.comboPopup.textContent = `${n} COMBO!`;
  UI.comboPopup.classList.remove("hidden");
  UI.comboPopup.style.animation = "none";
  void UI.comboPopup.offsetWidth;
  UI.comboPopup.style.animation = "";
  setTimeout(() => UI.comboPopup.classList.add("hidden"), 500);
}

/* ============================================================
   7. アイテム
   ============================================================ */

function tryDropItem(x, y) {
  const stage = getStageConfig();
  if (Math.random() > stage.dropRate) return;

  const types = Object.keys(ITEM_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  items.push({
    x: x - CONFIG.itemSize / 2,
    y,
    width: CONFIG.itemSize,
    height: CONFIG.itemSize,
    type,
    vy: CONFIG.itemFallSpeed,
  });
}

function collectItem(item) {
  Sound.itemGet();
  spawnParticles(item.x + item.width / 2, item.y + item.height / 2, ITEM_TYPES[item.type].color, 12);

  switch (item.type) {
    case "MULTI":
      multiplyBalls();
      break;
    case "LASER":
      activateLaser();
      break;
    case "WIDE":
      activateWide();
      break;
    case "PIERCE":
      activatePierce();
      break;
  }
}

function multiplyBalls() {
  const newBalls = [];
  balls.forEach((ball) => {
    for (let i = 0; i < 2; i++) {
      const angle = (Math.random() * 0.6 + 0.2) * Math.PI;
      const dir = i === 0 ? 1 : -1;
      newBalls.push({
        x: ball.x,
        y: ball.y,
        dx: Math.cos(angle) * ball.speed * dir,
        dy: -Math.abs(Math.sin(angle) * ball.speed),
        radius: ball.radius,
        speed: ball.speed,
      });
    }
  });
  balls.push(...newBalls);
}

function activateLaser() {
  laserActive = true;
  laserTimer = CONFIG.laserDuration;
}

function activateWide() {
  wideTimer = CONFIG.wideDuration;
  const center = paddle.x + paddle.width / 2;
  paddle.width = paddle.baseWidth * CONFIG.widePaddleScale;
  paddle.x = center - paddle.width / 2;
  clampPaddle();
}

function activatePierce() {
  pierceTimer = CONFIG.pierceDuration;
  balls.forEach((ball) => {
    ball.pierceInside = new Set();
  });
}

function fireLaser() {
  if (!laserActive) return;
  const cx = paddle.x + paddle.width / 2;
  lasers.push({ x: cx - CONFIG.laserWidth / 2, y: paddle.y, width: CONFIG.laserWidth, height: 16, speed: CONFIG.laserSpeed });
  Sound.laserShoot();
}

/* ============================================================
   8. パーティクル（ネオン演出）
   ============================================================ */

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles() {
  particles = particles.filter((p) => {
    p.x += p.dx;
    p.y += p.dy;
    p.life -= p.decay;
    return p.life > 0;
  });
}

/* ============================================================
   9. 当たり判定ヘルパー
   ============================================================ */

function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  return cx + r > rx && cx - r < rx + rw && cy + r > ry && cy - r < ry + rh;
}

function clampPaddle() {
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
}

function breakBlock(block, ball) {
  let damage = 1;
  if (ball && ball.charged) {
    damage = 2;
    ball.charged = false;
  }
  block.hp -= damage;
  if (block.hp <= 0) {
    block.alive = false;
    const mult = getComboMultiplier();
    score += CONFIG.pointsPerBlock * mult;
    addCombo();
    Sound.blockBreak();
    spawnParticles(
      block.x + block.width / 2,
      block.y + block.height / 2,
      block.color.glow,
      10
    );
    tryDropItem(block.x + block.width / 2, block.y + block.height / 2);
  } else {
    Sound.blockBreak();
    spawnParticles(block.x + block.width / 2, block.y + block.height / 2, block.color.glow, 4);
  }
}

function getBlockOverlaps(ball, block) {
  return {
    left:   ball.x + ball.radius - block.x,
    right:  block.x + block.width - (ball.x - ball.radius),
    top:    ball.y + ball.radius - block.y,
    bottom: block.y + block.height - (ball.y - ball.radius),
  };
}

function separateBallFromBlock(ball, block) {
  const o = getBlockOverlaps(ball, block);
  const min = Math.min(o.left, o.right, o.top, o.bottom);
  const pad = 0.5;
  if (min === o.left)       ball.x = block.x - ball.radius - pad;
  else if (min === o.right) ball.x = block.x + block.width + ball.radius + pad;
  else if (min === o.top)   ball.y = block.y - ball.radius - pad;
  else                      ball.y = block.y + block.height + ball.radius + pad;
}

function reflectBallOffBlock(ball, block) {
  const o = getBlockOverlaps(ball, block);
  const min = Math.min(o.left, o.right, o.top, o.bottom);
  if (min === o.left || min === o.right) ball.dx = -ball.dx;
  else ball.dy = -ball.dy;
}

// 1ステップ分のブロック当たり判定（通常は1ブロックのみ、貫通時は通過しながら破壊）
function resolveBallBlockCollisions(ball) {
  const piercing = pierceTimer > 0;
  ball.piercing = piercing;

  if (!ball.pierceInside) ball.pierceInside = new Set();

  if (piercing) {
    blocks.forEach((block) => {
      if (!block.alive) return;
      const hit = circleRectCollision(ball.x, ball.y, ball.radius, block.x, block.y, block.width, block.height);
      if (hit && !ball.pierceInside.has(block)) {
        ball.pierceInside.add(block);
        breakBlock(block, ball);
      } else if (!hit && ball.pierceInside.has(block)) {
        ball.pierceInside.delete(block);
      }
    });
    return;
  }

  let hitBlock = null;
  let minOverlap = Infinity;

  blocks.forEach((block) => {
    if (!block.alive) return;
    if (!circleRectCollision(ball.x, ball.y, ball.radius, block.x, block.y, block.width, block.height)) return;
    const o = getBlockOverlaps(ball, block);
    const overlap = Math.min(o.left, o.right, o.top, o.bottom);
    if (overlap < minOverlap) {
      minOverlap = overlap;
      hitBlock = block;
    }
  });

  if (!hitBlock) return;

  breakBlock(hitBlock, ball);
  reflectBallOffBlock(ball, hitBlock);
  separateBallFromBlock(ball, hitBlock);
}

function resolveBallWallCollision(ball) {
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.dx = Math.abs(ball.dx);
  }
  if (ball.x + ball.radius > canvas.width) {
    ball.x = canvas.width - ball.radius;
    ball.dx = -Math.abs(ball.dx);
  }
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.dy = Math.abs(ball.dy);
  }
}

function resolveBallPaddleCollision(ball) {
  if (
    ball.dy > 0 &&
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width
  ) {
    const hitPos = (ball.x - paddle.x) / paddle.width;
    const angle = (hitPos - 0.5) * Math.PI * 0.75;
    let speed = Math.hypot(ball.dx, ball.dy) || ball.speed;

    // チャージ反映
    const ch = paddle.charge;
    if (ch > 0.08) {
      let mult = 1 + ch * CONFIG.chargeSpeedBoost;
      if (paddle.chargeReady) {
        mult *= CONFIG.chargeReleaseBonus;
        Sound.chargeHit();
        spawnParticles(ball.x, ball.y, "#00f5ff", 14);
      } else {
        Sound.paddleHit();
      }
      speed = Math.min(speed * mult, CONFIG.maxBallSpeed);
      ball.charged = true;
      paddle.charge = 0;
      paddle.chargeReady = false;
      paddle.chargeReadyTimer = 0;
    } else {
      Sound.paddleHit();
      ball.charged = false;
    }

    ball.dx = Math.sin(angle) * speed;
    ball.dy = -Math.abs(Math.cos(angle) * speed);
    ball.speed = speed;
    ball.y = paddle.y - ball.radius;
    resetCombo();
  }
}

// 移動を細かく分割して貫通バグを防ぐ
function moveBall(ball) {
  const dist = Math.hypot(ball.dx, ball.dy);
  const steps = Math.max(1, Math.ceil(dist / CONFIG.moveStep));
  const stepDx = ball.dx / steps;
  const stepDy = ball.dy / steps;

  for (let i = 0; i < steps; i++) {
    ball.x += stepDx;
    ball.y += stepDy;
    resolveBallWallCollision(ball);
    resolveBallPaddleCollision(ball);
    resolveBallBlockCollisions(ball);
  }
}

/* ============================================================
   9b. チャージ（長押し）
   ============================================================ */

function startCharging() {
  if (gameState !== "playing") return;
  input.charging = true;
}

function releaseCharge() {
  input.charging = false;
  if (paddle.charge > 0.06) {
    paddle.chargeReady = true;
    paddle.chargeReadyTimer = CONFIG.chargeReleaseWindow;
  }
}

function updateCharge() {
  if (input.charging) {
    paddle.charge = Math.min(1, paddle.charge + 16 / CONFIG.chargeMaxTime);
    paddle.chargeReady = false;
    paddle.chargeReadyTimer = 0;
  } else if (paddle.chargeReadyTimer > 0) {
    paddle.chargeReadyTimer -= 16;
    if (paddle.chargeReadyTimer <= 0) {
      paddle.chargeReady = false;
      paddle.charge *= 0.25;
    }
  } else if (paddle.charge > 0) {
    paddle.charge = Math.max(0, paddle.charge - 0.006);
  }
}

/* ============================================================
   10. 更新処理
   ============================================================ */

function updatePaddle() {
  if (input.touchX !== null) {
    paddle.x = input.touchX - paddle.width / 2;
  } else {
    if (input.left)  paddle.x -= CONFIG.paddleSpeed;
    if (input.right) paddle.x += CONFIG.paddleSpeed;
  }
  clampPaddle();

  // ワイド効果の終了
  if (wideTimer > 0) {
    wideTimer -= 16;
    if (wideTimer <= 0) {
      const center = paddle.x + paddle.width / 2;
      paddle.width = paddle.baseWidth;
      paddle.x = center - paddle.width / 2;
      clampPaddle();
    }
  }

  // 貫通効果の終了
  if (pierceTimer > 0) {
    pierceTimer -= 16;
    if (pierceTimer <= 0) {
      balls.forEach((ball) => {
        ball.piercing = false;
        ball.pierceInside = new Set();
      });
    }
  }

  updateCharge();
}

function updateBalls() {
  const toRemove = [];

  balls.forEach((ball, index) => {
    moveBall(ball);

    if (ball.y - ball.radius > canvas.height) {
      toRemove.push(index);
    }
  });

  // 後ろから削除
  toRemove.reverse().forEach((i) => balls.splice(i, 1));

  if (balls.length === 0) {
    lives--;
    if (lives <= 0) {
      endGame("gameover");
    } else {
      balls.push(createBall());
      resetCombo();
    }
  }
}

function updateItems() {
  items = items.filter((item) => {
    item.y += item.vy;

    // パドルで取得
    if (
      item.y + item.height >= paddle.y &&
      item.y <= paddle.y + paddle.height &&
      item.x + item.width >= paddle.x &&
      item.x <= paddle.x + paddle.width
    ) {
      collectItem(item);
      return false;
    }

    return item.y < canvas.height;
  });
}

function updateLasers() {
  if (laserActive) {
    laserTimer -= 16;
    laserFireTimer -= 16;
    if (laserFireTimer <= 0) {
      fireLaser();
      laserFireTimer = CONFIG.laserFireInterval;
    }
    if (laserTimer <= 0) laserActive = false;
  }

  lasers = lasers.filter((laser) => {
    laser.y -= laser.speed;

    blocks.forEach((block) => {
      if (!block.alive) return;
      if (
        laser.x < block.x + block.width &&
        laser.x + laser.width > block.x &&
        laser.y < block.y + block.height &&
        laser.y + laser.height > block.y
      ) {
        breakBlock(block, ball);
      }
    });

    return laser.y + laser.height > 0;
  });
}

function updateComboTimer() {
  if (comboTimer > 0) {
    comboTimer -= 16;
    if (comboTimer <= 0) resetCombo();
  }
}

function checkStageClear() {
  if (stageClearing) return;
  if (!blocks.every((b) => !b.alive)) return;

  if (currentStage >= STAGES.length - 1) {
    Save.onStageClear(currentStage);
    endGame("clear");
    return;
  }

  Save.onStageClear(currentStage);

  // 次のステージへ（一時停止 → 演出 → 再開）
  stageClearing = true;
  gameState = "paused";
  Sound.stageClear();
  spawnParticles(canvas.width / 2, canvas.height / 2, "#00f5ff", 30);
  UI.stageClear.classList.remove("hidden");

  setTimeout(() => {
    currentStage++;
    items = [];
    lasers = [];
    laserActive = false;
    wideTimer = 0;
    pierceTimer = 0;
    paddle.width = paddle.baseWidth;
    createBlocksForStage();
    balls = [createBall()];
    resetCombo();
    updateHUD();
    UI.stageClear.classList.add("hidden");
    stageClearing = false;
    gameState = "playing";
    gameLoop(); // ループを再開（paused中に止まるため必須）
  }, CONFIG.stageClearDelay);
}

function update() {
  updatePaddle();
  updateBalls();
  updateItems();
  updateLasers();
  updateParticles();
  updateComboTimer();
  updateHUD();
  checkStageClear();
}

/* ============================================================
   11. 描画
   ============================================================ */

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function drawBackground() {
  const stageBg = getStageBg();

  ctx.fillStyle = "#0d0020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = stageBg.bgTint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(185, 103, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  ctx.save();
  ctx.font = "bold 10px sans-serif";
  ctx.fillStyle = "rgba(0, 245, 255, 0.3)";
  ctx.textAlign = "center";
  ctx.fillText(`STAGE ${currentStage + 1}  ${stageBg.name}`, canvas.width / 2, 17);
  ctx.restore();
}

// ネオン石ブロックを描画（丸みのある磨かれた石）
function drawStoneBlock(block) {
  const { x, y, width: w, height: h, color, hp } = block;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(5, w * 0.18, h * 0.28);

  ctx.save();
  ctx.shadowColor = color.glow;
  ctx.shadowBlur = hp > 1 ? 16 : 11;

  // 石の本体（上が明るく下が暗い）
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, color.light);
  bodyGrad.addColorStop(0.45, color.mid);
  bodyGrad.addColorStop(1, color.base);
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // 上面の光沢
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  roundRect(ctx, x + 2, y + 2, w - 4, h * 0.38, r - 1);
  ctx.fill();

  // 左の影（立体感）
  const shadeGrad = ctx.createLinearGradient(x, y, x + w * 0.45, y);
  shadeGrad.addColorStop(0, "rgba(0, 0, 0, 0.18)");
  shadeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadeGrad;
  roundRect(ctx, x, y, w * 0.45, h, r);
  ctx.fill();

  // ネオンの縁取り
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color.glow;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.2;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();

  // 小さなハイライト点
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.arc(x + w * 0.28, y + h * 0.3, Math.max(1, w * 0.05), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (hp > 1) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `bold ${Math.max(9, Math.floor(h * 0.52))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color.glow;
    ctx.shadowBlur = 6;
    ctx.fillText(hp, cx, cy + 0.5);
    ctx.restore();
  }
}

function drawBlocks() {
  blocks.forEach((block) => {
    if (!block.alive) return;
    drawStoneBlock(block);
  });
}

function drawPaddle() {
  const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.width, paddle.y);
  grad.addColorStop(0, "#ff6ec7");
  grad.addColorStop(0.5, "#b967ff");
  grad.addColorStop(1, "#00f5ff");

  ctx.save();
  const isCharged = paddle.charge > 0.1;
  const isReady = paddle.chargeReady;
  ctx.shadowColor = isReady ? "#00f5ff" : isCharged ? "#ffe066" : laserActive ? "#00f5ff" : "#ff6ec7";
  ctx.shadowBlur = isReady ? 28 : isCharged ? 20 : laserActive ? 25 : 15;
  ctx.fillStyle = grad;
  roundRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 7);
  ctx.fill();

  // チャージゲージ
  if (paddle.charge > 0.02) {
    const barY = paddle.y - 6;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    roundRect(ctx, paddle.x, barY, paddle.width, 4, 2);
    ctx.fill();
    const barColor = isReady ? "#00f5ff" : `rgba(255, ${Math.floor(110 + paddle.charge * 140)}, 100, 1)`;
    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = isReady ? 12 : 8;
    roundRect(ctx, paddle.x, barY, paddle.width * paddle.charge, 4, 2);
    ctx.fill();
  }

  if (laserActive) {
    ctx.fillStyle = "#00f5ff";
    ctx.shadowBlur = 10;
    ctx.fillRect(paddle.x + paddle.width / 2 - 2, paddle.y - 4, 4, 4);
  }
  ctx.restore();
}

function drawBalls() {
  balls.forEach((ball) => {
    const isPierce = pierceTimer > 0;
    const isCharged = ball.charged && !isPierce;
    ctx.save();
    ctx.shadowColor = isPierce ? "#ff3344" : isCharged ? "#ffe066" : "#00f5ff";
    ctx.shadowBlur = isCharged ? 24 : isPierce ? 22 : 18;
    const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.radius);
    if (isPierce) {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, "#ff6b6b");
      grad.addColorStop(1, "#ff1a1a");
    } else if (isCharged) {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, "#ffe066");
      grad.addColorStop(1, "#ff6ec7");
    } else {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, "#00f5ff");
      grad.addColorStop(1, "#b967ff");
    }
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  });
}

function drawItems() {
  items.forEach((item) => {
    const info = ITEM_TYPES[item.type];
    ctx.save();
    ctx.shadowColor = info.glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = info.color;
    roundRect(ctx, item.x, item.y, item.width, item.height, 5);
    ctx.fill();
    ctx.fillStyle = "#0d0020";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 0;
    ctx.fillText(info.label, item.x + item.width / 2, item.y + item.height / 2);
    ctx.restore();
  });
}

function drawLasers() {
  lasers.forEach((laser) => {
    ctx.save();
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#00f5ff";
    ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawLives() {
  ctx.save();
  for (let i = 0; i < lives; i++) {
    ctx.shadowColor = "#ff6ec7";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ff6ec7";
    ctx.beginPath();
    ctx.arc(canvas.width - 14 - i * 16, canvas.height - 10, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  drawBackground();
  drawBlocks();
  drawItems();
  drawLasers();
  drawPaddle();
  drawBalls();
  drawParticles();
  drawLives();
}

/* ============================================================
   12. ゲームループ・画面遷移
   ============================================================ */

function gameLoop() {
  if (gameState !== "playing") return;
  update();
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function startGame(startStage = selectedStartStage) {
  Sound.init();
  if (animationId) cancelAnimationFrame(animationId);
  initGame(startStage);
  showScreen("game");
  gameState = "playing";
  gameLoop();
}

function goToTitle() {
  showScreen("title");
  gameState = "title";
  updateTitleScreen();
}

function updateTitleScreen() {
  Save.load();
  selectedStartStage = Math.min(selectedStartStage, Save.data.unlockedStage);

  const grid = document.getElementById("stage-select-grid");
  const unlockedText = document.getElementById("unlocked-stage-text");
  const totalText = document.getElementById("total-stage-text");
  const continueBtn = document.getElementById("start-continue-btn");

  if (!grid) return;

  grid.innerHTML = "";
  totalText.textContent = STAGES.length;
  unlockedText.textContent = Save.data.unlockedStage + 1;

  for (let i = 0; i < STAGES.length; i++) {
    const btn = document.createElement("button");
    btn.className = "stage-btn";
    const unlocked = i <= Save.data.unlockedStage;

    if (unlocked) {
      btn.textContent = i + 1;
      if (i === selectedStartStage) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        selectedStartStage = i;
        updateTitleScreen();
      });
    } else {
      btn.classList.add("locked");
      btn.textContent = "🔒";
      btn.disabled = true;
    }
    grid.appendChild(btn);
  }

  continueBtn.disabled = Save.data.unlockedStage === 0;
}

function endGame(result) {
  gameState = result;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (result === "gameover") {
    Sound.gameOver();
    UI.finalScoreOver.textContent = score;
    UI.finalStageOver.textContent = currentStage + 1;
    showScreen("gameover");
  } else if (result === "clear") {
    Sound.allClear();
    UI.finalScoreClear.textContent = score;
    showScreen("clear");
  }
}

/* ============================================================
   13. 入力処理
   ============================================================ */

// キーボード
document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
  if (e.code === "Space") {
    if (gameState === "title") {
      e.preventDefault();
      startGame(selectedStartStage);
    } else if (gameState === "playing") {
      e.preventDefault();
      startCharging();
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
  if (e.code === "Space" && gameState === "playing") {
    e.preventDefault();
    releaseCharge();
  }
});

// 左右ボタン（長押しでチャージも可能）
function setupControlButton(btn, direction) {
  let moveStarted = false;

  const press = (e) => {
    e.preventDefault();
    moveStarted = false;
    input[direction] = true;
    input.touchX = null;
    btn.classList.add("pressed");
    setTimeout(() => {
      if (btn.classList.contains("pressed") && !moveStarted && gameState === "playing") {
        startCharging();
      }
    }, 250);
  };
  const release = (e) => {
    e.preventDefault();
    input[direction] = false;
    btn.classList.remove("pressed");
    if (input.charging) releaseCharge();
  };
  const move = (e) => {
    e.preventDefault();
    moveStarted = true;
    if (input.charging) {
      input.charging = false;
      paddle.chargeReady = false;
    }
  };

  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchmove", move, { passive: false });
  btn.addEventListener("touchend", release);
  btn.addEventListener("touchcancel", release);
}

setupControlButton(document.getElementById("btn-left"), "left");
setupControlButton(document.getElementById("btn-right"), "right");

// キャンバス：タッチ / スワイプでパドル移動
function canvasToGameX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  return (clientX - rect.left) * scaleX;
}

canvas.addEventListener("touchstart", (e) => {
  if (gameState !== "playing") return;
  e.preventDefault();
  input.touchStartX = e.touches[0].clientX;
  input.touchMode = null;
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  if (gameState !== "playing") return;
  e.preventDefault();
  const touchX = e.touches[0].clientX;
  const moved = Math.abs(touchX - input.touchStartX);

  if (moved > 14) {
    input.touchMode = "move";
    input.charging = false;
    input.touchX = canvasToGameX(touchX);
  } else if (input.touchMode !== "move") {
    input.touchMode = "charge";
    input.touchX = null;
    startCharging();
  }
}, { passive: false });

canvas.addEventListener("touchend", () => {
  if (input.touchMode === "charge") releaseCharge();
  input.touchX = null;
  input.touchMode = null;
});

canvas.addEventListener("touchcancel", () => {
  if (input.charging) releaseCharge();
  input.touchX = null;
  input.touchMode = null;
});

// マウス：ドラッグで移動、静止長押しでチャージ
let mouseDown = false;
let mouseStartX = 0;

canvas.addEventListener("mousedown", (e) => {
  if (gameState !== "playing") return;
  mouseDown = true;
  mouseStartX = e.clientX;
  input.touchMode = null;
});

canvas.addEventListener("mousemove", (e) => {
  if (gameState !== "playing" || !mouseDown) return;
  const moved = Math.abs(e.clientX - mouseStartX);
  if (moved > 10) {
    input.touchMode = "move";
    input.charging = false;
    input.touchX = canvasToGameX(e.clientX);
  } else if (input.touchMode !== "move") {
    input.touchMode = "charge";
    input.touchX = null;
    startCharging();
  }
});

canvas.addEventListener("mouseup", () => {
  if (input.touchMode === "charge") releaseCharge();
  mouseDown = false;
  input.touchX = null;
  input.touchMode = null;
});

canvas.addEventListener("mouseleave", () => {
  if (input.charging) releaseCharge();
  mouseDown = false;
  input.touchX = null;
});

/* ============================================================
   14. UIボタン
   ============================================================ */

document.getElementById("start-btn").addEventListener("click", () => startGame(selectedStartStage));
document.getElementById("start-begin-btn").addEventListener("click", () => startGame(0));
document.getElementById("start-continue-btn").addEventListener("click", () => {
  selectedStartStage = Save.data.unlockedStage;
  startGame(Save.data.unlockedStage);
});
document.getElementById("retry-btn-over").addEventListener("click", () => startGame(currentStage));
document.getElementById("retry-btn-clear").addEventListener("click", () => startGame(0));
document.getElementById("title-btn-over").addEventListener("click", goToTitle);
document.getElementById("title-btn-clear").addEventListener("click", goToTitle);

document.querySelectorAll(".sound-toggle").forEach((btn) => {
  btn.addEventListener("click", () => Sound.toggle());
});

/* ============================================================
   15. 起動
   ============================================================ */

setupPromo();
updateSoundButtons();
Save.load();
updateTitleScreen();
