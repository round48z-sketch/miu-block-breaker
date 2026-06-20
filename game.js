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
  laserDropChance: 0.06,    // 落下アイテムがレーザーになる確率（他は均等）
  laserWidth: 4,
  laserSpeed: 10,
  laserDuration: 7000,
  laserFireInterval: 280,
  widePaddleScale: 1.45,
  wideDuration: 9000,
  speedBoostMultiplier: 1.75,  // パドル移動速度アップ倍率
  speedBoostDuration: 10000,   // 持続時間(ms)
  pierceDuration: 8000,     // 貫通ボールの持続時間(ms)
  barrierDuration: 10000,   // バリアの持続時間(ms)
  bossItemDropBonus: 0.14,  // ボス戦のブロック落下率ボーナス
  bossHitItemDropChance: 0.12, // ボス被弾時のアイテム落下率
  moveStep: 3,                // 1フレームの移動を分割（貫通防止）
  stageClearDelay: 1800,
  lives: 2,
  extraLifeScore: 15000,     // このスコアごとに残機+1
  maxLives: 99,
  // チャージ（長押しでパドルにためる）
  chargeMaxTime: 1400,       // 満タンまでのミリ秒
  chargeSpeedBoost: 1.6,     // 満タン時の速度倍率（+160%）
  chargeDecayPerPaddle: 0.82, // 通常返し1回ごとに余剰速度が18%減
  chargeDecayPerFrame: 0.9992, // 飛行中もわずかに減衰（1=減衰なし）
  chargeShotDuration: 10000,   // チャージショット効果（色変化・貫通）の持続(ms)
  maxBallSpeed: 12,
  // ボス戦
  bossDefeatDelay: 2400,
  bossBlockOffsetY: 54,
  paddleInvincibleTime: 1400,
};

// チャージ量ティア（色＝威力。貯め時間が長いほど上位）
const CHARGE_SHOT_TIERS = [
  {
    threshold: 0,
    damage: 2,
    pierce: 2,
    glow: "#50ffbb",
    inner: "#ffffff",
    mid: "#50ffbb",
    outer: "#00f5ff",
  },
  {
    threshold: 0.35,
    damage: 3,
    pierce: 3,
    glow: "#ffe066",
    inner: "#ffffff",
    mid: "#ffe066",
    outer: "#ffaa00",
  },
  {
    threshold: 0.65,
    damage: 3,
    pierce: 4,
    glow: "#ff8844",
    inner: "#ffffff",
    mid: "#ffaa44",
    outer: "#ff4400",
  },
  {
    threshold: 0.9,
    damage: 4,
    pierce: 5,
    glow: "#b967ff",
    inner: "#ffffff",
    mid: "#ffe066",
    outer: "#b967ff",
  },
];

// ボス出現ステージ（1始まり）と段階別ステータス
const BOSS_STAGE_NUMBERS = [5, 10, 15, 20, 24];
const BOSS_STAGES = BOSS_STAGE_NUMBERS.map((n) => n - 1);
const BOSS_NAMES = ["みう", "みう Mk-II", "みう MAX", "みう GOD", "真・みう"];

function getBossTier(stage = currentStage) {
  const tier = BOSS_STAGES.indexOf(stage);
  return tier >= 0 ? tier : 0;
}

function getBossConfig(tier = getBossTier()) {
  return {
    tier,
    name: BOSS_NAMES[tier] || BOSS_NAMES[BOSS_NAMES.length - 1],
    hp: 38 + tier * 22,
    width: 70 + tier * 6,
    height: 40 + tier * 5,
    speed: 1.7 + tier * 0.45,
    shootInterval: Math.max(850, 1750 - tier * 160),
    bulletSpeed: 3.4 + tier * 0.5,
    bulletRadius: 4.5 + tier * 0.55,
    ballDamage: 1 + Math.floor(tier / 2),
    chargeDamage: 2 + Math.floor(tier / 2),
    angryThreshold: Math.max(0.25, 0.48 - tier * 0.05),
    angrySpread: 2 + tier,
    angrySpeedMult: 1.12 + tier * 0.05,
    angryIntervalMult: Math.max(0.55, 0.78 - tier * 0.04),
    blockRowsMax: Math.max(3, 5 - Math.floor(tier / 2)),
    laserHitCooldown: Math.max(100, 200 - tier * 22),
    glowColor: ["#b967ff", "#00f5ff", "#ff6ec7", "#ffe066", "#ff3344"][tier],
  };
}

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
  // ステージ21〜23：ラストスパート
  { rows: 12, cols: 10, ballSpeed: 8.4, dropRate: 0.21, layout: "wall" },
  { rows: 12, cols: 10, ballSpeed: 8.6, dropRate: 0.22, layout: "gates" },
  { rows: 13, cols: 10, ballSpeed: 8.9, dropRate: 0.22, layout: "fortress" },
  { rows: 13, cols: 10, ballSpeed: 9.2, dropRate: 0.22, layout: "scatter" },
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

function getBossHpBonus(stage = currentStage) {
  return BOSS_STAGES.filter((bossStage) => stage > bossStage).length;
}

