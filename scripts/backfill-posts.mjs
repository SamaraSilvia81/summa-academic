#!/usr/bin/env node
/**
 * backfill-posts.mjs — Mineração de posts históricos para o Acervo do Summa.sh
 *
 * Fontes: Dev.to API (por tag), Medium RSS (por tag)
 * Insere na tabela `references` com type='post' e origin='backfill'
 *
 * Uso:
 *   PROFILE_ID=xxx node scripts/backfill-posts.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rmxxvpqkbeyorvyxydmn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteHh2cHFrYmV5b3J2eXh5ZG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDg3MjUsImV4cCI6MjA5OTA4NDcyNX0.AgDO2S0LGq6-BHGZhATljpXfG62mMPLFbfehI-NV3W4';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || null;
const PROFILE_ID = process.env.PROFILE_ID || null;
const DRY_RUN = process.env.DRY_RUN === 'true';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY ? { auth: { persistSession: false } } : undefined,
);

// ── Tags/keywords pra buscar ─────────────────────────────────────

const DEVTO_TAGS = [
  'microfrontend',
  'microfrontends',
  'webcomponents',
  'modulefederation',
  'singleSPA',
  'technicaldebt',
  'softwarearchitecture',
  'microservices',
  'monorepo',
  'frontend',
];

const DEVTO_KEYWORDS = [
  'micro frontend',
  'micro-frontend',
  'module federation',
  'technical debt',
  'SATD',
  'frontend architecture',
];

const MEDIUM_TAGS = [
  'micro-frontends',
  'microfrontend',
  'module-federation',
  'technical-debt',
  'software-architecture',
  'web-components',
  'microservices',
];

// ── Dev.to API ──────────────────────────────────────────────────

async function fetchDevToByTag(tag, page = 1, perPage = 100) {
  const url = `https://dev.to/api/articles?tag=${tag}&per_page=${perPage}&page=${page}&state=all`;
  console.log(`  [devto] tag "${tag}" page=${page}...`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'summa-sh-backfill/1.0' },
  });

  if (res.status === 429) {
    console.log('  [devto] rate limited, esperando 30s...');
    await sleep(30000);
    return fetchDevToByTag(tag, page, perPage);
  }
  if (!res.ok) throw new Error(`Dev.to retornou ${res.status}`);

  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((a) => ({
    title: a.title || 'Sem título',
    authors: a.user?.name || a.user?.username || null,
    summary: a.description || '',
    year: a.published_at ? new Date(a.published_at).getFullYear() : null,
    doi: null,
    url: a.url || null,
    image: a.cover_image || a.social_image || null,
    source: 'devto',
    venue: 'Dev.to',
    type: 'post',
    language: 'en',
    publishedAt: a.published_at ? new Date(a.published_at) : null,
    tags: a.tag_list || [],
  }));
}

async function searchDevTo(keyword, page = 1, perPage = 100) {
  const url = `https://dev.to/api/articles?per_page=${perPage}&page=${page}&state=all`;
  console.log(`  [devto] search "${keyword}" page=${page}...`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'summa-sh-backfill/1.0' },
  });
  if (!res.ok) throw new Error(`Dev.to retornou ${res.status}`);

  const data = await res.json();
  // Filtra client-side porque Dev.to não tem search por keyword na API pública
  const kw = keyword.toLowerCase();
  return (Array.isArray(data) ? data : [])
    .filter((a) => {
      const text = `${a.title} ${a.description} ${(a.tag_list || []).join(' ')}`.toLowerCase();
      return text.includes(kw);
    })
    .map((a) => ({
      title: a.title || 'Sem título',
      authors: a.user?.name || a.user?.username || null,
      summary: a.description || '',
      year: a.published_at ? new Date(a.published_at).getFullYear() : null,
      doi: null,
      url: a.url || null,
      image: a.cover_image || a.social_image || null,
      source: 'devto',
      venue: 'Dev.to',
      type: 'post',
      language: 'en',
      publishedAt: a.published_at ? new Date(a.published_at) : null,
      tags: a.tag_list || [],
    }));
}

// ── Medium RSS ──────────────────────────────────────────────────

async function fetchMediumTag(tag) {
  const url = `https://medium.com/feed/tag/${tag}`;
  console.log(`  [medium] tag "${tag}"...`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'summa-sh-backfill/1.0' },
  });

  if (!res.ok) {
    console.log(`  [medium] tag "${tag}" retornou ${res.status}, pulando`);
    return [];
  }

  const xml = await res.text();

  // Parse RSS simples (sem dependência)
  const items = xml.split('<item>').slice(1);
  return items.map((item) => {
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].trim() : null;
    };

    const title = (get('title') || '').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
    const link = get('link');
    const creator = get('dc:creator') || get('author');
    const pubDate = get('pubDate');
    const descRaw = (get('description') || '').replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
    const summary = descRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

    // Extrair imagem do conteúdo
    const imgMatch = descRaw.match(/<img[^>]+src=["']([^"']+)["']/i);
    const image = imgMatch ? imgMatch[1] : null;

    return {
      title,
      authors: creator,
      summary,
      year: pubDate ? new Date(pubDate).getFullYear() : null,
      doi: null,
      url: link,
      image,
      source: 'medium',
      venue: 'Medium',
      type: 'post',
      language: 'en',
      publishedAt: pubDate ? new Date(pubDate) : null,
      tags: [tag],
    };
  }).filter((p) => p.title);
}

// ── Deduplicação ────────────────────────────────────────────────

function normalizeTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

// ── Insert ──────────────────────────────────────────────────────

async function insertPosts(profileId, items) {
  const BATCH = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map((item) => ({
      profile_id: profileId,
      title: item.title,
      authors: item.authors || null,
      summary: item.summary || null,
      image: item.image || null,
      venue: item.venue || null,
      year: item.year,
      url: item.url || null,
      source: item.source || null,
      type: 'post',
      tags: ['backfill', 'post', item.source],
      language: item.language || 'en',
      origin: 'backfill',
      published_at: item.publishedAt ? item.publishedAt.toISOString() : null,
      is_read: false,
      is_favorite: false,
      is_dismissed: false,
      is_saved: false,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase.from('references').insert(batch).select('id');
    if (error) {
      console.error(`  [erro] batch ${i}-${i + BATCH}: ${error.message}`);
      skipped += batch.length;
    } else {
      inserted += (data || []).length;
    }
    process.stdout.write(`\r  [inserindo] ${inserted} inseridos, ${skipped} pulados de ${items.length}...`);
    await sleep(200);
  }
  console.log('');
  return { inserted, skipped };
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════╗
║     SUMMA.SH — BACKFILL DE POSTS          ║
╚═══════════════════════════════════════════╝
`);

  if (!PROFILE_ID) {
    console.error('[erro] PROFILE_ID é obrigatório.\n');
    process.exit(1);
  }

  console.log(`[config] profile_id: ${PROFILE_ID}`);
  console.log(`[config] dry_run: ${DRY_RUN}\n`);

  const seenTitles = new Set();
  const allPosts = [];

  function addUnique(posts) {
    let added = 0;
    for (const post of posts) {
      const key = normalizeTitle(post.title);
      if (key.length < 5) continue; // ignora títulos muito curtos
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        allPosts.push(post);
        added++;
      }
    }
    return added;
  }

  // ── Fase 1: Dev.to por tag (paginado) ──
  console.log('══ FASE 1: Dev.to por tag ══\n');
  for (const tag of DEVTO_TAGS) {
    try {
      let page = 1;
      let hasMore = true;
      let tagTotal = 0;

      while (hasMore && page <= 5) { // max 5 páginas por tag (500 posts)
        const results = await fetchDevToByTag(tag, page, 100);
        const added = addUnique(results);
        tagTotal += added;
        console.log(`    -> page ${page}: ${results.length} resultados, ${added} novos`);

        if (results.length < 100) hasMore = false;
        page++;
        await sleep(1000);
      }
      if (tagTotal > 0) console.log(`    total tag "${tag}": ${tagTotal}\n`);
    } catch (err) {
      console.error(`  [devto] erro tag "${tag}": ${err.message}`);
    }
  }

  // ── Fase 2: Medium por tag ──
  console.log('══ FASE 2: Medium por tag ══\n');
  for (const tag of MEDIUM_TAGS) {
    try {
      const results = await fetchMediumTag(tag);
      const added = addUnique(results);
      console.log(`    -> ${results.length} resultados, ${added} novos`);
      await sleep(2000); // Medium é mais sensível
    } catch (err) {
      console.error(`  [medium] erro tag "${tag}": ${err.message}`);
    }
  }

  console.log(`\n[total] ${allPosts.length} posts únicos\n`);

  if (DRY_RUN) {
    console.log('[dry_run] nenhum dado inserido.\n');
    allPosts.slice(0, 10).forEach((p, i) =>
      console.log(`  ${i + 1}. [${p.source}] [${p.year || '?'}] ${p.title.slice(0, 70)}`)
    );
    return;
  }

  const result = await insertPosts(PROFILE_ID, allPosts);
  console.log(`\n[done] ${result.inserted} posts inseridos, ${result.skipped} pulados.\n`);
}

main().catch((err) => { console.error('[fatal]', err); process.exit(1); });
