#!/usr/bin/env node

/**
 * Regenerate Specific Avatars Script
 * Regenerates avatars for specific authors (useful for fixing borders or quality issues)
 *
 * Usage:
 *   node regenerate-specific.js "Author Name 1" "Author Name 2" ...
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGEN_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

// Paths
const AVATARS_DIR = path.join(__dirname, 'avatars');
const MANIFEST_FILE = path.join(__dirname, 'manifest.json');
const LOG_FILE = path.join(__dirname, 'regeneration.log');

// Authors to regenerate (from command line args or hardcoded)
const authorsToRegenerate = process.argv.slice(2);

if (authorsToRegenerate.length === 0) {
  console.error('Error: Please provide author names to regenerate');
  console.error('Usage: node regenerate-specific.js "Arthur Schopenhauer" "Abraham Maslow"');
  process.exit(1);
}

// Ensure avatars directory exists
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

/**
 * Normalize author name to filename
 */
function normalizeFilename(authorName) {
  return authorName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
}

/**
 * Generate avatar for a single author
 */
async function generateAvatar(authorName) {
  const prompt = `Portrait of ${authorName}, detailed pen and ink sketch style, classical engraving technique, cross-hatching shading, pure white background, black and white only, historical figure portrait, Renaissance engraving style, highly detailed facial features, traditional illustration, etching art style, no color, monochrome, professional historical portrait, NO BORDERS, NO FRAMES, no decorative elements, seamless edge to edge, clean portrait only, full bleed to canvas edges, 1024x1024`;

  try {
    const response = await fetch(IMAGEN_API_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts;

    if (!parts) {
      throw new Error('No parts in response');
    }

    const imagePart = parts.find(part => part.inlineData);
    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
      throw new Error('No image data in response');
    }

    return imagePart.inlineData.data;
  } catch (error) {
    throw new Error(`Generation failed: ${error.message}`);
  }
}

/**
 * Save avatar to file
 */
function saveAvatar(authorName, base64Data) {
  const filename = normalizeFilename(authorName);
  const filepath = path.join(AVATARS_DIR, filename);

  // Backup old file if it exists
  if (fs.existsSync(filepath)) {
    const backupPath = filepath.replace('.png', '.backup.png');
    fs.copyFileSync(filepath, backupPath);
    log(`  📦 Backed up old file to: ${path.basename(backupPath)}`);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);
  return filename;
}

/**
 * Log message to both console and file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(message); // Print without timestamp to console for cleaner output
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

/**
 * Load manifest
 */
function loadManifest() {
  if (fs.existsSync(MANIFEST_FILE)) {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  }
  return {
    generated_at: new Date().toISOString(),
    total_avatars: 0,
    avatars: {}
  };
}

/**
 * Save manifest
 */
function saveManifest(manifest) {
  manifest.updated_at = new Date().toISOString();
  manifest.total_avatars = Object.keys(manifest.avatars).length;
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
  if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in .env file');
    process.exit(1);
  }

  log(`\n=== Regenerating Specific Avatars ===`);
  log(`Authors to regenerate: ${authorsToRegenerate.length}`);
  authorsToRegenerate.forEach((author, i) => {
    log(`  ${i + 1}. ${author}`);
  });
  log('');

  // Load existing manifest
  const manifest = loadManifest();

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < authorsToRegenerate.length; i++) {
    const author = authorsToRegenerate[i];

    try {
      log(`[${i + 1}/${authorsToRegenerate.length}] 🎨 Regenerating: ${author}...`);

      const base64Data = await generateAvatar(author);
      const savedFilename = saveAvatar(author, base64Data);

      // Update manifest
      manifest.avatars[author] = {
        filename: savedFilename,
        generated_at: new Date().toISOString(),
        regenerated: true
      };
      saveManifest(manifest);

      log(`[${i + 1}/${authorsToRegenerate.length}] ✅ SUCCESS: ${author} -> ${savedFilename}`);
      successCount++;

      // Rate limiting (1 second delay between requests)
      if (i < authorsToRegenerate.length - 1) {
        log('  ⏳ Waiting 1 second before next request...\n');
        await sleep(1000);
      }
    } catch (error) {
      log(`[${i + 1}/${authorsToRegenerate.length}] ❌ ERROR: ${author} - ${error.message}`);
      errorCount++;
      errors.push({ author, error: error.message });
    }
  }

  // Summary
  log(`\n=== Regeneration Complete ===`);
  log(`✅ Success: ${successCount}`);
  log(`❌ Errors: ${errorCount}`);

  if (errors.length > 0) {
    log(`\nErrors:`);
    errors.forEach(({ author, error }) => {
      log(`  - ${author}: ${error}`);
    });
  }

  // Cost estimate
  const estimatedCost = successCount * 0.01; // $0.01 per generation
  log(`\nEstimated cost: $${estimatedCost.toFixed(2)} (${successCount} API calls @ $0.01 each)`);

  log(`\n✨ Done! You can now upload these avatars to the CDN.`);
  log(`\nNext steps:`);
  log(`  1. Review the regenerated avatars in: ${AVATARS_DIR}`);
  log(`  2. If satisfied, commit and push to youth-wisdom-avatars repo`);
  log(`  3. Avatars will be available via CDN immediately after push`);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
