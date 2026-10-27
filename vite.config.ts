import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    reactRouter(),
    VitePWA({
      devOptions: {
        enabled: true, // 开启 dev 模式支持
        type: 'module', // SSR 项目用 module 类型
      },
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'favicon.ico',
        'favicon-16.png',
        'favicon-32.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Holdly',
        short_name: 'Holdly',
        description: 'Holdly 是一个资产与订阅管理应用。',
        theme_color: '#faf9f5',
        background_color: '#faf9f5',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