function getBlockHp(row, col) {
  const stage = currentStage;
  let hp = 1;

  if (stage >= 1 && row === 0 && col % 2 === 0) hp = 2;
  if (stage >= 3 && row <= 1 && col % 3 === 0) hp = Math.max(hp, 2);
  if (stage >= 5 && row === 0) hp = Math.max(hp, 2);
  if (stage >= 8 && row <= 2 && col % 4 === 0) hp = Math.max(hp, 3);
  if (stage >= 11 && row <= 1 && col % 2 === 1) hp = Math.max(hp, 3);
  if (stage >= 14 && row <= 2) hp = Math.max(hp, 2);
  if (stage >= 17 && row <= 1) hp = Math.max(hp, 3);
  if (stage >= 19 && row === 0) hp = Math.max(hp, 4);
  if (stage >= 21 && row <= 3) hp = Math.max(hp, 2);
  if (stage >= 23 && row <= 2) hp = Math.max(hp, 3);

  // ボス撃破ごとに以降ステージのブロック耐久 +1
  hp += getBossHpBonus(stage);

  return Math.min(hp, 7);
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
  { name: "エクストリーム",  bgTint: "rgba(255, 80, 120, 0.05)" },
  { name: "インフィニティ",  bgTint: "rgba(100, 80, 255, 0.05)" },
  { name: "真・ファイナル",  bgTint: "rgba(255, 220, 80, 0.06)" },
  { name: "ラストボス",      bgTint: "rgba(255, 60, 150, 0.06)" },
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

const STAGE_BG_IMAGE_COUNT = 24;
const stageBgImages = new Array(STAGE_BG_IMAGE_COUNT);

function preloadStageBgImages() {
  for (let i = 1; i <= STAGE_BG_IMAGE_COUNT; i++) {
    const img = new Image();
    img.decoding = "async";
    img.src = `${i}.jpg`;
    stageBgImages[i - 1] = img;
  }
}

function getStageBgImage() {
  const idx = Math.min(currentStage, STAGE_BG_IMAGE_COUNT - 1);
  const img = stageBgImages[idx];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

function drawCoverImage(img) {
  const cw = canvas.width;
  const ch = canvas.height;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

function getColumnColor(col) {
  return COLUMN_NEON_COLORS[col % COLUMN_NEON_COLORS.length];
}

/* ============================================================
   1b. セーブデータ（ステージ解放）
   ============================================================ */

const SAVE_KEY = "miu-block-breaker-save";
const SAVE_VERSION = 1;

const Save = {
  data: {
    version: SAVE_VERSION,
    unlockedStage: 0,
    allClear: false,
    highScore: 0,
    savedAt: null,
  },
  sessionDirty: false,

  defaultData() {
    return {
      version: SAVE_VERSION,
      unlockedStage: 0,
      allClear: false,
      highScore: 0,
      savedAt: null,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...this.defaultData(), ...parsed };
        this.sessionDirty = false;
      } else {
        this.data = this.defaultData();
        this.sessionDirty = false;
      }
    } catch (e) {
      this.data = this.defaultData();
    }
    this.data.unlockedStage = Math.max(0, Math.min(this.data.unlockedStage, STAGES.length - 1));
    return this.hasSavedData();
  },

  hasSavedData() {
    return this.data.savedAt !== null;
  },

  save(isManual = false) {
    try {
      this.data.version = SAVE_VERSION;
      this.data.savedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.sessionDirty = false;
      this.updateStatusUI();
      if (isManual) this.showToast("セーブしました！");
      return true;
    } catch (e) {
      if (isManual) this.showToast("セーブに失敗しました");
      return false;
    }
  },

  markDirty() {
    this.sessionDirty = true;
    this.updateStatusUI();
  },

  unlockStage(stageIndex) {
    const next = Math.max(0, Math.min(stageIndex, STAGES.length - 1));
    if (next > this.data.unlockedStage) {
      this.data.unlockedStage = next;
      this.markDirty();
    }
  },

  onStageClear(clearedIndex) {
    if (clearedIndex >= STAGES.length - 1) {
      this.data.allClear = true;
      this.unlockStage(STAGES.length - 1);
    } else {
      this.unlockStage(clearedIndex + 1);
    }
    this.save(false);
  },

  recordHighScore(score) {
    if (score > this.data.highScore) {
      this.data.highScore = score;
      this.markDirty();
    }
  },

  formatSavedAt() {
    if (!this.data.savedAt) return null;
    const d = new Date(this.data.savedAt);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  updateStatusUI() {
    const el = document.getElementById("save-status");
    if (!el) return;

    if (this.sessionDirty) {
      el.textContent = "⚠ 未セーブの進行があります（セーブボタンを押してください）";
      el.className = "save-status unsaved";
    } else if (this.hasSavedData()) {
      const hi = this.data.highScore > 0 ? ` / ハイスコア ${this.data.highScore}` : "";
      el.textContent = `💾 最終セーブ: ${this.formatSavedAt()}${hi}`;
      el.className = "save-status saved";
    } else {
      el.textContent = "⚠ 未セーブです（ステージ解放はセーブ後に保持されます）";
      el.className = "save-status unsaved";
    }
  },

  showToast(message) {
    const toast = document.getElementById("save-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.style.animation = "none";
    void toast.offsetWidth;
    toast.style.animation = "";
    clearTimeout(Save._toastTimer);
    Save._toastTimer = setTimeout(() => toast.classList.add("hidden"), 2000);
  },
};

let selectedStartStage = 0;

// アイテム種類
const ITEM_TYPES = {
  MULTI:  { label: "M", color: "#ffe066", glow: "#fff099" },  // ボール増殖
  LASER:  { label: "L", color: "#00f5ff", glow: "#80ffff" },  // レーザー
  WIDE:   { label: "W", color: "#b967ff", glow: "#d4a0ff" },  // パドル拡大
  SPEED:  { label: "S", color: "#50ffbb", glow: "#a0ffd8" },  // パドル高速
  PIERCE: { label: "P", color: "#ff3344", glow: "#ff6b6b" },  // 貫通ボール
  BARRIER:{ label: "B", color: "#88ccff", glow: "#00f5ff" },  // バリア（10秒）
};

// みう宣伝（ここを書き換えるとクリア画面が変わる）
const MIU_PROMO = {
  songUrl: "https://example.com/miu-song",  // 曲のURL
  imageUrl: "",                              // 画像パス（例: "assets/miu.png"）
};

const GAMEOVER_SONGS = [
  {
    name: "キラメキフィーバー",
    image: "kirameki.jpg",
    url: "https://open.spotify.com/intl-ja/track/6FwegiT1StQcQK4zSJEZ5X?si=bf958ea64e15473f",
  },
  {
    name: "FIRE",
    image: "fire.jpg",
    url: "https://open.spotify.com/intl-ja/track/64ENDNvfw95DX9v45m1kKe?si=6731d586c6a94d7b",
  },
  {
    name: "IZON",
    image: "izon.jpg",
    url: "https://open.spotify.com/intl-ja/track/0rQOKHqwbgZuwXjuewZ3M0?si=1cbba7946ae04669",
  },
];

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
   3. サウンド（Web Audio API + BGM）
   ============================================================ */

const BGM_TRACKS = ["song1.mp3", "song2.mp3", "song3.mp3"];

const BGM = {
  enabled: true,
  volume: 0.42,
  audio: null,
  currentTrack: null,
  pendingPlay: false,

  pickTrack(excludeTrack = null) {
    const candidates = excludeTrack
      ? BGM_TRACKS.filter((track) => track !== excludeTrack)
      : BGM_TRACKS;
    const pool = candidates.length > 0 ? candidates : BGM_TRACKS;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  tryPlay(audio) {
    if (this.audio !== audio || !this.enabled) return;
    audio.play()
      .then(() => {
        this.pendingPlay = false;
      })
      .catch(() => {
        this.pendingPlay = true;
      });
  },

  playTrack(trackPath) {
    if (!this.enabled) return;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }

    const audio = new Audio(trackPath);
    audio.loop = false;
    audio.volume = this.volume;
    audio.preload = "auto";
    this.audio = audio;
    this.currentTrack = trackPath;
    this.pendingPlay = false;

    audio.addEventListener("canplaythrough", () => this.tryPlay(audio), { once: true });
    audio.addEventListener("ended", () => {
      if (this.audio !== audio || !this.enabled || gameState !== "playing") return;
      this.playNext();
    });
    audio.addEventListener("error", () => {
      if (this.audio === audio) {
        this.audio = null;
        this.currentTrack = null;
        this.pendingPlay = false;
      }
    });
    audio.load();
    this.tryPlay(audio);
  },

  playRandom() {
    if (!this.enabled) return;
    this.stop();
    this.playTrack(this.pickTrack());
  },

  playNext() {
    if (!this.enabled || gameState !== "playing") return;
    this.playTrack(this.pickTrack(this.currentTrack));
  },

  tryResumePending() {
    if (!this.pendingPlay || !this.enabled || gameState !== "playing") return;
    if (this.audio) this.tryPlay(this.audio);
    else this.playRandom();
  },

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.src = "";
    this.audio = null;
    this.currentTrack = null;
  },

  pause() {
    if (this.audio && !this.audio.paused) this.audio.pause();
  },

  resume() {
    if (!this.enabled || !this.audio) return;
    this.tryPlay(this.audio);
  },

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      if (gameState === "playing") {
        if (this.audio) this.resume();
        else this.playRandom();
      }
    } else {
      this.pause();
    }
    updateSoundButtons();
  },
};

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
  bossHit()     { this.play(280, 0.06, "square", 0.1); this.play(440, 0.08, "sawtooth", 0.08); },
  bossDefeat()  { this.play(330, 0.12, "sine", 0.12); setTimeout(() => this.play(494, 0.15), 100); setTimeout(() => this.play(659, 0.2), 220); setTimeout(() => this.play(880, 0.35), 380); },
  bossHurt()    { this.play(150, 0.15, "sawtooth", 0.1); },
  gameOver()    { this.play(200, 0.4, "sawtooth", 0.12); },
  allClear()    { this.play(523, 0.15); setTimeout(() => this.play(659, 0.15), 120); setTimeout(() => this.play(784, 0.15), 240); setTimeout(() => this.play(1047, 0.4), 360); },
};

