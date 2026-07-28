import { useState } from 'react';
import {
  FolderOpen, FolderPlus, FilePlus, File,
  CaretRight, CaretLeft, PencilSimple, Trash, MagnifyingGlass,
  NotePencil, SquaresFour, Rows, X, Check, ArrowSquareOut, Sparkle, ShareNetwork
} from '@phosphor-icons/react';
import { useFolders, useDocumentsByFolder, useDocuments } from '../../hooks/useData';
import { TEMPLATE_CATALOG } from '../../services/latex-templates';

// ── Helpers ────────────────────────────────────────────────────
const TYPE_LABEL = {
  article: 'artigo', dissertation: 'dissertação', thesis: 'tese',
  note: 'nota', report: 'relatório', poster: 'pôster'
};

const STATUS_META = {
  draft:     { label: 'draft',     color: '#60A5FA', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.22)',   bar: 'linear-gradient(90deg,#60A5FA,rgba(96,165,250,0.18))' },
  writing:   { label: 'writing',   color: '#A78BFA', bg: 'rgba(167,139,250,0.08)',  border: 'rgba(167,139,250,0.22)',  bar: 'linear-gradient(90deg,#A78BFA,rgba(167,139,250,0.18))' },
  review:    { label: 'review',    color: '#F472B6', bg: 'rgba(244,114,182,0.08)',  border: 'rgba(244,114,182,0.22)',  bar: 'linear-gradient(90deg,#F472B6,rgba(244,114,182,0.18))' },
  submitted: { label: 'submitted', color: '#D4A030', bg: 'rgba(212,160,48,0.08)',   border: 'rgba(212,160,48,0.22)',   bar: 'linear-gradient(90deg,#D4A030,rgba(212,160,48,0.18))'  },
  published: { label: 'published', color: '#D4A030', bg: 'rgba(212,160,48,0.08)',   border: 'rgba(212,160,48,0.22)',   bar: 'linear-gradient(90deg,#D4A030,rgba(212,160,48,0.18))'  },
};

// famílias disponíveis na onboarding de novo documento.
// 'livre' não vem do catálogo — usa o template engine "free" direto.
const DOC_FAMILIES = [
  { id: 'ieee', label: 'IEEE', color: '#60A5FA', desc: 'Conferências e periódicos IEEE (IEEEtran)' },
  { id: 'acm', label: 'ACM', color: '#F472B6', desc: 'Formato acmart — SIGs e conferências ACM' },
  { id: 'sbc', label: 'SBC', color: '#38BDF8', desc: 'Sociedade Brasileira de Computação' },
  { id: 'poster', label: 'Pôster', color: '#D4A030', desc: 'Layouts de pôster acadêmico' },
  { id: 'livre', label: 'Livre', color: '#8A8680', desc: 'Sem template — estrutura livre' },
];

function relDate(d) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  return `${diff}d atrás`;
}

function slugOf(doc) {
  return doc.title.split(' ').slice(0, 3).join('_').toLowerCase();
}

// ── Inline rename/create input ──────────────────────────────────
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
        width: '100%'
      }}
    />
  );
}

// ── Action button util ─────────────────────────────────────────
function ActionBtn({ title, icon, onClick, danger = false }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        padding: '4px 6px', borderRadius: 'var(--r-sm)',
        background: 'var(--bg3)', border: '1px solid var(--brd)',
        color: danger ? 'rgba(248,113,113,0.5)' : 'var(--tx3)',
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        transition: 'all 0.13s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = danger ? '#F87171' : 'var(--tx)';
        e.currentTarget.style.borderColor = danger ? 'rgba(248,113,113,0.3)' : 'var(--brd2)';
        e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.06)' : 'var(--bg4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = danger ? 'rgba(248,113,113,0.5)' : 'var(--tx3)';
        e.currentTarget.style.borderColor = 'var(--brd)';
        e.currentTarget.style.background = 'var(--bg3)';
      }}
    >
      {icon}
    </button>
  );
}

