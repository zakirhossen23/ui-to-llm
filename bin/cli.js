#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const UILayoutParser = require('../src/index');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: ui-to-llm <path-to-screenshot.png>');
  process.exit(1);
}

const inputImage = path.resolve(args[0]);

(async () => {
  try {
    console.log('Parsing UI layout...');
    const result = await UILayoutParser.process(inputImage, { generateOverlay: true });
    
    fs.writeFileSync('layout.json', JSON.stringify(result.json, null, 2));
    console.log('✓ Successfully generated layout.json and annotated_ui.png');
  } catch (err) {
    console.error('Failed to parse UI:', err);
  }
})();