import { useState } from 'react';
import { Plus, DownloadSimple, X } from '@phosphor-icons/react';
import { VIEW_META } from '../../types/index';
import { useRadarStats } from '../../hooks/useData';

export function Topbar({ currentView, profile, search = '', onSearch }) {
  const stats = useRadarStats(profile.id);
  const meta = VIEW_META[currentView];
  const [focused, setFocused] = useState(false);

  const badge = currentView === 'farol' && stats
    ? `${stats.unread} novidades`
    : meta?.badge || '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', borderBottom: '1px solid var(--brd)',
      background: 'var(--bg1)', position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(12px)', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--acc)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--tx)' }}>
          {meta?.title || currentView}
        </span>
        {badge && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, background: 'var(--acc-bg)', color: 'var(--acc)', padding: '4px 12px', borderRadius: 8 }}>
            {badge}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg2)',
          border: `1px solid ${focused ? 'rgba(212,160,48,0.3)' : 'var(--brd)'}`,
          borderRadius: 'var(--r-sm)', padding: '5px 12px',
          width: 240, transition: 'border-color 0.15s',
        }}>
          <span style={{ color: 'var(--acc)', fontFamily: 'var(--font-mono)', fontSize: 13, flexShrink: 0, opacity: 0.6 }}>$</span>
          <input
            value={search}
            onChange={e => onSearch?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="buscar..."
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', width: '100%' }}
          />
          {search && (
            <button onClick={() => onSearch?.('')} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', display: 'flex', padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {meta?.secondary && (
          <button style={{ background: 'none', border: '1px solid var(--brd2)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'var(--tx2)', fontFamily: 'var(--font-body)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DownloadSimple size={16} />{meta.secondary}
          </button>
        )}
        {meta?.cta && (
          <button style={{ background: 'var(--acc)', color: 'var(--bg0)', border: '1px solid var(--acc)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 0 10px var(--acc-glow)' }}>
            <Plus size={16} weight="bold" />{meta.cta}
          </button>
        )}
      </div>
    </div>
  );
}
