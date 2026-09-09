const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

/**
 * Parses a PNG image and extracts text bounding boxes along with color metrics.
 * @param {string} imagePath 
 * @returns {Promise<Object>}
 */
async function parseImageToJSON(imagePath) {
  const metadata = await sharp(imagePath).metadata();
  const { width, height } = metadata;

  const worker = await createWorker('eng');
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();

  const elements = data.words.map((word, index) => {
    const { x0, y0, x1, y1 } = word.bbox;
    return {
      id: index + 1,
      type: 'text',
      text: word.text,
      confidence: parseFloat((word.confidence / 100).toFixed(2)),
      box_2d_pixels: [y0, x0, y1, x1],
      box_2d_normalized: [
        Math.round((y0 / height) * 1000),
        Math.round((x0 / width) * 1000),
        Math.round((y1 / height) * 1000),
        Math.round((x1 / width) * 1000)
      ]
    };
  });

  return {
    author: "Zakir Hossen (zakirhossen23)",
    image_info: { width, height },
    total_elements: elements.length,
    elements
  };
}

module.exports = { parseImageToJSON };