function updateSoundButtons() {
  const seMini = Sound.enabled ? "🔊" : "🔇";
  document.querySelectorAll(".sound-toggle.mini").forEach((btn) => {
    btn.textContent = seMini;
    btn.classList.toggle("off", !Sound.enabled);
  });

  const bgmBtn = document.getElementById("sound-btn-title");
  const seBtn = document.getElementById("sound-btn-title-se");
  if (bgmBtn) bgmBtn.classList.toggle("off", !BGM.enabled);
  if (seBtn) seBtn.classList.toggle("off", !Sound.enabled);

  const bgmLabel = document.querySelector(".sound-label-bgm");
  const seLabel = document.querySelector(".sound-label-se");
  if (bgmLabel) bgmLabel.textContent = BGM.enabled ? "BGM ON" : "BGM OFF";
  if (seLabel) seLabel.textContent = Sound.enabled ? "SE ON" : "SE OFF";
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
let nextExtraLifeScore = CONFIG.extraLifeScore;

let paddle = {
  x: 0, y: 0,
  width: CONFIG.paddleWidth,
  height: CONFIG.paddleHeight,
  baseWidth: CONFIG.paddleWidth,
  charge: 0,
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
let speedTimer = 0;
let pierceTimer = 0;
let barrierTimer = 0;
let stageClearing = false;   // ステージ切り替え中フラグ

let boss = null;
let bossBullets = [];
let bossDefeating = false;
let bossDefeatTimer = 0;
let paddleInvincible = 0;

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
  const base = STAGES[Math.min(currentStage, STAGES.length - 1)];
  const progress = currentStage / Math.max(1, STAGES.length - 1);
  return {
    ...base,
    ballSpeed: Math.min(CONFIG.maxBallSpeed, base.ballSpeed + 0.35 + progress * 0.85),
    dropRate: Math.max(0.12, base.dropRate - progress * 0.05),
  };
}

function initGame(startStage = 0) {
  currentStage = Math.max(0, Math.min(startStage, STAGES.length - 1));
  score = 0;
  lives = CONFIG.lives;
  nextExtraLifeScore = CONFIG.extraLifeScore;

  combo = 0;
  comboTimer = 0;
  items = [];
  lasers = [];
  particles = [];
  laserActive = false;
  laserTimer = 0;
  wideTimer = 0;
  speedTimer = 0;
  pierceTimer = 0;
  barrierTimer = 0;
  stageClearing = false;
  clearBoss();
  paddleInvincible = 0;

  paddle.baseWidth = CONFIG.paddleWidth;
  paddle.width = CONFIG.paddleWidth;
  paddle.x = (canvas.width - paddle.width) / 2;
  paddle.y = canvas.height - paddle.height - 16;
  paddle.charge = 0;
  input.charging = false;
  input.touchMode = null;

  balls = [createBall()];
  createBlocksForStage();
  if (isBossStage()) createBoss();
  updateHUD();
  updateChargeButtonUI();
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
    baseSpeed: speed,
    boostActive: false,
    charged: false,
    chargeBreaksLeft: 0,
    chargeShotTimer: 0,
    chargeShotPower: 0,
    chargeShotTier: null,
  };
}

function getChargeShotTier(power) {
  const p = Math.max(0, Math.min(1, power));
  let tier = CHARGE_SHOT_TIERS[0];
  for (const candidate of CHARGE_SHOT_TIERS) {
    if (p >= candidate.threshold) tier = candidate;
  }
  return tier;
}

function getChargeShotDamage(power) {
  return getChargeShotTier(power).damage;
}

function getChargeShotPierce(power) {
  return getChargeShotTier(power).pierce;
}

function getPaddleChargePower() {
  return paddle.charge > 0.08 ? paddle.charge : 0;
}

function getBallChargeTier(ball) {
  if (ball.chargeShotTimer > 0) {
    return ball.chargeShotTier || getChargeShotTier(ball.chargeShotPower);
  }
  const paddlePower = getPaddleChargePower();
  if (gameState === "playing" && paddlePower > 0) {
    return getChargeShotTier(paddlePower);
  }
  return null;
}

