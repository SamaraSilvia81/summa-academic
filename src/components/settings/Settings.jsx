import { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  MagnifyingGlass, X, Plus, FloppyDisk, Sparkle, SignOut, Trash,
  PencilSimple, CaretDown, CaretUp, Eye, EyeSlash, Warning,
  User, Camera, DownloadSimple, ArrowsClockwise, Globe,
  LinkedinLogo, GraduationCap, Link as LinkIcon,
  RssSimple, CircleNotch, Check, XCircle,
} from '@phosphor-icons/react';
import { signOutUser, updateProfile, selectProfile } from '../../store/slices/authSlice';
import { useSettings } from '../../hooks/useData';
import { saveSettings } from '../../store/slices/dataSlice';
import { enrichAdvisor, hasGroqKey, setGroqKey } from '../../lib/ai';
import { uploadAvatar, uploadCover } from '../../lib/storage';
import { discoverRssFeeds } from '../../services/radarFetch';
import { SourceRepo } from '../../services/repositories';

const AREAS = [
  'Ciências Exatas e da Terra', 'Engenharias', 'Ciências da Saúde',
  'Ciências Biológicas', 'Ciências Humanas', 'Ciências Sociais Aplicadas',
  'Linguística, Letras e Artes', 'Multidisciplinar',
];
const PROGRAMS = ['Mestrado', 'Doutorado', 'Pós-doc', 'Graduação', 'Independente'];
import { SOURCES, SOURCES_BY_LABEL, labelToKey, keyToLabel } from '../../lib/sourcesConfig';
const LANGS_MAP = { 'Português': 'pt', 'English': 'en', 'Español': 'es', 'Français': 'fr', '日本語': 'ja' };
const LANGS_REV = Object.fromEntries(Object.entries(LANGS_MAP).map(([k, v]) => [v, k]));
const SYS_LANGS = [
  { code: 'pt', label: 'Português (Brasil)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

// ── Custom Toggle (substitui checkbox nativo) ────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
      fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)',
      padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--r-md)',
      border: '1px solid var(--brd)', marginBottom: 8, userSelect: 'none',
    }}>
      <div
        onClick={e => { e.preventDefault(); onChange(!checked); }}
        style={{
          width: 36, height: 20, borderRadius: 10, flexShrink: 0,
          background: checked ? 'var(--acc)' : 'var(--bg3)',
          border: `1px solid ${checked ? 'var(--acc)' : 'var(--brd)'}`,
          position: 'relative', transition: 'background 0.2s, border-color 0.2s',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: checked ? 'var(--bg0)' : 'var(--tx3)',
          position: 'absolute', top: 2,
          left: checked ? 18 : 2,
          transition: 'left 0.2s, background 0.15s',
        }} />
      </div>
      {label}
    </label>
  );
}

function Section({ title, icon: Icon, children, danger = false }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      marginBottom: 20, padding: '20px 24px',
      background: danger ? 'rgba(248,113,113,0.04)' : 'var(--bg1)',
      border: `1px solid ${danger ? 'rgba(248,113,113,0.15)' : 'var(--brd)'}`,
      borderRadius: 12,
    }}>
      <div onClick={() => setOpen(o => !o)} style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
        color: danger ? '#F87171' : 'var(--acc)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'pointer', userSelect: 'none',
      }}>
        {Icon && <Icon size={14} weight="bold" />}
        {title}
        <span style={{ marginLeft: 'auto' }}>{open ? <CaretUp size={12} /> : <CaretDown size={12} />}</span>
      </div>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

function FieldRow({ label, value, onChange, placeholder, disabled }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{ width: '100%', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', outline: 'none' }} />
    </div>
  );
}

