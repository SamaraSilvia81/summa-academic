import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Books, Lightning, NotePencil, Star, ArrowRight,
  BookOpenText, Eye, Graph, ArrowUpRight, ArrowSquareOut,
  TagSimple, X,
} from '@phosphor-icons/react';
import { useReferences, useDocuments, useRadarItems, useRadarStats, useProfile } from '../../hooks/useData';
import { ReferenceGraph } from './ReferenceGraph';

const TC = {
  paper_read: '#D4A030', my_article: '#D4A030', dataset: '#4ADE80',
  book: '#F472B6', thesis: '#60A5FA', note: '#8A8680',
  post: '#7B9EE0', thread: '#A07BD4', news: '#F87171',
};
const TL = {
  paper_read: 'paper', my_article: 'artigo', dataset: 'dataset',
  book: 'livro', thesis: 'tese', note: 'nota',
  post: 'post', thread: 'thread', news: 'notícia',
};

/* ── Glass Card wrapper ── */
function Glass({ children, style = {}, className = '' }) {
  return (
    <div className={className} style={{
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(20px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
      border: '1px solid var(--glass-border)',
      borderRadius: 14,
      padding: '14px 16px',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Stat chip (compact, glass) ── */
function StatChip({ label, value, color, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--glass-border)',
      borderRadius: 10, padding: '10px 14px',
      cursor: onClick ? 'pointer' : 'default',
      display: 'flex', flexDirection: 'column', gap: 6,
      minWidth: 90, transition: 'border-color 0.15s',
      textAlign: 'left',
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = color + '33'; }}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
    >
      <Icon size={13} color={color} weight="duotone" style={{ opacity: 0.7 }} />
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
          color: 'var(--tx)', lineHeight: 1, letterSpacing: '-0.03em',
        }}>{value}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--tx3)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3,
        }}>{label}</div>
      </div>
    </button>
  );
}

/* ── Tiny section header inside glass cards ── */
function GlassHeader({ icon: Icon, title, action, onAction }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 8,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <Icon size={10} weight="duotone" /> {title}
      </span>
      {action && (
        <button onClick={onAction} style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--acc)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
          background: 'none', border: 'none', padding: 0, opacity: 0.7,
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
        >
          {action} <ArrowRight size={9} />
        </button>
      )}
    </div>
  );
}

/* ── Reference row (compact) ── */
function RefRow({ reference: r, onClick }) {
  const tc = TC[r.type] || '#8A8680';
  const tl = TL[r.type] || r.type;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0', borderBottom: '1px solid var(--brd)',
      cursor: 'pointer',
    }}>
      <div style={{ width: 3, height: 20, borderRadius: 2, background: tc, flexShrink: 0, opacity: 0.6 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--tx)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{r.title}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', marginTop: 1 }}>
          {r.authors ? r.authors.split(',')[0].trim() : '—'}{r.year ? ` · ${r.year}` : ''}
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 8, color: tc,
        background: tc + '14', border: `1px solid ${tc}22`,
        borderRadius: 3, padding: '1px 5px', flexShrink: 0,
      }}>{tl}</span>
    </div>
  );
}

/* ── Radar row (compact) ── */
function RadarRow({ item }) {
  const score = item.relevanceScore || 0;
  const sc = score >= 70 ? '#4ADE80' : score >= 40 ? '#D4A030' : '#8A8680';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 0', borderBottom: '1px solid var(--brd)',
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: sc, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--tx)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.title}</div>
      </div>
      {score > 0 && <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700,
        color: sc, flexShrink: 0,
      }}>{score}%</span>}
    </div>
  );
}

/* ── Doc row (compact) ── */
function DocRow({ doc, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0', borderBottom: '1px solid var(--brd)',
      cursor: 'pointer',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--tx)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{doc.title || 'Sem título'}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--tx3)', marginTop: 1 }}>
          {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('pt-BR') : '—'}
        </div>
      </div>
      <ArrowUpRight size={10} color="var(--tx3)" style={{ flexShrink: 0 }} />
    </div>
  );
}

/* ── Read progress gauge (small) ── */
function ReadGauge({ pct, read, total }) {
  const r = 22, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={52} height={52} style={{ flexShrink: 0 }}>
        <circle cx={26} cy={26} r={r} fill="none" stroke="var(--glass-border)" strokeWidth={4} />
        <circle cx={26} cy={26} r={r} fill="none"
          stroke={pct > 60 ? '#4ADE80' : 'var(--acc)'} strokeWidth={4}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x={26} y={26} textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, fill: 'var(--tx)' }}>
          {pct}%
        </text>
      </svg>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
          color: 'var(--tx)', lineHeight: 1,
        }}>{read}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--tx3)', marginTop: 2 }}>
          de {total} lidos
        </div>
      </div>
    </div>
  );
}

