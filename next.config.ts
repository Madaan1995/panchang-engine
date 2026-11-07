import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg uses optional native bindings; keep it as a runtime require.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
