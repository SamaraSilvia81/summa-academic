/**
 * Radar Fetch — Farol
 *
 * Busca itens novos (papers/threads) em fontes externas e os transforma
 * em candidatos a `radar_items`. Hoje há integração automática real com:
 *   - arXiv             (export.arxiv.org/api — Atom XML)
 *   - Semantic Scholar   (api.semanticscholar.org/graph/v1 — JSON)
 *
 * Nenhuma das duas libera CORS pra fetch direto do navegador, então as
 * chamadas passam pela Edge Function `external-search`
 * (supabase/functions/external-search) que faz o proxy server-side —
 * ver `fetchViaProxy` abaixo. Ela precisa estar deployada:
 *   supabase functions deploy external-search --project-ref rmxxvpqkbeyorvyxydmn
 *
 * IEEE Xplore e ACM Digital Library exigem chave de API paga/institucional.
 * Twitter/X não tem API pública gratuita mais. Google Scholar não tem API
 * pública — "buscar" nele seria scraping, o que viola os Termos de Serviço
 * do Google, então não implementamos. `SOURCE_FETCHERS` é o ponto de
 * extensão: quando houver credenciais/proxy viável pra alguma dessas,
 * basta adicionar a chave correspondente.
 */
import { analyzeRelevance, hasGroqKey } from '../lib/ai';
import { supabase } from '../lib/supabase';
import { getDefaultInterval, isSourceActive, keyToLabel } from '../lib/sourcesConfig';

/** Busca uma URL externa via Edge Function (evita bloqueio de CORS do
 *  navegador, já que export.arxiv.org e api.semanticscholar.org não
 *  liberam Access-Control-Allow-Origin pra fetch direto). */
async function fetchViaProxy(url) {
  const { data, error } = await supabase.functions.invoke('external-search', {
    body: { url },
  });
  if (error) throw new Error(`proxy: ${error.message}`);
  if (!data || data.status >= 400) {
    throw new Error(`proxy retornou ${data?.status ?? '?'}`);
  }
  return data.body;
}

// ── Identificação de fonte ───────────────────────────────────────

/** Normaliza o nome/chave de uma fonte (tanto vindo de `profile.sources`
 *  quanto de `sources.name` no banco) para uma chave estável. */
export function normalizeSourceKey(raw) {
  const n = (raw || '').toLowerCase().replace(/[_.]/g, ' ').trim();
  if (n.includes('arxiv')) return 'arxiv';
  if (n.includes('semantic')) return 'semantic_scholar';
  if (n.includes('ieee')) return 'ieee';
  if (n.includes('acm')) return 'acm';
  if (n.includes('twitter') || n === 'x' || n.includes('/ x')) return 'twitter';
  if (n.includes('google scholar')) return 'google_scholar';
  if (n.includes('bluesky') || n.includes('bsky')) return 'bluesky';
  if (n.includes('medium')) return 'medium';
  if (n.includes('dev to') || n === 'devto') return 'devto';
  if (n.includes('hacker news') || n.includes('hackernews')) return 'hackernews';
  return n.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Labels agora vêm de sourcesConfig.js via keyToLabel()

// ── Fetchers ──────────────────────────────────────────────────────

function buildTerms(profile) {
  const raw = [...(profile.keywords || []), ...(profile.areas || [])];
  const seen = new Set();
  const terms = [];
  for (const t of raw) {
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(t);
  }
  return terms.slice(0, 8); // teto só pra não estourar URL/tempo de busca
}

/** true se o candidato passa no filtro de idioma configurado no perfil.
 *  Sem config (array vazio) ou idioma desconhecido = deixa passar. */
function passesLanguageFilter(candidate, profile) {
  const allowed = profile.languages;
  if (!allowed || allowed.length === 0) return true;
  if (!candidate.language) return true;
  return allowed.includes(candidate.language);
}

async function fetchArxiv(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];

  const searchQuery = terms.map((t) => `all:"${t}"`).join(' OR ');
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&sortBy=submittedDate&sortOrder=descending&max_results=15`;

  const xml = await fetchViaProxy(url);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  return Array.from(doc.querySelectorAll('entry')).map((entry) => {
    const title = entry.querySelector('title')?.textContent?.trim().replace(/\s+/g, ' ') || 'Sem título';
    const summary = entry.querySelector('summary')?.textContent?.trim().replace(/\s+/g, ' ') || '';
    const link = entry.querySelector('id')?.textContent?.trim() || null;
    const published = entry.querySelector('published')?.textContent?.trim() || null;
    const authors = Array.from(entry.querySelectorAll('author > name'))
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(', ');

    return {
      title,
      type: 'paper',
      sourceUrl: link,
      authors: authors || null,
      summary,
      language: 'en',
      publishedAt: published ? new Date(published) : null,
    };
  });
}

async function fetchSemanticScholar(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];

  const query = terms.join(' ');
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,url,publicationDate&limit=15`;

  const raw = await fetchViaProxy(url);
  const data = JSON.parse(raw);

  return (data.data || []).map((paper) => ({
    title: paper.title || 'Sem título',
    type: 'paper',
    sourceUrl: paper.url || null,
    authors: (paper.authors || []).map((a) => a.name).join(', ') || null,
    summary: paper.abstract || '',
    language: 'en',
    publishedAt: paper.publicationDate ? new Date(paper.publicationDate) : null,
  }));
}

