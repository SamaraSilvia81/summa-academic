import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Graph as GraphIcon, Star, ArrowSquareOut, TagSimple, X,
  Crosshair, MagnifyingGlassPlus, MagnifyingGlassMinus,
} from '@phosphor-icons/react';
import { buildGraph, simulateLayout } from '../../lib/forceGraph';

const TYPE_LABELS = {
  paper_read: 'paper', my_article: 'meu artigo', dataset: 'dataset',
  book: 'livro', thesis: 'tese', note: 'nota',
  post: 'artigo', thread: 'thread', news: 'notícia', cfp: 'CFP',
};

const W = 880, H = 520;
const MIN_SCALE = 0.55, MAX_SCALE = 2.4;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Ponto de controle pra uma curva suave entre dois nós (em vez de linha reta)
function arcPath(x1, y1, x2, y2, bend) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const nx = -dy, ny = dx;
  const len = Math.sqrt(nx * nx + ny * ny) || 1;
  const cx = mx + (nx / len) * bend;
  const cy = my + (ny / len) * bend;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export function ReferenceGraph({ references, profileId }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragState = useRef(null);
  const wrapRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const { nodes, edges } = useMemo(() => buildGraph(references, { maxNodes: 26 }), [references]);
  const positions = useMemo(() => simulateLayout(nodes, edges, { width: W, height: H }), [nodes, edges]);
  const posById = useMemo(() => Object.fromEntries(positions.map(p => [p.id, p])), [positions]);

  const labeledIds = useMemo(() => {
    return new Set([...nodes].sort((a, b) => b.degree - a.degree).slice(0, 7).map(n => n.id));
  }, [nodes]);

  const selected = nodes.find(n => n.id === selectedId) || null;
  const activeId = hoverId ?? selectedId;
  const neighborEdges = useMemo(() => {
    if (!activeId) return [];
    return edges.filter(e => e.a === activeId || e.b === activeId);
  }, [activeId, edges]);
  const neighborIds = useMemo(() => {
    if (!activeId) return null;
    const s = new Set([activeId]);
    neighborEdges.forEach(e => { s.add(e.a); s.add(e.b); });
    return s;
  }, [activeId, neighborEdges]);

  const topConnections = useMemo(() => {
    if (!selected) return [];
    return [...neighborEdges]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(e => {
        const otherId = e.a === selected.id ? e.b : e.a;
        const otherNode = nodes.find(n => n.id === otherId);
        return otherNode ? { node: otherNode, weight: e.weight, shared: e.shared } : null;
      })
      .filter(Boolean);
  }, [selected, neighborEdges, nodes]);

  const legendTypes = useMemo(() => {
    const seen = new Map();
    nodes.forEach(n => { if (!seen.has(n.ref.type)) seen.set(n.ref.type, n.color); });
    return [...seen.entries()];
  }, [nodes]);

  const openInAcervo = (id) => navigate('/acervo/referencias', { state: { openRefId: id } });

  // ── Zoom (wheel nativo, pra poder preventDefault de verdade) ──
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      const py = ((e.clientY - rect.top) / rect.height) * H;
      setView(v => {
        const next = clamp(v.scale * (e.deltaY > 0 ? 0.9 : 1.1), MIN_SCALE, MAX_SCALE);
        const k = next / v.scale;
        return {
          scale: next,
          tx: px - (px - v.tx) * k,
          ty: py - (py - v.ty) * k,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onBgPointerDown = useCallback((e) => {
    if (e.target.closest?.('[data-node]')) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, ox: view.tx, oy: view.ty };
    setDragging(true);
  }, [view.tx, view.ty]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      if (!dragState.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      setView(v => ({
        ...v,
        tx: dragState.current.ox + (e.clientX - dragState.current.startX) * scaleX,
        ty: dragState.current.oy + (e.clientY - dragState.current.startY) * scaleY,
      }));
    };
    const onUp = () => { dragState.current = null; setDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const zoomBy = (f) => setView(v => ({ ...v, scale: clamp(v.scale * f, MIN_SCALE, MAX_SCALE) }));
  const resetView = () => setView({ scale: 1, tx: 0, ty: 0 });

  if (nodes.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '70px 20px', color: 'var(--tx3)', textAlign: 'center',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: 'var(--acc-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GraphIcon size={20} weight="duotone" color="var(--acc)" />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, maxWidth: 280, lineHeight: 1.6 }}>
          adicione tags às suas referências no acervo pra ver o mapa de conexões nascer aqui
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── legenda + contadores ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {legendTypes.map(([type, color]) => (
            <span key={type} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--tx3)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}88` }} />
              {TYPE_LABELS[type] || type}
            </span>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--tx3)' }}>
          {nodes.length} nós · {edges.length} conexões
        </span>
      </div>

      <div style={{
        display: 'flex', gap: 0, border: '1px solid var(--brd)', borderRadius: 10,
        overflow: 'hidden', position: 'relative',
        background: 'radial-gradient(ellipse 70% 60% at 50% 40%, var(--acc-bg2), var(--bg1) 75%)',
      }}>
        {/* HUD corners */}
        <div style={{ position: 'absolute', top: 7, left: 7, width: 12, height: 12, borderTop: '1.5px solid var(--acc)', borderLeft: '1.5px solid var(--acc)', opacity: 0.5, pointerEvents: 'none', zIndex: 3 }} />
        <div style={{ position: 'absolute', bottom: 7, left: 7, width: 12, height: 12, borderBottom: '1.5px solid var(--acc)', borderLeft: '1.5px solid var(--acc)', opacity: 0.5, pointerEvents: 'none', zIndex: 3 }} />

        {/* ── SVG do grafo ── */}
        <div
          ref={wrapRef}
          onMouseDown={onBgPointerDown}
          style={{
            flex: '1 1 auto', minWidth: 0, position: 'relative',
            cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none',
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--acc)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--acc)" stopOpacity="0" />
              </radialGradient>
              <pattern id="dotGrid" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="1.2" cy="1.2" r="1.2" fill="var(--tx3)" opacity="0.18" />
              </pattern>
            </defs>

            <rect x="0" y="0" width={W} height={H} fill="url(#dotGrid)" />

            <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
              {/* arestas */}
              {edges.map((e, i) => {
                const p1 = posById[e.a], p2 = posById[e.b];
                if (!p1 || !p2) return null;
                const dim = activeId && !(neighborIds?.has(e.a) && neighborIds?.has(e.b));
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const bend = Math.min(dist * 0.14, 34) * (i % 2 === 0 ? 1 : -1);
                return (
                  <path key={i}
                    d={arcPath(p1.x, p1.y, p2.x, p2.y, bend)}
                    fill="none"
                    stroke={dim ? 'var(--brd2)' : 'var(--acc)'}
                    strokeOpacity={dim ? 0.35 : 0.4 + Math.min(e.weight, 4) * 0.12}
                    strokeWidth={dim ? 1 : 1.1 + Math.min(e.weight, 4) * 0.45}
                  />
                );
              })}

              {/* nós */}
              {nodes.map(n => {
                const p = posById[n.id];
                if (!p) return null;
                const r = 7 + Math.min(n.degree, 9) * 1.7;
                const dim = activeId && !neighborIds?.has(n.id);
                const isActive = n.id === activeId;
                const showLabel = isActive || (labeledIds.has(n.id) && !activeId);
                return (
                  <g key={n.id} data-node="1"
                    transform={`translate(${p.x},${p.y})`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverId(n.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}
                  >
                    {isActive && <circle r={r + 11} fill="url(#nodeGlow)" />}
                    <circle r={r}
                      fill={dim ? 'var(--bg3)' : n.color}
                      fillOpacity={dim ? 0.45 : 0.9}
                      stroke={n.id === selectedId ? 'var(--tx)' : (dim ? 'var(--brd2)' : n.color)}
                      strokeWidth={n.id === selectedId ? 2.5 : 1}
                      style={{ filter: dim ? 'none' : `drop-shadow(0 0 5px ${n.color}66)`, transition: 'fill-opacity 0.15s' }}
                    />
                    {n.ref.isFavorite && (
                      <text x={0} y={2.5} fontSize={Math.max(r * 0.85, 8)} textAnchor="middle" fill={dim ? 'var(--tx3)' : '#1a1608'} style={{ pointerEvents: 'none' }}>★</text>
                    )}
                    {showLabel && (
                      <>
                        <rect x={-2} y={r + 4} width={Math.min(n.ref.title.length * 4.6 + 8, 150)} height={14}
                          fill="var(--bg0)" fillOpacity={0.82} rx={3} />
                        <text x={2} y={r + 14} fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--tx2)"
                          style={{ pointerEvents: 'none' }}>
                          {n.ref.title.length > 30 ? n.ref.title.slice(0, 28) + '…' : n.ref.title}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* controles de zoom */}
          <div style={{
            position: 'absolute', bottom: 10, right: 10, display: 'flex', flexDirection: 'column',
            gap: 2, background: 'var(--bg2)', border: '1px solid var(--brd2)', borderRadius: 7, overflow: 'hidden',
          }}>
            <button onClick={() => zoomBy(1.25)} style={ctrlBtn}><MagnifyingGlassPlus size={13} /></button>
            <div style={{ height: 1, background: 'var(--brd)' }} />
            <button onClick={() => zoomBy(0.8)} style={ctrlBtn}><MagnifyingGlassMinus size={13} /></button>
            <div style={{ height: 1, background: 'var(--brd)' }} />
            <button onClick={resetView} style={ctrlBtn}><Crosshair size={13} /></button>
          </div>

          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--tx3)', opacity: 0.7,
          }}>
            arraste pra mover · scroll pra zoom
          </div>
        </div>

        {/* ── Painel de detalhe ── */}
        <div style={{
          width: 240, flexShrink: 0, borderLeft: '1px solid var(--brd)',
          padding: '14px 16px', display: 'flex', flexDirection: 'column',
          background: 'var(--bg2)',
        }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: selected.color,
                  background: selected.color + '15', border: `1px solid ${selected.color}33`,
                  borderRadius: 3, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{TYPE_LABELS[selected.ref.type] || selected.ref.type}</span>
                <button onClick={() => setSelectedId(null)} style={{
                  background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: 2,
                }}><X size={12} /></button>
              </div>

              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--tx)',
                marginTop: 10, lineHeight: 1.35,
              }}>{selected.ref.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>
                {selected.ref.authors ? selected.ref.authors.split(',')[0].trim() : '—'}{selected.ref.year ? ` · ${selected.ref.year}` : ''}
              </div>

              {selected.ref.tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
                  {selected.ref.tags.slice(0, 6).map(t => (
                    <span key={t} style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx2)',
                      background: 'var(--bg3)', border: '1px solid var(--brd2)',
                      borderRadius: 3, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3,
                    }}><TagSimple size={9} />{t}</span>
                  ))}
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
                fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--tx3)',
              }}>
                <span style={{ color: 'var(--acc)', fontWeight: 700 }}>{selected.degree}</span> conexõe{selected.degree !== 1 ? 's' : ''} no grafo
                {selected.ref.isFavorite && <span style={{ color: '#D4A030', marginLeft: 4, display: 'flex', alignItems: 'center', gap: 2 }}><Star size={9} weight="fill" /> favorito</span>}
              </div>

              {topConnections.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--brd)' }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                  }}>referências conectadas</div>
                  {topConnections.map(({ node, shared }) => (
                    <button key={node.id} onClick={() => setSelectedId(node.id)} style={{
                      display: 'block', width: '100%', textAlign: 'left', background: 'none',
                      border: 'none', padding: '5px 0', cursor: 'pointer',
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--tx2)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{node.ref.title}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--tx3)', marginTop: 1 }}>
                        via {shared.slice(0, 2).join(', ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <button onClick={() => openInAcervo(selected.ref.id)} style={{
                marginTop: 14,
                display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bg0)',
                background: 'var(--acc)', border: '1px solid var(--acc)', borderRadius: 6,
                padding: '8px 10px', cursor: 'pointer', fontWeight: 600,
                boxShadow: '0 0 10px var(--acc-glow)',
              }}>
                abrir no acervo <ArrowSquareOut size={11} />
              </button>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', gap: 8, color: 'var(--tx3)', padding: '20px 6px',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--acc-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GraphIcon size={16} weight="duotone" color="var(--acc)" />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.6 }}>
                clique num nó pra ver os detalhes e as referências conectadas a ele
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ctrlBtn = {
  background: 'none', border: 'none', color: 'var(--tx2)', cursor: 'pointer',
  padding: '6px 7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
};