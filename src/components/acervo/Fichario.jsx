import { useMemo } from 'react';
import {
  FolderPlus, PencilSimple, Trash, ShareNetwork, CaretRight,
  Clock, Star, Tag,
} from '@phosphor-icons/react';
import styles from './Fichario.module.css';

const TYPE_COLORS = {
  paper_read: '#D4A030',
  my_article: '#D4A030',
  dataset: '#4ADE80',
  book: '#F472B6',
  thesis: '#60A5FA',
  note: '#8A8680',
  post: '#7B9EE0',
  thread: '#A07BD4',
  news: '#F87171',
  cfp: '#4ADE80',
};

const TYPE_LABELS = {
  paper_read: 'paper',
  my_article: 'meu art.',
  dataset: 'dataset',
  book: 'livro',
  thesis: 'tese',
  note: 'nota',
  post: 'artigo',
  thread: 'thread',
  news: 'notícia',
  cfp: 'CFP',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function Fichario({
  folders,
  references,
  onOpenFolder,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onShareFolder,
  onReadRef,
}) {
  const allRefs = references || [];
  const refsInFolders = useMemo(() => {
    return new Set(folders.flatMap(f => f.refIds || []));
  }, [folders]);

  const inboxRefs = useMemo(() => {
    return allRefs.filter(r => !refsInFolders.has(r.id));
  }, [allRefs, refsInFolders]);

  // Build folder rows: inbox first, then user folders
  const folderRows = useMemo(() => {
    const inbox = {
      id: '__inbox__',
      name: 'Inbox',
      color: '#8A8680',
      isInbox: true,
      refs: inboxRefs,
    };

    const userFolders = folders.map(f => {
      const refs = allRefs.filter(r => (f.refIds || []).includes(r.id));
      return { ...f, refs, isInbox: false };
    });

    return [inbox, ...userFolders];
  }, [folders, allRefs, inboxRefs]);

  // Recent refs (last 5 by createdAt)
  const recentRefs = useMemo(() => {
    return [...allRefs]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [allRefs]);

  // Favorite refs
  const favRefs = useMemo(() => {
    return allRefs.filter(r => r.isFavorite).slice(0, 5);
  }, [allRefs]);

  // Tag counts from all refs
  const tagCounts = useMemo(() => {
    const map = {};
    allRefs.forEach(r => {
      (r.tags || []).forEach(t => {
        map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [allRefs]);

  return (
    <div className={styles.dashboard}>
      {/* ── Fichário principal ── */}
      <div className={styles.section}>
        <div className={styles.hudTL} />
        <div className={styles.hudBR} />
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <CaretRight size={12} weight="bold" className={styles.sectionIcon} />
            fichário
          </span>
          <button className={styles.sectionAction} onClick={onNewFolder}>
            <FolderPlus size={12} /> nova pasta
          </button>
        </div>

        {folderRows.map(folder => {
          const refs = folder.refs || [];
          const readCount = refs.filter(r => r.isRead).length;
          const pct = refs.length > 0 ? Math.round((readCount / refs.length) * 100) : 0;
          const previewRef = refs[0];
          const fc = folder.color || 'var(--acc)';

          return (
            <div
              key={folder.id}
              className={styles.folderRow}
              onClick={() => onOpenFolder?.(folder.isInbox ? '__inbox__' : folder.id)}
            >
              <span
                className={styles.folderEar}
                style={{
                  background: `${fc}15`,
                  color: fc,
                  border: `1px solid ${fc}25`,
                }}
              >
                {folder.name}
                <span className={styles.folderCount}>{refs.length}</span>
                {folder.isInbox && inboxRefs.length > 0 && (
                  <span className={styles.inboxBadge}>sem pasta</span>
                )}
                {folder.isProject && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: 'var(--acc)', border: '1px solid rgba(212,160,48,0.35)',
                    borderRadius: 3, padding: '1px 5px', marginLeft: 2,
                  }}>
                    projeto
                  </span>
                )}
              </span>

              <div className={styles.folderMid}>
                <div className={styles.folderPreview}>
                  {previewRef
                    ? `${previewRef.title}${previewRef.authors ? ` — ${previewRef.authors}` : ''}`
                    : (refs.length === 0 ? 'vazio' : '...')}
                </div>
                <div className={styles.folderSub}>
                  {readCount} lidos de {refs.length}
                </div>
              </div>

              <span className={styles.folderPct}>{pct}%</span>

              <div className={styles.folderBar}>
                <div
                  className={styles.folderBarFill}
                  style={{ width: `${pct}%`, background: fc }}
                />
              </div>

              {!folder.isInbox && (
                <div className={styles.folderActions} onClick={e => e.stopPropagation()}>
                  <button
                    className={styles.folderActionBtn}
                    title="compartilhar"
                    onClick={() => onShareFolder?.(folder)}
                  >
                    <ShareNetwork size={10} />
                  </button>
                  <button
                    className={styles.folderActionBtn}
                    title="editar"
                    onClick={() => onEditFolder?.(folder.id)}
                  >
                    <PencilSimple size={10} />
                  </button>
                  <button
                    className={`${styles.folderActionBtn} ${styles.folderActionBtnDanger}`}
                    title="excluir"
                    onClick={() => onDeleteFolder?.(folder)}
                  >
                    <Trash size={10} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bottom grid: recentes + favoritos + áreas ── */}
      <div className={styles.bottomGrid}>
        {/* Recentes */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              <Clock size={12} className={styles.sectionIcon} />
              recentes
            </span>
          </div>
          {recentRefs.length > 0 ? recentRefs.map(ref => (
            <div
              key={ref.id}
              className={styles.sideItem}
              onClick={() => onReadRef?.(ref)}
            >
              <div className={styles.sideItemTitle}>{ref.title}</div>
              <div className={styles.sideItemMeta}>
                <span
                  className={styles.sideItemDot}
                  style={{ background: TYPE_COLORS[ref.type] || '#8A8680' }}
                />
                {TYPE_LABELS[ref.type] || ref.type}
                {ref.createdAt && ` · ${timeAgo(ref.createdAt)}`}
              </div>
            </div>
          )) : (
            <div style={{
              padding: '16px 14px', textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
            }}>
              nenhuma atividade
            </div>
          )}
        </div>

        {/* Favoritos */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              <Star size={12} className={styles.sectionIcon} />
              favoritos
            </span>
          </div>
          {favRefs.length > 0 ? favRefs.map(ref => (
            <div
              key={ref.id}
              className={styles.sideItem}
              onClick={() => onReadRef?.(ref)}
            >
              <div className={styles.sideItemTitle}>{ref.title}</div>
              <div className={styles.sideItemMeta}>
                <span
                  className={styles.sideItemDot}
                  style={{ background: TYPE_COLORS[ref.type] || '#8A8680' }}
                />
                {ref.authors || '—'}
              </div>
            </div>
          )) : (
            <div style={{
              padding: '16px 14px', textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
            }}>
              nenhum favorito
            </div>
          )}
        </div>

        {/* Áreas / Tags */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              <Tag size={12} className={styles.sectionIcon} />
              áreas
            </span>
          </div>
          {tagCounts.length > 0 ? (
            <div className={styles.tagGrid}>
              {tagCounts.map(([tag, count]) => (
                <button key={tag} className={styles.tagChip}>
                  {tag} <span className={styles.tagCount}>{count}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '16px 14px', textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
            }}>
              sem tags ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}