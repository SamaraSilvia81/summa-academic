/**
 * Supabase Repositories — Summa.sh
 *
 * Drop-in replacement for repositories.js (Dexie).
 * Components import from here, never from supabase.js directly.
 *
 * Naming: Supabase uses snake_case, frontend uses camelCase.
 * Conversion happens at the boundary (here).
 */
import { supabase } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────

/** snake_case → camelCase */
function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      toCamel(v)
    ])
  );
}

/** camelCase → snake_case */
function toSnake(obj) {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
      toSnake(v)
    ])
  );
}

/** Standard query wrapper: converts result to camelCase, returns [] on error */
async function query(fn) {
  const { data, error } = await fn;
  if (error) { console.error('[summa]', error.message); return null; }
  return toCamel(data);
}

/** Single row wrapper */
async function queryOne(fn) {
  const { data, error } = await fn;
  if (error) { console.error('[summa]', error.message); return null; }
  return data ? toCamel(data) : null;
}

/** Guard: skip query if id is falsy */
function guardId(id) {
  if (!id || id === 'undefined') {
    console.warn('[summa] skipped query — missing ID');
    return false;
  }
  return true;
}

// ── Profile ────────────────────────────────────────────────────
export const ProfileRepo = {
  getActive: () =>
    queryOne(supabase.from('profiles').select('*').limit(1).single()),

  getById: (id) => {
    if (!guardId(id)) return Promise.resolve(null);
    return queryOne(supabase.from('profiles').select('*').eq('id', id).single());
  },

  getByUserId: (userId) =>
    queryOne(supabase.from('profiles').select('*').eq('user_id', userId).single()),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('profiles').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    queryOne(supabase.from('profiles').update(toSnake(data)).eq('id', id).select().single()),
};

// ── Settings ───────────────────────────────────────────────────
export const SettingsRepo = {
  get: (profileId) =>
    queryOne(supabase.from('settings').select('*').eq('profile_id', profileId).single()),

  create: async (profileId, data = {}) => {
    const row = await queryOne(
      supabase.from('settings').insert(toSnake({ profileId, ...data })).select().single()
    );
    return row?.id;
  },

  update: async (profileId, data) => {
    await supabase.from('settings').update(toSnake(data)).eq('profile_id', profileId);
  },
};

// ── Tags ───────────────────────────────────────────────────────
export const TagRepo = {
  getAll: (profileId) =>
    query(supabase.from('tags').select('*').eq('profile_id', profileId)),

  getByCategory: (profileId, category) =>
    query(supabase.from('tags').select('*').eq('profile_id', profileId).eq('category', category)),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('tags').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  delete: (id) =>
    supabase.from('tags').delete().eq('id', id),
};

// ── Folders (Bancada) ──────────────────────────────────────────
export const FolderRepo = {
  getAll: (profileId) =>
    query(supabase.from('folders').select('*').eq('profile_id', profileId).order('name')),

  getById: (id) =>
    queryOne(supabase.from('folders').select('*').eq('id', id).single()),

  create: async (profileId, name, parentId = null, extra = {}) => {
    const row = await queryOne(
      supabase.from('folders').insert({
        profile_id: profileId,
        name: name.trim(),
        parent_id: parentId,
        color: extra.color ?? null,
        description: extra.description ?? '',
        image: extra.image ?? null,
        is_project: extra.isProject ?? false,
      }).select().single()
    );
    return row?.id;
  },

  rename: (id, name) =>
    supabase.from('folders').update({ name: name.trim() }).eq('id', id),

  update: (id, data) =>
    supabase.from('folders').update(toSnake(data)).eq('id', id),

  move: (id, parentId) =>
    supabase.from('folders').update({ parent_id: parentId ?? null }).eq('id', id),

  delete: async (id) => {
    // Cascade é handled pelo banco (ON DELETE CASCADE na FK parent_id)
    // Documents com folder_id → null (ON DELETE SET NULL)
    await supabase.from('folders').delete().eq('id', id);
  },
};

