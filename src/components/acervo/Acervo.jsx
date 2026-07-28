import { useRef, useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  MagnifyingGlass, Star, Plus, X, Paperclip, DownloadSimple,
  Trash, CloudArrowUp, FilePdf, Spinner, LinkSimple, ArrowSquareOut,
  SquaresFour, Rows, FolderPlus, FolderOpen, PencilSimple,
  ShareNetwork, CaretLeft, Folder,
  FileImage, FileVideo, FileAudio, FileDoc, FileZip, File as FileGeneric,
  DotsThree, BookOpenText, BookmarkSimple,
} from '@phosphor-icons/react';
import { useReferences } from '../../hooks/useData';
import { Leitura } from './Leitura';
import {
  toggleReferenceFavorite,
  createReference,
  updateReference,
  attachReferenceFile,
  removeReferenceFile,
  removeReferenceLink,
  deleteReference,
} from '../../store/slices/dataSlice';
import { getReferenceFileUrl } from '../../lib/storage';
import { ReferenceFolderRepo } from '../../services/repositories';

// ─────────────────────────────────────────────
// InlineInput
// ─────────────────────────────────────────────

function InlineInput({ value, onConfirm, onCancel, placeholder = 'nome...' }) {
  const [draft, setDraft] = useState(value || '');
  return (
    <input
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter' && draft.trim()) onConfirm(draft.trim());
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => draft.trim() ? onConfirm(draft.trim()) : onCancel()}
      style={{
        flex: 1, minWidth: 0, background: 'var(--bg3)',
        border: '1px solid rgba(212,160,48,0.35)', borderRadius: 'var(--r-sm)',
        padding: '3px 8px', color: 'var(--tx)',
        fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
        width: '100%',
      }}
    />
  );
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const FILTERS = ['todos', 'papers', 'meus artigos', 'datasets', 'notas', 'favoritos'];

const TYPE_OPTIONS = [
  { value: 'paper_read', label: 'paper lido' },
  { value: 'my_article', label: 'meu artigo' },
  { value: 'dataset', label: 'dataset' },
  { value: 'book', label: 'livro' },
  { value: 'thesis', label: 'tese' },
];

