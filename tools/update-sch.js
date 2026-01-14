#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Default path relative to project root
const defaultPath = '../Controller/Hardware/Main-Board/Main-Board.kicad_pro';

function prompt(question) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function cleanHtmlContent(htmlContent, absolutePath) {
    // Extract the base directory from the absolute path
    const baseDir = absolutePath.substring(0, absolutePath.lastIndexOf('/') + 1);
    
    // Get variations of the path (with/without leading slash, with/without trailing slash)
    const baseDirNoLeadingSlash = baseDir.replace(/^\//, '');
    const baseDirNoTrailingSlash = baseDir.replace(/\/$/, '');
    const baseDirNoLeadingNoTrailing = baseDirNoLeadingSlash.replace(/\/$/, '');
    
    // Extract just the filename (e.g., "Main-Board.kicad_pro")
    const fileName = absolutePath.split('/').pop();
    
    // Define replacements for absolute paths and DB.ui references
    const replacements = [
        { from: absolutePath, to: fileName },                   // Full path to filename
        { from: baseDir, to: '' },                              // /home/.../Main-Board/
        { from: baseDirNoLeadingSlash, to: '' },                // home/.../Main-Board/
        { from: baseDirNoTrailingSlash, to: '' },               // /home/.../Main-Board
        { from: baseDirNoLeadingNoTrailing, to: '' },           // home/.../Main-Board
        // Replace DB.ui.schTitle with the filename
        { from: 'DB.ui.schTitle', to: `"${fileName}"` },        // DB.ui.schTitle -> "Main-Board.kicad_pro"
    ];
    
    let cleaned = htmlContent;
    
    // Apply all replacements
    for (const { from, to } of replacements) {
        if (from) {
            cleaned = cleaned.split(from).join(to);
        }
    }
    
    return cleaned;
}

function main() {
    (async () => {
        try {
            // Prompt for path with default
            const inputPath = await prompt(`Enter path to .kicad_pro file [${defaultPath}]: `);
            const kicadProPath = inputPath || defaultPath;
            
            // Resolve to absolute path
            const absolutePath = resolve(projectRoot, kicadProPath);
            
            // Check if file exists
            try {
                readFileSync(absolutePath);
            } catch (e) {
                console.error(`❌ Error: File not found: ${absolutePath}`);
                process.exit(1);
            }
            
            // Extract board name from path (e.g., "Main-Board" from "Main-Board.kicad_pro")
            const fileName = absolutePath.split('/').pop().replace('.kicad_pro', '');
            const boardName = fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // Output directory for schematics (static so they can be served)
            const outputDir = join(projectRoot, 'static', 'schematics');
            const outputPath = join(outputDir, `${fileName}.html`);
            
            // Create output directory if it doesn't exist
            try {
                execSync(`mkdir -p "${outputDir}"`, { stdio: 'inherit' });
            } catch (e) {
                // Directory might already exist, that's fine
            }
            
            console.log(`\nGenerating schematic HTML...`);
            console.log(`   Input:  ${absolutePath}`);
            console.log(`   Output: ${outputPath}\n`);
            
            // Run kischvidimer
            try {
                execSync(`kischvidimer schgen "${absolutePath}" -o "${outputPath}"`, {
                    stdio: 'inherit',
                    cwd: projectRoot
                });
                
                // Post-process: clean up absolute paths in the generated HTML
                console.log(`Cleaning up HTML content...`);
                let htmlContent = readFileSync(outputPath, 'utf-8');
                htmlContent = cleanHtmlContent(htmlContent, absolutePath);
                writeFileSync(outputPath, htmlContent);
                
                // Update manifest file
                const manifestPath = join(projectRoot, 'src', 'lib', 'schematics.json');
                let manifest = { schematics: [] };
                
                if (existsSync(manifestPath)) {
                    try {
                        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
                    } catch (e) {
                        // If manifest is invalid, start fresh
                        manifest = { schematics: [] };
                    }
                }
                
                // Add or update this schematic in manifest
                const existingIndex = manifest.schematics.findIndex(s => s.slug === fileName);
                const schematicEntry = {
                    slug: fileName,
                    title: boardName,
                    path: `/schematics/${fileName}.html`
                };
                
                if (existingIndex >= 0) {
                    manifest.schematics[existingIndex] = schematicEntry;
                } else {
                    manifest.schematics.push(schematicEntry);
                }
                
                // Sort by title
                manifest.schematics.sort((a, b) => a.title.localeCompare(b.title));
                
                writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                
                console.log(`\nSchematic HTML generated successfully!`);
                console.log(`\nOutput: ${outputPath}`);
                console.log(`\nThe schematic will be available in the docs section.`);
            } catch (e) {
                console.error(`\n❌ Error running kischvidimer: ${e.message}`);
                process.exit(1);
            }
        } catch (e) {
            console.error(`\n❌ Error: ${e.message}`);
            process.exit(1);
        }
    })();
}

main();