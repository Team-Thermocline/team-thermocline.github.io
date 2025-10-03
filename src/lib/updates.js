// Loads and renders updates from src/updates/**
// Needs a README.md, preview.(png|jpg|jpeg|webp|gif), bundle.zip


const readmes = import.meta.glob('/src/updates/**/README.md', { as: 'raw', eager: true })
const previews = import.meta.glob('/src/updates/**/preview.{png,jpg,jpeg,webp,gif}', { as: 'url', eager: true })
const bundles = import.meta.glob('/src/updates/**/bundle.zip', { as: 'url', eager: true })

function extractTitleAndBlurb(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return { title: 'Untitled', blurb: '' }
    }
    const lines = markdown.split(/\r?\n/)
    let title = 'Untitled'
    for (const line of lines) {
        const m = line.match(/^#\s+(.*)/)
        if (m) {
            title = m[1].trim()
            break
        }
    }
    // blurb: first non-empty line that isn't a heading
    let blurb = ''
    for (const line of lines) {
        if (!line.trim()) continue
        if (/^#/.test(line)) continue
        blurb = line.trim()
        break
    }
    return { title, blurb }
}

export function loadUpdates() {
    const updates = []

    for (const path in readmes) {
        const md = readmes[path]
        const folder = path.replace(/\/README\.md$/, '')
        const { title, blurb } = extractTitleAndBlurb(md)

        // find preview if present
        let previewUrl = null
        for (const p in previews) {
            if (p.startsWith(folder + '/')) {
                previewUrl = previews[p]
                break
            }
        }

        // find bundle if present
        let bundleUrl = null
        for (const b in bundles) {
            if (b.startsWith(folder + '/')) {
                bundleUrl = bundles[b]
                break
            }
        }

        const slug = folder.split('/').pop()
        updates.push({ slug, title, blurb, previewUrl, bundleUrl, markdown: md })
    }

    // Sort newest first by folder name if using yyyymmdd prefix; otherwise alphabetical reverse
    updates.sort((a, b) => (a.slug < b.slug ? 1 : -1))

    return updates
}


