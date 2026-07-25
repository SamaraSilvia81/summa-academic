import Dexie from 'dexie';

// ── Types ──────────────────────────────────────────────────
// ── Database ───────────────────────────────────────────────
export class SummaDB extends Dexie {
  profiles;
  documents;
  notes;
  references;
  radarItems;
  sources;
  tags;
  tasks;
  settings;
  aiSuggestions;
  folders;

  constructor() {
    super('SummaDB');

    this.version(1).stores({
      profiles: '++id, name, institution',
      documents: '++id, profileId, type, status, *tags, updatedAt',
      notes: '++id, profileId, documentId, type, isPinned, createdAt',
      references: '++id, profileId, type, year, isRead, isFavorite, *tags',
      radarItems: '++id, profileId, type, source, relevanceScore, isRead, isDismissed, fetchedAt',
      sources: '++id, profileId, type, isActive',
      tags: '++id, profileId, category',
      tasks: '++id, profileId, documentId, status, priority, deadline',
      settings: '++id, profileId',
      aiSuggestions: '++id, profileId, documentId, type, isAccepted'
    });

    // v2 — Bancada: pastas para organizar documentos (árvore estilo Atelier)
    this.version(2).stores({
      profiles: '++id, name, institution',
      documents: '++id, profileId, folderId, type, status, *tags, updatedAt',
      notes: '++id, profileId, documentId, type, isPinned, createdAt',
      references: '++id, profileId, type, year, isRead, isFavorite, *tags',
      radarItems: '++id, profileId, type, source, relevanceScore, isRead, isDismissed, fetchedAt',
      sources: '++id, profileId, type, isActive',
      tags: '++id, profileId, category',
      tasks: '++id, profileId, documentId, status, priority, deadline',
      settings: '++id, profileId',
      aiSuggestions: '++id, profileId, documentId, type, isAccepted',
      folders: '++id, profileId, parentId, name, createdAt'
    });

    // v3 — Editor: template LaTeX (ieee/acm/sbc/free), content como JSON
    this.version(3).stores({
      profiles: '++id, name, institution',
      documents: '++id, profileId, folderId, type, status, template, *tags, updatedAt',
      notes: '++id, profileId, documentId, type, isPinned, createdAt',
      references: '++id, profileId, type, year, isRead, isFavorite, *tags',
      radarItems: '++id, profileId, type, source, relevanceScore, isRead, isDismissed, fetchedAt',
      sources: '++id, profileId, type, isActive',
      tags: '++id, profileId, category',
      tasks: '++id, profileId, documentId, status, priority, deadline',
      settings: '++id, profileId',
      aiSuggestions: '++id, profileId, documentId, type, isAccepted',
      folders: '++id, profileId, parentId, name, createdAt'
    }).upgrade(tx => {
      // Migrar docs existentes: adicionar template='free' e converter content HTML → JSON wrapper
      return tx.table('documents').toCollection().modify(doc => {
        if (!doc.template) doc.template = 'free';
        // Se content é string HTML, wrappa num objeto pra manter compatibilidade
        if (typeof doc.content === 'string') {
          doc.contentHtml = doc.content; // backup
          // content agora é JSON do TipTap (será preenchido quando abrir no editor)
        }
      });
    });
  }
}

export const db = new SummaDB();