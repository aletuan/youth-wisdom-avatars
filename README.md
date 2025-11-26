# Youth Wisdom Avatars

AI-generated author avatars for the Youth Wisdom mobile app, created using Google Gemini 2.5 Flash Image API.

## Overview

This repository contains pen-and-ink sketch style portraits of famous philosophers, authors, and thought leaders. Avatars are generated in a classical engraving technique with pure white backgrounds, designed to match the aesthetic of the Youth Wisdom app.

## Repository Structure

```
/avatars/           # Generated avatar PNG files
authors.json        # Curated list of 200 famous authors
manifest.json       # Metadata for all generated avatars
generate-batch.js   # Batch generation script
generation.log      # Generation history log
README.md          # This file
```

## Usage in App

Avatars are accessed via GitHub Raw CDN:

```
https://raw.githubusercontent.com/aletuan/youth-wisdom-avatars/main/avatars/{author-name}.png
```

Example:
```
https://raw.githubusercontent.com/aletuan/youth-wisdom-avatars/main/avatars/marcus-aurelius.png
```

## Avatar Style

- **Style**: Detailed pen and ink sketch, classical engraving technique
- **Technique**: Cross-hatching shading, Renaissance engraving style
- **Colors**: Black and white only, monochrome
- **Background**: Pure white (#FFFFFF)
- **Size**: 1024x1024 pixels
- **Format**: PNG

## Generation

Avatars are generated using the Gemini 2.5 Flash Image API. Each generation costs approximately $0.01.

### Generate All Avatars

```bash
node generate-batch.js
```

### Generate Specific Range

```bash
# Generate first 10 avatars
node generate-batch.js --start=0 --limit=10

# Generate next 10 avatars
node generate-batch.js --start=10 --limit=10
```

### Options

- `--start=N` - Start from author index N (default: 0)
- `--limit=N` - Generate only N avatars (default: all)
- `--delay=MS` - Delay between API calls in ms (default: 1000)

### Requirements

1. Node.js installed
2. `.env` file with `GEMINI_API_KEY` in parent project
3. Internet connection

## Cost Estimate

- **200 authors** × $0.01 per avatar = **$2.00 total**
- One-time generation cost
- Free hosting and bandwidth via GitHub

## Contributing

To add a new author avatar:

1. Add the author name to `authors.json`
2. Run `node generate-batch.js` (will skip existing avatars)
3. Commit and push the new avatar file
4. Update `manifest.json` if needed

Or submit a pull request with manually created avatars that match the style guidelines.

## License

Avatars are AI-generated and free to use for the Youth Wisdom app.

## Credits

Generated using [Google Gemini 2.5 Flash Image API](https://ai.google.dev/gemini-api/docs/imagen)
