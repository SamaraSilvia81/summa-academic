import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  ArrowsClockwise, BookmarkSimple, X, ArrowSquareOut,
  Funnel, ChartBar, Newspaper, Lightning,
  CalendarBlank, Tag, ArrowUp, ArrowDown, Minus,
} from '@phosphor-icons/react';
import { useRadarItems, useRadarStats, useNotes, useRadarCfps, useRadarFetch } from '../../hooks/useData';
import { dismissRadarItem, markRadarItemRead, toggleRadarSave } from '../../store/slices/dataSlice';

// ── Paleta de tipos ──────────────────────────────────────────────
const TYPE_META = {
  paper:  { label: 'Paper',   color: '#D4A030' },
  post:   { label: 'Artigo',  color: '#7B9EE0' },
  thread: { label: 'Thread',  color: '#A07BD4' },
  cfp:    { label: 'CFP',     color: '#4ADE80' },
  news:   { label: 'Notícia', color: '#F87171' },
};

// ── Metadados por fonte (cor + label + sigla pra placeholder) ────
const SOURCE_META = {
  arxiv:            { label: 'arXiv',            color: '#B7451F', short: 'arXiv',   hasThumb: false },
  semantic_scholar: { label: 'Semantic Scholar', color: '#1A6FBF', short: 'S2',      hasThumb: false },
  hackernews:       { label: 'Hacker News',      color: '#FF6600', short: 'HN',      hasThumb: true  },
  devto:            { label: 'Dev.to',           color: '#3B49DF', short: 'DEV',     hasThumb: true  },
  medium:           { label: 'Medium',           color: '#1A8917', short: 'M',       hasThumb: true  },
  bluesky:          { label: 'Bluesky',          color: '#0085FF', short: 'BSky',    hasThumb: true  },
  smashing:         { label: 'Smashing Mag',     color: '#E44D26', short: 'SM',      hasThumb: true  },
};

function getSourceMeta(source) {
  return SOURCE_META[source] || { label: source || 'outro', color: 'var(--tx3)', short: '?', hasThumb: false };
}

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

// ── Cache de thumbnails (evita re-fetch na mesma sessão) ─────────
const thumbCache = {};

