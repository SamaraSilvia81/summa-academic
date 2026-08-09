import { useRef, useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MagnifyingGlass, Star, Plus, X, Paperclip, DownloadSimple,
  Trash, CloudArrowUp, FilePdf, Spinner, LinkSimple, ArrowSquareOut,
  SquaresFour, Rows, FolderPlus, FolderOpen, PencilSimple,
  ShareNetwork, CaretLeft, CaretRight, Folder, Funnel,
  FileImage, FileVideo, FileAudio, FileDoc, FileZip, File as FileGeneric,
  BookOpenText, BookmarkSimple, Quotes, Export,
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
import { copyCitation, exportBibTeX, exportRIS } from '../../lib/citations';
import { ReferenceFolderRepo } from '../../services/repositories';
import { PdfThumbnail } from './PdfThumbnail';
import { Fichario } from './Fichario';
import { ReferenceDossie } from './ReferenceDossie';

const FILTERS = ['todos', 'papers', 'livros', 'artigos', 'meus artigos', 'datasets', 'notas', 'favoritos'];

const SORT_OPTIONS = [
  { value: 'recent', label: 'recentes' },
  { value: 'az', label: 'a–z' },
  { value: 'year', label: 'ano' },
];

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

function useReferenceFolders(profileId) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const data = await ReferenceFolderRepo.getAll(profileId);
      if (data) {
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

export function Acervo({ profileId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tab, folderId } = useParams();
  const references = useReferences(profileId);
  const {
    folders, createFolder, updateFolder,
    deleteFolder, addRefToFolder,
  } = useReferenceFolders(profileId);

  // ── Derivados das rotas ──
  const [virtualFolder, setVirtualFolder] = useState(null);
  const activeTab = folderId ? 'referencias' : (tab || 'referencias');
  const currentFolder = virtualFolder || folderId || null;
  const setActiveTab = (t) => navigate(`/acervo/${t}`);
  const setCurrentFolder = (id) => {
    if (!id) { setVirtualFolder(null); navigate('/acervo/referencias'); }
    else if (id.startsWith('__')) { setVirtualFolder(id); }
    else { setVirtualFolder(null); navigate(`/acervo/pasta/${id}`); }
  };

  const [readingRef, setReadingRef] = useState(null);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [sortDir, setSortDir] = useState('desc');
  const [filterYear, setFilterYear] = useState('todos');
  const [filterHasFile, setFilterHasFile] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState('grid');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [editFolderOpen, setEditFolderOpen] = useState(null);
  const [editRefOpen, setEditRefOpen] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [toast, setToast] = useState('');
  const [dossieRef, setDossieRef] = useState(null);
  const [page, setPage] = useState(0);
  const defaultColWidths = [28, 340, 140, 50, 68, 52, 80, 28];
  const [colWidths, setColWidths] = useState(defaultColWidths);
  const resizingCol = useRef(null);
  const PER_PAGE = 20;

  const isInbox = currentFolder === '__inbox__';
  const currentFolderObj = isInbox ? null : (folders.find(f => f.id === currentFolder) || null);

  const refsInAnyFolder = new Set(folders.flatMap(f => f.refIds || []));
  const inboxCount = (references || []).filter(r => !refsInAnyFolder.has(r.id)).length;

  const folderRefIds = isInbox ? null : (currentFolderObj ? new Set(currentFolderObj.refIds || []) : null);

  const availableYears = Array.from(
    new Set((references || []).map((r) => r.year).filter(Boolean))
  ).sort((a, b) => b - a);

  const hasActiveFilters = sortBy !== 'recent' || filterYear !== 'todos' || filterHasFile;

  function clearFilters() {
    setSortBy('recent');
    setSortDir('desc');
    setFilterYear('todos');
    setFilterHasFile(false);
    setPage(0);
  }

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'title' || col === 'author' ? 'asc' : 'desc');
    }
    setPage(0);
  }

  function startResize(colIdx, e) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colIdx];
    resizingCol.current = colIdx;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      setColWidths(prev => {
        const next = [...prev];
        next[colIdx] = Math.max(28, startW + delta);
        return next;
      });
    };
    const onUp = () => {
      resizingCol.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const filtered = (references || []).filter((ref) => {
    if (!currentFolder) return true;
    if (currentFolder === '__read__') return ref.isRead;
    if (currentFolder === '__unread__') return !ref.isRead;
    if (isInbox) return !refsInAnyFolder.has(ref.id); // inbox: orphans
    if (folderRefIds) return folderRefIds.has(ref.id); // specific folder
    return true;
  }).filter((ref) => {
    if (activeFilter === 'papers') return ref.type === 'paper_read';
    if (activeFilter === 'livros') return ref.type === 'book';
    if (activeFilter === 'artigos') return ref.type === 'post' || ref.type === 'thread' || ref.type === 'news';
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
  }).filter((ref) => {
    if (filterYear === 'todos') return true;
    return String(ref.year) === String(filterYear);
  }).filter((ref) => {
    if (!filterHasFile) return true;
    return !!ref.filePath;
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'title') return dir * (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'author') return dir * (a.authors || '').localeCompare(b.authors || '');
    if (sortBy === 'year') return dir * ((a.year || 0) - (b.year || 0));
    if (sortBy === 'type') return dir * (a.type || '').localeCompare(b.type || '');
    if (sortBy === 'status') return dir * ((a.isRead ? 1 : 0) - (b.isRead ? 1 : 0));
    if (sortBy === 'az') return (a.title || '').localeCompare(b.title || '');
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const isEmpty = filtered.length === 0;

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

  return (
    <div className="animate-fade-in">
      <div style={{
        width: '100%', borderRadius: 'var(--r-xl)', overflow: 'hidden',
        margin: '14px 0 20px', position: 'relative',
        border: '1px solid var(--brd)',
        background: 'linear-gradient(135deg, var(--bg2), var(--bg3))',
        minHeight: 200,
      }}>
        <img
          src="/banner-farol.png"
          alt=""
          onError={e => { e.target.style.display = 'none'; }}
          style={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: 'linear-gradient(135deg, rgba(4,7,13,0.82), rgba(4,7,13,0.45))',
        }} />
        <div style={{
          position: 'relative', zIndex: 3, padding: '36px 32px 28px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: '0.12em',
                marginBottom: 4,
              }}>
                — acervo
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', color: '#fff',
                lineHeight: 1.1, letterSpacing: '-0.02em',
              }}>
                Minha <span style={{ color: 'var(--acc)' }}>Biblioteca</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {[
                ['referencias', 'Referências', BookmarkSimple],
                ['leitura', 'Leitura', BookOpenText],
              ].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
                  padding: '6px 14px', cursor: 'pointer', background: 'none',
                  border: 'none', borderBottom: `2px solid ${activeTab === key ? 'var(--acc)' : 'transparent'}`,
                  color: activeTab === key ? 'var(--tx)' : 'var(--tx3)',
                  whiteSpace: 'nowrap',
                }}>
                  <Icon size={14} weight={activeTab === key ? 'fill' : 'regular'} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 16,
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.5)',
          }}>
            <span><strong style={{ color: 'var(--acc)' }}>{references?.length || 0}</strong> refs</span>
            <span><strong style={{ color: 'var(--green)' }}>{references?.filter(r => r.isRead).length || 0}</strong> lidos</span>
            <span><strong style={{ color: '#F0AD4E' }}>{references?.filter(r => r.isFavorite).length || 0}</strong> favoritos</span>
            <span><strong style={{ color: 'var(--tx2)' }}>{references?.filter(r => r.filePath).length || 0}</strong> c/ arquivo</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 'var(--r-md)', margin: '15px 0 5px', padding: '8px 14px', maxWidth: 480,
            backdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--acc)', fontWeight: 600 }}>›_</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="buscar por título, autor, tag..."
              style={{
                border: 'none', background: 'none', outline: 'none', flex: 1,
                fontFamily: 'var(--font-mono)', fontSize: 13, color: '#fff',
              }}
            />
          </div>
        </div>
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

      {/* ── Pastas ── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 8, alignItems: 'stretch', flexWrap: 'wrap',
      }}>
        {[
          { id: null, name: 'Todas', icon: '◉', color: 'var(--acc)', count: (references || []).length },
          { id: '__inbox__', name: 'Inbox', icon: '◌', color: '#8A8680', count: inboxCount },
          { id: '__read__', name: 'Lidos', icon: '✓', color: '#4ADE80', count: (references || []).filter(r => r.isRead).length },
          { id: '__unread__', name: 'Não lidos', icon: '○', color: 'var(--tx3)', count: (references || []).filter(r => !r.isRead).length },
          ...folders.map(f => ({ id: f.id, name: f.name, icon: '▪', color: f.color || 'var(--acc)', count: (f.refIds || []).length })),
        ].map(f => {
          const isActive = currentFolder === f.id;
          return (
            <button
              key={f.id || '__all__'}
              onClick={() => { setCurrentFolder(f.id); setPage(0); if (f.id === null) setActiveFilter('todos'); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '8px 14px', cursor: 'pointer', minWidth: 80,
                border: isActive ? '1px solid ' + f.color : '1px solid var(--brd)',
                background: isActive ? f.color + '10' : 'var(--bg1)',
                transition: 'all 0.12s',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, color: isActive ? f.color : 'var(--tx3)',
                letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 8 }}>{f.icon}</span> {f.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                color: isActive ? f.color : 'var(--tx2)', marginTop: 2,
              }}>
                {f.count}
              </span>
            </button>
          );
        })}
        <button onClick={() => setNewFolderOpen(true)} title="nova pasta" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg1)', border: '1px dashed var(--brd)',
          padding: '8px 14px', cursor: 'pointer', color: 'var(--tx3)', minWidth: 50,
        }}>
          <FolderPlus size={14} />
        </button>
      </div>

      {/* ── Barra de ações ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
      }}>
        <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { setActiveFilter(f); setPage(0); }} style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500,
              padding: '3px 8px', cursor: 'pointer',
              border: activeFilter === f ? '1px solid var(--acc)' : '1px solid var(--brd)',
              background: activeFilter === f ? 'var(--acc-bg)' : 'transparent',
              color: activeFilter === f ? 'var(--acc)' : 'var(--tx3)',
              transition: 'all 0.12s', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setFiltersOpen(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: filtersOpen || hasActiveFilters ? 'var(--acc-bg)' : 'transparent',
          border: '1px solid ' + (filtersOpen || hasActiveFilters ? 'var(--acc)' : 'var(--brd)'),
          padding: '3px 8px', cursor: 'pointer',
          color: filtersOpen || hasActiveFilters ? 'var(--acc)' : 'var(--tx3)',
          fontFamily: 'var(--font-mono)', fontSize: 9,
        }}>
          <Funnel size={10} weight={hasActiveFilters ? 'fill' : 'regular'} /> filtros
        </button>
        <button onClick={() => setAddOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'var(--acc)', color: 'var(--bg0)', border: 'none',
          padding: '4px 12px', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          <Plus size={10} weight="bold" /> adicionar
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setExportOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 3,
            background: 'transparent', color: 'var(--tx3)', border: '1px solid var(--brd)',
            padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 9,
          }}>
            <Export size={10} /> exportar
          </button>
          {exportOpen && (
            <div style={{
              position: 'absolute', top: 28, right: 0, zIndex: 20,
              background: 'var(--bg1)', border: '1px solid var(--brd2)',
              borderRadius: 'var(--r-md)', padding: 4, minWidth: 120,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {[
                { label: 'BibTeX (.bib)', fn: () => { exportBibTeX(references || []); setExportOpen(false); } },
                { label: 'RIS (.ris)', fn: () => { exportRIS(references || []); setExportOpen(false); } },
              ].map(({ label, fn }) => (
                <button key={label} onClick={fn} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx2)',
                  padding: '5px 8px',
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div style={{
          background: 'var(--bg1)', border: '1px solid var(--brd)',
          padding: '8px 12px', marginBottom: 8,
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14,
        }}>
          <div>
            <label style={labelStyle}>ordenar</label>
            <div style={{ display: 'flex', gap: 3 }}>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSortBy(opt.value)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 8px', cursor: 'pointer',
                  border: sortBy === opt.value ? '1px solid var(--acc)' : '1px solid var(--brd)',
                  background: sortBy === opt.value ? 'var(--acc-bg)' : 'transparent',
                  color: sortBy === opt.value ? 'var(--acc)' : 'var(--tx3)',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>ano</label>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{
              background: 'var(--bg2)', border: '1px solid var(--brd2)',
              padding: '3px 6px', color: 'var(--tx)', fontFamily: 'var(--font-mono)', fontSize: 10,
              outline: 'none', cursor: 'pointer',
            }}>
              <option value="todos">todos</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={filterHasFile} onChange={e => setFilterHasFile(e.target.checked)} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx2)' }}>c/ arquivo</span>
          </label>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)',
              textDecoration: 'underline', padding: 0,
            }}>limpar</button>
          )}
        </div>
      )}

      {/* ── Tabela ── */}
      {(() => {
        const totalPages = Math.ceil(filtered.length / PER_PAGE);
        const safePage = Math.min(page, Math.max(0, totalPages - 1));
        const paged = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);
        const sortArrow = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
        const thS = (col) => ({
          fontFamily: 'var(--font-mono)', fontSize: 9, color: sortBy === col ? 'var(--acc)' : 'var(--tx3)',
          letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
          cursor: 'pointer', userSelect: 'none', padding: '7px 4px',
          transition: 'color 0.12s', whiteSpace: 'nowrap',
        });
        const TC = {
          paper_read:'#D4A030',my_article:'#D4A030',dataset:'#4ADE80',
          book:'#F472B6',thesis:'#60A5FA',note:'#8A8680',
          post:'#7B9EE0',thread:'#A07BD4',news:'#F87171',cfp:'#4ADE80',
        };
        const TL = {
          paper_read:'paper',my_article:'meu art.',dataset:'dataset',
          book:'livro',thesis:'tese',note:'nota',
          post:'artigo',thread:'thread',news:'notícia',cfp:'CFP',
        };
        const TF = {
          paper_read:'papers',book:'livros',post:'artigos',thread:'artigos',
          news:'artigos',my_article:'meus artigos',dataset:'datasets',note:'notas',
        };
        const cols = colWidths.map(w => w + 'px').join(' ');

        return filtered.length > 0 ? (<>
        <div style={{ border: '1px solid var(--brd)', background: 'var(--bg1)', overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--brd2)', padding: '0 8px', columnGap: 8 }}>
            {[
              { key: '', label: '#', sort: false },
              { key: 'title', label: 'título' },
              { key: 'author', label: 'autor' },
              { key: 'year', label: 'ano' },
              { key: 'type', label: 'tipo' },
              { key: 'status', label: 'status' },
              { key: '', label: 'fonte', sort: false },
              { key: '', label: '', sort: false },
            ].map((col, i) => (
              <span key={i} style={{
                ...thS(col.key),
                cursor: col.sort === false ? 'default' : 'pointer',
                position: 'relative', display: 'flex', alignItems: 'center',
                textAlign: i === 0 ? 'center' : undefined,
                justifyContent: i === 0 ? 'center' : undefined,
              }}
                onClick={col.sort !== false ? () => handleSort(col.key) : undefined}
              >
                {col.label}{col.sort !== false ? sortArrow(col.key) : ''}
                {i > 0 && i < 7 && (
                  <span
                    onMouseDown={e => startResize(i, e)}
                    style={{
                      position: 'absolute', right: -2, top: 0, bottom: 0, width: 5,
                      cursor: 'col-resize', zIndex: 5,
                    }}
                  />
                )}
              </span>
            ))}
          </div>

          {paged.map((ref, idx) => {
            const tc = TC[ref.type] || '#8A8680';
            const tl = TL[ref.type] || ref.type;
            const rowNum = safePage * PER_PAGE + idx + 1;
            const srcName = ref.source || ref.venue || '';

            return (
              <div
                key={ref.id}
                onClick={() => setDossieRef(ref)}
                draggable
                onDragStart={e => e.dataTransfer.setData('text/plain', ref.id)}
                style={{
                  display: 'grid', gridTemplateColumns: cols,
                  padding: '0 8px', cursor: 'pointer', columnGap: 8,
                  borderBottom: '1px solid var(--brd)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>{rowNum}</span>
                <div style={{ padding: '6px 4px', minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{ref.title}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{ref.authors || '—'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', display: 'flex', alignItems: 'center' }}>{ref.year || '—'}</span>
                <span onClick={e => { e.stopPropagation(); const fk = TF[ref.type]; if (fk) { setActiveFilter(fk); setPage(0); } }} title={'filtrar: ' + tl} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tc, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                  <span style={{ width: 4, height: 4, background: tc, flexShrink: 0 }} />{tl}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: ref.isRead ? '#4ADE80' : 'var(--tx3)', display: 'flex', alignItems: 'center' }}>{ref.isRead ? 'lido' : 'novo'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srcName || '—'}</span>
                <span style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                  {ref.isFavorite && <Star size={9} weight="fill" color="#D4A030" />}
                  {ref.filePath && <FilePdf size={9} color="var(--tx3)" />}
                </span>
              </div>
            );
          })}

          <div style={{ padding: '6px 8px', borderTop: '1px solid var(--brd)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{filtered.length} ref{filtered.length !== 1 ? 's' : ''}</span>
            {totalPages > 1 && <span>pág. {safePage + 1} de {totalPages}</span>}
          </div>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <button disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', color: safePage === 0 ? 'var(--tx3)' : 'var(--tx2)', padding: '3px 10px', cursor: safePage === 0 ? 'default' : 'pointer', opacity: safePage === 0 ? 0.4 : 1, fontFamily: 'var(--font-mono)', fontSize: 10 }}>anterior</button>
            <span style={{ color: 'var(--tx3)' }}>{safePage + 1} / {totalPages}</span>
            <button disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', color: safePage >= totalPages - 1 ? 'var(--tx3)' : 'var(--tx2)', padding: '3px 10px', cursor: safePage >= totalPages - 1 ? 'default' : 'pointer', opacity: safePage >= totalPages - 1 ? 0.4 : 1, fontFamily: 'var(--font-mono)', fontSize: 10 }}>próxima</button>
          </div>
        )}
        </>) : (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--tx3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <BookmarkSimple size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>nenhuma referência encontrada</div>
          </div>
        );
      })()}

      {/* ── Dossiê (item view) ── */}
      {dossieRef && (
        <ReferenceDossie
          reference={dossieRef}
          profileId={profileId}
          folders={folders}
          onClose={() => setDossieRef(null)}
          onRead={() => { setReadingRef(dossieRef); setActiveTab('leitura'); setDossieRef(null); }}
          onEdit={() => { setEditRefOpen(dossieRef); setDossieRef(null); }}
          onAddToFolder={addRefToFolder}
        />
      )}
      </>)}

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

    </div>
  );
}

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

