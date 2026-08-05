import { useEffect, useRef, useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  ArrowsClockwise, BookmarkSimple, X, ArrowSquareOut,
  Funnel, ChartBar, Newspaper, Lightning,
  CalendarBlank, Tag, ArrowUp, ArrowRight,
} from '@phosphor-icons/react';
import { useRadarItems, useRadarStats, useNotes, useRadarCfps, useRadarFetch } from '../../hooks/useData';
import { dismissRadarItem, markRadarItemRead, toggleRadarSave } from '../../store/slices/dataSlice';
import { keyToLabel } from '../../lib/sourcesConfig';

// ── Paleta de tipos ──────────────────────────────────────────────
const TYPE_META = {
  paper:  { label: 'Paper',   color: '#D4A030', gradient: 'linear-gradient(135deg, #2a1d00 0%, #1a1200 60%, #0e1119 100%)' },
  post:   { label: 'Artigo',  color: '#7B9EE0', gradient: 'linear-gradient(135deg, #0d1a2e 0%, #081424 60%, #0e1119 100%)' },
  thread: { label: 'Thread',  color: '#A07BD4', gradient: 'linear-gradient(135deg, #1a0d2e 0%, #12081e 60%, #0e1119 100%)' },
  cfp:    { label: 'CFP',     color: '#4ADE80', gradient: 'linear-gradient(135deg, #0d2e1a 0%, #082414 60%, #0e1119 100%)' },
  news:   { label: 'Notícia', color: '#F87171', gradient: 'linear-gradient(135deg, #2e0d0d 0%, #240808 60%, #0e1119 100%)' },
};

