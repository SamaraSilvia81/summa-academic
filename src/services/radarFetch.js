/**
 * Radar Fetch — Farol (Sem limite de tempo, armazena tudo)
 */
import { analyzeRelevance, hasGroqKey } from '../lib/ai';
import { supabase } from '../lib/supabase';
import { getDefaultInterval, isSourceActive, keyToLabel } from '../lib/sourcesConfig';

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
  return terms.slice(0, 8);
}

function passesLanguageFilter(candidate, profile) {
  const allowed = profile.languages;
  if (!allowed || allowed.length === 0) return true;
  if (!candidate.language) return true;
  if (['en', 'pt', 'fr'].includes(candidate.language)) return true;
  return allowed.includes(candidate.language);
}

async function fetchArxiv(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];
  
  // AGORA SEM FILTRO DE DATA - Busca os 15 principais da API (de qualquer época)
  const searchQuery = terms.map((t) => `all:"${t}"`).join(' OR ');
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&sortBy=submittedDate&sortOrder=descending&max_results=15`;
  
  const xml = await fetchViaProxy(url);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.querySelectorAll('entry')).map((entry) => {
    const title = entry.querySelector('title')?.textContent?.trim().replace(/\s+/g, ' ') || 'Sem título';
    const summary = entry.querySelector('summary')?.textContent?.trim().replace(/\s+/g, ' ') || '';
    const link = entry.querySelector('id')?.textContent?.trim() || null;
    const published = entry.querySelector('published')?.textContent?.trim() || null;
    const authors = Array.from(entry.querySelectorAll('author > name')).map((n) => n.textContent?.trim()).filter(Boolean).join(', ');
    const arxivId = link ? link.match(/\/abs\/(.+)/) : null;
    const thumbnail = arxivId ? `https://arxiv.org/thumb/${arxivId[1]}.jpg` : null;
    return { title, type: 'paper', sourceUrl: link, authors: authors || null, summary, image: thumbnail, language: 'en', publishedAt: published ? new Date(published) : null };
  });
}

async function fetchSemanticScholar(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];
  const query = terms.join(' ');
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,url,publicationDate&limit=20`; 
  const raw = await fetchViaProxy(url);
  const data = JSON.parse(raw);

  // AGORA SEM FILTRO DE DATA - Guarda todos os 20 que a API devolver
  return (data.data || [])
    .map((paper) => ({
      title: paper.title || 'Sem título', type: 'paper', sourceUrl: paper.url || null,
      authors: (paper.authors || []).map((a) => a.name).join(', ') || null, 
      summary: paper.abstract || '', 
      language: 'en',
      publishedAt: paper.publicationDate ? new Date(paper.publicationDate) : null,
    }));
}

async function fetchHackerNews(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];
  const query = terms.slice(0, 3).join(' ');
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=15`;
  const raw = await fetchViaProxy(url);
  const data = JSON.parse(raw);
  return (data.hits || []).filter((hit) => hit.title).map((hit) => ({
    title: hit.title, type: 'thread', sourceUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    authors: hit.author || null, summary: hit.story_text || hit.comment_text || '', language: 'en',
    publishedAt: hit.created_at ? new Date(hit.created_at) : null,
  }));
}

async function fetchDevTo(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];
  const tag = terms[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!tag) return [];
  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=30`;
  const raw = await fetchViaProxy(url);
  const data = JSON.parse(raw);
  return (Array.isArray(data) ? data : []).map((article) => ({
    title: article.title, type: 'post', sourceUrl: article.url, authors: article.user?.name || null,
    summary: article.description || '', image: article.cover_image || article.social_image || null,
    language: 'en', publishedAt: article.published_at ? new Date(article.published_at) : null,
  }));
}

async function fetchMedium(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];
  const tag = terms[0].toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!tag) return [];
  const url = `https://medium.com/feed/tag/${tag}`;
  const xml = await fetchViaProxy(url);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.querySelectorAll('item')).slice(0, 15).map((item) => {
    const title = item.querySelector('title')?.textContent?.trim() || 'Sem título';
    const link = item.querySelector('link')?.textContent?.trim() || null;
    const creator = item.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim() || null;
    const pubDate = item.querySelector('pubDate')?.textContent?.trim() || null;
    const descriptionEl = item.querySelector('description');
    const descriptionRaw = descriptionEl ? descriptionEl.innerHTML : '';
    const imgSrcMatch = descriptionRaw.match(/<img[^>]+src=["']([^"']+)["']/i);
    const firstImgUrl = imgSrcMatch ? imgSrcMatch[1] : null;
    const summary = descriptionRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
    return { title, type: 'post', sourceUrl: link, authors: creator, summary, image: firstImgUrl, language: 'en', publishedAt: pubDate ? new Date(pubDate) : null };
  });
}