function FolderCard({ node, allDocs, onOpenFolder, onRename, onDelete, onShare, view = 'grid' }) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const fColor = node.folder.color || 'var(--acc)';

  const subCount = node.children.length;

  function countDeep(n) {
    const direct = allDocs.filter(d => d.folderId === n.folder.id).length;
    return direct + n.children.reduce((acc, c) => acc + countDeep(c), 0);
  }
  const totalDocs = countDeep(node);

  if (view === 'list') return (
    <div
      onClick={() => !editing && onOpenFolder(node.folder.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 16px',
        background: hover ? 'var(--bg2)' : 'var(--bg1)',
        border: '1px solid var(--brd)',
        borderLeft: `3px solid ${node.folder.color || 'var(--acc)'}66`,
        borderRadius: 'var(--r-md)',
        cursor: 'pointer', transition: 'background 0.12s',
      }}
    >
      <FolderOpen size={14} color={node.folder.color || 'var(--acc)'} weight="duotone" style={{ flexShrink: 0 }} />
      {editing ? (
        <InlineInput
          value={node.folder.name}
          onConfirm={name => { onRename(node.folder.id, name); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {node.folder.name}/
          {node.folder.isProject && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--acc)',
              border: '1px solid rgba(212,160,48,0.35)', borderRadius: 3, padding: '1px 5px',
            }}>projeto</span>
          )}
        </span>
      )}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', flexShrink: 0 }}>
        {totalDocs} arquivo{totalDocs !== 1 ? 's' : ''}
        {subCount > 0 && ` · ${subCount} pasta${subCount !== 1 ? 's' : ''}`}
      </span>
      {hover && !editing && (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <ActionBtn title="compartilhar link" icon={<ShareNetwork size={11} />} onClick={() => onShare(node.folder)} />
          <ActionBtn title="renomear" icon={<PencilSimple size={11} />} onClick={() => setEditing(true)} />
          <ActionBtn title="excluir" icon={<Trash size={11} />} onClick={() => onDelete(node.folder.id)} danger />
        </div>
      )}
    </div>
  );

  return (
    <div
      onClick={() => !editing && onOpenFolder(node.folder.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg1)',
        border: `1px solid ${hover ? `${fColor}55` : 'var(--brd)'}`,
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer', overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hover ? `0 2px 20px ${fColor}22` : 'none',
        display: 'flex', flexDirection: 'column',
        minHeight: 120,
      }}
    >
      {node.folder.image ? (
        <div style={{ height: 56, background: `center/cover no-repeat url(${node.folder.image})`, flexShrink: 0 }} />
      ) : (
        <div style={{ height: 2, background: `linear-gradient(90deg,${fColor},${fColor}22)` }} />
      )}

      <div style={{ padding: '14px 16px 10px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: fColor, flexShrink: 0 }} />
              {editing ? (
                <InlineInput
                  value={node.folder.name}
                  onConfirm={name => { onRename(node.folder.id, name); setEditing(false); }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
                  color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {node.folder.name}/
                </span>
              )}
              {node.folder.isProject && !editing && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--acc)',
                  border: '1px solid rgba(212,160,48,0.35)', borderRadius: 3, padding: '1px 5px', flexShrink: 0,
                }}>projeto</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', lineHeight: 1.6 }}>
              {totalDocs} arquivo{totalDocs !== 1 ? 's' : ''}
              {subCount > 0 && <span style={{ marginLeft: 8, opacity: 0.7 }}>· {subCount} subpasta{subCount !== 1 ? 's' : ''}</span>}
            </div>
            {node.folder.description && (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 6,
                overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
              }}>
                {node.folder.description}
              </div>
            )}
          </div>

          {hover && !editing && (
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              <ActionBtn title="compartilhar link" icon={<ShareNetwork size={11} />} onClick={() => onShare(node.folder)} />
              <ActionBtn title="renomear" icon={<PencilSimple size={11} />} onClick={() => setEditing(true)} />
              <ActionBtn title="excluir" icon={<Trash size={11} />} onClick={() => onDelete(node.folder.id)} danger />
            </div>
          )}
        </div>
      </div>

      <div style={{
        borderTop: '1px solid var(--brd)', padding: '7px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: fColor,
          display: 'flex', alignItems: 'center', gap: 3,
          opacity: hover ? 1 : 0.4, transition: 'opacity 0.15s'
        }}>
          abrir <CaretRight size={10} />
        </span>
      </div>
    </div>
  );
}