// ── Helpers ──────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'dia';
  if (h < 18) return 'tarde';
  return 'noite';
}
function getWeekNumber() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((d - start) / (7 * 24 * 60 * 60 * 1000));
}
function formatDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
function timeAgo(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  const diff = Date.now() - dt.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d atrás`;
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ── Componente principal ─────────────────────────────────────────
export function Farol({ profileId }) {
  const items    = useRadarItems(profileId);
  const stats    = useRadarStats(profileId);
  const notes    = useNotes(profileId, 'np');
  const cfps     = useRadarCfps(profileId);

  const { run: runRadarFetch, status: fetchStatus, lastFetch } = useRadarFetch(profileId);
  const isFetching = fetchStatus === 'loading';

  const autoFetchedFor = useRef(null);
  useEffect(() => {
    if (!profileId || autoFetchedFor.current === profileId) return;
    autoFetchedFor.current = profileId;
    runRadarFetch(false);
  }, [profileId, runRadarFetch]);

  // ── View state ──────────────────────────────────────────────────
  const [view, setView] = useState('feed');
  const [filterType,   setFilterType]   = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDate,   setFilterDate]   = useState('all');
  const [sortBy,       setSortBy]       = useState('date');
  const [showFilters,  setShowFilters]  = useState(false);

  // ── Consolidar todos os itens ───────────────────────────────────
  const allItems = useMemo(() => {
    const base = items || [];
    const cfpItems = (cfps || []).map(c => ({ ...c, type: c.type || 'cfp' }));
    const merged = [...base, ...cfpItems.filter(c => !base.find(b => b.id === c.id))];
    return merged.filter(i => !i.isDismissed);
  }, [items, cfps]);

  // Contagens por tipo para a category bar
  const typeCounts = useMemo(() => {
    const counts = {};
    allItems.forEach(i => {
      const t = i.type || 'outro';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [allItems]);

  // Fontes únicas
  const sourcesPresent = useMemo(() =>
    [...new Set(allItems.map(i => i.source).filter(Boolean))], [allItems]);

  // ── Filtragem + ordenação ───────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allItems;
    if (filterType !== 'all')   list = list.filter(i => i.type === filterType);
    if (filterSource !== 'all') list = list.filter(i => i.source === filterSource);
    if (filterDate !== 'all') {
      const now = Date.now();
      const limits = { today: 86400000, week: 604800000, month: 2592000000 };
      const limit = limits[filterDate] || Infinity;
      list = list.filter(i => {
        const t = i.publishedAt ? new Date(i.publishedAt).getTime() : (i.fetchedAt ? new Date(i.fetchedAt).getTime() : 0);
        return now - t <= limit;
      });
    }
    if (sortBy === 'relevance') {
      list = [...list].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    } else {
      list = [...list].sort((a, b) => {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : (a.fetchedAt ? new Date(a.fetchedAt).getTime() : 0);
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : (b.fetchedAt ? new Date(b.fetchedAt).getTime() : 0);
        return tb - ta;
      });
    }
    return list;
  }, [allItems, filterType, filterSource, filterDate, sortBy]);

  const unread = filtered.filter(i => !i.isRead).length;
  const saved  = allItems.filter(i => i.isSaved);

  // ── Dashboard stats ─────────────────────────────────────────────
  const dashStats = useMemo(() => {
    const bySource = {};
    const byType   = {};
    const byDay    = {};
    allItems.forEach(i => {
      bySource[i.source || 'outros'] = (bySource[i.source || 'outros'] || 0) + 1;
      byType[i.type || 'outro']      = (byType[i.type || 'outro']     || 0) + 1;
      const day = i.publishedAt
        ? new Date(i.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : 'sem data';
      byDay[day] = (byDay[day] || 0) + 1;
    });
    const avgRel = allItems.length
      ? Math.round(allItems.reduce((s, i) => s + (i.relevanceScore || 0), 0) / allItems.length)
      : 0;
    return { bySource, byType, byDay, avgRel };
  }, [allItems]);

  // ── Categorias pra category bar ─────────────────────────────────
  const CATEGORY_BAR = [
    { key: 'all',    label: 'Todos',    count: allItems.length },
    { key: 'paper',  label: 'Papers',   count: typeCounts.paper  || 0 },
    { key: 'thread', label: 'Threads',  count: typeCounts.thread || 0 },
    { key: 'post',   label: 'Artigos',  count: typeCounts.post   || 0 },
    { key: 'cfp',    label: 'CFPs',     count: typeCounts.cfp    || 0 },
    { key: 'news',   label: 'Notícias', count: typeCounts.news   || 0 },
  ].filter(c => c.key === 'all' || c.count > 0);

  return (
    <div className="animate-fade-in">

      {/* ── Header tipográfico editorial ─────────────────────────── */}
      <FarolHeader unread={unread} lastFetch={lastFetch} />

      {/* ── Stats row ─────────────────────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
          <StatCard value={String(allItems.filter(i=>i.type==='paper').length).padStart(2,'0')} label="papers" />
          <StatCard value={String(allItems.filter(i=>i.type==='thread'||i.type==='post'||i.type==='news').length).padStart(2,'0')} label="notícias" />
          <StatCard value={String(allItems.filter(i=>i.type==='cfp').length).padStart(2,'0')} label="cfps" />
          <StatCard value={`${dashStats.avgRel}%`} label="relevância" />
        </div>
      )}

      {/* ── View toggle + atualizar ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: 3, border: '1px solid var(--brd)' }}>
          {[
            { key: 'feed',      icon: Newspaper, label: 'Feed' },
            { key: 'dashboard', icon: ChartBar,  label: 'Dashboard' },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setView(key)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              background: view === key ? 'var(--acc)' : 'transparent',
              color:      view === key ? 'var(--bg0)' : 'var(--tx3)',
              fontWeight: view === key ? 700 : 400, transition: 'all 0.15s',
            }}>
              <Icon size={13} weight={view === key ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowFilters(f => !f)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: showFilters ? 'var(--acc-bg)' : 'var(--bg2)',
            border: `1px solid ${showFilters ? 'var(--acc)' : 'var(--brd)'}`,
            borderRadius: 'var(--r-md)', padding: '5px 10px',
            color: showFilters ? 'var(--acc)' : 'var(--tx3)',
            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            <Funnel size={13} weight={showFilters ? 'fill' : 'regular'} />
            Filtros
            {(filterType !== 'all' || filterSource !== 'all' || filterDate !== 'all') && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc)', display: 'inline-block' }} />
            )}
          </button>

          <button onClick={() => runRadarFetch(true)} disabled={isFetching} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg2)', border: '1px solid var(--brd)',
            borderRadius: 'var(--r-md)', padding: '5px 10px',
            color: 'var(--tx3)', cursor: isFetching ? 'default' : 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 12,
            opacity: isFetching ? 0.6 : 1,
          }}>
            <ArrowsClockwise size={13} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'buscando...' : 'atualizar'}
          </button>
        </div>
      </div>

      {/* ── Category bar horizontal scrollável ───────────────────── */}
      <CategoryBar
        categories={CATEGORY_BAR}
        active={filterType}
        onChange={setFilterType}
      />

      {/* ── Painel de filtros avançados (collapse) ───────────────── */}
      {showFilters && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--brd)',
          borderRadius: 'var(--r-xl)', padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FilterGroup label="Fonte" icon={Lightning}>
              <FilterChip active={filterSource === 'all'} onClick={() => setFilterSource('all')} label="Todas" />
              {sourcesPresent.map(s => (
                <FilterChip key={s} active={filterSource === s}
                  onClick={() => setFilterSource(s)} label={keyToLabel(s)} />
              ))}
            </FilterGroup>
            <FilterGroup label="Data" icon={CalendarBlank}>
              {[
                { key: 'all',   label: 'Qualquer' },
                { key: 'today', label: 'Hoje' },
                { key: 'week',  label: 'Esta semana' },
                { key: 'month', label: 'Este mês' },
              ].map(({ key, label }) => (
                <FilterChip key={key} active={filterDate === key}
                  onClick={() => setFilterDate(key)} label={label} />
              ))}
            </FilterGroup>
            <FilterGroup label="Ordenar" icon={ArrowUp}>
              <FilterChip active={sortBy === 'date'}      onClick={() => setSortBy('date')}      label="Mais recente" />
              <FilterChip active={sortBy === 'relevance'} onClick={() => setSortBy('relevance')} label="Mais relevante" />
            </FilterGroup>
          </div>
          {(filterType !== 'all' || filterSource !== 'all' || filterDate !== 'all') && (
            <button onClick={() => { setFilterType('all'); setFilterSource('all'); setFilterDate('all'); }}
              style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, textDecoration: 'underline' }}>
              limpar filtros
            </button>
          )}
        </div>
      )}

      {/* lastFetch info */}
      {lastFetch && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginBottom: 10 }}>
          {lastFetch.count > 0
            ? `+${lastFetch.count} ${lastFetch.count === 1 ? 'item novo' : 'itens novos'}`
            : 'nenhum item novo na última busca'}
          {lastFetch.errors?.length > 0 && ` · ${lastFetch.errors.length} fonte(s) falharam`}
        </div>
      )}

      {/* ── VIEWS ─────────────────────────────────────────────────── */}
      {view === 'feed' ? (
        <FeedView items={filtered} notes={notes} saved={saved} profileId={profileId} />
      ) : (
        <DashboardView stats={dashStats} allItems={allItems} />
      )}
    </div>
  );
}

// ── Header editorial tipográfico ──────────────────────────────────
function FarolHeader({ unread, lastFetch }) {
  const now = new Date();
  const weekNum = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{
      borderBottom: '2px solid var(--tx)',
      paddingBottom: 10,
      marginBottom: 14,
      marginTop: 14,
      position: 'relative',
    }}>
      {/* Top line: mono metadata */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.14em',
          color: 'var(--tx3)',
        }}>
          farol://radar · semana {String(weekNum).padStart(2, '0')}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--tx3)', letterSpacing: '0.04em',
        }}>
          {dateStr}
        </span>
      </div>

      {/* Título principal em serif */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1 style={{
          fontFamily: 'var(--font-quote)',
          fontWeight: 700, fontSize: 36,
          lineHeight: 1, letterSpacing: '-0.02em',
          color: 'var(--tx)',
          margin: 0,
        }}>
          Farol
        </h1>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--acc)', letterSpacing: '0.04em',
        }}>
          {unread > 0 ? `${unread} não lidos` : 'tudo em dia'}
        </span>
      </div>

      {/* Subtítulo / tagline */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--tx3)', marginTop: 3,
        letterSpacing: '0.03em',
      }}>
        Monitor de literatura acadêmica e comunidade de pesquisa
      </div>

      {/* Thin accent line */}
      <div style={{
        position: 'absolute', bottom: -2, left: 0,
        width: 48, height: 2,
        background: 'var(--acc)',
      }} />
    </div>
  );
}

// ── Category bar horizontal scrollável ───────────────────────────
function CategoryBar({ categories, active, onChange }) {
  return (
    <div style={{
      overflowX: 'auto', display: 'flex', gap: 0,
      borderBottom: '1px solid var(--brd)',
      marginBottom: 14,
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}
    className="hide-scrollbar"
    >
      {categories.map(({ key, label, count }, idx) => {
        const isActive = active === key;
        const color = TYPE_META[key]?.color || 'var(--acc)';
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'baseline', gap: 5,
            padding: '8px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: `2px solid ${isActive ? color : 'transparent'}`,
            marginBottom: -1,
            transition: 'all 0.15s',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: isActive ? 700 : 400,
              fontSize: 12,
              color: isActive ? color : 'var(--tx3)',
              letterSpacing: '0.02em',
              transition: 'color 0.15s',
            }}>
              {label}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: isActive ? color : 'var(--tx3)',
              opacity: isActive ? 0.8 : 0.5,
              fontWeight: 700,
            }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Feed view: grid magazine assimétrico ──────────────────────────
function FeedView({ items, notes, saved, profileId }) {
  if (!items || items.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        fontFamily: 'var(--font-mono)', color: 'var(--tx3)', fontSize: 13,
      }}>
        <Lightning size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
        <div>Nenhum item encontrado.</div>
        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.6 }}>
          Ajuste os filtros ou clique em "atualizar".
        </div>
      </div>
    );
  }

  const hero   = items[0];
  const beside = items.slice(1, 3);   // 2 cards à direita do hero
  const row2   = items.slice(3, 7);   // grid 2 colunas
  const rest   = items.slice(7);      // latest news compactos

  return (
    <div>
      {/* ── Seção principal: 2/3 + 1/3 ─────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 10,
        marginBottom: 16,
        alignItems: 'stretch',
      }}>
        {/* Hero card */}
        <HeroCard item={hero} profileId={profileId} />

        {/* 2 cards empilhados à direita */}
        {beside.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {beside.map(item => (
              <MediumCard key={item.id} item={item} profileId={profileId} />
            ))}
          </div>
        )}
      </div>

      {/* ── Grid 2 colunas ─────────────────────────────────────── */}
      {row2.length > 0 && (
        <>
          <Divider label="em destaque" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {row2.map(item => <MediumCard key={item.id} item={item} profileId={profileId} />)}
          </div>
        </>
      )}

      {/* ── Latest News: compactos ─────────────────────────────── */}
      {rest.length > 0 && (
        <>
          <LatestNewsHeader count={rest.length} />
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--brd)',
            borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 16,
          }}>
            {rest.map((item, idx) => (
              <CompactRow key={item.id} item={item} profileId={profileId} last={idx === rest.length - 1} />
            ))}
          </div>
        </>
      )}

      {/* ── Reading List (salvos) ──────────────────────────────── */}
      {saved && saved.length > 0 && (
        <>
          <Divider label="lista de leitura" />
          <ReadingList items={saved} profileId={profileId} />
        </>
      )}

      {/* ── Notas de pesquisa ─────────────────────────────────── */}
      {notes && notes.length > 0 && (
        <>
          <Divider label="notas de pesquisa" />
          {notes.slice(0, 3).map(note => <NoteCard key={note.id} note={note} />)}
        </>
      )}
    </div>
  );
}

// ── Hero card com gradiente temático ─────────────────────────────
function HeroCard({ item, profileId }) {
  const dispatch = useDispatch();
  const typeMeta = TYPE_META[item.type] || { label: item.type, color: 'var(--acc)', gradient: 'var(--bg2)' };

  const handleClick = async () => {
    if (item.id && !item.isRead) await dispatch(markRadarItemRead({ profileId, id: item.id })).unwrap();
    if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
  };
  const handleSave = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(toggleRadarSave({ profileId, id: item.id })).unwrap();
  };
  const handleDismiss = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(dismissRadarItem({ profileId, id: item.id })).unwrap();
  };

  return (
    <div onClick={handleClick} style={{
      background: typeMeta.gradient || 'var(--bg2)',
      borderRadius: 'var(--r-xl)',
      border: `1px solid ${typeMeta.color}28`,
      padding: '24px 24px 20px',
      cursor: item.sourceUrl ? 'pointer' : 'default',
      opacity: item.isRead ? 0.7 : 1,
      position: 'relative',
      transition: 'border-color 0.2s, opacity 0.2s',
      display: 'flex', flexDirection: 'column', minHeight: 260,
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = typeMeta.color + '55'}
    onMouseLeave={e => e.currentTarget.style.borderColor = typeMeta.color + '28'}
    >
      {/* Badge tipo + fonte */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <TypePill type={item.type} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>
          {keyToLabel(item.source)}
        </span>
        {item.publishedAt && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginLeft: 'auto' }}>
            {timeAgo(item.publishedAt)}
          </span>
        )}
      </div>

      {/* Título hero em serif grande */}
      <div style={{
        fontFamily: 'var(--font-quote)',
        fontWeight: 700, fontSize: 22,
        lineHeight: 1.25, marginBottom: 10,
        color: 'var(--tx)', letterSpacing: '-0.01em',
        flex: 1,
      }}>
        {item.title}
      </div>

      {/* Autores */}
      {item.authors && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--tx3)', marginBottom: 10,
          letterSpacing: '0.02em',
        }}>
          {item.authors.split(',').slice(0, 3).join(', ')}{item.authors.split(',').length > 3 ? ' et al.' : ''}
        </div>
      )}

      {/* Resumo */}
      {item.summary && (
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 13,
          color: 'var(--tx2)', lineHeight: 1.6,
          marginBottom: 16,
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.summary}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RelevanceBadge score={item.relevanceScore} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ActionBtn onClick={handleSave} active={item.isSaved}>
            <BookmarkSimple size={14} weight={item.isSaved ? 'fill' : 'regular'} />
          </ActionBtn>
          <ActionBtn onClick={handleDismiss}><X size={14} /></ActionBtn>
          {/* Seta → canto inferior direito estilo editorial */}
          {item.sourceUrl && (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `1px solid ${typeMeta.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: typeMeta.color, marginLeft: 4,
            }}>
              <ArrowRight size={13} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card médio ────────────────────────────────────────────────────
