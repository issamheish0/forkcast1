import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ForkCast Management',
    short_name: 'ForkCast',
    description: 'Complete restaurant management system for ForkCast bookings, tables, customers, and operations',
    start_url: '/bookings',
    scope: '/',
    display: 'standalone',
    background_color: '#FBF8F6', // Off white brand background
    theme_color: '#7A2E4A', // Mulberry Velvet brand primary
    categories: ['business', 'productivity', 'food'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    prefer_related_applications: false,
    display_override: ['standalone', 'minimal-ui'],
    id: '/bookings',
    launch_handler: {
      client_mode: 'navigate-existing',
    },
    
  }
}