// ── Documents (Bancada) ────────────────────────────────────────
export const DocumentRepo = {
  getAll: (profileId) =>
    query(supabase.from('documents').select('*').eq('profile_id', profileId).order('updated_at', { ascending: false })),

  getById: (id) => {
    if (!guardId(id)) return Promise.resolve(null);
    return queryOne(supabase.from('documents').select('*').eq('id', id).single());
  },

  getByStatus: (profileId, status) =>
    query(supabase.from('documents').select('*').eq('profile_id', profileId).eq('status', status)),

  getByFolder: (profileId, folderId) =>
    query(
      folderId
        ? supabase.from('documents').select('*').eq('profile_id', profileId).eq('folder_id', folderId).order('updated_at', { ascending: false })
        : supabase.from('documents').select('*').eq('profile_id', profileId).is('folder_id', null).order('updated_at', { ascending: false })
    ),

  create: async (data) => {
    // Only send columns that exist in the documents table
    const known = [
      'profileId', 'folderId', 'title', 'type', 'template', 'status',
      'content', 'contentHtml', 'tags', 'sourceTemplateId', 'sourceTemplateName',
      'createdAt', 'updatedAt', 'wordCount', 'abstract',
    ];
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => known.includes(k))
    );
    const row = await queryOne(
      supabase.from('documents').insert(toSnake({ folderId: null, ...filtered })).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    queryOne(supabase.from('documents').update(toSnake(data)).eq('id', id).select().single()),

  move: (id, folderId) =>
    supabase.from('documents').update({ folder_id: folderId ?? null }).eq('id', id),

  delete: (id) =>
    supabase.from('documents').delete().eq('id', id),
};

// ── Document Versions ──────────────────────────────────────────
export const VersionRepo = {
  getAll: (documentId) =>
    query(supabase.from('document_versions').select('*').eq('document_id', documentId).order('created_at', { ascending: false })),

  create: async (documentId, content, wordCount, label = null) => {
    const row = await queryOne(
      supabase.from('document_versions').insert({
        document_id: documentId, content, word_count: wordCount, label
      }).select().single()
    );
    return row?.id;
  },

  delete: (id) =>
    supabase.from('document_versions').delete().eq('id', id),
};

// ── Notes ──────────────────────────────────────────────────────
export const NoteRepo = {
  getAll: (profileId) =>
    query(supabase.from('notes').select('*').eq('profile_id', profileId).order('created_at', { ascending: false })),

  getByDocument: (documentId) =>
    query(supabase.from('notes').select('*').eq('document_id', documentId)),

  getByType: (profileId, type) =>
    query(supabase.from('notes').select('*').eq('profile_id', profileId).eq('type', type).order('created_at', { ascending: false })),

  getPinned: (profileId) =>
    query(supabase.from('notes').select('*').eq('profile_id', profileId).eq('is_pinned', true)),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('notes').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('notes').update(toSnake(data)).eq('id', id),

  delete: (id) =>
    supabase.from('notes').delete().eq('id', id),
};

