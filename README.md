# ui-to-llm

Convert UI screenshots into structured JSON that **text-only LLMs** can reason about. Detects text with Tesseract OCR, groups it into UI elements, infers element types, and outputs bounding boxes plus a human-readable layout summary you can paste straight into a prompt.

## Install

```bash
npm install ui-to-llm
```

Requires Node.js >= 18. On systems without prebuilt binaries for `canvas`, install its native build dependencies (see [node-canvas](https://github.com/Automattic/node-canvas#installation)).

## CLI

```bash
ui-to-llm screenshot.png
ui-to-llm screenshot.png --json layout.json --overlay annotated.png
ui-to-llm screenshot.png --no-overlay
```

Writes `layout.json` by default and an annotated `annotated_ui.png` (color-coded bounding boxes).

## Library API

```js
const UILayoutParser = require('ui-to-llm');

const result = await UILayoutParser.process('screenshot.png', {
  generateOverlay: true,
  outputPath: 'annotated.png'
});

console.log(result.json.llm_prompt_block); // paste into a text-only LLM
```

`result.json` shape:

```json
{
  "author": "Zakir Hossen (zakirhossen23)",
  "image_info": { "width": 1280, "height": 800 },
  "total_elements": 23,
  "elements": [
    {
      "id": 1,
      "type": "header",
      "text": "My Dashboard",
      "confidence": 0.97,
      "box_2d_pixels": [8, 0, 52, 1280],
      "box_2d_normalized": [10, 0, 65, 1000]
    }
  ],
  "layout_summary": [
    "UI layout: 1280x800px, 23 detected elements (from top-left to bottom-right).",
    "#1 [header] \"My Dashboard\" -> px (0,8) to (1280,52), normalized (...)"
  ],
  "llm_prompt_block": "UI layout: 1280x800px, ..."
}
```

- `box_2d_pixels`: `[ymin, xmin, ymax, xmax]`
- `box_2d_normalized`: same order, scaled to 0–1000
- `type`: `header | footer | menu | button | input | heading | label | kpi | text`
- `llm_prompt_block`: ready-to-use text summary for non-vision models

## Example prompt for a text-only LLM

```text
Here is a UI layout in JSON. Describe what this screen does, list the main
elements by id, and explain the user workflow:

<insert llm_prompt_block>
```

## Test

```bash
npm test
```

## License

MIT