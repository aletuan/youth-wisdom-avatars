#!/usr/bin/env node

/**
 * Batch Avatar Generation Script
 * Generates avatars for a curated list of authors using Gemini API
 *
 * Usage:
 *   node generate-batch.js [--start N] [--limit N] [--delay MS]
 *
 * Options:
 *   --start N    Start from author index N (default: 0)
 *   --limit N    Generate only N avatars (default: all)
 *   --delay MS   Delay between API calls in ms (default: 1000)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGEN_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

// Parse command line args
const args = process.argv.slice(2);
const startIndex = parseInt(args.find(arg => arg.startsWith('--start'))?.split('=')[1] || '0');
const limit = parseInt(args.find(arg => arg.startsWith('--limit'))?.split('=')[1] || '0');
const delay = parseInt(args.find(arg => arg.startsWith('--delay'))?.split('=')[1] || '1000');

// Paths
const AUTHORS_FILE = path.join(__dirname, 'authors.json');
const AVATARS_DIR = path.join(__dirname, 'avatars');
const MANIFEST_FILE = path.join(__dirname, 'manifest.json');
const LOG_FILE = path.join(__dirname, 'generation.log');

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
  const prompt = `Portrait of ${authorName}, detailed pen and ink sketch style, classical engraving technique, cross-hatching shading, pure white background, black and white only, historical figure portrait, Renaissance engraving style, highly detailed facial features, traditional illustration, etching art style, no color, monochrome, professional historical portrait, 1024x1024`;

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
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

/**
 * Load or create manifest
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

  // Load authors list
  const authorsData = JSON.parse(fs.readFileSync(AUTHORS_FILE, 'utf8'));
  const authors = authorsData.authors;

  log(`=== Batch Avatar Generation Started ===`);
  log(`Total authors: ${authors.length}`);
  log(`Start index: ${startIndex}`);
  log(`Limit: ${limit || 'all'}`);
  log(`Delay: ${delay}ms`);

  // Load existing manifest
  const manifest = loadManifest();

  // Determine range
  const endIndex = limit > 0 ? Math.min(startIndex + limit, authors.length) : authors.length;
  const authorsToProcess = authors.slice(startIndex, endIndex);

  log(`Processing ${authorsToProcess.length} authors (${startIndex} to ${endIndex - 1})`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < authorsToProcess.length; i++) {
    const author = authorsToProcess[i];
    const currentIndex = startIndex + i;
    const filename = normalizeFilename(author);
    const filepath = path.join(AVATARS_DIR, filename);

    // Skip if already exists
    if (fs.existsSync(filepath)) {
      log(`[${currentIndex + 1}/${authors.length}] ⏭️  SKIP: ${author} (already exists)`);
      skipCount++;
      continue;
    }

    try {
      log(`[${currentIndex + 1}/${authors.length}] 🎨 Generating: ${author}...`);

      const base64Data = await generateAvatar(author);
      const savedFilename = saveAvatar(author, base64Data);

      // Update manifest
      manifest.avatars[author] = {
        filename: savedFilename,
        generated_at: new Date().toISOString()
      };
      saveManifest(manifest);

      log(`[${currentIndex + 1}/${authors.length}] ✅ SUCCESS: ${author} -> ${savedFilename}`);
      successCount++;

      // Rate limiting
      if (i < authorsToProcess.length - 1) {
        await sleep(delay);
      }
    } catch (error) {
      log(`[${currentIndex + 1}/${authors.length}] ❌ ERROR: ${author} - ${error.message}`);
      errorCount++;
      errors.push({ author, error: error.message });
    }
  }

  // Summary
  log(`\n=== Generation Complete ===`);
  log(`✅ Success: ${successCount}`);
  log(`⏭️  Skipped: ${skipCount}`);
  log(`❌ Errors: ${errorCount}`);
  log(`Total in manifest: ${manifest.total_avatars}`);

  if (errors.length > 0) {
    log(`\nErrors:`);
    errors.forEach(({ author, error }) => {
      log(`  - ${author}: ${error}`);
    });
  }

  // Cost estimate
  const apiCalls = successCount;
  const estimatedCost = apiCalls * 0.01; // $0.01 per generation
  log(`\nEstimated cost: $${estimatedCost.toFixed(2)} (${apiCalls} API calls @ $0.01 each)`);

  log(`\n✨ All done!`);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
