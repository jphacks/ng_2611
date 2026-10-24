import { getSupabaseClient, isAuthConfigured } from './supabase-client.js';

const GUEST_SESSION_KEY = 'shortcut-dungeon:guest-session:v1';

function getGuestUser() {
  try {
    return localStorage.getItem(GUEST_SESSION_KEY) === '1'
      ? { type: 'guest', id: 'guest' }
      : null;
  } catch {
    return null;
  }
}

function toAppUser(user) {
  if (!user) return null;

  return {
    type: 'user',
    id: user.id,
    email: user.email ?? '',
    displayName:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email ??
      'SIGNED IN',
  };
}

export { isAuthConfigured };

export async function getCurrentUser() {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const user = toAppUser(data.session?.user);
    if (user) return user;
  }

  return getGuestUser();
}

export async function signInAsGuest() {
  try {
    localStorage.setItem(GUEST_SESSION_KEY, '1');
  } catch (cause) {
    throw new Error('ゲストセッションを保存できませんでした。', { cause });
  }

  return { type: 'guest', id: 'guest' };
}

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase の環境変数が設定されていません。');
  }

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });

  if (error) throw error;
}

export async function signOut() {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  try {
    localStorage.removeItem(GUEST_SESSION_KEY);
  } catch (cause) {
    throw new Error('ゲストセッションを削除できませんでした。', { cause });
  }
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(toAppUser(session?.user) ?? getGuestUser());
  });

  return () => data.subscription.unsubscribe();
}
