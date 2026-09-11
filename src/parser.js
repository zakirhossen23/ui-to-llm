const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

const BUTTON_PATTERN =
  /^(submit|log\s*in|log\s*out|sign\s*in|sign\s*up|login|logout|signup|register|create\s+(account|new)|save|cancel|delete|remove|edit|update|add|ok|okay|done|next|previous|back|continue|retry|send|download|upload|buy|purchase|get\s+started|start|install|upgrade|apply|confirm|reset|close|enable|disable|connect|disconnect|accept|reject|copy|share|follow|subscribe|checkout|refresh|clear|filter|export|import|generate|add\s+to\s+cart|see\s+all|view\s+all|learn\s+more|read\s+more|show\s+more)\s*$/i;

const STRONG_INPUT_PATTERN =
  /(\.{2,}|enter\s+|type\s+|search|placeholder|https?:\s|@\S+\.\S+)/i;

const MENU_PATTERN =
  /^(home|dashboard|overview|analytics|reports|settings|profile|account|billing|orders|products|customers|users|teams|members|projects|tasks|inbox|messages|notifications|help|documentation|docs|integrations|api|usage|pricing|plans|upgrade|logout|log\s*out|sign\s*out|signup|login|contacts|marketplace|templates|sharing|collaboration|channels|calendar|schedule|files|assets|media|transactions|payments|withdraw)\s*$/i;

function sortBox(b) {
  const [y0, x0, y1, x1] = b;
  return [Math.min(y0, y1), Math.min(x0, x1), Math.max(y0, y1), Math.max(x0, x1)];
}

/**
 * Clusters OCR words into reading-order text lines.
 * Groups words whose vertical centers are within a tolerance, so distinct
 * table rows / columns never absorb each other.
 * @param {Array<{text:string, bbox:Array<number>, confidence:number}>} words
 * @returns {Array<{x0:number,y0:number,x1:number,y1:number,words:Array}>}
 */
function groupWordsIntoLines(words) {
  const heights = words.map((w) => w.bbox[2] - w.bbox[0]).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 10;
  const yTol = Math.max(4, Math.min(16, medianH * 0.55));

  const sorted = [...words].sort((a, b) => {
    const ay = (a.bbox[0] + a.bbox[2]) / 2;
    const by = (b.bbox[0] + b.bbox[2]) / 2;
    if (Math.abs(ay - by) > yTol) return ay - by;
    return a.bbox[1] - b.bbox[1];
  });

  const lines = [];

  for (const w of sorted) {
    const [y0, x0, y1, x1] = w.bbox;
    const cy = (y0 + y1) / 2;
    const maxGap = Math.min(Math.max(6, (x1 - x0) * 1.5), 30);
    let best = null;
    let bestDist = Infinity;

    for (const line of lines) {
      if (Math.abs(cy - line.cy) > yTol) continue;
      const gap = x0 - line.x1;
      if (gap < -(x1 - x0) || gap > maxGap) continue;
      const dist = Math.abs(cy - line.cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = line;
      }
    }

    if (best) {
      best.words.push(w);
      best.x0 = Math.min(best.x0, x0);
      best.x1 = Math.max(best.x1, x1);
      best.cy = best.cy + (cy - best.cy) / best.words.length;
    } else {
      lines.push({ x0, y0, x1, y1, cy, words: [w] });
    }
  }

  for (const line of lines) {
    line.y0 = Math.min(...line.words.map((w) => w.bbox[0]));
    line.y1 = Math.max(...line.words.map((w) => w.bbox[2]));
  }

  return lines;
}

/**
 * Merges tightly packed consecutive lines into multi-line text elements when
 * the next line sits directly beneath the previous one at the same column
 * (gap <= 2px). Prevents table columns from collapsing into a single blob.
 */
function groupLinesIntoElements(lines) {
  const elements = [];

  for (const line of lines) {
    const last = elements[elements.length - 1];
    if (last) {
      const gap = line.y0 - last.y1;
      const overlapX = Math.min(last.x1, line.x1) - Math.max(last.x0, line.x0);
      const minW = Math.min(last.x1 - last.x0, line.x1 - line.x0);
      const denseOverlap = minW > 0 && overlapX / minW >= 0.8;
      const wrapped = gap <= 2;
      const aligned = Math.abs(line.x0 - last.x0) <= Math.max(4, (last.x1 - last.x0) * 0.15);

      if (denseOverlap && wrapped && aligned) {
        last.lines.push(line);
        last.x0 = Math.min(last.x0, line.x0);
        last.y0 = Math.min(last.y0, line.y0);
        last.x1 = Math.max(last.x1, line.x1);
        last.y1 = Math.max(last.y1, line.y1);
        continue;
      }
    }

    elements.push({
      x0: line.x0, y0: line.y0, x1: line.x1, y1: line.y1,
      lines: [line]
    });
  }

  return elements;
}

function joinText(lines) {
  return lines
    .map((line) => line.words
      .slice()
      .sort((a, b) => a.bbox[1] - b.bbox[1])
      .map((w) => w.text)
      .join(' '))
    .join('\n');
}

