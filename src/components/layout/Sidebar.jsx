import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Lightning, NotePencil, Books, List, ThreadsLogo, Graph, Sun, Moon, SignOut } from '@phosphor-icons/react';
import { useSettings } from '../../hooks/useData';
import { saveSettings } from '../../store/slices/dataSlice';
import { signOutUser, selectProfile } from '../../store/slices/authSlice';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { to: '/farol',   icon: Lightning,   label: 'Farol'},
  { to: '/bancada', icon: NotePencil,  label: 'Bancada'},
  { to: '/acervo',  icon: Books,       label: 'Acervo'},
  { to: '/pauta',   icon: List,        label: 'Pauta'},
  { to: '/vitrine', icon: ThreadsLogo, label: 'Vitrine'},
  { to: '/dataset', icon: Graph,       label: 'Dataset'},
];

function getAvatarUrl(user, profile) {
  // 1. Profile avatar (user set)
  if (profile?.avatarUrl) return profile.avatarUrl;
  // 2. Google OAuth avatar
  if (user?.user_metadata?.avatar_url) return user.user_metadata.avatar_url;
  if (user?.user_metadata?.picture) return user.user_metadata.picture;
  // 3. Generated from initials
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
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} className={`${styles.ni} ${isActive ? styles.active : ''}`} title={label}>
              <span className={styles.niIcon}><Icon size={20} weight={isActive ? 'fill' : 'regular'} /></span>
              <span className={styles.niLabel}>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={styles.bottom}>
        <div className={styles.actions}>
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

        {/* Avatar clicável → settings */}
        <div
          className={styles.user}
          onClick={() => navigate('/settings')}
          style={{ cursor: 'pointer' }}
          title="Configurações"
        >
          <img
            src={avatarUrl}
            alt={profileName}
            className={styles.avatar}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              objectFit: 'cover', border: '2px solid var(--acc)',
            }}
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div
            className={styles.avatar}
            style={{
              display: 'none', width: 32, height: 32, borderRadius: '50%',
              background: 'var(--acc)', color: 'var(--bg0)',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
            }}
          >
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