// Gera um SVG placeholder colorido com as iniciais da fonte
function makePlaceholderSvg(source, title) {
  const meta = getSourceMeta(source);
  const color = meta.color;
  const short = meta.short;
  // Pega primeira palavra do título pra variar um pouco o bg
  const seed = (title || '').charCodeAt(0) % 3;
  const opacities = ['0.08', '0.12', '0.06'];
  const op = opacities[seed];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280">
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="${color}" stroke-width="0.5" opacity="${op}"/>
        </pattern>
      </defs>
      <rect width="600" height="280" fill="#0D1117"/>
      <rect width="600" height="280" fill="url(#grid)"/>
      <rect x="0" y="0" width="4" height="280" fill="${color}" opacity="0.6"/>
      <text x="300" y="130" font-family="monospace" font-size="52" font-weight="900"
        fill="${color}" opacity="0.18" text-anchor="middle" dominant-baseline="middle"
        letter-spacing="-2">${short}</text>
      <text x="300" y="178" font-family="monospace" font-size="11" font-weight="700"
        fill="${color}" opacity="0.4" text-anchor="middle" letter-spacing="4"
        text-transform="uppercase">${meta.label.toUpperCase()}</text>
    </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// Hook: resolve thumbnail de um item
function useThumbnail(item) {
  const [thumb, setThumb] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;

    // Se o item já traz thumbnail direto, usa
    if (item.thumbnail || item.image || item.og_image) {
      setThumb(item.thumbnail || item.image || item.og_image);
      return;
    }

    const meta = getSourceMeta(item.source);

    // Fontes sem thumbnail: placeholder imediato
    if (!meta.hasThumb || !item.sourceUrl) {
      setThumb(makePlaceholderSvg(item.source, item.title));
      return;
    }

    // Cache hit
    const cacheKey = item.sourceUrl;
    if (thumbCache[cacheKey] !== undefined) {
      setThumb(thumbCache[cacheKey]);
      return;
    }

    // Busca og:image via allorigins (proxy público, sem custo)
    setLoading(true);
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent(item.sourceUrl)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const match = data?.contents?.match(/<meta[^>]+(?:property=["']og:image["']|name=["']og:image["'])[^>]*content=["']([^"']+)["']/i)
          || data?.contents?.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property=["']og:image["'])/i);
        const found = match?.[1] || null;
        thumbCache[cacheKey] = found || makePlaceholderSvg(item.source, item.title);
        setThumb(thumbCache[cacheKey]);
      })
      .catch(() => {
        const placeholder = makePlaceholderSvg(item.source, item.title);
        thumbCache[cacheKey] = placeholder;
        setThumb(placeholder);
      })
      .finally(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    return () => { clearTimeout(timer); controller.abort(); };
  }, [item?.id, item?.sourceUrl, item?.source]);

  return { thumb, loading };
}

// ── Source Tag visual ────────────────────────────────────────────
function SourceTag({ source, size = 'md' }) {
  const meta = getSourceMeta(source);
  const pad  = size === 'sm' ? '1px 5px' : '2px 8px';
  const fs   = size === 'sm' ? 9 : 10;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: fs, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      padding: pad, borderRadius: 3,
      background: meta.color + '20', color: meta.color,
      border: `1px solid ${meta.color}40`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      flexShrink: 0,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: meta.color, display: 'inline-block', flexShrink: 0,
      }} />
      {meta.label}
    </span>
  );
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

  return (
    <div className="animate-fade-in">

      {/* ── Banner ── */}
      <div style={{
        width: '100%', height: 130, borderRadius: 'var(--r-xl)',
        overflow: 'hidden', margin: '14px 0 14px',
        position: 'relative', border: '1px solid var(--brd)',
      }}>
        <img src="./public/banner-farol.png" alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          background: 'linear-gradient(135deg, rgba(4,7,13,0.85), rgba(4,7,13,0.25))',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '12px 18px',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: '#fff' }}>
            Boa {getGreeting()}, Sams.
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {formatDate(new Date())} · semana {getWeekNumber()}
            {unread > 0 && <span style={{ color: 'var(--acc)', marginLeft: 10 }}>· {unread} não lidos</span>}
          </div>
        </div>
        <div style={{
          position: 'absolute', top: 10, right: 12, zIndex: 4,
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--acc)',
          background: 'rgba(4,7,13,0.7)', padding: '2px 8px',
          borderRadius: 3, border: '1px dashed rgba(212,160,48,0.3)',
        }}>
          farol://radar
        </div>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
          <StatCard value={String(allItems.filter(i=>i.type==='paper').length).padStart(2,'0')} label="papers" />
          <StatCard value={String(allItems.filter(i=>i.type==='thread'||i.type==='post'||i.type==='news').length).padStart(2,'0')} label="notícias" />
          <StatCard value={String(allItems.filter(i=>i.type==='cfp').length).padStart(2,'0')} label="cfps" />
          <StatCard value={`${dashStats.avgRel}%`} label="relevância" />
        </div>
      )}

      {/* ── Topbar ── */}
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
              fontWeight: view === key ? 700 : 400,
              transition: 'all 0.15s',
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

      {/* ── Painel de filtros ── */}
      {showFilters && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--brd)',
          borderRadius: 'var(--r-xl)', padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <FilterGroup label="Tipo" icon={Tag}>
              {['all', 'paper', 'post', 'thread', 'news', 'cfp'].map(t => (
                <FilterChip key={t} active={filterType === t}
                  onClick={() => setFilterType(t)}
                  label={t === 'all' ? 'Todos' : (TYPE_META[t]?.label || t)}
                />
              ))}
            </FilterGroup>
            <FilterGroup label="Fonte" icon={Lightning}>
              <FilterChip active={filterSource === 'all'} onClick={() => setFilterSource('all')} label="Todas" />
              {sourcesPresent.map(s => (
                <FilterChip key={s} active={filterSource === s}
                  onClick={() => setFilterSource(s)}
                  label={getSourceMeta(s).label}
                />
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

      {/* ── VIEWS ── */}
      {view === 'feed' ? (
        <FeedView items={filtered} notes={notes} profileId={profileId} />
      ) : (
        <DashboardView stats={dashStats} allItems={allItems} />
      )}
    </div>
  );
}

// ── Feed view ────────────────────────────────────────────────────
function FeedView({ items, notes, profileId }) {
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
  const second = items.slice(1, 3);
  const rest   = items.slice(3);

  return (
    <div>
      {/* ── HERO ── */}
      <HeroCard item={hero} profileId={profileId} />

      {/* ── 2 cards médios ── */}
      {second.length > 0 && (
        <>
          <Divider label="em destaque" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {second.map(item => <MediumCard key={item.id} item={item} profileId={profileId} />)}
          </div>
        </>
      )}

      {/* ── Lista compacta ── */}
      {rest.length > 0 && (
        <>
          <Divider label={`mais ${rest.length} item${rest.length !== 1 ? 's' : ''}`} />
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--brd)',
            borderRadius: 'var(--r-xl)', overflow: 'hidden',
          }}>
            {rest.map((item, idx) => (
              <CompactRow key={item.id} item={item} profileId={profileId} last={idx === rest.length - 1} />
            ))}
          </div>
        </>
      )}

      {/* ── Notas de pesquisa ── */}
      {notes && notes.length > 0 && (
        <>
          <Divider label="notas de pesquisa" />
          {notes.slice(0, 3).map(note => <NoteCard key={note.id} note={note} />)}
        </>
      )}
    </div>
  );
}