const FOLDER_COLORS = [
  '#D4A030', '#60A5FA', '#A78BFA', '#F472B6',
  '#34D399', '#F87171', '#FB923C', '#8A8680',
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFileType(mime, fileName) {
  if (mime && mime.includes('/')) return mime.split('/')[1].toUpperCase();
  const ext = fileName?.split('.').pop();
  return ext ? ext.toUpperCase() : 'FILE';
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function fileIcon(mime, fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  if (mime?.includes('pdf') || ext === 'pdf') return <FilePdf size={14} />;
  if (mime?.includes('image') || ['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return <FileImage size={14} />;
  if (mime?.includes('video') || ['mp4','mov','avi','webm'].includes(ext)) return <FileVideo size={14} />;
  if (mime?.includes('audio') || ['mp3','wav','ogg'].includes(ext)) return <FileAudio size={14} />;
  if (['doc','docx','odt','txt','md'].includes(ext)) return <FileDoc size={14} />;
  if (['zip','rar','tar','gz'].includes(ext)) return <FileZip size={14} />;
  return <FileGeneric size={14} />;
}

function truncateName(name, max = 22) {
  if (!name || name.length <= max) return name;
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  return name.slice(0, max - ext.length - 1) + '…' + ext;
}

const labelStyle = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
  display: 'block', marginBottom: 6,
};

const inputStyle = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--brd2)',
  borderRadius: 'var(--r-md)', padding: '9px 12px', color: 'var(--tx)',
  fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

// ─────────────────────────────────────────────
// Hook: pastas do Acervo (Supabase)
// ─────────────────────────────────────────────

function useReferenceFolders(profileId) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const data = await ReferenceFolderRepo.getAll(profileId);
      if (data) {
        // Normaliza: reference_folder_items → refIds[]
        setFolders(data.map(f => ({
          ...f,
          refIds: (f.referenceFolderItems || []).map(i => i.referenceId),
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const createFolder = useCallback(async (name, color, extra = {}) => {
    await ReferenceFolderRepo.create(profileId, { name, color, ...extra });
    await load();
  }, [profileId, load]);

  const updateFolder = useCallback(async (id, patch) => {
    await ReferenceFolderRepo.update(id, patch);
    await load();
  }, [load]);

  const renameFolder = useCallback(async (id, name) => {
    await ReferenceFolderRepo.update(id, { name });
    await load();
  }, [load]);

  const deleteFolder = useCallback(async (id) => {
    await ReferenceFolderRepo.delete(id);
    await load();
  }, [load]);

  const addRefToFolder = useCallback(async (referenceId, folderId) => {
    await ReferenceFolderRepo.addRef(folderId, referenceId);
    await load();
  }, [load]);

  const removeRefFromFolder = useCallback(async (referenceId, folderId) => {
    await ReferenceFolderRepo.removeRef(folderId, referenceId);
    await load();
  }, [load]);

  return {
    folders, loading,
    createFolder, updateFolder, renameFolder, deleteFolder,
    addRefToFolder, removeRefFromFolder,
    reload: load,
  };
}

// ─────────────────────────────────────────────
// Main Acervo
// ─────────────────────────────────────────────

export function Acervo({ profileId }) {
  const dispatch = useDispatch();
  const references = useReferences(profileId);
  const {
    folders, createFolder, updateFolder, renameFolder,
    deleteFolder, addRefToFolder,
  } = useReferenceFolders(profileId);

  const [activeTab, setActiveTab] = useState('referencias'); // 'referencias' | 'leitura'
  const [readingRef, setReadingRef] = useState(null); // referência aberta pra leitura direta
  const [activeFilter, setActiveFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState('grid');
  const [currentFolder, setCurrentFolder] = useState(null); // folder id ou null
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [editFolderOpen, setEditFolderOpen] = useState(null); // folder id
  const [editRefOpen, setEditRefOpen] = useState(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null); // folder object
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [toast, setToast] = useState('');

  // ── Derived ────────────────────────────────
  const currentFolderObj = folders.find(f => f.id === currentFolder) || null;

  // IDs de referências que estão em ALGUMA pasta
  const refsInAnyFolder = new Set(folders.flatMap(f => f.refIds || []));

  // IDs de referências que estão na pasta atual
  const folderRefIds = currentFolderObj ? new Set(currentFolderObj.refIds || []) : null;

  const filtered = (references || []).filter((ref) => {
    if (folderRefIds !== null) {
      // Dentro de uma pasta: só o que está nela
      return folderRefIds.has(ref.id);
    } else {
      // Raiz (Drive-style): só o que NÃO está em nenhuma pasta
      return !refsInAnyFolder.has(ref.id);
    }
  }).filter((ref) => {
    if (activeFilter === 'papers') return ref.type === 'paper_read';
    if (activeFilter === 'meus artigos') return ref.type === 'my_article';
    if (activeFilter === 'datasets') return ref.type === 'dataset';
    if (activeFilter === 'notas') return ref.type === 'note';
    if (activeFilter === 'favoritos') return ref.isFavorite;
    return true;
  }).filter((ref) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ref.title.toLowerCase().includes(q) ||
      ref.authors?.toLowerCase().includes(q) ||
      (ref.tags || []).some((t) => t.toLowerCase().includes(q));
  });

  // Na raiz, as pastas já são renderizadas acima independente de filtro/busca —
  // então "nenhum item encontrado" só faz sentido se não há pastas E não há
  // referências soltas. Dentro de uma pasta, o vazio é sempre real.
  const isEmpty = filtered.length === 0 && !(!currentFolder && folders.length > 0);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  function shareFolder(folder) {
    const url = `${window.location.origin}${window.location.pathname}?folder=${folder.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    showToast('link copiado');
  }

  function shareRef(ref) {
    const url = `${window.location.origin}${window.location.pathname}?ref=${ref.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    showToast('link da referência copiado');
  }

  async function handleConfirmDeleteFolder() {
    if (!confirmDeleteFolder) return;
    setDeletingFolder(true);
    try {
      const refIds = confirmDeleteFolder.refIds || [];
      const refsToDelete = (references || []).filter((r) => refIds.includes(r.id));
      // Apaga de fato as referências que estavam dentro da pasta
      for (const ref of refsToDelete) {
        await dispatch(deleteReference({ profileId, reference: ref })).unwrap().catch(() => {});
      }
      await deleteFolder(confirmDeleteFolder.id);
      if (currentFolder === confirmDeleteFolder.id) setCurrentFolder(null);
      showToast('pasta e conteúdo apagados');
    } finally {
      setDeletingFolder(false);
      setConfirmDeleteFolder(null);
    }
  }

  // ─────────────────────────────────────────────
  return (
    <div className="animate-fade-in">

      {/* ── Sub-abas ── */}
      <div style={{ display: 'flex', gap: 4, margin: '15px 0 0' }}>
        {[
          ['referencias', 'Referências', BookmarkSimple],
          ['leitura', 'Leitura', BookOpenText],
        ].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
            padding: '7px 12px', cursor: 'pointer', background: 'none',
            border: 'none', borderBottom: `2px solid ${activeTab === key ? 'var(--acc)' : 'transparent'}`,
            color: activeTab === key ? 'var(--tx)' : 'var(--tx3)',
          }}>
            <Icon size={14} weight={activeTab === key ? 'fill' : 'regular'} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'leitura' && (
        <Leitura
          profileId={profileId}
          directRef={readingRef}
          acervoRefs={references}
          onClearDirectRef={() => setReadingRef(null)}
          onReadRef={(ref) => { setReadingRef(ref); setActiveTab('leitura'); }}
        />
      )}

      {activeTab === 'referencias' && (<>

      {/* ── Breadcrumb ── */}
      {currentFolderObj && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0 10px',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)',
        }}>
          <button onClick={() => setCurrentFolder(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          }}>
            <CaretLeft size={12} /> acervo
          </button>
          <span>/</span>
          <span style={{ color: currentFolderObj.color || 'var(--acc)', fontWeight: 600 }}>
            {currentFolderObj.name}
          </span>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', gap: 8, margin: '15px 0 15px', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1,
          background: 'var(--bg2)', border: '1px solid var(--brd)',
          borderRadius: 'var(--r-md)', padding: '7px 12px'
        }}>
          <MagnifyingGlass size={14} color="var(--tx3)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="buscar no acervo..."
            style={{
              border: 'none', background: 'none', outline: 'none', flex: 1,
              fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)'
            }} />
        </div>

        {/* View toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg2)', border: '1px solid var(--brd)',
          borderRadius: 'var(--r-md)', overflow: 'hidden',
        }}>
          {[['grid', <SquaresFour size={15} />], ['list', <Rows size={15} />]].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 10px', border: 'none', cursor: 'pointer',
              background: view === v ? 'var(--bg4)' : 'transparent',
              color: view === v ? 'var(--tx)' : 'var(--tx3)',
              display: 'flex', alignItems: 'center', transition: 'all 0.13s',
            }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Nova pasta — só na raiz */}
        {!currentFolder && (
          <button onClick={() => setNewFolderOpen(true)} title="nova pasta" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg2)', border: '1px solid var(--brd)',
            borderRadius: 'var(--r-md)', padding: '7px 10px', cursor: 'pointer',
            color: 'var(--tx3)',
          }}>
            <FolderPlus size={16} />
          </button>
        )}

        <button onClick={() => setAddOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--acc)', color: 'var(--bg0)', border: '1px solid var(--acc)',
          borderRadius: 'var(--r-md)', padding: '0 14px', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, height: 36,
        }}>
          <Plus size={16} weight="bold" /> Adicionar
        </button>
      </div>

      {/* ── Filter chips ── */}
      <div style={{ display: 'flex', gap: 4, margin: '0 0 12px', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)} style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
            padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
            border: `1px solid ${activeFilter === f ? 'var(--acc)' : 'var(--brd)'}`,
            background: activeFilter === f ? 'var(--acc)' : 'transparent',
            color: activeFilter === f ? 'var(--bg0)' : 'var(--tx2)',
            transition: 'all 0.18s'
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* ── Pastas (só na raiz) ── */}
      {!currentFolder && folders.length > 0 && (
        <div style={{
          display: view === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: view === 'grid' ? 'repeat(3, 1fr)' : undefined,
          flexDirection: view === 'list' ? 'column' : undefined,
          gap: 8, marginBottom: 16,
        }}>
          {folders.map(folder => (
            <FolderCard
              key={folder.id}
              folder={folder}
              allRefs={references || []}
              view={view}
              onOpen={() => setCurrentFolder(folder.id)}
              onEdit={() => setEditFolderOpen(folder.id)}
              onDelete={() => setConfirmDeleteFolder(folder)}
              onShare={() => shareFolder(folder)}
              onRename={(id, name) => renameFolder(id, name)}
              onDropRef={addRefToFolder}
            />
          ))}
        </div>
      )}

      {/* ── Referências ── */}
      {filtered.length > 0 ? (
        <div style={{
          display: view === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: view === 'grid' ? 'repeat(3, 1fr)' : undefined,
          flexDirection: view === 'list' ? 'column' : undefined,
          gap: 8,
        }}>
          {filtered.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              profileId={profileId}
              view={view}
              folders={folders}
              onShare={() => shareRef(ref)}
              onAddToFolder={addRefToFolder}
              onEdit={() => setEditRefOpen(ref)}
              onRead={() => { setReadingRef(ref); setActiveTab('leitura'); }}
            />
          ))}
        </div>
      ) : isEmpty ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: 'var(--tx3)', fontFamily: 'var(--font-mono)', fontSize: 15
        }}>
          {currentFolder
            ? 'pasta vazia — arraste referências aqui'
            : 'nenhum item encontrado'}
        </div>
      ) : null}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg3)', border: '1px solid var(--brd2)', color: 'var(--tx2)',
          fontFamily: 'var(--font-mono)', fontSize: 12, padding: '9px 16px',
          borderRadius: 'var(--r-md)', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          maxWidth: 420, textAlign: 'center', pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      {/* ── Modals ── */}
      {addOpen && (
        <AddReferenceModal
          profileId={profileId}
          targetFolder={currentFolderObj}
          onAddToFolder={addRefToFolder}
          onClose={() => setAddOpen(false)}
        />
      )}

      {editRefOpen && (
        <EditReferenceModal
          profileId={profileId}
          reference={editRefOpen}
          onClose={() => setEditRefOpen(null)}
        />
      )}

      {newFolderOpen && (
        <FolderModal
          onClose={() => setNewFolderOpen(false)}
          onSave={(name, color, extra) => { createFolder(name, color, extra); setNewFolderOpen(false); }}
        />
      )}

      {editFolderOpen && (
        <FolderModal
          folder={folders.find(f => f.id === editFolderOpen)}
          onClose={() => setEditFolderOpen(null)}
          onSave={(name, color, extra) => {
            updateFolder(editFolderOpen, { name, color, ...extra });
            setEditFolderOpen(null);
          }}
          onDelete={() => {
            setConfirmDeleteFolder(folders.find((f) => f.id === editFolderOpen) || null);
            setEditFolderOpen(null);
          }}
        />
      )}

      {confirmDeleteFolder && (
        <DeleteFolderModal
          folder={confirmDeleteFolder}
          count={(confirmDeleteFolder.refIds || []).length}
          deleting={deletingFolder}
          onCancel={() => setConfirmDeleteFolder(null)}
          onConfirm={handleConfirmDeleteFolder}
        />
      )}

      </>)}
    </div>
  );
}

