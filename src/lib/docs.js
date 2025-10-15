// Loads RST documentation files from src/docs/**
// Each doc file should be named with .rst extension
// Simple RST-to-HTML converter (basic implementation)

const docFiles = import.meta.glob('/src/docs/**/*.rst', { query: '?raw', import: 'default', eager: true })

function extractTitle(rstContent) {
    if (!rstContent || typeof rstContent !== 'string') {
        return 'Untitled'
    }

    const lines = rstContent.split(/\r?\n/)

    // Look for title (first non-empty line that's not a comment)
    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('..') && !trimmed.startsWith('===')) {
            return trimmed
        }
    }

    return 'Untitled'
}

function simpleRstToHtml(rstContent) {
    if (!rstContent) return '<p>No content</p>'

    let html = rstContent

    // Convert basic RST syntax to HTML
    // Headers
    html = html.replace(/^(.+)\n=+\n/gm, '<h1>$1</h1>')
    html = html.replace(/^(.+)\n-+\n/gm, '<h2>$1</h2>')
    html = html.replace(/^(.+)\n~+\n/gm, '<h3>$1</h3>')

    // Images
    html = html.replace(/^\.\. image::\s*(.+?)\s*$/gm, '<img src="$1" alt="" />')
    html = html.replace(/^   :alt:\s*(.+?)\s*$/gm, (match, alt) => {
        // Find the previous img tag and update its alt
        return '' // Remove the alt line, we'll handle it differently
    })

    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Code blocks
    html = html.replace(/::\n\n((?:.+\n?)+)/g, '<pre><code>$1</code></pre>')
    html = html.replace(/``(.+?)``/g, '<code>$1</code>')

    // Lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>')
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')

    // Wrap consecutive list items in ul/ol
    html = html.replace(/(<li>.*<\/li>\s*)+/g, (match) => {
        if (match.includes('<li>1.')) {
            return '<ol>' + match + '</ol>'
        }
        return '<ul>' + match + '</ul>'
    })

    // Paragraphs (double newline)
    html = html.split('\n\n').map(para => {
        para = para.trim()
        if (para && !para.startsWith('<')) {
            return '<p>' + para + '</p>'
        }
        return para
    }).join('\n\n')

    // Clean up extra whitespace
    html = html.replace(/\n\s*\n/g, '\n')

    return html
}

export function loadDocs() {
    const docs = []

    for (const path in docFiles) {
        const rstContent = docFiles[path]
        const title = extractTitle(rstContent)

        // Convert RST to HTML using simple converter
        const htmlContent = simpleRstToHtml(rstContent)

        const slug = path.split('/').pop().replace('.rst', '')
        docs.push({
            slug,
            title,
            content: htmlContent,
            path
        })
    }

    // Sort alphabetically by title
    docs.sort((a, b) => a.title.localeCompare(b.title))

    return docs
}