/* ── Type distribution mini bars ── */
function TypeBar({ refs }) {
  const counts = {};
  refs.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = sorted[0]?.[1] || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {sorted.map(([type, count]) => {
        const tc = TC[type] || '#8A8680';
        const tl = TL[type] || type;
        return (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--tx3)',
              width: 36, textAlign: 'right', flexShrink: 0,
            }}>{tl}</span>
            <div style={{ flex: 1, height: 3, background: 'var(--glass-border)', borderRadius: 2 }}>
              <div style={{
                width: `${(count / max) * 100}%`, height: '100%',
                background: tc, borderRadius: 2, opacity: 0.7,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--tx3)', width: 14, flexShrink: 0,
            }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HOME — graph-centric layout com glass overlays
   ══════════════════════════════════════════════════════════ */
export function Home({ profileId }) {
  const navigate = useNavigate();
  const profile = useProfile();
  const references = useReferences(profileId);
  const documents = useDocuments(profileId);
  const radarItems = useRadarItems(profileId);
  const radarStats = useRadarStats(profileId);
  const [selectedNode, setSelectedNode] = useState(null);

  const refs = references || [];
  const docs = documents || [];
  const radar = radarItems || [];

  const totalRefs = refs.length;
  const readRefs = refs.filter(r => r.isRead).length;
  const favRefs = refs.filter(r => r.isFavorite).length;
  const unreadRadar = radar.filter(i => !i.isRead && !i.isDismissed).length;
  const readPct = totalRefs > 0 ? Math.round((readRefs / totalRefs) * 100) : 0;

  const now = new Date();
  const thisWeekRefs = refs.filter(r => {
    const d = new Date(r.createdAt || 0);
    return (now - d) / (1000 * 60 * 60 * 24) <= 7;
  }).length;

  const recentRefs = [...refs]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 3);

  const topRadar = [...radar]
    .filter(i => !i.isRead && !i.isDismissed)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 4);

  const firstName = profile?.name?.split(' ')[0] || 'Pesquisador';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="animate-fade-in" style={{
      position: 'relative',
      height: 'calc(100vh - 40px)',
      overflow: 'hidden',
    }}>
      {/* ── Radial glow de fundo ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 55% 45% at 50% 48%, rgba(212,160,48,0.05) 0%, transparent 70%)',
      }} />

      {/* ── Grafo ocupa TUDO — fundo total ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
      }}>
        <ReferenceGraph
          references={refs}
          profileId={profileId}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
      </div>

      {/* ── Greeting (top left, floating sobre o grafo) ── */}
      <div style={{
        position: 'absolute', top: 18, left: 18, zIndex: 10,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'clamp(1.3rem, 2vw, 1.75rem)', color: 'var(--tx)',
          lineHeight: 1.15, letterSpacing: '-0.03em',
        }}>
          {greeting}, <span style={{ color: 'var(--acc)' }}>{firstName}</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--tx3)', marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {thisWeekRefs > 0 && <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: 'var(--acc)', fontWeight: 600 }}>+{thisWeekRefs} refs esta semana</span>
          </>}
        </div>
      </div>

      {/* ── Stat chips (top right, floating) ── */}
      <div style={{
        position: 'absolute', top: 18, right: 18, zIndex: 10,
        display: 'flex', gap: 6,
      }}>
        <StatChip label="referências" value={totalRefs} color="var(--acc)" icon={Books} onClick={() => navigate('/acervo')} />
        <StatChip label="lidos" value={readRefs} color="#4ADE80" icon={BookOpenText} />
        <StatChip label="favoritos" value={favRefs} color="#F472B6" icon={Star} />
        <StatChip label="radar" value={unreadRadar} color="#60A5FA" icon={Lightning} onClick={() => navigate('/farol')} />
      </div>

      {/* ── Cards flutuando na base, sobre o grafo ── */}
      <div style={{
        position: 'absolute', bottom: 18, left: 18, right: 18, zIndex: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}>
        {/* Refs recentes */}
        <Glass>
          <GlassHeader icon={Books} title="referências recentes" action="acervo" onAction={() => navigate('/acervo')} />
          {recentRefs.length > 0 ? recentRefs.map(r => (
            <RefRow key={r.id} reference={r} onClick={() => navigate('/acervo')} />
          )) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', padding: '14px 0', textAlign: 'center' }}>
              nenhuma referência ainda
            </div>
          )}
        </Glass>

        {/* Progresso + Tipo */}
        <Glass>
          <GlassHeader icon={Eye} title="progresso de leitura" />
          <ReadGauge pct={readPct} read={readRefs} total={totalRefs} />
          {refs.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--brd)' }}>
              <TypeBar refs={refs} />
            </div>
          )}
        </Glass>

        {/* Radar */}
        <Glass>
          <GlassHeader icon={Lightning} title="radar" action="farol" onAction={() => navigate('/farol')} />
          {radarStats && (
            <div style={{
              display: 'flex', gap: 10, marginBottom: 6,
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)',
            }}>
              <span><strong style={{ color: 'var(--acc)' }}>{radarStats.total || 0}</strong> itens</span>
              <span><strong style={{ color: '#4ADE80' }}>{radarStats.read || 0}</strong> lidos</span>
              <span>avg <strong style={{ color: 'var(--tx2)' }}>{radarStats.avgRelevance || 0}%</strong></span>
            </div>
          )}
          {topRadar.length > 0 ? topRadar.map(item => (
            <RadarRow key={item.id} item={item} />
          )) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', padding: '14px 0', textAlign: 'center' }}>
              sem novidades
            </div>
          )}
        </Glass>

        {/* Bancada */}
        <Glass>
          <GlassHeader icon={NotePencil} title="bancada" action="docs" onAction={() => navigate('/bancada')} />
          {recentDocs.length > 0 ? recentDocs.map(doc => (
            <DocRow key={doc.id} doc={doc} onClick={() => navigate('/bancada')} />
          )) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', padding: '14px 0', textAlign: 'center' }}>
              nenhum documento
            </div>
          )}
        </Glass>
      </div>
    </div>
  );
}