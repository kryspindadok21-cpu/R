import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MonerLeadTracer',
  description: 'Namierzanie lokalnych firm bez strony WWW + generator spersonalizowanego copy',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#05070a',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Ustawia klasę CRT zanim przeglądarka cokolwiek namaluje.
 * Bez tego przy wyłączonym CRT mignęłyby scanlines na jedną klatkę.
 */
const CRT_BOOTSTRAP = `
(function () {
  try {
    var off = localStorage.getItem('mlt_crt') === 'off';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (off || reduced) document.documentElement.classList.add('crt-off');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: CRT_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        {children}
        <div className="crt-scanlines" aria-hidden="true" />
        <div className="crt-flicker" aria-hidden="true" />
        <div className="crt-vignette" aria-hidden="true" />
      </body>
    </html>
  );
}
