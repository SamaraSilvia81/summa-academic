import { useDispatch } from 'react-redux';
import { BookmarkSimple, X } from '@phosphor-icons/react';
import { useRadarItems, useRadarStats, useNotes, useRadarCfps } from '../../hooks/useData';
import { dismissRadarItem, markRadarItemRead, toggleRadarSave } from '../../store/slices/dataSlice';






export function Farol({ profileId }) {
  const items = useRadarItems(profileId);
  const stats = useRadarStats(profileId);
  const notes = useNotes(profileId, 'np');
  const cfps = useRadarCfps(profileId);

  const papers = items?.filter((i) => i.type === 'paper' || i.type === 'post' || i.type === 'thread') || [];

  return (
    <div className="animate-fade-in">
      {/* Banner */}
      <div style={{
        width: '100%', height: 140, borderRadius: 'var(--r-xl)',
        overflow: 'hidden', margin: '14px 0 16px',
        position: 'relative', border: '1px solid var(--brd)',
        background: 'linear-gradient(135deg, var(--bg2), var(--bg3))'
      }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '14px 18px',
          background: 'linear-gradient(135deg, rgba(4,7,13,0.8), rgba(4,7,13,0.3))'
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 17, color: '#fff'
          }}>
            Boa {getGreeting()}, Sams.
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 14,
            color: 'rgba(255,255,255,0.5)', marginTop: 2
          }}>
            {formatDate(new Date())} Â· semana {getWeekNumber()}
          </div>
        </div>
        <div style={{
          position: 'absolute', top: 10, right: 12, zIndex: 4,
          fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--acc)',
          background: 'rgba(4,7,13,0.7)', padding: '2px 8px',
          borderRadius: 3, border: '1px dashed rgba(212,160,48,0.3)'
        }}>
          farol://radar
        </div>
      </div>

      {/* Stats */}
      {stats &&
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6, marginBottom: 14
      }}>
          <StatCard value={String(stats.papers).padStart(2, '0')} label="papers" />
          <StatCard value={String(stats.threads).padStart(2, '0')} label="threads" />
          <StatCard value={String(stats.cfps).padStart(2, '0')} label="cfps" />
          <StatCard value={`${stats.avgRelevance}%`} label="relevância" />
        </div>
      }

      {/* Informe */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--brd)',
        borderRadius: 'var(--r-xl)', padding: '14px 16px',
        marginBottom: 14, borderLeft: '3px solid var(--acc)'
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--acc)', marginBottom: 6
        }}>
          {'>'} informe semanal
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600,
          fontSize: 15, marginBottom: 4
        }}>
          Resumo das suas áreas de pesquisa
        </div>
        <div style={{ fontSize: 15, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 10 }}>
          {stats ? `${stats.total} itens monitorados, ${stats.unread} não lidos esta semana.` : 'Carregando...'}
        </div>
      </div>

      {/* Papers */}
      <SectionHeader title="papers recentes" linkText="ver todos →" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {papers.slice(0, 4).map((item) =>
        <RadarCard key={item.id} item={item} profileId={profileId} />
        )}
      </div>

      {/* CFPs */}
      {cfps && cfps.length > 0 &&
      <>
          <SectionHeader title="oportunidades" linkText="ver todas â†’" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {cfps.map((item) =>
          <RadarCard key={item.id} item={item} profileId={profileId} />
          )}
          </div>
        </>
      }

      {/* NPs */}
      {notes && notes.length > 0 &&
      <>
          <SectionHeader title="notas de pesquisa" linkText="todas â†’" />
          {notes.slice(0, 3).map((note) =>
        <NoteCard key={note.id} note={note} />
        )}
        </>
      }
    </div>);

}

// â”€â”€ Sub-components â”€â”€