function MediumCard({ item, profileId }) {
  const dispatch = useDispatch();
  const typeMeta = TYPE_META[item.type] || { label: item.type, color: 'var(--acc)' };

  const handleClick = async () => {
    if (item.id && !item.isRead) await dispatch(markRadarItemRead({ profileId, id: item.id })).unwrap();
    if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
  };
  const handleSave = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(toggleRadarSave({ profileId, id: item.id })).unwrap();
  };
  const handleDismiss = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(dismissRadarItem({ profileId, id: item.id })).unwrap();
  };

  return (
    <div onClick={handleClick} style={{
      background: 'var(--bg2)', borderRadius: 'var(--r-md)',
      border: '1px solid var(--brd)', padding: '16px 18px',
      cursor: item.sourceUrl ? 'pointer' : 'default',
      opacity: item.isRead ? 0.72 : 1, transition: 'border-color 0.2s',
      display: 'flex', flexDirection: 'column', gap: 10, flex: 1,
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = typeMeta.color + '40'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TypePill type={item.type} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', marginLeft: 'auto' }}>
          {timeAgo(item.publishedAt)}
        </span>
      </div>

      {/* Título em serif */}
      <div style={{
        fontFamily: 'var(--font-quote)', fontWeight: 700,
        fontSize: 15, lineHeight: 1.3, color: 'var(--tx)',
        display: '-webkit-box', WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
        flex: 1,
      }}>
        {item.title}
      </div>

      {item.authors && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>
          {item.authors.split(',').slice(0, 2).join(', ')}{item.authors.split(',').length > 2 ? ' et al.' : ''}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <RelevanceBadge score={item.relevanceScore} />
        <div style={{ display: 'flex', gap: 3 }}>
          <ActionBtn onClick={handleSave} active={item.isSaved}>
            <BookmarkSimple size={13} weight={item.isSaved ? 'fill' : 'regular'} />
          </ActionBtn>
          <ActionBtn onClick={handleDismiss}><X size={13} /></ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ── Latest News header ────────────────────────────────────────────
function LatestNewsHeader({ count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-quote)', fontWeight: 700,
          fontSize: 15, color: 'var(--tx)',
        }}>
          + Mais recentes
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)',
          letterSpacing: '0.04em',
        }}>
          atualizações em tempo real
        </span>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--tx3)',
      }}>
        {count} itens
      </span>
    </div>
  );
}

