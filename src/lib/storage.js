/**
 * Supabase Storage helpers — Summa.sh
 * 
 * Buckets necessários (criar no dashboard se não existirem):
 *   - avatars (público)
 *   - covers  (público)
 *   - reference-files (privado — ver supabase-migration-acervo-files.sql)
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

// ── Acervo — arquivos de referência (bucket privado) ────────────

const REFERENCE_FILES_BUCKET = 'reference-files';

function sanitizeFileName(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120); // evita paths gigantes
}

/**
 * Sobe um arquivo (PDF, etc.) pro acervo de um profile.
 * Path: {profileId}/{uuid}-{nomeSanitizado}
 * Retorna metadados pra salvar na linha da reference (file_path, file_name, file_size, file_type, file_uploaded_at).
 */
export async function uploadReferenceFile(profileId, file) {
  const safeName = sanitizeFileName(file.name);
  const path = `${profileId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(REFERENCE_FILES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  return {
    filePath: path,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || null,
    fileUploadedAt: new Date().toISOString(),
  };
}

/** Remove um arquivo do bucket. Não lança erro se já não existir. */
export async function deleteReferenceFile(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(REFERENCE_FILES_BUCKET).remove([path]);
  if (error) console.error('[summa] erro ao remover arquivo:', error.message);
}

/**
 * Gera uma URL assinada temporária pro download/visualização de um arquivo do acervo.
 * Bucket é privado, então não dá pra usar getPublicUrl.
 */
export async function getReferenceFileUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(REFERENCE_FILES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error('[summa] erro ao gerar signed URL:', error.message);
    return null;
  }
  return data.signedUrl;
}