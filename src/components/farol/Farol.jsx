import { useEffect, useRef, useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  ArrowsClockwise, BookmarkSimple,
  Funnel, ChartBar, Newspaper, Lightning,
  CalendarBlank, List, CaretLeft, CaretRight
} from '@phosphor-icons/react';
import { useRadarItems, useRadarStats, useNotes, useRadarCfps, useRadarFetch } from '../../hooks/useData';
import { dismissRadarItem, markRadarItemRead, toggleRadarSave } from '../../store/slices/dataSlice';
import { keyToLabel } from '../../lib/sourcesConfig';

function decodeEntities(text) {
  if (!text) return '';
  try {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  } catch {
    return text;
  }
}

const TYPE_META = {
  paper:  { label: 'Paper',   color: '#D4A030', bg: 'rgba(212,160,48,0.15)', solid: '#1a1600' },
  post:   { label: 'Artigo',  color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', solid: '#00112a' },
  thread: { label: 'Thread',  color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', solid: '#12002a' },
  cfp:    { label: 'CFP',     color: '#4ADE80', bg: 'rgba(74,222,128,0.15)', solid: '#001a10' },
  news:   { label: 'Notícia', color: '#F87171', bg: 'rgba(248,113,113,0.15)', solid: '#2a0000' },
};

function timeAgo(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  const diff = Date.now() - dt.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Agora';
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d atrás`;
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ⭐ Função de extração de IMAGEM com Debug e Proxy inteligente
function getItemImage(item, type) {
  const imageKeys = [
    'image', 'thumbnail', 'ogImage', 'cover', 'coverImage', 'cover_image', 'hero_image',
    'mainImage', 'main_image', 'img', 'imageUrl', 'image_url', 'image_link',
    'urlToImage', 'media_url', 'media_image', 'featured_image', 'headerImage'
  ];
  
  let foundUrl = null;
  for (let key of imageKeys) {
    if (item[key] && typeof item[key] === 'string' && item[key] !== '') {
      if (item[key].startsWith('http') || item[key].startsWith('/')) {
        foundUrl = item[key];
        break;
      }
    }
  }

  if (!foundUrl) {
    const content = item?.summary || item?.content || '';
    const markdownImgRegex = /!\[.*?\]\((.*?)\)/;
    const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/i;
    const plainUrlRegex = /(https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|gif|svg|webp|avif))/i;

    let match;
    if ((match = content.match(markdownImgRegex)) || 
        (match = content.match(htmlImgRegex)) || 
        (match = content.match(plainUrlRegex))) {
      foundUrl = match[1];
    }
  }

  if (foundUrl && foundUrl.startsWith('/') && item?.source) {
    foundUrl = `https://${item.source}${foundUrl}`;
  }

  // ⭐️ MAGIA DO PROXY + DEBUG
  if (foundUrl && !foundUrl.includes('localhost') && !foundUrl.startsWith('data:')) {
    // Medium é o pior de todos, força o uso do proxy!
    if (foundUrl.includes('miro.medium.com') || !foundUrl.includes('images.weserv.nl')) {
       foundUrl = `https://images.weserv.nl/?url=${encodeURIComponent(foundUrl)}`;
    }
  }

  // ⭐️ DEBUG: Abra o F12 e veja o que está sendo extraído!
  console.log(`📸 [Debug Imagem] Para o item "${item.title?.slice(0, 30)}..." a URL encontrada foi:`, foundUrl || 'NENHUMA URL!');

  const fallbackGradient = TYPE_META[type]?.solid || '#111111';
  return foundUrl || fallbackGradient;
}

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

  const [view, setView] = useState('feed');
  const [filterType,   setFilterType]   = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDate,   setFilterDate]   = useState('all');
  const [sortBy,       setSortBy]       = useState('date');
  const [showFilters,  setShowFilters]  = useState(false);

  const allItems = useMemo(() => {
    const base = items || [];
    const cfpItems = (cfps || []).map(c => ({ ...c, type: c.type || 'cfp' }));
    const merged = [...base, ...cfpItems.filter(c => !base.find(b => b.id === c.id))];
    return merged.filter(i => !i.isDismissed);
  }, [items, cfps]);

  const typeCounts = useMemo(() => {
    const counts = {};
    allItems.forEach(i => { const t = i.type || 'outro'; counts[t] = (counts[t] || 0) + 1; });
    return counts;
  }, [allItems]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (filterType === 'saved') list = list.filter(i => i.isSaved);
    else if (filterType !== 'all') list = list.filter(i => i.type === filterType);
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

  const saved = useMemo(() => allItems.filter(i => i.isSaved), [allItems]);

  const CATEGORY_BAR = useMemo(() => [
    { key: 'all', label: 'Todos', count: allItems.length },
    { key: 'paper', label: 'Papers', count: typeCounts.paper || 0 },
    { key: 'thread', label: 'Threads', count: typeCounts.thread || 0 },
    { key: 'post', label: 'Artigos', count: typeCounts.post || 0 },
    { key: 'cfp', label: 'CFPs', count: typeCounts.cfp || 0 },
    { key: 'news', label: 'Notícias', count: typeCounts.news || 0 },
    { key: 'saved', label: 'Favoritos', count: saved.length },
  ].filter(c => c.key === 'all' || c.count > 0), [allItems, typeCounts, saved]);

  return (
    <div className="animate-fade-in" style={{ background: 'transparent', padding: '0 24px 24px 24px', color: 'var(--tx)' }}>
      <FarolHeader />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', borderRadius: '8px', padding: 3, border: '1px solid var(--brd)' }}>
          {[
            { key: 'feed', icon: Newspaper, label: 'Feed' },
            { key: 'dashboard', icon: ChartBar, label: 'Dashboard' },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setView(key)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
              borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: 12,
              background: view === key ? 'var(--bg3)' : 'transparent',
              color: view === key ? 'var(--tx)' : 'var(--tx2)',
              fontWeight: view === key ? 600 : 400, transition: 'all 0.15s',
            }}>
              <Icon size={14} weight={view === key ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowFilters(f => !f)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px',
            padding: '6px 14px', color: 'var(--tx2)', cursor: 'pointer', fontSize: 12,
          }}>
            <Funnel size={14} /> Filtros
          </button>
          <button onClick={() => runRadarFetch(true)} disabled={isFetching} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: isFetching ? 'var(--bg2)' : 'var(--acc)',
            border: `1px solid ${isFetching ? 'var(--brd)' : 'var(--acc)'}`,
            borderRadius: '8px', padding: '6px 14px',
            color: isFetching ? 'var(--tx2)' : 'var(--bg0)',
            cursor: isFetching ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            <ArrowsClockwise size={14} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Buscando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      <CategoryBar categories={CATEGORY_BAR} active={filterType} onChange={setFilterType} />

      {showFilters && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <FilterGroup label="Fonte">
              <FilterChip active={filterSource === 'all'} onClick={() => setFilterSource('all')} label="Todas" />
              {[...new Set(allItems.map(i => i.source).filter(Boolean))].map(s => (
                <FilterChip key={s} active={filterSource === s} onClick={() => setFilterSource(s)} label={keyToLabel(s)} />
              ))}
            </FilterGroup>
            <FilterGroup label="Data">
              {[{ key: 'all', label: 'Qualquer' }, { key: 'today', label: 'Hoje' }, { key: 'week', label: 'Esta semana' }, { key: 'month', label: 'Este mês' }]
                .map(({ key, label }) => <FilterChip key={key} active={filterDate === key} onClick={() => setFilterDate(key)} label={label} />)}
            </FilterGroup>
            <FilterGroup label="Ordenar">
              <FilterChip active={sortBy === 'date'} onClick={() => setSortBy('date')} label="Mais recente" />
              <FilterChip active={sortBy === 'relevance'} onClick={() => setSortBy('relevance')} label="Mais relevante" />
            </FilterGroup>
          </div>
        </div>
      )}

      {view === 'feed' ? (
        <FeedView items={filtered} notes={notes} saved={saved} profileId={profileId} />
      ) : (
        <DashboardView allItems={allItems} />
      )}
    </div>
  );
}