// ── Linha compacta (Latest News style) ───────────────────────────
function CompactRow({ item, profileId, last }) {
  const dispatch = useDispatch();
  const typeMeta = TYPE_META[item.type] || { label: item.type, color: 'var(--acc)' };

  const handleClick = async () => {
    if (item.id && !item.isRead) await dispatch(markRadarItemRead({ profileId, id: item.id })).unwrap();
    if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
  };
  const handleSave = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(toggleRadarSave({ profileId, id: item.id })).unwrap();
  };
  const handleDismiss = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(dismissRadarItem({ profileId, id: item.id })).unwrap();
  };

  return (
    <div onClick={handleClick} style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--brd)',
      cursor: item.sourceUrl ? 'pointer' : 'default',
      opacity: item.isRead ? 0.6 : 1, transition: 'background 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {!item.isRead && (
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acc)', flexShrink: 0 }} />
        )}
        {item.isRead && <span style={{ width: 5, flexShrink: 0 }} />}

        <TypePill type={item.type} compact />

        {/* Título em serif mesmo no compact */}
        <span style={{
          fontFamily: 'var(--font-quote)', fontWeight: 600, fontSize: 13,
          color: 'var(--tx)', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)' }}>
          {timeAgo(item.publishedAt)}
        </span>
        <RelevanceBadge score={item.relevanceScore} small />
        <ActionBtn onClick={handleSave} active={item.isSaved}>
          <BookmarkSimple size={12} weight={item.isSaved ? 'fill' : 'regular'} />
        </ActionBtn>
        <ActionBtn onClick={handleDismiss}><X size={12} /></ActionBtn>
      </div>
    </div>
  );
}