function drawChargeTierBall(ball, tier, isActive = false) {
  const pulse = isActive ? 0.6 + 0.4 * Math.sin(performance.now() / 130) : 1;
  const drawRadius = isActive ? ball.radius + 1.5 : ball.radius;

  if (isActive) {
    ctx.save();
    ctx.globalAlpha = 0.28 * pulse;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, drawRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = tier.glow;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.25;
    ctx.strokeStyle = tier.outer;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, drawRadius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.shadowColor = tier.glow;
  ctx.shadowBlur = (isActive ? 30 : 18) + tier.damage * 4;
  const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, drawRadius);
  grad.addColorStop(0, tier.inner);
  grad.addColorStop(0.35, tier.mid);
  grad.addColorStop(1, tier.outer);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, drawRadius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

function activateChargeShot(ball, power) {
  const clamped = Math.max(0, Math.min(1, power));
  const tier = getChargeShotTier(clamped);
  ball.chargeShotTimer = CONFIG.chargeShotDuration;
  ball.chargeShotPower = clamped;
  ball.chargeShotTier = tier;
  ball.chargeBreaksLeft = tier.pierce;
  ball.chargeInside = null;
  ball.charged = true;
}

function clearChargeBreakState(ball) {
  ball.chargeBreaksLeft = 0;
  ball.chargeInside = null;
}

function clearChargeShotState(ball) {
  ball.chargeShotTimer = 0;
  ball.chargeShotPower = 0;
  ball.chargeShotTier = null;
  clearChargeBreakState(ball);
  if (!ball.boostActive) ball.charged = false;
}

function getActiveChargeShotTier(ball) {
  return ball.chargeShotTier || getChargeShotTier(ball.chargeShotPower);
}

function updateChargeShotTimer(ball) {
  if (ball.chargeShotTimer <= 0) return;
  ball.chargeShotTimer -= 16;
  if (ball.chargeShotTimer <= 0) clearChargeShotState(ball);
}

function getBallSpeed(ball) {
  const velocity = Math.hypot(ball.dx, ball.dy);
  return Math.max(velocity, ball.speed || 0);
}

function applyBallVelocity(ball, speed, angle) {
  ball.dx = Math.sin(angle) * speed;
  ball.dy = -Math.abs(Math.cos(angle) * speed);
  ball.speed = speed;
  updateBallChargeVisual(ball);
}

function updateBallChargeVisual(ball) {
  if (ball.chargeShotTimer > 0) {
    ball.charged = true;
    return;
  }
  const base = ball.baseSpeed || getStageConfig().ballSpeed;
  ball.charged = ball.boostActive && ball.speed > base * 1.08;
}

// チャージ後の速度を徐々に通常へ戻す
function decayBoostSpeed(ball, speed) {
  const base = ball.baseSpeed || getStageConfig().ballSpeed;
  if (!ball.boostActive) {
    return Math.max(speed, base);
  }
  if (speed <= base * 1.03) {
    ball.boostActive = false;
    if (ball.chargeShotTimer <= 0) ball.charged = false;
    clearChargeBreakState(ball);
    return base;
  }
  const excess = speed - base;
  const newSpeed = base + excess * CONFIG.chargeDecayPerPaddle;
  if (newSpeed <= base * 1.03) {
    ball.boostActive = false;
    if (ball.chargeShotTimer <= 0) ball.charged = false;
    clearChargeBreakState(ball);
    return base;
  }
  return newSpeed;
}

function applySpeedToBall(ball, speed) {
  const current = getBallSpeed(ball);
  if (current < 0.001) return;
  const scale = speed / current;
  ball.dx *= scale;
  ball.dy *= scale;
  ball.speed = speed;
  updateBallChargeVisual(ball);
}

function updateBallBoostDecay(ball) {
  if (!ball.boostActive) return;
  const base = ball.baseSpeed || getStageConfig().ballSpeed;
  let speed = getBallSpeed(ball);
  if (speed <= base * 1.03) {
    ball.boostActive = false;
    if (ball.chargeShotTimer <= 0) ball.charged = false;
    clearChargeBreakState(ball);
    return;
  }
  const excess = speed - base;
  const newSpeed = base + excess * CONFIG.chargeDecayPerFrame;
  if (newSpeed <= base * 1.03) {
    ball.boostActive = false;
    if (ball.chargeShotTimer <= 0) ball.charged = false;
    clearChargeBreakState(ball);
    applySpeedToBall(ball, base);
  } else {
    applySpeedToBall(ball, newSpeed);
  }
}

function createBlocksForStage() {
  blocks = [];
  const stage = getStageConfig();
  const cols = stage.cols;
  let rows = stage.rows;
  const layout = stage.layout || "full";
  if (isBossStage()) {
    const bossCfg = getBossConfig(getBossTier());
    rows = Math.min(rows, bossCfg.blockRowsMax);
  }
  const blockHeight = rows > 10 ? 16 : CONFIG.blockHeight;
  const blockWidth =
    (canvas.width - CONFIG.blockOffsetLeft * 2 - CONFIG.blockPadding * (cols - 1)) / cols;
  const yOffset = isBossStage() ? CONFIG.bossBlockOffsetY : 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!shouldPlaceBlock(layout, row, col, rows, cols)) continue;
      const hp = getBlockHp(row, col);
      blocks.push({
        x: CONFIG.blockOffsetLeft + col * (blockWidth + CONFIG.blockPadding),
        y: CONFIG.blockOffsetTop + yOffset + row * (blockHeight + CONFIG.blockPadding),
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

function addScore(points) {
  if (points <= 0) return;
  score += points;
  while (score >= nextExtraLifeScore && lives < CONFIG.maxLives) {
    lives++;
    nextExtraLifeScore += CONFIG.extraLifeScore;
    grantExtraLife();
  }
}

function grantExtraLife() {
  Sound.itemGet();
  spawnParticles(canvas.width / 2, canvas.height - 36, "#ffe066", 22);
  spawnParticles(canvas.width / 2, canvas.height - 36, "#00f5ff", 14);
  showExtraLifePopup();
}

function showExtraLifePopup() {
  UI.comboPopup.textContent = "1UP!";
  UI.comboPopup.classList.remove("hidden");
  UI.comboPopup.style.animation = "none";
  void UI.comboPopup.offsetWidth;
  UI.comboPopup.style.animation = "";
  setTimeout(() => UI.comboPopup.classList.add("hidden"), 900);
}

function setupPromo() {
  UI.miuSongLink.href = MIU_PROMO.songUrl;
  if (MIU_PROMO.imageUrl) {
    UI.miuAvatar.innerHTML = `<img src="${MIU_PROMO.imageUrl}" alt="みう">`;
  }
}

function updateGameOverPromo() {
  const song = GAMEOVER_SONGS[Math.floor(Math.random() * GAMEOVER_SONGS.length)];
  const img = document.getElementById("gameover-song-img");
  const name = document.getElementById("gameover-song-name");
  const link = document.getElementById("gameover-spotify-btn");
  if (img) {
    img.src = song.image;
    img.alt = song.name;
  }
  if (name) name.textContent = song.name;
  if (link) link.href = song.url;
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

function pickItemType() {
  if (isBossStage()) {
    const roll = Math.random();
    if (roll < 0.24) return "BARRIER";
    if (roll < 0.32) return "LASER";
    const types = ["MULTI", "WIDE", "SPEED", "PIERCE"];
    return types[Math.floor(Math.random() * types.length)];
  }
  if (Math.random() < CONFIG.laserDropChance) return "LASER";
  const types = Object.keys(ITEM_TYPES).filter((t) => t !== "LASER" && t !== "BARRIER");
  return types[Math.floor(Math.random() * types.length)];
}

function spawnItem(x, y, type = pickItemType()) {
  items.push({
    x: x - CONFIG.itemSize / 2,
    y,
    width: CONFIG.itemSize,
    height: CONFIG.itemSize,
    type,
    vy: CONFIG.itemFallSpeed,
  });
}

function tryDropItem(x, y) {
  const stage = getStageConfig();
  let rate = stage.dropRate;
  if (isBossStage()) rate = Math.min(0.38, rate + CONFIG.bossItemDropBonus);
  if (Math.random() > rate) return;
  spawnItem(x, y);
}

function tryDropBossHitItem(x, y) {
  if (!isBossStage() || Math.random() > CONFIG.bossHitItemDropChance) return;
  spawnItem(x, y, pickItemType());
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
    case "SPEED":
      activateSpeed();
      break;
    case "PIERCE":
      activatePierce();
      break;
    case "BARRIER":
      activateBarrier();
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
        baseSpeed: ball.baseSpeed || ball.speed,
        boostActive: false,
        charged: false,
        chargeBreaksLeft: 0,
        chargeShotTimer: 0,
        chargeShotPower: 0,
        chargeShotTier: null,
      });
    }
  });
  balls.push(...newBalls);
}

