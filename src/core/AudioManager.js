/**
 * BGM と効果音（SE）の再生をまとめて扱います。
 *
 * - 音源は `assets/sounds/bgm/` と `assets/sounds/se/` に置く（ファイル名 = 音のキー）
 * - 実際の URL 解決は Vite の `import.meta.glob` に任せる（ビルド時にハッシュ付きで配信される）
 * - BGM はゲームプレイ中だけ `startBgm()` / `stopBgm()` で制御する
 * - 効果音は `playSe('ctrlC')` のようにファイル名（拡張子なし・小文字）で呼ぶ
 */

const BGM_MODULES = import.meta.glob('../../assets/sounds/bgm/*.{mp3,ogg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const SE_MODULES = import.meta.glob('../../assets/sounds/se/*.{mp3,ogg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const BGM_KEY = 'dungeon-loop';
const STORAGE_KEY = 'shortcut-dungeon:bgm';
const BGM_VOLUME_STORAGE_KEY = 'shortcut-dungeon:bgm-volume';
const SE_VOLUME_STORAGE_KEY = 'shortcut-dungeon:se-volume';
const SE_VOICES = 3;
const DEFAULT_BGM_VOLUME = 0.3;
const DEFAULT_SE_VOLUME = 0.3;

function readVolume(key, fallback) {
  try {
    const value = Number(globalThis.localStorage?.getItem(key));
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  } catch {
    return fallback;
  }
}

function fileKey(path) {
  return path
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
}

function fileExtension(path) {
  return path.split('.').pop().toLowerCase();
}

/** 同じキーに ogg と mp3 がある場合は mp3（全ブラウザ対応）を優先します。 */
function collectUrls(modules) {
  const urls = new Map();

  for (const [path, url] of Object.entries(modules ?? {})) {
    if (typeof url !== 'string' || !url) continue;

    const key = fileKey(path);
    const extension = fileExtension(path);
    const current = urls.get(key);
    if (!current || (extension === 'mp3' && current.extension !== 'mp3')) {
      urls.set(key, { url, extension });
    }
  }

  return new Map([...urls].map(([key, entry]) => [key, entry.url]));
}

function readBgmPreference() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function storeBgmPreference(enabled) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // localStorage が使えない環境では設定を保存しない
  }
}

class AudioManager {
  constructor() {
    this.bgmUrls = collectUrls(BGM_MODULES);
    this.seUrls = collectUrls(SE_MODULES);
    this.bgmEnabled = readBgmPreference();
    this.bgmVolume = readVolume(BGM_VOLUME_STORAGE_KEY, DEFAULT_BGM_VOLUME);
    this.seVolume = readVolume(SE_VOLUME_STORAGE_KEY, DEFAULT_SE_VOLUME);
    this.bgmRequested = false;
    this.bgm = null;
    this.sePools = new Map();
    this.seCursors = new Map();

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    globalThis.document?.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  get hasBgm() {
    return this.bgmUrls.has(BGM_KEY);
  }

  isBgmEnabled() {
    return this.bgmEnabled;
  }

  /** BGM のオン / オフを切り替えます。設定は localStorage に残ります。 */
  setBgmEnabled(enabled) {
    const next = Boolean(enabled);
    this.bgmEnabled = next;
    storeBgmPreference(next);

    if (!next) {
      this.bgm?.pause();
    } else if (this.bgmRequested) {
      if (this.bgm) this.resumeBgm();
      else this.startBgm();
    }

    return next;
  }

  toggleBgm() {
    return this.setBgmEnabled(!this.bgmEnabled);
  }

  getBgmVolume() { return this.bgmVolume; }

  getSeVolume() { return this.seVolume; }

  setBgmVolume(volume) {
    this.bgmVolume = Math.min(1, Math.max(0, Number(volume) || 0));
    if (this.bgm) this.bgm.volume = this.bgmVolume;
    try { globalThis.localStorage?.setItem(BGM_VOLUME_STORAGE_KEY, String(this.bgmVolume)); } catch {}
    return this.bgmVolume;
  }

  setSeVolume(volume) {
    this.seVolume = Math.min(1, Math.max(0, Number(volume) || 0));
    for (const pool of this.sePools.values()) {
      for (const voice of pool) voice.volume = this.seVolume;
    }
    try { globalThis.localStorage?.setItem(SE_VOLUME_STORAGE_KEY, String(this.seVolume)); } catch {}
    return this.seVolume;
  }

  /** ゲームプレイ開始時に呼びます。BGM がオフなら何もしません。 */
  startBgm() {
    this.bgmRequested = true;
    if (!this.bgmEnabled || !this.hasBgm) return;

    if (!this.bgm) {
      this.bgm = new Audio(this.bgmUrls.get(BGM_KEY));
      this.bgm.loop = true;
      this.bgm.preload = 'auto';
      this.bgm.volume = this.bgmVolume;
    }

    if (!this.bgm.paused) return;
    this.playQuietly(this.bgm, 'bgm');
  }

  resumeBgm() {
    if (!this.bgmEnabled || !this.bgmRequested || !this.bgm) return;
    if (globalThis.document?.hidden) return;
    this.playQuietly(this.bgm, 'bgm');
  }

  /** ゲームプレイ終了時に呼びます。 */
  stopBgm() {
    this.bgmRequested = false;
    if (!this.bgm) return;
    this.bgm.pause();
    try {
      this.bgm.currentTime = 0;
    } catch {
      // メタデータ未読込の間は currentTime を変更できないことがある
    }
  }

  /** 効果音を再生します。読み込み失敗や自動再生の拒否は無視します。 */
  playSe(name, { volume = this.seVolume } = {}) {
    if (!name) return;

    const key = String(name).toLowerCase();
    const url = this.seUrls.get(key);
    if (!url) return;

    const pool = this.getSePool(key, url);
    const cursor = this.seCursors.get(key) ?? 0;
    const voice = pool[cursor % pool.length];
    this.seCursors.set(key, cursor + 1);

    try {
      voice.currentTime = 0;
      voice.volume = volume;
    } catch {
      // 再生位置を戻せない場合はそのまま再生する
    }
    this.playQuietly(voice, `se:${key}`);
  }

  getSePool(key, url) {
    let pool = this.sePools.get(key);
    if (!pool) {
      pool = Array.from({ length: SE_VOICES }, () => {
        const voice = new Audio(url);
        voice.preload = 'auto';
        return voice;
      });
      this.sePools.set(key, pool);
    }
    return pool;
  }

  playQuietly(element, label) {
    try {
      const playback = element.play();
      playback?.catch?.((error) => {
        console.warn(`[audio] ${label} を再生できませんでした`, error);
      });
    } catch (error) {
      console.warn(`[audio] ${label} を再生できませんでした`, error);
    }
  }

  handleVisibilityChange() {
    if (!this.bgmRequested || !this.bgm) return;

    if (globalThis.document?.hidden) {
      this.bgm.pause();
    } else if (this.bgmEnabled) {
      this.resumeBgm();
    }
  }
}

export const audio = new AudioManager();
export default audio;