// ── Hero card ────────────────────────────────────────────────────
function HeroCard({ item, profileId }) {
  const dispatch  = useDispatch();
  const typeMeta  = TYPE_META[item.type] || { label: item.type, color: 'var(--acc)' };
  const { thumb } = useThumbnail(item);

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
      background: 'var(--bg2)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--brd)',
      cursor: item.sourceUrl ? 'pointer' : 'default',
      marginBottom: 10, opacity: item.isRead ? 0.72 : 1,
      overflow: 'hidden', transition: 'border-color 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,160,48,0.4)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}
    >
      {/* Imagem de destaque */}
      <div style={{
        width: '100%', height: 200, overflow: 'hidden',
        position: 'relative', flexShrink: 0,
        background: 'var(--bg1)',
      }}>
        {thumb && (
          <img src={thumb} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.src = makePlaceholderSvg(item.source, item.title); }}
          />
        )}
        {/* Overlay gradient na imagem */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(4,7,13,0.85) 0%, rgba(4,7,13,0.1) 60%)',
        }} />
        {/* Source tag sobre a imagem */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            padding: '2px 8px', borderRadius: 3,
            background: typeMeta.color + 'dd', color: '#fff',
          }}>{typeMeta.label}</span>
          <SourceTagOverlay source={item.source} />
        </div>
        {/* Ações no canto direito */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          <ActionBtnOverlay onClick={handleSave} active={item.isSaved}>
            <BookmarkSimple size={14} weight={item.isSaved ? 'fill' : 'regular'} />
          </ActionBtnOverlay>
          <ActionBtnOverlay onClick={handleDismiss}>
            <X size={14} />
          </ActionBtnOverlay>
        </div>
        {/* Tempo no canto inferior direito da imagem */}
        {item.publishedAt && (
          <span style={{
            position: 'absolute', bottom: 10, right: 10,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.6)',
          }}>{timeAgo(item.publishedAt)}</span>
        )}
      </div>

      {/* Conteúdo abaixo da imagem */}
      <div style={{ padding: '16px 20px 14px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 20, lineHeight: 1.3, marginBottom: 8, color: 'var(--tx)',
          letterSpacing: '-0.02em',
        }}>
          {item.title}
        </div>

        {item.authors && (
          <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
            {item.authors}
          </div>
        )}

        {item.summary && (
          <div style={{
            fontSize: 14, color: 'var(--tx2)', lineHeight: 1.65,
            marginBottom: 12,
            display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.summary}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RelevanceBadge score={item.relevanceScore} />
            {item.sourceUrl && <ArrowSquareOut size={13} style={{ color: 'var(--tx3)', opacity: 0.5 }} />}
          </div>
          <SourceTag source={item.source} />
        </div>
      </div>
    </div>
  );
}

// ── Card médio (2 colunas) ────────────────────────────────────────
function MediumCard({ item, profileId }) {
  const dispatch  = useDispatch();
  const typeMeta  = TYPE_META[item.type] || { label: item.type, color: 'var(--acc)' };
  const { thumb } = useThumbnail(item);

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
      border: '1px solid var(--brd)',
      cursor: item.sourceUrl ? 'pointer' : 'default',
      opacity: item.isRead ? 0.72 : 1, transition: 'border-color 0.2s',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,160,48,0.3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}
    >
      {/* Thumbnail */}
      <div style={{ height: 130, overflow: 'hidden', position: 'relative', background: 'var(--bg1)', flexShrink: 0 }}>
        {thumb && (
          <img src={thumb} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.src = makePlaceholderSvg(item.source, item.title); }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(4,7,13,0.7) 0%, rgba(4,7,13,0) 55%)',
        }} />
        {/* Type badge */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', padding: '1px 6px', borderRadius: 2,
          background: typeMeta.color + 'dd', color: '#fff',
        }}>{typeMeta.label}</span>
        {/* Actions */}
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 3 }}>
          <ActionBtnOverlay onClick={handleSave} active={item.isSaved} small>
            <BookmarkSimple size={12} weight={item.isSaved ? 'fill' : 'regular'} />
          </ActionBtnOverlay>
          <ActionBtnOverlay onClick={handleDismiss} small>
            <X size={12} />
          </ActionBtnOverlay>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 14, lineHeight: 1.35, color: 'var(--tx)',
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.title}
        </div>

        {item.authors && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>
            {item.authors.split(',').slice(0, 2).join(', ')}{item.authors.split(',').length > 2 ? ' et al.' : ''}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <RelevanceBadge score={item.relevanceScore} small />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)' }}>
              {timeAgo(item.publishedAt)}
            </span>
            <SourceTag source={item.source} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Linha compacta ─────────────────────────────────────────────
