// test.js
const UILayoutParser = require('./src/index');
const path = require('path');

async function testPackage() {
  try {
    console.log('Testing UILayoutParser...');
    
    const sampleImage = path.join(__dirname, 'test-ui.png');
    
    const result = await UILayoutParser.process(sampleImage, {
      generateOverlay: true,
      outputPath: 'test_output_annotated.png'
    });

    console.log('--- Test Success ---');
    console.log('Total elements detected:', result.json.total_elements);
    console.log('Author verification:', result.json.author);
    console.log('Annotated image saved to:', result.annotatedImagePath);
    
  } catch (error) {
    console.error('Test Failed:', error);
  }
}

testPackage();