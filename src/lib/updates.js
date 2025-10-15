// Loads and renders updates from src/updates/**
// Needs a README.md, preview.(png|jpg|jpeg|webp|gif), bundle.zip


const readmes = import.meta.glob('/src/updates/**/README.md', { query: '?raw', import: 'default', eager: true })
const previews = import.meta.glob('/src/updates/**/preview.{png,jpg,jpeg,webp,gif}', { query: '?url', import: 'default', eager: true })
const bundles = import.meta.glob('/src/updates/**/bundle.zip', { query: '?url', import: 'default', eager: true })

function extractTitleAndBlurb(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return { title: 'Untitled', blurb: '', date: new Date() }
    }

    const lines = markdown.split(/\r?\n/)
    let title = 'Untitled'
    let blurb = ''
    let date = new Date()

    // Check for YAML frontmatter
    if (lines[0] === '---') {
        let frontmatterEnd = -1
        for (let i = 1; i < lines.length; i++) {
            if (lines[i] === '---') {
                frontmatterEnd = i
                break
            }
        }

        if (frontmatterEnd > 0) {
            // Parse frontmatter
            for (let i = 1; i < frontmatterEnd; i++) {
                const match = lines[i].match(/^date:\s*(.+)$/)
                if (match) {
                    const dateStr = match[1].trim()
                    const parsed = new Date(dateStr)
                    if (!isNaN(parsed.getTime())) {
                        date = parsed
                    }
                }
            }
        }
    }

    // Find title (first H1 after frontmatter)
    const startLine = lines[0] === '---' ? lines.findIndex((line, i) => i > 0 && line === '---') + 1 : 0
    for (let i = startLine; i < lines.length; i++) {
        const m = lines[i].match(/^#\s+(.*)/)
        if (m) {
            title = m[1].trim()
            break
        }
    }

    // blurb: first non-empty line that isn't a heading (after frontmatter)
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        if (/^#/.test(line)) continue
        blurb = line
        break
    }

    return { title, blurb, date }
}

export function loadUpdates() {
    const updates = []

    for (const path in readmes) {
        const md = readmes[path]
        const folder = path.replace(/\/README\.md$/, '')
        const { title, blurb, date } = extractTitleAndBlurb(md)

        // find preview if present, otherwise use default
        let previewUrl = '/logos/Thermocline%20PFP.png' // default
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
        updates.push({ slug, title, blurb, previewUrl, bundleUrl, markdown: md, date })
    }

    // Sort by date (newest first)
    updates.sort((a, b) => b.date.getTime() - a.date.getTime())

    return updates
}


