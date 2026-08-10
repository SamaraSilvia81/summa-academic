// Grafo de referências: monta nós/arestas a partir de tags compartilhadas
// e roda uma simulação de forças (repulsão + atração + gravidade central)
// leve, sem dependência externa — pensado pra rodar uma vez (layout estático)
// e não a cada frame.

const TYPE_COLORS = {
  paper_read: '#D4A030', my_article: '#D4A030', dataset: '#4ADE80',
  book: '#F472B6', thesis: '#60A5FA', note: '#8A8680',
  post: '#7B9EE0', thread: '#A07BD4', news: '#F87171', cfp: '#4ADE80',
};

export function colorForType(type) {
  return TYPE_COLORS[type] || '#8A8680';
}

/**
 * Seleciona as referências mais relevantes (com tags) e monta arestas
 * entre as que compartilham ao menos 1 tag.
 */
export function buildGraph(references, { maxNodes = 22 } = {}) {
  const tagged = (references || []).filter(r => Array.isArray(r.tags) && r.tags.length > 0);

  const scored = tagged.map(r => ({
    ref: r,
    score: (r.tags.length * 2) + (r.isFavorite ? 6 : 0) + (r.isRead ? 2 : 0) + (r.relevanceScore ? r.relevanceScore / 20 : 0),
  })).sort((a, b) => b.score - a.score);

  const pool = scored.slice(0, Math.max(maxNodes, 30)).map(s => s.ref);

  const edgesRaw = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      const shared = a.tags.filter(t => b.tags.includes(t));
      if (shared.length > 0) edgesRaw.push({ a: a.id, b: b.id, weight: shared.length, shared });
    }
  }

  // Mantém só quem tem pelo menos 1 conexão; se não sobrar gente
  // suficiente (acervo pequeno/tags dispersas), preenche com os
  // melhores isolados mesmo assim, pra tela não ficar vazia.
  const connectedIds = new Set(edgesRaw.flatMap(e => [e.a, e.b]));
  let nodePool = pool.filter(r => connectedIds.has(r.id));
  if (nodePool.length < Math.min(6, pool.length)) {
    nodePool = pool.slice(0, Math.min(maxNodes, pool.length));
  }
  nodePool = nodePool.slice(0, maxNodes);
  const keepIds = new Set(nodePool.map(r => r.id));
  const edges = edgesRaw.filter(e => keepIds.has(e.a) && keepIds.has(e.b));

  const degree = {};
  edges.forEach(e => { degree[e.a] = (degree[e.a] || 0) + 1; degree[e.b] = (degree[e.b] || 0) + 1; });

  const nodes = nodePool.map((r, i) => ({
    id: r.id,
    ref: r,
    degree: degree[r.id] || 0,
    color: colorForType(r.type),
    angleSeed: i,
  }));

  return { nodes, edges };
}

/**
 * Roda uma simulação de forças simples e devolve nós com x/y finais,
 * dentro de [0, width] x [0, height].
 */
export function simulateLayout(nodes, edges, { width = 640, height = 420, iterations = 220 } = {}) {
  if (nodes.length === 0) return [];

  const cx = width / 2, cy = height / 2;
  const R = Math.min(width, height) * 0.34;

  const pos = nodes.map((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    return {
      id: n.id,
      x: cx + Math.cos(a) * R * (0.4 + Math.random() * 0.6),
      y: cy + Math.sin(a) * R * (0.4 + Math.random() * 0.6),
      vx: 0, vy: 0,
    };
  });
  const byId = Object.fromEntries(pos.map(p => [p.id, p]));

  const REPEL = 2600;
  const SPRING = 0.02;
  const GRAVITY = 0.006;
  const DAMPING = 0.86;
  const MIN_DIST = 8;

  for (let iter = 0; iter < iterations; iter++) {
    // repulsão entre todos os pares
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const p1 = pos[i], p2 = pos[j];
        let dx = p1.x - p2.x, dy = p1.y - p2.y;
        let dist2 = dx * dx + dy * dy;
        let dist = Math.sqrt(dist2) || 0.001;
        if (dist < MIN_DIST) dist = MIN_DIST;
        const force = REPEL / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        p1.vx += fx; p1.vy += fy;
        p2.vx -= fx; p2.vy -= fy;
      }
    }
    // atração nas arestas (mais tags compartilhadas = mais perto)
    for (const e of edges) {
      const p1 = byId[e.a], p2 = byId[e.b];
      if (!p1 || !p2) continue;
      const rest = 150 - Math.min(e.weight, 6) * 14;
      let dx = p2.x - p1.x, dy = p2.y - p1.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const force = (dist - rest) * SPRING;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      p1.vx += fx; p1.vy += fy;
      p2.vx -= fx; p2.vy -= fy;
    }
    // gravidade central
    for (const p of pos) {
      p.vx += (cx - p.x) * GRAVITY;
      p.vy += (cy - p.y) * GRAVITY;
    }
    // integra + damping + limites
    for (const p of pos) {
      p.vx *= DAMPING; p.vy *= DAMPING;
      p.x += p.vx; p.y += p.vy;
      const pad = 46;
      p.x = Math.max(pad, Math.min(width - pad, p.x));
      p.y = Math.max(pad, Math.min(height - pad, p.y));
    }
  }

  return pos;
}