async function fetchHackerNews(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];

  // Algolia (motor de busca do HN) funciona melhor com poucos termos
  const query = terms.slice(0, 3).join(' ');
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=15`;

  const raw = await fetchViaProxy(url);
  const data = JSON.parse(raw);

  return (data.hits || [])
    .filter((hit) => hit.title)
    .map((hit) => ({
      title: hit.title,
      type: 'thread',
      sourceUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      authors: hit.author || null,
      summary: hit.story_text || hit.comment_text || '',
      language: 'en',
      publishedAt: hit.created_at ? new Date(hit.created_at) : null,
    }));
}

async function fetchDevTo(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];

  // API do dev.to filtra por UMA tag (sem termo livre) — usa a keyword mais específica
  const tag = terms[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!tag) return [];
  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=30`;

  const raw = await fetchViaProxy(url);
  const data = JSON.parse(raw);

  return (Array.isArray(data) ? data : []).map((article) => ({
    title: article.title,
    type: 'post',
    sourceUrl: article.url,
    authors: article.user?.name || null,
    summary: article.description || '',
    language: 'en',
    publishedAt: article.published_at ? new Date(article.published_at) : null,
  }));
}

async function fetchMedium(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];

  // Feed RSS por tag do Medium (público, sem chave) — só aceita uma tag por vez
  const tag = terms[0].toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!tag) return [];
  const url = `https://medium.com/feed/tag/${tag}`;

  const xml = await fetchViaProxy(url);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  return Array.from(doc.querySelectorAll('item')).slice(0, 15).map((item) => {
    const title = item.querySelector('title')?.textContent?.trim() || 'Sem título';
    const link = item.querySelector('link')?.textContent?.trim() || null;
    const creator =
      item.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim() || null;
    const pubDate = item.querySelector('pubDate')?.textContent?.trim() || null;
    const descriptionRaw = item.querySelector('description')?.textContent || '';
    const summary = descriptionRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

    return {
      title,
      type: 'post',
      sourceUrl: link,
      authors: creator,
      summary,
      language: 'en', // a maioria dos feeds de tag do Medium é em inglês
      publishedAt: pubDate ? new Date(pubDate) : null,
    };
  });
}

async function fetchBluesky(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];

  // Bluesky tem API pública de busca (AppView) sem autenticação
  // Busca por cada termo separadamente e une os resultados
  const results = [];
  for (const term of terms.slice(0, 3)) {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(term)}&limit=10&sort=latest`;
    try {
      const raw = await fetchViaProxy(url);
      const data = JSON.parse(raw);
      for (const post of data.posts || []) {
        const text = post.record?.text || '';
        const author = post.author?.displayName || post.author?.handle || null;
        const uri = post.uri || null;
        // Converte at:// URI em link web
        const webUrl = uri
          ? `https://bsky.app/profile/${post.author?.handle}/post/${uri.split('/').pop()}`
          : null;
        results.push({
          title: text.slice(0, 120) + (text.length > 120 ? '…' : ''),
          type: 'thread',
          sourceUrl: webUrl,
          authors: author,
          summary: text,
          language: 'en',
          publishedAt: post.indexedAt ? new Date(post.indexedAt) : null,
        });
      }
    } catch {
      // ignora erro de um termo específico
    }
  }
  return results;
}

const SOURCE_FETCHERS = {
  arxiv: fetchArxiv,
  semantic_scholar: fetchSemanticScholar,
  hackernews: fetchHackerNews,
  devto: fetchDevTo,
  medium: fetchMedium,
  bluesky: fetchBluesky,
};

// ── RSS genérico ────────────────────────────────────────────────

/** Busca um feed RSS/Atom via a Edge Function rss-proxy (modo fetch).
 *  Diferente do fetchViaProxy (que usa external-search com allowlist),
 *  esta aceita qualquer host mas valida que o conteúdo é feed XML. */
async function fetchRssViaProxy(feedUrl) {
  const { data, error } = await supabase.functions.invoke('rss-proxy', {
    body: { mode: 'fetch', url: feedUrl },
  });
  if (error) throw new Error(`rss-proxy: ${error.message}`);
  if (data?.error) throw new Error(`rss-proxy: ${data.error}`);
  return data.body;
}

