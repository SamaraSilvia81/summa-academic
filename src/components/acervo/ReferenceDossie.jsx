import { useState } from 'react';
import {
  X, Star, FilePdf, LinkSimple, ArrowSquareOut,
  BookOpenText, PencilSimple, Quotes, Folder, DownloadSimple,
  Copy,
} from '@phosphor-icons/react';
import { copyCitation } from '../../lib/citations';
import { getReferenceFileUrl } from '../../lib/storage';

const TYPE_COLORS = {
  paper_read: '#D4A030', my_article: '#D4A030', dataset: '#4ADE80',
  book: '#F472B6', thesis: '#60A5FA', note: '#8A8680',
  post: '#7B9EE0', thread: '#A07BD4', news: '#F87171', cfp: '#4ADE80',
};

const TYPE_LABELS = {
  paper_read: 'paper', my_article: 'meu artigo', dataset: 'dataset',
  book: 'livro', thesis: 'tese', note: 'nota',
  post: 'artigo', thread: 'thread', news: 'notícia', cfp: 'CFP',
};

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

const mono = { fontFamily: 'var(--font-mono)' };
const label = {
  ...mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 3,
};
const value = { ...mono, fontSize: 13, color: 'var(--tx)' };

export function ReferenceDossie({
  reference: ref,
  profileId,
  folders,
  onClose,
  onRead,
  onEdit,
  onAddToFolder,
}) {
  const [citeToast, setCiteToast] = useState('');
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);

  if (!ref) return null;

  const tc = TYPE_COLORS[ref.type] || '#8A8680';
  const tl = TYPE_LABELS[ref.type] || ref.type;

  async function handleDownload() {
    if (!ref.filePath) return;
    const url = await getReferenceFileUrl(ref.filePath);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function handleCite(format) {
    copyCitation(ref, format);
    setCiteToast(`${format} copiado`);
    setTimeout(() => setCiteToast(''), 2000);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(4,7,13,0.7)',
      }} />

      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 520,
          background: 'var(--bg1)', borderLeft: '1px solid var(--brd2)',
          overflowY: 'auto', animation: 'slideInRight 0.3s ease-out',
        }}
      >
        {/* HUD corners */}
        <div style={{
          position: 'absolute', top: 8, left: 8, width: 14, height: 14,
          borderTop: `1.5px solid ${tc}`, borderLeft: `1.5px solid ${tc}`,
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div style={{
          position: 'absolute', bottom: 8, right: 8, width: 14, height: 14,
          borderBottom: `1.5px solid ${tc}`, borderRight: `1.5px solid ${tc}`,
          pointerEvents: 'none', zIndex: 2,
        }} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: 20,
          }}>
            <div>
              <div style={{
                ...mono, fontSize: 10, color: 'var(--tx3)',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
              }}>
                <span style={{ ...mono, fontSize: 10, color: tc }}>— dados</span>
              </div>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
                color: 'var(--tx)', lineHeight: 1.2, margin: 0,
                letterSpacing: '-0.01em',
              }}>
                {ref.title}
              </h2>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: '1px solid var(--brd)',
              padding: '6px', cursor: 'pointer', color: 'var(--tx3)',
              display: 'flex', flexShrink: 0,
            }}>
              <X size={14} />
            </button>
          </div>

          {/* Type + codename row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 16, ...mono, fontSize: 11,
          }}>
            <span style={{
              padding: '2px 8px', background: `${tc}15`, color: tc,
              border: `1px solid ${tc}30`, fontWeight: 600,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {tl}
            </span>
            {ref.isRead && (
              <span style={{ padding: '2px 8px', background: 'rgba(74,222,128,0.1)', color: '#4ADE80' }}>
                lido
              </span>
            )}
            {ref.isFavorite && (
              <Star size={14} weight="fill" color="#D4A030" />
            )}
            {ref.year && (
              <span style={{ color: 'var(--tx3)' }}>· {ref.year}</span>
            )}
          </div>

          {/* MetaStat grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16, marginBottom: 20, paddingBottom: 16,
            borderBottom: '1px solid var(--brd)',
          }}>
            <div>
              <div style={label}>autores</div>
              <div style={{ ...value, fontSize: 12 }}>{ref.authors || '—'}</div>
            </div>
            <div>
              <div style={label}>fonte</div>
              <div style={{ ...value, fontSize: 12 }}>
                {ref.source || ref.venue || (ref.url ? hostnameOf(ref.url) : '—')}
              </div>
            </div>
            <div>
              <div style={label}>ano</div>
              <div style={value}>{ref.year || '—'}</div>
            </div>
          </div>

          {/* Descrição / abstract */}
          {ref.description && (
            <div style={{ marginBottom: 20 }}>
              <div style={label}>descrição</div>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--tx2)',
                lineHeight: 1.6, marginTop: 4,
              }}>
                {ref.description}
              </div>
            </div>
          )}

          {/* Nota / quote */}
          {ref.notes && (
            <div style={{
              marginBottom: 20, padding: '12px 16px',
              borderLeft: `2px solid ${tc}`, background: 'var(--bg2)',
            }}>
              <div style={{ ...label, marginBottom: 6 }}>
                <Quotes size={11} style={{ marginRight: 4 }} /> nota de campo
              </div>
              <div style={{
                fontFamily: 'var(--font-quote)', fontSize: 14, color: 'var(--tx)',
                fontStyle: 'italic', lineHeight: 1.5,
              }}>
                {ref.notes}
              </div>
            </div>
          )}

          {/* Tags */}
          {(ref.tags || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={label}>tags</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {ref.tags.map(tag => (
                  <span key={tag} style={{
                    ...mono, fontSize: 11, padding: '2px 8px',
                    border: '1px solid var(--brd2)', color: 'var(--tx2)',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* File / Link */}
          {(ref.filePath || ref.url) && (
            <div style={{
              marginBottom: 20, paddingBottom: 16,
              borderBottom: '1px solid var(--brd)',
            }}>
              <div style={label}>arquivo / link</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {ref.filePath && (
                  <button onClick={handleDownload} style={{
                    ...mono, fontSize: 11, padding: '6px 12px',
                    background: 'var(--bg2)', border: '1px solid var(--brd2)',
                    color: 'var(--tx2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <FilePdf size={13} /> {ref.fileName || 'PDF'} <DownloadSimple size={11} />
                  </button>
                )}
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" style={{
                    ...mono, fontSize: 11, padding: '6px 12px',
                    background: 'var(--bg2)', border: '1px solid var(--brd2)',
                    color: 'var(--tx2)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <LinkSimple size={13} /> {hostnameOf(ref.url)} <ArrowSquareOut size={11} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Citations */}
          <div style={{ marginBottom: 20 }}>
            <div style={label}>citar</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {['ABNT', 'APA', 'BibTeX'].map(fmt => (
                <button key={fmt} onClick={() => handleCite(fmt)} style={{
                  ...mono, fontSize: 11, padding: '5px 10px',
                  background: 'var(--bg2)', border: '1px solid var(--brd)',
                  color: 'var(--tx3)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Copy size={11} /> {fmt}
                </button>
              ))}
            </div>
            {citeToast && (
              <span style={{ ...mono, fontSize: 10, color: '#4ADE80', marginTop: 4, display: 'block' }}>
                {citeToast}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex', gap: 8, paddingTop: 16,
            borderTop: '1px solid var(--brd)',
          }}>
            {(ref.filePath || ref.url) && (
              <button onClick={onRead} style={{
                ...mono, fontSize: 12, fontWeight: 600, padding: '8px 16px',
                background: tc, color: 'var(--bg0)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                letterSpacing: '0.03em', flex: 1, justifyContent: 'center',
              }}>
                <BookOpenText size={14} /> LER
              </button>
            )}
            <button onClick={onEdit} style={{
              ...mono, fontSize: 11, padding: '8px 14px',
              background: 'var(--bg2)', border: '1px solid var(--brd)',
              color: 'var(--tx2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <PencilSimple size={12} /> editar
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setFolderMenuOpen(v => !v)} style={{
                ...mono, fontSize: 11, padding: '8px 14px',
                background: 'var(--bg2)', border: '1px solid var(--brd)',
                color: 'var(--tx2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Folder size={12} /> pasta
              </button>
              {folderMenuOpen && folders.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: '100%', right: 0, zIndex: 50,
                  background: 'var(--bg2)', border: '1px solid var(--brd2)',
                  padding: '4px 0', marginBottom: 4, minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {folders.map(f => (
                    <button key={f.id} onClick={() => {
                      onAddToFolder?.(ref.id, f.id);
                      setFolderMenuOpen(false);
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '6px 12px', background: 'none', border: 'none',
                      cursor: 'pointer', ...mono, fontSize: 11, color: 'var(--tx)',
                      textAlign: 'left',
                    }}>
                      <span style={{
                        width: 6, height: 6, background: f.color || 'var(--acc)', flexShrink: 0,
                      }} />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}