// ── DOCUMENT CARD ──────────────────────────────────────────────
function DocCard({ doc, onOpen, onShare, view = 'grid' }) {
  const [hover, setHover] = useState(false);
  const sm = STATUS_META[doc.status] || STATUS_META.draft;

  if (view === 'list') return (
    <div
      onClick={() => onOpen(doc)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 16px',
        background: hover ? 'var(--bg2)' : 'var(--bg1)',
        border: '1px solid var(--brd)',
        borderLeft: `3px solid ${sm.color}`,
        borderRadius: 'var(--r-md)',
        cursor: 'pointer', transition: 'background 0.12s',
      }}
    >
      <File size={13} color="var(--tx3)" style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {slugOf(doc)}.tex
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{TYPE_LABEL[doc.type] ?? doc.type}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{relDate(doc.updatedAt)}</span>
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: sm.color, background: sm.bg,
        border: `1px dashed ${sm.border}`,
        borderRadius: 'var(--r-sm)', padding: '2px 8px',
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.color, display: 'inline-block' }} />
        {sm.label}
      </span>
      {hover && (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <ActionBtn title="compartilhar link" icon={<ShareNetwork size={11} />} onClick={() => onShare(doc)} />
          <ActionBtn title="abrir editor" icon={<NotePencil size={11} />} onClick={() => onOpen(doc)} />
        </div>
      )}
    </div>
  );

  return (
    <div
      onClick={() => onOpen(doc)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg1)',
        border: `1px solid ${hover ? sm.border : 'var(--brd)'}`,
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer', overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hover ? `0 2px 20px ${sm.bg}` : 'none',
        display: 'flex', flexDirection: 'column',
        minHeight: 120,
      }}
    >
      <div style={{ height: 2, background: sm.bar }} />

      <div style={{ padding: '14px 16px 10px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <File size={12} color="var(--tx3)" style={{ flexShrink: 0 }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
                color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {slugOf(doc)}.tex
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', marginBottom: 10, lineHeight: 1.5 }}>
              {TYPE_LABEL[doc.type] ?? doc.type} · {relDate(doc.updatedAt)}
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: sm.color, background: sm.bg,
              border: `1px dashed ${sm.border}`,
              borderRadius: 'var(--r-sm)', padding: '2px 8px',
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.color, display: 'inline-block' }} />
              {sm.label}
            </span>
          </div>

          {hover && (
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              <ActionBtn title="compartilhar link" icon={<ShareNetwork size={11} />} onClick={() => onShare(doc)} />
              <ActionBtn title="editar" icon={<NotePencil size={11} />} onClick={() => onOpen(doc)} />
            </div>
          )}
        </div>
      </div>

      <div style={{
        borderTop: '1px solid var(--brd)', padding: '7px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%'
        }}>
          {doc.title.length > 30 ? doc.title.slice(0, 30) + '…' : doc.title}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: sm.color,
          display: 'flex', alignItems: 'center', gap: 3,
          opacity: hover ? 1 : 0.35, transition: 'opacity 0.15s'
        }}>
          editar <CaretRight size={10} />
        </span>
      </div>
    </div>
  );
}

// ── FOLDER COLOR PALETTE ─────────────────────────────────────
const FOLDER_COLORS = ['#D4A030', '#60A5FA', '#A78BFA', '#F472B6', '#38BDF8', '#FB923C', '#8A8680'];

