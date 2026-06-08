import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This project lives in a subdirectory of a repo that also contains a Vite
  // app (with its own lockfile). Pin the tracing root so Next bundles the
  // serverless functions from THIS directory, not the parent.
  outputFileTracingRoot: here,
};

export default nextConfig;
