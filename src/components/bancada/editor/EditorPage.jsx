import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReferences, useAiSuggestions } from '../../../hooks/useData';
import { DocumentRepo } from '../../../services/repositories';
import { convertToLatex } from '../../../services/tiptap-to-latex';
import { EditorToolbar } from './EditorToolbar';
import { RefsSidebar } from './RefsSidebar';
import styles from './EditorPage.module.css';

export function EditorPage({ profileId }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const docId = searchParams.get('doc');
  const allRefs = useReferences(profileId) ?? [];
  const aiSuggestions = useAiSuggestions(docId || null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [saveStatus, setSaveStatus] = useState('salvo âœ“');

  // Load doc
  useEffect(() => {
    if (docId) {
      DocumentRepo.getById(docId).then(doc => {
        if (doc) setActiveDoc(doc);
        else navigate('/bancada');
      });
    } else {
      navigate('/bancada');
    }
  }, [docId, navigate]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Comece a escrever...' }),
    ],
    content: activeDoc?.content || '',
    onUpdate: () => setSaveStatus('editando...'),
    editorProps: {
      attributes: { class: styles.proseMirror },
    },
  }, [activeDoc?.id]);

  // Auto-save every 3s (saves JSON)
  useEffect(() => {
    if (!editor || !activeDoc?.id) return;
    const interval = setInterval(async () => {
      const json = editor.getJSON();
      const currentJson = JSON.stringify(json);
      const savedJson = JSON.stringify(activeDoc.content);

      if (currentJson !== savedJson) {
        try {
          const wc = editor.getText().split(/\s+/).filter(Boolean).length;
          await DocumentRepo.update(activeDoc.id, { content: json, wordCount: wc });
          setSaveStatus('salvo âœ“');
          setActiveDoc(prev => prev ? { ...prev, content: json } : null);
        } catch (err) {
          console.error('auto-save falhou:', err);
          setSaveStatus('erro ao salvar');
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [editor, activeDoc?.id]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (!editor || !activeDoc?.id) return;
    try {
      const json = editor.getJSON();
      const wc = editor.getText().split(/\s+/).filter(Boolean).length;
      await DocumentRepo.update(activeDoc.id, { content: json, wordCount: wc });
      setSaveStatus('salvo âœ“');
      setActiveDoc(prev => prev ? { ...prev, content: json } : null);
    } catch (err) {
      console.error('salvar falhou:', err);
      setSaveStatus('erro ao salvar');
    }
  }, [editor, activeDoc]);

  // Export LaTeX
  const handleExportLatex = useCallback(() => {
    if (!editor || !activeDoc) return;
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
  }, [editor, activeDoc]);

  if (!activeDoc) return null;

  // Refs recentes do Acervo (reais — nunca fixas). Sem link direto doc↔referência
  // no schema ainda, então usamos as mais relevantes (favoritas/lidas recentemente)
  // como proxy até existir vínculo por documento.
  const refs = [...allRefs]
    .sort((a, b) => (b.isFavorite === a.isFavorite ? 0 : b.isFavorite ? 1 : -1))
    .slice(0, 6)
    .map(r => ({
      title: `${r.authors?.split(',')[0] ?? 'Autor'} (${r.year})`,
      meta: `${r.venue} Â· ${r.type.replace('_', ' ')}`,
      read: r.isRead,
    }));

  return (
    <div className={styles.page}>
      <EditorToolbar
        editor={editor}
        doc={activeDoc}
        saveStatus={saveStatus}
        onBack={() => navigate('/bancada')}
        onSave={handleSave}
        onExportLatex={handleExportLatex}
      />

      <div className={styles.body}>
        <div className={styles.editorArea}>
          <EditorContent editor={editor} />
        </div>

        <RefsSidebar refs={refs} aiSuggestions={aiSuggestions} />
      </div>
    </div>
  );
}

// â”€â”€ Helpers â”€â”€

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
