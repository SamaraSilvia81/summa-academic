import { useMemo } from 'react';
import styles from './MarkdownPreview.module.css';

/**
 * MarkdownPreview
 * Renderiza Markdown puro (sem deps externas além de React) no padrão
 * editorial Confluence: headings hierárquicos, tabelas com header,
 * badges de código inline, callouts, listas, blockquotes, hrules.
 *
 * Suporta: # ## ### heading, **bold**, *italic*, `inline code`,
 * ```code blocks```, > blockquote, - / * / 1. listas,
 * | tabela | com | header |, ---/*** hrule, [link](url), ~~strike~~
 */
export function MarkdownPreview({ content = '', docTitle = '' }) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={styles.previewPane}>
      <div className={styles.previewHeader}>
        <span className={styles.previewLabel}>
          <span className={styles.labelDot} />
          preview · markdown
        </span>
        <span className={styles.charCount}>
          {content.length} chars
        </span>
      </div>

      <div className={styles.scroll}>
        <article className={styles.document}>
          {elements.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>M↓</div>
              <p>comece a escrever no editor à esquerda</p>
              <p className={styles.emptyHint}>o preview aparece aqui em tempo real</p>
            </div>
          ) : (
            elements
          )}
        </article>
      </div>
    </div>
  );
}

// ─── Markdown parser ──────────────────────────────────────────────

function parseMarkdown(text) {
  if (!text.trim()) return [];

  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ─────────────────────────────────────────
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <CodeBlock key={key++} lang={lang} code={codeLines.join('\n')} />
      );
      i++;
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      elements.push(<hr key={key++} className={styles.hr} />);
      i++;
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────
    if (line.includes('|') && i + 1 < lines.length && /^\|[-\s|:]+\|/.test(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<MDTable key={key++} lines={tableLines} />);
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────
    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote key={key++} className={styles.blockquote}>
          {quoteLines.map((l, j) => (
            <p key={j}>{renderInline(l)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className={styles.ol}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={key++} className={styles.ul}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = `h${level}`;
      elements.push(
        <Tag key={key++} className={styles[`h${level}`]}>
          {level <= 2 && <span className={styles.headingAnchor}>#</span>}
          {renderInline(text)}
        </Tag>
      );
      i++;
      continue;
    }

    // ── Empty line ────────────────────────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].includes('|')
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className={styles.para}>
          {paraLines.map((l, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {renderInline(l)}
            </span>
          ))}
        </p>
      );
    }
  }

  return elements;
}

// ─── Inline renderer ─────────────────────────────────────────────

function renderInline(text) {
  if (!text) return null;

  // Split on markdown inline patterns
  const parts = [];
  let remaining = text;
  let keyI = 0;

  const patterns = [
    // ~~strikethrough~~
    { re: /~~([^~]+)~~/, render: (m) => <s key={keyI++}>{m[1]}</s> },
    // **bold** or __bold__
    { re: /\*\*([^*]+)\*\*|__([^_]+)__/, render: (m) => <strong key={keyI++}>{m[1] || m[2]}</strong> },
    // *italic* or _italic_
    { re: /\*([^*]+)\*|_([^_]+)_/, render: (m) => <em key={keyI++}>{m[1] || m[2]}</em> },
    // `inline code`
    { re: /`([^`]+)`/, render: (m) => <code key={keyI++} className={styles.inlineCode}>{m[1]}</code> },
    // [link text](url)
    {
      re: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => (
        <a key={keyI++} href={m[2]} className={styles.link} target="_blank" rel="noopener noreferrer">
          {m[1]}
        </a>
      ),
    },
  ];

  function processText(str) {
    if (!str) return [];
    const result = [];
    let s = str;

    while (s.length > 0) {
      let earliest = null;
      let earliestIndex = Infinity;
      let earliestMatch = null;

      for (const p of patterns) {
        const m = s.match(p.re);
        if (m && s.indexOf(m[0]) < earliestIndex) {
          earliest = p;
          earliestIndex = s.indexOf(m[0]);
          earliestMatch = m;
        }
      }

      if (!earliest) {
        result.push(s);
        break;
      }

      // Text before the match
      if (earliestIndex > 0) {
        result.push(s.slice(0, earliestIndex));
      }

      // The matched element
      result.push(earliest.render(earliestMatch));

      // Remaining text
      s = s.slice(earliestIndex + earliestMatch[0].length);
    }

    return result;
  }

  return processText(text);
}

// ─── Table component ──────────────────────────────────────────────

function MDTable({ lines }) {
  const rows = lines
    .filter((l, i) => !/^\|[-\s|:]+\|$/.test(l.trim()) || i === 0)
    .map(l =>
      l.trim()
        .replace(/^\|/, '').replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim())
    );

  if (rows.length === 0) return null;

  const [header, ...body] = rows;

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className={styles.th}>{renderInline(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={styles.tr}>
              {row.map((cell, ci) => (
                <td key={ci} className={styles.td}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Code block component ─────────────────────────────────────────

function CodeBlock({ code, lang }) {
  return (
    <div className={styles.codeBlockWrapper}>
      {lang && <span className={styles.codeLang}>{lang}</span>}
      <pre className={styles.codeBlock}>
        <code>{code}</code>
      </pre>
    </div>
  );
}