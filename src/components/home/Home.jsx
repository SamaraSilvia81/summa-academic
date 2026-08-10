import { useNavigate } from 'react-router-dom';
import {
  Books, Lightning, NotePencil, Star, ArrowRight,
  BookOpenText, Eye, Graph, ArrowUpRight,
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

function StatCard({ label, value, icon: Icon, color, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: '1 1 0', minWidth: 0,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '18px 20px 16px',
      background: 'var(--bg2)', border: '1px solid var(--brd)',
      borderRadius: 12, cursor: onClick ? 'pointer' : 'default',
      textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s',
      gap: 12,
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = color + '44'; e.currentTarget.style.boxShadow = `0 4px 20px ${color}10`; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: color + '14', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={color} weight="duotone" />
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800,
          color: 'var(--tx)', lineHeight: 1, letterSpacing: '-0.03em',
        }}>{value}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)',
          letterSpacing: '0.04em', marginTop: 4,
        }}>{label}</div>
        {sub && <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: color,
          marginTop: 3, opacity: 0.75,
        }}>{sub}</div>}
      </div>
    </button>
  );
}

function RefRow({ reference: r, onClick }) {
  const tc = TC[r.type] || '#8A8680';
  const tl = TL[r.type] || r.type;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0', borderBottom: '1px solid var(--brd)',
      cursor: 'pointer', transition: 'padding-left 0.12s',
    }}
      onMouseEnter={e => e.currentTarget.style.paddingLeft = '5px'}
      onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
    >
      <div style={{ width: 3, height: 28, borderRadius: 2, background: tc, flexShrink: 0, opacity: 0.7 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--tx)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{r.title}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>
          {r.authors ? r.authors.split(',')[0].trim() : '—'}{r.year ? ` · ${r.year}` : ''}
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, color: tc,
        background: tc + '14', border: `1px solid ${tc}28`,
        borderRadius: 3, padding: '2px 6px', flexShrink: 0,
      }}>{tl}</span>
      {r.isFavorite && <Star size={10} weight="fill" color="#D4A030" style={{ flexShrink: 0 }} />}
    </div>
  );
}

function RadarRow({ item }) {
  const score = item.relevanceScore || 0;
  const sc = score >= 70 ? '#4ADE80' : score >= 40 ? '#D4A030' : '#8A8680';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '9px 0', borderBottom: '1px solid var(--brd)',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: sc, flexShrink: 0, marginTop: 4,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--tx)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.title}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', marginTop: 1 }}>
          {item.source || item.type}
        </div>
      </div>
      {score > 0 && <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        color: sc, flexShrink: 0, paddingTop: 1,
      }}>{score}%</span>}
    </div>
  );
}

function DocRow({ doc, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0', borderBottom: '1px solid var(--brd)',
      cursor: 'pointer', transition: 'padding-left 0.12s',
    }}
      onMouseEnter={e => e.currentTarget.style.paddingLeft = '5px'}
      onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--tx)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{doc.title || 'Sem título'}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', marginTop: 2 }}>
          {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('pt-BR') : '—'}
          {doc.template ? ` · ${doc.template}` : ''}
        </div>
      </div>
      <ArrowUpRight size={12} color="var(--tx3)" style={{ flexShrink: 0 }} />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, action, onAction, meta }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon size={11} weight="duotone" /> {title}
        {meta && <span style={{ color: 'var(--tx3)', fontWeight: 400, opacity: 0.6 }}>{meta}</span>}
      </span>
      {action && (
        <button onClick={onAction} style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--acc)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
          background: 'none', border: 'none', padding: 0, opacity: 0.8,
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
        >
          {action} <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--brd)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column',
      ...style,
    }}>
      {children}
    </div>
  );
}

function ReadGauge({ pct }) {
  const r = 26, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={66} height={66} style={{ flexShrink: 0 }}>
      <circle cx={33} cy={33} r={r} fill="none" stroke="var(--bg4)" strokeWidth={5} />
      <circle cx={33} cy={33} r={r} fill="none"
        stroke={pct > 60 ? '#4ADE80' : 'var(--acc)'} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={33} y={33} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, fill: 'var(--tx)' }}>
        {pct}%
      </text>
    </svg>
  );
}

