import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReferences, useAiSuggestions } from '../../../hooks/useData';
import { DocumentRepo } from '../../../services/repositories';
import { convertToLatex } from '../../../services/tiptap-to-latex';
import { EditorToolbar } from './EditorToolbar';
import { RefsSidebar } from './RefsSidebar';
import { TemplatePreview } from './TemplatePreview';
import { MarkdownPreview } from './MarkdownPreview';
import styles from './EditorPage.module.css';

// ── Helpers ────────────────────────────────────────────────────────

function slugify(str) {
  return str.split(' ').slice(0, 4).join('_').toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Main ───────────────────────────────────────────────────────────

export function EditorPage({ profileId }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const docId = searchParams.get('doc');
  const allRefs = useReferences(profileId) ?? [];
  const aiSuggestions = useAiSuggestions(docId || null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [saveStatus, setSaveStatus] = useState('salvo ✓');
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Dual-mode state ──────────────────────────────────────────────
  // 'md' = markdown mode (textarea + markdown preview split)
  // 'tex' = latex/wysiwyg mode (tiptap + template preview)
  const [editorMode, setEditorMode] = useState('md');

  // markdown mode: raw text stored separately
  const [mdContent, setMdContent] = useState('');
  const mdRef = useRef(''); // avoid stale closure in autosave
  const mdTextareaRef = useRef(null);

  // tiptap json (for tex mode)
  const [editorJson, setEditorJson] = useState(null);

  // ── Load document ────────────────────────────────────────────────
  useEffect(() => {
    if (docId) {
      DocumentRepo.getById(docId).then(doc => {
        if (!doc) { navigate('/bancada'); return; }
        setActiveDoc(doc);

        // Determine initial mode from saved metadata or doc type
        // We store editorMode in doc.editorMode if it exists
        const savedMode = doc.editorMode ?? (doc.template === 'free' ? 'md' : 'tex');
        setEditorMode(savedMode);

        // Load content based on mode
        if (savedMode === 'md') {
          // markdown stored as plain string in doc.mdContent
          const md = typeof doc.mdContent === 'string' ? doc.mdContent : '';
          setMdContent(md);
          mdRef.current = md;
        }
      });
    } else {
      navigate('/bancada');
    }
  }, [docId, navigate]);

  // ── TipTap (tex mode) ─────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Comece a escrever...' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: activeDoc?.content || '',
    onUpdate: ({ editor: ed }) => {
      setSaveStatus('editando...');
      setEditorJson(ed.getJSON());
    },
    editorProps: {
      attributes: { class: styles.proseMirror },
    },
  }, [activeDoc?.id]);

  // ── Markdown auto-save (every 3s) ────────────────────────────────
  useEffect(() => {
    if (editorMode !== 'md' || !activeDoc?.id) return;
    const interval = setInterval(async () => {
      const current = mdRef.current;
      if (current === activeDoc.mdContent) return;
      try {
        const wc = current.split(/\s+/).filter(Boolean).length;
        await DocumentRepo.update(activeDoc.id, {
          mdContent: current,
          wordCount: wc,
          editorMode: 'md',
        });
        setSaveStatus('salvo ✓');
        setActiveDoc(prev => prev ? { ...prev, mdContent: current } : null);
      } catch {
        setSaveStatus('erro ao salvar');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [editorMode, activeDoc?.id, activeDoc?.mdContent]);

  // ── TipTap auto-save (every 3s) ──────────────────────────────────
  useEffect(() => {
    if (editorMode !== 'tex' || !editor || !activeDoc?.id) return;
    const interval = setInterval(async () => {
      const json = editor.getJSON();
      if (JSON.stringify(json) === JSON.stringify(activeDoc.content)) return;
      try {
        const wc = editor.getText().split(/\s+/).filter(Boolean).length;
        await DocumentRepo.update(activeDoc.id, {
          content: json,
          wordCount: wc,
          editorMode: 'tex',
        });
        setSaveStatus('salvo ✓');
        setActiveDoc(prev => prev ? { ...prev, content: json } : null);
      } catch {
        setSaveStatus('erro ao salvar');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [editor, editorMode, activeDoc?.id, activeDoc?.content]);

  // ── Manual save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!activeDoc?.id) return;
    try {
      if (editorMode === 'md') {
        const wc = mdRef.current.split(/\s+/).filter(Boolean).length;
        await DocumentRepo.update(activeDoc.id, {
          mdContent: mdRef.current,
          wordCount: wc,
          editorMode: 'md',
        });
      } else {
        if (!editor) return;
        const json = editor.getJSON();
        const wc = editor.getText().split(/\s+/).filter(Boolean).length;
        await DocumentRepo.update(activeDoc.id, {
          content: json,
          wordCount: wc,
          editorMode: 'tex',
        });
      }
      setSaveStatus('salvo ✓');
    } catch {
      setSaveStatus('erro ao salvar');
    }
  }, [editor, activeDoc, editorMode]);

  // ── Export ───────────────────────────────────────────────────────
  const handleExportLatex = useCallback(() => {
    if (!activeDoc) return;
    if (editorMode === 'md') {
      // Export markdown as .md file
      downloadFile(mdRef.current, `${slugify(activeDoc.title)}.md`, 'text/markdown');
    } else {
      if (!editor) return;
      try {
        const json = editor.getJSON();
        const latex = convertToLatex(json, activeDoc.template || 'free', {
          title: activeDoc.title,
          author: 'Sabino, S.S.',
          institution: 'CIn/UFPE',
        });
        downloadFile(latex, `${slugify(activeDoc.title)}.tex`, 'text/x-tex');
      } catch (err) {
        console.error('exportar .tex falhou:', err);
        setSaveStatus('erro ao exportar');
      }
    }
  }, [editor, activeDoc, editorMode]);

  // ── Mode toggle ──────────────────────────────────────────────────
  const handleModeToggle = useCallback((newMode) => {
    if (newMode === editorMode) return;
    setSaveStatus('editando...');
    setEditorMode(newMode);
    // Persist mode immediately
    if (activeDoc?.id) {
      DocumentRepo.update(activeDoc.id, { editorMode: newMode }).catch(() => {});
    }
  }, [editorMode, activeDoc?.id]);

  // ── Word count ───────────────────────────────────────────────────
  const wordCount = editorMode === 'md'
    ? mdContent.split(/\s+/).filter(Boolean).length
    : (editor?.getText().split(/\s+/).filter(Boolean).length ?? 0);

  // ── Refs for sidebar ─────────────────────────────────────────────
  const refs = [...allRefs]
    .sort((a, b) => (b.isFavorite === a.isFavorite ? 0 : b.isFavorite ? 1 : -1))
    .slice(0, 6)
    .map(r => ({
      title: `${r.authors?.split(',')[0] ?? 'Autor'} (${r.year})`,
      meta: `${r.venue} · ${r.type.replace('_', ' ')}`,
      read: r.isRead,
    }));

  if (!activeDoc) return null;

  // ── Markdown mode ─────────────────────────────────────────────────
  if (editorMode === 'md') {
    return (
      <div className={styles.page}>
        <EditorToolbar
          editor={null}
          doc={activeDoc}
          saveStatus={saveStatus}
          onBack={() => navigate('/bancada')}
          onSave={handleSave}
          onExportLatex={handleExportLatex}
          previewOpen={previewOpen}
          onTogglePreview={() => setPreviewOpen(p => !p)}
          editorMode={editorMode}
          onModeToggle={handleModeToggle}
          wordCount={wordCount}
          mdMode
        />

        <div className={styles.body}>
          {/* Raw markdown textarea */}
          <div className={styles.mdEditorArea}>
            <textarea
              ref={mdTextareaRef}
              className={styles.mdTextarea}
              value={mdContent}
              onChange={e => {
                setMdContent(e.target.value);
                mdRef.current = e.target.value;
                setSaveStatus('editando...');
              }}
              placeholder={'# Título\n\nComece a escrever em Markdown...\n\n## Seção\n\nUse **negrito**, *itálico*, `código`, tabelas e muito mais.'}
              spellCheck={false}
            />
          </div>

          {/* Live markdown preview */}
          <MarkdownPreview
            content={mdContent}
            docTitle={activeDoc.title}
          />
        </div>
      </div>
    );
  }

  // ── LaTeX/WYSIWYG mode ────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <EditorToolbar
        editor={editor}
        doc={activeDoc}
        saveStatus={saveStatus}
        onBack={() => navigate('/bancada')}
        onSave={handleSave}
        onExportLatex={handleExportLatex}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen(p => !p)}
        editorMode={editorMode}
        onModeToggle={handleModeToggle}
        wordCount={wordCount}
      />

      <div className={styles.body}>
        <div className={styles.editorArea}>
          <EditorContent editor={editor} />
        </div>

        {previewOpen ? (
          <TemplatePreview
            json={editorJson ?? editor?.getJSON() ?? null}
            template={activeDoc?.template || 'free'}
            docTitle={activeDoc?.title || ''}
            author="Sabino, S.S."
          />
        ) : (
          <RefsSidebar refs={refs} aiSuggestions={aiSuggestions} />
        )}
      </div>
    </div>
  );
}