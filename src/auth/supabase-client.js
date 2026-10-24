import { createClient } from '@supabase/supabase-js';

let client = null;

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !key || !url.startsWith('https://')) return null;
  return { url, key };
}

export function isAuthConfigured() {
  return getConfig() !== null;
}

export function getSupabaseClient() {
  const config = getConfig();
  if (!config) return null;

  if (!client) {
    client = createClient(config.url, config.key);
  }

  return client;
}
