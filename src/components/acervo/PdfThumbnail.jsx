import { useState, useEffect, useRef } from 'react';
import { getReferenceFileUrl } from '../../lib/storage';
import { loadPdf } from '../../lib/pdfEngine';

const cache = new Map(); // filePath → dataURL

export function PdfThumbnail({ filePath, width = 80, height = 110, style = {} }) {
  const canvasRef = useRef(null);
  const [src, setSrc] = useState(cache.get(filePath) || null);
  const [loading, setLoading] = useState(!src);

  useEffect(() => {
    if (!filePath || src) return;
    let cancelled = false;

    (async () => {
      try {
        const url = await getReferenceFileUrl(filePath);
        if (!url || cancelled) return;
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const pdf = await loadPdf(buf);
        const page = await pdf.getPage(1);

        const scale = width / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: Math.min(scale, 1.5) });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        if (!cancelled) {
          cache.set(filePath, dataUrl);
          setSrc(dataUrl);
        }
      } catch (err) {
        console.warn('PdfThumbnail error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [filePath, width]);

  if (!filePath) return null;

  return (
    <div style={{
      width, height, flexShrink: 0, overflow: 'hidden',
      background: 'var(--bg3)', borderRadius: 3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      {src ? (
        <img src={src} alt="" style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top',
        }} />
      ) : loading ? (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--tx3)',
          opacity: 0.5, textAlign: 'center',
        }}>
          ...
        </div>
      ) : (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tx3)',
          opacity: 0.4, textTransform: 'uppercase',
        }}>
          PDF
        </div>
      )}
    </div>
  );
}