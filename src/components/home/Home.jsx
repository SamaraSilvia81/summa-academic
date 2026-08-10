import { useNavigate } from 'react-router-dom';
import {
  Books, Lightning, NotePencil, Star, ArrowRight,
  BookOpenText, Eye, FilePdf, Graph, Clock, Folder,
  TrendUp, CaretRight, CalendarBlank, House,
} from '@phosphor-icons/react';
import { useReferences, useDocuments, useRadarItems, useRadarStats, useProfile } from '../../hooks/useData';
import { ReferenceGraph } from './ReferenceGraph';

function StatCard({ label, value, color, icon: Icon, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '16px 18px', background: 'var(--bg2)',
      border: '1px solid var(--brd2)', borderLeft: `3px solid ${color}`,
      borderRadius: 8, flex: '1 1 140px', cursor: onClick ? 'pointer' : 'default',
      textAlign: 'left', transition: 'all 0.15s',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: color + '12', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={color} weight="duotone" />
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
          color: 'var(--tx)', lineHeight: 1, marginBottom: 2,
        }}>{value}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)',
          letterSpacing: '0.03em',
        }}>{label}</div>
        {sub && <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: color, marginTop: 3, opacity: 0.7,
        }}>{sub}</div>}
      </div>
    </button>
  );
}

function SectionHeader({ icon: Icon, title, action, onAction }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
        color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.06em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon size={13} weight="duotone" /> {title}
      </span>
      {action && (
        <button onClick={onAction} style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--acc)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
          background: 'none', border: 'none', padding: 0, opacity: 0.8,
        }}>
          {action} <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
}

function RefRow({ reference: r, onClick }) {
  const TC = {
    paper_read:'#D4A030', my_article:'#D4A030', dataset:'#4ADE80',
    book:'#F472B6', thesis:'#60A5FA', note:'#8A8680',
    post:'#7B9EE0', thread:'#A07BD4', news:'#F87171',
  };
  const TL = {
    paper_read:'paper', my_article:'meu art.', dataset:'dataset',
    book:'livro', thesis:'tese', note:'nota',
    post:'artigo', thread:'thread', news:'notícia',
  };
  const tc = TC[r.type] || '#8A8680';
  const tl = TL[r.type] || r.type;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
      borderBottom: '1px solid var(--brd)', cursor: 'pointer',
    }}
      onMouseEnter={e => e.currentTarget.style.paddingLeft = '4px'}
      onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--tx)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{r.title}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', marginTop: 2,
        }}>
          {r.authors ? r.authors.split(',')[0].trim() : '—'}{r.year ? ` · ${r.year}` : ''}
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, color: tc,
        background: tc + '15', border: `1px solid ${tc}33`,
        borderRadius: 3, padding: '2px 7px', flexShrink: 0,
      }}>{tl}</span>
      {r.isFavorite && <Star size={10} weight="fill" color="#D4A030" style={{ flexShrink: 0 }} />}
    </div>
  );
}

function RadarRow({ item }) {
  const score = item.relevanceScore || 0;
  const sc = score >= 70 ? '#4ADE80' : score >= 40 ? '#D4A030' : '#F87171';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0',
      borderBottom: '1px solid var(--brd)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: 'var(--acc)12', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Lightning size={12} color="var(--acc)" weight="fill" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--tx)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.title}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', marginTop: 2,
        }}>
          {item.source || item.type}
        </div>
      </div>
      {score > 0 && <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        color: sc, flexShrink: 0,
      }}>{score}%</span>}
    </div>
  );
}