function TypeBar({ refs }) {
  const counts = {};
  refs.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted[0]?.[1] || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {sorted.map(([type, count]) => {
        const tc = TC[type] || '#8A8680';
        const tl = TL[type] || type;
        return (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)',
              width: 44, textAlign: 'right', flexShrink: 0,
            }}>{tl}</span>
            <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2 }}>
              <div style={{
                width: `${(count / max) * 100}%`, height: '100%',
                background: tc, borderRadius: 2, opacity: 0.75,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', width: 16, flexShrink: 0,
            }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Home({ profileId }) {
  const navigate = useNavigate();
  const profile = useProfile();
  const references = useReferences(profileId);
  const documents = useDocuments(profileId);
  const radarItems = useRadarItems(profileId);
  const radarStats = useRadarStats(profileId);

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
    .slice(0, 6);

  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 4);

  const topRadar = [...radar]
    .filter(i => !i.isRead && !i.isDismissed)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 5);

  const firstName = profile?.name?.split(' ')[0] || 'Pesquisador';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 48px', overflow: 'hidden' }}>

      {/* ── Greeting ── */}
      <div style={{ padding: '28px 0 20px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'clamp(1.7rem, 2.6vw, 2.2rem)', color: 'var(--tx)',
          lineHeight: 1.15, letterSpacing: '-0.03em',
        }}>
          {greeting}, <span style={{ color: 'var(--acc)' }}>{firstName}</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 5,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {thisWeekRefs > 0 && <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: 'var(--acc)', fontWeight: 600 }}>+{thisWeekRefs} refs esta semana</span>
          </>}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <StatCard label="referências" value={totalRefs} color="var(--acc)" icon={Books} onClick={() => navigate('/acervo')} />
        <StatCard label="lidos" value={readRefs} color="#4ADE80" icon={BookOpenText}
          sub={readPct > 0 ? `${readPct}% do acervo` : undefined} />
        <StatCard label="favoritos" value={favRefs} color="#F472B6" icon={Star} />
        <StatCard label="novidades" value={unreadRadar} color="#60A5FA" icon={Lightning}
          sub={unreadRadar > 0 ? 'não lidas' : undefined}
          onClick={() => navigate('/farol')} />
      </div>

      {/* ── Layout 3fr + 2fr ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12, alignItems: 'start' }}>

        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

          {/* Grafo — ocupa a largura disponível sem overflow */}
          <Card style={{ padding: '18px 20px 14px' }}>
            <SectionHeader
              icon={Graph} title="mapa de referências"
              action="ver acervo" onAction={() => navigate('/acervo')}
              meta={refs.length > 0 ? ` · ${refs.length} nós` : undefined}
            />
            {/* wrapper com overflow hidden pra conter o SVG fixo do grafo */}
            <div style={{ overflow: 'hidden', borderRadius: 8, margin: '0 -2px' }}>
              <ReferenceGraph references={refs} profileId={profileId} />
            </div>
          </Card>

          {/* Refs recentes */}
          <Card>
            <SectionHeader icon={Books} title="referências recentes" action="ver acervo" onAction={() => navigate('/acervo')} />
            {recentRefs.length > 0 ? recentRefs.map(r => (
              <RefRow key={r.id} reference={r} onClick={() => navigate('/acervo')} />
            )) : (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
                padding: '20px 0', textAlign: 'center',
              }}>nenhuma referência ainda</div>
            )}
          </Card>

          {/* Bancada */}
          <Card>
            <SectionHeader icon={NotePencil} title="bancada" action="ver docs" onAction={() => navigate('/bancada')} />
            {recentDocs.length > 0 ? recentDocs.map(doc => (
              <DocRow key={doc.id} doc={doc} onClick={() => navigate('/bancada')} />
            )) : (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
                padding: '20px 0', textAlign: 'center',
              }}>nenhum documento</div>
            )}
          </Card>
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

          {/* Progresso */}
          <Card>
            <SectionHeader icon={Eye} title="progresso de leitura" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ReadGauge pct={readPct} />
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
                  color: 'var(--tx)', lineHeight: 1,
                }}>{readRefs} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--tx3)' }}>lidos</span></div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', marginTop: 3 }}>
                  {totalRefs - readRefs} pendentes
                </div>
              </div>
            </div>
          </Card>

          {/* Por tipo */}
          {refs.length > 0 && (
            <Card>
              <SectionHeader icon={Graph} title="por tipo" action="acervo" onAction={() => navigate('/acervo')} />
              <TypeBar refs={refs} />
            </Card>
          )}

          {/* Radar */}
          <Card>
            <SectionHeader icon={Lightning} title="radar" action="ver farol" onAction={() => navigate('/farol')} />
            {radarStats && (
              <div style={{
                display: 'flex', gap: 12, marginBottom: 8,
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)',
              }}>
                <span><strong style={{ color: 'var(--acc)' }}>{radarStats.total || 0}</strong> itens</span>
                <span><strong style={{ color: '#4ADE80' }}>{radarStats.read || 0}</strong> lidos</span>
                <span>avg <strong style={{ color: 'var(--tx2)' }}>{radarStats.avgRelevance || 0}%</strong></span>
              </div>
            )}
            {topRadar.length > 0 ? topRadar.map(item => (
              <RadarRow key={item.id} item={item} />
            )) : (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
                padding: '20px 0', textAlign: 'center',
              }}>sem novidades</div>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}