function CompactRow({ item, profileId, last }) {
  const dispatch = useDispatch();
  const typeMeta = TYPE_META[item.type] || { label: item.type, color: 'var(--acc)' };
  const srcMeta  = getSourceMeta(item.source);

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
      padding: '11px 14px',
      borderBottom: last ? 'none' : '1px solid var(--brd)',
      cursor: item.sourceUrl ? 'pointer' : 'default',
      opacity: item.isRead ? 0.65 : 1, transition: 'background 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {/* Dot unread */}
        {!item.isRead
          ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc)', flexShrink: 0 }} />
          : <span style={{ width: 6, flexShrink: 0 }} />
        }

        {/* Type tag */}
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          padding: '1px 5px', borderRadius: 2, flexShrink: 0,
          background: typeMeta.color + '22', color: typeMeta.color,
        }}>{(TYPE_META[item.type]?.label || item.type || '').slice(0, 4).toUpperCase()}</span>

        {/* Source dot + label */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          color: srcMeta.color, flexShrink: 0,
          letterSpacing: '0.04em',
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: srcMeta.color, display: 'inline-block' }} />
          {srcMeta.short}
        </span>

        {/* Título */}
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
          color: 'var(--tx)', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.title}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>
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

// ── Dashboard view ────────────────────────────────────────────────
function DashboardView({ stats, allItems }) {
  const maxSource = Math.max(...Object.values(stats.bySource), 1);
  const maxType   = Math.max(...Object.values(stats.byType), 1);
  const recentDays = Object.entries(stats.byDay)
    .filter(([d]) => d !== 'sem data').slice(-7);
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
          <BarRow key={src} label={getSourceMeta(src).label} value={count} max={maxSource}
            color={getSourceMeta(src).color} />
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
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
              color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1,
            }}>{item.title}</span>
            <SourceTag source={item.source} size="sm" />
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
      fontFamily: 'var(--font-mono)', fontSize: small ? 11 : 13, fontWeight: 700,
      padding: small ? '1px 5px' : '2px 7px', borderRadius: 3,
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

// Botão de ação sobre imagem (fundo escuro semitransparente)
function ActionBtnOverlay({ children, onClick, active, small }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(4,7,13,0.65)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 4, cursor: 'pointer',
      color: active ? 'var(--acc)' : 'rgba(255,255,255,0.75)',
      padding: small ? 3 : 4, display: 'flex', alignItems: 'center',
      backdropFilter: 'blur(4px)', transition: 'color 0.15s',
    }}>{children}</button>
  );
}

// Source tag para usar sobre imagens (fundo semitransparente)
function SourceTagOverlay({ source }) {
  const meta = getSourceMeta(source);
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      padding: '2px 7px', borderRadius: 3,
      background: 'rgba(4,7,13,0.7)', color: meta.color,
      border: `1px solid ${meta.color}50`,
      backdropFilter: 'blur(4px)',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{
        width: 4, height: 4, borderRadius: '50%',
        background: meta.color, display: 'inline-block',
      }} />
      {meta.label}
    </span>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>
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