// ── NEW FOLDER MODAL (nome, imagem, cor, descrição, projeto) ──
function NewFolderModal({ onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [image, setImage] = useState(null);
  const [isProject, setIsProject] = useState(false);

  function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!name.trim()) return;
    onConfirm(name.trim(), { color, description: description.trim(), image, isProject });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
        backdropFilter: 'blur(2px)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg1)', border: '1px solid var(--brd2)',
          borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 460,
          maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderPlus size={14} color="var(--acc)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>nova pasta</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer',
            display: 'flex', padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* imagem */}
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 6 }}>
              imagem (opcional)
            </label>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: image ? 100 : 64, borderRadius: 'var(--r-md)',
              border: '1px dashed var(--brd2)', cursor: 'pointer', overflow: 'hidden',
              background: image ? `center/cover no-repeat url(${image})` : 'var(--bg2)',
              color: 'var(--tx3)', fontFamily: 'var(--font-mono)', fontSize: 11,
            }}>
              {!image && 'clique para escolher uma imagem'}
              <input type="file" accept="image/*" onChange={handleImageFile} style={{ display: 'none' }} />
            </label>
            {image && (
              <button onClick={() => setImage(null)} style={{
                marginTop: 6, background: 'none', border: 'none', color: 'var(--tx3)',
                fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', padding: 0,
              }}>remover imagem</button>
            )}
          </div>

          {/* nome */}
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 6 }}>
              nome
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Ex: MFE / SATD"
              style={{
                width: '100%', background: 'var(--bg2)', border: '1px solid var(--brd2)',
                borderRadius: 'var(--r-md)', padding: '9px 12px', color: 'var(--tx)',
                fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          {/* cor */}
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 8 }}>
              cor da pasta
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {FOLDER_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  title={c}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: c,
                    border: color === c ? '2px solid var(--tx)' : '2px solid transparent',
                    outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* descrição */}
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 6 }}>
              descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="do que se trata essa pasta..."
              rows={3}
              style={{
                width: '100%', background: 'var(--bg2)', border: '1px solid var(--brd2)',
                borderRadius: 'var(--r-md)', padding: '9px 12px', color: 'var(--tx)',
                fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', resize: 'vertical',
              }}
            />
          </div>

          {/* projeto */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', padding: '10px 12px',
          }}>
            <input type="checkbox" checked={isProject} onChange={e => setIsProject(e.target.checked)} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)', marginBottom: 2 }}>
                marcar como projeto
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', lineHeight: 1.5 }}>
                projetos agrupam documentos, referências do Acervo e itens do Farol — é sobre eles que a IA vai atuar.
              </div>
            </div>
          </label>
        </div>

        {/* footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '14px 20px', borderTop: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <button
            onClick={submit}
            disabled={!name.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
              color: 'var(--bg0)', background: name.trim() ? 'var(--acc)' : 'var(--bg4)',
              border: 'none', borderRadius: 'var(--r-sm)', padding: '7px 14px',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Check size={13} /> criar pasta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BREADCRUMB ────────────────────────────────────────────────
function Breadcrumb({ path, onNavigate }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      {path.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {i > 0 && <CaretRight size={10} color="var(--tx3)" style={{ flexShrink: 0 }} />}
          <button
            onClick={() => i < path.length - 1 && onNavigate(crumb.id)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: i === path.length - 1 ? 'var(--acc)' : 'var(--tx3)',
              cursor: i < path.length - 1 ? 'pointer' : 'default',
              background: 'none', border: 'none', padding: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => i < path.length - 1 && (e.currentTarget.style.color = 'var(--tx2)')}
            onMouseLeave={e => i < path.length - 1 && (e.currentTarget.style.color = 'var(--tx3)')}
          >
            {crumb.name}
          </button>
        </span>
      ))}
    </div>
  );
}

// ── TEMPLATE PREVIEW CARD (com SVG mock do layout) ──────────

const LAYOUT_SVGS = {
  ieee: (
    <svg viewBox="0 0 120 160" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="120" height="160" fill="#fff" />
      <rect x="15" y="8" width="90" height="5" rx="1" fill="#222" />
      <rect x="30" y="16" width="60" height="3" rx="1" fill="#555" />
      <rect x="20" y="22" width="80" height="2" rx="1" fill="#888" />
      <line x1="60" y1="30" x2="60" y2="150" stroke="#e0e0e0" strokeWidth="0.5" />
      {[32,36,40,44,48,52,56,60].map(y => <rect key={`l${y}`} x="8" y={y} width={46+Math.random()*4-2} height="1.5" rx="0.5" fill="#ccc" />)}
      <rect x="8" y="66" width="30" height="2" rx="0.5" fill="#444" />
      {[70,74,78,82].map(y => <rect key={`l2${y}`} x="8" y={y} width={46+Math.random()*4-2} height="1.5" rx="0.5" fill="#ccc" />)}
      {[32,36,40,44,48,52,56,60].map(y => <rect key={`r${y}`} x="64" y={y} width={46+Math.random()*4-2} height="1.5" rx="0.5" fill="#ccc" />)}
      <rect x="64" y="66" width="30" height="2" rx="0.5" fill="#444" />
      {[70,74,78,82].map(y => <rect key={`r2${y}`} x="64" y={y} width={46+Math.random()*4-2} height="1.5" rx="0.5" fill="#ccc" />)}
      <text x="60" y="152" textAnchor="middle" fontSize="5" fill="#aaa">IEEE · two-column</text>
    </svg>
  ),
  sbc: (
    <svg viewBox="0 0 120 160" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="120" height="160" fill="#fff" />
      <rect x="20" y="10" width="80" height="5" rx="1" fill="#222" />
      <rect x="30" y="18" width="60" height="3" rx="1" fill="#555" />
      <rect x="25" y="24" width="70" height="2" rx="1" fill="#888" />
      <rect x="15" y="34" width="30" height="2.5" rx="0.5" fill="#333" />
      {[40,44,48,52,56,60,64,68].map(y => <rect key={y} x="15" y={y} width={88+Math.random()*4-2} height="1.5" rx="0.5" fill="#ccc" />)}
      <rect x="15" y="76" width="35" height="2.5" rx="0.5" fill="#333" />
      {[82,86,90,94,98,102].map(y => <rect key={y} x="15" y={y} width={88+Math.random()*4-2} height="1.5" rx="0.5" fill="#ccc" />)}
      <text x="60" y="152" textAnchor="middle" fontSize="5" fill="#aaa">SBC · single-column</text>
    </svg>
  ),
  acm: (
    <svg viewBox="0 0 120 160" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="120" height="160" fill="#fff" />
      <rect x="8" y="6" width="4" height="50" rx="1" fill="#E91E63" />
      <rect x="18" y="10" width="80" height="5" rx="1" fill="#222" />
      <rect x="18" y="18" width="70" height="3" rx="1" fill="#555" />
      <rect x="18" y="24" width="60" height="2" rx="1" fill="#888" />
      <rect x="18" y="34" width="25" height="2.5" rx="0.5" fill="#333" />
      {[40,44,48,52,56,60,64,68,72,76].map(y => <rect key={y} x="18" y={y} width={88+Math.random()*4-2} height="1.5" rx="0.5" fill="#ccc" />)}
      <text x="60" y="152" textAnchor="middle" fontSize="5" fill="#aaa">ACM · acmart</text>
    </svg>
  ),
  poster: (
    <svg viewBox="0 0 160 120" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="160" height="120" fill="#fff" />
      <rect x="5" y="5" width="150" height="18" rx="2" fill="#1a237e" />
      <rect x="15" y="9" width="80" height="5" rx="1" fill="#fff" />
      <rect x="15" y="16" width="50" height="3" rx="1" fill="#bbdefb" />
      <rect x="8" y="28" width="45" height="40" rx="2" fill="#f5f5f5" stroke="#ddd" />
      <rect x="12" y="32" width="25" height="2.5" rx="0.5" fill="#333" />
      {[37,41,45,49].map(y => <rect key={`a${y}`} x="12" y={y} width="38" height="1.5" rx="0.5" fill="#ccc" />)}
      <rect x="58" y="28" width="45" height="40" rx="2" fill="#f5f5f5" stroke="#ddd" />
      <rect x="62" y="32" width="25" height="2.5" rx="0.5" fill="#333" />
      {[37,41,45,49].map(y => <rect key={`b${y}`} x="62" y={y} width="38" height="1.5" rx="0.5" fill="#ccc" />)}
      <rect x="108" y="28" width="45" height="40" rx="2" fill="#f5f5f5" stroke="#ddd" />
      <rect x="112" y="32" width="25" height="2.5" rx="0.5" fill="#333" />
      {[37,41,45].map(y => <rect key={`c${y}`} x="112" y={y} width="38" height="1.5" rx="0.5" fill="#ccc" />)}
      <text x="80" y="112" textAnchor="middle" fontSize="5" fill="#aaa">Poster · landscape</text>
    </svg>
  ),
};

function getLayoutSvg(templateId) {
  if (templateId.startsWith('ieee')) return LAYOUT_SVGS.ieee;
  if (templateId.startsWith('sbc') || templateId.startsWith('jbcs') || templateId.startsWith('sbcm') || templateId.startsWith('sbgames')) return LAYOUT_SVGS.sbc;
  if (templateId.startsWith('acm')) return LAYOUT_SVGS.acm;
  if (templateId.startsWith('poster')) return LAYOUT_SVGS.poster;
  return LAYOUT_SVGS.sbc; // default
}

function TemplatePreviewCard({ item, color, selected, onSelect }) {
  const [hover, setHover] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hasRealPreview = item.previewImg && !imgError;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 14, alignItems: 'flex-start',
        background: selected ? `${color}08` : 'var(--bg2)',
        border: `1px solid ${hover || selected ? color : 'var(--brd)'}`,
        borderRadius: 'var(--r-md)', padding: 12, cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Preview */}
      <div style={{
        width: 90, minHeight: 116, flexShrink: 0,
        borderRadius: 4, overflow: 'hidden',
        border: '1px solid var(--brd)',
        boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.1)',
        transition: 'box-shadow 0.15s',
        background: '#fff',
      }}>
        {hasRealPreview ? (
          <img
            src={item.previewImg}
            alt={`Preview: ${item.name}`}
            onError={() => setImgError(true)}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top',
              display: 'block',
            }}
          />
        ) : (
          getLayoutSvg(item.id)
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: 'var(--tx)', fontWeight: 500, marginBottom: 3,
        }}>
          {item.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--tx3)', lineHeight: 1.5, marginBottom: 6,
        }}>
          {item.description}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: hover ? color : 'var(--tx3)',
          transition: 'color 0.12s',
        }}>
          <CaretRight size={10} />
          clique pra usar este template
        </div>
      </div>
    </div>
  );
}

