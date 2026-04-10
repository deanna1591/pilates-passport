import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Expo / React Native packages are native-only and will never exist
      // in the web browser bundle. Externalizing them prevents Rollup from
      // trying to bundle them and failing with a missing-module error.
      external: [
        /^expo-.*/,          // expo-healthkit, expo-location, expo-notifications, etc.
        /^react-native.*/,   // react-native, react-native-*
        '@react-native-community/netinfo',
      ],
    },
  },
})
