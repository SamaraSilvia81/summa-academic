import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { initializeAuth, refreshProfile, selectAuth, setSession } from './store/slices/authSlice';
import { loadSettings } from './store/slices/dataSlice';
import { onAuthStateChange } from './lib/auth';
import { useSettings } from './hooks/useData';
import { AuthScreen } from './components/auth/AuthScreen';
import { Splash } from './components/shared/Splash';
import { Loading } from './components/shared/Loading';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Farol } from './components/farol/Farol';
import { BancadaPage } from './components/bancada/BancadaPage';
import { EditorPage } from './components/bancada/editor/EditorPage';
import { Acervo } from './components/acervo/Acervo';
import { Settings } from './components/settings/Settings';
import { Onboarding } from './components/onboarding/Onboarding';
import { EmptyModule } from './components/shared/EmptyModule';
import './styles/global.css';

function nextPhase(user, profile) {
  if (!user) return 'auth';
  if (!profile) return 'onboarding';
  return 'ready';
}

export default function App() {
  const dispatch = useDispatch();
  const { profile, user, status: authStatus } = useSelector(selectAuth);
  const [phase, setPhase] = useState('splash');
  const [globalSearch, setGlobalSearch] = useState('');
  const settings = useSettings(profile?.id);
  const location = useLocation();
  const authReady = authStatus === 'ready' || authStatus === 'failed';
  const currentView = location.pathname.split('/')[1] || 'farol';

  useEffect(() => {
    dispatch(initializeAuth());

    const subscription = onAuthStateChange((event, session) => {
      dispatch(setSession(session));
      if (session?.user) {
        dispatch(refreshProfile());
      }
    });

    return () => subscription?.unsubscribe?.();
  }, [dispatch]);

  useEffect(() => {
    if (profile?.id) dispatch(loadSettings(profile.id));
  }, [dispatch, profile?.id]);

  const handleSplashDone = useCallback(() => {
    setPhase(authReady ? nextPhase(user, profile) : 'loading');
  }, [authReady, user, profile]);

  const handleLoadingDone = useCallback(() => {
    setPhase(nextPhase(user, profile));
  }, [user, profile]);

  useEffect(() => {
    if (phase === 'loading' && authReady) {
      setPhase(nextPhase(user, profile));
    }
  }, [phase, authReady, user, profile]);

  // ── Reage a mudanças de estado do Redux ──
  // Quando o user/profile mudam (pós-login, pós-onboarding, OAuth callback),
  // o phase precisa acompanhar — senão fica preso na tela anterior.
  useEffect(() => {
    if (phase === 'splash' || phase === 'loading') return;
    if (!authReady) return;

    const ideal = nextPhase(user, profile);
    if (ideal !== phase) {
      setPhase(ideal);
    }
  }, [authReady, user, profile]);

  useEffect(() => {
    if (!settings) return;
    document.body.classList.toggle('light', settings.theme === 'light');
    document.body.classList.toggle('no-grain', settings.grain === false);
    document.body.classList.toggle('no-scanlines', settings.scanlines === false);
  }, [settings]);

  if (phase === 'splash') return <Splash onFinish={handleSplashDone} />;
  if (phase === 'loading') return <Loading onFinish={handleLoadingDone} />;
  if (phase === 'auth') return <AuthScreen onDone={() => setPhase('loading')} />;
  if (phase === 'onboarding') return <Onboarding onComplete={() => setPhase('loading')} />;
  if (!user) return <AuthScreen onDone={() => setPhase('loading')} />;
  if (!profile) return <Onboarding onComplete={() => setPhase('loading')} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar profileName={profile.name} institution={profile.institution} profileId={profile.id} />
      <main style={{ flex: 1, marginLeft: 'var(--sidebar-w)', minHeight: '100vh' }}>
        <Topbar currentView={currentView} profile={profile} search={globalSearch} onSearch={setGlobalSearch} />
        <div style={{ padding: '0 24px 40px' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/farol" replace />} />
            <Route path="/farol" element={<Farol profileId={profile.id} />} />
            <Route path="/bancada" element={<BancadaPage profileId={profile.id} search={globalSearch} />} />
            <Route path="/bancada/editor" element={<EditorPage profileId={profile.id} />} />
            <Route path="/acervo" element={<Acervo profileId={profile.id} />} />
            <Route path="/settings" element={<Settings profileId={profile.id} />} />
            <Route path="/pauta" element={<EmptyModule name="Pauta" icon="Kanban" description="Kanban, milestones, cronogramas e deadlines." />} />
            <Route path="/vitrine" element={<EmptyModule name="Vitrine" icon="Eye" description="Portfolio academico publico." />} />
            <Route path="/dataset" element={<EmptyModule name="Dataset" icon="Graph" description="Gestao do pool de repositorios." />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

