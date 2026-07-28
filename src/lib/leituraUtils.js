/**
 * Utils — módulo Leitura
 *
 * Diferença-chave vs. o standalone acervo.sh: a lista de keywords
 * não é mais fixa no código. Usa `profile.keywords` (mesmo campo já
 * usado pelo Farol pra pontuar relevância — ver src/lib/ai.js e
 * Settings.jsx), então cada pesquisador prioriza pelos termos da
 * própria pesquisa, editáveis em Configurações.
 */

const DEFAULT_KEYWORDS = [
  'metodologia', 'revisão sistemática', 'estudo de caso', 'empírico',
  'trabalhos relacionados', 'discussão', 'conclusão',
];

// ── Priority scoring ──
export function scorePriority(text, keywords = DEFAULT_KEYWORDS) {
  if (!text) return { score: 0, matches: [] };
  const kws = keywords && keywords.length > 0 ? keywords : DEFAULT_KEYWORDS;
  const lower = text.toLowerCase();
  const matches = [];

  for (const kw of kws) {
    if (!kw) continue;
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const found = lower.match(regex);
    if (found) {
      matches.push({ keyword: kw, count: found.length });
    }
  }

  const score = matches.reduce((sum, m) => sum + m.count, 0);
  return { score, matches };
}

export function getPriorityLevel(score) {
  if (score >= 8) return 'high';
  if (score >= 3) return 'medium';
  if (score >= 1) return 'low';
  return 'skip';
}

export function getPriorityLabel(level) {
  const labels = { high: 'Prioritário', medium: 'Relevante', low: 'Opcional', skip: 'Pular' };
  return labels[level] || level;
}

export function getPriorityColorVar(level) {
  const map = { high: 'var(--red)', medium: 'var(--acc)', low: 'var(--blue)', skip: 'var(--tx3)' };
  return map[level] || 'var(--tx3)';
}
