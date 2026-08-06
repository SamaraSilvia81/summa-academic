#!/usr/bin/env node
/**
 * backfill-books.mjs — Mineração de livros para o Acervo do Summa.sh
 *
 * Fontes: Open Library API (gratuita, sem auth)
 * Insere na tabela `references` com type='book' e origin='backfill'
 *
 * Uso:
 *   PROFILE_ID=xxx node scripts/backfill-books.mjs
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

// ── Livros conhecidos da dissertação (por ISBN) ──────────────────

const KNOWN_BOOKS = [
  { isbn: '9781492082996', note: 'Building Micro-Frontends — Luca Mezzalira' },
  { isbn: '9781484295878', note: 'The Art of Micro Frontends — Florian Rappl' },
  { isbn: '9781492043454', note: 'Fundamentals of Software Architecture — Richards & Ford' },
  { isbn: '9780135645932', note: 'Managing Technical Debt — Kruchten, Nord, Ozkaya' },
  { isbn: '9780134494166', note: 'Clean Architecture — Robert C. Martin' },
  { isbn: '9781491950357', note: 'Building Microservices — Sam Newman' },
  { isbn: '9781492047544', note: 'Monolith to Microservices — Sam Newman' },
  { isbn: '9780596517748', note: 'JavaScript: The Good Parts — Douglas Crockford' },
  { isbn: '9781617294525', note: 'Micro Frontends in Action — Michael Geers' },
];

// ── Keywords pra busca geral de livros ──────────────────────────

const BOOK_KEYWORDS = [
  'microfrontend',
  'micro frontend',
  'technical debt software',
  'software architecture patterns',
  'microservices architecture',
  'frontend architecture',
  'web components',
];

// ── Open Library API ─────────────────────────────────────────────

async function fetchBookByISBN(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  console.log(`  [isbn] buscando ISBN ${isbn}...`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library retornou ${res.status}`);

  const data = await res.json();
  const key = `ISBN:${isbn}`;
  const book = data[key];
  if (!book) return null;

  return {
    title: book.title || 'Sem título',
    authors: (book.authors || []).map((a) => a.name).join(', '),
    summary: book.excerpts?.[0]?.text || book.notes || '',
    year: book.publish_date ? parseInt(book.publish_date.match(/\d{4}/)?.[0] || '0', 10) : null,
    doi: null,
    url: book.url || `https://openlibrary.org/isbn/${isbn}`,
    source: 'open_library',
    venue: (book.publishers || []).map((p) => p.name).join(', ') || null,
    type: 'book',
    language: 'en',
    publishedAt: book.publish_date ? new Date(book.publish_date.match(/\d{4}/)?.[0] || '2000') : null,
    isbn,
  };
}

async function searchBooks(keyword, limit = 20) {
  const q = encodeURIComponent(keyword);
  const url = `https://openlibrary.org/search.json?q=${q}&limit=${limit}&fields=title,author_name,first_publish_year,isbn,publisher,subject,key`;

  console.log(`  [search] buscando "${keyword}"...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library search retornou ${res.status}`);

  const data = await res.json();
  return (data.docs || []).map((doc) => ({
    title: doc.title || 'Sem título',
    authors: (doc.author_name || []).join(', '),
    summary: '',
    year: doc.first_publish_year || null,
    doi: null,
    url: doc.key ? `https://openlibrary.org${doc.key}` : null,
    source: 'open_library',
    venue: (doc.publisher || []).slice(0, 2).join(', ') || null,
    type: 'book',
    language: 'en',
    publishedAt: doc.first_publish_year ? new Date(`${doc.first_publish_year}-01-01`) : null,
    isbn: (doc.isbn || [])[0] || null,
  }));
}

// ── Deduplicação ────────────────────────────────────────────────

function normalizeTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

// ── Insert ──────────────────────────────────────────────────────

async function insertBooks(profileId, items) {
  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    const { data, error } = await supabase
      .from('references')
      .insert({
        profile_id: profileId,
        title: item.title,
        authors: item.authors || null,
        summary: (typeof item.summary === 'string' ? item.summary : '') || null,
        venue: item.venue || null,
        year: item.year,
        doi: null,
        url: item.url || null,
        source: item.source || 'open_library',
        type: 'book',
        tags: ['backfill', 'book', item.isbn ? `isbn:${item.isbn}` : 'search'].filter(Boolean),
        language: item.language || 'en',
        origin: 'backfill',
        published_at: item.publishedAt ? item.publishedAt.toISOString() : null,
        is_read: false,
        is_favorite: false,
        is_dismissed: false,
        is_saved: false,
        created_at: new Date().toISOString(),
      })
      .select('id');

    if (error) {
      console.error(`  [erro] "${item.title.slice(0, 50)}": ${error.message}`);
      skipped++;
    } else {
      inserted++;
    }
    await sleep(100);
  }
  return { inserted, skipped };
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════╗
║     SUMMA.SH — BACKFILL DE LIVROS         ║
╚═══════════════════════════════════════════╝
`);

  if (!PROFILE_ID) {
    console.error('[erro] PROFILE_ID é obrigatório.\n');
    process.exit(1);
  }

  console.log(`[config] profile_id: ${PROFILE_ID}`);
  console.log(`[config] dry_run: ${DRY_RUN}\n`);

  const seenTitles = new Set();
  const allBooks = [];

  // ── Fase 1: Livros conhecidos por ISBN ──
  console.log('══ FASE 1: Livros por ISBN ══\n');
  for (const { isbn, note } of KNOWN_BOOKS) {
    try {
      const book = await fetchBookByISBN(isbn);
      if (book) {
        const key = normalizeTitle(book.title);
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          allBooks.push(book);
          console.log(`    ✓ ${book.title} (${book.year})`);
        }
      } else {
        console.log(`    ✗ ISBN ${isbn} não encontrado (${note})`);
      }
      await sleep(500);
    } catch (err) {
      console.error(`  [isbn] erro ${isbn}: ${err.message}`);
    }
  }
  console.log(`\n  Total por ISBN: ${allBooks.length}\n`);

  // ── Fase 2: Busca por keyword ──
  console.log('══ FASE 2: Busca por keyword ══\n');
  for (const keyword of BOOK_KEYWORDS) {
    try {
      const results = await searchBooks(keyword, 15);
      let added = 0;
      for (const book of results) {
        const key = normalizeTitle(book.title);
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          allBooks.push(book);
          added++;
        }
      }
      console.log(`    -> ${results.length} resultados, ${added} novos`);
      await sleep(1000);
    } catch (err) {
      console.error(`  [search] erro "${keyword}": ${err.message}`);
    }
  }

  console.log(`\n[total] ${allBooks.length} livros únicos\n`);

  if (DRY_RUN) {
    console.log('[dry_run] nenhum dado inserido.\n');
    allBooks.slice(0, 10).forEach((b, i) => console.log(`  ${i + 1}. [${b.year || '?'}] ${b.title}`));
    return;
  }

  const result = await insertBooks(PROFILE_ID, allBooks);
  console.log(`\n[done] ${result.inserted} livros inseridos, ${result.skipped} pulados.\n`);
}

main().catch((err) => { console.error('[fatal]', err); process.exit(1); });
