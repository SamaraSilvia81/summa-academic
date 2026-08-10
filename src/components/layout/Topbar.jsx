import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Plus, DownloadSimple, X, CaretRight, Lightning, NotePencil, Books, List, ThreadsLogo, Graph, House } from '@phosphor-icons/react';
import { VIEW_META } from '../../types/index';
import { useRadarStats } from '../../hooks/useData';
import { selectProfile } from '../../store/slices/authSlice';

const VIEW_ICONS = {
  home: House,
  farol: Lightning,
  bancada: NotePencil,
  acervo: Books,
  pauta: List,
  vitrine: ThreadsLogo,
  dataset: Graph,
};

const SUB_LABELS = {
  referencias: 'Referências', pasta: 'Pasta', editor: 'Editor',
};

function buildCrumbs(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [];
  const root = parts[0];
  const meta = VIEW_META[root];
  const crumbs = [{ label: meta?.title || root, to: `/${root}` }];

  if (parts[1] === 'pasta') {
    crumbs.push({ label: 'Pasta', to: null });
  } else if (parts[1]) {
    const label = SUB_LABELS[parts[1]] || parts[1];
    crumbs.push({ label, to: `/${root}/${parts[1]}` });
  }
  return crumbs;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)',
      letterSpacing: '0.02em', flexShrink: 0,
    }}>
      {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export function Topbar({ currentView, profile, search = '', onSearch }) {
  const stats = useRadarStats(profile.id);
  const meta = VIEW_META[currentView];
  const [focused, setFocused] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const reduxProfile = useSelector(selectProfile);
  const user = useSelector(state => state.auth.user);

  const ViewIcon = VIEW_ICONS[currentView];

  // Avatar para topbar — inicial se não tiver foto
  const avatarUrl = reduxProfile?.avatarUrl
    || user?.user_metadata?.avatar_url
    || user?.user_metadata?.picture
    || null;
  const displayName = reduxProfile?.name || user?.user_metadata?.full_name || '';
  const initials = displayName.split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0, 2).join('') || '?';

  const badge = currentView === 'farol' && stats
    ? `${stats.unread} novidades`
    : meta?.badge || '';

  const crumbs = buildCrumbs(location.pathname);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px 10px 24px',
      marginTop: 10,
      // borderBottom: '1px solid var(--brd)',
      // background: 'var(--bg1)',
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(12px)', gap: 16,
    }}>
      {/* ── Esquerda: ícone do módulo + breadcrumb + badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 0 }}>

        {/* Ícone do módulo ativo — ecoa o sidebar */}
        {ViewIcon && (
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: 'var(--acc-bg)',
            color: 'var(--acc)',
          }}>
            <ViewIcon size={15} weight="fill" />
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {i > 0 && <CaretRight size={11} color="var(--tx3)" style={{ flexShrink: 0 }} />}
                {c.to && !isLast ? (
                  <button onClick={() => navigate(c.to)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17,
                    color: 'var(--tx3)', transition: 'color 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--tx2)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--tx3)'}
                  >{c.label}</button>
                ) : (
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17,
                    color: isLast ? 'var(--tx)' : 'var(--tx3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.label}</span>
                )}
              </span>
            );
          })}
        </div>

        {badge && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, background: 'var(--acc-bg)', color: 'var(--acc)', padding: '3px 10px', borderRadius: 6, flexShrink: 0 }}>
            {badge}
          </span>
        )}
      </div>

      {/* ── Direita: clock, search, ações, avatar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <Clock />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg2)',
          border: `1px solid ${focused ? 'rgba(212,160,48,0.3)' : 'var(--brd)'}`,
          borderRadius: 'var(--r-sm)', padding: '5px 12px',
          width: 220, transition: 'border-color 0.15s',
        }}>
          <span style={{ color: 'var(--acc)', fontFamily: 'var(--font-mono)', fontSize: 12, flexShrink: 0, opacity: 0.5 }}>$</span>
          <input
            value={search}
            onChange={e => onSearch?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="buscar..."
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)', width: '100%' }}
          />
          {search && (
            <button onClick={() => onSearch?.('')} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', display: 'flex', padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {meta?.secondary && (
          <button style={{ background: 'none', border: '1px solid var(--brd2)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', color: 'var(--tx2)', fontFamily: 'var(--font-body)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
            <DownloadSimple size={14} />{meta.secondary}
          </button>
        )}
        {meta?.cta && (
          <button style={{ background: 'var(--acc)', color: 'var(--bg0)', border: '1px solid var(--acc)', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 0 10px var(--acc-glow)' }}>
            <Plus size={14} weight="bold" />{meta.cta}
          </button>
        )}

        {/* Avatar do usuário — ancora o contexto de sessão na topbar */}
        <div
          onClick={() => navigate('/settings')}
          title={displayName}
          style={{
            width: 30, height: 30, borderRadius: 8, overflow: 'hidden',
            border: '1.5px solid var(--brd2)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg3)', transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,160,48,0.4)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd2)'}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <span style={{
            display: avatarUrl ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 11, color: 'var(--acc)', width: '100%', height: '100%',
          }}>
            {initials}
          </span>
        </div>
      </div>
    </div>
  );
}