/** Descobre feed(s) RSS/Atom a partir de uma URL de site qualquer.
 *  Retorna array de { url, title }. */
export async function discoverRssFeeds(siteUrl) {
  const { data, error } = await supabase.functions.invoke('rss-proxy', {
    body: { mode: 'discover', url: siteUrl },
  });
  if (error) throw new Error(`rss-proxy discover: ${error.message}`);
  if (data?.error) throw new Error(`rss-proxy discover: ${data.error}`);
  return {
    feeds: data.feeds || [],
    isDirect: data.isDirect || false,
  };
}

/** Parser genérico de feed RSS/Atom. Recebe XML string, retorna items
 *  normalizados no mesmo formato que os outros fetchers. */
function parseRssFeed(xml, sourceKey) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  // Tenta RSS 2.0 primeiro (<rss><channel><item>)
  const rssItems = doc.querySelectorAll('item');
  if (rssItems.length > 0) {
    return Array.from(rssItems).slice(0, 20).map((item) => {
      const title = item.querySelector('title')?.textContent?.trim() || 'Sem título';
      const link = item.querySelector('link')?.textContent?.trim() || null;
      const creator =
        item.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim() || null;
      const author = item.querySelector('author')?.textContent?.trim() || creator;
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() || null;
      const descRaw = item.querySelector('description')?.textContent || '';
      const summary = descRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

      return {
        title,
        type: 'post',
        sourceUrl: link,
        authors: author,
        summary,
        language: null, // RSS geralmente não indica idioma por item
        publishedAt: pubDate ? new Date(pubDate) : null,
      };
    });
  }

  // Tenta Atom (<feed><entry>)
  const atomEntries = doc.querySelectorAll('entry');
  if (atomEntries.length > 0) {
    return Array.from(atomEntries).slice(0, 20).map((entry) => {
      const title = entry.querySelector('title')?.textContent?.trim() || 'Sem título';
      const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
      const link = linkEl?.getAttribute('href') || null;
      const author = entry.querySelector('author > name')?.textContent?.trim() || null;
      const published = entry.querySelector('published')?.textContent?.trim()
        || entry.querySelector('updated')?.textContent?.trim() || null;
      const summaryEl = entry.querySelector('summary') || entry.querySelector('content');
      const summaryRaw = summaryEl?.textContent || '';
      const summary = summaryRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

      return {
        title,
        type: 'post',
        sourceUrl: link,
        authors: author,
        summary,
        language: null,
        publishedAt: published ? new Date(published) : null,
      };
    });
  }

  return [];
}

/** Fetcher pra uma fonte RSS customizada. Diferente dos outros fetchers,
 *  este recebe a URL do feed diretamente (da row.url na tabela sources)
 *  em vez de construir a query a partir do perfil. */
async function fetchCustomRss(feedUrl, sourceKey) {
  const xml = await fetchRssViaProxy(feedUrl);
  return parseRssFeed(xml, sourceKey);
}

// ── Relevância (fallback sem IA) ─────────────────────────────────

function heuristicScore(candidate, profile) {
  const text = `${candidate.title} ${candidate.summary || ''}`.toLowerCase();

  const isIgnored = (profile.ignoredTerms || []).some((t) => t && text.includes(t.toLowerCase()));
  if (isIgnored) return null;

  const keywords = profile.keywords || [];
  const matched = keywords.filter((k) => k && text.includes(k.toLowerCase()));
  if (matched.length === 0) return null; // sem sinal de relevância — não polui o radar

  return {
    score: Math.min(96, 45 + matched.length * 10),
    matchedKeywords: matched,
    reason: `Coincidência com ${matched.length} palavra(s)-chave do seu perfil: ${matched.join(', ')}.`,
  };
}

async function scoreCandidate(candidate, profile) {
  if (hasGroqKey()) {
    try {
      const result = await analyzeRelevance(candidate, profile);
      if (typeof result?.score === 'number') {
        return {
          score: result.score,
          matchedKeywords: result.matchedKeywords || [],
          reason: result.reason || '',
        };
      }
    } catch {
      // cai pro heurístico abaixo
    }
  }
  return heuristicScore(candidate, profile);
}

// ── Dedupe ────────────────────────────────────────────────────────

