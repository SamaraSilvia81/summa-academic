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

async function fetchSemanticScholar(keyword, offset = 0, limit = 100, _retries = 0) {
  const MAX_RETRIES = 3;
  const fields = 'title,authors,abstract,year,externalIds,venue,url,publicationDate';
  const q = encodeURIComponent(keyword);
  const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&offset=${offset}&limit=${limit}&fields=${fields}`;

  console.log(`  [s2] buscando "${keyword}" offset=${offset}...`);
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'summa-sh-backfill/1.0 (mailto:samarasilvia.dev@gmail.com)' },
  });

  if (res.status === 429) {
    if (_retries >= MAX_RETRIES) {
      console.log(`  [s2] rate limited ${MAX_RETRIES}x, pulando "${keyword}" offset=${offset}`);
      return [];
    }
    console.log(`  [s2] rate limited, esperando 30s... (tentativa ${_retries + 1}/${MAX_RETRIES})`);
    await sleep(30000);
    return fetchSemanticScholar(keyword, offset, limit, _retries + 1);
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
    const batch = items.slice(i, i + BATCH).map((item) => ({
      profile_id: profileId,
      title: item.title,
      authors: item.authors || null,
      venue: item.venue || null,
      year: item.year,
      doi: item.doi || null,
      url: item.url || null,
      type: 'paper_read',
      tags: ['backfill', item.source],
      personal_note: null,
      rating: null,
      is_read: false,
      is_favorite: false,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('references')
      .insert(batch)
      .select('id');

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

  const seenTitles = new Set();
  let totalInserted = 0;

  // ── Helper: deduplica + insere um lote ──────────────────────
  async function flushBatch(papers, sourceLabel) {
    // Deduplica internamente
    const unique = papers.filter((p) => {
      const key = p.doi ? `doi:${p.doi.toLowerCase()}` : `t:${normalizeTitle(p.title)}`;
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });

    if (unique.length === 0) {
      console.log(`  [${sourceLabel}] 0 papers novos (todos duplicados)\n`);
      return;
    }

    console.log(`  [${sourceLabel}] ${unique.length} papers únicos, inserindo...`);

    if (DRY_RUN) {
      console.log(`  [dry_run] pulando inserção de ${unique.length} papers\n`);
      return;
    }

    if (TARGET === 'references' || TARGET === 'both') {
      const result = await insertReferences(PROFILE_ID, unique);
      totalInserted += result.inserted;
      console.log(`  [${sourceLabel}] Acervo: +${result.inserted} (total acumulado: ${totalInserted})\n`);
    }
    if (TARGET === 'radar' || TARGET === 'both') {
      const result = await insertRadarItems(PROFILE_ID, unique);
      console.log(`  [${sourceLabel}] Farol: +${result.inserted}\n`);
    }
  }

  // ── ArXiv: busca paginada por keyword, insere após cada keyword ──
  console.log('══ FASE 1: ArXiv ══\n');
  for (const keyword of KEYWORDS) {
    const batch = [];
    try {
      let start = 0;
      const perPage = 100;
      let hasMore = true;

      while (hasMore && batch.length < MAX_RESULTS) {
        const results = await fetchArxiv(keyword, start, perPage);
        batch.push(...results);
        console.log(`    -> ${results.length} resultados (parcial: ${batch.length})`);

        if (results.length < perPage) hasMore = false;
        start += perPage;
        await sleep(3000);
      }
    } catch (err) {
      console.error(`  [arxiv] erro com "${keyword}": ${err.message}`);
    }

    if (batch.length > 0) {
      await flushBatch(batch, `arxiv:"${keyword}"`);
    }
  }

  // ── Semantic Scholar: 1 página por keyword (evita rate limit) ──
  console.log('══ FASE 2: Semantic Scholar ══\n');
  console.log('  (buscando apenas 1 página por keyword pra evitar rate limit)\n');
  for (const keyword of KEYWORDS) {
    try {
      const results = await fetchSemanticScholar(keyword, 0, 100);
      console.log(`    -> ${results.length} resultados`);
      if (results.length > 0) {
        await flushBatch(results, `s2:"${keyword}"`);
      }
      // Espera mais entre keywords pra não levar rate limit
      await sleep(5000);
    } catch (err) {
      console.error(`  [s2] erro com "${keyword}": ${err.message}`);
    }
  }

  // ── Resumo final ────────────────────────────────────────────
  console.log(`\n[done] Backfill completo!`);
  console.log(`[done] Total inserido: ${totalInserted} papers`);
  console.log(`[done] Total únicos processados: ${seenTitles.size}\n`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
