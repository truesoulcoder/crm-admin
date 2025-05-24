/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: false,
  
  // Enable server components external packages
  serverExternalPackages: ['@sparticuz/chromium-min'],
  
  // Configure output file tracing for serverless functions
  output: 'standalone',
  
  // Configure page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Configure images
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  
  // Environment variables
  env: {
    // Ensure Chromium is downloaded during build
    CHROME_PATH: process.env.CHROME_PATH || '',
  },
  
  // Configure webpack to handle Node.js modules and optimize builds
  webpack: (config, { isServer, dev }) => {
    // Only add these configurations for server-side bundles
    if (isServer) {
      // Exclude puppeteer and chromium from bundling
      config.externals = [
        ...(config.externals || []), 
        {
          'puppeteer-core': 'commonjs puppeteer-core',
          '@sparticuz/chromium-min': 'commonjs @sparticuz/chromium-min',
          'canvas': 'commonjs canvas',
          'sharp': 'commonjs sharp'
        }
      ];
      
      // Enable source maps in development
      if (dev) {
        config.devtool = 'source-map';
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
