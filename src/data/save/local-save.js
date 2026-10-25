import { createEmptyProgress, normalizeProgress } from './progress.js';

const GUEST_SAVE_KEY = 'shortcut-dungeon:guest-save:v1';

export function loadGuestProgress() {
  try {
    const raw = localStorage.getItem(GUEST_SAVE_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : createEmptyProgress();
  } catch {
    return createEmptyProgress();
  }
}

export function saveGuestProgress(progress) {
  const normalized = normalizeProgress({ ...progress, updatedAt: new Date().toISOString() });

  try {
    localStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(normalized));
  } catch (cause) {
    const error = new Error('ゲストの進捗をブラウザーに保存できませんでした。', { cause });
    error.code = 'LOCAL_SAVE_FAILED';
    throw error;
  }

  return normalized;
}

export function clearGuestProgress() {
  try {
    localStorage.removeItem(GUEST_SAVE_KEY);
  } catch {
    // ゲスト保存を削除できない環境でもアプリのログアウト等は継続します。
  }
}