// ── Reading List (salvos) ─────────────────────────────────────────
function ReadingList({ items, profileId }) {
  const dispatch = useDispatch();

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--acc)18',
      borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px 10px',
        borderBottom: '1px solid var(--brd)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <BookmarkSimple size={13} weight="fill" style={{ color: 'var(--acc)' }} />
        <span style={{
          fontFamily: 'var(--font-quote)', fontWeight: 700,
          fontSize: 13, color: 'var(--tx)',
        }}>
          Reading List
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--tx3)', marginLeft: 2,
        }}>
          {items.length} salvo{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Items compactos */}
      {items.slice(0, 6).map((item, idx) => {
        const typeMeta = TYPE_META[item.type] || { color: 'var(--acc)' };
        const handleClick = async () => {
          if (item.id && !item.isRead) await dispatch(markRadarItemRead({ profileId, id: item.id })).unwrap();
          if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
        };
        const handleUnsave = async (e) => {
          e.stopPropagation();
          if (item.id) await dispatch(toggleRadarSave({ profileId, id: item.id })).unwrap();
        };
        return (
          <div key={item.id} onClick={handleClick} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 16px',
            borderBottom: idx === Math.min(items.length, 6) - 1 ? 'none' : '1px solid var(--brd)',
            cursor: item.sourceUrl ? 'pointer' : 'default',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{
              width: 3, height: 24, borderRadius: 2,
              background: typeMeta.color, flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--font-quote)', fontWeight: 600, fontSize: 12,
              color: 'var(--tx)', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.title}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', flexShrink: 0 }}>
              {timeAgo(item.publishedAt)}
            </span>
            <ActionBtn onClick={handleUnsave} active>
              <BookmarkSimple size={12} weight="fill" />
            </ActionBtn>
          </div>
        );
      })}
    </div>
  );
}

