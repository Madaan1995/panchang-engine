import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for the Docker image.
  output: 'standalone',
  // pg uses optional native bindings; keep it as a runtime require.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
