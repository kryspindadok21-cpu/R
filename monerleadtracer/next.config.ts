import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 to moduł natywny — nie wolno go bundlować.
  serverExternalPackages: ['better-sqlite3'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