// ─────────────────────────────────────────────
// DeleteFolderModal
// ─────────────────────────────────────────────

function DeleteFolderModal({ folder, count, deleting, onCancel, onConfirm }) {
  return (
    <div onClick={deleting ? undefined : onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
      backdropFilter: 'blur(2px)', zIndex: 110,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg1)', border: '1px solid rgba(248,113,113,0.3)',
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 400,
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 20px', borderBottom: '1px solid var(--brd)',
        }}>
          <Trash size={14} color="#F87171" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>excluir pasta</span>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', lineHeight: 1.6 }}>
            Apagar <strong>{folder.name}/</strong> também apaga{' '}
            {count > 0
              ? <>as <strong>{count} referência{count !== 1 ? 's' : ''}</strong> que estão dentro dela.</>
              : <>o conteúdo da pasta (que no momento está vazia).</>}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(248,113,113,0.75)', marginTop: 10 }}>
            Essa ação não pode ser desfeita.
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px', borderTop: '1px solid var(--brd)',
        }}>
          <button onClick={onCancel} disabled={deleting} style={{
            background: 'none', border: '1px solid var(--brd2)', borderRadius: 8,
            padding: '8px 14px', cursor: deleting ? 'not-allowed' : 'pointer', color: 'var(--tx2)',
            fontFamily: 'var(--font-body)', fontSize: 14,
          }}>cancelar</button>
          <button onClick={onConfirm} disabled={deleting} style={{
            background: '#F87171', color: '#1A0E0E',
            border: '1px solid #F87171', borderRadius: 8,
            padding: '8px 14px', cursor: deleting ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6, opacity: deleting ? 0.75 : 1,
          }}>
            {deleting && <Spinner size={14} className="animate-spin" />}
            {deleting ? 'apagando...' : `apagar pasta${count > 0 ? ' e conteúdo' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FolderCard
// ─────────────────────────────────────────────

function FolderCard({ folder, allRefs, view, onOpen, onEdit, onDelete, onShare, onRename, onDropRef }) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const count = (allRefs || []).filter(r => (folder.refIds || []).includes(r.id)).length;
  const fc = folder.color || 'var(--acc)';

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const refId = e.dataTransfer.getData('text/plain');
    if (refId) onDropRef?.(refId, folder.id);
  }

  if (view === 'list') return (
    <div
      onClick={() => !editing && onOpen()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
        background: dragOver ? 'var(--acc-bg2)' : hover ? 'var(--bg2)' : 'var(--bg1)',
        border: `1px solid ${dragOver ? 'var(--acc)' : 'var(--brd)'}`, borderLeft: `3px solid ${fc}66`,
        borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'background 0.12s',
      }}
    >
      <FolderOpen size={14} color={fc} weight="duotone" style={{ flexShrink: 0 }} />
      {editing ? (
        <InlineInput
          value={folder.name}
          onConfirm={name => { onRename?.(folder.id, name); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {folder.name}/
          {folder.isProject && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--acc)', border: '1px solid rgba(212,160,48,0.35)', borderRadius: 3, padding: '1px 5px' }}>projeto</span>
          )}
        </span>
      )}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', flexShrink: 0 }}>
        {count} item{count !== 1 ? 's' : ''}
      </span>
      {hover && !editing && (
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <FolderBtn title="compartilhar" icon={<ShareNetwork size={11} />} onClick={onShare} />
          <FolderBtn title="renomear" icon={<PencilSimple size={11} />} onClick={() => setEditing(true)} />
          <FolderBtn title="editar pasta" icon={<DotsThree size={11} />} onClick={onEdit} />
          <FolderBtn title="excluir" icon={<Trash size={11} />} onClick={onDelete} danger />
        </div>
      )}
    </div>
  );

  return (
    <div
      onClick={() => !editing && onOpen()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        background: 'var(--bg1)',
        border: `1px solid ${dragOver ? 'var(--acc)' : hover ? fc + '55' : 'var(--brd)'}`,
        borderRadius: 'var(--r-lg)', cursor: 'pointer', overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s', minHeight: 90,
        boxShadow: dragOver ? `0 0 0 2px ${fc}44` : hover ? `0 2px 16px ${fc}22` : 'none',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {folder.image
        ? <div style={{ height: 56, background: `center/cover no-repeat url(${folder.image})`, flexShrink: 0 }} />
        : <div style={{ height: 3, background: `linear-gradient(90deg,${fc},${fc}22)` }} />
      }
      <div style={{ padding: '12px 14px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: fc, flexShrink: 0 }} />
              {editing ? (
                <InlineInput
                  value={folder.name}
                  onConfirm={name => { onRename?.(folder.id, name); setEditing(false); }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {folder.name}/
                </span>
              )}
              {folder.isProject && !editing && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--acc)', border: '1px solid rgba(212,160,48,0.35)', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>projeto</span>
              )}
            </div>
            {folder.description && !editing && (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
              }}>
                {folder.description}
              </div>
            )}
          </div>
          {hover && !editing && (
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <FolderBtn title="compartilhar" icon={<ShareNetwork size={11} />} onClick={onShare} />
              <FolderBtn title="renomear" icon={<PencilSimple size={11} />} onClick={() => setEditing(true)} />
              <FolderBtn title="editar pasta" icon={<DotsThree size={11} />} onClick={onEdit} />
              <FolderBtn title="excluir" icon={<Trash size={11} />} onClick={onDelete} danger />
            </div>
          )}
        </div>
        <span style={{
          marginTop: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--tx3)', paddingTop: 8,
        }}>
          {count} item{count !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

function FolderBtn({ title, icon, onClick, danger = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '3px 5px', borderRadius: 'var(--r-sm)',
        background: hov ? (danger ? 'rgba(248,113,113,0.08)' : 'var(--bg4)') : 'var(--bg3)',
        border: `1px solid ${hov && danger ? 'rgba(248,113,113,0.25)' : 'var(--brd)'}`,
        color: hov ? (danger ? '#F87171' : 'var(--tx)') : (danger ? 'rgba(248,113,113,0.5)' : 'var(--tx3)'),
        cursor: 'pointer', display: 'flex', alignItems: 'center',
      }}
    >
      {icon}
    </button>
  );
}

// ─────────────────────────────────────────────
// FolderPicker dropdown
// ─────────────────────────────────────────────

function FolderPicker({ folders, onPick }) {
  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, zIndex: 50,
      background: 'var(--bg2)', border: '1px solid var(--brd2)',
      borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      minWidth: 160, padding: '4px 0', marginTop: 4,
    }}>
      {folders.map(f => (
        <button key={f.id} onClick={e => { e.stopPropagation(); onPick(f.id); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)',
          textAlign: 'left',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color || 'var(--acc)', flexShrink: 0 }} />
          {f.name}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// ReferenceCard  (igual ao original — sem mudanças de visual)
// ─────────────────────────────────────────────

function ReferenceCard({ reference, profileId, view, folders, onShare, onAddToFolder, onEdit, onRead }) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);

  const typeLabels = {
    paper_read: 'paper', my_article: 'meu art.',
    dataset: 'dataset', book: 'livro', thesis: 'tese', note: 'nota',
  };

  const toggleFavorite = async () => {
    if (reference.id) await dispatch(toggleReferenceFavorite({ profileId, reference })).unwrap();
  };

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    try { await dispatch(attachReferenceFile({ profileId, reference, file })).unwrap(); }
    finally { setBusy(false); }
  }

  async function handleDownload() {
    if (!reference.filePath) return;
    const url = await getReferenceFileUrl(reference.filePath);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleRemoveFile(e) {
    e.stopPropagation();
    setBusy(true);
    try { await dispatch(removeReferenceFile({ profileId, reference })).unwrap(); }
    finally { setBusy(false); }
  }

  async function handleDelete(e) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try { await dispatch(deleteReference({ profileId, reference })).unwrap(); }
    finally { setBusy(false); setConfirmDelete(false); }
  }

  const FileMeta = () => {
    if (!reference.filePath && !reference.url) return null;
    const pillStyle = {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--bg3)', border: '1px solid var(--brd)',
      borderRadius: 3, padding: '2px 6px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
      maxWidth: '100%', overflow: 'hidden', cursor: 'pointer', textDecoration: 'none',
    };
    if (reference.filePath) return (
      <button onClick={e => { e.stopPropagation(); handleDownload(); }} title={reference.fileName} style={pillStyle}>
        {fileIcon(reference.fileType, reference.fileName)}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {formatFileType(reference.fileType, reference.fileName)} · {formatFileSize(reference.fileSize)}
        </span>
      </button>
    );
    return (
      <a href={reference.url} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()} style={pillStyle}>
        <LinkSimple size={11} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hostnameOf(reference.url)}
        </span>
        <ArrowSquareOut size={10} style={{ flexShrink: 0 }} />
      </a>
    );
  };

  // ── LIST ────────────────────────────────────
  if (view === 'list') return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', reference.id); e.dataTransfer.effectAllowed = 'move'; }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirmDelete(false); setFolderMenuOpen(false); }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
        background: dragOver ? 'var(--acc-bg2)' : 'var(--bg1)',
        border: `1px solid ${dragOver ? 'var(--acc)' : 'var(--brd)'}`,
        borderRadius: 'var(--r-md)', transition: 'all 0.15s', position: 'relative',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: '0.06em',
        flexShrink: 0, width: 58,
      }}>
        {typeLabels[reference.type] || reference.type}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
          color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {reference.title}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {reference.authors} {reference.year ? `· ${reference.year}` : ''}
        </div>
      </div>
      <FileMeta />
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {reference.filePath && reference.fileName?.toLowerCase().endsWith('.pdf') && (
          <button onClick={e => { e.stopPropagation(); onRead?.(); }} title="ler PDF" style={{
            ...cardBtnStyle, background: 'rgba(212,160,48,0.1)', borderColor: 'rgba(212,160,48,0.3)', color: 'var(--acc)',
          }}>
            <BookOpenText size={13} weight="fill" />
          </button>
        )}
        <button onClick={toggleFavorite} title={reference.isFavorite ? 'desfavoritar' : 'favoritar'} style={cardBtnStyle}>
          <Star size={13} weight={reference.isFavorite ? 'fill' : 'regular'} color={reference.isFavorite ? 'var(--acc)' : 'var(--tx3)'} />
        </button>
        <button onClick={e => { e.stopPropagation(); onEdit?.(); }} title="editar metadados" style={cardBtnStyle}>
          <PencilSimple size={13} />
        </button>
        {reference.filePath && (
          <button onClick={e => { e.stopPropagation(); handleDownload(); }} title="baixar" style={cardBtnStyle}>
            <DownloadSimple size={13} />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onShare(); }} title="compartilhar link" style={cardBtnStyle}>
          <ShareNetwork size={13} />
        </button>
        {folders.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button onClick={e => { e.stopPropagation(); setFolderMenuOpen(v => !v); }} title="adicionar à pasta" style={cardBtnStyle}>
              <Folder size={13} />
            </button>
            {folderMenuOpen && (
              <FolderPicker folders={folders} onPick={fId => { onAddToFolder(reference.id, fId); setFolderMenuOpen(false); }} />
            )}
          </div>
        )}
        <button onClick={handleDelete} title={confirmDelete ? 'confirmar exclusão' : 'excluir'} style={{
          ...cardBtnStyle,
          color: confirmDelete ? '#F87171' : 'rgba(248,113,113,0.45)',
          borderColor: confirmDelete ? 'rgba(248,113,113,0.3)' : 'var(--brd)',
        }}>
          {busy ? <Spinner size={13} className="animate-spin" /> : <Trash size={13} />}
        </button>
      </div>
      <input ref={fileInputRef} type="file" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
    </div>
  );

  // ── GRID ────────────────────────────────────
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', reference.id); e.dataTransfer.effectAllowed = 'move'; }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirmDelete(false); setFolderMenuOpen(false); }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${dragOver ? 'var(--acc)' : hover ? 'var(--brd2)' : 'var(--brd)'}`,
        borderRadius: 'var(--r-md)', padding: 12, cursor: 'default',
        transition: 'all 0.2s', position: 'relative',
        boxShadow: hover ? '0 2px 12px rgba(0,0,0,0.25)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {typeLabels[reference.type] || reference.type}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {reference.filePath && reference.fileName?.toLowerCase().endsWith('.pdf') && (
            <button onClick={e => { e.stopPropagation(); onRead?.(); }} style={{
              ...cardBtnStyle, background: 'rgba(212,160,48,0.1)', borderColor: 'rgba(212,160,48,0.3)', color: 'var(--acc)',
            }} title="ler PDF">
              <BookOpenText size={12} weight="fill" />
            </button>
          )}
          <button onClick={toggleFavorite} style={cardBtnStyle} title={reference.isFavorite ? 'desfavoritar' : 'favoritar'}>
            <Star size={12} weight={reference.isFavorite ? 'fill' : 'regular'} color={reference.isFavorite ? 'var(--acc)' : 'var(--tx3)'} />
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit?.(); }} style={cardBtnStyle} title="editar metadados">
            <PencilSimple size={12} />
          </button>
          <button onClick={e => { e.stopPropagation(); onShare(); }} style={cardBtnStyle} title="compartilhar link">
            <ShareNetwork size={12} />
          </button>
          {folders.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={e => { e.stopPropagation(); setFolderMenuOpen(v => !v); }} style={cardBtnStyle} title="pasta">
                <Folder size={12} />
              </button>
              {folderMenuOpen && (
                <FolderPicker folders={folders} onPick={fId => { onAddToFolder(reference.id, fId); setFolderMenuOpen(false); }} />
              )}
            </div>
          )}
          <button onClick={handleDelete} title={confirmDelete ? 'confirmar' : 'excluir'} style={{
            ...cardBtnStyle,
            color: confirmDelete ? '#F87171' : 'rgba(248,113,113,0.45)',
            borderColor: confirmDelete ? 'rgba(248,113,113,0.3)' : 'var(--brd)',
          }}>
            {busy ? <Spinner size={12} className="animate-spin" /> : <Trash size={12} />}
          </button>
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 600,
        fontSize: 13, lineHeight: 1.35, marginBottom: 4, color: 'var(--tx)',
      }}>
        {reference.title}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', marginBottom: 6 }}>
        {[reference.authors, reference.venue, reference.year].filter(Boolean).join(' · ')}
      </div>

      {(reference.tags || []).length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
          {reference.tags.map((tag) => (
            <span key={tag} style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              padding: '1px 6px', borderRadius: 2,
              background: 'var(--bg3)', color: 'var(--tx2)',
              border: '1px solid var(--brd)'
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {reference.personalNote && (
        <div style={{
          marginBottom: 6, fontSize: 12, color: 'var(--tx2)',
          fontStyle: 'italic', lineHeight: 1.4,
          borderLeft: '2px solid var(--brd2)', paddingLeft: 8,
        }}>
          {reference.personalNote}
        </div>
      )}

      <div style={{
        marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--brd)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        minHeight: 24,
      }}>
        {busy ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)' }}>
            <Spinner size={12} className="animate-spin" /> processando...
          </span>
        ) : reference.filePath ? (
          <button
            onClick={e => { e.stopPropagation(); handleDownload(); }}
            title={reference.fileName}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0,
              background: 'var(--bg3)', border: '1px solid var(--brd)',
              borderRadius: 3, padding: '2px 6px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
              maxWidth: '70%',
            }}
          >
            {fileIcon(reference.fileType, reference.fileName)}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatFileType(reference.fileType, reference.fileName)}
            </span>
            {reference.fileSize && (
              <span style={{ color: 'var(--tx3)', opacity: 0.6, flexShrink: 0 }}>
                {formatFileSize(reference.fileSize)}
              </span>
            )}
          </button>
        ) : reference.url ? (
          <a
            href={reference.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0,
              background: 'var(--bg3)', border: '1px solid var(--brd)',
              borderRadius: 3, padding: '2px 6px', textDecoration: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
              maxWidth: '70%',
            }}
          >
            <LinkSimple size={11} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hostnameOf(reference.url)}
            </span>
          </a>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, background: 'none',
              border: 'none', cursor: 'pointer', padding: 0, color: 'var(--tx3)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
            }}
          >
            <Paperclip size={13} />
            {dragOver ? 'solte aqui' : 'anexar arquivo'}
          </button>
        )}
        <input ref={fileInputRef} type="file" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FolderModal