// ── Type pill ──────────────────────────────────────────────────────
function TypePill({ type, compact }) {
  const meta = TYPE_META[type] || { label: type || '?', color: 'var(--acc)' };
  const label = compact
    ? (meta.label || type || '').slice(0, 4).toUpperCase()
    : meta.label;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
      textTransform: compact ? 'uppercase' : 'none',
      letterSpacing: compact ? '0.05em' : '0.02em',
      padding: compact ? '1px 5px' : '2px 8px',
      borderRadius: 3, flexShrink: 0,
      background: meta.color + '20', color: meta.color,
      border: `1px solid ${meta.color}30`,
    }}>
      {label}
    </span>
  );
}

// ── Dashboard view ────────────────────────────────────────────────
function DashboardView({ stats, allItems }) {
  const maxSource = Math.max(...Object.values(stats.bySource), 1);
  const maxType   = Math.max(...Object.values(stats.byType), 1);
  const recentDays = Object.entries(stats.byDay).filter(([d]) => d !== 'sem data').slice(-7);
  const maxDay = Math.max(...recentDays.map(([,v]) => v), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <DashCard label="Total monitorado" value={allItems.length} />
        <DashCard label="Salvos" value={allItems.filter(i=>i.isSaved).length} accent />
        <DashCard label="Não lidos" value={allItems.filter(i=>!i.isRead).length} />
      </div>

      <ChartPanel title="Itens por fonte">
        {Object.entries(stats.bySource).sort((a,b)=>b[1]-a[1]).map(([src, count]) => (
          <BarRow key={src} label={keyToLabel(src)} value={count} max={maxSource} />
        ))}
      </ChartPanel>

      <ChartPanel title="Itens por tipo">
        {Object.entries(stats.byType).sort((a,b)=>b[1]-a[1]).map(([type, count]) => (
          <BarRow key={type} label={TYPE_META[type]?.label || type} value={count} max={maxType}
            color={TYPE_META[type]?.color} />
        ))}
      </ChartPanel>

      {recentDays.length > 0 && (
        <ChartPanel title="Publicações recentes (últimos 7 registros)">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, paddingTop: 8 }}>
            {recentDays.map(([day, count]) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', borderRadius: '3px 3px 0 0',
                  height: `${Math.round((count / maxDay) * 64)}px`,
                  background: 'var(--acc)', opacity: 0.75, minHeight: 4,
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
                  {day}
                </span>
              </div>
            ))}
          </div>
        </ChartPanel>
      )}

      <ChartPanel title="Top 5 por relevância">
        {[...allItems].sort((a,b)=>(b.relevanceScore||0)-(a.relevanceScore||0)).slice(0,5).map(item => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: '1px solid var(--brd)',
          }}>
            <RelevanceBadge score={item.relevanceScore} />
            <span style={{
              fontFamily: 'var(--font-quote)', fontSize: 13, fontWeight: 600,
              color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1,
            }}>{item.title}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', flexShrink: 0 }}>
              {keyToLabel(item.source)}
            </span>
          </div>
        ))}
      </ChartPanel>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--brd)',
      borderRadius: 'var(--r-md)', padding: '10px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20,
        color: 'var(--acc)', textShadow: '0 0 12px var(--acc-glow)',
        letterSpacing: '-0.02em',
      }}>{value}</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
        marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</div>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--brd)' }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--brd)' }} />
    </div>
  );
}