function DocRow({ doc, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
      borderBottom: '1px solid var(--brd)', cursor: 'pointer',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: '#60A5FA12', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <NotePencil size={12} color="#60A5FA" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--tx)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{doc.title || 'Sem título'}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', marginTop: 2,
        }}>
          {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('pt-BR') : '—'}
          {doc.template ? ` · ${doc.template}` : ''}
        </div>
      </div>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--brd2)',
      borderRadius: 10, padding: '18px 20px',
      display: 'flex', flexDirection: 'column',
      ...style,
    }}>
      {children}
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
  const withFile = refs.filter(r => r.filePath).length;
  const unreadRadar = radar.filter(i => !i.isRead && !i.isDismissed).length;
  const readPct = totalRefs > 0 ? Math.round((readRefs / totalRefs) * 100) : 0;

  const recentRefs = [...refs]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 4);

  const topRadar = [...radar]
    .filter(i => !i.isRead && !i.isDismissed)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 4);

  const firstName = profile?.name?.split(' ')[0] || 'Pesquisador';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Quick activity summary
  const thisWeekRefs = refs.filter(r => {
    const d = new Date(r.createdAt || 0);
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, padding: '0 0 40px' }}>

      {/* ── Greeting ── */}
      <div style={{
        padding: '28px 0 6px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'var(--tx)',
            lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>
            {greeting}, <span style={{ color: 'var(--acc)' }}>{firstName}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 4,
          }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {thisWeekRefs > 0 && (
              <span style={{ color: 'var(--tx2)', marginLeft: 12 }}>
                +{thisWeekRefs} ref{thisWeekRefs > 1 ? 's' : ''} esta semana
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
        <StatCard label="referências" value={totalRefs} color="var(--acc)" icon={Books} onClick={() => navigate('/acervo')} />
        <StatCard label="lidos" value={readRefs} color="#4ADE80" icon={BookOpenText}
          sub={readPct > 0 ? `${readPct}% do acervo` : undefined} />
        <StatCard label="favoritos" value={favRefs} color="#F472B6" icon={Star} />
        <StatCard label="novidades" value={unreadRadar} color="#60A5FA" icon={Lightning}
          sub={unreadRadar > 0 ? 'não lidas' : undefined}
          onClick={() => navigate('/farol')} />
      </div>

      {/* ── Grafo de referências ── */}
      <Card style={{ marginBottom: 18, padding: '18px 20px 14px' }}>
        <SectionHeader icon={Graph} title="mapa de referências" action="ver acervo" onAction={() => navigate('/acervo')} />
        <ReferenceGraph references={refs} profileId={profileId} />
      </Card>

      {/* ── Progress bar ── */}
      <Card style={{ marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--acc)10', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Eye size={18} color="var(--acc)" weight="duotone" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx2)' }}>progresso de leitura</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--acc)', fontWeight: 700 }}>{readPct}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: Math.max(readPct, 1) + '%', height: '100%', borderRadius: 3,
              background: readPct > 0 ? 'linear-gradient(90deg, var(--acc), #4ADE80)' : 'var(--bg3)',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', marginTop: 4,
          }}>
            {readRefs} de {totalRefs} · {totalRefs - readRefs} pendentes
          </div>
        </div>
      </Card>

      {/* ── Grid principal ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
      }}>

        {/* Refs recentes — span full width */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <SectionHeader icon={Books} title="refs recentes" action="ver acervo" onAction={() => navigate('/acervo')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            {recentRefs.length > 0 ? recentRefs.map(r => (
              <RefRow key={r.id} reference={r} onClick={() => navigate('/acervo')} />
            )) : (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
                padding: '20px 0', textAlign: 'center', gridColumn: '1 / -1',
              }}>
                nenhuma referência ainda
              </div>
            )}
          </div>
        </Card>

        {/* Radar */}
        <Card>
          <SectionHeader icon={Lightning} title="radar" action="ver farol" onAction={() => navigate('/farol')} />
          {radarStats && (
            <div style={{
              display: 'flex', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--tx3)', marginBottom: 6,
            }}>
              <span><strong style={{ color: 'var(--acc)' }}>{radarStats.total || 0}</strong> itens</span>
              <span><strong style={{ color: '#4ADE80' }}>{radarStats.read || 0}</strong> lidos</span>
              <span>avg <strong style={{ color: 'var(--tx2)' }}>{radarStats.avgRelevance || 0}%</strong></span>
            </div>
          )}
          <div>
            {topRadar.length > 0 ? topRadar.map(item => (
              <RadarRow key={item.id} item={item} />
            )) : (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
                padding: '20px 0', textAlign: 'center',
              }}>sem novidades</div>
            )}
          </div>
        </Card>

        {/* Bancada */}
        <Card>
          <SectionHeader icon={NotePencil} title="bancada" action="ver docs" onAction={() => navigate('/bancada')} />
          <div>
            {recentDocs.length > 0 ? recentDocs.map(doc => (
              <DocRow key={doc.id} doc={doc} onClick={() => navigate('/bancada')} />
            )) : (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
                padding: '20px 0', textAlign: 'center',
              }}>nenhum documento</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}