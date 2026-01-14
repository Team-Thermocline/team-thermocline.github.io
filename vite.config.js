import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [svelte()],
    publicDir: 'static',
    assetsInclude: ['**/*.zip'], // Allows us to serve static zip packages
    server: {
        // For static files
        fs: {
            strict: false
        }
    }
})


