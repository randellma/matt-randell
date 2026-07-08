import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * PDF rendering via pdf.js, drawn in-app because mobile browsers can't be
 * trusted with PDF URLs: iOS shows a static first page (or a download sheet)
 * instead of a pageable viewer. The library and its worker are a meaty chunk,
 * so they're imported lazily the first time a PDF receipt actually needs
 * drawing — photo-only groups never pay for it.
 */
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

/**
 * One parse per URL: the chip's thumb and the lightbox both want the same
 * document, and each getDocument spins up its own worker + fetch otherwise.
 * Failed loads aren't cached, so closing and reopening retries.
 */
const docCache = new Map<string, Promise<import('pdfjs-dist').PDFDocumentProxy>>();
function loadDoc(url: string) {
  let doc = docCache.get(url);
  if (!doc) {
    doc = loadPdfjs().then(pdfjs => pdfjs.getDocument({ url }).promise);
    doc.catch(() => docCache.delete(url));
    docCache.set(url, doc);
  }
  return doc;
}

/** Crispness cap: retina is plenty, and huge canvases hurt on old phones. */
const MAX_DPR = 2;

/**
 * First page of a PDF as a small canvas, for the attached-receipt chip.
 * Shows `fallback` (an icon) until drawn, or forever if drawing fails.
 */
export function PdfThumb({ url, height, fallback }: {
  url: string;
  height: number;
  fallback: ComponentChildren;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await loadDoc(url);
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const viewport = page.getViewport({ scale: (height / base.height) * dpr });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // 'print' renders without requestAnimationFrame, so it can't stall
        // when the tab is hidden; we draw static snapshots, so nothing that
        // distinguishes the display intent (text/annotation layers) is lost.
        await page.render({ canvas, viewport, intent: 'print' }).promise;
        if (!cancelled) setReady(true);
      } catch {
        // keep the fallback icon
      }
    })();
    return () => { cancelled = true; };
  }, [url, height]);

  return (
    <>
      {!ready && fallback}
      <canvas ref={canvasRef} style={{ display: ready ? 'block' : 'none' }} />
    </>
  );
}

/** Every page of a PDF, stacked vertically at container width. */
export function PdfPages({ url }: { url: string }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await loadDoc(url);
        const holder = holderRef.current;
        if (cancelled || !holder) return;
        const width = holder.clientWidth || Math.min(window.innerWidth - 40, 720);
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          holder.appendChild(canvas);
          try {
            // 'print' intent: no requestAnimationFrame, see PdfThumb
            await page.render({ canvas, viewport, intent: 'print' }).promise;
          } catch (e) {
            canvas.remove();
            throw e;
          }
          if (cancelled) return;
        }
        if (!cancelled) setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div class="pdf-pages">
      {/* canvases are appended imperatively; keep them out of Preact's children */}
      <div ref={holderRef} class="pdf-pages-stack" />
      {state === 'loading' && (
        <div class="scan-status pdf-status"><div class="spinner" /> Loading PDF…</div>
      )}
      {state === 'error' && (
        <p class="hint warn pdf-status">Couldn't display this PDF here — use ↗ to open it.</p>
      )}
    </div>
  );
}
