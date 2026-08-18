import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Renders a PDF's pages onto plain <canvas> elements ourselves, instead of handing the
// bytes to the browser's built-in PDF viewer via an <iframe>/<embed> — that viewer comes
// with its own toolbar/sidebar/zoom chrome that can't be suppressed consistently across
// browsers (Chrome/Edge honor "#toolbar=0", Firefox's PDF.js does not), which is more UI
// than "just show the payslip" calls for.
export default function PayslipViewer({ bytes }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const canvases = [];

    async function render() {
      setError(null);
      try {
        // pdf.js detaches/transfers the buffer it's given, so hand it a fresh copy —
        // the caller's `bytes` is reused across "Download"/"Print" as well.
        const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        if (cancelled) return;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = pageNum < pdf.numPages ? '12px' : '0';
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          if (cancelled) return;
          containerRef.current?.appendChild(canvas);
          canvases.push(canvas);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not render the payslip.');
      }
    }
    render();

    return () => {
      cancelled = true;
      canvases.forEach(c => c.remove());
    };
  }, [bytes]);

  if (error) return <p className="text-[13px]" style={{ color: 'var(--red)' }}>{error}</p>;
  return <div ref={containerRef} style={{ width: '100%' }} />;
}