// ─────────────────────────────────────────────

function FolderModal({ folder, onClose, onSave, onDelete }) {
  const imageInputRef = useRef(null);
  const [name, setName] = useState(folder?.name || '');
  const [color, setColor] = useState(folder?.color || FOLDER_COLORS[0]);
  const [description, setDescription] = useState(folder?.description || '');
  const [isProject, setIsProject] = useState(folder?.isProject || false);
  const [image, setImage] = useState(folder?.image || null);

  function handleImageFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target.result);
    reader.readAsDataURL(f);
  }

  function save() {
    if (!name.trim()) return;
    onSave(name.trim(), color, { description: description.trim(), isProject, image });
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
      backdropFilter: 'blur(2px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg1)', border: '1px solid var(--brd2)',
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 460,
        maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderPlus size={14} color="var(--acc)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>
              {folder ? 'editar pasta' : 'nova pasta'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>imagem (opcional)</label>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: image ? 100 : 64, borderRadius: 'var(--r-md)',
              border: '1px dashed var(--brd2)', cursor: 'pointer', overflow: 'hidden',
              background: image ? `center/cover no-repeat url(${image})` : 'var(--bg2)',
              color: 'var(--tx3)', fontFamily: 'var(--font-mono)', fontSize: 11,
            }}>
              {!image && 'clique para escolher uma imagem'}
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display: 'none' }} />
            </label>
            {image && (
              <button onClick={() => setImage(null)} style={{
                marginTop: 6, background: 'none', border: 'none', color: 'var(--tx3)',
                fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', padding: 0,
              }}>remover imagem</button>
            )}
          </div>

          <div>
            <label style={labelStyle}>nome</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
              placeholder="Ex: Referências SATD" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>cor da pasta</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FOLDER_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 24, height: 24, borderRadius: '50%', background: c,
                  border: color === c ? '2px solid var(--tx)' : '2px solid transparent',
                  outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2,
                  cursor: 'pointer', flexShrink: 0,
                }} />
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>descrição (opcional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="do que se trata essa pasta..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', padding: '10px 12px',
          }}>
            <input type="checkbox" checked={isProject} onChange={e => setIsProject(e.target.checked)} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)', marginBottom: 2 }}>marcar como projeto</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', lineHeight: 1.5 }}>
                projetos agrupam referências e outros itens — é sobre eles que a IA vai atuar.
              </div>
            </div>
          </label>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderTop: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <div>
            {onDelete && (
              <button onClick={onDelete} style={{
                background: 'none', border: 'none', color: 'rgba(248,113,113,0.5)',
                fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: 0,
              }}>excluir pasta</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              background: 'none', border: '1px solid var(--brd2)', borderRadius: 8,
              padding: '7px 14px', cursor: 'pointer', color: 'var(--tx2)',
              fontFamily: 'var(--font-body)', fontSize: 14,
            }}>cancelar</button>
            <button onClick={save} disabled={!name.trim()} style={{
              background: name.trim() ? 'var(--acc)' : 'var(--bg3)',
              color: name.trim() ? 'var(--bg0)' : 'var(--tx3)',
              border: `1px solid ${name.trim() ? 'var(--acc)' : 'var(--brd)'}`,
              borderRadius: 8, padding: '7px 14px', cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: 14,
            }}>
              {folder ? 'salvar' : 'criar pasta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EditReferenceModal
// ─────────────────────────────────────────────

function EditReferenceModal({ profileId, reference, onClose }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState(reference.title || '');
  const [authors, setAuthors] = useState(reference.authors || '');
  const [venue, setVenue] = useState(reference.venue || '');
  const [year, setYear] = useState(reference.year ? String(reference.year) : '');
  const [type, setType] = useState(reference.type || 'paper_read');
  const [tags, setTags] = useState((reference.tags || []).join(', '));
  const [saving, setSaving] = useState(false);

  const canSubmit = title.trim().length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await dispatch(updateReference({
        profileId,
        reference: {
          ...reference,
          title: title.trim(), authors: authors.trim(),
          venue: venue.trim(), year: year ? Number(year) : null,
          type, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        },
      })).unwrap();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
      backdropFilter: 'blur(2px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg1)', border: '1px solid var(--brd2)',
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 480,
        maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PencilSimple size={14} color="var(--acc)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>editar referência</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>título</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da referência" style={inputStyle} /></div>
          <div><label style={labelStyle}>autores</label>
            <input value={authors} onChange={e => setAuthors(e.target.value)} placeholder="Ex: Potdar, A., & Shihab, E." style={inputStyle} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>venue</label>
              <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Ex: ICSME" style={inputStyle} /></div>
            <div style={{ width: 100 }}><label style={labelStyle}>ano</label>
              <input value={year} onChange={e => setYear(e.target.value.replace(/\D/g, ''))} placeholder="2026" style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>tipo</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setType(opt.value)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
                  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                  border: `1px solid ${type === opt.value ? 'var(--acc)' : 'var(--brd)'}`,
                  background: type === opt.value ? 'var(--acc)' : 'transparent',
                  color: type === opt.value ? 'var(--bg0)' : 'var(--tx2)',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div><label style={labelStyle}>tags (separadas por vírgula)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Ex: SATD, MSR" style={inputStyle} /></div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px', borderTop: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--brd2)', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', color: 'var(--tx2)',
            fontFamily: 'var(--font-body)', fontSize: 14,
          }}>cancelar</button>
          <button onClick={submit} disabled={!canSubmit} style={{
            background: canSubmit ? 'var(--acc)' : 'var(--bg3)',
            color: canSubmit ? 'var(--bg0)' : 'var(--tx3)',
            border: `1px solid ${canSubmit ? 'var(--acc)' : 'var(--brd)'}`,
            borderRadius: 8, padding: '8px 14px', cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saving && <Spinner size={14} className="animate-spin" />}
            {saving ? 'salvando...' : 'salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AddReferenceModal
// ─────────────────────────────────────────────

function AddReferenceModal({ profileId, targetFolder, onAddToFolder, onClose }) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [authors, setAuthors] = useState('');
  const [venue, setVenue] = useState('');
  const [year, setYear] = useState('');
  const [type, setType] = useState('paper_read');
  const [tags, setTags] = useState('');
  const [attachMode, setAttachMode] = useState('file');
  const [file, setFile] = useState(null);
  const [link, setLink] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = title.trim().length > 0 && !saving;

  function pickFile(f) {
    if (!f) return;
    setFile(f);
    if (!titleTouched) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  }

  function updateLink(value) {
    setLink(value);
    if (!titleTouched && value) setTitle(hostnameOf(value));
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const result = await dispatch(createReference({
        profileId,
        data: {
          title: title.trim(), authors: authors.trim(),
          venue: venue.trim(), year: year ? Number(year) : null,
          doi: null, url: attachMode === 'link' && link.trim() ? link.trim() : null,
          type, qualis: null,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          personalNote: '', rating: null, isRead: false, isFavorite: false, createdAt: new Date(),
        },
        file: attachMode === 'file' ? file : null,
      })).unwrap();
      // Se o modal foi aberto dentro de uma pasta, vincula a referência recém-criada a ela
      const newId = typeof result === 'string' ? result : result?.id;
      if (targetFolder && newId) {
        await onAddToFolder?.(newId, targetFolder.id);
      }
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
      backdropFilter: 'blur(2px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg1)', border: '1px solid var(--brd2)',
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 480,
        maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={14} color="var(--acc)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>nova referência</span>
            {targetFolder && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: targetFolder.color || 'var(--acc)',
                border: `1px solid ${targetFolder.color || 'var(--acc)'}55`, borderRadius: 3, padding: '1px 6px',
              }}>
                <Folder size={10} /> {targetFolder.name}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
              {[['file', 'arquivo (opcional)'], ['link', 'link (opcional)']].map(([mode, lbl]) => (
                <button key={mode} onClick={() => setAttachMode(mode)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: attachMode === mode ? 'var(--acc)' : 'var(--tx3)',
                  borderBottom: `1px solid ${attachMode === mode ? 'var(--acc)' : 'transparent'}`,
                }}>{lbl}</button>
              ))}
            </div>

            {attachMode === 'file' ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, minHeight: 80, borderRadius: 'var(--r-md)', cursor: 'pointer',
                  border: `1px dashed ${dragOver ? 'var(--acc)' : 'var(--brd2)'}`,
                  background: dragOver ? 'var(--acc-bg)' : 'var(--bg2)',
                  color: 'var(--tx3)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 12, textAlign: 'center',
                }}
              >
                {file ? (
                  <>
                    <FilePdf size={20} color="var(--acc)" />
                    <span style={{ color: 'var(--tx)' }}>{truncateName(file.name, 32)}</span>
                    <span style={{ fontSize: 11 }}>{formatFileSize(file.size)} · {formatFileType(file.type, file.name)}</span>
                    <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{
                      background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: 11, padding: 0, marginTop: 2,
                    }}>remover</button>
                  </>
                ) : (
                  <>
                    <CloudArrowUp size={20} />
                    <span>clique ou arraste um arquivo aqui</span>
                    <span style={{ fontSize: 10, color: 'var(--tx3)', opacity: 0.6 }}>PDF, DOCX, ZIP, imagem, vídeo e mais</span>
                  </>
                )}
                <input ref={fileInputRef} type="file" onChange={e => pickFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg2)', border: '1px solid var(--brd2)',
                borderRadius: 'var(--r-md)', padding: '9px 12px',
              }}>
                <LinkSimple size={14} color="var(--tx3)" />
                <input value={link} onChange={e => updateLink(e.target.value)} placeholder="https://..."
                  style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)' }} />
              </div>
            )}
          </div>

          <div><label style={labelStyle}>título</label>
            <input autoFocus value={title} onChange={e => { setTitle(e.target.value); setTitleTouched(true); }}
              placeholder="Ex: Self-Admitted Technical Debt in..." style={inputStyle} /></div>
          <div><label style={labelStyle}>autores</label>
            <input value={authors} onChange={e => setAuthors(e.target.value)} placeholder="Ex: Potdar, A., & Shihab, E." style={inputStyle} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>venue</label>
              <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Ex: ICSME" style={inputStyle} /></div>
            <div style={{ width: 100 }}><label style={labelStyle}>ano</label>
              <input value={year} onChange={e => setYear(e.target.value.replace(/\D/g, ''))} placeholder="2026" style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>tipo</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setType(opt.value)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
                  padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                  border: `1px solid ${type === opt.value ? 'var(--acc)' : 'var(--brd)'}`,
                  background: type === opt.value ? 'var(--acc)' : 'transparent',
                  color: type === opt.value ? 'var(--bg0)' : 'var(--tx2)',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div><label style={labelStyle}>tags (separadas por vírgula)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Ex: SATD, MSR" style={inputStyle} /></div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px', borderTop: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--brd2)', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', color: 'var(--tx2)',
            fontFamily: 'var(--font-body)', fontSize: 14,
          }}>cancelar</button>
          <button onClick={submit} disabled={!canSubmit} style={{
            background: canSubmit ? 'var(--acc)' : 'var(--bg3)',
            color: canSubmit ? 'var(--bg0)' : 'var(--tx3)',
            border: `1px solid ${canSubmit ? 'var(--acc)' : 'var(--brd)'}`,
            borderRadius: 8, padding: '8px 14px', cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saving && <Spinner size={14} className="animate-spin" />}
            {saving ? 'salvando...' : 'salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared micro-style
// ─────────────────────────────────────────────

const cardBtnStyle = {
  padding: '3px 5px', borderRadius: 'var(--r-sm)',
  background: 'var(--bg3)', border: '1px solid var(--brd)',
  color: 'var(--tx3)', cursor: 'pointer', display: 'flex', alignItems: 'center',
};