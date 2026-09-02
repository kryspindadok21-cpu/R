'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AsciiLogo } from './AsciiLogo';

/** Ekran logowania. Jedyna strona dostępna bez sesji. */
export function LoginTerminal() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shake, setShake] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const next = params.get('next');
        // replace, żeby cofnięcie nie wracało na ekran logowania
        router.replace(next && next.startsWith('/') ? next : '/');
        router.refresh();
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        attemptsLeft?: number;
      };
      const left =
        typeof data.attemptsLeft === 'number' && data.attemptsLeft > 0
          ? ` — pozostało prób: ${data.attemptsLeft}`
          : '';
      setError(`${data.error ?? 'ACCESS DENIED'}${left}`);
      setShake(true);
      setTimeout(() => setShake(false), 320);
      setPassword('');
    } catch {
      setError('CONNECTION FAILED');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`w-full max-w-lg ${shake ? 'glitch-hover' : ''}`}>
      <AsciiLogo className="mb-6" />

      <div className="panel p-5">
        <p className="text-phosphor-dim mb-1">
          <span className="text-muted">$</span> auth --require-code
        </p>
        <p className="text-muted mb-5 text-[11px]">
          Dostęp wyłącznie dla właściciela. Wszystko za tą bramką to prywatne dane sprzedażowe.
        </p>

        <form onSubmit={submit}>
          <label htmlFor="code" className="block mb-2 glow">
            ACCESS CODE:
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="term-input flex-1"
              placeholder="••••••••••••"
              disabled={pending}
            />
            <button type="submit" className="term-btn" disabled={pending || !password}>
              {pending ? '...' : 'ENTER'}
            </button>
          </div>
        </form>

        <div className="mt-4 min-h-[1.25rem]">
          {error ? (
            <p className="text-danger glow-red" role="alert">
              &gt; {error}
              <span className="blink">█</span>
            </p>
          ) : (
            <p className="text-muted">
              &gt; awaiting input<span className="blink">█</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
