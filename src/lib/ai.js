/**
 * AI Service — Summa.sh
 * Groq free tier (llama-3.1-70b-versatile)
 * ~500 requests/day, 6000 tokens/min
 *
 * Funções:
 * - Sugestões de escrita no editor (Bancada)
 * - Geração de resumo/abstract (Bancada)
 * - Análise de relevância do radar (Farol)
 * - Geração de informe semanal (Farol)
 * - Sugestões de citação (Acervo ↔ Bancada)
 */

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-70b-versatile';

// ── Core ──────────────────────────────────────────────────────

async function callGroq(messages, options = {}) {
  const apiKey = options.apiKey || getStoredKey();
  if (!apiKey) throw new Error('Groq API key não configurada');

  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || '';
}

function getStoredKey() {
  return localStorage.getItem('summa_groq_key') || null;
}

export function setGroqKey(key) {
  localStorage.setItem('summa_groq_key', key);
}

export function hasGroqKey() {
  return !!getStoredKey();
}

// ── Bancada: Sugestões de escrita ─────────────────────────────

export async function getWritingSuggestions(text, context = {}) {
  const { template, section, language = 'pt' } = context;

  const systemPrompt = `Você é um assistente de escrita acadêmica especializado.
Idioma: ${language === 'pt' ? 'Português brasileiro' : 'English'}.
${template && template !== 'free' ? `Template: ${template.toUpperCase()}.` : ''}
${section ? `Seção atual: ${section}.` : ''}
Dê sugestões concisas e específicas para melhorar o texto acadêmico.
Responda em JSON: { "suggestions": [{ "type": "writing|structure|citation|grammar", "content": "...", "context": "trecho relevante" }] }`;

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analise e sugira melhorias:\n\n${text.slice(0, 3000)}` }
  ], { temperature: 0.5 });

  try {
    return JSON.parse(result);
  } catch {
    return { suggestions: [{ type: 'writing', content: result, context: '' }] };
  }
}

// ── Bancada: Gerar abstract ───────────────────────────────────

export async function generateAbstract(content, context = {}) {
  const { title, template = 'free', language = 'pt' } = context;

  const systemPrompt = language === 'pt'
    ? `Gere um resumo acadêmico (abstract) de no máximo 250 palavras para o artigo fornecido. 
Siga o padrão acadêmico: contexto → problema → metodologia → resultados → contribuição.
${template !== 'free' ? `Siga as normas ${template.toUpperCase()}.` : ''}`
    : `Generate an academic abstract of at most 250 words for the provided paper.
Follow the standard structure: context → problem → methodology → results → contribution.
${template !== 'free' ? `Follow ${template.toUpperCase()} guidelines.` : ''}`;

  return callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${title ? `Título: ${title}\n\n` : ''}${content.slice(0, 4000)}` }
  ], { temperature: 0.4, maxTokens: 512 });
}

// ── Farol: Análise de relevância ──────────────────────────────

export async function analyzeRelevance(item, profile) {
  const areas = (profile.areas || []).join(', ');
  const keywords = (profile.keywords || []).join(', ');
  const ignored = (profile.ignoredTerms || []).join(', ');

  const systemPrompt = `Você é um curador acadêmico especializado em filtrar literatura relevante para pesquisadores.

PERFIL DO PESQUISADOR:
- Programa: ${profile.program || 'mestrado'}
- Instituição: ${profile.institution || 'não informada'}
- Grande área: ${areas}
- Subárea: ${profile.subarea || 'não informada'}
- Palavras-chave da pesquisa: ${keywords}
${ignored ? `- Termos IGNORADOS (reduzem relevância): ${ignored}` : ''}
${profile.thesisTitle ? `- Título da dissertação/tese: ${profile.thesisTitle}` : ''}

CRITÉRIOS DE PONTUAÇÃO (score 0-100):
- 90-100: Diretamente sobre o tema central da pesquisa. Cita conceitos-chave, propõe soluções ou apresenta estudos empíricos no domínio exato.
- 70-89: Muito relevante. Trata de temas adjacentes que fundamentam ou complementam a pesquisa (ex: technical debt em geral quando a pesquisa é sobre SATD em microfrontends).
- 50-69: Moderadamente relevante. Compartilha conceitos ou metodologias mas em domínio diferente.
- 30-49: Tangencialmente relevante. Menciona termos relacionados mas o foco é outro.
- 0-29: Irrelevante ou fora do escopo. Tutoriais básicos, marketing, conteúdo superficial.

REGRAS:
- Posts de blog com conteúdo técnico substantivo (arquitetura, trade-offs, lições aprendidas) valem tanto quanto papers acadêmicos.
- Tutoriais genéricos de "como fazer X" sem profundidade analítica recebem score baixo.
- Se o item contém termos ignorados do perfil, reduza o score significativamente.
- matchedKeywords deve listar APENAS keywords do perfil que realmente aparecem ou são diretamente abordadas no item.

Responda SOMENTE em JSON válido, sem markdown:
{ "score": <número 0-100>, "reason": "<1-2 frases explicando a pontuação>", "matchedKeywords": ["<keyword1>", "<keyword2>"] }`;

  const itemContent = [
    `Título: ${item.title}`,
    item.authors ? `Autores: ${item.authors}` : null,
    item.summary ? `Resumo: ${item.summary.slice(0, 600)}` : null,
    item.type ? `Tipo: ${item.type}` : null,
    item.source ? `Fonte: ${item.source}` : null,
  ].filter(Boolean).join('\n');

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: itemContent }
  ], { temperature: 0.2, maxTokens: 256 });

  try {
    const parsed = JSON.parse(result.replace(/```json\s*|```/g, '').trim());
    return {
      score: Math.max(0, Math.min(100, parsed.score || 0)),
      reason: parsed.reason || '',
      matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
    };
  } catch {
    return { score: 50, reason: result.slice(0, 200), matchedKeywords: [] };
  }
}

