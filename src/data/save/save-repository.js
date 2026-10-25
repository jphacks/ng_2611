import { createEmptyProgress, mergeProgress, normalizeProgress } from './progress.js';
import { clearGuestProgress, loadGuestProgress, saveGuestProgress } from './local-save.js';
import { loadCloudProgress, saveCloudProgress } from './cloud-save.js';

export { createEmptyProgress, mergeProgress, normalizeProgress };

export async function loadSave(user) {
  if (user?.type === 'user') return loadCloudProgress(user);
  if (user?.type === 'guest') return loadGuestProgress();
  return createEmptyProgress();
}

export async function saveProgress(user, progress) {
  const normalized = normalizeProgress(progress);
  if (user?.type === 'user') return saveCloudProgress(user, normalized);
  if (user?.type === 'guest') return saveGuestProgress(normalized);
  throw new TypeError('進捗の保存にはユーザーまたはゲストが必要です。');
}

export async function claimGuestSave(user) {
  if (user?.type !== 'user') return loadSave(user);

  const guestProgress = loadGuestProgress();
  const cloudProgress = await loadCloudProgress(user);
  const hasGuestProgress = guestProgress.completedStageIds.length > 0
    || guestProgress.currentStageId !== null
    || guestProgress.bossCleared;

  if (!hasGuestProgress) return cloudProgress;

  const merged = mergeProgress(cloudProgress, guestProgress);
  const saved = await saveCloudProgress(user, merged);
  clearGuestProgress();
  return saved;
}
