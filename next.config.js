/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: false,
  // Only include puppeteer-core in serverExternalPackages
  serverExternalPackages: ['puppeteer-core'],
  
  // Only include outputFileTracingIncludes in production
  ...(process.env.NODE_ENV === 'production' && {
    outputFileTracingIncludes: {
      '/api/eli5-engine/*': [
        // Only include the necessary files from @sparticuz/chromium
        './node_modules/@sparticuz/chromium/bin/**',
        './node_modules/@sparticuz/chromium/lib/**',
        './node_modules/@sparticuz/chromium/package.json'
      ]
    }
  }),

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    },
    // Enable server components external packages
    serverComponentsExternalPackages: ['@sparticuz/chromium']
  },
  // Configure webpack to handle Node.js modules and optimize builds
  webpack: (config, { isServer, dev }) => {
    // Only add these configurations for server-side bundles
    if (isServer) {
      // Exclude puppeteer and chromium from bundling in production
      config.externals = [...(config.externals || []), {
        'puppeteer-core': 'commonjs puppeteer-core'
      }];
      
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
