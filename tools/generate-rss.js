#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const updatesDir = join(projectRoot, 'src', 'updates');
const distDir = join(projectRoot, 'dist');
const outputPath = join(distDir, 'feed.xml');

const BASE_URL = 'https://team-thermocline.github.io/';

function extractTitleAndBlurb(markdown) {
    /* Extracts the title and blurb from the markdown file.
     */
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

function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatDate(date) {
    return date.toUTCString();
}

function findPreviewImage(entryPath, slug) {
    const previewExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    for (const ext of previewExtensions) {
        const previewPath = join(entryPath, `preview.${ext}`);
        try {
            if (statSync(previewPath).isFile()) {
                // Use predictable path: assets/preview-{slug}.{ext}
                return `/assets/preview-${slug}.${ext}`;
            }
        } catch (err) {
            // File doesn't exist, try next extension
            continue;
        }
    }
    // Default preview if none found
    return '/logos/Thermocline%20PFP.png';
}

function loadUpdates() {
    const updates = [];
    const entries = readdirSync(updatesDir);
    
    for (const entry of entries) {
        const entryPath = join(updatesDir, entry);
        if (!statSync(entryPath).isDirectory()) continue;
        
        const readmePath = join(entryPath, 'README.md');
        try {
            const markdown = readFileSync(readmePath, 'utf-8');
            const { title, blurb, date } = extractTitleAndBlurb(markdown);
            const slug = entry;
            const previewUrl = findPreviewImage(entryPath, slug);
            
            updates.push({ slug, title, blurb, markdown, date, previewUrl });
        } catch (err) {
            // Skip if README doesn't exist
            continue;
        }
    }
    
    // Sort by date (newest first)
    updates.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return updates;
}

function generateRss() {
    const updates = loadUpdates();
    
    const rssItems = updates.map(update => {
        const link = `${BASE_URL}#update:${update.slug}`;
        const pubDate = formatDate(update.date);
        const description = escapeXml(update.blurb || 'No description available.');
        const imageUrl = `${BASE_URL}${update.previewUrl.replace(/^\//, '')}`;
        
        // Determine image type from extension
        const imageExt = update.previewUrl.split('.').pop().toLowerCase();
        const imageType = imageExt === 'jpg' ? 'image/jpeg' : 
                         imageExt === 'png' ? 'image/png' :
                         imageExt === 'gif' ? 'image/gif' :
                         imageExt === 'webp' ? 'image/webp' : 'image/jpeg';
        
        // Use standard RSS 2.0 enclosure tag for images
        // idk how to do length i think this is okay
        const mediaContent = update.previewUrl ? `
      <enclosure url="${imageUrl}" type="${imageType}" length="0"/>` : '';
        
        return `    <item>
      <title>${escapeXml(update.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>${mediaContent}
    </item>`;
    }).join('\n');
    
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Team Thermocline Updates</title>
    <link>${BASE_URL}</link>
    <description>Deliverables and Updates from Team Thermocline - SNHU 25-26</description>
    <language>en-US</language>
    <lastBuildDate>${formatDate(new Date())}</lastBuildDate>
    <atom:link href="${BASE_URL}feed.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;
    
    writeFileSync(outputPath, rssXml, 'utf-8');
    console.log(`✅ RSS feed generated: ${outputPath}`);
    console.log(`   ${updates.length} items included`);
}

generateRss();
