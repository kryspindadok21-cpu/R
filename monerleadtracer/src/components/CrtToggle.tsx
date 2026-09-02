'use client';

import { useEffect, useState } from 'react';

/** Przełącznik efektów CRT. Stan trzymany lokalnie w przeglądarce. */
export function CrtToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(!document.documentElement.classList.contains('crt-off'));
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle('crt-off', !next);
    try {
      localStorage.setItem('mlt_crt', next ? 'on' : 'off');
    } catch {
      // Tryb prywatny albo zablokowane dane witryny — trudno, przełącznik działa do odświeżenia.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-muted hover:text-phosphor transition-colors"
      aria-pressed={on}
    >
      [CRT: {on ? 'ON' : 'OFF'}]
    </button>
  );
}
