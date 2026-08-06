/**
 * citations.js — Gerador de citações e exportação bibliográfica.
 *
 * Formatos suportados:
 * - ABNT (NBR 6023:2018)
 * - APA (7ª edição)
 * - BibTeX (.bib)
 * - RIS (.ris)
 *
 * Todos recebem um objeto `ref` com os campos da tabela `references`:
 * { title, authors, year, venue, doi, url, type, tags }
 */

// ── Helpers ──────────────────────────────────────────────────────

/** Separa string de autores em array. Aceita "A, B, C" ou "A; B; C". */
function parseAuthors(authors) {
  if (!authors) return [];
  return authors
    .split(/[;,]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

/** "João Silva" → "SILVA, João" (pra ABNT). */
function invertName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.toUpperCase();
  const last = parts.pop();
  return `${last.toUpperCase()}, ${parts.join(' ')}`;
}

/** "João Silva" → "Silva, J." (pra APA). */
function apaName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const last = parts.pop();
  const initials = parts.map((p) => `${p[0].toUpperCase()}.`).join(' ');
  return `${last}, ${initials}`;
}

/** Gera uma chave pra BibTeX: sobrenome + ano + primeira palavra do título. */
function bibKey(ref) {
  const authors = parseAuthors(ref.authors);
  const surname = authors.length > 0
    ? authors[0].trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '')
    : 'unknown';
  const year = ref.year || 'nd';
  const word = (ref.title || 'untitled')
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${surname}${year}${word}`;
}

// ── ABNT (NBR 6023:2018) ─────────────────────────────────────────

export function formatABNT(ref) {
  const authors = parseAuthors(ref.authors);
  const type = ref.type || 'paper_read';

  // Autores
  let authorStr = '';
  if (authors.length === 0) {
    authorStr = '';
  } else if (authors.length <= 3) {
    authorStr = authors.map(invertName).join('; ');
  } else {
    authorStr = `${invertName(authors[0])} et al.`;
  }

  // Título
  const title = ref.title || 'Sem título';

  // Ano
  const year = ref.year || '[s.d.]';

  // Tipo-específico
  if (type === 'book') {
    const parts = [authorStr, `**${title}**`];
    if (ref.venue) parts.push(ref.venue); // editora
    parts.push(`${year}`);
    return parts.filter(Boolean).join('. ') + '.';
  }

  // Paper / artigo padrão
  const parts = [authorStr, `${title}`];
  if (ref.venue) parts.push(`**${ref.venue}**`);
  parts.push(`${year}`);
  if (ref.doi) parts.push(`DOI: ${ref.doi}`);
  else if (ref.url) parts.push(`Disponível em: ${ref.url}`);
  return parts.filter(Boolean).join('. ') + '.';
}

// ── APA (7ª edição) ──────────────────────────────────────────────

export function formatAPA(ref) {
  const authors = parseAuthors(ref.authors);
  const type = ref.type || 'paper_read';

  // Autores
  let authorStr = '';
  if (authors.length === 0) {
    authorStr = '';
  } else if (authors.length === 1) {
    authorStr = apaName(authors[0]);
  } else if (authors.length <= 20) {
    const names = authors.map(apaName);
    authorStr = names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1];
  } else {
    authorStr = authors.slice(0, 19).map(apaName).join(', ') + ', ... ' + apaName(authors[authors.length - 1]);
  }

  const year = ref.year ? `(${ref.year})` : '(n.d.)';
  const title = ref.title || 'Untitled';

  if (type === 'book') {
    const parts = [`${authorStr} ${year}`, `*${title}*`];
    if (ref.venue) parts.push(ref.venue);
    return parts.filter(Boolean).join('. ') + '.';
  }

  const parts = [`${authorStr} ${year}`, title];
  if (ref.venue) parts.push(`*${ref.venue}*`);
  if (ref.doi) parts.push(`https://doi.org/${ref.doi}`);
  else if (ref.url) parts.push(ref.url);
  return parts.filter(Boolean).join('. ') + '.';
}

// ── BibTeX ───────────────────────────────────────────────────────

export function formatBibTeX(ref) {
  const type = ref.type || 'paper_read';
  const entryType = type === 'book' ? 'book'
    : type === 'thesis' || type === 'tese' ? 'mastersthesis'
    : type === 'post' ? 'misc'
    : 'article';

  const key = bibKey(ref);
  const lines = [`@${entryType}{${key},`];

  if (ref.title) lines.push(`  title = {${ref.title}},`);
  if (ref.authors) lines.push(`  author = {${ref.authors}},`);
  if (ref.year) lines.push(`  year = {${ref.year}},`);
  if (ref.venue) {
    if (entryType === 'book') lines.push(`  publisher = {${ref.venue}},`);
    else lines.push(`  journal = {${ref.venue}},`);
  }
  if (ref.doi) lines.push(`  doi = {${ref.doi}},`);
  if (ref.url) lines.push(`  url = {${ref.url}},`);

  lines.push('}');
  return lines.join('\n');
}

// ── RIS ──────────────────────────────────────────────────────────

export function formatRIS(ref) {
  const type = ref.type || 'paper_read';
  const risType = type === 'book' ? 'BOOK'
    : type === 'thesis' || type === 'tese' ? 'THES'
    : type === 'post' ? 'ELEC'
    : 'JOUR';

  const lines = [`TY  - ${risType}`];

  if (ref.title) lines.push(`TI  - ${ref.title}`);

  const authors = parseAuthors(ref.authors);
  for (const author of authors) {
    lines.push(`AU  - ${author}`);
  }

  if (ref.year) lines.push(`PY  - ${ref.year}`);
  if (ref.venue) lines.push(`JO  - ${ref.venue}`);
  if (ref.doi) lines.push(`DO  - ${ref.doi}`);
  if (ref.url) lines.push(`UR  - ${ref.url}`);
  if (ref.summary) lines.push(`AB  - ${ref.summary.slice(0, 500)}`);

  lines.push('ER  - ');
  return lines.join('\n');
}

// ── Formatação em lote ──────────────────────────────────────────

export function formatAll(ref) {
  return {
    abnt: formatABNT(ref),
    apa: formatAPA(ref),
    bibtex: formatBibTeX(ref),
    ris: formatRIS(ref),
  };
}

// ── Exportação de arquivo ────────────────────────────────────────

/** Baixa um arquivo .bib com todas as referências. */
export function exportBibTeX(references) {
  const content = references.map(formatBibTeX).join('\n\n');
  downloadFile(content, 'summa-references.bib', 'application/x-bibtex');
}

/** Baixa um arquivo .ris com todas as referências. */
export function exportRIS(references) {
  const content = references.map(formatRIS).join('\n\n');
  downloadFile(content, 'summa-references.ris', 'application/x-research-info-systems');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Copiar citação pro clipboard ─────────────────────────────────

export async function copyCitation(ref, format = 'abnt') {
  const formatters = { abnt: formatABNT, apa: formatAPA, bibtex: formatBibTeX, ris: formatRIS };
  const fn = formatters[format] || formatABNT;
  const text = fn(ref);
  await navigator.clipboard.writeText(text.replace(/\*\*/g, '').replace(/\*/g, ''));
  return text;
}