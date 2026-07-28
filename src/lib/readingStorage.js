/**
 * Supabase Storage helpers — módulo Leitura
 *
 * Bucket necessário (criar no dashboard se não existir):
 *   - reading-files (privado — ver supabase-migration-leitura.sql)
 */
import { supabase } from './supabase';

const READING_FILES_BUCKET = 'reading-files';

function sanitizeFileName(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

/**
 * Sobe o PDF de um livro pro storage.
 * Path: {profileId}/{uuid}-{nomeSanitizado}
 */
export async function uploadReadingFile(profileId, file) {
  const safeName = sanitizeFileName(file.name);
  const path = `${profileId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(READING_FILES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  return {
    filePath: path,
    fileName: file.name,
    fileSize: file.size,
  };
}

export async function deleteReadingFile(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(READING_FILES_BUCKET).remove([path]);
  if (error) console.error('[summa/leitura] erro ao remover arquivo:', error.message);
}

/** Bucket é privado — gera URL assinada temporária pra baixar/reabrir o PDF. */
export async function getReadingFileUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(READING_FILES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error('[summa/leitura] erro ao gerar signed URL:', error.message);
    return null;
  }
  return data.signedUrl;
}