function FolderCard({ folder, allRefs, view, onOpen, onEdit, onDelete, onShare, onDropRef }) {
  const [hover, setHover] = useState(false);
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
      onClick={onOpen}
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
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {folder.name}/
        {folder.isProject && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--acc)', border: '1px solid rgba(212,160,48,0.35)', borderRadius: 3, padding: '1px 5px' }}>projeto</span>
        )}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', flexShrink: 0 }}>
        {count} item{count !== 1 ? 's' : ''}
      </span>
      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
        <FolderBtn title="compartilhar" icon={<ShareNetwork size={11} />} onClick={onShare} />
        <FolderBtn title="editar pasta" icon={<PencilSimple size={11} />} onClick={onEdit} />
        <FolderBtn title="excluir" icon={<Trash size={11} />} onClick={onDelete} danger />
      </div>
    </div>
  );

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        background: 'var(--bg1)',
        border: `1px solid ${dragOver ? 'var(--acc)' : hover ? fc + '55' : 'var(--brd)'}`,
        borderRadius: 'var(--r-lg)', cursor: 'pointer', overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: dragOver ? `0 0 0 2px ${fc}44` : hover ? `0 2px 20px ${fc}22` : 'none',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {folder.image ? (
        <div style={{ height: 52, background: `center/cover no-repeat url(${folder.image})`, flexShrink: 0 }} />
      ) : (
        <div style={{ height: 2, background: `linear-gradient(90deg,${fc},${fc}22)` }} />
      )}

      <div style={{ padding: '10px 12px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: fc, flexShrink: 0 }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--tx)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {folder.name}/
            </span>
            {folder.isProject && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--acc)',
                border: '1px solid rgba(212,160,48,0.35)', borderRadius: 3, padding: '1px 5px', flexShrink: 0,
              }}>projeto</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <FolderBtn title="compartilhar" icon={<ShareNetwork size={10} />} onClick={onShare} />
            <FolderBtn title="editar" icon={<PencilSimple size={10} />} onClick={onEdit} />
            <FolderBtn title="excluir" icon={<Trash size={10} />} onClick={onDelete} danger />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 4, paddingLeft: 13 }}>
          {count} item{count !== 1 ? 's' : ''}
        </div>
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