function FarolHeader() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div style={{ borderBottom: '1px solid var(--brd)', marginBottom: 16, background: 'var(--bg1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)', color: 'var(--tx2)', fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lightning size={12} weight="fill" color="var(--acc)" />
          <span>Farol · Radar ativo</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', marginLeft: 4 }} />
        </div>
        <span>{dateStr}</span>
      </div>
      <div style={{ padding: '40px 0 50px 0', textAlign: 'center' }}>
        <div style={{ marginBottom: 8, fontFamily: 'var(--font-quote)', fontSize: 14, fontWeight: 700, color: 'var(--acc)', letterSpacing: '0.1em' }}>FAROL</div>
        <h1 style={{ fontFamily: 'var(--font-quote)', fontSize: 40, fontWeight: 700, color: 'var(--tx)', margin: 0, letterSpacing: '-0.02em' }}>Radar de Inteligência Acadêmica</h1>
        <p style={{ fontSize: 16, color: 'var(--tx2)', marginTop: 8, fontFamily: 'var(--font-body)' }}>Acompanhe as principais tendências, papers e notícias do mundo da pesquisa em tempo real.</p>
      </div>
      <div style={{ height: 1, background: 'var(--brd)', margin: '0 0 4px 0' }} />
    </div>
  );
}

function CategoryBar({ categories, active, onChange }) {
  return (
    <div style={{ overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 12, scrollbarWidth: 'none', msOverflowStyle: 'none', marginBottom: 20 }}>
      {categories.map(({ key, label, count }) => (
        <button key={key} onClick={() => onChange(key)} style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '6px 16px', borderRadius: '20px', border: `1px solid ${active === key ? 'var(--acc)' : 'var(--brd)'}`,
          background: active === key ? 'var(--acc-bg)' : 'var(--bg2)',
          color: active === key ? 'var(--acc)' : 'var(--tx2)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          <span>{label}</span>
          <span style={{ fontSize: 11, background: active === key ? 'var(--acc)' : 'var(--bg3)', padding: '0 6px', borderRadius: '10px', color: active === key ? 'var(--bg0)' : 'var(--tx3)' }}>{count}</span>
        </button>
      ))}
    </div>
  );
}

