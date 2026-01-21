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
    },
    build: {
        rollupOptions: {
            output: {
                assetFileNames: (assetInfo) => {
                    // Use originalFileNames to get the source file path
                    const originalPath = assetInfo.originalFileNames?.[0] || assetInfo.name || '';
                    
                    // Extract slug from update preview images and bundles
                    // e.g., /path/to/project/src/updates/verification-integration-test/preview.png
                    const updatesMatch = originalPath.match(/src[\/\\]updates[\/\\]([^\/\\]+)[\/\\](preview|bundle)\.([^.]+)$/);
                    if (updatesMatch) {
                        const [, slug, type, ext] = updatesMatch;
                        return `assets/${type}-${slug}.${ext}`;
                    }
                    
                    // Default behavior for other assets (keep hash for cache busting)
                    return 'assets/[name]-[hash][extname]';
                }
            }
        }
    }
})