/**
 * Análise em lote: analisa até 5 itens numa única chamada ao Groq.
 * Economiza requests (rate limit: 500/dia no free tier).
 */
export async function analyzeRelevanceBatch(items, profile) {
  if (!items || items.length === 0) return [];

  const areas = (profile.areas || []).join(', ');
  const keywords = (profile.keywords || []).join(', ');

  const systemPrompt = `Você é um curador acadêmico. Analise a relevância de cada item para este perfil de pesquisa.

PERFIL: ${profile.program || 'mestrado'} em ${profile.subarea || areas} (${profile.institution || ''}).
KEYWORDS: ${keywords}.

Para cada item, pontue de 0-100:
- 90-100: tema central da pesquisa
- 70-89: muito relevante, tema adjacente
- 50-69: moderadamente relevante
- 30-49: tangencial
- 0-29: irrelevante

Responda SOMENTE em JSON válido, sem markdown:
[{ "idx": 0, "score": <0-100>, "reason": "<1 frase>", "matchedKeywords": ["..."] }, ...]`;

  const itemsList = items.slice(0, 5).map((item, i) =>
    `[${i}] ${item.title}${item.summary ? ` — ${item.summary.slice(0, 200)}` : ''}`
  ).join('\n');

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: itemsList }
  ], { temperature: 0.2, maxTokens: 512 });

  try {
    const parsed = JSON.parse(result.replace(/```json\s*|```/g, '').trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Farol: Gerar informe semanal ──────────────────────────────

export async function generateInforme(items, profile) {
  const systemPrompt = `Gere um informe semanal de pesquisa em Português brasileiro.
Perfil: ${profile.name}, ${profile.institution}. Área: ${profile.subarea || profile.areas?.join(', ')}.
Estrutura: resumo geral → destaques (papers) → oportunidades (CFPs) → recomendações.
Formato: markdown. Máximo 500 palavras.`;

  const itemsSummary = items.slice(0, 10).map(i =>
    `- [${i.type}] ${i.title} (relevância: ${i.relevanceScore}%) ${i.deadline ? `— deadline: ${i.deadline}` : ''}`
  ).join('\n');

  return callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Itens da semana:\n${itemsSummary}` }
  ], { temperature: 0.6, maxTokens: 1024 });
}

// ── Acervo: Sugestão de citações ──────────────────────────────

export async function suggestCitations(text, references) {
  const refList = references.slice(0, 20).map(r =>
    `[${r.id}] ${r.authors} (${r.year}). ${r.title}. ${r.venue || ''}`
  ).join('\n');

  const systemPrompt = `Dado o trecho de texto e a lista de referências do acervo do pesquisador,
sugira quais referências poderiam ser citadas e em qual trecho.
Responda em JSON: { "citations": [{ "referenceId": "uuid", "reason": "...", "suggestedPosition": "trecho do texto" }] }`;

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Texto:\n${text.slice(0, 2000)}\n\nReferências disponíveis:\n${refList}` }
  ], { temperature: 0.4, maxTokens: 512 });

  try {
    return JSON.parse(result);
  } catch {
    return { citations: [] };
  }
}

// ── Onboarding/Settings: Enriquecer dados do orientador ─────

export async function enrichAdvisor(advisorName, institution = '') {
  const systemPrompt = `Você é um assistente de pesquisa acadêmica. Dado o nome de um orientador e opcionalmente sua instituição, retorne informações sobre suas áreas de pesquisa, publicações notáveis e linhas de trabalho.

Responda APENAS em JSON válido, sem markdown:
{
  "found": true,
  "areas": ["área 1", "área 2"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "summary": "Breve resumo da atuação acadêmica (1-2 frases)",
  "scholarUrl": "URL do Google Scholar se conhecida, ou null",
  "lattesHint": "Dica de como encontrar no Lattes, ou null"
}

Se não conhecer o orientador, retorne { "found": false, "areas": [], "keywords": [], "summary": "Orientador não identificado na base de conhecimento." }`;

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Orientador: ${advisorName}${institution ? ` — ${institution}` : ''}` }
  ], { temperature: 0.3, maxTokens: 512 });

  try {
    return JSON.parse(result.replace(/```json\s*|```/g, '').trim());
  } catch {
    return { found: false, areas: [], keywords: [], summary: result };
  }
}

// ── Dataset: Classificar repositório ──────────────────────────

export async function classifyRepository(repo, criteria) {
  const systemPrompt = `Classifique se este repositório GitHub deve ser incluído ou excluído de um dataset de pesquisa.
Critérios: ${JSON.stringify(criteria)}.
Responda em JSON: { "decision": "include|exclude|flag", "confidence": 0-100, "reason": "..." }`;

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Repo: ${repo.name}. Descrição: ${repo.description || 'N/A'}. Linguagem: ${repo.language || 'N/A'}. Stars: ${repo.stars}. Topics: ${repo.topics?.join(', ') || 'N/A'}` }
  ], { temperature: 0.3, maxTokens: 256 });

  try {
    return JSON.parse(result);
  } catch {
    return { decision: 'flag', confidence: 0, reason: result };
  }
}