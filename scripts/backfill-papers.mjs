#!/usr/bin/env node
/**
 * backfill-papers.mjs — Mineração de papers históricos para o Summa.sh
 *
 * Roda localmente no seu terminal (Node.js 18+).
 * Acessa ArXiv e Semantic Scholar DIRETAMENTE, sem proxy.
 * Insere na tabela `references` (Acervo) do Supabase.
 *
 * Uso:
 *   node scripts/backfill-papers.mjs
 *
 * Opções via variáveis de ambiente ou argumentos:
 *   PROFILE_ID=<uuid>       — seu profile_id no Supabase (obrigatório)
 *   KEYWORD="microfrontend"  — palavra-chave principal (default: microfrontend)
 *   MAX_RESULTS=500          — limite total de items (default: 500)
 *   DRY_RUN=true             — só imprime, não insere no banco
 *   TARGET=references        — onde inserir: "references" (Acervo), "radar" ou "both"
 *
 * Exemplo:
 *   PROFILE_ID=abc-123 KEYWORD="micro frontend" MAX_RESULTS=200 node scripts/backfill-papers.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────

const SUPABASE_URL = 'https://rmxxvpqkbeyorvyxydmn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteHh2cHFrYmV5b3J2eXh5ZG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDg3MjUsImV4cCI6MjA5OTA4NDcyNX0.AgDO2S0LGq6-BHGZhATljpXfG62mMPLFbfehI-NV3W4';

// Se tiver a service_role key, usa ela (bypassa RLS). Caso contrário, autentica com email/senha.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || null;

const PROFILE_ID   = process.env.PROFILE_ID || null;
const MAX_RESULTS  = parseInt(process.env.MAX_RESULTS || '500', 10);
const DRY_RUN      = process.env.DRY_RUN === 'true';
const TARGET       = process.env.TARGET || 'references'; // 'references' | 'radar' | 'both'

// Todas as variações de keywords pra busca
const KEYWORDS = [
  'microfrontend',
  'micro frontend',
  'micro-frontend',
  'microfrontends',
  'micro frontends',
  'micro-frontends',
  'self-admitted technical debt',
  'SATD',
  'technical debt microfrontend',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Supabase client ─────────────────────────────────────────────

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY ? { auth: { persistSession: false } } : undefined,
);

// ── ArXiv API ───────────────────────────────────────────────────

async function fetchArxiv(keyword, start = 0, maxResults = 100) {
  const q = encodeURIComponent(`all:"${keyword}"`);
  const url = `https://export.arxiv.org/api/query?search_query=${q}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  console.log(`  [arxiv] buscando "${keyword}" start=${start}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'summa-sh-backfill/1.0 (mailto:samarasilvia.dev@gmail.com)' },
  });

  if (!res.ok) throw new Error(`ArXiv retornou ${res.status}`);
  const xml = await res.text();

  // Parse XML simples (sem dependência externa)
  const entries = xml.split('<entry>').slice(1);
  return entries.map((entry) => {
    const get = (tag) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].trim() : null;
    };
    const getAll = (tag) => {
      const matches = [];
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
      let m;
      while ((m = regex.exec(entry))) matches.push(m[1].trim());
      return matches;
    };

    const id = get('id');
    const title = (get('title') || '').replace(/\s+/g, ' ');
    const summary = (get('summary') || '').replace(/\s+/g, ' ').slice(0, 1000);
    const published = get('published');
    const year = published ? parseInt(published.slice(0, 4), 10) : null;

    // Autores
    const authorBlocks = entry.split('<author>').slice(1);
    const authors = authorBlocks
      .map((a) => { const m = a.match(/<name>([^<]+)<\/name>/); return m ? m[1].trim() : null; })
      .filter(Boolean)
      .join(', ');

    // DOI (se presente)
    const doiMatch = entry.match(/doi\.org\/([^\s<"]+)/i);
    const doi = doiMatch ? doiMatch[1] : null;

    // Link do paper
    const pdfLink = entry.match(/href="([^"]*)"[^>]*title="pdf"/);
    const absLink = id || null;

    return {
      title,
      authors,
      summary,
      year,
      doi,
      url: pdfLink ? pdfLink[1] : absLink,
      source: 'arxiv',
      publishedAt: published ? new Date(published) : null,
      venue: 'arXiv',
      type: 'paper_read',
      language: 'en',
    };
  });
}

// ── Semantic Scholar API ────────────────────────────────────────

async function fetchSemanticScholar(keyword, offset = 0, limit = 100) {
  const fields = 'title,authors,abstract,year,externalIds,venue,url,publicationDate';
  const q = encodeURIComponent(keyword);
  const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&offset=${offset}&limit=${limit}&fields=${fields}`;

  console.log(`  [s2] buscando "${keyword}" offset=${offset}...`);
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'summa-sh-backfill/1.0 (mailto:samarasilvia.dev@gmail.com)' },
  });

  if (res.status === 429) {
    console.log('  [s2] rate limited, esperando 30s...');
    await sleep(30000);
    return fetchSemanticScholar(keyword, offset, limit);
  }
  if (!res.ok) throw new Error(`Semantic Scholar retornou ${res.status}`);

  const data = await res.json();
  return (data.data || []).map((p) => ({
    title: p.title || 'Sem título',
    authors: (p.authors || []).map((a) => a.name).join(', '),
    summary: (p.abstract || '').slice(0, 1000),
    year: p.year || null,
    doi: p.externalIds?.DOI || null,
    url: p.externalIds?.DOI
      ? `https://doi.org/${p.externalIds.DOI}`
      : (p.url || null),
    source: 'semantic_scholar',
    publishedAt: p.publicationDate ? new Date(p.publicationDate) : null,
    venue: p.venue || null,
    type: 'paper_read',
    language: 'en',
  }));
}

// ── Deduplicação ────────────────────────────────────────────────

function normalizeTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    // Deduplica por DOI ou título normalizado
    const key = item.doi
      ? `doi:${item.doi.toLowerCase()}`
      : `title:${normalizeTitle(item.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Insert no Supabase ──────────────────────────────────────────

function toSnake(obj) {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
      toSnake(v),
    ])
  );
}

async function insertReferences(profileId, items) {
  const BATCH = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map((item) => toSnake({
      profileId,
      title: item.title,
      authors: item.authors,
      venue: item.venue || null,
      year: item.year,
      doi: item.doi || null,
      url: item.url || null,
      type: 'paper_read',
      tags: ['backfill', item.source],
      personalNote: null,
      rating: null,
      isRead: false,
      isFavorite: false,
      createdAt: new Date(),
    }));

    const { data, error } = await supabase
      .from('references')
      .upsert(batch, { onConflict: 'profile_id,doi', ignoreDuplicates: true })
      .select('id');

    if (error) {
      // Se o upsert com doi falha (items sem DOI), tenta insert normal
      if (error.message?.includes('upsert') || error.message?.includes('constraint')) {
        const { data: d2, error: e2 } = await supabase
          .from('references')
          .insert(batch)
          .select('id');
        if (e2) {
          console.error(`  [erro] batch ${i}-${i + BATCH}: ${e2.message}`);
          skipped += batch.length;
        } else {
          inserted += (d2 || []).length;
        }
      } else {
        console.error(`  [erro] batch ${i}-${i + BATCH}: ${error.message}`);
        skipped += batch.length;
      }
    } else {
      inserted += (data || []).length;
    }

    process.stdout.write(`\r  [inserindo] ${inserted} inseridos, ${skipped} pulados de ${items.length}...`);
    await sleep(200); // rate limit suave
  }
  console.log('');
  return { inserted, skipped };
}

async function insertRadarItems(profileId, items) {
  const BATCH = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map((item) => toSnake({
      profileId,
      title: item.title,
      type: 'paper',
      source: item.source,
      sourceUrl: item.url || null,
      authors: item.authors,
      summary: item.summary || null,
      relevanceScore: 70, // score default pra backfill
      relevanceReason: 'Importado via backfill histórico',
      matchedKeywords: [],
      language: item.language || 'en',
      deadline: null,
      isRead: false,
      isSaved: false,
      isDismissed: false,
      fetchedAt: new Date(),
      publishedAt: item.publishedAt || null,
    }));

    const { data, error } = await supabase
      .from('radar_items')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`  [erro] batch ${i}-${i + BATCH}: ${error.message}`);
      skipped += batch.length;
    } else {
      inserted += (data || []).length;
    }

    process.stdout.write(`\r  [inserindo radar] ${inserted} inseridos, ${skipped} pulados de ${items.length}...`);
    await sleep(200);
  }
  console.log('');
  return { inserted, skipped };
}

// ── Autenticação (se não tem service key) ───────────────────────

async function authenticateIfNeeded() {
  if (SUPABASE_SERVICE_KEY) {
    console.log('[auth] usando service_role key (RLS bypass)');
    return;
  }

  // Pede email e senha via stdin
  const email = process.env.SUPABASE_EMAIL;
  const password = process.env.SUPABASE_PASSWORD;

  if (!email || !password) {
    console.error('\n[erro] Sem service_role key. Passe SUPABASE_EMAIL e SUPABASE_PASSWORD:');
    console.error('  SUPABASE_EMAIL=seu@email.com SUPABASE_PASSWORD=senha PROFILE_ID=xxx node scripts/backfill-papers.mjs\n');
    console.error('Ou passe SUPABASE_SERVICE_KEY (pega no dashboard do Supabase em Settings > API > service_role).\n');
    process.exit(1);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`[auth] falha: ${error.message}`);
    process.exit(1);
  }
  console.log(`[auth] autenticado como ${email}`);
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════╗
║     SUMMA.SH — BACKFILL DE PAPERS         ║
║     mineração histórica de artigos        ║
╚═══════════════════════════════════════════╝
`);

  if (!PROFILE_ID) {
    console.error('[erro] PROFILE_ID é obrigatório.');
    console.error('  Pegue seu profile_id na tabela "profiles" do Supabase Dashboard.');
    console.error('  Uso: PROFILE_ID=xxx node scripts/backfill-papers.mjs\n');
    process.exit(1);
  }

  await authenticateIfNeeded();

  console.log(`[config] profile_id: ${PROFILE_ID}`);
  console.log(`[config] keywords: ${KEYWORDS.join(', ')}`);
  console.log(`[config] max_results: ${MAX_RESULTS}`);
  console.log(`[config] target: ${TARGET}`);
  console.log(`[config] dry_run: ${DRY_RUN}\n`);

  // ── Coleta ──────────────────────────────────────────────────
  let allPapers = [];

  // ArXiv: busca paginada por keyword
  for (const keyword of KEYWORDS) {
    try {
      let start = 0;
      const perPage = 100;
      let hasMore = true;

      while (hasMore && allPapers.length < MAX_RESULTS) {
        const batch = await fetchArxiv(keyword, start, perPage);
        allPapers.push(...batch);
        console.log(`    -> ${batch.length} resultados (total parcial: ${allPapers.length})`);

        if (batch.length < perPage) hasMore = false;
        start += perPage;

        // ArXiv pede 3s entre requests
        await sleep(3000);
      }
    } catch (err) {
      console.error(`  [arxiv] erro com "${keyword}": ${err.message}`);
    }
  }

  // Semantic Scholar: busca por keyword
  for (const keyword of KEYWORDS) {
    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore && allPapers.length < MAX_RESULTS * 2) {
        const batch = await fetchSemanticScholar(keyword, offset, limit);
        allPapers.push(...batch);
        console.log(`    -> ${batch.length} resultados (total parcial: ${allPapers.length})`);

        if (batch.length < limit) hasMore = false;
        offset += limit;

        // S2 rate limit: 1 req/s
        await sleep(1500);
      }
    } catch (err) {
      console.error(`  [s2] erro com "${keyword}": ${err.message}`);
    }
  }

  // ── Deduplica ─────────────────────────────────────────────────
  console.log(`\n[dedupe] ${allPapers.length} papers brutos...`);
  const unique = deduplicate(allPapers);
  console.log(`[dedupe] ${unique.length} papers únicos após deduplicação.\n`);

  // Limita ao MAX_RESULTS
  const final = unique.slice(0, MAX_RESULTS);

  // ── Preview ───────────────────────────────────────────────────
  console.log('[preview] primeiros 5 items:');
  final.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.year || '?'}] ${p.title.slice(0, 80)}...`);
    console.log(`     ${p.source} | ${p.authors.split(',').slice(0, 2).join(', ')}`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('[dry_run] nenhum dado inserido. Remova DRY_RUN=true pra executar.\n');
    // Salva JSON pra inspeção
    const fs = await import('fs');
    fs.writeFileSync('backfill-preview.json', JSON.stringify(final.slice(0, 20), null, 2));
    console.log('[dry_run] salvou backfill-preview.json com 20 items de amostra.\n');
    return;
  }

  // ── Inserção ──────────────────────────────────────────────────
  if (TARGET === 'references' || TARGET === 'both') {
    console.log(`[insert] inserindo ${final.length} papers na tabela references (Acervo)...`);
    const result = await insertReferences(PROFILE_ID, final);
    console.log(`[insert] Acervo: ${result.inserted} inseridos, ${result.skipped} pulados.\n`);
  }

  if (TARGET === 'radar' || TARGET === 'both') {
    console.log(`[insert] inserindo ${final.length} papers na tabela radar_items (Farol)...`);
    const result = await insertRadarItems(PROFILE_ID, final);
    console.log(`[insert] Farol: ${result.inserted} inseridos, ${result.skipped} pulados.\n`);
  }

  console.log('[done] backfill completo!\n');
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