function avgConfidence(lines) {
  const all = lines.flatMap((l) => l.words).map((w) => w.confidence);
  return Math.round((all.reduce((s, c) => s + c, 0) / all.length) * 100) / 100;
}

/**
 * Heuristic element type detection. Runs over geometry + content so a
 * text-only model can understand what each region represents.
 */
function inferType(element, W, H, medianHeight) {
  const text = element.text.trim().toLowerCase();
  const w = element.x1 - element.x0;
  const h = element.y1 - element.y0;
  const cy = (element.y0 + element.y1) / 2 / H;
  const lineCount = element.lines.length;
  const x0r = element.x0 / W;
  const isTall = h >= medianHeight * 1.5;
  const concise = text.length <= 26 && text.split(/\s+/).length <= 2;

  if (cy < 0.045 && element.y1 < 120 && lineCount <= 2) return 'header';
  if (w / W >= 0.8 && cy > 0.9) return 'footer';

  if (MENU_PATTERN.test(text) && (x0r < 0.35 || cy < 0.2)) return 'menu';
  if (BUTTON_PATTERN.test(text) && concise) return 'button';
  if (STRONG_INPUT_PATTERN.test(text) && lineCount === 1 && text.length <= 48) return 'input';
  if (isTall && lineCount === 1 && text.length <= 40) return 'heading';
  if (lineCount === 1 && /^[\d,.%$£€+−-]+$/.test(element.text.trim()) && element.text.trim().length <= 16) return 'kpi';
  if (lineCount > 1) return 'text';
  if (concise && text.length >= 2) return 'label';

  return 'text';
}

function buildLayoutSummary(elements, W, H) {
  const lines = [
    `UI layout: ${W}x${H}px, ${elements.length} detected elements (from top-left to bottom-right).`
  ];
  for (const el of elements) {
    const text = el.text.replace(/\s+/g, ' ').trim();
    const preview = text.length > 64 ? text.slice(0, 61) + '...' : text;
    const label = preview ? `"${preview}"` : '(no text)';
    const [n0, n1, n2, n3] = el.box_2d_normalized;
    lines.push(
      `#${el.id} [${el.type}] ${label} -> px (${el.box_2d_pixels[1]},${el.box_2d_pixels[0]}) to (${el.box_2d_pixels[3]},${el.box_2d_pixels[2]}), ` +
      `normalized (y0=${n0},x0=${n1},y1=${n2},x1=${n3})`
    );
  }
  return lines;
}

/**
 * Parses a PNG image into structured UI layout JSON: grouped elements with
 * bounding boxes, inferred types, and a text summary for non-vision LLMs.
 * @param {string} imagePath
 * @returns {Promise<Object>}
 */
async function parseImageToJSON(imagePath) {
  const metadata = await sharp(imagePath).metadata();
  const { width: W, height: H } = metadata;

  const worker = await createWorker('eng');
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();

  const rawWords = data.words
    .filter((w) => w.confidence / 100 >= 0.4 && /[0-9A-Za-z]/.test(w.text))
    .map((word) => {
      const [y0, x0, y1, x1] = sortBox([word.bbox.y0, word.bbox.x0, word.bbox.y1, word.bbox.x1]);
      const w = word.text.replace(/\s+/g, ' ').trim();
      const wordH = y1 - y0;
      const wordW = x1 - x0;
      return {
        text: w,
        confidence: word.confidence / 100,
        bbox: [y0, x0, y1, x1],
        _skip:
          (w.length === 1 && !/^[0-9A-Za-z]$/.test(w)) ||
          wordH > H * 0.15 ||
          wordW > W * 0.35
      };
    })
    .filter((w) => !w._skip)
    .map(({ _skip, ...w }) => w);

  const lines = groupWordsIntoLines(rawWords);
  const grouped = groupLinesIntoElements(lines);

  grouped.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

  const medianHeight = grouped
    .map((e) => e.y1 - e.y0)
    .sort((a, b) => a - b)[Math.floor(grouped.length / 2)] || 12;

  const elements = grouped.map((el, index) => {
    const text = joinText(el.lines);
    const element = {
      id: index + 1,
      lines: el.lines.length,
      type: null,
      text,
      confidence: avgConfidence(el.lines),
      box_2d_pixels: [el.y0, el.x0, el.y1, el.x1],
      box_2d_normalized: [
        Math.round((el.y0 / H) * 1000),
        Math.round((el.x0 / W) * 1000),
        Math.round((el.y1 / H) * 1000),
        Math.round((el.x1 / W) * 1000)
      ]
    };
    element.type = inferType(
      { x0: el.x0, y0: el.y0, x1: el.x1, y1: el.y1, lines: el.lines, text },
      W,
      H,
      medianHeight
    );
    return element;
  });

  const layout_summary = buildLayoutSummary(elements, W, H);

  return {
    author: 'Zakir Hossen (zakirhossen23)',
    image_info: { width: W, height: H },
    total_elements: elements.length,
    elements,
    layout_summary,
    llm_prompt_block: layout_summary.join('\n')
  };
}

module.exports = { parseImageToJSON };