function normalizeTitle(title) {
  return (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// ── Orquestrador ──────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {object} params.profile        perfil (precisa de id, keywords, areas, ignoredTerms, sources)
 * @param {object[]} params.sourceRows    linhas da tabela `sources` (podem estar vazias/incompletas)
 * @param {object[]} params.existingItems radarItems já existentes (p/ dedupe)
 * @param {boolean} [params.force]        ignora o intervalo de fetch e busca mesmo assim
 * @param {number} [params.maxNewItems]   teto de itens novos por rodada
 */
export async function runRadarFetch({ profile, sourceRows = [], existingItems = [], force = false, maxNewItems = 12 }) {
  const now = Date.now();
  const enabledKeys = (profile.sources || []).map(normalizeSourceKey);

  const existingKeys = new Set();
  existingItems.forEach((item) => {
    if (item.sourceUrl) existingKeys.add(item.sourceUrl);
    existingKeys.add(normalizeTitle(item.title));
  });

  const newItems = [];
  const sourceUpdates = []; // { key, name, lastFetchedAt, existingRowId }
  const errors = [];
  const skipped = [];

  // ── 1. Fontes com fetcher nativo (profile.sources) ────────────
  for (const key of new Set(enabledKeys)) {
    const fetcher = SOURCE_FETCHERS[key];
    const row = sourceRows.find((s) => normalizeSourceKey(s.name) === key);

    if (!fetcher) {
      skipped.push(key);
      continue;
    }
    if (row && row.isActive === false) continue;

    const intervalMs = (row?.fetchIntervalMinutes || getDefaultInterval(key)) * 60000;
    const lastFetched = row?.lastFetchedAt ? new Date(row.lastFetchedAt).getTime() : 0;
    if (!force && now - lastFetched < intervalMs) continue;

    try {
      const raw = await fetcher(profile);

      for (const candidate of raw) {
        if (newItems.length >= maxNewItems) break;
        if (!passesLanguageFilter(candidate, profile)) continue;

        const dedupeKey = candidate.sourceUrl || normalizeTitle(candidate.title);
        if (existingKeys.has(dedupeKey)) continue;

        const scored = await scoreCandidate(candidate, profile);
        if (!scored) continue;

        existingKeys.add(dedupeKey);
        newItems.push({
          profileId: profile.id,
          title: candidate.title,
          type: candidate.type,
          source: key,
          sourceUrl: candidate.sourceUrl || null,
          authors: candidate.authors,
          summary: candidate.summary,
          relevanceScore: scored.score,
          relevanceReason: scored.reason,
          matchedKeywords: scored.matchedKeywords,
          language: candidate.language || 'en',
          deadline: null,
          isRead: false,
          isSaved: false,
          isDismissed: false,
          fetchedAt: new Date(),
          publishedAt: candidate.publishedAt || null,
        });
      }

      sourceUpdates.push({
        key,
        name: row?.name || keyToLabel(key),
        existingRowId: row?.id || null,
        lastFetchedAt: new Date(),
      });
    } catch (err) {
      errors.push({ source: keyToLabel(key), message: err.message });
    }
  }

  // ── 2. Fontes RSS customizadas (rows com type='rss' e url) ────
  const rssRows = sourceRows.filter(
    (s) => s.type === 'rss' && s.url && s.isActive !== false
  );

  for (const row of rssRows) {
    const intervalMs = (row.fetchIntervalMinutes || 360) * 60000;
    const lastFetched = row.lastFetchedAt ? new Date(row.lastFetchedAt).getTime() : 0;
    if (!force && now - lastFetched < intervalMs) continue;

    const sourceKey = normalizeSourceKey(row.name) || `rss_${row.id}`;

    try {
      const raw = await fetchCustomRss(row.url, sourceKey);

      for (const candidate of raw) {
        if (newItems.length >= maxNewItems) break;
        if (!passesLanguageFilter(candidate, profile)) continue;

        const dedupeKey = candidate.sourceUrl || normalizeTitle(candidate.title);
        if (existingKeys.has(dedupeKey)) continue;

        const scored = await scoreCandidate(candidate, profile);
        if (!scored) continue;

        existingKeys.add(dedupeKey);
        newItems.push({
          profileId: profile.id,
          title: candidate.title,
          type: candidate.type,
          source: sourceKey,
          sourceUrl: candidate.sourceUrl || null,
          authors: candidate.authors,
          summary: candidate.summary,
          relevanceScore: scored.score,
          relevanceReason: scored.reason,
          matchedKeywords: scored.matchedKeywords,
          language: candidate.language || null,
          deadline: null,
          isRead: false,
          isSaved: false,
          isDismissed: false,
          fetchedAt: new Date(),
          publishedAt: candidate.publishedAt || null,
        });
      }

      sourceUpdates.push({
        key: sourceKey,
        name: row.name,
        existingRowId: row.id,
        lastFetchedAt: new Date(),
      });
    } catch (err) {
      errors.push({ source: row.name, message: err.message });
    }
  }

  return { newItems, sourceUpdates, errors, skipped };
}