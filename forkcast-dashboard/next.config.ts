import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore TypeScript and ESLint errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Suppress framework disclosure header `X-Powered-By: Next.js` (pentest W12).
  poweredByHeader: false,
  
  // Suppress build warnings
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  
  // Disable build optimizations that might cause warnings
  productionBrowserSourceMaps: false,
  
  // Suppress Next.js warnings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'unsplash.com',
        port: '',
        pathname: '/**',
      },
      // Supabase storage pattern (current project)
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [{
        protocol: 'https' as const,
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', ''),
        port: '',
        pathname: '/storage/v1/object/public/**',
      }] : []),
      // Production Supabase storage (image URLs in data reference production storage)
      {
        protocol: 'https' as const,
        hostname: 'xsovqvbigdettnpeisjs.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // CDN pattern if configured
      ...(process.env.CDN_DOMAIN ? [{
        protocol: 'https' as const,
        hostname: process.env.CDN_DOMAIN,
        port: '',
        pathname: '/**',
      }] : []),
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
  },

  // Asset prefix for CDN
  assetPrefix: process.env.CDN_URL || '',

  // Compression
  compress: true,

  // Performance optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Build optimization
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],

  async headers() {
    // Note: the Content-Security-Policy header is *not* set here — it is
    // generated per-request in middleware.ts with a per-request nonce so we
    // can drop `unsafe-inline` / `unsafe-eval` from script-src (pentest W11).
    // The static baseline below applies to every response, including
    // responses middleware does not rewrite (e.g. static assets handled
    // ahead of middleware).
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          // Cross-Origin-Embedder-Policy is intentionally NOT set to
          // `require-corp`: Google Maps / Supabase storage images / Vercel
          // analytics do not all emit CORP and it would break them. Revisit
          // if we remove those integrations or move them behind same-origin
          // proxies.
          {
            key: 'Permissions-Policy',
            value: [
              'accelerometer=()',
              'ambient-light-sensor=()',
              'autoplay=()',
              'battery=()',
              'camera=()',
              'clipboard-read=()',
              'clipboard-write=(self)',
              'display-capture=()',
              'document-domain=()',
              'encrypted-media=()',
              'fullscreen=(self)',
              'gamepad=()',
              'geolocation=(self)',
              'gyroscope=()',
              'hid=()',
              'idle-detection=()',
              'local-fonts=()',
              'magnetometer=()',
              'microphone=()',
              'midi=()',
              'payment=()',
              'picture-in-picture=()',
              'publickey-credentials-get=()',
              'screen-wake-lock=(self)',
              'serial=()',
              'usb=()',
              'window-management=()',
              'xr-spatial-tracking=()',
            ].join(', '),
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'; connect-src 'self' *.supabase.co",
          },
        ],
      },
      // Static asset caching
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Image caching
      {
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Font caching
      {
        source: '/_next/static/media/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