// ── NEW DOCUMENT MODAL (onboarding: estilo → template → título) ─
function NewDocumentModal({ onClose, onConfirm }) {
  const [step, setStep] = useState(0);
  const [family, setFamily] = useState(null);
  const [templateItem, setTemplateItem] = useState(null);
  const [title, setTitle] = useState('');

  const group = family && family !== 'livre' ? TEMPLATE_CATALOG[family] : null;

  function pickFamily(f) {
    setFamily(f);
    setTemplateItem(null);
    setStep(f === 'livre' ? 2 : 1);
  }

  function pickTemplate(item) {
    setTemplateItem(item);
    setStep(2);
  }

  function skipTemplate() {
    setTemplateItem(null);
    setStep(2);
  }

  function goBack() {
    if (step === 2 && family !== 'livre') setStep(1);
    else setStep(0);
  }

  function confirm() {
    const engine = family === 'livre' ? 'free' : (group?.engine ?? 'free');
    onConfirm({
      title: title.trim() || 'Novo documento',
      template: engine,
      type: family === 'poster' ? 'poster' : 'article',
      sourceTemplateId: templateItem?.id ?? null,
      sourceTemplateName: templateItem?.name ?? null,
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
        backdropFilter: 'blur(2px)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg1)', border: '1px solid var(--brd2)',
          borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 720,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--brd)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={step === 0 ? onClose : goBack}
              title={step === 0 ? 'cancelar' : 'voltar'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)',
                background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-sm)',
                cursor: 'pointer', padding: '5px 9px', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--tx)'; e.currentTarget.style.borderColor = 'var(--brd2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx3)'; e.currentTarget.style.borderColor = 'var(--brd)'; }}
            >
              <CaretLeft size={12} /> {step === 0 ? 'cancelar' : 'voltar'}
            </button>
            <Sparkle size={14} color="var(--acc)" weight="fill" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>
              novo documento
              <span style={{ color: 'var(--tx3)' }}> · passo {step + 1}/3</span>
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer',
            display: 'flex', padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {step === 0 && (
            <>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)', marginBottom: 16 }}>
                que tipo de artigo/documentação você quer escrever?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {DOC_FAMILIES.map(f => (
                  <button
                    key={f.id}
                    onClick={() => pickFamily(f.id)}
                    style={{
                      textAlign: 'left', background: 'var(--bg2)',
                      border: '1px solid var(--brd)', borderRadius: 'var(--r-md)',
                      padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = f.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
                        {f.label}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', lineHeight: 1.5 }}>
                      {f.desc}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && group && (
            <>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)', marginBottom: 16 }}>
                escolha um template de referência {group.label} — ou siga sem template fixo
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={skipTemplate}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg2)', border: '1px dashed var(--brd2)',
                    borderRadius: 'var(--r-md)', padding: '10px 14px', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx2)',
                  }}
                >
                  seguir sem template específico ({group.label} genérico)
                  <CaretRight size={12} />
                </button>
                {group.items.map(item => {
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--bg2)',
                        border: `1px solid var(--brd)`,
                        borderRadius: 'var(--r-md)', overflow: 'hidden',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = `${group.color}66`}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}
                    >
                      {/* Info row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', fontWeight: 500, marginBottom: 2 }}>
                            {item.name}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>
                            {item.description}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={e => { e.stopPropagation(); pickTemplate(item); }}
                            style={{
                              padding: '5px 12px', background: group.color, color: 'var(--bg0)',
                              border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                            }}
                          >
                            usar este
                          </button>
                        </div>
                      </div>
                      {/* Preview sempre visível */}
                      {item.previewImg && (
                        <div style={{
                          borderTop: `1px solid ${group.color}33`,
                          background: '#fff', padding: 12,
                          display: 'flex', justifyContent: 'center',
                        }}>
                          <img
                            src={item.previewImg}
                            alt={`Preview: ${item.name}`}
                            style={{
                              maxWidth: '100%', maxHeight: 320,
                              borderRadius: 4, border: '1px solid #e0e0e0',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            }}
                          />
                        </div>
                      )}
                      {!item.previewImg && (
                        <div style={{
                          borderTop: `1px solid ${group.color}33`,
                          background: '#fff', padding: 12,
                          display: 'flex', justifyContent: 'center',
                          maxHeight: 200,
                        }}>
                          {getLayoutSvg(item.id)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)', marginBottom: 10 }}>
                {family === 'livre'
                  ? 'sem template — estrutura livre'
                  : `${DOC_FAMILIES.find(f => f.id === family)?.label}${templateItem ? ` · ${templateItem.name}` : ' · genérico'}`}
              </p>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 6 }}>
                título do documento
              </label>
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirm()}
                placeholder="Ex: Análise de SATD em microfrontends"
                style={{
                  width: '100%', background: 'var(--bg2)', border: '1px solid var(--brd2)',
                  borderRadius: 'var(--r-md)', padding: '9px 12px', color: 'var(--tx)',
                  fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
                }}
              />
            </>
          )}
        </div>

        {/* footer — só a ação principal; voltar/cancelar já está no cabeçalho */}
        {step === 2 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '14px 20px', borderTop: '1px solid var(--brd)', flexShrink: 0,
          }}>
            <button
              onClick={confirm}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                color: 'var(--bg0)', background: 'var(--acc)',
                border: 'none', borderRadius: 'var(--r-sm)', padding: '7px 14px', cursor: 'pointer',
              }}
            >
              <Check size={13} /> criar documento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN: BancadaBrowser ───────────────────────────────────────
