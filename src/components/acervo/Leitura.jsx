import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  BookOpen, Upload, ArrowLeft, CaretLeft, CaretRight, Check,
  DownloadSimple, Eye, Trash, Target, Lightning, X,
  FilePdf, PencilSimple, Highlighter, Eraser,
  Palette, FloppyDisk, Note, Spinner, PlayCircle,
} from '@phosphor-icons/react';
import { selectProfile } from '../../store/slices/authSlice';
import {
  ReadingBookRepo, ReadingChapterRepo, ReadingProgressRepo, ReadingAnnotationRepo,
} from '../../services/repositories-leitura';
import { uploadReadingFile, deleteReadingFile, getReadingFileUrl } from '../../lib/readingStorage';
import {
  loadPdf, extractOutline, extractTextFromPages, renderPage, extractChapterPdf,
} from '../../lib/pdfEngine';
import {
  scorePriority, getPriorityLevel, getPriorityLabel, getPriorityColorVar,
} from '../../lib/leituraUtils';

const VIEW = { HOME: 'home', CHAPTERS: 'chapters', READER: 'reader' };

// ─────────────────────────────────────────────
// Hook: livros do leitor (Supabase)
// ─────────────────────────────────────────────
function useReadingBooks(profileId) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const data = await ReadingBookRepo.getAll(profileId);
      if (data) {
        setBooks(data.map(b => ({
          ...b,
          chapters: (b.readingChapters || []).sort((a, c) => a.position - c.position),
          progress: b.readingProgress?.[0] || null,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  return { books, loading, reload: load };
}

// ─────────────────────────────────────────────
// Leitura — componente raiz
// ─────────────────────────────────────────────
export function Leitura({ profileId, directRef, acervoRefs, onClearDirectRef, onReadRef }) {
  const profile = useSelector(selectProfile);
  const { books, loading, reload } = useReadingBooks(profileId);

  const [view, setView] = useState(VIEW.HOME);
  const [activeBookId, setActiveBookId] = useState(null);
  const [readerChapter, setReaderChapter] = useState(null);
  const [pdfCache, setPdfCache] = useState({}); // bookId -> { arrayBuffer, pdfDoc }
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState('');

  // ── Leitura direta (Caminho A — sem reading_books) ──
  const [directBook, setDirectBook] = useState(null); // { id, title, chapters, totalPages, ... }
  const [directPdfDoc, setDirectPdfDoc] = useState(null);
  const [directArrayBuffer, setDirectArrayBuffer] = useState(null);

  const keywords = profile?.keywords || [];
  const activeBook = directBook || books.find(b => b.id === activeBookId);

  // PDFs do acervo que podem ser lidos diretamente
  const acervoPdfs = useMemo(() =>
    (acervoRefs || []).filter(r => r.filePath && r.fileName?.toLowerCase().endsWith('.pdf')),
    [acervoRefs]
  );

  // ── Handle directRef (vindo do botão "Ler" no card de referência) ──
  useEffect(() => {
    if (!directRef?.filePath) return;
    let cancelled = false;
    (async () => {
      setProcessing(true);
      try {
        const { getReferenceFileUrl } = await import('../../lib/storage');
        const url = await getReferenceFileUrl(directRef.filePath);
        if (!url || cancelled) return;
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const pdfDoc = await loadPdf(arrayBuffer.slice(0));

        let chapters = await extractOutline(pdfDoc);
        const hasBookmarks = !!(chapters && chapters.length > 0);
        if (!hasBookmarks) {
          const total = pdfDoc.numPages;
          const chunkSize = 30;
          chapters = [];
          for (let i = 1; i <= total; i += chunkSize) {
            const end = Math.min(i + chunkSize - 1, total);
            chapters.push({ title: `Seção ${chapters.length + 1} (p. ${i}–${end})`, startPage: i, endPage: end });
          }
        }

        const scoredChapters = [];
        for (const ch of chapters) {
          const text = await extractTextFromPages(pdfDoc, ch.startPage, Math.min(ch.startPage + 4, ch.endPage));
          const { score, matches } = scorePriority(text, keywords);
          scoredChapters.push({
            id: `direct-${ch.startPage}`,
            title: ch.title, startPage: ch.startPage, endPage: ch.endPage,
            pageCount: ch.endPage - ch.startPage + 1,
            score, priority: getPriorityLevel(score),
            topKeywords: matches.sort((a, b) => b.count - a.count).slice(0, 5).map(m => m.keyword),
            done: false,
          });
        }

        if (cancelled) return;
        setDirectPdfDoc(pdfDoc);
        setDirectArrayBuffer(arrayBuffer);
        setDirectBook({
          id: `direct-${directRef.id}`,
          title: directRef.title || directRef.fileName?.replace(/\.pdf$/i, '') || 'PDF',
          chapters: scoredChapters,
          totalPages: pdfDoc.numPages,
          hasBookmarks,
          progress: null,
        });
        setView(VIEW.CHAPTERS);
      } catch (err) {
        console.error('Erro ao abrir PDF do acervo:', err);
        showToast('Erro ao abrir o PDF.');
      } finally {
        if (!cancelled) setProcessing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [directRef]);

  const totalChapters = books.reduce((s, b) => s + (b.chapters?.length || 0), 0);
  const doneChapters = books.reduce((s, b) => s + (b.chapters?.filter(c => c.done).length || 0), 0);
  const priorityChapters = books.reduce((s, b) => s + (b.chapters?.filter(c => c.priority === 'high').length || 0), 0);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ── Upload → parse → score → persiste no Supabase ──
  const handleUpload = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
    setProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await loadPdf(arrayBuffer.slice(0));

      let chapters = await extractOutline(pdfDoc);
      const hasBookmarks = !!(chapters && chapters.length > 0);

      if (!hasBookmarks) {
        const total = pdfDoc.numPages;
        const chunkSize = 30;
        chapters = [];
        for (let i = 1; i <= total; i += chunkSize) {
          const end = Math.min(i + chunkSize - 1, total);
          chapters.push({
            title: `Seção ${chapters.length + 1} (p. ${i}–${end})`,
            startPage: i,
            endPage: end,
          });
        }
      }

      const scoredChapters = [];
      for (const ch of chapters) {
        const text = await extractTextFromPages(pdfDoc, ch.startPage, Math.min(ch.startPage + 4, ch.endPage));
        const { score, matches } = scorePriority(text, keywords);
        scoredChapters.push({
          title: ch.title,
          startPage: ch.startPage,
          endPage: ch.endPage,
          pageCount: ch.endPage - ch.startPage + 1,
          score,
          priority: getPriorityLevel(score),
          topKeywords: matches.sort((a, b) => b.count - a.count).slice(0, 5).map(m => m.keyword),
          done: false,
        });
      }

      // Upload do PDF pro storage do Supabase
      const { filePath, fileName, fileSize } = await uploadReadingFile(profileId, file);

      const bookId = await ReadingBookRepo.create({
        profileId,
        title: file.name.replace(/\.pdf$/i, ''),
        fileName,
        filePath,
        fileSize,
        totalPages: pdfDoc.numPages,
        hasBookmarks,
        chapterCount: scoredChapters.length,
      });
      if (!bookId) throw new Error('Falha ao criar livro');

      await ReadingChapterRepo.bulkCreate(bookId, scoredChapters);

      // Mantém o PDF já parseado em cache — evita re-download imediato
      setPdfCache(prev => ({ ...prev, [bookId]: { arrayBuffer, pdfDoc } }));

      await reload();
      setActiveBookId(bookId);
      setView(VIEW.CHAPTERS);
    } catch (err) {
      console.error('Erro ao processar PDF:', err);
      showToast('Erro ao processar o PDF. Verifique se o arquivo é válido.');
    } finally {
      setProcessing(false);
    }
  }, [profileId, keywords, reload]);

  // ── Garante o PDF em memória (cache local ou re-download via signed URL) ──
  const ensurePdfLoaded = useCallback(async (book) => {
    if (pdfCache[book.id]) return pdfCache[book.id];
    if (!book.filePath) { showToast('Este livro não tem arquivo associado.'); return null; }

    setLoadingPdf(true);
    try {
      const url = await getReadingFileUrl(book.filePath);
      if (!url) throw new Error('Não foi possível gerar link do arquivo');
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const pdfDoc = await loadPdf(arrayBuffer.slice(0));
      const cached = { arrayBuffer, pdfDoc };
      setPdfCache(prev => ({ ...prev, [book.id]: cached }));
      return cached;
    } catch (err) {
      console.error('Erro ao carregar PDF:', err);
      showToast('Erro ao carregar o PDF do servidor.');
      return null;
    } finally {
      setLoadingPdf(false);
    }
  }, [pdfCache]);

  const toggleChapter = async (chapterId) => {
    await ReadingChapterRepo.toggleDone(chapterId);
    await reload();
  };

  const cyclePriority = async (chapterId) => {
    await ReadingChapterRepo.cyclePriority(chapterId);
    await reload();
  };

  const deleteBook = async (book) => {
    if (!confirm('Remover este livro do leitor? As anotações também serão apagadas.')) return;
    await ReadingBookRepo.delete(book.id);
    if (book.filePath) await deleteReadingFile(book.filePath);
    setPdfCache(prev => { const n = { ...prev }; delete n[book.id]; return n; });
    if (activeBookId === book.id) { setActiveBookId(null); setView(VIEW.HOME); }
    await reload();
  };

  const openReader = async (book, chapter) => {
    const cached = await ensurePdfLoaded(book);
    if (!cached) return;
    setActiveBookId(book.id);
    setReaderChapter(chapter);
    setView(VIEW.READER);
  };

  // Retoma leitura no último capítulo/página salvos
  const resumeReading = async (book) => {
    const prog = book.progress;
    const chapter = prog?.chapterId
      ? book.chapters.find(c => c.id === prog.chapterId)
      : book.chapters[0];
    if (!chapter) return;
    await openReader(book, chapter);
  };

  const downloadChapter = async (book, chapter) => {
    const cached = await ensurePdfLoaded(book);
    if (!cached) return;
    try {
      const blob = await extractChapterPdf(cached.arrayBuffer, chapter.startPage, chapter.endPage);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = chapter.title.replace(/[^a-zA-Z0-9À-ú\s-]/g, '').trim().replace(/\s+/g, '-');
      a.download = `${book.title}_${safeName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar capítulo:', err);
      showToast('Erro ao exportar capítulo.');
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, margin: '15px 0', flexWrap: 'wrap' }}>
        <StatChip icon={<BookOpen size={14} />} value={`${doneChapters}/${totalChapters}`} label="capítulos lidos" />
        <StatChip icon={<Target size={14} />} value={priorityChapters} label="prioritários" />
        {loading && <Spinner size={14} className="animate-spin" style={{ color: 'var(--tx3)' }} />}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 200,
          background: 'var(--bg4)', border: '1px solid var(--brd2)', borderRadius: 'var(--r-md)',
          padding: '8px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx)',
        }}>{toast}</div>
      )}

      {view === VIEW.HOME && (
        <HomeView
          books={books}
          keywords={keywords}
          acervoPdfs={acervoPdfs}
          onUpload={handleUpload}
          onOpenBook={(book) => { setActiveBookId(book.id); setView(VIEW.CHAPTERS); }}
          onResumeBook={resumeReading}
          onDeleteBook={deleteBook}
          onReadRef={onReadRef}
          processing={processing}
        />
      )}

      {view === VIEW.CHAPTERS && activeBook && (
        <ChapterView
          book={activeBook}
          isDirect={!!directBook}
          onBack={() => {
            if (directBook) { setDirectBook(null); setDirectPdfDoc(null); setDirectArrayBuffer(null); onClearDirectRef?.(); }
            setView(VIEW.HOME); setActiveBookId(null);
          }}
          onToggle={directBook
            ? (chId) => setDirectBook(prev => ({
                ...prev,
                chapters: prev.chapters.map(c => c.id === chId ? { ...c, done: !c.done } : c),
              }))
            : toggleChapter
          }
          onRead={(ch) => {
            if (directBook) {
              setReaderChapter(ch);
              setView(VIEW.READER);
            } else {
              openReader(activeBook, ch);
            }
          }}
          onDownload={(ch) => {
            if (directBook && directArrayBuffer) {
              extractChapterPdf(directArrayBuffer, ch.startPage, ch.endPage).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `${activeBook.title}_${ch.title.replace(/[^a-zA-Z0-9À-ú\s-]/g, '').trim().replace(/\s+/g, '-')}.pdf`;
                a.click(); URL.revokeObjectURL(url);
              }).catch(() => showToast('Erro ao exportar capítulo.'));
            } else {
              downloadChapter(activeBook, ch);
            }
          }}
          onCyclePriority={directBook
            ? (chId) => {
                const order = ['high', 'medium', 'low', 'skip'];
                setDirectBook(prev => ({
                  ...prev,
                  chapters: prev.chapters.map(c => {
                    if (c.id !== chId) return c;
                    return { ...c, priority: order[(order.indexOf(c.priority) + 1) % order.length] };
                  }),
                }));
              }
            : cyclePriority
          }
          loadingPdf={loadingPdf}
        />
      )}

      {view === VIEW.READER && activeBook && readerChapter && (
        <ReaderView
          book={activeBook}
          chapter={readerChapter}
          pdfDoc={directBook ? directPdfDoc : pdfCache[activeBook.id]?.pdfDoc}
          initialPage={
            activeBook.progress?.chapterId === readerChapter.id
              ? activeBook.progress.currentPage
              : readerChapter.startPage
          }
          isDirect={!!directBook}
          onClose={async () => { setView(VIEW.CHAPTERS); if (!directBook) await reload(); }}
        />
      )}
    </div>
  );
}

function StatChip({ icon, value, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx2)',
    }}>
      {icon}
      <strong style={{ color: 'var(--tx)' }}>{value}</strong> {label}
    </div>
  );
}

// ═══════════════════════════════════════════
//  HOME VIEW
// ═══════════════════════════════════════════
function HomeView({ books, keywords, acervoPdfs, onUpload, onOpenBook, onResumeBook, onDeleteBook, onReadRef, processing }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, minHeight: 140, borderRadius: 'var(--r-xl)', cursor: 'pointer', textAlign: 'center',
          border: `1px dashed ${dragOver ? 'var(--acc)' : 'var(--brd2)'}`,
          background: dragOver ? 'var(--acc-bg)' : 'var(--bg2)', padding: 20,
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }} />
        {processing
          ? <Lightning size={32} weight="duotone" color="var(--acc)" />
          : <Upload size={32} weight="duotone" color="var(--tx3)" />
        }
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--tx)' }}>
          {processing ? 'Processando PDF...' : 'Adicionar livro à Leitura'}
        </h3>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--tx3)' }}>
          {processing
            ? 'Detectando capítulos e analisando relevância...'
            : 'Arraste um PDF ou clique para selecionar'}
        </p>
      </div>

      {keywords.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
            palavras-chave da sua pesquisa (config. em Configurações)
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {keywords.map(kw => (
              <span key={kw} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px',
                borderRadius: 3, border: '1px solid var(--brd2)', color: 'var(--tx2)',
              }}>{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Do acervo — referências com PDF ── */}
      {acervoPdfs?.length > 0 && (
        <>
          <div style={{ margin: '20px 0 10px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>
            Ler do acervo ({acervoPdfs.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {acervoPdfs.map(ref => (
              <button key={ref.id} onClick={() => onReadRef?.(ref)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <FilePdf size={20} weight="duotone" color="var(--acc)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--tx)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {ref.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                    {ref.authors ? `${ref.authors} · ` : ''}{ref.fileName}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {books.length > 0 ? (
        <>
          <div style={{ margin: '20px 0 10px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--tx2)' }}>
            Meus livros ({books.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {books.map(book => {
              const done = book.chapters?.filter(c => c.done).length || 0;
              const total = book.chapters?.length || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const highCount = book.chapters?.filter(c => c.priority === 'high').length || 0;
              return (
                <div key={book.id} onClick={() => onOpenBook(book)} style={{
                  display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
                  background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-lg)',
                  padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <FilePdf size={22} weight="duotone" color="var(--acc)" />
                    <div style={{ display: 'flex', gap: 4 }}>
                      {book.progress && (
                        <button onClick={(e) => { e.stopPropagation(); onResumeBook(book); }} title="Continuar leitura" style={iconBtnStyle}>
                          <PlayCircle size={14} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onDeleteBook(book); }} title="Remover" style={iconBtnStyle}>
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>
                      {book.title}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                      {book.totalPages} pgs · {total} capítulos{highCount > 0 && ` · ${highCount} prioritários`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--acc)' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tx3)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>Nenhum livro ainda. Faça upload de um PDF para começar.</p>
        </div>
      )}
    </>
  );
}

const iconBtnStyle = {
  padding: '3px 5px', borderRadius: 'var(--r-sm)',
  background: 'var(--bg3)', border: '1px solid var(--brd)',
  color: 'var(--tx3)', cursor: 'pointer', display: 'flex', alignItems: 'center',
};

// ═══════════════════════════════════════════
//  CHAPTER VIEW
// ═══════════════════════════════════════════
function ChapterView({ book, isDirect, onBack, onToggle, onRead, onDownload, onCyclePriority, loadingPdf }) {
  const done = book.chapters.filter(c => c.done).length;
  const total = book.chapters.length;
  const priorityOrder = { high: 0, medium: 1, low: 2, skip: 3 };
  const sorted = [...book.chapters].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '15px 0' }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: 'var(--tx3)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13,
        }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--tx)' }}>{book.title}</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
            {done}/{total} capítulos concluídos · {book.totalPages} páginas
            {!book.hasBookmarks && ' · Capítulos divididos automaticamente'}
          </div>
        </div>
        {loadingPdf && <Spinner size={16} className="animate-spin" style={{ color: 'var(--acc)' }} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(ch => (
          <div key={ch.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)',
            opacity: ch.done ? 0.6 : 1,
          }}>
            <div onClick={() => onToggle(ch.id)} style={{
              width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${ch.done ? 'var(--green)' : 'var(--brd2)'}`,
              background: ch.done ? 'var(--green-bg)' : 'transparent', flexShrink: 0,
            }}>
              {ch.done && <Check size={12} weight="bold" color="var(--green)" />}
            </div>

            <div onClick={() => onRead(ch)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--tx)' }}>{ch.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx3)' }}>
                p. {ch.startPage}–{ch.endPage} · {ch.pageCount} pgs
                {ch.topKeywords?.length > 0 && (
                  <> · <span style={{ color: 'var(--acc)' }}>{ch.topKeywords.slice(0, 3).join(', ')}</span></>
                )}
              </div>
            </div>

            <span onClick={() => onCyclePriority(ch.id)} title="Clique para mudar prioridade" style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
              border: `1px solid ${getPriorityColorVar(ch.priority)}`, color: getPriorityColorVar(ch.priority),
            }}>
              {getPriorityLabel(ch.priority)}
            </span>

            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onRead(ch)} title="Ler" style={iconBtnStyle}><Eye size={14} /></button>
              <button onClick={() => onDownload(ch)} title="Baixar capítulo" style={iconBtnStyle}><DownloadSimple size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
//  READER VIEW (com anotações — caneta, marcador, notas)
// ═══════════════════════════════════════════
const TOOLS = { NONE: 'none', PEN: 'pen', HIGHLIGHT: 'highlight', NOTE: 'note', ERASER: 'eraser' };
const COLORS = ['#c43644', '#f0ad4e', '#2ecc71', '#5b9bd5', '#e2e2ea'];

function ReaderView({ book, chapter, pdfDoc, initialPage, onClose, isDirect = false }) {
  const pdfCanvasRef = useRef(null);
  const annoCanvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(initialPage || chapter.startPage);
  const [rendering, setRendering] = useState(false);
  const [tool, setTool] = useState(TOOLS.NONE);
  const [color, setColor] = useState(COLORS[0]);
  const [showColors, setShowColors] = useState(false);
  const [pageAnno, setPageAnno] = useState({ strokes: [], notes: [], highlights: [] });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [noteInput, setNoteInput] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [saved, setSaved] = useState(false);
  const [loadingAnno, setLoadingAnno] = useState(false);

  // Carrega anotações da página (Supabase) — pula em leitura direta
  useEffect(() => {
    if (isDirect) {
      setPageAnno({ strokes: [], notes: [], highlights: [] });
      setLoadingAnno(false);
      return;
    }
    let cancelled = false;
    setLoadingAnno(true);
    ReadingAnnotationRepo.getPage(book.id, currentPage).then(anno => {
      if (cancelled) return;
      setPageAnno(anno ? {
        strokes: anno.strokes || [], notes: anno.notes || [], highlights: anno.highlights || [],
      } : { strokes: [], notes: [], highlights: [] });
      setLoadingAnno(false);
    });
    return () => { cancelled = true; };
  }, [book.id, currentPage, isDirect]);

  // Render da página do PDF
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    let cancelled = false;
    setRendering(true);
    renderPage(pdfDoc, currentPage, pdfCanvasRef.current, 1.8)
      .then(({ width, height }) => { if (!cancelled) { setCanvasSize({ w: width, h: height }); setRendering(false); } })
      .catch(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    if (!annoCanvasRef.current || !canvasSize.w) return;
    annoCanvasRef.current.width = canvasSize.w;
    annoCanvasRef.current.height = canvasSize.h;
    redrawAnnotations();
  }, [canvasSize, pageAnno]);

  const redrawAnnotations = useCallback(() => {
    const canvas = annoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const hl of pageAnno.highlights) {
      ctx.fillStyle = hl.color + '44';
      ctx.fillRect(hl.x, hl.y, hl.w, hl.h);
    }

    for (const stroke of pageAnno.strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.type === 'highlight' ? 16 : 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = stroke.type === 'highlight' ? 0.35 : 1;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const note of pageAnno.notes) {
      ctx.fillStyle = note.color || COLORS[0];
      ctx.beginPath();
      ctx.arc(note.x, note.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', note.x, note.y);
    }
  }, [pageAnno]);

  const getPos = (e) => {
    const canvas = annoCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e) => {
    if (tool === TOOLS.NONE) return;
    if (tool === TOOLS.NOTE) {
      const pos = getPos(e);
      setNoteInput(pos);
      setNoteText('');
      return;
    }
    if (tool === TOOLS.ERASER) {
      const pos = getPos(e);
      setPageAnno(prev => ({
        ...prev,
        strokes: prev.strokes.filter(s => !s.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 20)),
        notes: prev.notes.filter(n => Math.hypot(n.x - pos.x, n.y - pos.y) > 15),
      }));
      return;
    }
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStroke({ type: tool === TOOLS.HIGHLIGHT ? 'highlight' : 'pen', color, points: [pos] });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentStroke(prev => ({ ...prev, points: [...prev.points, pos] }));

    const canvas = annoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pts = [...currentStroke.points, pos];
    if (pts.length < 2) return;
    ctx.strokeStyle = currentStroke.color;
    ctx.lineWidth = currentStroke.type === 'highlight' ? 16 : 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = currentStroke.type === 'highlight' ? 0.35 : 1;
    ctx.beginPath();
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    if (currentStroke.points.length > 1) {
      setPageAnno(prev => ({ ...prev, strokes: [...prev.strokes, currentStroke] }));
    }
    setCurrentStroke(null);
  };

  const addNote = () => {
    if (!noteInput || !noteText.trim()) { setNoteInput(null); return; }
    setPageAnno(prev => ({ ...prev, notes: [...prev.notes, { x: noteInput.x, y: noteInput.y, text: noteText.trim(), color }] }));
    setNoteInput(null);
    setNoteText('');
  };

  const persist = useCallback(async (page, anno) => {
    if (isDirect) return; // leitura direta — anotações só em memória
    await ReadingAnnotationRepo.savePage(book.id, page, anno);
    await ReadingProgressRepo.save(book.id, { chapterId: chapter.id, currentPage: page });
  }, [book.id, chapter.id, isDirect]);

  const handleSave = () => {
    persist(currentPage, pageAnno);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const changePage = (newPage) => {
    persist(currentPage, pageAnno); // salva a página que está saindo
    setCurrentPage(newPage);
  };

  const handleClose = async () => {
    await persist(currentPage, pageAnno);
    onClose();
  };

  const isFirst = currentPage <= chapter.startPage;
  const isLast = currentPage >= chapter.endPage;
  const activeTool = (t) => tool === t
    ? { ...iconBtnStyle, borderColor: 'var(--acc)', color: 'var(--acc)' }
    : iconBtnStyle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', flexWrap: 'wrap' }}>
        <button onClick={handleClose} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          color: 'var(--tx3)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13,
        }}>
          <X size={16} /> Fechar
        </button>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--tx)', flex: 1 }}>
          {chapter.title}
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button style={activeTool(TOOLS.PEN)} title="Caneta" onClick={() => setTool(tool === TOOLS.PEN ? TOOLS.NONE : TOOLS.PEN)}><PencilSimple size={15} /></button>
          <button style={activeTool(TOOLS.HIGHLIGHT)} title="Marcador" onClick={() => setTool(tool === TOOLS.HIGHLIGHT ? TOOLS.NONE : TOOLS.HIGHLIGHT)}><Highlighter size={15} /></button>
          <button style={activeTool(TOOLS.NOTE)} title="Nota" onClick={() => setTool(tool === TOOLS.NOTE ? TOOLS.NONE : TOOLS.NOTE)}><Note size={15} /></button>
          <button style={activeTool(TOOLS.ERASER)} title="Apagar" onClick={() => setTool(tool === TOOLS.ERASER ? TOOLS.NONE : TOOLS.ERASER)}><Eraser size={15} /></button>
          <div style={{ position: 'relative' }}>
            <button style={{ ...iconBtnStyle, background: color + '33', borderColor: color }} title="Cor" onClick={() => setShowColors(!showColors)}>
              <Palette size={15} style={{ color }} />
            </button>
            {showColors && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, display: 'flex', gap: 4, padding: 6,
                background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: 'var(--r-md)', zIndex: 10,
              }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => { setColor(c); setShowColors(false); }} style={{
                    width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: c === color ? '2px solid var(--tx)' : '2px solid transparent',
                  }} />
                ))}
              </div>
            )}
          </div>
          <button style={saved ? { ...iconBtnStyle, borderColor: 'var(--green)', color: 'var(--green)' } : iconBtnStyle}
            title="Salvar anotações" onClick={handleSave}>
            {saved ? <Check size={15} /> : <FloppyDisk size={15} />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx3)' }}>
          <button disabled={isFirst} onClick={() => changePage(currentPage - 1)} style={{ ...iconBtnStyle, opacity: isFirst ? 0.4 : 1 }}><CaretLeft size={14} /></button>
          <span>{currentPage} / {chapter.endPage}</span>
          <button disabled={isLast} onClick={() => changePage(currentPage + 1)} style={{ ...iconBtnStyle, opacity: isLast ? 0.4 : 1 }}><CaretRight size={14} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden' }}>
        <div ref={wrapRef} style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', background: 'var(--bg1)', borderRadius: 'var(--r-lg)', padding: 16 }}>
          <div style={{ position: 'relative', display: 'inline-block', height: 'fit-content' }}>
            <canvas ref={pdfCanvasRef} style={{ opacity: rendering ? 0.5 : 1, display: 'block' }} />
            <canvas
              ref={annoCanvasRef}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                cursor: tool === TOOLS.PEN ? 'crosshair'
                  : tool === TOOLS.HIGHLIGHT ? 'text'
                  : tool === TOOLS.NOTE ? 'cell'
                  : tool === TOOLS.ERASER ? 'not-allowed'
                  : 'default',
                touchAction: 'none',
              }}
              onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
            />
            {noteInput && (
              <div style={{
                position: 'absolute',
                left: Math.min(noteInput.x / (canvasSize.w || 1) * 100, 70) + '%',
                top: noteInput.y / (canvasSize.h || 1) * 100 + '%',
                background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: 'var(--r-md)', padding: 8, width: 200, zIndex: 10,
              }}>
                <textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Escreva sua nota..." rows={3}
                  style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 4, color: 'var(--tx)', fontFamily: 'var(--font-body)', fontSize: 12, padding: 6, resize: 'none' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={addNote} style={{ ...iconBtnStyle, color: 'var(--acc)', flex: 1 }}>Salvar</button>
                  <button onClick={() => setNoteInput(null)} style={{ ...iconBtnStyle, flex: 1 }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {pageAnno.notes.length > 0 && (
          <div style={{ width: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pageAnno.notes.map((note, i) => (
              <div key={i} style={{
                background: 'var(--bg2)', borderLeft: `3px solid ${note.color}`, borderRadius: 4, padding: 8,
                fontSize: 12, color: 'var(--tx2)', position: 'relative',
              }}>
                <p style={{ paddingRight: 14 }}>{note.text}</p>
                <button onClick={() => setPageAnno(prev => ({ ...prev, notes: prev.notes.filter((_, idx) => idx !== i) }))}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}