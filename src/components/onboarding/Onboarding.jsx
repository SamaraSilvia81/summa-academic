import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, ArrowLeft, Sparkle } from '@phosphor-icons/react';
import { createProfile } from '../../store/slices/authSlice';
import { loadSettings } from '../../store/slices/dataSlice';

import styles from './Onboarding.module.css';
import { SOURCES, labelToKey } from '../../lib/sourcesConfig';

const AREAS = [
  'Ciências Exatas e da Terra',
  'Engenharias',
  'Ciências da Saúde',
  'Ciências Biológicas',
  'Ciências Humanas',
  'Ciências Sociais Aplicadas',
  'Linguística, Letras e Artes',
  'Multidisciplinar',
];

const PROGRAMS = ['Mestrado', 'Doutorado', 'Pós-doc', 'Graduação', 'Independente'];
const LANGS = ['Português', 'English', 'Español', 'Français', '日本語'];

export function Onboarding({ onComplete }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [step, setStep] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    orgName: '',
    area: '',
    subarea: '',
    program: 'Mestrado',
    name: '',
    institution: '',
    advisor: '',
    keywords: [],
    sources: ['Semantic Scholar', 'arXiv', 'Hacker News'],
    languages: ['Português', 'English'],
  });

  const set = (field, value) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const toggleMulti = (field, val) => {
    const arr = data[field];
    set(field, arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const addKeyword = () => {
    if (tagInput.trim()) {
      set('keywords', [...data.keywords, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeKeyword = (i) =>
    set('keywords', data.keywords.filter((_, idx) => idx !== i));

  const canNext = () => {
    if (step === 0) return data.orgName.trim() !== '';
    if (step === 1) return data.area !== '';
    if (step === 2) return data.subarea.trim() !== '';
    if (step === 3) return data.name.trim() !== '' && data.institution.trim() !== '';
    if (step === 4) return data.keywords.length > 0;
    return true;
  };

  const handleFinish = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const profile = await dispatch(
        createProfile({
          profile: {
            userId: user?.id,
            name: data.name,
            institution: data.institution,
            program: data.program.toLowerCase(),
            advisor: data.advisor,
            workspaceName: data.orgName,
            grandeArea: data.area,
            subarea: data.subarea,
            areas: [data.area, data.subarea],
            keywords: data.keywords,
            ignoredTerms: [],
            languages: data.languages.map((l) =>
              l === 'Português'
                ? 'pt'
                : l === 'English'
                ? 'en'
                : l === 'Español'
                ? 'es'
                : l === 'Français'
                ? 'fr'
                : 'ja'
            ),
            sources: data.sources.map((s) => labelToKey(s)),
            currentProduction: data.program === 'Mestrado' ? 'dissertacao' : 'artigo',
            mainDeadline: null,
            onboardingCompleted: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          settings: {
            theme: 'dark',
            grain: true,
            scanlines: true,
            accentColor: '#D4A030',
            language: 'pt',
            radarFrequency: 'daily',
            informeDay: 'monday',
            aiModel: null,
            aiApiKey: null,
          },
        })
      ).unwrap();

      await dispatch(loadSettings(profile.id));
      onComplete();
    } catch (err) {
      console.error('[summa] onboarding error:', err);
      setError(
        err?.message ||
        'Erro ao criar perfil. Verifique se a SUPABASE_ANON_KEY está configurada no .env.local.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = [
    // Step 0: Organization
    <>
      <div className={styles.field}>
        <label className={styles.label}>Nome do workspace</label>
        <input
          className={styles.input}
          value={data.orgName}
          onChange={(e) => set('orgName', e.target.value)}
          placeholder="Ex: Mestrado CIn/UFPE 2026"
        />
      </div>
    </>,
    // Step 1: Grande Área
    <>
      <div className={styles.field}>
        <label className={styles.label}>Grande área do conhecimento</label>
        <div className={styles.chips}>
          {AREAS.map((a) => (
            <button
              key={a}
              className={`${styles.chip} ${data.area === a ? styles.chipOn : ''}`}
              onClick={() => set('area', a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </>,
    // Step 2: Subárea + Programa
    <>
      <div className={styles.field}>
        <label className={styles.label}>Subárea específica</label>
        <input
          className={styles.input}
          value={data.subarea}
          onChange={(e) => set('subarea', e.target.value)}
          placeholder="Ex: Ciência da Computação → Engenharia de Software"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Programa</label>
        <div className={styles.chips}>
          {PROGRAMS.map((p) => (
            <button
              key={p}
              className={`${styles.chip} ${data.program === p ? styles.chipOn : ''}`}
              onClick={() => set('program', p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </>,
    // Step 3: Perfil pessoal
    <>
      <div className={styles.field}>
        <label className={styles.label}>Como quer ser chamado(a)?</label>
        <input
          className={styles.input}
          value={data.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Ex: Sams"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Instituição</label>
        <input
          className={styles.input}
          value={data.institution}
          onChange={(e) => set('institution', e.target.value)}
          placeholder="Ex: CIn/UFPE"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Orientador(a)</label>
        <input
          className={styles.input}
          value={data.advisor}
          onChange={(e) => set('advisor', e.target.value)}
          placeholder="Nome completo"
        />
      </div>
    </>,
    // Step 4: Keywords
    <>
      <div className={styles.field}>
        <label className={styles.label}>Termos para monitorar</label>
        <p className={styles.hint}>
          O Farol vai rastrear papers, posts e menções usando esses termos.
        </p>
        <div className={styles.tagInput}>
          <input
            className={styles.input}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Ex: SATD, microfrontend, technical debt..."
          />
          <button className={styles.addBtn} onClick={addKeyword}>
            +
          </button>
        </div>
        {data.keywords.length > 0 && (
          <div className={styles.tags}>
            {data.keywords.map((k, i) => (
              <span key={i} className={styles.tag}>
                {k}{' '}
                <span onClick={() => removeKeyword(i)} className={styles.tagRemove}>
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </>,
    // Step 5: Sources + Languages
    <>
      <div className={styles.field}>
        <label className={styles.label}>Fontes do Farol</label>

        {/* Fontes agrupadas por categoria */}
        {[
          { cat: 'academic', title: 'Acadêmicas' },
          { cat: 'community', title: 'Comunidade / Tech' },
          { cat: 'institutional', title: 'Institucionais' },
        ].map(({ cat, title }) => {
          const group = SOURCES.filter((s) => s.category === cat);
          if (group.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 10 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--tx3)', display: 'block', marginBottom: 4,
              }}>{title}</span>
              <div className={styles.chips}>
                {group.map((src) => {
                  const isRestricted = src.status === 'restricted';
                  const isSelected = data.sources.includes(src.label);
                  return (
                    <button
                      key={src.key}
                      className={`${styles.chip} ${isSelected ? styles.chipOn : ''}`}
                      onClick={() => !isRestricted && toggleMulti('sources', src.label)}
                      disabled={isRestricted}
                      title={src.hint || ''}
                      style={isRestricted ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    >
                      {src.label}
                      {isRestricted && (
                        <span style={{
                          fontSize: 9, marginLeft: 4, opacity: 0.7,
                          fontStyle: 'italic',
                        }}>em breve</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Idiomas</label>
        <div className={styles.chips}>
          {LANGS.map((l) => (
            <button
              key={l}
              className={`${styles.chip} ${data.languages.includes(l) ? styles.chipOn : ''}`}
              onClick={() => toggleMulti('languages', l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </>,
  ];

  const STEP_META = [
    {
      label: 'passo 1/6',
      title: 'Crie sua organização',
      desc: 'Um workspace agrupa todo o seu ambiente de pesquisa.',
    },
    {
      label: 'passo 2/6',
      title: 'Sua grande área',
      desc: 'Selecione a grande área do conhecimento da sua pesquisa.',
    },
    {
      label: 'passo 3/6',
      title: 'Subárea e programa',
      desc: 'Defina a subárea específica e o nível acadêmico.',
    },
    {
      label: 'passo 4/6',
      title: 'Seu perfil',
      desc: 'Informações básicas sobre você como pesquisador(a).',
    },
    {
      label: 'passo 5/6',
      title: 'Palavras-chave do Farol',
      desc: 'O Farol vai monitorar papers, threads e menções usando esses termos.',
    },
    {
      label: 'passo 6/6',
      title: 'Fontes e idiomas',
      desc: 'Escolha de onde e em quais idiomas o Farol busca informações.',
    },
  ];

  const meta = STEP_META[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <img src="/logo-white.png" alt="é›†" className={styles.headerLogo} />
        <div>
          <h1 className={styles.headerTitle}>
            <b>Summa</b>.sh
          </h1>
          <p className={styles.headerSub}>configure seu ambiente de pesquisa</p>
        </div>
      </div>

      {/* Progress dots */}
      <div className={styles.progress}>
        {STEP_META.map((_, i) => (
          <div
            key={i}
            className={`${styles.dot} ${i < step ? styles.dotDone : ''} ${
              i === step ? styles.dotCurrent : ''
            }`}
          />
        ))}
      </div>

      {/* Card */}
      <div className={styles.card} key={step}>
        <div className={styles.stepLabel}>{meta.label}</div>
        <div className={styles.stepTitle}>{meta.title}</div>
        <div className={styles.stepDesc}>{meta.desc}</div>

        {STEPS[step]}

        {/* Erro visível */}
        {error && (
          <div className={styles.errorBox}>{error}</div>
        )}

        {/* Nav */}
        <div className={styles.nav}>
          {step > 0 ? (
            <button className={styles.btn} onClick={() => setStep((s) => s - 1)} disabled={submitting}>
              <ArrowLeft size={16} /> Voltar
            </button>
          ) : (
            <div />
          )}

          {!isLast ? (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
            >
              Próximo <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleFinish}
              disabled={submitting}
            >
              <Sparkle size={16} weight="fill" />
              {submitting ? 'Criando...' : 'Iniciar Summa'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}