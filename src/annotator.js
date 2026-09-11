const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

const TYPE_COLORS = {
  header: '#2563eb',
  footer: '#6b21a8',
  menu: '#0d9488',
  button: '#16a34a',
  input: '#ca8a04',
  heading: '#9333ea',
  label: '#dc2626',
  kpi: '#0891b2',
  text: '#475569'
};

const DEFAULT_COLOR = '#ef4444';

/**
 * Draws numbered Set-of-Mark (SoM) bounding boxes on top of the original PNG.
 * Boxes are color-coded by inferred element type.
 * @param {string} imagePath
 * @param {Array} elements
 * @param {string} outputPath
 */
async function generateSetOfMarkOverlay(imagePath, elements, outputPath) {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);

  ctx.lineWidth = 2;
  ctx.font = 'bold 12px Arial';

  elements.forEach((el) => {
    const [ymin, xmin, ymax, xmax] = el.box_2d_pixels;
    const w = xmax - xmin;
    const h = ymax - ymin;
    const color = TYPE_COLORS[el.type] || DEFAULT_COLOR;

    const labelW = 14 + el.id.toString().length * 7;

    ctx.strokeStyle = color;
    ctx.strokeRect(xmin, ymin, w, h);

    ctx.fillStyle = color;
    ctx.fillRect(xmin, Math.max(0, ymin - 16), labelW, 16);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`[${el.id}]`, xmin + 2, Math.max(12, ymin - 3));
  });

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

module.exports = { generateSetOfMarkOverlay };