const { parseImageToJSON } = require('./parser');
const { generateSetOfMarkOverlay } = require('./annotator');

class UILayoutParser {
  static async process(imagePath, options = {}) {
    const layoutJSON = await parseImageToJSON(imagePath);

    let overlayPath = null;
    if (options.generateOverlay) {
      overlayPath = options.outputPath || 'annotated_ui.png';
      await generateSetOfMarkOverlay(imagePath, layoutJSON.elements, overlayPath);
    }

    return {
      json: layoutJSON,
      annotatedImagePath: overlayPath
    };
  }
}

module.exports = UILayoutParser;