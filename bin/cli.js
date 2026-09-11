#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const UILayoutParser = require('../src/index');

function parseArgs(argv) {
  const positional = [];
  const opts = { json: 'layout.json', overlay: null, generateOverlay: true };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = argv[++i];
    } else if (arg === '--overlay') {
      opts.overlay = argv[++i];
    } else if (arg === '--no-overlay') {
      opts.generateOverlay = false;
    } else if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else {
      positional.push(arg);
    }
  }

  if (opts.overlay) opts.generateOverlay = true;
  opts.input = positional[0];
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help || !opts.input) {
  console.log(`Usage: ui-to-llm <path-to-screenshot.png> [options]

Options:
  --json <file>      JSON output path (default: layout.json)
  --overlay <file>   Annotated SoM image path (default: annotated_ui.png)
  --no-overlay       Skip generating the annotated image

Outputs a structured JSON layout (grouped UI elements, inferred types,
bounding boxes, and a text summary) a text-only LLM can reason over.`);
  process.exit(opts.help ? 0 : 1);
}

const inputImage = path.resolve(opts.input);
const overlayPath = opts.generateOverlay ? (opts.overlay || 'annotated_ui.png') : null;

(async () => {
  try {
    console.log(`Parsing UI layout: ${inputImage}`);
    const result = await UILayoutParser.process(inputImage, {
      generateOverlay: opts.generateOverlay,
      outputPath: overlayPath
    });

    fs.writeFileSync(opts.json, JSON.stringify(result.json, null, 2));
    console.log(`✓ JSON written to ${path.resolve(opts.json)} (${result.json.total_elements} elements)`);

    if (overlayPath) {
      console.log(`✓ Annotated image written to ${path.resolve(overlayPath)}`);
    }

    console.log('\n--- Layout summary (ready for a non-vision LLM) ---');
    console.log(result.json.llm_prompt_block);
  } catch (err) {
    console.error('Failed to parse UI:', err);
    process.exit(1);
  }
})();