async function fetchBluesky(profile) {
  const terms = buildTerms(profile);
  if (terms.length === 0) return [];
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
        const webUrl = uri ? `https://bsky.app/profile/${post.author?.handle}/post/${uri.split('/').pop()}` : null;
        results.push({ title: text.slice(0, 120) + (text.length > 120 ? '…' : ''), type: 'thread', sourceUrl: webUrl, authors: author, summary: text, language: 'en', publishedAt: post.indexedAt ? new Date(post.indexedAt) : null });
      }
    } catch { }
  }
  return results;
}

const SOURCE_FETCHERS = {
  arxiv: fetchArxiv, semantic_scholar: fetchSemanticScholar, hackernews: fetchHackerNews,
  devto: fetchDevTo, medium: fetchMedium, bluesky: fetchBluesky,
};

async function fetchRssViaProxy(feedUrl) {
  const { data, error } = await supabase.functions.invoke('rss-proxy', { body: { mode: 'fetch', url: feedUrl } });
  if (error) throw new Error(`rss-proxy: ${error.message}`);
  if (data?.error) throw new Error(`rss-proxy: ${data.error}`);
  return data.body;
}

export async function discoverRssFeeds(siteUrl) {
  const { data, error } = await supabase.functions.invoke('rss-proxy', { body: { mode: 'discover', url: siteUrl } });
  if (error) throw new Error(`rss-proxy discover: ${error.message}`);
  if (data?.error) throw new Error(`rss-proxy discover: ${data.error}`);
  return { feeds: data.feeds || [], isDirect: data.isDirect || false };
}

function parseRssFeed(xml, sourceKey) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const rssItems = doc.querySelectorAll('item');
  if (rssItems.length > 0) {
    return Array.from(rssItems).slice(0, 20).map((item) => {
      const title = item.querySelector('title')?.textContent?.trim() || 'Sem título';
      const link = item.querySelector('link')?.textContent?.trim() || null;
      const creator = item.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim() || null;
      const author = item.querySelector('author')?.textContent?.trim() || creator;
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() || null;
      const descRaw = item.querySelector('description')?.textContent || '';
      const summary = descRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
      return { title, type: 'post', sourceUrl: link, authors: author, summary, language: null, publishedAt: pubDate ? new Date(pubDate) : null };
    });
  }
  const atomEntries = doc.querySelectorAll('entry');
  if (atomEntries.length > 0) {
    return Array.from(atomEntries).slice(0, 20).map((entry) => {
      const title = entry.querySelector('title')?.textContent?.trim() || 'Sem título';
      const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
      const link = linkEl?.getAttribute('href') || null;
      const author = entry.querySelector('author > name')?.textContent?.trim() || null;
      const published = entry.querySelector('published')?.textContent?.trim() || entry.querySelector('updated')?.textContent?.trim() || null;
      const summaryEl = entry.querySelector('summary') || entry.querySelector('content');
      const summaryRaw = summaryEl?.textContent || '';
      const summary = summaryRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
      return { title, type: 'post', sourceUrl: link, authors: author, summary, language: null, publishedAt: published ? new Date(published) : null };
    });
  }
  return [];
}

async function fetchCustomRss(feedUrl, sourceKey) {
  const xml = await fetchRssViaProxy(feedUrl);
  return parseRssFeed(xml, sourceKey);
}