function StatCard({ value, label }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--brd)',
      borderRadius: 'var(--r-md)', padding: '12px 14px',
      transition: 'border-color 0.2s', cursor: 'default'
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700,
        fontSize: 22, color: 'var(--acc)',
        textShadow: '0 0 12px var(--acc-glow)',
        letterSpacing: '-0.02em'
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        color: 'var(--tx3)', marginTop: 2,
        textTransform: 'uppercase', letterSpacing: '0.04em'
      }}>
        {label}
      </div>
    </div>);

}

function SectionHeader({ title, linkText }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      margin: '18px 0 10px'
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14,
        color: 'var(--tx)', textTransform: 'uppercase',
        letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8
      }}>
        <span style={{
          width: 3, height: 12, background: 'var(--acc)',
          borderRadius: 1, display: 'inline-block'
        }} />
        {title}
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 14,
        color: 'var(--acc)', cursor: 'pointer', opacity: 0.7
      }}>
        {linkText}
      </span>
    </div>);

}

function RadarCard({ item, profileId }) {
  const dispatch = useDispatch();
  const handleSave = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(toggleRadarSave({ profileId, id: item.id })).unwrap();
  };

  const handleDismiss = async (e) => {
    e.stopPropagation();
    if (item.id) await dispatch(dismissRadarItem({ profileId, id: item.id })).unwrap();
  };

  const handleRead = async () => {
    if (item.id && !item.isRead) await dispatch(markRadarItemRead({ profileId, id: item.id })).unwrap();
  };

  return (
    <div onClick={handleRead} style={{
      background: 'var(--bg2)', borderRadius: 'var(--r-md)',
      padding: '12px 14px', border: '1px solid var(--brd)',
      cursor: 'pointer', transition: 'all 0.2s',
      position: 'relative', opacity: item.isRead ? 0.7 : 1
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        color: 'var(--tx3)', marginBottom: 6
      }}>
        {item.source} {item.type === 'cfp' && item.deadline ? `Â· deadline: ${item.deadline}` : ''}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 600,
        fontSize: 15, lineHeight: 1.4, marginBottom: 4
      }}>
        {item.title}
      </div>
      {item.authors &&
      <div style={{ fontSize: 14, color: 'var(--tx2)', marginBottom: 8 }}>
          {item.authors}
        </div>
      }
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
          padding: '2px 7px', borderRadius: 3,
          background: 'var(--acc-bg)', color: 'var(--acc)',
          border: '1px dashed rgba(212,160,48,0.15)'
        }}>
          {item.relevanceScore}%
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleSave} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: item.isSaved ? 'var(--acc)' : 'var(--tx3)',
            padding: 2, display: 'flex'
          }}>
            {item.isSaved ? <BookmarkSimple size={14} weight="fill" /> : <BookmarkSimple size={14} />}
          </button>
          <button onClick={handleDismiss} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--tx3)', padding: 2, display: 'flex'
          }}>
            <X size={14} />
          </button>
        </div>
      </div>
    </div>);

}

function NoteCard({ note }) {
  return (
    <div style={{
      background: 'var(--bg2)', borderRadius: 'var(--r-md)',
      padding: '12px 14px', border: '1px solid var(--brd)',
      marginBottom: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
          background: 'var(--acc)', color: 'var(--bg0)',
          padding: '2px 6px', borderRadius: 3
        }}>NP</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx3)' }}>
          {formatDate(note.createdAt)}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-quote)', fontSize: 15, lineHeight: 1.65,
        padding: '10px 12px', background: 'var(--bg1)',
        borderRadius: 'var(--r-md)',
        borderLeft: '2px solid var(--acc)',
        fontStyle: 'italic', color: 'var(--tx)'
      }}>
        {note.content}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        color: 'var(--tx3)', marginTop: 6,
        display: 'flex', gap: 8
      }}>
        <span>{note.source}</span>
        <span style={{ color: 'var(--acc)', cursor: 'pointer' }}>copiar p/ post-it</span>
      </div>
    </div>);

}

// â”€â”€ Helpers â”€â”€
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'dia';
  if (h < 18) return 'tarde';
  return 'noite';
}

function getWeekNumber() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

function formatDate(d) {
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}
