/**
 * sourcesConfig.js — Configuração centralizada das fontes do Farol.
 *
 * Toda informação sobre quais fontes existem, quais estão implementadas,
 * labels, e intervalos default de fetch vive aqui. Onboarding, Settings,
 * radarFetch e a UI do Farol importam daqui.
 */

// ── Status de disponibilidade ────────────────────────────────────
// 'active'      → fetcher implementado, funciona direto
// 'restricted'  → existe mas requer chave de API / acesso institucional
// 'planned'     → ainda não implementado, sem previsão imediata
export const SOURCE_STATUS = {
  active: 'active',
  restricted: 'restricted',
  planned: 'planned',
};

// ── Definição de cada fonte ──────────────────────────────────────
// key: chave normalizada (mesma usada em profile.sources e SOURCE_FETCHERS)
// label: nome de exibição na UI
// status: um dos valores de SOURCE_STATUS
// category: agrupamento visual ('academic' | 'community' | 'institutional')
// defaultIntervalMin: intervalo default de fetch em minutos
// hint: texto curto exibido quando a fonte não está disponível
export const SOURCES = [
  // ── Acadêmicas (ativas) ──
  {
    key: 'semantic_scholar',
    label: 'Semantic Scholar',
    status: 'active',
    category: 'academic',
    defaultIntervalMin: 1440,
    hint: null,
  },
  {
    key: 'arxiv',
    label: 'arXiv',
    status: 'active',
    category: 'academic',
    defaultIntervalMin: 1440,
    hint: null,
  },

  // ── Comunidade / tech (ativas) ──
  {
    key: 'hackernews',
    label: 'Hacker News',
    status: 'active',
    category: 'community',
    defaultIntervalMin: 360,
    hint: null,
  },
  {
    key: 'devto',
    label: 'Dev.to',
    status: 'active',
    category: 'community',
    defaultIntervalMin: 360,
    hint: null,
  },
  {
    key: 'medium',
    label: 'Medium',
    status: 'active',
    category: 'community',
    defaultIntervalMin: 360,
    hint: null,
  },
  {
    key: 'bluesky',
    label: 'Bluesky',
    status: 'active',
    category: 'community',
    defaultIntervalMin: 360,
    hint: null,
  },

  // ── Institucionais (requerem acesso) ──
  {
    key: 'ieee',
    label: 'IEEE Xplore',
    status: 'restricted',
    category: 'institutional',
    defaultIntervalMin: 1440,
    hint: 'Requer chave de API institucional',
  },
  {
    key: 'acm',
    label: 'ACM',
    status: 'restricted',
    category: 'institutional',
    defaultIntervalMin: 1440,
    hint: 'Requer acesso institucional',
  },
  {
    key: 'twitter',
    label: 'Twitter / X',
    status: 'restricted',
    category: 'institutional',
    defaultIntervalMin: 360,
    hint: 'API paga (Basic $100/mês)',
  },
  {
    key: 'google_scholar',
    label: 'Google Scholar',
    status: 'restricted',
    category: 'institutional',
    defaultIntervalMin: 1440,
    hint: 'Sem API pública (scraping viola ToS)',
  },
];

// ── Helpers ──────────────────────────────────────────────────────

/** Lista de labels pra exibir na UI (todas as fontes). */
export const SOURCES_LABELS = SOURCES.map((s) => s.label);

/** Só as fontes com fetcher ativo. */
export const ACTIVE_SOURCES = SOURCES.filter((s) => s.status === 'active');

/** Só as fontes restritas. */
export const RESTRICTED_SOURCES = SOURCES.filter((s) => s.status === 'restricted');

/** Mapa key → config completo. */
export const SOURCES_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

/** Mapa label → config completo. */
export const SOURCES_BY_LABEL = Object.fromEntries(SOURCES.map((s) => [s.label, s]));

/** Retorna o intervalo default de fetch pra uma source key. */
export function getDefaultInterval(sourceKey) {
  return SOURCES_BY_KEY[sourceKey]?.defaultIntervalMin ?? 1440;
}

/** Verifica se uma source key tem fetcher ativo. */
export function isSourceActive(sourceKey) {
  return SOURCES_BY_KEY[sourceKey]?.status === 'active';
}

/** Retorna o hint de indisponibilidade (ou null se ativa). */
export function getSourceHint(sourceKey) {
  return SOURCES_BY_KEY[sourceKey]?.hint ?? null;
}

/** Converte label de exibição → key normalizada (pra salvar no perfil).
 *  Usa a mesma lógica de normalizeSourceKey do radarFetch. */
export function labelToKey(label) {
  const cfg = SOURCES_BY_LABEL[label];
  if (cfg) return cfg.key;
  // fallback pra labels desconhecidas
  return label.toLowerCase().replace(/ \/ /g, '_').replace(/ /g, '_');
}

/** Converte key normalizada → label de exibição. */
export function keyToLabel(key) {
  return SOURCES_BY_KEY[key]?.label ?? key;
}