function activateLaser() {
  laserActive = true;
  laserTimer = CONFIG.laserDuration;
  laserFireTimer = 0;
}

function activateWide() {
  wideTimer = CONFIG.wideDuration;
  const center = paddle.x + paddle.width / 2;
  paddle.width = paddle.baseWidth * CONFIG.widePaddleScale;
  paddle.x = center - paddle.width / 2;
  clampPaddle();
}

function activateSpeed() {
  speedTimer = CONFIG.speedBoostDuration;
}

function getPaddleSpeed() {
  return speedTimer > 0
    ? CONFIG.paddleSpeed * CONFIG.speedBoostMultiplier
    : CONFIG.paddleSpeed;
}

function activatePierce() {
  pierceTimer = CONFIG.pierceDuration;
  balls.forEach((ball) => {
    ball.pierceInside = new Set();
  });
}

function activateBarrier() {
  barrierTimer = CONFIG.barrierDuration;
  paddleInvincible = Math.max(paddleInvincible, 300);
  spawnParticles(paddle.x + paddle.width / 2, paddle.y, "#00f5ff", 18);
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
   8b. ボス戦
   ============================================================ */

function isBossStage(stage = currentStage) {
  return BOSS_STAGES.includes(stage);
}

function clearBoss() {
  boss = null;
  bossBullets = [];
  bossDefeating = false;
  bossDefeatTimer = 0;
}

function createBoss() {
  const cfg = getBossConfig(getBossTier());
  const w = cfg.width;
  const h = cfg.height;
  boss = {
    ...cfg,
    x: canvas.width / 2 - w / 2,
    y: 46,
    width: w,
    height: h,
    maxHp: cfg.hp,
    alive: true,
    moveDir: 1,
    shootTimer: cfg.shootInterval * 0.6,
    hitFlash: 0,
    pulse: 0,
    angry: false,
    ringPhase: 0,
    laserCooldown: 0,
  };
  bossBullets = [];
  bossDefeating = false;
  bossDefeatTimer = 0;
}

function getBossDamage(ball) {
  if (!boss) return 1;
  if (!ball) return boss.ballDamage;
  if (ball.chargeShotTimer > 0) {
    return Math.max(boss.chargeDamage, getActiveChargeShotTier(ball).damage);
  }
  if (ball.charged || ball.boostActive) return boss.chargeDamage;
  return boss.ballDamage;
}

function damageBoss(damage, hitX, hitY) {
  if (!boss || !boss.alive || bossDefeating) return;

  boss.hp -= damage;
  boss.hitFlash = 1;
  Sound.bossHit();
  spawnParticles(hitX, hitY, "#b967ff", 10);
  spawnParticles(hitX, hitY, "#00f5ff", 6);
  addScore(CONFIG.pointsPerBlock * 2 * getComboMultiplier());
  addCombo();

  if (boss.hp <= 0) startBossDefeat();
  else tryDropBossHitItem(hitX, hitY);
}

function startBossDefeat() {
  if (!boss || bossDefeating) return;

  boss.alive = false;
  bossDefeating = true;
  bossDefeatTimer = CONFIG.bossDefeatDelay;
  bossBullets = [];
  Sound.bossDefeat();
  UI.stageClear.textContent = "BOSS DOWN!";
  UI.stageClear.classList.remove("hidden");

  const cx = boss.x + boss.width / 2;
  const cy = boss.y + boss.height / 2;
  const colors = ["#00f5ff", "#ff6ec7", "#b967ff", "#ffe066", "#50ffbb"];
  colors.forEach((color, i) => {
    setTimeout(() => spawnParticles(cx, cy, color, 22), i * 80);
  });
  spawnParticles(cx, cy, "#ffffff", 35);
}

function shootBossBullet() {
  if (!boss || !boss.alive) return;

  const cx = boss.x + boss.width / 2;
  const cy = boss.y + boss.height;
  const px = paddle.x + paddle.width / 2;
  const py = paddle.y + paddle.height / 2;
  const angle = Math.atan2(py - cy, px - cx);
  const speed = boss.bulletSpeed * (boss.angry ? boss.angrySpeedMult : 1);

  const addBullet = (a, downward = false) => {
    const bulletAngle = downward ? Math.PI / 2 + (a - angle) * 0.15 : a;
    bossBullets.push({
      x: cx,
      y: cy,
      dx: Math.cos(bulletAngle) * speed,
      dy: Math.sin(bulletAngle) * speed,
      radius: boss.bulletRadius,
      color: boss.angry ? "#ff6ec7" : boss.glowColor,
    });
  };

  addBullet(angle);
  if (boss.angry) {
    const spread = 0.22 + boss.tier * 0.035;
    for (let i = 1; i <= boss.angrySpread; i++) {
      addBullet(angle - spread * i);
      addBullet(angle + spread * i);
    }
    if (boss.tier >= 3) {
      addBullet(angle, true);
      addBullet(angle - 0.5, true);
      addBullet(angle + 0.5, true);
    }
  }
}

function hurtPlayerFromBoss() {
  if (barrierTimer > 0 || paddleInvincible > 0) return;

  paddleInvincible = CONFIG.paddleInvincibleTime;
  lives--;
  Sound.bossHurt();
  spawnParticles(paddle.x + paddle.width / 2, paddle.y, "#ff3344", 16);
  resetCombo();

  if (lives <= 0) {
    endGame("gameover");
    return;
  }

  balls = [createBall()];
}

function updateBoss() {
  if (!boss) return;

  if (bossDefeating) {
    bossDefeatTimer -= 16;
    boss.pulse += 0.12;
    boss.ringPhase += 0.18;
    const cx = boss.x + boss.width / 2;
    const cy = boss.y + boss.height / 2;
    if (Math.random() < 0.28) {
      spawnParticles(cx, cy, ["#00f5ff", "#ff6ec7", "#b967ff"][Math.floor(Math.random() * 3)], 4);
    }
    if (bossDefeatTimer <= 0) {
      clearBoss();
      UI.stageClear.classList.add("hidden");
      UI.stageClear.textContent = "STAGE CLEAR!";
      proceedStageClear();
    }
    return;
  }

  if (!boss.alive) return;

  boss.x += boss.moveDir * boss.speed;
  if (boss.x <= 10) {
    boss.x = 10;
    boss.moveDir = 1;
  } else if (boss.x + boss.width >= canvas.width - 10) {
    boss.x = canvas.width - 10 - boss.width;
    boss.moveDir = -1;
  }

  boss.pulse += 0.07;
  boss.ringPhase += 0.05;
  if (boss.hitFlash > 0) boss.hitFlash -= 0.1;
  if (boss.laserCooldown > 0) boss.laserCooldown -= 16;
  boss.angry = boss.hp / boss.maxHp <= boss.angryThreshold;

  boss.shootTimer -= 16;
  if (boss.shootTimer <= 0) {
    shootBossBullet();
    boss.shootTimer = boss.shootInterval * (boss.angry ? boss.angryIntervalMult : 1);
  }
}

function updateBossBullets() {
  bossBullets = bossBullets.filter((bullet) => {
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;

    if (barrierTimer <= 0 &&
      paddleInvincible <= 0 &&
      circleRectCollision(bullet.x, bullet.y, bullet.radius, paddle.x, paddle.y, paddle.width, paddle.height)
    ) {
      hurtPlayerFromBoss();
      return false;
    }

    for (const ball of balls) {
      if (Math.hypot(bullet.x - ball.x, bullet.y - ball.y) < bullet.radius + ball.radius) {
        spawnParticles(bullet.x, bullet.y, bullet.color, 5);
        return false;
      }
    }

    return bullet.y < canvas.height + 24 && bullet.x > -24 && bullet.x < canvas.width + 24;
  });
}

function resolveBossBallCollision(ball) {
  if (!boss || !boss.alive || bossDefeating) return;

  if (!circleRectCollision(ball.x, ball.y, ball.radius, boss.x, boss.y, boss.width, boss.height)) return;

  const damage = getBossDamage(ball);
  damageBoss(damage, ball.x, ball.y);
  reflectBallOffBlock(ball, boss);
  separateBallFromBlock(ball, boss);
}

function drawBossHpBar() {
  if (!boss || bossDefeating) return;

  const barW = canvas.width - 36;
  const barH = 9;
  const x = 18;
  const y = 26;
  const ratio = Math.max(0, boss.hp / boss.maxHp);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  roundRect(ctx, x - 1, y - 1, barW + 2, barH + 2, 5);
  ctx.fill();

  const grad = ctx.createLinearGradient(x, y, x + barW, y);
  grad.addColorStop(0, "#ff6ec7");
  grad.addColorStop(0.5, "#b967ff");
  grad.addColorStop(1, "#00f5ff");
  ctx.shadowColor = "#b967ff";
  ctx.shadowBlur = 14;
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, barW * ratio, barH, 4);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0, 245, 255, 0.6)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, barW, barH, 4);
  ctx.stroke();

  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`BOSS ${boss.name}  ${boss.hp} / ${boss.maxHp}`, canvas.width / 2, y - 3);
  ctx.restore();
}

