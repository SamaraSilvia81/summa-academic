import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeSlash, GoogleLogo, Sun, Moon, User } from '@phosphor-icons/react';
import {
  signInWithGoogleProvider,
  signInWithPassword,
  signUpWithPassword,
} from '../../store/slices/authSlice';
import styles from './AuthScreen.module.css';

const AVATAR_COLORS = [
  '#D4A030', // dourado (acc)
  '#7C6AE8', // violeta
  '#E85D5D', // coral
  '#3BA89E', // teal
  '#5B8DEF', // azul
  '#E88A3E', // laranja
];

function generateAvatarUrl(name, color) {
  const initials = (name || '?')
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
  const bg = color.replace('#', '');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bg}&color=fff&size=128&bold=true&font-size=0.45`;
}

export function AuthScreen({ onDone }) {
  const dispatch = useDispatch();
  const authError = useSelector((state) => state.auth.error);

  const [isSignup, setIsSignup] = useState(false);
  const [isDark, setIsDark] = useState(!document.body.classList.contains('light'));
  const [darkHover, setDarkHover] = useState(false);

  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reduz o grão/scanline global (aplicado no body inteiro) só enquanto
  // esta tela está montada — a ilustração e a textura de papel pautado
  // já têm ruído próprio, então o grão do app inteiro fica pesado demais aqui.
  useEffect(() => {
    document.body.classList.add('auth-quiet-grain');
    return () => document.body.classList.remove('auth-quiet-grain');
  }, []);

  // Carrega email salvo
  useEffect(() => {
    const saved = localStorage.getItem('summa_remember_email');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  // Limpa erros ao trocar de modo
  useEffect(() => {
    setLocalError('');
    setMessage('');
  }, [isSignup]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setMessage('');

    const emailTrim = email.trim();
    const passTrim = password.trim();
    const nameTrim = name.trim();

    if (isSignup && !nameTrim) {
      setLocalError('Digite seu nome.');
      return;
    }
    if (!emailTrim || !passTrim) {
      setLocalError('Preencha todos os campos.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setLocalError('Digite um endereço de e-mail válido.');
      return;
    }
    if (passTrim.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const avatarUrl = isSignup ? generateAvatarUrl(nameTrim, avatarColor) : undefined;
      const result = await dispatch(
        isSignup
          ? signUpWithPassword({ email: emailTrim, password: passTrim, name: nameTrim, avatarUrl })
          : signInWithPassword({ email: emailTrim, password: passTrim })
      ).unwrap();

      // Confirmação de e-mail (cadastro)
      if (isSignup && !result?.session) {
        setMessage('Conta criada! Confirme seu e-mail e faça login.');
        setSubmitting(false);
        return;
      }

      // Remember me
      if (rememberMe) {
        localStorage.setItem('summa_remember_email', emailTrim);
      } else {
        localStorage.removeItem('summa_remember_email');
      }

      // Avisa o App.jsx que o auth foi concluído — ele decide a próxima fase
      onDone?.();
    } catch (err) {
      setLocalError(err?.message || 'Falha na autenticação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError('');
    setSubmitting(true);
    try {
      // OAuth redireciona para o Google — quando o usuário volta,
      // o onAuthStateChange no App.jsx captura a sessão automaticamente.
      await dispatch(signInWithGoogleProvider()).unwrap();
    } catch (err) {
      setLocalError(err?.message || 'Falha ao entrar com Google.');
      setSubmitting(false);
    }
  };

  const switchMode = () => setIsSignup((v) => !v);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.body.classList.toggle('light', !next);
  };

  return (
    <div className={styles.container}>
      {/* DARK MODE LATERAL TOGGLE */}
      <div
        className={styles.themeToggle}
        onClick={toggleTheme}
        onMouseEnter={() => setDarkHover(true)}
        onMouseLeave={() => setDarkHover(false)}
        style={{ width: darkHover ? 100 : 48 }}
      >
        {isDark ? <Moon size={20} weight="fill" /> : <Sun size={20} weight="fill" />}
        {darkHover && (
          <span className={styles.themeLabel}>{isDark ? 'Dark' : 'Light'}</span>
        )}
      </div>

      {/* LADO ESQUERDO – ILUSTRAÇÃO */}
      <div className={styles.left}>
        <div className={styles.leftScrim} />

        <div className={styles.leftContent}>
          <img src="/logo-white.png" alt="Summa" className={styles.symbol} />
          <div className={styles.wordmark}>
            <b>Summa</b>.sh
          </div>
          <p className={styles.tagline}>ambiente de escrita acadêmica</p>
        </div>
      </div>

      {/* LADO DIREITO – FORMULÁRIO */}
      <div className={styles.right}>
        {/* Blobs — gradiente dourado grande e difuso, estilo color-blur */}
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />

        {/* Textura de "papel pautado" — sutil, coerente com uma bancada de escrita */}
        <div className={styles.ruledPaper} />

        {/* Textura grainy — pontinhos brancos difusos */}
        <div className={styles.grainyTexture} />

        <div className={styles.formWrapper}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Summa · acesso</span>
            <h2>{isSignup ? 'Criar conta' : 'Bem-vindo de volta'}</h2>
            <p>
              {isSignup
                ? 'Comece sua jornada acadêmica no Summa.'
                : 'Acesse seu workspace para continuar.'}
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {isSignup && (
              <>
                {/* AVATAR PREVIEW + COR */}
                <div className={styles.avatarRow}>
                  <div
                    className={styles.avatarPreview}
                    style={{ backgroundColor: avatarColor }}
                  >
                    {name.trim() ? (
                      <span className={styles.avatarInitials}>
                        {name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase()).slice(0, 2).join('')}
                      </span>
                    ) : (
                      <User size={28} weight="bold" />
                    )}
                  </div>
                  <div className={styles.avatarColors}>
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`${styles.colorDot} ${avatarColor === c ? styles.colorDotActive : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setAvatarColor(c)}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {/* NOME */}
                <div className={styles.field}>
                  <label htmlFor="name">Nome</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como quer ser chamado(a)"
                    autoComplete="name"
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={submitting}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Senha</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••• (mín. 6 caracteres)"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className={styles.options}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Lembrar e-mail</span>
              </label>
              {!isSignup && (
                <button type="button" className={styles.forgot}>
                  Esqueceu a senha?
                </button>
              )}
            </div>

            {(localError || authError) && (
              <div className={styles.error}>{localError || authError}</div>
            )}
            {message && <div className={styles.message}>{message}</div>}

            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Processando...' : isSignup ? 'Criar conta' : 'Entrar'}
            </button>
          </form>

          <div className={styles.divider}>
            <span>ou continue com</span>
          </div>

          <button className={styles.google} onClick={handleGoogle} disabled={submitting}>
            <GoogleLogo size={20} />
            Google
          </button>

          <button className={styles.switch} onClick={switchMode} type="button">
            {isSignup ? 'Já tenho uma conta' : 'Ainda não tenho conta'}
          </button>

          <div className={styles.footer}>
            <span>© 2026 Summa.sh</span>
          </div>
        </div>
      </div>
    </div>
  );
}