function ReferenceCard({ reference, profileId, view, folders, onShare, onAddToFolder, onEdit, onRead }) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [citeMenuOpen, setCiteMenuOpen] = useState(false);
  const [citeToast, setCiteToast] = useState('');

  const typeLabels = {
    paper_read: 'paper', my_article: 'meu art.',
    dataset: 'dataset', book: 'livro', thesis: 'tese', note: 'nota',
    post: 'artigo', thread: 'thread', news: 'notícia', cfp: 'CFP',
  };

  const TYPE_COLORS = {
    paper_read: '#D4A030',
    my_article: 'var(--acc)',
    dataset: 'var(--green)',
    book: '#F472B6',
    thesis: '#60A5FA',
    note: '#8A8680',
    post: '#7B9EE0',
    thread: '#A07BD4',
    news: '#F87171',
    cfp: '#4ADE80',
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
          <button className="acervo-card-btn" onClick={e => { e.stopPropagation(); onRead?.(); }} title="ler PDF" style={{
            ...cardBtnStyle, background: 'rgba(212,160,48,0.1)', borderColor: 'rgba(212,160,48,0.3)', color: 'var(--acc)',
          }}>
            <BookOpenText size={13} weight="fill" />
          </button>
        )}
        <button onClick={toggleFavorite} title={reference.isFavorite ? 'desfavoritar' : 'favoritar'} className="acervo-card-btn" className="acervo-card-btn" style={cardBtnStyle}>
          <Star size={13} weight={reference.isFavorite ? 'fill' : 'regular'} color={reference.isFavorite ? 'var(--acc)' : 'var(--tx3)'} />
        </button>
        <button onClick={e => { e.stopPropagation(); onEdit?.(); }} title="editar metadados" className="acervo-card-btn" className="acervo-card-btn" style={cardBtnStyle}>
          <PencilSimple size={13} />
        </button>
        {reference.filePath && (
          <button onClick={e => { e.stopPropagation(); handleDownload(); }} title="baixar" className="acervo-card-btn" className="acervo-card-btn" style={cardBtnStyle}>
            <DownloadSimple size={13} />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onShare(); }} title="compartilhar link" className="acervo-card-btn" className="acervo-card-btn" style={cardBtnStyle}>
          <ShareNetwork size={13} />
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={e => { e.stopPropagation(); setCiteMenuOpen(v => !v); }} title="copiar citação" className="acervo-card-btn" style={cardBtnStyle}>
            <Quotes size={13} />
          </button>
          {citeMenuOpen && (
            <div style={{
              position: 'absolute', bottom: 30, right: 0, zIndex: 20,
              background: 'var(--bg1)', border: '1px solid var(--brd2)',
              borderRadius: 'var(--r-md)', padding: 4, minWidth: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {['abnt', 'apa', 'bibtex'].map(fmt => (
                <button key={fmt} onClick={async (e) => {
                  e.stopPropagation();
                  await copyCitation(reference, fmt);
                  setCiteMenuOpen(false);
                  setCiteToast(fmt.toUpperCase());
                  setTimeout(() => setCiteToast(''), 2000);
                }} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx2)',
                  padding: '5px 8px', borderRadius: 'var(--r-sm)',
                }}>{fmt.toUpperCase()}</button>
              ))}
            </div>
          )}
        </div>
        {citeToast && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--acc)',
            fontWeight: 600, padding: '2px 6px',
          }}>{citeToast} copiado!</span>
        )}
        {folders.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button onClick={e => { e.stopPropagation(); setFolderMenuOpen(v => !v); }} title="adicionar à pasta" className="acervo-card-btn" className="acervo-card-btn" style={cardBtnStyle}>
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

  // ── GRID (biblioteca digital — vertical) ────────────────────────
  const typeColor = TYPE_COLORS[reference.type] || '#8A8680';

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
        borderRadius: 'var(--r-lg)', cursor: 'default',
        transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
        boxShadow: hover ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Cover — PDF thumbnail or type placeholder */}
      <div style={{
        height: 140, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(160deg, var(--bg3), var(--bg4))`,
        borderBottom: '1px solid var(--brd)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Color accent bar top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: typeColor }} />

        {reference.filePath && reference.fileName?.toLowerCase().endsWith('.pdf') ? (
          <PdfThumbnail filePath={reference.filePath} width={200} height={140}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 0 }} />
        ) : (
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800,
            color: typeColor, opacity: 0.1, textTransform: 'uppercase',
            userSelect: 'none', letterSpacing: '-0.03em',
          }}>
            {(reference.type || 'ref').toUpperCase()}
          </div>
        )}

        {/* Type badge */}
        <span style={{
          position: 'absolute', top: 10, left: 10,
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: '2px 7px', borderRadius: 2,
          background: `${typeColor}bb`, backdropFilter: 'blur(4px)',
        }}>
          {typeLabels[reference.type] || reference.type}
        </span>

        {/* Favorite corner */}
        {reference.isFavorite && (
          <Star size={13} weight="fill" color="var(--acc)"
            style={{ position: 'absolute', top: 10, right: 10 }} />
        )}

        {/* File info */}
        {reference.filePath && (
          <span style={{
            position: 'absolute', bottom: 6, right: 8,
            display: 'flex', alignItems: 'center', gap: 3,
            fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff',
            background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 2,
          }}>
            {fileIcon(reference.fileType, reference.fileName)}
            {reference.fileSize ? formatFileSize(reference.fileSize) : ''}
          </span>
        )}

        {/* Read status */}
        {reference.isRead && (
          <span style={{
            position: 'absolute', bottom: 6, left: 10,
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            color: 'var(--green)', background: 'rgba(4,7,13,0.7)',
            border: '1px solid rgba(74,222,128,0.3)', padding: '1px 6px', borderRadius: 2,
          }}>✓ lido</span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '10px 12px 8px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Title + inline actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 13, lineHeight: 1.3, color: 'var(--tx)', flex: 1, minWidth: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {reference.title}
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginTop: 1 }}>
            {reference.filePath && (
              <button onClick={e => { e.stopPropagation(); handleDownload(); }} className="acervo-card-btn" style={cardBtnStyle} title="baixar">
                <DownloadSimple size={10} />
              </button>
            )}
            <button onClick={toggleFavorite} className="acervo-card-btn" style={cardBtnStyle} title="favoritar">
              <Star size={10} weight={reference.isFavorite ? 'fill' : 'regular'} color={reference.isFavorite ? 'var(--acc)' : 'var(--tx3)'} />
            </button>
            <button onClick={e => { e.stopPropagation(); onEdit?.(); }} className="acervo-card-btn" style={cardBtnStyle} title="editar">
              <PencilSimple size={10} />
            </button>
            <button onClick={e => { e.stopPropagation(); onShare(); }} className="acervo-card-btn" style={cardBtnStyle} title="compartilhar">
              <ShareNetwork size={10} />
            </button>
            <button onClick={handleDelete} className="acervo-card-btn" title={confirmDelete ? 'confirmar' : 'excluir'} style={{
              ...cardBtnStyle,
              color: confirmDelete ? '#F87171' : 'rgba(248,113,113,0.35)',
              borderColor: confirmDelete ? 'rgba(248,113,113,0.3)' : 'var(--brd)',
            }}>
              {busy ? <Spinner size={10} className="animate-spin" /> : <Trash size={10} />}
            </button>
          </div>
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {reference.authors || '—'} {reference.year ? `· ${reference.year}` : ''}
        </div>

        {(reference.rating > 0 || reference.qualis) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {reference.rating > 0 && (
              <div style={{ display: 'flex', gap: 1 }}>
                {[1,2,3,4,5].map(n => (
                  <Star key={n} size={10} weight={n <= reference.rating ? 'fill' : 'regular'}
                    color={n <= reference.rating ? 'var(--acc)' : 'var(--tx3)'} style={{ opacity: n <= reference.rating ? 1 : 0.3 }} />
                ))}
              </div>
            )}
            {reference.qualis && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                color: 'var(--acc)', border: '1px solid rgba(212,160,48,0.3)',
                padding: '1px 5px', borderRadius: 2,
              }}>{reference.qualis}</span>
            )}
          </div>
        )}

        {(reference.tags || []).length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
            {reference.tags.slice(0, 3).map((tag) => (
              <span key={tag} style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                padding: '1px 5px', borderRadius: 2,
                background: 'var(--acc-bg)', color: 'var(--acc)',
                border: '1px solid rgba(212,160,48,0.15)',
              }}>{tag}</span>
            ))}
            {reference.tags.length > 3 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)' }}>+{reference.tags.length - 3}</span>
            )}
          </div>
        )}

        {reference.personalNote && (
          <div style={{
            fontSize: 11, color: 'var(--tx2)', fontFamily: 'var(--font-body)',
            lineHeight: 1.4, marginBottom: 4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', fontStyle: 'italic', opacity: 0.7,
          }}>
            {reference.personalNote}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* CTA */}
        {reference.filePath && reference.fileName?.toLowerCase().endsWith('.pdf') && (
          <button className="acervo-btn-ler" onClick={e => { e.stopPropagation(); onRead?.(); }} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
            color: '#fff', background: 'var(--acc)', border: 'none',
            padding: '6px 0', borderRadius: 'var(--r-sm)', cursor: 'pointer',
            marginTop: 6,marginBottom: 10, transition: 'all 0.12s',
          }}>
            <BookOpenText size={13} weight="fill" /> Ler
          </button>
        )}

      </div>
      <input ref={fileInputRef} type="file" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
    </div>
  );
}

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

function EditReferenceModal({ profileId, reference, onClose }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState(reference.title || '');
  const [authors, setAuthors] = useState(reference.authors || '');
  const [venue, setVenue] = useState(reference.venue || '');
  const [year, setYear] = useState(reference.year ? String(reference.year) : '');
  const [type, setType] = useState(reference.type || 'paper_read');
  const [tags, setTags] = useState((reference.tags || []).join(', '));
  const [doi, setDoi] = useState(reference.doi || '');
  const [qualis, setQualis] = useState(reference.qualis || '');
  const [personalNote, setPersonalNote] = useState(reference.personalNote || '');
  const [rating, setRating] = useState(reference.rating || 0);
  const [isRead, setIsRead] = useState(reference.isRead || false);
  const [saving, setSaving] = useState(false);

  const canSubmit = title.trim().length > 0 && !saving;
  const QUALIS_OPT = ['A1','A2','A3','A4','B1','B2','B3','B4','C'];

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
          doi: doi.trim() || null, qualis: qualis || null,
          personalNote: personalNote.trim(), rating: rating || null, isRead,
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
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 540,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
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
            <div style={{ width: 80 }}><label style={labelStyle}>ano</label>
              <input value={year} onChange={e => setYear(e.target.value.replace(/\D/g,''))} placeholder="2026" style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>DOI</label>
            <input value={doi} onChange={e => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx" style={inputStyle} /></div>
          <div><label style={labelStyle}>tipo</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setType(opt.value)} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
                  padding: '4px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  border: `1px solid ${type === opt.value ? 'var(--acc)' : 'var(--brd)'}`,
                  background: type === opt.value ? 'var(--acc-bg)' : 'transparent',
                  color: type === opt.value ? 'var(--acc)' : 'var(--tx3)',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={labelStyle}>avaliação</label>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setRating(rating === n ? 0 : n)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  }}>
                    <Star size={18} weight={n <= rating ? 'fill' : 'regular'}
                      color={n <= rating ? 'var(--acc)' : 'var(--tx3)'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>qualis</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {QUALIS_OPT.map(q => (
                  <button key={q} onClick={() => setQualis(qualis === q ? '' : q)} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                    padding: '3px 6px', borderRadius: 2, cursor: 'pointer',
                    border: `1px solid ${qualis === q ? 'var(--acc)' : 'var(--brd)'}`,
                    background: qualis === q ? 'var(--acc-bg)' : 'transparent',
                    color: qualis === q ? 'var(--acc)' : 'var(--tx3)',
                  }}>{q}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>status</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{v:false,l:'Para ler',c:'var(--tx3)'},{v:true,l:'Lido',c:'var(--green)'}].map(s => (
                  <button key={String(s.v)} onClick={() => setIsRead(s.v)} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
                    padding: '4px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    border: `1px solid ${isRead === s.v ? s.c : 'var(--brd)'}`,
                    background: isRead === s.v ? `${s.c}15` : 'transparent',
                    color: isRead === s.v ? s.c : 'var(--tx3)',
                  }}>{s.l}</button>
                ))}
              </div>
            </div>
          </div>

          <div><label style={labelStyle}>tags (separadas por vírgula)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Ex: SATD, MSR, technical-debt" style={inputStyle} /></div>
          <div><label style={labelStyle}>nota pessoal</label>
            <textarea value={personalNote} onChange={e => setPersonalNote(e.target.value)}
              placeholder="Suas impressões, conexões com a pesquisa..."
              rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
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
  const [doi, setDoi] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [rating, setRating] = useState(0);
  const [isRead, setIsRead] = useState(false);
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
          doi: doi.trim() || null, url: attachMode === 'link' && link.trim() ? link.trim() : null,
          type, qualis: null,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          personalNote: personalNote.trim(), rating: rating || null,
          isRead, isFavorite: false, createdAt: new Date(),
        },
        file: attachMode === 'file' ? file : null,
      })).unwrap();
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

          <div><label style={labelStyle}>DOI (opcional)</label>
            <input value={doi} onChange={e => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx" style={inputStyle} /></div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={labelStyle}>avaliação</label>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(rating === n ? 0 : n)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  }}>
                    <Star size={18} weight={n <= rating ? 'fill' : 'regular'}
                      color={n <= rating ? 'var(--acc)' : 'var(--tx3)'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>status</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{v:false,l:'Para ler',c:'var(--tx3)'},{v:true,l:'Lido',c:'var(--green)'}].map(s => (
                  <button key={String(s.v)} type="button" onClick={() => setIsRead(s.v)} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
                    padding: '4px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    border: `1px solid ${isRead === s.v ? s.c : 'var(--brd)'}`,
                    background: isRead === s.v ? `${s.c}15` : 'transparent',
                    color: isRead === s.v ? s.c : 'var(--tx3)',
                  }}>{s.l}</button>
                ))}
              </div>
            </div>
          </div>

          <div><label style={labelStyle}>nota pessoal (opcional)</label>
            <textarea value={personalNote} onChange={e => setPersonalNote(e.target.value)}
              placeholder="Por que é relevante? Conexões com sua pesquisa..."
              rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
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

const cardBtnStyle = {
  padding: '3px 5px', borderRadius: 'var(--r-sm)',
  background: 'var(--bg3)', border: '1px solid var(--brd)',
  color: 'var(--tx3)', cursor: 'pointer', display: 'flex', alignItems: 'center',
  transition: 'all 0.1s',
};