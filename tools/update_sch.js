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
            const outputDir = join(projectRoot, 'static', 'docs', 'schematics');
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
                    path: `/docs/schematics/${fileName}.html`
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