function drawBoss() {
  if (!boss) return;

  const { x, y, width: w, height: h } = boss;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pulse = Math.sin(boss.pulse) * 0.12 + 1;
  const flash = boss.hitFlash;
  const angry = boss.angry;
  const tier = boss.tier;
  const glow = boss.glowColor;

  ctx.save();

  if (bossDefeating) {
    const t = 1 - bossDefeatTimer / CONFIG.bossDefeatDelay;
    ctx.globalAlpha = 1 - t * 0.85;
    ctx.translate(cx, cy);
    ctx.scale(1 + t * 0.8, 1 + t * 0.8);
    ctx.rotate(t * 0.4);
    ctx.translate(-cx, -cy);
  }

  // ネオンリング
  const ringCount = 2 + tier;
  for (let i = 0; i < ringCount; i++) {
    const ringR = (w * 0.55 + i * 10) * pulse;
    const alpha = Math.max(0.08, 0.3 - i * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    if (angry) {
      ctx.strokeStyle = `rgba(255, 51, 68, ${alpha})`;
    } else if (tier >= 2) {
      ctx.strokeStyle = `rgba(255, 110, 199, ${alpha})`;
    } else {
      ctx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
    }
    ctx.lineWidth = 1.5 + tier * 0.2;
    ctx.shadowColor = angry ? "#ff3344" : glow;
    ctx.shadowBlur = 10 + tier * 2;
    ctx.stroke();
  }

  ctx.shadowColor = angry ? "#ff3344" : flash > 0 ? "#ffffff" : glow;
  ctx.shadowBlur = (18 + flash * 20) * pulse;

  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, flash > 0 ? "#ffffff" : "#ffc0e0");
  bodyGrad.addColorStop(0.4, angry ? "#ff4090" : "#b967ff");
  bodyGrad.addColorStop(1, angry ? "#9e1858" : "#5a20a8");
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = angry ? "#ff6ec7" : "#00f5ff";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 11);
  ctx.stroke();

  // 目（ネオン）
  const eyeY = y + h * 0.38;
  ctx.fillStyle = "#00f5ff";
  ctx.shadowColor = "#00f5ff";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x + w * 0.32, eyeY, 4.5, 0, Math.PI * 2);
  ctx.arc(x + w * 0.68, eyeY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // 口
  ctx.strokeStyle = angry ? "#ff3344" : "#ffe066";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (angry) {
    ctx.moveTo(x + w * 0.3, y + h * 0.72);
    ctx.lineTo(x + w * 0.5, y + h * 0.62);
    ctx.lineTo(x + w * 0.7, y + h * 0.72);
  } else {
    ctx.arc(cx, y + h * 0.68, w * 0.14, 0.1 * Math.PI, 0.9 * Math.PI);
  }
  ctx.stroke();

  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ff6ec7";
  ctx.shadowBlur = 8;
  ctx.fillText(boss.name, cx, y + h * 0.55);

  ctx.restore();
}