function FeedView({ items, notes, saved, profileId }) {
  const dispatch = useDispatch();
  const [displayCount, setDisplayCount] = useState(8);

  if (!items || items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tx3)', fontSize: 13 }}><Lightning size={32} style={{ opacity: 0.3, marginBottom: 12 }} /><div>Nenhum item encontrado no radar.</div></div>;
  }

  const handleViewMore = () => setDisplayCount(prev => prev + 6);
  const totalItems = items.length;
  const loadedItems = Math.min(displayCount, totalItems);
  const hasMore = totalItems > loadedItems;

  const initialItems = items.slice(0, 8);
  const extraItems = items.slice(8, displayCount);

  return (
    <div>
      {initialItems.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
          {initialItems.slice(0, 3).map(item => <EditorialCard key={item.id} item={item} profileId={profileId} dispatch={dispatch} />)}
        </div>
      )}
      {initialItems.length >= 6 && (
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-quote)', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>
                + Recentes <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx2)' }}>({loadedItems} de {totalItems} itens)</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Atualizações em tempo real</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            {initialItems[3] && <LargeFeatureCard item={initialItems[3]} dispatch={dispatch} profileId={profileId} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {initialItems[4] && <SmallVerticalCard item={initialItems[4]} dispatch={dispatch} profileId={profileId} />}
              {initialItems[5] && <SmallVerticalCard item={initialItems[5]} dispatch={dispatch} profileId={profileId} />}
            </div>
          </div>
        </div>
      )}
      {initialItems.length >= 8 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          {initialItems[6] && <GridCard item={initialItems[6]} dispatch={dispatch} profileId={profileId} />}
          {initialItems[7] && <GridCard item={initialItems[7]} dispatch={dispatch} profileId={profileId} />}
        </div>
      )}
      {extraItems.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {extraItems.map(item => <GridCard key={item.id} item={item} dispatch={dispatch} profileId={profileId} />)}
          </div>
        </div>
      )}
      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <button onClick={handleViewMore} style={{ background: 'var(--bg3)', color: 'var(--tx)', border: '1px solid var(--brd2)', borderRadius: '20px', padding: '10px 28px', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--acc)'; e.currentTarget.style.color = 'var(--acc)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd2)'; e.currentTarget.style.color = 'var(--tx)'; }}
          >Carregar mais itens ({loadedItems} de {totalItems})</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 10, paddingTop: 20, borderTop: '1px solid var(--brd)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BookmarkSimple size={16} color="var(--tx)" weight="fill" />
            <span style={{ fontFamily: 'var(--font-quote)', fontWeight: 600, fontSize: 14, color: 'var(--tx)' }}>Lista de Leitura</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {saved && saved.slice(0, 4).map(item => (
              <div key={item.id} onClick={() => { if(item.url) window.open(item.url, '_blank'); }} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg2)', border: '1px solid var(--brd)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{item.title}</span>
                <span style={{ fontSize: 11, color: 'var(--tx3)', flexShrink: 0 }}>{timeAgo(item.publishedAt)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Lightning size={16} color="var(--tx)" weight="fill" />
            <span style={{ fontFamily: 'var(--font-quote)', fontWeight: 600, fontSize: 14, color: 'var(--tx)' }}>Notas de Pesquisa</span>
          </div>
          {notes && notes.slice(0, 2).map(n => (
            <div key={n.id} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--brd)', marginBottom: 8, background: 'var(--bg2)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, color: 'var(--tx2)', marginTop: 2 }}>NP</span>
                <div style={{ fontSize: 13, color: 'var(--tx2)' }}>"{n.content}"</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardAuthor({ item }) {
  const authorName = item.authors ? item.authors.split(',')[0] : 'Anônimo';
  const authorImg = item.authorImg || item.authorAvatar || item.userAvatar || item.avatar;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {authorImg ? (
        <img src={authorImg} alt={authorName} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--brd)' }} />
      ) : (
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg3)', color: 'var(--tx2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
          {getInitials(authorName)}
        </span>
      )}
      <span style={{ fontSize: 11, color: 'var(--tx3)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authorName}</span>
    </div>
  );
}

function CardRenderer({ item, isLarge, isVertical, dispatch, profileId }) {
  const typeMeta = TYPE_META[item.type] || { label: 'Info', color: 'var(--tx2)', solid: '#111' };
  const img = getItemImage(item, item.type);
  const sourceLabel = keyToLabel(item.source);
  
  const handleClick = () => {
    if (item.id && !item.isRead) dispatch(markRadarItemRead({ profileId, id: item.id }));
    if (item.url) window.open(item.url, '_blank');
  };
  const handleSave = (e) => { e.stopPropagation(); dispatch(toggleRadarSave({ profileId, id: item.id })); };

  let height = 280, titleSize = 18;
  if (isLarge) { height = 340; titleSize = 24; }
  else if (isVertical) { height = 160; titleSize = 14; }

  return (
    <div onClick={handleClick} style={{
      position: 'relative', height: height, borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
      background: TYPE_META[item.type]?.solid || '#111',
      transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4)'
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.6)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.4)'; }}
    >
      {img && (
        <img src={img} crossOrigin="anonymous" onError={(e) => e.target.style.display = 'none'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.1) 70%, transparent 100%)' }} />
      <div style={{ position: 'absolute', top: 16, left: 16, background: 'var(--bg0)', borderRadius: '6px', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--brd2)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeMeta.color }} />
        <span>{typeMeta.label}</span>
        <span style={{ opacity: 0.4, margin: '0 2px' }}>•</span>
        <span style={{ color: 'var(--tx2)', fontWeight: 400 }}>{sourceLabel}</span>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <CardAuthor item={item} />
          <div onClick={handleSave} style={{ color: 'var(--tx)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 6, backdropFilter: 'blur(4px)' }}>
            <BookmarkSimple size={16} weight={item.isSaved ? 'fill' : 'regular'} />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--font-quote)', fontSize: titleSize, fontWeight: 700, color: 'var(--tx)', margin: '8px 0 0', lineHeight: 1.2 }}>{decodeEntities(item.title)}</h3>
        {!isVertical && <p style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{decodeEntities(item.summary)}</p>}
      </div>
    </div>
  );
}

function EditorialCard(props) { return <CardRenderer {...props} isLarge={false} isVertical={false} />; }
function LargeFeatureCard(props) { return <CardRenderer {...props} isLarge={true} isVertical={false} />; }
function SmallVerticalCard(props) { return <CardRenderer {...props} isLarge={false} isVertical={true} />; }
function GridCard(props) { return <CardRenderer {...props} isLarge={false} isVertical={false} />; }

function DashboardView({ allItems }) {
  const stats = useMemo(() => {
    const bySource = {}, byType = {};
    const readCount = allItems.filter(i => i.isRead).length;
    const unreadCount = allItems.filter(i => !i.isRead).length;
    let avgRelevanceSum = 0;
    const last7days = {};
    allItems.forEach(i => {
      bySource[i.source || 'outros'] = (bySource[i.source || 'outros'] || 0) + 1;
      byType[i.type || 'outro'] = (byType[i.type || 'outro'] || 0) + 1;
      avgRelevanceSum += (i.relevanceScore || 0);
      const dayKey = i.publishedAt ? new Date(i.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null;
      if (dayKey) {
        const today = new Date();
        const dayDiff = Math.floor((today - new Date(i.publishedAt)) / (1000*60*60*24));
        if (dayDiff <= 7) last7days[dayKey] = (last7days[dayKey] || 0) + 1;
      }
    });
    return { bySource, byType, readCount, unreadCount, avgRel: allItems.length ? Math.round(avgRelevanceSum / allItems.length) : 0, last7days };
  }, [allItems]);
  const maxSource = Math.max(...Object.values(stats.bySource), 1);
  const maxDay = Math.max(...Object.values(stats.last7days), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <DashCard label="Total Monitorado" value={allItems.length} />
        <DashCard label="Não Lidos" value={stats.unreadCount} accent />
        <DashCard label="Já Lidos" value={stats.readCount} />
        <DashCard label="Itens Salvos" value={allItems.filter(i => i.isSaved).length} />
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontFamily: 'var(--font-quote)', fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--tx)' }}>Distribuição por Fonte</div>
        {Object.entries(stats.bySource).sort((a,b)=>b[1]-a[1]).slice(0, 7).map(([src, count]) => (
          <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, fontSize: 13, color: 'var(--tx2)' }}>
            <span style={{ width: 100, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{keyToLabel(src)}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(count / maxSource) * 100}%`, background: 'var(--acc)', borderRadius: 4 }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', width: 20 }}>{count}</span>
          </div>
        ))}
      </div>
      {Object.keys(stats.last7days).length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-quote)', fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--tx)' }}>Atividade Recente</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 80, padding: '0 8px' }}>
            {Object.entries(stats.last7days).sort((a,b) => new Date(a[0]) - new Date(b[0])).map(([day, count]) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${Math.max((count / maxDay) * 64, 4)}px`, background: 'var(--acc)', opacity: 0.75, minHeight: 4 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)', whiteSpace: 'nowrap', marginTop: 4 }}>{day}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashCard({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--bg2)', border: `1px solid ${accent ? 'var(--acc)' : 'var(--brd)'}`, borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontFamily: 'var(--font-quote)', fontSize: 28, fontWeight: 800, color: accent ? 'var(--acc)' : 'var(--tx)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx3)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '2px 10px', borderRadius: '12px', fontSize: 11, background: active ? 'var(--tx)' : 'var(--bg3)',
      color: active ? 'var(--bg0)' : 'var(--tx2)', border: 'none', cursor: 'pointer', fontWeight: active ? 600 : 400
    }}>{label}</button>
  );
}