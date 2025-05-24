/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: false, // Temporarily disabled for diagnostics
  // External packages for server components
  // serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'], // Removed
  experimental: {
    // Add any experimental features here
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
  },
  // Configure webpack to handle Node.js modules and optimize builds
  webpack: (config, { isServer, dev }) => {
    // Only add these configurations for server-side bundles
    if (isServer) {
      // Exclude puppeteer and chromium from bundling in production
      // config.externals = [...(config.externals || []), { // Original line
      //   'puppeteer-core': 'commonjs puppeteer-core', // Removed
      //   '@sparticuz/chromium': 'commonjs @sparticuz/chromium' // Removed
      // }]; // Original line
      
      // If config.externals might be undefined or empty initially, 
      // and these were the only entries, ensure it remains an empty array or is handled appropriately.
      // For now, assuming config.externals might have other entries or can be empty.
      // If it was specific to these, the following is safer:
      const existingExternals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = existingExternals.filter(
        (ext) => typeof ext !== 'object' || (!ext.hasOwnProperty('puppeteer-core') && !ext.hasOwnProperty('@sparticuz/chromium'))
      );
      // If the externals were added as an object like { 'puppeteer-core': ..., '@sparticuz/chromium': ... },
      // and that object was pushed to an array, the above filter might need adjustment
      // or the specific object needs to be removed.
      // Given the original code `...config.externals || [], { ... }` it suggests they were added as a single new object.
      // A more direct removal if the original structure was `config.externals = [{...}, 'other-ext']`
      // might be to filter out the object containing these specific keys.
      // However, the provided example `config.externals = [...(config.externals || []), { NEW_ENTRIES }]`
      // means the new entries were added as a single object in the array.
      // So, we need to filter out that specific object.
      // This is complex without knowing the exact structure of config.externals BEFORE this modification.
      // The safest approach based on the provided code is to assume it was an array of objects or strings.
      // The provided example `config.externals = [...(config.externals || []), { /* these entries */ }]` means
      // an object `{ 'puppeteer-core': '...', '@sparticuz/chromium': '...' }` was added to the array.
      // We need to filter out this object.
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.filter(external => {
          if (typeof external === 'object' && external !== null) {
            return !('puppeteer-core' in external && '@sparticuz/chromium' in external);
          }
          return true;
        });
      }


      // Add Node.js polyfills
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        dns: false,
        http2: false,
        module: false,
        dgram: false,
      };
    }

    // Exclude .map files from production builds
    if (!dev) {
      config.module.rules.push({
        test: /\.map$/, 
        use: 'ignore-loader'
      });
    }
    
    // Add path aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'oviiqouhtdajfwhpwbyq.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/media/**',
      },
    ],
  },

  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        source: '/dashboard/:path*',
        destination: '/api/dashboard/:path*',
      },
    ]
  },
  // For TypeScript path aliases
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