function drawBossBullets() {
  bossBullets.forEach((bullet) => {
    ctx.save();
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 14;
    const grad = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, bullet.radius);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, bullet.color);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
  if (ball && ball.chargeShotTimer > 0) {
    damage = getActiveChargeShotTier(ball).damage;
  }
  block.hp -= damage;
  if (block.hp <= 0) {
    block.alive = false;
    const mult = getComboMultiplier();
    addScore(CONFIG.pointsPerBlock * mult);
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

  // チャージショット: 貫通して破壊（威力に応じて枚数変化、10秒間有効）
  if (ball.chargeShotTimer > 0) {
    if (ball.chargeBreaksLeft <= 0) {
      ball.chargeBreaksLeft = getActiveChargeShotTier(ball).pierce;
      ball.chargeInside = null;
    }
  }

  if (ball.chargeBreaksLeft > 0) {
    if (!ball.chargeInside) ball.chargeInside = new Set();

    let hitBlock = null;
    let minOverlap = Infinity;

    blocks.forEach((block) => {
      if (!block.alive) return;
      const hit = circleRectCollision(ball.x, ball.y, ball.radius, block.x, block.y, block.width, block.height);
      if (!hit) {
        if (ball.chargeInside.has(block)) ball.chargeInside.delete(block);
        return;
      }
      if (ball.chargeInside.has(block)) return;
      const o = getBlockOverlaps(ball, block);
      const overlap = Math.min(o.left, o.right, o.top, o.bottom);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        hitBlock = block;
      }
    });

    if (!hitBlock) return;

    ball.chargeInside.add(hitBlock);
    breakBlock(hitBlock, ball);
    ball.chargeBreaksLeft--;
    if (ball.chargeBreaksLeft <= 0) {
      reflectBallOffBlock(ball, hitBlock);
      separateBallFromBlock(ball, hitBlock);
      if (ball.chargeShotTimer > 0) {
        ball.chargeBreaksLeft = getActiveChargeShotTier(ball).pierce;
        ball.chargeInside = null;
      } else {
        clearChargeBreakState(ball);
      }
    }
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
    let speed = getBallSpeed(ball);
    const baseSpeed = ball.baseSpeed || getStageConfig().ballSpeed;

    const ch = paddle.charge;
    if (ch > 0.08) {
      const mult = 1 + ch * CONFIG.chargeSpeedBoost;
      speed = Math.min(Math.max(speed, baseSpeed) * mult, CONFIG.maxBallSpeed);
      ball.baseSpeed = baseSpeed;
      ball.boostActive = true;
      activateChargeShot(ball, ch);
      Sound.chargeHit();
      spawnParticles(ball.x, ball.y, getChargeShotTier(ch).glow, 14);
      paddle.charge = 0;
    } else {
      Sound.paddleHit();
      if (ball.boostActive) {
        speed = decayBoostSpeed(ball, getBallSpeed(ball));
      } else {
        speed = Math.max(getBallSpeed(ball), baseSpeed);
      }
    }

    applyBallVelocity(ball, speed, angle);
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
    resolveBossBallCollision(ball);
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
}

function updateCharge() {
  if (input.charging) {
    paddle.charge = Math.min(1, paddle.charge + 16 / CONFIG.chargeMaxTime);
  } else if (paddle.charge > 0) {
    paddle.charge = Math.max(0, paddle.charge - 0.006);
  }
  updateChargeButtonUI();
}

function updateChargeButtonUI() {
  const btn = document.getElementById("btn-charge");
  if (!btn) return;
  const label = btn.querySelector(".charge-label");
  const sub = btn.querySelector(".charge-sub");

  btn.classList.toggle("charging", input.charging);
  btn.classList.toggle("ready", paddle.charge >= 0.9);

  if (input.charging || paddle.charge > 0.08) {
    label.textContent = `${Math.round(paddle.charge * 100)}%`;
    sub.textContent = input.charging ? "ため中…" : "メーター保持中";
  } else {
    label.textContent = "CHARGE";
    sub.textContent = "長押しでためる";
  }
}

/* ============================================================
   10. 更新処理
   ============================================================ */

function updatePaddle() {
  const moveSpeed = getPaddleSpeed();

  if (input.touchX !== null) {
    const targetX = input.touchX - paddle.width / 2;
    const diff = targetX - paddle.x;
    if (Math.abs(diff) <= moveSpeed) {
      paddle.x = targetX;
    } else {
      paddle.x += Math.sign(diff) * moveSpeed;
    }
  } else {
    if (input.left)  paddle.x -= moveSpeed;
    if (input.right) paddle.x += moveSpeed;
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

  // 高速移動効果の終了
  if (speedTimer > 0) {
    speedTimer -= 16;
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
    updateChargeShotTimer(ball);
    updateBallBoostDecay(ball);
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
        breakBlock(block, null);
      }
    });

    if (boss && boss.alive && !bossDefeating && boss.laserCooldown <= 0) {
      if (
        laser.x < boss.x + boss.width &&
        laser.x + laser.width > boss.x &&
        laser.y < boss.y + boss.height &&
        laser.y + laser.height > boss.y
      ) {
        damageBoss(1, laser.x + laser.width / 2, laser.y);
        boss.laserCooldown = boss.laserHitCooldown;
      }
    }

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
  if (stageClearing || bossDefeating) return;
  if (isBossStage()) return;
  if (!blocks.every((b) => !b.alive)) return;
  proceedStageClear();
}

function proceedStageClear() {
  if (stageClearing) return;

  if (currentStage >= STAGES.length - 1) {
    Save.onStageClear(currentStage);
    endGame("clear");
    return;
  }

  Save.onStageClear(currentStage);

  stageClearing = true;
  gameState = "paused";
  Sound.stageClear();
  spawnParticles(canvas.width / 2, canvas.height / 2, "#00f5ff", 30);
  UI.stageClear.textContent = "STAGE CLEAR!";
  UI.stageClear.classList.remove("hidden");

  setTimeout(() => {
    currentStage++;
    items = [];
    lasers = [];
    laserActive = false;
    wideTimer = 0;
    speedTimer = 0;
    pierceTimer = 0;
    barrierTimer = 0;
    paddle.width = paddle.baseWidth;
    clearBoss();
    createBlocksForStage();
    if (isBossStage()) createBoss();
    balls = [createBall()];
    resetCombo();
    updateHUD();
    UI.stageClear.classList.add("hidden");
    stageClearing = false;
    gameState = "playing";
    gameLoop();
  }, CONFIG.stageClearDelay);
}

function update() {
  if (barrierTimer > 0) barrierTimer -= 16;
  if (paddleInvincible > 0) paddleInvincible -= 16;

  BGM.tryResumePending();
  updatePaddle();
  updateBalls();
  updateBoss();
  updateBossBullets();
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
  const bgImg = getStageBgImage();

  ctx.fillStyle = "#0d0020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (bgImg) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    drawCoverImage(bgImg);
    ctx.restore();
    ctx.fillStyle = "rgba(13, 0, 32, 0.48)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = stageBg.bgTint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = bgImg ? "rgba(185, 103, 255, 0.04)" : "rgba(185, 103, 255, 0.06)";
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
  const stageLabelY = isBossStage() && boss ? 42 : 17;
  ctx.fillText(`STAGE ${currentStage + 1}  ${stageBg.name}`, canvas.width / 2, stageLabelY);
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
  const chargePower = getPaddleChargePower();
  const chargeTier = chargePower > 0 ? getChargeShotTier(chargePower) : null;
  const isCharged = chargePower > 0;
  const isFast = speedTimer > 0;
  const hasBarrier = barrierTimer > 0;
  const invincibleBlink = !hasBarrier && paddleInvincible > 0 && Math.floor(paddleInvincible / 80) % 2 === 0;
  if (invincibleBlink) ctx.globalAlpha = 0.45;
  ctx.shadowColor = hasBarrier ? "#00f5ff" : chargeTier ? chargeTier.glow : isFast ? "#50ffbb" : laserActive ? "#00f5ff" : "#ff6ec7";
  ctx.shadowBlur = hasBarrier ? 30 : chargeTier ? 20 + chargeTier.damage * 2 : isFast ? 22 : laserActive ? 25 : 15;
  ctx.fillStyle = grad;
  roundRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 7);
  ctx.fill();

  // 高速移動エフェクト（風のライン）
  if (isFast) {
    ctx.strokeStyle = "rgba(80, 255, 187, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddle.x + 4, paddle.y + paddle.height / 2);
    ctx.lineTo(paddle.x - 10, paddle.y + paddle.height / 2);
    ctx.moveTo(paddle.x + paddle.width - 4, paddle.y + paddle.height / 2);
    ctx.lineTo(paddle.x + paddle.width + 10, paddle.y + paddle.height / 2);
    ctx.stroke();
  }

  // チャージゲージ
  if (paddle.charge > 0.02) {
    const barY = paddle.y - 6;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    roundRect(ctx, paddle.x, barY, paddle.width, 4, 2);
    ctx.fill();
    const barColor = chargeTier ? chargeTier.glow : `rgba(255, ${Math.floor(110 + paddle.charge * 140)}, 100, 1)`;
    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = chargeTier ? 12 : 8;
    roundRect(ctx, paddle.x, barY, paddle.width * paddle.charge, 4, 2);
    ctx.fill();
  }

  if (laserActive) {
    ctx.fillStyle = "#00f5ff";
    ctx.shadowBlur = 10;
    ctx.fillRect(paddle.x + paddle.width / 2 - 2, paddle.y - 4, 4, 4);
  }

  if (hasBarrier) {
    const pulse = 0.55 + 0.35 * Math.sin(performance.now() / 120);
    const cx = paddle.x + paddle.width / 2;
    const cy = paddle.y + paddle.height / 2;
    ctx.strokeStyle = `rgba(0, 245, 255, ${pulse})`;
    ctx.fillStyle = `rgba(0, 245, 255, ${0.08 + pulse * 0.08})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, paddle.width / 2 + 10, paddle.height / 2 + 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBalls() {
  balls.forEach((ball) => {
    const isChargeShot = ball.chargeShotTimer > 0;
    const chargeTier = getBallChargeTier(ball);
    const isPierce = pierceTimer > 0 && !isChargeShot;

    ctx.save();
    if (chargeTier) {
      drawChargeTierBall(ball, chargeTier, isChargeShot);
      ctx.restore();
      return;
    }

    ctx.shadowColor = isPierce ? "#ff3344" : "#00f5ff";
    ctx.shadowBlur = isPierce ? 22 : 18;
    const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.radius);
    if (isPierce) {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, "#ff6b6b");
      grad.addColorStop(1, "#ff1a1a");
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
  drawBoss();
  drawBossBullets();
  drawBossHpBar();
  drawItems();
  drawLasers();
  drawPaddle();
  drawBalls();
  drawParticles();
  drawLives();

  if (bossDefeating) {
    const t = 1 - bossDefeatTimer / CONFIG.bossDefeatDelay;
    ctx.save();
    ctx.fillStyle = `rgba(0, 245, 255, ${t * 0.12})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
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
  BGM.playRandom();
  if (animationId) cancelAnimationFrame(animationId);
  initGame(startStage);
  showScreen("game");
  gameState = "playing";
  gameLoop();
}

