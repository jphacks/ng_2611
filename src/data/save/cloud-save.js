import { getSupabaseClient } from '../../auth/supabase-client.js';
import { createEmptyProgress, normalizeProgress } from './progress.js';

const TABLE = 'saves';

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    const error = new Error('Supabase が設定されていません。');
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }
  return client;
}

export async function loadCloudProgress(user) {
  if (!user?.id || user.type !== 'user') return createEmptyProgress();

  const { data, error } = await requireClient()
    .from(TABLE)
    .select('data')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    const wrapped = new Error('クラウドの進捗を読み込めませんでした。', { cause: error });
    wrapped.code = 'CLOUD_LOAD_FAILED';
    throw wrapped;
  }

  return normalizeProgress(data?.data);
}

export async function saveCloudProgress(user, progress) {
  if (!user?.id || user.type !== 'user') {
    throw new TypeError('ログインユーザーを指定してください。');
  }

  const normalized = normalizeProgress({ ...progress, updatedAt: new Date().toISOString() });
  const { error } = await requireClient()
    .from(TABLE)
    .upsert(
      { user_id: user.id, data: normalized, updated_at: normalized.updatedAt },
      { onConflict: 'user_id' },
    );

  if (error) {
    const wrapped = new Error('クラウドに進捗を保存できませんでした。', { cause: error });
    wrapped.code = 'CLOUD_SAVE_FAILED';
    throw wrapped;
  }

  return normalized;
}
