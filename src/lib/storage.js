/**
 * Supabase Storage helpers — Summa.sh
 * 
 * Buckets necessários (criar no dashboard se não existirem):
 *   - avatars (público)
 *   - covers  (público)
 */
import { supabase } from './supabase';

async function ensureAndUpload(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  // Adiciona timestamp pra cache-bust
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/avatar.${ext}`;
  return ensureAndUpload('avatars', path, file);
}

export async function uploadCover(userId, file) {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/cover.${ext}`;
  return ensureAndUpload('covers', path, file);
}