// ── References (Acervo) ────────────────────────────────────────
export const ReferenceRepo = {
  getAll: (profileId) =>
    query(supabase.from('references').select('*').eq('profile_id', profileId).order('created_at', { ascending: false })),

  getByType: (profileId, type) =>
    query(supabase.from('references').select('*').eq('profile_id', profileId).eq('type', type)),

  getFavorites: (profileId) =>
    query(supabase.from('references').select('*').eq('profile_id', profileId).eq('is_favorite', true)),

  search: async (profileId, q) => {
    // Usa a RPC de search com trigram
    const { data, error } = await supabase.rpc('search_references', {
      p_profile_id: profileId, p_query: q
    });
    if (error) { console.error('[summa]', error.message); return []; }
    return toCamel(data);
  },

  create: async (data) => {
    const row = await queryOne(
      supabase.from('references').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('references').update(toSnake(data)).eq('id', id),

  delete: (id) =>
    supabase.from('references').delete().eq('id', id),
};

// ── Reference Folders (Acervo) ─────────────────────────────
export const ReferenceFolderRepo = {
  getAll: (profileId) =>
    query(
      supabase
        .from('reference_folders')
        .select('*, reference_folder_items(reference_id)')
        .eq('profile_id', profileId)
        .order('position')
    ),
  create: async (profileId, { name, color, description, isProject, image, position = 0 }) => {
    const row = await queryOne(
      supabase.from('reference_folders').insert({
        profile_id: profileId,
        name: name.trim(),
        color: color ?? null,
        description: description ?? '',
        is_project: isProject ?? false,
        image: image ?? null,
        position,
      }).select().single()
    );
    return row?.id;
  },
  update: (id, data) =>
    supabase.from('reference_folders').update(toSnake(data)).eq('id', id),
  delete: (id) =>
    supabase.from('reference_folders').delete().eq('id', id),
  addRef: async (folderId, referenceId) => {
    // UNIQUE constraint ignora duplicata silenciosamente
    await supabase.from('reference_folder_items').upsert(
      { folder_id: folderId, reference_id: referenceId },
      { onConflict: 'folder_id,reference_id', ignoreDuplicates: true }
    );
  },
  removeRef: (folderId, referenceId) =>
    supabase.from('reference_folder_items')
      .delete()
      .eq('folder_id', folderId)
      .eq('reference_id', referenceId),
};

// ── Document ↔ Reference (vínculo citação) ─────────────────────
export const DocRefRepo = {
  getByDocument: (documentId) =>
    query(supabase.from('document_references').select('*, references(*)').eq('document_id', documentId).order('position')),

  link: async (documentId, referenceId, citeKey = null) => {
    const row = await queryOne(
      supabase.from('document_references').insert({
        document_id: documentId, reference_id: referenceId, cite_key: citeKey
      }).select().single()
    );
    return row?.id;
  },

  unlink: (documentId, referenceId) =>
    supabase.from('document_references').delete()
      .eq('document_id', documentId).eq('reference_id', referenceId),
};

// ── Annotations (destaques em PDFs) ────────────────────────────
export const AnnotationRepo = {
  getByReference: (referenceId) =>
    query(supabase.from('annotations').select('*').eq('reference_id', referenceId).order('page', { ascending: true })),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('annotations').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  delete: (id) =>
    supabase.from('annotations').delete().eq('id', id),
};

// ── Reading Lists (Acervo) ─────────────────────────────────────
export const ReadingListRepo = {
  getAll: (profileId) =>
    query(supabase.from('reading_lists').select('*, reading_list_items(*, references(*))').eq('profile_id', profileId).order('position')),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('reading_lists').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  addItem: (listId, referenceId, note = null) =>
    supabase.from('reading_list_items').insert({
      reading_list_id: listId, reference_id: referenceId, note
    }),

  removeItem: (listId, referenceId) =>
    supabase.from('reading_list_items').delete()
      .eq('reading_list_id', listId).eq('reference_id', referenceId),

  delete: (id) =>
    supabase.from('reading_lists').delete().eq('id', id),
};

// ── Radar Items (Farol) ────────────────────────────────────────
export const RadarRepo = {
  getAll: (profileId) =>
    query(supabase.from('radar_items').select('*').eq('profile_id', profileId).eq('is_dismissed', false).order('fetched_at', { ascending: false })),

  getByType: (profileId, type) =>
    query(supabase.from('radar_items').select('*').eq('profile_id', profileId).eq('type', type).eq('is_dismissed', false).order('relevance_score', { ascending: false })),

  getUnread: (profileId) =>
    query(supabase.from('radar_items').select('*').eq('profile_id', profileId).eq('is_read', false).eq('is_dismissed', false)),

  getSaved: (profileId) =>
    query(supabase.from('radar_items').select('*').eq('profile_id', profileId).eq('is_saved', true)),

  getHighRelevance: (profileId, minScore = 75) =>
    query(supabase.from('radar_items').select('*').eq('profile_id', profileId).eq('is_dismissed', false).gte('relevance_score', minScore).order('relevance_score', { ascending: false })),

  getCfps: (profileId) =>
    query(supabase.from('radar_items').select('*').eq('profile_id', profileId).eq('type', 'cfp').eq('is_dismissed', false)),

  getStats: async (profileId) => {
    const { data, error } = await supabase.rpc('get_radar_stats', { p_profile_id: profileId });
    if (error) { console.error('[summa]', error.message); return null; }
    return toCamel(data);
  },

  create: async (data) => {
    const row = await queryOne(
      supabase.from('radar_items').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  markRead: (id) =>
    supabase.from('radar_items').update({ is_read: true }).eq('id', id),

  toggleSave: async (id) => {
    const item = await queryOne(supabase.from('radar_items').select('is_saved').eq('id', id).single());
    if (item) await supabase.from('radar_items').update({ is_saved: !item.isSaved }).eq('id', id);
  },

  dismiss: (id) =>
    supabase.from('radar_items').update({ is_dismissed: true }).eq('id', id),

  promoteToRef: async (id, referenceId) =>
    supabase.from('radar_items').update({ promoted_to_ref: referenceId }).eq('id', id),
};

// ── Sources (Farol) ────────────────────────────────────────────
export const SourceRepo = {
  getAll: (profileId) =>
    query(supabase.from('sources').select('*').eq('profile_id', profileId)),

  getActive: (profileId) =>
    query(supabase.from('sources').select('*').eq('profile_id', profileId).eq('is_active', true)),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('sources').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('sources').update(toSnake(data)).eq('id', id),

  toggle: async (id) => {
    const s = await queryOne(supabase.from('sources').select('is_active').eq('id', id).single());
    if (s) await supabase.from('sources').update({ is_active: !s.isActive }).eq('id', id);
  },
};

// ── Informes (Farol — relatórios semanais) ─────────────────────
export const InformeRepo = {
  getAll: (profileId) =>
    query(supabase.from('informes').select('*').eq('profile_id', profileId).order('created_at', { ascending: false })),

  getLatest: (profileId) =>
    queryOne(supabase.from('informes').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(1).single()),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('informes').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  markRead: (id) =>
    supabase.from('informes').update({ is_read: true }).eq('id', id),
};

// ── Tasks (Pauta) ──────────────────────────────────────────────
export const TaskRepo = {
  getAll: (profileId) =>
    query(supabase.from('tasks').select('*').eq('profile_id', profileId).order('position')),

  getByStatus: (profileId, status) =>
    query(supabase.from('tasks').select('*').eq('profile_id', profileId).eq('status', status).order('position')),

  getByDocument: (documentId) =>
    query(supabase.from('tasks').select('*').eq('document_id', documentId)),

  getByMilestone: (milestoneId) =>
    query(supabase.from('tasks').select('*').eq('milestone_id', milestoneId).order('position')),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('tasks').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('tasks').update(toSnake(data)).eq('id', id),

  complete: (id) =>
    supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id),

  delete: (id) =>
    supabase.from('tasks').delete().eq('id', id),
};

// ── Milestones (Pauta) ─────────────────────────────────────────
export const MilestoneRepo = {
  getAll: (profileId) =>
    query(supabase.from('milestones').select('*').eq('profile_id', profileId).order('deadline', { ascending: true, nullsFirst: false })),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('milestones').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('milestones').update(toSnake(data)).eq('id', id),

  complete: (id) =>
    supabase.from('milestones').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id),

  delete: (id) =>
    supabase.from('milestones').delete().eq('id', id),
};

// ── Publications (Vitrine) ─────────────────────────────────────
export const PublicationRepo = {
  getAll: (profileId) =>
    query(supabase.from('publications').select('*').eq('profile_id', profileId).order('position')),

  getPublished: (profileId) =>
    query(supabase.from('publications').select('*').eq('profile_id', profileId).eq('is_published', true).order('year', { ascending: false })),

  getBySlug: (slug) =>
    queryOne(supabase.from('publications').select('*, profiles(name, institution, avatar_url)').eq('slug', slug).eq('is_published', true).single()),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('publications').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('publications').update(toSnake(data)).eq('id', id),

  delete: (id) =>
    supabase.from('publications').delete().eq('id', id),
};

// ── Datasets ───────────────────────────────────────────────────
export const DatasetRepo = {
  getAll: (profileId) =>
    query(supabase.from('datasets').select('*').eq('profile_id', profileId).order('updated_at', { ascending: false })),

  getById: (id) =>
    queryOne(supabase.from('datasets').select('*').eq('id', id).single()),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('datasets').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('datasets').update(toSnake(data)).eq('id', id),

  delete: (id) =>
    supabase.from('datasets').delete().eq('id', id),
};

// ── Dataset Entries ────────────────────────────────────────────
export const DatasetEntryRepo = {
  getAll: (datasetId) =>
    query(supabase.from('dataset_entries').select('*').eq('dataset_id', datasetId).order('created_at', { ascending: false })),

  getByStatus: (datasetId, status) =>
    query(supabase.from('dataset_entries').select('*').eq('dataset_id', datasetId).eq('status', status)),

  getStats: async (datasetId) => {
    const all = await query(supabase.from('dataset_entries').select('status').eq('dataset_id', datasetId));
    if (!all) return null;
    return {
      total: all.length,
      candidates: all.filter(e => e.status === 'candidate').length,
      included: all.filter(e => e.status === 'included').length,
      excluded: all.filter(e => e.status === 'excluded').length,
      flagged: all.filter(e => e.status === 'flagged').length,
    };
  },

  create: async (data) => {
    const row = await queryOne(
      supabase.from('dataset_entries').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  bulkCreate: async (datasetId, entries) => {
    const rows = entries.map(e => toSnake({ datasetId, ...e }));
    const { data, error } = await supabase.from('dataset_entries').insert(rows).select();
    if (error) { console.error('[summa]', error.message); return []; }
    return toCamel(data);
  },

  update: (id, data) =>
    supabase.from('dataset_entries').update(toSnake(data)).eq('id', id),

  delete: (id) =>
    supabase.from('dataset_entries').delete().eq('id', id),
};

// ── Analysis Runs (Dataset) ────────────────────────────────────
export const AnalysisRunRepo = {
  getAll: (datasetId) =>
    query(supabase.from('analysis_runs').select('*').eq('dataset_id', datasetId).order('created_at', { ascending: false })),

  create: async (data) => {
    const row = await queryOne(
      supabase.from('analysis_runs').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  update: (id, data) =>
    supabase.from('analysis_runs').update(toSnake(data)).eq('id', id),
};

// ── AI Suggestions ─────────────────────────────────────────────
export const AiSuggestionRepo = {
  getForDocument: (documentId) => {
    if (!guardId(documentId)) return Promise.resolve(null);
    return query(supabase.from('ai_suggestions').select('*').eq('document_id', documentId).eq('is_dismissed', false));
  },

  create: async (data) => {
    const row = await queryOne(
      supabase.from('ai_suggestions').insert(toSnake(data)).select().single()
    );
    return row?.id;
  },

  accept: (id) =>
    supabase.from('ai_suggestions').update({ is_accepted: true }).eq('id', id),

  dismiss: (id) =>
    supabase.from('ai_suggestions').update({ is_dismissed: true }).eq('id', id),
};

// ── Activity Log ───────────────────────────────────────────────
export const ActivityLogRepo = {
  getRecent: (profileId, limit = 20) =>
    query(supabase.from('activity_log').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(limit)),

  log: (profileId, action, entityType, entityId, entityTitle, details = null) =>
    supabase.from('activity_log').insert({
      profile_id: profileId, action, entity_type: entityType,
      entity_id: entityId, entity_title: entityTitle, details
    }),
};

// ── Dashboard Stats (RPC) ──────────────────────────────────────
export const DashboardRepo = {
  getStats: async (profileId) => {
    const { data, error } = await supabase.rpc('get_dashboard_stats', { p_profile_id: profileId });
    if (error) { console.error('[summa]', error.message); return null; }
    return toCamel(data);
  },
};