export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase', '@vite-pwa/nuxt'],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Quorum',
      short_name: 'Quorum',
      description: 'Your HOA community platform',
      theme_color: '#6366f1',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/feed',
      icons: [
        { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
          handler: 'NetworkFirst',
          options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
        },
      ],
    },
    client: {
      installPrompt: false, // we handle it manually
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: false, // avoid dev-mode service worker conflicts
    },
  },

  build: {
    transpile: [
      '@fortawesome/fontawesome-svg-core',
      '@fortawesome/vue-fontawesome',
      '@awesome.me/kit-c1511a7855',
    ],
  },

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  css: [
    '@fortawesome/fontawesome-svg-core/styles.css',
    './app/assets/tokens.css',
    './app/assets/main.css',
  ],

  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/auth/callback',
      // Exclude unauthenticated-entry pages from the auth guard
      exclude: ['/invite', '/invite/*', '/setup', '/auth/callback', '/login'],
    },
    clientOptions: {
      auth: {
        // Implicit flow sends the token in the URL hash — no PKCE code verifier needed,
        // which avoids the "verifier not found" SSR cookie-vs-localStorage mismatch.
        flowType: 'implicit',
      },
    },
  },

  runtimeConfig: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    communityId: process.env.COMMUNITY_ID,
    // Must be at least 32 chars — set NUXT_SESSION_PASSWORD in .env
    sessionPassword: process.env.NUXT_SESSION_PASSWORD ?? 'dev-only-password-change-in-production!!',
    public: {},
  },

  typescript: {
    strict: true,
  },
})
