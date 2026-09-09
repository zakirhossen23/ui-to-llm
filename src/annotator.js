const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

/**
 * Draws numbered Set-of-Mark (SoM) bounding boxes on top of the original PNG.
 * @param {string} imagePath 
 * @param {Array} elements 
 * @param {string} outputPath 
 */
async function generateSetOfMarkOverlay(imagePath, elements, outputPath) {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.font = 'bold 12px Arial';

  elements.forEach((el) => {
    const [ymin, xmin, ymax, xmax] = el.box_2d_pixels;
    const w = xmax - xmin;
    const h = ymax - ymin;

    ctx.strokeRect(xmin, ymin, w, h);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(xmin, Math.max(0, ymin - 16), 28, 16);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`[${el.id}]`, xmin + 2, Math.max(12, ymin - 3));
    ctx.fillStyle = '#ef4444';
  });

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

module.exports = { generateSetOfMarkOverlay };