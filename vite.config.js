import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
    // onshape-redirect! Its a little clunky and maybe not the best way
    // but, we make a mini plugin at /onshape with that
    // static index file that works as a redirect.
    plugins: [
        svelte(),
        {
            name: 'onshape-redirect',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (req.url === '/onshape' || req.url === '/onshape/') {
                        req.url = '/onshape/index.html'
                    }
                    next()
                })
            }
        },
        {
            name: 'github-pages-spa-fallback',
            closeBundle() {
                const distIndex = path.resolve(__dirname, 'dist/index.html')
                const dist404 = path.resolve(__dirname, 'dist/404.html')
                if (fs.existsSync(distIndex)) {
                    fs.copyFileSync(distIndex, dist404)
                }
            }
        }
    ],
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