function RelevanceBadge({ score, small }) {
  if (!score && score !== 0) return null;
  const s = score || 0;
  const color = s >= 75 ? '#4ADE80' : s >= 50 ? 'var(--acc)' : 'var(--tx3)';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: small ? 10 : 12, fontWeight: 700,
      padding: small ? '1px 4px' : '2px 7px', borderRadius: 3,
      background: color + '18', color,
      border: `1px dashed ${color}44`,
    }}>{s}%</span>
  );
}

function ActionBtn({ children, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: active ? 'var(--acc)' : 'var(--tx3)',
      padding: 3, display: 'flex', alignItems: 'center',
      borderRadius: 3, transition: 'color 0.15s',
    }}>{children}</button>
  );
}

function FilterGroup({ label, icon: Icon, children }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--tx3)', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {Icon && <Icon size={11} />}{label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 9px', borderRadius: 20, fontSize: 11,
      fontFamily: 'var(--font-mono)', cursor: 'pointer',
      background: active ? 'var(--acc)' : 'var(--bg3)',
      color: active ? 'var(--bg0)' : 'var(--tx3)',
      border: `1px solid ${active ? 'var(--acc)' : 'var(--brd)'}`,
      fontWeight: active ? 700 : 400, transition: 'all 0.12s',
    }}>{label}</button>
  );
}

function DashCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${accent ? 'rgba(212,160,48,0.3)' : 'var(--brd)'}`,
      borderRadius: 'var(--r-md)', padding: '14px 16px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 800,
        color: accent ? 'var(--acc)' : 'var(--tx)', letterSpacing: '-0.03em',
      }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

function ChartPanel({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--brd)',
      borderRadius: 'var(--r-xl)', padding: '16px 18px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--acc)', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 3, height: 10, background: 'var(--acc)', borderRadius: 1, display: 'inline-block' }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function BarRow({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  const c = color || 'var(--acc)';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx2)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: c, opacity: 0.8, transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

function NoteCard({ note }) {
  return (
    <div style={{
      background: 'var(--bg2)', borderRadius: 'var(--r-md)',
      padding: '12px 14px', border: '1px solid var(--brd)', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          background: 'var(--acc)', color: 'var(--bg0)', padding: '2px 6px', borderRadius: 3,
        }}>NP</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)' }}>
          {note.createdAt ? new Date(note.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-quote)', fontSize: 14, lineHeight: 1.65,
        padding: '10px 12px', background: 'var(--bg1)',
        borderRadius: 'var(--r-md)', borderLeft: '2px solid var(--acc)',
        fontStyle: 'italic', color: 'var(--tx)',
      }}>{note.content}</div>
    </div>
  );
}