function goToTitle() {
  BGM.stop();
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  Save.recordHighScore(score);
  Save.save(false);
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
  const selectedStageEl = document.getElementById("title-selected-stage");
  const highScoreEl = document.getElementById("title-high-score");

  if (!grid) return;

  grid.innerHTML = "";
  totalText.textContent = STAGES.length;
  unlockedText.textContent = Save.data.unlockedStage + 1;
  if (selectedStageEl) selectedStageEl.textContent = selectedStartStage + 1;
  if (highScoreEl) highScoreEl.textContent = Save.data.highScore || 0;

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

  if (continueBtn) continueBtn.disabled = Save.data.unlockedStage === 0;
  Save.updateStatusUI();
}

function toggleStagePanel(show) {
  const panel = document.getElementById("stage-panel");
  if (!panel) return;
  if (show === undefined) panel.classList.toggle("hidden");
  else panel.classList.toggle("hidden", !show);
}

function manualSave() {
  Save.recordHighScore(score);
  Save.save(true);
  if (gameState === "title") updateTitleScreen();
}

function endGame(result) {
  gameState = result;
  BGM.stop();
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (result === "gameover") {
    Sound.gameOver();
    Save.recordHighScore(score);
    Save.save(false);
    UI.finalScoreOver.textContent = score;
    UI.finalStageOver.textContent = currentStage + 1;
    updateGameOverPromo();
    showScreen("gameover");
  } else if (result === "clear") {
    Sound.allClear();
    Save.recordHighScore(score);
    Save.save(false);
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

// 左右ボタン
function setupControlButton(btn, direction) {
  const press = (e) => {
    e.preventDefault();
    input[direction] = true;
    input.touchX = null;
    btn.classList.add("pressed");
  };
  const release = (e) => {
    e.preventDefault();
    input[direction] = false;
    btn.classList.remove("pressed");
  };

  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release);
  btn.addEventListener("touchcancel", release);
}

// チャージボタン
function setupChargeButton(btn) {
  const press = (e) => {
    e.preventDefault();
    btn.classList.add("pressed");
    startCharging();
  };
  const release = (e) => {
    e.preventDefault();
    btn.classList.remove("pressed");
    releaseCharge();
  };

  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release);
  btn.addEventListener("touchcancel", release);
}

setupControlButton(document.getElementById("btn-left"), "left");
setupControlButton(document.getElementById("btn-right"), "right");
setupChargeButton(document.getElementById("btn-charge"));

// キャンバス：タッチ / スワイプでパドル移動
function canvasToGameX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  return (clientX - rect.left) * scaleX;
}

canvas.addEventListener("touchstart", (e) => {
  if (gameState !== "playing") return;
  e.preventDefault();
  input.touchX = canvasToGameX(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  if (gameState !== "playing") return;
  e.preventDefault();
  input.touchX = canvasToGameX(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchend", () => {
  input.touchX = null;
});

canvas.addEventListener("touchcancel", () => {
  input.touchX = null;
});

// マウス：ドラッグでパドル移動
let mouseDown = false;

canvas.addEventListener("mousedown", (e) => {
  if (gameState !== "playing") return;
  mouseDown = true;
});

canvas.addEventListener("mousemove", (e) => {
  if (gameState !== "playing" || !mouseDown) return;
  input.touchX = canvasToGameX(e.clientX);
});

canvas.addEventListener("mouseup", () => {
  mouseDown = false;
  input.touchX = null;
});

canvas.addEventListener("mouseleave", () => {
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
document.getElementById("stage-toggle-btn")?.addEventListener("click", () => toggleStagePanel());
document.getElementById("stage-panel-close")?.addEventListener("click", () => toggleStagePanel(false));
document.getElementById("retry-btn-over").addEventListener("click", () => startGame(currentStage));
document.getElementById("retry-btn-clear").addEventListener("click", () => startGame(0));
document.getElementById("title-btn-over").addEventListener("click", goToTitle);
document.getElementById("title-btn-clear").addEventListener("click", goToTitle);

document.getElementById("save-btn").addEventListener("click", manualSave);
document.getElementById("save-btn-over").addEventListener("click", manualSave);
document.getElementById("save-btn-clear").addEventListener("click", manualSave);

document.getElementById("sound-btn-title")?.addEventListener("click", () => BGM.toggle());
document.getElementById("sound-btn-title-se")?.addEventListener("click", () => Sound.toggle());
document.getElementById("title-btn-game")?.addEventListener("click", goToTitle);
document.getElementById("sound-btn-game")?.addEventListener("click", () => Sound.toggle());

/* ============================================================
   15. 起動
   ============================================================ */

setupPromo();
preloadStageBgImages();
updateSoundButtons();
Save.load();
updateTitleScreen();

// ページを閉じる前に自動セーブ
window.addEventListener("pagehide", () => {
  Save.recordHighScore(score);
  Save.save(false);
});
