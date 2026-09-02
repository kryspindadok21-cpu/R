import { Suspense } from 'react';
import { LoginTerminal } from '@/components/LoginTerminal';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <LoginTerminal />
      </Suspense>
    </main>
  );
}