function heuristicScore(candidate, profile) {
  const title = (candidate.title || '').toLowerCase();
  const summary = (candidate.summary || '').toLowerCase();
  const text = `${title} ${summary}`;

  // Termos ignorados: rejeita o item
  const isIgnored = (profile.ignoredTerms || []).some((t) => t && text.includes(t.toLowerCase()));
  if (isIgnored) return null;

  const keywords = profile.keywords || [];
  const matched = keywords.filter((k) => k && text.includes(k.toLowerCase()));
  if (matched.length === 0) return null;

  // Pontuação ponderada
  let score = 30;

  // Keywords no título valem mais que no summary
  const titleMatches = matched.filter((k) => title.includes(k.toLowerCase()));
  score += titleMatches.length * 15;
  score += (matched.length - titleMatches.length) * 8;

  // Bonus se combina área + keyword (ex: "microfrontend" + "technical debt")
  const areas = (profile.areas || []).map((a) => a.toLowerCase());
  const areaMatch = areas.some((a) => text.includes(a));
  if (areaMatch && matched.length >= 2) score += 10;

  // Papers acadêmicos recebem leve bonus sobre posts genéricos
  if (candidate.type === 'paper') score += 5;

  // Penaliza conteúdo muito curto (possivelmente superficial)
  if (!summary || summary.length < 50) score -= 10;

  score = Math.max(10, Math.min(96, score));

  const reason = titleMatches.length > 0
    ? `Título menciona ${titleMatches.join(', ')}. ${matched.length} keyword(s) no total.`
    : `${matched.length} palavra(s)-chave encontradas no resumo: ${matched.join(', ')}.`;

  return { score, matchedKeywords: matched, reason };
}

async function scoreCandidate(candidate, profile) {
  if (hasGroqKey()) {
    try {
      const result = await analyzeRelevance(candidate, profile);
      if (typeof result?.score === 'number') {
        return { score: result.score, matchedKeywords: result.matchedKeywords || [], reason: result.reason || '' };
      }
    } catch { /* cai pro heurístico abaixo */ }
  }
  return heuristicScore(candidate, profile);
}

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Remove pontuação e caracteres especiais pra comparação fuzzy
    .replace(/[^\w\s]/g, '')
    // Remove artigos/preposições comuns que variam entre fontes
    .replace(/\b(the|a|an|of|in|on|for|and|with|to|from)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function runRadarFetch({ profile, sourceRows = [], existingItems = [], force = false, maxNewItems = 60 }) {
  const now = Date.now();
  const enabledKeys = (profile.sources || []).map(normalizeSourceKey);
  const existingKeys = new Set();
  existingItems.forEach((item) => {
    if (item.sourceUrl) existingKeys.add(item.sourceUrl);
    existingKeys.add(normalizeTitle(item.title));
  });
  const newItems = [];
  const sourceUpdates = [];
  const errors = [];
  const skipped = [];

  for (const key of new Set(enabledKeys)) {
    const fetcher = SOURCE_FETCHERS[key];
    const row = sourceRows.find((s) => normalizeSourceKey(s.name) === key);
    if (!fetcher) { skipped.push(key); continue; }
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
          profileId: profile.id, title: candidate.title, type: candidate.type, source: key,
          sourceUrl: candidate.sourceUrl || null, authors: candidate.authors, summary: candidate.summary,
          image: candidate.image || null, 
          relevanceScore: scored.score, relevanceReason: scored.reason, matchedKeywords: scored.matchedKeywords,
          language: candidate.language || 'en', deadline: null, isRead: false, isSaved: false, isDismissed: false,
          fetchedAt: new Date(), publishedAt: candidate.publishedAt || null,
        });
      }
      sourceUpdates.push({ key, name: row?.name || keyToLabel(key), existingRowId: row?.id || null, lastFetchedAt: new Date() });
    } catch (err) {
      errors.push({ source: keyToLabel(key), message: err.message });
    }
  }

  const rssRows = sourceRows.filter((s) => s.type === 'rss' && s.url && s.isActive !== false);
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
          profileId: profile.id, title: candidate.title, type: candidate.type, source: sourceKey,
          sourceUrl: candidate.sourceUrl || null, authors: candidate.authors, summary: candidate.summary,
          image: null, 
          relevanceScore: scored.score, relevanceReason: scored.reason, matchedKeywords: scored.matchedKeywords,
          language: candidate.language || null, deadline: null, isRead: false, isSaved: false, isDismissed: false,
          fetchedAt: new Date(), publishedAt: candidate.publishedAt || null,
        });
      }
      sourceUpdates.push({ key: sourceKey, name: row.name, existingRowId: row.id, lastFetchedAt: new Date() });
    } catch (err) {
      errors.push({ source: row.name, message: err.message });
    }
  }

  return { newItems, sourceUpdates, errors, skipped };
}