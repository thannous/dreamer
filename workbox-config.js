module.exports = {
  globDirectory: 'dist',
  globPatterns: [
    '**/*.{js,css,html,png,svg,ico,json,webp,woff2,woff}'
  ],
  swDest: 'dist/sw.js',
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: '/index.html',
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'http-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    }
  ]
};
