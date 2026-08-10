import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Lightning, NotePencil, Books, List, ThreadsLogo, Graph, Sun, Moon, SignOut, House, BookOpenText, BookmarkSimple, Folder, GearSix } from '@phosphor-icons/react';
import { useSettings } from '../../hooks/useData';
import { saveSettings } from '../../store/slices/dataSlice';
import { signOutUser, selectProfile } from '../../store/slices/authSlice';
import styles from './Sidebar.module.css';

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { to: '/home', icon: House, label: 'Home' },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { to: '/farol', icon: Lightning, label: 'Farol' },
      { to: '/bancada', icon: NotePencil, label: 'Bancada' },
      {
        to: '/acervo', icon: Books, label: 'Acervo',
        sub: [
          { to: '/acervo/referencias', label: 'Referências' },
          { to: '/acervo/leitura', label: 'Leitura' },
        ],
      },
      { to: '/dataset', icon: Graph, label: 'Dataset' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/pauta', icon: List, label: 'Pauta' },
      { to: '/vitrine', icon: ThreadsLogo, label: 'Vitrine' },
    ],
  },
];

function getAvatarUrl(user, profile) {
  if (profile?.avatarUrl) return profile.avatarUrl;
  if (user?.user_metadata?.avatar_url) return user.user_metadata.avatar_url;
  if (user?.user_metadata?.picture) return user.user_metadata.picture;
  const name = profile?.name || user?.user_metadata?.full_name || '?';
  const initials = name.split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0, 2).join('');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=D4A030&color=fff&size=128&bold=true&font-size=0.45`;
}

export function Sidebar({ profileName, institution, profileId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const settings = useSettings(profileId);
  const location = useLocation();
  const user = useSelector(state => state.auth.user);
  const profile = useSelector(selectProfile);
  const isDark = !settings || settings.theme !== 'light';

  const radarItems = useSelector(state => state.data.radar.items);
  const unreadCount = radarItems ? radarItems.filter(i => !i.isRead && !i.isDismissed).length : 0;

  const avatarUrl = getAvatarUrl(user, profile);

  async function toggleTheme() {
    if (!profileId) return;
    await dispatch(saveSettings({ profileId, data: { theme: isDark ? 'light' : 'dark' } })).unwrap();
  }

  const handleSignOut = async () => {
    await dispatch(signOutUser()).unwrap();
    window.location.reload();
  };

  return (
    <aside className={styles.side}>
      {/* Logo */}
      <div className={styles.logoRow}>
        <div className={styles.logoS}>
          <img src="/logo-dark.png" className={styles.logoDark} alt="" />
          <img src="/logo-white.png" className={styles.logoLight} alt="" />
        </div>
        <div className={styles.logoName}><b>Summa</b>.sh</div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV_GROUPS.map((group, gi) => (
          <div className={styles.navGroup} key={group.label}>
            {gi > 0 && <div className={styles.groupSep} />}
            <div className={styles.groupLabel}>{group.label}</div>
            {group.items.map(({ to, icon: Icon, label, sub }) => {
              const isActive = location.pathname.startsWith(to);
              const isFarol = to === '/farol';
              const badge = isFarol && unreadCount > 0 ? unreadCount : null;
              return (
                <div key={to}>
                  <NavLink to={to} className={`${styles.ni} ${isActive ? styles.active : ''}`} title={label} style={{ position: 'relative' }}>
                    <span className={styles.niIcon}>
                      <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                    </span>
                    <span className={styles.niLabel}>{label}</span>
                    {badge && (
                      <span style={{
                        position: 'absolute', top: -4, right: 6,
                        minWidth: 16, height: 16, borderRadius: 8,
                        background: 'var(--acc)', color: '#0f0b18',
                        fontSize: 9, fontWeight: 800, fontFamily: 'var(--font-mono)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', lineHeight: 1, zIndex: 10,
                      }}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </NavLink>
                  {/* Sub-nav */}
                  {sub && isActive && (
                    <div className={styles.subNav}>
                      {sub.map(s => (
                        <NavLink key={s.to} to={s.to} className={styles.subItem}
                          style={location.pathname === s.to ? { color: 'var(--acc)', borderLeftColor: 'var(--acc)' } : undefined}
                        >
                          {s.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className={styles.bottom}>
        <div className={styles.groupLabel}>Config</div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => navigate('/settings')} title="Configurações">
            <span className={styles.niIcon}><GearSix size={18} /></span>
            <span className={styles.actionLabel}>Config</span>
          </button>
          <button className={styles.actionBtn} onClick={toggleTheme} title={isDark ? 'Modo claro' : 'Modo escuro'}>
            <span className={styles.niIcon}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</span>
            <span className={styles.actionLabel}>{isDark ? 'Claro' : 'Escuro'}</span>
          </button>
          <button className={styles.actionBtn} onClick={handleSignOut} title="Sair">
            <span className={styles.niIcon}><SignOut size={18} /></span>
            <span className={styles.actionLabel}>Sair</span>
          </button>
        </div>

        <div className={styles.separator} />

        <div className={styles.user} onClick={() => navigate('/settings')} title="Configurações">
          <img src={avatarUrl} alt={profileName} className={styles.avatar}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(212,160,48,0.4)' }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          <div className={styles.avatar} style={{ display: 'none', width: 32, height: 32, borderRadius: '50%', background: 'var(--acc)', color: '#0f0b18' }}>
            {profileName.slice(0, 2).toUpperCase()}
          </div>
          <div className={styles.userDetail}>
            <div className={styles.userName}>{profileName}</div>
            <div className={styles.userRole}>{institution}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}