function ChipSelect({ options, selected, onChange, multi = false }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
      {options.map(opt => {
        const isOn = multi ? selected?.includes(opt) : selected === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s',
            background: isOn ? 'var(--acc)' : 'var(--bg2)', color: isOn ? 'var(--bg0)' : 'var(--tx2)',
            border: `1px solid ${isOn ? 'var(--acc)' : 'var(--brd)'}`, fontWeight: isOn ? 600 : 400,
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

function TagEditor({ tags, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState('');
  const handleAdd = () => { if (input.trim() && !tags.includes(input.trim())) { onAdd(input.trim()); setInput(''); }};
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          style={{ flex: 1, padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', outline: 'none' }} />
        <button onClick={handleAdd} style={{ padding: '6px 14px', background: 'var(--acc)', color: 'var(--bg0)', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
          <Plus size={14} weight="bold" />
        </button>
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map((t, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--acc-bg)', color: 'var(--acc)', borderRadius: 14, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              {t}<X size={11} weight="bold" onClick={() => onRemove(i)} style={{ cursor: 'pointer', opacity: 0.7 }} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveBtn({ dirty, saving, onSave }) {
  if (!dirty) return null;
  return (
    <button onClick={onSave} disabled={saving} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', marginTop: 10,
      background: 'var(--acc)', color: 'var(--bg0)', border: 'none', borderRadius: 'var(--r-md)',
      cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
      opacity: saving ? 0.6 : 1,
    }}><FloppyDisk size={14} weight="bold" />{saving ? 'Salvando...' : 'Salvar'}</button>
  );
}

// ── Main ─────────────────────────────────────────────────────

export function Settings({ profileId }) {
  const dispatch = useDispatch();
  const profile = useSelector(selectProfile);
  const user = useSelector(state => state.auth.user);
  const settings = useSettings(profileId);
  const avatarInputRef = useRef(null);
  const heroInputRef = useRef(null);

  const [pName, setPName] = useState('');
  const [pInstitution, setPInstitution] = useState('');
  const [pAdvisor, setPAdvisor] = useState('');
  const [pArea, setPArea] = useState('');
  const [pSubarea, setPSubarea] = useState('');
  const [pProgram, setPProgram] = useState('');
  const [pKeywords, setPKeywords] = useState([]);
  const [pSources, setPSources] = useState([]);
  const [pLanguages, setPLanguages] = useState([]);
  const [pLinkedin, setPLinkedin] = useState('');
  const [pLattes, setPLattes] = useState('');

  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorInfo, setAdvisorInfo] = useState(null);
  const [groqKey, setGroqKeyState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [uploading, setUploading] = useState('');

  // RSS custom sources
  const [rssUrl, setRssUrl] = useState('');
  const [rssName, setRssName] = useState('');
  const [rssDiscovering, setRssDiscovering] = useState(false);
  const [rssFeeds, setRssFeeds] = useState(null); // null | { feeds, isDirect }
  const [rssError, setRssError] = useState('');
  const [rssSaving, setRssSaving] = useState(false);
  const [customSources, setCustomSources] = useState([]); // rows from sources table with type='rss'

  // Load custom RSS sources on mount
  useEffect(() => {
    if (!profileId) return;
    SourceRepo.getAll(profileId).then((rows) => {
      setCustomSources((rows || []).filter((r) => r.type === 'rss'));
    });
  }, [profileId]);

  const avatarUrl = profile?.avatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const coverUrl = profile?.coverUrl || null;
  const initials = (pName || '?').split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0, 2).join('');

  const handleFileUpload = async (type, file) => {
    if (!file || !user?.id) return;
    setUploading(type);
    try {
      const url = type === 'avatar'
        ? await uploadAvatar(user.id, file)
        : await uploadCover(user.id, file);

      await dispatch(updateProfile({
        profileId,
        data: { [type === 'avatar' ? 'avatarUrl' : 'coverUrl']: url },
      })).unwrap();

      setMsg(`${type === 'avatar' ? 'Avatar' : 'Capa'} atualizado!`);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error(`[summa] upload ${type} error:`, err);
      setMsg(`Erro ao enviar ${type}: ${err.message}`);
    } finally {
      setUploading('');
    }
  };

  useEffect(() => {
    if (!profile) return;
    setPName(profile.name || '');
    setPInstitution(profile.institution || '');
    setPAdvisor(profile.advisor || '');
    setPArea(profile.grandeArea || '');
    setPSubarea(profile.subarea || '');
    setPProgram(profile.program || 'mestrado');
    setPKeywords(profile.keywords || []);
    setPSources((profile.sources || []).map(s => keyToLabel(s)));
    setPLanguages((profile.languages || []).map(l => LANGS_REV[l] || l));
    setPLinkedin(profile.linkedinUrl || '');
    setPLattes(profile.lattesUrl || '');
  }, [profile]);

  useEffect(() => { setGroqKeyState(localStorage.getItem('summa_groq_key') || ''); }, []);

  const markDirty = useCallback(() => setDirty(true), []);

  const searchAdvisor = async () => {
    if (!pAdvisor.trim() || !hasGroqKey()) return;
    setAdvisorLoading(true); setAdvisorInfo(null);
    try { setAdvisorInfo(await enrichAdvisor(pAdvisor.trim(), pInstitution)); }
    catch (err) { setAdvisorInfo({ found: false, summary: err.message, areas: [], keywords: [] }); }
    finally { setAdvisorLoading(false); }
  };

  const saveProfile = async () => {
    setSaving(true); setMsg('');
    try {
      await dispatch(updateProfile({ profileId, data: {
        name: pName, institution: pInstitution, advisor: pAdvisor,
        grandeArea: pArea, subarea: pSubarea, program: pProgram.toLowerCase(),
        keywords: pKeywords, areas: [pArea, pSubarea],
        languages: pLanguages.map(l => LANGS_MAP[l] || l),
        sources: pSources.map(s => labelToKey(s)),
        linkedinUrl: pLinkedin, lattesUrl: pLattes,
        advisorMeta: advisorInfo?.found ? advisorInfo : undefined,
      }})).unwrap();
      setDirty(false); setMsg('Perfil salvo!'); setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err?.message || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const toggle = async (field, value) => { await dispatch(saveSettings({ profileId, data: { [field]: value } })).unwrap(); };
  const handleSignOut = async () => { await dispatch(signOutUser()).unwrap(); window.location.reload(); };
  const saveGroqKeyFn = () => { setGroqKey(groqKey.trim()); setMsg('Chave Groq salva!'); setTimeout(() => setMsg(''), 3000); };

  // ── RSS handlers ──────────────────────────────────────────────
  const handleRssDiscover = async () => {
    if (!rssUrl.trim()) return;
    setRssDiscovering(true);
    setRssError('');
    setRssFeeds(null);
    try {
      const result = await discoverRssFeeds(rssUrl.trim());
      if (result.feeds.length === 0) {
        setRssError('Nenhum feed RSS/Atom encontrado nessa URL.');
      } else {
        setRssFeeds(result);
        // Se achou feed direto e não tem nome, preenche com o hostname
        if (!rssName.trim()) {
          try { setRssName(new URL(rssUrl.trim()).hostname.replace('www.', '')); } catch {}
        }
      }
    } catch (err) {
      setRssError(err.message || 'Erro ao buscar feed.');
    } finally {
      setRssDiscovering(false);
    }
  };

  const handleRssSave = async (feedUrl) => {
    if (!feedUrl || !rssName.trim() || !profileId) return;
    setRssSaving(true);
    setRssError('');
    try {
      await SourceRepo.create({
        profileId,
        name: rssName.trim(),
        type: 'rss',
        url: feedUrl,
        isActive: true,
        lastFetchedAt: null,
        fetchIntervalMinutes: 360,
      });
      // Refresh custom sources list
      const rows = await SourceRepo.getAll(profileId);
      setCustomSources((rows || []).filter((r) => r.type === 'rss'));
      // Reset form
      setRssUrl('');
      setRssName('');
      setRssFeeds(null);
      setMsg('Fonte RSS adicionada!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setRssError(err.message || 'Erro ao salvar fonte.');
    } finally {
      setRssSaving(false);
    }
  };

  const handleRssRemove = async (id) => {
    try {
      await SourceRepo.update(id, { isActive: false });
      setCustomSources((prev) => prev.filter((s) => s.id !== id));
      setMsg('Fonte removida.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message || 'Erro ao remover.');
    }
  };

  if (!settings || !profile) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>

      {/* ═══ HERO + AVATAR ═══ */}
      <div style={{ position: 'relative', marginBottom: 48, marginTop: 8 }}>
        {/* Hero banner — clicável pra trocar */}
        <div
          onClick={() => heroInputRef.current?.click()}
          style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden', height: 140,
            backgroundImage: `url(${coverUrl || '/wpp-summa-login.png'})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: '1px solid var(--brd)', cursor: 'pointer',
          }}
          title="Clique pra trocar a imagem de capa"
        >
          {/* Overlay escuro + grainy */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/grainly-texture.png)', backgroundSize: '320px', backgroundRepeat: 'repeat', opacity: 0.04, mixBlendMode: 'screen' }} />
          {/* Edit hint */}
          <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'rgba(0,0,0,0.5)', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff' }}>
            <Camera size={12} />{uploading === 'cover' ? 'enviando...' : 'trocar capa'}
          </div>
        </div>

        {/* Avatar — sobreposto ao hero, maior (96px) */}
        <div
          onClick={() => avatarInputRef.current?.click()}
          style={{
            position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)',
            width: 96, height: 96, borderRadius: '50%',
            border: '4px solid var(--bg1)', overflow: 'hidden',
            background: 'var(--acc)', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
          title="Clique pra trocar o avatar"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
          ) : null}
          <div style={{
            width: '100%', height: '100%', display: avatarUrl ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: 'var(--bg0)', fontFamily: 'var(--font-mono)',
          }}>
            {initials}
          </div>
          {/* Hover overlay */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.15s', borderRadius: '50%',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}
          >
            <Camera size={24} color="#fff" />
          </div>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFileUpload('avatar', e.target.files[0])} />
        <input ref={heroInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFileUpload('cover', e.target.files[0])} />
      </div>

      {/* Nome + email */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--tx)' }}>{pName}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', marginTop: 3 }}>
          {user?.email} · {pInstitution}
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '8px 14px', marginBottom: 14, borderRadius: 'var(--r-md)', textAlign: 'center',
          background: msg.includes('Erro') ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
          color: msg.includes('Erro') ? '#F87171' : '#4ADE80',
          fontFamily: 'var(--font-mono)', fontSize: 13,
          border: `1px solid ${msg.includes('Erro') ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
        }}>{msg}</div>
      )}

      {/* ═══ PERFIL ═══ */}
      <Section title="perfil" icon={User}>
        <FieldRow label="Nome" value={pName} onChange={v => { setPName(v); markDirty(); }} placeholder="Como quer ser chamado(a)" />
        <FieldRow label="Instituição" value={pInstitution} onChange={v => { setPInstitution(v); markDirty(); }} placeholder="Ex: CIn/UFPE" />

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Orientador(a)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={pAdvisor} onChange={e => { setPAdvisor(e.target.value); markDirty(); }} placeholder="Nome completo"
              style={{ flex: 1, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', outline: 'none' }} />
            <button onClick={searchAdvisor} disabled={advisorLoading || !pAdvisor.trim() || !hasGroqKey()}
              title={!hasGroqKey() ? 'Configure a chave Groq primeiro' : 'Buscar orientador'}
              style={{ padding: '6px 12px', background: 'var(--bg2)', color: 'var(--acc)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', cursor: 'pointer', opacity: advisorLoading || !pAdvisor.trim() || !hasGroqKey() ? 0.4 : 1 }}>
              {advisorLoading ? <Sparkle size={16} /> : <MagnifyingGlass size={16} />}
            </button>
          </div>
          {advisorInfo && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--brd)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--tx2)', lineHeight: 1.6 }}>
              {advisorInfo.found ? (
                <>
                  <div style={{ color: 'var(--acc)', fontWeight: 600, marginBottom: 4 }}><Sparkle size={12} weight="fill" style={{ marginRight: 4 }} />Perfil encontrado</div>
                  <div>{advisorInfo.summary}</div>
                  {advisorInfo.keywords?.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{ color: 'var(--tx3)' }}>Keywords: </span>
                      {advisorInfo.keywords.map((kw, i) => (
                        <button key={i} onClick={() => { if (!pKeywords.includes(kw)) { setPKeywords(prev => [...prev, kw]); markDirty(); }}}
                          style={{ display: 'inline', background: 'none', border: 'none', color: 'var(--acc)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, fontFamily: 'var(--font-mono)', padding: 0, marginRight: 6 }}>+{kw}</button>
                      ))}
                    </div>
                  )}
                </>
              ) : <div style={{ color: 'var(--tx3)' }}>{advisorInfo.summary || 'Não identificado.'}</div>}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Programa</label>
          <ChipSelect options={PROGRAMS} selected={PROGRAMS.find(p => p.toLowerCase() === pProgram) || pProgram} onChange={v => { setPProgram(v); markDirty(); }} />
        </div>

        <SaveBtn dirty={dirty} saving={saving} onSave={saveProfile} />
      </Section>

      {/* ═══ REDES ACADÊMICAS ═══ */}
      <Section title="redes acadêmicas" icon={LinkIcon}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <LinkedinLogo size={13} weight="bold" />LinkedIn
          </label>
          <input value={pLinkedin} onChange={e => { setPLinkedin(e.target.value); markDirty(); }}
            placeholder="https://linkedin.com/in/seu-perfil"
            style={{ width: '100%', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <GraduationCap size={13} weight="bold" />Lattes
          </label>
          <input value={pLattes} onChange={e => { setPLattes(e.target.value); markDirty(); }}
            placeholder="http://lattes.cnpq.br/seu-id"
            style={{ width: '100%', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', outline: 'none' }} />
        </div>
        <SaveBtn dirty={dirty} saving={saving} onSave={saveProfile} />
      </Section>

      {/* ═══ ÁREA DE PESQUISA ═══ */}
      <Section title="área de pesquisa" icon={MagnifyingGlass}>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Grande área</label>
        <ChipSelect options={AREAS} selected={pArea} onChange={v => { setPArea(v); markDirty(); }} />
        <FieldRow label="Subárea" value={pSubarea} onChange={v => { setPSubarea(v); markDirty(); }} placeholder="Ex: Engenharia de Software" />
        <SaveBtn dirty={dirty} saving={saving} onSave={saveProfile} />
      </Section>

      {/* ═══ PALAVRAS-CHAVE ═══ */}
      <Section title="palavras-chave" icon={Sparkle}>
        <TagEditor tags={pKeywords} onAdd={kw => { setPKeywords(prev => [...prev, kw]); markDirty(); }} onRemove={i => { setPKeywords(prev => prev.filter((_, idx) => idx !== i)); markDirty(); }} placeholder="Ex: SATD, microfrontend..." />
        <SaveBtn dirty={dirty} saving={saving} onSave={saveProfile} />
      </Section>

      {/* ═══ FONTES E IDIOMAS ═══ */}
      <Section title="fontes e idiomas" icon={Globe}>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Fontes</label>
        {[
          { cat: 'academic', title: 'Acadêmicas' },
          { cat: 'community', title: 'Comunidade / Tech' },
          { cat: 'institutional', title: 'Institucionais' },
        ].map(({ cat, title }) => {
          const group = SOURCES.filter((s) => s.category === cat);
          if (group.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--tx3)', display: 'block', marginBottom: 4,
                letterSpacing: '0.04em',
              }}>{title}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.map((src) => {
                  const isRestricted = src.status === 'restricted';
                  const isOn = pSources.includes(src.label);
                  return (
                    <button key={src.key}
                      onClick={() => { if (!isRestricted) { setPSources(prev => prev.includes(src.label) ? prev.filter(s => s !== src.label) : [...prev, src.label]); markDirty(); } }}
                      title={src.hint || ''}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 12,
                        fontFamily: 'var(--font-mono)', cursor: isRestricted ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        background: isOn ? 'var(--acc)' : 'var(--bg2)',
                        color: isOn ? 'var(--bg0)' : 'var(--tx2)',
                        border: `1px solid ${isOn ? 'var(--acc)' : 'var(--brd)'}`,
                        fontWeight: isOn ? 600 : 400,
                        opacity: isRestricted ? 0.45 : 1,
                      }}
                    >
                      {src.label}
                      {isRestricted && (
                        <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7, fontStyle: 'italic' }}>
                          em breve
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Fontes RSS customizadas ── */}
        <div style={{
          marginTop: 14, marginBottom: 14, padding: '14px 16px',
          background: 'var(--bg1)', border: '1px solid var(--brd)',
          borderRadius: 'var(--r-md)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          }}>
            <RssSimple size={14} style={{ color: 'var(--acc)' }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>Fonte customizada (RSS/Atom)</span>
          </div>

          {/* Lista de custom sources existentes */}
          {customSources.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {customSources.map((src) => (
                <div key={src.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', marginBottom: 4,
                  background: 'var(--bg2)', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--brd)',
                }}>
                  <RssSimple size={12} style={{ color: 'var(--acc)', flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{src.name}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)',
                    flexShrink: 0, maxWidth: 180,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{src.url}</span>
                  <button onClick={() => handleRssRemove(src.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--tx3)', padding: 2, display: 'flex',
                  }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de adição */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              value={rssUrl}
              onChange={(e) => { setRssUrl(e.target.value); setRssFeeds(null); setRssError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRssDiscover())}
              placeholder="URL do site ou feed RSS"
              style={{
                flex: 1, padding: '7px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)',
                background: 'var(--bg2)', border: '1px solid var(--brd)',
                borderRadius: 'var(--r-sm)', outline: 'none',
              }}
            />
            <button
              onClick={handleRssDiscover}
              disabled={rssDiscovering || !rssUrl.trim()}
              style={{
                padding: '6px 14px', borderRadius: 'var(--r-sm)', border: 'none',
                background: 'var(--acc)', color: 'var(--bg0)', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: rssDiscovering || !rssUrl.trim() ? 0.5 : 1,
              }}
            >
              {rssDiscovering
                ? <CircleNotch size={13} className="animate-spin" />
                : <MagnifyingGlass size={13} />
              }
              {rssDiscovering ? 'buscando...' : 'detectar feed'}
            </button>
          </div>

          {/* Erro */}
          {rssError && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F87171',
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6,
            }}>
              <XCircle size={12} /> {rssError}
            </div>
          )}

          {/* Feeds encontrados */}
          {rssFeeds && rssFeeds.feeds.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)',
                marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Check size={11} style={{ color: '#4ADE80' }} />
                {rssFeeds.feeds.length === 1
                  ? 'Feed encontrado'
                  : `${rssFeeds.feeds.length} feeds encontrados`
                }
              </div>

              {/* Nome da fonte */}
              <input
                value={rssName}
                onChange={(e) => setRssName(e.target.value)}
                placeholder="Nome da fonte (ex: Blog do Prof. Silva)"
                style={{
                  width: '100%', padding: '7px 12px', marginBottom: 8,
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)',
                  background: 'var(--bg2)', border: '1px solid var(--brd)',
                  borderRadius: 'var(--r-sm)', outline: 'none', boxSizing: 'border-box',
                }}
              />

              {/* Lista de feeds pra escolher */}
              {rssFeeds.feeds.map((feed, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', marginBottom: 4,
                  background: 'var(--bg2)', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--brd)',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx2)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{feed.title || feed.url}</span>
                  <button
                    onClick={() => handleRssSave(feed.url)}
                    disabled={rssSaving || !rssName.trim()}
                    style={{
                      padding: '3px 10px', borderRadius: 14, border: 'none',
                      background: '#4ADE80', color: '#000', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                      opacity: rssSaving || !rssName.trim() ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    <Plus size={11} weight="bold" />
                    adicionar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Idiomas dos papers</label>
        <ChipSelect options={Object.keys(LANGS_MAP)} selected={pLanguages} multi onChange={v => { setPLanguages(prev => prev.includes(v) ? prev.filter(l => l !== v) : [...prev, v]); markDirty(); }} />

        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4, marginTop: 12 }}>Idioma do sistema</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {SYS_LANGS.map(lang => (
            <button key={lang.code} onClick={() => toggle('language', lang.code)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s',
              background: settings.language === lang.code ? 'var(--acc)' : 'var(--bg2)',
              color: settings.language === lang.code ? 'var(--bg0)' : 'var(--tx2)',
              border: `1px solid ${settings.language === lang.code ? 'var(--acc)' : 'var(--brd)'}`,
              fontWeight: settings.language === lang.code ? 600 : 400,
            }}>{lang.label}</button>
          ))}
        </div>
        <SaveBtn dirty={dirty} saving={saving} onSave={saveProfile} />
      </Section>

      {/* ═══ APARÊNCIA ═══ */}
      <Section title="aparência" icon={Eye}>
        <Toggle label="Tema escuro" checked={settings.theme === 'dark'} onChange={v => toggle('theme', v ? 'dark' : 'light')} />
        <Toggle label="Grain (textura gouache)" checked={settings.grain} onChange={v => toggle('grain', v)} />
        <Toggle label="Scanlines (CRT)" checked={settings.scanlines} onChange={v => toggle('scanlines', v)} />
      </Section>

      {/* ═══ IA ═══ */}
      <Section title="ia · groq" icon={Sparkle}>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>API Key (Groq)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)' }}>
            <input type={showKey ? 'text' : 'password'} value={groqKey} onChange={e => setGroqKeyState(e.target.value)} placeholder="gsk_..."
              style={{ flex: 1, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', background: 'transparent', border: 'none', outline: 'none' }} />
            <button onClick={() => setShowKey(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: '4px 8px' }}>
              {showKey ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button onClick={saveGroqKeyFn} style={{ padding: '6px 14px', background: 'var(--acc)', color: 'var(--bg0)', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
            <FloppyDisk size={14} weight="bold" />
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
          Necessário pra busca do orientador e sugestões da IA. Pega grátis em console.groq.com
        </div>
      </Section>

      {/* ═══ ZONA DE PERIGO ═══ */}
      <Section title="zona de perigo" icon={Warning} danger>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--brd)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>Exportar dados (backup)</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>Baixa um JSON com todos os seus dados</div>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: 'var(--bg3)', color: 'var(--tx2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <DownloadSimple size={14} />Exportar
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', border: '1px solid var(--brd)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>Transferir dados</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>Transfere seus documentos para outro usuário</div>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: 'var(--bg3)', color: 'var(--tx2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <ArrowsClockwise size={14} />Transferir
            </button>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(248,113,113,0.06)', borderRadius: 'var(--r-md)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#F87171', fontWeight: 500, marginBottom: 4 }}>Apagar conta permanentemente</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginBottom: 8 }}>Isso apaga todos os seus dados. Não tem volta.</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder='Digite "apagar minha conta"'
                style={{ flex: 1, padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)', background: 'var(--bg2)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--r-sm)', outline: 'none' }} />
              <button disabled={deleteConfirm !== 'apagar minha conta'} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
                background: deleteConfirm === 'apagar minha conta' ? '#EF4444' : 'var(--bg3)',
                color: deleteConfirm === 'apagar minha conta' ? '#fff' : 'var(--tx3)',
                border: 'none', borderRadius: 'var(--r-md)',
                cursor: deleteConfirm === 'apagar minha conta' ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
              }}><Trash size={14} />Apagar</button>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ SAIR ═══ */}
      <button onClick={handleSignOut} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
        padding: '14px 16px', marginBottom: 20,
        background: 'var(--bg1)', color: 'var(--tx2)',
        border: '1px solid var(--brd)', borderRadius: 12, cursor: 'pointer',
        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
        transition: 'border-color 0.15s, color 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'; e.currentTarget.style.color = '#F87171'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)'; e.currentTarget.style.color = 'var(--tx2)'; }}
      >
        <SignOut size={16} />Sair do Summa
      </button>

      {/* Sobre */}
      <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)', lineHeight: 1.8, marginBottom: 40, opacity: 0.6 }}>
        <b style={{ color: 'var(--acc)' }}>summa.sh</b> v0.9.0-beta · @devs_sam
      </div>
    </div>
  );
}