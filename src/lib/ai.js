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
  const systemPrompt = `Você é um curador acadêmico. Analise a relevância deste item para o perfil de pesquisa.
Responda em JSON: { "score": 0-100, "reason": "...", "matchedKeywords": ["..."] }`;

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Perfil: ${profile.areas?.join(', ')}. Keywords: ${profile.keywords?.join(', ')}.
Item: ${item.title}. ${item.authors || ''}. ${item.summary || ''}` }
  ], { temperature: 0.3, maxTokens: 256 });

  try {
    return JSON.parse(result);
  } catch {
    return { score: 50, reason: result, matchedKeywords: [] };
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