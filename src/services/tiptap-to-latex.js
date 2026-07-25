/**
 * Conversor TipTap JSON → LaTeX
 *
 * Mapeia cada node do TipTap pro equivalente LaTeX.
 * Usado quando o pesquisador exporta o documento.
 */

import { TEMPLATES } from './latex-templates';

/**
 * Converte marks (bold, italic, code, etc.) pra LaTeX
 */
function marksToLatex(text, marks = []) {
  let result = escapeLatex(text);

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `\\textbf{${result}}`;
        break;
      case 'italic':
        result = `\\textit{${result}}`;
        break;
      case 'strike':
        result = `\\sout{${result}}`;
        break;
      case 'code':
        result = `\\texttt{${result}}`;
        break;
      case 'highlight':
        result = `\\hl{${result}}`;
        break;
      case 'link':
        result = `\\href{${mark.attrs?.href || ''}}{${result}}`;
        break;
    }
  }

  return result;
}

/**
 * Escapa caracteres especiais do LaTeX
 */
function escapeLatex(text) {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, m => `\\${m}`)
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Converte o conteúdo inline de um node (array de text nodes com marks)
 */
function inlineToLatex(content = []) {
  return content
    .map(node => {
      if (node.type === 'text') {
        return marksToLatex(node.text || '', node.marks);
      }
      if (node.type === 'hardBreak') {
        return '\\\\';
      }
      return '';
    })
    .join('');
}

/**
 * Heading level → LaTeX command
 */
function headingCommand(level) {
  const commands = {
    1: '\\section',
    2: '\\subsection',
    3: '\\subsubsection',
    4: '\\paragraph',
    5: '\\subparagraph',
  };
  return commands[level] || '\\paragraph';
}

/**
 * Converte um node TipTap → string LaTeX
 */
function nodeToLatex(node) {
  switch (node.type) {
    case 'paragraph':
      return inlineToLatex(node.content) + '\n\n';

    case 'heading':
      return `${headingCommand(node.attrs?.level || 2)}{${inlineToLatex(node.content)}}\n\n`;

    case 'bulletList':
      return `\\begin{itemize}\n${(node.content || []).map(nodeToLatex).join('')}\\end{itemize}\n\n`;

    case 'orderedList':
      return `\\begin{enumerate}\n${(node.content || []).map(nodeToLatex).join('')}\\end{enumerate}\n\n`;

    case 'listItem':
      return `  \\item ${(node.content || []).map(nodeToLatex).join('').trim()}\n`;

    case 'blockquote':
      return `\\begin{quote}\n${(node.content || []).map(nodeToLatex).join('')}\\end{quote}\n\n`;

    case 'codeBlock':
      const lang = node.attrs?.language || '';
      return `\\begin{lstlisting}${lang ? `[language=${lang}]` : ''}\n${inlineToLatex(node.content)}\n\\end{lstlisting}\n\n`;

    case 'horizontalRule':
      return '\\noindent\\rule{\\textwidth}{0.4pt}\n\n';

    case 'hardBreak':
      return '\\\\\n';

    case 'image':
      const src = node.attrs?.src || '';
      const alt = node.attrs?.alt || '';
      return `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{${src}}\n  \\caption{${escapeLatex(alt)}}\n\\end{figure}\n\n`;

    case 'table':
      return convertTable(node);

    default:
      if (node.content) {
        return (node.content || []).map(nodeToLatex).join('');
      }
      return '';
  }
}

/**
 * Converte tabela TipTap → LaTeX tabular
 */
function convertTable(node) {
  const rows = (node.content || []).map(row => {
    const cells = (row.content || []).map(cell => {
      return (cell.content || []).map(nodeToLatex).join('').trim();
    });
    return cells.join(' & ');
  });

  if (rows.length === 0) return '';

  const colCount = (node.content?.[0]?.content || []).length;
  const colSpec = 'l'.repeat(colCount).split('').join('|');

  let result = `\\begin{table}[h]\n\\centering\n\\begin{tabular}{|${colSpec}|}\n\\hline\n`;
  result += rows.map(r => `${r} \\\\ \\hline`).join('\n');
  result += `\n\\end{tabular}\n\\end{table}\n\n`;

  return result;
}

/**
 * Converte documento TipTap JSON completo → LaTeX string
 *
 * @param {object} tiptapJson - JSON do editor TipTap
 * @param {string} templateId - 'ieee' | 'acm' | 'sbc' | 'free'
 * @param {object} metadata - { title, author, institution }
 * @returns {string} LaTeX completo
 */
export function convertToLatex(tiptapJson, templateId = 'free', metadata = {}) {
  const tpl = TEMPLATES[templateId] || TEMPLATES.free;

  const title = metadata.title || 'Untitled';
  const author = metadata.author || 'Author';
  const institution = metadata.institution || '';

  // Preâmbulo
  let latex = tpl.preamble + '\n\n';
  latex += '\\begin{document}\n\n';

  // Header do documento
  let docStart = tpl.documentStart
    .replace('%%TITLE%%', escapeLatex(title))
    .replace('%%AUTHOR%%', escapeLatex(author))
    .replace('%%INSTITUTION%%', escapeLatex(institution));
  latex += docStart + '\n\n';

  // Conteúdo
  if (tiptapJson?.content) {
    for (const node of tiptapJson.content) {
      latex += nodeToLatex(node);
    }
  }

  latex += '\\end{document}\n';

  return latex;
}

/**
 * Converte TipTap JSON → HTML (pra preview ou fallback)
 */
export function convertToHtml(tiptapJson) {
  if (!tiptapJson?.content) return '';
  return tiptapJson.content.map(nodeToHtml).join('');
}

function nodeToHtml(node) {
  switch (node.type) {
    case 'paragraph':
      return `<p>${inlineToHtml(node.content)}</p>`;
    case 'heading':
      const tag = `h${node.attrs?.level || 2}`;
      return `<${tag}>${inlineToHtml(node.content)}</${tag}>`;
    case 'bulletList':
      return `<ul>${(node.content || []).map(nodeToHtml).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content || []).map(nodeToHtml).join('')}</ol>`;
    case 'listItem':
      return `<li>${(node.content || []).map(nodeToHtml).join('')}</li>`;
    case 'blockquote':
      return `<blockquote>${(node.content || []).map(nodeToHtml).join('')}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${inlineToHtml(node.content)}</code></pre>`;
    default:
      if (node.content) return (node.content || []).map(nodeToHtml).join('');
      return '';
  }
}

function inlineToHtml(content = []) {
  return content.map(n => {
    if (n.type === 'text') {
      let text = n.text || '';
      for (const mark of (n.marks || [])) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        if (mark.type === 'italic') text = `<em>${text}</em>`;
        if (mark.type === 'code') text = `<code>${text}</code>`;
        if (mark.type === 'strike') text = `<del>${text}</del>`;
      }
      return text;
    }
    if (n.type === 'hardBreak') return '<br>';
    return '';
  }).join('');
}