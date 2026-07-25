import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { MagnifyingGlass, Star } from '@phosphor-icons/react';
import { useReferences } from '../../hooks/useData';
import { toggleReferenceFavorite } from '../../store/slices/dataSlice';




const FILTERS = ['todos', 'papers', 'meus artigos', 'datasets', 'notas', 'favoritos'];

export function Acervo({ profileId }) {
  const references = useReferences(profileId);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const filtered = (references || []).filter((ref) => {
    if (activeFilter === 'papers') return ref.type === 'paper_read';
    if (activeFilter === 'meus artigos') return ref.type === 'my_article';
    if (activeFilter === 'datasets') return ref.type === 'dataset';
    if (activeFilter === 'favoritos') return ref.isFavorite;
    return true;
  }).filter((ref) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ref.title.toLowerCase().includes(q) ||
    ref.authors.toLowerCase().includes(q) ||
    ref.tags.some((t) => t.toLowerCase().includes(q));
  });

  return (
    <div className="animate-fade-in">
      {/* Search */}
      <div style={{ margin: '14px 0 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg2)', border: '1px solid var(--brd)',
          borderRadius: 'var(--r-md)', padding: '7px 12px'
        }}>
          <MagnifyingGlass size={14} color="var(--tx3)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="buscar no acervo..."
            style={{
              border: 'none', background: 'none', outline: 'none', flex: 1,
              fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--tx)'
            }} />
          
        </div>
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: 4, margin: '8px 0 12px', flexWrap: 'wrap' }}>
        {FILTERS.map((f) =>
        <button key={f} onClick={() => setActiveFilter(f)} style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
          border: `1px solid ${activeFilter === f ? 'var(--acc)' : 'var(--brd)'}`,
          background: activeFilter === f ? 'var(--acc)' : 'transparent',
          color: activeFilter === f ? 'var(--bg0)' : 'var(--tx2)',
          transition: 'all 0.18s'
        }}>
            {f}
          </button>
        )}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {filtered.map((ref) =>
        <ReferenceCard key={ref.id} reference={ref} profileId={profileId} />
        )}
      </div>

      {filtered.length === 0 &&
      <div style={{
        textAlign: 'center', padding: '40px 20px',
        color: 'var(--tx3)', fontFamily: 'var(--font-mono)', fontSize: 15
      }}>
          nenhum item encontrado
        </div>
      }
    </div>);

}

function ReferenceCard({ reference, profileId }) {
  const dispatch = useDispatch();
  const typeLabels = {
    paper_read: 'paper lido',
    my_article: 'meu artigo',
    dataset: 'dataset',
    book: 'livro',
    thesis: 'tese'
  };

  const toggleFavorite = async () => {
    if (reference.id) {
      await dispatch(toggleReferenceFavorite({ profileId, reference })).unwrap();
    }
  };

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--brd)',
      borderRadius: 'var(--r-md)', padding: 12, cursor: 'pointer',
      transition: 'all 0.2s', position: 'relative'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
          color: 'var(--acc)', textTransform: 'uppercase',
          letterSpacing: '0.06em'
        }}>
          {typeLabels[reference.type] || reference.type}
        </span>
        <button onClick={toggleFavorite} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: reference.isFavorite ? 'var(--acc)' : 'var(--tx3)',
          padding: 0, display: 'flex'
        }}>
          <Star size={12} weight={reference.isFavorite ? 'fill' : 'regular'} />
        </button>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 600,
        fontSize: 14, lineHeight: 1.35, margin: '6px 0 4px'
      }}>
        {reference.title}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx3)', marginBottom: 5
      }}>
        {reference.authors} Â· {reference.venue} {reference.year}
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {reference.tags.map((tag) =>
        <span key={tag} style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          padding: '1px 6px', borderRadius: 2,
          background: 'var(--bg3)', color: 'var(--tx2)',
          border: '1px solid var(--brd)'
        }}>
            {tag}
          </span>
        )}
      </div>
      {reference.personalNote &&
      <div style={{
        marginTop: 6, paddingTop: 6,
        borderTop: '1px dashed var(--brd)',
        fontSize: 14, color: 'var(--tx2)',
        fontStyle: 'italic', lineHeight: 1.4
      }}>
          "{reference.personalNote}"
        </div>
      }
    </div>);

}
