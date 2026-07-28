/**
 * Repositórios Supabase — módulo Leitura (sub-aba do Acervo)
 *
 * Mesmo padrão de src/services/repositories-supabase.js:
 * conversão snake_case ↔ camelCase na borda, componentes nunca
 * importam `supabase` direto.
 */
import { supabase } from '../lib/supabase';

// ── Helpers (espelham repositories-supabase.js) ────────────────
function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      toCamel(v),
    ])
  );
}

function toSnake(obj) {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
      toSnake(v),
    ])
  );
}

async function query(fn) {
  const { data, error } = await fn;
  if (error) { console.error('[summa/leitura]', error.message); return null; }
  return toCamel(data);
}

async function queryOne(fn) {
  const { data, error } = await fn;
  if (error) { console.error('[summa/leitura]', error.message); return null; }
  return data ? toCamel(data) : null;
}

function guardId(id) {
  if (!id || id === 'undefined') {
    console.warn('[summa/leitura] skipped query — missing ID');
    return false;
  }
  return true;
}

// ── Books ────────────────────────────────────────────────────
export const ReadingBookRepo = {
  getAll: (profileId) =>
    query(
      supabase
        .from('reading_books')
        .select('*, reading_chapters(*), reading_progress(*)')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
    ),

  getById: (id) => {
    if (!guardId(id)) return Promise.resolve(null);
    return queryOne(
      supabase
        .from('reading_books')
        .select('*, reading_chapters(*), reading_progress(*)')
        .eq('id', id)
        .single()
    );
  },

  create: async (data) => {
    const row = await queryOne(
      supabase.from('reading_books').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('reading_books').update(toSnake({ ...data, updatedAt: new Date().toISOString() })).eq('id', id),

  delete: (id) =>
    supabase.from('reading_books').delete().eq('id', id),
};

// ── Chapters ─────────────────────────────────────────────────
export const ReadingChapterRepo = {
  getByBook: (bookId) =>
    query(supabase.from('reading_chapters').select('*').eq('book_id', bookId).order('position')),

  /** Insere todos os capítulos detectados na importação do PDF, de uma vez. */
  bulkCreate: async (bookId, chapters) => {
    const rows = chapters.map((ch, i) => toSnake({ bookId, position: i, ...ch }));
    const { data, error } = await supabase.from('reading_chapters').insert(rows).select();
    if (error) { console.error('[summa/leitura]', error.message); return []; }
    return toCamel(data);
  },

  update: (id, data) =>
    supabase.from('reading_chapters').update(toSnake(data)).eq('id', id),

  toggleDone: async (id) => {
    const ch = await queryOne(supabase.from('reading_chapters').select('done').eq('id', id).single());
    if (!ch) return;
    await supabase.from('reading_chapters').update({ done: !ch.done }).eq('id', id);
  },

  cyclePriority: async (id) => {
    const order = ['high', 'medium', 'low', 'skip'];
    const ch = await queryOne(supabase.from('reading_chapters').select('priority').eq('id', id).single());
    if (!ch) return;
    const next = order[(order.indexOf(ch.priority) + 1) % order.length];
    await supabase.from('reading_chapters').update({ priority: next }).eq('id', id);
    return next;
  },

  delete: (id) =>
    supabase.from('reading_chapters').delete().eq('id', id),
};

// ── Progress (retomar leitura) ──────────────────────────────
export const ReadingProgressRepo = {
  get: (bookId) =>
    queryOne(supabase.from('reading_progress').select('*').eq('book_id', bookId).single()),

  /** Upsert — uma linha por livro. */
  save: async (bookId, { chapterId = null, currentPage }) => {
    await supabase.from('reading_progress').upsert(
      {
        book_id: bookId,
        chapter_id: chapterId,
        current_page: currentPage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'book_id' }
    );
  },
};

// ── Annotations (caneta, marcador, notas) ───────────────────
export const ReadingAnnotationRepo = {
  getByBook: (bookId) =>
    query(supabase.from('reading_annotations').select('*').eq('book_id', bookId)),

  getPage: (bookId, page) =>
    queryOne(
      supabase.from('reading_annotations').select('*').eq('book_id', bookId).eq('page', page).maybeSingle()
    ),

  /** Upsert — uma linha por (book_id, page). */
  savePage: async (bookId, page, { strokes = [], notes = [], highlights = [] }) => {
    await supabase.from('reading_annotations').upsert(
      {
        book_id: bookId,
        page,
        strokes,
        notes,
        highlights,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'book_id,page' }
    );
  },
};