export function BancadaBrowser({ profileId, onOpenDoc, onCreateDoc, search: searchProp = '' }) {
  const [activeFolderId, setActiveFolderId] = useState(null);
  const search = searchProp; // busca vem do Topbar via App
  const [view, setView] = useState('grid'); // 'grid' | 'list'
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [toast, setToast] = useState('');

  const { tree, createFolder, renameFolder, deleteFolder, folders } = useFolders(profileId);
  const allDocs = useDocuments(profileId) ?? [];
  const docs = useDocumentsByFolder(profileId, activeFolderId) ?? [];

  function handleShare(entity) {
    const isFolder = 'parentId' in entity;
    const url = isFolder
      ? `${window.location.origin}/bancada?folder=${entity.id}`
      : `${window.location.origin}/bancada/editor?doc=${entity.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setToast(`link copiado — funciona neste mesmo navegador, já que os dados ficam salvos localmente`);
    setTimeout(() => setToast(''), 3500);
  }

  // ─── breadcrumb path (sem "bancada" — quando dentro de pasta, mostra só o caminho) ──
  function buildPath(targetId) {
    if (!targetId) return [];
    const path = [];
    let current = targetId;
    while (current) {
      const f = folders.find(f => f.id === current);
      if (!f) break;
      path.unshift({ id: f.id, name: f.name });
      current = f.parentId ?? null;
    }
    return path;
  }

  const breadcrumbPath = buildPath(activeFolderId);

  // ─── child folders in current view ────────────────────────
  function findChildren(nodes, targetId) {
    if (targetId === null) return nodes;
    for (const node of nodes) {
      if (node.folder.id === targetId) return node.children;
      const found = findChildren(node.children, targetId);
      if (found.length > 0 || node.folder.id === targetId) return found;
    }
    return [];
  }

  const childFolders = Array.isArray(tree) ? findChildren(tree, activeFolderId) : [];

  // ─── filtered docs ─────────────────────────────────────────
  const filteredDocs = search.trim()
    ? docs.filter(d =>
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        (TYPE_LABEL[d.type] ?? d.type).includes(search.toLowerCase())
      )
    : docs;

  const hasContent = childFolders.length > 0 || filteredDocs.length > 0;
  const showEmptyState = !hasContent;

  // ─── status pills (só na raiz) ───────────────────────────────
  const byStatus = Object.entries(
    allDocs.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {})
  );

  // ─── linha de status única (substitui a antiga meta bar) ────
  function statusLine() {
    if (search.trim() && !hasContent) return 'sem resultados';
    if (!hasContent) return 'vazio';
    const parts = [];
    if (childFolders.length > 0) parts.push(`${childFolders.length} pasta${childFolders.length !== 1 ? 's' : ''}`);
    if (filteredDocs.length > 0) parts.push(`${filteredDocs.length} arquivo${filteredDocs.length !== 1 ? 's' : ''}`);
    return parts.join(' · ');
  }

  function handleCreateDoc(meta) {
    onCreateDoc(activeFolderId, meta);
    setNewDocOpen(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {newDocOpen && (
        <NewDocumentModal
          onClose={() => setNewDocOpen(false)}
          onConfirm={handleCreateDoc}
        />
      )}

      {newFolderOpen && (
        <NewFolderModal
          onClose={() => setNewFolderOpen(false)}
          onConfirm={(name, extra) => { createFolder(name, activeFolderId, extra); setNewFolderOpen(false); }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg3)', border: '1px solid var(--brd2)', color: 'var(--tx2)',
          fontFamily: 'var(--font-mono)', fontSize: 12, padding: '9px 16px',
          borderRadius: 'var(--r-md)', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          maxWidth: 420, textAlign: 'center',
        }}>
          {toast}
        </div>
      )}

      {/* ── TOPBAR (breadcrumb + status + busca + ações, tudo em 1 linha) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 24px', borderBottom: '1px solid var(--brd)',
        background: 'var(--bg1)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* back btn */}
        {activeFolderId !== null && (
          <button
            onClick={() => {
              const parent = folders.find(f => f.id === activeFolderId);
              setActiveFolderId(parent?.parentId ?? null);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--tx)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--tx3)'}
          >
            <CaretLeft size={12} /> voltar
          </button>
        )}

        {/* breadcrumb + status inline, uma linha só */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <Breadcrumb path={breadcrumbPath} onNavigate={setActiveFolderId} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            — {statusLine()}
          </span>
          {/* status pills — só na raiz, sem busca ativa */}
          {activeFolderId === null && !search.trim() && byStatus.map(([status, count]) => {
            const sm = STATUS_META[status] || STATUS_META.draft;
            return (
              <span key={status} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 4, color: 'var(--tx3)', flexShrink: 0,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.color, display: 'inline-block' }} />
                {sm.label} <strong style={{ color: 'var(--tx2)' }}>{count}</strong>
              </span>
            );
          })}
        </div>

        {/* view toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', borderRadius: 'var(--r-sm)', padding: 2, flexShrink: 0 }}>
          {[['grid', <SquaresFour size={13} />], ['list', <Rows size={13} />]].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '4px 7px', borderRadius: 3,
              background: view === v ? 'var(--bg4)' : 'transparent',
              color: view === v ? 'var(--acc)' : 'var(--tx3)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              transition: 'all 0.12s',
            }}>{icon}</button>
          ))}
        </div>

        {/* ações: criar pasta / criar documento */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setNewFolderOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx2)',
              background: 'var(--bg2)', border: '1px solid var(--brd)',
              borderRadius: 'var(--r-sm)', padding: '5px 10px', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brd2)'; e.currentTarget.style.color = 'var(--tx)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)'; e.currentTarget.style.color = 'var(--tx2)'; }}
          >
            <FolderPlus size={12} /> pasta
          </button>
          <button
            onClick={() => setNewDocOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
              color: 'var(--bg0)', background: 'var(--acc)',
              border: 'none', borderRadius: 'var(--r-sm)', padding: '5px 12px', cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--acc2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--acc)'}
          >
            <FilePlus size={12} /> documento
          </button>
        </div>
      </div>

      {/* ── GRID / LIST AREA ───────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {showEmptyState ? (
          /* empty state — ações centralizadas */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, height: '100%', minHeight: 240,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx3)' }}>
              <span style={{ color: 'var(--acc)' }}>$</span> {statusLine()}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setNewFolderOpen(true)}
                style={{
                  background: 'none', border: '1px dashed var(--brd2)',
                  padding: '7px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'border-color 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,160,48,0.35)'; e.currentTarget.style.color = 'var(--acc)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd2)'; e.currentTarget.style.color = 'var(--tx3)'; }}
              >
                <FolderPlus size={12} /> criar pasta
              </button>
              <button
                onClick={() => setNewDocOpen(true)}
                style={{
                  background: 'none', border: '1px dashed var(--brd2)',
                  padding: '7px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'border-color 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,160,48,0.35)'; e.currentTarget.style.color = 'var(--acc)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd2)'; e.currentTarget.style.color = 'var(--tx3)'; }}
              >
                <FilePlus size={12} /> criar documento
              </button>
            </div>
          </div>
        ) : view === 'list' ? (
          /* LIST VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {childFolders.map(node => (
              <FolderCard
                key={node.folder.id} node={node} allDocs={allDocs}
                onOpenFolder={setActiveFolderId}
                onRename={renameFolder}
                onDelete={id => { deleteFolder(id); if (id === activeFolderId) setActiveFolderId(null); }}
                onShare={handleShare}
                view="list"
              />
            ))}
            {filteredDocs.map(doc => (
              <DocCard key={doc.id} doc={doc} onOpen={onOpenDoc} onShare={handleShare} view="list" />
            ))}
          </div>
        ) : (
          /* GRID VIEW */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {childFolders.map(node => (
              <FolderCard
                key={node.folder.id} node={node} allDocs={allDocs}
                onOpenFolder={setActiveFolderId}
                onRename={renameFolder}
                onDelete={id => { deleteFolder(id); if (id === activeFolderId) setActiveFolderId(null); }}
                onShare={handleShare}
                view="grid"
              />
            ))}

            {filteredDocs.map(doc => (
              <DocCard key={doc.id} doc={doc} onOpen={onOpenDoc} onShare={handleShare} view="grid" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
